import { useMemo } from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { computeDeliveredTotals } from '../../lib/deliveries';
import { money, kilos as fmtKilos } from '../../lib/format';
import { KanbanScrollWrapper } from '../ui/KanbanScrollWrapper';

/**
 * Tablero Kanban para Logistica de Entregas — completa la trilogia visual
 * junto con Compras y Cobranza. Columnas por la etapa real del flujo que
 * el usuario describio: pedido -> entrega -> factura -> cobro.
 */
export function EntregasKanban({
  orders,
  onSelect,
}: {
  orders: PurchaseOrder[];
  onSelect: (o: PurchaseOrder) => void;
}) {
  const cols = useMemo(() => {
    const pedido: PurchaseOrder[] = [];
    const enCamino: PurchaseOrder[] = [];
    const sinFacturar: PurchaseOrder[] = [];
    const porCobrar: PurchaseOrder[] = [];
    const cobrado: PurchaseOrder[] = [];

    for (const o of orders) {
      const kilosPedidos = o.totalKilograms || 0;
      const { kilosEntregados } = computeDeliveredTotals(o.deliveries ?? []);
      const invoices = o.invoices ?? [];
      const kilosFacturados = invoices.reduce((a, i) => a + (i.kilos || 0), 0);
      const entregaCompleta = (kilosPedidos > 0 && kilosEntregados >= kilosPedidos - 0.01) || (kilosPedidos === 0 && kilosEntregados > 0);
      const todasCobradas = invoices.length > 0 && invoices.every(i => {
        const st = i.creditCycle?.status;
        return st === 'paid' || st === 'collected';
      });
      const isCollected = o.creditCycle?.status === 'collected' || o.creditCycle?.status === 'paid' || Boolean(o.isClosedShort) || (invoices.length > 0 && todasCobradas);

      if (isCollected || (entregaCompleta && todasCobradas)) {
        cobrado.push(o);
      } else if (!entregaCompleta && kilosEntregados > 0.01) {
        enCamino.push(o);
      } else if (!entregaCompleta) {
        pedido.push(o);
      } else if (kilosEntregados > kilosFacturados + 0.01) {
        sinFacturar.push(o);
      } else {
        porCobrar.push(o);
      }
    }
    return { pedido, enCamino, sinFacturar, porCobrar, cobrado };
  }, [orders]);

  const colStyle = (baseBg: string) => ({
    flex: '0 0 280px',
    background: baseBg,
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '70vh',
  });

  const renderCard = (o: PurchaseOrder) => {
    const kilosPedidos = o.totalKilograms || 0;
    const { kilosEntregados } = computeDeliveredTotals(o.deliveries ?? []);
    const pct = kilosPedidos > 0 ? Math.min(100, Math.round((kilosEntregados / kilosPedidos) * 100)) : 0;
    const totalFacturas = (o.invoices ?? []).reduce((a, i) => a + (i.financials?.invoiceTotal ?? i.financials?.saleTotal ?? 0), 0);
    return (
      <div
        key={o.id}
        onClick={() => onSelect(o)}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 10,
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }} className="mono">{o.oc || o.folio || 'Sin Folio'}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>{o.client || '—'}</div>
        {kilosPedidos > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
              <span>{fmtKilos(kilosEntregados)} / {fmtKilos(kilosPedidos)}</span>
              <span>{pct}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--paper-sunk)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
          </>
        )}
        {totalFacturas > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{money(totalFacturas)}</div>
        )}
      </div>
    );
  };

  const columnas = [
    { key: 'pedido', title: '📋 Pedido', bg: 'var(--paper-sunk)', badge: 'var(--line)', color: 'var(--ink)', items: cols.pedido, empty: 'Sin pedidos aquí' },
    { key: 'enCamino', title: '🚚 En Camino', bg: 'var(--warn-bg)', badge: 'rgba(245,158,11,0.2)', color: 'var(--warn)', items: cols.enCamino, empty: 'Nada en camino' },
    { key: 'sinFacturar', title: '📦 Entregado — Sin Facturar', bg: 'rgba(245,158,11,0.15)', badge: 'rgba(245,158,11,0.25)', color: 'var(--warn)', items: cols.sinFacturar, empty: 'Todo facturado' },
    { key: 'porCobrar', title: '🧾 Facturado — Por Cobrar', bg: 'var(--bad-bg)', badge: 'rgba(239,68,68,0.2)', color: 'var(--bad)', items: cols.porCobrar, empty: 'Nada pendiente de cobro' },
    { key: 'cobrado', title: '✅ Cobrado', bg: 'var(--ok-bg)', badge: 'rgba(16,185,129,0.2)', color: 'var(--ok)', items: cols.cobrado, empty: 'Nada cobrado todavía' },
  ];

  return (
    <KanbanScrollWrapper>
      {columnas.map(col => (
        <div
          key={col.key}
          style={{
            ...colStyle(col.bg),
            border: `1px solid color-mix(in srgb, ${col.color} 25%, transparent)`,
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: col.color }}>
            <span>{col.title}</span>
            <span style={{ background: col.badge, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{col.items.length}</span>
          </div>
          <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            {col.items.map(renderCard)}
            {col.items.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, marginTop: 24, fontStyle: 'italic' }}>{col.empty}</div>}
          </div>
        </div>
      ))}
    </KanbanScrollWrapper>
  );
}
