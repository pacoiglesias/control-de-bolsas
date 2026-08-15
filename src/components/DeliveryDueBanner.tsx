import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrderSummary } from '../lib/finance';
import type { PurchaseOrder } from '../lib/types';

/**
 * Aviso de "la fecha de entrega prometida ya casi llega (o ya paso) y
 * todavia faltan kilos por entregar". Antes solo existia alerta para
 * facturas VENCIDAS (dinero) -- nada avisaba de una entrega logistica en
 * riesgo hasta que ya era demasiado tarde para reaccionar.
 *
 * Se calcula 100% del lado del cliente con los datos que Layout.tsx ya
 * trae via useOrders() -- no requiere una Cloud Function nueva.
 */
export function DeliveryDueBanner({ orders }: { orders: PurchaseOrder[] }) {
  const nav = useNavigate();
  const todayKey = new Date().toISOString().slice(0, 10);
  const [dismissedDay, setDismissedDay] = useState<string | null>(() => localStorage.getItem('cb-delivery-banner-dismissed'));

  const pendientes = useMemo(() => {
    const ahora = Date.now();
    return orders.filter((o) => {
      if (!o.estimatedDeliveryDate) return false;
      const s = getOrderSummary(o);
      if (s.status === 'collected') return false;
      const faltante = (o.totalKilograms || 0) - s.kilosDelivered;
      if (faltante <= 0.01) return false;
      const dias = (o.estimatedDeliveryDate.toDate().getTime() - ahora) / (1000 * 60 * 60 * 24);
      return dias <= 3;
    });
  }, [orders]);

  if (pendientes.length === 0 || dismissedDay === todayKey) return null;

  const dismiss = () => {
    localStorage.setItem('cb-delivery-banner-dismissed', todayKey);
    setDismissedDay(todayKey);
  };

  const yaVencidas = pendientes.filter((o) => (o.estimatedDeliveryDate!.toDate().getTime() - Date.now()) < 0).length;
  const folios = pendientes.slice(0, 5).map((o) => o.folio || (o as any).oc || '(sin folio)').join(', ')
    + (pendientes.length > 5 ? `, +${pendientes.length - 5} más` : '');

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: 'var(--warn-bg, #fffbeb)', border: '1px solid var(--warn)',
        color: 'var(--warn)', borderRadius: 'var(--radius)', padding: '10px 16px',
        margin: '0 0 16px 0', fontSize: 13, fontWeight: 600,
      }}
    >
      <span>
        🟠 {pendientes.length} pedido{pendientes.length === 1 ? '' : 's'} con entrega prometida
        {yaVencidas > 0 ? ` (${yaVencidas} ya vencida${yaVencidas === 1 ? '' : 's'})` : ' en 3 días o menos'}
        {' '}y kilos aún por entregar: {folios}.
      </span>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button
          className="btn"
          style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', padding: '4px 10px', fontSize: 12 }}
          onClick={() => nav('/oc')}
        >
          Ver Logística
        </button>
        <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={dismiss}>
          Ya lo vi
        </button>
      </div>
    </div>
  );
}
