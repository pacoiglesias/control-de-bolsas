import { useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { Card, Empty, KpiCard, Skeleton, StatusBadge } from '../components/ui';
import OrderModal from './OrderModal';
import { AGING_BUCKETS, agingBucket, daysLate, getOrderSummary, type AgingKey } from '../lib/finance';
import { fmtDate, money, toDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { doc, Timestamp, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Invoice } from '../lib/types';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import type { PurchaseOrder } from '../lib/types';

export default function Cobranza() {
  const { orders, loading, error } = useOrders();
  const { role } = useAuth();
  const { config } = useConfig();
  const toast = useToast();
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [hoveredCr, setHoveredCr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'pagadas'>('pendientes');

  /**
   * Los tres campos que SIEMPRE deben viajar juntos al escribir facturas.
   *
   * invoiceStatuses es el arreglo desnormalizado que sostiene la consulta del
   * barrido nocturno. Solo OrderModal.save lo reescribia: las rutas de cobro
   * de esta pantalla actualizaban invoices y lo dejaban atras, asi que
   * facturas ya cobradas seguian figurando como "pending" en el indice y el
   * barrido diario las volvia a traer indefinidamente.
   */
  function camposInvoices(invoices: Invoice[]) {
    return {
      invoices,
      invoiceStatuses: invoices.map((i) => i.creditCycle?.status ?? 'pending'),
      updatedAt: serverTimestamp(),
    };
  }

  /** Aplica un cambio sobre UNA factura identificada por id, no por indice. */
  function aplicarPorId(
    invoices: Invoice[],
    invoiceId: string,
    cambio: (inv: Invoice) => Invoice,
  ): Invoice[] | null {
    const i = invoices.findIndex((x) => x.id === invoiceId);
    if (i < 0) return null;
    const copia = [...invoices];
    copia[i] = cambio(copia[i]);
    return copia;
  }

  async function toggleComplementStatus(orderId: string, invoiceId: string) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    const invIndex = o.invoices?.findIndex(i => i.id === invoiceId);
    if (invIndex === undefined || invIndex < 0) return;
    
    const inv = o.invoices![invIndex];
    const current = inv.collection?.complementStatus;
    const nextStatus = current === 'issued' ? 'pending' : 'issued';

    try {
      // Transaccion: se relee el expediente dentro de la operacion y el cambio
      // se aplica por id de factura. Con el patron anterior se escribia el
      // arreglo completo desde una copia local del snapshot, asi que dos
      // usuarios simultaneos —o un usuario y el procesador de complementos
      // XML— se pisaban: el ultimo en escribir borraba lo del otro.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe');

        const actuales: Invoice[] = snap.data().invoices ?? [];
        const nuevas = aplicarPorId(actuales, invoiceId, (x) => ({
          ...x,
          collection: { ...x.collection, complementStatus: nextStatus },
        }));
        if (!nuevas) throw new Error('La factura ya no está en el expediente');

        tx.update(ref, camposInvoices(nuevas));
      });
      toast(`Complemento marcado como ${nextStatus === 'issued' ? 'Emitido' : 'Pendiente'}`, 'ok');
    } catch (e) {
      toast(`Error al actualizar complemento: ${(e as Error).message}`, 'bad');
    }
  }

  async function payContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!window.confirm(`¿Seguro que quieres cobrar todas las facturas pendientes del Contrarecibo ${crNumber}?`)) return;
    
    const invoicesToPay = data.open.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    // Que facturas hay que tocar en cada expediente. Los datos frescos se
    // leen dentro de la transaccion, no de este snapshot.
    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToPay) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    try {
      // writeBatch garantizaba atomicidad (todo o nada) pero no aislamiento:
      // seguia escribiendo el arreglo completo desde una copia local. La
      // transaccion relee cada expediente y aplica los cambios por id.
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        // Firestore exige TODAS las lecturas antes de cualquier escritura.
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'paid' },
              collection: {
                ...x.collection,
                paidAmount: x.financials?.invoiceTotal ?? x.financials?.saleTotal ?? 0,
                paidAt: Timestamp.now(),
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      toast(`Contrarecibo ${crNumber} cobrado exitosamente`, 'ok');
    } catch (e) {
      toast(`Error al procesar el cobro en bloque: ${(e as Error).message}`, 'bad');
    }
  }

  async function undoContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!window.confirm(`¿Seguro que quieres DESHACER el cobro del Contrarecibo ${crNumber}? Las facturas volverán a pendientes.`)) return;
    
    const invoicesToUndo = data.paid.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToUndo) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'pending' },
              collection: {
                ...x.collection,
                paidAmount: 0,
                paidAt: undefined,
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      toast(`Cobro del Contrarecibo ${crNumber} deshecho.`, 'ok');
    } catch (e) {
      toast(`Error al deshacer cobro: ${(e as Error).message}`, 'bad');
    }
  }

  async function collectContrareciboBlock(crNumber: string, netUtilidad: number) {
    if (!crNumber) return;
    if (!window.confirm(`¿Recibiste el EFECTIVO/TRANSFERENCIA del Contrarecibo ${crNumber}? Se inyectará un Ingreso por $${netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})} en Caja Chica.`)) return;
    
    const invoicesToCollect = data.paid.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToCollect) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    try {
      // El movimiento de Caja Chica va DENTRO de la misma transaccion que el
      // cambio de estatus. Si se separaran, un fallo a la mitad podria dejar
      // el ingreso registrado sin las facturas marcadas, o al reves.
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'collected' },
              collection: { ...x.collection, collectedAt: Timestamp.now() },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });

        tx.set(doc(collection(db, PATHS.expenses)), {
          date: Timestamp.now(),
          concept: `Ingreso por Utilidad del Contrarecibo ${crNumber}`,
          type: 'ingreso',
          amount: netUtilidad,
          createdAt: Timestamp.now(),
        });
      });
      toast(`Contrarecibo ${crNumber} recogido. Utilidad inyectada en Caja Chica.`, 'ok');
    } catch (e) {
      toast(`Error al procesar la recolección en bloque: ${(e as Error).message}`, 'bad');
    }
  }

  function printConsolidatedCr(grp: {
    cr: string;
    client: string;
    folios: string[];
    totalKilos: number;
    totalVenta: number;
    costoAndres: number;
    comisionContador: number;
    netUtilidad: number;
    margenPct: number;
    status: string;
  }) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Paquete Consolidado CR - ${grp.cr}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; line-height: 1.4; }
            .header { border-bottom: 3px solid #222; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8f8f8; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
            th { background: #eee; font-weight: 700; }
            .summary-box { background: #eef7f2; border: 1px solid #2F7A52; padding: 15px; border-radius: 6px; margin-top: 20px; }
            .summary-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .summary-line.total { border-top: 2px solid #2F7A52; font-weight: 800; font-size: 16px; color: #2F7A52; padding-top: 8px; margin-top: 6px; }
            .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-box { text-align: center; border-top: 1px solid #000; padding-top: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>PAQUETE DE COBRO CONSOLIDADO</h1>
              <div>Control Bolsas ERP · Contrarecibo ${grp.cr}</div>
            </div>
            <div style="text-align:right;">
              <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX')}
            </div>
          </div>

          <div class="meta-grid">
            <div>
              <strong>Contrarecibo (CR):</strong> ${grp.cr}<br>
              <strong>Cliente:</strong> ${grp.client}<br>
              <strong>Factura(s):</strong> ${grp.folios.map(f => '#' + f).join(', ') || '—'}
            </div>
            <div style="text-align:right;">
              <strong>Proveedor Fabricante:</strong> Andrés (Sin Mermas)<br>
              <strong>Kilos Entregados:</strong> ${grp.totalKilos.toLocaleString('es-MX')} kg<br>
              <strong>Estado Cobro:</strong> ${grp.status}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Concepto / Referencia</th>
                <th style="text-align:right;">Kilos</th>
                <th style="text-align:right;">Venta Facturada</th>
                <th style="text-align:right;">Costo Andrés</th>
                <th style="text-align:right;">Comisión Contador</th>
                <th style="text-align:right;">Utilidad Líquida Real</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Contrarecibo ${grp.cr} (${grp.folios.map(f => '#' + f).join(', ')})</td>
                <td style="text-align:right;">${grp.totalKilos.toLocaleString('es-MX')} kg</td>
                <td style="text-align:right;">$${grp.totalVenta.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;color:#8A5A1E;">-$${grp.costoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;color:#B23A2E;">-$${grp.comisionContador.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;font-weight:700;color:#2F7A52;">$${grp.netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-line"><span>Total Facturado a Cliente (${grp.client}):</span><strong>$${grp.totalVenta.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line"><span>Costo Directo Fabricante Andrés (Sin mermas):</span><span style="color:#8A5A1E;">-$${grp.costoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span>Comisión Contador / Contabilidad:</span><span style="color:#B23A2E;">-$${grp.comisionContador.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line total">
              <span>UTILIDAD LÍQUIDA REAL (MARGEN: ${grp.margenPct.toFixed(2)}%):</span>
              <span>$${grp.netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">Firma y Sello de Recepción Cliente</div>
            <div class="sig-box">Autorización de Cobro y Entrada Caja Chica</div>
          </div>

          <script>
            window.onload = () => { window.print(); window.setTimeout(() => window.close(), 500); }
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  const data = useMemo(() => {
    // Extraer todas las facturas de todos los expedientes
    const allInvoices = orders.flatMap((o) => {
      const s = getOrderSummary(o);
      return s.invoices.map((inv) => ({ o, inv }));
    });

    const paid = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'paid',
    );

    const open = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'pending' || x.inv.creditCycle.status === 'overdue',
    );

    const saldo = (inv: (typeof allInvoices)[number]['inv']) =>
      Math.max((inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0) - (inv.collection?.paidAmount ?? 0), 0);

    const porCliente: Record<string, Record<AgingKey, number> & { total: number }> = {};
    open.forEach(({ o, inv }) => {
      const c = `${o.client?.trim() || '(sin cliente)'}${o.department ? ` - ${o.department}` : ''}`;
      porCliente[c] = porCliente[c] ?? { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0 };
      const b = agingBucket(toDate(inv.creditCycle.dueDate));
      const s = saldo(inv);
      porCliente[c][b] += s;
      porCliente[c].total += s;
    });
    const clientes = Object.keys(porCliente).sort((a, b) => porCliente[b].total - porCliente[a].total);

    const totalPorBucket = AGING_BUCKETS.reduce(
      (acc, b) => ({ ...acc, [b.key]: clientes.reduce((a, c) => a + porCliente[c][b.key], 0) }),
      {} as Record<AgingKey, number>,
    );

    const crCounts: Record<string, number> = {};
    open.forEach(({ o, inv }) => {
      const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
      if (cr) {
        crCounts[cr] = (crCounts[cr] || 0) + 1;
      }
    });

    // Agrupar facturas por número de Contrarecibo (CR) para calcular la Utilidad Líquida Real
    const crGroups: Record<string, {
      cr: string;
      client: string;
      folios: string[];
      totalKilos: number;
      totalVenta: number;
      costoAndres: number;
      comisionContador: number;
      netUtilidad: number;
      margenPct: number;
      status: string;
      order: PurchaseOrder;
    }> = {};

    allInvoices.forEach(({ o, inv }) => {
      const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || 'SIN-CR').trim();
      if (!crGroups[cr]) {
        crGroups[cr] = {
          cr,
          client: o.client || '—',
          folios: [],
          totalKilos: 0,
          totalVenta: 0,
          costoAndres: 0,
          comisionContador: 0,
          netUtilidad: 0,
          margenPct: 0,
          status: inv.creditCycle.status,
          order: o,
        };
      }
      const grp = crGroups[cr];
      if (inv.folio && !grp.folios.includes(inv.folio)) grp.folios.push(inv.folio);
      
      const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * config.salePricePerKg * (1 + config.ivaRate));
      const costAndres = inv.financials?.costTotal ?? (inv.kilos * config.costPricePerKg);
      const comm = inv.financials?.commission ?? (inv.kilos * config.salePricePerKg * config.commissionRate);

      grp.totalKilos += inv.kilos || 0;
      grp.totalVenta += invTotal;
      grp.costoAndres += costAndres;
      grp.comisionContador += comm;
    });

    Object.values(crGroups).forEach(grp => {
      grp.netUtilidad = grp.totalVenta - grp.costoAndres - grp.comisionContador;
      grp.margenPct = grp.totalVenta > 0 ? (grp.netUtilidad / grp.totalVenta) * 100 : 0;
    });

    const listaCr = Object.values(crGroups).sort((a, b) => b.totalVenta - a.totalVenta);

    const lista = open
      .map(({ o, inv }) => {
        const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
        const hasCr = cr.length > 0;
        const d = daysLate(toDate(inv.creditCycle.dueDate));
        return { o, inv, d, saldo: saldo(inv), hasCr, cr };
      })
      .sort((a, b) => {
        // Prioridad: Sin CR primero (urgentes), luego por días de vencimiento descendente
        if (a.hasCr !== b.hasCr) return a.hasCr ? 1 : -1;
        return (b.d ?? -999) - (a.d ?? -999);
      });

    return {
      open,
      paid,
      lista,
      listaCr,
      clientes,
      porCliente,
      totalPorBucket,
      crCounts,
      meDeben: open.reduce((a, x) => a + saldo(x.inv), 0),
      vencido: open
        .filter((x) => x.inv.creditCycle.status === 'overdue')
        .reduce((a, x) => a + saldo(x.inv), 0),
      cobrado: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid' || x.inv.creditCycle.status === 'collected')
        .reduce((a, x) => a + (x.inv.collection?.paidAmount ?? x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0),
      comisiones: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid' || x.inv.creditCycle.status === 'collected')
        .reduce((a, x) => a + (x.inv.financials?.commission ?? (x.inv.kilos * config.salePricePerKg * config.commissionRate)), 0),
    };
  }, [orders, config]);

  if (loading) {
    return (
      <>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 250, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: 350, height: 16 }} />
        </div>
        <div className="kpi-grid">
          {[1,2].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 85 }} />)}
        </div>
        <Card>
          <div style={{ padding: 20 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 48, marginBottom: 8 }} />)}
          </div>
        </Card>
      </>
    );
  }
  if (role === 'viewer') return <Navigate to="/" replace />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Contrarecibos / Cobranza</h1>
        <p>
          Lo que te deben, ordenado por antigüedad. Una orden deja de contar aquí en cuanto la
          marcas como cobrada; la comisión de contabilidad ya viene descontada del flujo neto.
        </p>
      </div>

      <div className="tabs" style={{ marginBottom: 20, marginTop: 20 }}>
        <button className={`tab ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>
          Pendientes de Cobro ({data.open.length})
        </button>
        <button className={`tab ${activeTab === 'pagadas' ? 'active' : ''}`} onClick={() => setActiveTab('pagadas')}>
          Historial: Ventas ya Pagadas (Por recoger) ({data.paid.length})
        </button>
      </div>

      {activeTab === 'pendientes' && (
        <>
          <div className="kpi-grid">
        <KpiCard hero tone={data.meDeben > 0 ? 'warn' : 'ok'} label="TE DEBEN" value={money(data.meDeben)}
          sub={`${data.open.length} órdenes abiertas`} />
        <KpiCard tone={data.vencido > 0 ? 'bad' : undefined} label="De eso, vencido" value={money(data.vencido)} />
        <KpiCard tone="cash" label="Ya cobrado" value={money(data.cobrado)} />
        <KpiCard label="Comisiones pagadas" value={money(data.comisiones)}
          sub={`${(config.commissionRate * 100).toFixed(1)}% sobre la venta`} />
      </div>

      <Card title="Antigüedad de saldos">
        {data.clientes.length === 0 ? (
          <Empty>Nadie te debe nada ahora mismo.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  {AGING_BUCKETS.map((b) => (
                    <th key={b.key} className="num">{b.label}</th>
                  ))}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.clientes.map((c) => (
                  <tr key={c}>
                    <td><strong>{c}</strong></td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b.key} className="num mono"
                        style={b.key === 'd90p' && data.porCliente[c][b.key] > 0 ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>
                        {data.porCliente[c][b.key] ? money(data.porCliente[c][b.key]) : '—'}
                      </td>
                    ))}
                    <td className="num mono" style={{ fontWeight: 700 }}>{money(data.porCliente[c].total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b.key} className="num">{money(data.totalPorBucket[b.key])}</td>
                  ))}
                  <td className="num">{money(data.meDeben)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Qué cobrar primero" hint={`${data.lista.length}`}>
        {data.lista.length === 0 ? (
          <Empty>No hay nada pendiente de cobro.</Empty>
        ) : (
          <>
          {/* Resumen rápido */}
          {(() => {
            const sinCr = data.lista.filter(x => !x.hasCr);
            const conCr = data.lista.filter(x => x.hasCr);
            const conCrVencidos = conCr.filter(x => (x.d ?? 0) > 0);
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                {sinCr.length > 0 && (
                  <span className="badge" style={{ background: 'var(--bad)', fontSize: 12, padding: '4px 10px' }}>
                    ⚠ {sinCr.length} factura(s) SIN contrarecibo — Requiere acción
                  </span>
                )}
                {conCrVencidos.length > 0 && (
                  <span className="badge" style={{ background: 'var(--warn)', color: '#333', fontSize: 12, padding: '4px 10px' }}>
                    📅 {conCrVencidos.length} CR vencidos — Listo para cobrar
                  </span>
                )}
                <span className="badge" style={{ background: 'var(--ok)', fontSize: 12, padding: '4px 10px' }}>
                  ✓ {conCr.filter(x => (x.d ?? 0) <= 0).length} CR en plazo
                </span>
              </div>
            );
          })()}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Fecha Cobro</th>
                  <th className="num">Plazo</th><th className="num">Saldo</th><th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.lista.map(({ o, inv, d, saldo, hasCr, cr: currentCr }) => {
                  const isHovered = hoveredCr && hoveredCr === currentCr;
                  // Lógica de color de fila:
                  // Sin CR = fila roja (urgente)
                  // Con CR vencido = fila naranja suave (listo para cobrar)
                  // Con CR en plazo = fila normal
                  const rowClass = !hasCr 
                    ? 'row-bad' 
                    : (d !== null && d > 0) ? 'row-warn' : '';
                  return (
                  <tr key={inv.id} className={`${rowClass} ${isHovered ? 'row-hovered-cr' : ''}`}
                    onClick={() => setSelected(o)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(o); } }}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}>
                    <td className="mono">
                      {inv.folio ?? o.folio ?? '—'}
                      {inv.id !== o.id + '-inv0' ? <span style={{fontSize: '0.8em', color: 'var(--ink-faint)', marginLeft: 4}}>(parcial)</span> : null}
                    </td>
                    <td>{o.client ?? '—'}</td>
                    <td className="mono"
                        onMouseEnter={() => currentCr ? setHoveredCr(currentCr) : null}
                        onMouseLeave={() => setHoveredCr(null)}>
                      {currentCr ? (
                        <div className={`cr-chip ${data.crCounts[currentCr] > 1 ? 'shared' : ''}`}>
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-3.31-2.69-6-6-6S3 1.69 3 5v12.5c0 3.86 3.14 7 7 7s7-3.14 7-7V6h-1.5z"/></svg>
                          {currentCr}
                        </div>
                      ) : (
                        <span className="badge" style={{ background: 'var(--bad)', fontSize: 10 }}>⚠ SIN CR</span>
                      )}
                      {currentCr && 
                       data.crCounts[currentCr] > 1 && (
                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', marginLeft: 6 }}>
                          <button 
                            className="btn-small btn-ok" 
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              payContrareciboBlock(currentCr);
                            }}
                          >
                            Pagar Lote
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono">
                      {d === null ? '—' : hasCr ? (
                        // Con Contrarecibo
                        d > 0 ? (
                          <span className="badge" style={{ background: 'var(--bad)' }}>Vencido {d}</span>
                        ) : d === 0 ? (
                          <span style={{ color: 'var(--warn)', fontWeight: 'bold' }}>Vence hoy</span>
                        ) : (
                          <span style={{ color: 'var(--ok)' }}>Faltan {Math.abs(d)}</span>
                        )
                      ) : (
                        // Sin Contrarecibo: sí mostrar urgencia
                        d > 0 ? (
                          <span className="badge" style={{ background: 'var(--bad)' }}>⚠ {d} días sin CR</span>
                        ) : (
                          <span style={{ color: 'var(--ink-faint)' }}>Recién emitida</span>
                        )
                      )}
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>{money(saldo)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <StatusBadge status={inv.creditCycle.status} />
                        {inv.creditCycle.status === 'paid' && (
                          <button 
                            className={`btn-small ${inv.collection?.complementStatus === 'issued' ? 'btn-ok' : 'btn-warn'}`}
                            onClick={(e) => { e.stopPropagation(); toggleComplementStatus(o.id, inv.id); }}
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                          >
                            REP: {inv.collection?.complementStatus === 'issued' ? 'Emitido' : 'Pendiente'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <Card title="📊 Utilidad Líquida Real por Contrarecibo (Sin mermas - Andrés)" hint={`${data.listaCr.length}`}>
        {data.listaCr.length === 0 ? (
          <Empty>No hay contrarecibos para mostrar.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contrarecibo (CR)</th>
                  <th>Cliente</th>
                  <th>Facturas</th>
                  <th className="num">Kilos</th>
                  <th className="num">Venta Total</th>
                  <th className="num">Costo Andrés</th>
                  <th className="num">Comisión Contador</th>
                  <th className="num">Utilidad Líquida Real</th>
                  <th className="num">Margen %</th>
                  <th className="num">Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.listaCr.map((grp) => (
                  <tr key={grp.cr}>
                    <td className="mono" style={{ fontWeight: 700 }}>{grp.cr}</td>
                    <td>{grp.client}</td>
                    <td className="mono">{grp.folios.map(f => '#' + f).join(', ') || '—'}</td>
                    <td className="num mono">{grp.totalKilos.toLocaleString('es-MX')} kg</td>
                    <td className="num mono">{money(grp.totalVenta)}</td>
                    <td className="num mono" style={{ color: 'var(--accent-deep)' }}>-{money(grp.costoAndres)}</td>
                    <td className="num mono" style={{ color: 'var(--bad)' }}>-{money(grp.comisionContador)}</td>
                    <td className="num mono" style={{ fontWeight: 800, color: 'var(--ok)' }}>{money(grp.netUtilidad)}</td>
                    <td className="num mono" style={{ fontWeight: 700, color: grp.margenPct >= 10 ? 'var(--ok)' : 'var(--warn)' }}>{grp.margenPct.toFixed(1)}%</td>
                    <td className="num">
                      <button className="btn" onClick={() => printConsolidatedCr(grp)} style={{ fontSize: 11, padding: '3px 8px' }}>
                        🖨️ Imprimir
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
      )}

      {activeTab === 'pagadas' && (
        <Card title="Contrarecibos Cobrados (Por recoger Dinero)">
          {data.paid.length === 0 ? (
            <Empty>No hay lotes pendientes de recoger efectivo.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Folio</th><th>Cliente</th><th>Contrarecibo</th>
                    <th className="num">Utilidad (A ingresar)</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paid.map(({ o, inv }) => {
                    const currentCr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '';
                    const crGroup = currentCr ? data.listaCr.find(g => g.cr === currentCr) : null;
                    const isHovered = hoveredCr && hoveredCr === currentCr;
                    
                    return (
                      <tr key={inv.id} className={isHovered ? 'row-hovered-cr' : ''} 
                        onClick={() => setSelected(o)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(o); } }}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}>
                        <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                        <td>{o.client ?? '—'}</td>
                        <td className="mono" onMouseEnter={() => currentCr ? setHoveredCr(currentCr) : null} onMouseLeave={() => setHoveredCr(null)}>
                          {currentCr ? (
                            <div className="cr-chip">
                              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-3.31-2.69-6-6-6S3 1.69 3 5v12.5c0 3.86 3.14 7 7 7s7-3.14 7-7V6h-1.5z"/></svg>
                              {currentCr}
                            </div>
                          ) : '—'}
                          {currentCr && crGroup && data.paid.findIndex(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === currentCr) === data.paid.findIndex(x => x.inv.id === inv.id) && (
                            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', marginLeft: 6 }}>
                              <button 
                                className="btn-small btn-ok" 
                                style={{ padding: '2px 6px', fontSize: '10px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  collectContrareciboBlock(currentCr, crGroup.netUtilidad);
                                }}
                              >
                                💰 Recoger Lote
                              </button>
                              <button 
                                className="btn-small btn-warn" 
                                style={{ padding: '2px 6px', fontSize: '10px', marginLeft: '4px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  undoContrareciboBlock(currentCr);
                                }}
                              >
                                ↩️ Deshacer Cobro
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="num mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                          {crGroup ? money(crGroup.netUtilidad) : '—'}
                        </td>
                        <td>
                          <StatusBadge status={inv.creditCycle.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {selected && (
        <OrderModal
          order={orders.find((o) => o.id === selected.id) ?? selected}
          config={config}
          onClose={() => setSelected(null)}
          initialTab="facturas"
        />
      )}
    </>
  );
}
