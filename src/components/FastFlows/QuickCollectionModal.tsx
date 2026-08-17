import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { useOrders } from '../../hooks/useOrders';
import { camposInvoices } from '../../lib/invoiceOps';
import { playCashRegisterSound } from '../../lib/soundEffects';
import { Modal } from '../ui';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { money, nombreClienteVisible, toInputDate, fromInputDate, kilos as fmtKilos } from '../../lib/format';
import { extractCr, round2 } from '../../lib/finance';
import { findDuplicateContrarecibo } from '../../lib/duplicateGuards';

interface PendingInvoiceItem {
  orderId: string;
  orderFolio: string;
  client: string;
  department?: string;
  invoice: Invoice;
  total: number;
  kilos: number;
}

function getInvoiceDept(p: PendingInvoiceItem): 'TH' | 'GT' | null {
  if (p.department === 'TH' || p.department === 'GT') return p.department;
  const clientUpper = (p.client || '').toUpperCase();
  if (clientUpper.includes('TH') || clientUpper.includes('- TH')) return 'TH';
  if (clientUpper.includes('GT') || clientUpper.includes('- GT')) return 'GT';
  const folioUpper = (p.invoice.folio || '').toUpperCase();
  if (folioUpper.startsWith('TH')) return 'TH';
  if (folioUpper.startsWith('GT')) return 'GT';
  return null;
}

