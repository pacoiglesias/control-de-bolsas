/**
 * Parser especializado para Tickets de Báscula (Patio Providencia, Báscula Pública y Trailers)
 */

export interface ParsedScaleTicket {
  rawText: string;
  kilosNeto?: number;
  kilosBruto?: number;
  kilosTara?: number;
  ticketFolio?: string;
  dateStr?: string; // YYYY-MM-DD
  placas?: string;
  driver?: string;
  detectedOc?: string;
  detectedDepartment?: 'TH' | 'GT';
  detectedProductCodes: string[];
  detectedProductDescription?: string;
  confidence: 'high' | 'medium' | 'low';
}

function cleanNumber(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/,/g, '').trim();
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

export function parseScaleTicket(text: string): ParsedScaleTicket {
  const result: ParsedScaleTicket = {
    rawText: text,
    detectedProductCodes: [],
    confidence: 'low',
  };

  if (!text || typeof text !== 'string') {
    return result;
  }

  const normalized = text.toUpperCase();

  // 1. Extraer PESO NETO
  const netoMatches = [
    /PESO\s*NETO\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i,
    /P\.?\s*NETO\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i,
    /NETO\s*[:=]?\s*([\d,]+(?:\.\d+)?)\s*(?:KG|KGS|KILOS|KGM)?/i,
    /CANTIDAD\s*NETA\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i,
    /TOTAL\s*NETO\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i,
  ];

  for (const regex of netoMatches) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      const val = cleanNumber(match[1]);
      if (val > 0) {
        result.kilosNeto = val;
        break;
      }
    }
  }

  // 2. Extraer BRUTO y TARA
  const brutoMatch = normalized.match(/(?:PESO\s*)?BRUTO\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
  if (brutoMatch && brutoMatch[1]) {
    result.kilosBruto = cleanNumber(brutoMatch[1]);
  }

  const taraMatch = normalized.match(/TARA\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
  if (taraMatch && taraMatch[1]) {
    result.kilosTara = cleanNumber(taraMatch[1]);
  }

  // Si no se encontró neto explícito, pero sí bruto y tara, calcular: Neto = Bruto - Tara
  if (!result.kilosNeto && result.kilosBruto && result.kilosTara && result.kilosBruto > result.kilosTara) {
    result.kilosNeto = Math.round((result.kilosBruto - result.kilosTara) * 100) / 100;
  }

  // 3. Fallback para Kilos genéricos si no hay etiqueta NETO
  if (!result.kilosNeto) {
    const genericKgMatch = normalized.match(/([\d,]+(?:\.\d+)?)\s*(?:KG|KGS|KILOGRAMOS|KILOS)\b/i);
    if (genericKgMatch && genericKgMatch[1]) {
      const val = cleanNumber(genericKgMatch[1]);
      if (val >= 10 && val <= 50000) {
        result.kilosNeto = val;
      }
    }
  }

  // 4. Extraer FOLIO / TICKET #
  const ticketMatches = [
    /TICKET\s*(?:NO\.?|NUM\.?|#)?\s*[:=]?\s*([A-Z0-9-]{3,12})/i,
    /FOLIO\s*(?:NO\.?|#)?\s*[:=]?\s*([A-Z0-9-]{3,12})/i,
    /REMISI[OÓ]N\s*(?:NO\.?|#)?\s*[:=]?\s*([A-Z0-9-]{3,12})/i,
    /BOLETA\s*(?:NO\.?|#)?\s*[:=]?\s*([A-Z0-9-]{3,12})/i,
    /PESAJE\s*(?:NO\.?|#)?\s*[:=]?\s*([A-Z0-9-]{3,12})/i,
  ];

  for (const regex of ticketMatches) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      result.ticketFolio = match[1].trim();
      break;
    }
  }

  // 5. Extraer FECHA (Formatos DD/MM/YYYY, YYYY-MM-DD o DD-MM-YYYY)
  const dateMatch1 = text.match(/\b([0-3]?[0-9])[\/\-.]([0-1]?[0-9])[\/\-.](202[4-9]|[2-9][0-9])\b/);
  if (dateMatch1) {
    let day = dateMatch1[1].padStart(2, '0');
    let month = dateMatch1[2].padStart(2, '0');
    let year = dateMatch1[3];
    if (year.length === 2) year = `20${year}`;
    result.dateStr = `${year}-${month}-${day}`;
  } else {
    const dateMatch2 = text.match(/\b(202[4-9])[\/\-.]([0-1]?[0-9])[\/\-.]([0-3]?[0-9])\b/);
    if (dateMatch2) {
      const year = dateMatch2[1];
      const month = dateMatch2[2].padStart(2, '0');
      const day = dateMatch2[3].padStart(2, '0');
      result.dateStr = `${year}-${month}-${day}`;
    }
  }

  // 6. Extraer PLACAS
  const placasMatch = normalized.match(/(?:PLACAS?|VEH[IÍ]CULO|UNIDAD)(?:[\s/]+(?:PLACAS?|VEH[IÍ]CULO|UNIDAD))*\s*[:=]?\s*([A-Z0-9]{2,4}[- ][A-Z0-9]{2,5}(?:[- ][A-Z0-9]{1,3})?|[A-Z0-9]{5,8})/i);
  if (placasMatch && placasMatch[1]) {
    const candidate = placasMatch[1].replace(/\s+/g, '-').trim();
    if (!candidate.includes('PLACAS') && !candidate.includes('VEHIC')) {
      result.placas = candidate;
    }
  }

  // 7. Extraer CHOFER / CONDUCTOR
  const driverMatch = normalized.match(/(?:CHOFER|CONDUCTOR|OPERADOR)\s*[:=]?\s*([A-ZÁÉÍÓÚÑ\s]{4,30})(?:\r?\n|$)/i);
  if (driverMatch && driverMatch[1]) {
    const dName = driverMatch[1].trim();
    if (dName.length >= 3 && !dName.includes('KG') && !dName.includes('FECHA')) {
      result.driver = dName;
    }
  }

  // 8. Extraer Número de OC si viene mencionado en el ticket
  const ocMatch = normalized.match(/(?:OC|ORDEN\s*DE\s*COMPRA|PEDIDO|ORDEN)\s*[:#]?\s*([0-9]{5,15}|[0-9]{2}\/[0-9]{4,5})/i) ||
                  normalized.match(/\b(12026[0-9]{5,11})\b/) ||
                  normalized.match(/\b(43\/[0-9]{4,5})\b/) ||
                  normalized.match(/\b(71\/[0-9]{4,5})\b/);
  if (ocMatch && ocMatch[1]) {
    result.detectedOc = ocMatch[1].trim();
  }

  // 9. Extraer Departamento (TH vs GT / Planta P4 vs Textil Hogar)
  if (normalized.includes('TEXTIL HOGAR') || normalized.includes('PLANTA TH') || normalized.includes('NAVA') || normalized.includes('71/')) {
    result.detectedDepartment = 'TH';
  } else if (normalized.includes('GRUPO TEXTIL') || normalized.includes('PLANTA 4') || normalized.includes('PLANTA P4') || normalized.includes('EVELIA') || normalized.includes('43/')) {
    result.detectedDepartment = 'GT';
  }

  // 10. Extraer Códigos de Producto (EGBO... o ENBO...)
  const productCodeMatches = [...normalized.matchAll(/\b((?:EGBO|ENBO)[0-9]{6}(?:-[A-Z0-9]+)?)\b/g)];
  if (productCodeMatches.length > 0) {
    result.detectedProductCodes = Array.from(new Set(productCodeMatches.map((m) => m[1])));
  }

  // 11. Extraer Descripción de Producto
  const descMatch = normalized.match(/(BOLSA[A-Z0-9\s.,-]+?)(?:PESO|TARA|BRUTO|NETO|TICKET|KG|\r?\n|$)/i);
  if (descMatch && descMatch[1]) {
    result.detectedProductDescription = descMatch[1].trim();
  }

  // Determinar nivel de confianza
  if (result.kilosNeto && (result.ticketFolio || result.detectedOc || result.detectedProductCodes.length > 0)) {
    result.confidence = 'high';
  } else if (result.kilosNeto) {
    result.confidence = 'medium';
  } else {
    result.confidence = 'low';
  }

  return result;
}

export interface OcComparisonResult {
  matchedOrder?: any;
  suggestedOrderId?: string;
  suggestedOcFolio?: string;
  orderTotalKg: number;
  orderDeliveredKg: number;
  orderPendingKg: number;
  ticketKg: number;
  remainingAfterTicketKg: number;
  status: 'valid_partial' | 'valid_completion' | 'over_delivery' | 'no_active_oc';
  statusMessage: string;
  matchedItem?: any;
  matchedBy: 'oc_number' | 'product_code' | 'department_match' | 'highest_pending';
  score: number;
}

/**
 * Compara inteligentemente el ticket de báscula escaneado contra el catálogo de OCs activas
 */
export function matchScaleTicketWithOrders(
  ticket: ParsedScaleTicket,
  orders: any[]
): OcComparisonResult {
  const ticketKg = Number(ticket.kilosNeto) || 0;

  // 1. Filtrar órdenes no cerradas
  const activeCandidates = orders
    .filter((o) => o && !o.isClosedShort)
    .map((o) => {
      const itemsKg = (o.items || []).reduce((a: number, it: any) => a + (Number(it.quantity) || 0), 0);
      const totalKg = itemsKg > 0 ? itemsKg : Number(o.totalKilograms) || 0;
      
      const deliveries = o.deliveries || [];
      const deliveredKg = deliveries.reduce((a: number, d: any) => a + (Number(d.kilos) || 0), 0);
      const pendingKg = Math.max(0, Math.round((totalKg - deliveredKg) * 100) / 100);

      return {
        order: o,
        totalKg,
        deliveredKg,
        pendingKg,
      };
    })
    .filter((c) => c.pendingKg > 0.01);

  if (activeCandidates.length === 0) {
    return {
      orderTotalKg: 0,
      orderDeliveredKg: 0,
      orderPendingKg: 0,
      ticketKg,
      remainingAfterTicketKg: 0,
      status: 'no_active_oc',
      statusMessage: '⚠️ No hay Órdenes de Compra con saldo pendiente por entregar.',
      matchedBy: 'highest_pending',
      score: 0,
    };
  }

  // 2. Puntuar cada orden candidata
  let bestCandidate = activeCandidates[0];
  let highestScore = -1;
  let matchReason: OcComparisonResult['matchedBy'] = 'highest_pending';
  let matchedItem: any = undefined;

  for (const cand of activeCandidates) {
    let score = 0;
    const o = cand.order;
    const oOc = (o.oc || '').toUpperCase();
    const oFolio = (o.folio || '').toUpperCase();
    const oDept = (o.department || '').toUpperCase();

    // A) Coincidencia por número de OC (+60 pts)
    if (ticket.detectedOc) {
      const cleanTarget = ticket.detectedOc.replace(/[^A-Z0-9]/g, '');
      const cleanOc = oOc.replace(/[^A-Z0-9]/g, '');
      const cleanFolio = oFolio.replace(/[^A-Z0-9]/g, '');

      if (cleanOc.includes(cleanTarget) || cleanTarget.includes(cleanOc)) score += 60;
      if (cleanFolio.includes(cleanTarget) || cleanTarget.includes(cleanFolio)) score += 60;
    }

    // B) Coincidencia por Código de Producto (+40 pts)
    if (ticket.detectedProductCodes.length > 0) {
      for (const it of o.items || []) {
        const itCode = (it.code || '').toUpperCase();
        if (ticket.detectedProductCodes.some((code) => itCode.includes(code) || code.includes(itCode))) {
          score += 40;
          matchedItem = it;
          break;
        }
      }
    }

    // C) Coincidencia por Departamento (TH vs GT) (+25 pts)
    if (ticket.detectedDepartment && oDept.includes(ticket.detectedDepartment)) {
      score += 25;
    }

    // D) Compatibilidad de Kilos: si cabe en el saldo (+15 pts)
    if (ticketKg > 0 && ticketKg <= cand.pendingKg + 0.01) {
      score += 15;
    }

    // E) Saldo pendiente mayor como desempate (+5 pts)
    score += Math.min(5, Math.floor(cand.pendingKg / 1000));

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = cand;
      if (ticket.detectedOc && score >= 60) matchReason = 'oc_number';
      else if (ticket.detectedProductCodes.length > 0 && score >= 40) matchReason = 'product_code';
      else if (ticket.detectedDepartment && score >= 25) matchReason = 'department_match';
      else matchReason = 'highest_pending';
    }
  }

  // 3. Determinar estado y mensaje de comparación
  const orderPendingKg = bestCandidate.pendingKg;
  const remainingAfter = Math.max(0, Math.round((orderPendingKg - ticketKg) * 100) / 100);
  const ocLabel = bestCandidate.order.oc || bestCandidate.order.folio || bestCandidate.order.id;

  let status: OcComparisonResult['status'] = 'valid_partial';
  let statusMessage = '';

  if (ticketKg <= 0) {
    status = 'valid_partial';
    statusMessage = `OC identificada: #${ocLabel} (${orderPendingKg.toLocaleString('es-MX')} kg pendientes).`;
  } else if (ticketKg > orderPendingKg + 50) {
    status = 'over_delivery';
    const exceso = Math.round((ticketKg - orderPendingKg) * 100) / 100;
    statusMessage = `⚠️ Alerta de Exceso: El ticket pesa ${ticketKg.toLocaleString('es-MX')} kg, pero la OC #${ocLabel} solo tiene ${orderPendingKg.toLocaleString('es-MX')} kg pendientes (+${exceso.toLocaleString('es-MX')} kg de exceso).`;
  } else if (Math.abs(orderPendingKg - ticketKg) <= 50) {
    status = 'valid_completion';
    statusMessage = `🎉 Entrega Completa: Este pesaje de ${ticketKg.toLocaleString('es-MX')} kg liquida al 100% la OC #${ocLabel}.`;
  } else {
    status = 'valid_partial';
    statusMessage = `✅ Entrega Parcial Válida: Cubre ${ticketKg.toLocaleString('es-MX')} kg de los ${orderPendingKg.toLocaleString('es-MX')} kg pendientes en OC #${ocLabel} (quedarán ${remainingAfter.toLocaleString('es-MX')} kg).`;
  }

  return {
    matchedOrder: bestCandidate.order,
    suggestedOrderId: bestCandidate.order.id,
    suggestedOcFolio: ocLabel,
    orderTotalKg: bestCandidate.totalKg,
    orderDeliveredKg: bestCandidate.deliveredKg,
    orderPendingKg,
    ticketKg,
    remainingAfterTicketKg: remainingAfter,
    status,
    statusMessage,
    matchedItem,
    matchedBy: matchReason,
    score: highestScore,
  };
}

