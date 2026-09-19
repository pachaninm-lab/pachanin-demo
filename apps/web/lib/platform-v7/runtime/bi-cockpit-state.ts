import { selectRuntimeDeals, selectRuntimeDisputes } from '@/lib/domain/selectors';

// M3-5 BI / Unit Economics (§35). Метрики считаются из runtime-состояния сделок и
// споров — без выдуманных значений. Ставка комиссии помечена как сценарная
// (controlled-pilot); фактическая финмодель — по данным реального пилота (§43).

const SCENARIO_TAKE_RATE = 0.015; // 1.5% — сценарная ставка контролируемого пилота

export type PlatformV7BiMetric = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly basis: 'runtime' | 'scenario';
};

export type PlatformV7BiCockpitState = {
  readonly metrics: readonly PlatformV7BiMetric[];
  readonly note: string;
  readonly sourceMeta: {
    readonly source: 'controlled-pilot-runtime';
    readonly runtimeBound: true;
    readonly liveExternalIntegrations: false;
  };
};

function rub(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} млн ₽`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} тыс. ₽`;
  return `${Math.round(value)} ₽`;
}

export function getPlatformV7BiCockpitState(): PlatformV7BiCockpitState {
  const deals = selectRuntimeDeals();
  const disputes = selectRuntimeDisputes();
  const dealCount = deals.length;
  const active = deals.filter((d) => d.status !== 'closed');

  const dealValue = (d: { quantity: number; pricePerTon?: number; reservedAmount: number }) =>
    d.pricePerTon ? d.quantity * d.pricePerTon : d.reservedAmount;
  const gmv = deals.reduce((sum, d) => sum + dealValue(d), 0);
  const holdRub = deals.reduce((sum, d) => sum + (d.holdAmount ?? 0), 0);
  const reservedRub = deals.reduce((sum, d) => sum + (d.reservedAmount ?? 0), 0);
  const avgDeal = dealCount > 0 ? gmv / dealCount : 0;
  const commission = gmv * SCENARIO_TAKE_RATE;
  const disputeRate = dealCount > 0 ? (disputes.length / dealCount) * 100 : 0;

  const metrics: PlatformV7BiMetric[] = [
    { key: 'gmv', label: 'Оборот сделок (GMV)', value: rub(gmv), basis: 'runtime' },
    { key: 'deals', label: 'Сделок · активных', value: `${dealCount} · ${active.length}`, basis: 'runtime' },
    { key: 'avg', label: 'Средняя сделка', value: rub(avgDeal), basis: 'runtime' },
    { key: 'reserved', label: 'Под резервом', value: rub(reservedRub), basis: 'runtime' },
    { key: 'hold', label: 'Под удержанием', value: rub(holdRub), basis: 'runtime' },
    { key: 'dispute-rate', label: 'Доля споров', value: `${disputeRate.toFixed(0)}%`, basis: 'runtime' },
    { key: 'take-rate', label: 'Take rate (сценарий)', value: `${(SCENARIO_TAKE_RATE * 100).toFixed(1)}%`, basis: 'scenario' },
    { key: 'commission', label: 'Комиссия (сценарий)', value: rub(commission), basis: 'scenario' },
  ];

  return {
    metrics,
    note: 'Фактические метрики считаются из runtime-сделок; take rate и комиссия — сценарные (controlled-pilot). Фактическая финмодель — по данным реального пилота.',
    sourceMeta: { source: 'controlled-pilot-runtime', runtimeBound: true, liveExternalIntegrations: false },
  };
}
