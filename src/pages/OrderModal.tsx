import { useState } from 'react';
import { deleteDoc, doc, serverTimestamp, Timestamp, setDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { Field, Modal } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { computeFinancials, addDays } from '../lib/finance';
import { fmtDateTime, fromInputDate, money, percent, toDate, toInputDate } from '../lib/format';
import type { FinancialConfig, OrderStatus, PurchaseOrder } from '../lib/types';

export default function OrderModal({
  order,
  config,
  onClose,
}: {
  order: PurchaseOrder;
  config: FinancialConfig;
  onClose: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    folio: order.folio ?? '',
    client: order.client ?? '',
    department: order.department ?? '',
    provider: order.provider ?? '',
    totalKilograms: String(order.totalKilograms ?? ''),
    status: (order.creditCycle?.status ?? 'pending') as OrderStatus,
    issueDate: toInputDate(order.creditCycle?.issueDate) || toInputDate(order.processedAt),
    dueDate: toInputDate(order.creditCycle?.dueDate),
    contrareciboNumber: order.collection?.contrareciboNumber ?? '',
    contrareciboDate: toInputDate(order.collection?.contrareciboDate),
    paidAmount: String(order.collection?.paidAmount ?? ''),
    paidAt: toInputDate(order.collection?.paidAt),
    notes: order.collection?.notes ?? '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const kilosNum = Number(form.totalKilograms) || 0;
  const preview = computeFinancials(kilosNum, config);

  /** Si cambias la fecha de emisión y no tocaste el vencimiento, se recalcula. */
  function onIssueChange(v: string) {
    const issue = fromInputDate(v);
    setForm((f) => ({
      ...f,
      issueDate: v,
      dueDate: issue && !f.dueDate ? toInputDate(addDays(issue, config.creditDays)) : f.dueDate,
    }));
  }

  async function save() {
    if (kilosNum <= 0) {
      toast('Los kilos deben ser mayores a cero.', 'bad');
      return;
    }
    setBusy(true);
    try {
      const issue = fromInputDate(form.issueDate) ?? new Date();
      const due = fromInputDate(form.dueDate) ?? addDays(issue, config.creditDays);
      const ref = doc(db, PATHS.orders, order.id);
      await setDoc(ref, {
        folio: form.folio.trim(),
        client: form.client.trim(),
        department: form.department.trim(),
        provider: form.provider.trim(),
        totalKilograms: kilosNum,
        financials: preview,
        creditCycle: {
          status: form.status,
          issueDate: Timestamp.fromDate(issue),
          dueDate: Timestamp.fromDate(due),
        },
        collection: {
          contrareciboNumber: form.contrareciboNumber.trim(),
          contrareciboDate: form.contrareciboDate
            ? Timestamp.fromDate(fromInputDate(form.contrareciboDate) as Date)
            : null,
          paidAmount: Number(form.paidAmount) || 0,
          paidAt: form.paidAt ? Timestamp.fromDate(fromInputDate(form.paidAt) as Date) : null,
          notes: form.notes.trim(),
        },
        updatedAt: serverTimestamp(),
        processedAt: order.processedAt ?? serverTimestamp(),
      }, { merge: true });
      toast('Orden actualizada', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function markPaid() {
    setBusy(true);
    try {
      await setDoc(doc(db, PATHS.orders, order.id), {
        creditCycle: {
          ...order.creditCycle,
          status: 'paid',
        },
        collection: {
          ...order.collection,
          paidAmount: order.financials?.saleTotal ?? preview.saleTotal,
          paidAt: Timestamp.fromDate(new Date()),
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast('Marcada como cobrada', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo actualizar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar la orden ${order.folio ?? ''}? Esto no se puede deshacer.`))
      return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, PATHS.orders, order.id));
      toast('Orden eliminada', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo eliminar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const isReview = order.creditCycle?.status === 'manual_review';

  return (
    <Modal wide title={`Orden ${order.folio ?? '(sin folio)'}`} onClose={onClose}>
      {isReview && (
        <div className="alert warn">
          La IA no pudo leer este PDF{order.aiError ? `: ${order.aiError}` : '.'} Captura los kilos
          y guarda: la orden entra al ciclo de crédito normal.
        </div>
      )}

      <div className="form-grid">
        <Field label="Folio">
          <input className="input boxed mono" value={form.folio} onChange={(e) => set('folio', e.target.value)} />
        </Field>
        <Field label="Cliente">
          <input className="input boxed" value={form.client} onChange={(e) => set('client', e.target.value)} />
        </Field>
        <Field label="Departamento">
          <input className="input boxed" value={form.department} onChange={(e) => set('department', e.target.value)} />
        </Field>
        <Field label="Proveedor">
          <input className="input boxed" value={form.provider} onChange={(e) => set('provider', e.target.value)} />
        </Field>
        <Field label="Kilos totales">
          <input className="input boxed mono" type="number" step="0.01" value={form.totalKilograms}
            onChange={(e) => set('totalKilograms', e.target.value)} />
        </Field>
        <Field label="Estado">
          <select className="input boxed" value={form.status}
            onChange={(e) => set('status', e.target.value as OrderStatus)}>
            <option value="pending">Por cobrar</option>
            <option value="paid">Cobrada</option>
            <option value="overdue">Vencida</option>
            <option value="manual_review">Revisión manual</option>
          </select>
        </Field>
        <Field label="Fecha de emisión">
          <input className="input boxed mono" type="date" value={form.issueDate}
            onChange={(e) => onIssueChange(e.target.value)} />
        </Field>
        <Field label={`Vence (crédito ${config.creditDays} días)`}>
          <input className="input boxed mono" type="date" value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Número de contrarecibo">
          <input className="input boxed mono" value={form.contrareciboNumber}
            onChange={(e) => set('contrareciboNumber', e.target.value)} />
        </Field>
        <Field label="Fecha de contrarecibo">
          <input className="input boxed mono" type="date" value={form.contrareciboDate}
            onChange={(e) => set('contrareciboDate', e.target.value)} />
        </Field>
        <Field label="Monto cobrado">
          <input className="input boxed mono" type="number" step="0.01" value={form.paidAmount}
            onChange={(e) => set('paidAmount', e.target.value)} />
        </Field>
        <Field label="Fecha de cobro">
          <input className="input boxed mono" type="date" value={form.paidAt}
            onChange={(e) => set('paidAt', e.target.value)} />
        </Field>
        <Field label="Notas" full>
          <textarea className="input boxed" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      <div className="calc-box">
        <div className="calc-line">
          <span>Venta ({kilosNum.toLocaleString('es-MX')} kg × {money(config.salePricePerKg)})</span>
          <span className="mono">{money(preview.saleTotal)}</span>
        </div>
        <div className="calc-line">
          <span>Costo ({money(config.costPricePerKg)}/kg)</span>
          <span className="mono">− {money(preview.costTotal)}</span>
        </div>
        <div className="calc-line">
          <span>Comisión {percent(config.commissionRate)} sobre la venta</span>
          <span className="mono">− {money(preview.commission)}</span>
        </div>
        <div className="calc-line total">
          <span>Flujo neto</span>
          <span className="mono" style={{ color: preview.netCashFlow >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
            {money(preview.netCashFlow)}
          </span>
        </div>
      </div>

      <p className="hint" style={{ marginTop: 12 }}>
        Archivo: <code>{order.fileName ?? '—'}</code> · procesada {fmtDateTime(order.processedAt)}
        {order.updatedAt ? ` · editada ${fmtDateTime(order.updatedAt)}` : ''}
        {toDate(order.collection?.paidAt) ? ` · cobrada ${fmtDateTime(order.collection?.paidAt)}` : ''}
      </p>

      <div className="modal-actions">
        <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>
          Eliminar
        </button>
        <span className="spacer" />
        {form.status !== 'paid' && (
          <button className="btn btn-ok" onClick={() => void markPaid()} disabled={busy}>
            Marcar cobrada
          </button>
        )}
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  );
}
