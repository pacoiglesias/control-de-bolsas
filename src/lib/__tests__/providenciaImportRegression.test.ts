import { beforeEach, expect, it, vi } from 'vitest';
import { parseOcrData } from '../ocr';
import { parseScaleTicket } from '../scaleTicketParser';
import { parseProvidenciaPaymentPdf } from '../providenciaPortalParser';
import { findExactPurchaseOrder, planProvidenciaPayment, purchaseOrderFromText } from '../providenciaImport';
import { applyProvidenciaPayment } from '../providenciaPaymentApply';
import { analyzeDocumentFast, applyDocumentFast } from '../autoDocumentPipeline';
import type { PurchaseOrder } from '../types';
import { getOrderSummary } from '../finance';
import { buildOperationalTasks } from '../operationalTasks';
import { uploadDocument } from '../documentStorage';

const state = vi.hoisted(() => ({ text: '', docs: new Map<string, any>(), writes: [] as any[] }));
vi.mock('../firebase', () => ({ auth: { currentUser: { uid: 'test-admin', email: 'admin@example.test' } }, db: {}, PATHS: { orders: 'orders', invoices: 'invoices' } }));
vi.mock('../documentStorage', () => ({ uploadDocument: vi.fn().mockResolvedValue({}) }));
vi.mock('../logger', () => ({ logAction: vi.fn(), logMandatoryAction: vi.fn() }));
vi.mock('../safeFirestore', () => ({ safeUpdateDoc: vi.fn(), safeAddDoc: vi.fn() }));
vi.mock('../ocr', async () => ({ ...await vi.importActual<any>('../ocr'), extractTextFromPdf: vi.fn(async () => state.text) }));
vi.mock('firebase/firestore', async () => ({ ...await vi.importActual<any>('firebase/firestore'),
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}`, id }),
  serverTimestamp: () => 'SERVER_TIME',
  runTransaction: async (_db: unknown, callback: any) => {
    const writes: any[] = [];
    const result = await callback({ get: async (ref: any) => {
      if (writes.length) throw new Error('Read after write');
      return { exists: () => state.docs.has(ref.path), data: () => state.docs.get(ref.path) };
    }, set: (ref: any, data: any) => writes.push({ path: ref.path, data }), update: (ref: any, data: any) => writes.push({ path: ref.path, data: { ...state.docs.get(ref.path), ...data } }) });
    for (const write of writes) state.docs.set(write.path, write.data);
    state.writes.push(...writes);
    return result;
  },
}));

// Layout reproduced from the reported files, omitting addresses and signatures.
const oc = `GRUPO TEXTIL PROVIDENCIA SA DE CV TH-ALMACEN-1 | sa |120267114400 |13/10/2026 17:47:31
GTP930115PU1 Orden de Compra
CDB OC: 120267114400
No. Ord. de Compra: 71/14400
Fecha Pedido: 13-octubre-2026
Fecha Entrega: 13-octubre-2026
No. Articulo Cantidad P. U. Dtos Importe
1 egbo000107-sc BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250 1,000.0000 44.0000 0.0000 44,000.0000
2 enbo000167-bl BOLSA POLIETILENO 55 CM X 126 CM Blanco 1,000.0000 44.0000 0.0000 44,000.0000
3 egbo000103-sc BULTO 80 X 20 +20 X 160 *250 2,000.0000 44.0000 0.0000 88,000.0000
4 EGBO000101-SC BULTO 60 X 20 + 20 X 120 CM 500.0000 44.0000 0.0000 22,000.0000
5 enbo000084-sc BOLSA POLIETILENO 55 CM x 55 CM 1,000.0000 44.0000 0.0000 44,000.0000
6 enbo000006-sc BOLSA POLIETILENO 77 CM X 55 CM _Sin Color 2,000.0000 44.0000 0.0000 88,000.0000
7 ENBO000007-SC BOLSA POLIETILENO 50 CM x 55 CM _Sin Color 2,000.0000 44.0000 0.0000 88,000.0000
SubTotal 418,000.0000`;
const paymentText = `15/10/2026 - 11:21:52 a. m.
DETALLE DE PAGOS
PAGO: TR_5189 TRANSFERENCIA: IMPORTE: 98,912.04 MXN
Docto. SAP Docto. Pago Factura Detalle Fecha Pago Importe Moneda
2/314 TR_5189 6193 GT-874 13/10/2026 49,880.00 MXN
2/328 TR_5189 6224 GT-904 13/10/2026 49,032.04 MXN`;
const payment = () => parseProvidenciaPaymentPdf(paymentText)!;
it('una OC nueva indica la entrega faltante sin inventar factura, CR ni kilos entregados', () => {
  const order = { ...purchaseOrderFromText(oc), id: 'new-oc' } as PurchaseOrder;
  const summary = getOrderSummary(order);
  expect(summary.invoices).toEqual([]);
  expect(summary.kilosDelivered).toBe(0);
  expect(summary.kilosInvoiced).toBe(0);
  expect(summary.invoiceTotal).toBe(0);
  const tasks = buildOperationalTasks([order]);
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toMatchObject({ category: 'delivery', kilos: 9500 });
});
const orders = (): PurchaseOrder[] => ['6193', '6224'].map((folio, index) => ({ id: 'o'+index, folio: index ? 'GT-904' : 'GT-874', invoices: [{ id: 'i'+index, orderId: 'o'+index, folio, kilos: 0, creditCycle: { status: 'pending' }, financials: { invoiceTotal: index ? 49032.04 : 49880 } as any, collection: { paidAmount: 0, contrareciboNumber: index ? 'GT-904' : 'GT-874' } }] }));
beforeEach(() => { state.docs.clear(); state.writes=[]; state.text=''; for (const order of orders()) state.docs.set('orders/'+order.id, order); });

it('registra el listado como evidencia, sin facturas, entregas ni cobros por sus totales', async () => {
  state.text='11 resultados No Contrarecibo Total Pagado Pendiente Moneda TC Estatus 1 GT-100 12/10/2026 11/11/2026 1160.00 0.00 1160.00 PMX 1 GENERADO';
  const file={name:'contrarecibos.pdf',type:'application/pdf'} as File;
  const analysis=await analyzeDocumentFast(file,orders());
  expect(analysis.evidence?.receipts).toHaveLength(1);expect(analysis.needsClarification).toBe(false);
  const result=await applyDocumentFast(analysis,null,orders());expect(result.success).toBe(true);
  expect(state.writes).toEqual([]);
  expect(vi.mocked(uploadDocument)).toHaveBeenLastCalledWith(expect.objectContaining({evidence:expect.objectContaining({kind:'receipt_list'}),kilos:0,total:1160}));
});

it('clasifica la OC antes de remisiones y conserva siete partidas, TH, 9500 kg y precio 44', () => {
  const result = parseOcrData(oc); expect(result.docKind).toBe('oc_providencia'); expect(result.ocNumber).toBe('120267114400');
  expect(result.kilos).toBe(9500); expect(result.subTotal).toBe(418000); expect(parseScaleTicket(oc).kilosNeto).toBeUndefined();
  const order = purchaseOrderFromText(oc); expect(order.department).toBe('TH'); expect(order.folio).toBe('71/14400'); expect(order.customSellPrice).toBe(44);
  expect(order.items).toHaveLength(7); expect(order.items?.every(item => item.unit === 'Kilos')).toBe(true); expect(order.invoices).toEqual([]); expect(order.deliveries).toEqual([]);
});
it('rechaza una OC cuyo subtotal no corresponde a sus partidas', () => { expect(() => purchaseOrderFromText(oc.replace('SubTotal 418,000.0000','SubTotal 419,000.0000'))).toThrow(); });
it('una nueva OC con igual importe no se asigna a otra orden', () => { expect(findExactPurchaseOrder([{ id:'old', oc:'120267114302', folio:'71/14302' }], '120267114400','71/14400')).toBeNull(); });
it('el pipeline crea la OC nueva con su folio original y es idempotente', async () => {
  state.text=oc; const file=new File(['OC'], 'OC.pdf', { type:'application/pdf' });
  const analysis=await analyzeDocumentFast(file, []); expect(analysis.docType).toBe('oc_providencia'); expect(analysis.needsClarification).toBe(false);
  await applyDocumentFast(analysis,null,[]); expect(state.docs.get('orders/oc-120267114400').customSellPrice).toBe(44);
  expect((await applyDocumentFast(analysis,null,[])).isDuplicate).toBe(true);
});
it('extrae todas las filas del pago y la fecha real, no la fecha de impresión', () => {
  expect(payment().amount).toBe(98912.04); expect(payment().allocations?.map(row => [row.facturaFolio,row.amount,row.paymentDate])).toEqual([['6193',49880,'13/10/2026'],['6224',49032.04,'13/10/2026']]);
});
it('impide aplicar el pago si hay diferencias en el encabezado o faltan facturas', () => {
  expect(parseProvidenciaPaymentPdf(paymentText.replace('98,912.04','99,912.04'))?.allocationError).toBeTruthy();
  expect(planProvidenciaPayment(payment(),[orders()[0]]).errors.join()).toContain('6224');
});
it('aplica las dos facturas y sus espejos de cobranza en una transacción', async () => {
  const result=await applyProvidenciaPayment(payment(),orders()); expect(result.appliedRows).toBe(2);
  expect(state.docs.get('orders/o0').invoices[0].collection.paidAmount).toBe(49880); expect(state.docs.get('orders/o1').invoices[0].collection.paidAmount).toBe(49032.04);
  expect(state.docs.get('invoices/i1').creditCycle.status).toBe('collected'); expect(state.writes.filter(write => write.path.startsWith('payment_receipts/'))).toHaveLength(2);
});
it('reimportar el mismo TR no duplica abonos', async () => {
  await applyProvidenciaPayment(payment(),orders()); state.writes=[];
  expect((await applyProvidenciaPayment(payment(),orders())).isDuplicate).toBe(true); expect(state.writes).toHaveLength(0);
});
it('si una de las facturas ya está liquidada no escribe el pago de la otra', async () => {
  state.docs.get('orders/o1').invoices[0].creditCycle.status='collected';
  await expect(applyProvidenciaPayment(payment(),orders())).rejects.toThrow('liquidada'); expect(state.writes).toHaveLength(0);
});
it('la transferencia no queda bloqueada por falta de un número de OC cuando sus facturas son inequívocas', async () => {
  state.text=paymentText; const analysis=await analyzeDocumentFast(new File(['TR'], 'pago.pdf',{type:'application/pdf'}),orders());
  expect(analysis.needsClarification).toBe(false); expect(analysis.total).toBe(98912.04); expect(analysis.paymentDetail?.allocations).toHaveLength(2);
  expect((await applyDocumentFast(analysis,null,orders())).success).toBe(true);
});
