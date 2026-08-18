import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { money } from '../lib/format';
import { round2 } from '../lib/finance';
import { useSystemSettings } from '../hooks/useSystemSettings';

export function FloatingKiloCalculator() {
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  const [open, setOpen] = useState(false);
  const [kilosInput, setKilosInput] = useState<string>('1000');
  const [sellPrice, setSellPrice] = useState<number>(43);
  const [costPrice, setCostPrice] = useState<number>(42);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // El Quick Hub (⚡) y el Command Palette (Ctrl+K) disparan este evento para
  // abrir la calculadora desde cualquier pantalla; antes nadie lo escuchaba,
  // así que ambos atajos no hacían nada (el de Command Palette encima
  // mostraba un toast de "desplegada" aunque no se abriera nada).
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-kilo-calculator', handleOpen);
    return () => window.removeEventListener('open-kilo-calculator', handleOpen);
  }, []);

  const rawKg = parseFloat(kilosInput);
  const kg = isNaN(rawKg) || rawKg < 0 ? 0 : rawKg;
  const subtotalVenta = round2(kg * sellPrice);
  const iva = round2(subtotalVenta * 0.16);
  const totalFactura = round2(subtotalVenta + iva);
  const costoAndres = round2(kg * costPrice);
  const comisionContador = round2(totalFactura * 0.08);
  const netoCobrado = round2(totalFactura - comisionContador);
  const gananciaNeta = round2(netoCobrado - costoAndres);
  const partePaco = round2(gananciaNeta / 2);

  return (
    <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 9999 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Calculadora rápida de Kilos a Pesos"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              width: 320,
              background: 'var(--paper, #1e293b)',
              border: '1px solid var(--line, #334155)',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              padding: 18,
              marginBottom: 12,
              backdropFilter: 'blur(16px)',
              color: 'var(--ink, #f8fafc)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--line, #334155)', paddingBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🧮</span> Calculadora Rápida Kilos
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar calculadora"
                style={{ background: 'none', border: 'none', color: 'var(--ink-soft, #94a3b8)', cursor: 'pointer', fontSize: 16, padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft, #94a3b8)', display: 'block', marginBottom: 4 }}>
                Cantidad en Kilos (kg)
              </label>
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
                  padding: '8px 12px',
                  borderRadius: 8,
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--ink-soft, #94a3b8)', display: 'block' }}>$/kg Venta</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line, #334155)', background: 'var(--paper-sunk, #0f172a)', color: 'var(--ink, #fff)', fontSize: 12, fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--ink-soft, #94a3b8)', display: 'block' }}>$/kg Costo {provName}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={costPrice}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line, #334155)', background: 'var(--paper-sunk, #0f172a)', color: 'var(--ink, #fff)', fontSize: 12, fontFamily: 'monospace' }}
                />
              </div>
            </div>

            {/* Desglose de Cálculo */}
            <div style={{ background: 'var(--paper-sunk, #0f172a)', borderRadius: 10, padding: '10px 12px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-soft, #94a3b8)' }}>Factura c/IVA (16%):</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{money(totalFactura)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                <span>- Comisión Contador (8%):</span>
                <span style={{ fontFamily: 'monospace' }}>-{money(comisionContador)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#3b82f6' }}>
                <span>- Costo {provName} (${costPrice}/kg):</span>
                <span style={{ fontFamily: 'monospace' }}>-{money(costoAndres)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--line, #334155)', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 900, fontSize: 13 }}>
                <span>Ganancia Neta Real:</span>
                <span style={{ fontFamily: 'monospace' }}>{money(gananciaNeta)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a855f7', fontSize: 11, fontWeight: 700 }}>
                <span>Reparto Paco (50%):</span>
                <span style={{ fontFamily: 'monospace' }}>{money(partePaco)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(!open)}
        title="Calculadora rápida de Kilos a Pesos"
        aria-label="Abrir calculadora rápida de Kilos a Pesos"
        aria-expanded={open}
        style={{
          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          boxShadow: '0 8px 24px rgba(217, 119, 6, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 22,
        }}
      >
        🧮
      </motion.button>
    </div>
  );
}
