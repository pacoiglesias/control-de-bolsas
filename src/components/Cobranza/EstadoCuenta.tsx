import { useMemo, useState } from 'react';
import { useCobranza } from './CobranzaContext';
import { Card, Empty } from '../ui';
import { money, fmtDate } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';
import { Timestamp } from 'firebase/firestore';

interface LedgerEntry {
  id: string;
  date: Timestamp | null;
  concept: string;
  cargo: number; // Aumenta deuda de Providencia
  abono: number; // Disminuye deuda de Providencia
  balance: number;
}

export default function EstadoCuenta() {
  const { data } = useCobranza();
  const [search, setSearch] = useState('');

  const ledger = useMemo(() => {
    const entries: Omit<LedgerEntry, 'balance'>[] = [];

    // Recorremos todas las facturas como Cargos y sus pagos como Abonos
    // 'data.rawOrders' o el equivalente en 'data'. Voy a buscar si en context se llama globalOrders o algo asi.
    // Vi en index.tsx que exportan 'data' que es el return de 'useCobranzaData()'.
    // Necesitamos pasar 'orders' o 'rawOrders' al context.
    const allOrders: PurchaseOrder[] = data.rawOrders || [];
    
    allOrders.forEach((o) => {
      const invs = o.invoices || [];
      invs.forEach((inv) => {
        const invTotal = inv.financials?.invoiceTotal || inv.financials?.saleTotal || 0;
        
        if (invTotal > 0) {
          entries.push({
            id: `cargo-${inv.id}`,
            date: o.processedAt || o.updatedAt || null,
            concept: `Factura ${inv.folio || o.folio || 'S/N'}`,
            cargo: invTotal,
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
            abono: paid,
          });
        }
      });
    });

    // Ordenar cronológicamente
    entries.sort((a, b) => (a.date?.toMillis() || 0) - (b.date?.toMillis() || 0));

    let runningBalance = 0;
    const finalEntries: LedgerEntry[] = [];

    entries.forEach(e => {
      runningBalance += e.cargo; // Facturar sube su deuda
      runningBalance -= e.abono; // Pagar baja su deuda
      finalEntries.push({ ...e, balance: runningBalance });
    });

    return finalEntries.reverse(); // Más reciente primero
  }, [data.rawOrders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ledger;
    const s = search.toLowerCase();
    return ledger.filter(e => e.concept.toLowerCase().includes(s));
  }, [ledger, search]);

  return (
    <Card title="Libro Mayor y Estado de Cuenta: PROVIDENCIA">
      <div style={{ marginBottom: 16 }}>
        <p className="hint">Cada factura que emites aumenta la deuda del cliente. Cada pago depositado y marcado como Cobrado disminuye su deuda. El saldo final es la Deuda Real Activa (independiente a los estatus de contabilidad).</p>
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
  );
}
