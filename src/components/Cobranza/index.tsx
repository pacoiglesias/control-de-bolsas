import { useMemo, useRef, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useConfig } from '../../hooks/useConfig';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { Card, Empty, KpiCard, Skeleton, Drawer } from '../ui';
import OrderModal from '../OrderModal';
import CobranzaContext from './CobranzaContext';
import CobranzaStats from './CobranzaStats';
import AgingTable from './AgingTable';
import ProximasTable from './ProximasTable';
import EstadoCuenta from './EstadoCuenta';
import TableroKanban from './TableroKanban';
import { AGING_BUCKETS, agingBucket, daysLate, getOrderSummary, round2, type AgingKey, extractCr } from '../../lib/finance';
import { fmtDate, money, toDate, exportToCsv, shareHtmlAsPdf, nombreClienteVisible } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { doc, Timestamp, collection, runTransaction } from 'firebase/firestore';
import type { Invoice } from '../../lib/types';
import { db, PATHS } from '../../lib/firebase';
import { camposInvoices, aplicarPorId } from '../../lib/invoiceOps';
import AutoConciliadorModal from './AutoConciliadorModal';
import { SincronizadorOficialModal } from './SincronizadorOficialModal';
import { useToast } from '../../context/ToastContext';
import { sound } from '../../lib/sounds';
import type { PurchaseOrder } from '../../lib/types';
import { confirmDialog } from '../../lib/confirmDialog';
import { promptDialog } from '../../lib/promptDialog';
import { useCobranzaActions } from './useCobranzaActions';
import { getCobranzaGlobalHtml, getCarteraVencidaHtml, getConsolidatedCrHtml } from './reports';

