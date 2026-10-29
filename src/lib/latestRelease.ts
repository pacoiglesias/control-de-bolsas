export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.16.5: Complementos que liquidan, kilos a precio real y tablero de conciliación',
  date: '29 de Octubre de 2026',
  time: '14:35',
  summary: 'Tres mejoras aprobadas de la revisión: el complemento de pago CFDI ya liquida la factura (parcial o total) en cartera en vez de solo marcarla; la corroboración de kilos usa el precio real del documento (las OCs a $44 ya no salen infladas); y el tablero de conciliación lista en una sola vista las diferencias OC ↔ entregas ↔ facturas ↔ pagos.',
  highlights: [
    'Complemento de pago CFDI: al procesar un XML tipo P se lee ImpPagado e ImpSaldoInsoluto por factura, se acumula paidAmount y el estatus pasa a paid si se liquidó o a in_review si quedó resto, con recibo idempotente CFDI_<uuid>_<factura> para que reprocesar no duplique.',
    'Kilos a precio real: la corroboración del OCR ya no divide entre $43 fijos; detecta el precio del documento (conceptos o precio repetido en el texto) y la factura 6438 queda en 1,325 kg, no en 1,355.81 kg. Los precios fijos de autoDocumentProcessor usan ahora el precio del documento o de la configuración.',
    'Tablero de conciliación en el tablero ejecutivo: facturas sin OC, kilos entregados sin facturar, facturado por encima de lo entregado, precios distintos al de la OC y pagos parciales, cada renglón con botón para abrir su expediente.',
  ],
};

