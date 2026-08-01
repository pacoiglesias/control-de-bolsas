import { useRef, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useExpenses } from '../hooks/useExpenses';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { usePurchases } from '../hooks/usePurchases';
import { Card, Empty, KpiCard, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { money } from '../lib/format';
import { computeFinancials } from '../lib/finance';
import {
  embedIntoHtml, HTML_TEMPLATE_PATH, ordersToHtmlState, summarizeHtmlBackup,
  type HtmlFactura, type HtmlImportSummary, type HtmlState,
} from '../lib/bridge';

import { createCloudBackup } from '../lib/cloudBackup';
import { processExcelImport } from '../lib/importExcel';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '';

function descargar(nombre: string, contenido: string, mime: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + contenido], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Respaldo() {
  const { config } = useConfig();
  const { orders, loading: loadingOrders } = useOrders();
  const { expenses, loading: loadingExpenses } = useExpenses();
  const { purchases, loading: loadingPurchases } = usePurchases();
  const loading = loadingOrders || loadingExpenses || loadingPurchases;
  const { user, role } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [entrante, setEntrante] = useState<{ data: Partial<HtmlState>; resumen: HtmlImportSummary; nombre: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hoy = new Date().toISOString().slice(0, 10);

  /* ---------- app → HTML ---------- */
  function exportarJSON(forHelpers = false) {
    const estado = ordersToHtmlState(orders, purchases, expenses, config, PROJECT_ID, forHelpers);
    descargar(`control-bolsas-datos-${hoy}.json`, JSON.stringify(estado, null, 2), 'application/json');
    logAction(user?.email, 'Exportación JSON', { records: estado.facturas?.length || 0, helpers: forHelpers });
    toast('JSON descargado. Ábrelo en el HTML con “Restaurar respaldo”.', 'ok');
  }

  async function exportarHTML(forHelpers = false) {
    setBusy('html');
    try {
      const res = await fetch(HTML_TEMPLATE_PATH);
      if (!res.ok) throw new Error(`No encontré la plantilla en ${HTML_TEMPLATE_PATH}`);
      const template = await res.text();
      const estado = ordersToHtmlState(orders, purchases, expenses, config, PROJECT_ID, forHelpers);
      const name = forHelpers ? `bolsas-ayudantes-${hoy}.html` : `bolsas-completo-${hoy}.html`;
      descargar(name, embedIntoHtml(template, estado), 'text/html');
      await logAction(user?.email, 'Exportación HTML Offline', { records: estado.facturas?.length || 0, helpers: forHelpers });
      toast(`Respaldo HTML ${forHelpers ? '(Ayudantes)' : '(Completo)'} descargado.`, 'ok');
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(null);
    }
  }

  async function guardarSnapshotEnLaNube() {
    setBusy('snap');
    try {
      const res = await createCloudBackup(user?.email, orders, purchases, expenses, config, PROJECT_ID);
      toast(`☁ Snapshot guardado en Firestore (${res.count}/5 respaldos en la nube)`, 'ok');
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(null);
    }
  }

  /* ---------- HTML → app ---------- */
  function leerArchivo(file: File) {
    if (file.name.endsWith('.xlsx')) {
      return leerArchivoExcel(file);
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Partial<HtmlState>;
        if (!data.facturas) throw new Error('Ese archivo no trae facturas.');
        setEntrante({ data, resumen: summarizeHtmlBackup(data), nombre: file.name });
      } catch (e) {
        toast(`No se pudo leer: ${(e as Error).message}`, 'bad');
      }
    };
    reader.readAsText(file);
  }

  async function leerArchivoExcel(file: File) {
    setBusy('excel-import');
    try {
      const summary = await processExcelImport(file);
      if (summary.errors.length > 0) {
        toast(`Importación con errores: ${summary.errors.join(', ')}`, 'bad');
      } else {
        toast(`¡Éxito! Se actualizaron ${summary.updatedOrders} expedientes y ${summary.updatedInvoices} facturas.`, 'ok');
        await logAction(user?.email, 'Importación Excel', { updatedOrders: summary.updatedOrders });
      }
    } catch (e: any) {
      toast(`Fallo procesando Excel: ${e.message}`, 'bad');
    } finally {
      setBusy(null);
    }
  }

  /**
   * Sube el respaldo del HTML. Une por folio: lo que ya existe se actualiza en
   * sus datos de cobranza, lo que no existe se crea. Nunca borra órdenes.
   */
  async function subirRespaldo() {
    if (!entrante) return;
    setBusy('subir');
    try {
      const facturas = (entrante.data.facturas ?? []) as HtmlFactura[];
      const conFolio = facturas.filter((f) => (f.folio ?? '').trim());

      // Índice de lo que ya está en la nube, por folio.
      //
      // Antes esto era where('folio', '!=', '') sobre toda la coleccion: un
      // escaneo completo que descargaba TODOS los expedientes en cada
      // importacion. Ahora solo se consultan los folios que trae el archivo
      // entrante, en lotes de 30 (el maximo que admite el operador 'in').
      const existentes = new Map<string, string>();
      const foliosBuscados = Array.from(
        new Set(conFolio.map((f) => f.folio.trim()).filter(Boolean)),
      );
      for (let i = 0; i < foliosBuscados.length; i += 30) {
        const lote = foliosBuscados.slice(i, i + 30);
        const snap = await getDocs(
          query(collection(db, PATHS.orders), where('folio', 'in', lote)),
        );
        snap.docs.forEach((d) => {
          const folio = String(d.data().folio ?? '').trim();
          if (folio) existentes.set(folio, d.id);
        });
      }

      let creadas = 0;
      let actualizadas = 0;
      for (let i = 0; i < conFolio.length; i += 300) {
        const batch = writeBatch(db);
        conFolio.slice(i, i + 300).forEach((f) => {
          const folio = f.folio.trim();
          const existente = existentes.get(folio);
          const pagada = f.cobranza === 'COBRADO' || f.cobranza === 'DEPOSITADO';
          const cobranza = {
            contrareciboNumber: f.numContrarecibo ?? '',
            contrareciboDate: f.fechaContrarecibo ? Timestamp.fromDate(new Date(`${f.fechaContrarecibo}T00:00:00`)) : null,
            paidAmount: Number(f.montoCobrado) || 0,
            paidAt: f.fechaCobro ? Timestamp.fromDate(new Date(`${f.fechaCobro}T00:00:00`)) : null,
            notes: f.notas ?? '',
          };

          if (existente) {
            batch.update(doc(db, PATHS.orders, existente), {
              client: f.cliente || '',
              collection: cobranza,
              'creditCycle.status': pagada ? 'paid' : 'pending',
              ...(f.fechaVencimiento
                ? { 'creditCycle.dueDate': Timestamp.fromDate(new Date(`${f.fechaVencimiento}T00:00:00`)) }
                : {}),
              updatedAt: serverTimestamp(),
            });
            actualizadas++;
          } else {
            // Sin kilos en el HTML, se estiman desde el importe para que los
            // KPIs de la app no queden en cero. Queda marcado como estimado.
            const subtotal = (Number(f.montoTotal) || 0) / (1 + config.ivaRate);
            const kilosEstimados = config.salePricePerKg > 0 ? Math.round(subtotal / config.salePricePerKg) : 0;
            batch.set(doc(db, PATHS.orders, `html-${folio.replace(/[^\w-]/g, '_')}`), {
              folio,
              client: f.cliente || '',
              fileName: `respaldo-html/${entrante.nombre}`,
              totalKilograms: kilosEstimados,
              kilosEstimados: true,
              financials: computeFinancials(kilosEstimados, config),
              creditCycle: {
                status: pagada ? 'paid' : 'pending',
                issueDate: f.fechaFactura ? Timestamp.fromDate(new Date(`${f.fechaFactura}T00:00:00`)) : null,
                dueDate: f.fechaVencimiento ? Timestamp.fromDate(new Date(`${f.fechaVencimiento}T00:00:00`)) : null,
              },
              collection: cobranza,
              processedAt: serverTimestamp(),
              origin: 'html',
            });
            creadas++;
          }
        });
        await batch.commit();
      }

      // El estado completo del HTML (pedidos, caja, entregas) se guarda entero:
      // la app todavía no modela eso, pero no se pierde.
      await setDoc(doc(db, 'snapshots', 'fromHtml'), {
        payload: JSON.stringify(entrante.data).slice(0, 900_000),
        createdAt: serverTimestamp(),
        archivo: entrante.nombre,
      });

      await logAction(user?.email, 'Importación HTML', {
        archivo: entrante.nombre,
        creadas,
        actualizadas
      });

      toast(`${creadas} creadas, ${actualizadas} actualizadas. El resto quedó en snapshots/fromHtml.`, 'ok');
      setEntrante(null);
    } catch (e) {
      toast(`Falló la subida: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  const estimado = ordersToHtmlState(orders, purchases, expenses, config, PROJECT_ID);

  return (
    <>
      <div className="page-head">
        <h1>Respaldo local</h1>
        <p>
          El HTML sigue vivo: es tu red de seguridad cuando no hay internet, cuando Firebase se cae
          o cuando quieres trabajar en el taller sin cuenta. Desde aquí bajas tus datos ya metidos
          dentro del archivo, y desde aquí también los subes de regreso.
        </p>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Órdenes que se exportarían" value={estimado.facturas.length}
          sub={`de ${orders.length} en la base`} />
        <KpiCard label="Importe facturado" value={money(estimado.facturas.reduce((a, f) => a + f.montoTotal, 0))}
          sub="con IVA, como lo maneja el HTML" />
        <KpiCard tone="cash" label="Cobrado" value={money(estimado.facturas.reduce((a, f) => a + f.montoCobrado, 0))} />
      </div>

      <Card title="Bajar el respaldo">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="link-list">
            <div className="li">
              <span className="lg">
                <strong>Respaldo HTML autocontenido</strong>
                <br />
                <span className="hint">
                  El sistema completo en un archivo sin internet.
                </span>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => void exportarHTML(false)} disabled={busy !== null}>
                  {busy === 'html' ? 'Preparando…' : '⭳ HTML Admin (con dinero)'}
                </button>
                <button className="btn" onClick={() => void exportarHTML(true)} disabled={busy !== null}>
                  {busy === 'html' ? '...' : '⭳ HTML Ayudantes (sin ganancias)'}
                </button>
              </div>
            </div>
            <div className="li">
              <span className="lg">
                <strong>Solo los datos (.json)</strong>
                <br />
                <span className="hint">
                  Para meterlos en un HTML que ya usas y tiene capturas tuyas. Ahí eliges
                  <em> fusionar</em>: se actualiza lo que coincide y lo tuyo se queda intacto.
                </span>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => exportarJSON(false)} disabled={busy !== null}>⭳ JSON Admin</button>
                <button className="btn" onClick={() => exportarJSON(true)} disabled={busy !== null}>⭳ JSON Ayudantes</button>
              </div>
            </div>
            <div className="li">
              <span className="lg">
                <strong>Guardar copia en Firestore</strong>
                <br />
                <span className="hint">
                  Deja el estado completo en <code>snapshots/latest</code>, por si pierdes el archivo.
                </span>
              </span>
              <button className="btn" onClick={() => void guardarSnapshotEnLaNube()} disabled={busy !== null}>
                {busy === 'snap' ? 'Guardando…' : '☁ Guardar snapshot'}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Subir lo que trabajaste en el HTML">
        <div style={{ padding: 16 }}>
          <p className="hint" style={{ marginTop: 0 }}>
            En el HTML usa <strong>Descargar respaldo (.json)</strong> y sube ese archivo aquí. Se
            unen por folio: lo que ya existe se actualiza en cobranza, lo que no existe se crea.
            Ninguna orden se borra.
          </p>
          <input
            type="file"
            accept=".json, .html, .xlsx"
            ref={inputRef}
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) leerArchivo(file);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
          <button 
            className="btn" 
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === 'excel-import' ? <Spinner /> : '⭱ Elegir archivo (JSON, HTML o Excel)'}
          </button>

          {entrante && (
            <>
              <div className="calc-box" style={{ marginTop: 16 }}>
                <div className="calc-line"><span>Archivo</span><span className="mono">{entrante.nombre}</span></div>
                <div className="calc-line"><span>Facturas</span><span className="mono">{entrante.resumen.facturas}</span></div>
                <div className="calc-line"><span>Con folio (son las que suben)</span><span className="mono">{entrante.resumen.conFolio}</span></div>
                <div className="calc-line"><span>Marcadas como cobradas</span><span className="mono">{entrante.resumen.cobradas}</span></div>
                <div className="calc-line"><span>Facturado / cobrado</span><span className="mono">{money(entrante.resumen.totalFacturado)} / {money(entrante.resumen.totalCobrado)}</span></div>
                <div className="calc-line total"><span>Pedidos · entregas · caja (van al snapshot)</span>
                  <span className="mono">{entrante.resumen.pedidos} · {entrante.resumen.entregas} · {entrante.resumen.caja}</span></div>
              </div>
              {entrante.resumen.facturas > entrante.resumen.conFolio && (
                <div className="alert warn">
                  {entrante.resumen.facturas - entrante.resumen.conFolio} facturas no tienen folio y no
                  se pueden unir sin duplicar. Ponles folio en el HTML y vuelve a exportar.
                </div>
              )}
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn" onClick={() => setEntrante(null)} disabled={busy !== null}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => void subirRespaldo()} disabled={busy !== null}>
                  {busy === 'subir' ? <Spinner /> : 'Subir a Firestore'}
                </button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card title="Qué viaja y qué no">
        <div style={{ padding: 16 }} className="link-list">
          <div className="li"><span className="lg">Órdenes, montos, fechas, contrarecibo y cobranza</span><span className="lv" style={{ color: 'var(--ok)' }}>en los dos sentidos</span></div>
          <div className="li"><span className="lg">Comisión</span><span className="lv" style={{ color: 'var(--ok)' }}>viaja ya calculada, el HTML no la recalcula</span></div>
          <div className="li"><span className="lg">Kilos</span><span className="lv" style={{ color: 'var(--warn)' }}>app → HTML sí; de regreso se estiman</span></div>
          <div className="li"><span className="lg">Pedidos, fabricante, entregas y caja</span><span className="lv" style={{ color: 'var(--warn)' }}>solo existen en el HTML</span></div>
          <div className="li"><span className="lg">PDFs originales</span><span className="lv" style={{ color: 'var(--ink-faint)' }}>se quedan en Storage</span></div>
        </div>
        {orders.length === 0 && <Empty>Todavía no hay órdenes que respaldar.</Empty>}
      </Card>
    </>
  );
}
