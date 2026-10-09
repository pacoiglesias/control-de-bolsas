import React, { useMemo, useState } from 'react';
import { Modal } from '../ui';
import { money, kilos } from '../../lib/format';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { extractCr, computeFinancials, getOrderSummary } from '../../lib/finance';
import { triggerHaptic } from '../../lib/hapticEngine';
import { sound } from '../../lib/sounds';
import { useNavigate } from 'react-router-dom';

interface PantallaDiferenciasModalProps {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onClose: () => void;
}

interface ReconciliationRow {
  orderId: string;
  folio: string;
  oc: string;
  client: string;
  department: string;
  kilosPedidos: number;
  kilosEntregados: number;
  kilosFacturados: number;
  montoFacturado: number;
  montoCobrado: number;
  diferenciaKilosBascula: number; // Kilos entregados - Kilos facturados
  diferenciaKilosMaquila: number; // Kilos pedidos - Kilos entregados
  diferenciaFinanciera: number; // Monto facturado - Monto cobrado
  estadoCuadre: 'cuadrado' | 'patio_sin_facturar' | 'factura_excede_bascula' | 'maquila_pendiente' | 'cobro_pendiente';
  detallesDiferencia: string;
  faltanteEspecifico: string;
  contrarecibos: string[];
  isReconstructedDelivery?: boolean;
  isReconstructedInvoice?: boolean;
}

