# backend_fastapi.py
# ==============================================================================
# SISTEMA DE DROGARIA - BACKEND (FastAPI + PostgreSQL)
# ==============================================================================
# Instruções para rodar:
# 1. Instale as dependências: pip install fastapi uvicorn sqlalchemy pydantic psycopg2-binary
# 2. Crie um banco de dados no PostgreSQL chamado 'drogaria_db'
# 3. Altere a string de conexão (DATABASE_URL) com seu usuário e senha do Postgres
# 4. Rode o servidor: uvicorn backend_fastapi:app --reload
# 5. Acesse a documentação automática: http://localhost:8000/docs

from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, text
from sqlalchemy.orm import sessionmaker, Session, declarative_base, relationship
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

import os

# --- CONFIGURAÇÃO DO BANCO DE DADOS (POSTGRESQL) ---
# Em produção (nuvem), usará a variável DATABASE_URL. Localmente, usa o Postgres local.
SQLALCHEMY_DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    "postgresql://postgres:30209713@localhost/drogaria_db"
)

# Correção automática do prefixo obsoleto (comum em provedores na nuvem) para o SQLAlchemy
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Para fins de teste e visualização (se não tiver o Postgres rodando agora), 
# você pode usar o SQLite temporariamente descomentando a linha abaixo:
# SQLALCHEMY_DATABASE_URL = "sqlite:///./drogaria_temp.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- CONFIGURAÇÃO DE SEGURANÇA (PASSWORD HASHING & JWT) ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = "supersecretkeyforpharmasysenterpriseeditionwhichisextremelysecure"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 horas (duração do turno)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- MODELOS DO BANCO DE DADOS (SQLAlchemy) ---

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="caixa")  # "administrador", "farmaceutico", "caixa"
    nome = Column(String, nullable=False)

class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True, index=True)
    codigo_barras = Column(String, unique=True, index=True)
    nome = Column(String, index=True)
    preco = Column(Float)
    estoque_atual = Column(Integer, default=0)
    is_controlado = Column(Boolean, default=False) # Flag vital para o SNGPC

class ReceitaSNGPC(Base):
    """Tabela rigorosa para o controle do SNGPC"""
    __tablename__ = "receitas_sngpc"
    id = Column(Integer, primary_key=True, index=True)
    numero_receita = Column(String, unique=True, index=True)
    tipo_receita = Column(String) # Branca, Azul, Amarela
    crm_medico = Column(String)
    uf_medico = Column(String(2))
    nome_paciente = Column(String)
    doc_paciente = Column(String)
    data_prescricao = Column(DateTime)
    data_registro = Column(DateTime, default=datetime.utcnow)

class Venda(Base):
    __tablename__ = "vendas"
    id = Column(Integer, primary_key=True, index=True)
    valor_total = Column(Float)
    data_venda = Column(DateTime, default=datetime.utcnow)
    forma_pagamento = Column(String)
    
    # Novos campos de Integração com Hardware e Emissão Fiscal
    nsu_tef = Column(String, nullable=True)
    codigo_autorizacao_tef = Column(String, nullable=True)
    chave_acesso_sat = Column(String, nullable=True)
    numero_extrato_sat = Column(String, nullable=True)

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    cpf = Column(String, unique=True, index=True, nullable=False)
    telefone = Column(String, nullable=True)
    limite_credito = Column(Float, default=1000.0)
    saldo_devedor = Column(Float, default=0.0)

class CrediarioLancamento(Base):
    __tablename__ = "crediario_lancamentos"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    venda_id = Column(Integer, ForeignKey("vendas.id"), nullable=True)
    valor = Column(Float, nullable=False)
    data_lancamento = Column(DateTime, default=datetime.utcnow)
    data_vencimento = Column(DateTime, nullable=False)
    status = Column(String, default="Pendente") # "Pendente", "Pago", "Atrasado"

# Cria as tabelas no banco de dados
Base.metadata.create_all(bind=engine)

