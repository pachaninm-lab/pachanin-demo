import type { ControlTowerKpi as CanonicalControlTowerKpi } from '@/lib/platform-v7/domain';
import type { ControlTowerKpis } from './controlTower';

export type KpiReconciliationRowKey = 'reserve' | 'held' | 'moneyAtRisk' | 'readyToRelease';

export interface KpiReconciliationRow {
  readonly key: KpiReconciliationRowKey;
  readonly label: string;
  readonly legacy: number;
  readonly canonical: number;
  readonly delta: number;
  readonly kind: 'money';
}

export function buildControlTowerKpiReconciliationRows(
  legacy: ControlTowerKpis,
  canonical: CanonicalControlTowerKpi,
): KpiReconciliationRow[] {
  const rows: Omit<KpiReconciliationRow, 'delta'>[] = [
    {
      key: 'reserve',
      label: 'Резерв',
      legacy: legacy.reserveTotal.value,
      canonical: canonical.totalReserved,
      kind: 'money',
    },
    {
      key: 'held',
      label: 'Под удержанием',
      legacy: legacy.heldAmount.value,
      canonical: canonical.totalHold,
      kind: 'money',
    },
    {
      key: 'moneyAtRisk',
      label: 'Деньги под риском',
      legacy: legacy.moneyAtRisk.value,
      canonical: canonical.moneyAtRisk,
      kind: 'money',
    },
    {
      key: 'readyToRelease',
      label: 'К выпуску',
      legacy: legacy.readyToRelease.value,
      canonical: canonical.readyToRelease,
      kind: 'money',
    },
  ];

  return rows.map((row) => ({ ...row, delta: row.canonical - row.legacy }));
}

export function hasKpiReconciliationDelta(rows: readonly KpiReconciliationRow[]): boolean {
  return rows.some((row) => row.delta !== 0);
}
