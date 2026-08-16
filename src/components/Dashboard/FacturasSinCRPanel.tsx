import { useState } from 'react';
import { money, fmtDate } from '../../lib/format';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { QuickCollectionModal } from '../FastFlows/QuickCollectionModal';

interface FacturasSinCRPanelProps {
  orders: PurchaseOrder[];
}

export function FacturasSinCRPanel({ orders }: FacturasSinCRPanelProps) {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Filtrar facturas emitidas que NO tienen número de contrarecibo capturado
  const facturasSinCR: { order: PurchaseOrder; invoice: Invoice; dias: number }[] = [];
  const hoy = Date.now();

  orders.forEach((o) => {
    (o.invoices || []).forEach((inv) => {
      const cr = (inv.collection?.contrareciboNumber || '').trim();
      const st = inv.creditCycle.status;
      // Consideramos facturas que ya tienen folio y están en ciclo de cobro o facturadas pero sin CR
      if (!cr && (st === 'facturado' || st === 'pending' || st === 'overdue' || (inv.folio && inv.folio.length > 0))) {
        let dias = 0;
        if (inv.creditCycle.issueDate) {
          const ts = (inv.creditCycle.issueDate as any).toMillis?.() ?? new Date(inv.creditCycle.issueDate as any).getTime();
          if (ts) dias = Math.max(0, Math.round((hoy - ts) / 86400000));
        }
        facturasSinCR.push({ order: o, invoice: inv, dias });
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
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 22,
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⏳</span> Facturas Emitidas en Espera de Contrarecibo
              <span className="badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: 11 }}>
                {facturasSinCR.length} factura{facturasSinCR.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              Estas facturas ya fueron emitidas pero Providencia aún no te asigna número de contrarecibo.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Importe Total por Registrar:</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{money(totalPendienteCR)}</div>
          </div>
        </div>

        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--ink-faint)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Factura</th>
                <th style={{ padding: '6px 8px' }}>OC / Cliente</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Kilos</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Monto con IVA</th>
                <th style={{ padding: '6px 8px' }}>Emisión</th>
                <th style={{ padding: '6px 8px' }}>Antigüedad</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {facturasSinCR.map(({ order, invoice, dias }, idx) => {
                const total = invoice.financials?.invoiceTotal ?? invoice.financials?.saleTotal ?? 0;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '8px', fontWeight: 700, fontFamily: 'monospace' }}>
                      #{invoice.folio || 'S/F'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ fontWeight: 600 }}>{order.folio || order.oc || 'S/OC'}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{order.client || 'Providencia'}</div>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {invoice.kilos ? `${invoice.kilos.toLocaleString('es-MX')} kg` : '—'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
                      {money(total)}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--ink-soft)' }}>
                      {fmtDate(invoice.creditCycle.issueDate) || '—'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span className={`badge ${dias > 5 ? 'b-bad' : dias > 2 ? 'b-warn' : 'b-info'}`} style={{ fontSize: 10 }}>
                        {dias === 0 ? 'Hoy' : `${dias} día${dias > 1 ? 's' : ''}`}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
                          onClick={() => setSelectedOrder(order)}
                          title="Capturar número y fecha de contrarecibo localmente"
                        >
                          📝 Asignar CR
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '4px 8px', borderColor: 'var(--line)', color: 'var(--ink)' }}
                          onClick={() => {
                            window.location.href = `/ordenes?abrir=${order.id}`;
                          }}
                          title="Ver expediente de la orden"
                        >
                          📂 Ver OC
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
