import { useState } from 'react';
import { Modal } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../hooks/useOrders';
import { useExpenses } from '../../hooks/useExpenses';
import { useConfig } from '../../hooks/useConfig';
import { exportOfflineWorkbook, parseAndDiffOfflineWorkbook, applyOfflineSyncDiffs, type OfflineSyncDiff } from '../../lib/offlineExcelSync';
import { validarTamanoExcel } from '../../lib/xlsxSafety';
import { triggerHaptic } from '../../lib/hapticEngine';
import { confirmDialog } from '../../lib/confirmDialog';
import confetti from 'canvas-confetti';

export function OfflineExcelSyncModal({ onClose }: { onClose: () => void }) {
  const { orders } = useOrders();
  const { expenses } = useExpenses();
  const { config } = useConfig();
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [downloading, setDownloading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [diffs, setDiffs] = useState<OfflineSyncDiff[] | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const totalInvoices = orders.reduce((acc, o) => acc + (o.invoices?.length || 0), 0);
  const totalDeliveries = orders.reduce((acc, o) => acc + (o.deliveries?.length || 0), 0);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const buffer = await exportOfflineWorkbook(orders, expenses, config);
      const blob = new Blob([buffer.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ERP_Trabajo_Offline_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerHaptic('success');
      toast('✅ Libro Excel Offline descargado con éxito', 'ok');
    } catch (err: any) {
      toast(`Error al exportar Excel: ${err.message}`, 'bad');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const errorTam = validarTamanoExcel(file);
    if (errorTam) {
      toast(errorTam, 'bad');
      return;
    }

    setFileName(file.name);
    setAnalyzing(true);
    try {
      const buffer = await file.arrayBuffer();
      const detectedDiffs = await parseAndDiffOfflineWorkbook(buffer, orders, expenses, config);
      setDiffs(detectedDiffs);
      triggerHaptic('medium');
      if (detectedDiffs.length === 0) {
        toast('El archivo no contiene diferencias frente a la base de datos actual.', 'info');
      } else {
        toast(`🔍 Se detectaron ${detectedDiffs.length} cambio(s) listos para revisar.`, 'ok');
      }
    } catch (err: any) {
      toast(`Error al analizar Excel: ${err.message}`, 'bad');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!diffs || diffs.length === 0) return;

    const validDiffs = diffs.filter(d => !d.error);
    const errorCount = diffs.length - validDiffs.length;

    if (validDiffs.length === 0) {
      toast('No hay cambios válidos para aplicar.', 'bad');
      return;
    }

    let msg = `¿Confirmas aplicar ${validDiffs.length} cambio(s) a la base de datos en tiempo real?`;
    if (errorCount > 0) {
      msg += `\n\n(Nota: Se omitirán ${errorCount} fila(s) que violan reglas del negocio).`;
    }

    if (!(await confirmDialog(msg))) return;

    setApplying(true);
    try {
      const { appliedCount, errors } = await applyOfflineSyncDiffs(validDiffs, user?.email);
      if (appliedCount > 0) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        triggerHaptic('success');
        toast(`✅ ${appliedCount} cambio(s) aplicados con éxito al sistema.`, 'ok');
        if (errors.length > 0) {
          toast(`⚠️ Ocurrieron ${errors.length} errores parciales: ${errors[0]}`, 'bad');
        }
        onClose();
      } else {
        toast(`No se pudieron aplicar los cambios: ${errors.join('; ')}`, 'bad');
      }
    } catch (err: any) {
      toast(`Error al sincronizar: ${err.message}`, 'bad');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal title="📲 Modo Offline & Sincronización con Excel" onClose={onClose}>
      <div style={{ maxWidth: 840, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Pestañas */}
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`tab ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>
            📥 1. Exportar Libro Offline
          </button>
          <button className={`tab ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
            📤 2. Subir y Sincronizar Cambios {diffs && diffs.length > 0 ? `(${diffs.length})` : ''}
          </button>
        </div>

        {tab === 'export' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 18px', lineHeight: 1.5 }}>
              <strong style={{ fontSize: 15 }}>💼 Trabaja sin internet y sin límites:</strong>
              <p style={{ margin: '6px 0 0', color: 'var(--ink-soft)', fontSize: 13 }}>
                Descarga una copia completa del ERP en Excel (.xlsx). Podrás capturar contrarecibos, cambiar estatus de cobranza, registrar entregas de Andrés o ingresar nuevos gastos en Caja Chica desde tu computadora o celular.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--paper)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>📄 Expedientes / Facturas</div>
                <div className="num mono" style={{ fontSize: 22, fontWeight: 800 }}>{totalInvoices} docs</div>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--paper)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>🚚 Entregas de Andrés</div>
                <div className="num mono" style={{ fontSize: 22, fontWeight: 800 }}>{totalDeliveries} registros</div>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--paper)' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>💵 Movimientos de Caja</div>
                <div className="num mono" style={{ fontSize: 22, fontWeight: 800 }}>{expenses.length} registros</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn" onClick={onClose}>Cerrar</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', fontWeight: 800, padding: '10px 20px' }}
                onClick={handleExport}
                disabled={downloading}
              >
                {downloading ? '⏳ Generando Excel...' : '📥 Descargar Excel de Trabajo Offline'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Zona de Carga */}
            <div
              style={{
                border: '2px dashed var(--accent)',
                borderRadius: 12,
                padding: '24px 16px',
                textAlign: 'center',
                background: 'var(--paper-sunk)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('offline-file-input')?.click()}
            >
              <input
                id="offline-file-input"
                type="file"
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
              <strong style={{ fontSize: 15, color: 'var(--ink)' }}>
                {fileName ? fileName : 'Haz clic o arrastra tu archivo Excel modificado aquí'}
              </strong>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
                Formato .xlsx (ERP_Trabajo_Offline_*.xlsx)
              </p>
            </div>

            {analyzing && <div style={{ textAlign: 'center', padding: 20 }}>⏳ Analizando diferencias...</div>}

            {/* Vista Previa de Diffs */}
            {diffs && !analyzing && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong>
                    Diferencias Detectadas: {diffs.length}
                  </strong>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                    {diffs.filter(d => !d.error).length} válidas, {diffs.filter(d => !!d.error).length} rechazadas
                  </span>
                </div>

                {diffs.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-soft)' }}>
                    No se detectaron modificaciones frente a la base de datos.
                  </div>
                ) : (
                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
                    <table className="data-table" style={{ margin: 0, fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Resumen del Cambio</th>
                          <th>Estado / Validación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffs.map((d) => (
                          <tr key={d.id} style={{ background: d.error ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                            <td>
                              <span className="badge" style={{ background: d.type === 'invoice' ? '#7c3aed' : d.type === 'delivery' ? '#059669' : '#d97706', color: '#fff' }}>
                                {d.type === 'invoice' ? 'Factura' : d.type === 'delivery' ? 'Entrega' : 'Caja'}
                              </span>
                            </td>
                            <td>
                              <strong>{d.summary}</strong>
                              {d.changes.length > 0 && (
                                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                                  {d.changes.map((c, i) => (
                                    <span key={i} style={{ marginRight: 8 }}>
                                      {c.field}: <s style={{ opacity: 0.6 }}>{c.oldVal || 'vacío'}</s> ➔ <strong>{c.newVal}</strong>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {d.error ? (
                                <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 11.5 }}>
                                  ⚠️ {d.error}
                                </span>
                              ) : (
                                <span style={{ color: '#059669', fontWeight: 700, fontSize: 11.5 }}>
                                  ✓ Listo para sincronizar
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn" onClick={onClose}>Cancelar</button>
              {diffs && diffs.filter(d => !d.error).length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', fontWeight: 800, padding: '10px 20px' }}
                  onClick={handleApply}
                  disabled={applying}
                >
                  {applying ? '⏳ Sincronizando...' : `🚀 Sincronizar ${diffs.filter(d => !d.error).length} Cambio(s)`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
