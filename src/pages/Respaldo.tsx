import { useRef, useState } from 'react';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where, writeBatch } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db, PATHS } from '../lib/firebase';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useExpenses } from '../hooks/useExpenses';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { usePurchases } from '../hooks/usePurchases';
import { Card, Empty, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { money } from '../lib/format';
import { computeFinancials, round2 } from '../lib/finance';
import { triggerHaptic } from '../lib/hapticEngine';
import { downloadMasterExcelWorkbook } from '../lib/masterExcelExporter';
import { downloadExecutiveOnePagerPdf } from '../lib/executiveOnePagerPdf';
import {
  embedIntoHtml,
  HTML_TEMPLATE_PATH,
  ordersToHtmlState,
  summarizeHtmlBackup,
  type HtmlFactura,
  type HtmlImportSummary,
  type HtmlState,
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
  const [entrante, setEntrante] = useState<{
    data: Partial<HtmlState>;
    resumen: HtmlImportSummary;
    nombre: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hoy = new Date().toISOString().slice(0, 10);

  /* ---------- app → HTML ---------- */
  function exportarJSON(forHelpers = false) {
    triggerHaptic('light');
    const estado = ordersToHtmlState(orders, purchases, expenses, config, PROJECT_ID, forHelpers);
    descargar(`control-bolsas-datos-${hoy}.json`, JSON.stringify(estado, null, 2), 'application/json');
    logAction(user?.email, 'Exportación JSON', { records: estado.facturas?.length || 0, helpers: forHelpers });
    triggerHaptic('success');
    toast('JSON descargado. Ábrelo en el HTML con “Restaurar respaldo”.', 'ok');
  }

  async function exportarHTML(forHelpers = false) {
    triggerHaptic('light');
    setBusy('html');
    try {
      const res = await fetch(HTML_TEMPLATE_PATH);
      if (!res.ok) throw new Error(`No encontré la plantilla en ${HTML_TEMPLATE_PATH}`);
      const template = await res.text();
      const estado = ordersToHtmlState(orders, purchases, expenses, config, PROJECT_ID, forHelpers);
      const name = forHelpers ? `bolsas-ayudantes-${hoy}.html` : `bolsas-completo-${hoy}.html`;
      descargar(name, embedIntoHtml(template, estado), 'text/html');
      await logAction(user?.email, 'Exportación HTML Offline', {
        records: estado.facturas?.length || 0,
        helpers: forHelpers,
      });
      triggerHaptic('success');
      toast(`Respaldo HTML ${forHelpers ? '(Ayudantes)' : '(Completo)'} descargado con éxito.`, 'ok');
    } catch (e) {
      triggerHaptic('error');
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(null);
    }
  }

  async function guardarSnapshotEnLaNube() {
    triggerHaptic('light');
    setBusy('snap');
    try {
      const res = await createCloudBackup(user?.email, orders, purchases, expenses, config, PROJECT_ID);
      triggerHaptic('success');
      toast(`☁ Snapshot guardado en Firestore (${res.count}/5 respaldos en la nube)`, 'ok');
    } catch (e) {
      triggerHaptic('error');
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
        triggerHaptic('success');
      } catch (e) {
        triggerHaptic('error');
        toast(`No se pudo leer: ${(e as Error).message}`, 'bad');
      }
    };
    reader.readAsText(file);
  }

  async function leerArchivoExcel(file: File) {
    triggerHaptic('light');
    setBusy('excel-import');
    try {
      const summary = await processExcelImport(file);
      if (summary.errors.length > 0) {
        triggerHaptic('warning');
        toast(`Importación con errores: ${summary.errors.join(', ')}`, 'bad');
      } else {
        triggerHaptic('success');
        toast(
          `¡Éxito! Se actualizaron ${summary.updatedOrders} expedientes y ${summary.updatedInvoices} facturas.`,
          'ok'
        );
        await logAction(user?.email, 'Importación Excel', { updatedOrders: summary.updatedOrders });
      }
    } catch (e: any) {
      triggerHaptic('error');
      toast(`Fallo procesando Excel: ${e.message}`, 'bad');
    } finally {
      setBusy(null);
    }
  }

  async function subirRespaldo() {
    if (!entrante) return;
    setBusy('subir');
    triggerHaptic('light');
    try {
      const facturas = (entrante.data.facturas ?? []) as HtmlFactura[];
      const conFolio = facturas.filter((f) => (f.folio ?? '').trim());

      const existentes = new Map<string, string>();
      const foliosBuscados = Array.from(new Set(conFolio.map((f) => f.folio.trim()).filter(Boolean)));
      for (let i = 0; i < foliosBuscados.length; i += 30) {
        const lote = foliosBuscados.slice(i, i + 30);
        const snap = await getDocs(query(collection(db, PATHS.orders), where('folio', 'in', lote)));
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
            contrareciboDate: f.fechaContrarecibo
              ? Timestamp.fromDate(new Date(`${f.fechaContrarecibo}T00:00:00`))
              : null,
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

      await setDoc(doc(db, 'snapshots', 'fromHtml'), {
        payload: JSON.stringify(entrante.data).slice(0, 900_000),
        createdAt: serverTimestamp(),
        archivo: entrante.nombre,
      });

      await logAction(user?.email, 'Importación HTML', {
        archivo: entrante.nombre,
        creadas,
        actualizadas,
      });

      triggerHaptic('success');
      toast(`${creadas} creadas, ${actualizadas} actualizadas. Snapshot guardado.`, 'ok');
      setEntrante(null);
    } catch (e) {
      triggerHaptic('error');
      toast(`Falló la subida: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner />;
  if (role !== 'admin') return <Navigate to="/" replace />;

  const estimado = ordersToHtmlState(orders, purchases, expenses, config, PROJECT_ID);
  const totalFacturado = estimado.facturas.reduce((a, f) => a + f.montoTotal, 0);
  const totalCobrado = estimado.facturas.reduce((a, f) => a + f.montoCobrado, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. KPIs Maestros de Respaldo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          style={{
            background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderTop: '3px solid #3b82f6',
            borderRadius: 16,
            padding: '20px 22px',
            boxShadow: '0 8px 24px -6px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8 }}>
            📦 Órdenes Exportables
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#38bdf8' }}>
            {estimado.facturas.length}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            de {orders.length} expedientes totales en Firestore.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          style={{
            background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderTop: '3px solid #f59e0b',
            borderRadius: 16,
            padding: '20px 22px',
            boxShadow: '0 8px 24px -6px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8 }}>
            📑 Importe Facturado Amparado
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#f59e0b' }}>
            {money(totalFacturado)}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            con IVA incluido (formato íntegro para motor offline).
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          style={{
            background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderTop: '3px solid #10b981',
            borderRadius: 16,
            padding: '20px 22px',
            boxShadow: '0 8px 24px -6px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 8 }}>
            💵 Cartera Cobrada Histórica
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#10b981' }}>
            {money(totalCobrado)}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            depositado y conciliado en balance general.
          </p>
        </motion.div>
      </div>

      {/* 2. Exportación y Generación de Respaldos */}
      <Card title="⬇️ Exportar & Descargar Respaldos">
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            {/* HTML Offline */}
            <div
              style={{
                background: 'var(--surface-raised, rgba(255,255,255,0.02))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink, #fff)', marginBottom: 4 }}>
                  🌐 ERP Autocontenido (.html)
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
                  Sistema completo y portátil para operar sin conexión a internet desde cualquier laptop o smartphone.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-primary"
                  style={{ flex: 1, minHeight: 40, fontSize: 12.5, fontWeight: 800 }}
                  onClick={() => void exportarHTML(false)}
                  disabled={busy !== null}
                >
                  {busy === 'html' ? 'Preparando…' : '⭳ HTML Administrador'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  style={{ flex: 1, minHeight: 40, fontSize: 12.5, fontWeight: 700, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                  onClick={() => void exportarHTML(true)}
                  disabled={busy !== null}
                >
                  {busy === 'html' ? '...' : '⭳ HTML Operador (Sin Precios)'}
                </motion.button>
              </div>
            </div>

            {/* Datos JSON */}
            <div
              style={{
                background: 'var(--surface-raised, rgba(255,255,255,0.02))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink, #fff)', marginBottom: 4 }}>
                  📄 Dataset Estructurado (.json)
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
                  Exportación de datos puros para restaurar, fusionar o migrar entre instancias locales.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  style={{ flex: 1, minHeight: 40, fontSize: 12.5, fontWeight: 700, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                  onClick={() => exportarJSON(false)}
                  disabled={busy !== null}
                >
                  ⭳ JSON Admin
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  style={{ flex: 1, minHeight: 40, fontSize: 12.5, fontWeight: 700, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                  onClick={() => exportarJSON(true)}
                  disabled={busy !== null}
                >
                  ⭳ JSON Operador
                </motion.button>
              </div>
            </div>

            {/* Base de Datos Maestra Excel */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.12) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: '#10b981', marginBottom: 4 }}>
                  📊 Base de Datos Maestra (.xlsx)
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
                  Libro Excel multi-hoja completo: Resumen P&L, Expedientes, Facturas con CR, Cuenta Andrés y Caja Chica.
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-primary"
                style={{
                  minHeight: 40,
                  fontSize: 12.5,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#fff',
                }}
                onClick={() => {
                  triggerHaptic('success');
                  downloadMasterExcelWorkbook({
                    orders,
                    purchases,
                    expenses,
                    config,
                  });
                  toast('📊 Base de Datos Maestra exportada a Excel (.xlsx multi-hoja)', 'ok');
                }}
              >
                ⭳ Descargar Excel Maestro (.xlsx)
              </motion.button>
            </div>

            {/* Resumen Ejecutivo One-Pager PDF */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(3, 105, 161, 0.12) 100%)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: '#38bdf8', marginBottom: 4 }}>
                  📄 Resumen Ejecutivo One-Pager (PDF)
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
                  Corte directivo de alta resolución en 1 sola página: KPIs clave, desglose por planta y facturas en revisión.
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-primary"
                style={{
                  minHeight: 40,
                  fontSize: 12.5,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#fff',
                }}
                onClick={() => {
                  triggerHaptic('success');
                  const saldoCaja = round2(
                    (expenses || []).reduce((acc, e) => acc + (e?.type === 'ingreso' ? Number(e.amount) || 0 : -(Number(e.amount) || 0)), 0)
                  );
                  downloadExecutiveOnePagerPdf({
                    orders,
                    expenses,
                    config,
                    saldoCaja,
                  });
                  toast('📄 Resumen Ejecutivo One-Pager descargado en PDF', 'ok');
                }}
              >
                ⭳ Descargar One-Pager (PDF)
              </motion.button>
            </div>

            {/* Snapshot en Nube */}
            <div
              style={{
                background: 'var(--surface-raised, rgba(255,255,255,0.02))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink, #fff)', marginBottom: 4 }}>
                  ☁️ Snapshot en Cloud Firestore
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>
                  Guarda un punto de restauración inmutable en <code>snapshots/latest</code> dentro de Firebase.
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn btn-primary"
                style={{ minHeight: 40, fontSize: 12.5, fontWeight: 800 }}
                onClick={() => void guardarSnapshotEnLaNube()}
                disabled={busy !== null}
              >
                {busy === 'snap' ? 'Guardando Snapshot…' : '☁ Guardar Snapshot Cloud'}
              </motion.button>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Importación y Restauración */}
      <Card title="⬆️ Restaurar e Importar Datos (JSON, HTML o Excel)">
        <div style={{ padding: 18 }}>
          <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
            Selecciona o arrastra tu archivo exportado desde el HTML o Excel. Las órdenes existentes se actualizan por folio sin duplicados y las nuevas se integran automáticamente.
          </p>

          <input
            type="file"
            accept=".json, .html, .xlsx"
            ref={inputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) leerArchivo(file);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />

          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: '2px dashed var(--border, rgba(255,255,255,0.15))',
              borderRadius: 14,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--paper-sunk, rgba(0,0,0,0.15))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 32 }}>📁</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink, #fff)' }}>
              {busy === 'excel-import' ? 'Procesando archivo...' : 'Haz clic para seleccionar archivo (.json, .html, .xlsx)'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              Detección y unión atómica por número de folio oficial.
            </span>
          </motion.div>

          {entrante && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 20,
                background: 'var(--surface-raised, rgba(255,255,255,0.03))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink, #fff)', marginBottom: 12 }}>
                📊 Resumen del Archivo Seleccionado
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--ink-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nombre de Archivo:</span>
                  <strong className="mono" style={{ color: 'var(--ink)' }}>{entrante.nombre}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Facturas Detectadas:</span>
                  <strong className="mono" style={{ color: '#38bdf8' }}>{entrante.resumen.facturas}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Con Folio Válido:</span>
                  <strong className="mono" style={{ color: '#10b981' }}>{entrante.resumen.conFolio}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Facturado / Cobrado:</span>
                  <strong className="mono" style={{ color: 'var(--ink)' }}>
                    {money(entrante.resumen.totalFacturado)} / {money(entrante.resumen.totalCobrado)}
                  </strong>
                </div>
              </div>

              {entrante.resumen.facturas > entrante.resumen.conFolio && (
                <div className="alert warn" style={{ marginTop: 12 }}>
                  {entrante.resumen.facturas - entrante.resumen.conFolio} facturas no tienen folio y no se pueden sincronizar sin duplicar.
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-primary"
                  style={{ flex: 1, minHeight: 42, fontWeight: 800 }}
                  onClick={() => void subirRespaldo()}
                  disabled={busy !== null}
                >
                  {busy === 'subir' ? 'Sincronizando...' : '☁️ Subir y Fusionar a Firestore'}
                </motion.button>
                <button
                  className="btn"
                  style={{ minHeight: 42 }}
                  onClick={() => setEntrante(null)}
                  disabled={busy !== null}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </Card>

      {/* 4. Matriz de Trazabilidad Bidireccional */}
      <Card title="🔄 Matriz de Trazabilidad de Datos">
        <div style={{ padding: 18 }} className="link-list">
          <div className="li">
            <span className="lg">Órdenes, montos, fechas, contrarecibos y cobranza</span>
            <span className="lv" style={{ color: 'var(--ok, #10b981)', fontWeight: 700 }}>Sincronización Bidireccional</span>
          </div>
          <div className="li">
            <span className="lg">Comisión del contador</span>
            <span className="lv" style={{ color: 'var(--ok, #10b981)', fontWeight: 700 }}>Viaja precalculada</span>
          </div>
          <div className="li">
            <span className="lg">Kilos de pesaje</span>
            <span className="lv" style={{ color: 'var(--warn, #f59e0b)', fontWeight: 700 }}>App $\rightarrow$ HTML sí; regreso estimado</span>
          </div>
          <div className="li">
            <span className="lg">Archivos PDF y XML originales</span>
            <span className="lv" style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Almacenados en Firebase Storage</span>
          </div>
        </div>
        {orders.length === 0 && <Empty>Todavía no hay órdenes que respaldar.</Empty>}
      </Card>
    </div>
  );
}

