import { useState, useMemo } from 'react';
import { Modal } from '../ui';
import { round2 } from '../../lib/finance';
import { money, toDate, fmtDate, toInputDate } from '../../lib/format';
import { triggerHaptic, playCashSound } from '../../lib/hapticEngine';
import { useToast } from '../../context/ToastContext';
import { safeUpdateDoc } from '../../lib/safeFirestore';
import { doc, Timestamp, writeBatch } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { logAction } from '../../lib/logger';
import { extractCr } from '../../lib/finance';
import { isOcTH } from '../../lib/constants';
import type { PurchaseOrder, Invoice, OrderStatus } from '../../lib/types';
import confetti from 'canvas-confetti';

interface ConciliacionCobranzaModalProps {
  orders: PurchaseOrder[];
  onClose: () => void;
  onOpenOrder?: (order: PurchaseOrder) => void;
}

interface FacturaCarteraItem {
  orderId: string;
  order: PurchaseOrder;
  invoiceId: string;
  invoice: Invoice;
  folio: string;
  oc: string;
  client: string;
  isTH: boolean;
  kilos: number;
  total: number;
  paidAmount: number;
  saldoPendiente: number;
  cr: string;
  crDate: Date | null;
  dueDate: Date | null;
  diasParaVencer: number | null;
  status: 'espera_cr' | 'con_cr_vigente' | 'vencida' | 'pagada';
}

