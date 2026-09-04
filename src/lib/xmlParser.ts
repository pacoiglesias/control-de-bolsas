export interface ParsedPaymentDoc {
  idDocumento: string;
  folio?: string;
  serie?: string;
  numParcialidad?: number;
  impSaldoAnt?: number;
  impPagado: number;
  impSaldoInsoluto?: number;
}

export interface ParsedInvoiceData {
  tipoComprobante?: 'I' | 'E' | 'P' | 'N' | 'T';
  uuid: string;
  folio?: string;
  serie?: string;
  condicionesDePago?: string;
  ocNumber?: string;
  fecha: string;
  subTotal: number;
  total: number;
  emisorRfc: string;
  emisorNombre: string;
  receptorRfc: string;
  receptorNombre: string;
  conceptos: {
    claveProdServ?: string;
    claveUnidad?: string;
    cantidad: number;
    descripcion: string;
    codigo?: string;
    valorUnitario: number;
    importe: number;
  }[];
  // Campos específicos de Complementos de Pago (Tipo P)
  complementoPago?: {
    fechaPago: string;
    formaPago: string;
    montoTotal: number;
    doctosRelacionados: ParsedPaymentDoc[];
  };
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

  const tipoComprobante = (getAttr(comprobante, "TipoDeComprobante") || "I") as 'I' | 'E' | 'P' | 'N' | 'T';
  const folio = getAttr(comprobante, "Folio");
  const serie = getAttr(comprobante, "Serie");
  const condicionesDePago = getAttr(comprobante, "CondicionesDePago");
  const fecha = getAttr(comprobante, "Fecha");
  let subTotal = Number(getAttr(comprobante, "SubTotal") || "0");
  let total = Number(getAttr(comprobante, "Total") || "0");

  // Extraer número de OC si viene en CondicionesDePago (ej: "OC 12026439713")
  const ocMatch = condicionesDePago.match(/\b(\d{10,14})\b/);
  const ocNumber = ocMatch ? ocMatch[1] : '';

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
  const conceptos = conceptosNodes.map(nodo => {
    const rawDesc = getAttr(nodo, "Descripcion") || '';
    const claveProdServ = getAttr(nodo, "ClaveProdServ") || '24141500';
    const claveUnidad = getAttr(nodo, "ClaveUnidad") || 'KGM';

    // Extraer código de producto de la descripción si viene adjunto (ej: "EGBO000018-SCBOLSA POLIETILENO..." o "egbo000103-sc BULTO...")
    let codigo = claveProdServ;
    let cleanDesc = rawDesc.trim();

    const stuckCode = rawDesc.match(/^([a-zA-Z0-9]{4,15}-(?:SC|BL|sc|bl|[a-zA-Z]{2}))([a-zA-Z\s].*)$/);
    if (stuckCode) {
      codigo = stuckCode[1];
      cleanDesc = stuckCode[2].trim();
    } else {
      const codeSplit = rawDesc.match(/^([a-zA-Z0-9_-]+)\s+(.+)$/);
      if (codeSplit) {
        codigo = codeSplit[1];
        cleanDesc = codeSplit[2].trim();
      }
    }

    return {
      claveProdServ,
      claveUnidad,
      cantidad: Number(getAttr(nodo, "Cantidad") || "0"),
      descripcion: cleanDesc || rawDesc,
      codigo,
      valorUnitario: Number(getAttr(nodo, "ValorUnitario") || "0"),
      importe: Number(getAttr(nodo, "Importe") || "0"),
    };
  });

  // Extraer Complemento de Pago si tipoComprobante === 'P'
  let complementoPago: ParsedInvoiceData['complementoPago'] = undefined;
  if (tipoComprobante === 'P' || xmlString.includes('Pagos')) {
    const pagosNodes = [
      ...Array.from(xmlDoc.getElementsByTagName('pago20:Pago')),
      ...Array.from(xmlDoc.getElementsByTagName('pago10:Pago')),
      ...Array.from(xmlDoc.getElementsByTagName('Pago'))
    ];

    if (pagosNodes.length > 0) {
      const pNodo = pagosNodes[0];
      const fechaPago = getAttr(pNodo, "FechaPago") || fecha;
      const formaPago = getAttr(pNodo, "FormaDePagoP") || getAttr(pNodo, "FormaPago") || '03';
      const montoTotal = Number(getAttr(pNodo, "Monto") || "0");

      const doctosNodes = [
        ...Array.from(pNodo.getElementsByTagName('pago20:DoctoRelacionado')),
        ...Array.from(pNodo.getElementsByTagName('pago10:DoctoRelacionado')),
        ...Array.from(pNodo.getElementsByTagName('DoctoRelacionado'))
      ];

      const doctosRelacionados: ParsedPaymentDoc[] = doctosNodes.map(dn => ({
        idDocumento: (getAttr(dn, "IdDocumento") || "").toUpperCase(),
        folio: getAttr(dn, "Folio") || '',
        serie: getAttr(dn, "Serie") || '',
        numParcialidad: Number(getAttr(dn, "NumParcialidad") || "1"),
        impSaldoAnt: Number(getAttr(dn, "ImpSaldoAnt") || "0"),
        impPagado: Number(getAttr(dn, "ImpPagado") || getAttr(pNodo, "Monto") || "0"),
        impSaldoInsoluto: Number(getAttr(dn, "ImpSaldoInsoluto") || "0"),
      }));

      complementoPago = {
        fechaPago,
        formaPago,
        montoTotal: montoTotal || doctosRelacionados.reduce((acc, d) => acc + d.impPagado, 0),
        doctosRelacionados
      };

      if (total === 0 && complementoPago.montoTotal > 0) {
        total = complementoPago.montoTotal;
        subTotal = Number((total / 1.16).toFixed(2));
      }
    }
  }

  return {
    tipoComprobante,
    uuid: uuid.toUpperCase(),
    folio,
    serie,
    condicionesDePago,
    ocNumber,
    fecha,
    subTotal,
    total,
    emisorRfc,
    emisorNombre,
    receptorRfc,
    receptorNombre,
    conceptos,
    complementoPago
  };
}
