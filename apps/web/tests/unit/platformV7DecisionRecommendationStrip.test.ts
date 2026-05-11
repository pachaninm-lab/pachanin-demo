import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import DisputesPage from '@/app/platform-v7/disputes/page';
import BankPage from '@/app/platform-v7/bank/page';
import ElevatorPage from '@/app/platform-v7/elevator/page';
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
  /best in the world/i,
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

describe('DecisionRecommendationStrip component', () => {
  it('renders disputes recommendation with responsible role and blocker reason', () => {
    const { container } = render(React.createElement(DecisionRecommendationStrip, { context: 'disputes' }));

    expect(screen.getByTestId('platform-v7-decision-recommendation-strip')).toBeInTheDocument();
    expect(screen.getByTestId('platform-v7-decision-recommendation-strip-state')).toHaveTextContent('Ожидает доказательств');
    expect(screen.getByTestId('platform-v7-decision-recommendation-strip-responsible')).toHaveTextContent('оператор / лаборатория');
    expect(screen.getByTestId('platform-v7-decision-recommendation-strip-blocker')).toHaveTextContent('ручной проверке');
    assertNoForbiddenWording(container.innerHTML, 'disputes strip');
  });

  it('renders bank recommendation with evidence pills and safe wording', () => {
    const { container } = render(React.createElement(DecisionRecommendationStrip, { context: 'bank' }));

    expect(screen.getByTestId('platform-v7-decision-recommendation-strip-recommendation')).toHaveTextContent('банковскую проверку выплаты');
    expect(container.innerHTML).toContain('СДИЗ');
    expect(container.innerHTML).toContain('ЭТрН');
    expect(container.innerHTML).toContain('акт приёмки');
    assertNoForbiddenWording(container.innerHTML, 'bank strip');
  });

  it('renders elevator recommendation with acceptance and lab evidence', () => {
    const { container } = render(React.createElement(DecisionRecommendationStrip, { context: 'elevator' }));

    expect(screen.getByTestId('platform-v7-decision-recommendation-strip-recommendation')).toHaveTextContent('Зафиксировать вес');
    expect(container.innerHTML).toContain('акт приёмки');
    expect(container.innerHTML).toContain('пилотный протокол качества');
    assertNoForbiddenWording(container.innerHTML, 'elevator strip');
  });
});

describe('DecisionRecommendationStrip page placement', () => {
  it('disputes page renders the decision strip without demo links or unsafe wording', () => {
    const { container } = render(React.createElement(DisputesPage));

    expect(screen.getByTestId('platform-v7-decision-recommendation-strip')).toBeInTheDocument();
    assertNoForbiddenWording(container.innerHTML, 'disputes page');
  });

  it('bank page renders the decision strip without demo links or unsafe wording', () => {
    const { container } = render(React.createElement(BankPage));

    expect(screen.getByTestId('platform-v7-decision-recommendation-strip')).toBeInTheDocument();
    assertNoForbiddenWording(container.innerHTML, 'bank page');
  });

  it('elevator page renders the decision strip without demo links or unsafe wording', () => {
    const { container } = render(React.createElement(ElevatorPage));

    expect(screen.getByTestId('platform-v7-decision-recommendation-strip')).toBeInTheDocument();
    assertNoForbiddenWording(container.innerHTML, 'elevator page');
  });
});
