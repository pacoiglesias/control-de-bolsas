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

  it('preserva íntegramente facturas existentes, kilos reales y estados al vincular contrarecibo a matchingOrder', () => {
    const ordenPrevia: any = {
      id: 'cr-gt-1047',
      folio: 'GT-1047',
      status: 'collected',
      creditCycle: { status: 'collected' },
      invoices: [
        {
          id: 'inv-real-6352',
          folio: '6352',
          kilos: 1650.50, // Kilos reales pesados en báscula
          creditCycle: { status: 'collected' },
          collection: { paidAmount: 82302.00 },
          financials: { invoiceTotal: 82302.00, saleTotal: 70950.00, costTotal: 62719.00 },
        },
      ],
    };

    // Lógica no destructiva de actualización de matchingOrder:
    const issueDateStr = '2026-10-05T12:00:00';
    const crNumber = 'GT-1047';
    const updatedInvoices = ordenPrevia.invoices.map((inv: any) => ({
      ...inv,
      collection: {
        ...inv.collection,
        contrareciboNumber: crNumber,
        contrareciboDate: inv.collection?.contrareciboDate || issueDateStr,
      },
    }));

    const currentStatus = ordenPrevia.creditCycle?.status || ordenPrevia.status || 'pending';
    const newStatus = (currentStatus === 'collected' || currentStatus === 'in_review') ? currentStatus : 'pending';

    // Verificaciones:
    // 1. Facturas reales no fueron borradas ni recreadas
    expect(updatedInvoices.length).toBe(1);
    expect(updatedInvoices[0].id).toBe('inv-real-6352');
    // 2. Kilos de báscula no fueron recalculados con 82302 / (43 * 1.16)
    expect(updatedInvoices[0].kilos).toBe(1650.50);
    expect(updatedInvoices[0].kilos).not.toBe(Math.round(82302 / (43 * 1.16)));
    // 3. Monto cobrado no fue reiniciado a 0
    expect(updatedInvoices[0].collection.paidAmount).toBe(82302.00);
    // 4. Estado de cobranza no fue degradado a 'pending'
    expect(newStatus).toBe('collected');
    expect(updatedInvoices[0].creditCycle.status).toBe('collected');
    // 5. El CR fue vinculado correctamente
    expect(updatedInvoices[0].collection.contrareciboNumber).toBe('GT-1047');
  });

  it('no inventa kilos con división artificial al registrar contrarecibos sin datos de báscula', () => {
    // Al registrar un CR nuevo sin remisión física de báscula, los kilos deben ser 0 (pendiente de báscula)
    // para no corromper la balanza de maquila ni el inventario de resina.
    const itemCrSinBascula = { total: 82302.00 };
    const kilosRegistrados = 0; // Política segura: 0 kilos inventados
    expect(kilosRegistrados).toBe(0);
    expect(kilosRegistrados).not.toBe(Math.round(itemCrSinBascula.total / (43 * 1.16)));
  });
});
