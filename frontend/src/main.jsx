import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Limpa qualquer Service Worker órfão/antigo registrado na mesma porta local (de outros projetos)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      for (let registration of registrations) {
        registration.unregister();
        console.log('Unregistered stale service worker:', registration);
      }
      // Recarrega a página uma única vez para limpar o controle de rede do Service Worker desinstalado
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
