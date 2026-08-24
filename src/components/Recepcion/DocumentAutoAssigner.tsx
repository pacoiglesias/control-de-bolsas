import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ExtractedDocumentData } from './SmartDocumentDropzone';
import { useOrders } from '../../hooks/useOrders';
import { useToast } from '../../context/ToastContext';
import { db, PATHS } from '../../lib/firebase';
import { doc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { money } from '../../lib/format';
import { computeFinancials } from '../../lib/finance';
import { useConfig } from '../../hooks/useConfig';
import confetti from 'canvas-confetti';
import { PulsingBadge } from '../ui/PulsingBadge';

interface DocumentAutoAssignerProps {
  data: ExtractedDocumentData;
  onClear: () => void;
}

export function DocumentAutoAssigner({ data, onClear }: DocumentAutoAssignerProps) {
  const { orders } = useOrders();
  const { config } = useConfig();
  const toast = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // 1. Buscar coincidencia exacta por folio de OC o Factura
  const exactMatchOrder = useMemo(() => {
    if (data.ocFolio) {
      const match = orders.find(o => 
        (o.folio || '').trim() === data.ocFolio?.trim() ||
        (o.oc || '').trim() === data.ocFolio?.trim()
      );
      if (match) return match;
    }
    if (data.folio) {
      const match = orders.find(o => 
        (o.invoices || []).some(inv => inv.folio?.trim() === data.folio?.trim())
      );
      if (match) return match;
    }
    return null;
  }, [orders, data]);

  // 2. Buscar OCs sugeridas por kilos o importe
  const suggestedOrders = useMemo(() => {
    return orders
      .filter(o => o.creditCycle?.status !== 'collected')
      .map(o => {
        let score = 0;
        const totalKilos = o.totalKilograms || 0;
        const orderAmount = (o.financials?.invoiceTotal || (totalKilos * 43 * 1.16));

        if (data.kilos && Math.abs(totalKilos - data.kilos) < 5) score += 50;
        if (data.total && Math.abs(orderAmount - data.total) < 10) score += 50;
        if (data.department && (o.department === data.department || o.client?.includes(data.department))) score += 20;

        return { order: o, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.order)
      .slice(0, 5);
  }, [orders, data]);

  // Seleccionar orden por defecto si hay coincidencia
  React.useEffect(() => {
    if (exactMatchOrder) {
      setSelectedOrderId(exactMatchOrder.id);
    } else if (suggestedOrders.length > 0) {
      setSelectedOrderId(suggestedOrders[0].id);
    }
  }, [exactMatchOrder, suggestedOrders]);

  const targetOrder = orders.find(o => o.id === selectedOrderId) || exactMatchOrder;

  // Accion 1: Guardar Factura / XML en Expediente
  const handleAssignInvoiceToOrder = async () => {
    if (!targetOrder) return toast('Selecciona una orden de compra destino', 'bad');
    setIsSaving(true);

    try {
      const orderRef = doc(db, PATHS.orders, targetOrder.id);
      const invoices = [...(targetOrder.invoices || [])];

      const invKilos = data.kilos || targetOrder.totalKilograms || 0;
      const fin = computeFinancials(invKilos, config);

      const newInvoice = {
        id: `inv_${Date.now()}`,
        orderId: targetOrder.id,
        folio: data.folio || `FACT-${targetOrder.folio || 'NUEVA'}`,
        kilos: invKilos,
        uuid: data.uuid || undefined,
        creditCycle: {
          status: 'pending' as const,
          issueDate: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.now(),
          dueDate: data.dueDate 
            ? Timestamp.fromDate(new Date(data.dueDate)) 
            : Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        collection: {
          contrareciboNumber: data.contrarecibo || '',
        },
        financials: {
          salePricePerKg: 43.0,
          costPricePerKg: 38.0,
          saleTotal: data.subtotal || fin.saleTotal,
          invoiceTotal: data.total || fin.invoiceTotal,
          commission: fin.commission,
          costTotal: fin.costTotal,
          netCashFlow: fin.netCashFlow,
        },
        items: (data.items || targetOrder.items || []).map((it, idx) => ({
          id: (it as any).id || `item_${idx + 1}`,
          description: it.description,
          quantity: it.quantity,
          unit: (it as any).unit || 'Kilos',
          unitPrice: it.unitPrice || 43.0,
          amount: it.amount || ((it.quantity || 0) * (it.unitPrice || 43.0)),
        })),
      };

      // Si ya existía una factura borrador sin folio, actualizarla
      const emptyIndex = invoices.findIndex(i => !i.folio || i.folio.trim() === '');
      if (emptyIndex >= 0) {
        invoices[emptyIndex] = { ...invoices[emptyIndex], ...newInvoice };
      } else {
        invoices.push(newInvoice);
      }

      await updateDoc(orderRef, {
        invoices,
        'creditCycle.status': 'pending',
      });

      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      toast(`✅ Factura ${data.folio || ''} asignada exitosamente a la OC ${targetOrder.folio}`, 'ok');
      onClear();
    } catch (err: any) {
      toast(`Error al asignar factura: ${err.message}`, 'bad');
    } finally {
      setIsSaving(false);
    }
  };

  // Accion 2: Asignar solo Contrarecibo
  const handleAssignCR = async () => {
    if (!targetOrder) return toast('Selecciona la orden destino', 'bad');
    if (!data.contrarecibo) return toast('No se detectó número de contrarecibo', 'bad');
    setIsSaving(true);

    try {
      const orderRef = doc(db, PATHS.orders, targetOrder.id);
      const invoices = (targetOrder.invoices || []).map((inv, idx) => {
        if (idx === 0 || (data.folio && inv.folio === data.folio)) {
          return {
            ...inv,
            collection: {
              ...inv.collection,
              contrareciboNumber: data.contrarecibo,
            },
          };
        }
        return inv;
      });

      await updateDoc(orderRef, {
        invoices,
        'collection.contrareciboNumber': data.contrarecibo,
      });

      confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 } });
      toast(`✅ Contrarecibo ${data.contrarecibo} asignado a la OC ${targetOrder.folio}`, 'ok');
      onClear();
    } catch (err: any) {
      toast(`Error al asignar contrarecibo: ${err.message}`, 'bad');
    } finally {
      setIsSaving(false);
    }
  };

  // Accion 3: Crear Nueva Orden de Compra desde Cero
  const handleCreateNewOrder = async () => {
    if (!data.ocFolio && !data.folio) return toast('Se requiere al menos un número de folio u OC', 'bad');
    setIsSaving(true);

    try {
      const orderId = `ord_${Date.now()}`;
      const orderRef = doc(db, PATHS.orders, orderId);

      const totalKilos = data.kilos || 1500;
      const fin = computeFinancials(totalKilos, config);
      const folio = data.ocFolio || `OC-${data.folio || Date.now()}`;
      const dept = data.department || (data.client?.toUpperCase().includes('GT') ? 'GT' : 'TH');

      const isTH = dept === 'TH' || (data.client || '').toUpperCase().includes('NAVA') || (data.client || '').toUpperCase().includes('TH');
      const clientName = isTH 
        ? 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)' 
        : 'GRUPO TEXTIL PROVIDENCIA (P4 - Evelia)';
      const buyerName = isTH ? 'JOSÉ NAVA FLORES' : 'EVELIA';
      const approverName = isTH ? 'JOSÉ ANTONIO TORRE LAMUÑO' : undefined;

      const newOrder = {
        id: orderId,
        folio,
        oc: folio,
        client: clientName,
        department: isTH ? 'TH-ALMACEN-1' : 'P4-ALM',
        buyer: buyerName,
        approver: approverName,
        totalKilograms: totalKilos,
        productDescription: data.items?.[0]?.description || 'Bolsa de Polietileno Transparente en Rollo',
        status: 'pedido',
        creditCycle: {
          status: data.folio ? 'pending' : 'pedido',
          issueDate: Timestamp.now(),
          dueDate: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        financials: {
          salePricePerKg: 43.0,
          costPricePerKg: 38.0,
          saleTotal: data.subtotal || fin.saleTotal,
          invoiceTotal: data.total || fin.invoiceTotal,
          commission: fin.commission,
          costTotal: fin.costTotal,
          netCashFlow: fin.netCashFlow,
        },
        items: data.items || [
          {
            description: 'Bolsa de Polietileno Transparente en Rollo',
            quantity: totalKilos,
            unitPrice: 43.0,
            amount: totalKilos * 43.0,
          }
        ],
        deliveries: [],
        invoices: data.folio ? [
          {
            id: `inv_${Date.now()}`,
            folio: data.folio,
            kilos: totalKilos,
            uuid: data.uuid || null,
            creditCycle: {
              status: 'pending',
              issueDate: Timestamp.now(),
              dueDate: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            collection: {
              contrareciboNumber: data.contrarecibo || '',
            },
            financials: {
              saleTotal: data.subtotal || fin.saleTotal,
              invoiceTotal: data.total || fin.invoiceTotal,
            },
          }
        ] : [],
        createdAt: Timestamp.now(),
      };

      await setDoc(orderRef, newOrder);

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      toast(`🎉 Expediente creado con éxito para la OC ${folio} (${totalKilos} kg)`, 'ok');
      onClear();
    } catch (err: any) {
      toast(`Error al crear nueva orden: ${err.message}`, 'bad');
    } finally {
      setIsSaving(false);
    }
  };

  // Accion 4: Asignar Complemento de Pago (REP) a la Factura
  const handleAssignPaymentComplement = async () => {
    if (!targetOrder) return toast('Selecciona la orden destino', 'bad');
    setIsSaving(true);

    try {
      const orderRef = doc(db, PATHS.orders, targetOrder.id);
      let matched = false;
      const invoices = (targetOrder.invoices || []).map((inv) => {
        if (
          (data.folio && inv.folio?.trim() === data.folio?.trim()) ||
          (data.uuid && inv.collection?.sapDocument?.trim() === data.uuid?.trim()) ||
          (data.uuid && inv.folio?.trim() === data.uuid?.trim()) ||
          (!data.folio && !matched)
        ) {
          matched = true;
          return {
            ...inv,
            creditCycle: {
              ...inv.creditCycle,
              status: 'paid' as const,
            },
            collection: {
              ...inv.collection,
              paidAmount: data.total || inv.financials?.invoiceTotal || inv.kilos * 43 * 1.16,
              paidAt: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.now(),
              complementStatus: 'issued' as const,
              paymentDocument: data.complementoFolio ? `CP-${data.complementoFolio}` : (data.complementoUuid || 'CP-SAT'),
              notes: `${inv.collection?.notes ? inv.collection.notes + ' · ' : ''}Complemento de Pago SAT #${data.complementoFolio || 'S/N'} (${money(data.total || 0)})`
            }
          };
        }
        return inv;
      });

      await updateDoc(orderRef, {
        invoices,
        'creditCycle.status': 'paid',
      });

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      toast(`💰 Complemento de Pago asignado a la Factura #${data.folio || ''} en OC ${targetOrder.folio} (Cobrado: ${money(data.total || 0)})`, 'ok');
      onClear();
    } catch (err: any) {
      toast(`Error al aplicar complemento de pago: ${err.message}`, 'bad');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        borderRadius: 20,
        padding: '24px',
        marginTop: 20,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header del Análisis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>
              {data.type === 'complemento_pago' ? '💳' : data.type === 'xml_factura' ? '🧾' : data.type === 'contrarecibo' ? '🏷️' : '📋'}
            </span>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>
                {data.type === 'complemento_pago' ? 'Complemento de Pago SAT Detectado' : 'Datos Analizados con Éxito'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {data.fileName || 'Contenido pegado del portapapeles'} · Confianza: {Math.round(data.confidence * 100)}%
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClear}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#cbd5e1',
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          ✕ Cancelar
        </button>
      </div>

      {/* Grid de Resumen de Datos Extraídos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
            {data.type === 'complemento_pago' ? 'Factura Pagada' : 'Folio / OC'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#60a5fa', marginTop: 3 }}>
            {data.folio ? `#${data.folio}` : (data.ocFolio || 'Sin Folio')}
          </div>
        </div>

        {data.complementoFolio && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Folio Complemento</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#a78bfa', marginTop: 3 }}>
              CP #{data.complementoFolio}
            </div>
          </div>
        )}

        {data.contrarecibo && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Contrarecibo</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#34d399', marginTop: 3 }}>
              {data.contrarecibo}
            </div>
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
            {data.type === 'complemento_pago' ? 'Monto Cobrado' : 'Importe Total'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#10b981', marginTop: 3 }}>
            {data.total ? money(data.total) : 'Calculado auto'}
          </div>
        </div>

        {data.date && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
              {data.type === 'complemento_pago' ? 'Fecha de Pago' : 'Fecha Emisión'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', marginTop: 3 }}>
              📅 {data.date}
            </div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN DE GUÍA PROACTIVA Y ACCIONES ────────────────────────────── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💡</span> ¿A dónde deseas enviar esta información?
        </div>

        {/* Coincidencia Exacta Detectada */}
        {exactMatchOrder ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 14, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#34d399' }}>
                  🎯 Coincidencia 100% Exacta: OC {exactMatchOrder.folio}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                  {exactMatchOrder.items?.[0]?.description || (exactMatchOrder as any).productDescription || 'Producto'} · {exactMatchOrder.totalKilograms?.toLocaleString('es-MX')} kg pedidos
                </div>
              </div>
              <PulsingBadge label="Coincidencia Exacta" tone="green" />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
              Selecciona el Expediente de la OC Destino:
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 12,
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="">-- Seleccionar Orden de Compra Existente --</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  OC {o.folio || 'S/F'} · {(o.items?.[0]?.description || (o as any).productDescription || 'Bolsas').slice(0, 30)} ({o.totalKilograms || 0} kg)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Botones de Acción Proactiva de 1 Clic */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          {/* Boton Especial: Complemento de Pago */}
          {data.type === 'complemento_pago' ? (
            <button
              onClick={handleAssignPaymentComplement}
              disabled={isSaving || !targetOrder}
              style={{
                flex: 1,
                minWidth: 220,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                border: 'none',
                color: '#fff',
                padding: '14px 20px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: 14,
                cursor: targetOrder ? 'pointer' : 'not-allowed',
                opacity: targetOrder ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
              }}
            >
              <span>💰</span> Registrar Pago {data.total ? money(data.total) : ''} en Factura #{data.folio || ''}
            </button>
          ) : (
            /* Boton 1: Asignar Factura / XML */
            <button
              onClick={handleAssignInvoiceToOrder}
              disabled={isSaving || !targetOrder}
              style={{
                flex: 1,
                minWidth: 200,
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                border: 'none',
                color: '#fff',
                padding: '12px 18px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
                cursor: targetOrder ? 'pointer' : 'not-allowed',
                opacity: targetOrder ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
              }}
            >
              <span>🧾</span> Asignar Factura a OC {targetOrder?.folio || ''}
            </button>
          )}

          {/* Boton 2: Asignar solo Contrarecibo si aplica */}
          {data.contrarecibo && (
            <button
              onClick={handleAssignCR}
              disabled={isSaving || !targetOrder}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                border: 'none',
                color: '#fff',
                padding: '12px 18px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
                cursor: targetOrder ? 'pointer' : 'not-allowed',
                opacity: targetOrder ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🏷️</span> Asignar Contrarecibo {data.contrarecibo}
            </button>
          )}

          {/* Boton 3: Crear Nuevo Expediente si no existe */}
          {!exactMatchOrder && (
            <button
              onClick={handleCreateNewOrder}
              disabled={isSaving}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#e2e8f0',
                padding: '12px 18px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>✨</span> Crear como Nueva OC {data.ocFolio || data.folio || ''}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
