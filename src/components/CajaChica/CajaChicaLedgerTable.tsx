import { motion } from 'framer-motion';
import { Card, Empty } from '../ui';
import { money, fmtDayAndDate } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            style={{
              minHeight: 40,
              background: 'var(--paper-sunk, rgba(255,255,255,0.05))',
              border: '1px solid var(--line, rgba(255,255,255,0.1))',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => {
              triggerHaptic('light');
              onExportCsv();
            }}
            title="Descargar Excel / CSV"
          >
            📥 CSV
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            style={{
              minHeight: 40,
              background: 'var(--paper-sunk, rgba(255,255,255,0.05))',
              border: '1px solid var(--line, rgba(255,255,255,0.1))',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => {
              triggerHaptic('light');
              onShareReport();
            }}
            title="Descargar o Compartir PDF"
          >
            📤 PDF
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            style={{
              minHeight: 40,
              background: 'var(--paper-sunk, rgba(255,255,255,0.05))',
              border: '1px solid var(--line, rgba(255,255,255,0.1))',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={() => {
              triggerHaptic('light');
              onPrintReport();
            }}
            title="Imprimir Corte de Caja"
          >
            🖨️ Imprimir
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary"
            style={{
              minHeight: 40,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              padding: '0 16px',
            }}
            onClick={() => {
              triggerHaptic('light');
              onNewExpense();
            }}
          >
            + Nuevo Movimiento
          </motion.button>
        </div>
      }
      title="Historial de Movimientos de Efectivo"
      hint={`Mostrando ${filteredExpenses.length} de ${expenses.length} registros en libro mayor`}
    >
      {/* Barra de Filtros y Buscador */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div
          style={{
            display: 'inline-flex',
            gap: 4,
            padding: 4,
            background: 'var(--paper-sunk, rgba(0, 0, 0, 0.2))',
            borderRadius: 12,
            border: '1px solid var(--line-soft, rgba(255, 255, 255, 0.08))',
            flexWrap: 'wrap',
          }}
        >
          {(
            [
              ['all', 'Todos'],
              ['ingreso', '📥 Cobros Contadores'],
              ['andres', `🏭 Pagos a ${provName}`],
              ['socios', '🤝 Reparto Socios'],
              ['otros', '💸 Otros Egresos'],
            ] as const
          ).map(([f, label]) => {
            const isActive = cajaFilter === f;
            return (
              <motion.button
                key={f}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  triggerHaptic('light');
                  setCajaFilter(f);
                }}
                style={{
                  background: isActive ? 'var(--accent, #3b82f6)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--ink-soft, #94a3b8)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12.5,
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                }}
              >
                {label}
              </motion.button>
            );
          })}
        </div>

        <div style={{ position: 'relative', minWidth: 220 }}>
          <input
            type="text"
            placeholder="🔍 Buscar concepto o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 14px',
              paddingRight: searchTerm ? 32 : 14,
              borderRadius: 10,
              border: '1px solid var(--line, rgba(255, 255, 255, 0.12))',
              background: 'var(--paper-sunk, rgba(0, 0, 0, 0.2))',
              color: 'var(--ink, #f1f5f9)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-soft)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Resumen de totales filtrados */}
      {(cajaFilter !== 'all' || searchTerm.trim()) && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            gap: 20,
            marginBottom: 16,
            fontSize: 12.5,
            fontWeight: 700,
            background: 'var(--surface-raised, rgba(255,255,255,0.02))',
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid var(--line-soft, rgba(255,255,255,0.06))',
          }}
        >
          <span style={{ color: 'var(--ink-soft)' }}>
            Ingresos: <strong style={{ color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>+{money(filteredIngresos)}</strong>
          </span>
          <span style={{ color: 'var(--ink-soft)' }}>
            Egresos: <strong style={{ color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>-{money(filteredEgresos)}</strong>
          </span>
          <span style={{ color: 'var(--ink-soft)' }}>
            Neto Filtrado: <strong style={{ color: 'var(--ink, #fff)', fontVariantNumeric: 'tabular-nums' }}>{money(filteredIngresos - filteredEgresos)}</strong>
          </span>
        </motion.div>
      )}

      {filteredExpenses.length === 0 ? (
        <Empty>No hay movimientos que coincidan con el filtro o búsqueda.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 0' }}>
          {filteredExpenses.map((e, index) => (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.015, 0.2) }}
              key={e.id}
              onClick={() => {
                triggerHaptic('light');
                onSelectExpense(e);
              }}
              style={{
                background: 'var(--surface-raised, rgba(255, 255, 255, 0.025))',
                border: '1px solid var(--border, rgba(255, 255, 255, 0.07))',
                borderLeft: e.type === 'ingreso' ? '3px solid #10b981' : '3px solid #ef4444',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: '0 2px 6px -1px rgba(0,0,0,0.04)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
              whileHover={{ scale: 1.008, y: -1, boxShadow: '0 6px 16px -2px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.992 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: e.type === 'ingreso' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: e.type === 'ingreso' ? '#10b981' : '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    flexShrink: 0,
                  }}
                >
                  {e.type === 'ingreso' ? '📥' : '📤'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #f1f5f9)', marginBottom: 3 }}>
                    {e.concept}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft, #94a3b8)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDayAndDate(e.date)}
                    </span>
                    {e.provider && e.provider.toLowerCase() === provName.toLowerCase() && (
                      <span
                        style={{
                          background: 'rgba(14, 165, 233, 0.15)',
                          color: '#38bdf8',
                          padding: '1px 7px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ● Abono Andrés
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div
                className="mono"
                style={{
                  color: e.type === 'ingreso' ? '#10b981' : 'var(--ink, #f1f5f9)',
                  fontWeight: 800,
                  fontSize: 16,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
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

