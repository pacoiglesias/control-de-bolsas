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

import { Timestamp, doc, collection, serverTimestamp, runTransaction, writeBatch } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { safeUpdateDoc, safeAddDoc } from './safeFirestore';
import { cleanUndefined } from './cleanUndefined';
import { uploadDocument } from './documentStorage';
import { logAction, logMandatoryAction } from './logger';
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

/**
 * 🔒 Calcula una huella digital determinista y reproducible a partir del contenido real
 * del archivo (SHA-256 criptográfico de 64 caracteres hex).
 * Si el entorno no soporta cálculo SHA-256, retorna null para no inferir falsos duplicados por metadatos.
 */
export async function computeFileContentFingerprint(file: File): Promise<string | null> {
  try {
    if (file && typeof file.arrayBuffer === 'function') {
      const buf = await file.arrayBuffer();
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
        const hashArray = Array.from(new Uint8Array(hashBuf));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return `SHA256-${hashHex.toUpperCase()}`;
      }
    }
  } catch (err) {
    console.warn('Fallback al calcular huella criptográfica SHA-256:', err);
  }
  return null;
}

/**
 * 🔑 Genera una clave canónica y robusta para payment_receipts.
 * Integra la referencia bancaria oficial o huella SHA-256 junto con la factura amparada,
 * preservando trazabilidad bancaria y permitiendo pagos legítimos multi-factura sin bloqueos erróneos.
 */
export function generateRobustReceiptKey(
  reference: string,
  invoiceIdOrFolio: string,
  sha256Fingerprint?: string | null
): string {
  const targetInvCleanId = (invoiceIdOrFolio || 'INV')
    .replace(/[^A-Z0-9_]/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 24)
    .toUpperCase();

  if (sha256Fingerprint) {
    const cleanSha = sha256Fingerprint.replace(/[^A-Z0-9]/gi, '').slice(0, 32).toUpperCase();
    return `SHA256_${cleanSha}_INV_${targetInvCleanId}`;
  }

  const strongBankRef = (reference || '').trim().toUpperCase();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < strongBankRef.length; i++) {
    const ch = strongBankRef.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const cleanRef = strongBankRef.replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 32);
  const hexHash = ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).slice(0, 12);
  return `BANK_${cleanRef}_INV_${targetInvCleanId}_${hexHash}`;
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
  bankReference?: string;
  trackingKey?: string;
  fileContentSha256?: string | null;
  matchedOrder: PurchaseOrder | null;
  autoAssignedLabel: string | null;
  isDuplicate: boolean;
  duplicateOrder?: PurchaseOrder;
  isSuspectDuplicate?: boolean;
  hasFolioCollision?: boolean;
  hasCrCollision?: boolean;
  existingCr?: string;
  newCr?: string;
  forceApply?: boolean;
  forceReplaceCr?: boolean;
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
  contentHash?: string | null;
  multipleInvoicesCandidate?: boolean;
  candidateInvoices?: Array<{ id: string; folio?: string; balance: number }>;
  targetInvoiceIdOverride?: string;
  manualDecisionAudit?: {
    user?: string;
    date: string;
    reason: string;
    note?: string;
  };
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
  hasCrCollision?: boolean;
  existingCr?: string;
  newCr?: string;
  needsReview?: boolean;
  reviewReason?: string;
  multipleInvoicesCandidate?: boolean;
  candidateInvoices?: Array<{ id: string; folio?: string; balance: number }>;
  targetInvoiceId?: string;
  targetInvoiceFolio?: string;
  storageWarning?: boolean;
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

export interface FindPaymentDuplicateOptions {
  bankReference?: string;
  trackingKey?: string;
  sha256Hash?: string | null;
  amount?: number;
  date?: string;
}

/**
 * 🛡️ Verifica si un comprobante de pago bancario o SPEI ya fue registrado previamente.
 * Prioriza la clave de rastreo SPEI unívoca del Banco de México y la referencia bancaria.
 * Si no existen, utiliza la huella criptográfica SHA-256 completa del archivo.
 * NO marca como duplicado pagos de la misma orden si tienen comprobantes bancarios distintos.
 */
