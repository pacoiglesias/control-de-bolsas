export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.6.2 Enterprise: Captura Fluida, Edición In-Situ y Depuración Modular del ERP',
  date: '25 de Septiembre de 2026',
  time: '03:40 PM',
  summary: 'Implementación del plan de optimización de usabilidad ERP: edición directa de Facturas y Contrarecibos en la tabla de pedidos, asistente inteligente de pegado rápido desde WhatsApp/Portal Providencia y reestructuración limpia de la barra de navegación lateral sin duplicidades.',
  highlights: [
    '✏️ Edición Rápida In-Situ (Inline Quick Edit): Asignación y corrección de folios de factura y contrarecibos (CR) con un solo clic y teclado (Enter/Esc) directo en la tabla de seguimiento sin abrir modales pesados.',
    '📋 Pegado Inteligente de CRs (Smart Paste): Parser predictivo de texto copiado desde WhatsApp o apps.mundoprovidencia.com que detecta folios TH/GT, facturas, montos y fechas de vencimiento vinculándolos en 1 clic.',
    '🧭 Navegación Reorganizada y Limpia: Menú lateral simplificado en 3 grupos operativos sin enlaces redundantes ni páginas duplicadas (Configuración centralizada y sin desorden).',
    '🛡️ Integridad Total del Sistema: 204 pruebas unitarias aprobadas al 100% y 7/7 validaciones de auditoría superadas sin fricciones.',
  ],
};
