import type { ParsedProvidenciaPaymentData } from '../../lib/providenciaPortalParser';
import { money } from '../../lib/format';

export function ProvidenciaPaymentRows({ payment }: { payment: ParsedProvidenciaPaymentData }) {
  return <section aria-label="Desglose del pago Providencia" style={{ color: 'var(--ink)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 10, padding: 14 }}>
    <strong>{payment.transferRef} · {money(payment.amount)}</strong>
    <p style={{ fontSize: 12 }}>El importe se distribuye por factura; no se asigna completo a una sola orden.</p>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', fontSize: 12 }}><thead><tr><th>Factura</th><th>Contrarrecibo</th><th>Fecha de pago</th><th>Importe</th></tr></thead><tbody>
      {(payment.allocations || []).map((row,index) => <tr key={index}><td>{row.facturaFolio}</td><td>{row.contrareciboNumber}</td><td>{row.paymentDate}</td><td>{money(row.amount)}</td></tr>)}
    </tbody></table></div>
    {payment.allocationError && <p role="alert">{payment.allocationError}</p>}
  </section>;
}
