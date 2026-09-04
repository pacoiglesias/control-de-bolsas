import { useMemo } from 'react';
import { money } from '../../lib/format';
import { getOrderSummary, round2, extractCr } from '../../lib/finance';
import type { PurchaseOrder, Purchase, FinancialConfig } from '../../lib/types';

interface SemaforoDelDiaProps {
  orders: PurchaseOrder[];
  purchases: Purchase[];
  config: FinancialConfig;
  nav: (path: string) => void;
  onOpenQuickInvoice?: () => void;
  onOpenQuickCollection?: () => void;
}

export function SemaforoDelDia({
  orders,
  purchases,
  config,
  nav,
  onOpenQuickInvoice,
  onOpenQuickCollection,
}: SemaforoDelDiaProps) {
  const metrics = useMemo(() => {
    let porPedirKilos = 0;
    let porPedirOCs = 0;
    let porFacturarKilos = 0;
    let porFacturarMonto = 0;
    let sinContrareciboCount = 0;
    let enRevisionCount = 0;
    let enRevisionMonto = 0;
    let porRecibirContadorMonto = 0;
    let porRecibirContadorCount = 0;

    const salePrice = config?.salePricePerKg || 43;
    const ivaRate = config?.ivaRate || 0.16;

    (orders || []).forEach((o) => {
      if (!o || o.isClosedShort) return;
      const summary = getOrderSummary(o);
      const totalKilos = Number(o.totalKilograms) || 0;
      const kilosEntregados = summary.kilosDelivered;
      const kilosFacturados = summary.kilosInvoiced;

      // 1. Por pedir a Andrés (OCs sin entregas y sin facturas)
      if (kilosEntregados <= 0 && summary.invoices.length === 0 && totalKilos > 0) {
        porPedirKilos += totalKilos;
        porPedirOCs++;
      }

      // 2. Por facturar (Andrés entregó a Providencia pero faltan facturas)
      if (kilosEntregados > kilosFacturados + 0.01) {
        const delta = kilosEntregados - kilosFacturados;
        porFacturarKilos += delta;
        const sub = delta * (o.customSellPrice || salePrice);
        porFacturarMonto = round2(porFacturarMonto + (sub * (1 + ivaRate)));
      }

      // 3. Facturas sin contrarecibo (excluyendo órdenes cerradas o ya cobradas)
      if (!o.isClosedShort && o.creditCycle?.status !== 'collected') {
        (o.invoices || []).forEach((inv) => {
          if (!inv) return;
          const cr = extractCr(inv, o);
          const st = inv.creditCycle?.status;
          const totalInv = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          const paidAmt = inv.collection?.paidAmount || 0;

          if (!cr && st !== 'paid' && st !== 'collected' && paidAmt < totalInv && (totalInv > 0 || (inv.kilos || 0) > 0)) {
            if (st === 'facturado' || st === 'manual_review' || (inv.folio && inv.folio.trim().length > 0)) {
              sinContrareciboCount++;
            }
          }
          // Facturas en revisión (in_review) — enviadas a Providencia esperando CR
          if (st === 'in_review') {
            enRevisionCount++;
            enRevisionMonto = round2(enRevisionMonto + (totalInv || 0));
          }
          if (st === 'paid') {
            const tot = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
            const comm = inv.financials?.commission ?? (tot * (config?.commissionRate || 0.08));
            porRecibirContadorMonto = round2(porRecibirContadorMonto + (tot - comm));
            porRecibirContadorCount++;
          }
        });
      }
    });

    // 4. Andrés en producción (kilos pedidos en compras vs entregados)
    const andresPendienteKilos = (purchases || []).reduce((acc, p) => {
      if (!p) return acc;
      const faltan = (p.expectedKilos || 0) - (p.receivedKilos || 0);
      return acc + Math.max(0, faltan);
    }, 0);

    return {
      porPedirKilos: round2(porPedirKilos),
      porPedirOCs,
      andresPendienteKilos: round2(andresPendienteKilos),
      porFacturarKilos: round2(porFacturarKilos),
      porFacturarMonto: round2(porFacturarMonto),
      sinContrareciboCount,
      enRevisionCount,
      enRevisionMonto: round2(enRevisionMonto),
      porRecibirContadorMonto: round2(porRecibirContadorMonto),
      porRecibirContadorCount,
    };
  }, [orders, purchases, config]);

  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚦</span> Semáforo de Producción & Entregas
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-soft)' }}>
            (Andrés ↔ Providencia en tiempo real)
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
          Haz clic en cualquier bloque para actuar al instante
        </div>
      </div>

      {/* Banner Global de Estado de Taller / Entregas */}
      {metrics.andresPendienteKilos === 0 && metrics.porPedirKilos === 0 ? (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)',
            border: '1px solid #10b981',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>🟢</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#047857' }}>
              ¡TALLER AL DÍA! CERO PEDIDOS PENDIENTES
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
              Andrés no tiene kilos pendientes por fabricar. Todos los pedidos solicitados ya fueron entregados al almacén de Providencia.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.15) 100%)',
            border: '1px solid #f59e0b',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>🟡</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#b45309' }}>
              PRODUCCIÓN EN CURSO: {(metrics.andresPendienteKilos + metrics.porPedirKilos).toLocaleString('es-MX')} kg PENDIENTES
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
              {metrics.andresPendienteKilos > 0 ? `Andrés tiene ${metrics.andresPendienteKilos.toLocaleString('es-MX')} kg en producción por entregar.` : 'Kilos en proceso de producción con Andrés.'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {/* 1. Por pedir a Andrés */}
        <div
          onClick={() => nav('/ordenes?filtro=pedido')}
          className="clickable"
          style={{
            background: metrics.porPedirOCs > 0 ? 'rgba(59,130,246,0.08)' : 'var(--paper-sunk)',
            border: `1px solid ${metrics.porPedirOCs > 0 ? '#3b82f6' : 'var(--line)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <span className="badge" style={{ background: metrics.porPedirOCs > 0 ? '#3b82f6' : 'var(--ink-faint)', color: '#fff', fontSize: 10 }}>
              {metrics.porPedirOCs} OC{metrics.porPedirOCs !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            1. Por Pedir a Andrés
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: metrics.porPedirOCs > 0 ? '#1d4ed8' : 'var(--ink)', marginTop: 2 }}>
            {metrics.porPedirKilos.toLocaleString('es-MX')} kg
          </div>
        </div>

        {/* 2. Andrés Fabricando */}
        <div
          onClick={() => nav('/compras')}
          className="clickable"
          style={{
            background: metrics.andresPendienteKilos > 0 ? 'rgba(139,92,246,0.08)' : 'var(--paper-sunk)',
            border: `1px solid ${metrics.andresPendienteKilos > 0 ? '#8b5cf6' : 'var(--line)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🏭</span>
            <span className="badge" style={{ background: metrics.andresPendienteKilos > 0 ? '#8b5cf6' : 'var(--ink-faint)', color: '#fff', fontSize: 10 }}>
              En Producción
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            2. Andrés por Entregar
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: metrics.andresPendienteKilos > 0 ? '#6d28d9' : 'var(--ink)', marginTop: 2 }}>
            {metrics.andresPendienteKilos.toLocaleString('es-MX')} kg
          </div>
        </div>

        {/* 3. Por Facturar */}
        <div
          onClick={() => {
            if (onOpenQuickInvoice) onOpenQuickInvoice();
            else nav('/ordenes');
          }}
          className="clickable"
          style={{
            background: metrics.porFacturarKilos > 0 ? 'rgba(245,158,11,0.1)' : 'var(--paper-sunk)',
            border: `1px solid ${metrics.porFacturarKilos > 0 ? '#f59e0b' : 'var(--line)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <span className="badge" style={{ background: metrics.porFacturarKilos > 0 ? '#f59e0b' : 'var(--ink-faint)', color: '#fff', fontSize: 10 }}>
              {metrics.porFacturarKilos.toLocaleString('es-MX')} kg
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            3. Entregas por Facturar
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: metrics.porFacturarKilos > 0 ? '#b45309' : 'var(--ink)', marginTop: 2 }}>
            {money(metrics.porFacturarMonto)}
          </div>
        </div>

        {/* 4. Facturas sin Contrarecibo */}
        <div
          onClick={() => {
            if (onOpenQuickCollection) onOpenQuickCollection();
            else nav('/cobranza');
          }}
          className="clickable"
          style={{
            background: metrics.sinContrareciboCount > 0 ? 'rgba(239,68,68,0.08)' : 'var(--paper-sunk)',
            border: `1px solid ${metrics.sinContrareciboCount > 0 ? '#ef4444' : 'var(--line)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <span className="badge" style={{ background: metrics.sinContrareciboCount > 0 ? '#ef4444' : 'var(--ink-faint)', color: '#fff', fontSize: 10 }}>
              {metrics.sinContrareciboCount} pendientes
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            4. En Espera de CR
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: metrics.sinContrareciboCount > 0 ? '#b91c1c' : 'var(--ink)', marginTop: 2 }}>
            {metrics.sinContrareciboCount} factura{metrics.sinContrareciboCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* 4b. En Revisión por Providencia (in_review) */}
        <div
          onClick={() => nav('/cobranza')}
          className="clickable"
          style={{
            background: metrics.enRevisionCount > 0 ? 'rgba(37,99,235,0.08)' : 'var(--paper-sunk)',
            border: `1px solid ${metrics.enRevisionCount > 0 ? '#2563eb' : 'var(--line)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🔵</span>
            <span className="badge" style={{ background: metrics.enRevisionCount > 0 ? '#2563eb' : 'var(--ink-faint)', color: '#fff', fontSize: 10 }}>
              {metrics.enRevisionCount} en revisión
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            4b. En Revisión / Esperando CR
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: metrics.enRevisionCount > 0 ? '#1d4ed8' : 'var(--ink)', marginTop: 2 }}>
            {money(metrics.enRevisionMonto)}
          </div>
        </div>

        {/* 5. Con el Contador por Recoger */}
        <div
          onClick={() => nav('/cobranza')}
          className="clickable"
          style={{
            background: metrics.porRecibirContadorMonto > 0 ? 'rgba(16,185,129,0.1)' : 'var(--paper-sunk)',
            border: `1px solid ${metrics.porRecibirContadorMonto > 0 ? '#10b981' : 'var(--line)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>💵</span>
            <span className="badge" style={{ background: metrics.porRecibirContadorMonto > 0 ? '#10b981' : 'var(--ink-faint)', color: '#fff', fontSize: 10 }}>
              {metrics.porRecibirContadorCount} cobradas
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            5. Listo para Caja
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: metrics.porRecibirContadorMonto > 0 ? '#047857' : 'var(--ink)', marginTop: 2 }}>
            {money(metrics.porRecibirContadorMonto)}
          </div>
        </div>
      </div>
    </div>
  );
}
