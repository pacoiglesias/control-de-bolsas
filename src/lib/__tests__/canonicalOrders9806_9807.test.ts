import { describe, it, expect } from 'vitest';
import {
  CANONICAL_GT_ITEMS_439806,
  CANONICAL_GT_ITEMS_439807,
} from '../types';
import { billableDeliveredKilos } from '../billingQuantities';

describe('Órdenes Canónicas GT Oficiales 43/9806 y 43/9807', () => {
  it('OC 12026439806 debe sumar exactamente 2,500 kg en sus 2 partidas canónicas', () => {
    expect(CANONICAL_GT_ITEMS_439806).toHaveLength(2);
    const total = CANONICAL_GT_ITEMS_439806.reduce((acc, item) => acc + item.quantity, 0);
    expect(total).toBe(2500);
  });

  it('OC 12026439807 debe sumar exactamente 3,000 kg en sus 3 partidas canónicas', () => {
    expect(CANONICAL_GT_ITEMS_439807).toHaveLength(3);
    const total = CANONICAL_GT_ITEMS_439807.reduce((acc, item) => acc + item.quantity, 0);
    expect(total).toBe(3000);
  });

  it('Aplica regla truncate_half_kilo_each_line a las partidas de la Remisión 6439806 (2,478.35 kg)', () => {
    const delivery9806 = {
      id: 'del-6439806',
      billingQuantityPolicy: 'truncate_half_kilo_each_line' as const,
      kilos: 2478.35,
      items: [
        { itemId: 'CANONICAL_GT_ITEMS_439806_1', quantity: 98.45 },
        { itemId: 'CANONICAL_GT_ITEMS_439806_2', quantity: 489.15 },
        { itemId: 'CANONICAL_GT_ITEMS_439806_3', quantity: 994.40 },
        { itemId: 'CANONICAL_GT_ITEMS_439806_4', quantity: 198.85 },
        { itemId: 'CANONICAL_GT_ITEMS_439806_5', quantity: 498.70 },
        { itemId: 'CANONICAL_GT_ITEMS_439806_6', quantity: 198.80 },
      ],
    };

    // Verificamos truncamiento por línea:
    // 98.45 -> 98.0
    // 489.15 -> 489.0
    // 994.40 -> 994.0
    // 198.85 -> 198.5
    // 498.70 -> 498.5
    // 198.80 -> 198.5
    // Suma: 98 + 489 + 994 + 198.5 + 498.5 + 198.5 = 2476.5 kg
    const facturables = billableDeliveredKilos([delivery9806 as any]);
    expect(facturables).toBe(2476.5);
    expect(facturables).toBeLessThanOrEqual(delivery9806.kilos);
  });

  it('Aplica regla truncate_half_kilo_each_line a las partidas de la Remisión 6439807 (2,955.80 kg)', () => {
    const delivery9807 = {
      id: 'del-6439807',
      billingQuantityPolicy: 'truncate_half_kilo_each_line' as const,
      kilos: 2955.80,
      items: [
        { itemId: 'CANONICAL_GT_ITEMS_439807_1', quantity: 99.10 },
        { itemId: 'CANONICAL_GT_ITEMS_439807_2', quantity: 494.60 },
        { itemId: 'CANONICAL_GT_ITEMS_439807_3', quantity: 1478.40 },
        { itemId: 'CANONICAL_GT_ITEMS_439807_4', quantity: 198.40 },
        { itemId: 'CANONICAL_GT_ITEMS_439807_5', quantity: 489.90 },
        { itemId: 'CANONICAL_GT_ITEMS_439807_6', quantity: 195.40 },
      ],
    };

    // Verificamos truncamiento por línea:
    // 99.10 -> 99.0
    // 494.60 -> 494.5
    // 1478.40 -> 1478.0
    // 198.40 -> 198.0
    // 489.90 -> 489.5
    // 195.40 -> 195.0
    // Suma: 99 + 494.5 + 1478 + 198 + 489.5 + 195 = 2954.0 kg
    const facturables = billableDeliveredKilos([delivery9807 as any]);
    expect(facturables).toBe(2954);
    expect(facturables).toBeLessThanOrEqual(delivery9807.kilos);
  });

  it('Verifica que ambas órdenes están dentro del margen de tolerancia (< 2% de merma)', () => {
    const oc9806Ordered = 2500;
    const oc9806Delivered = 2478.35;
    const shortfall9806 = oc9806Ordered - oc9806Delivered;
    const pct9806 = (shortfall9806 / oc9806Ordered) * 100;

    expect(pct9806).toBeLessThan(2.0); // 0.866%
    expect(shortfall9806).toBeLessThan(50); // 21.65 kg

    const oc9807Ordered = 3000;
    const oc9807Delivered = 2955.80;
    const shortfall9807 = oc9807Ordered - oc9807Delivered;
    const pct9807 = (shortfall9807 / oc9807Ordered) * 100;

    expect(pct9807).toBeLessThan(2.0); // 1.473%
    expect(shortfall9807).toBeLessThan(50); // 44.20 kg
  });
});
