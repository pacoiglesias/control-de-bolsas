import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { money } from '../../lib/format';
import { computeCommissionFromInvoiceTotal } from '../../lib/finance';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from '../../lib/types';

interface MoneyFlowPipelineProps {
  orders: PurchaseOrder[];
  purchases: Purchase[];
  expenses: Expense[];
  config: FinancialConfig;
  nav: (path: string) => void;
}

export function MoneyFlowPipeline({ orders, purchases, expenses, config, nav }: MoneyFlowPipelineProps) {
  const data = useMemo(() => {
    // 1. Andrés Fabricando (Kilos pendientes * $42)
    const costKg = config?.costPricePerKg || 42;
    const saleKg = config?.salePricePerKg || 43;
    const ivaRate = config?.ivaRate || 0.16;

    const kilosEnTaller = purchases.reduce((acc, p) => {
      const faltan = (p.expectedKilos || 0) - (p.receivedKilos || 0);
      return acc + Math.max(0, faltan);
    }, 0);
    const montoEnTaller = kilosEnTaller * costKg;

    // 2. Entregado en Providencia sin Facturar
    let kilosEntregadosSinFacturar = 0;
    let montoSinContrarecibo = 0;
    let montoConContador = 0;

    orders.forEach((o) => {
      if (o.isClosedShort) return;
      const deliveries = o.deliveries || [];
      const kilosEntregados = deliveries.reduce((a: number, d: any) => a + (d.kilos || 0), 0);
      const invoices = o.invoices || [];
      const kilosFacturados = invoices.reduce((a: number, i: any) => a + (i.kilos || 0), 0);

      if (kilosEntregados > kilosFacturados) {
        kilosEntregadosSinFacturar += (kilosEntregados - kilosFacturados);
      }

      invoices.forEach((inv) => {
        const totalFactura = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate));
        const cr = (inv.collection?.contrareciboNumber || '').trim();
        const st = inv.creditCycle?.status;

        if (!cr && (st === 'pending' || st === 'overdue' || (inv.folio && inv.folio.length > 0))) {
          montoSinContrarecibo += totalFactura;
        }

        if (st === 'paid') {
          const comision = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(totalFactura, config as any);
          montoConContador += (totalFactura - comision);
        }
      });
    });

    const montoEntregadoSinFactura = kilosEntregadosSinFacturar * saleKg * (1 + ivaRate);

    // 5. Saldo en Caja Efectivo
    const saldoCaja = expenses.reduce((acc, e) => {
      return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
    }, 0);

    return {
      montoEnTaller,
      montoEntregadoSinFactura,
      montoSinContrarecibo,
      montoConContador,
      saldoCaja,
    };
  }, [orders, purchases, expenses, config]);

  const stages = useMemo(() => [
    {
      step: '1',
      title: 'Andrés Fabricando',
      monto: data.montoEnTaller,
      icon: '🏭',
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.1)',
      border: '#8b5cf6',
      link: '/compras',
    },
    {
      step: '2',
      title: 'Entregado s/Factura',
      monto: data.montoEntregadoSinFactura,
      icon: '📦',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      border: '#f59e0b',
      link: '/ordenes',
    },
    {
      step: '3',
      title: 'En Espera de CR',
      monto: data.montoSinContrarecibo,
      icon: '⏳',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      border: '#ef4444',
      link: '/cobranza',
    },
    {
      step: '4',
      title: 'Con el Contador',
      monto: data.montoConContador,
      icon: '💼',
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,0.1)',
      border: '#0ea5e9',
      link: '/caja-chica',
    },
    {
      step: '5',
      title: 'En Caja Efectivo',
      monto: data.saldoCaja,
      icon: '💰',
      color: '#10b981',
      bg: 'rgba(16,185,129,0.15)',
      border: '#10b981',
      link: '/caja-chica',
    },
  ], [data]);

  return (
    <div
      role="region"
      aria-label="Pipeline del flujo del dinero en el negocio"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌊</span> Pipeline del Flujo del Dinero
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-soft)' }}>
            (Ciclo de capital desde taller hasta caja)
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'center' }}>
        {stages.map((st) => (
          <motion.div
            key={st.step}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => nav(st.link)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && nav(st.link)}
            aria-label={`Paso ${st.step}: ${st.title}, ${money(st.monto)}`}
            style={{
              background: st.bg,
              border: `1px solid ${st.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{st.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: st.color, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                PASO {st.step}
              </span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
              {st.title}
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: st.color, marginTop: 2, fontFamily: 'monospace' }}>
              {money(st.monto)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
