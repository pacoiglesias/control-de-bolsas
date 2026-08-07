import { useContext, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CobranzaContext from './CobranzaContext';
import { daysLate, extractCr } from '../../lib/finance';
import { toDate, fmtDate, nombreClienteVisible } from '../../lib/format';
import { KanbanScrollWrapper } from '../ui/KanbanScrollWrapper';
import { InvoiceDrawer } from './InvoiceDrawer';
import { useConfig } from '../../hooks/useConfig';

export default function TableroKanban() {
  const { data, money, moveInvoice } = useContext(CobranzaContext)!;
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<{o: any, inv: any} | null>(null);
  const { config: dynamicConfig } = useConfig();

  const cols = useMemo(() => {
    const colRevision: any[] = [];
    const colPorCobrar: any[] = [];
    const colContador: any[] = [];
    const colCaja: any[] = [];

    // ANTES: `data.open` — el arreglo crudo de facturas abiertas, que NUNCA
    // tuvo el campo `hasCr` calculado (ese calculo solo vive en
    // `data.lista`, un arreglo derivado y separado). `!x.hasCr` sobre un
    // campo inexistente es siempre verdadero, asi que TODAS las facturas
    // caian en "Sin CR" sin importar si de verdad tenian un contrarecibo —
    // la propia tarjeta mostraba "CR: TH-836" en verde mientras el tablero
    // la clasificaba como "Sin CR". Con `data.lista` el campo ya viene
    // calculado correctamente.
    data.lista.forEach((x: any) => {
      if (!x.hasCr) {
        colRevision.push(x);
      } else {
        colPorCobrar.push(x);
      }
    });

    data.paid.forEach((x: any) => colContador.push(x));
    data.collected.forEach((x: any) => colCaja.push(x));

    // Sort "Por Cobrar" so overdue is at the top
    colPorCobrar.sort((a, b) => (b.d ?? -999) - (a.d ?? -999));

    // Deteccion de posibles duplicados: mismo CR (o mismo folio si no hay
    // CR) repetido dentro de la misma columna casi siempre significa un
    // expediente duplicado en la base de datos (como paso con la
    // migracion original), no un error de la pantalla. Se marca la
    // tarjeta en vez de esconderla, para que el usuario decida.
    //
    // OJO: varias facturas migradas comparten el folio generico "S/N"
    // (no vacio, el texto literal "S/N") como placeholder -- si se usa
    // como respaldo para comparar, TODAS las facturas de un mismo
    // expediente migrado se marcan como duplicadas entre si, sin serlo.
    // Un folio asi no distingue nada, asi que nunca cuenta como clave.
    const FOLIOS_PLACEHOLDER = new Set(['s/n', 'sin folio', '']);
    const marcarDuplicados = (arr: any[]) => {
      const contador: Record<string, number> = {};
      arr.forEach((x) => {
        const folioValido = !FOLIOS_PLACEHOLDER.has((x.inv.folio || '').trim().toLowerCase());
        const clave = x.cr || (folioValido ? x.inv.folio : '') || '';
        if (clave) contador[clave] = (contador[clave] || 0) + 1;
      });
      arr.forEach((x) => {
        const folioValido = !FOLIOS_PLACEHOLDER.has((x.inv.folio || '').trim().toLowerCase());
        const clave = x.cr || (folioValido ? x.inv.folio : '') || '';
        x._posibleDuplicado = clave && contador[clave] > 1;
      });
    };
    [colRevision, colPorCobrar, colContador, colCaja].forEach(marcarDuplicados);

    const sumaSaldo = (arr: any[]) => arr.reduce((acc, x) => acc + (x.saldo ?? 0), 0);
    // "saldo" es (monto de la factura - lo ya pagado por el cliente) --
    // correcto para "En Revision"/"Por Cobrar" (el cliente todavia debe
    // ese dinero), pero para "Con el Contador"/"En Caja Chica" el cliente
    // YA pago completo, asi que saldo siempre da 0 ahi, sin importar
    // cuantas tarjetas haya. El total de esas dos columnas debe sumar el
    // monto real de cada factura, no la deuda del cliente (que es cero
    // a proposito, no un error de datos).
    const montoFactura = (x: any) => x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0;
    const sumaMonto = (arr: any[]) => arr.reduce((acc, x) => acc + montoFactura(x), 0);

    return {
      colRevision, colPorCobrar, colContador, colCaja,
      totales: {
        colRevision: sumaSaldo(colRevision), colPorCobrar: sumaSaldo(colPorCobrar),
        colContador: sumaMonto(colContador), colCaja: sumaMonto(colCaja),
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
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        whileHover={{ y: -4, scale: 1.02, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        key={inv.id}
        draggable
        onDragStart={(e: any) => onDragStart(e, o.id, inv.id)}
        style={{
          background: 'var(--glass-bg)', 
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: x._posibleDuplicado ? '2px solid rgba(245, 158, 11, 0.5)' : isOverdue ? '2px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--glass-border)', 
          borderRadius: 16, 
          padding: 16,
          marginBottom: 12,
          cursor: 'grab',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
        }}
        onClick={() => setDrawerTarget({ o: x.o, inv: x.inv })}
      >
        {x._posibleDuplicado && (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '4px 8px', borderRadius: 6, marginBottom: 8, display: 'inline-block' }}>
            ⚠️ Posible duplicado — mismo CR en otra tarjeta
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' }}>
          <strong style={{ fontSize: 14, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{inv.folio || o.folio || 'Sin Folio'}</strong>
          <span style={{ fontSize: 15, fontWeight: 800, color: isOverdue ? '#dc2626' : 'var(--ink)', letterSpacing: '-0.02em' }}>{money(amt)}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12, fontWeight: 500 }}>
          {nombreClienteVisible(o.client)} {o.department ? <span style={{ opacity: 0.7 }}>({o.department})</span> : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: 11, background: cr ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.1)', color: cr ? '#166534' : '#475569', padding: '4px 8px', borderRadius: 6, fontWeight: 700, letterSpacing: '0.02em' }}>
            {cr ? `CR: ${cr}` : 'Sin CR'}
          </span>
          <span style={{ fontSize: 11, color: isOverdue ? '#dc2626' : 'var(--ink-soft)', fontWeight: isOverdue ? 700 : 500 }}>
            {isOverdue ? `Atraso: ${late} días` : (inv.creditCycle?.dueDate ? `Vence: ${fmtDate(inv.creditCycle.dueDate)}` : '')}
          </span>
        </div>
        
        {/* Quick Actions Bar */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          {(inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') && (
            <button 
              className="btn" 
              style={{ flex: 1, padding: '6px 8px', fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8 }}
              onClick={() => moveInvoice(o.id, inv.id, 'colContador')}
            >
              💸 Cobro Rápido
            </button>
          )}
          {inv.creditCycle.status === 'paid' && (
            <>
              <button 
                className="btn" 
                style={{ flex: 1, padding: '6px 8px', fontSize: 11, background: 'var(--ok)', color: '#fff', border: 'none', borderRadius: 8 }}
                onClick={() => moveInvoice(o.id, inv.id, 'colCaja')}
              >
                ✅ Recibir Efectivo
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, padding: '6px 8px', fontSize: 11, background: 'var(--paper-sunk)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8 }}
                onClick={() => moveInvoice(o.id, inv.id, 'colPorCobrar')}
              >
                ↩️ Deshacer
              </button>
            </>
          )}
          {inv.creditCycle.status === 'collected' && (
            <button 
              className="btn" 
              style={{ flex: 1, padding: '6px 8px', fontSize: 11, background: 'var(--paper-sunk)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8 }}
              onClick={() => moveInvoice(o.id, inv.id, 'colContador')}
            >
              ↩️ Revertir
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
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

  const getColStyle = (colId: string, baseBg: string) => ({
    flex: '0 0 320px', 
    background: activeTarget === colId ? 'rgba(30, 41, 59, 0.05)' : baseBg,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 20, 
    padding: 20, 
    display: 'flex', 
    flexDirection: 'column' as const, 
    maxHeight: '75vh',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: `1px solid ${activeTarget === colId ? 'rgba(30, 41, 59, 0.1)' : 'var(--glass-border)'}`,
    boxShadow: 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.3)'
  });

  return (
    <>
      <KanbanScrollWrapper>
      
      {/* Columna En Revisión */}
      <div 
        style={getColStyle('colRevision', 'linear-gradient(180deg, rgba(248, 250, 252, 0.7) 0%, rgba(241, 245, 249, 0.5) 100%)')}
        onDragOver={handleDragOver}
        onDragEnter={() => setActiveTarget('colRevision')}
        onDragLeave={() => setActiveTarget(null)}
        onDrop={(e) => handleDrop(e, 'colRevision')}
      >
        <div style={{ fontWeight: 800, color: '#334155', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, letterSpacing: '-0.02em' }}>
          <span>🔎 En Revisión (Sin CR)</span>
          <span style={{ background: 'rgba(51, 65, 85, 0.1)', color: '#334155', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{cols.colRevision.length}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, fontWeight: 700, paddingBottom: 16, borderBottom: '1px dashed rgba(0,0,0,0.1)' }}>Total: {money(cols.totales.colRevision)}</div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 8, paddingBottom: 20 }}>
          <AnimatePresence>
            {cols.colRevision.map(renderCard)}
          </AnimatePresence>
          {cols.colRevision.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 40, fontWeight: 500 }}>Soltar aquí...</div>}
        </div>
      </div>

      {/* Columna Por Cobrar */}
      <div 
        style={getColStyle('colPorCobrar', 'linear-gradient(180deg, rgba(254, 242, 242, 0.7) 0%, rgba(254, 226, 226, 0.5) 100%)')}
        onDragOver={handleDragOver}
        onDragEnter={() => setActiveTarget('colPorCobrar')}
        onDragLeave={() => setActiveTarget(null)}
        onDrop={(e) => handleDrop(e, 'colPorCobrar')}
      >
        <div style={{ fontWeight: 800, color: '#991b1b', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, letterSpacing: '-0.02em' }}>
          <span>⏳ Por Cobrar (Con CR)</span>
          <span style={{ background: 'rgba(153, 27, 27, 0.1)', color: '#991b1b', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{cols.colPorCobrar.length}</span>
        </div>
        <div style={{ fontSize: 13, color: '#991b1b', opacity: 0.8, marginBottom: 16, fontWeight: 700, paddingBottom: 16, borderBottom: '1px dashed rgba(153, 27, 27, 0.2)' }}>Total: {money(cols.totales.colPorCobrar)}</div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 8, paddingBottom: 20 }}>
          <AnimatePresence>
            {cols.colPorCobrar.map(renderCard)}
          </AnimatePresence>
          {cols.colPorCobrar.length === 0 && <div style={{ textAlign: 'center', color: '#fca5a5', fontSize: 13, marginTop: 40, fontWeight: 500 }}>Soltar aquí...</div>}
        </div>
      </div>

      {/* Columna Con Contador */}
      <div 
        style={getColStyle('colContador', 'linear-gradient(180deg, rgba(255, 251, 235, 0.8) 0%, rgba(254, 243, 199, 0.6) 100%)')}
        onDragOver={handleDragOver}
        onDragEnter={() => setActiveTarget('colContador')}
        onDragLeave={() => setActiveTarget(null)}
        onDrop={(e) => handleDrop(e, 'colContador')}
      >
        <div style={{ fontWeight: 800, color: '#b45309', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, letterSpacing: '-0.02em' }}>
          <span>🟡 Con el Contador</span>
          <span style={{ background: 'rgba(180, 83, 9, 0.1)', color: '#b45309', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{cols.colContador.length}</span>
        </div>
        <div style={{ fontSize: 13, color: '#b45309', opacity: 0.8, marginBottom: 16, fontWeight: 700, paddingBottom: 16, borderBottom: '1px dashed rgba(180, 83, 9, 0.2)' }}>Total: {money(cols.totales.colContador)}</div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 8, paddingBottom: 20 }}>
          <AnimatePresence>
            {cols.colContador.map(renderCard)}
          </AnimatePresence>
          {cols.colContador.length === 0 && <div style={{ textAlign: 'center', color: '#fcd34d', fontSize: 13, marginTop: 40, fontWeight: 500 }}>Soltar aquí...</div>}
        </div>
      </div>

      {/* Columna En Caja */}
      <div 
        style={getColStyle('colCaja', 'linear-gradient(180deg, rgba(240, 253, 244, 0.8) 0%, rgba(220, 252, 231, 0.6) 100%)')}
        onDragOver={handleDragOver}
        onDragEnter={() => setActiveTarget('colCaja')}
        onDragLeave={() => setActiveTarget(null)}
        onDrop={(e) => handleDrop(e, 'colCaja')}
      >
        <div style={{ fontWeight: 800, color: '#166534', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, letterSpacing: '-0.02em' }}>
          <span>✅ En Caja Chica</span>
          <span style={{ background: 'rgba(22, 101, 52, 0.1)', color: '#166534', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{cols.colCaja.length}</span>
        </div>
        <div style={{ fontSize: 13, color: '#166534', opacity: 0.8, marginBottom: 16, fontWeight: 700, paddingBottom: 16, borderBottom: '1px dashed rgba(22, 101, 52, 0.2)' }}>Total: {money(cols.totales.colCaja)}</div>
        <div className="kanban-col-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 8, paddingBottom: 20 }}>
          <AnimatePresence>
            {cols.colCaja.map(renderCard)}
          </AnimatePresence>
          {cols.colCaja.length === 0 && <div style={{ textAlign: 'center', color: '#86efac', fontSize: 13, marginTop: 40, fontWeight: 500 }}>Soltar aquí...</div>}
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
    </>
  );
}
