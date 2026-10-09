export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.24: Búsqueda Rápida Universal Spotlight (Ctrl+K), Protección Activa contra Duplicados en Báscula y Modales Explicativos',
  date: '08 de Octubre de 2026',
  time: '07:05 PM',
  summary: 'v9.10.24: Implementación del Buscador Universal Spotlight (GlobalSearchHost) activo en todo el ERP con Ctrl+K o clic en la barra superior, con indexación instantánea categorizada de OCs, Facturas, UUID SAT de 36 caracteres, Contrarecibos, Remisiones de Báscula, Pagos SPEI bancarios, Catálogo de Productos y comandos del sistema; nuevo motor de protección contra duplicados en autoDocumentPipeline para detectar tickets de báscula y remisiones previas por folio, kilos y fechas; modales interactivos explicativos en lugar de avisos genéricos ante facturas duplicadas en el expediente.',
  highlights: [
    '🔍 Buscador Universal Spotlight (Ctrl+K): Localizador unificado instantáneo en toda la aplicación para encontrar expedientes, números de contrarecibo (TH/GT), facturas CFDI, claves de rastreo bancarias y códigos de producto en milisegundos.',
    '🛡️ Blindaje Antiduplicados en Báscula y Remisiones: Nueva función canónica findExistingDelivery en autoDocumentPipeline que detecta tickets y remisiones ya capturadas, evitando duplicar pesajes y kilos en patio.',
    '⚠️ Modales Explicativos de Factura Repetida: Ante intentos de carga de facturas o XMLs ya existentes, el sistema presenta un modal detallado indicando la orden y cliente donde ya está amparada.',
    '🏁 Cierre Diario y Diferencias 4-Way Matching: Acceso directo y botones dedicados en la barra principal del Dashboard para validación operativa y auditoría cruzada.',
  ],
};
