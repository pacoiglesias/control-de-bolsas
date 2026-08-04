import { useState } from 'react';
import { collection, getDocs, doc, writeBatch, getDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { camposInvoices } from '../lib/invoiceOps';
import { round2 } from '../lib/finance';
import { Card, Empty } from '../components/ui';
import type { OrderStatus, Invoice, PurchaseOrder } from '../lib/types';

/**
 * Estatus reales que reconoce el sistema. Antes esta pantalla escribia
 * cualquier texto que viniera en la columna "Estatus" del Excel sin
 * verificar nada: un typo ahi se guardaba tal cual y quedaba una factura
 * con un estatus que ningun otro lugar del sistema sabe interpretar.
 */
const ESTATUS_VALIDOS: OrderStatus[] = ['pedido', 'facturado', 'pending', 'paid', 'collected', 'overdue', 'manual_review'];

/**
 * Proveedores conocidos, para detectar automaticamente a quien corresponde
 * un movimiento de caja por su concepto (mismo patron que se uso para
 * reparar la migracion original en el Ciclo 30 — ver AUDIT_NOTEBOOK.md).
 * Sin esto, un movimiento como "Anticipo a Andres" quedaba sin `provider` y
 * se volvia invisible para su Estado de Cuenta especifico, aunque si
 * afectara el saldo general de Caja.
 */
const PROVIDER_NAMES = ['Andres', 'Andrés'];

type DiffCobranza = {
  tab: 'cobranza';
  type: 'new' | 'mod';
  label: string;
  orderId?: string;
  invoiceId?: string;
  cliente?: string;
  folio?: string;
  contrarecibo?: string;
  estatus?: string;
  montoVenta?: number;
  kilos?: number;
  fechaVencimiento?: string;
  oldValue?: number | string;
  newValue?: number | string;
  campo?: 'monto' | 'kilos' | 'estatus' | 'contrarecibo' | 'vencimiento';
  error?: string;
};

type DiffCaja = {
  tab: 'caja';
  type: 'new' | 'mod';
  label: string;
  id?: string;
  concepto?: string;
  proveedor?: string;
  monto?: number;
  fecha?: string;
  oldValue?: number;
  newValue?: number;
};

type DiffCompras = {
  tab: 'compras';
  type: 'new' | 'mod';
  label: string;
  id?: string; // orderId — Purchase usa el mismo id que su expediente
  proveedor?: string;
  kilosPedidos?: number;
  kilosEntregados?: number;
  precioPorKilo?: number;
  total?: number;
  pagado?: number;
  estatus?: string;
  campo?: 'kilosEntregados' | 'kilosPedidos';
  oldValue?: number;
  newValue?: number;
};

function parseFechaExcel(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  // dd/mm/aaaa, el formato que ya usa el resto del sistema en sus reportes.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function AuditSync() {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<(DiffCobranza | DiffCaja | DiffCompras)[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'cobranza' | 'caja' | 'compras'>('cobranza');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        await processDiffs(workbook, XLSX);
      };
      reader.readAsArrayBuffer(uploadedFile);
    } catch (err) {
      console.error(err);
      toast(`Error al leer el archivo: ${(err as Error).message}`, 'bad');
      setIsProcessing(false);
    }
  };

  const processDiffs = async (workbook: any, XLSX: any) => {
    const newDiffs: (DiffCobranza | DiffCaja | DiffCompras)[] = [];

    // --- 1. Cobranza: contrarecibos y facturas ---
    const cobranzaSheet = workbook.Sheets['Auditoria_Cobranza'];
    if (cobranzaSheet) {
      const cobranzaRows = XLSX.utils.sheet_to_json(cobranzaSheet);
      const ordersSnap = await getDocs(collection(db, PATHS.orders));
      const orderDocs = ordersSnap.docs.map((d) => ({ id: d.id, data: d.data() as PurchaseOrder }));

      for (const row of cobranzaRows as any[]) {
        const estatusExcel = String(row.Estatus || '').trim();
        if (estatusExcel && !ESTATUS_VALIDOS.includes(estatusExcel as OrderStatus)) {
          // No se descarta el renglon: se marca el error y se deja fuera de
          // "Aplicar Ajustes" hasta que se corrija en el Excel. Antes esto
          // se hubiera guardado tal cual, con un estatus que el resto del
          // sistema no reconoce.
          newDiffs.push({
            tab: 'cobranza', type: 'mod',
            label: `Factura ${row.FacturaFolio || row.ID_SISTEMA || '(sin folio)'}`,
            campo: 'estatus',
            error: `Estatus "${estatusExcel}" no es válido. Debe ser uno de: ${ESTATUS_VALIDOS.join(', ')}`,
          });
          continue;
        }

        if (!row.ID_SISTEMA) {
          // Renglon NUEVO: antes se detectaba pero "Aplicar Ajustes" nunca
          // lo guardaba — se mostraba en la lista y desaparecia sin dejar
          // rastro al presionar el boton.
          const montoVenta = Number(row.MontoVenta) || 0;
          // Si el Excel no trae Kilos, se calcula con el precio estandar
          // (47/kg + IVA 16%) para que la factura NO nazca con kilos=0 —
          // esa fue la causa raiz de que un monto corregido se "borrara"
          // solo la siguiente vez que alguien guardara el expediente.
          const kilosExcel = Number(row.Kilos) || round2(montoVenta / (47 * 1.16));
          newDiffs.push({
            tab: 'cobranza', type: 'new',
            label: `Factura ${row.FacturaFolio || '(nueva)'} — ${row.Cliente || 'sin cliente'}`,
            cliente: String(row.Cliente || '').trim(),
            folio: String(row.FacturaFolio || '').trim(),
            contrarecibo: String(row.Contrarecibo || '').trim(),
            estatus: estatusExcel || 'pending',
            montoVenta,
            kilos: kilosExcel,
            fechaVencimiento: row.FechaVencimiento,
            newValue: montoVenta,
          });
          continue;
        }

        const [orderId, invoiceId] = String(row.ID_SISTEMA).split('::');
        const order = orderDocs.find((o) => o.id === orderId);
        if (!order) continue;
        const inv = order.data.invoices?.find((i) => i.id === invoiceId);
        if (!inv) continue;

        const sysTotal = inv.financials?.invoiceTotal ?? 0;
        const excelTotal = Number(row.MontoVenta) || 0;
        if (Math.abs(sysTotal - excelTotal) > 0.01) {
          newDiffs.push({
            tab: 'cobranza', type: 'mod', campo: 'monto',
            orderId, invoiceId,
            label: `Factura ${inv.folio}`,
            oldValue: sysTotal, newValue: excelTotal,
          });
        }

        // Los kilos son la RAIZ del problema de "el monto se borra solo":
        // el expediente recalcula el total de cada factura como
        // kilos * precio cada vez que se guarda. Corregir solo MontoVenta
        // sin corregir Kilos deja la correccion viva hasta el siguiente
        // guardado del expediente, que la vuelve a poner en $0 si los
        // kilos siguen en cero. Se corrigen los dos juntos, siempre.
        const sysKilos = inv.kilos ?? 0;
        const excelKilos = Number(row.Kilos) || 0;
        if (excelKilos > 0 && Math.abs(sysKilos - excelKilos) > 0.01) {
          newDiffs.push({
            tab: 'cobranza', type: 'mod', campo: 'kilos',
            orderId, invoiceId,
            label: `Kilos de ${inv.folio || row.Contrarecibo || invoiceId}`,
            oldValue: sysKilos, newValue: excelKilos,
          });
        }

        const sysStatus = inv.creditCycle?.status || '';
        if (estatusExcel && sysStatus !== estatusExcel) {
          newDiffs.push({
            tab: 'cobranza', type: 'mod', campo: 'estatus',
            orderId, invoiceId,
            label: `Estatus factura ${inv.folio}`,
            oldValue: sysStatus, newValue: estatusExcel,
          });
        }

        // Contrarecibo y fecha de vencimiento: antes NUNCA se comparaban ni
        // se escribian de vuelta, aunque son justo los datos que mas cambian
        // en la sabana real del negocio (cuando llega el CR, o se corrige
        // una fecha).
        const sysCr = inv.collection?.contrareciboNumber || '';
        const excelCr = String(row.Contrarecibo || '').trim();
        if (excelCr && sysCr !== excelCr) {
          newDiffs.push({
            tab: 'cobranza', type: 'mod', campo: 'contrarecibo',
            orderId, invoiceId,
            label: `Contrarecibo de ${inv.folio}`,
            oldValue: sysCr || '(sin CR)', newValue: excelCr,
          });
        }

        const excelVenc = parseFechaExcel(row.FechaVencimiento);
        const sysVenc = inv.creditCycle?.dueDate ? inv.creditCycle.dueDate.toDate() : null;
        if (excelVenc && (!sysVenc || Math.abs(excelVenc.getTime() - sysVenc.getTime()) > 24 * 3600 * 1000)) {
          newDiffs.push({
            tab: 'cobranza', type: 'mod', campo: 'vencimiento',
            orderId, invoiceId,
            label: `Vencimiento de ${inv.folio}`,
            oldValue: sysVenc ? sysVenc.toLocaleDateString('es-MX') : '(sin fecha)',
            newValue: excelVenc.toLocaleDateString('es-MX'),
          });
        }
      }
    }

    // --- 2. Caja ---
    const cajaSheet = workbook.Sheets['Auditoria_CajaChica'];
    if (cajaSheet) {
      const cajaRows = XLSX.utils.sheet_to_json(cajaSheet);
      const expensesSnap = await getDocs(collection(db, PATHS.expenses));
      const expenseDocs = expensesSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

      for (const row of cajaRows as any[]) {
        if (!row.ID_SISTEMA) {
          const monto = Number(row.Monto) || 0;
          if (monto === 0 || !row.Concepto) continue; // renglon vacio del template
          const concepto = String(row.Concepto).trim();
          const proveedorDetectado = PROVIDER_NAMES.find((p) => concepto.toLowerCase().includes(p.toLowerCase()));
          newDiffs.push({
            tab: 'caja', type: 'new',
            label: `Movimiento: ${row.Concepto}`,
            concepto,
            proveedor: proveedorDetectado,
            monto,
            fecha: row.Fecha,
            newValue: monto,
          });
          continue;
        }

        const exp = expenseDocs.find((e) => e.id === row.ID_SISTEMA);
        if (exp) {
          const sysTotal = (exp.data as any).amount || 0;
          const excelTotal = Number(row.Monto) || 0;
          if (Math.abs(sysTotal - excelTotal) > 0.01) {
            newDiffs.push({
              tab: 'caja', type: 'mod', id: row.ID_SISTEMA,
              label: `Movimiento: ${(exp.data as any).concept}`,
              oldValue: sysTotal, newValue: excelTotal,
            });
          }
        }
      }
    }

    // --- 3. Compras a proveedor (Andres) ---
    // Un expediente puede tener facturas y contrarecibos reales sin tener
    // NUNCA un registro de compra vinculado — pasa con expedientes viejos
    // que nunca pasaron por "Registrar Entrega" ni por guardar el
    // expediente completo (los unicos dos caminos que crean este
    // registro). Sin el, "Material Flotante" del panel resta kilos
    // facturados contra kilos recibidos que nunca se contaron, y puede
    // salir negativo.
    const comprasSheet = workbook.Sheets['Auditoria_Compras'];
    if (comprasSheet) {
      const comprasRows = XLSX.utils.sheet_to_json(comprasSheet);
      const purchasesSnap = await getDocs(collection(db, PATHS.purchases));
      const purchaseDocs = purchasesSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

      for (const row of comprasRows as any[]) {
        const kilosEntregadosExcel = Number(row.KilosEntregados) || 0;
        if (kilosEntregadosExcel <= 0) continue; // renglon vacio del template

        if (!row.ID_SISTEMA) {
          newDiffs.push({
            tab: 'compras', type: 'new',
            label: `Compra nueva — ${row.Proveedor || 'sin proveedor'} (${kilosEntregadosExcel} kg)`,
            proveedor: String(row.Proveedor || '').trim(),
            kilosPedidos: Number(row.KilosPedidos) || kilosEntregadosExcel,
            kilosEntregados: kilosEntregadosExcel,
            precioPorKilo: Number(row.PrecioPorKilo) || 42,
            estatus: String(row.Estatus || 'pedido').trim(),
            newValue: kilosEntregadosExcel,
          });
          continue;
        }

        const purchase = purchaseDocs.find((p) => p.id === row.ID_SISTEMA);
        if (!purchase) {
          // ID_SISTEMA viene de un expediente real que existe pero nunca
          // genero su registro de compra — se crea usando ese mismo id,
          // para que quede ligado al expediente correcto.
          newDiffs.push({
            tab: 'compras', type: 'new', id: row.ID_SISTEMA,
            label: `Compra faltante para expediente ${row.ID_SISTEMA} — ${row.Proveedor || 'Andrés'} (${kilosEntregadosExcel} kg)`,
            proveedor: String(row.Proveedor || 'Andrés').trim(),
            kilosPedidos: Number(row.KilosPedidos) || kilosEntregadosExcel,
            kilosEntregados: kilosEntregadosExcel,
            precioPorKilo: Number(row.PrecioPorKilo) || 42,
            estatus: String(row.Estatus || 'pedido').trim(),
            newValue: kilosEntregadosExcel,
          });
          continue;
        }

        const sysKilosEntregados = purchase.data.receivedKilos || 0;
        if (Math.abs(sysKilosEntregados - kilosEntregadosExcel) > 0.01) {
          newDiffs.push({
            tab: 'compras', type: 'mod', id: purchase.id, campo: 'kilosEntregados',
            label: `Kilos entregados — ${purchase.data.provider || 'proveedor'}`,
            oldValue: sysKilosEntregados, newValue: kilosEntregadosExcel,
          });
        }
      }
    }

    setDiffs(newDiffs);
    setIsProcessing(false);
    if (newDiffs.length === 0) {
      toast('No se detectaron diferencias entre el Excel y el sistema.', 'ok');
    }
  };

  const applyChanges = async () => {
    const aplicables = diffs.filter((d) => !('error' in d && d.error));
    const conError = diffs.length - aplicables.length;
    const confirmMsg = conError > 0
      ? `Hay ${conError} renglón(es) con errores que NO se van a aplicar. ¿Aplicar los otros ${aplicables.length} ajustes de todos modos?`
      : `¿Aplicar estos ${aplicables.length} ajustes al sistema? Esta acción no se puede deshacer con un botón.`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    const batch = writeBatch(db);
    let aplicados = 0;

    try {
      // Cobranza: agrupar por expediente para no pisar cambios de otro
      // renglon del mismo expediente dentro del mismo lote.
      const porOrden = new Map<string, { snap: any; invoices: Invoice[] }>();
      const nuevasFacturasPorCliente = new Map<string, { cliente: string; items: DiffCobranza[] }>();

      for (const diff of aplicables) {
        if (diff.tab !== 'cobranza') continue;

        if (diff.type === 'new') {
          const key = diff.cliente || '(sin cliente)';
          if (!nuevasFacturasPorCliente.has(key)) nuevasFacturasPorCliente.set(key, { cliente: key, items: [] });
          nuevasFacturasPorCliente.get(key)!.items.push(diff);
          continue;
        }

        const orderId = diff.orderId!;
        if (!porOrden.has(orderId)) {
          const orderRef = doc(db, PATHS.orders, orderId);
          const orderSnap = await getDoc(orderRef);
          if (!orderSnap.exists()) continue;
          porOrden.set(orderId, { snap: orderSnap, invoices: [...(orderSnap.data().invoices || [])] });
        }
        const entry = porOrden.get(orderId)!;
        const idx = entry.invoices.findIndex((i) => i.id === diff.invoiceId);
        if (idx < 0) continue;
        const inv = entry.invoices[idx];

        if (diff.campo === 'monto') {
          entry.invoices[idx] = { ...inv, financials: { ...inv.financials, invoiceTotal: Number(diff.newValue) } as any };
        } else if (diff.campo === 'kilos') {
          entry.invoices[idx] = { ...inv, kilos: Number(diff.newValue) };
        } else if (diff.campo === 'estatus') {
          entry.invoices[idx] = { ...inv, creditCycle: { ...inv.creditCycle, status: diff.newValue as OrderStatus } };
        } else if (diff.campo === 'contrarecibo') {
          entry.invoices[idx] = { ...inv, collection: { ...inv.collection, contrareciboNumber: String(diff.newValue) } };
        } else if (diff.campo === 'vencimiento') {
          const d = parseFechaExcel(diff.newValue as string);
          if (d) entry.invoices[idx] = { ...inv, creditCycle: { ...inv.creditCycle, dueDate: Timestamp.fromDate(d) } };
        }
        aplicados++;
      }

      // Escribir expedientes existentes modificados — SIEMPRE via
      // camposInvoices(), para que invoiceStatuses viaje junto con
      // invoices. Antes esta pantalla escribia `invoices` sola: el resto
      // del sistema (Dashboard, Cobranza, el proceso de vencidos) depende
      // de invoiceStatuses, no de invoices, para filtrar — quedaba
      // desincronizado en silencio.
      porOrden.forEach((_entry, orderId) => {
        const entry = porOrden.get(orderId)!;
        batch.set(doc(db, PATHS.orders, orderId), camposInvoices(entry.invoices), { merge: true });
      });

      // Facturas nuevas: se agrupan en UN expediente nuevo por cliente en
      // este lote de importacion, para no crear un expediente vacio por
      // cada renglon.
      for (const [, { cliente, items }] of nuevasFacturasPorCliente) {
        const newOrderRef = doc(collection(db, PATHS.orders));
        const invoices: Invoice[] = items.map((item, i) => {
          const venc = parseFechaExcel(item.fechaVencimiento);
          return {
            id: `${newOrderRef.id}-imp-${i}`,
            folio: item.folio || '',
            kilos: item.kilos || 0,
            financials: { salePricePerKg: 0, costPricePerKg: 0, netCashFlow: 0, invoiceTotal: item.montoVenta || 0 },
            creditCycle: {
              status: (item.estatus as OrderStatus) || 'pending',
              issueDate: Timestamp.now(),
              dueDate: venc ? Timestamp.fromDate(venc) : null,
            },
            collection: { contrareciboNumber: item.contrarecibo || '' },
          };
        });
        batch.set(newOrderRef, {
          client: cliente,
          fileName: 'IMPORTADO_AUDITORIA_MAESTRA',
          totalKilograms: 0,
          processedAt: serverTimestamp(),
          ...camposInvoices(invoices),
        });
        aplicados += items.length;
      }

      // Caja
      for (const diff of aplicables) {
        if (diff.tab !== 'caja') continue;
        if (diff.type === 'mod' && diff.id) {
          batch.update(doc(db, PATHS.expenses, diff.id), { amount: diff.newValue });
          aplicados++;
        } else if (diff.type === 'new') {
          const fecha = parseFechaExcel(diff.fecha) || new Date();
          const monto = diff.monto || 0;
          batch.set(doc(collection(db, PATHS.expenses)), {
            date: Timestamp.fromDate(fecha),
            concept: diff.concepto,
            type: monto < 0 ? 'egreso' : 'ingreso',
            amount: Math.abs(monto),
            provider: diff.proveedor || null,
            notes: 'Importado desde Auditoría Maestra',
            createdAt: serverTimestamp(),
          });
          aplicados++;
        }
      }

      // Compras — mismo esquema que upsertAndresPurchase() en lib/deliveries.ts
      for (const diff of aplicables) {
        if (diff.tab !== 'compras') continue;
        if (diff.type === 'mod' && diff.id && diff.campo === 'kilosEntregados') {
          batch.update(doc(db, PATHS.purchases, diff.id), {
            receivedKilos: diff.newValue,
            totalAmount: round2((diff.newValue || 0) * (diff.precioPorKilo || 42)),
          });
          aplicados++;
        } else if (diff.type === 'new') {
          const ref = diff.id ? doc(db, PATHS.purchases, diff.id) : doc(collection(db, PATHS.purchases));
          batch.set(ref, {
            date: serverTimestamp(),
            provider: diff.proveedor || 'Andrés',
            expectedKilos: diff.kilosPedidos || diff.kilosEntregados || 0,
            receivedKilos: diff.kilosEntregados || 0,
            pricePerKg: diff.precioPorKilo || 42,
            totalAmount: round2((diff.kilosEntregados || 0) * (diff.precioPorKilo || 42)),
            paidAmount: 0,
            status: diff.estatus || 'pedido',
            createdAt: serverTimestamp(),
          }, { merge: true });
          aplicados++;
        }
      }

      await batch.commit();
      toast(`${aplicados} ajuste(s) aplicados correctamente.${conError > 0 ? ` ${conError} con error se dejaron sin aplicar.` : ''}`, 'ok');
      setDiffs([]);
      setFile(null);
    } catch (e) {
      console.error(e);
      toast(`Error al aplicar cambios: ${(e as Error).message}`, 'bad');
    }

    setIsProcessing(false);
  };

  const filteredDiffs = diffs.filter((d) => d.tab === activeTab);
  const totalAplicables = diffs.filter((d) => !('error' in d && d.error)).length;

  function cancelar() {
    setFile(null);
    setDiffs([]);
  }

  return (
    <>
      <div className="page-head">
        <h1>⚖️ Auditoría Maestra</h1>
        <p>
          Sube tu Sábana de Auditoría modificada. El sistema detectará los cambios y te propondrá los ajustes
          antes de guardarlos en la base de datos. Los renglones nuevos (sin <code>ID_SISTEMA</code>) se crean;
          los existentes se actualizan.
        </p>
      </div>

      <Card title="Sábana de Auditoría">
        <div style={{ padding: 16 }}>
          {!file && (
            <div style={{ border: '2px dashed var(--line)', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
              <label className="btn btn-primary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                📤 Subir Sábana Modificada
                <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleUpload} />
              </label>
            </div>
          )}

          {isProcessing && <p style={{ textAlign: 'center', marginTop: '2rem', fontWeight: 700 }}>Procesando cruce de datos…</p>}

          {file && !isProcessing && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`btn ${activeTab === 'cobranza' ? 'btn-primary' : ''}`}
                    onClick={() => setActiveTab('cobranza')}
                  >
                    Cobranza ({diffs.filter((d) => d.tab === 'cobranza').length})
                  </button>
                  <button
                    className={`btn ${activeTab === 'caja' ? 'btn-primary' : ''}`}
                    onClick={() => setActiveTab('caja')}
                  >
                    Caja Chica ({diffs.filter((d) => d.tab === 'caja').length})
                  </button>
                  <button
                    className={`btn ${activeTab === 'compras' ? 'btn-primary' : ''}`}
                    onClick={() => setActiveTab('compras')}
                  >
                    Compras ({diffs.filter((d) => d.tab === 'compras').length})
                  </button>
                </div>
                <button className="btn" onClick={cancelar}>✕ Cancelar / Subir otro archivo</button>
              </div>

              {filteredDiffs.length === 0 ? (
                <Empty>No se detectaron diferencias en esta sección.</Empty>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Registro</th>
                        <th className="num">Valor Anterior</th>
                        <th className="num">Nuevo Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDiffs.map((d, i) => (
                        <tr key={i} style={'error' in d && d.error ? { background: 'rgba(220,38,38,0.06)' } : undefined}>
                          <td>
                            {'error' in d && d.error ? (
                              <span className="badge" style={{ background: 'var(--bad)' }}>ERROR</span>
                            ) : d.type === 'new' ? (
                              <span className="badge" style={{ background: 'var(--ok)' }}>NUEVO</span>
                            ) : (
                              <span className="badge" style={{ background: 'var(--warn)' }}>MODIFICADO</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {d.label}
                            {'error' in d && d.error && (
                              <div style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 400, marginTop: 4 }}>{d.error}</div>
                            )}
                          </td>
                          <td className="num mono" style={{ color: 'var(--ink-soft)' }}>
                            {typeof d.oldValue === 'number' ? `$${d.oldValue.toLocaleString('es-MX')}` : d.oldValue || '—'}
                          </td>
                          <td className="num mono" style={{ fontWeight: 700 }}>
                            {typeof d.newValue === 'number' ? `$${d.newValue.toLocaleString('es-MX')}` : d.newValue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {diffs.length > 0 && (
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button className="btn" onClick={cancelar}>Cancelar</button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void applyChanges()}
                    disabled={totalAplicables === 0}
                  >
                    Aplicar {totalAplicables} Ajuste(s) a Base de Datos
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
