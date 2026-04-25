import { describe, expect, it } from 'vitest';
import type { PlatformV7OnboardingDocumentInput } from '@/lib/platform-v7/onboarding-documents';
import {
  platformV7OnboardingDocumentEffectiveStatus,
  platformV7OnboardingDocumentsModel,
  platformV7OnboardingDocumentsNextAction,
  platformV7OnboardingDocumentsNormalize,
  platformV7OnboardingDocumentsTone,
  platformV7OnboardingRequiredDocumentKinds,
} from '@/lib/platform-v7/onboarding-documents';

const verifiedCommon: PlatformV7OnboardingDocumentInput[] = [
  { kind: 'company_registry_extract', status: 'verified', required: true },
  { kind: 'charter', status: 'verified', required: true },
  { kind: 'signer_authority', status: 'verified', required: true },
  { kind: 'bank_account_certificate', status: 'verified', required: true },
];

describe('platform-v7 onboarding documents', () => {
  it('marks seller documents ready only when every required document is verified', () => {
    const model = platformV7OnboardingDocumentsModel({
      companyId: 'CMP-1',
      role: 'seller',
      checkedAt: '2026-04-25T10:00:00.000Z',
      documents: [
        ...verifiedCommon,
        { kind: 'warehouse_certificate', status: 'verified', required: true },
      ],
    });

    expect(model.canSubmitKyc).toBe(true);
    expect(model.readinessPercent).toBe(100);
    expect(model.blockerCount).toBe(0);
    expect(model.tone).toBe('success');
  });

  it('creates missing required placeholders by role', () => {
    const model = platformV7OnboardingDocumentsModel({
      companyId: 'CMP-2',
      role: 'carrier',
      checkedAt: '2026-04-25T10:00:00.000Z',
      documents: verifiedCommon,
    });

    expect(model.canSubmitKyc).toBe(false);
    expect(model.requiredCount).toBe(6);
    expect(model.missingRequiredKinds).toEqual(['carrier_license', 'vehicle_registry']);
    expect(model.blockerCount).toBe(2);
    expect(model.tone).toBe('warning');
  });

  it('treats expired required documents as blockers', () => {
    const model = platformV7OnboardingDocumentsModel({
      companyId: 'CMP-3',
      role: 'buyer',
      checkedAt: '2026-04-25T10:00:00.000Z',
      documents: [
        ...verifiedCommon.slice(0, 3),
        {
          kind: 'bank_account_certificate',
          status: 'verified',
          required: true,
          expiresAt: '2026-04-24T10:00:00.000Z',
        },
      ],
    });

    expect(model.canSubmitKyc).toBe(false);
    expect(model.blockers).toEqual(['bank_account_certificate:expired']);
    expect(model.rows[0].kind).toBe('bank_account_certificate');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7OnboardingRequiredDocumentKinds('lab')).toContain('lab_accreditation');
    expect(platformV7OnboardingDocumentEffectiveStatus(
      { kind: 'charter', status: 'verified', required: true, expiresAt: '2026-04-24T10:00:00.000Z' },
      '2026-04-25T10:00:00.000Z',
    )).toBe('expired');
    expect(platformV7OnboardingDocumentsTone(0, true)).toBe('success');
    expect(platformV7OnboardingDocumentsNextAction([], true)).toBe('Документы готовы к проверке допуска.');

    const rows = platformV7OnboardingDocumentsNormalize([], ['charter'], '2026-04-25T10:00:00.000Z');
    expect(rows[0].kind).toBe('charter');
    expect(rows[0].blocksSubmission).toBe(true);
  });
});
