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
    
    if (invs.length === 0) {
      ordersData.push({
        OrderID: d.id,
        InvoiceID: '',
        OrdenFolio: data.folio || '',
        Cliente: data.client || '',
        FacturaFolio: '',
        Contrarecibo: '',
        Estatus: 'pedido',
        Kilos: data.totalKilograms || 0,
        MontoVenta: data.financials?.invoiceTotal || data.financials?.saleTotal || 0,
        MontoCobrado: 0,
        MontoPendiente: data.financials?.invoiceTotal || data.financials?.saleTotal || 0,
        FechaEntrega: data.date?.toDate?.()?.toLocaleDateString() || '',
      });
    } else {
      invs.forEach((inv: any) => {
        const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const paid = inv.collection?.paidAmount ?? 0;
        ordersData.push({
          OrderID: d.id,
          InvoiceID: inv.id,
          OrdenFolio: data.folio || '',
          Cliente: data.client || '',
          FacturaFolio: inv.folio || '',
          Contrarecibo: inv.collection?.contrareciboNumber || '',
          Estatus: inv.creditCycle?.status || 'pedido',
          Kilos: inv.kilos || 0,
          MontoVenta: invTotal,
          MontoCobrado: paid,
          MontoPendiente: Math.max(invTotal - paid, 0),
          FechaVencimiento: inv.creditCycle?.dueDate?.toDate?.()?.toLocaleDateString() || '',
        });
      });
    }
  });

  const purchasesData = purchasesSnap.docs.map(d => {
    const data = d.data();
    return {
      ID: d.id,
      Proveedor: data.provider || '',
      Fecha: data.date?.toDate?.()?.toLocaleDateString() || '',
      KilosPedidos: data.expectedKilos || 0,
      KilosRecibidos: data.receivedKilos || 0,
      PrecioKg: data.pricePerKg || 0,
      MontoTotal: data.totalAmount || 0,
    };
  });

  const expensesData = expensesSnap.docs.map(d => {
    const data = d.data();
    return {
      ID: d.id,
      Tipo: data.type || '',
      Categoria: data.category || '',
      Monto: data.amount || 0,
      Fecha: data.date?.toDate?.()?.toLocaleDateString() || '',
      Concepto: data.concept || '',
    };
  });

  const wb = XLSX.utils.book_new();
  
  const wsOrders = XLSX.utils.json_to_sheet(ordersData);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Ventas_Clientes');

  const wsPurchases = XLSX.utils.json_to_sheet(purchasesData);
  XLSX.utils.book_append_sheet(wb, wsPurchases, 'Compras_Proveedores');

  const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Caja_Flujo');

  XLSX.writeFile(wb, `Respaldo_ERP_${new Date().toISOString().split('T')[0]}.xlsx`);
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
