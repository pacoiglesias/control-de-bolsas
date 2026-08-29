import { useState, useMemo } from 'react';
import { doc, collection, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useExpenses } from '../hooks/useExpenses';
import { useOrders } from '../hooks/useOrders';
import { Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { usePurchases } from '../hooks/usePurchases';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useToast } from '../context/ToastContext';
import { fmtDate, exportToCsv, shareHtmlAsPdf } from '../lib/format';
import { computeCommissionFromInvoiceTotal, normalizarTexto, round2 } from '../lib/finance';
import type { Expense } from '../lib/types';

// Subcomponentes modulares de Caja Chica
import { CajaChicaKpis } from '../components/CajaChica/CajaChicaKpis';
import { CajaChicaLedgerTable } from '../components/CajaChica/CajaChicaLedgerTable';
import { ExpenseDrawer } from '../components/CajaChica/ExpenseDrawer';
import { getCajaChicaHtml } from '../components/CajaChica/cajaChicaReports';

export default function CajaChica() {
  const { role } = useAuth();
  const { expenses, loading, error } = useExpenses();
  const { orders } = useOrders();
  const { purchases: allPurchases } = usePurchases();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
  const toast = useToast();

  const [selected, setSelected] = useState<Expense | null>(null);
  const [cajaFilter, setCajaFilter] = useState<'all' | 'ingreso' | 'andres' | 'socios' | 'otros'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const provName = settings?.providerName || 'Andrés';

  const saldo = useMemo(() => {
    return round2(
      expenses.reduce((acc, e) => {
        return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
      }, 0)
    );
  }, [expenses]);

  // Total acumulado retirado por los socios
  const totalRepartoSocios = useMemo(() => {
    return round2(
      expenses
        .filter((e) => {
          if (e.type !== 'egreso') return false;
          const c = (e.concept || '').toLowerCase();
          return (
            c.includes('socio') ||
            c.includes('reparto') ||
            c.includes('utilidad') ||
            c.includes('paco') ||
            c.includes('ganancia') ||
            c.includes('retiro')
          );
        })
        .reduce((a, e) => a + e.amount, 0)
    );
  }, [expenses]);

  // Filtrado de movimientos
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const isAndres = e.provider && e.provider.toLowerCase() === provName.toLowerCase();
      const c = (e.concept || '').toLowerCase();
      const isSocio =
        e.type === 'egreso' &&
        (c.includes('socio') ||
          c.includes('reparto') ||
          c.includes('utilidad') ||
          c.includes('paco') ||
          c.includes('ganancia') ||
          c.includes('retiro'));

      if (cajaFilter === 'ingreso' && e.type !== 'ingreso') return false;
      if (cajaFilter === 'andres' && !isAndres) return false;
      if (cajaFilter === 'socios' && !isSocio) return false;
      if (cajaFilter === 'otros' && (e.type !== 'egreso' || isAndres || isSocio)) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchConcept = (e.concept || '').toLowerCase().includes(q);
        const matchProvider = (e.provider || '').toLowerCase().includes(q);
        if (!matchConcept && !matchProvider) return false;
      }
      return true;
    });
  }, [expenses, cajaFilter, searchTerm, provName]);

  const filteredIngresos = useMemo(
    () => round2(filteredExpenses.filter((e) => e.type === 'ingreso').reduce((a, e) => a + e.amount, 0)),
    [filteredExpenses]
  );
  const filteredEgresos = useMemo(
    () => round2(filteredExpenses.filter((e) => e.type === 'egreso').reduce((a, e) => a + e.amount, 0)),
    [filteredExpenses]
  );

  const provPurchases = useMemo(
    () => allPurchases.filter((p) => normalizarTexto(p.provider) === normalizarTexto(provName)),
    [allPurchases, provName]
  );
  const totalReceivedKilos = useMemo(
    () => provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0),
    [provPurchases]
  );
  const currentCostPerKg = config?.costPricePerKg || 38;
  const totalPurchasesCost = round2(totalReceivedKilos * currentCostPerKg);

  const provExpenses = useMemo(
    () => expenses.filter((e) => normalizarTexto(e.provider) === normalizarTexto(provName)),
    [expenses, provName]
  );
  const totalPagado = useMemo(() => {
    return round2(
      provExpenses.reduce((acc, e) => {
        if (e.type === 'egreso') return acc + e.amount;
        if (e.type === 'ingreso') return acc - e.amount;
        return acc;
      }, 0)
    );
  }, [provExpenses]);

  const deudaHistorica = config?.historicalDebtAndres || 0;
  const saldoProveedor = round2(totalPagado - totalPurchasesCost + deudaHistorica);

  // Desglose de dinero en tránsito (estatus 'paid')
  const { totalBrutoCobrado, totalComisionContador, dineroEnTransito } = useMemo(() => {
    let bruto = 0;
    let comision = 0;
    let neto = 0;

    (orders || []).forEach((o) => {
      (o?.invoices || []).forEach((inv) => {
        if (inv?.creditCycle?.status === 'paid') {
          const totalFactura =
            inv.financials?.invoiceTotal ??
            (inv.kilos ?? 0) * (config?.salePricePerKg ?? 43) * (1 + (config?.ivaRate ?? 0.16));
          const comm = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(totalFactura, config as any);
          const net = round2(totalFactura - comm);
          bruto = round2(bruto + totalFactura);
          comision = round2(comision + comm);
          neto = round2(neto + net);
        }
      });
    });

    return { totalBrutoCobrado: bruto, totalComisionContador: comision, dineroEnTransito: neto };
  }, [orders, config]);

  function printCajaChicaReport() {
    const html = getCajaChicaHtml(expenses, settings, saldo);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareCajaChicaReport() {
    const html = getCajaChicaHtml(expenses, settings, saldo);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `CajaChica_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function exportCajaChicaCsv() {
    const headers = ['Fecha', 'Concepto', 'Proveedor', 'Tipo', 'Monto'];
    const rows = expenses.map((e) => [
      fmtDate(e.date),
      e.concept || '',
      e.provider || '',
      e.type,
      (e.type === 'ingreso' ? e.amount : -e.amount).toFixed(2),
    ]);
    exportToCsv(`CajaChica_Providencia_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('📥 Archivo de Excel (CSV) descargado con éxito.', 'ok');
  }

  if (loading) {
    return (
      <>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 220, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: '55%', height: 16 }} />
        </div>
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="skeleton-card" style={{ height: 90 }} />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="skeleton-row" style={{ height: 52, marginBottom: 8 }} />
        ))}
      </>
    );
  }

  if (role !== 'admin') return <Navigate to="/" replace />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>FLUJO DE EFECTIVO & REPARTO</h1>
        <p>Control directo del dinero recibido de contadores, pagos a {provName} y retiro de utilidades.</p>
      </div>

      {/* 1. KPIs Maestros de Tesorería */}
      <CajaChicaKpis
        saldo={saldo}
        dineroEnTransito={dineroEnTransito}
        totalBrutoCobrado={totalBrutoCobrado}
        totalComisionContador={totalComisionContador}
        saldoProveedor={saldoProveedor}
        provName={provName}
        totalRepartoSocios={totalRepartoSocios}
        onReceiveMoney={() =>
          setSelected({
            id: doc(collection(db, PATHS.expenses)).id,
            date: Timestamp.fromDate(new Date()),
            concept: 'Efectivo Recibido de Contadores (Cobranza Providencia)',
            amount: dineroEnTransito,
            type: 'ingreso',
            createdAt: null,
          } as Expense)
        }
        onPayAndres={() =>
          setSelected({
            id: doc(collection(db, PATHS.expenses)).id,
            date: Timestamp.fromDate(new Date()),
            concept: saldoProveedor < 0 ? `Abono a ${provName}` : `Anticipo a ${provName}`,
            provider: provName,
            amount: saldoProveedor < 0 ? Math.abs(saldoProveedor) : 0,
            type: 'egreso',
            createdAt: null,
          } as Expense)
        }
        onSociosDistribution={() =>
          setSelected({
            id: doc(collection(db, PATHS.expenses)).id,
            date: Timestamp.fromDate(new Date()),
            concept: 'Retiro de Utilidades Socios',
            amount: 0,
            type: 'egreso',
            createdAt: null,
          } as Expense)
        }
      />

      {/* 2. Tabla de Movimientos Filtrable y Exportable */}
      <CajaChicaLedgerTable
        filteredExpenses={filteredExpenses}
        expenses={expenses}
        cajaFilter={cajaFilter}
        setCajaFilter={setCajaFilter}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredIngresos={filteredIngresos}
        filteredEgresos={filteredEgresos}
        provName={provName}
        onSelectExpense={(e) => setSelected(e)}
        onNewExpense={() =>
          setSelected({
            id: doc(collection(db, PATHS.expenses)).id,
            date: Timestamp.fromDate(new Date()),
            concept: '',
            amount: 0,
            type: 'egreso',
            createdAt: null,
          } as Expense)
        }
        onExportCsv={exportCajaChicaCsv}
        onPrintReport={printCajaChicaReport}
        onShareReport={shareCajaChicaReport}
      />

      {/* 3. Drawer de Edición y Creación de Movimientos */}
      {selected && (
        <ExpenseDrawer
          expense={selected}
          onClose={() => setSelected(null)}
          provName={provName}
          saldoCajaActual={saldo}
        />
      )}
    </>
  );
}
