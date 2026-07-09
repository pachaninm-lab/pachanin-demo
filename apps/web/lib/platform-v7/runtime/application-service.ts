import {
  executePlatformV7BankBasisAction,
  executePlatformV7DocumentAction,
  executePlatformV7MoneyAction,
  type P7ActionIdempotencyContext,
  type PlatformV7ActionBoundaryResult,
  type PlatformV7BankBasisActionInput,
  type PlatformV7DocumentAction,
} from '../action-boundary';
import type {
  PlatformV7AccessActor,
  PlatformV7AccessRole,
  PlatformV7ResourceScope,
  PlatformV7ResourceType,
} from '../access-control';
import type {
  P7BankBasisDecision,
  P7BankBasisSendResult,
  P7BankConfirmationEvent,
  P7BankConfirmationResult,
} from '../bank-basis';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '../document-matrix';
import type { PlatformV7MoneyOperation, PlatformV7MoneyTree } from '../money-tree';
import {
  toP7CanonicalActorRole,
  validateP7ArbitrationBasisRequestDto,
  validateP7BankBasisSendRequestDto,
  validateP7BankConfirmationRequestDto,
  validateP7DocumentActionRequestDto,
  validateP7ReleaseRequestDto,
  type P7ArbitrationBasisRequestDto,
  type P7BankBasisSendRequestDto,
  type P7BankConfirmationRequestDto,
  type P7DocumentActionRequestDto,
  type P7ReleaseRequestDto,
  type P7RuntimeRequestBaseDto,
  type P7ValidationResult,
} from './dto-schemas';
import type {
  P7ApplicationServiceDependencies,
  P7ApplicationServiceResult,
  P7BankBasisExecutionService,
  P7DisputeMoneyImpact,
  P7DisputeSettlementService,
  P7DocumentExecutionService,
  P7MoneyExecutionService,
  P7ReleaseWorkflowService,
  P7ReleaseWorkflowStatus,
} from './application-service-types';
import type {
  P7ArbitrationDecisionRecord,
  P7AuditPayload,
  P7BankConfirmationRecord,
  P7IdempotencyScope,
  P7PersistedRecord,
  P7RepositoryResult,
  P7RuntimeResult,
  P7RuntimeTransactionalPorts,
  P7SaveOptions,
} from './persistence-ports';

function nowFrom(deps: P7ApplicationServiceDependencies): string {
  return deps.now?.() ?? new Date().toISOString();
}

function validationFailure<T>(validation: P7ValidationResult<T>): P7ApplicationServiceResult<never> {
  return { ok: false, status: 'validation_error', code: 'VALIDATION_ERROR', reason: 'Runtime DTO validation failed.', validationErrors: 'errors' in validation ? validation.errors : [], auditPayloads: [] };
}

function runtimeFailure<T>(result: P7RuntimeResult<T>): P7ApplicationServiceResult<never> {
  const error = 'error' in result ? result.error : { code: 'transaction_error' as const, message: 'Unexpected runtime result.' };
  return {
    ok: false,
    status: error.code === 'duplicate' ? 'duplicate' : error.code === 'conflict' ? 'conflict' : error.code === 'not_found' ? 'not_found' : 'domain_blocked',
    code: error.code,
    reason: error.message,
    auditPayloads: [],
  };
}

function repositoryFailure<T>(result: P7RepositoryResult<T>): P7ApplicationServiceResult<never> {
  const error = 'error' in result ? result.error : { code: 'persistence_error' as const, message: 'Unexpected repository result.' };
  return { ok: false, status: result.status === 'not_found' ? 'not_found' : result.status === 'conflict' ? 'conflict' : 'domain_blocked', code: error.code, reason: error.message, auditPayloads: [] };
}

function boundaryFailure<T>(boundary: PlatformV7ActionBoundaryResult, auditPayloads: readonly P7AuditPayload[]): P7ApplicationServiceResult<T> {
  return { ok: false, status: boundary.status === 'denied' ? 'denied' : boundary.status === 'duplicate' ? 'duplicate' : 'domain_blocked', code: boundary.code, reason: boundary.reason, auditPayloads, boundaryResult: boundary };
}

