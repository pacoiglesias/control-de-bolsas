import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import OrderModal from '../components/OrderModal';
import { EntregasKanban } from '../components/OcTracking/EntregasKanban';
import { KpiCard, Skeleton, ProgressBar } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { escapeHtml, money, getPrintHeaderHtml, shareHtmlAsPdf, nombreClienteVisible, toDate } from '../lib/format';
import { getOrderSummary, round2, extractCr } from '../lib/finance';
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
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Manifiesto de Entregas</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .check-box { width: 20px; height: 20px; border: 2px solid #cbd5e1; border-radius: 4px; display: inline-block; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 250px; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, `Manifiesto de Entregas Logística - ${settings.providerName || 'Andrés'} a ${settings.clientShortName || 'Providencia'}`)}
          
          <h3 style="margin-top: 20px;">Órdenes de Compra (${pendingOrders.length})</h3>
          <table>
            <thead>
              <tr>
                <th>OC / Folio</th><th>Cliente</th><th class="num">Pedida (kg)</th><th class="num">Entregada (kg)</th><th class="num">Por Surtir (kg)</th><th style="width: 80px; text-align: center;">Firma Recepción</th>
              </tr>
            </thead>
            <tbody>
              ${pendingOrders.length > 0 ? pendingOrders.map(g => `
                <tr>
                  <td><strong>${escapeHtml(g.oc)}</strong></td>
                  <td>${escapeHtml(g.order.client || '—')}</td>
                  <td class="num">${g.kilosPedidos.toLocaleString('es-MX')}</td>
                  <td class="num" style="color: #059669; font-weight: bold;">${g.kilosEntregados.toLocaleString('es-MX')}</td>
                  <td class="num" style="color: ${g.kilosFaltantes > 0 ? '#b91c1c' : '#059669'}; font-weight: bold;">${g.kilosFaltantes > 0 ? g.kilosFaltantes.toLocaleString('es-MX') : '0'}</td>
                  <td style="text-align: center;"><div class="check-box"></div></td>
                </tr>
              `).join('') : '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay órdenes seleccionadas</td></tr>'}
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-box">Firma Fabricante (${settings.providerName || 'Andrés'})</div>
            <div class="sig-box">Firma Recepción (${settings.clientShortName || 'Providencia'})</div>
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
