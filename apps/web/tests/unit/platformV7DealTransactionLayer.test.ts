import { existsSync, readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { canAccessSensitiveField, maskSensitiveValue } from '@/lib/platform-v7/deal-access-gate';
import {
  createDealDraftFromAcceptedOffer,
  evaluateDealDraftGuards,
  updateDealDraftReadiness,
} from '@/lib/platform-v7/deal-draft';
import { createDealFingerprint, isSimilarDealFingerprint } from '@/lib/platform-v7/deal-fingerprint';
import { canTransitionOffer, transitionOffer, createCounterOffer } from '@/lib/platform-v7/offer-state-machine';
import { calculateSellerNetback, calculateBuyerLandedPrice } from '@/lib/platform-v7/price-calculators';
import {
  PLATFORM_V7_CANONICAL_ROLES,
  toPlatformV7CanonicalRole,
  platformV7CanonicalRoleName,
} from '@/lib/platform-v7/role-canonical';
import type { Offer, DealDraft } from '@/lib/platform-v7/core-types';
import type { DealAccessContext } from '@/lib/platform-v7/deal-access-gate';

const TRANSACTION_FILES = [
  'lib/platform-v7/deal-access-gate.ts',
  'lib/platform-v7/deal-draft.ts',
  'lib/platform-v7/deal-fingerprint.ts',
  'lib/platform-v7/offer-state-machine.ts',
  'lib/platform-v7/price-calculators.ts',
  'lib/platform-v7/role-canonical.ts',
];

function makeOffer(overrides?: Partial<Offer>): Offer {
  return {
    id: 'O-001',
    sellerId: 'S-001',
    buyerId: 'B-001',
    pricePerTon: 12_000,
    volumeTons: 500,
    basis: 'CPT',
    logisticsOption: 'seller_delivery',
    paymentTerms: 'after_documents',
    documentRequirements: ['contract', 'specification'],
    qualityRequirements: ['moisture_max_14'],
    status: 'accepted',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDraft(overrides?: Partial<DealDraft>): DealDraft {
  return {
    id: 'DD-O-001',
    acceptedOfferId: 'O-001',
    sellerId: 'S-001',
    buyerId: 'B-001',
    pricePerTon: 12_000,
    volumeTons: 500,
    moneyPlanReady: true,
    documentPlanReady: true,
    logisticsPlanReady: true,
    sdizStatus: 'ready',
    complianceStop: false,
    bypassStop: false,
    status: 'ready_for_execution',
    blockers: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeCtx(overrides?: Partial<DealAccessContext>): DealAccessContext {
  return {
    role: 'operator',
    stage: 'deal_confirmed',
    hasOffer: true,
    hasDealDraft: true,
    trustScore: 80,
    counterpartyAdmitted: true,
    documentsReady: true,
    ...overrides,
  };
}

// ─── source guard ────────────────────────────────────────────────────────────

describe('PR 14.0 — source guard', () => {
  for (const file of TRANSACTION_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(file)).toBe(true);
    });

    it(`${file} has no live network calls`, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/https?:\/\//);
    });
  }
});

// ─── deal-access-gate ────────────────────────────────────────────────────────

describe('canAccessSensitiveField', () => {
  it('allows access when all conditions are met', () => {
    const result = canAccessSensitiveField('phone', makeCtx());
    expect(result.allowed).toBe(true);
  });

  it('blocks with manual_restriction', () => {
    const result = canAccessSensitiveField('phone', makeCtx({ manualRestriction: true }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('manual_restriction');
  });

  it('blocks when bypass risk score >= 60', () => {
    const result = canAccessSensitiveField(
      'phone',
      makeCtx({
        bypassRiskProfile: {
          counterpartyId: 'C-1',
          totalScore: 65,
          riskLevel: 'high',
          signals: [],
          restrictions: [],
          manualReviewRequired: false,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('bypass_risk');
  });

  it('blocks when trust score < 40', () => {
    const result = canAccessSensitiveField('phone', makeCtx({ trustScore: 30 }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('low_trust_score');
  });

  it('blocks bank_details for non-bank non-operator role', () => {
    const result = canAccessSensitiveField('bank_details', makeCtx({ role: 'seller' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('role_not_allowed');
  });

  it('allows bank_details for bank role at deal_confirmed stage', () => {
    const result = canAccessSensitiveField('bank_details', makeCtx({ role: 'bank' }));
    expect(result.allowed).toBe(true);
  });

  it('blocks driver_contact for non-logistics non-operator role', () => {
    const result = canAccessSensitiveField(
      'driver_contact',
      makeCtx({ role: 'seller', stage: 'execution_started' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('role_not_allowed');
  });

  it('blocks phone at stage too early (interest)', () => {
    const result = canAccessSensitiveField('phone', makeCtx({ stage: 'interest' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('stage_too_early');
  });

  it('blocks full_documents when documents not ready', () => {
    const result = canAccessSensitiveField('full_documents', makeCtx({ documentsReady: false }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('documents_not_ready');
  });

  it('blocks when counterparty not admitted', () => {
    const result = canAccessSensitiveField('phone', makeCtx({ counterpartyAdmitted: false }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('counterparty_not_admitted');
  });

  it('allows closed_offer_terms for buyer role', () => {
    const result = canAccessSensitiveField('closed_offer_terms', makeCtx({ role: 'buyer' }));
    expect(result.allowed).toBe(true);
  });

  it('blocks closed_offer_terms for logistics role', () => {
    const result = canAccessSensitiveField('closed_offer_terms', makeCtx({ role: 'logistics' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('role_not_allowed');
  });
});

describe('maskSensitiveValue', () => {
  it('returns original value when allowed', () => {
    expect(maskSensitiveValue('+79001234567', true)).toBe('+79001234567');
  });

  it('returns ●●●● for short values when not allowed', () => {
    expect(maskSensitiveValue('ab', false)).toBe('••••');
  });

  it('masks middle with partial reveal for long values when not allowed', () => {
    const masked = maskSensitiveValue('+79001234567', false);
    expect(masked).toMatch(/^\+7••••67$/);
  });
});

// ─── deal-draft ──────────────────────────────────────────────────────────────

describe('createDealDraftFromAcceptedOffer', () => {
  it('creates a DealDraft from an accepted offer', () => {
    const offer = makeOffer({ status: 'accepted' });
    const draft = createDealDraftFromAcceptedOffer(offer);
    expect(draft.acceptedOfferId).toBe(offer.id);
    expect(draft.sellerId).toBe(offer.sellerId);
    expect(draft.buyerId).toBe(offer.buyerId);
    expect(draft.pricePerTon).toBe(offer.pricePerTon);
    expect(draft.status).toBe('created');
    expect(draft.moneyPlanReady).toBe(false);
  });

  it('throws when offer is not accepted', () => {
    const offer = makeOffer({ status: 'sent' });
    expect(() => createDealDraftFromAcceptedOffer(offer)).toThrow('accepted offer');
  });

  it('initialises all three plan blockers', () => {
    const draft = createDealDraftFromAcceptedOffer(makeOffer());
    expect(draft.blockers).toContain('money_plan');
    expect(draft.blockers).toContain('document_plan');
    expect(draft.blockers).toContain('logistics_plan');
  });
});

describe('evaluateDealDraftGuards', () => {
  it('returns ready=true when all plans are set and no stops', () => {
    const result = evaluateDealDraftGuards(makeDraft());
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.status).toBe('ready_for_execution');
  });

  it('adds money_plan blocker when not ready', () => {
    const result = evaluateDealDraftGuards(makeDraft({ moneyPlanReady: false }));
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('money_plan');
  });

  it('adds sdiz blocker when sdizStatus is blocked', () => {
    const result = evaluateDealDraftGuards(makeDraft({ sdizStatus: 'blocked' }));
    expect(result.blockers).toContain('sdiz');
  });

  it('adds compliance blocker when complianceStop is true', () => {
    const result = evaluateDealDraftGuards(makeDraft({ complianceStop: true }));
    expect(result.blockers).toContain('compliance');
  });

  it('adds anti_bypass blocker when bypassStop is true', () => {
    const result = evaluateDealDraftGuards(makeDraft({ bypassStop: true }));
    expect(result.blockers).toContain('anti_bypass');
  });

  it('accumulates multiple blockers', () => {
    const result = evaluateDealDraftGuards(
      makeDraft({ moneyPlanReady: false, documentPlanReady: false }),
    );
    expect(result.blockers).toContain('money_plan');
    expect(result.blockers).toContain('document_plan');
    expect(result.status).toBe('blocked');
  });
});

describe('updateDealDraftReadiness', () => {
  it('returns updated draft and audit event', () => {
    const draft = makeDraft();
    const { draft: next, auditEvent } = updateDealDraftReadiness(draft, 'actor-1');
    expect(next.status).toBe('ready_for_execution');
    expect(auditEvent.action).toBe('deal_draft_guard_evaluated');
    expect(auditEvent.actorId).toBe('actor-1');
  });

  it('updates status to blocked when blockers exist', () => {
    const draft = makeDraft({ moneyPlanReady: false });
    const { draft: next } = updateDealDraftReadiness(draft, 'actor-1');
    expect(next.status).toBe('blocked');
    expect(next.blockers).toContain('money_plan');
  });
});

// ─── deal-fingerprint ────────────────────────────────────────────────────────

describe('createDealFingerprint', () => {
  it('buckets volume into 100-ton ranges', () => {
    const fp = createDealFingerprint({
      sellerId: 'S-1',
      buyerId: 'B-1',
      crop: 'wheat',
      volumeTons: 350,
      region: 'krasnodar',
      basis: 'CPT',
      pricePerTon: 11_800,
      deliveryWindow: '2026-07',
      qualityHash: 'qh1',
      documentHash: 'dh1',
    });
    expect(fp.volumeRange).toBe('300-400');
  });

  it('buckets price into 250-ruble ranges', () => {
    const fp = createDealFingerprint({
      sellerId: 'S-1',
      buyerId: 'B-1',
      crop: 'wheat',
      volumeTons: 100,
      region: 'krasnodar',
      basis: 'CPT',
      pricePerTon: 11_900,
      deliveryWindow: '2026-07',
      qualityHash: 'qh1',
      documentHash: 'dh1',
    });
    expect(fp.priceRange).toBe('11750-12000');
  });

  it('produces the same ID for identical inputs', () => {
    const input = {
      sellerId: 'S-1',
      buyerId: 'B-1',
      crop: 'barley',
      volumeTons: 200,
      region: 'stavropol',
      basis: 'EXW' as const,
      pricePerTon: 10_000,
      deliveryWindow: '2026-08',
      qualityHash: 'qhX',
      documentHash: 'dhX',
    };
    expect(createDealFingerprint(input).id).toBe(createDealFingerprint(input).id);
  });

  it('produces different IDs for different crops', () => {
    const base = {
      sellerId: 'S-1',
      buyerId: 'B-1',
      volumeTons: 200,
      region: 'stavropol',
      basis: 'EXW' as const,
      pricePerTon: 10_000,
      deliveryWindow: '2026-08',
      qualityHash: 'qhX',
      documentHash: 'dhX',
    };
    const fp1 = createDealFingerprint({ ...base, crop: 'wheat' });
    const fp2 = createDealFingerprint({ ...base, crop: 'barley' });
    expect(fp1.id).not.toBe(fp2.id);
  });

  it('defaults cropClass to "unknown" when not provided', () => {
    const fp = createDealFingerprint({
      sellerId: 'S-1',
      buyerId: 'B-1',
      crop: 'wheat',
      volumeTons: 100,
      region: 'kuban',
      basis: 'FCA',
      pricePerTon: 12_000,
      deliveryWindow: '2026-09',
      qualityHash: 'q1',
      documentHash: 'd1',
    });
    expect(fp.cropClass).toBe('unknown');
  });
});

describe('isSimilarDealFingerprint', () => {
  it('returns true for fingerprints with same core params', () => {
    const input = {
      sellerId: 'S-1',
      buyerId: 'B-1',
      crop: 'wheat',
      volumeTons: 150,
      region: 'krasnodar',
      basis: 'CPT' as const,
      pricePerTon: 12_100,
      deliveryWindow: '2026-07',
      qualityHash: 'qhA',
      documentHash: 'dhA',
    };
    const fp1 = createDealFingerprint(input);
    const fp2 = createDealFingerprint({ ...input, deliveryWindow: '2026-08' });
    expect(isSimilarDealFingerprint(fp1, fp2)).toBe(true);
  });

  it('returns false when sellers differ', () => {
    const base = {
      buyerId: 'B-1',
      crop: 'wheat',
      volumeTons: 100,
      region: 'kuban',
      basis: 'CPT' as const,
      pricePerTon: 12_000,
      deliveryWindow: '2026-07',
      qualityHash: 'q1',
      documentHash: 'd1',
    };
    const fp1 = createDealFingerprint({ ...base, sellerId: 'S-1' });
    const fp2 = createDealFingerprint({ ...base, sellerId: 'S-2' });
    expect(isSimilarDealFingerprint(fp1, fp2)).toBe(false);
  });
});

// ─── offer-state-machine ─────────────────────────────────────────────────────

describe('canTransitionOffer', () => {
  it('sent → viewed is allowed', () => {
    expect(canTransitionOffer('sent', 'viewed')).toBe(true);
  });

  it('sent → accepted is allowed', () => {
    expect(canTransitionOffer('sent', 'accepted')).toBe(true);
  });

  it('accepted → any is not allowed (terminal)', () => {
    const targets: Parameters<typeof canTransitionOffer>[1][] = [
      'sent', 'viewed', 'countered', 'rejected', 'expired', 'withdrawn',
    ];
    for (const to of targets) {
      expect(canTransitionOffer('accepted', to)).toBe(false);
    }
  });

  it('rejected → any is not allowed (terminal)', () => {
    expect(canTransitionOffer('rejected', 'sent')).toBe(false);
  });

  it('expired → any is not allowed (terminal)', () => {
    expect(canTransitionOffer('expired', 'sent')).toBe(false);
  });

  it('countered → accepted is allowed', () => {
    expect(canTransitionOffer('countered', 'accepted')).toBe(true);
  });
});

describe('transitionOffer', () => {
  it('transitions offer to new status', () => {
    const offer = makeOffer({ status: 'sent' });
    const { offer: next, auditEvent } = transitionOffer(offer, 'viewed', 'actor-1');
    expect(next.status).toBe('viewed');
    expect(auditEvent.action).toBe('offer_viewed');
  });

  it('throws on invalid transition', () => {
    const offer = makeOffer({ status: 'accepted' });
    expect(() => transitionOffer(offer, 'viewed', 'actor-1')).toThrow('cannot transition');
  });

  it('throws on rejection without reason', () => {
    const offer = makeOffer({ status: 'sent' });
    expect(() => transitionOffer(offer, 'rejected', 'actor-1')).toThrow('reason');
  });

  it('allows rejection with reason', () => {
    const offer = makeOffer({ status: 'sent' });
    const { offer: next } = transitionOffer(offer, 'rejected', 'actor-1', 'price too high');
    expect(next.status).toBe('rejected');
  });

  it('sets actorRole to seller when actorId matches sellerId', () => {
    const offer = makeOffer({ status: 'sent', sellerId: 'actor-S' });
    const { auditEvent } = transitionOffer(offer, 'viewed', 'actor-S');
    expect(auditEvent.actorRole).toBe('seller');
  });

  it('sets actorRole to buyer when actorId matches buyerId', () => {
    const offer = makeOffer({ status: 'sent', buyerId: 'actor-B' });
    const { auditEvent } = transitionOffer(offer, 'viewed', 'actor-B');
    expect(auditEvent.actorRole).toBe('buyer');
  });
});

describe('createCounterOffer', () => {
  it('creates a counter offer with new price', () => {
    const offer = makeOffer({ status: 'sent' });
    const { offer: next } = createCounterOffer(offer, { pricePerTon: 11_500 }, 'actor-1', 'lowering price');
    expect(next.status).toBe('countered');
    expect(next.pricePerTon).toBe(11_500);
    expect(next.version).toBe(2);
  });

  it('throws without reason', () => {
    const offer = makeOffer({ status: 'sent' });
    expect(() => createCounterOffer(offer, {}, 'actor-1', '')).toThrow('reason');
  });

  it('throws when transition from accepted is invalid', () => {
    const offer = makeOffer({ status: 'accepted' });
    expect(() => createCounterOffer(offer, {}, 'actor-1', 'countering')).toThrow('countered');
  });
});

// ─── price-calculators ───────────────────────────────────────────────────────

describe('calculateSellerNetback', () => {
  it('returns buyer price when no deductions', () => {
    const result = calculateSellerNetback({ buyerPricePerTon: 12_000, volumeTons: 100 });
    expect(result.pricePerTon).toBe(12_000);
    expect(result.totalAmount).toBe(1_200_000);
  });

  it('deducts logistics and fee from buyer price', () => {
    const result = calculateSellerNetback({
      buyerPricePerTon: 12_000,
      volumeTons: 100,
      logisticsCostPerTon: 500,
      platformFeePerTon: 100,
    });
    expect(result.pricePerTon).toBe(11_400);
    expect(result.totalAmount).toBe(1_140_000);
  });

  it('returns 7 deduction line items', () => {
    const result = calculateSellerNetback({ buyerPricePerTon: 12_000, volumeTons: 100 });
    expect(result.deductionsOrAdditions).toHaveLength(7);
  });

  it('includes explanation array', () => {
    const result = calculateSellerNetback({ buyerPricePerTon: 12_000, volumeTons: 50 });
    expect(result.explanation).toHaveLength(3);
    expect(result.explanation[0]).toContain('12000');
  });
});

describe('calculateBuyerLandedPrice', () => {
  it('returns seller price when no additions', () => {
    const result = calculateBuyerLandedPrice({ sellerPricePerTon: 11_000, volumeTons: 200 });
    expect(result.pricePerTon).toBe(11_000);
    expect(result.totalAmount).toBe(2_200_000);
  });

  it('adds logistics and acceptance costs', () => {
    const result = calculateBuyerLandedPrice({
      sellerPricePerTon: 11_000,
      volumeTons: 100,
      logisticsCostPerTon: 400,
      acceptanceCostPerTon: 100,
    });
    expect(result.pricePerTon).toBe(11_500);
    expect(result.totalAmount).toBe(1_150_000);
  });

  it('returns 5 addition line items', () => {
    const result = calculateBuyerLandedPrice({ sellerPricePerTon: 11_000, volumeTons: 100 });
    expect(result.deductionsOrAdditions).toHaveLength(5);
  });

  it('includes explanation array', () => {
    const result = calculateBuyerLandedPrice({ sellerPricePerTon: 11_000, volumeTons: 50 });
    expect(result.explanation).toHaveLength(3);
    expect(result.explanation[0]).toContain('11000');
  });
});

// ─── role-canonical ──────────────────────────────────────────────────────────

describe('PLATFORM_V7_CANONICAL_ROLES', () => {
  it('contains 16 canonical roles', () => {
    expect(PLATFORM_V7_CANONICAL_ROLES).toHaveLength(16);
  });

  it('includes all key roles', () => {
    const set = new Set(PLATFORM_V7_CANONICAL_ROLES);
    expect(set.has('platform_admin')).toBe(true);
    expect(set.has('operator')).toBe(true);
    expect(set.has('seller')).toBe(true);
    expect(set.has('buyer')).toBe(true);
    expect(set.has('bank_officer')).toBe(true);
    expect(set.has('investor')).toBe(true);
  });
});

describe('toPlatformV7CanonicalRole', () => {
  it('resolves canonical form directly', () => {
    expect(toPlatformV7CanonicalRole('operator')).toBe('operator');
    expect(toPlatformV7CanonicalRole('seller')).toBe('seller');
    expect(toPlatformV7CanonicalRole('buyer')).toBe('buyer');
  });

  it('resolves camelCase aliases', () => {
    expect(toPlatformV7CanonicalRole('platformAdmin')).toBe('platform_admin');
    expect(toPlatformV7CanonicalRole('logisticsManager')).toBe('logistics_manager');
    expect(toPlatformV7CanonicalRole('bankOfficer')).toBe('bank_officer');
    expect(toPlatformV7CanonicalRole('complianceOfficer')).toBe('compliance_officer');
    expect(toPlatformV7CanonicalRole('supportAgent')).toBe('support_agent');
    expect(toPlatformV7CanonicalRole('executiveViewer')).toBe('executive_viewer');
  });

  it('resolves short aliases', () => {
    expect(toPlatformV7CanonicalRole('admin')).toBe('platform_admin');
    expect(toPlatformV7CanonicalRole('logistics')).toBe('logistics_manager');
    expect(toPlatformV7CanonicalRole('bank')).toBe('bank_officer');
    expect(toPlatformV7CanonicalRole('compliance')).toBe('compliance_officer');
    expect(toPlatformV7CanonicalRole('support')).toBe('support_agent');
    expect(toPlatformV7CanonicalRole('executive')).toBe('executive_viewer');
    expect(toPlatformV7CanonicalRole('elevator')).toBe('elevator_operator');
    expect(toPlatformV7CanonicalRole('lab')).toBe('lab_specialist');
  });

  it('returns null for unknown alias', () => {
    expect(toPlatformV7CanonicalRole('unknown_role')).toBeNull();
    expect(toPlatformV7CanonicalRole('')).toBeNull();
  });
});

describe('platformV7CanonicalRoleName', () => {
  it('returns display name for canonical role', () => {
    expect(platformV7CanonicalRoleName('operator')).toBe('Operator');
    expect(platformV7CanonicalRoleName('platform_admin')).toBe('PlatformAdmin');
    expect(platformV7CanonicalRoleName('bank_officer')).toBe('BankOfficer');
    expect(platformV7CanonicalRoleName('logistics_manager')).toBe('LogisticsManager');
  });

  it('all canonical roles have a display name', () => {
    for (const role of PLATFORM_V7_CANONICAL_ROLES) {
      expect(platformV7CanonicalRoleName(role)).toBeTruthy();
    }
  });
});