export const PantallaDiferenciasModal: React.FC<PantallaDiferenciasModalProps> = ({
  orders,
  config,
  onClose,
}) => {
  const nav = useNavigate();
  const [filterDept, setFilterDept] = useState<'ALL' | 'TH' | 'GT'>('ALL');
  const [filterCuadre, setFilterCuadre] = useState<'ALL' | 'DESCUADRADAS' | 'CUADRADAS'>('ALL');
  const [search, setSearch] = useState('');

  const rows = useMemo<ReconciliationRow[]>(() => {
    return orders
      .filter((o) => !o.isDeleted && !o.isClosedShort)
      .map((o) => {
        const folio = o.folio || o.oc || `#${o.id.slice(0, 6)}`;
        const oc = o.oc || o.folio || 'S/N';
        const client = o.client || 'Grupo Textil Providencia';
        const department = o.department || 'GT';

        const kilosPedidos = Number(o.totalKilograms) || 0;
        const kilosEntregados = (o.deliveries || []).reduce((s, d) => s + (Number(d.kilos) || 0), 0);
        const kilosFacturados = (o.invoices || []).reduce((s, i) => s + (Number(i.kilos) || 0), 0);

        const montoFacturado = (o.invoices || []).reduce((s, i) => {
          const fin = computeFinancials(i.kilos, config);
          return s + (i.financials?.invoiceTotal ?? fin.invoiceTotal);
        }, 0);

        const montoCobrado = (o.invoices || []).reduce((s, i) => {
          const fin = computeFinancials(i.kilos, config);
          const totalInv = i.financials?.invoiceTotal ?? fin.invoiceTotal;
          const isCollected = i.creditCycle?.status === 'collected' || i.collection?.collectedAt;
          const isPaid = i.creditCycle?.status === 'paid' || i.collection?.paidAt;
          if (isCollected) return s + totalInv;
          if (isPaid) return s + (i.collection?.paidAmount ?? totalInv);
          return s;
        }, 0);

        const contrarecibos = Array.from(
          new Set(
            [o.collection?.contrareciboNumber, ...(o.invoices || []).map((i) => extractCr(i, o))].filter(Boolean)
          )
        ) as string[];

        const diferenciaKilosBascula = kilosEntregados - kilosFacturados;
        const diferenciaKilosMaquila = kilosPedidos - kilosEntregados;
        const diferenciaFinanciera = montoFacturado - montoCobrado;

        let estadoCuadre: ReconciliationRow['estadoCuadre'] = 'cuadrado';
        let detallesDiferencia = 'Conciliación perfecta en 4 dimensiones.';
        let faltanteEspecifico = 'Ninguno';

        if (diferenciaKilosBascula > 0.5) {
          estadoCuadre = 'patio_sin_facturar';
          detallesDiferencia = `Báscula tiene ${kilos(diferenciaKilosBascula)} recibidos físicamente sin factura CFDI.`;
          faltanteEspecifico = `Falta factura por ${kilos(diferenciaKilosBascula)} ($${money(diferenciaKilosBascula * 49.88)})`;
        } else if (diferenciaKilosBascula < -0.5) {
          estadoCuadre = 'factura_excede_bascula';
          detallesDiferencia = `Se facturaron ${kilos(Math.abs(diferenciaKilosBascula))} más de los registrados en tickets de báscula.`;
          faltanteEspecifico = `Falta comprobante/remisión de báscula por ${kilos(Math.abs(diferenciaKilosBascula))}`;
        } else if (diferenciaKilosMaquila > 0.5) {
          estadoCuadre = 'maquila_pendiente';
          detallesDiferencia = `Faltan ${kilos(diferenciaKilosMaquila)} por entregar por parte de la maquila para cumplir el pedido.`;
          faltanteEspecifico = `Maquila pendiente de fabricar y enviar ${kilos(diferenciaKilosMaquila)}`;
        } else if (diferenciaFinanciera > 1.0) {
          estadoCuadre = 'cobro_pendiente';
          detallesDiferencia = `Facturación timbrada con saldo por cobrar de ${money(diferenciaFinanciera)}.`;
          faltanteEspecifico = contrarecibos.length === 0 ? 'Falta asignación de Contrarecibo' : 'Pendiente depósito/transferencia Providencia';
        }

        const summ = getOrderSummary(o);

        return {
          orderId: o.id,
          folio,
          oc,
          client,
          department,
          kilosPedidos,
          kilosEntregados,
          kilosFacturados,
          montoFacturado,
          montoCobrado,
          diferenciaKilosBascula,
          diferenciaKilosMaquila,
          diferenciaFinanciera,
          estadoCuadre,
          detallesDiferencia,
          faltanteEspecifico,
          contrarecibos,
          isReconstructedDelivery: Boolean(summ.isReconstructedDelivery),
          isReconstructedInvoice: Boolean(summ.isReconstructedInvoice),
        };
      });
  }, [orders, config]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterDept !== 'ALL' && r.department !== filterDept) return false;
      if (filterCuadre === 'DESCUADRADAS' && r.estadoCuadre === 'cuadrado') return false;
      if (filterCuadre === 'CUADRADAS' && r.estadoCuadre !== 'cuadrado') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.folio.toLowerCase().includes(q) ||
          r.oc.toLowerCase().includes(q) ||
          r.client.toLowerCase().includes(q) ||
          r.detallesDiferencia.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, filterDept, filterCuadre, search]);

  // Resumen global de diferencias
  const globalSummary = useMemo(() => {
    let patioKg = 0;
    let maquilaPendienteKg = 0;
    let saldoPorCobrar = 0;
    let descuadradas = 0;

    for (const r of rows) {
      if (r.diferenciaKilosBascula > 0.5) patioKg += r.diferenciaKilosBascula;
      if (r.diferenciaKilosMaquila > 0.5) maquilaPendienteKg += r.diferenciaKilosMaquila;
      if (r.diferenciaFinanciera > 1.0) saldoPorCobrar += r.diferenciaFinanciera;
      if (r.estadoCuadre !== 'cuadrado') descuadradas++;
    }

    return { patioKg, maquilaPendienteKg, saldoPorCobrar, descuadradas, total: rows.length };
  }, [rows]);

  return (
    <Modal
      wide
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚖️</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
              Pantalla de Diferencias y Conciliación 4-Way Matching
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              Comparativa cruzada: Pedido ↔ Báscula ↔ Factura ↔ Cobro · Resalte de descuadres y datos faltantes
            </div>
          </div>
        </div>
      }
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Resumen Superior de Métricas de Conciliación */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: globalSummary.patioKg > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${globalSummary.patioKg > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
              📦 Patio sin Facturar (Báscula)
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {kilos(globalSummary.patioKg)}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Monto pendiente CFDI: {money(globalSummary.patioKg * 49.88)}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase' }}>
              🏭 Maquila Pendiente de Entrega
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {kilos(globalSummary.maquilaPendienteKg)}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Kilos pactados por enviar a planta
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
              💵 Saldo por Cobrar (Facturas)
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {money(globalSummary.saldoPorCobrar)}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              CFDIs amparados en cartera y revisión
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: globalSummary.descuadradas > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${globalSummary.descuadradas > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: globalSummary.descuadradas > 0 ? '#f87171' : '#34d399', textTransform: 'uppercase' }}>
              🚨 Expedientes con Descuadre
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {globalSummary.descuadradas} de {globalSummary.total}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {globalSummary.descuadradas === 0 ? '¡Todas las órdenes cuadradas!' : 'Requieren validación o factura'}
            </div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilterCuadre('ALL')}
              className={`btn ${filterCuadre === 'ALL' ? 'btn-primary' : ''}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              Todas ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCuadre('DESCUADRADAS')}
              className={`btn ${filterCuadre === 'DESCUADRADAS' ? 'btn-primary' : ''}`}
              style={{ fontSize: 12, padding: '6px 12px', background: filterCuadre === 'DESCUADRADAS' ? '#ef4444' : undefined }}
            >
              ⚠️ Con Descuadre ({globalSummary.descuadradas})
            </button>
            <button
              type="button"
              onClick={() => setFilterCuadre('CUADRADAS')}
              className={`btn ${filterCuadre === 'CUADRADAS' ? 'btn-primary' : ''}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              ✅ Cuadradas ({rows.length - globalSummary.descuadradas})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value as any)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: 12,
              }}
            >
              <option value="ALL">🏢 Todas las Plantas</option>
              <option value="TH">TH (José Nava · Almacén 1)</option>
              <option value="GT">GT (Lic. Evelia · Almacén P4)</option>
            </select>

            <input
              type="text"
              placeholder="Buscar por OC, folio o detalle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: 12,
                minWidth: 200,
              }}
            />
          </div>
        </div>

        {/* Tabla Comparativa de Conciliación 4-Way */}
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '10px 12px', color: '#94a3b8' }}>Expediente / OC</th>
                <th style={{ padding: '10px 12px', color: '#94a3b8' }}>🎯 Pedido Meta</th>
                <th style={{ padding: '10px 12px', color: '#94a3b8' }}>⚖️ Báscula (Planta)</th>
                <th style={{ padding: '10px 12px', color: '#94a3b8' }}>🧾 Facturado (CFDI)</th>
                <th style={{ padding: '10px 12px', color: '#94a3b8' }}>💵 Cobrado (CR/Pago)</th>
                <th style={{ padding: '10px 12px', color: '#94a3b8' }}>🚨 Descuadre & Faltante</th>
                <th style={{ padding: '10px 12px', color: '#94a3b8', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const isCuadrado = r.estadoCuadre === 'cuadrado';
                return (
                  <tr
                    key={r.orderId}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      background: isCuadrado ? 'transparent' : 'rgba(239, 68, 68, 0.03)',
                    }}
                  >
                    {/* Expediente */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 800, color: '#f8fafc' }}>{r.folio}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        {r.department} · {r.client}
                      </div>
                      {r.contrarecibos.length > 0 && (
                        <div style={{ fontSize: 10.5, color: '#38bdf8', marginTop: 2 }}>
                          CR: {r.contrarecibos.join(', ')}
                        </div>
                      )}
                    </td>

                    {/* Pedido */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{kilos(r.kilosPedidos)}</div>
                    </td>

                    {/* Báscula */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: r.kilosEntregados > 0 ? '#34d399' : '#64748b' }}>
                        {kilos(r.kilosEntregados)}
                      </div>
                      {r.isReconstructedDelivery && (
                        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, fontWeight: 700 }}>
                          ⚠️ Báscula Inferida
                        </div>
                      )}
                    </td>

                    {/* Facturado */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: r.kilosFacturados > 0 ? '#60a5fa' : '#64748b' }}>
                        {kilos(r.kilosFacturados)}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{money(r.montoFacturado)}</div>
                      {r.isReconstructedInvoice && (
                        <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2, fontWeight: 700 }}>
                          ⚠️ Factura Reconstruida
                        </div>
                      )}
                    </td>

                    {/* Cobrado */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700, color: r.montoCobrado > 0 ? '#10b981' : '#64748b' }}>
                        {money(r.montoCobrado)}
                      </div>
                    </td>

                    {/* Descuadre y Faltante */}
                    <td style={{ padding: '10px 12px', maxWidth: 280 }}>
                      <div
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          marginBottom: 4,
                          background: isCuadrado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isCuadrado ? '#34d399' : '#f87171',
                        }}
                      >
                        {isCuadrado ? '🟢 Cuadrado 100%' : '🔴 Descuadre Detectado'}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.3 }}>
                        {r.detallesDiferencia}
                      </div>
                      {!isCuadrado && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>
                          👉 {r.faltanteEspecifico}
                        </div>
                      )}
                    </td>

                    {/* Acción */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          sound.playPop();
                          onClose();
                          nav(`/ordenes?abrir=${r.orderId}`);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#f8fafc',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        📂 Ver Expediente
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};