# Executa migrações DDL seguras para adicionar novos campos caso as tabelas já existam no Postgres
def executar_migracao():
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS nsu_tef VARCHAR;"))
        db.execute(text("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS codigo_autorizacao_tef VARCHAR;"))
        db.execute(text("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS chave_acesso_sat VARCHAR;"))
        db.execute(text("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS numero_extrato_sat VARCHAR;"))
        db.commit()
        print("--- MIGRAÇÃO DE COLUNAS SAT/TEF EXECUTADA COM SUCESSO ---")
    except Exception as e:
        print(f"Erro na migração automática: {e}")
    finally:
        db.close()

executar_migracao()

# Seeda usuários iniciais de forma automática e segura
def seed_usuarios():
    db = SessionLocal()
    try:
        admin_exist = db.query(Usuario).filter(Usuario.username == "admin").first()
        if not admin_exist:
            admin = Usuario(
                username="admin",
                password_hash=get_password_hash("admin123"),
                role="administrador",
                nome="Administrador Geral"
            )
            farmaceutico = Usuario(
                username="farmaceutico",
                password_hash=get_password_hash("farma123"),
                role="farmaceutico",
                nome="Dr. Carlos Rocha"
            )
            caixa = Usuario(
                username="caixa",
                password_hash=get_password_hash("caixa123"),
                role="caixa",
                nome="João Silva"
            )
            db.add(admin)
            db.add(farmaceutico)
            db.add(caixa)
            db.commit()
            print("--- USUÁRIOS PADRÃO SEEDADOS COM SUCESSO ---")
    except Exception as e:
        print("Erro ao seedar usuários padrão:", e)
    finally:
        db.close()

seed_usuarios()

def seed_clientes():
    db = SessionLocal()
    try:
        if db.query(Cliente).count() == 0:
            c1 = Cliente(
                nome="Kennedy Monteiro de Lima",
                cpf="123.456.789-00",
                telefone="(92) 98111-2233",
                limite_credito=1500.0,
                saldo_devedor=0.0
            )
            c2 = Cliente(
                nome="Maria do Carmo Souza",
                cpf="987.654.321-11",
                telefone="(92) 98222-4455",
                limite_credito=800.0,
                saldo_devedor=120.0
            )
            c3 = Cliente(
                nome="José Roberto Silva",
                cpf="456.789.123-22",
                telefone="(92) 98333-6677",
                limite_credito=1000.0,
                saldo_devedor=350.0
            )
            db.add(c1)
            db.add(c2)
            db.add(c3)
            db.commit()
            
            # Recarrega IDs
            db.refresh(c2)
            db.refresh(c3)
            
            # Seeda lançamentos históricos de teste
            l1 = CrediarioLancamento(
                cliente_id=c2.id,
                valor=120.0,
                data_lancamento=datetime.utcnow() - timedelta(days=5),
                data_vencimento=datetime.utcnow() + timedelta(days=25),
                status="Pendente"
            )
            l2 = CrediarioLancamento(
                cliente_id=c3.id,
                valor=350.0,
                data_lancamento=datetime.utcnow() - timedelta(days=35),
                data_vencimento=datetime.utcnow() - timedelta(days=5), # Vencido!
                status="Pendente"
            )
            db.add(l1)
            db.add(l2)
            db.commit()
            print("--- CLIENTES E LANÇAMENTOS DO CREDIÁRIO SEEDADOS COM SUCESSO ---")
    except Exception as e:
        print("Erro ao seedar clientes e crediario:", e)
    finally:
        db.close()

seed_clientes()

# --- SCHEMAS (Pydantic para validação de dados) ---

class ProdutoCreate(BaseModel):
    codigo_barras: str
    nome: str
    preco: float
    estoque_atual: int
    is_controlado: bool

class ProdutoResponse(ProdutoCreate):
    id: int
    class Config:
        from_attributes = True

class ReceitaCreate(BaseModel):
    numero_receita: str
    tipo_receita: str
    crm_medico: str
    uf_medico: str
    nome_paciente: str
    doc_paciente: str
    data_prescricao: datetime

