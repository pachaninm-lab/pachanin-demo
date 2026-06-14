import { selectRuntimeDeals, selectRuntimeDisputes, selectDealIntegrationState } from '@/lib/domain/selectors';
import { countTransportBlockedPacks, countTransportAwaitingSignatures } from '@/lib/v7r/transport-docs';

// M3-4 Observability (§32). Health-снимок выводится из runtime-состояния сделок,
// споров и интеграций (controlled-pilot, без фейковой телеметрии). Показывает
// оператору, где контур ломается: System / Integration / Deal / Money + журнал инцидентов.

export type PlatformV7HealthSeverity = 'ok' | 'warning' | 'critical';

export type PlatformV7HealthArea = {
  readonly key: 'system' | 'integration' | 'deal' | 'money';
  readonly label: string;
  readonly value: string;
  readonly severity: PlatformV7HealthSeverity;
  readonly note: string;
};

export type PlatformV7Incident = {
  readonly id: string;
  readonly severity: PlatformV7HealthSeverity;
  readonly message: string;
};

export type PlatformV7ObservabilityCockpitState = {
  readonly overall: PlatformV7HealthSeverity;
  readonly areas: readonly PlatformV7HealthArea[];
  readonly incidents: readonly PlatformV7Incident[];
  readonly sourceMeta: {
    readonly source: 'controlled-pilot-runtime';
    readonly runtimeBound: true;
    readonly liveExternalIntegrations: false;
  };
};

function sev(critical: boolean, warning: boolean): PlatformV7HealthSeverity {
  return critical ? 'critical' : warning ? 'warning' : 'ok';
}

export function getPlatformV7ObservabilityCockpitState(): PlatformV7ObservabilityCockpitState {
  const deals = selectRuntimeDeals();
  const disputes = selectRuntimeDisputes();
  const active = deals.filter((d) => d.status !== 'closed');

  const integrationFails = active.filter((d) => selectDealIntegrationState(d).gateState === 'FAIL').length;
  const blockedDeals = active.filter((d) => (d.blockers ?? []).length > 0 || d.dispute).length;
  const holdRub = active.reduce((sum, d) => sum + (d.holdAmount ?? 0), 0);
  const transportBlocked = countTransportBlockedPacks();
  const transportAwaiting = countTransportAwaitingSignatures();
  const openDisputes = disputes.length;

  const areas: PlatformV7HealthArea[] = [
    {
      key: 'system',
      label: 'System Health',
      value: 'контур работает',
      severity: sev(false, transportAwaiting > 3),
      note: `${transportAwaiting} документов ждут подписи`,
    },
    {
      key: 'integration',
      label: 'Integration Health',
      value: integrationFails > 0 ? `${integrationFails} сбоев шлюза` : 'шлюзы в норме',
      severity: sev(integrationFails > 1, integrationFails === 1),
      note: 'внешние подключения — pre-integration (mock)',
    },
    {
      key: 'deal',
      label: 'Deal Runtime Health',
      value: `${blockedDeals} из ${active.length} с блокером`,
      severity: sev(blockedDeals > 2, blockedDeals > 0),
      note: 'сделки со стоп-фактором в контуре',
    },
    {
      key: 'money',
      label: 'Money Runtime Health',
      value: holdRub > 0 ? `${(holdRub / 1_000_000).toFixed(2)} млн ₽ под удержанием` : 'удержаний нет',
      severity: sev(holdRub > 1_000_000, holdRub > 0),
      note: `${openDisputes} открытых споров · ${transportBlocked} транспорт держит`,
    },
  ];

  const incidents: PlatformV7Incident[] = [
    ...active
      .filter((d) => selectDealIntegrationState(d).gateState === 'FAIL')
      .slice(0, 3)
      .map((d) => ({ id: `int-${d.id}`, severity: 'critical' as const, message: `${d.id}: шлюз интеграции не подтвердил сделку` })),
    ...disputes.slice(0, 3).map((d) => ({ id: `disp-${d.id}`, severity: 'critical' as const, message: `Спор ${d.id}: удержание активно до решения` })),
    ...(transportBlocked > 0 ? [{ id: 'tr-block', severity: 'warning' as const, message: `Транспорт держит ${transportBlocked} пакетов документов` }] : []),
  ];

  const overall: PlatformV7HealthSeverity = areas.some((a) => a.severity === 'critical')
    ? 'critical'
    : areas.some((a) => a.severity === 'warning')
      ? 'warning'
      : 'ok';

  return {
    overall,
    areas,
    incidents,
    sourceMeta: { source: 'controlled-pilot-runtime', runtimeBound: true, liveExternalIntegrations: false },
  };
}
