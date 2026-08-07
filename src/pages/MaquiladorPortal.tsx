import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, PATHS, functions } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { httpsCallable } from 'firebase/functions';
import { money } from '../lib/format';

/* ─── Estilos base inline (sin dependencias externas) ──────────────────────── */
const glass = {
  background: 'rgba(255,255,255,0.07)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 20,
};

const kpiCard = (accent: string) => ({
  ...glass,
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  borderLeft: `3px solid ${accent}`,
});

/* ─── Pantalla de PIN numérico ──────────────────────────────────────────────── */
function PinScreen({ onSuccess }: { onSuccess: (pin: string, orders: any[]) => void }) {
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const toast = useToast();

  const del = () => setDigits(prev => prev.slice(0, -1));

  const tryLogin = async (pin: string) => {
    if (pin.length < 4) return;
    setLoading(true);
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ pin });
      onSuccess(pin, (res.data as any[]) || []);
    } catch (err: any) {
      setShake(true);
      setDigits('');
      setTimeout(() => setShake(false), 600);
      if (err?.code === 'functions/permission-denied') {
        toast('PIN incorrecto', 'bad');
      } else {
        toast('Error de conexión. Intenta de nuevo.', 'bad');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (d: string) => {
    const next = digits + d;
    if (next.length <= 4) {
      setDigits(next);
      if (next.length >= 4) tryLogin(next);
    }
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        {/* Logo / Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🏭</div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>Portal Maquilador</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: 6, fontSize: 14 }}>Elemental Denim · Providencia</p>
        </div>

        {/* Dots de PIN */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%',
              background: i < digits.length ? '#a78bfa' : 'rgba(255,255,255,0.2)',
              transition: 'background 0.15s',
              transform: shake ? 'translateX(0)' : undefined,
              animation: shake ? 'shake 0.5s ease' : undefined,
            }} />
          ))}
        </div>

        {/* Teclado numérico */}
        <div style={{
          ...glass,
          padding: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          width: '100%',
        }}>
          {KEYS.map((k, i) => (
            <button
              key={i}
              onClick={() => {
                if (k === '⌫') del();
                else if (k !== '') handleDigit(k);
              }}
              disabled={loading || k === ''}
              style={{
                height: 64, fontSize: k === '⌫' ? 22 : 28,
                fontWeight: 700,
                background: k === '' ? 'transparent' : k === '⌫' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)',
                border: k === '' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, color: '#fff', cursor: k === '' ? 'default' : 'pointer',
                transition: 'transform 0.1s, background 0.1s',
                opacity: loading ? 0.5 : 1,
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {loading && k === '0' ? '⏳' : k}
            </button>
          ))}
        </div>

        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' }}>
          Ingresa tu PIN para registrar entregas y ver tu saldo
        </p>
      </div>
    </div>
  );
}

