import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseXmlInvoice } from '../../lib/xmlParser';
import { extractTextFromPdf, parseOcrData } from '../../lib/ocr';
import { parseOrdenDeCompra } from '../../lib/ocParser';
import { useConfig } from '../../hooks/useConfig';
import { useToast } from '../../context/ToastContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../lib/firebase';
import { useOrders } from '../../hooks/useOrders';
import { checkAllDuplicates, type DuplicateMatch } from '../../lib/duplicateGuards';
import { kilos, money } from '../../lib/format';
import {
  evaluateDocumentOperation,
  executeAutoCreateOc,
  executeAutoAssignInvoice,
  type OperationDecision,
  type SuggestedAction,
} from '../../lib/autoDocumentProcessor';
import { OperationDoubtModal } from './OperationDoubtModal';
import confetti from 'canvas-confetti';

export interface ExtractedDocumentData {
  type: 'xml_factura' | 'pdf_document' | 'text_pasted' | 'contrarecibo' | 'orden_compra' | 'complemento_pago';
  rawText?: string;
  fileName?: string;
  uuid?: string;
  folio?: string;
  oc?: string;
  ocFolio?: string;
  contrarecibo?: string;
  complementoFolio?: string;
  complementoUuid?: string;
  kilos?: number;
  subtotal?: number;
  iva?: number;
  total?: number;
  client?: string;
  department?: 'TH' | 'GT';
  date?: string;
  dueDate?: string;
  items?: Array<{
    code?: string;
    description: string;
    quantity: number;
    unitPrice?: number;
    amount?: number;
  }>;
  confidence: number;
  duplicateMatch?: DuplicateMatch | null;
}

export interface BatchItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: 'processing' | 'ready' | 'error';
  data?: ExtractedDocumentData;
  duplicateMatch?: DuplicateMatch | null;
  error?: string;
}

interface SmartDocumentDropzoneProps {
  onDocumentProcessed: (doc: ExtractedDocumentData) => void;
  onBatchProcessed?: (docs: ExtractedDocumentData[]) => void;
}

