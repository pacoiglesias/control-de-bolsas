export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.1 Enterprise: Blindaje Firestore safeWrites, Erradicación de Error Undefined en Sincronizador y Suite 100% Aprobada',
  date: '26 de Septiembre de 2026',
  time: '12:35 AM',
  summary: 'Actualización y auditoría integral v9.10.1 Enterprise: erradicación definitiva del error "Unsupported field value: undefined" en Firestore mediante safeFirestore y cleanUndefined universal; corrección completa del Sincronizador Oficial de Contrarecibos Providencia (CR GT-993 y carteras oficiales); logging estructurado de errores del sistema; y 100% de la suite de pruebas unitarias pasando.',
  highlights: [
    '🛡️ Blindaje Universal safeFirestore: Interceptores safeSetDoc y safeUpdateDoc con sanitización recursiva cleanUndefined que garantizan cero errores de campo undefined en escrituras a Firestore, protegiendo Timestamps y FieldValues.',
    '⚡ Sincronizador Oficial de Providencia 100% Operativo: Corregido el flujo de actualización de contrarecibos (incluyendo CR GT-993) eliminando campos undefined en notas y detalles de factura.',
    '🪵 Logging de Errores y Diagnóstico: Registro estructurado en consola y Firestore (error_logs) que permite identificar y resolver anomalías al instante.',
    '🧪 100% Pruebas Unitarias Verificadas: 207 pruebas unitarias aprobadas sin regresiones en lógica financiera ni modelos de datos.',
    '⚡ Consola de Cuadre Ejecutivo Directo (Ctrl + E): Calibración en 1 clic de los 4 Pilares Maestros (Caja Chica, Andrés, Cartera Providencia y OCs).',
    '💵 Saldo Oficial de Caja Chica Calibrado: Efectivo verificado a $844,526.90 y OCs concluidas archivadas.',
  ],
};

