export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.16.3: Auditoría de practicidad — 7 correcciones de uso diario',
  date: '28 de Octubre de 2026',
  time: '21:45',
  summary: 'Correcciones de practicidad auditadas en código: botón móvil que rebotaba a inicio en silencio, atajos de teclado que se disparaban con modales abiertos, renglones incompletos que bloqueaban el guardado sin decir cuál, carga por lote documento por documento, ticker financiero oculto en la vista por defecto, rol de solo consulta rebotado sin explicación y teclado numérico inconsistente en el modal de órdenes.',
  highlights: [
    'Botón móvil "CR / Docs" ahora abre Cobranza: antes navegaba a una ruta inexistente y el catch-all lo devolvía a inicio sin aviso.',
    'Atajos N/F/C/P ya no se disparan con un modal o diálogo abierto: se conserva el trabajo en curso del formulario.',
    'Captura Rápida valida por renglón: el campo faltante se marca en rojo, se lleva a la vista y el aviso nombra el folio/OC del renglón.',
    'Recepción por lote: nuevo botón "Cargar todos los listos" junto a "Limpiar Bandeja", con contador de progreso y resumen final con folios.',
    'Ticker financiero en vivo visible también en la vista ejecutiva (la vista por defecto), sin cambiar el default.',
    'Rol viewer en Cobranza ahora ve el aviso "Tu rol es solo consulta; pide acceso de operador para Cobranza" antes de redirigir.',
    'Teclado numérico consistente en todo el modal de órdenes (inputMode="decimal" + enterKeyHint="done"), mismo patrón de la 9.16.2.',
  ],
};

