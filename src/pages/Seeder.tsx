import { useState } from 'react';
import { collection, doc, writeBatch, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { db, PATHS, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useConfig } from '../hooks/useConfig';
import { computeFinancials } from '../lib/finance';
import type { PurchaseOrder } from '../lib/types';

import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

// Proveedores conocidos del negocio, para detectar automaticamente a quien
// corresponde un movimiento de CAJA por su concepto (ver migracion mas
// abajo). Lista corta y explicita a proposito: mejor pedirle al usuario que
// la actualice si aparece un proveedor nuevo, que adivinar con logica mas
// compleja sobre texto libre.
const PROVIDER_NAMES = ['Andres'];

export default function Seeder() {
  const { role } = useAuth();
  const { config, loading: configLoading } = useConfig();
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

  // Contrarecibos YA PAGADOS por el cliente, cuyo dinero todavia tiene el
  // contador. Van con estatus 'paid': el sistema los muestra en "Por Recibir
  // del Contador" con el deposito neto (factura menos su 8%).
  // Columnas: CR, Fecha pago, Importe, Referencia de transferencia
  const [pagadosData, setPagadosData] = useState(`GT-570	27/07/2026	182250.55	TR_3583`);

  // Saldo inicial y movimientos de Caja Chica. Importe NEGATIVO = egreso.
  // Columnas: Concepto, Importe
  const [cajaData, setCajaData] = useState(`Saldo inicial	-819.44
Pago recibido de cliente	144945.00
Adelanto a Andres 21 julio	-145000.00
Pago recibido 23 julio	76140.00`);

  const [facturasData, setFacturasData] = useState(`1	GTP930115PU1	120267113902	4.0	I	6098	2026-07-27T10:14:53	27/Julio/2026	27,260.00
2	GTP930115PU1	120267113870	4.0	I	6097	2026-07-27T10:13:06	27/Julio/2026	109,040.00`);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  /**
   * Reparacion de un solo uso: los movimientos de CAJA migrados antes del
   * Ciclo 30 no tenian `provider`, aunque su concepto mencionara a Andres
   * (ej. "Adelanto a Andres 21 julio"). Eso los hacia invisibles para el
   * "Estado de Cuenta" de Compras, que filtra por ese campo — el saldo con
   * Andres salia mal por el monto completo del movimiento perdido.
   * No toca nada mas: solo completa un campo que faltaba.
   */
  const [reparando, setReparando] = useState(false);
  const handleRepararProveedores = async () => {
    setReparando(true);
    setLog([]);
    try {
      addLog('Buscando movimientos de CAJA sin proveedor asignado…');
      const snap = await getDocs(collection(db, PATHS.expenses));
      const sinProveedor = snap.docs.filter((d) => {
        const data = d.data();
        return !data.provider;
      });
      addLog(`${sinProveedor.length} movimientos sin proveedor de ${snap.size} totales.`);

      let reparados = 0;
      for (const d of sinProveedor) {
        const concept: string = d.data().concept || '';
        const proveedorDetectado = PROVIDER_NAMES.find((p) => concept.toLowerCase().includes(p.toLowerCase()));
        if (proveedorDetectado) {
          await updateDoc(doc(db, PATHS.expenses, d.id), { provider: proveedorDetectado });
          addLog(`  ✓ "${concept}" → proveedor: ${proveedorDetectado}`);
          reparados++;
        }
      }
      addLog(`✅ Reparados ${reparados} movimientos. Los demás sin proveedor no mencionan a ningún proveedor conocido en su concepto — se dejaron igual.`);
    } catch (e) {
      addLog(`⚠️ Error: ${(e as Error).message}`);
    } finally {
      setReparando(false);
    }
  };

  const [reparandoDepts, setReparandoDepts] = useState(false);
  const handleRepararDepartamentos = async () => {
    setReparandoDepts(true);
    setLog([]);
    try {
      addLog('Buscando expedientes sin departamento asignado (TH/GT)…');
      const snap = await getDocs(collection(db, PATHS.orders));
      let reparados = 0;
      
      for (const d of snap.docs) {
        const data = d.data();
        if (!data.department) {
          const folio = (data.folio || "").toUpperCase();
          let newDept = "";
          if (folio.includes("TH")) newDept = "TH";
          else if (folio.includes("GT")) newDept = "GT";
          
          if (newDept) {
            await updateDoc(doc(db, PATHS.orders, d.id), { department: newDept });
            addLog(`  ✓ Expediente ${folio} → Departamento: ${newDept}`);
            reparados++;
          }
        }
      }
      addLog(`✅ Reparados ${reparados} expedientes. RECUERDA IR AL DASHBOARD Y PRESIONAR "Recalcular Indicadores".`);
    } catch (e) {
      addLog(`⚠️ Error: ${(e as Error).message}`);
    } finally {
      setReparandoDepts(false);
    }
  };

  const handleRun = async () => {
    const word = window.prompt("⚠️ PELIGRO ⚠️\nEsto borrará TODAS las órdenes, facturas y flujo de caja (CAJA).\n\nPara continuar, escribe exactamente la palabra: PROVIDENCIA");
    if (word !== "PROVIDENCIA") {
      alert("Palabra de seguridad incorrecta. Operación cancelada.");
      return;
    }
    
    setRunning(true);
    setLog([]);
    try {
      addLog("Iniciando borrado maestro...");
      
      const deleteInBatches = async (collName: string) => {
        const snap = await getDocs(collection(db, collName));
        let count = 0;
        let batch = writeBatch(db);
        let batchSize = 0;
        for (const docSnap of snap.docs) {
          batch.delete(docSnap.ref);
          count++;
          batchSize++;
          if (batchSize >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            batchSize = 0;
          }
        }
        if (batchSize > 0) {
          await batch.commit();
        }
        return count;
      };

      const countOrders = await deleteInBatches(PATHS.orders);
      addLog(`Eliminados ${countOrders} expedientes de ventas.`);

      const countExpenses = await deleteInBatches(PATHS.expenses);
      addLog(`Eliminados ${countExpenses} registros de CAJA.`);

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

      // Los importes de contrarecibos y facturas vienen CON IVA. El precio de
      // la configuracion (salePricePerKg) es el SUBTOTAL: 47.00 sin IVA, que
      // con el 16% da los 54.52 por kilo que aparecen en los documentos.
      // Dividir el importe bruto entre el precio neto inflaba los kilos un 16%.
      const precioBrutoPorKg = config.salePricePerKg * (1 + config.ivaRate);
      if (!(precioBrutoPorKg > 0)) {
        throw new Error('La configuración financiera no tiene un precio de venta válido.');
      }
      addLog(`Precio por kilo con IVA: ${precioBrutoPorKg.toFixed(2)} (${config.salePricePerKg} + ${(config.ivaRate * 100).toFixed(0)}%)`);
      const batch = writeBatch(db);
      
      // Inyectar Contrarecibos
      crs.forEach((cr) => {
        // Precio de la configuracion, no un 54.52 incrustado: si algun dia
        // cambia el precio de venta, la migracion seguia derivando kilos con
        // el valor viejo y los importes salian corridos sin avisar.
        const totalKilos = cr.amount / precioBrutoPorKg;
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
          // invoiceStatuses es el arreglo desnormalizado que sostiene las
          // consultas array-contains-any del Dashboard y de Cobranza, y la del
          // barrido nocturno. El Seeder NUNCA lo escribia: los expedientes se
          // creaban correctamente en Firestore pero eran invisibles para todas
          // esas pantallas. Por eso "cargaba" y no se veia nada.
          invoiceStatuses: ['pending'],
          processedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        batch.set(doc(db, PATHS.orders, crKey), newOrder);
      });

      // Inyectar Facturas Pendientes
      if (facturas.length > 0) {
        const totalAmountFacturas = facturas.reduce((sum, f) => sum + f.amount, 0);
        const totalKilosFacturas = totalAmountFacturas / precioBrutoPorKg;
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
            kilos: f.amount / precioBrutoPorKg,
            financials: { ...computeFinancials(f.amount / precioBrutoPorKg, config), invoiceTotal: f.amount },
            // dueDate en null a proposito: estas facturas estan EN REVISION,
            // todavia sin contrarecibo. El plazo de credito arranca cuando
            // Providencia emite el CR, no al enviar la factura. Antes se
            // guardaba dueDate = fecha de emision, y eso las hacia aparecer
            // como vencidas al dia siguiente, inflando "Vencido" por el
            // monto completo de las facturas aun sin contrarecibo.
            creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(isNaN(f.date.getTime()) ? new Date() : f.date), dueDate: null },
            collection: { contrareciboNumber: '' }
          })),
          invoiceStatuses: facturas.map(() => 'pending'),
          processedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        batch.set(doc(db, PATHS.orders, crKey), pendingOrder);
      }

      // --- Contrarecibos ya pagados (dinero con el contador) ---
      const pagados = pagadosData.trim().split('\n').filter(Boolean).map(line => {
        const p = line.split('\t').map(x => x.trim());
        if (p.length < 3) return null;
        const f = p[1].split('/');
        const fecha = f.length === 3
          ? new Date(parseInt(f[2]), parseInt(f[1]) - 1, parseInt(f[0]))
          : new Date();
        return {
          cr: p[0],
          fecha,
          amount: parseFloat(p[2].replace(/,/g, '').replace(/\$/g, '')),
          ref: p[3] ?? '',
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null && !isNaN(x.amount));

      pagados.forEach((pg) => {
        const kilosPg = pg.amount / precioBrutoPorKg;
        const key = `CR-${pg.cr}`;
        const fin = { ...computeFinancials(kilosPg, config), invoiceTotal: pg.amount };
        const ord: PurchaseOrder = {
          id: key,
          folio: pg.cr,
          client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
          fileName: 'MIGRACION_PAGADOS',
          totalKilograms: kilosPg,
          financials: fin,
          creditCycle: {
            status: 'paid',
            issueDate: Timestamp.fromDate(pg.fecha),
            dueDate: Timestamp.fromDate(pg.fecha),
          },
          invoices: [{
            id: `${key}-inv-0`,
            folio: pg.cr,
            oc: 'MIGRACION',
            kilos: kilosPg,
            financials: fin,
            creditCycle: {
              status: 'paid',
              issueDate: Timestamp.fromDate(pg.fecha),
              dueDate: Timestamp.fromDate(pg.fecha),
            },
            // paidAmount = importe completo: el cliente pago la factura entera.
            // Lo que descuenta el contador se refleja al pasar a 'collected'.
            collection: {
              contrareciboNumber: pg.cr,
              contrareciboDate: Timestamp.fromDate(pg.fecha),
              paidAmount: pg.amount,
              paidAt: Timestamp.fromDate(pg.fecha),
              complementStatus: 'issued',
              notes: pg.ref ? `Transferencia ${pg.ref}` : '',
            },
          }],
          invoiceStatuses: ['paid'],
          processedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        batch.set(doc(db, PATHS.orders, key), ord);
      });

      // --- Saldo inicial y movimientos de Caja Chica ---
      const movs = cajaData.trim().split('\n').filter(Boolean).map(line => {
        const p = line.split('\t').map(x => x.trim());
        if (p.length < 2) return null;
        return {
          concepto: p[0],
          monto: parseFloat(p[1].replace(/,/g, '').replace(/\$/g, '')),
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null && !isNaN(x.monto));

      movs.forEach((m, i) => {
        // El concepto se cruza contra los proveedores ya conocidos (deriva
        // de los mismos expedientes, igual que knownProviders en
        // OrderModal.tsx). Sin esto, un movimiento como "Adelanto a Andres
        // 21 julio" se guardaba SIN provider — afectaba el saldo general de
        // CAJA correctamente, pero era invisible para el "Estado de Cuenta"
        // de ese proveedor especifico, que filtra por ese campo exacto.
        const proveedorDetectado = PROVIDER_NAMES.find((p) => m.concepto.toLowerCase().includes(p.toLowerCase()));
        batch.set(doc(collection(db, PATHS.expenses)), {
          date: Timestamp.now(),
          concept: m.concepto,
          // Importe negativo en la captura = egreso. En Firestore el monto
          // siempre va positivo y el signo lo lleva el campo `type`.
          type: m.monto < 0 ? 'egreso' : 'ingreso',
          amount: Math.abs(m.monto),
          provider: proveedorDetectado || null,
          notes: `Migración inicial (renglón ${i + 1})`,
          createdAt: Timestamp.now(),
        });
      });

      await batch.commit();
      addLog(`Migrados ${crs.length} contrarecibos, ${facturas.length} facturas, ${pagados.length} pagados con contabilidad y ${movs.length} movimientos de CAJA.`);

      // Recalcular indicadores AQUI mismo. syncDashboardStats solo reacciona a
      // escrituras posteriores a su despliegue y ademas ignora los writeBatch
      // que acaban de correr si el documento de stats nunca existio: sin este
      // paso, la migracion terminaba "con exito" y el panel seguia en ceros,
      // obligando a ir a buscar el boton de recalcular a mano.
      addLog("Recalculando indicadores del panel…");
      try {
        const recalc = httpsCallable<unknown, { procesados: number }>(functions, 'recalcDashboardStats');
        const res = await recalc({});
        addLog(`✅ Indicadores recalculados sobre ${res.data.procesados} expedientes.`);
      } catch (e) {
        addLog(`⚠️ Los datos se migraron bien, pero fallo el recalculo: ${(e as Error).message}`);
        addLog("   Puedes recalcular a mano desde el boton del panel principal.");
      }

      addLog("✅ Migración completada. Revisar panel de Cobranza.");
    } catch (e: any) {
      addLog(`❌ Error: ${e.message}`);
    }
    setRunning(false);
  };

  if (role !== 'admin') return <Navigate to="/" replace />;

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

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px' }}>
          <p><strong>3. CONTRARECIBOS PAGADOS (dinero con el contador)</strong><br/>
          (4 columnas: CR, Fecha pago, Importe, Referencia)</p>
          <textarea
            style={{ width: '100%', height: 120, fontFamily: 'monospace', padding: 12, marginBottom: 20 }}
            value={pagadosData}
            onChange={(e) => setPagadosData(e.target.value)}
          />
        </div>

        <div style={{ flex: '1 1 400px' }}>
          <p><strong>4. CAJA CHICA — saldo inicial y movimientos</strong><br/>
          (2 columnas: Concepto, Importe. Negativo = egreso)</p>
          <textarea
            style={{ width: '100%', height: 120, fontFamily: 'monospace', padding: 12, marginBottom: 20 }}
            value={cajaData}
            onChange={(e) => setCajaData(e.target.value)}
          />
        </div>
      </div>

      <button 
        onClick={handleRun} 
        disabled={running || configLoading}
        style={{ padding: '16px 32px', fontSize: 18, background: (running || configLoading) ? '#ccc' : 'var(--bad)', color: 'white', border: 'none', borderRadius: 8, cursor: (running || configLoading) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
      >
        {running ? "Procesando..." : configLoading ? "Cargando configuración..." : "BORRAR TODO E INYECTAR DATOS"}
      </button>

        <div style={{ padding: 24, background: 'var(--paper)', borderRadius: 'var(--radius)' }}>
          <h2 style={{ color: 'var(--ink)' }}>2. Reparar Departamentos Históricos (TH/GT)</h2>
          <p style={{ color: 'var(--ink-soft)' }}>
            Los expedientes creados antes de la versión v6.29.0 o mediante migración no tienen el campo "Departamento" asignado. 
            Esto causa que los botones del Dashboard (TH y GT) muestren valores en $0.00. Este proceso asigna automáticamente el departamento 
            leyendo el folio del expediente (ej. si el folio dice "TH-804", le asigna "TH").
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => void handleRepararDepartamentos()} 
            disabled={reparandoDepts}
          >
            {reparandoDepts ? 'Reparando...' : '🔍 Reparar Departamentos Históricos'}
          </button>
        </div>

        <div style={{ padding: 24, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--bad)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 8px' }}>🔧 Reparación puntual: movimientos de CAJA sin proveedor</h4>
        <p className="hint" style={{ margin: '0 0 12px' }}>
          No borra ni cambia montos. Busca movimientos de CAJA que mencionan a un proveedor conocido en su concepto
          (ej. "Adelanto a Andres…") pero que se guardaron sin el campo de proveedor — por eso no aparecían en su
          Estado de Cuenta. Completa ese campo, nada más.
        </p>
        <button
          className="btn"
          onClick={handleRepararProveedores}
          disabled={reparando || running}
        >
          {reparando ? 'Reparando…' : '🔧 Reparar movimientos sin proveedor'}
        </button>
      </div>

      <div style={{ marginTop: 40, background: '#f5f5f5', padding: 20, borderRadius: 8, fontFamily: 'monospace' }}>
        <h3>Log de Operaciones:</h3>
        {log.map((l, i) => (
          <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #ddd' }}>{l}</div>
        ))}
      </div>
    </div>
  );
}
