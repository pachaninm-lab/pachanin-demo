import type { P7ActionIdempotencyContext, PlatformV7ActionBoundaryResult } from '../action-boundary';
import type { P7BankBasisDecision } from '../bank-basis';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '../document-matrix';
import type { PlatformV7MoneyTree } from '../money-tree';
import type {
  P7ActionExecutionRecord,
  P7ActionExecutionRepository,
  P7ArbitrationDecisionRecord,
  P7AuditEventSink,
  P7AuditPayload,
  P7BankBasisRepository,
  P7BankConfirmationRecord,
  P7DisputeSettlementRepository,
  P7DocumentMatrixRepository,
  P7ExternalCallEnvelope,
  P7ExternalCallRepository,
  P7IdempotencyReservationInput,
  P7IdempotencyResultInput,
  P7IdempotencyScope,
  P7IdempotencyStore,
  P7MoneyTreeRepository,
  P7PersistedRecord,
  P7RepositoryResult,
  P7ResourceVersion,
  P7RuntimeError,
  P7RuntimeResult,
  P7RuntimeTransactionContext,
  P7RuntimeTransactionalPorts,
  P7RuntimeUnitOfWork,
  P7SaveOptions,
  P7SettlementSplitRecord,
  P7VersionToken,
} from './persistence-ports';

export interface P7MockRuntimeStoreSeed {
  readonly now?: string;
  readonly moneyTrees?: readonly P7PersistedRecord<PlatformV7MoneyTree>[];
  readonly documentMatrices?: readonly P7PersistedRecord<PlatformV7DocumentMatrix>[];
  readonly bankBasisDecisions?: readonly P7PersistedRecord<P7BankBasisDecision>[];
  readonly settlementSplits?: readonly P7PersistedRecord<P7SettlementSplitRecord>[];
  readonly actionExecutions?: readonly P7PersistedRecord<P7ActionExecutionRecord>[];
  readonly externalCalls?: readonly P7PersistedRecord<P7ExternalCallEnvelope>[];
  readonly auditEvents?: readonly P7PersistedRecord<P7AuditPayload>[];
}

export interface P7MockRuntimeStoreSnapshot {
  readonly moneyTrees: readonly P7PersistedRecord<PlatformV7MoneyTree>[];
  readonly documentMatrices: readonly P7PersistedRecord<PlatformV7DocumentMatrix>[];
  readonly documentRequirements: readonly P7PersistedRecord<PlatformV7DocumentRequirement>[];
  readonly bankBasisDecisions: readonly P7PersistedRecord<P7BankBasisDecision>[];
  readonly bankConfirmations: readonly P7PersistedRecord<P7BankConfirmationRecord>[];
  readonly arbitrationDecisions: readonly P7PersistedRecord<P7ArbitrationDecisionRecord>[];
  readonly settlementSplits: readonly P7PersistedRecord<P7SettlementSplitRecord>[];
  readonly actionExecutions: readonly P7PersistedRecord<P7ActionExecutionRecord>[];
  readonly externalCalls: readonly P7PersistedRecord<P7ExternalCallEnvelope>[];
  readonly auditEvents: readonly P7PersistedRecord<P7AuditPayload>[];
  readonly idempotencyKeys: readonly string[];
  readonly processedBankEventIds: readonly string[];
  readonly processedOperationIds: readonly string[];
}

export interface P7MockRuntimeStore extends P7RuntimeUnitOfWork {
  readonly snapshot: () => P7MockRuntimeStoreSnapshot;
  readonly reset: (seed?: P7MockRuntimeStoreSeed) => void;
  readonly simulateNextConflict: (resourceType?: string) => void;
  readonly simulateNextNotFound: (resourceType?: string) => void;
  readonly simulateDuplicateBankEventId: (bankEventId: string) => void;
}

type IdempotencyRecord = {
  readonly key: string;
  readonly scope: P7IdempotencyScope;
  readonly operationId?: string;
  readonly bankEventId?: string;
  readonly auditId?: string;
  readonly correlationId: string;
  readonly version: P7ResourceVersion;
  readonly reservedAt: string;
  readonly result?: P7PersistedRecord<PlatformV7ActionBoundaryResult>;
};

