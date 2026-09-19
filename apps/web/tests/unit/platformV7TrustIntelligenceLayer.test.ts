import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

const TRUST_FILES = [
  'lib/platform-v7/attachment-risk-scanner.ts',
  'lib/platform-v7/reputation.ts',
  'lib/platform-v7/decision-recommendation.ts',
  'lib/platform-v7/document-money-decision-pack.ts',
  'lib/platform-v7/journal-preview.ts',
  'lib/platform-v7/direct-money-boundaries.ts',
];

describe('PR 17.0 — Trust & Intelligence Layer — source guard', () => {
  for (const file of TRUST_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(file)).toBe(true);
    });
    it(`${file} has no live network calls`, async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/http\s*\./);
    });
  }
});

// ──────────────────────────────────────────────
// attachment-risk-scanner
// ──────────────────────────────────────────────
import { scanAttachmentRisk } from '@/lib/platform-v7/attachment-risk-scanner';
import type { AttachmentScanInput } from '@/lib/platform-v7/attachment-risk-scanner';

describe('scanAttachmentRisk', () => {
  const base: AttachmentScanInput = { fileName: 'doc.pdf' };

  it('returns manual mode with medium risk and manual_review finding when no OCR and no text', () => {
    const result = scanAttachmentRisk(base);
    expect(result.mode).toBe('manual');
    expect(result.findings.some((f) => f.type === 'manual_review_required')).toBe(true);
  });

  it('returns simulation mode when extractedText provided but no liveOcrEnabled', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'простой текст без данных' });
    expect(result.mode).toBe('simulation');
  });

  it('returns live mode when liveOcrEnabled is true', () => {
    const result = scanAttachmentRisk({ ...base, liveOcrEnabled: true });
    expect(result.mode).toBe('live');
  });

  it('detects phone in extractedText → high risk finding', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'Свяжитесь: +7 916 123-45-67' });
    expect(result.findings.some((f) => f.type === 'phone')).toBe(true);
    expect(result.findings.find((f) => f.type === 'phone')?.riskLevel).toBe('high');
  });

  it('detects email in extractedText → high risk finding', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'Email: grain@example.ru' });
    expect(result.findings.some((f) => f.type === 'email')).toBe(true);
  });

  it('detects external link → medium risk', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'Смотрите: https://example.com' });
    expect(result.findings.some((f) => f.type === 'external_link')).toBe(true);
    expect(result.findings.find((f) => f.type === 'external_link')?.riskLevel).toBe('medium');
  });

  it('detects bank details in text → high risk', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'р/с 40702810000000012345 в Сбербанке' });
    expect(result.findings.some((f) => f.type === 'bank_details')).toBe(true);
    expect(result.findings.find((f) => f.type === 'bank_details')?.riskLevel).toBe('high');
  });

  it('detects address in text → medium risk', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'Склад Пшеничный на ул. Элеваторная 15' });
    expect(result.findings.some((f) => f.type === 'address')).toBe(true);
  });

  it('detects QR code presence → high risk', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'нет данных', hasQrCode: true });
    expect(result.findings.some((f) => f.type === 'qr_code')).toBe(true);
    expect(result.findings.find((f) => f.type === 'qr_code')?.riskLevel).toBe('high');
  });

  it('detects business card → high risk', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'нет данных', hasBusinessCardImage: true });
    expect(result.findings.some((f) => f.type === 'business_card')).toBe(true);
    expect(result.findings.find((f) => f.type === 'business_card')?.riskLevel).toBe('high');
  });

  it('allowPreview is true when riskLevel is not critical', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'простой текст' });
    expect(result.allowPreview).toBe(true);
  });

  it('allowDownload is true only when riskLevel is low', () => {
    const lowRisk = scanAttachmentRisk({ ...base, liveOcrEnabled: true, extractedText: 'простой чистый текст' });
    if (lowRisk.riskLevel === 'low') {
      expect(lowRisk.allowDownload).toBe(true);
    }
    const highRisk = scanAttachmentRisk({ ...base, extractedText: '+7 916 123-45-67' });
    expect(highRisk.allowDownload).toBe(false);
  });

  it('riskLevel reflects max finding risk', () => {
    const result = scanAttachmentRisk({
      ...base,
      extractedText: '+7 916 000-00-00 https://site.ru',
    });
    expect(result.riskLevel).toBe('high');
  });

  it('clean text with liveOcr → low risk, empty findings except possibly none', () => {
    const result = scanAttachmentRisk({ ...base, extractedText: 'партия зерна 50 тонн', liveOcrEnabled: true });
    expect(result.riskLevel).toBe('low');
    expect(result.findings).toHaveLength(0);
    expect(result.allowPreview).toBe(true);
    expect(result.allowDownload).toBe(true);
  });
});

