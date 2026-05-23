import {
  auditDeniedAccess,
  platformV7AccessDecision,
  type PlatformV7AccessActor,
  type PlatformV7AccessDecision,
  type PlatformV7Action,
  type PlatformV7DeniedAccessAuditEvent,
  type PlatformV7ResourceScope,
} from './access-control';
import {
  p7ConfirmBankHold,
  p7ConfirmBankRefund,
  p7ConfirmBankRelease,
  p7MarkBankBasisSent,
  p7RejectBankRelease,
  p7StartBankManualReview,
  type P7BankAuditAction,
  type P7BankBasisDecision,
  type P7BankBasisSendResult,
  type P7BankConfirmationEvent,
  type P7BankConfirmationPath,
  type P7BankConfirmationResult,
} from './bank-basis';
import {
  type PlatformV7DocumentRequirement,
  type PlatformV7DocumentStatus,
} from './document-matrix';
import {
  platformV7ApplyMoneyOperation,
  platformV7ValidateMoneyOperationIdempotency,
  type PlatformV7MoneyOperation,
  type PlatformV7MoneyOperationApplyResult,
  type PlatformV7MoneyOperationType,
  type PlatformV7MoneyTree,
  type PlatformV7ReleaseGateInput,
} from './money-tree';
import { validatePlatformV7IdempotencyKey } from './idempotency-key-helper';
import { toPlatformV7CanonicalRole, type PlatformV7CanonicalRole } from './role-canonical';

export type P7ActionIdempotencyContext = {
  readonly processedKeys: readonly string[];
  readonly processedBankEventIds: readonly string[];
  readonly processedOperationIds: readonly string[];
};

export type PlatformV7DocumentAction =
  | 'document_uploaded'
  | 'document_signed'
  | 'document_sent'
  | 'document_confirmed'
  | 'document_rejected'
  | 'document_expired'
  | 'document_manual_review_started'
  | 'document_manual_review_resolved';

export type PlatformV7ActionBoundaryStatus = 'applied' | 'duplicate' | 'denied' | 'blocked';

export interface PlatformV7ActionBoundaryAuditPayload<TState = unknown> {
  readonly auditId: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly organizationId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: string;
  readonly beforeState: TState;
  readonly afterState: TState;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly duplicate: boolean;
  readonly auditCode: string;
}

export interface PlatformV7ActionBoundaryResult<TState = unknown, TDomainResult = unknown> {
  readonly ok: boolean;
  readonly status: PlatformV7ActionBoundaryStatus;
  readonly code: string;
  readonly reason: string;
  readonly beforeState: TState;
  readonly afterState: TState;
  readonly auditPayload: PlatformV7ActionBoundaryAuditPayload<TState>;
  readonly deniedPayload?: PlatformV7DeniedAccessAuditEvent | null;
  readonly accessDecision?: PlatformV7AccessDecision;
  readonly domainResult?: TDomainResult;
}

interface PlatformV7BoundaryBaseInput<TAction extends string, TPayload> {
  readonly actor: PlatformV7AccessActor;
  readonly resource: PlatformV7ResourceScope;
  readonly action: TAction;
  readonly payload: TPayload;
  readonly idempotencyContext: P7ActionIdempotencyContext;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly reason: string;
  readonly createdAt?: string;
}

export interface PlatformV7MoneyActionPayload {
  readonly beforeMoneyTree: PlatformV7MoneyTree;
  readonly operation: PlatformV7MoneyOperation;
  readonly releaseGate?: PlatformV7ReleaseGateInput;
  readonly bankConfirmationExists: boolean;
  readonly basisDocumentIds?: readonly string[];
}

export type PlatformV7MoneyActionInput = PlatformV7BoundaryBaseInput<PlatformV7MoneyOperationType, PlatformV7MoneyActionPayload>;

export interface PlatformV7DocumentActionPayload {
  readonly document: PlatformV7DocumentRequirement;
}

export type PlatformV7DocumentActionInput = PlatformV7BoundaryBaseInput<PlatformV7DocumentAction, PlatformV7DocumentActionPayload>;

