import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc, writeBatch, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, PATHS, storage } from '../lib/firebase';
import { saveConfig, useConfig } from '../hooks/useConfig';
import { saveSystemSettings, useSystemSettings, getMaquilaPin, saveMaquilaPin, type SystemSettings } from '../hooks/useSystemSettings';
import { useOrders } from '../hooks/useOrders';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { getOrderSummary } from '../lib/finance';
import { Card, Field, Spinner } from '../components/ui';
import { CurrencyInput } from '../components/CurrencyInput';
import { useToast } from '../context/ToastContext';
import { computeFinancials } from '../lib/finance';
import { camposInvoices } from '../lib/invoiceOps';
import { money, percent } from '../lib/format';
import { DEFAULT_CONFIG, type FinancialConfig } from '../lib/types';
import MigrationTools from '../components/MigrationTools';
import { confirmDialog } from '../lib/confirmDialog';

export default function Settings() {
  const { config, loading: loadingCfg, exists } = useConfig();
  const { settings, loading: loadingSys } = useSystemSettings();
  const loading = loadingCfg || loadingSys;
  const { orders } = useOrders();
  const { user, role } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<FinancialConfig>(config);
  const [sysForm, setSysForm] = useState<SystemSettings>(settings);
  const [maquilaPin, setMaquilaPin] = useState('');
  const [maquilaPinLoaded, setMaquilaPinLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialCash, setInitialCash] = useState<string>('169000');

  useEffect(() => {
    // Solo se lee cuando un admin abre esta pantalla — no en cada carga de
    // la app, y nunca desde el documento publico que Login necesita leer
    // sin sesion (ver Ciclo de seguridad: el PIN vivia ahi antes, publico).
    getMaquilaPin().then((p) => { setMaquilaPin(p); setMaquilaPinLoaded(true); });
  }, []);

  useEffect(() => setForm(config), [config]);
  useEffect(() => setSysForm(settings), [settings]);

  async function seedInitialCash() {
    if (busy) return;
    const amount = Number(initialCash);
    if (isNaN(amount) || amount === 0) return toast('Ingresa un monto válido', 'bad');
    if (!(await confirmDialog(`¿Confirmas registrar un Saldo Inicial en Caja Chica por $${amount.toLocaleString('es-MX')}?`))) return;
    setBusy(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        date: Timestamp.now(),
        concept: 'Saldo Inicial (Arranque)',
        provider: '',
        type: amount > 0 ? 'ingreso' : 'egreso',
        amount: Math.abs(amount),
        createdAt: serverTimestamp(),
      });
      await logAction(user?.email, `Registró saldo inicial en caja chica por $${amount}`, { amount });
      toast('Saldo inicial registrado correctamente en Caja Chica');
    } catch (e: any) {
      toast(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  }


  const preview = computeFinancials(1000, form);
  const dirty = JSON.stringify(form) !== JSON.stringify(config);
  const sysDirty = JSON.stringify(sysForm) !== JSON.stringify(settings);

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
      await saveSystemSettings({ 
        companyName: sysForm.companyName || '', 
        companyLogoUrl: sysForm.companyLogoUrl || '',
        providerName: sysForm.providerName || 'Andrés',
        departments: sysForm.departments || ['TH', 'GT']
      });
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return toast('Por favor sube un archivo de imagen (PNG, JPG, etc).', 'bad');
    }
    setBusy(true);
    toast('Subiendo logotipo...', 'ok');
    try {
      const path = `identidad/logo-${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      
      task.on('state_changed', undefined, (err) => {
        toast(`Error subiendo logo: ${err.message}`, 'bad');
        setBusy(false);
      }, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setSysForm(f => ({ ...f, companyLogoUrl: url }));
        setForm(f => ({ ...f, companyLogoUrl: url }));
        toast('Logotipo subido. No olvides dar clic en Guardar Configuración.', 'ok');
        setBusy(false);
      });
    } catch (err: any) {
      toast(`Falló la subida: ${err.message}`, 'bad');
      setBusy(false);
    }
  }

  /** Recalcula órdenes ya procesadas con los precios actuales.
   *  Solo toca las que no están cobradas: lo cobrado es historia. */
  async function recalcular() {
    const target = orders.filter(
      (o) => getOrderSummary(o).status !== 'paid' && (o.totalKilograms ?? 0) > 0,
    );
    if (target.length === 0) {
      toast('No hay órdenes abiertas que recalcular.', 'bad');
      return;
    }
    if (!(await confirmDialog(`Se recalcularán ${target.length} órdenes con los precios actuales. ¿Continuar?`)))
      return;
    setBusy(true);
    try {
      // Firestore permite 500 operaciones por lote.
      for (let i = 0; i < target.length; i += 400) {
        const batch = writeBatch(db);
        target.slice(i, i + 400).forEach((o) => {
          // Recalcular cada factura individual para que no queden obsoletas vs el total
          const updatedInvoices = (o.invoices || []).map(inv => ({
            ...inv,
            financials: computeFinancials(inv.kilos || 0, config)
          }));

          batch.update(doc(db, PATHS.orders, o.id), {
            financials: computeFinancials(o.totalKilograms ?? 0, config),
            ...camposInvoices(updatedInvoices),
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

      <Card title="Identidad Corporativa">
        <div style={{ padding: 16 }}>
          <div className="form-grid">
            <Field label="Nombre Comercial de la Empresa">
              <input className="input boxed" type="text" value={sysForm.companyName ?? ''}
                onChange={(e) => {
                  setSysForm({ ...sysForm, companyName: e.target.value });
                  setForm({ ...form, companyName: e.target.value });
                }} 
                placeholder="Ej. Elemental Denim Bolsas" />
            </Field>
            
            <Field label="Logotipo Oficial">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {sysForm.companyLogoUrl ? (
                    <img src={sysForm.companyLogoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 24 }}>🏢</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer', marginBottom: 8 }}>
                    🖼️ Cambiar Logotipo
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={busy} />
                  </label>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    Este logotipo se usará en todos los reportes, PDF y pantallas principales del sistema.
                  </div>
                </div>
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Departamentos y Proveedor">
        <div style={{ padding: 16 }}>
          <div className="form-grid">
            <Field label="Nombre del Proveedor / Fabricante">
              <input className="input boxed" type="text" value={sysForm.providerName ?? ''}
                onChange={(e) => setSysForm({ ...sysForm, providerName: e.target.value })} 
                placeholder="Ej. Andrés" />
            </Field>
            
            <Field label="Departamentos / Prefijos (Separados por coma)">
              <input className="input boxed" type="text" value={(sysForm.departments || []).join(', ')}
                onChange={(e) => setSysForm({ ...sysForm, departments: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} 
                placeholder="Ej. TH, GT" />
            </Field>

            <Field label="PIN del Portal Maquilador">
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input boxed mono" type="text" value={maquilaPin}
                  onChange={(e) => setMaquilaPin(e.target.value)}
                  disabled={!maquilaPinLoaded}
                  placeholder="Ej. 2468" />
                <button
                  className="btn"
                  disabled={!maquilaPinLoaded || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await saveMaquilaPin(maquilaPin.trim());
                      toast('PIN actualizado', 'ok');
                    } catch (e) {
                      toast(`No se pudo guardar el PIN: ${(e as Error).message}`, 'bad');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Guardar PIN
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                Contraseña de 4 dígitos para que el maquilador registre entregas. Se guarda aparte
                de lo demás — vive en un documento que solo un administrador puede leer, para que
                nadie más pueda verlo.
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Ajustes de Precios Base">
        <div style={{ padding: 16 }}>
          <div className="form-grid">
            <Field label="Precio de venta por kilo">
              <CurrencyInput className="input boxed mono" value={form.salePricePerKg}
                onChange={(val) => setForm({ ...form, salePricePerKg: val })} />
            </Field>
            <Field label="Costo por kilo">
              <CurrencyInput className="input boxed mono" value={form.costPricePerKg}
                onChange={(val) => setForm({ ...form, costPricePerKg: val })} />
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
            <Field label="Tolerancia de Peso Entregado (%)">
              <input className="input boxed mono" type="number" step="0.1" value={form.weightTolerancePercentage ?? 2}
                onChange={(e) => setForm({ ...form, weightTolerancePercentage: Number(e.target.value) })} />
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                Ej. 2% permite que Andrés entregue hasta un 2% más de los kilos pedidos en la OC sin bloquear el sistema.
              </div>
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
        </div>
      </Card>


      <Card title="Saldos Iniciales (Arranque)">
        <div style={{ padding: 16 }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Configura los valores con los que arranca la empresa. Evita editar estos valores a menos que estés inicializando el sistema.
          </p>
          <div className="form-grid">
            <Field label="Deuda Histórica inicial con Andrés ($)">
              <CurrencyInput className="input boxed mono" value={form.historicalDebtAndres ?? 0}
                onChange={(val) => setForm({ ...form, historicalDebtAndres: val })} />
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                {/* FIX 2026-08-11 (Iteracion 108): este texto decia lo
                    contrario de lo que hace la formula. saldoProveedor =
                    Pagado - Compras + Historico (ver useAndresStats.ts,
                    useDashboardStats.ts, CajaChica.tsx -- las 3 copias
                    coinciden y traen el comentario "Negativo = Deuda,
                    Positivo = Saldo a Favor"). Un valor positivo aqui SUMA
                    a favor, no resta -- asi que "si pones 102670.28, le
                    debes eso a Andres" era literalmente lo opuesto de lo
                    que el sistema hace con ese numero. Alguien capturo un
                    valor de buena fe siguiendo esta instruccion y el
                    resultado salio invertido en la pantalla de Compras. */}
                Valores positivos indican un saldo a tu favor (anticipo ya pagado antes de usar el sistema). Valores negativos indican que le debes a Andrés. Si le debes $102,670.28, pon -102670.28.
              </div>
            </Field>
            
            <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 16 }}>
              <Field label="Efectivo en Caja Chica ($)">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input boxed mono" type="number" step="0.01" value={initialCash}
                    onChange={(e) => setInitialCash(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn" onClick={() => void seedInitialCash()} disabled={busy}>Inyectar Saldo</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                  Esto creará un registro de Ingreso en Caja Chica. Solo presionar al inicio.
                </div>
              </Field>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Datos para facturar (SAT)">
        <div style={{ padding: 16 }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Constantes de tus facturas: captúralas una vez aquí para copiarlas directo a tu sistema
            de facturación en vez de recordarlas cada vez.
          </p>
          <div className="form-grid">
            <Field label="Clave de producto/servicio SAT">
              <input className="input boxed mono" value={form.satClaveProdServ ?? ''}
                placeholder="24141500"
                onChange={(e) => setForm({ ...form, satClaveProdServ: e.target.value })} />
            </Field>
            <Field label="Clave de unidad SAT">
              <input className="input boxed mono" value={form.satClaveUnidad ?? ''}
                placeholder="KGM"
                onChange={(e) => setForm({ ...form, satClaveUnidad: e.target.value })} />
            </Field>
            <Field label="Método de pago">
              <input className="input boxed mono" value={form.satMetodoPago ?? ''}
                placeholder="PPD / PUE"
                onChange={(e) => setForm({ ...form, satMetodoPago: e.target.value })} />
            </Field>
            <Field label="Forma de pago SAT">
              <input className="input boxed mono" value={form.satFormaPago ?? ''}
                placeholder="99"
                onChange={(e) => setForm({ ...form, satFormaPago: e.target.value })} />
            </Field>
          </div>
          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => { setForm(config); setSysForm(settings); }} disabled={(!dirty && !sysDirty) || busy}>Descartar</button>
            <button className="btn btn-primary" onClick={() => void onSave().then(tocarConfig)} disabled={(!dirty && !sysDirty) || busy}>
              {busy ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      </Card>
      
      <MigrationTools />

      <Card title="Respaldos y Paquete Offline (v6.23.0)">
        <div style={{ padding: 16 }}>
          <p className="hint" style={{ marginTop: 0 }}>
            Genera copias locales de toda la base de datos de Firebase. Ideal para auditorías, análisis avanzado o continuar operando sin internet.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <button className="btn" onClick={async () => {
              const { exportToExcel } = await import('../lib/export');
              await exportToExcel();
            }} disabled={busy}>
              📊 Exportar a Excel (Todas las Colecciones)
            </button>
            <button className="btn btn-primary" onClick={async () => {
              const { exportToHtml } = await import('../lib/export');
              await exportToHtml();
            }} disabled={busy}>
              🌐 Descargar ERP Offline (.html)
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
