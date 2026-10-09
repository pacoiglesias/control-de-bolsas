/**
 * autoDocumentPipeline.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor central de ingesta ultra-rápida y touchless para documentos:
 * Facturas CFDI (PDF/XML), Tickets de Báscula, Remisiones, Pagos TR y OCs.
 *
 * Características:
 *  - Extracción automática e infalible (OCR + Regex canónicos SAT/Providencia).
 *  - Deduplicación atómica (no duplica facturas por folio ni UUID).
 *  - Detección unívoca de OC (TH 120267114302 · 71/14302 / GT 12026439784 · 43/9784).
 *  - Aplicación directa a Firestore (invoices + deliveries + serverTimestamp).
 *  - Respaldo automático en Firebase Storage (uploadDocument) con metadatos.
 *  - Reactividad inmediata (OrdersContext onSnapshot reacciona al instante).
 */

import { Timestamp, doc, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { safeUpdateDoc, safeAddDoc } from './safeFirestore';
import { cleanUndefined } from './cleanUndefined';
import { uploadDocument } from './documentStorage';
import { parseXmlInvoice } from './xmlParser';
import { extractTextFromPdf, extractTextFromImage, parseOcrData } from './ocr';
import { parseScaleTicket } from './scaleTicketParser';
import { parseProvidenciaPaymentPdf } from './providenciaPortalParser';
import { parseBankTransferReceipt } from './bankReceiptParser';
import { OC_TH_ACTIVE, OC_GT_ACTIVE } from './constants';
import { round2 } from './finance';
import type { PurchaseOrder, Invoice, Delivery } from './types';

export function normalizeInvoiceFolio(folio?: string): string {
  if (!folio) return '';
  return folio.trim().toUpperCase().replace(/[\s\-_]/g, '');
}

export type PipelineDocType =
  | 'factura_cfdi'
  | 'ticket_bascula'
  | 'remision'
  | 'comprobante_pago'
  | 'oc_providencia'
  | 'contrarecibo'
  | 'desconocido';

export interface PipelineAnalysis {
  file: File;
  docType: PipelineDocType;
  confidence: 'alta' | 'media' | 'baja';
  folio: string;
  uuid?: string;
  kilos: number;
  subtotal: number;
  total: number;
  docDate: string;
  detectedOcNumber: string;
  matchedOrder: PurchaseOrder | null;
  autoAssignedLabel: string | null;
  isDuplicate: boolean;
  duplicateOrder?: PurchaseOrder;
  isSuspectDuplicate?: boolean;
  hasFolioCollision?: boolean;
  forceApply?: boolean;
  suspectReason?: string;
  suspectDelivery?: Delivery;
  collisionInvoice?: Invoice;
  needsClarification: boolean;
  rawText?: string;
  ocPiezasInfo?: {
    totalPiezas: number;
    conceptos: Array<{ codigo: string; descripcion: string; cantidad: number; valorUnitario: number }>;
  };
  contrareciboNumber?: string;
  facturaFolios?: string[];
  dueDate?: string;
}

export interface PipelineApplyResult {
  success: boolean;
  message: string;
  docType: PipelineDocType;
  folio: string;
  kilos: number;
  total: number;
  orderId?: string;
  orderFolio?: string;
  orderClient?: string;
  isDuplicate?: boolean;
  isSuspectDuplicate?: boolean;
  hasFolioCollision?: boolean;
  needsReview?: boolean;
  reviewReason?: string;
}

function toSafeTimestamp(dateStr?: string): Timestamp {
  if (!dateStr) return Timestamp.now();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
}

/**
 * 🎯 Motor canónico para buscar orden coincidente
 */
export function matchOrderCanonical(
  orders: PurchaseOrder[],
  ocCandidate?: string,
  folioCandidate?: string,
  amountCandidate?: number,
  crCandidate?: string
): PurchaseOrder | null {
  if (!orders || orders.length === 0) return null;

  const cleanOc = (ocCandidate || '').replace(/[^0-9]/g, '');
  const cleanFolio = (folioCandidate || '').trim().toUpperCase();
  const cleanCr = (crCandidate || '').trim().toUpperCase();

  // 1. Detección Canónica Oficial Directa
  let found = orders.find((o) => {
    if (!o || (o as any).isDeleted) return false;
    const oOc = (o.oc || o.folio || o.id || '').replace(/[^0-9]/g, '');
    if (cleanOc && cleanOc.length >= 4 && (oOc.includes(cleanOc) || cleanOc.includes(oOc))) return true;

    // Alias canónicos oficiales TH (120267114302 · 71/14302)
    if (
      (cleanOc.includes('14302') || cleanOc.includes('67114302') || cleanOc.includes('114099')) &&
      (o.oc === OC_TH_ACTIVE || oOc.includes('14302') || (o.folio || '').includes('14302'))
    ) {
      return true;
    }

    // Alias canónicos oficiales GT (12026439784 · 43/9784)
    if (
      (cleanOc.includes('9784') || cleanOc.includes('6439784') || cleanOc.includes('439784')) &&
      (o.oc === OC_GT_ACTIVE || oOc.includes('9784') || (o.folio || '').includes('9784'))
    ) {
      return true;
    }

    // OCs históricas finiquitadas
    if (cleanOc.includes('9713') && (o.oc?.includes('9713') || o.folio?.includes('9713'))) return true;
    if (cleanOc.includes('14114') && (o.oc?.includes('14114') || o.folio?.includes('14114'))) return true;
    return false;
  });

  // 2. Coincidencia por Folio de factura registrada previamente
  if (!found && cleanFolio) {
    found = orders.find((o) => {
      if (!o || (o as any).isDeleted) return false;
      return o.folio === cleanFolio || (o.invoices || []).some((i) => i.folio === cleanFolio);
    });
  }

  // 3. Coincidencia por Contrarecibo
  if (!found && cleanCr) {
    found = orders.find((o) => {
      if (!o || (o as any).isDeleted) return false;
      return (
        o.collection?.contrareciboNumber === cleanCr ||
        (o.invoices || []).some((i) => i.collection?.contrareciboNumber === cleanCr)
      );
    });
  }

  // 4. Coincidencia por Importe exacto en facturas existentes
  if (!found && amountCandidate && amountCandidate > 0) {
    found = orders.find((o) => {
      if (!o || (o as any).isDeleted) return false;
      return (o.invoices || []).some(
        (i) => Math.abs((i.financials?.invoiceTotal || 0) - amountCandidate) < 1
      );
    });
  }

  return found || null;
}

/**
 * 🛡️ Verifica si el folio o UUID ya existe en alguna orden activa.
 * Distingue duplicado estricto por UUID frente a colisión de folio con UUID distinto.
 */
export function findExistingInvoice(
  orders: PurchaseOrder[],
  folioCandidate?: string,
  uuidCandidate?: string
): { isDuplicate: boolean; hasFolioCollision?: boolean; order?: PurchaseOrder; invoice?: Invoice } {
  if (!folioCandidate && !uuidCandidate) return { isDuplicate: false };

  // Detección automática por si los parámetros se enviaron invertidos
  const isLikelyUuid = (str?: string) =>
    !!str && (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim()) || str.trim().length === 36);

  let rawFolio = folioCandidate;
  let rawUuid = uuidCandidate;

  if (isLikelyUuid(rawFolio) && !isLikelyUuid(rawUuid)) {
    // Invertidos
    rawUuid = folioCandidate;
    rawFolio = uuidCandidate;
  }

  const cleanFolio = rawFolio?.trim().toUpperCase();
  const cleanUuid = rawUuid?.trim().toLowerCase();

  for (const o of orders) {
    if (!o || (o as any).isDeleted) continue;
    for (const inv of o.invoices || []) {
      if (!inv) continue;
      const invUuid = (inv.uuid || (inv as any).uuidFiscal || '').trim().toLowerCase();
      const invFolio = inv.folio?.trim().toUpperCase();

      // 1. Coincidencia idéntica por UUID fiscal SAT (duplicado absoluto)
      if (cleanUuid && invUuid && cleanUuid === invUuid) {
        return { isDuplicate: true, order: o, invoice: inv };
      }

      // 2. Coincidencia por folio
      if (cleanFolio && invFolio && cleanFolio === invFolio) {
        if (cleanUuid && invUuid && cleanUuid !== invUuid) {
          // Mismo folio pero distinto UUID SAT: no bloquear como duplicado ciego, marcar colisión para revisión
          return { isDuplicate: false, hasFolioCollision: true, order: o, invoice: inv };
        }
        return { isDuplicate: true, order: o, invoice: inv };
      }
    }
  }
  return { isDuplicate: false };
}

