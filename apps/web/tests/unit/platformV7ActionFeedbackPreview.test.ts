import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ACTION_FEEDBACK_PREVIEWS,
  IDEMPOTENCY_DESCRIPTIONS,
  getActionFeedbackPreview,
  type ActionFeedbackContext,
} from '../../lib/platform-v7/action-feedback-preview';
import { ActionFeedbackPreviewStrip } from '../../components/platform-v7/ActionFeedbackPreviewStrip';

const ALL_CONTEXTS: ActionFeedbackContext[] = ['seller', 'buyer', 'bank', 'disputes'];

const FORBIDDEN_PATTERNS = [
  'production-ready',
  'fully live',
  'live callback',
  'деньги переведены',
  'bypass impossible',
  'fully protected',
  'автоматически переводятся',
  'гарантирует выплату',
];

function assertNoForbiddenWording(text: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    expect(text.toLowerCase()).not.toContain(pattern.toLowerCase());
  }
}

describe('action-feedback-preview data', () => {
  it('has entries for all 4 contexts', () => {
    expect(Object.keys(ACTION_FEEDBACK_PREVIEWS)).toHaveLength(4);
    for (const ctx of ALL_CONTEXTS) {
      expect(ACTION_FEEDBACK_PREVIEWS[ctx]).toBeDefined();
    }
  });

  it('every entry has all required fields', () => {
    for (const ctx of ALL_CONTEXTS) {
      const preview = ACTION_FEEDBACK_PREVIEWS[ctx];
      expect(preview.actionLabel).toBeTruthy();
      expect(preview.whatHappensNext).toBeTruthy();
      expect(preview.auditDraft).toBeTruthy();
      expect(preview.idempotency).toMatch(/^(safe_to_retry|requires_confirmation|one_shot)$/);
      expect(preview.idempotencyLabel).toBeTruthy();
      expect(preview.responsibleRole).toBeTruthy();
      expect(preview.externalConfirmationBoundary).toBeTruthy();
      expect(preview.pilotNote).toBeTruthy();
    }
  });

  it('every pilotNote references пилотный контур', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(ACTION_FEEDBACK_PREVIEWS[ctx].pilotNote.toLowerCase()).toContain('пилотный контур');
    }
  });

  it('every pilotNote references ручная проверка', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(ACTION_FEEDBACK_PREVIEWS[ctx].pilotNote.toLowerCase()).toContain('ручная проверка');
    }
  });

  it('bank context is one_shot idempotency', () => {
    expect(ACTION_FEEDBACK_PREVIEWS['bank'].idempotency).toBe('one_shot');
  });

  it('seller context is safe_to_retry', () => {
    expect(ACTION_FEEDBACK_PREVIEWS['seller'].idempotency).toBe('safe_to_retry');
  });

  it('buyer and disputes require confirmation', () => {
    expect(ACTION_FEEDBACK_PREVIEWS['buyer'].idempotency).toBe('requires_confirmation');
    expect(ACTION_FEEDBACK_PREVIEWS['disputes'].idempotency).toBe('requires_confirmation');
  });

  it('getActionFeedbackPreview returns correct record', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(getActionFeedbackPreview(ctx)).toStrictEqual(ACTION_FEEDBACK_PREVIEWS[ctx]);
    }
  });

  it('IDEMPOTENCY_DESCRIPTIONS covers all 3 levels', () => {
    expect(IDEMPOTENCY_DESCRIPTIONS['safe_to_retry']).toBeTruthy();
    expect(IDEMPOTENCY_DESCRIPTIONS['requires_confirmation']).toBeTruthy();
    expect(IDEMPOTENCY_DESCRIPTIONS['one_shot']).toBeTruthy();
  });

  it('externalConfirmationBoundary does not claim automatic live execution', () => {
    for (const ctx of ALL_CONTEXTS) {
      const text = ACTION_FEEDBACK_PREVIEWS[ctx].externalConfirmationBoundary;
      assertNoForbiddenWording(text);
    }
  });

  it('no forbidden wording anywhere in data', () => {
    for (const ctx of ALL_CONTEXTS) {
      const preview = ACTION_FEEDBACK_PREVIEWS[ctx];
      const allText = [
        preview.actionLabel,
        preview.whatHappensNext,
        preview.auditDraft,
        preview.idempotencyLabel,
        preview.responsibleRole,
        preview.externalConfirmationBoundary,
        preview.pilotNote,
      ].join(' ');
      assertNoForbiddenWording(allText);
    }
  });
});

describe('ActionFeedbackPreviewStrip component', () => {
  for (const ctx of ALL_CONTEXTS) {
    it(`renders container for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      expect(screen.getByTestId('platform-v7-action-feedback-preview-strip')).toBeDefined();
    });

    it(`renders what-next section for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      expect(screen.getByTestId('platform-v7-action-feedback-what-next')).toBeDefined();
    });

    it(`renders audit-draft section for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      expect(screen.getByTestId('platform-v7-action-feedback-audit-draft')).toBeDefined();
    });

    it(`renders responsible role for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      expect(screen.getByTestId('platform-v7-action-feedback-responsible')).toBeDefined();
      const responsible = screen.getByTestId('platform-v7-action-feedback-responsible');
      expect(responsible.textContent).toContain(ACTION_FEEDBACK_PREVIEWS[ctx].responsibleRole);
    });

    it(`renders external boundary section for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      expect(screen.getByTestId('platform-v7-action-feedback-external-boundary')).toBeDefined();
    });

    it(`renders pilot note for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      expect(screen.getByTestId('platform-v7-action-feedback-pilot-note')).toBeDefined();
      const note = screen.getByTestId('platform-v7-action-feedback-pilot-note');
      expect(note.textContent).toContain('пилотный контур');
    });

    it(`renders idempotency badge for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      expect(screen.getByTestId('platform-v7-action-feedback-idempotency-badge')).toBeDefined();
    });

    it(`no forbidden wording in rendered DOM for context: ${ctx}`, () => {
      render(React.createElement(ActionFeedbackPreviewStrip, { context: ctx }));
      const container = screen.getByTestId('platform-v7-action-feedback-preview-strip');
      assertNoForbiddenWording(container.textContent ?? '');
    });
  }
});
