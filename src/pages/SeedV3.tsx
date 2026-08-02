import { useState } from 'react';
import { collection, doc, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';

export default function SeedV3() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const handleSeed = async () => {
    if (!window.confirm("¡PELIGRO! Esto borrará TODA la base de datos actual (Pedidos, Gastos, Compras) y cargará el histórico V3. ¿Estás absolutamente seguro?")) return;
    
    setBusy(true);
    try {
      const batch = writeBatch(db);

      // 1. WIPE
      for (const col of [PATHS.orders, PATHS.expenses, PATHS.purchases, PATHS.products]) {
        const snap = await getDocs(collection(db, col));
        snap.forEach(d => batch.delete(d.ref));
      }

      // 2. CAJA CHICA
      const expensesRef = collection(db, PATHS.expenses);
      batch.set(doc(expensesRef), {
        concept: 'ANTICIPO A ANDRES',
        type: 'salida',
        amount: 145000,
        date: Timestamp.fromDate(new Date('2026-07-23T12:00:00')),
        category: 'Pago Maquilador', // Critical so it discounts from Andres' debt
        createdAt: Timestamp.now()
      });
      batch.set(doc(expensesRef), {
        concept: 'Recibimos dinero',
        type: 'ingreso',
        amount: 76140,
        date: Timestamp.fromDate(new Date('2026-07-23T12:00:00')),
        createdAt: Timestamp.now()
      });

      // 3. COMPRAS
      const purchasesRef = collection(db, PATHS.purchases);
      batch.set(doc(purchasesRef), {
        provider: 'Bolsas y Empaques SA',
        folio: 'F-9901',
        invoiceDate: Timestamp.fromDate(new Date('2026-07-25T12:00:00')),
        dueDate: Timestamp.fromDate(new Date('2026-08-25T12:00:00')),
        subtotal: 10000,
        iva: 1600,
        total: 11600,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      // 4. COBRANZA & HISTORICO ANDRES
      const ordersRef = collection(db, PATHS.orders);
      
      // We will put all Cobranza under a single "Histórico" Order for simplicity,
      // EXCEPT that each invoice might have its own OC number.
      // Wait, Paco's invoices have different Folio_OC, so let's create one Order per OC.
      // But for simplicity, we can create one massive "MIGRACIÓN HISTÓRICA" order.
      // Actually, since he tracks OC, let's group by OC or just create individual orders.
      
      // Let's create the Historic Order for Andres to get his 102k debt.
      // 247,670.28 / 3.80 = 65176.38947368421
      const histOrderRef = doc(ordersRef);
      batch.set(histOrderRef, {
        folio: 'HIST-001',
        client: 'MIGRACION',
        totalKilograms: 65176.39,
        items: [{
          id: 'item1',
          description: 'Histórico Andrés',
          kilos: 65176.39,
          unitPrice: 0,
        }],
        deliveries: [{
          id: 'del1',
          date: Timestamp.now(),
          kilos: 65176.39,
          items: [{ itemId: 'item1', qty: 65176.39 }],
          status: 'facturada' // So it counts for Andres
        }],
        invoices: [],
        createdAt: Timestamp.now()
      });

      // Now create Orders for the invoices
      const invoicesData = [
        { c: 'Providencia', oc: 'OC-HIST', f: '5927', d: '27/07/2026', vd: '26/08/2026', t: 92292.55, st: 'paid', cr: 'GT-570' },
        { c: 'Providencia', oc: 'OC-HIST', f: '5928', d: '27/07/2026', vd: '26/08/2026', t: 89958.00, st: 'paid', cr: 'GT-570' },
        { c: 'Providencia', oc: '120267114014', f: '6098', d: '27/07/2026', vd: '26/08/2026', t: 27260.00, st: 'issued', cr: '' },
        { c: 'Providencia', oc: '120267114014', f: '6097', d: '27/07/2026', vd: '26/08/2026', t: 109040.00, st: 'issued', cr: '' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '27/07/2026', vd: '26/08/2026', t: 106720.17, st: 'issued', cr: 'TH-836' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '20/07/2026', vd: '19/08/2026', t: 54520.00, st: 'issued', cr: 'GT-742' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '20/07/2026', vd: '19/08/2026', t: 136300.00, st: 'issued', cr: 'TH-804' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '13/07/2026', vd: '12/08/2026', t: 69001.60, st: 'issued', cr: 'GT-713' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '13/07/2026', vd: '12/08/2026', t: 125254.25, st: 'issued', cr: 'TH-768' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '06/07/2026', vd: '05/08/2026', t: 109040.00, st: 'issued', cr: 'TH-739' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '29/06/2026', vd: '29/07/2026', t: 106477.56, st: 'issued', cr: 'GT-651' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '29/06/2026', vd: '29/07/2026', t: 108647.46, st: 'issued', cr: 'TH-713' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '22/06/2026', vd: '22/07/2026', t: 98136.00, st: 'issued', cr: 'GT-624' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '22/06/2026', vd: '22/07/2026', t: 80970.38, st: 'issued', cr: 'TH-680' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '15/06/2026', vd: '15/07/2026', t: 107420.76, st: 'issued', cr: 'GT-597' },
        { c: 'Providencia', oc: 'OC-CR', f: '', d: '01/06/2026', vd: '01/07/2026', t: 196482.30, st: 'issued', cr: 'GT-535' },
      ];

      // Group by OC
      const grouped = invoicesData.reduce((acc, i) => {
        if (!acc[i.oc]) acc[i.oc] = [];
        acc[i.oc].push(i);
        return acc;
      }, {} as any);

      for (const oc of Object.keys(grouped)) {
        const oRef = doc(ordersRef);
        const invs = grouped[oc].map((i: any, idx: number) => {
          const dtParts = i.d.split('/');
          const dt = new Date(`${dtParts[2]}-${dtParts[1]}-${dtParts[0]}T12:00:00`);
          const vdParts = i.vd.split('/');
          const vdueDate = new Date(`${vdParts[2]}-${vdParts[1]}-${vdParts[0]}T12:00:00`);
          return {
            id: `inv-${idx}`,
            folio: i.f,
            kilos: 0,
            deliveryIds: [],
            createdAt: Timestamp.fromDate(dt),
            financials: {
              invoiceTotal: i.t,
              commission: 0,
              costTotal: 0
            },
            creditCycle: {
              status: i.st,
              dueDate: Timestamp.fromDate(vdueDate)
            },
            collection: {
              contrareciboNumber: i.cr || '',
              paidAmount: i.st === 'paid' ? i.t : 0
            }
          };
        });

        batch.set(oRef, {
          folio: `PED-${oc}`,
          client: 'Providencia',
          oc: oc,
          totalKilograms: 0,
          items: [],
          deliveries: [],
          invoices: invs,
          createdAt: Timestamp.now()
        });
      }

      await batch.commit();
      toast('¡Inyección de datos V3 completada exitosamente!', 'ok');

      // Add purchases to Andres based on historical delivery (Wait, no, the historical delivery in the order will automatically be aggregated in the Dashboard/ControlCenter logic!).
      // Wait, in Dashboard: 
      // const totalDeliveredByAndres = orders.reduce(...)
      // So putting the delivery inside the HIST-001 order is enough!

    } catch (e: any) {
      toast('Error: ' + e.message, 'bad');
    }
    setBusy(false);
  };

  return (
    <div className="page" style={{ padding: 40, textAlign: 'center' }}>
      <h1>Módulo de Inyección V3</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Este botón borrará toda la información actual (excepto usuarios y configuración) y cargará la sábana histórica completa (Providencia, Andrés, Compras y Caja).
      </p>
      <button 
        className="btn btn-primary" 
        style={{ marginTop: 20, fontSize: 20, padding: '16px 32px' }} 
        onClick={handleSeed}
        disabled={busy}
      >
        {busy ? 'Inyectando...' : 'ARRANCAR INYECCIÓN'}
      </button>
    </div>
  );
}
