import { useState } from 'react';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { Field, Spinner } from '../components/ui';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

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
      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: 24, background: 'var(--surface)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
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
    </div>
  );
}
