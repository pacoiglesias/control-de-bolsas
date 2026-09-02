import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc, writeBatch, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';
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
import { DEFAULT_CONFIG, DEFAULT_DEPARTMENTS, type FinancialConfig, type DepartmentConfig } from '../lib/types';
import MigrationTools from '../components/MigrationTools';
import { confirmDialog } from '../lib/confirmDialog';
import { triggerHaptic } from '../lib/hapticEngine';
import { OFFICIAL_IN_REVIEW } from '../components/Cobranza/SincronizadorOficialModal';

type SettingsTab = 'identity' | 'plants' | 'provider' | 'financials' | 'sat' | 'maintenance';

export default function Settings() {
  const { config, loading: loadingCfg, exists } = useConfig();
  const { settings, loading: loadingSys } = useSystemSettings();
  const loading = loadingCfg || loadingSys;
  const { orders } = useOrders();
  const { user, role } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>('identity');
  const [form, setForm] = useState<FinancialConfig>(config);
  const [sysForm, setSysForm] = useState<SystemSettings>(settings);
  const [maquilaPin, setMaquilaPin] = useState('');
  const [maquilaPinLoaded, setMaquilaPinLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [initialCash, setInitialCash] = useState<string>('169000');

  useEffect(() => {
    getMaquilaPin().then((p) => {
      setMaquilaPin(p);
      setMaquilaPinLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  useEffect(() => {
    if (settings) setSysForm(settings);
  }, [settings]);

  async function seedInitialCash() {
    if (busy) return;
    const amount = Number(initialCash);
    if (isNaN(amount) || amount === 0) return toast('Ingresa un monto válido', 'bad');
    if (
      !(await confirmDialog(
        `¿Confirmas registrar un Saldo Inicial en Caja Chica por $${amount.toLocaleString('es-MX')}?`
      ))
    )
      return;
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
      triggerHaptic('success');
      toast('Saldo inicial registrado correctamente en Caja Chica', 'ok');
    } catch (e: any) {
      triggerHaptic('error');
      toast(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const preview = computeFinancials(1000, form);
  const dirty = Boolean(config && form && JSON.stringify(form) !== JSON.stringify(config));
  const sysDirty = Boolean(settings && sysForm && JSON.stringify(sysForm) !== JSON.stringify(settings));

  async function handlePurgeTestOrders() {
    const ok = await confirmDialog(
      '¿Deseas archivar los expedientes de prueba en la Papelera?\n\n' +
        'Esta acción conservará únicamente los 11 Contrarecibos Oficiales ($1,101,736.34), ' +
        'dejando la cartera cuadrada exactamente al corte oficial de los 11 Contrarecibos ($1,101,736.34).'
    );
    if (!ok) return;

    setBusy(true);
    try {
      const OFFICIAL_CRS = [
        'TH-946',
        'TH-912',
        'TH-879',
        'TH-836',
        'GT-742',
        'TH-804',
        'GT-713',
        'GT-651',
        'TH-768',
        'GT-624',
        'GT-597',
      ];
      let purgedCount = 0;
      const batch = writeBatch(db);

      orders.forEach((o) => {
        if ((o as any).isDeleted) return;
        const crNumber = (o.collection?.contrareciboNumber || '').toUpperCase().trim();
        const hasOfficialCr =
          OFFICIAL_CRS.some((cr) => crNumber.includes(cr)) ||
          (o.invoices || []).some((inv) =>
            OFFICIAL_CRS.some((cr) => (inv.collection?.contrareciboNumber || '').toUpperCase().includes(cr))
          );
        const isFactura6167 =
          o.oc === '120267114014' ||
          o.folio === '120267114014' ||
          (o.invoices || []).some((inv) => inv.folio === '6167' || inv.folio === 'TH-946');
        const isPendingOrder = o.creditCycle?.status === 'pedido';
        const isInReview =
          Array.isArray(OFFICIAL_IN_REVIEW) &&
          OFFICIAL_IN_REVIEW.some(
            (item) =>
              o.oc === item.oc ||
              o.folio === item.oc ||
              o.folio === item.folio ||
              (o.invoices || []).some((i) => i.folio === item.folio)
          );

        if (!hasOfficialCr && !isFactura6167 && !isPendingOrder && !isInReview) {
          batch.update(doc(db, PATHS.orders, o.id), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: user?.email || 'admin@sistema',
            deleteReason: 'Purga automática de expedientes de prueba',
          });
          purgedCount++;
        }
      });

      if (purgedCount > 0) {
        await batch.commit();
        triggerHaptic('success');
        toast(`🧹 Se archivaron ${purgedCount} expedientes de prueba en la Papelera. Cartera oficial al 100%.`, 'ok');
      } else {
        toast('No se encontraron expedientes de prueba pendientes por archivar.', 'ok');
      }
    } catch (e) {
      triggerHaptic('error');
      toast(`Error al purgar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (form.salePricePerKg <= 0 || form.costPricePerKg < 0) {
      toast('Los precios no pueden ser cero o negativos.', 'bad');
      return;
    }
    if (form.commissionRate < 0 || form.commissionRate > 1) {
      toast('La comisión va en decimal: 0.08 es 8.0%.', 'bad');
      return;
    }
    setBusy(true);
    try {
      await saveConfig(form);
      await saveSystemSettings({
        companyName: sysForm.companyName || '',
        companyLogoUrl: sysForm.companyLogoUrl || '',
        providerName: sysForm.providerName || 'Andrés',
        providerTitle: sysForm.providerTitle || 'Taller de Maquila',
        clientName: sysForm.clientName || 'Grupo Textil Providencia SA de CV',
        clientShortName: sysForm.clientShortName || 'Providencia',
        departments: sysForm.departments || ['TH', 'GT'],
        deptCodeTH: sysForm.deptCodeTH || 'TH',
        deptCodeGT: sysForm.deptCodeGT || 'GT',
        managerTH: sysForm.managerTH || 'Lic. Nava',
        managerGT: sysForm.managerGT || 'Lic. Evelia',
        deptNameTH: sysForm.deptNameTH || 'Textil Hogar',
        deptNameGT: sysForm.deptNameGT || 'Grupo Textil',
      });
      await logAction(user?.email, 'Configuración Financiera Modificada', {
        oldConfig: config,
        newConfig: form,
      });
      triggerHaptic('success');
      toast('Configuración guardada exitosamente.', 'ok');
    } catch (e) {
      triggerHaptic('error');
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

      task.on(
        'state_changed',
        undefined,
        (err) => {
          triggerHaptic('error');
          toast(`Error subiendo logo: ${err.message}`, 'bad');
          setBusy(false);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setSysForm((f) => ({ ...f, companyLogoUrl: url }));
          setForm((f) => ({ ...f, companyLogoUrl: url }));
          triggerHaptic('success');
          toast('Logotipo subido. Guarda la configuración para confirmar.', 'ok');
          setBusy(false);
        }
      );
    } catch (err: any) {
      triggerHaptic('error');
      toast(`Falló la subida: ${err.message}`, 'bad');
      setBusy(false);
    }
  }

  async function recalcular() {
    const target = orders.filter((o) => getOrderSummary(o).status !== 'paid' && (o.totalKilograms ?? 0) > 0);
    if (target.length === 0) {
      toast('No hay órdenes abiertas que recalcular.', 'bad');
      return;
    }
    if (!(await confirmDialog(`Se recalcularán ${target.length} órdenes con los precios actuales. ¿Continuar?`)))
      return;
    setBusy(true);
    try {
      for (let i = 0; i < target.length; i += 400) {
        const batch = writeBatch(db);
        target.slice(i, i + 400).forEach((o) => {
          const updatedInvoices = (o.invoices || []).map((inv) => ({
            ...inv,
            financials: computeFinancials(inv.kilos || 0, config),
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
        configUsed: config,
      });
      triggerHaptic('success');
      toast(`${target.length} órdenes recalculadas`, 'ok');
    } catch (e) {
      triggerHaptic('error');
      toast(`Falló el recálculo: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function tocarConfig() {
    try {
      await updateDoc(doc(db, PATHS.config, PATHS.configFinancials), { updatedAt: serverTimestamp() });
    } catch {
      // Document may not exist yet
    }
  }

  if (loading) return <Spinner />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  const tabsConfig = [
    { key: 'identity', label: '🏢 Identidad & Cliente', icon: '🏢' },
    { key: 'plants', label: `🏬 Plantas (${(form.departmentConfigs || DEFAULT_DEPARTMENTS).length})`, icon: '🏬' },
    { key: 'provider', label: '🏭 Proveedor & Andrés', icon: '🏭' },
    { key: 'financials', label: '💵 Precios & Márgenes', icon: '💵' },
    { key: 'sat', label: '🧾 Datos Fiscales SAT', icon: '🧾' },
    { key: 'maintenance', label: '🛡️ Auditoría & Respaldo', icon: '🛡️' },
  ] as const;

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>CONFIGURACIÓN GENERAL</h1>
          <p>
            Parámetros corporativos, gestor multi-planta, claves fiscales SAT y políticas financieras centralizadas en <code>config/financials</code>.
          </p>
        </div>
      </div>

      {!exists && (
        <div className="alert warn" style={{ marginBottom: 20 }}>
          El documento <code>config/financials</code> todavía no existe. Guarda una vez para crearlo; mientras tanto el
          backend usa los valores por omisión ({money(DEFAULT_CONFIG.salePricePerKg)}/{money(DEFAULT_CONFIG.costPricePerKg)}/
          {percent(DEFAULT_CONFIG.commissionRate)}).
        </div>
      )}

      {/* Selector de Pestañas Segmentadas */}
      <div
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 5,
          background: 'var(--paper-sunk, rgba(0, 0, 0, 0.25))',
          borderRadius: 14,
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          marginBottom: 24,
          flexWrap: 'wrap',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {tabsConfig.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                triggerHaptic('light');
                setActiveTab(tab.key);
              }}
              style={{
                background: isActive ? 'var(--accent, #3b82f6)' : 'transparent',
                color: isActive ? '#fff' : 'var(--ink-soft, #94a3b8)',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.35)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: IDENTIDAD & CLIENTE */}
        {activeTab === 'identity' && (
          <motion.div
            key="identity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <Card title="🏢 Identidad de tu Empresa (Emisor)">
              <div style={{ padding: 18 }}>
                <div className="form-grid">
                  <Field label="Nombre Comercial de tu Empresa">
                    <input
                      className="input boxed"
                      type="text"
                      value={sysForm.companyName ?? ''}
                      onChange={(e) => {
                        setSysForm({ ...sysForm, companyName: e.target.value });
                        setForm({ ...form, companyName: e.target.value });
                      }}
                      placeholder="Ej. BOLSAS ELEMENTAL"
                    />
                  </Field>

                  <Field label="Logotipo Oficial">
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 12,
                          background: 'var(--paper-sunk, rgba(0,0,0,0.2))',
                          border: '1px solid var(--border, rgba(255,255,255,0.1))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {sysForm.companyLogoUrl ? (
                          <img
                            src={sysForm.companyLogoUrl}
                            alt="Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ color: 'var(--ink-soft)', fontSize: 28 }}>🏢</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <motion.label
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="btn btn-secondary"
                          style={{ display: 'inline-flex', cursor: 'pointer', marginBottom: 8, fontWeight: 700 }}
                        >
                          🖼️ Subir Logotipo
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleLogoUpload}
                            disabled={busy}
                          />
                        </motion.label>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                          Aparece automáticamente en el encabezado, PDFs institucionales y reportes ejecutivos.
                        </div>
                      </div>
                    </div>
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="🏬 Cliente Corporativo Principal (ej. Providencia)">
              <div style={{ padding: 18 }}>
                <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
                  Configura la razón social fiscal y el nombre con el que identificas a tu cliente receptor en reportes y prefacturas.
                </p>
                <div className="form-grid">
                  <Field label="Razón Social Oficial (SAT Receptor)">
                    <input
                      className="input boxed"
                      type="text"
                      value={sysForm.clientName ?? ''}
                      onChange={(e) => setSysForm({ ...sysForm, clientName: e.target.value })}
                      placeholder="Ej. Grupo Textil Providencia SA de CV"
                    />
                  </Field>

                  <Field label="Nombre Comercial Corto">
                    <input
                      className="input boxed"
                      type="text"
                      value={sysForm.clientShortName ?? ''}
                      onChange={(e) => setSysForm({ ...sysForm, clientShortName: e.target.value })}
                      placeholder="Ej. Providencia"
                    />
                  </Field>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TAB 2: GESTOR MULTI-PLANTA */}
        {activeTab === 'plants' && (
          <motion.div
            key="plants"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              title="🏬 Gestor Dinámico Multi-Planta & Departamentos"
              actions={
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    triggerHaptic('light');
                    const current = form.departmentConfigs || DEFAULT_DEPARTMENTS;
                    const nextNum = current.length + 1;
                    const newDept: DepartmentConfig = {
                      id: `P${nextNum}`,
                      name: `Planta / Área ${nextNum}`,
                      prefix: `P${nextNum}-`,
                      contact: 'Encargado de Almacén',
                      active: true,
                    };
                    setForm({ ...form, departmentConfigs: [...current, newDept] });
                    toast(`➕ Planta / Área ${nextNum} agregada al catálogo`, 'ok');
                  }}
                  style={{ fontSize: 12.5, minHeight: 38, fontWeight: 800 }}
                >
                  ➕ Agregar Planta / Área
                </motion.button>
              }
            >
              <div style={{ padding: 18 }}>
                <p className="hint" style={{ marginTop: 0, marginBottom: 18 }}>
                  Configura las plantas operativas para enrutar contrarecibos (ej. <code>TH-</code> para Textil Hogar / Nava y <code>GT-</code> para Grupo Textil / Evelia).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  {(form.departmentConfigs || DEFAULT_DEPARTMENTS).map((dept, idx) => {
                    const palette = idx % 2 === 0
                      ? { border: '#0284c7', bg: 'rgba(2, 132, 199, 0.06)', dot: '🔵', text: '#38bdf8' }
                      : { border: '#059669', bg: 'rgba(5, 150, 105, 0.06)', dot: '🟢', text: '#34d399' };

                    return (
                      <motion.div
                        key={dept.id || idx}
                        whileHover={{ y: -2 }}
                        style={{
                          background: palette.bg,
                          border: `1px solid ${palette.border}40`,
                          borderTop: `3px solid ${palette.border}`,
                          borderRadius: 14,
                          padding: 18,
                          position: 'relative',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.text, fontWeight: 800, fontSize: 14 }}>
                            <span>{palette.dot}</span>
                            <span>{dept.name || `Planta ${idx + 1}`} ({dept.id})</span>
                          </div>
                          {(form.departmentConfigs || DEFAULT_DEPARTMENTS).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('warning');
                                const current = form.departmentConfigs || DEFAULT_DEPARTMENTS;
                                const filtered = current.filter((_, i) => i !== idx);
                                setForm({ ...form, departmentConfigs: filtered });
                                toast(`🗑️ Planta eliminada`, 'bad');
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title="Eliminar planta"
                            >
                              ✕ Quitar
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <Field label="Código / Prefijo de Contrarecibo (ej. TH, GT, P3)">
                            <input
                              className="input boxed mono"
                              type="text"
                              value={dept.id}
                              onChange={(e) => {
                                const current = [...(form.departmentConfigs || DEFAULT_DEPARTMENTS)];
                                const val = e.target.value.toUpperCase().trim();
                                current[idx] = { ...current[idx], id: val, prefix: `${val}-` };
                                setForm({ ...form, departmentConfigs: current });
                              }}
                              placeholder="Ej. TH, GT, P3"
                            />
                          </Field>
                          <Field label="Nombre Completo del Área / Planta">
                            <input
                              className="input boxed"
                              type="text"
                              value={dept.name}
                              onChange={(e) => {
                                const current = [...(form.departmentConfigs || DEFAULT_DEPARTMENTS)];
                                current[idx] = { ...current[idx], name: e.target.value };
                                setForm({ ...form, departmentConfigs: current });
                              }}
                              placeholder="Ej. Textil Hogar / Planta Confección"
                            />
                          </Field>
                          <Field label="Persona Responsable / Contacto">
                            <input
                              className="input boxed"
                              type="text"
                              value={dept.contact || ''}
                              onChange={(e) => {
                                const current = [...(form.departmentConfigs || DEFAULT_DEPARTMENTS)];
                                current[idx] = { ...current[idx], contact: e.target.value };
                                setForm({ ...form, departmentConfigs: current });
                              }}
                              placeholder="Ej. Lic. Nava / Evelia"
                            />
                          </Field>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TAB 3: PROVEEDOR & MAQUILA */}
        {activeTab === 'provider' && (
          <motion.div
            key="provider"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <Card title="🏭 Proveedor / Fabricante de Bolsa (ej. Andrés)">
              <div style={{ padding: 18 }}>
                <div className="form-grid">
                  <Field label="Nombre del Proveedor / Fabricante">
                    <input
                      className="input boxed"
                      type="text"
                      value={sysForm.providerName ?? ''}
                      onChange={(e) => setSysForm({ ...sysForm, providerName: e.target.value })}
                      placeholder="Ej. Andrés"
                    />
                  </Field>

                  <Field label="Título / Giro de la Operación">
                    <input
                      className="input boxed"
                      type="text"
                      value={sysForm.providerTitle ?? ''}
                      onChange={(e) => setSysForm({ ...sysForm, providerTitle: e.target.value })}
                      placeholder="Ej. Proveedor de Bolsa / Fabricante"
                    />
                  </Field>

                  <Field label="PIN de Seguridad para Portal de Proveedor / Báscula">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input boxed mono"
                        type="text"
                        value={maquilaPin}
                        onChange={(e) => setMaquilaPin(e.target.value)}
                        disabled={!maquilaPinLoaded}
                        placeholder="Ej. 2468"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn btn-primary"
                        disabled={!maquilaPinLoaded || busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await saveMaquilaPin(maquilaPin.trim());
                            triggerHaptic('success');
                            toast('PIN de maquilador actualizado', 'ok');
                          } catch (e) {
                            triggerHaptic('error');
                            toast(`No se pudo guardar el PIN: ${(e as Error).message}`, 'bad');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Guardar PIN
                      </motion.button>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                      Contraseña de 4 dígitos para que el proveedor acceda a <code>/portal-maquilador</code> y registre pesajes de báscula.
                    </div>
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Saldos Iniciales de Arranque">
              <div style={{ padding: 18 }}>
                <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
                  Configura los valores con los que arranca el ejercicio contable.
                </p>
                <div className="form-grid">
                  <Field label="Deuda Histórica inicial con Andrés ($)">
                    <CurrencyInput
                      className="input boxed mono"
                      value={form.historicalDebtAndres ?? 0}
                      onChange={(val) => setForm({ ...form, historicalDebtAndres: val })}
                    />
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                      Valores positivos (+) representan saldo a favor de Andrés (anticipos). Valores negativos (−) representan pasivo por pagar.
                    </div>
                  </Field>

                  <Field label="Efectivo en Caja Chica ($)">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input boxed mono"
                        type="number"
                        step="0.01"
                        value={initialCash}
                        onChange={(e) => setInitialCash(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn"
                        style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                        onClick={() => void seedInitialCash()}
                        disabled={busy}
                      >
                        Inyectar Saldo
                      </motion.button>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                      Crea un registro de Ingreso en Caja Chica. Usar solo al iniciar el ejercicio.
                    </div>
                  </Field>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TAB 4: PRECIOS & MÁRGENES FINANCIEROS */}
        {activeTab === 'financials' && (
          <motion.div
            key="financials"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card title="💵 Parámetros de Precios y Políticas de Facturación">
              <div style={{ padding: 18 }}>
                <div className="form-grid">
                  <Field label="Precio de venta por kilo (Providencia)">
                    <CurrencyInput
                      className="input boxed mono"
                      value={form.salePricePerKg}
                      onChange={(val) => setForm({ ...form, salePricePerKg: val })}
                    />
                  </Field>
                  <Field label="Costo de compra por kilo (Andrés)">
                    <CurrencyInput
                      className="input boxed mono"
                      value={form.costPricePerKg}
                      onChange={(val) => setForm({ ...form, costPricePerKg: val })}
                    />
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
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>%</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                      Oficial: {(form.commissionRate * 100).toFixed(2)}% (0.08 sobre subtotal)
                    </div>
                  </Field>
                  <Field label="Días de crédito estándar">
                    <input
                      className="input boxed mono"
                      type="number"
                      step="1"
                      value={form.creditDays}
                      onChange={(e) => setForm({ ...form, creditDays: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Tasa de IVA (%)">
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
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>%</span>
                    </div>
                  </Field>
                  <Field label="Base de retención de comisión contable">
                    <select
                      className="input boxed"
                      value={form.commissionBase}
                      onChange={(e) => setForm({ ...form, commissionBase: e.target.value as 'subtotal' | 'total' })}
                    >
                      <option value="subtotal">Sobre el Subtotal (sin IVA) — Oficial</option>
                      <option value="total">Sobre el Total Facturado (con IVA)</option>
                    </select>
                  </Field>
                </div>

                {/* Simulador Financiero en Vivo */}
                <div
                  style={{
                    marginTop: 22,
                    background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                    borderRadius: 14,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
                    📊 Simulador de Flujo por cada 1,000 kg entregados
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-soft)' }}>
                    <span>Venta Bruta Subtotal (1,000 kg × ${form.salePricePerKg.toFixed(2)}):</span>
                    <span className="mono" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{money(preview.saleTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-soft)' }}>
                    <span>+ IVA 16% (Cobrado a Providencia):</span>
                    <span className="mono" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>+{money(preview.invoiceTotal - preview.saleTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>
                    <span>Total Facturado al Cliente:</span>
                    <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(preview.invoiceTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f87171' }}>
                    <span>− Costo Compra a Andrés (1,000 kg × ${form.costPricePerKg.toFixed(2)}):</span>
                    <span className="mono" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>−{money(preview.costTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f87171' }}>
                    <span>− Comisión Contador (8% Subtotal):</span>
                    <span className="mono" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>−{money(preview.commission)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 15,
                      color: '#10b981',
                      fontWeight: 800,
                      borderTop: '1px solid var(--border, rgba(255,255,255,0.1))',
                      paddingTop: 8,
                      marginTop: 4,
                    }}
                  >
                    <span>= Flujo Neto Real en Caja (por cada 1,000 kg):</span>
                    <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(preview.netCashFlow)} (${(preview.netCashFlow / 1000).toFixed(2)}/kg)</span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TAB 5: DATOS FISCALES SAT */}
        {activeTab === 'sat' && (
          <motion.div
            key="sat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card title="🧾 Parámetros Fiscales SAT & Facturación Electrónica">
              <div style={{ padding: 18 }}>
                <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
                  Constantes fiscales inyectadas automáticamente en las prefacturas de Excel (.xlsx) para timbrado con contadores.
                </p>
                <div className="form-grid">
                  <Field label="Clave de producto/servicio SAT">
                    <input
                      className="input boxed mono"
                      value={form.satClaveProdServ ?? ''}
                      placeholder="24141500"
                      onChange={(e) => setForm({ ...form, satClaveProdServ: e.target.value })}
                    />
                  </Field>
                  <Field label="Clave de unidad SAT">
                    <input
                      className="input boxed mono"
                      value={form.satClaveUnidad ?? ''}
                      placeholder="KGM"
                      onChange={(e) => setForm({ ...form, satClaveUnidad: e.target.value })}
                    />
                  </Field>
                  <Field label="Método de pago SAT">
                    <input
                      className="input boxed mono"
                      value={form.satMetodoPago ?? ''}
                      placeholder="PPD"
                      onChange={(e) => setForm({ ...form, satMetodoPago: e.target.value })}
                    />
                  </Field>
                  <Field label="Forma de pago SAT">
                    <input
                      className="input boxed mono"
                      value={form.satFormaPago ?? ''}
                      placeholder="99"
                      onChange={(e) => setForm({ ...form, satFormaPago: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TAB 6: AUDITORÍA & MANTENIMIENTO */}
        {activeTab === 'maintenance' && (
          <motion.div
            key="maintenance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <MigrationTools />

            <Card title="🧹 Auditoría de Datos: Purga Protegida de Pruebas">
              <div style={{ padding: 18 }}>
                <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
                  Archiva en la Papelera los expedientes residuales de prueba sin alterar los <strong>11 Contrarecibos Oficiales</strong> ($1,101,736.34) ni las órdenes pendientes de Andrés.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontWeight: 800,
                    minHeight: 44,
                  }}
                  onClick={() => void handlePurgeTestOrders()}
                  disabled={busy}
                >
                  🧹 Ejecutar Purga Protegida
                </motion.button>
              </div>
            </Card>

            <Card title="↻ Recálculo Masivo de Órdenes Abiertas">
              <div style={{ padding: 18 }}>
                <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
                  Aplica los precios vigentes a las órdenes abiertas. Las facturas cobradas se respetan de forma inmutable.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  style={{ minHeight: 44, fontWeight: 700 }}
                  onClick={() => void recalcular()}
                  disabled={busy}
                >
                  ↻ Recalcular Órdenes Abiertas
                </motion.button>
              </div>
            </Card>

            <Card title="📦 Respaldos y Paquete Offline">
              <div style={{ padding: 18 }}>
                <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
                  Genera copias completas de la base de datos de Firestore para auditoría local o respaldo de contingencia.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn"
                    style={{ minHeight: 44, fontWeight: 700 }}
                    onClick={async () => {
                      triggerHaptic('light');
                      const { exportToExcel } = await import('../lib/export');
                      await exportToExcel();
                    }}
                    disabled={busy}
                  >
                    📊 Exportar Colecciones a Excel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary"
                    style={{ minHeight: 44, fontWeight: 800 }}
                    onClick={async () => {
                      triggerHaptic('light');
                      const { exportToHtml } = await import('../lib/export');
                      await exportToHtml();
                    }}
                    disabled={busy}
                  >
                    🌐 Descargar ERP Offline (.html)
                  </motion.button>
                </div>
              </div>
            </Card>

            <Card title="👤 Sesión y Seguridad">
              <div style={{ padding: 18 }} className="link-list">
                <div className="li"><span className="lg">Usuario Activo</span><span className="lv">{user?.email}</span></div>
                <div className="li"><span className="lg">UID Firebase</span><span className="lv mono">{user?.uid}</span></div>
                <div className="li">
                  <span className="lg">Nivel de Acceso</span>
                  <span className="lv mono" style={{ color: '#10b981', fontWeight: 800 }}>Rol: {role} (Administrador)</span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra Flotante de Guardado Rápido */}
      {(dirty || sysDirty) && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-raised, rgba(15, 23, 42, 0.95))',
            padding: '10px 22px',
            borderRadius: 999,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            border: '1px solid var(--accent, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            zIndex: 1000,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink, #fff)' }}>
            ⚠️ Modificaciones sin guardar
          </span>
          <button
            className="btn"
            style={{ minHeight: 36, padding: '0 12px', fontSize: 12.5 }}
            onClick={() => {
              triggerHaptic('light');
              setForm(config);
              setSysForm(settings);
            }}
            disabled={busy}
          >
            Descartar
          </button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary"
            style={{ minHeight: 36, padding: '0 16px', fontSize: 12.5, fontWeight: 800 }}
            onClick={() => {
              triggerHaptic('light');
              void onSave().then(tocarConfig);
            }}
            disabled={busy}
          >
            {busy ? 'Guardando…' : '💾 Guardar Cambios'}
          </motion.button>
        </motion.div>
      )}
    </>
  );
}

