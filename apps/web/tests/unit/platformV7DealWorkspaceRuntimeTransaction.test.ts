import { describe, expect, it } from 'vitest';
import { buildP7DealWorkspaceRuntimeDbContract } from '@/lib/platform-v7/deal-workspace-runtime-db-contract';
import { createP7DealWorkspaceRuntimeRepository } from '@/lib/platform-v7/deal-workspace-runtime-db-repository';
import { buildP7DealWorkspaceRuntimeLinkage } from '@/lib/platform-v7/deal-workspace-runtime-linkage';
import { buildP7DealWorkspaceRuntimeRefreshSnapshot } from '@/lib/platform-v7/deal-workspace-runtime-snapshot';
import type { P7DealWorkspaceRuntimeStoreReceipt } from '@/lib/platform-v7/deal-workspace-runtime-store';
import { createP7DealWorkspaceRuntimeTransaction } from '@/lib/platform-v7/deal-workspace-runtime-transaction';

function runtimeStoreReceipt(dealId: string): P7DealWorkspaceRuntimeStoreReceipt {
  return {
    recordId: `${dealId}:start_document_review:p7-runtime-store-v1`,
    dealId,
    intentId: 'start_document_review',
    version: 'p7-runtime-store-v1',
    savedAt: '2026-07-10T05:00:00.000Z',
    maturity: 'manual-process-runtime-store',
    historyCount: 1,
  };
}

function contract(dealId = 'DL-TX-1', idempotencyKey = 'idem-tx-1') {
  return buildP7DealWorkspaceRuntimeDbContract({
    snapshot: buildP7DealWorkspaceRuntimeRefreshSnapshot({
      dealId,
      intentId: 'start_document_review',
      ok: true,
      status: 'success',
      duplicate: false,
      auditPayloadCount: 1,
      boundaryStatus: 'allowed',
    }),
    receipt: runtimeStoreReceipt(dealId),
    actorId: 'operator-tx-1',
    actorRole: 'operator',
    correlationId: `corr-${dealId}`,
    auditId: `audit-${dealId}`,
    idempotencyKey,
    createdAt: '2026-07-10T05:00:00.000Z',
  });
}

function outboxEvidence(dbContract = contract()) {
  return {
    entryId: 'outbox-tx-1',
    eventType: dbContract.outboxType,
    correlationId: dbContract.correlationId,
    idempotencyKey: dbContract.idempotencyKey,
    createdAt: '2026-07-10T05:00:01.000Z',
  };
}

function auditEvidence(dbContract = contract()) {
  return {
    eventId: 'audit-event-tx-1',
    action: dbContract.auditAction,
    correlationId: dbContract.correlationId,
    actorId: dbContract.actorId,
    createdAt: '2026-07-10T05:00:02.000Z',
  };
}

function transactionContext(dbContract = contract(), transactionId = 'tx-1') {
  return {
    transactionId,
    startedAt: '2026-07-10T05:00:00.000Z',
    correlationId: dbContract.correlationId,
    auditId: dbContract.auditId,
    actorId: dbContract.actorId,
  };
}

