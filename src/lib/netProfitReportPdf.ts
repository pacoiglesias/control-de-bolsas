import { money, fmtDate, fmtDateFull, fmtDateTimeFull, kilos as fmtKilos, toDate } from './format';
import { extractCr, round2 } from './finance';
import type { PurchaseOrder, Expense } from './types';

export interface NetProfitInvoiceBreakdown {
  orderFolio: string;
  invoiceFolio: string;
  contrarecibo: string;
  date?: any;
  kilos: number;
  salePricePerKg: number;
  subtotal: number;
  costAndres: number;
  commission: number;
  netProfit: number;
  profitPerKg: number;
  status: string;
}

export interface NetProfitReportData {
  periodLabel: string;
  totalKilosFacturados: number;
  totalKilosEntregados: number;
  subtotalFacturado: number;
  ivaFacturado: number;
  totalFacturadoConIva: number;
  costoAndresTotal: number;
  comisionContableTotal: number;
  gastosOperativosCaja: number;
  utilidadBruta: number;
  utilidadNetaReal: number;
  repartoPaco: number;
  repartoSocio: number;
  saldoCajaChica: number;
  invoices: NetProfitInvoiceBreakdown[];
  expenses?: Expense[];
  companyName?: string;
}

export async function generateNetProfitReportPdf(data: NetProfitReportData) {
  const html2pdf = (await import('html2pdf.js')).default;
  const fechaHoy = fmtDateFull(new Date());
  const fechaEmisionExacta = fmtDateTimeFull(new Date());
  const company = data.companyName || 'Bolsas Elemental / Providencia';

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px 30px; color: #0f172a; background: #fff; max-width: 820px; margin: 0 auto; font-size: 11px; line-height: 1.4;">
      
      <!-- ENCABEZADO EJECUTIVO CONFIDENCIAL -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f59e0b; padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px; font-weight: 900; color: #78350f; letter-spacing: -0.5px;">${company.toUpperCase()}</span>
            <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">Privado / Socios</span>
          </div>
          <div style="font-size: 12px; color: #475569; font-weight: 800; margin-top: 2px;">REPORTE EJECUTIVO DE UTILIDAD NETA & ESTADO DE RESULTADOS (P&L)</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
            Periodo: <strong>${data.periodLabel}</strong> · Papalotla, Tlaxcala · Fecha: <strong>${fechaHoy}</strong>
          </div>
        </div>

        <div style="text-align: right; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 8px 14px; min-width: 220px;">
          <div style="font-size: 9.5px; font-weight: 800; color: #b45309; text-transform: uppercase;">UTILIDAD NETA LÍQUIDA REAL</div>
          <div style="font-size: 20px; font-weight: 900; color: #047857; margin-top: 1px;">${money(data.utilidadNetaReal)}</div>
          <div style="font-size: 9px; color: #78350f;">Emisión: ${fechaEmisionExacta}</div>
        </div>
      </div>

      <!-- TARJETAS DE LOS 4 PILARES FINANCIEROS -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">1. VENTA FACTURADA (SUBTOTAL)</div>
          <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px;">${money(data.subtotalFacturado)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">${fmtKilos(data.totalKilosFacturados)} facturados</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">2. COSTO PROVEEDOR ANDRÉS ($42/KG)</div>
          <div style="font-size: 15px; font-weight: 900; color: #dc2626; margin-top: 2px;">-${money(data.costoAndresTotal)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">Adquisición de bolsa terminada</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase;">3. COMISIÓN CONTADOR (8%)</div>
          <div style="font-size: 15px; font-weight: 900; color: #d97706; margin-top: 2px;">-${money(data.comisionContableTotal)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">Gestión de cobranza</div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 8px 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #166534; text-transform: uppercase;">4. UTILIDAD NETA LIMPIA</div>
          <div style="font-size: 16px; font-weight: 900; color: #15803d; margin-top: 2px;">${money(data.utilidadNetaReal)}</div>
          <div style="font-size: 8.5px; color: #15803d; font-weight: 700; margin-top: 1px;">Dinero limpio generado</div>
        </div>
      </div>

      <!-- RECUADRO DE REPARTO DE UTILIDADES 50/50 -->
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 18px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 10px; font-weight: 800; color: #334155; text-transform: uppercase;">🤝 REPARTO DE UTILIDADES ENTRE SOCIOS (50% / 50%):</div>
          <div style="display: flex; gap: 24px; margin-top: 6px;">
            <div>
              <div style="font-size: 9.5px; color: #64748b; font-weight: 700;">PARTE PACO (50%):</div>
              <div style="font-size: 16px; font-weight: 900; color: #1e40af; margin-top: 1px;">${money(data.repartoPaco)}</div>
            </div>
            <div style="width: 1px; background: #cbd5e1;"></div>
            <div>
              <div style="font-size: 9.5px; color: #64748b; font-weight: 700;">PARTE SOCIO (50%):</div>
              <div style="font-size: 16px; font-weight: 900; color: #6b21a8; margin-top: 1px;">${money(data.repartoSocio)}</div>
            </div>
          </div>
        </div>

        <div style="text-align: right; border-left: 1px solid #cbd5e1; padding-left: 18px;">
          <div style="font-size: 9.5px; color: #64748b; font-weight: 700;">SALDO DISPONIBLE EN CAJA CHICA:</div>
          <div style="font-size: 16px; font-weight: 900; color: #047857; margin-top: 1px;">${money(data.saldoCajaChica)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">Efectivo en mano</div>
        </div>
      </div>

      <!-- TABLA 1: DESGLOSE ANALÍTICO POR EXPEDIENTE Y FACTURA -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 10.5px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 6px;">
          📊 1. Desglose Analítico de Rendimiento por Orden y Factura:
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
          <thead>
            <tr style="background: #1e293b; color: #fff; text-transform: uppercase; font-size: 8.5px;">
              <th style="padding: 5px 6px; text-align: left; border-radius: 4px 0 0 0;">Factura</th>
              <th style="padding: 5px 6px; text-align: left;">OC</th>
              <th style="padding: 5px 6px; text-align: left;">CR</th>
              <th style="padding: 5px 6px; text-align: right;">Kilos</th>
              <th style="padding: 5px 6px; text-align: right;">P. Venta</th>
              <th style="padding: 5px 6px; text-align: right;">Subtotal Venta</th>
              <th style="padding: 5px 6px; text-align: right;">Costo Andrés ($42)</th>
              <th style="padding: 5px 6px; text-align: right;">Comisión (8%)</th>
              <th style="padding: 5px 6px; text-align: right; border-radius: 0 4px 0 0;">Utilidad Neta</th>
            </tr>
          </thead>
          <tbody>
            ${data.invoices.map((inv, idx) => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 4px 6px; font-weight: 800; font-family: monospace; color: #0f172a;">${inv.invoiceFolio}</td>
                <td style="padding: 4px 6px; font-family: monospace; color: #475569;">${inv.orderFolio}</td>
                <td style="padding: 4px 6px; font-weight: 700; color: #2563eb;">${inv.contrarecibo || 'Sin CR'}</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace;">${inv.kilos.toLocaleString('es-MX')} kg</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace;">$${inv.salePricePerKg.toFixed(2)}</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 600;">${money(inv.subtotal)}</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #dc2626;">-${money(inv.costAndres)}</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #d97706;">-${money(inv.commission)}</td>
                <td style="padding: 4px 6px; text-align: right; font-family: monospace; font-weight: 800; color: #16a34a;">
                  ${money(inv.netProfit)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${data.expenses && data.expenses.length > 0 ? `
        <!-- TABLA 2: EGRESOS OPERATIVOS DE CAJA CHICA -->
        <div style="margin-bottom: 18px;">
          <div style="font-size: 10.5px; font-weight: 800; color: #334155; text-transform: uppercase; margin-bottom: 6px;">
            🧾 2. Deducción de Gastos Operativos de Caja Chica:
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="background: #475569; color: #fff; text-transform: uppercase; font-size: 8.5px;">
                <th style="padding: 5px 6px; text-align: left; border-radius: 4px 0 0 0;">Fecha</th>
                <th style="padding: 5px 6px; text-align: left;">Concepto / Detalle</th>
                <th style="padding: 5px 6px; text-align: right; border-radius: 0 4px 0 0;">Monto Deducido</th>
              </tr>
            </thead>
            <tbody>
              ${data.expenses.map((exp, idx) => `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                  <td style="padding: 4px 6px; color: #475569;">${fmtDate(exp.date || exp.createdAt)}</td>
                  <td style="padding: 4px 6px; font-weight: 600; color: #0f172a;">${exp.concept}</td>
                  <td style="padding: 4px 6px; text-align: right; font-family: monospace; color: #dc2626; font-weight: 700;">
                    -${money(exp.amount)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- RECUADRO DE FIRMAS Y CONFORMIDAD DE SOCIOS -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 26px; padding-top: 8px;">
        <div style="text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">PACO (ADMINISTRACIÓN / OPERACIÓN)</div>
          <div style="font-size: 9.5px; color: #64748b;">Firma de conformidad de liquidación (50%)</div>
        </div>

        <div style="text-align: center; border-top: 1px solid #94a3b8; padding-top: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">SOCIO CAPITALISTA / INVERSIONISTA</div>
          <div style="font-size: 9.5px; color: #64748b;">Firma de conformidad de liquidación (50%)</div>
        </div>
      </div>

    </div>
  `;

  const filename = `Reporte_Utilidad_Neta_PL_${new Date().toISOString().slice(0, 10)}.pdf`;
  const opt: any = {
    margin: [6, 6, 6, 6],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  await html2pdf().set(opt).from(html).save();
}

export function buildNetProfitData(
  orders: PurchaseOrder[],
  expenses: Expense[] = [],
  config: any,
  saldoCaja: number = 0,
  periodLabel: string = 'Histórico Global'
): NetProfitReportData {
  let subtotalFacturado = 0;
  let totalKilosEntregados = 0;
  let totalKilosFacturados = 0;
  let costoAndresTotal = 0;
  let comisionContableTotal = 0;
  const breakdownList: NetProfitInvoiceBreakdown[] = [];

  (orders || []).forEach((o) => {
    if (!o || o.isClosedShort) return;

    (o.deliveries || []).forEach((d) => {
      totalKilosEntregados += Number(d.kilos) || 0;
    });

    (o.invoices || []).forEach((inv) => {
      if (!inv) return;
      const kg = Number(inv.kilos) || 0;
      totalKilosFacturados += kg;

      const effectiveSalePrice = inv.financials?.salePricePerKg ?? (Number(o.customSellPrice) || config?.salePricePerKg || 43);
      const invSubtotal = (inv.financials as any)?.subtotal ?? inv.financials?.saleTotal ?? round2(kg * effectiveSalePrice);
      subtotalFacturado += invSubtotal;

      const effectiveCostPrice = inv.financials?.costPricePerKg ?? (Number(o.customCostPrice) || config?.costPricePerKg || 38);
      const invCost = inv.financials?.costTotal ?? round2(kg * effectiveCostPrice);
      costoAndresTotal += invCost;

      const effectiveCommRate = inv.financials?.commissionRate ?? (Number(o.customCommissionRate) ? Number(o.customCommissionRate) / 100 : (config?.commissionRate || 0.08));
      const invComm = inv.financials?.commission ?? round2(invSubtotal * effectiveCommRate);
      comisionContableTotal += invComm;

      const invProfit = round2(invSubtotal - invCost - invComm);
      const profitPerKg = kg > 0 ? round2(invProfit / kg) : 0;

      breakdownList.push({
        orderFolio: o.folio || o.oc || 'S/N',
        invoiceFolio: inv.folio || o.folio || 'S/N',
        contrarecibo: extractCr(inv, o),
        date: toDate(inv.creditCycle?.issueDate) || toDate(o.processedAt),
        kilos: kg,
        salePricePerKg: effectiveSalePrice,
        subtotal: invSubtotal,
        costAndres: invCost,
        commission: invComm,
        netProfit: invProfit,
        profitPerKg,
        status: inv.creditCycle?.status || 'pedido',
      });
    });
  });

  const gastosOperativos = (expenses || [])
    .filter((e) => e && e.type === 'egreso' && !e.concept?.toLowerCase().includes('andres'))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const costoAndres = round2(costoAndresTotal);
  const comisionContable = round2(comisionContableTotal);
  const subtotal = round2(subtotalFacturado);
  const utilidadBruta = round2(subtotal - costoAndres);
  const utilidadNetaReal = round2(subtotal - costoAndres - comisionContable - gastosOperativos);
  const repartoPaco = round2(utilidadNetaReal / 2);
  const repartoSocio = round2(utilidadNetaReal / 2);

  return {
    periodLabel,
    totalKilosFacturados: round2(totalKilosFacturados),
    totalKilosEntregados: round2(totalKilosEntregados),
    subtotalFacturado: subtotal,
    ivaFacturado: round2(subtotal * 1.16 - subtotal),
    totalFacturadoConIva: round2(subtotal * 1.16),
    costoAndresTotal: costoAndres,
    comisionContableTotal: comisionContable,
    gastosOperativosCaja: round2(gastosOperativos),
    utilidadBruta,
    utilidadNetaReal,
    repartoPaco,
    repartoSocio,
    saldoCajaChica: round2(saldoCaja),
    invoices: breakdownList,
    expenses: expenses.filter((e) => e.type === 'egreso' && !e.concept?.toLowerCase().includes('andres')).slice(0, 10),
    companyName: config?.companyName || 'Bolsas Elemental / Providencia',
  };
}
