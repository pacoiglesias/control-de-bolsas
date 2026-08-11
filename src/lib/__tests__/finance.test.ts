import { describe, it, expect } from 'vitest';
import { computeFinancials, computeDynamicFinancials, configEfectiva, getOrderSummary, round2, extractDashboardAlerts, calculateLiveMargenTotal, normalizarTexto } from '../finance';
import { DEFAULT_CONFIG, type OrderStatus, type PurchaseOrder } from '../types';

/**
 * Estas dos funciones son donde un error se traduce directamente en dinero mal
 * contado. Cada prueba de aquí corresponde a un defecto real que llegó a
 * producción, no a un caso inventado.
 */

const cfg = { ...DEFAULT_CONFIG };

function orden(parcial: Partial<PurchaseOrder>): PurchaseOrder {
  return {
    id: 'oc-1',
    fileName: 'oc.pdf',
    folio: 'TH-100',
    totalKilograms: 100,
    processedAt: null,
    ...parcial,
  } as PurchaseOrder;
}

function factura(status: OrderStatus, kilos = 100) {
  return {
    id: `inv-${status}`,
    orderId: 'oc-1',
    folio: 'F-1',
    kilos,
    financials: computeFinancials(kilos, cfg),
    creditCycle: { status, issueDate: null, dueDate: null },
  };
}

describe('computeFinancials', () => {
  it('el honorario del contador va sobre el SUBTOTAL, no sobre la factura', () => {
    // FIX 2026-08-11 (Iteracion 106): estos valores estaban hardcodeados con
    // el precio de venta viejo ($47/kg), que cambio a $43/kg en la
    // Iteracion 98 (v7.0.24, confirmado por el usuario). Las pruebas nunca
    // se actualizaron, asi que quedaron fallando en falso -- el codigo
    // calculaba bien, las pruebas comparaban contra un precio que ya no
    // existe. cfg viene de DEFAULT_CONFIG, asi que sigue el precio vigente.
    const f = computeFinancials(100, cfg);
    expect(f.saleTotal).toBe(4300); // 100 kg x $43/kg
    expect(f.invoiceTotal).toBe(4988); // 4300 x 1.16 IVA
    expect(f.costTotal).toBe(4200); // 100 kg x $42/kg costo -- no cambio
    // 8% del subtotal: 4300 x 0.08 = 344.00
    expect(f.commission).toBe(344);
    // 4300 - 4200 - 344 = -244 (el margen se volvio negativo al bajar el
    // precio de venta a $43 sin bajar el costo de $42 -- esto es correcto
    // segun la configuracion actual, no un error de la formula)
    expect(f.netCashFlow).toBe(-244);
  });

  it('reproduce al centavo un cobro real del contador', () => {
    // Cobro real: bruto 153,381.00 -> subtotal 132,225.00, depositado 142,803.00.
    const kilos = 132225 / cfg.salePricePerKg;
    const f = computeFinancials(kilos, cfg);
    expect(f.saleTotal).toBe(132225);
    expect(f.invoiceTotal).toBe(153381);
    expect(f.commission).toBe(10578);
    expect(round2(f.invoiceTotal! - f.commission!)).toBe(142803);
  });

  it('respeta commissionBase: total cuando así se configura', () => {
    const f = computeFinancials(100, { ...cfg, commissionBase: 'total' });
    expect(f.commission).toBe(399.04); // 4988 x 0.08 (ver Iteracion 106: precio $43/kg vigente)
  });

  it('redondea a dos decimales todos los importes', () => {
    const f = computeFinancials(33.333, cfg);
    // Las tasas y precios unitarios se copian tal cual de la config; solo los
    // importes calculados se redondean.
    const importes = [f.saleTotal, f.invoiceTotal, f.costTotal, f.commission, f.netCashFlow];
    for (const v of importes) {
      expect(Math.round(v * 100) / 100).toBe(v);
    }
  });

  it('kilos no numéricos no producen NaN', () => {
    const f = computeFinancials(Number.NaN, cfg);
    expect(f.saleTotal).toBe(0);
    expect(f.netCashFlow).toBe(0);
  });

});

describe('configEfectiva', () => {
  it('aplica el costo y la comisión propios del expediente', () => {
    const c = configEfectiva(cfg, { customCostPrice: 45, customCommissionRate: 0.08 });
    expect(c.costPricePerKg).toBe(45);
    expect(c.commissionRate).toBe(0.08);
  });

  it('ignora valores ausentes o inválidos y conserva la config base', () => {
    const c = configEfectiva(cfg, { customCostPrice: undefined, customCommissionRate: 'x' });
    expect(c.costPricePerKg).toBe(cfg.costPricePerKg);
    expect(c.commissionRate).toBe(cfg.commissionRate);
  });

  it('no muta la configuración base', () => {
    const base = { ...cfg };
    configEfectiva(base, { customCostPrice: 99 });
    expect(base.costPricePerKg).toBe(cfg.costPricePerKg);
  });
});

