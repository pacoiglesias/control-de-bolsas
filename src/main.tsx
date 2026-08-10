import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// FIX 2026-08-10 (Staff Engineer -- task ERP #11): aquí había un SEGUNDO
// registro del Service Worker (registerSW de 'virtual:pwa-register', fuera
// de React) que usaba un window.confirm() bloqueante para preguntar si
// recargar. <ReloadPrompt /> (montado en App.tsx) YA registra el Service
// Worker con el hook useRegisterSW de 'virtual:pwa-register/react' y
// muestra un banner no bloqueante con los mismos dos botones (Actualizar /
// Cerrar). Tener AMBOS registros activos a la vez podía disparar dos
// registros de SW compitiendo y, encima, mostrar el confirm() bloqueante
// Y el banner al mismo tiempo. Se elimina el duplicado de aquí; el flujo
// real de "hay actualización disponible" vive únicamente en ReloadPrompt.

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