export type PlatformV7BankBasisActionInput =
  | PlatformV7BoundaryBaseInput<'bank_basis_sent', {
    readonly decision: P7BankBasisDecision;
    readonly moneyTree: PlatformV7MoneyTree;
  }>
  | PlatformV7BoundaryBaseInput<'bank_release_confirmed', {
    readonly decision: P7BankBasisDecision;
    readonly moneyTree: PlatformV7MoneyTree;
    readonly confirmation: P7BankConfirmationEvent<'release'>;
  }>
  | PlatformV7BoundaryBaseInput<'bank_release_rejected', {
    readonly decision: P7BankBasisDecision;
    readonly moneyTree: PlatformV7MoneyTree;
    readonly confirmation: P7BankConfirmationEvent<'reject'>;
  }>
  | PlatformV7BoundaryBaseInput<'bank_refund_confirmed', {
    readonly decision: P7BankBasisDecision;
    readonly moneyTree: PlatformV7MoneyTree;
    readonly confirmation: P7BankConfirmationEvent<'refund'>;
  }>
  | PlatformV7BoundaryBaseInput<'bank_hold_confirmed', {
    readonly decision: P7BankBasisDecision;
    readonly moneyTree: PlatformV7MoneyTree;
    readonly confirmation: P7BankConfirmationEvent<'hold'>;
  }>
  | PlatformV7BoundaryBaseInput<'bank_manual_review_started', {
    readonly decision: P7BankBasisDecision;
    readonly moneyTree: PlatformV7MoneyTree;
    readonly confirmation: P7BankConfirmationEvent<'manual_review'>;
  }>
  | PlatformV7BoundaryBaseInput<'bank_manual_review_resolved', {
    readonly decision: P7BankBasisDecision;
    readonly beforeMoneyTree: PlatformV7MoneyTree;
    readonly afterMoneyTree: PlatformV7MoneyTree;
    readonly bankEventId: string;
  }>;

const DOCUMENT_STATUS_BY_ACTION: Record<PlatformV7DocumentAction, PlatformV7DocumentStatus> = {
  document_uploaded: 'uploaded',
  document_signed: 'signed',
  document_sent: 'sent',
  document_confirmed: 'confirmed',
  document_rejected: 'rejected',
  document_expired: 'expired',
  document_manual_review_started: 'manual_review',
  document_manual_review_resolved: 'confirmed',
};

function createdAtOrNow(createdAt?: string): string {
  return createdAt ?? new Date().toISOString();
}

function canonicalActiveRole(actor: PlatformV7AccessActor): PlatformV7CanonicalRole {
  return toPlatformV7CanonicalRole(actor.activeRole) ?? 'operator';
}

function actionAuditPayload<TState>(input: {
  readonly actor: PlatformV7AccessActor;
  readonly resource: PlatformV7ResourceScope;
  readonly action: string;
  readonly beforeState: TState;
  readonly afterState: TState;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly createdAt: string;
  readonly duplicate: boolean;
  readonly auditCode: string;
}): PlatformV7ActionBoundaryAuditPayload<TState> {
  return {
    auditId: input.auditId,
    correlationId: input.correlationId,
    actorId: input.actor.userId,
    actorRole: input.actor.activeRole,
    organizationId: input.actor.organizationId,
    resourceType: input.resource.resourceType,
    resourceId: input.resource.resourceId,
    action: input.action,
    beforeState: input.beforeState,
    afterState: input.afterState,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    duplicate: input.duplicate,
    auditCode: input.auditCode,
  };
}

function duplicateResult<TState, TDomainResult = never>(
  input: PlatformV7BoundaryBaseInput<string, unknown>,
  beforeState: TState,
  code: string,
  reason: string,
): PlatformV7ActionBoundaryResult<TState, TDomainResult> {
  const createdAt = createdAtOrNow(input.createdAt);
  return {
    ok: false,
    status: 'duplicate',
    code,
    reason,
    beforeState,
    afterState: beforeState,
    auditPayload: actionAuditPayload({
      ...input,
      beforeState,
      afterState: beforeState,
      createdAt,
      duplicate: true,
      auditCode: code,
    }),
  };
}

function blockedResult<TState, TDomainResult = never>(
  input: PlatformV7BoundaryBaseInput<string, unknown>,
  beforeState: TState,
  code: string,
  reason: string,
): PlatformV7ActionBoundaryResult<TState, TDomainResult> {
  const createdAt = createdAtOrNow(input.createdAt);
  return {
    ok: false,
    status: 'blocked',
    code,
    reason,
    beforeState,
    afterState: beforeState,
    auditPayload: actionAuditPayload({
      ...input,
      beforeState,
      afterState: beforeState,
      createdAt,
      duplicate: false,
      auditCode: code,
    }),
  };
}

