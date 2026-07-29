import { useState } from 'react';
import { doc, collection, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { usePurchases } from '../hooks/usePurchases';
import { Card, Empty, Field, Modal, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDate, kilos, money, toInputDate, fromInputDate } from '../lib/format';
import type { Purchase, PurchaseStatus } from '../lib/types';

export default function Compras() {
  const { role } = useAuth();
  const { purchases, loading, error } = usePurchases();
  const [selected, setSelected] = useState<Purchase | null>(null);

  if (loading) return <Spinner />;
  if (role !== 'admin') return <Navigate to="/" replace />;
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
        <Card title={deuda < 0 ? 'Saldo a Favor (Anticipos)' : 'Deuda Global al Fabricante'}>
          <div className="num" style={{ fontSize: 24, color: deuda < 0 ? 'var(--info)' : 'var(--bad)' }}>
            {deuda < 0 ? `+ ${money(Math.abs(deuda))}` : money(deuda)}
          </div>
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
                      <td className="num mono" style={{ color: d > 0 ? 'var(--bad)' : (d < 0 ? 'var(--info)' : 'var(--ok)') }}>
                        {d < 0 ? `+ ${money(Math.abs(d))}` : money(d)}
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
  const { user } = useAuth();
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
    items: purchase.items ?? [],
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const expectedNum = form.items.length > 0 
    ? form.items.reduce((acc, it) => acc + (it.unit.toLowerCase() === 'kg' ? it.quantity : 0), 0)
    : (Number(form.expectedKilos) || 0);
  const priceNum = Number(form.pricePerKg) || 0;
  const totalAmount = form.items.length > 0
    ? form.items.reduce((acc, it) => acc + it.amount, 0)
    : (expectedNum * priceNum);

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
        items: form.items,
        createdAt: purchase.createdAt ?? serverTimestamp(),
      }, { merge: true });
      await logAction(user?.email, purchase.createdAt ? 'Compra Editada' : 'Compra Creada', {
        id: purchase.id,
        provider: form.provider.trim(),
        totalAmount
      });
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
      await logAction(user?.email, 'Compra Eliminada', {
        id: purchase.id,
        provider: purchase.provider,
        totalAmount: purchase.totalAmount
      });
      toast('Borrado', 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={purchase.createdAt ? 'Editar compra' : 'Nueva compra'} onClose={onClose} wide>
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
      
      {/* Submenú de Productos */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 14 }}>Productos a Surtir</h4>
          <button className="btn" type="button" onClick={() => set('items', [...form.items, { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'kg', unitPrice: 0, amount: 0 }])}>
            + Agregar Producto
          </button>
        </div>
        {form.items.length > 0 && (
          <div className="table-scroll">
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Cant.</th>
                  <th>U.M.</th>
                  <th>Descripción</th>
                  <th className="num">P. Unit</th>
                  <th className="num">Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ padding: '6px 8px' }}><input className="input boxed mono" type="number" style={{ width: 70 }} value={item.quantity} onChange={e => {
                      const newItems = [...form.items];
                      newItems[i].quantity = Number(e.target.value);
                      newItems[i].amount = newItems[i].quantity * newItems[i].unitPrice;
                      set('items', newItems);
                    }} /></td>
                    <td style={{ padding: '6px 8px' }}><input className="input boxed" style={{ width: 60 }} value={item.unit} onChange={e => {
                      const newItems = [...form.items];
                      newItems[i].unit = e.target.value;
                      set('items', newItems);
                    }} /></td>
                    <td style={{ padding: '6px 8px' }}><input className="input boxed" style={{ width: '100%', minWidth: 200 }} value={item.description} onChange={e => {
                      const newItems = [...form.items];
                      newItems[i].description = e.target.value;
                      set('items', newItems);
                    }} /></td>
                    <td style={{ padding: '6px 8px' }}><input className="input boxed mono" type="number" style={{ width: 85 }} value={item.unitPrice} onChange={e => {
                      const newItems = [...form.items];
                      newItems[i].unitPrice = Number(e.target.value);
                      newItems[i].amount = newItems[i].quantity * newItems[i].unitPrice;
                      set('items', newItems);
                    }} /></td>
                    <td className="num mono" style={{ padding: '6px 8px' }}>{money(item.amount)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}><button type="button" className="btn-icon" onClick={() => set('items', form.items.filter(x => x.id !== item.id))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="calc-box" style={{ marginTop: 12 }}>
        <div className="calc-line total">
          <span>{form.items.length > 0 ? `Costo Total de ${form.items.length} productos (Kilos: ${kilos(expectedNum)})` : `Costo Total Esperado (${kilos(expectedNum)} × ${money(priceNum)})`}</span>
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
