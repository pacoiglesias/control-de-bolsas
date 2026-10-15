import type { PurchaseOrder } from './types';
import { round2 } from './finance';

export interface PortalReceiptRow { cr: string; issueDate: string; dueDate: string; total: number; paid: number; remaining: number; status: string }
export interface PortalInvoiceRow { folio: string; oc: string; issueDate: string; total: number }
export interface RepAllocation { folio: string; uuid: string; previous: number; paid: number; remaining: number; installment: number }
export interface ProvidenciaEvidence {
  kind: 'receipt_list' | 'invoice_list' | 'payment_rep';
  title: string; capturedDate: string; total: number; sourceCount: number; partial: boolean;
  receipts: PortalReceiptRow[]; invoices: PortalInvoiceRow[]; allocations: RepAllocation[];
  uuid: string; folio: string; paymentDate: string; warnings: string[];
}
const number = (s: string) => Number(s.replace(/,/g, ''));
const isoDate = (s: string) => { const [d,m,y] = s.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; };
const uuidPattern = '[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}';
export function parseProvidenciaEvidence(text: string): ProvidenciaEvidence | null {
  const flat = text.replace(/\s+/g,' ');
  const base: ProvidenciaEvidence = { kind: 'receipt_list', title: '', capturedDate: '', total: 0, sourceCount: 0, partial: false, receipts: [], invoices: [], allocations: [], uuid: '', folio: '', paymentDate: '', warnings: [] };
  const captured = flat.match(/\b(\d{2}\/\d{2}\/\d{4})\s*-/);
  base.capturedDate = captured ? isoDate(captured[1]) : '';
  if (/COMPLEMENTO\s+DE\s+PAGOS/i.test(flat) && /DOCUMENTO\s+RELACIONADO/i.test(flat)) {
    base.kind='payment_rep'; base.title='Complemento de pagos';
    base.folio=flat.match(/Complemento\s+de\s+Pagos\s+(\d+)/i)?.[1] || '';
    base.uuid=flat.match(new RegExp(uuidPattern,'i'))?.[0].toUpperCase() || '';
    base.paymentDate=flat.match(/Fecha\s+de\s+Pago\s+(\d{4}-\d{2}-\d{2})/i)?.[1] || '';
    base.total=number(flat.match(/Monto\s+total\s+de\s+los\s+pagos\s*\$?\s*([\d,]+\.\d{2})/i)?.[1] || '0');
    for (const section of flat.split(/DOCUMENTO\s+RELACIONADO\s+\d+/i).slice(1)) {
      const folio=section.match(/\bFolio\s+(\d+)/i)?.[1] || '';
      // Printed UUIDs wrap around the Folio column; preserve both fragments.
      const id=section.match(/Id\s+Documento\s+([A-F0-9-]+)\s+Folio\s+\d+\s+([A-F0-9-]+)\s+Moneda/i);
      const uuid=id ? (id[1]+id[2]).toUpperCase() : section.match(new RegExp(uuidPattern,'i'))?.[0].toUpperCase() || '';
      const previous=number(section.match(/Imp\.?\s*Saldo\s*Ant\.?\s*\$?\s*([\d,]+\.\d{2})/i)?.[1] || '0');
      const paid=number(section.match(/Imp\.?\s*Pagado\s*\$?\s*([\d,]+\.\d{2})/i)?.[1] || '0');
      const remaining=number(section.match(/Imp\.?\s*Saldo\s*Insoluto\s*\$?\s*([\d,]+\.\d{2})/i)?.[1] || '0');
      const installment=Number(section.match(/Num\.?\s*Parcialidad\s+(\d+)/i)?.[1] || 0);
      base.allocations.push({folio,uuid,previous,paid,remaining,installment});
    }
    base.sourceCount=base.allocations.length;
    if (!base.uuid || !base.paymentDate || !base.total || base.allocations.some(r => !r.folio || !new RegExp('^'+uuidPattern+'$','i').test(r.uuid) || r.paid<=0 || Math.abs(round2(r.previous-r.paid)-r.remaining)>0.01)) base.warnings.push('Faltan datos fiscales o no cuadran los saldos de los documentos relacionados. Revisa el XML del complemento.');
    if (Math.abs(round2(base.allocations.reduce((s,r)=>s+r.paid,0))-base.total)>0.01) base.warnings.push('La suma de los documentos relacionados no coincide con el monto del pago.');
    return base;
  }
  if (/Contrarecibo\s+Total\s+Pagado\s+Pendiente/i.test(flat)) {
    base.title=/Estatus:\s*PAGADO/i.test(flat) ? 'Contrarrecibos pagados' : 'Contrarrecibos generados';
    const row=/\b\d+\s+((?:TH|GT)-\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(?:PMX|MXN)\s+[\d.]+\s+(PAGADO|GENERADO)/gi;
    for (const m of flat.matchAll(row)) base.receipts.push({cr:m[1].toUpperCase(),issueDate:isoDate(m[2]),dueDate:isoDate(m[3]),total:number(m[4]),paid:number(m[5]),remaining:number(m[6]),status:m[7].toUpperCase()});
    if (!base.receipts.length) base.warnings.push('No se pudieron leer las filas del listado de contrarrecibos.');
    if (base.receipts.some(r=>Math.abs(round2(r.total-r.paid)-r.remaining)>0.01)) base.warnings.push('Hay un contrarrecibo cuyo total no coincide con pagado más pendiente.');
    base.total=round2(base.receipts.reduce((s,r)=>s+r.total,0));
  } else if (/Receptor\s+O\s*C\s+Versi[oó]n\s+Tipo\s+Folio/i.test(flat)) {
    base.kind='invoice_list';base.title='Facturas del portal';
    // The invoice date wraps across two lines around the portal submission date.
    const row=/\b\d+\s+[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\s+(\d{10,14})\s+4\.0\s+I\s+(\d+)\s+(\d{4}-\d{2}-)\s+(?:\d{1,2}\/[A-Za-zÁÉÍÓÚáéíóú]+\/\d{4})\s+([\d,]+\.\d{2})\s+(\d{2}T\d{2}:\d{2}:\d{2})/g;
    for(const m of flat.matchAll(row)) base.invoices.push({oc:m[1],folio:m[2],issueDate:m[3]+m[5],total:number(m[4])});
    if (!base.invoices.length) base.warnings.push('No se pudieron leer las filas del panel de facturas.');
    base.total=round2(base.invoices.reduce((s,r)=>s+r.total,0));
  } else return null;
  base.sourceCount=Number(flat.match(/(\d+)\s+resultados/i)?.[1] || base.receipts.length || base.invoices.length);
  base.partial=base.sourceCount>(base.receipts.length || base.invoices.length);
  if (base.partial) base.warnings.push(`Listado parcial: ${base.receipts.length || base.invoices.length} filas visibles de ${base.sourceCount}. Faltan las demás páginas del portal.`);
  return base;
}

export function evidenceRequirements(e: ProvidenciaEvidence, orders: PurchaseOrder[]): string[] {
  const requirements = [...e.warnings];
  const invoices=orders.filter(o=>!o.isDeleted).flatMap(order=>(order.invoices||[]).map(invoice=>({order,invoice})));
  for(const row of e.invoices) {
    const matches=invoices.filter(t=>String(t.invoice.folio)===row.folio);
    if(!matches.length) requirements.push(`Capturar XML/PDF de factura ${row.folio} · OC ${row.oc} · $${row.total.toFixed(2)}.`);
    else if(matches.length>1 || matches.some(t=>Math.abs((t.invoice.financials?.invoiceTotal||0)-row.total)>0.01 || (t.order.oc && t.order.oc!==row.oc))) requirements.push(`Conciliar factura ${row.folio}: importe u OC no coinciden con el portal.`);
  }
  for(const row of e.receipts) {
    const matches=invoices.filter(t=>(t.invoice.collection?.contrareciboNumber || (t.order.invoices?.length===1 ? t.order.collection?.contrareciboNumber : ''))===row.cr);
    if(!matches.length) requirements.push(`Capturar detalle de contrarrecibo ${row.cr} y sus facturas · $${row.total.toFixed(2)} · ${row.status.toLowerCase()}.`);
    else {
      const total=round2(matches.reduce((s,t)=>s+(t.invoice.financials?.invoiceTotal||0),0));
      if(Math.abs(total-row.total)>0.01) requirements.push(`Conciliar ${row.cr}: facturas por $${total.toFixed(2)} frente a $${row.total.toFixed(2)} del portal.`);
      if(row.status==='PAGADO' && matches.some(t=>!['paid','collected'].includes(t.invoice.creditCycle?.status))) requirements.push(`Capturar detalle de pago o REP de ${row.cr}; el portal indica pagado, pero no identifica transferencia ni fecha de pago.`);
    }
  }
  for(const row of e.allocations) {
    const matches=invoices.filter(t=>t.invoice.uuid?.toUpperCase()===row.uuid);
    if(matches.length!==1) requirements.push(`Capturar XML/PDF de factura ${row.folio} con UUID ${row.uuid} para vincular el complemento ${e.folio}.`);
    else if(!['paid','collected'].includes(matches[0].invoice.creditCycle?.status)) requirements.push(`Conciliar cobro de factura ${row.folio}: $${row.paid.toFixed(2)} el ${e.paymentDate}. Vincular transferencia para no duplicar el pago y su REP.`);
  }
  return [...new Set(requirements)];
}
