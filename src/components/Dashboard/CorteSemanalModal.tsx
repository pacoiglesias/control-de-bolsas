import { useState, useMemo } from 'react';
import { Modal } from '../ui';
import { money, fmtDate, fmtDayAndDate, getPrintHeaderHtml, shareHtmlAsPdf, escapeHtml, toDate } from '../../lib/format';
import { round2 } from '../../lib/finance';
import type { PurchaseOrder, Expense, FinancialConfig, Purchase } from '../../lib/types';
import type { SystemSettings } from '../../hooks/useSystemSettings';
import * as XLSX from 'xlsx';
import { useToast } from '../../context/ToastContext';

interface CorteSemanalModalProps {
  onClose: () => void;
  orders: PurchaseOrder[];
  expenses: Expense[];
  purchases: Purchase[];
  config: FinancialConfig;
  settings: SystemSettings;
}

export function CorteSemanalModal({
  onClose,
  orders,
  expenses,
  purchases,
  config,
  settings,
}: CorteSemanalModalProps) {
  const toast = useToast();

  // Offset en semanas: 0 = Esta semana, -1 = Semana pasada, -2 = Hace 2 semanas, etc.
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Calcular el rango de lunes a domingo para la semana seleccionada
  const { startOfWeek, endOfWeek, weekLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Obtener el lunes de la semana actual (día 1 en JS considerando lunes como inicio)
    const day = today.getDay(); // 0 = domingo, 1 = lunes...
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const label = `${fmtDayAndDate(monday)} al ${fmtDayAndDate(sunday)}`;
    return { startOfWeek: monday, endOfWeek: sunday, weekLabel: label };
  }, [weekOffset]);

  // Recopilar todas las actividades de esa semana
  const semanaData = useMemo(() => {
    // 1. Facturas Cobradas en la semana
    const cobros: {
      folio: string;
      orderFolio: string;
      client: string;
      cr: string;
      kilos: number;
      montoTotal: number;
      netoCaja: number;
      comision: number;
      fecha: Date;
    }[] = [];

    orders.forEach((o) => {
      (o.invoices || []).forEach((inv) => {
        const dPaid = toDate(inv.collection?.paidAt) || toDate(inv.collection?.collectedAt);
        const st = inv.creditCycle?.status;
        if ((st === 'paid' || st === 'collected') && dPaid && dPaid >= startOfWeek && dPaid <= endOfWeek) {
          const k = inv.kilos || 0;
          const montoTotal = inv.financials?.invoiceTotal ?? (k * (config.salePricePerKg || 43) * 1.16);
          const comision = inv.financials?.commission ?? ((montoTotal / 1.16) * (config.commissionRate || 0.08));
          const netoCaja = montoTotal - comision;

          cobros.push({
            folio: inv.folio || '—',
            orderFolio: o.folio || o.oc || '—',
            client: o.client || 'Providencia',
            cr: inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '—',
            kilos: k,
            montoTotal: round2(montoTotal),
            netoCaja: round2(netoCaja),
            comision: round2(comision),
            fecha: dPaid,
          });
        }
      });
    });

    // 2. Entregas / Producción en Báscula de Andrés en la semana
    const entregas: {
      folioOC: string;
      client: string;
      kilos: number;
      costoMaquila: number;
      docType?: string;
      docFolio?: string;
      fecha: Date;
    }[] = [];

    orders.forEach((o) => {
      (o.deliveries || []).forEach((d) => {
        const dDate = toDate(d.date);
        if (dDate && dDate >= startOfWeek && dDate <= endOfWeek) {
          const k = d.kilos || 0;
          const costo = k * (config.costPricePerKg || 38);
          entregas.push({
            folioOC: o.oc || o.folio || '—',
            client: o.client || 'Providencia',
            kilos: k,
            costoMaquila: round2(costo),
            docType: d.docType,
            docFolio: d.docFolio,
            fecha: dDate,
          });
        }
      });
    });

    // 3. Compras registradas en la semana
    const comprasSemana = (purchases || []).filter((p) => {
      const d = toDate(p.date);
      return d && d >= startOfWeek && d <= endOfWeek;
    });

    // 4. Movimientos de Caja Chica (Egresos e Ingresos)
    const egresosAndres: Expense[] = [];
    const gastosOperativos: Expense[] = [];
    const ingresosCaja: Expense[] = [];

    (expenses || []).forEach((e) => {
      const d = toDate(e.date);
      if (d && d >= startOfWeek && d <= endOfWeek) {
        if (e.type === 'ingreso') {
          ingresosCaja.push(e);
        } else {
          const prov = (e.provider || '').toLowerCase().trim();
          if (prov === 'andres' || (e.concept || '').toLowerCase().includes('andres')) {
            egresosAndres.push(e);
          } else {
            gastosOperativos.push(e);
          }
        }
      }
    });

    // Totales calculados
    const totalCobradoBruto = cobros.reduce((a, b) => a + b.montoTotal, 0);
    const totalComisionContador = cobros.reduce((a, b) => a + b.comision, 0);
    const totalNetoCobrado = cobros.reduce((a, b) => a + b.netoCaja, 0);

    const totalKilosEntregados = entregas.reduce((a, b) => a + b.kilos, 0);
    const totalCostoMaquila = entregas.reduce((a, b) => a + b.costoMaquila, 0);

    const totalPagadoAndres = egresosAndres.reduce((a, b) => a + b.amount, 0);
    const totalGastosOperativos = gastosOperativos.reduce((a, b) => a + b.amount, 0);

    const utilidadNetaSemana = totalNetoCobrado - totalCostoMaquila - totalGastosOperativos;

    return {
      cobros,
      entregas,
      comprasSemana,
      egresosAndres,
      gastosOperativos,
      ingresosCaja,
      totalCobradoBruto: round2(totalCobradoBruto),
      totalComisionContador: round2(totalComisionContador),
      totalNetoCobrado: round2(totalNetoCobrado),
      totalKilosEntregados: round2(totalKilosEntregados),
      totalCostoMaquila: round2(totalCostoMaquila),
      totalPagadoAndres: round2(totalPagadoAndres),
      totalGastosOperativos: round2(totalGastosOperativos),
      utilidadNetaSemana: round2(utilidadNetaSemana),
    };
  }, [orders, expenses, purchases, config, startOfWeek, endOfWeek]);

  // Generar HTML para Impresión y PDF
  const getCorteSemanalHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Corte y Resumen Semanal de Operaciones</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; font-size: 12px; line-height: 1.4; background: #fff; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .kpi-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
            .kpi-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .kpi-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
            h3 { font-size: 13px; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 20px; margin-bottom: 10px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
            th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-weight: 700; border-bottom: 1px solid #cbd5e1; }
            td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
            .num { text-align: right; font-family: monospace; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 200px; padding-top: 8px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, `Corte y Resumen Semanal (${weekLabel})`)}
          
          <div class="kpi-grid">
            <div class="kpi-box">
              <div class="kpi-title">Cobrado Providencia</div>
              <div class="kpi-val" style="color: #047857;">$${semanaData.totalNetoCobrado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              <div style="font-size: 10px; color: #64748b;">${semanaData.cobros.length} factura(s)</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Kilos Entregados Báscula</div>
              <div class="kpi-val">${semanaData.totalKilosEntregados.toLocaleString('es-MX')} kg</div>
              <div style="font-size: 10px; color: #64748b;">Costo: $${semanaData.totalCostoMaquila.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Pagado a Andrés</div>
              <div class="kpi-val" style="color: #d97706;">$${semanaData.totalPagadoAndres.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              <div style="font-size: 10px; color: #64748b;">${semanaData.egresosAndres.length} abono(s)</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-title">Utilidad Neta Semanal</div>
              <div class="kpi-val" style="color: #2563eb;">$${semanaData.utilidadNetaSemana.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
              <div style="font-size: 10px; color: #64748b;">50/50: $${(semanaData.utilidadNetaSemana / 2).toLocaleString('es-MX', { minimumFractionDigits: 2 })} c/u</div>
            </div>
          </div>

          <h3>1. Facturas Cobradas en la Semana</h3>
          ${semanaData.cobros.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Factura</th><th>Cliente</th><th>CR</th><th class="num">Kilos</th><th class="num">Total Factura</th><th class="num">Neto Caja</th>
                </tr>
              </thead>
              <tbody>
                ${semanaData.cobros.map(c => `
                  <tr>
                    <td>${fmtDate(c.fecha)}</td>
                    <td><b>#${escapeHtml(c.folio)}</b></td>
                    <td>${escapeHtml(c.client)}</td>
                    <td>${escapeHtml(c.cr)}</td>
                    <td class="num">${c.kilos.toLocaleString('es-MX')} kg</td>
                    <td class="num">$${c.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    <td class="num" style="font-weight: 700; color: #047857;">$${c.netoCaja.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #64748b;">No hubo cobros registrados en esta semana.</p>'}

          <h3>2. Kilos Entregados en Báscula de Providencia</h3>
          ${semanaData.entregas.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>OC</th><th>Documento</th><th class="num">Kilos</th><th class="num">Costo Maquila</th>
                </tr>
              </thead>
              <tbody>
                ${semanaData.entregas.map(e => `
                  <tr>
                    <td>${fmtDate(e.fecha)}</td>
                    <td><b>${escapeHtml(e.folioOC)}</b></td>
                    <td>${e.docType ? `${e.docType.toUpperCase()} ${e.docFolio || ''}` : 'Báscula'}</td>
                    <td class="num">${e.kilos.toLocaleString('es-MX')} kg</td>
                    <td class="num">$${e.costoMaquila.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #64748b;">No hubo entregas en báscula durante esta semana.</p>'}

          <h3>3. Abonos y Pagos Realizados a Andrés</h3>
          ${semanaData.egresosAndres.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Concepto</th><th class="num">Monto Pagado</th>
                </tr>
              </thead>
              <tbody>
                ${semanaData.egresosAndres.map(eg => `
                  <tr>
                    <td>${fmtDate(eg.date)}</td>
                    <td>${escapeHtml(eg.concept || 'Abono a Maquila')}</td>
                    <td class="num" style="font-weight: 700; color: #d97706;">$${eg.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #64748b;">No hubo pagos a Andrés en esta semana.</p>'}

          <div class="signatures">
            <div class="sig-box">Elaboró</div>
            <div class="sig-box">Revisó y Aprobó</div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const html = getCorteSemanalHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleSharePdf = async () => {
    const html = getCorteSemanalHtml();
    toast('Generando PDF del resumen semanal...', 'ok');
    await shareHtmlAsPdf(html, `CorteSemanal_${fmtDate(startOfWeek)}.pdf`);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Hoja Cobros
    const wsCobros = XLSX.utils.json_to_sheet(
      semanaData.cobros.map(c => ({
        Fecha: fmtDate(c.fecha),
        Factura: c.folio,
        Cliente: c.client,
        Contrarecibo: c.cr,
        Kilos: c.kilos,
        MontoTotal: c.montoTotal,
        Comision: c.comision,
        NetoCaja: c.netoCaja,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsCobros, 'Cobros_Semana');

    // Hoja Entregas
    const wsEntregas = XLSX.utils.json_to_sheet(
      semanaData.entregas.map(e => ({
        Fecha: fmtDate(e.fecha),
        OC: e.folioOC,
        TipoDoc: e.docType || 'Báscula',
        FolioDoc: e.docFolio || '',
        Kilos: e.kilos,
        CostoMaquila: e.costoMaquila,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsEntregas, 'Entregas_Andres');

    XLSX.writeFile(wb, `Corte_Semanal_${fmtDate(startOfWeek)}.xlsx`);
    toast('📊 Excel del corte semanal descargado.', 'ok');
  };

  return (
    <Modal title="📅 Historial y Corte Semana a Semana" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Selector y Navegador de Semanas */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--paper-sunk)',
            padding: '10px 16px',
            borderRadius: 12,
            border: '1px solid var(--line)',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => setWeekOffset(prev => prev - 1)}
            style={{ fontSize: 12, fontWeight: 700 }}
          >
            ◀ Semana Anterior
          </button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
              {weekOffset === 0 ? '🟢 Esta Semana' : weekOffset === -1 ? 'Semana Pasada' : `Hace ${Math.abs(weekOffset)} Semanas`}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
              {weekLabel}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {weekOffset !== 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => setWeekOffset(0)}
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                Hoy
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => setWeekOffset(prev => prev + 1)}
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              Semana Siguiente ▶
            </button>
          </div>
        </div>

        {/* Resumen KPIs de la Semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div style={{ background: 'var(--paper-raised)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              💰 Cobrado a Providencia
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#047857', marginTop: 2 }}>
              {money(semanaData.totalNetoCobrado)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              {semanaData.cobros.length} factura(s) cobradas
            </div>
          </div>

          <div style={{ background: 'var(--paper-raised)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              📦 Entregado en Báscula
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>
              {semanaData.totalKilosEntregados.toLocaleString('es-MX')} kg
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              Costo Maquila: {money(semanaData.totalCostoMaquila)}
            </div>
          </div>

          <div style={{ background: 'var(--paper-raised)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              💸 Pagado a Andrés
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#d97706', marginTop: 2 }}>
              {money(semanaData.totalPagadoAndres)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              {semanaData.egresosAndres.length} abono(s) registrados
            </div>
          </div>

          <div style={{ background: 'var(--paper-raised)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
              📈 Utilidad Neta Semanal
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
              {money(semanaData.utilidadNetaSemana)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              50/50: {money(semanaData.utilidadNetaSemana / 2)} c/u
            </div>
          </div>
        </div>

        {/* Tablas Detalladas de la Semana */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 380, overflowY: 'auto' }}>
          {/* 1. Facturas Cobradas */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              💵 1. Facturas Cobradas en esta Semana ({semanaData.cobros.length})
            </div>
            {semanaData.cobros.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontStyle: 'italic', padding: 8, background: 'var(--paper-sunk)', borderRadius: 6 }}>
                No hubo cobros de facturas en esta semana.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: 'var(--paper-sunk)' }}>
                    <th>Fecha</th>
                    <th>Factura</th>
                    <th>CR</th>
                    <th className="num">Kilos</th>
                    <th className="num">Total Factura</th>
                    <th className="num">Neto a Caja</th>
                  </tr>
                </thead>
                <tbody>
                  {semanaData.cobros.map((c, i) => (
                    <tr key={i}>
                      <td className="mono">{fmtDate(c.fecha)}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>#{c.folio}</td>
                      <td className="mono">{c.cr}</td>
                      <td className="num mono">{c.kilos.toLocaleString('es-MX')} kg</td>
                      <td className="num mono">{money(c.montoTotal)}</td>
                      <td className="num mono" style={{ fontWeight: 800, color: '#047857' }}>{money(c.netoCaja)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 2. Entregas en Báscula */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              📦 2. Kilos Entregados en Báscula ({semanaData.entregas.length} entregas)
            </div>
            {semanaData.entregas.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontStyle: 'italic', padding: 8, background: 'var(--paper-sunk)', borderRadius: 6 }}>
                No se registraron entregas en báscula durante esta semana.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: 'var(--paper-sunk)' }}>
                    <th>Fecha</th>
                    <th>OC</th>
                    <th>Doc / Folio</th>
                    <th className="num">Kilos</th>
                    <th className="num">Costo Maquila ($42)</th>
                  </tr>
                </thead>
                <tbody>
                  {semanaData.entregas.map((e, i) => (
                    <tr key={i}>
                      <td className="mono">{fmtDate(e.fecha)}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{e.folioOC}</td>
                      <td>{e.docType ? `${e.docType.toUpperCase()} ${e.docFolio || ''}` : 'Báscula'}</td>
                      <td className="num mono">{e.kilos.toLocaleString('es-MX')} kg</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>{money(e.costoMaquila)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 3. Pagos a Andrés */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              💸 3. Abonos y Pagos Entregados a Andrés ({semanaData.egresosAndres.length})
            </div>
            {semanaData.egresosAndres.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontStyle: 'italic', padding: 8, background: 'var(--paper-sunk)', borderRadius: 6 }}>
                No se realizaron abonos a Andrés en esta semana.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: 'var(--paper-sunk)' }}>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th className="num">Importe Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {semanaData.egresosAndres.map((eg, i) => (
                    <tr key={i}>
                      <td className="mono">{fmtDate(eg.date)}</td>
                      <td>{eg.concept || 'Abono Maquila'}</td>
                      <td className="num mono" style={{ fontWeight: 800, color: '#d97706' }}>{money(eg.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Botones de Acción y Exportación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={handlePrint} style={{ fontSize: 12 }}>
              🖨️ Imprimir
            </button>
            <button type="button" className="btn" onClick={handleSharePdf} style={{ fontSize: 12 }}>
              📄 Compartir PDF
            </button>
            <button type="button" className="btn" onClick={handleExportExcel} style={{ fontSize: 12 }}>
              📊 Excel (XLSX)
            </button>
          </div>

          <button type="button" className="btn btn-primary" onClick={onClose} style={{ fontSize: 12 }}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
