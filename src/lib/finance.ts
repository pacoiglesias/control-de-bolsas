import type { PurchaseOrder, Invoice, Delivery, OrderStatus, FinancialConfig, AndresRequirement, NextActionInfo } from './types';
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

/**
 * Determina si una factura individual pertenece a un departamento (TH o GT).
 */
export function invoiceMatchesDepartment(inv: any, order: PurchaseOrder | any, targetDept: string): boolean {
  if (!targetDept || targetDept === 'ALL') return true;
  if (!inv) return false;
  const target = targetDept.trim().toUpperCase();

  // 1. Campo explícito en la factura
  if (inv.department && typeof inv.department === 'string') {
    const d = inv.department.trim().toUpperCase();
    if (d === target) return true;
    if (d && d !== target) return false;
  }

  // 2. Contrarecibo asignado a la factura
  const invCr = (inv.collection?.contrareciboNumber || '').trim().toUpperCase();
  if (invCr.startsWith(target + '-') || invCr.startsWith(target) || invCr.includes(target)) return true;
  if (invCr.startsWith('TH-') || invCr.startsWith('GT-')) {
    return false;
  }

  // 3. Folio de la factura
  const invFolio = (inv.folio || '').trim().toUpperCase();
  if (invFolio.startsWith(target + '-') || invFolio.startsWith(target)) return true;

  // 4. Contrarecibo a nivel de orden
  const orderCr = (order?.collection?.contrareciboNumber || '').trim().toUpperCase();
  if (orderCr.startsWith(target + '-') || orderCr.startsWith(target) || orderCr.includes(target)) return true;
  if (orderCr.startsWith('TH-') || orderCr.startsWith('GT-')) {
    return false;
  }

  // 5. Departamento explícito en la orden
  if (order?.department && typeof order.department === 'string') {
    const d = order.department.trim().toUpperCase();
    if (d === target) return true;
    if (d && d !== target) return false;
  }

  // 6. Nombre del cliente en la orden
  const clientStr = (order?.client || '').trim().toUpperCase();
  if (clientStr.includes(`- ${target}`) || clientStr.includes(` ${target}`) || clientStr.endsWith(target)) return true;
  if (clientStr.includes('- TH') || clientStr.includes('- GT')) return false;

  // 7. Folio o OC de la orden
  const ocStr = (order?.oc || order?.folio || '').trim().toUpperCase();
  if (ocStr.startsWith(target + '-') || ocStr.startsWith(target)) return true;

  return false;
}

/**
 * Filtra una orden de compra para un departamento específico:
 * - Si targetDept es 'ALL', retorna la orden intacta.
 * - Si targetDept es 'TH' o 'GT', filtra su arreglo de `invoices` para incluir ÚNICAMENTE
 *   las facturas que pertenecen a ese departamento.
 * - Si no tiene facturas pero la orden es de ese depto (ej. pedido nuevo), la conserva.
 * - Si no tiene facturas y no coincide con el depto, retorna null.
 */
export function filterOrderByDepartment(o: PurchaseOrder | any, targetDept: string): PurchaseOrder | null {
  if (!targetDept || targetDept === 'ALL') return o;
  if (!o) return null;

  const target = targetDept.trim().toUpperCase();

  // Si tiene facturas, filtramos únicamente las facturas de este departamento
  if (Array.isArray(o.invoices) && o.invoices.length > 0) {
    const matchingInvoices = o.invoices.filter((inv: any) => invoiceMatchesDepartment(inv, o, target));
    if (matchingInvoices.length > 0) {
      const filteredKilos = matchingInvoices.reduce((acc: number, inv: any) => acc + (inv.kilos || 0), 0);
      return {
        ...o,
        department: target,
        totalKilograms: filteredKilos > 0 ? filteredKilos : o.totalKilograms,
        invoices: matchingInvoices,
        invoiceStatuses: matchingInvoices.map((inv: any) => inv.creditCycle?.status || 'pending'),
      };
    }
  }

  // Si no tiene facturas, verificamos si la orden misma pertenece al departamento
  if ((!o.invoices || o.invoices.length === 0) && orderMatchesDepartment(o, target)) {
    return {
      ...o,
      department: target,
    };
  }

  return null;
}

/**
 * Determina de forma inteligente si una orden pertenece a un departamento específico (ej. TH o GT).
 * Analiza el campo explícito `department`, prefijos en contrarecibos (ej. TH-912, GT-742),
 * sufijos en nombre de cliente (ej. "Providencia - TH"), y folios de OC.
 */
