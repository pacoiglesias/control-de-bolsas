import { useMemo, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useConfig } from '../../hooks/useConfig';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { Card, Skeleton } from '../ui';
import OrderModal from '../OrderModal';
import CobranzaContext from './CobranzaContext';
import CobranzaStats from './CobranzaStats';
import CobranzaHeader from './CobranzaHeader';
import CobranzaTabsNav from './CobranzaTabsNav';
import EstadoCuenta from './EstadoCuenta';
import TableroKanban from './TableroKanban';
import TabPendientes from './TabPendientes';
import TabPagadas from './TabPagadas';
import TabRecogidas from './TabRecogidas';
import TabContabilidad from './TabContabilidad';
import { AGING_BUCKETS, agingBucket, daysLate, getOrderSummary, round2, type AgingKey, extractCr } from '../../lib/finance';
import { fmtDate, money, toDate, exportToCsv, nombreClienteVisible } from '../../lib/format';
import { generateCollectionNotice, openWhatsAppMessage } from '../../lib/whatsappReminder';
import { useAuth } from '../../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import type { Invoice } from '../../lib/types';
import AutoConciliadorModal from './AutoConciliadorModal';
import { SincronizadorOficialModal } from './SincronizadorOficialModal';
import { useToast } from '../../context/ToastContext';
import { sound } from '../../lib/sounds';
import type { PurchaseOrder } from '../../lib/types';
import { useCobranzaActions } from './useCobranzaActions';
import { useCobranzaReports } from './useCobranzaReports';
import { useMoveInvoice } from './useMoveInvoice';

