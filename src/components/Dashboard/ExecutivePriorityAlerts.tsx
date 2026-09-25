import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { OcClosureModal } from '../Orders/OcClosureModal';
import { money, toDate } from '../../lib/format';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { useNavigate } from 'react-router-dom';
import {
  OFFICIAL_VALID_CRS,
  OC_TH_NAVA,
  OC_GT_EVELIA,
  OC_GT_ACTIVE,
  CARTERA_OFICIAL,
  TOTAL_CARTERA_OFICIAL,
  isOcTH,
  isOcGT,
} from '../../lib/constants';
import { useToast } from '../../context/ToastContext';
import {
  generateReclamarKilosAndresMessage,
  generateEstadoCuentaSemanalAndresMessage,
  openWhatsAppMessage,
} from '../../lib/whatsappReminder';
import { ThreeWayMatchingBadge } from '../ui/ThreeWayMatchingBadge';

interface ExecutivePriorityAlertsProps {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenQuickInvoice: (orderId?: string | null) => void;
  onOpenQuickCollection: () => void;
}

// ─── Helpers Puros ────────────────────────────────────────────────────────────
function totalKilosFacturados(order: any): number {
  return (order?.invoices || []).reduce((s: number, i: any) => s + (Number(i.kilos) || 0), 0);
}

function totalKilosEntregados(order: any): number {
  return (order?.deliveries || []).reduce((s: number, d: any) => s + (Number(d.kilos) || 0), 0);
}

function getDepartmentMeta(order: Partial<PurchaseOrder> | null | undefined, fallbackDept?: 'TH' | 'GT') {
  const oc = (order?.oc || order?.folio || order?.id || '').toUpperCase();
  const dept = ((order as any)?.department || '').toUpperCase();
  const client = (order?.client || '').toUpperCase();

  const isTH =
    isOcTH(oc) ||
    dept.includes('TH') ||
    client.includes('TH') ||
    client.includes('NAVA') ||
    client.includes('TEXTIL HOGAR') ||
    fallbackDept === 'TH';

  const isGT =
    !isTH &&
    (isOcGT(oc) ||
      dept.includes('GT') ||
      dept.includes('P4') ||
      client.includes('GT') ||
      client.includes('EVELIA') ||
      client.includes('GRUPO TEXTIL') ||
      fallbackDept === 'GT');

  if (isTH) {
    return {
      department: 'TH' as const,
      deptLabel: '🏢 TH · José Nava',
      buyer: 'Lic. José Nava Flores',
      accentColor: '#f59e0b',
      accentBg: 'rgba(245, 158, 11, 0.12)',
      accentBorder: 'rgba(245, 158, 11, 0.35)',
      accentBtn: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      shadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
    };
  }

  return {
    department: 'GT' as const,
    deptLabel: isGT ? '🏭 GT · Lic. Evelia' : '🏭 GT · Providencia',
    buyer: 'Lic. Evelia',
    accentColor: '#3b82f6',
    accentBg: 'rgba(59, 130, 246, 0.12)',
    accentBorder: 'rgba(59, 130, 246, 0.35)',
    accentBtn: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    shadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
  };
}

