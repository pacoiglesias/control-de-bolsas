import { useState } from 'react';
import { money, fmtDayAndDate, toDate, nombreClienteVisible } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { QuickCollectionModal } from '../FastFlows/QuickCollectionModal';
import { QuickPeekDrawer } from './QuickPeekDrawer';
import { KebabMenu, type KebabMenuItem } from '../ui/KebabMenu';
import { useToast } from '../../context/ToastContext';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { generateInstitutionalEmailDraft, openInstitutionalEmail, copyToClipboard } from '../../lib/whatsappReminder';
import { generatePrefacturaPdf } from '../../lib/prefacturaGenerator';
import { triggerHaptic, playSoftClick } from '../../lib/hapticEngine';

interface FacturasSinCRPanelProps {
  orders: PurchaseOrder[];
  onOpenOrder?: (order: PurchaseOrder) => void;
}

export function FacturasSinCRPanel({ orders, onOpenOrder }: FacturasSinCRPanelProps) {
  const toast = useToast();
  const { settings } = useSystemSettings();
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [peekOrder, setPeekOrder] = useState<PurchaseOrder | null>(null);

  // Filtrar facturas emitidas que NO tienen número de contrarecibo capturado y siguen pendientes de cobro
  const facturasSinCR: { order: PurchaseOrder; invoice: Invoice; dias: number; issueDateObj: Date | null }[] = [];
  const hoy = Date.now();

  orders.forEach((o) => {
    if (o.isClosedShort || o.client === 'MIGRACION') return;
    if (o.creditCycle?.status === 'collected') return;

    (o.invoices || []).forEach((inv) => {
      const cr = extractCr(inv, o);
      const st = inv.creditCycle?.status;
      const totalInv = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
      const paidAmt = inv.collection?.paidAmount || 0;
      
      // Si ya tiene CR, o si ya está cobrada/pagada, NO está en espera de CR
      if (cr) return;
      if (st === 'paid' || st === 'collected' || (paidAmt >= totalInv && totalInv > 0)) return;
      if ((inv.kilos || 0) <= 0 && totalInv <= 0) return;

      // Factura emitida genuinamente que aún no recibe CR
      if (st === 'facturado' || st === 'manual_review' || (inv.folio && inv.folio.trim().length > 0)) {
        let dias = 0;
        const dt = toDate(inv.creditCycle?.issueDate || o.estimatedDeliveryDate || o.processedAt);
        if (dt) {
          dias = Math.max(0, Math.round((hoy - dt.getTime()) / 86400000));
        }
        facturasSinCR.push({ order: o, invoice: inv, dias, issueDateObj: dt });
      }
    });
  });

  if (facturasSinCR.length === 0) return null;

  const totalPendienteCR = facturasSinCR.reduce(
    (acc, f) => acc + (f.invoice.financials?.invoiceTotal ?? f.invoice.financials?.saleTotal ?? 0),
    0
  );

  const buildKebabItems = (order: PurchaseOrder, invoice: Invoice, total: number): KebabMenuItem[] => {
    return [
      {
        icon: '🔍',
        label: 'Vista Rápida (Quick Peek)',
        sublabel: 'Desglose de kilos y facturas',
        onClick: () => {
          playSoftClick();
          setPeekOrder(order);
        },
      },
      {
        icon: '🗂️',
        label: 'Asignar Contrarecibo',
        sublabel: `Capturar folio de ${settings.clientShortName || 'Providencia'}`,
        tone: 'primary',
        onClick: () => {
          playSoftClick();
          setSelectedOrder(order);
        },
      },
      ...(onOpenOrder ? [{
        icon: '👁️',
        label: 'Abrir Expediente',
        sublabel: 'Ver detalle de orden',
        onClick: () => {
          playSoftClick();
          onOpenOrder(order);
        },
      }] : []),
      {
        icon: '📄',
        label: 'Descargar Prefactura PDF',
        sublabel: 'Generar comprobante para cobro',
        onClick: async () => {
          try {
            playSoftClick();
            await generatePrefacturaPdf(order, invoice);
            triggerHaptic('success');
            toast('📄 Prefactura PDF generada exitosamente.', 'ok');
          } catch (e: any) {
            toast(`Error generando PDF: ${e.message}`, 'bad');
          }
        },
      },
      {
        dividerBefore: true,
        icon: '✉️',
        label: 'Correo Institucional',
        sublabel: 'Solicitar CR a Cuentas por Pagar',
        tone: 'accent',
        onClick: () => {
          playSoftClick();
          const draft = generateInstitutionalEmailDraft({
            folioFactura: invoice.folio || order.folio || 'S/F',
            cliente: nombreClienteVisible(order.client),
            monto: total,
            fechaVencimiento: invoice.creditCycle?.dueDate,
            managerTH: settings?.managerTH,
            managerGT: settings?.managerGT,
            deptNameTH: settings?.deptNameTH,
            deptNameGT: settings?.deptNameGT,
          });
          openInstitutionalEmail(draft);
        },
      },
      {
        icon: '📋',
        label: 'Copiar Datos para Correo',
        sublabel: `#${invoice.folio || 'S/F'} · ${money(total)}`,
        onClick: async () => {
          playSoftClick();
          const draft = generateInstitutionalEmailDraft({
            folioFactura: invoice.folio || order.folio || 'S/F',
            cliente: nombreClienteVisible(order.client),
            monto: total,
            fechaVencimiento: invoice.creditCycle?.dueDate,
            managerTH: settings?.managerTH,
            managerGT: settings?.managerGT,
            deptNameTH: settings?.deptNameTH,
            deptNameGT: settings?.deptNameGT,
          });
          await copyToClipboard(draft.body);
          triggerHaptic('success');
          toast('📋 Datos de la factura para correo copiados.', 'ok');
        },
      },
    ];
  };

  return (
    <>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(217,119,6,0.12) 100%)',
          border: '1px solid var(--accent)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 24,
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⏳</span> Facturas Emitidas en Espera de Contrarecibo
              <span className="badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: 11 }}>
                {facturasSinCR.length} factura{facturasSinCR.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
              Estas facturas ya fueron emitidas pero Providencia aún no te asigna número de contrarecibo.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', fontWeight: 700 }}>Importe Total sin CR:</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{money(totalPendienteCR)}</div>
          </div>
        </div>

        {/* Vista Móvil / Cuadrícula de Tarjetas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {facturasSinCR.map(({ order, invoice, dias, issueDateObj }, idx) => {
            const total = invoice.financials?.invoiceTotal ?? invoice.financials?.saleTotal ?? 0;
            return (
              <div
                key={idx}
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
                      Factura #{invoice.folio || 'S/F'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      {order.folio || order.oc || 'S/OC'} • {nombreClienteVisible(order.client)}
                    </div>
                  </div>
                  <span className={`badge ${dias > 5 ? 'b-bad' : dias > 2 ? 'b-warn' : 'b-info'}`} style={{ fontSize: 10 }}>
                    {dias === 0 ? 'Hoy' : `${dias} d`}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-soft)', paddingTop: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                      {invoice.kilos ? `${invoice.kilos.toLocaleString('es-MX')} kg` : '—'} • {issueDateObj ? fmtDayAndDate(issueDateObj) : 'Sin fecha'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>
                      {money(total)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: 11, padding: '5px 10px', fontWeight: 800 }}
                      onClick={() => setSelectedOrder(order)}
                    >
                      📝 CR
                    </button>
                    <KebabMenu
                      items={buildKebabItems(order, invoice, total)}
                      align="right"
                      title="Opciones de factura"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedOrder && (
        <QuickCollectionModal
          orders={[selectedOrder]}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {peekOrder && (
        <QuickPeekDrawer
          order={peekOrder}
          onClose={() => setPeekOrder(null)}
          onOpenFullOrder={(id) => {
            const found = orders.find((x) => x.id === id);
            if (found && onOpenOrder) onOpenOrder(found);
          }}
        />
      )}
    </>
  );
}