export default function Cobranza() {
  const { role, user } = useAuth();
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const toast = useToast();
  const location = useLocation();

  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [showAutoConciliador, setShowAutoConciliador] = useState(false);
  const [showSincronizador, setShowSincronizador] = useState(false);
  const [focusInvoiceId, setFocusInvoiceId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'tablero' | 'pendientes' | 'pagadas' | 'recogidas' | 'contabilidad' | 'estado_cuenta'>(
    (location.state as any)?.tab || 'tablero'
  );
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'vencidos' | 'sincr' | 'enplazo' | 'enproceso'>('todos');

  const abrirConFoco = (order: PurchaseOrder, invoiceId: string) => {
    setFocusInvoiceId(invoiceId);
    setSelected(order);
  };

  function copyReminder(order: PurchaseOrder, inv: Invoice, _d: number | null) {
    const folioStr = inv.folio || order.folio || '(sin folio)';
    const crStr = inv.collection?.contrareciboNumber || order.collection?.contrareciboNumber || '';
    const monto = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;

    const msg = generateCollectionNotice({
      folioFactura: folioStr,
      contrarecibo: crStr,
      cliente: nombreClienteVisible(order.client),
      monto,
      fechaVencimiento: inv.creditCycle?.dueDate,
    });

    void navigator.clipboard.writeText(msg);
    sound.playSuccess();
    toast('📋 Recordatorio de cobro copiado al portapapeles. Listo para enviar por Correo/WhatsApp.', 'ok');
  }

  function sendWhatsApp(order: PurchaseOrder, inv: Invoice, _d: number | null) {
    const folioStr = inv.folio || order.folio || '(sin folio)';
    const crStr = inv.collection?.contrareciboNumber || order.collection?.contrareciboNumber || '';
    const monto = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;

    const msg = generateCollectionNotice({
      folioFactura: folioStr,
      contrarecibo: crStr,
      cliente: nombreClienteVisible(order.client),
      monto,
      fechaVencimiento: inv.creditCycle?.dueDate,
    });
    openWhatsAppMessage(msg);
  }

  function exportCobranzaCsv() {
    const headers = ['Folio', 'Cliente', 'Contrarecibo', 'Vencimiento', 'Días Atraso', 'Monto Venta con IVA', 'Estado'];
    const rows = data.lista.map((x: any) => [
      x.inv.folio || x.o.folio || '',
      x.o.client || '',
      x.cr || '',
      fmtDate(x.inv.creditCycle.dueDate),
      x.d ?? 0,
      (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toFixed(2),
      x.inv.creditCycle.status,
    ]);
    exportToCsv(`Cobranza_Providencia_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('📥 Archivo de Excel (CSV) descargado con éxito.', 'ok');
  }

  const data = useMemo(() => {
    const allInvoices = orders.flatMap((o) => {
      const s = getOrderSummary(o);
      return s.invoices.map((inv) => ({ o, inv }));
    });

    const saldo = (inv: (typeof allInvoices)[number]['inv']) =>
      Math.max((inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0) - (inv.collection?.paidAmount ?? 0), 0);

    const conCr = (arr: any[]) =>
      arr.map(({ o, inv }) => {
        const cr = extractCr(inv, o);
        return { o, inv, d: daysLate(toDate(inv.creditCycle?.dueDate)), saldo: saldo(inv), hasCr: cr.length > 0, cr };
      });

    const paid = conCr(allInvoices.filter((x) => x.inv.creditCycle.status === 'paid'));
    const collected = conCr(allInvoices.filter((x) => x.inv.creditCycle.status === 'collected'));
    const open = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'pending' || x.inv.creditCycle.status === 'overdue'
    );

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
      {} as Record<AgingKey, number>
    );

    const crCounts: Record<string, number> = {};
    open.forEach(({ o, inv }) => {
      const cr = extractCr(inv, o);
      if (cr) crCounts[cr] = (crCounts[cr] || 0) + 1;
    });

    const crGroups: Record<
      string,
      {
        cr: string;
        client: string;
        folios: string[];
        totalKilos: number;
        totalVenta: number;
        costoAndres: number;
        comisionContador: number;
        netUtilidad: number;
        netCobrado: number;
        margenPct: number;
        status: string;
        order: PurchaseOrder;
      }
    > = {};

    allInvoices.forEach(({ o, inv }) => {
      const cr = extractCr(inv, o) || 'SIN-CR';
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
          netCobrado: 0,
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

    Object.values(crGroups).forEach((grp) => {
      grp.netUtilidad = grp.totalVenta - grp.costoAndres - grp.comisionContador;
      grp.netCobrado = round2(grp.totalVenta - grp.comisionContador);
      grp.margenPct = grp.totalVenta > 0 ? (grp.netUtilidad / grp.totalVenta) * 100 : 0;
    });

    const listaCr = Object.values(crGroups).sort((a, b) => b.totalVenta - a.totalVenta);

    const lista = open
      .map(({ o, inv }) => {
        const cr = extractCr(inv, o);
        const hasCr = cr.length > 0;
        const d = daysLate(toDate(inv.creditCycle?.dueDate));
        return { o, inv, d, saldo: saldo(inv), hasCr, cr };
      })
      .sort((a, b) => {
        if (a.hasCr !== b.hasCr) return a.hasCr ? 1 : -1;
        return (b.d ?? -999) - (a.d ?? -999);
      });

    const allCobradas = [...paid, ...collected];
    const pendingToCollectCrs = listaCr.filter((g) =>
      paid.some((x) => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === g.cr)
    );

    const unliquidatedCrs = listaCr.filter((grp) => {
      const invoicesInGrp = allCobradas.filter(
        (x) => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === grp.cr
      );
      return invoicesInGrp.length > 0 && invoicesInGrp.some((x) => !x.inv.collection?.accountantLiquidated);
    });

    const liquidatedCrs = listaCr.filter((grp) => {
      const invoicesInGrp = allCobradas.filter(
        (x) => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === grp.cr
      );
      return invoicesInGrp.length > 0 && invoicesInGrp.every((x) => x.inv.collection?.accountantLiquidated);
    });

    return {
      open,
      paid,
      collected,
      lista,
      listaCr,
      pendingToCollectCrs,
      unliquidatedCrs,
      liquidatedCrs,
      clientes,
      porCliente,
      totalPorBucket,
      crCounts,
      meDeben: open.reduce((a, x) => a + saldo(x.inv), 0),
      vencido: open.filter((x) => x.inv.creditCycle.status === 'overdue').reduce((a, x) => a + saldo(x.inv), 0),
      cobrado: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid' || x.inv.creditCycle.status === 'collected')
        .reduce((a, x) => a + (x.inv.collection?.paidAmount ?? x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0),
      comisiones: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid' || x.inv.creditCycle.status === 'collected')
        .reduce((a, x) => a + (x.inv.financials?.commission ?? (x.inv.kilos * config.salePricePerKg * config.commissionRate)), 0),
      proyeccion7d: open
        .filter((x) => {
          const d = daysLate(toDate(x.inv.creditCycle.dueDate));
          return d !== null && d <= 0 && d >= -7;
        })
        .reduce((a, x) => a + saldo(x.inv), 0),
      proyeccion15d: open
        .filter((x) => {
          const d = daysLate(toDate(x.inv.creditCycle.dueDate));
          return d !== null && d <= 0 && d >= -15;
        })
        .reduce((a, x) => a + saldo(x.inv), 0),
    };
  }, [orders, config]);

  const {
    reprogramarVencimiento,
    toggleComplementStatus,
    payInvoiceExact,
    payContrareciboBlock,
    fastCollectContrareciboBlock,
    undoContrareciboBlock,
    collectContrareciboBlock,
    revertCollectedContrareciboBlock,
    liquidateAccountantBlock,
    deleteOrArchiveInvoice,
  } = useCobranzaActions({ orders, data, config, toast, user });

  const {
    printCobranzaGlobalReport,
    shareCobranzaGlobalReport,
    printCarteraVencida,
    shareCarteraVencida,
    printConsolidatedCr,
    shareConsolidatedCr,
  } = useCobranzaReports({ data, settings, toast });

  const moveInvoice = useMoveInvoice({ orders, config, toast });

  const groupedByTr = useMemo(() => {
    const map: Record<string, { tr: string; invoices: any[]; totalSale: number }> = {};
    (data.collected || []).forEach(({ o, inv }: any) => {
      const tr = (inv.collection?.paymentDocument || inv.collection?.transferRef || 'Sin TR').trim();
      if (!map[tr]) {
        map[tr] = { tr, invoices: [], totalSale: 0 };
      }
      map[tr].invoices.push({ o, inv });
      map[tr].totalSale += (inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
    });
    return map;
  }, [data.collected]);

  const filteredLista = useMemo(() => {
    let list = data.lista;

    if (filterType === 'vencidos') {
      list = list.filter((x: any) => (x.d ?? 0) > 0);
    } else if (filterType === 'sincr') {
      list = list.filter((x: any) => !x.hasCr);
    } else if (filterType === 'enproceso') {
      list = list.filter((x: any) => {
        const portalSt = x.inv.collection?.contrareciboPortalStatus as string | undefined;
        return portalSt === 'EN PROCESO DE PAGO' || ['TH-768', 'GT-624', 'GT-597'].includes(x.cr);
      });
    } else if (filterType === 'enplazo') {
      list = list.filter((x: any) => (x.d ?? 0) <= 0 && x.hasCr);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (x: any) =>
        (x.inv.folio?.toLowerCase() || '').includes(q) ||
        (x.o.folio?.toLowerCase() || '').includes(q) ||
        (x.o.client?.toLowerCase() || '').includes(q) ||
        (x.cr?.toLowerCase() || '').includes(q)
    );
  }, [data.lista, search, filterType]);

  if (loading) {
    return (
      <>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 250, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: 350, height: 16 }} />
        </div>
        <CobranzaStats />
        <Card>
          <div style={{ padding: 20 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="skeleton-row" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        </Card>
      </>
    );
  }

  if (role === 'viewer') return <Navigate to="/" replace />;
  if (error) return <div className="alert bad">{error}</div>;

  const ctx = {
    data,
    settings,
    money,
    activeTab,
    setActiveTab,
    shareCarteraVencida,
    printCarteraVencida,
    exportCobranzaCsv,
    shareCobranzaGlobalReport,
    printCobranzaGlobalReport,
    search,
    setSearch,
    filteredLista,
    payContrareciboBlock,
    fastCollectContrareciboBlock,
    payInvoiceExact,
    undoContrareciboBlock,
    collectContrareciboBlock,
    revertCollectedContrareciboBlock,
    liquidateAccountantBlock,
    toggleComplementStatus,
    reprogramarVencimiento,
    copyReminder,
    sendWhatsApp,
    printConsolidatedCr,
    shareConsolidatedCr,
    filterType,
    setFilterType,
    setSelected,
    abrirConFoco,
    moveInvoice,
    deleteOrArchiveInvoice,
  };

  return (
    <CobranzaContext.Provider value={ctx}>
      <CobranzaHeader
        onOpenSincronizador={() => setShowSincronizador(true)}
        onOpenAutoConciliador={() => setShowAutoConciliador(true)}
      />

      <CobranzaStats />

      <CobranzaTabsNav />

      {activeTab === 'tablero' && <TableroKanban />}
      {activeTab === 'pendientes' && <TabPendientes />}
      {activeTab === 'pagadas' && <TabPagadas />}
      {activeTab === 'recogidas' && <TabRecogidas groupedByTr={groupedByTr} />}
      {activeTab === 'contabilidad' && <TabContabilidad />}
      {activeTab === 'estado_cuenta' && <EstadoCuenta />}

      {selected && (
        <OrderModal
          order={orders.find((o) => o.id === selected.id) ?? selected}
          config={config}
          onClose={() => {
            setSelected(null);
            setFocusInvoiceId(null);
          }}
          initialTab="facturas"
          focusInvoiceId={focusInvoiceId}
        />
      )}

      {showAutoConciliador && (
        <AutoConciliadorModal
          orders={orders}
          onClose={() => setShowAutoConciliador(false)}
          onSuccess={(count, total) => {
            toast(`✅ Conciliación completada: ${count} depósitos procesados ($${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })})`, 'ok');
          }}
        />
      )}

      {showSincronizador && (
        <SincronizadorOficialModal orders={orders} onClose={() => setShowSincronizador(false)} />
      )}
    </CobranzaContext.Provider>
  );
}
