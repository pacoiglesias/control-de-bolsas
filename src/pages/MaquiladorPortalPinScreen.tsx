import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { motion } from 'framer-motion';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { glass, STORAGE_PIN_KEY } from './MaquiladorPortal.shared';
import { triggerHaptic } from '../lib/hapticEngine';

// Extraido de MaquiladorPortal.tsx (~190 lineas de las 1796 originales).
// Pantalla de PIN numerico con memoria opcional -- no depende de nada del
// resto del portal salvo los estilos/keys compartidos en
// MaquiladorPortal.shared.ts, asi que separarla es de bajo riesgo.

/* ─── Pantalla de PIN numérico con memoria opcional ────────────────────────── */
export function PinScreen({ onSuccess }: { onSuccess: (pin: string, orders: any[]) => void }) {
  const [digits, setDigits] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  const toast = useToast();

  const del = () => {
    triggerHaptic('light');
    setDigits((prev) => prev.slice(0, -1));
  };

  const tryLogin = useCallback(async (pinToTry: string, silent = false) => {
    if (pinToTry.length < 4) return;
    setLoading(true);
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ pin: pinToTry });
      if (rememberMe) {
        localStorage.setItem(STORAGE_PIN_KEY, pinToTry);
      } else {
        localStorage.removeItem(STORAGE_PIN_KEY);
      }
      triggerHaptic('success');
      onSuccess(pinToTry, (res.data as any[]) || []);
    } catch (err: any) {
      triggerHaptic('error');
      if (silent) {
        localStorage.removeItem(STORAGE_PIN_KEY);
      } else {
        setShake(true);
        setDigits('');
        setTimeout(() => setShake(false), 600);
        if (err?.code === 'functions/permission-denied') {
          toast('PIN incorrecto', 'bad');
        } else if (err?.code === 'functions/resource-exhausted') {
          toast(err?.message || 'Demasiados intentos fallidos. Espera unos minutos.', 'bad');
        } else if (err?.code === 'functions/failed-precondition') {
          toast(err?.message || 'El PIN del portal no está configurado.', 'bad');
        } else {
          toast('Error de conexión con el servidor.', 'bad');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [rememberMe, onSuccess, toast]);

  const handleDigit = (d: string) => {
    if (digits.length >= 6 || loading) return;
    triggerHaptic('light');
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      void tryLogin(next);
    }
  };

  // Auto-login si hay PIN guardado
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PIN_KEY);
    if (saved && saved.length >= 4) {
      void tryLogin(saved, true);
    }
  }, [tryLogin]);

  // Soporte de Teclado Físico (0-9, Backspace, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        del();
      } else if (e.key === 'Enter' && digits.length >= 4) {
        e.preventDefault();
        void tryLogin(digits);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [digits, loading, tryLogin]);

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 60%, #030712 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          position: 'relative',
        }}
      >
        {/* Logo / Header */}
        <div style={{ textAlign: 'center' }}>
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            style={{ fontSize: 56, marginBottom: 8, filter: 'drop-shadow(0 8px 16px rgba(167, 139, 250, 0.4))' }}
          >
            🏭
          </motion.div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
            Portal de Proveedor / Báscula
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6, fontSize: 14 }}>
            {provName} · Control de Entregas y Saldo
          </p>
        </div>

        {/* Input invisible para enfocar teclado físico o móvil */}
        <input
          type="tel"
          pattern="[0-9]*"
          maxLength={6}
          value={digits}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setDigits(val);
            if (val.length === 4) {
              void tryLogin(val);
            }
          }}
          autoFocus
          style={{
            position: 'absolute',
            opacity: 0,
            width: 1,
            height: 1,
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
          aria-label="Ingresa el PIN de 4 dígitos"
        />

        {/* Dots de PIN (Clickables para abrir teclado) */}
        <div
          onClick={() => {
            const input = document.querySelector('input[type="tel"]') as HTMLInputElement;
            if (input) input.focus();
          }}
          style={{ display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer' }}
          title="Toca para escribir en el teclado"
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: i < digits.length ? '#a78bfa' : 'rgba(255,255,255,0.2)',
                boxShadow: i < digits.length ? '0 0 16px #a78bfa' : 'none',
                transition: 'all 0.15s ease',
              }}
            />
          ))}
        </div>

        {/* Teclado numérico */}
        <div
          style={{
            ...glass,
            padding: 22,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {KEYS.map((k, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (k === '⌫') del();
                else if (k !== '') handleDigit(k);
              }}
              disabled={loading || k === ''}
              style={{
                height: 64,
                fontSize: k === '⌫' ? 22 : 28,
                fontWeight: 700,
                background:
                  k === ''
                    ? 'transparent'
                    : k === '⌫'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(255, 255, 255, 0.08)',
                border: k === '' ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 16,
                color: '#fff',
                cursor: k === '' ? 'default' : 'pointer',
                transition: 'background 0.15s, transform 0.1s',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {loading && k === '0' ? '⏳' : k}
            </motion.button>
          ))}
        </div>

        {/* Checkbox Recordar */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(255,255,255,0.7)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#a78bfa', cursor: 'pointer' }}
          />
          Recordar acceso en este celular / dispositivo
        </label>
      </motion.div>
    </div>
  );
}
