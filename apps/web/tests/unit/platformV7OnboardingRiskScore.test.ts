import { describe, expect, it } from 'vitest';
import type { PlatformV7OnboardingAccessGateModel } from '@/lib/platform-v7/onboarding-access-gate';
import type { PlatformV7OnboardingDocumentsModel } from '@/lib/platform-v7/onboarding-documents';
import type { PlatformV7OnboardingKycModel } from '@/lib/platform-v7/onboarding-kyc';
import type { PlatformV7OnboardingRiskSignals } from '@/lib/platform-v7/onboarding-risk-score';
import {
  platformV7OnboardingRiskLevel,
  platformV7OnboardingRiskModel,
  platformV7OnboardingRiskNextAction,
  platformV7OnboardingRiskReasons,
  platformV7OnboardingRiskScore,
  platformV7OnboardingRiskTone,
} from '@/lib/platform-v7/onboarding-risk-score';

const cleanSignals: PlatformV7OnboardingRiskSignals = {
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
};

const approvedKyc: PlatformV7OnboardingKycModel = {
  companyId: 'CMP-1',
  role: 'seller',
  status: 'approved',
  readinessPercent: 100,
  canCreateLot: true,
  canCreatePurchaseRequest: false,
  canEnterDeal: true,
  canReceiveMoney: true,
  blockerCount: 0,
  blockers: [],
  reviewReasons: [],
  nextAction: 'Компания допущена к сделкам.',
  tone: 'success',
};

const readyDocs: PlatformV7OnboardingDocumentsModel = {
  companyId: 'CMP-1',
  role: 'seller',
  readinessPercent: 100,
  canSubmitKyc: true,
  requiredCount: 5,
  verifiedRequiredCount: 5,
  blockerCount: 0,
  blockers: [],
  missingRequiredKinds: [],
  rows: [],
  nextAction: 'Документы готовы к проверке допуска.',
  tone: 'success',
};

const allowedAccess: PlatformV7OnboardingAccessGateModel = {
  companyId: 'CMP-1',
  role: 'seller',
  status: 'allowed',
  allowedActions: ['create_lot', 'enter_deal', 'sign_contract', 'receive_money'],
  blockedActions: [],
  blockerCount: 0,
  blockers: [],
  rows: [],
  nextAction: 'Участник допущен к своим действиям.',
  tone: 'success',
};

describe('platform-v7 onboarding risk score', () => {
  it('keeps clean verified company low risk', () => {
    const model = platformV7OnboardingRiskModel({
      companyId: 'CMP-1',
      role: 'seller',
      kyc: approvedKyc,
      documents: readyDocs,
      access: allowedAccess,
      signals: cleanSignals,
    });

    expect(model.level).toBe('low');
    expect(model.score).toBe(0);
    expect(model.blocksAutoApproval).toBe(false);
    expect(model.requiresManualReview).toBe(false);
    expect(model.tone).toBe('success');
  });

  it('forces critical risk for sanctions hit', () => {
    const model = platformV7OnboardingRiskModel({
      companyId: 'CMP-2',
      role: 'buyer',
      kyc: approvedKyc,
      documents: readyDocs,
      access: allowedAccess,
      signals: { ...cleanSignals, sanctionsHit: true },
    });

    expect(model.level).toBe('critical');
    expect(model.blocksAutoApproval).toBe(true);
    expect(model.requiresManualReview).toBe(true);
    expect(model.reasons).toContain('sanctions-hit');
  });

  it('raises review risk for document and bank mismatches', () => {
    const model = platformV7OnboardingRiskModel({
      companyId: 'CMP-3',
      role: 'carrier',
      kyc: { ...approvedKyc, readinessPercent: 80 },
      documents: { ...readyDocs, readinessPercent: 60, blockerCount: 2 },
      access: { ...allowedAccess, status: 'blocked' },
      signals: { ...cleanSignals, documentMismatch: true, bankAccountMismatch: true, previousDisputeCount: 2 },
    });

    expect(model.level).not.toBe('low');
    expect(model.requiresManualReview).toBe(true);
    expect(model.reasons).toContain('document-mismatch');
    expect(model.reasons).toContain('bank-account-mismatch');
  });

  it('keeps helper outputs deterministic', () => {
    const input = {
      companyId: 'CMP-4',
      role: 'seller' as const,
      kyc: approvedKyc,
      documents: readyDocs,
      access: allowedAccess,
      signals: cleanSignals,
    };

    expect(platformV7OnboardingRiskReasons(input)).toEqual([]);
    expect(platformV7OnboardingRiskScore(input)).toBe(0);
    expect(platformV7OnboardingRiskLevel(90)).toBe('critical');
    expect(platformV7OnboardingRiskTone('medium')).toBe('warning');
    expect(platformV7OnboardingRiskNextAction('low', false, [])).toBe('Автодопуск возможен после стандартной проверки.');
  });
});