class ClienteCreate(BaseModel):
    nome: str
    cpf: str
    telefone: Optional[str] = None
    limite_credito: Optional[float] = 1000.0

class ClienteResponse(BaseModel):
    id: int
    nome: str
    cpf: str
    telefone: Optional[str]
    limite_credito: float
    saldo_devedor: float

    class Config:
        from_attributes = True

class CrediarioLancamentoResponse(BaseModel):
    id: int
    cliente_id: int
    venda_id: Optional[int]
    valor: float
    data_lancamento: datetime
    data_vencimento: datetime
    status: str

    class Config:
        from_attributes = True

from fastapi.middleware.cors import CORSMiddleware

# --- INICIALIZAÇÃO DO FASTAPI ---
app = FastAPI(
    title="API Drogaria Manager SNGPC",
    description="Backend profissional com segurança forte (JWT/bcrypt/RBAC) para gestão de farmácias",
    version="1.1.0"
)

# Configuração robusta de CORS para suportar desenvolvimento local e deploy na Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176"
    ],
    allow_origin_regex="https://.*\\.vercel\\.app|http://(localhost|127\\.0\\.0\\.1):\\d+",  # Permite qualquer subdomínio da Vercel e qualquer porta localhost
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependência para pegar a sessão do banco de dados
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- MECANISMOS DE SEGURANÇA E DEPENDÊNCIAS DE SESSÃO ---

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão expirada ou inválida. Por favor, realize o login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(Usuario).filter(Usuario.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def require_role(allowed_roles: List[str]):
    def dependency(current_user: Usuario = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acesso negado. Esta função requer privilégios de: {', '.join(allowed_roles)}."
            )
        return current_user
    return dependency

# --- SCHEMAS DE AUTENTICAÇÃO ---

class LoginRequest(BaseModel):
    username: str
    password: str

# --- ROTAS DE AUTENTICAÇÃO ---

@app.post("/auth/login", tags=["Autenticação"])
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    """
    Realiza a autenticação de usuários, retornando um JWT Token seguro
    e os dados cadastrais (nome, perfil de acesso) do operador.
    """
    user = db.query(Usuario).filter(Usuario.username == login_req.username).first()
    if not user or not verify_password(login_req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos."
        )
    
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "nome": user.nome,
            "role": user.role
        }
    }

@app.get("/auth/me", tags=["Autenticação"])
def obter_usuario_logado(current_user: Usuario = Depends(get_current_user)):
    """Retorna os dados cadastrais do operador logado a partir do token JWT"""
    return {
        "username": current_user.username,
        "nome": current_user.nome,
        "role": current_user.role
    }

# --- ROTAS (ENDPOINTS DO SISTEMA PROTEGIDOS) ---

@app.get("/", tags=["Geral"])
def read_root():
    return {"mensagem": "API Segura da Drogaria rodando com sucesso! Acesse /docs para ver a documentação."}

@app.post("/produtos/", response_model=ProdutoResponse, tags=["Estoque"])
def criar_produto(
    produto: ProdutoCreate, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(require_role(["administrador", "farmaceutico"]))
):
    """Permite cadastrar produtos no catálogo (Apenas Administradores e Farmacêuticos)"""
    db_produto = Produto(**produto.dict())
    db.add(db_produto)
    db.commit()
    db.refresh(db_produto)
    return db_produto

@app.get("/produtos/", response_model=List[ProdutoResponse], tags=["Estoque"])
def listar_produtos(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(get_current_user)
):
    """Lista todos os produtos ativos (Requer autenticação básica)"""
    produtos = db.query(Produto).offset(skip).limit(limit).all()
    return produtos

