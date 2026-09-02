import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { db, PATHS } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { logAction } from '../lib/logger';
import { Card, Empty, Spinner } from '../components/ui';
import { confirmDialog } from '../lib/confirmDialog';
import { triggerHaptic } from '../lib/hapticEngine';
import { fmtDateTime } from '../lib/format';

/**
 * OrdersContext filtra TODOS los expedientes con isDeleted=true desde la
 * raiz (context/OrdersContext.tsx). Esta pantalla hace su propia consulta
 * sin ese filtro para encontrar y restaurar expedientes eliminados.
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
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast(`No se pudo cargar la papelera: ${(e as Error).message}`, 'bad');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function restaurar(item: any) {
    triggerHaptic('light');
    const confirmado = await confirmDialog(
      `¿Restaurar el expediente ${item.folio ?? item.oc ?? '(sin folio)'}? Volverá a aparecer en todas las pantallas y balances.`
    );
    if (!confirmado) return;

    setBusyId(item.id);
    try {
      await updateDoc(doc(db, PATHS.orders, item.id), {
        isDeleted: deleteField(),
        deletedAt: deleteField(),
        deletedBy: deleteField(),
      });
      await logAction(user?.email, 'Expediente Restaurado (Papelera)', { orderId: item.id, folio: item.folio ?? '' });
      triggerHaptic('success');
      toast(`Expediente ${item.folio || item.oc} restaurado con éxito.`, 'ok');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      triggerHaptic('error');
      toast(`No se pudo restaurar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <Card title="🗑️ Papelera de Seguridad — Expedientes Eliminados">
      <div style={{ padding: 18 }}>
        <p className="hint" style={{ marginTop: 0, marginBottom: 20 }}>
          Los expedientes eliminados se conservan en esta bóveda de seguridad sin alterar los balances ni reportes activos. Puedes restaurarlos con un solo clic.
        </p>

        {items.length === 0 ? (
          <Empty>La papelera está vacía. No hay expedientes eliminados.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AnimatePresence>
              {items.map((item) => {
                const deletedDate = item.deletedAt?.toDate ? fmtDateTime(item.deletedAt.toDate()) : 'Fecha no registrada';
                const kilos = item.totalKilograms || (item.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 14,
                      padding: '16px 20px',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                      borderLeft: '4px solid #ef4444',
                      borderRadius: 14,
                      background: 'var(--surface-raised, rgba(255, 255, 255, 0.02))',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong className="mono" style={{ fontSize: 16, color: '#f87171' }}>
                          OC {item.folio || item.oc || '(sin folio)'}
                        </strong>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            textTransform: 'uppercase',
                          }}
                        >
                          ELIMINADO
                        </span>
                        {kilos > 0 && (
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
                            {kilos.toLocaleString('es-MX')} kg
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                        Cliente: <strong style={{ color: 'var(--ink)' }}>{item.client || '—'}</strong> · Eliminado por <strong style={{ color: 'var(--ink)' }}>{item.deletedBy || '—'}</strong> ({deletedDate})
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="btn btn-primary"
                      style={{
                        background: '#059669',
                        borderColor: '#059669',
                        minHeight: 40,
                        padding: '0 18px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                      onClick={() => void restaurar(item)}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? <Spinner /> : '↩️ Restaurar Expediente'}
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Card>
  );
}

