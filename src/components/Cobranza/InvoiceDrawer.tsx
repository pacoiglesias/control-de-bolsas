import { useState, useMemo } from 'react';
import { Drawer, Field, Card } from '../ui';
import { money, toInputDate, fmtDate } from '../../lib/format';
import type { Invoice, PurchaseOrder } from '../../lib/types';
import { useInvoiceActions } from '../OrderModal/useInvoiceActions';
import { Timestamp } from 'firebase/firestore';
import { extractCr, round2, type FinanceConfigCore } from '../../lib/finance';
import { generatePrefacturaPdf } from '../../lib/prefacturaGenerator';
import { useToast } from '../../context/ToastContext';
import {
  generateCollectionNotice,
  generateInstitutionalEmailDraft,
  openWhatsAppMessage,
  openInstitutionalEmail,
  copyToClipboard,
} from '../../lib/whatsappReminder';
import { useOrders } from '../../hooks/useOrders';
import { findDuplicateContrarecibo } from '../../lib/duplicateGuards';

interface InvoiceDrawerProps {
  invoice: Invoice;
  order: PurchaseOrder;
  dynamicConfig: FinanceConfigCore;
  onClose: () => void;
}

// ─── Barra visual del ciclo de crédito ──────────────────────────────────────
const CICLO_PASOS = [
  { key: 'pending',    icon: '📄', label: 'Emitida'     },
  { key: 'in_review',  icon: '🔵', label: 'En Revisión' },
  { key: 'paid',       icon: '🟡', label: 'Contador'    },
  { key: 'collected',  icon: '✅', label: 'Cobrada'     },
] as const;

const CICLO_ORDER: Record<string, number> = {
  pedido: -1, facturado: -1, pending: 0, in_review: 1, paid: 2, collected: 3, overdue: 0, manual_review: 1,
};

