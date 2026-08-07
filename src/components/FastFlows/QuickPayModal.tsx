import { useState, useMemo } from 'react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { camposInvoices } from '../../lib/invoiceOps';
import { Modal } from '../ui';
import type { PurchaseOrder } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';

export function QuickPayModal({ orders, onClose }: { orders: any[]; onClose: () => void }) {
  const toast = useToast();

  const pendingInvoices = useMemo(() => {
    const list: { order: PurchaseOrder, inv: any, cr: string }[] = [];
    orders.forEach(o => {
      (o.invoices || []).forEach((inv: any) => {
        const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
        if ((inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') && cr) {
          list.push({ order: o, inv, cr });
        }
      });
    });
    return list;
  }, [orders]);

  const [saving, setSaving] = useState(false);

  const handlePay = async (item: { order: PurchaseOrder, inv: any, cr: string }) => {
    if (!window.confirm(`¿Confirmas que el cliente YA PAGÓ la factura ${item.inv.folio}? Pasará al Contador.`)) return;

    setSaving(true);
    try {
      const { order, inv } = item;
      
      const updatedInv = {
        ...inv,
        creditCycle: {
          ...inv.creditCycle,
          status: 'paid',
        },
        collection: {
          ...inv.collection,
          paidAt: Timestamp.now(),
          paidAmount: inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0
        }
      };

      const updatedInvoices = order.invoices?.map((i: any) => i.id === inv.id ? updatedInv : i) || [];
      await updateDoc(doc(db, PATHS.orders, order.id), camposInvoices(updatedInvoices));

      toast('💸 Cobro registrado. Ahora el contador tiene el dinero.', 'ok');
      if (pendingInvoices.length === 1) onClose(); // Auto-close if it was the last one
    } catch (e: any) {
      toast(`Error al cobrar: ${e.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="💸 Cobro Rápido (Cliente → Contador)" onClose={onClose} wide>
      <div style={{ padding: 20 }}>
        <p style={{ color: 'var(--ink-soft)', marginBottom: 20, fontSize: 14 }}>
          Lista de facturas con Contrarecibo asignado que el cliente acaba de pagar. Al registrar el cobro, pasarán a la bandeja del Contador.
        </p>

        {pendingInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>
            No hay facturas pendientes por cobrar con Contrarecibo asignado.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>CR</th>
                  <th>Cliente</th>
                  <th className="num">Monto a Cobrar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map(x => {
                  const amt = x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0;
                  return (
                    <tr key={x.inv.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>{x.inv.folio || x.order.folio || 'S/N'}</td>
                      <td className="mono">{x.cr}</td>
                      <td>{nombreClienteVisible(x.order.client)}</td>
                      <td className="num mono" style={{ fontWeight: 800, color: 'var(--ink)' }}>{money(amt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => handlePay(x)}
                          disabled={saving}
                        >
                          Cobrar 💸
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