// ──────────────────────────────────────────────
// reputation
// ──────────────────────────────────────────────
import {
  calculateBuyerReliabilityScore,
  calculateSellerReliabilityScore,
  calculateReviewScore,
  ratingAdmission,
} from '@/lib/platform-v7/reputation';
import type { BuyerReliabilityScore, SellerReliabilityScore, DealReview, CounterpartyRedFlag } from '@/lib/platform-v7/reputation';

const makeBuyerInput = (overrides: Partial<Omit<BuyerReliabilityScore, 'totalScore' | 'riskLevel'>> = {}): Omit<BuyerReliabilityScore, 'totalScore' | 'riskLevel'> => ({
  buyerId: 'BUY-001',
  identityScore: 80,
  legalScore: 75,
  financialScore: 70,
  paymentDisciplineScore: 90,
  documentDisciplineScore: 85,
  disputeScore: 80,
  platformHistoryScore: 75,
  counterpartyRatingScore: 70,
  redFlags: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeSellerInput = (overrides: Partial<Omit<SellerReliabilityScore, 'totalScore' | 'riskLevel'>> = {}): Omit<SellerReliabilityScore, 'totalScore' | 'riskLevel'> => ({
  sellerId: 'SEL-001',
  identityScore: 80,
  legalScore: 75,
  batchAccuracyScore: 85,
  qualityAccuracyScore: 80,
  weightAccuracyScore: 90,
  shipmentDisciplineScore: 85,
  documentDisciplineScore: 80,
  sdizDisciplineScore: 75,
  disputeScore: 80,
  platformHistoryScore: 70,
  counterpartyRatingScore: 65,
  redFlags: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeRedFlag = (severity: CounterpartyRedFlag['severity']): CounterpartyRedFlag => ({
  id: `RF-${severity}`,
  counterpartyId: 'CP-001',
  type: 'payment_delay_history',
  severity,
  title: 'test',
  description: 'test flag',
  source: 'platform_history',
  affectsDealAdmission: true,
  affectsPaymentTerms: false,
  requiresManualReview: severity === 'critical',
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('calculateBuyerReliabilityScore', () => {
  it('returns buyer with totalScore and riskLevel fields', () => {
    const result = calculateBuyerReliabilityScore(makeBuyerInput());
    expect(result.buyerId).toBe('BUY-001');
    expect(typeof result.totalScore).toBe('number');
    expect(['low', 'medium', 'high', 'blocked']).toContain(result.riskLevel);
  });

  it('totalScore is clamped to 0-100', () => {
    const result = calculateBuyerReliabilityScore(makeBuyerInput());
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it('red flags reduce totalScore', () => {
    const noFlags = calculateBuyerReliabilityScore(makeBuyerInput());
    const withFlags = calculateBuyerReliabilityScore(makeBuyerInput({ redFlags: [makeRedFlag('critical')] }));
    expect(withFlags.totalScore).toBeLessThan(noFlags.totalScore);
  });

  it('warning flag reduces score less than critical flag', () => {
    const withWarning = calculateBuyerReliabilityScore(makeBuyerInput({ redFlags: [makeRedFlag('warning')] }));
    const withCritical = calculateBuyerReliabilityScore(makeBuyerInput({ redFlags: [makeRedFlag('critical')] }));
    expect(withWarning.totalScore).toBeGreaterThan(withCritical.totalScore);
  });

  it('high scores with no flags produce low risk level', () => {
    const result = calculateBuyerReliabilityScore(makeBuyerInput());
    expect(result.riskLevel).toBe('low');
  });
});

describe('calculateSellerReliabilityScore', () => {
  it('returns seller with totalScore and riskLevel', () => {
    const result = calculateSellerReliabilityScore(makeSellerInput());
    expect(result.sellerId).toBe('SEL-001');
    expect(typeof result.totalScore).toBe('number');
    expect(['low', 'medium', 'high', 'blocked']).toContain(result.riskLevel);
  });

  it('totalScore is clamped to 0-100', () => {
    const result = calculateSellerReliabilityScore(makeSellerInput());
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it('multiple critical flags drive score toward blocked', () => {
    const flags = Array.from({ length: 5 }, () => makeRedFlag('critical'));
    const result = calculateSellerReliabilityScore(makeSellerInput({ redFlags: flags }));
    expect(result.totalScore).toBeLessThan(60);
  });

  it('high scores with no flags produce low risk level', () => {
    const result = calculateSellerReliabilityScore(makeSellerInput());
    expect(result.riskLevel).toBe('low');
  });
});

describe('calculateReviewScore', () => {
  const makeReview = (overrides: Partial<DealReview> = {}): DealReview => ({
    id: 'REV-001',
    dealId: 'DEAL-001',
    reviewerId: 'USR-001',
    reviewerRole: 'buyer',
    reviewedPartyId: 'USR-002',
    reviewedPartyRole: 'seller',
    scores: { quality: 4, delivery: 5, communication: 4 },
    wouldTradeAgain: true,
    status: 'submitted',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('returns a number between 0 and 100', () => {
    const score = calculateReviewScore(makeReview());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('wouldTradeAgain: true gives higher score than false', () => {
    const yes = calculateReviewScore(makeReview({ wouldTradeAgain: true }));
    const no = calculateReviewScore(makeReview({ wouldTradeAgain: false }));
    expect(yes).toBeGreaterThan(no);
  });

  it('all-5 scores with wouldTradeAgain produce high score', () => {
    const score = calculateReviewScore(makeReview({ scores: { a: 5, b: 5, c: 5 }, wouldTradeAgain: true }));
    expect(score).toBeGreaterThan(70);
  });

  it('all-1 scores without wouldTradeAgain produce low score', () => {
    const score = calculateReviewScore(makeReview({ scores: { a: 1, b: 1, c: 1 }, wouldTradeAgain: false }));
    expect(score).toBeLessThan(30);
  });

  it('empty scores default to 0 base', () => {
    const score = calculateReviewScore(makeReview({ scores: {}, wouldTradeAgain: false }));
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('ignores undefined score values', () => {
    const score = calculateReviewScore(makeReview({ scores: { a: 4, b: undefined }, wouldTradeAgain: true }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('ratingAdmission', () => {
  it('score >= 90 → high reliability, automatic admission, no manual review', () => {
    const result = ratingAdmission(95);
    expect(result.automaticAdmission).toBe(true);
    expect(result.requiresManualReview).toBe(false);
    expect(result.label).toContain('Высокая');
  });

  it('score >= 75 → standard admission, no manual review', () => {
    const result = ratingAdmission(80);
    expect(result.automaticAdmission).toBe(true);
    expect(result.requiresManualReview).toBe(false);
  });

  it('score >= 60 → medium risk, manual review required, but automatic admission still allowed', () => {
    const result = ratingAdmission(65);
    expect(result.requiresManualReview).toBe(true);
    expect(result.automaticAdmission).toBe(true);
  });

  it('score >= 40 → high risk, manual review required, no automatic admission', () => {
    const result = ratingAdmission(50);
    expect(result.requiresManualReview).toBe(true);
    expect(result.automaticAdmission).toBe(false);
  });

  it('score < 40 → critical risk, manual review required, no automatic admission', () => {
    const result = ratingAdmission(20);
    expect(result.requiresManualReview).toBe(true);
    expect(result.automaticAdmission).toBe(false);
    expect(result.label).toContain('Критический');
  });
});

// ──────────────────────────────────────────────
// decision-recommendation
// ──────────────────────────────────────────────
import {
  getDecisionRecommendation,
  isDecisionReadyForAction,
  DECISION_RECOMMENDATION_DATA,
  DECISION_PILOT_STATE_LABEL,
} from '@/lib/platform-v7/decision-recommendation';
import type { DecisionRecommendationContext } from '@/lib/platform-v7/decision-recommendation';

const CONTEXTS: DecisionRecommendationContext[] = ['disputes', 'bank', 'elevator'];

describe('getDecisionRecommendation', () => {
  for (const ctx of CONTEXTS) {
    it(`returns record for context "${ctx}"`, () => {
      const rec = getDecisionRecommendation(ctx);
      expect(rec.recommendation).toBeTruthy();
      expect(rec.responsible).toBeTruthy();
      expect(Array.isArray(rec.requiredEvidence)).toBe(true);
      expect(rec.requiredEvidence.length).toBeGreaterThan(0);
      expect(rec.cannotProceedBecause).toBeTruthy();
      expect(rec.pilotState).toBeTruthy();
      expect(rec.pilotStateLabel).toBeTruthy();
    });
  }

  it('disputes context has awaiting_evidence pilotState', () => {
    expect(getDecisionRecommendation('disputes').pilotState).toBe('awaiting_evidence');
  });

  it('bank context has awaiting_evidence pilotState', () => {
    expect(getDecisionRecommendation('bank').pilotState).toBe('awaiting_evidence');
  });

  it('elevator context has awaiting_evidence pilotState', () => {
    expect(getDecisionRecommendation('elevator').pilotState).toBe('awaiting_evidence');
  });
});

describe('isDecisionReadyForAction', () => {
  it('returns false for all current contexts (all are awaiting_evidence)', () => {
    for (const ctx of CONTEXTS) {
      expect(isDecisionReadyForAction(ctx)).toBe(false);
    }
  });
});

describe('DECISION_PILOT_STATE_LABEL', () => {
  it('has labels for all 3 pilot states', () => {
    expect(DECISION_PILOT_STATE_LABEL.awaiting_evidence).toBeTruthy();
    expect(DECISION_PILOT_STATE_LABEL.requires_manual_review).toBeTruthy();
    expect(DECISION_PILOT_STATE_LABEL.ready_for_decision).toBeTruthy();
  });
});

describe('DECISION_RECOMMENDATION_DATA', () => {
  it('contains all 3 contexts', () => {
    expect(Object.keys(DECISION_RECOMMENDATION_DATA)).toHaveLength(3);
  });

  it('each context record has required pilotStateLabel matching DECISION_PILOT_STATE_LABEL', () => {
    for (const ctx of CONTEXTS) {
      const rec = DECISION_RECOMMENDATION_DATA[ctx];
      expect(rec.pilotStateLabel).toBe(DECISION_PILOT_STATE_LABEL[rec.pilotState]);
    }
  });
});

// ──────────────────────────────────────────────
// document-money-decision-pack
// ──────────────────────────────────────────────
import {
  getDecisionPackRows,
  getBlockedRows,
  DECISION_PACK_DATA,
  DECISION_PACK_CONTEXTS,
  DECISION_PACK_CONTEXT_LABEL,
} from '@/lib/platform-v7/document-money-decision-pack';
import type { DecisionPackContext } from '@/lib/platform-v7/document-money-decision-pack';

describe('getDecisionPackRows', () => {
  for (const ctx of DECISION_PACK_CONTEXTS) {
    it(`returns non-empty rows for context "${ctx}"`, () => {
      const rows = getDecisionPackRows(ctx as DecisionPackContext);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.rowId).toBeTruthy();
        expect(row.requiredDocumentEvidence).toBeTruthy();
        expect(row.responsibleRole).toBeTruthy();
        expect(row.currentPilotState).toBeTruthy();
        expect(row.moneyImpact).toBeTruthy();
        expect(row.safeNextAction).toBeTruthy();
        expect(row.pilotNote).toBeTruthy();
      }
    });
  }
});

describe('getBlockedRows', () => {
  it('returns only rows with blocked state', () => {
    for (const ctx of DECISION_PACK_CONTEXTS) {
      const blocked = getBlockedRows(ctx as DecisionPackContext);
      for (const row of blocked) {
        expect(row.currentPilotState).toBe('blocked');
      }
    }
  });

  it('dl9106_payout_review has blocked rows', () => {
    expect(getBlockedRows('dl9106_payout_review').length).toBeGreaterThan(0);
  });

  it('buyer_reserve_request has zero blocked rows (all allowed)', () => {
    expect(getBlockedRows('buyer_reserve_request').length).toBe(0);
  });
});

describe('DECISION_PACK_CONTEXTS', () => {
  it('contains all 5 expected contexts', () => {
    expect(DECISION_PACK_CONTEXTS).toContain('dl9106_payout_review');
    expect(DECISION_PACK_CONTEXTS).toContain('dl9102_dispute_hold');
    expect(DECISION_PACK_CONTEXTS).toContain('seller_document_handoff');
    expect(DECISION_PACK_CONTEXTS).toContain('buyer_reserve_request');
    expect(DECISION_PACK_CONTEXTS).toContain('bank_release_review');
    expect(DECISION_PACK_CONTEXTS).toHaveLength(5);
  });
});

describe('DECISION_PACK_CONTEXT_LABEL', () => {
  it('has a label for each context', () => {
    for (const ctx of DECISION_PACK_CONTEXTS) {
      expect(DECISION_PACK_CONTEXT_LABEL[ctx as DecisionPackContext]).toBeTruthy();
    }
  });
});

describe('DECISION_PACK_DATA', () => {
  it('all rows have non-null pilotNote', () => {
    for (const ctx of DECISION_PACK_CONTEXTS) {
      for (const row of DECISION_PACK_DATA[ctx as DecisionPackContext]) {
        expect(row.pilotNote).toBeTruthy();
      }
    }
  });

  it('rows with blocker have non-null blocker string', () => {
    const hasBlockerRow = DECISION_PACK_DATA.dl9106_payout_review.find((r) => r.blocker !== null);
    expect(hasBlockerRow?.blocker).toBeTruthy();
  });

  it('buyer_reserve_request rows have null blocker (allowed)', () => {
    const rows = DECISION_PACK_DATA.buyer_reserve_request;
    for (const row of rows) {
      expect(row.blocker).toBeNull();
    }
  });
});

// ──────────────────────────────────────────────
// journal-preview
// ──────────────────────────────────────────────
import { getJournalPreviewEntries } from '@/lib/platform-v7/journal-preview';

describe('getJournalPreviewEntries', () => {
  const roles = ['seller', 'buyer', 'bank', 'arbitrator'] as const;

  for (const role of roles) {
    it(`returns entries for role "${role}"`, () => {
      const entries = getJournalPreviewEntries(role);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.id).toBeTruthy();
        expect(entry.scope).toBeTruthy();
        expect(entry.status).toBeTruthy();
        expect(entry.objectId).toBeTruthy();
        expect(entry.action).toBeTruthy();
        expect(entry.at).toBeTruthy();
        expect(entry.message).toBeTruthy();
      }
    });
  }

  it('respects maxEntries limit', () => {
    expect(getJournalPreviewEntries('seller', 1)).toHaveLength(1);
    expect(getJournalPreviewEntries('seller', 2)).toHaveLength(2);
  });

  it('defaults to 3 entries when maxEntries not specified', () => {
    const entries = getJournalPreviewEntries('buyer');
    expect(entries.length).toBeLessThanOrEqual(3);
  });

  it('seller entries include lot scope', () => {
    const entries = getJournalPreviewEntries('seller');
    expect(entries.some((e) => e.scope === 'lot')).toBe(true);
  });

  it('bank entries include bank scope', () => {
    const entries = getJournalPreviewEntries('bank');
    expect(entries.some((e) => e.scope === 'bank')).toBe(true);
  });

  it('arbitrator entries include dispute scope', () => {
    const entries = getJournalPreviewEntries('arbitrator');
    expect(entries.some((e) => e.scope === 'dispute')).toBe(true);
  });

  it('entries are returned in chronological order (by at field)', () => {
    for (const role of roles) {
      const entries = getJournalPreviewEntries(role);
      for (let i = 1; i < entries.length; i++) {
        expect(new Date(entries[i].at).getTime()).toBeGreaterThanOrEqual(new Date(entries[i - 1].at).getTime());
      }
    }
  });
});

// ──────────────────────────────────────────────
// direct-money-boundaries
// ──────────────────────────────────────────────
import {
  PLATFORM_V7_DIRECT_MONEY_BOUNDARIES,
  isPlatformV7DirectMoneyBoundary,
} from '@/lib/platform-v7/direct-money-boundaries';

describe('PLATFORM_V7_DIRECT_MONEY_BOUNDARIES', () => {
  it('contains all 4 money boundary ids', () => {
    expect(PLATFORM_V7_DIRECT_MONEY_BOUNDARIES).toContain('request_money_reserve');
    expect(PLATFORM_V7_DIRECT_MONEY_BOUNDARIES).toContain('confirm_money_reserved');
    expect(PLATFORM_V7_DIRECT_MONEY_BOUNDARIES).toContain('mark_money_ready_to_release');
    expect(PLATFORM_V7_DIRECT_MONEY_BOUNDARIES).toContain('confirm_money_released');
    expect(PLATFORM_V7_DIRECT_MONEY_BOUNDARIES).toHaveLength(4);
  });
});

describe('isPlatformV7DirectMoneyBoundary', () => {
  it('returns true for all 4 money boundary ids', () => {
    expect(isPlatformV7DirectMoneyBoundary('request_money_reserve')).toBe(true);
    expect(isPlatformV7DirectMoneyBoundary('confirm_money_reserved')).toBe(true);
    expect(isPlatformV7DirectMoneyBoundary('mark_money_ready_to_release')).toBe(true);
    expect(isPlatformV7DirectMoneyBoundary('confirm_money_released')).toBe(true);
  });

  it('returns false for non-money boundary ids', () => {
    expect(isPlatformV7DirectMoneyBoundary('publish_lot')).toBe(false);
    expect(isPlatformV7DirectMoneyBoundary('assign_logistics')).toBe(false);
    expect(isPlatformV7DirectMoneyBoundary('')).toBe(false);
    expect(isPlatformV7DirectMoneyBoundary('CONFIRM_MONEY_RESERVED')).toBe(false);
  });

  it('is case-sensitive (uppercase does not match)', () => {
    expect(isPlatformV7DirectMoneyBoundary('REQUEST_MONEY_RESERVE')).toBe(false);
  });
});
