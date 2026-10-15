import { expect,it } from 'vitest';
import { parseProvidenciaEvidence,evidenceRequirements } from '../providenciaEvidence';
import type { PurchaseOrder } from '../types';

const paid=`15/10/2026 - 01:57:46 p. m. Estatus: PAGADO
116 resultados, página 1 de 5. No Contrarecibo Total Pagado Pendiente Moneda TC Estatus
1 GT-100 31/08/2026 30/09/2026 1,160.00 1,160.00 0.00 PMX 1 PAGADO
2 TH-101 31/08/2026 30/09/2026 2,320.00 2,320.00 0.00 PMX 1 PAGADO`;
const panel=`187 resultados, página 1 de 8.
No. Receptor O C Versión Tipo Folio Factura Total Stat DOCA XML PDF
1 GTP930115PU1 12026439999 4.0 I 9991 2026-10- 12/Octubre/2026 1,160.00
12T17:31:34
2 GTP930115PU1 120267119999 4.0 I 9992 2026-10- 12/Octubre/2026 2,320.00
12T17:29:54`;
const rep=`Complemento de Pagos 9999 FOLIO FISCAL (UUID) AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB
Fecha de Pago 2026-10-13T00:00:00 Monto $ 3,480.00
DOCUMENTO RELACIONADO 1
Id Documento CCCCCCCC-1111-2222-3333- Folio 9991 DDDDDDDDDDDD
Moneda MXN Num. Parcialidad 1 Imp. Saldo Ant. $ 1,160.00
Imp. Pagado $ 1,160.00 Imp. Saldo Insoluto $ 0.00
DOCUMENTO RELACIONADO 2
Id Documento EEEEEEEE-1111-2222-3333- Folio 9992 FFFFFFFFFFFF
Moneda MXN Num. Parcialidad 1 Imp. Saldo Ant. $ 2,320.00
Imp. Pagado $ 2,320.00 Imp. Saldo Insoluto $ 0.00
Monto total de los pagos $ 3,480.00 TIPO DE COMPROBANTE P - Pago TOTAL 0.00`;
it('lee todas las filas pagadas y advierte las páginas que faltan sin inventar fecha de pago',()=>{
 const e=parseProvidenciaEvidence(paid)!;expect(e.receipts).toHaveLength(2);expect(e.total).toBe(3480);expect(e.sourceCount).toBe(116);expect(e.partial).toBe(true);expect(e.paymentDate).toBe('');
 expect(e.receipts[0]).toMatchObject({cr:'GT-100',paid:1160,remaining:0,dueDate:'2026-09-30'});
 expect(evidenceRequirements(e,[]).join(' ')).toContain('Capturar detalle de contrarrecibo GT-100');
});
it('lee las fechas partidas del panel y pide XML/PDF de cada factura faltante',()=>{
 const e=parseProvidenciaEvidence(panel)!;expect(e.kind).toBe('invoice_list');expect(e.invoices).toHaveLength(2);expect(e.invoices[0]).toMatchObject({folio:'9991',oc:'12026439999',issueDate:'2026-10-12T17:31:34',total:1160});
 expect(evidenceRequirements(e,[]).join(' ')).toContain('Capturar XML/PDF de factura 9991');
});
it('lee el REP y UUID que envuelve la columna de folio; ignora TOTAL fiscal cero',()=>{
 const e=parseProvidenciaEvidence(rep)!;expect(e.kind).toBe('payment_rep');expect(e.total).toBe(3480);expect(e.paymentDate).toBe('2026-10-13');expect(e.allocations).toHaveLength(2);expect(e.allocations[0].uuid).toBe('CCCCCCCC-1111-2222-3333-DDDDDDDDDDDD');expect(e.warnings).toEqual([]);
 expect(evidenceRequirements(e,[])).toHaveLength(2);
});
it('no confunde saldo pagado con ingresos nuevos y detecta importes inconsistentes',()=>{
 const e=parseProvidenciaEvidence(paid.replace('1,160.00 0.00','1,150.00 0.00'))!;expect(e.warnings.join(' ')).toContain('total');
 expect(parseProvidenciaEvidence(rep.replace('Monto total de los pagos $ 3,480.00','Monto total de los pagos $ 4,000.00'))!.warnings.join(' ')).toContain('suma');
});
it('recalcula faltantes al capturar la factura y detecta conflictos con la OC del portal',()=>{
 const e=parseProvidenciaEvidence(panel)!;
 const orders=[{id:'o',oc:'12026439999',invoices:[{folio:'9991',financials:{invoiceTotal:1160}}]}] as PurchaseOrder[];
 expect(evidenceRequirements(e,orders).join(' ')).not.toContain('Capturar XML/PDF de factura 9991');
 orders[0].oc='otra';expect(evidenceRequirements(e,orders).join(' ')).toContain('Conciliar factura 9991');
});
it('no trata OC o detalles TR como listados de referencia',()=>{
 expect(parseProvidenciaEvidence('Orden de Compra CDB OC: 120267114400')).toBeNull();
 expect(parseProvidenciaEvidence('DETALLE DE PAGOS PAGO: TR_5189')).toBeNull();
});
