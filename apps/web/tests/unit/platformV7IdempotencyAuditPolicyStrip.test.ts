/**
 * IdempotencyAuditPolicyStrip tests — platform-v7.
 *
 * Verifies policy data integrity and component rendering.
 * No append-only persistence claims. No live integration claims.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { IdempotencyAuditPolicyStrip } from '../../components/platform-v7/IdempotencyAuditPolicyStrip';
import {
  IDEMPOTENCY_AUDIT_POLICIES,
  IDEMPOTENCY_AUDIT_CONTEXTS,
  getPolicyByContext,
  type IdempotencyAuditContext,
} from '../../lib/platform-v7/idempotency-audit-policy';

afterEach(() => cleanup());

const FORBIDDEN_WORDING = [
  'production-ready',
  'fully live',
  'fully integrated',
  'live callback',
  'append-only persistence is active',
  'real persistence',
  'bank confirmed',
  'money transferred',
  'payout completed',
  'platform releases money by itself',
  'platform guarantees payment',
  'bypass impossible',
  'деньги переведены',
  'выплата выполнена',
  'no risks',
];

const VALID_IDEMPOTENCY_CLASSES = ['safe_to_retry', 'requires_confirmation', 'one_shot'] as const;

// ─── Policy data integrity ────────────────────────────────────────────────────

describe('idempotency audit policy data — integrity', () => {
  it('covers exactly 4 contexts', () => {
    expect(IDEMPOTENCY_AUDIT_CONTEXTS).toHaveLength(4);
    expect(IDEMPOTENCY_AUDIT_CONTEXTS).toContain('seller');
    expect(IDEMPOTENCY_AUDIT_CONTEXTS).toContain('buyer');
    expect(IDEMPOTENCY_AUDIT_CONTEXTS).toContain('bank');
    expect(IDEMPOTENCY_AUDIT_CONTEXTS).toContain('disputes');
  });

  it('has exactly 4 policies', () => {
    expect(IDEMPOTENCY_AUDIT_POLICIES).toHaveLength(4);
  });

  it('getPolicyByContext returns a policy for every context', () => {
    for (const context of IDEMPOTENCY_AUDIT_CONTEXTS) {
      expect(getPolicyByContext(context), `Policy missing for context "${context}"`).toBeDefined();
    }
  });

  it('getPolicyByContext returns undefined for unknown context', () => {
    expect(getPolicyByContext('unknown' as IdempotencyAuditContext)).toBeUndefined();
  });

  it('every policy has all required fields with truthy values', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(policy.context, 'context missing').toBeTruthy();
      expect(policy.actionId, `actionId missing for ${policy.context}`).toBeTruthy();
      expect(policy.actionLabel, `actionLabel missing for ${policy.context}`).toBeTruthy();
      expect(policy.idempotencyExpectation, `idempotencyExpectation missing for ${policy.context}`).toBeTruthy();
      expect(policy.retryRule, `retryRule missing for ${policy.context}`).toBeTruthy();
      expect(policy.auditDraftLabel, `auditDraftLabel missing for ${policy.context}`).toBeTruthy();
      expect(policy.externalConfirmationBoundary, `externalConfirmationBoundary missing for ${policy.context}`).toBeTruthy();
      expect(policy.pilotNote, `pilotNote missing for ${policy.context}`).toBeTruthy();
    }
  });

  it('every policy has a valid idempotency class', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(
        (VALID_IDEMPOTENCY_CLASSES as readonly string[]).includes(policy.idempotencyClass),
        `Policy "${policy.context}" has invalid idempotencyClass: "${policy.idempotencyClass}"`,
      ).toBe(true);
    }
  });
});

// ─── Idempotency label correctness ────────────────────────────────────────────

describe('idempotency audit policy data — idempotency label correctness', () => {
  it('seller policy is safe_to_retry', () => {
    const policy = getPolicyByContext('seller');
    expect(policy!.idempotencyClass).toBe('safe_to_retry');
  });

  it('buyer policy is requires_confirmation', () => {
    const policy = getPolicyByContext('buyer');
    expect(policy!.idempotencyClass).toBe('requires_confirmation');
  });

  it('bank policy is requires_confirmation', () => {
    const policy = getPolicyByContext('bank');
    expect(policy!.idempotencyClass).toBe('requires_confirmation');
  });

  it('disputes policy is one_shot', () => {
    const policy = getPolicyByContext('disputes');
    expect(policy!.idempotencyClass).toBe('one_shot');
  });

  it('safe_to_retry expectation mentions idempotent key', () => {
    const policy = getPolicyByContext('seller')!;
    const text = policy.idempotencyExpectation.toLowerCase();
    expect(text).toContain('идемпотент');
  });

  it('requires_confirmation expectation mentions explicit confirmation', () => {
    const buyerPolicy = getPolicyByContext('buyer')!;
    expect(buyerPolicy.idempotencyExpectation.toLowerCase()).toContain('подтвер');
  });

  it('one_shot expectation warns against duplication', () => {
    const policy = getPolicyByContext('disputes')!;
    const text = policy.idempotencyExpectation.toLowerCase();
    expect(text).toContain('одноразовое');
  });
});

// ─── Audit preview visibility ──────────────────────────────────────────────────

describe('idempotency audit policy data — audit preview', () => {
  it('every auditDraftLabel starts with аудит-предпросмотр', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(
        policy.auditDraftLabel,
        `Policy "${policy.context}": auditDraftLabel must start with "аудит-предпросмотр"`,
      ).toMatch(/^аудит-предпросмотр/);
    }
  });

  it('every pilotNote contains аудит-предпросмотр', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(policy.pilotNote.toLowerCase()).toContain('аудит-предпросмотр');
    }
  });

  it('every pilotNote contains контролируемый пилот', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(policy.pilotNote.toLowerCase()).toContain('контролируемый пилот');
    }
  });

  it('every pilotNote contains требует ручной проверки', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(policy.pilotNote.toLowerCase()).toContain('требует ручной проверки');
    }
  });
});

// ─── No append-only persistence claim ─────────────────────────────────────────

describe('idempotency audit policy data — no forbidden wording', () => {
  it('no policy contains forbidden wording', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      const allText = [
        policy.actionLabel,
        policy.idempotencyExpectation,
        policy.retryRule,
        policy.auditDraftLabel,
        policy.externalConfirmationBoundary,
        policy.pilotNote,
      ]
        .join(' ')
        .toLowerCase();
      for (const word of FORBIDDEN_WORDING) {
        expect(
          allText,
          `Policy "${policy.context}": must not contain "${word}"`,
        ).not.toContain(word.toLowerCase());
      }
    }
  });

  it('pilotNote explicitly states no active storage', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(
        policy.pilotNote.toLowerCase(),
        `Policy "${policy.context}": pilotNote must state no active storage`,
      ).toContain('нет активной записи');
    }
  });

  it('no externalConfirmationBoundary claims automatic execution', () => {
    for (const policy of IDEMPOTENCY_AUDIT_POLICIES) {
      expect(policy.externalConfirmationBoundary.toLowerCase()).not.toContain('автоматически выполняет');
      expect(policy.externalConfirmationBoundary.toLowerCase()).not.toContain('платформа гарантирует');
    }
  });
});

// ─── Component rendering ──────────────────────────────────────────────────────

describe('IdempotencyAuditPolicyStrip — component rendering (seller)', () => {
  it('renders strip wrapper', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    expect(screen.getByTestId('platform-v7-idempotency-audit-policy-strip')).toBeDefined();
  });

  it('renders action id', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    const el = screen.getByTestId('platform-v7-idempotency-audit-action-id');
    expect(el.textContent).toContain('seller_send_sdiz_etn');
  });

  it('renders idempotency badge', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    const badge = screen.getByTestId('platform-v7-idempotency-audit-idempotency-badge');
    expect(badge.textContent).toContain('safe');
  });

  it('renders idempotency expectation', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    const el = screen.getByTestId('platform-v7-idempotency-audit-expectation');
    expect(el.textContent).toBeTruthy();
    expect(el.textContent!.length).toBeGreaterThan(10);
  });

  it('renders retry rule', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    const el = screen.getByTestId('platform-v7-idempotency-audit-retry-rule');
    expect(el.textContent).toBeTruthy();
  });

  it('renders audit draft label starting with аудит-предпросмотр', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    const el = screen.getByTestId('platform-v7-idempotency-audit-audit-draft');
    expect(el.textContent).toMatch(/^аудит-предпросмотр/);
  });

  it('renders external boundary', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    const el = screen.getByTestId('platform-v7-idempotency-audit-external-boundary');
    expect(el.textContent).toContain('ФГИС');
  });

  it('renders pilot note', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'seller' }));
    const el = screen.getByTestId('platform-v7-idempotency-audit-pilot-note');
    expect(el.textContent).toContain('контролируемый пилот');
    expect(el.textContent).toContain('аудит-предпросмотр');
  });
});

describe('IdempotencyAuditPolicyStrip — component rendering (disputes, one_shot)', () => {
  it('renders disputes strip', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'disputes' }));
    expect(screen.getByTestId('platform-v7-idempotency-audit-policy-strip')).toBeDefined();
  });

  it('disputes badge shows one_shot', () => {
    render(IdempotencyAuditPolicyStrip({ context: 'disputes' }));
    const badge = screen.getByTestId('platform-v7-idempotency-audit-idempotency-badge');
    expect(badge.textContent).toContain('one');
  });
});

describe('IdempotencyAuditPolicyStrip — page placement verification', () => {
  for (const context of ['seller', 'buyer', 'bank', 'disputes'] as IdempotencyAuditContext[]) {
    it(`renders without errors for context "${context}"`, () => {
      render(IdempotencyAuditPolicyStrip({ context }));
      expect(screen.getByTestId('platform-v7-idempotency-audit-policy-strip')).toBeDefined();
      cleanup();
    });
  }
});
