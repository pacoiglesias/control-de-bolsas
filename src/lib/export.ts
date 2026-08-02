import * as XLSX from 'xlsx';
import { collection, getDocs } from 'firebase/firestore';
import { db, PATHS } from './firebase';

export async function exportToExcel() {
  const ordersSnap = await getDocs(collection(db, PATHS.orders));
  const purchasesSnap = await getDocs(collection(db, PATHS.purchases));
  const expensesSnap = await getDocs(collection(db, PATHS.expenses));

  const ordersData: any[] = [];
  
  ordersSnap.docs.forEach(d => {
    const data = d.data();
    const invs = data.invoices || [];
    
    if (invs.length > 0) {
      invs.forEach((inv: any) => {
        const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const paid = inv.collection?.paidAmount ?? 0;
        ordersData.push({
          Cliente: data.client || '',
          FacturaFolio: inv.folio || '',
          Contrarecibo: inv.collection?.contrareciboNumber || '',
          Estatus: inv.creditCycle?.status || 'pedido',
          Kilos: inv.kilos || 0,
          MontoVenta: invTotal,
          MontoCobrado: paid,
          MontoPendiente: Math.max(invTotal - paid, 0),
          FechaVencimiento: inv.creditCycle?.dueDate?.toDate?.()?.toLocaleDateString('es-MX') || '',
          ID_SISTEMA: `${d.id}::${inv.id}`
        });
      });
    }
  });

  const purchasesData = purchasesSnap.docs.map(d => {
    const data = d.data();
    return {
      Proveedor: data.provider || '',
      Folio: data.folio || '',
      Estatus: data.status || '',
      Subtotal: data.subtotal || 0,
      IVA: data.iva || 0,
      Total: data.total || 0,
      FechaEmision: data.invoiceDate?.toDate?.()?.toLocaleDateString('es-MX') || '',
      FechaVencimiento: data.dueDate?.toDate?.()?.toLocaleDateString('es-MX') || '',
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
