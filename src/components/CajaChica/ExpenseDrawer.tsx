import { useState } from 'react';
import { doc, setDoc, serverTimestamp, Timestamp, updateDoc, deleteField } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { Drawer, Field } from '../ui';
import { CurrencyInput } from '../CurrencyInput';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { toInputDate, fromInputDate, money } from '../../lib/format';
import { logAction, safeDeleteDoc } from '../../lib/logger';
import { useUndo } from '../../context/UndoContext';
import { confirmDialog } from '../../lib/confirmDialog';
import type { Expense } from '../../lib/types';

interface ExpenseDrawerProps {
  expense: Expense;
  onClose: () => void;
  provName: string;
  saldoCajaActual?: number;
}

export function ExpenseDrawer({
  expense,
  onClose,
  provName,
  saldoCajaActual = 0,
}: ExpenseDrawerProps) {
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
    const amt = Number(form.amount);
    if (amt <= 0) return toast('Monto inválido', 'bad');

    if (form.type === 'egreso' && !expense.createdAt && amt > saldoCajaActual) {
      const msg = `⚠️ ATENCIÓN: El saldo en efectivo en Caja Chica es de ${money(
        saldoCajaActual
      )}, pero intentas registrar un egreso de ${money(amt)}.\n\nLa caja quedará en saldo negativo de ${money(
        saldoCajaActual - amt
      )}.\n\n¿Deseas continuar?`;
      if (!(await confirmDialog(msg))) return;
    }

    setBusy(true);
    try {
      const d = fromInputDate(form.date) ?? new Date();
      await setDoc(
        doc(db, PATHS.expenses, expense.id),
        {
          date: Timestamp.fromDate(d),
          concept: form.concept.trim(),
          amount: Number(form.amount),
          type: form.type,
          notes: form.notes.trim(),
          provider: form.provider.trim() || null,
          createdAt: expense.createdAt ?? serverTimestamp(),
        },
        { merge: true }
      );
      await logAction(user?.email, expense.createdAt ? 'Gasto Editado' : 'Gasto Creado', {
        id: expense.id,
        concept: form.concept.trim(),
        amount: Number(form.amount),
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
    const isIngreso = expense.type === 'ingreso';
    const tipoStr = isIngreso ? 'ingreso / cobro' : 'gasto / retiro';
    const msg = `⚠️ ¿Estás seguro de que deseas eliminar este ${tipoStr} de Caja Chica?\n\nConcepto: "${
      expense.concept
    }"\nMonto: $${Number(expense.amount || 0).toLocaleString('es-MX', {
      minimumFractionDigits: 2,
    })}\n\nEsta acción quedará registrada en la bitácora de auditoría.`;

    if (!(await confirmDialog({ message: msg, danger: true }))) return;

    executeWithUndo(
      async () => {
        await safeDeleteDoc(user?.email, doc(db, PATHS.expenses, expense.id), expense);
        await logAction(user?.email, 'Movimiento de Caja Eliminado', {
          id: expense.id,
          concept: expense.concept,
          amount: expense.amount,
          type: expense.type,
        });
        onClose();
      },
      async () => {
        const ref = doc(db, PATHS.expenses, expense.id);
        await updateDoc(ref, {
          isDeleted: deleteField(),
          deletedAt: deleteField(),
          deletedBy: deleteField(),
        });
        await logAction(user?.email, 'Borrado de Movimiento Deshecho', { id: expense.id });
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
        <Field label="Concepto">
          <input
            className="input boxed"
            value={form.concept}
            onChange={(e) => set('concept', e.target.value)}
            placeholder="Ej. Gasolina, Flete..."
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {(form.type === 'egreso'
              ? [
                  { label: '⛽ Gasolina', concept: 'Gasolina', prov: 'Gasolinera' },
                  { label: '🚛 Flete', concept: 'Flete y Acarreo de Material', prov: '' },
                  { label: `🏭 Pago ${provName}`, concept: 'Pago de Producción / Kilos', prov: provName },
                  { label: '💼 Retiro Socios', concept: 'Retiro de Utilidades Socios', prov: 'Socios' },
                  { label: '📦 Empaque / Fleje', concept: 'Material de Empaque y Fleje', prov: '' },
                  { label: '🛠️ Mantenimiento', concept: 'Mantenimiento y Reparaciones', prov: '' },
                  { label: '🍔 Viáticos / Comida', concept: 'Comida y Viáticos Operativos', prov: '' },
                ]
              : [
                  { label: '📥 Cobro Factura', concept: 'Depósito / Cobro Factura Contador', prov: 'Contador' },
                  { label: '💰 Aportación Socios', concept: 'Aportación de Capital Socios', prov: 'Socios' },
                  { label: '🔄 Reembolso / Ajuste', concept: 'Reembolso / Ajuste de Caja', prov: '' },
                ]
            ).map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="chip"
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  background: form.concept === preset.concept ? 'var(--accent)' : 'var(--paper-sunk)',
                  color: form.concept === preset.concept ? '#fff' : 'var(--ink)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    concept: preset.concept,
                    provider: preset.prov || f.provider,
                  }));
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Proveedor / Fabricante / Beneficiario">
          <input
            className="input boxed"
            value={form.provider}
            onChange={(e) => set('provider', e.target.value)}
            placeholder={`Ej. ${provName}`}
          />
        </Field>
        <Field label="Monto">
          <CurrencyInput
            className="input boxed mono"
            value={Number(form.amount) || 0}
            onChange={(val) => set('amount', String(val))}
          />
        </Field>
        <Field label="Notas adicionales" full>
          <textarea className="input boxed" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
      <div className="modal-actions" style={{ marginTop: 24 }}>
        {expense.createdAt !== null && (
          <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>
            Eliminar
          </button>
        )}
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Drawer>
  );
}
