import { motion, AnimatePresence } from 'framer-motion';
import { glass } from './MaquiladorPortal.shared';
import type { OfflineDeliveryItem } from '../lib/offlineMaquilaDb';

interface MaquiladorPortalOfflineModalProps {
  showOfflineModal: boolean;
  setShowOfflineModal: (v: boolean) => void;
  syncOfflineQueue: () => Promise<void>;
  isSyncingQueue: boolean;
  isOnline: boolean;
  offlineQueue: OfflineDeliveryItem[];
}

export default function MaquiladorPortalOfflineModal({
  showOfflineModal,
  setShowOfflineModal,
  syncOfflineQueue,
  isSyncingQueue,
  isOnline,
  offlineQueue,
}: MaquiladorPortalOfflineModalProps) {
  return (
    <AnimatePresence>
      {showOfflineModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowOfflineModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              maxWidth: 520,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 24,
              borderRadius: 20,
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>📦</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Entregas Guardadas Offline</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    Persistidas de forma segura en tu dispositivo (IndexedDB)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowOfflineModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => void syncOfflineQueue()}
                disabled={isSyncingQueue || !isOnline}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: isOnline ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.1)',
                  color: isOnline ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: isOnline && !isSyncingQueue ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>{isSyncingQueue ? '⏳' : '🔄'}</span>
                <span>
                  {isSyncingQueue
                    ? 'Sincronizando...'
                    : isOnline
                    ? 'Sincronizar a la Nube Ahora'
                    : 'Sin Conexión a Internet'}
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {offlineQueue.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>OC {item.folio}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                      {item.productDescription}
                    </div>
                    {item.docFolio && (
                      <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 2 }}>
                        Folio {item.docType}: {item.docFolio}
                      </div>
                    )}
                    {item.lastError && (
                      <div style={{ fontSize: 10, color: '#f87171', marginTop: 3 }}>
                        ⚠️ {item.lastError} (Reintentos: {item.retryCount || 0})
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      Guardado: {new Date(item.createdAt).toLocaleTimeString('es-MX')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24' }}>
                      {item.kilos.toLocaleString('es-MX')} kg
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        marginTop: 4,
                        display: 'inline-block',
                      }}
                    >
                      En cola local
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
