import { round2 } from './finance';

export interface CfdiDraftItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  iva: number;
  total: number;
}

export interface CfdiDraftData {
  ocNumber: string;
  clientName?: string;
  clientRfc?: string;
  clientPostalCode?: string;
  clientRegimen?: string;
  clientUsoCfdi?: string;
  emisorName?: string;
  emisorRfc?: string;
  emisorPostalCode?: string;
  emisorRegimen?: string;
  items: CfdiDraftItem[];
}

/**
 * Genera un archivo XML estructurado conforme al estándar Anexo 20 SAT CFDI 4.0
 * con todos los nodos requeridos para prefacturación fiscal por los contadores.
 */
export function generateCfdi40DraftXml(data: CfdiDraftData): string {
  const dateStr = new Date().toISOString().slice(0, 19);
  const items = data.items || [];
  const subtotal = round2(items.reduce((acc, it) => acc + (it.subtotal || 0), 0));
  const totalIva = round2(items.reduce((acc, it) => acc + (it.iva || 0), 0));
  const total = round2(subtotal + totalIva);

  const emisorRfc = data.emisorRfc || 'EDE1902136T2';
  const emisorNombre = data.emisorName || 'ELEMENTAL DENIM';
  const emisorCp = data.emisorPostalCode || '72150';
  const emisorRegimen = data.emisorRegimen || '601';

  const receptorRfc = data.clientRfc || 'GTP930115PU1';
  const receptorNombre = data.clientName || 'GRUPO TEXTIL PROVIDENCIA';
  const receptorCp = data.clientPostalCode || '90800';
  const receptorRegimen = data.clientRegimen || '601';
  const receptorUso = data.clientUsoCfdi || 'G01';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" TipoDeComprobante="I" Moneda="MXN" Exportacion="01" MetodoPago="PPD" FormaPago="99" CondicionesDePago="OC ${data.ocNumber}" Fecha="${dateStr}" LugarExpedicion="${emisorCp}" SubTotal="${subtotal.toFixed(2)}" Total="${total.toFixed(2)}">\n`;
  
  // Emisor
  xml += `  <cfdi:Emisor Rfc="${emisorRfc}" Nombre="${emisorNombre}" RegimenFiscal="${emisorRegimen}"/>\n`;
  
  // Receptor
  xml += `  <cfdi:Receptor Rfc="${receptorRfc}" Nombre="${receptorNombre}" DomicilioFiscalReceptor="${receptorCp}" RegimenFiscalReceptor="${receptorRegimen}" UsoCFDI="${receptorUso}"/>\n`;
  
  // Conceptos
  xml += `  <cfdi:Conceptos>\n`;
  for (const it of items) {
    const itSub = round2(it.quantity * it.unitPrice);
    const itIva = round2(itSub * 0.16);
    xml += `    <cfdi:Concepto ClaveProdServ="24141500" NoIdentificacion="${it.code || 'BOLSA'}" Cantidad="${it.quantity.toFixed(2)}" ClaveUnidad="KGM" Unidad="KILOGRAMO" Descripcion="${escapeXml(it.description || 'BOLSA POLIETILENO')}" ValorUnitario="${it.unitPrice.toFixed(2)}" Importe="${itSub.toFixed(2)}" ObjetoImp="02">\n`;
    xml += `      <cfdi:Impuestos>\n`;
    xml += `        <cfdi:Traslados>\n`;
    xml += `          <cfdi:Traslado Base="${itSub.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${itIva.toFixed(2)}"/>\n`;
    xml += `        </cfdi:Traslados>\n`;
    xml += `      </cfdi:Impuestos>\n`;
    xml += `    </cfdi:Concepto>\n`;
  }
  xml += `  </cfdi:Conceptos>\n`;

  // Impuestos Globales
  xml += `  <cfdi:Impuestos TotalImpuestosTrasladados="${totalIva.toFixed(2)}">\n`;
  xml += `    <cfdi:Traslados>\n`;
  xml += `      <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${totalIva.toFixed(2)}"/>\n`;
  xml += `    </cfdi:Traslados>\n`;
  xml += `  </cfdi:Impuestos>\n`;
  xml += `</cfdi:Comprobante>`;

  return xml;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Descarga directamente el archivo XML borrador en el navegador del usuario.
 */
export function downloadCfdi40DraftXmlFile(data: CfdiDraftData) {
  const xmlContent = generateCfdi40DraftXml(data);
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Prefactura_CFDI40_OC_${data.ocNumber}_${new Date().toISOString().slice(0, 10)}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
