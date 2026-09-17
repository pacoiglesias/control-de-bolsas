import React, { useState } from 'react';
import { TextField } from '../common/Autocomplete';
import { computeFinancials } from '../../lib/finance';
import { money, kilos } from '../../lib/format';
import { DEFAULT_CONFIG } from '../../lib/types';
import { useOrders } from '../../hooks/useOrders';
import { useDuplicateRadar } from '../../hooks/useDuplicateRadar';
import { DuplicateRadarAlert } from '../common/DuplicateRadarAlert';

export interface FacturaFormData {
  folioFactura: string;
  uuidFiscal: string;
  invoiceKilos: number;
  salePricePerKg: number;
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  contrarecibo?: string;
  notes?: string;
}

export interface FacturaFormProps {
  initialData?: Partial<FacturaFormData>;
  kilosFromReception?: number;
  salePricePerKg?: number;
  orderFolio?: string;
  onSubmit: (data: FacturaFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}

export const FacturaForm: React.FC<FacturaFormProps> = ({
  initialData = {},
  kilosFromReception = 1500,
  salePricePerKg = 43,
  orderFolio = '',
  onSubmit,
  onCancel,
  submitLabel = 'Generar y Registrar Factura',
  disabled = false,
}) => {
  const [folioFactura, setFolioFactura] = useState(
    initialData.folioFactura || `F-${Date.now().toString().slice(-4)}`
  );
  const [uuidFiscal, setUuidFiscal] = useState(
    initialData.uuidFiscal || ''
  );
  const [invoiceKilos, setInvoiceKilos] = useState<string>(
    String(initialData.invoiceKilos || kilosFromReception || 1500)
  );
  const [price, setPrice] = useState<string>(
    String(initialData.salePricePerKg || salePricePerKg || 43)
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialData.paymentMethod || 'PPD'
  );
  const [contrarecibo, setContrarecibo] = useState(initialData.contrarecibo || '');
  const [notes, setNotes] = useState(initialData.notes || '');

  const { orders } = useOrders();
  const { match: duplicateFolio } = useDuplicateRadar(orders, {
    invoiceFolio: folioFactura,
    debounceMs: 120,
  });
  const { match: duplicateUuid } = useDuplicateRadar(orders, {
    uuid: uuidFiscal,
    debounceMs: 150,
  });
  const { match: duplicateCr } = useDuplicateRadar(orders, {
    contrarecibo: contrarecibo,
    debounceMs: 120,
  });

  const numKilos = Number(invoiceKilos) || 0;
  const numPrice = Number(price) || 43;

  const fin = computeFinancials(numKilos, {
    ...DEFAULT_CONFIG,
    salePricePerKg: numPrice,
  });

  const subtotal = fin.saleTotal;
  const iva = fin.saleTotal * 0.16;
  const total = fin.invoiceTotal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      folioFactura,
      uuidFiscal: uuidFiscal.trim() || `UUID-${Date.now()}`,
      invoiceKilos: numKilos,
      salePricePerKg: numPrice,
      subtotal,
      iva,
      total,
      paymentMethod,
      contrarecibo: contrarecibo.trim(),
      notes,
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
          <span>Facturando Orden: <strong>{orderFolio}</strong></span>
          <span>Kilos Recibidos: <strong>{kilos(kilosFromReception)}</strong></span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <TextField
          label="Folio Fiscal Interno / Serie *"
          value={folioFactura}
          onChange={(e) => setFolioFactura(e.target.value)}
          placeholder="Ej. F-6210"
          required
          disabled={disabled}
        />

        <TextField
          label="UUID / Folio Fiscal Digital (SAT)"
          value={uuidFiscal}
          onChange={(e) => setUuidFiscal(e.target.value)}
          placeholder="Ej. 4A89C8E2-..."
          disabled={disabled}
        />
      </div>

      <DuplicateRadarAlert match={duplicateFolio} />
      <DuplicateRadarAlert match={duplicateUuid} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <TextField
          label="Kilos a Facturar *"
          type="number"
          step="0.1"
          value={invoiceKilos}
          onChange={(e) => setInvoiceKilos(e.target.value)}
          required
          disabled={disabled}
        />

        <TextField
          label="Precio Unitario $/kg *"
          type="number"
          step="0.5"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          disabled={disabled}
        />

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
            Método de Pago SAT
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={disabled}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid var(--line)',
              background: 'var(--field)',
              color: 'var(--ink)',
              fontSize: '14px',
              outline: 'none',
            }}
          >
            <option value="PPD">PPD — Pago en Parcialidades o Diferido (30 días)</option>
            <option value="PUE">PUE — Pago en Una Sola Exhibición</option>
          </select>
        </div>
      </div>

      <div>
        <TextField
          label="Número de Contrarecibo (Opcional - si ya fue entregado)"
          value={contrarecibo}
          onChange={(e) => setContrarecibo(e.target.value)}
          placeholder="Ej. 10025687"
          disabled={disabled}
        />
        <DuplicateRadarAlert match={duplicateCr} />
      </div>

      <TextField
        label="Notas o Leyendas Fiscales"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ej. Orden de Compra sujeta a revisión..."
        disabled={disabled}
      />

      {/* Desglose Fiscal SAT */}
      <div
        style={{
          background: 'var(--paper-sunk)',
          border: '1px solid var(--line-soft)',
          borderRadius: '12px',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Subtotal (sin IVA)</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{money(subtotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>IVA (16%)</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink-soft)' }}>{money(iva)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Total a Cobrar</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>{money(total)}</div>
        </div>
      </div>

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
          disabled={disabled || numKilos <= 0}
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
