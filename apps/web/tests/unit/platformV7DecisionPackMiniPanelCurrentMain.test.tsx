import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionPackMiniPanel } from '../../components/platform-v7/DecisionPackMiniPanel';
import {
  DECISION_PACK_CONTEXTS,
  DECISION_PACK_CONTEXT_LABEL,
  DECISION_PACK_DATA,
  getBlockedRows,
  getDecisionPackRows,
  type DecisionPackContext,
} from '../../lib/platform-v7/document-money-decision-pack';

const FORBIDDEN = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /legally approved/i,
  /legal finality/i,
  /bank confirmed/i,
  /money transferred/i,
  /payout completed/i,
  /platform releases money by itself/i,
  /platform guarantees payment/i,
  /dispute legally resolved/i,
  /bypass impossible/i,
  /no risks/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /платформа выпускает деньги/i,
  /платформа гарантирует оплату/i,
  /нет рисков/i,
];

function assertNoForbidden(text: string, label: string) {
  for (const pattern of FORBIDDEN) {
    expect(text, `${label} contains forbidden wording: ${pattern}`).not.toMatch(pattern);
  }
  expect(text).not.toContain('/platform-v7/demo/');
}

describe('document money decision pack data', () => {
  it('exports the required contexts', () => {
    expect([...DECISION_PACK_CONTEXTS].sort()).toEqual(
      [
        'bank_release_review',
        'buyer_reserve_request',
        'dl9102_dispute_hold',
        'dl9106_payout_review',
        'seller_document_handoff',
      ].sort(),
    );
  });

  it('locks the user-facing context labels', () => {
    expect(DECISION_PACK_CONTEXT_LABEL).toEqual({
      bank_release_review: 'банк · условия выплаты',
      buyer_reserve_request: 'покупатель · запрос резерва',
      dl9102_dispute_hold: 'DL-9102 · спор и удержание',
      dl9106_payout_review: 'DL-9106 · проверка выплаты',
      seller_document_handoff: 'продавец · передача документов',
    });
  });

  it('each context has at least one row', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      expect(getDecisionPackRows(context).length, `${context} should have rows`).toBeGreaterThan(0);
    }
  });

  it('row ids are unique per context', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      const ids = getDecisionPackRows(context).map((row) => row.rowId);
      expect(new Set(ids).size, `${context} has duplicate row ids`).toBe(ids.length);
    }
  });

  it('every row has money impact, operational reason, and safe next action', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getDecisionPackRows(context)) {
        expect(row.moneyImpactLabel.length).toBeGreaterThan(10);
        expect(row.operationalReason.length).toBeGreaterThan(10);
        expect(row.safeNextAction.length).toBeGreaterThan(10);
        expect(row.pilotNote).toContain('контролируемый пилот');
        expect(row.pilotNote).toContain('ручная проверка');
      }
    }
  });

  it('blocked rows have a blocker and responsible role', () => {
    for (const context of DECISION_PACK_CONTEXTS) {
      for (const row of getBlockedRows(context)) {
        expect(row.blocker, `${context}/${row.rowId} missing blocker`).toBeTruthy();
        expect(row.responsibleRole.length).toBeGreaterThan(0);
      }
    }
  });

  it('data avoids unsafe wording', () => {
    assertNoForbidden(JSON.stringify(DECISION_PACK_DATA), 'DECISION_PACK_DATA');
  });
});

describe('DecisionPackMiniPanel component', () => {
  for (const context of DECISION_PACK_CONTEXTS) {
    it(`renders decision pack for ${context}`, () => {
      const { container } = render(React.createElement(DecisionPackMiniPanel, { context: context as DecisionPackContext }));
      const rows = getDecisionPackRows(context as DecisionPackContext);

      expect(screen.getByTestId('platform-v7-decision-pack-mini-panel')).toBeDefined();
      expect(screen.getByTestId('platform-v7-decision-pack-disclaimer')).toHaveTextContent('ручная проверка');
      expect(screen.getAllByTestId('platform-v7-decision-pack-row')).toHaveLength(rows.length);
      expect(screen.getAllByTestId('platform-v7-decision-pack-document')).toHaveLength(rows.length);
      expect(screen.getAllByTestId('platform-v7-decision-pack-money')).toHaveLength(rows.length);
      expect(screen.getAllByTestId('platform-v7-decision-pack-reason')).toHaveLength(rows.length);
      expect(screen.getAllByTestId('platform-v7-decision-pack-next')).toHaveLength(rows.length);
      assertNoForbidden(container.textContent ?? '', `${context} rendered text`);
    });
  }

  it('renders mobile-safe rows container and dense cells', () => {
    render(React.createElement(DecisionPackMiniPanel, { context: 'bank_release_review' }));

    const panel = screen.getByTestId('platform-v7-decision-pack-mini-panel');
    const rows = screen.getByTestId('platform-v7-decision-pack-rows');
    const firstRow = screen.getAllByTestId('platform-v7-decision-pack-row')[0];
    const firstDocument = screen.getAllByTestId('platform-v7-decision-pack-document')[0];
    const firstMoney = screen.getAllByTestId('platform-v7-decision-pack-money')[0];
    const firstReason = screen.getAllByTestId('platform-v7-decision-pack-reason')[0];
    const firstNext = screen.getAllByTestId('platform-v7-decision-pack-next')[0];

    expect(panel.style.minWidth).toBe('0px');
    expect(rows.style.gridTemplateColumns).toContain('auto-fit');
    expect(firstRow.style.minWidth).toBe('0px');
    expect(firstDocument.style.overflowWrap).toBe('anywhere');
    expect(firstMoney.style.overflowWrap).toBe('anywhere');
    expect(firstReason.style.overflowWrap).toBe('anywhere');
    expect(firstNext.style.overflowWrap).toBe('anywhere');
  });
});
