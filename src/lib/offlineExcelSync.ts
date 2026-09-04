import * as XLSX from 'xlsx';
import { round2, extractCr } from './finance';
import { toDate, fmtDate } from './format';
import type { PurchaseOrder, Expense, FinancialConfig } from './types';
import { db, PATHS } from './firebase';
import { camposInvoices } from './invoiceOps';
import { doc, runTransaction, addDoc, collection, Timestamp } from 'firebase/firestore';
import { logAction } from './logger';

export interface OfflineSyncDiff {
  id: string;
  type: 'invoice' | 'delivery' | 'expense';
  action: 'create' | 'update';
  summary: string;
  orderId?: string;
  invoiceId?: string;
  deliveryId?: string;
  expenseId?: string;
  changes: { field: string; oldVal: any; newVal: any }[];
  payload: any;
  error?: string;
}

/**
 * 1. Genera el libro Excel optimizado para trabajo Offline con 4 pestañas:
 * - 1_EXPEDIENTES_FACTURAS: Cartera, folios, contrarecibos, kilos y estatus
 * - 2_ENTREGAS_ANDRES: Entregas de báscula por OC (con tope)
 * - 3_CAJA_CHICA_PAGOS: Gastos e ingresos de flujo de efectivo
 * - 4_INSTRUCCIONES: Guía clara de edición y reglas
 */
