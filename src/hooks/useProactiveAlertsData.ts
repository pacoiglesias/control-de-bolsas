import { useMemo } from 'react';
import { useOrders } from './useOrders';
import { getOrderSummary } from '../lib/finance';
import { toDate, money } from '../lib/format';

/**
 * FIX (v8.9.5): esta lista de alertas vivia calculada solo adentro de
 * NotificationsCenter.tsx (la campanita 🔔). Se saca a un hook compartido
 * para poder reusar exactamente el mismo calculo -- ni una linea distinta
 * -- tambien en el menu lateral (Layout.tsx), que ahora la usa para sonar
 * un aviso proactivo cuando aparece una alerta nueva. Es el mismo error de
 * "dos fuentes para el mismo numero" que ya rompio el Saldo con Andres en
 * v8.9.4 (ver AUDIT_NOTEBOOK.md) -- aqui se evita a proposito teniendo un
 * solo lugar que calcula las alertas.
 */
export type ProactiveAlert = {
  id: string;
  title: string;
  desc: string;
  type: 'bad' | 'warn' | 'info';
  route: string;
};

export function useProactiveAlertsData(): ProactiveAlert[] {
  const { orders } = useOrders();

  return useMemo(() => {
    const list: ProactiveAlert[] = [];

    orders.forEach((o) => {
      const summary = getOrderSummary(o);
      const oc = o.folio || o.oc || 'S/F';

      // 1. Contrarecibos vencidos
      (o.invoices || []).forEach((inv) => {
        if (inv.creditCycle.status === 'overdue') {
          list.push({
            id: `venc_${inv.id}`,
            title: `Contrarecibo Vencido - ${oc}`,
            desc: `Factura #${inv.folio} (${money(inv.financials?.invoiceTotal)}) con fecha vencida.`,
            type: 'bad',
            route: '/cobranza',
          });
        }

        // 2. Facturas sin CR emitidas hace más de 3 días
        const cr = (inv.collection?.contrareciboNumber || '').trim();
        if (!cr && inv.creditCycle.status !== 'collected') {
          const dIssue = toDate(inv.creditCycle.issueDate);
          if (dIssue) {
            const dias = Math.round((Date.now() - dIssue.getTime()) / (1000 * 60 * 60 * 24));
            if (dias >= 3) {
              list.push({
                id: `sincr_${inv.id}`,
                title: `Sin Contrarecibo (${dias} días) - ${oc}`,
                desc: `Factura #${inv.folio} esperando número de CR de Providencia.`,
                type: 'warn',
                route: '/cobranza',
              });
            }
          }
        }
      });

      // 3. Kilos entregados por Andrés pendientes de facturar
      if (summary.kilosDelivered > summary.kilosInvoiced + 0.01) {
        const porFacturar = Math.round(summary.kilosDelivered - summary.kilosInvoiced);
        list.push({
          id: `deliv_${o.id}`,
          title: `Entregas por Facturar - ${oc}`,
          desc: `${porFacturar.toLocaleString('es-MX')} kg entregados por Andrés listos para emitir CFDI.`,
          type: 'info',
          route: '/ordenes',
        });
      }
    });

    return list;
  }, [orders]);
}
