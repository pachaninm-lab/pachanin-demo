/**
 * ActionGuardPreviewMatrix tests — platform-v7.
 *
 * Tests guard preview data integrity and component rendering.
 * Preview-only: no real mutation claims are allowed.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ActionGuardPreviewMatrix } from '../../components/platform-v7/ActionGuardPreviewMatrix';
import {
  getGuardRows,
  getBlockedGuardRows,
  getAllowedGuardRows,
  ACTION_GUARD_CONTEXTS,
  ACTION_GUARD_CONTEXT_LABEL,
  type ActionGuardContext,
} from '../../lib/platform-v7/action-guard-preview';

afterEach(() => cleanup());

const FORBIDDEN_WORDING = [
  'production-ready',
  'fully live',
  'fully integrated',
  'live callback',
  'real persistence',
  'bank confirmed',
  'money transferred',
  'payout completed',
  'platform releases money by itself',
  'platform guarantees payment',
  'bypass impossible',
  'деньги переведены',
  'выплата выполнена',
];

const VALID_GUARD_RESULTS = ['allowed', 'blocked', 'partial'] as const;

// ─── Data integrity ───────────────────────────────────────────────────────────

describe('action guard preview data — integrity', () => {
  it('covers all 5 contexts', () => {
    expect(ACTION_GUARD_CONTEXTS).toHaveLength(5);
    expect(ACTION_GUARD_CONTEXTS).toContain('seller');
    expect(ACTION_GUARD_CONTEXTS).toContain('buyer');
    expect(ACTION_GUARD_CONTEXTS).toContain('bank');
    expect(ACTION_GUARD_CONTEXTS).toContain('disputes');
    expect(ACTION_GUARD_CONTEXTS).toContain('elevator');
  });

  it('every context has at least one guard row', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      const rows = getGuardRows(context);
      expect(rows.length, `Context "${context}" must have at least one guard row`).toBeGreaterThanOrEqual(1);
    }
  });

  it('elevator context has 2 rows (acceptance + quality protocol)', () => {
    expect(getGuardRows('elevator')).toHaveLength(2);
  });

  it('every row has required fields', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      for (const row of getGuardRows(context)) {
        expect(row.actionId, `actionId missing in ${context}`).toBeTruthy();
        expect(row.actionLabel, `actionLabel missing for ${row.actionId}`).toBeTruthy();
        expect(row.guardResultLabel, `guardResultLabel missing for ${row.actionId}`).toBeTruthy();
        expect(row.stopReason, `stopReason missing for ${row.actionId}`).toBeTruthy();
        expect(row.actorRole, `actorRole missing for ${row.actionId}`).toBeTruthy();
        expect(row.externalBoundary, `externalBoundary missing for ${row.actionId}`).toBeTruthy();
        expect(row.safeFallback, `safeFallback missing for ${row.actionId}`).toBeTruthy();
        expect(row.pilotNote, `pilotNote missing for ${row.actionId}`).toBeTruthy();
        expect(row.requiredEvidence.length, `requiredEvidence must not be empty for ${row.actionId}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every row has a valid guard result', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      for (const row of getGuardRows(context)) {
        expect(
          (VALID_GUARD_RESULTS as readonly string[]).includes(row.guardResult),
          `Row "${row.actionId}" has invalid guardResult: "${row.guardResult}"`,
        ).toBe(true);
      }
    }
  });

  it('missingEvidence is a subset of requiredEvidence', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      for (const row of getGuardRows(context)) {
        const required = new Set(row.requiredEvidence);
        for (const missing of row.missingEvidence) {
          expect(
            required.has(missing),
            `Row "${row.actionId}": missing evidence "${missing}" not in requiredEvidence`,
          ).toBe(true);
        }
      }
    }
  });

  it('allowed rows have no missing evidence', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      for (const row of getAllowedGuardRows(context)) {
        expect(
          row.missingEvidence,
          `Allowed row "${row.actionId}" must have no missing evidence`,
        ).toHaveLength(0);
      }
    }
  });

  it('blocked and partial rows have missing evidence', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      const nonAllowed = getGuardRows(context).filter((r) => r.guardResult !== 'allowed');
      for (const row of nonAllowed) {
        expect(
          row.missingEvidence.length,
          `Non-allowed row "${row.actionId}" must have at least one missing evidence`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ─── Blocked / allowed samples ────────────────────────────────────────────────

describe('action guard preview data — blocked and allowed samples', () => {
  it('bank context has a blocked row', () => {
    const blocked = getBlockedGuardRows('bank');
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked[0].actionId).toBe('bank_review_release_conditions');
  });

  it('buyer context has an allowed row', () => {
    const allowed = getAllowedGuardRows('buyer');
    expect(allowed.length).toBeGreaterThanOrEqual(1);
    expect(allowed[0].actionId).toBe('buyer_request_reserve_confirmation');
  });

  it('seller context has a partial row', () => {
    const rows = getGuardRows('seller');
    const partial = rows.filter((r) => r.guardResult === 'partial');
    expect(partial.length).toBeGreaterThanOrEqual(1);
  });

  it('elevator context has both partial and allowed rows', () => {
    const rows = getGuardRows('elevator');
    const partial = rows.filter((r) => r.guardResult === 'partial');
    const allowed = rows.filter((r) => r.guardResult === 'allowed');
    expect(partial.length).toBeGreaterThanOrEqual(1);
    expect(allowed.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── No forbidden wording ─────────────────────────────────────────────────────

describe('action guard preview data — no forbidden wording', () => {
  it('no row contains forbidden production/live wording', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      for (const row of getGuardRows(context)) {
        const allText = [
          row.actionLabel,
          row.guardResultLabel,
          row.stopReason,
          row.actorRole,
          row.externalBoundary,
          row.safeFallback,
          row.pilotNote,
        ]
          .join(' ')
          .toLowerCase();
        for (const word of FORBIDDEN_WORDING) {
          expect(
            allText,
            `Row "${row.actionId}": must not contain "${word}"`,
          ).not.toContain(word.toLowerCase());
        }
      }
    }
  });

  it('every pilot note contains guard-предпросмотр and контролируемый пилот', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      for (const row of getGuardRows(context)) {
        expect(row.pilotNote.toLowerCase()).toContain('guard-предпросмотр');
        expect(row.pilotNote.toLowerCase()).toContain('контролируемый пилот');
      }
    }
  });
});

// ─── Context label map ────────────────────────────────────────────────────────

describe('action guard preview data — context labels', () => {
  it('ACTION_GUARD_CONTEXT_LABEL covers all contexts', () => {
    for (const context of ACTION_GUARD_CONTEXTS) {
      expect(ACTION_GUARD_CONTEXT_LABEL[context], `Label missing for context "${context}"`).toBeTruthy();
    }
  });
});

// ─── Component rendering ──────────────────────────────────────────────────────

describe('ActionGuardPreviewMatrix — component rendering (seller)', () => {
  it('renders matrix wrapper', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    expect(screen.getByTestId('platform-v7-action-guard-preview-matrix')).toBeDefined();
  });

  it('renders disclaimer badge', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const badge = screen.getByTestId('platform-v7-action-guard-preview-disclaimer');
    expect(badge.textContent).toContain('preview-only');
    expect(badge.textContent).toContain('ручная проверка');
  });

  it('renders disclaimer note', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const note = screen.getByTestId('platform-v7-action-guard-preview-disclaimer-note');
    expect(note.textContent).toContain('backend');
    expect(note.textContent).toContain('внешней интеграции');
  });

  it('renders guard rows', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const rows = screen.getAllByTestId('platform-v7-action-guard-preview-row');
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('renders action label in each row', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const labels = screen.getAllByTestId('platform-v7-action-guard-preview-action-label');
    expect(labels[0].textContent).toContain('СДИЗ');
  });

  it('renders result badge in each row', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const badges = screen.getAllByTestId('platform-v7-action-guard-preview-result-badge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders actor role in each row', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const actors = screen.getAllByTestId('platform-v7-action-guard-preview-actor');
    expect(actors[0].textContent).toContain('продавец');
  });

  it('renders evidence pills', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const evidence = screen.getAllByTestId('platform-v7-action-guard-preview-evidence');
    expect(evidence.length).toBeGreaterThanOrEqual(1);
    expect(evidence[0].textContent).toBeTruthy();
  });

  it('renders safe fallback in each row', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const fallbacks = screen.getAllByTestId('platform-v7-action-guard-preview-safe-fallback');
    expect(fallbacks[0].textContent).toContain('черновик');
  });

  it('renders pilot note in each row', () => {
    render(ActionGuardPreviewMatrix({ context: 'seller' }));
    const notes = screen.getAllByTestId('platform-v7-action-guard-preview-pilot-note');
    expect(notes[0].textContent).toContain('контролируемый пилот');
  });
});

describe('ActionGuardPreviewMatrix — component rendering (bank, blocked)', () => {
  it('renders stop reason for blocked rows', () => {
    render(ActionGuardPreviewMatrix({ context: 'bank' }));
    const stopReasons = screen.getAllByTestId('platform-v7-action-guard-preview-stop-reason');
    expect(stopReasons.length).toBeGreaterThanOrEqual(1);
    expect(stopReasons[0].textContent).toContain('протокол качества');
  });
});

describe('ActionGuardPreviewMatrix — component rendering (elevator, 2 rows)', () => {
  it('renders 2 rows for elevator context', () => {
    render(ActionGuardPreviewMatrix({ context: 'elevator' }));
    const rows = screen.getAllByTestId('platform-v7-action-guard-preview-row');
    expect(rows).toHaveLength(2);
  });
});

// ─── No demo-route links ──────────────────────────────────────────────────────

describe('ActionGuardPreviewMatrix — no demo-route links', () => {
  for (const context of ['seller', 'buyer', 'bank', 'disputes', 'elevator'] as ActionGuardContext[]) {
    it(`context "${context}" renders no /demo links`, () => {
      render(ActionGuardPreviewMatrix({ context }));
      const anchors = document.querySelectorAll('a[href]');
      anchors.forEach((a) => {
        expect(
          a.getAttribute('href'),
          `Context "${context}": link must not point to a demo route`,
        ).not.toContain('/demo');
      });
      cleanup();
    });
  }
});
