import { useMemo } from 'react';
import { round2, extractCr, computeCommissionFromInvoiceTotal } from '../lib/finance';
import { fmtDate, toDate } from '../lib/format';
import type { OrderStatus, PurchaseOrder, FinancialConfig } from '../lib/types';

/**
 * FIX (v8.9.10, split de AuditSync.tsx — 1,538 líneas): las constantes
 * (OFFICIAL_MAP, ESTATUS_VALIDOS) y las dos tablas calculadas en vivo
 * (auditoriaCartera, gridRows) eran ~370 líneas de cómputo puro -- sin
 * JSX, sin efectos secundarios, sin Firestore -- mezcladas dentro del
 * mismo archivo que los handlers de escritura y la UI. Se extraen aquí
 * como constantes + hooks, mismo patrón ya usado en
 * src/hooks/useDashboardStatsV2.ts y src/pages/DashboardReports.ts.
 * AuditSync.tsx conserva los handlers que sí escriben a Firestore
 * (handleCellSave, handleMarkCollected, handleArchiveOrder, etc.) y toda
 * la UI, y solo llama a estos hooks para obtener las filas calculadas.
 */

export const ESTATUS_VALIDOS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Por Cobrar (Con CR)' },
  { value: 'facturado', label: 'En Revisión (Sin CR)' },
  { value: 'paid', label: '✅ Pagado / Cobrado' },
  { value: 'overdue', label: '🚨 Vencido' },
  { value: 'pedido', label: '📦 En Proceso' },
  { value: 'manual_review', label: '🔍 Revisión Manual' },
];

export const OFFICIAL_MAP: Record<string, { total: number; issueDate: string; dueDate: string }> = {
  'TH-912': { total: 79826.00, issueDate: '2026-08-10', dueDate: '2026-09-09' },
  'TH-879': { total: 136300.00, issueDate: '2026-08-03', dueDate: '2026-09-02' },
  'TH-836': { total: 106720.17, issueDate: '2026-07-27', dueDate: '2026-08-26' },
  'GT-742': { total: 54520.00, issueDate: '2026-07-20', dueDate: '2026-08-19' },
  'TH-804': { total: 136300.00, issueDate: '2026-07-20', dueDate: '2026-08-19' },
  'GT-713': { total: 69001.60, issueDate: '2026-07-13', dueDate: '2026-08-12' },
  'TH-768': { total: 125254.25, issueDate: '2026-07-13', dueDate: '2026-08-12' },
  'GT-651': { total: 106477.56, issueDate: '2026-06-29', dueDate: '2026-07-29' },
  'GT-624': { total: 98136.00, issueDate: '2026-06-22', dueDate: '2026-07-22' },
  'GT-597': { total: 107420.76, issueDate: '2026-06-15', dueDate: '2026-07-15' },
  '6167': { total: 81780.00, issueDate: '2026-08-10', dueDate: '' },
  '120267114014': { total: 81780.00, issueDate: '2026-08-10', dueDate: '' },
};

export type ModeTab = 'grid' | 'paste' | 'batch' | 'excel';

export interface AuditGridRow {
  key: string;
  orderId: string;
  invoiceId?: string;
  oc: string;
  cliente: string;
  folio: string;
  contrarecibo: string;
  kilos: number;
  precioVenta: number;
  costoAndres: number;
  subtotal: number;
  iva: number;
  totalFactura: number;
  comision: number;
  netoCaja: number;
  estatus: OrderStatus;
  fechaEmision: string;
  fechaVencimiento: string;
  rawOrder: PurchaseOrder;
}

