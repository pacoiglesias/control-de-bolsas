import React, { useState, useEffect, useMemo } from 'react';
import { functions } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { httpsCallable } from 'firebase/functions';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { openWhatsAppMessage } from '../lib/whatsappReminder';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { PinScreen } from './MaquiladorPortalPinScreen';
import { glass, STORAGE_PIN_KEY, STORAGE_DELIVERIES_KEY } from './MaquiladorPortal.shared';
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
import { PulsingBadge } from '../components/ui/PulsingBadge';
import { triggerHaptic } from '../lib/hapticEngine';

// Subcomponentes Modulares del Portal
import MaquiladorPortalEntregaTab from './MaquiladorPortalEntregaTab';
import MaquiladorPortalEstadoTab from './MaquiladorPortalEstadoTab';
import MaquiladorPortalHistorialTab from './MaquiladorPortalHistorialTab';
import MaquiladorPortalOfflineModal from './MaquiladorPortalOfflineModal';

const TAB_ACTIVE: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.3) 0%, rgba(124, 58, 237, 0.4) 100%)',
  color: '#fff',
  border: '1px solid rgba(167, 139, 250, 0.5)',
};

const TAB_IDLE: React.CSSProperties = {
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  border: '1px solid transparent',
};

export default function MaquiladorPortal() {
  const toast = useToast();
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  const clientName = settings?.clientShortName || 'Providencia';
  const [pin, setPin] = useState('');
  const [auth, setAuth] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [, setLoadingOrders] = useState(false);
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

  // Estado de Red
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

  // Cargar historial guardado (filtrando folios obsoletos de prueba como 120267114014)
  const [historial, setHistorial] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DELIVERIES_KEY);
      const list = saved ? JSON.parse(saved) : [];
      if (Array.isArray(list)) {
        const filtered = list.filter((h) => h?.folio !== '120267114014' && h?.orderId !== 'oc-120267114014');
        if (filtered.length !== list.length) {
          localStorage.setItem(STORAGE_DELIVERIES_KEY, JSON.stringify(filtered));
        }
        return filtered;
      }
      return [];
    } catch {
      return [];
    }
  });

  const handleDeleteHistoryItem = (index: number) => {
    triggerHaptic('medium');
    const updated = historial.filter((_, i) => i !== index);
    setHistorial(updated);
    try {
      localStorage.setItem(STORAGE_DELIVERIES_KEY, JSON.stringify(updated));
      toast('Entrega eliminada del historial', 'info');
    } catch {}
  };

  const handleClearHistory = () => {
    triggerHaptic('warning');
    setHistorial([]);
    try {
      localStorage.removeItem(STORAGE_DELIVERIES_KEY);
      toast('Historial de entregas limpiado', 'ok');
    } catch {}
  };

  const handleSuccess = (p: string, orders: any[]) => {
    setPin(p);
    setActiveOrders(orders);
    setAuth(true);
    syncOfflineQueue();
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_PIN_KEY);
    setPin('');
    setAuth(false);
  };

  const selectedOrder = useMemo(() => activeOrders.find((o) => o.id === orderId), [activeOrders, orderId]);

  const numKilos = parseFloat(kilos) || 0;
  const isOverDelivery = selectedOrder && numKilos > selectedOrder.pendingKilos;

  const filteredOrders = useMemo(() => {
    let list = activeOrders;
    if (deptFilter !== 'ALL') {
      list = list.filter((o) => (o.department || '').toUpperCase().includes(deptFilter));
    }
    if (searchOc.trim()) {
      const q = searchOc.toLowerCase().trim();
      list = list.filter(
        (o) =>
          (o.folio || '').toLowerCase().includes(q) ||
          (o.productDescription || '').toLowerCase().includes(q) ||
          (o.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeOrders, deptFilter, searchOc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !kilos || numKilos <= 0) return;

    setSaving(true);
    const order = activeOrders.find((o) => o.id === orderId);

    const deliveryPayload = {
      action: 'registrarEntrega',
      pin,
      orderId,
      folio: order?.folio || orderId,
      productDescription: order?.productDescription || '',
      kilos: numKilos,
      docType,
      docFolio: docFolio.trim() || null,
      notes: deliveryNotes.trim() || null,
      status: isOverDelivery ? 'pending_approval' : 'approved',
    };

    try {
      const res: any = await maquilaServiceFn(deliveryPayload);
      if (res.data.success) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        toast(`✅ Entrega de ${numKilos} kg registrada correctamente.`, 'ok');

        const newDelivery = {
          date: new Date().toISOString(),
          orderId,
          folio: order?.folio,
          productDescription: order?.productDescription,
          kilos: numKilos,
          status: isOverDelivery ? 'pending_approval' : 'approved',
          docType,
          docFolio: docFolio.trim() || null,
          notes: deliveryNotes.trim() || null,
        };

        setLastDeliveredNotice({
          kilos: numKilos,
          folio: order?.folio,
          product: order?.productDescription,
          notes: deliveryNotes.trim() || null,
        });

        const updated = [newDelivery, ...historial].slice(0, 50);
        setHistorial(updated);
        localStorage.setItem(STORAGE_DELIVERIES_KEY, JSON.stringify(updated));

        setKilos('');
        setDocFolio('');
        setDeliveryNotes('');
        recargar();
      } else {
        toast(`Error: ${res.data.error}`, 'bad');
      }
    } catch (err: any) {
      console.warn('Error en red/servicio, guardando offline...', err);
      try {
        await enqueueOfflineDelivery({
          orderId,
          folio: order?.folio || orderId,
          productDescription: order?.productDescription || '',
          kilos: numKilos,
          docType,
          docFolio: docFolio.trim() || null,
          notes: deliveryNotes.trim() || null,
          status: isOverDelivery ? 'pending_approval' : 'approved',
        });
        await refreshOfflineQueue();

        toast(`📦 Sin conexión. Entrega guardada en tu dispositivo (Offline).`, 'info');

        const newDelivery = {
          date: new Date().toISOString(),
          orderId,
          folio: order?.folio,
          productDescription: order?.productDescription,
          kilos: numKilos,
          status: 'pending_offline',
          docType,
          docFolio: docFolio.trim() || null,
          notes: deliveryNotes.trim() || null,
        };
        const updated = [newDelivery, ...historial].slice(0, 50);
        setHistorial(updated);
        localStorage.setItem(STORAGE_DELIVERIES_KEY, JSON.stringify(updated));

        setKilos('');
        setDocFolio('');
        setDeliveryNotes('');
      } catch {
        toast(`Error al registrar entrega: ${err.message}`, 'bad');
      }
    } finally {
      setSaving(false);
    }
  };

  const recargar = async () => {
    setLoadingOrders(true);
    try {
      const res: any = await maquilaServiceFn({ pin });
      if (res.data.success) {
        setActiveOrders(res.data.orders);
      }
    } catch {
      toast('Error al actualizar órdenes', 'bad');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadStatement = async () => {
    setLoadingStatement(true);
    try {
      const res: any = await maquilaServiceFn({ action: 'ledger', pin });
      const data = res?.data;
      const stmt = data?.statement || (data?.saldoProveedor !== undefined ? data : null);
      if (stmt) {
        setStatement(stmt);
      } else {
        toast(`Error: ${data?.error || 'No se pudo obtener el estado de cuenta'}`, 'bad');
      }
    } catch (e: any) {
      toast(`Error al consultar estado de cuenta: ${e.message || e}`, 'bad');
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleTabChange = (t: 'entrega' | 'estado' | 'historial') => {
    triggerHaptic('light');
    setTab(t);
    if (t === 'estado' && !statement) {
      loadStatement();
    }
  };

  const handleDownloadPdf = () => {
    if (!statement) return;
    triggerHaptic('success');
    const html = getStatementHtml(statement, provName, clientName);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const handleDownloadDeliveryTicket = (h: any) => {
    triggerHaptic('success');
    const html = getDeliveryTicketHtml(h, provName, clientName);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const filteredLedger = useMemo(() => {
    if (!statement?.ledger) return [];
    let list = statement.ledger;
    if (ledgerFilter === 'pagos') {
      list = list.filter((r: any) => r.cargo > 0);
    } else if (ledgerFilter === 'entregas') {
      list = list.filter((r: any) => r.abono > 0);
    }
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase().trim();
      list = list.filter((r: any) => (r.concept || '').toLowerCase().includes(q));
    }
    return list;
  }, [statement, ledgerFilter, ledgerSearch]);

  const totalAndresPendingKilos = useMemo(() => {
    return activeOrders.reduce((acc, o) => acc + (o.pendingKilos || 0), 0);
  }, [activeOrders]);

  if (!auth) {
    return <PinScreen onSuccess={handleSuccess} />;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #090d16 0%, #111827 50%, #0f172a 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px 12px 60px',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Cabecera del Portal */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            ...glass,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>🏭</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#a78bfa',
                    letterSpacing: 1,
                  }}
                >
                  Portal Maquilador
                </span>
                <PulsingBadge tone={isOnline ? 'green' : 'amber'} label={isOnline ? 'Online' : 'Offline'} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 1 }}>
                {provName} · Taller {clientName}
              </div>
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
                Tienes {activeOrders.filter((o: any) => o.pendingKilos > 0).length} órdenes con kilos pendientes por
                fabricar y entregar a Providencia.
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
                    const text = `Hola Paco, te confirmo que acabo de registrar una entrega de *${
                      lastDeliveredNotice.kilos
                    } kg* para la *OC ${lastDeliveredNotice.folio}* (${lastDeliveredNotice.product}) en el sistema.${
                      lastDeliveredNotice.notes ? `\nNota: ${lastDeliveredNotice.notes}` : ''
                    }\nQuedo al pendiente. Saludos, ${provName}.`;
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
          <MaquiladorPortalEntregaTab
            deptFilter={deptFilter}
            setDeptFilter={setDeptFilter}
            searchOc={searchOc}
            setSearchOc={setSearchOc}
            filteredOrders={filteredOrders}
            orderId={orderId}
            setOrderId={setOrderId}
            kilos={kilos}
            setKilos={setKilos}
            selectedOrder={selectedOrder}
            showBundleCalc={showBundleCalc}
            setShowBundleCalc={setShowBundleCalc}
            bundleCount={bundleCount}
            setBundleCount={setBundleCount}
            bundleWeight={bundleWeight}
            setBundleWeight={setBundleWeight}
            isOverDelivery={isOverDelivery}
            numKilos={numKilos}
            docType={docType}
            setDocType={setDocType}
            docFolio={docFolio}
            setDocFolio={setDocFolio}
            deliveryNotes={deliveryNotes}
            setDeliveryNotes={setDeliveryNotes}
            saving={saving}
            handleSubmit={handleSubmit}
          />
        )}

        {/* ── TAB 2: MI ESTADO DE CUENTA ──────────────────────────────────────── */}
        {tab === 'estado' && (
          <MaquiladorPortalEstadoTab
            loadingStatement={loadingStatement}
            statement={statement}
            loadStatement={loadStatement}
            provName={provName}
            handleDownloadPdf={handleDownloadPdf}
            filteredLedger={filteredLedger}
            ledgerFilter={ledgerFilter}
            setLedgerFilter={setLedgerFilter}
            ledgerSearch={ledgerSearch}
            setLedgerSearch={setLedgerSearch}
          />
        )}

        {/* ── TAB 3: HISTORIAL DE ENTREGAS ────────────────────────────────────── */}
        {tab === 'historial' && (
          <MaquiladorPortalHistorialTab
            historial={historial}
            handleDownloadDeliveryTicket={handleDownloadDeliveryTicket}
            onDeleteDelivery={handleDeleteHistoryItem}
            onClearHistorial={handleClearHistory}
          />
        )}

        {/* Modal de Cola Offline Persistente */}
        <MaquiladorPortalOfflineModal
          showOfflineModal={showOfflineModal}
          setShowOfflineModal={setShowOfflineModal}
          syncOfflineQueue={syncOfflineQueue}
          isSyncingQueue={isSyncingQueue}
          isOnline={isOnline}
          offlineQueue={offlineQueue}
        />
      </div>
    </div>
  );
}