/* ─── Portal principal (después del PIN) ────────────────────────────────────── */
export default function MaquiladorPortal() {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [auth, setAuth] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState('');
  const [kilos, setKilos] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'entrega' | 'estado' | 'historial'>('entrega');
  const [statement, setStatement] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);

  const handleSuccess = (p: string, orders: any[]) => {
    setPin(p);
    setActiveOrders(orders);
    setAuth(true);
  };

  const recargar = async () => {
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ pin });
      setActiveOrders((res.data as any[]) || []);
    } catch { /* silencioso */ }
  };

  const loadStatement = async () => {
    setLoadingStatement(true);
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ action: 'ledger', pin });
      setStatement(res.data);
    } catch (err: any) {
      toast('Error al cargar estado de cuenta', 'bad');
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleTabChange = (t: typeof tab) => {
    setTab(t);
    if (t === 'estado' && !statement) loadStatement();
  };

  const selectedOrder = activeOrders.find(o => o.orderId === orderId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return toast('Selecciona una orden de compra', 'bad');
    if (!kilos || isNaN(Number(kilos)) || Number(kilos) <= 0) return toast('Ingresa kilos válidos', 'bad');
    if (selectedOrder && Number(kilos) > selectedOrder.pendingKilos)
      return toast(`Máximo ${selectedOrder.pendingKilos} kg pendientes`, 'bad');

    setSaving(true);
    try {
      const deliveryRef = await addDoc(collection(db, PATHS.maquilaDeliveries), {
        date: serverTimestamp(),
        orderId: selectedOrder.orderId,
        folio: selectedOrder.folio,
        productDescription: selectedOrder.productDescription,
        kilos: Number(kilos),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setHistorial(h => [{
        id: deliveryRef.id,
        folio: selectedOrder.folio,
        productDescription: selectedOrder.productDescription,
        kilos: Number(kilos),
        date: new Date(),
      }, ...h]);
      toast(`✅ Entrega de ${kilos} kg registrada exitosamente`, 'ok');
      setKilos('');
      setOrderId('');
      recargar();
    } catch (err: any) {
      toast('Error al guardar: ' + err.message, 'bad');
    } finally {
      setSaving(false);
    }
  };

  if (!auth) return <PinScreen onSuccess={handleSuccess} />;

  /* ─── Página principal ──────────────────────────────────────────────────── */
  const BG = 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)';
  const TAB_ACTIVE = { background: 'rgba(167,139,250,0.25)', color: '#a78bfa', borderBottom: '2px solid #a78bfa' };
  const TAB_IDLE   = { background: 'transparent', color: 'rgba(255,255,255,0.5)', borderBottom: '2px solid transparent' };

  return (
    <div style={{
      minHeight: '100dvh', background: BG, padding: '16px 16px 80px',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              🏭 Portal Maquilador
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>Andrés · Elemental Denim</div>
          </div>
          <button
            onClick={recargar}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            🔄 Actualizar
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
          {([['entrega','🏭 Entrega'],['estado','💰 Mi Cuenta'],['historial','📋 Historial']] as const).map(([k, l]) => (
            <button key={k} onClick={() => handleTabChange(k)}
              style={{ flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s', ...(tab === k ? TAB_ACTIVE : TAB_IDLE) }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── TAB ENTREGA ────────────────────────────────────────────────────── */}
        {tab === 'entrega' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* OC Cards — seleccionables */}
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Órdenes Activas — toca para seleccionar
              </div>
              {activeOrders.length === 0 && (
                <div style={{ ...glass, padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                  No hay órdenes activas por entregar 🎉
                </div>
              )}
              {activeOrders.map(o => {
                const sel = orderId === o.orderId;
                const pct = Math.round(((o.totalKilos - o.pendingKilos) / Math.max(o.totalKilos, 1)) * 100);
                return (
                  <button key={o.orderId} onClick={() => setOrderId(sel ? '' : o.orderId)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 10,
                      padding: '16px 20px', borderRadius: 16,
                      background: sel ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.06)',
                      border: sel ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', transition: 'all 0.18s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>OC {o.folio}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{o.productDescription}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>{o.pendingKilos} kg pendientes</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>de {o.totalKilos} kg totales</div>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.1)' }}>
                      <div style={{ height: '100%', borderRadius: 99, background: '#a78bfa', width: `${pct}%`, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{pct}% entregado</div>
                  </button>
                );
              })}
            </div>

            {/* Formulario de kilos */}
            {selectedOrder && (
              <form onSubmit={handleSubmit} style={{ ...glass, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                  ✅ Registrar entrega para <strong style={{ color: '#a78bfa' }}>OC {selectedOrder.folio}</strong>
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 8 }}>¿Cuántos kilos entregás?</label>
                  <input
                    type="number" step="0.01" inputMode="decimal"
                    value={kilos}
                    onChange={e => setKilos(e.target.value)}
                    placeholder={`Máx. ${selectedOrder.pendingKilos} kg`}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '16px', fontSize: 28, fontWeight: 800, textAlign: 'center',
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 12, color: '#fff', outline: 'none',
                    }}
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={saving || !kilos}
                  style={{
                    padding: '18px', fontSize: 18, fontWeight: 800, borderRadius: 14,
                    background: saving || !kilos ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                    border: 'none', color: '#fff', cursor: saving || !kilos ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {saving ? '⏳ Guardando…' : '✅ Confirmar Entrega'}
                </button>
              </form>
            )}

            {/* Entregas de esta sesión */}
            {historial.length > 0 && (
              <div style={{ ...glass, padding: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                  Entregado en esta sesión
                </div>
                {historial.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 14 }}>OC {h.folio}</span>
                    <span style={{ fontSize: 14, color: '#4ade80', fontWeight: 700 }}>{h.kilos} kg ✓</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB ESTADO DE CUENTA ────────────────────────────────────────────── */}
        {tab === 'estado' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loadingStatement ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>⏳ Cargando tu cuenta…</div>
            ) : !statement ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <button onClick={loadStatement}
                  style={{ padding: '14px 28px', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                  Ver Mi Estado de Cuenta
                </button>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={kpiCard('#a78bfa')}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Total Fabricado</span>
                    <span style={{ fontSize: 22, fontWeight: 800 }}>{money(statement.totalPurchasesCost)}</span>
                  </div>
                  <div style={kpiCard('#4ade80')}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>Total Pagado</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{money(statement.totalPagado)}</span>
                  </div>
                  <div style={{ ...kpiCard(statement.saldoProveedor < 0 ? '#4ade80' : '#fbbf24'), gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {statement.saldoProveedor < 0 ? '✅ Saldo a tu Favor' : '⚠️ Anticipo Pendiente'}
                    </span>
                    <span style={{ fontSize: 32, fontWeight: 900, color: statement.saldoProveedor < 0 ? '#4ade80' : '#fbbf24' }}>
                      {statement.saldoProveedor < 0 ? '+' : '-'}{money(Math.abs(statement.saldoProveedor))}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                      {statement.saldoProveedor < 0
                        ? 'Pendiente de pagarte'
                        : 'Anticipo que recibiste y aún no has entregado'}
                    </span>
                  </div>
                </div>

                {/* Ledger */}
                <div style={{ ...glass, padding: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                    Movimientos Detallados
                  </div>
                  {statement.ledger.map((row: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: 14,
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{row.concept}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                          {new Date(row.dateMillis).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {row.cargo > 0 && <div style={{ color: '#f87171', fontWeight: 700 }}>−{money(row.cargo)}</div>}
                        {row.abono > 0 && <div style={{ color: '#4ade80', fontWeight: 700 }}>+{money(row.abono)}</div>}
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{money(row.balance)}</div>
                      </div>
                    </div>
                  ))}
                  {statement.ledger.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)' }}>Sin movimientos</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB HISTORIAL ────────────────────────────────────────────────────── */}
        {tab === 'historial' && (
          <div style={{ ...glass, padding: 20 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 16 }}>
              Entregas Registradas Esta Sesión
            </div>
            {historial.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                <div>Aún no has registrado entregas en esta sesión</div>
              </div>
            ) : historial.map((h, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <div style={{ fontWeight: 700 }}>OC {h.folio}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{h.productDescription}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                    {h.date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#4ade80' }}>
                  {h.kilos} kg
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
