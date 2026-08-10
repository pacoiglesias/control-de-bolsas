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
            // FIX 2026-08-09: sumaba el total bruto de la factura sin
            // restar lo que el cliente ya hubiera abonado parcialmente
            // (`collection.paidAmount`) -- las tarjetas "Cobro a 7/15 Días"
            // de este mismo Dashboard (src/lib/finance.ts) sí netean ese
            // abono, así que esta proyección podía mostrar más dinero del
            // que en realidad falta por cobrar. Se aplica el mismo criterio
            // aquí para que ambas cifras sean consistentes entre sí.
            const saldo = (inv.financials?.invoiceTotal || 0) - (inv.collection?.paidAmount || 0);
            expectedIn += Math.max(0, saldo);
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
        <div style={{ fontWeight: 600, fontSize: 13, opacity: 0.9 }}>Proyección a 30 Días (Cuentas por Cobrar)</div>
        {/* FIX 2026-08-09: aclara que esta cifra usa un criterio distinto
            (fecha de vencimiento en calendario, ventana fija de 30 días) al
            de las tarjetas "Cobro a 7/15 Días" (que ajustan la fecha
            esperada según el tiempo real que tarda cada cliente en pagar).
            Antes no había ninguna indicación de que fueran dos métodos
            distintos, así que podían parecer números contradictorios en
            vez de dos vistas complementarias del mismo flujo. */}
        <div style={{ fontSize: 11, opacity: 0.8 }}>Flujo de caja estimado por fecha de vencimiento (ventana fija de 30 días; distinto del cálculo predictivo de las tarjetas "Cobro a 7/15 Días").</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>
        +{money(projection)}
      </div>
    </div>
  );
}
