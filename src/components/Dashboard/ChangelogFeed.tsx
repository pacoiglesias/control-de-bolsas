import { Modal } from '../ui';

export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const SYSTEM_CHANGELOG: SystemRelease[] = [
  {
    version: 'v6.36.0',
    date: '2 de Agosto de 2026',
    time: '09:40 PM',
    summary: 'Arquitectura Limpia: Refactorización Enterprise del Dashboard',
    highlights: [
      'Dashboard desacoplado (reducción del 60% del peso del archivo).',
      'Extracción completa de la lógica de cálculos y KPIs financieros al nuevo engine (useDashboardStats).',
      'Aislamiento de modales pesados y del widget de validación del maquilador (BandejaMaquilaWidget).',
      'Código robusto O(1) preparándolo para la siguiente fase gráfica (Glassmorphism).'
    ]
  },
  {
    version: 'v6.30.0',
    date: '1 de Agosto de 2026',
    time: '03:40 PM',
    summary: 'Release ERP Providencia: PWA Offline, KPIs Globales (P&L) y Estado de Cuenta (Espejo)',
    highlights: [
      'Inventario Vivo (Bodega): Indicador global exacto de kilos facturados vs surtidos, sin merma.',
      'Flujo de Efectivo Proyectado: Integración de Caja Chica, Tránsito de Cobranza y Deuda Proveedor (Andrés) en tiempo real.',
      'Rentabilidad P&L por Mes: Nuevo selector de "Mes P&L" en Dashboard que permite calcular la utilidad neta mensual (Ganancia Comercial vs OPEX).',
      'Estado de Cuenta (Espejo): Nueva pestaña en Cobranza que actúa como Libro Mayor para auditar todo lo emitido y cobrado al cliente (Providencia).',
      'Exportación Maestra: Sábana de auditoría en Excel agregada al Dashboard.'
    ]
  },
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
    version: 'v6.31.0',
    date: '2 de Agosto de 2026',
    time: '11:20 AM',
    summary: 'Módulo de Conciliación Maestra por Excel (Auditoría Bidireccional).',
    highlights: [
      'Exportación mejorada con ID_SISTEMA',
      'Pantalla /audit para cruzar el Excel vs Base de Datos',
      'Flujo neto exacto de comisión de contador a Caja Chica'
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

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="📜 Bitácora Histórica de Cambios del Sistema" onClose={onClose}>
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
  );
}