function persisted<T>(value: T, boundary: PlatformV7ActionBoundaryResult | undefined, auditPayloads: readonly P7AuditPayload[]): P7ApplicationServiceResult<T> {
  return { ok: true, status: 'persisted', value, auditPayloads, boundaryResult: boundary };
}

function actorFromDto(dto: P7RuntimeRequestBaseDto): PlatformV7AccessActor {
  const canonicalRole = toP7CanonicalActorRole(dto) as PlatformV7AccessRole;
  return { userId: dto.actor.actorId, organizationId: dto.actor.organizationId, roles: [canonicalRole], activeRole: canonicalRole };
}

function resourceFromDto(dto: P7RuntimeRequestBaseDto): PlatformV7ResourceScope {
  return {
    resourceType: dto.resource.resourceType as PlatformV7ResourceType,
    resourceId: dto.resource.resourceId,
    ownerOrganizationId: dto.resource.ownerOrganizationId,
    buyerOrganizationId: dto.resource.buyerOrganizationId,
    sellerOrganizationId: dto.resource.sellerOrganizationId,
    bankOrganizationId: dto.resource.bankOrganizationId,
    roleScopeOrganizationId: dto.resource.assignedOrganizationId,
  };
}

function idempotencyScope(dto: P7RuntimeRequestBaseDto): P7IdempotencyScope {
  return { dealId: dto.resource.dealId, resourceType: dto.resource.resourceType, resourceId: dto.resource.resourceId, actorId: dto.actor.actorId, correlationId: dto.audit.correlationId };
}

function operationId(dto: P7RuntimeRequestBaseDto): string {
  return dto.idempotency.operationId ?? dto.idempotency.idempotencyKey;
}

function saveOptions(dto: P7RuntimeRequestBaseDto, record: P7PersistedRecord<unknown>, ports: P7RuntimeTransactionalPorts): P7SaveOptions {
  return { expectedVersion: record.version.version, transaction: ports.transaction, correlationId: dto.audit.correlationId, auditId: dto.audit.auditId, actorId: dto.actor.actorId, reason: dto.audit.reason };
}

function recordWithValue<T>(record: P7PersistedRecord<T>, value: T, updatedAt: string): P7PersistedRecord<T> {
  return { ...record, value, updatedAt };
}

function moneyOperation(dto: P7ReleaseRequestDto, type: PlatformV7MoneyOperation['type'], createdAt: string): PlatformV7MoneyOperation {
  return { operationId: operationId(dto), dealId: dto.resource.dealId, type, amount: dto.amount, currency: dto.currency, basisDocumentIds: [dto.resource.resourceId], actorId: dto.actor.actorId, actorRole: dto.actor.actorRole, occurredAt: createdAt, idempotencyKey: dto.idempotency.idempotencyKey, correlationId: dto.audit.correlationId, auditId: dto.audit.auditId };
}

function auditPayloadsFromBoundary(boundary: PlatformV7ActionBoundaryResult): readonly P7AuditPayload[] {
  const payloads: P7AuditPayload[] = [boundary.auditPayload];
  const domainResult = boundary.domainResult;
  if (typeof domainResult === 'object' && domainResult !== null && 'auditPayloads' in domainResult) {
    const candidate = (domainResult as { readonly auditPayloads: unknown }).auditPayloads;
    if (Array.isArray(candidate)) candidate.forEach((payload) => payloads.push(payload as P7AuditPayload));
  }
  return payloads;
}

async function runTransaction<T>(deps: P7ApplicationServiceDependencies, fn: (ports: P7RuntimeTransactionalPorts) => Promise<P7ApplicationServiceResult<T>>): Promise<P7ApplicationServiceResult<T>> {
  const tx = await deps.unitOfWork.runInTransaction(async (ports) => ({ ok: true, value: await fn(ports) }));
  return tx.ok ? tx.value : runtimeFailure(tx);
}

async function reserveIdempotency(ports: P7RuntimeTransactionalPorts, dto: P7RuntimeRequestBaseDto, scope: P7IdempotencyScope): Promise<P7ApplicationServiceResult<never> | null> {
  const reserved = await ports.idempotency.reserveKey({ key: dto.idempotency.idempotencyKey, scope, operationId: dto.idempotency.operationId, bankEventId: dto.idempotency.bankEventId, auditId: dto.audit.auditId, correlationId: dto.audit.correlationId });
  return reserved.ok ? null : runtimeFailure(reserved);
}