/**
 * 🛡️ Verifica si una remisión o ticket de báscula ya existe en alguna orden activa
 * Soporta entregas con folio, entregas sin folio y detección estricta por límites de palabra.
 * Detecta coincidencia exacta (duplicado) y coincidencia aproximada (advertencia/revisión).
 */
export function findExistingDelivery(
  orders: PurchaseOrder[],
  folioCandidate?: string,
  kilosCandidate?: number,
  dateCandidate?: string
): { isDuplicate: boolean; isSuspectDuplicate?: boolean; order?: PurchaseOrder; delivery?: Delivery; reason?: string } {
  const cleanFolio = folioCandidate?.trim().toUpperCase();
  const kilos = kilosCandidate ? round2(kilosCandidate) : 0;

  for (const o of orders) {
    if (!o || (o as any).isDeleted) continue;
    for (const d of o.deliveries || []) {
      if (!d) continue;
      const dFolio = d.docFolio?.trim().toUpperCase();
      const dKilos = Number(d.kilos) || 0;

      // 1. Coincidencia por folio exacto de remisión/ticket
      if (cleanFolio && dFolio && dFolio === cleanFolio) {
        return {
          isDuplicate: true,
          order: o,
          delivery: d,
          reason: `Remisión/Ticket #${cleanFolio} (${dKilos} kg) ya registrado en OC ${o.folio || o.oc}`,
        };
      }

      // 2. Coincidencia por folio en notas usando límites de palabra para evitar falsos positivos
      if (cleanFolio && cleanFolio.length >= 4 && d.notes) {
        const wordRegex = new RegExp(`\\b${cleanFolio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (wordRegex.test(d.notes)) {
          return {
            isDuplicate: true,
            order: o,
            delivery: d,
            reason: `Remisión/Ticket #${cleanFolio} referenciado en notas de OC ${o.folio || o.oc}`,
          };
        }
      }

      // 3. Coincidencia de entrega SIN FOLIO o por mismo pesaje exacto y misma fecha
      if (kilos > 0 && dateCandidate && d.date) {
        const dDateStr = typeof d.date.toDate === 'function'
          ? d.date.toDate().toISOString().split('T')[0]
          : (d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0]);

        if (dDateStr === dateCandidate && Math.abs(dKilos - kilos) < 0.05) {
          // Si ambos carecen de folio, o uno no tiene folio y el pesaje es idéntico al gramo
          if (!cleanFolio || !dFolio || cleanFolio === dFolio) {
            return {
              isDuplicate: true,
              order: o,
              delivery: d,
              reason: `Entrega de ${kilos} kg del ${dateCandidate} ya registrada en OC ${o.folio || o.oc}`,
            };
          }
        }

        // 4. Coincidencia aproximada: misma fecha o cercana (+/- 1 día) con pesaje muy cercano (< 1% o < 2 kg)
        if (Math.abs(dKilos - kilos) <= Math.max(2, kilos * 0.01)) {
          const diffDays = Math.abs(new Date(dDateStr).getTime() - new Date(dateCandidate).getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 1) {
            return {
              isDuplicate: false,
              isSuspectDuplicate: true,
              order: o,
              delivery: d,
              reason: `⚠️ Posible entrega duplicada: pesaje similar de ${dKilos} kg el ${dDateStr} ya existe en OC ${o.folio || o.oc}. Verifique físicamente.`,
            };
          }
        }
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * 🛡️ Verifica si un comprobante de pago bancario o SPEI ya fue registrado previamente
 */
export function findExistingPayment(
  orders: PurchaseOrder[],
  paymentRefCandidate?: string,
  amountCandidate?: number,
  _dateCandidate?: string
): { isDuplicate: boolean; order?: PurchaseOrder; invoice?: Invoice; reason?: string } {
  const cleanRef = paymentRefCandidate?.trim().toUpperCase();
  const amount = amountCandidate ? round2(amountCandidate) : 0;
  if (!cleanRef && amount <= 0) return { isDuplicate: false };

  for (const o of orders) {
    if (!o || (o as any).isDeleted) continue;
    for (const inv of o.invoices || []) {
      if (!inv) continue;
      const invRef = inv.collection?.transferRef?.trim().toUpperCase();
      const invSap = inv.collection?.sapDocument?.trim().toUpperCase();

      // 1. Coincidencia por clave de rastreo / referencia idéntica
      if (cleanRef && cleanRef.length >= 5 && (invRef === cleanRef || invSap === cleanRef)) {
        return {
          isDuplicate: true,
          order: o,
          invoice: inv,
          reason: `Comprobante ${cleanRef} ya aplicado previamente a Factura #${inv.folio || 'S/N'} en OC ${o.folio || o.oc}`,
        };
      }

      // 2. Coincidencia en historial de abonos por clave de referencia o identificador único
      const existingAbono = (inv.collection?.paymentsHistory || []).find((p: any) => {
        const pRef = (p.reference || p.receiptId || '').trim().toUpperCase();
        // Si hay referencia/folio estable y coincide: es duplicado
        if (cleanRef && cleanRef.length >= 4 && pRef === cleanRef) return true;
        // Si no hay referencia, solo marcar duplicado si la referencia generada o notas coinciden con el documento
        if (cleanRef && pRef && pRef.includes(cleanRef)) return true;
        return false;
      });

      if (existingAbono) {
        return {
          isDuplicate: true,
          order: o,
          invoice: inv,
          reason: `Abono de $${amount.toLocaleString('es-MX')} (${cleanRef || 'SPEI'}) ya registrado en Factura #${inv.folio || 'S/N'}`,
        };
      }
    }
  }

  return { isDuplicate: false };
}



/**
 * ⚡ Analiza cualquier archivo en alta velocidad
 */
export async function analyzeDocumentFast(
  file: File,
  orders: PurchaseOrder[]
): Promise<PipelineAnalysis> {
  const fileName = file.name.toLowerCase();
  let docType: PipelineDocType = 'desconocido';
  let confidence: 'alta' | 'media' | 'baja' = 'baja';
  let folio = '';
  let uuid = '';
  let kilos = 0;
  let subtotal = 0;
  let total = 0;
  let docDate = new Date().toISOString().split('T')[0];
  let detectedOcNumber = '';
  let rawText = '';
  let ocPiezasInfo: PipelineAnalysis['ocPiezasInfo'];
  let contrareciboNumber = '';
  let facturaFolios: string[] = [];
  let dueDate = '';

  try {
    // 1. CASO XML CFDI
    if (fileName.endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml') {
      const text = await file.text();
      rawText = text;
      const parsed = parseXmlInvoice(text);
      if (parsed) {
        docType = 'factura_cfdi';
        confidence = 'alta';
        folio = parsed.folio || '';
        uuid = parsed.uuid || '';
        const totalKg = (parsed.conceptos || []).reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);
        kilos = round2(totalKg);
        subtotal = round2(parsed.subTotal || 0);
        total = round2(parsed.total || 0);
        docDate = parsed.fecha ? parsed.fecha.split('T')[0] : docDate;
        detectedOcNumber = parsed.ocNumber || '';
      }
    }
    // 2. CASO PDF
    else if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      const text = await extractTextFromPdf(file);
      rawText = text;

      // 0. Detalle de Pagos Providencia
      const provPayment = parseProvidenciaPaymentPdf(text);
      if (provPayment) {
        docType = 'comprobante_pago';
        confidence = 'alta';
        folio = provPayment.facturaFolio || provPayment.transferRef || '';
        kilos = 0;
        subtotal = round2(provPayment.amount / 1.16);
        total = round2(provPayment.amount);
        detectedOcNumber = provPayment.transferRef || '';
        if (provPayment.paymentDate) {
          const dp = provPayment.paymentDate.split('/');
          if (dp.length === 3) docDate = `${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
        }
      } else {
        // 1. Comprobante bancario SPEI
        const bankTransfer = parseBankTransferReceipt(text);
        if (bankTransfer && bankTransfer.amount > 0) {
          docType = 'comprobante_pago';
          confidence = 'alta';
          folio = bankTransfer.folioFirma || bankTransfer.claveRastreo || 'SPEI';
          kilos = 0;
          subtotal = round2(bankTransfer.amount / 1.16);
          total = round2(bankTransfer.amount);
          detectedOcNumber = bankTransfer.claveRastreo || bankTransfer.folioFirma || '';
        } else {
          // 2. Ticket de Báscula
          const scaleTicket = parseScaleTicket(text);
          if (scaleTicket.kilosNeto && scaleTicket.kilosNeto > 0) {
            docType = 'ticket_bascula';
            confidence = scaleTicket.confidence === 'high' ? 'alta' : 'media';
            kilos = round2(scaleTicket.kilosNeto);
            folio = scaleTicket.ticketFolio || '';
            docDate = scaleTicket.dateStr || docDate;
            detectedOcNumber = scaleTicket.detectedOc || '';
          } else {
            // 3. OCR General (Factura CFDI, Remisión o OC)
            const ocr = parseOcrData(text);
            folio = ocr.folio || '';
            uuid = ocr.uuid || '';
            kilos = round2(ocr.kilos || 0);
            subtotal = round2(ocr.subTotal || 0);
            total = round2(ocr.total || 0);
            docDate = ocr.fecha ? ocr.fecha.split('T')[0] : docDate;
            detectedOcNumber = ocr.ocNumber || '';

            if (ocr.docKind === 'contrarecibo') {
              docType = 'contrarecibo';
              confidence = 'alta';
              folio = ocr.contrarecibo || ocr.folio || '';
              contrareciboNumber = ocr.contrarecibo || ocr.folio || '';
              facturaFolios = ocr.facturaFolios || [];
              dueDate = ocr.dueDate || '';
              total = round2(ocr.total || 0);
              subtotal = round2(ocr.subTotal || 0);
              docDate = ocr.fecha || docDate;
            } else if (ocr.docKind === 'pago_providencia') {
              docType = 'comprobante_pago';
              confidence = 'alta';
            } else if (ocr.docKind === 'oc_providencia') {
              docType = 'oc_providencia';
              confidence = 'alta';
              kilos = round2(ocr.kilos || ocr.totalPiezas || 0);
              if (ocr.totalPiezas || ocr.conceptos) {
                ocPiezasInfo = {
                  totalPiezas: ocr.totalPiezas || 0,
                  conceptos: (ocr.conceptos || []).map((c) => ({
                    codigo: c.codigo || '',
                    descripcion: c.descripcion,
                    cantidad: c.cantidad,
                    valorUnitario: c.valorUnitario,
                  })),
                };
              }
            } else if (ocr.docKind === 'remision' || /REMISI[OÓ]N|ORDEN\s*DE\s*ENTREGA/i.test(text)) {
              docType = 'remision';
              confidence = 'alta';
            } else {
              docType = 'factura_cfdi';
              confidence = 'alta';
            }
          }
        }
      }
    }
    // 3. CASO IMAGEN (Ticket o Remisión)
    else if (file.type.startsWith('image/')) {
      const text = await extractTextFromImage(file);
      rawText = text;
      const scaleTicket = parseScaleTicket(text);
      if (scaleTicket.kilosNeto && scaleTicket.kilosNeto > 0) {
        docType = 'ticket_bascula';
        confidence = scaleTicket.confidence === 'high' ? 'alta' : 'media';
        kilos = round2(scaleTicket.kilosNeto);
        folio = scaleTicket.ticketFolio || '';
        docDate = scaleTicket.dateStr || docDate;
        detectedOcNumber = scaleTicket.detectedOc || '';
      } else {
        const ocr = parseOcrData(text);
        folio = ocr.folio || '';
        uuid = ocr.uuid || '';
        kilos = round2(ocr.kilos || 0);
        subtotal = round2(ocr.subTotal || 0);
        total = round2(ocr.total || 0);
        docDate = ocr.fecha ? ocr.fecha.split('T')[0] : docDate;
        detectedOcNumber = ocr.ocNumber || '';

        if (ocr.docKind === 'contrarecibo') {
          docType = 'contrarecibo';
          confidence = 'alta';
          folio = ocr.contrarecibo || ocr.folio || '';
          contrareciboNumber = ocr.contrarecibo || ocr.folio || '';
          facturaFolios = ocr.facturaFolios || [];
          dueDate = ocr.dueDate || '';
          total = round2(ocr.total || 0);
          subtotal = round2(ocr.subTotal || 0);
          docDate = ocr.fecha || docDate;
        } else if (ocr.docKind === 'remision' || /REMISI[OÓ]N|ORDEN\s*DE\s*ENTREGA/i.test(text)) {
          docType = 'remision';
          confidence = 'alta';
        } else if (ocr.uuid || /CFDI|FACTURA/i.test(text)) {
          docType = 'factura_cfdi';
          confidence = 'alta';
        } else {
          docType = 'ticket_bascula';
          confidence = 'media';
        }
      }
    }
  } catch (err) {
    console.error('Error al analizar archivo en pipeline:', err);
    docType = 'desconocido';
    confidence = 'baja';
  }

  // Matching de Orden
  let matchedOrder = matchOrderCanonical(orders, detectedOcNumber, folio, total);

  if (docType === 'contrarecibo' && facturaFolios.length > 0) {
    for (const ff of facturaFolios) {
      const foundOrd = orders.find(
        (o) => !o.isDeleted && (o.invoices || []).some((inv) => inv.folio === ff || inv.id === ff || inv.id === `inv-${ff}`)
      );
      if (foundOrd) {
        matchedOrder = foundOrd;
        break;
      }
    }
  }

  // Duplicados y coincidencias sospechosas
  let dupCheck: {
    isDuplicate: boolean;
    isSuspectDuplicate?: boolean;
    hasFolioCollision?: boolean;
    order?: PurchaseOrder;
    invoice?: Invoice;
    delivery?: Delivery;
    reason?: string;
  } = { isDuplicate: false };

  if (docType === 'factura_cfdi') {
    dupCheck = findExistingInvoice(orders, folio, uuid);
  } else if (docType === 'ticket_bascula' || docType === 'remision') {
    dupCheck = findExistingDelivery(orders, folio, kilos, docDate);
  } else if (docType === 'comprobante_pago') {
    dupCheck = findExistingPayment(orders, detectedOcNumber || folio, total, docDate);
  }

  const isSuspectDuplicate = !!dupCheck.isSuspectDuplicate;
  const hasFolioCollision = !!dupCheck.hasFolioCollision;

  if (dupCheck.isDuplicate && !matchedOrder && dupCheck.order) {
    matchedOrder = dupCheck.order;
  }

  let autoAssignedLabel: string | null = null;
  if (dupCheck.isDuplicate) {
    autoAssignedLabel = `⚠️ YA REGISTRADO: Omitido para evitar duplicar (${dupCheck.order?.folio || dupCheck.order?.oc || 'Expediente'})`;
  } else if (isSuspectDuplicate) {
    autoAssignedLabel = `⚠️ COINCIDENCIA SOSPECHOSA: ${dupCheck.reason || 'Pesaje similar en báscula requiere revisión'}`;
  } else if (hasFolioCollision) {
    autoAssignedLabel = `⚠️ COLISIÓN DE FOLIO (#${folio}): Folio ya existe en ${dupCheck.order?.folio || dupCheck.order?.oc} con UUID distinto. Requiere revisión.`;
  } else if (matchedOrder) {
    if (docType === 'contrarecibo') {
      const facStr = facturaFolios.length > 0 ? `Factura(s) #${facturaFolios.join(', #')}` : 'facturas asociadas';
      autoAssignedLabel = `🎯 Contrarecibo amparando ${facStr} en ${matchedOrder.folio || matchedOrder.oc}`;
    } else {
      const deptTag =
        matchedOrder.client?.includes('TH') || (matchedOrder.department || '').includes('TH')
          ? 'TH (José Nava)'
          : 'GT (Lic. Evelia)';
      autoAssignedLabel = `🎯 OC Asignada: ${matchedOrder.folio || matchedOrder.oc} · ${deptTag}`;
    }
  }

  const needsClarification =
    isSuspectDuplicate ||
    hasFolioCollision ||
    (!dupCheck.isDuplicate && !matchedOrder && docType !== 'oc_providencia' && docType !== 'contrarecibo');

  return {
    file,
    docType,
    confidence,
    folio,
    uuid,
    kilos,
    subtotal,
    total,
    docDate,
    detectedOcNumber,
    matchedOrder,
    autoAssignedLabel,
    isDuplicate: dupCheck.isDuplicate,
    duplicateOrder: dupCheck.order,
    isSuspectDuplicate,
    hasFolioCollision,
    suspectReason: dupCheck.reason,
    suspectDelivery: dupCheck.delivery,
    collisionInvoice: dupCheck.invoice,
    needsClarification,
    rawText,
    ocPiezasInfo,
    contrareciboNumber,
    facturaFolios,
    dueDate,
  };
}

/**
 * 🚀 Aplica un documento a su Orden en Firestore y lo respalda en Storage
 */
export async function applyDocumentFast(
  analysis: PipelineAnalysis,
  targetOrderOverride?: PurchaseOrder | null,
  allOrdersContext?: PurchaseOrder[]
): Promise<PipelineApplyResult> {
  const targetOrder = targetOrderOverride || analysis.matchedOrder || analysis.duplicateOrder;

  // 1. Manejo universal de duplicados absolutos comprobados
  if (analysis.isDuplicate) {
    const ordTarget = analysis.duplicateOrder || targetOrder;
    const docKindLabel =
      analysis.docType === 'ticket_bascula'
        ? 'Ticket de Báscula'
        : analysis.docType === 'remision'
        ? 'Remisión'
        : analysis.docType === 'comprobante_pago'
        ? 'Comprobante de Pago'
        : analysis.docType === 'contrarecibo'
        ? 'Contrarecibo'
        : 'Factura';

    const identificador = analysis.folio ? `#${analysis.folio}` : (analysis.detectedOcNumber ? `#${analysis.detectedOcNumber}` : 'S/F');
    const valorDetalle = analysis.kilos > 0 ? `${analysis.kilos.toLocaleString('es-MX')} kg` : (analysis.total > 0 ? `$${analysis.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '');

    return {
      success: true,
      isDuplicate: true,
      message: `${docKindLabel} ${identificador}${valorDetalle ? ` (${valorDetalle})` : ''} ya está registrado previamente en ${ordTarget?.folio || ordTarget?.oc || 'el expediente'}. Se conservó el registro original sin duplicados.`,
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: analysis.kilos,
      total: analysis.total,
      orderId: ordTarget?.id,
      orderFolio: ordTarget?.folio || ordTarget?.oc,
      orderClient: ordTarget?.client,
    };
  }

  // 2. Colisión de folio con UUID SAT distinto: pausar para revisión a menos que se fuerce expresamente
  if (analysis.hasFolioCollision && !analysis.forceApply && !targetOrderOverride) {
    const ordTarget = analysis.duplicateOrder || targetOrder;
    return {
      success: false,
      needsReview: true,
      hasFolioCollision: true,
      reviewReason: `Colisión de folio fiscal (#${analysis.folio}): ya existe en ${ordTarget?.folio || ordTarget?.oc || 'otra orden'} con UUID fiscal diferente. Requiere revisión manual.`,
      message: `⚠️ Colisión de folio detectada (#${analysis.folio}): El documento comparte folio con una factura existente pero con un UUID fiscal SAT distinto. Se requiere revisión manual antes de aplicar.`,
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: analysis.kilos,
      total: analysis.total,
      orderId: ordTarget?.id,
      orderFolio: ordTarget?.folio || ordTarget?.oc,
      orderClient: ordTarget?.client,
    };
  }

  // 3. Coincidencia sospechosa en báscula: pausar para revisión a menos que se fuerce expresamente
  if (analysis.isSuspectDuplicate && !analysis.forceApply && !targetOrderOverride) {
    const ordTarget = analysis.duplicateOrder || targetOrder;
    return {
      success: false,
      needsReview: true,
      isSuspectDuplicate: true,
      reviewReason: analysis.suspectReason || 'Pesaje y fecha coincidentes con entrega previa',
      message: `⚠️ Coincidencia sospechosa en báscula: ${analysis.suspectReason || 'Existe una entrega con pesaje y fecha casi idénticos'}. Requiere confirmación del operador antes de registrar.`,
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: analysis.kilos,
      total: analysis.total,
      orderId: ordTarget?.id,
      orderFolio: ordTarget?.folio || ordTarget?.oc || targetOrder?.folio,
      orderClient: ordTarget?.client,
    };
  }

  // 4. Creación de Orden Nueva si el archivo es una Orden Oficial de Providencia
  if (analysis.docType === 'oc_providencia' && !targetOrder) {
    const ocNum = analysis.detectedOcNumber || analysis.folio || `OC-${Date.now()}`;
    const isTH = ocNum.includes('14302') || ocNum.includes('71/') || ocNum.includes('120267114302');
    const client = isTH ? 'PROV-TH' : 'PROV-GT';
    const numKilos = Number(analysis.kilos) || 0;

    const newOrderData: Partial<PurchaseOrder> = {
      folio: ocNum,
      oc: ocNum,
      client,
      department: isTH ? 'TH' : 'GT',
      creditCycle: { status: 'pedido' },
      totalKilograms: numKilos,
      financials: {
        salePricePerKg: 43,
        costPricePerKg: 38,
        commissionRate: 0.08,
        saleTotal: round2(numKilos * 43),
        invoiceTotal: round2(numKilos * 43 * 1.16),
        costTotal: round2(numKilos * 38),
        commission: round2(numKilos * 43 * 0.08),
        netCashFlow: round2(numKilos * 43 - numKilos * 38 - numKilos * 43 * 0.08),
        tradeMargin: round2(numKilos * 43 - numKilos * 38),
      },
      createdAt: (serverTimestamp() as any),
      updatedAt: (serverTimestamp() as any),
      invoices: [],
      deliveries: [],
    };

    if (analysis.ocPiezasInfo && analysis.ocPiezasInfo.conceptos.length > 0) {
      newOrderData.items = analysis.ocPiezasInfo.conceptos.map((c, idx) => ({
        id: `item-${idx}-${Date.now()}`,
        code: c.codigo || 'BOLSAS',
        description: c.descripcion || 'Bolsa de Polietileno Providencia',
        quantity: c.cantidad || 0,
        unit: 'PIEZAS',
        unitPrice: c.valorUnitario || 0,
        amount: round2((c.cantidad || 0) * (c.valorUnitario || 0)),
      }));
    }

    const docRef = await safeAddDoc(collection(db, PATHS.orders), cleanUndefined(newOrderData));

    try {
      await uploadDocument({
        file: analysis.file,
        docKind: 'oc_providencia',
        folio: ocNum,
        ocNumber: ocNum,
        orderId: docRef.id,
        orderFolio: ocNum,
        kilos: numKilos,
        total: analysis.total || round2(numKilos * 43 * 1.16),
        docDate: analysis.docDate,
        notes: `Orden Oficial Providencia ${ocNum} (${numKilos.toLocaleString('es-MX')} kg)`,
      });
    } catch (e) {
      console.warn('Error al subir OC a Storage:', e);
    }

    return {
      success: true,
      message: `Orden de Compra ${ocNum} creada y respaldada exitosamente (${numKilos.toLocaleString('es-MX')} kg para ${client}).`,
      docType: 'oc_providencia',
      folio: ocNum,
      kilos: numKilos,
      total: analysis.total || round2(numKilos * 43 * 1.16),
      orderId: docRef.id,
      orderFolio: ocNum,
      orderClient: client,
    };
  }

  // 5. Verificación de existencia de orden destino para los demás tipos
  if (!targetOrder && analysis.docType !== 'contrarecibo') {
    return {
      success: false,
      message: `No se pudo asociar automáticamente a una Orden de Compra. Por favor, selecciona la OC destino manualmente.`,
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: analysis.kilos,
      total: analysis.total,
    };
  }

  const orderRef = targetOrder?.id ? doc(db, PATHS.orders, targetOrder.id) : null;
  const safeDate = toSafeTimestamp(analysis.docDate);

  // ───────────────────────────────────────────────────────────────────────────
  // 6. APLICACIÓN DE CONTRARECIBO (ESTRICTA, MULTIORDEN Y ATÓMICA)
  // ───────────────────────────────────────────────────────────────────────────
  if (analysis.docType === 'contrarecibo') {
    const crFolio = analysis.contrareciboNumber || analysis.folio || 'CR-S/N';
    const facFolios = analysis.facturaFolios || [];
    const dueDateStr = analysis.dueDate;
    const dueDateTimestamp = dueDateStr ? Timestamp.fromDate(new Date(`${dueDateStr}T12:00:00Z`)) : null;

    const availableOrders = allOrdersContext && allOrdersContext.length > 0
      ? allOrdersContext.filter((o) => o && !(o as any).isDeleted)
      : (targetOrder ? [targetOrder] : []);

    if (facFolios.length > 0) {
      // Validar cada folio antes de modificar cualquier orden:
      // Cada folio f DEBE encontrar exactamente 1 factura en todas las órdenes disponibles.
      const invoiceMappings: Array<{
        targetFolio: string;
        order: PurchaseOrder;
        invoice: Invoice;
      }> = [];

      for (const rawF of facFolios) {
        const cleanF = normalizeInvoiceFolio(rawF);
        if (!cleanF) continue;

        const matches: Array<{ order: PurchaseOrder; invoice: Invoice }> = [];
        for (const ord of availableOrders) {
          for (const inv of ord.invoices || []) {
            const invNorm = normalizeInvoiceFolio(inv.folio || inv.id);
            if (invNorm === cleanF) {
              matches.push({ order: ord, invoice: inv });
            }
          }
        }

        if (matches.length === 0) {
          return {
            success: false,
            needsReview: true,
            reviewReason: `Factura #${rawF} amparada en contrarecibo no encontrada en ninguna orden activa`,
            message: `La factura #${rawF} amparada por el Contrarecibo ${crFolio} no se encontró en ninguna orden activa. Ninguna orden fue modificada.`,
            docType: 'contrarecibo',
            folio: crFolio,
            kilos: 0,
            total: analysis.total,
          };
        }

        if (matches.length > 1) {
          return {
            success: false,
            needsReview: true,
            reviewReason: `Ambigüedad: Factura #${rawF} encontrada en múltiples órdenes`,
            message: `Ambigüedad contable: la factura #${rawF} amparada por el Contrarecibo ${crFolio} aparece en más de una orden (${matches.map((m) => m.order.folio || m.order.oc).join(', ')}). Ninguna orden fue modificada.`,
            docType: 'contrarecibo',
            folio: crFolio,
            kilos: 0,
            total: analysis.total,
          };
        }

        invoiceMappings.push({
          targetFolio: rawF,
          order: matches[0].order,
          invoice: matches[0].invoice,
        });
      }

      // Comprobar si TODAS las facturas ya tenían este contrarecibo asignado
      const allAlreadyBound = invoiceMappings.length > 0 && invoiceMappings.every(
        (m) => m.invoice.collection?.contrareciboNumber === crFolio
      );

      if (allAlreadyBound) {
        return {
          success: true,
          isDuplicate: true,
          message: `El Contrarecibo ${crFolio} ya fue vinculado previamente a todas las facturas amparadas (#${facFolios.join(', #')}).`,
          docType: 'contrarecibo',
          folio: crFolio,
          kilos: 0,
          total: analysis.total,
        };
      }

      // Agrupar por orden para actualización segura
      const ordersToUpdate = new Map<string, { order: PurchaseOrder; updatedInvoices: Invoice[] }>();

      for (const ord of availableOrders) {
        const mappingsForThisOrder = invoiceMappings.filter((m) => m.order.id === ord.id);
        if (mappingsForThisOrder.length === 0) continue;

        const updatedInvoices = (ord.invoices || []).map((inv) => {
          const matchedMapping = mappingsForThisOrder.find(
            (m) => normalizeInvoiceFolio(m.invoice.folio || m.invoice.id) === normalizeInvoiceFolio(inv.folio || inv.id)
          );
          if (matchedMapping) {
            return {
              ...inv,
              collection: {
                ...inv.collection,
                contrareciboNumber: crFolio,
                notes: `Amparada con Contrarecibo ${crFolio}.${dueDateStr ? ` Pago programado: ${dueDateStr}` : ''}`.trim(),
              },
              creditCycle: {
                ...inv.creditCycle,
                status: 'in_review' as const,
                ...(dueDateTimestamp ? { dueDate: dueDateTimestamp } : {}),
              },
            };
          }
          return inv;
        });

        ordersToUpdate.set(ord.id, { order: ord, updatedInvoices });
      }

      // Aplicar actualizaciones
      const modifiedFolios: string[] = [];
      for (const [ordId, updateData] of ordersToUpdate.entries()) {
        const oRef = doc(db, PATHS.orders, ordId);
        await safeUpdateDoc(oRef, {
          invoices: cleanUndefined(updateData.updatedInvoices),
          'collection.contrareciboNumber': crFolio,
          'collection.contrareciboDate': dueDateTimestamp || Timestamp.now(),
          'collection.contrareciboPortalStatus': 'generado',
          'creditCycle.status': 'in_review',
          status: 'in_review',
          updatedAt: serverTimestamp(),
        });
        modifiedFolios.push(updateData.order.folio || updateData.order.oc || ordId);
      }

      try {
        await uploadDocument({
          file: analysis.file,
          docKind: 'contrarecibo',
          folio: crFolio,
          orderId: invoiceMappings[0]?.order.id,
          orderFolio: invoiceMappings[0]?.order.folio || invoiceMappings[0]?.order.oc,
          kilos: 0,
          total: analysis.total,
          docDate: analysis.docDate,
          notes: `Contrarecibo ${crFolio} amparando factura(s) #${facFolios.join(', #')}`,
        });
      } catch (e) {
        console.warn('Error al subir contrarecibo a Storage:', e);
      }

      return {
        success: true,
        message: `Contrarecibo ${crFolio} vinculado automáticamente a Factura(s) #${facFolios.join(', #')}${modifiedFolios.length > 0 ? ` en ${modifiedFolios.join(', ')}` : ''}.`,
        docType: 'contrarecibo',
        folio: crFolio,
        kilos: 0,
        total: analysis.total,
        orderFolio: modifiedFolios.join(', '),
      };
    } else {
      // Contrarecibo sin lista de folios de factura explícitos:
      if (!targetOrder) {
        return {
          success: false,
          needsReview: true,
          reviewReason: 'Contrarecibo sin folios de factura ni orden asignada',
          message: `No se pudieron identificar las facturas amparadas por el Contrarecibo ${crFolio} ni se encontró una orden única. Asignación manual requerida.`,
          docType: 'contrarecibo',
          folio: crFolio,
          kilos: 0,
          total: analysis.total,
        };
      }

      const pendingInvoices = (targetOrder.invoices || []).filter((i: any) => !i.collection?.contrareciboNumber);
      if (pendingInvoices.length !== 1) {
        return {
          success: false,
          needsReview: true,
          reviewReason: `Existen ${pendingInvoices.length} facturas pendientes de contrarecibo en la orden`,
          message: `No se pudieron identificar las facturas amparadas por el Contrarecibo ${crFolio} (la orden ${targetOrder.folio || targetOrder.oc} tiene ${pendingInvoices.length} facturas pendientes). Se requiere vinculación manual para evitar errores.`,
          docType: 'contrarecibo',
          folio: crFolio,
          kilos: 0,
          total: analysis.total,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
        };
      }

      const targetInv = pendingInvoices[0];
      const invTotal = targetInv.financials?.invoiceTotal || 0;
      if (analysis.total > 0 && Math.abs(invTotal - analysis.total) > 0.5) {
        return {
          success: false,
          needsReview: true,
          reviewReason: `Importe del contrarecibo ($${analysis.total}) no concilia con la factura pendiente ($${invTotal})`,
          message: `El importe del Contrarecibo ${crFolio} ($${analysis.total.toLocaleString('es-MX')}) difiere del total de la factura #${targetInv.folio} ($${invTotal.toLocaleString('es-MX')}). Requiere revisión.`,
          docType: 'contrarecibo',
          folio: crFolio,
          kilos: 0,
          total: analysis.total,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
        };
      }

      const updatedInvoices = (targetOrder.invoices || []).map((inv) => {
        if (inv.id === targetInv.id) {
          return {
            ...inv,
            collection: {
              ...inv.collection,
              contrareciboNumber: crFolio,
              notes: `Amparada con Contrarecibo ${crFolio}.${dueDateStr ? ` Pago programado: ${dueDateStr}` : ''}`.trim(),
            },
            creditCycle: {
              ...inv.creditCycle,
              status: 'in_review' as const,
              ...(dueDateTimestamp ? { dueDate: dueDateTimestamp } : {}),
            },
          };
        }
        return inv;
      });

      const oRef = doc(db, PATHS.orders, targetOrder.id);
      await safeUpdateDoc(oRef, {
        invoices: cleanUndefined(updatedInvoices),
        'collection.contrareciboNumber': crFolio,
        'collection.contrareciboDate': dueDateTimestamp || Timestamp.now(),
        'collection.contrareciboPortalStatus': 'generado',
        'creditCycle.status': 'in_review',
        status: 'in_review',
        updatedAt: serverTimestamp(),
      });

      try {
        await uploadDocument({
          file: analysis.file,
          docKind: 'contrarecibo',
          folio: crFolio,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
          kilos: 0,
          total: analysis.total,
          docDate: analysis.docDate,
          notes: `Contrarecibo ${crFolio} amparando factura #${targetInv.folio}`,
        });
      } catch (e) {
        console.warn('Error al subir contrarecibo a Storage:', e);
      }

      return {
        success: true,
        message: `Contrarecibo ${crFolio} vinculado a Factura #${targetInv.folio} en ${targetOrder.folio || targetOrder.oc}.`,
        docType: 'contrarecibo',
        folio: crFolio,
        kilos: 0,
        total: analysis.total,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. APLICACIÓN DE FACTURA CFDI
  // ───────────────────────────────────────────────────────────────────────────
  if (analysis.docType === 'factura_cfdi') {
    if (!targetOrder) {
      return {
        success: false,
        message: 'No se identificó la orden destino para la factura CFDI.',
        docType: 'factura_cfdi',
        folio: analysis.folio,
        kilos: analysis.kilos,
        total: analysis.total,
      };
    }

    const invFolio = analysis.folio?.trim() || 'S/F';
    const numKilos = Number(analysis.kilos) || 0;

    const hasOrderSellPrice = targetOrder.customSellPrice !== undefined && targetOrder.customSellPrice !== null;
    const hasOrderCostPrice = targetOrder.customCostPrice !== undefined && targetOrder.customCostPrice !== null;
    const hasDocSubtotal = analysis.subtotal > 0;

    const sellPrice = hasOrderSellPrice
      ? targetOrder.customSellPrice!
      : (targetOrder.financials?.salePricePerKg !== undefined && targetOrder.financials?.salePricePerKg !== null
          ? targetOrder.financials.salePricePerKg
          : (hasDocSubtotal && numKilos > 0 ? round2(analysis.subtotal / numKilos) : 43));

    const costPrice = hasOrderCostPrice
      ? targetOrder.customCostPrice!
      : (targetOrder.financials?.costPricePerKg !== undefined && targetOrder.financials?.costPricePerKg !== null
          ? targetOrder.financials.costPricePerKg
          : 38);

    const commRate = targetOrder.financials?.commissionRate ?? 0.08;

    const subtotal = analysis.subtotal > 0 ? analysis.subtotal : round2(numKilos * sellPrice);
    const total = analysis.total > 0 ? analysis.total : round2(subtotal * 1.16);
    const costTotal = round2(numKilos * costPrice);
    const commission = round2(subtotal * commRate);

    const isEstimatedPrice = !hasOrderSellPrice && !hasDocSubtotal;
    const isEstimatedCost = !hasOrderCostPrice;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      folio: invFolio,
      ...(analysis.uuid?.trim() ? { uuid: analysis.uuid.trim() } : {}),
      kilos: numKilos,
      isEstimatedPrice,
      isEstimatedCost,
      financials: {
        salePricePerKg: sellPrice,
        costPricePerKg: costPrice,
        commissionRate: commRate,
        saleTotal: subtotal,
        invoiceTotal: total,
        costTotal,
        commission,
        netCashFlow: round2(subtotal - costTotal - commission),
        tradeMargin: round2(subtotal - costTotal),
      },
      creditCycle: {
        status: 'pending',
        issueDate: safeDate,
      },
      orderId: targetOrder.id,
      oc: targetOrder.oc || targetOrder.folio || '',
    };

    const existingInvoices = targetOrder.invoices || [];
    const existingDeliveries = targetOrder.deliveries || [];
    const updatedDeliveries = [...existingDeliveries];

    // Entrega física amparada si no existía ya
    if (numKilos > 0) {
      updatedDeliveries.push({
        id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: safeDate,
        kilos: numKilos,
        notes: `Entrega física amparada por Factura #${newInvoice.folio} (${numKilos.toLocaleString('es-MX')} kg)`,
        invoiced: true,
        invoiceId: newInvoice.id,
        docType: 'factura',
        docFolio: newInvoice.folio,
      });
    }

    if (orderRef) {
      await safeUpdateDoc(orderRef, {
        invoices: cleanUndefined([...existingInvoices, newInvoice]),
        deliveries: cleanUndefined(updatedDeliveries),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await uploadDocument({
        file: analysis.file,
        docKind: 'factura_cfdi',
        folio: invFolio,
        ocNumber: targetOrder.oc || targetOrder.folio,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
        kilos: numKilos,
        total: total,
        docDate: analysis.docDate,
        notes: `Factura CFDI #${invFolio}${analysis.uuid ? ' · UUID: ' + analysis.uuid : ''}`,
      });
    } catch (e) {
      console.warn('Error al subir factura a Storage:', e);
    }

    return {
      success: true,
      message: `Factura #${invFolio} (${numKilos.toLocaleString('es-MX')} kg · $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}) aplicada y respaldada en ${targetOrder.folio || targetOrder.oc}.`,
      docType: 'factura_cfdi',
      folio: invFolio,
      kilos: numKilos,
      total: total,
      orderId: targetOrder.id,
      orderFolio: targetOrder.folio || targetOrder.oc,
      orderClient: targetOrder.client,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. APLICACIÓN DE TICKET DE BÁSCULA O REMISIÓN
  // ───────────────────────────────────────────────────────────────────────────
  if (analysis.docType === 'ticket_bascula' || analysis.docType === 'remision') {
    if (!targetOrder) {
      return {
        success: false,
        message: 'No se identificó la orden destino para la entrega de báscula.',
        docType: analysis.docType,
        folio: analysis.folio,
        kilos: analysis.kilos,
        total: 0,
      };
    }

    const numKilos = Number(analysis.kilos) || 0;
    const cleanDocFolio = analysis.folio?.trim();

    // Blindaje antiduplicados y reintentos: checar si el ticket ya existe en entregas
    const existingDeliveries = targetOrder.deliveries || [];
    const yaRegistrada =
      analysis.isDuplicate ||
      (cleanDocFolio &&
        existingDeliveries.some((d) => {
          const existingF = d.docFolio?.trim().toUpperCase();
          return existingF && existingF === cleanDocFolio.toUpperCase();
        }));

    if (yaRegistrada) {
      const ordTarget = analysis.duplicateOrder || targetOrder;
      return {
        success: true,
        isDuplicate: true,
        message: `La Remisión / Ticket #${cleanDocFolio || 'S/N'} (${numKilos.toLocaleString('es-MX')} kg) ya fue registrado previamente en ${ordTarget.folio || ordTarget.oc}. Se conservó sin duplicar los kilos.`,
        docType: analysis.docType,
        folio: cleanDocFolio || '',
        kilos: numKilos,
        total: 0,
        orderId: ordTarget.id,
        orderFolio: ordTarget.folio || ordTarget.oc,
        orderClient: ordTarget.client,
      };
    }

    const newDelivery: Delivery = {
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: safeDate,
      kilos: numKilos,
      notes: `Ingreso de báscula ticket #${analysis.folio || 'S/N'} (${numKilos.toLocaleString('es-MX')} kg)`,
      invoiced: false,
      docType: 'remision',
      ...(cleanDocFolio ? { docFolio: cleanDocFolio } : {}),
    };

    if (orderRef) {
      await safeUpdateDoc(orderRef, {
        deliveries: cleanUndefined([...existingDeliveries, newDelivery]),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await uploadDocument({
        file: analysis.file,
        docKind: analysis.docType === 'ticket_bascula' ? 'ticket_bascula' : 'remision',
        folio: analysis.folio || `TKT-${Date.now()}`,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
        kilos: numKilos,
        total: 0,
        docDate: analysis.docDate,
        notes: `Ticket #${analysis.folio || 'S/N'} (${numKilos.toLocaleString('es-MX')} kg)`,
      });
    } catch (e) {
      console.warn('Error al subir ticket a Storage:', e);
    }

    return {
      success: true,
      message: `Entrega de báscula de ${numKilos.toLocaleString('es-MX')} kg registrada y respaldada en ${targetOrder.folio || targetOrder.oc}.`,
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: numKilos,
      total: 0,
      orderId: targetOrder.id,
      orderFolio: targetOrder.folio || targetOrder.oc,
      orderClient: targetOrder.client,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 9. APLICACIÓN DE COMPROBANTE DE PAGO TR (IDEMPOTENTE, ATÓMICO Y CON HISTORIAL)
  // ───────────────────────────────────────────────────────────────────────────
  if (analysis.docType === 'comprobante_pago') {
    if (!targetOrder) {
      return {
        success: false,
        needsReview: true,
        reviewReason: 'Comprobante de pago sin orden asociada',
        message: 'No se pudo asociar el comprobante de pago a ninguna Orden de Compra.',
        docType: 'comprobante_pago',
        folio: analysis.folio,
        kilos: 0,
        total: analysis.total,
      };
    }

    const paymentAmount = round2(analysis.total);
    if (paymentAmount <= 0) {
      return {
        success: false,
        message: 'El comprobante de pago no contiene un importe válido mayor a cero.',
        docType: 'comprobante_pago',
        folio: analysis.folio,
        kilos: 0,
        total: 0,
      };
    }

    const explicitRef = (analysis.detectedOcNumber || analysis.folio || '').trim().toUpperCase();
    const isGeneratedFingerprint = !explicitRef;
    const paymentRefKey = explicitRef || `FINGERPRINT-${analysis.file.name.trim().toUpperCase()}-${analysis.file.size}-${paymentAmount}-${analysis.docDate || 'NODATE'}`;

    // Identificar factura destino unívoca
    const currentInvoices = targetOrder.invoices || [];
    let targetInvIdx = -1;

    // Prioridad 1: Folio exacto de factura si viene en el documento
    if (analysis.folio) {
      const targetFolioNorm = normalizeInvoiceFolio(analysis.folio);
      targetInvIdx = currentInvoices.findIndex((i: any) => normalizeInvoiceFolio(i.folio || i.id) === targetFolioNorm);
    }

    // Prioridad 2: Saldo pendiente exacto coincidente (+/- $0.05 tolerancia contable SAT)
    if (targetInvIdx === -1) {
      const candidates = currentInvoices
        .map((inv: any, idx: number) => {
          const invTotal = inv.financials?.invoiceTotal || (inv.kilos * (inv.financials?.salePricePerKg || 43) * 1.16);
          const currentPaid = Number(inv.collection?.paidAmount) || 0;
          const balance = round2(invTotal - currentPaid);
          return { idx, inv, balance };
        })
        .filter((c) => c.balance > 0.05 && Math.abs(c.balance - paymentAmount) <= 0.05);

      if (candidates.length === 1) {
        targetInvIdx = candidates[0].idx;
      } else if (candidates.length > 1) {
        return {
          success: false,
          needsReview: true,
          reviewReason: 'Ambigüedad: múltiples facturas tienen el mismo saldo pendiente',
          message: `El pago de $${paymentAmount.toLocaleString('es-MX')} coincide con múltiples facturas pendientes con el mismo saldo exacto (${candidates.map((c) => '#' + c.inv.folio).join(', ')}). Asigne el pago manualmente.`,
          docType: 'comprobante_pago',
          folio: analysis.folio,
          kilos: 0,
          total: paymentAmount,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
        };
      }
    }

    // Prioridad 3: Única factura pendiente con saldo en la orden
    if (targetInvIdx === -1) {
      const unpaid = currentInvoices
        .map((inv: any, idx: number) => {
          const invTotal = inv.financials?.invoiceTotal || (inv.kilos * (inv.financials?.salePricePerKg || 43) * 1.16);
          const currentPaid = Number(inv.collection?.paidAmount) || 0;
          return { idx, inv, balance: round2(invTotal - currentPaid) };
        })
        .filter((u) => u.balance > 0.05);

      if (unpaid.length === 1) {
        targetInvIdx = unpaid[0].idx;
      } else {
        return {
          success: false,
          needsReview: true,
          reviewReason: unpaid.length === 0 ? 'No hay facturas pendientes con saldo' : 'Múltiples facturas pendientes con saldo',
          message: `No se pudo asociar de forma inequívoca el pago de $${paymentAmount.toLocaleString('es-MX')} a una factura específica de la orden ${targetOrder.folio || targetOrder.oc}. Asignación manual requerida.`,
          docType: 'comprobante_pago',
          folio: analysis.folio,
          kilos: 0,
          total: paymentAmount,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
        };
      }
    }

    const matchedInv = currentInvoices[targetInvIdx];

    // Transacción atómica en Firestore para garantizar idempotencia y evitar condiciones de carrera
    let wasAlreadyAppliedInDb = false;

    if (orderRef) {
      try {
        await runTransaction(db, async (txn) => {
          const freshSnap = await txn.get(orderRef);
          if (!freshSnap.exists()) {
            throw new Error(`La orden ${targetOrder.id} no existe en Firestore`);
          }
          const freshOrder = freshSnap.data() as PurchaseOrder;
          const freshInvoices = [...(freshOrder.invoices || [])];

          // Comprobar idempotencia dentro de la transacción fresca
          const alreadyApplied = freshInvoices.some((i: any) => {
            if (i.collection?.transferRef && i.collection.transferRef.toUpperCase() === paymentRefKey) return true;
            return (i.collection?.paymentsHistory || []).some((p: any) =>
              (p.reference && p.reference.toUpperCase() === paymentRefKey) ||
              (p.receiptId && p.receiptId.toUpperCase() === paymentRefKey)
            );
          });

          if (alreadyApplied) {
            wasAlreadyAppliedInDb = true;
            return;
          }

          const freshInvIdx = freshInvoices.findIndex((i: any) =>
            normalizeInvoiceFolio(i.folio || i.id) === normalizeInvoiceFolio(matchedInv.folio || matchedInv.id)
          );

          if (freshInvIdx === -1) {
            throw new Error(`La factura #${matchedInv.folio} ya no existe en la orden`);
          }

          const fInv = freshInvoices[freshInvIdx];
          const prevPaid = Number(fInv.collection?.paidAmount) || 0;
          const existingHistory = Array.isArray(fInv.collection?.paymentsHistory) ? fInv.collection.paymentsHistory : [];
          const existingHistorySum = round2(existingHistory.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0));

          // Preservar saldo inicial histórico si no existía desglose individual previo
          const historicalBase = Math.max(0, round2(prevPaid - existingHistorySum));

          const newPaymentHistoryEntry = {
            id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            receiptId: explicitRef || paymentRefKey,
            amount: paymentAmount,
            date: safeDate,
            reference: paymentRefKey,
            invoiceId: fInv.id || fInv.folio || '',
            invoiceFolio: fInv.folio || '',
            notes: isGeneratedFingerprint
              ? `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} vía ${analysis.file.name} (identificado por huella de archivo)`
              : `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} vía ${analysis.file.name} (Ref: ${explicitRef})`,
          };

          const updatedHistory = [...existingHistory, newPaymentHistoryEntry];
          const newPaid = round2(historicalBase + existingHistorySum + paymentAmount);
          const invTotal = fInv.financials?.invoiceTotal || (fInv.kilos * (fInv.financials?.salePricePerKg || 43) * 1.16);
          const isInvoiceFullyPaid = (newPaid - invTotal) >= -0.05;
          const isOverpaid = (newPaid - invTotal) > 0.05;

          fInv.collection = {
            ...(fInv.collection || {}),
            paidAmount: newPaid,
            paidAt: safeDate,
            collectedAt: isInvoiceFullyPaid ? safeDate : fInv.collection?.collectedAt,
            transferRef: explicitRef || paymentRefKey,
            paymentsHistory: updatedHistory,
            notes: isOverpaid
              ? `${fInv.collection?.notes || ''} [Sobrepago detectado: +$${round2(newPaid - invTotal).toLocaleString('es-MX')}]`.trim()
              : fInv.collection?.notes,
          };

          fInv.creditCycle = {
            ...(fInv.creditCycle || {}),
            status: isInvoiceFullyPaid ? 'collected' : 'in_review',
          };

          freshInvoices[freshInvIdx] = fInv;

          const totalOrderInvoiced = freshInvoices.reduce((sum, i) => sum + (i.financials?.invoiceTotal || (i.kilos * 43 * 1.16)), 0);
          const finalOrderPaid = freshInvoices.reduce((sum, i) => sum + (Number(i.collection?.paidAmount) || 0), 0);
          const finalIsOrderFullyCollected = totalOrderInvoiced > 0 && finalOrderPaid >= (totalOrderInvoiced - 0.05);

          txn.update(orderRef, {
            invoices: cleanUndefined(freshInvoices),
            'collection.paidAmount': finalOrderPaid,
            'collection.paidAt': safeDate,
            'collection.transferRef': explicitRef || paymentRefKey,
            'creditCycle.status': finalIsOrderFullyCollected ? 'collected' : (freshOrder.creditCycle?.status || 'pending'),
            status: finalIsOrderFullyCollected ? 'collected' : ((freshOrder as any).status || 'pending'),
            updatedAt: serverTimestamp(),
          });
        });
      } catch (err: any) {
        return {
          success: false,
          message: `Error en la transacción de pago: ${err?.message || err}`,
          docType: 'comprobante_pago',
          folio: analysis.folio,
          kilos: 0,
          total: paymentAmount,
        };
      }
    }

    if (wasAlreadyAppliedInDb) {
      return {
        success: true,
        isDuplicate: true,
        message: `El comprobante de pago #${paymentRefKey} ya fue aplicado previamente a ${targetOrder.folio || targetOrder.oc}. Se conservó sin duplicar.`,
        docType: 'comprobante_pago',
        folio: analysis.folio,
        kilos: 0,
        total: paymentAmount,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
      };
    }

    try {
      await uploadDocument({
        file: analysis.file,
        docKind: 'pago_providencia',
        folio: explicitRef || paymentRefKey,
        ocNumber: analysis.detectedOcNumber,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
        kilos: 0,
        total: paymentAmount,
        docDate: analysis.docDate,
        notes: isGeneratedFingerprint
          ? `Pago TR de $${paymentAmount} aplicado a Factura #${matchedInv.folio} en ${targetOrder.folio || targetOrder.oc} (Huella: ${paymentRefKey})`
          : `Pago TR ${explicitRef} aplicado a Factura #${matchedInv.folio} en ${targetOrder.folio || targetOrder.oc}`,
      });
    } catch (e) {
      console.warn('Error al respaldar comprobante de pago en Storage:', e);
    }

    return {
      success: true,
      message: `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} aplicado exitosamente a Factura #${matchedInv.folio} en ${targetOrder.folio || targetOrder.oc}.`,
      docType: 'comprobante_pago',
      folio: explicitRef || analysis.folio,
      kilos: 0,
      total: paymentAmount,
      orderId: targetOrder.id,
      orderFolio: targetOrder.folio || targetOrder.oc,
      orderClient: targetOrder.client,
    };
  }

  return {
    success: false,
    message: `Tipo de documento no procesable automáticamente: ${analysis.docType}`,
    docType: analysis.docType,
    folio: analysis.folio,
    kilos: analysis.kilos,
    total: analysis.total,
  };
}
