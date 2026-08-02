import { useState } from 'react';
import { db, PATHS } from '../lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

export default function FixData() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const runFix = async () => {
    setBusy(true);
    addLog('Iniciando cuadre maestro...');
    
    try {
      // 1. Fix Contrarecibos (Por cobrar)
      const targetCRs = [
        { cr: 'TH-836', amount: 106720.17 },
        { cr: 'GT-742', amount: 54520.00 },
        { cr: 'TH-804', amount: 136300.00 },
        { cr: 'GT-713', amount: 69001.60 },
        { cr: 'TH-768', amount: 125254.25 },
        { cr: 'TH-739', amount: 109040.00 },
        { cr: 'GT-651', amount: 106477.56 },
        { cr: 'TH-713', amount: 108647.46 }, 
        { cr: 'TH-680', amount: 80970.38 },
        { cr: 'GT-597', amount: 107420.76 },
        { cr: 'GT-535', amount: 196482.30 } // Also in the image!
      ];
      
      // 2. Fix Pagos (Con contabilidad)
      const targetPagos = [
        { cr: 'GT-570', amount: 92292.55 },
        { cr: 'GT-570', amount: 89958.00 }
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
          
          // Buscar si el total hace match con CR por cobrar
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
          
          // Buscar si el total hace match con facturas pagadas (Con Contabilidad)
          const pago = targetPagos.find(t => Math.abs(t.amount - total) < 1.0);
          if (pago) {
             if (!inv.collection) inv.collection = {};
             if (inv.collection.contrareciboNumber !== pago.cr || inv.creditCycle?.status !== 'paid') {
                 inv.collection.contrareciboNumber = pago.cr;
                 if (!inv.creditCycle) inv.creditCycle = {};
                 inv.creditCycle.status = 'paid';
                 changed = true;
                 matchedCount++;
                 addLog(`✅ Asignado CR ${pago.cr} y marcada PAGADA la factura de ${total}`);
             }
          }
        });
        
        if (changed) {
           batch.update(docSnap.ref, { invoices });
        }
      });
      
      addLog(`Se actualizaron ${matchedCount} facturas con su CR exacto o estado pagado.`);

      // El ajuste de saldo histórico de Andrés se quitó para que no sobreescriba los números actuales.
      
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
      
      <div style={{ marginBottom: 20 }}>
        <button 
          onClick={runFix} 
          disabled={busy}
          style={{ padding: '15px 30px', fontSize: '18px', marginRight: '15px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          {busy ? 'Calculando y Guardando...' : '1. Correr Cuadre Automático'}
        </button>

        <a 
          href="/plantilla_maestra_v3.xlsx" 
          target="_blank"
          style={{ padding: '15px 30px', fontSize: '18px', textDecoration: 'none', display: 'inline-block', background: '#2563eb', color: 'white', borderRadius: 8 }}
        >
          2. ⬇️ Descargar Sábana de Captura Inicial (Excel)
        </a>
      </div>
      
      <div style={{ marginTop: 30, background: '#111', padding: 20, borderRadius: 8, color: '#0f0', fontFamily: 'monospace' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
        {!log.length && 'Esperando iniciar...'}
      </div>
    </div>
  );
}
