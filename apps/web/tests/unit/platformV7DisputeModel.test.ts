import { describe, expect, it } from 'vitest';
import {
  canPlatformV7DisputeBeResolved,
  canPlatformV7DisputeChangeMoney,
  doesPlatformV7DisputeRequireManualReview,
  isPlatformV7DisputeMoneyLinked,
  isPlatformV7DisputeOpen,
  type PlatformV7Dispute,
} from '@/lib/platform-v7/dispute-model';

const dispute: PlatformV7Dispute = {
  id: 'dispute-1',
  dealId: 'deal-1',
  reason: 'quality',
  status: 'decision_ready',
  heldAmountRub: 120_000,
  evidencePackId: 'evidence-1',
  sellerPosition: 'Показатели в норме',
  buyerPosition: 'Есть отклонение качества',
  decision: 'hold_part',
  createdAt: '2026-05-06T10:00:00.000Z',
  updatedAt: '2026-05-06T11:00:00.000Z',
};

describe('platform-v7 dispute model', () => {
  it('keeps unresolved disputes open until resolved or closed', () => {
    expect(isPlatformV7DisputeOpen(dispute)).toBe(true);
    expect(isPlatformV7DisputeOpen({ ...dispute, status: 'resolved' })).toBe(false);
    expect(isPlatformV7DisputeOpen({ ...dispute, status: 'closed' })).toBe(false);
  });

  it('links dispute to money only when held amount is positive', () => {
    expect(isPlatformV7DisputeMoneyLinked(dispute)).toBe(true);
    expect(isPlatformV7DisputeMoneyLinked({ ...dispute, heldAmountRub: 0 })).toBe(false);
  });

  it('requires manual review when evidence is missing or state asks for it', () => {
    expect(doesPlatformV7DisputeRequireManualReview(dispute)).toBe(false);
    expect(doesPlatformV7DisputeRequireManualReview({ ...dispute, evidencePackId: undefined })).toBe(true);
    expect(doesPlatformV7DisputeRequireManualReview({ ...dispute, status: 'manual_review' })).toBe(true);
  });

  it('resolves only when decision is ready, evidence is sufficient and decision exists', () => {
    expect(canPlatformV7DisputeBeResolved(dispute, true)).toBe(true);
    expect(canPlatformV7DisputeBeResolved({ ...dispute, status: 'evidence_collection' }, true)).toBe(false);
    expect(canPlatformV7DisputeBeResolved(dispute, false)).toBe(false);
    expect(canPlatformV7DisputeBeResolved({ ...dispute, decision: undefined }, true)).toBe(false);
  });

  it('changes money only through money-impact decisions', () => {
    expect(canPlatformV7DisputeChangeMoney(dispute)).toBe(true);
    expect(canPlatformV7DisputeChangeMoney({ ...dispute, decision: 'request_document' })).toBe(false);
    expect(canPlatformV7DisputeChangeMoney({ ...dispute, heldAmountRub: 0 })).toBe(false);
  });
});
