import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlatformV7ActionBoundaryResult } from '@/lib/platform-v7/action-boundary';
import type { P7BankBasisDecision, P7BankConfirmationEvent } from '@/lib/platform-v7/bank-basis';
import type { PlatformV7DocumentMatrix, PlatformV7DocumentRequirement } from '@/lib/platform-v7/document-matrix';
import type { PlatformV7MoneyTree } from '@/lib/platform-v7/money-tree';
import { createP7MockRuntimeStore } from '@/lib/platform-v7/runtime/mock-persistence-adapter';
import type {
  P7ActionExecutionRecord,
  P7BankConfirmationRecord,
  P7PersistedRecord,
  P7ResourceVersion,
  P7RuntimeError,
  P7SettlementSplitRecord,
} from '@/lib/platform-v7/runtime/persistence-ports';

const now = '2026-05-24T12:00:00.000Z';
const transactionError: P7RuntimeError = { code: 'transaction_error', message: 'rollback' };

function version(resourceType: string, resourceId: string, value = 'v1'): P7ResourceVersion {
  return { resourceType, resourceId, version: value, updatedAt: now };
}

const moneyTree: PlatformV7MoneyTree = {
  dealId: 'deal-1',
  currency: 'RUB',
  totalDealAmount: 1000,
  reservedAmount: 1000,
  readyToReleaseAmount: 1000,
  heldAmount: 0,
  manualReviewAmount: 0,
  releasedAmount: 0,
  refundedAmount: 0,
  platformFee: 0,
  bankFee: 0,
  status: 'reserved',
};

function moneyRecord(value: PlatformV7MoneyTree = moneyTree): P7PersistedRecord<PlatformV7MoneyTree> {
  return {
    recordId: `money:${value.dealId}`,
    dealId: value.dealId,
    value,
    version: version('money_tree', value.dealId),
    createdAt: now,
    updatedAt: now,
  };
}

const document: PlatformV7DocumentRequirement = {
  documentId: 'contract',
  dealId: 'deal-1',
  type: 'contract',
  title: 'Договор',
  ownerRole: 'seller',
  responsibleRole: 'seller',
  status: 'draft',
  source: 'edo',
  deadline: null,
  signatureStatus: 'not_required',
  blockStages: ['release'],
  affectsMoney: true,
  nextAction: 'Upload contract.',
  createdAt: now,
  updatedAt: now,
};

function matrixRecord(doc: PlatformV7DocumentRequirement = document): P7PersistedRecord<PlatformV7DocumentMatrix> {
  return {
    recordId: `matrix:${doc.dealId}`,
    dealId: doc.dealId,
    value: { dealId: doc.dealId, documents: [doc] },
    version: version('document_matrix', doc.dealId),
    createdAt: now,
    updatedAt: now,
  };
}

const bankDecision: P7BankBasisDecision = {
  dealId: 'deal-1',
  status: 'sent_to_bank',
  canSendToBank: false,
  blockerCodes: [],
  basisDocumentIds: ['contract'],
  amount: 1000,
  currency: 'RUB',
  correlationId: 'corr-1',
  auditId: 'audit-1',
  note: 'Sent for bank review.',
};

function bankDecisionRecord(value: P7BankBasisDecision = bankDecision): P7PersistedRecord<P7BankBasisDecision> {
  return {
    recordId: `bank:${value.dealId}`,
    dealId: value.dealId,
    value,
    version: version('bank_basis', value.dealId),
    createdAt: now,
    updatedAt: now,
  };
}

const saveOptions = {
  correlationId: 'corr-1',
  auditId: 'audit-1',
  actorId: 'operator-1',
};

const duplicateResult: PlatformV7ActionBoundaryResult<PlatformV7MoneyTree> = {
  ok: true,
  status: 'applied',
  code: 'OK',
  reason: 'Applied.',
  beforeState: moneyTree,
  afterState: { ...moneyTree, releasedAmount: 1000, readyToReleaseAmount: 0, status: 'released' },
  auditPayload: {
    auditId: 'audit-duplicate',
    correlationId: 'corr-1',
    actorId: 'bank-user-1',
    actorRole: 'bank_officer',
    organizationId: 'org-bank',
    resourceType: 'money',
    resourceId: 'money-deal-1',
    action: 'release_confirmed',
    beforeState: moneyTree,
    afterState: { ...moneyTree, releasedAmount: 1000, readyToReleaseAmount: 0, status: 'released' },
    reason: 'Applied.',
    idempotencyKey: 'idem-1',
    createdAt: now,
    duplicate: false,
    auditCode: 'OK',
  },
};

