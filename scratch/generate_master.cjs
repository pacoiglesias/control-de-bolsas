const XLSX = require('xlsx');

// 1. Clientes
const clientes = [
  { Empresa: 'Elemental Denim', RFC: 'ELE123456789', Dias_Credito: 30 },
  { Empresa: 'Providencia', RFC: 'PRO123456789', Dias_Credito: 15 }
];

// 2. Operaciones Historicas
const operaciones = [
  { 
    Cliente: 'Providencia', 
    Folio_OC: 'OC-1001', 
    Folio_Factura: '5927', 
    Fecha_Factura: '27/07/2026',
    Subtotal: 79562.54,
    IVA: 12730.01,
    Total: 92292.55, 
    Estatus: 'Pagada', 
    Contrarecibo: 'GT-570' 
  },
  { 
    Cliente: 'Providencia', 
    Folio_OC: 'OC-1001', 
    Folio_Factura: '6098', 
    Fecha_Factura: '27/07/2026',
    Subtotal: 23500.00,
    IVA: 3760.00,
    Total: 27260.00, 
    Estatus: 'En Revisión', 
    Contrarecibo: '' 
  }
];

// 3. Caja Chica
const caja = [
  { Concepto: 'ANTICIPO A ANDRES', Tipo: 'Salida', Monto: 145000, Fecha: '23/07/2026' },
  { Concepto: 'Recibimos dinero', Tipo: 'Entrada', Monto: 76140, Fecha: '23/07/2026' }
];

// 4. Compras Proveedores
const compras = [
  { 
    Proveedor: 'Bolsas y Empaques SA', 
    Folio_Factura: 'F-9901', 
    Fecha_Emision: '25/07/2026', 
    Fecha_Vencimiento: '25/08/2026',
    Subtotal: 10000.00,
    IVA: 1600.00,
    Total: 11600.00,
    Estatus: 'Pendiente'
  }
];

const wb = XLSX.utils.book_new();

const wsClientes = XLSX.utils.json_to_sheet(clientes);
XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");

const wsOperaciones = XLSX.utils.json_to_sheet(operaciones);
XLSX.utils.book_append_sheet(wb, wsOperaciones, "Cobranza_Clientes");

const wsCompras = XLSX.utils.json_to_sheet(compras);
XLSX.utils.book_append_sheet(wb, wsCompras, "Compras_Proveedores");

const wsCaja = XLSX.utils.json_to_sheet(caja);
XLSX.utils.book_append_sheet(wb, wsCaja, "Caja Chica");

XLSX.writeFile(wb, 'public/plantilla_maestra.xlsx');
console.log('Plantilla maestra V2 generada.');
