import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../useAnalytics';
import { PurchaseOrder } from '../../../lib/types';
import { computeFinancials } from '../../../lib/finance';
import { DEFAULT_CONFIG } from '../../../lib/types';

const cfg = { ...DEFAULT_CONFIG };

function crearOrdenMock(parcial: Partial<PurchaseOrder>): PurchaseOrder {
  return {
    id: `oc-${Math.random().toString(36).substring(7)}`,
    folio: 'TH-001',
    oc: '12026111',
    client: 'GRUPO TEXTIL PROVIDENCIA',
    department: 'TH',
    totalKilograms: 1000,
    ...parcial,
  } as PurchaseOrder;
}

describe('useAnalytics / computeAnalytics', () => {
  it('maneja listas vacías sin errores retornando KPIs en cero', () => {
    const res = computeAnalytics([]);
    expect(res.ventasPorMes).toEqual([]);
    expect(res.rentabilidadCliente).toEqual([]);
    expect(res.agingReport).toHaveLength(5);
    expect(res.kpiGlobal).toEqual({
      totalVentas: 0,
      totalGanancia: 0,
      totalKilos: 0,
      margenPromedio: 0,
      ordenesActivas: 0,
      ordenesCobradas: 0,
      diasAtrasoPromedio: 0,
    });
  });

  it('excluye rigurosamente expedientes marcados como isDeleted', () => {
    const ordenActiva = crearOrdenMock({
      id: 'activa',
      client: 'Cliente Activo',
      totalKilograms: 500,
      invoices: [
        {
          id: 'inv-1',
          orderId: 'activa',
          kilos: 500,
          financials: computeFinancials(500, cfg),
          creditCycle: { status: 'facturado' },
        },
      ],
      createdAt: '2026-05-10T10:00:00.000Z',
    });

    const ordenEliminada = crearOrdenMock({
      id: 'borrada',
      client: 'Cliente Borrado',
      totalKilograms: 800,
      invoices: [
        {
          id: 'inv-2',
          orderId: 'borrada',
          kilos: 800,
          financials: computeFinancials(800, cfg),
          creditCycle: { status: 'facturado' },
        },
      ],
      isDeleted: true,
      createdAt: '2026-05-11T10:00:00.000Z' as unknown as import('../../../lib/types').AnyFirestoreDate,
    });

    const res = computeAnalytics([ordenActiva, ordenEliminada]);
    expect(res.kpiGlobal.totalKilos).toBe(500);
    expect(res.rentabilidadCliente.find(c => c.client === 'Cliente Borrado')).toBeUndefined();
    expect(res.rentabilidadCliente.find(c => c.client === 'Cliente Activo')).toBeDefined();
  });

  it('agrupa tendencias mensuales correctamente por año y mes cronológico', () => {
    const o1 = crearOrdenMock({
      createdAt: '2026-01-15T12:00:00Z',
      invoices: [
        {
          id: 'inv-1',
          orderId: 'o1',
          kilos: 1000,
          financials: computeFinancials(1000, cfg),
          creditCycle: { status: 'facturado' },
        },
      ],
    });

    const o2 = crearOrdenMock({
      createdAt: '2026-01-20T12:00:00Z',
      invoices: [
        {
          id: 'inv-2',
          orderId: 'o2',
          kilos: 500,
          financials: computeFinancials(500, cfg),
          creditCycle: { status: 'facturado' },
        },
      ],
    });

    const o3 = crearOrdenMock({
      createdAt: '2026-02-05T12:00:00Z',
      invoices: [
        {
          id: 'inv-3',
          orderId: 'o3',
          kilos: 2000,
          financials: computeFinancials(2000, cfg),
          creditCycle: { status: 'facturado' },
        },
      ],
    });

    const res = computeAnalytics([o1, o2, o3]);
    expect(res.ventasPorMes).toHaveLength(2);
    expect(res.ventasPorMes[0].mes).toBe('Ene 26');
    expect(res.ventasPorMes[0].kilos).toBe(1500);
    expect(res.ventasPorMes[0].ordenes).toBe(2);
    expect(res.ventasPorMes[1].mes).toBe('Feb 26');
    expect(res.ventasPorMes[1].kilos).toBe(2000);
    expect(res.ventasPorMes[1].ordenes).toBe(1);
  });

  it('ordena la rentabilidad de clientes por ganancia descendente y calcula margen preciso', () => {
    const clienteA = crearOrdenMock({
      client: 'Cliente A',
      invoices: [
        {
          id: 'inv-a',
          orderId: 'oa',
          kilos: 1000,
          financials: computeFinancials(1000, cfg),
          creditCycle: { status: 'collected' },
        },
      ],
    });

    const clienteB = crearOrdenMock({
      client: 'Cliente B',
      invoices: [
        {
          id: 'inv-b',
          orderId: 'ob',
          kilos: 3000,
          financials: computeFinancials(3000, cfg),
          creditCycle: { status: 'collected' },
        },
      ],
    });

    const res = computeAnalytics([clienteA, clienteB]);
    expect(res.rentabilidadCliente[0].client).toBe('Cliente B');
    expect(res.rentabilidadCliente[1].client).toBe('Cliente A');
    expect(res.rentabilidadCliente[0].margen).toBeGreaterThan(0);
    expect(res.rentabilidadCliente[0].facturado).toBeGreaterThan(res.rentabilidadCliente[1].facturado);
  });

  it('clasifica saldos pendientes en los rangos correspondientes del Aging Report', () => {
    const now = Date.now();
    const msPorDia = 86_400_000;

    // Vence hoy (0 días) -> Al día (0-15 días)
    const oAlDia = crearOrdenMock({
      invoices: [
        {
          id: 'inv-aldia',
          orderId: 'o1',
          kilos: 100,
          financials: computeFinancials(100, cfg),
          creditCycle: {
            status: 'facturado',
            dueDate: new Date(now - 2 * msPorDia).toISOString() as unknown as import('firebase/firestore').Timestamp,
          },
        },
      ],
    });

    // Venció hace 45 días -> Vencido 31-60 días
    const oVencido45 = crearOrdenMock({
      invoices: [
        {
          id: 'inv-vencido45',
          orderId: 'o2',
          kilos: 200,
          financials: computeFinancials(200, cfg),
          creditCycle: {
            status: 'facturado',
            dueDate: new Date(now - 45 * msPorDia).toISOString() as unknown as import('firebase/firestore').Timestamp,
          },
        },
      ],
    });

    // Venció hace 100 días -> Vencido +90 días
    const oVencido100 = crearOrdenMock({
      invoices: [
        {
          id: 'inv-vencido100',
          orderId: 'o3',
          kilos: 300,
          financials: computeFinancials(300, cfg),
          creditCycle: {
            status: 'facturado',
            dueDate: new Date(now - 100 * msPorDia).toISOString() as unknown as import('firebase/firestore').Timestamp,
          },
        },
      ],
    });

    const res = computeAnalytics([oAlDia, oVencido45, oVencido100]);
    const mapAging = new Map(res.agingReport.map(b => [b.rango, b]));

    expect(mapAging.get('Al día (0-15 días)')?.count).toBe(1);
    expect(mapAging.get('Vencido 31-60 días')?.count).toBe(1);
    expect(mapAging.get('Vencido +90 días')?.count).toBe(1);
    expect(mapAging.get('Vencido 61-90 días')?.count).toBe(0);
  });
});
