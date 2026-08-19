import { useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { PasteTextModal } from '../PasteTextModal';
import { OCPreviewModal } from '../OCPreviewModal';
import { money } from '../../lib/format';
import type { PurchaseOrderItem } from '../../lib/types';
import { processPdfOrder } from '../../lib/ocr';
import { useOrderProducts } from './useOrderProducts';
import { useProducts } from '../../hooks/useProducts';
import { parseOrdenDeCompra, type ParsedOC } from '../../lib/ocParser';
import { Timestamp } from 'firebase/firestore';

export default function TabProductos() {
  const ctx = useOrderModal();
  const [pegandoOC, setPegandoOC] = useState(false);
  const [preview, setPreview] = useState<ParsedOC | null>(null);
  const { form, setForm, config, readOnly, kilosEntregados, kilosPedidos, kilosFaltantes, deliveredByItem, toast } = ctx;
  const { products } = useProducts();
  const { addItem, updateItem, removeItem } = useOrderProducts(form.items, setForm, config);

  // Aplica lo que ya se le mostro al usuario en OCPreviewModal -- separado
  // de la extraccion para que pegar el texto ya no escriba el formulario a
  // ciegas (ver el comentario de ocParser.ts sobre el bug real de kilos).
  function aplicarPreview(parsed: ParsedOC) {
    const newFolio = form.folio || parsed.folio;
    const newOc = (form as any).oc || parsed.oc;
    const newProvider = form.provider || parsed.provider;
    const newClient = form.client || parsed.client;

    setForm((f: any) => ({
      ...f,
      folio: newFolio,
      oc: newOc,
      provider: newProvider,
      client: newClient,
      items: [...f.items, ...parsed.items],
      totalKilograms: parsed.items.length > 0
        ? String(f.items.reduce((acc: number, it: PurchaseOrderItem) => acc + (it.quantity || 0), 0) + parsed.totalKilograms)
        : f.totalKilograms,
      estimatedDeliveryDate: parsed.estimatedDeliveryDate ? Timestamp.fromDate(parsed.estimatedDeliveryDate) : f.estimatedDeliveryDate,
    }));
    toast(`OC aplicada: ${parsed.items.length} artículos, ${parsed.totalKilograms.toLocaleString('es-MX')} kg. Folio: ${newFolio || 'N/A'} · OC: ${newOc || 'N/A'}.`, 'ok');
  }

  /**
   * Extrae folio, proveedor y CADA ARTICULO (codigo, descripcion, cantidad,
   * precio) del texto pegado de una OC -- pero ya no lo aplica directo,
   * primero lo muestra en OCPreviewModal para que se pueda cancelar si
   * algo se interpreto mal.
   */
  function handlePasteOC(text: string) {
    if (!text) return;
    // Parser unico compartido con el boton "Pegar Texto de OC" de la
    // pestaña Expediente -- ver src/lib/ocParser.ts para el porque.
    setPreview(parseOrdenDeCompra(text));
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    toast('🤖 Analizando documento con Inteligencia Local...', 'info');
    try {
      const ocrResult = await processPdfOrder(file);
      console.log('OCR Output:', ocrResult);
      // El escaneo de PDF ya pasa por su propio OCR local antes de llegar
      // aqui (mas lento y con su propio nivel de confianza) -- se aplica
      // directo, igual que antes. La vista previa manual (OCPreviewModal)
      // es para el texto pegado a mano, donde el unico "filtro" hasta hoy
      // era la regex del navegador.
      const parsed = parseOrdenDeCompra(ocrResult.rawText);
      if (parsed.items.length > 0 || parsed.folio || parsed.oc) {
        aplicarPreview(parsed);
      } else if (ocrResult.product) {
        // Fallback: el parser de texto no encontro nada reconocible, pero
        // el OCR local si extrajo un producto/kilos/total de forma
        // estructurada -- se usa eso en vez de dejar el expediente vacio.
        setForm((f: any) => ({
          ...f,
          folio: f.folio || ocrResult.folio || '',
          oc: f.oc || ocrResult.folio || '',
          totalKilograms: f.totalKilograms || (ocrResult.kilos ? String(ocrResult.kilos) : f.totalKilograms),
          items: f.items.length === 0 ? [{
            id: Date.now().toString(),
            code: '',
            description: ocrResult.product,
            quantity: ocrResult.kilos || 0,
            unitPrice: ocrResult.kilos && ocrResult.total ? ocrResult.total / ocrResult.kilos : 0,
            amount: ocrResult.total || 0,
            unit: 'Kilos'
          }] : f.items
        }));
        toast('OC aplicada con datos parciales del OCR.', 'ok');
      } else {
        toast('No se detectó ningún dato reconocible en el PDF.', 'info');
      }
    } catch (err: any) {
      toast(`Error al leer PDF: ${err.message}`, 'bad');
    }
  }

  return (
    <>
            {pegandoOC && (
              <PasteTextModal
                title="Pegar texto de la OC"
                placeholder="Pega aquí el texto completo copiado del PDF de la Orden de Compra (OC)…"
                onConfirm={(text) => { setPegandoOC(false); handlePasteOC(text); }}
                onClose={() => setPegandoOC(false)}
              />
            )}
            {preview && (
              <OCPreviewModal
                parsed={preview}
                onConfirm={() => { aplicarPreview(preview); setPreview(null); }}
                onCancel={() => setPreview(null)}
              />
            )}
            {kilosEntregados > 0 && form.deliveries.some((d: any) => !d.invoiced) && (
              <div className="alert warn" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius)' }}>
                <strong>📝 Hay una entrega sin facturar.</strong> Ve a la pestaña <strong>Entregas</strong> para
                revisar las cantidades y presionar "Facturar esta entrega".
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h4 style={{ margin: 0 }}>Detalle de Artículos (Partidas de la OC)</h4>
                {kilosPedidos > 0 && (
                  <p className="hint" style={{ margin: '4px 0 0' }}>
                    Entregado: <strong>{kilosEntregados.toLocaleString('es-MX')} kg</strong> de {kilosPedidos.toLocaleString('es-MX')} kg pedidos
                    {kilosFaltantes > 0.01 && (
                      <span style={{ color: 'var(--warn)' }}> · faltan {kilosFaltantes.toLocaleString('es-MX')} kg</span>
                    )}
                    {' · '}se captura en la pestaña <strong>Entregas</strong>.
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className="btn btn-primary" style={{ cursor: 'pointer', margin: 0, background: 'var(--ok)', borderColor: 'var(--ok)' }}>
                    🤖 Escanear OC (PDF)
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
                  </label>
                  <button className="btn" onClick={() => setPegandoOC(true)} style={{ background: 'var(--bg-card)', border: '1px dashed var(--line)' }}>📋 Pegar Texto OC</button>
                  <button className="btn btn-primary" onClick={addItem}>+ Agregar Artículo</button>
                </div>
              )}
            </div>
            {form.items.length === 0 ? (
              <p className="hint">No hay artículos detallados. La IA extrae estos datos automáticamente del PDF de la Orden de Compra.</p>
            ) : (
              <div className="table-scroll glass-panel" style={{ borderRadius: 'var(--radius)', padding: '16px' }}>
                <table className="data-table" style={{ width: '100%', marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th className="num">Cant. Pedida</th>
                      <th className="num">Cant. Entregada</th>
                      <th>Unidad</th>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th className="num">P. Unitario</th>
                      <th className="num">Importe</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it: PurchaseOrderItem, i: number) => (
                      <tr key={it.id}>
                        <td className="num">
                          <input className="input boxed mono" type="number" step="0.01" style={{ width: 70 }}
                            defaultValue={it.quantity} onBlur={e => updateItem(i, 'quantity', Number(e.target.value))} disabled={readOnly} />
                        </td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {/* Solo lectura: se captura en la pestaña Entregas, no aquí. Antes
                                este campo era editable y era la mitad del sistema duplicado que
                                no se enteraba de la pestaña Entregas. */}
                            <span className="mono" title="Se captura en la pestaña Entregas">
                              {(deliveredByItem[it.id] ?? 0).toLocaleString('es-MX')}
                            </span>
                            {(deliveredByItem[it.id] ?? 0) >= it.quantity && it.quantity > 0 && <span style={{ fontSize: 16 }} title="Completado">✅</span>}
                          </div>
                        </td>
                        <td>
                          <input className="input boxed" type="text" style={{ width: 70 }}
                            defaultValue={it.unit} onBlur={e => updateItem(i, 'unit', e.target.value)} disabled={readOnly} />
                        </td>
                        <td>
                          <input className="input boxed mono" type="text" style={{ width: 100 }} placeholder="Opcional"
                            defaultValue={it.code || ''} onBlur={e => updateItem(i, 'code', e.target.value)} disabled={readOnly} />
                        </td>
                        <td>
                          <input className="input boxed" type="text" list="catalog-products" style={{ minWidth: 200 }}
                            defaultValue={it.description} onBlur={e => updateItem(i, 'description', e.target.value)} disabled={readOnly} />
                        </td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {(() => {
                              const cat = products?.find((p: any) => p.description === it.description);
                              const cp = cat?.defaultPrice || 0;
                              const difiere = cp > 0 && Math.abs(it.unitPrice - cp) > 0.01;
                              return difiere ? (
                                <span title={`Difiere del catálogo (${money(cp)})`} style={{ cursor: 'help', fontSize: 16 }}>⚠️</span>
                              ) : null;
                            })()}
                            <input className="input boxed mono" type="number" step="0.01" style={{ width: 80 }}
                              defaultValue={it.unitPrice} onBlur={e => updateItem(i, 'unitPrice', Number(e.target.value))} disabled={readOnly} />
                          </div>
                        </td>
                        <td className="num mono" style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                          {money(it.amount)}
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                          {!readOnly && <button className="btn btn-icon" title="Eliminar partida" aria-label="Eliminar partida" onClick={() => removeItem(i)}>🗑️</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Suma Importes:</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>
                        {money(form.items.reduce((acc: number, it: PurchaseOrderItem) => acc + it.amount, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
  );
}
