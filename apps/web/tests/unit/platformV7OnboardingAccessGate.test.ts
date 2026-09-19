import { describe, expect, it } from 'vitest';
import type { PlatformV7OnboardingDocumentsModel } from '@/lib/platform-v7/onboarding-documents';
import type { PlatformV7OnboardingKycModel } from '@/lib/platform-v7/onboarding-kyc';
import {
  platformV7OnboardingAccessGateModel,
  platformV7OnboardingAccessNextAction,
  platformV7OnboardingAccessTone,
  platformV7OnboardingActionAllowedByKyc,
  platformV7OnboardingRoleActions,
} from '@/lib/platform-v7/onboarding-access-gate';

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
  nextAction: 'ok',
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
  nextAction: 'ok',
  tone: 'success',
};

describe('platform-v7 onboarding access gate', () => {
  it('allows seller actions when KYC and documents are ready', () => {
    const model = platformV7OnboardingAccessGateModel({
      companyId: 'CMP-1',
      role: 'seller',
      kyc: approvedKyc,
      documents: readyDocs,
    });

    expect(model.status).toBe('allowed');
    expect(model.allowedActions).toEqual(['create_lot', 'enter_deal', 'sign_contract', 'receive_money']);
    expect(model.blockedActions).toEqual([]);
    expect(model.tone).toBe('success');
  });

  it('blocks access when documents are incomplete', () => {
    const model = platformV7OnboardingAccessGateModel({
      companyId: 'CMP-1',
      role: 'seller',
      kyc: approvedKyc,
      documents: {
        ...readyDocs,
        canSubmitKyc: false,
        blockers: ['warehouse_certificate:missing'],
      },
    });

    expect(model.status).toBe('blocked');
    expect(model.allowedActions).toEqual([]);
    expect(model.blockedActions.length).toBe(4);
    expect(model.blockers).toContain('document:warehouse_certificate:missing');
  });

  it('routes manual review state to compliance operator', () => {
    const model = platformV7OnboardingAccessGateModel({
      companyId: 'CMP-1',
      role: 'seller',
      kyc: {
        ...approvedKyc,
        status: 'manual_review',
        canCreateLot: false,
        canEnterDeal: false,
        canReceiveMoney: false,
        reviewReasons: ['beneficial-owner'],
      },
      documents: readyDocs,
    });

    expect(model.status).toBe('manual_review');
    expect(model.tone).toBe('warning');
    expect(model.nextAction).toBe('Передать участника оператору комплаенса.');
  });

  it('restricts rejected KYC profiles', () => {
    const model = platformV7OnboardingAccessGateModel({
      companyId: 'CMP-1',
      role: 'seller',
      kyc: {
        ...approvedKyc,
        status: 'rejected',
        canCreateLot: false,
        canEnterDeal: false,
        canReceiveMoney: false,
      },
      documents: readyDocs,
    });

    expect(model.status).toBe('restricted');
    expect(model.rows.every((row) => !row.allowed)).toBe(true);
    expect(model.rows[0].reason).toBe('Компания отклонена KYC.');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7OnboardingRoleActions('buyer')).toEqual(['create_purchase_request', 'enter_deal', 'sign_contract']);
    expect(platformV7OnboardingActionAllowedByKyc(approvedKyc, 'receive_money')).toBe(true);
    expect(platformV7OnboardingAccessTone('blocked')).toBe('danger');
    expect(platformV7OnboardingAccessNextAction('allowed', [])).toBe('Участник допущен к своим действиям.');
  });
});
