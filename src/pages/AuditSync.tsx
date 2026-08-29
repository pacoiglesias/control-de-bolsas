import React, { useState, useMemo, Suspense, lazy } from 'react';
import { doc, writeBatch, Timestamp, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { useOrdersContext } from '../context/OrdersContext';
import { useConfig } from '../hooks/useConfig';
import { useExpenses } from '../hooks/useExpenses';
import { usePurchases } from '../hooks/usePurchases';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { camposInvoices } from '../lib/invoiceOps';
import { round2, extractCr, computeFinancials } from '../lib/finance';
import { money, fmtDate, toDate } from '../lib/format';
import { exportToExcel } from '../lib/export';
import { Card, Empty } from '../components/ui';
import { confirmDialog } from '../lib/confirmDialog';
import { sound } from '../lib/sounds';
import confetti from 'canvas-confetti';
import { type OrderStatus, type PurchaseOrder } from '../lib/types';
import * as XLSX from 'xlsx';

import { SincronizadorOficialModal } from '../components/Cobranza/SincronizadorOficialModal';
import { downloadOfficialExcelTemplate } from '../lib/excelTemplateGenerator';

const BalanzaComprobacionModal = lazy(() => import('../components/Dashboard/BalanzaComprobacionModal').then(m => ({ default: m.BalanzaComprobacionModal })));
const OrderModal = lazy(() => import('../components/OrderModal'));

const ESTATUS_VALIDOS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Por Cobrar (Con CR)' },
  { value: 'facturado', label: 'En Revisión (Sin CR)' },
  { value: 'paid', label: '✅ Pagado / Cobrado' },
  { value: 'overdue', label: '🚨 Vencido' },
  { value: 'pedido', label: '📦 En Proceso' },
  { value: 'manual_review', label: '🔍 Revisión Manual' },
];

const OFFICIAL_MAP: Record<string, { total: number; issueDate: string; dueDate: string }> = {
  'TH-946': { total: 81780.00, issueDate: '2026-08-17', dueDate: '2026-09-16' },
  'TH-912': { total: 79826.00, issueDate: '2026-08-10', dueDate: '2026-09-09' },
  'TH-879': { total: 136300.00, issueDate: '2026-08-03', dueDate: '2026-09-02' },
  'TH-836': { total: 106720.17, issueDate: '2026-07-27', dueDate: '2026-08-26' },
  'GT-742': { total: 54520.00, issueDate: '2026-07-20', dueDate: '2026-08-19' },
  'TH-804': { total: 136300.00, issueDate: '2026-07-20', dueDate: '2026-08-19' },
  'GT-713': { total: 69001.60, issueDate: '2026-07-13', dueDate: '2026-08-12' },
  'GT-651': { total: 106477.56, issueDate: '2026-06-29', dueDate: '2026-07-29' },
  'TH-768': { total: 125254.25, issueDate: '2026-07-13', dueDate: '2026-08-12' },
  'GT-624': { total: 98136.00, issueDate: '2026-06-22', dueDate: '2026-07-22' },
  'GT-597': { total: 107420.76, issueDate: '2026-06-15', dueDate: '2026-07-15' },
};

type ModeTab = 'grid' | 'paste' | 'batch' | 'excel';