function deniedResult<TState, TDomainResult = never>(
  input: PlatformV7BoundaryBaseInput<string, unknown>,
  beforeState: TState,
  decision: PlatformV7AccessDecision,
): PlatformV7ActionBoundaryResult<TState, TDomainResult> {
  const createdAt = createdAtOrNow(input.createdAt);
  return {
    ok: false,
    status: 'denied',
    code: decision.auditCode,
    reason: decision.reason,
    beforeState,
    afterState: beforeState,
    accessDecision: decision,
    deniedPayload: auditDeniedAccess({
      actor: input.actor,
      resource: input.resource,
      action: mapBoundaryActionToPermission(input.action),
      correlationId: input.correlationId,
      auditId: input.auditId,
    }, decision),
    auditPayload: actionAuditPayload({
      ...input,
      beforeState,
      afterState: beforeState,
      createdAt,
      duplicate: false,
      auditCode: decision.auditCode,
      reason: decision.reason,
    }),
  };
}

function validateIdempotencyKey(input: PlatformV7BoundaryBaseInput<string, unknown>, moneyOnly: boolean): string | null {
  if (moneyOnly) {
    const validation = platformV7ValidateMoneyOperationIdempotency(input.idempotencyKey);
    return validation.valid ? null : validation.reason;
  }

  const validation = validatePlatformV7IdempotencyKey(input.idempotencyKey);
  return validation.ok ? null : validation.issues.join(' ');
}

function validateKeyAndDuplicates<TState>(
  input: PlatformV7BoundaryBaseInput<string, unknown>,
  beforeState: TState,
  options: {
    readonly moneyOnly: boolean;
    readonly bankEventId?: string;
    readonly operationId?: string;
  },
): PlatformV7ActionBoundaryResult<TState> | null {
  const invalidReason = validateIdempotencyKey(input, options.moneyOnly);
  if (invalidReason) return blockedResult(input, beforeState, 'INVALID_IDEMPOTENCY_KEY', invalidReason);

  if (input.idempotencyContext.processedKeys.includes(input.idempotencyKey)) {
    return duplicateResult(input, beforeState, 'DUPLICATE_IDEMPOTENCY_KEY', 'Idempotency key was already processed.');
  }

  if (options.bankEventId && input.idempotencyContext.processedBankEventIds.includes(options.bankEventId)) {
    return duplicateResult(input, beforeState, 'DUPLICATE_BANK_EVENT', 'Bank event was already processed.');
  }

  if (options.operationId && input.idempotencyContext.processedOperationIds.includes(options.operationId)) {
    return duplicateResult(input, beforeState, 'DUPLICATE_OPERATION', 'Money operation was already applied.');
  }

  return null;
}

function assertBoundaryPermission<TState>(
  input: PlatformV7BoundaryBaseInput<string, unknown>,
  beforeState: TState,
): PlatformV7ActionBoundaryResult<TState> | null {
  const request = {
    actor: input.actor,
    resource: input.resource,
    action: mapBoundaryActionToPermission(input.action),
    correlationId: input.correlationId,
    auditId: input.auditId,
  };
  const decision = platformV7AccessDecision(request);
  if (!decision.allowed) return deniedResult(input, beforeState, decision);

  return null;
}

function mapBoundaryActionToPermission(action: string): PlatformV7Action {
  if (action === 'release_confirmed' || action === 'bank_release_confirmed') return 'CONFIRM_BANK_RELEASE';
  if (action === 'release_failed' || action === 'bank_release_rejected') return 'CONFIRM_BANK_RELEASE';
  if (action === 'reserve_confirmed') return 'CONFIRM_BANK_RESERVE';
  if (action === 'refund_confirmed' || action === 'bank_refund_confirmed') return 'CONFIRM_BANK_REFUND';
  if (
    action === 'hold_created'
    || action === 'hold_released'
    || action === 'manual_review_started'
    || action === 'manual_review_resolved'
    || action === 'bank_hold_confirmed'
    || action === 'bank_manual_review_started'
    || action === 'bank_manual_review_resolved'
  ) return 'hold';
  if (action === 'release_requested' || action === 'refund_requested' || action === 'reserve_requested') return 'request';
  if (action === 'bank_basis_sent') return 'submit';
  if (action.startsWith('document_')) return action === 'document_confirmed' ? 'confirm' : 'update';
  return 'update';
}

function successfulResult<TState, TDomainResult>(
  input: PlatformV7BoundaryBaseInput<string, unknown>,
  beforeState: TState,
  afterState: TState,
  domainResult: TDomainResult,
): PlatformV7ActionBoundaryResult<TState, TDomainResult> {
  const createdAt = createdAtOrNow(input.createdAt);
  return {
    ok: true,
    status: 'applied',
    code: 'OK',
    reason: input.reason,
    beforeState,
    afterState,
    domainResult,
    auditPayload: actionAuditPayload({
      ...input,
      beforeState,
      afterState,
      createdAt,
      duplicate: false,
      auditCode: 'OK',
    }),
  };
}

