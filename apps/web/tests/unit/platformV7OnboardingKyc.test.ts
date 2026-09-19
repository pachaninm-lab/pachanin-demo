import { describe, expect, it } from 'vitest';
import type { PlatformV7OnboardingKycInput } from '@/lib/platform-v7/onboarding-kyc';
import {
  platformV7OnboardingKycBlockers,
  platformV7OnboardingKycModel,
  platformV7OnboardingKycNextAction,
  platformV7OnboardingKycReadinessPercent,
  platformV7OnboardingKycReviewReasons,
  platformV7OnboardingKycStatus,
  platformV7OnboardingKycTone,
} from '@/lib/platform-v7/onboarding-kyc';

const approvedSeller: PlatformV7OnboardingKycInput = {
  companyId: 'CMP-1',
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
};

describe('platform-v7 onboarding kyc model', () => {
  it('approves a fully verified seller profile', () => {
    const model = platformV7OnboardingKycModel(approvedSeller);

    expect(model.status).toBe('approved');
    expect(model.readinessPercent).toBe(100);
    expect(model.canCreateLot).toBe(true);
    expect(model.canCreatePurchaseRequest).toBe(false);
    expect(model.canEnterDeal).toBe(true);
    expect(model.canReceiveMoney).toBe(true);
    expect(model.tone).toBe('success');
  });

  it('keeps incomplete required profile data blocked', () => {
    const model = platformV7OnboardingKycModel({
      ...approvedSeller,
      inn: 'missing',
      bankAccount: 'missing',
      roleDocumentsReady: false,
    });

    expect(model.status).toBe('incomplete');
    expect(model.canEnterDeal).toBe(false);
    expect(model.blockerCount).toBe(3);
    expect(model.tone).toBe('warning');
  });

  it('routes pending checks to operator review', () => {
    const model = platformV7OnboardingKycModel({
      ...approvedSeller,
      beneficialOwner: 'manual_review',
      taxRisk: 'pending',
    });

    expect(model.status).toBe('manual_review');
    expect(model.canEnterDeal).toBe(false);
    expect(model.reviewReasons).toEqual(['beneficial-owner', 'tax-risk-pending']);
  });

  it('stops access on failed critical screening', () => {
    const model = platformV7OnboardingKycModel({
      ...approvedSeller,
      amlScreening: 'failed',
    });

    expect(model.status).toBe('rejected');
    expect(model.canEnterDeal).toBe(false);
    expect(model.tone).toBe('danger');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7OnboardingKycBlockers(approvedSeller)).toEqual([]);
    expect(platformV7OnboardingKycReviewReasons(approvedSeller)).toEqual([]);
    expect(platformV7OnboardingKycStatus(approvedSeller)).toBe('approved');
    expect(platformV7OnboardingKycReadinessPercent(approvedSeller)).toBe(100);
    expect(platformV7OnboardingKycTone('not_started')).toBe('neutral');
    expect(platformV7OnboardingKycNextAction('approved', [], [])).toBe('Компания допущена к сделкам.');
  });
});
