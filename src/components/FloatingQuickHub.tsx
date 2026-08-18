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

  const handleNewOrder = () => {
    setIsOpen(false);
    navigate('/ordenes');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-order-modal', { detail: 'NEW' }));
    }, 150);
  };

  const handleBalanza = () => {
    setIsOpen(false);
    navigate('/audit');
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
        gap: 10,
      }}
    >
      {/* Botones Desplegables del Speed-Dial */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            {/* 1. Spotlight Buscador */}
            <button
              onClick={handleSpotlight}
              className="quick-hub-pill glow-sky"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              }}
            >
              <span>🔍 Spotlight Universal</span>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 4 }}>Ctrl+K</span>
            </button>

            {/* 2. Modo Privacidad */}
            <button
              onClick={handlePrivacy}
              className="quick-hub-pill glow-purple"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              }}
            >
              <span>{isPrivate ? '👁️ Mostrar Cifras' : '🕶️ Modo Privacidad'}</span>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 4 }}>Ctrl+H</span>
            </button>

            {/* 3. Calculadora de Kilos */}
            <button
              onClick={handleKiloCalc}
              className="quick-hub-pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              }}
            >
              <span>🧮 Calculadora $/kg</span>
            </button>

            {/* 4. Nuevo Pedido */}
            <button
              onClick={handleNewOrder}
              className="quick-hub-pill glow-emerald"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                border: '1px solid #10b981',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(5, 150, 105, 0.4)',
              }}
            >
              <span>➕ Nuevo Pedido / OC</span>
            </button>

            {/* 5. Balanza de Comprobación */}
            <button
              onClick={handleBalanza}
              className="quick-hub-pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: 'rgba(30, 41, 59, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 99,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              }}
            >
              <span>⚖️ Balanza de Auditoría</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón Principal Flotante (Gatillo) */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={toggleHub}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          color: '#fff',
          fontSize: 20,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(37, 99, 235, 0.5)',
        }}
        title="Acciones Rápidas del ERP"
      >
        <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          ⚡
        </motion.span>
      </motion.button>
    </div>
  );
}
