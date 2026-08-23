/**
 * NUEVO (v8.9.13, "flujo de contrarecibos a detalle"): parser y matcher para
 * el importador de "Sincronización desde el Portal del Cliente"
 * (ver SincronizadorOficialModal.tsx).
 *
 * Antes, la única forma de reflejar lo que el portal de Providencia (TH/GT)
 * reporta era editar a mano un arreglo hardcodeado en el código fuente
 * (OFFICIAL_CRS) y volver a desplegar -- por eso ese arreglo quedó
 * congelado en una fecha vieja y ya no coincide con lo que el usuario ve
 * hoy en el portal (algunos CRs que estaban "GENERADO" ya avanzaron a
 * "EN PROCESO DE PAGO"). Este módulo permite pegar (Ctrl+V) la tabla tal
 * cual el portal la exporta y sincronizar SOLO el estatus/fechas -- nunca
 * los montos ni kilos, que siguen siendo responsabilidad del expediente.
 *
 * Se separa de SincronizadorOficialModal.tsx (que es un componente React)
 * para poder probarlo con pruebas unitarias puras, sin Firestore ni DOM.
 */
import type { ContrareciboPortalStatus, PurchaseOrder, Invoice } from './types';

export interface PortalCrRow {
  no: number;
  cr: string;
  fecha: string | null;        // ISO yyyy-mm-dd
  vencimiento: string | null;  // ISO yyyy-mm-dd
  total: number;
  pagado: number;
  pendiente: number;
  moneda: string;
  tc: number;
  estatusRaw: string;
  estatus: ContrareciboPortalStatus | null;
}

export interface PortalRevisionRow {
  no: number;
  receptor: string;
  oc: string;
  folio: string;
  fechaFactura: string | null; // ISO yyyy-mm-dd
  total: number;
  statRaw: string;
}

export interface PortalPaymentRow {
  provider: string;
  transferRef: string;
  fecha: string | null; // ISO yyyy-mm-dd
  total: number;
  moneda: string;
}

export type PortalParseResult =
  | { format: 'cr'; rows: PortalCrRow[]; warnings: string[] }
  | { format: 'revision'; rows: PortalRevisionRow[]; warnings: string[] }
  | { format: 'payments'; rows: PortalPaymentRow[]; warnings: string[] }
  | { format: 'unknown'; rows: []; warnings: string[] };

/** "81,780.00" / "81780" / "0" -> 81780. Vacío o no numérico -> 0. */
export function parseMoneyEs(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "17/08/2026", "12/8/2026", "7/31/2026" -> ISO "2026-08-17". */
export function parseMexicanDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) {
    const [, p1, p2, y] = dmy;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    // Si p2 > 12, el formato es D/M/YYYY
    // Si p1 <= 12 y p2 > 12, es M/D/YYYY (ej: 7/31/2026)
    if (n1 <= 12 && n2 > 12) {
      return `${y}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
    }
    // Por defecto en México D/M/YYYY
    return `${y}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
  }
  return null;
}

/** Normaliza el texto libre de "Estatus"/"Stat" del portal a nuestro enum. */
export function normalizePortalEstatus(raw: string | undefined): ContrareciboPortalStatus | null {
  if (!raw) return null;
  const s = raw
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .trim().toUpperCase();
  if (!s) return null;
  if (s.includes('EN PROCESO')) return 'en_proceso_pago';
  if (s.startsWith('GENERADO')) return 'generado';
  if (s.includes('PAGAD')) return 'pagado';
  if (s.includes('REVISION') || s.includes('PENDIENTE')) return 'sin_numero';
  return null;
}

function splitCells(line: string): string[] {
  return line.split('\t').map((c) => c.trim());
}

/** Detecta y parsea cualquiera de las 2 tablas que exporta el portal del
 *  cliente al copiar/pegar (Ctrl+C / Ctrl+V) desde el navegador:
 *  1. "CONTRARECIBOS" -- No, Contrarecibo, Fecha, Vencimiento, Total,
 *     Pagado, Pendiente, Moneda, TC, Estatus, Acción.
 *  2. "FACTURAS EN REVISIÓN PENDIENTES DE NÚMERO DE CONTRARECIBO" -- No,
 *     Receptor, O C, Versión, Tipo, Folio, Fecha Factura, Fecha Envío,
 *     Total, Stat, DOCA, XML, PDF.
 *  Ignora líneas de título, encabezados de página y el pie de paginación
 *  ("162 resultados, página 1 de 7.") -- solo toma líneas cuya primera
 *  celda es un número entero (la columna "No"). */
