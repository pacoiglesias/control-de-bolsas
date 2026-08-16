import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { camposInvoices } from '../../lib/invoiceOps';
import { playCashRegisterSound } from '../../lib/soundEffects';
import { Modal } from '../ui';
import type { PurchaseOrder } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';

export function QuickCollectionModal({ orders, onClose }: { orders: PurchaseOrder[]; onClose: () => void }) {
  const toast = useToast();
  
  // Facturas pendientes (sin CR asignado)
  const pendingInvoices = useMemo(() => {
    const list: { order: PurchaseOrder, inv: any }[] = [];
    orders.forEach(o => {
      (o.invoices || []).forEach(inv => {
        const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
        if ((inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') && !cr) {
          list.push({ order: o, inv });
        }
      });
    });
    return list;
  }, [orders]);

  const [selectedInvId, setSelectedInvId] = useState<string>('');
  const [cr, setCr] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedData = pendingInvoices.find(x => x.inv.id === selectedInvId);

  const handleAssignCr = async () => {
    if (!selectedData) return;
    if (!cr.trim()) return toast('Falta el número de contrarecibo', 'bad');

    setSaving(true);
    try {
      const { order, inv } = selectedData;
      const updatedInv = {
        ...inv,
        collection: {
          ...inv.collection,
          contrareciboNumber: cr.trim(),
          contrareciboDate: Timestamp.now(),
        }
      };

      const updatedInvoices = order.invoices?.map(i => i.id === inv.id ? updatedInv : i) || [];
      await updateDoc(doc(db, PATHS.orders, order.id), camposInvoices(updatedInvoices));

      playCashRegisterSound();
      toast('🗂️ Contrarecibo asignado. Pasó a "Por Cobrar".', 'ok');
      onClose();
    } catch (e: any) {
      toast(`Error al asignar CR: ${e.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🗂️ Capturar Contrarecibo Rápido" onClose={onClose} wide>
      <div style={{ padding: 20 }}>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 20, fontSize: 14 }}>
          Asigna rápidamente un número de Contrarecibo a una factura emitida para iniciar sus días de crédito.
        </p>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>1. Seleccionar Factura Sin CR</span>
          <select 
            value={selectedInvId} 
            onChange={e => setSelectedInvId(e.target.value)}
            className="input"
            style={{ width: '100%', marginTop: 6 }}
          >
            <option value="">-- Selecciona --</option>
            {pendingInvoices.map(x => {
              const amt = x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0;
              return (
                <option key={x.inv.id} value={x.inv.id}>
                  {x.inv.folio || x.order.folio || 'S/N'} - {nombreClienteVisible(x.order.client)} ({money(amt)})
                </option>
              );
            })}
          </select>
        </label>

        {selectedData && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', padding: 16, borderRadius: 12, border: '1px solid var(--line)', marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>2. Número de Contrarecibo</label>
            <input 
              type="text" 
              value={cr} 
              onChange={e => setCr(e.target.value.toUpperCase())}
              className="input" 
              placeholder="Ej. CR-7890"
              style={{ width: '100%', marginTop: 6, fontSize: 18, fontWeight: 700 }}
              autoFocus
            />
          </motion.div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleAssignCr} disabled={!selectedData || saving || !cr.trim()}>
            {saving ? 'Guardando...' : '🗂️ Asignar CR'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
