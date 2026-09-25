/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { parseScaleTicket } from '../scaleTicketParser';
import { parseXmlInvoice } from '../xmlParser';

describe('Global Dropzone HUD & Multi-Format Document Analyzer', () => {
  it('debe detectar correctamente un Ticket de Báscula con peso neto, placas y fecha', () => {
    const rawTicket = `
      BASCULA PUBLICA Y PRIVADA SANTA ANA
      FECHA: 2026-09-24 11:30:15
      PLACAS: XA-4821-C
      CHOFER: JORGE HERNANDEZ
      PESO BRUTO: 15400 KG
      TARA: 9386 KG
      PESO NETO: 6014.00 KG
      ORDEN DE COMPRA: 120267114302
    `;

    const result = parseScaleTicket(rawTicket);
    expect(result.kilosNeto).toBe(6014.00);
    expect(result.detectedOc).toBe('120267114302');
    expect(result.placas).toBe('XA-4821-C');
  });

  it('debe parsear un XML CFDI 4.0 extrayendo UUID, folio, kilos y montos al centavo', () => {
    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
      <cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
        Folio="6302"
        Fecha="2026-09-22T11:58:13"
        SubTotal="12814.00"
        Total="14864.24"
        Moneda="MXN"
        CondicionesDePago="OC 12026439774">
        <cfdi:Emisor Rfc="EDE1902136T2" Nombre="ELEMENTAL DENIM"/>
        <cfdi:Receptor Rfc="GTP930115PU1" Nombre="GRUPO TEXTIL PROVIDENCIA"/>
        <cfdi:Conceptos>
          <cfdi:Concepto ClaveProdServ="24141500" Cantidad="298.00" ClaveUnidad="KGM" ValorUnitario="43.00" Importe="12814.00" Descripcion="BOLSA POLIETILENO 1.20 M X 1.60 M"/>
        </cfdi:Conceptos>
        <cfdi:Complemento>
          <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="FFD7964A-BD1E-4332-AEA9-61E3F498521C"/>
        </cfdi:Complemento>
      </cfdi:Comprobante>`;

    const parsed = parseXmlInvoice(mockXml);
    expect(parsed.folio).toBe('6302');
    expect(parsed.uuid).toBe('FFD7964A-BD1E-4332-AEA9-61E3F498521C');
    expect(parsed.total).toBe(14864.24);
    expect(parsed.subTotal).toBe(12814.00);
    expect(parsed.conceptos[0].cantidad).toBe(298.00);
  });
});
