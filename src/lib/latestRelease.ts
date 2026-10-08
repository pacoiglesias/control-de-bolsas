export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.16: Extracción Multipartida de Facturas CFDI, Detección Reactiva de Duplicados y Certificación Móvil/Excel',
  date: '08 de Octubre de 2026',
  time: '07:35 AM',
  summary: 'v9.10.16: Suma acumulativa exacta de todas las partidas de facturas CFDI (solución de la discrepancia de 500 kg vs 1,000 kg en Factura 6368 y 1,500 kg en Factura 6363); eliminación definitiva de colisiones entre SUBTOTAL y TOTAL mediante lookbehind negativo; extracción precisa de fecha de emisión fiscal; detección analítica en tiempo real de facturas duplicadas en el inspector de comprobantes; y certificación 100% de la app móvil y respaldos multi-hoja de Excel con 252 pruebas unitarias en 37 suites.',
  highlights: [
    '⚖️ Suma Integral de Partidas CFDI: Motor OCR actualizado para recorrer y sumar el 100% de los renglones de cantidad (KGM) de la factura (ej. 500 kg + 500 kg = 1,000 kg en folio 6368; 1,000 kg + 500 kg = 1,500 kg en folio 6363), respaldado por corroboración matemática contra el subtotal oficial ($43.00/kg).',
    '🎯 Desacoplamiento Estricto de Subtotal y Total: Corrección de colisión donde la etiqueta SUBTOTAL era capturada como TOTAL; ahora el sistema lee independientemente Subtotal ($43,000.00) y Total con IVA 16% ($49,880.00).',
    '📅 Extracción de Fecha de Emisión Fiscal: Lectura directa de fecha timbrada del CFDI (ej. 2026-10-07) evitando defaults involuntarios al día en curso.',
    '🚨 Detección Reactiva de Facturas Duplicadas: El inspector evalúa en tiempo real si el folio o UUID ya existe en cualquier orden de compra del ERP, alertando visualmente al usuario y bloqueando dobles registros involuntarios.',
    '📱 App Móvil & Respaldos Excel Certificados: Validación de navegación PWA móvil (MobileBottomBar con badges dinámicos y modales táctiles bottom-sheet) y respaldos Excel de 5 hojas (.xlsx) con 252 pruebas unitarias aprobadas al 100%.',
  ],
};
