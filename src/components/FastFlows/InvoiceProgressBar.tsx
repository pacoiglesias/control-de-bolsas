import { motion } from 'framer-motion';

interface InvoiceProgressBarProps {
  kilosOC: number;
  kilosDelivered: number;
  kilosInvoiced: number;
  kilosPending: number;
}

export function InvoiceProgressBar({
  kilosOC,
  kilosDelivered,
  kilosInvoiced,
  kilosPending,
}: InvoiceProgressBarProps) {
  const base = Math.max(kilosOC, kilosDelivered, 0.01);
  const pctDelivered = Math.min(100, Math.round((kilosDelivered / base) * 100));
  const pctInvoiced = Math.min(100, Math.round((kilosInvoiced / base) * 100));

  return (
    <div style={{ background: 'var(--paper-sunk)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line-soft)' }}>
      {/* Fila de totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 14 }}>
        <StatChip label="OC Pedida" value={`${kilosOC.toLocaleString('es-MX')} kg`} color="var(--ink-soft)" />
        <StatChip label="Entregado" value={`${kilosDelivered.toLocaleString('es-MX')} kg`} color="#2563eb" />
        <StatChip label="Ya Facturado" value={`${kilosInvoiced.toLocaleString('es-MX')} kg`} color="#7c3aed" />
        <StatChip
          label="⚡ Por Facturar"
          value={`${kilosPending.toLocaleString('es-MX')} kg`}
          color={kilosPending > 0.01 ? '#059669' : 'var(--ink-soft)'}
          highlight={kilosPending > 0.01}
        />
      </div>

      {/* Barra: Entregado vs OC */}
      <ProgressRow label="Entregado / OC" pct={pctDelivered} color="linear-gradient(90deg,#3b82f6,#2563eb)" />
      {/* Barra: Facturado vs OC */}
      <ProgressRow label="Facturado / OC" pct={pctInvoiced} color="linear-gradient(90deg,#7c3aed,#6d28d9)" />
    </div>
  );
}

function StatChip({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div
      style={{
        background: highlight ? 'rgba(5,150,105,0.07)' : 'var(--paper-raised)',
        border: highlight ? '1px solid rgba(5,150,105,0.3)' : '1px solid var(--line-soft)',
        borderRadius: 8,
        padding: '6px 10px',
      }}
    >
      <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13, color }}>{value}</div>
    </div>
  );
}

function ProgressRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-soft)', marginBottom: 3 }}>
        <span>{label}</span>
        <span className="mono" style={{ fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ width: '100%', height: 7, background: 'rgba(0,0,0,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', damping: 22, stiffness: 180 }}
          style={{ height: '100%', background: color, borderRadius: 999 }}
        />
      </div>
    </div>
  );
}
