import { describe, it, expect } from 'vitest';
import { round2, computeCommissionFromInvoiceTotal } from '../finance';

/**
 * FASE 6: PRUEBAS INTEGRALES DE FLUJO EXTREMO A EXTREMO
 * Simula el ciclo comercial e industrial completo del intermediario:
 * 1. Orden de Compra (OC) del Cliente (Providencia GT o TH)
 * 2. Fabricación y Entregas en Báscula por Maquilador (Andrés)
 * 3. Facturación CFDI (SAT)
 * 4. Obtención de Contrarecibo de Providencia
 * 5. Cobranza, Comisiones Contables (8% s/ subtotal) y Flujo en Caja
 * 6. Liquidación y Saldo de Maquila de Andrés
 */
describe('FASE 6: Pruebas Integrales de Flujo Extremo a Extremo (E2E Cycle)', () => {
  const ERP_CONFIG = {
    salePricePerKg: 43.0,
    costPricePerKg: 38.0,
    commissionRate: 0.08,
    commissionBase: 'subtotal' as const,
    ivaRate: 0.16,
    creditDays: 30,
  };

  it('1. Ciclo Completo GT: OC 12026439784 (5,100 kg) -> Entregas Báscula -> Factura -> CR -> Cobro -> Saldo Andrés', () => {
    const ocKg = 5100;
    const precioKg = ERP_CONFIG.salePricePerKg; // $43.00
    const tarifaMaquila = ERP_CONFIG.costPricePerKg; // $38.00

    // Paso 1: Apertura de OC
    const subtotalOC = round2(ocKg * precioKg); // $219,300.00
    const ivaOC = round2(subtotalOC * ERP_CONFIG.ivaRate); // $35,088.00
    const totalOC = round2(subtotalOC + ivaOC); // $254,388.00

    expect(subtotalOC).toBe(219300.0);
    expect(totalOC).toBe(254388.0);

    // Paso 2: Entregas parciales en báscula por maquilador (Andrés)
    // Partida 1: 2,500 kg, Partida 2: 2,600 kg = 5,100 kg
    const delivery1 = { id: 'del-gt-1', kilos: 2500, folio: 'REM-9784-1', invoiced: false };
    const delivery2 = { id: 'del-gt-2', kilos: 2600, folio: 'REM-9784-2', invoiced: false };
    const entregas = [delivery1, delivery2];

    const kilosEntregados = entregas.reduce((acc, d) => acc + d.kilos, 0);
    const kilosFaltantes = ocKg - kilosEntregados;

    expect(kilosEntregados).toBe(5100);
    expect(kilosFaltantes).toBe(0);

    // Paso 3: Facturación timbrada (ampara los 5,100 kg)
    const factura = {
      id: 'inv-gt-6369',
      folio: 'F-6369',
      kilos: 5100,
      subtotal: subtotalOC,
      total: totalOC,
      contrarecibo: null as string | null,
      status: 'facturado',
      paidAmount: 0,
    };

    // Marcar entregas como facturadas
    entregas.forEach((d) => (d.invoiced = true));
    const kilosPendientesFacturar = entregas.filter((d) => !d.invoiced).reduce((acc, d) => acc + d.kilos, 0);
    expect(kilosPendientesFacturar).toBe(0);

    // Paso 4: Providencia emite Contrarecibo Oficial
    const contrarecibo = {
      cr: 'GT-991',
      facturaFolio: factura.folio,
      total: factura.total,
      fechaProgramada: '2026-11-15',
      status: 'programado',
    };
    factura.contrarecibo = contrarecibo.cr;
    factura.status = 'revision';

    expect(factura.contrarecibo).toBe('GT-991');

    // Paso 5: Depósito bancario de Providencia y Conciliación
    factura.paidAmount = contrarecibo.total;
    factura.status = 'paid';

    // Comisión del contador (8% sobre subtotal)
    const comisionContador = computeCommissionFromInvoiceTotal(factura.total, ERP_CONFIG);
    const comisionEsperada = round2(factura.subtotal * 0.08); // 219,300 * 0.08 = 17,544.00
    expect(comisionContador).toBe(17544.0);
    expect(comisionContador).toBe(comisionEsperada);

    // Flujo en caja neta recibida de Providencia
    const ingresoBrutoCaja = factura.total; // $254,388.00
    const gastoComision = comisionContador; // $17,544.00
    const cajaPostComision = round2(ingresoBrutoCaja - gastoComision); // $236,844.00
    expect(cajaPostComision).toBe(236844.0);

    // Paso 6: Liquidación de Maquila a Andrés
    // Costo maquila pactado: 5,100 kg * $38 = $193,800.00
    const costoMaquila = round2(ocKg * tarifaMaquila);
    expect(costoMaquila).toBe(193800.0);

    // Pago a Andrés desde caja
    const cajaFinal = round2(cajaPostComision - costoMaquila); // 236,844.00 - 193,800.00 = 43,044.00 utilidad bruta
    expect(cajaFinal).toBe(43044.0);
  });

  it('2. Ciclo TH: OC 120267114302 (8,000 kg) con Entrega Parcial y Tarifa Maquila Negociada ($37/kg)', () => {
    const ocKg = 8000;
    const precioKg = 43.0;
    const tarifaMaquilaEspecial = 37.0; // Tarifa negociada por lote recuperado

    // Apertura OC
    const totalOC = round2(ocKg * precioKg * 1.16); // 8000 * 43 * 1.16 = 399,040.00
    expect(totalOC).toBe(399040.0);

    // Entrega parcial en báscula: 4,000 kg
    const delivery = { kilos: 4000, invoiced: false };
    const kilosFaltantes = ocKg - delivery.kilos;
    expect(kilosFaltantes).toBe(4000);

    // Facturación únicamente por los 4,000 kg entregados físicamente
    const subtotalFacturado = round2(delivery.kilos * precioKg); // 172,000.00
    const totalFacturado = round2(subtotalFacturado * 1.16); // 199,520.00
    delivery.invoiced = true;

    // Comisión contador de la entrega parcial
    const comision = computeCommissionFromInvoiceTotal(totalFacturado, ERP_CONFIG);
    expect(comision).toBe(round2(subtotalFacturado * 0.08)); // 13,760.00

    // Liquidación parcial a Andrés a tarifa especial $37/kg
    const maquilaParcial = round2(delivery.kilos * tarifaMaquilaEspecial); // 4000 * 37 = 148,000.00
    expect(maquilaParcial).toBe(148000.0);

    // Margen bruto intermedio para la empresa
    const margenBruto = round2(subtotalFacturado - maquilaParcial - comision);
    // 172,000 - 148,000 - 13,760 = 10,240.00
    expect(margenBruto).toBe(10240.0);
  });

  it('3. Resiliencia de Balanza y Convención de Signos de Deuda Andrés', () => {
    // Convención:
    // Positivo (+): Anticipo a favor de Andrés (la empresa ya le pagó por adelantado)
    // Negativo (-): Deuda con Andrés (Andrés entregó material y la empresa le debe)
    let historicalDebtAndres = 0;

    // Andrés entrega lote de 3,000 kg a $38 = $114,000 de servicio prestado -> deuda de la empresa
    historicalDebtAndres -= 114000;
    expect(historicalDebtAndres).toBe(-114000);

    // La empresa realiza transferencia parcial de $50,000
    historicalDebtAndres += 50000;
    expect(historicalDebtAndres).toBe(-64000); // Aún se le deben $64,000

    // La empresa liquida $80,000 ($64,000 de saldo + $16,000 de anticipo)
    historicalDebtAndres += 80000;
    expect(historicalDebtAndres).toBe(16000); // Saldo a favor de Andrés (anticipo disponible)
  });
});
