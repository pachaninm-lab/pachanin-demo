import { PLATFORM_V7_EXECUTION_SOURCE, canRequestMoneyRelease, formatRub } from '../deal-execution-source-of-truth';

// VP-6: Bank cockpit binding.
// Сумма, основание, документы, журнал и состояние запроса на выплату выводятся
// из runtime-источника исполнения. Инвариант Stage 4/5: деньги не двигаются без
// банковского события — releasedRub всегда 0 до подтверждения банка.

export type PlatformV7BankBasisStatus = 'not-ready' | 'ready-for-bank';

export type PlatformV7BankJournalEntry = {
  readonly time: string;
  readonly actor: string;
  readonly action: string;
  readonly note: string;
};

export type PlatformV7BankCockpitState = {
  readonly dealId: string;
  readonly reservedRub: number;
  readonly heldRub: number;
  readonly releasedRub: number;
  readonly reservedLabel: string;
  readonly releasedLabel: string;
  readonly basisStatus: PlatformV7BankBasisStatus;
  readonly basisLabel: string;
  readonly missingDocuments: readonly string[];
  readonly canRequestRelease: boolean;
  readonly bankDecision: string;
  readonly journal: readonly PlatformV7BankJournalEntry[];
  readonly sourceMeta: {
    readonly source: 'controlled-pilot-runtime';
    readonly runtimeBound: true;
    readonly liveExternalIntegrations: false;
  };
};

export function getPlatformV7BankCockpitState(): PlatformV7BankCockpitState {
  const { deal, money, documents, audit } = PLATFORM_V7_EXECUTION_SOURCE;
  const canRequestRelease = canRequestMoneyRelease();

  return {
    dealId: deal.id,
    reservedRub: money.reservedRub,
    heldRub: money.holdRub,
    // Инвариант: без банковского события деньги не выпущены.
    releasedRub: 0,
    reservedLabel: formatRub(money.reservedRub),
    releasedLabel: formatRub(0),
    basisStatus: canRequestRelease ? 'ready-for-bank' : 'not-ready',
    basisLabel: canRequestRelease
      ? 'основание собрано — можно передать банку на проверку'
      : 'основание не готово — условия не закрыты',
    missingDocuments: documents.missingDocuments,
    canRequestRelease,
    bankDecision: money.bankDecision,
    journal: audit.map((event) => ({
      time: event.time,
      actor: event.actor,
      action: event.action,
      note: event.note,
    })),
    sourceMeta: {
      source: 'controlled-pilot-runtime',
      runtimeBound: true,
      liveExternalIntegrations: false,
    },
  };
}