@app.post("/sngpc/receitas/", tags=["SNGPC"])
def registrar_receita_controlada(
    receita: ReceitaCreate, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(require_role(["farmaceutico", "administrador"]))
):
    """
    Registra uma receita de medicamento controlado ANVISA (Apenas Farmacêuticos e Administradores)
    """
    # Verifica se a receita já existe
    existe = db.query(ReceitaSNGPC).filter(ReceitaSNGPC.numero_receita == receita.numero_receita).first()
    if existe:
        raise HTTPException(status_code=400, detail="Número de receita já registrado no sistema.")
    
    nova_receita = ReceitaSNGPC(**receita.dict())
    db.add(nova_receita)
    db.commit()
    db.refresh(nova_receita)
    return {"mensagem": "Receita registrada com sucesso. Liberado para dispensação.", "id": nova_receita.id}

class ItemVenda(BaseModel):
    produto_id: int
    quantidade: int

class VendaRequest(BaseModel):
    itens: List[ItemVenda]
    forma_pagamento: str  # "Dinheiro", "Pix", "Debito", "Credito", "Crediario"
    valor_total: float
    cliente_id: Optional[int] = None

@app.post("/pdv/venda/", tags=["PDV"])
def criar_venda_completa(
    venda_req: VendaRequest, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["caixa", "farmaceutico", "administrador"]))
):
    """
    Registra uma venda completa de caixa (Apenas operadores autorizados)
    """
    if not venda_req.itens:
        raise HTTPException(status_code=400, detail="A venda deve conter pelo menos um item.")

    # 1. Valida todos os itens e estoque antes de realizar qualquer alteração (Atomicidade)
    produtos_para_atualizar = []
    for item in venda_req.itens:
        produto = db.query(Produto).filter(Produto.id == item.produto_id).first()
        if not produto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Produto com ID {item.produto_id} não encontrado."
            )
        if produto.estoque_atual < item.quantidade:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Estoque insuficiente para o produto '{produto.nome}'. Disponível: {produto.estoque_atual}."
            )
        if produto.is_controlado:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"O produto '{produto.nome}' é controlado e deve ser vendido via SNGPC."
            )
        produtos_para_atualizar.append((produto, item.quantidade))

    # 2. Atualiza o estoque de cada produto
    for produto, quantidade in produtos_para_atualizar:
        produto.estoque_atual -= quantidade

    import random

    # 3. Registra a venda com dados fiscais e TEF simulados
    nsu_tef = None
    codigo_aut = None
    if venda_req.forma_pagamento in ["Debito", "Credito"]:
        nsu_tef = str(random.randint(10000000, 99999999))
        codigo_aut = str(random.randint(100000, 999999))

    chave_sat = "".join([str(random.randint(0, 9)) for _ in range(44)])
    num_extrato = str(random.randint(100000, 999999))

    # Fluxo específico se for Crediário
    if venda_req.forma_pagamento == "Crediario":
        if not venda_req.cliente_id:
            raise HTTPException(
                status_code=400,
                detail="O ID do cliente (cliente_id) é obrigatório para vendas via Crediário."
            )
        cliente = db.query(Cliente).filter(Cliente.id == venda_req.cliente_id).first()
        if not cliente:
            raise HTTPException(
                status_code=404,
                detail="Cliente selecionado para o crediário não foi localizado."
            )
        
        limite_disponivel = cliente.limite_credito - cliente.saldo_devedor
        if limite_disponivel < venda_req.valor_total:
            raise HTTPException(
                status_code=400,
                detail=f"Limite de crédito insuficiente! Limite disponível: R$ {limite_disponivel:.2f}."
            )
        
        # Atualiza o saldo devedor do cliente
        cliente.saldo_devedor += venda_req.valor_total
        
        # Cria a venda
        nova_venda = Venda(
            valor_total=venda_req.valor_total,
            forma_pagamento="Crediario",
            data_venda=datetime.utcnow(),
            chave_acesso_sat=chave_sat,
            numero_extrato_sat=num_extrato
        )
        db.add(nova_venda)
        db.commit()
        db.refresh(nova_venda)

        # Lança a parcela do crediário com vencimento em 30 dias por padrão
        vencimento = datetime.utcnow() + timedelta(days=30)
        lancamento = CrediarioLancamento(
            cliente_id=cliente.id,
            venda_id=nova_venda.id,
            valor=venda_req.valor_total,
            data_lancamento=datetime.utcnow(),
            data_vencimento=vencimento,
            status="Pendente"
        )
        db.add(lancamento)
        db.commit()
    else:
        # Venda padrão
        nova_venda = Venda(
            valor_total=venda_req.valor_total,
            forma_pagamento=venda_req.forma_pagamento,
            data_venda=datetime.utcnow(),
            nsu_tef=nsu_tef,
            codigo_autorizacao_tef=codigo_aut,
            chave_acesso_sat=chave_sat,
            numero_extrato_sat=num_extrato
        )
        db.add(nova_venda)
        db.commit()
        db.refresh(nova_venda)

    return {
        "mensagem": "Venda realizada com sucesso!",
        "venda_id": nova_venda.id,
        "valor_total": nova_venda.valor_total,
        "forma_pagamento": nova_venda.forma_pagamento,
        "nsu_tef": nova_venda.nsu_tef,
        "codigo_autorizacao_tef": nova_venda.codigo_autorizacao_tef,
        "chave_acesso_sat": nova_venda.chave_acesso_sat,
        "numero_extrato_sat": nova_venda.numero_extrato_sat
    }

