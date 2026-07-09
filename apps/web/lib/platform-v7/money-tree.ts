import { isPlatformV7MoneyIdempotencyKey, validatePlatformV7IdempotencyKey } from './idempotency-key-helper';

export type PlatformV7MoneyOperationType =
  | 'reserve_requested'
  | 'reserve_confirmed'
  | 'reserve_failed'
  | 'hold_created'
  | 'hold_released'
  | 'bank_basis_requested'
  | 'bank_basis_confirmed'
  | 'bank_basis_rejected'
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
  | 'bank_basis_ready'
  | 'bank_basis_requested'
  | 'bank_basis_pending'
  | 'bank_basis_confirmed'
  | 'bank_basis_rejected'
  | 'refund_requested'
  | 'refunded'
  | 'reconciliation_failed';

export interface PlatformV7MoneyTree {
  readonly dealId: string;
  readonly currency: 'RUB';
  readonly totalDealAmount?: number;
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
  readonly code?: PlatformV7MoneyValidationCode;
  readonly expectedReservedAmount: number;
  readonly actualReservedAmount: number;
}

export type PlatformV7MoneyValidationCode =
  | 'OK'
  | 'NEGATIVE_AMOUNT'
  | 'OVER_RESERVED'
  | 'INVARIANT_MISMATCH'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'DUPLICATE_OPERATION'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'AMOUNT_EXCEEDS_BANK_BASIS_READY'
  | 'AMOUNT_EXCEEDS_HELD'
  | 'AMOUNT_EXCEEDS_MANUAL_REVIEW'
  | 'BANK_BASIS_GATE_BLOCKED'
  | 'BANK_CONFIRMATION_REQUIRED'
  | 'BANK_BASIS_REQUEST_REQUIRED'
  | 'UNSUPPORTED_OPERATION';

export interface PlatformV7BankBasisGateInput {
  readonly operationType: 'bank_basis_requested' | 'bank_basis_confirmed';
  readonly bankConfirmationExists: boolean;
  readonly dealStatus: string;
  readonly moneyStatus: PlatformV7MoneyStatus;
  readonly requiredDocumentsConfirmed: boolean;
  readonly tripStatus: string;
  readonly acceptanceStatus: string;
  readonly disputeStatus: string;
  readonly bankReviewStatus: string;
}

export interface PlatformV7BankBasisGateDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly nextStatus: 'bank_basis_requested' | 'bank_basis_confirmed' | 'blocked';
}

export interface PlatformV7MoneyOperationIdempotencyValidation {
  readonly valid: boolean;
  readonly reason: string;
  readonly issues: readonly string[];
}

export interface PlatformV7MoneyOperationValidationContext {
  readonly tree: PlatformV7MoneyTree;
  readonly operation: PlatformV7MoneyOperation;
  readonly bankBasisGate?: PlatformV7BankBasisGateInput;
  readonly bankConfirmationExists: boolean;
  readonly existingOperationIds?: readonly string[];
  readonly usedIdempotencyKeys?: readonly string[];
}

export interface PlatformV7MoneyOperationDecision {
  readonly valid: boolean;
  readonly code: PlatformV7MoneyValidationCode;
  readonly reason: string;
}

export interface PlatformV7MoneyOperationApplyResult extends PlatformV7MoneyOperationDecision {
  readonly tree: PlatformV7MoneyTree;
}

const MONEY_TREE_AMOUNT_FIELDS = [
  'totalDealAmount',
  'reservedAmount',
  'readyToReleaseAmount',
  'heldAmount',
  'manualReviewAmount',
  'releasedAmount',
  'refundedAmount',
  'platformFee',
  'bankFee',
] as const satisfies readonly (keyof PlatformV7MoneyTree)[];

export function platformV7ValidateMoneyTree(tree: PlatformV7MoneyTree): PlatformV7MoneyTreeValidation {
  const expectedReservedAmount = tree.readyToReleaseAmount
    + tree.heldAmount
    + tree.manualReviewAmount
    + tree.releasedAmount
    + tree.refundedAmount;

  const negativeField = MONEY_TREE_AMOUNT_FIELDS.find((field) => {
    const value = tree[field];
    return typeof value === 'number' && (!Number.isFinite(value) || value < 0);
  });

  if (negativeField) {
    return {
      valid: false,
      code: 'NEGATIVE_AMOUNT',
      reason: `${negativeField} must be a finite amount greater than or equal to zero.`,
      expectedReservedAmount,
      actualReservedAmount: tree.reservedAmount,
    };
  }

  if (typeof tree.totalDealAmount === 'number' && tree.reservedAmount > tree.totalDealAmount) {
    return {
      valid: false,
      code: 'OVER_RESERVED',
      reason: 'Reserved amount cannot exceed total deal amount.',
      expectedReservedAmount,
      actualReservedAmount: tree.reservedAmount,
    };
  }

  if (tree.reservedAmount !== expectedReservedAmount) {
    return {
      valid: false,
      code: 'INVARIANT_MISMATCH',
      reason: 'Reserved amount must equal ready, held, manual-review, confirmed-basis and refunded buckets.',
      expectedReservedAmount,
      actualReservedAmount: tree.reservedAmount,
    };
  }

  return {
    valid: true,
    code: 'OK',
    reason: 'Money tree invariant is balanced.',
    expectedReservedAmount,
    actualReservedAmount: tree.reservedAmount,
  };
}

