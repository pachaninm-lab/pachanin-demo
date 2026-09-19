import { describe, expect, it } from 'vitest';
import {
  canPlatformV7CreateDealFromProposal,
  canPlatformV7ProposalBeReviewed,
  isPlatformV7ProposalAmountConsistent,
  isPlatformV7ProposalExpired,
  type PlatformV7Proposal,
} from '@/lib/platform-v7/proposal-model';

const proposal: PlatformV7Proposal = {
  id: 'proposal-1',
  type: 'auction_bid',
  lotId: 'lot-1',
  sellerId: 'seller-1',
  buyerId: 'buyer-1',
  priceRubPerTon: 16000,
  totalAmountRub: 9_600_000,
  status: 'accepted',
  expiresAt: '2026-05-07T10:00:00.000Z',
  auditEventIds: ['audit-1'],
};

describe('platform-v7 proposal model', () => {
  it('keeps proposal total amount equal to price per ton times volume', () => {
    expect(isPlatformV7ProposalAmountConsistent(proposal, 600)).toBe(true);
    expect(isPlatformV7ProposalAmountConsistent({ ...proposal, totalAmountRub: 9_500_000 }, 600)).toBe(false);
  });

  it('marks proposals expired only when expiry is reached', () => {
    expect(isPlatformV7ProposalExpired(proposal, '2026-05-06T10:00:00.000Z')).toBe(false);
    expect(isPlatformV7ProposalExpired(proposal, '2026-05-07T10:00:00.000Z')).toBe(true);
  });

  it('does not review closed or expired proposals', () => {
    expect(canPlatformV7ProposalBeReviewed({ ...proposal, status: 'under_review' }, '2026-05-06T10:00:00.000Z')).toBe(true);
    expect(canPlatformV7ProposalBeReviewed({ ...proposal, status: 'withdrawn' }, '2026-05-06T10:00:00.000Z')).toBe(false);
    expect(canPlatformV7ProposalBeReviewed({ ...proposal, status: 'under_review' }, '2026-05-08T10:00:00.000Z')).toBe(false);
  });

  it('creates a deal only from an accepted, active and audited proposal', () => {
    expect(canPlatformV7CreateDealFromProposal(proposal, '2026-05-06T10:00:00.000Z')).toBe(true);
    expect(canPlatformV7CreateDealFromProposal({ ...proposal, status: 'leading' }, '2026-05-06T10:00:00.000Z')).toBe(false);
    expect(canPlatformV7CreateDealFromProposal({ ...proposal, auditEventIds: [] }, '2026-05-06T10:00:00.000Z')).toBe(false);
    expect(canPlatformV7CreateDealFromProposal(proposal, '2026-05-08T10:00:00.000Z')).toBe(false);
  });
});
