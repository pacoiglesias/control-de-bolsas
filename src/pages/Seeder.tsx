import { useState } from 'react';
import { collection, doc, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useConfig } from '../hooks/useConfig';
import { computeFinancials } from '../lib/finance';
import type { PurchaseOrder } from '../lib/types';

export default function Seeder() {
  const { config } = useConfig();
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [rawData, setRawData] = useState(`1	TH-836	27/07/2026	26/08/2026	106,720.17
2	GT-742	20/07/2026	19/08/2026	54,520.00
3	TH-804	20/07/2026	19/08/2026	136,300.00
4	GT-713	13/07/2026	12/08/2026	69,001.60
5	TH-768	13/07/2026	12/08/2026	125,254.25
6	TH-739	06/07/2026	05/08/2026	109,040.00
7	GT-651	29/06/2026	29/07/2026	106,477.56
8	TH-713	29/06/2026	29/07/2026	108,647.46
9	GT-624	22/06/2026	22/07/2026	98,136.00
10	TH-680	22/06/2026	22/07/2026	80,970.38
11	GT-597	15/06/2026	15/07/2026	107,420.76
12	GT-535	01/06/2026	01/07/2026	196,482.30`);

  const [facturasData, setFacturasData] = useState(`1	GTP930115PU1	120267113902	4.0	I	6098	2026-07-27T10:14:53	27/Julio/2026	27,260.00
2	GTP930115PU1	120267113870	4.0	I	6097	2026-07-27T10:13:06	27/Julio/2026	109,040.00`);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleRun = async () => {
    const word = window.prompt("⚠️ PELIGRO ⚠️\nEsto borrará TODAS las órdenes, facturas y flujo de caja (Caja Chica).\n\nPara continuar, escribe exactamente la palabra: PROVIDENCIA");
    if (word !== "PROVIDENCIA") {
      alert("Palabra de seguridad incorrecta. Operación cancelada.");
      return;
    }
    
    setRunning(true);
    setLog([]);
    try {
      addLog("Iniciando borrado maestro...");
      
      let batch = writeBatch(db);
      const ordersSnap = await getDocs(collection(db, PATHS.orders));
      let count = 0;
      ordersSnap.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });
      await batch.commit();
      addLog(`Eliminados ${count} expedientes de ventas.`);

      batch = writeBatch(db);
      const expensesSnap = await getDocs(collection(db, PATHS.expenses));
      count = 0;
      expensesSnap.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });
      await batch.commit();
      addLog(`Eliminados ${count} registros de Caja Chica.`);

      addLog("Sistema en cero. Analizando datos ingresados...");
      
      // Parsear Contrarecibos
      const crs = rawData.trim().split('\n').filter(Boolean).map(line => {
        const p = line.split('\t').map(s => s.trim());
        if(p[0].toLowerCase() === 'no' || p[0].toLowerCase() === 'no.') return null;
        if(p.length < 5) return null;
        
        const date1 = p[2].split('/');
        const date2 = p[3].split('/');
        
        const issueDate = date1.length === 3 ? new Date(parseInt(date1[2]), parseInt(date1[1])-1, parseInt(date1[0])) : new Date();
        const dueDate = date2.length === 3 ? new Date(parseInt(date2[2]), parseInt(date2[1])-1, parseInt(date2[0])) : new Date();

        return {
          folio: p[1],
          issueDate,
          dueDate,
          amount: parseFloat(p[4].replace(/,/g, '').replace(/\$/g, ''))
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null && !isNaN(item.amount));

      // Parsear Facturas Pendientes
      const facturas = facturasData.trim().split('\n').filter(Boolean).map(line => {
        const p = line.split('\t').map(s => s.trim());
        if(p[0].toLowerCase() === 'no' || p[0].toLowerCase() === 'no.') return null;
        if(p.length < 9) return null;
        
        return {
          folio: p[5],
          oc: p[2],
          amount: parseFloat(p[8].replace(/,/g, '').replace(/\$/g, '')),
          date: new Date(p[6])
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null && !isNaN(item.amount));

      addLog(`Se detectaron ${crs.length} contrarecibos y ${facturas.length} facturas pendientes.`);
      batch = writeBatch(db);
      
      // Inyectar Contrarecibos
      crs.forEach((cr) => {
        const totalKilos = cr.amount / 54.52; 
        const crKey = `CR-${cr.folio}`;

        const newOrder: PurchaseOrder = {
          id: crKey,
          folio: cr.folio,
          client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          fileName: 'MIGRACION_MAESTRA',
          totalKilograms: totalKilos,
          financials: computeFinancials(totalKilos, config),
          creditCycle: {
            status: 'pending',
            issueDate: Timestamp.fromDate(cr.issueDate),
            dueDate: Timestamp.fromDate(cr.dueDate),
          },
          invoices: [{
            id: `${crKey}-inv-0`,
            folio: `FACT-${cr.folio}`,
            oc: 'MIGRACION',
            kilos: totalKilos,
            financials: { ...computeFinancials(totalKilos, config), invoiceTotal: cr.amount },
            creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(cr.issueDate), dueDate: Timestamp.fromDate(cr.dueDate) },
            collection: { contrareciboNumber: cr.folio }
          }],
          processedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        batch.set(doc(db, PATHS.orders, crKey), newOrder);
      });

      // Inyectar Facturas Pendientes
      if (facturas.length > 0) {
        const totalAmountFacturas = facturas.reduce((sum, f) => sum + f.amount, 0);
        const totalKilosFacturas = totalAmountFacturas / 54.52;
        const crKey = `PENDIENTES`;

        const pendingOrder: PurchaseOrder = {
          id: crKey,
          folio: 'PENDIENTES',
          client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          fileName: 'FACTURAS_SIN_CR',
          totalKilograms: totalKilosFacturas,
          financials: computeFinancials(totalKilosFacturas, config),
          creditCycle: {
            status: 'pending',
            issueDate: Timestamp.now(),
            dueDate: Timestamp.now(),
          },
          invoices: facturas.map((f, i) => ({
            id: `${crKey}-inv-${i}`,
            folio: `FACT-${f.folio}`,
            oc: f.oc,
            kilos: f.amount / 54.52,
            financials: { ...computeFinancials(f.amount / 54.52, config), invoiceTotal: f.amount },
            creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(isNaN(f.date.getTime()) ? new Date() : f.date), dueDate: Timestamp.fromDate(isNaN(f.date.getTime()) ? new Date() : f.date) },
            collection: { contrareciboNumber: '' }
          })),
          processedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        batch.set(doc(db, PATHS.orders, crKey), pendingOrder);
      }

      await batch.commit();
      addLog("✅ Migración completada con éxito. Revisar panel de Cobranza.");
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`);
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <h1>Sincronización Maestra Editable (Reset)</h1>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px' }}>
          <p><strong>1. CONTRARECIBOS (CR)</strong><br/>(5 columnas: Num, CR, Fecha, Vencimiento, Monto).</p>
          <textarea 
            style={{ width: '100%', height: 250, fontFamily: 'monospace', padding: 12, marginBottom: 20 }}
            value={rawData} 
            onChange={(e) => setRawData(e.target.value)} 
          />
        </div>

        <div style={{ flex: '1 1 400px' }}>
          <p><strong>2. FACTURAS PENDIENTES SIN CR</strong><br/>(9 columnas: Num, RFC, OC, etc... Total al final)</p>
          <textarea 
            style={{ width: '100%', height: 250, fontFamily: 'monospace', padding: 12, marginBottom: 20 }}
            value={facturasData} 
            onChange={(e) => setFacturasData(e.target.value)} 
          />
        </div>
      </div>

      <button 
        onClick={handleRun} 
        disabled={running}
        style={{ padding: '16px 32px', fontSize: 18, background: 'var(--bad)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
      >
        {running ? "Procesando..." : "BORRAR TODO E INYECTAR DATOS"}
      </button>

      <div style={{ marginTop: 40, background: '#f5f5f5', padding: 20, borderRadius: 8, fontFamily: 'monospace' }}>
        <h3>Log de Operaciones:</h3>
        {log.map((l, i) => (
          <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #ddd' }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
