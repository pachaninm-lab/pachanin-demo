import { describe, expect, it } from 'vitest';
import {
  platformV7ApplyDisputeDecision,
  platformV7CanSendBankBasis,
  platformV7DisputeReadiness,
  type PlatformV7DisputeCase,
} from '@/lib/platform-v7/dispute-engine';

const dispute: PlatformV7DisputeCase = {
  disputeId: 'd-1',
  dealId: 'deal-1',
  type: 'quality',
  status: 'under_review',
  reason: 'Quality delta',
  claimAmount: 1000,
  blockedAmount: 300,
  initiatorRole: 'buyer',
  respondentRole: 'seller',
  evidenceIds: ['e1', 'e2'],
  reviewedEvidenceIds: ['e1', 'e2'],
  deadline: '2026-05-22T10:00:00Z',
  currentOwner: 'arbitrator',
};

describe('platform-v7 dispute engine foundation', () => {
  it('allows decision only after evidence is reviewed', () => {
    expect(platformV7DisputeReadiness(dispute)).toEqual(expect.objectContaining({
      canReview: true,
      canDecide: true,
      missingEvidenceIds: [],
      moneyHeldAmount: 300,
    }));
  });

  it('blocks decision when evidence is missing', () => {
    const readiness = platformV7DisputeReadiness({ ...dispute, reviewedEvidenceIds: ['e1'] });

    expect(readiness.canDecide).toBe(false);
    expect(readiness.missingEvidenceIds).toEqual(['e2']);
    expect(readiness.nextAction).toBe('Дособрать доказательства');
  });

  it('moves ready dispute to decision issued and bank owner', () => {
    const decided = platformV7ApplyDisputeDecision(dispute, 'partial_release');

    expect(decided.status).toBe('decision_issued');
    expect(decided.decision).toBe('partial_release');
    expect(decided.currentOwner).toBe('bank');
  });

  it('does not issue decision when readiness is incomplete', () => {
    const decided = platformV7ApplyDisputeDecision({ ...dispute, reviewedEvidenceIds: [] }, 'release');

    expect(decided.status).toBe('under_review');
    expect(decided.decision).toBe('manual_review');
  });

  it('requires bank basis document before sending basis to bank', () => {
    const decided = platformV7ApplyDisputeDecision(dispute, 'hold');

    expect(platformV7CanSendBankBasis(decided)).toBe(false);
    expect(platformV7CanSendBankBasis({ ...decided, bankBasisDocumentId: 'bank-basis-1' })).toBe(true);
  });
});
