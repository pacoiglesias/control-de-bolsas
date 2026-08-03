import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { Modal, Field } from '../ui';
import { useToast } from '../../context/ToastContext';
import { toInputDate, fromInputDate, money } from '../../lib/format';

export function PagarAndresModal({ 
  onClose,
  initialAmount = 0
}: { 
  onClose: () => void;
  initialAmount?: number;
}) {
  const [pagoAbono, setPagoAbono] = useState({ 
    amount: initialAmount > 0 ? initialAmount.toString() : '', 
    concept: initialAmount > 0 ? 'Liquidación de Saldo Pendiente' : 'Abono a Cuenta / Anticipo', 
    date: toInputDate(new Date()) 
  });
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function registrarAbono(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    
    const val = Number(pagoAbono.amount);
    if (isNaN(val) || val <= 0) return toast('El monto debe ser mayor a cero.', 'bad');
    if (!pagoAbono.concept.trim()) return toast('El concepto es obligatorio.', 'bad');
    
    if (!confirm(`¿Confirmas registrar un abono de $${val.toLocaleString('es-MX')} a Andrés?`)) return;
    
    setBusy(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        amount: val,
        concept: pagoAbono.concept.trim(),
        date: fromInputDate(pagoAbono.date)?.getTime() || Date.now(),
        provider: 'Andrés', // Hardcoded provider to guarantee consistency
        type: 'egreso' // Dinero que sale de caja
      });
      toast(`Abono por ${money(val)} registrado correctamente.`, 'ok');
      onClose();
    } catch (err: any) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="💸 Registrar Abono a Andrés" onClose={onClose}>
      <form onSubmit={registrarAbono} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="hint" style={{ margin: 0 }}>
          Este pago saldrá directamente de la <strong>Caja Chica</strong> y reducirá la deuda actual con Andrés.
        </p>

        <Field label="Monto a Pagar ($)" full>
          <input 
            type="number" 
            step="0.01" 
            min="0"
            value={pagoAbono.amount}
            onChange={(e) => setPagoAbono({ ...pagoAbono, amount: e.target.value })}
            autoFocus 
            required 
            placeholder="Ej. 15000"
          />
        </Field>
        
        <Field label="Concepto / Motivo" full>
          <input 
            type="text"
            value={pagoAbono.concept}
            onChange={(e) => setPagoAbono({ ...pagoAbono, concept: e.target.value })}
            required
            placeholder="Abono semanal..."
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
          <button type="submit" className="btn" style={{ background: 'var(--ok)', borderColor: 'var(--ok)', color: '#fff' }} disabled={busy}>
            {busy ? 'Procesando...' : '💰 Registrar Pago'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
