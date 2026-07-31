import { useState } from 'react';
import { doc, collection, setDoc, deleteDoc, serverTimestamp, Timestamp, addDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { usePurchases } from '../hooks/usePurchases';
import { useProducts } from '../hooks/useProducts';
import { useExpenses } from '../hooks/useExpenses';
import { Card, Empty, Field, Modal, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDate, kilos, money, toInputDate, fromInputDate, exportToCsv } from '../lib/format';
import type { Purchase, PurchaseStatus } from '../lib/types';

export default function Compras() {
  const { role } = useAuth();
  const { purchases, loading: loadingP, error: errorP } = usePurchases();
  const { expenses, loading: loadingE, error: errorE } = useExpenses();
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [tab, setTab] = useState<'ordenes' | 'estado'>('ordenes');
  const selectedProvider = 'Andres';
  // Todos los hooks van ANTES de cualquier return condicional. Estaba
  // despues de dos returns tempranos: en el render donde role aun no es
  // 'admin' (llega asincrono de AuthContext) este hook nunca se llamaba, y
  // en el siguiente render, cuando ya lo era, si. React ve un numero
  // distinto de hooks entre renders y revienta el componente.
  const toast = useToast();

  if (loadingP || loadingE) return <Spinner />;
  if (role !== 'admin') return <Navigate to="/" replace />;
  if (errorP || errorE) return <div className="alert bad">{errorP || errorE}</div>;

  // Filtrado por proveedor actual
  const provPurchases = purchases.filter(p => p.provider.toLowerCase() === selectedProvider.toLowerCase());
  const provExpenses = expenses.filter(e => e.provider?.toLowerCase() === selectedProvider.toLowerCase());

  const pendientesKilos = provPurchases.reduce((acc, p) => acc + (p.expectedKilos - p.receivedKilos), 0);
  
  // Cálculo exacto de la deuda basado en el Libro Mayor
  const totalPurchasesCost = provPurchases.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalPagado = provExpenses.reduce((acc, e) => {
    if (e.type === 'egreso') return acc + e.amount; // Le pagamos (abono a la deuda)
    if (e.type === 'ingreso') return acc - e.amount; // Nos devolvió (cargo a la deuda)
    return acc;
  }, 0);
  const deudaReal = totalPurchasesCost - totalPagado;

  // Generación del Libro Mayor Cronológico
  type LedgerEntry = { id: string; date: Timestamp | null; concept: string; cargo: number; abono: number; source: 'purchase' | 'expense' };
  
  const ledger: LedgerEntry[] = [
    ...provPurchases.map(p => ({
      id: p.id,
      date: p.date,
      concept: `Compra de Material`,
      cargo: p.totalAmount, // Sube la deuda
      abono: 0,
      source: 'purchase' as const
    })),
    ...provExpenses.map(e => ({
      id: e.id,
      date: e.date,
      concept: e.concept,
      cargo: e.type === 'ingreso' ? e.amount : 0, 
      abono: e.type === 'egreso' ? e.amount : 0, 
      source: 'expense' as const
    }))
  ];

  const sortedLedger = ledger.sort((a, b) => (a.date?.toMillis() ?? 0) - (b.date?.toMillis() ?? 0));

  function exportComprasCsv() {
    const headers = ['Fecha', 'Concepto', 'Cargo (Material Sube Deuda)', 'Abono (Pagos / Adelantos)', 'Origen'];
    const rows = sortedLedger.map(e => [
      fmtDate(e.date),
      e.concept,
      e.cargo ? e.cargo.toFixed(2) : '0.00',
      e.abono ? e.abono.toFixed(2) : '0.00',
      e.source === 'purchase' ? 'Compra Material' : 'Caja Chica (Adelanto)'
    ]);
    exportToCsv(`Estado_Cuenta_Andres_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('📥 Archivo de Excel (CSV) descargado con éxito.', 'ok');
  }

  function printComprasReport() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Estado de Cuenta Proveedor - Andrés</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111; font-size: 12px; }
            .header { border-bottom: 3px solid #b45309; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 20px; color: #b45309; }
            .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .kpi { background: #fffbeb; border: 1px solid #fde68a; padding: 10px; border-radius: 4px; }
            .kpi-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #92400e; }
            .kpi-val { font-size: 16px; font-weight: 800; color: #78350f; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
            th { background: #fef3c7; font-weight: 700; }
            .num { text-align: right; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Estado de Cuenta Proveedor: Andrés</h1>
              <div>Control Bolsas ERP · Grupo Textil Providencia</div>
            </div>
            <div>
              <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TOTAL COMPRAS REGISTRADAS</div><div class="kpi-val">$${totalPurchasesCost.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">TOTAL ABONADO / ADELANTOS</div><div class="kpi-val" style="color: #047857;">$${totalPagado.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">SALDO PENDIENTE CON ANDRÉS</div><div class="kpi-val" style="color: ${deudaReal > 0 ? '#b91c1c' : '#047857'};">$${deudaReal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <h3>Libro Mayor Cronológico</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Movimiento / Concepto</th><th class="num">Cargo (+)</th><th class="num">Abono (-)</th>
              </tr>
            </thead>
            <tbody>
              ${sortedLedger.map(e => `
                <tr>
                  <td>${fmtDate(e.date) || '—'}</td>
                  <td>${e.concept || '—'}</td>
                  <td class="num" style="font-weight:700; color: #b91c1c">${e.cargo ? `$${e.cargo.toLocaleString('es-MX', {minimumFractionDigits:2})}` : '—'}</td>
                  <td class="num" style="font-weight:700; color: #047857">${e.abono ? `$${e.abono.toLocaleString('es-MX', {minimumFractionDigits:2})}` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <>
      <div className="page-head">
        <h1>Compras y Proveedores</h1>
        <p>Control de pedidos a proveedores, anticipos, recepciones parciales y saldos.</p>
        <div className="tabs" style={{ marginTop: 16 }}>
          <button className={tab === 'ordenes' ? 'active' : ''} onClick={() => setTab('ordenes')}>Órdenes de Compra</button>
          <button className={tab === 'estado' ? 'active' : ''} onClick={() => setTab('estado')}>Estado de Cuenta</button>
        </div>
      </div>

      <div className="kpi-grid">
        <Card title={`Kilos pendientes de entregar (${selectedProvider})`}>
          <div className="num" style={{ fontSize: 24 }}>{kilos(pendientesKilos)}</div>
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>Pedido menos lo entregado, sumado de todas las OC abiertas.</p>
        </Card>
        <Card title={`${deudaReal < 0 ? '🟢' : deudaReal > 0 ? '🔴' : '⚪'} Saldo con ${selectedProvider}`}>
          <div className="num" style={{ fontSize: 24, color: deudaReal < 0 ? 'var(--info)' : deudaReal > 0 ? 'var(--bad)' : 'var(--ink)' }}>
            {deudaReal < 0 ? `+ ${money(Math.abs(deudaReal))}` : money(deudaReal)}
          </div>
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>
            {deudaReal < 0
              ? `A tu favor: le pagaste por adelantado más de lo que te ha facturado. Se consume solo, kilo a kilo, en cuanto guardas cada expediente con lo entregado.`
              : deudaReal > 0
                ? `Le debes a ${selectedProvider}: lo que te ha entregado/facturado supera lo que le has pagado.`
                : `Cuenta saldada: lo pagado coincide con lo entregado.`}
          </p>
        </Card>
      </div>

      {tab === 'ordenes' ? (
        <Card
          actions={
            <>
              <button className="btn btn-primary no-print" onClick={() => setSelected({
                id: doc(collection(db, PATHS.purchases)).id,
                date: Timestamp.fromDate(new Date()),
                provider: selectedProvider,
                expectedKilos: 0,
                receivedKilos: 0,
                pricePerKg: 42,
                totalAmount: 0,
                paidAmount: 0,
                status: 'pedido',
                createdAt: null,
                items: [],
              } as unknown as Purchase)}>
                + Nuevo Pedido al Fabricante
              </button>
              <span className="spacer" />
              <button className="btn no-print" onClick={exportComprasCsv}>📥 Exportar Excel (CSV)</button>
              <button className="btn no-print" onClick={printComprasReport}>🖨️ Imprimir Estado de Cuenta (PDF)</button>
            </>
          }
          title="Historial de Compras"
        >
          {provPurchases.length === 0 ? (
            <Empty>No hay compras registradas para {selectedProvider}.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Kilos Pedidos</th>
                    <th className="num">Kilos Entregados</th>
                    <th className="num">Costo Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {provPurchases.map((p) => (
                    <tr key={p.id} onClick={() => setSelected(p)} style={{ cursor: 'pointer' }}>
                      <td className="mono">{fmtDate(p.date)}</td>
                      <td className="num mono">{kilos(p.expectedKilos)}</td>
                      <td className="num mono">{kilos(p.receivedKilos)}</td>
                      <td className="num mono">{money(p.totalAmount)}</td>
                      <td>
                        <StatusBadge status={p.status === 'pedido' ? 'pending' : p.status === 'parcial' ? 'manual_review' : 'paid'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card 
          title={`Estado de Cuenta: ${selectedProvider}`} 
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn no-print" onClick={exportComprasCsv}>📥 Exportar Excel (CSV)</button>
              <button className="btn no-print" onClick={printComprasReport}>🖨️ Imprimir Estado de Cuenta (PDF)</button>
            </div>
          }
        >
          {ledger.length === 0 ? (
            <Empty>No hay movimientos registrados para este proveedor.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th className="num">Cargo (+)</th>
                    <th className="num">Abono (-)</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let runningBalance = 0;
                    return ledger.map((entry, idx) => {
                      runningBalance += (entry.cargo - entry.abono);
                      return (
                        <tr key={entry.id + idx}>
                          <td className="mono">{fmtDate(entry.date)}</td>
                          <td>
                            {entry.concept}
                            {entry.source === 'purchase' && <span className="badge pending" style={{marginLeft: 8}}>Compra</span>}
                          </td>
                          <td className="num mono" style={{ color: entry.cargo > 0 ? 'var(--bad)' : 'inherit' }}>
                            {entry.cargo > 0 ? money(entry.cargo) : '-'}
                          </td>
                          <td className="num mono" style={{ color: entry.abono > 0 ? 'var(--ok)' : 'inherit' }}>
                            {entry.abono > 0 ? money(entry.abono) : '-'}
                          </td>
                          <td className="num mono" style={{ fontWeight: 600 }}>
                            {money(runningBalance)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {selected && (
        <PurchaseModal purchase={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}


function PurchaseModal({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const { products } = useProducts();
  const [busy, setBusy] = useState(false);
  const [creatingCode, setCreatingCode] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: toInputDate(purchase.date),
    provider: purchase.provider,
    expectedKilos: String(purchase.expectedKilos || ''),
    receivedKilos: String(purchase.receivedKilos || ''),
    pricePerKg: String(purchase.pricePerKg || '42'),
    totalAmount: String(purchase.totalAmount || ''),
    paidAmount: String(purchase.paidAmount || ''),
    status: purchase.status,
    notes: purchase.notes ?? '',
    items: purchase.items ?? [],
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  /**
   * Busca el codigo en el catalogo compartido (el mismo que usa OrderModal
   * para las ventas) y autocompleta descripcion, unidad y precio. Antes
   * Compras no tenia ningun campo de codigo: cada renglon era texto libre
   * sin conexion al catalogo, asi que nunca se sabia si "BOLSA 77X55" de una
   * compra era el mismo articulo que "Bolsa Polietileno 77 CM X 55 CM" de
   * una venta.
   */
  function buscarPorCodigo(i: number, code: string) {
    const newItems = [...form.items];
    newItems[i] = { ...newItems[i], code };
    const prod = products.find(p => (p.code ?? '').trim().toLowerCase() === code.trim().toLowerCase());
    if (prod && code.trim()) {
      newItems[i].description = prod.description;
      newItems[i].unit = prod.unit || newItems[i].unit;
      if (!newItems[i].unitPrice) {
        newItems[i].unitPrice = prod.defaultPrice;
        newItems[i].amount = newItems[i].quantity * prod.defaultPrice;
      }
    }
    set('items', newItems);
  }

  async function altaRapidaProducto(i: number) {
    const item = form.items[i];
    const code = (item.code ?? '').trim();
    if (!code) return;
    setCreatingCode(code);
    try {
      await addDoc(collection(db, PATHS.products), {
        code,
        description: item.description || code,
        unit: item.unit || 'kg',
        defaultPrice: item.unitPrice || 0,
        createdAt: serverTimestamp(),
      });
      toast(`Producto ${code} agregado al catálogo.`, 'ok');
    } catch (e) {
      toast(`No se pudo agregar al catálogo: ${(e as Error).message}`, 'bad');
    } finally {
      setCreatingCode(null);
    }
  }

  const expectedNum = form.items.length > 0 
    ? form.items.reduce((acc, it) => acc + (it.unit.toLowerCase() === 'kg' || it.unit.toLowerCase() === 'kilos' ? it.quantity : 0), 0)
    : (Number(form.expectedKilos) || 0);
  const priceNum = Number(form.pricePerKg) || 0;
  const totalAmountCalc = form.items.length > 0
    ? form.items.reduce((acc, it) => acc + it.amount, 0)
    : (Number(form.totalAmount) || 0);

  async function save() {
    if (expectedNum <= 0) return toast('Kilos inválidos', 'bad');

    setBusy(true);
    try {
      const d = fromInputDate(form.date) ?? new Date();
      const newPaidAmount = Number(form.paidAmount) || 0;
      const oldPaidAmount = purchase.paidAmount || 0;
      const diffPaid = newPaidAmount - oldPaidAmount;

      await setDoc(doc(db, PATHS.purchases, purchase.id), {
        date: Timestamp.fromDate(d),
        provider: form.provider.trim(),
        expectedKilos: expectedNum,
        receivedKilos: Number(form.receivedKilos) || 0,
        pricePerKg: priceNum,
        totalAmount: totalAmountCalc,
        paidAmount: newPaidAmount,
        status: form.status,
        notes: form.notes.trim(),
        items: form.items,
        createdAt: purchase.createdAt ?? serverTimestamp(),
      }, { merge: true });
      
      await logAction(user?.email, purchase.createdAt ? 'Compra Editada' : 'Compra Creada', {
        id: purchase.id,
        provider: form.provider.trim(),
        totalAmount: totalAmountCalc
      });

      // Crear egreso en Caja Chica por el nuevo pago/anticipo
      if (diffPaid > 0) {
        try {
          await setDoc(doc(collection(db, PATHS.expenses)), {
            date: Timestamp.now(),
            concept: `Pago/Anticipo a Proveedor ${form.provider.trim()}`,
            amount: diffPaid,
            type: 'egreso',
            notes: `Asociado al registro de compra ID: ${purchase.id}. Costo Total de OC: $${totalAmountCalc.toLocaleString('es-MX', {minimumFractionDigits:2})}`,
            provider: form.provider.trim() || null,
            createdAt: serverTimestamp(),
          });
          toast(`Se ha registrado un Egreso en Caja Chica por $${diffPaid.toLocaleString('es-MX', {minimumFractionDigits:2})} de forma automática.`, 'ok');
        } catch (e) {
          console.error("Error creating expense:", e);
          toast('Compra guardada, pero hubo un error al registrar en Caja Chica.', 'bad');
        }
      } else {
        toast('Guardado', 'ok');
      }
      
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
      <datalist id="catalog-codes">
        {products.filter(p => p.code).map(p => (
          <option key={p.id} value={p.code}>{p.description}</option>
        ))}
      </datalist>
      <div className="form-grid">
        <Field label="Fecha">
          <input className="input boxed mono" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Proveedor">
          <input className="input boxed" value={form.provider} onChange={(e) => set('provider', e.target.value)} />
        </Field>
        <Field label="Kilos Pedidos (Esperados)">
          <input className="input boxed mono" type="number" step="0.01" 
             value={form.items.length > 0 ? expectedNum : form.expectedKilos} 
             disabled={form.items.length > 0}
             onChange={(e) => {
               const kg = e.target.value;
               const total = kg === '' ? '' : String(Number(kg) * Number(form.pricePerKg));
               setForm(f => ({ ...f, expectedKilos: kg, totalAmount: total }));
             }} />
        </Field>
        <Field label="Kilos Recibidos (Entregas parciales)">
          <input className="input boxed mono" type="number" step="0.01" value={form.receivedKilos} onChange={(e) => set('receivedKilos', e.target.value)} />
        </Field>
        <Field label="Precio Costo por Kg">
          <input className="input boxed mono" type="number" step="0.01" 
             value={form.pricePerKg} 
             onChange={(e) => {
               const p = e.target.value;
               const total = p === '' || form.expectedKilos === '' ? '' : String(Number(form.expectedKilos) * Number(p));
               setForm(f => ({ ...f, pricePerKg: p, totalAmount: total }));
             }} />
        </Field>
        <Field label="Costo Total Esperado">
          <input className="input boxed mono" type="number" step="0.01" 
             value={form.items.length > 0 ? totalAmountCalc : form.totalAmount} 
             disabled={form.items.length > 0}
             onChange={(e) => {
               const total = e.target.value;
               const p = Number(form.pricePerKg);
               const kg = total === '' || p === 0 ? '' : String(Number((Number(total) / p).toFixed(2)));
               setForm(f => ({ ...f, totalAmount: total, expectedKilos: kg }));
             }} />
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
          <button className="btn" type="button" onClick={() => set('items', [...form.items, { id: crypto.randomUUID(), code: '', description: '', quantity: 1, unit: 'kg', unitPrice: 0, amount: 0 }])}>
            + Agregar Producto
          </button>
        </div>
        {form.items.length > 0 && (
          <div className="table-scroll">
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cant.</th>
                  <th>U.M.</th>
                  <th>Descripción</th>
                  <th className="num">P. Unit</th>
                  <th className="num">Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => {
                  const code = (item.code ?? '').trim();
                  const enCatalogo = code !== '' && products.some(p => (p.code ?? '').trim().toLowerCase() === code.toLowerCase());
                  return (
                  <tr key={item.id}>
                    <td style={{ padding: '6px 8px' }}>
                      <input
                        className="input boxed mono"
                        style={{ width: 90, borderColor: code === '' ? undefined : (enCatalogo ? 'var(--ok)' : 'var(--warn)') }}
                        list="catalog-codes"
                        value={item.code ?? ''}
                        placeholder="código"
                        onChange={e => buscarPorCodigo(i, e.target.value)}
                      />
                      {code !== '' && !enCatalogo && (
                        <button
                          type="button"
                          className="btn-small btn-warn"
                          style={{ marginTop: 4, fontSize: 10, whiteSpace: 'nowrap' }}
                          disabled={creatingCode === code}
                          onClick={() => void altaRapidaProducto(i)}
                          title="Este código no existe en el catálogo. Agrégalo con un clic."
                        >
                          {creatingCode === code ? 'Agregando…' : '+ Catálogo'}
                        </button>
                      )}
                    </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="calc-box" style={{ marginTop: 12 }}>
        <div className="calc-line total">
          <span>{form.items.length > 0 ? `Costo Total de ${form.items.length} productos (Kilos: ${kilos(expectedNum)})` : `Costo Total Esperado`}</span>
          <span className="mono">{money(totalAmountCalc)}</span>
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
