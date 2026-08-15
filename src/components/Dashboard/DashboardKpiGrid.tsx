import { motion } from 'framer-motion';
import { KpiCard, ResponsiveMoney } from '../ui';
import { kilos, money } from '../../lib/format';
interface DashboardKpiGridProps {
  k: any;
  role: string | null;
  saldoCaja: number;
  config: any;
  monthFilter: string;
  nav: (path: string) => void;
  contrarecibosVencidosCount?: number;
}

export function DashboardKpiGrid({ k, role, saldoCaja, config, monthFilter, nav, contrarecibosVencidosCount }: DashboardKpiGridProps) {
  return (
    <>
      <div className="kpi-section-title">⚙️ Operación y Universo</div>
      <div className="kpi-grid" style={{ marginBottom: 32 }}>
        <KpiCard hero tone="cash" label="📦 MATERIAL FLOTANTE (POR FACTURAR)" value={<span style={{ fontSize: 32 }}>{kilos(k.inventarioVivo)}</span>}
          sub="Kilos entregados por Andrés pendientes de ser facturados a Providencia" />
        {role !== 'viewer' && (
          <>
            <KpiCard tone={k.utilidadNeta > 0 ? 'ok' : 'bad'} label="Utilidad Neta (P&L)" value={<ResponsiveMoney value={k.utilidadNeta || 0} />}
              sub="Margen Cobrado - OPEX (Gastos de Caja Chica)" />
            <KpiCard tone={k.proyeccionFlujo >= 0 ? 'ok' : 'bad'} label="Proyección Flujo Efectivo" value={<ResponsiveMoney value={k.proyeccionFlujo || 0} />}
              sub="Caja Chica + Dinero en Tránsito + Deuda Proveedor" />
          </>
        )}
      </div>

      <div className="kpi-section-title">💰 Ventas y Ganancias</div>
      <div className="kpi-grid">
        <KpiCard hero label="TOTAL VENDIDO" value={<ResponsiveMoney value={k.ventasTotal} />}
          sub={
            <>
              {monthFilter === 'ALL' ? `${kilos(k.totalKilos)} procesados` : `Facturado este mes`}
              <br /><span style={{ opacity: 0.75 }}>{k.periodText}</span>
            </>
          } />
        {role !== 'viewer' && (
          <>
            <KpiCard tone="ok" label="Ganancia Comercial" value={<ResponsiveMoney value={k.margenTotal || 0} />}
              sub="Venta - Costo (Devengada)" />
            <KpiCard tone="ok" label="Ganancia por Cobros" value={<ResponsiveMoney value={k.gananciaRealizadaTotal || 0} />}
              sub="Flujo real (Cobrado)" />
          </>
        )}
      </div>

      <div className="kpi-section-title">📋 Cobranza</div>
      <div className="kpi-grid">
        <KpiCard tone={k.pedidoPendiente?.length > 0 ? 'warn' : 'ok'} label="📝 Pendiente de Facturar"
          value={<ResponsiveMoney value={k.montoPendienteFacturar || 0} />}
          sub={
            <>
              {k.pedidoPendiente?.length || 0} expediente(s) con kilos entregados sin facturar
              <br /><span style={{ opacity: 0.75 }}>Incluye IVA</span>
            </>
          }
          onClick={() => nav('/ordenes?filtro=pedido')} />
        {role !== 'viewer' ? (
          <motion.div 
            whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(16,185,129,0.3)' }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="card stat-card" 
            style={{ 
              padding: '24px', 
              gridColumn: 'span 2', 
              background: 'linear-gradient(135deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.95) 100%)', 
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: '#fff', 
              border: '1px solid rgba(16,185,129,0.2)', 
              borderRadius: '16px',
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                💎
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Flujo de Efectivo Providencia
              </div>
            </div>
            {(() => {
              const sinCr = k.porCobrarSinCR ?? 0;
              const conCr = k.porCobrarConCR ?? 0;
              const pend = k.montoPendienteFacturar ?? 0;
              const total = sinCr + conCr + pend;
              if (total <= 0) return null;
              return (
                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 20, background: 'rgba(255,255,255,0.06)' }}>
                  {sinCr > 0 && <div style={{ width: `${(sinCr / total) * 100}%`, background: '#f59e0b' }} title="Facturas en Revisión" />}
                  {conCr > 0 && <div style={{ width: `${(conCr / total) * 100}%`, background: '#10b981' }} title="Contrarecibos" />}
                  {pend > 0 && <div style={{ width: `${(pend / total) * 100}%`, background: '#38bdf8' }} title="Pendiente de Facturar" />}
                </div>
              );
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                  Facturas en Revisión (sin CR)
                </span>
                <strong style={{ fontSize: 15 }}>{money(k.porCobrarSinCR ?? 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Contrarecibos (con CR)
                </span>
                <strong style={{ fontSize: 15 }}>{money(k.porCobrarConCR ?? 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                  Pendiente de Facturar
                </span>
                <strong style={{ fontSize: 15 }}>{money(k.montoPendienteFacturar ?? 0)}</strong>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 17 }}>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Deuda Total Providencia</span>
                <strong style={{ color: '#f8fafc' }}>{money(k.deudaTotalProvidencia)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#f87171' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>(-) Comisión Contable ({(config.commissionRate * 100).toFixed(1).replace(/\.0$/, '')}%)</span>
                <strong style={{ fontSize: 15 }}>-{money(k.comisionContable)}</strong>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#10b981', fontSize: '1.4em', textShadow: '0 2px 10px rgba(16,185,129,0.3)' }}>
                <span style={{ fontWeight: 600 }}>Dinero Real a Recibir</span>
                <strong style={{ fontWeight: 900 }}>{money(k.dineroRealARecibir)}</strong>
              </div>
            </div>
            {(k.dineroRealARecibir || 0) > 0 && (
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => { e.stopPropagation(); nav('/caja-chica'); }}
                className="btn" 
                style={{ 
                  marginTop: 20, 
                  width: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  background: 'rgba(16,185,129,0.2)', 
                  borderColor: 'rgba(16,185,129,0.4)', 
                  color: '#10b981', 
                  fontWeight: 'bold',
                  boxShadow: 'none'
                }} 
              >
                📥 Recolectar a Caja Chica
              </motion.button>
            )}
          </motion.div>
        ) : (
          <KpiCard tone={k.porCobrar > 0 ? 'warn' : 'ok'} label="Te deben" value={<ResponsiveMoney value={k.porCobrar} />}
            sub={`${(k.pending?.length || 0) + (k.overdue?.length || 0)} órdenes abiertas`}
            onClick={() => nav('/cobranza')} />
        )}

        <KpiCard tone={k.overdue?.length ? 'bad' : undefined} label="Vencido" value={<ResponsiveMoney value={k.vencido} />}
          sub={`${contrarecibosVencidosCount ?? k.overdue?.length ?? 0} contrarecibo${(contrarecibosVencidosCount ?? k.overdue?.length) === 1 ? '' : 's'} pasado${(contrarecibosVencidosCount ?? k.overdue?.length) === 1 ? '' : 's'} de fecha`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone="cash" label="Cobrado" value={<ResponsiveMoney value={k.cobrado} />}
          sub={role !== 'viewer' ? `neto ${money(k.netoCobrado)}` : undefined} />
      </div>

      <div className="kpi-section-title">🏦 Caja y Operación</div>
      <div className="kpi-grid">
        {role === 'admin' && (
          <KpiCard tone={saldoCaja < 0 ? "bad" : "ok"} label="CAJA" value={<ResponsiveMoney value={saldoCaja} />}
            sub="flujo líquido" onClick={() => nav('/caja-chica')} />
        )}
        <KpiCard tone={k.review?.length ? 'warn' : undefined} label="Esperan captura manual"
          value={k.review?.length || 0} sub="XML no subido o inválido"
          onClick={() => nav('/ordenes?filtro=manual_review')} />
      </div>
    </>
  );
}
