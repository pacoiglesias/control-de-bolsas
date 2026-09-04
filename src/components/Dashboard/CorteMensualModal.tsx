import { useState, useMemo } from 'react';
import { Modal } from '../ui';
import { money, fmtDate, getPrintHeaderHtml, shareHtmlAsPdf, escapeHtml, toDate } from '../../lib/format';
import { round2 } from '../../lib/finance';
import type { PurchaseOrder, Expense, FinancialConfig } from '../../lib/types';
import type { SystemSettings } from '../../hooks/useSystemSettings';
import * as XLSX from 'xlsx';
import { useToast } from '../../context/ToastContext';

interface CorteMensualModalProps {
  onClose: () => void;
  orders: PurchaseOrder[];
  expenses: Expense[];
  purchases?: any[];
  config: FinancialConfig;
  settings: SystemSettings;
}

export function CorteMensualModal({
  onClose,
  orders,
  expenses,
  config,
  settings,
}: CorteMensualModalProps) {
  const toast = useToast();
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const [year, month] = useMemo(() => {
    const parts = selectedMonth.split('-');
    return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
  }, [selectedMonth]);

  const monthName = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }, [year, month]);

  // Filtrado de datos por el mes seleccionado
  const dataMes = useMemo(() => {
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Facturas cobradas en el mes
    const facturasCobradas: {
      folio: string;
      orderFolio: string;
      client: string;
      cr: string;
      kilos: number;
      montoTotal: number;
      subtotal: number;
      iva: number;
      fechaCobro: Date;
    }[] = [];

    // 2. Facturas emitidas en el mes
    let kilosEmitidosMes = 0;
    let facturacionEmitidaMes = 0;

    orders.forEach((o) => {
      (o.invoices || []).forEach((inv) => {
        const dIssue = toDate(inv.creditCycle?.issueDate);
        if (dIssue && dIssue >= startOfMonth && dIssue <= endOfMonth) {
          const invTot = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * (config.salePricePerKg || 43) * 1.16);
          kilosEmitidosMes += inv.kilos || 0;
          facturacionEmitidaMes += invTot;
        }

        const dPaid = toDate(inv.collection?.paidAt) || toDate(inv.collection?.collectedAt);
        const st = inv.creditCycle?.status;
        if ((st === 'paid' || st === 'collected') && dPaid && dPaid >= startOfMonth && dPaid <= endOfMonth) {
          const k = inv.kilos || 0;
          const montoTotal = inv.financials?.invoiceTotal ?? (k * (config.salePricePerKg || 43) * 1.16);
          const subtotal = round2(montoTotal / 1.16);
          const iva = round2(montoTotal - subtotal);
          facturasCobradas.push({
            folio: inv.folio || '—',
            orderFolio: o.folio || o.oc || '—',
            client: o.client || 'Providencia',
            cr: inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '—',
            kilos: k,
            montoTotal,
            subtotal,
            iva,
            fechaCobro: dPaid,
          });
        }
      });
    });

    // 3. Pagos y entregas a Andrés
    const pagosAndres: Expense[] = [];
    const egresosOperativos: Expense[] = [];
    const ingresosCaja: Expense[] = [];

    expenses.forEach((e) => {
      const d = toDate(e.date) || toDate(e.createdAt);
      if (d && d >= startOfMonth && d <= endOfMonth) {
        if (e.type === 'egreso') {
          const prov = (e.provider || '').toLowerCase();
          const conc = (e.concept || '').toLowerCase();
          if (prov.includes('andres') || prov.includes('andrés') || conc.includes('andres') || conc.includes('andrés')) {
            pagosAndres.push(e);
          } else {
            egresosOperativos.push(e);
          }
        } else if (e.type === 'ingreso') {
          ingresosCaja.push(e);
        }
      }
    });

    const totalCobrado = facturasCobradas.reduce((a, f) => a + f.montoTotal, 0);
    const totalPagadoAndres = pagosAndres.reduce((a, e) => a + e.amount, 0);
    const totalEgresosOperativos = egresosOperativos.reduce((a, e) => a + e.amount, 0);
    const totalKilosCobrados = facturasCobradas.reduce((a, f) => a + f.kilos, 0);
    const costoAndresDeKilosCobrados = round2(totalKilosCobrados * (config.costPricePerKg || 38));
    const gananciaNetaPeriodo = round2(totalCobrado - costoAndresDeKilosCobrados - totalEgresosOperativos);

    return {
      facturasCobradas,
      pagosAndres,
      egresosOperativos,
      ingresosCaja,
      totalCobrado: round2(totalCobrado),
      totalPagadoAndres: round2(totalPagadoAndres),
      totalEgresosOperativos: round2(totalEgresosOperativos),
      totalKilosCobrados: round2(totalKilosCobrados),
      costoAndresDeKilosCobrados,
      gananciaNetaPeriodo,
      kilosEmitidosMes: round2(kilosEmitidosMes),
      facturacionEmitidaMes: round2(facturacionEmitidaMes),
    };
  }, [orders, expenses, year, month, config]);

  function getReporteHtml() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Corte Mensual Contable - ${escapeHtml(monthName.toUpperCase())}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 24px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: monospace; font-size: 12px; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 20px 0 28px; }
            .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
            .kpi-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-val { font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; text-align: center; }
            .sig-box { border-top: 2px solid #64748b; padding-top: 10px; font-weight: 600; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, `Corte Mensual de Operaciones y Cobranza — ${monthName.toUpperCase()}`)}

          <div class="kpis">
            <div class="kpi">
              <div class="kpi-title">Total Cobrado Providencia</div>
              <div class="kpi-val" style="color: #059669;">${money(dataMes.totalCobrado)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Kilos Cobrados</div>
              <div class="kpi-val">${dataMes.totalKilosCobrados.toLocaleString('es-MX')} kg</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Costo Andrés ($42/kg)</div>
              <div class="kpi-val" style="color: #b45309;">${money(dataMes.costoAndresDeKilosCobrados)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Utilidad Neta Real</div>
              <div class="kpi-val" style="color: #047857;">${money(dataMes.gananciaNetaPeriodo)}</div>
            </div>
          </div>

          <h3>1. Facturas Cobradas y Liquidadas (${dataMes.facturasCobradas.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>OC / Cliente</th>
                <th>Contrarecibo</th>
                <th>Fecha Cobro</th>
                <th class="num">Kilos</th>
                <th class="num">Subtotal</th>
                <th class="num">IVA 16%</th>
                <th class="num">Total Cobrado</th>
              </tr>
            </thead>
            <tbody>
              ${dataMes.facturasCobradas.length > 0 ? dataMes.facturasCobradas.map(f => `
                <tr>
                  <td><strong>#${escapeHtml(f.folio)}</strong></td>
                  <td>${escapeHtml(f.orderFolio)} (${escapeHtml(f.client)})</td>
                  <td>${escapeHtml(f.cr)}</td>
                  <td>${fmtDate(f.fechaCobro)}</td>
                  <td class="num">${f.kilos.toLocaleString('es-MX')} kg</td>
                  <td class="num">${money(f.subtotal)}</td>
                  <td class="num">${money(f.iva)}</td>
                  <td class="num" style="font-weight: bold; color: #059669;">${money(f.montoTotal)}</td>
                </tr>
              `).join('') : `<tr><td colspan="8" style="text-align: center; padding: 16px;">No hay facturas cobradas registradas en este mes</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f1f5f9;">
                <td colspan="4">TOTALES DEL MES</td>
                <td class="num">${dataMes.totalKilosCobrados.toLocaleString('es-MX')} kg</td>
                <td class="num">${money(dataMes.facturasCobradas.reduce((a, f) => a + f.subtotal, 0))}</td>
                <td class="num">${money(dataMes.facturasCobradas.reduce((a, f) => a + f.iva, 0))}</td>
                <td class="num" style="color: #059669;">${money(dataMes.totalCobrado)}</td>
              </tr>
            </tfoot>
          </table>

          <h3>2. Transferencias / Pagos Realizados a Andrés (${dataMes.pagosAndres.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto / Referencia</th>
                <th class="num">Importe Pagado</th>
              </tr>
            </thead>
            <tbody>
              ${dataMes.pagosAndres.length > 0 ? dataMes.pagosAndres.map(p => `
                <tr>
                  <td>${fmtDate(p.date || p.createdAt)}</td>
                  <td>${escapeHtml(p.concept || 'Pago a Andrés')}</td>
                  <td class="num" style="font-weight: bold; color: #b45309;">${money(p.amount)}</td>
                </tr>
              `).join('') : `<tr><td colspan="3" style="text-align: center; padding: 16px;">No hay pagos registrados a Andrés en este mes</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #f1f5f9;">
                <td colspan="2">TOTAL PAGADO A ANDRÉS EN EL MES</td>
                <td class="num" style="color: #b45309;">${money(dataMes.totalPagadoAndres)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="signatures">
            <div class="sig-box">Elaboró: Dirección Administrativa</div>
            <div class="sig-box">Recibió: Despacho Contable / Auditoría</div>
          </div>

          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
  }

  function handlePrintPdf() {
    const html = getReporteHtml();
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  async function handleSharePdf() {
    const html = getReporteHtml();
    toast('Generando PDF oficial del mes...', 'ok');
    await shareHtmlAsPdf(html, `Corte_Mensual_${selectedMonth}.pdf`);
  }

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // 1. Resumen
    const wsResumenData = [
      ['CORTE MENSUAL EJECUTIVO', monthName.toUpperCase()],
      ['Fecha de Emisión', new Date().toLocaleDateString('es-MX')],
      [],
      ['INDICADOR', 'MONTO'],
      ['Total Facturado Emitido en el Mes', dataMes.facturacionEmitidaMes],
      ['Total Kilos Emitidos en el Mes', dataMes.kilosEmitidosMes],
      ['Total Cobranza Recibida de Providencia', dataMes.totalCobrado],
      ['Kilos Cobrados en el Mes', dataMes.totalKilosCobrados],
      ['Costo Directo Andrés ($42/kg s/ kilos cobrados)', dataMes.costoAndresDeKilosCobrados],
      ['Total Pagos / Anticipos Transferidos a Andrés', dataMes.totalPagadoAndres],
      ['Otros Egresos Operativos de Caja', dataMes.totalEgresosOperativos],
      ['UTILIDAD NETA REAL DEL MES', dataMes.gananciaNetaPeriodo],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(wsResumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen_Ejecutivo');

    // 2. Facturas Cobradas
    const wsFacturasData = [
      ['Factura', 'OC Referencia', 'Cliente', 'Contrarecibo', 'Fecha Cobro', 'Kilos', 'Subtotal', 'IVA 16%', 'Total'],
      ...dataMes.facturasCobradas.map(f => [
        f.folio,
        f.orderFolio,
        f.client,
        f.cr,
        fmtDate(f.fechaCobro),
        f.kilos,
        f.subtotal,
        f.iva,
        f.montoTotal,
      ]),
    ];
    const wsFacturas = XLSX.utils.aoa_to_sheet(wsFacturasData);
    XLSX.utils.book_append_sheet(wb, wsFacturas, 'Facturas_Cobradas');

    // 3. Pagos a Andrés
    const wsPagosData = [
      ['Fecha', 'Concepto', 'Proveedor', 'Importe'],
      ...dataMes.pagosAndres.map(p => [
        fmtDate(p.date || p.createdAt),
        p.concept,
        p.provider || 'Andrés',
        p.amount,
      ]),
    ];
    const wsPagos = XLSX.utils.aoa_to_sheet(wsPagosData);
    XLSX.utils.book_append_sheet(wb, wsPagos, 'Pagos_Andres');

    XLSX.writeFile(wb, `Corte_Mensual_Contable_${selectedMonth}.xlsx`);
    toast('📥 Archivo Excel descargado con éxito', 'ok');
  }

  return (
    <Modal title="📑 Corte Mensual para Contabilidad y Dirección" onClose={onClose} wide>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>
              Periodo de Corte: <strong style={{ color: 'var(--accent-deep)', textTransform: 'capitalize' }}>{monthName}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              Resumen fiscal y comercial listo para enviar a tu contador o archivar en tu balance mensual.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Seleccionar Mes:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input boxed"
              style={{ width: 170, fontSize: 13 }}
            />
          </div>
        </div>

        {/* Tarjetas KPI del Mes */}
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Cobrado Providencia</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ok)', fontFamily: 'monospace', marginTop: 4 }}>
              {money(dataMes.totalCobrado)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              {dataMes.facturasCobradas.length} facturas liquidadas
            </div>
          </div>

          <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Kilos Cobrados</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontFamily: 'monospace', marginTop: 4 }}>
              {dataMes.totalKilosCobrados.toLocaleString('es-MX')} kg
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              Entregas de Andrés
            </div>
          </div>

          <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Costo Andrés ($42/kg)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bad)', fontFamily: 'monospace', marginTop: 4 }}>
              {money(dataMes.costoAndresDeKilosCobrados)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              Costo de material cobrado
            </div>
          </div>

          <div style={{ background: 'var(--paper-sunk)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Utilidad Neta Real</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: dataMes.gananciaNetaPeriodo >= 0 ? 'var(--ok)' : 'var(--bad)', fontFamily: 'monospace', marginTop: 4 }}>
              {money(dataMes.gananciaNetaPeriodo)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600, marginTop: 2 }}>
              En tu bolsa
            </div>
          </div>
        </div>

        {/* Acciones de Exportación */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{ background: '#059669', color: '#fff', borderColor: '#059669', fontWeight: 700, fontSize: 13 }}
            onClick={handleExportExcel}
          >
            📊 Exportar Excel (.xlsx)
          </button>
          <button
            className="btn"
            style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 700, fontSize: 13 }}
            onClick={handleSharePdf}
          >
            📤 Compartir PDF
          </button>
          <button
            className="btn btn-primary"
            style={{ fontWeight: 700, fontSize: 13 }}
            onClick={handlePrintPdf}
          >
            🖨️ Imprimir Reporte Oficial
          </button>
        </div>

        {/* Tabla Previa de Facturas Cobradas */}
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--ink)' }}>
          📋 Detalle de Facturas Cobradas en el Periodo ({dataMes.facturasCobradas.length})
        </div>
        <div className="table-scroll" style={{ maxHeight: '35vh' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th>Factura</th>
                <th>OC / Cliente</th>
                <th>Contrarecibo</th>
                <th>Fecha Cobro</th>
                <th className="num">Kilos</th>
                <th className="num">Subtotal</th>
                <th className="num">IVA 16%</th>
                <th className="num">Total Cobrado</th>
              </tr>
            </thead>
            <tbody>
              {dataMes.facturasCobradas.map((f, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>#{f.folio}</td>
                  <td>{f.orderFolio} ({f.client})</td>
                  <td style={{ fontFamily: 'monospace' }}>{f.cr}</td>
                  <td>{fmtDate(f.fechaCobro)}</td>
                  <td className="num">{f.kilos.toLocaleString('es-MX')} kg</td>
                  <td className="num">{money(f.subtotal)}</td>
                  <td className="num">{money(f.iva)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--ok)' }}>{money(f.montoTotal)}</td>
                </tr>
              ))}
              {dataMes.facturasCobradas.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                    No hay facturas con fecha de cobro en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
