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

  // Documento 7: Factura CFDI 6363 con 2 partidas (1,000 kg + 500 kg = 1,500 kg)
  const DOC7_FACTURA_6363 = `
ELEMENTAL DENIM EDE1902136T2
Factura 6363
FOLIO FISCAL (UUID) 43E53F15-865E-4FF7-A2F3-2A47AB99F8B7
FECHA Y HORA DE EMISIÓN DE CFDI 2026-10-06T12:12:09
CLIENTE GRUPO TEXTIL PROVIDENCIA GTP930115PU1
CONCEPTOS
Cantidad Unidad Descripción Precio Unitario Objeto Imp. Importe
 1,000.00 KGM - KILOGRAMO EGBO000113-SC BULTO 48 + 17 + 17 *80 CM $ 43.00 02 $ 43,000.00
 500.00 KGM - KILOGRAMO ENBO000007-SC BOLSA POLIETILENO 50 CM x 55 CM $ 43.00 02 $ 21,500.00
CONDICIONES DE PAGO OC 120267114302
SUBTOTAL $ 64,500.00
TRASLADO IVA TASA 0.160000 $ 10,320.00
TOTAL $ 74,820.00
  `;

  it('procesa Factura 6363 sumando TODAS las partidas: 1,000 + 500 = 1,500 kg (no solo el primer renglón)', () => {
    const res = parseOcrData(DOC7_FACTURA_6363);
    expect(res.folio).toBe('6363');
    expect(res.uuid).toBe('43E53F15-865E-4FF7-A2F3-2A47AB99F8B7');
    expect(res.ocNumber).toBe('120267114302');
    expect(res.fecha).toBe('2026-10-06');
    expect(res.kilos).toBe(1500);
    expect(res.subTotal).toBe(64500);
    expect(res.total).toBe(74820);
  });

  // Documento 8: Factura CFDI 6368 con 2 partidas de 500 kg cada una = 1,000 kg total
  const DOC8_FACTURA_6368 = `
ELEMENTAL DENIM EDE1902136T2
Factura 6368
FOLIO FISCAL (UUID) C87994D1-096C-4581-9F31-5079148AE13C
FECHA Y HORA DE EMISIÓN DE CFDI 2026-10-07T10:23:35
CLIENTE GRUPO TEXTIL PROVIDENCIA GTP930115PU1
CONCEPTOS
Cantidad Unidad Descripción Precio Unitario Objeto Imp. Importe
 500.00 KGM - KILOGRAMO EGBO000018-SC BOLSA POLIETILENO 1.00 M X 1.15 M $ 43.00 02 $ 21,500.00
 500.00 KGM - KILOGRAMO EGBO000095-SC BOLSA POLIETILENO 120X 125 CM $ 43.00 02 $ 21,500.00
CONDICIONES DE PAGO OC 12026439784
SUBTOTAL $ 43,000.00
TRASLADO IVA TASA 0.160000 $ 6,880.00
TOTAL $ 49,880.00
  `;

  it('procesa Factura 6368 sumando 500 + 500 = 1,000 kg, subtotal 43,000 y total 49,880', () => {
    const res = parseOcrData(DOC8_FACTURA_6368);
    expect(res.folio).toBe('6368');
    expect(res.uuid).toBe('C87994D1-096C-4581-9F31-5079148AE13C');
    expect(res.ocNumber).toBe('12026439784');
    expect(res.fecha).toBe('2026-10-07');
    expect(res.kilos).toBe(1000);
    expect(res.subTotal).toBe(43000);
    expect(res.total).toBe(49880);
  });

  // Documento 9: Contrarecibo Oficial TH-1195 en formato PDF
  const DOC9_CONTRARECIBO_TH1195 = `
08/10/2026
11:26:11 a. m.
GRUPO TEXTIL PROVIDENCIA SA DE CV
HIDALGO NORTE 7 CENTRO.
SANTA ANA CHIAUTEMPAN TLAX . C. P. 90800
GRUPO TEXTIL PROVIDENCIA
CONTRA RECIBO
Recibimos de:  ELEMENTAL DENIM  [ PR50823 ]
Las siguientes facturas para su revisión:
No. TH-1195
Factura No. Serie/Número (Control Interno) Importe
6334 8 / 839 74,820.00 PMX
74,820.00
Fecha Recepción: 05/10/2026
Fecha Pago: 04/11/2026
Cadena Original
1|2026|TH-1195|05/10/2026|EDE1902136T2|74820|04/11/2026
Sello digital
rWMxeNwlixFG/UsW7TCWJ8id8SPRAKnz4qxEEXmEys/iaY0reP5VzQaf1V1utEB62xiZ2HQIU1N9db92MC4BWQ==
https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=1202...
  `;

  it('procesa Contrarecibo Oficial TH-1195 vinculando Factura 6334, total 74,820 y fecha pago 04/11/2026', () => {
    const res = parseOcrData(DOC9_CONTRARECIBO_TH1195);
    expect(res.docKind).toBe('contrarecibo');
    expect(res.contrarecibo).toBe('TH-1195');
    expect(res.facturaFolios).toEqual(['6334']);
    expect(res.total).toBe(74820);
    expect(res.dueDate).toBe('2026-11-04');
    expect(res.fecha).toBe('2026-10-05');
  });

  // Documento 10: Contrarecibo Oficial GT-1047 en formato PDF con múltiples facturas
  const DOC10_CONTRARECIBO_GT1047 = `
08/10/2026
11:25:22 a. m.
GRUPO TEXTIL PROVIDENCIA SA DE CV
HIDALGO NORTE 7 CENTRO.
SANTA ANA CHIAUTEMPAN TLAX . C. P. 90800
GRUPO TEXTIL PROVIDENCIA
CONTRA RECIBO
Recibimos de:  ELEMENTAL DENIM  [ PR50823 ]
Las siguientes facturas para su revisión:
No. GT-1047
Factura No. Serie/Número (Control Interno) Importe
6352 2 / 415 14,964.00 PMX
6353 2 / 416 67,338.00 PMX
82,302.00
Fecha Recepción: 05/10/2026
Fecha Pago: 04/11/2026
Cadena Original
1|2026|GT-1047|05/10/2026|EDE1902136T2|82302|04/11/2026
Sello digital
MOKfYy9UeFlTWTp0qXe4hdOARDEJOftu9M659M8C2ZPlr2IoZEts9oSkyZDLOHeiu2RcAtJNXborOKJ7c0K9Sw==
https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=1202...
  `;

  it('procesa Contrarecibo Oficial GT-1047 con multipartida (F-6352 + F-6353) acumulando total 82,302 y fecha pago 04/11/2026', () => {
    const res = parseOcrData(DOC10_CONTRARECIBO_GT1047);
    expect(res.docKind).toBe('contrarecibo');
    expect(res.contrarecibo).toBe('GT-1047');
    expect(res.facturaFolios).toEqual(['6352', '6353']);
    expect(res.total).toBe(82302);
    expect(res.dueDate).toBe('2026-11-04');
    expect(res.fecha).toBe('2026-10-05');
  });
});

