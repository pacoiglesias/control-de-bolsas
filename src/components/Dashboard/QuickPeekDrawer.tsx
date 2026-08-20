import { motion, AnimatePresence } from 'framer-motion';
import { money, fmtDate, kilos as fmtKilos } from '../../lib/format';
import { extractCr, getOrderSummary } from '../../lib/finance';
import { usePrivacy } from '../../context/PrivacyContext';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { playCashSound, playSoftClick, triggerHaptic } from '../../lib/hapticEngine';
import { generateCollectionNotice, openWhatsAppMessage } from '../../lib/whatsappReminder';
import { useToast } from '../../context/ToastContext';
import type { PurchaseOrder, Invoice } from '../../lib/types';

interface QuickPeekDrawerProps {
  order: PurchaseOrder | null;
  onClose: () => void;
  onOpenFullOrder?: (orderId: string) => void;
  onPayCr?: (invoiceId: string) => void;
}

function checkInvoicePaid(inv: Invoice): boolean {
  const st = inv.creditCycle?.status;
  const total = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
  const paid = inv.collection?.paidAmount || 0;
  return st === 'paid' || st === 'collected' || (paid >= total && total > 0);
}

export function QuickPeekDrawer({ order, onClose, onOpenFullOrder, onPayCr }: QuickPeekDrawerProps) {
  const { isPrivate } = usePrivacy();
  const { settings } = useSystemSettings();
  const toast = useToast();

  if (!order) return null;

  const provName = settings?.providerName || 'Andrés';
  const clientName = settings?.clientShortName || 'Providencia';

  const crNumber = (order.collection?.contrareciboNumber ||
    (order.invoices || []).map((inv) => extractCr(inv, order)).find(Boolean) ||
    '').toUpperCase();

  // FIX: kilosEntregados/kilosFacturados se recalculaban aqui a mano igual
  // que en SeguimientoPedidosTable/MoneyFlowPipeline/ActionRadar (mismo bug,
  // mismo arreglo): no sumaban entregas con desglose por items[] ni aplicaban
  // el fallback de getOrderSummary para expedientes sin o.deliveries
  // capturadas, asi que esta tarjeta rapida podia mostrar "Entregados en
  // Báscula" muy por debajo del 100% para pedidos que ya estaban totalmente
  // surtidos y facturados. Se reusa getOrderSummary(order).
  const summary = getOrderSummary(order);
  const totalKilos = Number(order.totalKilograms) ||
    (order.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) ||
    summary.kilosDelivered;

  const kilosEntregados = summary.kilosDelivered;

  const kilosFacturados = summary.kilosInvoiced;

  const pctEntregado = totalKilos > 0 ? Math.min(100, Math.round((kilosEntregados / totalKilos) * 100)) : 0;
  const pctFacturado = totalKilos > 0 ? Math.min(100, Math.round((kilosFacturados / totalKilos) * 100)) : 0;

  const totalImporte = (order.invoices || []).reduce(
    (acc, inv) => acc + (Number(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal) || 0),
    0
  );

  const handleCopyData = () => {
    const text = `📦 Expediente: OC ${order.folio || (order as any).oc || 'S/N'}\n🏢 Cliente: ${order.client || clientName}\n📋 Contrarecibo: ${crNumber || 'Pendiente'}\n⚖️ Kilos: ${fmtKilos(totalKilos)} kg\n💵 Total: ${money(totalImporte)}`;
    navigator.clipboard.writeText(text);
    triggerHaptic('light');
    playSoftClick();
    toast('📋 Datos del expediente copiados al portapapeles', 'ok');
  };

  const handleWhatsApp = () => {
    const notice = generateCollectionNotice({
      folioFactura: order.folio || (order as any).oc || 'S/F',
      contrarecibo: crNumber,
      cliente: order.client || clientName,
      monto: totalImporte,
      managerTH: settings?.managerTH,
      managerGT: settings?.managerGT,
      deptNameTH: settings?.deptNameTH,
      deptNameGT: settings?.deptNameGT,
    });
    openWhatsAppMessage(notice);
    triggerHaptic('light');
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 9990,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 480,
            height: '100%',
            background: 'var(--paper, #1e293b)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Header del Quick-Peek */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--line, #334155)',
              background: 'var(--paper-sunk, #0f172a)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  OC {order.folio || (order as any).oc || 'S/N'}
                </span>
                {crNumber ? (
                  <span
                    style={{
                      background: '#059669',
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    CR {crNumber}
                  </span>
                ) : (
                  <span
                    style={{
                      background: '#f59e0b',
                      color: '#000',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    EN REVISIÓN
                  </span>
                )}
              </div>
              <h3 style={{ margin: '8px 0 2px', fontSize: 18, color: 'var(--ink, #fff)', fontWeight: 800 }}>
                {order.client || clientName}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--ink-soft, #94a3b8)' }}>
                Área / Depto: <strong>{order.department || 'General'}</strong> · Fabricante: <strong>{provName}</strong>
              </span>
            </div>

            <button
              className="btn btn-icon"
              onClick={onClose}
              style={{ padding: '6px 10px', fontSize: 14 }}
              title="Cerrar (ESC)"
            >
              ✕
            </button>
          </div>

          {/* Cuerpo de Métricas Rápidas */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
            {/* Importe y Saldo */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 12,
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase' }}>
                  Total Facturado
                </span>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: 'var(--ink, #fff)',
                    fontFamily: 'monospace',
                    filter: isPrivate ? 'blur(6px)' : 'none',
                    transition: 'filter 0.2s ease',
                  }}
                >
                  {money(totalImporte)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase' }}>
                  Fecha Registro
                </span>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink, #fff)' }}>
                  {fmtDate((order as any).createdAt || (order as any).processedAt || new Date())}
                </div>
              </div>
            </div>

            {/* Progreso de Kilos */}
            <div style={{ background: 'var(--paper-sunk, #0f172a)', padding: 14, borderRadius: 12, border: '1px solid var(--line, #334155)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-soft, #94a3b8)' }}>Kilos Solicitados:</span>
                <strong style={{ fontFamily: 'monospace' }}>{fmtKilos(totalKilos)} kg</strong>
              </div>

              {/* Barra de entregas */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#34d399' }}>Entregados en Báscula ({pctEntregado}%)</span>
                  <span style={{ fontFamily: 'monospace', color: '#34d399' }}>{fmtKilos(kilosEntregados)} kg</span>
                </div>
                <div style={{ height: 6, width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctEntregado}%`, background: '#10b981', borderRadius: 4 }} />
                </div>
              </div>

              {/* Barra de facturación */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#60a5fa' }}>Facturados SAT ({pctFacturado}%)</span>
                  <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{fmtKilos(kilosFacturados)} kg</span>
                </div>
                <div style={{ height: 6, width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctFacturado}%`, background: '#3b82f6', borderRadius: 4 }} />
                </div>
              </div>
            </div>

            {/* Facturas asociadas */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft, #94a3b8)', marginBottom: 8, textTransform: 'uppercase' }}>
                Facturas del Expediente ({(order.invoices || []).length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(order.invoices || []).length > 0 ? (
                  order.invoices?.map((inv, idx) => {
                    const paid = checkInvoicePaid(inv);
                    const invTot = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--paper-sunk, #0f172a)',
                          border: '1px solid var(--line, #334155)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink, #fff)' }}>
                            Factura #{inv.folio || 'S/F'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft, #94a3b8)' }}>
                            {inv.kilos ? `${fmtKilos(inv.kilos)} kg` : ''} · Emisión: {fmtDate(inv.creditCycle?.issueDate || (order as any).processedAt || new Date())}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              filter: isPrivate ? 'blur(6px)' : 'none',
                            }}
                          >
                            {money(invTot)}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: paid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: paid ? '#34d399' : '#fbbf24',
                              border: `1px solid ${paid ? '#059669' : '#d97706'}`,
                            }}
                          >
                            {paid ? 'PAGADA' : 'PENDIENTE'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: 'var(--ink-soft, #94a3b8)', fontSize: 12, fontStyle: 'italic' }}>
                    Sin facturas registradas en este expediente.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botonera de Acciones de Lujo */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--line, #334155)',
              background: 'var(--paper-sunk, #0f172a)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, justifyContent: 'center' }}
                onClick={handleCopyData}
              >
                📋 Copiar Datos
              </button>

              <button
                type="button"
                className="btn"
                style={{ fontSize: 12, justifyContent: 'center', color: '#34d399', borderColor: '#059669' }}
                onClick={handleWhatsApp}
              >
                💬 WhatsApp
              </button>
            </div>

            {onPayCr && (order.invoices || []).some((i) => !checkInvoicePaid(i)) && (
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  borderColor: '#059669',
                  fontWeight: 800,
                  fontSize: 13,
                  justifyContent: 'center',
                }}
                onClick={() => {
                  const unpaidInv = order.invoices?.find((i) => !checkInvoicePaid(i));
                  if (unpaidInv) {
                    playCashSound();
                    triggerHaptic('cash');
                    onPayCr(unpaidInv.id || order.id);
                    onClose();
                  }
                }}
              >
                💵 Marcar Cobrado (1 Toque)
              </button>
            )}

            {onOpenFullOrder && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 13, fontWeight: 700, justifyContent: 'center' }}
                onClick={() => {
                  playSoftClick();
                  triggerHaptic('light');
                  onOpenFullOrder(order.id);
                  onClose();
                }}
              >
                📂 Abrir Expediente Completo
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