export function executePlatformV7MoneyAction(
  input: PlatformV7MoneyActionInput,
): PlatformV7ActionBoundaryResult<PlatformV7MoneyTree, PlatformV7MoneyOperationApplyResult> {
  const beforeState = input.payload.beforeMoneyTree;
  const keyBlock = validateKeyAndDuplicates(input, beforeState, {
    moneyOnly: true,
    operationId: input.payload.operation.operationId,
  });
  if (keyBlock) return keyBlock as PlatformV7ActionBoundaryResult<PlatformV7MoneyTree, PlatformV7MoneyOperationApplyResult>;

  const denied = assertBoundaryPermission(input, beforeState);
  if (denied) return denied as PlatformV7ActionBoundaryResult<PlatformV7MoneyTree, PlatformV7MoneyOperationApplyResult>;

  if (input.payload.operation.idempotencyKey !== input.idempotencyKey) {
    return blockedResult(input, beforeState, 'IDEMPOTENCY_KEY_MISMATCH', 'Envelope idempotency key must match the money operation key.');
  }

  const moneyResult = platformV7ApplyMoneyOperation({
    tree: beforeState,
    operation: input.payload.operation,
    releaseGate: input.payload.releaseGate,
    bankConfirmationExists: input.payload.bankConfirmationExists,
    existingOperationIds: input.idempotencyContext.processedOperationIds,
    usedIdempotencyKeys: input.idempotencyContext.processedKeys,
  });

  if (!moneyResult.valid) return blockedResult(input, beforeState, moneyResult.code, moneyResult.reason);

  return successfulResult(input, beforeState, moneyResult.tree, moneyResult);
}

export function executePlatformV7DocumentAction(
  input: PlatformV7DocumentActionInput,
): PlatformV7ActionBoundaryResult<PlatformV7DocumentRequirement, PlatformV7DocumentRequirement> {
  const beforeState = input.payload.document;
  const keyBlock = validateKeyAndDuplicates(input, beforeState, { moneyOnly: false });
  if (keyBlock) return keyBlock as PlatformV7ActionBoundaryResult<PlatformV7DocumentRequirement, PlatformV7DocumentRequirement>;

  const denied = assertBoundaryPermission(input, beforeState);
  if (denied) return denied as PlatformV7ActionBoundaryResult<PlatformV7DocumentRequirement, PlatformV7DocumentRequirement>;

  if (input.action === 'document_confirmed' && beforeState.documentId === 'lab_protocol' && input.actor.activeRole !== 'lab_specialist') {
    return deniedResult(input, beforeState, {
      allowed: false,
      auditCode: 'LAB_PROTOCOL_ROLE_REQUIRED',
      reason: 'Only LabSpecialist can confirm lab protocol documents.',
    });
  }

  if ((input.action === 'document_confirmed' || input.action === 'document_signed') && beforeState.documentId === 'acceptance_act' && input.actor.activeRole !== 'elevator_operator') {
    return deniedResult(input, beforeState, {
      allowed: false,
      auditCode: 'ELEVATOR_ACCEPTANCE_ROLE_REQUIRED',
      reason: 'Only ElevatorOperator can confirm acceptance and weight documents.',
    });
  }

  const afterState = {
    ...beforeState,
    status: DOCUMENT_STATUS_BY_ACTION[input.action],
    updatedAt: createdAtOrNow(input.createdAt),
  };

  return successfulResult(input, beforeState, afterState, afterState);
}

function bankEventIdFor(input: PlatformV7BankBasisActionInput): string | undefined {
  if ('confirmation' in input.payload) return input.payload.confirmation.bankEventId;
  if ('bankEventId' in input.payload) return input.payload.bankEventId;
  return undefined;
}

function bankOperationIdFor(input: PlatformV7BankBasisActionInput): string | undefined {
  if ('confirmation' in input.payload) return `bank:${input.payload.confirmation.bankEventId}`;
  if ('bankEventId' in input.payload) return `bank:${input.payload.bankEventId}`;
  return undefined;
}

