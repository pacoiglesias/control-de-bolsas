import { useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db, PATHS } from '../lib/firebase';
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { Card, Field, Skeleton, Drawer } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { safeDeleteDoc } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { confirmDialog } from '../lib/confirmDialog';
import { triggerHaptic } from '../lib/hapticEngine';

import { toDate } from '../lib/format';

export default function Catalog() {
  const { user } = useAuth();
  const { products, loading: pLoad, error: pErr } = useProducts();
  const { orders, loading: oLoad, error: oErr } = useOrders();
  const toast = useToast();

  const [nuevo, setNuevo] = useState({ code: '', description: '', unit: 'kg', defaultPrice: '' });
  const [creando, setCreando] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [search, setSearch] = useState('');

  const analytics = useMemo(() => {
    if (!products || !orders) return [];

    return products
      .map((product) => {
        const dates: Date[] = [];
        let totalQty = 0;
        let orderCount = 0;

        orders.forEach((o) => {
          if (o.items && o.items.length > 0) {
            const match = product.code
              ? o.items.find((it) => (it.code ?? '').trim().toLowerCase() === product.code!.trim().toLowerCase())
              : o.items.find((it) => (it.description || '').trim().toLowerCase() === (product.description || '').trim().toLowerCase());
            if (match) {
              orderCount++;
              totalQty += Number(match.quantity) || 0;
              const d =
                toDate(o.estimatedDeliveryDate) ||
                toDate(o.processedAt) ||
                toDate((o as any).createdAt) ||
                toDate(o.invoices?.[0]?.creditCycle?.issueDate);
              if (d) dates.push(d);
            }
          }
        });

        dates.sort((a, b) => a.getTime() - b.getTime());

        let avgDays = 0;
        let nextDate: Date | null = null;
        let status: 'red' | 'yellow' | 'green' | 'unknown' = 'unknown';

        if (dates.length > 1) {
          let totalDiff = 0;
          for (let i = 1; i < dates.length; i++) {
            totalDiff += dates[i].getTime() - dates[i - 1].getTime();
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
          orderCount,
          totalQty,
          lastDate,
          avgDays,
          nextDate,
          status,
        };
      })
      .sort((a, b) => {
        const rank = { red: 1, yellow: 2, green: 3, unknown: 4 };
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        if (a.nextDate && b.nextDate) return a.nextDate.getTime() - b.nextDate.getTime();
        return b.orderCount - a.orderCount;
      });
  }, [products, orders]);

  const analyticsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return analytics;
    return analytics.filter(
      (p) => (p.description || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
    );
  }, [analytics, search]);

  if (pLoad || oLoad)
    return (
      <div className="content">
        <Skeleton className="skeleton-card" style={{ height: 200, marginBottom: 24 }} />
        <Skeleton className="skeleton-card" style={{ height: 400 }} />
      </div>
    );
  if (pErr || oErr) return <div className="alert bad">Error cargando catálogo</div>;

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>CATÁLOGO DE PRODUCTOS</h1>
          <p>Catálogo inteligente con análisis predictivo de demanda basado en historial de pedidos.</p>
        </div>
      </div>

      <Card title="Agregar Producto al Catálogo">
        <div className="form-grid">
          <Field label="Código (SKU)">
            <input
              className="input boxed mono"
              value={nuevo.code}
              onChange={(e) => setNuevo({ ...nuevo, code: e.target.value })}
              placeholder="ej. EGBO000006-SC"
            />
          </Field>
          <Field label="Descripción / Medida Oficial">
            <input
              className="input boxed"
              value={nuevo.description}
              onChange={(e) => setNuevo({ ...nuevo, description: e.target.value })}
              placeholder="ej. BOLSA ROLLO 120X125 CM C/FUELLE"
            />
          </Field>
          <Field label="Unidad">
            <input
              className="input boxed"
              value={nuevo.unit}
              onChange={(e) => setNuevo({ ...nuevo, unit: e.target.value })}
            />
          </Field>
          <Field label="Precio Sugerido">
            <input
              className="input boxed mono"
              type="number"
              step="0.01"
              value={nuevo.defaultPrice}
              onChange={(e) => setNuevo({ ...nuevo, defaultPrice: e.target.value })}
              placeholder="43.00"
            />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary"
            style={{ minHeight: 42, padding: '0 20px', fontWeight: 800 }}
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
                triggerHaptic('success');
                toast(`Producto "${nuevo.description}" agregado al catálogo.`, 'ok');
                setNuevo({ code: '', description: '', unit: 'kg', defaultPrice: '' });
              } catch (e) {
                triggerHaptic('error');
                toast(`No se pudo agregar: ${(e as Error).message}`, 'bad');
              } finally {
                setCreando(false);
              }
            }}
          >
            {creando ? 'Agregando…' : '+ Agregar Producto'}
          </motion.button>

          <span style={{ color: 'var(--ink-soft, #94a3b8)', fontSize: '13px' }}>ó</span>

          <motion.label
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            style={{
              cursor: 'pointer',
              margin: 0,
              minHeight: 42,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--paper-sunk, rgba(255,255,255,0.05))',
              border: '1px solid var(--line, rgba(255,255,255,0.1))',
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
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
                        const code = String(
                          row['Código'] || row['codigo'] || row['Codigo'] || row['sku'] || ''
                        ).trim();
                        const desc = String(
                          row['Nombre'] || row['nombre'] || row['descripción'] || row['description'] || ''
                        ).trim();
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
                      triggerHaptic('success');
                      toast(`Se importaron ${added} productos desde el Excel.`, 'ok');
                    } catch (err: any) {
                      triggerHaptic('error');
                      toast(`Error procesando Excel: ${err.message}`, 'bad');
                    } finally {
                      setCreando(false);
                      if (e.target) e.target.value = '';
                    }
                  };
                  reader.onerror = () => {
                    triggerHaptic('error');
                    toast('Error al leer el archivo.', 'bad');
                    setCreando(false);
                  };
                  reader.readAsArrayBuffer(file);
                } catch (err: any) {
                  triggerHaptic('error');
                  toast(`Error general: ${err.message}`, 'bad');
                  setCreando(false);
                }
              }}
            />
          </motion.label>
        </div>
      </Card>

      <Card title="Productos Registrados & Pronóstico de Demanda">
        {analytics.length === 0 ? (
          <p className="hint">
            Aún no hay productos en tu catálogo. Se agregarán automáticamente al registrar nuevas órdenes.
          </p>
        ) : (
          <>
            <div style={{ position: 'relative', width: '100%', maxWidth: 440, marginBottom: 20 }}>
              <input
                className="search-input"
                type="search"
                placeholder="🔍 Buscar por descripción o SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border, rgba(255,255,255,0.12))',
                  background: 'var(--paper-sunk, rgba(0,0,0,0.2))',
                  color: 'var(--ink, #f1f5f9)',
                  fontSize: 13.5,
                  outline: 'none',
                }}
              />
            </div>
            {analyticsFiltrados.length === 0 ? (
              <p className="hint">Ningún producto coincide con "{search}".</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 16,
                  padding: '4px 0',
                }}
              >
                {analyticsFiltrados.map((p, index) => {
                  const statusColors = {
                    red: { border: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'Demanda Inminente' },
                    yellow: { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', label: 'Próximo Pedido' },
                    green: { border: '#10b981', bg: 'rgba(16,185,129,0.12)', text: '#10b981', label: 'Surtido Reciente' },
                    unknown: { border: 'rgba(255,255,255,0.1)', bg: 'rgba(255,255,255,0.05)', text: 'var(--ink-soft)', label: 'Sin Proyección' },
                  };
                  const colorConfig = statusColors[p.status];

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.2) }}
                      whileHover={{ y: -3, scale: 1.01 }}
                      key={p.id}
                      style={{
                        background: 'var(--surface-raised, rgba(255, 255, 255, 0.025))',
                        backdropFilter: 'blur(14px)',
                        WebkitBackdropFilter: 'blur(14px)',
                        border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                        borderTop: `3px solid ${colorConfig.border}`,
                        borderRadius: 16,
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: '0 4px 16px -2px rgba(0,0,0,0.08)',
                        position: 'relative',
                      }}
                    >
                      <button
                        className="btn-icon"
                        style={{
                          position: 'absolute',
                          top: 14,
                          right: 14,
                          opacity: 0.4,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--ink)',
                          cursor: 'pointer',
                          fontSize: 14,
                        }}
                        title="Eliminar del catálogo"
                        onClick={async () => {
                          triggerHaptic('warning');
                          if (
                            !(await confirmDialog({
                              message: `¿Eliminar "${p.description}" del catálogo?`,
                              danger: true,
                            }))
                          )
                            return;
                          try {
                            await safeDeleteDoc(user?.email, doc(db, PATHS.products, p.id), p);
                            triggerHaptic('success');
                            toast('Producto eliminado del catálogo.', 'ok');
                          } catch (err) {
                            triggerHaptic('error');
                            toast(`No se pudo eliminar: ${(err as Error).message}`, 'bad');
                          }
                        }}
                      >
                        ✕
                      </button>

                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingRight: 28 }}>
                        <div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: colorConfig.bg,
                              color: colorConfig.text,
                              display: 'inline-block',
                              marginBottom: 6,
                            }}
                          >
                            {colorConfig.label}
                          </span>
                          <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--ink, #f1f5f9)', lineHeight: 1.3 }}>
                            {p.description}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: 'var(--paper-sunk, rgba(0,0,0,0.2))',
                          padding: '8px 12px',
                          borderRadius: 10,
                          fontSize: 12.5,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--ink-soft, #94a3b8)', fontSize: 11 }}>SKU: </span>
                          <strong className="mono" style={{ color: 'var(--ink, #fff)' }}>
                            {p.code || '—'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--ink-soft, #94a3b8)', fontSize: 11 }}>Precio: </span>
                          <strong className="mono" style={{ color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                            ${Number(p.defaultPrice || 0).toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--ink-soft, #94a3b8)', fontSize: 11 }}>Ud: </span>
                          <strong style={{ color: 'var(--ink, #fff)' }}>{p.unit}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div
                          style={{
                            background: 'var(--paper-sunk, rgba(0,0,0,0.15))',
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--line-soft, rgba(255,255,255,0.05))',
                          }}
                        >
                          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700, marginBottom: 2 }}>
                            Histórico
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #f1f5f9)' }}>
                            {p.orderCount} pedidos <span style={{ opacity: 0.6, fontSize: 11.5 }}>({p.totalQty.toLocaleString('es-MX')} {p.unit})</span>
                          </div>
                        </div>
                        <div
                          style={{
                            background: 'var(--paper-sunk, rgba(0,0,0,0.15))',
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid var(--line-soft, rgba(255,255,255,0.05))',
                          }}
                        >
                          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 700, marginBottom: 2 }}>
                            Frecuencia
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #f1f5f9)' }}>
                            {p.avgDays > 0 ? `Cada ${Math.round(p.avgDays)} días` : '—'}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px solid var(--line-soft, rgba(255,255,255,0.06))',
                          paddingTop: 10,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ color: 'var(--ink-soft, #94a3b8)' }}>
                          Último: <strong style={{ color: 'var(--ink)' }}>{p.lastDate ? p.lastDate.toLocaleDateString('es-MX') : '—'}</strong>
                        </div>
                        <div style={{ color: colorConfig.text }}>
                          Próximo: <strong style={{ fontWeight: 800 }}>{p.nextDate ? p.nextDate.toLocaleDateString('es-MX') : '—'}</strong>
                        </div>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="btn"
                        style={{
                          width: '100%',
                          minHeight: 38,
                          fontSize: 12.5,
                          fontWeight: 700,
                          background: 'var(--paper-sunk, rgba(255,255,255,0.05))',
                          border: '1px solid var(--line, rgba(255,255,255,0.1))',
                          borderRadius: 8,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          triggerHaptic('light');
                          setEditingProduct(p);
                        }}
                      >
                        ✏️ Editar Producto
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>

      {editingProduct && (
        <EditProductDrawer product={editingProduct} onClose={() => setEditingProduct(null)} />
      )}
    </>
  );
}

