import { describe, it, expect } from 'vitest';
import { round2 } from '../finance';
import { CARTERA_OFICIAL, SALDO_CAJA_ACTUAL, TOTAL_CARTERA_OFICIAL } from '../constants';

describe('Consola de Cuadre Ejecutivo Directo', () => {
  it('calcula correctamente el delta de efectivo en Caja Chica', () => {
    const currentSaldoCaja = 400000;
    const targetCaja = SALDO_CAJA_ACTUAL;
    const delta = round2(targetCaja - currentSaldoCaja);
    expect(delta).toBe(51848.56);
    expect(delta > 0).toBe(true); // Requiere ingreso contable de calibración
  });

  it('calcula correctamente el delta de cuenta corriente con Andrés', () => {
    const currentSaldoAndres = 100000;
    const targetAndres = 103411.84;
    const delta = round2(targetAndres - currentSaldoAndres);
    expect(delta).toBe(3411.84);
  });

  it('cuadra el saldo oficial de cartera Providencia en los 4 rubros maestros', () => {
    const totalCrs = round2(CARTERA_OFICIAL.reduce((sum, c) => sum + c.monto, 0));
    expect(totalCrs).toBe(359111.06);
    expect(TOTAL_CARTERA_OFICIAL).toBe(359111.06);
    expect(CARTERA_OFICIAL.length).toBe(4);
    expect(SALDO_CAJA_ACTUAL).toBe(451848.56);
  });
});
