export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const SYSTEM_CHANGELOG: SystemRelease[] = [
  {
    version: 'v7.0.25',
    date: '10 de Agosto de 2026',
    time: '8:05 PM',
    summary: 'El filtro "TH" / "GT" del Dashboard decía "sistema sin órdenes registradas" -- faltaba el campo para capturarlo',
    highlights: [
      'El campo "Departamento" de cada expediente ya existía en la base de datos y ya alimentaba el filtro TH/GT del Dashboard Maestro, pero nunca hubo un campo en el formulario del expediente para llenarlo -- por eso siempre estaba vacío en todos los expedientes, aunque el folio dijera "TH-xxx" o "GT-xxx" (eso es solo el nombre, no el campo real).',
      'Ahora hay un campo "Departamento (opcional)" junto a Cliente y Proveedor en cada expediente.',
      'Después de este despliegue hace falta llenarlo en los expedientes existentes (TH-768, TH-804, TH-836, TH-713B, TH-739 → TH; GT-597, GT-624, GT-651, GT-713, GT-742 → GT) para que el filtro empiece a mostrar algo.'
    ]
  },
  {
    version: 'v7.0.24',
    date: '10 de Agosto de 2026',
    time: '7:00 PM',
    summary: 'El precio de venta de respaldo bajó de $47 a $43/kg (confirmado por Paco), actualizado en los 7 lugares del sistema donde estaba escrito',
    highlights: [
      'Solo afecta expedientes que NO traigan su propio precio capturado (financials.salePricePerKg) -- los que ya tienen un precio propio guardado no cambian.',
      'Se actualizó en: la configuración por defecto del sistema, el cálculo del Dashboard (kilos pendientes por facturar), Caja Chica, Cobranza (reversiones y confirmaciones de cobro), las 3 impresiones de remisión/pre-factura, y la sincronización de auditoría (AuditSync).',
      'Antes estaba desincronizado en 7 lugares distintos del código -- cambiarlo en Configuración no lo actualizaba en todos, así que un ajuste de precio real como este habría quedado a medias sin revisar el código directamente.'
    ]
  },
  {
    version: 'v7.0.23',
    date: '10 de Agosto de 2026',
    time: '6:40 PM',
    summary: '"Urgencias (Vencido)" mostraba un monto en pesos mayor a cero junto con "0 facturas fuera de fecha" -- las dos mitades del mismo aviso no eran calculadas por la misma vía',
    highlights: [
      'El conteo de facturas vencidas leía la fecha de vencimiento con dueDate?.toMillis?.(), que solo funciona si esa fecha se guardó como Timestamp nativo de Firestore. Cualquier factura con esa fecha guardada en otro formato (ej. datos migrados) se saltaba en silencio del conteo, aunque sí estuviera vencida y sí se sumara al monto en pesos de al lado -- por eso el dinero decía "$296,095.40" y las facturas decían "0" al mismo tiempo.',
      'Ahora usa el mismo parseo tolerante que ya usa el Dashboard del lado del servidor (acepta Timestamp, Date o texto/número).',
      'De paso, el aviso "Tienes X contrarecibos vencidos" en la parte de arriba del Dashboard contaba por EXPEDIENTE (un expediente con varias facturas contaba como 1, aunque tuviera varios contrarecibos vencidos adentro) en vez de por FACTURA, que es lo que dice la propia etiqueta -- ya cuenta igual que el resto de la pantalla.',
      'Vuelve a presionar "🔄 Recalcular Indicadores" después de este despliegue.'
    ]
  },
  {
    version: 'v7.0.22',
    date: '10 de Agosto de 2026',
    time: '6:10 PM',
    summary: 'El Dashboard seguía sin cuadrar con Facturar (1 vs 0) después del fix de la versión anterior -- causa distinta, mismo síntoma',
    highlights: [
      'Después de publicar v7.0.20/21 y presionar "Recalcular Indicadores", el Dashboard bajó de 7 a 1 -- pero la pantalla de Facturar seguía en 0. Faltaba una segunda causa, independiente de la primera.',
      'Al calcular los kilos entregados de un expediente, el Dashboard (función en la nube) solo leía el campo "kilos" total de cada entrega. La pantalla de Facturar (en el navegador) usa una regla más completa: si la entrega tiene su desglose por producto (items), suma eso; si no, usa el campo "kilos". Son dos formulas para el mismo dato.',
      'Cuando una entrega vieja tenía el desglose por producto editado pero el campo "kilos" total sin actualizar, cada lado contaba un número distinto -- exactamente la misma familia de error que "7 vs 0", pero en la lectura de entregas en vez de en la definición de "pendiente".',
      'Ya usan la misma regla en los dos lados. Vuelve a presionar "Recalcular Indicadores" en el Dashboard después de este despliegue.'
    ]
  },
  {
    version: 'v7.0.21',
    date: '10 de Agosto de 2026',
    time: '4:40 PM',
    summary: 'El archivo de despliegue (DESPLEGAR_MEJORAS_2026-08-09_AUTO.bat) ahora hace todo solo, sin necesitar terminal',
    highlights: [
      'El deploy de Functions llevaba dos intentos fallidos seguidos con "Cannot determine backend specification. Timeout" -- normalmente hay que abrir una terminal y correr "npm install -g firebase-tools" a mano.',
      'Ahora el mismo archivo .bat lo hace automáticamente como primer paso, antes de tocar git o Firebase -- solo hay que darle doble clic, no hace falta escribir nada en ninguna terminal.',
      'También se agregó verificación de que Node, npm y git estén instalados antes de empezar, y un reintento automático (con 15s de espera) si el primer intento de publicar Functions falla.',
      'Al final ya no se cierra solo -- muestra un resumen en pantalla (Hosting: publicado/falló, Functions: publicado/falló) y espera a que presiones una tecla.'
    ]
  },
  {
    version: 'v7.0.20',
    date: '10 de Agosto de 2026',
    time: '3:55 PM',
    summary: 'El Dashboard decía "7 órdenes sin facturar" y Órdenes decía "0" -- ambos medían cosas distintas',
    highlights: [
      'El aviso del Dashboard ("Tienes X órdenes con entregas pero sin facturar") contaba expedientes por su estatus interno (sin ninguna factura creada), sin fijarse si de verdad tenían entregas registradas.',
      'El chip "Pendiente de Facturar" de Órdenes cuenta distinto: kilos entregados por encima de lo ya facturado, sin importar el estatus -- la misma fórmula que ya usaba el monto en pesos de al lado en el Dashboard.',
      'Resultado: un expediente "pedido" sin ninguna entrega aún contaba en el aviso aunque no había nada pendiente de verdad; y un expediente con entregas parciales pero ya con alguna factura no contaba, aunque sí le faltaba por facturar.',
      'Ahora ambos usan la misma definición (kilos entregados vs. facturados). Importante: entra al Dashboard y presiona "Recalcular Indicadores" una vez para que el número ya refleje el conteo correcto.'
    ]
  },
  {
    version: 'v7.0.19',
    date: '10 de Agosto de 2026',
    time: '2:10 PM',
    summary: 'Pegar el texto de una Factura decía "agregada" pero no se guardaba',
    highlights: [
      'En Facturas & Contrarecibos, el botón "Pegar Texto (PDF)" mostraba el aviso "Factura agregada" pero en realidad no escribía nada en el expediente -- quedó así desde un refactor anterior que dejó esa conexión sin terminar ("handle it properly later").',
      'De paso, el número de folio se extraía mal: si el PDF traía la línea "FOLIO FISCAL (UUID)", el sistema tomaba literalmente la palabra "FISCAL" como número de factura en vez del folio real (ej. 6098).',
      'Y si la factura tenía más de un renglón en kilos, solo se contaba el primero -- ahora se suman todos.',
      'Ya guarda de verdad (mismo camino que "+ Manual"), extrae el folio real buscando primero el encabezado "Factura ####", y solo confirma éxito cuando el guardado terminó.'
    ]
  },
  {
    version: 'v7.0.18',
    date: '10 de Agosto de 2026',
    time: '12:50 PM',
    summary: 'La Bitácora de Cambios ya refleja las versiones recientes',
    highlights: [
      'De v7.0.10 a v7.0.17 se habían ido subiendo sin anotar aquí qué cambió en cada una -- se repobló la bitácora completa con las 8 versiones faltantes.'
    ]
  },
  {
    version: 'v7.0.17',
    date: '10 de Agosto de 2026',
    time: '12:32 PM',
    summary: 'Corrección crítica: las facturas "En Revisión" ya no desaparecían de los indicadores del Dashboard',
    highlights: [
      'El servidor ponía en CERO todo el expediente (kilos, venta, margen, por cobrar) cuando tenía una factura marcada "Revisión Manual" -- no solo esa factura, el expediente completo.',
      'Por eso "Deuda Total Providencia" nunca coincidía con lo que se lleva a mano en Excel: las facturas en revisión eran invisibles para el sistema aunque son dinero real adeudado.',
      'Corregido y probado con datos reales. Importante: si tu Dashboard todavía se ve desfasado, entra y presiona "Recalcular Estadísticas" una vez.'
    ]
  },
  {
    version: 'v7.0.16',
    date: '10 de Agosto de 2026',
    time: '12:15 PM',
    summary: 'Un error en una pantalla ya no tumba TODO el sistema',
    highlights: [
      'Antes, si algo fallaba en cualquier pantalla, toda la aplicación se caía a "Algo salió mal" -- incluyendo el menú, sin poder navegar a otro lado sin recargar.',
      'Ahora cada sección (Dashboard, Órdenes, Cobranza, Compras, etc.) se aísla: si algo truena ahí, solo esa pantalla se ve afectada.',
      'Blindadas 2 alertas más (Compras y Cobranza) contra fechas mal formadas, mismo tipo de bug que causó el problema de Seguimiento de Pedidos.'
    ]
  },
  {
    version: 'v7.0.15',
    date: '10 de Agosto de 2026',
    time: '11:47 AM',
    summary: 'Ya no se pierden cambios sin guardar por accidente',
    highlights: [
      'Cerrar el expediente con Escape, clic afuera, o "Cancelar" borraba en silencio todo lo capturado (una OC pegada, entregas, precios) si no habías presionado "Guardar cambios".',
      'Ahora, si hay cambios sin guardar, se pregunta antes de cerrar.'
    ]
  },
  {
    version: 'v7.0.14',
    date: '10 de Agosto de 2026',
    time: '11:40 AM',
    summary: 'Vista previa al pegar la OC, guía para tu primer expediente, y aviso de entregas próximas',
    highlights: [
      'Pegar el texto de la OC ya no llena el formulario a ciegas: ahora muestra primero lo detectado (folio, cliente, artículos, kilos) para confirmar o cancelar.',
      'Si la lista de Órdenes está vacía, ahora invita directo a "Subir / Pegar tu primera OC".',
      'Nuevo aviso: si un pedido tiene fecha de entrega en 3 días o menos (o ya vencida) y todavía le faltan kilos por entregar, se avisa en toda la app.'
    ]
  },
  {
    version: 'v7.0.13',
    date: '10 de Agosto de 2026',
    time: '11:29 AM',
    summary: 'Nuevo filtro "Recibidas" y aviso de facturas vencidas visible en cualquier pantalla',
    highlights: [
      'Nuevo chip de filtro "✅ Recibidas" en Órdenes: separa lo que ya está 100% cobrado de lo que solo está "Con el Contador".',
      'Nuevo aviso de facturas recién vencidas, visible al abrir cualquier pantalla -- antes solo se veía si entrabas manualmente a la Bitácora del sistema.'
    ]
  },
  {
    version: 'v7.0.12',
    date: '10 de Agosto de 2026',
    time: '11:22 AM',
    summary: 'Corregida etiqueta confusa: "Cobradas" ahora dice "Con el Contador"',
    highlights: [
      'El chip de filtro en Órdenes decía "Cobradas" para facturas que en realidad todavía no tienen el dinero en caja (están con el contador) -- contradecía la etiqueta de cada fila. Ya dice lo mismo en los dos lugares.'
    ]
  },
  {
    version: 'v7.0.11',
    date: '10 de Agosto de 2026',
    time: '11:14 AM',
    summary: 'Corrección crítica: el autollenado de OC ahora extrae los kilos y artículos reales',
    highlights: [
      'Con una OC real se detectó que "Pegar Texto de OC" subía kilos equivocados (tomaba una medida del producto, como el "120" de "120X125 CM", como si fueran los kilos pedidos).',
      'Reescrito el lector de texto de OC: ahora extrae cada artículo (código, cantidad, descripción, precio) de forma correcta, y los dos botones de "Pegar Texto de OC" usan el mismo lector.'
    ]
  },
  {
    version: 'v7.0.10',
    date: '10 de Agosto de 2026',
    time: '11:00 AM',
    summary: 'Corrección crítica: "Seguimiento de Pedidos" ya no bloqueaba el sistema, y ahora muestra los pedidos desde que se crean',
    highlights: [
      'Abrir "Seguimiento de Pedidos" podía tumbar toda la aplicación si algún expediente tenía una fecha mal formada -- corregido.',
      'Un pedido recién creado (recién pegada la OC, sin factura todavía) no aparecía en Seguimiento hasta la primera factura -- ahora aparece desde el primer momento.'
    ]
  },
  {
    version: 'v7.0.9',
    date: '8 de Agosto de 2026',
    time: '11:55 PM',
    summary: 'Hotfix: Cálculo de Kilos Surtidos',
    highlights: [
      'Corregido el cálculo de Kilos Surtidos en la vista de Por OC para considerar correctamente las cantidades detalladas por producto en las entregas.'
    ]
  },
  {
    version: 'v7.0.7',
    date: '8 de Agosto de 2026',
    time: '11:30 PM',
    summary: 'Fase 7: Omnipresencia, Flujo Rápido y Mejoras en Por OC',
    highlights: [
      'Command Palette Global: Navega a cualquier módulo o busca expedientes y compras al instante presionando Ctrl+K.',
      'Filtros Interactivos: Reemplazados los menús desplegables por "Chips" animados en Expedientes y Compras.',
      'Input Masking: Entradas de dinero con formato automático (CurrencyInput) en Caja Chica y facturas.',
      'Mejoras en Por OC: Rediseño Glassmorphism, métricas claras de faltantes y barra de avance de entregas.',
      'Validaciones Cruzadas: Alerta visual si el precio capturado en un producto difiere del Catálogo Inteligente.'
    ]
  },
  {
    version: 'v7.0.6',
    date: '8 de Agosto de 2026',
    time: '11:00 PM',
    summary: 'Corrección OcTracking y Mejoras en Catálogo',
    highlights: [
      'OcTracking: Cálculos de kilos centralizados usando getOrderSummary.',
      'Catalog: Eliminación de edición onBlur en tarjetas.',
      'Catalog: Implementación de un Drawer dedicado para editar productos.'
    ]
  },
  {
    version: 'v7.0.5',
    date: '8 de Agosto de 2026',
    time: '08:15 PM',
    summary: 'Fase 6 (Inteligencia y Fricción Cero): Tarjetas proactivas, Snack-bar Undo y Tablas de Scroll Infinito.',
    highlights: [
      'Tarjetas Proactivas en Dashboard: Alertas automáticas para cobrar facturas y aprobar entregas excedentes de maquila.',
      'Deshacer (Undo) tipo Snack-bar: Posibilidad de deshacer borrados accidentales en movimientos de Caja Chica mediante un mensaje flotante sin bloquear la UI.',
      'Tablas de Scroll Infinito: La tabla de expedientes ahora carga exponencialmente a medida que haces scroll en vez de saturar la memoria inicial, usando Intersection Observer.'
    ]
  },
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
