import { motion } from 'framer-motion';
import { Card, Empty } from '../ui';
import { money, fmtDayAndDate } from '../../lib/format';
import type { Expense } from '../../lib/types';

interface CajaChicaLedgerTableProps {
  filteredExpenses: Expense[];
  expenses: Expense[];
  cajaFilter: 'all' | 'ingreso' | 'andres' | 'socios' | 'otros';
  setCajaFilter: (f: 'all' | 'ingreso' | 'andres' | 'socios' | 'otros') => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  filteredIngresos: number;
  filteredEgresos: number;
  provName: string;
  onSelectExpense: (e: Expense) => void;
  onNewExpense: () => void;
  onExportCsv: () => void;
  onPrintReport: () => void;
  onShareReport: () => void;
}

export function CajaChicaLedgerTable({
  filteredExpenses,
  expenses,
  cajaFilter,
  setCajaFilter,
  searchTerm,
  setSearchTerm,
  filteredIngresos,
  filteredEgresos,
  provName,
  onSelectExpense,
  onNewExpense,
  onExportCsv,
  onPrintReport,
  onShareReport,
}: CajaChicaLedgerTableProps) {
  return (
    <Card
      actions={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn"
              style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
              onClick={onExportCsv}
              title="Descargar Excel / CSV"
            >
              📥 CSV
            </button>
            <button
              className="btn"
              style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
              onClick={onShareReport}
              title="Descargar o Compartir PDF"
            >
              📤 PDF
            </button>
            <button
              className="btn"
              style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
              onClick={onPrintReport}
              title="Imprimir Corte de Caja"
            >
              🖨️ Imprimir
            </button>
            <button className="btn btn-primary" onClick={onNewExpense}>
              + Nuevo Movimiento
            </button>
          </div>
        </div>
      }
      title="Historial de Movimientos de Efectivo"
      hint={`Mostrando ${filteredExpenses.length} de ${expenses.length} registros`}
    >
      {/* Barra de Filtros y Buscador */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(
            [
              ['all', 'Todos'],
              ['ingreso', '📥 Cobros de Contadores'],
              ['andres', `🏭 Pagos a ${provName}`],
              ['socios', '🤝 Reparto a Socios'],
              ['otros', '💸 Otros Egresos'],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setCajaFilter(f)}
              style={{
                background: cajaFilter === f ? 'var(--accent)' : 'var(--paper-sunk)',
                color: cajaFilter === f ? '#fff' : 'var(--ink)',
                border: '1px solid var(--line-soft)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar movimiento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--paper-sunk)',
            color: 'var(--ink)',
            fontSize: 12.5,
            minWidth: 200,
            outline: 'none',
          }}
        />
      </div>

      {/* Resumen de totales filtrados */}
      {(cajaFilter !== 'all' || searchTerm.trim()) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
          <span>
            Ingresos: <strong style={{ color: '#047857' }}>+{money(filteredIngresos)}</strong>
          </span>
          <span>
            Egresos: <strong style={{ color: '#b91c1c' }}>-{money(filteredEgresos)}</strong>
          </span>
          <span>
            Neto: <strong style={{ color: 'var(--ink)' }}>{money(filteredIngresos - filteredEgresos)}</strong>
          </span>
        </div>
      )}

      {filteredExpenses.length === 0 ? (
        <Empty>No hay movimientos que coincidan con el filtro o búsqueda.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
          {filteredExpenses.map((e, index) => (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.2) }}
              key={e.id}
              onClick={() => onSelectExpense(e)}
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
              whileHover={{ scale: 1.01, boxShadow: '0 6px 14px -3px rgba(0,0,0,0.06)' }}
              whileTap={{ scale: 0.99 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: e.type === 'ingreso' ? '#dcfce7' : '#fee2e2',
                    color: e.type === 'ingreso' ? '#166534' : '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {e.type === 'ingreso' ? '📥' : '📤'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)', marginBottom: 2 }}>{e.concept}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      {fmtDayAndDate(e.date)}
                    </span>
                    {e.provider && e.provider.toLowerCase() === provName.toLowerCase() && (
                      <span
                        style={{
                          marginLeft: 8,
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '2px 6px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ● Abono a Proveedor
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div
                className="mono"
                style={{
                  color: e.type === 'ingreso' ? 'var(--ok)' : 'var(--ink)',
                  fontWeight: 800,
                  fontSize: 16,
                  textAlign: 'right',
                }}
              >
                {e.type === 'ingreso' ? '+' : '-'}
                {money(e.amount)}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}
