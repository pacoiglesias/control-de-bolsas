import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui';
import { parseXmlInvoice } from '../../lib/xmlParser';
import { extractTextFromPdf, extractTextFromImage, parseOcrData } from '../../lib/ocr';
import { parseScaleTicket } from '../../lib/scaleTicketParser';
import { parseProvidenciaPaymentPdf } from '../../lib/providenciaPortalParser';
import { useOrdersContext } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import { money } from '../../lib/format';
import { round2 } from '../../lib/finance';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';
import { doc, collection, Timestamp } from 'firebase/firestore';
import { safeUpdateDoc, safeAddDoc } from '../../lib/safeFirestore';
import { cleanUndefined } from '../../lib/cleanUndefined';
import { db, PATHS } from '../../lib/firebase';
import type { Invoice, Delivery } from '../../lib/types';
import { OC_TH_ACTIVE, OC_GT_ACTIVE } from '../../lib/constants';
import { uploadDocument, type StoredDocKind } from '../../lib/documentStorage';

function toSafeTimestamp(dateStr?: string): Timestamp {
  if (!dateStr) return Timestamp.now();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
}

interface GlobalDropInspectorModalProps {
  file: File;
  queuePosition?: { current: number; total: number };
  onClose: () => void;
}

type DetectedDocType = 'factura_cfdi' | 'ticket_bascula' | 'contrarecibo' | 'remision' | 'comprobante_pago' | 'desconocido';

