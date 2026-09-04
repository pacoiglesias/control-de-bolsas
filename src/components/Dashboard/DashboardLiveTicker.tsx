import { money } from '../../lib/format';

/**
 * FIX (v8.9.8, split de pages/Dashboard.tsx — ~1460 lineas): franja de
 * pulso financiero en vivo (Caja / Por Cobrar / Saldo Andrés / Kilos)
 * extraida tal cual como componente presentacional puro, sin cambiar
 * logica ni estilos.
 */
export function DashboardLiveTicker({
  saldoCaja,
  porCobrar,
  deudaAndres,
  providerName,
  kilosTotal,
}: {
  saldoCaja: number;
  porCobrar: number;
  deudaAndres: number;
  providerName: string;
  kilosTotal: number;
}) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.88) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: '10px 18px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25)',
        color: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>💵</span>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Efectivo en Caja</div>
            <div className="tabular-nums money-val" style={{ fontSize: 14, fontWeight: 900, color: saldoCaja >= 0 ? '#4ade80' : '#f87171' }}>{money(saldoCaja)}</div>
          </div>
        </div>

        <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.12)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🏷️</span>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Por Cobrar (Providencia)</div>
            <div className="tabular-nums money-val" style={{ fontSize: 14, fontWeight: 900, color: '#38bdf8' }}>{money(porCobrar)}</div>
          </div>
        </div>

        <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.12)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>⚖️</span>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Saldo con {providerName || 'Andrés'}</div>
            <div className="tabular-nums money-val" style={{ fontSize: 14, fontWeight: 900, color: deudaAndres >= 0 ? '#34d399' : '#fbbf24' }}>
              {money(deudaAndres)}
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.12)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>📦</span>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Kilos en Proceso</div>
            <div className="tabular-nums kilo-val" style={{ fontSize: 14, fontWeight: 900, color: '#c084fc' }}>{kilosTotal.toLocaleString('es-MX')} kg</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 800,
            color: '#34d399',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          En Línea
        </span>
      </div>
    </div>
  );
}
