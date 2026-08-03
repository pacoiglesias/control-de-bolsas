import { useMemo } from 'react';
import { round2, computeCommissionFromInvoiceTotal, extractDashboardAlerts, calculateLiveMargenTotal } from '../lib/finance';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from '../lib/types';

export function useDashboardStats(
  statsDoc: any, 
  activeOrders: PurchaseOrder[], 
  monthFilter: string, 
  config: FinancialConfig, 
  purchases: Purchase[], 
  expenses: Expense[]
) {
  return useMemo(() => {
    const st = statsDoc || {};
    const kpis = st.kpis || { totalKilos: 0, totalVendido: 0, netoTotal: 0, margenTotal: 0, gananciaRealizadaTotal: 0, porCobrar: 0, porCobrarSinCR: 0, porCobrarConCR: 0, vencido: 0, cobrado: 0, netoCobrado: 0, porRecibir: 0, montoPendienteFacturar: 0 };
    const counters = st.counters || { pendingOrders: 0, overdueOrders: 0, manualReview: 0, totalOrders: 0, pedidoOrders: 0, paymentDaysCount: 0 };
    const mesesObj = st.histograms || {};

    const mesesKeys = Object.keys(mesesObj).sort().slice(-6);
    const maxMes = mesesKeys.length > 0 ? Math.max(1, ...mesesKeys.map((m) => mesesObj[m].venta)) : 1;

    const avgDSO = counters.paymentDaysCount > 0 ? (kpis.paymentDaysSum || 0) / counters.paymentDaysCount : 0;
    const alerts = extractDashboardAlerts(activeOrders, avgDSO);
    const vencidas = alerts.vencidas;
    const proximas = alerts.proximas;
    const porRecibir = alerts.porRecibir;
    const criticos30 = alerts.criticos30;
    const urgentes15 = alerts.urgentes15;
    const recientes1 = alerts.recientes1;
    const proyeccion7d = alerts.proyeccion7d;
    const proyeccion15d = alerts.proyeccion15d;

    // Respaldo en vivo, SOLO para el indicador que de verdad esta en cero.
    let liveMargenTotal = kpis.margenTotal || 0;

    if (kpis.margenTotal === 0) {
      liveMargenTotal = calculateLiveMargenTotal(activeOrders, config.costPricePerKg);
    }

    // Ganancia por Cobros NO tiene respaldo en vivo: la consulta de
    // activeOrders excluye a proposito el estatus 'collected' (mas abajo),
    // asi que un recalculo en el navegador nunca veria las facturas que mas
    // importan para este indicador. Se confia siempre en el agregado del
    // servidor, que si recorre todos los expedientes.
    let liveGananciaRealizada = kpis.gananciaRealizadaTotal || 0;

    const deudaTotalProvidencia = (kpis.porCobrar || 0) + (kpis.montoPendienteFacturar || 0);
    const comisionContable = computeCommissionFromInvoiceTotal(deudaTotalProvidencia, config as any);
    const dineroRealARecibir = deudaTotalProvidencia - comisionContable;

    // Calcular Remisiones (Kilos entregados - Kilos facturados)
    let totalKilosDelivered = 0;
    let totalKilosInvoiced = 0;
    activeOrders.forEach(o => {
      const deliveries = o.deliveries || [];
      const invoices = o.invoices || [];
      let oDel = 0, oInv = 0;
      deliveries.forEach((d: any) => oDel += (d.kilos || 0));
      invoices.forEach((i: any) => oInv += (i.kilos || 0));
      totalKilosDelivered += oDel;
      totalKilosInvoiced += oInv;
    });
    const kilosPendientesFacturar = Math.max(0, totalKilosDelivered - totalKilosInvoiced);
    const valorPendienteFacturar = kilosPendientesFacturar * (config.costPricePerKg || 42);


    const allMeses = Object.keys(mesesObj).sort();
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
    (purchases || []).forEach(p => totalReceivedKilos += (p.receivedKilos || 0));
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
           if (e.provider?.toLowerCase() !== 'andrés' && !e.concept?.toLowerCase().includes('ajuste')) {
               if (isMonthMatch(e.date)) opex += e.amount;
           }
        }
        
        if (e.provider?.toLowerCase() === 'andrés') {
            if (e.type === 'egreso') totalPagadoAndres += e.amount;
            else totalPagadoAndres -= e.amount; // devolucion
        }
    });

    let totalPurchasesCost = 0;
    (purchases || []).forEach(p => {
      totalPurchasesCost += (p.receivedKilos ?? 0) * (p.pricePerKg || config.costPricePerKg || 42);
    });
    const deudaHistorica = config.historicalDebtAndres || 0;
    const deudaAndres = totalPagadoAndres - totalPurchasesCost + deudaHistorica; // Negativo = Deuda

    const transito = round2(porRecibir.reduce((acc: number, r: any) => acc + r.net, 0));
    const proyeccionFlujo = localSaldoCaja + transito + deudaAndres; 

    // Adjust global KPIs if month filter is active
    let liveVentas = kpis.netoTotal || 0;
    const liveKilosTotal = kpis.totalKilos || 0;
    const liveFacturasEmitidas = kpis.facturasEmitidas || 0;
    if (monthFilter !== 'ALL' && mesesObj[monthFilter]) {
       liveGananciaRealizada = mesesObj[monthFilter].gananciaRealizada || 0;
       liveMargenTotal = mesesObj[monthFilter].margen || 0;
       liveVentas = mesesObj[monthFilter].venta || 0;
    }
    
    const utilidadNeta = liveGananciaRealizada - opex;

    return {
      ...kpis,
      ventasTotal: round2(liveVentas),
      kilosTotal: liveKilosTotal,
      facturasEmitidas: liveFacturasEmitidas,
      periodText,
      margenTotal: round2(liveMargenTotal),
      gananciaRealizadaTotal: round2(liveGananciaRealizada),
      porRecibir,
      totalPorRecibir: round2(porRecibir.reduce((acc: number, r: any) => acc + r.net, 0)),
      pending: { length: counters.pendingOrders },
      pedidoPendiente: { length: counters.pedidoOrders },
      overdue: { length: counters.overdueOrders },
      review: { length: counters.manualReview },
      totalOrders: counters.totalOrders,
      meses: mesesObj,
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
  }, [statsDoc, activeOrders, monthFilter, config, purchases, expenses]);
}
