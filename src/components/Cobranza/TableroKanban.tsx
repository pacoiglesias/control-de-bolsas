import { useContext, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CobranzaContext from './CobranzaContext';
import { daysLate, extractCr } from '../../lib/finance';
import { toDate, fmtDate, nombreClienteVisible } from '../../lib/format';
import { KanbanScrollWrapper } from '../ui/KanbanScrollWrapper';
import { InvoiceDrawer } from './InvoiceDrawer';
import { QuickCrModal } from '../QuickCrModal';
import { useConfig } from '../../hooks/useConfig';
import { useToast } from '../../context/ToastContext';
import { confirmDialog } from '../../lib/confirmDialog';
import { generateCollectionNotice } from '../../lib/whatsappReminder';

const TONE: Record<string, { color: string; bg: string; border: string }> = {
  colRevision: { color: 'var(--ink-soft)', bg: 'var(--paper-sunk)', border: 'var(--line)' },
  colPorCobrar: { color: '#dc2626', bg: 'rgba(239, 68, 68, 0.04)', border: 'rgba(239, 68, 68, 0.2)' },
  colContador: { color: '#d97706', bg: 'rgba(245, 158, 11, 0.04)', border: 'rgba(245, 158, 11, 0.2)' },
  colCaja: { color: '#059669', bg: 'rgba(16, 185, 129, 0.04)', border: 'rgba(16, 185, 129, 0.2)' },
};

export default function TableroKanban() {
  const { data, money, moveInvoice, deleteOrArchiveInvoice } = useContext(CobranzaContext)!;
  const toast = useToast();
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<{ o: any; inv: any } | null>(null);
  const [quickCrTarget, setQuickCrTarget] = useState<{ o: any; inv?: any } | null>(null);
  const { config: dynamicConfig } = useConfig();

  const cols = useMemo(() => {
    const colRevision: any[] = [];
    const colPorCobrar: any[] = [];
    const colContador: any[] = [];
    const colCaja: any[] = [];

    (data?.lista || []).forEach((x: any) => {
      if (!x) return;
      if (!x.hasCr) {
        colRevision.push(x);
      } else {
        colPorCobrar.push(x);
      }
    });

    (data?.paid || []).forEach((x: any) => {
      if (x) colContador.push(x);
    });
    (data?.collected || []).forEach((x: any) => {
      if (x) colCaja.push(x);
    });

    const FOLIOS_PLACEHOLDER = new Set(['s/n', 'sin folio', '']);
    const deduplicarColumna = (arr: any[]) => {
      const seen = new Map<string, any>();
      arr.forEach((x) => {
        const rawFolio = (x.inv?.folio || x.inv?.id || '').trim().toUpperCase();
        const folioValido = !FOLIOS_PLACEHOLDER.has(rawFolio.toLowerCase());
        const crClean = (x.cr || '').trim().toUpperCase();
        // 🛡️ Clave única por factura: nunca colapsar dos facturas distintas del mismo CR (ej. F-6097 y F-6098 de TH-879)
        const clave = folioValido
          ? (crClean ? `${crClean}_INV_${rawFolio}` : `INV_${rawFolio}`)
          : (crClean ? `CR_${crClean}` : (x.o?.id || ''));
        if (!clave) return;
        if (!seen.has(clave)) {
          seen.set(clave, { ...x, _posibleDuplicado: false });
        } else {
          const prev = seen.get(clave);
          if ((x.saldo || 0) > (prev.saldo || 0) || (x.inv?.kilos || 0) > (prev.inv?.kilos || 0)) {
            seen.set(clave, { ...x, _posibleDuplicado: false });
          }
        }
      });
      return Array.from(seen.values());
    };

    const cleanRevision = deduplicarColumna(colRevision);
    const cleanPorCobrar = deduplicarColumna(colPorCobrar).sort((a, b) => (b.d ?? -999) - (a.d ?? -999));
    const cleanContador = deduplicarColumna(colContador);
    const cleanCaja = deduplicarColumna(colCaja);

    const sumaSaldo = (arr: any[]) => arr.reduce((acc, x) => acc + (x.saldo ?? 0), 0);
    const montoFactura = (x: any) => x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0;
    const sumaMonto = (arr: any[]) => arr.reduce((acc, x) => acc + montoFactura(x), 0);

    return {
      colRevision: cleanRevision,
      colPorCobrar: cleanPorCobrar,
      colContador: cleanContador,
      colCaja: cleanCaja,
      totales: {
        colRevision: sumaSaldo(cleanRevision),
        colPorCobrar: sumaSaldo(cleanPorCobrar),
        colContador: sumaMonto(cleanContador),
        colCaja: sumaMonto(cleanCaja),
      },
    };
  }, [data]);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, oId: string, invId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ oId, invId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const renderCard = (x: any) => {
    const o = x.o;
    const inv = x.inv;
    const cr = extractCr(inv, o);
    const amt = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
    const late = daysLate(toDate(inv.creditCycle?.dueDate));
    const isOverdue = late !== null && late > 0;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        whileHover={{ y: -2, boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.08)' }}
        key={inv.id}
        draggable
        onDragStart={(e: any) => onDragStart(e, o.id, inv.id)}
        style={{
          background: 'var(--paper, #fff)',
          border: x._posibleDuplicado
            ? '1.5px solid rgba(245, 158, 11, 0.6)'
            : isOverdue
            ? '1.5px solid rgba(239, 68, 68, 0.5)'
            : '1px solid var(--card-border, var(--line))',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 10,
          cursor: 'grab',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
          position: 'relative',
        }}
        onClick={() => setDrawerTarget({ o: x.o, inv: x.inv })}
      >
        {/* Banner de Posible Duplicado */}
        {x._posibleDuplicado && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(245, 158, 11, 0.12)',
              borderRadius: 6,
              padding: '3px 6px',
              marginBottom: 8,
              fontSize: 10.5,
              fontWeight: 700,
              color: 'var(--warn)',
            }}
          >
            <span>⚠️ Posible duplicado (CR)</span>
            <button
              className="btn"
              style={{
                padding: '2px 5px',
                fontSize: 10,
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={async (e) => {
                e.stopPropagation();
                const ok = await confirmDialog({
                  message: `¿Deseas quitar/archivar este registro duplicado (${inv.folio || o.folio || 'CR: ' + cr})?`,
                  danger: true,
                });
                if (ok) {
                  await deleteOrArchiveInvoice(o.id, inv.id);
                }
              }}
            >
              Quitar
            </button>
          </div>
        )}

        {/* Encabezado: Folio + Importe */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'monospace',
                background: 'var(--paper-sunk)',
                padding: '2px 6px',
                borderRadius: 6,
                color: 'var(--ink)',
              }}
            >
              {inv.folio ? `#${inv.folio}` : o.folio ? `#${o.folio}` : 'Sin Folio'}
            </span>
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: isOverdue ? 'var(--bad)' : 'var(--ink)',
              fontFamily: 'monospace',
              letterSpacing: '-0.02em',
            }}
          >
            {money(amt)}
          </span>
        </div>

        {/* Cliente y Departamento */}
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--ink-soft)',
            marginBottom: 8,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {nombreClienteVisible(o.client)} {o.department ? <span style={{ opacity: 0.75 }}>({o.department})</span> : ''}
        </div>

        {/* Badges de Contrarecibo y Vencimiento */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 6,
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              background: cr ? 'rgba(5, 150, 105, 0.12)' : 'var(--paper-sunk)',
              color: cr ? '#059669' : 'var(--ink-soft)',
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            {cr ? `CR: ${cr}` : 'Sin CR'}
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: isOverdue ? 'var(--bad)' : 'var(--ink-soft)',
              fontWeight: isOverdue ? 700 : 500,
            }}
          >
            {isOverdue
              ? `+${late}d atraso`
              : inv.creditCycle?.dueDate
              ? fmtDate(inv.creditCycle.dueDate)
              : ''}
          </span>
        </div>

        {/* Barra de Acción Rápida Compacta */}
        <div
          style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          {!cr ? (
            <button
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
              }}
              onClick={() => setQuickCrTarget({ o, inv })}
            >
              📝 Asignar CR
            </button>
          ) : inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue' ? (
            <>
              <button
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                }}
                onClick={() => moveInvoice(o.id, inv.id, 'colContador')}
              >
                💸 Cobro Rápido
              </button>
              <button
                className="btn"
                title="Copiar aviso formal de cobro al portapapeles"
                style={{
                  padding: '4px 7px',
                  fontSize: 11,
                  background: 'var(--paper-sunk)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                }}
                onClick={() => {
                  const notice = generateCollectionNotice({
                    cliente: nombreClienteVisible(o.client) || 'Grupo Textil Providencia',
                    folioFactura: inv.folio || o.folio || 'S/N',
                    contrarecibo: cr || undefined,
                    monto: amt,
                    fechaVencimiento: inv.creditCycle?.dueDate,
                  });
                  navigator.clipboard.writeText(notice);
                  toast('📋 Aviso de cobro copiado al portapapeles.', 'ok');
                }}
              >
                📋
              </button>
            </>
          ) : inv.creditCycle.status === 'paid' ? (
            <>
              <button
                className="btn btn-ok"
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: 11,
                  background: 'var(--ok)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 700,
                }}
                onClick={() => moveInvoice(o.id, inv.id, 'colCaja')}
              >
                ✅ Recibir en Caja
              </button>
              <button
                className="btn"
                title="Deshacer cobro"
                style={{
                  padding: '4px 7px',
                  fontSize: 11,
                  background: 'var(--paper-sunk)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                }}
                onClick={() => moveInvoice(o.id, inv.id, 'colPorCobrar')}
              >
                ↩️
              </button>
            </>
          ) : inv.creditCycle.status === 'collected' ? (
            <button
              className="btn"
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 11,
                background: 'var(--paper-sunk)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                borderRadius: 6,
              }}
              onClick={() => moveInvoice(o.id, inv.id, 'colContador')}
            >
              ↩️ Revertir
            </button>
          ) : null}

          {/* Botón discreto de eliminación / archivo */}
          <button
            className="btn"
            title="Archivar o eliminar de cobranza"
            style={{
              padding: '4px 6px',
              fontSize: 10.5,
              background: 'transparent',
              color: 'var(--ink-faint)',
              border: 'none',
              borderRadius: 6,
            }}
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirmDialog({
                message: `¿Deseas archivar/eliminar esta tarjeta (${inv.folio || o.folio || 'CR: ' + cr}) de Cobranza?`,
                danger: true,
              });
              if (ok) {
                await deleteOrArchiveInvoice(o.id, inv.id);
              }
            }}
          >
            🗑️
          </button>
        </div>
      </motion.div>
    );
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetCol: string) => {
    e.preventDefault();
    setActiveTarget(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.oId && data.invId) {
        await moveInvoice(data.oId, data.invId, targetCol);
      }
    } catch (err) {
      console.error('Drop error', err);
    }
  };

  const getColStyle = (colId: string) => ({
    flex: '0 0 300px',
    background: activeTarget === colId ? 'color-mix(in srgb, var(--ink) 5%, transparent)' : TONE[colId].bg,
    borderRadius: 16,
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '75vh',
    transition: 'all 0.2s ease',
    border: `1px solid ${activeTarget === colId ? 'var(--accent)' : TONE[colId].border}`,
  });

  return (
    <>
      <KanbanScrollWrapper>
        {/* 1. Columna En Revisión (Sin CR) */}
        <div
          style={getColStyle('colRevision')}
          onDragOver={handleDragOver}
          onDragEnter={() => setActiveTarget('colRevision')}
          onDragLeave={() => setActiveTarget(null)}
          onDrop={(e) => handleDrop(e, 'colRevision')}
        >
          <div
            style={{
              fontWeight: 800,
              color: TONE.colRevision.color,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13.5,
              letterSpacing: '-0.01em',
            }}
          >
            <span>🔎 En Revisión (Sin CR)</span>
            <span
              style={{
                background: 'var(--paper)',
                color: 'var(--ink)',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11.5,
                fontWeight: 700,
                border: '1px solid var(--line)',
              }}
            >
              {cols.colRevision.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12, fontWeight: 700 }}>
            Total: {money(cols.totales.colRevision)}
          </div>
          <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4, paddingBottom: 16 }}>
            <AnimatePresence>{cols.colRevision.map(renderCard)}</AnimatePresence>
            {cols.colRevision.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, marginTop: 32 }}>
                Sin facturas pendientes de CR
              </div>
            )}
          </div>
        </div>

        {/* 2. Columna Por Cobrar (Con CR) */}
        <div
          style={getColStyle('colPorCobrar')}
          onDragOver={handleDragOver}
          onDragEnter={() => setActiveTarget('colPorCobrar')}
          onDragLeave={() => setActiveTarget(null)}
          onDrop={(e) => handleDrop(e, 'colPorCobrar')}
        >
          <div
            style={{
              fontWeight: 800,
              color: TONE.colPorCobrar.color,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13.5,
              letterSpacing: '-0.01em',
            }}
          >
            <span>⏳ Por Cobrar (Con CR)</span>
            <span
              style={{
                background: 'var(--paper)',
                color: TONE.colPorCobrar.color,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11.5,
                fontWeight: 700,
                border: '1px solid var(--line)',
              }}
            >
              {cols.colPorCobrar.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: TONE.colPorCobrar.color, marginBottom: 12, fontWeight: 700 }}>
            Total: {money(cols.totales.colPorCobrar)}
          </div>
          <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4, paddingBottom: 16 }}>
            <AnimatePresence>{cols.colPorCobrar.map(renderCard)}</AnimatePresence>
            {cols.colPorCobrar.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, marginTop: 32 }}>
                Soltar aquí...
              </div>
            )}
          </div>
        </div>

        {/* 3. Columna Con el Contador */}
        <div
          style={getColStyle('colContador')}
          onDragOver={handleDragOver}
          onDragEnter={() => setActiveTarget('colContador')}
          onDragLeave={() => setActiveTarget(null)}
          onDrop={(e) => handleDrop(e, 'colContador')}
        >
          <div
            style={{
              fontWeight: 800,
              color: TONE.colContador.color,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13.5,
              letterSpacing: '-0.01em',
            }}
          >
            <span>🟡 Con el Contador</span>
            <span
              style={{
                background: 'var(--paper)',
                color: TONE.colContador.color,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11.5,
                fontWeight: 700,
                border: '1px solid var(--line)',
              }}
            >
              {cols.colContador.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: TONE.colContador.color, marginBottom: 12, fontWeight: 700 }}>
            Total: {money(cols.totales.colContador)}
          </div>
          <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4, paddingBottom: 16 }}>
            <AnimatePresence>{cols.colContador.map(renderCard)}</AnimatePresence>
            {cols.colContador.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, marginTop: 32 }}>
                Soltar aquí...
              </div>
            )}
          </div>
        </div>

        {/* 4. Columna En Caja Chica */}
        <div
          style={getColStyle('colCaja')}
          onDragOver={handleDragOver}
          onDragEnter={() => setActiveTarget('colCaja')}
          onDragLeave={() => setActiveTarget(null)}
          onDrop={(e) => handleDrop(e, 'colCaja')}
        >
          <div
            style={{
              fontWeight: 800,
              color: TONE.colCaja.color,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13.5,
              letterSpacing: '-0.01em',
            }}
          >
            <span>✅ En Caja Chica</span>
            <span
              style={{
                background: 'var(--paper)',
                color: TONE.colCaja.color,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 11.5,
                fontWeight: 700,
                border: '1px solid var(--line)',
              }}
            >
              {cols.colCaja.length}
            </span>
          </div>
          <div style={{ fontSize: 12, color: TONE.colCaja.color, marginBottom: 12, fontWeight: 700 }}>
            Total: {money(cols.totales.colCaja)}
          </div>
          <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4, paddingBottom: 16 }}>
            <AnimatePresence>{cols.colCaja.map(renderCard)}</AnimatePresence>
            {cols.colCaja.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, marginTop: 32 }}>
                Soltar aquí...
              </div>
            )}
          </div>
        </div>
      </KanbanScrollWrapper>

      {drawerTarget && (
        <InvoiceDrawer
          invoice={drawerTarget.inv}
          order={drawerTarget.o}
          dynamicConfig={dynamicConfig}
          onClose={() => setDrawerTarget(null)}
        />
      )}

      {quickCrTarget && (
        <QuickCrModal
          order={quickCrTarget.o}
          invoice={quickCrTarget.inv}
          onClose={() => setQuickCrTarget(null)}
        />
      )}
    </>
  );
}
