import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { IconZap, IconRefresh, IconDownload, IconAlertTriangle, IconTrendingUp } from '../ui/icons';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): encabezado con los
 * botones de acción global (Sincronizar, Auto-Conciliar, PDFs) extraído
 * tal cual. Los dos modales (`AutoConciliadorModal`/`SincronizadorOficialModal`)
 * se quedan controlados por el padre -- aquí solo se reciben los setters.
 */
export default function CobranzaHeader({
  onOpenSincronizador,
  onOpenAutoConciliador,
}: {
  onOpenSincronizador: () => void;
  onOpenAutoConciliador: () => void;
}) {
  const { shareCarteraVencida, printCarteraVencida, shareCobranzaGlobalReport, printCobranzaGlobalReport } = useContext(CobranzaContext)!;

  return (
    <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1>Contrarecibos / Cobranza</h1>
        <p>
          Control central de lo que te deben en Providencia, contrarecibos emitidos y depósitos conciliados que ingresan a tu cuenta y caja.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)', color: '#fff', fontWeight: 800, border: 'none', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={onOpenSincronizador}
          title="Sincronizar base de datos con los Contrarecibos Oficiales"
        >
          <IconZap size={16} /> Sincronizar Contrarecibos
        </button>
        <button
          className="btn btn-primary"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#fff', fontWeight: 700, border: 'none', boxShadow: '0 2px 8px rgba(16,185,129,0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={onOpenAutoConciliador}
        >
          <IconRefresh size={16} /> Auto-Conciliar Pagos / Depósitos
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={shareCarteraVencida}>
            <IconDownload size={16} /> PDF (Cartera Vencida)
          </button>
          <button className="btn" style={{ background: '#b91c1c', color: '#fff', borderColor: '#b91c1c', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={printCarteraVencida}>
            <IconAlertTriangle size={16} /> Cartera Vencida (Imprimir)
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={shareCobranzaGlobalReport}>
            <IconDownload size={16} /> Compartir PDF
          </button>
          <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={printCobranzaGlobalReport}>
            <IconTrendingUp size={16} /> Imprimir Todo (General)
          </button>
        </div>
      </div>
    </div>
  );
}
