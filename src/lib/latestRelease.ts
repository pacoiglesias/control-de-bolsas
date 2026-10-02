export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.3: Ingesta Automática de OCs en Kilos, Archivo de Documentos Originales y Ergonomía Táctil 44px',
  date: '02 de Octubre de 2026',
  time: '09:05 PM',
  summary: 'Actualización v9.10.3: parser inteligente de OCs multilínea en KILOS (kg) con captura automática sin errores de datos (ej. OC 12026439806); repositorio y visor oficial de Archivo de Documentos Originales respaldados en Firebase Storage y Firestore; drag & drop directo con touch targets ergonómicos de 44px; feedback háptico sensorial y suite de 224 pruebas unitarias aprobadas al 100%.',
  highlights: [
    '⚖️ Ingesta Canónica de OCs en Kilos: Soporte multi-formato (Formato D multilínea por celdas) que extrae código, descripción, kilos netos, precio unitario e importes sin omisiones.',
    '🗂️ Archivo de Documentos Originales: Repositorio en la nube que resguarda automáticamente cada PDF, XML y ticket procesado bajo Firebase Storage y Firestore con opciones de consulta, edición y purga controlada.',
    '📱 Ergonomía Táctil ≥ 44px & Feedback Háptico: Botonera y selectores adaptados al estándar de diseño Stripe/Linear con micro-animaciones y vibración táctil.',
    '📤 Dropzone y Subida Directa en Archivo: Arrastre o selección inmediata de archivos desde la vista de Archivo con apertura del inspector de datos.',
    '🧪 Suite de 224 Pruebas Unitarias al 100%: Cobertura exhaustiva en Vitest y 0 errores en compilación de producción.',
  ],
};
