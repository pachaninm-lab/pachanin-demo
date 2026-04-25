import { describe, expect, it } from 'vitest';
import type { PlatformV7OnboardingAccessGateModel } from '@/lib/platform-v7/onboarding-access-gate';
import type { PlatformV7OnboardingDocumentsModel } from '@/lib/platform-v7/onboarding-documents';
import type { PlatformV7OnboardingKycModel } from '@/lib/platform-v7/onboarding-kyc';
import {
  platformV7ComplianceQueueModel,
  platformV7ComplianceQueueNextAction,
  platformV7ComplianceQueuePriority,
  platformV7ComplianceQueueSort,
  platformV7ComplianceQueueStatus,
  platformV7ComplianceQueueSummary,
  platformV7ComplianceQueueTone,
} from '@/lib/platform-v7/onboarding-compliance-queue';

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

describe('platform-v7 onboarding compliance queue', () => {
  it('marks verified company as clear', () => {
    const model = platformV7ComplianceQueueModel([
      {
        companyId: 'CMP-1',
        title: 'ООО Поле',
        role: 'seller',
        kyc: approvedKyc,
        documents: readyDocs,
        access: allowedAccess,
        submittedAt: '2026-04-25T10:00:00.000Z',
      },
    ]);

    expect(model.summary.total).toBe(1);
    expect(model.summary.clear).toBe(1);
    expect(model.isClean).toBe(true);
    expect(model.nextAction).toBe('Очередь комплаенса чистая.');
    expect(model.rows[0].tone).toBe('success');
  });

  it('sorts restricted and review rows before clear rows', () => {
    const model = platformV7ComplianceQueueModel([
      {
        companyId: 'CMP-3',
        title: 'ООО Чистый покупатель',
        role: 'buyer',
        kyc: { ...approvedKyc, companyId: 'CMP-3', role: 'buyer' },
        documents: { ...readyDocs, companyId: 'CMP-3', role: 'buyer' },
        access: { ...allowedAccess, companyId: 'CMP-3', role: 'buyer' },
        submittedAt: '2026-04-25T12:00:00.000Z',
      },
      {
        companyId: 'CMP-1',
        title: 'ООО Ограничено',
        role: 'seller',
        kyc: { ...approvedKyc, status: 'rejected', nextAction: 'Отклонить компанию до повторной проверки.' },
        documents: readyDocs,
        access: { ...allowedAccess, status: 'restricted' },
        submittedAt: '2026-04-25T10:00:00.000Z',
      },
      {
        companyId: 'CMP-2',
        title: 'ООО Проверка',
        role: 'seller',
        kyc: { ...approvedKyc, status: 'manual_review', reviewReasons: ['tax-risk'], nextAction: 'Передать на ручную проверку: tax-risk.' },
        documents: readyDocs,
        access: { ...allowedAccess, status: 'manual_review' },
        submittedAt: '2026-04-25T11:00:00.000Z',
      },
    ]);

    expect(model.rows.map((row) => row.companyId)).toEqual(['CMP-1', 'CMP-2', 'CMP-3']);
    expect(model.summary.restricted).toBe(1);
    expect(model.summary.review).toBe(1);
    expect(model.nextAction).toBe('Отклонить компанию до повторной проверки.');
  });

  it('marks incomplete document package as blocked', () => {
    const model = platformV7ComplianceQueueModel([
      {
        companyId: 'CMP-4',
        title: 'ООО Документы',
        role: 'carrier',
        kyc: { ...approvedKyc, companyId: 'CMP-4', role: 'carrier' },
        documents: {
          ...readyDocs,
          companyId: 'CMP-4',
          role: 'carrier',
          canSubmitKyc: false,
          readinessPercent: 67,
          blockerCount: 2,
          blockers: ['carrier_license:missing', 'vehicle_registry:missing'],
          nextAction: 'Закрыть документный блокер: carrier_license:missing.',
        },
        access: { ...allowedAccess, companyId: 'CMP-4', role: 'carrier', status: 'blocked', blockerCount: 2 },
        submittedAt: '2026-04-25T10:00:00.000Z',
      },
    ]);

    expect(model.summary.blocked).toBe(1);
    expect(model.rows[0].status).toBe('blocked');
    expect(model.rows[0].nextAction).toBe('Закрыть документный блокер: carrier_license:missing.');
    expect(model.isClean).toBe(false);
  });

  it('keeps helper outputs deterministic', () => {
    const rowA = {
      companyId: 'CMP-A',
      title: 'A',
      role: 'seller' as const,
      status: 'restricted' as const,
      priority: 'critical' as const,
      blockerCount: 1,
      readinessPercent: 10,
      nextAction: 'A',
      submittedAt: '2026-04-25T10:00:00.000Z',
      tone: 'danger' as const,
    };
    const rowB = { ...rowA, companyId: 'CMP-B', status: 'clear' as const, priority: 'low' as const };

    expect(platformV7ComplianceQueueStatus({ kyc: approvedKyc, documents: readyDocs, access: allowedAccess })).toBe('clear');
    expect(platformV7ComplianceQueuePriority('restricted', 1, 100, 100)).toBe('critical');
    expect(platformV7ComplianceQueueTone('review')).toBe('warning');
    expect(platformV7ComplianceQueueSummary([rowA, rowB]).total).toBe(2);
    expect(platformV7ComplianceQueueNextAction({ total: 0, clear: 0, review: 0, blocked: 0, restricted: 0, critical: 0, averageReadinessPercent: 0 }, [])).toBe('Нет компаний в очереди комплаенса.');
    expect(platformV7ComplianceQueueSort(rowA, rowB)).toBeLessThan(0);
  });
});
