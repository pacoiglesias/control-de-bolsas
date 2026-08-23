import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { triggerHaptic } from '../../lib/hapticEngine';
import { useToast } from '../../context/ToastContext';
import { money } from '../../lib/format';
import type { FinancialConfig } from '../../lib/types';

interface AdminQuickEditPanelProps {
  open: boolean;
  onClose: () => void;
  config: FinancialConfig;
  saldoAndres: number;
  totalPagadoAndres: number;
  totalPurchasesCost: number;
  providerName?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Lógica de coherencia: cada campo define su propio preview y sus alertas
// basados en el valor que el usuario está ingresando + el estado actual.
// ──────────────────────────────────────────────────────────────────────────────
interface CoherenceResult {
  chips: Array<{ label: string; value: string; color: string }>;
  warnings: string[];
}

function computeCoherence(
  fieldId: string,
  draftNum: number,
  config: FinancialConfig,
  extras: { saldoAndres: number; totalPagadoAndres: number; totalPurchasesCost: number }
): CoherenceResult {
  const chips: CoherenceResult['chips'] = [];
  const warnings: string[] = [];

  const sale = fieldId === 'salePricePerKg' ? draftNum : (config.salePricePerKg || 43);
  const cost = fieldId === 'costPricePerKg' ? draftNum : (config.costPricePerKg || 42);
  const commRate = fieldId === 'commissionRate' ? draftNum / 100 : (config.commissionRate || 0.02);
  const iva = fieldId === 'ivaRate' ? draftNum / 100 : (config.ivaRate ?? 0.16);

  if (fieldId === 'salePricePerKg' || fieldId === 'costPricePerKg') {
    const marginPerKg = sale - cost;
    const marginPct = sale > 0 ? (marginPerKg / sale) * 100 : 0;
    const commPerKg = sale * commRate;
    const netPerKg = marginPerKg - commPerKg;
    const ivaAmount = sale * iva;
    const totalClient = sale + ivaAmount;

    chips.push({ label: 'Margen bruto/kg', value: money(marginPerKg), color: marginPerKg >= 0 ? '#10b981' : '#ef4444' });
    chips.push({ label: 'Margen %', value: marginPct.toFixed(1) + '%', color: marginPct >= 5 ? '#10b981' : marginPct >= 0 ? '#f59e0b' : '#ef4444' });
    chips.push({ label: 'Comisión/kg', value: money(commPerKg), color: '#6366f1' });
    chips.push({ label: 'Neto/kg (tras comisión)', value: money(netPerKg), color: netPerKg >= 0 ? '#10b981' : '#ef4444' });
    chips.push({ label: 'Total factura al cliente/kg', value: money(totalClient), color: '#94a3b8' });

    if (marginPerKg < 0) {
      warnings.push(`⚠️ PÉRDIDA: el costo ($${cost}/kg) supera el precio de venta ($${sale}/kg). Cada kilo vendido genera una pérdida de ${money(Math.abs(marginPerKg))}.`);
    } else if (marginPct < 3) {
      warnings.push(`⚠️ Margen muy ajustado (${marginPct.toFixed(1)}%). Considera revisar precios para cubrir gastos fijos.`);
    }

    if (fieldId === 'costPricePerKg') {
      // Impacto en saldo Andrés: el costo nuevo cambia totalPurchasesCost en el futuro
      const currentNetAndres = extras.totalPagadoAndres - extras.totalPurchasesCost;
      chips.push({ label: 'Saldo actual con Andrés', value: money(extras.saldoAndres), color: extras.saldoAndres >= 0 ? '#6366f1' : '#f59e0b' });
      chips.push({ label: '(Este campo afecta las compras futuras con Andrés)', value: '', color: '#64748b' });
      if (currentNetAndres !== extras.saldoAndres) {
        chips.push({ label: 'Ajuste histórico activo', value: money(config.historicalDebtAndres ?? 0), color: '#8b5cf6' });
      }
    }
  }

  if (fieldId === 'commissionRate') {
    const commPerKg = sale * draftNum / 100;
    const marginPerKg = sale - cost;
    const netPerKg = marginPerKg - commPerKg;
    chips.push({ label: 'Comisión/kg sobre precio actual', value: money(commPerKg), color: '#6366f1' });
    chips.push({ label: 'Neto/kg tras comisión', value: money(netPerKg), color: netPerKg >= 0 ? '#10b981' : '#ef4444' });
    chips.push({ label: 'Comisión sobre factura 100 kg', value: money(commPerKg * 100), color: '#94a3b8' });
    if (draftNum > 5) {
      warnings.push(`⚠️ Comisión alta (${draftNum.toFixed(1)}%). El estándar del sector suele estar entre 1% y 3%.`);
    }
  }

  if (fieldId === 'ivaRate') {
    const ivaPerKg = sale * draftNum / 100;
    const totalClientPerKg = sale + ivaPerKg;
    chips.push({ label: 'IVA/kg sobre precio actual', value: money(ivaPerKg), color: '#f59e0b' });
    chips.push({ label: 'Total al cliente/kg (precio + IVA)', value: money(totalClientPerKg), color: '#6366f1' });
    chips.push({ label: 'IVA sobre factura de 100 kg', value: money(ivaPerKg * 100), color: '#94a3b8' });
    if (draftNum !== 16) {
      warnings.push(`ℹ️ La tasa estándar en México es 16%. Confirma que ${draftNum}% es intencional.`);
    }
  }

  if (fieldId === 'creditDays') {
    if (draftNum <= 0) warnings.push('⚠️ Plazo de 0 días significa pago inmediato (contado). Solo úsalo si es intencional.');
    if (draftNum > 90) warnings.push(`⚠️ Crédito muy largo (${draftNum} días). Esto puede afectar el flujo de caja.`);
    if (draftNum > 0 && draftNum <= 30) chips.push({ label: 'Perfil', value: 'Crédito corto (recomendado)', color: '#10b981' });
    if (draftNum > 30 && draftNum <= 60) chips.push({ label: 'Perfil', value: 'Crédito estándar', color: '#f59e0b' });
    if (draftNum > 60) chips.push({ label: 'Perfil', value: 'Crédito largo — riesgo alto', color: '#ef4444' });
  }

  if (fieldId === 'historicalDebtAndres') {
    // El usuario ingresa el SALDO REAL que desea. Mostramos el ajuste que se necesitará.
    const currentCalc = extras.totalPagadoAndres - extras.totalPurchasesCost;
    const requiredHistorical = draftNum - currentCalc;
    chips.push({ label: 'Saldo calculado sin ajuste', value: money(currentCalc), color: '#94a3b8' });
    chips.push({ label: 'Saldo deseado (nuevo)', value: money(draftNum), color: draftNum >= 0 ? '#10b981' : '#f59e0b' });
    chips.push({ label: 'Ajuste histórico a guardar', value: money(requiredHistorical), color: '#8b5cf6' });
    chips.push({ label: 'Total pagado a Andrés', value: money(extras.totalPagadoAndres), color: '#6366f1' });
    chips.push({ label: 'Costo total compras', value: money(extras.totalPurchasesCost), color: '#6366f1' });
    if (draftNum > 0) chips.push({ label: 'Interpretación', value: 'Andrés tiene saldo a favor (anticipos)', color: '#10b981' });
    if (draftNum < 0) chips.push({ label: 'Interpretación', value: 'Empresa debe a Andrés (pasivo)', color: '#f59e0b' });
    if (draftNum === 0) chips.push({ label: 'Interpretación', value: 'Saldados (cuentas a cero)', color: '#94a3b8' });
  }

  return { chips, warnings };
}

export function AdminQuickEditPanel({
  open,
  onClose,
  config,
  saldoAndres,
  totalPagadoAndres,
  totalPurchasesCost,
  providerName = 'Andrés',
}: AdminQuickEditPanelProps) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState<string | null>(null);

