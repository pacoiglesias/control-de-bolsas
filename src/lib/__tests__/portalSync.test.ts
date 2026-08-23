import { describe, it, expect } from 'vitest';
import {
  parsePortalPaste,
  parseMoneyEs,
  parseMexicanDate,
  normalizePortalEstatus,
  matchOrderByCr,
  matchOrderByFolio,
  buildCrSyncPlan,
  buildRevisionSyncPlan,
  buildPaymentSyncPlan,
  applyCrPlanItem,
} from '../portalSync';
import type { PurchaseOrder } from '../types';

const TABLA_CR = `CONTRARECIBOS
No\tContrarecibo\tFecha   \tVencimiento   \tTotal\tPagado\tPendiente\tMoneda\tTC\tEstatus\tAcción
1\tTH-768\t13/07/2026\t12/8/2026\t125,254.25\t0\t125,254.25\tPMX\t1\tEN PROCESO DE PAGO\tPicture
2\tGT-624\t22/06/2026\t22/07/2026\t98,136.00\t0\t98,136.00\tPMX\t1\tEN PROCESO DE PAGO\tPicture
3\tGT-597\t15/06/2026\t15/07/2026\t107,420.76\t0\t107,420.76\tPMX\t1\tEN PROCESO DE PAGO\tPicture`;

const TABLA_PAGOS = `PAGOS YA COBRADOS
PR50823\tTR_3640\t7/31/2026\t80,970.38\tMXN
PR50823\tTR_3620\t7/30/2026\t196,482.30\tMXN
PR50823\tTR_3583\t7/27/2026\t182,250.55\tMXN`;

const TABLA_GENERADO = `CONTRARECIBOS
No\tContrarecibo\tFecha   \tVencimiento   \tTotal\tPagado\tPendiente\tMoneda\tTC\tEstatus\tAcción
1\tTH-946\t17/08/2026\t16/09/2026\t81,780.00\t0\t81,780.00\tPMX\t1\tGENERADO\tPicture
2\tTH-912\t10/8/2026\t9/9/2026\t79,826.00\t0\t79,826.00\tPMX\t1\tGENERADO\tPicture`;

const TABLA_REVISION = `FACURAS EN REVISION PENDIENTES DE NUMERO DE CONTRARECIBO\t\t\t\t\t\t\t\t162 resultados, página 1 de 7.\t ►►
A V I S O S   P A R A   P R O V E E D O R E S
No\tReceptor\tO C   \tVersión\tTipo\tFolio\tFecha Factura   \tFecha Envío   \tTotal\tStat\tDOCA\tXML\tPDF
1\tGTP930115PU1\t1.20267E+11\t4\tI\t6198\t2026-08-20T09:34:40\t20/Agosto/2026\t98,054.60\tPicture\tPicture\tPicture\tPicture
2\tGTP930115PU1\t12026439713\t4\tI\t6193\t2026-08-19T13:52:37\t19/Agosto/2026\t49,880.00\tPicture\tPicture\tPicture\tPicture`;

describe('parseMoneyEs', () => {
  it('parsea montos con comas de miles', () => {
    expect(parseMoneyEs('125,254.25')).toBe(125254.25);
    expect(parseMoneyEs('0')).toBe(0);
    expect(parseMoneyEs(undefined)).toBe(0);
    expect(parseMoneyEs('')).toBe(0);
  });
});

describe('parseMexicanDate', () => {
  it('parsea D/M/AAAA y DD/MM/AAAA', () => {
    expect(parseMexicanDate('13/07/2026')).toBe('2026-07-13');
    expect(parseMexicanDate('12/8/2026')).toBe('2026-08-12');
    expect(parseMexicanDate('9/9/2026')).toBe('2026-09-09');
  });
  it('acepta ISO y lo recorta a la fecha', () => {
    expect(parseMexicanDate('2026-08-20T09:34:40')).toBe('2026-08-20');
  });
  it('regresa null para valores no reconocidos', () => {
    expect(parseMexicanDate('20/Agosto/2026')).toBeNull();
    expect(parseMexicanDate(undefined)).toBeNull();
  });
});

describe('normalizePortalEstatus', () => {
  it('mapea los textos del portal al enum interno', () => {
    expect(normalizePortalEstatus('GENERADO')).toBe('generado');
    expect(normalizePortalEstatus('EN PROCESO DE PAGO')).toBe('en_proceso_pago');
    expect(normalizePortalEstatus('PAGADO')).toBe('pagado');
    expect(normalizePortalEstatus('En Revisión (Pendiente de Contrarecibo)')).toBe('sin_numero');
    expect(normalizePortalEstatus('algo-desconocido')).toBeNull();
  });
});

describe('parsePortalPaste', () => {
  it('reconoce la tabla de Contrarecibos "EN PROCESO DE PAGO"', () => {
    const r = parsePortalPaste(TABLA_CR);
    expect(r.format).toBe('cr');
    if (r.format !== 'cr') throw new Error('formato inesperado');
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({ cr: 'TH-768', total: 125254.25, estatus: 'en_proceso_pago', fecha: '2026-07-13', vencimiento: '2026-08-12' });
    expect(r.rows[1].cr).toBe('GT-624');
    expect(r.rows[2].cr).toBe('GT-597');
  });

  it('reconoce la tabla de Contrarecibos "GENERADO"', () => {
    const r = parsePortalPaste(TABLA_GENERADO);
    expect(r.format).toBe('cr');
    if (r.format !== 'cr') throw new Error('formato inesperado');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].estatus).toBe('generado');
  });

  it('reconoce la tabla de Facturas en Revisión, ignora ruido de título/paginación', () => {
    const r = parsePortalPaste(TABLA_REVISION);
    expect(r.format).toBe('revision');
    if (r.format !== 'revision') throw new Error('formato inesperado');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ folio: '6198', total: 98054.60, fechaFactura: '2026-08-20' });
    expect(r.rows[1].folio).toBe('6193');
  });

  it('regresa "unknown" si no reconoce ninguna tabla', () => {
    const r = parsePortalPaste('esto no es ninguna tabla del portal');
    expect(r.format).toBe('unknown');
    expect(r.rows).toHaveLength(0);
  });
});

