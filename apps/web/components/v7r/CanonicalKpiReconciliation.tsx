'use client';

import { useCanonicalControlTowerKpis, useControlTowerKpis } from '@/lib/domain/hooks';
import { formatCompactMoney } from '@/lib/v7r/helpers';

function delta(left: number, right: number): number {
  return left - right;
}

export function CanonicalKpiReconciliation() {
  const legacy = useControlTowerKpis();
  const canonical = useCanonicalControlTowerKpis();

  const rows = [
    {
      label: 'Резерв',
      legacy: legacy.reserveTotal.value,
      canonical: canonical.totalReserved,
      kind: 'money' as const,
    },
    {
      label: 'Под удержанием',
      legacy: legacy.heldAmount.value,
      canonical: canonical.totalHold,
      kind: 'money' as const,
    },
    {
      label: 'Деньги под риском',
      legacy: legacy.moneyAtRisk.value,
      canonical: canonical.moneyAtRisk,
      kind: 'money' as const,
    },
    {
      label: 'К выпуску',
      legacy: legacy.readyToRelease.value,
      canonical: canonical.readyToRelease,
      kind: 'money' as const,
    },
  ];

  return (
    <details data-testid='canonical-kpi-reconciliation' style={{ border: '1px dashed #CBD5E1', borderRadius: 16, padding: 14, background: '#F8FAFC' }}>
      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#334155' }}>
        Сверка KPI: текущая формула ↔ canonical domain
      </summary>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {rows.map((row) => {
          const diff = delta(row.canonical, row.legacy);
          const formattedLegacy = row.kind === 'money' ? formatCompactMoney(row.legacy) : String(row.legacy);
          const formattedCanonical = row.kind === 'money' ? formatCompactMoney(row.canonical) : String(row.canonical);
          const formattedDelta = row.kind === 'money' ? formatCompactMoney(diff) : String(diff);
          return (
            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) repeat(3, minmax(90px, auto))', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>{row.label}</span>
              <span style={{ color: '#64748B' }}>старое: {formattedLegacy}</span>
              <span style={{ color: '#0F172A', fontWeight: 800 }}>canonical: {formattedCanonical}</span>
              <span style={{ color: diff === 0 ? '#15803D' : '#B45309', fontWeight: 800 }}>дельта: {formattedDelta}</span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
