import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, Empty, Spinner } from '../components/ui';
import { fmtDateTime } from '../lib/format';

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('TODAS');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (role !== 'admin') return;

    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(500));
    
    // Monitoreo Live (Real-Time) de la bitácora
    const unsubscribe = onSnapshot(q, (snap) => {
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
        }),
      );
      setLoading(false);
    }, (err) => {
      setError(
        (err as { code?: string }).code === 'permission-denied'
          ? 'Firestore rechazó la lectura de la bitácora. Revisa tu rol en admins/{uid}.'
          : (err as Error).message,
      );
      setLoading(false);
    });

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
    const head = ['Fecha', 'Usuario', 'Acción', 'Detalles'];
    const rows = filtered.map((l) => [
      l.timestamp ? l.timestamp.toISOString() : '',
      l.user,
      l.action,
      JSON.stringify(l.details ?? {}),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (role !== 'admin') return <Navigate to="/" replace />;
  if (loading) return <Spinner label="Cargando bitácora…" />;
  if (error) return <div className="alert bad">{error}</div>;

  const visible = filtered.slice(0, visibleCount);

  return (
    <>
      <div className="page-head">
        <h1>Bitácora del sistema</h1>
        <p>
          Quién hizo qué y cuándo: subidas, expedientes, compras, caja chica, configuración y
          respaldos. Cada acción sensible queda aquí, ordenada de la más reciente a la más vieja.
        </p>
      </div>

      <Card
        title="Movimientos"
        hint={`${filtered.length} de ${logs.length}`}
        actions={
          <>
            <button className="btn" onClick={exportCSV}>⭳ CSV</button>
          </>
        }
      >
        <div className="card-head no-print">
          <div className="chip-row">
            <button
              className={`chip ${actionFilter === 'TODAS' ? 'active' : ''}`}
              onClick={() => setActionFilter('TODAS')}
            >
              Todas ({logs.length})
            </button>
            {actionTypes.map((a) => (
              <button
                key={a}
                className={`chip ${actionFilter === a ? 'active' : ''}`}
                onClick={() => setActionFilter(a)}
              >
                {a} ({logs.filter((l) => l.action === a).length})
              </button>
            ))}
          </div>
          <span className="spacer" />
          <input
            className="search-input"
            type="search"
            placeholder="Buscar usuario, acción, detalle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <Empty>No hay movimientos con este filtro.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((log) => (
                  <tr key={log.id}>
                    <td className="mono">{log.timestamp ? fmtDateTime(log.timestamp) : '—'}</td>
                    <td>{log.user}</td>
                    <td><strong>{log.action}</strong></td>
                    <td className="mono" style={{ color: 'var(--ink-soft)', whiteSpace: 'normal' }}>
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleCount < filtered.length && (
          <div style={{ padding: 14, textAlign: 'center' }}>
            <button className="btn" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
              Ver {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
