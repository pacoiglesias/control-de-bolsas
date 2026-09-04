import { money } from '../../lib/format';
import type { InvoiceGuardrailResult } from '../../lib/finance';

interface InvoiceFinancialCardProps {
  kilosToInvoice: number;
  subtotalEstimado: number;
  ivaEstimado: number;
  totalEstimadoConIva: number;
  costoEstimado: number;
  gananciaEstimada: number;
  currentSellPrice: number;
  currentCostPrice: number;
  folio: string;
  setFolio: (v: string) => void;
  duplicateInvoice: { orderFolio?: string } | null;
  saving: boolean;
  onInvoice: () => void;
  onClose: () => void;
  onDownloadPrefactura?: () => void;
  onDownloadXmlDraft?: () => void;
  onWhatsAppContador?: () => void;
  selectedRowsCount: number;
  guardrail?: InvoiceGuardrailResult | null;
}

export function InvoiceFinancialCard({
  kilosToInvoice,
  subtotalEstimado,
  ivaEstimado,
  totalEstimadoConIva,
  costoEstimado,
  gananciaEstimada,
  currentSellPrice,
  currentCostPrice,
  folio,
  setFolio,
  duplicateInvoice,
  saving,
  onInvoice,
  onClose,
  onDownloadPrefactura,
  onDownloadXmlDraft,
  onWhatsAppContador,
  selectedRowsCount,
  guardrail,
}: InvoiceFinancialCardProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.03) 0%, rgba(30,41,59,0.06) 100%)',
        border: '1.5px solid var(--line)',
        borderRadius: 14,
        padding: '16px 20px',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🧮</span> 3. Resumen Financiero & Folio Fiscal
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={{ background: 'var(--paper-raised)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Kilos Amparados</div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 900, color: '#059669', marginTop: 2 }}>
            {kilosToInvoice.toLocaleString('es-MX')} kg
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 1 }}>{selectedRowsCount} partida(s)</div>
        </div>

        <div style={{ background: 'var(--paper-raised)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Subtotal (s/IVA)</div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>
            {money(subtotalEstimado)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 1 }}>${currentSellPrice.toFixed(2)}/kg</div>
        </div>

        <div style={{ background: 'var(--paper-raised)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600 }}>IVA (16%)</div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
            {money(ivaEstimado)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 1 }}>Impuesto trasladado</div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(59,130,246,0.15) 100%)',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1.5px solid #2563eb',
          }}
        >
          <div style={{ fontSize: 10.5, color: '#1d4ed8', fontWeight: 700 }}>Total con IVA</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 900, color: '#1d4ed8', marginTop: 2 }}>
            {money(totalEstimadoConIva)}
          </div>
          <div style={{ fontSize: 10, color: '#2563eb', marginTop: 1 }}>A cobrar a Providencia</div>
        </div>

        <div style={{ background: 'var(--paper-raised)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Margen Bruto Est.</div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 900, color: '#059669', marginTop: 2 }}>
            {money(gananciaEstimada)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 1 }}>Costo: {money(costoEstimado)} (${currentCostPrice.toFixed(2)}/kg)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
            Folio Fiscal de la Factura (Opcional si es Prefactura)
          </label>
          <input
            type="text"
            className="input mono"
            placeholder="Ej: 6200, 6266"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            disabled={saving}
            style={{
              width: '100%',
              fontSize: 14,
              fontWeight: 700,
              padding: '10px 14px',
              borderRadius: 10,
              borderColor: duplicateInvoice ? 'var(--bad)' : undefined,
            }}
          />
          {duplicateInvoice && (
            <div style={{ color: 'var(--bad)', fontSize: 11, fontWeight: 700, marginTop: 4 }}>
              ⚠️ El folio ya existe en el expediente {duplicateInvoice.orderFolio}.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {onDownloadPrefactura && (
            <button
              type="button"
              className="btn"
              onClick={onDownloadPrefactura}
              disabled={saving || kilosToInvoice <= 0}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #107c41 0%, #185a30 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 124, 65, 0.25)',
              }}
              title="Descargar archivo Excel (.xlsx) con la plantilla oficial para el facturador"
            >
              <span>📊</span>
              <span>Prefactura Excel (.xlsx)</span>
            </button>
          )}
          {onDownloadXmlDraft && (
            <button
              type="button"
              className="btn"
              onClick={onDownloadXmlDraft}
              disabled={saving || kilosToInvoice <= 0}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#2563eb',
                border: '1.5px solid rgba(59, 130, 246, 0.4)',
                fontWeight: 800,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
              title="Descargar borrador XML CFDI 4.0 estructurado para importar al sistema contable"
            >
              <span>📄</span>
              <span>Borrador XML CFDI 4.0</span>
            </button>
          )}
          {onWhatsAppContador && (
            <button
              type="button"
              className="btn"
              onClick={onWhatsAppContador}
              disabled={saving || kilosToInvoice <= 0}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(37,211,102,0.12)',
                color: '#16a34a',
                border: '1.5px solid rgba(37,211,102,0.4)',
                fontWeight: 800,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
              title="Copiar mensaje oficial de WhatsApp para solicitar la factura al contador"
            >
              <span>📲</span>
              <span>WhatsApp Contador</span>
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={onClose}
            style={{ padding: '10px 18px', borderRadius: 10 }}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onInvoice}
            disabled={
              saving ||
              !folio.trim() ||
              kilosToInvoice <= 0 ||
              !!duplicateInvoice ||
              Boolean(guardrail?.isOverDelivered || guardrail?.isOverOrdered)
            }
            style={{
              padding: '10px 24px',
              fontWeight: 800,
              fontSize: 14,
              borderRadius: 10,
              background:
                guardrail?.isOverDelivered || guardrail?.isOverOrdered
                  ? 'var(--bad)'
                  : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
            }}
          >
            {saving
              ? '⏳ Emitiendo...'
              : guardrail?.isOverDelivered || guardrail?.isOverOrdered
              ? '⛔ Sobrefacturación Detectada'
              : `🧾 Emitir Factura (${kilosToInvoice.toLocaleString('es-MX')} kg)`}
          </button>
        </div>
      </div>

      {guardrail && (guardrail.isOverDelivered || guardrail.isOverOrdered) && (
        <div
          style={{
            marginTop: 12,
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid #dc2626',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: '#b91c1c',
          }}
        >
          🛡️ {guardrail.message}
        </div>
      )}
    </div>
  );
}
