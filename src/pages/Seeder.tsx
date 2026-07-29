import { useState } from 'react';
import { collection, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useConfig } from '../hooks/useConfig';
import { computeFinancials } from '../lib/finance';
import type { PurchaseOrder } from '../lib/types';

const facturasRaw = `
1	GTP930115PU1	120267113902	4.0	I	6098	2026-07-27T10:14:53	27/Julio/2026	27,260.00
2	GTP930115PU1	120267113870	4.0	I	6097	2026-07-27T10:13:06	27/Julio/2026	109,040.00
3	GTP930115PU1	120267113870	4.0	I	6084	2026-07-20T10:44:36	20/Julio/2026	106,720.17
4	GTP930115PU1	12026439648	4.0	I	6073	2026-07-15T11:46:12	15/Julio/2026	54,520.00
5	GTP930115PU1	120267113870	4.0	I	6054	2026-07-13T10:36:17	13/Julio/2026	136,300.00
6	GTP930115PU1	12026439648	4.0	I	6053	2026-07-08T11:41:11	08/Julio/2026	69,001.60
7	GTP930115PU1	120267113870	4.0	I	6034	2026-07-06T11:54:20	06/Julio/2026	27,118.25
8	GTP930115PU1	120267113780	4.0	I	6033	2026-07-06T11:52:10	06/Julio/2026	98,136.00
9	GTP930115PU1	120267113780	4.0	I	5996	2026-06-29T10:28:47	29/Junio/2026	109,040.00
10	GTP930115PU1	12026439627	4.0	I	5971	2026-06-22T11:54:10	22/Junio/2026	106,477.56
11	GTP930115PU1	120267113780	4.0	I	5970	2026-06-22T11:50:15	22/Junio/2026	108,647.46
12	GTP930115PU1	12026439621	4.0	I	5955	2026-06-19T10:04:47	19/Junio/2026	98,136.00
13	GTP930115PU1	120267113780	4.0	I	5950	2026-06-16T15:35:02	16/Junio/2026	80,970.38
14	GTP930115PU1	12026439591	4.0	I	5936	2026-06-08T11:22:42	08/Junio/2026	52,900.76
15	GTP930115PU1	12026439592	4.0	I	5935	2026-06-08T11:20:29	08/Junio/2026	54,520.00
16	GTP930115PU1	120267113780	4.0	I	5932	2026-06-05T09:24:43	05/Junio/2026	54,520.00
17	GTP930115PU1	120267113804	4.0	I	5931	2026-06-05T09:23:03	05/Junio/2026	27,260.00
18	GTP930115PU1	12026439591	4.0	I	5928	2026-06-02T13:06:52	02/Junio/2026	89,958.00
19	GTP930115PU1	12026439592	4.0	I	5927	2026-06-02T12:24:37	02/Junio/2026	92,292.55
20	GTP930115PU1	12026439550	4.0	I	5877	2026-05-26T11:23:40	26/Mayo/2026	87,180.26
21	GTP930115PU1	12026439550	4.0	I	5876	2026-05-26T11:23:40	26/Mayo/2026	109,302.04
`;

const crsRaw = `
1	TH-836	27/07/2026	26/08/2026	106,720.17
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
12	GT-535	01/06/2026	01/07/2026	196,482.30
`;

