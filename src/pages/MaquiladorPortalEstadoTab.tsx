import { money } from '../lib/format';
import { openWhatsAppMessage, openEmailMessage } from '../lib/whatsappReminder';
import { glass, kpiCard } from './MaquiladorPortal.shared';

interface MaquiladorPortalEstadoTabProps {
  loadingStatement: boolean;
  statement: any;
  loadStatement: () => void;
  provName: string;
  handleDownloadPdf: () => void;
  filteredLedger: any[];
  ledgerFilter: 'all' | 'pagos' | 'entregas';
  setLedgerFilter: (f: 'all' | 'pagos' | 'entregas') => void;
  ledgerSearch: string;
  setLedgerSearch: (s: string) => void;
}

export default function MaquiladorPortalEstadoTab({
  loadingStatement,
  statement,
  loadStatement,
  provName,
  handleDownloadPdf,
  filteredLedger,
  ledgerFilter,
  setLedgerFilter,
  ledgerSearch,
  setLedgerSearch,
}: MaquiladorPortalEstadoTabProps) {
  if (loadingStatement) {
    return (
      <div style={{ ...glass, padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div>Consultando tu balance contable en vivo...</div>
      </div>
    );
  }

  if (!statement) {
    return (
      <div style={{ ...glass, padding: 40, textAlign: 'center' }}>
        <button
          onClick={loadStatement}
          style={{
            padding: '14px 28px',
            background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
            border: 'none',
            borderRadius: 14,
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          💰 Ver Mi Estado de Cuenta
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs de Saldo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={kpiCard('#a78bfa')}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>
            Total Fabricado
          </span>
          <span style={{ fontSize: 22, fontWeight: 900 }}>{money(statement.totalPurchasesCost)}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {statement.totalReceivedKilos?.toLocaleString?.('es-MX') || 0} kg entregados
          </span>
        </div>

        <div style={kpiCard('#34d399')}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>
            Total Pagado
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>{money(statement.totalPagado)}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Abonos recibidos</span>
        </div>

        <div
          style={{
            ...kpiCard(
              statement.saldoProveedor < 0 ? '#34d399' : '#fbbf24',
              statement.saldoProveedor < 0
                ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.2) 100%)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.2) 100%)'
            ),
            gridColumn: '1 / -1',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase' }}>
              {statement.saldoProveedor < 0 ? '✅ Saldo a tu Favor' : '⚠️ Anticipo Pendiente'}
            </span>
            <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>En tiempo real</span>
          </div>
          <span
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: statement.saldoProveedor < 0 ? '#34d399' : '#fbbf24',
              letterSpacing: '-1px',
            }}
          >
            {statement.saldoProveedor < 0 ? '+' : '-'}
            {money(Math.abs(statement.saldoProveedor))}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {statement.saldoProveedor < 0
              ? 'Monto total pendiente de transferirte'
              : 'Anticipo en mano por cubrir con entregas'}
          </span>
        </div>
      </div>

      {/* Botones de Acción: Descarga de PDF y Compartir */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={handleDownloadPdf}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            border: 'none',
            borderRadius: 12,
            padding: '12px 18px',
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
          }}
        >
          <span>📄</span> Descargar Comprobante (PDF)
        </button>

        <button
          onClick={() => {
            const saldoText =
              statement.saldoProveedor >= 0
                ? `Saldo a favor de ${provName}: +${money(Math.abs(statement.saldoProveedor))}`
                : `Anticipo pendiente: -${money(Math.abs(statement.saldoProveedor))}`;
            const subject = `Resumen de Estado de Cuenta — ${provName}`;
            const body = `Hola Paco,\n\nTe comparto mi resumen de cuenta:\n\n• Total Fabricado: ${money(
              statement.totalPurchasesCost
            )}\n• Total Pagado: ${money(
              statement.totalPagado
            )}\n• Balance Actual: ${saldoText}\n\nQuedo atento.\n\nSaludos,\n${provName}`;
            openEmailMessage(subject, body);
          }}
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid #3b82f6',
            borderRadius: 12,
            padding: '12px 16px',
            color: '#60a5fa',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📧</span> Correo
        </button>

        <button
          onClick={() => {
            const saldoText =
              statement.saldoProveedor >= 0
                ? `Saldo a mi favor de *+${money(Math.abs(statement.saldoProveedor))}*`
                : `Anticipo pendiente de *-${money(Math.abs(statement.saldoProveedor))}*`;
            const text = `Hola Paco, te comparto mi resumen de cuenta:\n• Total Fabricado: *${money(
              statement.totalPurchasesCost
            )}*\n• Total Pagado: *${money(
              statement.totalPagado
            )}*\n• Balance Actual: ${saldoText}\n\nQuedo atento. Saludos, ${provName}.`;
            openWhatsAppMessage(text);
          }}
          style={{
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid #22c55e',
            borderRadius: 12,
            padding: '12px 16px',
            color: '#4ade80',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📲</span> WhatsApp
        </button>
      </div>

      {/* Ledger de Movimientos */}
      <div style={{ ...glass, padding: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase' }}>
            Movimientos ({filteredLedger.length})
          </div>

          {/* Filtros de Tipo */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                ['all', 'Todos'],
                ['pagos', '💰 Pagos'],
                ['entregas', '🏭 Entregas'],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setLedgerFilter(f)}
                style={{
                  background: ledgerFilter === f ? '#a78bfa' : 'rgba(255,255,255,0.08)',
                  color: ledgerFilter === f ? '#0f172a' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Buscador de Movimientos */}
        <input
          type="text"
          placeholder="Buscar movimiento o folio..."
          value={ledgerSearch}
          onChange={(e) => setLedgerSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            color: '#fff',
            fontSize: 12,
            marginBottom: 14,
            outline: 'none',
          }}
        />

        {filteredLedger.map((row: any, i: number) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 14,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{row.concept}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {new Date(row.dateMillis).toLocaleDateString('es-MX', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {row.cargo > 0 && <div style={{ color: '#f87171', fontWeight: 800 }}>−{money(row.cargo)}</div>}
              {row.abono > 0 && <div style={{ color: '#34d399', fontWeight: 800 }}>+{money(row.abono)}</div>}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                {money(row.balance)}
              </div>
            </div>
          </div>
        ))}

        {filteredLedger.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.4)' }}>
            No se encontraron movimientos con este filtro.
          </div>
        )}
      </div>
    </div>
  );
}
