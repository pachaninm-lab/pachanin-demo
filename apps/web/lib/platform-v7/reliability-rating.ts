export type P7RatingRole = 'seller' | 'buyer' | 'carrier' | 'driver' | 'elevator' | 'lab' | 'surveyor';
export type P7RatingFactor = 'documents' | 'quality' | 'weight' | 'timeliness' | 'payment' | 'dispute_behavior' | 'evidence_quality';

export interface P7RatingEvent {
  readonly eventId: string;
  readonly dealId: string;
  readonly organizationId: string;
  readonly role: P7RatingRole;
  readonly factor: P7RatingFactor;
  readonly score: number;
  readonly weight: number;
  readonly createdAt: string;
}

export interface P7ReliabilityRating {
  readonly organizationId: string;
  readonly role: P7RatingRole;
  readonly score: number;
  readonly eventsCount: number;
  readonly visibilityTier: 'restricted' | 'standard' | 'preferred';
  readonly paymentTermTier: 'prepay_required' | 'standard' | 'post_acceptance_allowed';
  readonly bankReviewTier: 'manual_review' | 'standard_review' | 'fast_review';
}

export function p7CalculateReliabilityRating(organizationId: string, role: P7RatingRole, events: readonly P7RatingEvent[]): P7ReliabilityRating {
  const scoped = events.filter((event) => event.organizationId === organizationId && event.role === role);
  const totalWeight = scoped.reduce((sum, event) => sum + event.weight, 0);
  const weighted = scoped.reduce((sum, event) => sum + event.score * event.weight, 0);
  const score = totalWeight === 0 ? 50 : Math.round(weighted / totalWeight);

  return {
    organizationId,
    role,
    score,
    eventsCount: scoped.length,
    visibilityTier: score >= 80 ? 'preferred' : score >= 55 ? 'standard' : 'restricted',
    paymentTermTier: score >= 85 ? 'post_acceptance_allowed' : score >= 60 ? 'standard' : 'prepay_required',
    bankReviewTier: score >= 85 ? 'fast_review' : score >= 60 ? 'standard_review' : 'manual_review',
  };
}

export function p7RatingEvent(event: Omit<P7RatingEvent, 'score'> & { readonly score: number }): P7RatingEvent {
  return { ...event, score: Math.max(0, Math.min(100, event.score)) };
}
