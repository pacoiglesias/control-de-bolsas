import { money } from '../lib/format';
import { openWhatsAppMessage } from '../lib/whatsappReminder';
import { glass, kpiCard } from './MaquiladorPortal.shared';

/**
 * Tab "Mi Estado de Cuenta" del Portal Maquilador.
 * Permite a Andrés consultar su balance contable en tiempo real,
 * revisar el desglose de entregas y pagos recibidos, y compartir
 * su estado de cuenta por WhatsApp o descargarlo en PDF.
 */
export default function MaquiladorPortalEstadoTab({
  loadingStatement,
  statement,
  loadStatement,
  provName,
  filteredLedger,
  ledgerFilter,
  setLedgerFilter,
  ledgerSearch,
  setLedgerSearch,
  handleDownloadPdf,
}: {
  loadingStatement: boolean;
  statement: any;
  loadStatement: () => void;
  provName: string;
  filteredLedger: any[];
  ledgerFilter: 'all' | 'pagos' | 'entregas';
  setLedgerFilter: (f: 'all' | 'pagos' | 'entregas') => void;
  ledgerSearch: string;
  setLedgerSearch: (s: string) => void;
  handleDownloadPdf: () => void;
}) {
  // Obtener último pago registrado si existe en el ledger
  const lastPayment = statement?.ledger?.find((it: any) => it.abono > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {loadingStatement ? (
        <div style={{ ...glass, padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Consultando tu balance contable en vivo...</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Sincronizando con libros de Caja Chica y Entregas</div>
        </div>
      ) : !statement ? (
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
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
            }}
          >
            💰 Ver Mi Estado de Cuenta
          </button>
        </div>
      ) : (
        <>
          {/* Header con botón de recarga rápida */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 800, textTransform: 'uppercase' }}>
              Balance en Tiempo Real
            </div>
            <button
              onClick={loadStatement}
              title="Actualizar balance contable"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                padding: '4px 10px',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>🔄</span> Actualizar
            </button>
          </div>

          {/* KPIs de Saldo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={kpiCard('#a78bfa')}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>
                Total Fabricado
              </span>
              <span style={{ fontSize: 22, fontWeight: 900 }}>{money(statement.totalPurchasesCost)}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{statement.totalReceivedKilos?.toLocaleString?.('es-MX') || 0} kg entregados</span>
            </div>

            <div style={kpiCard('#34d399')}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>
                Total Pagado
              </span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>{money(statement.totalPagado)}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                {lastPayment ? `Último: ${money(lastPayment.abono)} (${new Date(lastPayment.dateMillis).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })})` : 'Abonos de Caja Chica'}
              </span>
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
                <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, background: 'rgba(167,139,250,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                  En vivo
                </span>
              </div>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: statement.saldoProveedor < 0 ? '#34d399' : '#fbbf24',
                  letterSpacing: '-1px',
                  marginTop: 4,
                  display: 'block',
                }}
              >
                {statement.saldoProveedor < 0 ? '+' : '-'}{money(Math.abs(statement.saldoProveedor))}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {statement.saldoProveedor < 0
                  ? 'Monto total pendiente de liquidarte por entregas validadas'
                  : 'Anticipo en mano por cubrir con próximas entregas de material'}
              </span>
            </div>
          </div>

          {/* Botones de Acción: Descarga de PDF y Compartir */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleDownloadPdf}
              style={{
                flex: 1,
                minWidth: 200,
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
              <span>📄</span> Descargar Comprobante Oficial (PDF)
            </button>

            <button
              onClick={() => {
                const saldoText = statement.saldoProveedor < 0
                  ? `Saldo a mi favor de *+${money(Math.abs(statement.saldoProveedor))}*`
                  : `Anticipo pendiente de *-${money(Math.abs(statement.saldoProveedor))}*`;
                const text = `Hola Paco, te comparto mi resumen de cuenta actualizado:\n• Total Fabricado: *${money(statement.totalPurchasesCost)}* (${statement.totalReceivedKilos || 0} kg)\n• Total Pagado: *${money(statement.totalPagado)}*\n• Balance Actual: ${saldoText}\n\nQuedo atento. Saludos, ${provName}.`;
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
              <span>📲</span> Enviar WhatsApp
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
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 800, textTransform: 'uppercase' }}>
                Historial de Movimientos ({filteredLedger.length})
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
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
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
              placeholder="Buscar movimiento, folio o concepto..."
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
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
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
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                    {money(row.balance)}
                  </div>
                </div>
              </div>
            ))}

            {filteredLedger.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.65)' }}>
                No se encontraron movimientos con este filtro.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
