import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { money } from '../lib/format';
import { round2 } from '../lib/finance';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useConfig } from '../hooks/useConfig';
import { triggerHaptic } from '../lib/hapticEngine';

const COST_PRESETS = [34, 37, 38, 42, 43];
const SELL_PRESETS = [43, 45, 48];

export function FloatingKiloCalculator() {
  const { settings } = useSystemSettings();
  const { config } = useConfig();
  const provName = settings?.providerName || 'Andrés';

  const [open, setOpen] = useState(false);
  const [kilosInput, setKilosInput] = useState<string>('1000');
  const [sellPrice, setSellPrice] = useState<number>(config?.salePricePerKg || 43);
  const [costPrice, setCostPrice] = useState<number>(config?.costPricePerKg || 38);

  // Sincronizar con la configuración guardada en Firestore
  useEffect(() => {
    if (config?.salePricePerKg) setSellPrice(config.salePricePerKg);
    if (config?.costPricePerKg) setCostPrice(config.costPricePerKg);
  }, [config?.salePricePerKg, config?.costPricePerKg]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-kilo-calculator', handleOpen);
    return () => window.removeEventListener('open-kilo-calculator', handleOpen);
  }, []);

  const rawKg = parseFloat(kilosInput);
  const kg = isNaN(rawKg) || rawKg < 0 ? 0 : rawKg;
  const commRate = config?.commissionRate ?? 0.08;
  const ivaRate = config?.ivaRate ?? 0.16;

  // REGLAS FINANCIERAS CANÓNICAS
  const subtotalVenta = round2(kg * sellPrice);
  const iva = round2(subtotalVenta * ivaRate);
  const totalFactura = round2(subtotalVenta + iva);
  const costoAndres = round2(kg * costPrice);

  // Comisión del contador: 8.0% del SUBTOTAL (antes de IVA)
  const comisionContador = round2(subtotalVenta * commRate);

  // Flujo bancario bruto cobrado menos comisión
  const netoCobrado = round2(totalFactura - comisionContador);

  // Utilidad operativa real del negocio (sin IVA): Subtotal - Costo Proveedor - Comisión
  const gananciaNeta = round2(subtotalVenta - costoAndres - comisionContador);
  const partePaco = round2(gananciaNeta / 2);

  // Margen unitario por kg
  const margenPorKg = kg > 0
    ? round2(gananciaNeta / kg)
    : round2(sellPrice - costPrice - round2(sellPrice * commRate));

  const isLoss = margenPorKg < 0;
  const isZeroMargin = margenPorKg === 0;

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: 16,
      }}
      onClick={() => setOpen(false)}
    >
      <motion.div
        role="dialog"
        aria-label="Calculadora rápida de Kilos a Pesos y Simulación de Tarifas"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 410,
          maxWidth: '100%',
          background: 'var(--paper, #1e293b)',
          border: '1px solid var(--line, #334155)',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          padding: 22,
          color: 'var(--ink, #f8fafc)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--line, #334155)', paddingBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🧮</span>
            <span>Calculadora Kilos & Tarifas Flotantes</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar calculadora"
            style={{ background: 'none', border: 'none', color: 'var(--ink-soft, #94a3b8)', cursor: 'pointer', fontSize: 18, padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        {/* INPUT DE KILOS */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft, #94a3b8)' }}>
              Cantidad en Kilos (kg)
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              {[500, 1000, 2000, 5000].map((quickKg) => (
                <button
                  key={quickKg}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setKilosInput(String(quickKg));
                  }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: 5,
                    border: '1px solid var(--line, #334155)',
                    background: rawKg === quickKg ? 'rgba(217, 119, 6, 0.25)' : 'var(--paper-sunk, #0f172a)',
                    color: rawKg === quickKg ? '#f59e0b' : 'var(--ink-soft, #94a3b8)',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {quickKg >= 1000 ? `${quickKg / 1000}t` : `${quickKg}k`}
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            min="0"
            step="any"
            value={kilosInput}
            onChange={(e) => setKilosInput(e.target.value)}
            placeholder="Ej. 1000"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--accent, #d97706)',
              background: 'var(--paper-sunk, #0f172a)',
              color: 'var(--ink, #fff)',
              fontSize: 18,
              fontWeight: 800,
              fontFamily: 'monospace',
            }}
            autoFocus
          />
        </div>

        {/* CONTROLES DE PRECIO CON CHIPS FLOTANTES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {/* PRECIO DE VENTA */}
          <div style={{ background: 'var(--paper-sunk, #0f172a)', padding: 10, borderRadius: 10, border: '1px solid var(--line, #334155)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft, #94a3b8)' }}>$/kg Venta Prov.</label>
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {SELL_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSellPrice(p);
                  }}
                  style={{
                    flex: 1,
                    padding: '2px 4px',
                    borderRadius: 5,
                    border: sellPrice === p ? '1.5px solid #38bdf8' : '1px solid var(--line, #334155)',
                    background: sellPrice === p ? 'rgba(56, 189, 248, 0.2)' : 'var(--paper, #1e293b)',
                    color: sellPrice === p ? '#38bdf8' : 'var(--ink-soft, #94a3b8)',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ${p}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={sellPrice}
              onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line, #334155)', background: 'var(--paper, #1e293b)', color: '#38bdf8', fontSize: 13, fontWeight: 800, fontFamily: 'monospace' }}
            />
          </div>

          {/* COSTO DE MAQUILA (FLOTANTE / NEGOCIABLE) */}
          <div style={{ background: 'var(--paper-sunk, #0f172a)', padding: 10, borderRadius: 10, border: '1px solid var(--line, #334155)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft, #94a3b8)' }}>$/kg Costo {provName}</label>
            </div>
            <div style={{ display: 'flex', gap: 2, marginBottom: 6, flexWrap: 'wrap' }}>
              {COST_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setCostPrice(p);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 26,
                    padding: '2px 3px',
                    borderRadius: 5,
                    border: costPrice === p ? '1.5px solid #10b981' : '1px solid var(--line, #334155)',
                    background: costPrice === p ? 'rgba(16, 185, 129, 0.2)' : 'var(--paper, #1e293b)',
                    color: costPrice === p ? '#10b981' : 'var(--ink-soft, #94a3b8)',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ${p}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={costPrice}
              onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line, #334155)', background: 'var(--paper, #1e293b)', color: '#10b981', fontSize: 13, fontWeight: 800, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* ALERTA DE MARGEN EN TIEMPO REAL */}
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 8,
            background: isLoss ? 'rgba(239, 68, 68, 0.15)' : isZeroMargin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)',
            border: `1px solid ${isLoss ? '#ef4444' : isZeroMargin ? '#f59e0b' : 'rgba(16, 185, 129, 0.4)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: isLoss ? '#f87171' : isZeroMargin ? '#fbbf24' : '#34d399' }}>
            {isLoss ? '⚠️ Tarifa en Pérdida Operativa' : isZeroMargin ? '⚖️ Punto de Equilibrio' : '✨ Margen Neto Real por kg'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: isLoss ? '#ef4444' : isZeroMargin ? '#f59e0b' : '#10b981' }}>
            {margenPorKg >= 0 ? `+$${margenPorKg.toFixed(2)}` : `-$${Math.abs(margenPorKg).toFixed(2)}`}/kg
          </span>
        </div>

        {/* DESGLOSE DETALLADO */}
        <div style={{ background: 'var(--paper-sunk, #0f172a)', borderRadius: 12, padding: '12px 14px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ink-soft, #94a3b8)' }}>Subtotal Venta ({sellPrice}/kg):</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{money(subtotalVenta)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ink-soft, #94a3b8)' }}>Factura c/IVA (16%):</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{money(totalFactura)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
            <span>- Comisión Contador (8% s/subtotal):</span>
            <span style={{ fontFamily: 'monospace' }}>-{money(comisionContador)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
            <span>- Costo {provName} (${costPrice}/kg):</span>
            <span style={{ fontFamily: 'monospace' }}>-{money(costoAndres)}</span>
          </div>
          <div style={{ borderTop: '1px solid var(--line, #334155)', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between', color: isLoss ? '#ef4444' : '#10b981', fontWeight: 900, fontSize: 13 }}>
            <span>Utilidad Neta Real:</span>
            <span style={{ fontFamily: 'monospace' }}>{money(gananciaNeta)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a855f7', fontSize: 11, fontWeight: 700 }}>
            <span>Reparto Paco (50% Utilidad):</span>
            <span style={{ fontFamily: 'monospace' }}>{money(partePaco)}</span>
          </div>
          <div style={{ borderTop: '1px dashed var(--line, #334155)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft, #94a3b8)', fontSize: 11 }}>
            <span>Flujo Libre en Banco (Factura - Com.):</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--ink, #fff)' }}>{money(netoCobrado)}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

