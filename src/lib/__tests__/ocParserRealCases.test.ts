import { describe, it, expect } from 'vitest';
import { parseOrdenDeCompra } from '../ocParser';
import { extractInvoiceItemsFromText } from '../../hooks/useInvoiceParser';

describe('Parser de Órdenes de Compra Reales de Providencia', () => {
  const OC_12026439713_TEXT = `
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
`;

  it('extrae correctamente las 4 partidas de la OC 12026439713 (Formato A)', () => {
    const parsed = parseOrdenDeCompra(OC_12026439713_TEXT);
    expect(parsed.oc).toBe('12026439713');
    expect(parsed.folio).toBe('43/9713');
    expect(parsed.items.length).toBe(4);
    expect(parsed.totalKilograms).toBe(3700);
    expect(parsed.items[0].code).toBe('EGBO000095-SC');
    expect(parsed.items[0].quantity).toBe(1000);
    expect(parsed.items[0].unitPrice).toBe(43);
    expect(parsed.items[0].amount).toBe(43000);

    expect(parsed.items[2].code).toBe('EGBO000017-SC');
    expect(parsed.items[2].quantity).toBe(700);
    expect(parsed.items[2].amount).toBe(30100);
  });

  const OC_120267114114_TEXT = `
Tel: 012464650830 
HIDALGO NORTE COLONIA CENTRO C.P. 90800
STA ANA CHIAUTEMPAN, TLAXCALA MEX
GTP930115PU1
GRUPO TEXTIL PROVIDENCIA SA DE CV TH-ALMACEN-1 | sa |120267114114 |10/08/2026 12:49:16
Orden de Compra
120267114114
 , C.P. 
No. Ord. de Compra: 71/14114
Proveedor
N0342 - ELEMENTAL DENIM 
Fecha Pedido: 10-agosto-2026
Fecha Entrega: 10-agosto-2026 
CREDITO A 30 DIAS
Lugar de Entrega:
0
CDB OC: 120267114114
Su Documento: 
Articulo Cantidad P. U. No. Dtos Importe
1 egbo000107-sc BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250 1,000.0000 43.0000 0.0000 43,000.0000
2 enbo000167-bl BOLSA POLIETILENO 55 CM X 126 CM Blanco 1,000.0000 43.0000 0.0000 43,000.0000
3 egbo000103-sc BULTO 80 X 20 +20 X 160 *250 1,000.0000 43.0000 0.0000 43,000.0000
4 enbo000006-sc BOLSA POLIETILENO 77 CM X 55 CM _Sin Color 2,000.0000 43.0000 0.0000 86,000.0000
5 ENBO000007-SC BOLSA POLIETILENO 50 CM x 55 CM _Sin Color 1,000.0000 43.0000 0.0000 43,000.0000
6 enbo000044-sc BOLSA POLIETILENO 30 X 40 CM 500.0000 43.0000 0.0000 21,500.0000
 0.0000 279,500.0000
PEDIDO DE MATERIAL PROGRAMAS COPPEL/WALMART
SubTotal 279,500.0000
Solicitó: JOSÉ NAVA FLORES Autorizó: JOSÉ ANTONIO TORRE LAMUÑO
`;

  it('extrae correctamente las 6 partidas de la OC 120267114114 (Formato B)', () => {
    const parsed = parseOrdenDeCompra(OC_120267114114_TEXT);
    expect(parsed.oc).toBe('120267114114');
    expect(parsed.folio).toBe('71/14114');
    expect(parsed.items.length).toBe(6);
    expect(parsed.totalKilograms).toBe(6500);
    
    expect(parsed.items[0].code).toBe('egbo000107-sc');
    expect(parsed.items[0].description).toBe('BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250');
    expect(parsed.items[0].quantity).toBe(1000);
    expect(parsed.items[0].amount).toBe(43000);

    expect(parsed.items[3].code).toBe('enbo000006-sc');
    expect(parsed.items[3].quantity).toBe(2000);
    expect(parsed.items[3].amount).toBe(86000);

    expect(parsed.items[5].code).toBe('enbo000044-sc');
    expect(parsed.items[5].quantity).toBe(500);
    expect(parsed.items[5].amount).toBe(21500);
  });
});

