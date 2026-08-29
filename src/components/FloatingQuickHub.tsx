import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivacy } from '../context/PrivacyContext';
import { useNavigate } from 'react-router-dom';
import { playSoftClick, triggerHaptic } from '../lib/hapticEngine';
import { useToast } from '../context/ToastContext';

export function FloatingQuickHub() {
  const [isOpen, setIsOpen] = useState(false);
  const { isPrivate, togglePrivacy } = usePrivacy();
  const navigate = useNavigate();
  const toast = useToast();

  const toggleHub = () => {
    setIsOpen((prev) => !prev);
    playSoftClick();
    triggerHaptic('light');
  };

  const handleSpotlight = () => {
    setIsOpen(false);
    document.dispatchEvent(new CustomEvent('open-command-menu'));
    playSoftClick();
  };

  const handlePrivacy = () => {
    togglePrivacy();
    setIsOpen(false);
    toast(isPrivate ? '👁️ Cifras visibles' : '🕶️ Modo Privacidad activado (Cifras ocultas)', 'ok');
  };

  const handleKiloCalc = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('open-kilo-calculator'));
    playSoftClick();
  };

  // 1. Capturar OC
  const handleFastOc = () => {
    setIsOpen(false);
    navigate('/ordenes?nueva=1');
    playSoftClick();
    triggerHaptic('medium');
  };

  // 2. Capturar Entrega Báscula
  const handleFastDelivery = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('open-fast-delivery'));
    playSoftClick();
    triggerHaptic('medium');
  };

  // 3. Emitir Factura CFDI
  const handleFastInvoice = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('open-fast-invoice'));
    playSoftClick();
    triggerHaptic('medium');
  };

  // 4. Capturar Contrarecibo
  const handleFastCr = () => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('open-fast-cr-collection'));
    playSoftClick();
    triggerHaptic('medium');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 990,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      {/* Botones Desplegables del Speed-Dial */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.92 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              alignItems: 'flex-end',
            }}
          >
            {/* 1. Capturar OC */}
            <motion.button
              whileHover={{ scale: 1.04, x: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleFastOc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 15px',
                background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                border: '1.5px solid rgba(147, 197, 253, 0.4)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
              }}
            >
              <span>📝 1. Capturar OC / Pedido</span>
            </motion.button>

            {/* 2. Capturar Entrega Báscula */}
            <motion.button
              whileHover={{ scale: 1.04, x: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleFastDelivery}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 15px',
                background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
                border: '1.5px solid rgba(110, 231, 183, 0.4)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(5, 150, 105, 0.45)',
              }}
            >
              <span>🚚 2. Registrar Entrega Báscula</span>
            </motion.button>

            {/* 3. Emitir Factura CFDI */}
            <motion.button
              whileHover={{ scale: 1.04, x: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleFastInvoice}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 15px',
                background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
                border: '1.5px solid rgba(253, 230, 138, 0.4)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(217, 119, 6, 0.45)',
              }}
            >
              <span>🧾 3. Emitir Factura CFDI</span>
            </motion.button>

            {/* 4. Capturar Contrarecibo */}
            <motion.button
              whileHover={{ scale: 1.04, x: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleFastCr}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 15px',
                background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)',
                border: '1.5px solid rgba(196, 181, 253, 0.4)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(124, 58, 237, 0.45)',
              }}
            >
              <span>📑 4. Capturar Contrarecibo</span>
            </motion.button>

            {/* Divisor */}
            <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.12)', margin: '2px 0' }} />

            {/* 5. Spotlight Buscador */}
            <motion.button
              whileHover={{ scale: 1.03, x: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSpotlight}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 13px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              }}
            >
              <span>🔍 Spotlight Buscador</span>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 4 }}>Ctrl+K</span>
            </motion.button>

            {/* 6. Modo Privacidad */}
            <motion.button
              whileHover={{ scale: 1.03, x: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handlePrivacy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 13px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              }}
            >
              <span>{isPrivate ? '👁️ Mostrar Cifras' : '🕶️ Modo Privacidad'}</span>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 4 }}>Ctrl+H</span>
            </motion.button>

            {/* 7. Calculadora */}
            <motion.button
              whileHover={{ scale: 1.03, x: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleKiloCalc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 13px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              }}
            >
              <span>🧮 Calculadora $/kg</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón Principal Flotante (Gatillo) */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={toggleHub}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          border: '2.5px solid rgba(255, 255, 255, 0.35)',
          color: '#fff',
          fontSize: 22,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(37, 99, 235, 0.55)',
        }}
        title="Acciones Rápidas del ERP (1. OC, 2. Entrega, 3. Factura, 4. Contrarecibo)"
      >
        <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          ⚡
        </motion.span>
      </motion.button>
    </div>
  );
}
