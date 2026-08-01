import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { doc, getDoc, collection, query, orderBy, limit, getDocs, onSnapshot, updateDoc, addDoc, Timestamp, serverTimestamp, type QuerySnapshot, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db, PATHS, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { money, shareHtmlAsPdf, kilos, monthLabel, fmtDate, getPrintHeaderHtml } from '../lib/format';
import { usePurchases } from '../hooks/usePurchases';
import { useOrdersContext } from '../context/OrdersContext';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { useToast } from '../context/ToastContext';
import { KpiCard, Card, Empty, StatusBadge, Skeleton, ResponsiveMoney, Modal } from '../components/ui';
import { round2, computeCommissionFromInvoiceTotal, extractDashboardAlerts, calculateLiveMargenTotal } from '../lib/finance';
import { createCloudBackup, listCloudBackups, restoreCloudBackup, type CloudSnapshotMeta } from '../lib/cloudBackup';
import type { PurchaseOrder, Invoice } from '../lib/types';
import { useDocumentData } from 'react-firebase-hooks/firestore';

export interface LiveLogEntry {
  id: string;
  user: string;
  action: string;
  // Los detalles varian segun el tipo de accion (config, cobros, vencidos...);
  // Record<string, unknown> en vez de any: sigue aceptando cualquier forma,
  // pero obliga a verificar antes de usar una propiedad, en vez de dejarlo
  // pasar todo sin ningun chequeo.
  details?: Record<string, unknown>;
  timestamp: Date | null;
}

export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const SYSTEM_CHANGELOG: SystemRelease[] = [
  {
    version: 'v6.26.0',
    date: '31 de Julio de 2026',
    time: '11:00 AM',
    summary: 'Bolsas Elemental: UX Premium y Reducción de Captura.',
    highlights: [
      'WhatsApp a 1 Clic: Cobranza directa desde el Dashboard con adeudo exacto.',
      'Recepción Rápida: Botón resaltado en Compras para registrar entregas de Andrés al instante.',
      'Copiado SAT: Pre-factura lista para pegar en el SAT con un solo clic.',
      'Autollenado de OC: Se agregó lector inteligente de texto de PDF para evitar teclear folios y kilos.'
    ]
  },

  {
    version: 'v6.25.0',
    date: '31 de Julio de 2026',
    time: '10:05 AM',
    summary: 'Rendimiento y Escalabilidad: Prevención de Scans Masivos.',
    highlights: [
      'Caja Chica (useExpenses): Se previno el full collection scan. Ahora consulta con límite de 150 registros y delega el ordenamiento a Firebase, mejorando memoria y reduciendo costos.',
      'Compras (usePurchases): Misma prevención de full collection scan y delegación de ordenamiento a la base de datos.',
      'Productos (useProducts): Se aplicó una cota dura de 500 registros para evitar desbordamientos de memoria.',
    ]
  },
  {
    version: 'v6.24.0',
    date: '31 de Julio de 2026',
    time: '09:50 AM',
    summary: 'Eficiencia Operativa: Bandeja de Validación y Control Interconectado de Andrés.',
    highlights: [
      'Bandeja de Validación de PDFs: Ahora los PDFs se listan en una bandeja dedicada para que los revises fácilmente, separando la cola de la base de datos.',
      'Mejoras en Compras (Andrés): Rediseño para ver el historial y alertas de entregas atrasadas.',
      'Pagos Directos a Proveedor: Botón en Compras para registrar abonos directos que impactan Caja Chica inmediatamente.',
    ]
  },
  {
    version: 'v6.23.0',
    date: '31 de Julio de 2026',
    time: '10:00 AM',
    summary: 'Mejora integral (Offline + Analítica) y Corrección Histórica.',
    highlights: [
      'Descarga de Paquete Offline: El ERP ahora se puede llevar a Excel o en un archivo HTML portable con los datos integrados.',
      'UX Premium en Cobranza: Renovación visual para que el cuadro de cobranza y antigüedades sea claro e intuitivo.',
      'Deuda Histórica: Se incorporó la configuración de un saldo histórico para que la deuda real de compras coincida con contabilidad.',
    ]
  },
  {
    version: 'v6.22.0',
    date: '31 de Julio de 2026',
    time: '09:20 AM',
    summary: 'Consolidación de Flujo de Efectivo, recálculo en vivo de deudas y mejoras de nomenclatura.',
    highlights: [
      'Tarjeta "Cascada Financiera": Flujo de efectivo unificado y desglosado en un solo módulo',
      'La Deuda con Andrés en Compras ahora se calcula 100% en vivo usando costo real, ignorando historial sucio',
      'Corrección de alertas: Ahora advierte sobre "contrarecibos" en lugar de "facturas" vencidas',
    ]
  },
  {
    version: 'v6.20.0',
    date: '31 de Julio de 2026',
    time: '05:33 AM',
    summary: 'Saldo con Andrés corregido: "Registrar Entrega" en Compras nunca actualizaba la deuda, y una regresión había vuelto a calcularla sobre lo pedido.',
    highlights: [
      'Unificado el registro de compra a Andrés en una sola función compartida entre el expediente y Compras',
      'Revertida una regresión silenciosa del Ciclo 26 que volvía a usar kilos pedidos en vez de entregados',
      'Recuerda presionar "Recalcular Indicadores" después de instalar esta versión',
    ]
  },
  {
    version: 'v6.19.0',
    date: '31 de Julio de 2026',
    time: '05:10 AM',
    summary: '"Vencido" ahora cuenta por fecha en vivo; Bitácora de Parches completada.',
    highlights: [
      'Los contrarecibos vencidos por calendario ya no esperan al proceso de medianoche para contar',
      'Esta misma bitácora, que llevaba 10 versiones sin actualizarse, quedó al día',
    ]
  },
  {
    version: 'v6.18.0',
    date: '31 de Julio de 2026',
    time: '05:00 AM',
    summary: 'Adelanto a proveedor visible otra vez; vencidos por fecha corregidos en el panel.',
    highlights: [
      'Corregida la migración inicial: los movimientos de CAJA no guardaban a qué proveedor correspondían',
      'Nueva herramienta en /seed para reparar movimientos existentes sin proveedor',
      '"Vencido" en el panel ahora cuenta por fecha en vivo, no solo por el job diario de medianoche',
    ]
  },
  {
    version: 'v6.17.0',
    date: '31 de Julio de 2026',
    time: '04:49 AM',
    summary: 'Panel reordenado en secciones, "Caja Chica" renombrado a CAJA, catálogo editable, y el botón "Notificar al cliente" reparado.',
    highlights: [
      'Corregido "Notificar al cliente": el mailto no tenía ningún destinatario',
      'Panel principal reagrupado en Ventas y Ganancias / Cobranza / Caja y Operación',
      '"Total Vendido" ahora aclara que es acumulado sin límite de fecha',
      'Catálogo con alta, edición y borrado de productos',
    ]
  },
  {
    version: 'v6.16.0',
    date: '31 de Julio de 2026',
    time: '04:19 AM',
    summary: 'Compras con folio, cliente y fecha de entrega; registro de entregas compartido con el expediente.',
    highlights: [
      'Lógica de entregas extraída a un módulo compartido entre Compras y el expediente',
      'Tarjeta de "Entregas Atrasadas de Andrés" y buscador por folio/cliente',
      'Botón para registrar una entrega sin salir de Compras',
    ]
  },
  {
    version: 'v6.15.0',
    date: '31 de Julio de 2026',
    time: '01:47 AM',
    summary: 'Seguridad en el Reporte Global de Cobranza.',
    highlights: [
      'HTML sin escapar y fuga de memoria corregidas en printCobranzaGlobalReport',
    ]
  },
  {
    version: 'v6.14.0',
    date: '31 de Julio de 2026',
    time: '01:33 AM',
    summary: 'Entregas como eventos con fecha y productos: fin del riesgo de doble factura.',
    highlights: [
      'Cada entrega ahora es un evento con fecha y cantidad por producto, no un acumulado',
      'Una entrega ya facturada no puede volver a facturarse — protección estructural',
      'Migración automática de expedientes viejos sin perder historial',
    ]
  },
  {
    version: 'v6.13.0',
    date: '31 de Julio de 2026',
    time: '00:16 AM',
    summary: 'Versión del sistema sincronizada de raíz; saldo con Andrés más claro.',
    highlights: [
      'La versión ya no se escribe a mano: se toma de package.json en cada compilación',
      'receivedKilos sincronizado con lo entregado realmente',
    ]
  },
  {
    version: 'v6.12.0',
    date: '31 de Julio de 2026',
    time: '00:57 AM',
    summary: 'Eliminada la implementación duplicada y con bug de "Facturar lo Entregado".',
    highlights: [
      'Quitado el camino que podía facturar mercancía no entregada',
      'Autocompletado de Cliente/Proveedor y validación de campos obligatorios',
      'Cero tipos "any" en OrderModal.tsx y Dashboard.tsx',
    ]
  },
  {
    version: 'v6.10.0',
    date: '30 de Julio de 2026',
    time: '11:56 PM',
    summary: 'Deuda con Andrés reconocida sobre lo entregado, no sobre lo pedido.',
    highlights: [
      'Confirmado por el usuario: la deuda sube solo con lo que Andrés entrega de verdad',
    ]
  },
  {
    version: 'v6.9.0',
    date: '30 de Julio de 2026',
    time: '11:39 PM',
    summary: '"Pendiente de Facturar" visible en panel, filtro y expediente.',
    highlights: [
      'Nueva tarjeta en el panel con enlace directo al filtro',
      'Aviso en la pestaña Productos cuando hay algo entregado sin facturar',
    ]
  },
  {
    version: 'v6.8.0',
    date: '30 de Julio de 2026',
    time: '11:50 PM',
    summary: 'Vulnerabilidad alta en producción eliminada, sin CR / con CR separado, datos SAT, referencia de transferencia.',
    highlights: [
      'Dependencia muerta de la IA retirada eliminada: functions pasó de 12 vulnerabilidades altas a 0',
      '"Te deben" separado en facturado-sin-contrarecibo y contrarecibo-generado',
      'Referencia de transferencia para conciliar el depósito del contador contra el banco',
      'Datos SAT (clave, unidad, método y forma de pago) en Configuración, conectados a la remisión',
      'Aviso de vencimientos diario, buscable desde /logs',
    ]
  },
  {
    version: 'v6.7.0',
    date: '30 de Julio de 2026',
    time: '11:30 PM',
    summary: 'Menú sin confusión entre Expedientes y Por Orden de Compra; código de producto en Compras.',
    highlights: [
      '"Órdenes / Ventas" y "Seguimiento OC" renombradas a Expedientes y Por Orden de Compra, con nota cruzada',
      'Código de producto en Compras con búsqueda en el catálogo y alta rápida si no existe',
      'Catálogo empareja productos por código en vez de texto exacto de la descripción',
    ]
  },
  {
    version: 'v6.6.0',
    date: '30 de Julio de 2026',
    time: '11:00 PM',
    summary: 'Compilación local reparada, Ganancia Comercial corregida, facturación desde entregas.',
    highlights: [
      'Reparados dos errores que impedían compilar (variable fuera de alcance, Hook condicional)',
      '"Ganancia Comercial" corregida: usaba un campo inexistente y pisaba el valor correcto del servidor',
      'Botón "Facturar lo entregado": arma la factura sumando los kilos entregados por renglón',
    ]
  },
  {
    version: 'v6.5.0',
    date: '30 de Julio de 2026',
    time: '10:00 PM',
    summary: 'Panel completo: margen, Caja Chica y cobros con contabilidad ya cargan.',
    highlights: [
      'Corregido el candado que dejaba "Ganancia Comercial" siempre en $0.00',
      'Migración de contrarecibos ya pagados cuyo dinero sigue con el contador',
      'Migración del saldo y movimientos reales de Caja Chica',
    ]
  },
  {
    version: 'v6.4.0',
    date: '30 de Julio de 2026',
    time: '08:00 PM',
    summary: 'Caja Chica recibe el depósito real del cobro, no la utilidad.',
    highlights: [
      'El cobro en bloque restaba también el costo del material: se contaba dos veces',
      'Unificados los dos caminos de cobro, que depositaban montos distintos',
      'Comisión ajustada a 8% del subtotal, verificada contra tres cobros reales',
    ]
  },
  {
    version: 'v6.3.0',
    date: '30 de Julio de 2026',
    time: '06:00 PM',
    summary: 'Base de comisión corregida tras verificar contra cobros reales del contador.',
    highlights: [
      'Comisión calculada sobre el subtotal en vez del total con IVA (era la causa del descuadre)',
    ]
  },
  {
    version: 'v6.2.0',
    date: '30 de Julio de 2026',
    time: '04:00 PM',
    summary: 'La migración inicial dejaba de nuevo el sistema vacío: corregido.',
    highlights: [
      'La migración no escribía invoiceStatuses: los registros quedaban invisibles para todo el sistema',
      'La migración ahora recalcula los indicadores del panel al terminar',
    ]
  },
  {
    version: 'v6.1.0',
    date: '30 de Julio de 2026',
    time: '01:00 PM',
    summary: 'Ciclo 4 reaplicado sobre v6: seguridad en impresión y concurrencia en cobros.',
    highlights: [
      'Escape de HTML en la impresión consolidada de Cobranza',
      'OrderModal.save() migrado a transacción con detección de conflictos de edición simultánea',
      'Bundle principal reducido de 598 kB a 34.9 kB con carga diferida por ruta',
    ]
  },
  {
    version: 'v6.0.0',
    date: '29 de Julio de 2026',
    time: '11:00 PM',
    summary: 'Arquitectura Enterprise O(1), Paginación Realtime y Deshacer Cobros en Bloque.',
    highlights: [
      'Agregación Financiera Server-Side: Dashboard carga en 10ms usando un Singleton Document',
      'Paginación Infinita Realtime en el historial de órdenes (Ahorro de 95% en ancho de banda)',
      'Deshacer Cobros en Bloque: Devuelve lotes enteros de contrarecibos al estado Por Cobrar',
      'Refactorización sin Provider: Cero caídas por OOM (Out Of Memory) en Safari/iOS',
    ]
  },
  {
    version: 'v5.5.0',
    date: '28 de Julio de 2026',
    time: '10:00 PM',
    summary: 'Catálogo Inteligente Predictivo, Corrección de Utilidad Líquida (Margen Real) y Automatización de Caja Chica.',
    highlights: [
      'Catálogo Inteligente (/catalogo) con algoritmo predictivo y semáforo (🔴/🟡/🟢) de reabastecimiento',
      'Corrección de fórmula de rentabilidad: Utilidad Líquida calculada en base al Margen Real (Venta - Compra - Comisiones) ignorando IVA',
      'Autocompletado de descripciones, precios y unidades al registrar productos en las Órdenes de Compra',
      'Flujo Automático Caja Chica -> Compras: Se generan egresos de caja al abonar o liquidar deuda al fabricante Andrés'
    ]
  },
  {
    version: 'v5.4.0',
    date: '28 de Julio de 2026',
    time: '09:25 PM',
    summary: 'Paquete Consolidado PDF (Remisión + CR + Factura), Rentabilidad Líquida Real por CR, Optimización O(1) Cloud Functions y Seguridad Zero-Trust.',
    highlights: [
      'Paquete de Impresión Consolidado (Remisión + CR + Factura) en 1-clic con firmantes',
      'Tabla de Rentabilidad Líquida Real por Contrarecibo ($ y %) sin mermas para Andrés',
      'Indexación O(1) de invoiceFolios en Cloud Functions eliminando Full Table Scans',
      'Edición interactiva de expedientes directamente desde Seguimiento de OC (/oc)',
      'Seguridad Zero-Trust: email_verified == true en Firestore & Storage Rules',
    ]
  },
  {
    version: 'v5.3.0',
    date: '28 de Julio de 2026',
    time: '06:10 PM',
    summary: 'Seguimiento OC, Flujo de Cobro en 3 Estados y Sincronización HTML Offline.',
    highlights: [
      'Vista de Seguimiento OC (/oc) para comparar kilos contratados vs surtidos',
      'Flujo de Cobranza de 3 Estados (Por Cobrar -> Con Contador -> Recibido en Caja)',
      'Widget "Por Recibir del Contador" en Dashboard',
      'Sincronización en la nube con plantilla HTML Offline (bridge.ts)',
    ]
  },
  {
    version: 'v5.2.0',
    date: '28 de Julio de 2026',
    time: '02:40 PM',
    summary: 'Sistema de Respaldos Rodantes en la Nube (5 Máx) y Comisión Editable por Factura.',
    highlights: [
      'Poda automática de snapshots reteniendo exactamente los 5 más recientes',
      'Restauración a 1-clic desde la interfaz del Dashboard',
      'Campo de comisión del contador editable por factura individual',
    ]
  }
];

export default function Dashboard() {
  const { purchases } = usePurchases();
  const { expenses, loading: loadingExp } = useExpenses();
  const { settings } = useSystemSettings();
  const { orders: globalOrders, loading: loadingGlobalOrders } = useOrdersContext();
  const { role, user } = useAuth();
  const { config } = useConfig();
  const nav = useNavigate();
  const toast = useToast();
  const [health, setHealth] = useState<{ snapshotDate: Date | null; recentLogs: number; dbStatus: string }>({ snapshotDate: null, recentLogs: 0, dbStatus: '...' });
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showLiveLogsModal, setShowLiveLogsModal] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LiveLogEntry[]>([]);
  const [cloudBackups, setCloudBackups] = useState<CloudSnapshotMeta[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  async function recalcStats() {
    setRecalcBusy(true);
    try {
      const fn = httpsCallable<unknown, { ok: boolean; procesados: number; mensaje: string }>(
        functions, 'recalcDashboardStats',
      );
      const res = await fn({});
      toast(res.data.mensaje, 'ok');
    } catch (e) {
      toast(`No se pudieron recalcular los indicadores: ${(e as Error).message}`, 'bad');
    } finally {
      setRecalcBusy(false);
    }
  }

  const [statsDoc, loadingStats, statsError] = useDocumentData(doc(db, 'stats', deptFilter === 'ALL' ? 'dashboard' : `dashboard_${deptFilter}`));
  
  const loading = loadingStats || loadingGlobalOrders || loadingExp;
  const error = statsError?.message;

  useEffect(() => {
    if (role !== 'admin') return;
    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(25));
    const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
      const list: LiveLogEntry[] = [];
      snap.forEach((d: QueryDocumentSnapshot) => {
        const data = d.data();
        list.push({
          id: d.id,
          user: data.user || 'Sistema',
          action: data.action || 'Movimiento sin título',
          details: data.details,
          timestamp: data.timestamp?.toDate?.() ?? null,
        });
      });
      setLiveLogs(list);
    });
  
return () => unsub();
    // `role` DEBE estar en las dependencias: llega asincrono desde
    // AuthContext, asi que en el primer render vale undefined, el efecto sale
    // por el early return y con el arreglo vacio nunca volvia a ejecutarse.
    // Resultado: al administrador no le cargaban nunca los logs en vivo.
  }, [role]);

  useEffect(() => {
    if (role !== 'admin') return;
    const fetchHealth = async () => {
      try {
        const snap = await getDoc(doc(db, 'snapshots', 'latest'));
        const snapDate = snap.exists() ? snap.data().createdAt?.toDate() : null;
        
        const logsQ = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(50));
        const logsSnap = await getDocs(logsQ);
        const today = new Date();
        today.setHours(0,0,0,0);
        let logsToday = 0;
        logsSnap.forEach(d => {
          if (d.data().timestamp?.toDate() >= today) logsToday++;
        });
        
        setHealth({ snapshotDate: snapDate, recentLogs: logsToday, dbStatus: 'OK' });
      } catch (e) {
        console.error('No se pudo leer el estado del sistema:', e);
        setHealth({ snapshotDate: null, recentLogs: 0, dbStatus: 'Sin conexión' });
      }
    };
    fetchHealth();
  }, [role]);

  async function handleCreateBackup() {
    setBackupBusy(true);
    try {
      const ordersSnap = await getDocs(collection(db, PATHS.orders));
      const allOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));
      
      const res = await createCloudBackup(user?.email, allOrders, purchases, expenses, config);
      setHealth(h => ({ ...h, snapshotDate: new Date() }));
      toast(`☁ Respaldo guardado en la nube (${res.count}/5 disponibles)`, 'ok');
    } catch (e) {
      toast(`No se pudo crear el respaldo: ${(e as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleOpenBackupsModal() {
    setBackupBusy(true);
    try {
      const backups = await listCloudBackups();
      setCloudBackups(backups);
      setShowBackupsModal(true);
    } catch (e) {
      toast(`Error al listar respaldos: ${(e as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreBackup(snap: CloudSnapshotMeta) {
    if (!window.confirm(`⚠️ ¿Deseas restaurar el respaldo del ${snap.createdAt?.toLocaleString('es-MX')}?\n\nEsto actualizará el estado de la nube con este punto de restauración.`)) {
      return;
    }
    setBackupBusy(true);
    try {
      const res = await restoreCloudBackup(user?.email, snap);
      toast(`✅ ${res.message}`, 'ok');
      setShowBackupsModal(false);
      window.location.reload();
    } catch (e) {
      toast(`Error al restaurar: ${(e as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  }
    // Filter global orders exactly as the original query did, PLUS by department
    const activeOrders = useMemo(() => {
      return globalOrders.filter((o: PurchaseOrder) => {
        const passDept = deptFilter === 'ALL' || o.department === deptFilter;
        const passStatus = o.invoiceStatuses?.some((s: string) => ['pending', 'overdue', 'manual_review', 'paid'].includes(s));
        return passDept && passStatus;
      });
    }, [globalOrders, deptFilter]);

  const k = useMemo(() => {
    const st = statsDoc || {};
    const kpis = st.kpis || { totalKilos: 0, totalVendido: 0, netoTotal: 0, margenTotal: 0, gananciaRealizadaTotal: 0, porCobrar: 0, porCobrarSinCR: 0, porCobrarConCR: 0, vencido: 0, cobrado: 0, netoCobrado: 0, porRecibir: 0, montoPendienteFacturar: 0 };
    const counters = st.counters || { pendingOrders: 0, overdueOrders: 0, manualReview: 0, totalOrders: 0, pedidoOrders: 0 };
    const mesesObj = st.histograms || {};

    const mesesKeys = Object.keys(mesesObj).sort().slice(-6);
    const maxMes = mesesKeys.length > 0 ? Math.max(1, ...mesesKeys.map((m) => mesesObj[m].venta)) : 1;

    const alerts = extractDashboardAlerts(activeOrders);
    const vencidas = alerts.vencidas;
    const proximas = alerts.proximas;
    const porRecibir = alerts.porRecibir;
    const criticos30 = alerts.criticos30;
    const urgentes15 = alerts.urgentes15;
    const recientes1 = alerts.recientes1;
    const proyeccion7d = alerts.proyeccion7d;
    const proyeccion15d = alerts.proyeccion15d;

    // Respaldo en vivo, SOLO para el indicador que de verdad esta en cero.
    let liveMargenTotal = kpis.margenTotal || 0;

    if (kpis.margenTotal === 0) {
      liveMargenTotal = calculateLiveMargenTotal(activeOrders, config.costPricePerKg);
    }

    // Ganancia por Cobros NO tiene respaldo en vivo: la consulta de
    // activeOrders excluye a proposito el estatus 'collected' (mas abajo),
    // asi que un recalculo en el navegador nunca veria las facturas que mas
    // importan para este indicador. Se confia siempre en el agregado del
    // servidor, que si recorre todos los expedientes.
    const liveGananciaRealizada = kpis.gananciaRealizadaTotal || 0;

    const deudaTotalProvidencia = (kpis.porCobrar || 0) + (kpis.montoPendienteFacturar || 0);
    const comisionContable = computeCommissionFromInvoiceTotal(deudaTotalProvidencia, config as any);
    const dineroRealARecibir = deudaTotalProvidencia - comisionContable;

    // Calcular Remisiones (Kilos entregados - Kilos facturados)
    let totalKilosDelivered = 0;
    let totalKilosInvoiced = 0;
    activeOrders.forEach(o => {
      const deliveries = o.deliveries || [];
      const invoices = o.invoices || [];
      let oDel = 0, oInv = 0;
      deliveries.forEach(d => oDel += (d.kilos || 0));
      invoices.forEach(i => oInv += (i.kilos || 0));
      totalKilosDelivered += oDel;
      totalKilosInvoiced += oInv;
    });
    const kilosPendientesFacturar = Math.max(0, totalKilosDelivered - totalKilosInvoiced);
    const valorPendienteFacturar = kilosPendientesFacturar * (config.costPricePerKg || 42);


    const allMeses = Object.keys(mesesObj).sort();
    let periodText = 'Acumulado de todo el historial, sin límite de fecha';
    if (allMeses.length > 0) {
      const formatMonth = (m: string) => {
        const [yy, mm] = m.split('-');
        const date = new Date(parseInt(yy), parseInt(mm) - 1, 1);
        return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      };
      if (allMeses.length === 1) {
        periodText = `Acumulado de ${formatMonth(allMeses[0])}`;
      } else {
        periodText = `Acumulado de ${formatMonth(allMeses[0])} a ${formatMonth(allMeses[allMeses.length - 1])}`;
      }
    }

    return {
      ...kpis,
      periodText,
      margenTotal: round2(liveMargenTotal),
      gananciaRealizadaTotal: round2(liveGananciaRealizada),
      porRecibir,
      totalPorRecibir: round2(porRecibir.reduce((acc, r) => acc + r.net, 0)),
      pending: { length: counters.pendingOrders },
      pedidoPendiente: { length: counters.pedidoOrders },
      overdue: { length: counters.overdueOrders },
      review: { length: counters.manualReview },
      totalOrders: counters.totalOrders,
      meses: mesesObj,
      mesesKeys,
      maxMes,
      criticos30,
      urgentes15,
      recientes1,
      vencidas,
      proximas,
      deudaTotalProvidencia,
      comisionContable,
      dineroRealARecibir,
      kilosPendientesFacturar,
      valorPendienteFacturar,
      proyeccion7d,
      proyeccion15d
    };
  }, [statsDoc, activeOrders, config]);

  const saldoCaja = expenses.reduce((acc, e) => acc + (e.type === 'ingreso' ? e.amount : -e.amount), 0);

  if (loading || loadingExp) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 280, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: '60%', height: 16 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} className="skeleton-card" />)}
        </div>
        <div className="kpi-grid">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 85 }} />)}
        </div>
      </div>
    );
  }
  if (error) return <div className="alert bad">{error}</div>;

  function getRentabilidadHtml() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Utilidad Comercial</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .flow-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
            .flow-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
            .flow-row:last-child { border-bottom: none; }
            .flow-label { font-weight: 600; color: #475569; }
            .flow-val { font-family: monospace; font-size: 15px; }
            .flow-total { font-weight: 800; font-size: 18px; color: #0f172a; border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 8px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 250px; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Reporte de Rentabilidad (Utilidad Comercial)")}
          
          <div style="margin-bottom: 24px; font-size: 14px; color: #475569; font-weight: 500;">
            ${k.periodText}
          </div>

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TOTAL VENDIDO</div><div class="kpi-val">$${k.ventasTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">UTILIDAD BRUTA (MARGIN)</div><div class="kpi-val" style="color: #047857;">$${k.margenTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">GANANCIA LÍQUIDA EN CAJA</div><div class="kpi-val" style="color: #2563eb;">$${k.gananciaRealizadaTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <h3>Cascada Financiera: Deuda Proyectada</h3>
          <div class="flow-box">
            <div class="flow-row"><span class="flow-label">1. Dinero en la calle (Por cobrar):</span><span class="flow-val">$${(k.porCobrar || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row"><span class="flow-label">2. Mercancía entregada pendiente de facturar:</span><span class="flow-val">$${(k.montoPendienteFacturar || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row flow-total"><span class="flow-label">Deuda Bruta de Providencia:</span><span class="flow-val" style="color: #b91c1c;">$${k.deudaTotalProvidencia.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row"><span class="flow-label">Menos Comisión Contable Estimada:</span><span class="flow-val" style="color: #047857;">-$${k.comisionContable.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row flow-total"><span class="flow-label">Dinero Real a Recibir (Neto):</span><span class="flow-val" style="color: #2563eb;">$${k.dineroRealARecibir.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
          </div>

          <h3>Métricas Operativas</h3>
          <div class="flow-box">
            <div class="flow-row"><span class="flow-label">Kilos Procesados:</span><span class="flow-val">${k.kilosTotal.toLocaleString('es-MX')} kg</span></div>
            <div class="flow-row"><span class="flow-label">Facturas Emitidas:</span><span class="flow-val">${k.facturasEmitidas.toLocaleString('es-MX')} facturas</span></div>
            <div class="flow-row"><span class="flow-label">Órdenes Atendidas:</span><span class="flow-val">${k.totalOrders.toLocaleString('es-MX')} OC's</span></div>
            <div class="flow-row"><span class="flow-label">Costo por Kilo Base:</span><span class="flow-val">$${(config?.costPricePerKg || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN/kg</span></div>
            <div class="flow-row"><span class="flow-label">Venta por Kilo Base:</span><span class="flow-val">$${(config?.salePricePerKg || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN/kg</span></div>
          </div>

          <div class="signatures">
            <div class="sig-box">Elaborado Por</div>
            <div class="sig-box">Aprobado / Revisado</div>
          </div>

          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
  }

  function printRentabilidad() {
    const html = getRentabilidadHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareRentabilidad() {
    const html = getRentabilidadHtml();
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Rentabilidad_Providencia_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  async function handleRecibir(r: { orderId: string; invoiceId: string; folio: string; cr: string; invoiceTotal: number; commission: number; net: number }) {
    if (!window.confirm(`¿Mover $${r.net.toLocaleString('es-MX', {minimumFractionDigits:2})} de la factura #${r.folio} a Caja Chica?`)) return;
    
    try {
      // 1. Encontrar la orden para actualizar el invoice especifico
      const orderRef = doc(db, PATHS.orders, r.orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) throw new Error("Orden no encontrada");
      
      const orderData = orderSnap.data();
      const invoices = orderData.invoices || [];
      const invIndex = invoices.findIndex((i: any) => i.id === r.invoiceId);
      if (invIndex === -1) throw new Error("Factura no encontrada");
      
      invoices[invIndex].creditCycle.status = 'collected';
      invoices[invIndex].collection = { ...invoices[invIndex].collection, collectedAt: Timestamp.now() };
      
      await updateDoc(orderRef, { invoices });
      
      // 2. Ingreso a caja chica
      await addDoc(collection(db, PATHS.expenses), {
        date: Timestamp.now(),
        concept: `Cobro factura #${r.folio} (CR: ${r.cr})`,
        amount: r.net,
        type: 'ingreso',
        notes: `Factura: $${r.invoiceTotal.toLocaleString('es-MX', {minimumFractionDigits:2})} — Comisión: $${r.commission.toLocaleString('es-MX', {minimumFractionDigits:2})}`,
        createdAt: serverTimestamp(),
      });
      
      toast(`💵 Recibido del contador. $${r.net.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a CAJA.`, 'ok');
    } catch (e: any) {
      toast('Error: ' + e.message, 'bad');
    }
  }

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Dashboard Maestro</h1>
            <p>Visión integral: Ventas, Cobranza (Flujo) y Operación con Providencia.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareRentabilidad}>
              <span className="icon">📤</span> Compartir PDF
            </button>
            <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printRentabilidad}>
              📈 Imprimir Reporte
            </button>
          </div>
        </div>
        <div className="tabs" style={{ marginTop: 16 }}>
          <button className={deptFilter === 'ALL' ? 'active' : ''} onClick={() => setDeptFilter('ALL')}>🏢 Toda la Empresa</button>
          {(settings?.departments || ['TH', 'GT']).map(d => (
            <button key={d} className={deptFilter === d ? 'active' : ''} onClick={() => setDeptFilter(d)}>{d}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        
        {role === 'admin' && (
          <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--ok-bg)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Último Movimiento (Live)</span>
                <span className="badge badge-ok" style={{ fontSize: 10 }}>● En vivo</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 700, marginTop: 2 }}>
                🕒 {liveLogs[0]?.timestamp ? liveLogs[0].timestamp.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Esperando movimiento…'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {liveLogs[0]?.action || 'Sistema iniciado'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                Por: {liveLogs[0]?.user || '—'}
              </div>
              <button className="btn btn-primary" onClick={() => setShowLiveLogsModal(true)} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
                ⚡ Monitor Live de Movimientos
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--accent-sunk)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            🚀
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Versión del Sistema</span>
              <span className="badge badge-ok" style={{ fontSize: 10 }}>v{__APP_VERSION__}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--accent-deep)', fontWeight: 600, marginTop: 2 }}>
              📅 {SYSTEM_CHANGELOG[0]?.date ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {SYSTEM_CHANGELOG[0]?.summary ?? ''}
            </div>
            <button className="btn" onClick={() => setShowChangelogModal(true)} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
              📜 Bitácora de Parches
            </button>
          </div>
        </div>

        {role === 'admin' && (
          <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--info-bg)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              🛡️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>Salud & Respaldos</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, marginBottom: 4 }}>
                BD: <strong>{health.dbStatus}</strong> · Respaldo: {health.snapshotDate ? fmtDate(health.snapshotDate) : 'No detectado'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy} style={{ fontSize: 10, padding: '3px 7px' }}>
                  {backupBusy ? 'Guardando…' : '☁ Respaldar'}
                </button>
                <button className="btn" onClick={() => void handleOpenBackupsModal()} disabled={backupBusy} style={{ fontSize: 10, padding: '3px 7px' }}>
                  📋 5 Máx
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel de Semáforo de Alertas Visuales - Control de Gestión */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: k.criticos30 > 0 ? 'rgba(239,68,68,0.12)' : 'var(--paper-sunk)', border: `1px solid ${k.criticos30 > 0 ? '#ef4444' : 'var(--line)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🔴</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: k.criticos30 > 0 ? '#b91c1c' : 'var(--ink-faint)' }}>Críticos (&gt;30 días)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.criticos30 > 0 ? '#b91c1c' : 'var(--ink)' }}>{k.criticos30} factura(s)</div>
          </div>
        </div>

        <div style={{ background: k.urgentes15 > 0 ? 'rgba(249,115,22,0.12)' : 'var(--paper-sunk)', border: `1px solid ${k.urgentes15 > 0 ? '#f97316' : 'var(--line)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🟠</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: k.urgentes15 > 0 ? '#c2410c' : 'var(--ink-faint)' }}>Urgentes (16-30 días)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.urgentes15 > 0 ? '#c2410c' : 'var(--ink)' }}>{k.urgentes15} factura(s)</div>
          </div>
        </div>

        <div style={{ background: k.recientes1 > 0 ? 'rgba(234,179,8,0.12)' : 'var(--paper-sunk)', border: `1px solid ${k.recientes1 > 0 ? '#eab308' : 'var(--line)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🟡</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: k.recientes1 > 0 ? '#a16207' : 'var(--ink-faint)' }}>Recientes (1-15 días)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.recientes1 > 0 ? '#a16207' : 'var(--ink)' }}>{k.recientes1} factura(s)</div>
          </div>
        </div>

        <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🟢</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#047857' }}>Por Recoger Contador</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#047857' }}>{k.porRecibir.length} contrarecibo(s)</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>📅</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Flujo a 7 Días</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>{money(k.proyeccion7d)}</div>
          </div>
        </div>

        <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>📈</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Flujo a 15 Días</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>{money(k.proyeccion15d)}</div>
          </div>
        </div>
      </div>

      {(k.overdue.length > 0 || k.review.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {k.overdue.length > 0 && (
            <div className="alert bad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong>Atención:</strong> Tienes {k.overdue.length} contrarecibo{k.overdue.length > 1 ? 's' : ''} vencido{k.overdue.length > 1 ? 's' : ''} por <strong>{money(k.vencido)}</strong>.
              </div>
              <button className="btn btn-danger" onClick={() => nav('/cobranza')}>Ir a Cobranza</button>
            </div>
          )}
          {k.review.length > 0 && (
            <div className="alert warn" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <div style={{ flex: 1 }}>
                <strong>Revisión manual:</strong> {k.review.length} archivo{k.review.length > 1 ? 's' : ''} con errores en XML o que esperan captura manual.
              </div>
              <button className="btn" onClick={() => nav('/ordenes?filtro=manual_review')} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)' }}>Revisar Ahora</button>
            </div>
          )}
        </div>
      )}

      {k.porRecibir.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1a3a2a 0%, #0d2218 100%)',
          border: '1px solid var(--ok)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 22,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>
                💼 Por Recibir del Contador
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                Estas facturas ya fueron cobradas por el cliente — el contador aún no te da el efectivo
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Total neto a recibir</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ok)' }}>{money(k.totalPorRecibir)}</div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Factura</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Contrarecibo</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Importe Factura</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Comisión</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Neto a recibir</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {k.porRecibir.map((r: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '8px 8px', color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>#{r.folio}</td>
                  <td style={{ padding: '8px 8px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{r.cr}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>{money(r.invoiceTotal)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--bad)' }}>-{money(r.commission)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--ok)', fontWeight: 700 }}>{money(r.net)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                    <button className="btn" style={{ background: 'rgba(34,197,94,0.2)', color: 'var(--ok)', borderColor: 'var(--ok)', padding: '4px 10px', fontSize: 12, fontWeight: 600 }} onClick={() => handleRecibir(r)}>
                      💵 Recibir → CAJA
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Abre la factura → "💵 Recibida del Contador → Caja Chica" para mover el dinero automáticamente.
          </div>
        </div>
      )}

      {role !== 'viewer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <button className="btn" onClick={() => nav('/subir')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>📥</span>
            <span style={{ fontWeight: 600 }}>Subir PDF</span>
          </button>
          <button className="btn" onClick={() => nav('/ordenes?nueva=1')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>🛒</span>
            <span style={{ fontWeight: 600 }}>Nueva Venta Manual</span>
          </button>
          {role === 'admin' && (
            <button className="btn" onClick={() => nav('/compras')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
              <span style={{ fontSize: 24 }}>🏭</span>
              <span style={{ fontWeight: 600 }}>Comprar al Fabricante</span>
            </button>
          )}
          <button className="btn" onClick={() => nav('/cobranza')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>💰</span>
            <span style={{ fontWeight: 600 }}>Registrar Cobro</span>
          </button>
          {role === 'admin' && (
            <button
              className="btn"
              onClick={() => void recalcStats()}
              disabled={recalcBusy}
              title="Reconstruye los indicadores de este panel leyendo todos los expedientes. Úsalo si las cifras se ven en cero o descuadradas."
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}
            >
              <span style={{ fontSize: 24 }}>{recalcBusy ? '⏳' : '🔄'}</span>
              <span style={{ fontWeight: 600 }}>{recalcBusy ? 'Recalculando…' : 'Recalcular Indicadores'}</span>
            </button>
          )}
        </div>
      )}

      {(statsDoc?.counters?.totalOrders ?? 0) === 0 && role === 'admin' && (
        <div className="alert info" style={{ marginBottom: 22, padding: '16px 20px', borderRadius: 'var(--radius)' }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            El sistema no tiene órdenes registradas aún
          </div>
          <div style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            La carga inicial se hace desde la pantalla de migración, donde pegas
            tus contrarecibos y facturas reales. Este panel ya no carga datos de
            ejemplo: hacerlo desde aquí mezclaba registros ficticios con los tuyos.
          </div>
          <button className="btn btn-primary" onClick={() => nav('/seed')}>
            📥 Ir a la carga inicial
          </button>
        </div>
      )}

      <div className="kpi-section-title">💰 Ventas y Ganancias</div>
      <div className="kpi-grid">
        <KpiCard hero label="TOTAL VENDIDO" value={<ResponsiveMoney value={k.totalVendido} />}
          sub={
            <>
              {kilos(k.totalKilos)} procesados en {k.totalOrders} órdenes
              <br /><span style={{ opacity: 0.75 }}>{k.periodText}</span>
            </>
          } />
        {role !== 'viewer' && (
          <>
            <KpiCard tone="ok" label="Ganancia Comercial" value={<ResponsiveMoney value={k.margenTotal || 0} />}
              sub="Venta - Costo (Devengada)" />
            <KpiCard tone="ok" label="Ganancia por Cobros" value={<ResponsiveMoney value={k.gananciaRealizadaTotal || 0} />}
              sub="Flujo real (Cobrado)" />
          </>
        )}
      </div>

      <div className="kpi-section-title">📋 Cobranza</div>
      <div className="kpi-grid">
        <KpiCard tone={k.pedidoPendiente.length > 0 ? 'warn' : 'ok'} label="📝 Pendiente de Facturar"
          value={<ResponsiveMoney value={k.montoPendienteFacturar || 0} />}
          sub={
            <>
              {k.pedidoPendiente.length} expediente(s) con kilos entregados sin facturar
              <br /><span style={{ opacity: 0.75 }}>Incluye IVA</span>
            </>
          }
          onClick={() => nav('/ordenes?filtro=pedido')} />
        {role !== 'viewer' ? (
          <div className="card stat-card" style={{ padding: '20px', gridColumn: 'span 2', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', border: '1px solid #334155', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Flujo de Efectivo Providencia</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#cbd5e1' }}>Facturado (Te Deben)</span>
                <strong>{money(k.porCobrar)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#cbd5e1' }}>Pendiente de Facturar</span>
                <strong>{money(k.montoPendienteFacturar ?? 0)}</strong>
              </div>
              <div style={{ height: 1, background: '#334155', margin: '4px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16 }}>
                <span style={{ color: '#e2e8f0' }}>Deuda Total Providencia</span>
                <strong>{money(k.deudaTotalProvidencia)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#f87171' }}>
                <span>(-) Comisión Contable (8%)</span>
                <strong>-{money(k.comisionContable)}</strong>
              </div>
              <div style={{ height: 1, background: '#334155', margin: '4px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 20, color: 'var(--ok)' }}>
                <span style={{ fontWeight: 700 }}>Dinero Real a Recibir</span>
                <span style={{ fontWeight: 800 }}>{money(k.dineroRealARecibir)}</span>
              </div>
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>{(k.porCobrarSinCR ?? 0) > 0 ? `${money(k.porCobrarSinCR ?? 0)} sin CR` : ''}</span>
              <span>{(k.porCobrarConCR ?? 0) > 0 ? `${money(k.porCobrarConCR ?? 0)} con CR` : ''}</span>
            </div>
          </div>
        ) : (
          <KpiCard tone={k.porCobrar > 0 ? 'warn' : 'ok'} label="Te deben" value={<ResponsiveMoney value={k.porCobrar} />}
            sub={`${k.pending.length + k.overdue.length} órdenes abiertas`}
            onClick={() => nav('/cobranza')} />
        )}

        <KpiCard tone={k.overdue.length ? 'bad' : undefined} label="Vencido" value={<ResponsiveMoney value={k.vencido} />}
          sub={`${k.overdue.length} contrarecibo${k.overdue.length === 1 ? '' : 's'} pasado${k.overdue.length === 1 ? '' : 's'} de fecha`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone="cash" label="Cobrado" value={<ResponsiveMoney value={k.cobrado} />}
          sub={role !== 'viewer' ? `neto ${money(k.netoCobrado)}` : undefined} />
      </div>

      <div className="kpi-section-title">🏦 Caja y Operación</div>
      <div className="kpi-grid">
        {role === 'admin' && (
          <KpiCard tone={saldoCaja < 0 ? "bad" : "ok"} label="CAJA" value={<ResponsiveMoney value={saldoCaja} />}
            sub="flujo líquido" onClick={() => nav('/caja-chica')} />
        )}
        <KpiCard tone={k.review.length ? 'warn' : undefined} label="Esperan captura manual"
          value={k.review.length} sub="XML no subido o inválido"
          onClick={() => nav('/ordenes?filtro=manual_review')} />
      </div>

      {k.mesesKeys.length > 0 && (
        <Card title="Ganancias Estimadas por Fecha de Factura">
          <div className="table-scroll">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Mes de Emisión</th>
                  <th className="num">Venta Facturada</th>
                  <th className="num">Ganancia Comercial</th>
                  <th className="num">Ganancia por Cobros</th>
                </tr>
              </thead>
              <tbody>
                {k.mesesKeys.map((m: string) => {
                  const data = k.meses[m];
                  return (
                    <tr key={m}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{monthLabel(m)}</td>
                      <td className="num mono">{money(data.venta)}</td>
                      <td className="num mono" style={{ color: 'var(--ok)' }}>{money(data.margen || 0)}</td>
                      <td className="num mono" style={{ color: 'var(--ok)' }}>{money(data.gananciaRealizada || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ width: '100%', height: 320, padding: '16px 20px', marginTop: '16px' }}>
            <ResponsiveContainer>
              <BarChart
                data={k.mesesKeys.map((m: string) => ({ name: monthLabel(m), vendido: k.meses[m].venta, ganancia: k.meses[m].ganancia, cobrado: k.meses[m].cobrado }))}
                margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-soft)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-soft)' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--ink-soft)' }}
                  tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: 'var(--paper-sunk)' }}
                  contentStyle={{ backgroundColor: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--ink)', fontSize: 13, boxShadow: 'var(--shadow)' }}
                  formatter={(value) => money(Number(value))}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="vendido" name="Total Vendido" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="ganancia" name="Utilidad Neta" fill="var(--ok)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="Facturas Vencidas" hint={`${k.vencidas.length}`}>
        {k.vencidas.length === 0 ? (
          <Empty>Ninguna factura atrasada.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documentos</th><th>Cliente</th><th>Vence</th><th className="num">Días</th>
                  <th className="num">Monto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {k.vencidas.slice(0, 8).map(({ o, inv, d }: { o: PurchaseOrder; inv: Invoice; d: number | null }) => {
                  const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                  const saldo = Math.max(invTotal - (inv.collection?.paidAmount ?? 0), 0);
                  return (
                  <tr key={inv.id} className={(d ?? 0) > 0 ? 'row-bad' : ''}>
                    <td className="mono">
                      <div style={{ fontWeight: 600 }}>Factura: {inv.folio || 'Pendiente'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>CR: {inv.collection?.contrareciboNumber || 'S/N'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>Orden: {o.folio}</div>
                    </td>
                    <td>{o.client ?? '—'} {o.department ? ` - ${o.department}` : ''}</td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {d === null ? '—' : d > 0 ? `+${d}` : d}
                      <span title={d !== null && d > 30 ? '+30 días' : d !== null && d >= 15 ? '+15 días' : 'Reciente'} style={{ fontSize: 10 }}>
                        {d !== null && d > 30 ? '🔴' : d !== null && d >= 15 ? '🟡' : '🟢'}
                      </span>
                    </td>
                    <td className="num mono">{money(saldo)}</td>
                    <td><StatusBadge status={inv.creditCycle.status} /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Próximas a Vencer (7 días)" hint={`${k.proximas.length}`}>
        {k.proximas.length === 0 ? (
          <Empty>Ninguna factura por vencer en los próximos 7 días.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documentos</th><th>Cliente</th><th>Vence</th><th className="num">Faltan</th>
                  <th className="num">Monto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {k.proximas.slice(0, 8).map(({ o, inv, d }: { o: PurchaseOrder; inv: Invoice; d: number | null }) => {
                  const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                  const saldo = Math.max(invTotal - (inv.collection?.paidAmount ?? 0), 0);
                  const diasFaltantes = d !== null ? Math.abs(d) : null;
                  return (
                  <tr key={inv.id} className="row-warn">
                    <td className="mono">
                      <div style={{ fontWeight: 600 }}>Factura: {inv.folio || 'Pendiente'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>CR: {inv.collection?.contrareciboNumber || 'S/N'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>Orden: {o.folio}</div>
                    </td>
                    <td>{o.client ?? '—'} {o.department ? ` - ${o.department}` : ''}</td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {diasFaltantes === null ? '—' : diasFaltantes === 0 ? 'Hoy' : `${diasFaltantes} días`}
                      <span title="Por vencer" style={{ fontSize: 10 }}>🟡</span>
                    </td>
                    <td className="num mono">{money(saldo)}</td>
                    <td><StatusBadge status={inv.creditCycle.status} /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showBackupsModal && (
        <Modal title="☁ Respaldos en la Nube (Máximo 5 rodantes)" onClose={() => setShowBackupsModal(false)}>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              El sistema mantiene automáticamente los <strong>5 respaldos más recientes</strong> en Firestore. Si creas uno nuevo, el más antiguo se elimina de la nube para no saturar.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Respaldos activos: {cloudBackups.length} de 5</span>
              <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy} style={{ fontSize: 12 }}>
                {backupBusy ? 'Guardando…' : '➕ Crear Nuevo Respaldo Ahora'}
              </button>
            </div>
            {cloudBackups.length === 0 ? (
              <Empty>No hay respaldos guardados aún en la nube.</Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cloudBackups.map((snap, idx) => (
                  <div key={snap.id} style={{ padding: 14, background: 'var(--paper-sunk)', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📅 {snap.createdAt ? snap.createdAt.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : snap.id}</span>
                        {idx === 0 && <span style={{ fontSize: 11, background: 'var(--ok)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>Más reciente</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                        Creado por: <strong>{snap.createdBy}</strong> · Expedientes: <strong>{snap.totalOrders}</strong>
                      </div>
                    </div>
                    <button className="btn" onClick={() => void handleRestoreBackup(snap)} disabled={backupBusy} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', fontSize: 12 }}>
                      🔄 Restaurar este respaldo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {showChangelogModal && (
        <Modal title="📜 Bitácora Histórica de Cambios del Sistema" onClose={() => setShowChangelogModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
            {SYSTEM_CHANGELOG.map((item) => (
              <div key={item.version} style={{ padding: 16, background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <span className="badge badge-ok" style={{ fontSize: 13, fontWeight: 700 }}>Versión {item.version}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent-deep)', fontWeight: 600 }}>🕒 {item.date} — {item.time}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>{item.summary}</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ink-soft)' }}>
                  {item.highlights.map((h, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {showLiveLogsModal && (
        <Modal title="⚡ Monitor de Movimientos en Tiempo Real (Live)" onClose={() => setShowLiveLogsModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
              🔴 <strong>Sincronización en vivo:</strong> Este monitor se actualiza automáticamente al instante cuando cualquier usuario opera en Caja Chica, expedientes, compras o cobranza.
            </div>
            {liveLogs.length === 0 ? (
              <Empty>No hay movimientos registrados recientemente.</Empty>
            ) : (
              liveLogs.map((log, idx) => (
                <div key={log.id} style={{ padding: 12, background: idx === 0 ? 'var(--ok-bg)' : 'var(--paper-sunk)', border: idx === 0 ? '1px solid var(--ok)' : '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: idx === 0 ? 'var(--ok)' : 'var(--ink)' }}>
                      {idx === 0 ? '⚡ ' : ''}{log.action}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
                      🕒 {log.timestamp ? log.timestamp.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Reciente'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span>Usuario: <strong>{log.user}</strong></span>
                    {log.details && (
                      <span style={{ fontSize: 10, color: 'var(--ink-muted)' }}>
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
