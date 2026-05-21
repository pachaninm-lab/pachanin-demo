import { describe, expect, it } from 'vitest';
import {
  calculateDisputeMoneyImpact,
  selectDealExecutionCase,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('dispute-money-impact', () => {
  it('blocks arbitrator decision until evidence is reviewed and regulation point is selected', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    if (!executionCase) throw new Error('DL-9106 source of truth missing');

    const impact = calculateDisputeMoneyImpact(executionCase, {
      disputeId: 'DSP-DL-9106-WEIGHT',
      type: 'weight',
      claimedAmount: 88_440,
      evidenceIds: ['WEIGHT-EVENT-1', 'ACT-DRAFT-1', 'PHOTO-SEAL-1'],
      reviewedEvidenceIds: ['WEIGHT-EVENT-1'],
      decision: 'partial_release',
      decisionHoldAmount: 88_440,
    });

    expect(impact.evidenceComplete).toBe(false);
    expect(impact.missingEvidenceIds).toEqual(['ACT-DRAFT-1', 'PHOTO-SEAL-1']);
    expect(impact.arbitratorCanDecide).toBe(false);
    expect(impact.bankBasisStatus).toBe('банк ждёт решение арбитра, доказательства и пункт регламента');
    expect(impact.readyToReleaseAmount).toBe(0);
    expect(impact.auditEvent.status).toBe('проверить');
  });

  it('links dispute decision to evidence and money basis for bank review', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    if (!executionCase) throw new Error('DL-9106 source of truth missing');

    const impact = calculateDisputeMoneyImpact(executionCase, {
      disputeId: 'DSP-DL-9106-QUALITY',
      type: 'quality',
      claimedAmount: 450_000,
      evidenceIds: ['LAB-PROTOCOL-1', 'QUALITY-DELTA-1', 'ACCEPTANCE-ACT-1'],
      reviewedEvidenceIds: ['LAB-PROTOCOL-1', 'QUALITY-DELTA-1', 'ACCEPTANCE-ACT-1'],
      regulationPoint: 'Регламент пилота · качество ниже условий',
      decision: 'partial_release',
      decisionHoldAmount: 450_000,
      decisionReleaseAmount: 9_198_000,
    });

    expect(impact.evidencePackId).toBe('EVP-DSP-DL-9106-QUALITY');
    expect(impact.evidenceComplete).toBe(true);
    expect(impact.arbitratorCanDecide).toBe(true);
    expect(impact.heldAmount).toBe(450_000);
    expect(impact.readyToReleaseAmount).toBe(9_198_000);
    expect(impact.bankBasisStatus).toBe('решение арбитра готово как основание для ручной проверки банка');
    expect(impact.nextRoleTask).toContain('Банк получает основание');
    expect(impact.auditEvent.note).toContain('held 450');
  });
});
