import { motion } from 'framer-motion';
import { Card } from '../ui';
import { money } from '../../lib/format';

interface CajaChicaKpisProps {
  saldo: number;
  dineroEnTransito: number;
  totalBrutoCobrado: number;
  totalComisionContador: number;
  saldoProveedor: number;
  provName: string;
  totalRepartoSocios: number;
  onReceiveMoney: () => void;
  onPayAndres: () => void;
  onSociosDistribution: () => void;
}

export function CajaChicaKpis({
  saldo,
  dineroEnTransito,
  totalBrutoCobrado,
  totalComisionContador,
  saldoProveedor,
  provName,
  totalRepartoSocios,
  onReceiveMoney,
  onPayAndres,
  onSociosDistribution,
}: CajaChicaKpisProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="kpi-grid" style={{ marginBottom: 32 }}>
      {/* 1. Saldo Líquido en Mano */}
      <Card title="💰 EFECTIVO EN CAJA">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div
              className="num"
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: saldo < 0 ? 'var(--bad)' : 'var(--ok)',
                letterSpacing: '-1px',
              }}
            >
              {money(saldo)}
            </div>
            <p className="hint" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
              Dinero líquido disponible en mano actualmente.
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Dinero en Tránsito con Contadores */}
      <Card title="🚚 POR RECIBIR DEL CONTADOR">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div
              className="num"
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: dineroEnTransito > 0 ? 'var(--warn)' : 'var(--ink)',
                letterSpacing: '-1px',
              }}
            >
              {money(dineroEnTransito)}
            </div>
            <div
              style={{
                marginTop: 6,
                marginBottom: 10,
                fontSize: 11.5,
                background: 'var(--paper-sunk)',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--line-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft)' }}>
                <span>Cobrado Providencia (c/IVA):</span>
                <span className="mono">{money(totalBrutoCobrado)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontWeight: 600 }}>
                <span>Comisión Contador (8%):</span>
                <span className="mono">-{money(totalComisionContador)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#047857',
                  fontWeight: 800,
                  borderTop: '1px solid var(--line-soft)',
                  paddingTop: 3,
                  marginTop: 3,
                }}
              >
                <span>Neto Limpio a Caja:</span>
                <span className="mono">{money(dineroEnTransito)}</span>
              </div>
            </div>
          </div>
          <motion.button
            whileHover={dineroEnTransito > 0 ? { scale: 1.02 } : {}}
            whileTap={dineroEnTransito > 0 ? { scale: 0.98 } : {}}
            className="btn btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              background: dineroEnTransito > 0 ? 'var(--warn)' : 'var(--bg-inset)',
              borderColor: dineroEnTransito > 0 ? 'var(--warn)' : 'var(--border)',
              color: dineroEnTransito > 0 ? '#000' : 'var(--hint)',
              fontWeight: 'bold',
              cursor: dineroEnTransito > 0 ? 'pointer' : 'not-allowed',
              opacity: dineroEnTransito > 0 ? 1 : 0.6,
            }}
            disabled={dineroEnTransito <= 0}
            onClick={onReceiveMoney}
          >
            💵 {dineroEnTransito > 0 ? 'Recibir Efectivo en Mano' : 'Sin efectivo por recibir'}
          </motion.button>
        </div>
      </Card>

      {/* 3. Cuenta con Andrés */}
      <Card title={`🏭 CUENTA CON ${provName.toUpperCase()}`}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div
              className="num"
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: saldoProveedor < 0 ? 'var(--bad)' : saldoProveedor > 0 ? 'var(--ok)' : 'var(--ink)',
                letterSpacing: '-1px',
              }}
            >
              {saldoProveedor < 0 ? '-' : '+'}
              {money(Math.abs(saldoProveedor))}
            </div>
            <p className="hint" style={{ marginTop: 6, marginBottom: 8, fontSize: 13 }}>
              {saldoProveedor < 0
                ? `Deuda por pagar a ${provName}.`
                : saldoProveedor > 0
                ? `Saldo a favor con ${provName}.`
                : 'Cuentas al día.'}
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
              background: saldoProveedor < 0 ? 'var(--bad)' : '#0ea5e9',
              borderColor: saldoProveedor < 0 ? 'var(--bad)' : '#0ea5e9',
              color: '#fff',
              fontWeight: 'bold',
            }}
            onClick={onPayAndres}
          >
            {saldoProveedor < 0 ? '💸 Pagar Deuda' : '💸 Dar Abono / Anticipo'}
          </motion.button>
        </div>
      </Card>

      {/* 4. Reparto de Ganancias a Socios */}
      <Card title="🤝 REPARTO A SOCIOS">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <div className="num" style={{ fontSize: 38, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>
              {money(totalRepartoSocios)}
            </div>
            <p className="hint" style={{ marginTop: 6, marginBottom: 8, fontSize: 13 }}>
              Total retirado acumulado por socios.
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
              background: '#8b5cf6',
              borderColor: '#8b5cf6',
              color: '#fff',
              fontWeight: 'bold',
            }}
            onClick={onSociosDistribution}
          >
            💼 Retirar Utilidad / Socio
          </motion.button>
        </div>
      </Card>
    </motion.div>
  );
}
