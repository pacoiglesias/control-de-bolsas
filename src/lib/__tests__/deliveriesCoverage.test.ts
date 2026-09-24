import { describe, it, expect } from 'vitest';
import {
  newDeliveryEvent,
  updateDeliveryField,
  updateDeliveryItemQuantity,
  removeDeliveryAt,
  computeDeliveredTotals,
  buildInvoiceFromDelivery,
  unmarkDeliveriesByInvoiceId,
  migrateLegacyDeliveries,
} from '../deliveries';
import type { PurchaseOrderItem, Delivery, PurchaseOrder, FinancialConfig } from '../types';
import { Timestamp } from 'firebase/firestore';

describe('Deliveries Engine Unit Tests', () => {
  const dummyItems: PurchaseOrderItem[] = [
    { id: 'item-1', code: '24141500', description: 'BOLSA 50X70', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
    { id: 'item-2', code: '24141500', description: 'BOLSA 60X90', quantity: 2000, unitPrice: 43, amount: 86000, unit: 'KGM' },
  ];

  it('newDeliveryEvent: inicializa correctamente los renglones en 0', () => {
    const delivery = newDeliveryEvent(dummyItems);
    expect(delivery.id).toBeDefined();
    expect(delivery.kilos).toBe(0);
    expect(delivery.invoiced).toBe(false);
    expect(delivery.items).toHaveLength(2);
    expect(delivery.items?.[0]).toEqual({ itemId: 'item-1', quantity: 0 });
    expect(delivery.items?.[1]).toEqual({ itemId: 'item-2', quantity: 0 });
  });

  it('updateDeliveryField: actualiza campos como notas o status de forma inmutable', () => {
    const list: Delivery[] = [
      { id: 'd1', date: Timestamp.now(), kilos: 500, invoiced: false, notes: '' },
    ];
    const updated = updateDeliveryField(list, 0, 'notes', 'Ticket de báscula #1234');
    expect(updated).not.toBe(list);
    expect(updated[0].notes).toBe('Ticket de báscula #1234');
    expect(list[0].notes).toBe('');
  });

  it('updateDeliveryItemQuantity: actualiza cantidad y recalcula kilos totales', () => {
    const initial: Delivery[] = [
      {
        id: 'd1',
        date: Timestamp.now(),
        kilos: 0,
        invoiced: false,
        items: [
          { itemId: 'item-1', quantity: 0 },
          { itemId: 'item-2', quantity: 0 },
        ],
      },
    ];

    const step1 = updateDeliveryItemQuantity(initial, 0, 'item-1', 450.5);
    expect(step1[0].items?.[0].quantity).toBe(450.5);
    expect(step1[0].kilos).toBe(450.5);

    const step2 = updateDeliveryItemQuantity(step1, 0, 'item-2', 550.25);
    expect(step2[0].items?.[1].quantity).toBe(550.25);
    expect(step2[0].kilos).toBe(1000.75);

    // Añade un ítem que no existía previamente en la lista
    const step3 = updateDeliveryItemQuantity(step2, 0, 'item-3-extra', 100);
    expect(step3[0].items).toHaveLength(3);
    expect(step3[0].kilos).toBe(1100.75);
  });

  it('removeDeliveryAt: protege entregas facturadas y elimina entregas abiertas', () => {
    const deliveries: Delivery[] = [
      { id: 'd1', date: Timestamp.now(), kilos: 500, invoiced: true, invoiceId: 'inv-1' },
      { id: 'd2', date: Timestamp.now(), kilos: 300, invoiced: false },
    ];

    const cannotDelete = removeDeliveryAt(deliveries, 0);
    expect('error' in cannotDelete).toBe(true);

    const canDelete = removeDeliveryAt(deliveries, 1);
    expect('deliveries' in canDelete).toBe(true);
    if ('deliveries' in canDelete) {
      expect(canDelete.deliveries).toHaveLength(1);
      expect(canDelete.deliveries[0].id).toBe('d1');
    }
  });

  it('computeDeliveredTotals: suma correctamente entregas por partida y totales globales', () => {
    const deliveries: Delivery[] = [
      {
        id: 'd1',
        date: Timestamp.now(),
        kilos: 500,
        invoiced: false,
        items: [
          { itemId: 'item-1', quantity: 200 },
          { itemId: 'item-2', quantity: 300 },
        ],
      },
      {
        id: 'd2',
        date: Timestamp.now(),
        kilos: 400,
        invoiced: false,
        items: [
          { itemId: 'item-1', quantity: 150 },
          { itemId: 'item-2', quantity: 250 },
        ],
      },
    ];

    const result = computeDeliveredTotals(deliveries, dummyItems);
    expect(result.kilosEntregados).toBe(900);
    expect(result.deliveredByItem['item-1']).toBe(350);
    expect(result.deliveredByItem['item-2']).toBe(550);
  });

  it('computeDeliveredTotals: asigna kilos en orden de un solo ítem cuando no hay desglose por partida', () => {
    const singleItemOrder: PurchaseOrderItem[] = [
      { id: 'single-1', code: '24141500', description: 'BOLSA UNICA', quantity: 5000, unitPrice: 43, amount: 215000, unit: 'KGM' },
    ];
    const flatDelivery: Delivery[] = [
      { id: 'd1', date: Timestamp.now(), kilos: 1250, invoiced: false },
    ];

    const result = computeDeliveredTotals(flatDelivery, singleItemOrder);
    expect(result.kilosEntregados).toBe(1250);
    expect(result.deliveredByItem['single-1']).toBe(1250);
  });

  it('buildInvoiceFromDelivery: genera factura correcta para entrega no facturada y rechaza si ya está facturada', () => {
    const config: FinancialConfig = {
      salePricePerKg: 43,
      costPricePerKg: 38.5,
      commissionRate: 0.05,
      creditDays: 30,
      ivaRate: 0.16,
      commissionBase: 'subtotal',
    };

    const delivery: Delivery = {
      id: 'd1',
      date: Timestamp.now(),
      kilos: 1000,
      invoiced: false,
      items: [{ itemId: 'item-1', quantity: 1000 }],
    };

    const res = buildInvoiceFromDelivery(delivery, config, 'order-123');
    expect('invoice' in res).toBe(true);
    if ('invoice' in res) {
      expect(res.kilos).toBe(1000);
      expect(res.updatedDelivery.invoiced).toBe(true);
      expect(res.updatedDelivery.invoiceId).toBe(res.invoice.id);
      expect(res.invoice.orderId).toBe('order-123');
      expect(res.invoice.kilos).toBe(1000);
    }

    // Intento con entrega ya facturada
    const alreadyInvoiced: Delivery = { ...delivery, invoiced: true };
    const errRes = buildInvoiceFromDelivery(alreadyInvoiced, config, 'order-123');
    expect('error' in errRes).toBe(true);

    // Intento con entrega con 0 kilos
    const zeroDelivery: Delivery = { ...delivery, kilos: 0, items: [] };
    const errZero = buildInvoiceFromDelivery(zeroDelivery, config, 'order-123');
    expect('error' in errZero).toBe(true);
  });

  it('unmarkDeliveriesByInvoiceId: desmarca entregas cuando se elimina una factura', () => {
    const list: Delivery[] = [
      { id: 'd1', date: Timestamp.now(), kilos: 500, invoiced: true, invoiceId: 'inv-target' },
      { id: 'd2', date: Timestamp.now(), kilos: 300, invoiced: true, invoiceId: 'inv-other' },
    ];

    const unlinked = unmarkDeliveriesByInvoiceId(list, 'inv-target');
    expect(unlinked[0].invoiced).toBe(false);
    expect(unlinked[0].invoiceId).toBeUndefined();
    expect(unlinked[1].invoiced).toBe(true);
    expect(unlinked[1].invoiceId).toBe('inv-other');

    // Si invoiceId es undefined, no altera nada
    expect(unmarkDeliveriesByInvoiceId(list, undefined)).toBe(list);
  });

  it('migrateLegacyDeliveries: respeta entregas existentes o migra datos legacy', () => {
    const existing: Delivery[] = [
      { id: 'existing-1', date: Timestamp.now(), kilos: 100, invoiced: false },
    ];
    const order: PurchaseOrder = {
      id: 'order-leg-1',
      folio: 'OC-LEGACY',
      client: 'PROV',
      department: 'DEP',
      totalKilograms: 1000,
      items: [
        { id: 'i1', code: 'C1', description: 'Desc', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM', deliveredQuantity: 500 },
      ],
      deliveries: [],
      invoices: [],
      creditCycle: { status: 'pedido' },
    };

    // Si ya existen, las preserva
    expect(migrateLegacyDeliveries(order, existing)).toBe(existing);

    // Si no existen, migra desde deliveredQuantity
    const migratedFromItems = migrateLegacyDeliveries(order, []);
    expect(migratedFromItems).toHaveLength(1);
    expect(migratedFromItems[0].kilos).toBe(500);

    // Si no tiene deliveredQuantity pero tiene facturas
    const orderOnlyInvoices: PurchaseOrder = {
      ...order,
      items: [{ id: 'i1', code: 'C1', description: 'Desc', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' }],
      invoices: [
        { id: 'inv-1', orderId: 'order-leg-1', folio: 'F1', kilos: 800, financials: {} as any, creditCycle: { status: 'pending' } },
      ],
    };
    const migratedFromInvoices = migrateLegacyDeliveries(orderOnlyInvoices, []);
    expect(migratedFromInvoices).toHaveLength(1);
    expect(migratedFromInvoices[0].kilos).toBe(800);
    expect(migratedFromInvoices[0].invoiced).toBe(true);

    // Si orden completamente vacía
    const emptyOrder: PurchaseOrder = {
      ...order,
      items: [],
      invoices: [],
    };
    expect(migrateLegacyDeliveries(emptyOrder, [])).toEqual([]);
  });
});
