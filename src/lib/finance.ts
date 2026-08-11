import type { PurchaseOrder, Invoice, Delivery, OrderStatus } from './types';
import Decimal from 'decimal.js-light';

/**
 * La formula vive en un solo lugar: functions/src/shared/finance.core.ts, que
 * importan tanto el frontend como las Cloud Functions. Antes estaba duplicada
 * en ambos lados con el comentario "si cambias una, cambia la otra", y la
 * duplicacion ya habia empezado a divergir.
 *
 * Se reexporta desde aqui para que nada del frontend tenga que conocer esa
 * ruta y todos los imports existentes sigan funcionando igual.
 */
import { round2, computeCommissionFromInvoiceTotal } from '../../functions/src/shared/finance.core';

export {
  computeFinancials,
  computeDynamicFinancials,
  computeCommissionFromInvoiceTotal,
  configEfectiva,
  round2,
} from '../../functions/src/shared/finance.core';
export type {
  FinanceConfigCore,
  FinanceResultCore,
  DynamicFinancialsInput,
  DynamicFinancialsResult,
} from '../../functions/src/shared/finance.core';

export function extractCr(inv: any, o?: any): string {
  let cr = (inv?.collection?.contrareciboNumber || o?.collection?.contrareciboNumber || '').trim();
  if (!cr) {
    const f1 = (inv?.folio || '').trim().toUpperCase();
    const f2 = (o?.folio || '').trim().toUpperCase();
    if (f1.startsWith('TH-') || f1.startsWith('GT-')) cr = f1;
    else if (f2.startsWith('TH-') || f2.startsWith('GT-')) cr = f2;
  }
  return cr;
}

/**
 * Normaliza texto para comparaciones que no deben depender de acentos ni
 * mayusculas -- "Andres" vs "Andrés" son el mismo proveedor para cualquier
 * humano, pero como strings JS son distintos byte a byte. Sin esto, dos
 * partes del sistema que escriben el nombre de forma ligeramente distinta
 * (una con acento, otra sin) dejan de coincidir en los filtros — cada
 * pantalla termina sumando un subconjunto distinto de compras/gastos del
 * mismo proveedor real, con resultados que nunca cuadran entre si.
 */
export function normalizarTexto(s: string | null | undefined): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  
  // Evitar fines de semana: si cae sábado, pasar a lunes (+2 días)
  if (d.getDay() === 6) {
    d.setDate(d.getDate() + 2);
  } 
  // Si cae domingo, pasar a lunes (+1 día)
  else if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }
  
  return d;
}

