/**
 * Puente entre la app en la nube y el respaldo local en HTML.
 *
 * El HTML guarda un objeto `state` con pedidos, proveedores, entregas, caja y
 * facturas. La app guarda `purchaseOrders`. Aquí se traduce en ambos sentidos,
 * sin inventar datos: lo que no existe de un lado viaja vacío, no falseado.
 */
import type { FinancialConfig, PurchaseOrder } from './types';
import { toDate } from './format';

export const HTML_TEMPLATE_PATH = '/respaldo/control-bolsas-offline.html';

export interface HtmlFactura {
  id: string;
  seq: number;
  folio: string;
  cliente: string;
  receptor: string;
  oc: string;
  fechaFactura: string;
  montoTotal: number;
  contrarecibo: 'SI' | 'NO';
  numContrarecibo: string;
  fechaContrarecibo: string;
  fechaVencimiento: string;
  cobranza: 'PENDIENTE' | 'PARCIAL' | 'COBRADO' | 'DEPOSITADO' | 'CANCELADO';
  montoCobrado: number;
  comision: number;
  comisionManual: boolean;
  montoDepositado: number;
  fechaCobro: string;
  fechaDeposito: string;
  pedidoId: string | null;
  notas: string;
  historial: { ts: string; texto: string }[];
}

export interface HtmlState {
  version: number;
  sync: { fuente: string; fecha: string; proyecto: string; conteos: string };
  params: Record<string, unknown>;
  catalogos: { proveedores: string[]; clientes: string[] };
  pedidos: unknown[];
  proveedores: unknown[];
  entregas: unknown[];
  caja: unknown[];
  facturas: HtmlFactura[];
}

const iso = (d: Date | null): string =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '';

/** app → HTML */
export function ordersToHtmlState(
  orders: PurchaseOrder[],
  config: FinancialConfig,
  projectId: string,
): HtmlState {
  let seq = 1;
  const facturas: HtmlFactura[] = orders
    .filter((o) => o.creditCycle?.status !== 'manual_review' || o.folio)
    .map((o) => {
      const st = o.creditCycle?.status ?? 'pending';
      // La app maneja tres estados; el HTML deriva "vencido" de las fechas,
      // así que overdue y pending viajan igual: por cobrar.
      const cobranza: HtmlFactura['cobranza'] = st === 'paid' ? 'COBRADO' : 'PENDIENTE';
      const total = o.financials?.invoiceTotal ?? o.financials?.saleTotal ?? 0;
      const cr = o.collection?.contrareciboNumber?.trim() ?? '';
      const notas = [
        o.fileName ? `Archivo ${o.fileName}` : '',
        o.totalKilograms ? `${o.totalKilograms.toLocaleString('es-MX')} kg` : '',
        o.aiError ? `La IA no pudo leer el PDF: ${o.aiError}` : '',
        o.collection?.notes ?? '',
      ]
        .filter(Boolean)
        .join(' · ');

      return {
        id: `app-${o.id}`,
        seq: seq++,
        folio: o.folio ?? '',
        cliente: o.client ?? '',
        receptor: '',
        oc: '',
        fechaFactura: iso(toDate(o.creditCycle?.issueDate) ?? toDate(o.processedAt)),
        montoTotal: total,
        contrarecibo: cr ? 'SI' : 'NO',
        numContrarecibo: cr,
        fechaContrarecibo: iso(toDate(o.collection?.contrareciboDate)),
        fechaVencimiento: iso(toDate(o.creditCycle?.dueDate)),
        cobranza,
        montoCobrado: st === 'paid' ? (o.collection?.paidAmount || total) : (o.collection?.paidAmount ?? 0),
        // La comisión viaja ya calculada y marcada como manual: así el HTML
        // respeta el número exacto de la app en vez de recalcularlo con otra base.
        comision: o.financials?.commission ?? 0,
        comisionManual: true,
        montoDepositado: 0,
        fechaCobro: iso(toDate(o.collection?.paidAt)),
        fechaDeposito: '',
        pedidoId: null,
        notas,
        historial: [{ ts: new Date().toLocaleString('es-MX'), texto: 'Importada desde la app en la nube.' }],
      };
    });

  const clientes = Array.from(
    new Set(orders.map((o) => o.client?.trim()).filter((c): c is string => !!c)),
  );

  return {
    version: 4,
    sync: {
      fuente: 'Control Bolsas v5 (Firebase)',
      fecha: new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      proyecto: projectId,
      conteos: `${facturas.length} facturas`,
    },
    params: {
      iva: config.ivaRate,
      refCosto: config.costPricePerKg,
      refPrecio: config.salePricePerKg,
      porcentajeComision: config.commissionRate,
      comisionBase: 'total',
      comisionBaseIVA: config.commissionBase === 'subtotal' ? 'sin' : 'con',
      diasPlazoContrarecibo: config.creditDays,
    },
    catalogos: { proveedores: ['Andres'], clientes: clientes.length ? clientes : ['GT', 'TH'] },
    pedidos: [],
    proveedores: [],
    entregas: [],
    caja: [],
    facturas,
  };
}

/** Inserta los datos dentro del HTML para que el archivo funcione sin internet. */
export function embedIntoHtml(template: string, data: HtmlState): string {
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  const marker = '<script>\n"use strict";';
  const inject = `<script>window.__CB_SEED__=${payload};</script>\n${marker}`;
  if (!template.includes(marker)) {
    throw new Error('La plantilla HTML no tiene el punto de inserción esperado.');
  }
  return template.replace(marker, inject);
}

export interface HtmlImportSummary {
  facturas: number;
  conFolio: number;
  cobradas: number;
  totalFacturado: number;
  totalCobrado: number;
  pedidos: number;
  entregas: number;
  caja: number;
}

/** HTML → app: revisa qué trae el archivo antes de escribir nada. */
export function summarizeHtmlBackup(data: Partial<HtmlState>): HtmlImportSummary {
  const f = (data.facturas ?? []) as HtmlFactura[];
  return {
    facturas: f.length,
    conFolio: f.filter((x) => (x.folio ?? '').trim()).length,
    cobradas: f.filter((x) => x.cobranza === 'COBRADO' || x.cobranza === 'DEPOSITADO').length,
    totalFacturado: f.reduce((a, x) => a + (Number(x.montoTotal) || 0), 0),
    totalCobrado: f.reduce((a, x) => a + (Number(x.montoCobrado) || 0), 0),
    pedidos: (data.pedidos ?? []).length,
    entregas: (data.entregas ?? []).length,
    caja: (data.caja ?? []).length,
  };
}
