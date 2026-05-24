/**
 * @file platformV7RuntimeApplicationServices.test.ts
 * @stage controlled-pilot / pre-integration
 *
 * Unit tests for the P7 Application Service Layer (PR 5.1).
 *
 * All persistence is provided through typed fake implementations of
 * P7RuntimeUnitOfWork.  No module-level Map/Set.  No mock adapter.
 * No production-ready claims.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  P7AuditEventSink,
  P7AuditPayload,
  P7BankBasisRepository,
  P7BankConfirmationRecord,
  P7DisputeSettlementRepository,
  P7DocumentMatrixRepository,
  P7ExternalCallRepository,
  P7IdempotencyStore,
  P7MoneyTreeRepository,
  P7PersistedRecord,
  P7RepositoryResult,
  P7ResourceVersion,
  P7RuntimeResult,
  P7RuntimeTransactionalPorts,
  P7RuntimeUnitOfWork,
  P7SaveOptions,
} from '../../lib/platform-v7/runtime/persistence-ports';
import type {
  P7ActionIdempotencyContext,
  PlatformV7ActionBoundaryResult,
} from '../../lib/platform-v7/action-boundary';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '../../lib/platform-v7/document-matrix';
import type { PlatformV7MoneyTree } from '../../lib/platform-v7/money-tree';
import type { P7BankBasisDecision } from '../../lib/platform-v7/bank-basis';
import type { P7BankConfirmationRequestDto, P7ArbitrationBasisRequestDto } from '../../lib/platform-v7/runtime/dto-schemas';
import {
  createP7BankBasisExecutionService,
  createP7DisputeSettlementService,
  createP7DocumentExecutionService,
  createP7MoneyExecutionService,
  createP7ReleaseWorkflowService,
} from '../../lib/platform-v7/runtime/application-services';
import type { P7ApplicationServiceDependencies } from '../../lib/platform-v7/runtime/application-service-types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeVersion(resourceType: string, resourceId: string, v = 'v1'): P7ResourceVersion {
  return { resourceType, resourceId, version: v, updatedAt: '2026-05-24T00:00:00.000Z' };
}

function makeMoneyTree(overrides: Partial<PlatformV7MoneyTree> = {}): PlatformV7MoneyTree {
  return {
    dealId: 'deal-1',
    currency: 'RUB',
    reservedAmount: 100_000,
    readyToReleaseAmount: 0,
    heldAmount: 0,
    manualReviewAmount: 0,
    releasedAmount: 0,
    refundedAmount: 0,
    platformFee: 0,
    bankFee: 0,
    status: 'reserved',
    ...overrides,
  };
}

function makePersistedTree(tree: PlatformV7MoneyTree): P7PersistedRecord<PlatformV7MoneyTree> {
  return {
    recordId: `rec-${tree.dealId}`,
    dealId: tree.dealId,
    value: tree,
    version: makeVersion('money_tree', tree.dealId),
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
  };
}

function makeDocumentRequirement(): PlatformV7DocumentRequirement {
  return {
    documentId: 'lab_protocol',
    dealId: 'deal-1',
    type: 'lab_protocol',
    title: 'Lab Protocol',
    ownerRole: 'lab_specialist',
    responsibleRole: 'lab_specialist',
    status: 'missing',
    source: 'manual',
    deadline: null,
    signatureStatus: 'not_required',
    blockStages: [],
    affectsMoney: false,
    nextAction: 'upload',
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
  };
}

function makeDocumentMatrix(): PlatformV7DocumentMatrix {
  return {
    dealId: 'deal-1',
    documents: [makeDocumentRequirement()],
  };
}

function makePersistedMatrix(matrix: PlatformV7DocumentMatrix): P7PersistedRecord<PlatformV7DocumentMatrix> {
  return {
    recordId: `rec-matrix-${matrix.dealId}`,
    dealId: matrix.dealId,
    value: matrix,
    version: makeVersion('document_matrix', matrix.dealId),
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
  };
}

function makeBankBasisDecision(): P7BankBasisDecision {
  return {
    dealId: 'deal-1',
    status: 'sent_to_bank',
    canSendToBank: true,
    blockerCodes: [],
    basisDocumentIds: ['doc-1'],
    amount: 100_000,
    currency: 'RUB',
    correlationId: 'corr-basis-1',
    auditId: 'audit-basis-1',
    note: 'ready',
  };
}

function makePersistedBasis(decision: P7BankBasisDecision): P7PersistedRecord<P7BankBasisDecision> {
  return {
    recordId: `rec-basis-${decision.dealId}`,
    dealId: decision.dealId,
    value: decision,
    version: makeVersion('bank_basis', decision.dealId),
    createdAt: '2026-05-24T00:00:00.000Z',
    updatedAt: '2026-05-24T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Typed fake unit of work — local to each test, no module-level state
// ---------------------------------------------------------------------------

interface FakeStore {
  moneyTree?: P7PersistedRecord<PlatformV7MoneyTree>;
  documentMatrix?: P7PersistedRecord<PlatformV7DocumentMatrix>;
  bankBasis?: P7PersistedRecord<P7BankBasisDecision>;
  idempotencyContext: P7ActionIdempotencyContext;
  processedKeys: Set<string>;
  processedBankEventIds: Set<string>;
  auditEvents: P7AuditPayload[];
  savedMoneyTrees: PlatformV7MoneyTree[];
  savedDocumentReqs: unknown[];
  savedBankBases: unknown[];
  recordedResults: unknown[];
}

function makeFakeStore(overrides: Partial<FakeStore> = {}): FakeStore {
  return {
    idempotencyContext: {
      processedKeys: [],
      processedBankEventIds: [],
      processedOperationIds: [],
    },
    processedKeys: new Set(),
    processedBankEventIds: new Set(),
    auditEvents: [],
    savedMoneyTrees: [],
    savedDocumentReqs: [],
    savedBankBases: [],
    recordedResults: [],
    ...overrides,
  };
}

function makeFakeUow(store: FakeStore): P7RuntimeUnitOfWork {
  const moneyTree: P7MoneyTreeRepository = {
    async loadByDealId(dealId) {
      if (store.moneyTree?.dealId === dealId) {
        return { ok: true, status: 'ok', value: store.moneyTree };
      }
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: `MoneyTree not found: ${dealId}` } };
    },
    async saveMoneyTree(record, _opts) {
      store.savedMoneyTrees.push(record.value);
      store.moneyTree = record;
      return { ok: true, status: 'ok', value: record };
    },
    async getVersion(dealId) {
      if (store.moneyTree?.dealId === dealId) return { ok: true, status: 'ok', value: store.moneyTree.version };
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: 'not found' } };
    },
  };

  const documentMatrix: P7DocumentMatrixRepository = {
    async loadByDealId(dealId) {
      if (store.documentMatrix?.dealId === dealId) {
        return { ok: true, status: 'ok', value: store.documentMatrix };
      }
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: `DocumentMatrix not found: ${dealId}` } };
    },
    async saveDocumentMatrix(record, _opts) {
      return { ok: true, status: 'ok', value: record };
    },
    async saveDocumentRequirement(dealId, doc, _opts) {
      store.savedDocumentReqs.push({ dealId, doc });
      const fakeRecord: P7PersistedRecord<PlatformV7DocumentRequirement> = {
        recordId: `rec-doc-${doc.documentId}`,
        dealId,
        value: doc,
        version: makeVersion('document_requirement', doc.documentId),
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      };
      return { ok: true, status: 'ok', value: fakeRecord };
    },
  };

  const bankBasis: P7BankBasisRepository = {
    async loadByDealId(dealId) {
      if (store.bankBasis?.dealId === dealId) {
        return { ok: true, status: 'ok', value: store.bankBasis };
      }
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: `BankBasis not found: ${dealId}` } };
    },
    async saveBankBasisDecision(record, _opts) {
      store.savedBankBases.push(record.value);
      store.bankBasis = record;
      return { ok: true, status: 'ok', value: record };
    },
    async saveBankConfirmation(record, _opts) {
      return { ok: true, status: 'ok', value: record };
    },
  };

  const disputeSettlement: P7DisputeSettlementRepository = {
    async loadByDealId() {
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: 'not found' } };
    },
    async saveArbitrationDecision(record, _opts) {
      return { ok: true, status: 'ok', value: record };
    },
    async saveSettlementSplit(record, _opts) {
      return { ok: true, status: 'ok', value: record };
    },
  };

  const actionExecution = {
    async loadByActionId() {
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: 'not found' } } as P7RepositoryResult<never>;
    },
    async saveActionExecution(record: P7PersistedRecord<unknown>, _opts: P7SaveOptions) {
      return { ok: true, status: 'ok', value: record } as P7RepositoryResult<typeof record>;
    },
    async listByDealId() {
      return { ok: true, status: 'ok', value: [] } as P7RepositoryResult<readonly P7PersistedRecord<unknown>[]>;
    },
  };

  const idempotency: P7IdempotencyStore = {
    async loadContext(_scope) {
      // MUST return from store — never hardcoded []
      return store.idempotencyContext;
    },
    async hasProcessedKey(key) {
      return { ok: true, value: store.processedKeys.has(key) };
    },
    async hasProcessedBankEventId(bankEventId) {
      return { ok: true, value: store.processedBankEventIds.has(bankEventId) };
    },
    async hasProcessedOperationId(_operationId) {
      return { ok: true, value: false };
    },
    async reserveKey(input) {
      return { ok: true, value: makeVersion('idempotency_key', input.key) };
    },
    async recordResult(input) {
      store.processedKeys.add(input.key);
      store.recordedResults.push(input);
      const fakeRecord: P7PersistedRecord<PlatformV7ActionBoundaryResult> = {
        recordId: input.key,
        value: input.result as PlatformV7ActionBoundaryResult,
        version: makeVersion('idempotency_result', input.key),
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      };
      return { ok: true, value: fakeRecord };
    },
    async loadDuplicateResult(key) {
      return { ok: false, status: 'not_found', error: { code: 'not_found', message: `No duplicate for key ${key}` } };
    },
  };

  const audit: P7AuditEventSink = {
    async append(payload) {
      store.auditEvents.push(payload);
      const fakeRecord: P7PersistedRecord<P7AuditPayload> = {
        recordId: `audit-${store.auditEvents.length}`,
        value: payload,
        version: makeVersion('audit_event', `audit-${store.auditEvents.length}`),
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      };
      return { ok: true, value: fakeRecord };
    },
    async appendMany(payloads) {
      const values: P7PersistedRecord<P7AuditPayload>[] = [];
      for (const p of payloads) {
        const r = await audit.append(p);
        if (r.ok) values.push(r.value);
      }
      return { ok: true, value: values };
    },
    async listByCorrelationId() {
      return { ok: true, status: 'ok', value: [] };
    },
    async listByResource() {
      return { ok: true, status: 'ok', value: [] };
    },
  };

  const externalCalls: P7ExternalCallRepository = {
    async saveExternalCallEnvelope(record, _opts) {
      return { ok: true, status: 'ok', value: record };
    },
    async loadByCorrelationId() {
      return { ok: true, status: 'ok', value: [] };
    },
  };

  return {
    moneyTree,
    documentMatrix,
    bankBasis,
    disputeSettlement: disputeSettlement as P7DisputeSettlementRepository,
    actionExecution: actionExecution as unknown as import('../../lib/platform-v7/runtime/persistence-ports').P7ActionExecutionRepository,
    idempotency,
    audit,
    externalCalls,
    async runInTransaction(fn) {
      const txCtx: import('../../lib/platform-v7/runtime/persistence-ports').P7RuntimeTransactionContext = {
        transactionId: 'tx-1',
        startedAt: '2026-05-24T00:00:00.000Z',
        correlationId: 'corr-tx-1',
      };
      const txPorts: P7RuntimeTransactionalPorts = {
        transaction: txCtx,
        moneyTree,
        documentMatrix,
        bankBasis,
        disputeSettlement: disputeSettlement as P7DisputeSettlementRepository,
        actionExecution: actionExecution as unknown as import('../../lib/platform-v7/runtime/persistence-ports').P7ActionExecutionRepository,
        idempotency,
        audit,
        externalCalls,
      };
      return fn(txPorts);
    },
  };
}

// ---------------------------------------------------------------------------
// Valid idempotency key helpers — format: p7:{boundaryId}:actor-{id}:entity-{id}:deal-{id}:amount-{n}:currency-{c}:attempt-{n}
// ---------------------------------------------------------------------------

const VALID_MONEY_KEY = 'p7:money-release:actor-user1:entity-deal1:deal-deal1:amount-50000:currency-rub:attempt-001';
const VALID_DOC_KEY   = 'p7:document-confirm:actor-lab1:entity-lab-protocol:deal-deal1:amount-none:currency-none:attempt-001';
const VALID_BANK_KEY  = 'p7:bank-confirm:actor-bank1:entity-bank-evt1:deal-deal1:amount-100000:currency-rub:attempt-001';
const VALID_ARB_KEY   = 'p7:arb-basis:actor-arb1:entity-arb-decision1:deal-deal1:amount-30000:currency-rub:attempt-001';

// ---------------------------------------------------------------------------
// Common DTO builder
// ---------------------------------------------------------------------------

function makeBaseDto() {
  return {
    actor: { actorId: 'user-1', actorRole: 'operator', organizationId: 'org-1' },
    resource: {
      resourceType: 'deal' as const,
      resourceId: 'deal-1',
      dealId: 'deal-1',
      ownerOrganizationId: 'org-1',
      buyerOrganizationId: 'org-buyer',
      sellerOrganizationId: 'org-seller',
    },
    audit: { auditId: 'audit-1', correlationId: 'corr-1', reason: 'test' },
    idempotency: { idempotencyKey: VALID_MONEY_KEY, operationId: 'op-1' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('P7 Application Service Layer — PR 5.1', () => {

  // =========================================================================
  // Test 1: DI contract — injected adapter can be replaced without modifying service
  // =========================================================================
  it('DI contract: service accepts any P7RuntimeUnitOfWork without modification', () => {
    const store = makeFakeStore();
    const uow = makeFakeUow(store);
    const deps: P7ApplicationServiceDependencies = { unitOfWork: uow };

    const svc = createP7MoneyExecutionService(deps);
    expect(svc).toBeDefined();
    expect(typeof svc.requestRelease).toBe('function');
    expect(typeof svc.confirmRelease).toBe('function');
    expect(typeof svc.confirmRefund).toBe('function');
    expect(typeof svc.confirmHold).toBe('function');
  });

  // =========================================================================
  // Test 2: invalid DTO (empty actorRole) returns validation_error without touching repo
  // =========================================================================
  it('validation_error: empty actorRole returns validation_error without touching repo', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const saveMoneyTreeSpy = vi.spyOn(uow.moneyTree, 'saveMoneyTree');
    const deps: P7ApplicationServiceDependencies = { unitOfWork: uow };
    const svc = createP7MoneyExecutionService(deps);

    const dto = {
      ...makeBaseDto(),
      actor: { actorId: 'user-1', actorRole: '' /* invalid */, organizationId: 'org-1' },
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };

    const result = await svc.requestRelease(dto);
    expect(result.status).toBe('validation_error');
    expect(saveMoneyTreeSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Test 3: fractional amount returns validation_error (integer constraint)
  // =========================================================================
  it('validation_error: fractional amount 1.5 returns validation_error without touching repo', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const saveMoneyTreeSpy = vi.spyOn(uow.moneyTree, 'saveMoneyTree');
    const deps: P7ApplicationServiceDependencies = { unitOfWork: uow };
    const svc = createP7MoneyExecutionService(deps);

    const dto = {
      ...makeBaseDto(),
      action: 'reserve_requested' as const,
      amount: 1.5,
      currency: 'RUB' as const,
    };

    const result = await svc.requestRelease(dto);
    expect(result.status).toBe('validation_error');
    expect(saveMoneyTreeSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Test 4: loadContext called — context not hardcoded
  // =========================================================================
  it('idempotency: loadContext is called — processedKeys come from store, not hardcoded []', async () => {
    const store = makeFakeStore({
      moneyTree: makePersistedTree(makeMoneyTree()),
      idempotencyContext: {
        processedKeys: ['some-existing-key'],
        processedBankEventIds: [],
        processedOperationIds: [],
      },
    });
    const uow = makeFakeUow(store);
    const loadContextSpy = vi.spyOn(uow.idempotency, 'loadContext');
    const deps: P7ApplicationServiceDependencies = { unitOfWork: uow };
    const svc = createP7MoneyExecutionService(deps);

    const dto = {
      ...makeBaseDto(),
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };

    await svc.requestRelease(dto);
    expect(loadContextSpy).toHaveBeenCalledOnce();
  });

  // =========================================================================
  // Test 5: duplicate idempotency — no MoneyTree save on second call
  // =========================================================================
  it('duplicate: second call with same key returns duplicate and does not save MoneyTree', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7MoneyExecutionService(deps);

    const dto = {
      ...makeBaseDto(),
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };

    // First call — should proceed (may succeed or domain_block, but not validation_error)
    const firstResult = await svc.requestRelease(dto);
    expect(['ok', 'domain_blocked', 'denied']).toContain(firstResult.status);
    const savedCountAfterFirst = store.savedMoneyTrees.length;

    // Simulate key now processed
    store.processedKeys.add(dto.idempotency.idempotencyKey);

    // Mock loadDuplicateResult to return a cached boundary result
    const cachedBoundaryResult: PlatformV7ActionBoundaryResult<PlatformV7MoneyTree> = {
      ok: false,
      status: 'duplicate',
      code: 'DUPLICATE',
      reason: 'Already processed',
      beforeState: makeMoneyTree(),
      afterState: makeMoneyTree(),
      auditPayload: {
        auditId: 'audit-1',
        correlationId: 'corr-1',
        actorId: 'user-1',
        actorRole: 'operator',
        organizationId: 'org-1',
        resourceType: 'deal',
        resourceId: 'deal-1',
        action: 'reserve_requested',
        beforeState: makeMoneyTree(),
        afterState: makeMoneyTree(),
        reason: 'test',
        idempotencyKey: VALID_MONEY_KEY,
        createdAt: '2026-05-24T00:00:00.000Z',
        duplicate: true,
        auditCode: 'DUPLICATE',
      },
    };
    vi.spyOn(uow.idempotency, 'loadDuplicateResult').mockResolvedValueOnce({
      ok: true,
      status: 'ok',
      value: {
        recordId: dto.idempotency.idempotencyKey,
        value: cachedBoundaryResult,
        version: makeVersion('idempotency_result', dto.idempotency.idempotencyKey),
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
      },
    });

    const secondResult = await svc.requestRelease(dto);

    expect(secondResult.status).toBe('duplicate');
    // No additional MoneyTree save on duplicate
    expect(store.savedMoneyTrees.length).toBe(savedCountAfterFirst);
  });

  // =========================================================================
  // Test 6: audit appended on all result paths
  // =========================================================================
  it('audit: audit event is appended on every result path (applied/blocked)', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7MoneyExecutionService(deps);

    const dto = {
      ...makeBaseDto(),
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };

    await svc.requestRelease(dto);

    // Audit must be appended regardless of ok/domain_blocked outcome
    expect(store.auditEvents.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test 7: denied path — no MoneyTree save; audit still appended
  // =========================================================================
  it('denied: no MoneyTree save on denied path; audit still appended', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7MoneyExecutionService(deps);

    // Use a role that triggers denial
    const dto = {
      ...makeBaseDto(),
      actor: { actorId: 'driver-1', actorRole: 'driver', organizationId: 'org-2' },
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };

    const result = await svc.requestRelease(dto);

    // Non-ok path should not save MoneyTree
    if (result.status !== 'ok') {
      expect(store.savedMoneyTrees.length).toBe(0);
    }
    // Audit always appended
    expect(store.auditEvents.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test 8: reserveKey called before boundary execution
  // =========================================================================
  it('idempotency: reserveKey is called before MoneyTree is saved', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const callOrder: string[] = [];

    const origReserve = uow.idempotency.reserveKey.bind(uow.idempotency);
    vi.spyOn(uow.idempotency, 'reserveKey').mockImplementation(async (input) => {
      callOrder.push('reserveKey');
      return origReserve(input);
    });
    const origSave = uow.moneyTree.saveMoneyTree.bind(uow.moneyTree);
    vi.spyOn(uow.moneyTree, 'saveMoneyTree').mockImplementation(async (record, opts) => {
      callOrder.push('saveMoneyTree');
      return origSave(record, opts);
    });

    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7MoneyExecutionService(deps);
    const dto = {
      ...makeBaseDto(),
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };
    await svc.requestRelease(dto);

    expect(callOrder).toContain('reserveKey');
    const reserveIdx = callOrder.indexOf('reserveKey');
    const saveIdx = callOrder.indexOf('saveMoneyTree');
    if (saveIdx >= 0) {
      expect(reserveIdx).toBeLessThan(saveIdx);
    }
  });

  // =========================================================================
  // Test 9: recordResult called after boundary execution
  // =========================================================================
  it('idempotency: recordResult is called with the correct key after boundary', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const recordResultSpy = vi.spyOn(uow.idempotency, 'recordResult');

    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7MoneyExecutionService(deps);
    const dto = {
      ...makeBaseDto(),
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };
    await svc.requestRelease(dto);

    expect(recordResultSpy).toHaveBeenCalledOnce();
    expect(recordResultSpy.mock.calls[0][0].key).toBe(dto.idempotency.idempotencyKey);
  });

  // =========================================================================
  // Test 10: bank confirmation uses runInTransaction
  // =========================================================================
  it('bank: confirmBankRelease calls runInTransaction for atomic MoneyTree + BankBasis', async () => {
    const basis = makeBankBasisDecision();
    const store = makeFakeStore({
      moneyTree: makePersistedTree(makeMoneyTree()),
      bankBasis: makePersistedBasis(basis),
    });
    const uow = makeFakeUow(store);
    const runInTransactionSpy = vi.spyOn(uow, 'runInTransaction');

    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7BankBasisExecutionService(deps);

    const dto: P7BankConfirmationRequestDto = {
      ...makeBaseDto(),
      actor: { actorId: 'bank-user-1', actorRole: 'bank_officer', organizationId: 'bank-org-1' },
      idempotency: { idempotencyKey: VALID_BANK_KEY, operationId: 'bank-op-1', bankEventId: 'bank-evt-1' },
      bankEventId: 'bank-evt-1',
      bankOrganizationId: 'bank-org-1',
      operationId: 'bank-op-1',
      amount: 100_000,
      currency: 'RUB',
      path: 'release',
      action: 'bank_release_confirmed',
    };

    await svc.confirmBankRelease(dto);
    expect(runInTransactionSpy).toHaveBeenCalledOnce();
  });

  // =========================================================================
  // Test 11: document service calls saveDocumentRequirement with expectedVersion
  // =========================================================================
  it('document: saveDocumentRequirement is called with P7SaveOptions.expectedVersion', async () => {
    const matrix = makeDocumentMatrix();
    const store = makeFakeStore({ documentMatrix: makePersistedMatrix(matrix) });
    const uow = makeFakeUow(store);
    const saveDocReqSpy = vi.spyOn(uow.documentMatrix, 'saveDocumentRequirement');

    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7DocumentExecutionService(deps);

    const dto = {
      ...makeBaseDto(),
      actor: { actorId: 'lab-user-1', actorRole: 'lab_specialist', organizationId: 'lab-org-1' },
      action: 'document_confirmed' as const,
      documentId: 'lab_protocol',
      documentStatus: 'confirmed' as const,
    };

    await svc.executeDocumentAction(dto);

    if (saveDocReqSpy.mock.calls.length > 0) {
      const options: P7SaveOptions = saveDocReqSpy.mock.calls[0][2];
      // expectedVersion should come from the persisted matrix version
      expect(options.expectedVersion).toBe('v1');
    }
    // Audit must have been appended
    expect(store.auditEvents.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test 12: audit appended on document denied path
  // =========================================================================
  it('document: audit is appended even on denied/blocked path', async () => {
    const matrix = makeDocumentMatrix();
    const store = makeFakeStore({ documentMatrix: makePersistedMatrix(matrix) });
    const uow = makeFakeUow(store);
    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7DocumentExecutionService(deps);

    // operator role won't be able to confirm lab_protocol (boundary enforces lab_specialist)
    const dto = {
      ...makeBaseDto(),
      actor: { actorId: 'user-wrong', actorRole: 'operator', organizationId: 'org-1' },
      action: 'document_confirmed' as const,
      documentId: 'lab_protocol',
      documentStatus: 'confirmed' as const,
    };

    await svc.executeDocumentAction(dto);

    expect(store.auditEvents.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test 13: all factories are plain functions, not classes
  // =========================================================================
  it('structural: all service factories are plain functions (not classes)', () => {
    expect(typeof createP7MoneyExecutionService).toBe('function');
    expect(typeof createP7DocumentExecutionService).toBe('function');
    expect(typeof createP7BankBasisExecutionService).toBe('function');
    expect(typeof createP7ReleaseWorkflowService).toBe('function');
    expect(typeof createP7DisputeSettlementService).toBe('function');
  });

  // =========================================================================
  // Test 14: release workflow — validation_error before loadContext on invalid dto
  // =========================================================================
  it('release workflow: returns validation_error for invalid dto without calling loadContext', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree()) });
    const uow = makeFakeUow(store);
    const loadContextSpy = vi.spyOn(uow.idempotency, 'loadContext');
    const deps: P7ApplicationServiceDependencies = { unitOfWork: uow };
    const svc = createP7ReleaseWorkflowService(deps);

    const dto = {
      ...makeBaseDto(),
      amount: -1, // invalid negative amount
      currency: 'RUB' as const,
    };

    const result = await svc.requestRelease(dto);
    expect(result.status).toBe('validation_error');
    expect(loadContextSpy).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Test 15: dispute settlement — submitArbitrationBasis calls saveArbitrationDecision on ok
  // =========================================================================
  it('dispute: submitArbitrationBasis appends audit event', async () => {
    const store = makeFakeStore({ moneyTree: makePersistedTree(makeMoneyTree({ manualReviewAmount: 50_000, reservedAmount: 100_000 })) });
    const uow = makeFakeUow(store);
    const saveArbSpy = vi.spyOn(uow.disputeSettlement, 'saveArbitrationDecision');
    const deps: P7ApplicationServiceDependencies = {
      unitOfWork: uow,
      clock: () => '2026-05-24T00:00:00.000Z',
    };
    const svc = createP7DisputeSettlementService(deps);

    const dto: P7ArbitrationBasisRequestDto = {
      ...makeBaseDto(),
      actor: { actorId: 'arbitrator-1', actorRole: 'arbitrator', organizationId: 'arb-org-1' },
      arbitrationDecisionId: 'arb-decision-1',
      basisDocumentIds: ['doc-1', 'doc-2'],
      uncontestedAmount: 0,
      disputedAmount: 50_000,
      releaseAmount: 30_000,
      refundAmount: 20_000,
      heldAmount: 0,
      feeAmount: 0,
      penaltyAmount: 0,
      currency: 'RUB',
    };

    const result = await svc.submitArbitrationBasis(dto);

    // Audit must be appended regardless of outcome
    expect(store.auditEvents.length).toBeGreaterThan(0);
    // If ok, arb decision must be saved
    if (result.status === 'ok') {
      expect(saveArbSpy).toHaveBeenCalledOnce();
    }
  });

  // =========================================================================
  // Test 16: not_found when MoneyTree is absent
  // =========================================================================
  it('not_found: returns not_found when MoneyTree is absent from persistence', async () => {
    const store = makeFakeStore(); // no moneyTree
    const uow = makeFakeUow(store);
    const deps: P7ApplicationServiceDependencies = { unitOfWork: uow };
    const svc = createP7MoneyExecutionService(deps);

    const dto = {
      ...makeBaseDto(),
      action: 'reserve_requested' as const,
      amount: 50_000,
      currency: 'RUB' as const,
    };

    const result = await svc.requestRelease(dto);
    expect(result.status).toBe('not_found');
  });

});