export function findExistingPayment(
  orders: PurchaseOrder[],
  optionsOrRef?: FindPaymentDuplicateOptions | string,
  _legacyAmount?: number,
  _legacyDate?: string,
  legacyHash?: string | null
): { isDuplicate: boolean; order?: PurchaseOrder; invoice?: Invoice; reason?: string; needsReview?: boolean } {
  let bankRef: string | undefined;
  let trackingKey: string | undefined;
  let sha256: string | undefined;

  if (typeof optionsOrRef === 'string') {
    bankRef = optionsOrRef;
    sha256 = legacyHash || undefined;
  } else if (optionsOrRef && typeof optionsOrRef === 'object') {
    bankRef = optionsOrRef.bankReference;
    trackingKey = optionsOrRef.trackingKey;
    sha256 = optionsOrRef.sha256Hash || undefined;
  } else if (!optionsOrRef && legacyHash) {
    sha256 = legacyHash;
  }

  const cleanBankRef = bankRef?.trim().toUpperCase();
  const cleanTrackingKey = trackingKey?.trim().toUpperCase();
  const cleanSha256 = sha256 ? sha256.trim().toUpperCase() : undefined;

  // Si no hay referencia bancaria, ni clave de rastreo, ni hash criptográfico SHA-256 completo:
  // NO asumir duplicado ciego por nombre o tamaño. Requiere revisión manual.
  if (!cleanBankRef && !cleanTrackingKey && !cleanSha256) {
    return {
      isDuplicate: false,
      needsReview: true,
      reason: 'El comprobante carece de referencia bancaria, clave de rastreo SPEI y huella digital SHA-256. Verificación manual requerida.',
    };
  }

  for (const o of orders) {
    if (!o || (o as any).isDeleted) continue;
    for (const inv of o.invoices || []) {
      if (!inv) continue;
      const invRef = inv.collection?.transferRef?.trim().toUpperCase();
      const invSap = inv.collection?.sapDocument?.trim().toUpperCase();
      const invSha = (inv.collection as any)?.fileSha256?.trim().toUpperCase();

      // 1. Coincidencia por Clave de Rastreo SPEI (única a nivel nacional)
      if (cleanTrackingKey && cleanTrackingKey.length >= 6) {
        if (invRef === cleanTrackingKey || invSap === cleanTrackingKey) {
          return {
            isDuplicate: true,
            order: o,
            invoice: inv,
            reason: `Clave de rastreo SPEI ${cleanTrackingKey} ya registrada en Factura #${inv.folio || 'S/N'} en OC ${o.folio || o.oc}`,
          };
        }
        const histMatch = (inv.collection?.paymentsHistory || []).find((p: any) => {
          const pRef = (p.reference || p.receiptId || p.trackingKey || '').trim().toUpperCase();
          return pRef === cleanTrackingKey;
        });
        if (histMatch) {
          return {
            isDuplicate: true,
            order: o,
            invoice: inv,
            reason: `Clave de rastreo SPEI ${cleanTrackingKey} ya aplicada en historial de abonos de Factura #${inv.folio || 'S/N'}`,
          };
        }
      }

      // 2. Coincidencia por Referencia Bancaria / Folio de Autorización
      if (cleanBankRef && cleanBankRef.length >= 5) {
        if (invRef === cleanBankRef || invSap === cleanBankRef) {
          return {
            isDuplicate: true,
            order: o,
            invoice: inv,
            reason: `Referencia bancaria ${cleanBankRef} ya registrada en Factura #${inv.folio || 'S/N'} en OC ${o.folio || o.oc}`,
          };
        }
        const histMatch = (inv.collection?.paymentsHistory || []).find((p: any) => {
          const pRef = (p.reference || p.receiptId || '').trim().toUpperCase();
          return pRef === cleanBankRef;
        });
        if (histMatch) {
          return {
            isDuplicate: true,
            order: o,
            invoice: inv,
            reason: `Referencia bancaria ${cleanBankRef} ya registrada en historial de abonos de Factura #${inv.folio || 'S/N'}`,
          };
        }
      }

      // 3. Coincidencia por Huella Criptográfica SHA-256 completa
      if (cleanSha256 && cleanSha256.length >= 16) {
        const normTarget = cleanSha256.replace(/^SHA256-/, '');
        const normInvSha = invSha ? invSha.replace(/^SHA256-/, '') : '';
        const normInvRef = invRef ? invRef.replace(/^SHA256-/, '') : '';
        if ((normInvSha && normInvSha === normTarget) || (normInvRef && normInvRef === normTarget)) {
          return {
            isDuplicate: true,
            order: o,
            invoice: inv,
            reason: `Comprobante binariamente idéntico (huella SHA-256) ya aplicado en Factura #${inv.folio || 'S/N'}`,
          };
        }
        const histShaMatch = (inv.collection?.paymentsHistory || []).find((p: any) => {
          const pSha = (p.fileSha256 || p.contentHash || p.reference || p.receiptId || '')
            .trim()
            .toUpperCase()
            .replace(/^SHA256-/, '');
          return pSha && pSha === normTarget;
        });
        if (histShaMatch) {
          return {
            isDuplicate: true,
            order: o,
            invoice: inv,
            reason: `Huella digital SHA-256 ya registrada en historial de abonos de Factura #${inv.folio || 'S/N'}`,
          };
        }
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
  const contentHash = await computeFileContentFingerprint(file);
  let docType: PipelineDocType = 'desconocido';
  let confidence: 'alta' | 'media' | 'baja' = 'baja';
  let folio = '';
  let uuid = '';
  let kilos = 0;
  let subtotal = 0;
  let total = 0;
  let docDate = new Date().toISOString().split('T')[0];
  let detectedOcNumber = '';
  let bankReference = '';
  let trackingKey = '';
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
        folio = provPayment.facturaFolio || '';
        bankReference = provPayment.transferRef || '';
        kilos = 0;
        subtotal = round2(provPayment.amount / 1.16);
        total = round2(provPayment.amount);
        // La OC es un dato de asociación a la orden, no la referencia bancaria
        const matchedOcInText = text.match(/(?:12026439784|120267114302|43\/9784|71\/14302|14114|9713)/);
        detectedOcNumber = matchedOcInText ? matchedOcInText[0] : '';
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
          folio = bankTransfer.concept || '';
          bankReference = bankTransfer.numericRef || bankTransfer.folioFirma || '';
          trackingKey = bankTransfer.claveRastreo || '';
          kilos = 0;
          subtotal = round2(bankTransfer.amount / 1.16);
          total = round2(bankTransfer.amount);
          // Buscar OC en concepto de la transferencia bancaria
          const combinedSearchText = `${bankTransfer.concept || ''} ${text}`;
          const matchedOcInBank = combinedSearchText.match(/(?:12026439784|120267114302|43\/9784|71\/14302|14114|9713)/);
          detectedOcNumber = matchedOcInBank ? matchedOcInBank[0] : '';
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
    dupCheck = findExistingPayment(orders, {
      bankReference,
      trackingKey,
      sha256Hash: contentHash,
      amount: total,
      date: docDate,
    });
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
  } else if ((dupCheck as any).needsReview) {
    autoAssignedLabel = `⚠️ REVISIÓN REQUERIDA: ${dupCheck.reason || 'Comprobante requiere verificación manual'}`;
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
    !!(dupCheck as any).needsReview ||
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
    bankReference,
    trackingKey,
    fileContentSha256: contentHash,
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
    contentHash,
  };
}

// Candado en memoria para evitar doble clic y procesamiento concurrente del mismo documento
const inFlightOperations = new Set<string>();

export interface ApplyDocumentOptions {
  forceReplaceCr?: boolean;
  targetInvoiceIdOverride?: string;
  manualDecisionAudit?: {
    user?: string;
    userEmail?: string;
    date?: string;
    reason: string;
    note?: string;
    selectedOrderId?: string;
  };
}

/**
 * 🚀 Aplica un documento a su Orden en Firestore y lo respalda en Storage
 */
export async function applyDocumentFast(
  analysis: PipelineAnalysis,
  targetOrderOverride?: PurchaseOrder | null,
  allOrdersContext?: PurchaseOrder[],
  options?: ApplyDocumentOptions
): Promise<PipelineApplyResult> {
  const targetOrder = targetOrderOverride || analysis.matchedOrder || analysis.duplicateOrder;
  const allowForceReplaceCr = options?.forceReplaceCr ?? analysis.forceReplaceCr;
  const effectiveInvoiceOverride = options?.targetInvoiceIdOverride ?? analysis.targetInvoiceIdOverride;
  const effectiveAudit = options?.manualDecisionAudit
    ? {
        user: options.manualDecisionAudit.userEmail || options.manualDecisionAudit.user || 'Operador',
        date: options.manualDecisionAudit.date || new Date().toISOString(),
        reason: options.manualDecisionAudit.reason,
        note: options.manualDecisionAudit.note,
        selectedOrderId: options.manualDecisionAudit.selectedOrderId,
      }
    : analysis.manualDecisionAudit;

  // Candado de concurrencia e idempotencia en vuelo
  const operationKey = `${analysis.docType}:${analysis.contentHash || analysis.folio || analysis.file?.name}:${analysis.total || analysis.kilos}:${targetOrder?.id || 'NO_ORDER'}`;
  if (inFlightOperations.has(operationKey)) {
    return {
      success: false,
      needsReview: true,
      reviewReason: 'Operación en curso / doble clic detectado para este documento.',
      message: '⚠️ Operación en curso: este documento ya se está procesando actualmente. Espere un momento para evitar registros duplicados.',
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: analysis.kilos,
      total: analysis.total,
    };
  }
  inFlightOperations.add(operationKey);

  try {
    // Registro de auditoría si fue una decisión manual forzada por el operador
    if (effectiveAudit) {
      try {
        const userEmail = effectiveAudit.user || 'operador@elemental.com';
        await logAction(
          userEmail,
          'FORCED_DOCUMENT_IMPORT',
          {
            details: `Importación manual de ${analysis.docType}: Archivo=${analysis.file?.name}, Folio=${analysis.folio || 'S/F'}, Orden=${targetOrder?.folio || targetOrder?.oc || 'N/A'}. Motivo: ${effectiveAudit.reason}${effectiveAudit.note ? ` (Nota: ${effectiveAudit.note})` : ''}`,
            metadata: {
              docType: analysis.docType,
              folio: analysis.folio,
              orderId: targetOrder?.id,
              orderFolio: targetOrder?.folio || targetOrder?.oc,
              audit: effectiveAudit,
              contentHash: analysis.contentHash,
            },
          }
        );
      } catch (logErr) {
        console.warn('Error registrando auditoría de importación manual:', logErr);
      }
    }

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

      // Detección de colisión con contrarrecibo existente diferente
      if (!allowForceReplaceCr) {
        const conflictingMapping = invoiceMappings.find(
          (m) =>
            m.invoice.collection?.contrareciboNumber &&
            m.invoice.collection.contrareciboNumber.trim().toUpperCase() !== crFolio.trim().toUpperCase()
        );
        if (conflictingMapping) {
          const existingCrNum = conflictingMapping.invoice.collection?.contrareciboNumber;
          return {
            success: false,
            needsReview: true,
            hasCrCollision: true,
            existingCr: existingCrNum,
            newCr: crFolio,
            reviewReason: `Conflicto de contrarrecibo: Factura #${conflictingMapping.targetFolio} ya amparada con CR #${existingCrNum}`,
            message: `⚠️ Conflicto de contrarrecibo: La factura #${conflictingMapping.targetFolio} ya cuenta con el Contrarrecibo #${existingCrNum}. No se reemplazará automáticamente sin confirmación explícita para cambiarlo a #${crFolio}.`,
            docType: 'contrarecibo',
            folio: crFolio,
            kilos: 0,
            total: analysis.total,
            orderId: conflictingMapping.order.id,
            orderFolio: conflictingMapping.order.folio || conflictingMapping.order.oc,
            orderClient: conflictingMapping.order.client,
          };
        }
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

      // Límite atómico de Firestore: máximo 500 operaciones por lote
      if (ordersToUpdate.size > 500) {
        return {
          success: false,
          needsReview: true,
          reviewReason: `Operación excede el límite atómico de 500 órdenes por lote (${ordersToUpdate.size})`,
          message: `El Contrarrecibo ${crFolio} abarca ${ordersToUpdate.size} órdenes distintas, lo cual supera el límite de 500 escrituras de Firestore. Operación rechazada antes de escribir para prevenir modificaciones parciales.`,
          docType: 'contrarecibo',
          folio: crFolio,
          kilos: 0,
          total: analysis.total,
        };
      }

      // Aplicar actualizaciones atómicas vía writeBatch para garantizar todo o nada
      const modifiedFolios: string[] = [];
      try {
        const batch = writeBatch(db);
        for (const [ordId, updateData] of ordersToUpdate.entries()) {
          const oRef = doc(db, PATHS.orders, ordId);
          batch.update(oRef, cleanUndefined({
            invoices: updateData.updatedInvoices,
            'collection.contrareciboNumber': crFolio,
            'collection.contrareciboDate': dueDateTimestamp || Timestamp.now(),
            'collection.contrareciboPortalStatus': 'generado',
            'creditCycle.status': 'in_review',
            status: 'in_review',
            updatedAt: serverTimestamp(),
          }));
          modifiedFolios.push(updateData.order.folio || updateData.order.oc || ordId);
        }
        await batch.commit();
      } catch (commitErr: any) {
        // Atomicidad pura: Si falla el batch, ninguna orden fue alterada en Firestore.
        // No se ejecuta ningún fallback secuencial para no dejar modificaciones parciales silenciosas.
        return {
          success: false,
          needsReview: true,
          reviewReason: `Fallo atómico en batch.commit: ${commitErr?.message || commitErr}`,
          message: `Error atómico al registrar contrarrecibo en Firestore. El lote fue cancelado por completo y ninguna orden fue alterada: ${commitErr?.message || commitErr}`,
          docType: 'contrarecibo',
          folio: crFolio,
          kilos: 0,
          total: analysis.total,
        };
      }

      let storageWarning = false;
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
        storageWarning = true;
      }

      return {
        success: true,
        storageWarning,
        message: storageWarning
          ? `Contrarrecibo ${crFolio} vinculado a facturas en Firestore, pero falló el respaldo del archivo en Storage. Los balances son consistentes; puede reintentar la subida del adjunto.`
          : `Contrarrecibo ${crFolio} vinculado automáticamente a Factura(s) #${facFolios.join(', #')}${modifiedFolios.length > 0 ? ` en ${modifiedFolios.join(', ')}` : ''}.`,
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

      if (targetInv.collection?.contrareciboNumber && targetInv.collection.contrareciboNumber.trim().toUpperCase() !== crFolio.trim().toUpperCase() && !analysis.forceReplaceCr) {
        return {
          success: false,
          needsReview: true,
          hasCrCollision: true,
          existingCr: targetInv.collection.contrareciboNumber,
          newCr: crFolio,
          reviewReason: `Conflicto de contrarrecibo: Factura #${targetInv.folio} ya tiene el CR #${targetInv.collection.contrareciboNumber}`,
          message: `⚠️ Conflicto de contrarrecibo: La factura #${targetInv.folio} ya tiene asignado el Contrarrecibo #${targetInv.collection.contrareciboNumber}. Confirmar si desea reemplazarlo por #${crFolio}.`,
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

      let storageWarning = false;
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
        storageWarning = true;
      }

      return {
        success: true,
        storageWarning,
        message: storageWarning
          ? `Contrarrecibo ${crFolio} vinculado a Factura #${targetInv.folio} en ${targetOrder.folio || targetOrder.oc}, pero falló el archivo adjunto en Storage.`
          : `Contrarecibo ${crFolio} vinculado a Factura #${targetInv.folio} en ${targetOrder.folio || targetOrder.oc}.`,
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

    let sellPrice: number | null = null;
    if (hasOrderSellPrice) {
      sellPrice = targetOrder.customSellPrice!;
    } else if (targetOrder.financials?.salePricePerKg !== undefined && targetOrder.financials?.salePricePerKg !== null) {
      sellPrice = targetOrder.financials.salePricePerKg;
    } else if (hasDocSubtotal && numKilos > 0) {
      sellPrice = round2(analysis.subtotal / numKilos);
    }

    if (sellPrice === null) {
      return {
        success: false,
        needsReview: true,
        reviewReason: 'Falta precio unitario de venta o subtotal en la orden y el documento',
        message: `No se pudo determinar el precio de venta para la Factura #${invFolio} en la orden ${targetOrder.folio || targetOrder.oc}. No se asignó ningún precio predeterminado para evitar inconsistencias contables. Verifique la orden o el documento.`,
        docType: 'factura_cfdi',
        folio: invFolio,
        kilos: numKilos,
        total: analysis.total,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
      };
    }

    let costPrice: number = 0;
    if (hasOrderCostPrice) {
      costPrice = targetOrder.customCostPrice!;
    } else if (targetOrder.financials?.costPricePerKg !== undefined && targetOrder.financials?.costPricePerKg !== null) {
      costPrice = targetOrder.financials.costPricePerKg;
    }

    const commRate = targetOrder.financials?.commissionRate ?? 0.08;

    const subtotal = analysis.subtotal > 0 ? analysis.subtotal : round2(numKilos * sellPrice);
    const total = analysis.total > 0 ? analysis.total : round2(subtotal * 1.16);
    const costTotal = round2(numKilos * costPrice);
    const commission = round2(subtotal * commRate);

    const isEstimatedPrice = !hasOrderSellPrice && !hasDocSubtotal;
    const isEstimatedCost = !hasOrderCostPrice;

    // Auditoría obligatoria con identidad real si la importación es forzada o manual
    if (analysis.manualDecisionAudit || analysis.forceApply) {
      const auditUser = (analysis.manualDecisionAudit?.user || '').trim();
      if (!auditUser) {
        return {
          success: false,
          needsReview: true,
          reviewReason: 'Falta usuario autenticado para registrar la auditoría obligatoria',
          message: 'No se puede procesar la importación forzada de factura sin una identidad de usuario autenticado válida.',
          docType: 'factura_cfdi',
          folio: invFolio,
          kilos: numKilos,
          total: total,
        };
      }
      try {
        await logMandatoryAction(auditUser, 'FORCED_DOCUMENT_IMPORT', {
          docType: 'factura_cfdi',
          folio: invFolio,
          uuid: analysis.uuid || null,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
          kilos: numKilos,
          total: total,
          reason: analysis.manualDecisionAudit?.reason || 'Aprobación manual forzada',
          note: analysis.manualDecisionAudit?.note || '',
          date: analysis.manualDecisionAudit?.date || new Date().toISOString(),
        });
      } catch (auditErr: any) {
        return {
          success: false,
          needsReview: true,
          reviewReason: `Fallo de auditoría obligatoria: ${auditErr?.message || auditErr}`,
          message: `La operación no fue completada porque falló el registro obligatorio en la bitácora de auditoría (${auditErr?.message || auditErr}). Se garantizó que no se crearan facturas huérfanas sin trazabilidad.`,
          docType: 'factura_cfdi',
          folio: invFolio,
          kilos: numKilos,
          total: total,
        };
      }
    }

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      folio: invFolio,
      ...(analysis.uuid?.trim() ? { uuid: analysis.uuid.trim() } : {}),
      kilos: numKilos,
      isEstimatedPrice,
      isEstimatedCost,
      ...(analysis.manualDecisionAudit || analysis.forceApply ? {
        manuallyApproved: true,
        manualApprovalDetails: {
          user: (analysis.manualDecisionAudit?.user || '').trim(),
          date: analysis.manualDecisionAudit?.date || new Date().toISOString(),
          reason: analysis.manualDecisionAudit?.reason || 'Aprobación manual forzada',
          note: analysis.manualDecisionAudit?.note || '',
        },
      } : {}),
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
        status: (analysis.isSuspectDuplicate || analysis.hasFolioCollision) ? 'in_review' : 'pending',
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

    let storageWarning = false;
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
      storageWarning = true;
    }

    return {
      success: true,
      storageWarning,
      message: storageWarning
        ? `Factura #${invFolio} registrada en Firestore, pero ocurrió un error al respaldar el archivo en Storage.`
        : `Factura #${invFolio} (${numKilos.toLocaleString('es-MX')} kg · $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}) aplicada y respaldada en ${targetOrder.folio || targetOrder.oc}.`,
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

    // Función auxiliar para determinar el total facturado sin asumir un fallback fijo a 43
    const computeSafeInvoiceTotal = (inv: any): number | null => {
      if (inv.financials?.invoiceTotal !== undefined && inv.financials?.invoiceTotal !== null) {
        return round2(inv.financials.invoiceTotal);
      }
      const unitPrice =
        inv.financials?.salePricePerKg ??
        targetOrder.customSellPrice ??
        targetOrder.financials?.salePricePerKg;
      if (unitPrice !== undefined && unitPrice !== null && (inv.kilos || 0) > 0) {
        return round2(inv.kilos * unitPrice * 1.16);
      }
      return null;
    };

    // Identificar factura destino unívoca
    const currentInvoices = targetOrder.invoices || [];
    let targetInvIdx = -1;

    // Prioridad 0: Override explícito del operador
    if (effectiveInvoiceOverride) {
      targetInvIdx = currentInvoices.findIndex(
        (i: any) =>
          i.id === effectiveInvoiceOverride ||
          i.folio === effectiveInvoiceOverride ||
          normalizeInvoiceFolio(i.folio || i.id) === normalizeInvoiceFolio(effectiveInvoiceOverride)
      );
    }

    // Prioridad 1: Folio exacto de factura si viene en el documento
    if (targetInvIdx === -1 && analysis.folio) {
      const targetFolioNorm = normalizeInvoiceFolio(analysis.folio);
      targetInvIdx = currentInvoices.findIndex((i: any) => normalizeInvoiceFolio(i.folio || i.id) === targetFolioNorm);
    }

    // Calcular saldos de facturas pendientes con validación estricta de precio
    if (targetInvIdx === -1) {
      const unpaid: Array<{ idx: number; inv: any; balance: number }> = [];
      for (let idx = 0; idx < currentInvoices.length; idx++) {
        const inv = currentInvoices[idx];
        const invTotal = computeSafeInvoiceTotal(inv);
        if (invTotal === null) {
          return {
            success: false,
            needsReview: true,
            reviewReason: `Falta precio o total en la factura #${inv.folio || 'S/N'} para calcular el saldo pendiente`,
            message: `No se puede calcular con certeza el saldo de la factura #${inv.folio || 'S/N'} porque no tiene precio registrado. No se aplicó ningún precio predeterminado. Verifique la factura.`,
            docType: 'comprobante_pago',
            folio: analysis.folio,
            kilos: 0,
            total: paymentAmount,
            orderId: targetOrder.id,
            orderFolio: targetOrder.folio || targetOrder.oc,
          };
        }
        const currentPaid = Number(inv.collection?.paidAmount) || 0;
        const balance = round2(invTotal - currentPaid);
        if (balance > 0.05) {
          unpaid.push({ idx, inv, balance });
        }
      }

      // Prioridad 2: Saldo pendiente exacto coincidente (+/- $0.05 tolerancia contable SAT)
      const exactMatches = unpaid.filter((c) => Math.abs(c.balance - paymentAmount) <= 0.05);

      if (exactMatches.length === 1) {
        targetInvIdx = exactMatches[0].idx;
      } else if (exactMatches.length > 1) {
        return {
          success: false,
          needsReview: true,
          multipleInvoicesCandidate: true,
          candidateInvoices: exactMatches.map((c) => ({ id: c.inv.id, folio: c.inv.folio, balance: c.balance })),
          reviewReason: 'Ambigüedad: múltiples facturas tienen el mismo saldo pendiente exacto',
          message: `El pago de $${paymentAmount.toLocaleString('es-MX')} coincide con múltiples facturas pendientes con el mismo saldo exacto (${exactMatches.map((c) => '#' + (c.inv.folio || 'S/F')).join(', ')}). Seleccione la factura destino.`,
          docType: 'comprobante_pago',
          folio: analysis.folio,
          kilos: 0,
          total: paymentAmount,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
        };
      } else if (unpaid.length === 1) {
        // Prioridad 3: Única factura pendiente con saldo en la orden
        targetInvIdx = unpaid[0].idx;
      } else {
        return {
          success: false,
          needsReview: true,
          multipleInvoicesCandidate: unpaid.length > 1,
          candidateInvoices: unpaid.map((u) => ({ id: u.inv.id, folio: u.inv.folio, balance: u.balance })),
          reviewReason: unpaid.length === 0 ? 'No hay facturas pendientes con saldo' : 'Múltiples facturas pendientes con saldo',
          message: unpaid.length === 0
            ? `No se encontraron facturas con saldo pendiente en la orden ${targetOrder.folio || targetOrder.oc}. Asignación manual requerida.`
            : `Existen ${unpaid.length} facturas con saldo pendiente en la orden ${targetOrder.folio || targetOrder.oc}. Seleccione la factura específica para aplicar el pago.`,
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

    // Identidad bancaria fuerte (clave de rastreo SPEI o autorización/referencia bancaria)
    const strongBankRef = (analysis.trackingKey || analysis.bankReference || '').trim().toUpperCase();
    let sha256Key = (analysis.fileContentSha256 || analysis.contentHash || '').trim().toUpperCase() || null;
    if (!sha256Key && analysis.file) {
      try {
        sha256Key = (await computeFileContentFingerprint(analysis.file)) || null;
      } catch {
        // Ignorar error al leer huella si el archivo no es procesable
      }
    }

    // Regla de integridad financiera:
    // Nunca permitir que una referencia débil (folio de orden, OC, nombre de archivo o nombre + importe)
    // se trate como identidad confiable del pago. Si no existe referencia bancaria o huella segura,
    // NO aplicar automáticamente y solicitar revisión manual.
    if (!strongBankRef && !sha256Key) {
      return {
        success: false,
        needsReview: true,
        reviewReason: 'Comprobante de pago sin clave de rastreo SPEI, referencia bancaria ni huella digital SHA-256 segura',
        message: 'El comprobante carece de identidad bancaria o huella digital segura. Para evitar pagos mal asociados o duplicados, se requiere revisión manual obligatoria.',
        docType: 'comprobante_pago',
        folio: analysis.folio,
        kilos: 0,
        total: paymentAmount,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
        targetInvoiceId: matchedInv.id,
        targetInvoiceFolio: matchedInv.folio,
      };
    }

    // Clave canónica de referencia para el pago
    const paymentRefKey = strongBankRef || (sha256Key ? `SHA256-${sha256Key}` : '');

    // Generar clave de almacenamiento canónica en payment_receipts con identidad bancaria robusta.
    // Combina la referencia bancaria oficial / huella SHA-256 junto con el identificador de la factura
    // para asegurar trazabilidad exacta sin bloquear pagos legítimos multi-factura.
    const sanitizedReceiptKey = generateRobustReceiptKey(
      paymentRefKey,
      matchedInv.id || matchedInv.folio || 'INV',
      sha256Key
    );

    // Auditoría obligatoria con identidad real si la decisión fue forzada o manual
    if (analysis.manualDecisionAudit || analysis.forceApply) {
      const auditUser = (analysis.manualDecisionAudit?.user || '').trim();
      if (!auditUser) {
        return {
          success: false,
          needsReview: true,
          reviewReason: 'Falta usuario autenticado para registrar la auditoría obligatoria',
          message: 'No se puede procesar la importación forzada sin una identidad de usuario autenticado válida.',
          docType: 'comprobante_pago',
          folio: analysis.folio,
          kilos: 0,
          total: paymentAmount,
        };
      }
      try {
        await logMandatoryAction(auditUser, 'FORCED_DOCUMENT_IMPORT', {
          docType: 'comprobante_pago',
          paymentRef: paymentRefKey,
          trackingKey: analysis.trackingKey || null,
          bankReference: analysis.bankReference || null,
          orderId: targetOrder.id,
          orderFolio: targetOrder.folio || targetOrder.oc,
          targetInvoiceId: matchedInv.id,
          targetInvoiceFolio: matchedInv.folio,
          amount: paymentAmount,
          reason: analysis.manualDecisionAudit?.reason || 'Aprobación manual forzada',
          note: analysis.manualDecisionAudit?.note || '',
          date: analysis.manualDecisionAudit?.date || new Date().toISOString(),
        });
      } catch (auditErr: any) {
        return {
          success: false,
          needsReview: true,
          reviewReason: `Fallo de auditoría obligatoria: ${auditErr?.message || auditErr}`,
          message: `La operación no fue completada porque falló el registro obligatorio en la bitácora de auditoría (${auditErr?.message || auditErr}). Se garantizó que no se crearan abonos huérfanos sin trazabilidad.`,
          docType: 'comprobante_pago',
          folio: analysis.folio,
          kilos: 0,
          total: paymentAmount,
        };
      }
    }

    // Transacción atómica en Firestore para garantizar idempotencia compartida entre usuarios/sesiones
    let wasAlreadyAppliedInDb = false;

    if (orderRef) {
      try {
        await runTransaction(db, async (txn) => {
          // Idempotencia compartida en Firestore
          const receiptRef = doc(db, 'payment_receipts', sanitizedReceiptKey);
          const receiptSnap = await txn.get(receiptRef);
          if (receiptSnap.exists()) {
            wasAlreadyAppliedInDb = true;
            return;
          }

          const freshSnap = await txn.get(orderRef);
          if (!freshSnap.exists()) {
            throw new Error(`La orden ${targetOrder.id} no existe en Firestore`);
          }
          const freshOrder = freshSnap.data() as PurchaseOrder;
          const freshInvoices = [...(freshOrder.invoices || [])];

          const freshInvIdx = freshInvoices.findIndex((i: any) =>
            normalizeInvoiceFolio(i.folio || i.id) === normalizeInvoiceFolio(matchedInv.folio || matchedInv.id)
          );

          if (freshInvIdx === -1) {
            throw new Error(`La factura #${matchedInv.folio} ya no existe en la orden`);
          }

          const fInv = freshInvoices[freshInvIdx];

          // Comprobar idempotencia en la factura destino:
          // Solo se considera duplicado si este pago ya fue aplicado A ESTA FACTURA ESPECÍFICA.
          // Esto preserva referencias bancarias oficiales y permite transferencias legítimas que amparan múltiples facturas.
          const alreadyAppliedInThisInvoice =
            (fInv.collection?.transferRef && fInv.collection.transferRef.toUpperCase() === paymentRefKey) ||
            (fInv.collection?.paymentsHistory || []).some((p: any) =>
              (p.reference && p.reference.toUpperCase() === paymentRefKey) ||
              (p.receiptId && p.receiptId.toUpperCase() === paymentRefKey) ||
              (p.trackingKey && p.trackingKey.toUpperCase() === paymentRefKey) ||
              (p.fileSha256 && p.fileSha256.toUpperCase() === paymentRefKey)
            );

          if (alreadyAppliedInThisInvoice) {
            wasAlreadyAppliedInDb = true;
            return;
          }

          const prevPaid = Number(fInv.collection?.paidAmount) || 0;
          const existingHistory = Array.isArray(fInv.collection?.paymentsHistory) ? fInv.collection.paymentsHistory : [];
          const existingHistorySum = round2(existingHistory.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0));

          // Preservar saldo inicial histórico si no existía desglose individual previo
          const historicalBase = Math.max(0, round2(prevPaid - existingHistorySum));

          const newPaymentHistoryEntry = {
            id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            receiptId: paymentRefKey,
            amount: paymentAmount,
            date: safeDate,
            reference: paymentRefKey,
            trackingKey: analysis.trackingKey || undefined,
            bankReference: analysis.bankReference || undefined,
            fileSha256: sha256Key || undefined,
            invoiceId: fInv.id || fInv.folio || '',
            invoiceFolio: fInv.folio || '',
            notes: analysis.trackingKey
              ? `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (SPEI: ${analysis.trackingKey})`
              : (analysis.bankReference
                  ? `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (Ref: ${analysis.bankReference})`
                  : `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} (Huella SHA-256: ${sha256Key?.slice(0, 16)}...)`),
          };

          const updatedHistory = [...existingHistory, newPaymentHistoryEntry];
          const newPaid = round2(historicalBase + existingHistorySum + paymentAmount);
          const invTotal = computeSafeInvoiceTotal(fInv) ?? (Number(fInv.kilos || 0) * (fInv.financials?.salePricePerKg ?? targetOrder.customSellPrice ?? targetOrder.financials?.salePricePerKg ?? 0) * 1.16);
          const isInvoiceFullyPaid = (newPaid - invTotal) >= -0.05;
          const isOverpaid = (newPaid - invTotal) > 0.05;

          fInv.collection = {
            ...(fInv.collection || {}),
            paidAmount: newPaid,
            paidAt: safeDate,
            collectedAt: isInvoiceFullyPaid ? safeDate : fInv.collection?.collectedAt,
            transferRef: paymentRefKey,
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

          const totalOrderInvoiced = freshInvoices.reduce((sum, i) => {
            const tot = computeSafeInvoiceTotal(i) ?? 0;
            return sum + tot;
          }, 0);
          const finalOrderPaid = freshInvoices.reduce((sum, i) => sum + (Number(i.collection?.paidAmount) || 0), 0);
          const finalIsOrderFullyCollected = totalOrderInvoiced > 0 && finalOrderPaid >= (totalOrderInvoiced - 0.05);

          // Registrar en payment_receipts la idempotencia compartida y trazabilidad con estado 'applied'
          txn.set(receiptRef, {
            receiptKey: sanitizedReceiptKey,
            canonicalRef: paymentRefKey,
            status: 'applied',
            orderId: targetOrder.id,
            orderFolio: targetOrder.folio || targetOrder.oc,
            invoiceId: fInv.id,
            invoiceFolio: fInv.folio || '',
            amount: paymentAmount,
            trackingKey: analysis.trackingKey || null,
            bankReference: analysis.bankReference || null,
            fileSha256: sha256Key || null,
            appliedAt: serverTimestamp(),
            appliedBy: (analysis.manualDecisionAudit?.user || 'sistema').toLowerCase().trim(),
          });

          txn.update(orderRef, {
            invoices: cleanUndefined(freshInvoices),
            'collection.paidAmount': finalOrderPaid,
            'collection.paidAt': safeDate,
            'collection.transferRef': paymentRefKey,
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
        message: `El comprobante de pago #${paymentRefKey} ya fue aplicado previamente en el ERP. Se conservó sin duplicar los abonos.`,
        docType: 'comprobante_pago',
        folio: analysis.folio,
        kilos: 0,
        total: paymentAmount,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
      };
    }

    let storageWarning = false;
    try {
      await uploadDocument({
        file: analysis.file,
        docKind: 'pago_providencia',
        folio: paymentRefKey,
        ocNumber: analysis.detectedOcNumber || targetOrder.oc || targetOrder.folio,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
        kilos: 0,
        total: paymentAmount,
        docDate: analysis.docDate,
        notes: `Comprobante de pago $${paymentAmount} aplicado a Factura #${matchedInv.folio} (Ref: ${paymentRefKey})`,
      });
    } catch (e) {
      console.warn('Error al respaldar comprobante de pago en Storage:', e);
      storageWarning = true;
    }

    return {
      success: true,
      storageWarning,
      message: storageWarning
        ? `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} registrado en Firestore, pero falló el respaldo del archivo en Storage. Los balances son correctos; puede reintentar la subida del comprobante.`
        : `Abono de $${paymentAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} aplicado exitosamente a Factura #${matchedInv.folio} en ${targetOrder.folio || targetOrder.oc}.`,
      docType: 'comprobante_pago',
      folio: paymentRefKey,
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
  } finally {
    inFlightOperations.delete(operationKey);
  }
}
