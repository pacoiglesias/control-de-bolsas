import { useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { PasteTextModal } from '../PasteTextModal';
import { money } from '../../lib/format';
import type { PurchaseOrderItem } from '../../lib/types';
import { processPdfOrder } from '../../lib/ocr';

export default function TabProductos() {
  const ctx = useOrderModal();
  const [pegandoOC, setPegandoOC] = useState(false);
  if (!ctx) return null;
  const { form, setForm, readOnly, kilosEntregados, kilosPedidos, kilosFaltantes, deliveredByItem, toast, addItem, updateItem, removeItem } = ctx;

  /**
   * Extrae folio, proveedor y CADA ARTICULO (codigo, descripcion, cantidad,
   * precio) del texto pegado de una OC. Antes vivia embebido dentro de un
   * window.prompt() de una sola linea -- fragil para pegar un documento
   * completo. Ahora recibe el texto ya capturado por un modal de verdad.
   */
  function handlePasteOC(text: string) {
    if (!text) return;

    const lines = text.split('\n');
    const newItems: PurchaseOrderItem[] = [];

    for (const line of lines) {
      const numsMatch = line.match(/(.*?)\s+((?:[\d,]+\.\d{2,4}\s*)+)$/);
      if (numsMatch) {
        const rawDesc = numsMatch[1].trim();
        const nums = numsMatch[2].trim().split(/\s+/).map(n => Number(n.replace(/,/g, '')));

        if (nums.length >= 3 && !rawDesc.toLowerCase().includes('subtotal') && !rawDesc.toLowerCase().includes('total')) {
          let code = '';
          let cleanDesc = rawDesc;
          const parts = cleanDesc.split(/\s+/);
          if (/^\d+$/.test(parts[0])) {
            parts.shift(); // Remove leading row number
          }
          // Check if first word looks like a product code (letters+numbers or hyphens, >4 chars)
          if (parts.length > 1 && /^[a-zA-Z0-9-]{5,}$/.test(parts[0])) {
            code = parts.shift() || '';
          }
          cleanDesc = parts.join(' ');

          newItems.push({
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            code: code,
            description: cleanDesc,
            quantity: nums[0],
            unitPrice: nums[1],
            amount: nums[nums.length - 1],
            unit: 'Kilos'
          });
        }
      }
    }

    let newFolio = form.folio;
    let newOc = (form as any).oc;
    let newProvider = form.provider;
    let newClient = form.client;

    // Folio (interno, corto, ej "71/14014") y OC (numero real y largo de
    // la Orden de Compra, ej "120267114014") son DOS documentos distintos
    // -- no deben mezclarse ni pisarse uno al otro. Antes solo se
    // capturaba uno de los dos (el que apareciera primero en el texto),
    // descartando el otro por completo.
    const folioMatch = text.match(/No\.?\s*Ord(?:en)?\.?\s*de\s*Compra:\s*([^\n]+)/i);
    const ocMatch = text.match(/CDB OC:\s*([^\n]+)/i) || text.match(/Orden de Compra\s*\n\s*([^\n]+)/i);
    if (!newFolio && folioMatch) newFolio = folioMatch[1].trim();
    if (!newOc && ocMatch) newOc = ocMatch[1].trim();

    const providerMatch = text.match(/Proveedor\s*\n\s*([^\n]+)/i);
    if (!newProvider && providerMatch) {
      newProvider = providerMatch[1].trim();
    }

    if (!newClient && lines.length > 0) {
      const firstLine = lines[0].split('|')[0].trim();
      if (firstLine.length > 5 && firstLine.length < 100 && !firstLine.includes(':')) {
        newClient = firstLine;
      }
    }

    if (newItems.length > 0 || newFolio !== form.folio || newOc !== (form as any).oc) {
      setForm((f: any) => ({
        ...f,
        folio: newFolio,
        oc: newOc,
        provider: newProvider,
        client: newClient,
        items: [...f.items, ...newItems],
        totalKilograms: newItems.length > 0 ? String(newItems.reduce((acc, it) => acc + (it.quantity || 0), 0)) : f.totalKilograms
      }));
      toast(`Detectado: ${newItems.length} artículos. Folio: ${newFolio || 'N/A'} · OC: ${newOc || 'N/A'}.`, 'ok');
    } else {
      toast('No se detectó ningún artículo detallado, pero el texto fue analizado.', 'info');
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    toast('🤖 Analizando documento con Inteligencia Local...', 'info');
    try {
      const ocrResult = await processPdfOrder(file);
      console.log('OCR Output:', ocrResult);
      handlePasteOC(ocrResult.rawText);
      
      // Fallback update if handlePasteOC failed to find anything
      setForm((f: any) => ({
        ...f,
        folio: f.folio || ocrResult.folio || '',
        oc: f.oc || ocrResult.folio || '',
        totalKilograms: f.totalKilograms || (ocrResult.kilos ? String(ocrResult.kilos) : f.totalKilograms),
        items: f.items.length === 0 && ocrResult.product ? [{
          id: Date.now().toString(),
          code: '',
          description: ocrResult.product,
          quantity: ocrResult.kilos || 0,
          unitPrice: ocrResult.kilos && ocrResult.total ? ocrResult.total / ocrResult.kilos : 0,
          amount: ocrResult.total || 0,
          unit: 'Kilos'
        }] : f.items
      }));
      
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
                onConfirm={handlePasteOC}
                onClose={() => setPegandoOC(false)}
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
              <div className="table-scroll">
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
                          <input className="input boxed mono" type="number" step="0.01" style={{ width: 80 }}
                            defaultValue={it.unitPrice} onBlur={e => updateItem(i, 'unitPrice', Number(e.target.value))} disabled={readOnly} />
                        </td>
                        <td className="num mono" style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                          {money(it.amount)}
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                          {!readOnly && <button className="btn btn-icon" onClick={() => removeItem(i)}>🗑️</button>}
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
