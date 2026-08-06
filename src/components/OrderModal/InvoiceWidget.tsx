import { useState } from 'react';
import { Field, CopyButton } from '../ui';
import { fromInputDate, money, toInputDate } from '../../lib/format';
import { Timestamp } from 'firebase/firestore';
import { addDays, computeFinancials } from '../../lib/finance';
import type { Invoice, OrderStatus, PurchaseOrder } from '../../lib/types';
import { useInvoiceActions } from './useInvoiceActions';

interface InvoiceWidgetProps {
  invoice: Invoice;
  order: PurchaseOrder;
  provName: string;
  config: any;
  dynamicConfig: any;
  readOnly: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  enFoco: boolean;
}

export function InvoiceWidget({ invoice, order, provName, config, dynamicConfig, readOnly, expanded, onToggleExpand, enFoco }: InvoiceWidgetProps) {
  const { saveInvoice, deleteInvoice } = useInvoiceActions();
  const [localInvoice, setLocalInvoice] = useState<Invoice>(invoice);
  
  // Track if there are local unsaved changes
  const hasChanges = JSON.stringify(invoice) !== JSON.stringify(localInvoice);

  const baseFin = computeFinancials(localInvoice.kilos, dynamicConfig);
  const fin = { ...baseFin, ...localInvoice.financials };
  
  const d = (() => {
    if (!localInvoice.creditCycle.dueDate) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = localInvoice.creditCycle.dueDate.toDate();
    due.setHours(0,0,0,0);
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24));
  })();
  const isLate = (localInvoice.creditCycle.status === 'overdue' || localInvoice.creditCycle.status === 'pending') && d !== null && d > 0;

  const updateField = (fieldPath: string[], value: any) => {
    setLocalInvoice(prev => {
      const next = { ...prev };
      let current: any = next;
      for (let i = 0; i < fieldPath.length - 1; i++) {
        current[fieldPath[i]] = { ...current[fieldPath[i]] };
        current = current[fieldPath[i]];
      }
      current[fieldPath[fieldPath.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await saveInvoice(order, localInvoice, dynamicConfig);
    } catch (error) {
      // toast already handled in useInvoiceActions
    }
  };

  return (
    <div
      id={`factura-card-${localInvoice.id}`}
      className="card"
      style={{
        padding: 16,
        border: enFoco ? '2px solid var(--accent)' : '1px solid var(--glass-border, var(--line))',
        background: enFoco ? 'var(--accent-tint)' : 'var(--glass-bg, #ffffff)',
        backdropFilter: 'var(--glass-blur, none)',
        WebkitBackdropFilter: 'var(--glass-blur, none)',
        boxShadow: 'var(--glass-shadow, 0 1px 3px rgba(0,0,0,0.1))',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        onClick={onToggleExpand}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingBottom: expanded ? 16 : 0, borderBottom: expanded ? '1px solid var(--glass-border)' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 16 }}>Factura {localInvoice.folio ? `#${localInvoice.folio}` : '(sin folio)'}</strong>
          {localInvoice.collection?.contrareciboNumber && (
            <span className="badge b-info" style={{ letterSpacing: '0.04em' }}>
              CR: {localInvoice.collection.contrareciboNumber}
            </span>
          )}
          <span className="badge" style={{ background: 'var(--paper-sunk)', color: 'var(--ink)', fontSize: 13, fontFamily: 'monospace' }}>{money(fin.invoiceTotal)}</span>
          <span className="badge b-ok" style={{ fontSize: 13 }}>
            Utilidad: {money(fin.invoiceTotal - (fin.costTotal || 0) - (fin.commission || 0))}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 12, background: localInvoice.creditCycle.status === 'collected' ? 'var(--cash-bg)' : isLate ? 'var(--bad-bg)' : 'var(--warn-bg)', color: localInvoice.creditCycle.status === 'collected' ? 'var(--cash)' : isLate ? 'var(--bad)' : 'var(--warn)' }}>
            {localInvoice.creditCycle.status === 'collected' ? '✅ En Caja' : localInvoice.creditCycle.status === 'paid' ? '🟡 Con el Contador' : isLate ? '🔴 Vencido' : '⏳ Por Cobrar'}
          </span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, background: 'var(--paper)', padding: '6px 12px', borderRadius: 20 }}>
          {expanded ? '▲ Ocultar' : '▼ Editar'}
        </span>
      </div>
      
      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
               {hasChanges && <span style={{ color: 'var(--warn)', fontWeight: 'bold' }}>⚠️ Tienes cambios sin guardar</span>}
            </div>
            {!readOnly && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hasChanges && (
                  <button className="btn btn-primary" onClick={handleSave} style={{ padding: '4px 12px', fontSize: 13 }}>
                    💾 Guardar Cambios
                  </button>
                )}
                <button className="btn btn-danger" onClick={() => deleteInvoice(order, localInvoice.id)} style={{ padding: '4px 12px', fontSize: 13 }}>
                   Eliminar
                </button>
              </div>
            )}
          </div>

          <div className="form-grid">
            <Field label="Folio">
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="input boxed mono" value={localInvoice.folio || ''} 
                  onChange={e => updateField(['folio'], e.target.value.toUpperCase())} disabled={readOnly} />
                {localInvoice.folio && <CopyButton text={localInvoice.folio} />}
              </div>
            </Field>
            <Field label="Kilos Facturados">
              <input className="input boxed mono" type="number" step="0.01" value={localInvoice.kilos} 
                onChange={e => updateField(['kilos'], Number(e.target.value))} disabled={readOnly} />
            </Field>
            <Field label="Contrarecibo (CR)">
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="input boxed mono" value={localInvoice.collection?.contrareciboNumber || ''} 
                  disabled={readOnly}
                  onChange={e => updateField(['collection', 'contrareciboNumber'], e.target.value.toUpperCase())} />
                {localInvoice.collection?.contrareciboNumber && <CopyButton text={localInvoice.collection.contrareciboNumber} />}
              </div>
            </Field>
            <Field label="Estado del Contrarecibo">
              <select className="input boxed" value={localInvoice.creditCycle.status}
                disabled={readOnly}
                onChange={(e) => updateField(['creditCycle', 'status'], e.target.value as OrderStatus)}>
                <option value="pending">Por cobrar</option>
                  <option value="paid">🟡 Con el contador</option>
                  <option value="collected">✅ Recibida</option>
                  <option value="overdue">Contrarecibo vencido</option>
                  <option value="manual_review">Revisión manual</option>
              </select>
              <div style={{ color: 'var(--bad)', fontWeight: 'bold', fontSize: '12px', marginTop: 4, minHeight: 18, visibility: isLate ? 'visible' : 'hidden' }}>
                {isLate ? `⚠️ ${d} días de atraso` : ' '}
              </div>
            </Field>
            <Field label="Emisión">
              <input className="input boxed mono" type="date" value={toInputDate(localInvoice.creditCycle.issueDate) || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const issue = fromInputDate(e.target.value);
                  if (issue) {
                    const due = addDays(issue, config.creditDays);
                    updateField(['creditCycle', 'issueDate'], Timestamp.fromDate(issue));
                    updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(due));
                  }
                }} />
            </Field>
            <Field label="Vence">
              <input className="input boxed mono" type="date" value={toInputDate(localInvoice.creditCycle.dueDate) || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const due = fromInputDate(e.target.value);
                  if (due) updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(due));
                }} />
            </Field>
            <Field label="Fecha de Cobro">
              <input className="input boxed mono" type="date" value={toInputDate(localInvoice.collection?.paidAt) || ''}
                disabled={readOnly}
                onChange={e => {
                  const pa = fromInputDate(e.target.value);
                  updateField(['collection', 'paidAt'], pa ? Timestamp.fromDate(pa) : null);
                }} />
            </Field>
            <Field label="Monto Cobrado">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input boxed mono" type="number" step="0.01" 
                  value={localInvoice.collection?.paidAmount !== undefined ? localInvoice.collection.paidAmount : ''}
                  disabled={readOnly}
                  onChange={e => updateField(['collection', 'paidAmount'], Number(e.target.value))} 
                  style={{ flex: 1 }}
                />
              </div>
            </Field>
          </div>
          
          <div className="calc-box" style={{ marginTop: 16 }}>
            <div className="calc-line">
              <span>Venta (Total Factura)</span>
              <span className="mono">{money(fin.invoiceTotal)}</span>
            </div>
            <div className="calc-line">
              <span>Costo de Compra (Kilos a ${provName})</span>
              <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.costTotal)}</span>
            </div>
            <div className="calc-line" style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <strong>Utilidad Bruta</strong>
              <strong className="mono">{money(fin.invoiceTotal - (fin.costTotal || 0))}</strong>
            </div>
            <div className="calc-line">
              <span>Comisión del Contador</span>
              <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.commission)}</span>
            </div>
            <div className="calc-line total" style={{ borderTop: '2px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <span>💰 UTILIDAD NETA (Ganancia Real)</span>
              <span className="mono" style={{ color: 'var(--ok)' }}>{money(fin.invoiceTotal - (fin.costTotal || 0) - (fin.commission || 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
