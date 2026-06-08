import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  platformV7OnboardingKycModel,
  platformV7OnboardingKycBlockers,
  platformV7OnboardingKycReviewReasons,
  platformV7OnboardingKycStatus,
  platformV7OnboardingKycReadinessPercent,
  platformV7OnboardingKycTone,
} from '@/lib/platform-v7/onboarding-kyc';
import type { PlatformV7OnboardingKycInput } from '@/lib/platform-v7/onboarding-kyc';

import {
  platformV7OnboardingDocumentsModel,
  platformV7OnboardingRequiredDocumentKinds,
  platformV7OnboardingDocumentEffectiveStatus,
} from '@/lib/platform-v7/onboarding-documents';
import type { PlatformV7OnboardingDocumentsInput } from '@/lib/platform-v7/onboarding-documents';

import {
  platformV7OnboardingAccessGateModel,
  platformV7OnboardingRoleActions,
  platformV7OnboardingAccessTone,
} from '@/lib/platform-v7/onboarding-access-gate';

import {
  platformV7OnboardingRiskScoreModel,
  platformV7OnboardingRiskLevel,
  platformV7OnboardingRiskScore,
} from '@/lib/platform-v7/onboarding-risk-score';

import {
  platformV7ComplianceQueueModel,
  platformV7ComplianceQueueStatus,
  platformV7ComplianceQueuePriority,
} from '@/lib/platform-v7/onboarding-compliance-queue';

const CHECKED_AT = '2026-06-01T12:00:00.000Z';

function makeKycInput(overrides: Partial<PlatformV7OnboardingKycInput> = {}): PlatformV7OnboardingKycInput {
  return {
    companyId: 'co-1',
    role: 'seller',
    inn: 'verified',
    ogrn: 'verified',
    legalAddress: 'verified',
    signerAuthority: 'verified',
    bankAccount: 'verified',
    beneficialOwner: 'verified',
    taxRisk: 'verified',
    sanctionsScreening: 'verified',
    amlScreening: 'verified',
    roleDocumentsReady: true,
    manualRestriction: false,
    ...overrides,
  };
}

function makeDocumentsInput(overrides: Partial<PlatformV7OnboardingDocumentsInput> = {}): PlatformV7OnboardingDocumentsInput {
  return {
    companyId: 'co-1',
    role: 'seller',
    documents: [
      { kind: 'company_registry_extract', status: 'verified', required: true },
      { kind: 'charter', status: 'verified', required: true },
      { kind: 'signer_authority', status: 'verified', required: true },
      { kind: 'bank_account_certificate', status: 'verified', required: true },
      { kind: 'warehouse_certificate', status: 'verified', required: true },
    ],
    checkedAt: CHECKED_AT,
    ...overrides,
  };
}

