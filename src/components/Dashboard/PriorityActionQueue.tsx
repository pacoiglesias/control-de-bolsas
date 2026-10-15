import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { buildOperationalTasks, type WorkCategory, type OperationalTask } from '../../lib/operationalTasks';
import { money, kilos } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import '../../styles/operations.css';

const filters: { key: WorkCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Todo' }, { key: 'delivery', label: 'Entregar' },
  { key: 'invoice', label: 'Facturar' }, { key: 'receipt', label: 'Contrarrecibos' },
  { key: 'collection', label: 'Cobrar' }, { key: 'cash', label: 'Ingresar a caja' },
];

interface Props {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenQuickInvoice?: (orderId?: string | null) => void;
  onOpenQuickCollection?: () => void;
  onOpenQuickDelivery?: (orderId?: string | null) => void;
}

export function PriorityActionQueue({ orders, onOpenQuickInvoice, onOpenQuickDelivery }: Props) {
  const nav = useNavigate();
  const { role } = useAuth();
  const canOperate = role === 'admin' || role === 'manager';
  const [filter, setFilter] = useState<WorkCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const today = new Date().toLocaleDateString('en-CA');
  const tasks = useMemo(() => buildOperationalTasks(orders, new Date(today + 'T12:00:00')), [orders, today]);
  const filtered = tasks.filter(task => (filter === 'all' || task.category === filter) &&
    (task.title + ' ' + task.reference + ' ' + task.client).toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  const urgent = tasks.filter(task => task.urgent).length;
  const visible = expanded ? filtered : filtered.slice(0, 6);
  const selectFilter = (key: WorkCategory | 'all') => { setFilter(key); setExpanded(false); };
  const openTask = (task: OperationalTask) => {
    if (canOperate && task.category === 'invoice' && onOpenQuickInvoice) return onOpenQuickInvoice(task.orderId);
    if (canOperate && task.category === 'delivery' && onOpenQuickDelivery) return onOpenQuickDelivery(task.orderId);
    if (canOperate && (task.category === 'collection' || task.category === 'cash')) return nav('/cobranza');
    const invoice = task.invoiceId ? '&factura=' + encodeURIComponent(task.invoiceId) : '';
    nav('/ordenes?abrir=' + encodeURIComponent(task.orderId) + '&tab=' + (task.category === 'delivery' ? 'entregas' : 'facturas') + invoice);
  };
  return (
    <section className="work-panel" aria-labelledby="work-title">
      <div className="work-panel-head">
        <div>
          <p className="work-eyebrow">TU OPERACIÓN, PASO A PASO</p>
          <h2 id="work-title">Qué sigue hoy</h2>
          <p className="work-description">{urgent > 0 ? urgent + ' pendientes vencidos requieren atención.' : 'Tus próximos pasos, ordenados por prioridad.'}</p>
        </div>
        <span className={'work-count' + (urgent ? ' work-count-urgent' : '')}>{tasks.length} pendientes</span>
      </div>
      <div className="work-tools">
        <div className="work-filters" role="group" aria-label="Filtrar pendientes">
          {filters.map(item => {
            const count = item.key === 'all' ? tasks.length : tasks.filter(task => task.category === item.key).length;
            return <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => selectFilter(item.key)}>
              {item.label}<span>{count}</span>
            </button>;
          })}
        </div>
        <input className="input work-search" type="search" aria-label="Buscar pendientes por orden, factura o cliente" placeholder="Buscar orden, factura o cliente" value={query} onChange={event => { setQuery(event.target.value); setExpanded(false); }} />
      </div>
      <div className="work-list" aria-live="polite">
        {visible.map(task => <article key={task.id} className={'work-row' + (task.urgent ? ' work-row-urgent' : '')}>
          <span className="work-step" aria-hidden="true">{({ delivery: '01', invoice: '02', receipt: '03', collection: '04', cash: '05' })[task.category]}</span>
          <div className="work-row-content">
            <div className="work-row-meta"><span>OC {task.reference}</span><span>{task.client}</span>{task.urgent && <strong>Vencido</strong>}</div>
            <h3>{task.title}</h3><p>{task.detail}</p>
          </div>
          <div className="work-row-action">
            <strong className="tabular-nums">{task.kilos != null ? kilos(task.kilos) : task.amount != null ? money(task.amount) : ''}</strong>
            <button className="btn" type="button" onClick={() => openTask(task)}>{canOperate ? task.action : 'Ver expediente'} <span aria-hidden="true">→</span></button>
          </div>
        </article>)}
        {filtered.length === 0 && <div className="work-empty">
          <strong>{tasks.length === 0 ? 'No hay pendientes registrados.' : 'No hay pendientes con estos filtros.'}</strong>
          <p>{tasks.length === 0 ? 'Las nuevas entregas y facturas aparecerán aquí con su siguiente paso.' : 'Prueba con otra búsqueda o muestra todos los pendientes.'}</p>
          {tasks.length > 0 && <button className="btn" type="button" onClick={() => { selectFilter('all'); setQuery(''); }}>Limpiar filtros</button>}
        </div>}
      </div>
      {filtered.length > 6 && <button className="work-more" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        {expanded ? 'Mostrar solo los primeros 6' : 'Ver los ' + filtered.length + ' pendientes'}
      </button>}
    </section>
  );
}
