import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { money, kilos as fmtKilos } from '../../lib/format';
import { round2 } from '../../lib/finance';
import { ResponsiveMoney } from '../ui';
import { useExpensesContext } from '../../context/ExpensesContext';
import { useToast } from '../../context/ToastContext';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { generateNetProfitReportPdf, buildNetProfitData } from '../../lib/netProfitReportPdf';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';

interface ExecutiveFinancialCardProps {
  orders: PurchaseOrder[];
  config?: FinancialConfig;
  saldoCaja?: number;
}

export function ExecutiveFinancialCard({ orders, config, saldoCaja = 0 }: ExecutiveFinancialCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { expenses } = useExpensesContext();
  const { settings } = useSystemSettings();
  const toast = useToast();
  
  const provName = settings?.providerName || 'Andrés';
  const clientName = settings?.clientShortName || 'Providencia';

  // Fórmulas matemáticas oficiales del negocio
  const financials = useMemo(() => {
    let subtotalFacturado = 0;
    let totalKilosEntregados = 0;
    let totalKilosFacturados = 0;
    let facturasCobradas = 0;
    let costoAndresTotal = 0;
    let comisionContableTotal = 0;

    orders.forEach(o => {
      if (o.isClosedShort) return;

      (o.deliveries || []).forEach(d => {
        totalKilosEntregados += Number(d.kilos) || 0;
      });

      (o.invoices || []).forEach(inv => {
        const kg = Number(inv.kilos) || 0;
        totalKilosFacturados += kg;
        
        // Precio de venta histórico congelado de la factura o de la orden
        const effectiveSalePrice = inv.financials?.salePricePerKg ?? (Number(o.customSellPrice) || config?.salePricePerKg || 43);
        const invSubtotal = (inv.financials as any)?.subtotal ?? inv.financials?.saleTotal ?? round2(kg * effectiveSalePrice);
        subtotalFacturado += invSubtotal;

        // Costo de compra histórico congelado a Andrés de la factura o de la orden
        const effectiveCostPrice = inv.financials?.costPricePerKg ?? (Number(o.customCostPrice) || config?.costPricePerKg || 42);
        const invCost = inv.financials?.costTotal ?? round2(kg * effectiveCostPrice);
        costoAndresTotal += invCost;

        // Comisión contable histórica congelada
        const effectiveCommRate = inv.financials?.commissionRate ?? (Number(o.customCommissionRate) ? Number(o.customCommissionRate) / 100 : (config?.commissionRate || 0.08));
        const invComm = inv.financials?.commission ?? round2(invSubtotal * effectiveCommRate);
        comisionContableTotal += invComm;

        if (inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected') {
          facturasCobradas += (inv.financials?.invoiceTotal ?? round2(invSubtotal * 1.16));
        }
      });
    });

    const costoAndres = round2(costoAndresTotal);
    const comisionContable = round2(comisionContableTotal);
    const utilidadReal = round2(subtotalFacturado - costoAndres - comisionContable);
    const repartoPaco = round2(utilidadReal / 2);
    const repartoSocio = round2(utilidadReal / 2);

    return {
      subtotalFacturado: round2(subtotalFacturado),
      costoAndres,
      comisionContable,
      utilidadReal,
      repartoPaco,
      repartoSocio,
      totalKilosEntregados: round2(totalKilosEntregados),
      totalKilosFacturados: round2(totalKilosFacturados),
      facturasCobradas: round2(facturasCobradas),
    };
  }, [orders, config]);

  const handleDownloadPdfReport = async () => {
    try {
      setIsGeneratingPdf(true);
      const reportData = buildNetProfitData(orders, expenses, config, saldoCaja, 'Histórico Global');
      await generateNetProfitReportPdf(reportData);
      toast('Reporte de Utilidad Neta & P&L descargado en PDF.', 'ok');
    } catch (err) {
      toast(`Error al generar el PDF: ${(err as Error).message}`, 'bad');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyExecutiveSummary = () => {
    const text = `📊 REPORTE EJECUTIVO DE UTILIDAD & CORTE FINANCIERO
🏢 ${settings.companyName || 'Bolsas Elemental'} / ${clientName}
📅 Fecha: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

📦 Kilos Facturados: ${fmtKilos(financials.totalKilosFacturados)} kg
💼 Facturación Subtotal: ${money(financials.subtotalFacturado)}

📉 Deducciones Operativas:
• Maquila ${provName} ($42/kg): ${money(financials.costoAndres)}
• Comisión Contador (8%): ${money(financials.comisionContable)}

💎 UTILIDAD LÍQUIDA REAL: ${money(financials.utilidadReal)}
────────────────────────
🤝 REPARTO DE UTILIDADES (50/50):
• Paco (50%): ${money(financials.repartoPaco)}
• Socio (50%): ${money(financials.repartoSocio)}

💵 Saldo Real en Caja Chica: ${money(saldoCaja)}
────────────────────────
Generado automáticamente desde el ERP.`;

    navigator.clipboard.writeText(text);
    toast('📋 Resumen ejecutivo copiado al portapapeles.', 'ok');
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e293b 100%)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 20,
        marginBottom: 24,
        overflow: 'hidden',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        color: '#f8fafc',
      }}
    >
      {/* Barra de cabecera siempre visible */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        style={{
          padding: '16px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          background: isExpanded ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
          transition: 'background 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            🏛️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: '0.02em', color: '#fff' }}>
                Corte Financiero & Reparto 50/50
              </span>
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  textTransform: 'uppercase',
                }}
              >
                Privado
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
              Utilidad neta, comisión contable (8%), costo maquila ($42) y división a socios.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Utilidad Neta Real
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#34d399', letterSpacing: '-0.02em' }}>
              <ResponsiveMoney value={financials.utilidadReal} />
            </div>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#cbd5e1',
            }}
          >
            {isExpanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Contenido colapsable */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px 22px' }}
          >
            {/* 4 Pilares de Liquidación */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 14,
                marginBottom: 20,
              }}
            >
              {/* 1. Facturación Subtotal */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 14, borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  1. Facturación Neta
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: '4px 0' }}>
                  <ResponsiveMoney value={financials.subtotalFacturado} />
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {fmtKilos(financials.totalKilosFacturados)} kg facturados
                </div>
              </div>

              {/* 2. Costo Maquila Andrés */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 14, borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  2. Costo {provName} ($42/kg)
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171', margin: '4px 0' }}>
                  - <ResponsiveMoney value={financials.costoAndres} />
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Materia prima y extrusión
                </div>
              </div>

              {/* 3. Comisión Contador (8%) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: 14, borderRadius: 14, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  3. Comisión Contador (8%)
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24', margin: '4px 0' }}>
                  - <ResponsiveMoney value={financials.comisionContable} />
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Deducción s/Subtotal
                </div>
              </div>

              {/* 4. Utilidad Neta */}
              <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)', padding: 14, borderRadius: 14, border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase' }}>
                  4. Utilidad Líquida
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399', margin: '4px 0' }}>
                  <ResponsiveMoney value={financials.utilidadReal} />
                </div>
                <div style={{ fontSize: 11, color: '#a7f3d0' }}>
                  Dinero limpio a repartir
                </div>
              </div>
            </div>

            {/* Reparto 50/50 y Botones de Acción */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '16px 20px',
                borderRadius: 16,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    🤝 50% Paco
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: '#60a5fa', marginTop: 2 }}>
                    <ResponsiveMoney value={financials.repartoPaco} />
                  </div>
                </div>

                <div style={{ width: 1, background: 'rgba(255, 255, 255, 0.1)', height: 38 }} />

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                    🤝 50% Socio
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: '#a78bfa', marginTop: 2 }}>
                    <ResponsiveMoney value={financials.repartoSocio} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleDownloadPdfReport}
                  disabled={isGeneratingPdf}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 13,
                    padding: '10px 16px',
                    borderRadius: 12,
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: isGeneratingPdf ? 'wait' : 'pointer',
                  }}
                >
                  <span>{isGeneratingPdf ? '⏳' : '📄'}</span>
                  <span>{isGeneratingPdf ? 'Generando...' : 'Descargar Reporte P&L (PDF)'}</span>
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={handleCopyExecutiveSummary}
                  style={{
                    background: 'var(--paper-raised)',
                    color: 'var(--ink)',
                    border: '1px solid var(--line)',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '10px 16px',
                    borderRadius: 12,
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <span>📋</span>
                  <span>Copiar Resumen</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

