export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.10: Tarifas Flotantes de Maquila, Precisión Financiera y Simuladores Ágiles',
  date: '07 de Octubre de 2026',
  time: '09:40 AM',
  summary: 'v9.10.10: Soporte nativo para tarifas fluctuantes de maquila con Andrés ($34, $37, $38, $42, $43) reconociendo que los costos cambian por lote y tipo de resina. Enlace dinámico de simuladores a Firestore (useConfig), cálculo exacto de honorarios del contador (8% sobre Subtotal antes de IVA) y selector interactivo de tarifas en el simulador de flujo semanal.',
  highlights: [
    '✨ Tarifas Flotantes de Maquila (Andrés): Eliminación de costos rígidos hardcodeados; simuladores con chips rápidos ($34 maquila base, $37 recuperado, $38 estándar, $42 virgen, $43 pigmentado) y entrada numérica abierta para cualquier precio negociado.',
    '📐 Fuente Única de Verdad (useConfig): La Calculadora Kilos a Pesos ahora toma por defecto los precios reales guardados en Firestore en lugar de valores estáticos.',
    '💰 Corrección de Fórmula Financiera: Comisión del contador calculada estrictamente sobre el Subtotal (8.0% sin IVA), mostrando la Utilidad Operativa Neta real y margen por kilo con alertas visuales de rentabilidad.',
    '🔮 Simulador de Flujo Semanal Dinámico: Selector interactivo de costo de maquila en el CashFlowSimulatorWidget para proyectar en tiempo real cuántas toneladas se pueden fondear ante cualquier precio con Andrés.',
    '📊 Conciliación Oficial OC 12026439784 Activa: 3,350 kg entregados / 1,750 kg faltantes con Factura 6353 y Remisión 6439784 cuadradas al centavo.',
  ],
};


