import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { triggerHaptic } from '../../lib/hapticEngine';
import { downloadMasterExcelWorkbook } from '../../lib/masterExcelExporter';
import { useOrdersContext } from '../../context/OrdersContext';
import { useConfig } from '../../hooks/useConfig';
import { useToast } from '../../context/ToastContext';
import { UniversalDocumentUploadModal } from '../Dashboard/UniversalDocumentUploadModal';
import { WhatsAppCommandHubModal } from '../WhatsApp/WhatsAppCommandHubModal';

export function GlobalSpeedFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const nav = useNavigate();
  const { orders } = useOrdersContext();
  const { config } = useConfig();
  const toast = useToast();

  const toggleOpen = () => {
    triggerHaptic('medium');
    setIsOpen((prev) => !prev);
  };

  const handleDownloadExcel = async () => {
    try {
      triggerHaptic('success');
      toast('📊 Generando Base de Datos Maestra de Excel...', 'info');
      downloadMasterExcelWorkbook({ orders, purchases: [], expenses: [], config });
      toast('✅ Archivo Excel descargado con éxito.', 'ok');
    } catch (err: any) {
      toast('Error al generar Excel: ' + (err?.message || 'Error desconocido'), 'bad');
    }
  };

  return (
    <>
      {/* Contenedor Flotante FAB (Adaptativo para Móviles y Escritorio) */}
      <div className="global-speed-fab-container">
        {/* Menú de Opciones Flotantes */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              transition={{ duration: 0.18 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 20,
                padding: '12px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.15)',
                minWidth: 240,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: '#10b981', padding: '4px 8px' }}>
                ⚡ Acciones Rápidas ERP
              </div>

              {/* Opción 1: Nueva Orden de Compra */}
              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
                onClick={() => {
                  triggerHaptic('medium');
                  setIsOpen(false);
                  nav('/ordenes?nueva=1');
                }}
              >
                <span style={{ fontSize: 18 }}>➕</span>
                <span>Nueva Orden (OC)</span>
              </button>

              {/* Opción 2: Entrada Rápida de Báscula */}
              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
                onClick={() => {
                  triggerHaptic('light');
                  setIsOpen(false);
                  nav('/captura-rapida');
                }}
              >
                <span style={{ fontSize: 18 }}>⚖️</span>
                <span>Báscula & Entregas</span>
              </button>

              {/* Opción 2: Pegar XML / Portal Providencia */}
              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
                onClick={() => {
                  triggerHaptic('light');
                  setIsOpen(false);
                  setShowUploadModal(true);
                }}
              >
                <span style={{ fontSize: 18 }}>📄</span>
                <span>Pegar XML / Contrarecibo</span>
              </button>

              {/* Opción 3: WhatsApp Command Hub */}
              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(37, 211, 102, 0.12)',
                  color: '#25D366',
                  border: '1px solid rgba(37, 211, 102, 0.3)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
                onClick={() => {
                  triggerHaptic('light');
                  setIsOpen(false);
                  setShowWhatsAppModal(true);
                }}
              >
                <span style={{ fontSize: 18 }}>💬</span>
                <span>Centro WhatsApp</span>
              </button>

              {/* Opción: Calculadora $/kg */}
              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
                onClick={() => {
                  triggerHaptic('light');
                  setIsOpen(false);
                  window.dispatchEvent(new CustomEvent('open-kilo-calculator'));
                }}
              >
                <span style={{ fontSize: 18 }}>🧮</span>
                <span>Calculadora $/kg</span>
              </button>

              {/* Opción 4: Descarga Excel Maestro */}
              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(5, 150, 105, 0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(5, 150, 105, 0.3)',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
                onClick={() => {
                  setIsOpen(false);
                  void handleDownloadExcel();
                }}
              >
                <span style={{ fontSize: 18 }}>📊</span>
                <span>Descargar Excel (.xlsx)</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón Circular Principal Trigger */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={toggleOpen}
          aria-label="Acciones Rápidas"
          style={{
            width: 58,
            height: 58,
            borderRadius: 999,
            background: isOpen
              ? '#ef4444'
              : 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
            color: '#fff',
            border: '2px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 22,
            cursor: 'pointer',
            boxShadow: '0 10px 25px rgba(5, 150, 105, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'background 0.2s ease',
          }}
        >
          {isOpen ? '✕' : '⚡'}
        </motion.button>
      </div>

      {/* Modales Invocables */}
      {showUploadModal && (
        <UniversalDocumentUploadModal onClose={() => setShowUploadModal(false)} />
      )}

      {showWhatsAppModal && (
        <WhatsAppCommandHubModal
          order={orders[0] || null}
          onClose={() => setShowWhatsAppModal(false)}
          toast={toast}
        />
      )}
    </>
  );
}
