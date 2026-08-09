export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const SYSTEM_CHANGELOG: SystemRelease[] = [
  {
    version: 'v7.0.4',
    date: '8 de Agosto de 2026',
    time: '07:20 PM',
    summary: 'Fase 5 (Etapas 2 y 3): Colaboración Multi-jugador, Analítica Predictiva, Aprobación de Excedentes y Máscaras de Moneda.',
    highlights: [
      'Indicadores de Presencia en Tiempo Real: Ve quién más está conectado y en qué pantalla para evitar colisiones.',
      'Analítica Predictiva: El Dashboard ahora proyecta el flujo de caja a 30 días con base en las fechas de vencimiento reales.',
      'Flujo de Aprobación de Maquila: El portal de maquiladores ahora permite registrar kilos excedentes, dejándolos en estado de "Aprobación Pendiente".',
      'Formatos Monetarios (Masking): Se integró el componente CurrencyInput en Caja Chica y Ajustes para auto-formatear monedas (ej. 1000 -> $1,000.00).'
    ]
  },
  {
    version: 'v7.0.3',
    date: '8 de Agosto de 2026',
    time: '06:45 PM',
    summary: 'Fase 5: UI/UX Glassmorphism, Skeleton Loaders, Command Palette Global (Ctrl+K) y Notificaciones Deshacer (Undo).',
    highlights: [
      'Implementado diseño Glassmorphism con sombras profundas y desenfoque, nueva tipografía.',
      'Añadidos Skeleton Loaders animados en todo el sistema para cargas más elegantes.',
      'Lanzamiento de Command Palette Global: presiona Ctrl+K en cualquier lugar para buscar expedientes.',
      'Soporte completo Offline-First vía PWA (Progressive Web App) para seguir operando sin red.',
      'Soporte para notificaciones flotantes con opción "Deshacer" en varias pantallas operativas.'
    ]
  },
  {
    version: 'v7.0.1',
    date: '6 de Agosto de 2026',
    time: '11:59 PM',
    summary: 'Correcciones urgentes: sincronización de facturas con el resto del sistema, y confirmación de cobro restaurada',
    highlights: [
      'Cuatro flujos rápidos (asignar CR, facturar, cobrar, recalcular precios) dejaban facturas invisibles en Dashboard/Cobranza al guardar de forma directa.',
      'Restaurado el botón "Recibida del Contador → CAJA" con confirmación de monto real, perdido al separar el widget de factura.',
    ]
  },
  {
    version: 'v6.76.1',
    date: '6 de Agosto de 2026',
    time: '03:30 PM',
    summary: 'Modal Facturas & CR independiente, Command Menu integrado, y correcciones de CSS',
    highlights: [
      'Nuevo modal dedicado exclusivamente a Facturas & Contrarecibos (FacturasCRModal).',
      'Integración global del menú de comandos (Ctrl + K) desde la barra principal.',
      'Corrección de sintaxis CSS y alineación de la interfaz Modal.'
    ]
  },
  {
    version: 'v6.76.0',
    date: '6 de Agosto de 2026',
    time: '12:30 PM',
    summary: 'Filtro de folios excluye expedientes eliminados y llenado espejo invoicesV2',
    highlights: [
      'La validación de folio duplicado ahora excluye los expedientes en la papelera.',
      'Primer llenado completo del espejo de facturas en la colección raíz invoicesV2.'
    ]
  },
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
  }
];
