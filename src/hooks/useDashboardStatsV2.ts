import { useMemo } from 'react';
import { round2, computeCommissionFromInvoiceTotal, normalizarTexto, computeAndresBalance } from '../lib/finance';
import { toDate } from '../lib/format';
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
    // FIX (encontrado en vivo: "Saldo con Andrés" del Dashboard decía
    // -$1,289,709.62 mientras que Compras -> Andrés, para el MISMO dato,
    // decía +$40,800.00 -- una diferencia de $1,330,509.62 dentro de la
    // misma sesión de la misma app). Causa: este objeto "cfg" local se
    // arma copiando campo por campo desde el config real, y se le olvidó
    // copiar "historicalDebtAndres" -- así que el cálculo de más abajo
    // siempre caía en un respaldo fijo (-$102,670.27, la calibración
    // vieja) sin importar que Configuración ya tuviera un valor real y
    // más reciente ($1,227,839.35). Compras/useAndresStats.ts SÍ lee el
    // valor real (config?.historicalDebtAndres || 0) -- ahora este hook
    // hace exactamente lo mismo, para que ambas pantallas muestren el
    // mismo número siempre.
    const cfg: FinancialConfig = {
      salePricePerKg: config?.salePricePerKg || 43,
      costPricePerKg: config?.costPricePerKg || 42,
      commissionRate: typeof config?.commissionRate === 'number' ? config.commissionRate : 0.08,
      commissionBase: config?.commissionBase || 'subtotal',
      ivaRate: typeof config?.ivaRate === 'number' ? config.ivaRate : 0.16,
      creditDays: config?.creditDays || 30,
      companyName: config?.companyName || 'Bolsas Elemental / Providencia',
      historicalDebtAndres: config?.historicalDebtAndres || 0,
    };

    const deptOrders = (allDepartmentOrders || activeOrders || []).filter(o => {
      if (!o) return false;
      if (!deptFilter || deptFilter === 'ALL') return true;
      const client = (o.client || '').toLowerCase();
      const folio = (o.folio || o.oc || '').toLowerCase();
      const cr = (o.collection?.contrareciboNumber || o.invoices?.[0]?.collection?.contrareciboNumber || '').toLowerCase();
      
      if (deptFilter === 'TH') {
        if (cr.startsWith('th-')) return true;
        if (cr.startsWith('gt-')) return false;
        if (folio.startsWith('th-')) return true;
        if (folio.startsWith('gt-')) return false;
        return client.includes('nava') || client.includes('textil hogar') || (client.includes('providencia') && !client.includes('evelia') && !client.includes('grupo textil'));
      }
      if (deptFilter === 'GT') {
        if (cr.startsWith('gt-')) return true;
        if (cr.startsWith('th-')) return false;
        if (folio.startsWith('gt-')) return true;
        if (folio.startsWith('th-')) return false;
        return client.includes('evelia') || client.includes('grupo textil');
      }
      return true;
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

    // FIX (auditoría v8.9.5): esta misma fórmula (kilos/costo/pagado/saldo)
    // vivía copiada aquí, en useAndresStats.ts y en el handler de ledger del
    // Portal Maquilador (functions/src/index.ts) -- la misma clase de bug
    // que causó el incidente real del "Saldo con Andrés" ($1.3M de
    // diferencia entre este Dashboard y Compras -> Andrés, para el mismo
    // dato). Ahora las tres llaman a computeAndresBalance(), la fuente
    // única de verdad (ver finance.core.ts).
    const andresBalance = computeAndresBalance(
      purchases,
      expenses,
      { costPricePerKg: cfg.costPricePerKg, historicalDebtAndres: cfg.historicalDebtAndres },
      'andres',
    );
    const totalReceivedKilos = andresBalance.totalReceivedKilos;
    const inventarioVivo = totalReceivedKilos - totalKilosInvoiced;

    let localSaldoCaja = 0;
    let opex = 0;
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
    });

    const deudaAndres = andresBalance.saldoProveedor;

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
      proyeccionFlujo: round2(proyeccionFlujo),
      opex: round2(opex),
      utilidadNeta: round2(utilidadNeta)
    };
  }, [statsDoc, activeOrders, monthFilter, config, purchases, expenses, allDepartmentOrders, deptFilter]);
}
