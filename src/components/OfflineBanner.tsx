import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { triggerHaptic } from '../lib/hapticEngine';
import { OfflineExcelSyncModal } from './Offline/OfflineExcelSyncModal';

export function OfflineBanner() {
  const { isOnline, isOffline } = useNetworkStatus();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false);

  useEffect(() => {
    if (isOnline) {
      // Si venía de estar offline, mostrar brevemente que se recuperó la conexión
      const wasOffline = sessionStorage.getItem('cb_was_offline') === 'true';
      if (wasOffline) {
        sessionStorage.removeItem('cb_was_offline');
        setShowReconnectedAlert(true);
        const timer = setTimeout(() => setShowReconnectedAlert(false), 4000);
        return () => clearTimeout(timer);
      }
    } else {
      sessionStorage.setItem('cb_was_offline', 'true');
    }
  }, [isOnline]);

  return (
    <>
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="no-print"
            style={{
              background: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
              borderBottom: '2px solid #f59e0b',
              color: '#fef3c7',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              position: 'relative',
              zIndex: 800,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <span
                style={{
                  fontSize: 20,
                  animation: 'pulse 2s infinite',
                  display: 'inline-block',
                }}
              >
                📡
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Modo Offline Activo (Sin Conexión)</span>
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.25)',
                      border: '1px solid #f59e0b',
                      color: '#fde68a',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}
                  >
                    CACHÉ LOCAL ACTIVA
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#fef3c7', marginTop: 2, opacity: 0.9 }}>
                  Puedes registrar entregas, facturas y consultar tus órdenes con normalidad. Todo se guarda en tu dispositivo y se sincronizará automáticamente al recuperar señal.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setShowSyncModal(true);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Abrir Centro de Sincronización Offline"
              >
                <span>📲</span> Sincronizar Excel
              </button>
            </div>
          </motion.div>
        )}

        {showReconnectedAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="no-print"
            style={{
              background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
              borderBottom: '2px solid #10b981',
              color: '#d1fae5',
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <span>🟢</span>
            <span>¡Conexión a internet restablecida! Todos tus datos locales se han sincronizado con Firebase.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {showSyncModal && <OfflineExcelSyncModal onClose={() => setShowSyncModal(false)} />}
    </>
  );
}
