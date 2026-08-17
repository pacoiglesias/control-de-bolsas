import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { kilos as fmtKilos } from '../../lib/format';
import { extractCr, round2 } from '../../lib/finance';
import { ResponsiveMoney } from '../ui';
import type { PurchaseOrder, Expense, FinancialConfig } from '../../lib/types';

export type PipelineStageKey = '1_taller' | '2_almacen' | '3_sin_cr' | '4_con_cr' | '5_caja';

interface MoneyFlowPipelineProps {
  orders: PurchaseOrder[];
  expenses: Expense[];
  config: FinancialConfig;
  nav: (path: string) => void;
  selectedStage?: PipelineStageKey | null;
  onSelectStage?: (stage: PipelineStageKey | null) => void;
}

export function MoneyFlowPipeline({
  orders,
  expenses,
  config,
  selectedStage,
  onSelectStage,
}: MoneyFlowPipelineProps) {
  const data = useMemo(() => {
    const costKg = config?.costPricePerKg || 42;
    const saleKg = config?.salePricePerKg || 43;
    const ivaRate = config?.ivaRate || 0.16;

    let kilosFabricando = 0;
    let countFabricando = 0;

    let kilosEntregadosSinFacturar = 0;
    let countAlmacen = 0;

    let montoSinContrarecibo = 0;
    let countSinCr = 0;

    let montoEnCreditoCR = 0;
    let countConCr = 0;

    orders.forEach((o) => {
      if (o.client === 'MIGRACION') return;
      if (o.creditCycle?.status === 'collected') return;

      const totalKilos = Number(o.totalKilograms) || (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0) || 0;
      const deliveries = o.deliveries || [];
      const kilosEntregados = deliveries.reduce((a: number, d: any) => a + (Number(d.kilos) || 0), 0);
      const invoices = o.invoices || [];
      const kilosFacturados = invoices.reduce((a: number, i: any) => a + (Number(i.kilos) || 0), 0);

      // 1. Kilos que Andrés está fabricando
      if (!o.isClosedShort && totalKilos > kilosEntregados) {
        kilosFabricando += (totalKilos - kilosEntregados);
        countFabricando++;
      }

      // 2. Kilos entregados en báscula listos para facturar
      if (kilosEntregados > kilosFacturados) {
        kilosEntregadosSinFacturar += (kilosEntregados - kilosFacturados);
        countAlmacen++;
      }

      // 3 y 4. Facturas emitidas (Sin CR vs Con CR)
      invoices.forEach((inv) => {
        const totalFactura = inv.financials?.invoiceTotal ?? round2((Number(inv.kilos) || 0) * saleKg * (1 + ivaRate));
        const paidAmt = Number(inv.collection?.paidAmount) || 0;
        const saldoFactura = Math.max(0, totalFactura - paidAmt);
        const cr = extractCr(inv, o);
        const st = inv.creditCycle?.status;

        if (saldoFactura <= 0 || st === 'collected') return;

        if (!cr) {
          if (st === 'facturado' || st === 'manual_review' || st === 'pending' || (inv.folio && inv.folio.trim().length > 0)) {
            montoSinContrarecibo += saldoFactura;
            countSinCr++;
          }
        } else {
          if (st === 'pending' || st === 'overdue' || st === 'facturado') {
            montoEnCreditoCR += saldoFactura;
            countConCr++;
          }
        }
      });
    });

    const montoFabricandoAndres = round2(kilosFabricando * costKg);
    const montoAlmacenPorFacturar = round2(kilosEntregadosSinFacturar * saleKg * (1 + ivaRate));

    // 5. Saldo en Caja Chica Líquido
    const saldoCaja = round2(expenses.reduce((acc, e) => {
      return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
    }, 0));

    return {
      kilosFabricando,
      montoFabricandoAndres,
      countFabricando,

      kilosEntregadosSinFacturar,
      montoAlmacenPorFacturar,
      countAlmacen,

      montoSinContrarecibo: round2(montoSinContrarecibo),
      countSinCr,

      montoEnCreditoCR: round2(montoEnCreditoCR),
      countConCr,

      saldoCaja,
    };
  }, [orders, expenses, config]);

  const stages = useMemo(() => [
    {
      key: '1_taller' as PipelineStageKey,
      step: '1',
      title: '1. Pedido a Andrés',
      sub: `${fmtKilos(data.kilosFabricando)} kg en fabricación`,
      countLabel: `${data.countFabricando} orden${data.countFabricando !== 1 ? 'es' : ''}`,
      monto: data.montoFabricandoAndres,
      icon: '🏭',
      color: '#8b5cf6',
      bg: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(124,58,237,0.14) 100%)',
      border: '#8b5cf6',
    },
    {
      key: '2_almacen' as PipelineStageKey,
      step: '2',
      title: '2. Almacén Providencia',
      sub: `${fmtKilos(data.kilosEntregadosSinFacturar)} kg por facturar`,
      countLabel: `${data.countAlmacen} remisió${data.countAlmacen !== 1 ? 'nes' : 'n'}`,
      monto: data.montoAlmacenPorFacturar,
      icon: '🚚',
      color: '#f59e0b',
      bg: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(217,119,6,0.14) 100%)',
      border: '#f59e0b',
    },
    {
      key: '3_sin_cr' as PipelineStageKey,
      step: '3',
      title: '3. Facturado (Sin CR)',
      sub: 'En revisión de pago',
      countLabel: `${data.countSinCr} factura${data.countSinCr !== 1 ? 's' : ''}`,
      monto: data.montoSinContrarecibo,
      icon: '🧾',
      color: '#ef4444',
      bg: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.14) 100%)',
      border: '#ef4444',
    },
    {
      key: '4_con_cr' as PipelineStageKey,
      step: '4',
      title: '4. Con Contrarecibo',
      sub: 'Crédito Providencia',
      countLabel: `${data.countConCr} cuenta${data.countConCr !== 1 ? 's' : ''}`,
      monto: data.montoEnCreditoCR,
      icon: '🗂️',
      color: '#0ea5e9',
      bg: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(2,132,199,0.14) 100%)',
      border: '#0ea5e9',
    },
    {
      key: '5_caja' as PipelineStageKey,
      step: '5',
      title: '5. En Caja Chica',
      sub: 'Efectivo disponible',
      countLabel: 'Líquido en mano',
      monto: data.saldoCaja,
      icon: '💵',
      color: '#10b981',
      bg: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.2) 100%)',
      border: '#10b981',
    },
  ], [data]);

  const handleStageClick = (key: PipelineStageKey) => {
    if (!onSelectStage) return;
    if (selectedStage === key) {
      onSelectStage(null); // Quitar filtro
    } else {
      onSelectStage(key);
    }
  };

  return (
    <div
      role="region"
      aria-label="Pipeline Operativo de la Orden de Compra"
      style={{
        background: 'var(--paper-raised, #ffffff)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '18px 22px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-sm, 0 4px 16px rgba(0,0,0,0.04))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🌊</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Pipeline Operativo de las Órdenes de Compra (OC)
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
              Toca cualquier estación para filtrar al instante la tabla de órdenes inferior.
            </p>
          </div>
        </div>

        {selectedStage && (
          <button
            type="button"
            className="btn"
            style={{ fontSize: 11.5, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', color: '#b91c1c', borderColor: '#ef4444', fontWeight: 700 }}
            onClick={() => onSelectStage?.(null)}
          >
            ✕ Quitar Filtro de Estación
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'stretch' }}>
        {stages.map((st) => {
          const isSelected = selectedStage === st.key;
          return (
            <motion.div
              key={st.step}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleStageClick(st.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleStageClick(st.key)}
              style={{
                background: st.bg,
                border: isSelected ? `2px solid ${st.border}` : `1px solid ${st.border}44`,
                borderRadius: 14,
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                boxShadow: isSelected ? `0 0 0 3px ${st.border}33, 0 8px 20px -4px ${st.border}44` : '0 2px 8px rgba(0,0,0,0.03)',
                transform: isSelected ? 'scale(1.02)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{st.icon}</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        color: st.color,
                        background: 'rgba(255,255,255,0.25)',
                        padding: '2px 8px',
                        borderRadius: 999,
                        letterSpacing: '0.05em',
                      }}
                    >
                      PASO {st.step}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: 12, color: st.color }}>✓</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase' }}>
                  {st.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {st.sub}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: st.color, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
                  <ResponsiveMoney value={st.monto} />
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: st.color, marginTop: 2, opacity: 0.9 }}>
                  {st.countLabel}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
