export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.6.0 Enterprise: Menú Lateral Enriquecido, Live Status Card y Panel Universal de Captura 1-Clic',
  date: '25 de Septiembre de 2026',
  time: '12:15 AM',
  summary: 'Rediseño mayor de accesibilidad y ergonomía: tarjeta de métricas en vivo en la barra lateral (kilos pendientes, caja chica y cartera por cobrar), panel de captura rápida para meter o modificar datos desde cualquier lugar sin cambiar de vista, botones directos en la cabecera superior y badges inteligentes.',
  highlights: [
    '📊 Live Status Card en Sidebar: Monitoreo en vivo de kilos por entregar en patio, saldo en efectivo en Caja Chica y cartera de Providencia con clic táctil para saltar a cada vista.',
    '⚡ Panel Universal de Captura Rápida (1-Clic): Botones permanentes para registrar entregas de báscula, facturas CFDI, contrarecibos, documentos con auto-captura (IA/OCR) y movimientos de caja chica.',
    '🚀 Accesos Directos en Topbar: Botones rápidos (+ Entrega, + Factura, ⚡ Auto-Subir) accesibles en la cabecera superior en desktop y laptop.',
    '🏷️ Badges Inteligentes Dinámicos: Conteo en tiempo real de OCs activas, saldo en efectivo en pesos y centinela 100% OK en el menú lateral.',
  ],
};
