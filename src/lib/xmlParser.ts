export interface ParsedInvoiceData {
  uuid: string;
  fecha: string;
  subTotal: number;
  total: number;
  emisorRfc: string;
  emisorNombre: string;
  receptorRfc: string;
  receptorNombre: string;
  conceptos: {
    cantidad: number;
    descripcion: string;
    valorUnitario: number;
    importe: number;
  }[];
}

export function parseXmlInvoice(xmlString: string): ParsedInvoiceData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("El archivo XML es inválido o está corrupto.");
  }

  const getAttr = (element: Element | null, attrName: string): string => {
    if (!element) return '';
    return element.getAttribute(attrName) || element.getAttribute(attrName.toLowerCase()) || '';
  };

  const getElement = (tagName: string): Element | null => {
    let el = xmlDoc.getElementsByTagName(`cfdi:${tagName}`)[0];
    if (!el) el = xmlDoc.getElementsByTagName(tagName)[0];
    return el || null;
  };

  const getElements = (tagName: string): Element[] => {
    let els = Array.from(xmlDoc.getElementsByTagName(`cfdi:${tagName}`));
    if (els.length === 0) els = Array.from(xmlDoc.getElementsByTagName(tagName));
    return els;
  };

  const comprobante = getElement("Comprobante");
  if (!comprobante) {
    throw new Error("No se encontró el nodo principal <cfdi:Comprobante>. Asegúrate de que sea una factura del SAT válida.");
  }

  const fecha = getAttr(comprobante, "Fecha");
  const subTotal = Number(getAttr(comprobante, "SubTotal") || "0");
  const total = Number(getAttr(comprobante, "Total") || "0");

  let timbre = xmlDoc.getElementsByTagName("tfd:TimbreFiscalDigital")[0];
  if (!timbre) timbre = xmlDoc.getElementsByTagName("TimbreFiscalDigital")[0];
  const uuid = timbre ? getAttr(timbre, "UUID") : "";

  if (!uuid) {
    throw new Error("No se encontró el UUID (Timbre Fiscal Digital). Este XML no está timbrado por el SAT.");
  }

  const emisor = getElement("Emisor");
  const receptor = getElement("Receptor");

  const emisorRfc = getAttr(emisor, "Rfc");
  const emisorNombre = getAttr(emisor, "Nombre");

  const receptorRfc = getAttr(receptor, "Rfc");
  const receptorNombre = getAttr(receptor, "Nombre");

  const conceptosNodes = getElements("Concepto");
  const conceptos = conceptosNodes.map(nodo => ({
    cantidad: Number(getAttr(nodo, "Cantidad") || "0"),
    descripcion: getAttr(nodo, "Descripcion"),
    valorUnitario: Number(getAttr(nodo, "ValorUnitario") || "0"),
    importe: Number(getAttr(nodo, "Importe") || "0"),
  }));

  return {
    uuid: uuid.toUpperCase(),
    fecha,
    subTotal,
    total,
    emisorRfc,
    emisorNombre,
    receptorRfc,
    receptorNombre,
    conceptos
  };
}
