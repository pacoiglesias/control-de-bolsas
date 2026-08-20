import { useState, useMemo } from 'react';
import { doc, Timestamp, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { camposInvoices, aplicarPorId } from '../../lib/invoiceOps';
import type { Invoice } from '../../lib/types';
import { Modal } from '../ui';
import type { PurchaseOrder } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import { confirmDialog } from '../../lib/confirmDialog';

export function QuickPayModal({ orders, onClose }: { orders: any[]; onClose: () => void }) {
  const toast = useToast();

  const pendingInvoices = useMemo(() => {
    const list: { order: PurchaseOrder, inv: any, cr: string }[] = [];
    orders.forEach(o => {
      if (o.isClosedShort || o.client === 'MIGRACION') return;
      (o.invoices || []).forEach((inv: any) => {
        const cr = extractCr(inv, o);
        const st = inv.creditCycle?.status;
        if ((st === 'pending' || st === 'overdue') && cr) {
          list.push({ order: o, inv, cr });
        }
      });
    });
    return list;
  }, [orders]);

  const [saving, setSaving] = useState(false);

  const handlePay = async (item: { order: PurchaseOrder, inv: any, cr: string }) => {
    if (!(await confirmDialog(`¿Confirmas que el cliente YA PAGÓ la factura ${item.inv.folio}? Pasará al Contador.`))) return;

    setSaving(true);
    try {
      const { order, inv } = item;

      // FIX: antes se armaba `updatedInvoices` a partir de `order.invoices`
      // (copia capturada al abrir el modal) y se escribia con updateDoc sin
      // transaccion -- si otra factura del mismo expediente cambiaba
      // mientras el modal estaba abierto, ese cambio se perdia al
      // sobrescribir todo el arreglo. Ahora relee el expediente real dentro
      // de una transaccion y solo toca esta factura por id.
      const orderRef = doc(db, PATHS.orders, order.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) throw new Error('El expediente ya no existe');
        const actuales: Invoice[] = snap.data().invoices ?? [];
        const nuevas = aplicarPorId(actuales, inv.id, (x) => ({
          ...x,
          creditCycle: { ...x.creditCycle, status: 'paid' },
          collection: {
            ...x.collection,
            paidAt: Timestamp.now(),
            paidAmount: x.financials?.invoiceTotal ?? x.financials?.saleTotal ?? 0,
          },
        }));
        if (!nuevas) throw new Error('La factura ya no está en el expediente');
        tx.update(orderRef, camposInvoices(nuevas));
      });

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