function executeBankDomainAction(input: PlatformV7BankBasisActionInput): P7BankBasisSendResult | P7BankConfirmationResult {
  if (input.action === 'bank_basis_sent') {
    return p7MarkBankBasisSent({
      decision: input.payload.decision,
      moneyTree: input.payload.moneyTree,
      actorId: input.actor.userId,
      actorRole: canonicalActiveRole(input.actor),
      organizationId: input.actor.organizationId,
      createdAt: createdAtOrNow(input.createdAt),
    });
  }

  if (input.action === 'bank_release_confirmed') {
    return p7ConfirmBankRelease({
      decision: input.payload.decision,
      moneyTree: input.payload.moneyTree,
      confirmation: input.payload.confirmation,
      existingBankEventIds: input.idempotencyContext.processedBankEventIds,
      usedIdempotencyKeys: input.idempotencyContext.processedKeys,
      existingOperationIds: input.idempotencyContext.processedOperationIds,
    });
  }

  if (input.action === 'bank_release_rejected') {
    return p7RejectBankRelease({
      decision: input.payload.decision,
      moneyTree: input.payload.moneyTree,
      confirmation: input.payload.confirmation,
      existingBankEventIds: input.idempotencyContext.processedBankEventIds,
      usedIdempotencyKeys: input.idempotencyContext.processedKeys,
      existingOperationIds: input.idempotencyContext.processedOperationIds,
    });
  }

  if (input.action === 'bank_refund_confirmed') {
    return p7ConfirmBankRefund({
      decision: input.payload.decision,
      moneyTree: input.payload.moneyTree,
      confirmation: input.payload.confirmation,
      existingBankEventIds: input.idempotencyContext.processedBankEventIds,
      usedIdempotencyKeys: input.idempotencyContext.processedKeys,
      existingOperationIds: input.idempotencyContext.processedOperationIds,
    });
  }

  if (input.action === 'bank_hold_confirmed') {
    return p7ConfirmBankHold({
      decision: input.payload.decision,
      moneyTree: input.payload.moneyTree,
      confirmation: input.payload.confirmation,
      existingBankEventIds: input.idempotencyContext.processedBankEventIds,
      usedIdempotencyKeys: input.idempotencyContext.processedKeys,
      existingOperationIds: input.idempotencyContext.processedOperationIds,
    });
  }

  if (input.action === 'bank_manual_review_started') {
    return p7StartBankManualReview({
      decision: input.payload.decision,
      moneyTree: input.payload.moneyTree,
      confirmation: input.payload.confirmation,
      existingBankEventIds: input.idempotencyContext.processedBankEventIds,
      usedIdempotencyKeys: input.idempotencyContext.processedKeys,
      existingOperationIds: input.idempotencyContext.processedOperationIds,
    });
  }

  return {
    valid: true,
    code: 'OK',
    reason: input.reason,
    decision: input.payload.decision,
    moneyTree: input.payload.afterMoneyTree,
    auditPayload: {
      auditId: input.auditId,
      correlationId: input.correlationId,
      actorId: input.actor.userId,
      actorRole: canonicalActiveRole(input.actor),
      organizationId: input.actor.organizationId,
      dealId: input.payload.decision.dealId,
      moneyOperationId: null,
      beforeMoneyTree: input.payload.beforeMoneyTree,
      afterMoneyTree: input.payload.afterMoneyTree,
      basisDocumentIds: input.payload.decision.basisDocumentIds,
      bankEventId: input.payload.bankEventId,
      action: 'bank_manual_review_resolved',
      createdAt: createdAtOrNow(input.createdAt),
      outcome: 'allowed',
      code: 'OK',
      reason: input.reason,
    },
    auditPayloads: [],
  };
}

export function executePlatformV7BankBasisAction(
  input: PlatformV7BankBasisActionInput,
): PlatformV7ActionBoundaryResult<PlatformV7MoneyTree, P7BankBasisSendResult | P7BankConfirmationResult> {
  const beforeState = input.action === 'bank_manual_review_resolved'
    ? input.payload.beforeMoneyTree
    : input.payload.moneyTree;
  const keyBlock = validateKeyAndDuplicates(input, beforeState, {
    moneyOnly: true,
    bankEventId: bankEventIdFor(input),
    operationId: bankOperationIdFor(input),
  });
  if (keyBlock) return keyBlock as PlatformV7ActionBoundaryResult<PlatformV7MoneyTree, P7BankBasisSendResult | P7BankConfirmationResult>;

  const denied = assertBoundaryPermission(input, beforeState);
  if (denied) return denied as PlatformV7ActionBoundaryResult<PlatformV7MoneyTree, P7BankBasisSendResult | P7BankConfirmationResult>;

  const bankResult = executeBankDomainAction(input);
  const afterState = 'moneyTree' in bankResult ? bankResult.moneyTree : beforeState;

  if (!bankResult.valid) return blockedResult(input, beforeState, bankResult.code, bankResult.reason);

  return successfulResult(input, beforeState, afterState, bankResult);
}
