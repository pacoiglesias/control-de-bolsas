import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import { addDays, computeFinancials, round2, validateInvoiceWeightGuardrail } from '../../lib/finance';
import { toInputDate, fromInputDate, money, nombreClienteVisible } from '../../lib/format';
import { useInvoiceActions } from './useInvoiceActions';
import { useToast } from '../../context/ToastContext';
import type { PurchaseOrder, Invoice, FinancialConfig, PurchaseOrderItem } from '../../lib/types';
import { CANONICAL_TH_ITEMS, CANONICAL_GT_ITEMS, CANONICAL_GT_ITEMS_439753, CANONICAL_GT_ITEMS_439784 } from '../../lib/types';
import { computeItemInvoiceBreakdown } from '../../lib/deliveries';
import { printConsolidatedPackage } from './orderModalPrint';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useOrders } from '../../hooks/useOrders';
import { findDuplicateInvoiceFolio } from '../../lib/duplicateGuards';

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
  alreadyInvoiced: number;
  alreadyDelivered: number;
  uninvoicedDeliveredKilos: number;
  remainingOcKilos: number;
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
  const { orders } = useOrders();
  const { settings } = useSystemSettings();
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
  const [showDualModal, setShowDualModal] = useState(false);
  const [dualFolio1, setDualFolio1] = useState('');
  const [dualFolio2, setDualFolio2] = useState('');

  // Identificador OC 43/9784 (Evelia · Remisión 6439784 · 2,000 kg)
  const isOC9784 = useMemo(() => {
    const ocText = `${order.oc || ''} ${order.folio || ''}`.toUpperCase();
    return ocText.includes('439784') || ocText.includes('9784') || ocText.includes('12026439784');
  }, [order.oc, order.folio]);

  // Detector en vivo de folios duplicados para emisión individual y dual
  const duplicateInvoiceMatch = useMemo(() => {
    const clean = folio.trim();
    if (!clean || clean.length < 2) return null;
    return findDuplicateInvoiceFolio(orders, clean);
  }, [orders, folio]);

  const duplicateDual1 = useMemo(() => {
    const clean = dualFolio1.trim();
    if (!clean || clean.length < 2) return null;
    return findDuplicateInvoiceFolio(orders, clean);
  }, [orders, dualFolio1]);

  const duplicateDual2 = useMemo(() => {
    const clean = dualFolio2.trim();
    if (!clean || clean.length < 2) return null;
    return findDuplicateInvoiceFolio(orders, clean);
  }, [orders, dualFolio2]);

  const dualFoliosMatch = useMemo(() => {
    return dualFolio1.trim().length > 0 &&
           dualFolio2.trim().length > 0 &&
           dualFolio1.trim().toUpperCase() === dualFolio2.trim().toUpperCase();
  }, [dualFolio1, dualFolio2]);

  // Helper para convertir una lista de items de plantilla a ConceptRowItem
  const mapItemsToConcepts = (items: PurchaseOrderItem[]): ConceptRowItem[] => {
    const totalOcKilos = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const ratio = kilosPendientes > 0 && totalOcKilos > 0 ? (kilosPendientes / totalOcKilos) : 1;

    return items.map((it, idx) => {
      const ocQty = Number(it.quantity) || 0;
      const initialQty = kilosPendientes > 0 ? round2(ocQty * ratio) : ocQty;
      return {
        id: it.id || `item_${idx}_${Date.now()}`,
        code: it.code || '24141500',
        description: it.description || 'Bolsa de Polietileno',
        unit: it.unit || 'KGM',
        quantity: initialQty > 0 ? initialQty : ocQty,
        ocQuantity: ocQty,
        alreadyInvoiced: 0,
        alreadyDelivered: initialQty,
        uninvoicedDeliveredKilos: initialQty,
        remainingOcKilos: ocQty,
        unitPrice: it.unitPrice || precio,
        selected: true,
      };
    });
  };

  // --- Conceptos / Partidas cargados de la OC usando el motor de conciliación ---
  const [conceptItems, setConceptItems] = useState<ConceptRowItem[]>(() => {
    // ── Guardia OC 439753: si Firestore tiene items incompletos (< 4 códigos),
    //    inyectar el canónico completo para que el breakdown reciba los 4 artículos.
    const ocText = `${order.oc || ''} ${order.folio || ''}`.toUpperCase();
    const isOC9784 = ocText.includes('439784') || ocText.includes('9784') || ocText.includes('12026439784');
    const isOC9753 = ocText.includes('439753') || ocText.includes('9753') || ocText.includes('12026439753');
    const REQUIRED_9753 = ['EGBO000095-SC', 'EGBO000093-SC', 'EGBO000018-SC', 'EGBO000094-SC'];
    const REQUIRED_9784 = ['EGBO000095-SC', 'EGBO000093-SC', 'EGBO000018-SC'];
    let effectiveOrder = order;

    if (isOC9784) {
      const existingCodes = (order.items || []).map(it => (it.code || '').toUpperCase());
      const allPresent = REQUIRED_9784.every(c => existingCodes.some(ec => ec.includes(c)));
      if (!allPresent || (order.items || []).length !== 3) {
        effectiveOrder = { ...order, items: CANONICAL_GT_ITEMS_439784 };
      }
      if (!effectiveOrder.deliveries || !effectiveOrder.deliveries.some((d: any) => d.docFolio === '6439784' || d.id === 'del-gt-6439784')) {
        effectiveOrder = {
          ...effectiveOrder,
          deliveries: [
            {
              id: 'del-gt-6439784',
              date: Timestamp.fromDate(new Date('2026-10-05T12:00:00Z')),
              kilos: 2000.00,
              items: [
                { itemId: 'it-gt-9784-1', quantity: 500.00 },
                { itemId: 'it-gt-9784-2', quantity: 500.00 },
                { itemId: 'it-gt-9784-3', quantity: 1000.00 },
              ],
              invoiced: false,
              docType: 'remision',
              docFolio: '6439784',
              notes: 'Remisión Oficial 6439784 sellada en P4 (5-10-26). Partidas: 500 + 500 + 1000 = 2000 kg.',
            },
            ...(effectiveOrder.deliveries || []),
          ],
        };
      }
    } else if (isOC9753) {
      const existingCodes = (order.items || []).map(it => (it.code || '').toUpperCase());
      const allPresent = REQUIRED_9753.every(c => existingCodes.includes(c));
      if (!allPresent) {
        effectiveOrder = { ...order, items: CANONICAL_GT_ITEMS_439753 };
      }
    }

    const breakdown = computeItemInvoiceBreakdown(effectiveOrder, precio);
    if (breakdown.length > 0) {
      return breakdown.map((b) => {
        const qty = b.suggestedKilosToInvoice > 0 ? b.suggestedKilosToInvoice : (b.uninvoicedDeliveredKilos > 0 ? b.uninvoicedDeliveredKilos : b.remainingOcKilos);
        return {
          id: b.id,
          code: b.code,
          description: b.description,
          unit: b.unit,
          quantity: qty,
          ocQuantity: b.ocQuantity,
          alreadyInvoiced: b.alreadyInvoiced,
          alreadyDelivered: b.alreadyDelivered,
          uninvoicedDeliveredKilos: b.uninvoicedDeliveredKilos,
          remainingOcKilos: b.remainingOcKilos,
          unitPrice: b.unitPrice || precio,
          selected: b.suggestedKilosToInvoice > 0 || b.uninvoicedDeliveredKilos > 0,
        };
      });
    }

    // Fallback: Concepto genérico inicial con los kilos disponibles o de la orden
    const fallbackKilos = kilosPendientes > 0 ? kilosPendientes : (Number(order.totalKilograms) || 1000);
    return [{
      id: `item_0_${Date.now()}`,
      code: config.satClaveProdServ || '24141500',
      description: 'BOLSA POLIETILENO TRANSPARENTE EN ROLLO / BULTOS',
      unit: 'KGM',
      quantity: fallbackKilos,
      ocQuantity: fallbackKilos,
      alreadyInvoiced: 0,
      alreadyDelivered: fallbackKilos,
      uninvoicedDeliveredKilos: fallbackKilos,
      remainingOcKilos: fallbackKilos,
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
    setConceptItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        code: '24141500',
        description: 'Concepto adicional...',
        unit: 'KGM',
        quantity: 0,
        ocQuantity: 0,
        alreadyInvoiced: 0,
        alreadyDelivered: 0,
        uninvoicedDeliveredKilos: 0,
        remainingOcKilos: 0,
        unitPrice: precio,
        selected: true,
      },
    ]);
  };

  const removeConcept = (index: number) => {
    setConceptItems(prev => prev.filter((_, i) => i !== index));
  };

  // Convertir a formato PurchaseOrderItem para guardar en la factura
  const finalInvoiceItems: PurchaseOrderItem[] = useMemo(() => {
    return selectedItems.map(it => ({
      id: it.id,
      code: it.code || '24141500',
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
Domicilio Fiscal (CP): 90800
Régimen Fiscal: 601 - General de Ley Personas Morales
Uso CFDI: G01 - Adquisición de mercancías
Clave ProdServ SAT: 24141500 (Suministros para seguridad y protección)
Unidad SAT: KGM (Kilogramo)
Precio Unitario: $${precio.toFixed(2)}
Objeto de Impuesto: 02 - Sí objeto de impuesto
IVA: 16% (Tasa 0.160000)
Método de Pago: PPD - Pago en parcialidades o diferido
Forma de Pago: 99 - Por definir
Condiciones de Pago / OC: OC ${order.oc || order.folio || 'S/N'}
Conceptos desglosados:
${finalInvoiceItems.map(it => `• [${it.code || 'S/C'}] ${it.description} — ${it.quantity.toLocaleString('es-MX')} KGM @ $${it.unitPrice.toFixed(2)} = ${money(it.amount)} (IVA $${round2(it.amount * 0.16).toLocaleString('es-MX', { minimumFractionDigits: 2 })})`).join('\n')}`;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(datosSAT);
    setCopiedAll(true);
    toast('📋 Datos fiscales y conceptos copiados al portapapeles', 'ok');
    setTimeout(() => setCopiedAll(false), 3000);
  };

  const handleApplyPreset = (type: 'evelia_f1' | 'evelia_f2' | 'all' | 'half') => {
    if (type === 'evelia_f1') {
      setConceptItems(prev => prev.map((it, idx) => {
        if (idx === 0) return { ...it, quantity: 500, selected: true };
        if (idx === 1) return { ...it, quantity: 500, selected: true };
        return { ...it, quantity: 0, selected: false };
      }));
      toast('🎯 Factura 1 de Evelia seleccionada: 1,000.00 kg · $49,880.00 con IVA', 'ok');
    } else if (type === 'evelia_f2') {
      setConceptItems(prev => prev.map((it, idx) => {
        if (idx === 2 || idx === prev.length - 1) return { ...it, quantity: 1000, selected: true };
        return { ...it, quantity: 0, selected: false };
      }));
      toast('🎯 Factura 2 de Evelia seleccionada: 1,000.00 kg · $49,880.00 con IVA', 'ok');
    } else if (type === 'all') {
      setConceptItems(prev => prev.map((it, idx) => {
        const qty = idx === 0 ? 500 : idx === 1 ? 500 : idx === 2 ? 1000 : it.ocQuantity;
        return { ...it, quantity: qty, selected: true };
      }));
      toast('📦 Todo el lote seleccionado: 2,000.00 kg · $99,760.00 con IVA', 'ok');
    } else if (type === 'half') {
      setConceptItems(prev => prev.map(it => {
        const half = round2((it.quantity || it.ocQuantity) / 2);
        return { ...it, quantity: half, selected: half > 0 };
      }));
      toast('⚖️ Kilos divididos al 50%', 'ok');
    }
  };

  const handleCreateDual = async () => {
    const f1 = dualFolio1.trim().toUpperCase();
    const f2 = dualFolio2.trim().toUpperCase();

    if (!f1 || !f2) {
      toast('Debes capturar ambos folios (Factura 1 y Factura 2).', 'bad');
      return;
    }
    if (f1 === f2) {
      toast('Los dos folios deben ser diferentes.', 'bad');
      return;
    }
    if (duplicateDual1) {
      toast(`🚨 El folio #${f1} ya está registrado en la OC #${duplicateDual1.orderFolio} (${duplicateDual1.client}).`, 'bad');
      return;
    }
    if (duplicateDual2) {
      toast(`🚨 El folio #${f2} ya está registrado en la OC #${duplicateDual2.orderFolio} (${duplicateDual2.client}).`, 'bad');
      return;
    }

    setBusy(true);
    try {
      const issue = fromInputDate(issueDate) || new Date();
      const due = fromInputDate(dueDate) || addDays(issue, config.creditDays || 30);

      const p1 = conceptItems[0] || { code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 60+40X125CM', unit: 'KGM' };
      const p2 = conceptItems[1] || { code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 60+40X95CM', unit: 'KGM' };
      const p3 = conceptItems[2] || { code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 60X40X115CM', unit: 'KGM' };

      const itemsF1: PurchaseOrderItem[] = [
        { id: p1.id || 'it-1', code: p1.code, description: p1.description, quantity: 500, unit: p1.unit || 'KGM', unitPrice: precio, amount: 500 * precio },
        { id: p2.id || 'it-2', code: p2.code, description: p2.description, quantity: 500, unit: p2.unit || 'KGM', unitPrice: precio, amount: 500 * precio },
      ];

      const itemsF2: PurchaseOrderItem[] = [
        { id: p3.id || 'it-3', code: p3.code, description: p3.description, quantity: 1000, unit: p3.unit || 'KGM', unitPrice: precio, amount: 1000 * precio },
      ];

      const inv1: Invoice = {
        id: Date.now().toString(),
        orderId: order.id,
        folio: f1,
        kilos: 1000,
        financials: computeFinancials(1000, { ...dynamicConfig, salePricePerKg: precio }),
        items: itemsF1,
        creditCycle: { status: 'facturado', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
        collection: { paidAmount: 0, contrareciboNumber: '', notes: 'Factura 1 de 2 · Remisión 6439784 (Partidas 1 y 2 · 500+500 kg)' },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const inv2: Invoice = {
        id: (Date.now() + 1).toString(),
        orderId: order.id,
        folio: f2,
        kilos: 1000,
        financials: computeFinancials(1000, { ...dynamicConfig, salePricePerKg: precio }),
        items: itemsF2,
        creditCycle: { status: 'facturado', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
        collection: { paidAmount: 0, contrareciboNumber: '', notes: 'Factura 2 de 2 · Remisión 6439784 (Partida 3 · 1,000 kg)' },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await saveInvoice(order, inv1, dynamicConfig);
      await saveInvoice(order, inv2, dynamicConfig);

      toast(`🎉 ¡Facturas ${inv1.folio} y ${inv2.folio} emitidas con éxito! (2,000 kg en 2 facturas de 1,000 kg)`, 'ok');
      setShowDualModal(false);
      if (onCreated) onCreated(inv1);
      onClose();
    } catch (e: any) {
      toast(`Error al emitir facturas: ${e.message}`, 'bad');
    } finally {
      setBusy(false);
    }
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
                        border: duplicateInvoiceMatch ? '1.5px solid #ef4444' : '1px solid var(--line)',
                        background: 'var(--paper)',
                        color: 'var(--ink)',
                        outline: 'none',
                      }}
                      autoFocus
                    />
                    {duplicateInvoiceMatch && (
                      <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, marginTop: 4, lineHeight: 1.2 }}>
                        🚨 Folio ya usado en OC #{duplicateInvoiceMatch.orderFolio} ({duplicateInvoiceMatch.client})
                      </div>
                    )}
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

                {/* ⚡ Asistente de Facturación Rápida para Lic. Evelia (Remisión 6439784 · 2,000 kg) */}
                {isOC9784 && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
                      border: '1.5px solid #3b82f6',
                      borderRadius: 12,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>⚡</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#1e40af' }}>
                            Instrucción Especial Evelia: Remisión 6439784 en 2 Facturas de 1,000 kg
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                            2,000 kg entregados en Planta P4 · Selecciona qué factura emitir o genera ambas en 1 solo paso:
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: '#dbeafe', color: '#1e40af' }}>
                        $43.00/kg · $49,880.00 c/u
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('evelia_f1')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #2563eb',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontWeight: 800,
                          fontSize: 11.5,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span>🎯 Factura 1 (1,000 kg)</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6' }}>Partidas 1 y 2 (500+500 kg) · $49,880</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyPreset('evelia_f2')}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #059669',
                          background: '#ecfdf5',
                          color: '#047857',
                          fontWeight: 800,
                          fontSize: 11.5,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <span>🎯 Factura 2 (1,000 kg)</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#059669' }}>Partida 3 (1,000 kg) · $49,880</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDualModal(true)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #7c3aed',
                          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: 12,
                          cursor: 'pointer',
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
                        }}
                      >
                        <span>🚀 Emitir Ambas (1 Clic)</span>
                      </button>
                    </div>
                  </div>
                )}

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
                      title="Cargar las 4 partidas estándar de Grupo Textil"
                    >
                      🏷️ Plantilla GT (4)
                    </button>
                    {/* Botón especial para OC 43/9784 con los 3 artículos exactos */}
                    {isOC9784 && (
                      <button
                        type="button"
                        onClick={() => setConceptItems(mapItemsToConcepts(CANONICAL_GT_ITEMS_439784))}
                        style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, border: '1px solid #2563eb', background: 'rgba(37,99,235,0.08)', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}
                        title="Cargar los 3 artículos exactos de la OC 43/9784: EGBO000095, EGBO000093, EGBO000018"
                      >
                        🔖 OC 43/9784 (3 art.)
                      </button>
                    )}
                    {/* Botón especial para OC 43/9753 con los 4 artículos exactos */}
                    {(order.oc?.includes('439753') || order.oc?.includes('12026439753') || order.folio?.includes('9753')) && (
                      <button
                        type="button"
                        onClick={() => setConceptItems(mapItemsToConcepts(CANONICAL_GT_ITEMS_439753))}
                        style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, border: '1px solid #d97706', background: 'rgba(217,119,6,0.08)', color: '#b45309', cursor: 'pointer', fontWeight: 700 }}
                        title="Cargar los 4 artículos exactos de la OC 43/9753: EGBO000095, EGBO000093, EGBO000018, EGBO000094"
                      >
                        🔖 OC 43/9753 (4 art.)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('half')}
                      style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 6, border: '1px solid #8b5cf6', background: 'rgba(139,92,246,0.08)', color: '#6d28d9', cursor: 'pointer', fontWeight: 700 }}
                      title="Dividir kilos de cada partida al 50%"
                    >
                      ⚖️ 50% Mitad
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                  {conceptItems.map((item, idx) => {
                    const rowAmount = round2((Number(item.quantity) || 0) * (Number(item.unitPrice) || precio));
                    const isFullyInvoiced = item.alreadyInvoiced >= item.ocQuantity && item.ocQuantity > 0;
                    const faltanOcKilos = round2(Math.max(0, item.ocQuantity - item.alreadyInvoiced));

                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          background: isFullyInvoiced
                            ? 'var(--paper-sunk)'
                            : item.selected
                            ? 'rgba(37,99,235,0.03)'
                            : 'var(--paper)',
                          border: isFullyInvoiced
                            ? '1px solid var(--line-soft)'
                            : item.selected
                            ? '1.5px solid #2563eb'
                            : '1px solid var(--line)',
                          borderRadius: 12,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          boxShadow: item.selected ? '0 2px 8px rgba(37,99,235,0.08)' : 'none',
                          opacity: isFullyInvoiced && !item.selected ? 0.65 : 1,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Fila 1: Checkbox + Identificador + Nombre + Estatus */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) => updateConcept(idx, 'selected', e.target.checked)}
                              style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#2563eb', flexShrink: 0, marginTop: 2 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: '#1e40af',
                                    background: 'rgba(37,99,235,0.1)',
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    letterSpacing: '0.02em',
                                  }}
                                >
                                  {item.code || '24141500'}
                                </span>
                                <strong style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.3 }}>
                                  {item.description}
                                </strong>
                                {isFullyInvoiced && (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      color: '#16a34a',
                                      fontWeight: 800,
                                      background: '#dcfce7',
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    ✓ 100% Facturado
                                  </span>
                                )}
                              </div>

                              {/* Fila de Pills Informativas (OC, Facturado, Falta Facturar, Báscula) */}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                                {item.ocQuantity > 0 && (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--paper-sunk)', border: '1px solid var(--line-soft)', color: 'var(--ink-soft)' }}>
                                    📦 OC: <strong style={{ color: 'var(--ink)' }}>{item.ocQuantity.toLocaleString('es-MX')} kg</strong>
                                  </span>
                                )}
                                {item.alreadyInvoiced > 0 && (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#6d28d9' }}>
                                    🧾 Ya Facturado: <strong>{item.alreadyInvoiced.toLocaleString('es-MX')} kg</strong>
                                  </span>
                                )}
                                {faltanOcKilos > 0.01 ? (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', color: '#b45309', fontWeight: 700 }}>
                                    ⏳ Falta Facturar: {faltanOcKilos.toLocaleString('es-MX')} kg
                                  </span>
                                ) : item.ocQuantity > 0 ? (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: '#15803d', fontWeight: 700 }}>
                                    🟢 0 kg pendientes
                                  </span>
                                ) : null}
                                {item.uninvoicedDeliveredKilos > 0 ? (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontWeight: 700 }}>
                                    🚚 Listo en Báscula: {item.uninvoicedDeliveredKilos.toLocaleString('es-MX')} kg
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--paper-sunk)', color: 'var(--ink-soft)' }}>
                                    ⚖️ 0 kg en báscula
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {conceptItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeConcept(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 16, cursor: 'pointer', opacity: 0.7, padding: '2px 6px' }}
                              title="Quitar esta partida de la factura"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Fila 2: Captura de Kilos, Botones Rápidos y Cálculos (Solo si está seleccionada) */}
                        {item.selected && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              paddingTop: 8,
                              borderTop: '1px dashed var(--line-soft)',
                              flexWrap: 'wrap',
                            }}
                          >
                            {/* Selector de Kilos con Botones Rápidos */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)' }}>
                                Kilos a facturar:
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--paper)', border: '1.5px solid #2563eb', borderRadius: 8, overflow: 'hidden' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  placeholder="0.00"
                                  onChange={(e) => updateConcept(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                  style={{
                                    width: 90,
                                    padding: '6px 8px',
                                    fontSize: 14,
                                    fontWeight: 900,
                                    fontFamily: 'monospace',
                                    textAlign: 'right',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    color: 'var(--ink)',
                                  }}
                                />
                                <span style={{ padding: '6px 8px 6px 0', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
                                  kg
                                </span>
                              </div>

                              {/* Botones Rápidos y Claros */}
                              {item.uninvoicedDeliveredKilos > 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateConcept(idx, 'quantity', item.uninvoicedDeliveredKilos)}
                                  style={{
                                    fontSize: 11,
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    background: '#dbeafe',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                  title={`Cargar los ${item.uninvoicedDeliveredKilos.toLocaleString('es-MX')} kg listos de báscula`}
                                >
                                  ⚡ Cargar Báscula ({item.uninvoicedDeliveredKilos.toLocaleString('es-MX')} kg)
                                </button>
                              )}

                              {faltanOcKilos > 0 && faltanOcKilos !== item.uninvoicedDeliveredKilos && (
                                <button
                                  type="button"
                                  onClick={() => updateConcept(idx, 'quantity', faltanOcKilos)}
                                  style={{
                                    fontSize: 11,
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    background: 'var(--paper-sunk)',
                                    color: 'var(--ink)',
                                    border: '1px solid var(--line)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                  title={`Cargar todo lo restante de la OC (${faltanOcKilos.toLocaleString('es-MX')} kg)`}
                                >
                                  Restante OC ({faltanOcKilos.toLocaleString('es-MX')} kg)
                                </button>
                              )}

                              {item.quantity > 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateConcept(idx, 'quantity', 0)}
                                  style={{
                                    fontSize: 11,
                                    padding: '4px 6px',
                                    borderRadius: 6,
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                  title="Poner en 0 kg"
                                >
                                  ✕ Limpiar
                                </button>
                              )}
                            </div>

                            {/* Precio e Importe Calculado */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                                @ ${item.unitPrice.toFixed(2)}/kg
                              </div>
                              <div className="mono" style={{ fontSize: 14.5, fontWeight: 900, color: '#059669' }}>
                                {money(rowAmount)}
                              </div>
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

                {/* Guardrail Anti-Sobrefacturación */}
                {(() => {
                  const guardrail = validateInvoiceWeightGuardrail(order, kilos);
                  if (!guardrail.isOverDelivered && !guardrail.isOverOrdered) return null;
                  return (
                    <div
                      style={{
                        background: 'rgba(220, 38, 38, 0.08)',
                        border: '1.5px solid #dc2626',
                        borderRadius: 10,
                        padding: '10px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ color: '#b91c1c', fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🛡️ Guardrail Anti-Sobrefacturación:</span>
                        <span>{guardrail.message}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                        A Providencia no se le pueden facturar kilos de más. Ajusta los conceptos seleccionados para que no sobrepasen lo amparado en báscula.
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={
                    kilos <= 0 ||
                    !!duplicateInvoiceMatch ||
                    validateInvoiceWeightGuardrail(order, kilos).isOverDelivered ||
                    validateInvoiceWeightGuardrail(order, kilos).isOverOrdered
                  }
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    border: 'none',
                    background:
                      kilos > 0 &&
                      !duplicateInvoiceMatch &&
                      !validateInvoiceWeightGuardrail(order, kilos).isOverDelivered &&
                      !validateInvoiceWeightGuardrail(order, kilos).isOverOrdered
                        ? '#2563eb'
                        : 'var(--line)',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 800,
                    cursor:
                      kilos > 0 &&
                      !duplicateInvoiceMatch &&
                      !validateInvoiceWeightGuardrail(order, kilos).isOverDelivered &&
                      !validateInvoiceWeightGuardrail(order, kilos).isOverOrdered
                        ? 'pointer'
                        : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: kilos > 0 ? '0 4px 14px rgba(37,99,235,0.3)' : 'none',
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
                    { label: 'Domicilio Fiscal (CP)', val: '90800', mono: true },
                    { label: 'Régimen Fiscal', val: '601 - General de Ley Personas Morales', mono: false },
                    { label: 'Uso CFDI', val: 'G01 - Adquisición de mercancías', mono: false },
                    { label: 'Clave ProdServ SAT', val: '24141500', mono: true },
                    { label: 'Unidad SAT', val: 'KGM (Kilogramo)', mono: true },
                    { label: 'Precio Unitario', val: `$${precio.toFixed(2)} / kg`, mono: true, accent: true },
                    { label: 'Método de Pago', val: 'PPD - Pago en parcialidades o diferido', mono: false },
                    { label: 'Forma de Pago', val: '99 - Por definir', mono: false },
                    { label: 'Condiciones de Pago', val: `OC ${order.oc || order.folio || 'S/N'}`, mono: true, accent: true },
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
                          <span className="mono" style={{ fontWeight: 800, color: '#2563eb' }}>{it.code || '24141500'}</span> · <strong>{it.description}</strong>
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

                {/* Botón de Salida Documental Rápida */}
                <button
                  type="button"
                  onClick={() => printConsolidatedPackage({
                    folio: order.folio,
                    client: order.client,
                    department: order.department,
                    oc: order.oc,
                    totalKilograms: order.totalKilograms,
                    invoices: order.invoices,
                    deliveries: order.deliveries,
                    config,
                    provName: settings?.providerName || 'Andrés',
                  })}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: '1px solid #3b82f6',
                    background: 'rgba(59,130,246,0.08)',
                    color: '#1d4ed8',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  title="Imprimir juego completo (Factura + Báscula + OC) para ingresar a ventanilla de Cuentas por Pagar"
                >
                  <span>🖨️</span> Imprimir Paquete para Contrarecibo (Factura + Báscula + OC)
                </button>

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
                    disabled={busy || kilos <= 0 || !!duplicateInvoiceMatch}
                    style={{
                      flex: 2,
                      padding: '13px',
                      borderRadius: 12,
                      border: 'none',
                      background: (busy || !!duplicateInvoiceMatch) ? 'var(--line)' : '#059669',
                      color: '#fff',
                      fontWeight: 900,
                      fontSize: 15,
                      cursor: (busy || !!duplicateInvoiceMatch) ? 'not-allowed' : 'pointer',
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

      {/* ───────── MODAL DE EMISIÓN DUAL SIMULTÁNEA (2 FACTURAS DE 1,000 KG) ───────── */}
      <AnimatePresence>
        {showDualModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setShowDualModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                width: '100%',
                maxWidth: 640,
                background: 'var(--paper)',
                color: 'var(--ink)',
                borderRadius: 16,
                border: '1.5px solid var(--line)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>⚡</span> Emisión Dual Simultánea (2 Facturas × 1,000 kg)
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>
                    Remisión Oficial 6439784 · Petición especial Lic. Evelia Castillo (Grupo Textil Providencia)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDualModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: '#fff',
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    cursor: 'pointer',
                    fontWeight: 900,
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '75vh', overflowY: 'auto' }}>
                <div
                  style={{
                    background: 'rgba(37,99,235,0.06)',
                    border: '1px solid #bfdbfe',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 12,
                    color: '#1e40af',
                    lineHeight: 1.4,
                  }}
                >
                  💡 <strong>Proceso ultra-rápido:</strong> Ambas facturas se generarán y guardarán al mismo tiempo vinculadas a la OC 12026439784 y remisión 6439784, dejando los 2,000 kg 100% amparados.
                </div>

                {/* Tarjetas de las 2 Facturas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                  {/* Factura 1 */}
                  <div
                    style={{
                      background: 'var(--paper-sunk)',
                      border: '1.5px solid #3b82f6',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 900, fontSize: 13, color: '#1d4ed8' }}>🎯 Factura 1 de 2</span>
                      <span style={{ fontSize: 11, fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 6 }}>1,000.00 kg</span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.3 }}>
                      <div>• 500 kg: Bolsa 60+40X125 CM (EGBO000095-SC)</div>
                      <div>• 500 kg: Bolsa 60+40X95 CM (EGBO000093-SC)</div>
                    </div>

                    <div style={{ background: 'var(--paper)', padding: 10, borderRadius: 8, border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
                        <span>Subtotal:</span>
                        <span>$43,000.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
                        <span>IVA (16%):</span>
                        <span>$6,880.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900, color: 'var(--ink)', marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--line)' }}>
                        <span>Total:</span>
                        <span style={{ color: '#2563eb' }}>$49,880.00 MXN</span>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                        Folio Factura 1 <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. 6303"
                        value={dualFolio1}
                        onChange={(e) => setDualFolio1(e.target.value.toUpperCase())}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 10px',
                          fontSize: 14,
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          borderRadius: 8,
                          border: duplicateDual1 ? '1.5px solid #ef4444' : '1px solid var(--line)',
                          background: 'var(--paper)',
                          color: 'var(--ink)',
                          outline: 'none',
                        }}
                        autoFocus
                      />
                      {duplicateDual1 && (
                        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, marginTop: 4 }}>
                          🚨 Folio ya usado en OC #{duplicateDual1.orderFolio}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Factura 2 */}
                  <div
                    style={{
                      background: 'var(--paper-sunk)',
                      border: '1.5px solid #059669',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 900, fontSize: 13, color: '#047857' }}>🎯 Factura 2 de 2</span>
                      <span style={{ fontSize: 11, fontWeight: 800, background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 6 }}>1,000.00 kg</span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.3 }}>
                      <div>• 1,000 kg: Bolsa 60X40X115 CM (EGBO000018-SC)</div>
                      <div style={{ opacity: 0.5 }}>&nbsp;</div>
                    </div>

                    <div style={{ background: 'var(--paper)', padding: 10, borderRadius: 8, border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
                        <span>Subtotal:</span>
                        <span>$43,000.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
                        <span>IVA (16%):</span>
                        <span>$6,880.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900, color: 'var(--ink)', marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--line)' }}>
                        <span>Total:</span>
                        <span style={{ color: '#059669' }}>$49,880.00 MXN</span>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                        Folio Factura 2 <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. 6304"
                        value={dualFolio2}
                        onChange={(e) => setDualFolio2(e.target.value.toUpperCase())}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 10px',
                          fontSize: 14,
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          borderRadius: 8,
                          border: duplicateDual2 || dualFoliosMatch ? '1.5px solid #ef4444' : '1px solid var(--line)',
                          background: 'var(--paper)',
                          color: 'var(--ink)',
                          outline: 'none',
                        }}
                      />
                      {duplicateDual2 && (
                        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, marginTop: 4 }}>
                          🚨 Folio ya usado en OC #{duplicateDual2.orderFolio}
                        </div>
                      )}
                      {dualFoliosMatch && (
                        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800, marginTop: 4 }}>
                          🚨 No puedes usar el mismo folio para ambas facturas.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumen Total */}
                <div
                  style={{
                    background: 'var(--paper-sunk)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>Total Remisión 6439784:</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>2 facturas × 1,000 kg = 2,000 kg</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#2563eb' }}>$99,760.00 MXN</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>IVA 16% incluido ($86,000 subtotal)</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '14px 20px',
                  background: 'var(--paper-sunk)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowDualModal(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                    background: 'var(--paper)',
                    color: 'var(--ink)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateDual}
                  disabled={busy || !dualFolio1.trim() || !dualFolio2.trim() || !!duplicateDual1 || !!duplicateDual2 || dualFoliosMatch}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: (busy || !dualFolio1.trim() || !dualFolio2.trim() || !!duplicateDual1 || !!duplicateDual2 || dualFoliosMatch)
                      ? 'var(--line)'
                      : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 14,
                    cursor: (busy || !dualFolio1.trim() || !dualFolio2.trim() || !!duplicateDual1 || !!duplicateDual2 || dualFoliosMatch)
                      ? 'not-allowed'
                      : 'pointer',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{busy ? '⏳ Emitiendo...' : '💾 Emitir Ambas Facturas'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
