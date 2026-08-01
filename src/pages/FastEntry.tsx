import React, { useState, useMemo, useRef } from 'react';
import { Card } from '../components/ui';
import { useOrders } from '../hooks/useOrders';
import { Invoice } from '../lib/types';
import { db, PATHS } from '../lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { getOrderSummary } from '../lib/finance';

interface MissingField {
  type: 'factura' | 'contrarecibo';
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

  const activeOrders = useMemo(() => {
    return orders.filter(o => {
      const s = getOrderSummary(o).status;
      return s !== 'collected';
    });
  }, [orders]);
  
  // Refs for keyboard navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const missing = useMemo(() => {
    const list: MissingField[] = [];
    activeOrders.forEach(o => {
      const invoices = o.invoices || [];
      invoices.forEach(inv => {
        const amount = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        
        // Si falta folio de factura
        if (!inv.folio || inv.folio.trim() === '') {
          list.push({
            type: 'factura',
            orderId: o.id,
            invoiceId: inv.id,
            orderFolio: o.folio ?? 'S/N',
            client: o.client ?? 'S/N',
            amount,
            currentFolio: inv.folio ?? '',
            currentCR: inv.collection?.contrareciboNumber ?? ''
          });
        }
        
        // Si tiene folio pero falta contrarecibo (y el status no es pagado)
        if (inv.folio && inv.folio.trim() !== '' && inv.creditCycle.status !== 'paid') {
          if (!inv.collection?.contrareciboNumber || inv.collection.contrareciboNumber.trim() === '') {
            list.push({
              type: 'contrarecibo',
              orderId: o.id,
              invoiceId: inv.id,
              orderFolio: o.folio ?? 'S/N',
              client: o.client ?? 'S/N',
              amount,
              currentFolio: inv.folio ?? '',
              currentCR: inv.collection?.contrareciboNumber ?? ''
            });
          }
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
    const keys = Object.keys(edits);
    if (keys.length === 0) {
      toast('No hay cambios por guardar.', 'warn');
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
        toast(`El folio de factura ${val} ya existe en otra orden.`, 'error');
        return;
      }
      if (!isFactura && allExistingCRs.includes(valLower)) {
        toast(`El contrarecibo ${val} ya existe en otra orden.`, 'error');
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
          
          let invoices: Invoice[] = snap.data().invoices ?? [];
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
            tx.update(ref, { invoices });
          }
        });
      });

      toast(`¡Registros guardados exitosamente!`, 'ok');
      setEdits({});
    } catch (e: any) {
      console.error(e);
      toast('Error guardando los registros: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Cargando datos...</div>;

  const facturasMissing = missing.filter(m => m.type === 'factura');
  const crMissing = missing.filter(m => m.type === 'contrarecibo');

  return (
    <div className="page-container" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>⚡ Captura Rápida</h1>
          <p style={{ margin: 0, marginTop: 4, color: 'var(--ink-soft)' }}>Ingresa folios y contrarecibos velozmente con el teclado.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || Object.keys(edits).length === 0} style={{ padding: '8px 24px', fontSize: 16 }}>
          {saving ? 'Guardando...' : 'Guardar Todo'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        
        <Card title={`Falta Factura (${facturasMissing.length})`} hint="Ingresa el Folio">
          {facturasMissing.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
              No hay facturas pendientes de folio.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>OC</th>
                    <th>Cliente</th>
                    <th className="num">Folio</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasMissing.map((m, i) => {
                    const key = `${m.orderId}___${m.invoiceId}___factura`;
                    return (
                      <tr key={key}>
                        <td className="mono">{m.orderFolio}</td>
                        <td style={{ fontSize: 12, maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.client}>
                          {m.client}
                        </td>
                        <td className="num">
                          <input 
                            ref={el => inputRefs.current[i] = el}
                            type="text" 
                            className="input boxed"
                            style={{ width: '100%', minWidth: 100, textAlign: 'right', fontWeight: 600, borderColor: edits[key] ? 'var(--accent)' : '' }}
                            placeholder="Ej. F-1234"
                            value={edits[key] ?? ''}
                            onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, i)}
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

        <Card title={`Falta Contrarecibo (${crMissing.length})`} hint="Ingresa el CR">
          {crMissing.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
              No hay contrarecibos pendientes.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th className="num">Contrarecibo</th>
                  </tr>
                </thead>
                <tbody>
                  {crMissing.map((m, i) => {
                    const key = `${m.orderId}___${m.invoiceId}___contrarecibo`;
                    const idx = facturasMissing.length + i;
                    return (
                      <tr key={key}>
                        <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{m.currentFolio}</td>
                        <td style={{ fontSize: 12, maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.client}>
                          {m.client}
                        </td>
                        <td className="num">
                          <input 
                            ref={el => inputRefs.current[idx] = el}
                            type="text" 
                            className="input boxed"
                            style={{ width: '100%', minWidth: 100, textAlign: 'right', fontWeight: 600, borderColor: edits[key] ? 'var(--ok)' : '' }}
                            placeholder="Ej. CR-777"
                            value={edits[key] ?? ''}
                            onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
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

      </div>
    </div>
  );
}
