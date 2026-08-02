const XLSX = require('xlsx');
const fs = require('fs');

const data = [
  { Código: 'B-100', Nombre: 'Bolsa Polietileno 77 CM X 55 CM', Precio: 47.50 },
  { Código: 'B-101', Nombre: 'Bolsa Natural 40 CM X 40 CM', Precio: 52.00 },
  { Código: 'B-102', Nombre: 'Bolsa Negra Basura', Precio: 35.00 }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Catálogo");

XLSX.writeFile(wb, 'public/plantilla_catalogo.xlsx');
console.log('Plantilla Excel generada exitosamente.');
