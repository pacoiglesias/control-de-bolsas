import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import { addDays, computeFinancials } from '../../lib/finance';
import { toInputDate, fromInputDate, money, nombreClienteVisible } from '../../lib/format';
import { useInvoiceActions } from './useInvoiceActions';
import { useToast } from '../../context/ToastContext';
import type { PurchaseOrder, Invoice, FinancialConfig } from '../../lib/types';

interface EmitirFacturaModalProps {
  order: PurchaseOrder;
  kilosPendientes: number;
  dynamicConfig: FinancialConfig;
  config: FinancialConfig;
  onClose: () => void;
  onCreated?: (inv: Invoice) => void;
}

type Step = 1 | 2 | 3;

export function EmitirFacturaModal({
  order,
  kilosPendientes,
  dynamicConfig,
  config,
  onClose,
  onCreated,
}: EmitirFacturaModalProps) {
  const toast = useToast();
  const { saveInvoice } = useInvoiceActions();

  const precio = dynamicConfig.salePricePerKg || config.salePricePerKg || 43;

  // --- Estado del formulario ---
  const [step, setStep] = useState<Step>(1);
  const [kilos, setKilos] = useState(kilosPendientes > 0 ? kilosPendientes : 0);
  const [folio, setFolio] = useState('');
  const [issueDate, setIssueDate] = useState(toInputDate(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (config.creditDays || 30));
    return toInputDate(d);
  });
  const [busy, setBusy] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // --- Cálculos en tiempo real ---
  const fin = useMemo(() => computeFinancials(kilos, { ...dynamicConfig, salePricePerKg: precio }), [kilos, dynamicConfig, precio]);
  const subtotal = fin.saleTotal ?? kilos * precio;
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  // Máximo facturables = kilos pendientes (ya entregados, ya descontados los ya facturados)
  const maxFacturables = kilosPendientes;

  // Construir items de factura proporcional a los kilos que se van a facturar
  const invoiceItems = useMemo(() => {
    const ocItems = order.items || [];
    if (ocItems.length === 0) {
      // Fallback: un sólo concepto genérico con los kilos indicados
      return [{
        id: '1',
        code: config.satClaveProdServ || '24111500',
        description: 'BOLSA POLIETILENO TRANSPARENTE EN ROLLO / BULTOS',
        quantity: kilos,
        unit: 'KGM',
        unitPrice: precio,
        amount: kilos * precio,
      }];
    }
    const totalOcKilos = ocItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    if (totalOcKilos === 0) return ocItems;
    // Distribuir los kilos a facturar proporcionalmente entre los renglones de la OC
    const ratio = kilos / totalOcKilos;
    return ocItems.map((it) => {
      const q = Math.round((Number(it.quantity) || 0) * ratio * 100) / 100;
      const p = it.unitPrice || precio;
      return { ...it, quantity: q, unitPrice: p, amount: Math.round(q * p * 100) / 100 };
    });
  }, [order.items, kilos, precio, config.satClaveProdServ]);

  // Datos fiscales del receptor (Providencia)
  const datosSAT = `RFC: GTP930115PU1
Nombre/Razón Social: GRUPO TEXTIL PROVIDENCIA SA DE CV
Régimen Fiscal: 601 - General de Ley Personas Morales
Uso CFDI: G01 - Adquisición de mercancías
Clave ProdServ SAT: 24111500
Unidad SAT: KGM (Kilogramo)
Precio Unitario: $${precio.toFixed(2)}
Objeto de Impuesto: 02 - Sí objeto de impuesto
IVA: 16%
Método de Pago: PPD - Pago en parcialidades o diferido
Forma de Pago: 99 - Por definir
OC de referencia: ${order.oc || order.folio || 'S/N'}`;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(datosSAT);
    setCopiedAll(true);
    toast('📋 Datos fiscales de Providencia copiados al portapapeles', 'ok');
    setTimeout(() => setCopiedAll(false), 3000);
  };

  const handleCreate = async () => {
    if (kilos <= 0) {
      toast('Los kilos deben ser mayores a 0.', 'bad');
      return;
    }
    if (maxFacturables > 0 && kilos > maxFacturables) {
      toast(`⚠️ No puedes facturar más de ${maxFacturables.toLocaleString('es-MX')} kg (kilos entregados sin facturar).`, 'bad');
      return;
    }
    setBusy(true);
    try {
      const nuevoId = Date.now().toString();
      const issue = fromInputDate(issueDate) || new Date();
      const due = fromInputDate(dueDate) || addDays(issue, config.creditDays || 30);

      const newInv: Invoice = {
        id: nuevoId,
        orderId: order.id || '',
        folio: folio.trim().toUpperCase() || '',
        kilos,
        financials: fin,
        items: invoiceItems,
        creditCycle: {
          status: 'facturado',
          issueDate: Timestamp.fromDate(issue),
          dueDate: Timestamp.fromDate(due),
        },
        collection: {
          paidAmount: 0,
          contrareciboNumber: '',
          notes: '',
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await saveInvoice(order, newInv, dynamicConfig);
      onCreated?.(newInv);
      toast(`✅ Factura creada — ${kilos.toLocaleString('es-MX')} kg · ${money(total)} con IVA`, 'ok');
      onClose();
    } catch {
      // toast handled in saveInvoice
    } finally {
      setBusy(false);
    }
  };

  const stepLabels: Record<Step, string> = {
    1: '📊 Datos de la Factura',
    2: '🏛️ Datos del Cliente (SAT)',
    3: '✅ Confirmar y Crear',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 540,
          maxHeight: '94vh',
          overflowY: 'auto',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
          color: 'var(--ink)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--line)' }} />
        </div>

        <div style={{ padding: '0 20px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingTop: 8 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.3px' }}>🧾 Emitir Factura</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
                OC: <strong style={{ fontFamily: 'monospace' }}>{order.oc || order.folio || 'S/N'}</strong> · {nombreClienteVisible(order.client)}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink-soft)', padding: 4 }}
            >
              ✕
            </button>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {([1, 2, 3] as Step[]).map((s) => (
              <div
                key={s}
                onClick={() => step > s && setStep(s)}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 4,
                  background: step >= s ? '#2563eb' : 'var(--line)',
                  cursor: step > s ? 'pointer' : 'default',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#2563eb', marginBottom: 18 }}>
            Paso {step} de 3 — {stepLabels[step]}
          </div>

          <AnimatePresence mode="wait">
            {/* ───────── PASO 1: Datos de la Factura ───────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {/* Folio */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    Número de Folio de la Factura <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(puedes dejarlo en blanco si aún no tienes el folio del SAT)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 6250 — déjalo vacío si aún no lo tienes"
                    value={folio}
                    onChange={(e) => setFolio(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '13px 14px',
                      fontSize: 20,
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      borderRadius: 12,
                      border: '2px solid var(--line)',
                      background: 'var(--paper-sunk)',
                      color: 'var(--ink)',
                      outline: 'none',
                      letterSpacing: '0.05em',
                    }}
                    autoFocus
                  />
                </div>

                {/* Kilos */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                    Kilos a Facturar
                  </label>
                  <div style={{
                    background: 'var(--paper-sunk)',
                    border: '2px solid var(--accent)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={kilos}
                      onChange={(e) => setKilos(Number(e.target.value))}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: 24,
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        color: 'var(--ink)',
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>kg</span>
                  </div>
                  {kilosPendientes > 0 && (
                    <button
                      type="button"
                      onClick={() => setKilos(kilosPendientes)}
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--accent)',
                        background: 'transparent',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      ⚡ Usar pendientes: {kilosPendientes.toLocaleString('es-MX')} kg
                    </button>
                  )}
                </div>

                {/* Resumen de importes en tiempo real */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(2,132,199,0.08), rgba(3,105,161,0.12))',
                  border: '1px solid #0284c7',
                  borderRadius: 12,
                  padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', marginBottom: 10, textTransform: 'uppercase' }}>
                    📊 Resumen de Importes (calculado automático)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Precio / kg', val: `$${precio.toFixed(2)}` },
                      { label: 'Subtotal (sin IVA)', val: money(subtotal) },
                      { label: 'IVA (16%)', val: money(iva) },
                      { label: 'TOTAL c/IVA', val: money(total), accent: true },
                    ].map(({ label, val, accent }) => (
                      <div key={label} style={{ background: 'var(--paper)', borderRadius: 8, padding: '8px 10px', border: `1px solid ${accent ? '#0284c7' : 'var(--line-soft)'}` }}>
                        <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: accent ? 16 : 13, fontWeight: 900, color: accent ? '#0369a1' : 'var(--ink)', fontFamily: 'monospace', marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fechas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Fecha de Emisión</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => {
                        setIssueDate(e.target.value);
                        const issue = fromInputDate(e.target.value);
                        if (issue) {
                          const d = addDays(issue, config.creditDays || 30);
                          setDueDate(toInputDate(d));
                        }
                      }}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--paper-sunk)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Fecha de Vencimiento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--paper-sunk)', color: 'var(--ink)', fontSize: 14, fontWeight: 700, outline: 'none' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[15, 30, 45].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const issue = fromInputDate(issueDate) || new Date();
                        setDueDate(toInputDate(addDays(issue, d)));
                      }}
                      style={{ flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 700, borderRadius: 8, border: '1px solid var(--line)', background: d === 30 ? 'rgba(37,99,235,0.1)' : 'var(--paper-sunk)', color: d === 30 ? '#2563eb' : 'var(--ink-soft)', cursor: 'pointer' }}
                    >
                      +{d} días
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={kilos <= 0}
                  style={{
                    marginTop: 6,
                    width: '100%',
                    padding: '15px',
                    borderRadius: 14,
                    border: 'none',
                    background: kilos > 0 ? '#2563eb' : 'var(--line)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: kilos > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  Siguiente → Datos del Cliente SAT
                </button>
              </motion.div>
            )}

            {/* ───────── PASO 2: Datos Fiscales del Receptor ───────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(124,58,237,0.12))',
                  border: '1px solid #7c3aed',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', marginBottom: 10, textTransform: 'uppercase' }}>
                    🏛️ Datos del Receptor — Para el Portal del SAT (CFDI 4.0)
                  </div>
                  {[
                    { label: 'RFC Receptor', val: 'GTP930115PU1', mono: true },
                    { label: 'Razón Social', val: 'GRUPO TEXTIL PROVIDENCIA SA DE CV', mono: false },
                    { label: 'Régimen Fiscal', val: '601 - General de Ley Personas Morales', mono: false },
                    { label: 'Uso CFDI', val: 'G01 - Adquisición de mercancías', mono: false },
                    { label: 'Clave Prod/Serv SAT', val: '24111500', mono: true },
                    { label: 'Unidad SAT', val: 'KGM (Kilogramo)', mono: true },
                    { label: 'Precio Unitario', val: `$${precio.toFixed(2)} / kg`, mono: true, accent: true },
                    { label: 'Objeto de Impuesto', val: '02 - Sí objeto de impuesto', mono: false },
                    { label: 'IVA', val: '16%', mono: true },
                    { label: 'Método de Pago', val: 'PPD - Pago en parcialidades o diferido', mono: false },
                    { label: 'Forma de Pago', val: '99 - Por definir', mono: false },
                    { label: 'OC de referencia', val: order.oc || order.folio || 'S/N', mono: true, accent: true },
                  ].map(({ label, val, mono, accent }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(124,58,237,0.15)', paddingBottom: 7, marginBottom: 7 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>{label}:</span>
                      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: mono ? 'monospace' : 'inherit', color: accent ? '#7c3aed' : 'var(--ink)' }}>{val}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleCopyAll}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: 12,
                    border: `2px solid ${copiedAll ? '#10b981' : '#7c3aed'}`,
                    background: copiedAll ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)',
                    color: copiedAll ? '#10b981' : '#7c3aed',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {copiedAll ? '✅ ¡Copiado!' : '📋 Copiar todos los datos para el portal SAT'}
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-sunk)', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                  >
                    ← Atrás
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    style={{ flex: 2, padding: '13px', borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
                  >
                    Siguiente → Confirmar
                  </button>
                </div>
              </motion.div>
            )}

            {/* ───────── PASO 3: Confirmación ───────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, marginBottom: 4 }}>
                  Revisa que todo esté correcto antes de crear la factura en el sistema:
                </div>

                {/* Resumen visual */}
                <div style={{
                  background: 'var(--paper-sunk)',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  overflow: 'hidden',
                }}>
                  <div style={{ background: '#1e3a8a', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#93c5fd' }}>FACTURA A CREAR</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: 'monospace' }}>
                      {folio ? `#${folio}` : '(sin folio aún)'}
                    </div>
                  </div>
                  {[
                    { k: 'OC de referencia', v: order.oc || order.folio || 'S/N' },
                    { k: 'Cliente', v: order.client || 'Grupo Textil Providencia' },
                    { k: 'Kilos facturados', v: `${kilos.toLocaleString('es-MX')} kg` },
                    { k: 'Precio unitario', v: `$${precio.toFixed(2)} / kg` },
                    { k: 'Subtotal (sin IVA)', v: money(subtotal) },
                    { k: 'IVA (16%)', v: money(iva) },
                    { k: 'TOTAL con IVA', v: money(total), accent: true },
                    { k: 'Fecha de emisión', v: issueDate },
                    { k: 'Fecha de vencimiento', v: dueDate },
                    { k: 'Estado inicial', v: 'Por cobrar (pending)' },
                  ].map(({ k, v, accent }) => (
                    <div
                      key={k}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '9px 16px',
                        borderBottom: '1px solid var(--line)',
                        background: accent ? 'rgba(37,99,235,0.06)' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>{k}</span>
                      <span style={{ fontSize: 12, fontWeight: accent ? 900 : 700, color: accent ? '#2563eb' : 'var(--ink)', fontFamily: 'monospace' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {!folio && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(234,179,8,0.1)',
                    border: '1px solid rgba(234,179,8,0.4)',
                    fontSize: 12,
                    color: '#a16207',
                    fontWeight: 600,
                  }}>
                    ⚠️ Sin folio — La factura se guardará sin número. Podrás agregarlo después desde el expediente una vez que lo tengas del portal del SAT.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => setStep(2)}
                    style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-sunk)', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                  >
                    ← Atrás
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={busy || kilos <= 0}
                    style={{
                      flex: 2,
                      padding: '15px',
                      borderRadius: 12,
                      border: 'none',
                      background: busy || kilos <= 0 ? 'var(--line)' : 'linear-gradient(135deg, #059669, #10b981)',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 900,
                      cursor: busy || kilos <= 0 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {busy ? '⏳ Creando...' : '✅ Crear Factura'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
