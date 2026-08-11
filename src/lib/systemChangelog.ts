export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const SYSTEM_CHANGELOG: SystemRelease[] = [
  {
    version: 'v7.0.34',
    date: '11 de Agosto de 2026',
    time: '11:40 AM',
    summary: '$109,040 de una factura real desaparecían de Cuentas por Cobrar por un estatus corrupto -- y el botón "Guardar Cambios" se quedaba prendido para siempre incluso cuando el guardado sí funcionaba',
    highlights: [
      'La factura #6097 (Contrarecibo TH-879, $109,040.00) tenía un valor de estatus que no coincidía con ninguna de las 5 opciones válidas del sistema -- por eso aparecía agrupada en "Otras" en vez de "Por Cobrar" dentro del expediente, y por eso Cuentas por Cobrar la excluía por completo de su tablero y de su total. El dinero era real y estaba correctamente facturado; solo era invisible para cobranza. Corregido: el total de "Pendientes de Cobro" pasó de $940,130.34 a $1,049,170.34, cuadrando exacto contra el libro de control del usuario.',
      'Al corregir esa factura se descubrió un bug aparte: después de guardar una factura con éxito, el aviso "⚠️ Tienes cambios sin guardar" y el botón "💾 Guardar Cambios" se quedaban visibles para siempre -- el sistema SÍ guardaba, pero la pantalla seguía pidiendo guardar de nuevo. Causa: comparaba el formulario contra la factura recién guardada con JSON.stringify, y el guardado le agrega campos que el formulario nunca tuvo (fecha de actualización, cálculos financieros recalculados), así que nunca volvían a verse "iguales" aunque todo estuviera bien.',
      'Se eliminó también, por confirmado como dato falso (no existía en el libro de control del usuario), un expediente fantasma "TH-713B" de $108,647.46 sin ninguna orden de compra ni cliente capturado detrás.'
    ]
  },
  {
    version: 'v7.0.33',
    date: '11 de Agosto de 2026',
    time: '10:20 AM',
    summary: 'El texto de "Deuda Histórica con Andrés" en Ajustes decía lo contrario de lo que hace la fórmula -- por eso el saldo con Andrés salía volteado (a favor en vez de deuda)',
    highlights: [
      'La fórmula del saldo con Andrés (usada igual en 3 archivos: Compras, Dashboard y Caja Chica) trata "Deuda Histórica" como un ANTICIPO a tu favor cuando es positiva -- lo dice su propio comentario en el código ("Negativo = Deuda, Positivo = Saldo a Favor"). Pero el texto de ayuda junto al campo en Ajustes decía justo lo opuesto: "valores positivos indican que le debes a Andrés". Cualquiera que capturara ese campo siguiendo la instrucción en pantalla iba a terminar con el saldo invertido.',
      'Corregido el texto para que describa lo que la fórmula realmente hace. No se tocó la fórmula ni ningún cálculo -- es un cambio de texto explicativo únicamente.',
      'Pendiente (requiere acción del usuario, no de código): el valor ya capturado en ese campo ($1,227,839.35) se guardó bajo la instrucción incorrecta y por eso el saldo con Andrés en vivo sale "+$39,670.27 a favor" cuando, según el Excel de control, debería ser "-$102,670.27 de deuda". El valor corregido que hay que capturar es $1,085,498.81 -- verificado para que el resultado cuadre exactamente con el Excel.'
    ]
  },
  {
    version: 'v7.0.32',
    date: '11 de Agosto de 2026',
    time: '9:10 AM',
    summary: 'El Dashboard decía "Tienes 1 órdenes con entregas pero sin facturar" sin que ninguna orden real apareciera al dar clic en "Facturar Ahora" -- era un residuo de punto flotante, no una orden perdida',
    highlights: [
      'El contador del servidor sumaba los kilos entregados y los kilos facturados con suma directa de JavaScript, sin redondear -- con varias facturas o entregas de kilos decimales, la resta podía dejar un residuo microscópico (como 0.00000000003) que técnicamente es "mayor que cero" y encendía la alerta, aunque para cualquier propósito real los kilos entregados y facturados fueran idénticos.',
      'El cliente (la pantalla de Órdenes y su chip "Pendiente de Facturar") sí redondea a 2 decimales antes de comparar -- por eso el chip decía (0) mientras el Dashboard insistía en 1, y "Recalcular Indicadores" no lo arreglaba: reutiliza la misma fórmula, así que recalculaba el mismo residuo una y otra vez.',
      'Ahora el servidor redondea los kilos entregados y facturados antes de restarlos, igual que el cliente. Confirmado con tsc y con los 40 tests de fórmulas financieras.'
    ]
  },
  {
    version: 'v7.0.31',
    date: '12 de Agosto de 2026',
    time: '12:40 AM',
    summary: 'El deploy se detenía en "las pruebas fallaron" -- eran 4 pruebas con el precio viejo ($47/kg) hardcodeado, no un error nuevo en los cálculos',
    highlights: [
      'Cuando el precio de venta de respaldo bajó de $47 a $43/kg (v7.0.24), 4 pruebas automáticas se quedaron comparando contra los montos calculados con el precio viejo -- el código calculaba bien con $43, las pruebas comparaban contra $47 y por eso "fallaban".',
      'Actualizados los montos esperados en las pruebas al precio vigente ($43/kg). Confirmado: los 40 tests de fórmulas financieras pasan.',
      'Hallazgo real que sí vale la pena revisar: con el precio de respaldo actual ($43/kg venta, $42/kg costo, 8% de comisión), el margen por kilo sin precio propio capturado queda negativo (-$2.44/kg) -- si algún expediente depende de ese respaldo en vez de tener su propio precio acordado, está perdiendo dinero en la fórmula. No se tocó ningún precio real, solo se documenta para que se revise.'
    ]
  },
  {
    version: 'v7.0.30',
    date: '12 de Agosto de 2026',
    time: '12:10 AM',
    summary: 'DESPLEGAR_ROBUSTO.bat ya no parece congelarse en el paso de dependencias -- sin cambios en la app',
    highlights: [
      'El paso "dependencias y pruebas" hacía una reinstalación completa de node_modules (npm ci, que borra todo y reinstala) dos veces seguidas, sin mostrar nada en pantalla -- en Windows con antivirus eso puede tardar varios minutos en silencio absoluto, indistinguible de estar colgado.',
      'Ahora solo instala dependencias si de verdad faltan (node_modules no existe), muestra un aviso de que puede tardar la primera vez, y va marcando OK en cada sub-paso para que se vea que sigue avanzando.',
      'En despliegues repetidos -- lo normal después del primero -- este paso ahora tarda segundos en vez de minutos.'
    ]
  },
  {
    version: 'v7.0.29',
    date: '11 de Agosto de 2026',
    time: '11:50 PM',
    summary: 'Limpieza de scripts .bat -- sin cambios en la app. Corregido un bug de sintaxis que cerraba DESPLEGAR_ROBUSTO.bat de golpe',
    highlights: [
      'DESPLEGAR_ROBUSTO.bat tenía paréntesis mal escapados dentro de bloques "if" que rompían el interprete de Windows y cerraban la ventana antes de tiempo. Corregido, y además se le sumaron las pruebas automáticas y la instalación exacta de dependencias que ya traía INSTALL_AND_DEPLOY.bat, más la actualización automática de firebase-tools y el registro en DEPLOY_LOG.txt.',
      '6 scripts .bat viejos (versiones de instalador de hace semanas, deploys de una fecha específica ya publicados) quedaron fuera del repositorio -- superados por DESPLEGAR_ROBUSTO.bat. Nuevo LIMPIAR_BATS_VIEJOS.bat para borrarlos del disco con un clic.',
      'CONTROL_MAESTRO.bat ahora manda al script robusto en vez de un "firebase deploy" sin pruebas ni reintentos.'
    ]
  },
  {
    version: 'v7.0.28',
    date: '11 de Agosto de 2026',
    time: '11:20 PM',
    summary: 'Corregido el timeout "Cannot determine backend specification" que tumbaba el deploy de Functions, más un .bat de despliegue más robusto',
    highlights: [
      'La librería de IA (Gemini, para el lector inteligente de documentos) se cargaba completa apenas Firebase revisaba las funciones para publicarlas -- no cuando de verdad se usaba. Esa librería es pesada, y cargarla contaba contra el límite de 10 segundos que usa Firebase en esa revisión, causando el error de timeout visto al desplegar.',
      'Ahora esa librería se carga solo cuando el lector de IA se usa de verdad, no durante la revisión de Firebase.',
      'Nuevo DESPLEGAR_ROBUSTO.bat: verifica la sesión de Firebase antes de empezar, fija el proyecto correcto, amplía el límite de espera de Functions a 60 segundos como respaldo adicional, y reintenta una vez automáticamente si el primer intento de Functions falla.'
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
