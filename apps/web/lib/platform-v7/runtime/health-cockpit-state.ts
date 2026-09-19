// PR-6 Observability health screens (§32) — полный health-снимок пилота поверх
// observability-cockpit-state. Выводится из runtime (сделки/споры/интеграции/
// транспорт) + контрактов готовности интеграций. Без фейковой телеметрии и без
// live-claims. На пилоте сразу видно, где зависла сделка, деньги, документ,
// адаптер или ручная проверка.

import { selectRuntimeDeals, selectRuntimeDisputes, selectDealIntegrationState } from '@/lib/domain/selectors';
import { countTransportBlockedPacks, countTransportAwaitingSignatures } from '@/lib/v7r/transport-docs';
import { PLATFORM_V7_INTEGRATION_CONTRACTS } from '@/lib/platform-v7/integration-readiness';
import {
  getPlatformV7ObservabilityCockpitState,
  type PlatformV7HealthArea,
  type PlatformV7HealthSeverity,
} from './observability-cockpit-state';

export type PlatformV7AdapterHealthRow = {
  readonly system: string;
  readonly status: string;
  readonly severity: PlatformV7HealthSeverity;
};

export type PlatformV7QueueItem = {
  readonly id: string;
  readonly label: string;
  readonly reason: string;
  readonly severity: PlatformV7HealthSeverity;
};

export type PlatformV7HealthCockpitState = {
  readonly overall: PlatformV7HealthSeverity;
  readonly areas: readonly PlatformV7HealthArea[];
  readonly adapters: readonly PlatformV7AdapterHealthRow[];
  readonly manualReviewQueue: readonly PlatformV7QueueItem[];
  readonly stuckDeals: readonly PlatformV7QueueItem[];
  readonly sourceMeta: {
    readonly source: 'controlled-pilot-runtime';
    readonly runtimeBound: true;
    readonly liveExternalIntegrations: false;
  };
};

function sev(critical: boolean, warning: boolean): PlatformV7HealthSeverity {
  return critical ? 'critical' : warning ? 'warning' : 'ok';
}

function worst(severities: readonly PlatformV7HealthSeverity[]): PlatformV7HealthSeverity {
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('warning')) return 'warning';
  return 'ok';
}

export function getPlatformV7HealthCockpitState(): PlatformV7HealthCockpitState {
  const base = getPlatformV7ObservabilityCockpitState();
  const deals = selectRuntimeDeals();
  const disputes = selectRuntimeDisputes();
  const active = deals.filter((d) => d.status !== 'closed');

  // Adapter Health — из контрактов готовности (pre-integration: не подключено/ручная проверка).
  const adapters: PlatformV7AdapterHealthRow[] = PLATFORM_V7_INTEGRATION_CONTRACTS.map((c) => ({
    system: c.title,
    status: c.status === 'connected' ? 'подключено' : c.requiresManualReview ? 'ручная проверка' : 'требуется подключение',
    severity: c.status === 'connected' ? 'ok' : 'warning',
  }));

  // Очереди исполнения.
  const transportBlocked = countTransportBlockedPacks();
  const transportAwaiting = countTransportAwaitingSignatures();

  // Manual Review Queue — сделки, которым нужна ручная проверка (интеграция не
  // подтвердила) + споры (удержание до решения).
  const manualReviewQueue: PlatformV7QueueItem[] = [
    ...active
      .filter((d) => selectDealIntegrationState(d).gateState !== 'PASS')
      .slice(0, 8)
      .map((d) => ({ id: `mr-${d.id}`, label: d.id, reason: 'внешний контур не подтверждён — нужна ручная проверка', severity: 'warning' as const })),
    ...disputes.slice(0, 8).map((d) => ({ id: `mr-disp-${d.id}`, label: `Спор ${d.id}`, reason: 'удержание до решения арбитра', severity: 'critical' as const })),
  ];

  // Stuck Deal Monitor — сделки со стоп-фактором (блокер/спор) в контуре.
  const stuckDeals: PlatformV7QueueItem[] = active
    .filter((d) => (d.blockers ?? []).length > 0 || d.dispute)
    .slice(0, 12)
    .map((d) => ({
      id: `stuck-${d.id}`,
      label: d.id,
      reason: (d.blockers ?? [])[0] ?? 'спор удерживает деньги',
      severity: (d.blockers ?? []).length > 1 || d.dispute ? 'critical' : 'warning',
    }));

  const adapterSeverity = worst(adapters.map((a) => a.severity));
  const queueSeverity = sev(transportBlocked > 2, transportBlocked > 0 || transportAwaiting > 3);

  const areas: PlatformV7HealthArea[] = [
    ...base.areas,
    { key: 'integration', label: 'Adapter Health', value: `${adapters.length} контуров`, severity: adapterSeverity, note: 'внешние адаптеры — pre-integration' } as PlatformV7HealthArea,
    { key: 'system', label: 'Queue Health', value: `${transportAwaiting} ждут подписи · ${transportBlocked} держат`, severity: queueSeverity, note: 'очередь транспортных документов' } as PlatformV7HealthArea,
  ];

  const overall = worst([
    base.overall,
    adapterSeverity,
    queueSeverity,
    worst(manualReviewQueue.map((m) => m.severity)),
    worst(stuckDeals.map((s) => s.severity)),
  ]);

  return {
    overall,
    areas,
    adapters,
    manualReviewQueue,
    stuckDeals,
    sourceMeta: { source: 'controlled-pilot-runtime', runtimeBound: true, liveExternalIntegrations: false },
  };
}