type MockState = {
  moneyTrees: Record<string, P7PersistedRecord<PlatformV7MoneyTree>>;
  documentMatrices: Record<string, P7PersistedRecord<PlatformV7DocumentMatrix>>;
  documentRequirements: Record<string, P7PersistedRecord<PlatformV7DocumentRequirement>>;
  bankBasisDecisions: Record<string, P7PersistedRecord<P7BankBasisDecision>>;
  bankConfirmations: Record<string, P7PersistedRecord<P7BankConfirmationRecord>>;
  arbitrationDecisions: Record<string, P7PersistedRecord<P7ArbitrationDecisionRecord>>;
  settlementSplits: Record<string, P7PersistedRecord<P7SettlementSplitRecord>>;
  actionExecutions: Record<string, P7PersistedRecord<P7ActionExecutionRecord>>;
  externalCalls: Record<string, P7PersistedRecord<P7ExternalCallEnvelope>>;
  auditEvents: P7PersistedRecord<P7AuditPayload>[];
  idempotency: Record<string, IdempotencyRecord>;
  duplicateBankEventIds: string[];
  nextConflictResourceType?: string;
  nextNotFoundResourceType?: string;
  versionCounter: number;
  now: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now(state: MockState): string {
  return state.now;
}

function runtimeError(code: P7RuntimeError['code'], message: string, details?: Record<string, unknown>): P7RuntimeError {
  return { code, message, details };
}

function okRepo<T>(value: T, version?: P7ResourceVersion): P7RepositoryResult<T> {
  return { ok: true, status: 'ok', value: clone(value), version };
}

function failRepo<T>(
  status: 'not_found' | 'conflict' | 'error',
  code: P7RuntimeError['code'],
  message: string,
  currentVersion?: P7ResourceVersion,
  details?: Record<string, unknown>,
): P7RepositoryResult<T> {
  return { ok: false, status, error: runtimeError(code, message, details), currentVersion };
}

function okRuntime<T>(value: T): P7RuntimeResult<T> {
  return { ok: true, value: clone(value) };
}

function failRuntime<T>(code: P7RuntimeError['code'], message: string, details?: Record<string, unknown>): P7RuntimeResult<T> {
  return { ok: false, error: runtimeError(code, message, details) };
}

function nextVersion(state: MockState, resourceType: string, resourceId: string): P7ResourceVersion {
  state.versionCounter += 1;
  return {
    resourceType,
    resourceId,
    version: `mock-v${state.versionCounter}`,
    updatedAt: now(state),
  };
}

function withStoredVersion<T>(
  state: MockState,
  record: P7PersistedRecord<T>,
  resourceType: string,
  resourceId: string,
): P7PersistedRecord<T> {
  const stamped: P7PersistedRecord<T> = {
    ...clone(record),
    version: nextVersion(state, resourceType, resourceId),
    createdAt: record.createdAt || now(state),
    updatedAt: now(state),
  };
  return stamped;
}

function consumeForcedFailure<T>(state: MockState, resourceType: string): P7RepositoryResult<T> | null {
  if (state.nextNotFoundResourceType === resourceType || state.nextNotFoundResourceType === '*') {
    state.nextNotFoundResourceType = undefined;
    return failRepo('not_found', 'not_found', `Mock ${resourceType} not found.`);
  }

  if (state.nextConflictResourceType === resourceType || state.nextConflictResourceType === '*') {
    state.nextConflictResourceType = undefined;
    return failRepo('conflict', 'conflict', `Mock ${resourceType} conflict.`);
  }

  return null;
}

function checkExpectedVersion<T>(
  existing: P7PersistedRecord<T> | undefined,
  expectedVersion: P7VersionToken | undefined,
): P7RepositoryResult<P7PersistedRecord<T>> | null {
  if (!expectedVersion) return null;

  if (!existing) {
    return failRepo('conflict', 'conflict', 'Expected version was provided but the record does not exist.');
  }

  if (existing.version.version !== expectedVersion) {
    return failRepo('conflict', 'conflict', 'Expected version does not match current version.', existing.version, {
      expectedVersion,
      actualVersion: existing.version.version,
    });
  }

  return null;
}

function sameScope(left: P7IdempotencyScope, right: P7IdempotencyScope): boolean {
  return left.dealId === right.dealId
    && left.resourceType === right.resourceType
    && left.resourceId === right.resourceId
    && left.actorId === right.actorId
    && left.correlationId === right.correlationId;
}

function createState(seed: P7MockRuntimeStoreSeed = {}): MockState {
  const state: MockState = {
    moneyTrees: {},
    documentMatrices: {},
    documentRequirements: {},
    bankBasisDecisions: {},
    bankConfirmations: {},
    arbitrationDecisions: {},
    settlementSplits: {},
    actionExecutions: {},
    externalCalls: {},
    auditEvents: [],
    idempotency: {},
    duplicateBankEventIds: [],
    versionCounter: 0,
    now: seed.now ?? '2026-05-24T00:00:00.000Z',
  };

  for (const record of seed.moneyTrees ?? []) state.moneyTrees[record.dealId ?? record.recordId] = clone(record);
  for (const record of seed.documentMatrices ?? []) state.documentMatrices[record.dealId ?? record.recordId] = clone(record);
  for (const record of seed.bankBasisDecisions ?? []) state.bankBasisDecisions[record.dealId ?? record.recordId] = clone(record);
  for (const record of seed.settlementSplits ?? []) state.settlementSplits[record.dealId ?? record.recordId] = clone(record);
  for (const record of seed.actionExecutions ?? []) state.actionExecutions[record.value.actionId] = clone(record);
  for (const record of seed.externalCalls ?? []) state.externalCalls[record.value.externalCallId] = clone(record);
  state.auditEvents = clone(seed.auditEvents ?? []);

  return state;
}

function createRepositories(getState: () => MockState): P7RuntimeUnitOfWork {
  const moneyTree: P7MoneyTreeRepository = {
    async loadByDealId(dealId) {
      const state = getState();
      const forced = consumeForcedFailure<P7PersistedRecord<PlatformV7MoneyTree>>(state, 'money_tree');
      if (forced) return forced;
      const record = state.moneyTrees[dealId];
      return record ? okRepo(record, record.version) : failRepo('not_found', 'not_found', `MoneyTree not found for deal ${dealId}.`);
    },
    async saveMoneyTree(record, options) {
      const state = getState();
      const forced = consumeForcedFailure<P7PersistedRecord<PlatformV7MoneyTree>>(state, 'money_tree');
      if (forced) return forced;
      const dealId = record.dealId ?? record.value.dealId;
      const versionFailure = checkExpectedVersion(state.moneyTrees[dealId], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'money_tree', dealId);
      state.moneyTrees[dealId] = saved;
      return okRepo(saved, saved.version);
    },
    async getVersion(dealId) {
      const state = getState();
      const record = state.moneyTrees[dealId];
      return record ? okRepo(record.version, record.version) : failRepo('not_found', 'not_found', `MoneyTree version not found for deal ${dealId}.`);
    },
  };

  const documentMatrix: P7DocumentMatrixRepository = {
    async loadByDealId(dealId) {
      const state = getState();
      const forced = consumeForcedFailure<P7PersistedRecord<PlatformV7DocumentMatrix>>(state, 'document_matrix');
      if (forced) return forced;
      const record = state.documentMatrices[dealId];
      return record ? okRepo(record, record.version) : failRepo('not_found', 'not_found', `Document Matrix not found for deal ${dealId}.`);
    },
    async saveDocumentMatrix(record, options) {
      const state = getState();
      const forced = consumeForcedFailure<P7PersistedRecord<PlatformV7DocumentMatrix>>(state, 'document_matrix');
      if (forced) return forced;
      const dealId = record.dealId ?? record.value.dealId;
      const versionFailure = checkExpectedVersion(state.documentMatrices[dealId], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'document_matrix', dealId);
      state.documentMatrices[dealId] = saved;
      return okRepo(saved, saved.version);
    },
    async saveDocumentRequirement(dealId, document, options) {
      const state = getState();
      const key = `${dealId}:${document.documentId}`;
      const versionFailure = checkExpectedVersion(state.documentRequirements[key], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, {
        recordId: key,
        dealId,
        value: document,
        version: nextVersion(state, 'document_requirement', key),
        createdAt: now(state),
        updatedAt: now(state),
      }, 'document_requirement', key);
      state.documentRequirements[key] = saved;
      const currentMatrix = state.documentMatrices[dealId];
      const documents = currentMatrix?.value.documents ?? [];
      const nextDocuments = documents.some((item) => item.documentId === document.documentId)
        ? documents.map((item) => item.documentId === document.documentId ? document : item)
        : [...documents, document];
      const matrixRecord: P7PersistedRecord<PlatformV7DocumentMatrix> = {
        recordId: currentMatrix?.recordId ?? `document-matrix:${dealId}`,
        dealId,
        value: { dealId, documents: nextDocuments },
        version: nextVersion(state, 'document_matrix', dealId),
        createdAt: currentMatrix?.createdAt ?? now(state),
        updatedAt: now(state),
      };
      state.documentMatrices[dealId] = matrixRecord;
      return okRepo(saved, saved.version);
    },
  };

  const bankBasis: P7BankBasisRepository = {
    async loadByDealId(dealId) {
      const state = getState();
      const record = state.bankBasisDecisions[dealId];
      return record ? okRepo(record, record.version) : failRepo('not_found', 'not_found', `Bank basis not found for deal ${dealId}.`);
    },
    async saveBankBasisDecision(record, options) {
      const state = getState();
      const dealId = record.dealId ?? record.value.dealId;
      const versionFailure = checkExpectedVersion(state.bankBasisDecisions[dealId], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'bank_basis', dealId);
      state.bankBasisDecisions[dealId] = saved;
      return okRepo(saved, saved.version);
    },
    async saveBankConfirmation(record, options) {
      const state = getState();
      const bankEventId = record.value.confirmation.bankEventId;
      if (bankEventId && state.duplicateBankEventIds.includes(bankEventId)) {
        return failRepo('error', 'duplicate', `Duplicate bank event: ${bankEventId}.`);
      }
      if (bankEventId) state.duplicateBankEventIds.push(bankEventId);
      const versionFailure = checkExpectedVersion(state.bankConfirmations[record.recordId], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'bank_confirmation', record.recordId);
      state.bankConfirmations[record.recordId] = saved;
      return okRepo(saved, saved.version);
    },
  };

  const disputeSettlement: P7DisputeSettlementRepository = {
    async loadByDealId(dealId) {
      const state = getState();
      const record = state.settlementSplits[dealId];
      return record ? okRepo(record, record.version) : failRepo('not_found', 'not_found', `Settlement split not found for deal ${dealId}.`);
    },
    async saveArbitrationDecision(record, options) {
      const state = getState();
      const key = record.value.arbitrationDecisionId;
      const versionFailure = checkExpectedVersion(state.arbitrationDecisions[key], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'arbitration_decision', key);
      state.arbitrationDecisions[key] = saved;
      return okRepo(saved, saved.version);
    },
    async saveSettlementSplit(record, options) {
      const state = getState();
      const dealId = record.dealId ?? record.value.dealId;
      const versionFailure = checkExpectedVersion(state.settlementSplits[dealId], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'settlement_split', dealId);
      state.settlementSplits[dealId] = saved;
      return okRepo(saved, saved.version);
    },
  };

  const actionExecution: P7ActionExecutionRepository = {
    async loadByActionId(actionId) {
      const state = getState();
      const record = state.actionExecutions[actionId];
      return record ? okRepo(record, record.version) : failRepo('not_found', 'not_found', `Action execution not found: ${actionId}.`);
    },
    async saveActionExecution(record, options) {
      const state = getState();
      const key = record.value.actionId;
      const versionFailure = checkExpectedVersion(state.actionExecutions[key], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'action_execution', key);
      state.actionExecutions[key] = saved;
      return okRepo(saved, saved.version);
    },
    async listByDealId(dealId) {
      const records = Object.values(getState().actionExecutions).filter((record) => record.value.dealId === dealId || record.dealId === dealId);
      return okRepo(records);
    },
  };

  const externalCalls: P7ExternalCallRepository = {
    async saveExternalCallEnvelope(record, options) {
      const state = getState();
      const key = record.value.externalCallId;
      const versionFailure = checkExpectedVersion(state.externalCalls[key], options.expectedVersion);
      if (versionFailure) return versionFailure;
      const saved = withStoredVersion(state, record, 'external_call', key);
      state.externalCalls[key] = saved;
      return okRepo(saved, saved.version);
    },
    async loadByCorrelationId(correlationId) {
      const records = Object.values(getState().externalCalls).filter((record) => record.value.correlationId === correlationId);
      return okRepo(records);
    },
  };

  const idempotency: P7IdempotencyStore = {
    async loadContext(scope) {
      const records = Object.values(getState().idempotency).filter((record) => sameScope(record.scope, scope));
      const context: P7ActionIdempotencyContext = {
        processedKeys: records.map((record) => record.key),
        processedBankEventIds: records.map((record) => record.bankEventId).filter((value): value is string => Boolean(value)),
        processedOperationIds: records.map((record) => record.operationId).filter((value): value is string => Boolean(value)),
      };
      return context;
    },
    async hasProcessedKey(key) {
      return okRuntime(Boolean(getState().idempotency[key]));
    },
    async hasProcessedBankEventId(bankEventId) {
      const state = getState();
      return okRuntime(state.duplicateBankEventIds.includes(bankEventId) || Object.values(state.idempotency).some((record) => record.bankEventId === bankEventId));
    },
    async hasProcessedOperationId(operationId) {
      return okRuntime(Object.values(getState().idempotency).some((record) => record.operationId === operationId));
    },
    async reserveKey(input: P7IdempotencyReservationInput) {
      const state = getState();
      if (state.idempotency[input.key]) {
        return failRuntime('duplicate', `Idempotency key already reserved: ${input.key}.`);
      }
      if (input.bankEventId && state.duplicateBankEventIds.includes(input.bankEventId)) {
        return failRuntime('duplicate', `Bank event already processed: ${input.bankEventId}.`);
      }
      const version = nextVersion(state, 'idempotency', input.key);
      state.idempotency[input.key] = {
        key: input.key,
        scope: input.scope,
        operationId: input.operationId,
        bankEventId: input.bankEventId,
        auditId: input.auditId,
        correlationId: input.correlationId,
        version,
        reservedAt: now(state),
      };
      if (input.bankEventId) state.duplicateBankEventIds.push(input.bankEventId);
      return okRuntime(version);
    },
    async recordResult(input: P7IdempotencyResultInput) {
      const state = getState();
      const existing = state.idempotency[input.key];
      if (input.bankEventId && state.duplicateBankEventIds.includes(input.bankEventId) && existing?.bankEventId !== input.bankEventId) {
        return failRuntime('duplicate', `Bank event already processed: ${input.bankEventId}.`);
      }
      const record: P7PersistedRecord<PlatformV7ActionBoundaryResult> = {
        recordId: `idempotency-result:${input.key}`,
        dealId: input.scope.dealId,
        value: input.result,
        version: nextVersion(state, 'idempotency_result', input.key),
        createdAt: now(state),
        updatedAt: now(state),
      };
      state.idempotency[input.key] = {
        key: input.key,
        scope: input.scope,
        operationId: input.operationId ?? existing?.operationId,
        bankEventId: input.bankEventId ?? existing?.bankEventId,
        auditId: input.auditId ?? existing?.auditId,
        correlationId: input.correlationId,
        version: nextVersion(state, 'idempotency', input.key),
        reservedAt: existing?.reservedAt ?? now(state),
        result: record,
      };
      return okRuntime(record);
    },
    async loadDuplicateResult(key) {
      const record = getState().idempotency[key]?.result;
      return record ? okRepo(record, record.version) : failRepo('not_found', 'not_found', `No stored duplicate result for ${key}.`);
    },
  };

  const audit: P7AuditEventSink = {
    async append(payload) {
      const state = getState();
      const payloadRecord = payload as Record<string, unknown>;
      const record: P7PersistedRecord<P7AuditPayload> = {
        recordId: String(payloadRecord.auditId ?? `audit:${state.auditEvents.length + 1}`),
        dealId: typeof payloadRecord.dealId === 'string' ? payloadRecord.dealId : undefined,
        value: clone(payload),
        version: nextVersion(state, 'audit_event', String(payloadRecord.auditId ?? state.auditEvents.length + 1)),
        createdAt: typeof payloadRecord.createdAt === 'string' ? payloadRecord.createdAt : now(state),
        updatedAt: now(state),
      };
      state.auditEvents.push(record);
      return okRuntime(record);
    },
    async appendMany(payloads) {
      const results: P7PersistedRecord<P7AuditPayload>[] = [];
      for (const payload of payloads) {
        const appended = await audit.append(payload);
        if (!appended.ok) return failRuntime('persistence_error', appended.error.message, appended.error.details);
        results.push(appended.value);
      }
      return okRuntime(results);
    },
    async listByCorrelationId(correlationId) {
      const records = getState().auditEvents.filter((record) => {
        const payload = record.value as Record<string, unknown>;
        return payload.correlationId === correlationId;
      });
      return okRepo(records);
    },
    async listByResource(resourceType, resourceId) {
      const records = getState().auditEvents.filter((record) => {
        const payload = record.value as Record<string, unknown>;
        return payload.resourceType === resourceType && payload.resourceId === resourceId;
      });
      return okRepo(records);
    },
  };

  const runInTransaction: P7RuntimeUnitOfWork['runInTransaction'] = async (fn) => {
    const state = getState();
    const before = clone(state);
    const transaction: P7RuntimeTransactionContext = {
      transactionId: `mock-tx-${state.versionCounter + 1}`,
      startedAt: now(state),
      correlationId: `mock-corr-${state.versionCounter + 1}`,
    };
    const ports: P7RuntimeTransactionalPorts = {
      transaction,
      moneyTree,
      documentMatrix,
      bankBasis,
      disputeSettlement,
      actionExecution,
      idempotency,
      audit,
      externalCalls,
    };

    try {
      const result = await fn(ports);
      if (!result.ok) Object.assign(state, before);
      return result;
    } catch (error) {
      Object.assign(state, before);
      return failRuntime('transaction_error', error instanceof Error ? error.message : 'Mock transaction failed.');
    }
  };

  return {
    moneyTree,
    documentMatrix,
    bankBasis,
    disputeSettlement,
    actionExecution,
    idempotency,
    audit,
    externalCalls,
    runInTransaction,
  };
}

export function createP7MockRuntimeStore(seed: P7MockRuntimeStoreSeed = {}): P7MockRuntimeStore {
  let state = createState(seed);
  const ports = createRepositories(() => state);

  return {
    ...ports,
    snapshot() {
      return {
        moneyTrees: Object.values(state.moneyTrees).map(clone),
        documentMatrices: Object.values(state.documentMatrices).map(clone),
        documentRequirements: Object.values(state.documentRequirements).map(clone),
        bankBasisDecisions: Object.values(state.bankBasisDecisions).map(clone),
        bankConfirmations: Object.values(state.bankConfirmations).map(clone),
        arbitrationDecisions: Object.values(state.arbitrationDecisions).map(clone),
        settlementSplits: Object.values(state.settlementSplits).map(clone),
        actionExecutions: Object.values(state.actionExecutions).map(clone),
        externalCalls: Object.values(state.externalCalls).map(clone),
        auditEvents: state.auditEvents.map(clone),
        idempotencyKeys: Object.keys(state.idempotency),
        processedBankEventIds: [...state.duplicateBankEventIds],
        processedOperationIds: Object.values(state.idempotency).map((record) => record.operationId).filter((value): value is string => Boolean(value)),
      };
    },
    reset(nextSeed = {}) {
      state = createState(nextSeed);
    },
    simulateNextConflict(resourceType = '*') {
      state.nextConflictResourceType = resourceType;
    },
    simulateNextNotFound(resourceType = '*') {
      state.nextNotFoundResourceType = resourceType;
    },
    simulateDuplicateBankEventId(bankEventId) {
      if (!state.duplicateBankEventIds.includes(bankEventId)) state.duplicateBankEventIds.push(bankEventId);
    },
  };
}
