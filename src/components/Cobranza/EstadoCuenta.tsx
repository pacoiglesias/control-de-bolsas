import { useMemo, useState } from 'react';
import { useCobranza } from './CobranzaContext';
import { useOrdersContext } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import { Card, Empty } from '../ui';
import { money, fmtDate, toDate } from '../../lib/format';
import { round2 } from '../../lib/finance';
import type { PurchaseOrder } from '../../lib/types';
import { Timestamp } from 'firebase/firestore';
import { generateProvidenciaStatementPdf, buildProvidenciaStatementDataFromOrders } from '../../lib/providenciaStatementPdf';

interface LedgerEntry {
  id: string;
  date: Timestamp | null;
  concept: string;
  cargo: number; // Aumenta deuda de Providencia
  abono: number; // Disminuye deuda de Providencia
  balance: number;
}

export default function EstadoCuenta() {
  const { data, settings } = useCobranza();
  const { orders: contextOrders } = useOrdersContext();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const allOrders: PurchaseOrder[] = data?.rawOrders?.length ? data.rawOrders : (contextOrders || []);

  const statementData = useMemo(() => {
    return buildProvidenciaStatementDataFromOrders(allOrders, settings);
  }, [allOrders, settings]);

  const ledger = useMemo(() => {
    const entries: Omit<LedgerEntry, 'balance'>[] = [];

    (allOrders || []).forEach((o) => {
      if (!o) return;
      const invs = o.invoices || [];
      invs.forEach((inv) => {
        if (!inv) return;
        const invTotal = inv.financials?.invoiceTotal || inv.financials?.saleTotal || 0;
        
        if (invTotal > 0) {
          entries.push({
            id: `cargo-${inv.id}`,
            date: o.processedAt || o.updatedAt || null,
            concept: `Factura ${inv.folio || o.folio || 'S/N'}`,
            cargo: round2(invTotal),
            abono: 0,
          });
        }

        const paid = inv.collection?.paidAmount || 0;
        if (paid > 0) {
          entries.push({
            id: `abono-${inv.id}`,
            date: inv.collection?.collectedAt || inv.collection?.paidAt || o.processedAt || null,
            concept: `Pago/Cobro de Factura ${inv.folio || o.folio || 'S/N'} (CR: ${inv.collection?.contrareciboNumber || 'S/N'})`,
            cargo: 0,
            abono: round2(paid),
          });
        }
      });
    });

    // Ordenar cronológicamente
    entries.sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0));

    let runningBalance = 0;
    const finalEntries: LedgerEntry[] = [];

    entries.forEach(e => {
      runningBalance = round2(runningBalance + e.cargo - e.abono);
      finalEntries.push({ ...e, balance: runningBalance });
    });

    return finalEntries.reverse(); // Más reciente primero
  }, [allOrders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ledger;
    const s = search.toLowerCase();
    return ledger.filter(e => e.concept.toLowerCase().includes(s));
  }, [ledger, search]);

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await generateProvidenciaStatementPdf(statementData);
      toast('Estado de Cuenta descargado con éxito en PDF.', 'ok');
    } catch (err) {
      toast(`Error al generar el PDF: ${(err as Error).message}`, 'bad');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Resumen de Cartera y Botón de Descarga PDF */}
      <div 
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#fff',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          border: '1px solid #334155',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            CLIENTE: GRUPO TEXTIL PROVIDENCIA SA DE CV
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
            {money(statementData.activeBalance)} <span style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Deuda Activa Total</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#cbd5e1', flexWrap: 'wrap' }}>
            <span>Facturado: <strong>{money(statementData.totalInvoiced)}</strong></span>
            <span>·</span>
            <span>Cobrado: <strong style={{ color: '#4ade80' }}>{money(statementData.totalPaid)}</strong></span>
            <span>·</span>
            <span>Vencido: <strong style={{ color: statementData.overdueBalance > 0 ? '#f87171' : '#cbd5e1' }}>{money(statementData.overdueBalance)}</strong></span>
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              cursor: isGeneratingPdf ? 'wait' : 'pointer'
            }}
          >
            <span>{isGeneratingPdf ? '⏳' : '📄'}</span>
            <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar Estado de Cuenta (PDF)'}</span>
          </button>
        </div>
      </div>

      <Card title="Libro Mayor y Movimientos: PROVIDENCIA">
        <div style={{ marginBottom: 16 }}>
          <p className="hint">Cada factura emitida aumenta la deuda del cliente. Cada pago depositado y marcado como Cobrado disminuye su deuda. El saldo final refleja la Deuda Real Activa.</p>
          <input 
            className="input boxed" 
            placeholder="Buscar por factura o CR..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 300, marginTop: 8 }}
          />
        </div>

        {filtered.length === 0 ? (
          <Empty>No hay movimientos registrados.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="num">Cargo (Sube Deuda)</th>
                  <th className="num">Abono (Baja Deuda)</th>
                  <th className="num">Saldo (Deuda Activa)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td className="mono">{fmtDate(e.date)}</td>
                    <td>{e.concept}</td>
                    <td className="num mono" style={{ color: e.cargo > 0 ? 'var(--warn)' : 'inherit' }}>
                      {e.cargo > 0 ? money(e.cargo) : '-'}
                    </td>
                    <td className="num mono" style={{ color: e.abono > 0 ? 'var(--ok)' : 'inherit' }}>
                      {e.abono > 0 ? money(e.abono) : '-'}
                    </td>
                    <td className="num mono" style={{ color: 'var(--ink)' }}>
                      <strong>{money(e.balance)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

