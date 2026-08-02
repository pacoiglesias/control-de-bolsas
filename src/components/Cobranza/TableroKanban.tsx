import { useContext, useMemo } from 'react';
import CobranzaContext from './CobranzaContext';
import { daysLate } from '../../lib/finance';
import { toDate, fmtDate } from '../../lib/format';

export default function TableroKanban() {
  const { data, money, setSelected } = useContext(CobranzaContext)!;

  const cols = useMemo(() => {
    const colRevision: any[] = [];
    const colPorCobrar: any[] = [];
    const colContador: any[] = [];
    const colCaja: any[] = [];

    data.open.forEach((x: any) => {
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

    return { colRevision, colPorCobrar, colContador, colCaja };
  }, [data]);

  const renderCard = (x: any) => {
    const o = x.o;
    const inv = x.inv;
    const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
    const amt = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
    const late = daysLate(toDate(inv.creditCycle?.dueDate));
    const isOverdue = late !== null && late > 0;
    
    return (
      <div 
        key={inv.id} 
        style={{
          background: 'var(--surface)', 
          border: isOverdue ? '2px solid #fca5a5' : '1px solid var(--border)', 
          borderRadius: 8, 
          padding: 12,
          marginBottom: 10,
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
        onClick={() => setSelected(o)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{inv.folio || o.folio || 'Sin Folio'}</strong>
          <span style={{ fontSize: 13, fontWeight: 700, color: isOverdue ? '#b91c1c' : 'var(--ink)' }}>{money(amt)}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8 }}>
          {o.client} {o.department ? `(${o.department})` : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, background: cr ? '#bbf7d0' : '#e2e8f0', color: cr ? '#166534' : '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{cr ? `CR: ${cr}` : 'Sin CR'}</span>
          <span style={{ fontSize: 11, color: isOverdue ? '#b91c1c' : 'var(--ink-soft)', fontWeight: isOverdue ? 700 : 400 }}>
            {isOverdue ? `Atraso: ${late} días` : (inv.creditCycle?.dueDate ? `Vence: ${fmtDate(inv.creditCycle.dueDate)}` : '')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, marginTop: 16 }}>
      
      {/* Columna En Revisión */}
      <div style={{ flex: '0 0 300px', background: '#f8fafc', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        <div style={{ fontWeight: 700, color: '#334155', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>🔎 En Revisión (Sin CR)</span>
          <span style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.colRevision.length}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.colRevision.map(renderCard)}
          {cols.colRevision.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 20 }}>Vacío</div>}
        </div>
      </div>

      {/* Columna Por Cobrar */}
      <div style={{ flex: '0 0 300px', background: '#fef2f2', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>⏳ Por Cobrar (Con CR)</span>
          <span style={{ background: '#fca5a5', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.colPorCobrar.length}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.colPorCobrar.map(renderCard)}
          {cols.colPorCobrar.length === 0 && <div style={{ textAlign: 'center', color: '#fca5a5', fontSize: 13, marginTop: 20 }}>Vacío</div>}
        </div>
      </div>

      {/* Columna Con Contador */}
      <div style={{ flex: '0 0 300px', background: '#fffbeb', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>🟡 Con el Contador</span>
          <span style={{ background: '#fde68a', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.colContador.length}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.colContador.map(renderCard)}
          {cols.colContador.length === 0 && <div style={{ textAlign: 'center', color: '#fcd34d', fontSize: 13, marginTop: 20 }}>Vacío</div>}
        </div>
      </div>

      {/* Columna En Caja */}
      <div style={{ flex: '0 0 300px', background: '#f0fdf4', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        <div style={{ fontWeight: 700, color: '#166534', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>✅ En Caja Chica</span>
          <span style={{ background: '#bbf7d0', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cols.colCaja.length}</span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {cols.colCaja.map(renderCard)}
          {cols.colCaja.length === 0 && <div style={{ textAlign: 'center', color: '#86efac', fontSize: 13, marginTop: 20 }}>Vacío</div>}
        </div>
      </div>

    </div>
  );
}
