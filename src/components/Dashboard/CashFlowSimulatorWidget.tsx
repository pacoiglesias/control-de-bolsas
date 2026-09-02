import { useState, useMemo } from 'react';
import { money, kilos, fmtDate, toDate } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';

interface WeekProjection {
  weekNum: number;
  label: string;
  dateRange: string;
  grossInflow: number;
  subtotal: number;
  commission: number;
  netCashFlow: number;
  andresKgCapacity: number;
  crs: Array<{ cr: string; amount: number; dept: string; folios: string[]; dueDate: Date }>;
}

export function CashFlowSimulatorWidget({
  orders,
  config,
}: {
  orders: PurchaseOrder[];
  config: FinancialConfig;
}) {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const costKg = config?.costPricePerKg || 38;
  const commRate = config?.commissionRate || 0.08;

  // Proyección de 4 semanas de Septiembre 2026
  const weekProjections = useMemo(() => {
    const weeks: WeekProjection[] = [
      { weekNum: 1, label: 'Semana 1', dateRange: '01 - 07 Sep', grossInflow: 0, subtotal: 0, commission: 0, netCashFlow: 0, andresKgCapacity: 0, crs: [] },
      { weekNum: 2, label: 'Semana 2', dateRange: '08 - 14 Sep', grossInflow: 0, subtotal: 0, commission: 0, netCashFlow: 0, andresKgCapacity: 0, crs: [] },
      { weekNum: 3, label: 'Semana 3', dateRange: '15 - 21 Sep', grossInflow: 0, subtotal: 0, commission: 0, netCashFlow: 0, andresKgCapacity: 0, crs: [] },
      { weekNum: 4, label: 'Semana 4', dateRange: '22 - 30 Sep', grossInflow: 0, subtotal: 0, commission: 0, netCashFlow: 0, andresKgCapacity: 0, crs: [] },
    ];

    const seenCrs = new Set<string>();

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted) return;
      const isTH = (o.client || '').toUpperCase().includes('TH') || (o.folio || '').includes('14114');
      const dept = isTH ? 'TH' : 'GT';

      (o.invoices || []).forEach((inv) => {
        if (!inv) return;
        const cr = extractCr(inv, o);
        const isPaid = inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected';
        if (isPaid) return;

        const due = toDate(inv.creditCycle?.dueDate || inv.collection?.contrareciboDate);
        if (!due) return;

        const amt = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * 43 * 1.16);
        if (amt <= 0) return;

        if (cr && seenCrs.has(cr)) return;
        if (cr) seenCrs.add(cr);

        const day = due.getDate();
        const month = due.getMonth(); // 8 = Sep

        // Si es de Septiembre o antes (vencido se acumula en sem 1)
        let targetWeekIdx = 0;
        if (month < 8) {
          targetWeekIdx = 0; // Vencidos en semana 1
        } else if (month === 8) {
          if (day <= 7) targetWeekIdx = 0;
          else if (day <= 14) targetWeekIdx = 1;
          else if (day <= 21) targetWeekIdx = 2;
          else targetWeekIdx = 3;
        } else {
          targetWeekIdx = 3;
        }

        const sub = amt / 1.16;
        const comm = sub * commRate;
        const net = amt - comm; // Cobro menos comisión del contador

        weeks[targetWeekIdx].grossInflow += amt;
        weeks[targetWeekIdx].subtotal += sub;
        weeks[targetWeekIdx].commission += comm;
        weeks[targetWeekIdx].netCashFlow += net;
        weeks[targetWeekIdx].crs.push({
          cr: cr || `F-#${inv.folio || 'S/F'}`,
          amount: amt,
          dept,
          folios: [inv.folio || 'S/F'],
          dueDate: due,
        });
      });
    });

    // Calcular capacidad de compra con Andrés
    weeks.forEach((w) => {
      w.andresKgCapacity = w.netCashFlow > 0 ? w.netCashFlow / costKg : 0;
    });

    return weeks;
  }, [orders, costKg, commRate]);

  const currentW = weekProjections.find((w) => w.weekNum === selectedWeek) || weekProjections[0];

  return (
    <div
      style={{
        background: 'var(--glass-bg, var(--paper))',
        border: '1px solid var(--card-border, var(--line))',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔮</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
              Simulador de Flujo Semanal & Capacidad de Compra
            </h3>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
            Proyección de cobro neto a Providencia y capacidad de anticipo para toneladas con Andrés ($38/kg).
          </p>
        </div>

        {/* Selector de Semanas */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--paper-sunk)', padding: 4, borderRadius: 10 }}>
          {weekProjections.map((w) => (
            <button
              key={w.weekNum}
              type="button"
              className={`btn ${selectedWeek === w.weekNum ? '' : 'secondary'}`}
              style={{
                fontSize: 11.5,
                padding: '5px 12px',
                fontWeight: 800,
                background: selectedWeek === w.weekNum ? '#059669' : undefined,
                color: selectedWeek === w.weekNum ? '#fff' : undefined,
                border: 'none',
              }}
              onClick={() => {
                triggerHaptic('light');
                setSelectedWeek(w.weekNum);
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de 4 Pilares de la Semana Seleccionada */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ background: 'var(--paper-sunk)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            1. Ingreso Providencia ({currentW.dateRange})
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
            {money(currentW.grossInflow)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
            {currentW.crs.length} Contrarecibos programados
          </div>
        </div>

        <div style={{ background: 'var(--paper-sunk)', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            2. Comisión Contador (8% Subtotal)
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
            -{money(currentW.commission)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
            Retención bancaria del despacho
          </div>
        </div>

        <div style={{ background: 'var(--paper-sunk)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(5, 150, 105, 0.3)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: '#059669' }}>
            3. Flujo Neto Libre en Caja
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
            {money(currentW.netCashFlow)}
          </div>
          <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
            Efectivo entregado por contador
          </div>
        </div>

        <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: '#818cf8' }}>
            4. Capacidad Compra Andrés
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#a5b4fc', marginTop: 4 }}>
            {kilos(currentW.andresKgCapacity)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2 }}>
            {(currentW.andresKgCapacity / 1000).toFixed(2)} Toneladas a $38/kg
          </div>
        </div>
      </div>

      {/* Desglose de Contrarecibos de la Semana */}
      {currentW.crs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Contrarecibos de {currentW.label}:
          </span>
          {currentW.crs.map((c) => (
            <span
              key={c.cr}
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                background: c.dept === 'TH' ? '#e0f2fe' : '#dcfce7',
                color: c.dept === 'TH' ? '#0369a1' : '#15803d',
                border: c.dept === 'TH' ? '1px solid #bae6fd' : '1px solid #bbf7d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{c.cr}</span>
              <span style={{ color: 'var(--ink)', fontWeight: 900 }}>({money(c.amount)})</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>· {fmtDate(c.dueDate)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