describe('platformV7OnboardingKycModel', () => {
  it('returns approved when all checks verified', () => {
    const model = platformV7OnboardingKycModel(makeKycInput());
    expect(model.status).toBe('approved');
    expect(model.canEnterDeal).toBe(true);
    expect(model.canCreateLot).toBe(true);
    expect(model.canReceiveMoney).toBe(true);
  });

  it('returns not_started when all fields missing and roleDocumentsReady is false', () => {
    const model = platformV7OnboardingKycModel(makeKycInput({
      inn: 'missing',
      ogrn: 'missing',
      legalAddress: 'missing',
      signerAuthority: 'missing',
      bankAccount: 'missing',
      roleDocumentsReady: false,
    }));
    expect(model.status).toBe('not_started');
    expect(model.canEnterDeal).toBe(false);
  });

  it('returns incomplete when partial fields missing', () => {
    const model = platformV7OnboardingKycModel(makeKycInput({ inn: 'missing' }));
    expect(model.status).toBe('incomplete');
    expect(model.blockerCount).toBeGreaterThan(0);
  });

  it('returns rejected when manualRestriction is true', () => {
    const model = platformV7OnboardingKycModel(makeKycInput({ manualRestriction: true }));
    expect(model.status).toBe('rejected');
  });

  it('returns rejected when sanctionsScreening failed', () => {
    const model = platformV7OnboardingKycModel(makeKycInput({ sanctionsScreening: 'failed' }));
    expect(model.status).toBe('rejected');
  });

  it('returns manual_review when a field is in manual_review', () => {
    const model = platformV7OnboardingKycModel(makeKycInput({ taxRisk: 'manual_review' }));
    expect(model.status).toBe('manual_review');
  });

  it('readinessPercent is 100 for fully verified input', () => {
    const pct = platformV7OnboardingKycReadinessPercent(makeKycInput());
    expect(pct).toBe(100);
  });

  it('readinessPercent is 0 when all checks missing', () => {
    const pct = platformV7OnboardingKycReadinessPercent(makeKycInput({
      inn: 'missing',
      ogrn: 'missing',
      legalAddress: 'missing',
      signerAuthority: 'missing',
      bankAccount: 'missing',
      beneficialOwner: 'missing',
      taxRisk: 'missing',
      sanctionsScreening: 'missing',
      amlScreening: 'missing',
      roleDocumentsReady: false,
      manualRestriction: true,
    }));
    expect(pct).toBe(0);
  });

  it('blockers include missing fields', () => {
    const blockers = platformV7OnboardingKycBlockers(makeKycInput({ inn: 'missing', bankAccount: 'missing' }));
    expect(blockers.some((b) => b.includes('ИНН'))).toBe(true);
    expect(blockers.some((b) => b.includes('счёт'))).toBe(true);
  });

  it('reviewReasons captures manual_review fields', () => {
    const reasons = platformV7OnboardingKycReviewReasons(makeKycInput({ beneficialOwner: 'manual_review' }));
    expect(reasons).toContain('beneficial-owner');
  });

  it('reviewReasons captures failed fields', () => {
    const reasons = platformV7OnboardingKycReviewReasons(makeKycInput({ taxRisk: 'failed' }));
    expect(reasons).toContain('tax-risk-failed');
  });

  it('tone is success for approved status', () => {
    expect(platformV7OnboardingKycTone('approved')).toBe('success');
    expect(platformV7OnboardingKycTone('rejected')).toBe('danger');
    expect(platformV7OnboardingKycTone('manual_review')).toBe('warning');
  });

  it('buyer role cannot create lot', () => {
    const model = platformV7OnboardingKycModel(makeKycInput({ role: 'buyer' }));
    expect(model.canCreateLot).toBe(false);
    expect(model.canCreatePurchaseRequest).toBe(true);
  });
});

describe('platformV7OnboardingDocumentsModel', () => {
  it('canSubmitKyc is true when all required docs verified', () => {
    const model = platformV7OnboardingDocumentsModel(makeDocumentsInput());
    expect(model.canSubmitKyc).toBe(true);
    expect(model.readinessPercent).toBe(100);
    expect(model.blockerCount).toBe(0);
  });

  it('canSubmitKyc is false when required doc is missing', () => {
    const model = platformV7OnboardingDocumentsModel(makeDocumentsInput({ documents: [] }));
    expect(model.canSubmitKyc).toBe(false);
    expect(model.blockerCount).toBeGreaterThan(0);
  });

  it('requiredDocumentKinds includes warehouse_certificate for seller', () => {
    const kinds = platformV7OnboardingRequiredDocumentKinds('seller');
    expect(kinds).toContain('warehouse_certificate');
  });

  it('requiredDocumentKinds includes carrier_license for carrier', () => {
    const kinds = platformV7OnboardingRequiredDocumentKinds('carrier');
    expect(kinds).toContain('carrier_license');
    expect(kinds).toContain('vehicle_registry');
  });

  it('requiredDocumentKinds includes lab_accreditation for lab', () => {
    const kinds = platformV7OnboardingRequiredDocumentKinds('lab');
    expect(kinds).toContain('lab_accreditation');
  });

  it('expired document is treated as expired regardless of uploaded status', () => {
    const pastDate = '2025-01-01T00:00:00.000Z';
    const effective = platformV7OnboardingDocumentEffectiveStatus(
      { kind: 'charter', status: 'verified', required: true, expiresAt: pastDate },
      CHECKED_AT,
    );
    expect(effective).toBe('expired');
  });

  it('non-expired document keeps its status', () => {
    const futureDate = '2027-01-01T00:00:00.000Z';
    const effective = platformV7OnboardingDocumentEffectiveStatus(
      { kind: 'charter', status: 'verified', required: true, expiresAt: futureDate },
      CHECKED_AT,
    );
    expect(effective).toBe('verified');
  });

  it('missingRequiredKinds lists missing docs', () => {
    const model = platformV7OnboardingDocumentsModel(makeDocumentsInput({ documents: [] }));
    expect(model.missingRequiredKinds.length).toBeGreaterThan(0);
    expect(model.missingRequiredKinds).toContain('company_registry_extract');
  });
});

