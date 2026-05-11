import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ACTION_FEEDBACK_PREVIEWS,
  IDEMPOTENCY_DESCRIPTIONS,
  getActionFeedbackPreview,
  type ActionFeedbackContext,
} from '../../lib/platform-v7/action-feedback-preview';
import { ActionFeedbackPreviewStrip } from '../../components/platform-v7/ActionFeedbackPreviewStrip';
import SellerPage from '../../app/platform-v7/seller/page';
import BuyerPage from '../../app/platform-v7/buyer/page';
import BankPage from '../../app/platform-v7/bank/page';
import DisputesPage from '../../app/platform-v7/disputes/page';

const ALL_CONTEXTS: ActionFeedbackContext[] = ['seller', 'buyer', 'bank', 'disputes'];

const FORBIDDEN_PATTERNS = [
  /production-ready/i,
  /fully live/i,
  /fully integrated/i,
  /live callback/i,
  /live-собы/i,
  /деньги переведены/i,
  /выплата выполнена/i,
  /деньги отправлены/i,
  /платформа выпускает деньги/i,
  /платформа гарантирует оплату/i,
  /real persistence/i,
  /append-only persistence is active/i,
  /bypass impossible/i,
  /fully protected/i,
  /no risks/i,
];

function assertNoForbiddenWording(text: string, label: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    expect(text, `${label} contains forbidden wording: ${pattern}`).not.toMatch(pattern);
  }
  expect(text).not.toContain('/platform-v7/demo/');
}

describe('action feedback preview data', () => {
  it('has entries for all required contexts', () => {
    expect(Object.keys(ACTION_FEEDBACK_PREVIEWS).sort()).toEqual([...ALL_CONTEXTS].sort());
  });

  it('every entry has required fields', () => {
    for (const context of ALL_CONTEXTS) {
      const preview = ACTION_FEEDBACK_PREVIEWS[context];

      expect(preview.actionLabel.length).toBeGreaterThan(0);
      expect(preview.whatHappensNext.length).toBeGreaterThan(0);
      expect(preview.auditDraft.length).toBeGreaterThan(0);
      expect(preview.idempotency).toMatch(/^(safe_to_retry|requires_confirmation|one_shot)$/);
      expect(preview.idempotencyLabel.length).toBeGreaterThan(0);
      expect(preview.responsibleRole.length).toBeGreaterThan(0);
      expect(preview.externalConfirmationBoundary.length).toBeGreaterThan(0);
      expect(preview.pilotNote.length).toBeGreaterThan(0);
    }
  });

  it('every pilot note states controlled pilot manual review boundaries', () => {
    for (const context of ALL_CONTEXTS) {
      const note = ACTION_FEEDBACK_PREVIEWS[context].pilotNote;
      expect(note.toLowerCase()).toContain('пилотный контур');
      expect(note.toLowerCase()).toContain('ручная проверка');
    }
  });

  it('uses stricter idempotency for bank and confirmation for buyer/disputes', () => {
    expect(ACTION_FEEDBACK_PREVIEWS.seller.idempotency).toBe('safe_to_retry');
    expect(ACTION_FEEDBACK_PREVIEWS.buyer.idempotency).toBe('requires_confirmation');
    expect(ACTION_FEEDBACK_PREVIEWS.bank.idempotency).toBe('one_shot');
    expect(ACTION_FEEDBACK_PREVIEWS.disputes.idempotency).toBe('requires_confirmation');
  });

  it('idempotency descriptions cover all values', () => {
    expect(IDEMPOTENCY_DESCRIPTIONS.safe_to_retry).toBeTruthy();
    expect(IDEMPOTENCY_DESCRIPTIONS.requires_confirmation).toBeTruthy();
    expect(IDEMPOTENCY_DESCRIPTIONS.one_shot).toBeTruthy();
  });

  it('getActionFeedbackPreview returns the correct context record', () => {
    for (const context of ALL_CONTEXTS) {
      expect(getActionFeedbackPreview(context)).toBe(ACTION_FEEDBACK_PREVIEWS[context]);
    }
  });

  it('data avoids unsafe wording and fake runtime claims', () => {
    assertNoForbiddenWording(JSON.stringify(ACTION_FEEDBACK_PREVIEWS), 'ACTION_FEEDBACK_PREVIEWS');
  });
});

describe('ActionFeedbackPreviewStrip component', () => {
  for (const context of ALL_CONTEXTS) {
    it(`renders full preview structure for ${context}`, () => {
      const { container } = render(React.createElement(ActionFeedbackPreviewStrip, { context }));

      expect(screen.getByTestId('platform-v7-action-feedback-preview-strip')).toBeDefined();
      expect(screen.getByTestId('platform-v7-action-feedback-what-next')).toBeDefined();
      expect(screen.getByTestId('platform-v7-action-feedback-audit-draft')).toBeDefined();
      expect(screen.getByTestId('platform-v7-action-feedback-responsible')).toBeDefined();
      expect(screen.getByTestId('platform-v7-action-feedback-external-boundary')).toBeDefined();
      expect(screen.getByTestId('platform-v7-action-feedback-pilot-note')).toBeDefined();
      expect(screen.getByTestId('platform-v7-action-feedback-idempotency-badge')).toBeDefined();
      assertNoForbiddenWording(container.textContent ?? '', `${context} component`);
    });
  }

  it('renders mobile-safe dense text containers', () => {
    render(React.createElement(ActionFeedbackPreviewStrip, { context: 'bank' }));

    const container = screen.getByTestId('platform-v7-action-feedback-preview-strip');
    const badge = screen.getByTestId('platform-v7-action-feedback-idempotency-badge');
    const boundary = screen.getByTestId('platform-v7-action-feedback-external-boundary');

    expect(container.style.minWidth).toBe('0px');
    expect(badge.style.whiteSpace).toBe('normal');
    expect(boundary.style.minWidth).toBe('0px');
  });
});

describe('ActionFeedbackPreviewStrip page placement', () => {
  it('seller page renders the preview strip without demo route leakage', () => {
    const { container } = render(React.createElement(SellerPage));

    expect(screen.getByTestId('platform-v7-action-feedback-preview-strip')).toBeDefined();
    assertNoForbiddenWording(container.textContent ?? '', 'seller page');
  });

  it('buyer page renders the preview strip without demo route leakage', () => {
    const { container } = render(React.createElement(BuyerPage));

    expect(screen.getByTestId('platform-v7-action-feedback-preview-strip')).toBeDefined();
    assertNoForbiddenWording(container.textContent ?? '', 'buyer page');
  });

  it('bank page renders the preview strip without fake payout claims', () => {
    const { container } = render(React.createElement(BankPage));

    expect(screen.getByTestId('platform-v7-action-feedback-preview-strip')).toBeDefined();
    assertNoForbiddenWording(container.textContent ?? '', 'bank page');
  });

  it('disputes page renders the preview strip without fake persistence claims', () => {
    const { container } = render(React.createElement(DisputesPage));

    expect(screen.getByTestId('platform-v7-action-feedback-preview-strip')).toBeDefined();
    assertNoForbiddenWording(container.textContent ?? '', 'disputes page');
  });
});
