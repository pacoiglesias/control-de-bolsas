export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.15.5: Pre-facturador CFDI 4.0 Evelia y Conciliación Automatizada',
  date: '19 de Octubre de 2026',
  time: '19:35',
  summary: 'Módulo de Conciliación de Pagos y Contrarrecibos con cuadre de balance financiero en tiempo real, importación inteligente de textos de portal Providencia, liquidación de transferencias bancarias y Pre-facturador CFDI 4.0 configurable y editable para entregas de Evelia (9806 y 9807) y órdenes activas.',
  highlights: [
    'Pre-facturador CFDI 4.0 configurable y editable con soporte para órdenes de Evelia (9806 con 2,478.35 kg y 9807 con 2,955.80 kg) y cualquier orden activa.',
    'Generación oficial de XML CFDI 4.0 borrador (SAT 24111500, KGM, IVA 16%), Excel (.xlsx), PDF y mensaje de WhatsApp para el contador.',
    'Módulo de Conciliación de Pagos y Contrarrecibos con auditoría matemática exacta (Facturado = Cobrado + Saldo Pendiente) y semáforo de cuadre.',
    'Conciliador inteligente por pegado de texto con regex para folios Providencia (GT-XXXX, TH-XXXX y folios 6XXX) y guardado atómico con writeBatch.',
    'Liquidación de pagos y transferencias bancarias en 1 clic con comprobante y actualización inmediata de cartera.'
  ],
};
