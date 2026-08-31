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
  computeAndresBalance,
  configEfectiva,
  round2,
  normalizarTexto,
} from '../../functions/src/shared/finance.core';
export type {
  FinanceConfigCore,
  FinanceResultCore,
  DynamicFinancialsInput,
  DynamicFinancialsResult,
} from '../../functions/src/shared/finance.core';

export function extractCr(
  inv?: Partial<Invoice> | Partial<PurchaseOrder> | Record<string, any> | null,
  o?: Partial<PurchaseOrder> | Record<string, any> | null
): string {
  // 1. Si se pasa una factura individual explícita
  if (inv && (inv.id !== o?.id || (inv as any).folio !== o?.folio || (inv as any).kilos !== undefined)) {
    const invCr = ((inv as any)?.collection?.contrareciboNumber || (inv as any)?.contrarecibo || '').trim();
    if (invCr) return invCr;
    const f1 = ((inv as any)?.folio || '').trim().toUpperCase();
    if (f1.startsWith('TH-') || f1.startsWith('GT-')) return f1;
    // Si la orden raíz no tiene array de facturas (documento legacy único), puede revisar la orden
    if (!o?.invoices || o.invoices.length <= 1) {
      const oCr = (o?.collection?.contrareciboNumber || (o as any)?.contrarecibo || '').trim();
      if (oCr) return oCr;
      const f2 = (o?.folio || '').trim().toUpperCase();
      if (f2.startsWith('TH-') || f2.startsWith('GT-')) return f2;
    }
    return '';
  }

  // 2. Si no hay factura o se evalúa el documento raíz de la orden
  const target = (inv || o) as any;
  let cr = (target?.collection?.contrareciboNumber || target?.contrarecibo || '').trim();
  if (!cr) {
    const f = (target?.folio || '').trim().toUpperCase();
    if (f.startsWith('TH-') || f.startsWith('GT-')) cr = f;
  }
  return cr;
}

// normalizarTexto ahora vive en functions/src/shared/finance.core.ts (se
// reexporta arriba) para que el mismo criterio de comparacion lo usen tanto
// el frontend como getActiveMaquilaOrders en el backend -- antes solo
// estaba aqui, y el backend comparaba con un .toLowerCase() simple que
// nunca hacia match contra "Andrés" con acento.

/**
 * Infiere el departamento ('TH' o 'GT') de una orden o factura evaluando:
 * 1. Campo explícito `department` en factura u orden
 * 2. Prefijos de contrarecibo (ej. TH-912, GT-742)
 * 3. Folios de factura u OC (ej. TH-768, GT-597)
 * 4. Nombre o tags del cliente (ej. "Textil Hogar", "TH", "Grupo Textil", "GT")
 * 5. IDs de documento (ej. cr-th-912, cr-gt-742)
 */
