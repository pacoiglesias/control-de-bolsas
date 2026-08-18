import { useMemo, useState } from 'react';
import { Card, Empty } from '../ui';
import { money, fmtDate, toDate } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import type { PurchaseOrder } from '../../lib/types';
import { useConfig } from '../../hooks/useConfig';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { InvoiceDrawer } from '../Cobranza/InvoiceDrawer';
import { QuickPeekDrawer } from './QuickPeekDrawer';
import { KebabMenu, type KebabMenuItem } from '../ui/KebabMenu';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { logAction } from '../../lib/logger';
import { playCashSound, triggerHaptic, playSoftClick } from '../../lib/hapticEngine';
import { generateCollectionNotice, generateInstitutionalEmailDraft, openInstitutionalEmail, copyToClipboard } from '../../lib/whatsappReminder';

interface ContrarecibosTableProps {
  orders: PurchaseOrder[];
  onOpenOrder?: (order: PurchaseOrder) => void;
}

export function ContrarecibosTable({ orders, onOpenOrder }: ContrarecibosTableProps) {
  const { user } = useAuth();
  const toast = useToast();
  const { config: dynamicConfig } = useConfig();
  const { settings } = useSystemSettings();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<{o: PurchaseOrder, inv: any} | null>(null);
  const [peekOrder, setPeekOrder] = useState<PurchaseOrder | null>(null);

  const filas = useMemo(() => {
    const ahora = Date.now();
    const out: {
      order: PurchaseOrder;
      invoice: any;
      orderId: string;
      invoiceId: string;
      folio: string;
      contrarecibo: string;
      cliente: string;
      monto: number;
      vencimiento: Date | null;
      diasParaVencer: number | null;
      status: string;
    }[] = [];

    for (const o of orders) {
      if (o.isClosedShort) continue;
      for (const inv of o.invoices ?? []) {
        const cr = extractCr(inv, o);
        if (!cr) continue; // Sin CR todavía, no es "contrarecibo" — es "factura en revisión".
        if (inv.creditCycle?.status !== 'pending' && inv.creditCycle?.status !== 'overdue') continue;

        let venc = toDate(inv.creditCycle?.dueDate);
        if (!venc) {
          const issueDateObj = toDate(inv.creditCycle?.issueDate || inv.collection?.contrareciboDate || o.processedAt);
          if (issueDateObj) {
            venc = new Date(issueDateObj.getTime() + 8 * 86400000);
          }
        }
        const dias = venc ? Math.round((venc.getTime() - ahora) / (24 * 3600 * 1000)) : null;
        out.push({
          order: o,
          invoice: inv,
          orderId: o.id,
          invoiceId: inv.id,
          folio: inv.folio || o.folio || '(sin folio)',
          contrarecibo: cr,
          cliente: o.client || '—',
          monto: inv.financials?.invoiceTotal ?? 0,
          vencimiento: venc,
          diasParaVencer: dias,
          status: inv.creditCycle?.status || 'pending',
        });
      }
    }
    // Vencidos primero (más días de atraso arriba), luego los próximos a vencer.
    out.sort((a, b) => (a.diasParaVencer ?? 999) - (b.diasParaVencer ?? 999));
    return out;
  }, [orders]);

  // Accion rapida pedida por el usuario: marcar un contrarecibo como
  // pagado por el cliente directo desde esta tabla, sin tener que abrir
  // el expediente completo solo para eso. Reutiliza exactamente la misma
  // logica ya probada en TabFacturas.tsx (Cobrada por Cliente). Una vez
  // marcada, la factura sale de esta tabla sola (el filtro de arriba solo
  // incluye pending/overdue) y aparece en "Con el Contador" del tablero
  // de Cobranza -- ahi ya existe el siguiente paso ("Recibida del
  // Contador -> CAJA"), no hace falta duplicarlo aqui tambien.
  async function marcarPagado(orderId: string, invoiceId: string, monto: number) {
    setBusyId(invoiceId);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');
        const data: any = snap.data();
        const invoices = (data.invoices || []).map((i: any) =>
          i.id === invoiceId
            ? { ...i, creditCycle: { ...i.creditCycle, status: 'paid' }, collection: { ...i.collection, paidAmount: monto, paidAt: Timestamp.now() } }
            : i
        );
        tx.update(ref, { invoices });
      });
      playCashSound();
      logAction(user?.email, 'Factura Marcada Pagada (Tabla Contrarecibos)', { orderId, invoiceId });
      toast('✅ Marcada como pagada por el cliente. Pendiente de recibir del contador.', 'ok');
    } catch (e) {
      toast(`No se pudo marcar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusyId(null);
    }
  }

  const getKebabItems = (f: typeof filas[0]): KebabMenuItem[] => [
    {
      icon: '🔍',
      label: 'Vista Rápida (Quick Peek)',
      sublabel: 'Desglose de kilos y estado',
      onClick: () => {
        playSoftClick();
        setPeekOrder(f.order);
      },
    },
    {
      icon: '👁️',
      label: 'Abrir Expediente',
      sublabel: `OC #${f.folio}`,
      onClick: () => {
        playSoftClick();
        if (onOpenOrder) onOpenOrder(f.order);
        else setDrawerTarget({ o: f.order, inv: f.invoice });
      },
    },
    {
      icon: '📝',
      label: 'Editar Cobranza (Drawer)',
      sublabel: 'Ajustar fechas y montos',
      onClick: () => {
        playSoftClick();
        setDrawerTarget({ o: f.order, inv: f.invoice });
      },
    },
    {
      icon: '💰',
      label: 'Marcar Pagado (1 Toque)',
      sublabel: 'Mover a Con el Contador',
      tone: 'warn',
      onClick: () => void marcarPagado(f.orderId, f.invoiceId, f.monto),
    },
    {
      icon: '✉️',
      label: 'Correo Institucional',
      sublabel: 'Abrir borrador oficial',
      dividerBefore: true,
      tone: 'primary',
      onClick: () => {
        playSoftClick();
        const draft = generateInstitutionalEmailDraft({
          folioFactura: f.folio,
          contrarecibo: f.contrarecibo,
          cliente: f.cliente,
          monto: f.monto,
          fechaVencimiento: f.vencimiento,
          managerTH: settings?.managerTH,
          managerGT: settings?.managerGT,
          deptNameTH: settings?.deptNameTH,
          deptNameGT: settings?.deptNameGT,
        });
        openInstitutionalEmail(draft);
      },
    },
    {
      icon: '💬',
      label: 'WhatsApp a Cobranza',
      sublabel: 'Copiar aviso formal',
      tone: 'success',
      onClick: async () => {
        playSoftClick();
        const msg = generateCollectionNotice({
          folioFactura: f.folio,
          contrarecibo: f.contrarecibo,
          cliente: f.cliente,
          monto: f.monto,
          fechaVencimiento: f.vencimiento,
          managerTH: settings?.managerTH,
          managerGT: settings?.managerGT,
          deptNameTH: settings?.deptNameTH,
          deptNameGT: settings?.deptNameGT,
        });
        await copyToClipboard(msg);
        triggerHaptic('success');
        toast('📋 Mensaje para WhatsApp copiado al portapapeles.', 'ok');
      },
    },
  ];

  const vigentes = filas.filter((f) => (f.diasParaVencer ?? 0) >= 0);
  const vencidos = filas.filter((f) => (f.diasParaVencer ?? 0) < 0);

  return (
    <Card title={`📋 Contrarecibos — Qué vence y cuándo (${filas.length})`}>
      {filas.length === 0 ? (
        <Empty>No hay contrarecibos activos por cobrar.</Empty>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filas.map((f, i) => {
              const vencido = (f.diasParaVencer ?? 0) < 0;
              const proximo = !vencido && (f.diasParaVencer ?? 99) <= 7;
              return (
                <div key={i} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 'var(--radius)', borderLeft: `6px solid ${vencido ? 'var(--bad)' : proximo ? 'var(--warn)' : 'var(--ok)'}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>CR: {f.contrarecibo}</span>
                      <span className="badge" style={{ background: 'var(--paper-sunk)', color: 'var(--ink)', fontSize: 12 }}>Folio {f.folio}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{f.cliente}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: vencido ? 'var(--bad)' : proximo ? 'var(--warn)' : 'var(--ok)' }}>
                        {vencido ? `⚠️ Vencido hace ${Math.abs(f.diasParaVencer ?? 0)} día(s)` : proximo ? `⏳ Vence en ${f.diasParaVencer} día(s)` : `✅ Vigente (${f.diasParaVencer} días)`}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Vencimiento: {f.vencimiento ? fmtDate(f.vencimiento) : '—'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: 700 }}>Monto a Cobrar</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{money(f.monto)}</div>
                    </div>
                    <button
                      className="btn"
                      style={{ background: 'var(--paper-raised)', color: 'var(--ink)', borderColor: 'var(--line-soft)', padding: '10px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                      onClick={() => {
                        playSoftClick();
                        setDrawerTarget({ o: f.order, inv: f.invoice });
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="btn"
                      style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', padding: '10px 14px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                      disabled={busyId === f.invoiceId}
                      onClick={() => void marcarPagado(f.orderId, f.invoiceId, f.monto)}
                    >
                      {busyId === f.invoiceId ? <span className="spinner" style={{ marginRight: 6 }}></span> : '💰 '}
                      Marcar Pagado
                    </button>
                    <KebabMenu
                      items={getKebabItems(f)}
                      triggerSize="md"
                      title="Acciones para este Contrarecibo"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 24, fontSize: 14, background: 'var(--glass-bg)', padding: '12px 20px', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)' }}>
              <span>🟢 Vigentes: <strong>{money(vigentes.reduce((s, f) => s + f.monto, 0))}</strong> ({vigentes.length})</span>
              <span>🔴 Vencidos: <strong>{money(vencidos.reduce((s, f) => s + f.monto, 0))}</strong> ({vencidos.length})</span>
          </div>
        </>
      )}

      {drawerTarget && (
        <InvoiceDrawer
          invoice={drawerTarget.inv}
          order={drawerTarget.o}
          dynamicConfig={dynamicConfig}
          onClose={() => setDrawerTarget(null)}
        />
      )}

      {peekOrder && (
        <QuickPeekDrawer
          order={peekOrder}
          onClose={() => setPeekOrder(null)}
          onOpenFullOrder={(id) => {
            const found = orders.find((x) => x.id === id);
            if (found && onOpenOrder) onOpenOrder(found);
          }}
          onPayCr={(invoiceId) => {
            const target = filas.find((x) => x.invoiceId === invoiceId);
            if (target) marcarPagado(target.orderId, target.invoiceId, target.monto);
          }}
        />
      )}
    </Card>
  );
}
