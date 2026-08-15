import React from 'react';
import { useOrderModal } from './OrderModalContext';
import { fromInputDate, toInputDate, fmtDateTime } from '../../lib/format';
import { round2 } from '../../lib/finance';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import { useMaquilaDeliveries } from '../../hooks/useMaquilaDeliveries';
import { db, PATHS } from '../../lib/firebase';
import { useOrderDeliveries } from './useOrderDeliveries';
import { confirmDialog } from '../../lib/confirmDialog';

function MaquilaDeliveriesSelector({ onSelect, onCancel }: { onSelect: (d: any) => void, onCancel: () => void }) {
  const { deliveries, loading } = useMaquilaDeliveries();
  if (loading) return <span className="spinner" />;
  if (deliveries.length === 0) return <p className="hint">No hay entregas pendientes en el portal del maquilador.</p>;
  
  return (
    <div style={{ background: 'var(--base)', border: '1px solid var(--line)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h5 style={{ margin: '0 0 12px 0' }}>Entregas reportadas por el maquilador:</h5>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deliveries.map(d => (
          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: 8, borderRadius: 4 }}>
            <div>
              <strong>{d.kilos} kg</strong> de {d.productDescription}
              <div className="hint" style={{ fontSize: 11 }}>{fmtDateTime(d.createdAt)}</div>
            </div>
            <button className="btn btn-primary" onClick={() => onSelect(d)}>Importar</button>
          </div>
        ))}
      </div>
      <button className="btn" onClick={onCancel} style={{ marginTop: 12 }}>Cerrar</button>
    </div>
  );
}

import { FotoRemisionModal } from './FotoRemisionModal';

