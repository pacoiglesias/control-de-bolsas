import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { buildReceivables } from '../../lib/receivables';
import { money } from '../../lib/format';
import '../Upload/captureReview.css';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
interface Props {
  open: boolean; onClose: () => void; saldoCaja: number; saldoAndres: number;
  orders?: PurchaseOrder[]; config?: FinancialConfig; userEmail?: string | null; onRefreshData?: () => void;
}
/** A review of recorded balances. Corrections belong to their source transaction. */
export function ConsolaCuadreEjecutivoModal({open,onClose,saldoCaja,saldoAndres,orders=[],config}:Props) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(open && !dialog.current?.open) dialog.current?.showModal();
    if(!open && dialog.current?.open) dialog.current.close();
  },[open]);
  const totals=buildReceivables(orders,config);
  const incomplete=totals.rows.filter(r=>!r.invoice.uuid || (r.invoice as any).quantityPending);
  const pendingCash=totals.rows.filter(r=>r.paid>0 && !r.invoice.collection?.collectedAt);
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} className="review-dialog" aria-labelledby="review-title">
    <div className="review-dialog-head"><div><span className="work-eyebrow">Revisión de registros</span><h2 id="review-title">¿De dónde salen mis saldos?</h2></div><button className="btn" onClick={onClose} aria-label="Cerrar revisión">Cerrar ×</button></div>
    <p className="work-muted">Calculado con las facturas y movimientos guardados. Abre el registro de origen para comprobar o corregir una diferencia.</p>
    <div className="work-stats">
      <div><small>Por cobrar al cliente</small><strong>{money(totals.total)}</strong></div>
      <div><small>Caja según movimientos</small><strong>{money(saldoCaja)}</strong></div>
      <div><small>{saldoAndres<0?'Pendiente de pagar a Andrés':'Anticipo disponible con Andrés'}</small><strong>{money(Math.abs(saldoAndres))}</strong></div>
    </div>
    <h3>La cartera, paso a paso</h3>
    <dl className="review-equation"><div><dt>Facturas registradas</dt><dd>{money(totals.invoiced)}</dd></div><div><dt>Menos pagos acreditados del cliente</dt><dd>− {money(totals.paid)}</dd></div><div><dt>Saldo pendiente</dt><dd>{money(totals.total)}</dd></div><div><dt>Con contrarrecibo · {totals.crCount} documentos</dt><dd>{money(totals.withCR)}</dd></div><div><dt>Falta contrarrecibo</dt><dd>{money(totals.withoutCR)}</dd></div></dl>
    <div className="work-callout"><strong>Qué falta comprobar</strong><p>{incomplete.length} facturas requieren completar UUID o conceptos y kilos. {pendingCash.length} facturas tienen pago acreditado pendiente de confirmar como ingreso recibido.</p><p>El pago del cliente no se suma a caja hasta registrar su recepción. El saldo de caja también requiere sus comprobantes y arqueo físico.</p></div>
    <nav className="work-actions" aria-label="Revisar registros"><Link className="btn" onClick={onClose} to="/cobranza">Revisar cobranza →</Link><Link className="btn" onClick={onClose} to="/archivo-documentos">Ver documentos y faltantes →</Link><Link className="btn" onClick={onClose} to="/caja-chica">Revisar caja →</Link></nav>
  </dialog>;
}
