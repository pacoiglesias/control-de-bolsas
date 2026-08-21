import { useState } from 'react';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { logAction } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { toInputDate, fromInputDate } from '../lib/format';
import type { PurchaseOrder } from '../lib/types';
import { motion } from 'framer-motion';

interface QuickCrModalProps {
  order: PurchaseOrder;
  onClose: () => void;
}

export function QuickCrModal({ order, onClose }: QuickCrModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [crNumber, setCrNumber] = useState(order.collection?.contrareciboNumber || '');
  
  // Fecha sugerida: 30 días a partir de hoy o dueDate actual
  const [dueDate, setDueDate] = useState(() => {
    if (order.creditCycle?.dueDate) {
      return toInputDate(order.creditCycle.dueDate);
    }
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toInputDate(d);
  });

  const [busy, setBusy] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crNumber.trim()) {
      return toast('Ingresa el número de Contrarecibo (ej. TH-842)', 'bad');
    }

    setBusy(true);
    try {
      const orderRef = doc(db, PATHS.orders, order.id);
      const cleanCr = crNumber.trim();
      const rawDate = dueDate ? fromInputDate(dueDate) : null;
      const parsedDueDate = rawDate ? Timestamp.fromDate(rawDate) : null;

      // FIX (auditoría v8.9.5): antes esto mapeaba sobre `order.invoices`
      // (la copia capturada al abrir el modal, potencialmente desactualizada)
      // y escribía con updateDoc sin transacción -- un cambio concurrente a
      // cualquier otra factura de este mismo expediente se perdía al
      // sobrescribir el arreglo completo. Mismo patrón ya usado en
      // QuickCollectionModal/QuickPayModal/QuickInvoiceModal: se relee el
      // expediente real dentro de una transacción justo antes de escribir.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');
        const liveData = snap.data() as PurchaseOrder;

        // Actualizar en el expediente raíz y en cada factura existente sin CR
        const updatedInvoices = (liveData.invoices || []).map((inv) => {
          if (!inv.collection?.contrareciboNumber) {
            return {
              ...inv,
              collection: {
                ...inv.collection,
                contrareciboNumber: cleanCr,
                contrareciboDate: Timestamp.now(),
              },
              creditCycle: {
                ...inv.creditCycle,
                status: inv.creditCycle?.status === 'pedido' || inv.creditCycle?.status === 'facturado' ? 'pending' : inv.creditCycle?.status,
                dueDate: parsedDueDate || inv.creditCycle?.dueDate,
              }
            };
          }
          return inv;
        });

        tx.update(orderRef, {
          'collection.contrareciboNumber': cleanCr,
          'collection.contrareciboDate': Timestamp.now(),
          'creditCycle.status': liveData.creditCycle?.status === 'pedido' || liveData.creditCycle?.status === 'facturado' ? 'pending' : liveData.creditCycle?.status,
          ...(parsedDueDate ? { 'creditCycle.dueDate': parsedDueDate } : {}),
          invoices: updatedInvoices,
          updatedAt: Timestamp.now(),
        });
      });

      logAction(user?.email, 'UPDATE_ORDER', {
        details: `Asignado CR ${cleanCr} a OC ${order.folio || order.oc}`,
        orderId: order.id,
      });

      toast(`✅ Contrarecibo ${cleanCr} asignado correctamente`, 'ok');
      onClose();
    } catch (err: any) {
      toast('Error al guardar Contrarecibo: ' + err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 420,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--ink)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
              Asignar Contrarecibo (CR)
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>
              OC {order.folio || order.oc}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              {order.client || 'Grupo Textil Providencia'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--ink-soft)' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
              Número de Contrarecibo (CR):
            </label>
            <input
              type="text"
              placeholder="Ej. TH-842 o GT-105"
              value={crNumber}
              onChange={(e) => setCrNumber(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 14px',
                fontSize: 16,
                fontWeight: 800,
                borderRadius: 10,
                border: '2px solid #2563eb',
                background: 'var(--paper-sunk)',
                color: 'var(--ink)',
                outline: 'none',
              }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
              Fecha Programada de Pago / Vencimiento:
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--paper-sunk)',
                color: 'var(--ink)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--paper-sunk)',
                color: 'var(--ink)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{
                flex: 2,
                padding: '10px',
                borderRadius: 10,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {busy ? 'Guardando...' : '💾 Guardar CR'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