export function SmartDocumentDropzone({ onDocumentProcessed, onBatchProcessed }: SmartDocumentDropzoneProps) {
  const toast = useToast();
  const { orders } = useOrders();
  const { config } = useConfig();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [activeDoubt, setActiveDoubt] = useState<{
    decision: OperationDecision & { type: 'doubt' };
    docData: ExtractedDocumentData;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileProcessRef = useRef<(file: File) => Promise<void>>(async () => {});
  const handleTextProcessRef = useRef<(text: string) => void>(() => {});

  // Extraer datos de un solo archivo (XML o PDF/Imagen)
  const extractFromFile = useCallback(async (file: File): Promise<ExtractedDocumentData> => {
    const fileName = file.name.toLowerCase();

    // Caso 1: Archivo XML (CFDI del SAT)
    if (fileName.endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml') {
      const text = await file.text();
      const parsed = parseXmlInvoice(text);
      const dept: 'TH' | 'GT' = (parsed.receptorNombre || '').toUpperCase().includes('GT') ? 'GT' : 'TH';
      const totalKilos = parsed.conceptos.reduce((acc, c) => acc + (c.cantidad || 0), 0);

      const folioMatch = text.match(/Folio="([^"]+)"/i) || text.match(/folio="([^"]+)"/i);
      const folio = folioMatch ? folioMatch[1] : '';
      const ocMatch = text.match(/1202\d{6,8}/) || text.match(/OC[-\s]?(\d+)/i);
      const ocFolio = ocMatch ? ocMatch[0] : undefined;

      if (parsed.complementoPago && parsed.complementoPago.doctosRelacionados.length > 0) {
        const docRel = parsed.complementoPago.doctosRelacionados[0];
        return {
          type: 'complemento_pago',
          fileName: file.name,
          uuid: docRel.idDocumento || parsed.uuid,
          folio: docRel.folio || undefined,
          complementoFolio: parsed.folio || undefined,
          complementoUuid: parsed.uuid,
          total: parsed.complementoPago.montoTotal || parsed.total,
          client: parsed.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          department: dept,
          date: parsed.complementoPago.fechaPago ? parsed.complementoPago.fechaPago.split('T')[0] : parsed.fecha.split('T')[0],
          confidence: 1.0,
        };
      }

      return {
        type: 'xml_factura',
        fileName: file.name,
        uuid: parsed.uuid,
        folio: parsed.folio || folio || undefined,
        ocFolio: parsed.ocNumber || ocFolio || undefined,
        kilos: totalKilos > 0 ? totalKilos : undefined,
        subtotal: parsed.subTotal,
        iva: parsed.total - parsed.subTotal,
        total: parsed.total,
        client: parsed.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
        department: dept,
        date: parsed.fecha ? parsed.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
        items: parsed.conceptos.map((c) => ({
          description: c.descripcion,
          quantity: c.cantidad,
          unitPrice: c.valorUnitario,
          amount: c.importe,
        })),
        confidence: 1.0,
      };
    }

    // Caso 2: Archivo PDF o Imagen (Extractor Local + IA Gemini)
    if (fileName.endsWith('.pdf') || file.type === 'application/pdf' || file.type.startsWith('image/')) {
      // 1. Intentar extracción directa de texto PDF en el cliente (Ultra-rápido y offline)
      if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
        try {
          const pdfText = await extractTextFromPdf(file);
          if (pdfText && pdfText.trim().length > 25) {
            const lowerPdf = pdfText.toLowerCase();

            // A) Es una Orden de Compra (Providencia / Nava / Evelia)
            const isOC =
              (lowerPdf.includes('orden de compra') ||
                lowerPdf.includes('cdb oc:') ||
                lowerPdf.includes('no. ord. de compra:') ||
                /12026\d{6,8}/.test(pdfText)) &&
              !lowerPdf.includes('sello digital') &&
              !lowerPdf.includes('folio fiscal');

            if (isOC) {
              const parsed = parseOrdenDeCompra(pdfText);
              const totalKg = parsed.totalKilograms;
              return {
                type: 'orden_compra',
                rawText: pdfText,
                fileName: file.name,
                oc: parsed.oc,
                ocFolio: parsed.oc,
                folio: parsed.folio || parsed.oc,
                kilos: totalKg,
                subtotal: totalKg * 43,
                iva: totalKg * 43 * 0.16,
                total: totalKg * 43 * 1.16,
                client: parsed.client || (parsed.department === 'GT' ? 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)' : 'TEXTIL HOGAR (TH - NAVA)'),
                department: parsed.department,
                date: new Date().toISOString().split('T')[0],
                dueDate: parsed.estimatedDeliveryDate ? parsed.estimatedDeliveryDate.toISOString().split('T')[0] : undefined,
                items: parsed.items.map((it) => ({
                  code: it.code,
                  description: it.description,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  amount: it.amount,
                })),
                confidence: 1.0,
              };
            }

            // B) Es una Factura / CFDI en PDF (SAT / Blikon / Elemental Denim)
            const isFactura =
              lowerPdf.includes('factura') ||
              lowerPdf.includes('folio fiscal') ||
              lowerPdf.includes('uuid') ||
              lowerPdf.includes('cfdi') ||
              lowerPdf.includes('sello digital');

            if (isFactura) {
              const ocr = parseOcrData(pdfText);
              return {
                type: 'pdf_document',
                rawText: pdfText,
                fileName: file.name,
                uuid: ocr.uuid,
                folio: ocr.folio,
                oc: ocr.ocNumber,
                ocFolio: ocr.ocNumber,
                kilos: ocr.kilos,
                subtotal: ocr.subTotal,
                iva: ocr.total && ocr.subTotal ? ocr.total - ocr.subTotal : undefined,
                total: ocr.total,
                client: ocr.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
                department: ocr.ocNumber && ocr.ocNumber.startsWith('1202671') ? 'TH' : 'GT',
                date: ocr.fecha || new Date().toISOString().split('T')[0],
                confidence: 0.95,
              };
            }
          }
        } catch (pdfErr) {
          console.warn('Extracción local PDF falló, usando fallback', pdfErr);
        }
      }

      // 2. Fallback: Procesamiento mediante Cloud Function / Gemini
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.onerror = reject;
      });

      try {
        const aiFunctions = getFunctions(app, 'us-central1');
        const processDoc = httpsCallable(aiFunctions, 'parseDocumentData');
        const result = await processDoc({ fileBase64: base64, mimeType: file.type || 'application/pdf' });
        const d: any = result.data || {};

        const totalKilos = d.kilosTotales || d.kilos || (d.conceptos?.reduce((acc: number, c: any) => acc + (c.cantidad || 0), 0)) || undefined;
        const subtotal = d.subtotal || undefined;
        const total = d.total || (subtotal ? subtotal * 1.16 : undefined);

        const dept: 'TH' | 'GT' = (d.departamento === 'GT' || (d.cliente || '').toUpperCase().includes('GT') || (d.entidad || '').toUpperCase().includes('GT')) ? 'GT' : 'TH';
        const officialOc = d.oc || d.ordenCompra || d.ocFolio || (d.folio && d.folio.startsWith('12026') ? d.folio : undefined);
        const internalFolio = (d.folio && !d.folio.startsWith('12026')) ? d.folio : (d.folioOC || d.numeroOrden || undefined);

        return {
          type: (d.tipoDocumento === 'orden_compra' || d.tipoDocumento === 'oc' || !!officialOc) ? 'orden_compra' : d.tipoDocumento === 'contrarecibo' ? 'contrarecibo' : 'pdf_document',
          fileName: file.name,
          oc: officialOc,
          ocFolio: officialOc,
          folio: internalFolio || d.folio || undefined,
          contrarecibo: d.contrarecibo || d.numeroContrarecibo || undefined,
          kilos: totalKilos,
          subtotal,
          iva: total && subtotal ? total - subtotal : undefined,
          total,
          client: d.entidad || d.cliente || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          department: dept,
          date: d.fecha || new Date().toISOString().split('T')[0],
          dueDate: d.fechaEntrega || d.fechaVencimiento || undefined,
          items: (d.conceptos || []).map((c: any) => ({
            code: c.codigo || c.code || '',
            description: c.descripcion || c.description || 'Bolsa de Polietileno',
            quantity: Number(c.cantidad || c.quantity || 0),
            unitPrice: Number(c.precioUnitario || c.unitPrice || 43.0),
            amount: Number(c.importe || c.amount || ((c.cantidad || 0) * (c.precioUnitario || 43.0))),
          })),
          confidence: 0.95,
        };
      } catch (aiErr: any) {
        console.warn('Fallback a parser local', aiErr);
        return {
          type: 'pdf_document',
          fileName: file.name,
          client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          department: 'TH',
          confidence: 0.7,
        };
      }
    }

    throw new Error('Formato no soportado. Usa PDF, XML, JPG o PNG.');
  }, []);

  // Procesar archivo individual con motor autónomo y detector de dudas
  const handleFileProcess = useCallback(async (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage(`Analizando documento: ${file.name}...`);

    try {
      const docData = await extractFromFile(file);

      // Radar Antiduplicados en tiempo real
      const duplicate = checkAllDuplicates(orders, {
        oc: docData.ocFolio || docData.oc,
        invoiceFolio: docData.folio,
        uuid: docData.uuid,
        contrarecibo: docData.contrarecibo,
      });

      docData.duplicateMatch = duplicate;

      // 🧠 EVALUACIÓN AUTÓNOMA: Procesar directamente o preguntar en caso de duda
      const decision = evaluateDocumentOperation(docData, orders, config);

      if (decision.type === 'auto_create_oc') {
        await executeAutoCreateOc(docData, config);
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        toast(`⚡ Procesado Automáticamente: ${decision.summary}`, 'ok');
      } else if (decision.type === 'auto_assign_invoice') {
        await executeAutoAssignInvoice(docData, decision.targetOrder, config);
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        toast(`⚡ Procesado Automáticamente: ${decision.summary}`, 'ok');
      } else if (decision.type === 'doubt') {
        // En caso de duda: ¡preguntar al usuario con el modal interactivo!
        setActiveDoubt({ decision, docData });
      }

      onDocumentProcessed(docData);
    } catch (err: any) {
      toast(`Error al procesar archivo: ${err.message}`, 'bad');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [extractFromFile, orders, config, onDocumentProcessed, toast]);

  // Manejar respuesta del usuario ante una duda de la operación
  const handleResolveDoubt = useCallback(async (action: SuggestedAction) => {
    if (!activeDoubt) return;
    const { docData, decision } = activeDoubt;

    try {
      if (action.actionType === 'create_new_oc') {
        await executeAutoCreateOc(docData, config);
        confetti({ particleCount: 100, spread: 60 });
        toast('✅ Nuevo expediente creado y registrado en el ERP', 'ok');
      } else if (action.actionType === 'assign_to_order' && action.orderId) {
        const target = orders.find((o) => o.id === action.orderId);
        if (target) {
          await executeAutoAssignInvoice(docData, target, config);
          confetti({ particleCount: 100, spread: 60 });
          toast(`✅ Factura #${docData.folio} vinculada a la OC ${target.folio || target.oc}`, 'ok');
        }
      } else if (action.actionType === 'replace_invoice' && decision.targetOrder) {
        await executeAutoAssignInvoice(docData, decision.targetOrder, config);
        toast(`✅ Factura #${docData.folio} actualizada en el expediente`, 'ok');
      } else if (action.actionType === 'force_assign' && decision.targetOrder) {
        await executeAutoAssignInvoice(docData, decision.targetOrder, config);
        confetti({ particleCount: 100, spread: 60 });
        toast(`✅ Documento vinculado al expediente`, 'ok');
      } else if (action.actionType === 'skip') {
        toast('Operación omitida por el usuario', 'info');
      }
    } catch (err: any) {
      toast(`Error al ejecutar resolución: ${err.message}`, 'bad');
    } finally {
      setActiveDoubt(null);
    }
  }, [activeDoubt, orders, config, toast]);

  // Procesar lote de múltiples archivos
  const handleBatchProcess = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;

    setIsBatchProcessing(true);
    const initialItems: BatchItem[] = files.map((f, i) => ({
      id: `batch_${Date.now()}_${i}`,
      fileName: f.name,
      fileSize: f.size,
      status: 'processing',
    }));

    setBatchItems(initialItems);
    toast(`📦 Procesando lote de ${files.length} archivos en paralelo...`, 'info');

    const processedDocs: ExtractedDocumentData[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const docData = await extractFromFile(file);

        // Radar Antiduplicados
        const duplicate = checkAllDuplicates(orders, {
          oc: docData.ocFolio || docData.oc,
          invoiceFolio: docData.folio,
          uuid: docData.uuid,
          contrarecibo: docData.contrarecibo,
        });

        docData.duplicateMatch = duplicate;
        processedDocs.push(docData);

        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'ready',
                  data: docData,
                  duplicateMatch: duplicate,
                }
              : item
          )
        );
      } catch (err: any) {
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: 'error',
                  error: err.message || 'Error al extraer',
                }
              : item
          )
        );
      }
    }

    setIsBatchProcessing(false);
    toast(`🎉 Lote finalizado: ${processedDocs.length} de ${files.length} procesados`, 'ok');

    if (onBatchProcessed && processedDocs.length > 0) {
      onBatchProcessed(processedDocs);
    }
  }, [extractFromFile, orders, onBatchProcessed, toast]);

  // Procesar texto pegado
  const handleTextProcess = useCallback((text: string) => {
    setIsProcessing(true);
    setStatusMessage('Analizando contenido del portapapeles...');

    try {
      const clean = text.trim();

      if (clean.startsWith('<?xml') || clean.includes('<cfdi:Comprobante') || clean.includes('<Comprobante')) {
        const parsed = parseXmlInvoice(clean);
        const dept: 'TH' | 'GT' = (parsed.receptorNombre || '').toUpperCase().includes('GT') ? 'GT' : 'TH';

        if (parsed.complementoPago && parsed.complementoPago.doctosRelacionados.length > 0) {
          const docRel = parsed.complementoPago.doctosRelacionados[0];
          const docData: ExtractedDocumentData = {
            type: 'complemento_pago',
            rawText: clean.slice(0, 300),
            uuid: docRel.idDocumento || parsed.uuid,
            folio: docRel.folio || undefined,
            complementoFolio: parsed.folio || undefined,
            complementoUuid: parsed.uuid,
            total: parsed.complementoPago.montoTotal || parsed.total,
            client: parsed.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            department: dept,
            date: parsed.complementoPago.fechaPago ? parsed.complementoPago.fechaPago.split('T')[0] : parsed.fecha.split('T')[0],
            confidence: 1.0,
          };

          const duplicate = checkAllDuplicates(orders, {
            invoiceFolio: docData.folio,
            uuid: docData.uuid,
          });
          docData.duplicateMatch = duplicate;

          toast(`✅ Complemento de Pago #${parsed.folio || ''} (Factura #${docRel.folio || ''}) detectado`, 'ok');
          onDocumentProcessed(docData);
          setShowTextModal(false);
          setPasteText('');
          return;
        }

        const totalKilos = parsed.conceptos.reduce((acc, c) => acc + (c.cantidad || 0), 0);

        const docData: ExtractedDocumentData = {
          type: 'xml_factura',
          rawText: clean.slice(0, 300),
          uuid: parsed.uuid,
          folio: parsed.folio || undefined,
          ocFolio: parsed.ocNumber || undefined,
          kilos: totalKilos > 0 ? totalKilos : undefined,
          subtotal: parsed.subTotal,
          iva: parsed.total - parsed.subTotal,
          total: parsed.total,
          client: parsed.receptorNombre || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          department: dept,
          date: parsed.fecha ? parsed.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
          items: parsed.conceptos.map((c) => ({
            description: c.descripcion,
            quantity: c.cantidad,
            unitPrice: c.valorUnitario,
            amount: c.importe,
          })),
          confidence: 1.0,
        };

        const duplicate = checkAllDuplicates(orders, {
          invoiceFolio: docData.folio,
          uuid: docData.uuid,
          oc: docData.ocFolio,
        });
        docData.duplicateMatch = duplicate;

        toast('✅ XML detectado desde el portapapeles', 'ok');
        onDocumentProcessed(docData);
        setShowTextModal(false);
        setPasteText('');
        return;
      }

      // Parseo de texto copiado de WhatsApp / Correo
      const ocMatch = clean.match(/\b(1202\d{6,8})\b/) || clean.match(/OC[:\s#-]*(\d{5,12})/i);
      const facturaMatch = clean.match(/Factura[:\s#-]*(\d{4,6})/i) || clean.match(/\b(6\d{3})\b/);
      const crMatch = clean.match(/\b(TH[-_ ]?\d{2,6})\b/i) || clean.match(/\b(GT[-_ ]?\d{2,6})\b/i) || clean.match(/Contrarecibo[:\s#-]*(\w+)/i);
      const kilosMatch = clean.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:kg|kilos|kgs)/i) || clean.match(/(\d{3,6})\s*(?:kg|kilos)/i);
      const montoMatch = clean.match(/\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/) || clean.match(/Total[:\s$]*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i);

      const parsedKilos = kilosMatch ? parseFloat(kilosMatch[1].replace(/,/g, '')) : undefined;
      const parsedMonto = montoMatch ? parseFloat(montoMatch[1].replace(/,/g, '')) : undefined;
      const dept: 'TH' | 'GT' = (crMatch && crMatch[1].toUpperCase().startsWith('GT')) || clean.toUpperCase().includes('GT') ? 'GT' : 'TH';

      const docData: ExtractedDocumentData = {
        type: crMatch ? 'contrarecibo' : facturaMatch ? 'xml_factura' : ocMatch ? 'orden_compra' : 'text_pasted',
        rawText: clean,
        ocFolio: ocMatch ? ocMatch[1] : undefined,
        folio: facturaMatch ? facturaMatch[1] : undefined,
        contrarecibo: crMatch ? crMatch[1].toUpperCase().replace(/\s+/g, '-') : undefined,
        kilos: parsedKilos,
        total: parsedMonto,
        subtotal: parsedMonto ? parsedMonto / 1.16 : undefined,
        department: dept,
        client: dept === 'GT' ? 'Grupo Textil Providencia - GT' : 'Grupo Textil Providencia - TH',
        confidence: 0.85,
      };

      const duplicate = checkAllDuplicates(orders, {
        oc: docData.ocFolio,
        invoiceFolio: docData.folio,
        contrarecibo: docData.contrarecibo,
      });
      docData.duplicateMatch = duplicate;

      toast(`✅ Datos extraídos del texto (${docData.type})`, 'ok');
      onDocumentProcessed(docData);
      setShowTextModal(false);
      setPasteText('');
    } catch (err: any) {
      toast(`No se pudo interpretar el texto: ${err.message}`, 'bad');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  }, [orders, onDocumentProcessed, toast]);

  useEffect(() => {
    handleFileProcessRef.current = handleFileProcess;
  }, [handleFileProcess]);

  useEffect(() => {
    handleTextProcessRef.current = handleTextProcess;
  }, [handleTextProcess]);

  // Escuchar evento de Pegado Global (Ctrl + V)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target.id !== 'magic-paste-textarea') {
        return;
      }

      if (e.clipboardData) {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          const files = Array.from(e.clipboardData.files);
          e.preventDefault();
          if (files.length === 1) {
            handleFileProcessRef.current(files[0]);
          } else {
            handleBatchProcess(files);
          }
          return;
        }

        const text = e.clipboardData.getData('text');
        if (text && text.trim().length > 10) {
          e.preventDefault();
          handleTextProcessRef.current(text);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handleBatchProcess]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 1) {
        handleFileProcess(files[0]);
      } else {
        handleBatchProcess(files);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 20 }}>
      {/* Dropzone Principal */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.003 }}
        style={{
          border: isDragging ? '2px dashed #3b82f6' : '2px dashed rgba(255, 255, 255, 0.25)',
          borderRadius: 18,
          padding: '28px 24px',
          background: isDragging
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)'
            : 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
          backdropFilter: 'blur(12px)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isDragging ? '0 0 25px rgba(59, 130, 246, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: 'none' }}
          accept=".pdf,.xml,image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const files = Array.from(e.target.files);
              if (files.length === 1) {
                handleFileProcess(files[0]);
              } else {
                handleBatchProcess(files);
              }
            }
          }}
        />

        {isProcessing || isBatchProcessing ? (
          <div style={{ padding: 12 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ fontSize: 36, marginBottom: 12, display: 'inline-block' }}
            >
              ⚡
            </motion.div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>
              {isBatchProcessing ? 'Procesando Lote de Documentos con Radar Antiduplicados...' : statusMessage}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
              Cotejando folios, UUID fiscal, clientes, kilos e importes en tiempo real...
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 6 }}>📥</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              <span className="hide-mobile">Arrastra o Sube tus Archivos (Individual o por Lotes)</span>
              <span className="show-mobile">📎 Toca para subir archivos</span>
            </div>
            <div className="hide-mobile" style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginTop: 4 }}>
              Soporta <strong>múltiples PDFs y XMLs simultáneos</strong> o presiona{' '}
              <kbd style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 6, fontWeight: 800, color: '#38bdf8' }}>
                Ctrl + V
              </kbd>{' '}
              para pegar del portapapeles
            </div>

            {/* Badges de Formatos Aceptados */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                📄 PDFs de OC o Factura
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                🧾 XMLs CFDI SAT (Lote)
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(217, 119, 6, 0.2)', color: '#fde68a', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
                🛡️ Radar Antiduplicado Activo
              </span>
            </div>

            {/* Botón Alternativo de Pegar Texto Manual */}
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTextModal(true);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>✏️</span> Escribir o Pegar Texto Manualmente
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Bandeja de Resultados de Lote (Multi-File Tray) */}
      {batchItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 16,
            background: 'var(--paper-raised)',
            border: '1.5px solid var(--line)',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📁</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
                Bandeja de Carga por Lote ({batchItems.filter((i) => i.status === 'ready').length} de {batchItems.length} listos)
              </span>
            </div>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setBatchItems([])}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8 }}
            >
              ✕ Limpiar Bandeja
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {batchItems.map((item) => {
              const d = item.data;
              const isXml = item.fileName.toLowerCase().endsWith('.xml');
              const isDup = Boolean(item.duplicateMatch?.exists);

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: isDup ? 'rgba(254, 243, 199, 0.5)' : 'var(--paper-sunk)',
                    border: isDup ? '1.5px solid #f59e0b' : '1px solid var(--line-soft)',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 22 }}>{isXml ? '🧾' : '📄'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>
                          {item.fileName}
                        </span>
                        {d?.type && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: d.type === 'xml_factura' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: d.type === 'xml_factura' ? '#059669' : '#2563eb',
                            }}
                          >
                            {d.type === 'xml_factura' ? 'CFDI SAT' : d.type === 'orden_compra' ? 'ORDEN DE COMPRA' : 'DOCUMENTO'}
                          </span>
                        )}
                        {isDup && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: '#d97706',
                              color: '#fff',
                            }}
                          >
                            ⚠️ YA REGISTRADO EN: {item.duplicateMatch?.orderFolio}
                          </span>
                        )}
                      </div>

                      {d && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {d.folio && <>Folio: <strong>{d.folio}</strong> · </>}
                          {d.ocFolio && <>OC: <strong>{d.ocFolio}</strong> · </>}
                          {d.kilos ? <>Kilos: <strong>{kilos(d.kilos)}</strong> · </> : null}
                          {d.total ? <>Total: <strong>{money(d.total)}</strong> · </> : null}
                          <span>{d.client}</span>
                        </div>
                      )}

                      {item.status === 'error' && (
                        <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 2 }}>
                          ❌ {item.error}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.status === 'ready' && d && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        onDocumentProcessed(d);
                        toast(`📥 Documento ${d.folio || d.ocFolio || item.fileName} cargado en el formulario`, 'ok');
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        background: isDup ? '#d97706' : '#2563eb',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isDup ? 'Revisar Duplicado ➔' : 'Cargar en Formulario ➔'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Modal para Pegar Texto Manual */}
      <AnimatePresence>
        {showTextModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setShowTextModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 20,
                width: '100%',
                maxWidth: 600,
                padding: 24,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--ink)' }}>
                    📋 Pegar Texto del Portal / XML
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Pega el texto de Providencia, la tabla de contrarecibos o el código XML de la factura
                  </div>
                </div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowTextModal(false)}
                  style={{ padding: '6px 12px', borderRadius: 8 }}
                >
                  ✕
                </button>
              </div>

              <textarea
                id="magic-paste-textarea"
                rows={8}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Pega aquí el contenido (ej. CFDI XML completo, tabla de contrarecibos TH-1234, o mensaje de correo de Providencia)..."
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  background: 'var(--field)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowTextModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 10 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!pasteText.trim()}
                  onClick={() => handleTextProcess(pasteText)}
                  style={{ padding: '8px 20px', borderRadius: 10, fontWeight: 800 }}
                >
                  Analizar y Cargar ➔
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Modal de Duda de Operación (Pregunta interactiva al usuario) */}
        {activeDoubt && (
          <OperationDoubtModal
            decision={activeDoubt.decision}
            onResolve={handleResolveDoubt}
            onClose={() => setActiveDoubt(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
