import React, { useState, useEffect, useMemo } from 'react';
import { functions } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { httpsCallable } from 'firebase/functions';
import { money } from '../lib/format';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { openWhatsAppMessage } from '../lib/whatsappReminder';
import { useSystemSettings } from '../hooks/useSystemSettings';
// PinScreen y los estilos/keys glass/kpiCard/STORAGE_* vivian aqui mismo
// (~190 lineas de PinScreen + las constantes) y ahora estan en archivos
// separados: MaquiladorPortalPinScreen.tsx comparte MaquiladorPortal.shared.ts
// con este archivo para no duplicar `glass`/`kpiCard`/las llaves de
// localStorage.
import { PinScreen } from './MaquiladorPortalPinScreen';
import { glass, kpiCard, STORAGE_PIN_KEY, STORAGE_DELIVERIES_KEY } from './MaquiladorPortal.shared';
import { getStatementHtml, getDeliveryTicketHtml } from './MaquiladorPortalReports';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  enqueueOfflineDelivery,
  getPendingOfflineDeliveries,
  removeOfflineDelivery,
  updateOfflineDeliveryRetry,
  migrateLegacyLocalStorageQueue,
  type OfflineDeliveryItem,
} from '../lib/offlineMaquilaDb';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import { PulsingBadge } from '../components/ui/PulsingBadge';

