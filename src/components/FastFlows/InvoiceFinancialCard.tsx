import { money } from '../../lib/format';

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
  selectedRowsCount: number;
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
  selectedRowsCount,
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

      {/* Captura de Folio y Botón de Emisión */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
            Folio de la Factura (SAT) *
          </label>
          <input
            type="text"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="Ej. 6205, A-1044..."
            className="input boxed mono"
            style={{
              width: '100%',
              fontSize: 15,
              fontWeight: 800,
              padding: '10px 14px',
              borderRadius: 10,
              border: duplicateInvoice ? '2px solid var(--bad)' : undefined,
            }}
          />
          {duplicateInvoice && (
            <div style={{ color: 'var(--bad)', fontSize: 11.5, fontWeight: 700, marginTop: 4 }}>
              🚨 Folio duplicado: ya existe en la OC #{duplicateInvoice.orderFolio}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
            disabled={saving || !folio.trim() || kilosToInvoice <= 0 || !!duplicateInvoice}
            style={{
              padding: '10px 24px',
              fontWeight: 800,
              fontSize: 14,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
            }}
          >
            {saving ? '⏳ Emitiendo...' : `🧾 Emitir Factura (${kilosToInvoice.toLocaleString('es-MX')} kg)`}
          </button>
        </div>
      </div>
    </div>
  );
}
