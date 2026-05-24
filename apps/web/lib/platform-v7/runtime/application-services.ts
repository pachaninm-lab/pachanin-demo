/**
 * @file application-services.ts
 * @stage controlled-pilot / pre-integration
 *
 * P7 Application Service Layer — PR 5.1
 *
 * Wires DTO validation (dto-schemas.ts) → persistence ports (persistence-ports.ts)
 * → action-boundary (action-boundary.ts) and returns typed service results.
 *
 * INVARIANT: this file NEVER calls Stage 4 domain mutation functions directly.
 * All mutations route through `executePlatformV7MoneyAction`,
 * `executePlatformV7DocumentAction`, or `executePlatformV7BankBasisAction`.
 *
 * Persistence is injected via P7ApplicationServiceDependencies.unitOfWork.
 * No module-level state.  No DB client.  No server-action directives.
 * No mock adapter.  Pure orchestration.
 */

import {
  executePlatformV7BankBasisAction,
  executePlatformV7DocumentAction,
  executePlatformV7MoneyAction,
  type PlatformV7ActionBoundaryResult,
  type PlatformV7BankBasisActionInput,
  type PlatformV7DocumentActionInput,
  type PlatformV7MoneyActionInput,
} from '../action-boundary';
import type { PlatformV7AccessActor, PlatformV7AccessRole, PlatformV7ResourceScope } from '../access-control';
import type {
  P7BankBasisDecision,
  P7BankConfirmationEvent,
  P7BankConfirmationPath,
} from '../bank-basis';
import type { PlatformV7DocumentRequirement } from '../document-matrix';
import type { PlatformV7MoneyTree } from '../money-tree';
import type { PlatformV7CanonicalRole } from '../role-canonical';
import {
  toP7CanonicalActorRole,
  validateP7ArbitrationBasisRequestDto,
  validateP7BankBasisSendRequestDto,
  validateP7BankConfirmationRequestDto,
  validateP7DocumentActionRequestDto,
  validateP7HoldRequestDto,
  validateP7MoneyActionRequestDto,
  validateP7RefundRequestDto,
  validateP7ReleaseRequestDto,
  type P7ArbitrationBasisRequestDto,
  type P7BankBasisSendRequestDto,
  type P7BankConfirmationRequestDto,
  type P7DocumentActionRequestDto,
  type P7HoldRequestDto,
  type P7MoneyActionRequestDto,
  type P7RefundRequestDto,
  type P7ReleaseRequestDto,
  type P7ValidationError,
  type P7ValidationResult,
} from './dto-schemas';
import type {
  P7ArbitrationDecisionRecord,
  P7AuditPayload,
  P7IdempotencyScope,
  P7PersistedRecord,
  P7RepositoryResult,
  P7RuntimeError,
  P7RuntimeResult,
  P7RuntimeUnitOfWork,
  P7SaveOptions,
} from './persistence-ports';
import type {
  P7ApplicationServiceDependencies,
  P7ServiceBankBasisResult,
  P7ServiceBankConfirmResult,
  P7ServiceConflictResult,
  P7ServiceDisputeSettlementResult,
  P7ServiceDocumentResult,
  P7ServiceDomainBlockedResult,
  P7ServiceDeniedResult,
  P7ServiceDuplicateResult,
  P7ServiceMoneyResult,
  P7ServiceNotFoundResult,
  P7ServiceOkResult,
  P7ServiceReleaseWorkflowResult,
  P7ServiceValidationError,
} from './application-service-types';

// ---------------------------------------------------------------------------
// Internal utilities — no module-level state
// ---------------------------------------------------------------------------

function nowOrClock(clock?: () => string): string {
  return clock ? clock() : new Date().toISOString();
}

