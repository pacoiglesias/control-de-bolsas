import { Card } from '../ui';
import { money, kilos } from '../../lib/format';
import { motion } from 'framer-motion';

export function ComprasKpiGrid({
  totalReceivedKilos,
  saldoProveedor,
  entregasAtrasadasCount,
  onPayAtrasadas,
  onPayDebt
}: {
  totalReceivedKilos: number;
  saldoProveedor: number;
  entregasAtrasadasCount: number;
  onPayAtrasadas: () => void;
  onPayDebt: (amount: number) => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="kpi-grid" 
      style={{ marginBottom: 32 }}
    >
      <Card title="🚚 KILOS RECIBIDOS">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div className="num" style={{ fontSize: 42, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>
              {kilos(totalReceivedKilos)}
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 0, fontSize: 14 }}>Total histórico de mercancía ingresada por Andrés.</p>
          </div>
        </div>
      </Card>

      <Card title="⚖️ ESTADO DE CUENTA">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div className="num" style={{ fontSize: 42, fontWeight: 800, color: saldoProveedor < 0 ? 'var(--bad)' : saldoProveedor > 0 ? 'var(--ok)' : 'var(--ink)', letterSpacing: '-1px' }}>
              {saldoProveedor < 0 ? '-' : '+'}{money(Math.abs(saldoProveedor))}
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 16, fontSize: 14 }}>
              {saldoProveedor < 0 ? `Deuda actual con Andrés.` : saldoProveedor > 0 ? `Saldo a favor (Anticipos).` : 'Cuenta saldada.'}
            </p>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'center', 
              background: saldoProveedor < 0 ? 'var(--bad)' : 'var(--ok)', 
              borderColor: saldoProveedor < 0 ? 'var(--bad)' : 'var(--ok)', 
              color: '#fff', 
              fontWeight: 'bold' 
            }} 
            onClick={() => onPayDebt(saldoProveedor < 0 ? Math.abs(saldoProveedor) : 0)}
          >
            {saldoProveedor < 0 ? '💸 Liquidar Deuda en Caja' : '💰 Abonar Anticipo'}
          </motion.button>
        </div>
      </Card>

      <Card title="⚠️ ENTREGAS ATRASADAS">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div className="num" style={{ fontSize: 42, fontWeight: 800, color: entregasAtrasadasCount > 0 ? 'var(--warn)' : 'var(--ok)', letterSpacing: '-1px' }}>
              {entregasAtrasadasCount}
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 16, fontSize: 14 }}>
              Órdenes de compra que ya pasaron su fecha estimada de llegada.
            </p>
          </div>
          
          {entregasAtrasadasCount > 0 && (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', background: 'var(--warn-bg)', borderColor: 'var(--warn)', color: 'var(--warn)', fontWeight: 'bold' }} 
              onClick={onPayAtrasadas}
            >
              🔍 Ver Atrasadas
            </motion.button>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