async function recordBoundaryResult(ports: P7RuntimeTransactionalPorts, dto: P7RuntimeRequestBaseDto, scope: P7IdempotencyScope, boundary: PlatformV7ActionBoundaryResult): Promise<P7ApplicationServiceResult<never> | null> {
  const recorded = await ports.idempotency.recordResult({ key: dto.idempotency.idempotencyKey, scope, result: boundary, operationId: dto.idempotency.operationId, bankEventId: dto.idempotency.bankEventId, auditId: dto.audit.auditId, correlationId: dto.audit.correlationId });
  return recorded.ok ? null : runtimeFailure(recorded);
}

async function appendAuditPayloads(ports: P7RuntimeTransactionalPorts, payloads: readonly P7AuditPayload[]): Promise<P7ApplicationServiceResult<never> | null> {
  const appended = await ports.audit.appendMany(payloads);
  return appended.ok ? null : runtimeFailure(appended);
}

async function loadContext(ports: P7RuntimeTransactionalPorts, dto: P7RuntimeRequestBaseDto): Promise<P7ActionIdempotencyContext> {
  return ports.idempotency.loadContext(idempotencyScope(dto));
}

async function replayProcessedKey<T>(ports: P7RuntimeTransactionalPorts, dto: P7RuntimeRequestBaseDto, context: P7ActionIdempotencyContext): Promise<P7ApplicationServiceResult<T> | null> {
  if (!context.processedKeys.includes(dto.idempotency.idempotencyKey)) return null;
  const duplicate = await ports.idempotency.loadDuplicateResult(dto.idempotency.idempotencyKey);
  if (!duplicate.ok) return repositoryFailure(duplicate);
  const boundary = duplicate.value.value;
  const auditPayloads = auditPayloadsFromBoundary(boundary);
  if (!boundary.ok) return boundaryFailure(boundary, auditPayloads);
  return persisted(boundary.afterState as T, boundary, auditPayloads);
}

function bankConfirmationEvent<Path extends 'release' | 'refund' | 'hold' | 'reject' | 'manual_review'>(dto: P7BankConfirmationRequestDto, path: Path, operationType: P7BankConfirmationEvent<Path>['operationType'], createdAt: string): P7BankConfirmationEvent<Path> {
  return { bankEventId: dto.bankEventId, idempotencyKey: dto.idempotency.idempotencyKey, path, operationType, amount: dto.amount, actorId: dto.actor.actorId, actorRole: toP7CanonicalActorRole(dto.actor) ?? 'bank_officer', organizationId: dto.actor.organizationId, bankOrganizationId: dto.bankOrganizationId, bankReference: dto.bankEventId, confirmedAt: createdAt, auditId: dto.audit.auditId, correlationId: dto.audit.correlationId };
}

function bankActionInput(dto: P7BankConfirmationRequestDto, decision: P7BankBasisDecision, moneyTree: PlatformV7MoneyTree, context: P7ActionIdempotencyContext, createdAt: string): PlatformV7BankBasisActionInput {
  if (dto.path === 'refund') return bankBoundaryBase(dto, context, createdAt, 'bank_refund_confirmed', { decision, moneyTree, confirmation: bankConfirmationEvent(dto, 'refund', 'refund_confirmed', createdAt) });
  if (dto.path === 'hold') return bankBoundaryBase(dto, context, createdAt, 'bank_hold_confirmed', { decision, moneyTree, confirmation: bankConfirmationEvent(dto, 'hold', 'hold_created', createdAt) });
  if (dto.path === 'reject') return bankBoundaryBase(dto, context, createdAt, 'bank_basis_rejected', { decision, moneyTree, confirmation: bankConfirmationEvent(dto, 'reject', 'bank_basis_rejected', createdAt) });
  if (dto.path === 'manual_review') return bankBoundaryBase(dto, context, createdAt, 'bank_manual_review_started', { decision, moneyTree, confirmation: bankConfirmationEvent(dto, 'manual_review', 'manual_review_started', createdAt) });
  return bankBoundaryBase(dto, context, createdAt, 'bank_basis_confirmed', { decision, moneyTree, confirmation: bankConfirmationEvent(dto, 'release', 'bank_basis_confirmed', createdAt) });
}

