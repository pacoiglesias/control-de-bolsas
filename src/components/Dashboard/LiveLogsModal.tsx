import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Modal, Empty } from '../ui';

interface LiveLog {
  id: string;
  action: string;
  timestamp: any;
  user: string;
  details?: any;
  error?: string;
  type?: 'action' | 'error' | 'sync';
}

interface LiveLogsModalProps {
  onClose: () => void;
  liveLogs?: LiveLog[];
}

export function LiveLogsModal({ onClose }: LiveLogsModalProps) {
  const [logs, setLogs] = useState<LiveLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Escuchar en tiempo real la bitácora de system_logs
    const qSystem = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(60));
    const unsub = onSnapshot(qSystem, (snap) => {
      const items: LiveLog[] = snap.docs.map((d) => {
        const data = d.data();
        const ts = data.timestamp?.toDate ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date());
        return {
          id: d.id,
          action: data.action || 'Operación del Sistema',
          timestamp: ts,
          user: data.user || 'admin@sistema.com',
          details: data.details,
          type: 'action',
        };
      });
      setLogs(items);
      setLoading(false);
    }, (err) => {
      console.warn('Error al escuchar logs:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return (
      l.action.toLowerCase().includes(term) ||
      l.user.toLowerCase().includes(term) ||
      (l.details && JSON.stringify(l.details).toLowerCase().includes(term))
    );
  });

  return (
    <Modal title="⚡ Monitor de Auditoría y Bitácora en Vivo (Live Logs)" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '75vh', overflowY: 'auto', paddingRight: 6 }}>
        {/* Barra Superior con Buscador */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            🟢 <strong>Monitor en Tiempo Real:</strong> Captura cada subida de documentos, pegado de contrarecibos, pagos, purgas y operaciones.
          </div>
          <input
            type="text"
            className="input"
            placeholder="🔍 Filtrar logs por acción, usuario o folio..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ fontSize: 12, padding: '6px 12px', minWidth: 260, borderRadius: 8 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--ink-soft)', fontSize: 13 }}>
            ⏳ Conectando con la bitácora de eventos en tiempo real...
          </div>
        ) : filteredLogs.length === 0 ? (
          <Empty>No se encontraron registros de auditoría que coincidan con la búsqueda.</Empty>
        ) : (
          filteredLogs.map((log, idx) => {
            const isRecent = idx === 0;
            const isExpanded = expandedLogId === log.id;
            const isError = log.action.toLowerCase().includes('error') || log.action.toLowerCase().includes('fallo');

            return (
              <div
                key={log.id}
                style={{
                  padding: 12,
                  background: isError ? 'rgba(239, 68, 68, 0.08)' : isRecent ? 'rgba(16, 185, 129, 0.08)' : 'var(--paper-sunk)',
                  border: isError ? '1px solid rgba(239, 68, 68, 0.3)' : isRecent ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--line)',
                  borderRadius: 'var(--radius)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: isError ? 'var(--bad)' : isRecent ? 'var(--ok)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{isError ? '🚨' : isRecent ? '⚡' : '📋'}</span>
                    <span>{log.action}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
                    🕒 {log.timestamp instanceof Date ? log.timestamp.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Reciente'}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  <span>Usuario: <strong style={{ color: 'var(--ink)' }}>{log.user}</strong></span>
                  {log.details && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ fontSize: 10.5, padding: '2px 8px', background: 'var(--paper-raised)', border: '1px solid var(--line)' }}
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      {isExpanded ? 'Ocultar Detalle ▲' : 'Ver Detalle ▼'}
                    </button>
                  )}
                </div>

                {log.details && isExpanded && (
                  <div style={{ marginTop: 8, padding: 8, background: 'var(--paper)', borderRadius: 6, border: '1px dashed var(--line)' }}>
                    <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--ink)' }}>
                      {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
