import React, { useState, useMemo } from 'react';
import { Modal } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useOrders } from '../../hooks/useOrders';

interface FotoRemisionModalProps {
  onClose: () => void;
  onAddDeliveryFromPhoto: (kilos: number, folioRemision: string, notas: string, fotoUrl?: string) => void;
  kilosFaltantes: number;
}

export function FotoRemisionModal({
  onClose,
  onAddDeliveryFromPhoto,
  kilosFaltantes,
}: FotoRemisionModalProps) {
  const toast = useToast();
  const { orders } = useOrders();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [kilos, setKilos] = useState<number>(kilosFaltantes > 0 ? kilosFaltantes : 0);
  const [folioRemision, setFolioRemision] = useState<string>('');
  const [notas, setNotas] = useState<string>('Entrega confirmada con remisión sellada en planta Providencia');

  const remisionDuplicada = useMemo(() => {
    const q = folioRemision.trim().toUpperCase();
    if (!q || q.length < 3) return null;
    for (const o of orders) {
      for (const d of o.deliveries || []) {
        const dNotes = (d.notes || '').toUpperCase();
        if (dNotes.includes(q)) {
          return { oc: o.folio || o.oc || 'S/OC', client: o.client || 'Providencia' };
        }
      }
    }
    return null;
  }, [folioRemision, orders]);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Por favor selecciona un archivo de imagen válido', 'bad');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      toast('📷 Foto de remisión cargada correctamente', 'ok');
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) handleImageUpload(file);
        break;
      }
    }
  };

  const handleConfirm = () => {
    if (kilos <= 0) {
      toast('Ingresa los kilos pesados en báscula', 'bad');
      return;
    }
    onAddDeliveryFromPhoto(kilos, folioRemision, notas, imagePreview || undefined);
    onClose();
  };

  return (
    <Modal title="📷 Asistente de Foto de Remisión / Báscula" onClose={onClose}>
      <div style={{ padding: 20 }} onPaste={handlePaste}>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0, marginBottom: 16 }}>
          Sube la foto de la remisión sellada por Providencia o <strong>pégala directamente con Ctrl + V</strong> si te la mandaron por WhatsApp.
        </p>

        {/* Dropzone de Foto */}
        <div
          style={{
            border: '2px dashed var(--line)',
            borderRadius: 12,
            background: 'var(--paper-sunk)',
            padding: 20,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            minHeight: 140,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => document.getElementById('remision-file-input')?.click()}
        >
          <input
            id="remision-file-input"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
            }}
          />

          {imagePreview ? (
            <div style={{ position: 'relative', width: '100%', maxHeight: 220, overflow: 'hidden', borderRadius: 8 }}>
              <img
                src={imagePreview}
                alt="Comprobante de Remisión"
                style={{ width: '100%', height: 'auto', objectFit: 'contain', maxHeight: 200, borderRadius: 8 }}
              />
              <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 700, display: 'block', marginTop: 6 }}>
                ✓ Foto adjuntada (haz clic para cambiar)
              </span>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 36, marginBottom: 6 }}>📸</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                Toca aquí para seleccionar foto o presiona <kbd style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '2px 6px', borderRadius: 4 }}>Ctrl + V</kbd>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Acepta capturas de pantalla, fotos de celular o WhatsApp
              </div>
            </div>
          )}
        </div>

        {/* Campos de captura rápida */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>
              Kilos Pesados en Báscula *
            </label>
            <input
              type="number"
              className="input boxed mono"
              value={kilos || ''}
              onChange={(e) => setKilos(Number(e.target.value))}
              placeholder="Ej. 1500"
              style={{ fontSize: 16, fontWeight: 700 }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>
              Folio de Remisión / Sello
            </label>
            <input
              type="text"
              className="input boxed"
              value={folioRemision}
              onChange={(e) => setFolioRemision(e.target.value.toUpperCase())}
              placeholder="Ej. REM-4892"
            />
            {remisionDuplicada && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontWeight: 700 }}>
                ⚠️ Esta remisión ya fue registrada en la OC #{remisionDuplicada.oc} ({remisionDuplicada.client}). Verifica para evitar duplicar kilos.
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>
            Observaciones / Chofer
          </label>
          <input
            type="text"
            className="input boxed"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Detalles de recepción"
          />
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            style={{ fontWeight: 700 }}
            onClick={handleConfirm}
            disabled={kilos <= 0}
          >
            📦 Registrar Entrega ({kilos.toLocaleString('es-MX')} kg)
          </button>
        </div>
      </div>
    </Modal>
  );
}