/** Totales Auditados en Vivo (Con Deduplicación y Auto-Resolución) */
export function useAuditoriaCartera(activeOrders: PurchaseOrder[], config: FinancialConfig) {
  return useMemo(() => {
    let totalCrs = 0;
    let countCrs = 0;
    let totalRevision = 0;
    let countRevision = 0;
    let totalKilos = 0;
    const seenUniqueKeys = new Set<string>();

    activeOrders.forEach((o) => {
      const invoices = o.invoices || [];
      const defaultSale = config.salePricePerKg || 43;
      const pVenta = o.customSellPrice || defaultSale;

      if (invoices.length === 0) {
        const cr = (o.collection?.contrareciboNumber || '').toUpperCase().trim();
        const folio = (o.folio || '').toUpperCase().trim();
        const uniqueKey = cr || folio || o.oc || o.id;

        if (seenUniqueKeys.has(uniqueKey)) return;
        seenUniqueKeys.add(uniqueKey);

        const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
        let amt = (o.collection as any)?.total || (official ? official.total : 0);
        let k = o.totalKilograms || 0;

        if (k === 0 && amt > 0) {
          k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
        } else if (k > 0 && amt === 0) {
          amt = round2(k * pVenta * 1.16);
        } else if (k === 0 && amt === 0 && official) {
          amt = official.total;
          k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
        }

        totalKilos += k;

        if (cr) {
          totalCrs += amt;
          countCrs++;
        } else {
          totalRevision += amt;
          countRevision++;
        }
      } else {
        invoices.forEach((inv) => {
          const cr = extractCr(inv, o);
          const folio = (inv.folio || o.folio || '').toUpperCase().trim();
          const uniqueKey = cr || folio || o.oc || `${o.id}-${inv.id}`;

          if (seenUniqueKeys.has(uniqueKey)) return;
          seenUniqueKeys.add(uniqueKey);

          const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
          let amt = inv.financials?.invoiceTotal || (official ? official.total : 0);
          let k = inv.kilos || o.totalKilograms || 0;

          if (k === 0 && amt > 0) {
            k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
          } else if (k > 0 && amt === 0) {
            amt = round2(k * pVenta * 1.16);
          } else if (k === 0 && amt === 0 && official) {
            amt = official.total;
            k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
          }

          totalKilos += k;

          if (cr) {
            totalCrs += amt;
            countCrs++;
          } else {
            totalRevision += amt;
            countRevision++;
          }
        });
      }
    });

    const totalDeuda = round2(totalCrs + totalRevision);
    // FIX (auditoría v8.9.5): esta comisión estaba escrita a mano (8%) en vez
    // de leer config.commissionRate -- si algún día cambias el porcentaje en
    // Ajustes, esta pantalla de auditoría se quedaba mostrando el 8% viejo
    // mientras el resto del sistema ya usaba el nuevo. El 0.08 como respaldo
    // solo aplica si config no cargó todavía (mismo valor que DEFAULT_CONFIG).
    const comisionRate = config?.commissionRate ?? 0.08;
    // FIX (auditoría v8.9.10): dividía siempre entre un IVA fijo de 1.16 y
    // calculaba la comisión siempre sobre el subtotal, ignorando
    // config.ivaRate/config.commissionBase. Ahora usa
    // computeCommissionFromInvoiceTotal(), la fuente única de verdad.
    const comision8 = computeCommissionFromInvoiceTotal(totalDeuda, {
      commissionRate: comisionRate,
      commissionBase: config?.commissionBase || 'subtotal',
      ivaRate: typeof config?.ivaRate === 'number' ? config.ivaRate : 0.16,
    } as any);
    const netoCaja = round2(totalDeuda - comision8);

    return {
      totalCrs: round2(totalCrs),
      countCrs,
      totalRevision: round2(totalRevision),
      countRevision,
      totalDeuda,
      comision8,
      netoCaja,
      totalKilos: round2(totalKilos),
    };
  }, [activeOrders, config]);
}

