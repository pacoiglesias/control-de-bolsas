import { motion } from 'framer-motion';
import { kilos as fmtKilos, money } from '../../lib/format';

interface OrdersKpiRibbonProps {
  totalKilosPedidos: number;
  totalKilosEntregados: number;
  totalKilosSinFacturar: number;
  totalSinCrCount: number;
  totalCarteraDeuda: number;
  totalCobrado: number;
  onOpenFastInvoice: () => void;
  onOpenFastCr: () => void;
  onOpenFastDelivery: () => void;
}

export function OrdersKpiRibbon({
  totalKilosPedidos,
  totalKilosEntregados,
  totalKilosSinFacturar,
  totalSinCrCount,
  totalCarteraDeuda,
  totalCobrado,
  onOpenFastInvoice,
  onOpenFastCr,
  onOpenFastDelivery,
}: OrdersKpiRibbonProps) {
  const pctEntregado = totalKilosPedidos > 0 ? Math.round((totalKilosEntregados / totalKilosPedidos) * 100) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}
    >
      {/* 1. Kilos Pedidos & Avance */}
      <motion.div
        whileHover={{ y: -2 }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📦 Kilos en Expedientes
          </span>
          <span className="badge" style={{ background: '#2563eb', fontSize: 10 }}>
            {pctEntregado}% entregado
          </span>
        </div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
          {fmtKilos(totalKilosPedidos)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
          <span>Entregado: <b style={{ color: '#059669' }}>{fmtKilos(totalKilosEntregados)}</b></span>
          <button
            type="button"
            onClick={onOpenFastDelivery}
            style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', fontSize: 11 }}
          >
            + Entrega
          </button>
        </div>
      </motion.div>

      {/* 2. Kilos Listos de Báscula por Facturar */}
      <motion.div
        whileHover={{ y: -2 }}
        style={{
          background: totalKilosSinFacturar > 0.01 ? 'rgba(217, 119, 6, 0.05)' : 'var(--paper-raised)',
          border: totalKilosSinFacturar > 0.01 ? '1.5px solid rgba(217, 119, 6, 0.3)' : '1px solid var(--line)',
          borderRadius: 14,
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: totalKilosSinFacturar > 0.01 ? '#b45309' : 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🧾 Listo para Facturar
          </span>
          {totalKilosSinFacturar > 0.01 && (
            <span className="badge" style={{ background: '#d97706', fontSize: 10 }}>
              Acción Req.
            </span>
          )}
        </div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: totalKilosSinFacturar > 0.01 ? '#d97706' : 'var(--ink)' }}>
          {fmtKilos(totalKilosSinFacturar)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>En báscula sin CFDI</span>
          {totalKilosSinFacturar > 0.01 && (
            <button
              type="button"
              onClick={onOpenFastInvoice}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 10.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              ⚡ Facturar
            </button>
          )}
        </div>
      </motion.div>

      {/* 3. Facturas sin Contrarecibo */}
      <motion.div
        whileHover={{ y: -2 }}
        style={{
          background: totalSinCrCount > 0 ? 'rgba(124, 58, 237, 0.05)' : 'var(--paper-raised)',
          border: totalSinCrCount > 0 ? '1.5px solid rgba(124, 58, 237, 0.3)' : '1px solid var(--line)',
          borderRadius: 14,
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: totalSinCrCount > 0 ? '#6d28d9' : 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            📑 Facturas Sin CR
          </span>
          {totalSinCrCount > 0 && (
            <span className="badge" style={{ background: '#7c3aed', fontSize: 10 }}>
              {totalSinCrCount} {totalSinCrCount === 1 ? 'factura' : 'facturas'}
            </span>
          )}
        </div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: totalSinCrCount > 0 ? '#7c3aed' : 'var(--ink)' }}>
          {totalSinCrCount} {totalSinCrCount === 1 ? 'Pendiente' : 'Pendientes'}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Por ingresar a revisión</span>
          {totalSinCrCount > 0 && (
            <button
              type="button"
              onClick={onOpenFastCr}
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 10.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              + Asignar CR
            </button>
          )}
        </div>
      </motion.div>

      {/* 4. Cartera Total por Cobrar */}
      <motion.div
        whileHover={{ y: -2 }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            💰 Cuentas Por Cobrar
          </span>
          <span className="badge" style={{ background: '#059669', fontSize: 10 }}>
            c/IVA 16%
          </span>
        </div>
        <div className="mono" style={{ fontSize: 20, fontWeight: 900, color: totalCarteraDeuda > 0 ? '#dc2626' : '#059669' }}>
          {money(totalCarteraDeuda)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
          Cobrado acumulado: <strong style={{ color: '#059669' }}>{money(totalCobrado)}</strong>
        </div>
      </motion.div>
    </div>
  );
}