/* ─── Portal Principal Maquilador ─────────────────────────────────────────── */
export default function MaquiladorPortal() {
  const toast = useToast();
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  const clientName = settings?.clientShortName || 'Providencia';
  const [pin, setPin] = useState('');
  const [auth, setAuth] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [kilos, setKilos] = useState('');
  const [docType, setDocType] = useState<'remision' | 'factura'>('remision');
  const [docFolio, setDocFolio] = useState('');
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

  // Cola offline persistente con IndexedDB
  const [offlineQueue, setOfflineQueue] = useState<OfflineDeliveryItem[]>([]);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  // Calculadora de bultos
  const [showBundleCalc, setShowBundleCalc] = useState(false);
  const [bundleCount, setBundleCount] = useState('');
  const [bundleWeight, setBundleWeight] = useState('25');

  // Estado de Red / Modo Taller
  const { isOnline } = useNetworkStatus();

  const maquilaServiceFn = useMemo(() => httpsCallable(functions, 'getActiveMaquilaOrders'), []);

  const refreshOfflineQueue = React.useCallback(async () => {
    try {
      const items = await getPendingOfflineDeliveries();
      setOfflineQueue(items);
    } catch (e) {
      console.warn('Error leyendo cola offline', e);
    }
  }, []);

  useEffect(() => {
    void migrateLegacyLocalStorageQueue().then(refreshOfflineQueue);
  }, [refreshOfflineQueue]);

  const syncOfflineQueue = React.useCallback(async () => {
    if (!pin || isSyncingQueue) return;
    try {
      const queue = await getPendingOfflineDeliveries();
      if (queue.length === 0) return;
      setIsSyncingQueue(true);
      toast(`Sincronizando ${queue.length} entrega(s) guardada(s) offline...`, 'info');

      let syncedCount = 0;
      for (const item of queue) {
        try {
          await maquilaServiceFn({
            action: 'registrarEntrega',
            pin,
            orderId: item.orderId,
            folio: item.folio,
            productDescription: item.productDescription,
            kilos: item.kilos,
            docType: item.docType || 'remision',
            docFolio: item.docFolio || null,
            notes: item.notes || null,
            status: item.status,
          });
          await removeOfflineDelivery(item.id);
          syncedCount++;
        } catch (itemErr: any) {
          console.warn(`Error sincronizando entrega ${item.id}:`, itemErr);
          await updateOfflineDeliveryRetry(item.id, itemErr.message || 'Error de red');
        }
      }

      await refreshOfflineQueue();
      if (syncedCount > 0) {
        toast(`✅ ${syncedCount} entrega(s) sincronizada(s) con éxito en la nube`, 'ok');
      }
    } catch (e) {
      console.warn('Error sincronizando entregas offline', e);
    } finally {
      setIsSyncingQueue(false);
    }
  }, [pin, isSyncingQueue, maquilaServiceFn, toast, refreshOfflineQueue]);

  useEffect(() => {
    if (isOnline && pin) {
      void syncOfflineQueue();
    }
  }, [isOnline, pin, syncOfflineQueue]);

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
    // Ya no hace falta signInAnonymously() aqui (v8.8.7 lo agrego para
    // maquilaDeliveries/expenses): desde que registrar una entrega pasa por
    // registrarEntregaMaquila (Cloud Function que valida el PIN en el
    // servidor), este portal no necesita ninguna sesion de Firebase Auth --
    // el acceso lo controla el PIN, validado en el backend.
    syncOfflineQueue();
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_PIN_KEY);
    setAuth(false);
    setPin('');
    setActiveOrders([]);
  };

  const recargar = async () => {
    setLoadingOrders(true);
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ pin });
      setActiveOrders((res.data as any[]) || []);
      toast('Órdenes actualizadas', 'ok');
    } catch {
      toast('Error al actualizar órdenes', 'bad');
    } finally {
      setLoadingOrders(false);
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

    // Si no hay conexión a internet, guardar en cola offline estructurada en IndexedDB
    if (!navigator.onLine) {
      try {
        const savedOffline = await enqueueOfflineDelivery({
          orderId: selectedOrder.orderId,
          folio: selectedOrder.folio,
          productDescription: selectedOrder.productDescription,
          kilos: numKilos,
          docType,
          docFolio: docFolio.trim() || null,
          notes: deliveryNotes.trim() || null,
          status: requiresApproval ? 'pending_approval' : 'pending',
        });

        await refreshOfflineQueue();

        const offlineHistoryEntry = {
          id: savedOffline.id,
          folio: selectedOrder.folio,
          productDescription: selectedOrder.productDescription,
          kilos: numKilos,
          docType,
          docFolio: docFolio.trim(),
          notes: deliveryNotes.trim(),
          date: new Date().toISOString(),
          status: requiresApproval ? 'pending_approval' : 'pending',
          isOfflinePending: true,
        };

        const updatedHistory = [offlineHistoryEntry, ...historial].slice(0, 30);
        setHistorial(updatedHistory);
        localStorage.setItem(STORAGE_DELIVERIES_KEY, JSON.stringify(updatedHistory));

        setLastDeliveredNotice({
          folio: selectedOrder.folio,
          product: selectedOrder.productDescription,
          kilos: numKilos,
          docType,
          docFolio: docFolio.trim(),
          notes: deliveryNotes.trim(),
        });

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#a78bfa', '#34d399', '#facc15'],
        });

        toast(`💾 Guardado localmente en IndexedDB (Sin Conexión). Se sincronizará automáticamente al detectar red.`, 'ok');
        setKilos('');
        setDocFolio('');
        setDeliveryNotes('');
        setOrderId('');
      } catch (err: any) {
        toast(`Error al guardar offline: ${err.message}`, 'bad');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const res = await maquilaServiceFn({
        action: 'registrarEntrega',
        pin,
        orderId: selectedOrder.orderId,
        folio: selectedOrder.folio,
        productDescription: selectedOrder.productDescription,
        kilos: numKilos,
        docType,
        docFolio: docFolio.trim() || null,
        notes: deliveryNotes.trim() || null,
        status: requiresApproval ? 'pending_approval' : 'pending',
      });
      const deliveryId = (res.data as any)?.id || `del_${Date.now()}`;

      // Disparar Confetti
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#a78bfa', '#34d399', '#38bdf8', '#facc15'],
      });

      const newEntry = {
        id: deliveryId,
        folio: selectedOrder.folio,
        productDescription: selectedOrder.productDescription,
        kilos: numKilos,
        docType,
        docFolio: docFolio.trim(),
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
        docType,
        docFolio: docFolio.trim(),
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
      console.warn('Fallo registro online, encolando en IndexedDB como resiliencia:', err);
      try {
        await enqueueOfflineDelivery({
          orderId: selectedOrder.orderId,
          folio: selectedOrder.folio,
          productDescription: selectedOrder.productDescription,
          kilos: numKilos,
          docType,
          docFolio: docFolio.trim() || null,
          notes: deliveryNotes.trim() || null,
          status: requiresApproval ? 'pending_approval' : 'pending',
        });
        await refreshOfflineQueue();
        toast('⚠️ Error de red temporal: la entrega quedó asegurada en la cola offline de tu dispositivo y se enviará sola.', 'info');
        setKilos('');
        setDocFolio('');
        setDeliveryNotes('');
        setOrderId('');
      } catch {
        toast('Error al guardar entrega: ' + err.message, 'bad');
      }
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

      const html = getStatementHtml(statement, provName, clientName);

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
      const html = getDeliveryTicketHtml(h, provName, clientName);

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
        const d = (o.department || (o.client?.includes('GT') || (o.folio || '').startsWith('GT') ? 'GT' : 'TH')).toUpperCase();
        if (d !== deptFilter) return false;
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

  const totalAndresPendingKilos = useMemo(() => {
    return activeOrders.reduce((acc: number, o: any) => acc + (o.pendingKilos || 0), 0);
  }, [activeOrders]);

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
                <span>Portal Proveedor / Báscula</span>
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
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 1 }}>{provName} · Taller {clientName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {offlineQueue.length > 0 && (
              <button
                onClick={() => setShowOfflineModal(true)}
                title="Ver y gestionar entregas guardadas offline"
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.35) 100%)',
                  border: '1px solid #f59e0b',
                  borderRadius: 12,
                  padding: '8px 12px',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 0 15px rgba(245, 158, 11, 0.25)',
                }}
              >
                <span>📦</span>
                <span>{offlineQueue.length}</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>Offline</span>
              </button>
            )}
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

        {/* Banner de Estado de Producción y Entregas de Andrés */}
        {totalAndresPendingKilos <= 0.01 ? (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.25) 100%)',
              border: '1px solid #10b981',
              borderRadius: 14,
              padding: '14px 18px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>🟢</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#34d399' }}>
                ¡TALLER AL DÍA! CERO PEDIDOS PENDIENTES
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                Has entregado el 100% de las bolsas solicitadas. No tienes pedidos pendientes de fabricación ni entrega.
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.2) 100%)',
              border: '1px solid #f59e0b',
              borderRadius: 14,
              padding: '14px 18px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>🟡</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fbbf24' }}>
                PRODUCCIÓN EN CURSO: {totalAndresPendingKilos.toLocaleString('es-MX')} kg PENDIENTES
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                Tienes {activeOrders.filter((o: any) => o.pendingKilos > 0).length} órdenes con kilos pendientes por fabricar y entregar a Providencia.
              </div>
            </div>
          </div>
        )}

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
                    const subject = encodeURIComponent(`Entrega Maquila ${lastDeliveredNotice.kilos} kg - OC ${lastDeliveredNotice.folio}`);
                    const body = encodeURIComponent(`Hola Paco,\n\nTe confirmo que acabo de registrar una entrega de ${lastDeliveredNotice.kilos} kg para la OC ${lastDeliveredNotice.folio} (${lastDeliveredNotice.product}) en el sistema.\n${lastDeliveredNotice.notes ? `Nota: ${lastDeliveredNotice.notes}\n` : ''}\nQuedo al pendiente.\nSaludos, ${provName}.`);
                    window.open(`mailto:paco@cobertores.com?subject=${subject}&body=${body}`, '_blank');
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
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
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                  }}
                >
                  <span>✉️</span> Enviar Correo
                </button>
                <button
                  onClick={() => {
                    const text = `Hola Paco, te confirmo que acabo de registrar una entrega de *${lastDeliveredNotice.kilos} kg* para la *OC ${lastDeliveredNotice.folio}* (${lastDeliveredNotice.product}) en el sistema.${lastDeliveredNotice.notes ? `\nNota: ${lastDeliveredNotice.notes}` : ''}\nQuedo al pendiente. Saludos, ${provName}.`;
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
                  <span>📲</span> WhatsApp
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

              {loadingOrders ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CardSkeleton rows={2} />
                  <CardSkeleton rows={2} />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div style={{ ...glass, padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
                  <div>No hay órdenes pendientes con este filtro.</div>
                </div>
              ) : (
                filteredOrders.map((o) => {
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 900, fontSize: 17, color: sel ? '#e9d5ff' : '#fff' }}>
                              OC {o.folio}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: o.department === 'GT' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(167, 139, 250, 0.25)',
                                color: o.department === 'GT' ? '#34d399' : '#c084fc',
                                border: `1px solid ${o.department === 'GT' ? '#10b981' : '#a78bfa'}`,
                              }}
                            >
                              🏢 {o.department || 'TH'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                            {o.productDescription}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <PulsingBadge
                            label={`${o.pendingKilos.toLocaleString('es-MX')} kg`}
                            tone={o.pendingKilos > 0 ? 'amber' : 'green'}
                            pulse={o.pendingKilos > 0}
                          />
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
              }))}
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

                {/* Tipo de Documento: Remisión vs Factura */}
                <div>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    Documento con el que entregas:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => setDocType('remision')}
                      style={{
                        padding: '10px',
                        borderRadius: 10,
                        border: docType === 'remision' ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.12)',
                        background: docType === 'remision' ? 'rgba(167, 139, 250, 0.25)' : 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      📋 Remisión / Báscula
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocType('factura')}
                      style={{
                        padding: '10px',
                        borderRadius: 10,
                        border: docType === 'factura' ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                        background: docType === 'factura' ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255,255,255,0.06)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      📄 Factura
                    </button>
                  </div>
                  <input
                    type="text"
                    value={docFolio}
                    onChange={(e) => setDocFolio(e.target.value)}
                    placeholder={docType === 'factura' ? 'Folio o Número de Factura (ej. 1420)' : 'Folio de Remisión o Ticket (ej. REM-890)'}
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

                {/* Input de Nota / Chofer Opcional */}
                <div>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>
                    Nota u observaciones / Chofer (Opcional):
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
                        ? `Saldo a mi favor de +${money(Math.abs(statement.saldoProveedor))}`
                        : `Anticipo pendiente de -${money(Math.abs(statement.saldoProveedor))}`;
                      const subject = encodeURIComponent(`Resumen de Estado de Cuenta - ${provName}`);
                      const body = encodeURIComponent(`Hola Paco,\n\nTe comparto mi resumen de estado de cuenta:\n• Total Fabricado: ${money(statement.totalPurchasesCost)} (${statement.totalReceivedKilos?.toLocaleString?.('es-MX') || 0} kg)\n• Total Pagado: ${money(statement.totalPagado)}\n• Balance Actual: ${saldoText}\n\nQuedo atento a tus comentarios.\nSaludos cordiales,\n${provName}.`);
                      window.open(`mailto:paco@cobertores.com?subject=${subject}&body=${body}`, '_blank');
                    }}
                    style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid #3b82f6',
                      borderRadius: 12,
                      padding: '12px 16px',
                      color: '#93c5fd',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>✉️</span> Enviar Correo
                  </button>

                  <button
                    onClick={() => {
                      const saldoText = statement.saldoProveedor < 0
                        ? `Saldo a mi favor de *+${money(Math.abs(statement.saldoProveedor))}*`
                        : `Anticipo pendiente de *-${money(Math.abs(statement.saldoProveedor))}*`;
                      const text = `Hola Paco, te comparto mi resumen de cuenta:\n• Total Fabricado: *${money(statement.totalPurchasesCost)}*\n• Total Pagado: *${money(statement.totalPagado)}*\n• Balance Actual: ${saldoText}\n\nQuedo atento. Saludos, ${provName}.`;
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
                    <span>📲</span> WhatsApp
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

        {/* Modal de Cola Offline Persistente */}
        <AnimatePresence>
          {showOfflineModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setShowOfflineModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  ...glass,
                  maxWidth: 520,
                  width: '100%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                  padding: 24,
                  borderRadius: 20,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 24 }}>📦</span>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>Entregas Guardadas Offline</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                        Persistidas de forma segura en tu dispositivo (IndexedDB)
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOfflineModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: 20,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <button
                    onClick={() => void syncOfflineQueue()}
                    disabled={isSyncingQueue || !isOnline}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: isOnline ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.1)',
                      color: isOnline ? '#fff' : 'rgba(255,255,255,0.4)',
                      border: 'none',
                      borderRadius: 12,
                      fontWeight: 700,
                      cursor: isOnline && !isSyncingQueue ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <span>{isSyncingQueue ? '⏳' : '🔄'}</span>
                    <span>{isSyncingQueue ? 'Sincronizando...' : isOnline ? 'Sincronizar a la Nube Ahora' : 'Sin Conexión a Internet'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {offlineQueue.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>OC {item.folio}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                          {item.productDescription}
                        </div>
                        {item.docFolio && (
                          <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 2 }}>
                            Folio {item.docType}: {item.docFolio}
                          </div>
                        )}
                        {item.lastError && (
                          <div style={{ fontSize: 10, color: '#f87171', marginTop: 3 }}>
                            ⚠️ {item.lastError} (Reintentos: {item.retryCount || 0})
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                          Guardado: {new Date(item.createdAt).toLocaleTimeString('es-MX')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24' }}>
                          {item.kilos.toLocaleString('es-MX')} kg
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'rgba(245, 158, 11, 0.2)',
                            color: '#fbbf24',
                            marginTop: 4,
                            display: 'inline-block',
                          }}
                        >
                          En cola local
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
