import { money, fmtDateFull, fmtDateTimeFull } from './format';

// Convertidor de números a palabras en español para pesos mexicanos
export function numeroALetras(monto: number): string {
  if (isNaN(monto) || monto <= 0) return 'CERO PESOS 00/100 M.N.';

  const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const DECENAS_10 = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function convertirGrupo(n: number): string {
    let salida = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (n === 100) return 'CIEN';
    if (c > 0) salida += CENTENAS[c] + ' ';

    if (d === 1) {
      salida += DECENAS_10[u] + ' ';
    } else if (d === 2 && u > 0) {
      salida += 'VEINTI' + UNIDADES[u] + ' ';
    } else {
      if (d > 0) salida += DECENAS[d] + (u > 0 ? ' Y ' : ' ');
      if (u > 0) salida += UNIDADES[u] + ' ';
    }
    return salida.trim();
  }

  const enteros = Math.floor(monto);
  const centavos = Math.round((monto - enteros) * 100);
  const centavosTxt = centavos.toString().padStart(2, '0');

  if (enteros === 0) return `CERO PESOS ${centavosTxt}/100 M.N.`;

  let resultado = '';
  const millones = Math.floor(enteros / 1000000);
  const miles = Math.floor((enteros % 1000000) / 1000);
  const resto = enteros % 1000;

  if (millones === 1) resultado += 'UN MILLON ';
  else if (millones > 1) resultado += convertirGrupo(millones) + ' MILLONES ';

  if (miles === 1) resultado += 'MIL ';
  else if (miles > 1) resultado += convertirGrupo(miles) + ' MIL ';

  if (resto > 0) resultado += convertirGrupo(resto) + ' ';

  return `${resultado.trim()} PESOS ${centavosTxt}/100 M.N.`;
}

export interface AndresReceiptData {
  folio?: string;
  amount: number;
  concept: string;
  date: any;
  saldoAnterior?: number;
  saldoRestante?: number;
  payerName?: string;
}

