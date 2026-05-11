import { describe, expect, it } from 'vitest';
import {
  DECISION_PILOT_STATE_LABEL,
  DECISION_RECOMMENDATION_DATA,
  getDecisionRecommendation,
  isDecisionReadyForAction,
} from '@/lib/platform-v7/decision-recommendation';

const FORBIDDEN_PATTERNS = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /платформа гарантирует оплату/i,
  /платформа выпускает деньги/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /bypass impossible/i,
  /fully protected/i,
  /no risks/i,
  /автоматический выпуск платформой/i,
];

function assertNoForbiddenWording(text: string, label: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    expect(text, `${label} contains forbidden wording: ${pattern}`).not.toMatch(pattern);
  }
  expect(text).not.toContain('/platform-v7/demo/');
}

describe('decision-recommendation data', () => {
  it('exports state labels for all three states', () => {
    expect(DECISION_PILOT_STATE_LABEL.awaiting_evidence).toBeTruthy();
    expect(DECISION_PILOT_STATE_LABEL.requires_manual_review).toBeTruthy();
    expect(DECISION_PILOT_STATE_LABEL.ready_for_decision).toBeTruthy();
  });

  it('every context has all required fields', () => {
    for (const context of ['disputes', 'bank', 'elevator'] as const) {
      const rec = DECISION_RECOMMENDATION_DATA[context];
      expect(rec.recommendation.length).toBeGreaterThan(0);
      expect(rec.responsible.length).toBeGreaterThan(0);
      expect(rec.requiredEvidence.length).toBeGreaterThan(0);
      expect(rec.cannotProceedBecause.length).toBeGreaterThan(0);
      expect(rec.pilotState).toMatch(/^(awaiting_evidence|requires_manual_review|ready_for_decision)$/);
      expect(rec.pilotStateLabel).toBe(DECISION_PILOT_STATE_LABEL[rec.pilotState]);
    }
  });

  it('no context is ready for decision in current pilot state', () => {
    expect(isDecisionReadyForAction('disputes')).toBe(false);
    expect(isDecisionReadyForAction('bank')).toBe(false);
    expect(isDecisionReadyForAction('elevator')).toBe(false);
  });

  it('getDecisionRecommendation returns the correct record per context', () => {
    expect(getDecisionRecommendation('disputes')).toBe(DECISION_RECOMMENDATION_DATA.disputes);
    expect(getDecisionRecommendation('bank')).toBe(DECISION_RECOMMENDATION_DATA.bank);
    expect(getDecisionRecommendation('elevator')).toBe(DECISION_RECOMMENDATION_DATA.elevator);
  });

  it('disputes requires act and quality protocol evidence', () => {
    const { requiredEvidence } = DECISION_RECOMMENDATION_DATA.disputes;
    const joined = requiredEvidence.join(' ');
    expect(joined).toContain('протокол качества');
    expect(joined).toContain('акт расхождения');
  });

  it('bank requires SDIZ, ETrN, and protocol', () => {
    const { requiredEvidence } = DECISION_RECOMMENDATION_DATA.bank;
    const joined = requiredEvidence.join(' ');
    expect(joined).toContain('СДИЗ');
    expect(joined).toContain('ЭТрН');
    expect(joined).toContain('протокол качества');
  });

  it('elevator requires act and quality protocol', () => {
    const { requiredEvidence } = DECISION_RECOMMENDATION_DATA.elevator;
    const joined = requiredEvidence.join(' ');
    expect(joined).toContain('акт приёмки');
    expect(joined).toContain('протокол качества');
  });

  it('all data avoids forbidden wording', () => {
    const serialised = JSON.stringify(DECISION_RECOMMENDATION_DATA);
    assertNoForbiddenWording(serialised, 'DECISION_RECOMMENDATION_DATA');
  });

  it('cannotProceedBecause uses controlled-pilot language for each context', () => {
    const disputeReason = DECISION_RECOMMENDATION_DATA.disputes.cannotProceedBecause;
    const bankReason = DECISION_RECOMMENDATION_DATA.bank.cannotProceedBecause;
    const elevatorReason = DECISION_RECOMMENDATION_DATA.elevator.cannotProceedBecause;

    expect(disputeReason).toMatch(/ручная проверка|ожидает|не получен|не подписан/i);
    expect(bankReason).toMatch(/ручная проверка|не продолжается|не закрыты|остановлена/i);
    expect(elevatorReason).toMatch(/ручная проверка|не подписан|не оформлен|остаётся/i);
  });
});
