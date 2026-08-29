import React, { useState, useMemo } from 'react';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { useOrdersContext } from '../../context/OrdersContext';
import { extractCr, inferDepartment } from '../../lib/finance';
import { money, kilos, toDate, toInputDate } from '../../lib/format';
import { findDuplicateContrarecibo } from '../../lib/duplicateGuards';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';
import type { PurchaseOrder, Invoice } from '../../lib/types';

interface ProactiveCrHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PendingInvoiceItem {
  orderId: string;
  order: PurchaseOrder;
  invoiceId: string;
  invoice: Invoice;
  oc: string;
  client: string;
  dept: 'TH' | 'GT';
  invoiceFolio: string;
  kilos: number;
  totalMoney: number;
  issueDate: Date;
  daysInReview: number;
  // Campos del formulario
  crInput: string;
  dueDateInput: string;
}

export const ProactiveCrHubModal: React.FC<ProactiveCrHubModalProps> = ({ isOpen, onClose }) => {
  const { orders } = useOrdersContext();
  const toast = useToast();

  const [pasteText, setPasteText] = useState('');
  const [formInputs, setFormInputs] = useState<Record<string, { cr: string; dueDate: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Obtener todas las facturas activas que NO tienen contrarecibo
  const pendingInvoices: PendingInvoiceItem[] = useMemo(() => {
    const list: PendingInvoiceItem[] = [];

    orders.forEach(o => {
      if ((o as any).isDeleted || o.isClosedShort) return;

      (o.invoices || []).forEach(inv => {
        const cr = extractCr(inv, o);
        const st = inv.creditCycle?.status;
        const total = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const paid = inv.collection?.paidAmount || 0;

        const isPaid = st === 'paid' || st === 'collected' || (paid >= total && total > 0);
        if (cr || isPaid) return;

        const dept = (inferDepartment(o) || (o.department?.includes('TH') ? 'TH' : 'GT')) as 'TH' | 'GT';
        const rawIssue = inv.creditCycle?.issueDate || o.creditCycle?.issueDate;
        const issueDate = toDate(rawIssue) || new Date();
        const daysInReview = Math.max(0, Math.floor((Date.now() - issueDate.getTime()) / (1000 * 3600 * 24)));

        // Calcular fecha de vencimiento inicial a 30 días
        const defaultDue = new Date(issueDate);
        defaultDue.setDate(defaultDue.getDate() + 30);
        const defaultDueStr = toInputDate(defaultDue);

        const key = `${o.id}_${inv.id || inv.folio}`;
        const currentForm = formInputs[key];

        list.push({
          orderId: o.id,
          order: o,
          invoiceId: inv.id || inv.folio || 'inv-1',
          invoice: inv,
          oc: o.oc || o.folio || 'S/N',
          client: o.client || 'Grupo Textil Providencia',
          dept,
          invoiceFolio: inv.folio || 'S/F',
          kilos: Number(inv.kilos) || 0,
          totalMoney: total,
          issueDate,
          daysInReview,
          crInput: currentForm?.cr !== undefined ? currentForm.cr : (dept === 'TH' ? 'TH-' : 'GT-'),
          dueDateInput: currentForm?.dueDate !== undefined ? currentForm.dueDate : defaultDueStr,
        });
      });
    });

    // Ordenar: primero las que llevan más días en revisión
    return list.sort((a, b) => b.daysInReview - a.daysInReview);
  }, [orders, formInputs]);

  // Actualizar un campo individual
  const updateFormValue = (key: string, field: 'cr' | 'dueDate', value: string) => {
    setFormInputs(prev => ({
      ...prev,
      [key]: {
        cr: field === 'cr' ? value : (prev[key]?.cr ?? ''),
        dueDate: field === 'dueDate' ? value : (prev[key]?.dueDate ?? ''),
      }
    }));
  };

  // Helper de días rápidos (+30d, +45d)
  const setQuickDays = (item: PendingInvoiceItem, key: string, days: number) => {
    const d = new Date(item.issueDate);
    d.setDate(d.getDate() + days);
    updateFormValue(key, 'dueDate', toInputDate(d));
    toast(`📅 Vencimiento fijado a +${days} días`, 'ok');
  };

  // Pegado Mágico Inteligente (Ctrl+V)
  const handleSmartPaste = (text: string) => {
    setPasteText(text);
    if (!text.trim()) return;

    let matchedCount = 0;

    pendingInvoices.forEach(item => {
      const key = `${item.orderId}_${item.invoiceId}`;

      // Buscar si el texto menciona el folio de factura o la OC
      const folReg = new RegExp(`(?:factura|fac|f[.-]?|folio)?\\s*#?\\s*${item.invoiceFolio}\\b`, 'i');
      const ocReg = new RegExp(`(?:oc|orden)?\\s*#?\\s*${item.oc}\\b`, 'i');

      if (folReg.test(text) || ocReg.test(text) || pendingInvoices.length === 1) {
        // 1. Extraer Contrarecibo (ej. TH-946, GT-742, CR-1024, TH 1024)
        const crMatch = text.match(/\b(TH|GT|CR)[-\s]?(\d{2,6})\b/i);
        // 2. Extraer Fecha (ej. 2026-09-16 o 16/09/2026)
        const dateMatch = text.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/);

        let newCr = item.crInput;
        let newDue = item.dueDateInput;

        if (crMatch) {
          const pref = crMatch[1].toUpperCase() === 'CR' ? (item.dept === 'TH' ? 'TH' : 'GT') : crMatch[1].toUpperCase();
          newCr = `${pref}-${crMatch[2]}`;
          matchedCount++;
        }

        if (dateMatch) {
          const rawD = dateMatch[1].replace(/\//g, '-');
          if (/^\d{4}-\d{2}-\d{2}$/.test(rawD)) {
            newDue = rawD;
          } else {
            const parts = rawD.split('-');
            if (parts.length === 3) {
              newDue = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
        }

        setFormInputs(prev => ({
          ...prev,
          [key]: { cr: newCr, dueDate: newDue }
        }));
      }
    });

    if (matchedCount > 0) {
      sound.playSuccess();
      toast(`✨ Pegado mágico: Se detectaron datos para ${matchedCount} contrarecibo(s)`, 'ok');
    } else {
      toast('No se encontró coincidencia directa de folio/CR en el texto pegado.', 'bad');
    }
  };

  // Guardar Contrarecibo de una factura individual
  const handleSaveIndividualCr = async (item: PendingInvoiceItem) => {
    const key = `${item.orderId}_${item.invoiceId}`;
    const cleanCr = (item.crInput || '').trim().toUpperCase();

    if (!cleanCr || cleanCr === 'TH-' || cleanCr === 'GT-') {
      return toast('Por favor escribe el número de Contrarecibo (ej. TH-946 o GT-742)', 'bad');
    }

    // Validar duplicidad
    const duplicate = findDuplicateContrarecibo(orders, cleanCr, item.invoiceId, item.orderId);
    if (duplicate) {
      return toast(`🚨 El contrarecibo "${cleanCr}" ya fue usado en la Factura #${duplicate.invoiceFolio} (OC #${duplicate.orderFolio}).`, 'bad');
    }

    // Validar coherencia TH vs GT
    if (item.dept === 'TH' && cleanCr.startsWith('GT-')) {
      return toast('⚠️ Separación Estricta: Las órdenes de Textil Hogar (TH - Nava) deben usar prefijo TH-.', 'bad');
    }
    if (item.dept === 'GT' && cleanCr.startsWith('TH-')) {
      return toast('⚠️ Separación Estricta: Las órdenes de Grupo Textil (GT - Evelia) deben usar prefijo GT-.', 'bad');
    }

    setSavingKey(key);
    try {
      const orderRef = doc(db, PATHS.orders, item.orderId);
      const dueTimestamp = item.dueDateInput ? Timestamp.fromDate(new Date(`${item.dueDateInput}T12:00:00`)) : null;

      // Actualizar la factura específica dentro del expediente
      const updatedInvoices = (item.order.invoices || []).map(inv => {
        if ((inv.id && inv.id === item.invoiceId) || (inv.folio && inv.folio === item.invoiceFolio)) {
          return {
            ...inv,
            creditCycle: {
              ...inv.creditCycle,
              status: 'pending',
              dueDate: dueTimestamp,
            },
            collection: {
              ...inv.collection,
              contrareciboNumber: cleanCr,
              contrareciboDate: Timestamp.now(),
            },
          };
        }
        return inv;
      });

      const updatePayload: any = {
        invoices: updatedInvoices,
        'collection.contrareciboNumber': cleanCr,
        'collection.contrareciboDate': Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (dueTimestamp) {
        updatePayload['creditCycle.dueDate'] = dueTimestamp;
      }
      if (item.order.creditCycle?.status === 'facturado' || item.order.creditCycle?.status === 'pedido') {
        updatePayload['creditCycle.status'] = 'pending';
      }

      await updateDoc(orderRef, updatePayload);

      confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
      sound.playChaChing();
      toast(`✅ Contrarecibo ${cleanCr} asignado a Factura #${item.invoiceFolio} (OC #${item.oc})`, 'ok');
    } catch (err: any) {
      console.error(err);
      toast(`Error al guardar contrarecibo: ${err.message}`, 'bad');
    } finally {
      setSavingKey(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--paper, #1e293b)',
          border: '1px solid var(--line, rgba(255,255,255,0.15))',
          borderRadius: 16,
          width: '100%',
          maxWidth: 1050,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--line, rgba(255,255,255,0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--paper-sunk, rgba(0,0,0,0.25))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>📋</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Asistente Proactivo de Contrarecibos (Providencia)
                </h2>
                <span
                  style={{
                    background: pendingInvoices.length > 0 ? '#fef3c7' : '#ecfdf5',
                    color: pendingInvoices.length > 0 ? '#b45309' : '#059669',
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 12,
                  }}
                >
                  {pendingInvoices.length} facturas en espera
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-soft, #94a3b8)' }}>
                Ingresa o pega los datos de sellos oficiales de Cuentas por Pagar (Martes y Jueves)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-soft, #94a3b8)',
              fontSize: 22,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Banner de Pegado Mágico */}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#3b82f6' }}>
                <span>⚡ Pegado Rápido de Contrarecibos (Ctrl + V)</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                Pega texto de WhatsApp o correo de Providencia
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={pasteText}
                onChange={(e) => handleSmartPaste(e.target.value)}
                placeholder="Ejemplo: Factura 6198 sellada con CR TH-1024 fecha 2026-09-20..."
                style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8 }}
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const txt = await navigator.clipboard.readText();
                    if (txt) handleSmartPaste(txt);
                  } catch {
                    toast('Pega manualmente en la caja de texto', 'bad');
                  }
                }}
                className="btn"
                style={{ background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 700, padding: '0 14px' }}
              >
                📋 Pegar Portapapeles
              </button>
            </div>
          </div>

          {/* Lista de Facturas Pendientes de CR */}
          {pendingInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--paper-sunk)', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#10b981' }}>
                ¡Excelente! No hay facturas pendientes de Contrarecibo
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
                Todas las facturas emitidas tienen su Contrarecibo oficial de Providencia asignado.
              </p>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', fontSize: 12.5 }}>
                <thead style={{ background: 'var(--paper-sunk)' }}>
                  <tr>
                    <th>Expediente / OC</th>
                    <th>Cliente / Depto</th>
                    <th>Factura CFDI</th>
                    <th className="num">Kilos</th>
                    <th className="num">Monto c/IVA</th>
                    <th>Tiempo Revisión</th>
                    <th style={{ width: 170 }}>Número Contrarecibo</th>
                    <th style={{ width: 160 }}>Fecha Vencimiento</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvoices.map((item) => {
                    const key = `${item.orderId}_${item.invoiceId}`;
                    const isSaving = savingKey === key;
                    const isUrgent = item.daysInReview >= 4;

                    return (
                      <tr key={key} style={{ background: isUrgent ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          <span style={{ fontSize: '0.8em', color: '#2563eb', background: '#dbeafe', padding: '1px 5px', borderRadius: 4, marginRight: 5 }}>OC</span>
                          {item.oc}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontSize: '0.75em',
                                fontWeight: 800,
                                color: item.dept === 'TH' ? '#047857' : '#7c3aed',
                                background: item.dept === 'TH' ? '#d1fae5' : '#ede9fe',
                                padding: '1px 6px',
                                borderRadius: 4,
                              }}
                            >
                              {item.dept}
                            </span>
                            <span style={{ fontSize: '0.9em' }}>{item.client}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ fontWeight: 800, color: '#2563eb' }}>
                          #{item.invoiceFolio}
                        </td>
                        <td className="num mono">{kilos(item.kilos)}</td>
                        <td className="num mono" style={{ fontWeight: 700 }}>{money(item.totalMoney)}</td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.8em',
                              fontWeight: 800,
                              color: isUrgent ? '#b91c1c' : '#d97706',
                              background: isUrgent ? '#fee2e2' : '#fef3c7',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {item.daysInReview > 0 ? `⚠️ ${item.daysInReview}d en revisión` : '🟢 Ingresó hoy'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="text"
                              value={item.crInput}
                              onChange={(e) => updateFormValue(key, 'cr', e.target.value.toUpperCase())}
                              placeholder={item.dept === 'TH' ? 'TH-946' : 'GT-742'}
                              style={{
                                width: '100%',
                                padding: '5px 8px',
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                border: item.crInput && item.crInput !== 'TH-' && item.crInput !== 'GT-' ? '1px solid #10b981' : '1px solid var(--line)',
                                borderRadius: 6,
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="date"
                              value={item.dueDateInput}
                              onChange={(e) => updateFormValue(key, 'dueDate', e.target.value)}
                              style={{ width: 110, padding: '4px 6px', fontSize: 11.5, borderRadius: 6 }}
                            />
                            <button
                              type="button"
                              onClick={() => setQuickDays(item, key, 30)}
                              title="+30 días de crédito"
                              style={{
                                background: 'var(--paper-sunk)',
                                border: '1px solid var(--line)',
                                borderRadius: 4,
                                padding: '2px 5px',
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              +30d
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSaveIndividualCr(item)}
                            disabled={isSaving || !item.crInput || item.crInput === 'TH-' || item.crInput === 'GT-'}
                            className="btn btn-primary"
                            style={{
                              padding: '5px 12px',
                              fontSize: 11.5,
                              fontWeight: 800,
                              borderRadius: 6,
                              opacity: !item.crInput || item.crInput === 'TH-' || item.crInput === 'GT-' ? 0.4 : 1,
                            }}
                          >
                            {isSaving ? '...' : '💾 Guardar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--line, rgba(255,255,255,0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--paper-sunk, rgba(0,0,0,0.25))',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            ℹ️ Recuerda que los contrarecibos son emitidos exclusivamente los <strong>martes y jueves</strong> por Providencia.
          </div>

          <button
            onClick={onClose}
            className="btn"
            style={{ padding: '7px 18px', fontWeight: 700 }}
          >
            Cerrar Asistente
          </button>
        </div>
      </div>
    </div>
  );
};
