import { useState } from 'react';
import { money, fmtDayAndDate, toDate, nombreClienteVisible } from '../../lib/format';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { QuickCollectionModal } from '../FastFlows/QuickCollectionModal';

interface FacturasSinCRPanelProps {
  orders: PurchaseOrder[];
}

export function FacturasSinCRPanel({ orders }: FacturasSinCRPanelProps) {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Filtrar facturas emitidas que NO tienen número de contrarecibo capturado
  const facturasSinCR: { order: PurchaseOrder; invoice: Invoice; dias: number; issueDateObj: Date | null }[] = [];
  const hoy = Date.now();

  orders.forEach((o) => {
    if (o.isClosedShort) return;
    (o.invoices || []).forEach((inv) => {
      const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
      const st = inv.creditCycle?.status;
      // Consideramos facturas que ya tienen folio y están en ciclo de cobro o facturadas pero sin CR
      if (!cr && (st === 'facturado' || st === 'pending' || st === 'overdue' || (inv.folio && inv.folio.length > 0))) {
        let dias = 0;
        const dt = toDate(inv.creditCycle?.issueDate);
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: '6px 12px', fontWeight: 800 }}
                    onClick={() => setSelectedOrder(order)}
                  >
                    📝 Asignar CR
                  </button>
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
    </>
  );
}
