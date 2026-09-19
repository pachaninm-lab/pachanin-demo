import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

import {
  CANONICAL_DEAL_STATUSES,
  CANONICAL_DEAL_TRANSITIONS,
  canTransitionDeal,
  assertDealTransition,
  isStrategicPlatformTask,
  CRITICAL_ACTION_REQUIREMENTS,
} from '@/lib/platform-v7/domain/canonical';
import { toCanonicalDealStatus, isKnownLegacyDealStatus } from '@/lib/platform-v7/domain/status-mapper';
import { hasPermission, canPerformCriticalAction } from '@/lib/platform-v7/domain/rbac';
import {
  calculateDealMoneyAtRisk,
  calculateMoneyTree,
  calculateMoneyStateFromEvents,
  calculateMoneyKpi,
} from '@/lib/platform-v7/domain/money';
import { calculateControlTowerKpi, calculateInvestorKpi } from '@/lib/platform-v7/domain/kpi';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { moneyStopReasonText, primaryMoneyStopReason } from '@/lib/platform-v7/domain/money-stop-labels';
import { normalizeLegacyDeal, normalizeLegacyDeals } from '@/lib/platform-v7/domain/legacy-deal-adapter';
import { selectDealReadinessFlags, selectHighestRiskDeal } from '@/lib/platform-v7/domain/selectors';

// ─── helpers ──────────────────────────────────────────────────────────────────

const NOW = '2025-01-01T00:00:00Z';

function makeMoney(overrides: Record<string, number> = {}) {
  return {
    totalAmount: 1000000,
    reservedAmount: 1000000,
    holdAmount: 0,
    releaseAmount: 500000,
    refundAmount: 0,
    commissionAmount: 0,
    ...overrides,
  };
}

function makeDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'D-001',
    status: 'DOCUMENTS_COMPLETE' as const,
    grain: 'Пшеница',
    quantity: 100,
    unit: 'т' as const,
    pricePerUnit: 10000,
    money: makeMoney(),
    seller: { id: 'U-001', name: 'Продавец', role: 'seller' as const },
    buyer: { id: 'U-002', name: 'Покупатель', role: 'buyer' as const },
    createdAt: NOW,
    updatedAt: NOW,
    dispute: null,
    riskScore: 20,
    blockers: [] as string[],
    timeline: [],
    documents: [],
    maturity: 'manual' as const,
    ...overrides,
  };
}

function makeLegacyDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'D-001',
    status: 'docs_complete',
    grain: 'Пшеница',
    quantity: 100,
    unit: 'т' as const,
    pricePerUnit: 10000,
    totalAmount: 1000000,
    reservedAmount: 1000000,
    holdAmount: 0,
    releaseAmount: 500000,
    seller: { id: 'U-001', name: 'Продавец', role: 'seller' },
    buyer: { id: 'U-002', name: 'Покупатель', role: 'buyer' },
    driver: null,
    elevator: null,
    createdAt: NOW,
    updatedAt: NOW,
    slaDeadline: null,
    dispute: null,
    riskScore: 20,
    blockers: [] as string[],
    timeline: [],
    documents: [],
    ...overrides,
  };
}

// ─── source guard ─────────────────────────────────────────────────────────────

const DOMAIN_FILES = [
  'lib/platform-v7/domain/canonical.ts',
  'lib/platform-v7/domain/status-mapper.ts',
  'lib/platform-v7/domain/rbac.ts',
  'lib/platform-v7/domain/money.ts',
  'lib/platform-v7/domain/kpi.ts',
  'lib/platform-v7/domain/release-guard.ts',
  'lib/platform-v7/domain/money-stop-labels.ts',
  'lib/platform-v7/domain/legacy-deal-adapter.ts',
  'lib/platform-v7/domain/selectors.ts',
];