function bankBoundaryBase<Action extends PlatformV7BankBasisActionInput['action']>(dto: P7BankConfirmationRequestDto, context: P7ActionIdempotencyContext, createdAt: string, action: Action, payload: Extract<PlatformV7BankBasisActionInput, { readonly action: Action }>['payload']): Extract<PlatformV7BankBasisActionInput, { readonly action: Action }> {
  return { actor: actorFromDto(dto), resource: resourceFromDto(dto), action, payload, idempotencyContext: context, idempotencyKey: dto.idempotency.idempotencyKey, correlationId: dto.audit.correlationId, auditId: dto.audit.auditId, reason: dto.audit.reason, createdAt } as Extract<PlatformV7BankBasisActionInput, { readonly action: Action }>;
}

function confirmationFromAction(input: PlatformV7BankBasisActionInput): P7BankConfirmationEvent {
  if ('confirmation' in input.payload) return input.payload.confirmation;
  return { bankEventId: input.idempotencyKey, idempotencyKey: input.idempotencyKey, path: 'release', operationType: 'bank_basis_confirmed', amount: 0, actorId: input.actor.userId, actorRole: toP7CanonicalActorRole({ actorId: input.actor.userId, actorRole: input.actor.activeRole, organizationId: input.actor.organizationId }) ?? 'bank_officer', organizationId: input.actor.organizationId, bankOrganizationId: input.actor.organizationId, bankReference: input.idempotencyKey, confirmedAt: input.createdAt ?? '', auditId: input.auditId, correlationId: input.correlationId };
}

async function completeBoundary<T>(ports: P7RuntimeTransactionalPorts, dto: P7RuntimeRequestBaseDto, boundary: PlatformV7ActionBoundaryResult, persist: () => Promise<P7ApplicationServiceResult<T>>): Promise<P7ApplicationServiceResult<T>> {
  const scope = idempotencyScope(dto);
  const auditPayloads = auditPayloadsFromBoundary(boundary);
  if (!boundary.ok) {
    const recorded = await recordBoundaryResult(ports, dto, scope, boundary);
    if (recorded) return recorded;
    const audited = await appendAuditPayloads(ports, auditPayloads);
    if (audited) return audited;
    return boundaryFailure(boundary, auditPayloads);
  }
  const persistedResult = await persist();
  if (!persistedResult.ok) return persistedResult;
  const recorded = await recordBoundaryResult(ports, dto, scope, boundary);
  if (recorded) return recorded;
  const audited = await appendAuditPayloads(ports, auditPayloads);
  if (audited) return audited;
  return { ...persistedResult, auditPayloads, boundaryResult: boundary };
}

export function createP7MoneyExecutionService(deps: P7ApplicationServiceDependencies): P7MoneyExecutionService {
  const bank = createP7BankBasisExecutionService(deps);
  return {
    async requestRelease(dto) {
      const validation = validateP7ReleaseRequestDto(dto);
      if (!validation.ok) return validationFailure(validation);
      return runTransaction(deps, async (ports) => {
        const money = await ports.moneyTree.loadByDealId(dto.resource.dealId);
        if (!money.ok) return repositoryFailure(money);
        const context = await loadContext(ports, dto);
        const replay = await replayProcessedKey<PlatformV7MoneyTree>(ports, dto, context);
        if (replay) return replay;
        const reserved = await reserveIdempotency(ports, dto, idempotencyScope(dto));
        if (reserved) return reserved;
        const createdAt = nowFrom(deps);
        const boundary = executePlatformV7MoneyAction({
          actor: actorFromDto(dto),
          resource: resourceFromDto(dto),
          action: 'bank_basis_requested',
          payload: { beforeMoneyTree: money.value.value, operation: moneyOperation(dto, 'bank_basis_requested', createdAt), bankConfirmationExists: false, basisDocumentIds: [dto.resource.resourceId] },
          idempotencyContext: context,
          idempotencyKey: dto.idempotency.idempotencyKey,
          correlationId: dto.audit.correlationId,
          auditId: dto.audit.auditId,
          reason: dto.audit.reason,
          createdAt,
        });
        return completeBoundary(ports, dto, boundary, async () => {
          const saved = await ports.moneyTree.saveMoneyTree(recordWithValue(money.value, boundary.afterState, createdAt), saveOptions(dto, money.value, ports));
          return saved.ok ? persisted(saved.value.value, boundary, []) : repositoryFailure(saved);
        });
      });
    },
    confirmRelease: (dto) => bank.confirmBankRelease(dto),
    confirmRefund: (dto) => bank.confirmBankRefund(dto),
    confirmHold: (dto) => bank.confirmBankHold(dto),
    startManualReview: (dto) => bank.startBankManualReview(dto),
  };
}