function makeCorrelationId(generate?: () => string): string {
  if (generate) return generate();
  return `p7-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Extract validation errors from a P7ValidationResult without relying on inline narrowing. */
function extractErrors<T>(
  result: P7ValidationResult<T>,
): readonly P7ValidationError[] | null {
  if (result.ok) return null;
  return (result as { ok: false; errors: readonly P7ValidationError[] }).errors;
}

/** Extract error message from a failed P7RepositoryResult using a safe type assertion. */
function repoErrMsg(result: P7RepositoryResult<unknown>): string {
  return (result as { ok: false; error: P7RuntimeError }).error.message;
}

/** Extract error from a failed P7RepositoryResult using a safe type assertion. */
function repoConflictVersion(result: P7RepositoryResult<unknown>): string | undefined {
  const r = result as { ok: false; currentVersion?: { version: string } };
  return r.currentVersion?.version;
}

/** Extract error message from a failed P7RuntimeResult using a safe type assertion. */
function runtimeErrMsg(result: P7RuntimeResult<unknown>): string {
  return (result as { ok: false; error: P7RuntimeError }).error.message;
}

/** Extract the full P7RuntimeError from a failed P7RepositoryResult. */
function repoError(result: P7RepositoryResult<unknown>): P7RuntimeError {
  return (result as { ok: false; error: P7RuntimeError }).error;
}

function validationError(
  errors: readonly P7ValidationError[],
  correlationId: string,
): P7ServiceValidationError {
  return { status: 'validation_error', ok: false, errors, correlationId };
}

function notFound(reason: string, correlationId: string): P7ServiceNotFoundResult {
  return { status: 'not_found', ok: false, code: 'NOT_FOUND', reason, correlationId };
}

function conflictResult(
  reason: string,
  correlationId: string,
  currentVersion?: string,
): P7ServiceConflictResult {
  return { status: 'conflict', ok: false, code: 'CONFLICT', reason, currentVersion, correlationId };
}

function buildActor(
  actorId: string,
  organizationId: string,
  activeRole: PlatformV7CanonicalRole,
): PlatformV7AccessActor {
  return {
    userId: actorId,
    organizationId,
    roles: [activeRole as PlatformV7AccessRole],
    activeRole: activeRole as PlatformV7AccessRole,
  };
}

function buildResource(dto: {
  resource: {
    resourceType: string;
    resourceId: string;
    ownerOrganizationId?: string;
    buyerOrganizationId?: string;
    sellerOrganizationId?: string;
    bankOrganizationId?: string;
  };
}): PlatformV7ResourceScope {
  return {
    resourceType: dto.resource.resourceType as PlatformV7ResourceScope['resourceType'],
    resourceId: dto.resource.resourceId,
    ownerOrganizationId: dto.resource.ownerOrganizationId,
    buyerOrganizationId: dto.resource.buyerOrganizationId,
    sellerOrganizationId: dto.resource.sellerOrganizationId,
  };
}

function idempotencyScope(dto: {
  resource: { dealId: string; resourceType?: string; resourceId?: string };
  actor: { actorId: string };
  audit: { correlationId: string };
}): P7IdempotencyScope {
  return {
    dealId: dto.resource.dealId,
    resourceType: dto.resource.resourceType,
    resourceId: dto.resource.resourceId,
    actorId: dto.actor.actorId,
    correlationId: dto.audit.correlationId,
  };
}

function baseSaveOptions(
  dto: {
    audit: { correlationId: string; auditId: string; reason: string };
    actor: { actorId: string };
  },
  expectedVersion?: string,
): P7SaveOptions {
  return {
    correlationId: dto.audit.correlationId,
    auditId: dto.audit.auditId,
    actorId: dto.actor.actorId,
    reason: dto.audit.reason,
    expectedVersion,
  };
}

function mapBoundaryResultToService<TBefore>(
  boundaryResult: PlatformV7ActionBoundaryResult<TBefore>,
  correlationId: string,
):
  | P7ServiceOkResult<TBefore>
  | P7ServiceDeniedResult<TBefore>
  | P7ServiceDuplicateResult<TBefore>
  | P7ServiceDomainBlockedResult<TBefore> {
  if (boundaryResult.status === 'applied') {
    return {
      status: 'ok',
      ok: true,
      code: boundaryResult.code,
      reason: boundaryResult.reason,
      beforeState: boundaryResult.beforeState,
      afterState: boundaryResult.afterState,
      auditPayload: boundaryResult.auditPayload,
      correlationId,
    };
  }
  if (boundaryResult.status === 'denied') {
    return {
      status: 'denied',
      ok: false,
      code: boundaryResult.code,
      reason: boundaryResult.reason,
      beforeState: boundaryResult.beforeState,
      afterState: boundaryResult.afterState,
      auditPayload: boundaryResult.auditPayload,
      correlationId,
    };
  }
  if (boundaryResult.status === 'duplicate') {
    return {
      status: 'duplicate',
      ok: false,
      code: boundaryResult.code,
      reason: boundaryResult.reason,
      beforeState: boundaryResult.beforeState,
      afterState: boundaryResult.afterState,
      auditPayload: boundaryResult.auditPayload,
      correlationId,
    };
  }
  // blocked
  return {
    status: 'domain_blocked',
    ok: false,
    code: boundaryResult.code,
    reason: boundaryResult.reason,
    beforeState: boundaryResult.beforeState,
    afterState: boundaryResult.afterState,
    correlationId,
  };
}

// ---------------------------------------------------------------------------
// 7-step idempotency duplicate check
// ---------------------------------------------------------------------------

async function checkDuplicate<TBefore>(
  uow: P7RuntimeUnitOfWork,
  key: string,
): Promise<{ isDuplicate: boolean; cachedPayload?: PlatformV7ActionBoundaryResult<TBefore> }> {
  const hasKey = await uow.idempotency.hasProcessedKey(key);
  if (!hasKey.ok || !hasKey.value) return { isDuplicate: false };
  const cached = await uow.idempotency.loadDuplicateResult(key);
  if (!cached.ok) return { isDuplicate: false };
  return {
    isDuplicate: true,
    cachedPayload: cached.value.value as unknown as PlatformV7ActionBoundaryResult<TBefore>,
  };
}

// ---------------------------------------------------------------------------
// Bank confirmation operation type helper
// ---------------------------------------------------------------------------

const OPERATION_TYPE_BY_PATH: Record<P7BankConfirmationPath, string> = {
  release: 'release_confirmed',
  refund: 'refund_confirmed',
  hold: 'hold_created',
  reject: 'release_failed',
  manual_review: 'manual_review_started',
};

// ---------------------------------------------------------------------------
// Money Execution Service
// ---------------------------------------------------------------------------

export interface P7MoneyExecutionService {
  requestRelease(dto: P7MoneyActionRequestDto): Promise<P7ServiceMoneyResult>;
  confirmRelease(dto: P7MoneyActionRequestDto): Promise<P7ServiceMoneyResult>;
  confirmRefund(dto: P7RefundRequestDto): Promise<P7ServiceMoneyResult>;
  confirmHold(dto: P7HoldRequestDto): Promise<P7ServiceMoneyResult>;
}

async function executeMoneyAction(
  dto: P7MoneyActionRequestDto,
  deps: P7ApplicationServiceDependencies,
): Promise<P7ServiceMoneyResult> {
  const { unitOfWork: uow } = deps;
  const correlationId = makeCorrelationId(deps.generateCorrelationId);

  // Step 1 — validate DTO
  const validation = validateP7MoneyActionRequestDto(dto);
  const validationErrors = extractErrors(validation);
  if (validationErrors) return validationError(validationErrors, correlationId);

  const actorRole = toP7CanonicalActorRole(dto.actor);
  if (!actorRole) {
    return validationError(
      [{ code: 'INVALID_ROLE', field: 'actor.actorRole', message: `Unknown canonical role: ${dto.actor.actorRole}` }],
      correlationId,
    );
  }

  // Step 2 — load current MoneyTree
  const treeResult = await uow.moneyTree.loadByDealId(dto.resource.dealId);
  if (!treeResult.ok) {
    if (treeResult.status === 'not_found') return notFound(`MoneyTree not found for deal ${dto.resource.dealId}`, correlationId);
    return conflictResult(repoErrMsg(treeResult), correlationId);
  }
  const persistedTree = treeResult.value;

  // Step 3 — load idempotency context from store (never hardcoded [])
  const idempotencyContext = await uow.idempotency.loadContext(idempotencyScope(dto));

  // Step 3b — check for duplicate before any mutation
  const dupCheck = await checkDuplicate<PlatformV7MoneyTree>(uow, dto.idempotency.idempotencyKey);
  if (dupCheck.isDuplicate && dupCheck.cachedPayload) {
    const mapped = mapBoundaryResultToService<PlatformV7MoneyTree>(dupCheck.cachedPayload, correlationId);
    await uow.audit.append(dupCheck.cachedPayload.auditPayload as P7AuditPayload);
    return mapped;
  }

  // Step 4 — reserve idempotency key before mutation
  const reservation = await uow.idempotency.reserveKey({
    key: dto.idempotency.idempotencyKey,
    scope: idempotencyScope(dto),
    operationId: dto.idempotency.operationId,
    correlationId: dto.audit.correlationId,
    auditId: dto.audit.auditId,
  });
  if (!reservation.ok) {
    return conflictResult(`Idempotency key reservation failed: ${runtimeErrMsg(reservation)}`, correlationId);
  }

  const now = nowOrClock(deps.clock);

  // Step 5 — execute action-boundary
  const boundaryInput: PlatformV7MoneyActionInput = {
    actor: buildActor(dto.actor.actorId, dto.actor.organizationId, actorRole),
    resource: buildResource(dto),
    action: dto.action,
    payload: {
      beforeMoneyTree: persistedTree.value,
      operation: {
        operationId: dto.idempotency.operationId ?? dto.idempotency.idempotencyKey,
        dealId: dto.resource.dealId,
        type: dto.action,
        amount: dto.amount,
        currency: dto.currency,
        basisDocumentIds: [],
        actorId: dto.actor.actorId,
        actorRole: actorRole,
        occurredAt: now,
        idempotencyKey: dto.idempotency.idempotencyKey,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
      },
      bankConfirmationExists: false,
    },
    idempotencyContext,
    idempotencyKey: dto.idempotency.idempotencyKey,
    correlationId: dto.audit.correlationId,
    auditId: dto.audit.auditId,
    reason: dto.audit.reason,
    createdAt: now,
  };

  const boundaryResult = executePlatformV7MoneyAction(boundaryInput);
  const serviceResult = mapBoundaryResultToService<PlatformV7MoneyTree>(boundaryResult, correlationId);

  // Step 6 — save result if applied
  if (serviceResult.status === 'ok') {
    const updatedRecord: P7PersistedRecord<PlatformV7MoneyTree> = {
      ...persistedTree,
      value: boundaryResult.afterState,
      updatedAt: now,
    };
    const saveResult = await uow.moneyTree.saveMoneyTree(
      updatedRecord,
      baseSaveOptions(dto, persistedTree.version.version),
    );
    if (!saveResult.ok) {
      return conflictResult(
        repoErrMsg(saveResult),
        correlationId,
        saveResult.status === 'conflict' ? saveResult.currentVersion?.version : undefined,
      );
    }
  }

  // Step 7 — record idempotency result
  await uow.idempotency.recordResult({
    key: dto.idempotency.idempotencyKey,
    scope: idempotencyScope(dto),
    result: boundaryResult,
    operationId: dto.idempotency.operationId,
    correlationId: dto.audit.correlationId,
    auditId: dto.audit.auditId,
  });

  // Step 8 — append audit on all paths
  await uow.audit.append(boundaryResult.auditPayload as P7AuditPayload);

  return serviceResult;
}

export function createP7MoneyExecutionService(
  deps: P7ApplicationServiceDependencies,
): P7MoneyExecutionService {
  return {
    requestRelease: (dto) => executeMoneyAction(dto, deps),
    confirmRelease: (dto) => executeMoneyAction(dto, deps),
    async confirmRefund(dto: P7RefundRequestDto): Promise<P7ServiceMoneyResult> {
      const correlationId = makeCorrelationId(deps.generateCorrelationId);
      const errors = extractErrors(validateP7RefundRequestDto(dto));
      if (errors) return validationError(errors, correlationId);
      return executeMoneyAction(
        {
          actor: dto.actor,
          resource: dto.resource,
          audit: dto.audit,
          idempotency: { idempotencyKey: dto.idempotency.idempotencyKey, bankEventId: dto.bankEventId },
          action: 'refund_confirmed',
          amount: dto.amount,
          currency: dto.currency,
        },
        deps,
      );
    },
    async confirmHold(dto: P7HoldRequestDto): Promise<P7ServiceMoneyResult> {
      const correlationId = makeCorrelationId(deps.generateCorrelationId);
      const errors = extractErrors(validateP7HoldRequestDto(dto));
      if (errors) return validationError(errors, correlationId);
      return executeMoneyAction(
        {
          actor: dto.actor,
          resource: dto.resource,
          audit: dto.audit,
          idempotency: { idempotencyKey: dto.idempotency.idempotencyKey, bankEventId: dto.bankEventId },
          action: 'hold_created',
          amount: dto.amount,
          currency: dto.currency,
        },
        deps,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Document Execution Service
// ---------------------------------------------------------------------------

export interface P7DocumentExecutionService {
  executeDocumentAction(dto: P7DocumentActionRequestDto): Promise<P7ServiceDocumentResult>;
}

export function createP7DocumentExecutionService(
  deps: P7ApplicationServiceDependencies,
): P7DocumentExecutionService {
  const { unitOfWork: uow } = deps;

  return {
    async executeDocumentAction(dto: P7DocumentActionRequestDto): Promise<P7ServiceDocumentResult> {
      const correlationId = makeCorrelationId(deps.generateCorrelationId);

      // Step 1 — validate DTO
      const errors = extractErrors(validateP7DocumentActionRequestDto(dto));
      if (errors) return validationError(errors, correlationId);

      const actorRole = toP7CanonicalActorRole(dto.actor);
      if (!actorRole) {
        return validationError(
          [{ code: 'INVALID_ROLE', field: 'actor.actorRole', message: `Unknown canonical role: ${dto.actor.actorRole}` }],
          correlationId,
        );
      }

      // Step 2 — load document matrix
      const matrixResult = await uow.documentMatrix.loadByDealId(dto.resource.dealId);
      if (!matrixResult.ok) {
        if (matrixResult.status === 'not_found') return notFound(`DocumentMatrix not found for deal ${dto.resource.dealId}`, correlationId);
        return conflictResult(repoErrMsg(matrixResult), correlationId);
      }
      const persistedMatrix = matrixResult.value;

      const document = persistedMatrix.value.documents.find(
        (r) => r.documentId === dto.documentId,
      );
      if (!document) {
        return notFound(`Document ${dto.documentId} not found in matrix for deal ${dto.resource.dealId}`, correlationId);
      }

      // Step 3 — load idempotency context
      const idempotencyContext = await uow.idempotency.loadContext(idempotencyScope(dto));

      // Step 3b — check duplicate
      const dupCheck = await checkDuplicate<PlatformV7DocumentRequirement>(uow, dto.idempotency.idempotencyKey);
      if (dupCheck.isDuplicate && dupCheck.cachedPayload) {
        const mapped = mapBoundaryResultToService<PlatformV7DocumentRequirement>(
          dupCheck.cachedPayload,
          correlationId,
        );
        await uow.audit.append(dupCheck.cachedPayload.auditPayload as P7AuditPayload);
        return mapped;
      }

      // Step 4 — reserve key
      const reservation = await uow.idempotency.reserveKey({
        key: dto.idempotency.idempotencyKey,
        scope: idempotencyScope(dto),
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
      });
      if (!reservation.ok) {
        return conflictResult(`Idempotency key reservation failed: ${runtimeErrMsg(reservation)}`, correlationId);
      }

      // Step 5 — execute action-boundary
      const boundaryInput: PlatformV7DocumentActionInput = {
        actor: buildActor(dto.actor.actorId, dto.actor.organizationId, actorRole),
        resource: buildResource(dto),
        action: dto.action,
        payload: { document },
        idempotencyContext,
        idempotencyKey: dto.idempotency.idempotencyKey,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
        reason: dto.audit.reason,
        createdAt: nowOrClock(deps.clock),
      };

      const boundaryResult = executePlatformV7DocumentAction(boundaryInput);
      const serviceResult = mapBoundaryResultToService<PlatformV7DocumentRequirement>(boundaryResult, correlationId);

      // Step 6 — save if applied
      if (serviceResult.status === 'ok') {
        const saveResult = await uow.documentMatrix.saveDocumentRequirement(
          dto.resource.dealId,
          boundaryResult.afterState,
          baseSaveOptions(dto, persistedMatrix.version.version),
        );
        if (!saveResult.ok) {
          return conflictResult(
            repoErrMsg(saveResult),
            correlationId,
            saveResult.status === 'conflict' ? saveResult.currentVersion?.version : undefined,
          );
        }
      }

      // Step 7 — record idempotency
      await uow.idempotency.recordResult({
        key: dto.idempotency.idempotencyKey,
        scope: idempotencyScope(dto),
        result: boundaryResult,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
      });

      // Step 8 — append audit
      await uow.audit.append(boundaryResult.auditPayload as P7AuditPayload);

      return serviceResult;
    },
  };
}

// ---------------------------------------------------------------------------
// Bank Basis Execution Service
// ---------------------------------------------------------------------------

export interface P7BankBasisExecutionService {
  sendBankBasis(dto: P7BankBasisSendRequestDto): Promise<P7ServiceBankBasisResult>;
  confirmBankRelease(dto: P7BankConfirmationRequestDto): Promise<P7ServiceBankConfirmResult>;
  confirmBankRefund(dto: P7BankConfirmationRequestDto): Promise<P7ServiceBankConfirmResult>;
  confirmBankHold(dto: P7BankConfirmationRequestDto): Promise<P7ServiceBankConfirmResult>;
  rejectBankRelease(dto: P7BankConfirmationRequestDto): Promise<P7ServiceBankConfirmResult>;
  startBankManualReview(dto: P7BankConfirmationRequestDto): Promise<P7ServiceBankConfirmResult>;
}

async function executeBankConfirmAction(
  dto: P7BankConfirmationRequestDto,
  deps: P7ApplicationServiceDependencies,
): Promise<P7ServiceBankConfirmResult> {
  const { unitOfWork: uow } = deps;
  const correlationId = makeCorrelationId(deps.generateCorrelationId);

  // Step 1 — validate
  const errors = extractErrors(validateP7BankConfirmationRequestDto(dto));
  if (errors) return validationError(errors, correlationId);

  const actorRole = toP7CanonicalActorRole(dto.actor);
  if (!actorRole) {
    return validationError(
      [{ code: 'INVALID_ROLE', field: 'actor.actorRole', message: `Unknown canonical role: ${dto.actor.actorRole}` }],
      correlationId,
    );
  }

  // Step 2 — load MoneyTree + BankBasis
  const [treeResult, basisResult] = await Promise.all([
    uow.moneyTree.loadByDealId(dto.resource.dealId),
    uow.bankBasis.loadByDealId(dto.resource.dealId),
  ]);
  if (!treeResult.ok) {
    if (treeResult.status === 'not_found') return notFound(`MoneyTree not found for deal ${dto.resource.dealId}`, correlationId);
    return conflictResult(repoErrMsg(treeResult), correlationId);
  }
  if (!basisResult.ok) {
    if (basisResult.status === 'not_found') return notFound(`BankBasis not found for deal ${dto.resource.dealId}`, correlationId);
    return conflictResult(repoErrMsg(basisResult), correlationId);
  }
  const persistedTree = treeResult.value;
  const persistedBasis = basisResult.value;

  // Step 3 — load idempotency context
  const idempotencyContext = await uow.idempotency.loadContext(idempotencyScope(dto));

  // Step 3b — check duplicate via bankEventId
  const hasBankEvent = await uow.idempotency.hasProcessedBankEventId(dto.bankEventId);
  if (hasBankEvent.ok && hasBankEvent.value) {
    const dupResult = await uow.idempotency.loadDuplicateResult(dto.idempotency.idempotencyKey);
    if (dupResult.ok) {
      const cachedResult = dupResult.value.value as unknown as PlatformV7ActionBoundaryResult<PlatformV7MoneyTree>;
      const mapped = mapBoundaryResultToService<PlatformV7MoneyTree>(cachedResult, correlationId);
      await uow.audit.append(cachedResult.auditPayload as P7AuditPayload);
      return mapped;
    }
  }

  // Step 4 — reserve key
  const reservation = await uow.idempotency.reserveKey({
    key: dto.idempotency.idempotencyKey,
    scope: idempotencyScope(dto),
    bankEventId: dto.bankEventId,
    operationId: dto.operationId,
    correlationId: dto.audit.correlationId,
    auditId: dto.audit.auditId,
  });
  if (!reservation.ok) {
    return conflictResult(`Idempotency key reservation failed: ${runtimeErrMsg(reservation)}`, correlationId);
  }

  const now = nowOrClock(deps.clock);

  // Build bank confirmation event
  const confirmation = {
    bankEventId: dto.bankEventId,
    idempotencyKey: dto.idempotency.idempotencyKey,
    path: dto.path,
    operationType: OPERATION_TYPE_BY_PATH[dto.path] as P7BankConfirmationEvent['operationType'],
    amount: dto.amount,
    actorId: dto.actor.actorId,
    actorRole: actorRole as PlatformV7CanonicalRole,
    organizationId: dto.actor.organizationId,
    bankOrganizationId: dto.bankOrganizationId,
    bankReference: dto.operationId,
    confirmedAt: now,
    auditId: dto.audit.auditId,
    correlationId: dto.audit.correlationId,
  } as P7BankConfirmationEvent;

  // Step 5 — execute action-boundary inside transaction for atomicity
  const txResult = await uow.runInTransaction(async (ports): Promise<P7RuntimeResult<PlatformV7ActionBoundaryResult<PlatformV7MoneyTree>>> => {
    const boundaryInput = {
      actor: buildActor(dto.actor.actorId, dto.actor.organizationId, actorRole),
      resource: buildResource(dto),
      action: dto.action,
      payload: {
        decision: persistedBasis.value,
        moneyTree: persistedTree.value,
        confirmation,
      },
      idempotencyContext,
      idempotencyKey: dto.idempotency.idempotencyKey,
      correlationId: dto.audit.correlationId,
      auditId: dto.audit.auditId,
      reason: dto.audit.reason,
      createdAt: now,
    } as PlatformV7BankBasisActionInput;

    const boundaryResult = executePlatformV7BankBasisAction(boundaryInput) as PlatformV7ActionBoundaryResult<PlatformV7MoneyTree>;

    // Save both MoneyTree and BankBasis within the transaction if applied
    if (boundaryResult.status === 'applied') {
      const txSaveOptions: P7SaveOptions = {
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
        actorId: dto.actor.actorId,
        reason: dto.audit.reason,
        expectedVersion: persistedTree.version.version,
        transaction: ports.transaction,
      };
      const treeSave = await ports.moneyTree.saveMoneyTree(
        { ...persistedTree, value: boundaryResult.afterState, updatedAt: now },
        txSaveOptions,
      );
      if (!treeSave.ok) {
        return { ok: false, error: repoError(treeSave) };
      }
      const basisConfirmRecord: P7PersistedRecord<import('./persistence-ports').P7BankConfirmationRecord> = {
        recordId: dto.bankEventId,
        dealId: dto.resource.dealId,
        value: {
          decision: persistedBasis.value,
          confirmation,
          result: boundaryResult,
        },
        version: {
          resourceType: 'bank_confirmation',
          resourceId: dto.bankEventId,
          version: dto.bankEventId,
          updatedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };
      const basisSave = await ports.bankBasis.saveBankConfirmation(basisConfirmRecord, {
        ...txSaveOptions,
        expectedVersion: persistedBasis.version.version,
      });
      if (!basisSave.ok) {
        return { ok: false, error: repoError(basisSave) };
      }
    }

    return { ok: true, value: boundaryResult };
  });

  if (!txResult.ok) {
    return conflictResult(runtimeErrMsg(txResult), correlationId);
  }

  const boundaryResult = txResult.value;
  const serviceResult = mapBoundaryResultToService<PlatformV7MoneyTree>(boundaryResult, correlationId);

  // Step 7 — record idempotency
  await uow.idempotency.recordResult({
    key: dto.idempotency.idempotencyKey,
    scope: idempotencyScope(dto),
    result: boundaryResult,
    bankEventId: dto.bankEventId,
    operationId: dto.operationId,
    correlationId: dto.audit.correlationId,
    auditId: dto.audit.auditId,
  });

  // Step 8 — append audit
  await uow.audit.append(boundaryResult.auditPayload as P7AuditPayload);

  return serviceResult;
}

export function createP7BankBasisExecutionService(
  deps: P7ApplicationServiceDependencies,
): P7BankBasisExecutionService {
  const { unitOfWork: uow } = deps;

  return {
    async sendBankBasis(dto: P7BankBasisSendRequestDto): Promise<P7ServiceBankBasisResult> {
      const correlationId = makeCorrelationId(deps.generateCorrelationId);

      // Step 1 — validate
      const errors = extractErrors(validateP7BankBasisSendRequestDto(dto));
      if (errors) return validationError(errors, correlationId);

      const actorRole = toP7CanonicalActorRole(dto.actor);
      if (!actorRole) {
        return validationError(
          [{ code: 'INVALID_ROLE', field: 'actor.actorRole', message: `Unknown canonical role: ${dto.actor.actorRole}` }],
          correlationId,
        );
      }

      // Step 2 — load MoneyTree + BankBasis
      const [treeResult, basisResult] = await Promise.all([
        uow.moneyTree.loadByDealId(dto.resource.dealId),
        uow.bankBasis.loadByDealId(dto.resource.dealId),
      ]);
      if (!treeResult.ok) {
        if (treeResult.status === 'not_found') return notFound(`MoneyTree not found for deal ${dto.resource.dealId}`, correlationId);
        return conflictResult(repoErrMsg(treeResult), correlationId);
      }
      if (!basisResult.ok) {
        if (basisResult.status === 'not_found') return notFound(`BankBasis not found for deal ${dto.resource.dealId}`, correlationId);
        return conflictResult(repoErrMsg(basisResult), correlationId);
      }
      const persistedTree = treeResult.value;
      const persistedBasis = basisResult.value;

      // Step 3 — load idempotency context
      const idempotencyContext = await uow.idempotency.loadContext(idempotencyScope(dto));

      // Step 3b — check duplicate
      const dupCheck = await checkDuplicate<PlatformV7MoneyTree>(uow, dto.idempotency.idempotencyKey);
      if (dupCheck.isDuplicate && dupCheck.cachedPayload) {
        const mapped = mapBoundaryResultToService<PlatformV7MoneyTree>(dupCheck.cachedPayload, correlationId);
        await uow.audit.append(dupCheck.cachedPayload.auditPayload as P7AuditPayload);
        return mapped;
      }

      // Step 4 — reserve key
      const reservation = await uow.idempotency.reserveKey({
        key: dto.idempotency.idempotencyKey,
        scope: idempotencyScope(dto),
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
      });
      if (!reservation.ok) {
        return conflictResult(`Idempotency key reservation failed: ${runtimeErrMsg(reservation)}`, correlationId);
      }

      const now = nowOrClock(deps.clock);

      // Step 5 — execute action-boundary (p7MarkBankBasisSent does not mutate MoneyTree)
      const boundaryInput: PlatformV7BankBasisActionInput = {
        actor: buildActor(dto.actor.actorId, dto.actor.organizationId, actorRole),
        resource: buildResource(dto),
        action: 'bank_basis_sent',
        payload: {
          decision: persistedBasis.value,
          moneyTree: persistedTree.value,
        },
        idempotencyContext,
        idempotencyKey: dto.idempotency.idempotencyKey,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
        reason: dto.audit.reason,
        createdAt: now,
      };

      const boundaryResult = executePlatformV7BankBasisAction(boundaryInput) as PlatformV7ActionBoundaryResult<PlatformV7MoneyTree>;
      const serviceResult = mapBoundaryResultToService<PlatformV7MoneyTree>(boundaryResult, correlationId);

      // Step 6 — save BankBasis if applied
      if (serviceResult.status === 'ok') {
        const domainResult = boundaryResult.domainResult as import('../bank-basis').P7BankBasisSendResult | undefined;
        if (domainResult?.valid) {
          const updatedBasisRecord: P7PersistedRecord<P7BankBasisDecision> = {
            ...persistedBasis,
            value: domainResult.decision,
            updatedAt: now,
          };
          const saveResult = await uow.bankBasis.saveBankBasisDecision(
            updatedBasisRecord,
            baseSaveOptions(dto, persistedBasis.version.version),
          );
          if (!saveResult.ok) {
            return conflictResult(
              repoErrMsg(saveResult),
              correlationId,
              saveResult.status === 'conflict' ? saveResult.currentVersion?.version : undefined,
            );
          }
        }
      }

      // Step 7 — record idempotency
      await uow.idempotency.recordResult({
        key: dto.idempotency.idempotencyKey,
        scope: idempotencyScope(dto),
        result: boundaryResult,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
      });

      // Step 8 — append audit
      await uow.audit.append(boundaryResult.auditPayload as P7AuditPayload);

      return serviceResult;
    },

    confirmBankRelease: (dto) => executeBankConfirmAction(dto, deps),
    confirmBankRefund: (dto) => executeBankConfirmAction(dto, deps),
    confirmBankHold: (dto) => executeBankConfirmAction(dto, deps),
    rejectBankRelease: (dto) => executeBankConfirmAction(dto, deps),
    startBankManualReview: (dto) => executeBankConfirmAction(dto, deps),
  };
}

// ---------------------------------------------------------------------------
// Release Workflow Service
// ---------------------------------------------------------------------------

export interface P7ReleaseWorkflowService {
  requestRelease(dto: P7ReleaseRequestDto): Promise<P7ServiceReleaseWorkflowResult>;
}

export function createP7ReleaseWorkflowService(
  deps: P7ApplicationServiceDependencies,
): P7ReleaseWorkflowService {
  const moneyService = createP7MoneyExecutionService(deps);

  return {
    async requestRelease(dto: P7ReleaseRequestDto): Promise<P7ServiceReleaseWorkflowResult> {
      const correlationId = makeCorrelationId(deps.generateCorrelationId);

      const errors = extractErrors(validateP7ReleaseRequestDto(dto));
      if (errors) return validationError(errors, correlationId);

      // Delegate to money execution service with release_requested action
      return moneyService.requestRelease({
        actor: dto.actor,
        resource: dto.resource,
        audit: dto.audit,
        idempotency: dto.idempotency,
        action: 'release_requested',
        amount: dto.amount,
        currency: dto.currency,
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Dispute Settlement Service
// ---------------------------------------------------------------------------

export interface P7DisputeSettlementService {
  submitArbitrationBasis(dto: P7ArbitrationBasisRequestDto): Promise<P7ServiceDisputeSettlementResult>;
}

export function createP7DisputeSettlementService(
  deps: P7ApplicationServiceDependencies,
): P7DisputeSettlementService {
  const { unitOfWork: uow } = deps;

  return {
    async submitArbitrationBasis(dto: P7ArbitrationBasisRequestDto): Promise<P7ServiceDisputeSettlementResult> {
      const correlationId = makeCorrelationId(deps.generateCorrelationId);

      // Step 1 — validate DTO
      const errors = extractErrors(validateP7ArbitrationBasisRequestDto(dto));
      if (errors) return validationError(errors, correlationId);

      const actorRole = toP7CanonicalActorRole(dto.actor);
      if (!actorRole) {
        return validationError(
          [{ code: 'INVALID_ROLE', field: 'actor.actorRole', message: `Unknown canonical role: ${dto.actor.actorRole}` }],
          correlationId,
        );
      }

      // Step 2 — load MoneyTree
      const treeResult = await uow.moneyTree.loadByDealId(dto.resource.dealId);
      if (!treeResult.ok) {
        if (treeResult.status === 'not_found') return notFound(`MoneyTree not found for deal ${dto.resource.dealId}`, correlationId);
        return conflictResult(repoErrMsg(treeResult), correlationId);
      }
      const persistedTree = treeResult.value;

      // Step 3 — load idempotency context
      const idempotencyContext = await uow.idempotency.loadContext(idempotencyScope(dto));

      // Step 3b — check duplicate
      const dupCheck = await checkDuplicate<PlatformV7MoneyTree>(uow, dto.idempotency.idempotencyKey);
      if (dupCheck.isDuplicate && dupCheck.cachedPayload) {
        const mapped = mapBoundaryResultToService<PlatformV7MoneyTree>(dupCheck.cachedPayload, correlationId);
        await uow.audit.append(dupCheck.cachedPayload.auditPayload as P7AuditPayload);
        return mapped;
      }

      // Step 4 — reserve key
      const reservation = await uow.idempotency.reserveKey({
        key: dto.idempotency.idempotencyKey,
        scope: idempotencyScope(dto),
        operationId: dto.idempotency.operationId,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
      });
      if (!reservation.ok) {
        return conflictResult(`Idempotency key reservation failed: ${runtimeErrMsg(reservation)}`, correlationId);
      }

      const now = nowOrClock(deps.clock);

      // Step 5 — execute money action-boundary with manual_review_resolved
      const boundaryInput: PlatformV7MoneyActionInput = {
        actor: buildActor(dto.actor.actorId, dto.actor.organizationId, actorRole),
        resource: buildResource(dto),
        action: 'manual_review_resolved',
        payload: {
          beforeMoneyTree: persistedTree.value,
          operation: {
            operationId: dto.idempotency.operationId ?? dto.idempotency.idempotencyKey,
            dealId: dto.resource.dealId,
            type: 'manual_review_resolved',
            amount: dto.releaseAmount,
            currency: dto.currency,
            basisDocumentIds: [...dto.basisDocumentIds],
            actorId: dto.actor.actorId,
            actorRole: actorRole,
            occurredAt: now,
            idempotencyKey: dto.idempotency.idempotencyKey,
            correlationId: dto.audit.correlationId,
            auditId: dto.audit.auditId,
          },
          bankConfirmationExists: false,
          basisDocumentIds: [...dto.basisDocumentIds],
        },
        idempotencyContext,
        idempotencyKey: dto.idempotency.idempotencyKey,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
        reason: dto.audit.reason,
        createdAt: now,
      };

      const boundaryResult = executePlatformV7MoneyAction(boundaryInput);
      const serviceResult = mapBoundaryResultToService<PlatformV7MoneyTree>(boundaryResult, correlationId);

      // Step 6 — save if applied
      if (serviceResult.status === 'ok') {
        const updatedRecord: P7PersistedRecord<PlatformV7MoneyTree> = {
          ...persistedTree,
          value: boundaryResult.afterState,
          updatedAt: now,
        };
        const saveResult = await uow.moneyTree.saveMoneyTree(
          updatedRecord,
          baseSaveOptions(dto, persistedTree.version.version),
        );
        if (!saveResult.ok) {
          return conflictResult(
            repoErrMsg(saveResult),
            correlationId,
            saveResult.status === 'conflict' ? saveResult.currentVersion?.version : undefined,
          );
        }

        // Record arbitration decision in dispute settlement repository
        const arbitrationRecord: P7PersistedRecord<P7ArbitrationDecisionRecord> = {
          recordId: dto.arbitrationDecisionId,
          dealId: dto.resource.dealId,
          value: {
            arbitrationDecisionId: dto.arbitrationDecisionId,
            dealId: dto.resource.dealId,
            basisDocumentIds: dto.basisDocumentIds,
            decidedAt: now,
            actorId: dto.actor.actorId,
            correlationId: dto.audit.correlationId,
            auditId: dto.audit.auditId,
          },
          version: {
            resourceType: 'arbitration_decision',
            resourceId: dto.arbitrationDecisionId,
            version: dto.arbitrationDecisionId,
            updatedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        };
        await uow.disputeSettlement.saveArbitrationDecision(
          arbitrationRecord,
          baseSaveOptions(dto),
        );
      }

      // Step 7 — record idempotency
      await uow.idempotency.recordResult({
        key: dto.idempotency.idempotencyKey,
        scope: idempotencyScope(dto),
        result: boundaryResult,
        operationId: dto.idempotency.operationId,
        correlationId: dto.audit.correlationId,
        auditId: dto.audit.auditId,
      });

      // Step 8 — append audit
      await uow.audit.append(boundaryResult.auditPayload as P7AuditPayload);

      return serviceResult;
    },
  };
}