/** 1. SÁBANA EN VIVO (DATA GRID) CON DEDUPLICACIÓN CANÓNICA Y FILTRADO MEMOIZADO */
export function useAuditSyncGrid(activeOrders: PurchaseOrder[], config: FinancialConfig, gridFilter: string): AuditGridRow[] {
  // Cómputo pesado del modelo de datos: solo se recalcula cuando cambian los pedidos o la configuración financiera
  const allRows = useMemo(() => {
    const rows: AuditGridRow[] = [];

    const defaultSale = config.salePricePerKg || 43;
    const defaultCost = config.costPricePerKg || 42;
    // FIX (auditoría v8.9.5): mismo motivo que arriba -- antes 0.08 estaba
    // escrito a mano dos veces en este mismo bloque.
    const comisionRate = config.commissionRate ?? 0.08;
    const seenUniqueKeys = new Set<string>();

    activeOrders.forEach((o) => {
      const pVenta = o.customSellPrice || defaultSale;
      const pCosto = o.customCostPrice || defaultCost;
      const invoices = o.invoices || [];

      if (invoices.length === 0) {
        const cr = (o.collection?.contrareciboNumber || '').toUpperCase().trim();
        const folio = (o.folio || '').toUpperCase().trim();
        const uniqueKey = cr || folio || o.oc || o.id;

        if (seenUniqueKeys.has(uniqueKey)) return;
        seenUniqueKeys.add(uniqueKey);

        const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
        let tot = (o.collection as any)?.total || (official ? official.total : 0);
        let k = o.totalKilograms || 0;

        if (k === 0 && tot > 0) {
          k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
        } else if (k > 0 && tot === 0) {
          tot = round2(k * pVenta * 1.16);
        } else if (k === 0 && tot === 0 && official) {
          tot = official.total;
          k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
        }

        const sub = round2(tot / 1.16);
        const iva = round2(tot - sub);
        // FIX (auditoría v8.9.10): calculaba la comisión siempre sobre el
        // subtotal (sub), ignorando config.commissionBase. Ahora usa
        // computeCommissionFromInvoiceTotal(), la fuente única de verdad.
        const com = computeCommissionFromInvoiceTotal(tot, {
          commissionRate: comisionRate,
          commissionBase: config?.commissionBase || 'subtotal',
          ivaRate: typeof config?.ivaRate === 'number' ? config.ivaRate : 0.16,
        } as any);
        const neto = round2(tot - com);

        const dueStr = (o.collection as any)?.dueDate ? fmtDate((o.collection as any).dueDate) : (official && official.dueDate ? fmtDate(new Date(`${official.dueDate}T12:00:00`)) : '—');
        const issueStr = o.processedAt ? fmtDate(o.processedAt) : (official && official.issueDate ? fmtDate(new Date(`${official.issueDate}T12:00:00`)) : '—');

        rows.push({
          key: `${o.id}-root`,
          orderId: o.id,
          oc: o.folio || o.oc || (official ? cr : 'S/OC'),
          cliente: o.client || (cr.startsWith('TH') ? 'GRUPO TEXTIL PROVIDENCIA (TH)' : 'GRUPO TEXTIL PROVIDENCIA (GT)'),
          folio: o.folio || (official ? cr : '—'),
          contrarecibo: cr,
          kilos: k,
          precioVenta: pVenta,
          costoAndres: pCosto,
          subtotal: sub,
          iva,
          totalFactura: tot,
          comision: com,
          netoCaja: neto,
          estatus: (o.creditCycle?.status as OrderStatus) || 'pending',
          fechaEmision: issueStr,
          fechaVencimiento: dueStr,
          rawOrder: o,
        });
      } else {
        invoices.forEach((inv) => {
          const cr = extractCr(inv, o);
          const folio = (inv.folio || o.folio || '').toUpperCase().trim();
          const uniqueKey = cr || folio || o.oc || `${o.id}-${inv.id}`;

          if (seenUniqueKeys.has(uniqueKey)) return;
          seenUniqueKeys.add(uniqueKey);

          const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
          let tot = inv.financials?.invoiceTotal || (official ? official.total : 0);
          let k = inv.kilos || o.totalKilograms || 0;

          if (k === 0 && tot > 0) {
            k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
          } else if (k > 0 && tot === 0) {
            tot = round2(k * pVenta * 1.16);
          } else if (k === 0 && tot === 0 && official) {
            tot = official.total;
            k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
          }

          const sub = round2(tot / 1.16);
          const iva = round2(tot - sub);
          // FIX (auditoría v8.9.10): calculaba la comisión siempre sobre el
          // subtotal (sub), ignorando config.commissionBase. Ahora usa
          // computeCommissionFromInvoiceTotal(), la fuente única de verdad.
          const com = computeCommissionFromInvoiceTotal(tot, {
            commissionRate: comisionRate,
            commissionBase: config?.commissionBase || 'subtotal',
            ivaRate: typeof config?.ivaRate === 'number' ? config.ivaRate : 0.16,
          } as any);
          const neto = round2(tot - com);

          const issueObj = toDate(inv.creditCycle?.issueDate);
          const dueObj = toDate(inv.creditCycle?.dueDate);

          const dueStr = dueObj ? fmtDate(dueObj) : (official && official.dueDate ? fmtDate(new Date(`${official.dueDate}T12:00:00`)) : '—');
          const issueStr = issueObj ? fmtDate(issueObj) : (official && official.issueDate ? fmtDate(new Date(`${official.issueDate}T12:00:00`)) : '—');

          rows.push({
            key: `${o.id}-${inv.id}`,
            orderId: o.id,
            invoiceId: inv.id,
            oc: o.folio || o.oc || (official ? cr : 'S/OC'),
            cliente: o.client || (cr.startsWith('TH') ? 'GRUPO TEXTIL PROVIDENCIA (TH)' : 'GRUPO TEXTIL PROVIDENCIA (GT)'),
            folio: inv.folio || o.folio || (official ? cr : '—'),
            contrarecibo: cr,
            kilos: k,
            precioVenta: pVenta,
            costoAndres: pCosto,
            subtotal: sub,
            iva,
            totalFactura: tot,
            comision: com,
            netoCaja: neto,
            estatus: inv.creditCycle?.status || 'pending',
            fechaEmision: issueStr,
            fechaVencimiento: dueStr,
            rawOrder: o,
          });
        });
      }
    });

    return rows;
  }, [activeOrders, config]);

  // Filtrado instantáneo en memoria: no reconstruye el modelo de filas en cada tecla
  return useMemo(() => {
    const q = gridFilter.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.oc.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.folio.toLowerCase().includes(q) ||
        r.contrarecibo.toLowerCase().includes(q) ||
        r.estatus.toLowerCase().includes(q)
    );
  }, [allRows, gridFilter]);
}
