import type {
  P7ActionIdempotencyContext,
  PlatformV7ActionBoundaryAuditPayload,
  PlatformV7ActionBoundaryResult,
} from '../action-boundary';
import type {
  P7BankAuditPayload,
  P7BankBasisDecision,
  P7BankConfirmationEvent,
} from '../bank-basis';
import type {
  PlatformV7DocumentMatrix,
  PlatformV7DocumentRequirement,
} from '../document-matrix';
import type { PlatformV7ExternalCallResult, PlatformV7ExternalSystem } from '../external-adapters';
import type { PlatformV7MoneyTree } from '../money-tree';

export type P7RuntimeErrorCode =
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'permission_denied'
  | 'duplicate'
  | 'persistence_error'
  | 'transaction_error';

export interface P7RuntimeError {
  readonly code: P7RuntimeErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly auditId?: string;
}

export type P7RuntimeResult<T> =
  | {
    readonly ok: true;
    readonly value: T;
    readonly correlationId?: string;
    readonly auditId?: string;
  }
  | {
    readonly ok: false;
    readonly error: P7RuntimeError;
    readonly correlationId?: string;
    readonly auditId?: string;
  };

export type P7VersionToken = string;

export interface P7ResourceVersion {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly version: P7VersionToken;
  readonly updatedAt: string;
}

