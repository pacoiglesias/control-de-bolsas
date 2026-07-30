import { useMemo } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useOrders } from '../hooks/useOrders';
import { Card, Spinner } from '../components/ui';
import { money } from '../lib/format';

export default function Catalog() {
  const { products, loading: pLoad, error: pErr } = useProducts();
  const { orders, loading: oLoad, error: oErr } = useOrders();

  const analytics = useMemo(() => {
    if (!products || !orders) return [];

    return products.map(product => {
      const dates: Date[] = [];
      let totalQty = 0;

      orders.forEach(o => {
        if (o.items) {
          const match = o.items.find(it => it.description === product.description);
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
                              const { doc, updateDoc } = await import('firebase/firestore');
                              const { db } = await import('../lib/firebase');
                              await updateDoc(doc(db, 'products', p.id), { code: e.target.value });
                            } catch (err) {
                              console.error('Error al guardar código:', err);
                            }
                          }
                        }}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.description}</td>
                    <td className="num mono">{money(p.defaultPrice)} <span style={{fontSize:10, color:'#666'}}>/{p.unit}</span></td>
                    <td className="num">{p.orderCount}</td>
                    <td className="num">{p.totalQty.toLocaleString('es-MX')} {p.unit}</td>
                    <td className="mono">{p.lastDate ? p.lastDate.toLocaleDateString('es-MX') : '—'}</td>
                    <td className="num">{p.avgDays > 0 ? `Cada ${Math.round(p.avgDays)} días` : '—'}</td>
                    <td className="mono" style={{ fontWeight: p.status === 'red' ? 700 : 400, color: p.status === 'red' ? 'var(--bad)' : 'inherit' }}>
                      {p.nextDate ? p.nextDate.toLocaleDateString('es-MX') : '—'}
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
