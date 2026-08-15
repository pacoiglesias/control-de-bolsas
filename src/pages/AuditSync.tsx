import React, { useState, useMemo } from 'react';
import { doc, writeBatch, Timestamp, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { useOrdersContext } from '../context/OrdersContext';
import { camposInvoices } from '../lib/invoiceOps';
import { round2 } from '../lib/finance';
import { money, fmtDate } from '../lib/format';
import { exportToExcel } from '../lib/export';
import { Card, Empty } from '../components/ui';
import { confirmDialog } from '../lib/confirmDialog';
import { DEFAULT_CONFIG, type OrderStatus, type PurchaseOrder } from '../lib/types';
import * as XLSX from 'xlsx';

const ESTATUS_VALIDOS: OrderStatus[] = ['pedido', 'facturado', 'pending', 'paid', 'collected', 'overdue', 'manual_review'];

type ModeTab = 'grid' | 'paste' | 'batch' | 'excel';

type DiffCobranza = {
  tab: 'cobranza';
  type: 'new' | 'mod';
  label: string;
  orderId?: string;
  invoiceId?: string;
  cliente?: string;
  folio?: string;
  contrarecibo?: string;
  estatus?: string;
  montoVenta?: number;
  kilos?: number;
  fechaVencimiento?: string;
  oldValue?: number | string;
  newValue?: number | string;
  campo?: 'monto' | 'kilos' | 'estatus' | 'contrarecibo' | 'vencimiento';
  error?: string;
};

type DiffCaja = {
  tab: 'caja';
  type: 'new' | 'mod';
  label: string;
  id?: string;
  concepto?: string;
  proveedor?: string;
  monto?: number;
  fecha?: string;
  oldValue?: number;
  newValue?: number;
};

type DiffCompras = {
  tab: 'compras';
  type: 'new' | 'mod';
  label: string;
  id?: string;
  proveedor?: string;
  kilosPedidos?: number;
  kilosEntregados?: number;
  precioPorKilo?: number;
  total?: number;
  pagado?: number;
  estatus?: string;
  campo?: 'kilosEntregados' | 'kilosPedidos';
  oldValue?: number;
  newValue?: number;
};

export default function AuditSync() {
  const toast = useToast();
  const { orders: globalOrders } = useOrdersContext();

  const [mode, setMode] = useState<ModeTab>('grid');
  const [gridFilter, setGridFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<{ rowKey: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Snapshot para Rollback / Deshacer en 1 clic
  const [lastSnapshot, setLastSnapshot] = useState<{
    description: string;
    orders: PurchaseOrder[];
  } | null>(null);

  // Pestaña Pegar (Ctrl+V)
  const [pasteText, setPasteText] = useState<string>('');
  const [pasteParsedRows, setPasteParsedRows] = useState<any[]>([]);

  // Pestaña Ajustador Masivo
  const [batchTarget, setBatchTarget] = useState<'all' | 'pending' | 'providencia'>('pending');
  const [batchSalePrice, setBatchSalePrice] = useState<number>(43);
  const [batchCostPrice, setBatchCostPrice] = useState<number>(42);

  // Pestaña Archivo Excel Tradicional
  const [file, setFile] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<(DiffCobranza | DiffCaja | DiffCompras)[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDiffTab, setActiveDiffTab] = useState<'cobranza' | 'caja' | 'compras'>('cobranza');

  // Guardar snapshot de seguridad antes de cualquier cambio masivo
  const takeSnapshot = (description: string) => {
    setLastSnapshot({
      description,
      orders: JSON.parse(JSON.stringify(globalOrders)),
    });
  };

  const handleRollback = async () => {
    if (!lastSnapshot) return;
    const ok = await confirmDialog({
      message: `¿Revertir todos los cambios y restaurar el snapshot "${lastSnapshot.description}"?`,
      danger: true,
    });
    if (!ok) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      lastSnapshot.orders.forEach((o) => {
        const ref = doc(db, PATHS.orders, o.id);
        batch.set(ref, o);
      });
      await batch.commit();
      toast('↩️ Base de datos restaurada al snapshot anterior con éxito', 'ok');
      setLastSnapshot(null);
    } catch (e: any) {
      toast(`Error al revertir: ${e.message}`, 'bad');
    }
    setIsProcessing(false);
  };

  // ─── 1. SÁBANA EN VIVO (DATA GRID) ──────────────────────────────────────────
  const gridRows = useMemo(() => {
    const rows: {
      key: string;
      orderId: string;
      invoiceId?: string;
      oc: string;
      cliente: string;
      folio: string;
      contrarecibo: string;
      kilos: number;
      precioVenta: number;
      costoAndres: number;
      subtotal: number;
      totalFactura: number;
      estatus: OrderStatus;
      fechaEmision: string;
    }[] = [];

    const defaultSale = DEFAULT_CONFIG.salePricePerKg || 43;
    const defaultCost = DEFAULT_CONFIG.costPricePerKg || 42;

    globalOrders.forEach((o) => {
      const pVenta = o.customSellPrice || defaultSale;
      const pCosto = o.customCostPrice || defaultCost;
      const invoices = o.invoices || [];

      if (invoices.length === 0) {
        const k = o.totalKilograms || 0;
        const sub = k * pVenta;
        rows.push({
          key: `${o.id}-root`,
          orderId: o.id,
          oc: o.folio || o.oc || 'S/OC',
          cliente: o.client || 'Providencia',
          folio: o.folio || '—',
          contrarecibo: o.collection?.contrareciboNumber || '',
          kilos: k,
          precioVenta: pVenta,
          costoAndres: pCosto,
          subtotal: round2(sub),
          totalFactura: round2(sub * 1.16),
          estatus: (o.creditCycle?.status as OrderStatus) || 'pedido',
          fechaEmision: fmtDate(o.processedAt) || '—',
        });
      } else {
        invoices.forEach((inv) => {
          const k = inv.kilos || o.totalKilograms || 0;
          const sub = k * pVenta;
          rows.push({
            key: `${o.id}-${inv.id}`,
            orderId: o.id,
            invoiceId: inv.id,
            oc: o.folio || o.oc || 'S/OC',
            cliente: o.client || 'Providencia',
            folio: inv.folio || '—',
            contrarecibo: inv.collection?.contrareciboNumber || '',
            kilos: k,
            precioVenta: pVenta,
            costoAndres: pCosto,
            subtotal: round2(sub),
            totalFactura: round2(sub * 1.16),
            estatus: inv.creditCycle.status || 'facturado',
            fechaEmision: fmtDate(inv.creditCycle.issueDate) || '—',
          });
        });
      }
    });

    if (!gridFilter.trim()) return rows;
    const q = gridFilter.toLowerCase();
    return rows.filter(
      (r) =>
        r.oc.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.folio.toLowerCase().includes(q) ||
        r.contrarecibo.toLowerCase().includes(q) ||
        r.estatus.toLowerCase().includes(q)
    );
  }, [globalOrders, gridFilter]);

  const handleCellSave = async (row: typeof gridRows[0], field: string, value: string) => {
    setEditingCell(null);
    const order = globalOrders.find((o) => o.id === row.orderId);
    if (!order) return;

    takeSnapshot(`Edición de celda ${field} en orden ${row.oc}`);

    try {
      const orderRef = doc(db, PATHS.orders, order.id);

      if (field === 'contrarecibo' || field === 'estatus' || field === 'folio') {
        const invoices = [...(order.invoices || [])];
        if (invoices.length > 0) {
          const targetInv = row.invoiceId
            ? invoices.find((i) => i.id === row.invoiceId)
            : invoices[0];
          if (targetInv) {
            if (field === 'contrarecibo') {
              targetInv.collection = {
                ...targetInv.collection,
                contrareciboNumber: value.trim(),
                contrareciboDate: value.trim() ? Timestamp.now() : null,
              };
            } else if (field === 'estatus' && ESTATUS_VALIDOS.includes(value as OrderStatus)) {
              targetInv.creditCycle.status = value as OrderStatus;
            } else if (field === 'folio') {
              targetInv.folio = value.trim();
            }
          }
          await updateDoc(orderRef, {
            ...camposInvoices(invoices),
            folio: field === 'folio' ? value.trim() : order.folio,
          });
        } else {
          // Orden sin facturas
          if (field === 'contrarecibo') {
            await updateDoc(orderRef, {
              'collection.contrareciboNumber': value.trim(),
              'collection.contrareciboDate': value.trim() ? Timestamp.now() : null,
              updatedAt: serverTimestamp(),
            });
          } else if (field === 'estatus' && ESTATUS_VALIDOS.includes(value as OrderStatus)) {
            await updateDoc(orderRef, {
              'creditCycle.status': value,
              updatedAt: serverTimestamp(),
            });
          } else if (field === 'folio') {
            await updateDoc(orderRef, {
              folio: value.trim(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } else if (field === 'kilos') {
        const numKilos = Math.max(0, Number(value) || 0);
        const invoices = [...(order.invoices || [])];
        if (invoices.length > 0 && row.invoiceId) {
          const inv = invoices.find((i) => i.id === row.invoiceId);
          if (inv) inv.kilos = numKilos;
          await updateDoc(orderRef, {
            ...camposInvoices(invoices),
            totalKilograms: numKilos,
          });
        } else {
          await updateDoc(orderRef, {
            totalKilograms: numKilos,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (field === 'precioVenta') {
        const p = Math.max(0, Number(value) || 0);
        await updateDoc(orderRef, {
          customSellPrice: p,
          updatedAt: serverTimestamp(),
        });
      } else if (field === 'costoAndres') {
        const c = Math.max(0, Number(value) || 0);
        await updateDoc(orderRef, {
          customCostPrice: c,
          updatedAt: serverTimestamp(),
        });
      }

      toast('✓ Guardado en Firestore', 'ok');
    } catch (e: any) {
      toast(`Error al guardar: ${e.message}`, 'bad');
    }
  };

  // ─── 2. PEGAR DIRECTO DE EXCEL (CTRL+V) ────────────────────────────────────
  const handleParsePasted = (text: string) => {
    setPasteText(text);
    if (!text.trim()) {
      setPasteParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    const parsed = lines.map((l) => {
      const cols = l.split('\t').map((c) => c.trim());
      return {
        col0: cols[0] || '',
        col1: cols[1] || '',
        col2: cols[2] || '',
        col3: cols[3] || '',
        col4: cols[4] || '',
      };
    });
    setPasteParsedRows(parsed);
  };

  const handleApplyPasted = async () => {
    if (pasteParsedRows.length === 0) return;
    takeSnapshot(`Importación rápida desde portapapeles (${pasteParsedRows.length} renglones)`);
    setIsProcessing(true);

    try {
      let count = 0;
      const batch = writeBatch(db);

      pasteParsedRows.forEach((row) => {
        const match = globalOrders.find(
          (o) =>
            (o.folio && o.folio.toLowerCase() === row.col0.toLowerCase()) ||
            (o.oc && o.oc.toLowerCase() === row.col0.toLowerCase()) ||
            (o.invoices && o.invoices.some((inv) => inv.folio?.toLowerCase() === row.col0.toLowerCase()))
        );

        if (match) {
          const orderRef = doc(db, PATHS.orders, match.id);
          const invoices = [...(match.invoices || [])];

          const crCandidate = row.col1.startsWith('CR-') || row.col1.startsWith('TH-') || row.col1.startsWith('GT-') ? row.col1 : row.col2;
          if (crCandidate && invoices.length > 0) {
            invoices[0].collection = {
              ...invoices[0].collection,
              contrareciboNumber: crCandidate,
            };
            batch.update(orderRef, camposInvoices(invoices));
            count++;
          }
        }
      });

      if (count > 0) {
        await batch.commit();
        toast(`Se sincronizaron ${count} registros desde el portapapeles.`, 'ok');
        setPasteText('');
        setPasteParsedRows([]);
      } else {
        toast('No se encontraron coincidencias directas de Folio / OC.', 'info');
      }
    } catch (e: any) {
      toast(`Error al aplicar: ${e.message}`, 'bad');
    }
    setIsProcessing(false);
  };

  // ─── 3. AJUSTADOR MASIVO DE PRECIOS Y COSTOS ──────────────────────────────
  const batchMatchingOrders = useMemo(() => {
    return globalOrders.filter((o) => {
      if (batchTarget === 'pending') {
        const st = o.creditCycle?.status;
        return st === 'pedido' || st === 'facturado' || st === 'pending';
      }
      if (batchTarget === 'providencia') {
        return (o.client || '').toLowerCase().includes('providencia');
      }
      return true;
    });
  }, [globalOrders, batchTarget]);

  const handleApplyBatchPrices = async () => {
    if (batchMatchingOrders.length === 0) return;
    const ok = await confirmDialog({
      message: `¿Establecer Precio Venta = $${batchSalePrice.toFixed(2)} y Costo Andrés = $${batchCostPrice.toFixed(2)} a ${batchMatchingOrders.length} orden(es)?`,
    });
    if (!ok) return;

    takeSnapshot(`Ajuste masivo de precios ($${batchSalePrice} / $${batchCostPrice})`);
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      batchMatchingOrders.forEach((o) => {
        const ref = doc(db, PATHS.orders, o.id);
        batch.update(ref, {
          customSellPrice: batchSalePrice,
          customCostPrice: batchCostPrice,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      toast(`✓ ${batchMatchingOrders.length} órdenes actualizadas con los nuevos precios.`, 'ok');
    } catch (e: any) {
      toast(`Error en ajuste masivo: ${e.message}`, 'bad');
    }
    setIsProcessing(false);
  };

  // ─── 4. SUBIR ARCHIVO EXCEL CLÁSICO ─────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setIsProcessing(true);
    takeSnapshot(`Importación de archivo Excel ${uploadedFile.name}`);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const newDiffs: (DiffCobranza | DiffCaja | DiffCompras)[] = [];

      const wsCobranza = workbook.Sheets['Auditoria_Cobranza'] || workbook.Sheets['Cobranza'] || workbook.Sheets[workbook.SheetNames[0]];
      if (wsCobranza) {
        const rowsCobranza: any[] = XLSX.utils.sheet_to_json(wsCobranza);
        rowsCobranza.forEach((r) => {
          const id = r['ID_SISTEMA'] || r['ID'];
          const cr = r['Contrarecibo'] || r['CONTRARECIBO'] || '';

          if (id) {
            const match = globalOrders.find((o) => o.id === id);
            if (match) {
              const inv = match.invoices && match.invoices.length > 0 ? match.invoices[0] : null;
              const currentCr = inv?.collection?.contrareciboNumber || match.collection?.contrareciboNumber || '';
              if (cr && cr !== currentCr) {
                newDiffs.push({
                  tab: 'cobranza',
                  type: 'mod',
                  label: `Expediente ${match.folio || id} — Contrarecibo`,
                  orderId: match.id,
                  campo: 'contrarecibo',
                  oldValue: currentCr || '—',
                  newValue: cr,
                });
              }
            }
          }
        });
      }

      setDiffs(newDiffs);
      if (newDiffs.length === 0) {
        toast('No se encontraron diferencias contra la base de datos.', 'info');
      } else {
        toast(`Se detectaron ${newDiffs.length} diferencia(s) para revisar.`, 'ok');
      }
    } catch (e: any) {
      toast(`Error al leer Excel: ${e.message}`, 'bad');
    }
    setIsProcessing(false);
  };

  const applyClassicDiffs = async () => {
    if (diffs.length === 0) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      diffs.forEach((d) => {
        if ('orderId' in d && d.orderId && d.campo === 'contrarecibo') {
          const match = globalOrders.find((o) => o.id === d.orderId);
          if (match) {
            const ref = doc(db, PATHS.orders, match.id);
            const invoices = [...(match.invoices || [])];
            if (invoices.length > 0) {
              invoices[0].collection = {
                ...invoices[0].collection,
                contrareciboNumber: String(d.newValue),
              };
              batch.update(ref, camposInvoices(invoices));
              count++;
            }
          }
        }
      });
      if (count > 0) {
        await batch.commit();
        toast(`✓ ${count} ajuste(s) aplicados a la base de datos.`, 'ok');
        setDiffs([]);
        setFile(null);
      }
    } catch (e: any) {
      toast(`Error al aplicar: ${e.message}`, 'bad');
    }
    setIsProcessing(false);
  };

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⚖️</span> Auditoría &amp; Ajuste Rápido de Datos
          </h1>
          <p style={{ margin: 0, color: 'var(--ink-soft)' }}>
            Edita directamente en pantalla, pega datos desde Excel con <code>Ctrl + V</code> o ajusta precios masivamente.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {lastSnapshot && (
            <button
              className="btn btn-danger"
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => void handleRollback()}
              disabled={isProcessing}
              title="Revertir el último ajuste y restaurar el estado anterior"
            >
              <span>↩️</span> Deshacer Último Ajuste
            </button>
          )}

          <button
            className="btn btn-primary"
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => exportToExcel()}
          >
            <span>📥</span> Descargar Sábana Excel
          </button>
        </div>
      </div>

      {/* Selector de Modo Superior */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '2px solid var(--line)', paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          className={`btn ${mode === 'grid' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('grid')}
        >
          <span>📊</span> Sábana en Vivo (Excel en Pantalla)
        </button>

        <button
          className={`btn ${mode === 'paste' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('paste')}
        >
          <span>📋</span> Pegar Directo (Ctrl + V)
        </button>

        <button
          className={`btn ${mode === 'batch' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('batch')}
        >
          <span>⚡</span> Ajustador Masivo de Precios
        </button>

        <button
          className={`btn ${mode === 'excel' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('excel')}
        >
          <span>📁</span> Importar Archivo .xlsx
        </button>
      </div>

      {/* ─── VISTA 1: SÁBANA EN VIVO (DATA GRID) ───────────────────────────────── */}
      {mode === 'grid' && (
        <Card title="📊 Hoja de Cálculo en Vivo (Doble clic o Enter para editar)">
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="text"
                  placeholder="🔍 Filtrar por Folio, Cliente, CR, Estatus…"
                  value={gridFilter}
                  onChange={(e) => setGridFilter(e.target.value)}
                  style={{ width: 280, padding: '7px 12px', fontSize: 13 }}
                />
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Mostrando <strong>{gridRows.length}</strong> renglón{gridRows.length !== 1 ? 'es' : ''}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                💡 <em>Haz clic en cualquier celda para cambiar su valor al instante.</em>
              </div>
            </div>

            <div className="table-scroll" style={{ maxHeight: '65vh' }}>
              <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 5 }}>
                  <tr>
                    <th>OC / Expediente</th>
                    <th>Cliente</th>
                    <th>Factura</th>
                    <th>Contrarecibo</th>
                    <th className="num">Kilos</th>
                    <th className="num">Precio Venta</th>
                    <th className="num">Costo Andrés</th>
                    <th className="num">Total con IVA</th>
                    <th>Estatus</th>
                    <th>Emisión</th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((r) => {
                    return (
                      <tr key={r.key}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.oc}</td>
                        <td style={{ color: 'var(--ink)' }}>{r.cliente}</td>

                        {/* Folio Editable */}
                        <td
                          className="clickable"
                          style={{ fontWeight: 600, background: editingCell?.rowKey === r.key && editingCell?.field === 'folio' ? 'var(--paper-sunk)' : 'transparent' }}
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'folio' });
                            setEditValue(r.folio === '—' ? '' : r.folio);
                          }}
                        >
                          {editingCell?.rowKey === r.key && editingCell?.field === 'folio' ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave(r, 'folio', editValue);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={() => handleCellSave(r, 'folio', editValue)}
                              style={{ width: 90, padding: 2, fontSize: 12 }}
                            />
                          ) : (
                            <span>{r.folio}</span>
                          )}
                        </td>

                        {/* Contrarecibo Editable */}
                        <td
                          className="clickable"
                          style={{
                            fontWeight: 700,
                            color: r.contrarecibo ? 'var(--ink)' : 'var(--warn)',
                            background: editingCell?.rowKey === r.key && editingCell?.field === 'contrarecibo' ? 'var(--paper-sunk)' : 'transparent',
                          }}
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'contrarecibo' });
                            setEditValue(r.contrarecibo);
                          }}
                        >
                          {editingCell?.rowKey === r.key && editingCell?.field === 'contrarecibo' ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave(r, 'contrarecibo', editValue);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={() => handleCellSave(r, 'contrarecibo', editValue)}
                              style={{ width: 110, padding: 2, fontSize: 12 }}
                            />
                          ) : (
                            <span>{r.contrarecibo || '➕ Asignar CR'}</span>
                          )}
                        </td>

                        {/* Kilos Editables */}
                        <td
                          className="num mono clickable"
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'kilos' });
                            setEditValue(String(r.kilos));
                          }}
                        >
                          {editingCell?.rowKey === r.key && editingCell?.field === 'kilos' ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave(r, 'kilos', editValue);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={() => handleCellSave(r, 'kilos', editValue)}
                              style={{ width: 80, padding: 2, textAlign: 'right', fontSize: 12 }}
                            />
                          ) : (
                            <span>{r.kilos.toLocaleString('es-MX')} kg</span>
                          )}
                        </td>

                        {/* Precio Venta Editable */}
                        <td
                          className="num mono clickable"
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'precioVenta' });
                            setEditValue(String(r.precioVenta));
                          }}
                        >
                          {editingCell?.rowKey === r.key && editingCell?.field === 'precioVenta' ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.5"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave(r, 'precioVenta', editValue);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={() => handleCellSave(r, 'precioVenta', editValue)}
                              style={{ width: 70, padding: 2, textAlign: 'right', fontSize: 12 }}
                            />
                          ) : (
                            <span style={{ color: 'var(--ok)', fontWeight: 700 }}>${r.precioVenta.toFixed(2)}</span>
                          )}
                        </td>

                        {/* Costo Andrés Editable */}
                        <td
                          className="num mono clickable"
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'costoAndres' });
                            setEditValue(String(r.costoAndres));
                          }}
                        >
                          {editingCell?.rowKey === r.key && editingCell?.field === 'costoAndres' ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.5"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave(r, 'costoAndres', editValue);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={() => handleCellSave(r, 'costoAndres', editValue)}
                              style={{ width: 70, padding: 2, textAlign: 'right', fontSize: 12 }}
                            />
                          ) : (
                            <span style={{ color: 'var(--bad)', fontWeight: 600 }}>${r.costoAndres.toFixed(2)}</span>
                          )}
                        </td>

                        {/* Total Factura con IVA */}
                        <td className="num mono" style={{ fontWeight: 800 }}>
                          {money(r.totalFactura)}
                        </td>

                        {/* Estatus Selector */}
                        <td>
                          <select
                            value={r.estatus}
                            onChange={(e) => void handleCellSave(r, 'estatus', e.target.value)}
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'var(--paper-sunk)',
                              border: '1px solid var(--line)',
                            }}
                          >
                            {ESTATUS_VALIDOS.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{r.fechaEmision}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ─── VISTA 2: PEGAR DIRECTO (CTRL + V) ─────────────────────────────────── */}
      {mode === 'paste' && (
        <Card title="📋 Pegar Datos Directamente de Excel (Ctrl + C ➔ Ctrl + V)">
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Copia varias celdas en tu Excel (por ejemplo: Columna A = Folio/OC, Columna B = Contrarecibo) y pégalas aquí. El sistema detectará las coincidencias automáticamente.
            </p>

            <textarea
              placeholder="Haz clic aquí y presiona Ctrl + V para pegar celdas copiadas de Excel…"
              value={pasteText}
              onChange={(e) => handleParsePasted(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                padding: 12,
                fontFamily: 'monospace',
                fontSize: 12,
                borderRadius: 8,
                border: '2px dashed var(--line)',
                background: 'var(--paper-sunk)',
                marginBottom: 16,
              }}
            />

            {pasteParsedRows.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                  Vista Previa ({pasteParsedRows.length} renglones detectados):
                </div>

                <div className="table-scroll" style={{ maxHeight: '40vh', marginBottom: 16 }}>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Columna 1 (Folio / OC)</th>
                        <th>Columna 2 (Contrarecibo / Dato)</th>
                        <th>Columna 3</th>
                        <th>Columna 4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pasteParsedRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.col0}</td>
                          <td style={{ color: '#047857', fontWeight: 600 }}>{r.col1}</td>
                          <td>{r.col2}</td>
                          <td>{r.col3}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={() => void handleApplyPasted()}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Sincronizando…' : `⚡ Sincronizar ${pasteParsedRows.length} Renglones con la Base de Datos`}
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ─── VISTA 3: AJUSTADOR MASIVO DE PRECIOS ────────────────────────────── */}
      {mode === 'batch' && (
        <Card title="⚡ Ajustador Masivo de Precios de Venta y Costos de Compra">
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Modifica en bloque los precios unitarios en todas las órdenes seleccionadas. Esto actualizará el margen proyectado sin afectar el historial cerrado.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Aplicar a:</label>
                <select
                  value={batchTarget}
                  onChange={(e) => setBatchTarget(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--line)' }}
                >
                  <option value="pending">Órdenes Abiertas / Pendientes</option>
                  <option value="providencia">Todas las Órdenes de Grupo Providencia</option>
                  <option value="all">Todas las Órdenes del Sistema</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ok)' }}>Nuevo Precio Venta ($/kg):</label>
                <input
                  type="number"
                  step="0.5"
                  value={batchSalePrice}
                  onChange={(e) => setBatchSalePrice(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--line)', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)' }}>Nuevo Costo Andrés ($/kg):</label>
                <input
                  type="number"
                  step="0.5"
                  value={batchCostPrice}
                  onChange={(e) => setBatchCostPrice(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--line)', fontWeight: 700 }}
                />
              </div>
            </div>

            <div
              style={{
                background: 'var(--paper-sunk)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '14px 18px',
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Simulación del Impacto:
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Se modificarán <strong>{batchMatchingOrders.length}</strong> orden(es).
                Margen bruto por kilo quedará en: <strong>${(batchSalePrice - batchCostPrice).toFixed(2)} / kg</strong>.
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => void handleApplyBatchPrices()}
              disabled={isProcessing || batchMatchingOrders.length === 0}
              style={{ fontWeight: 700 }}
            >
              {isProcessing ? 'Actualizando…' : `⚡ Aplicar Nuevos Precios a ${batchMatchingOrders.length} Orden(es)`}
            </button>
          </div>
        </Card>
      )}

      {/* ─── VISTA 4: SUBIR ARCHIVO EXCEL CLÁSICO ──────────────────────────────── */}
      {mode === 'excel' && (
        <Card title="📁 Importar Archivo Excel (.xlsx / .xls)">
          <div style={{ padding: 16 }}>
            {!file && (
              <div style={{ border: '2px dashed var(--line)', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
                <label className="btn btn-primary" style={{ display: 'inline-flex', cursor: 'pointer', fontWeight: 700 }}>
                  📤 Seleccionar Archivo Excel Modificado
                  <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleUpload} />
                </label>
              </div>
            )}

            {isProcessing && <p style={{ textAlign: 'center', marginTop: '2rem', fontWeight: 700 }}>Procesando cruce de datos…</p>}

            {file && !isProcessing && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={`btn ${activeDiffTab === 'cobranza' ? 'btn-primary' : ''}`}
                      onClick={() => setActiveDiffTab('cobranza')}
                    >
                      Cobranza ({diffs.filter((d) => d.tab === 'cobranza').length})
                    </button>
                  </div>
                  <button className="btn" onClick={() => { setFile(null); setDiffs([]); }}>
                    ✕ Cancelar / Subir otro archivo
                  </button>
                </div>

                {diffs.length === 0 ? (
                  <Empty>No se detectaron diferencias en esta sección.</Empty>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Registro</th>
                          <th className="num">Valor Anterior</th>
                          <th className="num">Nuevo Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffs.map((d, i) => (
                          <tr key={i}>
                            <td>
                              <span className="badge" style={{ background: 'var(--warn)' }}>MODIFICADO</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{d.label}</td>
                            <td className="num mono" style={{ color: 'var(--ink-soft)' }}>
                              {d.oldValue || '—'}
                            </td>
                            <td className="num mono" style={{ fontWeight: 700 }}>
                              {d.newValue}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {diffs.length > 0 && (
                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn" onClick={() => { setFile(null); setDiffs([]); }}>Cancelar</button>
                    <button
                      className="btn btn-primary"
                      onClick={() => void applyClassicDiffs()}
                      disabled={diffs.length === 0}
                    >
                      Aplicar {diffs.length} Ajuste(s) a Base de Datos
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
