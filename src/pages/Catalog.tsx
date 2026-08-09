import { useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db, PATHS } from '../lib/firebase';
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { Card, Field, Skeleton } from '../components/ui';
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

  if (pLoad || oLoad) return (
    <div className="content">
      <Skeleton className="skeleton-card" style={{ height: 200, marginBottom: 24 }} />
      <Skeleton className="skeleton-card" style={{ height: 400 }} />
    </div>
  );
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
            {creando ? 'Procesando...' : '📄 Importar Excel (.xlsx)'}
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls" 
              style={{ display: 'none' }}
              disabled={creando}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCreando(true);
                try {
                  const reader = new FileReader();
                  reader.onload = async (evt) => {
                    try {
                      const XLSX = await import('xlsx');
                      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                      const workbook = XLSX.read(data, { type: 'array' });
                      const sheetName = workbook.SheetNames[0];
                      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
                      
                      let added = 0;
                      for (const row of rows) {
                        // Tolerar distintas capitalizaciones en el Excel
                        const code = String(row['Código'] || row['codigo'] || row['Codigo'] || row['sku'] || '').trim();
                        const desc = String(row['Nombre'] || row['nombre'] || row['descripción'] || row['description'] || '').trim();
                        const price = Number(row['Precio'] || row['precio'] || row['price'] || 0);
                        
                        if (!desc) continue; 
                        
                        await addDoc(collection(db, PATHS.products), {
                          code,
                          description: desc,
                          unit: 'kg',
                          defaultPrice: price,
                          createdAt: serverTimestamp(),
                        });
                        added++;
                      }
                      toast(`Se importaron ${added} productos desde el Excel.`, 'ok');
                    } catch (err: any) {
                      toast(`Error procesando Excel: ${err.message}`, 'bad');
                    } finally {
                      setCreando(false);
                      if (e.target) e.target.value = '';
                    }
                  };
                  reader.onerror = () => {
                    toast('Error al leer el archivo.', 'bad');
                    setCreando(false);
                  };
                  reader.readAsArrayBuffer(file);
                } catch (err: any) {
                  toast(`Error general: ${err.message}`, 'bad');
                  setCreando(false);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, padding: '4px 0' }}>
            {analytics.map((p, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.2) }}
                key={p.id}
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 16,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  position: 'relative'
                }}
              >
                <button
                  className="btn-icon"
                  style={{ position: 'absolute', top: 12, right: 12, opacity: 0.5 }}
                  title="Eliminar del catálogo"
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 24 }}>
                  <div style={{ fontSize: 24, lineHeight: 1 }}>
                    {p.status === 'red' && <span title="Ya deberían pedir pronto o van tarde">🔴</span>}
                    {p.status === 'yellow' && <span title="Pedido próximo">🟡</span>}
                    {p.status === 'green' && <span title="Surtido recientemente">🟢</span>}
                    {p.status === 'unknown' && <span title="Faltan datos para predecir">⚪</span>}
                  </div>
                  <input
                    className="input boxed"
                    style={{ flex: 1, fontWeight: 700, fontSize: 16, padding: '8px 12px', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)' }}
                    defaultValue={p.description}
                    placeholder="Descripción del producto"
                    onBlur={async (e) => {
                      if (e.target.value.trim() && e.target.value !== p.description) {
                        try {
                          await updateDoc(doc(db, PATHS.products, p.id), { description: e.target.value.trim() });
                        } catch (err) {
                          toast(`Error: ${(err as Error).message}`, 'bad');
                        }
                      }
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input boxed mono"
                    style={{ flex: 1, fontSize: 13, background: 'rgba(255,255,255,0.5)' }}
                    defaultValue={p.code || ''}
                    placeholder="SKU / Código"
                    onBlur={async (e) => {
                      if (e.target.value !== (p.code || '')) {
                        try {
                          await updateDoc(doc(db, PATHS.products, p.id), { code: e.target.value.trim() });
                        } catch (err) {
                          toast(`Error: ${(err as Error).message}`, 'bad');
                        }
                      }
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4, width: '120px' }}>
                    <input
                      className="input boxed mono"
                      style={{ flex: 2, background: 'rgba(255,255,255,0.5)' }}
                      type="number" step="0.01"
                      defaultValue={p.defaultPrice}
                      placeholder="Precio"
                      onBlur={async (e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v) && v !== p.defaultPrice) {
                          try {
                            await updateDoc(doc(db, PATHS.products, p.id), { defaultPrice: v });
                          } catch (err) {
                            toast(`Error: ${(err as Error).message}`, 'bad');
                          }
                        }
                      }}
                    />
                    <input
                      className="input boxed"
                      style={{ flex: 1, padding: '0 4px', textAlign: 'center', background: 'rgba(255,255,255,0.5)' }}
                      defaultValue={p.unit}
                      placeholder="Ud"
                      onBlur={async (e) => {
                        if (e.target.value.trim() && e.target.value !== p.unit) {
                          try {
                            await updateDoc(doc(db, PATHS.products, p.id), { unit: e.target.value.trim() });
                          } catch (err) {
                            toast(`Error: ${(err as Error).message}`, 'bad');
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, minWidth: '45%', background: 'rgba(0,0,0,0.02)', padding: '10px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700, marginBottom: 2 }}>Histórico</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.orderCount} pedidos <span style={{ opacity: 0.5 }}>({p.totalQty.toLocaleString('es-MX')} {p.unit})</span></div>
                  </div>
                  <div style={{ flex: 1, minWidth: '45%', background: 'rgba(0,0,0,0.02)', padding: '10px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700, marginBottom: 2 }}>Frecuencia</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.avgDays > 0 ? `Cada ${Math.round(p.avgDays)} días` : '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    Último: <strong>{p.lastDate ? p.lastDate.toLocaleDateString('es-MX') : '—'}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: p.status === 'red' ? 'var(--bad)' : 'var(--ink)' }}>
                    Próximo: <strong style={{ fontWeight: 800 }}>{p.nextDate ? p.nextDate.toLocaleDateString('es-MX') : '—'}</strong>
                  </div>
                </div>

              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
