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
        setTimeout(() => {
          setCurrentIndex(idx + 1);
        }, 800);
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

  // Resolver aclaración del usuario
  const handleResolveClarification = async (chosenOrder: PurchaseOrder) => {
    if (currentIndex < 0 || currentIndex >= batchQueue.length) return;
    const currentItem = batchQueue[currentIndex];
    if (!currentItem || !currentItem.analysis) return;

    triggerHaptic('medium');
    setBatchQueue((prev) => {
      const copy = [...prev];
      if (copy[currentIndex]) copy[currentIndex] = { ...copy[currentIndex], status: 'applying' };
      return copy;
    });

    try {
      const result = await applyDocumentFast(currentItem.analysis, chosenOrder, orders);
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
        toast(`✅ Asignado con éxito a ${chosenOrder.folio || chosenOrder.oc}`, 'ok');
      }

      // Continuar con el siguiente
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 550);
    } catch (err: any) {
      console.error('Error al aplicar orden elegida:', err);
      toast(`Error al aplicar: ${err.message}`, 'bad');
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 800);
    }
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

                {/* TARJETA DE PREGUNTA INTERACTIVA SI HAY DUDA DE OC */}
                {currentItem.status === 'needs_clarification' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1.5px solid rgba(245, 158, 11, 0.45)',
                      marginTop: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>❓</span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>
                        ¿A cuál Orden de Compra corresponde esta Factura #{currentItem.analysis?.folio || 'S/F'}?
                      </div>
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.4 }}>
                      El documento no especifica el número canónico de OC. Selecciona la orden en 1 toque para no
                      alterar balances:
                    </p>

                    {/* BOTONES DIRECTOS DE 1 TOQUE */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {/* Botón TH Nava */}
                      {orders
                        .filter((o) => (o.oc || o.folio || '').includes('14302') || o.client?.includes('TH'))
                        .slice(0, 1)
                        .map((o) => (
                          <button
                            key={o.id}
                            onClick={() => handleResolveClarification(o)}
                            style={{
                              flex: '1 1 180px',
                              padding: '10px 14px',
                              borderRadius: 12,
                              border: '1.5px solid #3b82f6',
                              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(29, 78, 216, 0.4) 100%)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 2,
                            }}
                          >
                            <span>🏢 TH · José Nava</span>
                            <span style={{ fontSize: 10, color: '#93c5fd', fontWeight: 600 }}>
                              OC 71/14302 (8,000 kg)
                            </span>
                          </button>
                        ))}

                      {/* Botón GT Evelia */}
                      {orders
                        .filter((o) => (o.oc || o.folio || '').includes('9784') || o.client?.includes('GT'))
                        .slice(0, 1)
                        .map((o) => (
                          <button
                            key={o.id}
                            onClick={() => handleResolveClarification(o)}
                            style={{
                              flex: '1 1 180px',
                              padding: '10px 14px',
                              borderRadius: 12,
                              border: '1.5px solid #10b981',
                              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.4) 100%)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 2,
                            }}
                          >
                            <span>🏭 GT · Lic. Evelia</span>
                            <span style={{ fontSize: 10, color: '#a7f3d0', fontWeight: 600 }}>
                              OC 43/9784 (5,100 kg)
                            </span>
                          </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={handleOpenManualInspector}
                        style={{
                          border: 'none',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🔍 Inspeccionar en Detalle
                      </button>
                    </div>
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
