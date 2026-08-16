import React, { useState, useEffect, useMemo } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, PATHS, functions } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { httpsCallable } from 'firebase/functions';
import { money } from '../lib/format';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { openWhatsAppMessage } from '../lib/whatsappReminder';

/* ─── Estilos Glassmorphism Premium ────────────────────────────────────────── */
const glass = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
};

const kpiCard = (accent: string, bg = 'rgba(255, 255, 255, 0.05)') => ({
  ...glass,
  background: bg,
  padding: '20px 22px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  borderLeft: `4px solid ${accent}`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
});

const STORAGE_PIN_KEY = 'maquila_saved_pin_v2';
const STORAGE_DELIVERIES_KEY = 'maquila_recent_deliveries_v2';
const STORAGE_OFFLINE_QUEUE_KEY = 'maquila_offline_queue_v2';

/* ─── Pantalla de PIN numérico con memoria opcional ────────────────────────── */
function PinScreen({ onSuccess }: { onSuccess: (pin: string, orders: any[]) => void }) {
  const [digits, setDigits] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const toast = useToast();

  const del = () => setDigits((prev) => prev.slice(0, -1));

  const tryLogin = async (pinToTry: string, silent = false) => {
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
      onSuccess(pinToTry, (res.data as any[]) || []);
    } catch (err: any) {
      if (silent) {
        localStorage.removeItem(STORAGE_PIN_KEY);
      } else {
        setShake(true);
        setDigits('');
        setTimeout(() => setShake(false), 600);
        if (err?.code === 'functions/permission-denied') {
          toast('PIN incorrecto', 'bad');
        } else {
          toast('Error de conexión con el servidor.', 'bad');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-login si hay PIN guardado
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PIN_KEY);
    if (saved && saved.length >= 4) {
      tryLogin(saved, true);
    }
  }, []);

  const handleDigit = (d: string) => {
    const next = digits + d;
    if (next.length <= 4) {
      setDigits(next);
      if (next.length >= 4) tryLogin(next);
    }
  };

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
            Portal Maquilador
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6, fontSize: 14 }}>
            Andrés · Control de Entregas y Saldo
          </p>
        </div>

        {/* Dots de PIN */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
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

/* ─── Portal Principal Maquilador ─────────────────────────────────────────── */
export default function MaquiladorPortal() {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [auth, setAuth] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState('');
  const [kilos, setKilos] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'entrega' | 'estado' | 'historial'>('entrega');
  const [statement, setStatement] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'pagos' | 'entregas'>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [searchOc, setSearchOc] = useState('');
  const [deptFilter, setDeptFilter] = useState<'ALL' | 'TH' | 'GT'>('ALL');
  const [lastDeliveredNotice, setLastDeliveredNotice] = useState<any>(null);

  // Calculadora de bultos
  const [showBundleCalc, setShowBundleCalc] = useState(false);
  const [bundleCount, setBundleCount] = useState('');
  const [bundleWeight, setBundleWeight] = useState('25');

  // Estado de Red / Modo Taller
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Sincronizador de entregas encoladas offline
  const syncOfflineQueue = async () => {
    const queueStr = localStorage.getItem(STORAGE_OFFLINE_QUEUE_KEY);
    if (!queueStr) return;
    try {
      const queue = JSON.parse(queueStr);
      if (!Array.isArray(queue) || queue.length === 0) return;
      toast(`Sincronizando ${queue.length} entrega(s) guardada(s) offline...`, 'info');
      
      for (const item of queue) {
        await addDoc(collection(db, PATHS.maquilaDeliveries), {
          date: serverTimestamp(),
          orderId: item.orderId,
          folio: item.folio,
          productDescription: item.productDescription,
          kilos: item.kilos,
          notes: item.notes || null,
          status: item.status,
          createdAt: serverTimestamp(),
        });
      }
      localStorage.removeItem(STORAGE_OFFLINE_QUEUE_KEY);
      toast(`✅ ${queue.length} entrega(s) sincronizada(s) con éxito en la nube`, 'ok');
      recargar();
    } catch (e) {
      console.warn('Error sincronizando entregas offline', e);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Intentar sincronizar al inicio si ya hay conexión
    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar historial guardado
  const [historial, setHistorial] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DELIVERIES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSuccess = (p: string, orders: any[]) => {
    setPin(p);
    setActiveOrders(orders);
    setAuth(true);
    syncOfflineQueue();
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_PIN_KEY);
    setAuth(false);
    setPin('');
    setActiveOrders([]);
  };

  const recargar = async () => {
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ pin });
      setActiveOrders((res.data as any[]) || []);
      toast('Órdenes actualizadas', 'ok');
    } catch {
      toast('Error al actualizar órdenes', 'bad');
    }
  };

  const loadStatement = async () => {
    setLoadingStatement(true);
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ action: 'ledger', pin });
      setStatement(res.data);
    } catch {
      toast('Error al cargar estado de cuenta', 'bad');
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleTabChange = (t: typeof tab) => {
    setTab(t);
    if (t === 'estado' && !statement) loadStatement();
  };

  const selectedOrder = activeOrders.find((o) => o.orderId === orderId);

  const numKilos = Number(kilos) || 0;
  const isOverDelivery = selectedOrder && numKilos > selectedOrder.pendingKilos;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return toast('Selecciona una orden de compra', 'bad');
    if (!kilos || isNaN(numKilos) || numKilos <= 0) return toast('Ingresa kilos válidos', 'bad');

    const requiresApproval = isOverDelivery;

    setSaving(true);

    // Si no hay conexión a internet, guardar en cola offline localmente
    if (!navigator.onLine) {
      const offlineItem = {
        id: `offline-${Date.now()}`,
        orderId: selectedOrder.orderId,
        folio: selectedOrder.folio,
        productDescription: selectedOrder.productDescription,
        kilos: numKilos,
        notes: deliveryNotes.trim() || null,
        status: requiresApproval ? 'pending_approval' : 'pending',
        date: new Date().toISOString(),
      };

      const existingQueue = JSON.parse(localStorage.getItem(STORAGE_OFFLINE_QUEUE_KEY) || '[]');
      existingQueue.push(offlineItem);
      localStorage.setItem(STORAGE_OFFLINE_QUEUE_KEY, JSON.stringify(existingQueue));

      const updatedHistory = [offlineItem, ...historial].slice(0, 30);
      setHistorial(updatedHistory);
      localStorage.setItem(STORAGE_DELIVERIES_KEY, JSON.stringify(updatedHistory));

      setLastDeliveredNotice({
        folio: selectedOrder.folio,
        product: selectedOrder.productDescription,
        kilos: numKilos,
        notes: deliveryNotes.trim(),
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a78bfa', '#34d399', '#facc15'],
      });

      toast(`💾 Guardado localmente (Sin Internet). Se sincronizará en automático al detectar red.`, 'ok');
      setKilos('');
      setDeliveryNotes('');
      setOrderId('');
      setSaving(false);
      return;
    }

    try {
      const deliveryRef = await addDoc(collection(db, PATHS.maquilaDeliveries), {
        date: serverTimestamp(),
        orderId: selectedOrder.orderId,
        folio: selectedOrder.folio,
        productDescription: selectedOrder.productDescription,
        kilos: numKilos,
        notes: deliveryNotes.trim() || null,
        status: requiresApproval ? 'pending_approval' : 'pending',
        createdAt: serverTimestamp(),
      });

      // Disparar Confetti
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#a78bfa', '#34d399', '#38bdf8', '#facc15'],
      });

      const newEntry = {
        id: deliveryRef.id,
        folio: selectedOrder.folio,
        productDescription: selectedOrder.productDescription,
        kilos: numKilos,
        notes: deliveryNotes.trim(),
        date: new Date().toISOString(),
        status: requiresApproval ? 'pending_approval' : 'pending',
      };

      const updatedHistory = [newEntry, ...historial].slice(0, 30);
      setHistorial(updatedHistory);
      localStorage.setItem(STORAGE_DELIVERIES_KEY, JSON.stringify(updatedHistory));

      setLastDeliveredNotice({
        folio: selectedOrder.folio,
        product: selectedOrder.productDescription,
        kilos: numKilos,
        notes: deliveryNotes.trim(),
      });

      if (requiresApproval) {
        toast(`⚠ Entrega de ${kilos} kg excede lo pedido. Queda pendiente de aprobación.`, 'ok');
      } else {
        toast(`✓ Entrega de ${kilos} kg registrada exitosamente`, 'ok');
      }

      setKilos('');
      setDeliveryNotes('');
      setOrderId('');
      recargar();
    } catch (err: any) {
      toast('Error al guardar entrega: ' + err.message, 'bad');
    } finally {
      setSaving(false);
    }
  };

  // Descarga formal de PDF del Estado de Cuenta
  const handleDownloadPdf = async () => {
    if (!statement) return;
    try {
      toast('Generando comprobante en PDF...', 'info');
      const html2pdf = (await import('html2pdf.js')).default;

      const html = `
        <div style="font-family: 'Inter', system-ui, sans-serif; padding: 36px; color: #0f172a; max-width: 800px; margin: 0 auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
            <div>
              <h1 style="margin: 0; font-size: 24px; color: #6d28d9; font-weight: 800;">ESTADO DE CUENTA · MAQUILA</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Taller Maquilador: Andrés · Providencia</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">Fecha de Emisión:</p>
              <p style="margin: 2px 0 0; font-size: 14px; font-weight: 700; color: #0f172a;">${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border-left: 4px solid #8b5cf6;">
              <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Fabricado</div>
              <div style="font-size: 20px; font-weight: 800; color: #1e1b4b; margin-top: 4px;">${money(statement.totalPurchasesCost)}</div>
            </div>
            <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border-left: 4px solid #10b981;">
              <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Pagado</div>
              <div style="font-size: 20px; font-weight: 800; color: #047857; margin-top: 4px;">${money(statement.totalPagado)}</div>
            </div>
            <div style="background: #f8fafc; padding: 14px; border-radius: 10px; border-left: 4px solid ${statement.saldoProveedor < 0 ? '#10b981' : '#f59e0b'};">
              <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">${statement.saldoProveedor < 0 ? 'Saldo a Favor' : 'Anticipo Pendiente'}</div>
              <div style="font-size: 20px; font-weight: 800; color: ${statement.saldoProveedor < 0 ? '#047857' : '#b45309'}; margin-top: 4px;">
                ${statement.saldoProveedor < 0 ? '+' : '-'}${money(Math.abs(statement.saldoProveedor))}
              </div>
            </div>
          </div>

          <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Desglose de Movimientos</h3>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">Fecha</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">Concepto</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Entrega (Cargo)</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Pago (Abono)</th>
                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Saldo</th>
              </tr>
            </thead>
            <tbody>
              ${statement.ledger.map((r: any) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px; color: #64748b;">${new Date(r.dateMillis).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                  <td style="padding: 8px 10px; font-weight: 600;">${r.concept}</td>
                  <td style="padding: 8px 10px; text-align: right; color: ${r.cargo > 0 ? '#dc2626' : '#94a3b8'}; font-family: monospace;">${r.cargo > 0 ? money(r.cargo) : '-'}</td>
                  <td style="padding: 8px 10px; text-align: right; color: ${r.abono > 0 ? '#059669' : '#94a3b8'}; font-family: monospace;">${r.abono > 0 ? money(r.abono) : '-'}</td>
                  <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-weight: 700;">${money(r.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px; padding-top: 16px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
            <div>Generado automáticamente por Control Bolsas ERP</div>
            <div style="text-align: right; width: 200px; border-top: 1px solid #94a3b8; padding-top: 4px;">Firma de Conformidad</div>
          </div>
        </div>
      `;

      const opt: any = {
        margin: 10,
        filename: `Estado_Cuenta_Andres_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      html2pdf().set(opt).from(html).save();
    } catch (err: any) {
      toast(`Error generando PDF: ${err.message}`, 'bad');
    }
  };

  // Descarga de comprobante de entrega individual (Remisión en PDF)
  const handleDownloadDeliveryTicket = async (h: any) => {
    try {
      toast('Generando remisión de entrega...', 'info');
      const html2pdf = (await import('html2pdf.js')).default;
      const html = `
        <div style="font-family: 'Inter', system-ui, sans-serif; padding: 28px; color: #0f172a; max-width: 600px; margin: 0 auto; border: 2px solid #7c3aed; border-radius: 12px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <h2 style="margin: 0; color: #6d28d9; font-size: 18px; font-weight: 800;">COMPROBANTE DE ENTREGA · MAQUILA</h2>
              <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Taller Maquilador: Andrés · Providencia</p>
            </div>
            <div style="text-align: right;">
              <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 14px; font-weight: 800; color: #0f172a;">OC ${h.folio}</span>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 18px; border: 1px solid #e2e8f0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
              <div>
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Fecha de Entrega:</span>
                <div style="font-weight: 700; color: #0f172a; margin-top: 2px;">${h.date ? new Date(h.date).toLocaleDateString('es-MX', { dateStyle: 'full', timeStyle: 'short' }) : 'Reciente'}</div>
              </div>
              <div>
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Kilos Entregados:</span>
                <div style="font-weight: 900; color: #059669; font-size: 22px; margin-top: 2px;">${h.kilos.toLocaleString('es-MX')} kg</div>
              </div>
              <div style="grid-column: 1 / -1;">
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Producto:</span>
                <div style="font-weight: 600; color: #334155; margin-top: 2px;">${h.productDescription || 'Polietileno Providencia'}</div>
              </div>
              ${h.notes ? `
              <div style="grid-column: 1 / -1; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
                <span style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700;">Chofer / Observaciones:</span>
                <div style="font-weight: 600; color: #1e293b; margin-top: 2px;">${h.notes}</div>
              </div>` : ''}
            </div>
          </div>

          <div style="margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center; font-size: 11px; color: #475569;">
            <div>
              <div style="border-top: 1px solid #94a3b8; padding-top: 4px; font-weight: 700;">Entregó (Andrés / Taller)</div>
            </div>
            <div>
              <div style="border-top: 1px solid #94a3b8; padding-top: 4px; font-weight: 700;">Recibió (Almacén Providencia)</div>
            </div>
          </div>
        </div>
      `;

      const opt: any = {
        margin: 10,
        filename: `Remision_Entrega_OC_${h.folio}_${h.kilos}kg.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'landscape' },
      };

      html2pdf().set(opt).from(html).save();
    } catch (err: any) {
      toast(`Error generando comprobante: ${err.message}`, 'bad');
    }
  };

  // Filtrado de Ledger
  const filteredLedger = useMemo(() => {
    if (!statement?.ledger) return [];
    return statement.ledger.filter((row: any) => {
      if (ledgerFilter === 'pagos' && row.abono <= 0) return false;
      if (ledgerFilter === 'entregas' && row.cargo <= 0) return false;
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        return (row.concept || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [statement, ledgerFilter, ledgerSearch]);

  // Filtrado de OCs activas (con búsqueda y filtro TH / GT)
  const filteredOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      if (deptFilter !== 'ALL') {
        const fol = (o.folio || '').toUpperCase();
        if (!fol.startsWith(deptFilter)) return false;
      }
      if (searchOc.trim()) {
        const q = searchOc.toLowerCase();
        const matchesFolio = (o.folio || '').toLowerCase().includes(q);
        const matchesProd = (o.productDescription || '').toLowerCase().includes(q);
        if (!matchesFolio && !matchesProd) return false;
      }
      return true;
    });
  }, [activeOrders, searchOc, deptFilter]);

  if (!auth) return <PinScreen onSuccess={handleSuccess} />;

  /* ─── Variables de Diseño ───────────────────────────────────────────────── */
  const BG = 'radial-gradient(circle at 50% 10%, #1e1b4b 0%, #0f172a 50%, #030712 100%)';
  const TAB_ACTIVE = {
    background: 'rgba(167,139,250,0.25)',
    color: '#c4b5fd',
    borderBottom: '3px solid #a78bfa',
  };
  const TAB_IDLE = {
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    borderBottom: '3px solid transparent',
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        padding: '16px 16px 80px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
      }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        {/* Header Superior */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            padding: '12px 18px',
            ...glass,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 32 }}>🏭</div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: '#a78bfa',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>Portal Maquilador</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 99,
                    background: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: isOnline ? '#34d399' : '#f87171',
                    border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}
                >
                  ● {isOnline ? 'En Línea' : 'Sin Conexión'}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 1 }}>Andrés · Taller Providencia</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={recargar}
              title="Actualizar Órdenes"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                padding: '8px 12px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              🔄
            </button>
            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                padding: '8px 12px',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⏻ Salir
            </button>
          </div>
        </motion.div>

        {/* Tabs de Navegación */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            marginBottom: 20,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 14,
            padding: 4,
          }}
        >
          {(
            [
              ['entrega', '🏭 Registrar Entrega'],
              ['estado', '💰 Mi Estado de Cuenta'],
              ['historial', `📋 Historial (${historial.length})`],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => handleTabChange(k)}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                transition: 'all 0.2s',
                ...(tab === k ? TAB_ACTIVE : TAB_IDLE),
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Banner de Aviso de Última Entrega con Botón WhatsApp */}
        <AnimatePresence>
          {lastDeliveredNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                ...glass,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: 16,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399' }}>
                  🎉 ¡Entrega de {lastDeliveredNotice.kilos} kg Registrada!
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                  OC {lastDeliveredNotice.folio} ({lastDeliveredNotice.product})
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    const text = `Hola Paco, te confirmo que acabo de registrar una entrega de *${lastDeliveredNotice.kilos} kg* para la *OC ${lastDeliveredNotice.folio}* (${lastDeliveredNotice.product}) en el sistema.${lastDeliveredNotice.notes ? `\nNota: ${lastDeliveredNotice.notes}` : ''}\nQuedo al pendiente. Saludos, Andrés.`;
                    openWhatsAppMessage(text);
                  }}
                  style={{
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 14px',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
                  }}
                >
                  <span>📲</span> Avisar a Paco
                </button>
                <button
                  onClick={() => setLastDeliveredNotice(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TAB 1: REGISTRAR ENTREGA ────────────────────────────────────────── */}
        {tab === 'entrega' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filtros de Departamento y Buscador */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['ALL', 'TH', 'GT'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDeptFilter(d)}
                    style={{
                      background: deptFilter === d ? '#a78bfa' : 'rgba(255,255,255,0.08)',
                      color: deptFilter === d ? '#0f172a' : '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d === 'ALL' ? '🏢 Todas' : d}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="🔍 Buscar orden o producto..."
                value={searchOc}
                onChange={(e) => setSearchOc(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 160,
                  boxSizing: 'border-box',
                  padding: '9px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Listado de OCs Activas */}
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.5)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: 10,
                }}
              >
                Órdenes de Compra Activas ({filteredOrders.length})
              </div>

              {filteredOrders.length === 0 && (
                <div style={{ ...glass, padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                  <div>No hay órdenes pendientes con este filtro.</div>
                </div>
              )}

              {filteredOrders.map((o) => {
                const sel = orderId === o.orderId;
                const pct = Math.min(100, Math.round(((o.totalKilos - o.pendingKilos) / Math.max(o.totalKilos, 1)) * 100));

                return (
                  <motion.button
                    key={o.orderId}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setOrderId(sel ? '' : o.orderId);
                      setKilos('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      marginBottom: 12,
                      padding: '18px 20px',
                      borderRadius: 18,
                      background: sel
                        ? 'linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(124,58,237,0.2) 100%)'
                        : 'rgba(255,255,255,0.05)',
                      border: sel ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      transition: 'all 0.2s ease',
                      boxShadow: sel ? '0 8px 24px rgba(167,139,250,0.2)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 17, color: sel ? '#e9d5ff' : '#fff' }}>
                          OC {o.folio}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                          {o.productDescription}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, color: '#fbbf24', fontWeight: 800 }}>
                          {o.pendingKilos.toLocaleString('es-MX')} kg
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          de {o.totalKilos.toLocaleString('es-MX')} kg pedidos
                        </div>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 99,
                          background: pct >= 100 ? '#10b981' : '#a78bfa',
                          width: `${pct}%`,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.4)',
                        marginTop: 6,
                      }}
                    >
                      <span>{pct}% entregado</span>
                      <span>{sel ? '✓ Seleccionada' : 'Toca para registrar'}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Formulario Interactivo de Registro de Kilos */}
            {selectedOrder && (
              <motion.form
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleSubmit}
                style={{
                  ...glass,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  border: '2px solid rgba(167, 139, 250, 0.4)',
                  background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#a78bfa', fontWeight: 800 }}>
                      ✅ Reportar Entrega para OC {selectedOrder.folio}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {selectedOrder.productDescription} · Pendientes:{' '}
                      <strong style={{ color: '#fbbf24' }}>{selectedOrder.pendingKilos.toLocaleString('es-MX')} kg</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowBundleCalc(!showBundleCalc)}
                    style={{
                      background: showBundleCalc ? 'rgba(167, 139, 250, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(167, 139, 250, 0.4)',
                      borderRadius: 10,
                      padding: '6px 10px',
                      color: '#c4b5fd',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>🧮</span> Bultos
                  </button>
                </div>

                {/* Widget de Calculadora de Bultos / Rollos */}
                {showBundleCalc && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(167, 139, 250, 0.3)',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>
                      🧮 Calculadora de Taller (Bultos / Rollos):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
                          Bultos / Rollos:
                        </label>
                        <input
                          type="number"
                          placeholder="Ej. 40"
                          value={bundleCount}
                          onChange={(e) => setBundleCount(e.target.value)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '8px 10px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8,
                            color: '#fff',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>
                          Peso c/u (kg):
                        </label>
                        <input
                          type="number"
                          placeholder="Ej. 25"
                          value={bundleWeight}
                          onChange={(e) => setBundleWeight(e.target.value)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '8px 10px',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8,
                            color: '#fff',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                    {Number(bundleCount) > 0 && Number(bundleWeight) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <div style={{ fontSize: 13, color: '#34d399', fontWeight: 800 }}>
                          Total: {(Number(bundleCount) * Number(bundleWeight)).toFixed(2)} kg
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setKilos(String((Number(bundleCount) * Number(bundleWeight)).toFixed(2)));
                            setShowBundleCalc(false);
                          }}
                          style={{
                            background: '#10b981',
                            border: 'none',
                            borderRadius: 8,
                            padding: '6px 12px',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          ✨ Aplicar
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Presets Inteligentes de 1-Clic */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setKilos(String(selectedOrder.pendingKilos))}
                    style={{
                      background: 'rgba(167, 139, 250, 0.2)',
                      border: '1px solid #a78bfa',
                      borderRadius: 10,
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✨ Todo ({selectedOrder.pendingKilos} kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKilos(String(Math.round(selectedOrder.pendingKilos / 2)))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ½ Mitad ({Math.round(selectedOrder.pendingKilos / 2)} kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKilos(String((Number(kilos) || 0) + 100))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    +100 kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setKilos(String((Number(kilos) || 0) + 500))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    +500 kg
                  </button>
                  {kilos && (
                    <button
                      type="button"
                      onClick={() => setKilos('')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Input de Kilos */}
                <div>
                  <label
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.7)',
                      display: 'block',
                      marginBottom: 8,
                      fontWeight: 600,
                    }}
                  >
                    Kilos a Entregar:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={kilos}
                    onChange={(e) => setKilos(e.target.value)}
                    placeholder="0.00 kg"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '16px',
                      fontSize: 32,
                      fontWeight: 900,
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.08)',
                      border: isOverDelivery
                        ? '2px solid #f59e0b'
                        : '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 14,
                      color: '#fff',
                      outline: 'none',
                    }}
                    autoFocus
                  />
                  {isOverDelivery && (
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 6, fontWeight: 600 }}>
                      ⚠️ Cantidad excede lo pedido (+{(numKilos - selectedOrder.pendingKilos).toFixed(2)} kg). Requerirá aprobación de administración.
                    </div>
                  )}
                </div>

                {/* Input de Nota / Chofer Opcional */}
                <div>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>
                    Nota u observaciones (Opcional):
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Ej. Chofer Toño - Camioneta blanca"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      color: '#fff',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Botón de Confirmación */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={saving || !kilos || numKilos <= 0}
                  style={{
                    padding: '18px',
                    fontSize: 17,
                    fontWeight: 900,
                    borderRadius: 16,
                    background:
                      saving || !kilos || numKilos <= 0
                        ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                    border: 'none',
                    color: '#fff',
                    cursor: saving || !kilos || numKilos <= 0 ? 'default' : 'pointer',
                    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)',
                    transition: 'all 0.2s',
                  }}
                >
                  {saving ? '⏳ Guardando entrega...' : `✅ Confirmar Entrega de ${numKilos > 0 ? numKilos : ''} kg`}
                </motion.button>
              </motion.form>
            )}
          </div>
        )}

        {/* ── TAB 2: MI ESTADO DE CUENTA ──────────────────────────────────────── */}
        {tab === 'estado' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loadingStatement ? (
              <div style={{ ...glass, padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                <div>Consultando tu balance contable en vivo...</div>
              </div>
            ) : !statement ? (
              <div style={{ ...glass, padding: 40, textAlign: 'center' }}>
                <button
                  onClick={loadStatement}
                  style={{
                    padding: '14px 28px',
                    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                    border: 'none',
                    borderRadius: 14,
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  💰 Ver Mi Estado de Cuenta
                </button>
              </div>
            ) : (
              <>
                {/* KPIs de Saldo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={kpiCard('#a78bfa')}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Total Fabricado
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 900 }}>{money(statement.totalPurchasesCost)}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{statement.totalReceivedKilos?.toLocaleString?.('es-MX') || 0} kg entregados</span>
                  </div>

                  <div style={kpiCard('#34d399')}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Total Pagado
                    </span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>{money(statement.totalPagado)}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Abonos recibidos</span>
                  </div>

                  <div
                    style={{
                      ...kpiCard(
                        statement.saldoProveedor < 0 ? '#34d399' : '#fbbf24',
                        statement.saldoProveedor < 0
                          ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.2) 100%)'
                          : 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.2) 100%)'
                      ),
                      gridColumn: '1 / -1',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase' }}>
                        {statement.saldoProveedor < 0 ? '✅ Saldo a tu Favor' : '⚠️ Anticipo Pendiente'}
                      </span>
                      <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>En tiempo real</span>
                    </div>
                    <span
                      style={{
                        fontSize: 34,
                        fontWeight: 900,
                        color: statement.saldoProveedor < 0 ? '#34d399' : '#fbbf24',
                        letterSpacing: '-1px',
                      }}
                    >
                      {statement.saldoProveedor < 0 ? '+' : '-'}{money(Math.abs(statement.saldoProveedor))}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {statement.saldoProveedor < 0
                        ? 'Monto total pendiente de transferirte'
                        : 'Anticipo en mano por cubrir con entregas'}
                    </span>
                  </div>
                </div>

                {/* Botones de Acción: Descarga de PDF y Compartir */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleDownloadPdf}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                      border: 'none',
                      borderRadius: 12,
                      padding: '12px 18px',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                    }}
                  >
                    <span>📄</span> Descargar Comprobante (PDF)
                  </button>

                  <button
                    onClick={() => {
                      const saldoText = statement.saldoProveedor < 0
                        ? `Saldo a mi favor de *+${money(Math.abs(statement.saldoProveedor))}*`
                        : `Anticipo pendiente de *-${money(Math.abs(statement.saldoProveedor))}*`;
                      const text = `Hola Paco, te comparto mi resumen de cuenta:\n• Total Fabricado: *${money(statement.totalPurchasesCost)}*\n• Total Pagado: *${money(statement.totalPagado)}*\n• Balance Actual: ${saldoText}\n\nQuedo atento. Saludos, Andrés.`;
                      openWhatsAppMessage(text);
                    }}
                    style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid #22c55e',
                      borderRadius: 12,
                      padding: '12px 16px',
                      color: '#4ade80',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>📲</span> Enviar WhatsApp
                  </button>
                </div>

                {/* Ledger de Movimientos */}
                <div style={{ ...glass, padding: 20 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase' }}>
                      Movimientos ({filteredLedger.length})
                    </div>

                    {/* Filtros de Tipo */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(
                        [
                          ['all', 'Todos'],
                          ['pagos', '💰 Pagos'],
                          ['entregas', '🏭 Entregas'],
                        ] as const
                      ).map(([f, label]) => (
                        <button
                          key={f}
                          onClick={() => setLedgerFilter(f)}
                          style={{
                            background: ledgerFilter === f ? '#a78bfa' : 'rgba(255,255,255,0.08)',
                            color: ledgerFilter === f ? '#0f172a' : '#fff',
                            border: 'none',
                            borderRadius: 8,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Buscador de Movimientos */}
                  <input
                    type="text"
                    placeholder="Buscar movimiento o folio..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: '#fff',
                      fontSize: 12,
                      marginBottom: 14,
                      outline: 'none',
                    }}
                  />

                  {filteredLedger.map((row: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 14,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{row.concept}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                          {new Date(row.dateMillis).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {row.cargo > 0 && <div style={{ color: '#f87171', fontWeight: 800 }}>−{money(row.cargo)}</div>}
                        {row.abono > 0 && <div style={{ color: '#34d399', fontWeight: 800 }}>+{money(row.abono)}</div>}
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                          {money(row.balance)}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredLedger.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.4)' }}>
                      No se encontraron movimientos con este filtro.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB 3: HISTORIAL DE ENTREGAS ────────────────────────────────────── */}
        {tab === 'historial' && (
          <div style={{ ...glass, padding: 22 }}>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 800,
                textTransform: 'uppercase',
                marginBottom: 16,
              }}
            >
              Registro Reciente de Entregas ({historial.length})
            </div>

            {historial.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.4)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div>Aún no has registrado entregas recientemente.</div>
              </div>
            ) : (
              historial.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>OC {h.folio}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {h.productDescription}
                    </div>
                    {h.notes && (
                      <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 3 }}>
                        📝 {h.notes}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {h.date ? new Date(h.date).toLocaleString('es-MX') : 'Reciente'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399' }}>
                      {h.kilos.toLocaleString('es-MX')} kg
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background:
                          h.status === 'pending_approval'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)',
                        color: h.status === 'pending_approval' ? '#fbbf24' : '#34d399',
                      }}
                    >
                      {h.status === 'pending_approval' ? '⏳ Pendiente Aprobación' : '✓ Registrado'}
                    </span>
                    <button
                      onClick={() => handleDownloadDeliveryTicket(h)}
                      title="Descargar Remisión Oficial de esta entrega en PDF"
                      style={{
                        background: 'rgba(167, 139, 250, 0.15)',
                        border: '1px solid rgba(167, 139, 250, 0.3)',
                        borderRadius: 8,
                        padding: '4px 8px',
                        color: '#c4b5fd',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <span>📄</span> Remisión PDF
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