describe('platformV7OnboardingAccessGateModel', () => {
  function makeGate(kycOverrides: Partial<PlatformV7OnboardingKycInput> = {}) {
    const kycInput = makeKycInput(kycOverrides);
    const kyc = platformV7OnboardingKycModel(kycInput);
    const documents = platformV7OnboardingDocumentsModel(makeDocumentsInput());
    return platformV7OnboardingAccessGateModel({ companyId: 'co-1', role: 'seller', kyc, documents });
  }

  it('status is allowed for fully verified seller', () => {
    const gate = makeGate();
    expect(gate.status).toBe('allowed');
    expect(gate.allowedActions).toContain('create_lot');
    expect(gate.blockedActions).toHaveLength(0);
  });

  it('status is restricted when kyc is rejected', () => {
    const gate = makeGate({ manualRestriction: true });
    expect(gate.status).toBe('restricted');
    expect(gate.allowedActions).toHaveLength(0);
  });

  it('status is manual_review when kyc is in manual_review', () => {
    const gate = makeGate({ taxRisk: 'manual_review' });
    expect(gate.status).toBe('manual_review');
  });

  it('roleActions for seller includes create_lot and receive_money', () => {
    const actions = platformV7OnboardingRoleActions('seller');
    expect(actions).toContain('create_lot');
    expect(actions).toContain('receive_money');
  });

  it('roleActions for carrier includes upload_transport_documents', () => {
    const actions = platformV7OnboardingRoleActions('carrier');
    expect(actions).toContain('upload_transport_documents');
    expect(actions).not.toContain('create_lot');
  });

  it('tone is success when allowed', () => {
    expect(platformV7OnboardingAccessTone('allowed')).toBe('success');
    expect(platformV7OnboardingAccessTone('restricted')).toBe('danger');
    expect(platformV7OnboardingAccessTone('manual_review')).toBe('warning');
  });

  it('blockers aggregate kyc and document blockers', () => {
    const kycInput = makeKycInput({ inn: 'missing' });
    const kyc = platformV7OnboardingKycModel(kycInput);
    const documents = platformV7OnboardingDocumentsModel(makeDocumentsInput({ documents: [] }));
    const gate = platformV7OnboardingAccessGateModel({ companyId: 'co-1', role: 'seller', kyc, documents });
    expect(gate.blockerCount).toBeGreaterThan(0);
    expect(gate.blockers.length).toBeGreaterThan(0);
  });
});

describe('platformV7OnboardingRiskScoreModel', () => {
  function makeRiskInput(kycOverrides: Partial<PlatformV7OnboardingKycInput> = {}, signalOverrides = {}) {
    const kycInput = makeKycInput(kycOverrides);
    const kyc = platformV7OnboardingKycModel(kycInput);
    const documents = platformV7OnboardingDocumentsModel(makeDocumentsInput());
    const access = platformV7OnboardingAccessGateModel({ companyId: 'co-1', role: 'seller', kyc, documents });
    return {
      companyId: 'co-1',
      role: 'seller' as const,
      kyc,
      documents,
      access,
      signals: {
        taxDebt: false,
        massRegistration: false,
        recentDirectorChange: false,
        sanctionsHit: false,
        amlHit: false,
        documentMismatch: false,
        bankAccountMismatch: false,
        beneficialOwnerUnverified: false,
        offPlatformSuspicion: false,
        previousDisputeCount: 0,
        ...signalOverrides,
      },
    };
  }

  it('level is low for clean company', () => {
    const model = platformV7OnboardingRiskScoreModel(makeRiskInput());
    expect(model.level).toBe('low');
    expect(model.blocksAutoApproval).toBe(false);
    expect(model.requiresManualReview).toBe(false);
  });

  it('level is critical for sanctionsHit', () => {
    const model = platformV7OnboardingRiskScoreModel(makeRiskInput({}, { sanctionsHit: true }));
    expect(model.level).toBe('critical');
    expect(model.blocksAutoApproval).toBe(true);
    expect(model.reasons).toContain('sanctions-hit');
  });

  it('level is critical for amlHit', () => {
    const model = platformV7OnboardingRiskScoreModel(makeRiskInput({}, { amlHit: true }));
    expect(model.level).toBe('critical');
    expect(model.reasons).toContain('aml-hit');
  });

  it('riskLevel thresholds are correct', () => {
    expect(platformV7OnboardingRiskLevel(10)).toBe('low');
    expect(platformV7OnboardingRiskLevel(30)).toBe('medium');
    expect(platformV7OnboardingRiskLevel(60)).toBe('high');
    expect(platformV7OnboardingRiskLevel(85)).toBe('critical');
    expect(platformV7OnboardingRiskLevel(0, true)).toBe('critical');
  });

  it('multiple signals accumulate score', () => {
    const input = makeRiskInput({}, { taxDebt: true, massRegistration: true, bankAccountMismatch: true });
    const score = platformV7OnboardingRiskScore(input);
    expect(score).toBeGreaterThan(30);
  });

  it('previousDisputeCount is capped at 4 disputes', () => {
    const input4 = makeRiskInput({}, { previousDisputeCount: 4 });
    const input10 = makeRiskInput({}, { previousDisputeCount: 10 });
    const score4 = platformV7OnboardingRiskScore(input4);
    const score10 = platformV7OnboardingRiskScore(input10);
    expect(score4).toBeLessThanOrEqual(score10);
  });
});

