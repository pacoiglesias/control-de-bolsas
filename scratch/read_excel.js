import * as fs from 'fs';
import * as XLSX from 'xlsx';

const buf = fs.readFileSync('Sabana_Auditoria_CORREGIDA_FINAL.xlsx');
const workbook = XLSX.read(buf, { type: 'buffer' });

const diffs = {};
['Auditoria_Cobranza', 'Auditoria_CajaChica', 'Auditoria_Compras'].forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) {
        diffs[sheetName] = XLSX.utils.sheet_to_json(sheet);
    }
});

fs.writeFileSync('scratch/audit_data.json', JSON.stringify(diffs, null, 2));
console.log("Extracted Excel data to scratch/audit_data.json");
