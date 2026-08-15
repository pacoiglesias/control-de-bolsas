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

  it('arroja error si no hay UUID', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Fecha="2026-08-01T12:00:00" SubTotal="100" Total="116">
  <cfdi:Complemento>
    <!-- Falta timbre -->
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    expect(() => parseXmlInvoice(xml)).toThrowError('No se encontró el UUID');
  });
});
