import type { PlatformV7EntityId, PlatformV7IsoDateTime, PlatformV7RubAmount } from './execution-model';

export type PlatformV7DisputeStatus =
  | 'open'
  | 'evidence_collection'
  | 'manual_review'
  | 'decision_ready'
  | 'resolved'
  | 'closed';

export type PlatformV7DisputeReason = 'weight' | 'quality' | 'documents' | 'shipment' | 'money' | 'other';

export interface PlatformV7Dispute {
  id: PlatformV7EntityId;
  dealId: PlatformV7EntityId;
  reason: PlatformV7DisputeReason;
  status: PlatformV7DisputeStatus;
  heldAmountRub: PlatformV7RubAmount;
  evidencePackId?: PlatformV7EntityId;
  sellerPosition?: string;
  buyerPosition?: string;
  decision?: 'release_all' | 'hold_part' | 'return_part' | 'manual_review' | 'request_document' | 'request_retest';
  createdAt: PlatformV7IsoDateTime;
  updatedAt: PlatformV7IsoDateTime;
}

const CLOSED_DISPUTE_STATUSES: readonly PlatformV7DisputeStatus[] = ['resolved', 'closed'];

export function isPlatformV7DisputeOpen(dispute: PlatformV7Dispute): boolean {
  return !CLOSED_DISPUTE_STATUSES.includes(dispute.status);
}

export function isPlatformV7DisputeMoneyLinked(dispute: PlatformV7Dispute): boolean {
  return dispute.heldAmountRub > 0;
}

export function doesPlatformV7DisputeRequireManualReview(dispute: PlatformV7Dispute): boolean {
  return dispute.status === 'manual_review' || !dispute.evidencePackId || dispute.heldAmountRub < 0;
}

export function canPlatformV7DisputeBeResolved(dispute: PlatformV7Dispute, canEvidenceResolve: boolean): boolean {
  return dispute.status === 'decision_ready' && canEvidenceResolve && Boolean(dispute.decision);
}

export function canPlatformV7DisputeChangeMoney(dispute: PlatformV7Dispute): boolean {
  return isPlatformV7DisputeMoneyLinked(dispute) && Boolean(dispute.decision) && ['release_all', 'hold_part', 'return_part'].includes(dispute.decision);
}
