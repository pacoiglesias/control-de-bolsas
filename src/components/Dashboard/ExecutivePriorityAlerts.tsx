import React from 'react';
import { motion } from 'framer-motion';
import { money, toDate } from '../../lib/format';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { useNavigate } from 'react-router-dom';

interface ExecutivePriorityAlertsProps {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenQuickInvoice: (orderId?: string | null) => void;
  onOpenQuickCollection: () => void;
}

const OFFICIAL_VALID_CRS = ['GT-874', 'TH-990', 'TH-946', 'TH-912', 'TH-879', 'GT-742', 'GT-713', 'GT-651'];

export const ExecutivePriorityAlerts: React.FC<ExecutivePriorityAlertsProps> = ({
  orders,
  config,
  onOpenQuickInvoice,
  onOpenQuickCollection,
}) => {
  const nav = useNavigate();
  const saleKg = config?.salePricePerKg || 43;
  const ivaRate = config?.ivaRate || 0.16;

  // 1. Detección Canónica de Nava (Textil Hogar · OC 120267114114)
  const navaOrder = (orders || []).find(o => {
    if (!o || (o as any).isDeleted) return false;
    const oc = (o.oc || o.folio || o.id || '').toUpperCase();
    return oc === '120267114114' || oc === 'OC-120267114114' || oc.includes('14114');
  });

  // 2. Detección Canónica de Evelia (Grupo Textil / P4 · OC 12026439713)
  const eveliaOrder = (orders || []).find(o => {
    if (!o || (o as any).isDeleted) return false;
    const oc = (o.oc || o.folio || o.id || '').toUpperCase();
    return oc === '12026439713' || oc === 'OC-12026439713' || oc.includes('9713');
  });

  // 3. Cartera de Contrarecibos Oficiales (Filtrado estricto de 8 CRs)
  const now = Date.now();
  let vencidasCount = 0;
  let vencidasMonto = 0;
  let porVencerCount = 0;
  let porVencerMonto = 0;
  let sinCrCount = 0;
  let sinCrMonto = 0;

  (orders || []).forEach(o => {
    if (!o || (o as any).isDeleted) return;
    const oCr = (o.collection?.contrareciboNumber || o.folio || o.oc || '').toUpperCase().trim();
    const isMasterOc = o.oc === '120267114114' || o.oc === '12026439713' || o.id === 'oc-120267114114' || o.id === 'oc-12026439713';
    const isOfficialCr = OFFICIAL_VALID_CRS.includes(oCr) || (o.invoices || []).some(i => OFFICIAL_VALID_CRS.includes((i.collection?.contrareciboNumber || '').toUpperCase().trim()));

    // Ignorar órdenes que no son ni Master OC ni CR oficial
    if (!isMasterOc && !isOfficialCr) return;

    (o.invoices || []).forEach(inv => {
      if (!inv) return;
      const st = inv.creditCycle?.status;
      const amt = inv.financials?.invoiceTotal ?? ((Number(inv.kilos) || 0) * saleKg * (1 + ivaRate));
      const isPaid = st === 'paid' || st === 'collected';
      const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim().toUpperCase();

      if (!isPaid && amt > 0) {
        if (!cr || !OFFICIAL_VALID_CRS.includes(cr)) {
          sinCrCount++;
          sinCrMonto += amt;
        } else {
          const due = toDate(inv.creditCycle?.dueDate);
          const dueTime = due ? due.getTime() : null;
          if (dueTime && dueTime < now) {
            vencidasCount++;
            vencidasMonto += amt;
          } else {
            porVencerCount++;
            porVencerMonto += amt;
          }
        }
      }
    });
  });

  const totalCarteraOficial = vencidasMonto + porVencerMonto;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {/* POD 1: TEXTIL HOGAR (NAVA) - 1,500 KG POR FACTURAR */}
        <motion.div
          whileHover={{ y: -2 }}
          className="pulse-aura-amber"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(180, 83, 9, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  textTransform: 'uppercase',
                }}
              >
                🏢 TH · Nava (Por Facturar)
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>
                OC: 120267114114
              </span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              1,500.00 kg en patio por facturar
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', marginTop: 4, lineHeight: 1.4 }}>
              Entregados en remisiones: <strong>6,411.01 kg</strong> | Facturados: <strong>4,911.01 kg</strong> (F-6198 y F-6266). Por facturar: <strong style={{ color: '#fbbf24' }}>1,500 kg ($74,820 con IVA)</strong>. Cero faltantes por surtir.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenQuickInvoice(navaOrder?.id || 'oc-120267114114')}
              style={{
                flex: 1,
                background: '#d97706',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
              }}
            >
              ⚡ Facturar 1,500 kg
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav(`/ordenes?abrir=${navaOrder?.id || 'oc-120267114114'}`)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📂 Ver OC
            </button>
          </div>
        </motion.div>

        {/* POD 2: GRUPO TEXTIL (EVELIA) - EXCESO 298 KG EN ESPERA DE OC */}
        <motion.div
          whileHover={{ y: -2 }}
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(29, 78, 216, 0.08) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.08)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#dbeafe',
                  color: '#1e40af',
                  border: '1px solid #bfdbfe',
                  textTransform: 'uppercase',
                }}
              >
                🏭 GT · Evelia (Exceso de Patio)
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6' }}>
                OC: 12026439713
              </span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              298.00 kg de exceso en espera de OC
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', marginTop: 4, lineHeight: 1.4 }}>
              OC 9713 facturada al 100% (2,674 kg). <strong>298 kg entregados de más en báscula</strong> quedan en resguardo en patio esperando la nueva OC oficial de Providencia para timbrarse.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenQuickInvoice(eveliaOrder?.id || 'oc-12026439713')}
              style={{
                flex: 1,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
              }}
            >
              ➕ Asignar Nueva OC
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav(`/ordenes?abrir=${eveliaOrder?.id || 'oc-12026439713'}`)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📂 Ver OC 9713
            </button>
          </div>
        </motion.div>

        {/* POD 3: FACTURAS EN ESPERA DE CONTRARECIBO EN PROVIDENCIA */}
        <motion.div
          whileHover={{ y: -2 }}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(109, 40, 217, 0.08) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.08)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: '#ede9fe',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  textTransform: 'uppercase',
                }}
              >
                📑 En Revisión / Remisión
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>
                Portal Providencia
              </span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              Facturas recientes para tramitar CR
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', marginTop: 4, lineHeight: 1.4 }}>
              Monitorea el ingreso al portal de proveedores (`apps.mundoprovidencia.com`) para capturar los folios <strong>`TH-`</strong> y <strong>`GT-`</strong> oficiales y activar el ciclo de crédito.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={onOpenQuickCollection}
              style={{
                flex: 1,
                background: '#7c3aed',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
              }}
            >
              📝 Asignar CR Rápido
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav('/cobranza')}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⚡ Sincronizar
            </button>
          </div>
        </motion.div>

        {/* POD 4: CARTERA OFICIAL DE 8 CONTRARECIBOS */}
        <motion.div
          whileHover={{ y: -2 }}
          style={{
            background: vencidasCount > 0
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(185, 28, 28, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)',
            border: `1px solid ${vencidasCount > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: vencidasCount > 0 ? '0 4px 14px rgba(239, 68, 68, 0.08)' : '0 4px 14px rgba(16, 185, 129, 0.08)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: vencidasCount > 0 ? '#fee2e2' : '#d1fae5',
                  color: vencidasCount > 0 ? '#991b1b' : '#065f46',
                  border: `1px solid ${vencidasCount > 0 ? '#fecaca' : '#a7f3d0'}`,
                  textTransform: 'uppercase',
                }}
              >
                {vencidasCount > 0 ? '🚨 Cobranza Urgente' : '🧾 Cartera Oficial'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: vencidasCount > 0 ? '#f87171' : '#34d399' }}>
                {vencidasCount > 0 ? `${vencidasCount} Vencidas (4 en Sep)` : '8 CRs al día'}
              </span>
            </div>

            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
              {vencidasCount > 0 
                ? `${money(vencidasMonto)} por cobrar vencido`
                : `${money(totalCarteraOficial)} en 8 Contrarecibos`}
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.75)', marginTop: 4, lineHeight: 1.4 }}>
              Cartera Total: <strong>{money(totalCarteraOficial)}</strong> (4 CRs por cobrar hoy: $366,299 | 4 CRs en Septiembre: $309,540).
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              onClick={onOpenQuickCollection}
              style={{
                flex: 1,
                background: vencidasCount > 0 ? '#dc2626' : '#059669',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: `0 2px 6px ${vencidasCount > 0 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(5, 150, 105, 0.3)'}`,
              }}
            >
              💰 Ir a Cobranza
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav('/cobranza')}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📊 Cartera
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
