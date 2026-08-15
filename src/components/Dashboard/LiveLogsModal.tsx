import { Modal, Empty } from '../ui';

interface LiveLog {
  id: string;
  action: string;
  timestamp: Date | null;
  user: string;
  details?: any;
}

interface LiveLogsModalProps {
  onClose: () => void;
  liveLogs: LiveLog[];
}

export function LiveLogsModal({ onClose, liveLogs }: LiveLogsModalProps) {
  return (
    <Modal title="⚡ Monitor de Movimientos en Tiempo Real (Live)" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
          🔴 <strong>Sincronización en vivo:</strong> Este monitor se actualiza automáticamente al instante cuando cualquier usuario opera en Caja Chica, expedientes, compras o cobranza.
        </div>
        {liveLogs.length === 0 ? (
          <Empty>No hay movimientos registrados recientemente.</Empty>
        ) : (
          liveLogs.map((log, idx) => (
            <div key={log.id} style={{ padding: 12, background: idx === 0 ? 'var(--ok-bg)' : 'var(--paper-sunk)', border: idx === 0 ? '1px solid var(--ok)' : '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: idx === 0 ? 'var(--ok)' : 'var(--ink)' }}>
                  {idx === 0 ? '⚡ ' : ''}{log.action}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  🕒 {log.timestamp ? log.timestamp.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Reciente'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span>Usuario: <strong>{log.user}</strong></span>
                {log.details && (
                  <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>
                    {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