export default function Seeder() {
  const { config } = useConfig();
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleRun = async () => {
    if (!window.confirm("¡CUIDADO! Esto borrará TODAS las Órdenes de Compra actuales y las reemplazará por la lista maestra. ¿Continuar?")) return;
    setRunning(true);
    setLog([]);
    try {
      addLog("Limpiando colección purchaseOrders...");
      const snap = await getDocs(collection(db, PATHS.orders));
      let batch = writeBatch(db);
      let count = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count % 400 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      await batch.commit();
      addLog(`Eliminados ${count} expedientes antiguos.`);

      // Procesar datos
      const facturas = facturasRaw.trim().split('\n').map(line => {
        const p = line.split('\t').map(s => s.trim());
        const [y, m, d] = p[6].split('T')[0].split('-');
        return {
          oc: p[2],
          folio: p[5],
          date: new Date(parseInt(y), parseInt(m)-1, parseInt(d)),
          amount: parseFloat(p[8].replace(/,/g, '')),
          contrarecibo: '',
          dueDate: null as Date | null,
        };
      });

      const crs = crsRaw.trim().split('\n').map(line => {
        const p = line.split('\t').map(s => s.trim());
        const [d, m, y] = p[3].split('/');
        return {
          folio: p[1],
          dueDate: new Date(parseInt(y), parseInt(m)-1, parseInt(d)),
          amount: parseFloat(p[4].replace(/,/g, ''))
        };
      });

      // Match Facturas to CRs
      let unassigned = [...facturas];
      for (const cr of crs) {
        let match = unassigned.find(f => Math.abs(f.amount - cr.amount) < 0.01);
        if (match) {
          match.contrarecibo = cr.folio;
          match.dueDate = cr.dueDate;
          unassigned = unassigned.filter(f => f !== match);
          continue;
        }
        let found = false;
        for (let i = 0; i < unassigned.length; i++) {
          for (let j = i+1; j < unassigned.length; j++) {
            if (Math.abs(unassigned[i].amount + unassigned[j].amount - cr.amount) < 0.01) {
              unassigned[i].contrarecibo = cr.folio;
              unassigned[i].dueDate = cr.dueDate;
              unassigned[j].contrarecibo = cr.folio;
              unassigned[j].dueDate = cr.dueDate;
              unassigned = unassigned.filter(f => f !== unassigned[i] && f !== unassigned[j]);
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }


      // Agrupar por Contrarecibo (o por folio individual si no tiene CR)
      const ordersByCR = new Map<string, any[]>();
      for (const f of facturas) {
        const key = f.contrarecibo || `SIN-CR-${f.folio}`;
        if (!ordersByCR.has(key)) ordersByCR.set(key, []);
        ordersByCR.get(key)!.push(f);
      }

      addLog(`Se generarán ${ordersByCR.size} expedientes (${crs.length} con CR + ${facturas.filter(f => !f.contrarecibo).length} sin CR).`);


      batch = writeBatch(db);
      
      Array.from(ordersByCR.entries()).forEach(([crKey, invs]) => {
        const totalAmount = invs.reduce((sum, i) => sum + i.amount, 0);
        const totalKilos = totalAmount / 54.52;
        const issueDate = invs[0].date;
        // Si tiene CR, usar la dueDate del CR; si no, 30 días desde emisión
        const crDueDate = invs[0].dueDate;
        const defaultDueDate = crDueDate || (() => {
          const d = new Date(issueDate);
          d.setDate(d.getDate() + 30);
          return d;
        })();
        // El folio del expediente es el número del CR (ej: TH-836) o el folio de la factura
        const expedienteFolio = invs[0].contrarecibo || invs[0].folio;

        const newOrder: PurchaseOrder = {
          id: crKey,
          folio: expedienteFolio,
          client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          fileName: 'MIGRACION_MAESTRA',
          totalKilograms: totalKilos,
          financials: computeFinancials(totalKilos, config),
          creditCycle: {
            status: 'pending',
            issueDate: Timestamp.fromDate(issueDate),
            dueDate: Timestamp.fromDate(defaultDueDate),
          },
          invoices: invs.map((inv, idx) => {
            const invKilos = inv.amount / 54.52;
            const invFin = computeFinancials(invKilos, config);
            return {
              id: `${crKey}-inv-${idx}`,
              folio: inv.folio,
              oc: inv.oc,
              kilos: invKilos,
              financials: {
                ...invFin,
                invoiceTotal: inv.amount
              },
              creditCycle: {
                status: 'pending',
                issueDate: Timestamp.fromDate(inv.date),
                dueDate: Timestamp.fromDate(defaultDueDate),
              },
              collection: {
                contrareciboNumber: inv.contrarecibo || ''
              }
            };
          }),
          processedAt: Timestamp.fromDate(issueDate),
          updatedAt: Timestamp.fromDate(new Date()),
        };

        const ref = doc(db, PATHS.orders, crKey);
        batch.set(ref, newOrder);
      });


      await batch.commit();
      addLog("¡Migración completada con éxito! La cobranza ahora es perfecta.");
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <h1>Sincronización Maestra</h1>
      <p>Este botón borrará TODA la base de datos de Órdenes y la volverá a construir exactamente como la lista que proporcionaste.</p>
      
      <button 
        onClick={handleRun} 
        disabled={running}
        style={{ padding: '16px 32px', fontSize: 18, background: 'var(--bad)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}
      >
        {running ? "Procesando..." : "BORRAR TODO E INYECTAR LISTA MAESTRA"}
      </button>

      <div style={{ marginTop: 24, background: '#1e1e1e', color: '#0f0', padding: 16, borderRadius: 8, minHeight: 200, fontFamily: 'monospace' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
        {log.length === 0 && <div>Esperando...</div>}
      </div>
    </div>
  );
}
