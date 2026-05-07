import type { PlatformV7EntityId, PlatformV7IsoDateTime } from './execution-model';

export type PlatformV7RatingLevel = 'high' | 'medium' | 'low' | 'manual_review';

export interface PlatformV7ReliabilityRating {
  partyId: PlatformV7EntityId;
  score: number;
  level: PlatformV7RatingLevel;
  completedDeals: number;
  disputesCount: number;
  latePaymentsCount?: number;
  documentIssuesCount: number;
  qualityIssuesCount?: number;
  logisticsIssuesCount?: number;
  cancellationRate: number;
  reviewScore: number;
  explanation: string[];
  lastUpdatedAt: PlatformV7IsoDateTime;
}

export function getPlatformV7RatingLevel(score: number): PlatformV7RatingLevel {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'manual_review';
}

export function isPlatformV7RatingConsistent(rating: PlatformV7ReliabilityRating): boolean {
  return rating.level === getPlatformV7RatingLevel(rating.score);
}

export function shouldPlatformV7RatingRequireManualReview(rating: PlatformV7ReliabilityRating): boolean {
  return rating.level === 'manual_review' || rating.score < 40 || rating.cancellationRate > 0.2 || rating.disputesCount > 3;
}

export function canPlatformV7RatingPrioritizeOffer(rating: PlatformV7ReliabilityRating): boolean {
  return rating.level === 'high' && !shouldPlatformV7RatingRequireManualReview(rating) && rating.completedDeals > 0;
}

export function isPlatformV7RatingExplainable(rating: PlatformV7ReliabilityRating): boolean {
  return rating.explanation.length > 0 && Boolean(rating.lastUpdatedAt);
}
