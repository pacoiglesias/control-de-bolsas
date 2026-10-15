import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useDashboardStats } from '../../hooks/useDashboardStatsV2';
import { useAuditoriaCartera, useAuditSyncGrid } from '../../pages/AuditSync.helpers';
import { DEFAULT_CONFIG, type PurchaseOrder } from '../types';
import { computeFinancials } from '../finance';

it('inicio y auditoría coinciden con pagos parciales, CR compartido y orden sin factura', () => {
  const orders: PurchaseOrder[] = [{ id: 'o', totalKilograms: 1000, invoices: ['i1', 'i2'].map(id => ({ id, orderId: 'o', kilos: 100, folio: id, creditCycle: { status: 'facturado' }, financials: computeFinancials(100, DEFAULT_CONFIG), collection: { contrareciboNumber: 'TH-1', paidAmount: 1000 } })) }, { id: 'empty', totalKilograms: 900 }];
  function Probe() {
    const dashboard = useDashboardStats(null, orders, 'ALL', DEFAULT_CONFIG, [], [], orders);
    const audit = useAuditoriaCartera(orders, DEFAULT_CONFIG);
    const grid = useAuditSyncGrid(orders, DEFAULT_CONFIG, '');
    expect(dashboard.porCobrar).toBe(7976); expect(audit.totalDeuda).toBe(dashboard.porCobrar);
    expect(audit.countCrs).toBe(1); expect(grid).toHaveLength(2);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
});

describe('Kilos pendientes por orden', () => {
  it('un exceso facturado en otra OC no oculta entregas sin factura', () => {
    const orders: PurchaseOrder[] = [{ id: 'a', deliveries: [{ id: 'd', kilos: 100, date: null }], invoices: [] }, { id: 'b', invoices: [{ id: 'i', orderId: 'b', kilos: 200, creditCycle: { status: 'paid' } }] }];
    function Probe() { const stats = useDashboardStats(null, orders, 'ALL', DEFAULT_CONFIG, [], [], orders); expect(stats.kilosPendientesFacturar).toBe(100); return null; }
    renderToStaticMarkup(createElement(Probe));
  });
});