function EditProductDrawer({ product, onClose }: { product: any; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    code: product.code || '',
    description: product.description || '',
    unit: product.unit || '',
    defaultPrice: product.defaultPrice || 0,
  });
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!form.description.trim()) {
      return toast('La descripción es obligatoria', 'bad');
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, PATHS.products, product.id), {
        code: form.code.trim(),
        description: form.description.trim(),
        unit: form.unit.trim(),
        defaultPrice: Number(form.defaultPrice),
      });
      triggerHaptic('success');
      toast('Producto actualizado correctamente', 'ok');
      onClose();
    } catch (err: any) {
      triggerHaptic('error');
      toast(`Error al actualizar: ${err.message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer title="Editar Producto" onClose={onClose} width={500}>
      <div className="form-grid">
        <Field label="Código (SKU)">
          <input
            className="input boxed mono"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </Field>
        <Field label="Descripción">
          <input
            className="input boxed"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Unidad">
          <input
            className="input boxed"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
        </Field>
        <Field label="Precio Sugerido">
          <input
            className="input boxed mono"
            type="number"
            step="0.01"
            value={form.defaultPrice}
            onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
          />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary"
          style={{ flex: 1, minHeight: 44, fontWeight: 800 }}
          onClick={handleSave}
          disabled={busy}
        >
          {busy ? 'Guardando...' : 'Guardar Cambios'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn"
          style={{ flex: 1, minHeight: 44 }}
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </motion.button>
      </div>
    </Drawer>
  );
}
