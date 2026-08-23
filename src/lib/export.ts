import { collection, getDocs } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { extractCr, round2 } from './finance';
import { toDate } from './format';

export async function exportToExcel() {
  const XLSX = await import('xlsx');
  
  const [ordersSnap, expensesSnap] = await Promise.all([
    getDocs(collection(db, PATHS.orders)),
    getDocs(collection(db, PATHS.expenses)),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. CARTERA Y FACTURAS OFICIALES (10 Contrarecibos + Fac 6167)
  const carteraRows: any[] = [];
  let noIdx = 1;

  ordersSnap.docs.forEach((doc) => {
    const o = doc.data();
    if (o.isDeleted) return;

    (o.invoices || []).forEach((inv: any) => {
      const cr = extractCr(inv, o);
      const invTotal = round2(inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * 43 * 1.16));
      const subtotal = round2(inv.financials?.subtotal ?? (invTotal / 1.16));
      const iva = round2(invTotal - subtotal);
      const comision = round2(inv.financials?.commission ?? (subtotal * 0.08));
      const netoCaja = round2(invTotal - comision);
      const pagado = round2(inv.collection?.paidAmount ?? 0);
      const saldo = round2(Math.max(0, invTotal - pagado));

      const issueObj = toDate(inv.creditCycle?.issueDate);
      const dueObj = toDate(inv.creditCycle?.dueDate);

      let diasAtraso = 0;
      let estatusVencimiento = 'En Plazo';
      if (dueObj) {
        dueObj.setHours(0, 0, 0, 0);
        diasAtraso = Math.round((today.getTime() - dueObj.getTime()) / (1000 * 60 * 60 * 24));
        if (diasAtraso > 0) {
          estatusVencimiento = `Vencido (${diasAtraso} días)`;
        } else if (diasAtraso === 0) {
          estatusVencimiento = 'Vence Hoy';
        } else {
          estatusVencimiento = `En Plazo (${Math.abs(diasAtraso)} días rest.)`;
        }
      } else {
        estatusVencimiento = 'En Revisión (Sin CR)';
      }

      carteraRows.push({
        No: noIdx++,
        Contrarecibo: cr || 'PENDIENTE',
        FacturaFolio: inv.folio || o.folio || 'S/N',
        OrdenCompra: o.oc || o.folio || 'S/N',
        Cliente: o.client || 'Grupo Textil Providencia',
        Departamento: o.department || (cr?.startsWith('TH') ? 'TH' : 'GT'),
        FechaEmision: issueObj ? issueObj.toLocaleDateString('es-MX') : '',
        FechaVencimiento: dueObj ? dueObj.toLocaleDateString('es-MX') : 'En Revisión',
        DiagnosticoVencimiento: estatusVencimiento,
        KilosBascula: inv.kilos || 0,
        Subtotal: subtotal,
        IVA_16: iva,
        TotalFactura_cIVA: invTotal,
        HonorarioContador_8Pct: comision,
        NetoReal_a_Caja: netoCaja,
        PagadoProvidencia: pagado,
        SaldoPendiente: saldo,
        EstatusCobranza: inv.creditCycle?.status || 'pending',
      });
    });
  });

  // Ordenar: primero por fecha de vencimiento
  carteraRows.sort((a, b) => (a.No - b.No));

  // 2. MAQUILA DE ANDRÉS
  const maquilaRows: any[] = [];
  ordersSnap.docs.forEach((doc) => {
    const o = doc.data();
    if (o.isDeleted) return;

    (o.deliveries || []).forEach((del: any, idx: number) => {
      const delDate = toDate(del.date);
      const k = del.kilos || 0;
      const costo = round2(k * 42.00);

      maquilaRows.push({
        Fecha: delDate ? delDate.toLocaleDateString('es-MX') : '',
        OrdenCompra: o.oc || o.folio || 'S/N',
        DocumentoEntrega: del.docType ? `${del.docType.toUpperCase()} ${del.docFolio || ''}` : `Entrega #${idx + 1}`,
        KilosBascula: k,
        CostoMaquila_42_Kg: costo,
        ChoferTransporte: del.driver || 'Andrés Chofer',
        Placas: del.plates || '',
      });
    });
  });

  // 3. MOVIMIENTOS DE CAJA CHICA Y PAGOS
  const cajaRows = expensesSnap.docs.map((doc) => {
    const data = doc.data();
    const dDate = toDate(data.date);
    return {
      Fecha: dDate ? dDate.toLocaleDateString('es-MX') : '',
      Tipo: data.type === 'ingreso' ? '🟢 INGRESO' : '🔴 EGRESO',
      Categoria: data.category || 'General',
      Concepto: data.concept || '',
      BeneficiarioProveedor: data.provider || '',
      Monto: data.amount || 0,
      Notas: data.notes || '',
    };
  });

  // 4. BALANZA Y RESUMEN EJECUTIVO
  const totalCarteraCrs = carteraRows.filter(r => r.Contrarecibo !== 'PENDIENTE').reduce((s, r) => s + r.TotalFactura_cIVA, 0);
  const totalCarteraRevision = carteraRows.filter(r => r.Contrarecibo === 'PENDIENTE').reduce((s, r) => s + r.TotalFactura_cIVA, 0);
  const totalDeudaProvidencia = totalCarteraCrs + totalCarteraRevision;
  const totalComisionContable = carteraRows.reduce((s, r) => s + r.HonorarioContador_8Pct, 0);
  const totalNetoEsperado = totalDeudaProvidencia - totalComisionContable;

  const countCrs = carteraRows.filter(r => r.Contrarecibo !== 'PENDIENTE').length;
  const countRevision = carteraRows.filter(r => r.Contrarecibo === 'PENDIENTE').length;

  const resumenRows = [
    { Rubro: `1. Contrarecibos Vigentes Emitidos (${countCrs} CRs)`, Importe: totalCarteraCrs, Detalle: 'Cartera amparada con Contrarecibo oficial' },
    { Rubro: countRevision > 0 ? `2. Facturas en Revisión (${countRevision} docs)` : '2. Facturas en Revisión', Importe: totalCarteraRevision, Detalle: 'Facturas pendientes de contrarecibo' },
    { Rubro: '🏢 TOTAL DEUDA ACTIVA DE PROVIDENCIA', Importe: totalDeudaProvidencia, Detalle: 'Suma exacta al centavo de toda la cartera' },
    { Rubro: '🏛️ Honorario Despacho Contable (8.0%)', Importe: -totalComisionContable, Detalle: 'Comisión del despacho sobre base gravable' },
    { Rubro: '💰 DINERO NETO REAL A INGRESAR A CAJA', Importe: totalNetoEsperado, Detalle: 'Efectivo líquido final disponible' },
  ];

  const wb = XLSX.utils.book_new();

  const wsCartera = XLSX.utils.json_to_sheet(carteraRows);
  XLSX.utils.book_append_sheet(wb, wsCartera, '1_Cartera_Providencia');

  const wsMaquila = XLSX.utils.json_to_sheet(maquilaRows);
  XLSX.utils.book_append_sheet(wb, wsMaquila, '2_Maquila_Andres');

  const wsCaja = XLSX.utils.json_to_sheet(cajaRows);
  XLSX.utils.book_append_sheet(wb, wsCaja, '3_Caja_Chica');

  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, '4_Balanza_Resumen');

  const fechaTag = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Sabana_Maestra_Providencia_${fechaTag}.xlsx`);
}

export async function exportTotalBusinessBackupExcel() {
  return exportToExcel();
}

export async function exportToHtml() {
  const ordersSnap = await getDocs(collection(db, PATHS.orders));
  const purchasesSnap = await getDocs(collection(db, PATHS.purchases));
  const expensesSnap = await getDocs(collection(db, PATHS.expenses));

  const data = {
    orders: ordersSnap.docs.filter(d => !d.data().isDeleted).map(d => ({ id: d.id, ...d.data() })),
    purchases: purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    expenses: expensesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };

  const response = await fetch('/respaldo/control-bolsas-offline.html');
  let html = await response.text();

  const dataScript = `
<script id="offline-data">
  window.OFFLINE_DB = ${JSON.stringify(data)};
</script>`;
  html = html.replace('</head>', dataScript + '\n<meta charset="UTF-8">\n</head>');

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ControlBolsas_Offline_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
