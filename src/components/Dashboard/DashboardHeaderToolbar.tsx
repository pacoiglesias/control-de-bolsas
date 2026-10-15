import { useState } from 'react';
import { monthLabel } from '../../lib/format';
import type { NavigateFunction } from 'react-router-dom';
import type { PurchaseOrder } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';

export function DashboardHeaderToolbar(props: {
  nav: NavigateFunction;
  toast: (msg: string, tone?: 'info' | 'ok' | 'bad') => void;
  deptFilter: string;
  setDeptFilter: (d: string) => void;
  monthFilter: string;
  setMonthFilter: (m: string) => void;
  deptPorCobrar: { all: number; th: number; gt: number };
  settings: any;
  mesesKeys: string[];
  showReportsMenu: boolean;
  setShowReportsMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  showExportMenu: boolean;
  setShowExportMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  onOpenCorteMensual: () => void;
  onOpenCorteSemanal: () => void;
  onOpenBalanza: () => void;
  onOpenSincronizador: () => void;
  globalOrders: PurchaseOrder[];
  purchases: any;
  expenses: any;
  config: any;
  shareRentabilidad: () => void;
  printRentabilidad: () => void;
  onOpenUniversalUpload?: () => void;
  onAutoHeal?: () => void;
  isHealing?: boolean;
  onOpenCuadreEjecutivo?: () => void;
  onOpenQuickEdit?: () => void;
  onOpenDiferencias?: () => void;
  onOpenCierreDiario?: () => void;
}) {
 const [tools, setTools] = useState(false);
 const [busy, setBusy] = useState(false);
 const { role } = useAuth();
 const canOperate = role === 'admin' || role === 'manager';
 const action = (fn?: () => void) => { setTools(false); fn?.(); };
 const exportFile = async (kind: 'excel' | 'backup' | 'pdf') => {
   setBusy(true); setTools(false);
   try {
     if (kind === 'excel') {
       const { downloadMasterExcelWorkbook } = await import('../../lib/masterExcelExporter');
       await downloadMasterExcelWorkbook({ orders: props.globalOrders, purchases: props.purchases, expenses: props.expenses, config: props.config, settings: props.settings });
     } else if (kind === 'backup') {
       const { downloadBackupJsonFile } = await import('../../lib/cloudBackup');
       await downloadBackupJsonFile(props.globalOrders, props.purchases, props.expenses, props.config);
     } else {
       const { downloadExecutiveOnePagerPdf } = await import('../../lib/executiveOnePagerPdf');
       const saldoCaja = props.expenses.reduce((n: number, e: any) => n + (e.type === 'ingreso' ? 1 : -1) * (Number(e.amount) || 0), 0);
       await downloadExecutiveOnePagerPdf({ orders: props.globalOrders, expenses: props.expenses, config: props.config, settings: props.settings, saldoCaja });
     }
     props.toast('Archivo generado', 'ok');
   } catch (error) { props.toast(error instanceof Error ? error.message : 'No se pudo generar el archivo', 'bad'); }
   finally { setBusy(false); }
 };
 return <header className="daily-header">
   <div className="daily-heading"><div><p className="work-eyebrow">CONTROL DE BOLSAS</p><h1>Tu operación, en orden.</h1><p>Revisa lo pendiente y continúa con el siguiente paso.</p></div>
     <div className="daily-actions">
       {canOperate && <button className="btn btn-primary" onClick={props.onOpenUniversalUpload}>Subir documento <span aria-hidden="true">↑</span></button>}
       {canOperate && <button className="btn" onClick={() => props.nav('/ordenes?nueva=1')}>Nueva orden +</button>}
       <button className="btn" aria-expanded={tools} aria-controls="daily-tools" onClick={() => setTools(!tools)} disabled={busy}>{busy ? 'Generando…' : 'Herramientas ⋯'}</button>
     </div>
   </div>
   {tools && <section id="daily-tools" className="daily-tools" aria-label="Herramientas y reportes">
     <div><h2>Reportes</h2><button onClick={() => action(props.onOpenCorteMensual)}>Corte mensual</button><button onClick={() => action(props.onOpenCorteSemanal)}>Corte semanal</button><button onClick={() => action(props.onOpenBalanza)}>Balanza</button><button onClick={() => void exportFile('pdf')}>Resumen en PDF</button></div>
     <div><h2>Exportar</h2><button onClick={() => void exportFile('excel')}>Base completa en Excel</button>{role === 'admin' && <button onClick={() => void exportFile('backup')}>Respaldo de datos</button>}<button onClick={() => action(props.printRentabilidad)}>Imprimir resultados</button><button onClick={() => action(props.shareRentabilidad)}>Compartir resultados</button></div>
     {canOperate && <div><h2>Revisión y cierre</h2><button onClick={() => action(props.onOpenCuadreEjecutivo)}>Revisar cuadre</button><button onClick={() => action(props.onOpenDiferencias)}>Revisar diferencias</button><button onClick={() => action(props.onOpenCierreDiario)}>Cierre diario</button><button onClick={() => action(props.onOpenSincronizador)}>Vincular contrarrecibos</button>{role === 'admin' && <button onClick={() => action(props.onOpenQuickEdit)}>Precios y parámetros</button>}</div>}
   </section>}
   <div className="daily-filters"><label>Departamento<select value={props.deptFilter} onChange={e => props.setDeptFilter(e.target.value)}><option value="ALL">Toda la empresa</option><option value="TH">Textil Hogar · TH</option><option value="GT">Grupo Textil · GT</option></select></label><label>Período de resultados<select value={props.monthFilter} onChange={e => props.setMonthFilter(e.target.value)}><option value="ALL">Todo el historial</option>{[...props.mesesKeys].reverse().map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label><small>La cartera muestra el saldo facturado pendiente del departamento.</small></div>
 </header>;
}
