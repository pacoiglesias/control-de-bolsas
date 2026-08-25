import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, Timestamp, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui';
import type { PurchaseOrder, Delivery } from '../../lib/types';
import { nombreClienteVisible } from '../../lib/format';
import { round2, getOrderSummary } from '../../lib/finance';
import { triggerHaptic } from '../../lib/hapticEngine';
import { sound } from '../../lib/sounds';
import { printSingleDeliveryRemision } from '../OrderModal/orderModalPrint';

interface QuickDeliveryModalProps {
  orders: PurchaseOrder[];
  initialOrderId?: string | null;
  onClose: () => void;
  onOpenInvoice?: (orderId: string) => void;
}

export function QuickDeliveryModal({ orders, initialOrderId, onClose, onOpenInvoice }: QuickDeliveryModalProps) {
  const toast = useToast();

  // Filtrar órdenes que tienen kilos pendientes por entregar físicamente
  const pendingOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (!o || o.isClosedShort) return false;
        const summary = getOrderSummary(o);
        const total = Number(o.totalKilograms) || 0;
        return summary.kilosDelivered < total - 0.01;
      })
      .map((o) => {
        const summary = getOrderSummary(o);
        const total = Number(o.totalKilograms) || 0;
        const entregados = summary.kilosDelivered;
        const faltante = round2(Math.max(0, total - entregados));
        return {
          order: o,
          total,
          entregados,
          faltante,
        };
      })
      .sort((a, b) => b.faltante - a.faltante);
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrderId && pendingOrders.some((p) => p.order.id === initialOrderId)
      ? initialOrderId
      : pendingOrders[0]?.order.id || ''
  );

  const selectedInfo = pendingOrders.find((p) => p.order.id === selectedOrderId);

  const [kilos, setKilos] = useState<number | ''>(selectedInfo ? selectedInfo.faltante : '');
  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [driver, setDriver] = useState<string>('Andrés');
  const [docType, setDocType] = useState<'remision' | 'factura'>('remision');
  const [docFolio, setDocFolio] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Estado posterior al guardado: Centro de Éxito y Acción Rápida
  const [completedDelivery, setCompletedDelivery] = useState<{
    order: PurchaseOrder;
    kilos: number;
    driver: string;
    dateStr: string;
    docType: 'remision' | 'factura';
    docFolio: string;
    notes: string;
    remainingKg: number;
  } | null>(null);

  const handleSelectOrder = (oId: string) => {
    setSelectedOrderId(oId);
    const info = pendingOrders.find((p) => p.order.id === oId);
    if (info) {
      setKilos(info.faltante);
    }
  };

  const willExceed = selectedInfo && typeof kilos === 'number' && kilos > selectedInfo.faltante;

  const handleSaveDelivery = async () => {
    if (!selectedInfo) {
      toast('Selecciona una orden de compra válida.', 'bad');
      return;
    }
    const k = Number(kilos);
    if (!k || k <= 0) {
      toast('Ingresa una cantidad de kilos válida mayor a 0.', 'bad');
      return;
    }

    if (k > selectedInfo.faltante) {
      toast(
        `⛔ Regla Inviolable: No puedes entregar más de ${selectedInfo.faltante.toLocaleString('es-MX')} kg faltantes. Andrés nunca entrega de más.`,
        'bad'
      );
      return;
    }

    setSaving(true);
    triggerHaptic();

    try {
      const orderRef = doc(db, PATHS.orders, selectedInfo.order.id);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) {
          throw new Error('La orden no existe en la base de datos.');
        }

        const data = snap.data();
        const existingDeliveries: Delivery[] = data.deliveries ?? [];

        const [yyyy, mm, dd] = dateStr.split('-');
        const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);

        const newDelivery: Delivery = {
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          date: Timestamp.fromDate(dateObj),
          kilos: k,
          driver: driver.trim() || 'Andrés',
          docType,
          docFolio: docFolio.trim(),
          invoiced: false,
          notes: notes.trim() || `Entrega directa de ${k.toLocaleString('es-MX')} kg - Almacén Providencia`,
        };

        existingDeliveries.push(newDelivery);
        tx.update(orderRef, {
          deliveries: existingDeliveries,
          updatedAt: Timestamp.now(),
        });
      });

      sound.playChaChing();
      toast(`✅ Entrega de ${k.toLocaleString('es-MX')} kg guardada con éxito.`, 'ok');

      // Pasar a la pantalla de completado y acción rápida
      setCompletedDelivery({
        order: selectedInfo.order,
        kilos: k,
        driver: driver.trim() || 'Andrés',
        dateStr,
        docType,
        docFolio: docFolio.trim(),
        notes: notes.trim(),
        remainingKg: round2(Math.max(0, selectedInfo.faltante - k)),
      });
    } catch (err: any) {
      console.error(err);
      toast(`Error al guardar entrega: ${err.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintRemisionBtn = () => {
    if (!completedDelivery) return;
    triggerHaptic();
    printSingleDeliveryRemision({
      folio: completedDelivery.order.folio,
      oc: completedDelivery.order.oc,
      client: completedDelivery.order.client,
      department: completedDelivery.order.department,
      items: completedDelivery.order.items,
      delivery: {
        date: new Date(completedDelivery.dateStr),
        kilos: completedDelivery.kilos,
        driver: completedDelivery.driver,
        docFolio: completedDelivery.docFolio,
        docType: completedDelivery.docType,
        notes: completedDelivery.notes,
      },
      provName: completedDelivery.driver || 'Andrés',
    });
  };

  const handleWhatsAppShare = () => {
    if (!completedDelivery) return;
    triggerHaptic();
    const ocNum = completedDelivery.order.oc || completedDelivery.order.folio || 'S/N';
    const text = `🚚 *COMPROBANTE DE ENTREGA EN BÁSCULA*\n\n` +
      `📦 *OC / Pedido:* #${ocNum}\n` +
      `🏢 *Cliente:* ${nombreClienteVisible(completedDelivery.order.client)}\n` +
      `⚖️ *Kilos Entregados:* ${completedDelivery.kilos.toLocaleString('es-MX')} kg\n` +
      `📅 *Fecha:* ${completedDelivery.dateStr}\n` +
      `🚛 *Chofer / Entrega:* ${completedDelivery.driver}\n` +
      (completedDelivery.docFolio ? `📋 *Folio Remisión:* ${completedDelivery.docFolio}\n` : '') +
      `⏳ *Faltante Restante:* ${completedDelivery.remainingKg.toLocaleString('es-MX')} kg\n\n` +
      `_Registrado desde Sistema ERP Bolsas Elemental_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <Modal
      title={completedDelivery ? '🎉 Entrega Completada' : '📦 Registrar Entrega de Andrés'}
      onClose={onClose}
      wide={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {completedDelivery ? (
          /* ── PANTALLA DE ÉXITO Y ACCIÓN RÁPIDA (DELIVERY HUB) ── */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
                border: '1.5px solid #10b981',
                borderRadius: 14,
                padding: '16px 18px',
                color: '#ffffff',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.25)',
              }}
            >
              <span style={{ fontSize: 36, display: 'block', marginBottom: 4 }}>🚚</span>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                ¡Entrega de {completedDelivery.kilos.toLocaleString('es-MX')} kg Registrada!
              </div>
              <div style={{ fontSize: 12.5, color: '#d1fae5', marginTop: 4 }}>
                Orden de Compra: <strong>#{completedDelivery.order.oc || completedDelivery.order.folio}</strong> · {nombreClienteVisible(completedDelivery.order.client)}
              </div>
            </div>

            {/* Resumen del Viaje */}
            <div
              style={{
                background: 'var(--paper-sunk)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                fontSize: 12.5,
              }}
            >
              <div>
                <span style={{ color: 'var(--ink-soft)', fontSize: 11, display: 'block' }}>Fecha de Báscula:</span>
                <strong>{completedDelivery.dateStr}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--ink-soft)', fontSize: 11, display: 'block' }}>Chofer / Entrega:</span>
                <strong>{completedDelivery.driver}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--ink-soft)', fontSize: 11, display: 'block' }}>Tipo / Folio:</span>
                <strong>{completedDelivery.docType === 'factura' ? 'Factura' : 'Remisión'} {completedDelivery.docFolio ? `#${completedDelivery.docFolio}` : ''}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--ink-soft)', fontSize: 11, display: 'block' }}>Faltante Restante en OC:</span>
                <strong style={{ color: completedDelivery.remainingKg > 0 ? '#d97706' : '#10b981' }}>
                  {completedDelivery.remainingKg > 0 ? `${completedDelivery.remainingKg.toLocaleString('es-MX')} kg` : '✅ 100% Surtido'}
                </strong>
              </div>
            </div>

            {/* ── BOTÓN ESTRELLA 1: FACTURAR DE INMEDIATO ── */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                onClose();
                onOpenInvoice?.(completedDelivery.order.id);
              }}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '14px 18px',
                fontSize: 14.5,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                width: '100%',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🧾</span>
                <span>EMITIR FACTURA DE ESTA ENTREGA ({completedDelivery.kilos.toLocaleString('es-MX')} kg)</span>
              </span>
              <span style={{ background: 'rgba(255,255,255,0.25)', padding: '3px 8px', borderRadius: 6, fontSize: 12 }}>
                Asistente ➔
              </span>
            </button>

            {/* ── BOTONES SECUNDARIOS: REMISIÓN Y WHATSAPP ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={handlePrintRemisionBtn}
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span>📄</span> Imprimir Remisión
              </button>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                style={{
                  background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span>💬</span> WhatsApp
              </button>
            </div>

            {/* Acciones de Cierre / Continuar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCompletedDelivery(null);
                  setKilos('');
                  setDocFolio('');
                  setNotes('');
                }}
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                ➕ Registrar otra entrega
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
                style={{ fontSize: 13, fontWeight: 800, padding: '8px 18px' }}
              >
                ✓ Terminar
              </button>
            </div>
          </motion.div>
        ) : pendingOrders.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-soft)' }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🎉</span>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              Todas las OCs activas ya fueron entregadas al 100%
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: 13 }}>
              No hay entregas pendientes de registrar por parte de Andrés.
            </p>
          </div>
        ) : (
          <>
            {/* 1. Selector de Orden de Compra */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 6 }}>
                Selecciona la Orden de Compra (OC):
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {pendingOrders.map((p) => {
                  const isSel = p.order.id === selectedOrderId;
                  const pct = Math.min(100, Math.round((p.entregados / p.total) * 100));
                  return (
                    <motion.div
                      key={p.order.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectOrder(p.order.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: isSel ? '2px solid #2563eb' : '1px solid var(--line)',
                        background: isSel ? 'rgba(37,99,235,0.08)' : 'var(--paper-sunk)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'monospace', color: isSel ? '#2563eb' : 'var(--ink)' }}>
                          {p.order.oc || p.order.folio}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {nombreClienteVisible(p.order.client)} · Pedidos: {p.total.toLocaleString('es-MX')} kg
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            color: '#b45309',
                            background: '#fef3c7',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontFamily: 'monospace',
                          }}
                        >
                          Faltan {p.faltante.toLocaleString('es-MX')} kg
                        </span>
                        <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 3 }}>
                          {pct}% entregado
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {selectedInfo && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedInfo.order.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  {/* Tarjeta de Resumen de la OC seleccionada */}
                  <div
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>PEDIDO TOTAL</div>
                      <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: 'var(--ink)' }}>
                        {selectedInfo.total.toLocaleString('es-MX')} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>YA ENTREGADO</div>
                      <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
                        {selectedInfo.entregados.toLocaleString('es-MX')} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>FALTANTE MÁXIMO</div>
                      <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: '#f59e0b' }}>
                        {selectedInfo.faltante.toLocaleString('es-MX')} kg
                      </div>
                    </div>
                  </div>

                  {/* 2. Campo de Kilos de Entrega */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 6 }}>
                      Kilos a Entregar en esta Remisión:
                    </label>
                    <div
                      style={{
                        background: 'var(--paper-sunk)',
                        border: willExceed ? '2px solid var(--bad)' : '2px solid var(--accent)',
                        borderRadius: 12,
                        padding: '8px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={selectedInfo.faltante}
                        value={kilos}
                        onChange={(e) => setKilos(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: 22,
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          color: willExceed ? 'var(--bad)' : 'var(--ink)',
                        }}
                        autoFocus
                      />
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)' }}>kg</span>
                    </div>

                    {/* Atajos de llenado rápido */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setKilos(selectedInfo.faltante)}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #10b981',
                          background: 'rgba(16,185,129,0.1)',
                          color: '#047857',
                          cursor: 'pointer',
                          fontWeight: 800,
                        }}
                      >
                        ⚡ Entregar Todo el Faltante ({selectedInfo.faltante.toLocaleString('es-MX')} kg)
                      </button>
                      {selectedInfo.faltante > 1000 && (
                        <button
                          type="button"
                          onClick={() => setKilos(round2(selectedInfo.faltante / 2))}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid var(--line)',
                            background: 'var(--paper)',
                            color: 'var(--ink)',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          50% ({round2(selectedInfo.faltante / 2).toLocaleString('es-MX')} kg)
                        </button>
                      )}
                    </div>

                    {willExceed && (
                      <div style={{ color: 'var(--bad)', fontSize: 11.5, fontWeight: 800, marginTop: 6 }}>
                        ⚠️ ¡Error! No se pueden entregar más de {selectedInfo.faltante.toLocaleString('es-MX')} kg. La OC no permite excedentes.
                      </div>
                    )}
                  </div>

                  {/* 3. Tipo de Documento y Folio */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Tipo de Documento:
                      </label>
                      <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => setDocType('remision')}
                          style={{
                            flex: 1,
                            padding: '8px 6px',
                            fontSize: 12,
                            fontWeight: 700,
                            border: 'none',
                            background: docType === 'remision' ? '#2563eb' : 'var(--paper-sunk)',
                            color: docType === 'remision' ? '#fff' : 'var(--ink-soft)',
                            cursor: 'pointer',
                          }}
                        >
                          📋 Remisión
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocType('factura')}
                          style={{
                            flex: 1,
                            padding: '8px 6px',
                            fontSize: 12,
                            fontWeight: 700,
                            border: 'none',
                            background: docType === 'factura' ? '#059669' : 'var(--paper-sunk)',
                            color: docType === 'factura' ? '#fff' : 'var(--ink-soft)',
                            cursor: 'pointer',
                          }}
                        >
                          📄 Factura
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        {docType === 'factura' ? 'Folio Factura:' : 'Folio Remisión / Báscula:'}
                      </label>
                      <input
                        type="text"
                        className="input boxed mono"
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13 }}
                        value={docFolio}
                        onChange={(e) => setDocFolio(e.target.value)}
                        placeholder="Ej. REM-4589"
                      />
                    </div>
                  </div>

                  {/* 4. Fecha y Chofer */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Fecha de Entrega:
                      </label>
                      <input
                        type="date"
                        className="input boxed"
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, fontWeight: 700 }}
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Transporte / Chofer:
                      </label>
                      <input
                        type="text"
                        className="input boxed"
                        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13 }}
                        value={driver}
                        onChange={(e) => setDriver(e.target.value)}
                        placeholder="Andrés"
                      />
                    </div>
                  </div>

                  {/* 5. Notas opcionales */}
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Notas de Báscula / Observaciones:
                    </label>
                    <input
                      type="text"
                      className="input boxed"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej. Entregado en tarimas selladas, turno matutino"
                    />
                  </div>

                  {/* 6. Botones de Acción */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                    <button type="button" className="btn" onClick={onClose} disabled={saving}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveDelivery}
                      disabled={saving || !selectedInfo || !kilos || Number(kilos) <= 0 || willExceed}
                      style={{
                        background: willExceed ? 'var(--bad)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        fontWeight: 800,
                        padding: '10px 20px',
                        border: 'none',
                        color: '#fff',
                        borderRadius: 10,
                        cursor: willExceed || saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {saving ? 'Guardando...' : `✅ Guardar Entrega (${kilos || 0} kg)`}
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
