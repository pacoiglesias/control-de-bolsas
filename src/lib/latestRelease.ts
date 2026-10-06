export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.4: Ingesta de Remisiones Oficiales GT, Métricas en Vivo y Credenciales Firebase Robustas',
  date: '06 de Octubre de 2026',
  time: '09:15 PM',
  summary: 'v9.10.4: Registro automático de la Remisión Oficial 6439784 (2,000 kg en 3 partidas, OC 12026439784 GT·Evelia·P4, 5-Oct-2026). Dashboard y AlertasEjecutivas actualizados con métricas en vivo: kg entregados, kg por facturar, kg faltantes y fecha próxima entrega (13 de Octubre). OcTracking muestra tarjeta de próxima entrega. OCR amplía docKind a "remision". Firebase.ts con credenciales fallback para resiliencia sin .env. 219 tests aprobados al 100%.',
  highlights: [
    '📦 Remisión 6439784 Registrada: 2,000 kg en 3 partidas (500+500+1,000) sellados en P4 por Evelia Castillo (5-Oct-2026), vinculados a OC 12026439784. Estado: invoiced=false — PENDIENTE DE FACTURAR.',
    '📊 Métricas en Vivo OC 43/9784: kilosEntregados=2,000 / kilosPendientesFacturar=2,000 / kilosFaltantes=3,100 / proximaEntrega=13 de Octubre.',
    '⚡ AlertasEjecutivas Actualizadas: Muestra estado "2,000 kg Entregados (Por Facturar)" con monto ($99,760 con IVA) y fecha próxima entrega en tiempo real.',
    '📅 OcTracking — Tarjeta Próxima Entrega: Badge azul con fecha y kg faltantes visible directamente en la lista de OCs activas.',
    '🔒 Firebase.ts Resiliente: Credenciales de fallback hardcoded para que la app nunca quede en blanco si faltan variables de entorno .env.',
    '🔍 OCR docKind "remision": El parser reconoce ahora Órdenes de Entrega/Remisiones selladas como tipo de documento propio.',
    '🧪 219 Pruebas Unitarias al 100%: Suite completa en 32 archivos sin regresiones.',
  ],
};
