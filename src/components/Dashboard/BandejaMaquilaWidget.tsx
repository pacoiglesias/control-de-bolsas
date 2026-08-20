import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMaquilaDeliveries } from '../../hooks/useMaquilaDeliveries';
import { useSystemSettings } from '../../hooks/useSystemSettings';

export function BandejaMaquilaWidget() {
  const { deliveries, loading } = useMaquilaDeliveries();
  const { settings } = useSystemSettings();
  const nav = useNavigate();
  const provName = settings.providerName || 'Andrés';

  if (loading || deliveries.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: 'var(--brand-light)', border: '1px solid var(--brand)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, boxShadow: 'var(--shadow-hover)' }}
    >
      <div style={{ fontSize: 32 }}>📥</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--brand-dark)' }}>Bandeja de Recepción (Entregas en Báscula)</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--brand)' }}>
          {provName} ha reportado <strong>{deliveries.length}</strong> entrega(s) pendiente(s) de revisión.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {deliveries.slice(0, 3).map((d: any) => (
          <button key={d.id} className="btn" onClick={() => {
            if (d.orderId) nav(`/oc/${d.orderId}`);
            else nav(`/ordenes`);
          }} style={{ background: 'white', color: 'var(--brand-dark)', fontSize: 12, padding: '6px 12px', border: '1px solid var(--brand)' }}>
            Ver {d.folio || 'OC'} ({d.kilos}kg)
          </button>
        ))}
        {deliveries.length > 3 && <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--brand-dark)', fontWeight: 600 }}>+{deliveries.length - 3} más</span>}
      </div>
    </motion.div>
  );
}
