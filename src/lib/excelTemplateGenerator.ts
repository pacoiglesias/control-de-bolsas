import * as XLSX from 'xlsx';
import { CANONICAL_TH_ITEMS, CANONICAL_GT_ITEMS } from './types';

/**
 * Genera y descarga el archivo Excel oficial de plantilla para captura y sincronización masiva de órdenes, entregas y contrarecibos.
 */
/**
 * Construye el libro de trabajo de Excel en memoria con las 3 hojas oficiales.
 */
export function buildOfficialExcelWorkbook() {
  const wb = XLSX.utils.book_new();

  // ───────── HOJA 1: Captura de Expedientes (Plantilla con Datos de Ejemplo) ─────────
  const headers = [
    'Folio_OC',
    'Cliente',
    'Departamento',
    'Clave_SAT',
    'Descripcion_Bolsa',
    'Kilos_Pedidos',
    'Precio_Venta_kg',
    'Precio_Costo_Andres_kg',
    'Kilos_Entregados_Bascula',
    'Folio_Factura_CFDI',
    'Contrarecibo_CR',
    'Fecha_Emision_YYYY_MM_DD',
    'Fecha_Vencimiento_YYYY_MM_DD',
    'Estatus_Cobro',
    'Notas_Operativas'
  ];

  const sampleRows = [
    // Ejemplo 1: Textil Hogar (TH - Nava / Lamuño) - Partida 1 Facturada
    [
      '120267114114',
      'TEXTIL HOGAR (TH - NAVA)',
      'TH-ALMACEN-1',
      '24141500',
      'BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250',
      1000,
      43.00,
      38.00,
      990.16,
      '6198',
      'TH-1024',
      '2026-08-17',
      '2026-09-16',
      'Por Cobrar',
      'Solicitó: José Nava Flores · Autorizó: Torre Lamuño'
    ],
    // Ejemplo 2: Textil Hogar (TH - Nava / Lamuño) - Partida 2 Facturada
    [
      '120267114114',
      'TEXTIL HOGAR (TH - NAVA)',
      'TH-ALMACEN-1',
      '24141500',
      'BULTO 80 X 20 +20 X 160 *250',
      1000,
      43.00,
      38.00,
      975.65,
      '6198',
      'TH-1024',
      '2026-08-17',
      '2026-09-16',
      'Por Cobrar',
      'Entrega en planta Nava · Cero mermas'
    ],
    // Ejemplo 3: Grupo Textil Providencia (GT - Evelia / Planta P4) - Partida 1 Facturada
    [
      '12026439713',
      'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      'P4-ALM',
      '24141500',
      'BOLSA POLIETILENO 120X 125 CM _Sin Color',
      1000,
      43.00,
      38.00,
      500.00,
      '6193',
      'GT-570',
      '2026-08-25',
      '2026-09-24',
      'Por Cobrar',
      'Contacto: Evelia · Planta P4'
    ],
    // Ejemplo 4: Grupo Textil Providencia (GT - Evelia / Planta P4) - Partida 2 en Proceso
    [
      '12026439713',
      'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      'P4-ALM',
      '24141500',
      'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color',
      1000,
      43.00,
      38.00,
      0,
      '',
      '',
      '2026-08-25',
      '2026-09-24',
      'En Proceso',
      'Contacto: Evelia · Pendiente de entrega de Andrés'
    ],
    // Renglón en blanco para que el usuario capture libremente
    [
      '',
      'TEXTIL HOGAR (TH - NAVA)',
      'TH-ALMACEN-1',
      '24141500',
      'BOLSA POLIETILENO 77 CM X 55 CM _Sin Color',
      1000,
      43.00,
      38.00,
      0,
      '',
      '',
      new Date().toISOString().slice(0, 10),
      '',
      'En Proceso',
      ''
    ]
  ];

  const wsCapturaData = [headers, ...sampleRows];
  const wsCaptura = XLSX.utils.aoa_to_sheet(wsCapturaData);

  // Ajustar anchos de columnas
  wsCaptura['!cols'] = [
    { wch: 16 }, // Folio_OC
    { wch: 38 }, // Cliente
    { wch: 18 }, // Departamento
    { wch: 12 }, // Clave_SAT
    { wch: 48 }, // Descripcion_Bolsa
    { wch: 14 }, // Kilos_Pedidos
    { wch: 16 }, // Precio_Venta_kg
    { wch: 22 }, // Precio_Costo_Andres_kg
    { wch: 24 }, // Kilos_Entregados_Bascula
    { wch: 18 }, // Folio_Factura_CFDI
    { wch: 18 }, // Contrarecibo_CR
    { wch: 24 }, // Fecha_Emision
    { wch: 26 }, // Fecha_Vencimiento
    { wch: 16 }, // Estatus_Cobro
    { wch: 35 }  // Notas_Operativas
  ];

  XLSX.utils.book_append_sheet(wb, wsCaptura, '📦 Captura Expedientes');

  // ───────── HOJA 2: Catálogo de Partidas Oficiales y Clientes ─────────
  const catalogoData: any[][] = [
    ['CATÁLOGO DE PARTIDAS OFICIALES Y CLIENTES — CONTROL DE BOLSAS ERP'],
    [],
    ['🏢 CLIENTES Y PLANTAS OFICIALES:'],
    ['Nombre Canónico', 'Prefijo Contrarecibo', 'Departamento', 'Contacto / Autorizó'],
    ['TEXTIL HOGAR (TH - NAVA)', 'TH-', 'TH-ALMACEN-1', 'JOSÉ NAVA FLORES / JOSÉ ANTONIO TORRE LAMUÑO'],
    ['GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)', 'GT-', 'P4-ALM', 'EVELIA / PLANTA P4'],
    [],
    ['📦 PARTIDAS TEXTIL HOGAR (TH) — 6 MEDIDAS CANÓNICAS:'],
    ['Código Interno', 'Clave SAT', 'Descripción', 'Unidad'],
    ...CANONICAL_TH_ITEMS.map(it => [it.code, '24141500', it.description, 'KGM']),
    [],
    ['📦 PARTIDAS GRUPO TEXTIL (GT / P4) — 4 MEDIDAS CANÓNICAS:'],
    ['Código Interno', 'Clave SAT', 'Descripción', 'Unidad'],
    ...CANONICAL_GT_ITEMS.map(it => [it.code, '24141500', it.description, 'KGM']),
    [],
    ['💰 PARÁMETROS FINANCIEROS VIGENTES:'],
    ['Concepto', 'Valor Oficial', 'Regla de Negocio'],
    ['Precio de Venta a Providencia', '$43.00 / kg (+ 16% IVA = $49.88)', 'Facturación en CFDI 4.0'],
    ['Costo de Compra a Andrés', '$38.00 / kg (Neto)', 'Cero mermas · Andrés entrega lo pactado o menos'],
    ['Margen Bruto de Operación', '$5.00 / kg', 'Diferencia venta vs costo'],
    ['Comisión del Contador', '8% sobre subtotal ($3.44 / kg)', 'Se retiene para pago de honorarios fiscales'],
  ];

  const wsCatalogo = XLSX.utils.aoa_to_sheet(catalogoData);
  wsCatalogo['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 48 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsCatalogo, '🏢 Catálogo & Precios');

  // ───────── HOJA 3: Instructivo y Reglas de Negocio ─────────
  const instructivoData = [
    ['INSTRUCTIVO DE LLENADO PARA SINCRONIZACIÓN EXCEL'],
    [],
    ['1. Folio_OC: Número de la Orden de Compra de Providencia (ej. 120267114114).'],
    ['2. Cliente: Usa "TEXTIL HOGAR (TH - NAVA)" para órdenes de Nava o "GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)" para órdenes de Evelia.'],
    ['3. Contrarecibo: Usa prefijo "TH-" para Textil Hogar (ej. TH-946) y prefijo "GT-" para Grupo Textil (ej. GT-742).'],
    ['4. Precios: Por regla general el Precio de Venta es $43.00 y el Costo de Andrés es $38.00 por kilogramo.'],
    ['5. Fechas: Formato estándar AAAA-MM-DD (ej. 2026-08-17). La fecha de vencimiento es a 30 días.'],
    ['6. Cero Mermas: No deduzcas mermas en los kilos de Andrés. Todo kilo registrado ampara su valor de costo.'],
    [],
    ['Al terminar de llenar el archivo, arrástralo directamente a la pantalla de Expedientes del ERP para sincronizarlo al instante.']
  ];

  const wsInstructivo = XLSX.utils.aoa_to_sheet(instructivoData);
  wsInstructivo['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstructivo, '📖 Instructivo');

  return wb;
}

/**
 * Genera y descarga el archivo Excel oficial de plantilla para captura y sincronización masiva.
 */
export function downloadOfficialExcelTemplate() {
  const wb = buildOfficialExcelWorkbook();
  const fileName = `Plantilla_Oficial_Captura_ERP_Providencia_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export interface PrefacturaItem {
  kilos: number;
  description: string;
  unitPrice: number;
  total?: number;
}

export interface PrefacturaExcelData {
  clientName?: string;
  clientRfc?: string;
  clientAddress?: string;
  clientUsoCfdi?: string;
  oc: string;
  items: PrefacturaItem[];
  metodoPago?: string;
  formaPago?: string;
  claveSat?: string;
  unidadSat?: string;
  notaCondiciones?: string;
}

/**
 * Construye un libro de Excel (.xlsx) con la plantilla idéntica a la prefactura oficial enviada al facturador.
 */
export function buildPrefacturaWorkbook(data: PrefacturaExcelData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Matriz de celdas AOA
  const rows: any[][] = [];

  // Fila 1 (vacía)
  rows.push([]);
  // Fila 2: DATOS DEL RECEPTOR
  rows.push(['', 'DATOS DEL RECEPTOR']);
  // Fila 3: Razón Social
  rows.push(['', data.clientName || 'GRUPO TEXTIL PROVIDENCIA SA DE CV']);
  // Fila 4: RFC
  rows.push(['', data.clientRfc || 'GTP930115PU1']);
  // Fila 5: Domicilio
  rows.push(['', data.clientAddress || 'HIDALGO NORTE 7, CP 90800, TLAXCALA, SANTA ANA CHIAUTEMPAN, MEXICO']);
  // Fila 6: Uso CFDI
  rows.push(['', data.clientUsoCfdi || 'Uso CFDI: G01 - Adquisición de mercancias']);
  // Filas 7 y 8 (espacio)
  rows.push([]);
  rows.push([]);

  // Fila 9: Encabezado de tabla (KILOS, DEESCRIPCION, ..., PRECIO, TOTAL)
  rows.push(['KILOS', 'DEESCRIPCION', '', '', '', '', 'PRECIO', 'TOTAL']);

  let subtotal = 0;
  const startItemRow = 10; // 1-based index in Excel

  // Filas de Partidas con fórmula dinámica (=A{row}*G{row})
  data.items.forEach((item, idx) => {
    const rowNum = startItemRow + idx;
    const itemTotal = Number((item.kilos * item.unitPrice).toFixed(2));
    subtotal += itemTotal;
    rows.push([
      item.kilos,
      item.description,
      '',
      '',
      '',
      '',
      item.unitPrice,
      { t: 'n', f: `A${rowNum}*G${rowNum}`, v: itemTotal },
    ]);
  });

  const lastItemRow = startItemRow + data.items.length - 1;
  subtotal = Number(subtotal.toFixed(2));
  const iva = Number((subtotal * 0.16).toFixed(2));
  const total = Number((subtotal + iva).toFixed(2));

  const subtotalRowNum = lastItemRow + 1;
  const ivaRowNum = subtotalRowNum + 2;

  // Fila Subtotal con fórmula =SUM(H{start}:H{end})
  rows.push(['', '', '', '', '', '', '', { t: 'n', f: `SUM(H${startItemRow}:H${lastItemRow})`, v: subtotal }]);
  // Espacio
  rows.push([]);
  // Fila IVA con fórmula =ROUND(H{subtotal}*0.16, 2)
  rows.push(['', '', '', '', '', '', 'IVA', { t: 'n', f: `ROUND(H${subtotalRowNum}*0.16, 2)`, v: iva }]);
  // Fila Total con fórmula =H{subtotal}+H{iva}
  rows.push(['', '', '', '', '', '', 'TOTAL', { t: 'n', f: `H${subtotalRowNum}+H${ivaRowNum}`, v: total }]);
  // Espacio
  rows.push([]);

  // Bloque Fiscal en Pie de Página
  const ocNote = data.notaCondiciones || (data.oc ? (data.oc.toUpperCase().startsWith('OC') ? data.oc : `OC ${data.oc}`) : 'OC 120267114114');

  rows.push(['', '', '', '', '', '', 'METODO DE PAGO', data.metodoPago || 'PPD']);
  rows.push(['', '', '', '', '', '', 'FORMA DE PAGO', data.formaPago || '99 por definir']);
  rows.push(['', '', '', '', '', '', 'CLAVE SAT', data.claveSat || '24141500']);
  rows.push(['', '', '', '', '', '', 'UNIDAD SAT', data.unidadSat || 'KGM']);
  rows.push(['', '', '', '', '', '', 'AGREGAR NOTA', ocNote]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Anchos de columna
  ws['!cols'] = [
    { wch: 10 }, // A: Kilos
    { wch: 62 }, // B: Descripción
    { wch: 4 },  // C
    { wch: 4 },  // D
    { wch: 4 },  // E
    { wch: 4 },  // F
    { wch: 18 }, // G: Precio / Etiquetas
    { wch: 22 }, // H: Total / Valores
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Prefactura');
  return wb;
}

/**
 * Genera y descarga el archivo .xlsx de Prefactura oficial para enviar al facturador.
 */
export function downloadPrefacturaExcel(data: PrefacturaExcelData, customFileName?: string) {
  const wb = buildPrefacturaWorkbook(data);
  const cleanOc = (data.oc || 'OC').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = customFileName || `Prefactura_${cleanOc}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

