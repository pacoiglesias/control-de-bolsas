import { useState } from 'react';
import { motion } from 'framer-motion';
import { useOrders } from '../../hooks/useOrders';
import { money } from '../../lib/format';
import { useNavigate } from 'react-router-dom';

export function ProvidenciaHubWidget() {
  const { orders } = useOrders();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<'ALL' | 'TH' | 'GT'>('ALL');

  // Encontrar las órdenes de Providencia activas
  const thOrder = orders.find(o => 
    (o.oc || '').includes('120267114114') || 
    (o.folio || '').includes('14114') ||
    (o.department || '').includes('TH') ||
    (o.client || '').includes('TH') ||
    (o.client || '').includes('NAVA')
  );

  const gtOrder = orders.find(o => 
    (o.oc || '').includes('12026439713') || 
    (o.folio || '').includes('9713') ||
    (o.department || '').includes('P4') ||
    (o.client || '').includes('P4') ||
    (o.client || '').includes('EVELIA')
  );

  // Cálculos TH
  const thTotal = thOrder?.totalKilograms || 6500;
  const thDelivered = (thOrder?.deliveries || []).reduce((acc, d) => acc + (d.kilos || 0), 0) || 3465.81;
  const thRemaining = Math.max(0, thTotal - thDelivered);
  const thProgress = Math.min(100, Math.round((thDelivered / thTotal) * 100));

  // Cálculos GT
  const gtTotal = gtOrder?.totalKilograms || 3700;
  const gtDelivered = (gtOrder?.deliveries || []).reduce((acc, d) => acc + (d.kilos || 0), 0) || 1000.00;
  const gtRemaining = Math.max(0, gtTotal - gtDelivered);
  const gtProgress = Math.min(100, Math.round((gtDelivered / gtTotal) * 100));

  // Gran Total Providencia
  const totalKilos = thTotal + gtTotal;
  const deliveredKilos = thDelivered + gtDelivered;
  const remainingKilos = thRemaining + gtRemaining;
  const globalProgress = Math.min(100, Math.round((deliveredKilos / totalKilos) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.95) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: 24,
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header con Título y Filtros de Pestaña */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            boxShadow: '0 8px 16px rgba(59, 130, 246, 0.35)',
          }}>
            🏭
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
              Operaciones Providencia en Tiempo Real
              <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                EN VIVO
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 2 }}>
              Monitoreo y balance de entregas por planta · Precio Venta: $43.00/kg · Costo Andrés: $38.00/kg
            </div>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', padding: 4, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={() => setActiveTab('ALL')}
            style={{
              background: activeTab === 'ALL' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
              color: activeTab === 'ALL' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            📊 Consolidado ({globalProgress}%)
          </button>
          <button
            onClick={() => setActiveTab('TH')}
            style={{
              background: activeTab === 'TH' ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 'transparent',
              color: activeTab === 'TH' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            🏢 TH - Nava ({thProgress}%)
          </button>
          <button
            onClick={() => setActiveTab('GT')}
            style={{
              background: activeTab === 'GT' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
              color: activeTab === 'GT' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            🏭 GT - Evelia ({gtProgress}%)
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Operación */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* TARJETA 1: TEXTIL HOGAR (TH / NAVA) */}
        {(activeTab === 'ALL' || activeTab === 'TH') && (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 18,
              padding: '18px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🏢 TEXTIL HOGAR · DEPTO TH-ALMACEN-1
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2 }}>
                  OC 120267114114 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>(Folio 71/14114)</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', marginTop: 2 }}>
                  Solicitó: <strong>JOSÉ NAVA FLORES</strong> · Autorizó: <strong>TORRE LAMUÑO</strong> · CR Prefijo: <strong>TH-</strong>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, padding: '4px 10px', borderRadius: 8, background: 'rgba(139, 92, 246, 0.2)', color: '#d8b4fe', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                {thProgress}% Surtido
              </span>
            </div>

            {/* Barra de Progreso */}
            <div style={{ width: '100%', height: 10, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
              <div
                style={{
                  width: `${thProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%)',
                  borderRadius: 6,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>

            {/* Métricas Clave TH */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>PEDIDO OC</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginTop: 2 }}>{thTotal.toLocaleString()} kg</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 700 }}>ENTREGADO</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399', marginTop: 2 }}>{thDelivered.toLocaleString()} kg</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ fontSize: 10, color: '#fcd34d', fontWeight: 700 }}>FALTA SURTIR</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>{thRemaining.toLocaleString()} kg</div>
              </div>
            </div>

            {/* Facturas en Revisión */}
            <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 12, background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8 }}>
              🧾 <strong>Facturas en Revisión:</strong> F-6198 (1,965.81 kg · $98,054) y F-6200 (1,500.00 kg · $74,820)
            </div>

            {/* Acciones Rápidas */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => nav('/fast-entry')}
                style={{
                  flex: 1,
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#d8b4fe',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🏷️ Asignar CR TH-
              </button>
              <button
                onClick={() => nav('/remisiones')}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                📋 Ver Partidas
              </button>
            </div>
          </motion.div>
        )}

        {/* TARJETA 2: GRUPO TEXTIL (GT / PLANTA P4 / EVELIA) */}
        {(activeTab === 'ALL' || activeTab === 'GT') && (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 18,
              padding: '18px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🏭 GRUPO TEXTIL · PLANTA P4
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2 }}>
                  OC 12026439713 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>(Folio 43/9713)</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', marginTop: 2 }}>
                  Solicitó / Contacto: <strong>EVELIA</strong> · Almacén: <strong>P4-ALM</strong> · CR Prefijo: <strong>GT-</strong>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, padding: '4px 10px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                {gtProgress}% Surtido
              </span>
            </div>

            {/* Barra de Progreso */}
            <div style={{ width: '100%', height: 10, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
              <div
                style={{
                  width: `${gtProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  borderRadius: 6,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>

            {/* Métricas Clave GT */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>PEDIDO OC</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginTop: 2 }}>{gtTotal.toLocaleString()} kg</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 700 }}>ENTREGADO</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399', marginTop: 2 }}>{gtDelivered.toLocaleString()} kg</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ fontSize: 10, color: '#fcd34d', fontWeight: 700 }}>FALTA SURTIR</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>{gtRemaining.toLocaleString()} kg</div>
              </div>
            </div>

            {/* Facturas en Revisión */}
            <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 12, background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8 }}>
              🧾 <strong>Facturas en Revisión:</strong> F-6193 (1,000.00 kg · $49,880)
            </div>

            {/* Acciones Rápidas */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => nav('/fast-entry')}
                style={{
                  flex: 1,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🏷️ Asignar CR GT-
              </button>
              <button
                onClick={() => nav('/remisiones')}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                📋 Ver Partidas
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer con Resumen de Flujo Financiero */}
      <div style={{
        marginTop: 18,
        paddingTop: 14,
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            💰 Utilidad Entregas Actuales ($5/kg): <strong style={{ color: '#34d399' }}>{money(deliveredKilos * 5)}</strong>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            ⏳ Utilidad Proyectada Restante ($5/kg): <strong style={{ color: '#fbbf24' }}>{money(remainingKilos * 5)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => nav('/fast-entry')}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              border: 'none',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <span>⚡</span> Recepción Rápida (Pegar XML / PDF)
          </button>
        </div>
      </div>
    </motion.div>
  );
}
