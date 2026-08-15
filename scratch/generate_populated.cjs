const XLSX = require('xlsx');

// 1. Clientes
const clientes = [
  { Empresa: 'Providencia', RFC: 'GTP930115PU1', Dias_Credito: 15 },
  { Empresa: 'Elemental Denim', RFC: 'ELE123456789', Dias_Credito: 30 }
];

// 2. Cobranza Clientes (Todas las capturas de Paco)
const operaciones = [
  // --- FACTURAS PAGADAS ---
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '5927', Fecha_Factura: '27/07/2026', Subtotal: '', IVA: '', Total: 92292.55, Estatus: 'Pagada', Contrarecibo: 'GT-570' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '5928', Fecha_Factura: '27/07/2026', Subtotal: '', IVA: '', Total: 89958.00, Estatus: 'Pagada', Contrarecibo: 'GT-570' },
  
  // --- FACTURAS EN REVISIÓN (Pendientes de Contrarecibo) ---
  { Cliente: 'Providencia', Folio_OC: '12026700000', Folio_Factura: '6098', Fecha_Factura: '27/07/2026', Subtotal: '', IVA: '', Total: 27260.00, Estatus: 'En Revisión', Contrarecibo: '' },
  { Cliente: 'Providencia', Folio_OC: '12026700000', Folio_Factura: '6097', Fecha_Factura: '27/07/2026', Subtotal: '', IVA: '', Total: 109040.00, Estatus: 'En Revisión', Contrarecibo: '' },

  // --- CONTRARECIBOS POR COBRAR ---
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '27/07/2026', Subtotal: '', IVA: '', Total: 106720.17, Estatus: 'Con Contrarecibo', Contrarecibo: 'TH-836' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '20/07/2026', Subtotal: '', IVA: '', Total: 54520.00, Estatus: 'Con Contrarecibo', Contrarecibo: 'GT-742' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '20/07/2026', Subtotal: '', IVA: '', Total: 136300.00, Estatus: 'Con Contrarecibo', Contrarecibo: 'TH-804' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '13/07/2026', Subtotal: '', IVA: '', Total: 69001.60, Estatus: 'Con Contrarecibo', Contrarecibo: 'GT-713' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '13/07/2026', Subtotal: '', IVA: '', Total: 125254.25, Estatus: 'Con Contrarecibo', Contrarecibo: 'TH-768' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '06/07/2026', Subtotal: '', IVA: '', Total: 109040.00, Estatus: 'Con Contrarecibo', Contrarecibo: 'TH-739' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '29/06/2026', Subtotal: '', IVA: '', Total: 106477.56, Estatus: 'Con Contrarecibo', Contrarecibo: 'GT-651' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '29/06/2026', Subtotal: '', IVA: '', Total: 108647.46, Estatus: 'Con Contrarecibo', Contrarecibo: 'TH-713' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '22/06/2026', Subtotal: '', IVA: '', Total: 98136.00, Estatus: 'Con Contrarecibo', Contrarecibo: 'GT-624' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '22/06/2026', Subtotal: '', IVA: '', Total: 80970.38, Estatus: 'Con Contrarecibo', Contrarecibo: 'TH-680' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '15/06/2026', Subtotal: '', IVA: '', Total: 107420.76, Estatus: 'Con Contrarecibo', Contrarecibo: 'GT-597' },
  { Cliente: 'Providencia', Folio_OC: '', Folio_Factura: '', Fecha_Factura: '01/06/2026', Subtotal: '', IVA: '', Total: 196482.30, Estatus: 'Con Contrarecibo', Contrarecibo: 'GT-535' }
];

// 3. Caja Chica
const caja = [
  { Concepto: 'ANTICIPO A ANDRES', Tipo: 'Salida', Monto: 145000, Fecha: '23/07/2026' },
  { Concepto: 'Recibimos dinero', Tipo: 'Entrada', Monto: 76140, Fecha: '23/07/2026' }
];

// 4. Compras Proveedores
const compras = [
  { Proveedor: 'Bolsas y Empaques SA', Folio_Factura: 'F-9901', Fecha_Emision: '25/07/2026', Fecha_Vencimiento: '25/08/2026', Subtotal: 10000.00, IVA: 1600.00, Total: 11600.00, Estatus: 'Pendiente' }
];

const wb = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientes), "Clientes");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(operaciones), "Cobranza_Clientes");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras), "Compras_Proveedores");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(caja), "Caja Chica");

XLSX.writeFile(wb, 'public/plantilla_llena.xlsx');
console.log('Plantilla totalmente llena generada.');
