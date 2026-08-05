import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { logAction } from '../lib/logger';
import { Card, Empty, Spinner } from '../components/ui';

/**
 * OrdersContext filtra TODOS los expedientes con isDeleted=true desde la
 * raiz (context/OrdersContext.tsx) -- por diseño, para que no aparezcan
 * en ninguna pantalla normal. Pero eso significa que el boton "Restaurar
 * Expediente" (en el modal de edicion) es inalcanzable: no hay forma de
 * ABRIR un expediente que no aparece en ninguna lista ni busqueda. Esta
 * pantalla hace su propia consulta, aparte, sin ese filtro, solo para
 * encontrar y restaurar expedientes eliminados por accidente.
 */
export default function Papelera() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const q = query(collection(db, PATHS.orders), where('isDeleted', '==', true), limit(100));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast(`No se pudo cargar la papelera: ${(e as Error).message}`, 'bad');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restaurar(item: any) {
    if (!window.confirm(`¿Restaurar el expediente ${item.folio ?? item.oc ?? '(sin folio)'}? Volverá a aparecer en todas las pantallas.`)) return;
    setBusyId(item.id);
    try {
      await updateDoc(doc(db, PATHS.orders, item.id), {
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        deletedBy: deleteField(),
      });
      logAction(user?.email, 'Expediente Restaurado (Papelera)', { orderId: item.id, folio: item.folio ?? '' });
      toast('Expediente restaurado', 'ok');
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e) {
      toast(`No se pudo restaurar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <Card title="🗑️ Papelera — Expedientes Eliminados">
      <p className="hint" style={{ marginBottom: 16 }}>
        Los expedientes eliminados no aparecen en ninguna otra pantalla del sistema.
        Aquí puedes encontrarlos y restaurarlos si se eliminaron por accidente.
      </p>
      {items.length === 0 ? (
        <Empty>La papelera está vacía.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--paper-raised)',
            }}>
              <div>
                <strong className="mono">{item.folio || item.oc || '(sin folio)'}</strong>
                <div className="hint" style={{ fontSize: 13 }}>
                  Cliente: {item.client || '—'} · Eliminado por {item.deletedBy || '—'}
                  {item.deletedAt?.toDate && ` el ${item.deletedAt.toDate().toLocaleString('es-MX')}`}
                </div>
              </div>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--ok)', borderColor: 'var(--ok)' }}
                onClick={() => void restaurar(item)}
                disabled={busyId === item.id}
              >
                {busyId === item.id ? <span className="spinner" style={{ marginRight: 8 }}></span> : '↩️ '} Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
