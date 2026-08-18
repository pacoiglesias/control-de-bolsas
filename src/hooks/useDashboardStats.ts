import { useMemo } from 'react';
import { round2, computeCommissionFromInvoiceTotal, extractDashboardAlerts, calculateLiveMargenTotal, normalizarTexto } from '../lib/finance';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from '../lib/types';

export function useDashboardStats(
  statsDoc: any, 
  activeOrders: PurchaseOrder[], 
  monthFilter: string, 
  config: FinancialConfig, 
  purchases: Purchase[], 
  expenses: Expense[],
  allDepartmentOrders?: PurchaseOrder[],
  deptFilter?: string
) {
  return useMemo(() => {
    const cfg: FinancialConfig = {
      salePricePerKg: config?.salePricePerKg || 43,
      costPricePerKg: config?.costPricePerKg || 42,
      commissionRate: typeof config?.commissionRate === 'number' ? config.commissionRate : 0.08,
      commissionBase: config?.commissionBase || 'subtotal',
      ivaRate: typeof config?.ivaRate === 'number' ? config.ivaRate : 0.16,
      creditDays: config?.creditDays || 30,
      historicalDebtAndres: typeof config?.historicalDebtAndres === 'number' ? config.historicalDebtAndres : -102670.27,
    };

    const st = statsDoc || {};
    const kpis = st.kpis || { totalKilos: 0, totalVendido: 0, netoTotal: 0, margenTotal: 0, gananciaRealizadaTotal: 0, porCobrar: 0, porCobrarSinCR: 0, porCobrarConCR: 0, vencido: 0, cobrado: 0, netoCobrado: 0, porRecibir: 0, montoPendienteFacturar: 0 };
    const counters = st.counters || { pendingOrders: 0, overdueOrders: 0, manualReview: 0, totalOrders: 0, pedidoOrders: 0, paymentDaysCount: 0 };
    const mesesObj = st.histograms || {};

    const isDeptFiltered = !!deptFilter && deptFilter !== 'ALL';
    const deptOrders = allDepartmentOrders && allDepartmentOrders.length > 0 ? allDepartmentOrders : activeOrders;

    // Métricas en vivo calculadas directamente de las órdenes del departamento
    let liveTotalKilos = 0;
    let liveTotalVendido = 0;
    let liveCobrado = 0;
    let liveNetoCobrado = 0;
    let liveGananciaRealizadaCalc = 0;
    let liveFacturasEmitidasCount = 0;
    let livePendingOrdersCount = 0;
    let liveOverdueOrdersCount = 0;
    let livePedidoOrdersCount = 0;
    let liveManualReviewCount = 0;
    let liveTotalOrdersCount = deptOrders.length;
    let livePaymentDaysSum = 0;
    let livePaymentDaysCount = 0;

    const liveMesesObj: Record<string, { venta: number; gananciaRealizada: number; margen: number }> = {};

    deptOrders.forEach(o => {
      if (!o || o.isClosedShort) return;
      const isPedido = (o as any).status === 'pedido' || (!o.invoices?.length && !o.deliveries?.length);
      if (isPedido) livePedidoOrdersCount++;

      let hasOverdue = false;
      let hasPending = false;
      let hasReview = false;

      (o.invoices || []).forEach(inv => {
        if (!inv) return;
        liveFacturasEmitidasCount++;
        const kilos = Number(inv.kilos) || 0;
        liveTotalKilos += kilos;
        const total = inv.financials?.invoiceTotal ?? (kilos * cfg.salePricePerKg * (1 + cfg.ivaRate));
        liveTotalVendido += total;

        const stStatus = inv.creditCycle?.status;
        if (stStatus === 'overdue') hasOverdue = true;
        if (stStatus === 'pending' || stStatus === 'facturado') hasPending = true;
        if (stStatus === 'manual_review') hasReview = true;

        if (stStatus === 'paid' || stStatus === 'collected') {
          liveCobrado += total;
          const comm = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(total, cfg);
          const cost = kilos * cfg.costPricePerKg;
          liveNetoCobrado += (total - comm);
          const profit = total - cost - comm;
          liveGananciaRealizadaCalc += Math.max(0, profit);

          const rawD1 = (inv.creditCycle as any)?.issueDate;
          const rawD2 = (inv.creditCycle as any)?.paidDate;
          if (rawD1 && rawD2) {
            const d1 = rawD1?.toDate ? rawD1.toDate() : new Date(rawD1);
            const d2 = rawD2?.toDate ? rawD2.toDate() : new Date(rawD2);
            if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
              const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays > 0 && diffDays < 365) {
                livePaymentDaysSum += diffDays;
                livePaymentDaysCount++;
              }
            }
          }
        }

        // Histograma por mes
        const rawDate = (inv.creditCycle?.issueDate || (inv as any).date || (o as any).createdAt || (o as any).date) as any;
        if (rawDate) {
          const dateObj = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
          if (!isNaN(dateObj.getTime())) {
            const mKey = dateObj.toISOString().slice(0, 7);
            if (!liveMesesObj[mKey]) liveMesesObj[mKey] = { venta: 0, gananciaRealizada: 0, margen: 0 };
            liveMesesObj[mKey].venta += total;
            const cost = kilos * cfg.costPricePerKg;
            const comm = computeCommissionFromInvoiceTotal(total, cfg);
            liveMesesObj[mKey].margen += Math.max(0, total - cost);
            if (stStatus === 'paid' || stStatus === 'collected') {
              liveMesesObj[mKey].gananciaRealizada += Math.max(0, total - cost - comm);
            }
          }
        }
      });

      if (hasOverdue) liveOverdueOrdersCount++;
      else if (hasPending) livePendingOrdersCount++;
      if (hasReview) liveManualReviewCount++;
    });

    const useLiveStats = isDeptFiltered || !st.kpis || kpis.totalKilos === 0;

    const effectiveTotalKilos = useLiveStats ? liveTotalKilos : (kpis.totalKilos || 0);
    const effectiveTotalVendido = useLiveStats ? liveTotalVendido : (kpis.totalVendido || 0);
    const effectiveNetoTotal = useLiveStats ? liveTotalVendido : (kpis.netoTotal || 0);
    const effectiveCobrado = useLiveStats ? liveCobrado : (kpis.cobrado || 0);
    const effectiveNetoCobrado = useLiveStats ? liveNetoCobrado : (kpis.netoCobrado || 0);
    const effectiveGananciaRealizada = useLiveStats ? liveGananciaRealizadaCalc : (kpis.gananciaRealizadaTotal || 0);
    const effectiveFacturasEmitidas = useLiveStats ? liveFacturasEmitidasCount : (kpis.facturasEmitidas || 0);
    const effectivePendingOrders = useLiveStats ? livePendingOrdersCount : (counters.pendingOrders || 0);
    const effectiveOverdueOrders = useLiveStats ? liveOverdueOrdersCount : (counters.overdueOrders || 0);
    const effectivePedidoOrders = useLiveStats ? livePedidoOrdersCount : (counters.pedidoOrders || 0);
    const effectiveManualReview = useLiveStats ? liveManualReviewCount : (counters.manualReview || 0);
    const effectiveTotalOrders = useLiveStats ? liveTotalOrdersCount : (counters.totalOrders || 0);

    const mesesObjEffective = useLiveStats && Object.keys(liveMesesObj).length > 0 ? liveMesesObj : mesesObj;
    const mesesKeys = Object.keys(mesesObjEffective).sort().slice(-6);
    const maxMes = mesesKeys.length > 0 ? Math.max(1, ...mesesKeys.map((m) => mesesObjEffective[m]?.venta || 0)) : 1;

    const effectivePaymentDaysCount = useLiveStats ? livePaymentDaysCount : (counters.paymentDaysCount || 0);
    const effectivePaymentDaysSum = useLiveStats ? livePaymentDaysSum : (kpis.paymentDaysSum || 0);
    const avgDSO = effectivePaymentDaysCount > 0 ? effectivePaymentDaysSum / effectivePaymentDaysCount : 0;

    const alerts = extractDashboardAlerts(activeOrders, avgDSO, cfg);
    const vencidas = alerts.vencidas;
    const proximas = alerts.proximas;
    const porRecibir = alerts.porRecibir;
    const criticos30 = alerts.criticos30;
    const urgentes15 = alerts.urgentes15;
    const recientes1 = alerts.recientes1;
    const proyeccion7d = alerts.proyeccion7d;
    const proyeccion15d = alerts.proyeccion15d;

    // Respaldo en vivo de margen total
    let liveMargenTotal = useLiveStats ? 0 : (kpis.margenTotal || 0);
    if (useLiveStats || kpis.margenTotal === 0) {
      liveMargenTotal = calculateLiveMargenTotal(deptOrders, cfg.costPricePerKg);
    }

    // Cálculo en vivo directo de Por Cobrar y Vencidos desde las órdenes reales
    let livePorCobrar = 0;
    let livePorCobrarConCR = 0;
    let livePorCobrarSinCR = 0;
    let liveVencido = 0;
    const now = Date.now();

    activeOrders.forEach(o => {
      if (!o || o.isClosedShort) return;
      (o.invoices || []).forEach(inv => {
        if (!inv) return;
        const stStatus = inv.creditCycle?.status;
        if (stStatus === 'pending' || stStatus === 'overdue' || stStatus === 'facturado') {
          const amt = inv.financials?.invoiceTotal ?? ((Number(inv.kilos) || 0) * cfg.salePricePerKg * (1 + cfg.ivaRate));
          livePorCobrar += amt;
          const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
          if (cr) {
            livePorCobrarConCR += amt;
          } else {
            livePorCobrarSinCR += amt;
          }
          const rawDue = inv.creditCycle?.dueDate as any;
          let dueTime: number | null = null;
          if (rawDue) {
            if (typeof rawDue.toMillis === 'function') dueTime = rawDue.toMillis();
            else if (typeof rawDue.toDate === 'function') dueTime = rawDue.toDate().getTime();
            else if (rawDue instanceof Date) dueTime = rawDue.getTime();
            else { const d = new Date(rawDue); if (!isNaN(d.getTime())) dueTime = d.getTime(); }
          }
          if (dueTime && dueTime < now) {
            liveVencido += amt;
          }
        }
      });
    });

    const effectivePorCobrar = livePorCobrar > 0 || useLiveStats ? livePorCobrar : (kpis.porCobrar || 0);
    const effectivePorCobrarConCR = livePorCobrar > 0 || useLiveStats ? livePorCobrarConCR : (kpis.porCobrarConCR || 0);
    const effectivePorCobrarSinCR = livePorCobrar > 0 || useLiveStats ? livePorCobrarSinCR : (kpis.porCobrarSinCR || 0);
    const effectiveVencido = livePorCobrar > 0 || useLiveStats ? liveVencido : (kpis.vencido || 0);

    let liveGananciaRealizada = effectiveGananciaRealizada;

    // Calcular Remisiones (Kilos entregados - Kilos facturados)
    let totalKilosDelivered = 0;
    let totalKilosInvoiced = 0;
    deptOrders.forEach(o => {
      const deliveries = o.deliveries || [];
      const invoices = o.invoices || [];
      let oDel = 0, oInv = 0;
      deliveries.forEach((d: any) => oDel += (d.kilos || 0));
      invoices.forEach((i: any) => oInv += (i.kilos || 0));
      totalKilosDelivered += oDel;
      totalKilosInvoiced += oInv;
    });
    const kilosPendientesFacturar = Math.max(0, totalKilosDelivered - totalKilosInvoiced);
    const valorPendienteFacturar = kilosPendientesFacturar * cfg.costPricePerKg;

    const deudaTotalProvidencia = (effectivePorCobrar || 0) + (kpis.montoPendienteFacturar || 0);
    const comisionContable = computeCommissionFromInvoiceTotal(deudaTotalProvidencia, cfg);
    const dineroRealARecibir = deudaTotalProvidencia - comisionContable;

    const allMeses = Object.keys(mesesObjEffective).sort();
    let periodText = 'Acumulado de todo el historial, sin límite de fecha';
    if (monthFilter !== 'ALL') {
      const [yy, mm] = monthFilter.split('-');
      const date = new Date(parseInt(yy), parseInt(mm) - 1, 1);
      periodText = `Datos del mes de ${date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`;
    } else if (allMeses.length > 0) {
      const formatMonth = (m: string) => {
        const [yy, mm] = m.split('-');
        const date = new Date(parseInt(yy), parseInt(mm) - 1, 1);
        return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      };
      if (allMeses.length === 1) {
        periodText = `Acumulado de ${formatMonth(allMeses[0])}`;
      } else {
        periodText = `Acumulado de ${formatMonth(allMeses[0])} a ${formatMonth(allMeses[allMeses.length - 1])}`;
      }
    }

    const isMonthMatch = (d: any) => {
      if (monthFilter === 'ALL') return true;
      if (!d) return false;
      const dateObj = d.toDate ? d.toDate() : new Date(d);
      const mStr = dateObj.toISOString().slice(0, 7);
      return mStr === monthFilter;
    };

    // Inventario Vivo (Bodega)
    let totalReceivedKilos = 0;
    (purchases || []).forEach(p => {
      if (normalizarTexto(p.provider) !== 'andres') return;
      totalReceivedKilos += (p.receivedKilos || 0);
    });
    const inventarioVivo = totalReceivedKilos - totalKilosInvoiced;

    // Caja y Flujo
    let localSaldoCaja = 0;
    let opex = 0;
    let totalPagadoAndres = 0;
    (expenses || []).forEach(e => {
      if (e.type === 'ingreso') {
        localSaldoCaja += e.amount;
      } else {
        localSaldoCaja -= e.amount;
        if (normalizarTexto(e.provider) !== 'andres' && !e.concept?.toLowerCase().includes('ajuste')) {
          if (isMonthMatch(e.date)) opex += e.amount;
        }
      }
      
      if (normalizarTexto(e.provider) === 'andres') {
        if (e.type === 'egreso') totalPagadoAndres += e.amount;
        else totalPagadoAndres -= e.amount; // devolucion
      }
    });

    let totalPurchasesCost = 0;
    (purchases || []).forEach(p => {
      if (normalizarTexto(p.provider) !== 'andres') return;
      totalPurchasesCost += (p.receivedKilos ?? 0) * (p.pricePerKg || cfg.costPricePerKg);
    });
    const deudaHistorica = typeof cfg.historicalDebtAndres === 'number' ? cfg.historicalDebtAndres : -102670.27;
    const deudaAndres = totalPagadoAndres - totalPurchasesCost + deudaHistorica; // Negativo = Deuda

    const transito = round2(porRecibir.reduce((acc: number, r: any) => acc + r.net, 0));
    const proyeccionFlujo = localSaldoCaja + transito + deudaAndres; 

    // Ajustar KPIs si hay filtro de mes activo
    let liveVentas = effectiveNetoTotal;
    const liveKilosTotal = effectiveTotalKilos;
    const liveFacturasEmitidas = effectiveFacturasEmitidas;
    if (monthFilter !== 'ALL' && mesesObjEffective[monthFilter]) {
      liveGananciaRealizada = mesesObjEffective[monthFilter].gananciaRealizada || 0;
      liveMargenTotal = mesesObjEffective[monthFilter].margen || 0;
      liveVentas = mesesObjEffective[monthFilter].venta || 0;
    }
    
    const utilidadNeta = liveGananciaRealizada - opex;

    return {
      ...kpis,
      totalKilos: effectiveTotalKilos,
      totalVendido: round2(effectiveTotalVendido),
      netoTotal: round2(effectiveNetoTotal),
      cobrado: round2(effectiveCobrado),
      netoCobrado: round2(effectiveNetoCobrado),
      porCobrar: round2(effectivePorCobrar),
      porCobrarConCR: round2(effectivePorCobrarConCR),
      porCobrarSinCR: round2(effectivePorCobrarSinCR),
      vencido: round2(effectiveVencido),
      ventasTotal: round2(liveVentas),
      kilosTotal: liveKilosTotal,
      facturasEmitidas: liveFacturasEmitidas,
      periodText,
      margenTotal: round2(liveMargenTotal),
      gananciaRealizadaTotal: round2(liveGananciaRealizada),
      porRecibir,
      totalPorRecibir: round2(porRecibir.reduce((acc: number, r: any) => acc + r.net, 0)),
      pending: { length: effectivePendingOrders },
      pedidoPendiente: { length: effectivePedidoOrders },
      overdue: { length: effectiveOverdueOrders },
      review: { length: effectiveManualReview },
      totalOrders: effectiveTotalOrders,
      meses: mesesObjEffective,
      mesesKeys,
      maxMes,
      criticos30,
      urgentes15,
      recientes1,
      vencidas,
      proximas,
      deudaTotalProvidencia,
      comisionContable,
      dineroRealARecibir,
      kilosPendientesFacturar,
      valorPendienteFacturar,
      proyeccion7d,
      proyeccion15d,
      inventarioVivo: round2(inventarioVivo),
      localSaldoCaja: round2(localSaldoCaja),
      deudaAndres: round2(deudaAndres),
      proyeccionFlujo: round2(proyeccionFlujo),
      opex: round2(opex),
      utilidadNeta: round2(utilidadNeta)
    };
  }, [statsDoc, activeOrders, monthFilter, config, purchases, expenses, allDepartmentOrders, deptFilter]);
}
