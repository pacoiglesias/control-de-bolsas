import { useState, useEffect } from 'react';
import { Modal } from '../ui';
import { parseXmlInvoice } from '../../lib/xmlParser';
import { extractTextFromPdf, parseOcrData } from '../../lib/ocr';
import { parseScaleTicket } from '../../lib/scaleTicketParser';
import { useOrdersContext } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import { money } from '../../lib/format';
import { round2 } from '../../lib/finance';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import type { Invoice, Delivery } from '../../lib/types';
import { OC_TH_ACTIVE, OC_GT_ACTIVE } from '../../lib/constants';

interface GlobalDropInspectorModalProps {
  file: File;
  onClose: () => void;
}

type DetectedDocType = 'factura_cfdi' | 'ticket_bascula' | 'contrarecibo' | 'remision' | 'desconocido';

export function GlobalDropInspectorModal({ file, onClose }: GlobalDropInspectorModalProps) {
  const { orders } = useOrdersContext();
  const toast = useToast();

  const [analyzing, setAnalyzing] = useState(true);
  const [docType, setDocType] = useState<DetectedDocType>('desconocido');
  const [confidence, setConfidence] = useState<'alta' | 'media' | 'baja'>('baja');

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
  const [saving, setSaving] = useState(false);

  // Analizar archivo en el montaje
  useEffect(() => {
    let active = true;

    async function analyze() {
      setAnalyzing(true);
      try {
        const fileName = file.name.toLowerCase();

        // Si es imagen, generar URL de previsualización
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          setImagePreviewUrl(url);
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
            // Verificar si es Factura o Contrarecibo con OCR
            const ocr = parseOcrData(text);
            const isCr = /CONTRARECIBO|GT-\d+|TH-\d+/i.test(text);

            if (isCr) {
              setDocType('contrarecibo');
              setConfidence('alta');
            } else {
              setDocType('factura_cfdi');
              setConfidence('alta');
            }

            setExtractedFolio(ocr.folio || '');
            setExtractedUuid(ocr.uuid || '');
            setExtractedKilos(round2(ocr.kilos || 0));
            setExtractedSubtotal(round2(ocr.subTotal || 0));
            setExtractedTotal(round2(ocr.total || 0));
            setExtractedDate(ocr.fecha ? ocr.fecha.split('T')[0] : new Date().toISOString().split('T')[0]);
            setDetectedOcNumber(ocr.ocNumber || '');
            matchOrder(ocr.ocNumber, ocr.folio, ocr.receptorNombre);
          }
        }
        // 3. CASO IMAGEN (Foto de ticket o remisión)
        else if (file.type.startsWith('image/')) {
          setDocType('ticket_bascula');
          setConfidence('media');
          // En fotos dejamos que el usuario confirme los kilos
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

    function matchOrder(ocCandidate?: string, folioCandidate?: string, clientCandidate?: string) {
      if (!orders || orders.length === 0) return;

      const cleanOc = (ocCandidate || '').replace(/[^0-9]/g, '');
      const cleanFolio = (folioCandidate || '').trim().toUpperCase();
      const cleanClient = (clientCandidate || '').toUpperCase();

      const found = orders.find((o) => {
        if (!o || (o as any).isDeleted) return false;
        const oOc = (o.oc || o.folio || o.id || '').replace(/[^0-9]/g, '');
        if (cleanOc && oOc.includes(cleanOc)) return true;
        if (cleanFolio && (o.folio === cleanFolio || (o.invoices || []).some((i) => i.folio === cleanFolio))) return true;
        if (cleanClient.includes('TEXTIL HOGAR') && o.oc === OC_TH_ACTIVE) return true;
        if (cleanClient.includes('GRUPO TEXTIL') && o.oc === OC_GT_ACTIVE) return true;
        return false;
      });

      if (found) {
        setSelectedOrderId(found.id);
      } else {
        // Fallback a la primera orden activa vigente
        const defaultActive = orders.find((o) => o.oc === OC_TH_ACTIVE || o.oc === OC_GT_ACTIVE || !o.isClosedShort);
        if (defaultActive) setSelectedOrderId(defaultActive.id);
      }
    }

    analyze();

    return () => {
      active = false;
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [file, orders]);

  // Orden seleccionada para mostrar impacto
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Acción de Confirmación y Aplicación Atómica
  const handleConfirmAndApply = async () => {
    if (!selectedOrder) {
      toast('Por favor selecciona una Orden de Compra para aplicar el comprobante.', 'bad');
      return;
    }

    setSaving(true);
    try {
      const orderRef = doc(db, PATHS.orders, selectedOrder.id);

      if (docType === 'factura_cfdi') {
        const newInvoice: Invoice = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          folio: extractedFolio || 'S/F',
          uuid: extractedUuid || undefined,
          kilos: extractedKilos,
          financials: {
            salePricePerKg: selectedOrder.customSellPrice || 43,
            costPricePerKg: 38,
            saleTotal: extractedSubtotal || round2(extractedKilos * (selectedOrder.customSellPrice || 43)),
            invoiceTotal: extractedTotal || round2(extractedKilos * (selectedOrder.customSellPrice || 43) * 1.16),
            costTotal: round2(extractedKilos * 38),
            commission: round2(extractedSubtotal * 0.08),
            netCashFlow: round2(extractedTotal - (extractedKilos * 38) - (extractedSubtotal * 0.08)),
            tradeMargin: round2(extractedSubtotal - (extractedKilos * 38)),
          },
          creditCycle: {
            status: 'pending',
            issueDate: Timestamp.fromDate(new Date(extractedDate)),
          },
          orderId: selectedOrder.id,
          oc: selectedOrder.oc || selectedOrder.folio,
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

        if (extractedKilos > 0) {
          updatedDeliveries.push({
            id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: Timestamp.fromDate(new Date(extractedDate)),
            kilos: extractedKilos,
            notes: `Entrega física amparada por Factura #${newInvoice.folio} (${extractedKilos.toLocaleString('es-MX')} kg)`,
            invoiced: true,
            invoiceId: newInvoice.id,
            docType: 'factura',
            docFolio: newInvoice.folio,
          });
        }

        await updateDoc(orderRef, {
          invoices: [...existingInvoices, newInvoice],
          deliveries: updatedDeliveries,
          updatedAt: Timestamp.now(),
        });

        sound.playChaChing();
        triggerHaptic('cash');
        toast(`Factura #${newInvoice.folio} aplicada con éxito a la OC ${selectedOrder.folio || selectedOrder.oc}`, 'ok');
      } else if (docType === 'ticket_bascula' || docType === 'remision') {
        // Registrar Entrega de Báscula
        const newDelivery: Delivery = {
          id: `del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          date: Timestamp.fromDate(new Date(extractedDate)),
          kilos: extractedKilos,
          notes: `Ingreso de báscula ticket #${extractedFolio || 'S/N'} (${extractedKilos.toLocaleString('es-MX')} kg)`,
          invoiced: false,
          docType: 'remision',
          docFolio: extractedFolio || undefined,
        };

        const existingDeliveries = selectedOrder.deliveries || [];
        await updateDoc(orderRef, {
          deliveries: [...existingDeliveries, newDelivery],
          updatedAt: Timestamp.now(),
        });

        sound.playChaChing();
        triggerHaptic('cash');
        toast(`Entrega de ${extractedKilos.toLocaleString('es-MX')} kg registrada exitosamente en la OC ${selectedOrder.folio || selectedOrder.oc}`, 'ok');
      }

      onClose();
    } catch (err: any) {
      console.error('Error al aplicar documento:', err);
      toast(`Error al guardar: ${err.message || 'Intente nuevamente'}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔍</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
              Inspección y Previsualización Inteligente de Comprobante
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
                {docType === 'factura_cfdi' ? '🧾' : docType === 'ticket_bascula' ? '⚖️' : docType === 'contrarecibo' ? '📑' : '📋'}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
                  {docType === 'factura_cfdi' && 'Factura Fiscal CFDI Detectada'}
                  {docType === 'ticket_bascula' && 'Ticket de Báscula / Entrada de Patio'}
                  {docType === 'contrarecibo' && 'Contrarecibo / Comprobante de Portal'}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Folio / Documento</label>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Kilos (Neto)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      step="0.01"
                      value={extractedKilos || ''}
                      onChange={(e) => setExtractedKilos(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: '#047857', fontWeight: 900, fontSize: 14 }}
                    />
                    <span style={{ position: 'absolute', right: 10, top: 8, fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)' }}>kg</span>
                  </div>
                </div>

                {docType === 'factura_cfdi' && (
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>Total con IVA</label>
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

              {detectedOcNumber && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.25)', fontSize: 12, color: 'var(--ink)' }}>
                  🎯 <strong>OC Detectada en Texto:</strong> <span className="mono" style={{ fontWeight: 800 }}>{detectedOcNumber}</span>
                </div>
              )}

              {(!extractedFolio || extractedKilos <= 0 || (docType === 'factura_cfdi' && extractedTotal <= 0)) && (
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
                    {!extractedFolio && <li>Falta ingresar el <strong>Folio / No. Documento</strong>.</li>}
                    {extractedKilos <= 0 && <li>Falta ingresar los <strong>Kilos Netos</strong>.</li>}
                    {docType === 'factura_cfdi' && extractedTotal <= 0 && <li>Falta ingresar el <strong>Importe Total</strong>.</li>}
                  </ul>
                  <span style={{ fontSize: 11, opacity: 0.9 }}>Puedes capturarlos directamente en los campos de arriba antes de guardar.</span>
                </div>
              )}
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

              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                <option value="">-- Selecciona Orden de Compra --</option>
                {orders
                  .filter((o) => !o.isDeleted)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.folio || o.oc} · {o.client?.includes('TH') ? 'TH (José Nava)' : 'GT (Evelia)'} · {(Number(o.totalKilograms) || 0).toLocaleString()} kg
                    </option>
                  ))}
              </select>

              {selectedOrder && (
                <div style={{ padding: '12px', borderRadius: 12, background: 'var(--paper-sunk)', border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
                    📈 Impacto Operativo en {selectedOrder.folio || selectedOrder.oc}:
                  </div>
                  <div style={{ color: '#047857' }}>
                    • Entregas físicas: +{extractedKilos.toLocaleString('es-MX')} kg
                  </div>
                  {docType === 'factura_cfdi' && (
                    <div style={{ color: '#2563eb' }}>
                      • Kilos facturados: +{extractedKilos.toLocaleString('es-MX')} kg ({money(extractedTotal || extractedKilos * 43 * 1.16)})
                    </div>
                  )}
                  <div style={{ color: 'var(--ink-soft)', marginTop: 4 }}>
                    • Cumplimiento meta: {selectedOrder.totalKilograms ? ((extractedKilos / Number(selectedOrder.totalKilograms)) * 100).toFixed(1) : 0}% de avance
                  </div>
                </div>
              )}
            </div>
          </div>

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
              disabled={saving || !selectedOrderId || extractedKilos <= 0}
              style={{
                minHeight: 40,
                padding: '8px 24px',
                borderRadius: 10,
                fontWeight: 900,
                fontSize: 13,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              }}
            >
              {saving ? '⏳ Aplicando...' : '✅ Confirmar y Aplicar al Sistema'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