export function platformV7BankBasisGate(input: PlatformV7BankBasisGateInput): PlatformV7BankBasisGateDecision {
  if (input.dealStatus !== 'bank_basis_ready') {
    return { allowed: false, reason: 'Deal is not at bank basis ready status.', nextStatus: 'blocked' };
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

  if (input.operationType === 'bank_basis_requested') {
    return { allowed: true, reason: 'Bank basis request can be recorded before bank confirmation.', nextStatus: 'bank_basis_requested' };
  }

  if (!input.bankConfirmationExists) {
    return { allowed: false, reason: 'Bank confirmation is required before bank basis can be confirmed.', nextStatus: 'blocked' };
  }

  return { allowed: true, reason: 'Bank-confirmed basis can be recorded in MoneyTree.', nextStatus: 'bank_basis_confirmed' };
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

function invalidMoneyOperation(
  code: PlatformV7MoneyValidationCode,
  reason: string,
): PlatformV7MoneyOperationDecision {
  return { valid: false, code, reason };
}

function validMoneyOperation(reason: string): PlatformV7MoneyOperationDecision {
  return { valid: true, code: 'OK', reason };
}

export function platformV7ValidateMoneyOperationIdempotency(key: string): PlatformV7MoneyOperationIdempotencyValidation {
  const baseValidation = validatePlatformV7IdempotencyKey(key);
  if (!baseValidation.ok) {
    return {
      valid: false,
      reason: 'Money operation idempotency key is malformed.',
      issues: baseValidation.issues,
    };
  }

  if (!isPlatformV7MoneyIdempotencyKey(key)) {
    return {
      valid: false,
      reason: 'Idempotency key is valid but not scoped to a money operation.',
      issues: ['Idempotency key must include concrete amount and currency segments.'],
    };
  }

  return { valid: true, reason: 'Money operation idempotency key is valid.', issues: [] };
}

export function platformV7ValidateMoneyOperation({
  tree,
  operation,
  bankBasisGate,
  bankConfirmationExists,
  existingOperationIds = [],
  usedIdempotencyKeys = [],
}: PlatformV7MoneyOperationValidationContext): PlatformV7MoneyOperationDecision {
  const treeValidation = platformV7ValidateMoneyTree(tree);
  if (!treeValidation.valid) {
    return invalidMoneyOperation(treeValidation.code ?? 'INVARIANT_MISMATCH', treeValidation.reason);
  }

  if (!Number.isFinite(operation.amount) || operation.amount < 0) {
    return invalidMoneyOperation('NEGATIVE_AMOUNT', 'Money operation amount must be a finite amount greater than or equal to zero.');
  }

  if (!operation.idempotencyKey.trim()) {
    return invalidMoneyOperation('MISSING_IDEMPOTENCY_KEY', 'Money operation requires an idempotency key.');
  }

  const idempotencyValidation = platformV7ValidateMoneyOperationIdempotency(operation.idempotencyKey);
  if (!idempotencyValidation.valid) {
    return invalidMoneyOperation('INVALID_IDEMPOTENCY_KEY', idempotencyValidation.reason);
  }

  if (existingOperationIds.includes(operation.operationId)) {
    return invalidMoneyOperation('DUPLICATE_OPERATION', 'Money operation was already applied.');
  }

  if (usedIdempotencyKeys.includes(operation.idempotencyKey)) {
    return invalidMoneyOperation('DUPLICATE_IDEMPOTENCY_KEY', 'Money operation idempotency key was already used.');
  }

  if ((operation.type === 'reserve_confirmed' || operation.type === 'reserve_requested')
    && typeof tree.totalDealAmount === 'number'
    && tree.reservedAmount + operation.amount > tree.totalDealAmount) {
    return invalidMoneyOperation('OVER_RESERVED', 'Reserve operation would exceed total deal amount.');
  }

  if (operation.type === 'bank_basis_requested') {
    if (operation.amount > tree.readyToReleaseAmount) {
      return invalidMoneyOperation('AMOUNT_EXCEEDS_BANK_BASIS_READY', 'Bank basis request amount exceeds ready-to-basis amount.');
    }

    if (bankBasisGate && !platformV7BankBasisGate(bankBasisGate).allowed) {
      return invalidMoneyOperation('BANK_BASIS_GATE_BLOCKED', 'Bank basis request is blocked by bank basis gate conditions.');
    }

    return validMoneyOperation('Bank basis request is valid and does not move money without bank confirmation.');
  }

  if (operation.type === 'bank_basis_confirmed') {
    if (!bankConfirmationExists) {
      return invalidMoneyOperation('BANK_CONFIRMATION_REQUIRED', 'Bank confirmation is required before bank basis can be confirmed.');
    }

    if (!(tree.status === 'bank_basis_requested' || tree.status === 'bank_basis_pending')) {
      return invalidMoneyOperation('BANK_BASIS_REQUEST_REQUIRED', 'Bank basis confirmation requires a prior bank basis request state.');
    }

    if (operation.amount > tree.readyToReleaseAmount) {
      return invalidMoneyOperation('AMOUNT_EXCEEDS_BANK_BASIS_READY', 'Confirmed bank basis amount exceeds ready-to-basis amount.');
    }

    return validMoneyOperation('Bank basis confirmation can move ready money to confirmed-basis bucket.');
  }

  if (operation.type === 'hold_created' || operation.type === 'refund_confirmed' || operation.type === 'manual_review_started') {
    if (operation.amount > tree.readyToReleaseAmount) {
      return invalidMoneyOperation('AMOUNT_EXCEEDS_BANK_BASIS_READY', 'Operation amount exceeds ready-to-basis amount.');
    }
  }

  if (operation.type === 'hold_released' && operation.amount > tree.heldAmount) {
    return invalidMoneyOperation('AMOUNT_EXCEEDS_HELD', 'Hold release amount exceeds held amount.');
  }

  if (operation.type === 'manual_review_resolved' && operation.amount > tree.manualReviewAmount) {
    return invalidMoneyOperation('AMOUNT_EXCEEDS_MANUAL_REVIEW', 'Manual review resolution amount exceeds manual review amount.');
  }

  return validMoneyOperation('Money operation is valid.');
}

export function platformV7ApplyMoneyOperation(context: PlatformV7MoneyOperationValidationContext): PlatformV7MoneyOperationApplyResult {
  const decision = platformV7ValidateMoneyOperation(context);
  if (!decision.valid) return { ...decision, tree: context.tree };

  const { tree, operation } = context;
  const amount = operation.amount;

  switch (operation.type) {
    case 'reserve_requested':
      return { ...decision, tree: { ...tree, status: 'reserve_requested' } };
    case 'reserve_confirmed':
      return {
        ...decision,
        tree: {
          ...tree,
          reservedAmount: tree.reservedAmount + amount,
          readyToReleaseAmount: tree.readyToReleaseAmount + amount,
          status: 'reserved',
        },
      };
    case 'hold_created':
      return {
        ...decision,
        tree: {
          ...tree,
          readyToReleaseAmount: tree.readyToReleaseAmount - amount,
          heldAmount: tree.heldAmount + amount,
          status: 'hold_created',
        },
      };
    case 'hold_released':
      return {
        ...decision,
        tree: {
          ...tree,
          readyToReleaseAmount: tree.readyToReleaseAmount + amount,
          heldAmount: tree.heldAmount - amount,
          status: 'reserved',
        },
      };
    case 'bank_basis_requested':
      return { ...decision, tree: { ...tree, status: 'bank_basis_requested' } };
    case 'bank_basis_confirmed':
      return {
        ...decision,
        tree: {
          ...tree,
          readyToReleaseAmount: tree.readyToReleaseAmount - amount,
          releasedAmount: tree.releasedAmount + amount,
          status: 'bank_basis_confirmed',
        },
      };
    case 'refund_confirmed':
      return {
        ...decision,
        tree: {
          ...tree,
          readyToReleaseAmount: tree.readyToReleaseAmount - amount,
          refundedAmount: tree.refundedAmount + amount,
          status: 'refunded',
        },
      };
    case 'manual_review_started':
      return {
        ...decision,
        tree: {
          ...tree,
          readyToReleaseAmount: tree.readyToReleaseAmount - amount,
          manualReviewAmount: tree.manualReviewAmount + amount,
          status: 'manual_review',
        },
      };
    case 'manual_review_resolved':
      return {
        ...decision,
        tree: {
          ...tree,
          readyToReleaseAmount: tree.readyToReleaseAmount + amount,
          manualReviewAmount: tree.manualReviewAmount - amount,
          status: 'reserved',
        },
      };
    case 'reserve_failed':
      return { ...decision, tree: { ...tree, status: 'reserve_failed' } };
    case 'bank_basis_rejected':
      return { ...decision, tree: { ...tree, status: 'bank_basis_rejected' } };
    case 'refund_requested':
      return { ...decision, tree: { ...tree, status: 'refund_requested' } };
    case 'reconciliation_failed':
      return { ...decision, tree: { ...tree, status: 'reconciliation_failed' } };
    default:
      return {
        valid: false,
        code: 'UNSUPPORTED_OPERATION',
        reason: 'Money operation type is not supported by MoneyTree runtime.',
        tree,
      };
  }
}
