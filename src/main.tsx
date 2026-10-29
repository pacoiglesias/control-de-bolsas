import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { diagLog, diagSessionStart } from './lib/appDiag';

// Diagnóstico local (src/lib/appDiag.ts): errores no controlados,
// promesas rechazadas y cambios de conexión quedan registrados en el
// dispositivo aunque Firestore falle, y se consultan desde
// Configuración → Auditoría & Respaldo → Diagnóstico de la app.
// Se instala una sola vez aunque StrictMode monte dos veces.
if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>).__bolsasDiagInstalled) {
  (window as unknown as Record<string, unknown>).__bolsasDiagInstalled = true;
  diagSessionStart();
  window.addEventListener('error', (e) => {
    diagLog('window_error', { message: e.message || 'desconocido' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    diagLog('unhandled_rejection', {
      reason: reason instanceof Error ? reason.name : typeof reason,
    });
  });
  window.addEventListener('online', () => diagLog('connectivity', { online: true }));
  window.addEventListener('offline', () => diagLog('connectivity', { online: false }));
}

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