@app.get("/financeiro/resumo/", tags=["Financeiro"])
def obter_resumo_financeiro(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["administrador"]))
):
    """
    Retorna métricas financeiras consolidadas (Apenas Administradores Gerais)
    """
    vendas = db.query(Venda).all()
    total_faturamento = sum(v.valor_total for v in vendas)
    total_cupons = len(vendas)
    ticket_medio = total_faturamento / total_cupons if total_cupons > 0 else 0.0
    
    # Detalhamento de faturamento por método de pagamento
    breakdown = {"Dinheiro": 0.0, "Pix": 0.0, "Debito": 0.0, "Credito": 0.0}
    for v in vendas:
        metodo = v.forma_pagamento
        if metodo == "Débito": metodo = "Debito"
        if metodo == "Crédito": metodo = "Credito"
        
        if metodo in breakdown:
            breakdown[metodo] += v.valor_total
        else:
            breakdown[metodo] = v.valor_total

    # Contagem de receitas controladas retidas
    total_receitas = db.query(ReceitaSNGPC).count()

    return {
        "faturamento_diario": round(total_faturamento, 2),
        "ticket_medio": round(ticket_medio, 2),
        "total_cupons": total_cupons,
        "vendas_sngpc": total_receitas,
        "formas_pagamento": {k: round(v, 2) for k, v in breakdown.items()}
    }

