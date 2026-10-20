export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.15.4: Factura F-6392, Hojas de Entrega y Programación Textil Hogar',
  date: '19 de Octubre de 2026',
  time: '18:15',
  summary: 'Conciliación fiscal completa de la factura F-6392 ($45,640.20 MXN, 915 kg) bajo la OC 71/14302 (TH Nava), botones directos de Hoja de Entrega / Vale oficial de báscula y programador de fecha para los 2,099 kg restantes.',
  highlights: [
    'Factura F-6392 registrada con UUID oficial, cálculo exacto de comisión de cobranza ($3,147.60 MXN) y maquila Andrés ($33,855.00 MXN).',
    'Generación directa de Hoja de Entrega y Vale oficial de báscula desde las alertas ejecutivas de Textil Hogar y órdenes de compra.',
    'Programador dinámico de fecha para la siguiente entrega de los 2,099 kg faltantes con reflejo en vivo en el expediente.',
    'Suite de 458 pruebas unitarias pasando y build optimizado de producción.'
  ],
};