  const extras = { saldoAndres, totalPagadoAndres, totalPurchasesCost };

  // Live preview: se recalcula en cada keystroke
  const draftNum = parseFloat(draft.replace(/[^0-9.-]/g, ''));
  const coherence = useMemo<CoherenceResult>(() => {
    if (!editingId || isNaN(draftNum)) return { chips: [], warnings: [] };
    return computeCoherence(editingId, draftNum, config, extras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, draftNum, config.salePricePerKg, config.costPricePerKg, config.commissionRate, saldoAndres]);

  const FIELDS = [
    {
      id: 'salePricePerKg',
      label: 'Precio de Venta',
      description: 'Precio/kg al cliente (sin IVA). Afecta todos los expedientes sin precio propio.',
      icon: '💰',
      getValue: () => config.salePricePerKg,
      format: (v: number) => money(v) + '/kg',
      step: 0.5,
      save: async (v: number) => {
        await setDoc(doc(db, PATHS.config, 'financials'), { salePricePerKg: v }, { merge: true });
      },
    },
    {
      id: 'costPricePerKg',
      label: 'Costo de Compra',
      description: `Costo/kg pagado a ${providerName}. Base del margen y la conciliación de cuenta.`,
      icon: '🏭',
      getValue: () => config.costPricePerKg,
      format: (v: number) => money(v) + '/kg',
      step: 0.5,
      save: async (v: number) => {
        await setDoc(doc(db, PATHS.config, 'financials'), { costPricePerKg: v }, { merge: true });
      },
    },
    {
      id: 'commissionRate',
      label: 'Comisión Contador',
      description: 'Honorario del contador por gestión de cobro (% sobre subtotal sin IVA).',
      icon: '🧾',
      getValue: () => config.commissionRate * 100,
      format: (v: number) => v.toFixed(2) + '%',
      step: 0.1,
      save: async (v: number) => {
        await setDoc(doc(db, PATHS.config, 'financials'), { commissionRate: v / 100 }, { merge: true });
      },
    },
    {
      id: 'ivaRate',
      label: 'Tasa de IVA',
      description: 'Porcentaje de IVA aplicado a las facturas (normalmente 16%).',
      icon: '🇲🇽',
      getValue: () => (config.ivaRate ?? 0.16) * 100,
      format: (v: number) => v.toFixed(1) + '%',
      step: 0.5,
      save: async (v: number) => {
        await setDoc(doc(db, PATHS.config, 'financials'), { ivaRate: v / 100 }, { merge: true });
      },
    },
    {
      id: 'creditDays',
      label: 'Días de Crédito',
      description: 'Plazo de pago desde que se emite el contrarecibo.',
      icon: '📅',
      getValue: () => config.creditDays,
      format: (v: number) => v + ' días',
      step: 1,
      save: async (v: number) => {
        await setDoc(doc(db, PATHS.config, 'financials'), { creditDays: v }, { merge: true });
      },
    },
    {
      id: 'historicalDebtAndres',
      label: `Saldo con ${providerName}`,
      description: `Ingresa el saldo real que tienes con ${providerName}. El sistema calcula el ajuste histórico automáticamente.`,
      icon: '⚖️',
      getValue: () => saldoAndres,
      format: (v: number) => money(v),
      step: 100,
      save: async (v: number) => {
        const diff = v - (totalPagadoAndres - totalPurchasesCost);
        await setDoc(doc(db, PATHS.config, 'financials'), { historicalDebtAndres: diff }, { merge: true });
      },
    },
  ];

  function startEdit(fieldId: string) {
    const field = FIELDS.find(f => f.id === fieldId)!;
    setEditingId(fieldId);
    setDraft(String(field.getValue()));
  }

  async function commitEdit(fieldId: string) {
    const field = FIELDS.find(f => f.id === fieldId)!;
    const v = parseFloat(draft.replace(/[^0-9.-]/g, ''));
    if (isNaN(v)) { toast('❌ Valor inválido', 'bad'); return; }
    setSaving(fieldId);
    try {
      await field.save(v);
      triggerHaptic('success');
      toast(`✅ ${field.label} actualizado.`, 'ok');
      setEditingId(null);
    } catch (e) {
      toast(`❌ Error: ${(e as Error).message}`, 'bad');
    } finally {
      setSaving(null);
    }
  }

  function cancelEdit() { setEditingId(null); setDraft(''); }

  const hasCoherence = coherence.chips.length > 0 || coherence.warnings.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 'min(460px, 95vw)',
              background: 'var(--bg-elevated, #1a1a2e)',
              borderLeft: '1px solid var(--glass-border)',
              zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px', borderBottom: '1px solid var(--glass-border)',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%)',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>⚡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>Edición Rápida del Sistema</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                  Preview en vivo · Alertas de coherencia · Guardado atómico a Firestore
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-soft)', padding: 4, borderRadius: 8 }}>✕</button>
            </div>