@app.post("/pdv/vender/", tags=["PDV"])
def realizar_venda(
    produto_id: int, 
    quantidade: int, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["caixa", "farmaceutico", "administrador"]))
):
    """Simula uma venda rápida de um item único (Mantido para compatibilidade, com proteção de acesso)"""
    produto = db.query(Produto).filter(Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    if produto.estoque_atual < quantidade:
        raise HTTPException(status_code=400, detail="Estoque insuficiente")
    
    if produto.is_controlado:
        raise HTTPException(
            status_code=403, 
            detail="Produto controlado! A venda deve ser feita pelo módulo de Dispensação SNGPC vinculando uma receita."
        )

    produto.estoque_atual -= quantidade
    
    nova_venda = Venda(valor_total=(produto.preco * quantidade), forma_pagamento="Dinheiro")
    db.add(nova_venda)
    db.commit()
    
    return {"mensagem": "Venda realizada com sucesso!", "novo_estoque": produto.estoque_atual}

# --- MODELOS E ENDPOINTS PARA IMPRESSÃO DE NOTAS FISCAIS & TEF SIMULADO ---

class CupomFiscalResponse(BaseModel):
    venda_id: int
    valor_total: float
    forma_pagamento: str
    data_venda: str
    nsu_tef: Optional[str] = None
    codigo_autorizacao_tef: Optional[str] = None
    chave_acesso_sat: str
    numero_extrato_sat: str
    layout_extrato: str
    xml_conteudo: str

@app.get("/pdv/imprimir-cupom/{venda_id}", response_model=CupomFiscalResponse, tags=["PDV"])
def imprimir_cupom_fiscal(
    venda_id: int, 
    db: Session = Depends(get_db), 
    current_user: Usuario = Depends(get_current_user)
):
    """
    Simulador de Impressão de Cupom Fiscal do SAT:
    Compila os dados de venda, monta o XML oficial simulado da SEFAZ,
    imprime no console do uvicorn (emulação da porta serial de hardware)
    e retorna o layout formatado para o display do simulador no frontend.
    """
    import random
    venda = db.query(Venda).filter(Venda.id == venda_id).first()
    if not venda:
        raise HTTPException(status_code=404, detail="Venda não encontrada.")
    
    # Monta a data no formato legível
    data_formatada = venda.data_venda.strftime("%d/%m/%Y %H:%M:%S")
    
    # Se os campos fiscais não estiverem povoados (ex: vendas antigas antes do update)
    # Se os campos fiscais não estiverem povoados (ex: vendas antigas antes do update)
    # nós os preenchemos dinamicamente agora
    if not venda.chave_acesso_sat:
        venda.chave_acesso_sat = "".join([str(random.randint(0, 9)) for _ in range(44)])
        venda.numero_extrato_sat = str(random.randint(100000, 999999))
        db.commit()

    # Simula a montagem do XML NFC-e oficial enviado e autorizado pela SEFAZ-AM (Modelo 65, Versão 4.00)
    xml_simulado = f"""<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe{venda.chave_acesso_sat}" versao="4.00">
      <ide>
        <cUF>13</cUF> <!-- 13 = Amazonas -->
        <cNF>{random.randint(10000000, 99999999)}</cNF>
        <natOp>Venda Mercadoria</natOp>
        <mod>65</mod> <!-- 65 = NFC-e -->
        <serie>1</serie>
        <nNF>{venda.numero_extrato_sat}</nNF>
        <dhEmi>{venda.data_venda.isoformat()}-04:00</dhEmi>
        <tpImp>4</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>9</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>PharmaSys_AM_v1.2.0</verProc>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <IE>111222333</IE>
        <xNome>PHARMASYS ENTERPRISE DROGARIA S.A.</xNome>
        <enderEmit>
          <xLgr>Avenida Djalma Batista</xLgr>
          <nro>1661</nro>
          <xBairro>Chapada</xBairro>
          <cMun>1302603</cMun> <!-- Manaus -->
          <xMun>Manaus</xMun>
          <UF>AM</UF>
        </enderEmit>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>MOCK_PROD</cProd>
          <cEAN>789123456004</cEAN>
          <xProd>VENDA SIMULADA NFC-e - SEFAZ AM</xProd>
          <NCM>30049019</NCM>
          <CFOP>5405</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>{venda.valor_total}</vUnCom>
          <vProd>{venda.valor_total}</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vProd>{venda.valor_total}</vProd>
          <vNF>{venda.valor_total}</vNF>
        </ICMSTot>
      </total>
      <pgto>
        <detPag>
          <tPag>{"01" if venda.forma_pagamento == "Dinheiro" else "17" if venda.forma_pagamento == "Pix" else "04" if venda.forma_pagamento == "Debito" else "03"}</detPag>
          <vPag>{venda.valor_total}</vPag>
        </detPag>
      </pgto>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>AM-SEFAZ-NFCe_v4.0.0</verAplic>
      <chNFe>{venda.chave_acesso_sat}</chNFe>
      <dhRecbto>{venda.data_venda.isoformat()}-04:00</dhRecbto>
      <nProt>31326{random.randint(100000, 999999)}</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NFC-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>"""

    # Layout ESC/POS formatado para simular o DANFE NFC-e da SEFAZ Amazonas
    layout = []
    layout.append("          PHARMASYS ENTERPRISE DRUGSTORE")
    layout.append("          AVANCO S.A. - CNPJ: 12.345.678/0001-90")
    layout.append("     Av. Djalma Batista, 1661 - Chapada - Manaus - AM")
    layout.append("==================================================")
    layout.append("     DANFE NFC-e - Documento Auxiliar da Nota")
    layout.append("       Fiscal de Consumidor Eletronica - AM")
    layout.append("     Não permite aproveitamento de credito de ICMS")
    layout.append("==================================================")
    layout.append(f" NFC-e Numero: {venda.numero_extrato_sat}  |  Serie: 001")
    layout.append(f" Data/Hora Emissao: {data_formatada}")
    layout.append(f" Protocolo Autorizacao: 31326{random.randint(100000, 999999)}")
    layout.append("--------------------------------------------------")
    layout.append(" # | COD | DESCRIÇÃO | QTD | UN | V.UNIT | V.TOTAL")
    layout.append("--------------------------------------------------")
    layout.append(f" 01 | 999 | ITENS DIVERSOS PDV | 1 | UN | {venda.valor_total:.2f} | {venda.valor_total:.2f}")
    layout.append("--------------------------------------------------")
    layout.append(f" TOTAL BRUTO:                          R$ {venda.valor_total:.2f}")
    layout.append(f" TOTAL LIQUIDO A PAGAR:                R$ {venda.valor_total:.2f}")
    layout.append("--------------------------------------------------")
    layout.append(f" Forma Pagamento: {venda.forma_pagamento}")
    
    if venda.nsu_tef:
        layout.append(f" >> TEF AUTORIZADO - REDE CARD")
        layout.append(f" >> NSU: {venda.nsu_tef} | AUT: {venda.codigo_autorizacao_tef}")
        
    layout.append("==================================================")
    layout.append("          DADOS DE HOMOLOGACAO SEFAZ AM")
    layout.append(" CHAVE DE ACESSO NFC-e:")
    c = venda.chave_acesso_sat
    layout.append(f" {c[:11]}-{c[11:22]}-{c[22:33]}-{c[33:]}")
    layout.append("")
    layout.append("             [ QR CODE SEFAZ AMAZONAS ]")
    layout.append("       http://sistemas.sefaz.am.gov.br/nfceweb/")
    layout.append(f"       consultarNFCe.jsp?chNFe={c}")
    layout.append("==================================================")
    layout.append("         OBRIGADO PELA PREFERENCIA!")
    layout.append("        SISTEMA DE ACORDO COM A SEFAZ-AM")
    layout.append("\n\n")

    # Simula a transmissão via porta COM serial no terminal
    print(f"\n[COM1 - IMPRESSORA TÉRMICA] ENVIANDO ESC/POS PARA IMPRESSORA FISCAL...")
    print("\n".join(layout))

    return {
        "venda_id": venda.id,
        "valor_total": venda.valor_total,
        "forma_pagamento": venda.forma_pagamento,
        "data_venda": data_formatada,
        "nsu_tef": venda.nsu_tef,
        "codigo_autorizacao_tef": venda.codigo_autorizacao_tef,
        "chave_acesso_sat": c,
        "numero_extrato_sat": venda.numero_extrato_sat,
        "layout_extrato": "\n".join(layout),
        "xml_conteudo": xml_simulado
    }

# --- ENDPOINTS DE CREDIÁRIO & CLIENTES ---

@app.get("/clientes/", response_model=List[ClienteResponse], tags=["Crediário"])
def listar_clientes(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    """Lista todos os clientes cadastrados no crediário"""
    return db.query(Cliente).order_by(Cliente.nome).all()

@app.post("/clientes/", response_model=ClienteResponse, tags=["Crediário"])
def cadastrar_cliente(
    cliente_req: ClienteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["caixa", "farmaceutico", "administrador"]))
):
    """Cadastra um novo cliente com limite de crédito profissional"""
    # Limpa CPF
    cpf_limpo = cliente_req.cpf.replace(".", "").replace("-", "").strip()
    
    existe = db.query(Cliente).filter(Cliente.cpf == cliente_req.cpf).first()
    if existe:
        raise HTTPException(status_code=400, detail="Já existe um cliente cadastrado com este CPF.")
        
    novo_cliente = Cliente(
        nome=cliente_req.nome,
        cpf=cliente_req.cpf,
        telefone=cliente_req.telefone,
        limite_credito=cliente_req.limite_credito,
        saldo_devedor=0.0
    )
    db.add(novo_cliente)
    db.commit()
    db.refresh(novo_cliente)
    return novo_cliente