export interface P7PersistedRecord<T> {
  readonly recordId: string;
  readonly dealId?: string;
  readonly value: T;
  readonly version: P7ResourceVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface P7RuntimeTransactionContext {
  readonly transactionId: string;
  readonly startedAt: string;
  readonly correlationId: string;
  readonly auditId?: string;
  readonly actorId?: string;
}

export interface P7SaveOptions {
  readonly expectedVersion?: P7VersionToken;
  readonly transaction?: P7RuntimeTransactionContext;
  readonly correlationId: string;
  readonly auditId?: string;
  readonly actorId?: string;
  readonly reason?: string;
}

export type P7RepositoryResult<T> =
  | {
    readonly ok: true;
    readonly status: 'ok';
    readonly value: T;
    readonly version?: P7ResourceVersion;
  }
  | {
    readonly ok: false;
    readonly status: 'not_found' | 'conflict' | 'error';
    readonly error: P7RuntimeError;
    readonly currentVersion?: P7ResourceVersion;
  };

export interface P7BankConfirmationRecord {
  readonly decision: P7BankBasisDecision;
  readonly confirmation: P7BankConfirmationEvent;
  readonly result?: PlatformV7ActionBoundaryResult<PlatformV7MoneyTree>;
}

export interface P7ArbitrationDecisionRecord {
  readonly arbitrationDecisionId: string;
  readonly dealId: string;
  readonly basisDocumentIds: readonly string[];
  readonly decidedAt: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly auditId: string;
}

export interface P7SettlementSplitRecord {
  readonly settlementSplitId: string;
  readonly dealId: string;
  readonly disputedAmount: number;
  readonly releaseAmount: number;
  readonly refundAmount: number;
  readonly heldAmount: number;
  readonly currency: 'RUB';
  readonly correlationId: string;
  readonly auditId: string;
}

export interface P7ActionExecutionRecord {
  readonly actionId: string;
  readonly dealId?: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: string;
  readonly status: 'allowed' | 'denied' | 'blocked' | 'duplicate';
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly auditId: string;
  readonly beforeState?: unknown;
  readonly afterState?: unknown;
  readonly auditPayload?: P7AuditPayload;
}

export interface P7ExternalCallEnvelope {
  readonly externalCallId: string;
  readonly system: PlatformV7ExternalSystem;
  readonly provider: 'mock' | 'real';
  readonly request: unknown;
  readonly response?: PlatformV7ExternalCallResult;
  readonly status: 'pending' | 'succeeded' | 'failed';
  readonly error?: P7RuntimeError;
  readonly correlationId: string;
  readonly auditId: string;
  readonly createdAt: string;
}

export type P7AuditPayload =
  | PlatformV7ActionBoundaryAuditPayload
  | P7BankAuditPayload;

export interface P7MoneyTreeRepository {
  loadByDealId(dealId: string): Promise<P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>>>;
  saveMoneyTree(
    record: P7PersistedRecord<PlatformV7MoneyTree>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<PlatformV7MoneyTree>>>;
  getVersion(dealId: string): Promise<P7RepositoryResult<P7ResourceVersion>>;
}

export interface P7DocumentMatrixRepository {
  loadByDealId(dealId: string): Promise<P7RepositoryResult<P7PersistedRecord<PlatformV7DocumentMatrix>>>;
  saveDocumentMatrix(
    record: P7PersistedRecord<PlatformV7DocumentMatrix>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<PlatformV7DocumentMatrix>>>;
  saveDocumentRequirement(
    dealId: string,
    document: PlatformV7DocumentRequirement,
  ): Promise<P7RepositoryResult<P7PersistedRecord<PlatformV7DocumentRequirement>>>;
}

export interface P7BankBasisRepository {
  loadByDealId(dealId: string): Promise<P7RepositoryResult<P7PersistedRecord<P7BankBasisDecision>>>;
  saveBankBasisDecision(
    record: P7PersistedRecord<P7BankBasisDecision>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<P7BankBasisDecision>>>;
  saveBankConfirmation(
    record: P7PersistedRecord<P7BankConfirmationRecord>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<P7BankConfirmationRecord>>>;
}

export interface P7DisputeSettlementRepository {
  loadByDealId(dealId: string): Promise<P7RepositoryResult<P7PersistedRecord<P7SettlementSplitRecord>>>;
  saveArbitrationDecision(
    record: P7PersistedRecord<P7ArbitrationDecisionRecord>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<P7ArbitrationDecisionRecord>>>;
  saveSettlementSplit(
    record: P7PersistedRecord<P7SettlementSplitRecord>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<P7SettlementSplitRecord>>>;
}

export interface P7ActionExecutionRepository {
  loadByActionId(actionId: string): Promise<P7RepositoryResult<P7PersistedRecord<P7ActionExecutionRecord>>>;
  saveActionExecution(
    record: P7PersistedRecord<P7ActionExecutionRecord>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<P7ActionExecutionRecord>>>;
  listByDealId(dealId: string): Promise<P7RepositoryResult<readonly P7PersistedRecord<P7ActionExecutionRecord>[]>>;
}

export interface P7ExternalCallRepository {
  saveExternalCallEnvelope(
    record: P7PersistedRecord<P7ExternalCallEnvelope>,
    options: P7SaveOptions,
  ): Promise<P7RepositoryResult<P7PersistedRecord<P7ExternalCallEnvelope>>>;
  loadByCorrelationId(correlationId: string): Promise<P7RepositoryResult<readonly P7PersistedRecord<P7ExternalCallEnvelope>[]>>;
}

export interface P7IdempotencyScope {
  readonly dealId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly actorId?: string;
  readonly correlationId?: string;
}

export interface P7IdempotencyReservationInput {
  readonly key: string;
  readonly scope: P7IdempotencyScope;
  readonly operationId?: string;
  readonly bankEventId?: string;
  readonly auditId?: string;
  readonly correlationId: string;
}

export interface P7IdempotencyResultInput {
  readonly key: string;
  readonly scope: P7IdempotencyScope;
  readonly result: PlatformV7ActionBoundaryResult;
  readonly operationId?: string;
  readonly bankEventId?: string;
  readonly auditId?: string;
  readonly correlationId: string;
}

export interface P7IdempotencyStore {
  loadContext(scope: P7IdempotencyScope): Promise<P7ActionIdempotencyContext>;
  hasProcessedKey(key: string): Promise<P7RuntimeResult<boolean>>;
  hasProcessedBankEventId(bankEventId: string): Promise<P7RuntimeResult<boolean>>;
  hasProcessedOperationId(operationId: string): Promise<P7RuntimeResult<boolean>>;
  reserveKey(input: P7IdempotencyReservationInput): Promise<P7RuntimeResult<P7ResourceVersion>>;
  recordResult(input: P7IdempotencyResultInput): Promise<P7RuntimeResult<P7PersistedRecord<PlatformV7ActionBoundaryResult>>>;
  loadDuplicateResult(key: string): Promise<P7RepositoryResult<P7PersistedRecord<PlatformV7ActionBoundaryResult>>>;
}

export interface P7AuditEventSink {
  append(payload: P7AuditPayload): Promise<P7RuntimeResult<P7PersistedRecord<P7AuditPayload>>>;
  appendMany(payloads: readonly P7AuditPayload[]): Promise<P7RuntimeResult<readonly P7PersistedRecord<P7AuditPayload>[]>>;
  listByCorrelationId(correlationId: string): Promise<P7RepositoryResult<readonly P7PersistedRecord<P7AuditPayload>[]>>;
  listByResource(resourceType: string, resourceId: string): Promise<P7RepositoryResult<readonly P7PersistedRecord<P7AuditPayload>[]>>;
}

export interface P7RuntimeTransactionalPorts {
  readonly transaction: P7RuntimeTransactionContext;
  readonly moneyTree: P7MoneyTreeRepository;
  readonly documentMatrix: P7DocumentMatrixRepository;
  readonly bankBasis: P7BankBasisRepository;
  readonly disputeSettlement: P7DisputeSettlementRepository;
  readonly actionExecution: P7ActionExecutionRepository;
  readonly idempotency: P7IdempotencyStore;
  readonly audit: P7AuditEventSink;
  readonly externalCalls: P7ExternalCallRepository;
}

export interface P7RuntimeUnitOfWork {
  readonly moneyTree: P7MoneyTreeRepository;
  readonly documentMatrix: P7DocumentMatrixRepository;
  readonly bankBasis: P7BankBasisRepository;
  readonly disputeSettlement: P7DisputeSettlementRepository;
  readonly actionExecution: P7ActionExecutionRepository;
  readonly idempotency: P7IdempotencyStore;
  readonly audit: P7AuditEventSink;
  readonly externalCalls: P7ExternalCallRepository;
  runInTransaction<T>(
    fn: (ports: P7RuntimeTransactionalPorts) => Promise<P7RuntimeResult<T>>,
  ): Promise<P7RuntimeResult<T>>;
}
