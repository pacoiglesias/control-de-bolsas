import { useState } from 'react';
import { doc, collection, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useExpenses } from '../hooks/useExpenses';
import { useOrders } from '../hooks/useOrders';
import { Card, Empty, Field, Drawer, Skeleton } from '../components/ui';
import { CurrencyInput } from '../components/CurrencyInput';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { usePurchases } from '../hooks/usePurchases';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDate, money, toInputDate, fromInputDate, exportToCsv, getPrintHeaderHtml, shareHtmlAsPdf } from '../lib/format';
import { computeCommissionFromInvoiceTotal, normalizarTexto } from '../lib/finance';
import type { Expense } from '../lib/types';
import { safeDeleteDoc } from '../lib/logger';
import { motion } from 'framer-motion';
import { useUndo } from '../context/UndoContext';

export default function CajaChica() {
  const { role } = useAuth();
  const { expenses, loading, error } = useExpenses();
  const { orders } = useOrders();
  const { purchases: allPurchases } = usePurchases();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const [selected, setSelected] = useState<Expense | null>(null);



  const saldo = expenses.reduce((acc, e) => {
    return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
  }, 0);

  // Calc deuda real con el proveedor
  const provName = settings?.providerName || 'Andrés';
  // ANTES: "provPurchases" no filtraba por proveedor pese al nombre --
  // era TODAS las compras del sistema, de cualquier proveedor. Una sola
  // compra registrada para otro caso (o con acento distinto en el nombre)
  // inflaba esta tarjeta sin relacion real con Andres.
  const provPurchases = allPurchases.filter(p => normalizarTexto(p.provider) === normalizarTexto(provName));
  const totalReceivedKilos = provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0);
  const currentCostPerKg = config?.costPricePerKg || 42;
  const totalPurchasesCost = Number((totalReceivedKilos * currentCostPerKg).toFixed(2));
  
  const provExpenses = expenses.filter(e => normalizarTexto(e.provider) === normalizarTexto(provName));
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
        const totalFactura = inv.financials?.invoiceTotal ?? ((inv.kilos ?? 0) * (config?.salePricePerKg ?? 43) * (1 + (config?.ivaRate ?? 0.16)));
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

  if (loading) {
    return (
      <>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 220, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: '55%', height: 16 }} />
        </div>
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 90 }} />)}
        </div>
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 52, marginBottom: 8 }} />)}
      </>
    );
  }
  if (role !== 'admin') return <Navigate to="/" replace />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>CAJA</h1>
        <p>Control de efectivo, comisiones contables y gastos diversos.</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="kpi-grid" 
        style={{ marginBottom: 32 }}
      >
        <Card title="💰 SALDO EN CAJA">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <div className="num" style={{ fontSize: 42, fontWeight: 800, color: saldo < 0 ? 'var(--bad)' : 'var(--ok)', letterSpacing: '-1px' }}>
                {money(saldo)}
              </div>
              <p className="hint" style={{ marginTop: 8, marginBottom: 0, fontSize: 14 }}>Efectivo físico disponible en caja actualmente.</p>
            </div>
          </div>
        </Card>
        
        <Card title="🚚 DINERO EN TRÁNSITO">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <div className="num" style={{ fontSize: 42, fontWeight: 800, color: dineroEnTransito > 0 ? 'var(--warn)' : 'var(--ink)', letterSpacing: '-1px' }}>
                {money(dineroEnTransito)}
              </div>
              <p className="hint" style={{ marginTop: 8, marginBottom: 16, fontSize: 14 }}>Cobrado por los contadores, pendiente de entregar a caja.</p>
            </div>
            <motion.button 
              whileHover={dineroEnTransito > 0 ? { scale: 1.02 } : {}}
              whileTap={dineroEnTransito > 0 ? { scale: 0.98 } : {}}
              className="btn btn-primary" 
              style={{ 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'center', 
                background: dineroEnTransito > 0 ? 'var(--warn)' : 'var(--bg-inset)', 
                borderColor: dineroEnTransito > 0 ? 'var(--warn)' : 'var(--border)', 
                color: dineroEnTransito > 0 ? '#000' : 'var(--hint)', 
                fontWeight: 'bold',
                cursor: dineroEnTransito > 0 ? 'pointer' : 'not-allowed',
                opacity: dineroEnTransito > 0 ? 1 : 0.6
              }} 
              disabled={dineroEnTransito <= 0}
              onClick={() => setSelected({
                id: doc(collection(db, PATHS.expenses)).id,
                date: Timestamp.fromDate(new Date()),
                concept: 'Recolección de Contabilidad',
                amount: dineroEnTransito,
                type: 'ingreso',
                createdAt: null,
              } as Expense)}
            >
              📥 {dineroEnTransito > 0 ? 'Recolectar Efectivo a Caja' : 'Nada por recolectar'}
            </motion.button>
          </div>
        </Card>

        <Card title={`⚖️ ESTADO CON ${provName.toUpperCase()}`}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <div className="num" style={{ fontSize: 42, fontWeight: 800, color: saldoProveedor < 0 ? 'var(--bad)' : saldoProveedor > 0 ? 'var(--ok)' : 'var(--ink)', letterSpacing: '-1px' }}>
                {saldoProveedor < 0 ? '-' : '+'}{money(Math.abs(saldoProveedor))}
              </div>
              <p className="hint" style={{ marginTop: 8, marginBottom: 8, fontSize: 14 }}>
                {saldoProveedor < 0 ? `Deuda activa (Total a pagar a ${provName}).` : saldoProveedor > 0 ? `Saldo a favor (${provName} te debe).` : 'Cuentas completamente saldadas.'}
              </p>
            </div>
            <div style={{ fontSize: 11, color: 'var(--hint)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, marginBottom: 12 }}>
               Fórmula: <strong>Pagado</strong> ({money(totalPagado)}) - <strong>Compras</strong> ({money(totalPurchasesCost)}) + <strong>Histórico</strong> ({money(deudaHistorica)})
            </div>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary" 
              style={{ 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'center', 
                background: saldoProveedor < 0 ? 'var(--bad)' : '#0ea5e9', 
                borderColor: saldoProveedor < 0 ? 'var(--bad)' : '#0ea5e9', 
                color: '#fff', 
                fontWeight: 'bold' 
              }} 
              onClick={() => setSelected({
                id: doc(collection(db, PATHS.expenses)).id,
                date: Timestamp.fromDate(new Date()),
                concept: saldoProveedor < 0 ? `Abono a ${provName}` : `Anticipo a ${provName}`,
                provider: provName,
                amount: saldoProveedor < 0 ? Math.abs(saldoProveedor) : 0,
                type: 'egreso',
                createdAt: null,
              } as Expense)}
            >
              {saldoProveedor < 0 ? '💸 Pagar Deuda Exacta' : '💸 Dar Anticipo / Pago a Cuenta'}
            </motion.button>
          </div>
        </Card>
      </motion.div>

      {(() => {
        // Cobros donde lo que realmente entro a Caja fue distinto de lo
        // calculado (comision configurada vs comision real que aplico el
        // contador). Antes esto nunca se registraba -- el sistema
        // guardaba el monto calculado como si fuera el real, sin poder
        // detectar el patron.
        const conDiferencia = expenses.filter((e: any) => typeof e.diferencia === 'number' && Math.abs(e.diferencia) > 0.01);
        if (conDiferencia.length === 0) return null;
        const totalDiferencia = conDiferencia.reduce((a: number, e: any) => a + e.diferencia, 0);
        return (
          <Card title="⚖️ Esperado vs. Real — Diferencias en Cobros">
            <p className="hint" style={{ marginBottom: 12 }}>
              Cada vez que confirmas "Recibida del Contador", comparamos lo calculado contra lo que realmente escribiste que llegó.
              {totalDiferencia !== 0 && (
                <> Acumulado: <strong style={{ color: totalDiferencia > 0 ? 'var(--ok)' : 'var(--bad)' }}>{totalDiferencia > 0 ? '+' : ''}{money(totalDiferencia)}</strong></>
              )}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {conDiferencia.map((e: any) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 10px', background: 'var(--paper-sunk)', borderRadius: 6 }}>
                  <span>{e.concept}</span>
                  <span>Esperado: {money(e.montoEsperado)}</span>
                  <span>Real: {money(e.montoReal)}</span>
                  <strong style={{ color: e.diferencia > 0 ? 'var(--ok)' : 'var(--bad)' }}>
                    {e.diferencia > 0 ? '+' : ''}{money(e.diferencia)}
                  </strong>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      <Card
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn no-print" style={{ background: '#047857', color: 'white', borderColor: '#047857', fontWeight: 600 }} onClick={() => setSelected({
              id: doc(collection(db, PATHS.expenses)).id,
              date: Timestamp.fromDate(new Date()),
              concept: '',
              amount: 0,
              type: 'ingreso',
              createdAt: null,
            } as Expense)}>
              ➕ Ingreso
            </button>
            <button className="btn no-print" style={{ background: '#b91c1c', color: 'white', borderColor: '#b91c1c', fontWeight: 600 }} onClick={() => setSelected({
              id: doc(collection(db, PATHS.expenses)).id,
              date: Timestamp.fromDate(new Date()),
              concept: '',
              amount: 0,
              type: 'egreso',
              createdAt: null,
            } as Expense)}>
              ➖ Egreso
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
            {expenses.map((e, index) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                key={e.id} 
                onClick={() => setSelected(e)} 
                style={{ 
                  background: 'var(--glass-bg)', 
                  border: '1px solid var(--glass-border)',
                  borderRadius: 12, 
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
                whileHover={{ scale: 1.01, boxShadow: '0 8px 15px -3px rgba(0,0,0,0.05)' }}
                whileTap={{ scale: 0.99 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ 
                    width: 44, height: 44, borderRadius: 12, 
                    background: e.type === 'ingreso' ? '#dcfce7' : '#fee2e2',
                    color: e.type === 'ingreso' ? '#166534' : '#991b1b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0
                  }}>
                    {e.type === 'ingreso' ? '📥' : '📤'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>{e.concept}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                      <span className="mono">{fmtDate(e.date)}</span>
                      {e.provider && e.provider.toLowerCase() === provName.toLowerCase() && (
                        <span style={{ marginLeft: 8, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          ● Abono a Proveedor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ 
                  color: e.type === 'ingreso' ? 'var(--ok)' : 'var(--ink)', 
                  fontWeight: 800, 
                  fontSize: 17,
                  textAlign: 'right'
                }}>
                  {e.type === 'ingreso' ? '+' : '-'}{money(e.amount)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <ExpenseDrawer expense={selected} onClose={() => setSelected(null)} provName={provName} />
      )}
    </>
  );
}

function ExpenseDrawer({ expense, onClose, provName }: { expense: Expense; onClose: () => void; provName: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const { executeWithUndo } = useUndo();
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
    executeWithUndo(
      async () => {
        await safeDeleteDoc(user?.email, doc(db, PATHS.expenses, expense.id), expense);
        await logAction(user?.email, 'Gasto Eliminado', {
          id: expense.id,
          concept: expense.concept,
          amount: expense.amount
        });
        onClose();
      },
      async () => {
        const ref = doc(db, PATHS.expenses, expense.id);
        await setDoc(ref, expense);
        await logAction(user?.email, 'Borrado de Gasto Deshecho', { id: expense.id });
      },
      `Movimiento de caja eliminado: ${expense.concept}`
    );
  }

  return (
    <Drawer title={expense.createdAt ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose} width={500}>
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
          <CurrencyInput className="input boxed mono" value={Number(form.amount) || 0} onChange={(val) => set('amount', String(val))} />
        </Field>
        <Field label="Notas adicionales" full>
          <textarea className="input boxed" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <div className="modal-actions" style={{ marginTop: 24 }}>
        {expense.createdAt !== null && (
          <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>Eliminar</button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Drawer>
  );
}
