import { useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { Card, Field, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { safeDeleteDoc } from '../lib/logger';
import { useAuth } from '../context/AuthContext';

export default function Catalog() {
  const { user } = useAuth();
  const { products, loading: pLoad, error: pErr } = useProducts();
  const { orders, loading: oLoad, error: oErr } = useOrders();
  const toast = useToast();
  // Antes esta pantalla era solo de analisis: se podia editar el codigo de
  // un producto haciendo clic, pero no habia forma de dar de alta uno nuevo
  // ni de corregir descripcion, unidad o precio sin ir a otra pantalla.
  const [nuevo, setNuevo] = useState({ code: '', description: '', unit: 'kg', defaultPrice: '' });
  const [creando, setCreando] = useState(false);

  const analytics = useMemo(() => {
    if (!products || !orders) return [];

    return products.map(product => {
      const dates: Date[] = [];
      let totalQty = 0;

      orders.forEach(o => {
        if (o.items) {
          // Por codigo primero: es el identificador estable. La coincidencia
          // por descripcion exacta se queda solo como respaldo para renglones
          // viejos capturados antes de que existiera el campo `code` — un
          // espacio de mas o una mayuscula distinta bastaba para que nunca
          // hiciera match y el producto pareciera "sin historial" sin serlo.
          const match = product.code
            ? o.items.find(it => (it.code ?? '').trim().toLowerCase() === product.code!.trim().toLowerCase())
            : o.items.find(it => it.description === product.description);
          if (match) {
            totalQty += match.quantity;
            // Usar la fecha de promesa si existe, sino la de proceso.
            const d = o.estimatedDeliveryDate?.toDate() || o.processedAt?.toDate();
            if (d) dates.push(d);
          }
        }
      });

      dates.sort((a, b) => a.getTime() - b.getTime());

      let avgDays = 0;
      let nextDate: Date | null = null;
      let status: 'green' | 'yellow' | 'red' | 'unknown' = 'unknown';

      if (dates.length > 1) {
        let totalDiff = 0;
        for (let i = 1; i < dates.length; i++) {
          totalDiff += (dates[i].getTime() - dates[i - 1].getTime());
        }
        avgDays = totalDiff / (dates.length - 1) / (1000 * 3600 * 24);
      }

      const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;

      if (lastDate && avgDays > 0) {
        nextDate = new Date(lastDate.getTime() + avgDays * 1000 * 3600 * 24);
        const daysToNext = (nextDate.getTime() - Date.now()) / (1000 * 3600 * 24);

        if (daysToNext <= 7) status = 'red';
        else if (daysToNext <= 15) status = 'yellow';
        else status = 'green';
      }

      return {
        ...product,
        orderCount: dates.length,
        totalQty,
        lastDate,
        avgDays,
        nextDate,
        status,
      };
    }).sort((a, b) => {
      // Sort: red first, then yellow, then green, then unknown
      const rank = { red: 1, yellow: 2, green: 3, unknown: 4 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      // Secondary sort: closest nextDate
      if (a.nextDate && b.nextDate) return a.nextDate.getTime() - b.nextDate.getTime();
      return b.orderCount - a.orderCount;
    });
  }, [products, orders]);

  if (pLoad || oLoad) return <Spinner />;
  if (pErr || oErr) return <div className="alert bad">Error cargando catálogo</div>;

  return (
    <>
      <div className="page-head">
        <h1>Catálogo Inteligente</h1>
        <p>Análisis predictivo de demanda basado en tu historial de pedidos.</p>
      </div>

      <Card title="Agregar producto nuevo">
        <div className="form-grid">
          <Field label="Código">
            <input className="input boxed mono" value={nuevo.code} onChange={(e) => setNuevo({ ...nuevo, code: e.target.value })} placeholder="ej. enbo000006-sc" />
          </Field>
          <Field label="Descripción">
            <input className="input boxed" value={nuevo.description} onChange={(e) => setNuevo({ ...nuevo, description: e.target.value })} placeholder="ej. Bolsa Polietileno 77 CM X 55 CM" />
          </Field>
          <Field label="Unidad">
            <input className="input boxed" value={nuevo.unit} onChange={(e) => setNuevo({ ...nuevo, unit: e.target.value })} />
          </Field>
          <Field label="Precio sugerido">
            <input className="input boxed mono" type="number" step="0.01" value={nuevo.defaultPrice} onChange={(e) => setNuevo({ ...nuevo, defaultPrice: e.target.value })} placeholder="0.00" />
          </Field>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', marginTop: 12, alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            disabled={creando || !nuevo.description.trim()}
            onClick={async () => {
              setCreando(true);
              try {
                await addDoc(collection(db, PATHS.products), {
                  code: nuevo.code.trim(),
                  description: nuevo.description.trim(),
                  unit: nuevo.unit.trim() || 'kg',
                  defaultPrice: Number(nuevo.defaultPrice) || 0,
                  createdAt: serverTimestamp(),
                });
                toast(`Producto "${nuevo.description}" agregado al catálogo.`, 'ok');
                setNuevo({ code: '', description: '', unit: 'kg', defaultPrice: '' });
              } catch (e) {
                toast(`No se pudo agregar: ${(e as Error).message}`, 'bad');
              } finally {
                setCreando(false);
              }
            }}
          >
            {creando ? 'Agregando…' : '+ Agregar Producto'}
          </button>

          <span style={{ color: 'var(--text-light)', fontSize: '13px' }}>ó</span>

          <label className="btn" style={{ cursor: 'pointer', margin: 0 }}>
            {creando ? 'Procesando...' : '📄 Importar CSV (Código, Nombre, Precio)'}
            <input 
              type="file" 
              accept=".csv" 
              style={{ display: 'none' }}
              disabled={creando}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCreando(true);
                try {
                  const text = await file.text();
                  const lines = text.split('\n');
                  let added = 0;
                  for (const line of lines) {
                    if (!line.trim()) continue;
                    const parts = line.split(',');
                    // code, desc..., price
                    const code = parts[0]?.trim() || '';
                    if (code.toLowerCase() === 'sku' || code.toLowerCase() === 'código' || code.toLowerCase() === 'codigo') continue;
                    const priceRaw = parts[parts.length - 1]?.trim() || '0';
                    const desc = parts.slice(1, -1).join(',').replace(/^"|"$/g, '').trim(); 
                    if (!desc) continue;

                    await addDoc(collection(db, PATHS.products), {
                      code,
                      description: desc,
                      unit: 'kg',
                      defaultPrice: Number(priceRaw) || 0,
                      createdAt: serverTimestamp(),
                    });
                    added++;
                  }
                  toast(`Se importaron ${added} productos desde el CSV.`, 'ok');
                } catch (err: any) {
                  toast(`Error al importar CSV: ${err.message}`, 'bad');
                } finally {
                  setCreando(false);
                  if (e.target) e.target.value = '';
                }
              }}
            />
          </label>
        </div>
      </Card>

      <Card title="Productos Registrados">
        {analytics.length === 0 ? (
          <p className="hint">Aún no hay productos en tu catálogo. Se agregarán automáticamente al guardar nuevas órdenes.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Semáforo</th>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th className="num">Precio Sug.</th>
                  <th className="num">Veces Pedido</th>
                  <th className="num">Total Histórico</th>
                  <th>Último Pedido</th>
                  <th className="num">Frecuencia</th>
                  <th>Próximo Esperado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {analytics.map(p => (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center' }}>
                      {p.status === 'red' && <span title="Ya deberían pedir pronto o van tarde" style={{ fontSize: 20 }}>🔴</span>}
                      {p.status === 'yellow' && <span title="Pedido próximo" style={{ fontSize: 20 }}>🟡</span>}
                      {p.status === 'green' && <span title="Surtido recientemente" style={{ fontSize: 20 }}>🟢</span>}
                      {p.status === 'unknown' && <span title="Faltan datos para predecir (sólo 1 pedido)" style={{ fontSize: 20 }}>⚪</span>}
                    </td>
                    <td className="mono">
                      <input
                        className="input boxed mono"
                        style={{ width: '100px', fontSize: '12px' }}
                        defaultValue={p.code || ''}
                        placeholder="Sin código"
                        onBlur={async (e) => {
                          if (e.target.value !== (p.code || '')) {
                            try {
                              await updateDoc(doc(db, PATHS.products, p.id), { code: e.target.value.trim() });
                            } catch (err) {
                              toast(`No se pudo guardar el código: ${(err as Error).message}`, 'bad');
                            }
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="input boxed"
                        style={{ minWidth: 220, fontWeight: 600 }}
                        defaultValue={p.description}
                        onBlur={async (e) => {
                          if (e.target.value.trim() && e.target.value !== p.description) {
                            try {
                              await updateDoc(doc(db, PATHS.products, p.id), { description: e.target.value.trim() });
                            } catch (err) {
                              toast(`No se pudo guardar la descripción: ${(err as Error).message}`, 'bad');
                            }
                          }
                        }}
                      />
                    </td>
                    <td className="num mono">
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <input
                          className="input boxed mono"
                          style={{ width: 80 }}
                          type="number" step="0.01"
                          defaultValue={p.defaultPrice}
                          onBlur={async (e) => {
                            const v = Number(e.target.value);
                            if (!isNaN(v) && v !== p.defaultPrice) {
                              try {
                                await updateDoc(doc(db, PATHS.products, p.id), { defaultPrice: v });
                              } catch (err) {
                                toast(`No se pudo guardar el precio: ${(err as Error).message}`, 'bad');
                              }
                            }
                          }}
                        />
                        <input
                          className="input boxed"
                          style={{ width: 50, fontSize: 11 }}
                          defaultValue={p.unit}
                          onBlur={async (e) => {
                            if (e.target.value.trim() && e.target.value !== p.unit) {
                              try {
                                await updateDoc(doc(db, PATHS.products, p.id), { unit: e.target.value.trim() });
                              } catch (err) {
                                toast(`No se pudo guardar la unidad: ${(err as Error).message}`, 'bad');
                              }
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td className="num">{p.orderCount}</td>
                    <td className="num">{p.totalQty.toLocaleString('es-MX')} {p.unit}</td>
                    <td className="mono">{p.lastDate ? p.lastDate.toLocaleDateString('es-MX') : '—'}</td>
                    <td className="num">{p.avgDays > 0 ? `Cada ${Math.round(p.avgDays)} días` : '—'}</td>
                    <td className="mono" style={{ fontWeight: p.status === 'red' ? 700 : 400, color: p.status === 'red' ? 'var(--bad)' : 'inherit' }}>
                      {p.nextDate ? p.nextDate.toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        title="Eliminar del catálogo (no borra el historial de pedidos)"
                        onClick={async () => {
                          if (!window.confirm(`¿Eliminar "${p.description}" del catálogo?`)) return;
                          try {
                            await safeDeleteDoc(user?.email, doc(db, PATHS.products, p.id), p);
                            toast('Producto eliminado del catálogo.', 'ok');
                          } catch (err) {
                            toast(`No se pudo eliminar: ${(err as Error).message}`, 'bad');
                          }
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