describe('Source guard: domain layer', () => {
  it.each(DOMAIN_FILES)('file exists: %s', (f) => {
    expect(existsSync(f)).toBe(true);
  });

  it.each(DOMAIN_FILES)('no live fetch calls: %s', (f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});

// ─── canonical.ts ─────────────────────────────────────────────────────────────

describe('canonical: deal statuses and transitions', () => {
  it('defines 23 canonical deal statuses', () => {
    expect(CANONICAL_DEAL_STATUSES).toHaveLength(23);
  });

  it('CLOSED and CANCELED are terminal (no outgoing transitions)', () => {
    const rule = CANONICAL_DEAL_TRANSITIONS.find((r) => r.from === 'CLOSED');
    expect(rule?.to).toHaveLength(0);
    const canceledRule = CANONICAL_DEAL_TRANSITIONS.find((r) => r.from === 'CANCELED');
    expect(canceledRule?.to).toHaveLength(0);
  });

  it('canTransitionDeal: valid forward transition returns true', () => {
    expect(canTransitionDeal('DRAFT', 'COUNTERPARTY_CHECK')).toBe(true);
    expect(canTransitionDeal('MONEY_RESERVED', 'LOGISTICS_PLANNED')).toBe(true);
  });

  it('canTransitionDeal: invalid skip transition returns false', () => {
    expect(canTransitionDeal('DRAFT', 'BANK_BASIS_REQUESTED')).toBe(false);
    expect(canTransitionDeal('LOADING', 'CLOSED')).toBe(false);
  });

  it('canTransitionDeal: any status → DISPUTED allowed for mid-flow statuses', () => {
    expect(canTransitionDeal('CONTRACT_SIGNED', 'DISPUTED')).toBe(true);
    expect(canTransitionDeal('BANK_BASIS_REQUESTED', 'DISPUTED')).toBe(true);
  });

  it('assertDealTransition throws for invalid transitions', () => {
    expect(() => assertDealTransition('DRAFT', 'CLOSED')).toThrow();
  });

  it('assertDealTransition does not throw for valid transition', () => {
    expect(() => assertDealTransition('BANK_BASIS_CONFIRMED', 'CLOSED')).not.toThrow();
  });

  it('isStrategicPlatformTask: requires ≥ 3 unique gates', () => {
    expect(isStrategicPlatformTask(['LIQUIDITY', 'MONEY_SAFETY', 'BANK_READINESS'])).toBe(true);
    expect(isStrategicPlatformTask(['LIQUIDITY', 'LIQUIDITY'])).toBe(false);
  });

  it('CONFIRM_BANK_BASIS requires audit-event, 2fa, and bank-reconciliation', () => {
    const reqs = CRITICAL_ACTION_REQUIREMENTS['CONFIRM_BANK_BASIS'];
    expect(reqs).toContain('audit-event');
    expect(reqs).toContain('2fa');
    expect(reqs).toContain('bank-reconciliation');
  });
});

// ─── status-mapper.ts ─────────────────────────────────────────────────────────

describe('status-mapper', () => {
  it('maps known legacy statuses to canonical', () => {
    expect(toCanonicalDealStatus('docs_complete')).toBe('DOCUMENTS_COMPLETE');
    expect(toCanonicalDealStatus('payment_reserved')).toBe('MONEY_RESERVED');
    expect(toCanonicalDealStatus('disputed')).toBe('DISPUTED');
    expect(toCanonicalDealStatus('closed')).toBe('CLOSED');
  });

  it('maps unknown status to DEGRADED', () => {
    expect(toCanonicalDealStatus('unknown_status')).toBe('DEGRADED');
    expect(toCanonicalDealStatus('')).toBe('DEGRADED');
  });

  it('isKnownLegacyDealStatus returns true for known statuses', () => {
    expect(isKnownLegacyDealStatus('docs_complete')).toBe(true);
    expect(isKnownLegacyDealStatus('bank_basis_confirmed')).toBe(true);
  });

  it('isKnownLegacyDealStatus returns false for unknown status', () => {
    expect(isKnownLegacyDealStatus('totally_unknown')).toBe(false);
  });
});

// ─── rbac.ts ──────────────────────────────────────────────────────────────────

describe('rbac', () => {
  it('seller can create lots', () => {
    expect(hasPermission('seller', { scope: 'lot', verb: 'create' })).toBe(true);
  });

  it('seller cannot approve money', () => {
    expect(hasPermission('seller', { scope: 'money', verb: 'approve' })).toBe(false);
  });

  it('bank can approve money', () => {
    expect(hasPermission('bank', { scope: 'money', verb: 'approve' })).toBe(true);
  });

  it('canPerformCriticalAction: CONFIRM_BANK_BASIS allowed for bank only', () => {
    expect(canPerformCriticalAction('bank', 'CONFIRM_BANK_BASIS').allowed).toBe(true);
    expect(canPerformCriticalAction('seller', 'CONFIRM_BANK_BASIS').allowed).toBe(false);
  });

  it('canPerformCriticalAction: CONFIRM_BANK_BASIS requiresSecondFactor', () => {
    expect(canPerformCriticalAction('bank', 'CONFIRM_BANK_BASIS').requiresSecondFactor).toBe(true);
  });

  it('canPerformCriticalAction: always includes requiresAudit', () => {
    expect(canPerformCriticalAction('seller', 'SIGN_DOCUMENT').requiresAudit).toBe(true);
  });

  it('canPerformCriticalAction: SIGN_DOCUMENT not requiresSecondFactor', () => {
    expect(canPerformCriticalAction('seller', 'SIGN_DOCUMENT').requiresSecondFactor).toBe(false);
  });
});

// ─── money.ts ────────────────────────────────────────────────────────────────

describe('domain/money', () => {
  it('calculateDealMoneyAtRisk: DISPUTED deal returns holdAmount or amountAtRisk', () => {
    const deal = makeDeal({ status: 'DISPUTED', money: makeMoney({ holdAmount: 50000 }) });
    expect(calculateDealMoneyAtRisk(deal as never)).toBe(50000);
  });

  it('calculateDealMoneyAtRisk: no hold, no dispute → 0', () => {
    const deal = makeDeal({ money: makeMoney({ holdAmount: 0 }) });
    expect(calculateDealMoneyAtRisk(deal as never)).toBe(0);
  });

  it('calculateMoneyTree: single clean deal → readyToRelease bucket', () => {
    const deal = makeDeal({ money: makeMoney({ reservedAmount: 100000, releaseAmount: 100000, holdAmount: 0 }), blockers: [], documents: [] });
    const tree = calculateMoneyTree([deal as never]);
    expect(tree.reserved.amount).toBe(100000);
    const rtb = tree.parts.find((p) => p.key === 'readyToRelease');
    expect(rtb?.amount).toBe(100000);
  });

  it('calculateMoneyTree: disputed deal → blockedByDispute bucket', () => {
    const deal = makeDeal({ status: 'DISPUTED', dispute: { id: 'D-sp', title: 'спор' }, money: makeMoney({ reservedAmount: 50000 }) });
    const tree = calculateMoneyTree([deal as never]);
    const disputed = tree.parts.find((p) => p.key === 'blockedByDispute');
    expect(disputed?.amount).toBe(50000);
  });

  it('calculateMoneyStateFromEvents: accumulates RESERVE_CONFIRMED', () => {
    const events = [
      { id: 'E1', dealId: 'D-001', type: 'RESERVE_CONFIRMED' as const, amount: 500000, at: NOW, actor: 'bank' },
      { id: 'E2', dealId: 'D-001', type: 'RESERVE_CONFIRMED' as const, amount: 200000, at: NOW, actor: 'bank' },
    ];
    const state = calculateMoneyStateFromEvents(events);
    expect(state.reservedAmount).toBe(700000);
  });

  it('calculateMoneyStateFromEvents: PARTIAL_BANK_BASIS_CONFIRMED reduces reserved', () => {
    const events = [
      { id: 'E1', dealId: 'D-001', type: 'RESERVE_CONFIRMED' as const, amount: 500000, at: NOW, actor: 'bank' },
      { id: 'E2', dealId: 'D-001', type: 'BANK_BASIS_REQUESTED' as const, amount: 500000, at: NOW, actor: 'operator' },
      { id: 'E3', dealId: 'D-001', type: 'PARTIAL_BANK_BASIS_CONFIRMED' as const, amount: 200000, at: NOW, actor: 'bank' },
    ];
    const state = calculateMoneyStateFromEvents(events);
    expect(state.reservedAmount).toBe(300000);
    expect(state.releaseAmount).toBe(300000);
  });

  it('calculateMoneyKpi: aggregates disputed and blocked deals', () => {
    const d1 = makeDeal({ status: 'DISPUTED', money: makeMoney({ totalAmount: 1000000 }) });
    const d2 = makeDeal({ id: 'D-002', status: 'DOCUMENTS_COMPLETE', blockers: ['bank-hold'], money: makeMoney({ totalAmount: 500000 }) });
    const kpi = calculateMoneyKpi([d1 as never, d2 as never]);
    expect(kpi.dealsWithOpenDisputes).toBe(1);
    expect(kpi.dealsBlockedByMoney).toBe(1);
    expect(kpi.totalGmv).toBe(1500000);
  });
});

// ─── kpi.ts ───────────────────────────────────────────────────────────────────

describe('domain/kpi', () => {
  it('calculateControlTowerKpi: counts active, disputed, blocked deals', () => {
    const deals = [
      makeDeal({ id: 'D1', status: 'DISPUTED', riskScore: 80, blockers: ['dispute'] }),
      makeDeal({ id: 'D2', status: 'DOCUMENTS_COMPLETE', riskScore: 40, blockers: [] }),
      makeDeal({ id: 'D3', status: 'CLOSED', riskScore: 0, blockers: [] }),
    ];
    const kpi = calculateControlTowerKpi(deals as never);
    expect(kpi.activeDeals).toBe(2);
    expect(kpi.disputedDeals).toBe(1);
    expect(kpi.maxRiskScore).toBe(80);
  });

  it('calculateControlTowerKpi: readyToRelease only includes BANK_BASIS_REQUESTED with no blockers', () => {
    const deals = [
      makeDeal({ id: 'D1', status: 'BANK_BASIS_REQUESTED', blockers: [], money: makeMoney({ releaseAmount: 300000 }) }),
      makeDeal({ id: 'D2', status: 'BANK_BASIS_REQUESTED', blockers: ['bank-hold'], money: makeMoney({ releaseAmount: 200000 }) }),
    ];
    const kpi = calculateControlTowerKpi(deals as never);
    expect(kpi.readyToRelease).toBe(300000);
  });

  it('calculateInvestorKpi: disputeRate = disputed / total', () => {
    const deals = [
      makeDeal({ id: 'D1', status: 'DISPUTED', money: makeMoney({ totalAmount: 1000000 }) }),
      makeDeal({ id: 'D2', status: 'CLOSED', money: makeMoney({ totalAmount: 500000 }) }),
      makeDeal({ id: 'D3', status: 'CLOSED', money: makeMoney({ totalAmount: 500000 }) }),
      makeDeal({ id: 'D4', status: 'CLOSED', money: makeMoney({ totalAmount: 500000 }) }),
    ];
    const kpi = calculateInvestorKpi(deals as never);
    expect(kpi.disputeRate).toBe(0.25);
    expect(kpi.closedDeals).toBe(3);
  });
});

// ─── release-guard.ts ────────────────────────────────────────────────────────

describe('release-guard', () => {
  it('clean DOCUMENTS_COMPLETE deal → canRequestRelease (no blockers)', () => {
    const deal = makeDeal({
      status: 'DOCUMENTS_COMPLETE',
      money: makeMoney({ reservedAmount: 1000000, releaseAmount: 500000, holdAmount: 0 }),
      blockers: [],
      documents: [],
    });
    const result = evaluateReleaseGuard(deal as never);
    expect(result.canRequestRelease).toBe(true);
    expect(result.canExecuteRelease).toBe(false);
  });

  it('BANK_BASIS_REQUESTED deal with no blockers → canExecuteRelease', () => {
    const deal = makeDeal({
      status: 'BANK_BASIS_REQUESTED',
      money: makeMoney({ reservedAmount: 1000000, releaseAmount: 500000, holdAmount: 0 }),
      blockers: [],
      documents: [],
    });
    const result = evaluateReleaseGuard(deal as never);
    expect(result.canRequestRelease).toBe(true);
    expect(result.canExecuteRelease).toBe(true);
  });

  it('holdAmount active → HOLD_AMOUNT_ACTIVE blocker', () => {
    const deal = makeDeal({ money: makeMoney({ holdAmount: 50000, releaseAmount: 500000 }) });
    const result = evaluateReleaseGuard(deal as never);
    expect(result.blockers).toContain('HOLD_AMOUNT_ACTIVE');
  });

  it('DISPUTED status → OPEN_DISPUTE blocker', () => {
    const deal = makeDeal({ status: 'DISPUTED', dispute: { id: 'D-sp', title: 'спор' } });
    const result = evaluateReleaseGuard(deal as never);
    expect(result.blockers).toContain('OPEN_DISPUTE');
  });

  it('no reserved money → NO_RESERVED_MONEY blocker', () => {
    const deal = makeDeal({ money: makeMoney({ reservedAmount: 0 }) });
    const result = evaluateReleaseGuard(deal as never);
    expect(result.blockers).toContain('NO_RESERVED_MONEY');
  });
});

// ─── money-stop-labels.ts ────────────────────────────────────────────────────

describe('money-stop-labels', () => {
  it('moneyStopReasonText returns — for empty reasons', () => {
    expect(moneyStopReasonText([])).toBe('—');
  });

  it('moneyStopReasonText joins multiple reasons with comma', () => {
    const text = moneyStopReasonText(['NO_RESERVED_MONEY', 'OPEN_DISPUTE']);
    expect(text).toContain('нет подтверждённого резерва');
    expect(text).toContain('открыт спор');
  });

  it('primaryMoneyStopReason returns first reason label', () => {
    expect(primaryMoneyStopReason(['HOLD_AMOUNT_ACTIVE', 'OPEN_DISPUTE'])).toBe('есть активное удержание');
  });

  it('primaryMoneyStopReason returns fallback for empty list', () => {
    expect(primaryMoneyStopReason([])).toBe('Нет причин остановки денег');
  });
});

// ─── legacy-deal-adapter.ts ───────────────────────────────────────────────────

describe('legacy-deal-adapter', () => {
  it('normalizeLegacyDeal maps status to canonical', () => {
    const deal = normalizeLegacyDeal(makeLegacyDeal() as never);
    expect(deal.status).toBe('DOCUMENTS_COMPLETE');
    expect(deal.legacyStatus).toBe('docs_complete');
  });

  it('normalizeLegacyDeal sets maturity to manual', () => {
    const deal = normalizeLegacyDeal(makeLegacyDeal() as never);
    expect(deal.maturity).toBe('manual');
  });

  it('normalizeLegacyDeal normalizes driver to null when absent', () => {
    const deal = normalizeLegacyDeal(makeLegacyDeal({ driver: null }) as never);
    expect(deal.driver).toBeNull();
  });

  it('normalizeLegacyDeal normalizes elevator', () => {
    const deal = normalizeLegacyDeal(makeLegacyDeal({ elevator: { id: 'EL-1', name: 'Элеватор', region: 'Тамбов' } }) as never);
    expect(deal.elevator?.region).toBe('Тамбов');
  });

  it('normalizeLegacyDeals maps array', () => {
    const deals = normalizeLegacyDeals([makeLegacyDeal({ id: 'D1' }), makeLegacyDeal({ id: 'D2' })] as never);
    expect(deals).toHaveLength(2);
    expect(deals[0].id).toBe('D1');
  });
});

// ─── selectors.ts ─────────────────────────────────────────────────────────────

describe('selectors', () => {
  it('selectDealReadinessFlags: clean DOCUMENTS_COMPLETE deal → canRequestRelease', () => {
    const deal = makeDeal({ status: 'DOCUMENTS_COMPLETE', blockers: [], documents: [] });
    const flags = selectDealReadinessFlags(deal as never);
    expect(flags.canRequestRelease).toBe(true);
    expect(flags.canExecuteRelease).toBe(false);
    expect(flags.hasOpenDispute).toBe(false);
  });

  it('selectDealReadinessFlags: DISPUTED deal → hasOpenDispute, cannot release', () => {
    const deal = makeDeal({ status: 'DISPUTED' });
    const flags = selectDealReadinessFlags(deal as never);
    expect(flags.hasOpenDispute).toBe(true);
    expect(flags.canRequestRelease).toBe(false);
  });

  it('selectHighestRiskDeal: returns deal with highest riskScore', () => {
    const deals = [
      makeDeal({ id: 'D1', riskScore: 30 }),
      makeDeal({ id: 'D2', riskScore: 90 }),
      makeDeal({ id: 'D3', riskScore: 10 }),
    ];
    const result = selectHighestRiskDeal(deals as never);
    expect(result?.id).toBe('D2');
  });

  it('selectHighestRiskDeal: returns null for empty array', () => {
    expect(selectHighestRiskDeal([])).toBeNull();
  });
});
