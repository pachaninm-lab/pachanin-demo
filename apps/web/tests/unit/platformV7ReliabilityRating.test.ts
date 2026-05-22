import { describe, expect, it } from 'vitest';
import { p7CalculateReliabilityRating, p7RatingEvent } from '@/lib/platform-v7/reliability-rating';

describe('platform-v7 reliability rating foundation', () => {
  it('starts unknown counterparties in neutral/manual-review position', () => {
    expect(p7CalculateReliabilityRating('org-1', 'seller', [])).toEqual({
      organizationId: 'org-1',
      role: 'seller',
      score: 50,
      eventsCount: 0,
      visibilityTier: 'restricted',
      paymentTermTier: 'prepay_required',
      bankReviewTier: 'manual_review',
    });
  });

  it('calculates weighted reliability and unlocks better tiers', () => {
    const rating = p7CalculateReliabilityRating('org-1', 'seller', [
      p7RatingEvent({ eventId: 'e1', dealId: 'd1', organizationId: 'org-1', role: 'seller', factor: 'documents', score: 90, weight: 2, createdAt: '2026-05-22T00:00:00Z' }),
      p7RatingEvent({ eventId: 'e2', dealId: 'd2', organizationId: 'org-1', role: 'seller', factor: 'quality', score: 80, weight: 1, createdAt: '2026-05-22T00:00:00Z' }),
    ]);

    expect(rating.score).toBe(87);
    expect(rating.visibilityTier).toBe('preferred');
    expect(rating.paymentTermTier).toBe('post_acceptance_allowed');
    expect(rating.bankReviewTier).toBe('fast_review');
  });

  it('restricts weak counterparties', () => {
    const rating = p7CalculateReliabilityRating('org-1', 'buyer', [
      p7RatingEvent({ eventId: 'e1', dealId: 'd1', organizationId: 'org-1', role: 'buyer', factor: 'payment', score: 30, weight: 2, createdAt: '2026-05-22T00:00:00Z' }),
    ]);

    expect(rating.visibilityTier).toBe('restricted');
    expect(rating.paymentTermTier).toBe('prepay_required');
    expect(rating.bankReviewTier).toBe('manual_review');
  });

  it('clamps rating event scores', () => {
    expect(p7RatingEvent({ eventId: 'e1', dealId: 'd1', organizationId: 'org-1', role: 'driver', factor: 'timeliness', score: 140, weight: 1, createdAt: '2026-05-22T00:00:00Z' }).score).toBe(100);
    expect(p7RatingEvent({ eventId: 'e2', dealId: 'd1', organizationId: 'org-1', role: 'driver', factor: 'timeliness', score: -5, weight: 1, createdAt: '2026-05-22T00:00:00Z' }).score).toBe(0);
  });
});