export function parsePortalPaste(text: string): PortalParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/g, ''));
  const warnings: string[] = [];

  const hasCrHeader = lines.some((l) => /\bContrarecibo\b/i.test(l) && /\bEstatus\b/i.test(l));
  const hasRevisionHeader = lines.some((l) => /\bReceptor\b/i.test(l) && /\bFolio\b/i.test(l));
  const hasPaymentHeader = lines.some((l) => /\b(PAGOS|PAGOS YA COBRADOS|COBRADOS)\b/i.test(l) || (/\bTR_\d+\b/i.test(l) && /\b(MXN|PMX|\$|\d+\.\d{2})\b/i.test(l)));

  if (!hasCrHeader && !hasRevisionHeader && !hasPaymentHeader) {
    return { format: 'unknown', rows: [], warnings: ['No se reconocieron las columnas de ninguna tabla del portal (se esperaba "Contrarecibo"+"Estatus", "Receptor"+"Folio", o "PAGOS YA COBRADOS").'] };
  }

  if (hasCrHeader) {
    const rows: PortalCrRow[] = [];
    for (const line of lines) {
      const cells = splitCells(line);
      if (cells.length < 10) continue;
      if (!/^\d+$/.test(cells[0])) continue; // no es fila de datos (título, encabezado, pie)
      const estatusRaw = cells[9] || '';
      rows.push({
        no: parseInt(cells[0], 10),
        cr: (cells[1] || '').trim(),
        fecha: parseMexicanDate(cells[2]),
        vencimiento: parseMexicanDate(cells[3]),
        total: parseMoneyEs(cells[4]),
        pagado: parseMoneyEs(cells[5]),
        pendiente: parseMoneyEs(cells[6]),
        moneda: (cells[7] || '').trim(),
        tc: parseFloat(cells[8]) || 1,
        estatusRaw,
        estatus: normalizePortalEstatus(estatusRaw),
      });
    }
    if (rows.length === 0) warnings.push('Se reconoció la tabla de Contrarecibos pero no se encontró ninguna fila de datos.');
    return { format: 'cr', rows, warnings };
  }

  if (hasPaymentHeader) {
    const rows: PortalPaymentRow[] = [];
    for (const line of lines) {
      const trMatch = line.match(/(?:(PR\d+)\s+)?(TR_\d+)\s+([0-9/.-]+)\s+([0-9,.]+)\s*([A-Z]{3})?/i);
      if (trMatch) {
        rows.push({
          provider: trMatch[1] || 'PR50823',
          transferRef: trMatch[2].toUpperCase(),
          fecha: parseMexicanDate(trMatch[3]),
          total: parseMoneyEs(trMatch[4]),
          moneda: trMatch[5]?.toUpperCase() || 'MXN',
        });
        continue;
      }
      const cells = splitCells(line);
      const trIdx = cells.findIndex(c => /^TR_\d+$/i.test(c));
      if (trIdx >= 0) {
        const provider = trIdx > 0 ? cells[trIdx - 1] : 'PR50823';
        const transferRef = cells[trIdx].toUpperCase();
        const fecha = parseMexicanDate(cells[trIdx + 1]);
        const total = parseMoneyEs(cells[trIdx + 2]);
        const moneda = (cells[trIdx + 3] || 'MXN').toUpperCase();
        if (transferRef && total > 0) {
          rows.push({ provider, transferRef, fecha, total, moneda });
        }
      }
    }
    if (rows.length === 0) warnings.push('Se reconoció la tabla de Pagos Cobrados pero no se encontró ninguna fila de datos.');
    return { format: 'payments', rows, warnings };
  }

  const rows: PortalRevisionRow[] = [];
  for (const line of lines) {
    const cells = splitCells(line);
    if (cells.length < 9) continue;
    if (!/^\d+$/.test(cells[0])) continue;
    rows.push({
      no: parseInt(cells[0], 10),
      receptor: (cells[1] || '').trim(),
      oc: (cells[2] || '').trim(),
      folio: (cells[5] || '').trim(),
      fechaFactura: parseMexicanDate(cells[6]),
      total: parseMoneyEs(cells[8]),
      statRaw: (cells[9] || '').trim(),
    });
  }
  if (rows.length === 0) warnings.push('Se reconoció la tabla de Facturas en Revisión pero no se encontró ninguna fila de datos.');
  return { format: 'revision', rows, warnings };
}

export interface OrderInvoiceMatch {
  order: PurchaseOrder;
  invoiceIndex: number; // -1 si el match es a nivel de expediente legacy (sin invoices[])
}

const norm = (s: string | undefined | null) => (s || '').trim().toUpperCase();

/** Busca, entre todos los expedientes, la factura (o el expediente legacy)
 *  cuyo número de contrarecibo coincide con `cr`. */
export function matchOrderByCr(orders: PurchaseOrder[], cr: string): OrderInvoiceMatch | null {
  const target = norm(cr);
  if (!target) return null;
  for (const order of orders) {
    if (order.invoices && order.invoices.length > 0) {
      const idx = order.invoices.findIndex((inv) => norm(inv.collection?.contrareciboNumber) === target);
      if (idx >= 0) return { order, invoiceIndex: idx };
    } else if (norm(order.collection?.contrareciboNumber) === target) {
      return { order, invoiceIndex: -1 };
    }
  }
  return null;
}

