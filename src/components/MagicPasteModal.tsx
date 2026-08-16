import { useState, useMemo } from 'react';
import { Modal } from './ui';
import { useToast } from '../context/ToastContext';
import { playSuccessChime } from '../lib/soundEffects';

interface MagicPasteModalProps {
  onClose: () => void;
  onApplyParsedData?: (data: { kilos: number; bultos: number; folio: string; text: string }) => void;
}

export function MagicPasteModal({ onClose, onApplyParsedData }: MagicPasteModalProps) {
  const toast = useToast();
  const [rawText, setRawText] = useState('');

  const parsed = useMemo(() => {
    if (!rawText.trim()) return null;

    // Buscar Kilos (ej: "1200 kg", "1,200kg", "1200 kilos")
    const kgMatch = rawText.match(/(\d+[\d,.]*)\s*(kg|kilos|kilo|kgs)/i);
    let extractedKg = 0;
    if (kgMatch) {
      extractedKg = parseFloat(kgMatch[1].replace(/,/g, '')) || 0;
    }

    // Buscar Bultos (ej: "48 bultos", "48 btos", "48 bto")
    const bultosMatch = rawText.match(/(\d+)\s*(bultos|bulto|btos|bto|paquetes)/i);
    let extractedBultos = 0;
    if (bultosMatch) {
      extractedBultos = parseInt(bultosMatch[1], 10) || 0;
    }

    // Buscar Folio OC (ej: "43/9713", "OC-120264", "12026439713")
    const ocMatch = rawText.match(/(?:oc|orden|pedido)?\s*([0-9]+(?:\/[0-9]+)?)/i);
    let extractedFolio = '';
    if (ocMatch) {
      extractedFolio = ocMatch[1];
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
        <p style={{ color: 'var(--ink-soft)', marginBottom: 14, fontSize: 13 }}>
          Pega cualquier mensaje de WhatsApp que te mande Andrés o el chofer. El sistema extraerá los kilos, bultos y folio de OC automáticamente.
        </p>

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
