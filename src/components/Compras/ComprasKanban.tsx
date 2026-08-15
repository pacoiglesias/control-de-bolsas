import { useMemo } from 'react';
import type { Purchase, PurchaseOrder } from '../../lib/types';
import { KanbanScrollWrapper } from '../ui/KanbanScrollWrapper';

/**
 * Tablero Kanban para Compras — mismo patron visual que el de Cobranza
 * (columnas por etapa real del proceso, no una lista plana). Columnas
 * pensadas sobre el flujo que el usuario describio: se hace el pedido a
 * Andres, el material llega (a veces parcial), y despues se le paga.
 */
export function ComprasKanban({
  purchases,
  orderById,
  onSelect,
}: {
  purchases: Purchase[];
  orderById: Map<string, PurchaseOrder>;
  onSelect: (p: Purchase) => void;
}) {
  const cols = useMemo(() => {
    const pedido: Purchase[] = [];
    const transito: Purchase[] = [];
    const recibidoSinPagar: Purchase[] = [];
    const pagado: Purchase[] = [];

    for (const p of purchases) {
      const esperados = p.expectedKilos ?? 0;
      const recibidos = p.receivedKilos ?? 0;
      const totalPagar = p.totalAmount ?? 0;
      const pagadoMonto = p.paidAmount ?? 0;
      const completo = esperados > 0 && recibidos >= esperados - 0.01;
      const yaPagado = totalPagar > 0 && pagadoMonto >= totalPagar - 0.01;

      if (yaPagado) pagado.push(p);
      else if (completo) recibidoSinPagar.push(p);
      else if (recibidos > 0.01) transito.push(p);
      else pedido.push(p);
    }
    return { pedido, transito, recibidoSinPagar, pagado };
  }, [purchases]);

  // FIX 2026-08-10 (Staff Engineer -- task ERP #12): las 4 columnas tenían
  // su fondo/badge en hex fijo pensado solo para modo claro -- en modo
  // oscuro se veían como "islas" de fondo casi blanco. Ahora usan
  // variables CSS que ya cambian solas en [data-theme="dark"].
  const colStyle = (bg: string) => ({
    flex: '0 0 300px',
    background: bg,
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '70vh',
  });

  const renderCard = (p: Purchase) => {
    const o = orderById.get(p.id);
    const esperados = p.expectedKilos ?? 0;
    const recibidos = p.receivedKilos ?? 0;
    const pct = esperados > 0 ? Math.min(100, Math.round((recibidos / esperados) * 100)) : 0;
    const restaPagar = (p.totalAmount ?? 0) - (p.paidAmount ?? 0);
    return (
      <div
        key={p.id}
        onClick={() => onSelect(p)}
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
        <div style={{ fontWeight: 700, fontSize: 14 }} className="mono">{o?.folio || 'S/F'}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>{o?.client || '—'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
          <span>{recibidos.toFixed(0)} / {esperados.toFixed(0)} kg</span>
          <span>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--paper-sunk)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
        </div>
        {restaPagar > 0.01 ? (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bad)' }}>Faltan {restaPagar.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>✅ Liquidado</div>
        )}
      </div>
    );
  };

  return (
    <KanbanScrollWrapper>
      <div style={colStyle('var(--paper-sunk)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>📋 Pedido</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--ink-soft)', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.pedido.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 10 }}>
          {cols.pedido.map(renderCard)}
          {cols.pedido.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, marginTop: 20 }}>Sin pedidos aquí</div>}
        </div>
      </div>

      <div style={colStyle('var(--warn-bg)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--warn)' }}>
          <span>🚚 En Tránsito (parcial)</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--warn)', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.transito.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 10 }}>
          {cols.transito.map(renderCard)}
          {cols.transito.length === 0 && <div style={{ textAlign: 'center', color: 'var(--warn)', fontSize: 13, marginTop: 20 }}>Nada en tránsito</div>}
        </div>
      </div>

      <div style={colStyle('var(--bad-bg)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--bad)' }}>
          <span>📦 Recibido — Falta Pagar</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--bad)', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.recibidoSinPagar.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 10 }}>
          {cols.recibidoSinPagar.map(renderCard)}
          {cols.recibidoSinPagar.length === 0 && <div style={{ textAlign: 'center', color: 'var(--bad)', fontSize: 13, marginTop: 20 }}>Nada pendiente de pago</div>}
        </div>
      </div>

      <div style={colStyle('var(--ok-bg)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ok)' }}>
          <span>✅ Pagado</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--ok)', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.pagado.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 10 }}>
          {cols.pagado.map(renderCard)}
          {cols.pagado.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ok)', fontSize: 13, marginTop: 20 }}>Nada liquidado todavía</div>}
        </div>
      </div>
    </KanbanScrollWrapper>
  );
}
