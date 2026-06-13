import { PLATFORM_V7_EXECUTION_SOURCE, formatRub } from '../deal-execution-source-of-truth';

// VP-7: Dispute / evidence binding.
// Спор удерживает сумму через runtime-источник, evidence pack собирается из
// audit sink. Без активного спора удержание = 0 (честное состояние рантайма).

export type PlatformV7DisputeEvidenceItem = {
  readonly time: string;
  readonly actor: string;
  readonly action: string;
  readonly note: string;
  readonly status: string;
};

export type PlatformV7DisputeCockpitState = {
  readonly dealId: string;
  readonly active: boolean;
  readonly status: string;
  readonly holdReason: string;
  readonly heldRub: number;
  readonly heldLabel: string;
  readonly arbitratorNeeded: boolean;
  readonly evidenceCount: number;
  readonly evidencePack: readonly PlatformV7DisputeEvidenceItem[];
  readonly sourceMeta: {
    readonly source: 'controlled-pilot-runtime';
    readonly runtimeBound: true;
    readonly liveExternalIntegrations: false;
  };
};

export function getPlatformV7DisputeCockpitState(): PlatformV7DisputeCockpitState {
  const { deal, dispute, money, audit } = PLATFORM_V7_EXECUTION_SOURCE;
  const active = dispute.status !== 'готово' || dispute.arbitratorNeeded || money.holdRub > 0;

  return {
    dealId: deal.id,
    active,
    status: active ? dispute.status : 'нет активного спора',
    holdReason: dispute.holdReason,
    heldRub: money.holdRub,
    heldLabel: formatRub(money.holdRub),
    arbitratorNeeded: dispute.arbitratorNeeded,
    evidenceCount: dispute.evidenceCount,
    // Evidence pack собирается из audit sink (статусные события сделки).
    evidencePack: audit.map((event) => ({
      time: event.time,
      actor: event.actor,
      action: event.action,
      note: event.note,
      status: event.status,
    })),
    sourceMeta: {
      source: 'controlled-pilot-runtime',
      runtimeBound: true,
      liveExternalIntegrations: false,
    },
  };
}
