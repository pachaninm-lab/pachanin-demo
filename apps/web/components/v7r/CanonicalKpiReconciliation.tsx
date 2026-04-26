'use client';

import { useCanonicalControlTowerKpis, useControlTowerKpis } from '@/lib/domain/hooks';
import { buildControlTowerKpiReconciliationRows, hasKpiReconciliationDelta } from '@/lib/domain/kpi/canonicalReconciliation';
import { formatCompactMoney } from '@/lib/v7r/helpers';

export function CanonicalKpiReconciliation() {
  const legacy = useControlTowerKpis();
  const canonical = useCanonicalControlTowerKpis();
  const rows = buildControlTowerKpiReconciliationRows(legacy, canonical);
  const hasDelta = hasKpiReconciliationDelta(rows);

  return (
    <details data-testid='canonical-kpi-reconciliation' style={{ border: '1px dashed #CBD5E1', borderRadius: 16, padding: 14, background: '#F8FAFC' }}>
      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#334155' }}>
        Сверка KPI: текущая формула ↔ canonical domain · {hasDelta ? 'есть расхождения' : 'расхождений нет'}
      </summary>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {rows.map((row) => {
          const formattedLegacy = formatCompactMoney(row.legacy);
          const formattedCanonical = formatCompactMoney(row.canonical);
          const formattedDelta = formatCompactMoney(row.delta);
          return (
            <div key={row.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) repeat(3, minmax(90px, auto))', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>{row.label}</span>
              <span style={{ color: '#64748B' }}>старое: {formattedLegacy}</span>
              <span style={{ color: '#0F172A', fontWeight: 800 }}>canonical: {formattedCanonical}</span>
              <span style={{ color: row.delta === 0 ? '#15803D' : '#B45309', fontWeight: 800 }}>дельта: {formattedDelta}</span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
