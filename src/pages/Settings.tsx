import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { saveConfig, useConfig } from '../hooks/useConfig';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { Card, Field, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { computeFinancials } from '../lib/finance';
import { money, percent } from '../lib/format';
import { DEFAULT_CONFIG, type FinancialConfig } from '../lib/types';

export default function Settings() {
  const { config, loading, exists } = useConfig();
  const { orders } = useOrders();
  const { user, role } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<FinancialConfig>(config);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(config), [config]);

  const preview = computeFinancials(1000, form);
  const dirty = JSON.stringify(form) !== JSON.stringify(config);

  async function onSave() {
    if (form.salePricePerKg <= 0 || form.costPricePerKg < 0) {
      toast('Los precios no pueden ser cero o negativos.', 'bad');
      return;
    }
    if (form.commissionRate < 0 || form.commissionRate > 1) {
      toast('La comisión va en decimal: 0.069 es 6.9%.', 'bad');
      return;
    }
    setBusy(true);
    try {
      await saveConfig(form);
      await logAction(user?.email, 'Configuración Financiera Modificada', {
        oldConfig: config,
        newConfig: form
      });
      toast('Configuración guardada. Las próximas órdenes usarán estos valores.', 'ok');
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  /** Recalcula órdenes ya procesadas con los precios actuales.
   *  Solo toca las que no están cobradas: lo cobrado es historia. */
  async function recalcular() {
    const target = orders.filter(
      (o) => o.creditCycle?.status !== 'paid' && (o.totalKilograms ?? 0) > 0,
    );
    if (target.length === 0) {
      toast('No hay órdenes abiertas que recalcular.', 'bad');
      return;
    }
    if (!window.confirm(`Se recalcularán ${target.length} órdenes con los precios actuales. ¿Continuar?`))
      return;
    setBusy(true);
    try {
      // Firestore permite 500 operaciones por lote.
      for (let i = 0; i < target.length; i += 400) {
        const batch = writeBatch(db);
        target.slice(i, i + 400).forEach((o) => {
          batch.update(doc(db, PATHS.orders, o.id), {
            financials: computeFinancials(o.totalKilograms ?? 0, config),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      await logAction(user?.email, 'Recálculo Masivo Ejecutado', { 
        count: target.length,
        configUsed: config
      });
      toast(`${target.length} órdenes recalculadas`, 'ok');
    } catch (e) {
      toast(`Falló el recálculo: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function tocarConfig() {
    try {
      await updateDoc(doc(db, PATHS.config, PATHS.configFinancials), { updatedAt: serverTimestamp() });
    } catch {
      /* el documento puede no existir todavía */
    }
  }

  if (loading) return <Spinner />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  return (
    <>
      <div className="page-head">
        <h1>Configuración</h1>
        <p>
          Estos valores viven en <code>config/financials</code> y los usan tanto esta interfaz como
          la Cloud Function. Cambiarlos aquí cambia el cálculo de toda orden que se procese después.
        </p>
      </div>

      {!exists && (
        <div className="alert warn">
          El documento <code>config/financials</code> todavía no existe. Guarda una vez para crearlo;
          mientras tanto el backend usa los valores por omisión ({money(DEFAULT_CONFIG.salePricePerKg)}/
          {money(DEFAULT_CONFIG.costPricePerKg)}/{percent(DEFAULT_CONFIG.commissionRate)}).
        </div>
      )}

      <Card title="Reglas financieras">
        <div style={{ padding: 16 }}>
          <div className="form-grid">
            <Field label="Precio de venta por kilo">
              <input className="input boxed mono" type="number" step="0.01" value={form.salePricePerKg}
                onChange={(e) => setForm({ ...form, salePricePerKg: Number(e.target.value) })} />
            </Field>
            <Field label="Costo por kilo">
              <input className="input boxed mono" type="number" step="0.01" value={form.costPricePerKg}
                onChange={(e) => setForm({ ...form, costPricePerKg: Number(e.target.value) })} />
            </Field>
            <Field label="Comisión del contador (%)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="input boxed mono"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={parseFloat((form.commissionRate * 100).toFixed(4))}
                  onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) / 100 })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                Actual: {(form.commissionRate * 100).toFixed(2)}% — equivale a {form.commissionRate.toFixed(4)} en decimal
              </div>
            </Field>
            <Field label="Días de crédito">
              <input className="input boxed mono" type="number" step="1" value={form.creditDays}
                onChange={(e) => setForm({ ...form, creditDays: Number(e.target.value) })} />
            </Field>
            <Field label="IVA (%)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="input boxed mono"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={parseFloat((form.ivaRate * 100).toFixed(2))}
                  onChange={(e) => setForm({ ...form, ivaRate: Number(e.target.value) / 100 })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>%</span>
              </div>
            </Field>
            <Field label="Contabilidad cobra su comisión sobre">
              <select className="input boxed" value={form.commissionBase}
                onChange={(e) => setForm({ ...form, commissionBase: e.target.value as 'subtotal' | 'total' })}>
                <option value="subtotal">el subtotal (sin IVA)</option>
                <option value="total">el total facturado (con IVA)</option>
              </select>
            </Field>
          </div>

          <div className="calc-box" style={{ marginTop: 16 }}>
            <div className="calc-line"><span>Ejemplo con 1,000 kg — subtotal</span><span className="mono">{money(preview.saleTotal)}</span></div>
            <div className="calc-line"><span>IVA {percent(form.ivaRate)} — lo cobras y lo enteras, no es tuyo</span><span className="mono">{money(preview.invoiceTotal - preview.saleTotal)}</span></div>
            <div className="calc-line"><span>Total que le cobras al cliente</span><span className="mono">{money(preview.invoiceTotal)}</span></div>
            <div className="calc-line"><span>Costo</span><span className="mono">− {money(preview.costTotal)}</span></div>
            <div className="calc-line"><span>Comisión {percent(form.commissionRate)}</span><span className="mono">− {money(preview.commission)}</span></div>
            <div className="calc-line total"><span>Flujo neto por cada 1,000 kg</span><span className="mono">{money(preview.netCashFlow)}</span></div>
            <div className="calc-line"><span>Margen sobre venta</span><span className="mono">{((preview.netCashFlow / preview.saleTotal) * 100).toFixed(2)}%</span></div>
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={() => setForm(config)} disabled={!dirty || busy}>Descartar</button>
            <button className="btn btn-primary" onClick={() => void onSave().then(tocarConfig)} disabled={!dirty || busy}>
              {busy ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      </Card>

      <Card title="Mantenimiento">
        <div style={{ padding: 16 }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Al cambiar precios, las órdenes ya procesadas conservan los valores con los que se
            crearon. Si quieres alinearlas al precio nuevo, recalcula: se actualizan las órdenes
            abiertas y las cobradas se quedan como están, porque ese dinero ya se movió.
          </p>
          <button className="btn" onClick={() => void recalcular()} disabled={busy}>
            ↻ Recalcular órdenes abiertas con los precios actuales
          </button>
        </div>
      </Card>

      <Card title="Sesión y seguridad">
        <div style={{ padding: 16 }} className="link-list">
          <div className="li"><span className="lg">Usuario</span><span className="lv">{user?.email}</span></div>
          <div className="li"><span className="lg">UID</span><span className="lv mono">{user?.uid}</span></div>
          <div className="li">
            <span className="lg">Autorización</span>
            <span className="lv mono">admins/{user?.uid} (Rol: {role})</span>
          </div>
        </div>
      </Card>
    </>
  );
}