/** Dias de atraso: positivo = vencida hace N dias, negativo = le faltan N dias. */
export function daysLate(due: Date | null | undefined): number | null {
  if (!due) return null;
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export const AGING_BUCKETS = [
  { key: 'current', label: 'Aun no vence' },
  { key: 'd30', label: '1 a 30 dias' },
  { key: 'd60', label: '31 a 60 dias' },
  { key: 'd90', label: '61 a 90 dias' },
  { key: 'd90p', label: 'Mas de 90 dias' },
] as const;

export type AgingKey = (typeof AGING_BUCKETS)[number]['key'];

export function agingBucket(due: Date | null | undefined): AgingKey {
  const d = daysLate(due);
  if (d === null || d <= 0) return 'current';
  if (d <= 30) return 'd30';
  if (d <= 60) return 'd60';
  if (d <= 90) return 'd90';
  return 'd90p';
}

export function getOrderSummary(o: PurchaseOrder) {
  const invoices: Invoice[] = o.invoices && o.invoices.length > 0 ? o.invoices : [];
  // Esta sintesis de factura es para expedientes VIEJOS migrados sin
  // trazabilidad de facturas, donde "tener folio" era la unica senal
  // disponible de que ya se habia facturado. Pero si el expediente tiene
  // ENTREGAS capturadas explicitamente, eso ya es una senal clara de que
  // el usuario esta usando el flujo normal (Productos -> Entregas ->
  // Facturas) y genuinamente no ha facturado todavia — sintetizar una
  // factura aqui lo marcaria como "FACTURADO" con kilos completos sin que
  // exista ninguna factura real, exactamente el caso de un expediente
  // recien capturado con "Pendiente de Facturar".
  const tieneEntregasExplicitas = (o.deliveries?.length || 0) > 0;
  if (invoices.length === 0 && !tieneEntregasExplicitas && (o.folio || (o.financials && o.financials.saleTotal && o.financials.saleTotal > 0))) {
    invoices.push({
      id: o.id + '-inv0',
      orderId: o.id,
      folio: o.folio,
      kilos: o.totalKilograms || 0,
      financials: o.financials,
      creditCycle: o.creditCycle || { status: 'pedido' },
      collection: o.collection
    });
  }

  const deliveries: Delivery[] = o.deliveries && o.deliveries.length > 0 ? o.deliveries : [];
  // Si no hay entregas, no asumimos que entregaron los kilos pedidos. Asumimos como minimo lo facturado.
  if (deliveries.length === 0 && invoices.length > 0) {
    const fallbackKilos = invoices.reduce((acc, i) => acc + (i.kilos || 0), 0);
    if (fallbackKilos > 0) {
      deliveries.push({
        id: o.id + '-del0',
        date: o.processedAt || null,
        kilos: fallbackKilos
      });
    }
  }

  const kilosDelivered = round2(deliveries.reduce((a, d) => {
    if (d.items && d.items.length > 0) {
      return a + d.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    }
    return a + Number(d.kilos || 0);
  }, 0));
  
  let kilosInvoiced = new Decimal(0), invoiceTotal = new Decimal(0), saleTotal = new Decimal(0), commission = new Decimal(0), netCashFlow = new Decimal(0), paidAmount = new Decimal(0);
  let tradeMargin = new Decimal(0), realizedProfit = new Decimal(0);
  let hasOverdue = false, hasManual = false, hasPending = false, hasFacturado = false, allPaid = true, allPedido = true;
  let hasCollected = false;
  let maxDaysLate: number | null = null;

  for (const i of invoices) {
    kilosInvoiced = kilosInvoiced.plus(Number(i.kilos || 0));
    invoiceTotal = invoiceTotal.plus(i.financials?.invoiceTotal || 0);
    saleTotal = saleTotal.plus(i.financials?.saleTotal || 0);
    commission = commission.plus(i.financials?.commission || 0);
    netCashFlow = netCashFlow.plus(i.financials?.netCashFlow || 0);
    paidAmount = paidAmount.plus(i.collection?.paidAmount || 0);
    
    // El margen se calcula SIEMPRE. Antes estaba condicionado a que la orden
    // tuviera un costo capturado a mano (`customCostPrice`), asi que cualquier
    // expediente que usara el costo de la configuracion reportaba margen CERO.
    // Resultado: "Ganancia Comercial" salia en $0.00 salvo que se escribiera
    // el costo manualmente en cada orden. computeFinancials ya resuelve el
    // costo efectivo (override si existe, configuracion si no), asi que
    // tradeMargin siempre trae un valor correcto.
    const invMargin = i.financials?.tradeMargin ?? 0;
    tradeMargin = tradeMargin.plus(invMargin);

    // Ganancia por cobros: si pagaron algo, la proporcion pagada de (Margen - Comision).
    const invTotal = i.financials?.invoiceTotal || 0;
    const invPaid = i.collection?.paidAmount || 0;
    if (invTotal > 0 && invPaid > 0) {
      const invCommission = i.financials?.commission || 0;
      const proportion = new Decimal(invPaid).dividedBy(invTotal);
      const profitForThisInvoice = new Decimal(invMargin).minus(invCommission);
      realizedProfit = realizedProfit.plus(proportion.times(profitForThisInvoice));
    }

    const s = i.creditCycle.status;
    if (s === 'overdue') hasOverdue = true;
    if (s === 'manual_review') hasManual = true;
    if (s === 'pending') hasPending = true;
    if (s === 'facturado') hasFacturado = true;
    if (s === 'collected') hasCollected = true;
    if (s !== 'paid' && s !== 'collected') allPaid = false;
    if (s !== 'pedido') allPedido = false;

    if (s === 'pending' || s === 'overdue') {
      let dDate: Date | null = null;
      if (i.creditCycle.dueDate) {
        dDate = (i.creditCycle.dueDate as any).toDate ? (i.creditCycle.dueDate as any).toDate() : new Date(i.creditCycle.dueDate as any);
      }
      const d = daysLate(dDate);
      if (d !== null) {
        if (maxDaysLate === null || d > maxDaysLate) {
          maxDaysLate = d;
        }
      }
    }
  }

  let status: OrderStatus = o.creditCycle?.status ?? 'pedido';
  // isClosedShort se puede activar SIN que exista todavia ninguna factura
  // (el aviso automatico de "completaste la entrega, ¿cerrar?" dispara
  // cuando el expediente sigue en estatus 'pedido', sin invoices). El
  // bloque de abajo solo corre si invoices.length > 0, asi que sin esta
  // linea, cerrar un expediente sin facturar dejaba la promesa de la
  // ventana de confirmacion ("deja de aparecer como pendiente") sin
  // cumplirse: el estatus se quedaba en 'pedido' para siempre.
  if (o.isClosedShort && status === 'pedido') status = 'facturado';
  if (invoices.length > 0) {
    if (hasOverdue) status = 'overdue';
    else if (hasManual) status = 'manual_review';
    else if (hasPending) status = 'pending';
    else if (hasFacturado) status = 'facturado';
    else if (allPaid) {
      if (kilosInvoiced.toNumber() < (o.totalKilograms || 0) && !o.isClosedShort) status = 'pending';
      else status = hasCollected ? 'collected' : 'paid';
    } else if (allPedido) {
      if (o.isClosedShort) status = 'facturado'; // Caso raro: SI tiene facturas, pero todas siguen en estatus 'pedido'
      else status = 'pedido';
    }
  }

  return {
    invoices,
    deliveries,
    kilosDelivered,
    kilosInvoiced: round2(kilosInvoiced.toNumber()),
    invoiceTotal: round2(invoiceTotal.toNumber()),
    saleTotal: round2(saleTotal.toNumber()),
    commission: round2(commission.toNumber()),
    netCashFlow: round2(netCashFlow.toNumber()),
    tradeMargin: round2(tradeMargin.toNumber()),
    realizedProfit: round2(realizedProfit.toNumber()),
    paidAmount: round2(paidAmount.toNumber()),
    status,
    maxDaysLate
  };
}

export interface PorRecibirItem {
  orderId: string;
  invoiceId: string;
  folio: string;
  cr: string;
  invoiceTotal: number;
  commission: number;
  net: number;
}

export function extractDashboardAlerts(activeOrders: PurchaseOrder[], avgDSO: number = 0, config?: any) {
  const vencidas: { o: PurchaseOrder; inv: Invoice; d: number }[] = [];
  const proximas: { o: PurchaseOrder; inv: Invoice; d: number }[] = [];
  const porRecibir: PorRecibirItem[] = [];
  let criticos30 = 0;
  let urgentes15 = 0;
  let recientes1 = 0;
  let proyeccion7d = new Decimal(0);
  let proyeccion15d = new Decimal(0);

  activeOrders.forEach(o => {
    const invoices = o.invoices || [];
    invoices.forEach(inv => {
      const s = inv.creditCycle.status;
      if (s === 'pending' || s === 'overdue') {
        let dDate: Date | null = null;
        if (inv.creditCycle.dueDate) {
          dDate = (inv.creditCycle.dueDate as any).toDate ? (inv.creditCycle.dueDate as any).toDate() : new Date(inv.creditCycle.dueDate as any);
        }
        const late = daysLate(dDate);
        if (late !== null) {
          if (late > 0) vencidas.push({ o, inv, d: late });
          else if (late >= -7) proximas.push({ o, inv, d: late });
        }
        if (late !== null && late > 30) criticos30++;
        else if (late !== null && late > 15) urgentes15++;
        else if (late !== null && late > 0) recientes1++;

        let predictiveLate = late;
        if (avgDSO > 0 && inv.collection?.contrareciboDate) {
          const crDate = (inv.collection.contrareciboDate as any).toDate ? (inv.collection.contrareciboDate as any).toDate() : new Date(inv.collection.contrareciboDate as any);
          const expectedPayDate = addDays(crDate, avgDSO);
          predictiveLate = daysLate(expectedPayDate);
        }

        if (predictiveLate !== null) {
          const saldo = new Decimal(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0).minus(inv.collection?.paidAmount ?? 0);
          // Si ya venció o vence en próximos 7 días
          if (predictiveLate >= -7) proyeccion7d = proyeccion7d.plus(saldo);
          // Si ya venció o vence en próximos 15 días
          if (predictiveLate >= -15) proyeccion15d = proyeccion15d.plus(saldo);
        }
      }
      if (s === 'paid') {
        const invoiceTotal = Number(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
        // inv.financials.commission es un valor guardado (snapshot) del
        // momento en que se capturo la factura -- para facturas importadas
        // por XML (como estas dos), ese campo nunca se lleno y quedaba en
        // $0.00 de comision, aunque la comision real siga aplicando. Si no
        // hay valor guardado, se calcula en vivo con la tasa configurada.
        const storedCommission = Number(inv.financials?.commission ?? 0);
        const commission = storedCommission > 0 || !config
          ? storedCommission
          : computeCommissionFromInvoiceTotal(invoiceTotal, config);
        porRecibir.push({
          orderId: o.id,
          invoiceId: inv.id,
          folio: inv.folio ?? '—',
          cr: inv.collection?.contrareciboNumber || '—',
          invoiceTotal,
          commission,
          net: round2(invoiceTotal - commission),
        });
      }
    });
  });

  return { vencidas, proximas, criticos30, urgentes15, recientes1, porRecibir, proyeccion7d: proyeccion7d.toNumber(), proyeccion15d: proyeccion15d.toNumber() };
}

export function calculateLiveMargenTotal(activeOrders: PurchaseOrder[], defaultCostPricePerKg: number): number {
  let liveMargenTotal = new Decimal(0);
  activeOrders.forEach(o => {
    (o.invoices || []).forEach(inv => {
      const invTotal = Number(inv.financials?.saleTotal ?? inv.financials?.invoiceTotal ?? 0);
      const comm = Number(inv.financials?.commission ?? 0);
      const matCost = Number(inv.financials?.costTotal ?? new Decimal(inv.kilos).times(defaultCostPricePerKg).toNumber());
      liveMargenTotal = liveMargenTotal.plus(invTotal).minus(matCost).minus(comm);
    });
  });
  return round2(liveMargenTotal.toNumber());
}

