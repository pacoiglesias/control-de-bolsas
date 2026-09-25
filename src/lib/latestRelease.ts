export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.9.0 Enterprise: Drag & Drop Global HUD, Corrección Cierre OC y Semáforo de Cartera Providencia',
  date: '25 de Septiembre de 2026',
  time: '11:00 PM',
  summary: 'Implementación del Drag & Drop Global HUD de pantalla completa con inspección previa por OCR/CFDI antes de impactar Firestore; resolución del error de cierre de OC (eliminando valores undefined en closureAudit.closureNotes); barra visual de Semáforo de Cartera Providencia ($919,116.06); y certificación de 209 pruebas unitarias.',
  highlights: [
    '📥 Drag & Drop Global HUD de Pantalla Completa: Arrastra cualquier archivo (XML CFDI 4.0, PDF de remisión o imagen/foto de báscula) a cualquier parte de la ventana. HUD translúcido con efecto Obsidian Glass, análisis OCR/XML inmediato y confirmación previa obligatoria antes de guardar.',
    '🐛 Corrección de Cierre de OC (undefined closureNotes): Sanitización total en OcClosureModal garantizando que closureNotes, closureReason y montos nunca envíen undefined a Firestore updateDoc(), protegiendo el finiquito de OCs.',
    '🚦 Semáforo Inteligente de Cartera Providencia ($919,116.06 MXN): Barra visual superior con desglose de $723,410.14 corriente, $81,780.00 vencido (CR TH-946) y $113,925.92 en revisión (F-6302 y F-6307).',
    '🔒 Cierre y Finiquito en 1 Clic: Acceso directo desde alertas del dashboard para formalizar el finiquito de la OC 14114 de Nava (88.99 kg saldo de merma acordada).',
    '🧪 209 Pruebas Unitarias Verificadas: Suite de pruebas ejecutada al 100% sin regresiones.',
  ],
};

