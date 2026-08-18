import { escapeHtml, fmtDate, getPrintHeaderHtml, toDate } from '../../lib/format';
import { daysLate } from '../../lib/finance';

// Extraido de Cobranza/index.tsx: generadores puros de HTML para los 3
// reportes imprimibles/compartibles de Cobranza (Global, Cartera Vencida y
// Consolidado por Contrarecibo). No tienen efectos secundarios -- solo
// arman un string de HTML a partir de lo que reciben por parametro -- por
// lo que separarlos del componente es de bajo riesgo: index.tsx conserva
// las funciones printX()/shareX() (que si tocan window/Blob/toast) y solo
// llama a estas para obtener el HTML.

export function getCobranzaGlobalHtml(data: any, settings: any) {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte Global de Cobranza</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Reporte Global de Cobranza y Cuentas por Cobrar")}

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TE DEBEN</div><div class="kpi-val">$${data.meDeben.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">VENCIDO</div><div class="kpi-val" style="color: #b91c1c;">$${data.vencido.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">COBRADO (CON CONTADOR)</div><div class="kpi-val" style="color: #047857;">$${data.cobrado.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">COMISIONES</div><div class="kpi-val" style="color: #b45309;">$${data.comisiones.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <h3>1. Facturas Pendientes de Cobro (${data.open.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Vencimiento</th><th class="num">Monto Venta</th>
              </tr>
            </thead>
            <tbody>
              ${data.open.map((x: any) => `
                <tr>
                  <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                  <td>${escapeHtml(x.o.client || '—')}</td>
                  <td>${escapeHtml(x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '—')}</td>
                  <td>${fmtDate(x.inv.creditCycle.dueDate) || '—'}</td>
                  <td class="num">$${(x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3>2. Contrarecibos Cobrados (Por Recoger Efectivo - ${data.paid.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th class="num">Utilidad a Ingresar</th>
              </tr>
            </thead>
            <tbody>
              ${data.paid.map((x: any) => {
                const cr = x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '';
                const grp = cr ? data.listaCr.find((g: any) => g.cr === cr) : null;
                return `
                  <tr>
                    <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                    <td>${escapeHtml(x.o.client || '—')}</td>
                    <td>${escapeHtml(cr || '—')}</td>
                    <td class="num">$${(grp ? grp.netCobrado : (x.inv.financials?.invoiceTotal ?? 0)).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <h3>3. Historial de Recolecciones en CAJA (${data.collected.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Estado</th><th class="num">Monto Venta</th>
              </tr>
            </thead>
            <tbody>
              ${data.collected.map((x: any) => `
                <tr>
                  <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                  <td>${escapeHtml(x.o.client || '—')}</td>
                  <td>${escapeHtml(x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '—')}</td>
                  <td>Recogido (En CAJA)</td>
                  <td class="num">$${(x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
}

export function getCarteraVencidaHtml(settings: any, overdueItems: any[], totalVencido: number) {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Cartera Vencida</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #fef2f2; border: 1px solid #fca5a5; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #991b1b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #7f1d1d; letter-spacing: -0.02em; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Reporte de Cartera Vencida (Alarma)")}

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TOTAL VENCIDO</div><div class="kpi-val">$${totalVencido.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">FACTURAS VENCIDAS</div><div class="kpi-val">${overdueItems.length}</div></div>
          </div>

          <h3>Detalle de Cuentas Atrasadas</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Días Atraso</th><th class="num">Monto Vencido</th>
              </tr>
            </thead>
            <tbody>
              ${overdueItems.length > 0 ? overdueItems.map(x => `
                <tr>
                  <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                  <td><strong>${escapeHtml(x.o.client || '—')}</strong></td>
                  <td>${escapeHtml(x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '—')}</td>
                  <td style="color: #b91c1c; font-weight: 600;">Hace ${daysLate(toDate(x.inv.creditCycle.dueDate))} días</td>
                  <td class="num" style="color: #b91c1c; font-weight: bold;">$${(x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align: center;">No hay cartera vencida</td></tr>'}
            </tbody>
          </table>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
}

export function getConsolidatedCrHtml(settings: any, grp: any) {
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Cobro - CR ${escapeHtml(grp.cr)}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 14px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; font-size: 14px; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #cbd5e1; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
            .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; margin-bottom: 40px; width: 400px; margin-left: auto; }
            .summary-line { display: flex; justify-content: space-between; margin-bottom: 12px; }
            .summary-line.total { border-top: 2px solid #94a3b8; padding-top: 12px; font-weight: 800; font-size: 18px; color: #0f172a; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 250px; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Notificación de Cobro y Liquidación Comercial", `Contrarecibo: ${escapeHtml(grp.cr)} - Cliente: ${escapeHtml(grp.client)}`)}

          <div class="meta-grid">
            <div>
              <strong>Contrarecibo (CR):</strong> ${escapeHtml(grp.cr)}<br>
              <strong>Cliente:</strong> ${escapeHtml(grp.client)}<br>
              <strong>Factura(s):</strong> ${grp.folios.map((f: any) => '#' + escapeHtml(f)).join(', ') || '—'}
            </div>
            <div style="text-align:right;">
              <strong>Proveedor Fabricante:</strong> Andrés (Sin Mermas)<br>
              <strong>Kilos Entregados:</strong> ${grp.totalKilos.toLocaleString('es-MX')} kg<br>
              <strong>Estado Cobro:</strong> ${escapeHtml(grp.status)}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Concepto / Referencia</th>
                <th style="text-align:right;">Kilos</th>
                <th style="text-align:right;">Venta Facturada</th>
                <th style="text-align:right;">Costo Andrés</th>
                <th style="text-align:right;">Comisión Contador</th>
                <th style="text-align:right;">Utilidad Líquida Real</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Contrarecibo ${escapeHtml(grp.cr)} (${grp.folios.map((f: any) => '#' + escapeHtml(f)).join(', ')})</td>
                <td style="text-align:right;">${grp.totalKilos.toLocaleString('es-MX')} kg</td>
                <td style="text-align:right;">$${grp.totalVenta.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;color:#8A5A1E;">-$${grp.costoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;color:#B23A2E;">-$${grp.comisionContador.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;font-weight:700;color:#2F7A52;">$${grp.netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-line"><span>Total Facturado a Cliente (${escapeHtml(grp.client)}):</span><strong>$${grp.totalVenta.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line"><span>Costo Directo Fabricante Andrés (Sin mermas):</span><span style="color:#8A5A1E;">-$${grp.costoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span>Comisión Contador / Contabilidad:</span><span style="color:#B23A2E;">-$${grp.comisionContador.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span><strong>DEPÓSITO QUE RECIBES</strong> (factura menos comisión):</span><strong style="color:#2F7A52;">$${grp.netCobrado.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line total">
              <span>UTILIDAD LÍQUIDA REAL (MARGEN: ${grp.margenPct.toFixed(2)}%):</span>
              <span>$${grp.netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">Firma y Sello de Recepción Cliente</div>
            <div class="sig-box">Autorización de Cobro y Entrada CAJA</div>
          </div>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
}
