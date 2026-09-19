export type DecisionRecommendationState =
  | 'awaiting_evidence'
  | 'requires_manual_review'
  | 'ready_for_decision';

export type DecisionRecommendationContext = 'disputes' | 'bank' | 'elevator';

export interface DecisionRecommendationRecord {
  readonly recommendation: string;
  readonly responsible: string;
  readonly requiredEvidence: readonly string[];
  readonly cannotProceedBecause: string;
  readonly pilotState: DecisionRecommendationState;
  readonly pilotStateLabel: string;
}

export const DECISION_PILOT_STATE_LABEL: Record<DecisionRecommendationState, string> = {
  awaiting_evidence: 'Ожидает доказательств',
  requires_manual_review: 'Ручная проверка оператором',
  ready_for_decision: 'Готово к решению',
};

export const DECISION_RECOMMENDATION_DATA: Record<DecisionRecommendationContext, DecisionRecommendationRecord> = {
  disputes: {
    recommendation: 'Запросить подписанный акт расхождения и пилотный протокол качества, затем передать рекомендацию оператору',
    responsible: 'оператор / лаборатория',
    requiredEvidence: ['акт расхождения (DSP-9102-WEIGHT)', 'протокол качества (DL-9106)', 'весовая ведомость', 'акт приёмки'],
    cannotProceedBecause: 'акт расхождения не подписан и протокол качества ещё не получен — решение по спорной сумме остаётся на ручной проверке оператором',
    pilotState: 'awaiting_evidence',
    pilotStateLabel: DECISION_PILOT_STATE_LABEL.awaiting_evidence,
  },
  bank: {
    recommendation: 'Ожидать закрытия всех условий до передачи на банковскую проверку выплаты',
    responsible: 'оператор и ответственный за документ',
    requiredEvidence: ['СДИЗ', 'ЭТрН', 'акт приёмки', 'пилотный протокол качества'],
    cannotProceedBecause: 'банковская проверка выплаты не продолжается — СДИЗ, ЭТрН, акт приёмки и протокол качества не закрыты',
    pilotState: 'awaiting_evidence',
    pilotStateLabel: DECISION_PILOT_STATE_LABEL.awaiting_evidence,
  },
  elevator: {
    recommendation: 'Зафиксировать вес, подписать акт приёмки и передать пробу в лабораторный контур качества',
    responsible: 'элеватор / лаборатория',
    requiredEvidence: ['акт приёмки', 'акт расхождения (-1,2 т)', 'пилотный протокол качества'],
    cannotProceedBecause: 'акт приёмки не подписан, акт расхождения не оформлен — удержание остаётся на ручной проверке до закрытия оснований',
    pilotState: 'awaiting_evidence',
    pilotStateLabel: DECISION_PILOT_STATE_LABEL.awaiting_evidence,
  },
};

export function getDecisionRecommendation(context: DecisionRecommendationContext): DecisionRecommendationRecord {
  return DECISION_RECOMMENDATION_DATA[context];
}

export function isDecisionReadyForAction(context: DecisionRecommendationContext): boolean {
  return DECISION_RECOMMENDATION_DATA[context].pilotState === 'ready_for_decision';
}
