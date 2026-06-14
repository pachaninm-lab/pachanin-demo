// PR-7 BI / runtime metrics binding (§35) — пилотные метрики считаются из
// runtime-событий (сделки/споры/банковские callback-и), а не из декоративных
// сценариев. Ставки/тайминги, которых нет в runtime пилота, явно помечены как
// scenario. Включает экспорт пилотного отчёта. Без live-claims.

import { selectRuntimeDeals, selectRuntimeDisputes, selectRuntimeCallbacks, selectDealIntegrationState } from '@/lib/domain/selectors';
import { getPlatformV7BiCockpitState, type PlatformV7BiMetric } from './bi-cockpit-state';

export type PlatformV7PilotMetrics = {
  readonly metrics: readonly PlatformV7BiMetric[];
  readonly sourceMeta: {
    readonly source: 'controlled-pilot-runtime';
    readonly runtimeBound: true;
    readonly liveExternalIntegrations: false;
  };
};

function countBlockerMatches(blockers: readonly string[], keywords: readonly string[]): number {
  return blockers.filter((b) => keywords.some((k) => b.toLowerCase().includes(k))).length;
}

export function getPlatformV7PilotMetrics(): PlatformV7PilotMetrics {
  const base = getPlatformV7BiCockpitState();
  const deals = selectRuntimeDeals();
  const disputes = selectRuntimeDisputes();
  const callbacks = selectRuntimeCallbacks();
  const active = deals.filter((d) => d.status !== 'closed');
  const dealCount = deals.length || 1;

  const allBlockers = active.flatMap((d) => (d.blockers ?? []) as string[]);
  const manualReview = active.filter((d) => selectDealIntegrationState(d).gateState !== 'PASS').length;
  const documentBlockers = countBlockerMatches(allBlockers, ['сдиз', 'этрн', 'упд', 'документ', 'эпд']);
  const logisticsDelay = countBlockerMatches(allBlockers, ['рейс', 'логист', 'перевоз', 'gps', 'пломб']);
  const elevatorDelay = countBlockerMatches(allBlockers, ['приём', 'вес', 'элеватор', 'расхожден']);
  const labDelay = countBlockerMatches(allBlockers, ['качеств', 'проб', 'протокол', 'лаборатор']);
  const releaseReady = deals.reduce((sum, d) => sum + ((d as { readyToReleaseAmount?: number }).readyToReleaseAmount ?? 0), 0);
  const mismatches = callbacks.filter((c) => c.status === 'mismatch').length;
  const awaitingCallbacks = callbacks.filter((c) => c.status === 'pending').length;

  const pct = (n: number) => `${Math.round((n / dealCount) * 100)}%`;
  const rub = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)} млн ₽` : v >= 1_000 ? `${(v / 1_000).toFixed(0)} тыс. ₽` : `${Math.round(v)} ₽`);

  const extra: PlatformV7BiMetric[] = [
    { key: 'manual-review-rate', label: 'Доля ручной проверки', value: pct(manualReview), basis: 'runtime' },
    { key: 'release-ready', label: 'Готово к выпуску', value: rub(releaseReady), basis: 'runtime' },
    { key: 'document-blockers', label: 'Документные блокеры', value: String(documentBlockers), basis: 'runtime' },
    { key: 'logistics-delay', label: 'Задержки логистики', value: String(logisticsDelay), basis: 'runtime' },
    { key: 'elevator-delay', label: 'Задержки приёмки', value: String(elevatorDelay), basis: 'runtime' },
    { key: 'lab-delay', label: 'Задержки качества', value: String(labDelay), basis: 'runtime' },
    { key: 'reconciliation-mismatch', label: 'Сверка не сошлась', value: String(mismatches), basis: 'runtime' },
    { key: 'awaiting-callbacks', label: 'Ждут банковский callback', value: String(awaitingCallbacks), basis: 'runtime' },
    { key: 'time-to-money', label: 'Время до денег (сценарий)', value: '—', basis: 'scenario' },
  ];

  return {
    metrics: [...base.metrics, ...extra],
    sourceMeta: { source: 'controlled-pilot-runtime', runtimeBound: true, liveExternalIntegrations: false },
  };
}

export type PlatformV7PilotReport = {
  readonly generatedAt: string;
  readonly metrics: readonly PlatformV7BiMetric[];
  readonly disputeCount: number;
  readonly dealCount: number;
  readonly sourceMeta: PlatformV7PilotMetrics['sourceMeta'];
};

// Экспорт пилотного отчёта (сериализуемый снимок метрик для выгрузки).
export function buildPlatformV7PilotReport(now: () => string = () => new Date().toISOString()): PlatformV7PilotReport {
  const snapshot = getPlatformV7PilotMetrics();
  return {
    generatedAt: now(),
    metrics: snapshot.metrics,
    disputeCount: selectRuntimeDisputes().length,
    dealCount: selectRuntimeDeals().length,
    sourceMeta: snapshot.sourceMeta,
  };
}
