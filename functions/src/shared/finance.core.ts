/**
 * FORMULA FINANCIERA CANONICA — FUENTE UNICA DE VERDAD
 * =====================================================
 *
 * Este archivo lo importan LOS DOS lados del sistema:
 *   - el frontend, desde src/lib/finance.ts
 *   - las Cloud Functions, desde functions/src/index.ts
 *
 * Vivia duplicado, con el comentario "si cambias una, cambia la otra" como
 * unica salvaguarda. La duplicacion ya habia empezado a divergir: la
 * resolucion de costos variables existia solo en el backend.
 *
 * Esta escrito en TypeScript neutro a proposito: sin imports, sin APIs de
 * Node ni del navegador, para que compile igual bajo el tsconfig del
 * frontend (ESNext) y el de functions (CommonJS).
 *
 * REGLA DE NEGOCIO
 *   subtotal = kilos x precio de venta
 *   factura  = subtotal + IVA          <- esto es lo que se le cobra al cliente
 *   costo    = kilos x costo
 *   comision = (subtotal o factura) x tasa, segun commissionBase
 *   neto     = subtotal - costo - comision
 *
 * El neto se calcula sobre el SUBTOTAL sin IVA porque el IVA no debe mezclarse
 * con la utilidad real del negocio.
 */
import Decimal from 'decimal.js-light';
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface FinanceConfigCore {
  salePricePerKg: number;
  costPricePerKg: number;
  commissionRate: number;
  creditDays: number;
  ivaRate: number;
  commissionBase: 'subtotal' | 'total';
}

export interface FinanceResultCore {
  salePricePerKg: number;
  costPricePerKg: number;
  commissionRate: number;
  saleTotal: number;
  invoiceTotal: number;
  costTotal: number;
  commission: number;
  netCashFlow: number;
  tradeMargin: number;
}

