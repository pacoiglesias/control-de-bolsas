import { useMemo, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useConfig } from '../../hooks/useConfig';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { Card, Empty, KpiCard, Skeleton, StatusBadge } from '../ui';
import OrderModal from '../OrderModal';
import CobranzaContext from './CobranzaContext';
import CobranzaStats from './CobranzaStats';
import AgingTable from './AgingTable';
import ProximasTable from './ProximasTable';
import EstadoCuenta from './EstadoCuenta';
import { AGING_BUCKETS, agingBucket, daysLate, getOrderSummary, round2, type AgingKey } from '../../lib/finance';
import { escapeHtml, fmtDate, money, toDate, exportToCsv, getPrintHeaderHtml, shareHtmlAsPdf } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { doc, Timestamp, collection, runTransaction } from 'firebase/firestore';
import type { Invoice } from '../../lib/types';
import { db, PATHS } from '../../lib/firebase';
import { camposInvoices, aplicarPorId } from '../../lib/invoiceOps';
import { useToast } from '../../context/ToastContext';
import { logAction } from '../../lib/logger';
import { sound } from '../../lib/sounds';
import type { PurchaseOrder } from '../../lib/types';

export default function Cobranza() {
  const { role, user } = useAuth();
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const toast = useToast();
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  
  const [activeTab, setActiveTab] = useState<'pendientes' | 'pagadas' | 'recogidas' | 'contabilidad' | 'estado_cuenta'>('pendientes');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'vencidos' | 'sincr' | 'enplazo'>('todos');

  function copyReminder(order: PurchaseOrder, inv: Invoice, d: number | null) {
    const folioStr = inv.folio || order.folio || '(sin folio)';
    const crStr = inv.collection?.contrareciboNumber || order.collection?.contrareciboNumber || 'SIN-CR';
    const monto = money(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
    const dias = (d ?? 0) > 0 ? `${d} días de atraso` : 'próximo a vencer';

    const msg = `Estimado cliente (${order.client || 'Cliente'}), le enviamos un cordial saludo. Le recordamos amablemente la factura / folio ${folioStr} (Contrarecibo: ${crStr}) por el monto de ${monto}, el cual cuenta con ${dias}. Agradecemos su confirmación de fecha de pago. Atentamente, Grupo Textil Providencia.`;

    void navigator.clipboard.writeText(msg);
    sound.playSuccess();
    toast('📋 Recordatorio de cobro copiado al portapapeles. Listo para enviar por Correo/WhatsApp.', 'ok');
  }

  function exportCobranzaCsv() {
    const headers = ['Folio', 'Cliente', 'Contrarecibo', 'Vencimiento', 'Días Atraso', 'Monto Venta con IVA', 'Estado'];
    const rows = data.lista.map(x => [
      x.inv.folio || x.o.folio || '',
      x.o.client || '',
      x.cr || '',
      fmtDate(x.inv.creditCycle.dueDate),
      x.d ?? 0,
      (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toFixed(2),
      x.inv.creditCycle.status
    ]);
    exportToCsv(`Cobranza_Providencia_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('📥 Archivo de Excel (CSV) descargado con éxito.', 'ok');
  }

  // camposInvoices() y aplicarPorId() viven en lib/invoiceOps.ts: OrderModal
  // las necesita igual y antes tenia su propio camino para escribir
  // invoiceStatuses, con riesgo de divergir de este.

  async function toggleComplementStatus(orderId: string, invoiceId: string) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    const invIndex = o.invoices?.findIndex(i => i.id === invoiceId);
    if (invIndex === undefined || invIndex < 0) return;
    
    const inv = o.invoices![invIndex];
    const current = inv.collection?.complementStatus;
    const nextStatus = current === 'issued' ? 'pending' : 'issued';

    try {
      // Transaccion: se relee el expediente dentro de la operacion y el cambio
      // se aplica por id de factura. Con el patron anterior se escribia el
      // arreglo completo desde una copia local del snapshot, asi que dos
      // usuarios simultaneos —o un usuario y el procesador de complementos
      // XML— se pisaban: el ultimo en escribir borraba lo del otro.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe');

        const actuales: Invoice[] = snap.data().invoices ?? [];
        const nuevas = aplicarPorId(actuales, invoiceId, (x) => ({
          ...x,
          collection: { ...x.collection, complementStatus: nextStatus },
        }));
        if (!nuevas) throw new Error('La factura ya no está en el expediente');

        tx.update(ref, camposInvoices(nuevas));
      });
      toast(`Complemento marcado como ${nextStatus === 'issued' ? 'Emitido' : 'Pendiente'}`, 'ok');
    } catch (e) {
      toast(`Error al actualizar complemento: ${(e as Error).message}`, 'bad');
    }
  }

  async function payContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!window.confirm(`¿Seguro que quieres cobrar todas las facturas pendientes del Contrarecibo ${crNumber}?`)) return;
    
    const doctoSap = window.prompt('Docto. SAP (Opcional):') || '';
    const doctoPago = window.prompt('Docto. Pago (Opcional, ej. TR_3583):') || '';

    const invoicesToPay = data.open.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    // Que facturas hay que tocar en cada expediente. Los datos frescos se
    // leen dentro de la transaccion, no de este snapshot.
    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToPay) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    try {
      // writeBatch garantizaba atomicidad (todo o nada) pero no aislamiento:
      // seguia escribiendo el arreglo completo desde una copia local. La
      // transaccion relee cada expediente y aplica los cambios por id.
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        // Firestore exige TODAS las lecturas antes de cualquier escritura.
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'paid' },
              collection: {
                ...x.collection,
                paidAmount: x.financials?.invoiceTotal ?? x.financials?.saleTotal ?? 0,
                paidAt: Timestamp.now(),
                sapDocument: doctoSap,
                paymentDocument: doctoPago
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      toast(`Contrarecibo ${crNumber} cobrado exitosamente`, 'ok');
    } catch (e) {
      toast(`Error al procesar el cobro en bloque: ${(e as Error).message}`, 'bad');
    }
  }

  async function undoContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!window.confirm(`¿Seguro que quieres DESHACER el cobro del Contrarecibo ${crNumber}? Las facturas volverán a pendientes.`)) return;
    
    const invoicesToUndo = data.paid.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToUndo) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'pending' },
              collection: {
                ...x.collection,
                paidAmount: 0,
                paidAt: null,
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      toast(`Cobro del Contrarecibo ${crNumber} deshecho.`, 'ok');
    } catch (e) {
      toast(`Error al deshacer cobro: ${(e as Error).message}`, 'bad');
    }
  }

  async function collectContrareciboBlock(crNumber: string, netCobrado: number) {
    if (!crNumber) return;
    if (!window.confirm(`¿Recibiste el EFECTIVO/TRANSFERENCIA del Contrarecibo ${crNumber}? Se registrará un Ingreso por $${netCobrado.toLocaleString('es-MX', {minimumFractionDigits:2})} en CAJA.`)) return;

    // Referencia de la transferencia (ej. "TR_3583"), distinta del numero de
    // contrarecibo (ej. "GT-570"): sin ella no se puede conciliar el deposito
    // contra el estado de cuenta bancario despues.
    const transferRef = (window.prompt('Referencia de la transferencia (opcional, ej. TR_3583):') || '').trim();

    const invoicesToCollect = data.paid.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    const objetivo: Record<string, string[]> = {};
    for (const { o, inv } of invoicesToCollect) {
      (objetivo[o.id] ??= []).push(inv.id);
    }

    // Declarado FUERA de la transaccion: el toast de exito de abajo necesita
    // leerlo despues de que runTransaction termine, y una variable `let`
    // declarada dentro del callback no existe fuera de el. Esto no compilaba.
    let netCobradoReal = 0;

    try {
      // El movimiento de Caja Chica va DENTRO de la misma transaccion que el
      // cambio de estatus. Si se separaran, un fallo a la mitad podria dejar
      // el ingreso registrado sin las facturas marcadas, o al reves.
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        // netCobrado se recalcula AQUI, con los datos releidos dentro de la
        // transaccion, en vez de usar el parametro que llega desde el render.
        // Antes viajaba tal cual desde la pantalla: si el saneador nocturno,
        // un complemento XML u otro usuario tocaban financials entre el render
        // y el clic, el ingreso inyectado en Caja Chica quedaba desactualizado
        // y nada lo detectaba despues.
        netCobradoReal = 0;

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const inv = invoices.find((x) => x.id === invoiceId);
            if (inv) {
              const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
              const comision = inv.financials?.commission ?? 0;
              // Lo que entra a Caja Chica: la factura completa menos el
              // honorario del contador. Sin restar el costo del material.
              netCobradoReal += invTotal - comision;
            }
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'collected' },
              collection: { ...x.collection, collectedAt: Timestamp.now(), transferRef: transferRef || x.collection?.transferRef || '' },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });

        netCobradoReal = round2(netCobradoReal);

        // Un peso de tolerancia por redondeo; mas que eso significa que algo
        // cambio de verdad entre el render y el clic.
        if (Math.abs(netCobradoReal - netCobrado) > 1) {
          throw new Error(
            `El importe cambió desde que se mostró en pantalla ` +
            `($${netCobrado.toFixed(2)} → $${netCobradoReal.toFixed(2)}). ` +
            `Cierra este cuadro, revisa el Contrarecibo ${crNumber} e intenta de nuevo.`,
          );
        }

        tx.set(doc(collection(db, PATHS.expenses)), {
          date: Timestamp.now(),
          concept: `Cobro del Contrarecibo ${crNumber}`,
          type: 'ingreso',
          amount: netCobradoReal,
          createdAt: Timestamp.now(),
        });
      });
      toast(`💰 Contrarecibo ${crNumber} recogido ($${netCobradoReal.toLocaleString('es-MX', {minimumFractionDigits:2})} ingresados a CAJA). Se movió a la pestaña "Historial: Recogidos" donde puedes deshacerlo en cualquier momento.`, 'ok', {
        label: '↩️ Deshacer',
        onClick: () => revertCollectedContrareciboBlock(crNumber)
      });
    } catch (e) {
      toast(`Error al procesar la recolección en bloque: ${(e as Error).message}`, 'bad');
    }
  }

  async function revertCollectedContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!window.confirm(`¿DESHACER RECOLECCIÓN del Contrarecibo ${crNumber}? El lote regresará a "Por Recoger Dinero" y se registrará un egreso de reversión en CAJA.`)) return;
    
    const invoicesToRevert = data.collected.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    const objetivo: Record<string, string[]> = {};
    let totalRevertir = 0;
    for (const { o, inv } of invoicesToRevert) {
      (objetivo[o.id] ??= []).push(inv.id);
      const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * config.salePricePerKg * (1 + config.ivaRate));
      const comision = inv.financials?.commission ?? (inv.kilos * config.salePricePerKg * config.commissionRate);
      totalRevertir += (invTotal - comision);
    }

    if (Object.keys(objetivo).length === 0) {
      toast('No se encontraron facturas recogidas para este contrarecibo.', 'bad');
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              creditCycle: { ...x.creditCycle, status: 'paid' },
              collection: {
                ...x.collection,
                collectedAt: null,
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });

        tx.set(doc(collection(db, PATHS.expenses)), {
          date: Timestamp.now(),
          concept: `Reversión de Recolección Contrarecibo ${crNumber}`,
          type: 'egreso',
          amount: round2(totalRevertir),
          createdAt: Timestamp.now(),
        });
      });

      logAction(user?.email, 'Reversión de Recolección', { contrarecibo: crNumber, monto: totalRevertir });
      sound.playPop();
      toast(`↩️ Recolección del Contrarecibo ${crNumber} revertida. Regresado a "Por Recoger" y egreso por $${totalRevertir.toLocaleString('es-MX', {minimumFractionDigits:2})} registrado en CAJA.`, 'ok');
    } catch (e) {
      sound.playError();
      toast(`Error al revertir la recolección: ${(e as Error).message}`, 'bad');
    }
  }

  async function liquidateAccountantBlock(crNumber: string) {
    if (!crNumber) return;
    if (!window.confirm(`¿Seguro que quieres MARCAR como pagada (liquidada) la comisión al contador para el CR ${crNumber}?`)) return;

    // Buscamos todas las facturas de ese CR (que esten paid o collected)
    const allCrInvoices = [...data.paid, ...data.collected].filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    const objetivo: Record<string, string[]> = {};
    let hasPending = false;
    for (const { o, inv } of allCrInvoices) {
      if (!inv.collection?.accountantLiquidated) {
        (objetivo[o.id] ??= []).push(inv.id);
        hasPending = true;
      }
    }

    if (!hasPending) {
      toast('Todas las comisiones de este contrarecibo ya estaban liquidadas.', 'info');
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const refs = Object.keys(objetivo).map((id) => ({
          id,
          ref: doc(db, PATHS.orders, id),
        }));
        const snaps = await Promise.all(refs.map(({ ref }) => tx.get(ref)));

        refs.forEach(({ id, ref }, k) => {
          const snap = snaps[k];
          if (!snap.exists()) return;
          let invoices: Invoice[] = snap.data().invoices ?? [];
          for (const invoiceId of objetivo[id]) {
            const nuevas = aplicarPorId(invoices, invoiceId, (x) => ({
              ...x,
              collection: { 
                ...x.collection, 
                accountantLiquidated: true, 
                accountantLiquidatedAt: Timestamp.now() 
              },
            }));
            if (nuevas) invoices = nuevas;
          }
          tx.update(ref, camposInvoices(invoices));
        });
      });
      sound.playSuccess();
      toast(`✅ Comisiones del Contrarecibo ${crNumber} liquidadas a contabilidad`, 'ok');
    } catch (e) {
      sound.playError();
      toast(`Error al liquidar comisiones: ${(e as Error).message}`, 'bad');
    }
  }

  function getCobranzaGlobalHtml() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte Global de Cobranza</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Reporte Global de Cobranza y Cuentas por Cobrar")}
          
          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TE DEBEN</div><div class="kpi-val">$${data.meDeben.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">VENCIDO</div><div class="kpi-val" style="color: #b91c1c;">$${data.vencido.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">COBRADO (CON CONTADOR)</div><div class="kpi-val" style="color: #047857;">$${data.cobrado.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">COMISIONES</div><div class="kpi-val" style="color: #b45309;">$${data.comisiones.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <h3>1. Facturas Pendientes de Cobro (${data.open.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Vencimiento</th><th class="num">Monto Venta</th>
              </tr>
            </thead>
            <tbody>
              ${data.open.map(x => `
                <tr>
                  <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                  <td>${escapeHtml(x.o.client || '—')}</td>
                  <td>${escapeHtml(x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '—')}</td>
                  <td>${fmtDate(x.inv.creditCycle.dueDate) || '—'}</td>
                  <td class="num">$${(x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3>2. Contrarecibos Cobrados (Por Recoger Efectivo - ${data.paid.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th class="num">Utilidad a Ingresar</th>
              </tr>
            </thead>
            <tbody>
              ${data.paid.map(x => {
                const cr = x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '';
                const grp = cr ? data.listaCr.find(g => g.cr === cr) : null;
                return `
                  <tr>
                    <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                    <td>${escapeHtml(x.o.client || '—')}</td>
                    <td>${escapeHtml(cr || '—')}</td>
                    <td class="num">$${(grp ? grp.netCobrado : (x.inv.financials?.invoiceTotal ?? 0)).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <h3>3. Historial de Recolecciones en CAJA (${data.collected.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Estado</th><th class="num">Monto Venta</th>
              </tr>
            </thead>
            <tbody>
              ${data.collected.map(x => `
                <tr>
                  <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                  <td>${escapeHtml(x.o.client || '—')}</td>
                  <td>${escapeHtml(x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '—')}</td>
                  <td>Recogido (En CAJA)</td>
                  <td class="num">$${(x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
  }

  function printCobranzaGlobalReport() {
    const html = getCobranzaGlobalHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCobranzaGlobalReport() {
    const html = getCobranzaGlobalHtml();
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CobranzaGlobal_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function getCarteraVencidaHtml(overdueItems: any[], totalVencido: number) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Cartera Vencida</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #fef2f2; border: 1px solid #fca5a5; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #991b1b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #7f1d1d; letter-spacing: -0.02em; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Reporte de Cartera Vencida (Alarma)")}
          
          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TOTAL VENCIDO</div><div class="kpi-val">$${totalVencido.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">FACTURAS VENCIDAS</div><div class="kpi-val">${overdueItems.length}</div></div>
          </div>

          <h3>Detalle de Cuentas Atrasadas</h3>
          <table>
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Días Atraso</th><th class="num">Monto Vencido</th>
              </tr>
            </thead>
            <tbody>
              ${overdueItems.length > 0 ? overdueItems.map(x => `
                <tr>
                  <td>${escapeHtml(x.inv.folio || x.o.folio || '—')}</td>
                  <td><strong>${escapeHtml(x.o.client || '—')}</strong></td>
                  <td>${escapeHtml(x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber || '—')}</td>
                  <td style="color: #b91c1c; font-weight: 600;">Hace ${daysLate(toDate(x.inv.creditCycle.dueDate))} días</td>
                  <td class="num" style="color: #b91c1c; font-weight: bold;">$${(x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align: center;">No hay cartera vencida</td></tr>'}
            </tbody>
          </table>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
  }

  function printCarteraVencida() {
    const overdueItems = data.open.filter(x => {
      const late = daysLate(toDate(x.inv.creditCycle.dueDate));
      return late !== null && late > 0;
    });
    const totalVencido = overdueItems.reduce((sum, x) => sum + (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0);

    const html = getCarteraVencidaHtml(overdueItems, totalVencido);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCarteraVencida() {
    const overdueItems = data.open.filter(x => {
      const late = daysLate(toDate(x.inv.creditCycle.dueDate));
      return late !== null && late > 0;
    });
    const totalVencido = overdueItems.reduce((sum, x) => sum + (x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0);

    const html = getCarteraVencidaHtml(overdueItems, totalVencido);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CarteraVencida_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function getConsolidatedCrHtml(grp: any) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Cobro - CR ${escapeHtml(grp.cr)}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 14px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin: 30px 0; font-size: 14px; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #cbd5e1; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
            .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; margin-bottom: 40px; width: 400px; margin-left: auto; }
            .summary-line { display: flex; justify-content: space-between; margin-bottom: 12px; }
            .summary-line.total { border-top: 2px solid #94a3b8; padding-top: 12px; font-weight: 800; font-size: 18px; color: #0f172a; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 250px; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Notificación de Cobro y Liquidación Comercial", `Contrarecibo: ${escapeHtml(grp.cr)} - Cliente: ${escapeHtml(grp.client)}`)}

          <div class="meta-grid">
            <div>
              <strong>Contrarecibo (CR):</strong> ${escapeHtml(grp.cr)}<br>
              <strong>Cliente:</strong> ${escapeHtml(grp.client)}<br>
              <strong>Factura(s):</strong> ${grp.folios.map((f: any) => '#' + escapeHtml(f)).join(', ') || '—'}
            </div>
            <div style="text-align:right;">
              <strong>Proveedor Fabricante:</strong> Andrés (Sin Mermas)<br>
              <strong>Kilos Entregados:</strong> ${grp.totalKilos.toLocaleString('es-MX')} kg<br>
              <strong>Estado Cobro:</strong> ${escapeHtml(grp.status)}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Concepto / Referencia</th>
                <th style="text-align:right;">Kilos</th>
                <th style="text-align:right;">Venta Facturada</th>
                <th style="text-align:right;">Costo Andrés</th>
                <th style="text-align:right;">Comisión Contador</th>
                <th style="text-align:right;">Utilidad Líquida Real</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Contrarecibo ${escapeHtml(grp.cr)} (${grp.folios.map((f: any) => '#' + escapeHtml(f)).join(', ')})</td>
                <td style="text-align:right;">${grp.totalKilos.toLocaleString('es-MX')} kg</td>
                <td style="text-align:right;">$${grp.totalVenta.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;color:#8A5A1E;">-$${grp.costoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;color:#B23A2E;">-$${grp.comisionContador.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                <td style="text-align:right;font-weight:700;color:#2F7A52;">$${grp.netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-line"><span>Total Facturado a Cliente (${escapeHtml(grp.client)}):</span><strong>$${grp.totalVenta.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line"><span>Costo Directo Fabricante Andrés (Sin mermas):</span><span style="color:#8A5A1E;">-$${grp.costoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span>Comisión Contador / Contabilidad:</span><span style="color:#B23A2E;">-$${grp.comisionContador.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span><strong>DEPÓSITO QUE RECIBES</strong> (factura menos comisión):</span><strong style="color:#2F7A52;">$${grp.netCobrado.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line total">
              <span>UTILIDAD LÍQUIDA REAL (MARGEN: ${grp.margenPct.toFixed(2)}%):</span>
              <span>$${grp.netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">Firma y Sello de Recepción Cliente</div>
            <div class="sig-box">Autorización de Cobro y Entrada CAJA</div>
          </div>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
  }

  function printConsolidatedCr(grp: any) {
    const html = getConsolidatedCrHtml(grp);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareConsolidatedCr(grp: any) {
    const html = getConsolidatedCrHtml(grp);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Contrarecibo_${grp.cr}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  const data = useMemo(() => {
    // Extraer todas las facturas de todos los expedientes
    const allInvoices = orders.flatMap((o) => {
      const s = getOrderSummary(o);
      return s.invoices.map((inv) => ({ o, inv }));
    });

    const paid = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'paid',
    );

    const collected = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'collected',
    );

    const open = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'pending' || x.inv.creditCycle.status === 'overdue',
    );

    const saldo = (inv: (typeof allInvoices)[number]['inv']) =>
      Math.max((inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0) - (inv.collection?.paidAmount ?? 0), 0);

    const porCliente: Record<string, Record<AgingKey, number> & { total: number }> = {};
    open.forEach(({ o, inv }) => {
      const c = `${o.client?.trim() || '(sin cliente)'}${o.department ? ` - ${o.department}` : ''}`;
      porCliente[c] = porCliente[c] ?? { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0 };
      const b = agingBucket(toDate(inv.creditCycle.dueDate));
      const s = saldo(inv);
      porCliente[c][b] += s;
      porCliente[c].total += s;
    });
    const clientes = Object.keys(porCliente).sort((a, b) => porCliente[b].total - porCliente[a].total);

    const totalPorBucket = AGING_BUCKETS.reduce(
      (acc, b) => ({ ...acc, [b.key]: clientes.reduce((a, c) => a + porCliente[c][b.key], 0) }),
      {} as Record<AgingKey, number>,
    );

    const crCounts: Record<string, number> = {};
    open.forEach(({ o, inv }) => {
      const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
      if (cr) {
        crCounts[cr] = (crCounts[cr] || 0) + 1;
      }
    });

    // Agrupar facturas por número de Contrarecibo (CR) para calcular la Utilidad Líquida Real
    const crGroups: Record<string, {
      cr: string;
      client: string;
      folios: string[];
      totalKilos: number;
      totalVenta: number;
      costoAndres: number;
      comisionContador: number;
      netUtilidad: number;
      netCobrado: number;
      margenPct: number;
      status: string;
      order: PurchaseOrder;
    }> = {};

    allInvoices.forEach(({ o, inv }) => {
      const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || 'SIN-CR').trim();
      if (!crGroups[cr]) {
        crGroups[cr] = {
          cr,
          client: o.client || '—',
          folios: [],
          totalKilos: 0,
          totalVenta: 0,
          costoAndres: 0,
          comisionContador: 0,
          netUtilidad: 0,
          netCobrado: 0,
          margenPct: 0,
          status: inv.creditCycle.status,
          order: o,
        };
      }
      const grp = crGroups[cr];
      if (inv.folio && !grp.folios.includes(inv.folio)) grp.folios.push(inv.folio);
      
      const invTotal = inv.financials?.invoiceTotal ?? (inv.kilos * config.salePricePerKg * (1 + config.ivaRate));
      const costAndres = inv.financials?.costTotal ?? (inv.kilos * config.costPricePerKg);
      const comm = inv.financials?.commission ?? (inv.kilos * config.salePricePerKg * config.commissionRate);

      grp.totalKilos += inv.kilos || 0;
      grp.totalVenta += invTotal;
      grp.costoAndres += costAndres;
      grp.comisionContador += comm;
    });

    Object.values(crGroups).forEach(grp => {
      // netUtilidad es un INDICADOR de margen (venta - costo - honorario).
      // netCobrado es el DINERO QUE ENTRA: el cliente paga la factura completa
      // y el contador solo descuenta su honorario. El costo del material NO se
      // resta aqui: se paga a Andres por separado desde Compras, que ya genera
      // su propio egreso. Restarlo tambien aqui lo contaba dos veces.
      grp.netUtilidad = grp.totalVenta - grp.costoAndres - grp.comisionContador;
      grp.netCobrado = round2(grp.totalVenta - grp.comisionContador);
      grp.margenPct = grp.totalVenta > 0 ? (grp.netUtilidad / grp.totalVenta) * 100 : 0;
    });

    const listaCr = Object.values(crGroups).sort((a, b) => b.totalVenta - a.totalVenta);

    const lista = open
      .map(({ o, inv }) => {
        const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
        const hasCr = cr.length > 0;
        const d = daysLate(toDate(inv.creditCycle.dueDate));
        return { o, inv, d, saldo: saldo(inv), hasCr, cr };
      })
      .sort((a, b) => {
        // Prioridad: Sin CR primero (urgentes), luego por días de vencimiento descendente
        if (a.hasCr !== b.hasCr) return a.hasCr ? 1 : -1;
        return (b.d ?? -999) - (a.d ?? -999);
      });

    return {
      open,
      paid,
      collected,
      lista,
      listaCr,
      clientes,
      porCliente,
      totalPorBucket,
      crCounts,
      meDeben: open.reduce((a, x) => a + saldo(x.inv), 0),
      vencido: open
        .filter((x) => x.inv.creditCycle.status === 'overdue')
        .reduce((a, x) => a + saldo(x.inv), 0),
      cobrado: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid' || x.inv.creditCycle.status === 'collected')
        .reduce((a, x) => a + (x.inv.collection?.paidAmount ?? x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0),
      comisiones: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid' || x.inv.creditCycle.status === 'collected')
        .reduce((a, x) => a + (x.inv.financials?.commission ?? (x.inv.kilos * config.salePricePerKg * config.commissionRate)), 0),
      proyeccion7d: open
        .filter((x) => {
          const d = daysLate(toDate(x.inv.creditCycle.dueDate));
          return d !== null && d <= 0 && d >= -7;
        })
        .reduce((a, x) => a + saldo(x.inv), 0),
      proyeccion15d: open
        .filter((x) => {
          const d = daysLate(toDate(x.inv.creditCycle.dueDate));
          return d !== null && d <= 0 && d >= -15;
        })
        .reduce((a, x) => a + saldo(x.inv), 0),
    };
  }, [orders, config]);

  const filteredLista = useMemo(() => {
    let list = data.lista;
    
    if (filterType === 'vencidos') {
      list = list.filter(x => (x.d ?? 0) > 0);
    } else if (filterType === 'sincr') {
      list = list.filter(x => !x.hasCr);
    } else if (filterType === 'enplazo') {
      list = list.filter(x => (x.d ?? 0) <= 0 && x.hasCr);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(x => 
      (x.inv.folio?.toLowerCase() || '').includes(q) ||
      (x.o.folio?.toLowerCase() || '').includes(q) ||
      (x.o.client?.toLowerCase() || '').includes(q) ||
      (x.cr?.toLowerCase() || '').includes(q)
    );
  }, [data.lista, search, filterType]);

  if (loading) {
    return (
      <>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 250, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: 350, height: 16 }} />
        </div>
        <CobranzaStats />
        <Card>
          <div style={{ padding: 20 }}>
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 48, marginBottom: 8 }} />)}
          </div>
        </Card>
      </>
    );
  }
  if (role === 'viewer') return <Navigate to="/" replace />;
  if (error) return <div className="alert bad">{error}</div>;


  const ctx = {
    data, settings, money, activeTab, setActiveTab, shareCarteraVencida, printCarteraVencida, exportCobranzaCsv,
    shareCobranzaGlobalReport, printCobranzaGlobalReport, search, setSearch, filteredLista,
    payContrareciboBlock, undoContrareciboBlock, collectContrareciboBlock, revertCollectedContrareciboBlock,
    liquidateAccountantBlock, toggleComplementStatus, copyReminder, printConsolidatedCr, shareConsolidatedCr,
    filterType, setFilterType, setSelected
  };

  return (
    <CobranzaContext.Provider value={ctx}>
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Contrarecibos / Cobranza</h1>
          <p>
            Lo que te deben, ordenado por antigüedad. Una orden deja de contar aquí en cuanto la
            marcas como cobrada; la comisión de contabilidad ya viene descontada del flujo neto.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareCarteraVencida}>
              <span className="icon">📤</span> PDF (Cartera Vencida)
            </button>
            <button className="btn" style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c', fontWeight: 600 }} onClick={printCarteraVencida}>
              🚨 Cartera Vencida (Imprimir)
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareCobranzaGlobalReport}>
              <span className="icon">📤</span> Compartir PDF
            </button>
            <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printCobranzaGlobalReport}>
              📈 Imprimir Todo (General)
            </button>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20, marginTop: 20 }}>
        <button className={`tab ${activeTab === 'pendientes' ? 'active' : ''}`} onClick={() => setActiveTab('pendientes')}>
          ⏳ Pendientes de Cobro ({data.open.length})
        </button>
        <button className={`tab ${activeTab === 'pagadas' ? 'active' : ''}`} onClick={() => setActiveTab('pagadas')}>
          🏃‍♂️ Por Recoger Efectivo ({data.paid.length})
        </button>
        <button className={`tab ${activeTab === 'recogidas' ? 'active' : ''}`} onClick={() => setActiveTab('recogidas')}>
          🗄️ Historial: Recogidos ({data.collected.length})
        </button>
        <button className={`tab ${activeTab === 'contabilidad' ? 'active' : ''}`} onClick={() => setActiveTab('contabilidad')}>
          🧾 Liquidación a Contabilidad
        </button>
        <button className={`tab ${activeTab === 'estado_cuenta' ? 'active' : ''}`} onClick={() => setActiveTab('estado_cuenta')}>
          🪞 Estado de Cuenta (Espejo)
        </button>
      </div>

      {activeTab === 'estado_cuenta' && (
        <EstadoCuenta />
      )}

      {activeTab === 'pendientes' && (
        <>
          <div className="kpi-grid">
            <KpiCard hero tone={data.meDeben > 0 ? 'warn' : 'ok'} label="TE DEBEN" value={money(data.meDeben)}
              sub={`${data.open.length} órdenes abiertas`} />
            <KpiCard tone={data.vencido > 0 ? 'bad' : undefined} label="De eso, vencido" value={money(data.vencido)} />
            <KpiCard tone="ok" label="Cobro a 7 Días" value={money(data.proyeccion7d)} sub="Proyección esta semana" />
            <KpiCard tone="ok" label="Cobro a 15 Días" value={money(data.proyeccion15d)} sub="Proyección quincenal" />
          </div>

      <AgingTable />

      <ProximasTable />

      <Card title="📊 Utilidad Líquida Real por Contrarecibo (Sin mermas - Andrés)" hint={`${data.listaCr.length}`}>
        {data.listaCr.length === 0 ? (
          <Empty>No hay contrarecibos para mostrar.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contrarecibo (CR)</th>
                  <th>Cliente</th>
                  <th>Facturas</th>
                  <th className="num">Kilos</th>
                  <th className="num">Venta Total</th>
                  <th className="num">Costo Andrés</th>
                  <th className="num">Comisión Contador</th>
                  <th className="num">Utilidad Líquida Real</th>
                  <th className="num">Margen %</th>
                  <th className="num">Acción</th>
                </tr>
              </thead>
              <tbody>
                {data.listaCr.map((grp) => (
                  <tr key={grp.cr}>
                    <td className="mono" style={{ fontWeight: 700 }}>{grp.cr}</td>
                    <td>{grp.client}</td>
                    <td className="mono">{grp.folios.map((f: any) => '#' + f).join(', ') || '—'}</td>
                    <td className="num mono">{grp.totalKilos.toLocaleString('es-MX')} kg</td>
                    <td className="num mono">{money(grp.totalVenta)}</td>
                    <td className="num mono" style={{ color: 'var(--accent-deep)' }}>-{money(grp.costoAndres)}</td>
                    <td className="num mono" style={{ color: 'var(--bad)' }}>-{money(grp.comisionContador)}</td>
                    <td className="num mono" style={{ fontWeight: 800, color: 'var(--ok)' }}>{money(grp.netUtilidad)}</td>
                    <td className="num mono" style={{ fontWeight: 700, color: grp.margenPct >= 10 ? 'var(--ok)' : 'var(--warn)' }}>{grp.margenPct.toFixed(1)}%</td>
                    <td className="num">
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn" onClick={() => shareConsolidatedCr(grp)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                          📤 Compartir PDF
                        </button>
                        <button className="btn" onClick={() => printConsolidatedCr(grp)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                          🖨️ Imprimir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>
      )}

      {activeTab === 'pagadas' && (
        <Card title="Pagos Registrados pero AÚN CON CONTABILIDAD (Por Recolectar)">
          <div className="alert warn" style={{ marginBottom: 16 }}>
            ⚠️ <strong>Recuerda:</strong> Estos montos te los entregarán <strong>quitando la comisión</strong>.
          </div>
          {data.paid.length === 0 ? (
            <Empty>No hay pagos pendientes de recolectar.</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {data.listaCr.filter(g => data.paid.some(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === g.cr)).map(crGroup => {
                const groupInvoices = data.paid.filter(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === crGroup.cr);
                const doctoPago = groupInvoices[0]?.inv.collection?.paymentDocument || groupInvoices[0]?.inv.collection?.transferRef || 'Sin Ref';
                
                return (
                  <div key={crGroup.cr} style={{ border: '2px solid #b91c1c', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '2px solid #b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, color: '#333' }}>
                        <span>PAGO: <strong>{doctoPago}</strong></span>
                        <span style={{ marginLeft: 16 }}>TRANSFERENCIA / CR: <strong>{crGroup.cr}</strong></span>
                        <span style={{ marginLeft: 16 }}>IMPORTE BRUTO: <strong>{money(crGroup.totalVenta)} MXN</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ok" style={{ fontWeight: 800 }} onClick={() => collectContrareciboBlock(crGroup.cr, crGroup.netCobrado)}>
                          💰 Recoger Efectivo (Neto: {money(crGroup.netUtilidad)})
                        </button>
                        <button className="btn" style={{ background: 'var(--paper)', border: '1px solid var(--warn)', color: 'var(--warn)' }} onClick={() => undoContrareciboBlock(crGroup.cr)}>
                          ↩️ Deshacer Cobro
                        </button>
                      </div>
                    </div>
                    <table className="data-table" style={{ margin: 0, border: 'none' }}>
                      <thead style={{ background: '#2563eb', color: '#fff' }}>
                        <tr>
                          <th style={{ color: '#fff', border: 'none' }}>Docto. SAP</th>
                          <th style={{ color: '#fff', border: 'none' }}>Docto. Pago</th>
                          <th style={{ color: '#fff', border: 'none' }}>Factura</th>
                          <th style={{ color: '#fff', border: 'none' }}>Detalle</th>
                          <th style={{ color: '#fff', border: 'none' }}>Fecha Pago</th>
                          <th className="num" style={{ color: '#fff', border: 'none' }}>Importe</th>
                          <th style={{ color: '#fff', border: 'none' }}>Moneda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupInvoices.map(({ o, inv }) => (
                          <tr key={inv.id}>
                            <td className="mono" style={{ borderLeft: 'none' }}>{inv.collection?.sapDocument || '—'}</td>
                            <td className="mono">{inv.collection?.paymentDocument || '—'}</td>
                            <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                            <td>{o.client ?? '—'}</td>
                            <td className="mono">{fmtDate(inv.collection?.paidAt)}</td>
                            <td className="num mono">{(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                            <td style={{ borderRight: 'none' }}>MXN</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', border: 'none' }}>TOTAL:</td>
                          <td className="num mono" style={{ fontWeight: 'bold', border: 'none' }}>{money(crGroup.totalVenta)}</td>
                          <td style={{ border: 'none' }}></td>
                        </tr>
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: '#b91c1c', border: 'none' }}>- COMISIÓN:</td>
                          <td className="num mono" style={{ fontWeight: 'bold', color: '#b91c1c', border: 'none' }}>-{money(crGroup.comisionContador)}</td>
                          <td style={{ border: 'none' }}></td>
                        </tr>
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: '#047857', border: 'none' }}>NETO A RECIBIR:</td>
                          <td className="num mono" style={{ fontWeight: 'bold', color: '#047857', border: 'none' }}>{money(crGroup.netUtilidad)}</td>
                          <td style={{ border: 'none' }}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'recogidas' && (
        <Card title="Historial Completo: Contrarecibos Recogidos (Ingresados a CAJA)">
          <div className="alert info" style={{ marginBottom: 16 }}>
            ℹ️ <strong>Historial de Lotes Recogidos:</strong> Aquí se guardan todos los contrarecibos cuyo dinero ya ingresó a CAJA. Si recogiste un lote por error, presiona <strong>"↩️ Deshacer Recolección"</strong> para regresarlo a "Por Recoger Dinero" y revertir el movimiento en CAJA.
          </div>
          {data.collected.length === 0 ? (
            <Empty>No hay contrarecibos recogidos aún en el historial.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Contrarecibo</th>
                    <th>Referencia Transferencia</th>
                    <th className="num">Monto Venta</th>
                    <th>Estado</th>
                    <th>Acción Reversión</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collected.map(({ o, inv }) => {
                    const currentCr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '';
                    const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                    return (
                      <tr key={inv.id}>
                        <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                        <td>{o.client ?? '—'}</td>
                        <td className="mono">{currentCr || '—'}</td>
                        <td className="mono">{inv.collection?.transferRef || '—'}</td>
                        <td className="num mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                          {money(invTotal)}
                        </td>
                        <td>
                          <StatusBadge status={inv.creditCycle.status} />
                        </td>
                        <td>
                          {currentCr && (
                            <button
                              className="btn-small btn-warn"
                              style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                revertCollectedContrareciboBlock(currentCr);
                              }}
                            >
                              ↩️ Deshacer Recolección
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'contabilidad' && (
        <Card title="Liquidación de Comisiones a Contabilidad">
          <div className="alert info" style={{ marginBottom: 16 }}>
            ℹ️ Aquí se listan las facturas ya cobradas (Contrarecibos cobrados o recogidos) para revisar la <strong>comisión del 8%</strong> que corresponde a Contabilidad. Haz clic en "Liquidar a Contabilidad" una vez que pagues esos honorarios.
          </div>
          {(() => {
            const allCobradas = [...data.paid, ...data.collected];
            const unliquidatedCrs = data.listaCr.filter(grp => {
              const invoicesInGrp = allCobradas.filter(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === grp.cr);
              return invoicesInGrp.length > 0 && invoicesInGrp.some(x => !x.inv.collection?.accountantLiquidated);
            });
            const liquidatedCrs = data.listaCr.filter(grp => {
              const invoicesInGrp = allCobradas.filter(x => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === grp.cr);
              return invoicesInGrp.length > 0 && invoicesInGrp.every(x => x.inv.collection?.accountantLiquidated);
            });

            if (unliquidatedCrs.length === 0 && liquidatedCrs.length === 0) return <Empty>No hay contrarecibos cobrados para liquidar comisiones.</Empty>;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {unliquidatedCrs.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 12, color: '#b91c1c' }}>Pendientes de Liquidar al Contador</h3>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Contrarecibo (CR)</th>
                            <th>Cliente</th>
                            <th className="num">Venta Facturada</th>
                            <th className="num">Comisión (8%)</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unliquidatedCrs.map(grp => (
                            <tr key={grp.cr}>
                              <td className="mono" style={{ fontWeight: 700 }}>{grp.cr}</td>
                              <td>{grp.client}</td>
                              <td className="num mono">{money(grp.totalVenta)}</td>
                              <td className="num mono" style={{ color: '#b91c1c', fontWeight: 700 }}>{money(grp.comisionContador)}</td>
                              <td>
                                <button className="btn-small btn-ok" onClick={() => liquidateAccountantBlock(grp.cr)}>
                                  ✅ Liquidar a Contabilidad
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL PENDIENTE:</td>
                            <td className="num mono" style={{ fontWeight: 700, color: '#b91c1c' }}>
                              {money(unliquidatedCrs.reduce((a, b) => a + b.comisionContador, 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
                
                {liquidatedCrs.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--ok)' }}>Historial de Liquidadas</h3>
                    <div className="table-scroll">
                      <table className="data-table" style={{ opacity: 0.8 }}>
                        <thead>
                          <tr>
                            <th>Contrarecibo (CR)</th>
                            <th>Cliente</th>
                            <th className="num">Comisión (8%)</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liquidatedCrs.map(grp => (
                            <tr key={grp.cr}>
                              <td className="mono">{grp.cr}</td>
                              <td>{grp.client}</td>
                              <td className="num mono">{money(grp.comisionContador)}</td>
                              <td><span className="badge" style={{ background: 'var(--ok)', color: '#fff' }}>Liquidado</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {selected && (
        <OrderModal
          order={orders.find((o) => o.id === selected.id) ?? selected}
          config={config}
          onClose={() => setSelected(null)}
          initialTab="facturas"
        />
      )}
    </>
    </CobranzaContext.Provider>
  );
}
