import React, { useState } from 'react';
import { Modal } from '../ui';
import { money } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';

interface OrderPriceModalProps {
  currentSellPrice: number;
  currentCostPrice: number;
  totalKilos: number;
  provName?: string;
  onSave: (sellPrice: number, costPrice: number) => void;
  onClose: () => void;
}

export const OrderPriceModal: React.FC<OrderPriceModalProps> = ({
  currentSellPrice,
  currentCostPrice,
  totalKilos,
  provName = 'Andrés',
  onSave,
  onClose,
}) => {
  const [sellPrice, setSellPrice] = useState<number>(currentSellPrice);
  const [costPrice, setCostPrice] = useState<number>(currentCostPrice);

  const marginPerKg = Number((sellPrice - costPrice).toFixed(2));
  const marginPct = sellPrice > 0 ? ((marginPerKg / sellPrice) * 100).toFixed(1) : '0';
  const totalProfit = Number((marginPerKg * totalKilos).toFixed(2));

  const handleApply = () => {
    triggerHaptic('success');
    onSave(sellPrice, costPrice);
    onClose();
  };

  return (
    <Modal title="🏷️ Calibrar Precios y Margen de la OC" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Ajusta los precios específicos para esta orden. Los cambios recalcularán automáticamente el balance de compra con {provName} y la cobranza proyectada con Providencia.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Precio de Venta */}
          <div style={{ background: 'var(--paper-sunk)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
              Precio Venta Providencia
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>$</span>
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
                  background: 'var(--paper)',
                  color: '#2563eb',
                  fontWeight: 900,
                  fontSize: 15,
                  fontFamily: 'monospace',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>/kg</span>
            </div>
          </div>

          {/* Costo de Compra */}
          <div style={{ background: 'var(--paper-sunk)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
              Costo Compra ({provName})
            </label>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
              {[34, 37, 38, 42, 43].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCostPrice(p)}
                  style={{
                    flex: 1,
                    minWidth: 28,
                    padding: '3px 4px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: costPrice === p ? '1.5px solid #059669' : '1px solid var(--line)',
                    background: costPrice === p ? '#d1fae5' : 'var(--paper)',
                    color: costPrice === p ? '#065f46' : 'var(--ink)',
                  }}
                >
                  ${p}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>$</span>
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
                  background: 'var(--paper)',
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

        {/* Proyección del Margen */}
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: marginPerKg >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${marginPerKg >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: marginPerKg >= 0 ? '#065f46' : '#991b1b' }}>
              Margen de Ganancia Resultante
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>
              {marginPerKg >= 0 ? `+$${marginPerKg.toFixed(2)}` : `-$${Math.abs(marginPerKg).toFixed(2)}`} / kg ({marginPct}%)
            </div>
          </div>
          {totalKilos > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>Utilidad Total Proyectada</div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: marginPerKg >= 0 ? '#059669' : '#dc2626' }}>
                {money(totalProfit)}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleApply}>
            💾 Guardar Precios en OC
          </button>
        </div>
      </div>
    </Modal>
  );
};