export default function TabEntregas() {
  const ctx = useOrderModal();
  const [showPortal, setShowPortal] = React.useState(false);
  const [showFotoModal, setShowFotoModal] = React.useState(false);

  if (!ctx) return null;
  const { form, setForm, readOnly, provName, kilosEntregados, kilosPedidos, kilosFaltantes, toast, setTab } = ctx;
  const { addDelivery, updateDelivery, updateDeliveryItemQty, removeDelivery, facturarEntrega } = useOrderDeliveries(setForm, setTab);

  const handleImportMaquilaDelivery = async (d: any) => {
    // 1. Encuentra el ítem en la OC actual (buscando por código o por id)
    const ocItem = form.items.find((it: any) => it.code === d.productCode || it.id === d.productCode);
    
    // Si no está, lo ideal sería agregarlo automáticamente, pero por ahora requerimos que exista en la OC.
    if (!ocItem) {
      toast(`La Orden de Compra no incluye el producto "${d.productDescription}". Agrégalo primero en la pestaña Productos.`, 'bad');
      return;
    }

    // 2. Crea la entrega en la OC actual
    const newDel = {
      id: crypto.randomUUID(),
      date: Timestamp.now(),
      kilos: d.kilos,
      items: [{ itemId: ocItem.id, quantity: d.kilos }],
      invoiced: false,
      notes: 'Importado del Portal Maquilador'
    };
    setForm((f: any) => ({ ...f, deliveries: [...f.deliveries, newDel] }));
    
    // 3. Marca la entrega como asignada en Firestore
    try {
      await updateDoc(doc(db, PATHS.maquilaDeliveries, d.id), { status: 'assigned' });
      toast('Entrega importada correctamente', 'ok');
      setShowPortal(false);
    } catch(e) {
      console.error(e);
      toast('Error al marcar la entrega como asignada.', 'bad');
    }
  };

  const handleAddDeliveryFromPhoto = (kilosVal: number, folioRemision: string, notasVal: string, fotoUrl?: string) => {
    const firstItem = form.items[0];
    const newDel = {
      id: crypto.randomUUID(),
      date: Timestamp.now(),
      kilos: kilosVal,
      items: firstItem ? [{ itemId: firstItem.id, quantity: kilosVal }] : [],
      invoiced: false,
      notes: `${folioRemision ? `[Remisión ${folioRemision}] ` : ''}${notasVal}`,
      photoUrl: fotoUrl,
    };
    setForm((f: any) => ({ ...f, deliveries: [...(f.deliveries || []), newDel] }));
    toast(`✅ Entrega de ${kilosVal.toLocaleString('es-MX')} kg registrada desde remisión`, 'ok');
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0 }}>Registro de Entregas</h4>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            Cada vez que {provName} entrega en Providencia, se captura con fecha y kilos.
            Entregado: <strong>{kilosEntregados.toLocaleString('es-MX')} kg</strong> de {kilosPedidos.toLocaleString('es-MX')} kg pedidos
            {kilosFaltantes > 0.01 && <span style={{ color: 'var(--warn)' }}> · faltan {kilosFaltantes.toLocaleString('es-MX')} kg</span>}
          </p>
        </div>
        {!readOnly && form.items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.15) 100%)', borderColor: '#3b82f6', color: '#1d4ed8', fontWeight: 700 }}
              onClick={() => setShowFotoModal(true)}
            >
              📷 Foto / Remisión
            </button>
            <button className="btn" style={{ background: 'var(--brand)', color: 'white' }} onClick={() => setShowPortal(true)}>
              📥 Importar Portal
            </button>
            <button className="btn btn-primary" onClick={addDelivery}>
              + Nueva Entrega
            </button>
          </div>
        )}
      </div>

      {showFotoModal && (
        <FotoRemisionModal
          onClose={() => setShowFotoModal(false)}
          onAddDeliveryFromPhoto={handleAddDeliveryFromPhoto}
          kilosFaltantes={kilosFaltantes}
        />
      )}
            {form.deliveries.length > 0 && (() => {
              const totalEntregas = form.deliveries.length;
              const facturadas = form.deliveries.filter((d: any) => d.invoiced).length;
              const pctKilos = kilosPedidos > 0 ? Math.min(100, Math.round((kilosEntregados / kilosPedidos) * 100)) : 0;
              const todoListo = facturadas === totalEntregas && kilosFaltantes <= 0.01;
              return (
                <div style={{
                  marginBottom: 16, padding: 12, borderRadius: 8,
                  background: todoListo ? 'var(--ok-bg, #d1fae5)' : 'var(--paper-sunk)',
                  border: todoListo ? '1px solid var(--ok)' : '1px solid var(--line)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>
                      {todoListo ? '✅ Todo entregado y facturado — esta OC está lista para cerrarse sola' : `📦 ${facturadas} de ${totalEntregas} entregas facturadas`}
                    </span>
                    <span>{pctKilos}% de los kilos</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--paper-sunk)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pctKilos}%`, height: '100%', background: todoListo ? 'var(--ok)' : 'var(--accent)' }} />
                  </div>
                </div>
              );
            })()}
            {showPortal && <MaquilaDeliveriesSelector onSelect={handleImportMaquilaDelivery} onCancel={() => setShowPortal(false)} />}
            {form.items.length === 0 ? (
              <p className="hint">Captura primero los productos de la OC en la pestaña Productos.</p>
            ) : form.deliveries.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">📦</span>
                <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>Sin Entregas</strong>
                No hay entregas registradas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {form.deliveries.map((d: any, i: number) => {
                  const kilosDeEsta = round2((d.items ?? []).reduce((a: number, x: any) => a + (Number(x.quantity) || 0), 0) || d.kilos || 0);
                  return (
                    <div key={d.id} className="glass-panel" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <input className="input boxed mono" type="date"
                            defaultValue={toInputDate(d.date) || ''}
                            onBlur={e => {
                              const date = fromInputDate(e.target.value);
                              updateDelivery(i, 'date', date ? Timestamp.fromDate(date) : null);
                            }}
                            disabled={readOnly || d.invoiced}
                          />
                          {d.invoiced ? (
                            <span className="badge" style={{ background: 'var(--ok)' }}>✅ Facturada</span>
                          ) : (
                            <span className="badge" style={{ background: 'var(--warn)' }}>📝 Pendiente de facturar</span>
                          )}
                          <strong className="mono">{kilosDeEsta.toLocaleString('es-MX')} kg</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!readOnly && !d.invoiced && kilosDeEsta > 0 && (
                            <button className="btn btn-primary" onClick={() => facturarEntrega(i)}>🧾 Facturar esta entrega</button>
                          )}
                          {!readOnly && !d.invoiced && (
                            <button className="btn btn-danger" onClick={() => removeDelivery(i)}>Eliminar</button>
                          )}
                        </div>
                      </div>
                      <div className="table-scroll">
                      <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr><th>Producto</th><th className="num">Pedido</th><th className="num">Entregado (esta vez)</th></tr>
                        </thead>
                        <tbody>
                          {form.items.map((it: any) => {
                            const qtyEnEsta = (d.items ?? []).find((x: any) => x.itemId === it.id)?.quantity ?? 0;
                            return (
                              <tr key={it.id}>
                                <td>{it.description || it.code || '(sin descripción)'}</td>
                                <td className="num mono">{it.quantity.toLocaleString('es-MX')}</td>
                                <td className="num">
                                  <input className="input boxed mono" type="number" step="0.01" style={{ width: 90 }}
                                    defaultValue={qtyEnEsta}
                                    onBlur={async e => {
                                      const val = Number(e.target.value);
                                      const maxLogico = (it.quantity || 0) * 1.5; // Tolerancia del 50% sobre el pedido
                                      if (it.quantity > 0 && val > maxLogico) {
                                        const inputEl = e.target;
                                        if (!(await confirmDialog({ message: `⚠️ ADVERTENCIA DE SEGURIDAD\n\nEstás reportando una entrega de ${val.toLocaleString('es-MX')} kg, pero el pedido original es de solo ${it.quantity.toLocaleString('es-MX')} kg.\n\n¿Estás absolutamente seguro de que esto es correcto y no es un error de dedo?`, danger: true }))) {
                                          inputEl.value = String(qtyEnEsta); // Revertir valor
                                          return;
                                        }
                                      }
                                      updateDeliveryItemQty(i, it.id, val);
                                    }}
                                    disabled={readOnly || d.invoiced}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                      <input className="input boxed" type="text" style={{ width: '100%', marginTop: 8 }}
                        placeholder="Notas de esta entrega (opcional)"
                        defaultValue={d.notes || ''}
                        onBlur={e => updateDelivery(i, 'notes', e.target.value)}
                        disabled={readOnly || d.invoiced}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
  );
}