export function orderMatchesDepartment(o: PurchaseOrder | any, targetDept: string): boolean {
  if (!targetDept || targetDept === 'ALL') return true;
  if (!o) return false;
  const target = targetDept.trim().toUpperCase();

  // 1. Campo explícito en la orden
  if (o.department && typeof o.department === 'string') {
    const d = o.department.trim().toUpperCase();
    if (d === target) return true;
    if (d && d !== target) return false;
  }

  // 2. Facturas de la orden
  if (Array.isArray(o.invoices) && o.invoices.length > 0) {
    return o.invoices.some((inv: any) => invoiceMatchesDepartment(inv, o, target));
  }

  // 3. Contrarecibos a nivel de orden
  const orderCr = (o.collection?.contrareciboNumber || '').trim().toUpperCase();
  if (orderCr.startsWith(target + '-') || orderCr.startsWith(target) || orderCr.includes(target)) return true;
  if (orderCr.startsWith('TH-') || orderCr.startsWith('GT-')) return false;

  // 4. Nombre del cliente (ej. "Providencia - TH" o "Providencia GT")
  const clientStr = (o.client || '').trim().toUpperCase();
  if (clientStr.includes(`- ${target}`) || clientStr.includes(` ${target}`) || clientStr.endsWith(target)) return true;
  if (clientStr.includes('- TH') || clientStr.includes('- GT')) return false;

  // 5. Folio o número de OC
  const ocStr = (o.oc || o.folio || '').trim().toUpperCase();
  if (ocStr.startsWith(target + '-') || ocStr.startsWith(target) || ocStr.includes(`-${target}-`)) return true;

  return false;
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

export function computeAndresRequirement(order: PurchaseOrder, config: FinancialConfig): AndresRequirement {
  const items = order.items && order.items.length > 0 ? order.items : [];
  const itemsKilos = items.reduce((a, it) => a + (Number(it.quantity) || 0), 0);
  const kilos = itemsKilos > 0 ? itemsKilos : (Number(order.totalKilograms) || 0);

  const costPricePerKg = Number(order.customCostPrice ?? config?.costPricePerKg ?? 42);
  const salePricePerKg = Number(order.customSellPrice ?? config?.salePricePerKg ?? 43);

  const costTotal = round2(new Decimal(kilos).times(costPricePerKg).toNumber());
  const saleTotal = round2(new Decimal(kilos).times(salePricePerKg).toNumber());
  const ivaRate = config?.ivaRate ?? 0.16;
  const invoiceTotal = round2(new Decimal(saleTotal).times(1 + ivaRate).toNumber());

  const netProfitEst = round2(new Decimal(saleTotal).minus(costTotal).toNumber());
  const profitPerKg = round2(new Decimal(salePricePerKg).minus(costPricePerKg).toNumber());

  const folio = order.folio || order.oc || 'S/F';
  const client = order.client || 'Providencia';

  const itemsText = items.length > 0
    ? items.map(it => `• ${it.quantity} ${it.unit || 'kg'} - ${it.description || 'Bolsa'}`).join('\n')
    : `• ${kilos.toLocaleString('es-MX')} kg de bolsa polietileno`;

  const whatsappMessage = 
`Hola Andrés, te paso pedido de la OC ${folio} (${client}):
${itemsText}
Total: ${kilos.toLocaleString('es-MX')} kg
Costo pactado: $${costPricePerKg.toFixed(2)}/kg (Total: $${costTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })})
Favor de entregar directamente en la planta de ${client} y compartirnos la remisión. Gracias!`;

  return {
    orderId: order.id,
    folio,
    client,
    kilos,
    costPricePerKg,
    costTotal,
    salePricePerKg,
    saleTotal,
    invoiceTotal,
    commissionEst: 0,
    netProfitEst,
    profitPerKg,
    items,
    whatsappMessage,
  };
}

export function getSuggestedNextAction(order: PurchaseOrder, _config?: FinancialConfig): NextActionInfo {
  const deliveries = order.deliveries || [];
  const rawInvoices = order.invoices || [];
  const summary = getOrderSummary(order);
  const totalKilos = Number(order.totalKilograms) || 0;
  const kilosEntregados = deliveries.length > 0 ? summary.kilosDelivered : 0;
  const kilosFacturados = rawInvoices.length > 0 ? summary.kilosInvoiced : 0;
  const invoices = summary.invoices;

  const folio = order.folio || order.oc || 'S/F';
  const client = order.client || 'Providencia';

  // 1. Si no hay entregas registradas y no hay facturas: pedir a Andrés
  if (deliveries.length === 0 && rawInvoices.length === 0) {
    return {
      key: 'pedir_andres',
      title: 'Pedir Material a Andrés',
      description: `Genera el requerimiento y envía el pedido de ${totalKilos.toLocaleString('es-MX')} kg a Andrés.`,
      actionLabel: 'Ver Pedido a Andrés',
      badgeTone: 'info',
      targetTab: 'andres',
      whatsappType: 'andres',
      whatsappText: `Hola Andrés, te paso pedido de OC ${folio} (${client}) por ${totalKilos.toLocaleString('es-MX')} kg.`,
    };
  }



  // 2. Si hay entregas pero faltan por facturar
  if (kilosEntregados > kilosFacturados + 0.01) {
    const porFacturar = round2(kilosEntregados - kilosFacturados);
    return {
      key: 'facturar_entrega',
      title: 'Facturar Entregas de Andrés',
      description: `Andrés ya entregó ${porFacturar.toLocaleString('es-MX')} kg en Providencia pendientes de facturar.`,
      actionLabel: '⚡ Facturar Ahora',
      badgeTone: 'warn',
      targetTab: 'facturas',
    };
  }

  // 3. Si hay facturas emitidas pero sin contrarecibo
  const invSinCr = invoices.find(i => (i.creditCycle.status === 'facturado' || i.creditCycle.status === 'pending') && !i.collection?.contrareciboNumber?.trim());
  if (invSinCr) {
    return {
      key: 'pedir_contrarecibo',
      title: 'Solicitar Contrarecibo a Providencia',
      description: `Factura #${invSinCr.folio || 'S/F'} emitida. Solicitar número de contrarecibo a Providencia.`,
      actionLabel: 'Capturar Contrarecibo',
      badgeTone: 'warn',
      targetTab: 'facturas',
      whatsappType: 'providencia',
      whatsappText: `Buenas tardes, envío factura #${invSinCr.folio || ''} de la OC ${folio}. ¿Me apoyan con su número de contrarecibo?`,
    };
  }

  // 4. Si hay contrarecibos vencidos
  const invVencida = invoices.find(i => i.creditCycle.status === 'overdue');
  if (invVencida) {
    const cr = invVencida.collection?.contrareciboNumber || invVencida.folio || '';
    const saldo = (invVencida.financials?.invoiceTotal || 0) - (invVencida.collection?.paidAmount || 0);
    return {
      key: 'avisar_contador',
      title: 'Contrarecibo Vencido',
      description: `Contrarecibo ${cr} vencido por $${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}. Gestionar cobro con el contador.`,
      actionLabel: 'Avisar al Contador',
      badgeTone: 'bad',
      targetTab: 'facturas',
      whatsappType: 'contador',
      whatsappText: `Hola Contador, el contrarecibo ${cr} de la OC ${folio} ($${saldo.toFixed(2)}) ya venció. ¿Cuándo se programa el pago?`,
    };
  }

  // 5. Si el cliente ya pagó y está con el contador listo para recibir a caja
  const invPaid = invoices.find(i => i.creditCycle.status === 'paid');
  if (invPaid) {
    const total = invPaid.financials?.invoiceTotal || 0;
    const comm = invPaid.financials?.commission || round2(total * 0.08);
    const neto = round2(total - comm);
    return {
      key: 'recibir_caja',
      title: 'Cobro Listo con el Contador',
      description: `El cliente ya pagó. Recibir $${neto.toLocaleString('es-MX', { minimumFractionDigits: 2 })} netos a Caja Chica.`,
      actionLabel: '💵 Recibir → CAJA',
      badgeTone: 'ok',
      targetTab: 'facturas',
    };
  }

  // 6. Si todo está entregado y cobrado
  if (summary.status === 'collected' || (kilosEntregados >= totalKilos - 0.01 && invoices.length > 0 && invoices.every(i => i.creditCycle.status === 'collected'))) {
    return {
      key: 'completada',
      title: 'Orden Completada y Cobrada',
      description: 'Esta orden fue entregada, facturada y cobrada al 100%.',
      badgeTone: 'ok',
      targetTab: 'resumen',
    };
  }

  return {
    key: 'esperar_entrega',
    title: 'Esperando Entrega de Andrés',
    description: `Pedido en curso. Andrés debe entregar ${totalKilos.toLocaleString('es-MX')} kg en Providencia.`,
    actionLabel: 'Registrar Entrega',
    badgeTone: 'info',
    targetTab: 'entregas',
  };
}


