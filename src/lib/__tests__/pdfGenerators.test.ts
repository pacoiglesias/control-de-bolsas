import { describe, it, expect } from 'vitest';
import { buildProvidenciaStatementDataFromOrders } from '../providenciaStatementPdf';
import { buildNetProfitData } from '../netProfitReportPdf';
import type { PurchaseOrder, Expense } from '../types';

describe('PDF Generators Financial & Data Building Tests', () => {
  const mockOrders: PurchaseOrder[] = [
    {
      id: 'ord-1',
      folio: '71-14014',
      oc: 'OC-14014',
      client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      totalKilograms: 1000,
      invoices: [
        {
          id: 'inv-1',
          orderId: 'ord-1',
          folio: '6159',
          kilos: 500,
          creditCycle: {
            issueDate: new Date('2026-08-01') as any,
            dueDate: new Date('2026-08-31') as any,
            status: 'pending',
          },
          collection: {
            contrareciboNumber: 'GT-570',
            paidAmount: 0,
          },
          financials: {
            salePricePerKg: 43,
            costPricePerKg: 42,
            saleTotal: 21500,
            invoiceTotal: 24940,
            costTotal: 21000,
            commission: 1720,
            netCashFlow: 2220,
            tradeMargin: 500,
          },
        },
        {
          id: 'inv-2',
          orderId: 'ord-1',
          folio: '6160',
          kilos: 500,
          creditCycle: {
            issueDate: new Date('2026-08-05') as any,
            dueDate: new Date('2026-09-05') as any,
            status: 'paid',
          },
          collection: {
            contrareciboNumber: 'GT-571',
            paidAmount: 24940,
            collectedAt: new Date('2026-08-10') as any,
          },
          financials: {
            salePricePerKg: 43,
            costPricePerKg: 42,
            saleTotal: 21500,
            invoiceTotal: 24940,
            costTotal: 21000,
            commission: 1720,
            netCashFlow: 2220,
            tradeMargin: 500,
          },
        },
      ],
      deliveries: [
        {
          id: 'del-1',
          date: new Date('2026-08-01') as any,
          kilos: 1000,
        },
      ],
    },
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      date: new Date('2026-08-02') as any,
      concept: 'Flete y maniobras Providencia',
      amount: 400,
      type: 'egreso',
      createdAt: new Date('2026-08-02') as any,
    },
  ];

  const mockConfig = {
    salePricePerKg: 43,
    costPricePerKg: 42,
    commissionRate: 0.08,
    companyName: 'Bolsas Elemental / Providencia',
  };

  it('buildProvidenciaStatementDataFromOrders calcula correctamente los totales de cartera y facturas', () => {
    const data = buildProvidenciaStatementDataFromOrders(mockOrders, mockConfig);

    expect(data.clientName).toBe('GRUPO TEXTIL PROVIDENCIA SA DE CV');
    expect(data.invoices).toHaveLength(2);
    expect(data.totalInvoiced).toBe(49880); // 24,940 * 2
    expect(data.totalPaid).toBe(24940); // Solo inv-2 está pagada
    expect(data.activeBalance).toBe(24940); // 49,880 - 24,940
    expect(data.totalKilos).toBe(1000); // 500 + 500
    expect(data.ledger.length).toBeGreaterThan(0);
  });

  it('buildNetProfitData calcula exactamente los 4 pilares financieros y el reparto 50/50', () => {
    const data = buildNetProfitData(mockOrders, mockExpenses, mockConfig, 15000, 'Agosto 2026');

    expect(data.totalKilosFacturados).toBe(1000);
    expect(data.subtotalFacturado).toBe(43000); // 1000 kg * $43
    expect(data.costoAndresTotal).toBe(42000); // 1000 kg * $42
    expect(data.comisionContableTotal).toBe(3440); // $43,000 * 8% = $3,440
    expect(data.gastosOperativosCaja).toBe(400); // $400 del flete

    // Utilidad Neta Real = Subtotal ($43,000) - Costo Andrés ($42,000) - Comisión ($3,440) - Gastos ($400) = -$2,840
    const expectedUtilidad = 43000 - 42000 - 3440 - 400;
    expect(data.utilidadNetaReal).toBe(expectedUtilidad);
    expect(data.repartoPaco).toBe(expectedUtilidad / 2);
    expect(data.repartoSocio).toBe(expectedUtilidad / 2);
    expect(data.saldoCajaChica).toBe(15000);
    expect(data.invoices).toHaveLength(2);
  });

  it('generateDeliveryRemissionPdf genera un documento PDF válido para remisiones de báscula', async () => {
    const { generateDeliveryRemissionPdf } = await import('../deliveryRemissionPdf');
    const doc = generateDeliveryRemissionPdf({
      folioRemision: 'REM-1001',
      oc: '5373',
      client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      department: 'TH-ALMACEN-1',
      date: new Date('2026-08-20'),
      providerName: 'Andrés',
      driverName: 'Juan Pérez',
      truckPlates: 'XB-1234',
      totalBags: 40,
      totalKilograms: 1000,
      notes: 'Entrega completa en báscula #1',
      items: [
        {
          code: 'BOL-50X70',
          description: 'Bolsa 50x70 Calibre 200',
          bags: 40,
          quantity: 1000,
        },
      ],
    });

    expect(doc).toBeDefined();
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(0);
  });
});
