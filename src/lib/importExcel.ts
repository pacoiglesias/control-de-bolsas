import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { camposInvoices } from './invoiceOps';
import type { PurchaseOrder } from './types';

export interface ExcelImportSummary {
  updatedOrders: number;
  updatedInvoices: number;
  errors: string[];
}

export async function processExcelImport(file: File): Promise<ExcelImportSummary> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetName = workbook.SheetNames.find(n => n === 'Ventas_Clientes' || n === 'Sheet1');
        if (!sheetName) throw new Error('No se encontró la hoja Ventas_Clientes en el Excel.');
        
        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        const summary: ExcelImportSummary = { updatedOrders: 0, updatedInvoices: 0, errors: [] };
        
        // Group by OrderID
        const ordersMap = new Map<string, any[]>();
        for (const row of rows) {
          if (!row.OrderID) continue;
          if (!ordersMap.has(row.OrderID)) ordersMap.set(row.OrderID, []);
          ordersMap.get(row.OrderID)!.push(row);
        }

        for (const [orderId, invoiceRows] of ordersMap.entries()) {
          try {
            const docRef = doc(db, PATHS.orders, orderId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
              summary.errors.push(`Orden ${orderId} no encontrada.`);
              continue;
            }

            const order = snap.data() as PurchaseOrder;
            let orderChanged = false;

            const rootFolio = invoiceRows[0].OrdenFolio;
            if (rootFolio && order.folio !== rootFolio) {
              order.folio = String(rootFolio);
              orderChanged = true;
            }

            const currentInvoices = order.invoices || [];
            for (const row of invoiceRows) {
              if (!row.InvoiceID) continue;
              
              const invIndex = currentInvoices.findIndex(i => i.id === row.InvoiceID);
              if (invIndex >= 0) {
                const inv = currentInvoices[invIndex];
                const newFolio = row.FacturaFolio ? String(row.FacturaFolio) : undefined;
                const newCr = row.Contrarecibo ? String(row.Contrarecibo) : undefined;
                
                let invChanged = false;
                if (newFolio !== undefined && inv.folio !== newFolio) {
                  inv.folio = newFolio;
                  invChanged = true;
                }
                if (newCr !== undefined && inv.collection?.contrareciboNumber !== newCr) {
                  if (!inv.collection) inv.collection = {};
                  inv.collection.contrareciboNumber = newCr;
                  invChanged = true;
                }
                
                if (invChanged) {
                  currentInvoices[invIndex] = inv;
                  orderChanged = true;
                  summary.updatedInvoices++;
                }
              }
            }

            if (orderChanged) {
              // camposInvoices() mantiene invoiceStatuses en sincronía con
              // invoices, aunque esta importación no toca creditCycle.status
              // hoy -- blindaje ante cambios futuros en este archivo.
              await updateDoc(docRef, {
                folio: order.folio,
                ...camposInvoices(currentInvoices),
              });
              summary.updatedOrders++;
            }

          } catch (err: any) {
            summary.errors.push(`Error actualizando orden ${orderId}: ${err.message}`);
          }
        }
        
        resolve(summary);
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