describe('createP7MockRuntimeStore', () => {
  it('creates isolated stores from separate seeds', async () => {
    const first = createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord()] });
    const second = createP7MockRuntimeStore({ now });

    const firstLoad = await first.moneyTree.loadByDealId('deal-1');
    const secondLoad = await second.moneyTree.loadByDealId('deal-1');

    expect(firstLoad.ok).toBe(true);
    expect(secondLoad.status).toBe('not_found');
  });

  it('loads and saves MoneyTree with a version update', async () => {
    const store = createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord()] });
    const loaded = await store.moneyTree.loadByDealId('deal-1');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const saved = await store.moneyTree.saveMoneyTree(
      { ...loaded.value, value: { ...loaded.value.value, heldAmount: 100 } },
      { ...saveOptions, expectedVersion: loaded.value.version.version },
    );

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.value.heldAmount).toBe(100);
    expect(saved.value.version.version).not.toBe(loaded.value.version.version);
  });

  it('returns conflict when expectedVersion does not match', async () => {
    const store = createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord()] });
    const result = await store.moneyTree.saveMoneyTree(
      moneyRecord({ ...moneyTree, heldAmount: 50 }),
      { ...saveOptions, expectedVersion: 'wrong-version' },
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe('conflict');
  });

  it('loads and saves Document Matrix and document requirements', async () => {
    const store = createP7MockRuntimeStore({ now, documentMatrices: [matrixRecord()] });
    const uploaded = { ...document, status: 'uploaded' as const };

    const requirement = await store.documentMatrix.saveDocumentRequirement('deal-1', uploaded, saveOptions);
    const matrix = await store.documentMatrix.loadByDealId('deal-1');

    expect(requirement.ok).toBe(true);
    expect(matrix.ok).toBe(true);
    if (!matrix.ok) return;
    expect(matrix.value.value.documents[0]?.status).toBe('uploaded');
  });

  it('loads and saves Bank Basis decisions', async () => {
    const store = createP7MockRuntimeStore({ now, bankBasisDecisions: [bankDecisionRecord()] });
    const loaded = await store.bankBasis.loadByDealId('deal-1');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const saved = await store.bankBasis.saveBankBasisDecision(
      { ...loaded.value, value: { ...loaded.value.value, status: 'bank_confirmed' } },
      { ...saveOptions, expectedVersion: loaded.value.version.version },
    );

    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.value.status).toBe('bank_confirmed');
  });

  it('supports idempotency reserve and duplicate replay', async () => {
    const store = createP7MockRuntimeStore({ now });
    const scope = { dealId: 'deal-1', resourceType: 'money', resourceId: 'money-deal-1', actorId: 'bank-user-1', correlationId: 'corr-1' };

    const reserved = await store.idempotency.reserveKey({ key: 'idem-1', scope, correlationId: 'corr-1', bankEventId: 'bank-event-1' });
    const duplicateReserve = await store.idempotency.reserveKey({ key: 'idem-1', scope, correlationId: 'corr-1' });
    const recorded = await store.idempotency.recordResult({ key: 'idem-1', scope, result: duplicateResult, correlationId: 'corr-1', bankEventId: 'bank-event-1' });
    const replay = await store.idempotency.loadDuplicateResult('idem-1');

    expect(reserved.ok).toBe(true);
    expect(duplicateReserve.ok).toBe(false);
    expect(recorded.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.value.status).toBe('applied');
  });

  it('protects duplicate bankEventId on bank confirmation save', async () => {
    const store = createP7MockRuntimeStore({ now });
    const confirmation: P7BankConfirmationEvent<'release'> = {
      bankEventId: 'bank-event-1',
      idempotencyKey: 'idem-1',
      path: 'release',
      operationType: 'release_confirmed',
      amount: 1000,
      actorId: 'bank-user-1',
      actorRole: 'bank_officer',
      organizationId: 'org-bank',
      bankOrganizationId: 'org-bank',
      bankReference: 'bank-ref-1',
      confirmedAt: now,
      auditId: 'audit-1',
      correlationId: 'corr-1',
    };
    const record: P7PersistedRecord<P7BankConfirmationRecord> = {
      recordId: 'bank-confirmation-1',
      dealId: 'deal-1',
      value: { decision: bankDecision, confirmation },
      version: version('bank_confirmation', 'bank-confirmation-1'),
      createdAt: now,
      updatedAt: now,
    };

    const first = await store.bankBasis.saveBankConfirmation(record, saveOptions);
    const second = await store.bankBasis.saveBankConfirmation({ ...record, recordId: 'bank-confirmation-2' }, saveOptions);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.status).toBe('error');
  });

  it('supports audit append and appendMany with lookup by correlation/resource', async () => {
    const store = createP7MockRuntimeStore({ now });
    const payload = duplicateResult.auditPayload;

    const one = await store.audit.append(payload);
    const many = await store.audit.appendMany([{ ...payload, auditId: 'audit-2' }]);
    const byCorrelation = await store.audit.listByCorrelationId('corr-1');
    const byResource = await store.audit.listByResource('money', 'money-deal-1');

    expect(one.ok).toBe(true);
    expect(many.ok).toBe(true);
    expect(byCorrelation.ok).toBe(true);
    expect(byResource.ok).toBe(true);
    if (!byCorrelation.ok || !byResource.ok) return;
    expect(byCorrelation.value).toHaveLength(2);
    expect(byResource.value).toHaveLength(2);
  });

  it('supports runInTransaction success', async () => {
    const store = createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord()] });
    const result = await store.runInTransaction(async (ports) => {
      const loaded = await ports.moneyTree.loadByDealId('deal-1');
      if (!loaded.ok) return { ok: false, error: transactionError };
      const saved = await ports.moneyTree.saveMoneyTree(
        { ...loaded.value, value: { ...loaded.value.value, heldAmount: 200 } },
        { ...saveOptions, transaction: ports.transaction, expectedVersion: loaded.value.version.version },
      );
      if (!saved.ok) return { ok: false, error: transactionError };
      return { ok: true, value: saved.value.value.heldAmount };
    });
    const loaded = await store.moneyTree.loadByDealId('deal-1');

    expect(result.ok).toBe(true);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.value.heldAmount).toBe(200);
  });

  it('rolls back runInTransaction on failed result', async () => {
    const store = createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord()] });
    const result = await store.runInTransaction(async (ports) => {
      const loaded = await ports.moneyTree.loadByDealId('deal-1');
      if (!loaded.ok) return { ok: false, error: transactionError };
      await ports.moneyTree.saveMoneyTree(
        { ...loaded.value, value: { ...loaded.value.value, heldAmount: 300 } },
        { ...saveOptions, transaction: ports.transaction, expectedVersion: loaded.value.version.version },
      );
      return { ok: false, error: transactionError };
    });
    const loaded = await store.moneyTree.loadByDealId('deal-1');

    expect(result.ok).toBe(false);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.value.heldAmount).toBe(0);
  });

  it('saves action executions, external calls and settlement records', async () => {
    const store = createP7MockRuntimeStore({ now });
    const action: P7PersistedRecord<P7ActionExecutionRecord> = {
      recordId: 'action-1',
      dealId: 'deal-1',
      value: {
        actionId: 'action-1',
        dealId: 'deal-1',
        resourceType: 'money',
        resourceId: 'money-deal-1',
        action: 'release_confirmed',
        status: 'allowed',
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
        auditId: 'audit-1',
      },
      version: version('action_execution', 'action-1'),
      createdAt: now,
      updatedAt: now,
    };
    const settlement: P7PersistedRecord<P7SettlementSplitRecord> = {
      recordId: 'settlement-1',
      dealId: 'deal-1',
      value: {
        settlementSplitId: 'settlement-1',
        dealId: 'deal-1',
        disputedAmount: 100,
        releaseAmount: 900,
        refundAmount: 0,
        heldAmount: 100,
        currency: 'RUB',
        correlationId: 'corr-1',
        auditId: 'audit-1',
      },
      version: version('settlement_split', 'deal-1'),
      createdAt: now,
      updatedAt: now,
    };

    const savedAction = await store.actionExecution.saveActionExecution(action, saveOptions);
    const listedActions = await store.actionExecution.listByDealId('deal-1');
    const savedSettlement = await store.disputeSettlement.saveSettlementSplit(settlement, saveOptions);

    expect(savedAction.ok).toBe(true);
    expect(listedActions.ok).toBe(true);
    expect(savedSettlement.ok).toBe(true);
    if (!listedActions.ok) return;
    expect(listedActions.value).toHaveLength(1);
  });

  it('has no shared state after explicit reset', async () => {
    const store = createP7MockRuntimeStore({ now, moneyTrees: [moneyRecord()] });
    expect((await store.moneyTree.loadByDealId('deal-1')).ok).toBe(true);
    store.reset({ now });
    expect((await store.moneyTree.loadByDealId('deal-1')).status).toBe('not_found');
  });

  it('does not use module-level fake persistence state', () => {
    const source = readFileSync(join(process.cwd(), 'apps/web/lib/platform-v7/runtime/mock-persistence-adapter.ts'), 'utf8');

    expect(source).not.toMatch(/^const\s+\w+\s*=\s*new\s+(Map|Set)\b/m);
    expect(source).not.toMatch(/^let\s+\w+\s*=\s*new\s+(Map|Set)\b/m);
    expect(source).not.toContain('globalThis');
    expect(source).not.toContain('hidden singleton');
  });
});
