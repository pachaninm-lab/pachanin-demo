import { createHash } from 'crypto';
import { DEAL_STATUSES } from './canonical-models';

export type DealStatus = (typeof DEAL_STATUSES)[number];

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
  newStatus?: DealStatus;
  meta?: Record<string, unknown>;
}

export interface DealEvent {
  id: string;
  dealId: string;
  eventType: DealEventType;
  payload: DealEventPayload;
  prevHash: string;
  hash: string;
  occurredAt: string; // ISO-8601
}

export function computeEventHash(
  id: string,
  dealId: string,
  eventType: DealEventType,
  payload: DealEventPayload,
  prevHash: string,
): string {
  const data = JSON.stringify({ id, dealId, eventType, payload, prevHash });
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export function buildDealEvent(params: {
  id: string;
  dealId: string;
  eventType: DealEventType;
  payload: DealEventPayload;
  prevHash: string;
  occurredAt?: string;
}): DealEvent {
  const { id, dealId, eventType, payload, prevHash, occurredAt } = params;
  const hash = computeEventHash(id, dealId, eventType, payload, prevHash);
  return { id, dealId, eventType, payload, prevHash, hash, occurredAt: occurredAt ?? new Date().toISOString() };
}

export function verifyEventChain(events: DealEvent[]): { valid: boolean; brokenAt?: number } {
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const expected = computeEventHash(ev.id, ev.dealId, ev.eventType, ev.payload, ev.prevHash);
    if (ev.hash !== expected) return { valid: false, brokenAt: i };
    if (i > 0 && ev.prevHash !== events[i - 1].hash) return { valid: false, brokenAt: i };
  }
  return { valid: true };
}

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