export function createP7DocumentExecutionService(deps: P7ApplicationServiceDependencies): P7DocumentExecutionService {
  async function executeDocument(dto: P7DocumentActionRequestDto, action: PlatformV7DocumentAction): Promise<P7ApplicationServiceResult<PlatformV7DocumentMatrix>> {
    const nextDto = { ...dto, action };
    const validation = validateP7DocumentActionRequestDto(nextDto);
    if (!validation.ok) return validationFailure(validation);
    return runTransaction(deps, async (ports) => {
      const matrix = await ports.documentMatrix.loadByDealId(nextDto.resource.dealId);
      if (!matrix.ok) return repositoryFailure(matrix);
      const document = matrix.value.value.documents.find((item) => item.documentId === nextDto.documentId);
      if (!document) return { ok: false, status: 'not_found', code: 'DOCUMENT_NOT_FOUND', reason: 'Document requirement was not found in the matrix.', auditPayloads: [] };
      const context = await loadContext(ports, nextDto);
      const replay = await replayProcessedKey<PlatformV7DocumentMatrix>(ports, nextDto, context);
      if (replay) return replay;
      const reserved = await reserveIdempotency(ports, nextDto, idempotencyScope(nextDto));
      if (reserved) return reserved;
      const createdAt = nowFrom(deps);
      const boundary = executePlatformV7DocumentAction({ actor: actorFromDto(nextDto), resource: resourceFromDto(nextDto), action, payload: { document }, idempotencyContext: context, idempotencyKey: nextDto.idempotency.idempotencyKey, correlationId: nextDto.audit.correlationId, auditId: nextDto.audit.auditId, reason: nextDto.audit.reason, createdAt });
      return completeBoundary(ports, nextDto, boundary, async () => {
        const afterMatrix: PlatformV7DocumentMatrix = { ...matrix.value.value, documents: matrix.value.value.documents.map((item) => item.documentId === nextDto.documentId ? boundary.afterState as PlatformV7DocumentRequirement : item) };
        const saved = await ports.documentMatrix.saveDocumentMatrix(recordWithValue(matrix.value, afterMatrix, createdAt), saveOptions(nextDto, matrix.value, ports));
        return saved.ok ? persisted(saved.value.value, boundary, []) : repositoryFailure(saved);
      });
    });
  }
  return { uploadDocument: (dto) => executeDocument(dto, 'document_uploaded'), confirmDocument: (dto) => executeDocument(dto, 'document_confirmed'), rejectDocument: (dto) => executeDocument(dto, 'document_rejected'), sendDocument: (dto) => executeDocument(dto, 'document_sent'), markManualReview: (dto) => executeDocument(dto, 'document_manual_review_started') };
}