            {/* Fields */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FIELDS.map((field) => {
                const currentValue = field.getValue();
                const isEditing = editingId === field.id;
                const isSaving = saving === field.id;
                const showCoherence = isEditing && hasCoherence && !isNaN(draftNum);

                return (
                  <motion.div key={field.id} layout style={{
                    background: isEditing ? 'rgba(99,102,241,0.12)' : 'var(--glass-bg)',
                    border: `1px solid ${isEditing ? 'rgba(99,102,241,0.5)' : 'var(--glass-border)'}`,
                    borderRadius: 16, padding: '14px 16px',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}>
                    {/* Row: icon + label + current value + edit btn */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isEditing ? 12 : 0 }}>
                      <span style={{ fontSize: 22 }}>{field.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{field.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1, lineHeight: 1.4 }}>{field.description}</div>
                      </div>
                      {!isEditing && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{field.format(currentValue)}</div>
                          <button
                            onClick={() => startEdit(field.id)}
                            style={{
                              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                              borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#818cf8',
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >✏️ Editar</button>
                        </div>
                      )}
                    </div>

                    {/* Inline editor */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          {/* Input row */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                            <input
                              type="number"
                              step={field.step ?? 1}
                              value={draft}
                              autoFocus
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') void commitEdit(field.id); if (e.key === 'Escape') cancelEdit(); }}
                              style={{
                                flex: 1, padding: '8px 12px', borderRadius: 10,
                                border: '1px solid rgba(99,102,241,0.5)',
                                background: 'rgba(99,102,241,0.08)',
                                color: 'var(--ink)', fontSize: 15, fontWeight: 700, outline: 'none',
                              }}
                            />
                            <button
                              disabled={isSaving}
                              onClick={() => void commitEdit(field.id)}
                              style={{
                                background: coherence.warnings.length > 0
                                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', border: 'none', borderRadius: 10,
                                padding: '8px 16px', fontWeight: 700, fontSize: 13,
                                cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1,
                              }}
                            >{isSaving ? '⏳' : coherence.warnings.length > 0 ? '⚠️ Guardar' : '✓ Guardar'}</button>
                            <button
                              onClick={cancelEdit}
                              style={{ background: 'none', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 12px', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 13 }}
                            >✕</button>
                          </div>

                          {/* ── COHERENCE PANEL ── */}
                          {showCoherence && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                            >
                              {/* Warnings */}
                              {coherence.warnings.map((w, i) => (
                                <div key={i} style={{
                                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                                  borderRadius: 10, padding: '8px 12px',
                                  fontSize: 12, color: '#fbbf24', lineHeight: 1.5,
                                }}>{w}</div>
                              ))}

                              {/* Preview chips */}
                              {coherence.chips.length > 0 && (
                                <div style={{
                                  background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
                                  borderRadius: 10, padding: '10px 12px',
                                }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                    📊 Preview de impacto en tiempo real
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {coherence.chips.filter(c => c.value !== '').map((chip, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{chip.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: chip.color }}>{chip.value}</span>
                                      </div>
                                    ))}
                                    {coherence.chips.filter(c => c.value === '').map((chip, i) => (
                                      <div key={`note-${i}`} style={{ fontSize: 11, color: chip.color, fontStyle: 'italic' }}>{chip.label}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid var(--glass-border)',
              fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)',
            }}>
              🔒 Solo admin · Cambios en tiempo real vía Firestore · Expedientes con precio propio no se ven afectados por cambios de precio global
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
