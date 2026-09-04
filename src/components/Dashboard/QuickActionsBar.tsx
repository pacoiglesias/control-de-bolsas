import { motion } from 'framer-motion';
import { money } from '../../lib/format';

export interface QuickActionsBarProps {
  onNewOrder: () => void;
  onQuickDelivery: () => void;
  onQuickInvoice: () => void;
  onQuickCollection: () => void;
  onQuickPay: () => void;
  onOpenMagicPaste?: () => void;
  onOpenContrarecibos?: () => void;
  onOpenSeguimiento?: () => void;
  onOpenCorteMensual?: () => void;
  onOpenCorteSemanal?: () => void;
  onOpenBalanza?: () => void;
  role: string | null;

  // Métricas en vivo para insignias inteligentes
  activeOrdersCount?: number;
  pendingDeliveryKg?: number;
  deliveredPendingInvoiceKg?: number;
  invoicesWithoutCrCount?: number;
  saldoAndres?: number;
  saldoCaja?: number;
}

export function QuickActionsBar({
  onNewOrder,
  onQuickDelivery,
  onQuickInvoice,
  onQuickCollection,
  onQuickPay,
  onOpenMagicPaste,
  onOpenContrarecibos,
  onOpenSeguimiento,
  onOpenCorteMensual,
  onOpenCorteSemanal,
  onOpenBalanza,
  role,
  activeOrdersCount = 0,
  pendingDeliveryKg = 0,
  deliveredPendingInvoiceKg = 0,
  invoicesWithoutCrCount = 0,
  saldoAndres = 0,
  saldoCaja = 0,
}: QuickActionsBarProps) {
  const isViewer = role === 'viewer';

  const steps = [
    {
      id: 'oc',
      stepNum: '1',
      title: 'Capturar OC',
      subtitle: 'Nueva Orden Providencia',
      icon: '📥',
      color: '#d97706',
      bgGradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(245, 158, 11, 0.05) 100%)',
      borderColor: 'rgba(217, 119, 6, 0.35)',
      badgeText: activeOrdersCount > 0 ? `${activeOrdersCount} activas` : undefined,
      badgeColor: '#d97706',
      badgeBg: 'rgba(217, 119, 6, 0.15)',
      onClick: onNewOrder,
      hint: 'Dar de alta pedido o importar',
    },
    {
      id: 'entregas',
      stepNum: '2',
      title: 'Capturar Entregas',
      subtitle: 'Pesada de Báscula / Chofer',
      icon: '⚖️',
      color: '#2563eb',
      bgGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(59, 130, 246, 0.05) 100%)',
      borderColor: 'rgba(37, 99, 235, 0.35)',
      badgeText: pendingDeliveryKg > 0 ? `${pendingDeliveryKg.toLocaleString('es-MX')} kg por surtir` : 'Al día',
      badgeColor: pendingDeliveryKg > 0 ? '#2563eb' : '#16a34a',
      badgeBg: pendingDeliveryKg > 0 ? 'rgba(37, 99, 235, 0.15)' : 'rgba(22, 163, 74, 0.15)',
      onClick: onQuickDelivery,
      hint: 'Registrar viaje con chofer y remisión',
    },
    {
      id: 'facturas',
      stepNum: '3',
      title: 'Hacer Facturas',
      subtitle: 'Emitir CFDI 4.0 Providencia',
      icon: '🧾',
      color: '#059669',
      bgGradient: 'linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(16, 185, 129, 0.05) 100%)',
      borderColor: 'rgba(5, 150, 105, 0.35)',
      badgeText: deliveredPendingInvoiceKg > 0 ? `⚡ ${deliveredPendingInvoiceKg.toLocaleString('es-MX')} kg listos` : 'Facturado',
      badgeColor: deliveredPendingInvoiceKg > 0 ? '#059669' : '#64748b',
      badgeBg: deliveredPendingInvoiceKg > 0 ? 'rgba(5, 150, 105, 0.18)' : 'rgba(100, 116, 139, 0.12)',
      onClick: onQuickInvoice,
      hint: 'Facturar entregas o prefacturar',
    },
    {
      id: 'contrarecibos',
      stepNum: '4',
      title: 'Capturar Contrarecibos',
      subtitle: 'Asignar Folio TH / GT',
      icon: '🗂️',
      color: '#7c3aed',
      bgGradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(139, 92, 246, 0.05) 100%)',
      borderColor: 'rgba(124, 58, 237, 0.35)',
      badgeText: invoicesWithoutCrCount > 0 ? `🚨 ${invoicesWithoutCrCount} por asignar` : 'Al día',
      badgeColor: invoicesWithoutCrCount > 0 ? '#dc2626' : '#7c3aed',
      badgeBg: invoicesWithoutCrCount > 0 ? 'rgba(220, 38, 38, 0.15)' : 'rgba(124, 58, 237, 0.15)',
      onClick: onQuickCollection,
      hint: 'Vincular CR oficial y fecha de cobro',
    },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      {/* ─── ENCABEZADO DEL WORKFLOW HUB ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink)' }}>
            Centro de Flujo Operativo Rápido (1-Tap Hub)
          </span>
          <span className="badge" style={{ fontSize: 10, fontWeight: 800, background: 'var(--paper-sunk)', color: 'var(--ink-soft)' }}>
            Flujo 1 al 4
          </span>
        </div>

        {/* Acciones Secundarias Directas */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {onOpenMagicPaste && !isViewer && (
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenMagicPaste}
              className="btn"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.18) 100%)',
                color: '#047857',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
              title="Pegar mensaje de WhatsApp para auto-capturar OC o entregas"
            >
              <span>🪄</span> Pegar WhatsApp
            </motion.button>
          )}

          {!isViewer && (
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onQuickPay}
              className="btn"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: 10,
                background: 'var(--paper-raised)',
                color: '#0d9488',
                border: '1px solid #14b8a6',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
              title={`Pagar a Andrés / Abono Maquila (Saldo: ${money(saldoAndres)})`}
            >
              <span>💸</span> Pagar Andrés <span className="mono" style={{ fontSize: 11, opacity: 0.85 }}>({money(saldoAndres)})</span>
            </motion.button>
          )}

          {saldoCaja !== 0 && (
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700, marginLeft: 4 }}>
              Caja: <strong className="mono" style={{ color: saldoCaja >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{money(saldoCaja)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* ─── GRID DE LOS 4 PASOS PRINCIPALES DE OPERACIÓN ───────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {steps.map((s) => (
          <motion.div
            key={s.id}
            whileHover={{ y: -3, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={s.onClick}
            style={{
              background: 'var(--paper-raised)',
              backgroundImage: s.bgGradient,
              border: `1.5px solid ${s.borderColor}`,
              borderRadius: 16,
              padding: '14px 16px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            }}
          >
            {/* Cabecera del paso */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: s.badgeBg,
                    color: s.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    boxShadow: `0 2px 8px ${s.badgeBg}`,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        background: s.color,
                        color: '#fff',
                        fontSize: 9.5,
                        fontWeight: 900,
                        padding: '1px 6px',
                        borderRadius: 6,
                        letterSpacing: '0.04em',
                      }}
                    >
                      PASO {s.stepNum}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 900, color: 'var(--ink)' }}>
                      {s.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, marginTop: 2 }}>
                    {s.subtitle}
                  </div>
                </div>
              </div>
            </div>

            {/* Pie con badge de estado y acción */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              {s.badgeText ? (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: s.badgeColor,
                    background: s.badgeBg,
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: `1px solid ${s.borderColor}`,
                  }}
                >
                  {s.badgeText}
                </span>
              ) : (
                <span style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>1-Tap</span>
              )}

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: s.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                Abrir ➔
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── FILA DE ACCESOS RÁPIDOS DE CONTROL & REPORTES ──────────────── */}
      {(onOpenCorteMensual || onOpenCorteSemanal || onOpenBalanza || onOpenContrarecibos || onOpenSeguimiento) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Acceso Rápido:
          </span>
          {onOpenContrarecibos && (
            <button type="button" className="btn" onClick={onOpenContrarecibos} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8 }}>
              📆 Vencimientos (CR)
            </button>
          )}
          {onOpenSeguimiento && (
            <button type="button" className="btn" onClick={onOpenSeguimiento} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8 }}>
              📦 Seguimiento Pedidos
            </button>
          )}
          {onOpenCorteMensual && (
            <button type="button" className="btn" onClick={onOpenCorteMensual} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8 }}>
              📑 Corte Mensual
            </button>
          )}
          {onOpenCorteSemanal && (
            <button type="button" className="btn" onClick={onOpenCorteSemanal} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8 }}>
              📅 Corte Semanal
            </button>
          )}
          {onOpenBalanza && (
            <button type="button" className="btn" onClick={onOpenBalanza} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8 }}>
              ⚖️ Balanza
            </button>
          )}
        </div>
      )}
    </div>
  );
}
