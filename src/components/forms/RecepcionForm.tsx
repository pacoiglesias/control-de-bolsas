import React, { useState } from 'react';
import { TextField } from '../common/Autocomplete';
import { kilos } from '../../lib/format';

export interface RecepcionFormData {
  remisionNumber: string;
  driverName: string;
  vehiclePlates: string;
  receivedKilos: number;
  deliveryDate: string;
  receptionNotes?: string;
  qualityPassed: boolean;
}

export interface RecepcionFormProps {
  initialData?: Partial<RecepcionFormData>;
  expectedKilos?: number;
  orderFolio?: string;
  onSubmit: (data: RecepcionFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}

export const RecepcionForm: React.FC<RecepcionFormProps> = ({
  initialData = {},
  expectedKilos = 1500,
  orderFolio = '',
  onSubmit,
  onCancel,
  submitLabel = 'Confirmar Recepción de Báscula',
  disabled = false,
}) => {
  const [remisionNumber, setRemisionNumber] = useState(
    initialData.remisionNumber || `REM-${Date.now().toString().slice(-5)}`
  );
  const [driverName, setDriverName] = useState(initialData.driverName || 'Operador Andrés');
  const [vehiclePlates, setVehiclePlates] = useState(initialData.vehiclePlates || 'XB-4421-C');
  const [receivedKilos, setReceivedKilos] = useState<string>(
    String(initialData.receivedKilos || expectedKilos || 1500)
  );
  const [deliveryDate, setDeliveryDate] = useState(
    initialData.deliveryDate || new Date().toISOString().slice(0, 10)
  );
  const [qualityPassed, setQualityPassed] = useState(initialData.qualityPassed ?? true);
  const [receptionNotes, setReceptionNotes] = useState(initialData.receptionNotes || '');

  const numReceived = Number(receivedKilos) || 0;
  const diffKilos = numReceived - expectedKilos;
  const toleranceExceeded = Math.abs(diffKilos) > expectedKilos * 0.05;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      remisionNumber,
      driverName,
      vehiclePlates,
      receivedKilos: numReceived,
      deliveryDate,
      qualityPassed,
      receptionNotes,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {orderFolio && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--paper-sunk)',
            fontSize: '13px',
            color: 'var(--ink-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Asociado a Orden: <strong>{orderFolio}</strong></span>
          <span>Programado: <strong>{kilos(expectedKilos)}</strong></span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <TextField
          label="Número de Remisión / Ticket de Báscula *"
          value={remisionNumber}
          onChange={(e) => setRemisionNumber(e.target.value)}
          placeholder="Ej. REM-89412"
          required
          disabled={disabled}
        />

        <TextField
          label="Fecha de Entrega *"
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          required
          disabled={disabled}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <TextField
          label="Nombre del Chofer / Transportista"
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          placeholder="Ej. Juan Pérez"
          disabled={disabled}
        />

        <TextField
          label="Placas del Vehículo"
          value={vehiclePlates}
          onChange={(e) => setVehiclePlates(e.target.value)}
          placeholder="Ej. WZ-8890"
          disabled={disabled}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div>
          <TextField
            label="Kilos Pesados en Báscula *"
            type="number"
            step="0.1"
            value={receivedKilos}
            onChange={(e) => setReceivedKilos(e.target.value)}
            placeholder="1500"
            required
            disabled={disabled}
          />
          {expectedKilos > 0 && (
            <div
              style={{
                fontSize: 12,
                marginTop: 4,
                color: toleranceExceeded ? 'var(--bad)' : 'var(--ok)',
                fontWeight: 600,
              }}
            >
              Variación vs Solicitado: {diffKilos > 0 ? `+${diffKilos.toFixed(1)}` : diffKilos.toFixed(1)} kg ({((diffKilos / expectedKilos) * 100).toFixed(1)}%)
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>
            Inspección de Calidad
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={qualityPassed}
              onChange={(e) => setQualityPassed(e.target.checked)}
              disabled={disabled}
              style={{ width: 18, height: 18, accentColor: 'var(--ok)' }}
            />
            <span>Material cumple especificaciones de calibre y transparencia</span>
          </label>
        </div>
      </div>

      <TextField
        label="Observaciones de Recepción"
        value={receptionNotes}
        onChange={(e) => setReceptionNotes(e.target.value)}
        placeholder="Notas del pesaje, tarimas, sellos..."
        disabled={disabled}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        {onCancel && (
          <button
            type="button"
            className="btn ghost"
            onClick={onCancel}
            disabled={disabled}
            style={{ padding: '10px 20px', borderRadius: '10px' }}
          >
            Atrás
          </button>
        )}
        <button
          type="submit"
          className="btn primary"
          disabled={disabled || numReceived <= 0}
          style={{
            padding: '10px 24px',
            borderRadius: '10px',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};
