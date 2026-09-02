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
import { RegistrarEntregaModal } from '../components/Compras/OrderModals';
import { openWhatsAppMessage, openEmailMessage } from '../lib/whatsappReminder';
import { CashFlowForecastWidget } from '../components/Cobranza/CashFlowForecastWidget';
import { generateDeliveryRemissionPdf } from '../lib/deliveryRemissionPdf';
import { triggerHaptic } from '../lib/hapticEngine';
import type { TabName } from '../components/OrderModal/types';
import type { PurchaseOrder, Invoice, Delivery } from '../lib/types';

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
  const [selectedOrderTab, setSelectedOrderTab] = useState<TabName>('facturas');
  const [orderParaEntrega, setOrderParaEntrega] = useState<PurchaseOrder | null>(null);
  const [view, setView] = useState<'lista' | 'tablero'>('lista');
  const [plantFilter, setPlantFilter] = useState<'ALL' | 'TH' | 'GT'>('ALL');
  const [scope, setScope] = useState<'activas' | 'cerradas' | 'todas'>('activas');
  const [subFilter, setSubFilter] = useState<'todas' | 'por_entregar' | 'pendiente_factura' | 'en_cobranza'>('todas');
  const [search, setSearch] = useState('');

  // Agrupación y cálculo financiero/operativo sin duplicados
  const allOcGroups = useMemo<OcGroup[]>(() => {
    // Agrupar órdenes por su clave canónica de OC
    const ocMap = new Map<string, PurchaseOrder[]>();

    for (const order of orders) {
      if (!order || (order as any).isDeleted) continue;
      const rawOc = (order.oc || order.folio || order.id).trim();
      const rawFolio = (order.folio || '').trim().toUpperCase();
      const ocKey = rawOc.toUpperCase();

      // Excluir expediente obsoleto de prueba 120267114014
      if (ocKey === '120267114014' || rawFolio === '120267114014' || rawFolio === '6167') continue;

      // Excluir expedientes cuyo identificador es exclusivamente un Contrarecibo (viven en Cobranza)
      if (ocKey.startsWith('TH-') || ocKey.startsWith('GT-') || rawFolio.startsWith('TH-') || rawFolio.startsWith('GT-')) continue;
      
      const existing = ocMap.get(ocKey) || [];
      existing.push(order);
      ocMap.set(ocKey, existing);
    }

    const list: OcGroup[] = [];

    for (const [ocKey, groupOrders] of ocMap.entries()) {
      // Tomar la orden más completa
      const primaryOrder = groupOrders.reduce((best, curr) => {
        const bestScore = (best.items?.length || 0) * 10 + (best.invoices?.length || 0) * 5 + (best.deliveries?.length || 0);
        const currScore = (curr.items?.length || 0) * 10 + (curr.invoices?.length || 0) * 5 + (curr.deliveries?.length || 0);
        return currScore > bestScore ? curr : best;
      }, groupOrders[0]);

      // Fusionar facturas y entregas sin duplicados
      const allInvoicesRaw: Invoice[] = [];
      const invoiceFolioSet = new Set<string>();
      for (const ord of groupOrders) {
        for (const inv of ord.invoices || []) {
          const key = (inv.folio || inv.id || '').toUpperCase().trim();
          if (key && !invoiceFolioSet.has(key)) {
            invoiceFolioSet.add(key);
            allInvoicesRaw.push(inv);
          }
        }
      }

      const allDeliveriesRaw: Delivery[] = [];
      const deliveryIdSet = new Set<string>();
      for (const ord of groupOrders) {
        for (const del of ord.deliveries || []) {
          const key = (del.id || `${del.kilos}-${del.date}`).trim();
          if (key && !deliveryIdSet.has(key)) {
            deliveryIdSet.add(key);
            allDeliveriesRaw.push(del);
          }
        }
      }

      const mergedOrder: PurchaseOrder = {
        ...primaryOrder,
        invoices: allInvoicesRaw.length > 0 ? allInvoicesRaw : primaryOrder.invoices,
        deliveries: allDeliveriesRaw.length > 0 ? allDeliveriesRaw : primaryOrder.deliveries,
      };

      const summary = getOrderSummary(mergedOrder);
      const itemsKg = (mergedOrder.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0);
      const kilosPedidos = itemsKg > 0 ? itemsKg : (Number(mergedOrder.totalKilograms ?? 0) || Number(summary.kilosDelivered ?? 0));
      const kilosEntregados = Number(summary.kilosDelivered ?? 0);
      const kilosFaltantes = mergedOrder.isClosedShort ? 0 : Math.max(0, kilosPedidos - kilosEntregados);
      const kilosFacturados = Number(summary.kilosInvoiced ?? 0);
      const kilosPendientesFacturar = (mergedOrder.isClosedShort && kilosFacturados >= kilosEntregados - 0.05) ? 0 : Math.max(0, kilosEntregados - kilosFacturados);

      const invoices = (mergedOrder.invoices ?? []).map(inv => {
        const st = inv.creditCycle?.status ?? 'pending';
        return {
          folio: inv.folio ?? '—',
          kilos: Number(inv.kilos) || 0,
          amount: inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0,
          cr: extractCr(inv, mergedOrder),
          dueDate: toDate(inv.creditCycle?.dueDate),
          status: st,
          paid: st === 'paid' || st === 'collected',
          order: mergedOrder,
        };
      });

      const totalVentaFacturada = invoices.reduce((acc, i) => acc + i.amount, 0);
      const allInvoicesPaid = invoices.length > 0 && invoices.every(i => i.paid || i.status === 'collected' || i.status === 'paid');
      const allDelivered = (kilosPedidos > 0 && kilosEntregados >= kilosPedidos - 0.01) || (kilosPedidos === 0 && kilosEntregados > 0);
      const isCompleted = (summary.status === 'collected' || summary.status === 'paid') && allInvoicesPaid && (allDelivered || kilosFaltantes <= 0.01 || Boolean(mergedOrder.isClosedShort));

      let statusCategory: OcGroup['statusCategory'] = 'en_cobranza';
      if (isCompleted) {
        statusCategory = 'completada';
      } else if (kilosFaltantes > 0.01 && !mergedOrder.isClosedShort) {
        statusCategory = 'por_entregar';
      } else if (kilosPendientesFacturar > 0.01) {
        statusCategory = 'pendiente_factura';
      } else if (invoices.length > 0 && !allInvoicesPaid) {
        statusCategory = 'en_cobranza';
      } else {
        statusCategory = 'completada';
      }

      list.push({
        oc: primaryOrder.oc || primaryOrder.folio || ocKey,
        order: mergedOrder,
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

  // Grupos filtrados por planta, ámbito y búsqueda
  const { plantGroups, openGroups, closedGroups, filteredGroups } = useMemo(() => {
    let base = allOcGroups;

    if (plantFilter !== 'ALL') {
      base = base.filter(g => {
        const d = inferDepartment(g.order) || (g.order.department?.toUpperCase().includes('TH') ? 'TH' : g.order.department?.toUpperCase().includes('GT') ? 'GT' : null);
        return d === plantFilter;
      });
    }

    const plantBase = base;

    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(g => 
        g.oc.toLowerCase().includes(q) ||
        (g.order.client?.toLowerCase() || '').includes(q) ||
        (g.order.folio?.toLowerCase() || '').includes(q) ||
        g.invoices.some(inv => inv.folio.toLowerCase().includes(q) || inv.cr.toLowerCase().includes(q))
      );
    }

    const open = base.filter(g => g.statusCategory !== 'completada');
    const closed = base.filter(g => g.statusCategory === 'completada');

    let current: OcGroup[] = [];
    if (scope === 'activas') {
      current = open;
      if (subFilter !== 'todas') {
        current = current.filter(g => g.statusCategory === subFilter);
      }
    } else if (scope === 'cerradas') {
      current = closed;
    } else {
      current = base;
    }

    return {
      plantGroups: plantBase,
      openGroups: open,
      closedGroups: closed,
      filteredGroups: current,
    };
  }, [allOcGroups, plantFilter, scope, subFilter, search]);

  // KPIs Totales Reales (Sincronizados con la planta seleccionada)
  const kpis = useMemo(() => {
    const totalPedidos = plantGroups.reduce((acc, g) => acc + g.kilosPedidos, 0);
    const totalEntregados = plantGroups.reduce((acc, g) => acc + g.kilosEntregados, 0);
    const totalPendienteFacturar = plantGroups.reduce((acc, g) => acc + g.kilosPendientesFacturar, 0);
    const totalFacturadoPesos = plantGroups.reduce((acc, g) => acc + g.totalVentaFacturada, 0);
    const pctSurtido = totalPedidos > 0 ? Math.round((totalEntregados / totalPedidos) * 100) : 0;

    return {
      totalPedidos,
      totalEntregados,
      totalPendienteFacturar,
      totalFacturadoPesos,
      pctSurtido,
    };
  }, [plantGroups]);

  function handleShareOcWhatsApp(group: OcGroup) {
    const dept = inferDepartment(group.order) || (group.order.department?.toUpperCase().includes('TH') ? 'TH' : 'GT');
    const deptName = dept === 'TH' ? 'Textil Hogar (Nava)' : 'Grupo Textil (Evelia)';
    const pct = group.kilosPedidos > 0 ? Math.round((group.kilosEntregados / group.kilosPedidos) * 100) : 0;
    const items = group.order.items || [];
    const deliveries = group.order.deliveries || [];
    const { deliveredByItem } = computeDeliveredTotals(deliveries, items);

    let text = `📦 *REPORTE DE ENTREGA — OC ${group.oc}*\n`;
    text += `🏢 *Planta:* ${deptName} · Folio: ${group.order.folio || 'S/F'}\n`;
    text += `📊 *Avance Global:* ${group.kilosEntregados.toLocaleString('es-MX')} / ${group.kilosPedidos.toLocaleString('es-MX')} kg (${pct}%)\n`;
    text += `⏳ *Por Surtir:* ${group.kilosFaltantes.toLocaleString('es-MX')} kg\n\n`;

    if (items.length > 0) {
      text += `📋 *DESGLOSE DE PARTIDAS:*\n`;
      items.forEach((it, idx) => {
        const ped = Number(it.quantity) || 0;
        const ent = deliveredByItem[it.id] ?? (it.code ? deliveredByItem[it.code] : undefined) ?? (items.length === 1 ? group.kilosEntregados : (it.deliveredQuantity ?? 0));
        const falt = Math.max(0, ped - ent);
        const st = ent >= ped && ped > 0 ? '✅ 100%' : ent > 0 ? `🟡 Parcial (${ent}/${ped} kg)` : '⏳ Pendiente';
        text += `• #${idx + 1} ${it.description || it.code || 'Bolsa'}: ${ent}/${ped} kg (Faltan: ${falt} kg · ${st})\n`;
      });
      text += `\n`;
    }

    if (group.invoices.length > 0) {
      text += `📑 *FACTURAS & CONTRARECIBOS:*\n`;
      group.invoices.forEach(inv => {
        text += `• Fac #${inv.folio}: ${inv.kilos} kg | CR: ${inv.cr || 'Sin CR'} | ${inv.status === 'collected' ? '✅ En Caja' : inv.status === 'paid' ? '🟡 Con Contador' : '⏳ Por Cobrar'}\n`;
      });
    }

    openWhatsAppMessage(text);
    toast(`📲 Abriendo WhatsApp con el estatus de la OC ${group.oc}`, 'ok');
  }

  function handleShareOcEmail(group: OcGroup) {
    const dept = inferDepartment(group.order) || (group.order.department?.toUpperCase().includes('TH') ? 'TH' : 'GT');
    const deptName = dept === 'TH' ? 'Textil Hogar (Nava)' : 'Grupo Textil (Evelia)';
    const pct = group.kilosPedidos > 0 ? Math.round((group.kilosEntregados / group.kilosPedidos) * 100) : 0;
    const items = group.order.items || [];
    const deliveries = group.order.deliveries || [];
    const { deliveredByItem } = computeDeliveredTotals(deliveries, items);

    const subject = `Estatus de Entrega y Fabricación — OC ${group.oc} — ${deptName}`;
    let body = `Estimado equipo,\n\n`;
    body += `Compartimos el reporte oficial de avance de la Orden de Compra ${group.oc}:\n\n`;
    body += `• Planta / Almacén: ${deptName}\n`;
    body += `• Folio Interno: ${group.order.folio || 'S/F'}\n`;
    body += `• Avance Global: ${group.kilosEntregados.toLocaleString('es-MX')} de ${group.kilosPedidos.toLocaleString('es-MX')} kg (${pct}% completado)\n`;
    body += `• Kilos Pendientes por Surtir: ${group.kilosFaltantes.toLocaleString('es-MX')} kg\n\n`;

    if (items.length > 0) {
      body += `DESGLOSE DE PARTIDAS:\n`;
      items.forEach((it, idx) => {
        const ped = Number(it.quantity) || 0;
        const ent = deliveredByItem[it.id] ?? (it.code ? deliveredByItem[it.code] : undefined) ?? (items.length === 1 ? group.kilosEntregados : (it.deliveredQuantity ?? 0));
        const falt = Math.max(0, ped - ent);
        const st = ent >= ped && ped > 0 ? 'Completada 100%' : ent > 0 ? `Parcial (${ent}/${ped} kg)` : 'Pendiente';
        body += `• Partida #${idx + 1} ${it.description || it.code || 'Bolsa'}: ${ent}/${ped} kg (Faltan: ${falt} kg — ${st})\n`;
      });
      body += `\n`;
    }

    if (group.invoices.length > 0) {
      body += `FACTURAS Y CONTRARECIBOS:\n`;
      group.invoices.forEach(inv => {
        body += `• Factura #${inv.folio}: ${inv.kilos} kg | Contrarecibo: ${inv.cr || 'Pendiente'}\n`;
      });
      body += `\n`;
    }

    body += `Quedamos atentos a cualquier solicitud.\n\nAtentamente,\nControl de Bolsas ERP`;

    openEmailMessage(subject, body);
    toast(`📧 Abriendo cliente de correo con el estatus de la OC ${group.oc}`, 'ok');
  }

  const toggle = (oc: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(oc)) next.delete(oc);
      else next.add(oc);
      return next;
    });
  };

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
            const { deliveredByItem } = computeDeliveredTotals(deliveries, items);
            const dept = inferDepartment(order) || (order.department?.toUpperCase().includes('TH') ? 'TH' : order.department?.toUpperCase().includes('GT') ? 'GT' : 'TH');
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
    triggerHaptic('light');
    const html = getManifiestoHtml(filteredGroups);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Manifiesto_Logistica_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function handleDownloadValePdf(group: OcGroup, delivery: Delivery) {
    triggerHaptic('success');
    const pdfDoc = generateDeliveryRemissionPdf({
      folioRemision: delivery.id || `REM-${group.oc}`,
      oc: group.oc,
      client: nombreClienteVisible(group.order.client) || 'Grupo Textil Providencia SA de CV',
      department: group.order.department || 'Planta P4 / Almacén',
      date: delivery.date ? toDate(delivery.date) : new Date(),
      providerName: settings.providerName || 'Andrés',
      driverName: (delivery as any).driverName || 'Transporte Especializado',
      truckPlates: (delivery as any).truckPlates || 'Placas en Tránsito',
      totalBags: (delivery as any).bags,
      totalKilograms: delivery.kilos,
      notes: delivery.notes,
      items: (group.order.items || []).map((it) => ({
        code: it.code,
        description: it.description || 'Bolsa de Polietileno',
        quantity: delivery.kilos,
        bags: (delivery as any).bags,
      })),
    });

    pdfDoc.save(`Vale_Bascula_OC_${group.oc}_${delivery.kilos}kg.pdf`);
    toast('📄 Vale de Báscula generado en PDF', 'ok');
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

      {/* WIDGET DE PROYECCIÓN SEMANAL DE FLUJO DE EFECTIVO */}
      <CashFlowForecastWidget orders={orders} />

      {/* Selector de Planta Providencia */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', background: 'var(--paper-sunk)', padding: 4, borderRadius: 12, border: '1px solid var(--line-soft)' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-soft)', paddingLeft: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏢 PLANTA:</span>
          <button
            className={`btn-small ${plantFilter === 'ALL' ? 'btn-primary' : ''}`}
            onClick={() => setPlantFilter('ALL')}
            style={{
              minHeight: 34,
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: plantFilter === 'ALL' ? 800 : 600,
              background: plantFilter === 'ALL' ? 'var(--accent)' : 'transparent',
              color: plantFilter === 'ALL' ? '#fff' : 'var(--ink)',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🌟 Ambas ({allOcGroups.length})
          </button>
          <button
            className={`btn-small ${plantFilter === 'TH' ? 'btn-primary' : ''}`}
            onClick={() => setPlantFilter('TH')}
            style={{
              minHeight: 34,
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: plantFilter === 'TH' ? 800 : 600,
              background: plantFilter === 'TH' ? '#2563eb' : 'transparent',
              color: plantFilter === 'TH' ? '#fff' : '#2563eb',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🟦 TH · Nava ({allOcGroups.filter(g => inferDepartment(g.order) === 'TH' || (g.order.department?.toUpperCase().includes('TH'))).length})
          </button>
          <button
            className={`btn-small ${plantFilter === 'GT' ? 'btn-primary' : ''}`}
            onClick={() => setPlantFilter('GT')}
            style={{
              minHeight: 34,
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: plantFilter === 'GT' ? 800 : 600,
              background: plantFilter === 'GT' ? '#7c3aed' : 'transparent',
              color: plantFilter === 'GT' ? '#fff' : '#7c3aed',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            🟪 GT · Evelia ({allOcGroups.filter(g => inferDepartment(g.order) === 'GT' || (g.order.department?.toUpperCase().includes('GT'))).length})
          </button>
        </div>

        <input
          type="text"
          className="input boxed"
          placeholder="🔍 Buscar OC, folio, cliente, SKU o CR..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            minHeight: 40,
            maxWidth: 320,
            fontSize: 12.5,
            borderRadius: 10,
            border: '1px solid var(--line)',
            padding: '8px 14px',
          }}
        />
      </div>

      {/* KPIs Reales Interactivos */}
      <div className="kpi-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => { setScope('activas'); setSubFilter('todas'); }}>
          <KpiCard label="Órdenes Activas" value={`${openGroups.length} de ${allOcGroups.length}`} tone="cash" />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => { setScope('activas'); setSubFilter('por_entregar'); }}>
          <KpiCard label="Kilos por Surtir" value={`${openGroups.reduce((a, g) => a + g.kilosFaltantes, 0).toLocaleString('es-MX')} kg`} tone="bad" />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => { setScope('activas'); setSubFilter('pendiente_factura'); }}>
          <KpiCard label="Kilos por Facturar" value={`${kpis.totalPendienteFacturar.toLocaleString('es-MX')} kg`} tone="warn" />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => setScope('todas')}>
          <KpiCard 
            label="💵 Flujo Neto en Caja ($8.44/kg)" 
            value={money(filteredGroups.reduce((a, g) => a + g.kilosEntregados * 8.44, 0))} 
            sub={`Total Cartera: ${money(filteredGroups.reduce((a, g) => a + g.kilosPedidos * 8.44, 0))}`}
            tone="ok" 
          />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => setScope('todas')}>
          <KpiCard label="Total Facturado" value={money(kpis.totalFacturadoPesos)} tone="cash" />
        </div>
      </div>

      {/* Pestañas Principales de Segmentación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`tab ${scope === 'activas' ? 'active' : ''}`}
            onClick={() => setScope('activas')}
            style={{ fontSize: 13, padding: '8px 16px', fontWeight: 800 }}
          >
            🚚 En Proceso / Sin Cerrar ({openGroups.length})
          </button>
          <button
            className={`tab ${scope === 'cerradas' ? 'active' : ''}`}
            onClick={() => setScope('cerradas')}
            style={{ fontSize: 13, padding: '8px 16px', fontWeight: 800 }}
          >
            ✅ Cerradas / Histórico ({closedGroups.length})
          </button>
          <button
            className={`tab ${scope === 'todas' ? 'active' : ''}`}
            onClick={() => setScope('todas')}
            style={{ fontSize: 13, padding: '8px 16px', fontWeight: 800 }}
          >
            🌟 Ambas Secciones ({openGroups.length + closedGroups.length})
          </button>
        </div>
      </div>

      {/* Subfiltros operativos para órdenes en proceso */}
      {scope === 'activas' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, background: 'var(--paper-sunk)', padding: '6px 10px', borderRadius: 10, width: 'fit-content' }}>
          <button
            className={`btn-small ${subFilter === 'todas' ? 'btn-primary' : ''}`}
            onClick={() => setSubFilter('todas')}
            style={{ fontSize: 11.5 }}
          >
            🌟 Todas las Activas ({openGroups.length})
          </button>
          <button
            className={`btn-small ${subFilter === 'por_entregar' ? 'btn-primary' : ''}`}
            onClick={() => setSubFilter('por_entregar')}
            style={{ fontSize: 11.5 }}
          >
            🚚 Kilos por Entregar ({openGroups.filter(g => g.statusCategory === 'por_entregar').length})
          </button>
          <button
            className={`btn-small ${subFilter === 'pendiente_factura' ? 'btn-primary' : ''}`}
            onClick={() => setSubFilter('pendiente_factura')}
            style={{ fontSize: 11.5 }}
          >
            📦 Listas para Facturar ({openGroups.filter(g => g.statusCategory === 'pendiente_factura').length})
          </button>
          <button
            className={`btn-small ${subFilter === 'en_cobranza' ? 'btn-primary' : ''}`}
            onClick={() => setSubFilter('en_cobranza')}
            style={{ fontSize: 11.5 }}
          >
            ⏳ En Cobranza / Contrarecibo ({openGroups.filter(g => g.statusCategory === 'en_cobranza').length})
          </button>
        </div>
      )}

      {/* Vista de Tablero o Lista */}
      {view === 'tablero' ? (
        <EntregasKanban orders={filteredGroups.map(g => g.order)} onSelect={setSelectedOrder} />
      ) : filteredGroups.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">📦</span>
          <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>No se encontraron órdenes</strong>
          No hay órdenes de compra que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredGroups.map(group => {
            const isOpen = expanded.has(group.oc);
            const paidCount = group.invoices.filter(i => i.paid).length;
            const allPaid = group.invoices.length > 0 && paidCount === group.invoices.length;
            const nonePaid = paidCount === 0;
            const dept = inferDepartment(group.order) || (group.order.department?.toUpperCase().includes('TH') ? 'TH' : 'GT');

            let statusColor = '#3b82f6';
            let statusLabel = '📝 En Producción / Por Entregar';

            if (group.statusCategory === 'completada') {
              statusColor = 'var(--ok)';
              statusLabel = '✅ Entregada y Cobrada al 100%';
            } else if (group.statusCategory === 'por_entregar') {
              statusColor = '#d97706';
              statusLabel = `🚚 Faltan ${group.kilosFaltantes.toLocaleString('es-MX')} kg por surtir`;
            } else if (group.statusCategory === 'pendiente_factura') {
              statusColor = 'var(--warn)';
              statusLabel = `📦 ${group.kilosPendientesFacturar.toLocaleString('es-MX')} kg listos para Facturar`;
            } else if (group.statusCategory === 'en_cobranza') {
              statusColor = allPaid ? 'var(--ok)' : nonePaid ? 'var(--bad)' : 'var(--warn)';
              statusLabel = allPaid ? '✅ Cobrada' : `🟡 En Cobranza (${paidCount}/${group.invoices.length} facturas pagadas)`;
            }

            const items = group.order.items || [];
            const deliveries = group.order.deliveries || [];
            const { deliveredByItem } = computeDeliveredTotals(deliveries, items);

            return (
              <div
                key={group.oc}
                style={{
                  background: 'var(--glass-bg, #ffffff)',
                  border: group.statusCategory === 'completada' ? '1px solid var(--border)' : '1.5px solid var(--accent)',
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
                    gap: 14,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: group.statusCategory === 'completada' ? 'transparent' : 'rgba(59, 130, 246, 0.02)',
                  }}
                >
                  <span style={{ fontSize: 16, color: 'var(--ink-soft)' }}>{isOpen ? '▼' : '▶'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${dept === 'TH' ? 'badge-th' : 'badge-gt'}`} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 800, background: dept === 'TH' ? '#3b82f6' : '#8b5cf6', color: '#fff' }}>
                        {dept}
                      </span>
                      <span>OC: {group.oc}</span>
                      <span style={{ color: 'var(--ink-soft)', fontWeight: 500, fontSize: 13 }}>
                        · Folio: {group.order.folio || 'S/F'} · {nombreClienteVisible(group.order.client)}
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
                        <span style={{ color: group.kilosFaltantes > 0 ? 'var(--bad)' : 'var(--ok)' }}>Por Surtir:</span>{' '}
                        <strong style={{ color: group.kilosFaltantes > 0 ? 'var(--bad)' : 'var(--ok)' }}>
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

                  <div style={{ textAlign: 'right', minWidth: 150 }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monto Facturado</div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--ink)' }}>{money(group.totalVentaFacturada)}</div>
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: 800, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>
                      💵 Flujo: {money(group.kilosEntregados * 8.44)}
                      <span style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 600, marginLeft: 4 }}>
                        / {money(group.kilosPedidos * 8.44)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: statusColor, marginTop: 4, fontWeight: 700, background: 'var(--paper-sunk)', padding: '2px 8px', borderRadius: 10, display: 'block' }}>
                      {statusLabel}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginLeft: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {group.statusCategory !== 'completada' && (
                      <button
                        className="btn"
                        style={{ fontSize: 11.5, padding: '6px 10px', background: 'rgba(16, 185, 129, 0.12)', color: '#047857', border: '1px solid #10b981', fontWeight: 800 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderParaEntrega(group.order);
                        }}
                        title="Registrar pesada en báscula"
                      >
                        + Báscula
                      </button>
                    )}
                    {group.kilosPendientesFacturar > 0.01 && (
                      <button
                        className="btn"
                        style={{ fontSize: 11.5, padding: '6px 10px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid #d97706', fontWeight: 800 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderTab('facturas');
                          setSelectedOrder(group.order);
                        }}
                        title="Facturar kilos entregados"
                      >
                        ⚡ Facturar
                      </button>
                    )}
                    <button
                      className="btn"
                      style={{ fontSize: 11.5, padding: '6px 10px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 700 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareOcEmail(group);
                      }}
                      title="Compartir estatus por Correo Electrónico"
                    >
                      📧 Correo
                    </button>
                    <button
                      className="btn"
                      style={{ fontSize: 11.5, padding: '6px 10px', background: '#25D366', color: '#fff', border: 'none', fontWeight: 700 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareOcWhatsApp(group);
                      }}
                      title="Compartir estatus por WhatsApp"
                    >
                      📲 WhatsApp
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 11.5, padding: '6px 10px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrderTab('resumen');
                        setSelectedOrder(group.order);
                      }}
                    >
                      📂 Expediente
                    </button>
                  </div>
                </div>

                {/* Detalle expandible: Partidas y Facturas */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ borderTop: '1px solid var(--border)', overflow: 'hidden', padding: '14px 18px', background: 'var(--paper-sunk)' }}
                    >
                      {/* Tabla de Partidas */}
                      {items.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: 6 }}>
                            📋 Partidas Contratadas ({items.length} productos):
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: 'var(--paper)', borderRadius: 8, overflow: 'hidden' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-inset)' }}>
                                <th style={{ padding: '6px 12px', textAlign: 'left' }}>SKU</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left' }}>Descripción / Medida</th>
                                <th style={{ padding: '6px 12px', textAlign: 'right' }}>Pedido (kg)</th>
                                <th style={{ padding: '6px 12px', textAlign: 'right' }}>Entregado (kg)</th>
                                <th style={{ padding: '6px 12px', textAlign: 'right' }}>Falta (kg)</th>
                                <th style={{ padding: '6px 12px', textAlign: 'center' }}>Estatus</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, idx) => {
                                const pedKg = Number(it.quantity) || 0;
                                const entKg = deliveredByItem[it.id] ?? (it.code ? deliveredByItem[it.code] : undefined) ?? (items.length === 1 ? group.kilosEntregados : (it.deliveredQuantity ?? 0));
                                const faltKg = Math.max(0, pedKg - entKg);
                                return (
                                  <tr key={idx} style={{ borderTop: '1px solid var(--line-soft)' }}>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>#{idx + 1} · {it.code || 'S/C'}</td>
                                    <td style={{ padding: '8px 12px' }}>{it.description || 'Bolsa de Polietileno'}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{pedKg.toLocaleString('es-MX')}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ok)', fontWeight: 700 }}>{entKg.toLocaleString('es-MX')}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: faltKg > 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 700 }}>{faltKg.toLocaleString('es-MX')}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      {entKg >= pedKg && pedKg > 0 ? (
                                        <span className="badge" style={{ background: 'var(--ok)', color: '#fff', fontSize: 10 }}>✓ Surtida</span>
                                      ) : entKg > 0 ? (
                                        <span className="badge" style={{ background: 'var(--warn)', color: '#fff', fontSize: 10 }}>🟡 Parcial</span>
                                      ) : (
                                        <span className="badge" style={{ background: 'var(--bad)', color: '#fff', fontSize: 10 }}>⏳ Pendiente</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Tabla de Entregas en Báscula & Vales */}
                      {(group.order.deliveries || []).length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: 6 }}>
                            ⚖️ Pesajes & Entregas en Báscula ({(group.order.deliveries || []).length}):
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: 'var(--paper)', borderRadius: 8, overflow: 'hidden' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-inset)' }}>
                                <th style={{ padding: '6px 12px', textAlign: 'left' }}>Fecha</th>
                                <th style={{ padding: '6px 12px', textAlign: 'right' }}>Kilos Netos</th>
                                <th style={{ padding: '6px 12px', textAlign: 'right' }}>Bultos</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left' }}>Notas / Remisión</th>
                                <th style={{ padding: '6px 12px', textAlign: 'center' }}>Vale de Báscula</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(group.order.deliveries || []).map((del, dIdx) => (
                                <tr key={del.id || dIdx} style={{ borderTop: '1px solid var(--line-soft)' }}>
                                  <td style={{ padding: '8px 12px' }}>{del.date ? fmtDate(toDate(del.date)) : '—'}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                                    {(del.kilos || 0).toLocaleString('es-MX')} kg
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                                    {(del as any).bags || '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: 'var(--ink-soft)' }}>
                                    {del.notes || 'Entrega física en planta'}
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <button
                                      className="btn"
                                      style={{
                                        fontSize: 11,
                                        padding: '4px 8px',
                                        background: 'rgba(56, 189, 248, 0.12)',
                                        color: '#0284c7',
                                        border: '1px solid #38bdf8',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadValePdf(group, del);
                                      }}
                                      title="Descargar Vale de Báscula Oficial en PDF"
                                    >
                                      📄 Vale PDF
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Tabla de Facturas */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: 6 }}>
                          📑 Facturas y Contrarecibos ({group.invoices.length}):
                        </div>
                        {group.invoices.length === 0 ? (
                          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--ink-soft)', background: 'var(--paper)', borderRadius: 8 }}>
                            📝 No hay facturas emitidas todavía para esta OC.
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: 'var(--paper)', borderRadius: 8, overflow: 'hidden' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-inset)' }}>
                                <th style={{ padding: '6px 12px', textAlign: 'left' }}>Factura</th>
                                <th style={{ padding: '6px 12px', textAlign: 'right' }}>Kilos</th>
                                <th style={{ padding: '6px 12px', textAlign: 'right' }}>Monto con IVA</th>
                                <th style={{ padding: '6px 12px', textAlign: 'center' }}>Contrarecibo</th>
                                <th style={{ padding: '6px 12px', textAlign: 'center' }}>Vencimiento</th>
                                <th style={{ padding: '6px 12px', textAlign: 'center' }}>Estatus</th>
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
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                                      #{inv.folio}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                                      {inv.kilos.toLocaleString('es-MX')} kg
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                      {money(inv.amount)}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }}>
                                      {inv.cr ? <strong>{inv.cr}</strong> : <span style={{ color: 'var(--warn)' }}>⏳ Sin CR</span>}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)' }}>
                                      {inv.dueDate
                                        ? inv.dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '—'}
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      {inv.status === 'collected' ? (
                                        <span className="badge" style={{ background: 'var(--ok)', color: '#fff', fontSize: 10 }}>✅ En Caja</span>
                                      ) : inv.status === 'paid' ? (
                                        <span className="badge" style={{ background: '#0284c7', color: '#fff', fontSize: 10 }}>🟡 Con Contador</span>
                                      ) : (
                                        <span className="badge" style={{ background: 'var(--warn)', color: '#fff', fontSize: 10 }}>🔴 Por Cobrar</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        )}
                      </div>
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
          initialTab={selectedOrderTab}
        />
      )}

      {orderParaEntrega && (
        <RegistrarEntregaModal
          order={orders.find(o => o.id === orderParaEntrega.id) ?? orderParaEntrega}
          costPricePerKg={config.costPricePerKg || 38}
          onClose={() => setOrderParaEntrega(null)}
        />
      )}
    </div>
  );
}
