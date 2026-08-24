import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseXmlInvoice } from '../../lib/xmlParser';
import { useToast } from '../../context/ToastContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../lib/firebase';

export interface ExtractedDocumentData {
  type: 'xml_factura' | 'pdf_document' | 'text_pasted' | 'contrarecibo' | 'orden_compra' | 'complemento_pago';
  rawText?: string;
  fileName?: string;
  uuid?: string;
  folio?: string;
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
    description: string;
    quantity: number;
    unitPrice?: number;
    amount?: number;
  }>;
  confidence: number;
}

interface SmartDocumentDropzoneProps {
  onDocumentProcessed: (doc: ExtractedDocumentData) => void;
}

export function SmartDocumentDropzone({ onDocumentProcessed }: SmartDocumentDropzoneProps) {
  const toast = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Escuchar evento de Pegado Global (Ctrl + V)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target.id !== 'magic-paste-textarea') {
        return;
      }

      if (e.clipboardData) {
        // 1. Revisar si pegó archivos (PDF / Imagen)
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          const file = e.clipboardData.files[0];
          e.preventDefault();
          handleFileProcess(file);
          return;
        }

        // 2. Revisar si pegó texto (XML, tabla o texto de portal)
        const text = e.clipboardData.getData('text');
        if (text && text.trim().length > 10) {
          e.preventDefault();
          handleTextProcess(text);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

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
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Procesar archivo (XML o PDF)
  const handleFileProcess = async (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage(`Leyendo archivo: ${file.name}...`);

    try {
      const fileName = file.name.toLowerCase();

      // Caso 1: Archivo XML (CFDI del SAT)
      if (fileName.endsWith('.xml') || file.type === 'text/xml' || file.type === 'application/xml') {
        setStatusMessage('Analizando estructura XML CFDI 4.0...');
        const text = await file.text();
        const parsed = parseXmlInvoice(text);
        
        // Determinar departamento por RFC o texto
        const dept: 'TH' | 'GT' = (parsed.receptorNombre || '').toUpperCase().includes('GT') ? 'GT' : 'TH';
        const totalKilos = parsed.conceptos.reduce((acc, c) => acc + (c.cantidad || 0), 0);

        // Extraer posible folio de factura del XML
        const folioMatch = text.match(/Folio="([^"]+)"/i) || text.match(/folio="([^"]+)"/i);
        const folio = folioMatch ? folioMatch[1] : '';

        // Extraer posible OC de la descripción o nodo
        const ocMatch = text.match(/1202\d{6,8}/) || text.match(/OC[-\s]?(\d+)/i);
        const ocFolio = ocMatch ? ocMatch[0] : undefined;

        // Si es un Complemento de Pago (REP)
        if (parsed.complementoPago && parsed.complementoPago.doctosRelacionados.length > 0) {
          const docRel = parsed.complementoPago.doctosRelacionados[0];
          const docData: ExtractedDocumentData = {
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

          toast(`✅ Complemento de Pago #${parsed.folio || ''} (Factura #${docRel.folio || ''}) detectado`, 'ok');
          onDocumentProcessed(docData);
          return;
        }

        const docData: ExtractedDocumentData = {
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
          items: parsed.conceptos.map(c => ({
            description: c.descripcion,
            quantity: c.cantidad,
            unitPrice: c.valorUnitario,
            amount: c.importe,
          })),
          confidence: 1.0,
        };

        toast('✅ XML del SAT procesado con 100% de precisión', 'ok');
        onDocumentProcessed(docData);
        return;
      }

      // Caso 2: Archivo PDF o Imagen
      if (fileName.endsWith('.pdf') || file.type === 'application/pdf' || file.type.startsWith('image/')) {
        setStatusMessage('Extrayendo texto y analizando con IA...');
        
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

          const dept: 'TH' | 'GT' = (d.departamento === 'GT' || (d.cliente || '').toUpperCase().includes('GT')) ? 'GT' : 'TH';

          const docData: ExtractedDocumentData = {
            type: d.tipoDocumento === 'orden_compra' ? 'orden_compra' : d.tipoDocumento === 'contrarecibo' ? 'contrarecibo' : 'pdf_document',
            fileName: file.name,
            folio: d.folio || d.numeroFactura || undefined,
            ocFolio: d.oc || d.ordenCompra || d.folioOC || undefined,
            contrarecibo: d.contrarecibo || d.numeroContrarecibo || undefined,
            kilos: totalKilos,
            subtotal,
            iva: total && subtotal ? total - subtotal : undefined,
            total,
            client: d.cliente || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            department: dept,
            date: d.fecha || new Date().toISOString().split('T')[0],
            dueDate: d.fechaVencimiento || undefined,
            items: d.conceptos || [],
            confidence: 0.92,
          };

          toast('✅ PDF analizado con éxito', 'ok');
          onDocumentProcessed(docData);
        } catch (aiErr: any) {
          console.warn('Fallback a parser local', aiErr);
          const docData: ExtractedDocumentData = {
            type: 'pdf_document',
            fileName: file.name,
            client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
            department: 'TH',
            confidence: 0.7,
          };
          toast('Documento cargado para asignación manual guiada', 'info');
          onDocumentProcessed(docData);
        }
        return;
      }

      toast('Formato no soportado. Usa PDF, XML, JPG o PNG.', 'bad');
    } catch (err: any) {
      toast(`Error al procesar archivo: ${err.message}`, 'bad');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Procesar texto pegado (XML o Texto de portal)
  const handleTextProcess = (text: string) => {
    setIsProcessing(true);
    setStatusMessage('Analizando contenido del portapapeles...');

    try {
      const clean = text.trim();

      // ¿Es un XML pegado directamente?
      if (clean.startsWith('<?xml') || clean.includes('<cfdi:Comprobante') || clean.includes('<Comprobante')) {
        const parsed = parseXmlInvoice(clean);
        const dept: 'TH' | 'GT' = (parsed.receptorNombre || '').toUpperCase().includes('GT') ? 'GT' : 'TH';
        // Si es un Complemento de Pago pegado
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
          items: parsed.conceptos.map(c => ({
            description: c.descripcion,
            quantity: c.cantidad,
            unitPrice: c.valorUnitario,
            amount: c.importe,
          })),
          confidence: 1.0,
        };

        toast('✅ XML detectado desde el portapapeles', 'ok');
        onDocumentProcessed(docData);
        setShowTextModal(false);
        setPasteText('');
        return;
      }

      // ¿Es texto copiado del portal de Providencia / WhatsApp / Correo?
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

      toast('✅ Texto analizado e información extraída', 'ok');
      onDocumentProcessed(docData);
      setShowTextModal(false);
      setPasteText('');
    } catch (err: any) {
      toast(`Error al analizar texto: ${err.message}`, 'bad');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* Dropzone Principal */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.005 }}
        style={{
          border: isDragging ? '2px dashed #3b82f6' : '2px dashed rgba(255, 255, 255, 0.2)',
          borderRadius: 18,
          padding: '32px 24px',
          background: isDragging
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.25) 100%)'
            : 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
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
          style={{ display: 'none' }}
          accept=".pdf,.xml,image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileProcess(e.target.files[0]);
            }
          }}
        />

        {isProcessing ? (
          <div style={{ padding: 12 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ fontSize: 36, marginBottom: 12, display: 'inline-block' }}
            >
              ⚡
            </motion.div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{statusMessage}</div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
              Analizando folios, importes, kilos y sellos del SAT...
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 42, marginBottom: 8 }}>📥</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              Arrastra o Sube aquí tu PDF o XML
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginTop: 4 }}>
              O simplemente presiona <kbd style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 6, fontWeight: 800, color: '#38bdf8' }}>Ctrl + V</kbd> para pegar texto, XML o imagen del portapapeles
            </div>

            {/* Badges de Formatos Aceptados */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                📄 PDF (Factura / OC / Remisión)
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                🧾 XML CFDI 4.0 / 3.3
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                📋 Pegar Texto del Portal
              </span>
            </div>

            {/* Botón Alternativo de Pegar Texto Manual */}
            <div style={{ marginTop: 20 }}>
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
                  transition: 'all 0.15s',
                }}
              >
                <span>✏️</span> Escribir o Pegar Texto Manualmente
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal para Pegar Texto Manual si el usuario prefiere ventana dedicada */}
      <AnimatePresence>
        {showTextModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setShowTextModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#1e293b',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 20,
                padding: 24,
                width: '100%',
                maxWidth: 550,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
                  📋 Pegar Texto, XML o Datos del Portal
                </div>
                <button
                  onClick={() => setShowTextModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <textarea
                id="magic-paste-textarea"
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Pega aquí el contenido de la factura, XML, renglones del portal de Providencia o datos de la OC..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  padding: 12,
                  color: '#fff',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  outline: 'none',
                  resize: 'vertical',
                }}
                autoFocus
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowTextModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#cbd5e1',
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!pasteText.trim()}
                  onClick={() => handleTextProcess(pasteText)}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 20px',
                    borderRadius: 10,
                    fontWeight: 800,
                    cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
                    opacity: pasteText.trim() ? 1 : 0.5,
                  }}
                >
                  ⚡ Analizar y Clasificar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
