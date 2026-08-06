export function generateOfflineHTML(data: any): string {
  const jsonData = JSON.stringify(data).replace(/</g, '\\u003c');
  const date = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snapshot ERP - ${date}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --text-soft: #94a3b8;
      --accent: #3b82f6;
      --ok: #10b981;
      --bad: #ef4444;
      --border: #334155;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
    }
    .header {
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { color: var(--text-soft); margin-top: 8px; }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    .card h3 { margin: 0 0 16px 0; color: var(--text-soft); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-size: 32px; font-weight: 700; }
    .value.ok { color: var(--ok); }
    .value.bad { color: var(--bad); }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border-radius: 12px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: rgba(255,255,255,0.02);
      color: var(--text-soft);
      font-size: 12px;
      text-transform: uppercase;
    }
    .status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 600;
    }
    .status.pending { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
    .status.paid { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Control Bolsas - Snapshot Portátil (Solo Lectura)</h1>
    <p>Exportado el: ${date}</p>
  </div>

  <div class="grid" id="kpis"></div>

  <h2 style="margin-top: 40px; margin-bottom: 16px;">Órdenes Recientes (Top 50)</h2>
  <div style="border: 1px solid var(--border); border-radius: 12px; overflow-x: auto;">
    <table>
      <thead>
        <tr>
          <th>OC</th>
          <th>Cliente</th>
          <th>Estado</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody id="ordersTable"></tbody>
    </table>
  </div>

  <script>
    const snapshotData = ${jsonData};
    const { kpis, orders } = snapshotData;

    const money = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

    // Llenar KPIs
    const kpisDiv = document.getElementById('kpis');
    kpisDiv.innerHTML = \`
      <div class="card">
        <h3>Caja Chica Actual</h3>
        <div class="value ok">\${money(kpis.cajaChica)}</div>
      </div>
      <div class="card">
        <h3>Capital en Tránsito</h3>
        <div class="value">\${money(kpis.enTransito)}</div>
      </div>
      <div class="card">
        <h3>Cuentas por Cobrar</h3>
        <div class="value bad">\${money(kpis.porCobrar)}</div>
      </div>
    \`;

    // Llenar Tabla
    const ordersTbody = document.getElementById('ordersTable');
    const recentOrders = orders.sort((a,b) => b.folio.localeCompare(a.folio)).slice(0, 50);
    
    ordersTbody.innerHTML = recentOrders.map(o => {
      const isPaid = o.financials.paidToSupplier >= o.financials.costTotal;
      return \`
        <tr>
          <td><strong>\${o.folio}</strong></td>
          <td>\${o.client?.name || 'S/N'}</td>
          <td><span class="status \${isPaid ? 'paid' : 'pending'}">\${isPaid ? 'Pagada' : 'Adeudo'}</span></td>
          <td style="font-family: monospace;">\${money(o.financials.invoiceTotal)}</td>
        </tr>
      \`;
    }).join('');

    console.log("Datos Offline Cargados exitosamente", snapshotData);
  </script>
</body>
</html>`;
}
