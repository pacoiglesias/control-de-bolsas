import * as XLSX from 'xlsx';
import { round2, extractCr, getOrderSummary, inferDepartment } from './finance';
import { toDate, fmtDate } from './format';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from './types';

export interface MasterExcelExportParams {
  orders: PurchaseOrder[];
  purchases: Purchase[];
  expenses: Expense[];
  config?: FinancialConfig;
  settings?: any;
}

/**
 * Genera un Libro Maestro de Excel (.xlsx) con 5 hojas consolidadas y formateadas profesionalmente:
 * 1. Resumen Ejecutivo & P&L
 * 2. Expedientes y Entregas
 * 3. Facturas y Cobranza
 * 4. Cuenta Corriente Andrés
 * 5. Caja Chica y Tesorería
 */
export function buildMasterExcelWorkbook({
  orders,
  purchases,
  expenses,
  config,
  settings,
}: MasterExcelExportParams): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const saleKg = config?.salePricePerKg || 43;
  const costKg = config?.costPricePerKg || 38;
  const provName = settings?.providerName || 'Andrés';

  // ─────────────────────────────────────────────────────────────────
  // HOJA 1: RESUMEN EJECUTIVO & P&L
  // ─────────────────────────────────────────────────────────────────
  let totalKilosPedidos = 0;
  let totalKilosEntregados = 0;
  let totalKilosFacturados = 0;
  let totalVentasConIva = 0;
  let totalCobrado = 0;
  let totalPorCobrar = 0;

  orders.forEach((o) => {
    if (!o || (o as any).isDeleted) return;
    const s = getOrderSummary(o);
    totalKilosPedidos += Number(o.totalKilograms) || s.kilosDelivered || 0;
    totalKilosEntregados += s.kilosDelivered;
    totalKilosFacturados += s.kilosInvoiced;
    totalVentasConIva += s.invoiceTotal;
    totalCobrado += s.paidAmount;
    totalPorCobrar += Math.max(0, s.invoiceTotal - s.paidAmount);
  });

  const saldoCaja = round2(
    (expenses || []).reduce((acc, e) => {
      if (!e) return acc;
      return acc + (e.type === 'ingreso' ? Number(e.amount) || 0 : -(Number(e.amount) || 0));
    }, 0)
  );

  const resumenData: any[][] = [
    ['CONTROL DE BOLSAS ERP — BASE DE DATOS MAESTRA CONSOLIDADA'],
    [`Generado el: ${new Date().toLocaleString('es-MX')} · Proveedor: ${provName} · Cliente: Grupo Textil Providencia`],
    [],
    ['📊 PILARES FINANCIEROS Y TESORERÍA'],
    ['Indicador Clave', 'Valor Numérico', 'Unidad / Observación'],
    ['Efectivo en Caja Chica', saldoCaja, 'Disponible en tesorería'],
    ['Cartera Total Por Cobrar', totalPorCobrar, 'Facturas y Contrarecibos vigentes con IVA'],
    ['Total Cobrado Acumulado', totalCobrado, 'Liquidado por Providencia'],
    ['Total Facturación Emitida', totalVentasConIva, 'Suma de facturas timbradas'],
    ['Kilos Totales en Expedientes', totalKilosPedidos, 'Kilogramos autorizados en OCs'],
    ['Kilos Entregados en Planta', totalKilosEntregados, 'Kilogramos pesados en báscula'],
    ['Kilos Pendientes de Facturar', Math.max(0, totalKilosEntregados - totalKilosFacturados), 'En patio listos para CFDI 4.0'],
    [],
    ['💵 PARÁMETROS Y MÁRGENES DE OPERACIÓN'],
    ['Concepto', 'Monto Oficial', 'Fórmula de Negocio'],
    ['Precio de Venta a Providencia', saleKg, `$${saleKg.toFixed(2)} + 16% IVA = $${(saleKg * 1.16).toFixed(2)}/kg`],
    ['Costo de Compra a Andrés', costKg, `$${costKg.toFixed(2)}/kg neto (Cero mermas)`],
    ['Margen Bruto de Operación', saleKg - costKg, `$${(saleKg - costKg).toFixed(2)}/kg bruto`],
    ['Comisión Retención Contador', round2(saleKg * 0.08), `8% sobre subtotal = $${(saleKg * 0.08).toFixed(2)}/kg`],
    ['Flujo Neto Efectivo a Caja', round2(saleKg * 1.16 - costKg - saleKg * 0.08), `$8.44 por cada kilogramo entregado`],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  wsResumen['!cols'] = [{ wch: 36 }, { wch: 24 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, '📊 Resumen & P&L');

  // ─────────────────────────────────────────────────────────────────
  // HOJA 2: EXPEDIENTES Y ENTREGAS DE BÁSCULA
  // ─────────────────────────────────────────────────────────────────
  const expedientesHeaders = [
    'ID_Expediente',
    'Folio_OC',
    'Cliente',
    'Departamento',
    'Kilos_Pedidos',
    'Kilos_Entregados',
    'Kilos_Faltantes',
    'Kilos_Facturados',
    'Subtotal_Venta',
    'Total_con_IVA',
    'Estatus_General',
    'Fecha_Registro',
    'Notas'
  ];

  const expedientesRows: any[][] = [];
  orders.forEach((o) => {
    if (!o || (o as any).isDeleted) return;
    const s = getOrderSummary(o);
    const ped = Number(o.totalKilograms) || s.kilosDelivered || 0;
    const falt = o.isClosedShort ? 0 : Math.max(0, ped - s.kilosDelivered);
    const crDate = toDate(o.processedAt || (o as any).createdAt);

    expedientesRows.push([
      o.id,
      o.oc || o.folio || 'S/F',
      o.client || 'Providencia',
      inferDepartment(o) || o.department || 'TH',
      round2(ped),
      round2(s.kilosDelivered),
      round2(falt),
      round2(s.kilosInvoiced),
      round2(s.saleTotal),
      round2(s.invoiceTotal),
      s.status,
      crDate ? fmtDate(crDate) : '',
      (o as any).notes || ''
    ]);
  });

  const wsExpedientes = XLSX.utils.aoa_to_sheet([expedientesHeaders, ...expedientesRows]);
  wsExpedientes['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 35 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(wb, wsExpedientes, '📦 Expedientes');

  // ─────────────────────────────────────────────────────────────────
  // HOJA 3: FACTURAS & COBRANZA (CONTRARECIBOS)
  // ─────────────────────────────────────────────────────────────────
  const facturasHeaders = [
    'ID_Expediente',
    'ID_Factura',
    'OC_Referencia',
    'Cliente',
    'Planta',
    'Folio_Factura',
    'UUID_Fiscal',
    'Kilos_Amparados',
    'Subtotal',
    'IVA_16',
    'Total_Factura',
    'Contrarecibo_CR',
    'Estatus_Cobro',
    'Fecha_Emision',
    'Fecha_Vencimiento_30d',
    'Monto_Pagado',
    'Saldo_Insoluto'
  ];

  const facturasRows: any[][] = [];
  orders.forEach((o) => {
    if (!o || (o as any).isDeleted) return;
    (o.invoices || []).forEach((inv) => {
      if (!inv) return;
      const cr = extractCr(inv, o);
      const sub = round2(inv.financials?.saleTotal ?? (Number(inv.kilos || 0) * saleKg));
      const tot = round2(inv.financials?.invoiceTotal ?? (sub * 1.16));
      const iva = round2(tot - sub);
      const paid = round2(inv.collection?.paidAmount || (inv.creditCycle?.status === 'collected' ? tot : 0));
      const saldo = round2(Math.max(0, tot - paid));
      const issueD = toDate(inv.creditCycle?.issueDate);
      const dueD = toDate(inv.creditCycle?.dueDate);

      facturasRows.push([
        o.id,
        inv.id || '',
        o.oc || o.folio || 'S/F',
        o.client || 'Providencia',
        inferDepartment(o, inv) || 'TH',
        inv.folio || 'S/F',
        inv.uuid || '',
        round2(Number(inv.kilos) || 0),
        sub,
        iva,
        tot,
        cr || 'Sin CR',
        inv.creditCycle?.status || 'pending',
        issueD ? fmtDate(issueD) : '',
        dueD ? fmtDate(dueD) : '',
        paid,
        saldo
      ]);
    });
  });

  const wsFacturas = XLSX.utils.aoa_to_sheet([facturasHeaders, ...facturasRows]);
  wsFacturas['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 32 }, { wch: 10 },
    { wch: 16 }, { wch: 38 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsFacturas, '🧾 Facturación & CR');

  // ─────────────────────────────────────────────────────────────────
  // HOJA 4: CUENTA CORRIENTE ANDRÉS (COMPRAS & ANTICIPOS)
  // ─────────────────────────────────────────────────────────────────
  const comprasHeaders = [
    'ID_Compra',
    'Proveedor',
    'OC_Asociada',
    'Kilos_Esperados',
    'Kilos_Recibidos',
    'Costo_Unitario_kg',
    'Total_Costo',
    'Estatus',
    'Fecha',
    'Notas'
  ];

  const comprasRows: any[][] = [];
  (purchases || []).forEach((p) => {
    if (!p) return;
    const pDate = toDate(p.date || (p as any).createdAt);
    comprasRows.push([
      p.id || '',
      p.provider || provName,
      (p as any).orderId || (p as any).ocFolio || 'General',
      round2(Number(p.expectedKilos) || 0),
      round2(Number(p.receivedKilos) || 0),
      round2(Number(p.pricePerKg) || costKg),
      round2(Number(p.totalAmount) || ((Number(p.receivedKilos) || 0) * costKg)),
      p.status || 'pedido',
      pDate ? fmtDate(pDate) : '',
      p.notes || ''
    ]);
  });

  const wsCompras = XLSX.utils.aoa_to_sheet([comprasHeaders, ...comprasRows]);
  wsCompras['!cols'] = [
    { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCompras, `⚖️ Cuenta ${provName}`);

  // ─────────────────────────────────────────────────────────────────
  // HOJA 5: CAJA CHICA & TESORERÍA
  // ─────────────────────────────────────────────────────────────────
  const cajaHeaders = [
    'ID_Movimiento',
    'Fecha',
    'Tipo',
    'Proveedor_Receptor',
    'Concepto_Detallado',
    'Ingreso',
    'Egreso',
    'Notas'
  ];

  const cajaRows: any[][] = [];
  (expenses || []).forEach((e) => {
    if (!e) return;
    const eDate = toDate(e.date || (e as any).createdAt);
    const isIngreso = e.type === 'ingreso';
    cajaRows.push([
      e.id || '',
      eDate ? fmtDate(eDate) : '',
      e.type ? e.type.toUpperCase() : 'EGRESO',
      e.provider || '—',
      e.concept || 'Movimiento de Caja',
      isIngreso ? round2(Number(e.amount) || 0) : 0,
      !isIngreso ? round2(Number(e.amount) || 0) : 0,
      e.notes || ''
    ]);
  });

  const wsCaja = XLSX.utils.aoa_to_sheet([cajaHeaders, ...cajaRows]);
  wsCaja['!cols'] = [
    { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 24 },
    { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCaja, '💵 Caja Chica');

  return wb;
}

/**
 * Descarga directamente el Libro Maestro de Excel al dispositivo del usuario.
 */
export function downloadMasterExcelWorkbook(params: MasterExcelExportParams, customFileName?: string) {
  const wb = buildMasterExcelWorkbook(params);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = customFileName || `ERP_Bolsas_Providencia_Master_Database_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
