import { useState } from 'react';
import { doc, collection, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useExpenses } from '../hooks/useExpenses';
import { Card, Empty, Field, Modal, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtDate, money, toInputDate, fromInputDate } from '../lib/format';
import type { Expense } from '../lib/types';

export default function CajaChica() {
  const { expenses, loading, error } = useExpenses();
  const [selected, setSelected] = useState<Expense | null>(null);

  const saldo = expenses.reduce((acc, e) => {
    return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
  }, 0);

  if (loading) return <Spinner />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Caja Chica</h1>
        <p>Control de gastos internos y reposiciones de caja.</p>
      </div>

      <Card
        actions={
          <button className="btn btn-primary" onClick={() => setSelected({
            id: doc(collection(db, PATHS.expenses)).id,
            date: Timestamp.fromDate(new Date()),
            concept: '',
            amount: 0,
            type: 'egreso',
            createdAt: null,
          } as Expense)}>
            + Registrar Gasto / Ingreso
          </button>
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
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    date: toInputDate(expense.date),
    concept: expense.concept,
    amount: String(expense.amount || ''),
    type: expense.type,
    notes: expense.notes ?? '',
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
        createdAt: expense.createdAt ?? serverTimestamp(),
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
    if (!window.confirm('¿Borrar este movimiento?')) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, PATHS.expenses, expense.id));
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
