import { useState } from 'react';
import { Modal } from './ui';
import { money, kilos } from '../lib/format';
import type { ParsedOC } from '../lib/ocParser';

export interface OCConfirmPricing {
  sellPrice: number;
  costPrice: number;
}

/**
 * Paso intermedio entre "pegar el texto de la OC" y "aplicarlo al
 * expediente". Ahora incluye detector interactivo de precios de venta
 * y selector ágil de costo de compra pactado con Andrés ($37, $38, $43, etc.),
 * proyectando el margen unitario y utilidad estimada en tiempo real.
 */
export function OCPreviewModal({
  parsed,
  fallbackSale = 43,
  fallbackCost = 38,
  onConfirm,
  onCancel,
}: {
  parsed: ParsedOC;
  fallbackSale?: number;
  fallbackCost?: number;
  onConfirm: (pricing: OCConfirmPricing) => void;
  onCancel: () => void;
}) {
  const nadaDetectado = !parsed.folio && !parsed.oc && !parsed.client && !parsed.provider
    && parsed.items.length === 0 && parsed.totalKilograms === 0 && !parsed.estimatedDeliveryDate;

  // Detectar precio unitario de venta desde las partidas de la OC
  const initialDetectedSale = parsed.items.length > 0 && parsed.items[0].unitPrice > 0
    ? parsed.items[0].unitPrice
    : fallbackSale;

  const [sellPrice, setSellPrice] = useState<number>(initialDetectedSale);
  const [costPrice, setCostPrice] = useState<number>(fallbackCost);

  // Cálculos de margen proyectado
  const marginPerKg = Number((sellPrice - costPrice).toFixed(2));
  const totalKilos = parsed.totalKilograms || 0;
  const projectedGrossProfit = Number((marginPerKg * totalKilos).toFixed(2));
  const isLoss = marginPerKg < 0;
  const isZeroMargin = marginPerKg === 0;

  return (
    <Modal title="📋 Confirma y Calibra Precios de la OC" onClose={onCancel} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {nadaDetectado && (
          <div className="alert warn" style={{ padding: '12px 16px', borderRadius: 'var(--radius)' }}>
            No se detectó ningún dato reconocible en el texto pegado. Puedes cancelar y capturar a mano.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Campo label="Folio Interno" valor={parsed.folio} />
          <Campo label="Número de OC" valor={parsed.oc} />
          <Campo label="Cliente" valor={parsed.client} />
          <Campo label="Proveedor Asignado" valor={parsed.provider || 'Andrés'} />
          <Campo label="Fecha de Entrega" valor={parsed.estimatedDeliveryDate ? parsed.estimatedDeliveryDate.toLocaleDateString('es-MX') : ''} />
          <Campo label="Kilos Totales Pedidos" valor={parsed.totalKilograms > 0 ? kilos(parsed.totalKilograms) : ''} />
        </div>

        {/* 💵 CALIBRACIÓN INTELIGENTE DE PRECIOS FLUCTUANTES */}
        <div
          style={{
            background: 'var(--paper-sunk)',
            border: '1.5px solid var(--line)',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--ink)' }}>
              🏷️ Detección y Calibración de Precios ($/kg)
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
              *Estos precios se aplicarán a la OC sin afectar los valores globales
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {/* PRECIO DE VENTA (PROVIDENCIA) */}
            <div style={{ background: 'var(--paper)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>
                  Precio Venta a Providencia
                </label>
                {initialDetectedSale > 0 && (
                  <span style={{ fontSize: 10.5, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>
                    OC: ${initialDetectedSale.toFixed(2)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 900, color: 'var(--ink-soft)' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--paper-sunk)',
                    color: '#2563eb',
                    fontWeight: 900,
                    fontSize: 15,
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>/kg</span>
              </div>
            </div>

            {/* COSTO DE COMPRA (ANDRÉS) */}
            <div style={{ background: 'var(--paper)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>
                  Costo de Compra (Andrés)
                </label>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>
                  Accesos rápidos:
                </span>
              </div>

              {/* Botones de precios frecuentes de Andrés ($37, $38, $43) */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {[37, 38, 43].map((priceOption) => (
                  <button
                    key={priceOption}
                    type="button"
                    onClick={() => setCostPrice(priceOption)}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: costPrice === priceOption ? '1.5px solid #059669' : '1px solid var(--line)',
                      background: costPrice === priceOption ? '#d1fae5' : 'var(--paper-sunk)',
                      color: costPrice === priceOption ? '#065f46' : 'var(--ink)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ${priceOption}.00
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 900, color: 'var(--ink-soft)' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--paper-sunk)',
                    color: '#059669',
                    fontWeight: 900,
                    fontSize: 15,
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>/kg</span>
              </div>
            </div>
          </div>

          {/* TARJETA DE MARGEN Y PROYECCIÓN FINANCIERA */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: isLoss ? '#fef2f2' : isZeroMargin ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${isLoss ? '#f87171' : isZeroMargin ? '#fcd34d' : '#86efac'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: isLoss ? '#991b1b' : isZeroMargin ? '#92400e' : '#166534' }}>
                {isLoss ? '⚠️ Advertencia de Margen Negativo' : isZeroMargin ? '⚖️ Margen Neutro' : '📊 Rentabilidad Proyectada'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
                Margen pactado: <strong style={{ color: isLoss ? '#dc2626' : '#059669', fontFamily: 'monospace' }}>
                  {marginPerKg >= 0 ? `+$${marginPerKg.toFixed(2)}` : `-$${Math.abs(marginPerKg).toFixed(2)}`}/kg
                </strong>
                {sellPrice > 0 && ` (${((marginPerKg / sellPrice) * 100).toFixed(1)}%)`}
              </div>
            </div>

            {totalKilos > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>Utilidad Total Estimada ({kilos(totalKilos)})</div>
                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: isLoss ? '#dc2626' : '#059669' }}>
                  {money(projectedGrossProfit)}
                </div>
              </div>
            )}
          </div>
        </div>

        {parsed.items.length > 0 ? (
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Artículos detectados ({parsed.items.length})</h4>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th className="num">Cantidad</th>
                    <th className="num">P. Unitario</th>
                    <th className="num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.items.map((it) => (
                    <tr key={it.id}>
                      <td className="mono">{it.code || '—'}</td>
                      <td>{it.description}</td>
                      <td className="num mono">{kilos(it.quantity)}</td>
                      <td className="num mono">{money(it.unitPrice)}</td>
                      <td className="num mono">{money(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="hint">No se detectaron artículos individuales línea por línea — solo se llenarán los campos de arriba si aplicas.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={() => onConfirm({ sellPrice, costPrice })}
            disabled={nadaDetectado}
          >
            ✅ Aplicar al Expediente (${sellPrice.toFixed(2)} / ${costPrice.toFixed(2)})
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: valor ? 'var(--ink)' : 'var(--warn)' }}>
        {valor || 'No detectado'}
      </div>
    </div>
  );
}