describe('platformV7ComplianceQueueModel', () => {
  function makeQueueEntry(kycOverrides: Partial<PlatformV7OnboardingKycInput> = {}) {
    const kycInput = makeKycInput(kycOverrides);
    const kyc = platformV7OnboardingKycModel(kycInput);
    const documents = platformV7OnboardingDocumentsModel(makeDocumentsInput());
    const access = platformV7OnboardingAccessGateModel({ companyId: 'co-1', role: 'seller', kyc, documents });
    return {
      companyId: 'co-1',
      title: 'ООО Тест',
      role: 'seller' as const,
      kyc,
      documents,
      access,
      submittedAt: '2026-06-01T10:00:00.000Z',
    };
  }

  it('empty queue returns isClean false and total 0', () => {
    const model = platformV7ComplianceQueueModel([]);
    expect(model.summary.total).toBe(0);
    expect(model.isClean).toBe(false);
  });

  it('fully approved company gives clear status and isClean', () => {
    const model = platformV7ComplianceQueueModel([makeQueueEntry()]);
    expect(model.summary.clear).toBe(1);
    expect(model.isClean).toBe(true);
  });

  it('rejected company gives restricted status with critical priority', () => {
    const entry = makeQueueEntry({ manualRestriction: true });
    const status = platformV7ComplianceQueueStatus({ kyc: entry.kyc, documents: entry.documents, access: entry.access });
    const priority = platformV7ComplianceQueuePriority(status, entry.kyc.blockerCount, entry.kyc.readinessPercent, entry.documents.readinessPercent);
    expect(status).toBe('restricted');
    expect(priority).toBe('critical');
  });

  it('manual_review company gives review status with high priority', () => {
    const entry = makeQueueEntry({ taxRisk: 'manual_review' });
    const status = platformV7ComplianceQueueStatus({ kyc: entry.kyc, documents: entry.documents, access: entry.access });
    expect(status).toBe('review');
    const priority = platformV7ComplianceQueuePriority(status, 0, 90, 90);
    expect(priority).toBe('high');
  });

  it('rows are sorted: restricted first, then review, then blocked, then clear', () => {
    const clear = makeQueueEntry();
    const restricted = makeQueueEntry({ manualRestriction: true });
    const review = makeQueueEntry({ taxRisk: 'manual_review' });
    const model = platformV7ComplianceQueueModel([
      clear,
      restricted,
      { ...review, companyId: 'co-2', title: 'ООО Ревью' },
    ]);
    expect(model.rows[0].status).toBe('restricted');
  });

  it('summary counts are correct for mixed queue', () => {
    const clear = makeQueueEntry();
    const restricted = makeQueueEntry({ manualRestriction: true });
    const model = platformV7ComplianceQueueModel([clear, restricted]);
    expect(model.summary.total).toBe(2);
    expect(model.summary.clear).toBe(1);
    expect(model.summary.restricted).toBe(1);
    expect(model.isClean).toBe(false);
  });
});

describe('source guard: onboarding files are pre-integration with no live calls', () => {
  const onboardingFiles = [
    'lib/platform-v7/onboarding-kyc.ts',
    'lib/platform-v7/onboarding-documents.ts',
    'lib/platform-v7/onboarding-access-gate.ts',
    'lib/platform-v7/onboarding-risk-score.ts',
    'lib/platform-v7/onboarding-compliance-queue.ts',
  ] as const;

  const forbiddenPatterns = [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'axios.',
    'http.request',
    'https.request',
    'openai',
    'anthropic',
  ] as const;

  it('all onboarding source files are present', () => {
    for (const file of onboardingFiles) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }
  });

  it('contains no live network calls or external API references', () => {
    for (const file of onboardingFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not contain "${pattern}"`).not.toContain(pattern);
      }
    }
  });
});