export function inferDepartment(order?: PurchaseOrder | any, inv?: any): 'TH' | 'GT' | null {
  // 1. Factura individual explícita
  if (inv?.department && typeof inv.department === 'string') {
    const d = inv.department.trim().toUpperCase();
    if (d === 'TH' || d.startsWith('TH-') || d.includes('TEXTIL HOGAR') || d.includes('TH-ALM')) return 'TH';
    if (d === 'GT' || d.startsWith('GT-') || d.includes('P4') || d.includes('P4-ALM')) return 'GT';
    if (d.includes('NAVA') || d.includes('LAMUÑO')) return 'TH';
    if (d.includes('EVELIA')) return 'GT';
  }

  // 2. Contrarecibo en factura O en orden
  const invCr = (inv?.collection?.contrareciboNumber || inv?.contrarecibo || '').trim().toUpperCase();
  if (invCr.startsWith('TH')) return 'TH';
  if (invCr.startsWith('GT')) return 'GT';

  const extracted = extractCr(inv, order).trim().toUpperCase();
  if (extracted.startsWith('TH')) return 'TH';
  if (extracted.startsWith('GT')) return 'GT';

  // 3. Folio de factura
  const invFolio = (inv?.folio || '').trim().toUpperCase();
  if (invFolio.startsWith('TH')) return 'TH';
  if (invFolio.startsWith('GT')) return 'GT';

  // 4. Campo explícito en la orden
  if (order?.department && typeof order.department === 'string') {
    const d = order.department.trim().toUpperCase();
    if (d === 'TH' || d.startsWith('TH-') || d.includes('TEXTIL HOGAR') || d.includes('TH-ALM') || d.includes('NAVA')) return 'TH';
    if (d === 'GT' || d.startsWith('GT-') || d.includes('P4') || d.includes('P4-ALM') || d.includes('EVELIA')) return 'GT';
  }

  // 5. Contrarecibo a nivel de orden
  const orderCr = (order?.collection?.contrareciboNumber || order?.contrarecibo || '').trim().toUpperCase();
  if (orderCr.startsWith('TH')) return 'TH';
  if (orderCr.startsWith('GT')) return 'GT';

  // 6. Folio u OC de la orden (División 71 = Nava / TH, División 43 = Evelia / GT)
  const orderFolio = `${order?.folio || ''} ${order?.oc || ''}`.trim().toUpperCase();
  if (
    orderFolio.startsWith('TH') ||
    orderFolio.includes('1202671') ||
    orderFolio.includes('71/') ||
    orderFolio.includes('71-') ||
    orderFolio.includes('14014') ||
    orderFolio.includes('14114') ||
    orderFolio.includes('NAVA')
  ) {
    return 'TH';
  }
  if (
    orderFolio.startsWith('GT') ||
    orderFolio.includes('1202643') ||
    orderFolio.includes('43/') ||
    orderFolio.includes('43-') ||
    orderFolio.includes('9713') ||
    orderFolio.includes('EVELIA')
  ) {
    return 'GT';
  }

  // 7. Identificador del documento
  const orderId = (order?.id || '').trim().toLowerCase();
  if (orderId.includes('cr-th') || orderId.includes('inv-th') || orderId.includes('th-') || orderId.endsWith('-th') || orderId.includes('14014') || orderId.includes('14114')) return 'TH';
  if (orderId.includes('cr-gt') || orderId.includes('inv-gt') || orderId.includes('gt-') || orderId.endsWith('-gt') || orderId.includes('9713')) return 'GT';

  const invId = (inv?.id || '').trim().toLowerCase();
  if (invId.includes('cr-th') || invId.includes('inv-th') || invId.includes('th-') || invId.endsWith('-th')) return 'TH';
  if (invId.includes('cr-gt') || invId.includes('inv-gt') || invId.includes('gt-') || invId.endsWith('-gt')) return 'GT';

  // 8. Contacto, comprador o notas
  const orderNotes = `${order?.notes || ''} ${order?.buyer || ''} ${order?.contact || ''} ${order?.requestedBy || ''}`.toUpperCase();
  if (orderNotes.includes('NAVA') || orderNotes.includes('LAMUÑO') || orderNotes.includes('TH-ALMACEN')) return 'TH';
  if (orderNotes.includes('EVELIA') || orderNotes.includes('P4')) return 'GT';

  // 9. Nombre del cliente o tags explícitos
  const clientStr = (order?.client || '').trim().toUpperCase();
  if (
    clientStr.includes('TEXTIL HOGAR') ||
    clientStr.includes('(TH') ||
    clientStr.includes('- TH') ||
    clientStr.includes('TH -') ||
    clientStr.includes('TH-') ||
    clientStr.includes('NAVA') ||
    clientStr.includes('LAMUÑO')
  ) {
    return 'TH';
  }
  if (
    clientStr.includes('EVELIA') ||
    clientStr.includes('P4') ||
    clientStr.includes('(GT') ||
    clientStr.includes('- GT') ||
    clientStr.includes('GT -') ||
    clientStr.includes('GT-') ||
    (clientStr.includes('GRUPO TEXTIL') && !clientStr.includes('TEXTIL HOGAR') && !clientStr.includes('TH'))
  ) {
    return 'GT';
  }

  // 10. Fallback por análisis de partidas canónicas
  if (Array.isArray(order?.items) && order.items.length > 0) {
    const codes = order.items.map((it: any) => (it.code || it.description || '').toUpperCase()).join(' ');
    if (codes.includes('EGBO000103') || codes.includes('EGBO000107') || codes.includes('ENBO000006') || codes.includes('ENBO000167')) return 'TH';
    if (codes.includes('EGBO000095') || codes.includes('EGBO000018') || codes.includes('EGBO000017') || codes.includes('EGBO000093')) return 'GT';
  }

  return null;
}

