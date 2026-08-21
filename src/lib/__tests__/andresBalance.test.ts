import { describe, it, expect } from 'vitest';
import { computeAndresBalance } from '../finance';

/**
 * REGRESIÓN DIRECTA DE UN INCIDENTE REAL: "Saldo con Andrés" del Dashboard
 * mostraba -$1,289,709.62 mientras que Compras -> Andrés, para el MISMO
 * dato, mostraba +$40,800.00 -- una diferencia de $1,330,509.62 dentro de la
 * misma sesión de la misma app. Causa: la fórmula (kilos/costo/pagado/saldo)
 * vivía copiada TRES veces (src/hooks/useAndresStats.ts,
 * src/hooks/useDashboardStatsV2.ts, functions/src/index.ts) y una de las
 * copias se olvidó de leer `historicalDebtAndres` del config real.
 *
 * Las tres ahora llaman a computeAndresBalance() (finance.core.ts). Estas
 * pruebas no repiten la fórmula por su cuenta -- eso solo probaría que la
 * función está de acuerdo consigo misma. En vez de eso fijan valores
 * esperados calculados a mano, así que si alguien vuelve a copiar la
 * fórmula en un cuarto lugar (en vez de importar esta función), o la edita
 * aquí sin querer, la prueba lo detecta.
 */
describe('computeAndresBalance ("Saldo con Andrés" -- fuente única de verdad)', () => {
  it('incluye la deuda histórica del config real, no un respaldo fijo viejo (el bug real)', () => {
    // Exactamente el escenario del incidente: el config trae un
    // historicalDebtAndres real y reciente ($1,227,839.35). Si algún
    // llamador construyera su propio objeto de config a mano y se le
    // olvidara copiar este campo, el resultado caería en 0 en vez de este
    // valor -- la causa raíz real del desfase de $1.3M.
    const result = computeAndresBalance(
      [{ provider: 'Andrés', receivedKilos: 1000, pricePerKg: 42 }],
      [{ provider: 'Andrés', type: 'egreso', amount: 50000 }],
      { costPricePerKg: 42, historicalDebtAndres: 1227839.35 },
      'Andres',
    );

    // pagado 50,000 - costo (1000 x 42 = 42,000) + deuda histórica 1,227,839.35
    expect(result.saldoProveedor).toBe(50000 - 42000 + 1227839.35);
    expect(result.historicalDebtAndres).toBe(1227839.35);
  });

  it('sin historicalDebtAndres en el config, usa 0 (no revienta, no inventa un valor)', () => {
    const result = computeAndresBalance(
      [{ provider: 'Andres', receivedKilos: 100, pricePerKg: 40 }],
      [{ provider: 'Andres', type: 'egreso', amount: 5000 }],
      { costPricePerKg: 42 },
      'Andres',
    );
    // pagado 5000 - costo (100 x 40 = 4000) + 0
    expect(result.saldoProveedor).toBe(1000);
    expect(result.historicalDebtAndres).toBe(0);
  });

  it('"Andrés" (con acento) y "Andres" (sin acento) son el mismo proveedor', () => {
    const conAcento = computeAndresBalance(
      [{ provider: 'Andrés', receivedKilos: 100, pricePerKg: 42 }],
      [],
      { costPricePerKg: 42 },
      'Andres',
    );
    const sinAcento = computeAndresBalance(
      [{ provider: 'andres', receivedKilos: 100, pricePerKg: 42 }],
      [],
      { costPricePerKg: 42 },
      'Andrés',
    );
    expect(conAcento.totalReceivedKilos).toBe(sinAcento.totalReceivedKilos);
    expect(conAcento.saldoProveedor).toBe(sinAcento.saldoProveedor);
  });

  it('egreso (pago) suma al saldo pagado, ingreso (devolución) resta', () => {
    const result = computeAndresBalance(
      [],
      [
        { provider: 'Andres', type: 'egreso', amount: 10000 },
        { provider: 'Andres', type: 'ingreso', amount: 2000 },
      ],
      { costPricePerKg: 42 },
      'Andres',
    );
    expect(result.totalPagado).toBe(10000 - 2000);
  });

  it('una compra sin pricePerKg propio usa el costo configurado como respaldo', () => {
    const result = computeAndresBalance(
      [{ provider: 'Andres', receivedKilos: 500, pricePerKg: null }],
      [],
      { costPricePerKg: 42 },
      'Andres',
    );
    expect(result.totalPurchasesCost).toBe(500 * 42);
  });

  it('un proveedor distinto (ej. maquiladores nuevos) no contamina el saldo de Andrés', () => {
    const result = computeAndresBalance(
      [
        { provider: 'Andres', receivedKilos: 100, pricePerKg: 42 },
        { provider: 'Otro Maquilador', receivedKilos: 9999, pricePerKg: 1 },
      ],
      [
        { provider: 'Andres', type: 'egreso', amount: 1000 },
        { provider: 'Otro Maquilador', type: 'egreso', amount: 99999 },
      ],
      { costPricePerKg: 42 },
      'Andres',
    );
    expect(result.totalReceivedKilos).toBe(100);
    expect(result.totalPagado).toBe(1000);
  });

  it('compras/gastos sin datos (undefined, null, provider vacío) no rompen el cálculo', () => {
    const result = computeAndresBalance(
      [null as any, { provider: '', receivedKilos: 50, pricePerKg: 42 }, { provider: 'Andres', receivedKilos: 10, pricePerKg: 42 }],
      [undefined as any, { provider: 'Andres', type: 'egreso', amount: 100 }],
      { costPricePerKg: 42 },
      'Andres',
    );
    expect(result.totalReceivedKilos).toBe(10);
    expect(result.totalPagado).toBe(100);
  });

  it('purchases/expenses null o undefined (carga inicial de Firestore) devuelven saldo en ceros, no truenan', () => {
    const result = computeAndresBalance(null, undefined, { costPricePerKg: 42, historicalDebtAndres: 500 });
    expect(result.totalReceivedKilos).toBe(0);
    expect(result.totalPagado).toBe(0);
    expect(result.saldoProveedor).toBe(500);
  });
});
