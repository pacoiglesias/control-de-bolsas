import { useState } from 'react';
import { Field, CopyButton } from '../ui';
import { CurrencyInput } from '../CurrencyInput';
import { fromInputDate, money, toInputDate, toDate } from '../../lib/format';
import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { addDays, computeFinancials, round2 } from '../../lib/finance';
import { db, PATHS } from '../../lib/firebase';
import { sound } from '../../lib/sounds';
import type { Invoice, OrderStatus, PurchaseOrder } from '../../lib/types';
import { useInvoiceActions } from './useInvoiceActions';
import { useToast } from '../../context/ToastContext';
import { promptDialog } from '../../lib/promptDialog';

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
  const toast = useToast();
  const [localInvoice, setLocalInvoice] = useState<Invoice>(invoice);

  // FIX 2026-08-11 (Iteracion 109): "hasChanges" comparaba localInvoice
  // contra la prop `invoice` con JSON.stringify -- pero handleSave() (via
  // saveInvoice() en useInvoiceActions.ts) escribe a Firestore un objeto
  // CON CAMPOS QUE EL SERVIDOR NORMALIZA (updatedAt: Timestamp.now(),
  // financials recalculados, folio, orderId, clientId, oc...) que
  // localInvoice nunca tuvo. Cuando el listener en tiempo real traia de
  // vuelta esa version normalizada como la nueva prop `invoice`, YA NO
  // coincidia con localInvoice -- asi que "Tienes cambios sin guardar" y
  // el boton "Guardar Cambios" se quedaban visibles PARA SIEMPRE, incluso
  // justo despues de un guardado exitoso. Eso hizo parecer, al corregir el
  // estatus atorado de la factura 6097 (CR TH-879), que el guardado habia
  // fallado dos veces seguidas -- en realidad SI se guardo ambas veces
  // (confirmado end-to-end: Cobranza paso de contar $940,130.34 a
  // $1,049,170.34, exacto contra el Excel de control). Un flag explicito
  // que se prende en cada edicion y se apaga solo cuando handleSave()
  // termina sin error es inmune a esta discrepancia de forma, porque no
  // depende de que la prop y el estado local vuelvan a verse identicos
  // byte a byte.
  const [dirty, setDirty] = useState(false);
  const hasChanges = dirty;

  const baseFin = computeFinancials(localInvoice.kilos, dynamicConfig);
  const fin = { ...baseFin, ...localInvoice.financials };
  
  const d = (() => {
    if (!localInvoice.creditCycle.dueDate) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = toDate(localInvoice.creditCycle.dueDate);
    if (!due) return null;
    due.setHours(0,0,0,0);
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24));
  })();
  const isLate = (localInvoice.creditCycle.status === 'overdue' || localInvoice.creditCycle.status === 'pending') && d !== null && d > 0;

  const updateField = (fieldPath: string[], value: any) => {
    setDirty(true);
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
      setDirty(false);
    } catch (error) {
      // toast already handled in useInvoiceActions -- se deja "dirty" en
      // true a proposito: si fallo, los cambios siguen sin guardar de
      // verdad y el boton debe seguir ofreciendo reintentar.
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
                {localInvoice.creditCycle.status === 'paid' && (
                  <button className="btn" style={{ background: 'var(--ok)', color: '#fff', borderColor: 'var(--ok)', padding: '4px 12px', fontSize: 13 }}
                    onClick={async () => {
                      const invTotal = fin.invoiceTotal;
                      const commission = fin.commission || 0;
                      const netEsperado = invTotal - commission;
                      const respuesta = await promptDialog({
                        message: `Esperado (con comisión de ${(commission / invTotal * 100).toFixed(3)}%): $${netEsperado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n\n¿Cuánto recibiste realmente en Caja?`,
                        defaultValue: netEsperado.toFixed(2),
                      });
                      if (respuesta === null) return;
                      const netReal = Number(respuesta.replace(/[^0-9.-]/g, ''));
                      if (isNaN(netReal) || netReal <= 0) {
                        toast('Monto inválido, no se registró nada.', 'bad');
                        return;
                      }
                      const diferencia = round2(netReal - netEsperado);
                      sound.playCash();
                      try {
                        await addDoc(collection(db, PATHS.expenses), {
                          date: Timestamp.now(),
                          concept: `Cobro factura #${localInvoice.folio ?? '?'} (CR: ${localInvoice.collection?.contrareciboNumber ?? '—'})`,
                          amount: netReal,
                          type: 'ingreso',
                          notes: `Documento: $${invTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} — Comisión: $${commission.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
                          montoEsperado: round2(netEsperado),
                          montoReal: round2(netReal),
                          diferencia,
                          createdAt: serverTimestamp(),
                        });
                        await saveInvoice(order, { ...localInvoice, creditCycle: { ...localInvoice.creditCycle, status: 'collected' }, collection: { ...localInvoice.collection, collectedAt: Timestamp.now() } }, {});
                        if (Math.abs(diferencia) > 0.01) {
                          toast(`💵 $${netReal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} agregado a CAJA. ⚠️ Diferencia vs esperado: ${diferencia > 0 ? '+' : ''}$${diferencia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'ok');
                        } else {
                          toast(`💵 Recibido del contador. $${netReal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} agregado a CAJA.`, 'ok');
                        }
                      } catch {
                        toast('No se pudo registrar en CAJA.', 'bad');
                      }
                    }}>
                    💵 Recibida del Contador → CAJA
                  </button>
                )}
                <button className="btn btn-danger" onClick={() => deleteInvoice(order, localInvoice.id)} style={{ padding: '4px 12px', fontSize: 13 }}>
                   Eliminar
                </button>
              </div>
            )}
          </div>

          <div className="form-grid">
            {/* FIX 2026-08-11 (Iteracion 110): a peticion del usuario, quien
                aclaro que la mayoria de los contrarecibos capturados NO
                tienen un numero de factura real detras (a diferencia de
                casos como 6167/6159, que si son facturas propiamente
                dichas en revision) -- este campo se dejaba sin ninguna
                senal de que es opcional, invitando a escribir folios
                inventados solo para "llenar el campo". Si se deja vacio,
                saveInvoice() ya usa "S/N" automaticamente (ver
                useInvoiceActions.ts) -- este cambio solo lo hace visible. */}
            <Field label="Folio (opcional si no hay factura, solo CR)">
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="input boxed mono" value={localInvoice.folio || ''}
                  placeholder="Déjalo vacío si no tienes el folio de la factura"
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
                <CurrencyInput 
                  className="input boxed mono"
                  value={localInvoice.collection?.paidAmount || 0}
                  disabled={readOnly}
                  onChange={val => updateField(['collection', 'paidAmount'], val)} 
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
