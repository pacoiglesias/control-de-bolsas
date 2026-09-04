import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { money, toDate } from '../../lib/format';
import { normalizarTexto } from '../../lib/finance';
import type { Expense, Purchase, FinancialConfig } from '../../lib/types';

interface ConciliacionModalProps {
  open: boolean;
  onClose: () => void;
  expenses: Expense[];
  purchases: Purchase[];
  config: FinancialConfig;
  saldoCaja: number;
  saldoAndres: number;
  totalPagadoAndres: number;
  totalPurchasesCost: number;
  porCobrar: number;
  gananciaTotal: number;
}

interface AccountLine {
  date: Date | null;
  concept: string;
  type: 'debit' | 'credit' | 'neutral';
  amount: number;
  balance: number;
  source: 'expense' | 'purchase';
  sourceId: string;
  icon: string;
}

export function ConciliacionTotalModal({
  open,
  onClose,
  expenses,
  purchases,
  config,
  saldoCaja,
  saldoAndres,
  totalPagadoAndres,
  totalPurchasesCost,
  porCobrar,
  gananciaTotal,
}: ConciliacionModalProps) {
  const [tab, setTab] = useState<'resumen' | 'andres' | 'caja'>('resumen');

  // Compute Andrés account movements sorted by date
  const andresLines = useMemo<AccountLine[]>(() => {
    const lines: AccountLine[] = [];
    let runningBalance = 0;

    // Pagos a Andrés desde expenses
    for (const e of expenses) {
      const esAndres = e.isAndresPayment === true || normalizarTexto(e.provider) === 'andres';
      if (!esAndres) continue;
      const amt = Number(e.amount) || 0;
      if (e.type === 'egreso') {
        // Pagamos a Andrés → reducimos lo que le debemos → crédito para nosotros
        runningBalance += amt;
        lines.push({
          date: toDate(e.date),
          concept: e.concept || 'Pago a Andrés',
          type: 'credit',
          amount: amt,
          balance: runningBalance,
          source: 'expense',
          sourceId: e.id,
          icon: '💸',
        });
      } else {
        // Andrés nos devuelve → aumenta lo que le debemos
        runningBalance -= amt;
        lines.push({
          date: toDate(e.date),
          concept: e.concept || 'Devolución de Andrés',
          type: 'debit',
          amount: amt,
          balance: runningBalance,
          source: 'expense',
          sourceId: e.id,
          icon: '↩️',
        });
      }
    }

    // Compras recibidas de Andrés
    for (const p of purchases) {
      if (normalizarTexto(p.provider) !== 'andres') continue;
      const kilos = Number(p.receivedKilos) || 0;
      const price = p.pricePerKg || config.costPricePerKg;
      const cost = kilos * price;
      runningBalance -= cost;
      lines.push({
        date: toDate(p.date),
        concept: `Entrega ${kilos.toLocaleString('es-MX')} kg × ${money(price)}/kg`,
        type: 'debit',
        amount: cost,
        balance: runningBalance,
        source: 'purchase',
        sourceId: p.id,
        icon: '📦',
      });
    }

    return lines.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
  }, [expenses, purchases, config.costPricePerKg]);

  const historicalAdjustment = config.historicalDebtAndres ?? 0;
  const computedWithoutHistory = totalPagadoAndres - totalPurchasesCost;

  const commRate = config.commissionRate || 0;
  const commPct = (commRate * 100).toFixed(2);

  // Coherence checks
  const checks = [
    {
      id: 'commission',
      label: `Comisión contador: ${commPct}%`,
      ok: commRate <= 0.05,
      warn: commRate > 0.05 && commRate <= 0.10,
      bad: commRate > 0.10,
      note: commRate > 0.05
        ? `⚠️ ${commPct}% es inusual. El estándar es 1–3%. Verifica en ⚡ Edición Rápida.`
        : `✅ Tasa normal.`,
    },
    {
      id: 'margin',
      label: `Margen bruto: ${money(config.salePricePerKg - config.costPricePerKg)}/kg`,
      ok: config.salePricePerKg > config.costPricePerKg,
      warn: false,
      bad: config.salePricePerKg <= config.costPricePerKg,
      note: config.salePricePerKg > config.costPricePerKg
        ? `✅ Precio (${money(config.salePricePerKg)}) > Costo (${money(config.costPricePerKg)}).`
        : `🔴 PÉRDIDA: precio de venta menor o igual al costo.`,
    },
    {
      id: 'historicalPatch',
      label: 'Ajuste histórico Andrés',
      ok: historicalAdjustment === 0,
      warn: Math.abs(historicalAdjustment) > 0 && Math.abs(historicalAdjustment) < 500_000,
      bad: Math.abs(historicalAdjustment) >= 500_000,
      note: historicalAdjustment === 0
        ? `✅ Sin ajuste histórico — saldo 100% respaldado por transacciones.`
        : `⚠️ Ajuste opaco de ${money(historicalAdjustment)} activo. Verificar con estado de cuenta real de Andrés.`,
    },
    {
      id: 'cajaFisica',
      label: `Saldo caja sistema: ${money(saldoCaja)}`,
      ok: true,
      warn: false,
      bad: false,
      note: `💡 Compara con el efectivo físico disponible para verificar cuadre.`,
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 1010 }}
          />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              height: 'min(90vh, 800px)',
              background: 'var(--bg-elevated, #0f172a)',
              borderRadius: '24px 24px 0 0',
              borderTop: '1px solid var(--glass-border)',
              zIndex: 1011, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(99,102,241,0.08) 100%)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(135deg, #10b981, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
              }}>🔍</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>Conciliación Total del Sistema</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                  Vista unificada · Trazabilidad completa · Alertas de coherencia
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-soft)' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', borderBottom: '1px solid var(--glass-border)' }}>
              {(['resumen', 'andres', 'caja'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '8px 16px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 13,
                    background: tab === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: tab === t ? '#818cf8' : 'var(--ink-soft)',
                    borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                  }}
                >
                  {t === 'resumen' ? '📊 Resumen' : t === 'andres' ? '⚖️ Andrés' : '💵 Caja'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

              {/* ── RESUMEN ── */}
              {tab === 'resumen' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Main numbers grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'Precio de Venta', value: money(config.salePricePerKg) + '/kg', color: '#10b981', icon: '💰' },
                      { label: 'Costo de Compra', value: money(config.costPricePerKg) + '/kg', color: '#6366f1', icon: '🏭' },
                      { label: 'Margen/kg', value: money(config.salePricePerKg - config.costPricePerKg), color: config.salePricePerKg > config.costPricePerKg ? '#10b981' : '#ef4444', icon: '📈' },
                      { label: 'Comisión Contador', value: (config.commissionRate * 100).toFixed(2) + '%', color: commRate > 0.05 ? '#f59e0b' : '#10b981', icon: '🧾' },
                      { label: 'Por Cobrar', value: money(porCobrar), color: '#f59e0b', icon: '🏦' },
                      { label: 'Saldo Caja', value: money(saldoCaja), color: saldoCaja >= 0 ? '#10b981' : '#ef4444', icon: '💵' },
                      { label: 'Saldo con Andrés', value: money(saldoAndres), color: saldoAndres >= 0 ? '#8b5cf6' : '#f59e0b', icon: '⚖️' },
                      { label: 'Utilidad Realizada', value: money(gananciaTotal), color: gananciaTotal >= 0 ? '#10b981' : '#ef4444', icon: '✅' },
                    ].map(item => (
                      <div key={item.label} style={{
                        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                        borderRadius: 14, padding: '14px 16px',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                          {item.icon} {item.label}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Coherence checks */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      🔎 Verificación de Coherencia
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {checks.map(c => (
                        <div key={c.id} style={{
                          background: c.bad ? 'rgba(239,68,68,0.08)' : c.warn ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${c.bad ? 'rgba(239,68,68,0.3)' : c.warn ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                          borderRadius: 10, padding: '10px 14px',
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: c.bad ? '#ef4444' : c.warn ? '#f59e0b' : '#10b981' }}>{c.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{c.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Andrés breakdown */}
                  <div style={{
                    background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)',
                    borderRadius: 14, padding: 16,
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#a78bfa', marginBottom: 12 }}>⚖️ Desglose Saldo con Andrés</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        ['Total pagado a Andrés (expenses)', money(totalPagadoAndres), '#10b981'],
                        ['Costo de entregas recibidas (purchases)', `- ${money(totalPurchasesCost)}`, '#6366f1'],
                        ['Neto calculado (sin ajuste)', money(computedWithoutHistory), computedWithoutHistory >= 0 ? '#94a3b8' : '#ef4444'],
                        ['+ Ajuste histórico (historicalDebtAndres)', money(historicalAdjustment), '#a78bfa'],
                        ['= SALDO FINAL CON ANDRÉS', money(saldoAndres), saldoAndres >= 0 ? '#10b981' : '#f59e0b'],
                      ].map(([label, value, color], i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderTop: i === 4 ? '1px solid rgba(139,92,246,0.3)' : 'none',
                          paddingTop: i === 4 ? 8 : 0,
                        }}>
                          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{label}</span>
                          <span style={{ fontSize: 14, fontWeight: i === 4 ? 900 : 700, color: color as string }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {Math.abs(historicalAdjustment) > 0 && (
                      <div style={{ marginTop: 12, fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderRadius: 8, padding: '8px 12px' }}>
                        ⚠️ El ajuste de {money(historicalAdjustment)} es un parche contable. Para cuadrarlo definitivamente, pide a Andrés su estado de cuenta y actualiza en ⚡ Edición Rápida.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── ESTADO DE CUENTA ANDRÉS ── */}
              {tab === 'andres' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                      {andresLines.length} movimientos detectados
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: saldoAndres >= 0 ? '#10b981' : '#f59e0b' }}>
                      Saldo: {money(saldoAndres)}
                    </div>
                  </div>

                  {andresLines.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)', fontSize: 14 }}>
                      No se encontraron movimientos con Andrés.<br />
                      <small>Revisa que los registros tengan provider="andres" o isAndresPayment=true</small>
                    </div>
                  ) : (
                    andresLines.map((line, i) => (
                      <div key={`${line.sourceId}-${i}`} style={{
                        background: line.type === 'credit' ? 'rgba(16,185,129,0.07)' : 'rgba(99,102,241,0.07)',
                        border: `1px solid ${line.type === 'credit' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`,
                        borderRadius: 10, padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <span style={{ fontSize: 18 }}>{line.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{line.concept}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                            {line.date ? line.date.toLocaleDateString('es-MX') : 'Sin fecha'} · {line.source === 'expense' ? 'Caja' : 'Compra'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: line.type === 'credit' ? '#10b981' : '#6366f1' }}>
                            {line.type === 'credit' ? '+' : '-'}{money(line.amount)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Saldo: {money(line.balance)}</div>
                        </div>
                      </div>
                    ))
                  )}

                  {Math.abs(historicalAdjustment) > 0 && (
                    <div style={{
                      background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: 10, padding: '12px 14px', marginTop: 8,
                    }}>
                      <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: 13 }}>⚖️ Ajuste Histórico (fuera del estado de cuenta)</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                        Se suma un ajuste de <strong style={{ color: '#a78bfa' }}>{money(historicalAdjustment)}</strong> que no está respaldado por transacciones registradas. El saldo final incluye este valor.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── CAJA ── */}
              {tab === 'caja' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{expenses.length} movimientos en caja</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: saldoCaja >= 0 ? '#10b981' : '#ef4444' }}>
                      Saldo: {money(saldoCaja)}
                    </div>
                  </div>
                  {expenses.slice().sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0)).map((e, i) => (
                    <div key={e.id || i} style={{
                      background: e.type === 'ingreso' ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                      border: `1px solid ${e.type === 'ingreso' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      borderRadius: 10, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <span style={{ fontSize: 16 }}>{e.type === 'ingreso' ? '⬆️' : '⬇️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{e.concept || '(sin concepto)'}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                          {toDate(e.date) ? toDate(e.date)!.toLocaleDateString('es-MX') : 'Sin fecha'}
                          {e.provider ? ` · ${e.provider}` : ''}
                          {e.isAndresPayment ? ' · ⚖️ Andrés' : ''}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: e.type === 'ingreso' ? '#10b981' : '#ef4444' }}>
                        {e.type === 'ingreso' ? '+' : '-'}{money(Number(e.amount) || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
