import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrderSummary, inferDepartment } from '../lib/finance';
import { toDate, kilos as fmtKilos } from '../lib/format';
import type { PurchaseOrder } from '../lib/types';
import { RegistrarEntregaModal } from './Compras/OrderModals';
import { useConfig } from '../hooks/useConfig';
import { DEFAULT_CONFIG } from '../lib/types';

/**
 * Aviso logístico detallado: pedidos activos con entregas en curso, mostrando
 * los kilos faltantes, departamento (TH/GT) y avance de cada Orden de Compra.
 */
export function DeliveryDueBanner({ orders }: { orders: PurchaseOrder[] }) {
  const nav = useNavigate();
  const { config } = useConfig();
  const currentCostPerKg = config?.costPricePerKg ?? DEFAULT_CONFIG.costPricePerKg;
  const todayKey = new Date().toISOString().slice(0, 10);
  const [dismissedDay, setDismissedDay] = useState<string | null>(() => localStorage.getItem('cb-delivery-banner-dismissed'));
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<PurchaseOrder | null>(null);

  const pendientes = useMemo(() => {
    const ahora = Date.now();
    return (orders || [])
      .filter((o) => {
        if (!o || !o.estimatedDeliveryDate) return false;
        const s = getOrderSummary(o);
        if (s.status === 'collected') return false;
        const total = Number(o.totalKilograms) || (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0) || 0;
        const faltante = total - s.kilosDelivered;
        if (faltante <= 0.01) return false;
        const ts = toDate(o.estimatedDeliveryDate)?.getTime();
        if (!ts) return false;
        const dias = (ts - ahora) / (1000 * 60 * 60 * 24);
        return dias <= 3;
      })
      .map((o) => {
        const s = getOrderSummary(o);
        const total = Number(o.totalKilograms) || (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0) || s.kilosDelivered;
        const entregados = s.kilosDelivered;
        const faltante = Math.max(0, total - entregados);
        const dept = inferDepartment(o) || (o.department?.toUpperCase().includes('TH') ? 'TH' : o.department?.toUpperCase().includes('GT') ? 'GT' : 'PROV');
        const pct = total > 0 ? Math.min(100, Math.round((entregados / total) * 100)) : 0;
        return {
          order: o,
          id: o.id,
          folio: o.folio || '(sin folio)',
          oc: o.oc || '',
          dept,
          responsable: dept === 'TH' ? 'Nava' : dept === 'GT' ? 'Evelia' : 'Providencia',
          total,
          entregados,
          faltante,
          pct,
        };
      });
  }, [orders]);

  if (pendientes.length === 0 || dismissedDay === todayKey) return null;

  const dismiss = () => {
    localStorage.setItem('cb-delivery-banner-dismissed', todayKey);
    setDismissedDay(todayKey);
  };

  const totalKilosFaltantes = pendientes.reduce((acc, p) => acc + p.faltante, 0);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        border: '1px solid #f59e0b',
        borderRadius: '12px',
        padding: '14px 18px',
        margin: '0 0 18px 0',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.12)',
      }}
    >
      {/* Cabecera del aviso */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📦</span>
          <div>
            <strong style={{ fontSize: 14, color: '#92400e' }}>
              {pendientes.length} pedido{pendientes.length === 1 ? '' : 's'} con entrega en curso
            </strong>
            <span style={{ fontSize: 13, color: '#b45309', marginLeft: 8, fontWeight: 600 }}>
              (Total pendiente: {fmtKilos(totalKilosFaltantes)})
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            style={{ background: '#d97706', color: '#fff', border: 'none', padding: '5px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6 }}
            onClick={() => nav('/oc')}
          >
            🚚 Ver Logística & Entregas
          </button>
          <button
            className="btn"
            style={{ background: 'transparent', color: '#78350f', border: '1px solid #d97706', padding: '5px 10px', fontSize: 12, borderRadius: 6 }}
            onClick={dismiss}
          >
            ✕ Ya lo vi
          </button>
        </div>
      </div>

      {/* Desglose por Orden de Compra y Departamento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        {pendientes.map((p) => (
          <div
            key={p.id}
            onClick={() => nav(`/ordenes?abrir=${p.id}`)}
            style={{
              background: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Fila superior: Departamento + Folio / OC */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: p.dept === 'TH' ? '#dbeafe' : p.dept === 'GT' ? '#ede9fe' : '#f3f4f6',
                    color: p.dept === 'TH' ? '#1d4ed8' : p.dept === 'GT' ? '#6d28d9' : '#374151',
                    border: `1px solid ${p.dept === 'TH' ? '#bfdbfe' : p.dept === 'GT' ? '#ddd6fe' : '#e5e7eb'}`,
                  }}
                >
                  {p.dept} · {p.responsable}
                </span>
                <strong style={{ fontSize: 13, color: '#1e293b', fontFamily: 'monospace' }}>
                  OC: {p.oc || p.folio}
                </strong>
              </div>
            </div>

            {/* Fila intermedia: Kilos faltantes vs entregados */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
              <span style={{ color: '#b45309', fontWeight: 700 }}>
                🚨 Faltan: {fmtKilos(p.faltante)}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>
                Entregados: {fmtKilos(p.entregados)} / {fmtKilos(p.total)}
              </span>
            </div>

            {/* Barra de progreso y botón rápido */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${p.pct}%`,
                    height: '100%',
                    background: p.pct >= 100 ? '#10b981' : p.pct > 0 ? '#f59e0b' : '#cbd5e1',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeliveryModalOrder(p.order);
                }}
              >
                + Entrega
              </button>
            </div>
          </div>
        ))}
      </div>

      {deliveryModalOrder && (
        <RegistrarEntregaModal
          order={deliveryModalOrder}
          onClose={() => setDeliveryModalOrder(null)}
          costPricePerKg={currentCostPerKg}
        />
      )}
    </div>
  );
}


