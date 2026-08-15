import { useRegisterSW } from 'virtual:pwa-register/react';

export default function ReloadPrompt() {
  // Configuración del plugin PWA para React
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
      maxWidth: '350px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      borderRadius: '8px'
    }}>
      <div style={{ margin: 0, padding: '16px', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '8px' }}>
        <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
          {offlineReady 
            ? '¡App lista para funcionar sin conexión! (Modo Offline Activado)' 
            : 'Hay una nueva actualización del sistema disponible.'}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {needRefresh && (
            <button 
              className="btn" 
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '12px' }}
              onClick={() => updateServiceWorker(true)}
            >
              Actualizar Ahora
            </button>
          )}
          <button 
            className="btn" 
            style={{ background: 'var(--ink-faint)', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '12px' }}
            onClick={() => close()}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
