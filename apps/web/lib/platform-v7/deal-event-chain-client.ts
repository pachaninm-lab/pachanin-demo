// Client-side type exports for DealEvent (no Node.js crypto dependency)
// Server-side hash computation lives in packages/domain-core

export type DealEventType =
  | 'DEAL_CREATED'
  | 'DEAL_SIGNED'
  | 'PAYMENT_RESERVED'
  | 'LOADING_STARTED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'QUALITY_CHECK_STARTED'
  | 'QUALITY_ACCEPTED'
  | 'QUALITY_DISPUTED'
  | 'PAYMENT_RELEASED'
  | 'SETTLEMENT_DONE'
  | 'DEAL_CLOSED'
  | 'DEAL_CANCELLED'
  | 'DISPUTE_OPENED'
  | 'ARBITRATION_STARTED'
  | 'ARBITRATION_DECIDED';

export interface DealEventPayload {
  actorId: string;
  actorRole: string;
  newStatus?: string;
  meta?: Record<string, unknown>;
}

export interface DealEvent {
  id: string;
  dealId: string;
  eventType: DealEventType;
  payload: DealEventPayload;
  prevHash: string;
  hash: string;
  occurredAt: string;
}
