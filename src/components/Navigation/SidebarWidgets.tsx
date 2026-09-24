import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { usePurchases } from '../../hooks/usePurchases';
import { useExpenses } from '../../hooks/useExpenses';
import { useConfig } from '../../hooks/useConfig';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { usePrivacy } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { money } from '../../lib/format';
import { getOrderSummary, round2 } from '../../lib/finance';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';

export function SidebarLiveStatus() {
  const { orders } = useOrders();
  const { expenses } = useExpenses();
  const { isPrivate } = usePrivacy();
  const navigate = useNavigate();

  // Métricas en tiempo real de la operación
  const metrics = useMemo(() => {
    let activeOcsCount = 0;
    let totalKilosPedidos = 0;
    let totalKilosEntregados = 0;
    let carteraTotal = 0;
    let carteraVencida = 0;

    for (const o of orders) {
      const summary = getOrderSummary(o);
      const isCompleted = summary.status === 'completed' || summary.status === 'paid' || summary.status === 'collected';
      
      if (!isCompleted && !o.isClosedShort) {
        activeOcsCount++;
        const pedidos = Number(o.totalKilograms) || Number(summary.kilosDelivered) || 0;
        const entregados = Number(summary.kilosDelivered) || 0;
        totalKilosPedidos += pedidos;
        totalKilosEntregados += entregados;
      }

      // Sumar cartera de facturas pendientes de cobro
      for (const inv of summary.invoices || []) {
        const st = inv.creditCycle?.status;
        if (st === 'pending' || st === 'in_review' || st === 'overdue' || st === 'manual_review') {
          const amt = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          carteraTotal += amt;
          if (st === 'overdue') carteraVencida += amt;
        }
      }
    }

    const saldoCaja = round2(
      (expenses || []).reduce((acc, e) => {
        return acc + (e.type === 'ingreso' ? Number(e.amount) || 0 : -(Number(e.amount) || 0));
      }, 0)
    );

    const kilosFaltantes = Math.max(0, totalKilosPedidos - totalKilosEntregados);
    const avanceEntregaPct = totalKilosPedidos > 0 
      ? Math.min(100, Math.round((totalKilosEntregados / totalKilosPedidos) * 100))
      : 100;

    return {
      activeOcsCount,
      totalKilosPedidos,
      totalKilosEntregados,
      kilosFaltantes,
      avanceEntregaPct,
      carteraTotal: round2(carteraTotal),
      carteraVencida: round2(carteraVencida),
      saldoCaja,
    };
  }, [orders, expenses]);

  return (
    <div
      style={{
        margin: '0 4px 12px',
        padding: '12px 10px',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
          Estado en Vivo
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            padding: '2px 6px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 4px #10b981' }} />
          Online
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {/* Pod 1: OCs Activas & Kilos por Entregar */}
        <div
          onClick={() => {
            sound.playSwoosh();
            navigate('/oc');
          }}
          title="Ver Seguimiento por OC: Kilos entregados vs pendientes"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
          }}
        >
          <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>Por Entregar</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#60a5fa', marginTop: 2 }}>
            {isPrivate ? '•••• kg' : `${metrics.kilosFaltantes.toLocaleString('es-MX')} kg`}
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
            {metrics.activeOcsCount} OCs activas
          </div>
        </div>

        {/* Pod 2: Saldo en Caja Chica */}
        <div
          onClick={() => {
            sound.playSwoosh();
            navigate('/caja-chica');
          }}
          title="Ver Efectivo en Caja Chica"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
          }}
        >
          <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>Caja Chica</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: metrics.saldoCaja >= 0 ? '#34d399' : '#f87171',
              marginTop: 2,
            }}
          >
            {isPrivate ? '••••••' : money(metrics.saldoCaja)}
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
            Disponible
          </div>
        </div>
      </div>

      {/* Pod 3: Cartera Total por Cobrar */}
      <div
        onClick={() => {
          sound.playSwoosh();
          navigate('/cobranza');
        }}
        title="Ver Cartera y Facturas Providencia en Cobranza"
        style={{
          marginTop: 6,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 10,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>Cartera x Cobrar</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', marginTop: 1 }}>
            {isPrivate ? '••••••••' : money(metrics.carteraTotal)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {metrics.carteraVencida > 0 ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '2px 5px',
                borderRadius: 6,
              }}
            >
              ⚠️ {money(metrics.carteraVencida)} vda
            </span>
          ) : (
            <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>
              ✓ Al corriente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SidebarFastActions() {
  const { orders } = useOrders();
  const { purchases } = usePurchases();
  const { expenses } = useExpenses();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const toast = useToast();

  const handleAction = (eventName: string, detail?: any) => {
    triggerHaptic('medium');
    sound.playPop();
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  };

  const handleExportExcel = async () => {
    try {
      triggerHaptic('success');
      toast('📊 Exportando Base de Datos Maestra de Excel...', 'info');
      const { downloadMasterExcelWorkbook } = await import('../../lib/masterExcelExporter');
      await downloadMasterExcelWorkbook({ orders, purchases, expenses, config, settings });
      sound.playSuccess();
      toast('✅ Excel Maestro descargado exitosamente.', 'ok');
    } catch (err: any) {
      toast(`Error al exportar Excel: ${err.message}`, 'bad');
    }
  };

  const handleExportPdf = async () => {
    try {
      triggerHaptic('success');
      toast('📄 Generando One-Pager Ejecutivo en PDF...', 'info');
      const saldoCaja = round2(
        (expenses || []).reduce((acc: number, exp: any) => acc + (exp?.type === 'ingreso' ? Number(exp.amount) || 0 : -(Number(exp.amount) || 0)), 0)
      );
      const { downloadExecutiveOnePagerPdf } = await import('../../lib/executiveOnePagerPdf');
      await downloadExecutiveOnePagerPdf({ orders, expenses, config, settings, saldoCaja });
      sound.playSuccess();
      toast('✅ PDF Ejecutivo descargado con éxito.', 'ok');
    } catch (err: any) {
      toast(`Error al generar PDF: ${err.message}`, 'bad');
    }
  };

  const actions = [
    {
      id: 'delivery',
      label: '+ Nueva Entrega (Báscula)',
      sub: 'Kilos, remisión y chofer',
      icon: '⚖️',
      color: '#3b82f6',
      onClick: () => handleAction('open-fast-delivery'),
    },
    {
      id: 'invoice',
      label: '+ Registrar Factura CFDI',
      sub: 'Asignar folio y kilos a OC',
      icon: '🧾',
      color: '#10b981',
      onClick: () => handleAction('open-fast-invoice'),
    },
    {
      id: 'cr',
      label: '+ Asignar Contrarecibo',
      sub: 'Capturar CR y fecha pago',
      icon: '🔖',
      color: '#f59e0b',
      onClick: () => handleAction('open-fast-cr-collection'),
    },
    {
      id: 'upload',
      label: '+ Auto-Captura Documento',
      sub: 'PDF, SAT XML o Lote ZIP',
      icon: '⚡',
      color: '#8b5cf6',
      onClick: () => handleAction('open-fast-upload'),
    },
    {
      id: 'expense',
      label: '+ Movimiento Caja Chica',
      sub: 'Registrar egreso o ingreso',
      icon: '💵',
      color: '#06b6d4',
      onClick: () => handleAction('open-fast-expense'),
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Providencia',
      sub: 'Cobranza Nava y Evelia',
      icon: '💬',
      color: '#22c55e',
      onClick: () => handleAction('open-fast-whatsapp'),
    },
    {
      id: 'calc',
      label: 'Calculadora Kilos / Margen',
      sub: 'Simular ventas y comisión',
      icon: '🧮',
      color: '#ec4899',
      onClick: () => handleAction('open-kilo-calculator'),
    },
  ];

  return (
    <div style={{ marginTop: 12, marginBottom: 8 }}>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          color: '#38bdf8',
          paddingLeft: 10,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span>⚡ CAPTURA RÁPIDA (GLOBAL)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 2px' }}>
        {actions.map((act) => (
          <button
            key={act.id}
            type="button"
            onClick={act.onClick}
            title={`${act.label}: ${act.sub}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              color: '#e2e8f0',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = act.color;
              e.currentTarget.style.transform = 'translateX(3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span
              style={{
                fontSize: 14,
                width: 26,
                height: 26,
                borderRadius: 8,
                background: `${act.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {act.icon}
            </span>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {act.label}
              </div>
              <div style={{ fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {act.sub}
              </div>
            </div>
          </button>
        ))}

        {/* Botones de Exportación Rápida */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
          <button
            type="button"
            onClick={handleExportExcel}
            title="Exportar toda la base de datos a Excel (.xlsx) [Ctrl+E]"
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#34d399',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            📊 Excel (Ctrl+E)
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            title="Descargar reporte ejecutivo en PDF (.pdf) [Ctrl+Shift+P]"
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: '#60a5fa',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            📄 PDF One-Pager
          </button>
        </div>
      </div>
    </div>
  );
}
