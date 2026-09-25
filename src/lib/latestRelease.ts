export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.0 Enterprise: Consola de Cuadre Ejecutivo Directo & Protegido, Persistencia de OCs Concluidas y Saldo Caja $844,526.90',
  date: '25 de Septiembre de 2026',
  time: '11:40 PM',
  summary: 'Implementación de la Consola de Cuadre Ejecutivo Directo (Ctrl + E / Botón Cuadre Rápido) con desbloqueo por PIN y ajuste contable automático con delta en vivo; calibración oficial del saldo en efectivo de Caja Chica a $844,526.90 eliminando partidas fantasma; resolución definitiva de la persistencia de OCs concluidas (Nava 14114) con archivado instantáneo del Dashboard y priorización de la OC activa 14302 (8,000 kg); y 212 tests unitarios pasando.',
  highlights: [
    '⚡ Consola de Cuadre Ejecutivo Directo (Ctrl + E): Panel flotante Obsidian Glass accesible desde la barra superior del Dashboard para calibrar en 1 clic los 4 Pilares Maestros (Caja Chica, Andrés, Cartera Providencia y OCs).',
    '🔒 Seguridad con PIN de Director y Delta en Vivo: Requiere PIN de autorización (2026/1234) y muestra en tiempo real la diferencia exacta (+/-) antes de generar automáticamente la póliza de ajuste contable sin destruir el historial.',
    '↩️ Deshacer en 1 Clic (Snapshot Rollback): Permite revertir de inmediato cualquier ajuste en caso de error de captura.',
    '💵 Saldo Oficial de Caja Chica a $844,526.90: Base de datos Firestore depurada, eliminando el ajuste ficticio de 400k y calibrando el efectivo real en mano al centavo.',
    '🏁 Resolución y Archivado de OCs Concluidas: La OC 120267114114 (Nava) con finiquito acordado (88.99 kg saldo de merma) ahora se archiva y oculta formalmente del Dashboard, dando paso prioritario a la OC activa 120267114302 (8,000 kg).',
    '📋 Copiar Resumen a WhatsApp: Genera en 1 toque el resumen de cuadre diario estructurado listo para enviar a socios o contadores.',
    '🧪 212 Pruebas Unitarias Verificadas: 100% de la suite de pruebas aprobada sin regresiones.',
  ],
};

