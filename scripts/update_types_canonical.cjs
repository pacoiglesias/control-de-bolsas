const fs = require('fs');

const file = 'src/lib/types.ts';
let code = fs.readFileSync(file, 'utf8');
const target = 'export const CANONICAL_GT_ITEMS_439784: PurchaseOrderItem[] = [';
const addition = `export const CANONICAL_GT_ITEMS_439806: PurchaseOrderItem[] = [
  { id: 'item-9806-1', code: 'EGBO000017-SC', description: 'BOLSA POLIETILENO 1.20 M X 1.60 M _Sin Color', quantity: 1000, deliveredQuantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'KGM' },
  { id: 'item-9806-2', code: 'EGBO000095-SC', description: 'BOLSA POLIETILENO 120X 125 CM _Sin Color', quantity: 1500, deliveredQuantity: 1478.35, unitPrice: 43.0, amount: 64500, unit: 'KGM' },
];

export const CANONICAL_GT_ITEMS_439807: PurchaseOrderItem[] = [
  { id: 'item-9807-1', code: 'EGBO000018-SC', description: 'BOLSA POLIETILENO 1.00 M X 1.15 M _Sin Color', quantity: 1000, deliveredQuantity: 1000, unitPrice: 43.0, amount: 43000, unit: 'KGM' },
  { id: 'item-9807-2', code: 'EGBO000094-SC', description: 'BOLSA POLIETILENO 100 X 125 CM _Sin Color', quantity: 1000, deliveredQuantity: 987, unitPrice: 43.0, amount: 43000, unit: 'KGM' },
  { id: 'item-9807-3', code: 'EGBO000093-SC', description: 'BOLSA POLIETILENO 100 X 95 CM _Sin Color', quantity: 1000, deliveredQuantity: 968.80, unitPrice: 43.0, amount: 43000, unit: 'KGM' },
];

`;

if (!code.includes('CANONICAL_GT_ITEMS_439806')) {
  code = code.replace(target, addition + target);
  fs.writeFileSync(file, code, 'utf8');
  console.log('Updated types.ts with CANONICAL_GT_ITEMS_439806 and 439807');
} else {
  console.log('Already present in types.ts');
}
