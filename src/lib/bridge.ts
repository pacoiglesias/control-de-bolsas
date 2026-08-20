/**
 * Puente entre la app en la nube y el respaldo local en HTML.
 *
 * El HTML guarda un objeto `state` con pedidos, proveedores, entregas, caja y
 * facturas. La app guarda `purchaseOrders`. Aquí se traduce en ambos sentidos,
 * sin inventar datos: lo que no existe de un lado viaja vacío, no falseado.
 */
import type { FinancialConfig, PurchaseOrder, Purchase, Expense } from './types';
import { toDate } from './format';
import { getOrderSummary } from './finance';

export const HTML_TEMPLATE_PATH = '/respaldo/control-bolsas-offline.html';

/** Version del formato de `HtmlState` que se escribe en el respaldo HTML
 * offline. Subela si cambias la forma de alguno de sus campos, para poder
 * distinguir respaldos viejos de nuevos si algun dia se necesita migrar. */
export const HTML_STATE_VERSION = 4;

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
  purchases: Purchase[],
  expenses: Expense[],
  config: FinancialConfig,
  projectId: string,
  forHelpers: boolean = false
): HtmlState {
  let seq = 1;
  const facturas: HtmlFactura[] = orders
    .filter((o) => o.creditCycle?.status !== 'manual_review' || o.folio)
    .flatMap((o) => {
      const summary = getOrderSummary(o);
      return summary.invoices.map((inv) => {
        const st = inv.creditCycle.status;
        const cobranza: HtmlFactura['cobranza'] = (st === 'paid' || st === 'collected') ? 'COBRADO' : 'PENDIENTE';
        const total = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const cr = inv.collection?.contrareciboNumber?.trim() ?? '';
        const ocNum = inv.oc ?? o.oc ?? '';
        const notas = [
          o.fileName ? `Archivo ${o.fileName}` : '',
          inv.kilos ? `${inv.kilos.toLocaleString('es-MX')} kg facturados` : '',
          o.aiError ? `La IA no pudo leer el PDF: ${o.aiError}` : '',
          inv.collection?.notes ?? '',
        ].filter(Boolean).join(' · ');

        const comm = inv.financials?.commission ?? (inv.financials?.saleTotal ? inv.financials.saleTotal * config.commissionRate : (inv.kilos ? inv.kilos * config.salePricePerKg * config.commissionRate : 0));

        return {
          id: `app-${inv.id}`,
          seq: seq++,
          folio: inv.folio ?? '',
          cliente: o.client ?? '',
          receptor: '',
          oc: ocNum,
          fechaFactura: iso(toDate(inv.creditCycle.issueDate) ?? toDate(o.processedAt)),
          montoTotal: total,
          contrarecibo: cr ? 'SI' : 'NO',
          numContrarecibo: cr,
          fechaContrarecibo: iso(toDate(inv.collection?.contrareciboDate)),
          fechaVencimiento: iso(toDate(inv.creditCycle.dueDate)),
          cobranza,
          montoCobrado: (st === 'paid' || st === 'collected') ? (inv.collection?.paidAmount || total) : (inv.collection?.paidAmount ?? 0),
          comision: forHelpers ? 0 : comm,
          comisionManual: true,
          montoDepositado: 0,
          fechaCobro: iso(toDate(inv.collection?.paidAt)),
          fechaDeposito: '',
          pedidoId: null,
          notas,
          historial: [{ ts: new Date().toLocaleString('es-MX'), texto: 'Importada desde la app en la nube.' }],
        };
      });
    });

  const clientes = Array.from(
    new Set(orders.map((o) => o.client?.trim()).filter((c): c is string => !!c)),
  );

  let cajaSeq = 1;
  const caja = expenses.map((e) => ({
    id: `app-exp-${e.id}`,
    seq: cajaSeq++,
    fecha: iso(toDate(e.date)),
    concepto: e.concept || '',
    entrada: e.type === 'ingreso' ? e.amount : 0,
    salida: e.type === 'egreso' ? e.amount : 0,
    tipo: 'Efectivo/Transferencia',
    facturaId: null,
  }));

  let provSeq = 1;
  const proveedores = purchases.map((p) => ({
    id: `app-pur-${p.id}`,
    seq: provSeq++,
    pedidoId: null,
    proveedor: p.provider || '',
    fecha: iso(toDate(p.date)),
    concepto: p.notes || `Compra desde app`,
    kilos: p.expectedKilos || 0,
    kilosRecibidos: p.receivedKilos || 0,
    fechaPrometida: '',
    fechaRecepcion: '',
    costoKilo: p.pricePerKg || 0,
    abono: p.paidAmount || 0,
    estado: p.status === 'pedido' ? 'Pendiente' : (p.status === 'parcial' ? 'Parcial' : 'Entregado'),
  }));

  return {
    version: HTML_STATE_VERSION,
    sync: {
      fuente: 'Control Bolsas v5 (Firebase)',
      fecha: new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      proyecto: projectId,
      conteos: `${facturas.length} facturas, ${proveedores.length} compras, ${caja.length} movs caja`,
    },
    params: {
      iva: config.ivaRate,
      refCosto: forHelpers ? 0 : config.costPricePerKg,
      refPrecio: config.salePricePerKg,
      porcentajeComision: forHelpers ? 0 : config.commissionRate,
      comisionBase: 'total',
      comisionBaseIVA: config.commissionBase === 'subtotal' ? 'sin' : 'con',
      diasPlazoContrarecibo: config.creditDays,
    },
    catalogos: { proveedores: ['Andres'], clientes: clientes.length ? clientes : ['GT', 'TH'] },
    pedidos: [],
    proveedores,
    entregas: [],
    caja,
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
