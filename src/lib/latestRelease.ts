export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.13: Fase 1 — Code-Splitting Granular & Distribución Inteligente Multipartida en Báscula',
  date: '07 de Octubre de 2026',
  time: '05:25 PM',
  summary: 'v9.10.13: Fase 1 de optimización estructural completada: Code-splitting granular de vendors pesados (PDF, Excel, Firebase, Charts, Motion) eliminando advertencias monolíticas de Vite; algoritmo de auto-distribución proporcional y secuencial por partida en báscula (QuickDeliveryModal) respetando entregas previas y soporte de extracción multipartida en OCR de tickets con control manual interactivo.',
  highlights: [
    '⚡ Code-Splitting Granular de Chunks Vite: Aislamiento modular de bibliotecas pesadas en bundles independientes (firebase-core, firebase-firestore, firebase-storage, motion, excel, pdf, jspdf, pdfjs, tesseract, archive, charts, react-vendor), reduciendo sustancialmente el tiempo de carga inicial y eliminando avisos de bundle monolítico.',
    '📦 Auto-Distribución Multipartida en Báscula: Al registrar entregas físicas de OCs con múltiples renglones (e.g. Providencia EGBO000018, EGBO000094, EGBO000095), el sistema desglosa los kilos automáticamente respetando lo ya entregado y lo pendiente por producto.',
    '✏️ Control Manual Interactivo por Partida: Panel interactivo en QuickDeliveryModal que permite a la operación alternar entre reparto inteligente automático y ajuste manual por renglón con sincronización en tiempo real al total de la remisión.',
    '📸 Ingesta Multipartida por OCR de Tickets: Extracción automática de múltiples renglones con código EGBO y kilos individuales desde tickets escaneados por cámara o subidos como imagen.',
  ],
};