export function createP7BankBasisExecutionService(deps: P7ApplicationServiceDependencies): P7BankBasisExecutionService {
  async function sendBankBasis(dto: P7BankBasisSendRequestDto): Promise<P7ApplicationServiceResult<P7BankBasisDecision>> {
    const validation = validateP7BankBasisSendRequestDto(dto);
    if (!validation.ok) return validationFailure(validation);
    return runTransaction(deps, async (ports) => {
      const money = await ports.moneyTree.loadByDealId(dto.resource.dealId);
      if (!money.ok) return repositoryFailure(money);
      const decision = await ports.bankBasis.loadByDealId(dto.resource.dealId);
      if (!decision.ok) return repositoryFailure(decision);
      const context = await loadContext(ports, dto);
      const replay = await replayProcessedKey<P7BankBasisDecision>(ports, dto, context);
      if (replay) return replay;
      const reserved = await reserveIdempotency(ports, dto, idempotencyScope(dto));
      if (reserved) return reserved;
      const createdAt = nowFrom(deps);
      const boundary = executePlatformV7BankBasisAction({ actor: actorFromDto(dto), resource: resourceFromDto(dto), action: 'bank_basis_sent', payload: { decision: decision.value.value, moneyTree: money.value.value }, idempotencyContext: context, idempotencyKey: dto.idempotency.idempotencyKey, correlationId: dto.audit.correlationId, auditId: dto.audit.auditId, reason: dto.audit.reason, createdAt });
      return completeBoundary(ports, dto, boundary, async () => {
        const domain = boundary.domainResult as P7BankBasisSendResult;
        const saved = await ports.bankBasis.saveBankBasisDecision(recordWithValue(decision.value, domain.decision, createdAt), saveOptions(dto, decision.value, ports));
        return saved.ok ? persisted(saved.value.value, boundary, []) : repositoryFailure(saved);
      });
    });
  }

  async function confirmBankMovement(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>> {
    const validation = validateP7BankConfirmationRequestDto(dto);
    if (!validation.ok) return validationFailure(validation);
    return runTransaction(deps, async (ports) => {
      const money = await ports.moneyTree.loadByDealId(dto.resource.dealId);
      if (!money.ok) return repositoryFailure(money);
      const decision = await ports.bankBasis.loadByDealId(dto.resource.dealId);
      if (!decision.ok) return repositoryFailure(decision);
      const context = await loadContext(ports, dto);
      const replay = await replayProcessedKey<PlatformV7MoneyTree>(ports, dto, context);
      if (replay) return replay;
      const reserved = await reserveIdempotency(ports, dto, idempotencyScope(dto));
      if (reserved) return reserved;
      const createdAt = nowFrom(deps);
      const actionInput = bankActionInput(dto, decision.value.value, money.value.value, context, createdAt);
      const boundary = executePlatformV7BankBasisAction(actionInput);
      return completeBoundary(ports, dto, boundary, async () => {
        const domain = boundary.domainResult as P7BankConfirmationResult;
        const savedMoney = await ports.moneyTree.saveMoneyTree(recordWithValue(money.value, domain.moneyTree, createdAt), saveOptions(dto, money.value, ports));
        if (!savedMoney.ok) return repositoryFailure(savedMoney);
        const savedDecision = await ports.bankBasis.saveBankBasisDecision(recordWithValue(decision.value, domain.decision, createdAt), saveOptions(dto, decision.value, ports));
        if (!savedDecision.ok) return repositoryFailure(savedDecision);
        const confirmationRecord: P7PersistedRecord<P7BankConfirmationRecord> = { recordId: `${dto.resource.dealId}:${dto.bankEventId}`, dealId: dto.resource.dealId, value: { decision: domain.decision, confirmation: confirmationFromAction(actionInput), result: boundary }, version: { resourceType: 'bank_confirmation', resourceId: dto.bankEventId, version: decision.value.version.version, updatedAt: createdAt }, createdAt, updatedAt: createdAt };
        const savedConfirmation = await ports.bankBasis.saveBankConfirmation(confirmationRecord, saveOptions(dto, decision.value, ports));
        if (!savedConfirmation.ok) return repositoryFailure(savedConfirmation);
        return persisted(savedMoney.value.value, boundary, []);
      });
    });
  }

  return {
    sendBankBasis,
    confirmBankRelease: (dto) => confirmBankMovement({ ...dto, path: 'release', action: 'bank_basis_confirmed' }),
    rejectBankRelease: (dto) => confirmBankMovement({ ...dto, path: 'reject', action: 'bank_basis_rejected' }),
    confirmBankRefund: (dto) => confirmBankMovement({ ...dto, path: 'refund', action: 'bank_refund_confirmed' }),
    confirmBankHold: (dto) => confirmBankMovement({ ...dto, path: 'hold', action: 'bank_hold_confirmed' }),
    startBankManualReview: (dto) => confirmBankMovement({ ...dto, path: 'manual_review', action: 'bank_manual_review_started' }),
  };
}

export function createP7ReleaseWorkflowService(deps: P7ApplicationServiceDependencies): P7ReleaseWorkflowService {
  const money = createP7MoneyExecutionService(deps);
  const bank = createP7BankBasisExecutionService(deps);
  async function getReleaseStatus(dto: P7RuntimeRequestBaseDto): Promise<P7ApplicationServiceResult<P7ReleaseWorkflowStatus>> {
    return runTransaction(deps, async (ports) => {
      const loadedMoney = await ports.moneyTree.loadByDealId(dto.resource.dealId);
      if (!loadedMoney.ok) return repositoryFailure(loadedMoney);
      const loadedBasis = await ports.bankBasis.loadByDealId(dto.resource.dealId);
      return persisted({ dealId: dto.resource.dealId, moneyTree: loadedMoney.value.value, bankBasis: loadedBasis.ok ? loadedBasis.value.value : null }, undefined, []);
    });
  }
  return { prepareRelease: getReleaseStatus, requestRelease: money.requestRelease, sendBasisToBank: bank.sendBankBasis, handleBankEvent: (dto) => dto.path === 'refund' ? bank.confirmBankRefund(dto) : dto.path === 'hold' ? bank.confirmBankHold(dto) : dto.path === 'reject' ? bank.rejectBankRelease(dto) : dto.path === 'manual_review' ? bank.startBankManualReview(dto) : bank.confirmBankRelease(dto), getReleaseStatus };
}

export function createP7DisputeSettlementService(deps: P7ApplicationServiceDependencies): P7DisputeSettlementService {
  const bank = createP7BankBasisExecutionService(deps);
  function impact(dto: P7RuntimeRequestBaseDto, reason: string): P7ApplicationServiceResult<P7DisputeMoneyImpact> {
    return { ok: true, status: 'persisted', value: { dealId: dto.resource.dealId, moneyMovementAllowed: false, reason }, auditPayloads: [] };
  }
  return {
    async openDispute(dto) { return impact(dto, 'Dispute opened without direct money movement.'); },
    async attachEvidence(dto) { return impact(dto, 'Evidence attached without direct money movement.'); },
    async prepareArbitrationBasis(dto: P7ArbitrationBasisRequestDto) {
      const validation = validateP7ArbitrationBasisRequestDto(dto);
      if (!validation.ok) return validationFailure(validation);
      return runTransaction(deps, async (ports) => {
        const createdAt = nowFrom(deps);
        const record: P7PersistedRecord<P7ArbitrationDecisionRecord> = { recordId: dto.arbitrationDecisionId, dealId: dto.resource.dealId, value: { arbitrationDecisionId: dto.arbitrationDecisionId, dealId: dto.resource.dealId, basisDocumentIds: dto.basisDocumentIds, decidedAt: createdAt, actorId: dto.actor.actorId, correlationId: dto.audit.correlationId, auditId: dto.audit.auditId }, version: { resourceType: 'arbitration_decision', resourceId: dto.arbitrationDecisionId, version: operationId(dto), updatedAt: createdAt }, createdAt, updatedAt: createdAt };
        const saved = await ports.disputeSettlement.saveArbitrationDecision(record, { expectedVersion: operationId(dto), transaction: ports.transaction, correlationId: dto.audit.correlationId, auditId: dto.audit.auditId, actorId: dto.actor.actorId, reason: dto.audit.reason });
        return saved.ok ? persisted(saved.value.value, undefined, []) : repositoryFailure(saved);
      });
    },
    applyArbitrationOutcomeToBankBasis: (dto) => dto.path === 'refund' ? bank.confirmBankRefund(dto) : dto.path === 'hold' ? bank.confirmBankHold(dto) : dto.path === 'reject' ? bank.rejectBankRelease(dto) : dto.path === 'manual_review' ? bank.startBankManualReview(dto) : bank.confirmBankRelease(dto),
    async getDisputeMoneyImpact(dto) { return impact(dto, 'Dispute impact is read-only in service layer.'); },
  };
}
