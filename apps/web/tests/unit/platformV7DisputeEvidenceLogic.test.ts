import { describe, expect, it } from 'vitest';
import {
  calculateDisputeMoneyImpact,
  selectDealExecutionCase,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const executionCase = selectDealExecutionCase('DL-9106');
if (!executionCase) throw new Error('DL-9106 source of truth missing');

describe('platform-v7 dispute and evidence logic', () => {
  it('does not let a dispute create bank basis without reviewed evidence, decision and regulation point', () => {
    const impact = calculateDisputeMoneyImpact(executionCase, {
      disputeId: 'DSP-DL-9106-AUDIT-1',
      type: 'quality',
      claimedAmount: 450_000,
      evidenceIds: ['LAB-PROTOCOL-1', 'QUALITY-DELTA-1', 'ACCEPTANCE-ACT-1'],
      reviewedEvidenceIds: ['LAB-PROTOCOL-1', 'QUALITY-DELTA-1'],
      decision: 'partial_release',
      decisionHoldAmount: 450_000,
      decisionReleaseAmount: 9_198_000,
    });

    expect(impact.evidenceComplete).toBe(false);
    expect(impact.arbitratorCanDecide).toBe(false);
    expect(impact.readyToReleaseAmount).toBe(0);
    expect(impact.missingEvidenceIds).toEqual(['ACCEPTANCE-ACT-1']);
    expect(impact.bankBasisStatus).toContain('банк ждёт');
  });

  it('requires regulation point even when evidence is fully reviewed', () => {
    const impact = calculateDisputeMoneyImpact(executionCase, {
      disputeId: 'DSP-DL-9106-AUDIT-2',
      type: 'weight',
      claimedAmount: 88_440,
      evidenceIds: ['WEIGHT-EVENT-1', 'ACT-DRAFT-1'],
      reviewedEvidenceIds: ['WEIGHT-EVENT-1', 'ACT-DRAFT-1'],
      decision: 'partial_release',
      decisionHoldAmount: 88_440,
      decisionReleaseAmount: 9_559_560,
    });

    expect(impact.evidenceComplete).toBe(true);
    expect(impact.arbitratorCanDecide).toBe(false);
    expect(impact.readyToReleaseAmount).toBe(0);
    expect(impact.auditEvent.action).toBe('dispute_decision_blocked');
  });

  it('caps claimed, held and ready amounts by the reserved deal amount', () => {
    const impact = calculateDisputeMoneyImpact(executionCase, {
      disputeId: 'DSP-DL-9106-AUDIT-3',
      type: 'mixed',
      claimedAmount: executionCase.money.reserveAmount * 2,
      evidenceIds: ['E1'],
      reviewedEvidenceIds: ['E1'],
      regulationPoint: 'Регламент controlled pilot · полный спор',
      decision: 'partial_release',
      decisionHoldAmount: executionCase.money.reserveAmount * 2,
      decisionReleaseAmount: executionCase.money.reserveAmount * 2,
    });

    expect(impact.claimedAmount).toBe(executionCase.money.reserveAmount);
    expect(impact.heldAmount).toBe(executionCase.money.reserveAmount);
    expect(impact.readyToReleaseAmount).toBe(executionCase.money.reserveAmount);
  });

  it('keeps a complete decision trace for bank/manual review', () => {
    const impact = calculateDisputeMoneyImpact(executionCase, {
      disputeId: 'DSP-DL-9106-AUDIT-4',
      type: 'documents',
      claimedAmount: 120_000,
      evidenceIds: ['DOC-MISSING-1', 'SLA-BREACH-1'],
      reviewedEvidenceIds: ['DOC-MISSING-1', 'SLA-BREACH-1'],
      regulationPoint: 'Регламент controlled pilot · документный блокер',
      decision: 'hold',
      decisionHoldAmount: 120_000,
    });

    expect(impact.evidencePackId).toBe('EVP-DSP-DL-9106-AUDIT-4');
    expect(impact.evidenceComplete).toBe(true);
    expect(impact.arbitratorCanDecide).toBe(true);
    expect(impact.auditEvent.status).toBe('зафиксировано');
    expect(impact.auditEvent.note).toContain('evidence 2/2');
  });
});
