// @ts-nocheck
import React from 'react';
import { useCobranza } from './CobranzaContext';
import { KpiCard } from '../ui';

export default function CobranzaStats() {
  const { data, money } = useCobranza();
  return (
    <div className="kpi-grid">
          {[1,2].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 85 }} />)}
        </div>
  );
}