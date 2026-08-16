import { useState, useMemo } from 'react';
import { Modal } from './ui';
import { useToast } from '../context/ToastContext';
import { useOrders } from '../hooks/useOrders';
import { playSuccessChime } from '../lib/soundEffects';
import { findDuplicateOrderFolio } from '../lib/duplicateGuards';

interface MagicPasteModalProps {
  onClose: () => void;
  onApplyParsedData?: (data: { kilos: number; bultos: number; folio: string; text: string }) => void;
}

export function MagicPasteModal({ onClose, onApplyParsedData }: MagicPasteModalProps) {
  const toast = useToast();
  const { orders } = useOrders();
  const [rawText, setRawText] = useState('');

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        toast('📋 Mensaje pegado desde el portapapeles', 'ok');
      }
    } catch {
      toast('Presiona Ctrl + V dentro del cuadro de texto', 'bad');
    }
  };

  const parsed = useMemo(() => {
    if (!rawText.trim()) return null;

    // 1. Buscar Kilos (ej: "1200 kg", "1,200.50kg", "1200 kilos", "peso 1350")
    const kgMatch = rawText.match(/(?:peso|pesada|kilos?|kgs?|total)?\s*[:=]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:kg|kilos|kilo|kgs|kilogramos)?/i);
    let extractedKg = 0;
    if (kgMatch) {
      extractedKg = parseFloat(kgMatch[1].replace(/,/g, '')) || 0;
    }

    // 2. Buscar Bultos / Rollos (ej: "48 bultos", "48 btos", "20 rollos", "50 pzas")
    const bultosMatch = rawText.match(/(\d+)\s*(?:bultos|bulto|btos|bto|paquetes|rollos|rollo|pzas|piezas)/i);
    let extractedBultos = 0;
    if (bultosMatch) {
      extractedBultos = parseInt(bultosMatch[1], 10) || 0;
    }

    // 3. Buscar Folio OC (ej: "43/9713", "OC-120264", "TH-842", "GT-102")
    const ocMatch = rawText.match(/(?:oc|orden|pedido|folio)?\s*[:#-]?\s*([a-zA-Z]{0,4}\s*[-/]?\s*\d+(?:\/\d+)?)/i);
    let extractedFolio = '';
    if (ocMatch) {
      extractedFolio = ocMatch[1].replace(/\s+/g, '').toUpperCase();
    }

    return {
      kilos: extractedKg,
      bultos: extractedBultos,
      folio: extractedFolio,
      hasData: extractedKg > 0 || extractedBultos > 0 || extractedFolio.length > 0,
    };
  }, [rawText]);

  const handleApply = () => {
    if (!parsed || !parsed.hasData) {
      return toast('No se detectaron datos de kilos u orden en el texto.', 'bad');
    }

    playSuccessChime();
    toast(`✨ Detectado: ${parsed.kilos} kg, ${parsed.bultos} bultos para OC ${parsed.folio}`, 'ok');
    if (onApplyParsedData) {
      onApplyParsedData({
        kilos: parsed.kilos,
        bultos: parsed.bultos,
        folio: parsed.folio,
        text: rawText,
      });
    }
    onClose();
  };

  return (
    <Modal title="🪄 Pegado Mágico de WhatsApp" onClose={onClose}>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            Mensaje de WhatsApp:
          </label>
          <button
            type="button"
            onClick={handlePasteClipboard}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid #3b82f6',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 700,
              color: '#2563eb',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            📋 Pegar Portapapeles
          </button>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Ejemplo: "Paco te mandé 1,200 kg en 48 bultos para la orden 43/9713 con el chofer Juan"`}
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 12,
            borderRadius: 10,
            border: '1px solid var(--accent)',
            background: 'var(--paper-sunk)',
            color: 'var(--ink)',
            fontSize: 13,
            outline: 'none',
          }}
          autoFocus
        />

        {parsed && parsed.hasData && (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid #10b981',
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#047857', marginBottom: 6 }}>
              ✨ DATOS EXTRAÍDOS CON ÉXITO:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'block' }}>Kilos:</span>
                <strong className="mono" style={{ color: '#047857' }}>{parsed.kilos ? `${parsed.kilos} kg` : 'No detectado'}</strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'block' }}>Bultos:</span>
                <strong className="mono">{parsed.bultos ? `${parsed.bultos} btos` : '—'}</strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'block' }}>Folio OC:</span>
                <strong className="mono" style={{ color: '#2563eb' }}>{parsed.folio || '—'}</strong>
              </div>
            </div>

            {parsed.folio && (() => {
              const matched = findDuplicateOrderFolio(orders, parsed.folio);
              if (matched) {
                return (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: '#1e40af', fontWeight: 600 }}>
                    💡 <strong>Orden Existente:</strong> Corresponde a la orden de {matched.client}. Los datos se aplicarán directamente a este expediente.
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={!parsed || !parsed.hasData}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff', fontWeight: 800 }}
          >
            🪄 Usar estos Datos
          </button>
        </div>
      </div>
    </Modal>
  );
}
