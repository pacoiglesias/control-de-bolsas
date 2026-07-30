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
 *   neto     = factura - costo - comision
 *
 * El neto se calcula sobre la factura CON IVA porque en este negocio el IVA
 * es parte integra de la ganancia.
 */

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
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeFinancials(
  kilos: number,
  cfg: FinanceConfigCore,
): FinanceResultCore {
  const k = Number.isFinite(kilos) ? kilos : 0;
  const saleTotal = round2(k * cfg.salePricePerKg);
  const invoiceTotal = round2(saleTotal * (1 + (cfg.ivaRate ?? 0)));
  const costTotal = round2(k * cfg.costPricePerKg);
  const base = cfg.commissionBase === 'total' ? invoiceTotal : saleTotal;
  const commission = round2(base * cfg.commissionRate);
  return {
    salePricePerKg: cfg.salePricePerKg,
    costPricePerKg: cfg.costPricePerKg,
    commissionRate: cfg.commissionRate,
    saleTotal,
    invoiceTotal,
    costTotal,
    commission,
    netCashFlow: round2(invoiceTotal - costTotal - commission),
    tradeMargin: round2(saleTotal - costTotal),
  };
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
  
  const comision = Number(custom.customCommissionRate);
  if (Number.isFinite(comision) && comision >= 0) cfg.commissionRate = comision;
  return cfg;
}