describe('Extracción de Conceptos de Facturas CFDI (Texto PDF)', () => {
  const FACTURA_6193_TEXT = `
Factura 6193
FOLIO FISCAL (UUID) 4BA4D9DA-35A2-4B47-BD0B-59AC9BB059A6
FECHA Y HORA DE EMISIÓN DE CFDI 2026-08-19T13:52:37
CONDICIONES DE PAGO OC 12026439713
CONCEPTOS
Cantidad Unidad Descripción Precio Unitario Objeto Imp. Importe
 500.00 KGM - KILOGRAMO EGBO000018-SCBOLSA POLIETILENO 1.00 M X 1.15 M (60+40x115)
Clave Prod. Serv. - 24141500 Suministros para seguridad y protección
Impuestos:
 Traslados:
 002 IVA Base - 21500 Tasa - 0.160000 Importe - $ 3,440.00
$ 43.00 02 - Sí objeto
de impuesto.
$ 21,500.00
 500.00 KGM - KILOGRAMO EGBO000095-SC BOLSA POLIETILENO 120X 125 CM (80+20+20X125)
Clave Prod. Serv. - 24141500 Suministros para seguridad y protección
Impuestos:
 Traslados:
 002 IVA Base - 21500 Tasa - 0.160000 Importe - $ 3,440.00
$ 43.00 02 - Sí objeto
de impuesto.
$ 21,500.00
SUBTOTAL $ 43,000.00
 TRASLADO IVA TASA 0.160000 $ 6,880.00
TOTAL $ 49,880.00
`;

  it('extrae los conceptos individuales de la Factura 6193', () => {
    const items = extractInvoiceItemsFromText(FACTURA_6193_TEXT);
    expect(items.length).toBe(2);
    expect(items[0].quantity).toBe(500);
    expect(items[0].code).toBe('EGBO000018-SC');
    expect(items[0].description).toBe('BOLSA POLIETILENO 1.00 M X 1.15 M (60+40x115)');
    expect(items[0].amount).toBe(21500);

    expect(items[1].quantity).toBe(500);
    expect(items[1].code).toBe('EGBO000095-SC');
    expect(items[1].amount).toBe(21500);
  });

  const FACTURA_6198_TEXT = `
Factura 6198
FOLIO FISCAL (UUID) 01704C49-71EA-4201-8ABD-11A44A178101
CONDICIONES DE PAGO OC 120267114114
CONCEPTOS
Cantidad Unidad Descripción Precio Unitario Objeto Imp. Importe
 975.65 KGM - KILOGRAMO egbo000103-sc BULTO 80 X 20 +20 X 160 *250
Clave Prod. Serv. - 24141500 Suministros para seguridad y protección
Impuestos:
 Traslados:
 002 IVA Base - 41952.95 Tasa - 0.160000 Importe - $ 6,712.47
$ 43.00 02 - Sí objeto
de impuesto.
$ 41,952.95
 990.16 KGM - KILOGRAMO egbo000107-sc BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250
Clave Prod. Serv. - 24141500 Suministros para seguridad y protección
Impuestos:
 Traslados:
 002 IVA Base - 42576.88 Tasa - 0.160000 Importe - $ 6,812.30
$ 43.00 02 - Sí objeto
de impuesto.
$ 42,576.88
SUBTOTAL $ 84,529.83
 TRASLADO IVA TASA 0.160000 $ 13,524.77
TOTAL $ 98,054.60
`;

  it('extrae los conceptos individuales de la Factura 6198 con decimales exactos', () => {
    const items = extractInvoiceItemsFromText(FACTURA_6198_TEXT);
    expect(items.length).toBe(2);
    expect(items[0].quantity).toBe(975.65);
    expect(items[0].code).toBe('egbo000103-sc');
    expect(items[0].amount).toBe(41952.95);

    expect(items[1].quantity).toBe(990.16);
    expect(items[1].code).toBe('egbo000107-sc');
    expect(items[1].amount).toBe(42576.88);
  });
});
