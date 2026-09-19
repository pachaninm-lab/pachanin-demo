// PR-2 DB persistence adapter — реализация P7RuntimeUnitOfWork над драйвером БД.
//
// Покрывает deals (money tree), documents (matrix/requirements), money ledger
// (bank basis/confirmations/settlement), audit, evidence/disputes (settlement/
// arbitration), idempotency, versions, queues (action executions/external calls),
// snapshots. application-service не меняется: подключение реальной БД = реализация
// P7PersistenceDriver, store остаётся прежним.

import type { P7ActionIdempotencyContext, PlatformV7ActionBoundaryResult } from '../action-boundary';
import type { P7BankBasisDecision } from '../bank-basis';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '../document-matrix';
import type { PlatformV7MoneyTree } from '../money-tree';
import type {
  P7ActionExecutionRecord,
  P7ArbitrationDecisionRecord,
  P7AuditPayload,
  P7BankConfirmationRecord,
  P7ExternalCallEnvelope,
  P7IdempotencyReservationInput,
  P7IdempotencyResultInput,
  P7IdempotencyScope,
  P7PersistedRecord,
  P7RepositoryResult,
  P7ResourceVersion,
  P7RuntimeError,
  P7RuntimeResult,
  P7RuntimeTransactionContext,
  P7RuntimeTransactionalPorts,
  P7RuntimeUnitOfWork,
  P7SettlementSplitRecord,
  P7VersionToken,
} from './persistence-ports';
import type { P7PersistenceDriver } from './persistence-driver';

const COLLECTIONS = {
  moneyTree: 'money_tree',
  documentMatrix: 'document_matrix',
  documentRequirement: 'document_requirement',
  bankBasis: 'bank_basis',
  bankConfirmation: 'bank_confirmation',
  arbitrationDecision: 'arbitration_decision',
  settlementSplit: 'settlement_split',
  actionExecution: 'action_execution',
  externalCall: 'external_call',
} as const;

function err(code: P7RuntimeError['code'], message: string, details?: Record<string, unknown>): P7RuntimeError {
  return { code, message, details };
}
function okRepo<T>(value: T, version?: P7ResourceVersion): P7RepositoryResult<T> {
  return { ok: true, status: 'ok', value, version };
}
function failRepo<T>(status: 'not_found' | 'conflict' | 'error', code: P7RuntimeError['code'], message: string, currentVersion?: P7ResourceVersion): P7RepositoryResult<T> {
  return { ok: false, status, error: err(code, message), currentVersion };
}
function okRuntime<T>(value: T): P7RuntimeResult<T> {
  return { ok: true, value };
}
function failRuntime<T>(code: P7RuntimeError['code'], message: string): P7RuntimeResult<T> {
  return { ok: false, error: err(code, message) };
}

function checkVersion<T>(existing: P7PersistedRecord<T> | undefined, expected: P7VersionToken | undefined): P7RepositoryResult<P7PersistedRecord<T>> | null {
  if (!expected) return null;
  if (!existing) return failRepo('conflict', 'conflict', 'Expected version provided but record does not exist.');
  if (existing.version.version !== expected) {
    return failRepo('conflict', 'conflict', 'Expected version does not match current version.', existing.version);
  }
  return null;
}

function scopeKey(scope: P7IdempotencyScope): string {
  return [scope.dealId, scope.resourceType, scope.resourceId, scope.actorId, scope.correlationId].join('|');
}

