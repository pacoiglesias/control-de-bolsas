import { useMemo } from 'react';
import { round2, computeCommissionFromInvoiceTotal, normalizarTexto, orderMatchesDepartment } from '../lib/finance';
import { toDate } from '../lib/format';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from '../lib/types';
import { DEFAULT_CONFIG } from '../lib/types';

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
      salePricePerKg: config?.salePricePerKg ?? DEFAULT_CONFIG.salePricePerKg,
      costPricePerKg: config?.costPricePerKg ?? DEFAULT_CONFIG.costPricePerKg,
      commissionRate: typeof config?.commissionRate === 'number' ? config.commissionRate : 0.08,
      commissionBase: config?.commissionBase || 'subtotal',
      ivaRate: typeof config?.ivaRate === 'number' ? config.ivaRate : 0.16,
      creditDays: config?.creditDays || 30,
      companyName: config?.companyName || 'Bolsas Elemental / Providencia',
      historicalDebtAndres: config?.historicalDebtAndres,
    };

    const deptOrders = (allDepartmentOrders || activeOrders || []).filter(o => {
      if (!o) return false;
      if (!deptFilter || deptFilter === 'ALL') return true;
      return orderMatchesDepartment(o, deptFilter);
    });

    const kpis = statsDoc?.kpis || {};

    const effectiveTotalOrders = deptOrders.length;
    let effectivePendingOrders = 0;
    let effectivePedidoOrders = 0;
    let effectiveOverdueOrders = 0;
    let effectiveManualReview = 0;

    deptOrders.forEach(o => {
      if (!o) return;
      const st = o.creditCycle?.status || 'pedido';
      if (st === 'pending') effectivePendingOrders++;
      else if (st === 'pedido') effectivePedidoOrders++;
      else if (st === 'overdue') effectiveOverdueOrders++;
      else if (st === 'manual_review') effectiveManualReview++;
    });

    const mesesObjEffective: Record<string, any> = {};
    deptOrders.forEach(o => {
      if (!o) return;
      const dateObj = toDate(o.processedAt || (o as any).createdAt);
      if (!dateObj) return;
      const mKey = dateObj.toISOString().slice(0, 7);
      if (!mesesObjEffective[mKey]) {
        mesesObjEffective[mKey] = { kilos: 0, venta: 0, gananciaRealizada: 0, margen: 0 };
      }
      const sum = o.totalKilograms || 0;
      mesesObjEffective[mKey].kilos += sum;
      mesesObjEffective[mKey].venta += sum * cfg.salePricePerKg;
      mesesObjEffective[mKey].margen += sum * (cfg.salePricePerKg - cfg.costPricePerKg);
    });

    const mesesKeys = Object.keys(mesesObjEffective).sort();
    const maxMes = mesesKeys.length > 0 ? Math.max(...mesesKeys.map(k => mesesObjEffective[k].kilos || 0)) : 1;

    let effectiveTotalKilos = 0;
    let effectiveTotalVendido = 0;
    let effectiveNetoTotal = 0;
    let effectiveCobrado = 0;
    let effectiveNetoCobrado = 0;
    let effectiveGananciaRealizada = 0;

    deptOrders.forEach(o => {
      if (!o) return;
      const kg = Number(o.totalKilograms) || 0;
      effectiveTotalKilos += kg;
      const venta = kg * cfg.salePricePerKg;
      effectiveTotalVendido += venta;
      effectiveNetoTotal += venta;

      (o.invoices || []).forEach(inv => {
        if (!inv) return;
        const st = inv.creditCycle?.status;
        const invKg = Number(inv.kilos) || 0;
        const invSale = invKg * cfg.salePricePerKg;
        const invCost = invKg * cfg.costPricePerKg;
        const invComm = invSale * cfg.commissionRate;
        const invProfit = invSale - invCost - invComm;

        if (st === 'paid' || st === 'collected') {
          effectiveCobrado += inv.financials?.invoiceTotal ?? (invSale * (1 + cfg.ivaRate));
          effectiveNetoCobrado += invSale;
          effectiveGananciaRealizada += invProfit;
        }
      });
    });

    const porRecibir: any[] = [];
    const criticos30: any[] = [];
    const urgentes15: any[] = [];
    const recientes1: any[] = [];
    const vencidas: any[] = [];
    const proximas: any[] = [];

    let effectiveFacturasEmitidas = 0;
    deptOrders.forEach(o => {
      if (!o) return;
      (o.invoices || []).forEach(inv => {
        if (!inv) return;
        effectiveFacturasEmitidas++;
      });
    });

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
          const due = toDate(inv.creditCycle?.dueDate);
          const dueTime: number | null = due ? due.getTime() : null;
          if (dueTime && dueTime < now) {
            liveVencido += amt;
          }
        }
      });
    });

    const effectivePorCobrar = livePorCobrar;
    const effectivePorCobrarConCR = livePorCobrarConCR;
    const effectivePorCobrarSinCR = livePorCobrarSinCR;
    const effectiveVencido = liveVencido;

    let totalKilosDelivered = 0;
    let totalKilosInvoiced = 0;
    deptOrders.forEach(o => {
      if (!o) return;
      const deliveries = o.deliveries || [];
      const invoices = o.invoices || [];
      deliveries.forEach((d: any) => totalKilosDelivered += Number(d?.kilos) || 0);
      invoices.forEach((i: any) => totalKilosInvoiced += Number(i?.kilos) || 0);
    });
    const kilosPendientesFacturar = Math.max(0, totalKilosDelivered - totalKilosInvoiced);
    const valorPendienteFacturar = kilosPendientesFacturar * cfg.costPricePerKg;

    const deudaTotalProvidencia = effectivePorCobrar + (kpis.montoPendienteFacturar || 0);
    const comisionContable = computeCommissionFromInvoiceTotal(deudaTotalProvidencia, cfg);
    const dineroRealARecibir = deudaTotalProvidencia - comisionContable;

    let periodText = 'Acumulado de todo el historial, sin límite de fecha';
    if (monthFilter !== 'ALL') {
      const [yy, mm] = monthFilter.split('-');
      const date = new Date(parseInt(yy), parseInt(mm) - 1, 1);
      periodText = `Datos del mes de ${date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`;
    }

    let totalReceivedKilos = 0;
    (purchases || []).forEach(p => {
      if (!p || normalizarTexto(p.provider) !== 'andres') return;
      totalReceivedKilos += Number(p.receivedKilos) || 0;
    });
    const inventarioVivo = totalReceivedKilos - totalKilosInvoiced;

    let localSaldoCaja = 0;
    let opex = 0;
    let totalPagadoAndres = 0;
    (expenses || []).forEach(e => {
      if (!e) return;
      if (e.type === 'ingreso') {
        localSaldoCaja += Number(e.amount) || 0;
      } else {
        localSaldoCaja -= Number(e.amount) || 0;
        if (normalizarTexto(e.provider) !== 'andres' && !e.concept?.toLowerCase().includes('ajuste')) {
          opex += Number(e.amount) || 0;
        }
      }
      
      // SPRINT 1 FIX: usar isAndresPayment (campo explícito) cuando existe;
      // si no, caer al match de texto. Así los pagos nuevos son robustos y
      // los históricos siguen siendo detectados.
      const esAndres = e.isAndresPayment === true || normalizarTexto(e.provider) === 'andres';
      if (esAndres) {
        if (e.type === 'egreso') totalPagadoAndres += Number(e.amount) || 0;
        else totalPagadoAndres -= Number(e.amount) || 0;
      }

    });

    let totalPurchasesCost = 0;
    (purchases || []).forEach(p => {
      if (!p || normalizarTexto(p.provider) !== 'andres') return;
      totalPurchasesCost += (Number(p.receivedKilos) || 0) * (p.pricePerKg || cfg.costPricePerKg);
    });
    const deudaHistorica = typeof cfg.historicalDebtAndres === 'number' ? cfg.historicalDebtAndres : 82628.94;
    const deudaAndres = totalPagadoAndres - totalPurchasesCost + deudaHistorica;

    const transito = round2(porRecibir.reduce((acc: number, r: any) => acc + r.net, 0));
    const proyeccionFlujo = localSaldoCaja + transito + deudaAndres;
    const utilidadNeta = effectiveGananciaRealizada - opex;

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
      ventasTotal: round2(effectiveNetoTotal),
      kilosTotal: effectiveTotalKilos,
      facturasEmitidas: effectiveFacturasEmitidas,
      periodText,
      margenTotal: round2(effectiveTotalKilos * (cfg.salePricePerKg - cfg.costPricePerKg)),
      gananciaRealizadaTotal: round2(effectiveGananciaRealizada),
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
      proyeccion7d: 0,
      proyeccion15d: 0,
      inventarioVivo: round2(inventarioVivo),
      localSaldoCaja: round2(localSaldoCaja),
      deudaAndres: round2(deudaAndres),
      totalPagadoAndres: round2(totalPagadoAndres),
      totalPurchasesCost: round2(totalPurchasesCost),
      proyeccionFlujo: round2(proyeccionFlujo),
      opex: round2(opex),
      utilidadNeta: round2(utilidadNeta)
    };
  }, [statsDoc, activeOrders, monthFilter, config, purchases, expenses, allDepartmentOrders, deptFilter]);
}
