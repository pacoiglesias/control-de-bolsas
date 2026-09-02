import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, getDocs, writeBatch } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, Empty, Spinner } from '../components/ui';
import CierreMesModal from '../components/CierreMesModal';
import { fmtDateTime } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { confirmDialog } from '../lib/confirmDialog';
import { triggerHaptic } from '../lib/hapticEngine';

interface LogEntry {
  id: string;
  user: string;
  action: string;
  details: unknown;
  timestamp: Date | null;
}

const PAGE_SIZE = 100;

export default function Logs() {
  const { role } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('TODAS');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [clearing, setClearing] = useState(false);
  const [showCierre, setShowCierre] = useState(false);

  useEffect(() => {
    if (role !== 'admin') return;

    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(500));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLogs(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              user: data.user ?? '—',
              action: data.action ?? '—',
              details: data.details ?? null,
              timestamp: data.timestamp?.toDate?.() ?? null,
            };
          })
        );
        setLoading(false);
      },
      (err) => {
        setError(
          (err as { code?: string }).code === 'permission-denied'
            ? 'Firestore rechazó la lectura de la bitácora. Revisa tu rol en admins/{uid}.'
            : (err as Error).message
        );
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [role]);

  const actionTypes = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== 'TODAS' && l.action !== actionFilter) return false;
      if (!q) return true;
      return `${l.user} ${l.action} ${JSON.stringify(l.details ?? '')}`.toLowerCase().includes(q);
    });
  }, [logs, search, actionFilter]);

  function exportCSV() {
    triggerHaptic('light');
    const seguroCSV = (v: unknown) => {
      const txt = String(v ?? '');
      return /^[=+\-@\t\r]/.test(txt) ? `'${txt}` : txt;
    };
    const head = ['Fecha', 'Usuario', 'Acción', 'Detalles'];
    const rows = filtered.map((l) => [
      l.timestamp ? l.timestamp.toISOString() : '',
      l.user,
      l.action,
      JSON.stringify(l.details ?? {}),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${seguroCSV(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerHaptic('success');
    toast('📄 Bitácora CSV descargada con éxito', 'ok');
  }

  async function clearLogs() {
    triggerHaptic('warning');
    const confirmed = await confirmDialog({
      message: '¿Estás seguro de que deseas borrar TODA la bitácora de auditoría? Esto no se puede deshacer.',
      danger: true,
    });
    if (!confirmed) return;

    setClearing(true);
    try {
      let totalBorrados = 0;
      for (let i = 0; i < 200; i++) {
        const q = query(collection(db, 'system_logs'), limit(500));
        const snap = await getDocs(q);
        if (snap.empty) break;
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        totalBorrados += snap.docs.length;
        if (snap.docs.length < 500) break;
      }
      triggerHaptic('success');
      toast(`Bitácora limpiada con éxito (${totalBorrados.toLocaleString('es-MX')} registros borrados)`, 'ok');
    } catch (e) {
      triggerHaptic('error');
      toast(`Error al limpiar: ${(e as Error).message}`, 'bad');
    } finally {
      setClearing(false);
    }
  }

  if (role !== 'admin') return <Navigate to="/" replace />;
  if (loading) return <Spinner label="Cargando bitácora…" />;
  if (error) return <div className="alert bad">{error}</div>;

  const visible = filtered.slice(0, visibleCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        className="page-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1>BITÁCORA FORENSE & AUDITORÍA EN VIVO</h1>
          <p>Trazabilidad completa en tiempo real de operaciones, cobros, facturación, compras y cambios de sistema.</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary"
          style={{ minHeight: 40, fontWeight: 800 }}
          onClick={() => {
            triggerHaptic('light');
            setShowCierre(true);
          }}
        >
          📦 Cierre de Mes (ZIP)
        </motion.button>
      </div>

      <Card
        title="Historial de Movimientos"
        hint={`${filtered.length} de ${logs.length} eventos registrados`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn"
              style={{ color: 'var(--bad, #ef4444)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={clearLogs}
              disabled={clearing || logs.length === 0}
            >
              {clearing ? 'Borrando...' : '🗑️ Limpiar'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="btn"
              onClick={exportCSV}
            >
              ⭳ CSV
            </motion.button>
          </div>
        }
      >
        <div style={{ padding: 18 }}>
          {/* Barra de Filtros y Búsqueda */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 6,
                padding: 4,
                background: 'var(--paper-sunk, rgba(0,0,0,0.25))',
                borderRadius: 12,
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                overflowX: 'auto',
                maxWidth: '100%',
              }}
            >
              <button
                className={`chip ${actionFilter === 'TODAS' ? 'active' : ''}`}
                style={{
                  background: actionFilter === 'TODAS' ? '#3b82f6' : 'transparent',
                  color: actionFilter === 'TODAS' ? '#fff' : 'var(--ink-soft)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  triggerHaptic('light');
                  setActionFilter('TODAS');
                }}
              >
                Todas ({logs.length})
              </button>
              {actionTypes.slice(0, 8).map((a) => {
                const isActive = actionFilter === a;
                const count = logs.filter((l) => l.action === a).length;
                return (
                  <button
                    key={a}
                    style={{
                      background: isActive ? '#3b82f6' : 'transparent',
                      color: isActive ? '#fff' : 'var(--ink-soft)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      triggerHaptic('light');
                      setActionFilter(a);
                    }}
                  >
                    {a} ({count})
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <input
                className="search-input"
                type="search"
                placeholder="Buscar usuario, acción o folio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', borderRadius: 10 }}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <Empty>No hay eventos que coincidan con la búsqueda.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--paper-sunk, rgba(0,0,0,0.2))' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: 'var(--ink-soft)' }}>Fecha y Hora</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: 'var(--ink-soft)' }}>Usuario</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: 'var(--ink-soft)' }}>Acción</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, color: 'var(--ink-soft)' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((log) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border, rgba(255,255,255,0.05))',
                      }}
                    >
                      <td className="mono" style={{ padding: '10px 12px', fontSize: 12, color: '#38bdf8' }}>
                        {log.timestamp ? fmtDateTime(log.timestamp) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 600 }}>{log.user}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td
                        className="mono"
                        style={{
                          padding: '10px 12px',
                          color: 'var(--ink-soft)',
                          fontSize: 12,
                          wordBreak: 'break-word',
                        }}
                      >
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {visibleCount < filtered.length && (
            <div style={{ padding: '16px 0 0', textAlign: 'center' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn"
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              >
                Ver {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más
              </motion.button>
            </div>
          )}
        </div>
      </Card>

      {showCierre && <CierreMesModal onClose={() => setShowCierre(false)} />}
    </div>
  );
}

