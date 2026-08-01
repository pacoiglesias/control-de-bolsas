import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registra el Service Worker y notifica si hay actualizacion
const updateSW = registerSW({
  onNeedRefresh() {
    // Podriamos mostrar un toast, pero con esto la app pregunta
    if (confirm("Nueva versión disponible. ¿Recargar ahora?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App is ready to work offline");
  },
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