describe('VP-3.29 runtime persistence transaction coordinator', () => {
  it('requires prepare before commit and commits one hardened repository write', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract();
    const linkageResult = buildP7DealWorkspaceRuntimeLinkage({ contract: dbContract });
    const transaction = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult,
      transaction: transactionContext(dbContract),
      savedAt: '2026-07-10T05:00:03.000Z',
    });

    expect(transaction.current().stage).toBe('created');
    expect(transaction.prepare().stage).toBe('prepared');
    const committed = transaction.commit();

    expect(committed.stage).toBe('committed');
    expect(committed.repositoryReceipt?.status).toBe('persisted');
    expect(committed.repositoryReceipt?.state).toBe('outbox_required');
    expect(committed.maturity).toBe('contract-transaction-coordinator');
    expect(repository.list()).toHaveLength(1);
  });

  it('replays a committed transaction deterministically without a second write', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('DL-TX-REPLAY', 'idem-tx-replay');
    const transaction = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({ contract: dbContract }),
      transaction: transactionContext(dbContract, 'tx-replay'),
    });

    transaction.prepare();
    const firstCommit = transaction.commit();
    const replay = transaction.commit();

    expect(firstCommit.stage).toBe('committed');
    expect(replay.stage).toBe('committed');
    expect(replay.replay).toBe(true);
    expect(replay.repositoryReceipt?.recordId).toBe(firstCommit.repositoryReceipt?.recordId);
    expect(repository.list()).toHaveLength(1);
  });

  it('rolls back before commit without exposing a repository record', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('DL-TX-ROLLBACK', 'idem-tx-rollback');
    const transaction = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({ contract: dbContract }),
      transaction: transactionContext(dbContract, 'tx-rollback'),
    });

    transaction.prepare();
    const rolledBack = transaction.rollback('operator cancelled before commit');
    const commitAfterRollback = transaction.commit();

    expect(rolledBack.stage).toBe('rolled_back');
    expect(rolledBack.rollbackReason).toBe('operator cancelled before commit');
    expect(commitAfterRollback.stage).toBe('rolled_back');
    expect(commitAfterRollback.replay).toBe(true);
    expect(commitAfterRollback.repositoryReceipt).toBeUndefined();
    expect(repository.list()).toHaveLength(0);
  });

  it('fails preparation for invalid linkage and performs no write', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('DL-TX-INVALID', 'idem-tx-invalid');
    const invalidLinkage = buildP7DealWorkspaceRuntimeLinkage({
      contract: dbContract,
      outbox: { ...outboxEvidence(dbContract), correlationId: 'wrong-correlation' },
    });
    const transaction = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult: invalidLinkage,
      transaction: transactionContext(dbContract, 'tx-invalid'),
    });

    const prepared = transaction.prepare();
    const commit = transaction.commit();

    expect(prepared.stage).toBe('failed');
    expect(prepared.failure?.code).toBe('INVALID_LINKAGE');
    expect(commit.stage).toBe('failed');
    expect(commit.repositoryReceipt).toBeUndefined();
    expect(repository.list()).toHaveLength(0);
  });

  it('does not commit when transaction identity differs from the contract', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('DL-TX-CONTEXT', 'idem-tx-context');
    const transaction = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({ contract: dbContract }),
      transaction: { ...transactionContext(dbContract, 'tx-context'), correlationId: 'wrong-correlation' },
    });

    const prepared = transaction.prepare();

    expect(prepared.stage).toBe('failed');
    expect(prepared.failure?.code).toBe('TRANSACTION_CONTEXT_MISMATCH');
    expect(repository.list()).toHaveLength(0);
  });

  it('supports deterministic retry after a pre-commit failure without partial state', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('DL-TX-RETRY', 'idem-tx-retry');
    const linkageResult = buildP7DealWorkspaceRuntimeLinkage({ contract: dbContract });
    const failing = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult,
      transaction: transactionContext(dbContract, 'tx-retry-1'),
      beforeCommit: () => {
        throw new Error('transient pre-commit failure');
      },
    });

    failing.prepare();
    const failedCommit = failing.commit();
    expect(failedCommit.stage).toBe('failed');
    expect(failedCommit.failure?.code).toBe('COMMIT_ERROR');
    expect(failedCommit.repositoryReceipt).toBeUndefined();
    expect(repository.list()).toHaveLength(0);

    const retry = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult,
      transaction: transactionContext(dbContract, 'tx-retry-2'),
    });
    retry.prepare();
    const committed = retry.commit();

    expect(committed.stage).toBe('committed');
    expect(committed.repositoryReceipt?.status).toBe('persisted');
    expect(repository.list()).toHaveLength(1);
  });

  it('monotonically promotes the same record across hardened transactions', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('DL-TX-PROMOTE', 'idem-tx-promote');

    const first = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({ contract: dbContract }),
      transaction: transactionContext(dbContract, 'tx-promote-1'),
      savedAt: '2026-07-10T05:10:00.000Z',
    });
    first.prepare();
    const firstCommit = first.commit();

    const outbox = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({
        contract: dbContract,
        outbox: outboxEvidence(dbContract),
      }),
      transaction: transactionContext(dbContract, 'tx-promote-2'),
    });
    outbox.prepare();
    const outboxCommit = outbox.commit();

    const audit = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: dbContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({
        contract: dbContract,
        outbox: outboxEvidence(dbContract),
        audit: auditEvidence(dbContract),
      }),
      transaction: transactionContext(dbContract, 'tx-promote-3'),
    });
    audit.prepare();
    const auditCommit = audit.commit();

    expect(firstCommit.repositoryReceipt?.state).toBe('outbox_required');
    expect(outboxCommit.repositoryReceipt?.status).toBe('promoted');
    expect(outboxCommit.repositoryReceipt?.state).toBe('audit_required');
    expect(auditCommit.repositoryReceipt?.status).toBe('promoted');
    expect(auditCommit.repositoryReceipt?.state).toBe('fully_linked');
    expect(auditCommit.repositoryReceipt?.recordId).toBe(firstCommit.repositoryReceipt?.recordId);
    expect(auditCommit.repositoryReceipt?.savedAt).toBe(firstCommit.repositoryReceipt?.savedAt);
    expect(repository.list()).toHaveLength(1);
  });

  it('returns failed conflict instead of committing another contract under the same key', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const firstContract = contract('DL-TX-CONFLICT-A', 'idem-tx-conflict');
    const otherContract = contract('DL-TX-CONFLICT-B', 'idem-tx-conflict');

    const first = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: firstContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({ contract: firstContract }),
      transaction: transactionContext(firstContract, 'tx-conflict-1'),
    });
    first.prepare();
    first.commit();

    const conflict = createP7DealWorkspaceRuntimeTransaction({
      repository,
      contract: otherContract,
      linkageResult: buildP7DealWorkspaceRuntimeLinkage({ contract: otherContract }),
      transaction: transactionContext(otherContract, 'tx-conflict-2'),
    });
    conflict.prepare();
    const conflictResult = conflict.commit();

    expect(conflictResult.stage).toBe('failed');
    expect(conflictResult.failure?.code).toBe('REPOSITORY_CONFLICT');
    expect(conflictResult.repositoryReceipt?.status).toBe('conflict');
    expect(conflictResult.repositoryReceipt?.conflictCode).toBe('IDEMPOTENCY_CONTRACT_MISMATCH');
    expect(repository.list()).toHaveLength(1);
  });
});
