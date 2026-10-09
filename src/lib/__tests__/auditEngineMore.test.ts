import { describe, it, expect } from 'vitest';
import { runContinuousAutoAudit } from '../auditEngine';
import type { PurchaseOrder, FinancialConfig } from '../types';
import { Timestamp } from 'firebase/firestore';

describe('auditEngine Extended Unit Tests', () => {
  const baseConfig: FinancialConfig = {
    salePricePerKg: 43,
    costPricePerKg: 38,
    commissionRate: 0.08,
    creditDays: 30,
    ivaRate: 0.16,
    commissionBase: 'subtotal',
  };

  it('detects partial delivery tolerance anomaly when delivery is >=95% and shortfall <=150 kg', () => {
    const order: PurchaseOrder = {
      id: 'ord-tolerance',
      oc: '12026439784',
      folio: '43/9784',
      client: 'GRUPO TEXTIL PROVIDENCIA',
      department: 'P4-GT',
      totalKilograms: 1000,
      customSellPrice: 43,
      deliveries: [
        {
          id: 'del-1',
          date: Timestamp.now(),
          kilos: 960, // 96% entregado, faltante 40 kg <= 150 kg
          invoiced: false,
        },
      ],
      invoices: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const report = runContinuousAutoAudit({
      orders: [order],
      purchases: [],
      expenses: [],
      config: baseConfig,
    });

    const anomaly = report.anomalies.find((a) => a.id === `oc_partial_tolerance_${order.id}`);
    expect(anomaly).toBeDefined();
    expect(anomaly?.severity).toBe('info');
    expect(anomaly?.financialImpact?.kilos).toBe(40);
  });

  it('detects unbilled deliveries in patio ready to invoice', () => {
    const order: PurchaseOrder = {
      id: 'ord-unbilled',
      oc: '120267114302',
      folio: '71/14302',
      client: 'TEXTIL HOGAR',
      department: 'TH',
      totalKilograms: 2000,
      customSellPrice: 43,
      deliveries: [
        {
          id: 'del-1',
          date: Timestamp.now(),
          kilos: 1500,
          invoiced: false,
        },
      ],
      invoices: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const report = runContinuousAutoAudit({
      orders: [order],
      purchases: [],
      expenses: [],
      config: baseConfig,
    });

    const anomaly = report.anomalies.find((a) => a.id === `deliveries_ready_to_invoice_${order.id}`);
    expect(anomaly).toBeDefined();
    expect(anomaly?.category).toBe('facturacion_sat');
    expect(anomaly?.severity).toBe('warning');
    expect(anomaly?.financialImpact?.kilos).toBe(1500);
  });

  it('detects cross-department contrarecibos (e.g. GT prefix in TH order or vice versa)', () => {
    const orderTH: PurchaseOrder = {
      id: 'ord-th',
      oc: '120267114302',
      folio: '71/14302',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      department: 'TH',
      totalKilograms: 1000,
      customSellPrice: 43,
      deliveries: [],
      invoices: [
        {
          id: 'inv-th-1',
          folio: 'FAC-901',
          kilos: 1000,
          orderId: 'ord-th',
          collection: {
            contrareciboNumber: 'GT-713', // Cruzado: GT en TH
          },
          creditCycle: {
            status: 'pending',
            dueDate: Timestamp.now(),
          },
        },
      ],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const orderGT: PurchaseOrder = {
      id: 'ord-gt',
      oc: '12026439784',
      folio: '43/9784',
      client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      department: 'GT',
      totalKilograms: 1000,
      customSellPrice: 43,
      deliveries: [],
      invoices: [
        {
          id: 'inv-gt-1',
          folio: 'FAC-902',
          kilos: 1000,
          orderId: 'ord-gt',
          collection: {
            contrareciboNumber: 'TH-879', // Cruzado: TH en GT
          },
          creditCycle: {
            status: 'pending',
            dueDate: Timestamp.now(),
          },
        },
      ],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const report = runContinuousAutoAudit({
      orders: [orderTH, orderGT],
      purchases: [],
      expenses: [],
      config: baseConfig,
    });

    const thAnomaly = report.anomalies.find((a) => a.id.startsWith('cross_dept_gt_in_th'));
    const gtAnomaly = report.anomalies.find((a) => a.id.startsWith('cross_dept_th_in_gt'));

    expect(thAnomaly).toBeDefined();
    expect(thAnomaly?.severity).toBe('critical');

    expect(gtAnomaly).toBeDefined();
    expect(gtAnomaly?.severity).toBe('critical');
  });

  it('detects overdue contrarecibos without payment registered', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 15); // Vencido hace 15 días

    const order: PurchaseOrder = {
      id: 'ord-overdue',
      oc: '12026439784',
      folio: '43/9784',
      client: 'GRUPO TEXTIL PROVIDENCIA',
      department: 'GT',
      totalKilograms: 1000,
      customSellPrice: 43,
      deliveries: [],
      invoices: [
        {
          id: 'inv-od',
          folio: '6053',
          kilos: 1000,
          orderId: 'ord-overdue',
          collection: {
            contrareciboNumber: 'GT-713',
          },
          creditCycle: {
            status: 'pending',
            dueDate: Timestamp.fromDate(pastDate),
          },
        },
      ],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const report = runContinuousAutoAudit({
      orders: [order],
      purchases: [],
      expenses: [],
      config: baseConfig,
    });

    const overdueAnomaly = report.anomalies.find((a) => a.id.startsWith('cr_overdue_GT-713'));
    expect(overdueAnomaly).toBeDefined();
    expect(overdueAnomaly?.severity).toBe('critical');
    expect(report.subsystemHealth.cobranza.status).not.toBe('ok');
  });
});
