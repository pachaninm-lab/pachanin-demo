export type CounterpartyRiskLevel = 'low' | 'medium' | 'elevated';

export type CounterpartyParty = 'seller' | 'buyer';

export type CounterpartyRiskContext = 'seller' | 'buyer' | 'bank';

export interface CounterpartyRiskSignal {
  readonly party: CounterpartyParty;
  readonly partyLabel: string;
  readonly riskLevel: CounterpartyRiskLevel;
  readonly reason: string;
  readonly requiredCheck: string;
  readonly effectOnPayment?: string;
  readonly effectOnLogistics?: string;
  readonly effectOnDocuments?: string;
  readonly nextSafeAction: string;
}

export const COUNTERPARTY_RISK_LEVEL_LABEL: Record<CounterpartyRiskLevel, string> = {
  low: 'Низкий риск',
  medium: 'Средний риск',
  elevated: 'Повышенный риск — ручная проверка',
};

export const COUNTERPARTY_RISK_SIGNALS: Record<CounterpartyParty, CounterpartyRiskSignal> = {
  seller: {
    party: 'seller',
    partyLabel: 'Продавец',
    riskLevel: 'medium',
    reason: 'СДИЗ не закрыт, ЭТрН не передан — доказательный пакет неполный',
    requiredCheck: 'закрыть СДИЗ в ФГИС «Зерно» и передать транспортный документ (ЭТрН)',
    effectOnPayment: 'банковская проверка выплаты не продолжается до закрытия документов',
    effectOnDocuments: 'пакет документов неполный — СДИЗ и ЭТрН в работе',
    nextSafeAction: 'закрыть СДИЗ и ЭТрН для передачи сделки на банковскую проверку',
  },
  buyer: {
    party: 'buyer',
    partyLabel: 'Покупатель',
    riskLevel: 'medium',
    reason: 'банковское подтверждение резерва ожидается — сделка не переходит к логистике',
    requiredCheck: 'получить банковское подтверждение резерва по DL-9106',
    effectOnPayment: 'резерв отмечен в пилотном контуре — банковское подтверждение ожидается',
    effectOnLogistics: 'логистика не разворачивается до банковского подтверждения резерва',
    nextSafeAction: 'запросить банковское подтверждение резерва по сделке DL-9106',
  },
};

export const COUNTERPARTY_RISK_CONTEXT_SIGNALS: Record<CounterpartyRiskContext, readonly CounterpartyRiskSignal[]> = {
  seller: [COUNTERPARTY_RISK_SIGNALS.seller, COUNTERPARTY_RISK_SIGNALS.buyer],
  buyer: [COUNTERPARTY_RISK_SIGNALS.buyer, COUNTERPARTY_RISK_SIGNALS.seller],
  bank: [COUNTERPARTY_RISK_SIGNALS.seller, COUNTERPARTY_RISK_SIGNALS.buyer],
};

export function getCounterpartyRiskSignals(context: CounterpartyRiskContext): readonly CounterpartyRiskSignal[] {
  return COUNTERPARTY_RISK_CONTEXT_SIGNALS[context];
}

export function hasElevatedRisk(context: CounterpartyRiskContext): boolean {
  return COUNTERPARTY_RISK_CONTEXT_SIGNALS[context].some((s) => s.riskLevel === 'elevated');
}

export function getOverallRiskLevel(context: CounterpartyRiskContext): CounterpartyRiskLevel {
  const signals = COUNTERPARTY_RISK_CONTEXT_SIGNALS[context];
  if (signals.some((s) => s.riskLevel === 'elevated')) return 'elevated';
  if (signals.some((s) => s.riskLevel === 'medium')) return 'medium';
  return 'low';
}
