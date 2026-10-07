import { describe, it, expect } from 'vitest';
import { parseOcrData } from '../ocr';

describe('Ingesta Automática de Documentos OCR (5 Casos Oficiales del Usuario)', () => {
  // Documento 1: OC 43/9806
  const DOC1_OC_9806 = `
HIDALGO NORTE COLONIA CENTRO C.P. 90800
STA ANA CHIAUTEMPAN, TLAXCALA MEXICO
GTP930115PU1
GRUPO TEXTIL PROVIDENCIA SA DE CV P4-ALM | sa |12026439806 |30/09/2026 13:00:47
Orden de Compra
12026439806
Tel: 012464641015 FAX: 012464650830
 , C.P. 
No. Ord. de Compra: 43/9806
Proveedor
N0321 - ELEMENTAL DENIM 
Fecha Pedido: 30-septiembre-20
Fecha Entrega: 09-octubre-2026 
CREDITO A 30 DIAS
Lugar de Entrega:
ELEMENTAL DENIM
CDB OC: 12026439806
Su Documento: 
No. Articulo Cantidad P. U. Dtos Importe
1 EGBO000017-SC 1,000.0000 BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color 43.0000 0.0000 43,000.0000
2 EGBO000095-SC 1,500.0000 BOLSA POLIETILENO 120X 125 CM _Sin Color 43.0000 0.0000 64,500.0000
0.0000 107,500.0000
BOLSA PARA EMPAQUE COBERTOR-EDREDON
SubTotal 107,500.0000
Solicitó Autorizó Recibio
1 
  `;

  it('procesa Documento 1: OC 43/9806 correctamente con kilos, conceptos y fecha rectificada', () => {
    const res = parseOcrData(DOC1_OC_9806);
    expect(res.docKind).toBe('oc_providencia');
    expect(res.folio).toBe('43/9806');
    expect(res.ocNumber).toBe('12026439806');
    expect(res.fecha).toBe('2026-09-30');
    expect(res.kilos).toBe(2500);
    expect(res.totalPiezas).toBe(2500);
    expect(res.subTotal).toBe(107500);
    expect(res.total).toBe(107500);
    expect(res.conceptos?.length).toBe(2);
    expect(res.conceptos?.[0].codigo).toBe('EGBO000017-SC');
    expect(res.conceptos?.[0].cantidad).toBe(1000);
    expect(res.conceptos?.[1].codigo).toBe('EGBO000095-SC');
    expect(res.conceptos?.[1].cantidad).toBe(1500);
  });

  // Documento 2: OC 43/9807
  const DOC2_OC_9807 = `
HIDALGO NORTE COLONIA CENTRO C.P. 90800
STA ANA CHIAUTEMPAN, TLAXCALA MEXICO
GTP930115PU1
GRUPO TEXTIL PROVIDENCIA SA DE CV P4-ALM | sa |12026439807 |30/09/2026 13:35:50
Orden de Compra
12026439807
Tel: 012464641015 FAX: 012464650830
 , C.P. 
No. Ord. de Compra: 43/9807
Proveedor
N0321 - ELEMENTAL DENIM 
Fecha Pedido: 30-septiembre-20
Fecha Entrega: 12-octubre-2026 
CREDITO A 30 DIAS
Lugar de Entrega:
ELEMENTAL DENIM
CDB OC: 12026439807
Su Documento: 
No. Articulo Cantidad P. U. Dtos Importe
1 EGBO000018-SC 1,000.0000 BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color 43.0000 0.0000 43,000.0000
2 EGBO000094-SC 1,000.0000 BOLSA POLIETILENO 100 X 125 CM _Sin Color 43.0000 0.0000 43,000.0000
3 EGBO000093-SC 1,000.0000 BOLSA POLIETILENO 100 X 95 CM _Sin Color 43.0000 0.0000 43,000.0000
0.0000 129,000.0000
BOLSA PARA EMPAQUE COBERTOR
SubTotal 129,000.0000
Solicitó Autorizó Recibio
1 
  `;

  it('procesa Documento 2: OC 43/9807 correctamente con 3 partidas, 3000 kg y $129,000', () => {
    const res = parseOcrData(DOC2_OC_9807);
    expect(res.docKind).toBe('oc_providencia');
    expect(res.folio).toBe('43/9807');
    expect(res.ocNumber).toBe('12026439807');
    expect(res.fecha).toBe('2026-09-30');
    expect(res.kilos).toBe(3000);
    expect(res.totalPiezas).toBe(3000);
    expect(res.subTotal).toBe(129000);
    expect(res.total).toBe(129000);
    expect(res.conceptos?.length).toBe(3);
  });

  // Documento 3: OC 43/9713
  const DOC3_OC_9713 = `
HIDALGO NORTE COLONIA CENTRO C.P. 90800
STA ANA CHIAUTEMPAN, TLAXCALA MEXICO
GTP930115PU1
GRUPO TEXTIL PROVIDENCIA SA DE CV P4-ALM | sa |12026439713 |10/08/2026 09:52:36
Orden de Compra
12026439713
Tel: 012464641015 FAX: 012464650830
 , C.P. 
No. Ord. de Compra: 43/9713
Proveedor
N0321 - ELEMENTAL DENIM 
Fecha Pedido: 10-agosto-2026
Fecha Entrega: 18-agosto-2026 
CREDITO A 30 DIAS
Lugar de Entrega:
ELEMENTAL DENIM
CDB OC: 12026439713
Su Documento: 
No. Articulo Cantidad P. U. Dtos Importe
1 EGBO000095-SC 1,000.0000 BOLSA POLIETILENO 120X 125 CM _Sin Color 43.0000 0.0000 43,000.0000
2 EGBO000018-SC 1,000.0000 BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color 43.0000 0.0000 43,000.0000
3 EGBO000017-SC 700.0000 BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color 43.0000 0.0000 30,100.0000
4 EGBO000093-SC 1,000.0000 BOLSA POLIETILENO 100 X 95 CM _Sin Color 43.0000 0.0000 43,000.0000
0.0000 159,100.0000
BOLSA PARA EMPAQUE DE COBERTOR
SubTotal 159,100.0000
Solicitó Autorizó Recibio
1 
  `;

  it('procesa Documento 3: OC 43/9713 correctamente con 4 partidas, 3700 kg y $159,100', () => {
    const res = parseOcrData(DOC3_OC_9713);
    expect(res.docKind).toBe('oc_providencia');
    expect(res.folio).toBe('43/9713');
    expect(res.ocNumber).toBe('12026439713');
    expect(res.fecha).toBe('2026-08-10');
    expect(res.kilos).toBe(3700);
    expect(res.totalPiezas).toBe(3700);
    expect(res.subTotal).toBe(159100);
    expect(res.total).toBe(159100);
    expect(res.conceptos?.length).toBe(4);
  });

  // Documento 4: Detalle de Pagos TR_4987
  const DOC4_PAGO_4987 = `
02/10/2026 - 11:06:32 a. m.
DETALLE DE PAGOS
PAGO: TR_4987 TRANSFERENCIA: IMPORTE: 98,054.60 MXN
Docto. SAP Docto.
Pago Factura Detalle Fecha Pago Importe Moneda
8/678 TR_4987 6198 TH-990 30/09/2026 98,054.60 MXN
10/2/26, 7:06 PM Providencia | Recepción CFDI > Proveedores > Pagos > Pago: TR_4987
https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/pagos/detalles/?id=56573&doc=T… 1/1 
  `;

  it('procesa Documento 4: Detalle de Pagos TR_4987 (Factura 6198, CR TH-990, $98,054.60 MXN)', () => {
    const res = parseOcrData(DOC4_PAGO_4987);
    expect(res.docKind).toBe('pago_providencia');
    expect(res.folio).toBe('6198');
    expect(res.ocNumber).toBe('TR_4987');
    expect(res.total).toBe(98054.60);
    expect(res.fecha).toBe('2026-09-30');
    expect(res.kilos).toBe(0);
  });

  // Documento 5: Detalle de Pagos TR_4835
  const DOC5_PAGO_4835 = `
29/09/2026 - 09:50:05 a. m.
DETALLE DE PAGOS
PAGO: TR_4835 TRANSFERENCIA: IMPORTE: 81,780.00 MXN
Docto. SAP Docto.
Pago Factura Detalle Fecha Pago Importe Moneda
8/660 TR_4835 6167 TH-946 25/09/2026 81,780.00 MXN
9/29/26, 5:50 PM Providencia | Recepción CFDI > Proveedores > Pagos > Pago: TR_4835
https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/pagos/detalles/?id=56569&doc=T… 1/1 
  `;

  it('procesa Documento 5: Detalle de Pagos TR_4835 (Factura 6167, CR TH-946, $81,780.00 MXN)', () => {
    const res = parseOcrData(DOC5_PAGO_4835);
    expect(res.docKind).toBe('pago_providencia');
    expect(res.folio).toBe('6167');
    expect(res.ocNumber).toBe('TR_4835');
    expect(res.total).toBe(81780.00);
    expect(res.fecha).toBe('2026-09-25');
    expect(res.kilos).toBe(0);
  });

  // Documento 6: Remisión Física de Entregas 28/09/2026 (OC 12026114099 -> TH 120267114302)
  const DOC6_REMISION_TH_28092026 = `
FECHA: 28/09/2026
CLIENTE: GRUPO TEXTIL PROVIDENCIA SA DE CV
TELEFONO: 2464641015
DIRECCIÓN: HIDALGO NORTE COLONIA CENTRO C.P. 90800 STA ANA CHIAUTEMPAN, TLAXCALA MEXICO
CONTACTO:
OC: 12026114099

CANTIDAD DESCRIPCION
1000 KG BOLSA DE POLIETILENO COLOR NATURAL 60X80 CM C/250
1000 KG BOLSA DE POLIETILENO COLOR NATURAL 48+17+17X80 C/250
1000 KG BOLSA DE POLIETILENO COLOR NATURAL 48+17+17X100 CM C/250
500 KG BOLSA DE POLIETILENO COLOR NATURAL 30X40 CM C/150
915.15 KG BOLSA DE POLIETILENO COLOR NATURAL 48+17+17X140 C/250
984.65 KG BOLSA DE POLIETILENO COLOR NATURAL 55X126 CM C/150
500 KG BOLSA DE POLIETILENO COLOR NATURAL 50X55 CM C/150

SUB TOTAL $149,839.95
IVA $23,974.39
TOTAL $173,814.34

ELEMENTAL DENIM
EDE1902136T2
  `;

  it('procesa Documento 6: Remisión Física TH 28/09/2026 con 7 partidas, 5,899.80 kg y mapeo a OC 120267114302', () => {
    const res = parseOcrData(DOC6_REMISION_TH_28092026);
    expect(res.docKind).toBe('remision');
    expect(res.ocNumber).toBe('120267114302');
    expect(res.fecha).toBe('2026-09-28');
    expect(res.kilos).toBe(5899.80);
    expect(res.subTotal).toBe(149839.95);
    expect(res.total).toBe(173814.34);
    expect(res.conceptos?.length).toBe(7);
    expect(res.conceptos?.[0].cantidad).toBe(1000);
    expect(res.conceptos?.[1].codigo).toBe('EGBO000113-SC');
    expect(res.conceptos?.[1].cantidad).toBe(1000);
    expect(res.conceptos?.[4].cantidad).toBe(915.15);
    expect(res.conceptos?.[5].cantidad).toBe(984.65);
    expect(res.conceptos?.[6].codigo).toBe('ENBO000007-SC');
    expect(res.conceptos?.[6].cantidad).toBe(500);
  });
});

