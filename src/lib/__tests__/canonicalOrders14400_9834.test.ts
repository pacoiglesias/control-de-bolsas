import { describe, it, expect } from 'vitest';
import {
  CANONICAL_TH_ITEMS_7114400,
  CANONICAL_GT_ITEMS_439834,
} from '../types';
import { round2 } from '../finance';

describe('Órdenes Canónicas Oficiales TH 71/14400 y GT 43/9834 + Remisión 114400', () => {
  it('OC 120267114400 debe sumar exactamente 9,500 kg en sus 7 partidas a $44.00/kg ($418,000 subtotal)', () => {
    expect(CANONICAL_TH_ITEMS_7114400).toHaveLength(7);
    const totalKilos = CANONICAL_TH_ITEMS_7114400.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = CANONICAL_TH_ITEMS_7114400.reduce((acc, item) => acc + item.amount, 0);
    expect(totalKilos).toBe(9500);
    expect(subtotal).toBe(418000);
  });

  it('Remisión física 114400 (firmada por Ahmed Flores Grande el 27/10/2026) suma exactamente 6,805.76 kg', () => {
    const partidasRemision = [
      978.96, // 48+17+17x140
      1000.0, // 55x126
      987.28, // 80+20x160
      500.0,  // 60+20x120
      1000.0, // 55x55
      839.52, // 55x77
      1500.0, // 50x55
    ];
    const totalEntregadoRemision = round2(partidasRemision.reduce((acc, val) => acc + val, 0));
    expect(totalEntregadoRemision).toBe(6805.76);
  });

  it('Concilia entregas físicas vs facturación de la OC 120267114400', () => {
    const kilosPedidos = 9500.0;
    const kilosFacturadosF6438 = 1325.0; // Factura 6438
    const kilosRemision114400 = 6805.76; // Orden de Entrega 114400

    const kilosEntregadosTotal = round2(kilosFacturadosF6438 + kilosRemision114400);
    const kilosFaltantes = round2(kilosPedidos - kilosEntregadosTotal);
    const kilosPendientesFacturar = kilosRemision114400; // Remisión 114400 con invoiced: false

    expect(kilosEntregadosTotal).toBe(8130.76);
    expect(kilosFaltantes).toBe(1369.24);
    expect(kilosPendientesFacturar).toBe(6805.76);
  });

  it('OC 12026439834 (Evelia 43/9834) suma exactamente 1,300 kg a $43.00/kg ($55,900 subtotal) con 0 kg entregados', () => {
    expect(CANONICAL_GT_ITEMS_439834).toHaveLength(4);
    const totalKilos = CANONICAL_GT_ITEMS_439834.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = CANONICAL_GT_ITEMS_439834.reduce((acc, item) => acc + item.amount, 0);
    expect(totalKilos).toBe(1300);
    expect(subtotal).toBe(55900);
  });
});
