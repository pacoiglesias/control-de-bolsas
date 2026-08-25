import React from 'react';
import { useOrderModal } from './OrderModalContext';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { useToast } from '../../context/ToastContext';
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

import { printSingleDeliveryRemision } from './orderModalPrint';
import { triggerHaptic } from '../../lib/hapticEngine';
import { FotoRemisionModal } from './FotoRemisionModal';

export default function TabEntregas() {
  const ctx = useOrderModal();
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  const toast = useToast();
  const [showPortal, setShowPortal] = React.useState(false);
  const [showFotoModal, setShowFotoModal] = React.useState(false);

  const { form, setForm, readOnly, kilosEntregados, kilosPedidos, kilosFaltantes, setTab } = ctx;
  const { addDelivery, updateDelivery, updateDeliveryItemQty, removeDelivery, facturarEntrega } = useOrderDeliveries(setForm, setTab);

  const handlePrintSingleDelivery = (d: any) => {
    triggerHaptic();
    const k = round2((d.items ?? []).reduce((a: number, x: any) => a + (Number(x.quantity) || 0), 0) || d.kilos || 0);
    printSingleDeliveryRemision({
      folio: form.folio,
      oc: form.oc,
      client: form.client,
      department: form.department,
      items: form.items,
      delivery: {
        date: d.date ? (typeof d.date.toDate === 'function' ? d.date.toDate() : new Date(d.date)) : new Date(),
        kilos: k,
        driver: d.driver || provName || 'Andrés',
        docFolio: d.docFolio,
        docType: d.docType,
        notes: d.notes,
        items: d.items,
      },
      provName: d.driver || provName || 'Andrés',
    });
  };

  const handleShareDeliveryWA = (d: any) => {
    triggerHaptic();
    const k = round2((d.items ?? []).reduce((a: number, x: any) => a + (Number(x.quantity) || 0), 0) || d.kilos || 0);
    const ocNum = form.oc || form.folio || 'S/N';
    const text = `🚚 *COMPROBANTE DE ENTREGA EN BÁSCULA*\n\n` +
      `📦 *OC / Pedido:* #${ocNum}\n` +
      `🏢 *Cliente:* ${form.client || 'Providencia'}\n` +
      `⚖️ *Kilos Entregados:* ${k.toLocaleString('es-MX')} kg\n` +
      `📅 *Fecha:* ${toInputDate(d.date) || 'Hoy'}\n` +
      `🚛 *Chofer / Entrega:* ${d.driver || provName || 'Andrés'}\n` +
      (d.docFolio ? `📋 *Folio Remisión:* ${d.docFolio}\n` : '') +
      (d.notes ? `📝 *Notas:* ${d.notes}\n` : '') +
      `\n_Registrado desde Sistema ERP Bolsas Elemental_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

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
              const esCierreCorto = form.isClosedShort;

              const handleConcluirPedido = async () => {
                const confirmar = await confirmDialog({
                  message: `¿Confirmas concluir este pedido con los ${kilosEntregados.toLocaleString('es-MX')} kg entregados?\n\nSe considerará que ${provName} ya completó las entregas de este lote y podrás facturarlo al 100% sin advertencias de kilos faltantes.`,
                });
                if (!confirmar) return;
                setForm((f: any) => ({ ...f, isClosedShort: true }));
                toast('🔒 Pedido concluido con los kilos entregados. Haz clic en "Guardar cambios".', 'ok');
              };

              const handleReabrirPedido = async () => {
                setForm((f: any) => ({ ...f, isClosedShort: false }));
                toast('🔓 Pedido reabierto para nuevas entregas.', 'ok');
              };

              return (
                <div style={{
                  marginBottom: 16, padding: 14, borderRadius: 12,
                  background: esCierreCorto ? 'rgba(59,130,246,0.08)' : todoListo ? 'var(--ok-bg, #d1fae5)' : 'var(--paper-sunk)',
                  border: esCierreCorto ? '1px solid #3b82f6' : todoListo ? '1px solid var(--ok)' : '1px solid var(--line)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>
                      {esCierreCorto ? (
                        <span style={{ color: '#1d4ed8' }}>🔒 Pedido Concluido con {kilosEntregados.toLocaleString('es-MX')} kg entregados (Cierre Aceptado)</span>
                      ) : todoListo ? (
                        '✅ Todo entregado y facturado — esta OC está completa'
                      ) : (
                        `📦 ${facturadas} de ${totalEntregas} entregas facturadas (${pctKilos}% de la OC)`
                      )}
                    </span>
                    
                    {!readOnly && (
                      <div>
                        {esCierreCorto ? (
                          <button 
                            type="button" 
                            className="btn" 
                            style={{ fontSize: 11.5, padding: '3px 8px' }}
                            onClick={handleReabrirPedido}
                          >
                            🔓 Reabrir Entregas
                          </button>
                        ) : kilosFaltantes > 0.01 && kilosEntregados > 0 ? (
                          <button 
                            type="button" 
                            className="btn btn-primary" 
                            style={{ fontSize: 11.5, padding: '4px 10px', background: '#0f172a', borderColor: '#0f172a' }}
                            onClick={handleConcluirPedido}
                            title={`Cerrar pedido si ${provName} ya no entregará más kilos`}
                          >
                            🔒 Concluir Pedido ({kilosEntregados.toLocaleString('es-MX')} kg)
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: esCierreCorto ? '100%' : `${pctKilos}%`, height: '100%', background: esCierreCorto ? '#3b82f6' : todoListo ? 'var(--ok)' : 'var(--accent)' }} />
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

                          {/* Selector Tipo de Documento: Remisión vs Factura */}
                          <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid var(--line)', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => !d.invoiced && !readOnly && updateDelivery(i, 'docType', 'remision')}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                border: 'none',
                                background: (!d.docType || d.docType === 'remision') ? '#3b82f6' : 'var(--paper-sunk)',
                                color: (!d.docType || d.docType === 'remision') ? '#fff' : 'var(--ink-soft)',
                                cursor: d.invoiced || readOnly ? 'default' : 'pointer',
                              }}
                              title="Entrega amparada con Remisión de Báscula / Prefactura"
                            >
                              📋 Remisión
                            </button>
                            <button
                              type="button"
                              onClick={() => !d.invoiced && !readOnly && updateDelivery(i, 'docType', 'factura')}
                              style={{
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                border: 'none',
                                background: d.docType === 'factura' ? '#059669' : 'var(--paper-sunk)',
                                color: d.docType === 'factura' ? '#fff' : 'var(--ink-soft)',
                                cursor: d.invoiced || readOnly ? 'default' : 'pointer',
                              }}
                              title="Entrega amparada con Factura Fiscal Directa"
                            >
                              📄 Factura
                            </button>
                          </div>

                          {/* Folio de la Remisión / Factura */}
                          <input
                            type="text"
                            className="input boxed mono"
                            placeholder={d.docType === 'factura' ? 'Folio Factura' : 'Folio Remisión / Báscula'}
                            defaultValue={d.docFolio || ''}
                            onBlur={e => updateDelivery(i, 'docFolio', e.target.value)}
                            disabled={readOnly || d.invoiced}
                            style={{ width: 140, fontSize: 12 }}
                            title={`Folio o número de documento de entrega de ${provName}`}
                          />

                          {d.invoiced ? (
                            <span className="badge" style={{ background: 'var(--ok)' }}>✅ Facturada</span>
                          ) : (
                            <span className="badge" style={{ background: 'var(--warn)' }}>📝 Pendiente de facturar</span>
                          )}
                          <strong className="mono" style={{ fontSize: 13 }}>{kilosDeEsta.toLocaleString('es-MX')} kg</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 11.5, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handlePrintSingleDelivery(d)}
                            title="Imprimir o generar PDF de esta remisión individual"
                          >
                            <span>📄</span> Remisión
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 11.5, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#047857', borderColor: '#10b981', background: 'rgba(16,185,129,0.08)' }}
                            onClick={() => handleShareDeliveryWA(d)}
                            title="Enviar comprobante por WhatsApp"
                          >
                            <span>💬</span> WA
                          </button>
                          {!readOnly && !d.invoiced && kilosDeEsta > 0 && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ fontSize: 12, padding: '4px 10px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', color: '#fff', fontWeight: 800 }}
                              onClick={() => facturarEntrega(i)}
                            >
                              🧾 Facturar esta entrega
                            </button>
                          )}
                          {!readOnly && !d.invoiced && (
                            <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => removeDelivery(i)}>
                              Eliminar
                            </button>
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