export function createP7DbRuntimeStore(driver: P7PersistenceDriver): P7RuntimeUnitOfWork {
  function stamp<T>(record: P7PersistedRecord<T>, resourceType: string, resourceId: string): P7PersistedRecord<T> {
    return {
      ...record,
      version: driver.nextVersion(resourceType, resourceId),
      createdAt: record.createdAt || driver.now(),
      updatedAt: driver.now(),
    };
  }

  const moneyTree: P7RuntimeUnitOfWork['moneyTree'] = {
    async loadByDealId(dealId) {
      const rec = driver.getRecord<PlatformV7MoneyTree>(COLLECTIONS.moneyTree, dealId);
      return rec ? okRepo(rec, rec.version) : failRepo('not_found', 'not_found', `MoneyTree not found for deal ${dealId}.`);
    },
    async saveMoneyTree(record, options) {
      const dealId = record.dealId ?? record.value.dealId;
      const conflict = checkVersion(driver.getRecord<PlatformV7MoneyTree>(COLLECTIONS.moneyTree, dealId), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'money_tree', dealId);
      driver.putRecord(COLLECTIONS.moneyTree, dealId, saved);
      return okRepo(saved, saved.version);
    },
    async getVersion(dealId) {
      const rec = driver.getRecord<PlatformV7MoneyTree>(COLLECTIONS.moneyTree, dealId);
      return rec ? okRepo(rec.version, rec.version) : failRepo('not_found', 'not_found', `MoneyTree version not found for deal ${dealId}.`);
    },
  };

  const documentMatrix: P7RuntimeUnitOfWork['documentMatrix'] = {
    async loadByDealId(dealId) {
      const rec = driver.getRecord<PlatformV7DocumentMatrix>(COLLECTIONS.documentMatrix, dealId);
      return rec ? okRepo(rec, rec.version) : failRepo('not_found', 'not_found', `Document Matrix not found for deal ${dealId}.`);
    },
    async saveDocumentMatrix(record, options) {
      const dealId = record.dealId ?? record.value.dealId;
      const conflict = checkVersion(driver.getRecord<PlatformV7DocumentMatrix>(COLLECTIONS.documentMatrix, dealId), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'document_matrix', dealId);
      driver.putRecord(COLLECTIONS.documentMatrix, dealId, saved);
      return okRepo(saved, saved.version);
    },
    async saveDocumentRequirement(dealId, document, options) {
      const key = `${dealId}:${document.documentId}`;
      const conflict = checkVersion(driver.getRecord<PlatformV7DocumentRequirement>(COLLECTIONS.documentRequirement, key), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp<PlatformV7DocumentRequirement>(
        { recordId: key, dealId, value: document, version: driver.nextVersion('document_requirement', key), createdAt: driver.now(), updatedAt: driver.now() },
        'document_requirement',
        key,
      );
      driver.putRecord(COLLECTIONS.documentRequirement, key, saved);
      const currentMatrix = driver.getRecord<PlatformV7DocumentMatrix>(COLLECTIONS.documentMatrix, dealId);
      const documents = currentMatrix?.value.documents ?? [];
      const nextDocuments = documents.some((item) => item.documentId === document.documentId)
        ? documents.map((item) => (item.documentId === document.documentId ? document : item))
        : [...documents, document];
      driver.putRecord<PlatformV7DocumentMatrix>(COLLECTIONS.documentMatrix, dealId, {
        recordId: currentMatrix?.recordId ?? `document-matrix:${dealId}`,
        dealId,
        value: { dealId, documents: nextDocuments },
        version: driver.nextVersion('document_matrix', dealId),
        createdAt: currentMatrix?.createdAt ?? driver.now(),
        updatedAt: driver.now(),
      });
      return okRepo(saved, saved.version);
    },
  };

  const bankBasis: P7RuntimeUnitOfWork['bankBasis'] = {
    async loadByDealId(dealId) {
      const rec = driver.getRecord<P7BankBasisDecision>(COLLECTIONS.bankBasis, dealId);
      return rec ? okRepo(rec, rec.version) : failRepo('not_found', 'not_found', `Bank basis not found for deal ${dealId}.`);
    },
    async saveBankBasisDecision(record, options) {
      const dealId = record.dealId ?? record.value.dealId;
      const conflict = checkVersion(driver.getRecord<P7BankBasisDecision>(COLLECTIONS.bankBasis, dealId), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'bank_basis', dealId);
      driver.putRecord(COLLECTIONS.bankBasis, dealId, saved);
      return okRepo(saved, saved.version);
    },
    async saveBankConfirmation(record, options) {
      const bankEventId = record.value.confirmation.bankEventId;
      if (bankEventId && driver.hasBankEvent(bankEventId)) {
        return failRepo('error', 'duplicate', `Duplicate bank event: ${bankEventId}.`);
      }
      if (bankEventId) driver.markBankEvent(bankEventId);
      const conflict = checkVersion(driver.getRecord<P7BankConfirmationRecord>(COLLECTIONS.bankConfirmation, record.recordId), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'bank_confirmation', record.recordId);
      driver.putRecord(COLLECTIONS.bankConfirmation, record.recordId, saved);
      return okRepo(saved, saved.version);
    },
  };

  const disputeSettlement: P7RuntimeUnitOfWork['disputeSettlement'] = {
    async loadByDealId(dealId) {
      const rec = driver.getRecord<P7SettlementSplitRecord>(COLLECTIONS.settlementSplit, dealId);
      return rec ? okRepo(rec, rec.version) : failRepo('not_found', 'not_found', `Settlement split not found for deal ${dealId}.`);
    },
    async saveArbitrationDecision(record, options) {
      const key = record.value.arbitrationDecisionId;
      const conflict = checkVersion(driver.getRecord<P7ArbitrationDecisionRecord>(COLLECTIONS.arbitrationDecision, key), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'arbitration_decision', key);
      driver.putRecord(COLLECTIONS.arbitrationDecision, key, saved);
      return okRepo(saved, saved.version);
    },
    async saveSettlementSplit(record, options) {
      const dealId = record.dealId ?? record.value.dealId;
      const conflict = checkVersion(driver.getRecord<P7SettlementSplitRecord>(COLLECTIONS.settlementSplit, dealId), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'settlement_split', dealId);
      driver.putRecord(COLLECTIONS.settlementSplit, dealId, saved);
      return okRepo(saved, saved.version);
    },
  };

  const actionExecution: P7RuntimeUnitOfWork['actionExecution'] = {
    async loadByActionId(actionId) {
      const rec = driver.getRecord<P7ActionExecutionRecord>(COLLECTIONS.actionExecution, actionId);
      return rec ? okRepo(rec, rec.version) : failRepo('not_found', 'not_found', `Action execution not found: ${actionId}.`);
    },
    async saveActionExecution(record, options) {
      const key = record.value.actionId;
      const conflict = checkVersion(driver.getRecord<P7ActionExecutionRecord>(COLLECTIONS.actionExecution, key), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'action_execution', key);
      driver.putRecord(COLLECTIONS.actionExecution, key, saved);
      return okRepo(saved, saved.version);
    },
    async listByDealId(dealId) {
      const records = driver.listRecords<P7ActionExecutionRecord>(COLLECTIONS.actionExecution).filter((r) => r.value.dealId === dealId || r.dealId === dealId);
      return okRepo(records);
    },
  };

  const externalCalls: P7RuntimeUnitOfWork['externalCalls'] = {
    async saveExternalCallEnvelope(record, options) {
      const key = record.value.externalCallId;
      const conflict = checkVersion(driver.getRecord<P7ExternalCallEnvelope>(COLLECTIONS.externalCall, key), options.expectedVersion);
      if (conflict) return conflict;
      const saved = stamp(record, 'external_call', key);
      driver.putRecord(COLLECTIONS.externalCall, key, saved);
      return okRepo(saved, saved.version);
    },
    async loadByCorrelationId(correlationId) {
      const records = driver.listRecords<P7ExternalCallEnvelope>(COLLECTIONS.externalCall).filter((r) => r.value.correlationId === correlationId);
      return okRepo(records);
    },
  };

  const idempotency: P7RuntimeUnitOfWork['idempotency'] = {
    async loadContext(scope) {
      const sk = scopeKey(scope);
      const records = driver.listIdempotency().filter((r) => r.scopeKey === sk);
      const context: P7ActionIdempotencyContext = {
        processedKeys: records.map((r) => r.key),
        processedBankEventIds: records.map((r) => r.bankEventId).filter((v): v is string => Boolean(v)),
        processedOperationIds: records.map((r) => r.operationId).filter((v): v is string => Boolean(v)),
      };
      return context;
    },
    async hasProcessedKey(key) {
      return okRuntime(Boolean(driver.getIdempotency(key)));
    },
    async hasProcessedBankEventId(bankEventId) {
      return okRuntime(driver.hasBankEvent(bankEventId) || driver.listIdempotency().some((r) => r.bankEventId === bankEventId));
    },
    async hasProcessedOperationId(operationId) {
      return okRuntime(driver.listIdempotency().some((r) => r.operationId === operationId));
    },
    async reserveKey(input: P7IdempotencyReservationInput) {
      if (driver.getIdempotency(input.key)) return failRuntime('duplicate', `Idempotency key already reserved: ${input.key}.`);
      if (input.bankEventId && driver.hasBankEvent(input.bankEventId)) return failRuntime('duplicate', `Bank event already processed: ${input.bankEventId}.`);
      const version = driver.nextVersion('idempotency', input.key);
      driver.putIdempotency({
        key: input.key,
        scopeKey: scopeKey(input.scope),
        operationId: input.operationId,
        bankEventId: input.bankEventId,
        correlationId: input.correlationId,
        reservedAt: driver.now(),
      });
      if (input.bankEventId) driver.markBankEvent(input.bankEventId);
      return okRuntime(version);
    },
    async recordResult(input: P7IdempotencyResultInput) {
      const existing = driver.getIdempotency(input.key);
      const record: P7PersistedRecord<PlatformV7ActionBoundaryResult> = {
        recordId: `idempotency-result:${input.key}`,
        dealId: input.scope.dealId,
        value: input.result,
        version: driver.nextVersion('idempotency_result', input.key),
        createdAt: driver.now(),
        updatedAt: driver.now(),
      };
      driver.putIdempotency({
        key: input.key,
        scopeKey: scopeKey(input.scope),
        operationId: input.operationId ?? existing?.operationId,
        bankEventId: input.bankEventId ?? existing?.bankEventId,
        correlationId: input.correlationId,
        reservedAt: existing?.reservedAt ?? driver.now(),
        result: record,
      });
      return okRuntime(record);
    },
    async loadDuplicateResult(key) {
      const rec = driver.getIdempotency(key)?.result as P7PersistedRecord<PlatformV7ActionBoundaryResult> | undefined;
      return rec ? okRepo(rec, rec.version) : failRepo('not_found', 'not_found', `No stored duplicate result for ${key}.`);
    },
  };

  const audit: P7RuntimeUnitOfWork['audit'] = {
    async append(payload) {
      const p = payload as unknown as Record<string, unknown>;
      const record: P7PersistedRecord<P7AuditPayload> = {
        recordId: String(p.auditId ?? `audit:${driver.listAudit().length + 1}`),
        dealId: typeof p.dealId === 'string' ? p.dealId : undefined,
        value: payload,
        version: driver.nextVersion('audit_event', String(p.auditId ?? driver.listAudit().length + 1)),
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : driver.now(),
        updatedAt: driver.now(),
      };
      driver.appendAudit(record);
      return okRuntime(record);
    },
    async appendMany(payloads) {
      const results: P7PersistedRecord<P7AuditPayload>[] = [];
      for (const payload of payloads) {
        const appended = await audit.append(payload);
        if (!appended.ok) return failRuntime('persistence_error', 'Failed to append audit payload.');
        results.push(appended.value);
      }
      return okRuntime(results);
    },
    async listByCorrelationId(correlationId) {
      const records = driver.listAudit().filter((r) => (r.value as unknown as Record<string, unknown>).correlationId === correlationId);
      return okRepo(records);
    },
    async listByResource(resourceType, resourceId) {
      const records = driver.listAudit().filter((r) => {
        const p = r.value as unknown as Record<string, unknown>;
        return p.resourceType === resourceType && p.resourceId === resourceId;
      });
      return okRepo(records);
    },
  };

  const runInTransaction: P7RuntimeUnitOfWork['runInTransaction'] = async (fn) => {
    const transaction: P7RuntimeTransactionContext = {
      transactionId: `db-tx-${driver.now()}`,
      startedAt: driver.now(),
      correlationId: `db-corr-${driver.now()}`,
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
    const outcome = await driver.runInTransaction(async () => {
      const result = await fn(ports);
      if (!result.ok) throw result;
      return result;
    });
    if (outcome.ok === true) {
      return outcome.value;
    }
    const thrown: unknown = outcome.error;
    if (thrown && typeof thrown === 'object' && 'ok' in thrown && (thrown as { ok: boolean }).ok === false) {
      return thrown as P7RuntimeResult<never>;
    }
    return failRuntime('transaction_error', thrown instanceof Error ? thrown.message : 'DB transaction failed.');
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
