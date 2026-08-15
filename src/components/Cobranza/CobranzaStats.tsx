import { Skeleton } from '../ui';

export default function CobranzaStats() {
  return (
    <div className="kpi-grid">
      {[1,2,3,4].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 85 }} />)}
    </div>
  );
}