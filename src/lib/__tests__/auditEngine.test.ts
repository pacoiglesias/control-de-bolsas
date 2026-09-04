import { describe, it, expect } from 'vitest';
import { runContinuousAutoAudit } from '../auditEngine';
import { DEFAULT_CONFIG } from '../types';

describe('Motor de Auto-Auditoría Continua (auditEngine)', () => {
  it('otorga score de 100 y 0 anomalías cuando todo el ERP está cuadrado y sin pendientes', () => {
    const perfectOrder: any = {
      id: 'ord-1',
      oc: '120267114114',
      totalKilograms: 1000,
      client: 'TEXTIL HOGAR (TH - NAVA)',
      department: 'TH-ALMACEN-1',
      deliveries: [
        { id: 'd1', kilos: 1000, invoiced: true },
      ],
      invoices: [
        {
          id: 'inv-1',
          folio: '6198',
          kilos: 1000,
          collection: { contrareciboNumber: 'TH-990' },
          creditCycle: { status: 'paid' },
        },
      ],
    };

    const report = runContinuousAutoAudit({
      orders: [perfectOrder],
      purchases: [{ id: 'p1', provider: 'Andres', receivedKilos: 1000, pricePerKg: 38 } as any],
      expenses: [{ id: 'e1', type: 'ingreso', amount: 50000, provider: '' } as any],
      config: { ...DEFAULT_CONFIG, historicalDebtAndres: 103411.84 },
    });

    expect(report.score).toBe(100);
    expect(report.totalAnomalies).toBe(0);
    expect(report.subsystemHealth.bascula.status).toBe('ok');
    expect(report.subsystemHealth.cobranza.status).toBe('ok');
  });

  it('detecta kilos en patio sin facturar y calcula el impacto financiero a $43 + 16% IVA', () => {
    const orderWithUninvoiced: any = {
      id: 'ord-th-patio',
      oc: '120267114114',
      totalKilograms: 6411.01,
      client: 'TEXTIL HOGAR (TH - NAVA)',
      department: 'TH-ALMACEN-1',
      deliveries: [
        { id: 'd1', kilos: 3465.81, invoiced: true },
        { id: 'd2', kilos: 2945.20, invoiced: false },
      ],
      invoices: [
        { id: 'inv-1', folio: '6198', kilos: 3465.81, collection: { contrareciboNumber: 'TH-990' }, creditCycle: { status: 'pending' } },
      ],
    };

    const report = runContinuousAutoAudit({
      orders: [orderWithUninvoiced],
      purchases: [],
      expenses: [{ id: 'e1', type: 'ingreso', amount: 10000 } as any],
      config: { ...DEFAULT_CONFIG, salePricePerKg: 43, ivaRate: 0.16 },
    });

    const patioAnomaly = report.anomalies.find(a => a.category === 'facturacion_sat');
    expect(patioAnomaly).toBeDefined();
    expect(patioAnomaly?.financialImpact?.kilos).toBe(2945.20);
    expect(patioAnomaly?.financialImpact?.amount).toBe(146906.58);
    expect(patioAnomaly?.autoFixType).toBe('open_invoice_modal');
  });

  it('detecta cruce departamental de contrarecibos (prefijo TH en expediente GT)', () => {
    const orderGtWithThCr: any = {
      id: 'ord-gt-bad',
      oc: '12026439713',
      totalKilograms: 1000,
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      department: 'P4-ALM',
      deliveries: [{ id: 'd1', kilos: 1000, invoiced: true }],
      invoices: [
        {
          id: 'inv-bad',
          folio: '6193',
          kilos: 1000,
          collection: { contrareciboNumber: 'TH-990' }, // 🚨 ERROR: Prefijo TH en cliente GT
          creditCycle: { status: 'pending' },
        },
      ],
    };

    const report = runContinuousAutoAudit({
      orders: [orderGtWithThCr],
      purchases: [],
      expenses: [{ id: 'e1', type: 'ingreso', amount: 10000 } as any],
      config: DEFAULT_CONFIG,
    });

    const crossAnomaly = report.anomalies.find(a => a.id.startsWith('cross_dept_th_in_gt'));
    expect(crossAnomaly).toBeDefined();
    expect(crossAnomaly?.severity).toBe('critical');
    expect(crossAnomaly?.autoFixType).toBe('route_cr');
  });

  it('detecta saldo negativo en caja chica como anomalía crítica', () => {
    const report = runContinuousAutoAudit({
      orders: [],
      purchases: [],
      expenses: [
        { id: 'e1', type: 'egreso', amount: 15000 } as any, // 🚨 Sin ingresos previos
      ],
      config: DEFAULT_CONFIG,
    });

    const cajaAnomaly = report.anomalies.find(a => a.category === 'caja_chica');
    expect(cajaAnomaly).toBeDefined();
    expect(cajaAnomaly?.severity).toBe('critical');
    expect(cajaAnomaly?.autoFixType).toBe('calibrate_caja');
  });
});
