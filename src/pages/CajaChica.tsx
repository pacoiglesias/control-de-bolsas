import { useState } from 'react';
import { doc, collection, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useExpenses } from '../hooks/useExpenses';
import { useOrders } from '../hooks/useOrders';
import { Card, Empty, Field, Modal, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { usePurchases } from '../hooks/usePurchases';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDate, money, toInputDate, fromInputDate, exportToCsv, getPrintHeaderHtml, shareHtmlAsPdf } from '../lib/format';
import { computeCommissionFromInvoiceTotal } from '../lib/finance';
import type { Expense } from '../lib/types';
import { safeDeleteDoc } from '../lib/logger';

export default function CajaChica() {
  const { role } = useAuth();
  const { expenses, loading, error } = useExpenses();
  const { orders } = useOrders();
  const { purchases: provPurchases } = usePurchases();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const [selected, setSelected] = useState<Expense | null>(null);

  const saldo = settings?.cajaChicaBalance ?? expenses.reduce((acc, e) => {
    return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
  }, 0);

  // Calc deuda real con el proveedor
  const provName = settings?.providerName || 'Andrés';
  const totalReceivedKilos = provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0);
  const currentCostPerKg = config?.costPricePerKg || 42;
  const totalPurchasesCost = Number((totalReceivedKilos * currentCostPerKg).toFixed(2));
  
  const provExpenses = expenses.filter(e => e.provider?.toLowerCase() === provName.toLowerCase());
  const totalPagado = provExpenses.reduce((acc, e) => {
    if (e.type === 'egreso') return acc + e.amount;
    if (e.type === 'ingreso') return acc - e.amount;
    return acc;
  }, 0);
  
  const deudaHistorica = config?.historicalDebtAndres || 0;
  // Negativo = Deuda (Recibimos mas de lo que pagamos o tenemos deuda historica en negativo)
  // Positivo = Saldo a Favor / Anticipo (Pagamos mas de lo que recibimos)
  const saldoProveedor = totalPagado - totalPurchasesCost + deudaHistorica;

  // Calc dinero en tránsito (estatus 'paid')
  const dineroEnTransito = orders.reduce((acc, o) => {
    if (!o.invoices) return acc;
    return acc + o.invoices.reduce((sum, inv) => {
      if (inv.creditCycle.status === 'paid') {
        const totalFactura = inv.financials?.invoiceTotal ?? ((inv.kilos ?? 0) * (config?.salePricePerKg ?? 47) * (1 + (config?.ivaRate ?? 0.16)));
        const comision = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(totalFactura, config as any);
        return sum + (totalFactura - comision);
      }
      return sum;
    }, 0);
  }, 0);

  function getCajaChicaHtml() {
    const totalIngresos = expenses.filter(e => e.type === 'ingreso').reduce((a, e) => a + e.amount, 0);
    const totalEgresos = expenses.filter(e => e.type === 'egreso').reduce((a, e) => a + e.amount, 0);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte de CAJA - ERP Bolsas Elemental</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Corte de Caja (Ingresos y Egresos)")}

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TOTAL INGRESOS</div><div class="kpi-val" style="color: #047857;">+$${totalIngresos.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">TOTAL EGRESOS</div><div class="kpi-val" style="color: #b91c1c;">-$${totalEgresos.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">SALDO LÍQUIDO EN CAJA</div><div class="kpi-val" style="color: #2563eb;">$${saldo.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Concepto</th><th>Proveedor</th><th>Tipo</th><th class="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map(e => `
                <tr>
                  <td>${fmtDate(e.date) || '—'}</td>
                  <td>${e.concept || '—'}</td>
                  <td>${e.provider || '—'}</td>
                  <td>${e.type === 'ingreso' ? 'Ingreso' : 'Egreso'}</td>
                  <td class="num" style="font-weight:700; color: ${e.type === 'ingreso' ? '#047857' : '#b91c1c'}">
                    ${e.type === 'ingreso' ? '+' : '-'}$${e.amount.toLocaleString('es-MX', {minimumFractionDigits:2})}
                  </td>
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
  }

  function printCajaChicaReport() {
    const html = getCajaChicaHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCajaChicaReport() {
    const html = getCajaChicaHtml();
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CajaChica_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  const toast = useToast();

  function exportCajaChicaCsv() {
    const headers = ['Fecha', 'Concepto', 'Proveedor', 'Tipo', 'Monto'];
    const rows = expenses.map(e => [
      fmtDate(e.date),
      e.concept || '',
      e.provider || '',
      e.type,
      (e.type === 'ingreso' ? e.amount : -e.amount).toFixed(2)
    ]);
    exportToCsv(`CajaChica_Providencia_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('📥 Archivo de Excel (CSV) descargado con éxito.', 'ok');
  }

  if (loading) return <Spinner />;
  if (role !== 'admin') return <Navigate to="/" replace />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>CAJA</h1>
        <p>Control de efectivo, comisiones contables y gastos diversos.</p>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <Card title="💰 SALDO EN CAJA">
          <div className="num" style={{ fontSize: 36, fontWeight: 800, color: saldo < 0 ? 'var(--bad)' : 'var(--ok)' }}>
            {money(saldo)}
          </div>
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>Efectivo disponible actualmente.</p>
        </Card>
        
        <Card title="🚚 DINERO EN TRÁNSITO">
          <div className="num" style={{ fontSize: 36, fontWeight: 800, color: dineroEnTransito > 0 ? 'var(--warn)' : 'var(--ink)' }}>
            {money(dineroEnTransito)}
          </div>
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>En manos de los contadores, listo para recoger.</p>
        </Card>
        <Card title={`⚖️ SALDO CON ${provName.toUpperCase()}`}>
          <div style={{ padding: 16 }}>
            <h2 className={saldoProveedor < 0 ? 'text-bad' : saldoProveedor > 0 ? 'text-ok' : ''}>
              {saldoProveedor < 0 ? '-' : '+'}{money(Math.abs(saldoProveedor))}
            </h2>
            <p className="hint" style={{ marginTop: 8 }}>
            {saldoProveedor < 0 ? `Deuda activa (le debes a ${provName}).` : saldoProveedor > 0 ? `Saldo a tu favor (${provName} te debe bolsas).` : 'Cuentas saldadas.'}
            </p>
          </div>
        </Card>
      </div>

      <Card
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary no-print" onClick={() => setSelected({
              id: doc(collection(db, PATHS.expenses)).id,
              date: Timestamp.fromDate(new Date()),
              concept: '',
              amount: 0,
              type: 'egreso',
              createdAt: null,
            } as Expense)}>
              + Registrar Gasto / Ingreso
            </button>
            <span className="spacer" />
            <button className="btn no-print" onClick={exportCajaChicaCsv}>📥 Exportar Excel (CSV)</button>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareCajaChicaReport}>
                <span className="icon">📤</span> Compartir PDF
              </button>
              <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printCajaChicaReport}>
                📈 Imprimir Reporte de Caja
              </button>
            </div>
          </div>
        }
        title="Movimientos"
        hint={`Saldo actual: ${money(saldo)}`}
      >
        {expenses.length === 0 ? (
          <Empty>No hay movimientos de caja registrados.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Tipo</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} onClick={() => setSelected(e)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{fmtDate(e.date)}</td>
                    <td>
                      {e.concept}
                      {e.provider && e.provider.toLowerCase() === provName.toLowerCase() && (
                        <div style={{ marginTop: 4 }}>
                           <span className="badge" style={{ background: '#3b82f6', color: '#fff' }}>[Abono a Proveedor]</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${e.type === 'ingreso' ? 'b-ok' : 'b-bad'}`}>
                        {e.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="num mono" style={{ color: e.type === 'ingreso' ? 'var(--ok)' : 'var(--bad)' }}>
                      {e.type === 'ingreso' ? '+' : '-'}{money(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <ExpenseModal expense={selected} onClose={() => setSelected(null)} provName={provName} />
      )}
    </>
  );
}

function ExpenseModal({ expense, onClose, provName }: { expense: Expense; onClose: () => void; provName: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: toInputDate(expense.date),
    concept: expense.concept,
    amount: String(expense.amount || ''),
    type: expense.type,
    notes: expense.notes ?? '',
    provider: expense.provider ?? '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.concept.trim()) return toast('Falta concepto', 'bad');
    if (Number(form.amount) <= 0) return toast('Monto inválido', 'bad');

    setBusy(true);
    try {
      const d = fromInputDate(form.date) ?? new Date();
      await setDoc(doc(db, PATHS.expenses, expense.id), {
        date: Timestamp.fromDate(d),
        concept: form.concept.trim(),
        amount: Number(form.amount),
        type: form.type,
        notes: form.notes.trim(),
        provider: form.provider.trim() || null,
        createdAt: expense.createdAt ?? serverTimestamp(),
      }, { merge: true });
      await logAction(user?.email, expense.createdAt ? 'Gasto Editado' : 'Gasto Creado', {
        id: expense.id,
        concept: form.concept.trim(),
        amount: Number(form.amount)
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
    if (!window.confirm('¿Borrar este movimiento?')) return;
    setBusy(true);
    try {
      await safeDeleteDoc(user?.email, doc(db, PATHS.expenses, expense.id), expense);
      await logAction(user?.email, 'Gasto Eliminado', {
        id: expense.id,
        concept: expense.concept,
        amount: expense.amount
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
    <Modal title={expense.createdAt ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <div className="form-grid">
        <Field label="Fecha">
          <input className="input boxed mono" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select className="input boxed" value={form.type} onChange={(e) => set('type', e.target.value as 'ingreso' | 'egreso')}>
            <option value="egreso">Egreso (Gasto)</option>
            <option value="ingreso">Ingreso (Reposición)</option>
          </select>
        </Field>
        <Field label="Concepto (e.g. Gasolina, Papelería)">
          <input className="input boxed" value={form.concept} onChange={(e) => set('concept', e.target.value)} />
        </Field>
        <Field label="Proveedor / Fabricante / Beneficiario">
          <input className="input boxed" value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder={`Ej. ${provName}`} />
        </Field>
        <Field label="Monto">
          <input className="input boxed mono" type="number" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
        </Field>
        <Field label="Notas adicionales" full>
          <textarea className="input boxed" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <div className="modal-actions" style={{ marginTop: 24 }}>
        {expense.createdAt && (
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
