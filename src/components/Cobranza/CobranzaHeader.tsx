import { useContext, useState, useEffect, useRef } from 'react';
import CobranzaContext from './CobranzaContext';
import { IconZap, IconRefresh, IconDownload, IconAlertTriangle, IconTrendingUp, IconFileText } from '../ui/icons';

interface CobranzaHeaderProps {
  onOpenSincronizador: () => void;
  onOpenAutoConciliador: () => void;
}

export default function CobranzaHeader({
  onOpenSincronizador,
  onOpenAutoConciliador,
}: CobranzaHeaderProps) {
  const {
    shareCarteraVencida,
    printCarteraVencida,
    shareCobranzaGlobalReport,
    printCobranzaGlobalReport,
    exportCobranzaCsv,
  } = useContext(CobranzaContext)!;

  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowReportsMenu(false);
      }
    }
    if (showReportsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReportsMenu]);

  return (
    <div
      className="page-head"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 16,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Contrarecibos & Cobranza
          </h1>
        </div>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 13 }}>
          Control central de facturas emitidas, contrarecibos de Providencia y conciliación de depósitos.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Sincronizador Oficial */}
        <button
          className="btn btn-primary"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, #2563eb 100%)',
            color: '#fff',
            fontWeight: 700,
            border: 'none',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 13,
          }}
          onClick={onOpenSincronizador}
          title="Sincronizar base de datos con los Contrarecibos Oficiales"
        >
          <IconZap size={16} /> Sincronizar CRs
        </button>

        {/* Auto-Conciliador */}
        <button
          className="btn"
          style={{
            background: 'var(--paper-raised)',
            color: 'var(--ink)',
            fontWeight: 600,
            border: '1px solid var(--line)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 13,
          }}
          onClick={onOpenAutoConciliador}
          title="Conciliar automáticamente depósitos y transferencias bancarias"
        >
          <IconRefresh size={16} /> Auto-Conciliar
        </button>

        {/* Menú Desplegable de Reportes & Exportación */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            className="btn"
            style={{
              background: 'var(--paper-raised)',
              color: 'var(--ink)',
              fontWeight: 600,
              border: '1px solid var(--line)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
            }}
            onClick={() => setShowReportsMenu(!showReportsMenu)}
          >
            <IconFileText size={16} /> Reportes & Exportar ▾
          </button>

          {showReportsMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 12,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                padding: '6px',
                minWidth: 240,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                Cartera Vencida
              </div>
              <button
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  padding: '7px 10px',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                }}
                onClick={() => {
                  setShowReportsMenu(false);
                  shareCarteraVencida();
                }}
              >
                <IconDownload size={15} style={{ color: 'var(--bad)' }} /> Descargar PDF (Cartera Vencida)
              </button>
              <button
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  padding: '7px 10px',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                }}
                onClick={() => {
                  setShowReportsMenu(false);
                  printCarteraVencida();
                }}
              >
                <IconAlertTriangle size={15} style={{ color: 'var(--bad)' }} /> Imprimir Cartera Vencida
              </button>

              <div style={{ height: 1, background: 'var(--line-soft)', margin: '4px 0' }} />

              <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                Reporte General
              </div>
              <button
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  padding: '7px 10px',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                }}
                onClick={() => {
                  setShowReportsMenu(false);
                  shareCobranzaGlobalReport();
                }}
              >
                <IconDownload size={15} style={{ color: 'var(--accent)' }} /> Compartir PDF General
              </button>
              <button
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  padding: '7px 10px',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                }}
                onClick={() => {
                  setShowReportsMenu(false);
                  printCobranzaGlobalReport();
                }}
              >
                <IconTrendingUp size={15} style={{ color: 'var(--accent)' }} /> Imprimir Reporte General
              </button>

              <div style={{ height: 1, background: 'var(--line-soft)', margin: '4px 0' }} />

              <button
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  background: 'transparent',
                  padding: '7px 10px',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                }}
                onClick={() => {
                  setShowReportsMenu(false);
                  exportCobranzaCsv();
                }}
              >
                <IconDownload size={15} style={{ color: 'var(--ok)' }} /> Descargar Excel (CSV)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
