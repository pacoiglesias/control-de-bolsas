import { useMemo } from 'react';
import { PurchaseOrder, Expense } from '../../lib/types';
import { money } from '../../lib/format';
import { motion } from 'framer-motion';

interface SociosProfitCardProps {
  orders: PurchaseOrder[];
  expenses: Expense[];
  costPricePerKg?: number;
  salePricePerKg?: number;
  onOpenRetiro?: () => void;
}

export function SociosProfitCard({
  orders,
  expenses,
  costPricePerKg = 42,
  salePricePerKg = 43,
  onOpenRetiro,
}: SociosProfitCardProps) {
  const stats = useMemo(() => {
    // Kilos entregados y facturados en total
    let totalKilos = 0;
    let totalVentaBruta = 0;
    let totalComisionContador = 0;

    for (const o of orders) {
      if (o.client === 'MIGRACION') continue;
      if (!o.invoices) continue;
      for (const inv of o.invoices) {
        if (inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected') {
          const kilos = inv.kilos || (inv.financials?.invoiceTotal ? inv.financials.invoiceTotal / (salePricePerKg * 1.16) : 0);
          const venta = inv.financials?.invoiceTotal || 0;
          const comision = inv.financials?.commission || (venta * 0.08);

          totalKilos += kilos;
          totalVentaBruta += venta;
          totalComisionContador += comision;
        }
      }
    }

    // Costo pagado a Andrés por esos kilos
    const totalCostoAndres = totalKilos * costPricePerKg;

    // Utilidad Neta Real
    const ingresoNetoCobrado = totalVentaBruta - totalComisionContador;
    const utilidadNeta = Math.max(0, ingresoNetoCobrado - totalCostoAndres);

    // Reparto a Socios
    const partePaco = utilidadNeta * 0.5;
    const parteSocio = utilidadNeta * 0.5;

    // Retiros ya realizados
    const retirosYaHechos = expenses.filter((e) => {
      if (e.type !== 'egreso') return false;
      const c = (e.concept || '').toLowerCase();
      return c.includes('socio') || c.includes('reparto') || c.includes('utilidad') || c.includes('paco') || c.includes('ganancia') || c.includes('retiro');
    }).reduce((a, e) => a + e.amount, 0);

    const restantePorRepartir = Math.max(0, utilidadNeta - retirosYaHechos);

    return {
      totalKilos,
      totalVentaBruta,
      totalCostoAndres,
      totalComisionContador,
      utilidadNeta,
      partePaco,
      parteSocio,
      retirosYaHechos,
      restantePorRepartir,
    };
  }, [orders, expenses, costPricePerKg, salePricePerKg]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(91, 33, 182, 0.15) 100%)',
        border: '1px solid rgba(124, 58, 237, 0.3)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-sm)',
        color: 'var(--ink)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🤝</span>
            <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>
              Utilidad Real y Reparto de Socios (50 / 50)
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
            Venta neta cobrada menos costo de Andrés ($42/kg) y 8% de comisión contable.
          </p>
        </div>

        {onOpenRetiro && (
          <button
            onClick={onOpenRetiro}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
            }}
          >
            <span>💸</span> Retirar Ganancia
          </button>
        )}
      </div>

      {/* Grid de 3 Columnas de Reparto */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 18 }}>
        {/* Total Ganancia Generada */}
        <div style={{ background: 'var(--paper-raised)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Utilidad Neta Total
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
            {money(stats.utilidadNeta)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
            Sobre {stats.totalKilos.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg cobrados
          </div>
        </div>

        {/* Parte Paco (50%) */}
        <div style={{ background: 'var(--paper-raised)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase' }}>
            Tu Parte Paco (50%)
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#7c3aed', marginTop: 4 }}>
            {money(stats.partePaco)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
            Disponible para retiro
          </div>
        </div>

        {/* Parte Socio (50%) */}
        <div style={{ background: 'var(--paper-raised)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
            Parte de tu Socio (50%)
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#2563eb', marginTop: 4 }}>
            {money(stats.parteSocio)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
            Disponible para retiro
          </div>
        </div>
      </div>

      {/* Barra de Retiros Hechos vs Restante */}
      {stats.retirosYaHechos > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-soft)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>Retiros registrados: <strong style={{ color: 'var(--ink)' }}>{money(stats.retirosYaHechos)}</strong></span>
          <span>Por retirar: <strong style={{ color: '#16a34a' }}>{money(stats.restantePorRepartir)}</strong></span>
        </div>
      )}
    </motion.div>
  );
}
