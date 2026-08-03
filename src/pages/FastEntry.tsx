import React, { useState, useMemo, useRef } from 'react';
import { Card, Skeleton } from '../components/ui';
import { Timestamp } from 'firebase/firestore';
import { useOrders } from '../hooks/useOrders';
import { Invoice } from '../lib/types';
import { db, PATHS } from '../lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { getOrderSummary } from '../lib/finance';
import { camposInvoices } from '../lib/invoiceOps';

interface IncompleteInvoice {
  orderId: string;
  invoiceId: string;
  orderFolio: string;
  client: string;
  amount: number;
  currentFolio: string;
  currentCR: string;
}

export function FastEntry() {
  const { orders, loading } = useOrders();
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'logistics' | 'docs'>('logistics');
  const [logisticsEdits, setLogisticsEdits] = useState<Record<string, { kilos: string, date: string }>>({});


  const activeOrders = useMemo(() => {
    return orders.filter(o => {
      const s = getOrderSummary(o).status;
      return s !== 'collected';
    });
  }, [orders]);
  
  // Refs for keyboard navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const missingDeliveries = useMemo(() => {
    return activeOrders.map(o => {
      const pedidos = o.totalKilograms ?? 0;
      const entregados = o.deliveries?.reduce((a, b) => a + (b.kilos || 0), 0) ?? 0;
      const faltante = pedidos - entregados;
      return { order: o, pedidos, entregados, faltante };
    }).filter(x => x.faltante > 0);
  }, [activeOrders]);

  const missing = useMemo(() => {
    const list: IncompleteInvoice[] = [];
    activeOrders.forEach(o => {
      const invoices = o.invoices || [];
      invoices.forEach(inv => {
        const amount = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const missingFolio = !inv.folio || inv.folio.trim() === '';
        const missingCR = (!inv.collection?.contrareciboNumber || inv.collection.contrareciboNumber.trim() === '') && inv.creditCycle.status !== 'paid';
        
        if (missingFolio || missingCR) {
          list.push({
            orderId: o.id,
            invoiceId: inv.id,
            orderFolio: o.folio ?? 'S/N',
            client: o.client ?? 'S/N',
            amount,
            currentFolio: inv.folio ?? '',
            currentCR: inv.collection?.contrareciboNumber ?? ''
          });
        }
      });
    });
    return list;
  }, [activeOrders]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    }
  };

  
  const handleSave = async () => {
    if (activeTab === 'docs') {
      await handleSaveDocs();
    } else {
      await handleSaveLogistics();
    }
  };

  const handleSaveLogistics = async () => {
    const keys = Object.keys(logisticsEdits);
    if (keys.length === 0) {
      toast('No hay entregas por guardar.', 'info');
      return;
    }

    // Validate over-delivery
    for (const orderId of keys) {
      const val = logisticsEdits[orderId];
      if (!val.kilos || !val.date) continue;
      
      const k = Number(val.kilos);
      if (isNaN(k) || k <= 0) {
        toast('Los kilos deben ser un número mayor a 0.', 'bad');
        return;
      }
      
      const orderInfo = missingDeliveries.find(x => x.order.id === orderId);
      if (!orderInfo) continue;
      
      if (orderInfo.entregados + k > orderInfo.pedidos) {
        toast(`Error: La entrega de ${k} kg para la OC ${orderInfo.order.oc || orderInfo.order.folio} supera lo permitido. Faltante real: ${orderInfo.faltante} kg. El portal de Providencia rechazará esto.`, 'bad');
        return;
      }
    }

    setSaving(true);
    try {
      await runTransaction(db, async (tx) => {
        const refs = keys.map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, index) => {
          const snap = snaps[index];
          if (!snap.exists()) return;
          
          const val = logisticsEdits[id];
          if (!val.kilos || !val.date) return;
          
          const deliveries = snap.data().deliveries ?? [];
          const k = Number(val.kilos);
          const [yyyy, mm, dd] = val.date.split('-');
          const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);

          deliveries.push({
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            date: Timestamp.fromDate(d),
            kilos: k,
            invoiced: false
          });
          
          tx.update(ref, { deliveries });
        });
      });

      toast(`Entregas registradas exitosamente.`, 'ok');
      setLogisticsEdits({});
    } catch (e: any) {
      console.error(e);
      toast('Error guardando las entregas: ' + e.message, 'bad');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDocs = async () => {

    const keys = Object.keys(edits);
    if (keys.length === 0) {
      toast('No hay cambios por guardar.', 'info');
      return;
    }

    // Validación Antiduplicados
    const allExistingFolios = activeOrders.flatMap(o => (o.invoices || []).map(i => i.folio?.trim().toLowerCase())).filter(Boolean);
    const allExistingCRs = activeOrders.flatMap(o => (o.invoices || []).map(i => i.collection?.contrareciboNumber?.trim().toLowerCase())).filter(Boolean);

    for (const key of keys) {
      const val = edits[key].trim();
      if (!val) continue;
      const valLower = val.toLowerCase();
      const isFactura = key.includes('___factura');
      
      if (isFactura && allExistingFolios.includes(valLower)) {
        toast(`El folio de factura ${val} ya existe en otra orden.`, 'bad');
        return;
      }
      if (!isFactura && allExistingCRs.includes(valLower)) {
        toast(`El contrarecibo ${val} ya existe en otra orden.`, 'bad');
        return;
      }
    }

    setSaving(true);
    try {
      const updatesByOrder: Record<string, any[]> = {};
      
      keys.forEach(k => {
        const val = edits[k].trim();
        if (!val) return;
        const [orderId, invoiceId, type] = k.split('___');
        if (!updatesByOrder[orderId]) updatesByOrder[orderId] = [];
        updatesByOrder[orderId].push({ invoiceId, type, val });
      });

      await runTransaction(db, async (tx) => {
        const refs = Object.keys(updatesByOrder).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, index) => {
          const snap = snaps[index];
          if (!snap.exists()) return;
          
          const invoices: Invoice[] = snap.data().invoices ?? [];
          const updates = updatesByOrder[id];
          
          let modified = false;
          updates.forEach(u => {
            const invIndex = invoices.findIndex(i => i.id === u.invoiceId);
            if (invIndex >= 0) {
              modified = true;
              const current = invoices[invIndex];
              if (u.type === 'factura') {
                invoices[invIndex] = { ...current, folio: u.val };
              } else if (u.type === 'contrarecibo') {
                invoices[invIndex] = { 
                  ...current, 
                  collection: { ...current.collection, contrareciboNumber: u.val }
                };
              }
            }
          });
          
          if (modified) {
            tx.update(ref, camposInvoices(invoices));
          }
        });
      });

      toast(`¡Registros guardados exitosamente!`, 'ok');
      setEdits({});
    } catch (e: any) {
      console.error(e);
      toast('Error guardando los registros: ' + e.message, 'bad');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Skeleton style={{ width: 200, height: 28, marginBottom: 8 }} />
            <Skeleton style={{ width: 350, height: 16 }} />
          </div>
          <Skeleton style={{ width: 140, height: 40 }} />
        </div>
        <Skeleton style={{ height: 400, borderRadius: 16 }} />
      </div>
    );
  }

  

  return (
    <div className="page-container" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>⚡ Captura Rápida</h1>
          <p style={{ margin: 0, marginTop: 4, color: 'var(--ink-soft)' }}>Ingresa folios y contrarecibos velozmente con el teclado.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || (activeTab === 'docs' ? Object.keys(edits).length === 0 : Object.keys(logisticsEdits).length === 0)} style={{ padding: '8px 24px', fontSize: 16 }}>
          {saving ? 'Guardando...' : 'Guardar Todo'}
        </button>
      </div>

      
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <button 
          className={`btn ${activeTab === 'logistics' ? 'btn-primary' : ''}`} 
          style={{ borderRadius: '8px 8px 0 0', borderBottom: activeTab === 'logistics' ? 'none' : '' }}
          onClick={() => setActiveTab('logistics')}
        >
          🚚 Entregas de Andrés
        </button>
        <button 
          className={`btn ${activeTab === 'docs' ? 'btn-primary' : ''}`} 
          style={{ borderRadius: '8px 8px 0 0', borderBottom: activeTab === 'docs' ? 'none' : '' }}
          onClick={() => setActiveTab('docs')}
        >
          📄 Facturas y Contrarecibos
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        {activeTab === 'logistics' ? (
          <Card title={`Envíos Pendientes de Entregar (${missingDeliveries.length})`} hint="No puedes pasarte de la OC">
            {missingDeliveries.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
                Todas las OCs activas ya fueron entregadas físicamente al 100%.
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>OC / Orden</th>
                      <th>Cliente</th>
                      <th className="num">Pedida (kg)</th>
                      <th className="num">Entregada (kg)</th>
                      <th className="num">Faltante</th>
                      <th className="num" style={{width: 140}}>Fecha Entrega</th>
                      <th className="num" style={{width: 140}}>Kilos Nuevos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingDeliveries.map((m) => {
                      const edit = logisticsEdits[m.order.id] || { kilos: '', date: new Date().toISOString().split('T')[0] };
                      const willExceed = Number(edit.kilos) > m.faltante;

                      return (
                        <tr key={m.order.id}>
                          <td className="mono">{m.order.oc || m.order.folio}</td>
                          <td style={{ fontSize: 12 }}>{m.order.client}</td>
                          <td className="num">{m.pedidos.toLocaleString('es-MX')}</td>
                          <td className="num">{m.entregados.toLocaleString('es-MX')}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{m.faltante.toLocaleString('es-MX')}</td>
                          <td className="num">
                            <input 
                              type="date"
                              className="input boxed"
                              style={{ width: '100%', minWidth: 130 }}
                              value={edit.date}
                              onChange={e => setLogisticsEdits({ ...logisticsEdits, [m.order.id]: { ...edit, date: e.target.value }})}
                            />
                          </td>
                          <td className="num">
                            <input 
                              type="number"
                              className="input boxed"
                              style={{ width: '100%', minWidth: 100, textAlign: 'right', borderColor: willExceed ? 'var(--bad)' : (edit.kilos ? 'var(--ok)' : '') }}
                              placeholder="Kilos"
                              value={edit.kilos}
                              onChange={e => setLogisticsEdits({ ...logisticsEdits, [m.order.id]: { ...edit, kilos: e.target.value }})}
                            />
                            {willExceed && <div style={{color: 'var(--bad)', fontSize: 10, marginTop: 4, textAlign: 'right'}}>¡Supera la OC!</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (

        <Card title={`Facturas o Contrarecibos Pendientes (${missing.length})`} hint="Ingresa los datos">
          {missing.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
              No hay documentos pendientes.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th className="num">Folio Factura</th>
                    <th className="num">Contrarecibo</th>
                  </tr>
                </thead>
                <tbody>
                  {missing.map((m, i) => {
                    const keyFolio = `${m.orderId}___${m.invoiceId}___factura`;
                    const keyCR = `${m.orderId}___${m.invoiceId}___contrarecibo`;
                    const valFolio = edits[keyFolio] ?? m.currentFolio;
                    const valCR = edits[keyCR] ?? m.currentCR;
                    const isNewFolio = edits[keyFolio] !== undefined;
                    const isNewCR = edits[keyCR] !== undefined;

                    return (
                      <tr key={m.invoiceId}>
                        <td className="mono">{m.orderFolio}</td>
                        <td style={{ fontSize: 12, maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.client}>
                          {m.client}
                        </td>
                        <td className="num">
                          <input 
                            ref={el => inputRefs.current[i * 2] = el}
                            type="text" 
                            className="input boxed"
                            style={{ width: '100%', minWidth: 100, textAlign: 'right', fontWeight: 600, borderColor: isNewFolio ? 'var(--accent)' : '' }}
                            placeholder="Ej. F-1234"
                            value={valFolio}
                            onChange={(e) => setEdits({ ...edits, [keyFolio]: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, i * 2)}
                          />
                        </td>
                        <td className="num">
                          <input 
                            ref={el => inputRefs.current[i * 2 + 1] = el}
                            type="text" 
                            className="input boxed"
                            style={{ width: '100%', minWidth: 100, textAlign: 'right', fontWeight: 600, borderColor: isNewCR ? 'var(--ok)' : '' }}
                            placeholder="Ej. CR-777"
                            value={valCR}
                            onChange={(e) => setEdits({ ...edits, [keyCR]: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, i * 2 + 1)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        )}
      </div>
    </div>
  );
}