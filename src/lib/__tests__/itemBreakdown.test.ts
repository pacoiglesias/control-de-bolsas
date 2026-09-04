import { describe, it, expect } from 'vitest';
import {
  computeItemInvoiceBreakdown,
  linkDeliveriesToInvoice,
  unmarkDeliveriesByInvoiceId,
} from '../deliveries';
import type { PurchaseOrder, Delivery, Invoice } from '../types';
import { Timestamp } from 'firebase/firestore';

describe('Audit: Conciliación de Kilos y Descuento por Partida en Facturación', () => {
  const baseOrder: PurchaseOrder = {
    id: 'test-order-1',
    folio: 'OC-120267',
    client: 'TEXTIL HOGAR',
    department: 'TH-ALMACEN-1',
    totalKilograms: 6000,
    items: [
      { id: 'it1', code: '24141500', description: 'BOLSA POLIETILENO 50X70', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
      { id: 'it2', code: '24141500', description: 'BOLSA POLIETILENO 60X90', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
      { id: 'it3', code: '24141500', description: 'BOLSA POLIETILENO 70X100', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
      { id: 'it4', code: '24141500', description: 'BOLSA POLIETILENO 80X120', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
      { id: 'it5', code: '24141500', description: 'BOLSA POLIETILENO 90X140', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
      { id: 'it6', code: '24141500', description: 'BOLSA POLIETILENO 100X150', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
    ],
    deliveries: [],
    invoices: [],
    creditCycle: { status: 'pedido' },
  };

  it('Caso 1: En una orden con entregas y factura previa, descuenta exactamente los kilos ya facturados', () => {
    // Entrega de báscula 1: 2,000 kg (ítems 1 y 2)
    const delivery1: Delivery = {
      id: 'del-1',
      date: Timestamp.now(),
      kilos: 2000,
      items: [
        { itemId: 'it1', quantity: 1000 },
        { itemId: 'it2', quantity: 1000 },
      ],
      invoiced: true,
      invoiceId: 'inv-6198',
    };

    // Factura 1: ampara 2,000 kg (ítems 1 y 2)
    const invoice1: Invoice = {
      id: 'inv-6198',
      orderId: 'test-order-1',
      folio: '6198',
      kilos: 2000,
      items: [
        { id: 'it1', code: '24141500', description: 'BOLSA POLIETILENO 50X70', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
        { id: 'it2', code: '24141500', description: 'BOLSA POLIETILENO 60X90', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
      ],
      financials: { saleTotal: 86000, invoiceTotal: 99760 } as any,
      creditCycle: { status: 'pending' },
    };

    const orderWith1Invoice: PurchaseOrder = {
      ...baseOrder,
      deliveries: [delivery1],
      invoices: [invoice1],
    };

    const breakdown = computeItemInvoiceBreakdown(orderWith1Invoice, 43);

    // Los ítems 1 y 2 deben estar ya al 100% facturados y sugerir 0 kg
    expect(breakdown[0].alreadyInvoiced).toBe(1000);
    expect(breakdown[0].uninvoicedDeliveredKilos).toBe(0);
    expect(breakdown[0].suggestedKilosToInvoice).toBe(0);
    expect(breakdown[0].selected).toBe(false);

    expect(breakdown[1].alreadyInvoiced).toBe(1000);
    expect(breakdown[1].uninvoicedDeliveredKilos).toBe(0);
    expect(breakdown[1].suggestedKilosToInvoice).toBe(0);
    expect(breakdown[1].selected).toBe(false);

    // Los ítems 3 a 6 no tienen entregas pendientes en báscula aún
    expect(breakdown[2].uninvoicedDeliveredKilos).toBe(0);
    expect(breakdown[2].suggestedKilosToInvoice).toBe(0);
    expect(breakdown[2].selected).toBe(false);

    // Total sugerido a facturar en este momento = 0 kg (no pre-llena 6,000 kg)
    const totalSuggested = breakdown.reduce((sum, b) => sum + (b.selected ? b.suggestedKilosToInvoice : 0), 0);
    expect(totalSuggested).toBe(0);
  });

  it('Caso 2: Cuando llega una nueva entrega de báscula parcial, sugiere SOLO los kilos de la nueva entrega', () => {
    const delivery1: Delivery = {
      id: 'del-1',
      date: Timestamp.now(),
      kilos: 2000,
      items: [
        { itemId: 'it1', quantity: 1000 },
        { itemId: 'it2', quantity: 1000 },
      ],
      invoiced: true,
      invoiceId: 'inv-6198',
    };

    const invoice1: Invoice = {
      id: 'inv-6198',
      orderId: 'test-order-1',
      folio: '6198',
      kilos: 2000,
      items: [
        { id: 'it1', code: '24141500', description: 'BOLSA POLIETILENO 50X70', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
        { id: 'it2', code: '24141500', description: 'BOLSA POLIETILENO 60X90', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' },
      ],
      financials: { saleTotal: 86000, invoiceTotal: 99760 } as any,
      creditCycle: { status: 'pending' },
    };

    // Nueva entrega en báscula: 1,500 kg (ítem 3: 1,000 kg, ítem 4: 500 kg)
    const delivery2: Delivery = {
      id: 'del-2',
      date: Timestamp.now(),
      kilos: 1500,
      items: [
        { itemId: 'it3', quantity: 1000 },
        { itemId: 'it4', quantity: 500 },
      ],
      invoiced: false,
    };

    const orderWith2Deliveries: PurchaseOrder = {
      ...baseOrder,
      deliveries: [delivery1, delivery2],
      invoices: [invoice1],
    };

    const breakdown = computeItemInvoiceBreakdown(orderWith2Deliveries, 43);

    // Ítems 1 y 2 siguen en 0
    expect(breakdown[0].suggestedKilosToInvoice).toBe(0);
    expect(breakdown[0].selected).toBe(false);
    expect(breakdown[1].suggestedKilosToInvoice).toBe(0);
    expect(breakdown[1].selected).toBe(false);

    // Ítem 3: sugiere exactamente 1,000 kg
    expect(breakdown[2].uninvoicedDeliveredKilos).toBe(1000);
    expect(breakdown[2].suggestedKilosToInvoice).toBe(1000);
    expect(breakdown[2].selected).toBe(true);

    // Ítem 4: sugiere exactamente 500 kg
    expect(breakdown[3].uninvoicedDeliveredKilos).toBe(500);
    expect(breakdown[3].suggestedKilosToInvoice).toBe(500);
    expect(breakdown[3].selected).toBe(true);

    // Ítems 5 y 6 en 0
    expect(breakdown[4].suggestedKilosToInvoice).toBe(0);
    expect(breakdown[5].suggestedKilosToInvoice).toBe(0);

    // Total sugerido = 1,500 kg
    const totalSuggested = breakdown.reduce((sum, b) => sum + (b.selected ? b.suggestedKilosToInvoice : 0), 0);
    expect(totalSuggested).toBe(1500);
  });

  it('Caso 3: linkDeliveriesToInvoice y unmarkDeliveriesByInvoiceId gestionan correctamente la vinculación', () => {
    const deliveries: Delivery[] = [
      { id: 'd1', date: Timestamp.now(), kilos: 1000, invoiced: false },
      { id: 'd2', date: Timestamp.now(), kilos: 500, invoiced: false },
    ];

    const linked = linkDeliveriesToInvoice(deliveries, 'inv-new', 1500);
    expect(linked[0].invoiced).toBe(true);
    expect(linked[0].invoiceId).toBe('inv-new');
    expect(linked[1].invoiced).toBe(true);
    expect(linked[1].invoiceId).toBe('inv-new');

    const unlinked = unmarkDeliveriesByInvoiceId(linked, 'inv-new');
    expect(unlinked[0].invoiced).toBe(false);
    expect(unlinked[0].invoiceId).toBeUndefined();
    expect(unlinked[1].invoiced).toBe(false);
    expect(unlinked[1].invoiceId).toBeUndefined();
  });
});
