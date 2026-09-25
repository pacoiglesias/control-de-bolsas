import { describe, it, expect } from 'vitest';
import { round2 } from '../finance';
import { CARTERA_OFICIAL, SALDO_CAJA_ACTUAL } from '../constants';

describe('Consola de Cuadre Ejecutivo Directo', () => {
  it('calcula correctamente el delta de efectivo en Caja Chica', () => {
    const currentSaldoCaja = 800000;
    const targetCaja = 844526.90;
    const delta = round2(targetCaja - currentSaldoCaja);
    expect(delta).toBe(44526.90);
    expect(delta > 0).toBe(true); // Requiere ingreso contable de calibración
  });

  it('calcula correctamente el delta de cuenta corriente con Andrés', () => {
    const currentSaldoAndres = 100000;
    const targetAndres = 103411.84;
    const delta = round2(targetAndres - currentSaldoAndres);
    expect(delta).toBe(3411.84);
  });

  it('cuadra el saldo oficial de cartera Providencia en los 4 rubros maestros', () => {
    const totalCrs = CARTERA_OFICIAL.reduce((sum, c) => sum + c.monto, 0);
    const revision = 113925.92; // F-6302 ($39,105.92) + F-6307 ($74,820.00)
    const totalDeuda = round2(totalCrs + revision);

    expect(totalCrs).toBe(805190.14);
    expect(totalDeuda).toBe(919116.06);
    expect(SALDO_CAJA_ACTUAL).toBe(844526.90);
  });
});
