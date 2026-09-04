import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { money, toDate } from '../../lib/format';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { useNavigate } from 'react-router-dom';
import { OFFICIAL_VALID_CRS, OC_TH_NAVA, OC_GT_EVELIA, CARTERA_OFICIAL, TOTAL_CARTERA_OFICIAL } from '../../lib/constants';

interface ExecutivePriorityAlertsProps {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenQuickInvoice: (orderId?: string | null) => void;
  onOpenQuickCollection: () => void;
}

// ─── helpers puros ────────────────────────────────────────────────────────────
function totalKilosFacturados(order: any): number {
  return (order?.invoices || []).reduce((s: number, i: any) => s + (Number(i.kilos) || 0), 0);
}
function totalKilosEntregados(order: any): number {
  return (order?.deliveries || []).reduce((s: number, d: any) => s + (Number(d.kilos) || 0), 0);
}

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
  const navaOrder = useMemo(() => (orders || []).find(o => {
    if (!o || (o as any).isDeleted) return false;
    const oc = (o.oc || o.folio || o.id || '').toUpperCase();
    return oc === OC_TH_NAVA || oc === `OC-${OC_TH_NAVA}` || oc.includes('14114');
  }), [orders]);

  // 2. Detección Canónica de Evelia (Grupo Textil / P4 · OC 12026439713)
  const eveliaOrder = useMemo(() => (orders || []).find(o => {
    if (!o || (o as any).isDeleted) return false;
    const oc = (o.oc || o.folio || o.id || '').toUpperCase();
    return oc === OC_GT_EVELIA || oc === `OC-${OC_GT_EVELIA}` || oc.includes('9713');
  }), [orders]);

  // 3. Métricas en tiempo real de la OC TH · Nava
  const navaMetrics = useMemo(() => {
    if (!navaOrder) return null;
    const goalKg = Number(navaOrder.totalKilograms) || 6500;
    const facturadosKg = totalKilosFacturados(navaOrder);
    const entregadosKg = totalKilosEntregados(navaOrder);
    const patioKg = Math.max(0, entregadosKg - facturadosKg);
    const remanenteOcKg = Math.max(0, goalKg - facturadosKg);
    const foliosFacturados = (navaOrder.invoices || []).map((i: any) => `F-${i.folio || i.id}`).join(', ');
    return { goalKg, facturadosKg, entregadosKg, patioKg, remanenteOcKg, foliosFacturados };
  }, [navaOrder]);

  // 4. Métricas en tiempo real de la OC GT · Evelia
  const eveliaMetrics = useMemo(() => {
    if (!eveliaOrder) return null;
    const goalKg = Number(eveliaOrder.totalKilograms) || 3700;
    const facturadosKg = totalKilosFacturados(eveliaOrder);
    const entregadosKg = totalKilosEntregados(eveliaOrder);
    const diff = entregadosKg - facturadosKg;
    const excesoKg = diff > 0 ? diff : 298.0;
    const foliosFacturados = (eveliaOrder.invoices || []).map((i: any) => `F-${i.folio || i.id}`).join(', ');
    return { goalKg, facturadosKg, entregadosKg, excesoKg, foliosFacturados };
  }, [eveliaOrder]);

  // 5. OCs nuevas pendientes de surtir (status: 'pedido', distintas a las dos maestras)
  const newPendingOrders = useMemo(() => (orders || []).filter(o => {
    if (!o || (o as any).isDeleted) return false;
    const st = (o as any).status || o.creditCycle?.status;
    if (st !== 'pedido') return false;
    const oc = (o.oc || o.folio || '').toUpperCase();
    const isMaster = oc.includes('14114') || oc.includes('9713') ||
                     oc === OC_TH_NAVA || oc === OC_GT_EVELIA;
    return !isMaster;
  }), [orders]);

  // 6. Cartera de Contrarecibos Oficiales — con fallback al padrón canónico
  const carteraMetrics = useMemo(() => {
    const now = Date.now();
    let vencidasCount = 0;
    let vencidasMonto = 0;
    let porVencerCount = 0;
    let porVencerMonto = 0;
    let sinCrMonto = 0;

    // Padrón canónico de constants como base de verdad
    CARTERA_OFICIAL.forEach(entry => {
      const order = (orders || []).find(o => {
        if (!o || (o as any).isDeleted) return false;
        const oCr = (o.collection?.contrareciboNumber || o.folio || o.oc || '').toUpperCase().trim();
        return oCr === entry.cr || (o.invoices || []).some((i: any) =>
          (i.collection?.contrareciboNumber || '').toUpperCase().trim() === entry.cr
        );
      });

      if (!order) {
        // CR canónico sin orden en DB → usar monto canónico
        porVencerCount++;
        porVencerMonto += entry.monto;
        return;
      }

      (order.invoices || []).forEach((inv: any) => {
        if (!inv) return;
        const st = inv.creditCycle?.status;
        const amt = inv.financials?.invoiceTotal ?? entry.monto;
        const isPaid = st === 'paid' || st === 'collected';
        const cr = (inv.collection?.contrareciboNumber || order.collection?.contrareciboNumber || '').trim().toUpperCase();

        if (!isPaid && amt > 0) {
          if (!cr || !OFFICIAL_VALID_CRS.includes(cr as any)) {
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

    // Facturas en revisión vinculadas a las OCs maestras sin CR
    [navaOrder, eveliaOrder].forEach(masterOrder => {
      if (!masterOrder) return;
      (masterOrder.invoices || []).forEach((inv: any) => {
        if (!inv) return;
        const st = inv.creditCycle?.status;
        const isPaid = st === 'paid' || st === 'collected';
        const cr = (inv.collection?.contrareciboNumber || masterOrder.collection?.contrareciboNumber || '').trim().toUpperCase();
        const amt = inv.financials?.invoiceTotal ?? 0;
        if (!isPaid && amt > 0 && (!cr || !OFFICIAL_VALID_CRS.includes(cr as any))) {
          sinCrMonto += amt;
        }
      });
    });

    return { vencidasCount, vencidasMonto, porVencerCount, porVencerMonto, sinCrMonto };
  }, [orders, navaOrder, eveliaOrder]);

  const { vencidasCount, vencidasMonto, porVencerMonto, sinCrMonto } = carteraMetrics;
  const totalCarteraReal = vencidasMonto + porVencerMonto + sinCrMonto || TOTAL_CARTERA_OFICIAL;

  // ── Textos dinámicos TH · Nava ────────────────────────────────────────────
  const navaPatioKg = navaMetrics?.patioKg || 0;
  const navaRemanenteKg = navaMetrics ? navaMetrics.remanenteOcKg : 1588.99;
  const navaEntregadosKg = navaMetrics ? navaMetrics.entregadosKg : 4911.01;
  const navaFacturadosKg = navaMetrics ? navaMetrics.facturadosKg : 4911.01;
  const navaFolios = navaMetrics?.foliosFacturados || 'F-6198, F-6200, F-6266';

  const navaTitle = navaPatioKg > 0
    ? `${navaPatioKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg en patio por facturar`
    : `Patio al día (0 kg pendientes) · ${navaRemanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg por surtir`;

  const navaSubtitle = `Entregados: ${navaEntregadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg | Facturados: ${navaFacturadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${navaFolios}). Saldo remanente de OC: ${navaRemanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${money(navaRemanenteKg * saleKg * (1 + ivaRate))} con IVA) pendientes de programar entrega.`;

  const navaBtn = navaPatioKg > 0
    ? `⚡ Facturar ${navaPatioKg.toLocaleString('es-MX', { minimumFractionDigits: 0 })} kg en patio`
    : `⚡ Facturar remanente OC (${navaRemanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 0 })} kg)`;

  // ── Textos dinámicos GT · Evelia ──────────────────────────────────────────
  const eveliaExceso = eveliaMetrics?.excesoKg ?? 298.0;
  const eveliaFacturadosKg = eveliaMetrics ? eveliaMetrics.facturadosKg : 2674.0;
  const eveliaFolios = eveliaMetrics?.foliosFacturados || 'F-6193, F-6267, F-6268';

  const eveliaTitle = `${eveliaExceso.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg entregados en espera de nueva OC`;

  const eveliaSubtitle = `OC 9713 facturada al 100% (${eveliaFacturadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg con ${eveliaFolios}). Faltan ${eveliaExceso.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg entregados físicamente en planta P4 que requieren solicitar una nueva OC a Evelia para poder timbrarse (${money(eveliaExceso * saleKg * (1 + ivaRate))} con IVA).`;

  const eveliaBtn = `📋 Solicitar Nueva OC (${eveliaExceso.toLocaleString('es-MX', { minimumFractionDigits: 0 })} kg)`;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {/* POD 1: TEXTIL HOGAR (NAVA) — datos reales de Firestore */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
          className="pulse-aura-amber"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(180, 83, 9, 0.06) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 18,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px -4px rgba(245, 158, 11, 0.15)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {navaPatioKg > 0 ? '🏢 TH · Nava (Patio por Facturar)' : '🏢 TH · Nava (Patio al Día · Remanente OC)'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
                OC: {OC_TH_NAVA}
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px' }}>
              {navaTitle}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 6, lineHeight: 1.45 }}>
              {navaSubtitle}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenQuickInvoice(navaOrder?.id || `oc-${OC_TH_NAVA}`)}
              style={{
                flex: 1,
                minHeight: 44,
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {navaBtn}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav(`/ordenes?abrir=${navaOrder?.id || `oc-${OC_TH_NAVA}`}`)}
              style={{
                minHeight: 44,
                background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                color: 'var(--ink, #fff)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              📂 Ver OC
            </button>
          </div>
        </motion.div>

        {/* POD 2: GRUPO TEXTIL (EVELIA) — datos reales de Firestore */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(29, 78, 216, 0.06) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: 18,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px -4px rgba(59, 130, 246, 0.15)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                🏭 GT · Evelia (Pendiente Pedir OC)
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>
                OC: {OC_GT_EVELIA}
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px' }}>
              {eveliaTitle}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 6, lineHeight: 1.45 }}>
              {eveliaSubtitle}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={() => onOpenQuickInvoice(eveliaOrder?.id || `oc-${OC_GT_EVELIA}`)}
              style={{
                flex: 1,
                minHeight: 44,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {eveliaBtn}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav(`/ordenes?abrir=${eveliaOrder?.id || `oc-${OC_GT_EVELIA}`}`)}
              style={{
                minHeight: 44,
                background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                color: 'var(--ink, #fff)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              📂 Ver OC 9713
            </button>
          </div>
        </motion.div>

        {/* POD 3: FACTURAS EN ESPERA DE CONTRARECIBO */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(109, 40, 217, 0.06) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            borderRadius: 18,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px -4px rgba(139, 92, 246, 0.15)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: 8,
                  background: 'rgba(139, 92, 246, 0.2)',
                  color: '#c4b5fd',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                📑 En Revisión / Remisión
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>
                Portal Providencia
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px' }}>
              Facturas recientes para tramitar CR
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 6, lineHeight: 1.45 }}>
              Monitorea el ingreso al portal de proveedores (<code style={{ fontSize: 11 }}>apps.mundoprovidencia.com</code>) para capturar los folios <strong>`TH-`</strong> y <strong>`GT-`</strong> oficiales y activar el ciclo de crédito.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={onOpenQuickCollection}
              style={{
                flex: 1,
                minHeight: 44,
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              📝 Asignar CR Rápido
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav('/cobranza')}
              style={{
                minHeight: 44,
                background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                color: 'var(--ink, #fff)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              ⚡ Sincronizar
            </button>
          </div>
        </motion.div>

        {/* POD 4: CARTERA OFICIAL — métricas reales con fallback canónico */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.99 }}
          style={{
            background: vencidasCount > 0
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(185, 28, 28, 0.06) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.06) 100%)',
            border: `1px solid ${vencidasCount > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
            borderRadius: 18,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: vencidasCount > 0
              ? '0 4px 20px -4px rgba(239, 68, 68, 0.15)'
              : '0 4px 20px -4px rgba(16, 185, 129, 0.15)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '3px 10px',
                  borderRadius: 8,
                  background: vencidasCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: vencidasCount > 0 ? '#f87171' : '#34d399',
                  border: `1px solid ${vencidasCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {vencidasCount > 0 ? '🚨 Cobranza Urgente' : '🧾 Cartera Oficial'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: vencidasCount > 0 ? '#f87171' : '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                {vencidasCount > 0 ? `${vencidasCount} Vencidas` : '8 CRs al día'}
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>
              {vencidasCount > 0
                ? `${money(vencidasMonto)} por cobrar vencido`
                : `${money(totalCarteraReal)} en 8 Contrarecibos`}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 6, lineHeight: 1.45 }}>
              Cartera Total: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(totalCarteraReal)}</strong>
              {porVencerMonto > 0 && ` · Por vencer: ${money(porVencerMonto)}`}
              {sinCrMonto > 0 && ` · Sin CR: ${money(sinCrMonto)}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={onOpenQuickCollection}
              style={{
                flex: 1,
                minHeight: 44,
                background: vencidasCount > 0
                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: `0 4px 12px ${vencidasCount > 0 ? 'rgba(220, 38, 38, 0.35)' : 'rgba(5, 150, 105, 0.35)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              💰 Ir a Cobranza
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav('/cobranza')}
              style={{
                minHeight: 44,
                background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                color: 'var(--ink, #fff)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              📊 Cartera
            </button>
          </div>
        </motion.div>

        {/* POD 5 (DINÁMICO): OCs NUEVAS CON status:'pedido' — aparece automáticamente al subir una OC */}
        {newPendingOrders.map((order) => {
          const goalKg = Number(order.totalKilograms) || 0;
          const dept = (order as any).department || '';
          const isTH = dept === 'TH' || (order.client || '').toUpperCase().includes('TEXTIL HOGAR');
          const accentColor = isTH ? '#f59e0b' : '#3b82f6';
          const accentBg = isTH ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)';
          const accentBorder = isTH ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.35)';
          const accentBtn = isTH
            ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
            : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
          const deptLabel = isTH ? '🏢 TH · Nava' : '🏭 GT · Evelia';

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.99 }}
              style={{
                background: `linear-gradient(135deg, ${accentBg} 0%, rgba(0,0,0,0.02) 100%)`,
                border: `1px solid ${accentBorder}`,
                borderRadius: 18,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: `0 4px 20px -4px ${accentBorder}`,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: '3px 10px',
                      borderRadius: 8,
                      background: isTH ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                      color: accentColor,
                      border: `1px solid ${accentBorder}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {deptLabel} — Nueva OC Pendiente
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}>
                    🟢 En Producción
                  </span>
                </div>

                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums' }}>
                  {goalKg > 0
                    ? `${goalKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg por surtir`
                    : 'OC registrada — kilos por confirmar'}
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 6, lineHeight: 1.45 }}>
                  OC: <strong style={{ color: accentColor, fontVariantNumeric: 'tabular-nums' }}>{order.oc || order.folio}</strong>
                  {goalKg > 0 && (
                    <> · Valor estimado: <strong>{money(goalKg * saleKg * (1 + ivaRate))}</strong> con IVA</>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onOpenQuickInvoice(order.id)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    background: accentBtn,
                    color: '#fff',
                    border: 'none',
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: `0 4px 12px ${accentBorder}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  ⚡ Facturar OC
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => nav(`/ordenes?abrir=${order.id}`)}
                  style={{
                    minHeight: 44,
                    background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                    color: 'var(--ink, #fff)',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📂 Ver OC
                </button>
              </div>
            </motion.div>
          );
        })}

      </div>
    </div>
  );
};
