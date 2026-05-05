import { Offer, OfferStatus } from './core-types';
import { createAuditEvent } from './audit-events';

const allowedTransitions: Record<OfferStatus, OfferStatus[]> = {
  sent: ['viewed', 'clarification_requested', 'countered', 'accepted', 'rejected', 'expired', 'withdrawn'],
  viewed: ['clarification_requested', 'countered', 'accepted', 'rejected', 'expired', 'withdrawn'],
  clarification_requested: ['countered', 'accepted', 'rejected', 'expired', 'withdrawn'],
  countered: ['viewed', 'accepted', 'rejected', 'expired', 'withdrawn'],
  accepted: [],
  rejected: [],
  expired: [],
  withdrawn: [],
};

export interface OfferTransitionResult {
  offer: Offer;
  auditEvent: ReturnType<typeof createAuditEvent>;
}

export function canTransitionOffer(from: OfferStatus, to: OfferStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export function transitionOffer(offer: Offer, to: OfferStatus, actorId: string, reason?: string): OfferTransitionResult {
  if (!canTransitionOffer(offer.status, to)) {
    throw new Error(`Offer cannot transition from ${offer.status} to ${to}`);
  }
  if (to === 'rejected' && !reason?.trim()) {
    throw new Error('Offer rejection requires a reason');
  }
  const nextOffer = { ...offer, status: to, updatedAt: new Date().toISOString() };
  return {
    offer: nextOffer,
    auditEvent: createAuditEvent({
      entityType: 'offer',
      entityId: offer.id,
      actorRole: offer.sellerId === actorId ? 'seller' : offer.buyerId === actorId ? 'buyer' : 'operator',
      actorId,
      action: `offer_${to}`,
      before: { status: offer.status },
      after: { status: to },
      reason,
    }),
  };
}

export function createCounterOffer(offer: Offer, patch: Partial<Pick<Offer, 'pricePerTon' | 'volumeTons' | 'basis' | 'logisticsOption' | 'paymentTerms' | 'documentRequirements' | 'qualityRequirements'>>, actorId: string, reason: string): OfferTransitionResult {
  if (!reason.trim()) throw new Error('Counter offer requires a reason');
  if (!canTransitionOffer(offer.status, 'countered')) throw new Error(`Offer cannot be countered from ${offer.status}`);
  const nextOffer: Offer = {
    ...offer,
    ...patch,
    status: 'countered',
    version: offer.version + 1,
    updatedAt: new Date().toISOString(),
  };
  return {
    offer: nextOffer,
    auditEvent: createAuditEvent({
      entityType: 'offer',
      entityId: offer.id,
      actorRole: offer.sellerId === actorId ? 'seller' : offer.buyerId === actorId ? 'buyer' : 'operator',
      actorId,
      action: 'offer_countered',
      before: offer,
      after: nextOffer,
      reason,
    }),
  };
}
