import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, updateDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { parseXmlInvoice, type ParsedInvoiceData } from '../../lib/xmlParser';
import { extractTextFromPdf, extractTextFromImage, parseOcrData } from '../../lib/ocr';
import { parseProvidenciaContrareciboHtml, parseProvidenciaPaymentDetailHtml, type ParsedProvidenciaPaymentData } from '../../lib/providenciaPortalParser';
import { parseBankTransferReceipt, type ParsedBankTransfer } from '../../lib/bankReceiptParser';
import { useOrdersContext } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';
import { logAction } from '../../lib/logger';
import { findDuplicateOrderFolio } from '../../lib/duplicateGuards';

interface UniversalDocumentUploadModalProps {
  onClose: () => void;
}

type TabMode = 'upload' | 'paste';

interface ProcessedResultItem {
  id: string;
  fileName: string;
  folio: string;
  oc: string;
  kilos: number;
  total: number;
  status: 'success' | 'warning' | 'error';
  message: string;
  parsedData?: ParsedInvoiceData;
  orderId?: string;
  orderGoalKilos?: number;
  totalInvoicedKilos?: number;
  isPartial?: boolean;
  isClosedShort?: boolean;
}

function isMatchingOc(order: any, targetOc: string): boolean {
  if (!order || !targetOc) return false;
  const cleanTarget = targetOc.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const oFolio = (order.folio || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const oOc = (order.oc || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const oId = (order.id || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (oFolio.includes(cleanTarget) || cleanTarget.includes(oFolio)) return true;
  if (oOc.includes(cleanTarget) || cleanTarget.includes(oOc)) return true;
  if (oId.includes(cleanTarget) || cleanTarget.includes(oId)) return true;

  // Equivalencias canónicas Providencia
  if (cleanTarget.includes('9713') && (oFolio.includes('9713') || oOc.includes('9713') || oFolio.includes('1202643'))) return true;
  if (cleanTarget.includes('14114') && (oFolio.includes('14114') || oOc.includes('14114') || oFolio.includes('1202671'))) return true;

  return false;
}

export function UniversalDocumentUploadModal({ onClose }: UniversalDocumentUploadModalProps) {
  const [tab, setTab] = useState<TabMode>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [batchResults, setBatchResults] = useState<ProcessedResultItem[] | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [manualFallbackItem, setManualFallbackItem] = useState<ProcessedResultItem | null>(null);
  const [selectedTargetOrderId, setSelectedTargetOrderId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { orders } = useOrdersContext();
  const { user } = useAuth();
  const toast = useToast();

  // Función Central de Ingesta Atómica por Factura
  const processSingleXml = async (xmlData: ParsedInvoiceData, originName: string): Promise<ProcessedResultItem> => {
    try {
      if (xmlData.tipoComprobante === 'P' || xmlData.complementoPago) {
        return {
          id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          fileName: originName,
          folio: xmlData.folio || 'REP',
          oc: 'N/A',
          kilos: 0,
          total: xmlData.complementoPago?.montoTotal || xmlData.total || 0,
          status: 'success',
          message: 'Complemento de Pago (REP) procesado correctamente',
          parsedData: xmlData,
        };
      }

      const totalKilos = (xmlData.conceptos || []).reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);
      const receptorUpper = (xmlData.receptorNombre || '').toUpperCase();
      const condUpper = (xmlData.condicionesDePago || '').toUpperCase();
      const isTH = receptorUpper.includes('TEXTIL HOGAR') || condUpper.includes('TH') || (xmlData.ocNumber || '').includes('1202671');
      const ocTarget = xmlData.ocNumber?.trim() || '';

      const newInvoice = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        folio: xmlData.folio || 'S/N',
        uuid: xmlData.uuid,
        kilos: totalKilos,
        financials: {
          salePricePerKg: 43,
          costPricePerKg: 38,
          saleTotal: xmlData.subTotal || 0,
          invoiceTotal: xmlData.total || 0,
          costTotal: totalKilos * 38,
          commission: (xmlData.subTotal || 0) * 0.08,
          netCashFlow: ((xmlData.subTotal || 0) * 1.16) - (totalKilos * 38) - ((xmlData.subTotal || 0) * 0.08),
          tradeMargin: (xmlData.subTotal || 0) - (totalKilos * 38),
        },
        creditCycle: {
          status: 'pending' as const,
          issueDate: xmlData.fecha ? Timestamp.fromDate(new Date(xmlData.fecha)) : Timestamp.now(),
        },
      };

      // 1. Buscar coincidencia en órdenes
      const match = orders.find((o) => {
        if (!o) return false;
        if (ocTarget && isMatchingOc(o, ocTarget)) return true;
        if (xmlData.folio && (o.folio === xmlData.folio || (o.invoices || []).some((i) => i.folio === xmlData.folio))) return true;
        return false;
      });

      if (match) {
        // Verificar si la factura ya existe en esta orden
        const alreadyHas = (match.invoices || []).some(
          (inv) => inv.folio === xmlData.folio || (xmlData.uuid && inv.uuid === xmlData.uuid)
        );

        if (alreadyHas) {
          const totalInvoicedKilos = (match.invoices || []).reduce((acc: number, inv: any) => acc + Number(inv.kilos || 0), 0);
          const orderGoalKilos = Number(match.totalKilograms) || 0;
          const isPartial = orderGoalKilos > 0 && totalInvoicedKilos < orderGoalKilos - 0.05;

          return {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            fileName: originName,
            folio: xmlData.folio || 'S/F',
            oc: match.folio || match.oc || ocTarget,
            kilos: totalKilos,
            total: xmlData.total || 0,
            status: 'warning',
            message: `La factura #${xmlData.folio} ya estaba registrada en la OC ${match.folio || match.oc}`,
            parsedData: xmlData,
            orderId: match.id,
            orderGoalKilos,
            totalInvoicedKilos,
            isPartial,
            isClosedShort: match.isClosedShort ?? false,
          };
        }

        const currentDeliveries = match.deliveries || [];
        const hasDeliveryAlready = currentDeliveries.some((d: any) => 
          d.invoiceId === newInvoice.id ||
          d.notes?.includes(`Fac. #${xmlData.folio}`) || 
          d.notes?.includes(`XML #${xmlData.folio}`) ||
          d.docFolio === xmlData.folio
        );

        const updatedDeliveries = [...currentDeliveries];
        if (!hasDeliveryAlready && totalKilos > 0) {
          updatedDeliveries.push({
            id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: xmlData.fecha ? Timestamp.fromDate(new Date(xmlData.fecha)) : Timestamp.now(),
            kilos: totalKilos,
            notes: `Entrega física amparada por Factura XML #${xmlData.folio} (${totalKilos.toLocaleString('es-MX')} kg)`,
            invoiced: true,
            invoiceId: newInvoice.id,
            docType: 'factura',
            docFolio: xmlData.folio,
          });
        }

        const updatedInvoices = [...(match.invoices || []), newInvoice as any];
        const totalInvoicedKilos = updatedInvoices.reduce((acc: number, inv: any) => acc + Number(inv.kilos || 0), 0);
        const orderGoalKilos = Number(match.totalKilograms) || 0;
        const isComplete = orderGoalKilos > 0 && totalInvoicedKilos >= orderGoalKilos - 0.05;
        const isPartial = orderGoalKilos > 0 && totalInvoicedKilos < orderGoalKilos - 0.05;
        const prevStatus = (match as any).status || match.creditCycle?.status;

        await updateDoc(doc(db, PATHS.orders, match.id), {
          invoices: updatedInvoices,
          deliveries: updatedDeliveries,
          status: isComplete ? 'facturado' : (prevStatus === 'pedido' ? 'facturado' : prevStatus),
          isClosedShort: isComplete ? true : (match.isClosedShort ?? false),
        });

        await logAction(user?.email, 'Factura XML Vinculada', { orderId: match.id, folio: xmlData.folio, kilos: totalKilos });

        return {
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          fileName: originName,
          folio: xmlData.folio || 'S/F',
          oc: match.folio || match.oc || ocTarget,
          kilos: totalKilos,
          total: xmlData.total || 0,
          status: 'success',
          message: `Vinculada con éxito a OC ${match.folio || match.oc} (${totalKilos.toLocaleString('es-MX')} kg)`,
          parsedData: xmlData,
          orderId: match.id,
          orderGoalKilos,
          totalInvoicedKilos,
          isPartial,
          isClosedShort: isComplete ? true : (match.isClosedShort ?? false),
        };
      } else {
        // Crear nuevo expediente automático
        const dup = findDuplicateOrderFolio(orders, xmlData.folio || ocTarget || 'S/N');
        if (dup && !ocTarget) {
          return {
            id: `err-${Date.now()}`,
            fileName: originName,
            folio: xmlData.folio || 'S/F',
            oc: ocTarget || 'Sin OC',
            kilos: totalKilos,
            total: xmlData.total || 0,
            status: 'error',
            message: `Ya existe un expediente con el folio ${xmlData.folio}`,
            parsedData: xmlData,
          };
        }

        const docRef = await addDoc(collection(db, PATHS.orders), {
          folio: ocTarget || `FAC-${xmlData.folio || 'NUEVA'}`,
          client: isTH ? 'TEXTIL HOGAR (TH - NAVA)' : 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
          department: isTH ? 'TH' : 'GT',
          totalKilograms: totalKilos,
          status: 'facturado',
          isClosedShort: true,
          notes: `Generado automáticamente desde factura XML #${xmlData.folio} (${xmlData.condicionesDePago || ''})`,
          invoices: [newInvoice],
          deliveries: [
            {
              id: `del-${Date.now()}`,
              date: xmlData.fecha ? Timestamp.fromDate(new Date(xmlData.fecha)) : Timestamp.now(),
              kilos: totalKilos,
              notes: `Entrega fiscal amparada por Factura #${xmlData.folio}`,
              invoiced: true,
              invoiceId: newInvoice.id,
              docType: 'factura',
              docFolio: xmlData.folio,
            },
          ],
          items: (xmlData.conceptos || []).map((c: any, idx: number) => ({
            id: `item-${idx + 1}`,
            code: c.claveProdServ || c.codigo || 'S/C',
            description: c.descripcion || 'Bolsa de Polietileno',
            quantity: Number(c.cantidad) || 0,
            price: Number(c.valorUnitario) || 43,
          })),
          processedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        await logAction(user?.email, 'Orden Creada desde XML', { folio: xmlData.folio, oc: ocTarget });

        return {
          id: `new-${Date.now()}`,
          fileName: originName,
          folio: xmlData.folio || 'S/F',
          oc: ocTarget || `FAC-${xmlData.folio || 'NUEVA'}`,
          kilos: totalKilos,
          total: xmlData.total || 0,
          status: 'success',
          message: `Nuevo expediente creado y factura vinculada (${totalKilos.toLocaleString('es-MX')} kg)`,
          parsedData: xmlData,
          orderId: docRef.id,
          orderGoalKilos: totalKilos,
          totalInvoicedKilos: totalKilos,
          isPartial: false,
          isClosedShort: true,
        };
      }
    } catch (err: any) {
      return {
        id: `err-${Date.now()}`,
        fileName: originName,
        folio: xmlData?.folio || 'Error',
        oc: xmlData?.ocNumber || 'N/A',
        kilos: 0,
        total: xmlData?.total || 0,
        status: 'error',
        message: err.message || 'Error al procesar archivo XML',
        parsedData: xmlData,
      };
    }
  };

  // Procesador Oficial de Detalle de Pagos de Providencia
  const processSingleProvidenciaPayment = async (payment: ParsedProvidenciaPaymentData, sourceName: string): Promise<ProcessedResultItem> => {
    const parseDateParts = (dStr?: string) => {
      if (!dStr) return null;
      const p = dStr.split('/');
      if (p.length === 3) return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
      return null;
    };
    const payDate = parseDateParts(payment.paymentDate);
    const payTs = payDate ? Timestamp.fromDate(payDate) : Timestamp.now();

    // 1. Buscar orden correspondiente por número de CR, folio de factura o folio de OC
    let targetOrder: any = null;
    let targetInvoiceIndex = -1;

    for (const o of orders) {
      if (!o || (o as any).isDeleted) continue;
      const invs = o.invoices || [];
      const idx = invs.findIndex((inv: any) => {
        if (payment.contrareciboNumber && (inv.collection?.contrareciboNumber === payment.contrareciboNumber || inv.folio === payment.contrareciboNumber)) return true;
        if (payment.facturaFolio && (inv.folio === payment.facturaFolio || inv.id === payment.facturaFolio)) return true;
        if (payment.amount > 0 && Math.abs((inv.financials?.invoiceTotal || 0) - payment.amount) < 1) return true;
        return false;
      });
      if (idx !== -1) {
        targetOrder = o;
        targetInvoiceIndex = idx;
        break;
      }
      if (payment.contrareciboNumber && (o.folio === payment.contrareciboNumber || o.oc === payment.contrareciboNumber || o.collection?.contrareciboNumber === payment.contrareciboNumber)) {
        targetOrder = o;
        targetInvoiceIndex = 0;
        break;
      }
    }

    if (targetOrder) {
      const updatedInvoices = [...(targetOrder.invoices || [])];
      if (targetInvoiceIndex !== -1 && updatedInvoices[targetInvoiceIndex]) {
        const inv = updatedInvoices[targetInvoiceIndex];
        inv.collection = {
          ...(inv.collection || {}),
          contrareciboNumber: payment.contrareciboNumber || inv.collection?.contrareciboNumber,
          paidAmount: payment.amount,
          paidAt: payTs,
          collectedAt: payTs,
          bank: payment.bancoAbono,
          transferRef: payment.transferRef,
          notes: payment.observaciones,
        };
        inv.creditCycle = {
          ...(inv.creditCycle || {}),
          status: 'collected',
          dueDate: inv.creditCycle?.dueDate || payTs,
        };
      }

      await updateDoc(doc(db, PATHS.orders, targetOrder.id), {
        invoices: updatedInvoices,
        'collection.paidAmount': payment.amount,
        'collection.paidAt': payTs,
        'collection.bank': payment.bancoAbono,
        'collection.transferRef': payment.transferRef,
        'collection.contrareciboNumber': payment.contrareciboNumber || targetOrder.collection?.contrareciboNumber,
        'creditCycle.status': 'collected',
        status: 'collected',
        updatedAt: serverTimestamp(),
      });

      await logAction(user?.email, 'Pago Providencia Registrado', {
        orderId: targetOrder.id,
        cr: payment.contrareciboNumber,
        amount: payment.amount,
        ref: payment.transferRef,
      });

      return {
        id: `pay-${Date.now()}-${payment.contrareciboNumber}`,
        fileName: sourceName,
        folio: payment.facturaFolio ? `F-#${payment.facturaFolio}` : payment.contrareciboNumber,
        oc: targetOrder.folio || targetOrder.oc || payment.contrareciboNumber,
        kilos: 0,
        total: payment.amount,
        status: 'success',
        message: `Pago registrado: CR ${payment.contrareciboNumber} por ${money(payment.amount)} (Ref: ${payment.transferRef || 'S/R'} · Banco: ${payment.bancoAbono || 'BAJIO'} · ${payment.observaciones || ''})`,
        orderId: targetOrder.id,
      };
    } else {
      // Crear expediente nuevo oficial de CR Pagado
      const newId = `cr-${payment.contrareciboNumber.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const kilosEst = Math.round(payment.amount / (43 * 1.16));
      const paidDoc: any = {
        id: newId,
        folio: payment.contrareciboNumber,
        oc: payment.contrareciboNumber,
        client: payment.department === 'TH' ? 'TEXTIL HOGAR (TH - NAVA)' : 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
        department: payment.department,
        totalKilograms: kilosEst,
        invoices: [
          {
            id: `inv-${payment.contrareciboNumber.toLowerCase()}`,
            orderId: newId,
            folio: payment.facturaFolio || payment.contrareciboNumber,
            kilos: kilosEst,
            creditCycle: {
              status: 'collected',
              issueDate: payTs,
              dueDate: payTs,
            },
            collection: {
              contrareciboNumber: payment.contrareciboNumber,
              contrareciboDate: payTs,
              paidAmount: payment.amount,
              paidAt: payTs,
              collectedAt: payTs,
              bank: payment.bancoAbono,
              transferRef: payment.transferRef,
              notes: payment.observaciones,
            },
            financials: {
              invoiceTotal: payment.amount,
              saleTotal: Number((payment.amount / 1.16).toFixed(2)),
              costTotal: Number((kilosEst * 38).toFixed(2)),
              commission: Number(((payment.amount / 1.16) * 0.08).toFixed(2)),
              netCashFlow: Number(((payment.amount / 1.16) * 1.08 - (kilosEst * 38)).toFixed(2)),
              salePricePerKg: 43,
              costPricePerKg: 38,
            },
          }
        ],
        invoiceStatuses: ['collected'],
        invoiceFolios: [payment.facturaFolio || payment.contrareciboNumber],
        collection: {
          contrareciboNumber: payment.contrareciboNumber,
          contrareciboDate: payTs,
          paidAmount: payment.amount,
          paidAt: payTs,
          collectedAt: payTs,
          bank: payment.bancoAbono,
          transferRef: payment.transferRef,
          notes: payment.observaciones,
        },
        creditCycle: {
          status: 'collected',
          issueDate: payTs,
          dueDate: payTs,
        },
        status: 'collected',
        createdAt: payTs,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, PATHS.orders, newId), paidDoc).catch(async () => {
        await addDoc(collection(db, PATHS.orders), paidDoc);
      });

      return {
        id: `pay-new-${Date.now()}`,
        fileName: sourceName,
        folio: payment.contrareciboNumber,
        oc: payment.contrareciboNumber,
        kilos: kilosEst,
        total: payment.amount,
        status: 'success',
        message: `Expediente de pago oficial creado para CR ${payment.contrareciboNumber} por ${money(payment.amount)} (100% cobrado)`,
        orderId: newId,
      };
    }
  };

  // Procesador Oficial de Comprobantes Bancarios SPEI (BBVA Net Cash, BanBajío, Santander, Banorte)
  const processSingleBankTransfer = async (transfer: ParsedBankTransfer, sourceName: string): Promise<ProcessedResultItem> => {
    const parseDateParts = (dStr?: string) => {
      if (!dStr) return null;
      const p = dStr.split('/');
      if (p.length === 3) return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
      return null;
    };
    const payDate = parseDateParts(transfer.paymentDate);
    const payTs = payDate ? Timestamp.fromDate(payDate) : Timestamp.now();

    // 1. Buscar orden correspondiente por Importe exacto, Folio de firma o Clave de rastreo
    let targetOrder: any = null;
    let targetInvoiceIndex = -1;

    for (const o of orders) {
      if (!o || (o as any).isDeleted) continue;
      const invs = o.invoices || [];
      const idx = invs.findIndex((inv: any) => {
        if (transfer.amount > 0 && Math.abs((inv.financials?.invoiceTotal || 0) - transfer.amount) < 1) return true;
        if (transfer.folioFirma && (inv.collection?.transferRef === transfer.folioFirma || inv.folio === transfer.folioFirma)) return true;
        return false;
      });
      if (idx !== -1) {
        targetOrder = o;
        targetInvoiceIndex = idx;
        break;
      }
      const orderTotal = (o.invoices || []).reduce((s: number, i: any) => s + (i.financials?.invoiceTotal || 0), 0);
      if (transfer.amount > 0 && Math.abs(orderTotal - transfer.amount) < 1) {
        targetOrder = o;
        targetInvoiceIndex = 0;
        break;
      }
    }

    if (targetOrder) {
      const updatedInvoices = [...(targetOrder.invoices || [])];
      if (targetInvoiceIndex !== -1 && updatedInvoices[targetInvoiceIndex]) {
        const inv = updatedInvoices[targetInvoiceIndex];
        inv.collection = {
          ...(inv.collection || {}),
          paidAmount: transfer.amount,
          paidAt: payTs,
          collectedAt: payTs,
          bank: transfer.bankDest,
          transferRef: transfer.folioFirma || transfer.claveRastreo,
          claveRastreo: transfer.claveRastreo,
          notes: `Transferencia ${transfer.bankSource} Net Cash (Ref: ${transfer.folioFirma || ''} · Rastreo: ${transfer.claveRastreo || ''})`,
        };
        inv.creditCycle = {
          ...(inv.creditCycle || {}),
          status: 'collected',
          dueDate: inv.creditCycle?.dueDate || payTs,
        };
      }

      await updateDoc(doc(db, PATHS.orders, targetOrder.id), {
        invoices: updatedInvoices,
        'collection.paidAmount': transfer.amount,
        'collection.paidAt': payTs,
        'collection.bank': transfer.bankDest,
        'collection.transferRef': transfer.folioFirma || transfer.claveRastreo,
        'collection.claveRastreo': transfer.claveRastreo,
        'creditCycle.status': 'collected',
        status: 'collected',
        updatedAt: serverTimestamp(),
      });

      await logAction(user?.email, 'Comprobante Bancario SPEI Vinculado', {
        orderId: targetOrder.id,
        amount: transfer.amount,
        claveRastreo: transfer.claveRastreo,
        folioFirma: transfer.folioFirma,
      });

      return {
        id: `spei-${Date.now()}-${transfer.folioFirma || 'ref'}`,
        fileName: sourceName,
        folio: targetOrder.folio || targetOrder.oc || 'PAGO SPEI',
        oc: targetOrder.folio || targetOrder.oc || 'PAGO',
        kilos: 0,
        total: transfer.amount,
        status: 'success',
        message: `Comprobante ${transfer.bankSource} Net Cash por ${money(transfer.amount)} vinculado a expediente ${targetOrder.folio || targetOrder.oc} (Clave Rastreo: ${transfer.claveRastreo || 'S/C'} · Ref: ${transfer.folioFirma || 'S/R'})`,
        orderId: targetOrder.id,
      };
    } else {
      // Crear expediente nuevo oficial de Transferencia Cobrada
      const newId = `pay-spei-${Date.now()}`;
      const kilosEst = Math.round(transfer.amount / (43 * 1.16));
      const paidDoc: any = {
        id: newId,
        folio: transfer.folioFirma ? `SPEI-${transfer.folioFirma}` : `SPEI-${transfer.amount}`,
        oc: `SPEI-${transfer.claveRastreo?.substring(0, 10) || transfer.folioFirma || 'PAGO'}`,
        client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
        department: 'GT',
        totalKilograms: kilosEst,
        invoices: [
          {
            id: `inv-${newId}`,
            orderId: newId,
            folio: transfer.folioFirma || 'SPEI',
            kilos: kilosEst,
            creditCycle: {
              status: 'collected',
              issueDate: payTs,
              dueDate: payTs,
            },
            collection: {
              contrareciboNumber: '',
              contrareciboDate: payTs,
              paidAmount: transfer.amount,
              paidAt: payTs,
              collectedAt: payTs,
              bank: transfer.bankDest,
              transferRef: transfer.folioFirma || transfer.claveRastreo,
              claveRastreo: transfer.claveRastreo,
              notes: `Pago Interbancario ${transfer.bankSource} Net Cash (Rastreo: ${transfer.claveRastreo || ''})`,
            },
            financials: {
              invoiceTotal: transfer.amount,
              saleTotal: Number((transfer.amount / 1.16).toFixed(2)),
              costTotal: Number((kilosEst * 38).toFixed(2)),
              commission: Number(((transfer.amount / 1.16) * 0.08).toFixed(2)),
              netCashFlow: Number(((transfer.amount / 1.16) * 1.08 - (kilosEst * 38)).toFixed(2)),
              salePricePerKg: 43,
              costPricePerKg: 38,
            },
          }
        ],
        invoiceStatuses: ['collected'],
        invoiceFolios: [transfer.folioFirma || 'SPEI'],
        collection: {
          contrareciboNumber: '',
          contrareciboDate: payTs,
          paidAmount: transfer.amount,
          paidAt: payTs,
          collectedAt: payTs,
          bank: transfer.bankDest,
          transferRef: transfer.folioFirma || transfer.claveRastreo,
          claveRastreo: transfer.claveRastreo,
          notes: `Pago Interbancario ${transfer.bankSource} Net Cash`,
        },
        creditCycle: {
          status: 'collected',
          issueDate: payTs,
          dueDate: payTs,
        },
        status: 'collected',
        createdAt: payTs,
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, PATHS.orders), paidDoc);

      return {
        id: `spei-new-${Date.now()}`,
        fileName: sourceName,
        folio: transfer.folioFirma || 'PAGO SPEI',
        oc: 'PAGO BBVA',
        kilos: kilosEst,
        total: transfer.amount,
        status: 'success',
        message: `Comprobante ${transfer.bankSource} Net Cash por ${money(transfer.amount)} registrado con éxito (100% cobrado)`,
      };
    }
  };

  // Manejo de Múltiples Archivos Arrastrados o Subidos (XML, HTML, PDF, Imágenes)
  const handleFiles = async (fileList: FileList | File[]) => {
    triggerHaptic('light');
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setProcessing(true);
    const results: ProcessedResultItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.toLowerCase().split('.').pop() || '';
      setProgressMsg(`Procesando archivo ${i + 1} de ${files.length} (${file.name})...`);

      if (ext === 'xml') {
        try {
          const text = await file.text();
          const xmlData = parseXmlInvoice(text);
          const res = await processSingleXml(xmlData, file.name);
          results.push(res);
        } catch (e: any) {
          results.push({
            id: `err-${Date.now()}-${i}`,
            fileName: file.name,
            folio: 'Error XML',
            oc: 'N/A',
            kilos: 0,
            total: 0,
            status: 'error',
            message: e.message || 'El XML no es un CFDI SAT válido.',
          });
        }
      } else if (ext === 'html' || ext === 'htm') {
        try {
          const text = await file.text();
          const payment = parseProvidenciaPaymentDetailHtml(text);
          if (payment) {
            const res = await processSingleProvidenciaPayment(payment, file.name);
            results.push(res);
          } else {
            const parsedCrs = parseProvidenciaContrareciboHtml(text);
            if (parsedCrs.length > 0) {
              for (const cr of parsedCrs) {
                results.push({
                  id: `cr-${Date.now()}-${cr.contrareciboNumber}`,
                  fileName: file.name,
                  folio: cr.facturaFolio || cr.contrareciboNumber,
                  oc: cr.contrareciboNumber,
                  kilos: 0,
                  total: cr.importe,
                  status: 'success',
                  message: `Contrarecibo ${cr.contrareciboNumber} importado desde HTML ($${cr.importe.toLocaleString('es-MX', { minimumFractionDigits: 2 })})`,
                });
              }
            } else {
              throw new Error('No se detectaron datos de pago ni contrarecibos en el archivo HTML');
            }
          }
        } catch (e: any) {
          results.push({
            id: `err-${Date.now()}-${i}`,
            fileName: file.name,
            folio: 'Error HTML',
            oc: 'N/A',
            kilos: 0,
            total: 0,
            status: 'error',
            message: e.message || 'Error al procesar archivo HTML de Providencia.',
          });
        }
      } else if (ext === 'pdf') {
        try {
          const text = await extractTextFromPdf(file);
          
          // 1. Detectar si es un comprobante de transferencia bancaria (BBVA Net Cash / SPEI / CEP)
          const bankTransfer = parseBankTransferReceipt(text);
          if (bankTransfer) {
            const res = await processSingleBankTransfer(bankTransfer, file.name);
            results.push(res);
            continue;
          }

          const ocr = parseOcrData(text);
          const folio = ocr.folio || file.name.replace('.pdf', '');
          const kilosVal = ocr.kilos || 0;
          const totalVal = ocr.total || (kilosVal * 43 * 1.16);
          const isFiscalInvoice = Boolean(ocr.uuid || (ocr.folio && ocr.total && ocr.total > 0));

          if (isFiscalInvoice) {
            const parsedInvoiceFromPdf: ParsedInvoiceData = {
              folio: ocr.folio || 'S/F',
              uuid: ocr.uuid || '',
              ocNumber: ocr.ocNumber || '',
              fecha: ocr.fecha || new Date().toISOString(),
              subTotal: ocr.subTotal || (ocr.kilos ? ocr.kilos * 43 : 0),
              total: ocr.total || (ocr.kilos ? ocr.kilos * 43 * 1.16 : 0),
              emisorRfc: ocr.emisorRfc || 'EDE1902136T2',
              emisorNombre: ocr.emisorNombre || 'ELEMENTAL DENIM',
              receptorRfc: ocr.receptorRfc || 'GTP930115PU1',
              receptorNombre: ocr.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
              condicionesDePago: ocr.ocNumber ? `OC ${ocr.ocNumber}` : '',
              conceptos: ocr.conceptos || [{
                codigo: 'S/C',
                descripcion: ocr.product || 'Bolsa de Polietileno',
                cantidad: kilosVal,
                valorUnitario: 43,
                importe: kilosVal * 43,
              }],
            };
            const res = await processSingleXml(parsedInvoiceFromPdf, file.name);
            results.push(res);
          } else {
            // Documento de remisión o báscula
            const match = orders.find((o) => {
              if (!o) return false;
              if (ocr.ocNumber && isMatchingOc(o, ocr.ocNumber)) return true;
              if (ocr.folio && isMatchingOc(o, ocr.folio)) return true;
              if (file.name && isMatchingOc(o, file.name)) return true;
              return false;
            });

            if (match) {
              const currentDeliveries = match.deliveries || [];
              const newDelivery = {
                id: `del-pdf-${Date.now()}-${i}`,
                date: Timestamp.now(),
                kilos: kilosVal,
                notes: `Entrega amparada por documento PDF ${file.name} (${ocr.product || 'Bolsa de Polietileno'})`,
                invoiced: false,
                docType: 'remision',
                docFolio: folio,
              };
              await updateDoc(doc(db, PATHS.orders, match.id), {
                deliveries: [...currentDeliveries, newDelivery],
              });

              results.push({
                id: `pdf-${Date.now()}-${i}`,
                fileName: file.name,
                folio: folio,
                oc: match.folio || match.oc || 'OC',
                kilos: kilosVal,
                total: totalVal,
                status: 'success',
                message: `Documento PDF procesado y vinculado a OC ${match.folio || match.oc} (${kilosVal.toLocaleString('es-MX')} kg)`,
                orderId: match.id,
              });
            } else {
              results.push({
                id: `pdf-${Date.now()}-${i}`,
                fileName: file.name,
                folio: folio,
                oc: ocr.ocNumber || 'Sin OC',
                kilos: kilosVal,
                total: totalVal,
                status: 'warning',
                message: `Documento PDF analizado (${kilosVal > 0 ? `${kilosVal.toLocaleString('es-MX')} kg` : 'sin kilos detectados'}). Listo para asignar.`,
                parsedData: {
                  folio: folio,
                  uuid: ocr.uuid || '',
                  ocNumber: ocr.ocNumber || ocr.folio,
                  fecha: new Date().toISOString(),
                  subTotal: ocr.subTotal || (kilosVal * 43),
                  total: totalVal,
                  emisorRfc: 'EDE1902136T2',
                  emisorNombre: 'ELEMENTAL DENIM',
                  receptorRfc: 'GTP930115PU1',
                  receptorNombre: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
                  conceptos: ocr.conceptos || [{
                    codigo: 'S/C',
                    descripcion: ocr.product || 'Bolsa de Polietileno',
                    cantidad: kilosVal,
                    valorUnitario: 43,
                    importe: kilosVal * 43,
                  }],
                },
              });
            }
          }
        } catch (e: any) {
          results.push({
            id: `err-${Date.now()}-${i}`,
            fileName: file.name,
            folio: 'Error PDF',
            oc: 'N/A',
            kilos: 0,
            total: 0,
            status: 'error',
            message: e.message || 'No se pudo extraer texto del PDF.',
          });
        }
      } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/')) {
        try {
          setProgressMsg(`Escaneando foto / comprobante ${i + 1} con IA OCR (${file.name})...`);
          const text = await extractTextFromImage(file);
          
          // 1. Detectar si es foto o captura de transferencia bancaria (BBVA Net Cash / SPEI / CEP)
          const bankTransfer = parseBankTransferReceipt(text);
          if (bankTransfer) {
            const res = await processSingleBankTransfer(bankTransfer, file.name);
            results.push(res);
            continue;
          }

          const ocr = parseOcrData(text);
          const folio = ocr.folio || file.name.replace(/\.[^/.]+$/, '');
          const kilosVal = ocr.kilos || 0;
          const totalVal = ocr.total || (kilosVal * 43 * 1.16);
          const isFiscalInvoice = Boolean(ocr.uuid || (ocr.folio && ocr.total && ocr.total > 0));

          if (isFiscalInvoice) {
            const parsedInvoiceFromPdf: ParsedInvoiceData = {
              folio: ocr.folio || 'S/F',
              uuid: ocr.uuid || '',
              ocNumber: ocr.ocNumber || '',
              fecha: ocr.fecha || new Date().toISOString(),
              subTotal: ocr.subTotal || (ocr.kilos ? ocr.kilos * 43 : 0),
              total: ocr.total || (ocr.kilos ? ocr.kilos * 43 * 1.16 : 0),
              emisorRfc: ocr.emisorRfc || 'EDE1902136T2',
              emisorNombre: ocr.emisorNombre || 'ELEMENTAL DENIM',
              receptorRfc: ocr.receptorRfc || 'GTP930115PU1',
              receptorNombre: ocr.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
              condicionesDePago: ocr.ocNumber ? `OC ${ocr.ocNumber}` : '',
              conceptos: ocr.conceptos || [{
                codigo: 'S/C',
                descripcion: ocr.product || 'Bolsa de Polietileno',
                cantidad: kilosVal,
                valorUnitario: 43,
                importe: kilosVal * 43,
              }],
            };
            const res = await processSingleXml(parsedInvoiceFromPdf, file.name);
            results.push(res);
          } else {
            // Remisión física o foto de báscula
            const match = orders.find((o) => {
              if (!o) return false;
              if (ocr.ocNumber && isMatchingOc(o, ocr.ocNumber)) return true;
              if (ocr.folio && isMatchingOc(o, ocr.folio)) return true;
              if (file.name && isMatchingOc(o, file.name)) return true;
              return false;
            });

            if (match) {
              const currentDeliveries = match.deliveries || [];
              const newDelivery = {
                id: `del-img-${Date.now()}-${i}`,
                date: Timestamp.now(),
                kilos: kilosVal,
                notes: `Entrega física amparada por foto ${file.name} (${ocr.product || 'Bolsa de Polietileno'})`,
                invoiced: false,
                docType: 'remision',
                docFolio: folio,
              };
              await updateDoc(doc(db, PATHS.orders, match.id), {
                deliveries: [...currentDeliveries, newDelivery],
              });

              results.push({
                id: `img-${Date.now()}-${i}`,
                fileName: file.name,
                folio: folio,
                oc: match.folio || match.oc || 'OC',
                kilos: kilosVal,
                total: totalVal,
                status: 'success',
                message: `Foto de remisión analizada y vinculada a OC ${match.folio || match.oc} (${kilosVal.toLocaleString('es-MX')} kg)`,
                orderId: match.id,
              });
            } else {
              results.push({
                id: `img-${Date.now()}-${i}`,
                fileName: file.name,
                folio: folio,
                oc: ocr.ocNumber || 'Sin OC',
                kilos: kilosVal,
                total: totalVal,
                status: 'warning',
                message: `Foto analizada (${kilosVal > 0 ? `${kilosVal.toLocaleString('es-MX')} kg` : 'sin kilos detectados'}). Listo para asignar.`,
                parsedData: {
                  folio: folio,
                  uuid: ocr.uuid || '',
                  ocNumber: ocr.ocNumber || ocr.folio,
                  fecha: new Date().toISOString(),
                  subTotal: ocr.subTotal || (kilosVal * 43),
                  total: totalVal,
                  emisorRfc: 'EDE1902136T2',
                  emisorNombre: 'ELEMENTAL DENIM',
                  receptorRfc: 'GTP930115PU1',
                  receptorNombre: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
                  conceptos: ocr.conceptos || [{
                    codigo: 'S/C',
                    descripcion: ocr.product || 'Bolsa de Polietileno',
                    cantidad: kilosVal,
                    valorUnitario: 43,
                    importe: kilosVal * 43,
                  }],
                },
              });
            }
          }
        } catch (e: any) {
          results.push({
            id: `err-${Date.now()}-${i}`,
            fileName: file.name,
            folio: 'Error Imagen',
            oc: 'N/A',
            kilos: 0,
            total: 0,
            status: 'error',
            message: e.message || 'No se pudo extraer texto de la imagen.',
          });
        }
      } else {
        results.push({
          id: `other-${Date.now()}-${i}`,
          fileName: file.name,
          folio: 'Archivo adjunto',
          oc: 'N/A',
          kilos: 0,
          total: 0,
          status: 'warning',
          message: 'Documento recibido. Usa el botón Asignar para vincularlo a un expediente.',
        });
      }
    }

    setProcessing(false);
    setProgressMsg('');
    setBatchResults(results);

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    if (errorCount === 0 && successCount > 0) {
      triggerHaptic('success');
      toast(`✅ Se procesaron exitosamente ${successCount} documento(s)`, 'ok');
    } else {
      triggerHaptic('warning');
      toast(`⚠️ Procesados ${results.length} archivos (revisa los detalles marcados)`, 'info');
    }
  };

  // Manejo de Pegado Directo Inteligente (XML, Detalle de Pago, Contrarecibos o Remisiones)
  const handlePasteChange = async (text: string) => {
    setPastedText(text);
    if (!text.trim()) return;

    // 1. Detección de Comprobante Bancario SPEI (BBVA Net Cash / Transferencia)
    const bankTransfer = parseBankTransferReceipt(text);
    if (bankTransfer) {
      try {
        setProcessing(true);
        setProgressMsg(`Procesando Comprobante ${bankTransfer.bankSource} Net Cash por ${money(bankTransfer.amount)}...`);
        const res = await processSingleBankTransfer(bankTransfer, 'Comprobante Bancario Pegado');
        setBatchResults([res]);
        triggerHaptic('success');
        toast(`✅ Comprobante ${bankTransfer.bankSource} por ${money(bankTransfer.amount)} registrado con éxito`, 'ok');
      } catch (e: any) {
        toast(e.message || 'Error al procesar comprobante bancario', 'bad');
      } finally {
        setProcessing(false);
        setProgressMsg('');
      }
      return;
    }

    // 2. Detección de Detalle de Pago Oficial de Providencia
    const payment = parseProvidenciaPaymentDetailHtml(text);
    if (payment) {
      try {
        setProcessing(true);
        setProgressMsg(`Procesando Detalle de Pago para CR ${payment.contrareciboNumber}...`);
        const res = await processSingleProvidenciaPayment(payment, 'Detalle Pago Providencia');
        setBatchResults([res]);
        triggerHaptic('success');
        toast(`✅ Pago de CR ${payment.contrareciboNumber} por ${money(payment.amount)} registrado con éxito`, 'ok');
      } catch (e: any) {
        toast(e.message || 'Error al procesar pago de Providencia', 'bad');
      } finally {
        setProcessing(false);
        setProgressMsg('');
      }
      return;
    }

    if (text.includes('<?xml') || text.includes('<cfdi:Comprobante') || text.includes('<cfdi:')) {
      try {
        setProcessing(true);
        setProgressMsg('Procesando XML pegado al instante...');
        const xmlData = parseXmlInvoice(text);
        const res = await processSingleXml(xmlData, 'XML Pegado Directo');
        setBatchResults([res]);
        triggerHaptic(res.status === 'error' ? 'error' : 'success');
        toast(res.status === 'error' ? res.message : `✅ Factura #${res.folio} procesada al instante`, res.status === 'error' ? 'bad' : 'ok');
      } catch (e: any) {
        toast(e.message || 'Error al procesar XML pegado', 'bad');
      } finally {
        setProcessing(false);
        setProgressMsg('');
      }
    } else if (text.includes('textgral_cr') || text.includes('mundoprovidencia') || text.includes('CONTRA RECIBO') || text.includes('Contrarecibo') || text.match(/\b(TH|GT)-[0-9]+\b/)) {
      try {
        setProcessing(true);
        setProgressMsg('Analizando Contrarecibos del Portal de Providencia...');
        const parsedCrs = parseProvidenciaContrareciboHtml(text);
        if (parsedCrs.length === 0) throw new Error('No se detectaron folios de Contrarecibo en el texto.');

        const results: ProcessedResultItem[] = [];

        for (const cr of parsedCrs) {
          // Buscar orden y factura correspondiente
          let targetOrder: any = null;
          let targetInvoiceIndex = -1;

          for (const o of orders) {
            if (!o || (o as any).isDeleted) continue;
            const invs = o.invoices || [];
            const idx = invs.findIndex((inv: any) => {
              if (cr.facturaFolio && (inv.folio === cr.facturaFolio || inv.id === cr.facturaFolio)) return true;
              if (cr.importe > 0 && Math.abs((inv.financials?.invoiceTotal || 0) - cr.importe) < 1) return true;
              return false;
            });
            if (idx !== -1) {
              targetOrder = o;
              targetInvoiceIndex = idx;
              break;
            }
          }

          if (targetOrder && targetInvoiceIndex !== -1) {
            const updatedInvoices = [...targetOrder.invoices];
            const inv = updatedInvoices[targetInvoiceIndex];

            // Parsear fechas
            const parseDateParts = (dStr?: string) => {
              if (!dStr) return null;
              const p = dStr.split('/');
              if (p.length === 3) return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
              return null;
            };

            const recDate = parseDateParts(cr.fechaRecepcion);
            const dueDate = parseDateParts(cr.fechaPago);

            inv.collection = {
              ...(inv.collection || {}),
              contrareciboNumber: cr.contrareciboNumber,
              contrareciboDate: recDate ? Timestamp.fromDate(recDate) : Timestamp.now(),
            };
            inv.creditCycle = {
              ...(inv.creditCycle || {}),
              status: 'pending',
              dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
            };

            await updateDoc(doc(db, PATHS.orders, targetOrder.id), {
              invoices: updatedInvoices,
            });

            results.push({
              id: `cr-${Date.now()}-${cr.contrareciboNumber}`,
              fileName: 'Portal Providencia',
              folio: inv.folio || cr.facturaFolio || 'S/F',
              oc: targetOrder.folio || targetOrder.oc || 'OC',
              kilos: inv.kilos || 0,
              total: cr.importe || inv.financials?.invoiceTotal || 0,
              status: 'success',
              message: `Contrarecibo ${cr.contrareciboNumber} asignado a Factura #${inv.folio} (Vence: ${cr.fechaPago || '30 días'})`,
              orderId: targetOrder.id,
            });
          } else {
            results.push({
              id: `cr-warn-${Date.now()}-${cr.contrareciboNumber}`,
              fileName: 'Portal Providencia',
              folio: cr.facturaFolio || 'S/F',
              oc: cr.contrareciboNumber,
              kilos: 0,
              total: cr.importe,
              status: 'warning',
              message: `Contrarecibo ${cr.contrareciboNumber} detectado ($${cr.importe.toLocaleString('es-MX', { minimumFractionDigits: 2 })}). Asigna la factura.`,
            });
          }
        }

        setBatchResults(results);
        const successCount = results.filter(r => r.status === 'success').length;
        triggerHaptic(successCount > 0 ? 'success' : 'warning');
        toast(`✅ Se procesaron ${results.length} Contrarecibo(s) de Providencia (${successCount} asignados al instante)`, 'ok');
      } catch (e: any) {
        toast(e.message || 'Error al procesar Contrarecibos pegados', 'bad');
      } finally {
        setProcessing(false);
        setProgressMsg('');
      }
    } else {
      try {
        setProcessing(true);
        setProgressMsg('Analizando texto / remisión pegada...');
        const ocr = parseOcrData(text);
        const kilosVal = ocr.kilos || 0;
        const totalVal = ocr.total || kilosVal * 43 * 1.16;
        const folio = ocr.folio || 'REM-PEGADA';
        const isFiscalInvoice = Boolean(ocr.uuid || (ocr.folio && ocr.total && ocr.total > 0));

        if (isFiscalInvoice) {
          const parsedInvoiceFromPdf: ParsedInvoiceData = {
            folio: ocr.folio || 'S/F',
            uuid: ocr.uuid || '',
            ocNumber: ocr.ocNumber || '',
            fecha: ocr.fecha || new Date().toISOString(),
            subTotal: ocr.subTotal || (ocr.kilos ? ocr.kilos * 43 : 0),
            total: ocr.total || (ocr.kilos ? ocr.kilos * 43 * 1.16 : 0),
            emisorRfc: ocr.emisorRfc || 'EDE1902136T2',
            emisorNombre: ocr.emisorNombre || 'ELEMENTAL DENIM',
            receptorRfc: ocr.receptorRfc || 'GTP930115PU1',
            receptorNombre: ocr.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            condicionesDePago: ocr.ocNumber ? `OC ${ocr.ocNumber}` : '',
            conceptos: ocr.conceptos || [{
              codigo: 'S/C',
              descripcion: ocr.product || 'Bolsa de Polietileno',
              cantidad: kilosVal,
              valorUnitario: 43,
              importe: kilosVal * 43,
            }],
          };
          const res = await processSingleXml(parsedInvoiceFromPdf, 'Texto Fiscal Pegado');
          setBatchResults([res]);
          triggerHaptic(res.status === 'error' ? 'error' : 'success');
          toast(res.status === 'error' ? res.message : `✅ Factura #${res.folio} vinculada a OC ${res.oc}`, res.status === 'error' ? 'bad' : 'ok');
        } else {
          const match = orders.find((o) => {
            if (!o) return false;
            if (ocr.ocNumber && isMatchingOc(o, ocr.ocNumber)) return true;
            if (ocr.folio && isMatchingOc(o, ocr.folio)) return true;
            return false;
          });

          if (match) {
            const currentDeliveries = match.deliveries || [];
            await updateDoc(doc(db, PATHS.orders, match.id), {
              deliveries: [...currentDeliveries, {
                id: `del-txt-${Date.now()}`,
                date: Timestamp.now(),
                kilos: kilosVal,
                notes: `Entrega registrada desde texto pegado: ${text.slice(0, 100)}`,
                invoiced: false,
                docType: 'remision',
                docFolio: folio,
              }],
            });
            const res: ProcessedResultItem = {
              id: `txt-${Date.now()}`,
              fileName: 'Texto Pegado',
              folio: folio,
              oc: match.folio || match.oc || 'OC',
              kilos: kilosVal,
              total: totalVal,
              status: 'success',
              message: `Entrega de ${kilosVal.toLocaleString('es-MX')} kg vinculada con éxito a OC ${match.folio || match.oc}`,
              orderId: match.id,
            };
            setBatchResults([res]);
            triggerHaptic('success');
            toast(`✅ Entrega de ${kilosVal.toLocaleString('es-MX')} kg registrada en OC ${match.folio || match.oc}`, 'ok');
          } else {
            const res: ProcessedResultItem = {
              id: `txt-${Date.now()}`,
              fileName: 'Texto Pegado',
              folio: folio,
              oc: ocr.ocNumber || 'Sin OC',
              kilos: kilosVal,
              total: totalVal,
              status: 'warning',
              message: `Texto analizado (${kilosVal.toLocaleString('es-MX')} kg). Asigna la OC correspondiente.`,
              parsedData: {
                folio: folio,
                uuid: ocr.uuid || '',
                ocNumber: ocr.ocNumber || ocr.folio,
                fecha: new Date().toISOString(),
                subTotal: kilosVal * 43,
                total: totalVal,
                emisorRfc: 'EDE1902136T2',
                emisorNombre: 'ELEMENTAL DENIM',
                receptorRfc: 'GTP930115PU1',
                receptorNombre: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
                conceptos: ocr.conceptos || [{
                  codigo: 'S/C',
                  descripcion: ocr.product || 'Bolsa de Polietileno',
                  cantidad: kilosVal,
                  valorUnitario: 43,
                  importe: kilosVal * 43,
                }],
              },
            };
            setBatchResults([res]);
            triggerHaptic('warning');
          }
        }
      } catch (e: any) {
        toast(e.message || 'Error al procesar texto pegado', 'bad');
      } finally {
        setProcessing(false);
        setProgressMsg('');
      }
    }
  };

  // Asignación manual de respaldo para ítems con dudas o advertencias
  const handleManualBind = async () => {
    if (!manualFallbackItem || !manualFallbackItem.parsedData || !selectedTargetOrderId) {
      toast('Selecciona una orden de destino', 'bad');
      return;
    }

    try {
      setProcessing(true);
      const targetOrder = orders.find((o) => o.id === selectedTargetOrderId);
      if (!targetOrder) throw new Error('Orden no encontrada');

      const xmlData = manualFallbackItem.parsedData;
      const totalKilos = (xmlData.conceptos || []).reduce((sum, c) => sum + (Number(c.cantidad) || 0), 0);

      const newInvoice = {
        id: `inv-${Date.now()}`,
        folio: xmlData.folio || 'S/N',
        uuid: xmlData.uuid,
        kilos: totalKilos,
        financials: {
          salePricePerKg: 43,
          costPricePerKg: 38,
          saleTotal: xmlData.subTotal || 0,
          invoiceTotal: xmlData.total || 0,
          costTotal: totalKilos * 38,
          commission: (xmlData.subTotal || 0) * 0.08,
          netCashFlow: ((xmlData.subTotal || 0) * 1.16) - (totalKilos * 38) - ((xmlData.subTotal || 0) * 0.08),
          tradeMargin: (xmlData.subTotal || 0) - (totalKilos * 38),
        },
        creditCycle: {
          status: 'pending' as const,
          issueDate: xmlData.fecha ? Timestamp.fromDate(new Date(xmlData.fecha)) : Timestamp.now(),
        },
      };

      const updatedDeliveries = [...(targetOrder.deliveries || [])];
      updatedDeliveries.push({
        id: `del-${Date.now()}`,
        date: xmlData.fecha ? Timestamp.fromDate(new Date(xmlData.fecha)) : Timestamp.now(),
        kilos: totalKilos,
        notes: `Entrega física amparada por Factura #${xmlData.folio}`,
        invoiced: true,
        invoiceId: newInvoice.id,
        docType: 'factura',
        docFolio: xmlData.folio,
      });

      await updateDoc(doc(db, PATHS.orders, targetOrder.id), {
        invoices: [...(targetOrder.invoices || []), newInvoice as any],
        deliveries: updatedDeliveries,
        status: 'facturado',
      });

      triggerHaptic('success');
      toast(`✅ Documento #${xmlData.folio} vinculado a la OC ${targetOrder.folio || targetOrder.oc}`, 'ok');
      setManualFallbackItem(null);
      onClose();
    } catch (err: any) {
      toast(err.message || 'Error al vincular manualmente', 'bad');
    } finally {
      setProcessing(false);
    }
  };

  // Escuchar Pegado Global (Ctrl+V) dentro del Modal
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text && text.trim().length > 0) {
        e.preventDefault();
        handlePasteChange(text);
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const totalBatchKilos = (batchResults || []).reduce((acc, r) => acc + (r.kilos || 0), 0);
  const totalBatchMoney = (batchResults || []).reduce((acc, r) => acc + (r.total || 0), 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !processing) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'var(--paper, #0f172a)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
          borderRadius: 22,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            background: 'var(--paper-sunk, rgba(0,0,0,0.3))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>⚡</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--ink, #fff)' }}>
                Ingesta Rápida & Multilote (XMLs · PDFs · Paste)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-soft, #94a3b8)' }}>
              Arrastra o pega Facturas XML, PDFs de OCs o texto de WhatsApp. El ERP procesa y vincula al instante.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-soft)',
              fontSize: 22,
              cursor: processing ? 'not-allowed' : 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal de Asignación Manual si un archivo no tuvo OC clara */}
        {manualFallbackItem ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: 10 }}>
              <strong style={{ color: '#f59e0b', fontSize: 13 }}>Asignación Manual de Documento:</strong>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Folio: <strong>#{manualFallbackItem.folio}</strong> · {manualFallbackItem.kilos > 0 ? `${manualFallbackItem.kilos.toLocaleString('es-MX')} kg` : '—'} · Total: {money(manualFallbackItem.total)}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
                Selecciona el Expediente / OC de Destino:
              </label>
              <select
                value={selectedTargetOrderId}
                onChange={(e) => setSelectedTargetOrderId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: 'var(--paper-sunk, rgba(0,0,0,0.3))',
                  border: '1px solid var(--border, rgba(255,255,255,0.2))',
                  borderRadius: 10,
                  color: 'var(--ink, #fff)',
                  fontSize: 13,
                  outline: 'none',
                }}
              >
                <option value="">-- Seleccionar Orden de Compra --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.folio || o.oc || 'S/F'} · {o.client} ({o.totalKilograms?.toLocaleString('es-MX')} kg)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, minHeight: 42, fontWeight: 800 }}
                onClick={handleManualBind}
                disabled={!selectedTargetOrderId || processing}
              >
                {processing ? '⏳ Guardando...' : '✓ Vincular a la Orden'}
              </button>
              <button
                className="btn"
                style={{ minHeight: 42 }}
                onClick={() => setManualFallbackItem(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : batchResults ? (
          /* Reporte Visual de Resultados Multilote */
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div
              style={{
                padding: '16px 20px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>
                  🎉 Procesamiento de Ingesta Completado
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {batchResults.length} documento(s) procesados · Total: <strong style={{ color: '#fff' }}>{totalBatchKilos.toLocaleString('es-MX')} kg</strong> · <strong style={{ color: '#f59e0b' }}>{money(totalBatchMoney)}</strong>
                </div>
              </div>
              <span style={{ fontSize: 26 }}>✓</span>
            </div>

            {/* Lista detallada de archivos procesados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {batchResults.map((r, idx) => (
                <div
                  key={r.id || idx}
                  style={{
                    padding: '14px 16px',
                    background: 'var(--surface-raised, rgba(255,255,255,0.03))',
                    border: `1px solid ${r.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : r.status === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 18 }}>
                        {r.status === 'success' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Doc #{r.folio} · OC {r.oc}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                          {r.message}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                          {r.kilos > 0 ? `${r.kilos.toLocaleString('es-MX')} kg` : '—'}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#f59e0b', fontWeight: 700 }}>
                          {r.total > 0 ? money(r.total) : ''}
                        </div>
                      </div>

                      {(r.status === 'warning' || r.status === 'error') && r.parsedData && (
                        <button
                          className="btn"
                          style={{ fontSize: 11, padding: '4px 8px', background: '#d97706', color: '#fff', border: 'none' }}
                          onClick={() => setManualFallbackItem(r)}
                        >
                          ✏️ Asignar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selector Rápido de Cierre para Entregas Parciales (80% Habitual) */}
                  {r.isPartial && r.orderId && (
                    <div
                      style={{
                        marginTop: 4,
                        padding: '8px 12px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--ink)' }}>
                        ⚖️ <strong>Entrega Parcial:</strong> {r.totalInvoicedKilos?.toLocaleString('es-MX')} kg de {r.orderGoalKilos?.toLocaleString('es-MX')} kg
                        <span style={{ color: '#38bdf8', marginLeft: 6 }}>
                          (Faltan {((r.orderGoalKilos || 0) - (r.totalInvoicedKilos || 0)).toLocaleString('es-MX')} kg)
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{
                            background: r.isClosedShort ? '#10b981' : '#2563eb',
                            color: '#fff',
                            border: 'none',
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 6,
                          }}
                          onClick={async () => {
                            triggerHaptic('success');
                            await updateDoc(doc(db, PATHS.orders, r.orderId!), {
                              isClosedShort: !r.isClosedShort,
                              status: !r.isClosedShort ? 'facturado' : 'pedido',
                            });
                            setBatchResults((prev) => prev?.map((item) => item.id === r.id ? { ...item, isClosedShort: !item.isClosedShort } : item) || null);
                            toast(!r.isClosedShort ? '🏁 OC concluida como entrega final' : 'OC reabierta para más entregas', 'ok');
                          }}
                        >
                          {r.isClosedShort ? '✓ Concluida (Reabrir)' : '🏁 Concluir OC (80% habitual)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary"
              style={{ minHeight: 44, fontWeight: 900, marginTop: 8 }}
              onClick={onClose}
            >
              ✓ Entendido y Cerrar
            </button>
          </div>
        ) : (
          /* Pantalla Inicial de Selección / Arrastre */
          <>
            <div style={{ padding: '16px 24px 0', display: 'flex', gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: tab === 'upload' ? '#0284c7' : 'var(--paper-sunk, rgba(255,255,255,0.05))',
                  color: tab === 'upload' ? '#fff' : 'var(--ink-soft)',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => {
                  triggerHaptic('light');
                  setTab('upload');
                }}
              >
                📁 Subir Archivos (.xml / .pdf)
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: tab === 'paste' ? '#059669' : 'var(--paper-sunk, rgba(255,255,255,0.05))',
                  color: tab === 'paste' ? '#fff' : 'var(--ink-soft)',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => {
                  triggerHaptic('light');
                  setTab('paste');
                }}
              >
                📋 Pegar XML / WhatsApp / Texto
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tab === 'upload' ? (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept=".xml,.pdf,.png,.jpg,.jpeg,.webp,image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) handleFiles(files);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const files = e.dataTransfer.files;
                      if (files && files.length > 0) handleFiles(files);
                    }}
                    onClick={() => !processing && fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? '#38bdf8' : 'var(--border, rgba(255, 255, 255, 0.18))'}`,
                      borderRadius: 16,
                      padding: '40px 20px',
                      textAlign: 'center',
                      background: isDragging ? 'rgba(56, 189, 248, 0.08)' : 'var(--paper-sunk, rgba(0,0,0,0.2))',
                      cursor: processing ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 38 }}>{processing ? '⏳' : '📸'}</span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink, #fff)' }}>
                      {processing ? progressMsg : 'Selecciona o arrastra XMLs, PDFs o Fotos de Remisiones aquí'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      Sube 1 o múltiples archivos (.xml CFDI, .pdf de OCs, fotos de remisiones con firma/sello). La IA y OCR procesan y vinculan al instante.
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <textarea
                    placeholder="Pega aquí el código XML de la factura SAT o el texto de WhatsApp de entrega (Ctrl+V)... El ERP lo procesará e integrará automáticamente sin pasos intermedios."
                    value={pastedText}
                    onChange={(e) => handlePasteChange(e.target.value)}
                    rows={6}
                    style={{
                      width: '100%',
                      background: 'var(--paper-sunk, rgba(0,0,0,0.3))',
                      border: '1px solid var(--border, rgba(255,255,255,0.12))',
                      borderRadius: 12,
                      padding: 14,
                      color: 'var(--ink, #fff)',
                      fontSize: 12.5,
                      resize: 'none',
                      outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                  {processing && (
                    <div style={{ fontSize: 13, color: '#38bdf8', fontWeight: 700, textAlign: 'center' }}>
                      ⏳ {progressMsg || 'Procesando documento pegado al instante...'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
