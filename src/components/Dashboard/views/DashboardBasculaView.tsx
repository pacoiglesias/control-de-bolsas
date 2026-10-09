import React, { useMemo, useState } from 'react';
import type { PurchaseOrder } from '../../../lib/types';
import { kilos, fmtDate, toDate } from '../../../lib/format';
import { inferDepartment } from '../../../lib/finance';
import { FinancialHelpTooltip } from '../../ui/FinancialHelpTooltip';
import type { NavigateFunction } from 'react-router-dom';

interface DashboardBasculaViewProps {
  orders: PurchaseOrder[];
  nav: NavigateFunction;
  onOpenQuickDelivery: (orderId?: string) => void;
  onOpenUniversalUpload: () => void;
}

interface DeliveryRow {
  deliveryId: string;
  orderId: string;
  orderFolio: string;
  client: string;
  dept: 'TH' | 'GT' | 'OTRO';
  docFolio: string;
  kilos: number;
  date: Date | null;
  driver?: string;
  invoiced: boolean;
  notes?: string;
}

export const DashboardBasculaView: React.FC<DashboardBasculaViewProps> = ({
  orders,
  nav,
  onOpenQuickDelivery,
  onOpenUniversalUpload,
}) => {
  const [filterDept, setFilterDept] = useState<'ALL' | 'GT' | 'TH'>('ALL');
  const [filterInvoiced, setFilterInvoiced] = useState<'ALL' | 'PENDING' | 'INVOICED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Extraer todas las entregas de báscula
  const allDeliveries = useMemo<DeliveryRow[]>(() => {
    const rows: DeliveryRow[] = [];
    (orders || []).forEach((o) => {
      if ((o as any).isDeleted) return;
      const dept = inferDepartment(o) || 'OTRO';
      (o.deliveries || []).forEach((d) => {
        rows.push({
          deliveryId: d.id,
          orderId: o.id,
          orderFolio: o.folio || o.oc || 'S/OC',
          client: o.client || 'Providencia',
          dept,
          docFolio: d.docFolio || 'S/N',
          kilos: Number(d.kilos || 0),
          date: toDate(d.date),
          driver: d.driver,
          invoiced: Boolean(d.invoiced),
          notes: d.notes,
        });
      });
    });

    // Ordenar de más reciente a más antigua
    return rows.sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return tb - ta;
    });
  }, [orders]);

  // 2. Kilos pedidos vs entregados por planta
  const plantStats = useMemo(() => {
    let gtPedidos = 0, gtEntregados = 0;
    let thPedidos = 0, thEntregados = 0;
    let totalRemisionesPendientesFacturar = 0;
    let kilosPendientesFacturar = 0;

    (orders || []).forEach((o) => {
      if ((o as any).isDeleted) return;
      const dept = inferDepartment(o);
      const pKg = Number(o.totalKilograms || 0);
      const dKg = (o.deliveries || []).reduce((acc, d) => acc + (Number(d.kilos) || 0), 0);

      if (dept === 'GT') {
        gtPedidos += pKg;
        gtEntregados += dKg;
      } else if (dept === 'TH') {
        thPedidos += pKg;
        thEntregados += dKg;
      }

      (o.deliveries || []).forEach((d) => {
        if (!d.invoiced) {
          totalRemisionesPendientesFacturar++;
          kilosPendientesFacturar += Number(d.kilos || 0);
        }
      });
    });

    return {
      gtPedidos,
      gtEntregados,
      gtFaltantes: Math.max(0, gtPedidos - gtEntregados),
      thPedidos,
      thEntregados,
      thFaltantes: Math.max(0, thPedidos - thEntregados),
      totalRemisionesPendientesFacturar,
      kilosPendientesFacturar,
    };
  }, [orders]);

  // 3. Filtrar entregas según controles
  const filteredDeliveries = useMemo(() => {
    return allDeliveries.filter((d) => {
      if (filterDept !== 'ALL' && d.dept !== filterDept) return false;
      if (filterInvoiced === 'PENDING' && d.invoiced) return false;
      if (filterInvoiced === 'INVOICED' && !d.invoiced) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchFolio = d.docFolio.toLowerCase().includes(q);
        const matchOc = d.orderFolio.toLowerCase().includes(q);
        const matchDriver = (d.driver || '').toLowerCase().includes(q);
        const matchClient = d.client.toLowerCase().includes(q);
        return matchFolio || matchOc || matchDriver || matchClient;
      }
      return true;
    });
  }, [allDeliveries, filterDept, filterInvoiced, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Header con Resumen de Báscula */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚖️</span>
            <span>Estación de Báscula & Logística en Patio</span>
            <span style={{ fontSize: 11, background: '#ea580c', color: '#fff', padding: '2px 8px', borderRadius: 99, fontWeight: 800 }}>
              PUESTO BÁSCULA
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 13 }}>
            Recepción de material, boletas de pesaje, control de remisiones selladas y kilos faltantes a Providencia.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenQuickDelivery()}
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 13,
              padding: '9px 16px',
              borderRadius: 12,
              border: 'none',
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚖️</span>
            <span>Capturar Remisión / Báscula</span>
          </button>

          <button
            type="button"
            className="btn"
            onClick={onOpenUniversalUpload}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line-soft)',
              color: 'var(--ink)',
              fontWeight: 700,
              fontSize: 13,
              padding: '9px 14px',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📄</span>
            <span>Subir Ticket Escaneado</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Pilares de Báscula */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {/* Pilar GT */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 16, padding: '16px 18px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>
              Planta GT · Evelia Castillo (P4)
            </span>
            <span style={{ fontSize: 12 }}>🏭</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
            {kilos(plantStats.gtEntregados)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            de {kilos(plantStats.gtPedidos)} pedidos · <strong style={{ color: plantStats.gtFaltantes > 0 ? '#ea580c' : '#10b981' }}>Faltan: {kilos(plantStats.gtFaltantes)}</strong>
          </div>
        </div>

        {/* Pilar TH */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 16, padding: '16px 18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
              Planta TH · José Nava (Alm 1)
            </span>
            <span style={{ fontSize: 12 }}>🏢</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
            {kilos(plantStats.thEntregados)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            de {kilos(plantStats.thPedidos)} pedidos · <strong style={{ color: plantStats.thFaltantes > 0 ? '#ea580c' : '#10b981' }}>Faltan: {kilos(plantStats.thFaltantes)}</strong>
          </div>
        </div>

        {/* Remisiones en patio pendientes de facturar */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 16, padding: '16px 18px', borderLeft: '4px solid #f97316' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f97316', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
              En Patio Pendiente Facturar <FinancialHelpTooltip concept="kilos_bascula" />
            </span>
            <span style={{ fontSize: 12 }}>📦</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: plantStats.kilosPendientesFacturar > 0 ? '#ea580c' : 'var(--ink)' }}>
            {kilos(plantStats.kilosPendientesFacturar)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            {plantStats.totalRemisionesPendientesFacturar} remisión(es) entregada(s) sin timbrar ante el SAT
          </div>
        </div>
      </div>

      {/* 3. Barra de Búsqueda y Filtros */}
      <div style={{
        background: 'var(--paper)',
        border: '1px solid var(--line-soft)',
        borderRadius: 14,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
          <span style={{ fontSize: 16, color: 'var(--ink-soft)' }}>🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Buscar por remisión, OC, chofer o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--paper-sunk)',
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filtro Planta */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--paper-sunk)', padding: 3, borderRadius: 8 }}>
            {(['ALL', 'GT', 'TH'] as const).map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setFilterDept(dept)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filterDept === dept ? 'var(--accent)' : 'transparent',
                  color: filterDept === dept ? '#fff' : 'var(--ink-soft)',
                }}
              >
                {dept === 'ALL' ? 'Todas' : dept}
              </button>
            ))}
          </div>

          {/* Filtro Facturación */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--paper-sunk)', padding: 3, borderRadius: 8 }}>
            <button
              type="button"
              onClick={() => setFilterInvoiced('ALL')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: filterInvoiced === 'ALL' ? 'var(--ink)' : 'transparent',
                color: filterInvoiced === 'ALL' ? 'var(--paper)' : 'var(--ink-soft)',
              }}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilterInvoiced('PENDING')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: filterInvoiced === 'PENDING' ? '#ea580c' : 'transparent',
                color: filterInvoiced === 'PENDING' ? '#fff' : 'var(--ink-soft)',
              }}
            >
              Por Facturar ({plantStats.totalRemisionesPendientesFacturar})
            </button>
            <button
              type="button"
              onClick={() => setFilterInvoiced('INVOICED')}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                background: filterInvoiced === 'INVOICED' ? '#10b981' : 'transparent',
                color: filterInvoiced === 'INVOICED' ? '#fff' : 'var(--ink-soft)',
              }}
            >
              Facturadas
            </button>
          </div>
        </div>
      </div>

      {/* 4. Tabla de Entregas */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--paper-sunk)', borderBottom: '1px solid var(--line-soft)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Fecha</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Remisión / Ticket</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>OC & Planta</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>Kilos Báscula</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Chofer / Nota</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>Estatus SAT</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-soft)' }}>
                    No se encontraron remisiones de báscula con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={`${d.orderId}-${d.deliveryId}`} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>
                      {fmtDate(d.date)}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, fontFamily: 'monospace' }}>
                      <span style={{ color: '#ea580c' }}>#{d.docFolio}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--ink)' }}>OC {d.orderFolio}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                        <span style={{ fontWeight: 700, color: d.dept === 'GT' ? '#3b82f6' : '#10b981' }}>{d.dept}</span> · {d.client}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, fontFamily: 'monospace', color: 'var(--ink)' }}>
                      {kilos(d.kilos)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ink-soft)', fontSize: 12 }}>
                      <div>{d.driver ? `🚚 Chofer: ${d.driver}` : '—'}</div>
                      {d.notes && <div style={{ fontSize: 11, fontStyle: 'italic' }}>{d.notes}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {d.invoiced ? (
                        <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #10b981', padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                          ✅ Facturada
                        </span>
                      ) : (
                        <span style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #f97316', padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                          ⚠️ Por Facturar
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => nav(`/ordenes?abrir=${d.orderId}&tab=entregas`)}
                        style={{
                          background: 'var(--paper-sunk)',
                          border: '1px solid var(--line)',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: 'var(--ink)',
                        }}
                      >
                        Abrir Expediente ➔
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
