import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useOrdersContext } from '../../context/OrdersContext';
import { evidenceRequirements, type ProvidenciaEvidence } from '../../lib/providenciaEvidence';
import { money } from '../../lib/format';

export function EvidenceRows({ evidence: e }: { evidence: ProvidenciaEvidence }) {
  return <div style={{overflowX:'auto',maxHeight:420}}>
    <p>{e.title} · {e.receipts.length || e.invoices.length || e.allocations.length} registros · {money(e.total)}{e.kind==='payment_rep' ? ` · Fecha de pago: ${e.paymentDate} · REP ${e.folio}` : ''}</p>
    {e.partial && <p role="note">Solo se recibió una parte del listado. Faltan páginas del portal.</p>}
    {e.receipts.length>0 && <table className="table"><thead><tr><th>Contrarrecibo</th><th>Fecha</th><th>Vencimiento</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead><tbody>{e.receipts.map(r=><tr key={r.cr}><td>{r.cr}</td><td>{r.issueDate}</td><td>{r.dueDate}</td><td>{money(r.total)}</td><td>{money(r.paid)}</td><td>{money(r.remaining)}</td><td>{r.status}</td></tr>)}</tbody></table>}
    {e.invoices.length>0 && <table className="table"><thead><tr><th>Factura</th><th>OC</th><th>Emisión</th><th>Total</th></tr></thead><tbody>{e.invoices.map(r=><tr key={r.folio}><td>{r.folio}</td><td>{r.oc}</td><td>{r.issueDate.split('T')[0]}</td><td>{money(r.total)}</td></tr>)}</tbody></table>}
    {e.allocations.length>0 && <table className="table"><thead><tr><th>Factura</th><th>UUID relacionado</th><th>Saldo anterior</th><th>Pagado</th><th>Saldo restante</th></tr></thead><tbody>{e.allocations.map(r=><tr key={r.uuid||r.folio}><td>{r.folio}</td><td style={{maxWidth:240,overflowWrap:'anywhere'}}>{r.uuid}</td><td>{money(r.previous)}</td><td>{money(r.paid)}</td><td>{money(r.remaining)}</td></tr>)}</tbody></table>}
  </div>;
}

export function ProvidenciaCaptureReview({ compact=false }: { compact?: boolean }) {
  const { role }=useAuth();
  const { documentOrders, orders }=useOrdersContext();
  const [records,setRecords]=useState<Array<{id:string;fileName:string;evidence:ProvidenciaEvidence}>>([]);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(role!=='admin' && role!=='manager') return;
    return onSnapshot(query(collection(db,'storedDocuments'),where('evidence.kind','in',['receipt_list','invoice_list','payment_rep'])),snap=>{
      setRecords(snap.docs.map(d=>({...d.data(),id:d.id} as typeof records[number])));setError('');
    },()=>setError('No se pudieron consultar los documentos pendientes. Vuelve a abrir Documentos.'));
  },[role]);
  if(role!=='admin' && role!=='manager') return null;
  if(!records.length && !error) return null;
  const details=records.map(r=>({...r,requirements:evidenceRequirements(r.evidence,documentOrders||orders)}));
  const missing=[...new Set(details.flatMap(r=>r.requirements))];
  return <section className="card" aria-label="Datos pendientes por capturar" style={{padding:20,marginBottom:20}}>
    <h2 style={{fontSize:18,margin:'0 0 8px'}}>Datos pendientes por capturar</h2>
    {error && <p role="alert">{error}</p>}
    <p>{records.length} documentos del portal registrados · {missing.length} datos o documentos por completar.</p>
    <p>Se revisan de nuevo al capturar facturas y contrarrecibos. Los listados sirven para conciliar; no generan ventas, entregas ni ingresos adicionales.</p>
    {compact ? <><ul>{missing.slice(0,3).map(s=><li key={s}>{s}</li>)}</ul><Link className="btn" to="/archivo-documentos">Revisar qué falta capturar →</Link></> : details.map(r=><details key={r.id} style={{borderTop:'1px solid var(--line)',padding:'12px 0'}}>
      <summary style={{cursor:'pointer',fontWeight:700}}>{r.evidence.title}{r.evidence.folio ? ` ${r.evidence.folio}` : ''} · {r.requirements.length} pendientes</summary>
      <p className="hint">{r.fileName}</p>
      <EvidenceRows evidence={r.evidence}/>
      {r.requirements.length ? <><h3 style={{fontSize:15}}>Qué falta para conciliar</h3><ul>{r.requirements.map(s=><li key={s} style={{marginBottom:7}}>{s}</li>)}</ul></> : <p>Sin diferencias detectadas con los datos capturados.</p>}
    </details>)}
  </section>;
}
