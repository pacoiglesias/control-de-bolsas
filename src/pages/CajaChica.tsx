import { useState } from 'react';
import { doc, collection, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useExpenses } from '../hooks/useExpenses';
import { Card, Empty, Field, Modal, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDate, money, toInputDate, fromInputDate, exportToCsv } from '../lib/format';
import type { Expense } from '../lib/types';

export default function CajaChica() {
  const { role } = useAuth();
  const { expenses, loading, error } = useExpenses();
  const [selected, setSelected] = useState<Expense | null>(null);

  const saldo = expenses.reduce((acc, e) => {
    return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
  }, 0);

  function printCajaChicaReport() {
    const totalIngresos = expenses.filter(e => e.type === 'ingreso').reduce((a, e) => a + e.amount, 0);
    const totalEgresos = expenses.filter(e => e.type === 'egreso').reduce((a, e) => a + e.amount, 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Caja Chica - ERP Control Bolsas</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111; font-size: 12px; }
            .header { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 20px; color: #2563eb; }
            .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .kpi { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; }
            .kpi-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
            .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            .num { text-align: right; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Reporte de Movimientos de Caja Chica</h1>
              <div>Control Bolsas ERP · Grupo Textil Providencia</div>
            </div>
            <div>
              <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

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
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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
        <h1>Caja Chica</h1>
        <p>Control de gastos internos y reposiciones de caja.</p>
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
            <button className="btn no-print" onClick={printCajaChicaReport}>🖨️ Imprimir Reporte (PDF)</button>
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
                    <td>{e.concept}</td>
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
        <ExpenseModal expense={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function ExpenseModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
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
      await deleteDoc(doc(db, PATHS.expenses, expense.id));
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
        <Field label="Proveedor (Opcional, para anticipos)">
          <input className="input boxed" value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="Ej. Andres" />
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