/**
 * Determina si una orden pertenece a un departamento ('TH', 'GT' o 'ALL').
 */
export function orderMatchesDepartment(order: PurchaseOrder | any, targetDept: string): boolean {
  if (!targetDept || targetDept === 'ALL') return true;
  if (!order) return false;
  const target = targetDept.trim().toUpperCase();
  const opposite = target === 'TH' ? 'GT' : 'TH';

  const dept = inferDepartment(order);
  if (dept === target) return true;
  if (dept === opposite) return false;

  // Si a nivel de orden fue indeterminado, revisar si alguna factura pertenece a target
  if (Array.isArray(order.invoices) && order.invoices.length > 0) {
    const hasTargetInvoice = order.invoices.some((inv: any) => inferDepartment(order, inv) === target);
    if (hasTargetInvoice) return true;
    const allOpposite = order.invoices.every((inv: any) => inferDepartment(order, inv) === opposite);
    if (allOpposite) return false;
  }

  // Si no hay suficiente información, incluir solo en ALL
  return false;
}

/**
 * Determina si una factura individual pertenece a un departamento (TH o GT).
 * Retorna TRUE si coincide positivamente con targetDept.
 * Retorna FALSE si pertenece positivamente al departamento opuesto.
 * Retorna NULL si es indeterminado.
 */
export function invoiceMatchesDepartmentStrict(inv: any, order: PurchaseOrder | any, targetDept: string): boolean | null {
  if (!targetDept || targetDept === 'ALL') return true;
  if (!inv) return null;
  const target = targetDept.trim().toUpperCase();
  const opposite = target === 'TH' ? 'GT' : 'TH';

  const dept = inferDepartment(order, inv);
  if (dept === target) return true;
  if (dept === opposite) return false;
  return null;
}

/**
 * Determina si una factura pertenece a un departamento (retorna booleano).
 */
export function invoiceMatchesDepartment(inv: any, order: PurchaseOrder | any, targetDept: string): boolean {
  if (!targetDept || targetDept === 'ALL') return true;
  const result = invoiceMatchesDepartmentStrict(inv, order, targetDept);
  return result === true;
}

/**
 * Filtra una orden de compra para un departamento específico con aislamiento hermético:
 * - Si targetDept es 'ALL', retorna la orden intacta.
 * - Si targetDept es 'TH' o 'GT', filtra su arreglo de `invoices` para incluir ÚNICAMENTE
 *   las facturas que pertenecen a ese departamento.
 * - Si la orden pertenece al departamento opuesto y no tiene facturas de este depto, retorna null.
 * - Si no tiene facturas y coincide con targetDept, la conserva.
 */
