import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Purchase, PurchaseOrder } from '../../lib/types';
import { KanbanScrollWrapper } from '../ui/KanbanScrollWrapper';
import { KilosProgressBar } from '../Orders/KilosProgressBar';

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

  const colStyle = (bg: string, borderColor: string) => ({
    flex: '0 0 300px',
    background: bg,
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '72vh',
    border: `1px solid ${borderColor}`,
    boxShadow: 'var(--shadow-soft)',
  });

  const renderCard = (p: Purchase) => {
    const o = orderById.get(p.id);
    const esperados = p.expectedKilos ?? 0;
    const recibidos = p.receivedKilos ?? 0;
    const pct = esperados > 0 ? Math.min(100, Math.round((recibidos / esperados) * 100)) : 0;
    const restaPagar = (p.totalAmount ?? 0) - (p.paidAmount ?? 0);
    return (
      <motion.div
        key={p.id}
        whileHover={{ y: -3, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(p)}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          cursor: 'pointer',
          boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }} className="mono">{o?.folio || 'S/F'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>{pct}%</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>{o?.client || '—'}</div>
        
        <div style={{ marginBottom: 8 }}>
          <KilosProgressBar
            compact
            deliveredKg={recibidos}
            totalKg={esperados}
          />
        </div>

        {restaPagar > 0.01 ? (
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--bad)', fontFamily: 'monospace' }}>
            Faltan {restaPagar.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
          </div>
        ) : (
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ok)' }}>✅ Liquidado 100%</div>
        )}
      </motion.div>
    );
  };

  return (
    <KanbanScrollWrapper>
      <div style={colStyle('var(--paper-sunk)', 'var(--line)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>📋 Pedido a Andrés</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--ink-soft)', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{cols.pedido.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.pedido.map(renderCard)}
          {cols.pedido.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, marginTop: 24, fontStyle: 'italic' }}>Sin pedidos aquí</div>}
        </div>
      </div>

      <div style={colStyle('var(--warn-bg)', 'rgba(245,158,11,0.25)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--warn)', fontSize: 13 }}>
          <span>🚚 En Fabricación / Tránsito</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--warn)', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{cols.transito.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.transito.map(renderCard)}
          {cols.transito.length === 0 && <div style={{ textAlign: 'center', color: 'var(--warn)', fontSize: 12, marginTop: 24, fontStyle: 'italic' }}>Nada en tránsito</div>}
        </div>
      </div>

      <div style={colStyle('var(--bad-bg)', 'rgba(239,68,68,0.25)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--bad)', fontSize: 13 }}>
          <span>📦 Recibido — Falta Pagar</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--bad)', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{cols.recibidoSinPagar.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.recibidoSinPagar.map(renderCard)}
          {cols.recibidoSinPagar.length === 0 && <div style={{ textAlign: 'center', color: 'var(--bad)', fontSize: 12, marginTop: 24, fontStyle: 'italic' }}>Nada pendiente de pago</div>}
        </div>
      </div>

      <div style={colStyle('var(--ok-bg)', 'rgba(16,185,129,0.25)')}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between', color: 'var(--ok)', fontSize: 13 }}>
          <span>✅ Pagado y Liquidado</span>
          <span style={{ background: 'var(--paper-raised)', color: 'var(--ok)', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>{cols.pagado.length}</span>
        </div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.pagado.map(renderCard)}
          {cols.pagado.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ok)', fontSize: 12, marginTop: 24, fontStyle: 'italic' }}>Nada liquidado todavía</div>}
        </div>
      </div>
    </KanbanScrollWrapper>
  );
}
