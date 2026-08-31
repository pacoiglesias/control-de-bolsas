import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  actionName: string;
  category: '⚡ Operación & Facturación' | '🔍 Búsqueda & Navegación' | '🛠️ Productividad & Privacidad';
  badge?: string;
  badgeTone?: 'ok' | 'info' | 'warn';
}

const SHORTCUTS: ShortcutItem[] = [
  // ⚡ Operación & Facturación
  {
    keys: ['F'],
    actionName: 'Facturación Rápida & Prefactura Excel',
    description: 'Abre el modal para facturar remisiones pendientes, descargar el .xlsx o pedir timbrado al contador.',
    category: '⚡ Operación & Facturación',
    badge: 'Popular',
    badgeTone: 'ok',
  },
  {
    keys: ['N'],
    actionName: 'Nueva Orden de Compra (OC)',
    description: 'Abre de inmediato el formulario para capturar un nuevo pedido de Providencia.',
    category: '⚡ Operación & Facturación',
  },
  {
    keys: ['C'],
    actionName: 'Cobranza Rápida',
    description: 'Abre el módulo express para registrar pagos, contrarecibos y depósitos.',
    category: '⚡ Operación & Facturación',
  },
  {
    keys: ['P'],
    actionName: 'Magic Paste (Pegar WhatsApp)',
    description: 'Pega texto copiado de WhatsApp para interpretar automáticamente bultos y kilos.',
    category: '⚡ Operación & Facturación',
  },

  // 🔍 Búsqueda & Navegación
  {
    keys: ['Ctrl', 'K'],
    actionName: 'Buscador Universal / Command Palette',
    description: 'Busca instantáneamente expedientes, clientes, números de factura o navega entre módulos.',
    category: '🔍 Búsqueda & Navegación',
    badge: 'Esencial',
    badgeTone: 'info',
  },
  {
    keys: ['?'],
    actionName: 'Menú de Atajos de Teclado',
    description: 'Muestra esta ventana con todas las teclas rápidas activas en el sistema.',
    category: '🔍 Búsqueda & Navegación',
  },
  {
    keys: ['Esc'],
    actionName: 'Cerrar Ventana / Modal',
    description: 'Cierra cualquier modal, cajón lateral (Drawer) o menú emergente abierto.',
    category: '🔍 Búsqueda & Navegación',
  },

  // 🛠️ Productividad & Privacidad
  {
    keys: ['H'],
    actionName: 'Modo Privacidad (Ocultar Montos)',
    description: 'Oculta o desenfoca los importes en dinero si hay personas cerca de tu pantalla.',
    category: '🛠️ Productividad & Privacidad',
    badge: 'Seguridad',
    badgeTone: 'warn',
  },
  {
    keys: ['K'],
    actionName: 'Calculadora Flotante de Kilos',
    description: 'Abre la báscula virtual para sumar pesos y convertir bultos a kilogramos.',
    category: '🛠️ Productividad & Privacidad',
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-modal-title"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            background: 'var(--paper)',
            borderRadius: 18,
            border: '1px solid var(--line)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
            width: '100%',
            maxWidth: 680,
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(16,185,129,0.04) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                }}
              >
                ⌨️
              </div>
              <div>
                <h3
                  id="shortcuts-modal-title"
                  style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}
                >
                  Atajos de Teclado & Teclas Rápidas
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
                  Opera el ERP a máxima velocidad sin usar el mouse
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn"
              aria-label="Cerrar ventana de atajos de teclado"
              style={{
                minHeight: 44,
                minWidth: 44,
                padding: '8px 14px',
                borderRadius: 10,
                background: 'var(--paper-sunk)',
                border: '1px solid var(--line)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>✕</span>
              <span>Cerrar (Esc)</span>
            </button>
          </div>

          {/* Body con Scroll */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            {categories.map((cat) => (
              <div key={cat}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--ink-soft)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{cat}</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 10,
                  }}
                >
                  {SHORTCUTS.filter((s) => s.category === cat).map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--paper-raised)',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {s.keys.map((k, ki) => (
                            <React.Fragment key={ki}>
                              <kbd
                                style={{
                                  background: 'var(--paper)',
                                  border: '1.5px solid var(--line-hard, #cbd5e1)',
                                  borderBottom: '3px solid var(--line-hard, #94a3b8)',
                                  borderRadius: 6,
                                  padding: '2px 8px',
                                  fontSize: 12,
                                  fontWeight: 800,
                                  fontFamily: 'monospace',
                                  color: 'var(--ink)',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                                }}
                              >
                                {k}
                              </kbd>
                              {ki < s.keys.length - 1 && (
                                <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 800 }}>+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        {s.badge && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background:
                                s.badgeTone === 'ok'
                                  ? 'rgba(16,185,129,0.12)'
                                  : s.badgeTone === 'warn'
                                  ? 'rgba(245,158,11,0.12)'
                                  : 'rgba(59,130,246,0.12)',
                              color:
                                s.badgeTone === 'ok'
                                  ? '#059669'
                                  : s.badgeTone === 'warn'
                                  ? '#d97706'
                                  : '#2563eb',
                              border: `1px solid ${
                                s.badgeTone === 'ok'
                                  ? 'rgba(16,185,129,0.3)'
                                  : s.badgeTone === 'warn'
                                  ? 'rgba(245,158,11,0.3)'
                                  : 'rgba(59,130,246,0.3)'
                              }`,
                            }}
                          >
                            {s.badge}
                          </span>
                        )}
                      </div>

                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                          {s.actionName}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2, lineHeight: 1.35 }}>
                          {s.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--line)',
              background: 'var(--paper-sunk)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--ink-soft)',
            }}
          >
            <span>💡 Tip: Puedes presionar <strong>?</strong> en cualquier momento para abrir esta guía.</span>
            <span style={{ fontWeight: 600 }}>Control de Bolsas ERP v9.0</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
