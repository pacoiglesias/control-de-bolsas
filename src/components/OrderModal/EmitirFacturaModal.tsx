import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import { addDays, computeFinancials, round2 } from '../../lib/finance';
import { toInputDate, fromInputDate, money, nombreClienteVisible } from '../../lib/format';
import { useInvoiceActions } from './useInvoiceActions';
import { useToast } from '../../context/ToastContext';
import type { PurchaseOrder, Invoice, FinancialConfig, PurchaseOrderItem } from '../../lib/types';
import { getEffectiveOrderItems, CANONICAL_TH_ITEMS, CANONICAL_GT_ITEMS } from '../../lib/types';

interface EmitirFacturaModalProps {
  order: PurchaseOrder;
  kilosPendientes: number;
  dynamicConfig: FinancialConfig;
  config: FinancialConfig;
  onClose: () => void;
  onCreated?: (inv: Invoice) => void;
}

type Step = 1 | 2 | 3;

interface ConceptRowItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  ocQuantity: number;
  unitPrice: number;
  selected: boolean;
}

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

  const precio = order.customSellPrice || dynamicConfig.salePricePerKg || config.salePricePerKg || 43;

  // --- Estado del formulario ---
  const [step, setStep] = useState<Step>(1);
  const [folio, setFolio] = useState('');
  const [issueDate, setIssueDate] = useState(toInputDate(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (config.creditDays || 30));
    return toInputDate(d);
  });
  const [busy, setBusy] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Helper para convertir una lista de items de la OC a ConceptRowItem
  const mapItemsToConcepts = (items: PurchaseOrderItem[]): ConceptRowItem[] => {
    const totalOcKilos = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const ratio = kilosPendientes > 0 && totalOcKilos > 0 ? (kilosPendientes / totalOcKilos) : 1;

    return items.map((it, idx) => {
      const ocQty = Number(it.quantity) || 0;
      const initialQty = kilosPendientes > 0 ? round2(ocQty * ratio) : ocQty;
      return {
        id: it.id || `item_${idx}_${Date.now()}`,
        code: it.code || '24111500',
        description: it.description || 'Bolsa de Polietileno',
        unit: it.unit || 'KGM',
        quantity: initialQty > 0 ? initialQty : ocQty,
        ocQuantity: ocQty,
        unitPrice: it.unitPrice || precio,
        selected: true,
      };
    });
  };

  // --- Conceptos / Partidas cargados de la OC ---
  const [conceptItems, setConceptItems] = useState<ConceptRowItem[]>(() => {
    const effectiveItems = getEffectiveOrderItems(order);
    if (effectiveItems.length > 0) {
      return mapItemsToConcepts(effectiveItems);
    }

    // Fallback: Concepto genérico inicial con los kilos disponibles o de la orden
    const fallbackKilos = kilosPendientes > 0 ? kilosPendientes : (Number(order.totalKilograms) || 1000);
    return [{
      id: `item_0_${Date.now()}`,
      code: config.satClaveProdServ || '24111500',
      description: 'BOLSA POLIETILENO TRANSPARENTE EN ROLLO / BULTOS',
      unit: 'KGM',
      quantity: fallbackKilos,
      ocQuantity: fallbackKilos,
      unitPrice: precio,
      selected: true,
    }];
  });

  // Kilos y montos calculados a partir de los conceptos seleccionados
  const selectedItems = useMemo(() => conceptItems.filter(it => it.selected), [conceptItems]);
  const kilos = useMemo(() => round2(selectedItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0)), [selectedItems]);

  // --- Cálculos en tiempo real ---
  const fin = useMemo(() => computeFinancials(kilos, { ...dynamicConfig, salePricePerKg: precio }), [kilos, dynamicConfig, precio]);
  const subtotal = useMemo(() => round2(selectedItems.reduce((s, it) => s + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || precio)), 0)), [selectedItems, precio]);
  const iva = round2(subtotal * 0.16);
  const total = round2(subtotal + iva);

  // Máximo facturables = kilos pendientes si existen
  const maxFacturables = kilosPendientes;

  // Actualizar un concepto
  const updateConcept = (index: number, field: keyof ConceptRowItem, value: any) => {
    setConceptItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleSelectAll = (select: boolean) => {
    setConceptItems(prev => prev.map(it => ({ ...it, selected: select })));
  };

  const addCustomConcept = () => {
    setConceptItems(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        code: '24111500',
        description: 'Concepto adicional...',
        unit: 'KGM',
        quantity: 0,
        ocQuantity: 0,
        unitPrice: precio,
        selected: true,
      }
    ]);
  };

  const removeConcept = (index: number) => {
    setConceptItems(prev => prev.filter((_, i) => i !== index));
  };

  // Convertir a formato PurchaseOrderItem para guardar en la factura
  const finalInvoiceItems: PurchaseOrderItem[] = useMemo(() => {
    return selectedItems.map(it => ({
      id: it.id,
      code: it.code || '24111500',
      description: it.description.trim(),
      quantity: Number(it.quantity) || 0,
      unit: it.unit || 'KGM',
      unitPrice: Number(it.unitPrice) || precio,
      amount: round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || precio)),
    }));
  }, [selectedItems, precio]);

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
OC de referencia: ${order.oc || order.folio || 'S/N'}
Conceptos:
${finalInvoiceItems.map(it => `• [${it.code || '24111500'}] ${it.description}: ${it.quantity.toLocaleString('es-MX')} kg @ $${it.unitPrice.toFixed(2)} = ${money(it.amount)}`).join('\n')}`;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(datosSAT);
    setCopiedAll(true);
    toast('📋 Datos fiscales y conceptos copiados al portapapeles', 'ok');
    setTimeout(() => setCopiedAll(false), 3000);
  };

  const handleCreate = async () => {
    if (kilos <= 0) {
      toast('Debes seleccionar al menos un concepto con kilos mayores a 0.', 'bad');
      return;
    }
    if (maxFacturables > 0 && kilos > maxFacturables + 0.01) {
      toast(`⚠️ Aviso: La suma (${kilos.toLocaleString('es-MX')} kg) excede los ${maxFacturables.toLocaleString('es-MX')} kg entregados sin facturar.`, 'bad');
    }
    setBusy(true);
    try {
      const nuevoId = Date.now().toString();
      const issue = fromInputDate(issueDate) || new Date();
      const due = fromInputDate(dueDate) || addDays(issue, config.creditDays || 30);

      const conceptNotes = finalInvoiceItems.map(it => `${it.description} (${it.quantity.toLocaleString('es-MX')} kg)`).join(' · ');

      const newInv: Invoice = {
        id: nuevoId,
        orderId: order.id || '',
        folio: folio.trim().toUpperCase() || '',
        kilos,
        financials: {
          ...fin,
          saleTotal: subtotal,
          invoiceTotal: total,
        },
        items: finalInvoiceItems,
        creditCycle: {
          status: 'facturado',
          issueDate: Timestamp.fromDate(issue),
          dueDate: Timestamp.fromDate(due),
        },
        collection: {
          paidAmount: 0,
          contrareciboNumber: '',
          notes: conceptNotes ? `Conceptos: ${conceptNotes}` : '',
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await saveInvoice(order, newInv, dynamicConfig);
      onCreated?.(newInv);
      toast(`✅ Factura creada con ${finalInvoiceItems.length} conceptos — ${kilos.toLocaleString('es-MX')} kg · ${money(total)} con IVA`, 'ok');
      onClose();
    } catch {
      // toast handled in saveInvoice
    } finally {
      setBusy(false);
    }
  };

  const stepLabels: Record<Step, string> = {
    1: '📦 Partidas & Conceptos de la OC',
    2: '🏛️ Datos Fiscales SAT (CFDI 4.0)',
    3: '✅ Confirmar y Emitir Factura',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 640,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          color: 'var(--ink)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fijo */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--line-soft)', background: 'var(--paper-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🧾</span> Emitir Factura Detallada
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              OC: <strong style={{ fontFamily: 'monospace', color: 'var(--ink)' }}>{order.oc || order.folio || 'S/N'}</strong> · {nombreClienteVisible(order.client)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--paper-sunk)', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div style={{ padding: '12px 22px 0', background: 'var(--paper)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
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
          <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>
            Paso {step} de 3 — {stepLabels[step]}
          </div>
        </div>

        {/* Contenido Scrollable */}
        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AnimatePresence mode="wait">
            
            {/* ───────── PASO 1: Partidas & Conceptos de la OC ───────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {/* Folio y Fechas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 10, background: 'var(--paper-sunk)', padding: 12, borderRadius: 12, border: '1px solid var(--line-soft)' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>Folio Factura</label>
                    <input
                      type="text"
                      placeholder="Ej. 6250"
                      value={folio}
                      onChange={(e) => setFolio(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 10px',
                        fontSize: 14,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--paper)',
                        color: 'var(--ink)',
                        outline: 'none',
                      }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>Emisión</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => {
                        setIssueDate(e.target.value);
                        const issue = fromInputDate(e.target.value);
                        if (issue) setDueDate(toInputDate(addDays(issue, config.creditDays || 30)));
                      }}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 12, fontWeight: 700, outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>Vencimiento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 12, fontWeight: 700, outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Banner de Conceptos de la OC */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📦</span> Conceptos de la Factura ({selectedItems.length} de {conceptItems.length} seleccionados)
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      Marca los conceptos a incluir y ajusta los kilos a facturar en cada renglón.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setConceptItems(mapItemsToConcepts(CANONICAL_TH_ITEMS))}
                      style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, border: '1px solid #3b82f6', background: 'rgba(59,130,246,0.08)', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}
                      title="Cargar las 6 partidas de Textil Hogar"
                    >
                      🏷️ Plantilla TH (6)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConceptItems(mapItemsToConcepts(CANONICAL_GT_ITEMS))}
                      style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, border: '1px solid #16a34a', background: 'rgba(22,163,74,0.08)', color: '#15803d', cursor: 'pointer', fontWeight: 700 }}
                      title="Cargar las 4 partidas de Grupo Textil"
                    >
                      🏷️ Plantilla GT (4)
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(true)}
                      style={{ fontSize: 10.5, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--paper-sunk)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      ⚡ Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(false)}
                      style={{ fontSize: 10.5, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--paper-sunk)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Ninguno
                    </button>
                    <button
                      type="button"
                      onClick={addCustomConcept}
                      style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                    >
                      ➕ Agregar
                    </button>
                  </div>
                </div>

                {/* Lista de Partidas / Conceptos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {conceptItems.map((item, idx) => {
                    const rowAmount = round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || precio));
                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          background: item.selected ? 'rgba(37,99,235,0.04)' : 'var(--paper-sunk)',
                          border: item.selected ? '1.5px solid #3b82f6' : '1px solid var(--line-soft)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          transition: 'all 0.2s ease',
                          opacity: item.selected ? 1 : 0.6,
                        }}
                      >
                        {/* Fila superior: Checkbox + Código + Descripción */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => updateConcept(idx, 'selected', e.target.checked)}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', background: 'rgba(37,99,235,0.08)', padding: '1px 6px', borderRadius: 4 }}>
                                {item.code || '24111500'}
                              </span>
                              <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                                {item.description}
                              </strong>
                            </div>
                            {item.ocQuantity > 0 && (
                              <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                                Pedido en OC: <b>{item.ocQuantity.toLocaleString('es-MX')} kg</b>
                              </div>
                            )}
                          </div>
                          {conceptItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeConcept(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 14, cursor: 'pointer', padding: '2px 6px' }}
                              title="Quitar este concepto"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Fila inferior: Inputs de Kilos, Precio e Importe */}
                        {item.selected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4, borderTop: '1px dashed var(--line-soft)', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 140px' }}>
                              <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>Kilos:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.quantity}
                                onChange={(e) => updateConcept(idx, 'quantity', Number(e.target.value))}
                                style={{
                                  width: 85,
                                  padding: '4px 6px',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  borderRadius: 6,
                                  border: '1px solid var(--line)',
                                  background: 'var(--paper)',
                                  color: 'var(--ink)',
                                  outline: 'none',
                                }}
                              />
                              {item.ocQuantity > 0 && item.quantity !== item.ocQuantity && (
                                <button
                                  type="button"
                                  onClick={() => updateConcept(idx, 'quantity', item.ocQuantity)}
                                  style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, background: 'var(--paper-raised)', border: '1px solid var(--line)', cursor: 'pointer', fontWeight: 700, color: '#2563eb' }}
                                  title="Poner el total de la OC"
                                >
                                  Máx
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>P. Unit:</span>
                              <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>${item.unitPrice.toFixed(2)}</span>
                            </div>

                            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                              <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>
                                {money(rowAmount)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Resumen de Importes */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(59,130,246,0.1))',
                  border: '1px solid rgba(37,99,235,0.25)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>KILOS TOTALES</div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>
                        {kilos.toLocaleString('es-MX')} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>SUBTOTAL</div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>
                        {money(subtotal)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>IVA (16%)</div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 2 }}>
                        {money(iva)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#2563eb', fontWeight: 800 }}>TOTAL c/IVA</div>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
                        {money(total)}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={kilos <= 0}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    border: 'none',
                    background: kilos > 0 ? '#2563eb' : 'var(--line)',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: kilos > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Siguiente → Datos SAT & Pre-Factura ({finalInvoiceItems.length} partidas)
                </button>
              </motion.div>
            )}

            {/* ───────── PASO 2: Datos Fiscales del Receptor ───────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
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
                    { label: 'Precio Unitario', val: `$${precio.toFixed(2)} / kg`, mono: true, accent: true },
                    { label: 'Método de Pago', val: 'PPD - Pago en parcialidades o diferido', mono: false },
                    { label: 'Forma de Pago', val: '99 - Por definir', mono: false },
                    { label: 'OC de referencia', val: order.oc || order.folio || 'S/N', mono: true, accent: true },
                  ].map(({ label, val, mono, accent }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(124,58,237,0.15)', paddingBottom: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>{label}:</span>
                      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: mono ? 'monospace' : 'inherit', color: accent ? '#7c3aed' : 'var(--ink)' }}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Desglose de partidas SAT */}
                <div style={{ background: 'var(--paper-sunk)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', marginBottom: 8, textTransform: 'uppercase' }}>
                    📦 Partidas a capturar en el SAT ({finalInvoiceItems.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {finalInvoiceItems.map((it, idx) => (
                      <div key={it.id || idx} style={{ background: 'var(--paper)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line-soft)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="mono" style={{ fontWeight: 800, color: '#2563eb' }}>{it.code || '24111500'}</span> · <strong>{it.description}</strong>
                        </div>
                        <div className="mono" style={{ fontWeight: 800 }}>
                          {it.quantity.toLocaleString('es-MX')} kg @ ${it.unitPrice.toFixed(2)} = {money(it.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyAll}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    border: `2px solid ${copiedAll ? '#10b981' : '#7c3aed'}`,
                    background: copiedAll ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)',
                    color: copiedAll ? '#10b981' : '#7c3aed',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {copiedAll ? '✅ ¡Copiado al Portapapeles!' : '📋 Copiar todos los datos fiscales y partidas para el SAT'}
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--paper-sunk)', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    ← Modificar Conceptos
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}
                  >
                    Siguiente → Confirmar Factura
                  </button>
                </div>
              </motion.div>
            )}

            {/* ───────── PASO 3: Confirmación ───────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600 }}>
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
                    { k: 'Partidas desglosadas', v: `${finalInvoiceItems.length} concepto(s)` },
                    { k: 'Kilos facturados', v: `${kilos.toLocaleString('es-MX')} kg` },
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
                        padding: '8px 14px',
                        borderBottom: '1px solid var(--line-soft)',
                        background: accent ? 'rgba(37,99,235,0.06)' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>{k}</span>
                      <span style={{ fontSize: 12, fontWeight: accent ? 900 : 700, color: accent ? '#2563eb' : 'var(--ink)', fontFamily: 'monospace' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Vista previa de partidas */}
                <div style={{ background: 'var(--paper-sunk)', padding: 10, borderRadius: 8, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    Partidas asignadas a esta factura:
                  </div>
                  {finalInvoiceItems.map((it, idx) => (
                    <div key={it.id || idx} style={{ fontSize: 11, color: 'var(--ink)', padding: '2px 0' }}>
                      • <strong>{it.description}</strong>: {it.quantity.toLocaleString('es-MX')} kg @ ${it.unitPrice.toFixed(2)} ({money(it.amount)})
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{ flex: 1, padding: '13px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--paper-sunk)', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                  >
                    ← Modificar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={busy || kilos <= 0}
                    style={{
                      flex: 2,
                      padding: '13px',
                      borderRadius: 12,
                      border: 'none',
                      background: busy ? 'var(--line)' : '#059669',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: 15,
                      cursor: busy ? 'wait' : 'pointer',
                      boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                    }}
                  >
                    {busy ? 'Creando factura...' : '💾 Crear y Guardar Factura'}
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
