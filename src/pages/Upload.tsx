import { useCallback, useRef, useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage, PATHS, db } from '../lib/firebase';
import { useOrders } from '../hooks/useOrders';
import { Card, Empty, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDateTime } from '../lib/format';
import { sound } from '../lib/sounds';
import OrderModal from './OrderModal';
import { useConfig } from '../hooks/useConfig';
interface Job {
  id: string;
  name: string;
  path: string;
  progress: number;
  state: 'subiendo' | 'procesando' | 'error' | 'completado';
  error?: string;
}

// Debe coincidir con MAX_UPLOAD_MB en functions/src/index.ts y con el limite
// de storage.rules. Es el tamano que la IA alcanza a leer.
const MAX_MB = 5;

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
  const { config } = useConfig();
  const toast = useToast();

  const upload = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach(async (file) => {
        if (file.type !== 'application/pdf' && file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
          toast(`${file.name} no es un PDF ni XML, se omitió.`, 'bad');
          return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          toast(`${file.name} pesa más de ${MAX_MB} MB.`, 'bad');
          return;
        }

        // 1. Calcular Hash SHA-256
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Verificar duplicidad en Firestore
        const duplicateQuery = query(collection(db, PATHS.orders), where('fileHash', '==', fileHash));
        const duplicateSnap = await getDocs(duplicateQuery);
        if (!duplicateSnap.empty) {
          toast(`El archivo ${file.name} ya fue subido previamente (Duplicado).`, 'bad');
          return;
        }

        const path = `${PATHS.uploadsPrefix}/${Date.now()}-${safeName(file.name)}`;
        const id = path;
        setJobs((j) => [{ id, name: file.name, path, progress: 0, state: 'subiendo' }, ...j]);

        const task = uploadBytesResumable(ref(storage, path), file, {
          contentType: file.type || (file.name.endsWith('.xml') ? 'text/xml' : 'application/pdf'),
          customMetadata: { fileHash },
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
            toast(`${file.name} subido. Creando expediente…`, 'ok');
          },
        );
      });
    },
    [toast, user?.email],
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

  const manualReviewOrders = orders.filter(o => o.creditCycle?.status === 'manual_review');
  const [tab, setTab] = useState<'upload' | 'review'>('upload');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  if (role === 'viewer') return <Navigate to="/" replace />;

  return (
    <>
      <div className="page-head">
        <h1>Bandeja de Entrada de PDFs</h1>
        <div className="tabs" style={{ marginTop: 10 }}>
          <button className={`tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
            Subir Documentos
          </button>
          <button className={`tab ${tab === 'review' ? 'active' : ''}`} onClick={() => setTab('review')}>
            Bandeja de Revisión {manualReviewOrders.length > 0 && <span className="badge b-bad">{manualReviewOrders.length}</span>}
          </button>
        </div>
      </div>

      {tab === 'upload' ? (
        <>
          <div className="page-head" style={{ marginTop: -20, marginBottom: 20 }}>
            <p>
              Arrastra los PDFs aquí. Se guardan en <code>{PATHS.uploadsPrefix}/</code>. La orden
              queda en tu <strong>Bandeja de Revisión</strong> para que valides los datos y la apruebes manualmente.
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
            <div className="dz-title">Suelta aquí tus PDFs y XMLs</div>
            <div className="dz-sub">o haz clic para elegirlos · máximo {MAX_MB} MB por archivo</div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf, text/xml, .xml"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          <Card title="Archivos subiendo" hint={`${jobs.length}`}>
            {jobs.length === 0 ? (
              <Empty>No hay subidas activas.</Empty>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Archivo</th><th>Avance</th><th>Folio</th>
                      <th>Resultado</th>
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
        </>
      ) : (
        <Card title="Documentos por validar" hint={`${manualReviewOrders.length}`}>
          {manualReviewOrders.length === 0 ? (
            <Empty>No tienes documentos pendientes de revisión.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table selectable">
                <thead>
                  <tr>
                    <th>Fecha Alta</th><th>Archivo</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {manualReviewOrders.map((o) => (
                    <tr key={o.id} onClick={() => setSelectedOrder(o)}>
                      <td className="mono">{fmtDateTime(o.processedAt)}</td>
                      <td className="mono" style={{ color: 'var(--info)' }}>{o.fileName?.split('/').pop() || 'Archivo sin nombre'}</td>
                      <td><StatusBadge status={o.creditCycle?.status ?? 'manual_review'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {selectedOrder && (
        <OrderModal order={selectedOrder} config={config} onClose={() => setSelectedOrder(null)} />
      )}
    </>
  );
}
