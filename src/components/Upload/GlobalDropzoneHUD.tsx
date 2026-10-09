import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalDropInspectorModal } from './GlobalDropInspectorModal';
import { useOrdersContext } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';
import { money } from '../../lib/format';
import {
  analyzeDocumentFast,
  applyDocumentFast,
  type PipelineAnalysis,
  type PipelineApplyResult,
} from '../../lib/autoDocumentPipeline';
import type { PurchaseOrder } from '../../lib/types';

interface BatchItemState {
  file: File;
  status: 'pending' | 'analyzing' | 'applying' | 'success' | 'duplicate' | 'needs_clarification' | 'error';
  analysis?: PipelineAnalysis;
  result?: PipelineApplyResult;
  errorMessage?: string;
}

export function GlobalDropzoneHUD() {
  const { orders } = useOrdersContext();
  const toast = useToast();

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cola de procesamiento automático en lote
  const [batchQueue, setBatchQueue] = useState<BatchItemState[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<{ total: number; success: number; dupes: number } | null>(null);

  // Modal inspector manual para casos excepcionales
  const [manualInspectFile, setManualInspectFile] = useState<File | null>(null);

  // Estados de control para importación forzada segura y aclaraciones interactivas
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [forceReplaceCr, setForceReplaceCr] = useState<boolean>(false);
  const [auditNote, setAuditNote] = useState<string>('');
  const [showConfirmationSummary, setShowConfirmationSummary] = useState<boolean>(false);

  // Sincronizar selección inicial cuando cambia el documento en revisión
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < batchQueue.length) {
      const itm = batchQueue[currentIndex];
      const defaultOrd = itm?.analysis?.duplicateOrder || itm?.analysis?.matchedOrder;
      setSelectedOrderId(defaultOrd?.id || '');
      setSelectedInvoiceId('');
      setForceReplaceCr(false);
      setAuditNote('');
      setShowConfirmationSummary(false);
    }
  }, [currentIndex, batchQueue]);

  // Escuchar Drag & Drop global y eventos de subida
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        dragCounter.current += 1;
        if (dragCounter.current === 1) {
          setIsDraggingOver(true);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDraggingOver(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        startBatchProcess(Array.from(files));
      }
    };

    const handleOpenUpload = () => {
      fileInputRef.current?.click();
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('open-global-file-upload', handleOpenUpload);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('open-global-file-upload', handleOpenUpload);
    };
  }, [orders]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      startBatchProcess(Array.from(files));
      e.target.value = '';
    }
  };

  // Iniciar la cola de procesamiento
  const startBatchProcess = (files: File[]) => {
    if (files.length === 0) return;
    triggerHaptic('light');
    setCompletedSummary(null);
    const initialItems: BatchItemState[] = files.map((file) => ({
      file,
      status: 'pending',
    }));
    setBatchQueue(initialItems);
    setCurrentIndex(0);
    setIsProcessing(true);
  };

  // Procesar elemento actual de la cola
  const processItemAt = useCallback(
    async (idx: number, queue: BatchItemState[]) => {
      if (idx < 0 || idx >= queue.length) {
        // Fin de la cola: calcular resumen
        const successCount = queue.filter((i) => i.status === 'success').length;
        const dupeCount = queue.filter((i) => i.status === 'duplicate').length;
        setCompletedSummary({ total: queue.length, success: successCount, dupes: dupeCount });
        setIsProcessing(false);

        if (successCount > 0) {
          sound.playChaChing();
          triggerHaptic('cash');
          toast(
            `🎉 ${successCount} documento(s) procesados, asignados y respaldados en la nube exitosamente.`,
            'ok'
          );
        } else if (dupeCount > 0) {
          toast(`ℹ️ ${dupeCount} documento(s) ya estaban registrados previamente en el ERP.`, 'info');
        }

        // Auto-cerrar resumen después de 2.5 segundos
        setTimeout(() => {
          setBatchQueue([]);
          setCurrentIndex(-1);
          setCompletedSummary(null);
        }, 2800);
        return;
      }

      const item = queue[idx];
      // 1. Marcar como analizando
      setBatchQueue((prev) => {
        const copy = [...prev];
        if (copy[idx]) copy[idx] = { ...copy[idx], status: 'analyzing' };
        return copy;
      });

      try {
        const analysis = await analyzeDocumentFast(item.file, orders);

        // Caso Duplicado
        if (analysis.isDuplicate) {
          const docKindLabel =
            analysis.docType === 'ticket_bascula'
              ? 'Ticket de Báscula'
              : analysis.docType === 'remision'
              ? 'Remisión'
              : analysis.docType === 'contrarecibo'
              ? 'Contrarecibo'
              : 'Factura';

          setBatchQueue((prev) => {
            const copy = [...prev];
            if (copy[idx]) {
              copy[idx] = {
                ...copy[idx],
                status: 'duplicate',
                analysis,
                result: {
                  success: true,
                  isDuplicate: true,
                  message: `${docKindLabel} #${analysis.folio || 'S/N'} ya registrada en ${analysis.duplicateOrder?.folio || analysis.duplicateOrder?.oc || 'Expediente'}. Omitida sin duplicar.`,
                  docType: analysis.docType,
                  folio: analysis.folio,
                  kilos: analysis.kilos,
                  total: analysis.total,
                  orderFolio: analysis.duplicateOrder?.folio || analysis.duplicateOrder?.oc,
                },
              };
            }
            return copy;
          });
          // Avanzar al siguiente
          setTimeout(() => {
            setCurrentIndex(idx + 1);
          }, 450);
          return;
        }

        // Caso Duda o Falta de OC: Pausar y preguntar
        if (analysis.needsClarification) {
          triggerHaptic('warning');
          setBatchQueue((prev) => {
            const copy = [...prev];
            if (copy[idx]) {
              copy[idx] = {
                ...copy[idx],
                status: 'needs_clarification',
                analysis,
              };
            }
            return copy;
          });
          return; // Esperar decisión del usuario
        }

        // Caso Éxito Seguro: Auto-Aplicar inmediatamente
        setBatchQueue((prev) => {
          const copy = [...prev];
          if (copy[idx]) copy[idx] = { ...copy[idx], status: 'applying', analysis };
          return copy;
        });

        const result = await applyDocumentFast(analysis, null, orders);

        setBatchQueue((prev) => {
          const copy = [...prev];
          if (copy[idx]) {
            copy[idx] = {
              ...copy[idx],
              status: result.success ? 'success' : 'error',
              analysis,
              result,
              errorMessage: result.success ? undefined : result.message,
            };
          }
          return copy;
        });

        if (result.success) {
          sound.playChaChing();
          triggerHaptic('light');
        }

        // Avanzar al siguiente archivo
        setTimeout(() => {
          setCurrentIndex(idx + 1);
        }, 550);
      } catch (err: any) {
        console.error('Error al procesar en FastTrack:', err);
        setBatchQueue((prev) => {
          const copy = [...prev];
          if (copy[idx]) {
            copy[idx] = {
              ...copy[idx],
              status: 'error',
              errorMessage: err.message || 'Error al procesar documento',
            };
          }
          return copy;
        });
        // No auto-avanzar ciegamente en error para permitir revisión del operador
      }
    },
    [orders, toast]
  );

  // Efecto que dispara el procesamiento del índice actual
  useEffect(() => {
    if (isProcessing && currentIndex >= 0 && currentIndex < batchQueue.length) {
      const currentItem = batchQueue[currentIndex];
      if (currentItem && currentItem.status === 'pending') {
        processItemAt(currentIndex, batchQueue);
      }
    } else if (isProcessing && currentIndex >= batchQueue.length && batchQueue.length > 0) {
      processItemAt(currentIndex, batchQueue);
    }
  }, [currentIndex, isProcessing, batchQueue, processItemAt]);

  const handleForceApplyCurrent = async (explicitTargetOrder?: PurchaseOrder) => {
    if (currentIndex < 0 || currentIndex >= batchQueue.length) return;
    const item = batchQueue[currentIndex];
    if (!item || !item.analysis) return;

    // EXIGIR orden explícita: nunca recurrir a una orden arbitraria (orders[0])
    const target =
      explicitTargetOrder ||
      (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null) ||
      item.analysis.matchedOrder ||
      item.analysis.duplicateOrder;

    if (!target) {
      toast('⚠️ Debe seleccionar explícitamente la Orden de Compra destino.', 'bad');
      return;
    }

    triggerHaptic('medium');
    setBatchQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) copy[currentIndex] = { ...copy[currentIndex], status: 'applying' };
      return copy;
    });

    try {
      item.analysis.forceApply = true;
      if (forceReplaceCr) item.analysis.forceReplaceCr = true;
      if (selectedInvoiceId) item.analysis.targetInvoiceIdOverride = selectedInvoiceId;

      const reasonDesc =
        item.analysis.suspectReason ||
        (item.analysis.hasFolioCollision
          ? 'Colisión de Folio Fiscal'
          : item.analysis.hasCrCollision
          ? 'Conflicto de Contrarrecibo Previo'
          : item.analysis.multipleInvoicesCandidate
          ? 'Selección Manual de Factura Destino'
          : 'Asignación Manual de Orden');

      item.analysis.manualDecisionAudit = {
        user: 'Operador',
        date: new Date().toISOString(),
        reason: reasonDesc,
        note: auditNote || 'Aprobado tras revisión de datos y advertencias en pantalla.',
      };

      const result = await applyDocumentFast(item.analysis, target, orders);
      setBatchQueue((prev) => {
        const copy = [...prev];
        if (copy[currentIndex]) {
          copy[currentIndex] = {
            ...copy[currentIndex],
            status: result.success ? 'success' : 'error',
            result,
            errorMessage: result.success ? undefined : result.message,
          };
        }
        return copy;
      });

      if (result.success) {
        sound.playChaChing();
        triggerHaptic('cash');
        toast(`✅ Aplicado a ${target.folio || target.oc} con registro de auditoría`, 'ok');
      } else {
        toast(`⚠️ ${result.message}`, 'bad');
      }

      setShowConfirmationSummary(false);
    } catch (err: any) {
      toast(`Error al aplicar: ${err.message}`, 'bad');
      setBatchQueue((prev) => {
        const copy = [...prev];
        if (copy[currentIndex]) {
          copy[currentIndex] = {
            ...copy[currentIndex],
            status: 'error',
            errorMessage: err.message,
          };
        }
        return copy;
      });
      setShowConfirmationSummary(false);
    }
  };

  const handleDiscardCurrent = (reasonText: string) => {
    if (currentIndex < 0 || currentIndex >= batchQueue.length) return;
    const item = batchQueue[currentIndex];
    if (!item) return;

    triggerHaptic('light');
    setBatchQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) {
        copy[currentIndex] = {
          ...copy[currentIndex],
          status: 'duplicate',
          result: {
            success: true,
            isDuplicate: true,
            message: reasonText,
            docType: item.analysis?.docType || 'desconocido',
            folio: item.analysis?.folio || '',
            kilos: item.analysis?.kilos || 0,
            total: item.analysis?.total || 0,
          },
        };
      }
      return copy;
    });

    setTimeout(() => {
      setCurrentIndex(currentIndex + 1);
    }, 450);
  };

  const handleOpenManualInspector = () => {
    if (currentIndex >= 0 && currentIndex < batchQueue.length) {
      const file = batchQueue[currentIndex]?.file;
      if (file) {
        setManualInspectFile(file);
      }
    }
  };

  const handleManualInspectorClose = () => {
    setManualInspectFile(null);
    // Avanzar
    setCurrentIndex(currentIndex + 1);
  };

  const currentItem = currentIndex >= 0 && currentIndex < batchQueue.length ? batchQueue[currentIndex] : null;

  return (
    <>
      {/* INPUT OCULTO para selección de archivo por click */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.xml,image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* OVERLAY DE ARRASTRE GLOBAL */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(10, 15, 29, 0.90)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              padding: 24,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragCounter.current = 0;
              setIsDraggingOver(false);
              const files = e.dataTransfer?.files;
              if (files && files.length > 0) {
                startBatchProcess(Array.from(files));
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: 640,
                border: '2.5px dashed #10b981',
                borderRadius: 28,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 78, 59, 0.22) 100%)',
                padding: '48px 32px',
                textAlign: 'center',
                boxShadow: '0 0 60px rgba(16, 185, 129, 0.3), inset 0 0 30px rgba(16, 185, 129, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 26,
                  background: 'rgba(16, 185, 129, 0.22)',
                  border: '1.5px solid rgba(16, 185, 129, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 42,
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
                }}
              >
                ⚡
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 26,
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: '-0.5px',
                  }}
                >
                  Ingesta Inteligente Touchless
                </h2>
                <p
                  style={{
                    margin: '8px 0 0 0',
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.82)',
                    lineHeight: 1.5,
                    maxWidth: 500,
                  }}
                >
                  Suelta tus facturas, tickets o pagos. El sistema los extrae, detecta la OC correspondiente, los
                  aplica al ERP y los respalda en la nube en automático, sin apretar botones.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginTop: 8,
                }}
              >
                {[
                  { icon: '🧾', label: 'Factura CFDI (PDF/XML)' },
                  { icon: '⚖️', label: 'Ticket de Báscula' },
                  { icon: '📋', label: 'OC Providencia (PDF)' },
                  { icon: '💵', label: 'Comprobante de Pago TR' },
                ].map((tag) => (
                  <span
                    key={tag.label}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      color: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD DE PROCESAMIENTO INTELIGENTE EN VIVO (TOUCHLESS PIPELINE) */}
      <AnimatePresence>
        {(isProcessing || completedSummary) && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999998,
              width: '92%',
              maxWidth: 580,
              borderRadius: 24,
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(59, 130, 246, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.25)',
              padding: '20px 24px',
              color: '#fff',
            }}
          >
            {/* ENCABEZADO DEL HUD */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    fontSize: 16,
                  }}
                >
                  ⚡
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px', color: '#f8fafc' }}>
                    Ingesta Inteligente en Vivo
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                    {completedSummary
                      ? 'Procesamiento completado y sincronizado'
                      : `Archivo ${Math.min(currentIndex + 1, batchQueue.length)} de ${batchQueue.length} · Touchless FastTrack`}
                  </div>
                </div>
              </div>

              {/* Botón cerrar si ya terminó */}
              {completedSummary && (
                <button
                  onClick={() => {
                    setBatchQueue([]);
                    setCompletedSummary(null);
                  }}
                  style={{
                    border: 'none',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* BARRA DE PROGRESO */}
            <div
              style={{
                width: '100%',
                height: 6,
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 99,
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: completedSummary
                    ? '100%'
                    : `${((Math.max(0, currentIndex) + (currentItem?.status === 'success' || currentItem?.status === 'duplicate' ? 1 : 0.4)) / Math.max(1, batchQueue.length)) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
                style={{
                  height: '100%',
                  background: completedSummary
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                }}
              />
            </div>

            {/* CASO RESUMEN COMPLETO */}
            {completedSummary && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399' }}>
                  {completedSummary.success} documento(s) aplicados y respaldados exitosamente
                </div>
                {completedSummary.dupes > 0 && (
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    {completedSummary.dupes} documento(s) ya existían en el sistema y fueron conservados sin duplicar.
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  Reflejado automáticamente en Dashboard, Métricas y Cobranza.
                </div>
              </motion.div>
            )}

            {/* CASO EN PROCESAMIENTO / DUDA */}
            {!completedSummary && currentItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 20 }}>
                      {currentItem.status === 'analyzing'
                        ? '🔍'
                        : currentItem.status === 'applying'
                        ? '💾'
                        : currentItem.status === 'success'
                        ? '✅'
                        : currentItem.status === 'duplicate'
                        ? 'ℹ️'
                        : currentItem.status === 'needs_clarification'
                        ? '⚠️'
                        : '📄'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#f1f5f9',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {currentItem.file.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {currentItem.status === 'analyzing' && 'Extrayendo texto y analizando CFDI/OCR...'}
                        {currentItem.status === 'applying' &&
                          `Guardando en Firestore y respaldando en Storage... (${currentItem.analysis?.folio ? `F-#${currentItem.analysis.folio}` : ''})`}
                        {currentItem.status === 'success' && currentItem.result?.message}
                        {currentItem.status === 'duplicate' && currentItem.result?.message}
                        {currentItem.status === 'needs_clarification' && 'Se requiere especificar la Orden de Compra'}
                        {currentItem.status === 'error' && currentItem.errorMessage}
                      </div>
                    </div>
                  </div>

                  {currentItem.analysis?.total ? (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>
                        {money(currentItem.analysis.total)}
                      </div>
                      {currentItem.analysis.kilos > 0 && (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {currentItem.analysis.kilos.toLocaleString('es-MX')} kg
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* BOTONES DE NAVEGACIÓN MANUAL SI EL DOCUMENTO YA FUE APLICADO O TIENE ERROR */}
                {currentItem.status === 'success' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      onClick={() => setCurrentIndex(currentIndex + 1)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      {currentIndex + 1 < batchQueue.length ? 'Siguiente documento →' : 'Ver resumen final ✓'}
                    </button>
                  </div>
                )}

                {currentItem.status === 'error' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => processItemAt(currentIndex, batchQueue)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 10,
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      ↻ Reintentar
                    </button>
                    <button
                      onClick={() => setCurrentIndex(currentIndex + 1)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#e2e8f0',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Omitir y siguiente →
                    </button>
                  </div>
                )}

                {/* TARJETA INTERACTIVA DE ACLARACIÓN Y CONFIRMACIÓN EXPLÍCITA */}
                {currentItem.status === 'needs_clarification' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: currentItem.analysis?.hasFolioCollision || currentItem.analysis?.hasCrCollision
                        ? 'rgba(239, 68, 68, 0.14)'
                        : currentItem.analysis?.isSuspectDuplicate
                        ? 'rgba(234, 88, 12, 0.14)'
                        : 'rgba(245, 158, 11, 0.12)',
                      border: `1.5px solid ${
                        currentItem.analysis?.hasFolioCollision || currentItem.analysis?.hasCrCollision
                          ? 'rgba(239, 68, 68, 0.5)'
                          : currentItem.analysis?.isSuspectDuplicate
                          ? 'rgba(234, 88, 12, 0.5)'
                          : 'rgba(245, 158, 11, 0.45)'
                      }`,
                      marginTop: 4,
                    }}
                  >
                    {/* ENCABEZADO Y MOTIVO DE LA ALERTA */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>
                        {currentItem.analysis?.hasFolioCollision
                          ? '🚨'
                          : currentItem.analysis?.hasCrCollision
                          ? '⚠️'
                          : currentItem.analysis?.isSuspectDuplicate
                          ? '⚠️'
                          : '❓'}
                      </span>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color:
                            currentItem.analysis?.hasFolioCollision || currentItem.analysis?.hasCrCollision
                              ? '#f87171'
                              : currentItem.analysis?.isSuspectDuplicate
                              ? '#fb923c'
                              : '#fbbf24',
                        }}
                      >
                        {currentItem.analysis?.hasFolioCollision
                          ? `Colisión de Folio Fiscal #${currentItem.analysis.folio} (UUID SAT Distinto)`
                          : currentItem.analysis?.hasCrCollision
                          ? `Conflicto de Contrarrecibo (#${currentItem.analysis.existingCr})`
                          : currentItem.analysis?.isSuspectDuplicate
                          ? `Pesaje sospechoso en báscula (${currentItem.analysis.kilos.toLocaleString('es-MX')} kg)`
                          : currentItem.analysis?.multipleInvoicesCandidate
                          ? 'Múltiples facturas con saldo pendiente'
                          : `Asignación requerida para ${currentItem.analysis?.docType || 'documento'}`}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 12, lineHeight: 1.4 }}>
                      {currentItem.analysis?.hasFolioCollision && (
                        <span>El folio ya existe en {currentItem.analysis.duplicateOrder?.folio || currentItem.analysis.duplicateOrder?.oc || 'otra orden'} con un UUID fiscal SAT diferente. Seleccione explícitamente la orden de destino.</span>
                      )}
                      {currentItem.analysis?.hasCrCollision && (
                        <span>Una de las facturas amparadas ya cuenta con el contrarrecibo <strong>#{currentItem.analysis.existingCr}</strong>. Se requiere confirmación para cambiarlo a <strong>#{currentItem.analysis.newCr || currentItem.analysis.folio}</strong>.</span>
                      )}
                      {currentItem.analysis?.isSuspectDuplicate && (
                        <span>{currentItem.analysis.suspectReason || 'Existe un pesaje idéntico o muy cercano en la misma fecha. Verifique si es una entrega real independiente.'}</span>
                      )}
                      {!currentItem.analysis?.hasFolioCollision && !currentItem.analysis?.hasCrCollision && !currentItem.analysis?.isSuspectDuplicate && (
                        <span>El documento no especifica un número de orden canónico inequívoco. Seleccione la Orden de Compra para evitar alterar balances.</span>
                      )}
                    </div>

                    {!showConfirmationSummary ? (
                      /* PASO 1: SELECCIÓN EXPLÍCITA DE ORDEN Y OPCIONES */
                      <div>
                        {/* Selector de Orden */}
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                            Orden de Compra Destino (Obligatoria):
                          </label>
                          <select
                            value={selectedOrderId}
                            onChange={(e) => setSelectedOrderId(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 10,
                              background: 'rgba(15, 23, 42, 0.85)',
                              border: '1px solid rgba(255, 255, 255, 0.25)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            <option value="">-- Seleccionar Orden de Compra --</option>
                            {orders
                              .filter((o) => o && !(o as any).isDeleted)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.folio || o.oc} · {o.client || 'Sin cliente'} · {Number(o.totalKilograms || 0).toLocaleString('es-MX')} kg
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Botones de 1 Toque Canónicos */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                          {orders
                            .filter((o) => (o.oc || o.folio || '').includes('14302') || o.client?.includes('TH'))
                            .slice(0, 1)
                            .map((o) => (
                              <button
                                key={o.id}
                                onClick={() => setSelectedOrderId(o.id)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                  border: selectedOrderId === o.id ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.4)',
                                  background: selectedOrderId === o.id ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.15)',
                                  color: '#fff',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                🏢 TH (José Nava · 71/14302)
                              </button>
                            ))}
                          {orders
                            .filter((o) => (o.oc || o.folio || '').includes('9784') || o.client?.includes('GT'))
                            .slice(0, 1)
                            .map((o) => (
                              <button
                                key={o.id}
                                onClick={() => setSelectedOrderId(o.id)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                  border: selectedOrderId === o.id ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.4)',
                                  background: selectedOrderId === o.id ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.15)',
                                  color: '#fff',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                🏭 GT (Lic. Evelia · 43/9784)
                              </button>
                            ))}
                        </div>

                        {/* Si hay candidatas de factura para pago */}
                        {currentItem.analysis?.candidateInvoices && currentItem.analysis.candidateInvoices.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                              Factura Destino para el Abono:
                            </label>
                            <select
                              value={selectedInvoiceId}
                              onChange={(e) => setSelectedInvoiceId(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 10,
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(255, 255, 255, 0.25)',
                                color: '#fff',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              <option value="">-- Seleccionar Factura --</option>
                              {currentItem.analysis.candidateInvoices.map((ci) => (
                                <option key={ci.id} value={ci.id}>
                                  Factura #{ci.folio || ci.id} · Saldo pendiente: ${ci.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Si hay colisión de contrarrecibo */}
                        {currentItem.analysis?.hasCrCollision && (
                          <div
                            style={{
                              padding: '8px 12px',
                              borderRadius: 10,
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.5)',
                              marginBottom: 10,
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                              <input
                                type="checkbox"
                                checked={forceReplaceCr}
                                onChange={(e) => setForceReplaceCr(e.target.checked)}
                              />
                              Confirmar reemplazo de CR #{currentItem.analysis.existingCr} por #{currentItem.analysis.newCr || currentItem.analysis.folio}
                            </label>
                          </div>
                        )}

                        {/* Botones de acción Paso 1 */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                          <button
                            onClick={() => {
                              if (!selectedOrderId) {
                                toast('⚠️ Seleccione una orden destino antes de continuar.', 'bad');
                                return;
                              }
                              setShowConfirmationSummary(true);
                            }}
                            style={{
                              flex: '1 1 140px',
                              padding: '9px 14px',
                              borderRadius: 10,
                              border: 'none',
                              background: '#3b82f6',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Revisar Resumen y Confirmar →
                          </button>
                          <button
                            onClick={handleOpenManualInspector}
                            style={{
                              padding: '9px 12px',
                              borderRadius: 10,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#e2e8f0',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            🔍 Inspeccionar
                          </button>
                          <button
                            onClick={() => handleDiscardCurrent('Cancelado por el operador sin modificar órdenes ni facturas.')}
                            style={{
                              flex: '1 1 110px',
                              padding: '9px 14px',
                              borderRadius: 10,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#94a3b8',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✕ Cancelar Archivo
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* PASO 2: RESUMEN PREVIO DE CONFIRMACIÓN Y AUDITORÍA */
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(0, 0, 0, 0.35)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            marginBottom: 10,
                            fontSize: 11,
                            color: '#e2e8f0',
                            lineHeight: 1.6,
                          }}
                        >
                          <div><strong>📄 Archivo:</strong> {currentItem.file.name}</div>
                          <div><strong>🏷️ Tipo de documento:</strong> {currentItem.analysis?.docType}</div>
                          <div>
                            <strong>🎯 Orden elegida:</strong>{' '}
                            {orders.find((o) => o.id === selectedOrderId)?.folio || orders.find((o) => o.id === selectedOrderId)?.oc || selectedOrderId}
                          </div>
                          <div>
                            <strong>⚠️ Advertencia amparada:</strong>{' '}
                            {currentItem.analysis?.suspectReason || (currentItem.analysis?.hasFolioCollision ? 'Colisión de Folio Fiscal SAT' : 'Asignación manual')}
                          </div>
                        </div>

                        {/* Campo de auditoría */}
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                            Motivo / Justificación de la decisión manual (Auditoría):
                          </label>
                          <input
                            type="text"
                            value={auditNote}
                            onChange={(e) => setAuditNote(e.target.value)}
                            placeholder="Ej. Verificado físicamente con remisión de planta"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'rgba(15, 23, 42, 0.85)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              color: '#fff',
                              fontSize: 11,
                            }}
                          />
                        </div>

                        {/* Botones de acción Paso 2 */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleForceApplyCurrent()}
                            style={{
                              flex: '1 1 140px',
                              padding: '9px 14px',
                              borderRadius: 10,
                              border: 'none',
                              background: '#10b981',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            ✓ Confirmar e Importar Ahora
                          </button>
                          <button
                            onClick={() => setShowConfirmationSummary(false)}
                            style={{
                              padding: '9px 12px',
                              borderRadius: 10,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#e2e8f0',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ← Cambiar Orden
                          </button>
                          <button
                            onClick={() => handleDiscardCurrent('Cancelado por el operador en pantalla de resumen.')}
                            style={{
                              padding: '9px 12px',
                              borderRadius: 10,
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#f87171',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTÓN FLOTANTE para abrir selector de archivos */}
      <motion.button
        onClick={() => fileInputRef.current?.click()}
        title="Subir comprobante PDF, XML o imagen (Touchless)"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 280, damping: 22 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 22,
          zIndex: 9990,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 6px 24px rgba(16, 185, 129, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ⚡
      </motion.button>

      {/* INSPECTOR MANUAL DE RESPALDO */}
      {manualInspectFile && (
        <GlobalDropInspectorModal file={manualInspectFile} onClose={handleManualInspectorClose} />
      )}
    </>
  );
}
