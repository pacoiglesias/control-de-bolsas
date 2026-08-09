import { useMemo } from 'react';
import { PurchaseOrder } from '../../lib/types';
import { money } from '../../lib/format';

export function CashflowProjection({ orders }: { orders: PurchaseOrder[] }) {
  const projection = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    
    let expectedIn = 0;
    
    for (const o of orders) {
      if (!o.invoices) continue;
      for (const inv of o.invoices) {
        if (inv.creditCycle.status !== 'paid' && inv.creditCycle.dueDate) {
          const dueMs = inv.creditCycle.dueDate.toMillis?.() || 0;
          if (dueMs > now && dueMs <= now + thirtyDaysMs) {
            expectedIn += (inv.financials?.invoiceTotal || 0);
          }
        }
      }
    }
    
    return expectedIn;
  }, [orders]);

  if (projection === 0) return null;

  return (
    <div style={{ background: 'var(--info)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, opacity: 0.9 }}>Proyeccin a 30 Das (Cuentas por Cobrar)</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>Flujo de caja estimado basado en fechas de vencimiento de facturas.</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        +{money(projection)}
      </div>
    </div>
  );
}
