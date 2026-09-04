import { useState, useMemo } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { logAction } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { toInputDate, fromInputDate } from '../lib/format';
import { inferDepartment } from '../lib/finance';
import { useOrders } from '../hooks/useOrders';
import { findDuplicateContrarecibo } from '../lib/duplicateGuards';
import type { PurchaseOrder, Invoice } from '../lib/types';
import { motion } from 'framer-motion';

interface QuickCrModalProps {
  order: PurchaseOrder;
  invoice?: Invoice | null;
  onClose: () => void;
}

export function QuickCrModal({ order, invoice, onClose }: QuickCrModalProps) {
  const { user } = useAuth();
  const { orders } = useOrders();
  const toast = useToast();
  
  // Detección de departamento / planta oficial
  const dept = useMemo(() => {
    return inferDepartment(order) || (order.department?.toUpperCase().includes('TH') ? 'TH' : order.department?.toUpperCase().includes('GT') ? 'GT' : 'TH');
  }, [order]);

  const defaultPrefix = dept === 'TH' ? 'TH-' : 'GT-';
  const initialCr = (invoice?.collection?.contrareciboNumber || order.collection?.contrareciboNumber || '').trim();

  const [crNumber, setCrNumber] = useState(() => {
    if (initialCr) return initialCr;
    return defaultPrefix;
  });
  
  // Fecha base para cálculos: fecha de emisión de la factura o hoy
  const baseDate = useMemo(() => {
    const rawIssue = invoice?.creditCycle?.issueDate || order.creditCycle?.issueDate;
    if (rawIssue) {
      if (typeof (rawIssue as any).toDate === 'function') return (rawIssue as any).toDate();
      return new Date(rawIssue as any);
    }
    return new Date();
  }, [invoice, order]);

  // Fecha sugerida: 30 días a partir de la emisión o dueDate actual
  const [dueDate, setDueDate] = useState(() => {
    const rawDue = invoice?.creditCycle?.dueDate || order.creditCycle?.dueDate;
    if (rawDue) {
      return toInputDate(rawDue);
    }
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 30);
    return toInputDate(d);
  });

  const [applyToAll, setApplyToAll] = useState(true);
  const [busy, setBusy] = useState(false);

  // Detector de Contrarecibo duplicado en tiempo real
  const duplicateMatch = useMemo(() => {
    const clean = crNumber.trim();
    if (!clean || clean === 'TH-' || clean === 'GT-') return null;
    return findDuplicateContrarecibo(orders, clean, invoice?.id, order.id);
  }, [orders, crNumber, invoice, order]);

  // Helper para asignar días relativos
  const setDaysFromBase = (days: number) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    setDueDate(toInputDate(d));
    toast(`📅 Vencimiento establecido a +${days} días`, 'ok');
  };

  // Helper para alternar prefijo
  const setPrefix = (pref: string) => {
    const digitsOnly = crNumber.replace(/^[A-Z]+-?/i, '').trim();
    setCrNumber(`${pref}${digitsOnly}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanCr = crNumber.trim().toUpperCase();
    if (/^\d+$/.test(cleanCr) && dept) {
      cleanCr = `${dept}-${cleanCr}`;
    }

    if (!cleanCr || cleanCr === 'TH-' || cleanCr === 'GT-') {
      return toast('Ingresa el número de Contrarecibo (ej. TH-946 o GT-597)', 'bad');
    }

    if (duplicateMatch) {
      return toast(`🚨 El contrarecibo "${cleanCr}" ya fue usado en la Factura #${duplicateMatch.invoiceFolio} (OC #${duplicateMatch.orderFolio}). No se permiten duplicados.`, 'bad');
    }

    // Regla de Separación Estricta
    if (dept === 'TH' && cleanCr.startsWith('GT-')) {
      return toast('⚠️ Separación Estricta: Las facturas de Textil Hogar (TH) deben usar prefijo TH-.', 'bad');
    }
    if (dept === 'GT' && cleanCr.startsWith('TH-')) {
      return toast('⚠️ Separación Estricta: Las facturas de Grupo Textil (GT) deben usar prefijo GT-.', 'bad');
    }

    setBusy(true);
    try {
      const orderRef = doc(db, PATHS.orders, order.id);
      const rawDate = dueDate ? fromInputDate(dueDate) : null;
      const parsedDueDate = rawDate ? Timestamp.fromDate(rawDate) : null;

      // Actualizar en el expediente raíz y en las facturas
      const updatedInvoices = (order.invoices || []).map((inv) => {
        const isTarget = invoice ? (inv.id === invoice.id || applyToAll) : (!inv.collection?.contrareciboNumber || applyToAll);
        if (isTarget) {
          return {
            ...inv,
            collection: {
              ...inv.collection,
              contrareciboNumber: cleanCr,
              contrareciboDate: Timestamp.now(),
            },
            creditCycle: {
              ...inv.creditCycle,
              status: inv.creditCycle?.status === 'pedido' || inv.creditCycle?.status === 'facturado' ? 'pending' : inv.creditCycle?.status || 'pending',
              dueDate: parsedDueDate || inv.creditCycle?.dueDate,
            }
          };
        }
        return inv;
      });

      await updateDoc(orderRef, {
        'collection.contrareciboNumber': cleanCr,
        'collection.contrareciboDate': Timestamp.now(),
        'creditCycle.status': order.creditCycle?.status === 'pedido' || order.creditCycle?.status === 'facturado' ? 'pending' : order.creditCycle?.status || 'pending',
        ...(parsedDueDate ? { 'creditCycle.dueDate': parsedDueDate } : {}),
        invoices: updatedInvoices,
        updatedAt: Timestamp.now(),
      });

      logAction(user?.email, 'UPDATE_ORDER', {
        details: `Asignado CR ${cleanCr} a OC ${order.folio || order.oc}`,
        orderId: order.id,
      });

      toast(`✅ Contrarecibo ${cleanCr} y fecha asignados correctamente`, 'ok');
      onClose();
    } catch (err: any) {
      toast('Error al guardar Contrarecibo: ' + err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.2))',
          color: 'var(--ink)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`badge ${dept === 'TH' ? 'badge-th' : 'badge-gt'}`} style={{ padding: '2px 8px', fontSize: 11, fontWeight: 800, background: dept === 'TH' ? '#3b82f6' : '#8b5cf6', color: '#fff' }}>
                {dept === 'TH' ? '🟦 Textil Hogar (Nava)' : '🟪 Grupo Textil (Evelia)'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)' }}>
                {invoice ? `Factura #${invoice.folio}` : 'Asignar CR'}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>
              OC: {order.oc || order.folio || 'S/F'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              {order.client || 'Grupo Textil Providencia'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: 'var(--ink-soft)',
              minWidth: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              transition: 'background 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800 }}>
                Número de Contrarecibo (CR):
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn-small"
                  style={{
                    fontSize: 11.5,
                    padding: '4px 10px',
                    minHeight: 32,
                    fontWeight: 800,
                    borderRadius: 6,
                    border: '1px solid ' + (crNumber.startsWith('TH-') ? '#2563eb' : 'var(--line)'),
                    background: crNumber.startsWith('TH-') ? '#2563eb' : 'var(--paper-sunk)',
                    color: crNumber.startsWith('TH-') ? '#fff' : 'var(--ink)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setPrefix('TH-')}
                >
                  🟦 TH-
                </button>
                <button
                  type="button"
                  className="btn-small"
                  style={{
                    fontSize: 11.5,
                    padding: '4px 10px',
                    minHeight: 32,
                    fontWeight: 800,
                    borderRadius: 6,
                    border: '1px solid ' + (crNumber.startsWith('GT-') ? '#7c3aed' : 'var(--line)'),
                    background: crNumber.startsWith('GT-') ? '#7c3aed' : 'var(--paper-sunk)',
                    color: crNumber.startsWith('GT-') ? '#fff' : 'var(--ink)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setPrefix('GT-')}
                >
                  🟪 GT-
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Ej. TH-946 o GT-597"
              value={crNumber}
              onChange={(e) => setCrNumber(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                minHeight: 46,
                boxSizing: 'border-box',
                padding: '10px 14px',
                fontSize: 18,
                fontWeight: 900,
                borderRadius: 10,
                border: duplicateMatch ? '2px solid #ef4444' : '2px solid var(--accent)',
                background: 'var(--paper-sunk)',
                color: 'var(--ink)',
                outline: 'none',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
                boxShadow: duplicateMatch ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : '0 0 0 3px var(--accent-tint)',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              autoFocus
            />

            {duplicateMatch && (
              <div style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span>🚨</span>
                <span>
                  El contrarecibo <strong>"{duplicateMatch.matchedValue}"</strong> ya fue usado en la Factura #{duplicateMatch.invoiceFolio || 'S/F'} (OC #{duplicateMatch.orderFolio}).
                </span>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 800 }}>
                Fecha Promesa de Pago:
              </label>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                Base emisión: {baseDate.toLocaleDateString('es-MX')}
              </span>
            </div>

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{
                width: '100%',
                minHeight: 44,
                boxSizing: 'border-box',
                padding: '10px 14px',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--paper-sunk)',
                color: 'var(--ink)',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
            />

            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-small"
                style={{ fontSize: 11.5, minHeight: 34, padding: '6px 12px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 800, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setDaysFromBase(30)}
              >
                ⚡ +30 Días (Providencia)
              </button>
              <button
                type="button"
                className="btn-small"
                style={{ fontSize: 11.5, minHeight: 34, padding: '6px 12px', background: 'var(--paper-sunk)', color: 'var(--ink-soft)', border: '1px solid var(--line)', fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setDaysFromBase(15)}
              >
                +15 Días
              </button>
              <button
                type="button"
                className="btn-small"
                style={{ fontSize: 11.5, minHeight: 34, padding: '6px 12px', background: 'var(--paper-sunk)', color: 'var(--ink-soft)', border: '1px solid var(--line)', fontWeight: 700, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => setDaysFromBase(45)}
              >
                +45 Días
              </button>
            </div>
          </div>

          {order.invoices && order.invoices.length > 1 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', background: 'var(--paper-sunk)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)' }}>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              Aplicar este contrarecibo a todas las facturas de esta OC ({order.invoices.length} facturas)
            </label>
          )}

          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>ℹ️</span>
            <span>Los días de ingreso y sellado de Contrarecibos en Providencia son <strong>Martes y Jueves</strong> (Ventanilla de Cuentas por Pagar).</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                minHeight: 44,
                padding: '11px 16px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--paper-sunk)',
                color: 'var(--ink)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !!duplicateMatch}
              style={{
                flex: 2,
                minHeight: 44,
                padding: '11px 16px',
                borderRadius: 10,
                border: 'none',
                background: duplicateMatch ? 'var(--line)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: duplicateMatch ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: duplicateMatch ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              {busy ? 'Guardando...' : '💾 Guardar y Asignar CR'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