/** Busca la factura cuyo folio coincide con el de "Facturas en Revisión". */
export function matchOrderByFolio(orders: PurchaseOrder[], folio: string): OrderInvoiceMatch | null {
  const target = norm(folio);
  if (!target) return null;
  for (const order of orders) {
    if (order.invoices && order.invoices.length > 0) {
      const idx = order.invoices.findIndex((inv) => norm(inv.folio) === target);
      if (idx >= 0) return { order, invoiceIndex: idx };
    } else if (norm(order.folio) === target) {
      return { order, invoiceIndex: -1 };
    }
  }
  return null;
}

export interface PortalCrPlanItem {
  row: PortalCrRow;
  match: OrderInvoiceMatch | null;
  /** true si hay match pero el estatus/fecha ya coinciden -- no hay nada que escribir. */
  noop: boolean;
}

export interface PortalRevisionPlanItem {
  row: PortalRevisionRow;
  match: OrderInvoiceMatch | null;
  noop: boolean;
}

export interface PortalPaymentPlanItem {
  row: PortalPaymentRow;
  matchedCr?: string;
  match: OrderInvoiceMatch | null;
  noop: boolean;
}

function currentPortalStatus(match: OrderInvoiceMatch): ContrareciboPortalStatus | undefined {
  const collection = match.invoiceIndex >= 0
    ? match.order.invoices?.[match.invoiceIndex]?.collection
    : match.order.collection;
  return collection?.contrareciboPortalStatus;
}

/** Arma el plan de sincronización (sin tocar Firestore) para que la UI
 *  pueda mostrar una vista previa antes de aplicar cualquier cambio. */
export function buildCrSyncPlan(orders: PurchaseOrder[], rows: PortalCrRow[]): PortalCrPlanItem[] {
  return rows.map((row) => {
    const match = matchOrderByCr(orders, row.cr);
    if (!match) return { row, match: null, noop: false };
    const current = currentPortalStatus(match);
    const noop = !row.estatus || current === row.estatus;
    return { row, match, noop };
  });
}

export function buildRevisionSyncPlan(orders: PurchaseOrder[], rows: PortalRevisionRow[]): PortalRevisionPlanItem[] {
  return rows.map((row) => {
    const match = matchOrderByFolio(orders, row.folio);
    if (!match) return { row, match: null, noop: false };
    const current = currentPortalStatus(match);
    const noop = current === 'sin_numero' || (!!match.order.invoices?.[match.invoiceIndex]?.collection?.contrareciboNumber);
    return { row, match, noop };
  });
}

export function buildPaymentSyncPlan(orders: PurchaseOrder[], rows: PortalPaymentRow[]): PortalPaymentPlanItem[] {
  return rows.map((row) => {
    // Match por transferRef o por monto exacto
    let match: OrderInvoiceMatch | null = null;
    let matchedCr: string | undefined = undefined;

    for (const order of orders) {
      if (order.invoices && order.invoices.length > 0) {
        for (let i = 0; i < order.invoices.length; i++) {
          const inv = order.invoices[i];
          const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          if (
            norm(inv.collection?.paymentDocument) === norm(row.transferRef) ||
            norm(inv.collection?.transferRef) === norm(row.transferRef) ||
            Math.abs(invTotal - row.total) < 0.99
          ) {
            match = { order, invoiceIndex: i };
            matchedCr = inv.collection?.contrareciboNumber || order.collection?.contrareciboNumber;
            break;
          }
        }
      }
      if (match) break;
    }

    const noop = match ? (
      (match.invoiceIndex >= 0 ? match.order.invoices?.[match.invoiceIndex]?.creditCycle?.status : match.order.creditCycle?.status) === 'paid' &&
      norm(match.invoiceIndex >= 0 ? match.order.invoices?.[match.invoiceIndex]?.collection?.transferRef : match.order.collection?.transferRef) === norm(row.transferRef)
    ) : false;

    return { row, matchedCr, match, noop };
  });
}

/** Aplica un item del plan de CR sobre el arreglo `invoices` de UN
 *  expediente (o marca los campos legacy si no hay invoices[]), regresando
 *  el patch de Firestore a escribir. Pura -- no toca la red. */
export function applyCrPlanItem(item: PortalCrPlanItem): { invoices?: Invoice[]; legacyPatch?: Record<string, unknown> } | null {
  if (!item.match || item.noop || !item.row.estatus) return null;
  const { order, invoiceIndex } = item.match;
  if (invoiceIndex >= 0 && order.invoices) {
    const invoices = order.invoices.map((inv, i) => {
      if (i !== invoiceIndex) return inv;
      return {
        ...inv,
        collection: {
          ...inv.collection,
          contrareciboPortalStatus: item.row.estatus!,
        },
      };
    });
    return { invoices };
  }
  return {
    legacyPatch: {
      'collection.contrareciboPortalStatus': item.row.estatus,
    },
  };
}
