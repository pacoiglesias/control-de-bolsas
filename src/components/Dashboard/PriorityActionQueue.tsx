import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { money, kilos, toDate, fmtDayAndDate } from '../../lib/format';
import { extractCr, computeFinancials } from '../../lib/finance';
import { triggerHaptic } from '../../lib/hapticEngine';
import { sound } from '../../lib/sounds';

export type PriorityCategory = 'all' | 'unbilled_deliveries' | 'invoices_in_review' | 'overdue_invoices' | 'unreconciled_payments';

export interface PriorityItem {
  id: string;
  category: 'unbilled_deliveries' | 'invoices_in_review' | 'overdue_invoices' | 'unreconciled_payments';
  priorityLevel: 'urgente' | 'alta' | 'media';
  title: string;
  badgeLabel: string;
  badgeTone: 'bad' | 'warn' | 'ok' | 'cash';
  orderId: string;
  folioOrOc: string;
  client: string;
  department?: string;
  kilosAmount?: number;
  financialAmount?: number;
  whyAttention: string;
  recommendedAction: string;
  actionButtonText: string;
  targetTab?: 'resumen' | 'entregas' | 'facturas';
  dueDate?: Date | null;
  daysLate?: number;
}

interface PriorityActionQueueProps {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenQuickInvoice?: (orderId?: string | null) => void;
  onOpenQuickCollection?: () => void;
  onOpenQuickDelivery?: (orderId?: string | null) => void;
}

