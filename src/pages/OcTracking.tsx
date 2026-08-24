import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import OrderModal from '../components/OrderModal';
import { EntregasKanban } from '../components/OcTracking/EntregasKanban';
import { KpiCard, Skeleton, ProgressBar } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { escapeHtml, money, getPrintHeaderHtml, shareHtmlAsPdf, nombreClienteVisible, toDate, fmtDate } from '../lib/format';
import { getOrderSummary, round2, extractCr, inferDepartment } from '../lib/finance';
import { computeDeliveredTotals } from '../lib/deliveries';
import type { PurchaseOrder } from '../lib/types';

interface OcGroup {
  oc: string;
  order: PurchaseOrder;
  kilosPedidos: number;
  kilosEntregados: number;
  kilosFaltantes: number;
  kilosFacturados: number;
  kilosPendientesFacturar: number;
  totalVentaFacturada: number;
  statusCategory: 'por_entregar' | 'pendiente_factura' | 'en_cobranza' | 'completada';
  invoices: {
    folio: string;
    kilos: number;
    amount: number;
    cr: string;
    dueDate: Date | null;
    status: string;
    paid: boolean;
    order: PurchaseOrder;
  }[];
}

export default function OcTracking() {
  const toast = useToast();
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [view, setView] = useState<'lista' | 'tablero'>('lista');
  const [filterState, setFilterState] = useState<'todas' | 'por_entregar' | 'pendiente_factura' | 'en_cobranza' | 'completadas'>('todas');
  const [search, setSearch] = useState('');

  // Agrupación y cálculo financiero/operativo sin filtros destructivos
  const allOcGroups = useMemo<OcGroup[]>(() => {
    const list: OcGroup[] = [];

    for (const order of orders) {
      const ocKey = (order.oc || order.folio || order.id).trim();
      const summary = getOrderSummary(order);
      
      const kilosPedidos = Number(order.totalKilograms ?? 0) || (order.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0);
      const kilosEntregados = Number(summary.kilosDelivered ?? 0);
      const kilosFaltantes = Math.max(0, kilosPedidos - kilosEntregados);
      const kilosFacturados = Number(summary.kilosInvoiced ?? 0);
      const kilosPendientesFacturar = Math.max(0, kilosEntregados - kilosFacturados);

      const invoices = (order.invoices ?? []).map(inv => {
        const st = inv.creditCycle?.status ?? 'pending';
        return {
          folio: inv.folio ?? '—',
          kilos: Number(inv.kilos) || 0,
          amount: inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0,
          cr: extractCr(inv, order),
          dueDate: toDate(inv.creditCycle?.dueDate),
          status: st,
          paid: st === 'paid' || st === 'collected',
          order,
        };
      });

      const totalVentaFacturada = invoices.reduce((acc, i) => acc + i.amount, 0);
      const allInvoicesPaid = invoices.length > 0 && invoices.every(i => i.paid);
      const allDelivered = kilosPedidos > 0 && kilosEntregados >= kilosPedidos - 0.01;

      let statusCategory: OcGroup['statusCategory'] = 'por_entregar';
      if (allDelivered && allInvoicesPaid) {
        statusCategory = 'completada';
      } else if (kilosPendientesFacturar > 0.01) {
        statusCategory = 'pendiente_factura';
      } else if (invoices.length > 0) {
        statusCategory = 'en_cobranza';
      } else {
        statusCategory = 'por_entregar';
      }

      list.push({
        oc: ocKey,
        order,
        kilosPedidos: round2(kilosPedidos),
        kilosEntregados: round2(kilosEntregados),
        kilosFaltantes: round2(kilosFaltantes),
        kilosFacturados: round2(kilosFacturados),
        kilosPendientesFacturar: round2(kilosPendientesFacturar),
        totalVentaFacturada: round2(totalVentaFacturada),
        statusCategory,
        invoices,
      });
    }

    return list.sort((a, b) => {
      if (a.oc === 'SIN-OC') return 1;
      if (b.oc === 'SIN-OC') return -1;
      return b.oc.localeCompare(a.oc);
    });
  }, [orders]);

  // Filtros de búsqueda y categoría
  const filteredGroups = useMemo(() => {
    let result = allOcGroups;

    if (filterState === 'por_entregar') {
      result = result.filter(g => g.statusCategory === 'por_entregar');
    } else if (filterState === 'pendiente_factura') {
      result = result.filter(g => g.statusCategory === 'pendiente_factura');
    } else if (filterState === 'en_cobranza') {
      result = result.filter(g => g.statusCategory === 'en_cobranza');
    } else if (filterState === 'completadas') {
      result = result.filter(g => g.statusCategory === 'completada');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g => 
        g.oc.toLowerCase().includes(q) ||
        (g.order.client?.toLowerCase() || '').includes(q) ||
        (g.order.folio?.toLowerCase() || '').includes(q) ||
        g.invoices.some(inv => inv.folio.toLowerCase().includes(q) || inv.cr.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allOcGroups, filterState, search]);

  const toggle = (oc: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(oc)) next.delete(oc);
      else next.add(oc);
      return next;
    });
  };

  // KPIs Totales Reales
  const kpis = useMemo(() => {
    const totalPedidos = allOcGroups.reduce((acc, g) => acc + g.kilosPedidos, 0);
    const totalEntregados = allOcGroups.reduce((acc, g) => acc + g.kilosEntregados, 0);
    const totalPendienteFacturar = allOcGroups.reduce((acc, g) => acc + g.kilosPendientesFacturar, 0);
    const totalFacturadoPesos = allOcGroups.reduce((acc, g) => acc + g.totalVentaFacturada, 0);
    const pctSurtido = totalPedidos > 0 ? Math.round((totalEntregados / totalPedidos) * 100) : 0;

    return {
      totalPedidos,
      totalEntregados,
      totalPendienteFacturar,
      totalFacturadoPesos,
      pctSurtido,
    };
  }, [allOcGroups]);

  function getManifiestoHtml(pendingOrders: OcGroup[]) {
    const totalPedidosGlobal = pendingOrders.reduce((acc, g) => acc + g.kilosPedidos, 0);
    const totalEntregadosGlobal = pendingOrders.reduce((acc, g) => acc + g.kilosEntregados, 0);
    const totalFaltantesGlobal = pendingOrders.reduce((acc, g) => acc + g.kilosFaltantes, 0);
    const globalPct = totalPedidosGlobal > 0 ? Math.round((totalEntregadosGlobal / totalPedidosGlobal) * 100) : 0;
    const provider = settings.providerName || 'Andrés';
    const client = settings.clientShortName || 'Providencia';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Manifiesto Analítico de Entregas — ${provider} a ${client}</title>
          <style>
            @page { size: letter portrait; margin: 12mm 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 15px; color: #0f172a; font-size: 12px; line-height: 1.4; background: #fff; }
            
            /* KPIs Grid */
            .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0 20px 0; }
            .kpi-tile { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; text-align: center; }
            .kpi-val { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 2px; }
            .kpi-lbl { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em; }

            /* OC Card Container */
            .oc-container { border: 1.5px solid #cbd5e1; border-radius: 10px; margin-bottom: 24px; overflow: hidden; page-break-inside: avoid; }
            .oc-header { background: #1e293b; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
            .oc-title { font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
            .badge-dept { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
            .badge-th { background: #3b82f6; color: #fff; }
            .badge-gt { background: #8b5cf6; color: #fff; }

            /* Partidas Table */
            table.partidas-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
            table.partidas-table th { background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.04em; padding: 8px 12px; border-bottom: 1px solid #cbd5e1; text-align: left; }
            table.partidas-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
            table.partidas-table tr:last-child td { border-bottom: none; }
            table.partidas-table tr:nth-child(even) { background-color: #fafaf9; }
            
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; }
            .badge-status { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
            .st-complete { background: #dcfce7; color: #15803d; }
            .st-partial { background: #fef3c7; color: #b45309; }
            .st-pending { background: #fee2e2; color: #b91c1c; }

            /* Bitácora de viajes */
            .remisiones-box { background: #f8fafc; border-top: 1px dashed #cbd5e1; padding: 8px 14px; font-size: 11px; color: #475569; }
            .remisiones-title { font-weight: 700; color: #1e293b; margin-bottom: 4px; text-transform: uppercase; font-size: 10px; }

            /* Progress Bar */
            .progress-bg { width: 60px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; display: inline-block; vertical-align: middle; margin-left: 6px; }
            .progress-fill { height: 100%; background: #10b981; border-radius: 3px; }

            /* Signatures */
            .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 40px; text-align: center; font-size: 11px; color: #334155; page-break-inside: avoid; }
            .sig-box { border-top: 1.5px solid #64748b; padding-top: 8px; font-weight: 700; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, `Manifiesto Analítico de Entregas — ${provider} a ${client}`)}
          
          <!-- KPIs Ejecutivos -->
          <div class="kpi-row">
            <div class="kpi-tile">
              <div class="kpi-val">${totalPedidosGlobal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</div>
              <div class="kpi-lbl">Total Pedido (OCs)</div>
            </div>
            <div class="kpi-tile">
              <div class="kpi-val" style="color: #059669;">${totalEntregadosGlobal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</div>
              <div class="kpi-lbl">Total Entregado (${globalPct}%)</div>
            </div>
            <div class="kpi-tile">
              <div class="kpi-val" style="color: ${totalFaltantesGlobal > 0 ? '#b91c1c' : '#059669'};">${totalFaltantesGlobal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</div>
              <div class="kpi-lbl">Por Surtir (Faltante)</div>
            </div>
            <div class="kpi-tile">
              <div class="kpi-val">${pendingOrders.length}</div>
              <div class="kpi-lbl">Órdenes Activas</div>
            </div>
          </div>

          <!-- Desglose por Orden de Compra y Partidas -->
          ${pendingOrders.map(g => {
            const order = g.order;
            const items = order.items && order.items.length > 0 ? order.items : [];
            const deliveries = order.deliveries || [];
            const { deliveredByItem } = computeDeliveredTotals(deliveries);
            const dept = inferDepartment(order) || (order.department?.toUpperCase().includes('TH') ? 'TH' : 'GT');
            const resp = dept === 'TH' ? 'Nava (Textil Hogar)' : 'Evelia (Grupo Textil / P4)';

            return `
              <div class="oc-container">
                <div class="oc-header">
                  <div class="oc-title">
                    <span class="badge-dept ${dept === 'TH' ? 'badge-th' : 'badge-gt'}">${dept}</span>
                    <span>OC: ${escapeHtml(g.oc)} · Folio: ${escapeHtml(order.folio || 'S/F')}</span>
                    <span style="font-size: 11px; font-weight: 500; opacity: 0.85;">(${resp})</span>
                  </div>
                  <div style="font-size: 12px; font-weight: 700;">
                    Avance: ${g.kilosEntregados.toLocaleString('es-MX')} / ${g.kilosPedidos.toLocaleString('es-MX')} kg (${g.kilosPedidos > 0 ? Math.round((g.kilosEntregados / g.kilosPedidos) * 100) : 0}%)
                  </div>
                </div>

                <!-- Tabla de Partidas -->
                <table class="partidas-table">
                  <thead>
                    <tr>
                      <th style="width: 140px;">Partida / SKU</th>
                      <th>Descripción / Medida del Producto</th>
                      <th class="num" style="width: 90px;">Pedido (kg)</th>
                      <th class="num" style="width: 95px;">Entregado (kg)</th>
                      <th class="num" style="width: 90px;">Faltante (kg)</th>
                      <th style="width: 110px; text-align: center;">Estatus Partida</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.length > 0 ? items.map((it, idx) => {
                      const pedKg = Number(it.quantity) || 0;
                      const entKg = deliveredByItem[it.id] ?? (items.length === 1 ? g.kilosEntregados : 0);
                      const faltKg = Math.max(0, pedKg - entKg);
                      const pctPartida = pedKg > 0 ? Math.min(100, Math.round((entKg / pedKg) * 100)) : 0;
                      const stClass = entKg >= pedKg && pedKg > 0 ? 'st-complete' : entKg > 0 ? 'st-partial' : 'st-pending';
                      const stLabel = entKg >= pedKg && pedKg > 0 ? '✅ 100% Surtido' : entKg > 0 ? `🟡 ${pctPartida}% Parcial` : '⏳ Pendiente';

                      return `
                        <tr>
                          <td><strong>#${idx + 1}</strong> · <span style="font-family: monospace; font-size: 11px;">${escapeHtml(it.code || 'S/C')}</span></td>
                          <td>${escapeHtml(it.description || 'Bolsa de Polietileno')}</td>
                          <td class="num"><strong>${pedKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
                          <td class="num" style="color: #059669; font-weight: 700;">${entKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td class="num" style="color: ${faltKg > 0 ? '#b91c1c' : '#059669'}; font-weight: 700;">${faltKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                          <td style="text-align: center;">
                            <span class="badge-status ${stClass}">${stLabel}</span>
                          </td>
                        </tr>
                      `;
                    }).join('') : `
                      <tr>
                        <td><strong>#1</strong> · <span style="font-family: monospace;">GENERAL</span></td>
                        <td>Bolsa de Polietileno (Partida Consolidada)</td>
                        <td class="num"><strong>${g.kilosPedidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
                        <td class="num" style="color: #059669; font-weight: 700;">${g.kilosEntregados.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td class="num" style="color: ${g.kilosFaltantes > 0 ? '#b91c1c' : '#059669'}; font-weight: 700;">${g.kilosFaltantes.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                        <td style="text-align: center;">
                          <span class="badge-status ${g.kilosEntregados >= g.kilosPedidos ? 'st-complete' : g.kilosEntregados > 0 ? 'st-partial' : 'st-pending'}">
                            ${g.kilosEntregados >= g.kilosPedidos ? '✅ Surtido' : g.kilosEntregados > 0 ? '🟡 Parcial' : '⏳ Pendiente'}
                          </span>
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>

                <!-- Bitácora de Entregas / Viajes de Báscula -->
                ${deliveries.length > 0 ? `
                  <div class="remisiones-box">
                    <div class="remisiones-title">🚚 Historial de Báscula / Remisiones (${deliveries.length} viaje${deliveries.length === 1 ? '' : 's'}):</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 14px;">
                      ${deliveries.map((d, i) => `
                        <div>
                          <strong>Viaje #${i + 1}:</strong> ${fmtDate(d.date) || 'S/F'} · <span style="color: #047857; font-weight: 700;">${(Number(d.kilos) || (d.items || []).reduce((a, x) => a + (Number(x.quantity) || 0), 0)).toLocaleString('es-MX')} kg</span>
                          ${d.notes ? ` <span style="color: #64748b;">(${escapeHtml(d.notes)})</span>` : ''}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}

          <!-- Cuadro de Firmas Oficial -->
          <div class="signatures">
            <div class="sig-box">
              Entrega & Báscula Fabricante<br>
              <span style="font-size: 10px; font-weight: normal; color: #64748b;">${provider}</span>
            </div>
            <div class="sig-box">
              Transportista / Chofer<br>
              <span style="font-size: 10px; font-weight: normal; color: #64748b;">Firma de Custodia</span>
            </div>
            <div class="sig-box">
              Recepción de Almacén<br>
              <span style="font-size: 10px; font-weight: normal; color: #64748b;">${client} (Nava / Evelia)</span>
            </div>
          </div>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
  }

  function printManifiesto() {
    const html = getManifiestoHtml(filteredGroups);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareManifiesto() {
    const html = getManifiestoHtml(filteredGroups);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Manifiesto_Logistica_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 240, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: '60%', height: 16 }} />
        </div>
        <div className="kpi-grid">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 92 }} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 56 }} />)}
        </div>
      </div>
    );
  }

  if (error) return <div className="alert bad">{error}</div>;

  return (
    <div className="page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Seguimiento por Orden de Compra (OC)</h1>
          <p>
            Control integral del flujo de entrega de {settings.providerName || 'Andrés'} a {settings.clientShortName || 'Providencia'}: Kilos pedidos, kilos entregados en planta, facturas emitidas y contrarecibos de cobro.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareManifiesto}>
            <span className="icon">📤</span> Compartir PDF
          </button>
          <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printManifiesto}>
            📈 Imprimir Manifiesto
          </button>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            <button className={`btn ${view === 'lista' ? 'btn-primary' : ''}`} onClick={() => setView('lista')}>☰ Lista</button>
            <button className={`btn ${view === 'tablero' ? 'btn-primary' : ''}`} onClick={() => setView('tablero')}>🗂️ Tablero</button>
          </div>
        </div>
      </div>

      {/* KPIs Reales */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KpiCard label="Órdenes de Compra" value={String(allOcGroups.length)} />
        <KpiCard label="Kilos Pedidos" value={`${kpis.totalPedidos.toLocaleString('es-MX')} kg`} />
        <KpiCard label="Kilos Surtidos" value={`${kpis.totalEntregados.toLocaleString('es-MX')} kg (${kpis.pctSurtido}%)`} tone="ok" />
        <KpiCard label="Total Facturado" value={money(kpis.totalFacturadoPesos)} tone="cash" />
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`tab ${filterState === 'todas' ? 'active' : ''}`}
            onClick={() => setFilterState('todas')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            🌟 Todas ({allOcGroups.length})
          </button>
          <button
            className={`tab ${filterState === 'por_entregar' ? 'active' : ''}`}
            onClick={() => setFilterState('por_entregar')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            🚚 Por Entregar ({allOcGroups.filter(g => g.statusCategory === 'por_entregar').length})
          </button>
          <button
            className={`tab ${filterState === 'pendiente_factura' ? 'active' : ''}`}
            onClick={() => setFilterState('pendiente_factura')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            📦 Por Facturar ({allOcGroups.filter(g => g.statusCategory === 'pendiente_factura').length})
          </button>
          <button
            className={`tab ${filterState === 'en_cobranza' ? 'active' : ''}`}
            onClick={() => setFilterState('en_cobranza')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            ⏳ En Cobranza ({allOcGroups.filter(g => g.statusCategory === 'en_cobranza').length})
          </button>
          <button
            className={`tab ${filterState === 'completadas' ? 'active' : ''}`}
            onClick={() => setFilterState('completadas')}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            ✅ Completadas ({allOcGroups.filter(g => g.statusCategory === 'completada').length})
          </button>
        </div>

        <input
          type="text"
          className="input boxed"
          placeholder="🔍 Buscar OC, folio, cliente o factura..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300, fontSize: 12 }}
        />
      </div>

      {/* Vista de Tablero o Lista */}
      {view === 'tablero' ? (
        <EntregasKanban orders={orders} onSelect={setSelectedOrder} />
      ) : filteredGroups.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">📦</span>
          <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>No se encontraron órdenes</strong>
          No hay órdenes de compra que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredGroups.map(group => {
            const isOpen = expanded.has(group.oc);
            const paidCount = group.invoices.filter(i => i.paid).length;
            const allPaid = group.invoices.length > 0 && paidCount === group.invoices.length;
            const nonePaid = paidCount === 0;

            let statusColor = '#3b82f6';
            let statusLabel = '📝 En Producción / Por Entregar';

            if (group.statusCategory === 'completada') {
              statusColor = 'var(--ok)';
              statusLabel = '✅ Entregada y Cobrada';
            } else if (group.statusCategory === 'pendiente_factura') {
              statusColor = 'var(--warn)';
              statusLabel = `📦 ${group.kilosPendientesFacturar.toLocaleString('es-MX')} kg listos para Facturar`;
            } else if (group.statusCategory === 'en_cobranza') {
              statusColor = allPaid ? 'var(--ok)' : nonePaid ? 'var(--bad)' : 'var(--warn)';
              statusLabel = allPaid ? '✅ Cobrada' : `🟡 En Cobranza (${paidCount}/${group.invoices.length} facturas pagadas)`;
            }

            return (
              <div
                key={group.oc}
                style={{
                  background: 'var(--glass-bg, #ffffff)',
                  border: '1px solid var(--glass-border, var(--border))',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: 'var(--glass-shadow, 0 1px 3px rgba(0,0,0,0.05))',
                }}
              >
                {/* Cabecera del grupo */}
                <div
                  onClick={() => toggle(group.oc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{isOpen ? '▼' : '▶'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>OC: {group.oc}</span>
                      <span style={{ color: 'var(--ink-soft)', fontWeight: 500, fontSize: 13 }}>
                        {nombreClienteVisible(group.order.client)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ background: 'var(--paper-sunk)', padding: '4px 8px', borderRadius: 6 }}>
                        <span style={{ color: 'var(--ink-soft)' }}>Pedida:</span> <strong>{group.kilosPedidos.toLocaleString('es-MX')} kg</strong>
                      </div>
                      <div style={{ background: 'var(--paper-sunk)', padding: '4px 8px', borderRadius: 6 }}>
                        <span style={{ color: group.kilosEntregados >= group.kilosPedidos && group.kilosPedidos > 0 ? 'var(--ok)' : 'var(--ink)' }}>Entregada:</span>{' '}
                        <strong style={{ color: group.kilosEntregados > 0 ? 'var(--ok)' : 'inherit' }}>
                          {group.kilosEntregados.toLocaleString('es-MX')} kg
                        </strong>
                      </div>
                      <div style={{ background: 'var(--paper-sunk)', padding: '4px 8px', borderRadius: 6 }}>
                        <span style={{ color: group.kilosFaltantes > 0 ? 'var(--warn)' : 'var(--ok)' }}>Por Surtir:</span>{' '}
                        <strong style={{ color: group.kilosFaltantes > 0 ? 'var(--warn)' : 'var(--ok)' }}>
                          {group.kilosFaltantes.toLocaleString('es-MX')} kg
                        </strong>
                      </div>
                      <div style={{ background: 'var(--paper-sunk)', padding: '4px 8px', borderRadius: 6 }}>
                        <span style={{ color: 'var(--ink-soft)' }}>Facturada:</span> <strong>{group.kilosFacturados.toLocaleString('es-MX')} kg</strong>
                      </div>
                      {group.kilosPendientesFacturar > 0.01 && (
                        <div style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', padding: '4px 8px', borderRadius: 6, fontWeight: 700 }}>
                          ⚡ Por Facturar: {group.kilosPendientesFacturar.toLocaleString('es-MX')} kg
                        </div>
                      )}
                    </div>

                    {group.kilosPedidos > 0 && (
                      <div style={{ marginTop: 10, maxWidth: 360 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'var(--ink-soft)', fontWeight: 600 }}>
                          <span>Avance de Entrega</span>
                          <span>{Math.min(100, Math.round((group.kilosEntregados / group.kilosPedidos) * 100))}%</span>
                        </div>
                        <ProgressBar current={group.kilosEntregados} max={group.kilosPedidos} color={group.kilosEntregados >= group.kilosPedidos ? 'var(--ok)' : 'var(--accent)'} />
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monto Facturado</div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>{money(group.totalVentaFacturada)}</div>
                    <div style={{ fontSize: 11, color: statusColor, marginTop: 4, fontWeight: 700, background: 'var(--paper-sunk)', padding: '2px 8px', borderRadius: 10, display: 'inline-block' }}>
                      {statusLabel}
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '6px 12px', marginLeft: 12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(group.order);
                    }}
                  >
                    📂 Ver Expediente
                  </button>
                </div>

                {/* Detalle de facturas expandibles */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ borderTop: '1px solid var(--border)', overflow: 'hidden' }}
                    >
                      {group.invoices.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-soft)' }}>
                          📝 No hay facturas emitidas todavía para esta OC.<br/>
                          <button
                            className="btn btn-primary"
                            style={{ marginTop: 8, fontSize: 12 }}
                            onClick={() => setSelectedOrder(group.order)}
                          >
                            + Facturar en Expediente
                          </button>
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'var(--paper-sunk)' }}>
                              <th style={{ padding: '8px 18px', textAlign: 'left' }}>Factura</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Kilos</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Monto con IVA</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Contrarecibo</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Vencimiento</th>
                              <th style={{ padding: '8px 18px', textAlign: 'center' }}>Estatus</th>
                              <th style={{ padding: '8px 18px', textAlign: 'center' }}>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.invoices
                              .sort((a, b) => parseInt(a.folio) - parseInt(b.folio))
                              .map((inv, idx) => (
                                <tr
                                  key={idx}
                                  style={{ borderTop: '1px solid var(--line-soft)', cursor: 'pointer' }}
                                  onClick={() => setSelectedOrder(inv.order)}
                                >
                                  <td style={{ padding: '10px 18px', fontFamily: 'monospace', fontWeight: 700 }}>
                                    #{inv.folio}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                                    {inv.kilos.toLocaleString('es-MX')} kg
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                                    {money(inv.amount)}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12 }}>
                                    {inv.cr ? <strong>{inv.cr}</strong> : <span style={{ color: 'var(--warn)' }}>⏳ Sin CR</span>}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
                                    {inv.dueDate
                                      ? inv.dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                      : '—'}
                                  </td>
                                  <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                                    {inv.status === 'collected' ? (
                                      <span className="badge" style={{ background: 'var(--ok)', color: '#fff' }}>✅ En Caja</span>
                                    ) : inv.status === 'paid' ? (
                                      <span className="badge" style={{ background: '#0284c7', color: '#fff' }}>🟡 Con Contador</span>
                                    ) : (
                                      <span className="badge" style={{ background: 'var(--warn)', color: '#fff' }}>🔴 Por Cobrar</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                                    <button
                                      className="btn"
                                      style={{ fontSize: 11, padding: '3px 8px' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrder(inv.order);
                                      }}
                                    >
                                      ✏️ Ver
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderModal
          order={orders.find(o => o.id === selectedOrder.id) ?? selectedOrder}
          config={config}
          onClose={() => setSelectedOrder(null)}
          initialTab="facturas"
        />
      )}
    </div>
  );
}
