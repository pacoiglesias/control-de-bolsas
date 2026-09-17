import React, { useState } from 'react';
import { ClienteField, ProveedorField, ProductoField } from '../common/SmartPrefillFields';
import { TextField } from '../common/Autocomplete';
import { computeFinancials } from '../../lib/finance';
import { money } from '../../lib/format';
import { DEFAULT_CONFIG } from '../../lib/types';
import { useOrders } from '../../hooks/useOrders';
import { useDuplicateRadar } from '../../hooks/useDuplicateRadar';
import { DuplicateRadarAlert } from '../common/DuplicateRadarAlert';

export interface OrdenCompraFormData {
  folio: string;
  client: string;
  department: string;
  provider: string;
  productDescription: string;
  totalKilograms: number;
  salePricePerKg: number;
  costPricePerKg: number;
  creditDays: number;
  notes?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export interface OrdenCompraFormProps {
  initialData?: Partial<OrdenCompraFormData>;
  onSubmit: (data: OrdenCompraFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}

export const OrdenCompraForm: React.FC<OrdenCompraFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  submitLabel = 'Guardar Orden de Compra',
  disabled = false,
}) => {
  const [folio, setFolio] = useState(initialData.folio || `OC-${Date.now().toString().slice(-6)}`);
  const { orders } = useOrders();
  const { match: duplicateOc } = useDuplicateRadar(orders, {
    oc: folio,
    debounceMs: 120,
  });
  const [client, setClient] = useState<any>(initialData.client || 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)');
  const [department, setDepartment] = useState(initialData.department || 'TH');
  const [provider, setProvider] = useState<any>(initialData.provider || 'Andrés Gutiérrez (Maquila y Resina)');
  const [product, setProduct] = useState<any>(initialData.productDescription || 'Bolsa de Polietileno Transparente en Rollo (Cal. 120)');
  const [kilos, setKilos] = useState<string>(String(initialData.totalKilograms || 1500));
  const [salePrice, setSalePrice] = useState<string>(String(initialData.salePricePerKg || DEFAULT_CONFIG.salePricePerKg || 43));
  const [costPrice, setCostPrice] = useState<string>(String(initialData.costPricePerKg || DEFAULT_CONFIG.costPricePerKg || 38));
  const [creditDays, setCreditDays] = useState<string>(String(initialData.creditDays || 30));
  const [notes, setNotes] = useState(initialData.notes || '');

  const totalKgNum = Number(kilos) || 0;
  const salePriceNum = Number(salePrice) || 43;
  const costPriceNum = Number(costPrice) || 38;

  const fin = computeFinancials(totalKgNum, {
    ...DEFAULT_CONFIG,
    salePricePerKg: salePriceNum,
    costPricePerKg: costPriceNum,
  });

  const clientString = typeof client === 'string' ? client : client?.name || '';
  const providerString = typeof provider === 'string' ? provider : provider?.name || '';
  const productString = typeof product === 'string' ? product : product?.name || '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: OrdenCompraFormData = {
      folio,
      client: clientString,
      department: department || (clientString.includes('TH') ? 'TH' : 'GT'),
      provider: providerString,
      productDescription: productString,
      totalKilograms: totalKgNum,
      salePricePerKg: salePriceNum,
      costPricePerKg: costPriceNum,
      creditDays: Number(creditDays) || 30,
      notes,
      items: [
        {
          description: productString,
          quantity: totalKgNum,
          unitPrice: salePriceNum,
          amount: totalKgNum * salePriceNum,
        },
      ],
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div>
          <TextField
            label="Folio / Referencia OC *"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="Ej. OC-10024"
            required
            disabled={disabled}
          />
          <DuplicateRadarAlert match={duplicateOc} />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>
            Departamento / Planta *
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
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
            <option value="TH">TH — Textil Hogar (Nava / Torre Lamuño)</option>
            <option value="GT">GT — Planta P4 (Evelia)</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div>
          <ClienteField
            value={client}
            onChange={(val) => {
              setClient(val);
              if (val?.department) setDepartment(val.department);
            }}
            disabled={disabled}
          />
        </div>

        <div>
          <ProveedorField
            value={provider}
            onChange={(val) => setProvider(val)}
            disabled={disabled}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <ProductoField
          value={product}
          onChange={(val) => {
            setProduct(val);
            if (val?.unitPrice) setSalePrice(String(val.unitPrice));
          }}
          disabled={disabled}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
        <TextField
          label="Kilogramos Solicitados *"
          type="number"
          value={kilos}
          onChange={(e) => setKilos(e.target.value)}
          placeholder="1500"
          required
          disabled={disabled}
        />
        <TextField
          label="Precio Venta $/kg *"
          type="number"
          step="0.5"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
          placeholder="43.0"
          required
          disabled={disabled}
        />
        <TextField
          label="Costo Andrés $/kg *"
          type="number"
          step="0.5"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          placeholder="38.0"
          required
          disabled={disabled}
        />
        <TextField
          label="Días de Crédito"
          type="number"
          value={creditDays}
          onChange={(e) => setCreditDays(e.target.value)}
          placeholder="30"
          disabled={disabled}
        />
      </div>

      <TextField
        label="Notas / Especificaciones Especiales"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ej. Entregar en tarimas emplayadas, horario matutino..."
        disabled={disabled}
      />

      {/* Tarjeta de Resumen Financiero en Vivo */}
      <div
        style={{
          background: 'var(--paper-sunk)',
          border: '1px solid var(--line-soft)',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Venta Subtotal</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{money(fin.saleTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Total Factura (c/IVA)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{money(fin.invoiceTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Costo Andrés</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--bad)' }}>{money(fin.costTotal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', fontWeight: 700 }}>Flujo Neto Esperado</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>{money(fin.netCashFlow)}</div>
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
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="btn primary"
          disabled={disabled || totalKgNum <= 0}
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
