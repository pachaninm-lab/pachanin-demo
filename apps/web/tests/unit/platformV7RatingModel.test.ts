import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RatingPrioritizeOffer,
  getPlatformV7RatingLevel,
  isPlatformV7RatingConsistent,
  isPlatformV7RatingExplainable,
  shouldPlatformV7RatingRequireManualReview,
  type PlatformV7ReliabilityRating,
} from '@/lib/platform-v7/rating-model';

const rating: PlatformV7ReliabilityRating = {
  partyId: 'party-1',
  score: 86,
  level: 'high',
  completedDeals: 12,
  disputesCount: 1,
  documentIssuesCount: 1,
  cancellationRate: 0.03,
  reviewScore: 4.7,
  explanation: ['Сделки закрываются без просрочки'],
  lastUpdatedAt: '2026-05-06T10:00:00.000Z',
};

describe('platform-v7 rating model', () => {
  it('maps score to rating level', () => {
    expect(getPlatformV7RatingLevel(85)).toBe('high');
    expect(getPlatformV7RatingLevel(70)).toBe('medium');
    expect(getPlatformV7RatingLevel(45)).toBe('low');
    expect(getPlatformV7RatingLevel(30)).toBe('manual_review');
  });

  it('keeps stored rating level consistent with score', () => {
    expect(isPlatformV7RatingConsistent(rating)).toBe(true);
    expect(isPlatformV7RatingConsistent({ ...rating, level: 'medium' })).toBe(false);
  });

  it('requires manual review for weak score, high cancellation or repeated disputes', () => {
    expect(shouldPlatformV7RatingRequireManualReview(rating)).toBe(false);
    expect(shouldPlatformV7RatingRequireManualReview({ ...rating, score: 30, level: 'manual_review' })).toBe(true);
    expect(shouldPlatformV7RatingRequireManualReview({ ...rating, cancellationRate: 0.3 })).toBe(true);
    expect(shouldPlatformV7RatingRequireManualReview({ ...rating, disputesCount: 4 })).toBe(true);
  });

  it('prioritizes offers only from strong and proven counterparties', () => {
    expect(canPlatformV7RatingPrioritizeOffer(rating)).toBe(true);
    expect(canPlatformV7RatingPrioritizeOffer({ ...rating, completedDeals: 0 })).toBe(false);
    expect(canPlatformV7RatingPrioritizeOffer({ ...rating, level: 'medium' })).toBe(false);
  });

  it('keeps rating explainable', () => {
    expect(isPlatformV7RatingExplainable(rating)).toBe(true);
    expect(isPlatformV7RatingExplainable({ ...rating, explanation: [] })).toBe(false);
    expect(isPlatformV7RatingExplainable({ ...rating, lastUpdatedAt: '' })).toBe(false);
  });
});