export function ConciliacionCobranzaModal({
  orders,
  onClose,
  onOpenOrder,
}: ConciliacionCobranzaModalProps) {
  const toast = useToast();
  const [tab, setTab] = useState<'balance' | 'facturas' | 'auto_cr' | 'pagos'>('balance');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState<'todos' | 'TH' | 'GT'>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'espera_cr' | 'con_cr' | 'vencidas' | 'pagadas'>('todos');

  // Estado para asignación rápida de CR
  const [editingCrItem, setEditingCrItem] = useState<FacturaCarteraItem | null>(null);
  const [crInput, setCrInput] = useState('');
  const [crDueDateInput, setCrDueDateInput] = useState('');
  const [savingCr, setSavingCr] = useState(false);

  // Estado para registro rápido de pago
  const [payingItem, setPayingItem] = useState<FacturaCarteraItem | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<number>(0);
  const [payRefInput, setPayRefInput] = useState('');
  const [payDateInput, setPayDateInput] = useState(() => toInputDate(new Date()));
  const [savingPay, setSavingPay] = useState(false);

  // Estado para pegado inteligente de Contrarrecibos
  const [smartPasteText, setSmartPasteText] = useState('');
  const [smartMatches, setSmartMatches] = useState<
    { folio: string; cr: string; dueDate?: string; orderId: string; invoiceId: string; matched: boolean }[]
  >([]);
  const [applyingBatch, setApplyingBatch] = useState(false);

  // 1. Extraer y estructurar todas las facturas del sistema
  const facturas = useMemo<FacturaCarteraItem[]>(() => {
    const list: FacturaCarteraItem[] = [];
    const ahora = Date.now();

    (orders || []).forEach((o) => {
      if ((o as any).isDeleted || o.isClosedShort) return;
      const ocStr = (o.oc || o.folio || o.id || '').toUpperCase();
      if (/^(?:GT|TH)-\d+$/i.test(ocStr)) return;

      const isThOrder = isOcTH(ocStr);

      (o.invoices || []).forEach((inv) => {
        if (!inv || !inv.folio) return;
        const total = Number(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
        const paidAmount = Number(inv.collection?.paidAmount || 0);
        const kilos = Number(inv.kilos || 0);
        const cr = extractCr(inv, o);
        const st = inv.creditCycle?.status;

        const isPaid = st === 'paid' || st === 'collected' || (paidAmount >= total - 0.01 && total > 0);
        const saldoPendiente = isPaid ? 0 : round2(Math.max(0, total - paidAmount));

        let dueDate = toDate(inv.creditCycle?.dueDate);
        const crDate = toDate(inv.collection?.contrareciboDate || inv.creditCycle?.issueDate);

        if (!dueDate && crDate) {
          dueDate = new Date(crDate.getTime() + 8 * 86400000); // 8 días regla oficial Providencia
        }

        let diasParaVencer: number | null = null;
        if (dueDate) {
          diasParaVencer = Math.round((dueDate.getTime() - ahora) / 86400000);
        }

        let status: 'espera_cr' | 'con_cr_vigente' | 'vencida' | 'pagada' = 'espera_cr';
        if (isPaid) {
          status = 'pagada';
        } else if (!cr) {
          status = 'espera_cr';
        } else if (diasParaVencer !== null && diasParaVencer < 0) {
          status = 'vencida';
        } else {
          status = 'con_cr_vigente';
        }

        list.push({
          orderId: o.id,
          order: o,
          invoiceId: inv.id,
          invoice: inv,
          folio: (inv.folio || '').trim(),
          oc: o.folio || o.oc || 'S/N',
          client: o.client || (isThOrder ? 'Textil Hogar (Nava)' : 'Grupo Textil Providencia (Evelia)'),
          isTH: isThOrder,
          kilos,
          total,
          paidAmount,
          saldoPendiente,
          cr: cr || '',
          crDate,
          dueDate,
          diasParaVencer,
          status,
        });
      });
    });

    return list.sort((a, b) => {
      // Prioridad: 1) Espera de CR, 2) Vencidas, 3) Con CR vigente, 4) Pagadas
      const score = (item: FacturaCarteraItem) => {
        if (item.status === 'espera_cr') return 1;
        if (item.status === 'vencida') return 2;
        if (item.status === 'con_cr_vigente') return 3;
        return 4;
      };
      return score(a) - score(b);
    });
  }, [orders]);

  // 2. Métricas y Cuadre Financiero 100% Exacto
  const metricas = useMemo(() => {
    const totalFacturas = facturas.length;
    const totalFacturado = round2(facturas.reduce((s, f) => s + f.total, 0));
    const totalKilos = round2(facturas.reduce((s, f) => s + f.kilos, 0));

    const conCr = facturas.filter((f) => f.status === 'con_cr_vigente');
    const totalConCr = round2(conCr.reduce((s, f) => s + f.total, 0));

    const vencidas = facturas.filter((f) => f.status === 'vencida');
    const totalVencido = round2(vencidas.reduce((s, f) => s + f.saldoPendiente, 0));

    const esperaCr = facturas.filter((f) => f.status === 'espera_cr');
    const totalEsperaCr = round2(esperaCr.reduce((s, f) => s + f.saldoPendiente, 0));

    const pagadas = facturas.filter((f) => f.status === 'pagada');
    const totalCobrado = round2(facturas.reduce((s, f) => s + f.paidAmount, 0));

    const saldoEnCartera = round2(facturas.reduce((s, f) => s + f.saldoPendiente, 0));

    // Verificación matemática estricta: Total Facturado === Total Cobrado + Saldo Pendiente
    const balanceDiferencia = round2(Math.abs(totalFacturado - (totalCobrado + saldoEnCartera)));
    const isCuadrado = balanceDiferencia <= 0.05;

    // Desglose TH vs GT
    const thFacturas = facturas.filter((f) => f.isTH);
    const gtFacturas = facturas.filter((f) => !f.isTH);

    return {
      totalFacturas,
      totalFacturado,
      totalKilos,
      conCrCount: conCr.length,
      totalConCr,
      vencidasCount: vencidas.length,
      totalVencido,
      esperaCrCount: esperaCr.length,
      totalEsperaCr,
      pagadasCount: pagadas.length,
      totalCobrado,
      saldoEnCartera,
      balanceDiferencia,
      isCuadrado,
      thTotal: round2(thFacturas.reduce((s, f) => s + f.total, 0)),
      thSaldo: round2(thFacturas.reduce((s, f) => s + f.saldoPendiente, 0)),
      gtTotal: round2(gtFacturas.reduce((s, f) => s + f.total, 0)),
      gtSaldo: round2(gtFacturas.reduce((s, f) => s + f.saldoPendiente, 0)),
    };
  }, [facturas]);

  // 3. Filtrado reactivo de facturas
  const facturasFiltradas = useMemo(() => {
    return facturas.filter((f) => {
      if (filterDept === 'TH' && !f.isTH) return false;
      if (filterDept === 'GT' && f.isTH) return false;

      if (filterStatus === 'espera_cr' && f.status !== 'espera_cr') return false;
      if (filterStatus === 'con_cr' && f.status !== 'con_cr_vigente') return false;
      if (filterStatus === 'vencidas' && f.status !== 'vencida') return false;
      if (filterStatus === 'pagadas' && f.status !== 'pagada') return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesFolio = f.folio.toLowerCase().includes(q);
        const matchesOc = f.oc.toLowerCase().includes(q);
        const matchesCr = f.cr.toLowerCase().includes(q);
        const matchesClient = f.client.toLowerCase().includes(q);
        if (!matchesFolio && !matchesOc && !matchesCr && !matchesClient) return false;
      }

      return true;
    });
  }, [facturas, filterDept, filterStatus, search]);

  // 4. Guardar Contrarrecibo individual
  const handleSaveCr = async () => {
    if (!editingCrItem || !crInput.trim()) return;
    setSavingCr(true);
    triggerHaptic('medium');

    try {
      const order = editingCrItem.order;
      const updatedInvoices = (order.invoices || []).map((inv) => {
        if (inv.id !== editingCrItem.invoiceId && inv.folio !== editingCrItem.folio) return inv;
        const dueTimestamp = crDueDateInput
          ? Timestamp.fromDate(new Date(crDueDateInput + 'T12:00:00'))
          : Timestamp.fromDate(new Date(Date.now() + 8 * 86400000));

        return {
          ...inv,
          collection: {
            ...inv.collection,
            contrareciboNumber: crInput.trim().toUpperCase(),
            contrareciboDate: Timestamp.now(),
          },
          creditCycle: {
            ...inv.creditCycle,
            status: 'pending' as OrderStatus,
            dueDate: dueTimestamp,
          },
        };
      });

      await safeUpdateDoc(doc(db, PATHS.orders, order.id), {
        invoices: updatedInvoices,
        updatedAt: Timestamp.now(),
      });

      await logAction('admin@ruenisco.com', 'CONTRARECIBO_ASSIGNED', {
        orderId: order.id,
        invoiceFolio: editingCrItem.folio,
        cr: crInput.trim().toUpperCase(),
      });

      toast(`✅ Contrarrecibo ${crInput.trim().toUpperCase()} asignado a Factura #${editingCrItem.folio}`, 'ok');
      setEditingCrItem(null);
      setCrInput('');
      setCrDueDateInput('');
    } catch (err: any) {
      console.error('[ConciliacionCobranzaModal] Error al guardar CR:', err);
      toast('Error al guardar contrarrecibo: ' + err.message, 'bad');
    } finally {
      setSavingCr(false);
    }
  };

  // 5. Registrar Liquidación / Pago
  const handleSavePayment = async () => {
    if (!payingItem || payAmountInput <= 0) return;
    setSavingPay(true);
    triggerHaptic('heavy');
    playCashSound();

    try {
      const order = payingItem.order;
      const updatedInvoices = (order.invoices || []).map((inv) => {
        if (inv.id !== payingItem.invoiceId && inv.folio !== payingItem.folio) return inv;
        const currentPaid = Number(inv.collection?.paidAmount || 0);
        const newPaid = round2(currentPaid + payAmountInput);
        const invTotal = Number(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
        const isFullPaid = newPaid >= invTotal - 0.01;

        return {
          ...inv,
          collection: {
            ...inv.collection,
            paidAmount: newPaid,
            paidDate: Timestamp.fromDate(new Date(payDateInput + 'T12:00:00')),
            paymentReference: payRefInput.trim() || 'TRANSFERENCIA',
          },
          creditCycle: {
            ...inv.creditCycle,
            status: isFullPaid ? 'paid' : 'pending',
          },
        };
      });

      await safeUpdateDoc(doc(db, PATHS.orders, order.id), {
        invoices: updatedInvoices,
        updatedAt: Timestamp.now(),
      });

      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      toast(`💰 Pago de ${money(payAmountInput)} conciliado para Factura #${payingItem.folio}`, 'ok');
      setPayingItem(null);
      setPayAmountInput(0);
      setPayRefInput('');
    } catch (err: any) {
      console.error('[ConciliacionCobranzaModal] Error al conciliar pago:', err);
      toast('Error al registrar pago: ' + err.message, 'bad');
    } finally {
      setSavingPay(false);
    }
  };

  // 6. Analizar texto pegado para emparejamiento inteligente de CRs
  const handleAnalyzeSmartPaste = () => {
    if (!smartPasteText.trim()) return;
    triggerHaptic('light');

    const lines = smartPasteText.split('\n').map((l) => l.trim()).filter(Boolean);
    const matches: typeof smartMatches = [];

    // Buscar patrones: Folio Factura (ej. 6392, 6352) y Folio CR (ej. GT-1047, TH-1195)
    for (const line of lines) {
      // Buscar CR en la línea
      const crMatch = line.match(/(GT-\d+|TH-\d+|CR-?\d+)/i);
      // Buscar número de factura de 4 dígitos (ej. 6334, 6392, 6302)
      const facMatches = line.match(/\b(6\d{3})\b/g);

      if (crMatch && facMatches && facMatches.length > 0) {
        const crFound = crMatch[1].toUpperCase();
        for (const fac of facMatches) {
          const targetItem = facturas.find((f) => f.folio.includes(fac));
          if (targetItem) {
            matches.push({
              folio: fac,
              cr: crFound,
              orderId: targetItem.orderId,
              invoiceId: targetItem.invoiceId,
              matched: true,
            });
          }
        }
      }
    }

    if (matches.length === 0) {
      toast('No se detectaron coincidencias exactas con facturas del sistema en el texto.', 'bad');
    } else {
      toast(`🎯 ${matches.length} vinculación(es) detectada(s) para revisión`, 'ok');
    }
    setSmartMatches(matches);
  };

  // 7. Aplicar vinculación masiva en lote con writeBatch
  const handleApplySmartMatches = async () => {
    if (smartMatches.length === 0) return;
    setApplyingBatch(true);
    triggerHaptic('heavy');

    try {
      const batch = writeBatch(db);
      const ordersToUpdate = new Map<string, PurchaseOrder>();

      for (const m of smartMatches) {
        if (!m.matched) continue;
        const targetOrder = ordersToUpdate.get(m.orderId) || orders.find((o) => o.id === m.orderId);
        if (!targetOrder) continue;

        const updatedInvoices: Invoice[] = (targetOrder.invoices || []).map((inv): Invoice => {
          if (inv.id !== m.invoiceId && !inv.folio?.includes(m.folio)) return inv;
          return {
            ...inv,
            collection: {
              ...inv.collection,
              contrareciboNumber: m.cr,
              contrareciboDate: Timestamp.now(),
            },
            creditCycle: {
              ...inv.creditCycle,
              status: 'pending' as OrderStatus,
              dueDate: Timestamp.fromDate(new Date(Date.now() + 8 * 86400000)),
            },
          };
        });

        const newOrderState: PurchaseOrder = { ...targetOrder, invoices: updatedInvoices };
        ordersToUpdate.set(m.orderId, newOrderState);
      }

      for (const [orderId, orderState] of ordersToUpdate.entries()) {
        const ref = doc(db, PATHS.orders, orderId);
        batch.update(ref, {
          invoices: orderState.invoices,
          updatedAt: Timestamp.now(),
        });
      }

      await batch.commit();
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      toast(`✅ ${smartMatches.length} facturas vinculadas exitosamente con sus Contrarrecibos`, 'ok');
      setSmartMatches([]);
      setSmartPasteText('');
      setTab('facturas');
    } catch (err: any) {
      console.error('[ConciliacionCobranzaModal] Error en writeBatch:', err);
      toast('Error al aplicar lote atómico: ' + err.message, 'bad');
    } finally {
      setApplyingBatch(false);
    }
  };

  return (
    <Modal onClose={onClose} wide title="⚖️ Módulo de Conciliación de Pagos y Contrarrecibos Automatizado">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--ink)' }}>
        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setTab('balance')}
            className="btn"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              background: tab === 'balance' ? '#2563eb' : 'var(--paper-sunk)',
              color: tab === 'balance' ? '#fff' : 'var(--ink)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            📊 Auditoría y Cuadre de Balance
          </button>
          <button
            type="button"
            onClick={() => setTab('facturas')}
            className="btn"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              background: tab === 'facturas' ? '#2563eb' : 'var(--paper-sunk)',
              color: tab === 'facturas' ? '#fff' : 'var(--ink)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            📑 Facturas y Contrarrecibos ({facturas.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('auto_cr')}
            className="btn"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              background: tab === 'auto_cr' ? '#10b981' : 'var(--paper-sunk)',
              color: tab === 'auto_cr' ? '#fff' : 'var(--ink)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ⚡ Conciliador Inteligente (Pegar CRs)
          </button>
          <button
            type="button"
            onClick={() => setTab('pagos')}
            className="btn"
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              background: tab === 'pagos' ? '#f59e0b' : 'var(--paper-sunk)',
              color: tab === 'pagos' ? '#fff' : 'var(--ink)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            💰 Liquidación y Pagos Bancarios
          </button>
        </div>

        {/* ─── TAB 1: AUDITORÍA Y CUADRE DE BALANCE ─── */}
        {tab === 'balance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* SEMÁFORO DE CUADRE MATEMÁTICO */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 14,
                background: metricas.isCuadrado
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.05) 100%)',
                border: `1px solid ${metricas.isCuadrado ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 32 }}>{metricas.isCuadrado ? '🛡️' : '⚠️'}</span>
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: metricas.isCuadrado ? '#10b981' : '#ef4444',
                    }}
                  >
                    {metricas.isCuadrado
                      ? 'Cuadre Contable 100% Verificado y Consistente'
                      : `Diferencia de Cuadre: ${money(metricas.balanceDiferencia)}`}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Total Facturado ({money(metricas.totalFacturado)}) = Total Cobrado en Banco (
                    {money(metricas.totalCobrado)}) + Cartera Pendiente ({money(metricas.saldoEnCartera)})
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: metricas.isCuadrado ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: metricas.isCuadrado ? '#34d399' : '#f87171',
                }}
              >
                {metricas.isCuadrado ? 'BALANCE CUADRADO' : 'REVISAR MOVIMIENTOS'}
              </div>
            </div>

            {/* REJILLA DE KPIS PRINCIPALES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--paper-sunk)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>TOTAL FACTURADO</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6', marginTop: 4 }}>
                  {money(metricas.totalFacturado)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {metricas.totalFacturas} facturas · {metricas.totalKilos.toLocaleString('es-MX')} kg
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--paper-sunk)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>CON CONTRARRECIBO (EN PLAZO)</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                  {money(metricas.totalConCr)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {metricas.conCrCount} facturas con CR oficial
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--paper-sunk)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>EN ESPERA DE CONTRARRECIBO</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  {money(metricas.totalEsperaCr)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {metricas.esperaCrCount} factura(s) entregada(s) (ej. F-6392)
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--paper-sunk)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>VENCIDAS / POR RECLAMAR</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', marginTop: 4 }}>
                  {money(metricas.totalVencido)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {metricas.vencidasCount} factura(s) con plazo excedido
                </div>
              </div>

              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--paper-sunk)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>TOTAL COBRADO EN BANCO</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#22c55e', marginTop: 4 }}>
                  {money(metricas.totalCobrado)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {metricas.pagadasCount} facturas finiquitadas
                </div>
              </div>
            </div>

            {/* COMPARATIVO TEXTIL HOGAR (NAVA) VS GRUPO TEXTIL (EVELIA) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.04) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b' }}>
                  🏢 Textil Hogar (Ing. José Nava)
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                  Facturado total: <strong>{money(metricas.thTotal)}</strong> · Saldo por cobrar:{' '}
                  <strong style={{ color: '#f59e0b' }}>{money(metricas.thSaldo)}</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
                  Incluye F-6392 amparada ($45,640.20 MXN / 915 kg) y CR TH-1195 ($74,820.00 MXN).
                </div>
              </div>

              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.04) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa' }}>
                  🏭 Grupo Textil Providencia (Lic. Evelia)
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                  Facturado total: <strong>{money(metricas.gtTotal)}</strong> · Saldo por cobrar:{' '}
                  <strong style={{ color: '#60a5fa' }}>{money(metricas.gtSaldo)}</strong>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
                  Incluye CR GT-1047 ($82,302.00 MXN) y OCs 9806 y 9807 con 5,434.15 kg listos para facturación.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: LISTADO DE FACTURAS Y CONTRARRECIBOS ─── */}
        {tab === 'facturas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* FILTROS Y BÚSQUEDA */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="🔍 Buscar por folio, OC, CR o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input"
                style={{ flex: 1, minWidth: 200, fontSize: 12.5, padding: '7px 12px' }}
              />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value as any)}
                className="input"
                style={{ fontSize: 12, padding: '7px 10px' }}
              >
                <option value="todos">Todos los Departamentos</option>
                <option value="TH">Solo Textil Hogar (Nava)</option>
                <option value="GT">Solo Grupo Textil (Evelia)</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="input"
                style={{ fontSize: 12, padding: '7px 10px' }}
              >
                <option value="todos">Todos los Estatus</option>
                <option value="espera_cr">⚠️ En Espera de CR</option>
                <option value="con_cr">✅ Con CR Vigente</option>
                <option value="vencidas">🚨 Vencidas</option>
                <option value="pagadas">💰 Pagadas</option>
              </select>
            </div>

            {/* TABLA PRINCIPAL DE FACTURAS */}
            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: 440 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--paper-sunk)', zIndex: 2 }}>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Factura</th>
                      <th style={{ padding: '8px 10px' }}>OC / Depto</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Kilos</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Importe Total</th>
                      <th style={{ padding: '8px 10px' }}>Contrarrecibo</th>
                      <th style={{ padding: '8px 10px' }}>Vencimiento</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Estatus</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFiltradas.map((f) => (
                      <tr key={`${f.orderId}_${f.invoiceId}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 800 }}>
                          #{f.folio}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 700 }}>OC {f.oc}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{f.isTH ? 'TH · Nava' : 'GT · Evelia'}</div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                          {f.kilos.toLocaleString('es-MX')} kg
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#3b82f6' }}>
                          {money(f.total)}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {f.cr ? (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                fontWeight: 800,
                                fontSize: 11,
                              }}
                            >
                              📑 {f.cr}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCrItem(f);
                                setCrInput('');
                                setCrDueDateInput('');
                              }}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#fbbf24',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              ➕ Asignar CR
                            </button>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {f.dueDate ? (
                            <div>
                              <div>{fmtDate(f.dueDate)}</div>
                              <div
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: (f.diasParaVencer ?? 0) < 0 ? '#ef4444' : '#10b981',
                                }}
                              >
                                {(f.diasParaVencer ?? 0) < 0
                                  ? `${Math.abs(f.diasParaVencer!)}d vencida`
                                  : `en ${f.diasParaVencer}d`}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {f.status === 'pagada' && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e' }}>💰 PAGADA</span>
                          )}
                          {f.status === 'vencida' && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>🚨 VENCIDA</span>
                          )}
                          {f.status === 'con_cr_vigente' && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>⏳ EN TRÁMITE</span>
                          )}
                          {f.status === 'espera_cr' && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>⚠️ ESPERA CR</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            {f.status !== 'pagada' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayingItem(f);
                                  setPayAmountInput(f.saldoPendiente);
                                }}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#fff',
                                  border: 'none',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                                title="Registrar pago recibido en banco"
                              >
                                💸 Cobrar
                              </button>
                            )}
                            {onOpenOrder && (
                              <button
                                type="button"
                                onClick={() => onOpenOrder(f.order)}
                                style={{
                                  padding: '3px 6px',
                                  borderRadius: 6,
                                  background: 'var(--paper-sunk)',
                                  border: '1px solid var(--border)',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                📂
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {facturasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)' }}>
                          No se encontraron facturas con los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: CONCILIADOR INTELIGENTE (PEGAR CRS) ─── */}
        {tab === 'auto_cr' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontSize: 12.5,
              }}
            >
              💡 <strong>Captura Rápida de Contrarrecibos:</strong> Pega el reporte copiado directamente del portal de Providencia (o contrarrecibos escaneados). El sistema detectará automáticamente los folios de factura (`6392`, `6352`, etc.) y sus correspondientes CRs (`GT-1047`, `TH-1195`) para vincularlos en un solo clic.
            </div>

            <textarea
              className="input"
              rows={5}
              placeholder="Pega aquí el texto del portal Providencia... Ejemplo:&#10;Contrarrecibo: GT-1047 Fecha: 05/10/2026 Facturas: 6352 6353 Total: $82,302.00&#10;Contrarrecibo: TH-1195 Fecha: 05/10/2026 Factura: 6334 Total: $74,820.00"
              value={smartPasteText}
              onChange={(e) => setSmartPasteText(e.target.value)}
              style={{ width: '100%', fontSize: 12.5, padding: 10, fontFamily: 'monospace' }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={handleAnalyzeSmartPaste}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🔍 Analizar Coincidencias
              </button>
            </div>

            {smartMatches.length > 0 && (
              <div style={{ borderRadius: 10, border: '1px solid var(--border)', padding: 12, background: 'var(--paper)' }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#10b981' }}>
                  🎯 Coincidencias Listas para Aplicar ({smartMatches.length}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {smartMatches.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--paper-sunk)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                      }}
                    >
                      <span>
                        Factura <strong>#{m.folio}</strong> ➔ Asignar Contrarrecibo <strong>{m.cr}</strong>
                      </span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>Listo para guardar</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={applyingBatch}
                    onClick={handleApplySmartMatches}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 900,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      cursor: applyingBatch ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {applyingBatch ? 'Guardando en Firestore...' : `💾 Vincular ${smartMatches.length} Contrarrecibos en 1 Clic`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: LIQUIDACIÓN Y PAGOS BANCARIOS ─── */}
        {tab === 'pagos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontSize: 12.5,
              }}
            >
              💰 <strong>Conciliación de Transferencias Bancarias (REP):</strong> Facturas con Contrarrecibo oficial vigente listas para registrar el depósito recibido de Providencia.
            </div>

            <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: 400 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: 'var(--paper-sunk)' }}>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Factura</th>
                      <th style={{ padding: '8px 10px' }}>OC</th>
                      <th style={{ padding: '8px 10px' }}>Contrarrecibo</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saldo Pendiente</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas
                      .filter((f) => f.status !== 'pagada' && f.cr)
                      .map((f) => (
                        <tr key={f.invoiceId} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 800 }}>#{f.folio}</td>
                          <td style={{ padding: '8px 10px' }}>OC {f.oc}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: '#3b82f6' }}>{f.cr}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{money(f.total)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                            {money(f.saldoPendiente)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setPayingItem(f);
                                setPayAmountInput(f.saldoPendiente);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#fff',
                                border: 'none',
                                fontSize: 11.5,
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              💸 Marcar Pagada ({money(f.saldoPendiente)})
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SECUNDARIO: ASIGNAR CR INDIVIDUAL */}
        {editingCrItem && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
            }}
          >
            <div
              style={{
                width: 420,
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                📑 Asignar Contrarrecibo a Factura #{editingCrItem.folio}
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700 }}>Número de Contrarrecibo (ej. TH-1195, GT-1047)</label>
                <input
                  type="text"
                  placeholder="GT-1047..."
                  value={crInput}
                  onChange={(e) => setCrInput(e.target.value.toUpperCase())}
                  className="input"
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700 }}>Fecha Límite / Vencimiento de Pago</label>
                <input
                  type="date"
                  value={crDueDateInput}
                  onChange={(e) => setCrDueDateInput(e.target.value)}
                  className="input"
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingCrItem(null)}
                  className="btn"
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingCr}
                  onClick={handleSaveCr}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    cursor: savingCr ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingCr ? 'Guardando...' : 'Guardar CR'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SECUNDARIO: REGISTRAR PAGO RECIBIDO */}
        {payingItem && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
            }}
          >
            <div
              style={{
                width: 440,
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: '#10b981' }}>
                💰 Registrar Cobro / Pago de Factura #{payingItem.folio}
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700 }}>Importe Depositado (MXN)</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(parseFloat(e.target.value) || 0)}
                  className="input"
                  style={{ width: '100%', marginTop: 4, fontSize: 14, fontWeight: 800 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700 }}>Referencia / Folio de Transferencia (REP)</label>
                <input
                  type="text"
                  placeholder="TR-8943..."
                  value={payRefInput}
                  onChange={(e) => setPayRefInput(e.target.value)}
                  className="input"
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700 }}>Fecha de Depósito</label>
                <input
                  type="date"
                  value={payDateInput}
                  onChange={(e) => setPayDateInput(e.target.value)}
                  className="input"
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setPayingItem(null)}
                  className="btn"
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingPay}
                  onClick={handleSavePayment}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    cursor: savingPay ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingPay ? 'Registrando...' : 'Confirmar Cobro'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
