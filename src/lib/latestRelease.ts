export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.7: OCR Multidireccional con Auto-Rotación, Ingesta de Remisiones Físicas y Conciliación TH 120267114302 (Factura 6363)',
  date: '07 de Octubre de 2026',
  time: '07:45 AM',
  summary: 'v9.10.7: Motor OCR resiliente con detección multi-ángulo y auto-rotación automática (0°, 90°, 270°, 180°) para fotografías tomadas de lado con celular, ingesta inteligente de Remisiones Físicas con desglose de todas las partidas y kilos (5,899.80 kg), resolución automática de alias de OC (12026114099 ➔ 120267114302 TH Nava), activación de OCR directo en el Global Dropzone e integración de Factura 6363 ($74,820.00 MXN / 1,500 kg).',
  highlights: [
    '🔄 OCR con Auto-Rotación (0°, 90°, 180°, 270°): Canvas de preprocesamiento que evalúa la orientación del texto antes de extraer, reconociendo fotos de celular tomadas de forma vertical o apaisada.',
    '📋 Ingesta Inteligente de Remisiones Físicas: Parser especializado que extrae todas las partidas de la tabla física (1,000 + 1,000 + 1,000 + 500 + 915.15 + 984.65 + 500 = 5,899.80 kg), subtotales y totales sin truncar.',
    '🎯 Mapeo Automático de Alias de OC: Reconocimiento del número impreso en remisión 12026114099 vinculándolo directamente a la OC oficial activa de Textil Hogar 120267114302 (Folio 71/14302 · Nava).',
    '📥 OCR Activado en Global Dropzone: Al arrastrar o soltar imágenes en cualquier pantalla, el sistema ahora ejecuta OCR completo y extrae kilos, folio, fecha y OC automáticamente.',
    '🧾 Conciliación Oficial Factura 6363: Registro y vinculación de Factura 6363 ($74,820.00 MXN / 1,500 kg) amparando las partidas 2 y 7 de la remisión con 4,399.80 kg remanentes para facturar.',
  ],
};
