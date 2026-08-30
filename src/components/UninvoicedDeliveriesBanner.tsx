import { useMemo } from 'react';
import { money, kilos as fmtKilos } from '../lib/format';
import { getOrderSummary, inferDepartment } from '../lib/finance';
import type { PurchaseOrder } from '../lib/types';
import { useConfig } from '../hooks/useConfig';
import { DEFAULT_CONFIG } from '../lib/types';

/**
 * 📢 Banner de Acción Urgente: Kilos Entregados en Patio Listos para Facturar al SAT
 * Muestra el desglose exacto por departamento (Textil Hogar vs Grupo Textil), los kilos
 * recibidos en báscula pendientes de timbrado fiscal y su valor comercial con IVA.
 */
export function UninvoicedDeliveriesBanner({ orders }: { orders: PurchaseOrder[] }) {
  const { config } = useConfig();
  const salePrice = config?.salePricePerKg || DEFAULT_CONFIG.salePricePerKg || 43;
  const ivaRate = config?.ivaRate || DEFAULT_CONFIG.ivaRate || 0.16;

  const patioList = useMemo(() => {
    const list: {
      order: PurchaseOrder;
      id: string;
      oc: string;
      folio: string;
      dept: 'TH' | 'GT' | 'PROV';
      responsable: string;
      patioKg: number;
      amountWithIva: number;
    }[] = [];

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted || o.isClosedShort) return;
      const s = getOrderSummary(o);
      const readyKg = s.kilosDelivered - s.kilosInvoiced;

      if (readyKg > 0.01) {
        const dept = inferDepartment(o) || (o.department?.toUpperCase().includes('TH') ? 'TH' : 'GT');
        const amount = readyKg * salePrice * (1 + ivaRate);
        list.push({
          order: o,
          id: o.id,
          oc: o.oc || o.folio || 'S/N',
          folio: o.folio || '(sin folio)',
          dept: dept as any,
          responsable: dept === 'TH' ? 'Nava (Textil Hogar)' : 'Evelia (Grupo Textil / P4)',
          patioKg: readyKg,
          amountWithIva: amount,
        });
      }
    });

    return list;
  }, [orders, salePrice, ivaRate]);

  if (patioList.length === 0) return null;

  const totalPatioKg = patioList.reduce((acc, p) => acc + p.patioKg, 0);
  const totalAmountWithIva = patioList.reduce((acc, p) => acc + p.amountWithIva, 0);

  const handleOpenFacturacion = (orderId?: string) => {
    if (orderId) {
      window.dispatchEvent(new CustomEvent('open-fast-invoice', { detail: { orderId } }));
    } else {
      window.dispatchEvent(new CustomEvent('open-fast-invoice'));
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.22) 100%)',
        border: '1.5px solid #f59e0b',
        borderRadius: 14,
        padding: '16px 20px',
        margin: '0 0 18px 0',
        boxShadow: '0 8px 24px -6px rgba(245, 158, 11, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Cabecera del aviso */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: '#f59e0b',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
            }}
          >
            🧾
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15, color: '#b45309' }}>
                ¡TIENES {fmtKilos(totalPatioKg)} ENTREGADOS EN PATIO LISTOS PARA FACTURAR A PROVIDENCIA (SAT)!
              </strong>
              <span
                style={{
                  background: '#d97706',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                {money(totalAmountWithIva)} con IVA
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: 12.5, color: '#92400e', lineHeight: 1.4 }}>
              Material amparado en báscula por Providencia. Se factura a <strong>Grupo Textil Providencia SA de CV</strong> a <strong>$43.00/kg + 16% IVA</strong> ($49.88/kg).
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => handleOpenFacturacion()}
          style={{
            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
            borderColor: '#d97706',
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            padding: '8px 18px',
            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>⚡</span>
          <span>Facturar a Providencia</span>
        </button>
      </div>

      {/* Tarjetas de Desglose por Departamento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        {patioList.map((item) => {
          const subtotal = item.patioKg * salePrice;
          return (
            <div
              key={item.id}
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1.5px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#78350f' }}>
                  {item.dept === 'TH' ? '🏛️ TEXTIL HOGAR (TH)' : '🏭 GRUPO TEXTIL (GT)'} · OC {item.oc}
                </div>
                <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 2 }}>
                  Contacto: <strong>{item.responsable}</strong> · Subtotal: <strong>{money(subtotal)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 900, color: '#b45309' }}>
                    {fmtKilos(item.patioKg)}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: '#78350f' }}>
                    {money(item.amountWithIva)} con IVA
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenFacturacion(item.order.id)}
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #d97706',
                    color: '#92400e',
                    fontWeight: 800,
                    fontSize: 11.5,
                    padding: '6px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Facturar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