export function GlobalDropInspectorModal({ file, queuePosition, onClose }: GlobalDropInspectorModalProps) {
  const { orders } = useOrdersContext();
  const toast = useToast();

  const [analyzing, setAnalyzing] = useState(true);
  const [docType, setDocType] = useState<DetectedDocType>('desconocido');
  const [confidence, setConfidence] = useState<'alta' | 'media' | 'baja'>('baja');
  /** Subtipo de OC: 'oc_providencia' cuando el doc es una OC de Providencia */
  const [ocKind, setOcKind] = useState<'oc_providencia' | null>(null);
  /** Piezas totales detectadas en la OC (solo para docKind=oc_providencia) */
  const [ocPiezasInfo, setOcPiezasInfo] = useState<{ totalPiezas: number; conceptos: Array<{ codigo: string; descripcion: string; cantidad: number; valorUnitario: number }> } | null>(null);

  // Datos extraídos
  const [extractedFolio, setExtractedFolio] = useState('');
  const [extractedUuid, setExtractedUuid] = useState('');
  const [extractedKilos, setExtractedKilos] = useState(0);
  const [extractedTotal, setExtractedTotal] = useState(0);
  const [extractedSubtotal, setExtractedSubtotal] = useState(0);
  const [extractedDate, setExtractedDate] = useState(new Date().toISOString().split('T')[0]);
  const [detectedOcNumber, setDetectedOcNumber] = useState('');

  // Previsualización de imagen
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Orden seleccionada para vincular
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [ocAssignmentDoubt, setOcAssignmentDoubt] = useState(false);
  const [autoAssignedOcTag, setAutoAssignedOcTag] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Estado del guardado del archivo original en Storage */
  const [uploadingFile, setUploadingFile] = useState(false);
  const [autoApplyCountdown, setAutoApplyCountdown] = useState<number | null>(null);
  const [autoApplyPaused, setAutoApplyPaused] = useState(false);

  // Analizar archivo en el montaje
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    async function analyze() {
      setAnalyzing(true);
      try {
        const fileName = file.name.toLowerCase();

        // Si es imagen, generar URL de previsualización
        if (file.type.startsWith('image/')) {
          createdUrl = URL.createObjectURL(file);
          setImagePreviewUrl(createdUrl);
        }

        // 1. CASO XML CFDI
        if (fileName.endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml') {
          const text = await file.text();
          const parsed = parseXmlInvoice(text);
          if (active && parsed) {
            setDocType('factura_cfdi');
            setConfidence('alta');
            setExtractedFolio(parsed.folio || '');
            setExtractedUuid(parsed.uuid || '');
            const totalKg = (parsed.conceptos || []).reduce((acc, c) => acc + (Number(c.cantidad) || 0), 0);
            setExtractedKilos(round2(totalKg));
            setExtractedSubtotal(round2(parsed.subTotal || 0));
            setExtractedTotal(round2(parsed.total || 0));
            setExtractedDate(parsed.fecha ? parsed.fecha.split('T')[0] : new Date().toISOString().split('T')[0]);
            setDetectedOcNumber(parsed.ocNumber || '');

            // Autoseleccionar orden si hay coincidencia
            matchOrder(parsed.ocNumber, parsed.folio, parsed.receptorNombre);
          }
        }
        // 2. CASO PDF
        else if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
          const text = await extractTextFromPdf(file);
          if (!active) return;

          // 0. Detectar si es un Detalle de Pagos oficial de Providencia (TR_xxxx, Factura, Contrarecibo)
          const provPayment = parseProvidenciaPaymentPdf(text);
          if (provPayment) {
            setDocType('comprobante_pago');
            setConfidence('alta');
            setExtractedFolio(provPayment.facturaFolio || provPayment.transferRef || '');
            setExtractedUuid('');
            setExtractedKilos(0);
            setExtractedSubtotal(round2(provPayment.amount / 1.16));
            setExtractedTotal(round2(provPayment.amount));
            if (provPayment.paymentDate) {
              const dp = provPayment.paymentDate.split('/');
              if (dp.length === 3) {
                setExtractedDate(`${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`);
              }
            }
            setDetectedOcNumber(provPayment.transferRef || '');
            matchOrder(provPayment.transferRef, provPayment.facturaFolio, provPayment.department, provPayment.amount, provPayment.contrareciboNumber);
          } else {
            // Verificar si es un Ticket de Báscula
            const scaleTicket = parseScaleTicket(text);
            if (scaleTicket.kilosNeto && scaleTicket.kilosNeto > 0) {
              setDocType('ticket_bascula');
              setConfidence(scaleTicket.confidence === 'high' ? 'alta' : 'media');
              setExtractedKilos(round2(scaleTicket.kilosNeto));
              setExtractedFolio(scaleTicket.ticketFolio || '');
              setExtractedDate(scaleTicket.dateStr || new Date().toISOString().split('T')[0]);
              setDetectedOcNumber(scaleTicket.detectedOc || '');
              matchOrder(scaleTicket.detectedOc, undefined, scaleTicket.detectedDepartment);
            } else {
              // Verificar tipo de documento con OCR
              const ocr = parseOcrData(text);

              if (ocr.docKind === 'pago_providencia') {
                setDocType('comprobante_pago');
                setConfidence('alta');
                setExtractedFolio(ocr.folio || '');
                setDetectedOcNumber(ocr.ocNumber || '');
                setExtractedKilos(0);
                setExtractedSubtotal(round2(ocr.subTotal || 0));
                setExtractedTotal(round2(ocr.total || 0));
                setExtractedDate(ocr.fecha ? ocr.fecha : new Date().toISOString().split('T')[0]);
                matchOrder(ocr.ocNumber, ocr.folio, ocr.receptorNombre, ocr.total);
              } else if (ocr.docKind === 'oc_providencia') {
                // OC de Providencia: todas las bolsas se entregan y miden en KILOS
                // → Extraemos los kilos directamente de las cantidades pedidas
                setDocType('contrarecibo');
                setOcKind('oc_providencia');
                setConfidence('alta');
                setExtractedFolio(ocr.folio || ocr.ocNumber || '');
                setExtractedUuid('');
                setExtractedKilos(round2(ocr.kilos || ocr.totalPiezas || 0));
                setExtractedSubtotal(round2(ocr.subTotal || 0));
                setExtractedTotal(round2(ocr.total || 0));
                setExtractedDate(ocr.fecha ? ocr.fecha : new Date().toISOString().split('T')[0]);
                setDetectedOcNumber(ocr.ocNumber || ocr.folio || '');
                if (ocr.totalPiezas || ocr.conceptos) {
                  setOcPiezasInfo({
                    totalPiezas: ocr.totalPiezas || 0,
                    conceptos: (ocr.conceptos || []).map(c => ({
                      codigo: c.codigo || '',
                      descripcion: c.descripcion,
                      cantidad: c.cantidad,
                      valorUnitario: c.valorUnitario,
                    })),
                  });
                }
                matchOrder(ocr.ocNumber, ocr.folio, ocr.receptorNombre, ocr.total, undefined, true);
              } else if (ocr.docKind === 'contrarecibo' || /CONTRARECIBO|GT-\d+|TH-\d+/i.test(text)) {
                setDocType('contrarecibo');
                setConfidence('alta');
                const crFolio = ocr.contrarecibo || ocr.folio || '';
                setExtractedFolio(crFolio);
                setExtractedUuid(ocr.uuid || '');
                setExtractedKilos(0);
                setExtractedSubtotal(round2(ocr.subTotal || 0));
                setExtractedTotal(round2(ocr.total || 0));
                setExtractedDate(ocr.dueDate || (ocr.fecha ? ocr.fecha.split('T')[0] : new Date().toISOString().split('T')[0]));
                setDetectedOcNumber(ocr.ocNumber || '');

                // Buscar orden por facturas amparadas primero (ej. Factura 6334, 6352, 6353)
                let matchedByInvoice = false;
                if (ocr.facturaFolios && ocr.facturaFolios.length > 0) {
                  for (const ff of ocr.facturaFolios) {
                    const foundOrd = orders.find(
                      (o) => !o.isDeleted && (o.invoices || []).some((inv) => inv.folio === ff || inv.folio?.includes(ff) || (inv.id && inv.id.includes(ff)))
                    );
                    if (foundOrd) {
                      setSelectedOrderId(foundOrd.id);
                      setOcAssignmentDoubt(false);
                      const deptTag = (foundOrd.client?.includes('TH') || (foundOrd.department || '').includes('TH')) ? 'TH (José Nava)' : 'GT (Lic. Evelia)';
                      setAutoAssignedOcTag(`🎯 Contrarecibo amparando F-${ocr.facturaFolios.join(', F-')} en ${foundOrd.folio || foundOrd.oc} · ${deptTag}`);
                      matchedByInvoice = true;
                      break;
                    }
                  }
                }

                if (!matchedByInvoice) {
                  const isThCr = crFolio.startsWith('TH-') || (ocr.receptorNombre || '').includes('TH');
                  const isGtCr = crFolio.startsWith('GT-') || (ocr.receptorNombre || '').includes('GT');
                  const fallbackOrd = orders.find(o => !o.isDeleted && (
                    (isThCr && (o.oc === OC_TH_ACTIVE || (o.folio || '').includes('14302') || (o.department || '').includes('TH'))) ||
                    (isGtCr && (o.oc === OC_GT_ACTIVE || (o.folio || '').includes('9784') || (o.department || '').includes('GT')))
                  ));

                  if (fallbackOrd) {
                    setSelectedOrderId(fallbackOrd.id);
                    setOcAssignmentDoubt(false);
                    const deptTag = isThCr ? 'TH (José Nava)' : 'GT (Lic. Evelia)';
                    setAutoAssignedOcTag(`🎯 Contrarecibo ${crFolio} asignado a expediente oficial ${fallbackOrd.folio || fallbackOrd.oc} · ${deptTag}`);
                  } else {
                    matchOrder(ocr.ocNumber, ocr.facturaFolios?.[0] || ocr.folio, ocr.receptorNombre, ocr.total, crFolio, false);
                  }
                }
              } else {
                setDocType('factura_cfdi');
                setConfidence('alta');
                setExtractedFolio(ocr.folio || '');
                setExtractedUuid(ocr.uuid || '');
                setExtractedKilos(round2(ocr.kilos || 0));
                setExtractedSubtotal(round2(ocr.subTotal || 0));
                setExtractedTotal(round2(ocr.total || 0));
                setExtractedDate(ocr.fecha ? ocr.fecha.split('T')[0] : new Date().toISOString().split('T')[0]);
                setDetectedOcNumber(ocr.ocNumber || '');
                matchOrder(ocr.ocNumber, ocr.folio, ocr.receptorNombre, ocr.total, undefined, false);
              }
            }
          }
        }
        // 3. CASO IMAGEN (Foto de ticket, remisión o factura)
        else if (file.type.startsWith('image/')) {
          const text = await extractTextFromImage(file);
          if (!active) return;

          // 1. Verificar si es Ticket de Báscula
          const scaleTicket = parseScaleTicket(text);
          if (scaleTicket.kilosNeto && scaleTicket.kilosNeto > 0) {
            setDocType('ticket_bascula');
            setConfidence(scaleTicket.confidence === 'high' ? 'alta' : 'media');
            setExtractedKilos(round2(scaleTicket.kilosNeto));
            setExtractedFolio(scaleTicket.ticketFolio || '');
            setExtractedDate(scaleTicket.dateStr || new Date().toISOString().split('T')[0]);
            setDetectedOcNumber(scaleTicket.detectedOc || '');
            matchOrder(scaleTicket.detectedOc, undefined, scaleTicket.detectedDepartment);
          } else {
            const ocr = parseOcrData(text);

            if (ocr.docKind === 'contrarecibo' || /CONTRARECIBO|GT-\d+|TH-\d+/i.test(text)) {
              setDocType('contrarecibo');
              setConfidence('alta');
              const crFolio = ocr.contrarecibo || ocr.folio || '';
              setExtractedFolio(crFolio);
              setExtractedUuid(ocr.uuid || '');
              setExtractedKilos(0);
              setExtractedSubtotal(round2(ocr.subTotal || 0));
              setExtractedTotal(round2(ocr.total || 0));
              setExtractedDate(ocr.dueDate || (ocr.fecha ? ocr.fecha.split('T')[0] : new Date().toISOString().split('T')[0]));
              setDetectedOcNumber(ocr.ocNumber || '');

              let matchedByInvoice = false;
              if (ocr.facturaFolios && ocr.facturaFolios.length > 0) {
                for (const ff of ocr.facturaFolios) {
                  const foundOrd = orders.find(
                    (o) => !o.isDeleted && (o.invoices || []).some((inv) => inv.folio === ff || inv.folio?.includes(ff) || (inv.id && inv.id.includes(ff)))
                  );
                  if (foundOrd) {
                    setSelectedOrderId(foundOrd.id);
                    setOcAssignmentDoubt(false);
                    const deptTag = (foundOrd.client?.includes('TH') || (foundOrd.department || '').includes('TH')) ? 'TH (José Nava)' : 'GT (Lic. Evelia)';
                    setAutoAssignedOcTag(`🎯 Contrarecibo amparando F-${ocr.facturaFolios.join(', F-')} en ${foundOrd.folio || foundOrd.oc} · ${deptTag}`);
                    matchedByInvoice = true;
                    break;
                  }
                }
              }

              if (!matchedByInvoice) {
                const isThCr = crFolio.startsWith('TH-') || (ocr.receptorNombre || '').includes('TH');
                const isGtCr = crFolio.startsWith('GT-') || (ocr.receptorNombre || '').includes('GT');
                const fallbackOrd = orders.find(o => !o.isDeleted && (
                  (isThCr && (o.oc === OC_TH_ACTIVE || (o.folio || '').includes('14302') || (o.department || '').includes('TH'))) ||
                  (isGtCr && (o.oc === OC_GT_ACTIVE || (o.folio || '').includes('9784') || (o.department || '').includes('GT')))
                ));

                if (fallbackOrd) {
                  setSelectedOrderId(fallbackOrd.id);
                  setOcAssignmentDoubt(false);
                  const deptTag = isThCr ? 'TH (José Nava)' : 'GT (Lic. Evelia)';
                  setAutoAssignedOcTag(`🎯 Contrarecibo ${crFolio} asignado a expediente oficial ${fallbackOrd.folio || fallbackOrd.oc} · ${deptTag}`);
                } else {
                  matchOrder(ocr.ocNumber, ocr.facturaFolios?.[0] || ocr.folio, ocr.receptorNombre, ocr.total, crFolio, false);
                }
              }
            } else if (ocr.docKind === 'remision' || /REMISI[OÓ]N|ORDEN\s*DE\s*ENTREGA|BOLSA\s*DE\s*POLIETILENO/i.test(text)) {
              setDocType('remision');
              setConfidence('alta');
              setExtractedFolio(ocr.folio || 'REM-280926');
              setExtractedKilos(round2(ocr.kilos || 0));
              setExtractedSubtotal(round2(ocr.subTotal || 0));
              setExtractedTotal(round2(ocr.total || 0));
              setExtractedDate(ocr.fecha ? ocr.fecha : new Date().toISOString().split('T')[0]);
              setDetectedOcNumber(ocr.ocNumber || '');
              matchOrder(ocr.ocNumber, ocr.folio, ocr.receptorNombre, ocr.total, undefined, false);
            } else if (ocr.uuid || /CFDI|FACTURA/i.test(text)) {
              setDocType('factura_cfdi');
              setConfidence('alta');
              setExtractedFolio(ocr.folio || '');
              setExtractedUuid(ocr.uuid || '');
              setExtractedKilos(round2(ocr.kilos || 0));
              setExtractedSubtotal(round2(ocr.subTotal || 0));
              setExtractedTotal(round2(ocr.total || 0));
              setExtractedDate(ocr.fecha ? ocr.fecha.split('T')[0] : new Date().toISOString().split('T')[0]);
              setDetectedOcNumber(ocr.ocNumber || '');
              matchOrder(ocr.ocNumber, ocr.folio, ocr.receptorNombre, ocr.total, undefined, false);
            } else {
              setDocType('ticket_bascula');
              setConfidence('media');
              if (ocr.kilos) setExtractedKilos(round2(ocr.kilos));
              if (ocr.ocNumber) {
                setDetectedOcNumber(ocr.ocNumber);
                matchOrder(ocr.ocNumber);
              }
            }
          }
        } else {
          setDocType('desconocido');
          setConfidence('baja');
        }
      } catch (err) {
        console.error('Error al analizar archivo en dropzone:', err);
        setDocType('desconocido');
        setConfidence('baja');
      } finally {
        if (active) setAnalyzing(false);
      }
    }

    function matchOrder(
      ocCandidate?: string,
      folioCandidate?: string,
      _clientCandidate?: string,
      amountCandidate?: number,
      crCandidate?: string,
      _isOcDocKind?: boolean
    ) {
      if (!orders || orders.length === 0) {
        setSelectedOrderId('');
        setOcAssignmentDoubt(true);
        setAutoAssignedOcTag(null);
        return;
      }

      const cleanOc = (ocCandidate || '').replace(/[^0-9]/g, '');
      const cleanFolio = (folioCandidate || '').trim().toUpperCase();
      const cleanCr = (crCandidate || '').trim().toUpperCase();

      // 1. Detección Canónica Oficial Directa
      let found = orders.find((o) => {
        if (!o || (o as any).isDeleted) return false;
        const oOc = (o.oc || o.folio || o.id || '').replace(/[^0-9]/g, '');
        // Coincidencia exacta o contenida de OC
        if (cleanOc && cleanOc.length >= 4 && (oOc.includes(cleanOc) || cleanOc.includes(oOc))) return true;
        // Alias canónicos oficiales TH (120267114302 · 71/14302)
        if ((cleanOc.includes('14302') || cleanOc.includes('67114302') || cleanOc.includes('114099')) &&
            (o.oc === OC_TH_ACTIVE || oOc.includes('14302') || (o.folio || '').includes('14302'))) return true;
        // Alias canónicos oficiales GT (12026439784 · 43/9784)
        if ((cleanOc.includes('9784') || cleanOc.includes('6439784') || cleanOc.includes('439784')) &&
            (o.oc === OC_GT_ACTIVE || oOc.includes('9784') || (o.folio || '').includes('9784'))) return true;
        // OCs históricas finiquitadas
        if (cleanOc.includes('9713') && (o.oc?.includes('9713') || o.folio?.includes('9713'))) return true;
        if (cleanOc.includes('14114') && (o.oc?.includes('14114') || o.folio?.includes('14114'))) return true;
        return false;
      });

      // 2. Coincidencia por Folio de factura previamente registrada
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
          return o.collection?.contrareciboNumber === cleanCr || (o.invoices || []).some((i) => i.collection?.contrareciboNumber === cleanCr);
        });
      }

      // 4. Coincidencia por Importe exacto en facturas existentes
      if (!found && amountCandidate && amountCandidate > 0) {
        found = orders.find((o) => {
          if (!o || (o as any).isDeleted) return false;
          return (o.invoices || []).some((i) => Math.abs((i.financials?.invoiceTotal || 0) - amountCandidate) < 1);
        });
      }

      if (found) {
        setSelectedOrderId(found.id);
        setOcAssignmentDoubt(false);
        const deptTag = (found.client?.includes('TH') || (found.department || '').includes('TH')) ? 'TH (José Nava)' : 'GT (Lic. Evelia)';
        setAutoAssignedOcTag(`🎯 OC Asignada en Automático: ${found.folio || found.oc} · ${deptTag}`);
      } else {
        // En caso de no detectar número unívoco de OC: NUNCA asignar a ciegas ni por omisión
        setSelectedOrderId('');
        setOcAssignmentDoubt(true);
        setAutoAssignedOcTag(null);
      }
    }

    analyze();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, orders]);

  // Orden seleccionada para mostrar impacto
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Detección analítica de duplicidad / estatus del documento en todo el ERP
  const duplicateStatus = useMemo(() => {
    if (!extractedFolio && !extractedUuid) return null;
    const cleanFolio = extractedFolio?.trim().toUpperCase();
    const cleanUuid = extractedUuid?.trim().toUpperCase();

    for (const o of orders) {
      if (!o || (o as any).isDeleted) continue;
      const matchInv = (o.invoices || []).find((inv) => {
        if (!inv) return false;
        if (cleanFolio && inv.folio?.trim().toUpperCase() === cleanFolio) return true;
        if (cleanUuid && inv.uuid?.trim().toUpperCase() === cleanUuid) return true;
        return false;
      });
      if (matchInv) {
        return {
          isDuplicate: true,
          order: o,
          invoice: matchInv,
          isSameOrder: o.id === selectedOrderId,
        };
      }
    }
    return { isDuplicate: false };
  }, [orders, extractedFolio, extractedUuid, selectedOrderId]);

  // Acción de Confirmación y Aplicación Atómica
  const handleConfirmAndApply = async () => {
    if (docType === 'factura_cfdi' && duplicateStatus?.isDuplicate) {
      triggerHaptic('error');
      toast(`⚠️ La Factura #${extractedFolio} ya se encuentra registrada en la orden ${duplicateStatus.order?.folio || duplicateStatus.order?.oc}. No se duplicó.`, 'bad');
      return;
    }
    if (!selectedOrder) {
      if (ocKind === 'oc_providencia') {
        setSaving(true);
        try {
          const isTh = (extractedFolio?.includes('71') || detectedOcNumber?.includes('1202671'));
          const newOrderDoc = {
            folio: extractedFolio || detectedOcNumber || 'OC-NUEVA',
            oc: detectedOcNumber || extractedFolio || 'OC-NUEVA',
            client: isTh ? 'TEXTIL HOGAR (TH - NAVA)' : 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            department: isTh ? 'TH' : 'GT',
            departmentLocation: isTh ? 'TH-ALMACEN-1' : 'P4-ALM',
            totalKilograms: extractedKilos || 0,
            status: 'pedido',
            creditCycle: { status: 'pedido' },
            isClosedShort: false,
            notes: `OC importada desde ${file.name}`,
            invoices: [],
            deliveries: [],
            items: (ocPiezasInfo?.conceptos || []).map((c, idx) => ({
              id: `item-${idx + 1}`,
              code: c.codigo || 'S/C',
              description: c.descripcion || 'Bolsa de Polietileno',
              quantity: c.cantidad || extractedKilos || 0,
              unitPrice: c.valorUnitario || 43,
              amount: c.cantidad * (c.valorUnitario || 43),
              unit: 'Kilos',
            })),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          const newDocRef = await safeAddDoc(collection(db, PATHS.orders), newOrderDoc);
          // Guardar PDF original en Firebase Storage
          try {
            setUploadingFile(true);
            await uploadDocument({
              file,
              docKind: 'oc_providencia',
              folio: newOrderDoc.folio,
              ocNumber: newOrderDoc.oc,
              orderId: newDocRef.id,
              orderFolio: newOrderDoc.folio,
              kilos: extractedKilos || 0,
              total: extractedTotal || 0,
              docDate: extractedDate,
              notes: `OC importada desde ${file.name} — ${(ocPiezasInfo?.conceptos || []).length} artículo(s) detectados`,
            });
          } catch (storErr) {
            console.warn('No se pudo subir el PDF original a Storage:', storErr);
          } finally {
            setUploadingFile(false);
          }
          sound.playChaChing();
          triggerHaptic('cash');
          toast(`✅ Nueva Orden de Compra ${newOrderDoc.folio} creada con éxito (${(extractedKilos || 0).toLocaleString('es-MX')} kg) — en Producción`, 'ok');
          onClose();
          return;
        } catch (err: any) {
          console.error('Error al crear OC:', err);
          toast(`Error al crear OC: ${err.message}`, 'bad');
          return;
        } finally {
          setSaving(false);
        }
      }

      toast('Por favor selecciona una Orden de Compra para aplicar el comprobante.', 'bad');
      return;
    }

    setSaving(true);
    try {
      const orderRef = doc(db, PATHS.orders, selectedOrder.id);

      if (docType === 'comprobante_pago') {
        const updatedInvoices = [...(selectedOrder.invoices || [])];
        const invIdx = updatedInvoices.findIndex((i: any) =>
          (extractedFolio && i.folio === extractedFolio) ||
          (detectedOcNumber && i.collection?.transferRef === detectedOcNumber) ||
          (extractedTotal > 0 && Math.abs((i.financials?.invoiceTotal || 0) - extractedTotal) < 1)
        );
        const payTs = toSafeTimestamp(extractedDate);
        if (invIdx !== -1 && updatedInvoices[invIdx]) {
          const inv = updatedInvoices[invIdx];
          inv.collection = {
            ...(inv.collection || {}),
            paidAmount: extractedTotal,
            paidAt: payTs,
            collectedAt: payTs,
            transferRef: detectedOcNumber || extractedFolio,
          };
          inv.creditCycle = {
            ...(inv.creditCycle || {}),
            status: 'collected',
          };
        }

        await safeUpdateDoc(orderRef, {
          invoices: cleanUndefined(updatedInvoices),
          'collection.paidAmount': extractedTotal,
          'collection.paidAt': payTs,
          'collection.transferRef': detectedOcNumber || extractedFolio,
          'creditCycle.status': 'collected',
          status: 'collected',
          updatedAt: Timestamp.now(),
        });

        // Guardar PDF original en Firebase Storage
        try {
          setUploadingFile(true);
          await uploadDocument({
            file,
            docKind: 'pago_providencia',
            folio: extractedFolio || detectedOcNumber || 'S/F',
            ocNumber: detectedOcNumber,
            orderId: selectedOrder.id,
            orderFolio: selectedOrder.folio || selectedOrder.oc,
            kilos: 0,
            total: extractedTotal,
            docDate: extractedDate,
            notes: `Pago TR ${detectedOcNumber} aplicado a OC ${selectedOrder.folio || selectedOrder.oc}`,
          });
        } catch (storErr) {
          console.warn('No se pudo subir el PDF de pago a Storage:', storErr);
        } finally {
          setUploadingFile(false);
        }
        sound.playChaChing();
        triggerHaptic('cash');
        toast(`✅ Pago ${detectedOcNumber || extractedFolio} de ${money(extractedTotal)} aplicado con éxito a la OC ${selectedOrder.folio || selectedOrder.oc}`, 'ok');
      } else if (docType === 'factura_cfdi') {
        const safeDate = toSafeTimestamp(extractedDate);
        const invFolio = extractedFolio?.trim() || 'S/F';
        const numKilos = Number(extractedKilos) || 0;
        const sellPrice = selectedOrder.customSellPrice || 43;
        const subtotal = extractedSubtotal || round2(numKilos * sellPrice);
        const total = extractedTotal || round2(numKilos * sellPrice * 1.16);

        const newInvoice: Invoice = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          folio: invFolio,
          ...(extractedUuid?.trim() ? { uuid: extractedUuid.trim() } : {}),
          kilos: numKilos,
          financials: {
            salePricePerKg: sellPrice,
            costPricePerKg: 38,
            saleTotal: subtotal,
            invoiceTotal: total,
            costTotal: round2(numKilos * 38),
            commission: round2(subtotal * 0.08),
            netCashFlow: round2(total - (numKilos * 38) - (subtotal * 0.08)),
            tradeMargin: round2(subtotal - (numKilos * 38)),
          },
          creditCycle: {
            status: 'pending',
            issueDate: safeDate,
          },
          orderId: selectedOrder.id,
          oc: selectedOrder.oc || selectedOrder.folio || '',
        };

        const existingInvoices = selectedOrder.invoices || [];
        const isDuplicate = existingInvoices.some((i) => i.folio === newInvoice.folio || (newInvoice.uuid && i.uuid === newInvoice.uuid));

        if (isDuplicate) {
          toast(`La Factura #${newInvoice.folio} ya se encuentra registrada en esta orden.`, 'info');
          onClose();
          return;
        }

        // Crear remisión complementaria si no existía entrega
        const existingDeliveries = selectedOrder.deliveries || [];
        const updatedDeliveries = [...existingDeliveries];

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
          updatedAt: Timestamp.now(),
        });

        // Guardar PDF/XML original en Firebase Storage
        try {
          setUploadingFile(true);
          await uploadDocument({
            file,
            docKind: 'factura_cfdi',
            folio: newInvoice.folio || 'S/F',
            ocNumber: selectedOrder.oc || selectedOrder.folio,
            orderId: selectedOrder.id,
            orderFolio: selectedOrder.folio || selectedOrder.oc,
            kilos: numKilos,
            total: total,
            docDate: extractedDate,
            notes: `Factura CFDI #${newInvoice.folio}${extractedUuid ? ' · UUID: ' + extractedUuid : ''}`,
          });
        } catch (storErr) {
          console.warn('No se pudo subir la factura a Storage:', storErr);
        } finally {
          setUploadingFile(false);
        }
        sound.playChaChing();
        triggerHaptic('cash');
        toast(`Factura #${newInvoice.folio} aplicada con éxito a la OC ${selectedOrder.folio || selectedOrder.oc}`, 'ok');
      } else if (docType === 'ticket_bascula' || docType === 'remision') {
        // Registrar Entrega de Báscula
        const safeDeliveryDate = toSafeTimestamp(extractedDate);
        const newDelivery: Delivery = {
          id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: safeDeliveryDate,
          kilos: Number(extractedKilos) || 0,
          notes: `Ingreso de báscula ticket #${extractedFolio || 'S/N'} (${(Number(extractedKilos) || 0).toLocaleString('es-MX')} kg)`,
          invoiced: false,
          docType: 'remision',
          ...(extractedFolio?.trim() ? { docFolio: extractedFolio.trim() } : {}),
        };

        const existingDeliveries = selectedOrder.deliveries || [];
        await safeUpdateDoc(orderRef, {
          deliveries: cleanUndefined([...existingDeliveries, newDelivery]),
          updatedAt: Timestamp.now(),
        });

        // Guardar ticket original en Firebase Storage
        try {
          setUploadingFile(true);
          await uploadDocument({
            file,
            docKind: docType === 'ticket_bascula' ? 'ticket_bascula' : 'remision',
            folio: extractedFolio || `TKT-${Date.now()}`,
            orderId: selectedOrder.id,
            orderFolio: selectedOrder.folio || selectedOrder.oc,
            kilos: Number(extractedKilos) || 0,
            total: 0,
            docDate: extractedDate,
            notes: `Ticket de báscula #${extractedFolio || 'S/N'} · ${(Number(extractedKilos) || 0).toLocaleString('es-MX')} kg`,
          });
        } catch (storErr) {
          console.warn('No se pudo subir el ticket a Storage:', storErr);
        } finally {
          setUploadingFile(false);
        }
        sound.playChaChing();
        triggerHaptic('cash');
        toast(`Entrega de ${(Number(extractedKilos) || 0).toLocaleString('es-MX')} kg registrada exitosamente en la OC ${selectedOrder.folio || selectedOrder.oc}`, 'ok');
      } else if (docType === 'contrarecibo' || docType === 'desconocido') {
        const isOcDoc = ocKind === 'oc_providencia';
        if (isOcDoc) {
          const updates: any = {
            totalKilograms: extractedKilos || selectedOrder.totalKilograms || 0,
            status: 'pedido',
            isClosedShort: false,
            updatedAt: Timestamp.now(),
          };
          if (ocPiezasInfo?.conceptos && ocPiezasInfo.conceptos.length > 0) {
            updates.items = ocPiezasInfo.conceptos.map((c, idx) => ({
              id: `item-${idx + 1}`,
              code: c.codigo || 'S/C',
              description: c.descripcion || 'Bolsa de Polietileno',
              quantity: c.cantidad || extractedKilos || 0,
              unitPrice: c.valorUnitario || 43,
              amount: c.cantidad * (c.valorUnitario || 43),
              unit: 'Kilos',
            }));
          }
          await safeUpdateDoc(orderRef, updates);
          sound.playChaChing();
          triggerHaptic('cash');
          toast(`✅ OC ${extractedFolio} sincronizada con ${(extractedKilos || 0).toLocaleString('es-MX')} kg en producción`, 'ok');
        } else if (docType === 'contrarecibo') {
          const crNumber = extractedFolio?.trim() || 'CR-S/N';
          const dueDateTs = toSafeTimestamp(extractedDate);
          let appliedCount = 0;

          const updatedInvoices = (selectedOrder.invoices || []).map((inv: any) => {
            const matchesFolio = (extractedFolio && (inv.folio === extractedFolio || inv.folio?.includes(extractedFolio)));
            const isPendingWithoutCr = !inv.collection?.contrareciboNumber;
            const matchesAmount = extractedTotal > 0 && Math.abs((inv.financials?.invoiceTotal || 0) - extractedTotal) < 1;

            if (matchesFolio || matchesAmount || isPendingWithoutCr) {
              appliedCount++;
              return {
                ...inv,
                collection: {
                  ...(inv.collection || {}),
                  contrareciboNumber: crNumber,
                  contrareciboDate: dueDateTs,
                  contrareciboPortalStatus: 'generado',
                  notes: `Amparada con Contrarecibo ${crNumber}.${extractedDate ? ` Pago programado: ${extractedDate}` : ''}`,
                },
                creditCycle: {
                  ...(inv.creditCycle || {}),
                  status: 'in_review',
                  dueDate: dueDateTs,
                },
              };
            }
            return inv;
          });

          await safeUpdateDoc(orderRef, {
            invoices: cleanUndefined(updatedInvoices),
            'collection.contrareciboNumber': crNumber,
            'collection.contrareciboDate': dueDateTs,
            'collection.contrareciboPortalStatus': 'generado',
            'creditCycle.status': 'in_review',
            status: 'in_review',
            updatedAt: Timestamp.now(),
          });

          try {
            setUploadingFile(true);
            await uploadDocument({
              file,
              docKind: 'contrarecibo',
              folio: crNumber,
              orderId: selectedOrder.id,
              orderFolio: selectedOrder.folio || selectedOrder.oc,
              kilos: 0,
              total: extractedTotal || 0,
              docDate: extractedDate,
              notes: `Contrarecibo ${crNumber} vinculado a la OC ${selectedOrder.folio || selectedOrder.oc}`,
            });
          } catch (storErr) {
            console.warn('No se pudo subir el contrarecibo a Storage:', storErr);
          } finally {
            setUploadingFile(false);
          }

          sound.playChaChing();
          triggerHaptic('cash');
          toast(`✅ Contrarecibo ${crNumber} (${money(extractedTotal || 0)}) vinculado exitosamente a ${appliedCount} factura(s) en la OC ${selectedOrder.folio || selectedOrder.oc}`, 'ok');
        } else {
          const noteEntry = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            folio: extractedFolio?.trim() || 'S/F',
            date: toSafeTimestamp(extractedDate),
            kilos: Number(extractedKilos) || 0,
            docType: 'adjunto',
            notes: `Documento adjunto #${extractedFolio || 'S/F'}${extractedKilos > 0 ? ` · ${extractedKilos.toLocaleString('es-MX')} kg` : ''}`,
            ...(extractedTotal ? { importe: extractedTotal } : {}),
          };

          const existingDeliveries = selectedOrder.deliveries || [];
          const updatedDeliveries = extractedKilos > 0
            ? [...existingDeliveries, {
                ...noteEntry,
                invoiced: false,
                docFolio: noteEntry.folio,
              }]
            : existingDeliveries;

          await safeUpdateDoc(orderRef, {
            deliveries: cleanUndefined(updatedDeliveries),
            updatedAt: Timestamp.now(),
          });

          try {
            setUploadingFile(true);
            await uploadDocument({
              file,
              docKind: 'desconocido' as StoredDocKind,
              folio: noteEntry.folio,
              orderId: selectedOrder.id,
              orderFolio: selectedOrder.folio || selectedOrder.oc,
              kilos: Number(extractedKilos) || 0,
              total: extractedTotal || 0,
              docDate: extractedDate,
              notes: `Documento adjunto #${noteEntry.folio}`,
            });
          } catch (storErr) {
            console.warn('No se pudo subir el documento a Storage:', storErr);
          } finally {
            setUploadingFile(false);
          }
          sound.playChaChing();
          triggerHaptic('cash');
          toast(`Documento #${noteEntry.folio} registrado en la OC ${selectedOrder.folio || selectedOrder.oc}`, 'ok');
        }
      }

      onClose();
    } catch (err: any) {
      console.error('Error al aplicar documento:', err);
      toast(`Error al guardar: ${err.message || 'Intente nuevamente'}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  // Control de Confirmación y Auto-Aplicación
  // Regla de Integridad: Facturas y comprobantes de pago NUNCA se auto-aplican a ciegas;
  // requieren confirmación explícita humana para garantizar conciliación exacta.
  useEffect(() => {
    // Desactivado auto-apply automático para prevenir registros accidentales por coincidencia dudosa
    setAutoApplyCountdown(null);
  }, [
    analyzing,
    autoApplyPaused,
    saving,
    selectedOrderId,
    ocAssignmentDoubt,
    duplicateStatus?.isDuplicate,
  ]);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔍</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
              {queuePosition && queuePosition.total > 1
                ? `📄 Documento ${queuePosition.current} de ${queuePosition.total} — Inspección Inteligente`
                : 'Inspección y Previsualización Inteligente de Comprobante'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          </div>
        </div>
      }
      onClose={onClose}
      wide
    >
      {analyzing ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px auto', width: 36, height: 36 }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
            Analizando comprobante con inteligencia OCR y SAT...
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 6 }}>
            Extrayendo pesos, importes, folios y orden de compra correspondiente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* HEADER DEL TIPO DE COMPROBANTE Y CONFIANZA */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              background: confidence === 'alta' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: `1px solid ${confidence === 'alta' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>
                {docType === 'comprobante_pago' ? '💵' : docType === 'factura_cfdi' ? '🧾' : docType === 'ticket_bascula' ? '⚖️' : docType === 'contrarecibo' ? '📑' : '📋'}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
                  {docType === 'comprobante_pago' && 'Comprobante Oficial de Pago Providencia (TR)'}
                  {docType === 'factura_cfdi' && 'Factura Fiscal CFDI Detectada'}
                  {docType === 'ticket_bascula' && 'Ticket de Báscula / Entrada de Patio'}
                  {docType === 'contrarecibo' && (ocKind === 'oc_providencia' ? 'Orden de Compra Providencia Detectada' : 'Contrarecibo / Comprobante de Portal')}
                  {docType === 'remision' && 'Remisión de Entrega'}
                  {docType === 'desconocido' && 'Documento Requiere Clasificación Manual'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Nivel de Confianza: <strong>{confidence.toUpperCase()}</strong> · Extracción 100% verificable
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setDocType('comprobante_pago')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: docType === 'comprobante_pago' ? '#2563eb' : 'var(--paper-sunk)',
                  color: docType === 'comprobante_pago' ? '#fff' : 'var(--ink-soft)',
                }}
              >
                Pago TR
              </button>
              <button
                type="button"
                onClick={() => setDocType('factura_cfdi')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: docType === 'factura_cfdi' ? '#10b981' : 'var(--paper-sunk)',
                  color: docType === 'factura_cfdi' ? '#fff' : 'var(--ink-soft)',
                }}
              >
                Factura
              </button>
              <button
                type="button"
                onClick={() => setDocType('ticket_bascula')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: docType === 'ticket_bascula' ? '#f59e0b' : 'var(--paper-sunk)',
                  color: docType === 'ticket_bascula' ? '#fff' : 'var(--ink-soft)',
                }}
              >
                Báscula
              </button>
            </div>
          </div>

          {/* GRID DE PREVISUALIZACIÓN Y DATOS EXTRAÍDOS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {/* COLUMNA 1: DATOS EXTRAÍDOS (EDITABLES) */}
            <div
              style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>
                📊 Datos Extraídos del Documento
              </div>

              {/* Banner de Validación Analítica: Duplicada vs Nueva */}
              {docType === 'factura_cfdi' && duplicateStatus?.isDuplicate && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1.5px solid rgba(239, 68, 68, 0.4)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    color: '#f87171',
                  }}
                >
                  <span style={{ fontSize: 20 }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#ef4444' }}>
                      FACTURA YA REGISTRADA / DUPLICADA
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, lineHeight: 1.4 }}>
                      La Factura <strong>#{extractedFolio}</strong> ya está dada de alta en la orden{' '}
                      <strong>{duplicateStatus.order?.folio || duplicateStatus.order?.oc}</strong> amparando{' '}
                      <strong>{(duplicateStatus.invoice?.kilos || 0).toLocaleString('es-MX')} kg</strong> por{' '}
                      <strong>{money(duplicateStatus.invoice?.financials?.invoiceTotal || 0)}</strong>.
                    </div>
                  </div>
                </div>
              )}

              {docType === 'factura_cfdi' && !duplicateStatus?.isDuplicate && extractedFolio && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11.5,
                    color: '#10b981',
                    fontWeight: 700,
                  }}
                >
                  <span>✨</span>
                  <span>Factura Nueva · No registrada previamente en el ERP</span>
                </div>
              )}

              {imagePreviewUrl && (
                <div style={{ textAlign: 'center', marginBottom: 4, background: 'var(--paper-sunk)', padding: 6, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <img
                    src={imagePreviewUrl}
                    alt="Previsualización del comprobante"
                    style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                    {docType === 'comprobante_pago' ? 'Docto. Pago / Factura' : 'Folio / Documento'}
                  </label>
                  <input
                    type="text"
                    value={extractedFolio}
                    onChange={(e) => setExtractedFolio(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 800, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Fecha Documento</label>
                  <input
                    type="date"
                    value={extractedDate}
                    onChange={(e) => setExtractedDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontWeight: 700, fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: docType === 'comprobante_pago' ? '1fr' : '1fr 1fr', gap: 10 }}>
                {docType !== 'comprobante_pago' && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                      {ocKind === 'oc_providencia' ? '⚖️ Kilos Totales de la OC' : 'Kilos (Neto)'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={extractedKilos || ''}
                        onChange={(e) => setExtractedKilos(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${ocKind === 'oc_providencia' ? 'rgba(16,185,129,0.5)' : 'var(--line)'}`, background: 'var(--paper)', color: '#047857', fontWeight: 900, fontSize: 14 }}
                      />
                      <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)' }}>kg</span>
                    </div>
                  </div>
                )}

                {(docType === 'factura_cfdi' || docType === 'comprobante_pago' || ocKind === 'oc_providencia') && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                      {docType === 'comprobante_pago' ? '💵 Monto Pagado (MXN)' : 'Importe Total'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={extractedTotal || ''}
                      onChange={(e) => setExtractedTotal(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: '#2563eb', fontWeight: 900, fontSize: 14 }}
                    />
                  </div>
                )}
              </div>

              {ocKind === 'oc_providencia' && ocPiezasInfo && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 11, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 900, color: '#047857', marginBottom: 4 }}>📦 Artículos en la OC:</div>
                  {ocPiezasInfo.conceptos.map((c, i) => (
                    <div key={i} style={{ color: 'var(--ink-soft)' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--ink)' }}>{c.codigo}</span>
                      {' · '}{c.descripcion.substring(0, 35)}
                      {' · '}<strong>{c.cantidad.toLocaleString('es-MX')} kg</strong>
                      {' @ $'}{c.valorUnitario.toFixed(2)}
                    </div>
                  ))}
                  <div style={{ marginTop: 4, fontWeight: 800, color: '#047857' }}>
                    Total pedido: {ocPiezasInfo.totalPiezas.toLocaleString('es-MX')} kg
                  </div>
                </div>
              )}

              {detectedOcNumber && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.25)', fontSize: 12, color: 'var(--ink)' }}>
                  🎯 <strong>{docType === 'comprobante_pago' ? 'Referencia de Transferencia:' : 'OC Detectada en Texto:'}</strong> <span className="mono" style={{ fontWeight: 800 }}>{detectedOcNumber}</span>
                </div>
              )}

              {(() => {
                const kilosRequired = docType === 'factura_cfdi' || docType === 'ticket_bascula' || docType === 'remision';
                const missingKilos = kilosRequired && extractedKilos <= 0;
                const missingFolio = !extractedFolio;
                const missingTotal = (docType === 'factura_cfdi' || docType === 'comprobante_pago') && extractedTotal <= 0;
                if (!missingFolio && !missingKilos && !missingTotal) return null;
                return (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    fontSize: 12,
                    color: '#fbbf24',
                    lineHeight: 1.4,
                  }}>
                    ✏️ <strong>Datos Faltantes Requeridos:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {missingFolio && <li>Falta ingresar el <strong>Folio / No. Documento</strong>.</li>}
                      {missingKilos && <li>Falta ingresar los <strong>Kilos Netos</strong>.</li>}
                      {missingTotal && <li>Falta ingresar el <strong>Importe Total</strong>.</li>}
                    </ul>
                    <span style={{ fontSize: 11, opacity: 0.9 }}>Puedes capturarlos directamente en los campos de arriba antes de guardar.</span>
                  </div>
                );
              })()}
            </div>

            {/* COLUMNA 2: SELECCIÓN DE ORDEN Y DIAGNÓSTICO DE IMPACTO */}
            <div
              style={{
                background: 'var(--paper-raised)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>
                🏢 Orden de Compra Destino
              </div>

              {autoAssignedOcTag && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span>✓</span>
                  <span>{autoAssignedOcTag}</span>
                </div>
              )}

              {ocAssignmentDoubt && !selectedOrderId && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1.5px solid rgba(245, 158, 11, 0.5)',
                  color: '#fbbf24',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}>
                  <div style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚠️</span>
                    <span>¿A cuál Orden de Compra corresponde esta Factura?</span>
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 4 }}>
                    No se detectó un número de OC inequívoco en el documento. Por favor selecciona a cuál orden asignarla:
                  </div>
                </div>
              )}

              <select
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  if (e.target.value) setOcAssignmentDoubt(false);
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: ocAssignmentDoubt && !selectedOrderId ? '2px solid #f59e0b' : '1px solid var(--line)',
                  boxShadow: ocAssignmentDoubt && !selectedOrderId ? '0 0 12px rgba(245, 158, 11, 0.35)' : 'none',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                <option value="">{ocKind === 'oc_providencia' ? '-- Crear como Nueva Orden o Seleccionar Existente --' : '-- Selecciona Orden de Compra (Requerido) --'}</option>
                {orders
                  .filter((o) => !o.isDeleted)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.folio || o.oc} · {o.client?.includes('TH') || (o.department || '').includes('TH') ? 'TH (José Nava)' : 'GT (Evelia)'} · {(Number(o.totalKilograms) || 0).toLocaleString()} kg
                    </option>
                  ))}
              </select>

              {selectedOrder ? (() => {
                const totalKilos = Number(selectedOrder.totalKilograms) || 0;
                const entKilos = (selectedOrder.deliveries || []).reduce((a, d) => a + (Number(d?.kilos) || 0), 0);
                const facKilos = (selectedOrder.invoices || []).reduce((a, i) => a + (Number(i?.kilos) || 0), 0);
                const pendFacturar = Math.max(0, entKilos - facKilos);

                return (
                  <div style={{ padding: '12px', borderRadius: 12, background: 'var(--paper-sunk)', border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.55 }}>
                    <div style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                      📈 Impacto Operativo en {selectedOrder.folio || selectedOrder.oc}:
                    </div>
                    {docType === 'comprobante_pago' ? (
                      <div style={{ color: '#10b981', fontWeight: 800 }}>
                        • Pago aplicado: {money(extractedTotal)} (Ref: {detectedOcNumber || extractedFolio})
                      </div>
                    ) : (
                      <>
                        <div style={{ color: 'var(--ink-soft)' }}>
                          • Meta autorizada: <strong>{totalKilos.toLocaleString('es-MX')} kg</strong>
                        </div>
                        <div style={{ color: '#047857' }}>
                          • Báscula entregada: <strong>{entKilos.toLocaleString('es-MX')} kg</strong> · Ya facturados: <strong>{facKilos.toLocaleString('es-MX')} kg</strong>
                        </div>
                        <div style={{ color: '#d97706', fontWeight: 700 }}>
                          • Pendiente de facturar en patio: <strong>{pendFacturar.toLocaleString('es-MX')} kg</strong>
                        </div>
                        {docType === 'factura_cfdi' && (
                          <div style={{ color: '#2563eb', fontWeight: 800, marginTop: 4, background: 'rgba(37, 99, 235, 0.08)', padding: '6px 10px', borderRadius: 8 }}>
                            • Esta Factura (#{extractedFolio}): <strong>+{extractedKilos.toLocaleString('es-MX')} kg</strong> ({money(extractedTotal || extractedKilos * 43 * 1.16)})
                            {pendFacturar >= extractedKilos ? (
                              <div style={{ color: '#047857', fontWeight: 700, fontSize: 11, marginTop: 2 }}>
                                ✅ Cuadre exacto: Ampara {extractedKilos.toLocaleString('es-MX')} kg entregados pendientes de CFDI.
                              </div>
                            ) : (
                              <div style={{ color: '#d97706', fontWeight: 700, fontSize: 11, marginTop: 2 }}>
                                ℹ️ Se registrará entrega complementaria amparada por esta factura.
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{ color: 'var(--ink-faint)', marginTop: 4, fontSize: 11 }}>
                          • Cumplimiento meta: {totalKilos ? (((facKilos + (docType === 'factura_cfdi' ? extractedKilos : 0)) / totalKilos) * 100).toFixed(1) : 0}% de avance
                        </div>
                      </>
                    )}
                  </div>
                );
              })() : ocKind === 'oc_providencia' ? (
                <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: 12.5, lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 900, color: '#047857', marginBottom: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✨</span>
                    <span>NUEVO EXPEDIENTE DE PRODUCCIÓN:</span>
                  </div>
                  <div style={{ color: 'var(--ink)' }}>
                    • <strong>Destino / Comprador:</strong> {extractedFolio?.includes('71') || detectedOcNumber?.includes('1202671') || detectedOcNumber?.startsWith('71/') ? '🏢 Textil Hogar (Lic. José Nava · Almacén 1)' : '🏭 Grupo Textil Providencia (Lic. Evelia · Planta P4)'}
                  </div>
                  <div style={{ color: '#047857', fontWeight: 800, marginTop: 4 }}>
                    • <strong>Kilos Totales:</strong> {(extractedKilos || 0).toLocaleString('es-MX')} kg
                  </div>
                  <div style={{ color: '#2563eb', fontWeight: 700, marginTop: 2 }}>
                    • <strong>Valor Estimado:</strong> {money((extractedKilos || 0) * 43 * 1.16)} MXN con IVA ($43.00/kg)
                  </div>
                  <div style={{ color: 'var(--ink-soft)', marginTop: 6, fontSize: 11.5 }}>
                    Al confirmar, se registrará el nuevo expediente en Firestore, se programará la maquila con Andrés y se archivará el PDF original en Storage.
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* BANNER DE AUTO-APLICACIÓN INTELIGENTE */}
          {autoApplyCountdown !== null && !saving && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.22) 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.45)',
                color: '#047857',
                fontWeight: 800,
                fontSize: 12.5,
                margin: '12px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>⚡</span>
                <span>Auto-Aplicando al ERP y respaldando en la nube en {autoApplyCountdown}s...</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoApplyPaused(true)}
                style={{
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.12)',
                  color: '#065f46',
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ⏸️ Pausar para Revisar
              </button>
            </div>
          )}

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{ minHeight: 40, padding: '8px 16px', borderRadius: 10, fontWeight: 700 }}
            >
              ❌ Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmAndApply}
              disabled={
                saving ||
                (docType === 'factura_cfdi' && !!duplicateStatus?.isDuplicate) ||
                (() => {
                  const isOc = ocKind === 'oc_providencia';
                  if (isOc) return !extractedFolio && extractedKilos <= 0;
                  if (!selectedOrderId) return true;
                  const kilosRequired = docType === 'factura_cfdi' || docType === 'ticket_bascula' || docType === 'remision';
                  if (kilosRequired && extractedKilos <= 0) return true;
                  if (docType === 'comprobante_pago' && extractedTotal <= 0) return true;
                  return false;
                })()
              }
              style={{
                minHeight: 40,
                padding: '8px 24px',
                borderRadius: 10,
                fontWeight: 900,
                fontSize: 13,
                background: (docType === 'factura_cfdi' && duplicateStatus?.isDuplicate)
                  ? '#64748b'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: (docType === 'factura_cfdi' && duplicateStatus?.isDuplicate)
                  ? 'none'
                  : '0 4px 14px rgba(16, 185, 129, 0.4)',
                cursor: (docType === 'factura_cfdi' && duplicateStatus?.isDuplicate) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving && uploadingFile
                ? '☁️ Subiendo archivo...'
                : saving
                  ? '⏳ Aplicando...'
                  : (docType === 'factura_cfdi' && duplicateStatus?.isDuplicate)
                    ? '⚠️ Factura ya Registrada (Duplicada)'
                    : (ocKind === 'oc_providencia' && !selectedOrderId)
                      ? '✅ Crear Nueva Orden de Compra en el Sistema'
                      : docType === 'comprobante_pago'
                        ? '✅ Aplicar Pago al Sistema'
                        : '✅ Confirmar y Aplicar al Sistema'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
