import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { exportOfflineWorkbook, parseAndDiffOfflineWorkbook } from '../offlineExcelSync';
import type { PurchaseOrder, Expense, FinancialConfig } from '../types';

describe('offlineExcelSync (Motor de Sincronización Bidireccional)', () => {
  const dummyConfig: FinancialConfig = {
    salePricePerKg: 43.0,
    costPricePerKg: 42.0,
    commissionRate: 0.08,
    creditDays: 30,
    ivaRate: 0.16,
    commissionBase: 'total',
  };

  const dummyOrders: PurchaseOrder[] = [
    {
      id: 'order-101',
      folio: 'OC-5001',
      client: 'Grupo Textil Providencia',
      department: 'TH',
      status: 'pedido',
      items: [{ description: 'Bolsa 50x70', kilos: 2000, price: 43 }],
      deliveries: [
        { id: 'del-1', kilos: 1000, date: 1724400000000, docFolio: 'REM-101', driver: 'Andres Chofer' },
      ],
      invoices: [
        {
          id: 'inv-1',
          folio: '6198',
          kilos: 1000,
          creditCycle: { status: 'pending', issueDate: 1724400000000, dueDate: 1727000000000 },
          collection: { contrareciboNumber: '' },
        },
      ],
    } as any,
  ];

  const dummyExpenses: Expense[] = [
    {
      id: 'exp-1',
      amount: 50000,
      concept: 'Anticipo Maquila',
      provider: 'Andres',
      type: 'egreso',
      date: 1724400000000,
    } as any,
  ];

  it('1. Genera libro Excel con las 4 pestañas requeridas y datos correctos', async () => {
    const buf = await exportOfflineWorkbook(dummyOrders, dummyExpenses, dummyConfig);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(100);

    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toContain('1_EXPEDIENTES_FACTURAS');
    expect(wb.SheetNames).toContain('2_ENTREGAS_ANDRES');
    expect(wb.SheetNames).toContain('3_CAJA_CHICA_PAGOS');
    expect(wb.SheetNames).toContain('4_INSTRUCCIONES');

    const rowsCartera: any[] = XLSX.utils.sheet_to_json(wb.Sheets['1_EXPEDIENTES_FACTURAS']);
    expect(rowsCartera.length).toBe(1);
    expect(rowsCartera[0]._ID_ORDEN).toBe('order-101');
    expect(rowsCartera[0]._ID_FACTURA).toBe('inv-1');
    expect(rowsCartera[0].Folio_Factura).toBe('6198');
  });

  it('2. Detecta asignación de Contrarecibo y cambio de estatus en Factura', async () => {
    const buf = await exportOfflineWorkbook(dummyOrders, dummyExpenses, dummyConfig);
    const wb = XLSX.read(buf, { type: 'array' });

    // Modificamos la fila de factura simulando que el usuario le asignó CR en Excel
    const rowsCartera: any[] = XLSX.utils.sheet_to_json(wb.Sheets['1_EXPEDIENTES_FACTURAS']);
    rowsCartera[0].Contrarecibo = 'TH-946';
    rowsCartera[0].Estatus_Cobranza = 'paid';
    rowsCartera[0].Referencia_Transferencia = 'TR_3640';

    wb.Sheets['1_EXPEDIENTES_FACTURAS'] = XLSX.utils.json_to_sheet(rowsCartera);
    const modifiedBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const diffs = await parseAndDiffOfflineWorkbook(modifiedBuf, dummyOrders, dummyExpenses, dummyConfig);

    expect(diffs.length).toBe(1);
    expect(diffs[0].type).toBe('invoice');
    expect(diffs[0].invoiceId).toBe('inv-1');
    expect(diffs[0].payload.newCr).toBe('TH-946');
    expect(diffs[0].payload.newStatus).toBe('paid');
    expect(diffs[0].payload.newTr).toBe('TR_3640');
  });

  it('3. Rechaza entregas de Andrés que sobrepasen los kilos pedidos de la OC', async () => {
    const buf = await exportOfflineWorkbook(dummyOrders, dummyExpenses, dummyConfig);
    const wb = XLSX.read(buf, { type: 'array' });

    // Modificamos la entrega a 3000 kg (la OC solo ampara 2000 kg)
    const rowsEntregas: any[] = XLSX.utils.sheet_to_json(wb.Sheets['2_ENTREGAS_ANDRES']);
    rowsEntregas[0].Kilos_Entregados = 3000;

    wb.Sheets['2_ENTREGAS_ANDRES'] = XLSX.utils.json_to_sheet(rowsEntregas);
    const modifiedBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const diffs = await parseAndDiffOfflineWorkbook(modifiedBuf, dummyOrders, dummyExpenses, dummyConfig);

    const delDiff = diffs.find(d => d.type === 'delivery');
    expect(delDiff).toBeDefined();
    expect(delDiff?.error).toContain('Rechazado por regla de negocio');
    expect(delDiff?.error).toContain('Andrés no puede entregar kilos de más');
  });

  it('4. Detecta nuevo gasto o pago creado offline en Caja Chica', async () => {
    const buf = await exportOfflineWorkbook(dummyOrders, dummyExpenses, dummyConfig);
    const wb = XLSX.read(buf, { type: 'array' });

    const rowsCaja: any[] = XLSX.utils.sheet_to_json(wb.Sheets['3_CAJA_CHICA_PAGOS']);
    // Agregamos nueva fila sin _ID_GASTO
    rowsCaja.push({
      _ID_GASTO: '',
      Fecha: '2026-08-24',
      Tipo: 'egreso',
      Proveedor_Beneficiario: 'Andres',
      Concepto: 'Liquidación Saldo en Efectivo',
      Monto: 35000,
      Notas: 'Pago entregado en bodega',
    });

    wb.Sheets['3_CAJA_CHICA_PAGOS'] = XLSX.utils.json_to_sheet(rowsCaja);
    const modifiedBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const diffs = await parseAndDiffOfflineWorkbook(modifiedBuf, dummyOrders, dummyExpenses, dummyConfig);

    const expDiff = diffs.find(d => d.type === 'expense' && d.action === 'create');
    expect(expDiff).toBeDefined();
    expect(expDiff?.payload.amount).toBe(35000);
    expect(expDiff?.payload.provider).toBe('Andres');
    expect(expDiff?.payload.concept).toBe('Liquidación Saldo en Efectivo');
  });
});