export const PriorityActionQueue: React.FC<PriorityActionQueueProps> = ({
  orders,
  config,
  onOpenQuickInvoice,
  onOpenQuickCollection,
  onOpenQuickDelivery,
}) => {
  const nav = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<PriorityCategory>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Extracción inteligente de todas las acciones priorizadas
  const items = useMemo<PriorityItem[]>(() => {
    const list: PriorityItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const order of orders) {
      if (order.isDeleted || order.isClosedShort) continue;

      const orderFolio = order.folio || order.oc || `#${order.id.slice(0, 6)}`;
      const deliveries = order.deliveries || [];
      const invoices = order.invoices || [];

      // 1. Entregas pendientes de facturar
      const kilosEntregados = deliveries.reduce((s, d) => s + (Number(d.kilos) || 0), 0);
      const kilosFacturados = invoices.reduce((s, i) => s + (Number(i.kilos) || 0), 0);
      const kilosSinFactura = Math.max(0, kilosEntregados - kilosFacturados);

      if (kilosSinFactura > 0.5) {
        const precioKg = order.customSellPrice || config.salePricePerKg || 43;
        const montoSinFactura = kilosSinFactura * precioKg * (1 + (config.ivaRate || 0.16));

        list.push({
          id: `unbilled-${order.id}`,
          category: 'unbilled_deliveries',
          priorityLevel: 'urgente',
          title: `Entrega en Báscula pendiente de timbrar CFDI`,
          badgeLabel: 'Pendiente Facturar',
          badgeTone: 'warn',
          orderId: order.id,
          folioOrOc: orderFolio,
          client: order.client || 'Grupo Textil Providencia',
          department: order.department,
          kilosAmount: kilosSinFactura,
          financialAmount: montoSinFactura,
          whyAttention: `Báscula confirmó recepción física de ${kilos(kilosSinFactura)}. Requiere emitir factura CFDI 4.0 para iniciar plazo de crédito comercial.`,
          recommendedAction: 'Generar prefactura y timbrar factura fiscal amparando las remisiones de báscula.',
          actionButtonText: '🧾 Facturar Entrega',
          targetTab: 'facturas',
        });
      }

      // 2. Facturas sin Contrarecibo (En Revisión)
      for (const inv of invoices) {
        const cr = extractCr(inv, order);
        const isCollected = inv.creditCycle?.status === 'collected' || inv.collection?.collectedAt;
        const isPaid = inv.creditCycle?.status === 'paid' || inv.collection?.paidAt;
        const isRevision = (inv.creditCycle?.status as string) === 'revision' || (!cr && !isCollected && !isPaid);

        if (isRevision && !cr) {
          const fin = computeFinancials(inv.kilos, config);
          const totalInv = inv.financials?.invoiceTotal ?? fin.invoiceTotal;

          list.push({
            id: `review-${inv.id}`,
            category: 'invoices_in_review',
            priorityLevel: 'alta',
            title: `Factura ${inv.folio || 'Sin Folio'} sin Contrarecibo Oficial`,
            badgeLabel: 'En Revisión (Sin CR)',
            badgeTone: 'bad',
            orderId: order.id,
            folioOrOc: orderFolio,
            client: order.client || 'Grupo Textil Providencia',
            department: order.department,
            kilosAmount: inv.kilos,
            financialAmount: totalInv,
            whyAttention: `Factura subida al portal Providencia pero aún sin número de CR radicado por Almacén. No se puede cobrar hasta tener folio de CR.`,
            recommendedAction: 'Verificar estado en apps.mundoprovidencia.com y registrar número de CR asignado.',
            actionButtonText: '📝 Asignar CR',
            targetTab: 'facturas',
          });
        }

        // 3. Facturas Vencidas
        if (inv.creditCycle?.dueDate && !isCollected && !isPaid) {
          const due = toDate(inv.creditCycle.dueDate);
          if (due) {
            const dueMid = new Date(due);
            dueMid.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today.getTime() - dueMid.getTime()) / (1000 * 3600 * 24));

            if (diffDays > 0) {
              const fin = computeFinancials(inv.kilos, config);
              const totalInv = inv.financials?.invoiceTotal ?? fin.invoiceTotal;

              list.push({
                id: `overdue-${inv.id}`,
                category: 'overdue_invoices',
                priorityLevel: 'urgente',
                title: `Factura ${inv.folio || 'S/F'} Vencida (${diffDays} días de retraso)`,
                badgeLabel: `Vencida +${diffDays}d`,
                badgeTone: 'bad',
                orderId: order.id,
                folioOrOc: orderFolio,
                client: order.client || 'Grupo Textil Providencia',
                department: order.department,
                kilosAmount: inv.kilos,
                financialAmount: totalInv,
                whyAttention: `Plazo de crédito venció el ${fmtDayAndDate(due)}. Requiere gestión de cobro inmediata con Tesorería Providencia.`,
                recommendedAction: 'Llamar a Cuentas por Pagar o conciliar depósito bancario.',
                actionButtonText: '💰 Gestionar Cobranza',
                targetTab: 'facturas',
                dueDate: due,
                daysLate: diffDays,
              });
            }
          }
        }

        // 4. Pagos parciales o sin conciliar
        if (isPaid && !isCollected) {
          const fin = computeFinancials(inv.kilos, config);
          const totalInv = inv.financials?.invoiceTotal ?? fin.invoiceTotal;
          const paidAmt = inv.collection?.paidAmount ?? totalInv;

          list.push({
            id: `unreconciled-${inv.id}`,
            category: 'unreconciled_payments',
            priorityLevel: 'media',
            title: `Factura ${inv.folio || 'S/F'} pagada pendiente de ingreso en Caja`,
            badgeLabel: 'Pendiente Conciliar',
            badgeTone: 'cash',
            orderId: order.id,
            folioOrOc: orderFolio,
            client: order.client || 'Grupo Textil Providencia',
            department: order.department,
            financialAmount: paidAmt,
            whyAttention: `Pago confirmado por contador (${money(paidAmt)}) pero aún no reflejado formalmente en el libro de Caja Chica.`,
            recommendedAction: 'Confirmar recepción de fondos y asentar ingreso definitivo en caja.',
            actionButtonText: '💵 Conciliar en Caja',
            targetTab: 'facturas',
          });
        }
      }
    }

    // Ordenar por prioridad: urgente primero, luego alta, luego media
    const peso = { urgente: 3, alta: 2, media: 1 };
    return list.sort((a, b) => (peso[b.priorityLevel] || 0) - (peso[a.priorityLevel] || 0));
  }, [orders, config]);

  // Conteo por categoría
  const counts = useMemo(() => {
    return {
      all: items.length,
      unbilled_deliveries: items.filter((i) => i.category === 'unbilled_deliveries').length,
      invoices_in_review: items.filter((i) => i.category === 'invoices_in_review').length,
      overdue_invoices: items.filter((i) => i.category === 'overdue_invoices').length,
      unreconciled_payments: items.filter((i) => i.category === 'unreconciled_payments').length,
    };
  }, [items]);

  // Filtrado final
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (selectedCategory !== 'all' && it.category !== selectedCategory) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          it.title.toLowerCase().includes(q) ||
          it.folioOrOc.toLowerCase().includes(q) ||
          it.client.toLowerCase().includes(q) ||
          it.whyAttention.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, selectedCategory, searchFilter]);

  const handleAction = (item: PriorityItem) => {
    triggerHaptic('medium');
    sound.playPop();

    if (item.category === 'unbilled_deliveries') {
      if (onOpenQuickInvoice) onOpenQuickInvoice(item.orderId);
      else if (onOpenQuickDelivery) onOpenQuickDelivery(item.orderId);
      else nav(`/ordenes?abrir=${item.orderId}&tab=facturas`);
    } else if (item.category === 'invoices_in_review' || item.category === 'overdue_invoices') {
      if (onOpenQuickCollection) onOpenQuickCollection();
      else nav('/cobranza');
    } else if (item.category === 'unreconciled_payments') {
      nav('/caja-chica');
    } else {
      nav(`/ordenes?abrir=${item.orderId}`);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Lista de Trabajo Priorizada
            </h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 99,
                background: items.length > 0 ? '#ef4444' : '#10b981',
                color: '#ffffff',
              }}
            >
              {items.length} {items.length === 1 ? 'acción urgente' : 'acciones urgentes'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            Atención prioritaria del día: qué requiere acción inmediata, por qué y cómo resolverlo.
          </p>
        </div>

        {/* Buscador de acciones */}
        <input
          type="text"
          placeholder="Filtrar por OC, factura o motivo..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(15, 23, 42, 0.6)',
            color: '#f8fafc',
            fontSize: 13,
            outline: 'none',
            minWidth: 220,
          }}
        />
      </div>

      {/* Pestañas de categorías con conteos táctiles */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 16,
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setSelectedCategory('all'); }}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: selectedCategory === 'all' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selectedCategory === 'all' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            color: selectedCategory === 'all' ? '#60a5fa' : '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>🎯 Todas</span>
          <span style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '1px 6px', borderRadius: 99, fontSize: 11 }}>
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setSelectedCategory('unbilled_deliveries'); }}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: selectedCategory === 'unbilled_deliveries' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selectedCategory === 'unbilled_deliveries' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            color: selectedCategory === 'unbilled_deliveries' ? '#fbbf24' : '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>🚚 Entregas por Facturar</span>
          <span style={{ background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
            {counts.unbilled_deliveries}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setSelectedCategory('invoices_in_review'); }}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: selectedCategory === 'invoices_in_review' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selectedCategory === 'invoices_in_review' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            color: selectedCategory === 'invoices_in_review' ? '#f87171' : '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>⚠️ Facturas Sin CR (Revisión)</span>
          <span style={{ background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
            {counts.invoices_in_review}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setSelectedCategory('overdue_invoices'); }}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: selectedCategory === 'overdue_invoices' ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selectedCategory === 'overdue_invoices' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            color: selectedCategory === 'overdue_invoices' ? '#f472b6' : '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>🚨 Facturas Vencidas</span>
          <span style={{ background: '#ec4899', color: '#fff', padding: '1px 6px', borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
            {counts.overdue_invoices}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setSelectedCategory('unreconciled_payments'); }}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            border: selectedCategory === 'unreconciled_payments' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
            background: selectedCategory === 'unreconciled_payments' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
            color: selectedCategory === 'unreconciled_payments' ? '#34d399' : '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>💵 Pagos por Conciliar</span>
          <span style={{ background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: 99, fontSize: 11, fontWeight: 800 }}>
            {counts.unreconciled_payments}
          </span>
        </button>
      </div>

      {/* Lista de Acciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
            }}
          >
            <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🎉</span>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              ¡Todo al día en esta categoría!
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              No hay acciones pendientes de atención inmediata en este momento.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                {/* Información principal */}
                <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        textTransform: 'uppercase',
                        background:
                          item.badgeTone === 'bad'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : item.badgeTone === 'warn'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)',
                        color:
                          item.badgeTone === 'bad'
                            ? '#f87171'
                            : item.badgeTone === 'warn'
                            ? '#fbbf24'
                            : '#34d399',
                        border: `1px solid ${
                          item.badgeTone === 'bad'
                            ? 'rgba(239, 68, 68, 0.3)'
                            : item.badgeTone === 'warn'
                            ? 'rgba(245, 158, 11, 0.3)'
                            : 'rgba(16, 185, 129, 0.3)'
                        }`,
                      }}
                    >
                      {item.badgeLabel}
                    </span>

                    <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                      {item.title}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      OC: {item.folioOrOc}
                    </span>

                    {item.department && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {item.department}
                      </span>
                    )}
                  </div>

                  {/* Explicación de por qué requiere atención */}
                  <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.4 }}>
                    <strong>¿Por qué?:</strong> {item.whyAttention}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#94a3b8', marginTop: 2, flexWrap: 'wrap' }}>
                    {item.kilosAmount !== undefined && (
                      <span>
                        ⚖️ <strong>Kilos de Báscula:</strong> {kilos(item.kilosAmount)}
                      </span>
                    )}
                    {item.financialAmount !== undefined && (
                      <span>
                        💵 <strong>Importe Total:</strong> {money(item.financialAmount)}
                      </span>
                    )}
                    <span>
                      👉 <strong>Acción sugerida:</strong> {item.recommendedAction}
                    </span>
                  </div>
                </div>

                {/* Acciones directas con botones táctiles grandes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      nav(`/ordenes?abrir=${item.orderId}&tab=${item.targetTab || 'resumen'}`);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#f8fafc',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: 38,
                    }}
                  >
                    📂 Abrir Expediente
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAction(item)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background:
                        item.priorityLevel === 'urgente'
                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                          : item.priorityLevel === 'alta'
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                      minHeight: 38,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {item.actionButtonText}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
