export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.16.0: Conciliación Oficial de Cartera, Calibración Caja Chica y Facturación CFDI 4.0 (F-6437 y F-6438)',
  date: '27 de Octubre de 2026',
  time: '13:15',
  summary: 'Actualización canónica de alta fidelidad: calibración exacta de Caja Chica a $451,848.56, sincronización de la cartera activa a los 4 Contrarecibos vigentes del portal ($359,111.06), incorporación de las Facturas timbradas F-6437 y F-6438, y registro de las nuevas Órdenes de Compra 120267114400 (TH 9,500 kg) y 12026439834 (GT 1,300 kg).',
  highlights: [
    'Calibración oficial de Caja Chica: saldo físico en mano establecido en $451,848.56 MXN.',
    'Padrón canónico de cartera vigente actualizado exclusivamente a los 4 contrarecibos activos reportados: GT-1106 ($85,544.20), TH-1271 ($98,986.86), GT-1074 ($99,760.00) y TH-1237 ($74,820.00), sumando exactamente $359,111.06 MXN.',
    'Registro y timbrado CFDI 4.0 de Factura 6437 (UUID 18633874-6993-4edd-9278-52bccadb1054, $69,832.00, 1,400 kg) de la OC 12026439806 de Evelia.',
    'Registro y timbrado CFDI 4.0 de Factura 6438 (UUID d8283160-e1b1-40f0-89a8-3a84fe5b222e, $67,628.00, 1,325 kg) de la nueva OC 120267114400 de Nava.',
    'Ingesta de la Orden de Compra Maestra 120267114400 (Folio 71/14400, 9,500 kg @ $44.00, $418,000 subtotal) con 1,325 kg facturados y 8,175 kg pendientes de entrega.',
    'Ingesta de la Orden de Compra 12026439834 (Folio 43/9834, 1,300 kg @ $43.00, $55,900 subtotal) como pedido pendiente sin entregas previas.',
    'Verificación integral de código: 458 pruebas unitarias pasando al 100% y 0 errores de TypeScript.',
  ],
};
