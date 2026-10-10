import { motion, AnimatePresence } from 'framer-motion';
import { glass } from './MaquiladorPortal.shared';
import type { OfflineDeliveryItem } from '../lib/offlineMaquilaDb';

interface MaquiladorPortalOfflineModalProps {
  showOfflineModal: boolean;
  setShowOfflineModal: (v: boolean) => void;
  syncOfflineQueue: (targetDeliveryId?: string) => Promise<void>;
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
              maxWidth: 560,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: 24,
              borderRadius: 20,
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>📦</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Cola de Entregas Offline</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    Persistidas en IndexedDB · Clave de idempotencia única protegida
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
                  padding: '4px 8px',
                }}
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Banner Informativo */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 11.5,
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.45,
              }}
            >
              🔒 <strong>Garantía de idempotencia:</strong> Cada entrega cuenta con un identificador único. Si reintentas manualmente o vuelve la conexión, el servidor no duplicará los kilos ni las partidas.
            </div>

            {/* Botón de Sincronización Global */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => void syncOfflineQueue()}
                disabled={isSyncingQueue || !isOnline || offlineQueue.length === 0}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: isOnline
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(255,255,255,0.1)',
                  color: isOnline ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: isOnline && !isSyncingQueue && offlineQueue.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>{isSyncingQueue ? '⏳' : '🔄'}</span>
                <span>
                  {isSyncingQueue
                    ? 'Sincronizando entregas...'
                    : !isOnline
                    ? 'Sin Conexión a Internet'
                    : offlineQueue.length === 0
                    ? 'Cola vacía'
                    : `Sincronizar Todas (${offlineQueue.length}) Ahora`}
                </span>
              </button>
            </div>

            {/* Lista de Entregas con Estado Visual Detallado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {offlineQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                  ✅ No hay entregas pendientes en la cola local. Todas han sido sincronizadas en la nube.
                </div>
              ) : (
                offlineQueue.map((item) => {
                  const hasError = Boolean(item.lastError);
                  const itemStatusLabel = hasError ? 'Requiere atención' : 'Pendiente';
                  const itemStatusColor = hasError ? '#ef4444' : '#f59e0b';
                  const itemStatusBg = hasError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
                  const itemBorder = hasError ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.08)';

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: itemBorder,
                        borderRadius: 14,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14.5 }}>OC {item.folio}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                            {item.productDescription}
                          </div>
                          {item.docFolio && (
                            <div style={{ fontSize: 11.5, color: '#38bdf8', marginTop: 3 }}>
                              Folio {item.docType}: <strong>{item.docFolio}</strong>
                            </div>
                          )}
                          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            Guardado: {new Date(item.createdAt).toLocaleString('es-MX')}
                          </div>
                          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginTop: 1 }}>
                            ID: {item.id}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24' }}>
                            {item.kilos.toLocaleString('es-MX')} kg
                          </div>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: itemStatusBg,
                              color: itemStatusColor,
                              marginTop: 6,
                              display: 'inline-block',
                              border: `1px solid ${itemStatusColor}40`,
                            }}
                          >
                            {hasError ? `⚠️ ${itemStatusLabel}` : `⏳ ${itemStatusLabel}`}
                          </span>
                        </div>
                      </div>

                      {/* Mensaje de Error Comprensible */}
                      {hasError && (
                        <div
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: 8,
                            padding: '8px 10px',
                            fontSize: 11,
                            color: '#fca5a5',
                          }}
                        >
                          <div><strong>Motivo:</strong> {item.lastError}</div>
                          <div style={{ fontSize: 10, marginTop: 2, color: 'rgba(255,255,255,0.5)' }}>
                            Intentos previos: {item.retryCount || 1}. Al reintentar, se completará la reconciliación sin alterar pesajes previos.
                          </div>
                        </div>
                      )}

                      {/* Botón de Reintento Manual Individual */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
                        <button
                          onClick={() => void syncOfflineQueue(item.id)}
                          disabled={isSyncingQueue || !isOnline}
                          style={{
                            padding: '6px 12px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            borderRadius: 8,
                            background: isOnline ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                            color: isOnline ? '#fff' : 'rgba(255,255,255,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            cursor: isOnline && !isSyncingQueue ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                          title={isOnline ? 'Reintentar esta entrega individualmente' : 'Conecta a internet para reintentar'}
                        >
                          <span>🔄</span>
                          <span>Reintentar esta entrega</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
