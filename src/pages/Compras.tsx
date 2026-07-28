import { useState } from 'react';
import { doc, collection, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { usePurchases } from '../hooks/usePurchases';
import { Card, Empty, Field, Modal, Spinner, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtDate, kilos, money, toInputDate, fromInputDate } from '../lib/format';
import type { Purchase, PurchaseStatus } from '../lib/types';

export default function Compras() {
  const { purchases, loading, error } = usePurchases();
  const [selected, setSelected] = useState<Purchase | null>(null);

  if (loading) return <Spinner />;
  if (error) return <div className="alert bad">{error}</div>;

  const pendientesKilos = purchases.reduce((acc, p) => acc + (p.expectedKilos - p.receivedKilos), 0);
  const deuda = purchases.reduce((acc, p) => acc + (p.totalAmount - p.paidAmount), 0);

  return (
    <>
      <div className="page-head">
        <h1>Compras al Fabricante</h1>
        <p>Control de pedidos a proveedores, anticipos, recepciones parciales y saldos.</p>
      </div>

      <div className="kpi-grid">
        <Card title="Kilos pendientes de entrega">
          <div className="num" style={{ fontSize: 24 }}>{kilos(pendientesKilos)}</div>
        </Card>
        <Card title="Saldo pendiente por pagar">
          <div className="num" style={{ fontSize: 24, color: 'var(--bad)' }}>{money(deuda)}</div>
        </Card>
      </div>

      <Card
        actions={
          <>
            <button className="btn btn-primary no-print" onClick={() => setSelected({
              id: doc(collection(db, PATHS.purchases)).id,
              date: Timestamp.fromDate(new Date()),
              provider: 'Andres',
              expectedKilos: 0,
              receivedKilos: 0,
              pricePerKg: 42,
              totalAmount: 0,
              paidAmount: 0,
              status: 'pedido',
              createdAt: null,
            } as Purchase)}>
              + Nuevo Pedido al Fabricante
            </button>
            <span className="spacer" />
            <button className="btn no-print" onClick={() => window.print()}>🖨️ Imprimir</button>
          </>
        }
        title="Historial de Compras"
      >
        {purchases.length === 0 ? (
          <Empty>No hay compras registradas.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th className="num">Kilos Pedidos</th>
                  <th className="num">Kilos Entregados</th>
                  <th className="num">Costo Total</th>
                  <th className="num">Pagado (Anticipo)</th>
                  <th className="num">Deuda</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const d = p.totalAmount - p.paidAmount;
                  return (
                    <tr key={p.id} onClick={() => setSelected(p)} style={{ cursor: 'pointer' }}>
                      <td className="mono">{fmtDate(p.date)}</td>
                      <td>{p.provider}</td>
                      <td className="num mono">{kilos(p.expectedKilos)}</td>
                      <td className="num mono">{kilos(p.receivedKilos)}</td>
                      <td className="num mono">{money(p.totalAmount)}</td>
                      <td className="num mono">{money(p.paidAmount)}</td>
                      <td className="num mono" style={{ color: d > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                        {money(d)}
                      </td>
                      <td>
                        <StatusBadge status={p.status === 'pedido' ? 'pending' : p.status === 'parcial' ? 'manual_review' : 'paid'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <PurchaseModal purchase={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function PurchaseModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: toInputDate(purchase.date),
    provider: purchase.provider,
    expectedKilos: String(purchase.expectedKilos || ''),
    receivedKilos: String(purchase.receivedKilos || ''),
    pricePerKg: String(purchase.pricePerKg || '42'),
    paidAmount: String(purchase.paidAmount || ''),
    status: purchase.status,
    notes: purchase.notes ?? '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const expectedNum = Number(form.expectedKilos) || 0;
  const priceNum = Number(form.pricePerKg) || 0;
  const totalAmount = expectedNum * priceNum;

  async function save() {
    if (expectedNum <= 0) return toast('Kilos inválidos', 'bad');

    setBusy(true);
    try {
      const d = fromInputDate(form.date) ?? new Date();
      await setDoc(doc(db, PATHS.purchases, purchase.id), {
        date: Timestamp.fromDate(d),
        provider: form.provider.trim(),
        expectedKilos: expectedNum,
        receivedKilos: Number(form.receivedKilos) || 0,
        pricePerKg: priceNum,
        totalAmount,
        paidAmount: Number(form.paidAmount) || 0,
        status: form.status,
        notes: form.notes.trim(),
        createdAt: purchase.createdAt ?? serverTimestamp(),
      }, { merge: true });
      toast('Guardado', 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('¿Borrar este pedido de compra?')) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, PATHS.purchases, purchase.id));
      toast('Borrado', 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={purchase.createdAt ? 'Editar compra' : 'Nueva compra'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Fecha">
          <input className="input boxed mono" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Proveedor">
          <input className="input boxed" value={form.provider} onChange={(e) => set('provider', e.target.value)} />
        </Field>
        <Field label="Kilos Pedidos (Esperados)">
          <input className="input boxed mono" type="number" step="0.01" value={form.expectedKilos} onChange={(e) => set('expectedKilos', e.target.value)} />
        </Field>
        <Field label="Kilos Recibidos (Entregas parciales)">
          <input className="input boxed mono" type="number" step="0.01" value={form.receivedKilos} onChange={(e) => set('receivedKilos', e.target.value)} />
        </Field>
        <Field label="Precio Costo por Kg">
          <input className="input boxed mono" type="number" step="0.01" value={form.pricePerKg} onChange={(e) => set('pricePerKg', e.target.value)} />
        </Field>
        <Field label="Anticipos o Pagos (Abonado)">
          <input className="input boxed mono" type="number" step="0.01" value={form.paidAmount} onChange={(e) => set('paidAmount', e.target.value)} />
        </Field>
        <Field label="Estado">
          <select className="input boxed" value={form.status} onChange={(e) => set('status', e.target.value as PurchaseStatus)}>
            <option value="pedido">Pedido</option>
            <option value="parcial">Entrega Parcial</option>
            <option value="entregado">Entregado Completo</option>
          </select>
        </Field>
        <Field label="Notas" full>
          <textarea className="input boxed" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      
      <div className="calc-box" style={{ marginTop: 12 }}>
        <div className="calc-line total">
          <span>Costo Total Esperado ({kilos(expectedNum)} × {money(priceNum)})</span>
          <span className="mono">{money(totalAmount)}</span>
        </div>
      </div>

      <div className="modal-actions" style={{ marginTop: 24 }}>
        {purchase.createdAt && (
          <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>Eliminar</button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  );
}