@app.get("/crediario/lancamentos/", tags=["Crediário"])
def obter_todos_lancamentos(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    """Retorna todos os lançamentos do crediário com dados do cliente acoplados"""
    lancamentos = db.query(CrediarioLancamento).all()
    resultado = []
    for l in lancamentos:
        cliente = db.query(Cliente).filter(Cliente.id == l.cliente_id).first()
        resultado.append({
            "id": l.id,
            "cliente_name": cliente.nome if cliente else "Desconhecido",
            "cliente_cpf": cliente.cpf if cliente else "",
            "venda_id": l.venda_id,
            "valor": l.valor,
            "data_lancamento": l.data_lancamento.strftime("%d/%m/%Y"),
            "data_vencimento": l.data_vencimento.strftime("%d/%m/%Y"),
            "status": "Atrasado" if (l.status == "Pendente" and l.data_vencimento < datetime.utcnow()) else l.status
        })
    return resultado

@app.get("/crediario/cliente/{cliente_id}/", tags=["Crediário"])
def obter_extrato_cliente(cliente_id: int, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    """Retorna o extrato detalhado de dívidas de um cliente específico"""
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        
    lancamentos = db.query(CrediarioLancamento).filter(CrediarioLancamento.cliente_id == cliente_id).all()
    extrato = []
    for l in lancamentos:
        # Verifica se está vencido de forma dinâmica
        status_real = l.status
        if l.status == "Pendente" and l.data_vencimento < datetime.utcnow():
            status_real = "Atrasado"
            
        extrato.append({
            "id": l.id,
            "venda_id": l.venda_id,
            "valor": l.valor,
            "data_lancamento": l.data_lancamento.strftime("%d/%m/%Y"),
            "data_vencimento": l.data_vencimento.strftime("%d/%m/%Y"),
            "status": status_real
        })
    return {
        "cliente": {
            "id": cliente.id,
            "nome": cliente.nome,
            "cpf": cliente.cpf,
            "limite_credito": cliente.limite_credito,
            "saldo_devedor": cliente.saldo_devedor,
            "limite_disponivel": round(cliente.limite_credito - cliente.saldo_devedor, 2)
        },
        "lancamentos": extrato
    }

@app.post("/crediario/receber/{lancamento_id}/", tags=["Crediário"])
def receber_pagamento_crediario(
    lancamento_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_role(["caixa", "farmaceutico", "administrador"]))
):
    """Registra o recebimento de uma dívida no crediário, abatendo do saldo devedor do cliente e liberando limite"""
    lancamento = db.query(CrediarioLancamento).filter(CrediarioLancamento.id == lancamento_id).first()
    if not lancamento:
        raise HTTPException(status_code=404, detail="Lançamento do crediário não encontrado.")
        
    if lancamento.status == "Pago":
        raise HTTPException(status_code=400, detail="Este lançamento já foi pago anteriormente.")
        
    cliente = db.query(Cliente).filter(Cliente.id == lancamento.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente proprietário da dívida não encontrado.")
        
    # Abate do saldo devedor (assegurando que não fique negativo)
    cliente.saldo_devedor = max(0.0, cliente.saldo_devedor - lancamento.valor)
    
    # Altera status do lançamento
    lancamento.status = "Pago"
    
    db.commit()
    
    return {
        "mensagem": f"Pagamento de R$ {lancamento.valor:.2f} recebido com sucesso!",
        "novo_saldo_devedor": cliente.saldo_devedor,
        "limite_disponivel": cliente.limite_credito - cliente.saldo_devedor
    }