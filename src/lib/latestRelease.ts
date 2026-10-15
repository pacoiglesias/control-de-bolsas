export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
 version: 'v9.13.1: Captura pendiente y avance real', date: '15 de Octubre de 2026', time: '',
 summary: 'Los documentos señalan los datos faltantes. Una OC nueva muestra cero entregado y facturado hasta capturar los documentos reales.',
 highlights: ['Aviso de facturas faltantes por folio y contrarrecibo al importar pagos.', 'Cerrar un documento sin aplicar se informa como pendiente, nunca como duplicado.', 'La OC no genera una factura por tener folio. Los próximos pasos dependen de entregas, facturas, contrarrecibos y cobros capturados.'],
};
