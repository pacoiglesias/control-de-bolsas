import type { PurchaseOrder } from './types';
import type { ClientReportMetrics } from './clientReportTypes';
import { fmtDate, fmtDateFull, money, escapeHtml } from './format';
import { pct } from './clientReportTypes';

export interface PrintReportParams {
  order: PurchaseOrder;
  metrics: ClientReportMetrics;
  companyName?: string;
}

export function printClientReport({ order, metrics: m, companyName }: PrintReportParams): void {
  const folio = order.folio || order.oc || 'S/F';
  const client = order.client || 'Cliente';
  const empresa = companyName || 'Elemental Denim Bolsas';
  const today = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
  const nextDateStr = m.nextDate ? fmtDateFull(m.nextDate) : 'Por confirmar';

  const deliveryRows = m.deliveries
    .map((d, i) => {
      const fecha = d.date ? fmtDate(d.date) : '—';
      const docRef = escapeHtml(d.docFolio ? `Rem. ${d.docFolio}` : '—');
      const factStatus = d.invoiced
        ? '<span style="color:#16a34a;font-weight:700">✅ Facturado</span>'
        : '<span style="color:#d97706;font-weight:700">⏳ Pdte. Factura</span>';
      return `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;color:#374151;font-weight:600">${i + 1}</td>
        <td style="padding:8px 12px;color:#374151">${escapeHtml(fecha)}</td>
        <td style="padding:8px 12px;color:#374151">${docRef}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1d4ed8">${Number(d.kilos).toLocaleString('es-MX')} kg</td>
        <td style="padding:8px 12px;text-align:center">${factStatus}</td>
        <td style="padding:8px 12px;font-size:12px;color:#6b7280;max-width:200px">${escapeHtml(d.notes || '')}</td>
      </tr>`;
    })
    .join('');

  const itemRows = m.items
    .map((it) => {
      const pedido = Number(it.quantity);
      const entregado = Number(it.deliveredQuantity || 0);
      const falta = Math.max(0, pedido - entregado);
      const pctIt = pct(entregado, pedido);
      const barColor = pctIt >= 100 ? '#16a34a' : pctIt >= 50 ? '#2563eb' : '#d97706';
      return `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:8px 12px;font-size:12px;color:#374151;max-width:280px">${escapeHtml(it.description)}<br><span style="color:#9ca3af;font-size:11px">${escapeHtml(it.code || '')}</span></td>
        <td style="padding:8px 12px;text-align:right;color:#374151">${pedido.toLocaleString('es-MX')} kg</td>
        <td style="padding:8px 12px;text-align:right;color:#16a34a;font-weight:700">${entregado.toLocaleString('es-MX')} kg</td>
        <td style="padding:8px 12px;text-align:right;color:${falta > 0 ? '#dc2626' : '#16a34a'};font-weight:700">${falta > 0 ? falta.toLocaleString('es-MX') + ' kg' : '✅ Completo'}</td>
        <td style="padding:8px 12px;min-width:120px">
          <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden">
            <div style="background:${barColor};height:8px;width:${pctIt}%;border-radius:4px"></div>
          </div>
          <div style="font-size:11px;text-align:right;color:#6b7280;margin-top:2px">${pctIt}%</div>
        </td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Reporte OC ${escapeHtml(folio)} — ${escapeHtml(client)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px 36px; color: #1f2937; background: #fff; }
  h1 { font-size: 20px; font-weight: 800; margin: 0; }
  h2 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; color: #1e3a5f; border-bottom: 2px solid #dbeafe; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1e3a5f; color: #fff; padding: 8px 12px; font-weight: 700; text-align: left; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: .5px; }
  .kpi-val { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px; }
  .kpi-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .progress-bar { background: #e2e8f0; border-radius: 6px; height: 12px; overflow: hidden; margin-top: 8px; }
  .progress-fill { background: linear-gradient(90deg, #2563eb, #3b82f6); height: 12px; border-radius: 6px; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  @media print { body { padding: 12px 20px; } }
</style>
</head>
<body>
<!-- HEADER -->
<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:20px">
  <div>
    <div style="font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase;letter-spacing:1px">Reporte de Avance de Orden de Compra</div>
    <h1>${escapeHtml(empresa)}</h1>
    <div style="font-size:13px;color:#475569;margin-top:4px">📦 OC Oficial: <strong>${escapeHtml(folio)}</strong> · Cliente: <strong>${escapeHtml(client)}</strong></div>
  </div>
  <div style="text-align:right;font-size:12px;color:#64748b">
    <div style="font-weight:700;font-size:14px;color:#1e3a5f">${escapeHtml(today)}</div>
    <div>Generado desde Bolsas Elemental ERP</div>
  </div>
</div>

<!-- KPIs -->
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">Total Pedido</div>
    <div class="kpi-val">${m.totalKg.toLocaleString('es-MX')} kg</div>
    <div class="kpi-sub">Orden de Compra ${escapeHtml(folio)}</div>
  </div>
  <div class="kpi" style="border-color:#bbf7d0;background:#f0fdf4">
    <div class="kpi-label" style="color:#16a34a">Entregado</div>
    <div class="kpi-val" style="color:#16a34a">${m.deliveredKg.toLocaleString('es-MX')} kg</div>
    <div class="kpi-sub">${m.fulfillPct}% del total</div>
  </div>
  <div class="kpi" style="border-color:#fecaca;background:#fef2f2">
    <div class="kpi-label" style="color:#dc2626">Pendiente de Entrega</div>
    <div class="kpi-val" style="color:#dc2626">${m.remainingKg.toLocaleString('es-MX')} kg</div>
    <div class="kpi-sub">${money(m.pendingAmount)} con IVA</div>
  </div>
  <div class="kpi" style="border-color:#bfdbfe;background:#eff6ff">
    <div class="kpi-label" style="color:#2563eb">Próxima Entrega</div>
    <div class="kpi-val" style="font-size:14px;color:#2563eb">${escapeHtml(nextDateStr)}</div>
    <div class="kpi-sub">${m.remainingKg.toLocaleString('es-MX')} kg comprometidos</div>
  </div>
</div>

<!-- BARRA DE PROGRESO -->
<div style="margin:16px 0 24px">
  <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#475569;margin-bottom:4px">
    <span>Avance de Cumplimiento</span>
    <span>${m.fulfillPct}%</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" style="width:${m.fulfillPct}%"></div>
  </div>
</div>

${m.deliveries.length > 0 ? `
<!-- HISTORIAL DE ENTREGAS -->
<h2>🚚 Historial de Entregas Físicas</h2>
<table>
  <thead>
    <tr>
      <th style="width:40px">#</th>
      <th>Fecha</th>
      <th>Documento / Remisión</th>
      <th style="text-align:right">Kilos</th>
      <th style="text-align:center">Estatus Factura</th>
      <th>Notas</th>
    </tr>
  </thead>
  <tbody>${deliveryRows}</tbody>
  <tfoot>
    <tr style="background:#f8fafc;font-weight:800">
      <td colspan="3" style="padding:8px 12px;text-align:right;color:#1e3a5f">TOTAL ENTREGADO:</td>
      <td style="padding:8px 12px;text-align:right;color:#2563eb;font-size:15px">${m.deliveredKg.toLocaleString('es-MX')} kg</td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>
` : ''}

${m.items.length > 0 ? `
<!-- DETALLE POR PARTIDA -->
<h2>📋 Detalle por Partida</h2>
<table>
  <thead>
    <tr>
      <th>Descripción</th>
      <th style="text-align:right">Pedido</th>
      <th style="text-align:right">Entregado</th>
      <th style="text-align:right">Faltante</th>
      <th style="min-width:120px">Avance</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>
` : ''}

<!-- RESUMEN FINANCIERO -->
<h2>💰 Resumen Financiero</h2>
<table style="max-width:500px">
  <tbody>
    <tr style="background:#f8fafc"><td style="padding:8px 12px;color:#374151;font-weight:600">Material Entregado (c/IVA)</td><td style="padding:8px 12px;text-align:right;color:#16a34a;font-weight:800">${money(m.deliveredAmountIva)}</td></tr>
    <tr><td style="padding:8px 12px;color:#374151;font-weight:600">Material Pendiente (c/IVA)</td><td style="padding:8px 12px;text-align:right;color:#dc2626;font-weight:800">${money(m.pendingAmount)}</td></tr>
  </tbody>
</table>

<footer>
  Reporte generado automáticamente por ${escapeHtml(empresa)} ERP · ${escapeHtml(today)}<br>
  Documento informativo. Los montos están sujetos a verificación en la factura CFDI oficial.
</footer>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