function mkOrder(overrides: Partial<PurchaseOrder>): PurchaseOrder {
  return { id: 'o1', ...overrides } as PurchaseOrder;
}

describe('matchOrderByCr / matchOrderByFolio', () => {
  it('encuentra el match por número de contrarecibo dentro de invoices[]', () => {
    const orders = [mkOrder({ id: 'o1', invoices: [{ id: 'i1', orderId: 'o1', kilos: 100, creditCycle: { status: 'pending' }, collection: { contrareciboNumber: 'th-768' } } as any] })];
    const m = matchOrderByCr(orders, 'TH-768');
    expect(m).not.toBeNull();
    expect(m?.order.id).toBe('o1');
    expect(m?.invoiceIndex).toBe(0);
  });

  it('regresa null si no hay coincidencia', () => {
    const orders = [mkOrder({ id: 'o1', invoices: [] })];
    expect(matchOrderByCr(orders, 'TH-999')).toBeNull();
  });

  it('encuentra el match por folio en la tabla de revisión', () => {
    const orders = [mkOrder({ id: 'o2', invoices: [{ id: 'i2', orderId: 'o2', kilos: 50, folio: '6198', creditCycle: { status: 'facturado' } } as any] })];
    const m = matchOrderByFolio(orders, '6198');
    expect(m?.order.id).toBe('o2');
    expect(m?.invoiceIndex).toBe(0);
  });
});

describe('buildCrSyncPlan / applyCrPlanItem', () => {
  it('marca noop cuando el estatus ya coincide, y genera patch cuando cambia', () => {
    const orders = [
      mkOrder({ id: 'o1', invoices: [{ id: 'i1', orderId: 'o1', kilos: 100, creditCycle: { status: 'pending' }, collection: { contrareciboNumber: 'TH-768', contrareciboPortalStatus: 'generado' } } as any] }),
    ];
    const parsed = parsePortalPaste(TABLA_CR);
    if (parsed.format !== 'cr') throw new Error('formato inesperado');
    const plan = buildCrSyncPlan(orders, parsed.rows);
    expect(plan).toHaveLength(3);
    const th768 = plan.find((p) => p.row.cr === 'TH-768')!;
    expect(th768.noop).toBe(false); // generado -> en_proceso_pago, sí cambia
    const patch = applyCrPlanItem(th768);
    expect(patch?.invoices?.[0].collection?.contrareciboPortalStatus).toBe('en_proceso_pago');

    const sinMatch = plan.find((p) => p.row.cr === 'GT-624')!;
    expect(sinMatch.match).toBeNull();
    expect(applyCrPlanItem(sinMatch)).toBeNull();
  });
});

describe('buildRevisionSyncPlan', () => {
  it('detecta facturas ya con CR asignado como noop', () => {
    const orders = [
      mkOrder({ id: 'o2', invoices: [{ id: 'i2', orderId: 'o2', kilos: 50, folio: '6198', creditCycle: { status: 'facturado' }, collection: { contrareciboNumber: 'TH-999' } } as any] }),
    ];
    const parsed = parsePortalPaste(TABLA_REVISION);
    if (parsed.format !== 'revision') throw new Error('formato inesperado');
    const plan = buildRevisionSyncPlan(orders, parsed.rows);
    const row6198 = plan.find((p) => p.row.folio === '6198')!;
    expect(row6198.noop).toBe(true); // ya tiene CR, no se debe marcar "sin_numero"
  });
});

describe('parsePortalPaste (Pagos Ya Cobrados)', () => {
  it('reconoce la tabla de Pagos Cobrados con formato TR_xxxx', () => {
    const parsed = parsePortalPaste(TABLA_PAGOS);
    expect(parsed.format).toBe('payments');
    if (parsed.format !== 'payments') throw new Error('formato inesperado');
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({
      provider: 'PR50823',
      transferRef: 'TR_3640',
      fecha: '2026-07-31',
      total: 80970.38,
      moneda: 'MXN'
    });
    expect(parsed.rows[1].transferRef).toBe('TR_3620');
    expect(parsed.rows[2].transferRef).toBe('TR_3583');
  });

  it('arma el plan de pagos detectando facturas asociadas', () => {
    const orders = [
      mkOrder({
        id: 'o1',
        invoices: [{
          id: 'i1',
          orderId: 'o1',
          financials: { invoiceTotal: 80970.38 } as any,
          collection: { contrareciboNumber: 'TH-680' }
        } as any]
      })
    ];
    const parsed = parsePortalPaste(TABLA_PAGOS);
    if (parsed.format !== 'payments') throw new Error('formato inesperado');
    const plan = buildPaymentSyncPlan(orders, parsed.rows);
    expect(plan).toHaveLength(3);
    const p1 = plan.find(p => p.row.transferRef === 'TR_3640');
    expect(p1?.match?.order.id).toBe('o1');
    expect(p1?.matchedCr).toBe('TH-680');
  });
});