export const ExecutivePriorityAlerts: React.FC<ExecutivePriorityAlertsProps> = ({
  orders,
  config,
  onOpenQuickInvoice,
  onOpenQuickCollection,
}) => {
  const nav = useNavigate();
  const toast = useToast();
  const [closingOrder, setClosingOrder] = useState<PurchaseOrder | null>(null);
  const [eveliaCompletedArchived, setEveliaCompletedArchived] = useState(() => {
    return localStorage.getItem('evelia_completed_pod_archived') === 'true';
  });

  const handleArchiveEveliaCompleted = () => {
    localStorage.setItem('evelia_completed_pod_archived', 'true');
    setEveliaCompletedArchived(true);
    toast('Expediente de GT (OC 9774) archivado y guardado del tablero.', 'ok');
  };
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

  // 2b. Detección de la Nueva OC oficial que ampara el exceso (OC 12026439774 · 298 kg)
  const eveliaNewOcOrder = useMemo(() => (orders || []).find(o => {
    if (!o || (o as any).isDeleted) return false;
    const oc = (o.oc || o.folio || o.id || '').toUpperCase();
    return oc.includes('9774');
  }), [orders]);

  // 2c. Detección de la OC Activa Oficial vigente para Evelia (OC 12026439784 · 5,100 kg)
  const eveliaActiveOrder = useMemo(() => (orders || []).find(o => {
    if (!o || (o as any).isDeleted) return false;
    const oc = (o.oc || o.folio || o.id || '').toUpperCase();
    return oc === OC_GT_ACTIVE || oc === `OC-${OC_GT_ACTIVE}` || oc.includes('9784');
  }), [orders]);

  // 3. Métricas en tiempo real de la OC TH · Nava
  const navaMetrics = useMemo(() => {
    if (!navaOrder) return null;
    const goalKg = Number(navaOrder.totalKilograms) || 6500;
    const facturadosKg = totalKilosFacturados(navaOrder);
    const entregadosKg = totalKilosEntregados(navaOrder);
    const patioKg = Math.max(0, entregadosKg - facturadosKg);
    const remanenteOcKg = Math.max(0, goalKg - Math.max(entregadosKg, facturadosKg));
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
  const newPendingOrders = useMemo(() => {
    const displayedIds = new Set([
      navaOrder?.id,
      eveliaOrder?.id,
      eveliaNewOcOrder?.id,
    ].filter(Boolean));

    return (orders || []).filter(o => {
      if (!o || (o as any).isDeleted) return false;
      if (displayedIds.has(o.id)) return false;
      const st = (o as any).status || o.creditCycle?.status;
      if (st !== 'pedido' && st !== 'production' && st !== 'activo') return false;
      const oc = (o.oc || o.folio || o.id || '').toUpperCase();
      const isMaster =
        oc.includes('14114') ||
        oc.includes('9713') ||
        oc === OC_TH_NAVA ||
        oc === OC_GT_EVELIA ||
        oc.includes('9774');
      return !isMaster;
    });
  }, [orders, navaOrder, eveliaOrder, eveliaNewOcOrder]);

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

  // 7. Facturas huérfanas de Contrarecibo emitidas hace más de 72 horas (3 días hábiles)
  const orphanInvoices = useMemo(() => {
    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const orphans: Array<{
      orderId: string;
      orderFolio: string;
      department: 'TH' | 'GT';
      buyer: string;
      invoiceFolio: string;
      kilos: number;
      monto: number;
      daysPending: number;
    }> = [];

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted) return;
      const deptMeta = getDepartmentMeta(o);
      const dept = deptMeta.department;
      const buyer = deptMeta.buyer;

      (o.invoices || []).forEach((inv: any) => {
        if (!inv) return;
        const st = inv.creditCycle?.status;
        const isPaid = st === 'paid' || st === 'collected';
        const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
        const hasCr = cr.length > 0 && OFFICIAL_VALID_CRS.includes(cr.toUpperCase() as any);

        if (!isPaid && !hasCr) {
          const issueDate = toDate(inv.creditCycle?.issueDate);
          const issueTime = issueDate ? issueDate.getTime() : now - THREE_DAYS_MS - 1000;
          const diffDays = Math.max(1, Math.floor((now - issueTime) / (24 * 60 * 60 * 1000)));

          if (diffDays >= 3) {
            const monto = inv.financials?.invoiceTotal || (inv.kilos || 0) * saleKg * (1 + ivaRate);
            orphans.push({
              orderId: o.id,
              orderFolio: o.folio || o.oc || o.id || 'S/F',
              department: dept,
              buyer,
              invoiceFolio: inv.folio || inv.id,
              kilos: inv.kilos || 0,
              monto,
              daysPending: diffDays,
            });
          }
        }
      });
    });

    return orphans;
  }, [orders, saleKg, ivaRate]);

  const handleClaimCrWhatsApp = (dept: 'TH' | 'GT') => {
    const relevant = orphanInvoices.filter((inv) => inv.department === dept);
    if (relevant.length === 0) return;
    const buyer = dept === 'TH' ? 'Lic. José Nava Flores' : 'Lic. Evelia';
    const totalMonto = relevant.reduce((sum, i) => sum + i.monto, 0);
    const invoiceList = relevant
      .map((i) => `• Factura #${i.invoiceFolio}: ${i.kilos.toLocaleString('es-MX')} kg | ${money(i.monto)} (${i.daysPending} días transcurridos)`)
      .join('\n');

    const msg =
      `*SOLICITUD DE CONTRARECIBOS — ELEMENTAL DENIM / PROVIDENCIA*\n\n` +
      `Estimada/o ${buyer},\n` +
      `Espero se encuentre muy bien. Le escribo para dar seguimiento a las facturas debidamente entregadas que siguen pendientes de contrarecibo en portal:\n\n` +
      `${invoiceList}\n\n` +
      `*Total pendiente de CR:* ${money(totalMonto)} MXN\n\n` +
      `¿Nos apoyaría por favor confirmando el estatus o compartiéndonos el número de contrarecibo para conciliar la fecha de pago en sistema?\n\n` +
      `Muchas gracias por su apoyo. Saludos cordiales.`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // ── Textos Dinámicos TH · Nava ────────────────────────────────────────────
  const navaPatioKg = navaMetrics?.patioKg || 0;
  const navaRemanenteKg = navaMetrics ? navaMetrics.remanenteOcKg : 88.99;
  const navaEntregadosKg = navaMetrics ? navaMetrics.entregadosKg : 6411.01;
  const navaFacturadosKg = navaMetrics ? navaMetrics.facturadosKg : 6411.01;
  const navaFolios = navaMetrics?.foliosFacturados || 'F-6198, F-6200, F-6266, F-6271';

  const navaTitle = navaPatioKg > 0
    ? `${navaPatioKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg en patio por facturar`
    : navaRemanenteKg <= 100
    ? `Patio al día (0 kg) · Cumplida al 98.6% (${navaRemanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg saldo)`
    : `Patio al día (0 kg) · ${navaRemanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg por surtir`;

  const navaSubtitle = `Entregados: ${navaEntregadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg | Facturados: ${navaFacturadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${navaFolios}). Saldo remanente de OC: ${navaRemanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${money(navaRemanenteKg * saleKg * (1 + ivaRate))} con IVA) con finiquito acordado.`;

  const navaBtn = navaPatioKg > 0
    ? `⚡ Facturar Patio (${Math.round(navaPatioKg)} kg)`
    : navaRemanenteKg <= 100
    ? `🏁 OC Finiquitada (Ver Expediente)`
    : `⚡ Facturar Remanente`;

  // ── Textos Dinámicos GT · Evelia ──────────────────────────────────────────
  const hasNewOc = !!eveliaNewOcOrder;
  const newOcFacturados = hasNewOc ? totalKilosFacturados(eveliaNewOcOrder) : 0;
  const newOcGoal = Number(eveliaNewOcOrder?.totalKilograms) || 298.0;
  const isNewOcPendingInvoice = hasNewOc && (newOcFacturados < newOcGoal);

  const eveliaExceso = eveliaMetrics?.excesoKg ?? 298.0;
  const eveliaFacturadosKg = eveliaMetrics ? eveliaMetrics.facturadosKg : 2674.0;
  const eveliaFolios = eveliaMetrics?.foliosFacturados || 'F-6193, F-6267, F-6268';

  let eveliaBadge = '🏭 GT · Lic. Evelia';
  let eveliaBadgeColor = '#60a5fa';
  let eveliaOcLabel = `OC: ${OC_GT_EVELIA}`;
  let eveliaStatusLabel = '📋 Pendiente OC';
  let eveliaTitle = `${eveliaExceso.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg entregados en espera de nueva OC`;
  let eveliaSubtitle = `OC 9713 facturada al 100% (${eveliaFacturadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg con ${eveliaFolios}). Faltan ${eveliaExceso.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg entregados físicamente en planta P4 que requieren solicitar una nueva OC a Evelia para poder timbrarse (${money(eveliaExceso * saleKg * (1 + ivaRate))} con IVA).`;
  let eveliaBtn = `📋 Solicitar Nueva OC`;
  let eveliaTargetOrderId = eveliaOrder?.id || `oc-${OC_GT_EVELIA}`;

  if (eveliaActiveOrder) {
    const activeKg = Number(eveliaActiveOrder.totalKilograms) || 5100.0;
    const activeEntregados = totalKilosEntregados(eveliaActiveOrder);
    const activeFacturados = totalKilosFacturados(eveliaActiveOrder);
    const activeRemanente = Math.max(0, activeKg - activeEntregados);
    eveliaBadge = `🏭 GT · Lic. Evelia`;
    eveliaBadgeColor = '#3b82f6';
    eveliaOcLabel = `OC: ${eveliaActiveOrder.oc || '12026439784'} (${eveliaActiveOrder.folio || '43/9784'})`;
    eveliaStatusLabel = activeEntregados > 0 ? '⚡ En Suministro' : '📦 En Maquila';
    eveliaTitle = `OC 43/9784 (${activeKg.toLocaleString('es-MX', { minimumFractionDigits: 0 })} kg) · Abierta para Suministro`;
    eveliaSubtitle = `Nueva orden oficial de Evelia en Planta P4. ${activeEntregados.toLocaleString('es-MX', { minimumFractionDigits: 1 })} kg entregados, ${activeRemanente.toLocaleString('es-MX', { minimumFractionDigits: 1 })} kg en proceso de maquila con Andrés.`;
    eveliaBtn = activeEntregados > activeFacturados ? '⚡ Facturar Entregas' : '📦 Ver OC 9784';
    eveliaTargetOrderId = eveliaActiveOrder.id || 'oc-12026439784';
  } else if (hasNewOc && isNewOcPendingInvoice) {
    const targetFolio = eveliaNewOcOrder?.folio || '43/9774';
    eveliaBadge = `🏭 GT · Lic. Evelia`;
    eveliaBadgeColor = '#34d399';
    eveliaOcLabel = `OC: 12026439774 (${targetFolio})`;
    eveliaStatusLabel = '⚡ Lista para Timbrar';
    eveliaTitle = `OC 12026439774 (${newOcGoal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg) · Lista para Facturar`;
    eveliaSubtitle = `Ampara los ${newOcGoal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg entregados físicamente en Planta P4 (Folio ${targetFolio} · ${money(newOcGoal * saleKg * (1 + ivaRate))} con IVA). Lista para timbrarse.`;
    eveliaBtn = `⚡ Facturar OC 9774`;
    eveliaTargetOrderId = eveliaNewOcOrder.id || 'oc-12026439774';
  } else if (hasNewOc && !isNewOcPendingInvoice) {
    eveliaBadge = `🏭 GT · Lic. Evelia`;
    eveliaBadgeColor = '#10b981';
    eveliaOcLabel = `OC: 12026439774 (43/9774)`;
    eveliaStatusLabel = '✅ Al Día';
    eveliaTitle = `OC 9713 y OC 9774 Facturadas al 100%`;
    eveliaSubtitle = `Todos los kilos entregados físicamente en P4 (2,674 kg + 298 kg) se encuentran debidamente amparados y timbrados con Factura 6302.`;
    eveliaBtn = `📥 Guardar y Ocultar`;
    eveliaTargetOrderId = eveliaNewOcOrder.id || 'oc-12026439774';
  }

  // 6. Conciliación Global de Maquila Andrés (Kilos pendientes en todas las OCs activas)
  const andresGlobalFaltantes = useMemo(() => {
    let totalKg = 0;
    let pedidosKg = 0;
    let entregadosKg = 0;
    const desglose: Array<{
      oc: string;
      cliente: string;
      pedidosKg: number;
      entregadosKg: number;
      faltantesKg: number;
      viajesCount: number;
    }> = [];

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted || o.isClosedShort) return;
      const oc = (o.oc || o.folio || o.id || '').toUpperCase();
      const client = o.client || 'Providencia';
      const itemsSum = (o.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
      const ped = itemsSum > 0 ? itemsSum : (Number(o.totalKilograms) || 0);
      const ent = totalKilosEntregados(o);
      const falt = Math.max(0, ped - ent);
      const viajes = (o.deliveries || []).length;

      if (ped > 0) {
        pedidosKg += ped;
        entregadosKg += ent;
        if (falt > 0.01) {
          totalKg += falt;
          desglose.push({
            oc,
            cliente: client,
            pedidosKg: ped,
            entregadosKg: ent,
            faltantesKg: falt,
            viajesCount: viajes,
          });
        }
      }
    });

    return { totalKg, pedidosKg, entregadosKg, countOcs: desglose.length, desglose };
  }, [orders]);

  const handleSendWeeklyMaquilaWhatsApp = () => {
    const text = generateEstadoCuentaSemanalAndresMessage({
      providerName: 'Andrés',
      totalKilosPedidos: andresGlobalFaltantes.pedidosKg,
      totalKilosEntregados: andresGlobalFaltantes.entregadosKg,
      totalKilosFaltantes: andresGlobalFaltantes.totalKg,
      totalViajes: andresGlobalFaltantes.desglose.reduce((s, it) => s + it.viajesCount, 0),
      costoKg: 38,
      desgloseOcs: andresGlobalFaltantes.desglose,
    });
    openWhatsAppMessage(text);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* BANNER PROACTIVO: MAQUILA ANDRÉS KILOS PENDIENTES */}
      {andresGlobalFaltantes.totalKg > 0.01 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 14,
            padding: '12px 18px',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.14) 0%, rgba(91, 33, 182, 0.08) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 20px -4px rgba(124, 58, 237, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🏭</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Maquila Andrés: {andresGlobalFaltantes.totalKg.toLocaleString('es-MX')} kg Pendientes de Entregar ({andresGlobalFaltantes.countOcs} OCs · {money(andresGlobalFaltantes.totalKg * 38)} a $38/kg)
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink, #fff)', marginTop: 2 }}>
                {andresGlobalFaltantes.desglose.map(d => `OC ${d.oc}: faltan ${d.faltantesKg.toLocaleString('es-MX')} kg`).join(' · ')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              onClick={handleSendWeeklyMaquilaWhatsApp}
              style={{
                minHeight: 38,
                padding: '6px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(37, 211, 102, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Enviar consolidado semanal a Andrés por WhatsApp"
            >
              <span>📲</span>
              <span>Reporte Semanal a Andrés</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => nav('/oc')}
              style={{
                minHeight: 38,
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                cursor: 'pointer',
              }}
            >
              🚚 Ver Báscula por OC →
            </button>
          </div>
        </motion.div>
      )}

      {/* BANNER PROACTIVO: FACTURAS SIN CONTRARECIBO (> 72 HORAS) */}
      {orphanInvoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 14,
            padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(185, 28, 28, 0.08) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            borderRadius: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 20px -4px rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Centinela Proactivo: {orphanInvoices.length} Factura{orphanInvoices.length > 1 ? 's' : ''} Sin Contrarecibo (&gt; 72 hrs)
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink, #fff)', marginTop: 2 }}>
                {orphanInvoices.map((i) => `F-${i.invoiceFolio} (${money(i.monto)})`).join(' · ')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {orphanInvoices.some((i) => i.department === 'TH') && (
              <button
                type="button"
                className="btn"
                onClick={() => handleClaimCrWhatsApp('TH')}
                style={{
                  minHeight: 38,
                  padding: '6px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(37, 211, 102, 0.3)',
                }}
              >
                💬 Reclamar a Lic. Nava
              </button>
            )}
            {orphanInvoices.some((i) => i.department === 'GT') && (
              <button
                type="button"
                className="btn"
                onClick={() => handleClaimCrWhatsApp('GT')}
                style={{
                  minHeight: 38,
                  padding: '6px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(37, 211, 102, 0.3)',
                }}
              >
                💬 Reclamar a Lic. Evelia
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* GRID PRINCIPAL DE ALERTAS EJECUTIVAS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))',
          gap: 16,
        }}
      >
        {/* POD 1: TEXTIL HOGAR (NAVA) */}
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
            minHeight: 230,
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                }}
              >
                🏢 TH · José Nava
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: navaPatioKg > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                    color: navaPatioKg > 0 ? '#f87171' : '#f59e0b',
                    border: `1px solid ${navaPatioKg > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.3)'}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {navaPatioKg > 0 ? '⚡ Patio por Facturar' : '🟡 Remanente OC'}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  OC: {OC_TH_NAVA}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
              {navaTitle}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 8, lineHeight: 1.45 }}>
              {navaSubtitle}
            </div>

            {navaOrder && (
              <div style={{ marginTop: 12, overflowX: 'auto', maxWidth: '100%' }}>
                <ThreeWayMatchingBadge order={navaOrder} compact />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {navaPatioKg === 0 && (navaRemanenteKg <= 150 || navaOrder?.isClosedShort) ? (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setClosingOrder(navaOrder || ({
                    id: `oc-${OC_TH_NAVA}`,
                    oc: OC_TH_NAVA,
                    folio: '71/14114',
                    client: 'GRUPO TEXTIL PROVIDENCIA (TH - JOSÉ NAVA)',
                    totalKilograms: 6500,
                    isClosedShort: true,
                    deliveries: [{ kilos: 6411.01 }],
                    invoices: [{ kilos: 6411.01 }],
                  } as any))}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    background: navaOrder?.isClosedShort
                      ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                      : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 14px',
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: navaOrder?.isClosedShort
                      ? '0 4px 12px rgba(5, 150, 105, 0.35)'
                      : '0 4px 12px rgba(217, 119, 6, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                  title={navaOrder?.isClosedShort ? 'Ver acta de auditoría y finiquito de la OC' : 'Cerrar y finiquitar formalmente la orden con 88.99 kg de merma'}
                >
                  {navaOrder?.isClosedShort
                    ? '🏁 OC Concluida (Ver Acta)'
                    : `🔒 Cerrar OC (${navaRemanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 1 })} kg Finiquito)`}
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={() => nav(`/ordenes?abrir=${navaOrder?.id || `oc-${OC_TH_NAVA}`}`)}
                  style={{
                    minHeight: 40,
                    background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                    color: 'var(--ink, #fff)',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    padding: '9px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  📂 Ver OC
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onOpenQuickInvoice(navaOrder?.id || `oc-${OC_TH_NAVA}`)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 12px',
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {navaBtn}
                </button>
                {navaRemanenteKg > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const text = generateReclamarKilosAndresMessage({
                        oc: navaOrder?.folio || navaOrder?.oc || OC_TH_NAVA,
                        client: 'Textil Hogar (José Nava)',
                        totalKg: Number(navaOrder?.totalKilograms) || 6500,
                        entregadosKg: navaEntregadosKg,
                        faltantesKg: navaRemanenteKg,
                        providerName: 'Andrés',
                        deliveriesCount: (navaOrder?.deliveries || []).length,
                      });
                      openWhatsAppMessage(text);
                    }}
                    style={{
                      minHeight: 40,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    title={`Enviar WhatsApp a Andrés para exigir la entrega de los ${Math.round(navaRemanenteKg)} kg restantes`}
                  >
                    💬 Reclamar ({Math.round(navaRemanenteKg)} kg)
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => nav(`/ordenes?abrir=${navaOrder?.id || `oc-${OC_TH_NAVA}`}`)}
                  style={{
                    minHeight: 40,
                    background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                    color: 'var(--ink, #fff)',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    padding: '9px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  📂 Ver OC
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* POD 2: GRUPO TEXTIL (EVELIA) */}
        {(!eveliaCompletedArchived || eveliaActiveOrder || isNewOcPendingInvoice) && (
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
              minHeight: 230,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: hasNewOc && !eveliaActiveOrder ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: eveliaBadgeColor,
                    border: `1px solid ${hasNewOc && !eveliaActiveOrder ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {eveliaBadge}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: hasNewOc && !eveliaActiveOrder ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: eveliaBadgeColor,
                      border: `1px solid ${hasNewOc && !eveliaActiveOrder ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {eveliaStatusLabel}
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: eveliaBadgeColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {eveliaOcLabel}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
                {eveliaTitle}
              </div>

              <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 8, lineHeight: 1.45 }}>
                {eveliaSubtitle}
              </div>

              {(eveliaActiveOrder || eveliaNewOcOrder || eveliaOrder) && (
                <div style={{ marginTop: 12, overflowX: 'auto', maxWidth: '100%' }}>
                  <ThreeWayMatchingBadge order={(eveliaActiveOrder || eveliaNewOcOrder || eveliaOrder)!} compact />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {hasNewOc && !isNewOcPendingInvoice && !eveliaActiveOrder ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleArchiveEveliaCompleted}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    title="Ocultar esta tarjeta del tablero porque ya está al 100% cumplida y facturada"
                  >
                    📥 Guardar y Ocultar del Tablero
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => nav(`/ordenes?abrir=${eveliaTargetOrderId}`)}
                    style={{
                      minHeight: 40,
                      background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                      color: 'var(--ink, #fff)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    📂 Ver OC 9774
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      if (eveliaActiveOrder) {
                        nav(`/ordenes?abrir=${eveliaTargetOrderId}`);
                      } else {
                        onOpenQuickInvoice(eveliaTargetOrderId);
                      }
                    }}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      background: hasNewOc ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxShadow: hasNewOc ? '0 4px 12px rgba(5, 150, 105, 0.35)' : '0 4px 12px rgba(37, 99, 235, 0.35)',
                    }}
                  >
                    {eveliaBtn}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => nav(`/ordenes?abrir=${eveliaTargetOrderId}`)}
                    style={{
                      minHeight: 40,
                      background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                      color: 'var(--ink, #fff)',
                      border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    📂 Ver OC {eveliaActiveOrder ? '9784' : hasNewOc ? '9774' : '9713'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}

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
            minHeight: 230,
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(139, 92, 246, 0.2)',
                  color: '#c4b5fd',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                }}
              >
                📑 Portal Providencia
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  whiteSpace: 'nowrap',
                }}
              >
                🌐 Trámite de CR
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px', lineHeight: 1.25 }}>
              Facturas recientes para tramitar CR
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 8, lineHeight: 1.45 }}>
              Monitorea el ingreso al portal de proveedores (<code style={{ fontSize: 11 }}>apps.mundoprovidencia.com</code>) para capturar los folios <strong>`TH-`</strong> y <strong>`GT-`</strong> oficiales y activar el ciclo de crédito.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={onOpenQuickCollection}
              style={{
                flex: 1,
                minHeight: 40,
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: '#fff',
                border: 'none',
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
                minHeight: 40,
                background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                color: 'var(--ink, #fff)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              ⚡ Sincronizar
            </button>
          </div>
        </motion.div>

        {/* POD 4: CARTERA OFICIAL */}
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
            minHeight: 230,
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: vencidasCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: vencidasCount > 0 ? '#f87171' : '#34d399',
                  border: `1px solid ${vencidasCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  whiteSpace: 'nowrap',
                }}
              >
                {vencidasCount > 0 ? '🚨 Cartera Providencia' : '🧾 Cartera Oficial'}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: vencidasCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: vencidasCount > 0 ? '#f87171' : '#34d399',
                  border: `1px solid ${vencidasCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {vencidasCount > 0 ? `${vencidasCount} Vencidas` : '✅ 8 CRs al Día'}
              </span>
            </div>

            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
              {vencidasCount > 0
                ? `${money(vencidasMonto)} por cobrar vencido`
                : `${money(totalCarteraReal)} en 8 Contrarecibos`}
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 8, lineHeight: 1.45 }}>
              Cartera Total: <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(totalCarteraReal)}</strong>
              {porVencerMonto > 0 && ` · Por vencer: ${money(porVencerMonto)}`}
              {sinCrMonto > 0 && ` · Sin CR: ${money(sinCrMonto)}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={onOpenQuickCollection}
              style={{
                flex: 1,
                minHeight: 40,
                background: vencidasCount > 0
                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#fff',
                border: 'none',
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
                minHeight: 40,
                background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                color: 'var(--ink, #fff)',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                padding: '9px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              📊 Cartera
            </button>
          </div>
        </motion.div>

        {/* POD 5 (DINÁMICO): OCs NUEVAS PENDIENTES DE SURTIR */}
        {newPendingOrders.map((order) => {
          const goalKg = Number(order.totalKilograms) || 0;
          const facturadosKg = totalKilosFacturados(order);
          const entregadosKg = totalKilosEntregados(order);
          const patioKg = Math.max(0, entregadosKg - facturadosKg);
          const remanenteKg = Math.max(0, goalKg - Math.max(entregadosKg, facturadosKg));
          const unitPrice = Number((order as any).pricePerKg || (order as any).costPerKg) || saleKg;
          const valorRemanente = remanenteKg * unitPrice * (1 + ivaRate);
          const foliosFacturados = (order.invoices || []).map((i: any) => `F-${i.folio || i.id}`).join(', ');

          const deptInfo = getDepartmentMeta(order);

          const title = remanenteKg > 0
            ? `${remanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg por surtir${facturadosKg > 0 ? ` (de ${goalKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg)` : ''}`
            : `OC amparada al 100% (${goalKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg)`;

          const subtitle = facturadosKg > 0
            ? `Entregados: ${entregadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg | Facturados: ${facturadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${foliosFacturados}). Saldo remanente: ${remanenteKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${money(valorRemanente)} con IVA) pendientes de programar entrega.`
            : `OC: ${order.oc || order.folio} registrada por ${goalKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg. Valor total estimado: ${money(valorRemanente)} con IVA.`;

          const primaryBtnText = patioKg > 0
            ? `⚡ Facturar Patio (${Math.round(patioKg)} kg)`
            : `⚡ Facturar Remanente`;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.99 }}
              style={{
                background: `linear-gradient(135deg, ${deptInfo.accentBg} 0%, rgba(0,0,0,0.02) 100%)`,
                border: `1px solid ${deptInfo.accentBorder}`,
                borderRadius: 18,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: `0 4px 20px -4px ${deptInfo.shadow}`,
                minHeight: 230,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: deptInfo.accentBg,
                      color: deptInfo.accentColor,
                      border: `1px solid ${deptInfo.accentBorder}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {deptInfo.deptLabel}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: patioKg > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: patioKg > 0 ? '#f87171' : '#34d399',
                        border: `1px solid ${patioKg > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {patioKg > 0 ? `⚡ ${patioKg.toLocaleString('es-MX')} kg en Patio` : '🟢 En Producción'}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: deptInfo.accentColor,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      OC: {order.oc || order.folio}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #fff)', letterSpacing: '-0.3px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
                  {title}
                </div>

                <div style={{ fontSize: 12.5, color: 'var(--ink-soft, rgba(255,255,255,0.7))', marginTop: 8, lineHeight: 1.45 }}>
                  {subtitle}
                </div>

                <div style={{ marginTop: 12, overflowX: 'auto', maxWidth: '100%' }}>
                  <ThreeWayMatchingBadge order={order} compact />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => onOpenQuickInvoice(order.id)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    background: deptInfo.accentBtn,
                    color: '#fff',
                    border: 'none',
                    padding: '9px 12px',
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxShadow: deptInfo.shadow,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {primaryBtnText}
                </button>
                {remanenteKg > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const text = generateReclamarKilosAndresMessage({
                        oc: order.oc || order.folio || order.id,
                        client: deptInfo.buyer || 'Providencia',
                        totalKg: goalKg,
                        entregadosKg: entregadosKg,
                        faltantesKg: remanenteKg,
                        providerName: 'Andrés',
                        deliveriesCount: (order.deliveries || []).length,
                      });
                      openWhatsAppMessage(text);
                    }}
                    style={{
                      minHeight: 40,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      padding: '9px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    title={`Enviar WhatsApp a Andrés reclamando los ${Math.round(remanenteKg)} kg faltantes`}
                  >
                    💬 Reclamar ({Math.round(remanenteKg)} kg)
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => nav(`/ordenes?abrir=${order.id}`)}
                  style={{
                    minHeight: 40,
                    background: 'var(--paper-sunk, rgba(255, 255, 255, 0.08))',
                    color: 'var(--ink, #fff)',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
                    padding: '9px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
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

      {/* MODAL DE CIERRE Y AUDITORÍA DE OC */}
      {closingOrder && (
        <OcClosureModal
          order={closingOrder}
          onClose={() => setClosingOrder(null)}
        />
      )}
    </div>
  );
};

