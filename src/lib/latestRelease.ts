export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.16.1: Tablero Ejecutivo de Entregas por OC y Control Total de Caja Chica ($451,848.56)',
  date: '27 de Octubre de 2026',
  time: '14:30',
  summary: 'Máxima visibilidad y control total: nuevo Tablero Ejecutivo de Entregas que detalla con precisión quirúrgica qué falta por entregar de las OCs abiertas (1,369.24 kg de Nava 14400, 1,300 kg de Evelia 9834, 21.65 kg de Evelia 9806 y 44.20 kg de Evelia 9807), desglose de partidas por medida, y calibrador automático de Caja Chica garantizando exactamente $451,848.56 MXN.',
  highlights: [
    'Tablero de Control Total: panel interactivo en Dashboard y OcTracking con métricas de kilos pedidos, entregados en báscula, faltantes por surtir y producto en patio pendiente de facturar.',
    'Desglose por partida de qué entregar: tabla desplegable con especificaciones de medida, calibre, pedido y faltante de la OC 71/14400 y OC 43/9834.',
    'Remisión 114400 (6,805.76 kg recibida por Ahmed Flores) registrada como entregada pendiente de facturar amparando $347,366.00 MXN listos para timbrado.',
    'Blindaje y calibración directa de Caja Chica: saldo físico en mano auditado y calibrado a $451,848.56 MXN con ajuste transaccional en un solo clic.',
    'Botones directos de WhatsApp a Andrés para reclamar kilos faltantes por orden con formato formal y desglose de partidas.',
    'Suite de 462 pruebas unitarias pasando al 100% y 0 errores de TypeScript.',
  ],
};