export default function Cobranza() {
  const { role, user } = useAuth();
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const toast = useToast();
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [showAutoConciliador, setShowAutoConciliador] = useState(false);
  const [showSincronizador, setShowSincronizador] = useState(false);
  // Al hacer clic en UNA tarjeta especifica del tablero, el modal se abre
  // mostrando TODAS las facturas del expediente (puede haber varias) sin
  // ninguna senal de cual era la que el usuario realmente queria ver --
  // obligandolo a buscarla entre las demas. Este id le dice a TabFacturas
  // hacia cual debe hacer scroll y resaltar automaticamente al abrir.
  const [focusInvoiceId, setFocusInvoiceId] = useState<string | null>(null);
  const abrirConFoco = (order: PurchaseOrder, invoiceId: string) => {
    setFocusInvoiceId(invoiceId);
    setSelected(order);
  };
  // Recuerda el CR que se borro al mover una tarjeta de vuelta a Revision,
  // por si el movimiento fue accidental y la regresan a Por Cobrar poco
  // despues -- evita tener que volver a escribirlo desde cero.
  const crRecordados = useRef<Record<string, string>>({});
  
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'tablero' | 'pendientes' | 'pagadas' | 'recogidas' | 'contabilidad' | 'estado_cuenta'>((location.state as any)?.tab || 'tablero');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'vencidos' | 'sincr' | 'enplazo' | 'enproceso'>('todos');
  const [showAging, setShowAging] = useState(false);
  const [showProximas, setShowProximas] = useState(false);
  const [showUtilidad, setShowUtilidad] = useState(false);

  function copyReminder(order: PurchaseOrder, inv: Invoice, d: number | null) {
    const folioStr = inv.folio || order.folio || '(sin folio)';
    const crStr = inv.collection?.contrareciboNumber || order.collection?.contrareciboNumber || 'SIN-CR';
    const monto = money(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
    const dias = (d ?? 0) > 0 ? `${d} días de atraso` : 'próximo a vencer';

    const msg = `Estimado cliente (${order.client || 'Cliente'}), le enviamos un cordial saludo. Le recordamos amablemente la factura / folio ${folioStr} (Contrarecibo: ${crStr}) por el monto de ${monto}, el cual cuenta con ${dias}. Agradecemos su confirmación de fecha de pago. Atentamente, Grupo Textil Providencia.`;

    void navigator.clipboard.writeText(msg);
    sound.playSuccess();
    toast('📋 Recordatorio de cobro copiado al portapapeles. Listo para enviar por Correo/WhatsApp.', 'ok');
  }

  /**
   * Abre WhatsApp Web/App con el mensaje ya redactado, listo para elegir el
   * contacto y enviar — en vez de solo copiarlo y tener que pegarlo a mano.
   * No manda nada solo; abre la conversación con el texto precargado, el
   * envio final sigue siendo decision de quien lo usa.
   */
  function sendWhatsApp(order: PurchaseOrder, inv: Invoice, d: number | null) {
    const folioStr = inv.folio || order.folio || '(sin folio)';
    const crStr = inv.collection?.contrareciboNumber || order.collection?.contrareciboNumber || 'SIN-CR';
    const monto = money(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
    const dias = (d ?? 0) > 0 ? `${d} días de atraso` : 'próximo a vencer';

    const msg = `Estimado cliente (${order.client || 'Cliente'}), le enviamos un cordial saludo. Le recordamos amablemente la factura / folio ${folioStr} (Contrarecibo: ${crStr}) por el monto de ${monto}, el cual cuenta con ${dias}. Agradecemos su confirmación de fecha de pago. Atentamente, Grupo Textil Providencia.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function exportCobranzaCsv() {
    const headers = ['Folio', 'Cliente', 'Contrarecibo', 'Vencimiento', 'Días Atraso', 'Monto Venta con IVA', 'Estado'];
    const rows = data.lista.map(x => [
      x.inv.folio || x.o.folio || '',
      x.o.client || '',
      x.cr || '',
      fmtDate(x.inv.creditCycle.dueDate),
      x.d ?? 0,
      (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toFixed(2),
      x.inv.creditCycle.status
    ]);
    exportToCsv(`Cobranza_Providencia_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('📥 Archivo de Excel (CSV) descargado con éxito.', 'ok');
  }

  // camposInvoices() y aplicarPorId() viven en lib/invoiceOps.ts: OrderModal
  // las necesita igual y antes tenia su propio camino para escribir
  // invoiceStatuses, con riesgo de divergir de este.
  //
  // Las 8 funciones que reprograman/cobran/deshacen/liquidan facturas (antes
  // ~480 lineas aqui mismo) se extrajeron completas a useCobranzaActions.ts,
  // sin cambiar su logica ni sus nombres -- el objeto `ctx` mas abajo, que ya
  // consumen TableroKanban/EstadoCuenta/AgingTable/etc, depende de que los
  // nombres se mantengan identicos. La llamada al hook vive justo despues del
  // useMemo `data` (mas abajo) porque estas funciones ahora reciben `data`
  // como argumento explicito en vez de cerrarlo como closure de este
  // componente, y por eso necesitan que `data` ya este calculado.
  //
  // Los 3 generadores de HTML (getCobranzaGlobalHtml, getCarteraVencidaHtml,
  // getConsolidatedCrHtml -- ~280 lineas de puro template literal) tambien
  // se extrajeron, a reports.ts. Estas funciones print*/share* se quedan
  // aqui porque si tocan cosas del componente (Blob, window, toast); solo
  // llaman a la version importada para obtener el HTML.

  function printCobranzaGlobalReport() {
    const html = getCobranzaGlobalHtml(data, settings);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCobranzaGlobalReport() {
    const html = getCobranzaGlobalHtml(data, settings);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CobranzaGlobal_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function printCarteraVencida() {
    const overdueItems = data.open.filter(x => {
      const late = daysLate(toDate(x.inv.creditCycle.dueDate));
      return late !== null && late > 0;
    });
    const totalVencido = overdueItems.reduce((sum, x) => sum + (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0);

    const html = getCarteraVencidaHtml(settings, overdueItems, totalVencido);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCarteraVencida() {
    const overdueItems = data.open.filter(x => {
      const late = daysLate(toDate(x.inv.creditCycle.dueDate));
      return late !== null && late > 0;
    });
    const totalVencido = overdueItems.reduce((sum, x) => sum + (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0);

    const html = getCarteraVencidaHtml(settings, overdueItems, totalVencido);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CarteraVencida_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function printConsolidatedCr(grp: any) {
    const html = getConsolidatedCrHtml(settings, grp);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareConsolidatedCr(grp: any) {
    const html = getConsolidatedCrHtml(settings, grp);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Contrarecibo_${grp.cr}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  const data = useMemo(() => {
    // Extraer todas las facturas de todos los expedientes
    const allInvoices = orders.flatMap((o) => {
      const s = getOrderSummary(o);
      return s.invoices.map((inv) => ({ o, inv }));
    });

    // Se mueve aqui arriba (antes vivia mas abajo) porque conCr la usa
    // de inmediato, en la misma pasada de ejecucion -- declararla
    // despues hubiera sido un uso antes de inicializar en tiempo real,
    // aunque tsc no lo marcara como error de tipos.
    const saldo = (inv: (typeof allInvoices)[number]['inv']) =>
      Math.max((inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0) - (inv.collection?.paidAmount ?? 0), 0);

    // Mismo bug de la Iteracion 28 (ahi para open/lista), nunca corregido
    // aqui: `paid`/`collected` solo hacian .filter(), sin calcular `cr` --
    // asi que cualquier consumidor que leyera `.cr` (como el detector de
    // posibles duplicados del tablero) siempre encontraba undefined y
    // caia al folio generico "S/N" compartido por muchas facturas
    // migradas, marcandolas todas como duplicadas entre si sin serlo.
    const conCr = (arr: any[]) => arr.map(({ o, inv }) => {
      const cr = extractCr(inv, o);
      return { o, inv, d: daysLate(toDate(inv.creditCycle?.dueDate)), saldo: saldo(inv), hasCr: cr.length > 0, cr };
    });
    const paid = conCr(allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'paid',
    ));

    const collected = conCr(allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'collected',
    ));

    const open = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'pending' || x.inv.creditCycle.status === 'overdue',
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
      {} as Record<AgingKey, number>,
    );

    const crCounts: Record<string, number> = {};
    open.forEach(({ o, inv }) => {
      const cr = extractCr(inv, o);
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
      netCobrado: number;
      margenPct: number;
      status: string;
      order: PurchaseOrder;
    }> = {};

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

    Object.values(crGroups).forEach(grp => {
      // netUtilidad es un INDICADOR de margen (venta - costo - honorario).
      // netCobrado es el DINERO QUE ENTRA: el cliente paga la factura completa
      // y el contador solo descuenta su honorario. El costo del material NO se
      // resta aqui: se paga a Andres por separado desde Compras, que ya genera
      // su propio egreso. Restarlo tambien aqui lo contaba dos veces.
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
        // Prioridad: Sin CR primero (urgentes), luego por días de vencimiento descendente
        if (a.hasCr !== b.hasCr) return a.hasCr ? 1 : -1;
        return (b.d ?? -999) - (a.d ?? -999);
      });

    const allCobradas = [...paid, ...collected];
    const pendingToCollectCrs = listaCr.filter(g => paid.some(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === g.cr));
    
    const unliquidatedCrs = listaCr.filter(grp => {
      const invoicesInGrp = allCobradas.filter(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === grp.cr);
      return invoicesInGrp.length > 0 && invoicesInGrp.some(x => !x.inv.collection?.accountantLiquidated);
    });
    
    const liquidatedCrs = listaCr.filter(grp => {
      const invoicesInGrp = allCobradas.filter(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === grp.cr);
      return invoicesInGrp.length > 0 && invoicesInGrp.every(x => x.inv.collection?.accountantLiquidated);
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
      vencido: open
        .filter((x) => x.inv.creditCycle.status === 'overdue')
        .reduce((a, x) => a + saldo(x.inv), 0),
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

  // Las 8 mutaciones de Firestore extraidas a useCobranzaActions.ts (ver
  // comentario mas arriba). Se llaman aqui, DESPUES de `data`, porque ahora
  // reciben `data`/`orders`/`config`/`toast`/`user` como argumentos
  // explicitos del hook en vez de cerrarlos como closures del componente --
  // si se llamara antes de la linea de `data` de arriba, `data` todavia no
  // existiria (const en temporal dead zone).
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
  } = useCobranzaActions({ orders, data, config, toast, user });

  const filteredLista = useMemo(() => {
    let list = data.lista;
    
    if (filterType === 'vencidos') {
      list = list.filter(x => (x.d ?? 0) > 0);
    } else if (filterType === 'sincr') {
      list = list.filter(x => !x.hasCr);
    } else if (filterType === 'enproceso') {
      list = list.filter(x => {
        const portalSt = (x.inv.collection?.contrareciboPortalStatus as string | undefined);
        return portalSt === 'EN PROCESO DE PAGO' || ['TH-768', 'GT-624', 'GT-597'].includes(x.cr);
      });
    } else if (filterType === 'enplazo') {
      list = list.filter(x => (x.d ?? 0) <= 0 && x.hasCr);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(x => 
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
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 48, marginBottom: 8 }} />)}
          </div>
        </Card>
      </>
    );
  }
  if (role === 'viewer') return <Navigate to="/" replace />;
  if (error) return <div className="alert bad">{error}</div>;


  async function moveInvoice(orderId: string, invoiceId: string, targetCol: string) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    const inv = o.invoices?.find(i => i.id === invoiceId);
    if (!inv) return;

    const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
    let currentCol = '';
    if (inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') {
      currentCol = cr ? 'colPorCobrar' : 'colRevision';
    } else if (inv.creditCycle.status === 'paid') {
      currentCol = 'colContador';
    } else if (inv.creditCycle.status === 'collected') {
      currentCol = 'colCaja';
    }

    if (currentCol === targetCol) return;

    let newStatus = inv.creditCycle.status;
    let newCr = inv.collection?.contrareciboNumber;
    let expenseData: any = null;

    if (targetCol === 'colRevision') {
      if (currentCol !== 'colPorCobrar') {
         toast('Solo puedes regresar a Revisión desde Por Cobrar.', 'bad'); return;
      }
      if (o.collection?.contrareciboNumber) {
        toast('El Contrarecibo está a nivel Expediente. Edita el expediente para borrarlo.', 'bad');
        return;
      }
      // Antes esto borraba el CR en silencio -- el usuario lo movia de
      // vuelta sin darse cuenta de que perdia el numero, y al intentar
      // regresarlo el sistema se lo volvia a pedir desde cero, como si
      // nunca lo hubiera tenido. Ahora se confirma explicitamente, y el
      // numero que se borra se recuerda para poder restaurarlo con un
      // clic si fue un movimiento accidental.
      const crActual = inv.collection?.contrareciboNumber || '';
      if (!(await confirmDialog(`Esto borra el número de Contrarecibo (${crActual}) de esta factura. ¿Seguro que quieres moverla a Revisión?`))) {
        return;
      }
      if (crActual) crRecordados.current[invoiceId] = crActual;
      newStatus = 'pending';
      newCr = undefined; // Se usará undefined para limpiarlo después
    } else if (targetCol === 'colPorCobrar') {
      if (currentCol === 'colRevision') {
         const crAnterior = crRecordados.current[invoiceId] || '';
         const promptCr = await promptDialog({
           message: crAnterior ? `Ingresa el número de Contrarecibo (CR):\n\n(Antes tenía "${crAnterior}" — bórralo del cuadro si es un número distinto)` : 'Ingresa el número de Contrarecibo (CR):',
           defaultValue: crAnterior,
         });
         if (!promptCr) return;
         newCr = promptCr.trim();
      } else if (currentCol === 'colContador') {
         newStatus = 'pending';
      } else {
         toast('Movimiento no permitido.', 'bad'); return;
      }
    } else if (targetCol === 'colContador') {
      if (currentCol === 'colPorCobrar') {
         newStatus = 'paid';
      } else if (currentCol === 'colCaja') {
         if (!(await confirmDialog('¿Seguro que quieres deshacer la recolección? Se registrará un egreso de reversión en Caja para cuadrar.'))) return;
         
         const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * (config.salePricePerKg || 43) * (1 + (config.ivaRate || 0.16)));
         const comision = inv.financials?.commission ?? (inv.kilos * (config.salePricePerKg || 43) * (config.commissionRate || 0));
         const net = invTotal - comision;

         expenseData = {
           id: doc(collection(db, PATHS.expenses)).id,
           date: Timestamp.now(),
           concept: `[REVERSO] Corrección de factura ${inv.folio || o.folio}`,
           amount: net,
           type: 'egreso',
           createdAt: Timestamp.now(),
         };
         newStatus = 'paid';
      } else {
         toast('Movimiento no permitido.', 'bad'); return;
      }
    } else if (targetCol === 'colCaja') {
      if (currentCol === 'colContador') {
         if (!(await confirmDialog(`¿Confirmas que se recibió el EFECTIVO/TRANSFERENCIA por la factura ${inv.folio || o.folio}? Se registrará el ingreso en Caja.`))) return;

         const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * (config.salePricePerKg || 43) * (1 + (config.ivaRate || 0.16)));
         const comision = inv.financials?.commission ?? (inv.kilos * (config.salePricePerKg || 43) * (config.commissionRate || 0));
         const net = invTotal - comision;

         expenseData = {
           id: doc(collection(db, PATHS.expenses)).id,
           date: Timestamp.now(),
           concept: `Cobro Fac. ${inv.folio || o.folio}`,
           amount: net,
           type: 'ingreso',
           createdAt: Timestamp.now(),
         };
         newStatus = 'collected';
      } else {
         toast('Solo puedes mover a Caja desde la columna del Contador.', 'bad'); return;
      }
    }

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Expediente no existe');
        
        const actuales = snap.data().invoices ?? [];
        
        const nuevas = aplicarPorId(actuales, invoiceId, (x) => {
          const collectionUpdate = { ...x.collection };
          
          if (targetCol === 'colRevision') {
             delete collectionUpdate.contrareciboNumber;
          } else if (newCr !== undefined) {
             collectionUpdate.contrareciboNumber = newCr;
          }

          if (targetCol === 'colContador' && currentCol === 'colPorCobrar') {
             collectionUpdate.paidAt = Timestamp.now();
          }
          if (targetCol === 'colCaja' && currentCol === 'colContador') {
             collectionUpdate.collectedAt = Timestamp.now();
          }
          if (targetCol === 'colContador' && currentCol === 'colCaja') {
             collectionUpdate.collectedAt = null;
          }
          if (targetCol === 'colPorCobrar' && currentCol === 'colContador') {
             collectionUpdate.paidAt = null;
          }

          return {
            ...x,
            creditCycle: { ...x.creditCycle, status: newStatus as any },
            collection: collectionUpdate
          };
        });

        if (!nuevas) throw new Error('La factura no está en el expediente');
        tx.update(ref, camposInvoices(nuevas));

        // ==== MIGRACION V2: Dual-write ====
        const invModificada = nuevas.find(x => x.id === invoiceId);
        if (invModificada) {
          tx.set(doc(db, PATHS.invoices, invoiceId), {
            ...invModificada,
            orderId,
            client: snap.data().client ?? '',
            department: snap.data().department ?? '',
          }, { merge: true });
        }

        if (expenseData) {
          tx.set(doc(db, PATHS.expenses, expenseData.id), expenseData);
        }
      });
      toast('Factura movida con éxito', 'ok');
    } catch (e) {
      toast(`Error al mover factura: ${(e as Error).message}`, 'bad');
    }
  }

  const ctx = {
    data, settings, money, activeTab, setActiveTab, shareCarteraVencida, printCarteraVencida, exportCobranzaCsv,
    shareCobranzaGlobalReport, printCobranzaGlobalReport, search, setSearch, filteredLista,
    payContrareciboBlock, fastCollectContrareciboBlock, payInvoiceExact, undoContrareciboBlock, collectContrareciboBlock, revertCollectedContrareciboBlock,
    liquidateAccountantBlock, toggleComplementStatus, reprogramarVencimiento, copyReminder, sendWhatsApp, printConsolidatedCr, shareConsolidatedCr,
    filterType, setFilterType, setSelected, abrirConFoco, moveInvoice
  };

  return (
    <CobranzaContext.Provider value={ctx}>
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Contrarecibos / Cobranza</h1>
          <p>
            Control central de lo que te deben en Providencia, contrarecibos emitidos y depósitos conciliados que ingresan a tu cuenta y caja.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)', color: '#fff', fontWeight: 800, border: 'none', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)' }}
            onClick={() => setShowSincronizador(true)}
            title="Sincronizar base de datos con los Contrarecibos Oficiales"
          >
            ⚡ Sincronizar Contrarecibos
          </button>
          <button
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', fontWeight: 700, border: 'none', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
            onClick={() => setShowAutoConciliador(true)}
          >
            🤖 Auto-Conciliar Pagos / Depósitos
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareCarteraVencida}>
              <span className="icon">📤</span> PDF (Cartera Vencida)
            </button>
            <button className="btn" style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c', fontWeight: 600 }} onClick={printCarteraVencida}>
              🚨 Cartera Vencida (Imprimir)
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareCobranzaGlobalReport}>
              <span className="icon">📤</span> Compartir PDF
            </button>
            <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printCobranzaGlobalReport}>
              📈 Imprimir Todo (General)
            </button>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20, marginTop: 20 }}>
        <button className={`tab ${activeTab === 'tablero' ? 'active' : ''}`} onClick={() => setActiveTab('tablero')}>
          📋 Tablero (Kanban)
        </button>
        <button className={`tab ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>
          ⏳ Pendientes de Cobro ({data.open.length})
        </button>
        <button className={`tab ${activeTab === 'pagadas' ? 'active' : ''}`} onClick={() => setActiveTab('pagadas')}>
          🏃‍♂️ Por Recoger Efectivo ({data.paid.length})
        </button>
        <button className={`tab ${activeTab === 'recogidas' ? 'active' : ''}`} onClick={() => setActiveTab('recogidas')}>
          🗄️ Historial: Recogidos ({data.collected.length})
        </button>
        <button className={`tab ${activeTab === 'contabilidad' ? 'active' : ''}`} onClick={() => setActiveTab('contabilidad')}>
          🧾 Liquidación a Contabilidad
        </button>
        <button className={`tab ${activeTab === 'estado_cuenta' ? 'active' : ''}`} onClick={() => setActiveTab('estado_cuenta')}>
          🪞 Estado de Cuenta (Espejo)
        </button>
      </div>

      {activeTab === 'tablero' && (
        <TableroKanban />
      )}

      {activeTab === 'estado_cuenta' && (
        <EstadoCuenta />
      )}

      {activeTab === 'pendientes' && (
        <>
          <div className="kpi-grid">
            <KpiCard hero tone={data.meDeben > 0 ? 'warn' : 'ok'} label="TE DEBEN" value={money(data.meDeben)}
              sub={`${data.open.length} órdenes abiertas`} />
            <KpiCard tone={data.vencido > 0 ? 'bad' : undefined} label="De eso, vencido" value={money(data.vencido)} />
            <KpiCard tone="ok" label="Cobro a 7 Días" value={money(data.proyeccion7d)} sub="Proyección esta semana" />
            <KpiCard tone="ok" label="Cobro a 15 Días" value={money(data.proyeccion15d)} sub="Proyección quincenal" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 32 }}>
            <Card title="Antigüedad de Saldos" hint="Aging">
              <div style={{ padding: 20 }}>
                <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Resumen de cuentas por cobrar agrupadas por periodos de vencimiento.</p>
                <button className="btn btn-primary" onClick={() => setShowAging(true)} style={{ width: '100%' }}>Abrir Reporte Aging</button>
              </div>
            </Card>

            <Card title="Próximas a Vencer" hint="Facturas">
              <div style={{ padding: 20 }}>
                <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Listado detallado de facturas próximas a vencer o ya vencidas.</p>
                <button className="btn btn-primary" onClick={() => setShowProximas(true)} style={{ width: '100%' }}>Abrir Próximas</button>
              </div>
            </Card>

            <Card title="Utilidad Líquida" hint="CRs">
              <div style={{ padding: 20 }}>
                <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Utilidad por contrarecibo ya descontando mermas y comisiones.</p>
                <button className="btn btn-primary" onClick={() => setShowUtilidad(true)} style={{ width: '100%' }}>Abrir Utilidad</button>
              </div>
            </Card>
          </div>

          {showAging && (
            <Drawer title="Antigüedad de Saldos (Aging)" onClose={() => setShowAging(false)} width={800}>
              <AgingTable />
            </Drawer>
          )}

          {showProximas && (
            <Drawer title="Próximas a Vencer" onClose={() => setShowProximas(false)} width={900}>
              <ProximasTable />
            </Drawer>
          )}

          {showUtilidad && (
            <Drawer title="📊 Utilidad Líquida Real por Contrarecibo" onClose={() => setShowUtilidad(false)} width={900}>
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
                          <td className="mono">{grp.folios.map((f: any) => '#' + f).join(', ') || '—'}</td>
                          <td className="num mono">{grp.totalKilos.toLocaleString('es-MX')} kg</td>
                          <td className="num mono">{money(grp.totalVenta)}</td>
                          <td className="num mono" style={{ color: 'var(--accent-deep)' }}>-{money(grp.costoAndres)}</td>
                          <td className="num mono" style={{ color: 'var(--bad)' }}>-{money(grp.comisionContador)}</td>
                          <td className="num mono" style={{ fontWeight: 800, color: 'var(--ok)' }}>{money(grp.netUtilidad)}</td>
                          <td className="num mono" style={{ fontWeight: 700, color: grp.margenPct >= 10 ? 'var(--ok)' : 'var(--warn)' }}>{grp.margenPct.toFixed(1)}%</td>
                          <td className="num">
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn" onClick={() => shareConsolidatedCr(grp)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                                📤 Compartir
                              </button>
                              <button className="btn" onClick={() => printConsolidatedCr(grp)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                                🖨️ Imprimir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Drawer>
          )}
        </>
      )}

      {activeTab === 'pagadas' && (
        <Card title="Pagos Registrados pero AÚN CON CONTABILIDAD (Por Recolectar)">
          <div className="alert warn" style={{ marginBottom: 16 }}>
            ⚠️ <strong>Recuerda:</strong> Estos montos te los entregarán <strong>quitando la comisión</strong>.
          </div>
          {data.paid.length === 0 ? (
            <Empty>No hay pagos pendientes de recolectar.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {data.pendingToCollectCrs.map(crGroup => {
                const groupInvoices = data.paid.filter(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === crGroup.cr);
                const doctoPago = groupInvoices[0]?.inv.collection?.paymentDocument || groupInvoices[0]?.inv.collection?.transferRef || 'Sin Ref';
                
                return (
                  <div key={crGroup.cr} style={{ border: '2px solid #b91c1c', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '2px solid #b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: '#333' }}>
                        <span>PAGO: <strong>{doctoPago}</strong></span>
                        <span style={{ marginLeft: 16 }}>TRANSFERENCIA / CR: <strong>{crGroup.cr}</strong></span>
                        <span style={{ marginLeft: 16 }}>IMPORTE BRUTO: <strong>{money(crGroup.totalVenta)} MXN</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ok" style={{ fontWeight: 800 }} onClick={() => collectContrareciboBlock(crGroup.cr, crGroup.netCobrado)}>
                          💰 Recoger Efectivo (Neto: {money(crGroup.netUtilidad)})
                        </button>
                        <button className="btn" style={{ background: 'var(--paper)', border: '1px solid var(--warn)', color: 'var(--warn)' }} onClick={() => undoContrareciboBlock(crGroup.cr)}>
                          ↩️ Deshacer Cobro
                        </button>
                      </div>
                    </div>
                    <div className="table-scroll">
                      <table className="data-table" style={{ margin: 0, border: 'none' }}>
                      <thead style={{ background: '#2563eb', color: '#fff' }}>
                        <tr>
                          <th style={{ color: '#fff', border: 'none' }}>Docto. SAP</th>
                          <th style={{ color: '#fff', border: 'none' }}>Docto. Pago</th>
                          <th style={{ color: '#fff', border: 'none' }}>Factura</th>
                          <th style={{ color: '#fff', border: 'none' }}>Detalle</th>
                          <th style={{ color: '#fff', border: 'none' }}>Fecha Pago</th>
                          <th className="num" style={{ color: '#fff', border: 'none' }}>Importe</th>
                          <th style={{ color: '#fff', border: 'none' }}>Moneda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupInvoices.map(({ o, inv }) => (
                          <tr key={inv.id}>
                            <td className="mono" style={{ borderLeft: 'none' }}>{inv.collection?.sapDocument || '—'}</td>
                            <td className="mono">{inv.collection?.paymentDocument || '—'}</td>
                            <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                            <td>{nombreClienteVisible(o.client)}</td>
                            <td className="mono">{fmtDate(inv.collection?.paidAt)}</td>
                            <td className="num mono">{(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                            <td style={{ borderRight: 'none' }}>MXN</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', border: 'none' }}>TOTAL:</td>
                          <td className="num mono" style={{ fontWeight: 'bold', border: 'none' }}>{money(crGroup.totalVenta)}</td>
                          <td style={{ border: 'none' }}></td>
                        </tr>
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: '#b91c1c', border: 'none' }}>- COMISIÓN:</td>
                          <td className="num mono" style={{ fontWeight: 'bold', color: '#b91c1c', border: 'none' }}>-{money(crGroup.comisionContador)}</td>
                          <td style={{ border: 'none' }}></td>
                        </tr>
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: '#047857', border: 'none' }}>NETO A RECIBIR:</td>
                          <td className="num mono" style={{ fontWeight: 'bold', color: '#047857', border: 'none' }}>{money(crGroup.netUtilidad)}</td>
                          <td style={{ border: 'none' }}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'recogidas' && (
        <Card title="Historial Completo: Contrarecibos Recogidos (Ingresados a CAJA)">
          <div className="alert info" style={{ marginBottom: 16 }}>
            ℹ️ <strong>Historial de Lotes Recogidos:</strong> Aquí se guardan todos los contrarecibos cuyo dinero ya ingresó a CAJA. Si recogiste un lote por error, presiona <strong>"↩️ Deshacer Recolección"</strong> para regresarlo a "Por Recoger Dinero" y revertir el movimiento en CAJA.
          </div>
          {data.collected.length === 0 ? (
            <Empty>No hay contrarecibos recogidos aún en el historial.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {(() => {
                const groupedByTr = data.collected.reduce((acc, { o, inv }) => {
                  const tr = inv.collection?.transferRef || 'Sin Ref';
                  if (!acc[tr]) acc[tr] = { tr, invoices: [], totalSale: 0 };
                  acc[tr].invoices.push({ o, inv });
                  acc[tr].totalSale += (inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
                  return acc;
                }, {} as Record<string, { tr: string, invoices: any[], totalSale: number }>);

                return Object.values(groupedByTr).map((group) => (
                  <div key={group.tr} style={{ border: '2px solid var(--ok)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ background: '#f0fdf4', padding: '8px 12px', borderBottom: '2px solid var(--ok)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: '#166534' }}>
                        <span>TRANSFERENCIA (TR): <strong>{group.tr}</strong></span>
                        <span style={{ marginLeft: 16 }}>IMPORTE BRUTO: <strong>{money(group.totalSale)} MXN</strong></span>
                      </div>
                    </div>
                    <div className="table-scroll" style={{ margin: 0 }}>
                      <table className="data-table" style={{ margin: 0, border: 'none' }}>
                        <thead style={{ background: 'var(--ok)', color: '#fff' }}>
                          <tr>
                            <th style={{ color: '#fff', border: 'none' }}>Folio</th>
                            <th style={{ color: '#fff', border: 'none' }}>Cliente</th>
                            <th style={{ color: '#fff', border: 'none' }}>Contrarecibo</th>
                            <th className="num" style={{ color: '#fff', border: 'none' }}>Importe Venta</th>
                            <th style={{ color: '#fff', border: 'none' }}>Acción Reversión</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.invoices.map(({ o, inv }) => {
                            const currentCr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '';
                            const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                            return (
                              <tr key={inv.id}>
                                <td className="mono" style={{ borderLeft: 'none' }}>{inv.folio ?? o.folio ?? '—'}</td>
                                <td>{nombreClienteVisible(o.client)}</td>
                                <td className="mono">{currentCr || '—'}</td>
                                <td className="num mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                                  {money(invTotal)}
                                </td>
                                <td style={{ borderRight: 'none' }}>
                                  {currentCr && (
                                    <button
                                      className="btn-small btn-warn"
                                      style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        revertCollectedContrareciboBlock(currentCr);
                                      }}
                                    >
                                      ↩️ Deshacer Recolección
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold', border: 'none' }}>TOTAL TRANSFERENCIA:</td>
                            <td className="num mono" style={{ fontWeight: 'bold', border: 'none' }}>{money(group.totalSale)}</td>
                            <td style={{ border: 'none' }}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'contabilidad' && (
        <Card title="Liquidación de Comisiones a Contabilidad">
          <div className="alert info" style={{ marginBottom: 16 }}>
            ℹ️ Aquí se listan las facturas ya cobradas (Contrarecibos cobrados o recogidos) para revisar la <strong>comisión del 8%</strong> que corresponde a Contabilidad. Haz clic en "Liquidar a Contabilidad" una vez que pagues esos honorarios.
          </div>
          {(() => {
            const unliquidatedCrs = data.unliquidatedCrs;
            const liquidatedCrs = data.liquidatedCrs;

            if (unliquidatedCrs.length === 0 && liquidatedCrs.length === 0) return <Empty>No hay contrarecibos cobrados para liquidar comisiones.</Empty>;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {unliquidatedCrs.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 12, color: '#b91c1c' }}>Pendientes de Liquidar al Contador</h3>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Contrarecibo (CR)</th>
                            <th>Cliente</th>
                            <th className="num">Venta Facturada</th>
                            <th className="num">Comisión (8%)</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unliquidatedCrs.map(grp => (
                            <tr key={grp.cr}>
                              <td className="mono" style={{ fontWeight: 700 }}>{grp.cr}</td>
                              <td>{grp.client}</td>
                              <td className="num mono">{money(grp.totalVenta)}</td>
                              <td className="num mono" style={{ color: '#b91c1c', fontWeight: 700 }}>{money(grp.comisionContador)}</td>
                              <td>
                                <button className="btn-small btn-ok" onClick={() => liquidateAccountantBlock(grp.cr)}>
                                  ✅ Liquidar a Contabilidad
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL PENDIENTE:</td>
                            <td className="num mono" style={{ fontWeight: 700, color: '#b91c1c' }}>
                              {money(unliquidatedCrs.reduce((a, b) => a + b.comisionContador, 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
                
                {liquidatedCrs.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--ok)' }}>Historial de Liquidadas</h3>
                    <div className="table-scroll">
                      <table className="data-table" style={{ opacity: 0.8 }}>
                        <thead>
                          <tr>
                            <th>Contrarecibo (CR)</th>
                            <th>Cliente</th>
                            <th className="num">Comisión (8%)</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liquidatedCrs.map(grp => (
                            <tr key={grp.cr}>
                              <td className="mono">{grp.cr}</td>
                              <td>{grp.client}</td>
                              <td className="num mono">{money(grp.comisionContador)}</td>
                              <td><span className="badge" style={{ background: 'var(--ok)', color: '#fff' }}>Liquidado</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {selected && (
        <OrderModal
          order={orders.find((o) => o.id === selected.id) ?? selected}
          config={config}
          onClose={() => { setSelected(null); setFocusInvoiceId(null); }}
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
        <SincronizadorOficialModal
          orders={orders}
          onClose={() => setShowSincronizador(false)}
        />
      )}
    </>
    </CobranzaContext.Provider>
  );
}
