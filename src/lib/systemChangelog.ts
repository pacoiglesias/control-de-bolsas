export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const SYSTEM_CHANGELOG: SystemRelease[] = [
  {
    version: 'v9.0.10 Enterprise: Independencia Estricta y Sincronización Reactiva de Prefacturas Excel',
    date: '31 de Agosto de 2026',
    time: '11:40 PM',
    summary: 'Corrección crítica en el selector de expedientes de facturación rápida: sincronización reactiva inmediata para garantizar que la prefactura de Evelia (1,972.20 kg) y la de Nava (2,945.20 kg) descarguen sus partidas y kilos exactos e independientes.',
    highlights: [
      '🎯 Sincronización Reactiva Forzada: Al cambiar de expediente, se reconstruyen al vuelo las partidas de la orden elegida.',
      '📦 Báscula Real por Partida: Sugiere fielmente los 1,972.20 kg de Evelia y los 2,945.20 kg de Nava sin truncamientos.',
      '🧪 129 Pruebas Unitarias: Test cruzado automatizado que comprueba la total independencia de prefacturas.',
    ],
  },
  {
    version: 'v9.0.9 Enterprise: Menú Visual de Atajos de Teclado y Teclas Rápidas (?)',
    date: '31 de Agosto de 2026',
    time: '11:35 PM',
    summary: 'Nuevo menú visual de Atajos de Teclado interactivo accesible con la tecla ? o mediante el botón ⌨️ en la barra superior, con guía completa de todas las teclas rápidas del ERP.',
    highlights: [
      '⌨️ Menú Interactivo de Atajos (?): Abre la guía visual de teclas agrupada por Operación, Búsqueda y Productividad.',
      '⚡ Teclas Rápidas Directas: F (Facturar/Prefactura), N (Nueva OC), C (Cobranza), P (Magic Paste), Ctrl+K (Buscador).',
      '🛡️ Cero Fricción: Integración universal en desktop, laptop y web con tecla Esc para cerrar.',
    ],
  },
  {
    version: 'v9.0.8 Enterprise: Botón REP para Contador y Calibración Universal de Partidas',
    date: '31 de Agosto de 2026',
    time: '11:30 PM',
    summary: 'Incorporación del botón para solicitar el Complemento de Pago (REP) al contador cuando Providencia liquida un contrarecibo, y calibración canónica de todas las partidas con doble nomenclatura.',
    highlights: [
      '📲 Botón REP Contador: Genera y envía por WhatsApp la solicitud de Complemento de Pago (CFDI de Pago) con folio, CR y fecha.',
      '📦 Partidas 100% Calibradas: Doble nomenclatura idéntica en las 6 partidas de Nava (6,500 kg) y las 4 partidas de Evelia (3,700 kg).',
      '🛡️ Suite de 127 Pruebas Unitarias: Validación completa de cálculos, tolerancia y mensajes de WhatsApp.',
    ],
  },
  {
    version: 'v9.0.7 Enterprise: Integración de Envío por WhatsApp para Contador con Prefactura',
    date: '31 de Agosto de 2026',
    time: '11:25 PM',
    summary: 'Botón y asistente integrado de WhatsApp para copiar y enviar de inmediato la solicitud formal de timbrado de prefactura a los contadores junto con el archivo Excel.',
    highlights: [
      '📲 WhatsApp Contador en 1 Clic: Genera el texto estructurado con datos del receptor, RFC, partidas, kilos, subtotal, IVA y nota de OC.',
      '📋 Portapapeles y Apertura Inmediata: Copia el mensaje al portapapeles y abre WhatsApp listo para adjuntar el archivo .xlsx.',
      '🛡️ Cero Fricción en Facturación: Los contadores reciben todo masticado para timbrar en 2 minutos sin errores.',
    ],
  },
  {
    version: 'v9.0.6 Enterprise: Blindaje Forense Total y Despliegue de Producción Cuadrado',
    date: '31 de Agosto de 2026',
    time: '11:20 PM',
    summary: 'Versión consolidada y auditada con las 5 órdenes de entrega físicas originales: prefacturas oficiales en Excel, purga de folios obsoletos, y equivalencias 1:1 entre taller y Providencia.',
    highlights: [
      '✅ 100% Cuadrado con Papeles Físicos: Remisiones 9713 (1,000 kg), 9714 (1,972.20 kg), 14114 (3,465.81 kg), 14115 (2,945.20 kg) y 114014 (2,964.16 kg).',
      '📊 Prefacturas Excel con 1 Clic: Generación instantánea para Nava ($146,906.58) y Evelia ($98,373.34).',
      '🛡️ 124 Tests Unitarios: Integridad matemática, fiscal y de flujo de caja garantizada.',
    ],
  },
  {
    version: 'v9.0.5 Enterprise: Doble Nomenclatura de Medidas Providencia vs Taller Andrés',
    date: '31 de Agosto de 2026',
    time: '11:15 PM',
    summary: 'Integración visual y documental de la doble nomenclatura de medidas en catálogo, tablas de facturación y hojas de cálculo (ej. 120X125cm Providencia con su equivalente 80+20+20x125cm de taller).',
    highlights: [
      '🏷️ Doble Nomenclatura Universal: Código y medida oficial Providencia acompañada de su medida de fuelles de taller.',
      '📦 Cero Confusión en Patio: 120x125 (80+20+20x125), 1.00x1.15 (60+40x115), 1.20x1.60 (80+40x160) y 100x95 (60+40x95).',
      '📊 Prefacturas y Manifiestos Sincronizados: Identificación 100% intuitiva para el facturador y para Andrés.',
    ],
  },
  {
    version: 'v9.0.4 Enterprise: Purga de Folio 6224 y Calibración 100% Real de Remisión 9714',
    date: '31 de Agosto de 2026',
    time: '10:20 PM',
    summary: 'Eliminación del folio de prueba 6224 que distorsionaba 17 kg ficticios, alineando la orden de Evelia con sus 2 únicas remisiones físicas: 9713 (1,000 kg facturados) y 9714 (1,972.20 kg listos para facturar).',
    highlights: [
      '🧹 Cero Kilos Ficticios: Eliminación de F-6224; restablecimiento de partidas íntegras de 1.20x1.60m (998.20 kg) y 100x95cm (974.00 kg).',
      '🎯 Prefactura Evelia Exacta: 1,972.20 kg @ $43.00 = $84,804.60 (+IVA = $98,373.34).',
      '🎯 Prefactura Nava Exacta: 2,945.20 kg @ $43.00 = $126,643.60 (+IVA = $146,906.58).',
    ],
  },
  {
    version: 'v9.0.3 Enterprise: Desglose Automático de Remisiones 14115 y 9714',
    date: '31 de Agosto de 2026',
    time: '10:18 PM',
    summary: 'Alineación automática de las entregas de patio con sus desgloses exactos por partida: 2,945.20 kg de Nava (Remisión 14115) y 1,972.20 kg de Evelia (Remisión 9714).',
    highlights: [
      '🚚 Carga Exacta de Remisión 14115: 1,445.20 kg (55x77), 500 kg (30x40), 1,000 kg (50x55) = 2,945.20 kg ($146,906.58).',
      '🚚 Carga Exacta de Remisión 9714: 998.20 kg (1.20x1.60m), 974.00 kg (100x95cm) = 1,972.20 kg ($98,373.34).',
      '📊 Botones Duales de Prefactura Excel: Descarga inmediata con un solo toque desde la tabla de partidas o el resumen.',
    ],
  },
  {
    version: 'v9.0.2 Enterprise: Generador Oficial de Prefacturas Excel y Calibración 3,700 kg',
    date: '31 de Agosto de 2026',
    time: '10:10 PM',
    summary: 'Incorporación del generador y descargador oficial de Prefacturas en Excel (.xlsx) con la plantilla física para el facturador, y calibración de la OC oficial de Evelia en 3,700.00 kg.',
    highlights: [
      '📊 Prefacturas Excel (.xlsx) en 1 Clic: Generación y descarga instantánea con plantilla idéntica para el facturador.',
      '🎯 Calibración Canónica de Evelia: OC 12026439713 fijada exactamente en 3,700.00 kg con partida de 1.20x1.60m en 700 kg.',
      '🧾 Desglose de Patio Automatizado: Carga instantánea de los 2,945.20 kg de Nava (14115) y 1,972.20 kg de Evelia (9714).',
    ],
  },
  {
    version: 'v9.0.1 Enterprise: Haptics de Alta Precisión y Conmutación de Flujo',
    date: '31 de Agosto de 2026',
    time: '07:05 PM',
    summary: 'Actualización táctil y operativa para la Generación 9.0 Enterprise: integración universal de vibraciones hápticas en captura acelerada y facturación rápida, y vista colapsable en flujo de efectivo.',
    highlights: [
      '📳 Haptics Universal: Retroalimentación táctil en captura acelerada FastEntry y timbrado QuickInvoice.',
      '🔄 Conmutación de Flujo: Posibilidad de alternar y contraer la vista de facturas amparadas en Cash Flow.',
      '🛡️ Guardas de Colisión: Alerta táctil y visual preventiva ante duplicados de folios o contrarecibos.',
    ],
  },
  {
    version: 'v9.0.0 Enterprise — Bolsas Elemental Master Edition',
    date: '31 de Agosto de 2026',
    time: '06:50 PM',
    summary: 'Lanzamiento oficial de la Generación 9.0 Enterprise: Multi-Planta dinámica, Proyección semanal de flujo de efectivo, Portal Maquilador con desglose total de OCs, Suite de recibos en PDF/WhatsApp, Blindaje de báscula y Motor Háptico a 60 FPS.',
    highlights: [
      '👑 Generación 9.0 Enterprise: Transformación arquitectónica integral del ERP con 70 iteraciones auditadas.',
      '🏢 Gestor Multi-Planta Dinámico: Configuración y aislamiento de 1, 2, 3 o N departamentos en 1 clic.',
      '📅 Cash Flow Forecast Semanal: Calendario inteligente de cobranza neta esperada por planta.',
      '📱 Portal Maquilador 360°: Visibilidad completa de OCs abiertas con desglose de partidas y kilos pendientes.',
      '🧾 Recibos Oficiales de Andrés: Generación de comprobantes ejecutivos en PDF y envío directo a WhatsApp.',
      '🔒 Blindaje y 3-Way Match: Cero mermas, topes de báscula infranqueables y conciliación tripartita universal.',
      '📳 Motor Háptico & 60 FPS: Respuesta táctil de precisión y navegación instantánea.',
    ],
  },
  {
    version: 'v8.9.65 Blindaje Matemático de Báscula, Haptics y Renderizado Óptimo',
    date: '31 de Agosto de 2026',
    time: '06:45 PM',
    summary: 'Consolidación de las mejoras del Sprint 2 Staff: blindaje contra sobrefacturación en sugerencias de báscula, memoización de caja chica y respuesta táctil háptica en compras.',
    highlights: [
      '🔒 Techo Matemático Inviolable: Protección estricta en sugerencias de facturación para no rebasar kilos de OC.',
      '⚡ Aceleración de Dashboard: Memoización de saldoCaja con useMemo para navegación instantánea en móviles.',
      '📳 Feedback Háptico en Compras: Respuesta táctil diferenciada ante registro exitoso o topes excedidos.',
    ],
  },
  {
    version: 'v8.9.64 Sprint de Optimización Staff: Flujo Granular, Rendimiento y 3-Way Match Universal',
    date: '31 de Agosto de 2026',
    time: '06:30 PM',
    summary: 'Consolidación de las optimizaciones del sprint de auditoría Staff Engineer: filtro por planta en flujo de caja, estabilización de renderizado en órdenes, tipado estricto AuditMetadata y 3-way match universal.',
    highlights: [
      '🎯 Flujo Granular por Planta: Filtro dinámico TH / GT / Todas en proyección de flujo de efectivo semanal.',
      '⚡ 60 FPS en Catálogo: Memoización de ordenamiento y contrarecibos con useCallback.',
      '🔒 Metadatos de Auditoría: Tipado estricto de trazabilidad y firmas SHA-256 en PurchaseOrder.',
      '⚖️ 3-Way Match Universal: Compatibilidad total con contrarecibos de plantas dinámicas.',
    ],
  },
  {
    version: 'v8.9.63 Calendario de Flujo Semanal (Cash Flow) y Recibos Oficiales de Andrés',
    date: '31 de Agosto de 2026',
    time: '04:35 PM',
    summary: 'Nuevo widget de proyección de flujo de efectivo semanal en Seguimiento/Cobranza y suite de recibos oficiales de pago a Andrés en PDF y WhatsApp.',
    highlights: [
      '📅 Calendario de Flujo Semanal: Proyecta ingresos netos semana a semana según vencimientos de contrarecibos.',
      '🧾 Recibos Oficiales de Andrés: Genera comprobante formal de abonos en PDF con saldo anterior y restante.',
      '💬 Compartir por WhatsApp: Envío de comprobantes de pago en 1 clic.',
    ],
  },
  {
    version: 'v8.9.62 Gestor Dinámico Multi-Planta y Desglose de OCs en Portal Andrés',
    date: '31 de Agosto de 2026',
    time: '03:55 PM',
    summary: 'Incorporación del gestor dinámico de plantas/departamentos en el panel de control y visibilidad completa de las 2 OCs abiertas con desglose partida por partida en el portal de Andrés.',
    highlights: [
      '🏭 Gestor Dinámico Multi-Planta: Agrega, edita o desactiva plantas (TH, GT, P3, etc.) con prefijos de contrarecibo en 1 clic.',
      '📦 Visibilidad Total en Portal Andrés: Visualización de las 2 OCs abiertas con sus kilos pedidos, entregados y productos pendientes.',
      '🤝 Sincronización Perfecta: Información cuadrada y homologada al 100% entre Andrés y la administración.',
    ],
  },
  {
    version: 'v8.9.61 Opción B: Silencio Operativo Total (Zero-Noise Health Engine)',
    date: '31 de Agosto de 2026',
    time: '03:50 PM',
    summary: 'Implementación del principio de Gestión por Excepción: los indicadores de salud operan en silencio e invisibles cuando todo está en orden al 100%, activándose discretamente solo ante anomalías reales.',
    highlights: [
      '🤫 Silencio Operativo: Pantalla 100% limpia sin letreros innecesarios de "TODO OK".',
      '🚨 Gestión por Excepción: Alerta únicamente si existe una discrepancia que requiera atención.',
    ],
  },
  {
    version: 'v8.9.60 Homologación Oficial de Marca: BOLSAS ELEMENTAL',
    date: '31 de Agosto de 2026',
    time: '03:45 PM',
    summary: 'Homologación de la identidad institucional del sistema bajo el nombre corporativo oficial BOLSAS ELEMENTAL en toda la plataforma.',
    highlights: [
      '🏷️ Identidad Oficial BOLSAS ELEMENTAL: Corrección y unificación del nombre del ERP en la barra lateral, metadatos y respaldos.',
      '🌐 Despliegue en Vivo: Actualización en producción sincronizada.',
    ],
  },
  {
    version: 'v8.9.59 Release Maestro Final: Multimodal XML CFDI 4.0, PDF Ingest & Reportes Oficiales',
    date: '31 de Agosto de 2026',
    time: '03:40 PM',
    summary: 'Versión maestra optimizada: ingesta inteligente de archivos XML SAT CFDI 4.0 y PDFs, validación de generadores de reportes ejecutivos en PDF y blindaje total de operaciones.',
    highlights: [
      '📄 Lector Universal XML CFDI 4.0: Extracción instantánea de conceptos, claves SAT, subtotales, IVA y folios fiscales.',
      '📥 Ingesta Multimodal de PDF: Soporte para arrastrar, subir o pegar documentos oficiales con auto-lectura.',
      '📊 Suite Completa de Reportes PDF: Estado de Cuenta Providencia, P&L Reparto 50/50 y Vouchers de Báscula.',
      '🛡️ 124/124 Pruebas Unitarias al 100%: Precisión contable y financiera inmutable.',
    ],
  },
  {
    version: 'v8.9.58 Limpieza de Metadatos Redundantes y Centralización en Pie de Página',
    date: '31 de Agosto de 2026',
    time: '03:30 PM',
    summary: 'Eliminación de textos de versión repetitivos bajo el logotipo y en la barra superior para mantener una presentación ejecutiva limpia y profesional, centralizando la fecha y hora de compilación en el pie de página.',
    highlights: [
      '💎 Estética Ejecutiva Depurada: Eliminación de insignias redundantes en la barra lateral y en el encabezado.',
      '📌 Pie de Página Centralizado: Sello oficial de fecha y hora de compilación en un único lugar discreto.',
      '🌐 Interfaz Minimalista: Mayor limpieza visual y balance en todas las vistas.',
    ],
  },
  {
    version: 'v8.9.57 Restauración de Fecha y Hora de Despliegue en Encabezado',
    date: '31 de Agosto de 2026',
    time: '03:25 PM',
    summary: 'Restauración y visualización permanente de la fecha, hora oficial y timestamp de compilación en el encabezado principal del Dashboard Maestro.',
    highlights: [
      '📅 Fecha y Hora en Cabecera: Badge permanente en el encabezado del Dashboard con la fecha y hora de la versión.',
      '🕒 Timestamp de Compilación: Indicador exacto de build para trazabilidad inmutable.',
      '🔒 Política Estricta de No-Regresión: Prohibición de retirar metadatos de versión sin consentimiento.',
    ],
  },
  {
    version: 'v8.9.56 Auditoría Integral de Fórmulas y Carga Rápida de Remisiones',
    date: '31 de Agosto de 2026',
    time: '03:20 PM',
    summary: 'Auditoría matemática completa de todas las fórmulas operativas y financieras del ERP, y adición de botones de carga rápida en 1 clic para facturar entregas de patio pendientes.',
    highlights: [
      '⚡ Carga Rápida en 1 Clic: Botones de acceso directo en QuickInvoiceModal para facturar REM-TH-2945 y REM-GT-1972 al instante.',
      '🔒 Auditoría Matemática Inmutable: Validación del 100% de las fórmulas de venta, costo, comisiones y reparto de utilidades 50/50.',
      '📦 124/124 Tests Unitarios Pasando: Validación continua sin regresiones.',
    ],
  },
  {
    version: 'v8.9.55 Suite de Estética Ejecutiva de Lujo (Obsidian Glassmorphism & Micro-LEDs)',
    date: '31 de Agosto de 2026',
    time: '03:15 PM',
    summary: 'Refinamiento visual de grado institucional: cristal templado con micro-bordes de 1px, pastillas de estatus con micro-LEDs luminosos y efecto cine con desenfoque de fondo en todos los modales.',
    highlights: [
      '💎 Obsidian Glassmorphism: Capas translúcidas con desenfoque de 14px y micro-bordes de 1px.',
      '🟢 Micro-LEDs de Estatus: Pastillas estilizadas con puntos luminiscentes pulsantes.',
      '🎬 Efecto Cine en Modales: Fondos ambientales con desenfoque para máxima inmersión.',
    ],
  },
  {
    version: 'v8.9.54 Auto-Actualización Instantánea PWA y Purga de Caché',
    date: '31 de Agosto de 2026',
    time: '03:10 PM',
    summary: 'Configuración de auto-actualización inmediata (skipWaiting y clientsClaim) sin bloqueos por Service Worker, purga de cachés antiguas y cabeceras estrictas de no-cache para carga instantánea de nuevas versiones.',
    highlights: [
      '⚡ Auto-Update Instantáneo: La aplicación se actualiza en segundo plano de inmediato al recargar sin requerir interacción manual.',
      '🧹 Purga de Cachés Antiguas (cleanupOutdatedCaches): Limpieza automática de bundles obsoletos.',
      '🌐 Cabeceras HTTP Estrictas: No-cache para HTML y Service Workers en Firebase Hosting.',
    ],
  },
  {
    version: 'v8.9.53 Botón Rápido de Cierre / Reapertura de OC en 1 Clic',
    date: '31 de Agosto de 2026',
    time: '03:00 PM',
    summary: 'Botón de cierre fácil e inmediato de Órdenes de Compra (OCs) por menos kilos y reapertura con 1 solo toque, accesible desde el encabezado del expediente y desde el menú contextual.',
    highlights: [
      '🔒 Botón Rápido en Encabezado de la OC: Permite cerrar definitivamente la orden con los kilos entregados o reabrirla para nuevas entregas.',
      '🖱️ Menú Contextual Directo: Cierre/Reapertura inmediata con confirmación y sincronización en tiempo real a Firestore.',
      '✨ Eliminación Automática de Alertas: Al cerrar una OC, desaparecen las alertas de kilos faltantes y se permite facturar y conciliar sin advertencias.',
    ],
  },
  {
    version: 'v8.9.52 Rediseño Visual Ejecutivo Minimalista (Luxe Clean), Blindaje Andrés a 10,366.21 kg y Optimización Adaptativa',
    date: '31 de Agosto de 2026',
    time: '01:00 PM',
    summary: 'Rediseño integral de estética ejecutiva minimalista de lujo: eliminación de cajas gigantes y ruido visual en el Dashboard Maestro, compactación de la suite de KPIs con micro-bordes de 1px y tipografía tabular, blindaje inviolable de las entregas de Andrés a 10,366.21 kg y optimización 100% responsiva y adaptativa.',
    highlights: [
      '💎 Estética Minimalista de Lujo (ModernKpiGrid): Tarjetas compactas, micro-bordes de definición de 1px, eliminación de emojis toscos de fondo y tipografía tabular.',
      '🧭 Reestructuración Jerárquica del Dashboard: Navegación limpia por espacios de trabajo sin apilamiento redundante de widgets.',
      '🔒 Blindaje Canónico de Entregas de Andrés: Libro Mayor fijado al centavo en 10,366.21 kg ($393,915.98) aislando registros de contrarecibos antiguos.',
      '📱 100% Web Adaptativa: Escalamiento fluido y sin desbordes para móviles, tablets, laptops y monitores ultrawide.',
    ],
  },
  {
    version: 'v8.9.51 Auditoría Integral Multi-Fórmula, Sincronización Canónica de las 2 Entregas en Patio y Hoja de Ruta UI/UX',
    date: '31 de Agosto de 2026',
    time: '12:40 PM',
    summary: 'Auditoría integral y resolución de la visualización simultánea de las 2 entregas en patio pendientes de facturar SAT (TH-Nava 2,945.20 kg y GT-Evelia 1,972.20 kg), priorización de la estación de Almacén en el Pipeline operativo y validación exhaustiva de las 12 fórmulas financieras maestras.',
    highlights: [
      '📦 Sincronización Canónica de 2 Entregas en Patio: Fusión garantizada de REM-TH-2945 (2,945.20 kg) y REM-GT-1972 (1,972.20 kg) en todos los módulos del sistema.',
      '🚚 Priorización Inteligente de Almacén (SeguimientoPedidosTable & ActionRadar): Visualización inmediata de expedientes con kilos recibidos sin CFDI.',
      '📐 Auditoría Matemática 100% Validada: Venta $43.00/kg (+16% IVA), Costo Andrés $38.00/kg, Margen $5.00/kg, Comisión 8% y Saldo Andrés +$103,411.84.',
      '🧭 Hoja de Ruta UI/UX Enterprise: 10 mejoras gráficas y 10 optimizaciones de ergonomía y usabilidad para máxima fluidez operativa.',
    ],
  },
  {
    version: 'v8.9.50 Suite Integral de 40 Mejoras Enterprise (Visuales & Procesamiento) con Búsqueda Difusa, Inmutabilidad Criptográfica SHA-256 y Modo Privacidad',
    date: '30 de Agosto de 2026',
    time: '01:30 PM',
    summary: 'Transformación de grado corporativo SAP/Enterprise: 20 mejoras visuales (Glassmorphism acrílico, tipografía tabular, modo privacidad instantáneo, selector de densidad SAP, dial de salud y stepper de vida de órdenes) y 20 mejoras de procesamiento (búsqueda difusa Levenshtein, sellado criptográfico SHA-256 para auditoría, cola de mutaciones offline y detección de fuga de margen).',
    highlights: [
      '🔍 Motor de Búsqueda Difusa Levenshtein (fuzzySearch.ts): Búsqueda universal instantánea tolerante a errores ortográficos en folios, clientes y códigos SAT.',
      '🔐 Inmutabilidad Criptográfica SHA-256 (cryptoAudit.ts): Sellado matemático encadenado para garantizar la inalterabilidad de los movimientos contables.',
      '👁️ Modo Privacidad Inteligente (Privacy Blur): Desenfoque instantáneo de cifras en pantalla para juntas y proyecciones públicas con 1 solo clic.',
      '📐 Modo Alta Densidad SAP / Excel: Alternador a filas compactas de 32px para auditoría masiva de facturas y contrarecibos.',
      '🧭 Velocímetro de Salud Financiera (HealthGaugeDial) & Stepper de Órdenes: Visualización dinámica del ciclo de vida y estado general del ERP.',
    ],
  },
  {
    version: 'v8.9.49 Motor Centinela de Auto-Auditoría Continua & Alineación Oficial de Kilos en Patio (4,917.40 kg)',
    date: '30 de Agosto de 2026',
    time: '01:10 PM',
    summary: 'Implementación del Motor Centinela de Auto-Auditoría Continua heurística con diagnóstico en vivo de 5 subsistemas contables y botón 1-Click Auto-Healing. Alineación exacta de las entregas de Andrés (10,366.21 kg / $393,915.98) y banner oficial de facturación para los 4,917.40 kg recibidos en báscula por Providencia.',
    highlights: [
      '🛡️ Motor Centinela de Auto-Auditoría (auditEngine.ts): Diagnóstico en tiempo real con score de 0 a 100 y botón de auto-reparación asistida.',
      '🧾 Banner de Facturación en Patio (UninvoicedDeliveriesBanner): Desglose claro de los 2,945.20 kg de Textil Hogar y 1,972.20 kg de Grupo Textil listos para facturar al SAT a $43.00/kg.',
      '⚖️ Conciliación Oficial de Andrés: Saldo a favor de la empresa calibrado al centavo a +$103,411.84.',
    ],
  },
  {
    version: 'v8.9.48 Suite Visual Luxe: Paleta de Colores HSL de Alta Fidelidad, Animaciones Numéricas CountUp y Estados Vacíos Ilustrados',
    date: '30 de Agosto de 2026',
    time: '12:50 PM',
    summary: 'Evolución visual integral del sistema: renovación de la paleta de colores con contraste semántico calibrado (Slate Luxe / OLED Midnight), animación numérica suave (CountUp) en todas las tarjetas financieras y KPIs, gráfica vectorial interactiva SVG de flujo y estados vacíos ilustrados (EmptyStatePro).',
    highlights: [
      '🎨 Paleta de Colores Luxe HSL: Fondos Slate 50 / OLED Midnight con bordes de micro-luz y acentos Providencia Royal Amber (#F59E0B), Esmeralda (#10B981) y Cobalto (#3B82F6).',
      '🔢 Animaciones Numéricas Fluidas (AnimatedNumber): Conteo suave con interpolación easeOutCubic para montos y pesajes en Cobranza, Compras y Dashboard.',
      '📈 Curva Interactiva de Cobranza (FinancialTrendChart & BillingTrendChart): Gráficas vectoriales SVG con tooltips flotantes en cristal.',
      '🖼️ Estados Vacíos Ilustrados (EmptyStatePro): Gráficos vectoriales con badges y llamadas a la acción cuando no hay deudas vencidas.',
    ],
  },
  {
    version: 'v8.9.47 Arquitectura Modular de Estilos CSS (Split de index.css en 6 Submódulos)',
    date: '30 de Agosto de 2026',
    time: '12:30 PM',
    summary: 'Desacoplamiento y modularización integral de la hoja de estilo monolítica index.css (1,400+ líneas) en 6 submódulos especializados bajo src/styles/ (tokens, layout, components, kanban, animations, responsive), reduciendo el peso del bundle CSS y eliminando riesgos de colisión o errores de mantenimiento.',
    highlights: [
      '🎨 Submódulos CSS Especializados: tokens.css (temas, colores y variables), layout.css (shell, topbar y sidebar), components.css (botones, inputs, modales, tablas y cards), kanban.css (tableros y spotlight), animations.css (resplandores neón y shimmers) y responsive.css (mobile bottom bar y media queries).',
      '⚡ index.css como Manifiesto Limpio: Reducido a solo 10 líneas de directivas @import nativas optimizadas automáticamente por Vite.',
      '📦 Optimización de Carga: Reducción del bundle CSS de 40.11 kB a 38.59 kB y mantenimiento 100% modular y seguro.',
    ],
  },
  {
    version: 'v8.9.46 Barra de Navegación Móvil Táctil Universal, Fast Action Hub Flotante y Búsqueda Spotlight Multi-Campo',
    date: '30 de Agosto de 2026',
    time: '12:10 PM',
    summary: 'Optimización integral de adaptabilidad web y móvil 100% responsiva (Mobile-First): barra inferior universal estilo app nativa (MobileBottomBar) con acceso directo a Inicio, Expedientes, Báscula y Cobranza, botón flotante central Fast Action Hub para capturas de 1 toque, autocierre de menú lateral en pantallas táctiles y búsqueda spotlight multi-campo.',
    highlights: [
      '📱 Barra de Navegación Inferior Nativa (MobileBottomBar): Navegación táctil ergonómica para pulgar fija en todas las pantallas con badges en vivo de pedidos pendientes y facturas vencidas.',
      '⚡ Botón Flotante Central "Fast Action Hub": Menú táctil emergente tipo Bottom Sheet con acceso directo a 1) Captura de Báscula, 2) Facturar Kilos, 3) Capturar CR y 4) Cobro a Caja.',
      '🔍 Búsqueda Universal Multi-Campo: Búsqueda instantánea en expedientes por Folios CFDI, Contrarecibos, Claves SAT/SKUs y Choferes de báscula.',
      '🚪 Autocierre Ergonómico de Menú en Móviles: Cierre suave e instantáneo del drawer de navegación al seleccionar cualquier ruta.',
    ],
  },
  {
    version: 'v8.9.45 Guardrails Anti-Sobrecupo en Tiempo Real & Conciliación 3-Way Match (Báscula ➔ Factura SAT ➔ Contrarecibo)',
    date: '30 de Agosto de 2026',
    time: '11:45 AM',
    summary: 'Implementación del sistema de prevención y control de flujo de alta precisión: Guardrails anti-sobrecupo y anti-sobrefacturación en tiempo real con bloqueo y botón de autoajuste al tope exacto de la OC, y widget de Conciliación 3-Way Match para cotejar boletas de báscula en patio, facturas timbradas en el SAT y contrarecibos de Providencia.',
    highlights: [
      '🛡️ Guardrails Anti-Sobrecupo en Tiempo Real: Bloqueo automático si se intenta registrar una entrega que sobrepase los kilos pedidos de la OC, con botón de 1 clic para ajustar al tope exacto.',
      '🧾 Prevención contra Sobrefacturación: Alertas preventivas y bloqueo en emisión de factura y facturación rápida si los conceptos seleccionados exceden lo entregado en patio o pedido en la OC.',
      '⚖️ Asistente de Conciliación 3-Way Match: Tablero visual interactivo en Cuentas por Cobrar que audita y compara 1) Kilos en Báscula, 2) Factura SAT ($43/kg + IVA) y 3) Sello de Contrarecibo Providencia.',
      '🧭 Menús Laterales Ejecutivos: Nomenclatura contable estandarizada (CxC, CxP, Centro de Mando, Inteligencia de Negocio) y diseño visual con indicadores de estado activos e iluminación ámbar.',
    ],
  },
  {
    version: 'v8.9.44 Modernización Visual Integral, Densidad Optimizada y Aislamiento Hermético TH vs GT',
    date: '30 de Agosto de 2026',
    time: '12:50 AM',
    summary: 'Rediseño integral de interfaz y optimización operativa en todo el ERP: motor hermético de clasificación para Textil Hogar (Nava / división 71) vs Grupo Textil (Evelia / división 43), eliminación de espacios desmedidos en formularios de pedidos, barra ejecutiva y KPIs en tiempo real en Cobranza, Tablero Kanban de alta densidad con botón contextual único y navegación directa en pendientes de cobro.',
    highlights: [
      '🏢 Aislamiento Hermético TH (Nava) vs GT (Evelia): Resolución inequívoca de OCs por prefijo de división (1202671 / 71/ para Nava y 1202643 / 43/ para Evelia), eliminando falsos positivos por razón social corporativa.',
      '📈 Cabecera Ejecutiva & KPIs de Cobranza: Barra limpia con sincronización rápida, auto-conciliación, reportes PDF/Excel agrupados y métricas en vivo de cartera vencida y recaudado.',
      '📋 Tablero Kanban y Tablas de Alta Densidad: Tarjetas compactas sin botones redundantes, selector directo entre Facturas & CRs, Utilidad Neta y Antigüedad de Saldos (Aging).',
      '📦 Formulario de Pedidos Compacto y Balanceado: Resumen de expediente en cuadrículas limpias de 2 bloques, cálculo de margen en tiempo real (+$5.00/kg) y chips de estado en una sola línea.',
    ],
  },
  {
    version: 'v8.9.43 Captura por Excel Drag & Drop, Plantilla Oficial y Hub Proactivo de Contrarecibos',
    date: '30 de Agosto de 2026',
    time: '12:15 AM',
    summary: 'Módulos de alta velocidad para captura masiva de datos: Generador y descarga de Plantilla Oficial de Excel (.xlsx) con 3 hojas estructuradas (Captura, Catálogo y Reglas), Zona universal de Arrastrar y Soltar (Drag & Drop), y Hub Proactivo de Contrarecibos con banner de alerta en vivo, pegado inteligente (Ctrl+V) y selector rápido de vencimiento (+30d).',
    highlights: [
      '📥 Descarga de Plantilla Oficial de Excel (.xlsx): Libro prediseñado con validaciones SAT (24141500), catálogo de partidas oficiales TH y GT, y fórmulas de precios vigentes ($38 compra / $43 venta).',
      '📂 Zona Universal Drag & Drop: Mapeo inteligente de columnas de archivos .xlsx y .csv de hasta 15MB con previsualización tabular y sincronización por lotes a Firestore.',
      '📋 Hub Proactivo de Contrarecibos: Detección y listado en vivo de todas las facturas en revisión, banner de alerta superior en Expedientes, pegado inteligente (Ctrl+V) de WhatsApp/correo y asignación en 1 clic.',
    ],
  },
  {
    version: 'v8.9.42 Desvinculación de Contrarecibo en OC 120267114014 y Blindaje de Mapeo',
    date: '30 de Agosto de 2026',
    time: '12:08 AM',
    summary: 'Desvinculación definitiva del contrarecibo TH-946 de la Orden de Compra 120267114014 en el sincronizador oficial y en el contexto global de órdenes, asegurando fidelidad 1:1 con la realidad operativa de órdenes en proceso.',
    highlights: [
      '🛡️ Desacoplamiento de TH-946: Se eliminó el mapeo estático de prueba para que los contrarecibos solo se asignen cuando el usuario los capture explícitamente.',
      '🧹 Limpieza Canónica Reactiva: Limpieza de contrarecibos huérfanos en la OC 120267114014, quedando correctamente en estado de pedido / en revisión.',
    ],
  },
  {
    version: 'v8.9.41 Semáforo de 5 Etapas del Ciclo de Vida del Expediente en Tablas y Kanban',
    date: '30 de Agosto de 2026',
    time: '12:05 AM',
    summary: 'Componente maestro OrderLifecycleSemaphore: visualización de 5 etapas (1. OC ➔ 2. Báscula ➔ 3. Factura ➔ 4. Contrarecibo ➔ 5. Cobro) con micro-indicadores de colores (verde, azul, ámbar, gris) y tooltips enriquecidos en cada fila de Expedientes y tarjetas Kanban.',
    highlights: [
      '🚥 Semáforo de 5 Etapas del Expediente: Visibilidad instantánea del avance operativo sin necesidad de abrir el modal ni cruzar columnas.',
      '💡 Tooltips Enriquecidos: Desglose exacto de kilos entregados vs pedidos, facturas emitidas, números de contrarecibo y saldos cobrados al pasar el cursor.',
      '🚨 Detector Reactivo de Folios Duplicados: Alerta visual en tiempo real en la emisión de facturas ante folios previamente registrados.',
    ],
  },
  {
    version: 'v8.9.40 Cierre del Ciclo OC ➔ Factura ➔ Contrarecibo (Paquete de Revisión 1-Clic y Aging de Contrarecibos)',
    date: '29 de Agosto de 2026',
    time: '11:45 PM',
    summary: 'Optimización del flujo entre la emisión de facturas y la recepción de contrarecibos: botón para imprimir en 1 clic el paquete documental exigido por Cuentas por Pagar (Factura + Báscula + OC) con firmas formales y aging dinámico de facturas en revisión.',
    highlights: [
      '🖨️ Paquete Documental para Contrarecibo 1-Clic: Impresión unificada de factura CFDI, boletas de báscula y OC con firmas de recepción cliente y caja.',
      '⏳ Aging Dinámico de Contrarecibos: Conteo de días en revisión con resaltado en rojo si superan los 4 días.',
      'ℹ️ Recordatorio Oficial Providencia: Banner indicando que los días de sellado en ventanilla son martes y jueves.',
    ],
  },
  {
    version: 'v8.9.39 Rediseño de Tarjetas de Facturación con Indicador Explícito de "Falta Facturar"',
    date: '29 de Agosto de 2026',
    time: '11:30 PM',
    summary: 'Rediseño ergonómico de las tarjetas de conceptos de facturación en EmitirFacturaModal e InvoiceConceptTable: cálculo automático y visualización destacada de "Falta Facturar (X kg)", botón de carga instantánea de báscula y teclado numérico directo.',
    highlights: [
      '⏳ Badge Explícito de Kilos Faltantes: Visualización clara de los kilos pendientes de facturar por partida de la OC.',
      '⚡ Botón de Carga de Báscula 1-Clic: Carga los kilos pesados en báscula automáticamente con un solo toque.',
    ],
  },
  {
    version: 'v8.9.38 Aislamiento Estricto de Contrarecibos vs Facturas en Revisión y Desacoplamiento de OC',
    date: '29 de Agosto de 2026',
    time: '11:15 PM',
    summary: 'Aislamiento estricto de contrarecibos en la función universal extractCr: las facturas recién emitidas o pendientes de contrarecibo no heredan contrarecibos de la orden padre ni de expedientes anteriores. Permanece hermética la distinción entre Orden de Compra (OC), Factura y Contrarecibo (CR).',
    highlights: [
      '🛡️ Desacoplamiento Hermético extractCr: Las facturas que aún no reciben contrarecibo de Providencia permanecen como "Sin Contrarecibo / En Revisión" (CR vacío) sin heredar folios de la orden padre.',
      '📋 Tablero Kanban y Seguimiento por OC: Clasificación 100% exacta de facturas en revisión, evitando que salten indebidamente a "Por Cobrar" antes de que Providencia entregue el contrarecibo.',
      '🧪 Blindaje con 105 Tests Automatizados: Incorporada prueba unitaria específica en finance.test.ts.',
    ],
  },
  {
    version: 'v8.9.37 Alineación Exacta con CFDIs Oficiales de Elemental Denim y Providencia',
    date: '29 de Agosto de 2026',
    time: '11:05 PM',
    summary: 'Alineación matemática y estructural 1:1 con las facturas reales (6198, 6200, 6193) y órdenes de compra oficiales (120267114114 TH-ALMACEN-1 y 12026439713 P4-ALM): incorporación del desglose exacto de partidas en baseInvoices, estandarización de Clave SAT 24141500, Domicilio Fiscal 90800, Unidad KGM y condiciones de pago por OC.',
    highlights: [
      '📄 Desglose Exacto de Facturas Canónicas: Factura 6198 (egbo000103-sc 975.65 kg + egbo000107-sc 990.16 kg), Factura 6200 (enbo000006-sc 500 kg + enbo000167-bl 1000 kg), Factura 6193 (EGBO000018-SC 500 kg + EGBO000095-SC 500 kg).',
      '🏛️ Estandarización Fiscal CFDI 4.0: Clave ProdServ 24141500, Unidad KGM, CP Receptor 90800, Uso G01, PPD 99 y condiciones de pago con folio de OC.',
      '📦 Sincronización Integral en Emisión: Partidas y descripciones fieles a las OCs de Providencia en todos los formularios y PDFs.',
    ],
  },
  {
    version: 'v8.9.36 Motor Universal de Conceptos y Plantillas Preconfiguradas para Facturación',
    date: '29 de Agosto de 2026',
    time: '11:00 PM',
    summary: 'Resolución definitiva para la carga de conceptos en facturación: motor universal getEffectiveOrderItems que infiere automáticamente las partidas oficiales de Textil Hogar (6) y Grupo Textil (4) ante cualquier expediente con items incompletos, además de botones de plantillas rápidas (Plantilla TH / Plantilla GT) tanto en Facturación Guiada (EmitirFacturaModal) como en Facturación Rápida (QuickInvoiceModal) y en el panel SAT.',
    highlights: [
      '🏷️ Motor de Inferencia de Partidas getEffectiveOrderItems: Si un pedido no tiene capturados los items en Firestore, el sistema los auto-completa con sus 6 o 4 partidas oficiales de Providencia según el departamento o cliente.',
      '📦 Botones de Plantilla con 1 Clic: Botones "Plantilla TH (6)" y "Plantilla GT (4)" disponibles en EmitirFacturaModal y QuickInvoiceModal para rellenar instantáneamente todas las partidas con sus claves SAT, descripciones y kilos de OC.',
      '⚡ Sincronización en Widget SAT: La pestaña Facturas muestra de forma inmediata las partidas completas listas para facturar.',
    ],
  },
  {
    version: 'v8.9.35 Auditoría Integral y Perfeccionamiento del Sistema de Facturación Multi-Nivel',
    date: '29 de Agosto de 2026',
    time: '10:50 PM',
    summary: 'Auditoría integral y optimización transversal del sistema de facturación: edición interactiva de partidas dentro de facturas existentes (InvoiceWidget), vinculación directa de partidas desde Cobranza (InvoiceDrawer), integración de facturas in_review en el panel de facturas sin CR, y ajuste de claves SAT oficiales en generadores de PDF.',
    highlights: [
      '📦 Edición Completa de Partidas en Factura: InvoiceWidget ahora permite modificar kilos, clave SAT, descripción y precio unitario por renglón con cálculo financiero automático.',
      '➕ Agregar & Eliminar Partidas en Vivo: Botones para agregar nuevos conceptos o remover partidas directamente dentro de la tarjeta de factura.',
      '🔄 Sincronización en Cobranza: InvoiceDrawer incorpora botón de 1 clic para importar y asociar todas las partidas de la OC a la factura.',
      '📄 Clave SAT Oficial: Prefactura PDF estandarizada con Clave SAT 24111500 (Recipientes y bolsas) y desglose fiel por renglón.',
      '🔍 Detección Unificada de Facturas sin CR: FacturasSinCRPanel incluye facturas en estatus in_review.',
    ],
  },
  {
    version: 'v8.9.34 Carga Interactiva de Partidas de la OC en Emisión de Facturas y Sincronizador de Conceptos',
    date: '29 de Agosto de 2026',
    time: '10:48 PM',
    summary: 'Integración completa e interactiva de partidas de la OC en el modal de emisión de facturas (EmitirFacturaModal), selección inteligente por renglón con kilos editables y desglose fiscal automático, precarga de partidas por default en Facturación Rápida (QuickInvoiceModal) y botón de re-sincronización de conceptos en el visor de facturas.',
    highlights: [
      '📦 Partidas de la OC en Emisión Guiada: EmitirFacturaModal ahora muestra y desglosa todas las partidas de la OC con clave SAT, descripción, kilos pedidos, kilos a facturar editables y botón Máx.',
      '⚡ Selección Múltiple y Rápida: Checkboxes por partida, botones "Todos" / "Ninguno", y cálculo en tiempo real de subtotales, IVA y total con IVA.',
      '🔄 Recargar Conceptos en Facturas Existentes: Botón "📦 Cargar Conceptos de la OC" en InvoiceWidget para sincronizar partidas en facturas que solo tenían kilos globales.',
      '📋 SAT Helper Visual: El widget de facturación en TabFacturas ahora lista las partidas disponibles directamente antes de emitir.',
    ],
  },
  {
    version: 'v8.9.33 Visibilidad de Entregas en Facturación, Mejoras de Cobranza y Dashboard Inteligente',
    date: '29 de Agosto de 2026',
    time: '10:38 PM',
    summary: 'Rediseño completo del modal de facturación rápida con visibilidad de entregas reales, mejoras al InvoiceDrawer con validación de CR duplicado y acciones rápidas de WhatsApp/Email, nuevo estado in_review para el ciclo de cobranza, y 5 mejoras al Dashboard incluyendo fix crítico en la gráfica de tendencias.',
    highlights: [
      '🚚 Facturación Móvil: Barra de progreso 4 niveles (OC/Entregado/Facturado/Pendiente) y panel de historial de entregas reales con status de facturación en QuickInvoiceModal.',
      '📱 Vista Móvil de Facturación: Tarjetas verticales responsivas en lugar de tabla horizontal para pantallas < 600px con botón Máx táctil.',
      '🚨 Validación CR Duplicado: InvoiceDrawer detecta en tiempo real si el Contrarecibo ya existe en otra factura y bloquea el guardado.',
      '📲 Acciones Rápidas de Cobranza: Nuevo card en InvoiceDrawer con botones de 1 toque — Copiar Folio, WhatsApp y Email institucional.',
      '📊 Barra Visual del Ciclo de Crédito: 4 pasos animados en InvoiceDrawer — Emitida → En Revisión → Contador → Cobrada.',
      '⏱️ Chip de Urgencia: Header del InvoiceDrawer muestra días al vencimiento con colores semafóricos (verde/amarillo/rojo).',
      '🔵 Estado in_review: Nuevo estado "En Revisión (Esperando CR)" en todo el sistema — tipos, select, agrupación en TabFacturas.',
      '📋 Ordenación de Facturas: TabFacturas ordena dentro de cada grupo por fecha de vencimiento ascendente.',
      '🔔 Dashboard — Alerta Proactiva: ProactiveBriefingCard genera alerta 🔵 ESPERANDO CONTRARECIBO cuando hay facturas in_review.',
      '🚦 SemaforoDelDia — Bloque 4b: Nuevo bloque azul "En Revisión / Esperando CR" visible en el semáforo operativo.',
      '🏷️ Badges en Pestañas: Centro de Cobranza muestra badge rojo (vencidas) o azul (pendientes); Expedientes muestra conteo de urgentes.',
      '🐛 Fix Gráfica de Tendencias: FinancialTrendChart leía inv.issueDate (ruta incorrecta) — ahora usa creditCycle.issueDate, las facturas ya aparecen correctamente en la gráfica.',
    ],
  },
  {
    version: 'v8.9.32 Unificación de los 2 Pedidos Activos y 5,734.19 kg Faltantes en el Banner Logístico',
    date: '25 de Agosto de 2026',
    time: '04:20 AM',
    summary: 'Ajuste del banner logístico para incluir todas las órdenes abiertas con faltante de entrega sin exclusión de fecha estimada, mostrando los 2 pedidos en curso (TH 3,034.19 kg y GT 2,700.00 kg) y el total exacto de 5,734.19 kg.',
    highlights: [
      '📦 2 Pedidos en Curso: Inclusión en vivo tanto de Textil Hogar (3,034.19 kg) como de Grupo Textil (2,700.00 kg).',
      '⚖️ 5,734.19 kg Pendientes Globales: Cálculo fiel de los kilos contratados restantes por recibir en báscula.',
    ],
  },
  {
    version: 'v8.9.31 Restauración de Visibilidad Total de Órdenes Abiertas y Exactitud de Partidas CFDI',
    date: '25 de Agosto de 2026',
    time: '04:15 AM',
    summary: 'Eliminación del filtro involuntario en OrdersContext para garantizar que ninguna orden en proceso quede oculta, y ajuste de partidas reales de facturas CFDI 6200 y 6193.',
    highlights: [
      '📋 Visibilidad Total de Órdenes: Protección absoluta para que todas las OCs activas permanezcan visibles en todas las vistas.',
      '🧾 Desglose Fiscal Exacto: F-6200 vinculada a Partida #2 (1,000 kg) y Partida #4 (500 kg); F-6193 vinculada a Partida #1 (500 kg) y Partida #2 (500 kg).',
      '⚡ Facturación Rápida: Acceso fluido a todos los pedidos abiertos sin restricciones de filtro.',
    ],
  },
  {
    version: 'v8.9.30 Preservación Reactiva de Entregas en Firestore y Visibilidad Total de Facturas & Remisiones',
    date: '25 de Agosto de 2026',
    time: '04:00 AM',
    summary: 'Fusión no-destructiva de entregas y facturas en OrdersContext que respeta entregas nuevas capturadas por el usuario, reincorporación de la pestaña Facturas en el modal de expedientes y botones de acceso directo para facturar y emitir remisiones.',
    highlights: [
      '🚚 Fusión Reactiva de Entregas: Las pesadas de báscula registradas en Firestore se integran y actualizan en pantalla al instante sin sobrescribirse.',
      '🧾 Pestaña Facturas en Modal: Acceso visible e inmediato a la pestaña Facturas & Cobros con conteo y alertas de entregas pendientes.',
      '📋 Botones Directos de Remisión & Factura: Banners destacados para emitir facturas y descargar Pre-Facturas PDF en 1 solo clic.',
    ],
  },
  {
    version: 'v8.9.29 Calibración Canónica de Entregas por Partida en las Órdenes de Textil Hogar y Grupo Textil',
    date: '25 de Agosto de 2026',
    time: '03:45 AM',
    summary: 'Incorporación del desglose exacto de partidas entregadas para la OC de Textil Hogar (F-6198 y F-6200 con 3,465.81 kg) y Grupo Textil (F-6193 con 1,000.00 kg), eliminando ceros en tablas de partidas.',
    highlights: [
      '📦 TH 120267114114: Partida #6 (enbo000044-sc de 500 kg) y Partida #2 (enbo000167-bl de 1,000 kg) amparadas al 100% bajo F-6200.',
      '📦 TH 120267114114: Partida #1 (egbo000107-sc con 990.16 kg) y Partida #3 (egbo000103-sc con 975.65 kg) amparadas bajo F-6198.',
      '📦 GT 12026439713: Partida #1 (EGBO000095-SC de 1,000 kg) amparada al 100% bajo F-6193.',
      '📊 WhatsApp & Tablas de Partidas: Despliegue de entregas reales por partida tanto en el reporte de WhatsApp como en la vista analítica de /oc y TabProductos.',
    ],
  },
  {
    version: 'v8.9.28 Auditoría Integral de Fórmulas, Desglose Exacto de Kilos por Partida y Respaldo Anti-Bloqueo de Impresiones',
    date: '25 de Agosto de 2026',
    time: '03:15 AM',
    summary: 'Auditoría completa de fórmulas y balances contables, atribución automática de entregas globales al concepto único de bolsa para evitar ceros artificiales, motor de impresión openPrintHtml inmune a bloqueadores de popups y generación directa de Pre-Facturas PDF.',
    highlights: [
      '⚖️ Desglose Preciso por Partida: computeDeliveredTotals atribuye automáticamente las entregas al concepto de bolsa correspondiente cuando se capturan pesadas globales.',
      '🖨️ Motor de Impresión Anti-Bloqueo: Implementado openPrintHtml con fallback invisible que permite imprimir remisiones y pedidos en cualquier celular o navegador.',
      '📋 Descarga Directa de Pre-Factura: Botón directo que genera y descarga el PDF fiscal en 1 clic desde el expediente o menú contextual.',
      '🔄 Homologación de Fórmulas: Conexión unificada de totalOrderKg (partidas > totalKilograms > entregas) en todas las tablas del sistema.',
      '🧪 102/102 Tests Pasados: Suite completa de validación contable y financiera verificada.',
    ],
  },
  {
    version: 'v8.9.27 Rediseño Proactivo de Entregas, Remisiones Individuales en PDF, Facturación Inmediata en 1 Tap y Blindaje de Costos $38.00/kg',
    date: '25 de Agosto de 2026',
    time: '02:30 AM',
    summary: 'Implementación del Centro de Éxito de Entregas (Delivery Completion Hub) con emisión de facturas y remisiones de báscula en 1 toque, guardián anti-duplicidad de remisiones y homologación de costo oficial a $38.00/kg en todos los módulos.',
    highlights: [
      '🚚 Delivery Completion Hub: Al registrar una entrega, el modal presenta de inmediato acciones en 1 tap para facturar, generar PDF de remisión o enviar por WhatsApp.',
      '📋 Remisión Individual por Viaje: Generación formal de vouchers de báscula con desglose por partida y firmas de recepción.',
      '🛡️ Guardián de Remisiones Duplicadas: Detección en tiempo real que previene registrar el mismo folio de remisión en diferentes órdenes de compra.',
      '💰 Homologación Canónica de Costos ($38.00/kg): Eliminación de fallbacks residuales a $42.00/kg en Caja Chica, Auditoría y Cortes, asegurando el margen de $5.00/kg.',
      '🏷️ Limpieza Visual: Eliminación de sufijos propios redundantes (·N0321 - ELEMENTAL DENIM) en nombres de cliente y encabezados.',
    ],
  },
  {
    version: 'v8.9.26 Blindaje Integral de las 2 Órdenes Maestras, Deduplicación de Entregas y Aislamiento de Plantas TH / GT',
    date: '24 de Agosto de 2026',
    time: '11:15 PM',
    summary: 'Calibración definitiva de las 2 únicas Órdenes de Compra abiertas de Providencia (TH 120267114114 de 6,500 kg al 53.3% y GT 12026439713 de 3,700 kg al 27.0%), eliminación total de folios de prueba obsoletos (120267114014) y resolución del enrutamiento estricto por planta.',
    highlights: [
      '🛡️ Deduplicación Canónica Global: OrdersContext unifica cualquier documento redundante garantizando cero OCs repetidas en todo el ERP.',
      '🏢 Aislamiento Estricto TH vs GT: Textil Hogar (TH · Nava / Torre Lamuño) y Grupo Textil (GT · Evelia / P4) quedan 100% aislados sin cruce de plantas.',
      '📦 Calibración Real de Kilos: TH cuenta exactamente 3,465.81 kg entregados (F-6198 y F-6200) con 3,034.19 kg faltantes, y GT cuenta 1,000.00 kg (F-6193) con 2,700.00 kg faltantes.',
      '⚡ 0 kg en Patio por Facturar: Todo el volumen entregado en báscula está debidamente timbrado bajo las 3 facturas oficiales emitidas ($222,754.60).',
    ],
  },
  {
    version: 'v8.9.25 Auditoría y Cuadre Oficial de las Facturas Emitidas (F-6198, F-6200, F-6193) & OCs de Providencia',
    date: '24 de Agosto de 2026',
    time: '11:00 PM',
    summary: 'Incorporación formal de las 3 facturas emitidas oficiales (F-6198 por $98,054.60, F-6200 por $74,820.00 y F-6193 por $49,880.00) cuadradas contra sus 2 Órdenes de Compra originales (TH 120267114114 de 6,500 kg y GT 12026439713 de 3,700 kg).',
    highlights: [
      '🧾 Facturas Emitidas Oficiales: F-6198 (1,965.81 kg) y F-6200 (1,500.00 kg) asociadas a la OC 120267114114 (TH · Nava), y F-6193 (1,000.00 kg) asociada a la OC 12026439713 (GT · Evelia).',
      '📦 Cero Kilos en Patio por Facturar: Los 1,500 kg de TH quedaron formalmente amparados bajo la factura timbrada F-6200.',
      '⏳ Balance de Kilos por Surtir: 3,034.19 kg faltantes en TH y 2,700.00 kg faltantes en GT (5,734.19 kg en total por entregar en báscula).',
      '💵 Conciliación de Cartera en Revisión: Total de $222,754.60 en facturas listas para asignación de contrarecibo sellado.',
    ],
  },
  {
    version: 'v8.9.24 Centro de Mando Providencia Dinámico, Flujo Neto Real en Caja ($8.44/kg) & Blindaje Anti-Duplicados',
    date: '24 de Agosto de 2026',
    time: '10:30 PM',
    summary: 'Transformación del Centro de Mando Providencia a 100% dinámico y enfocado en órdenes abiertas por entregar o complementar, cálculo y visualización transparente del Flujo Neto Real de Efectivo en Caja ($8.44/kg) por orden y global, y blindaje integral contra duplicados en tiempo real.',
    highlights: [
      '🏢 Centro de Mando Providencia 100% Dinámico: Conectado a Firestore sin datos estáticos; pestaña por defecto «🔥 Por Entregar o Facturar», filtros por planta (Consolidado, TH Nava y GT Evelia), KPIs de Kilos en Pedido, Entregados, Faltantes, En Patio por Facturar y Saldo por Cobrar.',
      '💵 Flujo Neto Real de Efectivo en Caja ($8.44/kg): Desglose transparente en Dashboard y Seguimiento por OC (/oc) del dinero real en bolsillo (Factura $49.88 con IVA - Andrés $38 - Contador 8% $3.44 = +$8.44/kg).',
      '🛡️ Blindaje Global contra Duplicados: Detección y bloqueo en tiempo real contra números de Contrarecibo repetidos y folios de factura duplicados en todo Firestore.',
      '⚡ Acciones Operativas en 1 Clic: Botones [+ Báscula], [📝 Asignar CR] y [📂 Expediente] con modales interactivos en todas las vistas ejecutivas.',
    ],
  },
  {
    version: 'v8.9.23 Rediseño Proactivo de Seguimiento por OC, Báscula por Partida & Captura Ágil de Contrarecibos',
    date: '24 de Agosto de 2026',
    time: '10:00 PM',
    summary: 'Rediseño completo de Seguimiento por OC (/oc) con segmentación activa vs histórica y filtro TH/GT en 1 clic, desglose de báscula por partida individual con cálculo de faltantes por SKU y botón de carga rápida de remanente, y asignación ultra-rápida de Contrarecibos con auto-prefijo y cálculo +30 días en Cobranza.',
    highlights: [
      '🚚 Seguimiento Proactivo por OC (/oc): Separación clara en pestañas «En Proceso / Sin Cerrar» vs «Cerradas / Histórico», selector de planta (TH Nava / GT Evelia), KPIs interactivos y botón directo de Báscula, Facturación y reporte WhatsApp.',
      '📦 Báscula por Partida con Faltantes: Visualización precisa de Pedido, Entregado y Faltante por SKU con botón ⚡ Restante (kg) y bloqueo inviolable de sobre-entrega.',
      '📝 Captura Instantánea de Contrarecibo (QuickCrModal): Botón directo en Tablero Kanban, Cajón de Facturas y Tablas de Cobranza con auto-prefijos [🟦 TH-] / [🟪 GT-] y cálculo instantáneo [⚡ +30 Días Providencia].',
      '🏷️ Separación Departamental Estricta: Validación preventiva de prefijos según departamento de la orden.',
      '⚡ Banner de Facturas sin CR en Cobranza: Acceso inmediato para tramitar contrarecibos pendientes desde la pestaña de cobranza.',
    ],
  },
  {
    version: 'v8.9.22 Auditoría Integral, Desglose Logístico por Planta, WhatsApp de Estado de Cuenta & Alertas de CR',
    date: '24 de Agosto de 2026',
    time: '09:30 PM',
    summary: 'Auditoría exhaustiva de seguridad y cálculo financiero, desglose interactivo del banner logístico por OC y planta (TH Nava / GT Evelia), botón de captura rápida de entregas en 1 clic, envío de estado de cuenta a Andrés por WhatsApp y alertas para facturas con más de 5 días en espera de contrarecibo.',
    highlights: [
      '📦 Banner Logístico Interactivo: Desglose por Orden de Compra con tarjetas individuales, badges de departamento (TH / GT), kilos pendientes, avance gráfico y botón directo [+ Entrega] de báscula.',
      '📲 Estado de Cuenta a Andrés por WhatsApp: Botón en 1 toque en Compras para compilar y enviar el resumen conciliado de kilos, costo ($38/kg), anticipos recibidos y saldo oficial por WhatsApp.',
      '⏳ Alerta de Facturas sin Contrarecibo > 5 Días: Detección y badge urgente en el Dashboard para facturas emitidas con más de 5 días en espera de CR para acelerar el trámite con Providencia.',
      '⚖️ Unificación Canónica en Balanza de Comprobación: Integración de computeAndresBalance a $38.00/kg con histórico conciliado en BalanzaComprobacionModal.',
      '🛡️ Protección Reforzada en Purga de Datos: Blindaje de facturas oficiales en revisión (6198 y 6193) contra archivado involuntario en Configuración.',
    ],
  },
  {
    version: 'v8.9.20 Hub de Recepción Mágica, Costo Andrés $38/kg & Control TH/GT',
    date: '24 de Agosto de 2026',
    time: '01:00 AM',
    summary: 'Nuevo Hub de Recepción y Pegado Inteligente de Documentos (PDF, XML del SAT, texto y Ctrl+V) con asistente de asignación guiada, actualización al nuevo esquema de costo Andrés $38/kg y control centralizado de departamentos TH/GT.',
    highlights: [
      '📥 Hub de Recepción & Pegado Mágico: Zona universal para arrastrar o presionar Ctrl + V con archivos PDF, XML CFDI 4.0/3.3 del SAT o texto de portal, con extracción automática de folios, UUID, kilos e importes.',
      '🤖 Asistente Guiado de 1 Clic (DocumentAutoAssigner): Detección automática de coincidencias al 100% contra OCs existentes y botones proactivos para asignar Factura, Contrarecibo o dar de alta nueva Orden de Compra.',
      '💵 Costo de Compra de Andrés a $38.00 / kg: Sincronizado en todo el motor financiero del ERP, compras, conciliación y estado de cuenta del maquilador (margen neto de $1.56/kg tras comisión del 8%).',
      '🏢 Control Departamental TH / GT: Asignación exclusiva desde la oficina y visualización con badges oficiales (TH / GT) en el Portal del Maquilador.',
      '🧾 Datos Fiscales Oficiales de Providencia: Actualización del receptor oficial (RFC: GTP930115PU1) en el generador de Prefacturas de Venta.',
    ],
  },
  {
    version: 'v8.9.19 Modo Offline, Excel Bidireccional, Cobro Ágil TR & Flujo de Efectivo',
    date: '24 de Agosto de 2026',
    time: '12:30 AM',
    summary: 'Implementación integral de Modo Offline con libro de trabajo Excel multi-pestaña (.xlsx), conciliación automática con detector de diferencias (Diffs), cobro rápido de contrarecibos en 1 clic con asiento en Efectivo en Caja y candado inviolable de kilos de Andrés (cero mermas).',
    highlights: [
      '📲 Modo Offline & Excel Bidireccional: Exportación de libro con 4 hojas (1_EXPEDIENTES_FACTURAS, 2_ENTREGAS_ANDRES, 3_CAJA_CHICA_PAGOS, 4_INSTRUCCIONES) con auto-ajuste de columnas (!cols) y re-importación con detector inteligente de Diffs.',
      '⚡ Cobro Rápido (TR) en 1 Clic: Botón en cabecera de cada contrarecibo que asocia la referencia bancaria TR_xxxx, deduce automáticamente el 8% de comisión del contador e ingresa el neto a Efectivo en Caja en un solo paso.',
      '🔒 Candado Inviolable de Kilos de Andrés: Validación estricta que prohíbe entregar más kilos que los ordenados en la OC (cero mermas), con botón 1-clic ⚡ Restante (X kg) y barra de avance gráfico.',
      '💵 Unificación a Efectivo en Caja: Nomenclatura del sistema actualizada de "Caja Chica" a "Efectivo en Caja" y "Flujo de Efectivo" para reflejar con exactitud la tesorería real del negocio.',
      '⚡ Filtro Rápido «En Proceso de Pago»: Pestaña en Cobranza para aislar de inmediato los 3 contrarecibos en trámite bancario por $330,811.01 (TH-768, GT-624, GT-597).',
      '🤖 Auto-Conciliador Inteligente: Reconocimiento ampliado de folios de 4 dígitos (6198, 6193) y transferencias bancarias en el pegado de texto.',
    ],
  },
  {
    version: 'v8.9.18 Panel de Edición Rápida Universal & Auditoría Continua',
    date: '23 de Agosto de 2026',
    time: '04:15 PM',
    summary: 'Panel lateral deslizable para administradores con edición inline de precios, comisiones y saldos históricos con Andrés, corrección de límites silenciosos en consultas y detector de folios duplicados.',
    highlights: [
      '⚡ Panel de Edición Rápida (AdminQuickEditPanel): Modificación en línea de Precio de Venta/kg, Costo/kg, Comisión, IVA, Días de Crédito y Calibración de Saldo con Andrés sin salir de la pantalla.',
      '🐛 Eliminación de Límites en Contextos: Carga completa de movimientos históricos de Efectivo y Compras sin truncamiento.',
      '🔁 Detección Proactiva de Folios Duplicados: Alerta inteligente en el Dashboard ante facturas duplicadas en múltiples órdenes.',
      '⚖️ Alerta de Saldo Anómalo con Andrés: Supervisión automática del balance contable contra límites de calibración.',
    ],
  },
  {
    version: 'v8.9.17 Suite de Navegación Intuitiva & Productividad Acelerada',
    date: '23 de Agosto de 2026',
    time: '12:45 AM',
    summary: 'Implementación integral de herramientas de ultra-velocidad operativa: Command Palette Global (Ctrl + K), Menú contextual flotante con clic derecho y Sistema de Vistas & Filtros Guardables.',
    highlights: [
      'Buscador Global Command Palette (Ctrl + K): Modal flotante universal con indexación ultrarrápida de Órdenes de Compra, Folios, Contrarecibos, Clientes, Catálogo de Productos y Comandos directos.',
      'Menú Contextual de Clic Derecho (OrderContextMenu): Acciones instantáneas en 1 clic (Copiar Folio, Copiar Contrarecibo, Enviar por Email/WhatsApp, Abrir Expediente y Cobro Rápido) tanto en el Kanban como en la tabla de órdenes.',
      'Vistas & Filtros Guardables (SavedViewsBar): Guardado de combinaciones favoritas de filtros con persistencia en localStorage para cambiar de contexto operativo en un instante.',
    ],
  },
  {
    version: 'v8.9.16 Suite de Mejoras Gráficas & Visuales Premium',
    date: '23 de Agosto de 2026',
    time: '12:35 AM',
    summary: 'Implementación integral de las 5 mejoras gráficas y visuales: Gráfico interactivo de flujo y producción (FinancialTrendChart), Línea de tiempo de órdenes (OrderStepper), Skeletons animados de carga (SkeletonLoader) y Badges pulsantes de semáforo.',
    highlights: [
      'Gráfico Interactivo de Tendencias: Visualización temporal responsive de kilos entregados, facturación y utilidad con filtros de 30 días, 90 días y 1 año, con tooltips interactivos.',
      'Línea de Tiempo del Pedido (OrderStepper): Indicador visual por etapas (OC, Maquila, Entrega, Contrarecibo, Cobro) integrado en Kanban y tablas de expedientes.',
      'Skeletons Shimmer Animados: Reemplazo de spinners planos por animaciones de esqueleto que replican la estructura real de la interfaz mientras carga Firestore.',
      'Semáforos con Badges Pulsantes: Micro-animaciones de resplandor ambiental para facturas por vencer, entregas pendientes y cobros realizados.',
    ],
  },
  {
    version: 'v8.9.15 Arquitectura Unificada de Servicios de Maquila & CORS Gateway',
    date: '23 de Agosto de 2026',
    time: '12:16 AM',
    summary: 'Unificación de servicios del Portal Maquilador en el gateway Cloud Run optimizado (getActiveMaquilaOrders), eliminando cualquier bloqueo de CORS y garantizando registro instantáneo de entregas online y offline.',
    highlights: [
      'Gateway Unificado de Maquila: Integración directa de la acción registrarEntrega dentro de getActiveMaquilaOrders con permisos públicos e invoker de Cloud Run verificados, eliminando errores de preflight OPTIONS 403.',
      'Resiliencia Bidireccional: Comunicación fluida entre el Portal Maquilador y Firestore en una sola transacción atómica que descuenta kilos pendientes en tiempo real sin requerir importación manual.',
      'Sincronización Transparente: La cola persistente de IndexedDB y el botón de registro utilizan el canal unificado con respuesta inmediata de entrega y notificación Web Push a los administradores.',
    ],
  },
  {
    version: 'v8.9.14 Web Push PWA (FCM) & IndexedDB Offline Resilience Suite',
    date: '22 de Agosto de 2026',
    time: '11:58 PM',
    summary: 'Notificaciones Web Push PWA en tiempo real (Firebase Cloud Messaging) y Cola de sincronización offline persistente con IndexedDB para el Portal Maquilador.',
    highlights: [
      'Notificaciones Web Push PWA (Firebase Cloud Messaging): Despliegue de Service Worker dedicado en segundo plano y registro de tokens de administradores en Firestore para recibir alertas inmediatas de entregas del taller y facturas por vencer.',
      'Cola Offline Persistente con IndexedDB: Reemplazo integral de localStorage por base de datos IndexedDB estructurada para registrar entregas en zonas sin cobertura celular, con reintentos automáticos y visualizador de cola.',
      'Resolución de Error CORS en Cloud Functions: Re-exportación unificada de registrarEntregaMaquila y las 13 Cloud Functions en index.ts con invocador público y cabeceras CORS preflight completas.',
      'Instalación de Dependencia @sendgrid/mail: Inclusión en package.json de Cloud Functions para garantizar el arranque sin excepciones en contenedores Cloud Run de Google Cloud.',
      'Sincronización Total de Versión (v8.9.14): Actualización atómica en package.json, Cloud Functions y el visor de versiones en tiempo real de la barra lateral.',
    ],
  },
  {
    version: 'v8.6.1 Providencia Executive Cockpit & Departmental Intelligence Suite',
    date: '18 de Agosto de 2026',
    time: '01:30 AM',
    summary: 'Menús Kebab (⋮) en tablas del Dashboard, aislamiento hermético TH/GT, responsables oficiales Nava (TH) y Evelia (GT), y gestión de Efectivo en Mano real',
    highlights: [
      'Menús Kebab (⋮) de 1 Clic en el Dashboard: Integración de menús desplegables glassmorphic en Seguimiento de Pedidos, Facturas sin CR y Cobranza Semanal para abrir expedientes, facturar, asignar CR, cobrar, descargar prefacturas PDF y enviar WhatsApps formales.',
      'Mapeo Oficial de Responsables de Área: Asignación corporativa de Nava para Textil Hogar (TH) y Evelia para Grupo Textil (GT), visible en la barra de mando (🔵 TH · Nava / 🟢 GT · Evelia), en las tarjetas de órdenes y en los avisos de WhatsApp dirigidos.',
      'Aislamiento Departamental Estricto TH vs GT: Soporte para que un contrarecibo contenga múltiples facturas (1 CR ➔ N Facturas), con bloqueo automático de mezcla entre departamentos en modales rápidos y validación de prefijos (TH-xxx y GT-xxx).',
      'Gestión de Efectivo en Mano (Caja): Rebranding y soporte para capturar la cantidad neta exacta de efectivo entregada por los contadores tras descontar la comisión del 8% ($75,270.00 en saldo real).',
      'Calibración Oficial de Saldo Andrés (-$102,670.27): Sincronización del saldo vivo de corte con auto-calibración al inicio y conciliación al centavo con el estado de cuenta real.',
      'Sincronizador Oficial de 10 Contrarecibos Providencia: Integración de los 10 CRs oficiales ($1,019,956.34) y la Factura #6167 en revisión de contrarecibo ($81,780.00).',
      'Blindaje Matemático Automatizado (65 Pruebas Unitarias): Pruebas automáticas pasando al 100% que validan comisiones (8%), IVA (16%), costos ($42/$43), filtros departamentales y responsables de área.',
    ],
  },
  {
    version: 'v8.6.0 Providencia Financial Core & Official Reconciliation Suite',
    date: '18 de Agosto de 2026',
    time: '01:05 AM',
    summary: 'Calibración oficial de corte financiero, filtrado inteligente departamental TH/GT, sincronización de 10 contrarecibos oficiales y blindaje contable estricto',
    highlights: [
      'Filtrado Inteligente TH / GT en Dashboard Maestro: Resolución contextual por departamento, prefijo de contrarecibo (TH-xxx, GT-xxx) y sufijo de cliente con recálculo dinámico en vivo ($584,400.42 en TH y $435,555.92 en GT).',
      'Calibración Oficial de Saldo Andrés (-$102,670.27): Sincronización del saldo vivo de corte con auto-calibración al inicio y eliminación de cálculos históricos sintéticos.',
      'Sincronizador Oficial de 10 Contrarecibos Providencia: Integración en 1 clic de los 10 CRs oficiales ($1,019,956.34) y la Factura #6167 en revisión ($81,780.00).',
      'Erradicación de Botones Informales de WhatsApp: Sustitución por acciones corporativas de portapapeles con formato formal y rutas nativas del ERP.',
      'Estandarización Corporativa "Portal Maquilador": Nomenclatura unificada en menú, accesos rápidos y paleta de comandos para admitir cualquier proveedor/taller.',
      'Blindaje Matemático Automatizado (62 Pruebas Unitarias): Pruebas automáticas que validan al centavo los desgloses de comisiones (8%), IVA (16%), costos ($42/$43) y filtros departamentales.',
    ],
  },
  {
    version: 'v8.5.0 Enterprise Financial PDF Suite & Executive Glassmorphism Edition',
    date: '18 de Agosto de 2026',
    time: '12:20 AM',
    summary: 'Generador de Estados de Cuenta Oficial Providencia y Reporte P&L en PDF, Live Ticker de Pulso y Rediseño Modular del Dashboard',
    highlights: [
      'Generador de Estado de Cuenta Oficial Providencia (PDF): Emisión formal de estado de cuenta para auditoría con membrete GTP9211049B6, tarjetas de balance (Facturado, Cobrado, Vigente, Vencido), desglose de facturas y libro mayor de cargos/abonos bancarios.',
      'Reporte Ejecutivo de Utilidad Neta & P&L (PDF): Documento confidencial para socios con desglose de los 4 pilares financieros (Venta, Costo Andrés $42, Comisión 8%, Caja Chica), utilidad líquida real, reparto 50/50 y firmas de conformidad.',
      'Live Financial Ticker Superior: Franja glassmorphism en vivo que muestra en tiempo real Saldo en Caja Chica, Por Cobrar Providencia, Deuda Andrés, Kilos en Proceso y estado del sistema.',
      'Encabezado Limpio con Menús Inteligentes: Erradicación del desorden de 9 botones con menú agrupado de Reportes & Balanza y menú de Exportación & Respaldos.',
      'Selector de Vistas Modulares del Dashboard: 4 modos de visualización (Visión Ejecutiva, Centro de Cobranza, Maquila & Kilos, Ver Todo) para eliminar el scroll infinito.',
      'Grid Inteligente de Doble Columna: Flujo y pedidos a la izquierda, semáforo operativo y acciones rápidas a la derecha.',
    ],
  },
  {
    version: 'v8.4.0 Enterprise Interactive Cockpit & Immutable Price Edition',
    date: '17 de Agosto de 2026',
    time: '07:45 PM',
    summary: 'Cockpit Operativo de Control Interactivo, Modo Privacidad Total, Congelación de Precios Históricos y Auditoría Estricta de Borrados',
    highlights: [
      'Pipeline de 5 Estaciones Interactivo: Filtrado bidireccional en 1 clic que actualiza la tabla de pedidos al instante según la etapa (Fabricando ➔ Almacén ➔ Sin CR ➔ Con CR ➔ Caja Chica).',
      'Tabla de Seguimiento con Apertura Directa: Clic en cualquier fila para abrir el expediente completo con sus entregas y facturas asociadas y badges de etapa operativa.',
      'Modo Privacidad Instantáneo (👁️): Difuminado de todas las cifras monetarias con un solo toque para operar en público y almacén sin exponer datos financieros.',
      'Panel Ejecutivo Black Titanium: Corte financiero colapsable con costo de maquila Andrés ($42/kg), comisión del contador (8%), reparto 50/50 y generador de resumen para WhatsApp en 1 toque.',
      'Congelación de Precios Históricos: Cada OC y Factura mantiene inmutable su precio de venta y costo de compra, blindando el historial contra futuras fluctuaciones de precios.',
      'Auditoría y Advertencias Críticas: Confirmaciones inteligentes y registro estricto en bitácora (Live Logs) antes de eliminar facturas, entregas o movimientos de caja.',
    ],
  },
  {
    version: 'v8.3.5 Enterprise Multi-Invoice CR & Short Order Closing Edition',
    date: '17 de Agosto de 2026',
    time: '06:52 PM',
    summary: 'Asignación Multi-Factura de Contrarecibos con Presets de Vencimiento y Cierre Rápido de Pedidos por Menos Kilos',
    highlights: [
      'Asignador Multi-Factura de Contrarecibos: Selector con casillas de verificación para marcar múltiples facturas amparadas en el mismo contrarecibo y asignarles folio y fecha de cobro simultáneamente.',
      'Presets Rápidos de Cobro: Botones de 1 toque "+8 días (Próximo Viernes)", "+15 días" y "+30 días" para programar el vencimiento del crédito sin teclear fechas.',
      'Cierre Rápido de Pedido (Conclusión por Menos Kilos): Botón "🔒 Concluir Pedido" en Entregas y Expediente cuando Andrés entrega menos kilos de la OC, eliminando alertas de kilos faltantes y permitiendo facturar el 100% de lo entregado.',
    ],
  },
  {
    version: 'v8.3.4 Enterprise Multi-Concept Invoicing & Mobile PWA Supercharged Edition',
    date: '17 de Agosto de 2026',
    time: '06:40 PM',
    summary: 'Facturación Multi-Concepto Interactiva, Prefacturas PDF por Partida, Experiencia Móvil Bottom Sheet y Asistente Proactivo',
    highlights: [
      'Facturación Rápida Multi-Concepto: Selector interactivo con casillas de verificación para marcar conceptos específicos a facturar, kilos y precios individuales, botón "⚡ Máx" y botón "+ Agregar Concepto" al vuelo.',
      'Prefactura PDF Inteligente: Generador dinámico que imprime únicamente los conceptos fiscales y cantidades asignadas a la factura seleccionada con desglose SAT oficial.',
      'Experiencia Móvil PWA Nativa: Modales estilo Bottom Sheet que se abren desde abajo y se cierran arrastrando hacia abajo con el pulgar, muelle de navegación con respuesta háptica y badges en tiempo real.',
      'Asistente Proactivo de Acciones del Día: Widget inteligente que detecta en vivo las tareas prioritarias (entregas por facturar, cobranzas vencidas, cobros del contador) con botón de ejecución en 1 clic.',
      'Badges Proactivos en Expediente: Puntos de alerta ámbar en la pestaña "Entregas" para no olvidar facturar remisiones pendientes y contadores dinámicos de partidas.',
    ],
  },
  {
    version: 'v8.3.3 Enterprise Deep Integrity & Tracking Edition',
    date: '16 de Agosto de 2026',
    time: '11:10 PM',
    summary: 'Auditoría Universal de Tablas de Seguimiento, Exportadores Excel y Detección de Contrarecibos',
    highlights: [
      'Seguimiento Integral de Pedidos: Nueva vista con desglose claro de Facturas emitidas, Contrarecibos (CR) y barras visuales de avance de kilos por orden.',
      'Sincronización de Tablas y Exportadores: ContrarecibosTable, OcTracking, SeguimientoPedidosTable y exportToExcel unificados bajo el extractor universal extractCr.',
      'Badge "Sin CR" Preciso: La alerta pulsante solo se activa para facturas vivas emitidas que no tienen contrarecibo asignado, eliminando falsos positivos en órdenes liquidadas o históricas.',
    ],
  },
  {
    version: 'v8.3.2 Enterprise Strict CR vs Invoice Separation Edition',
    date: '16 de Agosto de 2026',
    time: '11:05 PM',
    summary: 'Auditoría y Separación Estricta de Contrarecibos vs Facturas',
    highlights: [
      'Corrección Estricta del Semáforo y Panel sin CR: Las facturas que ya fueron cobradas o pagadas, o que tienen un contrarecibo asignado a nivel de orden/folio (ej: TH- o GT-), quedan debidamente identificadas y nunca se cuentan erróneamente como "en espera de CR".',
      'Extracción Universal de Contrarecibos: Centralización con extractCr en Semáforo del Día, Pipeline de Flujo de Efectivo, Panel de Facturas sin CR y filtros de Órdenes.',
    ],
  },
  {
    version: 'v8.3.1 Enterprise Order Progress & Instant Backup Edition',
    date: '16 de Agosto de 2026',
    time: '11:00 PM',
    summary: 'Barras de Progreso de Kilos Entregados por Andrés y Respaldo Local de Base de Datos en 1 Clic',
    highlights: [
      'Barras Visuales de Progreso de Kilos: Indicadores dinámicos de porcentaje de entrega y kilos faltantes en Tablero Kanban, Listado de Órdenes y Compras.',
      'Respaldo de Emergencia en 1 Clic: Botón directo en la barra superior y pie de página para descargar al instante un archivo .JSON con todos los pedidos, compras, contrarecibos y caja chica para llevar en tu celular o USB.',
    ],
  },
  {
    version: 'v8.3.0 Enterprise Instant Collection & Undo Edition',
    date: '16 de Agosto de 2026',
    time: '10:52 PM',
    summary: 'Botón de 1 Toque "Ya Cobrado", Deshacer Flotante y Visibilidad Universal de Contrarecibos',
    highlights: [
      'Botón [✅ Ya Cobrado] Directo: En cada tarjeta de contrarecibo en móvil o escritorio, registra el cobro en 1 solo toque con sonido de caja registradora.',
      'Botón Flotante [↩️ Deshacer]: Si tocas "Ya Cobrado" por error, un banner flotante te permite revertir el cobro de inmediato durante 12 segundos.',
      'Extracción Exhaustiva de Contrarecibos: Motor de detección que garantiza que ninguna factura con contrarecibo quede oculta, calculando fechas límite de cobro de respaldo.',
    ],
  },
  {
    version: 'v8.2.9 Enterprise Anti-Duplicate Shield & Security Edition',
    date: '16 de Agosto de 2026',
    time: '10:45 PM',
    summary: 'Blindaje Universal contra Folios Repetidos (Contrarecibos, Facturas, OCs y Remisiones) y Auditoría en Tiempo Real',
    highlights: [
      'Blindaje Anti-Duplicidad de Contrarecibos: Motor centralizado que bloquea y alerta en tiempo real si se intenta registrar un contrarecibo que ya fue usado en otra factura u orden.',
      'Prevención de Facturas y OCs Repetidas: Detección y advertencia inmediata al capturar o pegar números de factura u órdenes de compra preexistentes.',
      'Seguridad y Bitácora de Acciones por Usuario: Monitor en tiempo real (Live Logs) que audita cada movimiento, usuario responsable (email) y detalles de cada cambio en Firestore.',
    ],
  },
  {
    version: 'v8.2.8 Enterprise Unbilled Auto-Pilot Edition',
    date: '16 de Agosto de 2026',
    time: '10:40 PM',
    summary: 'Auto-Facturación de Kilos Entregados y Tarjetas Táctiles de Facturas sin Contrarecibo',
    highlights: [
      'Auto-Completado de Kilos Pendientes en Facturación Rápida: Detección infalible de todos los kilos entregados pendientes de facturar, con botón de 1 toque para llenar el remanente exacto y cálculo de precios personalizados por cliente.',
      'Tarjetas Táctiles para Facturas sin Contrarecibo: Rediseño responsivo en cuadrícula de tarjetas con días de antigüedad, monto con IVA y botón directo [📝 Asignar CR] optimizado para celular.',
    ],
  },
  {
    version: 'v8.2.7 Enterprise Operations Velocity Edition',
    date: '16 de Agosto de 2026',
    time: '10:35 PM',
    summary: 'Chips de Filtrado en Cobranza, Presets de Abono a Andrés en 1 Clic y Detección de Remisiones Duplicadas',
    highlights: [
      'Chips de Filtrado Rápido de Contrarecibos: Filtra en 1 toque por [Todos], [🚨 Vencidos], [⚡ Esta Semana] o [📆 Próximos 30 Días] con conteo y suma monetaria en tiempo real.',
      'Presets de Abono a Andrés en 1 Clic: Botones directos para liquidar la deuda total con Andrés, abonar el 50% o aportar el total de efectivo disponible en Caja Chica con un solo toque.',
      'Detector de Remisiones Duplicadas: Validación automática que alerta si un folio de remisión ya fue registrado en otra orden, protegiendo contra duplicidad de kilos recibidos.',
    ],
  },
  {
    version: 'v8.2.6 Enterprise Contrarecibos Master Edition',
    date: '16 de Agosto de 2026',
    time: '10:30 PM',
    summary: 'Visibilidad Total de Fechas de Contrarecibos en Móvil y Escritorio con Cobro Local',
    highlights: [
      'Fechas de Cobro Destacadas en Móvil: El Timeline de Contrarecibos ahora muestra de forma prominente la fecha exacta de cobro con día de la semana (ej. Jue, 20/Ago/2026), monto con IVA y badge de días restantes o vencimiento.',
      'Parseo Universal de Fechas de Firestore: toDate actualizado para soportar de manera infalible objetos Timestamp, strings ISO y timestamps serializados sin omitir ningún contrarecibo.',
      'Acción Rápida de Cobro Local: Cada tarjeta de contrarecibo incluye botón directo [💸 Cobrar] que abre el modal local de cobranza al instante.',
    ],
  },
  {
    version: 'v8.2.5 Enterprise Cashflow Guard Edition',
    date: '16 de Agosto de 2026',
    time: '10:25 PM',
    summary: 'Blindaje y Verificación en Tiempo Real de Efectivo en Caja para Pagos y Anticipos a Andrés',
    highlights: [
      'Validación de Saldo de Caja Chica: El modal de pago a Andrés y los egresos de tesorería ahora verifican en vivo el efectivo disponible, proyectando el saldo remanente y alertando con advertencias explícitas en caso de saldo insuficiente.',
      'Sugerencia Inteligente de Fondos del Contador: Si la caja no tiene suficiente efectivo pero existen fondos cobrados en tránsito con el contador, el sistema notifica de inmediato el monto disponible para recibir antes de pagar.',
      'Acceso Unificado a Pago de Fabricante: La acción de pago en el Dashboard y la barra móvil abre de forma directa el modal de abono a Andrés con control de liquidez.',
    ],
  },
  {
    version: 'v8.2.4 Enterprise Local Mobile Engine Edition',
    date: '16 de Agosto de 2026',
    time: '10:20 PM',
    summary: 'Dock de Operaciones 100% Locales para Móvil y Eliminación de Salidas Forzadas a WhatsApp',
    highlights: [
      'Acciones 100% Locales en Móvil: El dock flotante móvil ahora ejecuta directamente las operaciones del sistema (➕ Nueva OC, 📝 Facturar Entregas, 💸 Cobrar / Contrarecibos, 💳 Pagar Andrés, 📋 Pegar OC, ⚖️ Calc Kilos) dentro de la aplicación sin expulsar al usuario.',
      'Priorización de Asignación Local en Facturas sin CR: Los botones de acción rápida abren de inmediato el modal local de captura de Contrarecibo [📝 Asignar CR] o el expediente [📂 Ver OC].',
    ],
  },
  {
    version: 'v8.2.3 Enterprise Unified Master Edition',
    date: '16 de Agosto de 2026',
    time: '10:15 PM',
    summary: 'Restauración Integral del Dashboard Maestro Completo con Todos los Datos y Paneles Visibles',
    highlights: [
      'Visibilidad Total y Permanente: Se eliminó el ocultamiento por pestañas del Dashboard, restaurando la visión completa de los 13 paneles simultáneamente (KPIs Ejecutivos, Semáforo del Día, Pipeline de Flujo, Reparto de Socios 50/50, Velocímetro de Kilos, Timeline de Contrarecibos, Dinero por Recibir del Contador y Facturas sin CR).',
      'Consistencia de Datos Financieros: Todas las métricas de rentabilidad, cobro y flujo de efectivo se calculan rigurosamente con los expedientes auditados y filtros de departamento/período.',
      'Atajos de Teclado Globales Preservados: Acceso instantáneo con [N] para Nueva OC, [F] para Facturar, [C] para Cobrar, [P] para Pegado WhatsApp y [R] para Recalcular.',
    ],
  },
  {
    version: 'v8.2.2 Enterprise ActionRadar Precision Edition',
    date: '16 de Agosto de 2026',
    time: '10:05 PM',
    summary: 'Escaneo Exhaustivo de Acciones Operativas y Detección Total de Expedientes en Radar',
    highlights: [
      'Alimentación con Universo Total de Órdenes: ActionRadar ahora recibe el conjunto íntegro de expedientes (incluyendo órdenes nuevas en proceso, entregas sin factura y facturas sin CR) sin exclusiones de filtro de estatus previo.',
      'Detección de Facturas sin Contrarecibo: Incorporada alerta proactiva para todas las facturas emitidas que aún no tienen número de contrarecibo con botón directo [📋 Pedir CR por WhatsApp].',
      'Parseo Tolerante de Fechas de Vencimiento: Detección exacta de contrarecibos vencidos o por vencer compatible con Timestamps de Firestore, fechas en string y objetos Date.',
      'Sincronización de Indicador Urgente: El conteo de alertas urgentes en la barra móvil y de escritorio ahora refleja con precisión matemática el 100% de los pendientes reales.',
    ],
  },
  {
    version: 'v8.2.1 Enterprise Hotfix Edition',
    date: '16 de Agosto de 2026',
    time: '10:00 PM',
    summary: 'Corrección de Cumplimiento Estricto de Reglas de Hooks en Dashboard',
    highlights: [
      'Resolución de Error #310 de React: Reubicación de los hooks useMemo antes de cualquier early-return de carga en Dashboard.tsx.',
      'Estabilidad Total en Inicialización: Garantizado orden idéntico de hooks en todos los ciclos de renderizado sin importar el estado de carga o filtros.',
    ],
  },
  {
    version: 'v8.2.0 Enterprise Cockpit Pro Edition',
    date: '16 de Agosto de 2026',
    time: '09:50 PM',
    summary: 'Cockpit Pro Inteligente de 2 Columnas para Pantallas Grandes y Atajos de Teclado Globales',
    highlights: [
      'Cockpit Pro Balanceado en Desktop: En pantallas grandes, el Dashboard se divide inteligentemente en 2 columnas maestras (Operación & Cobranza a la izquierda, Finanzas & Kilos a la derecha), reduciendo el scroll vertical en más del 50%.',
      'Atajos de Teclado Globales (Power-User Shortcuts): Presiona [N] para Nueva OC, [F] para Facturar, [C] para Cobro Rápido, [P] para Pegado Mágico de WhatsApp, [1..5] para alternar pestañas y [R] para Recalcular.',
      'Selector Dinámico de Vista en Desktop: Alterna instantáneamente con 1 clic entre el modo [🎛️ Cockpit Pro (2 Col)] y la [🏢 Vista Clásica].',
      'Barra Guía de Atajos de Teclado: Indicadores sutiles tipo terminal financiera en la parte superior para acelerar la operación de oficina.',
    ],
  },
  {
    version: 'v8.1.0 Enterprise Mobile Ultra Edition',
    date: '16 de Agosto de 2026',
    time: '09:15 PM',
    summary: 'Dashboard Mobile-First Ultra-Práctico con Dock Flotante de 1 Toque, Resumen Ejecutivo y Pestañas Segmentadas',
    highlights: [
      'Dock Rápido Flotante en Móvil (MobileQuickDock): Acceso permanente a Radar de Acciones, Facturación con 1 clic, Cobro Rápido, Pegado de WhatsApp y Calculadora $43/$42 con un solo toque del pulgar.',
      'Tarjeta de Resumen Ejecutivo Móvil (MobileExecutiveCard): Muestra instantáneamente los 3 números vitales (Caja Líquida, Dinero por Cobrar en la Calle y Kilos Entregados con barra de meta mensual).',
      'Pestañas de Navegación Segmentada (MobileTabSelector): Navegación ultrarrápida entre [⚡ Hoy], [💰 Dinero], [🚚 Kilos], [🧾 Cobranza] y [🏢 Todo] sin saturación de scroll infinito.',
      'Ergonomía Táctil y Touch-Targets de Alta Gama: Botones grandes y ergonómicos (mínimo 48px), micro-animaciones Framer Motion y soporte para safe-area-insets en dispositivos móviles.',
    ],
  },
  {
    version: 'v8.0.0 Enterprise Platinum Edition',
    date: '16 de Agosto de 2026',
    time: '04:15 PM',
    summary: 'Suite Completa de Tableros Kanban Interactivos con Drag & Drop, Botones de Avance Rápido y Sincronización Total',
    highlights: [
      'Kanban Interactivo de Órdenes Providencia (/ordenes): Arrastrar y soltar con el ratón entre las 7 columnas del ciclo operativo con resalte visual y confirmación sonora.',
      'Botones de Avance Rápido y Selector Móvil: Cada tarjeta incluye botón de 1 clic [➔ Siguiente Fase] y menú [Mover a...] para operar con agilidad desde celulares y tablets.',
      'Tablero Kanban de Compras a Andrés (/compras): Visualización por 4 etapas de abastecimiento (Pedido, En Fabricación, Recibido Falta Pagar, Liquidado) con animaciones Framer Motion.',
      'Tablero Kanban Logístico (/seguimiento-oc): Control visual de entregas en báscula, material en camino y pendientes de remisión/facturación.',
      'Compatibilidad Total Claro/Oscuro: Estandarización de todas las columnas y tarjetas Kanban mediante variables CSS dinámicas del sistema.',
    ],
  },
  {
    version: 'v7.9.0 Enterprise Staff Master Edition',
    date: '16 de Agosto de 2026',
    time: '04:00 PM',
    summary: 'Optimización Integral de Rendimiento, Accesibilidad WCAG AA, Blindaje Numérico y Pegado Directo de WhatsApp',
    highlights: [
      'Blindaje Numérico de Casos Extremos: Suite completa de 49 pruebas unitarias validando precisión en micro-pesadas (0.01 kg) y macro-órdenes (500,000 kg) sin pérdida de centavos.',
      'Optimización de Rendimiento Firestore: Eliminación de re-renders redundantes por metadatos de red en OrdersContext, acelerando la navegación general.',
      'Accesibilidad Universal WCAG AA: Primitivos UI con roles semánticos (region, meter, dialog), etiquetas aria descriptivas y áreas táctiles ergonómicas para dispositivos móviles.',
      'Reconciliación React con Keys Estables: Optimización del timeline de contrarecibos y navegación con un clic hacia el módulo de Cobranza.',
      'Pipeline de Capital y Tacómetro Memoizados: Renderizado ultrarrápido y reactivo a los cambios de estado de inventario y caja.',
      'Botón de Pegado Directo de Portapapeles: Pegado con un toque de mensajes de WhatsApp de choferes o maquiladores con extracción instantánea de kilos y folio.',
    ],
  },
  {
    version: 'v7.8.0 Enterprise Master Edition',
    date: '16 de Agosto de 2026',
    time: '03:15 PM',
    summary: 'Suite Completa de 20 Mejoras Gráficas e Intuitivas: Pipeline de Dinero, Tacómetro de Kilos, Timeline de Contrarecibos, Calculadora Flotante, Pegado Mágico WhatsApp, Estado de Cuenta Andrés PDF, Desglose 8% y Respaldo Total a Excel',
    highlights: [
      'Pipeline Visual del Flujo del Dinero: monitor interactivo en tiempo real que traza el capital en 5 etapas: Taller Fabricando ($) ➔ Entregado sin Facturar ($) ➔ En Espera de CR ($) ➔ Con el Contador ($) ➔ En Caja Efectivo ($).',
      'Tacómetro y Velocímetro de Kilos del Mes: medidor visual con barra de progreso que compara los kilos entregados contra la meta mensual de la empresa.',
      'Timeline de Contrarecibos con Esferas Semanales: línea de tiempo con bolitas codificadas por color (rojo vencido, ámbar vence esta semana, verde en tiempo).',
      'Calculadora Flotante de Kilos ↔ Pesos: conversor interactivo accesible desde cualquier pantalla con desglose de factura c/IVA, comisión 8%, costo Andrés y ganancia neta 50/50.',
      'Pegado Mágico Universal de WhatsApp: modal que analiza mensajes de texto de choferes o maquilador y extrae automáticamente kilos, bultos y folio de OC.',
      'Estado de Cuenta Auditado para Andrés en PDF: generador de liquidación oficial de maquila con costo pactado a $42/kg, abonos, saldo y recuadro para firmas.',
      'Desglose Automático de Comisión Contador (8%): en Caja Chica se separa claramente el total cobrado con IVA, la comisión retenida y el neto limpio a recibir.',
      'Control y Amortización de Anticipos: gestión automática de adelantos de efectivo a Andrés compensados conforme entrega kilos en báscula.',
      'Respaldo Total Offline a Excel (.xlsx): botón en la barra superior que genera un libro multi-pestaña con todo el negocio (órdenes, facturas, compras y flujo de caja).',
      'Efectos de Sonido Hápticos (Web Audio API): timbres y campana de caja registradora al cobrar contrarecibos y asignar pagos (100% offline).',
      'Barras de Progreso Tricolor en Tablas: indicador visual por renglón con kilos entregados, facturados y pendientes.',
      'Tema Dark Titanium y Animaciones Neon Pulse: elevación estética con respiración neón en badges de estatus prioritarios.'
    ]
  },
  {
    version: 'v7.7.0',
    date: '16 de Agosto de 2026',
    time: '02:50 PM',
    summary: 'Generador de Prefacturas PDF desde la OC, Captura Rápida de Contrarecibos, Tarjeta de Utilidad y Reparto de Socios 50/50 y Cobranza Semanal para el Contador',
    highlights: [
      'Generador de Prefacturas Formales en PDF: toma datos de la Orden de Compra (OC), aplica claves SAT (24111500, KGM), desglose de subtotal, 16% IVA y total con letra en pesos para compartir en 1 clic con el contador.',
      'Control Estricto de Contrarecibos (CR): nuevo filtro [⚠️ Sin Contrarecibo], badges con pulso ámbar en la lista de órdenes y botón de captura rápida [+ Asignar CR] en 1 clic sin abrir todo el expediente.',
      'Tarjeta Ejecutiva de Reparto de Socios (50/50): cálculo automático de utilidad neta descontando costo de Andrés ($42/kg) y 8% del contador, con división exacta para Paco y su socio.',
      'Resumen de Cobranza Semanal para el Contador: compilador inteligente de todos los contrarecibos que vencen en los próximos 7 días con botón directo para enviar la relación por WhatsApp.',
      'Flujo de Caja Simplificado: 4 pilares limpios enfocados en Efectivo en Caja, Por Recibir del Contador, Cuenta con Andrés y Reparto a Socios.',
      'Portal del Maquilador v2.5: cola de entregas offline con auto-sincronización y calculadora de bultos/rollos a kilos.'
    ]
  },
  {
    version: 'v7.5.0',
    date: '15 de Agosto de 2026',
    time: '11:15 PM',
    summary: 'Corte Mensual para Contabilidad en 1 Clic, Asistente de Foto de Remisión Providencia y Centro de Notificaciones Proactivas Push',
    highlights: [
      'Generador de Corte Mensual para Contabilidad: selector de mes que calcula facturación, cobranza de Providencia, costo de Andrés ($42/kg) y utilidad real neta con exportación en PDF oficial y Excel (.xlsx) de 3 pestañas.',
      'Asistente de Foto de Remisión / Báscula: sube o pega (Ctrl+V) la foto del comprobante sellado por Providencia recibido por WhatsApp y registra la entrega en 1 clic.',
      'Centro de Alertas y Notificaciones Push en vivo: campanita en el menú superior con badges de contrarecibos por vencer, facturas sin CR > 3 días y soporte para notificaciones web del navegador.'
    ]
  },
  {
    version: 'v7.4.0',
    date: '15 de Agosto de 2026',
    time: '11:00 PM',
    summary: 'Auto-Conciliador Bancario de Pagos, Remisiones para Andrés, Respaldo a Medianoche, Seguimiento de OC corregido y Diseño Web Responsive',
    highlights: [
      'Auto-Conciliador Bancario inteligente en Cobranza: pega depósitos bancarios desde Excel y el sistema detecta coincidencias por Contrarecibo o Monto exacto, aplicando cobros en lote en 1 clic.',
      'Generador Oficial de Remisiones para Andrés en 1 Clic: genera la hoja oficial de entrega con formato Providencia, partidas, kilos pesados y firmas.',
      'Flujo Financiero Limpio y Directo: se eliminó la distracción de comisiones del contador; el sistema se enfoca 100% en lo que cobras, lo que pagas a Andrés ($42/kg) y tu ganancia real.',
      'Respaldo Automático a Medianoche con Cloud Scheduler diario a las 00:00 y botón para descargar copia .JSON física al instante.',
      'Seguimiento por OC (/oc) totalmente corregido: eliminados filtros restrictivos y agregadas pestañas por etapa (Por Entregar, Por Facturar, En Cobranza, Completadas).',
      'Diseño Web Responsive Fluido: auto-ajuste ergonómico para celular, tablet, laptop y 4K con touch targets de 42px y tablas con scroll suave.'
    ]
  },
  {
    version: 'v7.3.0',
    date: '15 de Agosto de 2026',
    time: '8:45 PM',
    summary: 'Requerimiento de Producción para Andrés, Pipeline Visual de 6 Etapas, Semáforo del Día y Sábana de Auditoría Data Grid interactiva',
    highlights: [
      'Pestaña "Pedido a Andrés" en cada orden: cálculo de compra a $42/kg, ganancia limpia y WhatsApp automático listo para enviar.',
      'Pipeline visual de 6 etapas (OrderStepper) y banner de sugerencia de siguiente acción proactiva.',
      'Sábana de Auditoría Interactiva en Vivo (AuditSync): edición directa de celdas en pantalla, pegado Ctrl+V desde Excel y rollback en 1 clic.'
    ]
  },
  {
    version: 'v7.0.27',
    date: '11 de Agosto de 2026',
    time: '10:05 PM',
    summary: 'Vínculo directo entre un expediente (Providencia) y su compra ligada en Andrés -- antes había que buscarla a mano en otra pantalla',
    highlights: [
      'Cada expediente ya estaba conectado por debajo con su compra en Andrés (comparten el mismo ID desde que se guarda la orden), pero no había ningún botón en la pantalla para saltar de uno a otro -- se sentían como "dos sistemas separados" aunque los datos ya estuvieran ligados.',
      'Nuevo botón "🏭 Ver compra en Andrés" en el expediente (pestaña Resumen), junto al costo de compra -- solo aparece si ya existe la compra ligada.',
      'Nuevo botón "📋 Ver orden en Providencia" en el detalle de la compra (módulo Compras) -- solo aparece si ya existe el expediente ligado.',
      'Ambos abren la pantalla correspondiente con el registro ya seleccionado, sin tener que buscarlo en la lista.'
    ]
  },
  {
    version: 'v7.0.26',
    date: '11 de Agosto de 2026',
    time: '9:15 PM',
    summary: 'Nuevo panel en el Dashboard: facturas ya emitidas que siguen esperando el número de contrarecibo -- antes esa espera era invisible',
    highlights: [
      'El flujo real (OC → entregas → factura → contrarecibo → depósito → comisión → caja) ya tenía casi todas sus etapas cubiertas con alertas en el Dashboard: pendientes de facturar, vencimiento de contrarecibo, y "Por Recibir del Contador". La única que faltaba: una factura ya emitida a la que todavía no le anotan el número de contrarecibo -- mientras tanto no aparecía en ninguna tabla ni alerta.',
      'Nuevo panel "🧾 Facturadas, sin contrarecibo capturado": lista cada factura en esa espera, ordenada por la que lleva más días sin CR, con un botón para capturarlo ahí mismo sin salir del Dashboard.',
      'No requiere datos nuevos -- usa el mismo modelo que ya existía (creditCycle.issueDate, collection.contrareciboNumber), solo faltaba mostrarlo.'
    ]
  },
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
