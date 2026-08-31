import { CANONICAL_TH_ITEMS, CANONICAL_GT_ITEMS, type PurchaseOrderItem } from '../../lib/types';
import { money } from '../../lib/format';

export interface ConceptRow {
  id: string;
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  selected: boolean;
  quantity: number;
  ocQuantity: number;
  alreadyInvoiced: number;
  alreadyDelivered: number;
  uninvoicedDeliveredKilos: number;
  remainingOcKilos: number;
  maxAvailable: number;
}

interface InvoiceConceptTableProps {
  conceptRows: ConceptRow[];
  selectedRows: ConceptRow[];
  availableKilos: number;
  kilosToInvoice: number;
  pctAmparado: number;
  currentSellPrice: number;
  onApplyTemplate: (items: PurchaseOrderItem[]) => void;
  onSelectAll: (select: boolean) => void;
  onAddNewRow: () => void;
  onToggleRow: (index: number) => void;
  onUpdateField: <K extends keyof ConceptRow>(index: number, field: K, val: ConceptRow[K]) => void;
  onFillMax: (index: number) => void;
  onRemoveRow: (index: number) => void;
  onDownloadPrefactura?: () => void;
}

export function InvoiceConceptTable({
  conceptRows,
  selectedRows,
  availableKilos,
  kilosToInvoice,
  pctAmparado,
  currentSellPrice,
  onApplyTemplate,
  onSelectAll,
  onAddNewRow,
  onToggleRow,
  onUpdateField,
  onFillMax,
  onRemoveRow,
  onDownloadPrefactura,
}: InvoiceConceptTableProps) {
  return (
    <div
      style={{
        background: 'var(--paper-raised)',
        padding: 16,
        borderRadius: 14,
        border: '1px solid var(--line)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📦</span> 2. Conceptos a Incluir en la Factura ({selectedRows.length} de {conceptRows.length} seleccionados)
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            El sistema descuenta automáticamente los kilos ya facturados y calcula el disponible real recibido de báscula.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 10.5, padding: '3px 8px', background: 'rgba(59,130,246,0.08)', color: '#1d4ed8', border: '1px solid #3b82f6', fontWeight: 700 }}
            onClick={() => onApplyTemplate(CANONICAL_TH_ITEMS)}
            title="Cargar las 6 partidas de Textil Hogar"
          >
            🏷️ Plantilla TH (6)
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 10.5, padding: '3px 8px', background: 'rgba(22,163,74,0.08)', color: '#15803d', border: '1px solid #16a34a', fontWeight: 700 }}
            onClick={() => onApplyTemplate(CANONICAL_GT_ITEMS)}
            title="Cargar las 4 partidas de Grupo Textil"
          >
            🏷️ Plantilla GT (4)
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 10.5, padding: '3px 7px', background: 'var(--paper)', border: '1px solid var(--line)' }}
            onClick={() => onSelectAll(true)}
          >
            ⚡ Todos
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 10.5, padding: '3px 7px', background: 'var(--paper)', border: '1px solid var(--line)' }}
            onClick={() => onSelectAll(false)}
          >
            Ninguno
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: 10.5, padding: '3px 10px' }}
            onClick={onAddNewRow}
          >
            + Fila
          </button>
          {onDownloadPrefactura && (
            <button
              type="button"
              className="btn"
              style={{
                fontSize: 11,
                padding: '4px 12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                borderRadius: 8,
                boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
              onClick={onDownloadPrefactura}
              disabled={kilosToInvoice <= 0}
              title="Descargar Prefactura oficial en Excel (.xlsx)"
            >
              <span>📊</span>
              <span>Prefactura Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Resumen de kilos seleccionados */}
      {availableKilos > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ink-soft)' }}>Amparando en esta factura:</span>
          <span className="mono" style={{ fontWeight: 800, color: '#059669', fontSize: 13 }}>
            {kilosToInvoice.toLocaleString('es-MX')} kg
          </span>
          <span style={{ color: 'var(--ink-soft)' }}>de</span>
          <span className="mono" style={{ fontWeight: 700, color: '#2563eb' }}>
            {availableKilos.toLocaleString('es-MX')} kg listos de báscula
          </span>
          <span className="badge" style={{ background: pctAmparado === 100 ? '#059669' : '#2563eb', fontSize: 10 }}>
            {pctAmparado}%
          </span>
        </div>
      )}

      {conceptRows.length > 0 ? (
        <>
          {/* TABLA Desktop */}
          <div className="qim-concept-table">
            <div className="table-scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="data-table" style={{ margin: 0, fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-sunk)', zIndex: 2 }}>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>Inc.</th>
                    <th style={{ width: 90 }}>SAT</th>
                    <th>Descripción / Partida</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Total OC</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Ya Fact.</th>
                    <th style={{ width: 85, textAlign: 'right' }}>Falta Fact.</th>
                    <th style={{ width: 85, textAlign: 'right' }}>Báscula</th>
                    <th style={{ width: 135, textAlign: 'right' }}>A Facturar (kg)</th>
                    <th style={{ width: 95, textAlign: 'right' }}>P. Unit</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Importe</th>
                    <th style={{ width: 32, textAlign: 'center' }}>✕</th>
                  </tr>
                </thead>
                <tbody>
                  {conceptRows.map((r, i) => {
                    const rowSubtotal = (Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice);
                    const isFullyInvoiced = r.alreadyInvoiced >= r.ocQuantity && r.ocQuantity > 0;
                    return (
                      <tr
                        key={r.id}
                        style={{
                          background: isFullyInvoiced
                            ? 'rgba(0,0,0,0.02)'
                            : r.selected
                            ? 'rgba(5,150,105,0.04)'
                            : 'transparent',
                          opacity: isFullyInvoiced ? 0.6 : r.selected ? 1 : 0.5,
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={() => onToggleRow(i)}
                            style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--ok)' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={r.code}
                            onChange={(e) => onUpdateField(i, 'code', e.target.value)}
                            className="input mono"
                            style={{ fontSize: 11, padding: '3px 5px', width: '100%', borderRadius: 6 }}
                            placeholder="24141500"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={r.description}
                            onChange={(e) => onUpdateField(i, 'description', e.target.value)}
                            className="input"
                            style={{ fontSize: 12, padding: '3px 6px', width: '100%', borderRadius: 6, fontWeight: 600 }}
                            placeholder="Descripción de la bolsa"
                          />
                          {isFullyInvoiced && (
                            <span style={{ fontSize: 10, color: '#059669', fontWeight: 700, display: 'block', marginTop: 2 }}>
                              ✓ 100% Facturado
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--ink-soft)' }} className="mono">
                          {r.ocQuantity > 0 ? `${r.ocQuantity.toLocaleString('es-MX')} kg` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: r.alreadyInvoiced > 0 ? '#7c3aed' : 'var(--ink-soft)', fontWeight: 600 }} className="mono">
                          {r.alreadyInvoiced > 0 ? `${r.alreadyInvoiced.toLocaleString('es-MX')} kg` : '0 kg'}
                        </td>
                        <td style={{ textAlign: 'right', color: r.remainingOcKilos > 0 ? '#b45309' : '#059669', fontWeight: 700 }} className="mono">
                          {r.remainingOcKilos > 0 ? `${r.remainingOcKilos.toLocaleString('es-MX')} kg` : '🟢 0 kg'}
                        </td>
                        <td style={{ textAlign: 'right', color: r.uninvoicedDeliveredKilos > 0 ? '#2563eb' : 'var(--ink-soft)', fontWeight: 700 }} className="mono">
                          {r.uninvoicedDeliveredKilos > 0 ? `${r.uninvoicedDeliveredKilos.toLocaleString('es-MX')} kg` : '0 kg'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={r.quantity || ''}
                              onChange={(e) => {
                                onUpdateField(i, 'quantity', parseFloat(e.target.value) || 0);
                                if (!r.selected) onToggleRow(i);
                              }}
                              className="input mono"
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                textAlign: 'right',
                                padding: '4px 6px',
                                width: 85,
                                borderRadius: 6,
                                color: r.selected ? '#059669' : 'inherit',
                              }}
                            />
                            {r.maxAvailable > 0 && r.quantity !== r.maxAvailable && (
                              <button
                                type="button"
                                className="btn"
                                style={{ fontSize: 9, padding: '2px 4px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                                onClick={() => onFillMax(i)}
                                title={`Llenar al disponible (${r.maxAvailable.toLocaleString('es-MX')} kg)`}
                              >
                                Max
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={r.unitPrice || ''}
                              onChange={(e) => onUpdateField(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="input mono"
                              style={{ fontSize: 11.5, textAlign: 'right', padding: '3px 5px', width: 58, borderRadius: 6 }}
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }} className="mono">
                          {money(rowSubtotal)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => onRemoveRow(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 14, opacity: 0.7 }}
                            title="Eliminar partida"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* VISTA MÓVIL (Cards) */}
          <div className="qim-concept-cards" style={{ flexDirection: 'column', gap: 10 }}>
            {conceptRows.map((r, i) => {
              const rowSubtotal = (Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice);
              return (
                <div
                  key={r.id}
                  style={{
                    background: r.selected ? 'rgba(5,150,105,0.04)' : 'var(--paper-sunk)',
                    border: r.selected ? '1px solid rgba(5,150,105,0.3)' : '1px solid var(--line-soft)',
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={() => onToggleRow(i)}
                        style={{ width: 18, height: 18, accentColor: 'var(--ok)' }}
                      />
                      <input
                        type="text"
                        value={r.description}
                        onChange={(e) => onUpdateField(i, 'description', e.target.value)}
                        className="input"
                        style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 6px', borderRadius: 6, flex: 1 }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveRow(i)}
                      style={{ background: 'none', border: 'none', color: 'var(--bad)', fontSize: 16 }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8 }}>
                    <div>OC: <strong style={{ color: 'var(--ink)' }}>{r.ocQuantity.toLocaleString('es-MX')} kg</strong></div>
                    <div>Ya Facturado: <strong style={{ color: '#7c3aed' }}>{r.alreadyInvoiced.toLocaleString('es-MX')} kg</strong></div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--ink-soft)', display: 'block', marginBottom: 2 }}>Kilos a facturar</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.quantity || ''}
                        onChange={(e) => onUpdateField(i, 'quantity', parseFloat(e.target.value) || 0)}
                        className="input mono"
                        style={{ fontSize: 13, fontWeight: 800, padding: '5px 8px', width: '100%', borderRadius: 6, color: '#059669' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--ink-soft)', display: 'block', marginBottom: 2 }}>Precio unitario ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={r.unitPrice || ''}
                        onChange={(e) => onUpdateField(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="input mono"
                        style={{ fontSize: 12.5, padding: '5px 8px', width: '100%', borderRadius: 6 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--line-soft)' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Subtotal partida:</span>
                    <span className="mono" style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>{money(rowSubtotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ink-soft)', fontSize: 13 }}>
          No hay conceptos configurados. Haz clic en "Agregar" o carga una plantilla.
        </div>
      )}
    </div>
  );
}
