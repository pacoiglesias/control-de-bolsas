import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, PATHS, functions } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { Field, Spinner } from '../components/ui';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { httpsCallable } from 'firebase/functions';
import { money } from '../lib/format';

export default function MaquiladorPortal() {
  const { settings, loading: loadingSettings } = useSystemSettings();
  const toast = useToast();
  
  const [pin, setPin] = useState('');
  const [auth, setAuth] = useState(false);
  
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [orderId, setOrderId] = useState('');
  const [kilos, setKilos] = useState('');
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<'entrega' | 'estado'>('entrega');
  const [statement, setStatement] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const PIN_SECRETO = settings?.maquilaPin || '2468';

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const getActiveMaquilaOrders = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await getActiveMaquilaOrders();
      setActiveOrders((res.data as any[]) || []);
    } catch (err) {
      console.error(err);
      toast('Error al cargar órdenes', 'bad');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === PIN_SECRETO) {
      setAuth(true);
      loadOrders();
    } else {
      toast('PIN incorrecto', 'bad');
    }
  };

  const loadStatement = async () => {
    setLoadingStatement(true);
    try {
      const fn = httpsCallable(functions, 'getActiveMaquilaOrders');
      const res = await fn({ action: 'ledger', pin });
      setStatement(res.data);
    } catch (err: any) {
      console.error(err);
      toast('Error al cargar estado de cuenta: ' + err.message, 'bad');
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleTabChange = (t: 'entrega' | 'estado') => {
    setTab(t);
    if (t === 'estado' && !statement) {
      loadStatement();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return toast('Selecciona una orden de compra', 'bad');
    if (!kilos || isNaN(Number(kilos)) || Number(kilos) <= 0) return toast('Ingresa kilos válidos', 'bad');

    const order = activeOrders.find(o => o.orderId === orderId);
    if (!order) return toast('Orden no encontrada', 'bad');
    
    if (Number(kilos) > order.pendingKilos) {
      return toast(`No puedes entregar más de lo pendiente (${order.pendingKilos} kg)`, 'bad');
    }

    setSaving(true);
    try {
      await addDoc(collection(db, PATHS.maquilaDeliveries), {
        date: serverTimestamp(),
        orderId: order.orderId,
        folio: order.folio,
        productDescription: order.productDescription,
        kilos: Number(kilos),
        status: 'pending', // pending to be assigned to an OC
        createdAt: serverTimestamp(),
      });
      
      toast('Entrega registrada exitosamente', 'ok');
      setKilos('');
      setOrderId('');
      loadOrders(); // recargar para actualizar los kilos pendientes
    } catch (err: any) {
      console.error(err);
      toast('Error al guardar: ' + err.message, 'bad');
    } finally {
      setSaving(false);
    }
  };

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--base)', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400, padding: 32, background: 'var(--surface)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', margin: '0 0 24px 0' }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>📦 Portal Maquilador</h1>
            <p style={{ color: 'var(--ink-soft)', marginTop: 8 }}>Ingresa tu PIN para registrar entregas</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="PIN de Acceso">
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="****"
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
              />
            </Field>
            <button className="btn" type="submit" style={{ background: 'var(--brand)', color: 'white', padding: 12, fontSize: 16 }}>
              Ingresar
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loadingSettings || loadingOrders) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--base)' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--base)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 800, margin: '0 auto' }}>
        
        <div className="tabs" style={{ marginBottom: 24, display: 'flex', gap: 8, background: 'var(--surface)', padding: '12px 16px', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <button className={`btn ${tab === 'entrega' ? 'btn-primary' : ''}`} onClick={() => handleTabChange('entrega')} style={{ flex: 1, padding: 12 }}>
            🏭 Registrar Entrega
          </button>
          <button className={`btn ${tab === 'estado' ? 'btn-primary' : ''}`} onClick={() => handleTabChange('estado')} style={{ flex: 1, padding: 12 }}>
            💰 Mi Estado de Cuenta
          </button>
        </div>

        {tab === 'entrega' && (
          <div style={{ padding: 24, background: 'var(--surface)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: 22, color: 'var(--brand)' }}>🏭 Nueva Entrega</h1>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Field label="¿Para cuál Orden de Compra es la entrega?">
                <select
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  style={{ padding: '12px', fontSize: 16 }}
                >
                  <option value="">Selecciona una OC pendiente...</option>
                  {activeOrders.map(o => (
                    <option key={o.orderId} value={o.orderId}>
                      OC {o.folio} - {o.productDescription} (Faltan {o.pendingKilos} kg)
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="¿Cuántos Kilos? (Cuánto)">
                <input
                  type="number"
                  step="0.01"
                  value={kilos}
                  onChange={e => setKilos(e.target.value)}
                  placeholder="Ej. 450.50"
                  style={{ padding: '12px', fontSize: 18 }}
                  inputMode="decimal"
                />
              </Field>

              <button 
                className="btn" 
                type="submit" 
                disabled={saving}
                style={{ 
                  background: saving ? 'var(--line)' : 'var(--ok)', 
                  color: 'white', 
                  padding: '16px', 
                  fontSize: 18, 
                  fontWeight: 600,
                  marginTop: 12 
                }}
              >
                {saving ? <Spinner /> : 'Registrar Entrega'}
              </button>
            </form>
          </div>
        )}

        {tab === 'estado' && (
          <div style={{ padding: 24, background: 'var(--surface)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: 22, color: 'var(--brand)' }}>💰 Estado de Cuenta</h1>
            {loadingStatement ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
            ) : statement ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase' }}>Total Fabricado</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{money(statement.totalPurchasesCost)}</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase' }}>Total Pagado</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{money(statement.totalPagado)}</div>
                  </div>
                  <div style={{ padding: 16, background: statement.saldoProveedor < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', borderRadius: 8, border: `1px solid ${statement.saldoProveedor < 0 ? '#ef4444' : '#22c55e'}` }}>
                    <div style={{ fontSize: 12, color: statement.saldoProveedor < 0 ? '#b91c1c' : '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Saldo Actual</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: statement.saldoProveedor < 0 ? '#b91c1c' : '#15803d' }}>
                      {statement.saldoProveedor < 0 ? '-' : '+'}{money(Math.abs(statement.saldoProveedor))}
                    </div>
                    <div style={{ fontSize: 11, color: statement.saldoProveedor < 0 ? '#b91c1c' : '#15803d', marginTop: 4 }}>
                      {statement.saldoProveedor < 0 ? 'Saldo a tu favor' : 'Anticipo pendiente de devengar'}
                    </div>
                  </div>
                </div>

                <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Libro Mayor Detallado</h3>
                <div className="table-scroll">
                  <table className="data-table" style={{ width: '100%', textAlign: 'left', fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>Fecha</th>
                        <th style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>Concepto</th>
                        <th style={{ padding: 8, borderBottom: '1px solid var(--line)', textAlign: 'right' }}>A Favor (Deuda)</th>
                        <th style={{ padding: 8, borderBottom: '1px solid var(--line)', textAlign: 'right' }}>Abono (Pago)</th>
                        <th style={{ padding: 8, borderBottom: '1px solid var(--line)', textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.ledger.map((row: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: 8, borderBottom: '1px solid var(--line-soft)' }}>
                            {new Date(row.dateMillis).toLocaleDateString('es-MX')}
                          </td>
                          <td style={{ padding: 8, borderBottom: '1px solid var(--line-soft)' }}>
                            {row.concept}
                          </td>
                          <td className="mono num" style={{ padding: 8, borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                            {row.cargo > 0 ? money(row.cargo) : '-'}
                          </td>
                          <td className="mono num" style={{ padding: 8, borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                            {row.abono > 0 ? money(row.abono) : '-'}
                          </td>
                          <td className="mono num" style={{ padding: 8, borderBottom: '1px solid var(--line-soft)', textAlign: 'right', fontWeight: 600 }}>
                            {money(row.balance)}
                          </td>
                        </tr>
                      ))}
                      {statement.ledger.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>No hay movimientos registrados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <button className="btn btn-primary" onClick={loadStatement}>Cargar Estado de Cuenta</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
