export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.12: Ergonomía Visual & Operativa, Filtro Departamental TH/GT y Atajos de Báscula',
  date: '07 de Octubre de 2026',
  time: '04:35 PM',
  summary: 'v9.10.12: Optimización integral visual y operativa: Selector rápido de planta (TH · Nava vs GT · Evelia) y acceso directo a las dos OCs flagship activas en Expedientes; botón proactivo de registro de entregas de báscula en filas con kilos pendientes; armonización de badges departamentales con paleta oficial Obsidian Dark; elevación sticky de cabecera de tablas con blur reforzado y badge luminoso en modo discreto.',
  highlights: [
    '🏢 Selector Departamental Rápido (TH / GT): Filtro instantáneo de 1-toque en la pantalla de Expedientes para alternar entre Textil Hogar (Ing. Nava) y Grupo Textil (Lic. Evelia) sin necesidad de búsquedas textuales repetitivas.',
    '🎯 Acceso Directo a OCs Activas Flagship: Pills dedicados para saltar directamente a la OC 12026439784 (GT 43/9784 · 5,100 kg) y OC 120267114302 (TH 71/14302 · 8,000 kg).',
    '🚚 Botón Proactivo [+ Entrega]: Resaltado visual en esmeralda proactivo en la barra de acciones de cada fila cuando restan kilos por surtir, abriendo directamente el capturador de remisiones de báscula.',
    '💎 Estética Obsidian Dark & Sticky Headers: Encabezados de tabla elevados con borde definido y blur de 20px para una lectura nítida durante el desplazamiento vertical, más badge luminoso en el modo discreto.',
  ],
};