export function filterOrderByDepartment(o: PurchaseOrder | any, targetDept: string): PurchaseOrder | null {
  if (!targetDept || targetDept === 'ALL') return o;
  if (!o) return null;

  const target = targetDept.trim().toUpperCase();
  const opposite = target === 'TH' ? 'GT' : 'TH';

  // Si tiene facturas, filtramos exclusivamente las del departamento target
  if (Array.isArray(o.invoices) && o.invoices.length > 0) {
    const matchingInvoices = o.invoices.filter((inv: any) => {
      const result = invoiceMatchesDepartmentStrict(inv, o, target);
      // Incluir coincidencia positiva o indeterminada solo si la orden misma es del target
      if (result === true) return true;
      if (result === false) return false;
      return inferDepartment(o) === target;
    });

    if (matchingInvoices.length > 0) {
      const filteredKilos = matchingInvoices.reduce((acc: number, inv: any) => acc + (inv.kilos || 0), 0);
      return {
        ...o,
        department: o.department || target,
        totalKilograms: filteredKilos > 0 ? filteredKilos : o.totalKilograms,
        invoices: matchingInvoices,
        invoiceStatuses: matchingInvoices.map((inv: any) => inv.creditCycle?.status || 'pending'),
      };
    }

    // Tenía facturas pero ninguna pertenecía al target
    return null;
  }

  // Orden sin facturas aún (ej. pedido nuevo o remisión):
  const orderDept = inferDepartment(o);
  if (orderDept === target) {
    return {
      ...o,
      department: o.department || target,
    };
  }

  if (orderDept === opposite) {
    return null;
  }

  // Sin evidencia suficiente en orden vacía
  return null;
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

    const s = i.creditCycle?.status;
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
      const s = inv.creditCycle?.status;
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

  const costPricePerKg = Number(order.customCostPrice ?? config?.costPricePerKg ?? 38);
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

/**
 * =========================================================================
 * GUARDRAILS ANTI-SOBRECUPO & VALIDACIONES PREVENTIVAS EN TIEMPO REAL
 * =========================================================================
 */

export interface WeightGuardrailResult {
  totalOrderedKg: number;
  alreadyDeliveredKg: number;
  maxAllowedNewKg: number;
  excessKg: number;
  isOverLimit: boolean;
  projectedTotalKg: number;
  pctCapacity: number;
  message: string;
}

export function validateOrderWeightGuardrail(
  order: PurchaseOrder | any,
  newDeliveryKg: number,
  currentDeliveryId?: string
): WeightGuardrailResult {
  const itemsSum = Array.isArray(order?.items)
    ? order.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
    : 0;
  const totalOrderedKg = round2(itemsSum > 0 ? itemsSum : (Number(order?.totalKilograms) || 0));

  const deliveries = Array.isArray(order?.deliveries) ? order.deliveries : [];
  const alreadyDeliveredKg = round2(
    deliveries
      .filter((d: any) => !currentDeliveryId || d.id !== currentDeliveryId)
      .reduce((s: number, d: any) => s + (Number(d.kilos) || 0), 0)
  );

  const maxAllowedNewKg = round2(Math.max(0, totalOrderedKg - alreadyDeliveredKg));
  const projectedTotalKg = round2(alreadyDeliveredKg + (Number(newDeliveryKg) || 0));
  const excessKg = round2(Math.max(0, projectedTotalKg - totalOrderedKg));
  const isOverLimit = excessKg > 0.01 && totalOrderedKg > 0;
  const pctCapacity = totalOrderedKg > 0 ? round2((projectedTotalKg / totalOrderedKg) * 100) : 100;

  let message = 'Dentro del cupo de la Orden de Compra.';
  if (isOverLimit) {
    message = `⚠️ Sobrecupo detectado: Excede por +${excessKg.toLocaleString('es-MX')} kg el tope de la OC (${totalOrderedKg.toLocaleString('es-MX')} kg).`;
  } else if (maxAllowedNewKg <= 0.01) {
    message = '✅ Esta Orden de Compra ya está surtida al 100%.';
  }

  return {
    totalOrderedKg,
    alreadyDeliveredKg,
    maxAllowedNewKg,
    excessKg,
    isOverLimit,
    projectedTotalKg,
    pctCapacity,
    message,
  };
}

export interface InvoiceGuardrailResult {
  totalOrderedKg: number;
  totalDeliveredKg: number;
  alreadyInvoicedKg: number;
  maxAvailableToInvoice: number;
  excessVsDelivered: number;
  excessVsOrdered: number;
  isOverDelivered: boolean;
  isOverOrdered: boolean;
  message: string;
}

export function validateInvoiceWeightGuardrail(
  order: PurchaseOrder | any,
  newInvoiceKg: number,
  currentInvoiceId?: string
): InvoiceGuardrailResult {
  const s = getOrderSummary(order);
  const totalOrderedKg = round2(Number(order?.totalKilograms) || s.kilosDelivered || 0);
  const totalDeliveredKg = round2(s.kilosDelivered || 0);

  const invoices = Array.isArray(order?.invoices) ? order.invoices : [];
  const alreadyInvoicedKg = round2(
    invoices
      .filter((i: any) => !currentInvoiceId || (i.id !== currentInvoiceId && i.folio !== currentInvoiceId))
      .reduce((sum: number, i: any) => sum + (Number(i.kilos) || 0), 0)
  );

  const maxAvailableToInvoice = round2(Math.max(0, totalDeliveredKg - alreadyInvoicedKg));
  const projectedInvoicedKg = round2(alreadyInvoicedKg + (Number(newInvoiceKg) || 0));
  const excessVsDelivered = round2(Math.max(0, projectedInvoicedKg - totalDeliveredKg));
  const excessVsOrdered = round2(Math.max(0, projectedInvoicedKg - totalOrderedKg));

  const isOverDelivered = excessVsDelivered > 0.01 && totalDeliveredKg > 0;
  const isOverOrdered = excessVsOrdered > 0.01 && totalOrderedKg > 0;

  let message = 'Kilos listos y amparados para timbrado CFDI.';
  if (isOverDelivered) {
    message = `⚠️ Sobrefacturación en Báscula: Se intentan facturar +${excessVsDelivered.toLocaleString('es-MX')} kg más de lo entregado en patio (${totalDeliveredKg.toLocaleString('es-MX')} kg).`;
  } else if (isOverOrdered) {
    message = `⚠️ Sobrefacturación en OC: Se intentan facturar +${excessVsOrdered.toLocaleString('es-MX')} kg más del total de la OC (${totalOrderedKg.toLocaleString('es-MX')} kg).`;
  }

  return {
    totalOrderedKg,
    totalDeliveredKg,
    alreadyInvoicedKg,
    maxAvailableToInvoice,
    excessVsDelivered,
    excessVsOrdered,
    isOverDelivered,
    isOverOrdered,
    message,
  };
}

/**
 * =========================================================================
 * ASISTENTE DE CONCILIACIÓN "3-WAY MATCH" (Báscula ➔ Factura SAT ➔ Contrarecibo)
 * =========================================================================
 */

export type ThreeWayMatchStatus = 'MATCH_PERFECT' | 'PENDING_INVOICE' | 'PENDING_CR' | 'DISCREPANCY';

export interface ThreeWayMatchEvaluation {
  status: ThreeWayMatchStatus;
  isPerfect: boolean;
  hasDelivery: boolean;
  hasInvoice: boolean;
  hasCr: boolean;
  deliveryKg: number;
  invoiceKg: number;
  diffKg: number;
  crNumber: string;
  unitPrice: number;
  invoiceTotal: number;
  expectedTotal: number;
  diffMoney: number;
  reason: string;
}

export function evaluateThreeWayMatch(
  order: PurchaseOrder | Partial<PurchaseOrder> | Record<string, any> | null | undefined,
  invoice?: Invoice | Partial<Invoice> | Record<string, any> | null,
  deliveriesList?: Delivery[]
): ThreeWayMatchEvaluation {
  const deliveries = deliveriesList || order?.deliveries || [];
  const totalDeliveredKg = round2(deliveries.reduce((acc: number, d: Delivery) => acc + (Number(d.kilos) || 0), 0));
  
  const inv = invoice || (Array.isArray(order?.invoices) && order.invoices.length > 0 ? order.invoices[0] : null);
  const hasDelivery = totalDeliveredKg > 0.01;
  const hasInvoice = !!inv && (Number(inv.kilos) > 0 || Boolean(inv.folio && String(inv.folio).trim().length > 0));
  
  const cr = extractCr(inv, order).trim().toUpperCase();
  const hasCr = cr.length > 0 && !cr.startsWith('SIN') && !cr.startsWith('PEND') && (cr.includes('-') || cr.startsWith('TH') || cr.startsWith('GT') || /^\d+$/.test(cr));

  const invoiceKg = round2(Number(inv?.kilos) || 0);
  const deliveryKg = totalDeliveredKg;
  const diffKg = round2(Math.abs(deliveryKg - invoiceKg));

  const unitPrice = round2(inv?.financials?.salePricePerKg || 43.0);
  const invoiceTotal = round2(inv?.financials?.invoiceTotal || (invoiceKg * unitPrice * 1.16));
  const expectedTotal = round2(deliveryKg * unitPrice * 1.16);
  const diffMoney = round2(Math.abs(invoiceTotal - expectedTotal));

  if (!hasDelivery) {
    return {
      status: 'DISCREPANCY',
      isPerfect: false,
      hasDelivery: false,
      hasInvoice,
      hasCr,
      deliveryKg: 0,
      invoiceKg,
      diffKg: invoiceKg,
      crNumber: cr,
      unitPrice,
      invoiceTotal,
      expectedTotal: 0,
      diffMoney: invoiceTotal,
      reason: 'No se han registrado boletas de pesaje en báscula.',
    };
  }

  if (!hasInvoice) {
    return {
      status: 'PENDING_INVOICE',
      isPerfect: false,
      hasDelivery: true,
      hasInvoice: false,
      hasCr,
      deliveryKg,
      invoiceKg: 0,
      diffKg: deliveryKg,
      crNumber: cr,
      unitPrice,
      invoiceTotal: 0,
      expectedTotal,
      diffMoney: expectedTotal,
      reason: `Hay ${deliveryKg.toLocaleString('es-MX')} kg en báscula listos para timbrar CFDI.`,
    };
  }

  if (diffKg > 0.05) {
    return {
      status: 'DISCREPANCY',
      isPerfect: false,
      hasDelivery: true,
      hasInvoice: true,
      hasCr,
      deliveryKg,
      invoiceKg,
      diffKg,
      crNumber: cr,
      unitPrice,
      invoiceTotal,
      expectedTotal,
      diffMoney,
      reason: `Discrepancia de peso: Báscula marca ${deliveryKg.toLocaleString('es-MX')} kg pero Factura ampara ${invoiceKg.toLocaleString('es-MX')} kg (Diferencia: ${diffKg.toLocaleString('es-MX')} kg).`,
    };
  }

  if (!hasCr) {
    return {
      status: 'PENDING_CR',
      isPerfect: false,
      hasDelivery: true,
      hasInvoice: true,
      hasCr: false,
      deliveryKg,
      invoiceKg,
      diffKg: 0,
      crNumber: '',
      unitPrice,
      invoiceTotal,
      expectedTotal,
      diffMoney: 0,
      reason: 'Báscula y Factura coinciden perfectamente. En espera de sello de Contrarecibo en ventanilla Providencia.',
    };
  }

  return {
    status: 'MATCH_PERFECT',
    isPerfect: true,
    hasDelivery: true,
    hasInvoice: true,
    hasCr: true,
    deliveryKg,
    invoiceKg,
    diffKg: 0,
    crNumber: cr,
    unitPrice,
    invoiceTotal,
    expectedTotal,
    diffMoney: 0,
    reason: `✅ 3-Way Match Perfecto: Báscula (${deliveryKg.toLocaleString('es-MX')} kg) = Factura F-${inv?.folio || ''} ($${invoiceTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}) = Contrarecibo ${cr}.`,
  };
}


