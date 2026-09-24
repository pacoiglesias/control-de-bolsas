import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../ui';
import { extractTextFromImage } from '../../lib/ocr';
import {
  parseScaleTicket,
  matchScaleTicketWithOrders,
  type ParsedScaleTicket,
  type OcComparisonResult,
} from '../../lib/scaleTicketParser';
import { useOrdersContext } from '../../context/OrdersContext';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';
import confetti from 'canvas-confetti';

export interface CameraScanResult {
  kilos: number;
  folio?: string;
  dateStr?: string;
  driver?: string;
  placas?: string;
  photoDataUrl?: string;
  rawText?: string;
  suggestedOrderId?: string;
  suggestedOcFolio?: string;
  detectedProductCode?: string;
  detectedProductDescription?: string;
  comparison?: OcComparisonResult;
}

interface CameraTicketScannerModalProps {
  onClose: () => void;
  onApplyResult: (result: CameraScanResult) => void;
  orders?: any[];
  initialOrderId?: string | null;
}

export function CameraTicketScannerModal({
  onClose,
  onApplyResult,
  orders,
  initialOrderId,
}: CameraTicketScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Obtener órdenes de forma segura (por prop o por Context)
  let contextOrders: any[] = [];
  try {
    const ctx = useOrdersContext();
    contextOrders = ctx?.orders || [];
  } catch {
    contextOrders = [];
  }
  const availableOrders = useMemo(() => {
    return (orders && orders.length > 0 ? orders : contextOrders).filter(
      (o) => o && !o.isClosedShort
    );
  }, [orders, contextOrders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrderId || '');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedScaleTicket | null>(null);

  // Formulario de edición rápida post-escaneo
  const [editKilos, setEditKilos] = useState<string>('');
  const [editFolio, setEditFolio] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editDriver, setEditDriver] = useState<string>('');
  const [editPlacas, setEditPlacas] = useState<string>('');

  // Iniciar cámara con lente trasero (environment)
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Cámara no compatible con este navegador.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // Revisar si soporta linterna (torch)
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
      if (capabilities && capabilities.torch) {
        setHasTorch(true);
      }
    } catch (err: any) {
      console.warn('No se pudo acceder a la cámara en vivo:', err);
      setCameraError(err.message || 'No se pudo acceder a la cámara.');
      setCameraActive(false);
    }
  }, []);

  // Detener cámara al desmontar
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Alternar linterna
  const toggleFlash = async () => {
    if (!stream || !hasTorch) return;
    try {
      const track = stream.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !flashOn } as any],
      });
      setFlashOn(!flashOn);
      triggerHaptic('light');
    } catch (e) {
      console.warn('Error alternando linterna:', e);
    }
  };

  // Procesar archivo/foto capturada
  const processImageFile = async (file: File, dataUrl: string) => {
    setProcessing(true);
    setCapturedImage(dataUrl);
    stopCamera();

    try {
      triggerHaptic('medium');
      const text = await extractTextFromImage(file);
      const parsed = parseScaleTicket(text);
      setParsedResult(parsed);

      if (parsed.kilosNeto) setEditKilos(String(parsed.kilosNeto));
      if (parsed.ticketFolio) setEditFolio(parsed.ticketFolio);
      if (parsed.dateStr) setEditDate(parsed.dateStr);
      if (parsed.driver) setEditDriver(parsed.driver);
      if (parsed.placas) setEditPlacas(parsed.placas);

      // Si no hay orden fijada a mano, intentar auto-asignar con la inteligencia de matching
      if (availableOrders.length > 0) {
        const match = matchScaleTicketWithOrders(parsed, availableOrders);
        if (match.suggestedOrderId && !selectedOrderId) {
          setSelectedOrderId(match.suggestedOrderId);
        }
      }

      if (parsed.kilosNeto) {
        sound.playSuccess();
        triggerHaptic('success');
        confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
      } else {
        sound.playPop();
      }
    } catch (err: any) {
      console.error('Error al procesar ticket con OCR:', err);
      sound.playError();
      triggerHaptic('error');
    } finally {
      setProcessing(false);
    }
  };

  // Comparación reactiva con la OC seleccionada o catálogo de OCs activas
  const effectiveComparison = useMemo<OcComparisonResult | null>(() => {
    if (!parsedResult) return null;
    const currentKg = parseFloat(editKilos) || parsedResult.kilosNeto || 0;
    const dummyTicket: ParsedScaleTicket = {
      ...parsedResult,
      kilosNeto: currentKg,
    };

    if (selectedOrderId) {
      const specific = availableOrders.find((o) => o.id === selectedOrderId);
      if (specific) {
        return matchScaleTicketWithOrders(dummyTicket, [specific]);
      }
    }

    return matchScaleTicketWithOrders(dummyTicket, availableOrders);
  }, [parsedResult, editKilos, selectedOrderId, availableOrders]);

  // Capturar frame desde el video en vivo
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    triggerHaptic('heavy');
    sound.playPop();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'ticket_bascula.jpg', { type: 'image/jpeg' });
        void processImageFile(file, dataUrl);
      }
    }, 'image/jpeg', 0.9);
  };

  // Fallback con selector de foto del sistema
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      void processImageFile(file, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    const kilosNum = parseFloat(editKilos);
    if (isNaN(kilosNum) || kilosNum <= 0) {
      sound.playError();
      return;
    }

    triggerHaptic('success');
    sound.playSuccess();

    onApplyResult({
      kilos: kilosNum,
      folio: editFolio.trim() || undefined,
      dateStr: editDate.trim() || undefined,
      driver: editDriver.trim() || undefined,
      placas: editPlacas.trim() || undefined,
      photoDataUrl: capturedImage || undefined,
      rawText: parsedResult?.rawText,
      suggestedOrderId: effectiveComparison?.suggestedOrderId || selectedOrderId || undefined,
      suggestedOcFolio: effectiveComparison?.suggestedOcFolio || undefined,
      detectedProductCode: parsedResult?.detectedProductCodes?.[0] || undefined,
      detectedProductDescription: parsedResult?.detectedProductDescription || undefined,
      comparison: effectiveComparison || undefined,
    });
    onClose();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setParsedResult(null);
    setEditKilos('');
    setEditFolio('');
    void startCamera();
  };

  return (
    <Modal title="📸 Escaneo Directo de Ticket de Báscula" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Vista previa / Cámara */}
        {!capturedImage ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 380,
              background: '#090d16',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Marco de guía para alinear el ticket */}
                <div
                  style={{
                    position: 'absolute',
                    top: '15%',
                    left: '10%',
                    right: '10%',
                    bottom: '15%',
                    border: '2px dashed #10b981',
                    borderRadius: 14,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45), 0 0 20px rgba(16, 185, 129, 0.3)',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: '#34d399',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    ⚖️ Enfoca el Peso Neto y Folio del Ticket
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600 }}>
                    Mantén quieta la cámara con buena luz
                  </span>
                </div>

                {/* Controles sobre el visor */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 20,
                  }}
                >
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleFlash}
                      style={{
                        background: flashOn ? '#f59e0b' : 'rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 44,
                        height: 44,
                        fontSize: 18,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Alternar linterna"
                    >
                      {flashOn ? '⚡' : '💡'}
                    </button>
                  )}

                  {/* Botón Disparador Principal */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={handleCapture}
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: '4px solid #ffffff',
                      boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                      color: '#fff',
                    }}
                    title="Tomar foto al ticket"
                  >
                    📸
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 44,
                      height: 44,
                      fontSize: 18,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Subir foto desde galería"
                  >
                    🖼️
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                  {cameraError || 'Cámara desactivada'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                  Puedes subir una foto del ticket de báscula directamente desde tu dispositivo:
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <span>🖼️</span>
                  <span>Seleccionar Foto de Ticket</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Foto Capturada y Estado de OCR */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: 12,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14,
                padding: 10,
                alignItems: 'center',
              }}
            >
              <img
                src={capturedImage}
                alt="Ticket capturado"
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                    {processing ? '⏳ Procesando OCR...' : '✅ Ticket Escaneado con Éxito'}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.4 }}>
                  {processing
                    ? 'Analizando números de ticket, kilos netos y folio...'
                    : parsedResult?.kilosNeto
                    ? `Se extrajeron ${parsedResult.kilosNeto.toLocaleString('es-MX')} kg automáticamente.`
                    : 'No se detectó el peso automáticamente. Puedes ingresarlo a mano abajo.'}
                </div>
                <button
                  type="button"
                  onClick={handleRetake}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>🔄</span> Tomar otra foto
                </button>
              </div>
            </div>

            {/* Campos extraídos / editables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  ⚖️ Kilos Netos:
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input boxed"
                  value={editKilos}
                  onChange={(e) => setEditKilos(e.target.value)}
                  placeholder="Ej. 2000"
                  style={{ fontSize: 16, fontWeight: 900, color: '#34d399', background: 'rgba(16, 185, 129, 0.08)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  🔖 Folio de Ticket / Remisión:
                </label>
                <input
                  type="text"
                  className="input boxed"
                  value={editFolio}
                  onChange={(e) => setEditFolio(e.target.value)}
                  placeholder="Ej. 45892"
                  style={{ fontSize: 14, fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  📅 Fecha de Pesaje:
                </label>
                <input
                  type="date"
                  className="input boxed"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  🚚 Placas del Vehículo:
                </label>
                <input
                  type="text"
                  className="input boxed"
                  value={editPlacas}
                  onChange={(e) => setEditPlacas(e.target.value)}
                  placeholder="Ej. XA-3849-B"
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>

            {/* Tarjeta de Comparación Inteligente con Orden de Compra */}
            {effectiveComparison && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border:
                    effectiveComparison.status === 'over_delivery'
                      ? '2px solid #ef4444'
                      : effectiveComparison.status === 'valid_completion'
                      ? '2px solid #10b981'
                      : '1px solid rgba(167, 139, 250, 0.4)',
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                }}
              >
                {/* Encabezado con selector de OC */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>🧠</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#f1f5f9' }}>
                      Comparación Inteligente con OC:
                    </span>
                  </div>

                  {effectiveComparison.matchedBy && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background:
                          effectiveComparison.matchedBy === 'oc_number'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : effectiveComparison.matchedBy === 'product_code'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(168, 85, 247, 0.15)',
                        color:
                          effectiveComparison.matchedBy === 'oc_number'
                            ? '#34d399'
                            : effectiveComparison.matchedBy === 'product_code'
                            ? '#60a5fa'
                            : '#c084fc',
                        border: '1px solid currentColor',
                      }}
                    >
                      {effectiveComparison.matchedBy === 'oc_number' && '🎯 Coincide por Número de OC'}
                      {effectiveComparison.matchedBy === 'product_code' && '📦 Coincide por Código Producto'}
                      {effectiveComparison.matchedBy === 'department_match' && '🏢 Coincide por Departamento'}
                      {effectiveComparison.matchedBy === 'highest_pending' && '⏳ Asignada a Mayor Saldo'}
                    </span>
                  )}
                </div>

                {/* Selector de OC de destino */}
                {availableOrders.length > 0 && (
                  <div>
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#94a3b8',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      📋 Orden de Compra Destino:
                    </label>
                    <select
                      value={selectedOrderId || effectiveComparison.suggestedOrderId || ''}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        background: 'rgba(30, 41, 59, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        borderRadius: 8,
                        color: '#f8fafc',
                        fontSize: 12.5,
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    >
                      {availableOrders.map((o) => {
                        const ocFolio = o.oc || o.folio || o.id;
                        const clientName = o.client || o.department || 'Planta';
                        return (
                          <option key={o.id} value={o.id}>
                            OC #{ocFolio} · {clientName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Productos Detectados en el Ticket */}
                {((parsedResult?.detectedProductCodes && parsedResult.detectedProductCodes.length > 0) ||
                  parsedResult?.detectedProductDescription) && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 11.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
                      <span>🏷️</span>
                      <span style={{ fontWeight: 700 }}>Producto en Ticket:</span>
                      <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                        {parsedResult.detectedProductCodes?.join(', ') || parsedResult.detectedProductDescription}
                      </span>
                    </div>
                    {effectiveComparison.matchedItem && (
                      <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>
                        ✓ Coincide con partida: <strong>{effectiveComparison.matchedItem.description || effectiveComparison.matchedItem.code}</strong> ({Number(effectiveComparison.matchedItem.quantity || 0).toLocaleString('es-MX')} kg pedidos)
                      </div>
                    )}
                  </div>
                )}

                {/* Desglose comparativo de Kilos */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '7px 4px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                      ⚖️ En Ticket
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                      {effectiveComparison.ticketKg.toLocaleString('es-MX')} kg
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '7px 4px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                      ⏳ Saldo OC
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>
                      {effectiveComparison.orderPendingKg.toLocaleString('es-MX')} kg
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '7px 4px', borderRadius: 8 }}>
                    <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                      {effectiveComparison.status === 'over_delivery' ? '⚠️ Exceso' : '📉 Restante'}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: effectiveComparison.status === 'over_delivery' ? '#ef4444' : '#60a5fa',
                        marginTop: 2,
                      }}
                    >
                      {effectiveComparison.status === 'over_delivery'
                        ? `+${(effectiveComparison.ticketKg - effectiveComparison.orderPendingKg).toLocaleString('es-MX')} kg`
                        : `${effectiveComparison.remainingAfterTicketKg.toLocaleString('es-MX')} kg`}
                    </div>
                  </div>
                </div>

                {/* Mensaje de Estado / Veredicto Inteligente */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 700,
                    background:
                      effectiveComparison.status === 'over_delivery'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : effectiveComparison.status === 'valid_completion'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)',
                    color:
                      effectiveComparison.status === 'over_delivery'
                        ? '#f87171'
                        : effectiveComparison.status === 'valid_completion'
                        ? '#34d399'
                        : '#93c5fd',
                    border: '1px solid currentColor',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{effectiveComparison.statusMessage}</span>
                </div>
              </div>
            )}

            {/* Botón de Aplicación */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApply}
                disabled={!editKilos || parseFloat(editKilos) <= 0 || processing}
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 800 }}
              >
                <span>✓</span>
                <span>
                  Vincular y Usar Kilos ({editKilos || '0'} kg)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Elementos ocultos para captura */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </div>
    </Modal>
  );
}
