import { describe, it, expect } from 'vitest';
import { computeFinancials, computeDynamicFinancials, configEfectiva, getOrderSummary, round2, extractDashboardAlerts, calculateLiveMargenTotal, normalizarTexto, computeAndresRequirement, getSuggestedNextAction } from '../finance';
import { DEFAULT_CONFIG, type OrderStatus, type PurchaseOrder } from '../types';

/**
 * Estas funciones son donde un error se traduce directamente en dinero mal
 * contado. Cada prueba de aquí corresponde a un defecto real o regla de negocio.
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
    const f = computeFinancials(100, cfg);
    expect(f.saleTotal).toBe(4300);
    expect(f.invoiceTotal).toBe(4988);
    expect(f.costTotal).toBe(4200);
    // 8% del subtotal: 4300 x 0.08 = 344.00
    expect(f.commission).toBe(344);
    // 4300 - 4200 - 344 = -244
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
    expect(f.commission).toBe(399.04); // 4988 x 0.08
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
    expect(s.invoiceTotal - s.paidAmount).toBe(4988);
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
    // 100 kilos * 47 sale = 4700. cost = 42. comm = 376. 4700 - 4200 - 376 = 124 margin per invoice
    const o = orden({ invoices: [factura('pending'), factura('paid')] });
    const margin = calculateLiveMargenTotal([o], 42);
    expect(margin).toBe(-488);
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

describe('computeAndresRequirement & getSuggestedNextAction', () => {
  it('calcula requerimiento para Andrés con mensaje de WhatsApp', () => {
    const o = orden({
      totalKilograms: 1000,
      client: 'Grupo Providencia',
      folio: 'OC-999',
    });
    const req = computeAndresRequirement(o, cfg);
    expect(req.kilos).toBe(1000);
    expect(req.costTotal).toBe(42000);
    expect(req.saleTotal).toBe(43000);
    expect(req.invoiceTotal).toBe(49880);
    expect(req.whatsappMessage).toContain('Andrés');
    expect(req.whatsappMessage).toContain('OC-999');
  });

  it('sugiere siguiente paso pedir a Andrés para una OC nueva', () => {
    const o = orden({ totalKilograms: 500, deliveries: [], invoices: [] });
    const action = getSuggestedNextAction(o, cfg);
    expect(action.key).toBe('pedir_andres');
    expect(action.targetTab).toBe('andres');
  });

  it('sugiere facturar entrega si Andrés ya entregó', () => {
    const o = orden({
      totalKilograms: 500,
      deliveries: [{ id: 'd1', date: null, kilos: 500, invoiced: false }],
      invoices: [],
    });
    const action = getSuggestedNextAction(o, cfg);
    expect(action.key).toBe('facturar_entrega');
    expect(action.targetTab).toBe('facturas');
  });
});

describe('Casos Numéricos Extremos y Blindaje Financiero (OKR 1)', () => {
  it('maneja cantidades mínimas (0.01 kg) sin pérdidas de redondeo', () => {
    const f = computeFinancials(0.01, cfg);
    expect(f.saleTotal).toBe(0.43);
    expect(f.costTotal).toBe(0.42);
    expect(f.invoiceTotal).toBe(0.5); // 0.43 * 1.16 = 0.4988 -> 0.50
    expect(f.commission).toBe(0.03); // 0.43 * 0.08 = 0.0344 -> 0.03
    expect(f.netCashFlow).toBe(-0.02); // 0.43 - 0.42 - 0.03 = -0.02
  });

  it('maneja órdenes masivas de 500,000 kg con exactitud aritmética', () => {
    const f = computeFinancials(500000, cfg);
    expect(f.saleTotal).toBe(21500000);
    expect(f.costTotal).toBe(21000000);
    expect(f.invoiceTotal).toBe(24940000);
    expect(f.commission).toBe(1720000); // 21,500,000 * 0.08
    expect(f.netCashFlow).toBe(-1220000); // 21.5M - 21M - 1.72M
  });

  it('reparto 50/50 entre socios no produce centavos fantasma', () => {
    // Para una utilidad neta de $15,345.55
    const netProfit = 15345.55;
    const pacoShare = round2(netProfit / 2);
    const socioShare = round2(netProfit - pacoShare);
    expect(round2(pacoShare + socioShare)).toBe(netProfit);
    expect(Math.abs(pacoShare - socioShare)).toBeLessThanOrEqual(0.01);
  });

  it('desglose exacto de cobranza con 8% de comisión en $100,000 con IVA', () => {
    const totalFactura = 100000.00;
    const comision = round2(totalFactura * 0.08);
    const netoCaja = round2(totalFactura - comision);
    expect(comision).toBe(8000.00);
    expect(netoCaja).toBe(92000.00);
    expect(round2(comision + netoCaja)).toBe(totalFactura);
  });
});

describe('Conciliación Oficial de Contrarecibos y Filtro Departamental TH/GT', () => {
  it('orderMatchesDepartment filtra correctamente por departamento, contrarecibo y cliente', async () => {
    const { orderMatchesDepartment } = await import('../finance');
    
    // Caso 1: Departamento explícito
    expect(orderMatchesDepartment({ department: 'TH' } as any, 'TH')).toBe(true);
    expect(orderMatchesDepartment({ department: 'TH' } as any, 'GT')).toBe(false);
    expect(orderMatchesDepartment({ department: 'GT' } as any, 'GT')).toBe(true);
    expect(orderMatchesDepartment({ department: 'GT' } as any, 'ALL')).toBe(true);

    // Caso 2: Contrarecibo asignado TH-912 o GT-742
    expect(orderMatchesDepartment({ collection: { contrareciboNumber: 'TH-912' } } as any, 'TH')).toBe(true);
    expect(orderMatchesDepartment({ collection: { contrareciboNumber: 'GT-742' } } as any, 'GT')).toBe(true);
    expect(orderMatchesDepartment({ collection: { contrareciboNumber: 'GT-742' } } as any, 'TH')).toBe(false);

    // Caso 3: Factura individual con contrarecibo TH-879
    const orderWithInvCr = {
      invoices: [{ collection: { contrareciboNumber: 'TH-879' } }]
    } as any;
    expect(orderMatchesDepartment(orderWithInvCr, 'TH')).toBe(true);
    expect(orderMatchesDepartment(orderWithInvCr, 'GT')).toBe(false);

    // Caso 4: Cliente con sufijo Providencia - TH
    expect(orderMatchesDepartment({ client: 'Grupo Textil Providencia - TH' } as any, 'TH')).toBe(true);
    expect(orderMatchesDepartment({ client: 'Grupo Textil Providencia - GT' } as any, 'GT')).toBe(true);
  });

  it('Los 10 contrarecibos oficiales suman exactamente $1,019,956.34 ($584,400.42 TH + $435,555.92 GT)', () => {
    const thCrs = [79826.00, 136300.00, 106720.17, 136300.00, 125254.25];
    const gtCrs = [54520.00, 69001.60, 106477.56, 98136.00, 107420.76];

    const sumTh = round2(thCrs.reduce((a, b) => a + b, 0));
    const sumGt = round2(gtCrs.reduce((a, b) => a + b, 0));
    const grandTotal = round2(sumTh + sumGt);

    expect(sumTh).toBe(584400.42);
    expect(sumGt).toBe(435555.92);
    expect(grandTotal).toBe(1019956.34);
  });

  it('filterOrderByDepartment separa estrictamente las facturas de TH y GT dentro de una orden compuesta', async () => {
    const { filterOrderByDepartment, invoiceMatchesDepartment } = await import('../finance');

    const multiDeptOrder = {
      id: 'ord-multi',
      folio: 'OC-120267',
      totalKilograms: 20000,
      invoices: [
        { id: 'inv-th-1', kilos: 1600, collection: { contrareciboNumber: 'TH-912' }, financials: { invoiceTotal: 79826.00 } },
        { id: 'inv-th-2', kilos: 2732.55, collection: { contrareciboNumber: 'TH-879' }, financials: { invoiceTotal: 136300.00 } },
        { id: 'inv-gt-1', kilos: 1093.02, collection: { contrareciboNumber: 'GT-742' }, financials: { invoiceTotal: 54520.00 } },
        { id: 'inv-gt-2', kilos: 1383.35, collection: { contrareciboNumber: 'GT-713' }, financials: { invoiceTotal: 69001.60 } },
      ],
    } as any;

    // Test invoiceMatchesDepartment
    expect(invoiceMatchesDepartment(multiDeptOrder.invoices[0], multiDeptOrder, 'TH')).toBe(true);
    expect(invoiceMatchesDepartment(multiDeptOrder.invoices[0], multiDeptOrder, 'GT')).toBe(false);
    expect(invoiceMatchesDepartment(multiDeptOrder.invoices[2], multiDeptOrder, 'TH')).toBe(false);
    expect(invoiceMatchesDepartment(multiDeptOrder.invoices[2], multiDeptOrder, 'GT')).toBe(true);

    // Test filterOrderByDepartment para TH
    const thFiltered = filterOrderByDepartment(multiDeptOrder, 'TH');
    expect(thFiltered).not.toBeNull();
    expect(thFiltered?.invoices).toHaveLength(2);
    expect(thFiltered?.invoices?.[0]?.collection?.contrareciboNumber).toBe('TH-912');
    expect(thFiltered?.invoices?.[1]?.collection?.contrareciboNumber).toBe('TH-879');
    const totalTh = (thFiltered?.invoices || []).reduce((sum: number, inv: any) => sum + inv.financials.invoiceTotal, 0);
    expect(totalTh).toBe(216126.00);

    // Test filterOrderByDepartment para GT
    const gtFiltered = filterOrderByDepartment(multiDeptOrder, 'GT');
    expect(gtFiltered).not.toBeNull();
    expect(gtFiltered?.invoices).toHaveLength(2);
    expect(gtFiltered?.invoices?.[0]?.collection?.contrareciboNumber).toBe('GT-742');
    expect(gtFiltered?.invoices?.[1]?.collection?.contrareciboNumber).toBe('GT-713');
    const totalGt = (gtFiltered?.invoices || []).reduce((sum: number, inv: any) => sum + inv.financials.invoiceTotal, 0);
    expect(totalGt).toBe(123521.60);

    // Test filterOrderByDepartment para ALL
    const allFiltered = filterOrderByDepartment(multiDeptOrder, 'ALL');
    expect(allFiltered?.invoices).toHaveLength(4);
  });

  it('DEFAULT_CONFIG tiene la deuda real con Andrés calibrada a -102670.27', () => {
    expect(DEFAULT_CONFIG.historicalDebtAndres).toBe(-102670.27);
  });

  it('las facturas pueden tener múltiples contrarecibos pero nunca mezclan TH y GT', async () => {
    const { filterOrderByDepartment, invoiceMatchesDepartment } = await import('../finance');

    const orderConMultiplesCRs = {
      id: 'ord-split-crs',
      folio: 'OC-998811',
      client: 'Providencia TH',
      department: 'TH',
      invoices: [
        { id: 'inv-th-part1', kilos: 800, collection: { contrareciboNumber: 'TH-912' }, financials: { invoiceTotal: 40000.00 } },
        { id: 'inv-th-part2', kilos: 800, collection: { contrareciboNumber: 'TH-879' }, financials: { invoiceTotal: 39826.00 } },
      ],
    } as any;

    expect(invoiceMatchesDepartment(orderConMultiplesCRs.invoices[0], orderConMultiplesCRs, 'TH')).toBe(true);
    expect(invoiceMatchesDepartment(orderConMultiplesCRs.invoices[1], orderConMultiplesCRs, 'TH')).toBe(true);
    expect(invoiceMatchesDepartment(orderConMultiplesCRs.invoices[0], orderConMultiplesCRs, 'GT')).toBe(false);
    expect(invoiceMatchesDepartment(orderConMultiplesCRs.invoices[1], orderConMultiplesCRs, 'GT')).toBe(false);

    const thOrder = filterOrderByDepartment(orderConMultiplesCRs, 'TH');
    expect(thOrder?.invoices).toHaveLength(2);

    const gtOrder = filterOrderByDepartment(orderConMultiplesCRs, 'GT');
    expect(gtOrder).toBeNull();
  });
});

