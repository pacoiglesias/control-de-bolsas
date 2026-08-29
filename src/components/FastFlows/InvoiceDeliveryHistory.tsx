import { useState } from 'react';
import type { Delivery, PurchaseOrder } from '../../lib/types';
import { round2 } from '../../lib/finance';

interface InvoiceDeliveryHistoryProps {
  deliveries: Delivery[];
  order: PurchaseOrder;
}

export function InvoiceDeliveryHistory({ deliveries, order }: InvoiceDeliveryHistoryProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (deliveries.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(234,179,8,0.07)',
          border: '1px solid rgba(234,179,8,0.25)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>📭</span>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
          <strong style={{ color: 'var(--ink)' }}>Sin entregas registradas en báscula.</strong>
          <br />
          Los kilos se calcularán desde la cantidad de la OC.
        </div>
      </div>
    );
  }

  const pendingDeliveries = deliveries.filter((d) => !d.invoiced);
  const invoicedDeliveries = deliveries.filter((d) => d.invoiced);

  const deliveryKilos = (d: Delivery) =>
    d.items && d.items.length > 0
      ? round2(d.items.reduce((s, it) => s + Number(it.quantity || 0), 0))
      : round2(Number(d.kilos || 0));

  const totalPending = round2(pendingDeliveries.reduce((s, d) => s + deliveryKilos(d), 0));
  const totalInvoiced = round2(invoicedDeliveries.reduce((s, d) => s + deliveryKilos(d), 0));

  return (
    <div style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: collapsed ? 'none' : '1px solid var(--line-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🚚</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>
              Historial de Entregas en Báscula
              <span className="badge" style={{ marginLeft: 8, background: '#2563eb', fontSize: 10 }}>
                {deliveries.length} entrega{deliveries.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>
              {pendingDeliveries.length > 0
                ? `${pendingDeliveries.length} sin facturar (${totalPending.toLocaleString('es-MX')} kg)`
                : 'Todas las entregas ya facturadas'}
              {invoicedDeliveries.length > 0 &&
                ` · ${invoicedDeliveries.length} facturada${invoicedDeliveries.length !== 1 ? 's' : ''} (${totalInvoiced.toLocaleString('es-MX')} kg)`}
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Entregas sin facturar primero */}
          {pendingDeliveries.map((d) => (
            <DeliveryRow key={d.id} delivery={d} kilos={deliveryKilos(d)} invoiced={false} order={order} />
          ))}
          {/* Separador si hay ambos tipos */}
          {pendingDeliveries.length > 0 && invoicedDeliveries.length > 0 && (
            <div
              style={{
                borderTop: '1px dashed var(--line-soft)',
                margin: '4px 0',
                padding: '4px 0',
                fontSize: 10.5,
                color: 'var(--ink-soft)',
                textAlign: 'center',
              }}
            >
              ── ya facturadas ──
            </div>
          )}
          {/* Entregas ya facturadas */}
          {invoicedDeliveries.map((d) => (
            <DeliveryRow key={d.id} delivery={d} kilos={deliveryKilos(d)} invoiced order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryRow({
  delivery: d,
  kilos,
  invoiced,
  order,
}: {
  delivery: Delivery;
  kilos: number;
  invoiced: boolean;
  order: PurchaseOrder;
}) {
  const dateStr = d.date
    ? typeof (d.date as any).toDate === 'function'
      ? (d.date as any).toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
      : new Date(d.date as any).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
    : 'Sin fecha';

  const linkedInvoice = invoiced && d.invoiceId ? (order.invoices || []).find((inv) => inv.id === d.invoiceId) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        background: invoiced ? 'rgba(0,0,0,0.03)' : 'rgba(5,150,105,0.06)',
        border: invoiced ? '1px solid var(--line-soft)' : '1px solid rgba(5,150,105,0.25)',
        opacity: invoiced ? 0.75 : 1,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{invoiced ? '✅' : '🔴'}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: invoiced ? 'var(--ink-soft)' : 'var(--ink)' }}>
            {kilos.toLocaleString('es-MX')} kg
          </span>
          {d.docFolio && (
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                color: '#2563eb',
                background: 'rgba(37,99,235,0.08)',
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              {d.docType === 'remision' ? 'Rem.' : d.docType === 'factura' ? 'Fac.' : ''} {d.docFolio}
            </span>
          )}
          {d.driver && <span style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>· {d.driver}</span>}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span>📅 {dateStr}</span>
          {linkedInvoice?.folio && <span style={{ color: '#7c3aed' }}>· Factura #{linkedInvoice.folio}</span>}
          {d.notes && <span>· {d.notes}</span>}
        </div>
        {d.items && d.items.length > 1 && (
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {d.items.map((it, i) => {
              const ocItem = (order.items || []).find((oi) => oi.id === it.itemId || oi.code === it.itemId);
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 10,
                    background: 'var(--paper-sunk)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    color: 'var(--ink-soft)',
                  }}
                >
                  {ocItem?.description || it.itemId}: {Number(it.quantity || 0).toLocaleString('es-MX')} kg
                </span>
              );
            })}
          </div>
        )}
      </div>

      <span
        className="badge"
        style={{
          fontSize: 9.5,
          padding: '2px 7px',
          flexShrink: 0,
          background: invoiced ? 'rgba(124,58,237,0.12)' : 'rgba(5,150,105,0.15)',
          color: invoiced ? '#7c3aed' : '#059669',
          border: invoiced ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(5,150,105,0.3)',
        }}
      >
        {invoiced ? 'Facturada' : 'Sin facturar'}
      </span>
    </div>
  );
}
