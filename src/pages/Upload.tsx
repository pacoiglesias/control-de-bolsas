import { useCallback, useRef, useState, useEffect } from 'react';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage, PATHS } from '../lib/firebase';
import { useOrders } from '../hooks/useOrders';
import { Card, Empty, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDateTime, kilos, money } from '../lib/format';
import { sound } from '../lib/sounds';

interface Job {
  id: string;
  name: string;
  path: string;
  progress: number;
  state: 'subiendo' | 'procesando' | 'error' | 'completado';
  error?: string;
}

const MAX_MB = 20;

/** Nombre seguro para Storage: sin acentos, espacios ni caracteres raros. */
function safeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

export default function Upload() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { orders } = useOrders();
  const { role, user } = useAuth();
  const toast = useToast();

  const upload = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        if (file.type !== 'application/pdf') {
          toast(`${file.name} no es un PDF, se omitió.`, 'bad');
          return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          toast(`${file.name} pesa más de ${MAX_MB} MB.`, 'bad');
          return;
        }
        const path = `${PATHS.uploadsPrefix}/${Date.now()}-${safeName(file.name)}`;
        const id = path;
        setJobs((j) => [{ id, name: file.name, path, progress: 0, state: 'subiendo' }, ...j]);

        const task = uploadBytesResumable(ref(storage, path), file, {
          contentType: 'application/pdf',
        });
        task.on(
          'state_changed',
          (snap) => {
            const p = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setJobs((j) => j.map((x) => (x.id === id ? { ...x, progress: p } : x)));
          },
          (err) => {
            setJobs((j) =>
              j.map((x) => (x.id === id ? { ...x, state: 'error', error: err.message } : x)),
            );
            toast(`No se pudo subir ${file.name}`, 'bad');
          },
          () => {
            setJobs((j) =>
              j.map((x) => (x.id === id ? { ...x, progress: 100, state: 'procesando' } : x)),
            );
            logAction(user?.email, 'Subida de Orden (PDF)', { filename: file.name });
            toast(`${file.name} subido. La IA lo está leyendo…`, 'ok');
          },
        );
      });
    },
    [toast],
  );

  /** Cruza cada archivo subido con la orden que creó la Cloud Function. */
  const matched = useCallback((path: string) => orders.find((o) => o.fileName === path), [orders]);

  // Si la IA ya procesó el archivo, notificamos.
  useEffect(() => {
    let played = false;
    jobs.forEach(j => {
      if (j.state === 'procesando' && matched(j.path)) {
        if (!played) {
          sound.playNotify();
          played = true; // Solo sonar una vez si procesó en bloque
        }
        setJobs(prev => prev.map(x => x.id === j.id ? { ...x, state: 'completado' } : x));
        toast(`La IA ha terminado de procesar ${j.name}`, 'ok');
      }
    });
  }, [orders, jobs, matched, toast]);

  if (role === 'viewer') return <Navigate to="/" replace />;

  return (
    <>
      <div className="page-head">
        <h1>Subir órdenes de compra</h1>
        <p>
          Arrastra los PDFs aquí. Se guardan en <code>{PATHS.uploadsPrefix}/</code> y una Cloud
          Function los lee con Gemini para sacar folio y kilos. Si el PDF viene ilegible, la orden
          queda marcada para captura manual en vez de perderse.
        </p>
      </div>

      <div
        className={`dropzone ${dragging ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div className="dz-icon">⭱</div>
        <div className="dz-title">Suelta aquí tus PDFs</div>
        <div className="dz-sub">o haz clic para elegirlos · máximo {MAX_MB} MB por archivo</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <Card title="Archivos de esta sesión" hint={`${jobs.length}`}>
        {jobs.length === 0 ? (
          <Empty>Todavía no has subido nada en esta sesión.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Archivo</th><th>Avance</th><th>Folio detectado</th>
                  <th className="num">Kilos</th><th className="num">Neto</th><th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const order = matched(j.path);
                  return (
                    <tr key={j.id}>
                      <td>{j.name}</td>
                      <td style={{ minWidth: 150 }}>
                        {j.state === 'error' ? (
                          <span className="badge b-bad">Error</span>
                        ) : (
                          <div className="progress">
                            <div className="progress-fill" style={{ width: `${j.progress}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="mono">{order?.folio ?? '—'}</td>
                      <td className="num mono">
                        {order?.totalKilograms ? kilos(order.totalKilograms) : '—'}
                      </td>
                      <td className="num mono">
                        {order?.financials ? money(order.financials.netCashFlow) : '—'}
                      </td>
                      <td>
                        {order ? (
                          <StatusBadge status={order.creditCycle?.status ?? 'pending'} />
                        ) : j.state === 'error' ? (
                          <span className="hint">{j.error}</span>
                        ) : (
                          <span className="badge b-mute">
                            <span className="spinner sm" /> procesando
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Últimas órdenes procesadas">
        {orders.length === 0 ? (
          <Empty>Aún no hay órdenes en la base de datos.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Procesada</th><th>Folio</th><th className="num">Kilos</th>
                  <th className="num">Neto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{fmtDateTime(o.processedAt)}</td>
                    <td className="mono">{o.folio ?? '—'}</td>
                    <td className="num mono">{o.totalKilograms ? kilos(o.totalKilograms) : '—'}</td>
                    <td className="num mono">{money(o.financials?.netCashFlow)}</td>
                    <td><StatusBadge status={o.creditCycle?.status ?? 'pending'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
