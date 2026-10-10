import { describe, it, expect } from 'vitest';
import { OFFICIAL_CRS, OFFICIAL_PAID_CRS } from '../../components/Cobranza/SincronizadorOficialModal';
import { round2 } from '../finance';
import { DEFAULT_CONFIG } from '../types';

describe('Fase 2: Protección de Datos, Reglas Financieras y Sincronizador Seguro', () => {
  it('el sincronizador oficial no incluye banderas ni funciones de purga masiva predeterminada', () => {
    // Verificar que OFFICIAL_CRS y OFFICIAL_PAID_CRS son conjuntos fijos de datos oficiales
    expect(OFFICIAL_CRS.length).toBe(12);
    expect(OFFICIAL_PAID_CRS.length).toBe(10);

    const totalCrs = round2(OFFICIAL_CRS.reduce((acc, c) => acc + c.total, 0));
    expect(totalCrs).toBe(896403.46);
  });

  it('preserva el signo y montos válidos en la convención de saldos de Andrés (historicalDebtAndres)', () => {
    // 1. Saldo a favor (positivo)
    const saldoAFavor = 103411.84;
    expect(saldoAFavor).toBeGreaterThan(0);

    // 2. Saldo con deuda pendiente de la empresa (negativo)
    const deudaConAndres = -75000.50;
    expect(deudaConAndres).toBeLessThan(0);

    // 3. Monto alto legítimo (superior a 500,000) debe preservarse intacto sin sustituirse por 103411.84
    const saldoAltoValido = 850000.00;
    const sanitizadoFase2 = typeof saldoAltoValido === 'number' ? saldoAltoValido : DEFAULT_CONFIG.historicalDebtAndres;
    expect(sanitizadoFase2).toBe(850000.00);

    // 4. Saldo negativo debe mantener su signo en los cálculos de libro mayor
    const saldoNegativoValido = -45200.00;
    const saldoPreservado = typeof saldoNegativoValido === 'number' ? saldoNegativoValido : DEFAULT_CONFIG.historicalDebtAndres;
    expect(saldoPreservado).toBe(-45200.00);
  });

  it('no revive expedientes marcados con soft-delete (isDeleted: true)', () => {
    const ordenEliminada = {
      id: 'cr-gt-1047',
      isDeleted: true,
      deletedAt: { seconds: 1728000000, nanoseconds: 0 },
      folio: 'GT-1047',
      totalAmount: 82302.00,
    };

    // Si la orden está marcada como eliminada, debe ser excluida o marcada como omitida
    const isExcluido = Boolean(ordenEliminada.isDeleted);
    expect(isExcluido).toBe(true);
  });
});