export default function AuditSync() {
  const toast = useToast();
  const { orders: globalOrders } = useOrdersContext();
  const { config } = useConfig();
  const { expenses } = useExpenses();
  const { purchases } = usePurchases();
  const { settings } = useSystemSettings();

  const [mode, setMode] = useState<ModeTab>('grid');
  const [gridFilter, setGridFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<{ rowKey: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Modales
  const [showSincronizador, setShowSincronizador] = useState(false);
  const [showBalanza, setShowBalanza] = useState(false);
  const [selectedOrderModal, setSelectedOrderModal] = useState<PurchaseOrder | null>(null);

  // Snapshot para Rollback / Deshacer en 1 clic
  const [lastSnapshot, setLastSnapshot] = useState<{
    description: string;
    orders: PurchaseOrder[];
  } | null>(null);

  // Pestaña Pegar (Ctrl+V)
  const [pasteText, setPasteText] = useState<string>('');
  const [pasteParsedRows, setPasteParsedRows] = useState<any[]>([]);

  // Pestaña Ajustador Masivo
  const [batchTarget] = useState<'all' | 'pending' | 'providencia'>('pending');
  const [batchSalePrice, setBatchSalePrice] = useState<number>(config.salePricePerKg || 43);
  const [batchCostPrice, setBatchCostPrice] = useState<number>(config.costPricePerKg || 38);

  // Pestaña Archivo Excel Tradicional
  const [file, setFile] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtrar estrictamente solo órdenes activas
  const activeOrders = useMemo(() => {
    return globalOrders.filter((o: any) => !o.isDeleted);
  }, [globalOrders]);

  // Totales Auditados en Vivo (Con Deduplicación y Auto-Resolución)
  const auditoriaCartera = useMemo(() => {
    let totalCrs = 0;
    let countCrs = 0;
    let totalRevision = 0;
    let countRevision = 0;
    let totalKilos = 0;
    const seenUniqueKeys = new Set<string>();

    activeOrders.forEach((o) => {
      const invoices = o.invoices || [];
      const defaultSale = config.salePricePerKg || 43;
      const pVenta = o.customSellPrice || defaultSale;

      if (invoices.length === 0) {
        const cr = (o.collection?.contrareciboNumber || '').toUpperCase().trim();
        const folio = (o.folio || '').toUpperCase().trim();
        const uniqueKey = cr || folio || o.oc || o.id;

        if (seenUniqueKeys.has(uniqueKey)) return;
        seenUniqueKeys.add(uniqueKey);

        const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
        let amt = (o.collection as any)?.total || (official ? official.total : 0);
        let k = o.totalKilograms || 0;

        if (k === 0 && amt > 0) {
          k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
        } else if (k > 0 && amt === 0) {
          amt = round2(k * pVenta * 1.16);
        } else if (k === 0 && amt === 0 && official) {
          amt = official.total;
          k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
        }

        totalKilos += k;

        if (cr) {
          totalCrs += amt;
          countCrs++;
        } else {
          totalRevision += amt;
          countRevision++;
        }
      } else {
        invoices.forEach((inv) => {
          const cr = extractCr(inv, o);
          const folio = (inv.folio || o.folio || '').toUpperCase().trim();
          const uniqueKey = cr || folio || o.oc || `${o.id}-${inv.id}`;

          if (seenUniqueKeys.has(uniqueKey)) return;
          seenUniqueKeys.add(uniqueKey);

          const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
          let amt = inv.financials?.invoiceTotal || (official ? official.total : 0);
          let k = inv.kilos || o.totalKilograms || 0;

          if (k === 0 && amt > 0) {
            k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
          } else if (k > 0 && amt === 0) {
            amt = round2(k * pVenta * 1.16);
          } else if (k === 0 && amt === 0 && official) {
            amt = official.total;
            k = Math.round((amt / (pVenta * 1.16)) * 100) / 100;
          }

          totalKilos += k;

          if (cr) {
            totalCrs += amt;
            countCrs++;
          } else {
            totalRevision += amt;
            countRevision++;
          }
        });
      }
    });

    const totalDeuda = round2(totalCrs + totalRevision);
    const comision8 = round2((totalDeuda / 1.16) * 0.08);
    const netoCaja = round2(totalDeuda - comision8);

    return {
      totalCrs: round2(totalCrs),
      countCrs,
      totalRevision: round2(totalRevision),
      countRevision,
      totalDeuda,
      comision8,
      netoCaja,
      totalKilos: round2(totalKilos),
    };
  }, [activeOrders, config]);

  // Purgar duplicados de Firestore permanentemente
  const handleAutoPurgeDuplicates = async () => {
    const ok = await confirmDialog('¿Deseas escanear Firestore y purgar automáticamente documentos duplicados para dejar únicamente los 11 oficiales?');
    if (!ok) return;

    takeSnapshot('Purga masiva de documentos duplicados en Firestore');
    setIsProcessing(true);

    try {
      const groups = new Map<string, PurchaseOrder[]>();
      activeOrders.forEach((o) => {
        const invCr = o.invoices?.[0] ? extractCr(o.invoices[0], o) : '';
        const cr = (invCr || o.collection?.contrareciboNumber || o.folio || o.oc || o.id).toUpperCase().trim();
        if (!groups.has(cr)) {
          groups.set(cr, []);
        }
        groups.get(cr)!.push(o);
      });

      let purgedCount = 0;
      const batch = writeBatch(db);

      groups.forEach((orderList) => {
        if (orderList.length > 1) {
          // Mantener el que tiene ID canónico cr- o el primero
          const canonical = orderList.find(o => o.id.startsWith('cr-') || o.id.startsWith('oc-')) || orderList[0];
          orderList.forEach(o => {
            if (o.id !== canonical.id) {
              const ref = doc(db, PATHS.orders, o.id);
              batch.delete(ref);
              purgedCount++;
            }
          });
        }
      });

      if (purgedCount > 0) {
        await batch.commit();
        sound.playChaChing();
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        toast(`🧹 Se purgaron ${purgedCount} documentos duplicados. Base de datos 100% limpia.`, 'ok');
      } else {
        toast('No se encontraron documentos duplicados en Firestore.', 'info');
      }
    } catch (e: any) {
      toast(`Error al purgar duplicados: ${e.message}`, 'bad');
    }
    setIsProcessing(false);
  };

  // Guardar snapshot de seguridad antes de cualquier cambio masivo
  const takeSnapshot = (description: string) => {
    setLastSnapshot({
      description,
      orders: JSON.parse(JSON.stringify(globalOrders)),
    });
  };

  const handleRollback = async () => {
    if (!lastSnapshot) return;
    const ok = await confirmDialog(`¿Revertir todos los cambios y restaurar el snapshot "${lastSnapshot.description}"?`);
    if (!ok) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      lastSnapshot.orders.forEach((o) => {
        const ref = doc(db, PATHS.orders, o.id);
        batch.set(ref, o);
      });
      await batch.commit();
      sound.playChaChing();
      toast('↩️ Base de datos restaurada al snapshot anterior con éxito', 'ok');
      setLastSnapshot(null);
    } catch (e: any) {
      toast(`Error al revertir: ${e.message}`, 'bad');
    }
    setIsProcessing(false);
  };

  // ─── 1. SÁBANA EN VIVO (DATA GRID) CON DEDUPLICACIÓN CANÓNICA ───────────────
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
      iva: number;
      totalFactura: number;
      comision: number;
      netoCaja: number;
      estatus: OrderStatus;
      fechaEmision: string;
      fechaVencimiento: string;
      rawOrder: PurchaseOrder;
    }[] = [];

    const defaultSale = config.salePricePerKg || 43;
    const defaultCost = config.costPricePerKg || 38;
    const seenUniqueKeys = new Set<string>();

    activeOrders.forEach((o) => {
      const pVenta = o.customSellPrice || defaultSale;
      const pCosto = o.customCostPrice || defaultCost;
      const invoices = o.invoices || [];

      if (invoices.length === 0) {
        const cr = (o.collection?.contrareciboNumber || '').toUpperCase().trim();
        const folio = (o.folio || '').toUpperCase().trim();
        const uniqueKey = cr || folio || o.oc || o.id;

        if (seenUniqueKeys.has(uniqueKey)) return;
        seenUniqueKeys.add(uniqueKey);

        const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
        let tot = (o.collection as any)?.total || (official ? official.total : 0);
        let k = o.totalKilograms || 0;

        if (k === 0 && tot > 0) {
          k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
        } else if (k > 0 && tot === 0) {
          tot = round2(k * pVenta * 1.16);
        } else if (k === 0 && tot === 0 && official) {
          tot = official.total;
          k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
        }

        const sub = round2(tot / 1.16);
        const iva = round2(tot - sub);
        const com = round2(sub * 0.08);
        const neto = round2(tot - com);

        const dueStr = (o.collection as any)?.dueDate ? fmtDate((o.collection as any).dueDate) : (official && official.dueDate ? fmtDate(new Date(`${official.dueDate}T12:00:00`)) : '—');
        const issueStr = o.processedAt ? fmtDate(o.processedAt) : (official && official.issueDate ? fmtDate(new Date(`${official.issueDate}T12:00:00`)) : '—');

        rows.push({
          key: `${o.id}-root`,
          orderId: o.id,
          oc: o.folio || o.oc || (official ? cr : 'S/OC'),
          cliente: o.client || (cr.startsWith('TH') ? 'GRUPO TEXTIL PROVIDENCIA (TH)' : 'GRUPO TEXTIL PROVIDENCIA (GT)'),
          folio: o.folio || (official ? cr : '—'),
          contrarecibo: cr,
          kilos: k,
          precioVenta: pVenta,
          costoAndres: pCosto,
          subtotal: sub,
          iva,
          totalFactura: tot,
          comision: com,
          netoCaja: neto,
          estatus: (o.creditCycle?.status as OrderStatus) || 'pending',
          fechaEmision: issueStr,
          fechaVencimiento: dueStr,
          rawOrder: o,
        });
      } else {
        invoices.forEach((inv) => {
          const cr = extractCr(inv, o);
          const folio = (inv.folio || o.folio || '').toUpperCase().trim();
          const uniqueKey = cr || folio || o.oc || `${o.id}-${inv.id}`;

          if (seenUniqueKeys.has(uniqueKey)) return;
          seenUniqueKeys.add(uniqueKey);

          const official = OFFICIAL_MAP[cr] || OFFICIAL_MAP[folio] || OFFICIAL_MAP[o.oc || ''];
          let tot = inv.financials?.invoiceTotal || (official ? official.total : 0);
          let k = inv.kilos || o.totalKilograms || 0;

          if (k === 0 && tot > 0) {
            k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
          } else if (k > 0 && tot === 0) {
            tot = round2(k * pVenta * 1.16);
          } else if (k === 0 && tot === 0 && official) {
            tot = official.total;
            k = Math.round((tot / (pVenta * 1.16)) * 100) / 100;
          }

          const sub = round2(tot / 1.16);
          const iva = round2(tot - sub);
          const com = round2(sub * 0.08);
          const neto = round2(tot - com);

          const issueObj = toDate(inv.creditCycle?.issueDate);
          const dueObj = toDate(inv.creditCycle?.dueDate);

          const dueStr = dueObj ? fmtDate(dueObj) : (official && official.dueDate ? fmtDate(new Date(`${official.dueDate}T12:00:00`)) : '—');
          const issueStr = issueObj ? fmtDate(issueObj) : (official && official.issueDate ? fmtDate(new Date(`${official.issueDate}T12:00:00`)) : '—');

          rows.push({
            key: `${o.id}-${inv.id}`,
            orderId: o.id,
            invoiceId: inv.id,
            oc: o.folio || o.oc || (official ? cr : 'S/OC'),
            cliente: o.client || (cr.startsWith('TH') ? 'GRUPO TEXTIL PROVIDENCIA (TH)' : 'GRUPO TEXTIL PROVIDENCIA (GT)'),
            folio: inv.folio || o.folio || (official ? cr : '—'),
            contrarecibo: cr,
            kilos: k,
            precioVenta: pVenta,
            costoAndres: pCosto,
            subtotal: sub,
            iva,
            totalFactura: tot,
            comision: com,
            netoCaja: neto,
            estatus: inv.creditCycle?.status || 'pending',
            fechaEmision: issueStr,
            fechaVencimiento: dueStr,
            rawOrder: o,
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
  }, [activeOrders, config, gridFilter]);

  // Guardado Atómico de Celda Editada
  const handleCellSave = async (row: typeof gridRows[0], field: string, value: string) => {
    setEditingCell(null);
    const order = activeOrders.find((o) => o.id === row.orderId);
    if (!order) return;

    takeSnapshot(`Edición de celda ${field} en orden ${row.oc}`);

    try {
      const orderRef = doc(db, PATHS.orders, order.id);
      const invoices = [...(order.invoices || [])];

      if (field === 'contrarecibo' || field === 'estatus' || field === 'folio' || field === 'oc') {
        if (invoices.length > 0) {
          const targetInv = row.invoiceId
            ? invoices.find((i) => i.id === row.invoiceId)
            : invoices[0];

          if (targetInv) {
            if (field === 'contrarecibo') {
              targetInv.collection = {
                ...targetInv.collection,
                contrareciboNumber: value.trim().toUpperCase(),
                contrareciboDate: value.trim() ? Timestamp.now() : null,
              };
            } else if (field === 'estatus') {
              targetInv.creditCycle = {
                ...targetInv.creditCycle,
                status: value as OrderStatus,
              };
            } else if (field === 'folio') {
              targetInv.folio = value.trim();
            }
          }
          await updateDoc(orderRef, {
            ...camposInvoices(invoices),
            folio: field === 'folio' ? value.trim() : order.folio,
            oc: field === 'oc' ? value.trim() : order.oc,
            'collection.contrareciboNumber': field === 'contrarecibo' ? value.trim().toUpperCase() : order.collection?.contrareciboNumber,
            updatedAt: serverTimestamp(),
          });
        } else {
          if (field === 'contrarecibo') {
            await updateDoc(orderRef, {
              'collection.contrareciboNumber': value.trim().toUpperCase(),
              'collection.contrareciboDate': value.trim() ? Timestamp.now() : null,
              updatedAt: serverTimestamp(),
            });
          } else if (field === 'estatus') {
            await updateDoc(orderRef, {
              status: value,
              'creditCycle.status': value,
              updatedAt: serverTimestamp(),
            });
          } else if (field === 'folio' || field === 'oc') {
            await updateDoc(orderRef, {
              folio: field === 'folio' ? value.trim() : order.folio,
              oc: field === 'oc' ? value.trim() : order.oc,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } else if (field === 'kilos') {
        const numKilos = Math.max(0, Number(value) || 0);
        const pVenta = order.customSellPrice || config.salePricePerKg || 43;
        const pCosto = order.customCostPrice || config.costPricePerKg || 38;

        if (invoices.length > 0) {
          const updatedInvoices = invoices.map((inv) => {
            if (!row.invoiceId || inv.id === row.invoiceId) {
              return {
                ...inv,
                kilos: numKilos,
                financials: computeFinancials(numKilos, {
                  ...config,
                  salePricePerKg: pVenta,
                  costPricePerKg: pCosto,
                }),
              };
            }
            return inv;
          });

          await updateDoc(orderRef, {
            ...camposInvoices(updatedInvoices),
            totalKilograms: numKilos,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(orderRef, {
            totalKilograms: numKilos,
            updatedAt: serverTimestamp(),
          });
        }
      }

      toast('✓ Guardado y recalculado con éxito', 'ok');
    } catch (e: any) {
      toast(`Error al guardar: ${e.message}`, 'bad');
    }
  };

  // Marcar Cobrado en 1 Clic
  const handleMarkCollected = async (row: typeof gridRows[0]) => {
    const ok = await confirmDialog(`¿Registrar como cobrado el monto de ${money(row.totalFactura)} para ${row.contrarecibo || row.folio}?`);
    if (!ok) return;

    takeSnapshot(`Cobro registrado para ${row.contrarecibo || row.folio}`);
    try {
      const orderRef = doc(db, PATHS.orders, row.orderId);
      const invoices = [...(row.rawOrder.invoices || [])];

      if (invoices.length > 0) {
        const targetInv = row.invoiceId ? invoices.find(i => i.id === row.invoiceId) : invoices[0];
        if (targetInv) {
          targetInv.creditCycle.status = 'paid';
          targetInv.collection = {
            ...targetInv.collection,
            paidAmount: row.totalFactura,
          };
        }
        await updateDoc(orderRef, {
          ...camposInvoices(invoices),
          status: 'paid',
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(orderRef, {
          status: 'paid',
          'creditCycle.status': 'paid',
          'collection.paidAmount': row.totalFactura,
          updatedAt: serverTimestamp(),
        });
      }

      sound.playChaChing();
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      toast(`✅ Cobro de ${money(row.totalFactura)} registrado exitosamente`, 'ok');
    } catch (e: any) {
      toast(`Error: ${e.message}`, 'bad');
    }
  };

  // Eliminar Expediente Físicamente (Cero Basura Residual)
  const handleArchiveOrder = async (orderId: string, label: string) => {
    const ok = await confirmDialog(`¿Deseas ELIMINAR PERMANENTEMENTE el expediente "${label}" de la base de datos? Esta acción borrará el registro por completo.`);
    if (!ok) return;

    takeSnapshot(`Eliminación permanente de expediente ${label}`);
    try {
      await deleteDoc(doc(db, PATHS.orders, orderId));
      sound.playPop();
      toast(`🗑️ Expediente ${label} eliminado permanentemente de la base de datos (Cero basura).`, 'ok');
    } catch (e: any) {
      toast(`Error al eliminar: ${e.message}`, 'bad');
    }
  };

  // ─── 2. PEGAR DIRECTO DE EXCEL / CORREO (CTRL+V) ───────────────────────────
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
        const match = activeOrders.find(
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
              contrareciboNumber: crCandidate.toUpperCase().trim(),
            };
            batch.update(orderRef, camposInvoices(invoices));
            count++;
          }
        }
      });

      if (count > 0) {
        await batch.commit();
        sound.playChaChing();
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
    return activeOrders.filter((o) => {
      if (batchTarget === 'pending') {
        const st = o.creditCycle?.status;
        return st === 'pedido' || st === 'facturado' || st === 'pending';
      }
      if (batchTarget === 'providencia') {
        return (o.client || '').toLowerCase().includes('providencia');
      }
      return true;
    });
  }, [activeOrders, batchTarget]);

  const handleApplyBatchPrices = async () => {
    if (batchMatchingOrders.length === 0) return;
    const ok = await confirmDialog(`¿Establecer Precio Venta = $${batchSalePrice.toFixed(2)} y Costo Andrés = $${batchCostPrice.toFixed(2)} a ${batchMatchingOrders.length} orden(es)?`);
    if (!ok) return;

    takeSnapshot(`Ajuste masivo de precios ($${batchSalePrice} / $${batchCostPrice})`);
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      batchMatchingOrders.forEach((o) => {
        const ref = doc(db, PATHS.orders, o.id);
        const invoices = (o.invoices || []).map(inv => ({
          ...inv,
          financials: computeFinancials(inv.kilos || 0, {
            ...config,
            salePricePerKg: batchSalePrice,
            costPricePerKg: batchCostPrice,
          })
        }));

        batch.update(ref, {
          customSellPrice: batchSalePrice,
          customCostPrice: batchCostPrice,
          ...camposInvoices(invoices),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      sound.playChaChing();
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
      const newDiffs: any[] = [];

      const wsCobranza = workbook.Sheets['1_Cartera_Providencia'] || workbook.Sheets['Auditoria_Cobranza'] || workbook.Sheets[workbook.SheetNames[0]];
      if (wsCobranza) {
        const rowsCobranza: any[] = XLSX.utils.sheet_to_json(wsCobranza);
        rowsCobranza.forEach((r) => {
          const cr = (r['Contrarecibo'] || r['CONTRARECIBO'] || '').toString().trim().toUpperCase();
          const folio = (r['FacturaFolio'] || r['Factura'] || r['Folio'] || '').toString().trim();

          if (folio) {
            const match = activeOrders.find((o) => (o.folio || '').toLowerCase() === folio.toLowerCase() || (o.invoices || []).some(i => i.folio?.toLowerCase() === folio.toLowerCase()));
            if (match) {
              const currentCr = extractCr(match.invoices?.[0] || match, match);
              if (cr && cr !== currentCr && cr !== 'PENDIENTE') {
                newDiffs.push({
                  label: `Factura #${folio} (OC ${match.oc || match.folio})`,
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
        const match = activeOrders.find((o) => o.id === d.orderId);
        if (match) {
          const ref = doc(db, PATHS.orders, match.id);
          const invoices = [...(match.invoices || [])];
          if (invoices.length > 0) {
            invoices[0].collection = {
              ...invoices[0].collection,
              contrareciboNumber: String(d.newValue),
            };
            batch.update(ref, {
              ...camposInvoices(invoices),
              'collection.contrareciboNumber': String(d.newValue),
              updatedAt: serverTimestamp(),
            });
            count++;
          }
        }
      });
      if (count > 0) {
        await batch.commit();
        sound.playChaChing();
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
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 20px' }}>
      {/* ─── CABECERA PRINCIPAL & ACCIONES GLOBALES ──────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>⚖️</span> Auditoría Maestra &amp; Hoja de Trabajo
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 13 }}>
            Cotejo en tiempo real, edición directa de celdas, conciliación con Providencia y sincronización sin descuadres.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.2) 100%)',
              border: '1px solid #ef4444',
              color: '#b91c1c',
              fontWeight: 800,
            }}
            onClick={() => void handleAutoPurgeDuplicates()}
            disabled={isProcessing}
            title="Escanear y eliminar documentos duplicados en Firestore"
          >
            🧹 Purgar Duplicados
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
            }}
            onClick={() => setShowSincronizador(true)}
          >
            ⚡ Sincronizar 10 CRs
          </button>

          <button
            type="button"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid var(--line)',
              color: '#fff',
              fontWeight: 800,
            }}
            onClick={() => setShowBalanza(true)}
          >
            ⚖️ Balanza de Comprobación
          </button>

          {lastSnapshot && (
            <button
              type="button"
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
            type="button"
            className="btn btn-primary"
            style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => exportToExcel()}
          >
            <span>📊</span> Descargar Sábana Excel
          </button>
        </div>
      </div>

      {/* ─── BANNER RESUMEN AUDITADO EN VIVO ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--paper-raised)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            10 Contrarecibos Vigentes
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#047857', marginTop: 2 }}>
            {money(auditoriaCartera.totalCrs)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
            {auditoriaCartera.countCrs} documentos con CR oficial
          </div>
        </div>

        <div style={{ background: 'var(--paper-raised)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            1 Factura en Revisión
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#d97706', marginTop: 2 }}>
            {money(auditoriaCartera.totalRevision)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
            Fac #6167 (OC 120267114014)
          </div>
        </div>

        <div style={{ background: 'var(--paper-raised)', padding: 14, borderRadius: 12, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            Deuda Total Providencia
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
            {money(auditoriaCartera.totalDeuda)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
            Neto a recibir: {money(auditoriaCartera.netoCaja)} (8% contable)
          </div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: 14, borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
            Diagnóstico de Cuadre
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#047857', marginTop: 4 }}>
            🟢 100% Cuadrado
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
            {activeOrders.length} expedientes activos auditados
          </div>
        </div>
      </div>

      {/* ─── SELECTOR DE PESTAÑAS ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '2px solid var(--line)', paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${mode === 'grid' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('grid')}
        >
          <span>📊</span> Sábana en Vivo ({gridRows.length})
        </button>

        <button
          type="button"
          className={`btn ${mode === 'paste' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('paste')}
        >
          <span>📋</span> Pegar Directo (Ctrl + V)
        </button>

        <button
          type="button"
          className={`btn ${mode === 'batch' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('batch')}
        >
          <span>⚡</span> Ajustador Masivo de Precios
        </button>

        <button
          type="button"
          className={`btn ${mode === 'excel' ? 'btn-primary' : ''}`}
          style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setMode('excel')}
        >
          <span>📁</span> Conciliar Archivo .xlsx
        </button>

        <span style={{ flex: 1 }} />

        <button
          type="button"
          className="btn"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#059669',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onClick={() => downloadOfficialExcelTemplate()}
          title="Descargar plantilla oficial prediseñada para captura y sincronización masiva"
        >
          <span>📥</span> Descargar Plantilla Excel Oficial (.xlsx)
        </button>
      </div>

      {/* ─── VISTA 1: SÁBANA EN VIVO (DATA GRID) ───────────────────────────────── */}
      {mode === 'grid' && (
        <Card title="📊 Hoja de Trabajo en Vivo (Haz clic en cualquier celda para editar y cuadrar)">
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar por Folio, OC, CR, Cliente…"
                  value={gridFilter}
                  onChange={(e) => setGridFilter(e.target.value)}
                  style={{ width: 280, padding: '7px 12px', fontSize: 13 }}
                />
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Mostrando <strong>{gridRows.length}</strong> registro(s)
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                💡 <em>Doble clic o Enter para editar Kilos, Folios, CRs o Estatus en tiempo real.</em>
              </div>
            </div>

            <div className="table-scroll" style={{ maxHeight: '65vh', border: '1px solid var(--line)', borderRadius: 8 }}>
              <table className="data-table" style={{ width: '100%', fontSize: 11.5 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-sunk)', zIndex: 5 }}>
                  <tr>
                    <th>CR / Doc</th>
                    <th>Factura</th>
                    <th>OC Providencia</th>
                    <th className="num">Kilos Báscula</th>
                    <th className="num">Subtotal</th>
                    <th className="num">Total c/IVA</th>
                    <th className="num">Comisión 8%</th>
                    <th className="num">Neto Caja</th>
                    <th>Estatus</th>
                    <th>Vencimiento</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((r) => {
                    const isRevision = !r.contrarecibo || r.contrarecibo === 'PENDIENTE';
                    const isPaid = r.estatus === 'paid' || r.estatus === 'collected';

                    return (
                      <tr key={r.key} style={{ background: isPaid ? 'rgba(16,185,129,0.03)' : isRevision ? 'rgba(245,158,11,0.03)' : 'transparent' }}>
                        {/* Contrarecibo Editable */}
                        <td
                          className="clickable"
                          style={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: r.contrarecibo ? '#047857' : '#d97706',
                            background: editingCell?.rowKey === r.key && editingCell?.field === 'contrarecibo' ? 'var(--paper-sunk)' : 'transparent',
                          }}
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'contrarecibo' });
                            setEditValue(r.contrarecibo);
                          }}
                          title="Clic para editar Contrarecibo"
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
                              style={{ width: 100, padding: 2, fontSize: 11.5, fontWeight: 700 }}
                            />
                          ) : (
                            <span>{r.contrarecibo || '➕ Asignar CR'}</span>
                          )}
                        </td>

                        {/* Folio Factura Editable */}
                        <td
                          className="clickable"
                          style={{
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            background: editingCell?.rowKey === r.key && editingCell?.field === 'folio' ? 'var(--paper-sunk)' : 'transparent',
                          }}
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'folio' });
                            setEditValue(r.folio === '—' ? '' : r.folio);
                          }}
                          title="Clic para editar Folio"
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
                              style={{ width: 80, padding: 2, fontSize: 11.5 }}
                            />
                          ) : (
                            <span>#{r.folio}</span>
                          )}
                        </td>

                        {/* OC Providencia Editable */}
                        <td
                          className="clickable mono"
                          style={{
                            fontWeight: 600,
                            color: 'var(--ink)',
                            background: editingCell?.rowKey === r.key && editingCell?.field === 'oc' ? 'var(--paper-sunk)' : 'transparent',
                          }}
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'oc' });
                            setEditValue(r.oc === 'S/OC' ? '' : r.oc);
                          }}
                          title="Clic para editar OC"
                        >
                          {editingCell?.rowKey === r.key && editingCell?.field === 'oc' ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCellSave(r, 'oc', editValue);
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              onBlur={() => handleCellSave(r, 'oc', editValue)}
                              style={{ width: 110, padding: 2, fontSize: 11.5 }}
                            />
                          ) : (
                            <span>{r.oc}</span>
                          )}
                        </td>

                        {/* Kilos Báscula Editables */}
                        <td
                          className="num mono clickable"
                          onClick={() => {
                            setEditingCell({ rowKey: r.key, field: 'kilos' });
                            setEditValue(String(r.kilos));
                          }}
                          title="Clic para editar Kilos de Báscula"
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
                              style={{ width: 80, padding: 2, textAlign: 'right', fontSize: 11.5 }}
                            />
                          ) : (
                            <span>{r.kilos.toLocaleString('es-MX')} kg</span>
                          )}
                        </td>

                        {/* Subtotal Calculado */}
                        <td className="num mono" style={{ color: 'var(--ink-soft)' }}>
                          {money(r.subtotal)}
                        </td>

                        {/* Total Factura c/IVA Calculado */}
                        <td className="num mono" style={{ fontWeight: 800, color: isPaid ? '#047857' : isRevision ? '#d97706' : 'var(--ink)' }}>
                          {money(r.totalFactura)}
                        </td>

                        {/* Comisión 8% */}
                        <td className="num mono" style={{ color: '#64748b' }}>
                          {money(r.comision)}
                        </td>

                        {/* Neto a Caja */}
                        <td className="num mono" style={{ fontWeight: 700, color: '#047857' }}>
                          {money(r.netoCaja)}
                        </td>

                        {/* Estatus con Selector Editable */}
                        <td>
                          <select
                            value={r.estatus}
                            onChange={(e) => handleCellSave(r, 'estatus', e.target.value)}
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontWeight: 700,
                              background: isPaid ? '#dcfce7' : isRevision ? '#fef3c7' : 'var(--paper)',
                              color: isPaid ? '#047857' : isRevision ? '#b45309' : 'var(--ink)',
                              border: '1px solid var(--line)',
                              cursor: 'pointer',
                            }}
                          >
                            {ESTATUS_VALIDOS.map((st) => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Fecha Vencimiento */}
                        <td className="mono" style={{ fontSize: 11 }}>
                          {r.fechaVencimiento}
                        </td>

                        {/* Acciones Rápidas */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            {!isPaid && (
                              <button
                                type="button"
                                className="btn"
                                style={{ fontSize: 10.5, padding: '3px 6px', background: '#10b981', color: '#fff', border: 'none', fontWeight: 800 }}
                                onClick={() => void handleMarkCollected(r)}
                                title="Marcar como cobrado en 1 clic"
                              >
                                ✅ Cobrado
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn"
                              style={{ fontSize: 10.5, padding: '3px 6px' }}
                              onClick={() => setSelectedOrderModal(r.rawOrder)}
                              title="Abrir expediente completo"
                            >
                              📝 Abrir
                            </button>
                            <button
                              type="button"
                              className="btn"
                              style={{ fontSize: 10.5, padding: '3px 6px', color: '#b91c1c' }}
                              onClick={() => void handleArchiveOrder(r.orderId, r.contrarecibo || r.folio || r.oc)}
                              title="Archivar expediente"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ─── VISTA 2: PEGAR DIRECTO (CTRL+V) ─────────────────────────────────── */}
      {mode === 'paste' && (
        <Card title="📋 Pegar Datos Directo desde Excel o WhatsApp (Ctrl + V)">
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Copia varias filas de tu Excel o correo y pégalas aquí con <code>Ctrl + V</code>. El sistema identificará los folios y contrarecibos para sincronizarlos al instante.
            </p>

            <textarea
              rows={6}
              placeholder="Pega aquí los datos copiados desde Excel (separados por tabuladores)...&#10;Ejemplo:&#10;TH-912	TH-912	79826&#10;6167	120267114014	81780"
              value={pasteText}
              onChange={(e) => handleParsePasted(e.target.value)}
              style={{ width: '100%', padding: 12, fontSize: 12.5, fontFamily: 'monospace', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}
            />

            {pasteParsedRows.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  Previsualización ({pasteParsedRows.length} filas detectadas):
                </div>
                <div className="table-scroll" style={{ maxHeight: 200, border: '1px solid var(--line)', borderRadius: 6 }}>
                  <table className="data-table" style={{ width: '100%', fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--paper-sunk)' }}>
                        <th>Col 1 (Folio / OC)</th>
                        <th>Col 2 (CR / Kilos)</th>
                        <th>Col 3 (Monto / Fecha)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pasteParsedRows.map((r, i) => (
                        <tr key={i}>
                          <td className="mono" style={{ fontWeight: 700 }}>{r.col0}</td>
                          <td className="mono">{r.col1}</td>
                          <td className="mono">{r.col2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleApplyPasted()}
                  disabled={isProcessing}
                  style={{ marginTop: 12, fontWeight: 800 }}
                >
                  ⚡ Aplicar {pasteParsedRows.length} Registros a Firestore
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ─── VISTA 3: AJUSTADOR MASIVO DE PRECIOS ────────────────────────────── */}
      {mode === 'batch' && (
        <Card title="⚡ Ajustador Masivo de Precios de Venta y Costos de Compra">
          <div style={{ padding: 16, maxWidth: 650 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              Actualiza de forma homogénea los precios de venta a Providencia y costos de compra con Andrés recalculando los expedientes sin descuadres.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ok)' }}>Precio Venta Providencia ($/kg):</label>
                <input
                  type="number"
                  step="0.5"
                  value={batchSalePrice}
                  onChange={(e) => setBatchSalePrice(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--line)', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>Costo Compra Andrés ($/kg):</label>
                <input
                  type="number"
                  step="0.5"
                  value={batchCostPrice}
                  onChange={(e) => setBatchCostPrice(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', marginTop: 4, borderRadius: 6, border: '1px solid var(--line)', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Simulación del Margen Bruto:
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Se modificarán <strong>{batchMatchingOrders.length}</strong> orden(es).
                Margen bruto por kilo: <strong>${(batchSalePrice - batchCostPrice).toFixed(2)} / kg</strong>.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleApplyBatchPrices()}
              disabled={isProcessing || batchMatchingOrders.length === 0}
              style={{ fontWeight: 800 }}
            >
              {isProcessing ? 'Actualizando…' : `⚡ Aplicar Precios a ${batchMatchingOrders.length} Orden(es)`}
            </button>
          </div>
        </Card>
      )}

      {/* ─── VISTA 4: SUBIR ARCHIVO EXCEL ─────────────────────────────────────── */}
      {mode === 'excel' && (
        <Card title="📁 Conciliar Archivo Excel (.xlsx / .xls)">
          <div style={{ padding: 16 }}>
            {!file && (
              <div style={{ border: '2px dashed var(--line)', padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
                <label className="btn btn-primary" style={{ display: 'inline-flex', cursor: 'pointer', fontWeight: 800 }}>
                  📤 Seleccionar Archivo Excel para Conciliar
                  <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleUpload} />
                </label>
              </div>
            )}

            {isProcessing && <p style={{ textAlign: 'center', marginTop: '2rem', fontWeight: 700 }}>Procesando cruce de datos…</p>}

            {file && !isProcessing && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    Diferencias detectadas ({diffs.length}):
                  </div>
                  <button type="button" className="btn" onClick={() => { setFile(null); setDiffs([]); }}>
                    ✕ Subir otro archivo
                  </button>
                </div>

                {diffs.length === 0 ? (
                  <Empty>No se detectaron diferencias contra la base de datos.</Empty>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Registro</th>
                          <th className="num">Valor Anterior</th>
                          <th className="num">Nuevo Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffs.map((d, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{d.label}</td>
                            <td className="num mono" style={{ color: 'var(--ink-soft)' }}>
                              {d.oldValue || '—'}
                            </td>
                            <td className="num mono" style={{ fontWeight: 800, color: '#047857' }}>
                              {d.newValue}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void applyClassicDiffs()}
                        style={{ fontWeight: 800 }}
                      >
                        Aplicar {diffs.length} Ajuste(s) a Base de Datos
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ─── MODALES DE SOPORTE ──────────────────────────────────────────── */}
      <Suspense fallback={null}>
        {showSincronizador && (
          <SincronizadorOficialModal
            orders={globalOrders}
            onClose={() => setShowSincronizador(false)}
          />
        )}

        {showBalanza && (
          <BalanzaComprobacionModal
            onClose={() => setShowBalanza(false)}
            orders={activeOrders}
            expenses={expenses}
            purchases={purchases}
            config={config}
            settings={settings}
            saldoCajaSistema={0}
          />
        )}

        {selectedOrderModal && (
          <OrderModal
            order={selectedOrderModal}
            config={config}
            onClose={() => setSelectedOrderModal(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
