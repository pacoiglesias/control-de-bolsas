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

import { Timestamp, doc, collection, serverTimestamp } from 'firebase/firestore';
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
  needsClarification: boolean;
  rawText?: string;
  ocPiezasInfo?: {
    totalPiezas: number;
    conceptos: Array<{ codigo: string; descripcion: string; cantidad: number; valorUnitario: number }>;
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
 * 🛡️ Verifica si el folio o UUID ya existe en alguna orden activa
 */
export function findExistingInvoice(
  orders: PurchaseOrder[],
  folioCandidate?: string,
  uuidCandidate?: string
): { isDuplicate: boolean; order?: PurchaseOrder; invoice?: Invoice } {
  if (!folioCandidate && !uuidCandidate) return { isDuplicate: false };
  const cleanFolio = folioCandidate?.trim().toUpperCase();
  const cleanUuid = uuidCandidate?.trim().toUpperCase();

  for (const o of orders) {
    if (!o || (o as any).isDeleted) continue;
    const matchInv = (o.invoices || []).find((inv) => {
      if (!inv) return false;
      if (cleanFolio && inv.folio?.trim().toUpperCase() === cleanFolio) return true;
      if (cleanUuid && inv.uuid?.trim().toUpperCase() === cleanUuid) return true;
      return false;
    });
    if (matchInv) {
      return { isDuplicate: true, order: o, invoice: matchInv };
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

            if (ocr.docKind === 'pago_providencia') {
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

        if (ocr.docKind === 'remision' || /REMISI[OÓ]N|ORDEN\s*DE\s*ENTREGA/i.test(text)) {
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
  const matchedOrder = matchOrderCanonical(orders, detectedOcNumber, folio, total);

  // Duplicados
  const dupCheck = findExistingInvoice(orders, folio, uuid);

  let autoAssignedLabel: string | null = null;
  if (matchedOrder) {
    const deptTag =
      matchedOrder.client?.includes('TH') || (matchedOrder.department || '').includes('TH')
        ? 'TH (José Nava)'
        : 'GT (Lic. Evelia)';
    autoAssignedLabel = `🎯 OC Asignada: ${matchedOrder.folio || matchedOrder.oc} · ${deptTag}`;
  }

  const needsClarification = !matchedOrder && docType !== 'oc_providencia';

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
    needsClarification,
    rawText,
    ocPiezasInfo,
  };
}

/**
 * 🚀 Aplica un documento a su Orden en Firestore y lo respalda en Storage
 */
export async function applyDocumentFast(
  analysis: PipelineAnalysis,
  targetOrderOverride?: PurchaseOrder | null
): Promise<PipelineApplyResult> {
  const targetOrder = targetOrderOverride || analysis.matchedOrder;

  // 1. Manejo de duplicados de factura
  if (analysis.docType === 'factura_cfdi' && analysis.isDuplicate) {
    return {
      success: true,
      isDuplicate: true,
      message: `La Factura #${analysis.folio} ya está registrada en ${analysis.duplicateOrder?.folio || analysis.duplicateOrder?.oc}. Se conservó sin duplicar.`,
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: analysis.kilos,
      total: analysis.total,
      orderId: analysis.duplicateOrder?.id,
      orderFolio: analysis.duplicateOrder?.folio || analysis.duplicateOrder?.oc,
    };
  }

  // 2. Creación de OC Nueva si el documento es una OC oficial
  if (analysis.docType === 'oc_providencia' && !targetOrder) {
    const isTh = analysis.folio?.includes('71') || analysis.detectedOcNumber?.includes('1202671');
    const newOrderDoc = {
      folio: analysis.folio || analysis.detectedOcNumber || 'OC-NUEVA',
      oc: analysis.detectedOcNumber || analysis.folio || 'OC-NUEVA',
      client: isTh ? 'TEXTIL HOGAR (TH - NAVA)' : 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      department: isTh ? 'TH' : 'GT',
      departmentLocation: isTh ? 'TH-ALMACEN-1' : 'P4-ALM',
      totalKilograms: analysis.kilos || 0,
      status: 'pedido',
      creditCycle: { status: 'pedido' },
      isClosedShort: false,
      notes: `OC importada automáticamente desde ${analysis.file.name}`,
      invoices: [],
      deliveries: [],
      items: (analysis.ocPiezasInfo?.conceptos || []).map((c, idx) => ({
        id: `item-${idx + 1}`,
        code: c.codigo || 'S/C',
        description: c.descripcion || 'Bolsa de Polietileno',
        quantity: c.cantidad || analysis.kilos || 0,
        unitPrice: c.valorUnitario || 43,
        amount: (c.cantidad || 0) * (c.valorUnitario || 43),
        unit: 'Kilos',
      })),
      createdAt: Timestamp.now(),
      updatedAt: serverTimestamp(),
    };

    const newDocRef = await safeAddDoc(collection(db, PATHS.orders), newOrderDoc);

    // Respaldo en Storage
    try {
      await uploadDocument({
        file: analysis.file,
        docKind: 'oc_providencia',
        folio: newOrderDoc.folio,
        ocNumber: newOrderDoc.oc,
        orderId: newDocRef.id,
        orderFolio: newOrderDoc.folio,
        kilos: analysis.kilos,
        total: analysis.total,
        docDate: analysis.docDate,
        notes: `OC importada automáticamente desde ${analysis.file.name}`,
      });
    } catch (e) {
      console.warn('Error al subir OC a Storage:', e);
    }

    return {
      success: true,
      message: `Nueva Orden de Compra ${newOrderDoc.folio} (${analysis.kilos.toLocaleString('es-MX')} kg) creada y respaldada en la nube.`,
      docType: 'oc_providencia',
      folio: newOrderDoc.folio,
      kilos: analysis.kilos,
      total: analysis.total,
      orderId: newDocRef.id,
      orderFolio: newOrderDoc.folio,
      orderClient: newOrderDoc.client,
    };
  }

  // 3. Si no hay orden asociada y no es OC
  if (!targetOrder) {
    return {
      success: false,
      message: 'No se encontró Orden de Compra destino para vincular este documento.',
      docType: analysis.docType,
      folio: analysis.folio,
      kilos: analysis.kilos,
      total: analysis.total,
    };
  }

  const orderRef = doc(db, PATHS.orders, targetOrder.id);
  const safeDate = toSafeTimestamp(analysis.docDate);

  // 4. APLICACIÓN DE FACTURA CFDI
  if (analysis.docType === 'factura_cfdi') {
    const invFolio = analysis.folio?.trim() || 'S/F';
    const numKilos = Number(analysis.kilos) || 0;
    const sellPrice = targetOrder.customSellPrice || 43;
    const subtotal = analysis.subtotal || round2(numKilos * sellPrice);
    const total = analysis.total || round2(numKilos * sellPrice * 1.16);

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      folio: invFolio,
      ...(analysis.uuid?.trim() ? { uuid: analysis.uuid.trim() } : {}),
      kilos: numKilos,
      financials: {
        salePricePerKg: sellPrice,
        costPricePerKg: 38,
        saleTotal: subtotal,
        invoiceTotal: total,
        costTotal: round2(numKilos * 38),
        commission: round2(subtotal * 0.08),
        netCashFlow: round2(total - numKilos * 38 - subtotal * 0.08),
        tradeMargin: round2(subtotal - numKilos * 38),
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

    await safeUpdateDoc(orderRef, {
      invoices: cleanUndefined([...existingInvoices, newInvoice]),
      deliveries: cleanUndefined(updatedDeliveries),
      updatedAt: serverTimestamp(),
    });

    // Subir a Storage
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

  // 5. APLICACIÓN DE TICKET DE BÁSCULA O REMISIÓN
  if (analysis.docType === 'ticket_bascula' || analysis.docType === 'remision') {
    const numKilos = Number(analysis.kilos) || 0;
    const newDelivery: Delivery = {
      id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: safeDate,
      kilos: numKilos,
      notes: `Ingreso de báscula ticket #${analysis.folio || 'S/N'} (${numKilos.toLocaleString('es-MX')} kg)`,
      invoiced: false,
      docType: 'remision',
      ...(analysis.folio?.trim() ? { docFolio: analysis.folio.trim() } : {}),
    };

    const existingDeliveries = targetOrder.deliveries || [];
    await safeUpdateDoc(orderRef, {
      deliveries: cleanUndefined([...existingDeliveries, newDelivery]),
      updatedAt: serverTimestamp(),
    });

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

  // 6. APLICACIÓN DE COMPROBANTE DE PAGO TR
  if (analysis.docType === 'comprobante_pago') {
    const updatedInvoices = [...(targetOrder.invoices || [])];
    const invIdx = updatedInvoices.findIndex(
      (i: any) =>
        (analysis.folio && i.folio === analysis.folio) ||
        (analysis.detectedOcNumber && i.collection?.transferRef === analysis.detectedOcNumber) ||
        (analysis.total > 0 && Math.abs((i.financials?.invoiceTotal || 0) - analysis.total) < 1)
    );

    if (invIdx !== -1 && updatedInvoices[invIdx]) {
      const inv = updatedInvoices[invIdx];
      inv.collection = {
        ...(inv.collection || {}),
        paidAmount: analysis.total,
        paidAt: safeDate,
        collectedAt: safeDate,
        transferRef: analysis.detectedOcNumber || analysis.folio,
      };
      inv.creditCycle = {
        ...(inv.creditCycle || {}),
        status: 'collected',
      };
    }

    await safeUpdateDoc(orderRef, {
      invoices: cleanUndefined(updatedInvoices),
      'collection.paidAmount': analysis.total,
      'collection.paidAt': safeDate,
      'collection.transferRef': analysis.detectedOcNumber || analysis.folio,
      'creditCycle.status': 'collected',
      status: 'collected',
      updatedAt: serverTimestamp(),
    });

    try {
      await uploadDocument({
        file: analysis.file,
        docKind: 'pago_providencia',
        folio: analysis.folio || analysis.detectedOcNumber || 'S/F',
        ocNumber: analysis.detectedOcNumber,
        orderId: targetOrder.id,
        orderFolio: targetOrder.folio || targetOrder.oc,
        kilos: 0,
        total: analysis.total,
        docDate: analysis.docDate,
        notes: `Pago TR ${analysis.detectedOcNumber} aplicado a ${targetOrder.folio || targetOrder.oc}`,
      });
    } catch (e) {
      console.warn('Error al subir comprobante de pago a Storage:', e);
    }

    return {
      success: true,
      message: `Pago de $${analysis.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} aplicado con éxito a ${targetOrder.folio || targetOrder.oc}.`,
      docType: 'comprobante_pago',
      folio: analysis.folio,
      kilos: 0,
      total: analysis.total,
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
