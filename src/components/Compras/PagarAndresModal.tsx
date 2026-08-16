import { useState, useMemo } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { Modal, Field } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useExpenses } from '../../hooks/useExpenses';
import { useOrders } from '../../hooks/useOrders';
import { useConfig } from '../../hooks/useConfig';
import { toInputDate, fromInputDate, money } from '../../lib/format';
import { confirmDialog } from '../../lib/confirmDialog';
import { computeCommissionFromInvoiceTotal } from '../../lib/finance';
import Decimal from 'decimal.js';

export function PagarAndresModal({ 
  onClose,
  initialAmount = 0
}: { 
  onClose: () => void;
  initialAmount?: number;
}) {
  const { expenses } = useExpenses();
  const { orders } = useOrders();
  const { config } = useConfig();
  const toast = useToast();

  const saldoCaja = useMemo(() => {
    return expenses.reduce((acc, e) => {
      return new Decimal(acc).plus(e.type === 'ingreso' ? e.amount : -e.amount).toNumber();
    }, 0);
  }, [expenses]);

  const dineroConContador = useMemo(() => {
    let neto = 0;
    orders.forEach((o) => {
      (o.invoices || []).forEach((inv) => {
        if (inv.creditCycle?.status === 'paid') {
          const tot = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          const comm = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(tot, config as any);
          neto += (tot - comm);
        }
      });
    });
    return neto;
  }, [orders, config]);

  const [pagoAbono, setPagoAbono] = useState({ 
    amount: initialAmount > 0 ? initialAmount.toString() : '', 
    concept: initialAmount > 0 ? 'Liquidación de Saldo Pendiente' : 'Abono a Cuenta / Anticipo', 
    date: toInputDate(new Date()) 
  });
  const [busy, setBusy] = useState(false);

  const montoNum = Number(pagoAbono.amount) || 0;
  const saldoRestante = new Decimal(saldoCaja).minus(montoNum).toNumber();
  const saldoInsuficiente = montoNum > saldoCaja;

  async function registrarAbono(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    
    const val = Number(pagoAbono.amount);
    if (isNaN(val) || val <= 0) return toast('El monto debe ser mayor a cero.', 'bad');
    if (!pagoAbono.concept.trim()) return toast('El concepto es obligatorio.', 'bad');
    
    if (val > saldoCaja) {
      const msg = `⚠️ ATENCIÓN: El saldo en efectivo en Caja Chica es de ${money(saldoCaja)}, pero deseas pagar ${money(val)} a Andrés.\n\nLa caja quedará en saldo negativo de ${money(saldoRestante)}.\n\n¿Estás completamente seguro de autorizar este pago?`;
      if (!(await confirmDialog(msg))) return;
    } else {
      if (!(await confirmDialog(`¿Confirmas registrar un pago/abono de ${money(val)} a Andrés saliendo de Caja Chica?`))) return;
    }
    
    setBusy(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        amount: val,
        concept: pagoAbono.concept.trim(),
        date: fromInputDate(pagoAbono.date)?.getTime() || Date.now(),
        provider: 'Andrés',
        type: 'egreso'
      });
      toast(`✅ Pago por ${money(val)} a Andrés registrado con éxito.`, 'ok');
      onClose();
    } catch (err: any) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="💳 Pagar o Adelantar Dinero a Andrés" onClose={onClose}>
      <form onSubmit={registrarAbono} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Panel Informativo de Efectivo en Caja */}
        <div
          style={{
            background: saldoInsuficiente ? 'rgba(239, 68, 68, 0.08)' : 'var(--paper-sunk)',
            border: `1px solid ${saldoInsuficiente ? '#ef4444' : 'var(--line)'}`,
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
              💵 Saldo Disponible en Caja Chica:
            </span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: saldoCaja < 0 ? '#dc2626' : '#059669' }}>
              {money(saldoCaja)}
            </span>
          </div>

          {montoNum > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-soft)', paddingTop: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                📉 Saldo Restante tras este Pago:
              </span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: saldoRestante < 0 ? '#dc2626' : '#059669' }}>
                {money(saldoRestante)}
              </span>
            </div>
          )}

          {saldoInsuficiente && montoNum > 0 && (
            <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(239,68,68,0.15)', borderRadius: 8, fontSize: 11.5, color: '#991b1b', lineHeight: 1.4 }}>
              <strong>⚠️ Saldo Insuficiente:</strong> No hay suficiente efectivo en Caja Chica para cubrir este pago.
              {dineroConContador > 0 && (
                <div style={{ marginTop: 4, color: '#1e40af' }}>
                  💡 <strong>Tip:</strong> Tienes <strong>{money(dineroConContador)}</strong> pendientes por recoger con el contador. Pasa ese dinero a caja primero antes de pagar.
                </div>
              )}
            </div>
          )}
        </div>

        <Field label="Monto a Pagar a Andrés ($)" full>
          <input 
            type="number" 
            step="0.01" 
            min="0.01"
            value={pagoAbono.amount}
            onChange={(e) => setPagoAbono({ ...pagoAbono, amount: e.target.value })}
            autoFocus 
            required 
            placeholder="Ej. 25000"
            style={{ fontSize: 16, fontWeight: 700 }}
          />
        </Field>
        
        <Field label="Concepto / Motivo" full>
          <input 
            type="text"
            value={pagoAbono.concept}
            onChange={(e) => setPagoAbono({ ...pagoAbono, concept: e.target.value })}
            required
            placeholder="Ej. Abono por fabricación de bolsas..."
          />
        </Field>
        
        <Field label="Fecha del Pago" full>
          <input 
            type="date"
            value={pagoAbono.date}
            onChange={(e) => setPagoAbono({ ...pagoAbono, date: e.target.value })}
            required
          />
        </Field>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              background: saldoInsuficiente ? '#ef4444' : 'var(--ok)', 
              borderColor: saldoInsuficiente ? '#dc2626' : 'var(--ok)', 
              color: '#fff',
              fontWeight: 800,
            }} 
            disabled={busy}
          >
            {busy ? 'Procesando...' : saldoInsuficiente ? '⚠️ Registrar Pago (Caja Negativa)' : '💰 Registrar Pago a Andrés'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

