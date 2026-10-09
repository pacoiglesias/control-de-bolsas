import React, { useMemo, useState } from 'react';
import { Modal } from '../ui';
import { money, kilos, fmtDayAndDate, toDate } from '../../lib/format';
import type { PurchaseOrder, Expense, FinancialConfig } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';
import { sound } from '../../lib/sounds';
import { openWhatsAppMessage } from '../../lib/whatsappReminder';

interface DailyClosingModalProps {
  orders: PurchaseOrder[];
  expenses: Expense[];
  config: FinancialConfig;
  saldoCaja: number;
  onClose: () => void;
}

export const DailyClosingModal: React.FC<DailyClosingModalProps> = ({
  orders,
  expenses,
  config: _config,
  saldoCaja,
  onClose,
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Checklist de control diario
  const [checks, setChecks] = useState({
    remisionesFirmadas: false,
    facturasPortal: false,
    bancoConciliado: false,
    cajaCuadrada: false,
  });

  // 1. Entregas de Báscula de Hoy
  const entregasHoy = useMemo(() => {
    const list: Array<{ orderFolio: string; client: string; kilos: number; remision?: string }> = [];
    for (const o of orders) {
      for (const d of o.deliveries || []) {
        const dt = toDate(d.date);
        if (dt) {
          const dMid = new Date(dt);
          dMid.setHours(0, 0, 0, 0);
          if (dMid.getTime() === today.getTime()) {
            list.push({
              orderFolio: o.folio || o.oc || 'S/N',
              client: o.client || 'Providencia',
              kilos: Number(d.kilos) || 0,
              remision: (d as any).remision || d.docFolio,
            });
          }
        }
      }
    }
    return list;
  }, [orders, today]);

  const totalKilosHoy = useMemo(() => entregasHoy.reduce((s, e) => s + e.kilos, 0), [entregasHoy]);

  // 2. Facturación CFDI de Hoy
  const facturasHoy = useMemo(() => {
    const list: Array<{ folio: string; orderFolio: string; kilos: number; total: number }> = [];
    for (const o of orders) {
      for (const inv of o.invoices || []) {
        const dt = toDate(inv.creditCycle?.issueDate || (inv as any).createdAt);
        if (dt) {
          const dMid = new Date(dt);
          dMid.setHours(0, 0, 0, 0);
          if (dMid.getTime() === today.getTime()) {
            list.push({
              folio: inv.folio || 'S/F',
              orderFolio: o.folio || o.oc || 'S/N',
              kilos: inv.kilos || 0,
              total: inv.financials?.invoiceTotal || 0,
            });
          }
        }
      }
    }
    return list;
  }, [orders, today]);

  const totalFacturadoHoy = useMemo(() => facturasHoy.reduce((s, f) => s + f.total, 0), [facturasHoy]);

  // 3. Cobros y Movimientos de Caja de Hoy
  const movimientosCajaHoy = useMemo(() => {
    return expenses.filter((e) => {
      const dt = toDate(e.date || e.createdAt);
      if (!dt) return false;
      const dMid = new Date(dt);
      dMid.setHours(0, 0, 0, 0);
      return dMid.getTime() === today.getTime();
    });
  }, [expenses, today]);

  const ingresosCajaHoy = useMemo(
    () => movimientosCajaHoy.filter((e) => e.type === 'ingreso').reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [movimientosCajaHoy]
  );

  const egresosCajaHoy = useMemo(
    () => movimientosCajaHoy.filter((e) => e.type === 'egreso').reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [movimientosCajaHoy]
  );

  const allChecked = checks.remisionesFirmadas && checks.facturasPortal && checks.bancoConciliado && checks.cajaCuadrada;

  const handleShareReport = () => {
    triggerHaptic('medium');
    sound.playSuccess();

    const text = `📊 *CIERRE OPERATIVO DIARIO · ${fmtDayAndDate(today)}*
🏢 *Elemental Denim / Control de Bolsas*

⚖️ *BÁSCULA Y RECEPCIÓN:*
• Entregas registradas hoy: ${entregasHoy.length} remisiones
• Total Kilos recibidos: ${kilos(totalKilosHoy)}

🧾 *FACTURACIÓN CFDI:*
• Facturas timbradas hoy: ${facturasHoy.length} CFDIs
• Total Facturado: ${money(totalFacturadoHoy)}

💵 *FLUJO DE CAJA CHICA:*
• Ingresos hoy: ${money(ingresosCajaHoy)}
• Egresos hoy: ${money(egresosCajaHoy)}
• Saldo actual en Caja: ${money(saldoCaja)}

✅ *CHECKLIST DE CIERRE:*
• Remisiones firmadas en orden: ${checks.remisionesFirmadas ? 'SÍ ✓' : 'PENDIENTE ⚠️'}
• Facturas en Portal Providencia: ${checks.facturasPortal ? 'SÍ ✓' : 'PENDIENTE ⚠️'}
• Conciliación bancaria: ${checks.bancoConciliado ? 'SÍ ✓' : 'PENDIENTE ⚠️'}
• Arqueo de Caja Chica: ${checks.cajaCuadrada ? 'SÍ ✓' : 'PENDIENTE ⚠️'}`;

    openWhatsAppMessage(text);
  };

  return (
    <Modal
      wide
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🏁</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
              Cierre Operativo y Conciliación del Día
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              {fmtDayAndDate(today)} · Balance integral de báscula, facturación, cobranza y caja
            </div>
          </div>
        </div>
      }
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Métricas Resumidas del Día */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div
            style={{
              padding: '14px',
              borderRadius: 12,
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase' }}>
              ⚖️ Báscula (Entregas Hoy)
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {kilos(totalKilosHoy)}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
              {entregasHoy.length} remisiones en planta
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
              🧾 Facturación Emitida Hoy
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {money(totalFacturadoHoy)}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
              {facturasHoy.length} facturas timbradas
            </div>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
              💵 Saldo en Caja Chica
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {money(saldoCaja)}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
              +{money(ingresosCajaHoy)} / -{money(egresosCajaHoy)} hoy
            </div>
          </div>
        </div>

        {/* Checklist Operativo de Cierre */}
        <div
          style={{
            padding: '16px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', marginBottom: 12 }}>
            📋 Checklist Obligatorio de Validación antes de Cerrar Jornada:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={checks.remisionesFirmadas}
                onChange={(e) => { triggerHaptic('light'); setChecks((p) => ({ ...p, remisionesFirmadas: e.target.checked })); }}
                style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
              />
              <span>1. Todas las entregas del día tienen remisión/ticket sellado por el Almacén receptor.</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={checks.facturasPortal}
                onChange={(e) => { triggerHaptic('light'); setChecks((p) => ({ ...p, facturasPortal: e.target.checked })); }}
                style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
              />
              <span>2. Los CFDIs timbrados fueron subidos y validados en el Portal de Proveedores Providencia.</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={checks.bancoConciliado}
                onChange={(e) => { triggerHaptic('light'); setChecks((p) => ({ ...p, bancoConciliado: e.target.checked })); }}
                style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
              />
              <span>3. Los depósitos bancarios recibidos coinciden con las facturas marcadas como pagadas.</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={checks.cajaCuadrada}
                onChange={(e) => { triggerHaptic('light'); setChecks((p) => ({ ...p, cajaCuadrada: e.target.checked })); }}
                style={{ width: 18, height: 18, accentColor: '#3b82f6' }}
              />
              <span>4. El saldo en efectivo de Caja Chica coincide con el registro del sistema ({money(saldoCaja)}).</span>
            </label>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={onClose}>
            Cerrar Ventana
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleShareReport}
            style={{
              background: allChecked
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              borderColor: 'transparent',
              fontWeight: 800,
            }}
          >
            <span>📲 Compartir Resumen de Cierre (WhatsApp)</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
