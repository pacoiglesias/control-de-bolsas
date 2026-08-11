import { useMemo, useState } from 'react';
import { Card } from '../ui';
import { money, fmtDate, toDate } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';
import { useConfig } from '../../hooks/useConfig';
import { InvoiceDrawer } from '../Cobranza/InvoiceDrawer';

/**
 * Panel pedido por el usuario ("el sistema podria ser mas proactivo"): de
 * las 4 etapas de su flujo real (OC -> entregas -> factura -> contrarecibo
 * -> deposito -> comision -> caja), 3 ya estaban cubiertas en el Dashboard
 * (pendiente de facturar, vencimiento de contrarecibo, por recibir del
 * contador). La que faltaba por completo: una factura YA emitida, pero
 * TODAVIA sin numero de contrarecibo capturado -- hoy esa espera es
 * invisible, no aparece en ninguna alerta ni tabla (ContrarecibosTable
 * explicitamente la excluye con "if (!cr) continue" porque para esa tabla
 * "sin CR" significa "factura en revision", no "contrarecibo"). Este panel
 * es el espejo exacto de esa tabla: mismo filtro de status, condicion de
 * CR invertida.
 */
export function FacturasSinCRPanel({ orders }: { orders: PurchaseOrder[] }) {
  const { config: dynamicConfig } = useConfig();
  const [drawerTarget, setDrawerTarget] = useState<{ o: PurchaseOrder; inv: any } | null>(null);

  const filas = useMemo(() => {
    const ahora = Date.now();
    const out: {
      order: PurchaseOrder;
      invoice: any;
      folio: string;
      cliente: string;
      monto: number;
      emision: Date | null;
      diasEsperando: number | null;
    }[] = [];

    for (const o of orders) {
      for (const inv of o.invoices ?? []) {
        if (inv.creditCycle?.status !== 'pending' && inv.creditCycle?.status !== 'overdue') continue;
        const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
        if (cr) continue; // Ya tiene CR -- esa espera ya se ve en Contrarecibos.

        const emision = toDate(inv.creditCycle?.issueDate);
        const dias = emision ? Math.round((ahora - emision.getTime()) / (24 * 3600 * 1000)) : null;
        out.push({
          order: o,
          invoice: inv,
          folio: inv.folio || o.folio || '(sin folio)',
          cliente: o.client || '—',
          monto: inv.financials?.invoiceTotal ?? 0,
          emision,
          diasEsperando: dias,
        });
      }
    }
    // Las que llevan mas tiempo esperando arriba -- son las que mas urge seguir.
    out.sort((a, b) => (b.diasEsperando ?? 0) - (a.diasEsperando ?? 0));
    return out;
  }, [orders]);

  if (filas.length === 0) return null;

  return (
    <Card title="🧾 Facturadas, sin contrarecibo capturado">
      <p className="hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Ya se emitió la factura. Falta anotar el número de contrarecibo en cuanto Providencia lo entregue —
        mientras tanto, este pedido no aparece en ninguna otra alerta del sistema.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filas.map((f, i) => {
          const dias = f.diasEsperando ?? 0;
          const urgente = dias > 7;
          return (
            <div key={i} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 'var(--radius)', borderLeft: `6px solid ${urgente ? 'var(--warn)' : 'var(--line)'}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge" style={{ background: 'var(--paper-sunk)', color: 'var(--ink)', fontSize: 12 }}>Folio {f.folio}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{f.cliente}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: urgente ? 'var(--warn)' : 'var(--ink-soft)' }}>
                    {f.diasEsperando !== null ? `⏳ Esperando CR desde hace ${f.diasEsperando} día(s)` : '⏳ Esperando contrarecibo'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Emitida: {f.emision ? fmtDate(f.emision) : '—'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: 700 }}>Monto Facturado</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>{money(f.monto)}</div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '10px 16px', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
                  onClick={() => setDrawerTarget({ o: f.order, inv: f.invoice })}
                >
                  Capturar Contrarecibo
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {drawerTarget && (
        <InvoiceDrawer
          invoice={drawerTarget.inv}
          order={drawerTarget.o}
          dynamicConfig={dynamicConfig}
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </Card>
  );
}
