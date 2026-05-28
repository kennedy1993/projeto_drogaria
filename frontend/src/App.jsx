import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Pill, Users, FileText, Activity, ShieldAlert, 
  CheckCircle2, Search, Plus, Trash2, AlertCircle, DollarSign,
  TrendingUp, Package, Clock, CreditCard, QrCode, BarChart3
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function DrogariaApp() {
  const [activeTab, setActiveTab] = useState('pdv');
  const [produtos, setProdutos] = useState([]);
  const [notification, setNotification] = useState(null);
  
  // --- ESTADOS DO SISTEMA DE SEGURANÇA E SESSÃO ---
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Estados do PDV
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  // Estados do Checkout de Pagamento Profissional
  // Estados do Checkout de Pagamento Profissional
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro'); // 'Dinheiro', 'Pix', 'Debito', 'Credito'
  const [receivedAmount, setReceivedAmount] = useState(''); // Usado no pagamento em Dinheiro para calcular o troco
  const [pixStatus, setPixStatus] = useState('pending'); // 'pending', 'confirming', 'completed'
  const [cardStatus, setCardStatus] = useState('pending'); // 'pending', 'processing', 'completed'
  const [discountType, setDiscountType] = useState('percent'); // 'percent', 'fixed'
  const [discountValue, setDiscountValue] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastSaleDetails, setLastSaleDetails] = useState(null);

  // --- ESTADOS DO CREDIÁRIO PROFISSIONAL (COMPRAR FIADO) ---
  const [clientes, setClientes] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [crediarioLancamentos, setCrediarioLancamentos] = useState([]);
  const [selectedExtratoCliente, setSelectedExtratoCliente] = useState(null);
  const [isNewClienteModalOpen, setIsNewClienteModalOpen] = useState(false);
  const [newClienteForm, setNewClienteForm] = useState({ nome: '', cpf: '', telefone: '', limite_credito: 1000 });

  // Estado do Painel Financeiro Real
  const [financeStats, setFinanceStats] = useState({
    faturamento_diario: 0.0,
    ticket_medio: 0.0,
    total_cupons: 0,
    vendas_sngpc: 0,
    formas_pagamento: { Dinheiro: 0.0, Pix: 0.0, Debito: 0.0, Credito: 0.0 }
  });

  // Estados do SNGPC
  const [sngpcForm, setSngpcForm] = useState({
    numero_receita: '', tipo_receita: 'Notificação de Receita B (Azul)', crm_medico: '', uf_medico: '',
    nome_paciente: '', doc_paciente: '', data_prescricao: ''
  });

  // Estados do Estoque
  const [novoProduto, setNovoProduto] = useState({
    codigo_barras: '', nome: '', preco: '', estoque_atual: '', is_controlado: false
  });

  // --- MÉTODOS AUXILIARES DE AUTENTICAÇÃO ---

  const getHeaders = () => {
    const token = localStorage.getItem('token') || '';
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setCart([]);
    showNotification('Sessão encerrada com segurança!', 'success');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setLoginForm({ username: '', password: '' });
        showNotification(`Acesso autorizado! Bem-vindo, ${data.user.nome}.`, 'success');
        
        // Dispara fetch inicial agora que o token foi gravado
        fetchProdutosComToken(data.access_token);
      } else {
        setLoginError(data.detail || 'Usuário ou senha inválidos.');
      }
    } catch (err) {
      setLoginError('Falha ao se conectar ao servidor backend.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Carrega os dados reais do banco apenas se houver usuário autenticado
  useEffect(() => {
    if (currentUser) {
      fetchProdutos();
      if (currentUser.role === 'administrador') {
        fetchFinanceStats();
      }
      fetchClientes();
      fetchCrediario();
    }
  }, [currentUser]);

  // Sincroniza financeiro e crediário ao trocar de aba
  useEffect(() => {
    if (currentUser) {
      if (activeTab === 'financeiro') {
        fetchFinanceStats();
      } else if (activeTab === 'crediario') {
        fetchClientes();
        fetchCrediario();
      }
    }
  }, [activeTab, currentUser]);

  const fetchClientes = async () => {
    try {
      const response = await fetch(`${API_URL}/clientes/`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setClientes(data);
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const fetchCrediario = async () => {
    try {
      const response = await fetch(`${API_URL}/crediario/lancamentos/`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setCrediarioLancamentos(data);
      }
    } catch (error) {
      console.error('Erro ao carregar lançamentos do crediário:', error);
    }
  };

  const fetchExtratoCliente = async (clienteId) => {
    try {
      const response = await fetch(`${API_URL}/crediario/cliente/${clienteId}/`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedExtratoCliente(data);
      }
    } catch (error) {
      console.error('Erro ao obter extrato de cliente:', error);
    }
  };

  const pagarTituloCrediario = async (lancamentoId, clienteId) => {
    try {
      const response = await fetch(`${API_URL}/crediario/receber/${lancamentoId}/`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        showNotification(data.mensagem, 'success');
        fetchClientes();
        fetchCrediario();
        if (clienteId) {
          fetchExtratoCliente(clienteId);
        }
      } else {
        const err = await response.json();
        showNotification(err.detail || 'Falha ao receber pagamento.', 'error');
      }
    } catch (error) {
      showNotification('Falha ao comunicar com o servidor.', 'error');
    }
  };

  const cadastrarNovoCliente = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/clientes/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newClienteForm)
      });
      if (response.ok) {
        showNotification('Cliente cadastrado com crediário profissional ativo!', 'success');
        setNewClienteForm({ nome: '', cpf: '', telefone: '', limite_credito: 1000 });
        setIsNewClienteModalOpen(false);
        fetchClientes();
      } else {
        const err = await response.json();
        showNotification(err.detail || 'Falha ao cadastrar cliente.', 'error');
      }
    } catch (error) {
      showNotification('Falha ao comunicar com o servidor.', 'error');
    }
  };

  const fetchProdutos = async () => {
    try {
      const response = await fetch(`${API_URL}/produtos/`, {
        headers: getHeaders()
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setProdutos(data);
      }
    } catch (error) {
      showNotification('Falha ao comunicar com o servidor.', 'error');
    }
  };

  const fetchProdutosComToken = async (tempToken) => {
    try {
      const response = await fetch(`${API_URL}/produtos/`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProdutos(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFinanceStats = async () => {
    try {
      const response = await fetch(`${API_URL}/financeiro/resumo/`, {
        headers: getHeaders()
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setFinanceStats(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do painel financeiro:', error);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- LÓGICA DO PDV ---
  const addToCart = (produto) => {
    if (produto.is_controlado) {
      showNotification("PRODUTO CONTROLADO: A venda deve ser realizada pelo módulo SNGPC com retenção de receita.", "warning");
      return;
    }
    const noCarrinho = cart.filter(item => item.id === produto.id).length;
    if (produto.estoque_atual <= noCarrinho) {
      showNotification("Estoque insuficiente para este produto!", "error");
      return;
    }
    setCart([...cart, produto]);
  };

  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod('Dinheiro');
    setReceivedAmount('');
    setPixStatus('pending');
    setCardStatus('pending');
    setDiscountType('percent');
    setDiscountValue('');
    setIsCheckoutOpen(true);
  };

  const finalizarVenda = async (selectedMethod) => {
    if (cart.length === 0) return;
    setIsProcessingSale(true);

    // Agrupa itens duplicados no carrinho para reduzir a chamada de estoque
    const groupedItems = cart.reduce((acc, item) => {
      if (acc[item.id]) {
        acc[item.id].quantidade += 1;
      } else {
        acc[item.id] = { produto_id: item.id, quantidade: 1 };
      }
      return acc;
    }, {});

    const payload = {
      itens: Object.values(groupedItems),
      forma_pagamento: selectedMethod,
      valor_total: totalWithDiscount,
      ...(selectedMethod === 'Crediario' && { cliente_id: parseInt(selectedClienteId) })
    };

    try {
      const response = await fetch(`${API_URL}/pdv/venda/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (response.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        // Busca os dados fiscais de impressão gerados no backend
        try {
          const printResponse = await fetch(`${API_URL}/pdv/imprimir-cupom/${data.venda_id}`, {
            headers: getHeaders()
          });
          if (printResponse.ok) {
            const printData = await printResponse.json();
            setLastSaleDetails(printData);
          } else {
            setLastSaleDetails({
              venda_id: data.venda_id,
              valor_total: data.valor_total,
              forma_pagamento: data.forma_pagamento,
              nsu_tef: data.nsu_tef,
              codigo_autorizacao_tef: data.codigo_autorizacao_tef,
              chave_acesso_sat: data.chave_acesso_sat,
              numero_extrato_sat: data.numero_extrato_sat,
              layout_extrato: "Falha ao gerar layout de extrato fiscal no backend.",
              xml_conteudo: "<erro>Falha ao gerar XML fiscal</erro>"
            });
          }
        } catch (printErr) {
          console.error("Erro ao buscar dados de impressão fiscal:", printErr);
        }

        showNotification(`Venda finalizada via ${selectedMethod} com sucesso! Cupom emitido.`, 'success');
        setCart([]);
        setIsCheckoutOpen(false);
        setIsSuccessModalOpen(true); // Abre o simulador visual de impressora fiscal
        setSelectedClienteId(''); // Limpa seleção
        fetchProdutos();
        if (currentUser.role === 'administrador') {
          fetchFinanceStats(); // Sincroniza faturamento em tempo real
        }
        fetchClientes(); // Sincroniza saldos do crediário
        fetchCrediario(); // Sincroniza lançamentos
      } else {
        showNotification(data.detail || 'Erro ao processar a venda', 'error');
      }
    } catch (err) {
      showNotification('Erro de conexão com o servidor', 'error');
    } finally {
      setIsProcessingSale(false);
    }
  };

  // --- DOWNLOAD DO XML FISCAL DA SEFAZ MOCK ---
  const handleDownloadXML = () => {
    if (!lastSaleDetails) return;
    const element = document.createElement("a");
    const file = new Blob([lastSaleDetails.xml_conteudo], {type: 'text/xml'});
    element.href = URL.createObjectURL(file);
    element.download = `CFe_${lastSaleDetails.chave_acesso_sat}.xml`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showNotification("XML Fiscal da SEFAZ baixado com sucesso!");
  };

  // --- IMPRESSÃO ESC/POS SIMULADA & FÍSICA ---
  const handleSimulatePrint = () => {
    showNotification("Enviando comandos ESC/POS para a impressora... Impressão Concluída!", "success");
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>Cupom Fiscal SAT #${lastSaleDetails?.numero_extrato_sat}</title>
          <style>
            body { font-family: monospace; padding: 20px; white-space: pre-wrap; font-size: 14px; color: #1e293b; line-height: 1.5; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${lastSaleDetails?.layout_extrato}
        </body>
      </html>
    `);
    win.document.close();
  };

  // --- LÓGICA DO SNGPC ---
  const handleSngpcSubmit = async (e) => {
    e.preventDefault();
    if (!sngpcForm.data_prescricao) {
      showNotification('A data da prescrição é obrigatória', 'error');
      return;
    }
    try {
      const payload = { 
        ...sngpcForm, 
        data_prescricao: new Date(sngpcForm.data_prescricao).toISOString() 
      };
      const response = await fetch(`${API_URL}/sngpc/receitas/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (response.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        showNotification(data.mensagem || 'Receita registrada com sucesso! Dispensação liberada.');
        setSngpcForm({ numero_receita: '', tipo_receita: 'Notificação de Receita B (Azul)', crm_medico: '', uf_medico: '', nome_paciente: '', doc_paciente: '', data_prescricao: '' });
      } else {
        showNotification(data.detail || 'Erro ao registrar receita', 'error');
      }
    } catch (err) {
      showNotification('Erro de conexão com o servidor', 'error');
    }
  };

  // --- LÓGICA DE ESTOQUE ---
  const handleAddProduto = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        ...novoProduto, 
        preco: parseFloat(novoProduto.preco), 
        estoque_atual: parseInt(novoProduto.estoque_atual) 
      };
      const response = await fetch(`${API_URL}/produtos/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (response.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await response.json();
      if (response.ok) {
        showNotification('Produto cadastrado com sucesso!');
        setNovoProduto({ codigo_barras: '', nome: '', preco: '', estoque_atual: '', is_controlado: false });
        fetchProdutos();
      } else {
        showNotification(data.detail || 'Erro ao cadastrar produto', 'error');
      }
    } catch (err) {
      showNotification('Erro ao conectar com o servidor', 'error');
    }
  };

  // --- INTEGRAÇÃO COM TECLADO E LEITOR DE CÓDIGO DE BARRAS FÍSICO ---
  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const barcode = e.target.value.trim();
      if (!barcode) return;
      
      const targetProd = produtos.find(p => p.codigo_barras === barcode);
      if (targetProd) {
        addToCart(targetProd);
        e.target.value = '';
        showNotification(`Lançado via leitor: ${targetProd.nome}`, 'success');
      } else {
        showNotification('Código de barras não cadastrado!', 'error');
      }
    }
  };

  useEffect(() => {
    const handleGlobalHotkeys = (e) => {
      if (activeTab !== 'pdv') return;
      
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('barcode-scanner-input')?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleOpenCheckout();
        setTimeout(() => {
          const discountInput = document.getElementById('discount-value-input');
          if (discountInput) discountInput.focus();
        }, 150);
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (cart.length > 0) {
          handleOpenCheckout();
          setPaymentMethod('Dinheiro');
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (cart.length > 0) {
          setCart([]);
          showNotification('Carrinho cancelado e caixa limpo!', 'warning');
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalHotkeys);
    return () => window.removeEventListener('keydown', handleGlobalHotkeys);
  }, [activeTab, cart, produtos]);

  // Controles de bobina PDV unificados
  const handleIncrementQty = (item) => {
    addToCart(item);
  };

  const handleDecrementQty = (itemId) => {
    const idx = cart.findIndex(x => x.id === itemId);
    if (idx !== -1) {
      const newCart = [...cart];
      newCart.splice(idx, 1);
      setCart(newCart);
    }
  };

  const handleRemoveProduct = (itemId) => {
    setCart(cart.filter(x => x.id !== itemId));
    showNotification('Item removido do cupom.', 'warning');
  };

  const totalCart = cart.reduce((acc, item) => acc + item.preco, 0);
  const totalWithDiscount = (() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'percent') {
      return totalCart * (1 - val / 100);
    } else {
      return Math.max(0, totalCart - val);
    }
  })();

  const filteredProdutos = produtos.filter(p => 
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.codigo_barras.includes(searchQuery)
  );

  // Redireciona caso o perfil mude e o usuário esteja em uma aba restrita
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'caixa' && (activeTab === 'sngpc' || activeTab === 'financeiro')) {
        setActiveTab('pdv');
      } else if (currentUser.role === 'farmaceutico' && activeTab === 'financeiro') {
        setActiveTab('pdv');
      }
    }
  }, [activeTab, currentUser]);

  // SE NÃO ESTIVER AUTENTICADO: RENDERIZA A TELA DE LOGIN GLASSMORPHISM PROFISSIONAL
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 font-sans text-slate-100 px-4 relative overflow-hidden">
        {/* Efeitos de Fundo (Glow Rings) */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col items-center animate-fade-in relative z-10">
          <div className="bg-teal-500/15 p-4 rounded-2xl text-teal-400 mb-4 shadow-inner">
            <Pill size={32} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">PharmaSys Enterprise</h2>
          <p className="text-slate-400 text-xs mt-1 font-semibold">Acesso ao Painel Seguro de Vendas & SNGPC</p>

          {loginError && (
            <div className="mt-5 w-full bg-rose-500/10 border border-rose-500/25 p-3 rounded-xl flex items-center gap-3 text-rose-400 text-xs font-semibold">
              <AlertCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full mt-6 space-y-4">
            <div>
              <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Nome de Usuário</label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-slate-950/60 border border-slate-850 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 font-medium text-sm transition-all"
                placeholder="Ex: admin, farmaceutico, caixa"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Senha de Operador</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-slate-950/60 border border-slate-850 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 font-medium text-sm transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-gradient-to-r from-teal-500 to-indigo-500 hover:from-teal-400 hover:to-indigo-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] text-sm flex justify-center items-center gap-2 cursor-pointer mt-2"
            >
              {isLoggingIn ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : 'AUTENTICAR NO TERMINAL'}
            </button>
          </form>

          {/* Atalhos Rápidos para Demonstração e Testes */}
          <div className="w-full border-t border-slate-800/80 mt-6 pt-5">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center mb-3">Selecione um Perfil para Testar Rápido</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { role: 'Operador', user: 'caixa', pass: 'caixa123', color: 'hover:border-emerald-500/30 hover:bg-emerald-500/5 text-emerald-400 border-slate-800/50' },
                { role: 'Farmácia', user: 'farmaceutico', pass: 'farma123', color: 'hover:border-cyan-500/30 hover:bg-cyan-500/5 text-cyan-400 border-slate-800/50' },
                { role: 'Admin', user: 'admin', pass: 'admin123', color: 'hover:border-indigo-500/30 hover:bg-indigo-500/5 text-indigo-400 border-slate-800/50' }
              ].map((prof) => (
                <button
                  key={prof.role}
                  type="button"
                  onClick={() => setLoginForm({ username: prof.user, password: prof.pass })}
                  className={`border p-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer bg-slate-950/20 ${prof.color}`}
                >
                  {prof.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* Notificações (Toast) */}
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 text-white transition-all transform duration-300 ${
          notification.type === 'error' ? 'bg-rose-500' : 
          notification.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
        }`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-medium tracking-wide text-sm">{notification.message}</span>
        </div>
      )}

      {/* Sidebar de Navegação */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800 bg-slate-950/50">
          <div className="bg-gradient-to-tr from-emerald-400 to-teal-500 p-2 rounded-lg text-white shadow-lg shadow-teal-500/20">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Pharma<span className="text-teal-400">Sys</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Enterprise Edition</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {[
            { id: 'pdv', icon: ShoppingCart, label: 'Frente de Caixa (PDV)', roles: ['caixa', 'farmaceutico', 'administrador'] },
            { id: 'sngpc', icon: ShieldAlert, label: 'Receituário (SNGPC)', roles: ['farmaceutico', 'administrador'] },
            { id: 'estoque', icon: Pill, label: 'Estoque Geral', roles: ['caixa', 'farmaceutico', 'administrador'] },
            { id: 'clientes', icon: Users, label: 'Crediário & Convênios', roles: ['caixa', 'farmaceutico', 'administrador'] },
            { id: 'financeiro', icon: FileText, label: 'Gestão Financeira', roles: ['administrador'] },
          ].filter(item => item.roles.includes(currentUser?.role)).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium text-sm cursor-pointer ${
                activeTab === item.id 
                  ? 'bg-teal-500 text-white shadow-md shadow-teal-500/20 translate-x-1' 
                  : 'hover:bg-slate-800 hover:text-white hover:translate-x-1'
              }`}
            >
              <item.icon size={18} className={activeTab === item.id ? "text-white" : "text-slate-400"} /> 
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-5 border-t border-slate-800 bg-slate-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-teal-400 font-extrabold uppercase shadow-inner">
                {currentUser?.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="text-xs">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-[8px]">
                  {currentUser?.role === 'administrador' ? 'ADMINISTRADOR' : 
                   currentUser?.role === 'farmaceutico' ? 'FARMACÊUTICO' : 'OPERADOR'}
                </p>
                <p className="text-white font-semibold text-sm truncate max-w-[120px]">{currentUser?.nome}</p>
              </div>
            </div>
            
            {/* Logout Trigger */}
            <button 
              onClick={handleLogout}
              title="Encerrar Sessão Segura"
              className="text-slate-500 hover:text-rose-400 p-2 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFC]">
        {/* Header Superior */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              {activeTab === 'pdv' && 'Terminal de Vendas'}
              {activeTab === 'sngpc' && 'Central SNGPC'}
              {activeTab === 'estoque' && 'Controle de Inventário'}
              {activeTab === 'clientes' && 'Gestão de Clientes'}
              {activeTab === 'financeiro' && 'Painel Financeiro'}
            </h2>
            <p className="text-sm text-slate-500 font-medium">Data base: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistema Online
            </div>
          </div>
        </header>

        {/* Área Dinâmica */}
        <div className="flex-1 overflow-auto p-8 relative">
          
          {/* TELA: PDV */}
          {/* TELA: PDV (FRENTE DE CAIXA ENTERPRISE) */}
          {activeTab === 'pdv' && (() => {
            // Agrupa itens do carrinho em tempo real para exibir quantidades unificadas
            const aggregatedCart = cart.reduce((acc, item) => {
              const existing = acc.find(x => x.id === item.id);
              if (existing) {
                existing.quantity += 1;
              } else {
                acc.push({ ...item, quantity: 1 });
              }
              return acc;
            }, []);

            const estimatedTaxes = totalCart * 0.1345; // IBPT 13.45% de tributação simplificada

            return (
              <div className="grid grid-cols-12 gap-6 h-full min-h-[78vh] content-start">
                
                {/* Barra de Status Superior do Operador */}
                <div className="col-span-12 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap justify-between items-center text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-teal-400 via-indigo-500 to-emerald-400"></div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"></span>
                      <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">CAIXA ABERTO</span>
                    </div>
                    <span className="text-slate-700">|</span>
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span className="text-slate-500">Operador:</span>
                      <span className="text-white bg-slate-850 px-2.5 py-0.5 rounded-md font-mono text-[11px] border border-slate-800">{currentUser?.nome}</span>
                    </div>
                    <span className="text-slate-700">|</span>
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span className="text-slate-500">Terminal:</span>
                      <span className="text-teal-400 font-bold font-mono">PDV-01</span>
                    </div>
                  </div>
                  
                  {/* Hardware Peripheral Indicators */}
                  <div className="flex items-center gap-5 text-[10px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      🖨️ SAT: <span className="text-white font-mono">COM1</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      💳 TEF: <span className="text-white font-mono">COM2</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      🔌 SCANNER: <span className="text-white font-mono">ATIVO</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      ☁️ SEFAZ: <span className="text-emerald-400">ONLINE</span>
                    </div>
                    <span className="text-slate-700 text-xs">|</span>
                    <div className="text-slate-300 font-mono flex items-center gap-1.5 text-xs">
                      <Clock size={14} className="text-teal-400" />
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Bloco Esquerdo: Input de Leitor de Barras & Grid de Produtos */}
                <div className="col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden max-h-[72vh]">
                  
                  {/* Zona de Inputs: Scanner Laser + Busca Tradicional */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-12 gap-4">
                    
                    {/* Input Foco Leitor de Código (Simulação de Hardware Laser) */}
                    <div className="md:col-span-4 relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                      </div>
                      <input
                        id="barcode-scanner-input"
                        type="text"
                        onKeyDown={handleBarcodeKeyDown}
                        placeholder="[F2] Bipador Laser..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-900 text-teal-400 placeholder-teal-650 border border-teal-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent font-mono text-sm font-black tracking-widest shadow-inner shadow-teal-950/20"
                      />
                    </div>

                    {/* Busca Convencional de Produtos */}
                    <div className="md:col-span-8 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar medicamento por nome ou princípio ativo..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-350 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all shadow-sm text-sm text-slate-800 font-medium"
                      />
                    </div>
                  </div>
                  
                  {/* Grid de Consulta de Medicamentos */}
                  <div className="p-5 flex-1 overflow-auto bg-slate-50/20">
                    {produtos.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                        <Package size={48} className="opacity-25" />
                        <p className="font-semibold text-sm">Nenhum produto cadastrado no catálogo.</p>
                        <button onClick={() => setActiveTab('estoque')} className="text-teal-600 font-bold hover:underline text-xs">Acessar Painel de Estoque</button>
                      </div>
                    ) : filteredProdutos.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-10">
                        <Search size={36} className="opacity-20" />
                        <p className="font-bold text-sm">Nenhum produto corresponde à busca.</p>
                        <p className="text-xs text-slate-500">Tente buscar por outro termo ou limpe o campo.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProdutos.map(prod => {
                          const qtyInCart = cart.filter(x => x.id === prod.id).length;
                          const stockRemaining = prod.estoque_atual - qtyInCart;
                          
                          return (
                            <div 
                              key={prod.id} 
                              onClick={() => addToCart(prod)}
                              className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-500/5 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between h-40 border-b-4 border-b-slate-100 hover:border-b-teal-400"
                            >
                              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-50 to-transparent rounded-bl-full opacity-60 group-hover:from-teal-50/50 transition-all"></div>
                              
                              <div>
                                <div className="flex justify-between items-start gap-1">
                                  <h3 className="font-bold text-slate-800 text-xs leading-snug group-hover:text-teal-700 transition-colors truncate max-w-[140px]" title={prod.nome}>{prod.nome}</h3>
                                  {prod.is_controlado ? (
                                    <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase scale-90">Portaria 344</span>
                                  ) : (
                                    <span className="bg-emerald-100 border border-emerald-200 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase scale-90">Livre</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1 font-mono">{prod.codigo_barras}</p>
                              </div>
                              
                              <div className="mt-3">
                                {/* Barra de progresso de estoque intuitiva */}
                                <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
                                  <span className="font-semibold">Qtd Disp:</span>
                                  <span className={`font-bold font-mono ${stockRemaining <= 5 ? 'text-rose-500' : 'text-slate-700'}`}>
                                    {stockRemaining} un
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      stockRemaining <= 3 ? 'bg-rose-500' : stockRemaining <= 10 ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, (stockRemaining / Math.max(1, prod.estoque_atual)) * 100)}%` }}
                                  ></div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                                <span className="text-sm font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg">R$ {prod.preco.toFixed(2)}</span>
                                <div className="bg-slate-100 group-hover:bg-teal-500 text-slate-500 group-hover:text-white p-1 rounded-lg transition-colors">
                                  <Plus size={14} strokeWidth={3} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloco Direito: A Bobina Digital do Cupom (Receipt Box) */}
                <div className="col-span-4 bg-slate-900 rounded-2xl shadow-2xl flex flex-col text-white overflow-hidden border border-slate-800 max-h-[72vh] relative">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-400 via-indigo-500 to-emerald-400"></div>
                  
                  {/* Cabeçalho do Cupom */}
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={18} className="text-teal-400 animate-pulse" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Bobina de Vendas</h3>
                    </div>
                    <span className="bg-slate-800 text-[10px] font-black px-2.5 py-1 rounded-full text-slate-300 border border-slate-700">
                      {cart.length} ITENS LANÇADOS
                    </span>
                  </div>
                  
                  {/* Lista de Itens Lancados na Bobina */}
                  <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-900/40 scrollbar-thin select-none">
                    {aggregatedCart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60 py-20 space-y-3">
                        <ShoppingCart size={40} className="stroke-[1.5]" />
                        <p className="text-xs font-semibold uppercase tracking-wider">Aguardando Produtos...</p>
                        <p className="text-[10px] text-slate-600 max-w-[160px] text-center leading-relaxed">Bipe códigos de barra ou clique nos medicamentos para iniciar.</p>
                      </div>
                    ) : (
                      aggregatedCart.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className="bg-slate-950/40 border border-slate-850 rounded-xl p-3.5 space-y-2 hover:border-slate-750 transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div className="max-w-[70%]">
                              <p className="text-xs font-bold text-slate-200 truncate" title={item.nome}>{item.nome}</p>
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5">{item.codigo_barras}</p>
                            </div>
                            <span className="text-xs font-black text-teal-400 font-mono">
                              R$ {(item.preco * item.quantity).toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-900 text-xs">
                            <span className="text-slate-500 text-[10px] font-medium font-mono">
                              {item.quantity}x de R$ {item.preco.toFixed(2)}
                            </span>
                            
                            {/* Controles de Quantidade Rápidos */}
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => handleDecrementQty(item.id)}
                                className="w-5 h-5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded flex items-center justify-center transition-colors cursor-pointer"
                                title="Remover uma unidade"
                              >
                                -
                              </button>
                              <span className="w-5 text-center font-bold text-[11px] text-white font-mono bg-slate-950/60 rounded px-1">{item.quantity}</span>
                              <button 
                                onClick={() => handleIncrementQty(item)}
                                className="w-5 h-5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded flex items-center justify-center transition-colors cursor-pointer"
                                title="Adicionar uma unidade"
                              >
                                +
                              </button>
                              <button 
                                onClick={() => handleRemoveProduct(item.id)}
                                className="ml-1 text-slate-500 hover:text-rose-400 p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                title="Excluir item da nota"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Totais do Cupom / Fechamento */}
                  <div className="p-5 bg-slate-950 border-t border-slate-850 space-y-4">
                    
                    {/* Demonstrativo Fiscal IBPT */}
                    <div className="space-y-1.5 text-xs text-slate-400 border-b border-slate-900 pb-3 font-mono">
                      <div className="flex justify-between">
                        <span>Subtotal Bruto</span>
                        <span className="text-slate-200">R$ {totalCart.toFixed(2)}</span>
                      </div>
                      
                      {parseFloat(discountValue) > 0 && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Descontos</span>
                          <span>- R$ {(totalCart - totalWithDiscount).toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                        <span>Tributos Aprox. (IBPT 13.45%)</span>
                        <span>R$ {estimatedTaxes.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">Total Líquido a Pagar</span>
                      <div className="bg-slate-900/60 border border-emerald-500/20 text-emerald-400 text-3xl font-black rounded-2xl p-3.5 shadow-inner text-center font-mono animate-pulse tracking-tight flex items-center justify-center gap-1.5">
                        <span className="text-lg text-emerald-500/60 font-bold">R$</span>
                        {totalWithDiscount.toFixed(2)}
                      </div>
                    </div>

                    <button 
                      onClick={handleOpenCheckout}
                      disabled={cart.length === 0 || isProcessingSale}
                      className={`w-full font-bold py-4 rounded-2xl transition-all text-sm uppercase tracking-wider flex justify-center items-center gap-2.5 cursor-pointer shadow-lg ${
                        cart.length === 0 || isProcessingSale
                          ? 'bg-slate-800 text-slate-600 border border-slate-850 cursor-not-allowed'
                          : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-teal-500/20 active:scale-[0.98]'
                      }`}
                    >
                      <CreditCard size={16} strokeWidth={2.5} />
                      [F5] Concluir Pagamento
                    </button>
                  </div>
                </div>

                {/* Barra de Atalhos Físicos do Teclado (col-span-12) */}
                <div className="col-span-12 bg-slate-900 border border-slate-800 rounded-2xl p-3 flex justify-around text-slate-400 text-[10px] font-bold uppercase tracking-wider select-none shadow-md">
                  <div className="flex items-center gap-1.5"><span className="bg-slate-850 text-teal-400 px-2.5 py-1 rounded-md font-mono border border-slate-800 text-[10px]">F2</span> Bipar Item</div>
                  <div className="flex items-center gap-1.5"><span className="bg-slate-850 text-teal-400 px-2.5 py-1 rounded-md font-mono border border-slate-800 text-[10px]">F3</span> Aplicar Desconto</div>
                  <div className="flex items-center gap-1.5"><span className="bg-slate-850 text-teal-400 px-2.5 py-1 rounded-md font-mono border border-slate-800 text-[10px]">F5</span> Fechar Dinheiro</div>
                  <div className="flex items-center gap-1.5"><span className="bg-slate-850 text-rose-400 px-2.5 py-1 rounded-md font-mono border border-slate-800 text-[10px]">ESC</span> Cancelar Cupom</div>
                </div>

              </div>
            );
          })()}

          {/* TELA: SNGPC */}
          {activeTab === 'sngpc' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6 flex gap-5 items-center rounded-2xl shadow-sm">
                <div className="bg-amber-100 p-3 rounded-full text-amber-600 shadow-inner">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h3 className="text-amber-900 font-bold text-lg">Módulo de Retenção de Receitas</h3>
                  <p className="text-amber-700 text-sm mt-1 leading-relaxed">Este formulário atende às normativas da ANVISA. O preenchimento incorreto pode gerar pendências no envio do arquivo XML. Confirme os dados antes de salvar.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50">
                  <h4 className="font-semibold text-slate-700 flex items-center gap-2"><FileText size={18} className="text-slate-400" /> Nova Prescrição Controlada</h4>
                </div>
                <form onSubmit={handleSngpcSubmit} className="p-8 space-y-8">
                  {/* Bloco 1: A Receita */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Tipo de Receituário</label>
                      <select 
                        required
                        value={sngpcForm.tipo_receita}
                        onChange={(e) => setSngpcForm({...sngpcForm, tipo_receita: e.target.value})}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-700 font-medium transition-shadow"
                      >
                        <option value="Receita de Controle Especial (Branca)">Controle Especial (Branca - 2 Vias)</option>
                        <option value="Notificação de Receita B (Azul)">Notificação B (Azul)</option>
                        <option value="Notificação de Receita A (Amarela)">Notificação A (Amarela)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Numeração da Via</label>
                      <input 
                        required
                        type="text" 
                        value={sngpcForm.numero_receita}
                        onChange={(e) => setSngpcForm({...sngpcForm, numero_receita: e.target.value})}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-slate-700 transition-shadow" 
                        placeholder="Ex: 12345678" 
                      />
                    </div>
                  </div>

                  {/* Bloco 2: O Médico */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nome do Prescritor</label>
                        <input 
                          required
                          type="text" 
                          value={sngpcForm.nome_medico}
                          onChange={(e) => setSngpcForm({...sngpcForm, nome_medico: e.target.value})}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-700 transition-shadow" 
                          placeholder="Dr(a). Nome Sobrenome"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">CRM</label>
                        <input 
                          required
                          type="text" 
                          value={sngpcForm.crm_medico}
                          onChange={(e) => setSngpcForm({...sngpcForm, crm_medico: e.target.value})}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-700 transition-shadow" 
                          placeholder="000000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">UF</label>
                        <select 
                          required
                          value={sngpcForm.uf_medico}
                          onChange={(e) => setSngpcForm({...sngpcForm, uf_medico: e.target.value})}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-700 transition-shadow"
                        >
                          <option value="">--</option>
                          <option value="AM">AM</option>
                          <option value="SP">SP</option>
                          <option value="RJ">RJ</option>
                          <option value="MG">MG</option>
                          {/* Adicionar demais estados depois */}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: O Paciente */}
                  <div className="pt-6 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Data da Consulta</label>
                        <input 
                          required
                          type="date" 
                          value={sngpcForm.data_prescricao}
                          onChange={(e) => setSngpcForm({...sngpcForm, data_prescricao: e.target.value})}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-700 transition-shadow" 
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Paciente / Comprador</label>
                        <input 
                          required
                          type="text" 
                          value={sngpcForm.nome_paciente}
                          onChange={(e) => setSngpcForm({...sngpcForm, nome_paciente: e.target.value})}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-700 transition-shadow" 
                          placeholder="Nome Completo"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Doc. Identidade (RG/CPF)</label>
                        <input 
                          required
                          type="text" 
                          value={sngpcForm.doc_paciente}
                          onChange={(e) => setSngpcForm({...sngpcForm, doc_paciente: e.target.value})}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-700 transition-shadow" 
                          placeholder="Apenas números"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100 flex justify-end gap-4">
                    <button type="button" onClick={() => setActiveTab('pdv')} className="px-6 py-3 border border-slate-300 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                      Cancelar e Voltar
                    </button>
                    <button type="submit" className="px-8 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-500/30 flex items-center gap-2">
                      <CheckCircle2 size={20} /> Autenticar Receita
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TELA: ESTOQUE GERAL */}
          {activeTab === 'estoque' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              <div className="xl:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Plus size={20} className="text-teal-500"/> Cadastrar Novo Produto</h3>
                  
                  <form onSubmit={handleAddProduto} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Código de Barras</label>
                      <input required value={novoProduto.codigo_barras} onChange={e => setNovoProduto({...novoProduto, codigo_barras: e.target.value})} type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" placeholder="EAN13" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nome / Descrição</label>
                      <input required value={novoProduto.nome} onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})} type="text" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" placeholder="Ex: Paracetamol 750mg" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Preço (R$)</label>
                        <input required value={novoProduto.preco} onChange={e => setNovoProduto({...novoProduto, preco: e.target.value})} type="number" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Qtd. Inicial</label>
                        <input required value={novoProduto.estoque_atual} onChange={e => setNovoProduto({...novoProduto, estoque_atual: e.target.value})} type="number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" placeholder="0" />
                      </div>
                    </div>
                    <div className="pt-2">
                      <label className="flex items-center gap-3 p-3 border border-amber-200 bg-amber-50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={novoProduto.is_controlado} onChange={e => setNovoProduto({...novoProduto, is_controlado: e.target.checked})} className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500" />
                        <span className="text-sm font-bold text-amber-800">Medicamento Controlado (SNGPC)</span>
                      </label>
                    </div>
                    <button type="submit" className="w-full mt-4 py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors">
                      Salvar Produto
                    </button>
                  </form>
                </div>
              </div>

              <div className="xl:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Catálogo de Produtos</h3>
                    <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{produtos.length} cadastrados</span>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <th className="p-4 font-bold">Produto</th>
                          <th className="p-4 font-bold">Código</th>
                          <th className="p-4 font-bold">Preço</th>
                          <th className="p-4 font-bold">Estoque</th>
                          <th className="p-4 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {produtos.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-semibold text-slate-700">{p.nome}</td>
                            <td className="p-4 font-mono text-slate-500">{p.codigo_barras}</td>
                            <td className="p-4 text-teal-600 font-bold">R$ {p.preco.toFixed(2)}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${p.estoque_atual < 10 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {p.estoque_atual} un
                              </span>
                            </td>
                            <td className="p-4">
                              {p.is_controlado ? 
                                <span className="flex items-center gap-1 text-xs font-bold text-amber-600"><ShieldAlert size={14}/> SNGPC</span> : 
                                <span className="text-xs font-bold text-slate-400">Livre</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TELA: CREDIÁRIO & CONVÊNIOS PROFISSIONAL */}
          {activeTab === 'clientes' && (
            <div className="space-y-8 animate-fade-in text-slate-800">
              {/* Header do Módulo */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Users className="text-teal-500" /> Painel de Crediário & Contas a Receber
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Gerencie limites de crédito, compras parceladas (fiado) e controle recebimentos em Manaus.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewClienteModalOpen(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-md shadow-teal-500/20 flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Plus size={16} /> Cadastrar Novo Cliente
                </button>
              </div>

              {/* Analytical Cards */}
              {(() => {
                const totalReceber = clientes.reduce((acc, c) => acc + c.saldo_devedor, 0);
                const clientesDevedores = clientes.filter(c => c.saldo_devedor > 0).length;
                const totalAtrasados = crediarioLancamentos.filter(l => l.status === 'Atrasado').length;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4 shadow-sm">
                      <div className="p-3.5 rounded-xl bg-amber-55 text-amber-500 bg-amber-500/10 border border-amber-500/20">
                        <DollarSign size={22} />
                      </div>
                      <div>
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total a Receber</h4>
                        <p className="text-2xl font-black text-slate-800 mt-1">R$ {totalReceber.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Saldo pendente nos carnês</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4 shadow-sm">
                      <div className="p-3.5 rounded-xl bg-teal-55 text-teal-500 bg-teal-500/10 border border-teal-500/20">
                        <Users size={22} />
                      </div>
                      <div>
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Clientes Devedores</h4>
                        <p className="text-2xl font-black text-slate-800 mt-1">{clientesDevedores} clientes</p>
                        <p className="text-xs text-slate-500 mt-0.5">Com saldo devedor ativo</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4 shadow-sm">
                      <div className="p-3.5 rounded-xl bg-rose-55 text-rose-500 bg-rose-500/10 border border-rose-500/20">
                        <AlertCircle size={22} className={totalAtrasados > 0 ? "animate-pulse text-rose-500" : "text-rose-400"} />
                      </div>
                      <div>
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Títulos Atrasados</h4>
                        <p className="text-2xl font-black text-slate-800 mt-1">{totalAtrasados} parcelas</p>
                        <p className="text-xs text-slate-500 mt-0.5">Aguardando regularização</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tabela de Linhas de Crédito de Clientes */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-base">Fichas de Crédito Ativas</h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    {clientes.length} Clientes
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="p-4">Cliente</th>
                        <th className="p-4">CPF / Contato</th>
                        <th className="p-4">Limite Consumido</th>
                        <th className="p-4">Disponível / Total</th>
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {clientes.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-slate-400 font-medium italic">
                            Nenhum cliente cadastrado no crediário.
                          </td>
                        </tr>
                      ) : (
                        clientes.map(c => {
                          const limiteDisponivel = c.limite_credito - c.saldo_devedor;
                          const percentUsage = c.limite_credito > 0 ? (c.saldo_devedor / c.limite_credito) * 100 : 0;
                          
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-4">
                                <p className="font-bold text-slate-700">{c.nome}</p>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">
                                  CONVÊNIO ATIVO
                                </span>
                              </td>
                              <td className="p-4">
                                <p className="font-mono font-semibold text-slate-600 text-xs">{c.cpf}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{c.telefone || 'Sem telefone'}</p>
                              </td>
                              <td className="p-4">
                                <div className="space-y-1.5 max-w-[150px]">
                                  <div className="flex justify-between items-center text-[11px] font-bold">
                                    <span className="text-rose-500 font-mono">R$ {c.saldo_devedor.toFixed(2)}</span>
                                    <span className="text-slate-400 font-mono">{percentUsage.toFixed(0)}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        percentUsage > 80 ? 'bg-rose-500' :
                                        percentUsage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${Math.min(100, percentUsage)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 font-semibold text-xs">
                                <p className="text-emerald-600 font-bold font-mono">R$ {limiteDisponivel.toFixed(2)}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">de R$ {c.limite_credito.toFixed(2)}</p>
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => fetchExtratoCliente(c.id)}
                                  className="px-4 py-2 border border-teal-500/30 bg-teal-500/5 hover:bg-teal-500 hover:text-slate-950 hover:border-teal-500 text-teal-600 font-bold rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1.5 mx-auto shadow-sm"
                                >
                                  <FileText size={14} /> Ver Contas / Receber
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TELA: FINANCEIRO (DINÂMICO E PROFISSIONAL) */}
          {activeTab === 'financeiro' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { 
                    title: "Faturamento Acumulado", 
                    value: `R$ ${financeStats.faturamento_diario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
                    desc: "Vendas totais registradas", 
                    icon: DollarSign, 
                    color: "text-emerald-600 bg-emerald-50 border border-emerald-100 shadow-emerald-100/50"
                  },
                  { 
                    title: "Ticket Médio", 
                    value: `R$ ${financeStats.ticket_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
                    desc: `Média de ${financeStats.total_cupons} cupons emitidos`, 
                    icon: TrendingUp, 
                    color: "text-sky-600 bg-sky-50 border border-sky-100 shadow-sky-100/50"
                  },
                  { 
                    title: "Total de Cupons", 
                    value: financeStats.total_cupons, 
                    desc: "Transações finalizadas no PDV", 
                    icon: ShoppingCart, 
                    color: "text-purple-600 bg-purple-50 border border-purple-100 shadow-purple-100/50"
                  },
                  { 
                    title: "Receitas SNGPC", 
                    value: financeStats.vendas_sngpc, 
                    desc: "Receitas controladas retidas", 
                    icon: ShieldAlert, 
                    color: "text-amber-600 bg-amber-50 border border-amber-100 shadow-amber-100/50"
                  }
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
                    <div className={`p-3.5 rounded-xl ${stat.color} shadow-sm`}>
                      <stat.icon size={22} />
                    </div>
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.title}</h4>
                      <p className="text-2xl font-black text-slate-800 mt-1">{stat.value}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">{stat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Distribuição por Forma de Pagamento */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 size={20} className="text-slate-400" /> Distribuição das Vendas por Método
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Análise percentual de participação de cada canal de pagamento</p>
                  </div>
                  
                  <div className="mt-8 space-y-6 flex-1 justify-center flex flex-col">
                    {[
                      { id: "Dinheiro", label: "Dinheiro (Espécie)", color: "bg-emerald-500", icon: DollarSign, text: "text-emerald-600" },
                      { id: "Pix", label: "Pix (Instantâneo)", color: "bg-cyan-500", icon: Activity, text: "text-cyan-600" },
                      { id: "Debito", label: "Cartão de Débito", color: "bg-blue-500", icon: CreditCard, text: "text-blue-600" },
                      { id: "Credito", label: "Cartão de Crédito", color: "bg-purple-500", icon: TrendingUp, text: "text-purple-600" }
                    ].map((method) => {
                      const amount = financeStats.formas_pagamento[method.id] || 0.0;
                      const percentage = financeStats.faturamento_diario > 0 
                        ? (amount / financeStats.faturamento_diario) * 100 
                        : 0;
                      return (
                        <div key={method.id} className="space-y-2">
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span className="text-slate-600 flex items-center gap-2">
                              <method.icon size={16} className="text-slate-400" />
                              {method.label}
                            </span>
                            <span className="text-slate-800">
                              R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className={`text-xs ml-2 font-mono ${method.text}`}>({percentage.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${method.color} rounded-full transition-all duration-1000`} 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo Operacional */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Clock size={20} className="text-slate-400" /> Status do Caixa
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Indicadores operacionais de vendas do turno atual</p>
                  </div>

                  <div className="mt-6 space-y-4 flex-1 flex flex-col justify-center">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Operador Atual</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">João Silva (CRF/AM)</p>
                      </div>
                      <span className="bg-teal-500/10 text-teal-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">Turno Aberto</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Módulo TEF (Cartões)</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">Terminal Integrado</p>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">Conectado</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Módulo Pix API</p>
                        <p className="text-sm font-bold text-slate-800 mt-0.5">Simulação ativa</p>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">Pronto</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 mt-6">
                    <button 
                      onClick={() => {
                        showNotification("Caixa do turno fechado com sucesso! Relatório gerado.", "success");
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-3.5 rounded-xl transition-all text-sm flex justify-center items-center gap-2 cursor-pointer"
                    >
                      EFETUAR FECHAMENTO DE CAIXA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL DE PAGAMENTO (CHECKOUT PROFISSIONAL) */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 transition-all">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header do Modal */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-teal-500/10 p-2.5 rounded-xl text-teal-400">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Fechar Caixa / Pagamento</h3>
                  <p className="text-xs text-slate-400 font-medium">Selecione o método de pagamento para concluir a venda</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Resumo de Valores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Original</p>
                    <p className="text-slate-500 text-xs mt-0.5">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>
                  </div>
                  <span className="text-xl font-bold text-slate-400 line-through font-mono">
                    R$ {totalCart.toFixed(2)}
                  </span>
                </div>

                <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/30 rounded-2xl p-5 flex justify-between items-center">
                  <div>
                    <p className="text-teal-400 text-[10px] font-bold uppercase tracking-wider">Total a Pagar</p>
                    <p className="text-emerald-500 text-xs mt-0.5 font-semibold">Com Desconto</p>
                  </div>
                  <span className="text-2xl font-black text-teal-400 font-mono">
                    R$ {totalWithDiscount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Opção de Desconto Profissional */}
              <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      🏷️ Conceder Abatimento
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">Selecione o tipo de desconto e insira o valor correspondente</p>
                  </div>
                  <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => { setDiscountType('percent'); setDiscountValue(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        discountType === 'percent' 
                          ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/10' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Porcentagem (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDiscountType('fixed'); setDiscountValue(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        discountType === 'fixed' 
                          ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/10' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm font-mono">
                    {discountType === 'percent' ? '%' : 'R$'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? '100' : undefined}
                    step="any"
                    value={discountValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (discountType === 'percent' && parseFloat(val) > 100) return;
                      setDiscountValue(val);
                    }}
                    placeholder="Digite o desconto..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white font-bold focus:outline-none focus:border-teal-500 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Seletor de Métodos de Pagamento */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Forma de Pagamento</label>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { id: 'Dinheiro', label: 'Dinheiro', icon: DollarSign, color: 'hover:border-emerald-500/50 hover:bg-emerald-500/5' },
                    { id: 'Pix', label: 'Pix', icon: QrCode, color: 'hover:border-cyan-500/50 hover:bg-cyan-500/5' },
                    { id: 'Debito', label: 'Débito', icon: CreditCard, color: 'hover:border-blue-500/50 hover:bg-blue-500/5' },
                    { id: 'Credito', label: 'Crédito', icon: TrendingUp, color: 'hover:border-purple-500/50 hover:bg-purple-500/5' },
                    { id: 'Crediario', label: 'Crediário', icon: Users, color: 'hover:border-amber-500/50 hover:bg-amber-500/5' }
                  ].map((method) => {
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method.id);
                          setReceivedAmount('');
                          setPixStatus('pending');
                          setCardStatus('pending');
                        }}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-sm font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-teal-500 bg-teal-500/10 text-teal-400 shadow-lg shadow-teal-500/5'
                            : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:text-white ' + method.color
                        }`}
                      >
                        <method.icon size={24} className={`mb-2 ${isSelected ? 'text-teal-400' : 'text-slate-500'}`} />
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fluxos Específicos por Método */}
              <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-5 min-h-[160px] flex flex-col justify-center">
                
                {/* 1. DINHEIRO */}
                {paymentMethod === 'Dinheiro' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Valor Recebido</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={receivedAmount}
                            onChange={(e) => setReceivedAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-teal-500 font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Troco a Devolver</label>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-mono font-bold text-emerald-400">
                          R$ {receivedAmount && parseFloat(receivedAmount) >= totalWithDiscount 
                            ? (parseFloat(receivedAmount) - totalWithDiscount).toFixed(2) 
                            : '0.00'}
                        </div>
                      </div>
                    </div>
                    {receivedAmount && parseFloat(receivedAmount) < totalWithDiscount && (
                      <p className="text-rose-400 text-xs font-medium">⚠️ O valor recebido é menor que o total a pagar.</p>
                    )}
                  </div>
                )}

                {/* 2. PIX */}
                {paymentMethod === 'Pix' && (
                  <div className="flex items-center gap-6">
                    {/* Mock QR Code Container */}
                    <div className="bg-white p-3 rounded-2xl w-32 h-32 flex items-center justify-center relative group shadow-lg">
                      <div className="w-full h-full bg-gradient-to-br from-cyan-600 via-teal-500 to-emerald-500 rounded-lg p-1.5 flex flex-col items-center justify-center text-white">
                        <span className="font-extrabold text-[12px] tracking-widest uppercase">PIX</span>
                        <QrCode size={42} className="my-1 text-white" />
                        <span className="text-[7px] text-cyan-100 opacity-90 mt-0.5 text-center leading-none">Simule confirmação ao lado</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
                        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold">PIX COPIA E COLA</span>
                        <span className="text-xs text-slate-400 font-mono truncate select-all flex-1">00020126360014br.gov.bcb.pix0114+551199999999...</span>
                      </div>
                      
                      {pixStatus === 'pending' && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400 leading-relaxed">Mostre o QR Code ao cliente. O sistema simula a detecção do pagamento de forma integrada.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setPixStatus('confirming');
                              setTimeout(() => {
                                setPixStatus('completed');
                              }, 2000);
                            }}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
                          >
                            Simular Confirmação Instantânea (Pix)
                          </button>
                        </div>
                      )}

                      {pixStatus === 'confirming' && (
                        <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                          <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
                          Aguardando confirmação bancária em tempo real...
                        </div>
                      )}

                      {pixStatus === 'completed' && (
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          ✓ Pagamento via PIX recebido e confirmado!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. DÉBITO & CRÉDITO */}
                {(paymentMethod === 'Debito' || paymentMethod === 'Credito') && (
                  <div className="flex items-center gap-6">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl w-32 h-32 flex flex-col items-center justify-center text-center shadow-lg">
                      <CreditCard size={40} className="text-slate-500 animate-pulse mb-2" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TEF Ativo</span>
                    </div>

                    <div className="flex-1 space-y-3">
                      <p className="text-sm font-semibold text-slate-200">
                        {paymentMethod === 'Debito' ? 'Transação de DÉBITO' : 'Transação de CRÉDITO'}
                      </p>
                      
                      {cardStatus === 'pending' && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-400 leading-relaxed">Solicite ao cliente que insira ou aproxime o cartão de débito/crédito na maquininha.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setCardStatus('processing');
                              setTimeout(() => {
                                setCardStatus('completed');
                              }, 2500);
                            }}
                            className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                          >
                            Simular Inserção / Aproximação do Cartão
                          </button>
                        </div>
                      )}

                      {cardStatus === 'processing' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
                            <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                            Processando pagamento TEF... Não remova o cartão.
                          </div>
                          <p className="text-[10px] text-slate-500 italic">Enviando dados à operadora de cartão...</p>
                        </div>
                      )}

                      {cardStatus === 'completed' && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                            ✓ Transação aprovada e autorizada!
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono">NSU: {Math.floor(Math.random()*90000000 + 10000000)} | AUT: {Math.floor(Math.random()*900000 + 100000)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. CREDIÁRIO */}
                {paymentMethod === 'Crediario' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <span>👥 Comprar no Crediário / Fiado</span>
                      </h5>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 font-extrabold px-2 py-0.5 rounded-full uppercase">
                        Limite Corporativo
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Selecione o Cliente</label>
                        <select
                          value={selectedClienteId}
                          onChange={(e) => setSelectedClienteId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-teal-500"
                        >
                          <option value="">-- Escolher Cliente --</option>
                          {clientes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.nome} (CPF: {c.cpf})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {selectedClienteId ? (() => {
                        const cliente = clientes.find(c => c.id === parseInt(selectedClienteId));
                        if (!cliente) return null;
                        const limiteDisponivel = cliente.limite_credito - cliente.saldo_devedor;
                        const temLimite = limiteDisponivel >= totalWithDiscount;
                        
                        return (
                          <div className="bg-slate-950/50 border border-slate-850 p-3.5 rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Limite Total:</span>
                              <span className="text-slate-200 font-bold font-mono">R$ {cliente.limite_credito.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Saldo Devedor:</span>
                              <span className="text-rose-400 font-bold font-mono">R$ {cliente.saldo_devedor.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-slate-800/85 my-1.5"></div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-semibold">Disponível:</span>
                              <span className={`font-black font-mono ${temLimite ? 'text-emerald-400' : 'text-rose-500 animate-pulse'}`}>
                                R$ {limiteDisponivel.toFixed(2)}
                              </span>
                            </div>
                            
                            {!temLimite && (
                              <p className="text-[10px] text-rose-500 font-bold mt-1">
                                ❌ LIMITE EXCEDIDO PARA ESTA COMPRA.
                              </p>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="border border-dashed border-slate-800 rounded-xl flex items-center justify-center p-4 text-center text-xs text-slate-500">
                          Selecione um cliente para carregar o extrato de crédito e limites
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer do Modal */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="px-5 py-3 border border-slate-800 text-slate-400 font-semibold rounded-xl hover:bg-slate-850 hover:text-white transition-colors cursor-pointer"
              >
                Voltar
              </button>
              
              <button
                type="button"
                onClick={() => finalizarVenda(paymentMethod)}
                disabled={
                  isProcessingSale ||
                  (paymentMethod === 'Dinheiro' && receivedAmount && parseFloat(receivedAmount) < totalWithDiscount) ||
                  (paymentMethod === 'Pix' && pixStatus !== 'completed') ||
                  ((paymentMethod === 'Debito' || paymentMethod === 'Credito') && cardStatus !== 'completed') ||
                  (paymentMethod === 'Crediario' && (!selectedClienteId || (() => {
                    const c = clientes.find(x => x.id === parseInt(selectedClienteId));
                    return !c || (c.limite_credito - c.saldo_devedor) < totalWithDiscount;
                  })()))
                }
                className={`px-8 py-3 font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  isProcessingSale ||
                  (paymentMethod === 'Dinheiro' && receivedAmount && parseFloat(receivedAmount) < totalWithDiscount) ||
                  (paymentMethod === 'Pix' && pixStatus !== 'completed') ||
                  ((paymentMethod === 'Debito' || paymentMethod === 'Credito') && cardStatus !== 'completed') ||
                  (paymentMethod === 'Crediario' && (!selectedClienteId || (() => {
                    const c = clientes.find(x => x.id === parseInt(selectedClienteId));
                    return !c || (c.limite_credito - c.saldo_devedor) < totalWithDiscount;
                  })()))
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-lg shadow-teal-500/25 active:scale-[0.98]'
                }`}
              >
                {isProcessingSale ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <CheckCircle2 size={18} />
                )}
                CONFIRMAR E EMITIR CUPOM
              </button>
            </div>

          </div>
        </div>
      )}
      {/* MODAL DE SUCESSO - SIMULADOR DE IMPRESSORA TÉRMICA & FISCAL */}
      {isSuccessModalOpen && lastSaleDetails && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 transition-all p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Venda Autorizada (SEFAZ-AM)</h3>
                  <p className="text-xs text-slate-400 font-medium">NFC-e emitida e homologada com sucesso pela SEFAZ Amazonas</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Corpo com Layout Duplo: Infos Fiscais vs Impressora Física */}
            <div className="p-6 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-900/60">
              
              {/* Painel de Controle e Status */}
              <div className="space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Informações da Transação</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500">Número NFC-e</p>
                        <p className="text-white font-bold font-mono mt-0.5">#{lastSaleDetails.numero_extrato_sat}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Valor Total</p>
                        <p className="text-teal-400 font-extrabold font-mono mt-0.5">R$ {lastSaleDetails.valor_total.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Pagamento</p>
                        <p className="text-white font-bold mt-0.5">{lastSaleDetails.forma_pagamento}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Operador</p>
                        <p className="text-white font-bold mt-0.5">{currentUser?.nome}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950/30 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Dados do Integrador Fiscal</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="text-slate-500">Chave de Acesso NFC-e (44 dígitos)</p>
                        <p className="text-slate-400 font-mono text-[9px] break-all select-all p-2.5 bg-slate-950 rounded-lg border border-slate-850 mt-1">{lastSaleDetails.chave_acesso_sat}</p>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-slate-500">Status SEFAZ-AM</span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">100 - Autorizado</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Protocolo Autorização</span>
                        <span className="text-[10px] text-slate-400 font-mono">Homologado (A1 Digital)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ações Fiscais */}
                <div className="space-y-3 pt-4">
                  <button
                    type="button"
                    onClick={handleSimulatePrint}
                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/20 active:scale-[0.98] text-sm flex justify-center items-center gap-2.5 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    DISPARAR IMPRESSORA (ESC/POS)
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadXML}
                    className="w-full bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white font-bold py-3.5 rounded-xl transition-all border border-slate-800 text-sm flex justify-center items-center gap-2.5 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    BAIXAR XML DA NOTA (SEFAZ)
                  </button>
                </div>
              </div>

              {/* Simulador Físico de Papel Térmico */}
              <div className="flex flex-col items-center">
                {/* Boca da Impressora */}
                <div className="w-[340px] h-3 bg-slate-950 border border-slate-800 rounded-t-xl shadow-2xl relative z-10">
                  <div className="absolute inset-x-4 top-1/2 h-[2px] bg-slate-900 rounded"></div>
                </div>
                
                {/* Rolo de Papel */}
                <div className="w-[340px] bg-amber-50/95 text-slate-800 font-mono text-[9px] p-5 rounded-b-xl shadow-2xl border-t-2 border-dashed border-slate-300 leading-relaxed overflow-y-auto max-h-[50vh] scrollbar-thin select-text">
                  <div className="whitespace-pre-wrap">{lastSaleDetails.layout_extrato}</div>
                  
                  {/* Código de Barras Simulado */}
                  <div className="mt-4 flex flex-col items-center gap-1.5 opacity-90">
                    <div className="flex items-end h-8 gap-[1px] bg-white p-2 rounded border border-slate-250">
                      {[1,3,1,2,4,1,3,2,1,4,2,3,1,2,1,4,3,1,2,4,1,3,2,1,4,2,3,1].map((w, idx) => (
                        <div key={idx} className="bg-slate-900 h-full" style={{ width: `${w}px` }}></div>
                      ))}
                    </div>
                    <span className="text-[7px] text-slate-500 tracking-widest">{lastSaleDetails.chave_acesso_sat.slice(0, 22)}...</span>
                  </div>

                  {/* QR Code Simulado */}
                  <div className="mt-4 flex flex-col items-center gap-1 opacity-90">
                    <div className="bg-white p-2 rounded border border-slate-250 w-16 h-16 flex flex-wrap justify-center items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-slate-900 to-slate-850 p-1 flex flex-col items-center justify-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                      </div>
                    </div>
                    <span className="text-[7px] text-slate-400">QR Code de Consulta SEFAZ-AM</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                className="px-8 py-3 bg-slate-800 text-white hover:bg-slate-750 font-bold rounded-xl transition-all cursor-pointer active:scale-[0.98]"
              >
                CONCLUIR E ZERAR CAIXA
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 1: CADASTRAR NOVO CLIENTE NO CREDIÁRIO */}
      {isNewClienteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 transition-all p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="text-teal-500" /> Nova Ficha de Crediário
              </h3>
              <button
                type="button"
                onClick={() => setIsNewClienteModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={cadastrarNovoCliente}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={newClienteForm.nome}
                    onChange={(e) => setNewClienteForm({ ...newClienteForm, nome: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-teal-500"
                    placeholder="Ex: Kennedy Monteiro de Lima"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">CPF do Cliente</label>
                    <input
                      required
                      type="text"
                      value={newClienteForm.cpf}
                      onChange={(e) => setNewClienteForm({ ...newClienteForm, cpf: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-teal-500"
                      placeholder="123.456.789-00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Contato / Celular</label>
                    <input
                      type="text"
                      value={newClienteForm.telefone}
                      onChange={(e) => setNewClienteForm({ ...newClienteForm, telefone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-medium text-sm focus:outline-none focus:border-teal-500"
                      placeholder="(92) 98111-2233"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Limite de Crédito Aprovado (R$)</label>
                  <input
                    required
                    type="number"
                    value={newClienteForm.limite_credito}
                    onChange={(e) => setNewClienteForm({ ...newClienteForm, limite_credito: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-teal-400 font-bold text-sm focus:outline-none focus:border-teal-500 font-mono"
                    placeholder="1000.00"
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewClienteModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-800 text-slate-400 font-semibold rounded-xl hover:bg-slate-850 hover:text-white transition-colors cursor-pointer text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-md shadow-teal-500/25 active:scale-[0.98] cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Liberar Crediário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EXTRATO COMPLETO DE DÍVIDAS & BAIXA DE TÍTULOS */}
      {selectedExtratoCliente && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 transition-all p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="text-teal-500" /> Extrato Financeiro de Crediário
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Ficha do Cliente: <span className="text-white font-bold">{selectedExtratoCliente.cliente.nome}</span> (CPF: {selectedExtratoCliente.cliente.cpf})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExtratoCliente(null)}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {/* Limit Gauge Banner */}
            <div className="bg-slate-950 border-b border-slate-800 p-5 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Limite Total</p>
                <p className="text-lg font-black text-slate-200 mt-1 font-mono">
                  R$ {selectedExtratoCliente.cliente.limite_credito.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Saldo Devedor</p>
                <p className="text-lg font-black text-rose-500 mt-1 font-mono">
                  R$ {selectedExtratoCliente.cliente.saldo_devedor.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Disponível</p>
                <p className="text-lg font-black text-emerald-400 mt-1 font-mono">
                  R$ {selectedExtratoCliente.cliente.limite_disponivel.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Invoices List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Títulos Em Aberto</h4>
              
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                      <th className="p-3">Data</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3 text-right">Valor Original</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Recebimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {selectedExtratoCliente.lancamentos.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500 font-medium italic">
                          Parabéns! Nenhuma conta em aberto localizada para este cliente.
                        </td>
                      </tr>
                    ) : (
                      selectedExtratoCliente.lancamentos.map(l => (
                        <tr key={l.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-semibold text-slate-400">{l.data_lancamento}</td>
                          <td className="p-3 font-semibold text-slate-400 font-mono">{l.data_vencimento}</td>
                          <td className="p-3 text-right font-black text-slate-200 font-mono">
                            R$ {l.valor.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              l.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              l.status === 'Atrasado' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {l.status !== 'Pago' ? (
                              <button
                                type="button"
                                onClick={() => pagarTituloCrediario(l.id, selectedExtratoCliente.cliente.id)}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-all cursor-pointer text-[10px] flex items-center gap-1 mx-auto shadow"
                              >
                                ✓ Baixar Título
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-semibold italic">Liquidado</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExtratoCliente(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl transition-all cursor-pointer text-sm"
              >
                Fechar Ficha do Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}