export function generateAndresReceiptHtml(data: AndresReceiptData): string {
  const folioRecibo = data.folio || `REC-${Date.now().toString(36).toUpperCase()}`;
  const fechaAplicacion = fmtDateFull(data.date || new Date());
  const fechaEmisionExacta = fmtDateTimeFull(new Date());
  const montoLetras = numeroALetras(data.amount);
  const pagador = data.payerName || 'Administración / Socios Providencia';

  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px 32px; color: #0f172a; background: #fff; max-width: 800px; margin: 0 auto; font-size: 12px; line-height: 1.5;">
      
      <!-- ENCABEZADO OFICIAL -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 14px; margin-bottom: 18px;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #065f46; letter-spacing: -0.5px;">RECIBO OFICIAL DE PAGO Y LIQUIDACIÓN</div>
          <div style="font-size: 12px; color: #475569; font-weight: 700; margin-top: 2px;">BOLSAS ELEMENTAL / DISTRIBUIDORA PROVIDENCIA</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            Papalotla, Tlaxcala · Control de Maquila y Fabricación de Bolsa
          </div>
        </div>

        <div style="text-align: right; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 8px 16px; min-width: 220px;">
          <div style="font-size: 10px; font-weight: 800; color: #166534; text-transform: uppercase;">FOLIO DE COMPROBANTE</div>
          <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 2px; font-family: monospace;">${folioRecibo}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;"><strong>Fecha Pago:</strong> ${fechaAplicacion}</div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">Emisión: ${fechaEmisionExacta}</div>
        </div>
      </div>

      <!-- CUADRO PRINCIPAL DE MONTO -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">BUENO POR LA CANTIDAD DE:</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 4px;">
            (${montoLetras})
          </div>
        </div>
        <div style="text-align: right; background: #ffffff; border: 2px solid #059669; border-radius: 8px; padding: 10px 18px;">
          <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase;">IMPORTE ENTREGADO</div>
          <div style="font-size: 24px; font-weight: 900; color: #065f46; font-family: monospace;">
            ${money(data.amount)}
          </div>
        </div>
      </div>

      <!-- DETALLE DEL BENEFICIARIO Y CONCEPTO -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 800; color: #475569; width: 180px; background: #f8fafc;">BENEFICIARIO (PROVEEDOR):</td>
            <td style="padding: 10px 12px; font-weight: 900; color: #0f172a; font-size: 13px;">ANDRÉS (TALLER DE MAQUILA DE POLIETILENO)</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 800; color: #475569; background: #f8fafc;">PAGADO POR:</td>
            <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">${pagador}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 800; color: #475569; background: #f8fafc;">CONCEPTO DEL PAGO:</td>
            <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${data.concept}</td>
          </tr>
          ${data.saldoAnterior !== undefined && data.saldoRestante !== undefined ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 12px; font-weight: 800; color: #475569; background: #f8fafc;">ESTADO DE CUENTA CONCILIADO:</td>
              <td style="padding: 10px 12px;">
                <div style="display: flex; gap: 18px; font-size: 11.5px;">
                  <div>Saldo Anterior: <strong style="color: #b91c1c;">${money(data.saldoAnterior)}</strong></div>
                  <div>Abono Hoy: <strong style="color: #16a34a;">-${money(data.amount)}</strong></div>
                  <div>Saldo Restante: <strong style="color: ${data.saldoRestante > 0 ? '#b91c1c' : '#16a34a'};">${money(Math.abs(data.saldoRestante))}</strong></div>
                </div>
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>

      <!-- CLÁUSULA DE CONFORMIDAD -->
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 36px; font-size: 11px; color: #475569; text-align: justify;">
        <strong>Declaración de Conformidad:</strong> Recibí en efectivo / transferencia bancaria la cantidad especificada en el presente recibo a mi entera satisfacción y conformidad, aplicable a los servicios de maquila, fabricación y entrega de bolsa plástica convenidos con la empresa.
      </div>

      <!-- SECCIÓN DE FIRMAS -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; text-align: center;">
        <div>
          <div style="border-top: 1.5px solid #0f172a; padding-top: 8px; width: 85%; margin: 0 auto;">
            <div style="font-weight: 900; font-size: 12px; color: #0f172a;">ENTREGÓ CONFORME</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${pagador}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 1px;">Bolsas Elemental / Providencia</div>
          </div>
        </div>

        <div>
          <div style="border-top: 1.5px solid #0f172a; padding-top: 8px; width: 85%; margin: 0 auto;">
            <div style="font-weight: 900; font-size: 12px; color: #0f172a;">RECIBIÓ DE CONFORMIDAD</div>
            <div style="font-size: 12px; font-weight: 700; color: #065f46; margin-top: 2px;">ANDRÉS</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Prestador de Servicios de Maquila</div>
            <div style="font-size: 9.5px; color: #94a3b8; margin-top: 4px;">Firma y Fecha de Recibido</div>
          </div>
        </div>
      </div>

      <!-- PIE DE CONTROL -->
      <div style="margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8;">
        <div>Documento Interno de Control Administrativo y Auditoría Fiscal</div>
        <div>Generado electrónicamente por ERP Control de Bolsas · ${fechaEmisionExacta}</div>
      </div>

    </div>
  `;
}

export async function generateAndresReceiptPdf(data: AndresReceiptData): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const html = generateAndresReceiptHtml(data);
  const folioRecibo = data.folio || `REC-${Date.now().toString(36).toUpperCase()}`;

  const opt: any = {
    margin: [10, 10, 10, 10],
    filename: `Recibo_Pago_Andres_${folioRecibo}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
  };

  await html2pdf().set(opt).from(html).save();
}

export function printAndresReceipt(data: AndresReceiptData): void {
  const htmlContent = generateAndresReceiptHtml(data);
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Recibo de Pago - Andrés</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; background: #fff; }
            @page { size: letter portrait; margin: 12mm; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>
  `;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    alert('Por favor permite abrir ventanas emergentes para imprimir el recibo.');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