export function QuickCollectionModal({ orders, onClose }: { orders: PurchaseOrder[]; onClose: () => void }) {
  const toast = useToast();
  const { orders: allOrders } = useOrders();

  // Facturas pendientes (sin CR asignado y vivas)
  const pendingInvoices = useMemo<PendingInvoiceItem[]>(() => {
    const list: PendingInvoiceItem[] = [];
    orders.forEach(o => {
      if (o.isClosedShort || o.client === 'MIGRACION') return;
      if (o.creditCycle?.status === 'collected') return;

      (o.invoices || []).forEach(inv => {
        const cr = extractCr(inv, o);
        const st = inv.creditCycle?.status;
        const totalInv = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const paidAmt = inv.collection?.paidAmount || 0;

        if (cr) return;
        if (st === 'paid' || st === 'collected' || (paidAmt >= totalInv && totalInv > 0)) return;
        if ((inv.kilos || 0) <= 0 && totalInv <= 0) return;

        if (st === 'facturado' || st === 'manual_review' || st === 'pending' || st === 'overdue' || (inv.folio && inv.folio.trim().length > 0)) {
          list.push({
            orderId: o.id,
            orderFolio: o.folio || o.oc || 'S/N',
            client: nombreClienteVisible(o.client) || 'Providencia',
            department: o.department,
            invoice: inv,
            total: totalInv,
            kilos: inv.kilos || 0,
          });
        }
      });
    });
    return list;
  }, [orders]);

  // Selección múltiple de facturas para un mismo contrarecibo
  const [selectedInvIds, setSelectedInvIds] = useState<Set<string>>(() => {
    return new Set(pendingInvoices.length === 1 ? [pendingInvoices[0].invoice.id] : []);
  });

  const [cr, setCr] = useState('');
  
  // Fecha programada de cobro (default: Hoy + 30 días de crédito estándar)
  const [dueDateStr, setDueDateStr] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toInputDate(d) || '';
  });

  const [saving, setSaving] = useState(false);

  // Cálculos consolidados de las facturas seleccionadas
  const selectedItems = useMemo(() => {
    return pendingInvoices.filter(p => selectedInvIds.has(p.invoice.id));
  }, [pendingInvoices, selectedInvIds]);

  // Departamento activo del lote seleccionado (TH o GT)
  const activeSelectedDept = useMemo(() => {
    if (selectedItems.length === 0) return null;
    return getInvoiceDept(selectedItems[0]);
  }, [selectedItems]);

  const toggleSelectInvoice = (item: PendingInvoiceItem) => {
    const itemDept = getInvoiceDept(item);
    if (!selectedInvIds.has(item.invoice.id)) {
      if (activeSelectedDept && itemDept && activeSelectedDept !== itemDept) {
        toast(`⚠️ Separación Departamental Estricta: Las facturas de ${activeSelectedDept} nunca se mezclan con ${itemDept}.`, 'bad');
        return;
      }
    }
    setSelectedInvIds(prev => {
      const next = new Set(prev);
      if (next.has(item.invoice.id)) next.delete(item.invoice.id);
      else next.add(item.invoice.id);
      return next;
    });
  };

  const selectAllInvoices = (select: boolean) => {
    if (select) {
      const targetDept = activeSelectedDept || (pendingInvoices.length > 0 ? getInvoiceDept(pendingInvoices[0]) : null);
      const valid = pendingInvoices.filter(p => !targetDept || getInvoiceDept(p) === targetDept);
      setSelectedInvIds(new Set(valid.map(p => p.invoice.id)));
      if (targetDept) {
        toast(`⚡ Seleccionadas ${valid.length} factura(s) del departamento ${targetDept}.`, 'info');
      }
    } else {
      setSelectedInvIds(new Set());
    }
  };

  const setDueDatePreset = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setDueDateStr(toInputDate(d) || '');
  };

  const totalConsolidadoMonto = useMemo(() => {
    return round2(selectedItems.reduce((acc, it) => acc + it.total, 0));
  }, [selectedItems]);

  const totalConsolidadoKilos = useMemo(() => {
    return round2(selectedItems.reduce((acc, it) => acc + it.kilos, 0));
  }, [selectedItems]);

  // Verificación en tiempo real de contrarecibo duplicado
  const duplicateCr = useMemo(() => {
    if (!cr.trim()) return null;
    const firstSelectedId = Array.from(selectedInvIds)[0] || '';
    return findDuplicateContrarecibo(allOrders.length > 0 ? allOrders : orders, cr.trim(), firstSelectedId);
  }, [cr, allOrders, orders, selectedInvIds]);

  const handleAssignCrToMultiple = async () => {
    if (selectedItems.length === 0) return toast('Selecciona al menos una factura para asignar el contrarecibo', 'bad');
    if (!cr.trim()) return toast('Falta el número de contrarecibo', 'bad');

    if (duplicateCr) {
      return toast(`⚠️ El contrarecibo ${cr.trim()} ya fue usado en la Factura #${duplicateCr.invoiceFolio} (${duplicateCr.orderFolio}). No se permiten duplicados.`, 'bad');
    }

    const cleanCr = cr.trim().toUpperCase();
    if (activeSelectedDept === 'TH' && cleanCr.startsWith('GT-')) {
      return toast('⚠️ Separación Estricta: Las facturas de TH no pueden llevar un contrarecibo con prefijo GT.', 'bad');
    }
    if (activeSelectedDept === 'GT' && cleanCr.startsWith('TH-')) {
      return toast('⚠️ Separación Estricta: Las facturas de GT no pueden llevar un contrarecibo con prefijo TH.', 'bad');
    }

    setSaving(true);
    try {
      const parsedDueDate = fromInputDate(dueDateStr) || new Date(Date.now() + 15 * 86400000);
      const dueTimestamp = Timestamp.fromDate(parsedDueDate);

      // Agrupar facturas por orden de compra
      const ordersMap = new Map<string, { order: PurchaseOrder; invoiceIds: Set<string> }>();
      
      selectedItems.forEach(it => {
        const fullOrder = (allOrders.length > 0 ? allOrders : orders).find(o => o.id === it.orderId);
        if (!fullOrder) return;
        
        if (!ordersMap.has(it.orderId)) {
          ordersMap.set(it.orderId, { order: fullOrder, invoiceIds: new Set() });
        }
        ordersMap.get(it.orderId)!.invoiceIds.add(it.invoice.id);
      });

      // Actualizar cada orden con el mismo CR y fecha de cobro
      for (const [orderId, { order, invoiceIds }] of ordersMap.entries()) {
        const updatedInvoices = (order.invoices || []).map(inv => {
          if (invoiceIds.has(inv.id)) {
            return {
              ...inv,
              collection: {
                ...inv.collection,
                contrareciboNumber: cleanCr,
                contrareciboDate: Timestamp.now(),
              },
              creditCycle: {
                ...inv.creditCycle,
                status: 'pending' as const,
                dueDate: dueTimestamp,
              },
            };
          }
          return inv;
        });

        await updateDoc(doc(db, PATHS.orders, orderId), camposInvoices(updatedInvoices));
      }

      playCashRegisterSound();
      toast(`✅ Contrarecibo ${cleanCr} asignado exitosamente a ${selectedItems.length} factura(s).`, 'ok');
      onClose();
    } catch (e: any) {
      toast(`Error al guardar contrarecibo: ${e.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="🗂️ Asignar Contrarecibo (Individual o Múltiples Facturas)" onClose={onClose} wide>
      <div style={{ padding: '4px 0' }}>
        
        {/* Encabezado descriptivo */}
        <div style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06) 0%, rgba(245,158,11,0.12) 100%)', border: '1px solid rgba(245,158,11,0.25)', padding: '12px 16px', borderRadius: 12, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            <strong>Contrarecibo Multi-Factura (Separación Estricta TH / GT):</strong> Selecciona una o varias facturas de un mismo departamento que vengan amparadas en el mismo contrarecibo de Providencia.
          </div>
        </div>

        {/* 1. SELECCIÓN DE FACTURAS */}
        <div style={{ background: 'var(--paper-raised)', padding: 16, borderRadius: 14, border: '1px solid var(--line)', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 14, color: 'var(--ink)' }}>
                1. Facturas en Revisión ({selectedItems.length} seleccionada{selectedItems.length !== 1 ? 's' : ''})
                {activeSelectedDept && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: activeSelectedDept === 'TH' ? '#0284c7' : '#16a34a',
                    color: '#fff',
                  }}>
                    Lote {activeSelectedDept}
                  </span>
                )}
              </strong>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                Marca las facturas amparadas en este mismo papelito/contrarecibo.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => selectAllInvoices(true)}
              >
                ⚡ Seleccionar Todas
              </button>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => selectAllInvoices(false)}
              >
                Deseleccionar
              </button>
            </div>
          </div>

          {pendingInvoices.length > 0 ? (
            <div className="table-scroll" style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>✓</th>
                    <th>Depto</th>
                    <th>Factura</th>
                    <th>Orden de Compra</th>
                    <th>Cliente</th>
                    <th className="num">Kilos</th>
                    <th className="num">Importe Total con IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvoices.map((p) => {
                    const isSelected = selectedInvIds.has(p.invoice.id);
                    const itemDept = getInvoiceDept(p);
                    const isDeptMismatch = activeSelectedDept !== null && itemDept !== null && activeSelectedDept !== itemDept;

                    return (
                      <tr 
                        key={p.invoice.id}
                        onClick={() => !isDeptMismatch && toggleSelectInvoice(p)}
                        style={{ 
                          cursor: isDeptMismatch ? 'not-allowed' : 'pointer',
                          opacity: isDeptMismatch ? 0.45 : 1,
                          background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                          borderLeft: isSelected ? '3px solid #d97706' : '3px solid transparent',
                        }}
                      >
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            disabled={isDeptMismatch}
                            onChange={() => toggleSelectInvoice(p)}
                            style={{ width: 17, height: 17, cursor: isDeptMismatch ? 'not-allowed' : 'pointer', accentColor: '#d97706' }}
                          />
                        </td>
                        <td>
                          {itemDept === 'TH' ? (
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '2px 6px', borderRadius: 4 }}>
                              TH
                            </span>
                          ) : itemDept === 'GT' ? (
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>
                              GT
                            </span>
                          ) : (
                            <span style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>—</span>
                          )}
                        </td>
                        <td className="mono" style={{ fontWeight: 800, color: isSelected ? '#b45309' : 'inherit' }}>
                          #{p.invoice.folio || p.orderFolio || 'S/F'}
                        </td>
                        <td className="mono" style={{ fontSize: 11.5 }}>
                          {p.orderFolio}
                        </td>
                        <td>{p.client}</td>
                        <td className="num mono">{fmtKilos(p.kilos)}</td>
                        <td className="num mono" style={{ fontWeight: 800, color: '#047857' }}>
                          {money(p.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-soft)', background: 'var(--paper-sunk)', borderRadius: 10 }}>
              ℹ️ No hay facturas emitidas pendientes de contrarecibo en este momento.
            </div>
          )}
        </div>

        {/* 2. DATOS DEL CONTRARECIBO Y FECHA DE COBRO */}
        {selectedItems.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div style={{ background: 'var(--paper-raised)', padding: 18, borderRadius: 14, border: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              
              {/* Folio Contrarecibo */}
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
                  2. Folio / Número de Contrarecibo (CR)
                </label>
                <input 
                  type="text" 
                  value={cr} 
                  onChange={e => setCr(e.target.value.toUpperCase())}
                  className="input boxed mono" 
                  placeholder="Ej. GT-482 o TH-109"
                  style={{ width: '100%', fontSize: 16, fontWeight: 900, padding: '10px 14px', letterSpacing: '0.05em' }}
                  autoFocus
                />
                {duplicateCr && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', borderRadius: 6, fontSize: 11.5, color: '#991b1b', fontWeight: 700 }}>
                    🚨 El contrarecibo "{cr.trim()}" ya fue registrado en la Factura #{duplicateCr.invoiceFolio} ({duplicateCr.orderFolio}).
                  </div>
                )}
              </div>

              {/* Fecha Programada de Cobro con Presets Rápidos */}
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
                  3. Fecha Programada / Límite de Cobro
                </label>
                <input 
                  type="date"
                  value={dueDateStr}
                  onChange={e => setDueDateStr(e.target.value)}
                  className="input boxed mono"
                  style={{ width: '100%', fontSize: 14, fontWeight: 700, padding: '9px 12px' }}
                />

                {/* Presets Realistas Providencia */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className="chip active" 
                    style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer', background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
                    onClick={() => setDueDatePreset(30)}
                  >
                    📅 30 días (Oficial)
                  </button>
                  <button 
                    type="button" 
                    className="chip" 
                    style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer', background: 'rgba(37,99,235,0.08)', color: '#1d4ed8', borderColor: '#3b82f6' }}
                    onClick={() => setDueDatePreset(45)}
                  >
                    ⏳ 45 días (Real Providencia)
                  </button>
                  <button 
                    type="button" 
                    className="chip" 
                    style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
                    onClick={() => setDueDatePreset(60)}
                  >
                    ⏱️ 60 días (Extendido)
                  </button>
                </div>
              </div>

            </div>

            {/* Tarjeta de Resumen Consolidado */}
            <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.12) 100%)', border: '1px solid rgba(16,185,129,0.3)', padding: '14px 18px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  Total amparado en el Contrarecibo ({selectedItems.length} factura{selectedItems.length !== 1 ? 's' : ''}):
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 900, color: '#047857', marginTop: 2 }}>
                  {money(totalConsolidadoMonto)} con IVA <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>({fmtKilos(totalConsolidadoKilos)} kg)</span>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Estado: <strong style={{ color: '#d97706' }}>Pasa a "Por Cobrar"</strong>
              </div>
            </div>

          </motion.div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button 
            className="btn btn-primary" 
            onClick={handleAssignCrToMultiple} 
            disabled={selectedItems.length === 0 || !cr.trim() || saving || !!duplicateCr}
            style={{ 
              fontWeight: 900, 
              padding: '10px 22px', 
              fontSize: 14,
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              borderColor: '#b45309',
              boxShadow: '0 4px 14px rgba(217,119,6,0.35)',
            }}
          >
            {saving ? 'Guardando...' : `🗂️ Asignar CR #${cr || '…'} a ${selectedItems.length} Factura(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
