export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.17: Conciliación Integral de Facturas TH (OC 120267114302), Asignación Canónica Inequívoca y Alertas Dinámicas',
  date: '08 de Octubre de 2026',
  time: '10:25 AM',
  summary: 'v9.10.17: Conciliación oficial de las 3 facturas CFDI amparadas en la orden de Textil Hogar (OC 120267114302 · José Nava): F-6307 (1,986 kg), F-6334 (1,500 kg) y F-6363 (1,500 kg) para un total facturado de 4,986.00 kg ($248,701.68 con IVA) y 3,014.00 kg pendientes por surtir; dinamización 100% reactiva de la tarjeta de alertas prioritarias de Nava en el Dashboard (eliminación de textos fijos); erradicación de asignaciones silenciosas por omisión en el inspector de comprobantes con banner interactivo de confirmación en caso de duda.',
  highlights: [
    '🏢 Conciliación Oficial TH 120267114302: Registro exacto de las 3 facturas fiscales (F-6307 por 1,986 kg, F-6334 por 1,500 kg y F-6363 por 1,500 kg), acumulando 4,986.00 kg timbrados (62% de la meta de 8,000 kg) y $248,701.68 MXN amparados.',
    '📊 Tarjeta de Dashboard 100% Dinámica: Erradicación del texto estático F-6307 en ExecutivePriorityAlerts; ahora calcula en tiempo real folios timbrados, kilos facturados, montos con IVA, porcentaje de avance y kilos faltantes por maquilar con Andrés (3,014 kg).',
    '🎯 Asignación Inequívoca de OC al Subir Facturas: Motor OCR ampliado para leer con máxima precisión el campo CONDICIONES DE PAGO y patrones canónicos 120267114302 (TH) y 12026439784 (GT).',
    '⚠️ Pregunta Interactiva en Caso de Duda: Si un documento no contiene una OC unívoca, el sistema suspende asignaciones por omisión (eliminando defaults ciegos a Evelia) y despliega un banner de consulta obligando a confirmar la orden destino.',
  ],
};
