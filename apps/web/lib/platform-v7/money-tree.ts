export type PlatformV7MoneyOperationType =
  | 'reserve_requested'
  | 'reserve_confirmed'
  | 'reserve_failed'
  | 'hold_created'
  | 'hold_released'
  | 'release_requested'
  | 'release_confirmed'
  | 'release_failed'
  | 'refund_requested'
  | 'refund_confirmed'
  | 'manual_review_started'
  | 'manual_review_resolved'
  | 'reconciliation_failed';

export type PlatformV7MoneyStatus =
  | 'not_requested'
  | 'reserve_requested'
  | 'reserve_pending'
  | 'reserved'
  | 'reserve_failed'
  | 'hold_created'
  | 'manual_review'
  | 'release_ready'
  | 'release_requested'
  | 'release_pending'
  | 'released'
  | 'release_failed'
  | 'refund_requested'
  | 'refunded'
  | 'reconciliation_failed';

export interface PlatformV7MoneyTree {
  readonly dealId: string;
  readonly currency: 'RUB';
  readonly reservedAmount: number;
  readonly readyToReleaseAmount: number;
  readonly heldAmount: number;
  readonly manualReviewAmount: number;
  readonly releasedAmount: number;
  readonly refundedAmount: number;
  readonly platformFee: number;
  readonly bankFee: number;
  readonly status: PlatformV7MoneyStatus;
}

export interface PlatformV7MoneyOperation {
  readonly operationId: string;
  readonly dealId: string;
  readonly type: PlatformV7MoneyOperationType;
  readonly amount: number;
  readonly currency: 'RUB';
  readonly basisDocumentIds: readonly string[];
  readonly actorId: string;
  readonly actorRole: string;
  readonly occurredAt: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly auditId: string;
}

export interface PlatformV7MoneyTreeValidation {
  readonly valid: boolean;
  readonly reason: string;
  readonly expectedReservedAmount: number;
  readonly actualReservedAmount: number;
}

export interface PlatformV7ReleaseGateInput {
  readonly dealStatus: string;
  readonly moneyStatus: PlatformV7MoneyStatus;
  readonly requiredDocumentsConfirmed: boolean;
  readonly tripStatus: string;
  readonly acceptanceStatus: string;
  readonly disputeStatus: string;
  readonly bankReviewStatus: string;
}

export interface PlatformV7ReleaseGateDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly nextStatus: 'release_ready' | 'blocked';
}

export function platformV7ValidateMoneyTree(tree: PlatformV7MoneyTree): PlatformV7MoneyTreeValidation {
  const expectedReservedAmount = tree.readyToReleaseAmount
    + tree.heldAmount
    + tree.manualReviewAmount
    + tree.releasedAmount
    + tree.refundedAmount;

  if (tree.reservedAmount !== expectedReservedAmount) {
    return {
      valid: false,
      reason: 'Reserved amount must equal ready, held, manual-review, released and refunded buckets.',
      expectedReservedAmount,
      actualReservedAmount: tree.reservedAmount,
    };
  }

  return {
    valid: true,
    reason: 'Money tree invariant is balanced.',
    expectedReservedAmount,
    actualReservedAmount: tree.reservedAmount,
  };
}

export function platformV7ReleaseGate(input: PlatformV7ReleaseGateInput): PlatformV7ReleaseGateDecision {
  if (input.dealStatus !== 'release_basis_ready') {
    return { allowed: false, reason: 'Deal is not at release basis ready status.', nextStatus: 'blocked' };
  }

  if (input.moneyStatus !== 'reserved') {
    return { allowed: false, reason: 'Money is not reserved.', nextStatus: 'blocked' };
  }

  if (!input.requiredDocumentsConfirmed) {
    return { allowed: false, reason: 'Required documents are not confirmed.', nextStatus: 'blocked' };
  }

  if (input.tripStatus !== 'completed') {
    return { allowed: false, reason: 'Trip is not completed.', nextStatus: 'blocked' };
  }

  if (input.acceptanceStatus !== 'confirmed') {
    return { allowed: false, reason: 'Acceptance is not confirmed.', nextStatus: 'blocked' };
  }

  if (!(input.disputeStatus === 'none' || input.disputeStatus === 'resolved')) {
    return { allowed: false, reason: 'Blocking dispute is still active.', nextStatus: 'blocked' };
  }

  if (input.bankReviewStatus === 'blocked') {
    return { allowed: false, reason: 'Bank review is blocked.', nextStatus: 'blocked' };
  }

  return { allowed: true, reason: 'Release basis is ready for bank review request.', nextStatus: 'release_ready' };
}

export function platformV7SplitDisputedMoney(reservedAmount: number, disputedAmount: number): Pick<PlatformV7MoneyTree, 'readyToReleaseAmount' | 'heldAmount' | 'manualReviewAmount' | 'releasedAmount' | 'refundedAmount'> {
  const heldAmount = Math.max(0, Math.min(reservedAmount, disputedAmount));
  return {
    readyToReleaseAmount: reservedAmount - heldAmount,
    heldAmount,
    manualReviewAmount: 0,
    releasedAmount: 0,
    refundedAmount: 0,
  };
}