describe('getOrderSummary — derivación de estatus', () => {
  // Regresión: 'collected' no estaba contemplado. Una factura en ese estado no
  // encendía ninguna bandera y el estatus caía al campo legado de la raíz, así
  // que un expediente totalmente cobrado se mostraba como pendiente.
  it('un expediente con todas las facturas cobradas y recibidas es collected', () => {
    const o = orden({
      invoices: [factura('collected')],
      creditCycle: { status: 'pending' } as PurchaseOrder['creditCycle'],
    });
    expect(getOrderSummary(o).status).toBe('collected');
  });

  it('nunca cae al estatus legado de la raíz cuando hay facturas', () => {
    const todos: OrderStatus[] = [
      'pedido', 'facturado', 'pending', 'paid', 'collected', 'overdue', 'manual_review',
    ];
    for (const s of todos) {
      const o = orden({
        invoices: [factura(s)],
        // Un valor de raíz distinto y visiblemente equivocado: si aparece en el
        // resultado, es que la cascada de if/else no cubrió ese estado.
        creditCycle: { status: 'manual_review' } as PurchaseOrder['creditCycle'],
      });
      const derivado = getOrderSummary(o).status;
      if (s !== 'manual_review') {
        expect(derivado, `el estado '${s}' cae al valor legado de la raíz`).not.toBe('manual_review');
      }
    }
  });

  it('vencida gana sobre cualquier otro estado', () => {
    const o = orden({ invoices: [factura('paid', 50), factura('overdue', 50)] });
    expect(getOrderSummary(o).status).toBe('overdue');
  });

  it('todo pagado pero con kilos sin facturar sigue abierto', () => {
    const o = orden({ totalKilograms: 200, invoices: [factura('paid', 100)] });
    expect(getOrderSummary(o).status).toBe('pending');
  });

  it('la deuda se mide contra el total con IVA', () => {
    const o = orden({ invoices: [factura('pending')] });
    const s = getOrderSummary(o);
    expect(s.invoiceTotal - s.paidAmount).toBe(4988); // ver Iteracion 106: precio $43/kg vigente
  });

  it('realizedProfit no produce NaN si invTotal es cero', () => {
    // Si una factura tiene monto total 0, no debe causar división por cero
    const o = orden({ invoices: [factura('paid', 0)] });
    // Modificamos manualmente el total a 0
    (o.invoices![0] as any).total = 0;
    const s = getOrderSummary(o);
    expect(s.realizedProfit).toBe(0);
    expect(Number.isNaN(s.realizedProfit)).toBe(false);
  });
});

describe('computeDynamicFinancials (Instructivo Motor Financiero)', () => {
  it('calcula los kilos, costo total y ganancia limpia según las reglas del instructivo', () => {
    const input = {
      costo_compra_kg: 42,
      precio_venta_base_kg: 47,
      tasa_adicional_pct: 0.16,
      monto_facturado_total: 54520,
      porcentaje_comision: 0.08,
    };
    const res = computeDynamicFinancials(input);
    expect(res.precio_venta_final_kg).toBe(54.52);
    expect(res.kilos_vendidos).toBe(1000);
    expect(res.costo_total_compra).toBe(42000);
    expect(res.monto_recibido_neto).toBe(50158.4);
    expect(res.monto_comision_gestor).toBe(4361.6);
    expect(res.porcentaje_comision_real).toBe(8);
    expect(res.ganancia_limpia_total).toBe(8158.4);
    expect(res.ganancia_limpia_por_kg).toBe(8.16);
  });

  it('despeja automáticamente el porcentaje de comisión real si el usuario ingresa monto_recibido_neto', () => {
    const input = {
      costo_compra_kg: 42,
      precio_venta_base_kg: 47,
      tasa_adicional_pct: 0.16,
      monto_facturado_total: 100000,
      monto_recibido_neto: 92000,
    };
    const res = computeDynamicFinancials(input);
    expect(res.monto_comision_gestor).toBe(8000);
    expect(res.porcentaje_comision_real).toBe(8);
    expect(res.ganancia_limpia_total).toBe(14964.02);
  });
});

describe('Dashboard Extractions', () => {
  it('extractDashboardAlerts counts correct statuses', () => {
    const o1 = orden({ invoices: [factura('pending'), factura('paid')] });
    const o2 = orden({ invoices: [factura('overdue')] });
    
    // Simular que overdue venció hace 40 días
    (o2.invoices![0].creditCycle as any).dueDate = new Date(Date.now() - 40 * 86400000);

    const alerts = extractDashboardAlerts([o1, o2]);
    
    expect(alerts.porRecibir.length).toBe(1); // 1 paid
    expect(alerts.criticos30).toBe(1); // 1 overdue (>30 days)
  });

  it('calculateLiveMargenTotal sum correctly', () => {
    // Ver Iteracion 106: precio $43/kg vigente (antes $47).
    // 100 kilos x $43 sale = 4300. cost = 4200. comm = 344.
    // 4300 - 4200 - 344 = -244 margin per invoice
    const o = orden({ invoices: [factura('pending'), factura('paid')] });
    const margin = calculateLiveMargenTotal([o], 42);
    expect(margin).toBe(-488); // -244 * 2
  });
});


describe('normalizarTexto', () => {
  it('trata "Andres" y "Andrés" como el mismo proveedor', () => {
    expect(normalizarTexto('Andrés')).toBe(normalizarTexto('Andres'));
    expect(normalizarTexto('ANDRÉS')).toBe(normalizarTexto('andres'));
  });

  it('ignora mayusculas, acentos y espacios sobrantes', () => {
    expect(normalizarTexto('  Providencia  ')).toBe('providencia');
    expect(normalizarTexto('José Nava')).toBe('jose nava');
  });

  it('maneja null/undefined sin tronar', () => {
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto(undefined)).toBe('');
  });
});
