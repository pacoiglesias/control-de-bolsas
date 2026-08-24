/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { parseXmlInvoice } from '../xmlParser';

describe('xmlParser', () => {
  it('extrae correctamente los datos de un CFDI 4.0 válido', () => {
    // Para probar DOMParser en vitest (entorno JSDOM), DOMParser ya está disponible gracias a jsdom
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Fecha="2026-08-01T12:00:00" SubTotal="1000.00" Total="1160.00">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA PATITO SA DE CV" />
  <cfdi:Receptor Rfc="XXXX010101000" Nombre="CLIENTE FELIZ" />
  <cfdi:Conceptos>
    <cfdi:Concepto Cantidad="50.5" Descripcion="Cajas de carton" ValorUnitario="10" Importe="505" />
    <cfdi:Concepto Cantidad="49.5" Descripcion="Bolsas de plastico" ValorUnitario="10" Importe="495" />
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="12345678-ABCD-ABCD-ABCD-1234567890AB" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const result = parseXmlInvoice(xml);

    expect(result.uuid).toBe('12345678-ABCD-ABCD-ABCD-1234567890AB');
    expect(result.fecha).toBe('2026-08-01T12:00:00');
    expect(result.subTotal).toBe(1000);
    expect(result.total).toBe(1160);
    expect(result.emisorRfc).toBe('XAXX010101000');
    expect(result.receptorRfc).toBe('XXXX010101000');
    expect(result.conceptos).toHaveLength(2);
    expect(result.conceptos[0].cantidad).toBe(50.5);
    expect(result.conceptos[1].cantidad).toBe(49.5);
  });

  it('procesa con exactitud el XML oficial de la Factura 6193 de Providencia', () => {
    const XML_6193 = `<?xml version="1.0" encoding="utf-8"?><cfdi:Comprobante xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Folio="6193" Fecha="2026-08-19T13:52:37" Sello="BTw41SN8BbBY9Tolgk9uqXYsYt3eahtEfteR3CLNm1may9Eh3XjO/rVkowa9339AQVhXnnAZ/GodOdU+IObIgk3vogIk9LCx2Xebn4ZXPsh7w68k6EjuGJp31MAE3zyecRW+z9UbpdYYMxD8zDCn6WdNTfvd4CyhFccvGD9JispTifydlra+OuKXztXDs9cikCAhFcLG7SQQefl9SiNJsezBEKkBRldEhysv+0MmOV9EVd+kkTo8+/c/wn6EUKEbWEzCeXcamu5qq5OzOybwANyA2s5bMm6jO1WmBVZsszcZ3LNtvKLrhSGNOsRvmUUuz+g+xeBbk6DkcpPoibJuaA==" FormaPago="99" NoCertificado="00001000000706670758" CondicionesDePago="OC 12026439713" SubTotal="43000" Moneda="MXN" Total="49880.00" TipoDeComprobante="I" Exportacion="01" MetodoPago="PPD" LugarExpedicion="72150" xmlns:cfdi="http://www.sat.gob.mx/cfd/4"><cfdi:Emisor Rfc="EDE1902136T2" Nombre="ELEMENTAL DENIM" RegimenFiscal="601" /><cfdi:Receptor Rfc="GTP930115PU1" Nombre="GRUPO TEXTIL PROVIDENCIA" DomicilioFiscalReceptor="90800" RegimenFiscalReceptor="601" UsoCFDI="G01" /><cfdi:Conceptos><cfdi:Concepto ClaveProdServ="24141500" Cantidad="500" ClaveUnidad="KGM" Unidad="KILOGRAMO" Descripcion="EGBO000018-SCBOLSA POLIETILENO 1.00 M X 1.15 M  (60+40x115)" ValorUnitario="43" Importe="21500" ObjetoImp="02"><cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="21500" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="3440.000000" /></cfdi:Traslados></cfdi:Impuestos></cfdi:Concepto><cfdi:Concepto ClaveProdServ="24141500" Cantidad="500" ClaveUnidad="KGM" Unidad="KILOGRAMO" Descripcion="EGBO000095-SC  BOLSA POLIETILENO 120X 125 CM  (80+20+20X125)" ValorUnitario="43" Importe="21500" ObjetoImp="02"><cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado Base="21500" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="3440.000000" /></cfdi:Traslados></cfdi:Impuestos></cfdi:Concepto></cfdi:Conceptos><cfdi:Impuestos TotalImpuestosTrasladados="6880.00"><cfdi:Traslados><cfdi:Traslado Base="43000" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="6880.00" /></cfdi:Traslados></cfdi:Impuestos><cfdi:Complemento><tfd:TimbreFiscalDigital Version="1.1" RfcProvCertif="STA0903206B9" UUID="4BA4D9DA-35A2-4B47-BD0B-59AC9BB059A6" FechaTimbrado="2026-08-19T14:04:54" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" /></cfdi:Complemento></cfdi:Comprobante>`;

    const parsed = parseXmlInvoice(XML_6193);

    expect(parsed.folio).toBe('6193');
    expect(parsed.uuid).toBe('4BA4D9DA-35A2-4B47-BD0B-59AC9BB059A6');
    expect(parsed.ocNumber).toBe('12026439713');
    expect(parsed.emisorRfc).toBe('EDE1902136T2');
    expect(parsed.receptorRfc).toBe('GTP930115PU1');
    expect(parsed.subTotal).toBe(43000);
    expect(parsed.total).toBe(49880);
    expect(parsed.conceptos).toHaveLength(2);
    expect(parsed.conceptos[0].codigo).toBe('EGBO000018-SC');
    expect(parsed.conceptos[0].cantidad).toBe(500);
    expect(parsed.conceptos[0].valorUnitario).toBe(43);
    expect(parsed.conceptos[0].importe).toBe(21500);
    expect(parsed.conceptos[1].codigo).toBe('EGBO000095-SC');
    expect(parsed.conceptos[1].cantidad).toBe(500);
  });

  it('extrae con 100% de exactitud el Complemento de Pago SAT 6174 (Pagos 2.0)', () => {
    const XML_PAGO_6174 = `<?xml version="1.0" encoding="utf-8"?><cfdi:Comprobante xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/Pagos20 http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd" Version="4.0" Folio="6174" Fecha="2026-08-12T13:03:18" Sello="e/C3a7fCu1xdA9TlbE9XPl3149az+g3havXzjhkpy8ObLphU/TOXqGx3XK6h/fog8pLfxjseDciesyvbcpXWX3OEJ7FSS7VrR2whAGJXmCw8UTiPNzthcE4KQMlB0Znr0RnDUpjJMUgIgaCEPYipCem2aVGxdL0vD75yIiX9pzLtynDJ5XjGJ+NREWpoWpxwb19UkPHNXLdUeC+I8ZsO0u7LWdy8mRcYUBFvMpEsLHtvfQgBpj/DvpT8lk/OowdR8n2qaDq7Uv3Q3PbxNGgCe9l15agC+V5d/rlYeW/uoG4+xXtd3tIyRODFdp5xSUq2ofTlh/WEb3Gj0h/a8oeXHg==" NoCertificado="00001000000706670758" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P" Exportacion="01" LugarExpedicion="72150" xmlns:cfdi="http://www.sat.gob.mx/cfd/4"><cfdi:Emisor Rfc="EDE1902136T2" Nombre="ELEMENTAL DENIM" RegimenFiscal="601" /><cfdi:Receptor Rfc="GTP930115PU1" Nombre="GRUPO TEXTIL PROVIDENCIA" DomicilioFiscalReceptor="90800" RegimenFiscalReceptor="601" UsoCFDI="CP01" /><cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01" /></cfdi:Conceptos><cfdi:Complemento><pago20:Pagos Version="2.0"><pago20:Totales TotalTrasladosBaseIVA16="93661.60" TotalTrasladosImpuestoIVA16="14985.86" MontoTotalPagos="108647.46" /><pago20:Pago FechaPago="2026-08-07T00:00:00" FormaDePagoP="03" MonedaP="MXN" TipoCambioP="1" Monto="108647.46"><pago20:DoctoRelacionado IdDocumento="89468773-640E-4FFE-B558-BECD65043164" Folio="5970" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="108647.46" ImpPagado="108647.46" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"><pago20:ImpuestosDR><pago20:TrasladosDR><pago20:TrasladoDR BaseDR="93661.600000" ImpuestoDR="002" TipoFactorDR="Tasa" TasaOCuotaDR="0.160000" ImporteDR="14985.856000" /></pago20:TrasladosDR></pago20:ImpuestosDR></pago20:DoctoRelacionado><pago20:ImpuestosP><pago20:TrasladosP><pago20:TrasladoP BaseP="93661.600000" ImpuestoP="002" TipoFactorP="Tasa" TasaOCuotaP="0.160000" ImporteP="14985.856000" /></pago20:TrasladosP></pago20:ImpuestosP></pago20:Pago></pago20:Pagos><tfd:TimbreFiscalDigital Version="1.1" RfcProvCertif="STA0903206B9" UUID="D269291F-80CB-4629-9A21-49CB6175C173" FechaTimbrado="2026-08-12T13:14:55" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" /></cfdi:Complemento></cfdi:Comprobante>`;

    const parsed = parseXmlInvoice(XML_PAGO_6174);

    expect(parsed.tipoComprobante).toBe('P');
    expect(parsed.folio).toBe('6174');
    expect(parsed.uuid).toBe('D269291F-80CB-4629-9A21-49CB6175C173');
    expect(parsed.total).toBe(108647.46);
    expect(parsed.complementoPago).toBeDefined();
    expect(parsed.complementoPago?.montoTotal).toBe(108647.46);
    expect(parsed.complementoPago?.doctosRelacionados).toHaveLength(1);
    expect(parsed.complementoPago?.doctosRelacionados[0].folio).toBe('5970');
    expect(parsed.complementoPago?.doctosRelacionados[0].idDocumento).toBe('89468773-640E-4FFE-B558-BECD65043164');
    expect(parsed.complementoPago?.doctosRelacionados[0].impPagado).toBe(108647.46);
  });
});