function CreditCycleBar({ status }: { status: string }) {
  const activeIdx = CICLO_ORDER[status] ?? 0;
  const isOverdue = status === 'overdue';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '12px 0 0' }}>
      {CICLO_PASOS.map((paso, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx && !isOverdue;
        const overduePaso = isOverdue && i === 0;
        return (
          <div key={paso.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: active || overduePaso ? 14 : 11,
                fontWeight: 800,
                background: done ? '#059669' : active ? '#2563eb' : overduePaso ? '#dc2626' : 'var(--paper-sunk)',
                color: done || active || overduePaso ? '#fff' : 'var(--ink-soft)',
                border: active ? '2px solid #1d4ed8' : overduePaso ? '2px solid #dc2626' : '2px solid transparent',
                boxShadow: active ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}>
                {done ? '✓' : overduePaso ? '!' : paso.icon}
              </div>
              <span style={{ fontSize: 9, color: active ? '#2563eb' : done ? '#059669' : 'var(--ink-soft)', fontWeight: active || done ? 700 : 400, marginTop: 3, whiteSpace: 'nowrap' }}>
                {overduePaso ? '🔴 Vencida' : paso.label}
              </span>
            </div>
            {i < CICLO_PASOS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#059669' : 'var(--line-soft)', margin: '0 2px', marginBottom: 14, transition: 'background 0.3s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chip de urgencia ───────────────────────────────────────────────────────
function UrgencyChip({ dueDate, status }: { dueDate: any; status: string }) {
  const days = useMemo(() => {
    if (!dueDate) return null;
    const d = typeof dueDate.toDate === 'function' ? dueDate.toDate() : new Date(dueDate);
    const diff = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [dueDate]);

  if (status === 'collected') return <span style={{ fontSize: 11, background: 'rgba(5,150,105,0.15)', color: '#059669', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>✅ Cobrada</span>;
  if (days === null) return null;

  let bg = 'rgba(37,99,235,0.12)', color = '#2563eb', txt = `Vence en ${days}d`;
  if (days <= 0) { bg = 'rgba(220,38,38,0.12)'; color = '#dc2626'; txt = days === 0 ? 'Vence HOY' : `Vencida hace ${Math.abs(days)}d`; }
  else if (days <= 5) { bg = 'rgba(217,119,6,0.12)'; color = '#d97706'; txt = `⚠️ Vence en ${days}d`; }
  else if (days <= 10) { bg = 'rgba(234,179,8,0.12)'; color = '#ca8a04'; }

  return (
    <span style={{ fontSize: 11, background: bg, color, padding: '2px 8px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {txt}
    </span>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function InvoiceDrawer({ invoice, order, dynamicConfig, onClose }: InvoiceDrawerProps) {
  const toast = useToast();
  const { orders } = useOrders();
  const { saveInvoice, deleteInvoice } = useInvoiceActions();
  const [localInvoice, setLocalInvoice] = useState<Invoice>(invoice);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  const hasChanges = JSON.stringify(invoice) !== JSON.stringify(localInvoice);

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

  // ── Validación CR duplicado en tiempo real ──
  const crActual = (localInvoice.collection?.contrareciboNumber || '').trim();
  const duplicateCr = useMemo(() => {
    if (!crActual || crActual === 'TH-' || crActual === 'GT-' || crActual.length < 3) return null;
    return findDuplicateContrarecibo(orders, crActual, localInvoice.id, order.id);
  }, [orders, crActual, localInvoice.id, order.id]);

  const handleSave = async () => {
    const rawCr = crActual.toUpperCase();
    const isTH = order.department === 'TH' || (order.client || '').toUpperCase().includes('TH');
    const isGT = order.department === 'GT' || (order.client || '').toUpperCase().includes('GT');

    if (isTH && rawCr.startsWith('GT-')) {
      toast('⚠️ Separación Estricta: Las facturas de TH no pueden llevar un contrarecibo GT.', 'bad');
      return;
    }
    if (isGT && rawCr.startsWith('TH-')) {
      toast('⚠️ Separación Estricta: Las facturas de GT no pueden llevar un contrarecibo TH.', 'bad');
      return;
    }
    if (duplicateCr) {
      toast(`🚨 Contrarecibo ${rawCr} ya existe en OC #${duplicateCr.orderFolio}. Corrige antes de guardar.`, 'bad');
      return;
    }

    await saveInvoice(order, localInvoice, dynamicConfig);
    onClose();
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      await generatePrefacturaPdf(order, localInvoice);
    } finally {
      setPdfBusy(false);
    }
  };

  // ── Acciones rápidas WhatsApp / Email / Copiar ──
  const monto = localInvoice.financials?.invoiceTotal ?? localInvoice.financials?.saleTotal ?? 0;
  const cr = extractCr(localInvoice, order);

  const handleWhatsApp = () => {
    const msg = generateCollectionNotice({
      folioFactura: localInvoice.folio || order.folio || 'S/N',
      contrarecibo: cr,
      cliente: order.client,
      monto,
      fechaVencimiento: localInvoice.creditCycle.dueDate,
    });
    openWhatsAppMessage(msg);
  };

  const handleEmail = () => {
    const draft = generateInstitutionalEmailDraft({
      folioFactura: localInvoice.folio || order.folio || 'S/N',
      contrarecibo: cr,
      cliente: order.client,
      monto,
      fechaVencimiento: localInvoice.creditCycle.dueDate,
    });
    openInstitutionalEmail(draft);
  };

  const handleCopyFolio = async () => {
    const folio = localInvoice.folio || order.folio || 'S/N';
    await copyToClipboard(`#${folio} — ${money(monto)}${cr ? ` — CR: ${cr}` : ''}`);
    setWaCopied(true);
    toast(`📋 Copiado: #${folio}`, 'ok');
    setTimeout(() => setWaCopied(false), 2000);
  };

  const isLate = localInvoice.creditCycle.status === 'overdue';

  return (
    <Drawer
      title={`Factura ${localInvoice.folio || order.folio || 'S/N'}`}
      onClose={onClose}
      side="right"
      width={480}
    >
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── ENCABEZADO + CICLO VISUAL ── */}
        <div className="glass-panel" style={{
          padding: '16px',
          borderRadius: 'var(--radius)',
          borderTop: `4px solid ${isLate ? 'var(--bad)' : localInvoice.creditCycle.status === 'collected' ? '#059669' : 'var(--accent)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 2 }}>Cliente</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{order.client}</div>
            </div>
            <UrgencyChip dueDate={localInvoice.creditCycle.dueDate} status={localInvoice.creditCycle.status} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Monto a Cobrar</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{money(monto)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Contrarecibo</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: cr ? 'var(--ok)' : 'var(--ink)' }}>
                {cr || 'Falta CR'}
              </div>
            </div>
          </div>

          {/* Barra del ciclo de crédito */}
          <CreditCycleBar status={localInvoice.creditCycle.status} />
        </div>

        {/* ── CONCEPTOS ── */}
        <Card title="📦 Conceptos & Subproductos">
          <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Kilos Facturados:</span>
            <strong className="mono" style={{ fontSize: 14 }}>{(localInvoice.kilos || 0).toLocaleString('es-MX')} kg</strong>
          </div>
          {localInvoice.collection?.notes && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 8, background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 6 }}>
              {localInvoice.collection.notes}
            </div>
          )}
          {localInvoice.items && localInvoice.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {localInvoice.items.map((it, idx) => (
                <div key={it.id || idx} style={{ background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 6, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{it.description}</div>
                    <div style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}>Clave SAT: {it.code || '24111500'}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 700 }}>
                    {(it.quantity || 0).toLocaleString('es-MX')} kg
                  </div>
                </div>
              ))}
            </div>
          ) : order.items && order.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 2 }}>
                Conceptos de la OC disponibles:
              </div>
              {order.items.map((it, idx) => (
                <div key={it.id || idx} style={{ background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 6, fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{it.description}</div>
                    <div style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}>Código: {it.code || 'S/C'}</div>
                  </div>
                  <div className="mono" style={{ fontWeight: 700 }}>
                    {(it.quantity || 0).toLocaleString('es-MX')} kg
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn"
                style={{ fontSize: 11.5, padding: '4px 10px', marginTop: 4, background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.3)', fontWeight: 700 }}
                onClick={() => {
                  const totalOcKilos = order.items!.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
                  const ratio = totalOcKilos > 0 ? ((localInvoice.kilos || totalOcKilos) / totalOcKilos) : 1;
                  const newItems = order.items!.map(it => {
                    const q = round2((Number(it.quantity) || 0) * ratio);
                    const p = it.unitPrice || dynamicConfig.salePricePerKg || 43;
                    return {
                      ...it,
                      quantity: q,
                      unitPrice: p,
                      amount: round2(q * p),
                    };
                  });
                  updateField(['items'], newItems);
                  toast(`📦 ${newItems.length} partidas de la OC vinculadas a la factura`, 'ok');
                }}
              >
                📦 Vincular {order.items.length} Partidas de la OC a esta Factura
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
              Concepto general de venta de polietileno.
            </div>
          )}
          <button
            type="button"
            className="btn"
            style={{ width: '100%', marginTop: 12, background: 'var(--paper)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 12.5 }}
            onClick={handleDownloadPdf}
            disabled={pdfBusy}
          >
            <span>📄</span> {pdfBusy ? 'Generando PDF...' : 'Descargar Prefactura PDF'}
          </button>
        </Card>

        {/* ── ACCIONES RÁPIDAS: WhatsApp / Email / Copiar ── */}
        <Card title="📲 Acciones Rápidas de Cobranza">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {/* Copiar folio */}
            <button
              type="button"
              onClick={handleCopyFolio}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: waCopied ? 'rgba(5,150,105,0.1)' : 'var(--paper-sunk)',
                border: waCopied ? '1px solid rgba(5,150,105,0.35)' : '1px solid var(--line-soft)',
                color: waCopied ? '#059669' : 'var(--ink)', transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 20 }}>{waCopied ? '✅' : '📋'}</span>
              {waCopied ? 'Copiado' : 'Copiar Folio'}
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsApp}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.3)', color: '#128c7e',
              }}
            >
              <span style={{ fontSize: 20 }}>💬</span>
              WhatsApp
            </button>

            {/* Email */}
            <button
              type="button"
              onClick={handleEmail}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 4, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.25)', color: '#2563eb',
              }}
            >
              <span style={{ fontSize: 20 }}>📧</span>
              Email
            </button>
          </div>

          {/* Info de qué va a enviar */}
          <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--ink-soft)', background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 6 }}>
            Factura <strong>#{localInvoice.folio || 'S/N'}</strong>
            {cr && <> · CR <strong>{cr}</strong></>}
            {' · '}<strong className="mono">{money(monto)}</strong>
            {localInvoice.creditCycle.dueDate && <> · Vence: <strong>{fmtDate(localInvoice.creditCycle.dueDate)}</strong></>}
          </div>
        </Card>

        {/* ── CICLO DE CRÉDITO (edición) ── */}
        <Card title="Ciclo de Crédito">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Fecha Emisión">
              <input
                type="date"
                value={toInputDate(localInvoice.creditCycle.issueDate) || ''}
                onChange={e => {
                  if (e.target.value) {
                    const d = new Date(e.target.value + 'T12:00:00');
                    updateField(['creditCycle', 'issueDate'], Timestamp.fromDate(d));
                  }
                }}
              />
            </Field>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Fecha Vencimiento (Promesa de Pago)</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn-small"
                    style={{ fontSize: 10.5, padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: '1px solid #3b82f6', fontWeight: 700 }}
                    onClick={() => {
                      const base = localInvoice.creditCycle.issueDate ? (typeof (localInvoice.creditCycle.issueDate as any).toDate === 'function' ? (localInvoice.creditCycle.issueDate as any).toDate() : new Date(localInvoice.creditCycle.issueDate as any)) : new Date();
                      const d = new Date(base);
                      d.setDate(d.getDate() + 30);
                      updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(d));
                      toast('📅 Vencimiento calculado a +30 días', 'ok');
                    }}
                  >
                    ⚡ +30d Providencia
                  </button>
                  <button
                    type="button"
                    className="btn-small"
                    style={{ fontSize: 10.5, padding: '2px 6px', background: 'var(--paper-sunk)' }}
                    onClick={() => {
                      const base = new Date();
                      const d = new Date(base);
                      d.setDate(d.getDate() + 15);
                      updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(d));
                    }}
                  >
                    +15d
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={toInputDate(localInvoice.creditCycle.dueDate) || ''}
                onChange={e => {
                  if (e.target.value) {
                    const d = new Date(e.target.value + 'T12:00:00');
                    updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(d));
                  }
                }}
              />
            </div>

            {/* Folio Contrarecibo */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Folio Contrarecibo</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn-small"
                    style={{ fontSize: 10.5, padding: '2px 6px', fontWeight: 800, background: crActual.startsWith('TH-') ? '#3b82f6' : 'var(--paper-sunk)', color: crActual.startsWith('TH-') ? '#fff' : 'var(--ink)' }}
                    onClick={() => {
                      const current = crActual.replace(/^[A-Z]+-?/i, '');
                      updateField(['collection', 'contrareciboNumber'], `TH-${current}`);
                    }}
                  >
                    🟦 TH-
                  </button>
                  <button
                    type="button"
                    className="btn-small"
                    style={{ fontSize: 10.5, padding: '2px 6px', fontWeight: 800, background: crActual.startsWith('GT-') ? '#8b5cf6' : 'var(--paper-sunk)', color: crActual.startsWith('GT-') ? '#fff' : 'var(--ink)' }}
                    onClick={() => {
                      const current = crActual.replace(/^[A-Z]+-?/i, '');
                      updateField(['collection', 'contrareciboNumber'], `GT-${current}`);
                    }}
                  >
                    🟪 GT-
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={localInvoice.collection?.contrareciboNumber ?? ''}
                onChange={e => updateField(['collection', 'contrareciboNumber'], e.target.value.toUpperCase())}
                placeholder="Ej. GT-123 o TH-842"
                style={{ fontWeight: 700, fontFamily: 'monospace', borderColor: duplicateCr ? '#dc2626' : undefined }}
              />
              {/* Alerta CR duplicado */}
              {duplicateCr && (
                <div style={{ marginTop: 6, padding: '7px 10px', borderRadius: 7, background: 'rgba(220,38,38,0.09)', border: '1px solid rgba(220,38,38,0.3)', fontSize: 11.5, color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🚨</span>
                  <div>
                    CR <strong>{duplicateCr.matchedValue}</strong> ya registrado en OC <strong>#{duplicateCr.orderFolio}</strong>
                    {duplicateCr.invoiceFolio && <> · Factura <strong>#{duplicateCr.invoiceFolio}</strong></>}
                    {duplicateCr.dateStr && <span style={{ fontWeight: 400, opacity: 0.8 }}> ({duplicateCr.dateStr})</span>}
                  </div>
                </div>
              )}
            </div>

            <Field label="Estatus Cobranza">
              <select
                value={localInvoice.creditCycle.status}
                onChange={e => updateField(['creditCycle', 'status'], e.target.value)}
              >
                <option value="pending">📄 Por Cobrar</option>
                <option value="in_review">🔵 Enviada — En Revisión (Esperando CR)</option>
                <option value="overdue">🔴 Atrasada / Vencida</option>
                <option value="paid">🟡 Pagada por Cliente (Falta depósito)</option>
                <option value="collected">✅ En Caja / Depositada</option>
              </select>
            </Field>
          </div>
        </Card>

        {/* ── ACCIONES ── */}
        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', fontWeight: 700, borderRadius: 8 }}
            onClick={async () => {
              await deleteInvoice(order, invoice.id);
              onClose();
            }}
          >
            🗑️ Eliminar / Archivar
          </button>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn"
            style={{ flex: 1, background: 'var(--accent)', color: '#fff', opacity: (hasChanges && !duplicateCr) ? 1 : 0.5, fontWeight: 700 }}
            onClick={handleSave}
            disabled={!hasChanges || !!duplicateCr}
          >
            Guardar Cambios
          </button>
        </div>

      </div>
    </Drawer>
  );
}
