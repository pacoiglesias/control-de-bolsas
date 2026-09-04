import { Empty } from '../ui';
import { fmtDayAndDate, money } from '../../lib/format';
import { printAndresReceipt } from '../../lib/andresReceiptPdf';
import type { LedgerEntry } from '../../hooks/useAndresStats';

export function AndresLedgerTable({ ledgerWithBalance, deudaHistorica }: { ledgerWithBalance: LedgerEntry[], deudaHistorica: number }) {
  if (ledgerWithBalance.length === 0 && deudaHistorica === 0) {
    return <Empty>No hay movimientos registrados en el libro mayor.</Empty>;
  }

  const handlePrintPastReceipt = (e: LedgerEntry) => {
    printAndresReceipt({
      amount: e.abono || 0,
      concept: e.concept || 'Abono por Maquila y Fabricación de Bolsa',
      date: e.date,
      saldoRestante: e.balance,
      payerName: 'Administración / Socios Providencia',
    });
  };

  return (
    <div className="table-scroll">
      {deudaHistorica !== 0 && (
        <p className="hint" style={{ marginTop: 0, marginBottom: 16, textAlign: 'center', color: '#991b1b' }}>
          * Nota: Existe una deuda/ajuste histórico configurado por {money(deudaHistorica)} que afecta el balance final.
        </p>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Origen</th>
            <th>Movimiento / Concepto</th>
            <th className="num">Cargo (Sube Deuda)</th>
            <th className="num">Abono (Baja Deuda)</th>
            <th className="num">Saldo Acumulado</th>
            <th style={{ textAlign: 'center' }}>Comprobante</th>
          </tr>
        </thead>
        <tbody>
          {ledgerWithBalance.map((e, i) => (
            <tr key={`${e.id}-${i}`}>
              <td className="mono" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDayAndDate(e.date)}</td>
              <td>
                {e.source === 'historical' ? (
                  <span className="badge b-warn">Histórico</span>
                ) : e.source === 'purchase' ? (
                  <span className="badge b-ok">Material</span>
                ) : (
                  <span className="badge b-info">Caja (Pago)</span>
                )}
              </td>
              <td>{e.concept}</td>
              <td className="num mono" style={{ color: e.cargo ? 'var(--bad)' : 'inherit', fontWeight: e.cargo ? 600 : 'normal' }}>
                {e.cargo ? money(e.cargo) : '-'}
              </td>
              <td className="num mono" style={{ color: e.abono ? 'var(--ok)' : 'inherit', fontWeight: e.abono ? 600 : 'normal' }}>
                {e.abono ? money(e.abono) : '-'}
              </td>
              <td className="num mono" style={{ color: e.balance > 0 ? '#047857' : e.balance < 0 ? '#b91c1c' : 'inherit', fontWeight: 800 }}>
                {e.balance > 0 ? `+${money(e.balance)} (A favor)` : e.balance < 0 ? `-${money(Math.abs(e.balance))} (Deuda)` : '$0.00'}
              </td>
              <td style={{ textAlign: 'center' }}>
                {e.source === 'expense' && e.abono > 0 ? (
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700 }}
                    onClick={() => handlePrintPastReceipt(e)}
                    title="Imprimir Recibo de este Pago para Firma de Andrés"
                  >
                    🖨️ Recibo
                  </button>
                ) : (
                  <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
