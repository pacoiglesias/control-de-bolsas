import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildMasterExcelWorkbook } from '../masterExcelExporter';
import { exportOfflineWorkbook, parseAndDiffOfflineWorkbook } from '../offlineExcelSync';
import { ordersToHtmlState, summarizeHtmlBackup } from '../bridge';
import { extractCr, getOrderSummary } from '../finance';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from '../types';

describe('Excel Backups & Mobile Data Verification Suite', () => {
  const dummyConfig: FinancialConfig = {
    salePricePerKg: 43.0,
    costPricePerKg: 38.0,
    ivaRate: 0.16,
    commissionRate: 0.08,
    creditDays: 30,
    commissionBase: 'subtotal',
  };

  const sampleOrders: PurchaseOrder[] = [
    {
      id: 'oc-th-test',
      oc: '120267114302',
      folio: '71/14302',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      department: 'TH',
      totalKilograms: 8000,
      deliveries: [
        { id: 'del-1', date: new Date('2026-09-24') as any, kilos: 2000, invoiced: true, docFolio: '6439784' },
        { id: 'del-2', date: new Date('2026-09-26') as any, kilos: 1000, invoiced: false, docFolio: '6439785' },
      ],
      invoices: [
        {
          id: 'inv-6307',
          orderId: 'oc-th-test',
          folio: '6307',
          uuid: 'E9E013BB-252B-44A5-8FE9-B41604B46C9E',
          kilos: 2000,
          financials: {
            salePricePerKg: 43,
            costPricePerKg: 38,
            saleTotal: 86000,
            invoiceTotal: 99760,
            costTotal: 76000,
            commission: 6880,
            netCashFlow: 16880,
            tradeMargin: 10000,
          },
          collection: { contrareciboNumber: 'TH-1103', paidAmount: 0 },
          creditCycle: { status: 'pending', issueDate: new Date('2026-09-24') as any, dueDate: new Date('2026-10-24') as any },
        },
      ],
      items: [
        { id: 'it-1', code: 'ENBO000007-SC', description: 'BOLSA POLIETILENO 50 CM x 55 CM', quantity: 8000, unitPrice: 43 } as any,
      ],
    },
    {
      id: 'oc-gt-test',
      oc: '12026439784',
      folio: '43/9784',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      department: 'GT',
      totalKilograms: 5100,
      deliveries: [
        { id: 'del-3', date: new Date('2026-09-28') as any, kilos: 2000, invoiced: true, docFolio: '6439790' },
      ],
      invoices: [
        {
          id: 'inv-6302',
          orderId: 'oc-gt-test',
          folio: '6302',
          kilos: 2000,
          collection: { contrareciboNumber: '' },
          creditCycle: { status: 'pending', issueDate: new Date('2026-09-22') as any, dueDate: new Date('2026-10-22') as any },
        },
      ],
      items: [],
    },
  ];

  const samplePurchases: Purchase[] = [
    {
      id: 'pur-1',
      provider: 'Andrés',
      orderId: '120267114302',
      expectedKilos: 8000,
      receivedKilos: 3000,
      pricePerKg: 38,
      totalAmount: 114000,
      status: 'recibido',
      date: new Date('2026-09-24') as any,
    } as any,
  ];

  const sampleExpenses: Expense[] = [
    {
      id: 'exp-1',
      date: new Date('2026-09-25') as any,
      type: 'ingreso',
      amount: 100000,
      concept: 'Cobro de Contrarecibo Providencia',
      provider: 'Providencia',
      createdAt: Date.now() as any,
    },
    {
      id: 'exp-2',
      date: new Date('2026-09-26') as any,
      type: 'egreso',
      amount: 45000,
      concept: 'Pago a Maquilador Andrés',
      provider: 'Andrés',
      createdAt: Date.now() as any,
    },
  ];

  describe('1. Respaldo Excel Maestro (Master Excel Exporter)', () => {
    it('construye las 5 hojas estándar con precisión contable', () => {
      const wb = buildMasterExcelWorkbook({
        orders: sampleOrders,
        purchases: samplePurchases,
        expenses: sampleExpenses,
        config: dummyConfig,
        settings: { providerName: 'Andrés' },
      });

      expect(wb.SheetNames).toEqual([
        '📊 Resumen & P&L',
        '📦 Expedientes',
        '🧾 Facturación & CR',
        '⚖️ Cuenta Andrés',
        '💵 Caja Chica',
      ]);

      // Verificar que hoja P&L contenga balance de caja
      const wsPnl = wb.Sheets['📊 Resumen & P&L'];
      const pnlData: any[][] = XLSX.utils.sheet_to_json(wsPnl, { header: 1 });
      expect(pnlData.length).toBeGreaterThan(12);

      // Verificar hoja Expedientes
      const wsExpedientes = wb.Sheets['📦 Expedientes'];
      const rowsExp: any[] = XLSX.utils.sheet_to_json(wsExpedientes);
      expect(rowsExp.length).toBe(2);
      expect(rowsExp[0].Folio_OC).toBe('120267114302');
      expect(rowsExp[0].Kilos_Pedidos).toBe(8000);
      expect(rowsExp[0].Kilos_Entregados).toBe(3000);

      // Verificar hoja Facturación & CR
      const wsFacturas = wb.Sheets['🧾 Facturación & CR'];
      const rowsFac: any[] = XLSX.utils.sheet_to_json(wsFacturas);
      expect(rowsFac.length).toBe(2);
      expect(rowsFac[0].Contrarecibo_CR).toBe('TH-1103');
      expect(rowsFac[1].Contrarecibo_CR).toBe('Sin CR');
    });

    it('es inmune a arrays con elementos nulos o facturas vacías', () => {
      const ordersConHuecos: any[] = [
        null,
        {
          id: 'oc-vacia',
          folio: 'OC-TEST',
          invoices: [null, undefined, { folio: 'F-1' }],
          deliveries: [null],
        },
      ];

      expect(() => {
        buildMasterExcelWorkbook({
          orders: ordersConHuecos,
          purchases: [null as any],
          expenses: [null as any],
          config: dummyConfig,
        });
      }).not.toThrow();
    });
  });

  describe('2. Respaldo Excel Offline Bidireccional', () => {
    it('genera el buffer binario offline y preserva integridad en ida y vuelta', async () => {
      const buf = await exportOfflineWorkbook(sampleOrders, sampleExpenses, dummyConfig);
      expect(buf).toBeInstanceOf(Uint8Array);

      const wb = XLSX.read(buf, { type: 'array' });
      expect(wb.SheetNames).toContain('1_EXPEDIENTES_FACTURAS');
      expect(wb.SheetNames).toContain('2_ENTREGAS_ANDRES');
      expect(wb.SheetNames).toContain('3_CAJA_CHICA_PAGOS');

      const diffs = await parseAndDiffOfflineWorkbook(buf, sampleOrders, sampleExpenses, dummyConfig);
      // Sin cambios manuales en el excel, diffs debe ser 0
      expect(diffs).toEqual([]);
    });
  });

  describe('3. Respaldo HTML Completo (Offline Bridge)', () => {
    it('traduce el estado a HtmlState y resume las facturas correctamente', () => {
      const htmlState = ordersToHtmlState(sampleOrders, samplePurchases, sampleExpenses, dummyConfig, 'test-project');
      expect(htmlState.facturas.length).toBe(2);
      expect(htmlState.proveedores.length).toBe(1);
      expect(htmlState.caja.length).toBe(2);

      const summary = summarizeHtmlBackup(htmlState);
      expect(summary.facturas).toBe(2);
      expect(summary.totalFacturado).toBeGreaterThan(0);
    });
  });

  describe('4. Métricas de Navegación y Badges para App Móvil', () => {
    it('calcula con precisión los badges táctiles en MobileBottomBar', () => {
      // Simular cálculo de badges como en MobileBottomBar.tsx
      const { pendingCrCount, overdueInvoicesCount, pendingDeliveryOrdersCount } = sampleOrders.reduce(
        (acc, o) => {
          if ((o as any).isDeleted || o.isClosedShort) return acc;
          const s = getOrderSummary(o);
          if (s.kilosDelivered < (o.totalKilograms || 0) && s.status !== 'collected') {
            acc.pendingDeliveryOrdersCount++;
          }
          (o.invoices || []).forEach((inv: any) => {
            const cr = extractCr(inv, o);
            const st = inv.creditCycle?.status;
            const total = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
            const paid = inv.collection?.paidAmount || 0;
            const isPaid = st === 'paid' || st === 'collected' || (paid >= total && total > 0);
            if (!cr && !isPaid) {
              acc.pendingCrCount++;
            }
            if (st === 'overdue') {
              acc.overdueInvoicesCount++;
            }
          });
          return acc;
        },
        { pendingCrCount: 0, overdueInvoicesCount: 0, pendingDeliveryOrdersCount: 0 }
      );

      // Ambas OCs tienen entregas incompletas (3000/8000 y 2000/5100)
      expect(pendingDeliveryOrdersCount).toBe(2);
      // Una factura tiene CR ('TH-1103') y la otra no ('Sin CR')
      expect(pendingCrCount).toBe(1);
      // Ninguna está vencida aún
      expect(overdueInvoicesCount).toBe(0);
    });
  });
});