export async function exportOfflineWorkbook(
  orders: PurchaseOrder[],
  expenses: Expense[],
  config: FinancialConfig
): Promise<Uint8Array> {
  const carteraRows: any[] = [];
  const entregasRows: any[] = [];
  const cajaRows: any[] = [];

  // 1. EXPEDIENTES Y FACTURAS
  orders.forEach((o) => {
    const invs = o.invoices || [];
    invs.forEach((inv) => {
      const cr = extractCr(inv, o);
      const invTotal = round2(inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * (config?.salePricePerKg || 43) * 1.16));
      const issueDate = toDate(inv.creditCycle?.issueDate);
      const dueDate = toDate(inv.creditCycle?.dueDate);

      carteraRows.push({
        _ID_ORDEN: o.id,
        _ID_FACTURA: inv.id,
        OC_Folio: o.folio || o.oc || '',
        Cliente: o.client || 'Grupo Textil Providencia',
        Departamento: o.department || (cr.startsWith('TH') ? 'TH' : 'GT'),
        Folio_Factura: inv.folio || '',
        Contrarecibo: cr,
        Kilos_Factura: inv.kilos || 0,
        Total_Factura_con_IVA: invTotal,
        Estatus_Cobranza: inv.creditCycle?.status || 'pending',
        Fecha_Emision: issueDate ? fmtDate(issueDate) : '',
        Fecha_Vencimiento_Cobro: dueDate ? fmtDate(dueDate) : '',
        Referencia_Transferencia: inv.collection?.transferRef || '',
      });
    });
  });

  // 2. ENTREGAS DE ANDRÉS
  orders.forEach((o) => {
    const dels = o.deliveries || [];
    dels.forEach((del, idx) => {
      const delDate = toDate(del.date);
      entregasRows.push({
        _ID_ORDEN: o.id,
        _ID_ENTREGA: del.id || `del-${idx}`,
        OC_Folio: o.folio || o.oc || '',
        Kilos_Entregados: del.kilos || 0,
        Fecha_Entrega: delDate ? fmtDate(delDate) : '',
        Documento_Remision: del.docFolio || del.docType || '',
        Chofer_Transporte: del.driver || 'Andrés',
        Notas: del.notes || '',
      });
    });
  });

  // 3. CAJA CHICA Y PAGOS
  expenses.forEach((e) => {
    const eDate = toDate(e.date);
    cajaRows.push({
      _ID_GASTO: e.id || '',
      Fecha: eDate ? fmtDate(eDate) : '',
      Tipo: e.type || 'egreso',
      Proveedor_Beneficiario: e.provider || '',
      Concepto: e.concept || '',
      Monto: e.amount || 0,
      Notas: e.notes || '',
    });
  });

  // 4. INSTRUCCIONES
  const instruccionesRows = [
    { Paso: '1. ¿Cómo editar?', Detalle: 'Modifica las columnas de datos (Folio_Factura, Contrarecibo, Kilos, Estatus_Cobranza, Fechas, etc.).' },
    { Paso: '2. Columnas _ID_*', Detalle: 'IMPORTANTE: NO borres ni modifiques las columnas que inician con "_ID_" ya que vinculan cada fila con el sistema.' },
    { Paso: '3. Agregar Pagos / Gastos', Detalle: 'Para registrar un nuevo pago en Caja Chica, agrega una fila en "3_CAJA_CHICA_PAGOS" dejando "_ID_GASTO" en blanco.' },
    { Paso: '4. Regla de Kilos de Andrés', Detalle: 'Andrés nunca puede entregar más kilos de lo ordenado en la OC (cero mermas). Los excesos serán rechazados.' },
    { Paso: '5. Estatus permitidos', Detalle: 'pending (Pendiente), overdue (Vencido), paid (Pagado en Banco), collected (En Caja Chica).' },
  ];

  const wb = XLSX.utils.book_new();

  const wsCartera = XLSX.utils.json_to_sheet(carteraRows);
  wsCartera['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 28 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
    { wch: 15 }, { wch: 24 }, { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCartera, '1_EXPEDIENTES_FACTURAS');

  const wsEntregas = XLSX.utils.json_to_sheet(entregasRows);
  wsEntregas['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 16 },
    { wch: 15 }, { wch: 22 }, { wch: 20 }, { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsEntregas, '2_ENTREGAS_ANDRES');

  const wsCaja = XLSX.utils.json_to_sheet(cajaRows);
  wsCaja['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 25 },
    { wch: 32 }, { wch: 16 }, { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCaja, '3_CAJA_CHICA_PAGOS');

  const wsInst = XLSX.utils.json_to_sheet(instruccionesRows);
  wsInst['!cols'] = [{ wch: 25 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInst, '4_INSTRUCCIONES');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buf);
}

/**
 * 2. Analiza el libro subido por el usuario, detecta cambios frente a Firestore y valida reglas.
 */
export async function parseAndDiffOfflineWorkbook(
  fileBuffer: ArrayBuffer | Uint8Array,
  currentOrders: PurchaseOrder[],
  currentExpenses: Expense[],
  _config?: FinancialConfig
): Promise<OfflineSyncDiff[]> {
  const wb = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
  const diffs: OfflineSyncDiff[] = [];

  const ordersMap = new Map<string, PurchaseOrder>(currentOrders.map(o => [o.id, o]));
  const expensesMap = new Map<string, Expense>(currentExpenses.map(e => [e.id, e]));

  // --- REVISAR PESTAÑA 1: FACTURAS / CARTERA ---
  const wsCartera = wb.Sheets['1_EXPEDIENTES_FACTURAS'];
  if (wsCartera) {
    const rows: any[] = XLSX.utils.sheet_to_json(wsCartera);
    for (const r of rows) {
      const orderId = String(r._ID_ORDEN || '').trim();
      const invoiceId = String(r._ID_FACTURA || '').trim();
      if (!orderId || !invoiceId) continue;

      const order = ordersMap.get(orderId);
      if (!order) continue;

      const inv = (order.invoices || []).find(i => i.id === invoiceId);
      if (!inv) continue;

      const changes: { field: string; oldVal: any; newVal: any }[] = [];

      // Contrarecibo
      const newCr = String(r.Contrarecibo || '').trim();
      const oldCr = extractCr(inv, order);
      if (newCr && newCr !== oldCr) {
        changes.push({ field: 'Contrarecibo', oldVal: oldCr, newVal: newCr });
      }

      // Folio Factura
      const newFolio = String(r.Folio_Factura || '').trim();
      if (newFolio && newFolio !== (inv.folio || '')) {
        changes.push({ field: 'Folio Factura', oldVal: inv.folio || '', newVal: newFolio });
      }

      // Estatus
      const newStatus = String(r.Estatus_Cobranza || '').trim().toLowerCase();
      const oldStatus = inv.creditCycle?.status || 'pending';
      if (newStatus && ['pending', 'overdue', 'paid', 'collected'].includes(newStatus) && newStatus !== oldStatus) {
        changes.push({ field: 'Estatus Cobranza', oldVal: oldStatus, newVal: newStatus });
      }

      // Transferencia
      const newTr = String(r.Referencia_Transferencia || '').trim();
      const oldTr = inv.collection?.transferRef || '';
      if (newTr && newTr !== oldTr) {
        changes.push({ field: 'Referencia Transferencia', oldVal: oldTr, newVal: newTr });
      }

      // Kilos Factura
      const newKilos = Number(r.Kilos_Factura);
      if (Number.isFinite(newKilos) && newKilos > 0 && newKilos !== (inv.kilos || 0)) {
        changes.push({ field: 'Kilos Factura', oldVal: inv.kilos || 0, newVal: newKilos });
      }

      if (changes.length > 0) {
        diffs.push({
          id: `diff-inv-${invoiceId}`,
          type: 'invoice',
          action: 'update',
          orderId,
          invoiceId,
          summary: `Factura ${newFolio || inv.folio || invoiceId} (${order.folio || 'OC'}): ${changes.map(c => `${c.field} → ${c.newVal}`).join(', ')}`,
          changes,
          payload: { newCr, newFolio, newStatus, newTr, newKilos }
        });
      }
    }
  }

  // --- REVISAR PESTAÑA 2: ENTREGAS DE ANDRÉS ---
  const wsEntregas = wb.Sheets['2_ENTREGAS_ANDRES'];
  if (wsEntregas) {
    const rows: any[] = XLSX.utils.sheet_to_json(wsEntregas);
    for (const r of rows) {
      const orderId = String(r._ID_ORDEN || '').trim();
      const deliveryId = String(r._ID_ENTREGA || '').trim();
      if (!orderId) continue;

      const order = ordersMap.get(orderId);
      if (!order) continue;

      const newKilos = Number(r.Kilos_Entregados);
      if (!Number.isFinite(newKilos) || newKilos <= 0) continue;

      const expectedKilos = order.totalKilograms || order.items?.reduce((acc: number, it: any) => acc + (it.quantity || it.kilos || 0), 0) || 0;
      const existingDeliveries = order.deliveries || [];
      const currentDel = existingDeliveries.find(d => (d.id || '') === deliveryId);

      if (currentDel) {
        // Modificación de entrega existente
        if (newKilos !== (currentDel.kilos || 0)) {
          const otherKilos = existingDeliveries.filter(d => d.id !== deliveryId).reduce((acc, d) => acc + (d.kilos || 0), 0);
          const totalKilos = otherKilos + newKilos;

          let errorMsg: string | undefined;
          if (expectedKilos > 0 && totalKilos > expectedKilos + 0.01) {
            errorMsg = `Rechazado por regla de negocio: Los kilos acumulados (${totalKilos.toLocaleString()} kg) exceden el tope de la OC (${expectedKilos.toLocaleString()} kg). Andrés no puede entregar kilos de más.`;
          }

          diffs.push({
            id: `diff-del-${deliveryId}`,
            type: 'delivery',
            action: 'update',
            orderId,
            deliveryId,
            summary: `Entrega en ${order.folio || 'OC'}: Kilos ${currentDel.kilos} → ${newKilos} kg`,
            changes: [{ field: 'Kilos Entregados', oldVal: currentDel.kilos, newVal: newKilos }],
            payload: { newKilos, docFolio: r.Documento_Remision, driver: r.Chofer_Transporte, notes: r.Notas },
            error: errorMsg,
          });
        }
      }
    }
  }

  // --- REVISAR PESTAÑA 3: CAJA CHICA Y PAGOS ---
  const wsCaja = wb.Sheets['3_CAJA_CHICA_PAGOS'];
  if (wsCaja) {
    const rows: any[] = XLSX.utils.sheet_to_json(wsCaja);
    for (const r of rows) {
      const expenseId = String(r._ID_GASTO || '').trim();
      const amount = Number(r.Monto);
      const concept = String(r.Concepto || '').trim();
      const provider = String(r.Proveedor_Beneficiario || '').trim();
      const type = String(r.Tipo || 'egreso').toLowerCase().includes('ingreso') ? 'ingreso' : 'egreso';

      if (!concept && !amount) continue;

      if (!expenseId) {
        // Nuevo registro creado offline
        if (amount > 0 && concept) {
          diffs.push({
            id: `diff-exp-new-${Math.random().toString(36).substring(2, 9)}`,
            type: 'expense',
            action: 'create',
            summary: `Nuevo movimiento en Caja Chica: [${type.toUpperCase()}] ${provider ? `${provider} - ` : ''}${concept} ($${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })})`,
            changes: [{ field: 'Nuevo Registro', oldVal: null, newVal: `${type} $${amount}` }],
            payload: { amount, concept, provider, type, date: r.Fecha || new Date().toISOString().slice(0, 10), notes: r.Notas || '' }
          });
        }
      } else {
        // Gasto existente modificado
        const exp = expensesMap.get(expenseId);
        if (exp) {
          const changes: { field: string; oldVal: any; newVal: any }[] = [];
          if (amount > 0 && amount !== exp.amount) changes.push({ field: 'Monto', oldVal: exp.amount, newVal: amount });
          if (concept && concept !== exp.concept) changes.push({ field: 'Concepto', oldVal: exp.concept, newVal: concept });
          if (provider && provider !== (exp.provider || '')) changes.push({ field: 'Proveedor', oldVal: exp.provider, newVal: provider });

          if (changes.length > 0) {
            diffs.push({
              id: `diff-exp-${expenseId}`,
              type: 'expense',
              action: 'update',
              expenseId,
              summary: `Gasto/Pago ${concept || expenseId}: ${changes.map(c => `${c.field} → ${c.newVal}`).join(', ')}`,
              changes,
              payload: { amount, concept, provider, notes: r.Notas }
            });
          }
        }
      }
    }
  }

  return diffs;
}

/**
 * 3. Aplica los diffs validados en Firestore de forma atómica y con dual-write.
 */
export async function applyOfflineSyncDiffs(
  diffs: OfflineSyncDiff[],
  userEmail?: string | null
): Promise<{ appliedCount: number; errors: string[] }> {
  let appliedCount = 0;
  const errors: string[] = [];

  for (const diff of diffs) {
    if (diff.error) {
      errors.push(`${diff.summary}: ${diff.error}`);
      continue;
    }

    try {
      if (diff.type === 'invoice' && diff.orderId && diff.invoiceId) {
        await runTransaction(db, async (tx) => {
          const orderRef = doc(db, PATHS.orders, diff.orderId!);
          const snap = await tx.get(orderRef);
          if (!snap.exists()) throw new Error(`Expediente ${diff.orderId} no encontrado`);

          const order = snap.data() as PurchaseOrder;
          const invoices = order.invoices || [];
          const idx = invoices.findIndex(i => i.id === diff.invoiceId);
          if (idx === -1) throw new Error(`Factura ${diff.invoiceId} no encontrada`);

          const inv = { ...invoices[idx] };
          const p = diff.payload;

          if (p.newCr) {
            inv.collection = { ...inv.collection, contrareciboNumber: p.newCr };
          }
          if (p.newFolio) {
            inv.folio = p.newFolio;
          }
          if (p.newStatus) {
            inv.creditCycle = { ...inv.creditCycle, status: p.newStatus };
          }
          if (p.newTr) {
            inv.collection = { ...inv.collection, transferRef: p.newTr };
          }
          if (p.newKilos) {
            inv.kilos = p.newKilos;
          }

          invoices[idx] = inv;
          tx.update(orderRef, camposInvoices(invoices));

          // Dual-write V2
          tx.set(doc(db, PATHS.invoices, diff.invoiceId!), {
            ...inv,
            orderId: diff.orderId,
            client: order.client || '',
            department: order.department || '',
          }, { merge: true });
        });
        appliedCount++;
      } else if (diff.type === 'delivery' && diff.orderId && diff.deliveryId) {
        await runTransaction(db, async (tx) => {
          const orderRef = doc(db, PATHS.orders, diff.orderId!);
          const snap = await tx.get(orderRef);
          if (!snap.exists()) throw new Error(`Expediente ${diff.orderId} no encontrado`);

          const order = snap.data() as PurchaseOrder;
          const deliveries = order.deliveries || [];
          const idx = deliveries.findIndex(d => (d.id || '') === diff.deliveryId);
          if (idx === -1) throw new Error(`Entrega ${diff.deliveryId} no encontrada`);

          deliveries[idx] = {
            ...deliveries[idx],
            kilos: diff.payload.newKilos,
            docFolio: diff.payload.docFolio || deliveries[idx].docFolio,
            driver: diff.payload.driver || deliveries[idx].driver,
            notes: diff.payload.notes || deliveries[idx].notes,
          };

          tx.update(orderRef, { deliveries, updatedAt: Timestamp.now() });
        });
        appliedCount++;
      } else if (diff.type === 'expense') {
        if (diff.action === 'create') {
          await addDoc(collection(db, PATHS.expenses), {
            amount: diff.payload.amount,
            concept: diff.payload.concept,
            provider: diff.payload.provider || '',
            type: diff.payload.type,
            date: new Date(diff.payload.date).getTime() || Date.now(),
            notes: diff.payload.notes || 'Registrado desde Excel Offline',
            createdAt: Timestamp.now(),
          });
          appliedCount++;
        } else if (diff.action === 'update' && diff.expenseId) {
          await runTransaction(db, async (tx) => {
            const expRef = doc(db, PATHS.expenses, diff.expenseId!);
            tx.update(expRef, {
              amount: diff.payload.amount,
              concept: diff.payload.concept,
              provider: diff.payload.provider || '',
              notes: diff.payload.notes || '',
              updatedAt: Timestamp.now(),
            });
          });
          appliedCount++;
        }
      }
    } catch (err: any) {
      errors.push(`${diff.summary}: ${err.message}`);
    }
  }

  if (appliedCount > 0) {
    await logAction(userEmail, 'Sincronización Offline Aplicada', {
      appliedCount,
      diffsCount: diffs.length,
    });
  }

  return { appliedCount, errors };
}
