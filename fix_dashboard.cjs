const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// 1. Fix unused imports
code = code.replace(/import \{ kilos, money, monthLabel, percent, toDate \} from '\.\.\/lib\/format';/g, "import { kilos, money, monthLabel, percent, toDate } from '../lib/format';");
code = code.replace(/import \{ daysLate \} from '\.\.\/lib\/finance';/g, "import { daysLate } from '../lib/finance';");

// 2. Remove duplicate hooks (from line 216)
code = code.replace(/const \[statsDoc\] = useDocumentData\(doc\(db, 'stats', 'dashboard'\)\);\s*const \[activeOrdersDoc\] = useCollectionData\(query\(\s*collection\(db, PATHS\.orders\),\s*where\('invoiceStatuses', 'array-contains-any', \['pending', 'overdue', 'manual_review'\]\)\s*\)\);\s*const activeOrders = \(activeOrdersDoc as PurchaseOrder\[\]\) \|\| \[\];/g, "  const activeOrders = (activeOrdersDoc as PurchaseOrder[]) || [];");

// 3. Fix orders.length
code = code.replace(/\{orders\.length === 0 && INITIAL_SEED_DATA\.length > 0 && \(/g, "      {(statsDoc?.counters?.totalOrders ?? 0) === 0 && INITIAL_SEED_DATA.length > 0 && (");
code = code.replace(/orders\.length\} órdenes/g, "statsDoc?.counters?.totalOrders ?? 0} órdenes");

// 4. Fix implicit anys in maps
code = code.replace(/k\.porRecibir\.map\(\(r, idx\) => \(/g, "k.porRecibir.map((r: any, idx: number) => (");
code = code.replace(/k\.proximos\.slice\(0, 8\)\.map\(\(\{ o, inv, d \}\) => \{/g, "k.proximos.slice(0, 8).map(({ o, inv, d }: any) => {");
code = code.replace(/k\.mesesKeys\.map\(\(m\) => \(\{ name: monthLabel\(m\)/g, "k.mesesKeys.map((m: any) => ({ name: monthLabel(m)");
code = code.replace(/k\.mesesKeys\.map\(\(m\) => \(/g, "k.mesesKeys.map((m: any) => (");

fs.writeFileSync('src/pages/Dashboard.tsx', code);
console.log('Fixed Dashboard.tsx');
