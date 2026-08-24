import { useState } from 'react';
import { doc, setDoc, serverTimestamp, Timestamp, addDoc, collection, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { toInputDate, fromInputDate, toDate } from '../../lib/format';
import { Modal, Field, Empty } from '../ui';
import type { Purchase, PurchaseOrder } from '../../lib/types';
import { newDeliveryEvent, updateDeliveryField, updateDeliveryItemQuantity, computeDeliveredTotals, migrateLegacyDeliveries, upsertAndresPurchase } from '../../lib/deliveries';
import { logAction, safeDeleteDoc } from '../../lib/logger';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { round2 } from '../../lib/finance';
import { confirmDialog } from '../../lib/confirmDialog';

export function OrderModal({ purchase, onClose, costPricePerKg }: { purchase: Purchase, onClose: () => void, costPricePerKg: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [montoOC, setMontoOC] = useState(purchase.totalAmount > 0 ? String(purchase.totalAmount) : '');
  const [fecha, setFecha] = useState(toInputDate(purchase.date ?? Timestamp.now()) || '');
  
  // No products needed in this specific simplified logic, they are in the order if anything
  const monto = Number(montoOC) || 0;
  const safeCostPrice = Number(costPricePerKg) > 0 ? Number(costPricePerKg) : 42;
  const kilosCalculados = round2(monto / safeCostPrice);

  async function save() {
    if (!monto || monto <= 0) return toast('El monto debe ser mayor a 0', 'bad');
    setBusy(true);
    try {
      const d = fromInputDate(fecha) ?? new Date();
      await setDoc(doc(db, PATHS.purchases, purchase.id), {
        date: Timestamp.fromDate(d),
        provider: purchase.provider || 'Andrés',
        expectedKilos: kilosCalculados,
        receivedKilos: purchase.receivedKilos ?? 0,
        pricePerKg: safeCostPrice,
        totalAmount: monto,
        paidAmount: purchase.paidAmount ?? 0,
        status: purchase.status ?? 'pedido',
        createdAt: purchase.createdAt ?? serverTimestamp(),
      }, { merge: true });
      
      await logAction(user?.email || 'Sistema', purchase.createdAt ? 'Edición de Anticipo/OC a Andrés' : 'Nuevo Anticipo/OC a Andrés', {
        id: purchase.id,
        montoOC: monto
      });

      toast('Orden guardada correctamente', 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirmDialog({ message: '¿Borrar esta orden?', danger: true }))) return;
    setBusy(true);
    try {
      await safeDeleteDoc(user?.email, doc(db, PATHS.purchases, purchase.id), purchase);
      toast('Borrada', 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={purchase.createdAt ? 'Editar Anticipo / OC' : 'Nueva Orden (Anticipo)'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Fecha">
          <input className="input boxed mono" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        
        <Field label="Monto Anticipado / OC ($)">
          <input 
            className="input boxed mono" 
            type="number" 
            step="0.01" 
            value={montoOC} 
            onChange={(e) => setMontoOC(e.target.value)} 
            placeholder="Ej. 145000"
            style={{ fontSize: 20, padding: 12, width: '100%' }}
          />
        </Field>
        
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1px dashed var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)' }}>
            💡 Con el costo actual de <strong>${costPricePerKg.toFixed(2)}/kg</strong>, este monto ampara automáticamente:
          </p>
          <div className="mono" style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--ok)', marginTop: 8 }}>
            {kilosCalculados > 0 ? kilosCalculados.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '0.00'} kg
          </div>
        </div>
      </div>
      
      <div className="modal-actions" style={{ marginTop: 24 }}>
        {purchase.createdAt && <button className="btn btn-danger" onClick={remove} disabled={busy}>Eliminar</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || monto <= 0}>Guardar</button>
      </div>
    </Modal>
  );
}

export function RegistrarEntregaModal({ order, onClose, costPricePerKg }: { order: PurchaseOrder, onClose: () => void, costPricePerKg: number }) {
  const toast = useToast();
  const { settings } = useSystemSettings();
  const [busy, setBusy] = useState(false);
  const [baselineUpdatedAt] = useState(() => order.updatedAt ?? null);
  const [existingDeliveries] = useState(() => migrateLegacyDeliveries(order, order.deliveries ?? []));
  const [nueva, setNueva] = useState(() => newDeliveryEvent(order.items ?? []));
  const { kilosEntregados, deliveredByItem } = computeDeliveredTotals(existingDeliveries);
  
  const kilosDeEsta = round2((nueva.items ?? []).reduce((a, x) => a + (Number(x.quantity) || 0), 0));
  const kilosPedidos = (order.items ?? []).reduce((a, x) => a + x.quantity, 0) || order.totalKilograms || 0;

  function setQty(itemId: string, qty: number) {
    const nextList = updateDeliveryItemQuantity([nueva], 0, itemId, qty);
    setNueva(nextList[0]);
  }

  function setFecha(v: string) {
    const date = fromInputDate(v);
    const nextList = updateDeliveryField([nueva], 0, 'date', date ? Timestamp.fromDate(date) : null);
    setNueva(nextList[0]);
  }

  async function guardar() {
    if (kilosDeEsta <= 0) return toast('Captura al menos una cantidad mayor a cero.', 'bad');
    const kilosRestantesPermitidos = Math.max(0, kilosPedidos - kilosEntregados);
    if (kilosPedidos > 0 && kilosDeEsta > kilosRestantesPermitidos) {
      return toast(`⚠️ Andrés no puede entregar más kilos de lo indicado en la OC (${kilosPedidos.toLocaleString('es-MX')} kg). Máximo permitido restante: ${kilosRestantesPermitidos.toLocaleString('es-MX')} kg.`, 'bad');
    }
    setBusy(true);
    try {
      const ref = doc(db, PATHS.orders, order.id);
      const nuevasDeliveries = [...existingDeliveries, nueva];
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');
        const freshUpdatedAt = (snap.data().updatedAt as Timestamp | undefined) ?? null;
        const tFresh = toDate(freshUpdatedAt)?.getTime();
        const tBase = toDate(baselineUpdatedAt)?.getTime();
        if (tBase && tFresh && tFresh !== tBase) {
          throw new Error('Este expediente fue modificado. Ciérralo y vuelve a intentarlo.');
        }
        tx.set(ref, { deliveries: nuevasDeliveries, updatedAt: serverTimestamp() }, { merge: true });
      });
      
      const { kilosEntregados: totalEntregadoAhora } = computeDeliveredTotals(nuevasDeliveries);
      
      await upsertAndresPurchase({
        orderId: order.id,
        // El proveedor real de material (Andres) esta configurado
        // globalmente -- no debe depender de lo que diga order.provider,
        // que puede reflejar el nombre del propio negocio del usuario si
        // vino de un texto de OC pegado (ver Iteracion correspondiente).
        provider: settings?.providerName || order.provider || 'Andrés',
        expectedKilos: kilosPedidos,
        receivedKilos: totalEntregadoAhora,
        costPerKg: order.customCostPrice ?? costPricePerKg,
      });
      
      toast(`Entrega de ${kilosDeEsta} kg registrada.`, 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo registrar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const kilosRestantesPermitidos = Math.max(0, kilosPedidos - kilosEntregados);

  return (
    <Modal title={`📦 Registrar Entrega en Báscula — ${order.folio || '(sin folio)'}`} onClose={onClose}>
      <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
          <span>Avance General de la OC:</span>
          <span>{kilosEntregados.toLocaleString('es-MX')} de {kilosPedidos.toLocaleString('es-MX')} kg ({kilosPedidos > 0 ? Math.round((kilosEntregados / kilosPedidos) * 100) : 0}%)</span>
        </div>
        <div style={{ width: '100%', height: 7, background: 'var(--bg-inset)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${kilosPedidos > 0 ? Math.min(100, Math.round((kilosEntregados / kilosPedidos) * 100)) : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 6 }}>
          <span>🔒 Tope Inviolable: {kilosPedidos.toLocaleString('es-MX')} kg (Cero mermas)</span>
          <span style={{ color: kilosRestantesPermitidos > 0 ? 'var(--accent)' : 'var(--ok)', fontWeight: 700 }}>
            {kilosRestantesPermitidos > 0 ? `Restante pendiente: ${kilosRestantesPermitidos.toLocaleString('es-MX')} kg` : '✓ OC Completa'}
          </span>
        </div>
      </div>

      <Field label="Fecha de esta entrega">
        <input type="date" className="input boxed mono" defaultValue={toInputDate(nueva.date) || ''} onChange={e => setFecha(e.target.value)} />
      </Field>
      
      {(order.items ?? []).length === 0 ? <Empty>Este expediente no tiene productos capturados.</Empty> : (
        <div className="table-scroll">
        <table className="data-table" style={{ width: '100%', marginTop: 12 }}>
          <thead>
            <tr>
              <th>Partida / Producto</th>
              <th className="num" style={{ width: 130 }}>Esta entrega (kg)</th>
              <th style={{ width: 140, textAlign: 'right' }}>Acción Rápida</th>
            </tr>
          </thead>
          <tbody>
            {(order.items ?? []).map((it, idx) => {
              const qty = (nueva.items ?? []).find((x) => x.itemId === it.id)?.quantity ?? 0;
              const deliveredThisItem = deliveredByItem[it.id] ?? 0;
              const pendingThisItem = Math.max(0, it.quantity - deliveredThisItem);
              const pctItem = it.quantity > 0 ? Math.min(100, Math.round((deliveredThisItem / it.quantity) * 100)) : 0;

              return (
                <tr key={it.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, background: 'var(--bg-inset)', padding: '2px 6px', borderRadius: 4 }}>
                        #{idx + 1}
                      </span>
                      <strong>{it.description || it.code}</strong>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                      <span>Pedido: <strong>{it.quantity.toLocaleString('es-MX')} kg</strong></span>
                      <span>Entregado: <strong style={{ color: 'var(--ok)' }}>{deliveredThisItem.toLocaleString('es-MX')} kg</strong> ({pctItem}%)</span>
                      <span>Falta: <strong style={{ color: pendingThisItem > 0 ? 'var(--bad)' : 'var(--ok)' }}>{pendingThisItem.toLocaleString('es-MX')} kg</strong></span>
                    </div>
                  </td>
                  <td className="num">
                    <input
                      className="input boxed mono"
                      type="number"
                      step="0.01"
                      style={{ width: 110, fontSize: 14, fontWeight: 700 }}
                      value={qty || ''}
                      placeholder="0"
                      onChange={e => setQty(it.id, Number(e.target.value))}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {pendingThisItem > 0 ? (
                      <button
                        type="button"
                        className="btn-small"
                        style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: '1px solid #3b82f6', fontWeight: 700, borderRadius: 6 }}
                        onClick={() => setQty(it.id, pendingThisItem)}
                      >
                        ⚡ Restante ({pendingThisItem.toLocaleString('es-MX')} kg)
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 800, padding: '4px 8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 6 }}>
                        ✓ Surtida
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={busy || kilosDeEsta <= 0}>Guardar {kilosDeEsta} kg</button>
      </div>
    </Modal>
  );
}


export function AjusteModal({ onClose, selectedProvider }: { onClose: () => void, selectedProvider: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState<'favor'|'contra'>('favor');
  const [concepto, setConcepto] = useState('Ajuste de conciliación');

  async function guardar() {
    const amount = Number(monto);
    if (!amount || amount <= 0) return toast('Monto inválido', 'bad');
    setBusy(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        date: Timestamp.now(),
        concept: `[AJUSTE] ${concepto.trim()}`,
        amount,
        type: tipo === 'favor' ? 'ingreso' : 'egreso', // Ingreso virtual baja la deuda (a favor nuestro).
        category: 'ajuste',
        provider: selectedProvider,
        createdAt: serverTimestamp(),
      });
      toast('Ajuste registrado con éxito', 'ok');
      onClose();
    } catch {
      toast('Error al guardar el ajuste', 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Ajuste de Saldo Manual" onClose={onClose}>
      <p className="hint" style={{ marginBottom: 16 }}>Inyecta un movimiento de conciliación para cuadrar el saldo por diferencias, mermas o devoluciones.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="Tipo de Ajuste">
          <select className="input boxed" value={tipo} onChange={e => setTipo(e.target.value as 'favor'|'contra')}>
            <option value="favor">A nuestro favor (Baja nuestra deuda con el proveedor)</option>
            <option value="contra">En contra (Sube nuestra deuda con el proveedor)</option>
          </select>
        </Field>
        <Field label="Monto del Ajuste ($)"><input className="input boxed mono" type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej. 3500" /></Field>
        <Field label="Justificación"><input className="input boxed" value={concepto} onChange={e => setConcepto(e.target.value)} /></Field>
      </div>
      <div className="modal-actions" style={{ marginTop: 24 }}><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={busy}>Guardar Ajuste</button></div>
    </Modal>
  );
}
