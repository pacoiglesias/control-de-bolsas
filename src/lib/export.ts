import { collection, getDocs } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { extractCr } from './finance';
import { toDate } from './format';

export async function exportToExcel() {
  const XLSX = await import('xlsx');
  const invoicesSnap = await getDocs(collection(db, PATHS.invoices));
  const purchasesSnap = await getDocs(collection(db, PATHS.purchases));
  const expensesSnap = await getDocs(collection(db, PATHS.expenses));

  const ordersData: any[] = [];
  
  invoicesSnap.docs.forEach(d => {
    const inv = d.data();
    const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
    const paid = inv.collection?.paidAmount ?? 0;
    const dueObj = toDate(inv.creditCycle?.dueDate);
    ordersData.push({
      Cliente: inv.client || '',
      Departamento: inv.department || '',
      FacturaFolio: inv.folio || '',
      Contrarecibo: extractCr(inv),
      Estatus: inv.creditCycle?.status || 'pedido',
      Kilos: inv.kilos || 0,
      MontoVenta: invTotal,
      MontoCobrado: paid,
      MontoPendiente: Math.max(invTotal - paid, 0),
      FechaVencimiento: dueObj ? dueObj.toLocaleDateString('es-MX') : '',
      ID_SISTEMA: d.id,
      EXPEDIENTE_ID: inv.orderId || ''
    });
  });

  const purchasesData = purchasesSnap.docs.map(d => {
    const data = d.data();
    return {
      Proveedor: data.provider || '',
      Fecha: data.date?.toDate?.()?.toLocaleDateString('es-MX') || '',
      KilosPedidos: data.expectedKilos || 0,
      KilosEntregados: data.receivedKilos || 0,
      PrecioPorKilo: data.pricePerKg || 0,
      Total: data.totalAmount || 0,
      Pagado: data.paidAmount || 0,
      Estatus: data.status || '',
      ID_SISTEMA: d.id,
    };
  });

  const expensesData = expensesSnap.docs.map(d => {
    const data = d.data();
    return {
      Concepto: data.concept || '',
      Tipo: data.type || '',
      Categoria: data.category || '',
      Monto: data.amount || 0,
      Fecha: data.date?.toDate?.()?.toLocaleDateString('es-MX') || '',
      ID_SISTEMA: d.id,
    };
  });

  const wb = XLSX.utils.book_new();
  
  const wsOrders = XLSX.utils.json_to_sheet(ordersData);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Auditoria_Cobranza');

  const wsPurchases = XLSX.utils.json_to_sheet(purchasesData);
  XLSX.utils.book_append_sheet(wb, wsPurchases, 'Auditoria_Compras');

  const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Auditoria_CajaChica');

  XLSX.writeFile(wb, `Sabana_Auditoria_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportTotalBusinessBackupExcel() {
  const XLSX = await import('xlsx');
  const [ordersSnap, purchasesSnap, expensesSnap] = await Promise.all([
    getDocs(collection(db, PATHS.orders)),
    getDocs(collection(db, PATHS.purchases)),
    getDocs(collection(db, PATHS.expenses)),
  ]);

  const ordersData: any[] = [];
  const invoicesData: any[] = [];

  ordersSnap.docs.forEach(d => {
    const o = d.data();
    const totalKilos = o.totalKilograms || 0;
    const deliveries = o.deliveries || [];
    const kilosEntregados = deliveries.reduce((a: number, del: any) => a + (del.kilos || 0), 0);
    const kilosPendientes = Math.max(0, totalKilos - kilosEntregados);

    ordersData.push({
      FolioOC: o.folio || o.oc || 'S/N',
      Cliente: o.client || 'Grupo Textil Providencia',
      FechaEstimadaEntrega: o.estimatedDeliveryDate?.toDate?.()?.toLocaleDateString('es-MX') || '',
      KilosPedidos: totalKilos,
      KilosEntregados: kilosEntregados,
      KilosPendientes: kilosPendientes,
      EstatusEntrega: kilosPendientes === 0 && totalKilos > 0 ? '100% Surtido' : 'En Proceso',
      ID_EXPEDIENTE: d.id,
    });

    (o.invoices || []).forEach((inv: any) => {
      const invTotal = inv.financials?.invoiceTotal ?? (inv.financials?.saleTotal ?? 0);
      const comision = inv.financials?.commission ?? (invTotal * 0.08);
      const neto = invTotal - comision;
      const pagado = inv.collection?.paidAmount ?? 0;

      const cr = extractCr(inv, o);
      const issueObj = toDate(inv.creditCycle?.issueDate);
      const dueObj = toDate(inv.creditCycle?.dueDate);

      invoicesData.push({
        FacturaFolio: inv.folio || 'S/N',
        FolioOC: o.folio || o.oc || 'S/N',
        Contrarecibo: cr,
        FechaEmision: issueObj ? issueObj.toLocaleDateString('es-MX') : '',
        FechaVencimientoCR: dueObj ? dueObj.toLocaleDateString('es-MX') : '',
        KilosAmparados: inv.kilos || 0,
        TotalFacturadoIVA: invTotal,
        ComisionContador8Pct: comision,
        NetoLimpioCaja: neto,
        MontoCobrado: pagado,
        SaldoPendiente: Math.max(0, invTotal - pagado),
        EstatusCobranza: inv.creditCycle?.status || 'pending',
      });
    });
  });

  const purchasesData = purchasesSnap.docs.map(d => {
    const data = d.data();
    return {
      FolioCompra: data.folio || 'S/N',
      Proveedor: data.provider || 'Andrés',
      Fecha: data.date?.toDate?.()?.toLocaleDateString('es-MX') || '',
      KilosPedidos: data.expectedKilos || 0,
      KilosEntregados: data.receivedKilos || 0,
      CostoPorKilo: data.pricePerKg || 42,
      TotalMaterial: data.totalAmount || 0,
      Pagado: data.paidAmount || 0,
      SaldoRestante: Math.max(0, (data.totalAmount || 0) - (data.paidAmount || 0)),
      Estatus: data.status || '',
    };
  });

  const expensesData = expensesSnap.docs.map(d => {
    const data = d.data();
    return {
      Fecha: data.date?.toDate?.()?.toLocaleDateString('es-MX') || '',
      Tipo: data.type || '',
      Concepto: data.concept || '',
      BeneficiarioProveedor: data.provider || '',
      Monto: data.amount || 0,
      Notas: data.notes || '',
    };
  });

  const wb = XLSX.utils.book_new();

  const wsOrders = XLSX.utils.json_to_sheet(ordersData);
  XLSX.utils.book_append_sheet(wb, wsOrders, '1_Ordenes_y_Kilos');

  const wsInvoices = XLSX.utils.json_to_sheet(invoicesData);
  XLSX.utils.book_append_sheet(wb, wsInvoices, '2_Facturas_y_Contrarecibos');

  const wsPurchases = XLSX.utils.json_to_sheet(purchasesData);
  XLSX.utils.book_append_sheet(wb, wsPurchases, '3_Compras_Andres');

  const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
  XLSX.utils.book_append_sheet(wb, wsExpenses, '4_Flujo_Caja_y_Socios');

  XLSX.writeFile(wb, `Respaldo_Total_ERP_Providencia_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportToHtml() {
  const ordersSnap = await getDocs(collection(db, PATHS.orders));
  const purchasesSnap = await getDocs(collection(db, PATHS.purchases));
  const expensesSnap = await getDocs(collection(db, PATHS.expenses));

  const data = {
    orders: ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    purchases: purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    expenses: expensesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };

  const response = await fetch('/respaldo/control-bolsas-offline.html');
  let html = await response.text();

  const dataScript = `
<script id="offline-data">
  window.OFFLINE_DB = ${JSON.stringify(data)};
  setTimeout(() => {
    if(window.DB) {
       const orig = window.DB.get;
       window.DB.get = async (k) => {
         if (k === 'control-bolsas-v4') {
            // Adapt the Firebase data to the v4 structure expected by this HTML
            const state = {
              version: 4,
              pedidos: [],
              proveedores: [],
              entregas: [],
              caja: window.OFFLINE_DB.expenses.map((e, i) => ({
                id: e.id, seq: i+1, fechaMovimiento: e.fecha || new Date().toISOString().slice(0,10),
                concepto: e.concept || '', categoria: e.category || '',
                tipo: e.type || 'egreso', monto: e.amount || 0
              })),
              facturas: window.OFFLINE_DB.orders.map((o, i) => ({
                id: o.id, seq: i+1, folio: o.Folio, cliente: o.Cliente,
                fechaFactura: o.Fecha, montoTotal: o.MontoVenta,
                estadoCobro: o.MontoVenta > 0 && o.Neto === o.MontoVenta ? 'Cobrado' : 'Pendiente'
              }))
            };
            return JSON.stringify(state);
         }
         return orig(k);
       };
    }
  }, 100);
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