export function round2(n: number): number {
  return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Normaliza texto para comparaciones que no deben depender de acentos ni
 * mayusculas -- "Andres" vs "Andrés" son el mismo proveedor para cualquier
 * humano, pero como strings JS son distintos byte a byte. Vivia solo en
 * src/lib/finance.ts (frontend); getActiveMaquilaOrders en index.ts
 * comparaba con un .toLowerCase() simple que nunca hace match contra
 * "Andrés" (con acento), asi que el Estado de Cuenta del Portal Maquilador
 * mostraba $0.00 / 0 kg entregados aunque si hubiera compras y pagos reales
 * registrados. Ahora vive aqui, compartida entre frontend y backend.
 */
export function normalizarTexto(s: string | null | undefined): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function computeFinancials(
  kilos: number,
  cfg: FinanceConfigCore,
): FinanceResultCore {
  const k = Number.isFinite(kilos) ? kilos : 0;
  
  const saleTotal = round2(new Decimal(k).times(cfg.salePricePerKg).toNumber());
  const invoiceTotal = round2(new Decimal(saleTotal).times(new Decimal(1).plus(cfg.ivaRate ?? 0)).toNumber());
  const costTotal = round2(new Decimal(k).times(cfg.costPricePerKg).toNumber());
  
  const base = cfg.commissionBase === 'total' ? invoiceTotal : saleTotal;
  const commission = round2(new Decimal(base).times(cfg.commissionRate).toNumber());
  
  return {
    salePricePerKg: cfg.salePricePerKg,
    costPricePerKg: cfg.costPricePerKg,
    commissionRate: cfg.commissionRate,
    saleTotal,
    invoiceTotal,
    costTotal,
    commission,
    netCashFlow: round2(new Decimal(saleTotal).minus(costTotal).minus(commission).toNumber()),
    tradeMargin: round2(new Decimal(saleTotal).minus(costTotal).toNumber()),
  };
}

export function computeCommissionFromInvoiceTotal(invoiceTotal: number, cfg: FinanceConfigCore): number {
  const saleTotal = new Decimal(invoiceTotal).dividedBy(new Decimal(1).plus(cfg.ivaRate ?? 0)).toNumber();
  const base = cfg.commissionBase === 'total' ? invoiceTotal : saleTotal;
  return round2(new Decimal(base).times(cfg.commissionRate ?? 0).toNumber());
}

/**
 * Configuracion con la que hay que evaluar UN expediente concreto.
 *
 * Un expediente puede traer costo y comision propios (funcion "Costos
 * variables"): son decisiones de negocio legitimas, no manipulacion. Antes
 * esta resolucion existia dos veces con dos nombres distintos —
 * `configEfectiva` en el backend y `dynamicConfig` dentro de OrderModal — lo
 * que hacia que el trigger de saneamiento revirtiera los costos que el
 * usuario acababa de capturar.
 *
 * `customCommissionRate` se guarda en tanto por uno (0.069), no en
 * porcentaje: la conversion desde el campo de la interfaz ocurre antes.
 */
export function configEfectiva(
  base: FinanceConfigCore,
  custom: { customSellPrice?: unknown; customCostPrice?: unknown; customCommissionRate?: unknown },
): FinanceConfigCore {
  const cfg: FinanceConfigCore = { ...base };
  
  if (custom.customSellPrice !== undefined && custom.customSellPrice !== null && custom.customSellPrice !== '') {
    const venta = Number(custom.customSellPrice);
    if (Number.isFinite(venta) && venta >= 0) cfg.salePricePerKg = venta;
  }
  
  if (custom.customCostPrice !== undefined && custom.customCostPrice !== null && custom.customCostPrice !== '') {
    const costo = Number(custom.customCostPrice);
    if (Number.isFinite(costo) && costo >= 0) cfg.costPricePerKg = costo;
  } else {
    // Si no hay customCostPrice, forzamos que el costo sea igual a la venta para que el margen devengado empiece en $0
    // (a menos que quieran usar el historico base de $42, pero acordamos que el historico empieza hoy con $0 ganancia si no hay captura).
    // cfg.costPricePerKg = cfg.salePricePerKg; // Descomentar si se quiere anular la ganancia historica.
    // Actualmente conservamos el fallback de base (42) para que el netCashFlow viejo no colapse, 
    // pero la nueva metrica se guiara por la captura real.
  }
  
  let comision = Number(custom.customCommissionRate);
  if (Number.isFinite(comision) && comision >= 0) {
    if (comision > 1) comision = comision / 100;
    cfg.commissionRate = comision;
  }
  return cfg;
}

/**
 * MOTOR FINANCIERO DINAMICO — ESPECIFICACION EXACTA DEL MODELO DE UTILIDAD
 * ======================================================================
 * 1. precio_venta_final_kg = precio_venta_base_kg * (1 + tasa_adicional_pct)
 * 2. kilos_vendidos = monto_facturado_total / precio_venta_final_kg
 * 3. costo_total_compra = kilos_vendidos * costo_compra_kg
 * 4. monto_comision_gestor = monto_facturado_total - monto_recibido_neto
 *    porcentaje_comision_real = (monto_comision_gestor / monto_facturado_total) * 100
 * 5. ganancia_limpia_total = monto_recibido_neto - costo_total_compra
 * 6. ganancia_limpia_por_kg = ganancia_limpia_total / kilos_vendidos
 */
export interface DynamicFinancialsInput {
  costo_compra_kg: number;
  precio_venta_base_kg: number;
  tasa_adicional_pct: number;
  monto_facturado_total: number;
  monto_recibido_neto?: number;
  porcentaje_comision?: number;
}

export interface DynamicFinancialsResult {
  precio_venta_final_kg: number;
  kilos_vendidos: number;
  costo_total_compra: number;
  monto_comision_gestor: number;
  porcentaje_comision_real: number;
  monto_recibido_neto: number;
  ganancia_limpia_total: number;
  ganancia_limpia_por_kg: number;
}

export function computeDynamicFinancials(input: DynamicFinancialsInput): DynamicFinancialsResult {
  const costo_compra_kg = Number(input.costo_compra_kg) || 0;
  const precio_venta_base_kg = Number(input.precio_venta_base_kg) || 0;
  const tasa_adicional_pct = Number(input.tasa_adicional_pct) || 0;
  const monto_facturado_total = Number(input.monto_facturado_total) || 0;

  // 1. Precio Final de Venta por Kilo
  const precio_venta_final_kg = round2(new Decimal(precio_venta_base_kg).times(new Decimal(1).plus(tasa_adicional_pct)).toNumber());

  // 2. Kilos Vendidos (Calculados automáticamente)
  const kilos_vendidos = precio_venta_final_kg > 0 ? round2(new Decimal(monto_facturado_total).dividedBy(precio_venta_final_kg).toNumber()) : 0;

  // 3. Costo Total del Material
  const costo_total_compra = round2(new Decimal(kilos_vendidos).times(costo_compra_kg).toNumber());

  // 4. Flexibilidad en Captura (Monto recibido o Porcentaje de comisión)
  let monto_recibido_neto = 0;
  let monto_comision_gestor = 0;
  let porcentaje_comision_real = 0;

  if (input.monto_recibido_neto !== undefined && input.monto_recibido_neto !== null) {
    monto_recibido_neto = round2(Number(input.monto_recibido_neto));
    monto_comision_gestor = round2(new Decimal(monto_facturado_total).minus(monto_recibido_neto).toNumber());
    porcentaje_comision_real = monto_facturado_total > 0 ? round2(new Decimal(monto_comision_gestor).dividedBy(monto_facturado_total).times(100).toNumber()) : 0;
  } else {
    const pctComision = Number(input.porcentaje_comision) || 0;
    monto_recibido_neto = round2(new Decimal(monto_facturado_total).times(new Decimal(1).minus(pctComision)).toNumber());
    monto_comision_gestor = round2(new Decimal(monto_facturado_total).minus(monto_recibido_neto).toNumber());
    porcentaje_comision_real = round2(new Decimal(pctComision).times(100).toNumber());
  }

  // 5. Ganancia Limpia Total (Flujo Neto)
  const ganancia_limpia_total = round2(new Decimal(monto_recibido_neto).minus(costo_total_compra).toNumber());

  // 6. Ganancia Limpia por Kilo
  const ganancia_limpia_por_kg = kilos_vendidos > 0 ? round2(new Decimal(ganancia_limpia_total).dividedBy(kilos_vendidos).toNumber()) : 0;

  return {
    precio_venta_final_kg,
    kilos_vendidos,
    costo_total_compra,
    monto_comision_gestor,
    porcentaje_comision_real,
    monto_recibido_neto,
    ganancia_limpia_total,
    ganancia_limpia_por_kg,
  };
}

/**
 * "SALDO CON ANDRÉS" -- FÓRMULA CANÓNICA (auditoría v8.9.5)
 * =============================================================
 *
 * INCIDENTE REAL que motivó extraer esto aquí: el Dashboard mostraba
 * "Saldo con Andrés" = -$1,289,709.62 mientras que la pantalla Compras ->
 * Andrés, para el MISMO dato, mostraba +$40,800.00 -- una diferencia de
 * $1,330,509.62 dentro de la misma sesión de la misma app. Causa raíz: esta
 * misma fórmula vivía copiada TRES veces (src/hooks/useAndresStats.ts,
 * src/hooks/useDashboardStatsV2.ts, y functions/src/index.ts en el handler
 * de ledger del Portal Maquilador) y una de las tres copias se olvidó de
 * leer `historicalDebtAndres` del config real, cayendo en un respaldo fijo
 * viejo. Las tres ahora llaman a esta única función.
 *
 * REGLA DE NEGOCIO:
 *   total_pagado   = suma de gastos al proveedor: egreso suma, ingreso resta
 *   costo_compras  = suma de (kilos_recibidos x precio_kg_de_la_compra, o el
 *                     precio de costo configurado si la compra no trae uno
 *                     propio)
 *   saldo          = total_pagado - costo_compras + deuda_historica
 *
 * Un saldo positivo significa que Bolsas Elemental le pagó de más a Andrés
 * (a su favor); negativo significa que todavía se le debe.
 */
export interface AndresBalanceConfig {
  costPricePerKg: number;
  historicalDebtAndres?: number;
}

export interface AndresPurchaseLike {
  provider?: string | null;
  receivedKilos?: number | null;
  pricePerKg?: number | null;
}

export interface AndresExpenseLike {
  provider?: string | null;
  type?: string | null;
  amount?: number | null;
}

export interface AndresBalanceResult {
  totalReceivedKilos: number;
  totalPurchasesCost: number;
  totalPagado: number;
  historicalDebtAndres: number;
  saldoProveedor: number;
}

export function computeAndresBalance(
  purchases: AndresPurchaseLike[] | null | undefined,
  expenses: AndresExpenseLike[] | null | undefined,
  cfg: AndresBalanceConfig,
  providerFilter: string = 'Andres',
): AndresBalanceResult {
  const target = normalizarTexto(providerFilter);

  const provPurchases = (purchases || []).filter(
    (p): p is AndresPurchaseLike => !!p && normalizarTexto(p.provider) === target,
  );
  const provExpenses = (expenses || []).filter(
    (e): e is AndresExpenseLike => !!e && normalizarTexto(e.provider) === target,
  );

  const totalReceivedKilos = provPurchases.reduce((acc, p) => acc + (Number(p.receivedKilos) || 0), 0);

  const totalPurchasesCost = provPurchases.reduce(
    (acc, p) => acc + (Number(p.receivedKilos) || 0) * (Number(p.pricePerKg) || cfg.costPricePerKg),
    0,
  );

  const totalPagado = provExpenses.reduce((acc, e) => {
    if (e.type === 'egreso') return acc + (Number(e.amount) || 0);
    if (e.type === 'ingreso') return acc - (Number(e.amount) || 0);
    return acc;
  }, 0);

  const historicalDebtAndres = cfg.historicalDebtAndres || 0;
  const saldoProveedor = totalPagado - totalPurchasesCost + historicalDebtAndres;

  return { totalReceivedKilos, totalPurchasesCost, totalPagado, historicalDebtAndres, saldoProveedor };
}

