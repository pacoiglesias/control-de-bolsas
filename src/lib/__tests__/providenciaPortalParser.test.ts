import { describe, it, expect } from 'vitest';
import { parseProvidenciaContrareciboHtml, parseProvidenciaPaymentDetailHtml } from '../providenciaPortalParser';

describe('parseProvidenciaContrareciboHtml', () => {
  it('parsea correctamente el volcado HTML del portal de Providencia con múltiples contrarecibos', () => {
    const rawHtml = `
<!-- saved from url=(0148)https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=12026TH-912&c=TH-912 -->
<html>
<body>
No. TH-912
<tr name="l_8630" id="l_8630"><td class="textgral_cr">6159</td><td class="textgral_cr">8 / 630</td><td class="textgral_cr">79,826.00</td><td class="textgral_cr">PMX</td></tr>
Fecha Recepción: <strong>10/08/2026</strong><br>Fecha Pago: <strong>09/09/2026</strong>
1|2026|TH-912|10/08/2026|EDE1902136T2|79826|09/09/2026
</body>
</html>
<!-- saved from url=(0148)https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=12026GT-874&c=GT-874 -->
<html>
<body>
No. GT-874
<tr name="l_2314" id="l_2314"><td class="textgral_cr">6193</td><td class="textgral_cr">2 / 314</td><td class="textgral_cr">49,880.00</td><td class="textgral_cr">PMX</td></tr>
Fecha Recepción: <strong>24/08/2026</strong><br>Fecha Pago: <strong>23/09/2026</strong>
1|2026|GT-874|24/08/2026|EDE1902136T2|49880|23/09/2026
</body>
</html>
    `;

    const results = parseProvidenciaContrareciboHtml(rawHtml);
    expect(results.length).toBe(2);

    expect(results[0].contrareciboNumber).toBe('TH-912');
    expect(results[0].facturaFolio).toBe('6159');
    expect(results[0].importe).toBe(79826.00);
    expect(results[0].fechaRecepcion).toBe('10/08/2026');
    expect(results[0].fechaPago).toBe('09/09/2026');
    expect(results[0].department).toBe('TH');

    expect(results[1].contrareciboNumber).toBe('GT-874');
    expect(results[1].facturaFolio).toBe('6193');
    expect(results[1].importe).toBe(49880.00);
    expect(results[1].fechaRecepcion).toBe('24/08/2026');
    expect(results[1].fechaPago).toBe('23/09/2026');
    expect(results[1].department).toBe('GT');
  });

  it('procesa fielmente los 4 contrarecibos oficiales pegados por el usuario (TH-912, TH-946, GT-874, TH-990)', () => {
    const rawPasted = `
    <!-- saved from url=(0148)https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=12026TH-912&c=TH-912 -->
    No. TH-912 <tr name="l_8630"><td class="textgral_cr">6159</td><td class="textgral_cr">8 / 630</td><td class="textgral_cr">79,826.00</td></tr> Fecha Recepción: <strong>10/08/2026</strong> Fecha Pago: <strong>09/09/2026</strong>
    <!-- saved from url=(0148)https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=12026TH-946&c=TH-946 -->
    No. TH-946 <tr name="l_8660"><td class="textgral_cr">6167</td><td class="textgral_cr">8 / 660</td><td class="textgral_cr">81,780.00</td></tr> Fecha Recepción: <strong>17/08/2026</strong> Fecha Pago: <strong>16/09/2026</strong>
    <!-- saved from url=(0148)https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=12026GT-874&c=GT-874 -->
    No. GT-874 <tr name="l_2314"><td class="textgral_cr">6193</td><td class="textgral_cr">2 / 314</td><td class="textgral_cr">49,880.00</td></tr> Fecha Recepción: <strong>24/08/2026</strong> Fecha Pago: <strong>23/09/2026</strong>
    <!-- saved from url=(0148)https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/consultar/?id=12026TH-990&c=TH-990 -->
    No. TH-990 <tr name="l_8678"><td class="textgral_cr">6198</td><td class="textgral_cr">8 / 678</td><td class="textgral_cr">98,054.60</td></tr> Fecha Recepción: <strong>24/08/2026</strong> Fecha Pago: <strong>23/09/2026</strong>
    `;

    const results = parseProvidenciaContrareciboHtml(rawPasted);
    expect(results.length).toBe(4);
    expect(results.map(r => r.contrareciboNumber)).toEqual(['TH-912', 'TH-946', 'GT-874', 'TH-990']);
    expect(results.map(r => r.facturaFolio)).toEqual(['6159', '6167', '6193', '6198']);
  });

  it('procesa la tabla completa de 8 contrarecibos del portal de Providencia', () => {
    const tableOcrText = `
    1 GT-874 24/08/2026 23/09/2026 49,880.00 0.00 49,880.00 PMX 1 GENERADO
    2 TH-990 24/08/2026 23/09/2026 98,054.60 0.00 98,054.60 PMX 1 GENERADO
    3 TH-946 17/08/2026 16/09/2026 81,780.00 0.00 81,780.00 PMX 1 GENERADO
    4 TH-912 10/08/2026 09/09/2026 79,826.00 0.00 79,826.00 PMX 1 GENERADO
    5 TH-879 03/08/2026 02/09/2026 136,300.00 0.00 136,300.00 PMX 1 GENERADO
    6 GT-742 20/07/2026 19/08/2026 54,520.00 0.00 54,520.00 PMX 1 GENERADO
    7 GT-713 13/07/2026 12/08/2026 69,001.60 0.00 69,001.60 PMX 1 GENERADO
    8 GT-651 29/06/2026 29/07/2026 106,477.56 0.00 106,477.56 PMX 1 GENERADO
    `;

    const results = parseProvidenciaContrareciboHtml(tableOcrText);
    expect(results.length).toBe(8);
    expect(results[0].contrareciboNumber).toBe('GT-874');
    expect(results[0].importe).toBe(49880.00);
    expect(results[4].contrareciboNumber).toBe('TH-879');
    expect(results[4].fechaPago).toBe('02/09/2026');
  });

  it('parsea con exactitud el detalle de pago de contrarecibo del portal de Providencia (TH-836)', () => {
    const rawPaymentHtml = `
<!-- saved from url=(0151)https://apps.mundoprovidencia.com/rHoyProvidencia/portal/proveedores/@CGI-SCRIPTS@PROV-WEBSITE@v1.0/contrarecibos/detalle-pago/?id=12026TH-836&c=TH-836 -->
<html><head><title>Providencia | Recepción CFDI &gt; Contrarecibos &gt; Detalle de Pago</title></head>
<body>
<legend class="textgral" align="right" style="color:#666666;"><strong>Contrarecibo: <u>TH-836</u> | Detalle de pago</strong></legend>
<table width="98%" border="0" align="center" cellpadding="3" cellspacing="1"><tbody>
<tr><td class="tables_list"># Pago</td><td class="tables_list">Banco Cargo</td><td class="tables_list">Cuenta</td><td class="tables_list">Banco Abono</td><td class="tables_list">Cuenta</td><td class="tables_list">Referencia</td><td class="tables_list">Importe</td><td class="tables_list">Moneda</td><td class="tables_list">TC</td><td class="tables_list">Doctos.</td><td class="tables_list">PDF</td><td class="tables_list">Observaciones</td></tr>
<tr class="over_project">
<td class="text_copyright">31/08/2026</td>
<td class="text_copyright">BANCOMER, SA 0102400200</td>
<td class="text_copyright">0102400200</td>
<td class="text_copyright">BAJIO</td>
<td class="text_copyright">0397356180201</td>
<td class="text_copyright">0064008513</td>
<td class="text_copyright">106,720.17</td>
<td class="text_copyright">PMX</td>
<td class="text_copyright">1</td>
<td class="text_copyright">1</td>
<td class="text_copyright"><a href="https://apps.mundoprovidencia.com/rHoyProvidencia/download/?sName=EDE1902136T2_C_4347.pdf&amp;sFile=contrarecibo" target="_blank">PDF</a></td>
<td class="text_copyright">PAGO FAC#6084</td>
</tr></tbody></table>
</body></html>
    `;

    const payment = parseProvidenciaPaymentDetailHtml(rawPaymentHtml);
    expect(payment).not.toBeNull();
    expect(payment?.contrareciboNumber).toBe('TH-836');
    expect(payment?.paymentDate).toBe('31/08/2026');
    expect(payment?.bancoAbono).toBe('BAJIO');
    expect(payment?.cuentaAbono).toBe('0397356180201');
    expect(payment?.transferRef).toBe('0064008513');
    expect(payment?.amount).toBe(106720.17);
    expect(payment?.facturaFolio).toBe('6084');
    expect(payment?.observaciones).toBe('PAGO FAC#6084');
    expect(payment?.department).toBe('TH');
  });
});
