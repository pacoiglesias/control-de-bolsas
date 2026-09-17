import { doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import type { PurchaseOrder, FinancialConfig, PurchaseOrderItem, Invoice, Delivery } from './types';
import type { ExtractedDocumentData } from '../components/Recepcion/SmartDocumentDropzone';
import { computeFinancials } from './finance';
import { camposInvoices } from './invoiceOps';

export type DoubtType =
  | 'oc_already_exists'
  | 'no_matching_oc'
  | 'duplicate_invoice'
  | 'kilos_exceeded'
  | 'unknown_document';

export interface SuggestedAction {
  id: string;
  label: string;
  description?: string;
  actionType: 'create_new_oc' | 'assign_to_order' | 'replace_invoice' | 'force_assign' | 'skip';
  orderId?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export type OperationDecision =
  | {
      type: 'auto_create_oc';
      summary: string;
      ocNumber: string;
      folio: string;
      kilos: number;
      department: 'TH' | 'GT';
    }
  | {
      type: 'auto_assign_invoice';
      summary: string;
      targetOrder: PurchaseOrder;
      invoiceFolio: string;
      kilos: number;
      uuid?: string;
    }
  | {
      type: 'auto_assign_contrarecibo';
      summary: string;
      targetOrder: PurchaseOrder;
      crNumber: string;
    }
  | {
      type: 'doubt';
      doubtType: DoubtType;
      title: string;
      question: string;
      details?: string;
      targetOrder?: PurchaseOrder;
      suggestedOrders?: PurchaseOrder[];
      suggestedActions: SuggestedAction[];
    };

/**
 * Normaliza cadenas de folios u órdenes de compra para comparaciones robustas.
 */
export function normalizeCode(code?: string): string {
  if (!code) return '';
  return code.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Evalúa si una operación de captura puede ejecutarse automáticamente
 * o si requiere preguntar al usuario por existir alguna duda/ambigüedad.
 */
export function evaluateDocumentOperation(
  docData: ExtractedDocumentData,
  orders: PurchaseOrder[],
  _config?: FinancialConfig
): OperationDecision {
  const activeOrders = orders.filter((o) => !o.isDeleted);

  // 1. Caso: Orden de Compra (OC)
  if (docData.type === 'orden_compra') {
    const ocNum = docData.ocFolio || docData.oc || docData.folio || '';
    const normOc = normalizeCode(ocNum);

    // Buscar si ya existe
    const existingOrder = activeOrders.find(
      (o) => normalizeCode(o.oc) === normOc || normalizeCode(o.folio) === normOc
    );

    if (existingOrder) {
      return {
        type: 'doubt',
        doubtType: 'oc_already_exists',
        title: 'Orden de Compra Ya Registrada',
        question: `La Orden de Compra "${ocNum}" ya existe en el sistema en el expediente ${existingOrder.folio || existingOrder.oc}. ¿Cómo deseas proceder?`,
        details: `Expediente actual: ${existingOrder.client || 'Cliente'} con ${existingOrder.totalKilograms || 0} kg.`,
        targetOrder: existingOrder,
        suggestedActions: [
          {
            id: 'update_existing',
            label: 'Actualizar Partidas y Kilos',
            description: 'Actualiza los kilogramos y productos del expediente existente',
            actionType: 'force_assign',
            orderId: existingOrder.id,
            variant: 'primary',
          },
          {
            id: 'skip_oc',
            label: 'Conservar Existente Sin Cambios',
            description: 'No modificar el expediente ya registrado',
            actionType: 'skip',
            variant: 'secondary',
          },
        ],
      };
    }

    // No existe: ALTA AUTOMÁTICA
    const totalKg = docData.kilos || docData.items?.reduce((acc, it) => acc + (it.quantity || 0), 0) || 0;
    const dept = docData.department || (docData.client?.toUpperCase().includes('GT') ? 'GT' : 'TH');

    return {
      type: 'auto_create_oc',
      summary: `Orden de Compra ${ocNum} (${totalKg.toLocaleString('es-MX')} kg, Planta ${dept})`,
      ocNumber: ocNum,
      folio: docData.folio || ocNum,
      kilos: totalKg,
      department: dept,
    };
  }

  // 2. Caso: Factura (XML o PDF)
  if (docData.type === 'xml_factura' || docData.type === 'pdf_document') {
    const invFolio = docData.folio || 'S/F';
    const rawOcTarget = docData.ocFolio || docData.oc;
    const normTarget = normalizeCode(rawOcTarget);

    // Intentar encontrar la orden destino por OC directa
    let matchedOrder: PurchaseOrder | undefined;

    if (normTarget) {
      matchedOrder = activeOrders.find((o) => {
        const normO = normalizeCode(o.oc);
        const normF = normalizeCode(o.folio);
        return normO === normTarget || normF === normTarget || normO.endsWith(normTarget) || normTarget.endsWith(normO);
      });
    }

    // Si no vino OC explícita, buscar por monto exacto o kilos exactos si hay solo un candidato
    if (!matchedOrder) {
      const candidates = activeOrders.filter((o) => {
        const orderStatus = (o as any).status || o.creditCycle?.status;
        if (orderStatus === 'collected' || (o.invoices && o.invoices.length > 5)) return false;
        const totalKg = o.totalKilograms || 0;
        const orderAmount = o.financials?.invoiceTotal || (totalKg * 43 * 1.16);
        const matchKg = docData.kilos && Math.abs(totalKg - docData.kilos) < 2;
        const matchAmt = docData.total && Math.abs(orderAmount - docData.total) < 5;
        return matchKg || matchAmt;
      });

      if (candidates.length === 1) {
        // Coincidencia inequívoca por métricas
        matchedOrder = candidates[0];
      }
    }

    // DUDA: Si no se encontró ninguna orden destino
    if (!matchedOrder) {
      // Buscar sugerencias
      const suggestions = activeOrders
        .filter((o) => ((o as any).status || o.creditCycle?.status) !== 'collected')
        .slice(0, 3);

      const suggestedActions: SuggestedAction[] = suggestions.map((o) => ({
        id: `assign_${o.id}`,
        label: `Vincular a OC ${o.folio || o.oc} (${o.client || 'Cliente'})`,
        description: `Meta: ${(o.totalKilograms || 0).toLocaleString('es-MX')} kg`,
        actionType: 'assign_to_order',
        orderId: o.id,
      }));

      suggestedActions.push({
        id: 'create_new_for_invoice',
        label: `+ Crear Nuevo Expediente para Factura #${invFolio}`,
        description: `Crea una nueva OC amparando ${docData.kilos || 0} kg`,
        actionType: 'create_new_oc',
        variant: 'primary',
      });

      suggestedActions.push({
        id: 'cancel_assign',
        label: 'Cancelar Operación',
        actionType: 'skip',
        variant: 'secondary',
      });

      return {
        type: 'doubt',
        doubtType: 'no_matching_oc',
        title: 'Factura Sin Orden de Compra Identificada',
        question: `La Factura #${invFolio} (${(docData.kilos || 0).toLocaleString('es-MX')} kg, $${(docData.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}) no tiene una OC existente en el sistema (OC buscada: "${rawOcTarget || 'Ninguna'}"). ¿A qué expediente deseas asignarla?`,
        details: `Emisor: Elemental Denim · Cliente: Grupo Textil Providencia`,
        suggestedOrders: suggestions,
        suggestedActions,
      };
    }

    // DUDA: Factura duplicada en la misma orden
    const isDuplicate = (matchedOrder.invoices || []).some(
      (inv) =>
        (inv.folio && normalizeCode(inv.folio) === normalizeCode(invFolio)) ||
        (docData.uuid && inv.uuid && inv.uuid.toLowerCase() === docData.uuid.toLowerCase())
    );

    if (isDuplicate) {
      return {
        type: 'doubt',
        doubtType: 'duplicate_invoice',
        title: 'Factura Ya Existente en el Expediente',
        question: `La Factura #${invFolio} ${docData.uuid ? `(UUID: ${docData.uuid})` : ''} ya está registrada en la OC ${matchedOrder.folio || matchedOrder.oc}. ¿Deseas reemplazar los datos de la factura existente o conservarla?`,
        targetOrder: matchedOrder,
        suggestedActions: [
          {
            id: 'replace_invoice',
            label: `Reemplazar Factura #${invFolio}`,
            description: 'Sobrescribe los datos de la factura y recalcula importes',
            actionType: 'replace_invoice',
            orderId: matchedOrder.id,
            variant: 'danger',
          },
          {
            id: 'skip_duplicate',
            label: 'Conservar Existente (Omitir)',
            actionType: 'skip',
            variant: 'secondary',
          },
        ],
      };
    }

    // DUDA: Discrepancia grave de kilos (factura supera en más del 15% los kilos restantes de la OC)
    const currentInvoicedKg = (matchedOrder.invoices || []).reduce((acc, i) => acc + (i.kilos || 0), 0);
    const orderGoalKg = matchedOrder.totalKilograms || 0;
    const remainingKg = Math.max(0, orderGoalKg - currentInvoicedKg);
    const invKg = docData.kilos || 0;

    if (orderGoalKg > 0 && invKg > remainingKg * 1.2 && remainingKg > 50) {
      return {
        type: 'doubt',
        doubtType: 'kilos_exceeded',
        title: 'Kilos de Factura Exceden la OC',
        question: `La Factura #${invFolio} ampara ${invKg.toLocaleString('es-MX')} kg, pero a la OC ${matchedOrder.folio || matchedOrder.oc} solo le restan ${remainingKg.toLocaleString('es-MX')} kg por facturar (Meta: ${orderGoalKg.toLocaleString('es-MX')} kg). ¿Deseas vincularla de todas formas?`,
        targetOrder: matchedOrder,
        suggestedActions: [
          {
            id: 'force_assign_kilos',
            label: 'Vincular de Todas Formas',
            description: 'Se agregará la factura al expediente a pesar del excedente',
            actionType: 'force_assign',
            orderId: matchedOrder.id,
            variant: 'primary',
          },
          {
            id: 'cancel_kilos_exceeded',
            label: 'Cancelar y Revisar Documento',
            actionType: 'skip',
            variant: 'secondary',
          },
        ],
      };
    }

    // PROCESAMIENTO AUTOMÁTICO DE FACTURA
    return {
      type: 'auto_assign_invoice',
      summary: `Factura #${invFolio} (${invKg.toLocaleString('es-MX')} kg) vinculada a OC ${matchedOrder.folio || matchedOrder.oc}`,
      targetOrder: matchedOrder,
      invoiceFolio: invFolio,
      kilos: invKg,
      uuid: docData.uuid,
    };
  }

  // 3. Caso: Contrarecibo
  if (docData.type === 'contrarecibo') {
    const crNum = docData.contrarecibo || '';
    const matchOrder = activeOrders.find((o) =>
      (o.invoices || []).some((inv) => inv.folio && docData.folio && normalizeCode(inv.folio) === normalizeCode(docData.folio))
    );

    if (matchOrder) {
      return {
        type: 'auto_assign_contrarecibo',
        summary: `Contrarecibo ${crNum} asignado a OC ${matchOrder.folio || matchOrder.oc}`,
        targetOrder: matchOrder,
        crNumber: crNum,
      };
    }

    return {
      type: 'doubt',
      doubtType: 'unknown_document',
      title: 'Contrarecibo Sin Factura Asociada',
      question: `Se detectó el Contrarecibo "${crNum}", pero no se encontró la factura correspondiente en ningún expediente activo.`,
      suggestedActions: [
        {
          id: 'skip_cr',
          label: 'Aceptar y Cerrar',
          actionType: 'skip',
          variant: 'secondary',
        },
      ],
    };
  }

  return {
    type: 'doubt',
    doubtType: 'unknown_document',
    title: 'Documento No Reconocido',
    question: `No se pudo determinar con certeza la naturaleza del archivo "${docData.fileName || 'desconocido'}". ¿Deseas revisarlo manualmente?`,
    suggestedActions: [
      {
        id: 'skip_unknown',
        label: 'Descartar',
        actionType: 'skip',
        variant: 'secondary',
      },
    ],
  };
}

/**
 * Ejecuta la creación automática de una nueva Orden de Compra en Firestore.
 */
export async function executeAutoCreateOc(
  docData: ExtractedDocumentData,
  config: FinancialConfig
): Promise<string> {
  const totalKg = docData.kilos || docData.items?.reduce((acc, it) => acc + (it.quantity || 0), 0) || 0;
  const fin = computeFinancials(totalKg, config);
  const ocNumber = docData.ocFolio || docData.oc || docData.folio || `OC-${Date.now()}`;
  const folio = docData.folio || ocNumber;
  const dept = docData.department || (docData.client?.toUpperCase().includes('GT') ? 'GT' : 'TH');

  const isTH = dept === 'TH' || (docData.client || '').toUpperCase().includes('NAVA');
  const clientName = isTH
    ? 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)'
    : 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)';

  const orderId = `oc-${ocNumber.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const orderRef = doc(db, PATHS.orders, orderId);

  const items: PurchaseOrderItem[] = (docData.items && docData.items.length > 0)
    ? docData.items.map((it, idx) => ({
        id: `item-${idx + 1}`,
        code: it.code || 'S/C',
        description: it.description || 'Bolsa de Polietileno',
        quantity: it.quantity,
        unitPrice: it.unitPrice || 43.0,
        amount: it.amount || it.quantity * (it.unitPrice || 43.0),
        unit: 'Kilos',
      }))
    : [
        {
          id: 'item-1',
          code: 'EGBO000017-SC',
          description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color',
          quantity: totalKg,
          unitPrice: 43.0,
          amount: totalKg * 43.0,
          unit: 'Kilos',
        },
      ];

  const newOrder: Record<string, any> = {
    id: orderId,
    folio,
    oc: ocNumber,
    client: clientName,
    department: dept,
    buyer: isTH ? 'JOSÉ NAVA FLORES' : 'EVELIA',
    totalKilograms: totalKg,
    status: 'pedido',
    isClosedShort: false,
    notes: `Orden de Compra registrada automáticamente desde archivo: ${docData.fileName || ocNumber}`,
    items,
    deliveries: [
      {
        id: `del-auto-${Date.now()}`,
        date: Timestamp.now(),
        kilos: totalKg,
        notes: `Entrega física registrada amparada por OC ${ocNumber} (${totalKg} kg)`,
        invoiced: false,
        docType: 'remision',
      },
    ],
    invoices: [],
    invoiceStatuses: [],
    financials: {
      salePricePerKg: 43.0,
      costPricePerKg: 38.0,
      saleTotal: docData.subtotal || fin.saleTotal,
      invoiceTotal: docData.total || fin.invoiceTotal,
      commission: fin.commission,
      costTotal: fin.costTotal,
      netCashFlow: fin.netCashFlow,
      tradeMargin: fin.tradeMargin,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(orderRef, newOrder, { merge: true });
  return orderId;
}

/**
 * Ejecuta la vinculación automática de una Factura a una Orden de Compra en Firestore.
 */
export async function executeAutoAssignInvoice(
  docData: ExtractedDocumentData,
  targetOrder: PurchaseOrder,
  config: FinancialConfig
): Promise<void> {
  const orderRef = doc(db, PATHS.orders, targetOrder.id);
  const invKilos = docData.kilos || 0;
  const fin = computeFinancials(invKilos, config);

  const newInvoice: Invoice = {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    orderId: targetOrder.id,
    folio: docData.folio || `F-${Date.now()}`,
    uuid: docData.uuid,
    kilos: invKilos,
    financials: {
      salePricePerKg: 43.0,
      costPricePerKg: 38.0,
      saleTotal: docData.subtotal || fin.saleTotal,
      invoiceTotal: docData.total || fin.invoiceTotal,
      costTotal: fin.costTotal,
      commission: fin.commission,
      netCashFlow: fin.netCashFlow,
      tradeMargin: fin.tradeMargin,
    },
    creditCycle: {
      status: 'pending',
      issueDate: docData.date ? Timestamp.fromDate(new Date(docData.date)) : Timestamp.now(),
      dueDate: docData.dueDate
        ? Timestamp.fromDate(new Date(docData.dueDate))
        : Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    collection: {
      contrareciboNumber: docData.contrarecibo || '',
    },
    items: docData.items?.map((it, idx) => ({
      id: `inv-item-${idx + 1}`,
      code: it.code || '',
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice || 43.0,
      amount: it.amount || it.quantity * (it.unitPrice || 43.0),
      unit: 'Kilos',
    })),
  };

  const newDelivery: Delivery = {
    id: `del-inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    date: newInvoice.creditCycle.issueDate || Timestamp.now(),
    kilos: invKilos,
    notes: `Entrega fiscal amparada por Factura #${newInvoice.folio} (${invKilos} kg)`,
    invoiced: true,
    invoiceId: newInvoice.id,
    docType: 'factura',
    docFolio: newInvoice.folio,
  };

  // Reemplazar si existía duplicado, o agregar nueva
  const currentInvoices = targetOrder.invoices || [];
  const existingIdx = currentInvoices.findIndex(
    (inv) =>
      (inv.folio && normalizeCode(inv.folio) === normalizeCode(newInvoice.folio)) ||
      (newInvoice.uuid && inv.uuid && inv.uuid.toLowerCase() === newInvoice.uuid.toLowerCase())
  );

  let updatedInvoices: Invoice[];
  if (existingIdx >= 0) {
    updatedInvoices = [...currentInvoices];
    updatedInvoices[existingIdx] = { ...updatedInvoices[existingIdx], ...newInvoice };
  } else {
    updatedInvoices = [...currentInvoices, newInvoice];
  }

  const updatedDeliveries = [...(targetOrder.deliveries || []), newDelivery];
  const totalInvoicedKilos = updatedInvoices.reduce((acc, inv) => acc + (inv.kilos || 0), 0);
  const isComplete = (targetOrder.totalKilograms || 0) > 0 && totalInvoicedKilos >= (targetOrder.totalKilograms || 0) - 1;

  await updateDoc(orderRef, {
    ...camposInvoices(updatedInvoices),
    deliveries: updatedDeliveries,
    status: isComplete ? 'facturado' : ((targetOrder as any).status || targetOrder.creditCycle?.status || 'pedido'),
    isClosedShort: isComplete ? true : (targetOrder.isClosedShort ?? false),
    updatedAt: Timestamp.now(),
  });
}
