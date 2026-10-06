import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PurchaseOrder } from '../../lib/types';
import { fmtDate, fmtDateFull, money, escapeHtml } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';
import { useSystemSettings } from '../../hooks/useSystemSettings';

interface OcClientStatusReportProps {
  order: PurchaseOrder;
  onClose: () => void;
}

function pct(a: number, b: number): number {
  if (!b || !isFinite(b)) return 0;
  return Math.min(100, Math.round((a / b) * 1000) / 10);
}

export const OcClientStatusReport: React.FC<OcClientStatusReportProps> = ({ order, onClose }) => {
  const { settings } = useSystemSettings();
  const [copied, setCopied] = useState(false);

  // ── Métricas ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalKg = Number(order.totalKilograms) || 0;
    const deliveries = order.deliveries || [];
    const invoices = order.invoices || [];

    const deliveredKg = deliveries.reduce((s, d) => s + (Number(d.kilos) || 0), 0);
    const invoicedKg = invoices.reduce((s, i) => s + (Number(i.kilos) || 0), 0);
    const pendingInvoiceKg = Math.max(0, deliveredKg - invoicedKg);
    const remainingKg = Math.max(0, totalKg - deliveredKg);

    const fulfillPct = pct(deliveredKg, totalKg);

    const salePrice = order.financials?.salePricePerKg ?? 43;
    const deliveredAmount = deliveredKg * salePrice;
    const deliveredAmountIva = deliveredAmount * 1.16;
    const pendingAmount = remainingKg * salePrice * 1.16;

    const nextDate = order.estimatedDeliveryDate;
    const items = order.items || [];

    return {
      totalKg,
      deliveredKg,
      invoicedKg,
      pendingInvoiceKg,
      remainingKg,
      fulfillPct,
      salePrice,
      deliveredAmountIva,
      pendingAmount,
      nextDate,
      deliveries,
      items,
    };
  }, [order]);

  // ── Generar mensaje WhatsApp ─────────────────────────────────────────────────
  const buildWhatsappMsg = () => {
    const m = metrics;
    const client = order.client || 'Estimado cliente';
    const folio = order.folio || order.oc || 'S/F';
    const empresa = settings?.companyName || 'Elemental Denim Bolsas';
    const today = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
    const nextDateStr = m.nextDate ? fmtDateFull(m.nextDate) : 'Por confirmar';

    const deliveryLines = m.deliveries
      .map((d, i) => {
        const fecha = d.date ? fmtDate(d.date) : '—';
        const docRef = d.docFolio ? ` (Rem. ${d.docFolio})` : '';
        const factStatus = d.invoiced ? '✅ Facturado' : '⏳ Pdte. factura';
        return `  ${i + 1}. ${fecha}${docRef}: *${Number(d.kilos).toLocaleString('es-MX')} kg* — ${factStatus}`;
      })
      .join('\n');

    const itemLines = m.items
      .map((it) => {
        const pedido = Number(it.quantity);
        const entregado = Number(it.deliveredQuantity || 0);
        const falta = Math.max(0, pedido - entregado);
        return `  • ${it.description}: ${entregado.toLocaleString('es-MX')} / ${pedido.toLocaleString('es-MX')} kg${falta > 0 ? ` (faltan ${falta.toLocaleString('es-MX')} kg)` : ' ✅'}`;
      })
      .join('\n');

    return [
      `📦 *REPORTE DE AVANCE — OC ${folio}*`,
      `_${empresa} · ${today}_`,
      ``,
      `Estimado(a) ${client},`,
      `Le compartimos el estado actualizado de su Orden de Compra:`,
      ``,
      `*📊 RESUMEN GENERAL*`,
      `• OC Oficial: ${folio}`,
      `• Total Pedido: *${m.totalKg.toLocaleString('es-MX')} kg*`,
      `• Entregado a la fecha: *${m.deliveredKg.toLocaleString('es-MX')} kg* (${m.fulfillPct}%)`,
      `• Pendiente de Entrega: *${m.remainingKg.toLocaleString('es-MX')} kg*`,
      `• Próxima Entrega Programada: 📅 *${nextDateStr}*`,
      ``,
      m.deliveries.length > 0 ? `*🚚 HISTORIAL DE ENTREGAS*\n${deliveryLines}` : '',
      ``,
      m.items.length > 0 ? `*📋 DETALLE POR PARTIDA*\n${itemLines}` : '',
      ``,
      `*💰 RESUMEN FINANCIERO*`,
      `• Material Entregado: ${money(m.deliveredAmountIva)} (c/IVA)`,
      `• Material Pendiente: ${money(m.pendingAmount)} (c/IVA)`,
      ``,
      `Estamos a sus órdenes para cualquier aclaración.`,
      `_${empresa}_`,
    ]
      .filter((l) => l !== '')
      .join('\n');
  };

  // ── Imprimir / PDF ───────────────────────────────────────────────────────────
  const handlePrint = () => {
    triggerHaptic('medium');
    const m = metrics;
    const folio = order.folio || order.oc || 'S/F';
    const client = order.client || 'Cliente';
    const empresa = settings?.companyName || 'Elemental Denim Bolsas';
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
  };

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    triggerHaptic('medium');
    const msg = buildWhatsappMsg();
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ── Email ────────────────────────────────────────────────────────────────────
  const handleEmail = () => {
    triggerHaptic('light');
    const folio = order.folio || order.oc || 'S/F';
    const empresa = settings?.companyName || 'Elemental Denim Bolsas';
    const subject = encodeURIComponent(`Reporte de Avance OC ${folio} — ${empresa}`);
    const body = encodeURIComponent(buildWhatsappMsg().replace(/\*/g, '').replace(/_/g, ''));
    const email = order.clientEmail || '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  // ── Copiar al portapapeles ───────────────────────────────────────────────────
  const handleCopy = async () => {
    triggerHaptic('light');
    try {
      await navigator.clipboard.writeText(buildWhatsappMsg());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const m = metrics;
  const folio = order.folio || order.oc || 'S/F';
  const client = order.client || 'Cliente';
  const nextDateStr = m.nextDate ? fmtDate(m.nextDate) : 'Por confirmar';
  const fulfillColor = m.fulfillPct >= 98 ? '#10b981' : m.fulfillPct >= 50 ? '#3b82f6' : '#f59e0b';

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            width: '100%', maxWidth: 860, maxHeight: '92vh',
            display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(160deg, #0f172a 0%, #0a0f1e 100%)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 20,
            boxShadow: '0 32px 64px -12px rgba(0,0,0,0.9), 0 0 40px rgba(59,130,246,0.12)',
            color: '#f1f5f9',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '20px 24px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(90deg, rgba(59,130,246,0.08), transparent)',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                📊 Reporte de Avance · Orden de Compra
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>OC {folio}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                {client} · {settings?.companyName || 'Elemental Denim Bolsas'}
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={handleCopy} style={btnStyle('#475569')}>
                {copied ? '✅ Copiado' : '📋 Copiar'}
              </button>
              <button onClick={handleEmail} style={btnStyle('#4f46e5')}>
                ✉️ Email
              </button>
              <button onClick={handleWhatsApp} style={btnStyle('#16a34a')}>
                📲 WhatsApp
              </button>
              <button onClick={handlePrint} style={btnStyle('#0369a1')}>
                🖨️ PDF / Imprimir
              </button>
              <button onClick={onClose} style={{
                background: 'transparent', border: 'none', color: '#94a3b8',
                fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
              }}>×</button>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <KpiTile label="Total OC" value={`${m.totalKg.toLocaleString('es-MX')} kg`} sub={`OC ${folio}`} color="#94a3b8" />
              <KpiTile label="✅ Entregado" value={`${m.deliveredKg.toLocaleString('es-MX')} kg`} sub={`${m.fulfillPct}% del total`} color="#10b981" />
              <KpiTile label="⏳ Faltante" value={`${m.remainingKg.toLocaleString('es-MX')} kg`} sub={money(m.pendingAmount) + ' c/IVA'} color={m.remainingKg > 0 ? '#f59e0b' : '#10b981'} />
              <KpiTile label="📅 Próxima Entrega" value={nextDateStr} sub={`${m.remainingKg.toLocaleString('es-MX')} kg comprometidos`} color="#60a5fa" />
            </div>

            {/* Barra de progreso */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                <span>Avance de Cumplimiento</span>
                <span style={{ color: fulfillColor }}>{m.fulfillPct}%</span>
              </div>
              <div style={{ height: 14, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${m.fulfillPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 8,
                    background: `linear-gradient(90deg, ${fulfillColor}, ${fulfillColor}cc)`,
                    boxShadow: `0 0 12px ${fulfillColor}55`,
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                <span>{m.deliveredKg.toLocaleString('es-MX')} kg entregados</span>
                <span>{m.remainingKg.toLocaleString('es-MX')} kg restantes</span>
              </div>
            </div>

            {/* Entregas */}
            {m.deliveries.length > 0 && (
              <section>
                <SectionTitle>🚚 Historial de Entregas</SectionTitle>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      <th style={thS}>#</th>
                      <th style={thS}>Fecha</th>
                      <th style={thS}>Documento</th>
                      <th style={{ ...thS, textAlign: 'right' }}>Kilos</th>
                      <th style={{ ...thS, textAlign: 'center' }}>Factura</th>
                      <th style={thS}>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.deliveries.map((d, i) => (
                      <tr key={d.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={tdS}><span style={{ fontWeight: 700, color: '#94a3b8' }}>{i + 1}</span></td>
                        <td style={tdS}><span style={{ fontWeight: 600, color: '#e2e8f0' }}>{d.date ? fmtDate(d.date) : '—'}</span></td>
                        <td style={tdS}>
                          {d.docFolio
                            ? <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>Rem. {d.docFolio}</span>
                            : <span style={{ color: '#64748b' }}>—</span>}
                        </td>
                        <td style={{ ...tdS, textAlign: 'right', fontWeight: 800, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(d.kilos).toLocaleString('es-MX')} kg
                        </td>
                        <td style={{ ...tdS, textAlign: 'center' }}>
                          {d.invoiced
                            ? <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>✅ Facturado</span>
                            : <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>⏳ Pdte. Factura</span>}
                        </td>
                        <td style={{ ...tdS, color: '#64748b', fontSize: 12, maxWidth: 200 }}>{d.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}>
                      <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', color: '#94a3b8', fontWeight: 700, fontSize: 12 }}>TOTAL ENTREGADO:</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#10b981', fontSize: 15 }}>{m.deliveredKg.toLocaleString('es-MX')} kg</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </section>
            )}

            {/* Detalle por partida */}
            {m.items.length > 0 && (
              <section>
                <SectionTitle>📋 Detalle por Partida</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {m.items.map((it, i) => {
                    const pedido = Number(it.quantity);
                    const entregado = Number(it.deliveredQuantity || 0);
                    const falta = Math.max(0, pedido - entregado);
                    const pctIt = pct(entregado, pedido);
                    const barCol = pctIt >= 100 ? '#10b981' : pctIt >= 50 ? '#3b82f6' : '#f59e0b';
                    return (
                      <div key={it.id || i} style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 10, padding: '12px 14px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: 13 }}>{it.description}</div>
                            {it.code && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{it.code}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 13, textAlign: 'right', flexShrink: 0 }}>
                            <div>
                              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700 }}>PEDIDO</div>
                              <div style={{ fontWeight: 700, color: '#94a3b8' }}>{pedido.toLocaleString('es-MX')} kg</div>
                            </div>
                            <div>
                              <div style={{ color: '#10b981', fontSize: 10, fontWeight: 700 }}>ENTREGADO</div>
                              <div style={{ fontWeight: 800, color: '#10b981' }}>{entregado.toLocaleString('es-MX')} kg</div>
                            </div>
                            <div>
                              <div style={{ color: falta > 0 ? '#f59e0b' : '#10b981', fontSize: 10, fontWeight: 700 }}>FALTANTE</div>
                              <div style={{ fontWeight: 800, color: falta > 0 ? '#f59e0b' : '#10b981' }}>
                                {falta > 0 ? `${falta.toLocaleString('es-MX')} kg` : '✅'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pctIt}%` }}
                              transition={{ duration: 0.7, delay: i * 0.05 }}
                              style={{ height: '100%', background: barCol, borderRadius: 4 }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{pctIt}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Resumen financiero */}
            <section>
              <SectionTitle>💰 Resumen Financiero</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>Material Entregado (c/IVA)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', marginTop: 4 }}>{money(m.deliveredAmountIva)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{m.deliveredKg.toLocaleString('es-MX')} kg × ${m.salePrice}/kg + IVA</div>
                </div>
                <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>Pendiente de Entrega (c/IVA)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>{money(m.pendingAmount)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{m.remainingKg.toLocaleString('es-MX')} kg restantes · Fecha: {nextDateStr}</div>
                </div>
              </div>
            </section>

          </div>

          {/* ── Footer ── */}
          <div style={{
            padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(0,0,0,0.2)', fontSize: 12, color: '#64748b',
          }}>
            <span>Reporte generado el {new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}</span>
            <button onClick={onClose} style={{
              padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
            }}>Cerrar</button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ── Sub-componentes internos ──────────────────────────────────────────────────

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}33`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: `${color}cc`, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color, marginTop: 4, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 10,
      paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {children}
    </div>
  );
}

const thS: React.CSSProperties = { padding: '6px 10px', fontWeight: 700 };
const tdS: React.CSSProperties = { padding: '9px 10px' };

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: `${bg}22`, border: `1px solid ${bg}66`,
    color: '#f1f5f9', padding: '7px 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
    minHeight: 36, transition: 'background 0.15s',
  };
}
