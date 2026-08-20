import { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { Card, Spinner } from './ui';
import { useToast } from '../context/ToastContext';
import { money } from '../lib/format';
import type { PurchaseOrder } from '../lib/types';
import { confirmDialog } from '../lib/confirmDialog';

export default function MigrationTools() {
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const toast = useToast();

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  async function executeMigration(dryRun: boolean) {
    if (!dryRun && !(await confirmDialog({ message: '¿Proceder con la sincronización en espejo hacia la colección invoices?', danger: false }))) {
      return;
    }
    setBusy(true);
    setLogs([]);
    addLog(`Iniciando sincronización espejo de facturas (${dryRun ? 'DRY RUN' : 'MODO ESCRITURA'})...`);
    
    try {
      const ordersSnap = await getDocs(collection(db, PATHS.orders));
      const totalOrders = ordersSnap.size;
      addLog(`Se encontraron ${totalOrders} expedientes en total.`);

      let facturasMigradas = 0;
      let montoTotalMigrado = 0;
      
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      ordersSnap.docs.forEach(orderDoc => {
        const orderData = orderDoc.data() as PurchaseOrder;
        const currentInvoices = orderData.invoices || [];
        
        if (currentInvoices.length > 0) {
          addLog(`Expediente ${orderData.oc || orderDoc.id}: sincronizando ${currentInvoices.length} facturas.`);
          
          currentInvoices.forEach(inv => {
            const invoiceRef = doc(db, PATHS.invoices, inv.id || doc(collection(db, PATHS.invoices)).id);
            const mirrorInvoice = {
              ...inv,
              orderId: orderDoc.id,
              client: orderData.client || '',
              department: orderData.department || '',
              oc: orderData.oc || '',
              createdAt: orderData.processedAt || new Date(),
              updatedAt: new Date(),
            };
            
            if (!dryRun) {
              currentBatch.set(invoiceRef, mirrorInvoice, { merge: true });
              opCount++;
            }
            facturasMigradas++;
            montoTotalMigrado += (inv.financials?.invoiceTotal || 0);
          });
        }
        
        if (opCount > 400) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      });
      
      if (opCount > 0) {
        batches.push(currentBatch);
      }

      if (!dryRun) {
        addLog(`Escribiendo ${batches.length} lotes a Firestore...`);
        for (let i = 0; i < batches.length; i++) {
          await batches[i].commit();
          addLog(`Lote ${i + 1} completado.`);
        }
      }

      addLog('===========================================');
      addLog(`RESULTADO: ${facturasMigradas} facturas sincronizadas en espejo.`);
      addLog(`MONTO TOTAL: ${money(montoTotalMigrado)}`);
      addLog('===========================================');
      toast(dryRun ? 'Simulación completada con éxito' : 'Sincronización espejo completada!', 'ok');

    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
      toast('Error en la sincronización', 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="🔄 Sincronización Espejo de Facturas (Colección Invoices)">
      <div style={{ padding: 16 }}>
        <p className="hint" style={{ marginTop: 0 }}>
          Sincroniza las facturas embebidas en <code>purchaseOrders</code> hacia la colección indexada <code>invoices</code> de forma segura e idempotente (sin alterar los expedientes originales).
        </p>
        
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button className="btn" onClick={() => executeMigration(true)} disabled={busy}>
            🔍 Simular (Dry Run)
          </button>
          <button className="btn btn-primary" onClick={() => executeMigration(false)} disabled={busy}>
            🚀 Sincronizar Espejo a Firestore
          </button>
        </div>

        {busy && <Spinner />}

        {logs.length > 0 && (
          <div style={{ background: '#1e293b', color: '#38bdf8', padding: 12, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, maxHeight: 300, overflowY: 'auto' }}>
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
