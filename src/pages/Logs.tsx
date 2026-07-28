import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

interface LogEntry {
  id: string;
  user: string;
  action: string;
  details: any;
  timestamp: Date | null;
}

export default function Logs() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(100));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            user: d.user,
            action: d.action,
            details: d.details,
            timestamp: d.timestamp?.toDate() || null,
          };
        });
        setLogs(data);
      } catch (err) {
        console.error('Error fetching logs', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div className="card">
      <h2>Bitácora del Sistema</h2>
      <p className="subtitle">Últimos 100 movimientos de usuarios en la plataforma.</p>
      
      {loading ? (
        <div>Cargando logs...</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {log.timestamp ? log.timestamp.toLocaleString('es-MX') : '...'}
                  </td>
                  <td>{log.user}</td>
                  <td><strong>{log.action}</strong></td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4}>No hay registros aún.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
