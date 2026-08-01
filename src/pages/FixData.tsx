import { useState } from 'react';
import { db, PATHS } from '../lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

export default function FixData() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const runFix = async () => {
    setBusy(true);
    addLog('Iniciando cuadre maestro...');
    
    try {
      // 1. Fix Contrarecibos
      const targetCRs = [
        { cr: 'TH-836', amount: 106720.17 },
        { cr: 'GT-742', amount: 54520.00 },
        { cr: 'TH-804', amount: 136300.00 },
        { cr: 'GT-713', amount: 69001.60 },
        { cr: 'TH-768', amount: 125254.25 },
        { cr: 'TH-739', amount: 109040.00 },
        { cr: 'GT-651', amount: 106477.56 },
        { cr: 'TH-713', amount: 108647.46 }, // wait, TH-713 and GT-713 ? Screenshot says TH-713 for 108,647.46
        { cr: 'TH-680', amount: 80970.38 },
        { cr: 'GT-597', amount: 107420.76 }
      ];
      
      const ordersSnap = await getDocs(collection(db, PATHS.orders));
      const batch = writeBatch(db);
      let matchedCount = 0;

      ordersSnap.docs.forEach(docSnap => {
        const order = docSnap.data();
        let changed = false;
        const invoices = order.invoices || [];
        
        invoices.forEach((inv: any) => {
          const total = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          
          // Buscar si el total hace match exacto (dentro de 1 peso) con algún CR objetivo
          const target = targetCRs.find(t => Math.abs(t.amount - total) < 1.0);
          if (target) {
             if (!inv.collection) inv.collection = {};
             if (inv.collection.contrareciboNumber !== target.cr) {
                 inv.collection.contrareciboNumber = target.cr;
                 changed = true;
                 matchedCount++;
                 addLog(`✅ Asignado CR ${target.cr} a la factura de ${total}`);
             }
          }
        });
        
        if (changed) {
           batch.update(docSnap.ref, { invoices });
        }
      });
      
      addLog(`Se actualizaron ${matchedCount} facturas con su CR exacto.`);

      // 2. Fix Andrés Saldo
      // Saldo a favor nuestro con andres: 21,824.44
      // Saldo caja: 75,265.56
      const expensesSnap = await getDocs(collection(db, PATHS.expenses));
      let totalPagado = 0;
      expensesSnap.docs.forEach(d => {
         const e = d.data();
         if (e.category === 'proveedor') {
            if (e.type === 'egreso') totalPagado += e.amount;
            if (e.type === 'ingreso') totalPagado -= e.amount;
         }
      });
      
      // La formula de "Saldo A Favor" es: totalPagado - deudaHistorica = 21,824.44
      // Entonces: deudaHistorica = totalPagado - 21,824.44
      const targetDeudaHistorica = totalPagado - 21824.44;
      
      batch.update(doc(db, 'system_settings', 'global'), {
         historicalDebtAndres: targetDeudaHistorica
      });
      addLog(`✅ Ajustado Saldo Histórico de Andrés para que tu Saldo a Favor sea exactamente $21,824.44.`);
      
      // Commit all
      await batch.commit();
      addLog('🚀 Todo cuadrado y guardado exitosamente en base de datos.');
      
    } catch (e: any) {
      addLog('❌ Error: ' + e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Herramienta de Cuadre Maestro</h1>
      <p>Al hacer clic en este botón, el sistema escaneará las facturas actuales y les asignará automáticamente los Contrarecibos (TH-836, TH-804, GT-713, etc) basándose en las cantidades exactas de tu Excel.</p>
      <p>También recalculará el saldo inicial de Andrés para que el "Saldo a Favor" sea exactamente <b>$21,824.44</b>.</p>
      <button 
        onClick={runFix} 
        disabled={busy}
        style={{ padding: '12px 24px', fontSize: 18, background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        {busy ? 'Cuadrando...' : 'Aplicar Cuadre Exacto'}
      </button>
      
      <div style={{ marginTop: 24, background: '#f1f5f9', padding: 16, borderRadius: 8, fontFamily: 'monospace' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
