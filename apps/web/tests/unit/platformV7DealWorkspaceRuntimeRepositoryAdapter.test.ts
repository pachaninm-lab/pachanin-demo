import { describe, expect, it } from 'vitest';
import { buildP7DealWorkspaceRuntimeDbContract } from '@/lib/platform-v7/deal-workspace-runtime-db-contract';
import {
  buildP7DealWorkspaceRuntimeRepositoryReceipt,
  createP7DealWorkspaceRuntimeRepository,
} from '@/lib/platform-v7/deal-workspace-runtime-db-repository';
import { buildP7DealWorkspaceRuntimeRefreshSnapshot } from '@/lib/platform-v7/deal-workspace-runtime-snapshot';
import type { P7DealWorkspaceRuntimeStoreReceipt } from '@/lib/platform-v7/deal-workspace-runtime-store';

function receipt(dealId = 'DL-REPO-1'): P7DealWorkspaceRuntimeStoreReceipt {
  return {
    recordId: `${dealId}:start_document_review:p7-runtime-store-v1`,
    dealId,
    intentId: 'start_document_review',
    version: 'p7-runtime-store-v1',
    savedAt: '2026-07-09T12:00:00.000Z',
    maturity: 'manual-process-runtime-store',
    historyCount: 1,
  };
}

function contract(idempotencyKey = 'idem-repo-1', dealId = 'DL-REPO-1') {
  const snapshot = buildP7DealWorkspaceRuntimeRefreshSnapshot({
    dealId,
    intentId: 'start_document_review',
    ok: true,
    status: 'ok',
    duplicate: false,
    auditPayloadCount: 2,
    boundaryStatus: 'allowed',
  });

  return buildP7DealWorkspaceRuntimeDbContract({
    snapshot,
    receipt: receipt(dealId),
    actorId: 'operator-1',
    actorRole: 'operator',
    correlationId: `corr-${dealId}`,
    auditId: `audit-${dealId}`,
    idempotencyKey,
    createdAt: '2026-07-09T12:00:00.000Z',
  });
}

describe('VP-3 runtime persistence repository adapter', () => {
  it('builds a typed receipt from the DB contract without claiming live DB persistence', () => {
    const dbContract = contract('idem-receipt-1', 'DL-REPO-RECEIPT');

    const repositoryReceipt = buildP7DealWorkspaceRuntimeRepositoryReceipt({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-1', auditEventId: 'audit-event-1' },
      savedAt: '2026-07-09T12:05:00.000Z',
    });

    expect(repositoryReceipt.recordId).toBe('p7-runtime-db:p7-runtime-snapshot:DL-REPO-RECEIPT:start_document_review:p7-runtime-store-v1');
    expect(repositoryReceipt.runtimeSnapshotId).toBe(dbContract.runtimeSnapshotId);
    expect(repositoryReceipt.idempotencyKey).toBe('idem-receipt-1');
    expect(repositoryReceipt.state).toBe('fully_linked');
    expect(repositoryReceipt.savedAt).toBe('2026-07-09T12:05:00.000Z');
    expect(repositoryReceipt.outboxEntryId).toBe('outbox-1');
    expect(repositoryReceipt.auditEventId).toBe('audit-event-1');
    expect(repositoryReceipt.status).toBe('persisted');
    expect(repositoryReceipt.maturity).toBe('repository-contract-adapter');
  });

  it('blocks fully_linked when outbox or audit linkage is missing', () => {
    const dbContract = contract('idem-linkage-1', 'DL-REPO-LINKAGE');

    expect(buildP7DealWorkspaceRuntimeRepositoryReceipt({ contract: dbContract }).state).toBe('outbox_required');
    expect(buildP7DealWorkspaceRuntimeRepositoryReceipt({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-1' },
    }).state).toBe('audit_required');
    expect(buildP7DealWorkspaceRuntimeRepositoryReceipt({
      contract: dbContract,
      linkage: { auditEventId: 'audit-event-1' },
    }).state).toBe('outbox_required');
  });

  it('keeps the backward-compatible write path duplicate-safe without replacing evidence', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('idem-duplicate-1', 'DL-REPO-DUP');

    const first = repository.write({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-1', auditEventId: 'audit-event-1' },
      savedAt: '2026-07-09T12:06:00.000Z',
    });
    const duplicate = repository.write({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-2', auditEventId: 'audit-event-2' },
      savedAt: '2026-07-09T12:07:00.000Z',
    });

    expect(first.status).toBe('persisted');
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.recordId).toBe(first.recordId);
    expect(duplicate.outboxEntryId).toBe('outbox-1');
    expect(duplicate.auditEventId).toBe('audit-event-1');
    expect(repository.list()).toHaveLength(1);
  });

  it('monotonically promotes one hardened record without changing identity or creation time', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('idem-promote-1', 'DL-REPO-PROMOTE');

    const first = repository.writeHardened({
      contract: dbContract,
      savedAt: '2026-07-09T12:10:00.000Z',
    });
    const outboxLinked = repository.writeHardened({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-promote-1' },
      savedAt: '2026-07-09T12:11:00.000Z',
    });
    const fullyLinked = repository.writeHardened({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-promote-1', auditEventId: 'audit-promote-1' },
      savedAt: '2026-07-09T12:12:00.000Z',
    });

    expect(first.status).toBe('persisted');
    expect(first.state).toBe('outbox_required');
    expect(outboxLinked.status).toBe('promoted');
    expect(outboxLinked.state).toBe('audit_required');
    expect(fullyLinked.status).toBe('promoted');
    expect(fullyLinked.state).toBe('fully_linked');
    expect(outboxLinked.recordId).toBe(first.recordId);
    expect(fullyLinked.recordId).toBe(first.recordId);
    expect(outboxLinked.savedAt).toBe(first.savedAt);
    expect(fullyLinked.savedAt).toBe(first.savedAt);
    expect(repository.list()).toHaveLength(1);
  });

  it('never regresses a hardened record when replay has weaker linkage', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('idem-no-regress-1', 'DL-REPO-NO-REGRESS');

    repository.writeHardened({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-stable-1', auditEventId: 'audit-stable-1' },
    });
    const replay = repository.writeHardened({ contract: dbContract });

    expect(replay.status).toBe('duplicate');
    expect(replay.state).toBe('fully_linked');
    expect(replay.outboxEntryId).toBe('outbox-stable-1');
    expect(replay.auditEventId).toBe('audit-stable-1');
    expect(repository.list()).toHaveLength(1);
  });

  it('returns conflict when one idempotency key is reused for another runtime snapshot', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const firstContract = contract('idem-conflict-1', 'DL-REPO-CONFLICT-A');
    const conflictingContract = contract('idem-conflict-1', 'DL-REPO-CONFLICT-B');

    const first = repository.writeHardened({ contract: firstContract });
    const conflict = repository.writeHardened({ contract: conflictingContract });

    expect(first.status).toBe('persisted');
    expect(conflict.status).toBe('conflict');
    expect(conflict.conflictCode).toBe('IDEMPOTENCY_CONTRACT_MISMATCH');
    expect(conflict.recordId).toBe(first.recordId);
    expect(repository.list()).toHaveLength(1);
  });

  it('rejects replacement of an already accepted linkage id', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('idem-link-conflict-1', 'DL-REPO-LINK-CONFLICT');

    repository.writeHardened({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-original' },
    });
    const conflict = repository.writeHardened({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-replacement' },
    });

    expect(conflict.status).toBe('conflict');
    expect(conflict.conflictCode).toBe('OUTBOX_LINKAGE_CONFLICT');
    expect(conflict.outboxEntryId).toBe('outbox-original');
    expect(repository.list()).toHaveLength(1);
  });

  it('finds receipts by idempotency key through the explicit repository boundary', () => {
    const repository = createP7DealWorkspaceRuntimeRepository();
    const dbContract = contract('idem-find-1', 'DL-REPO-FIND');

    repository.write({
      contract: dbContract,
      linkage: { outboxEntryId: 'outbox-find-1' },
      savedAt: '2026-07-09T12:08:00.000Z',
    });

    const found = repository.findByIdempotencyKey('idem-find-1');
    expect(found?.state).toBe('audit_required');
    expect(found?.outboxEntryId).toBe('outbox-find-1');
    expect(repository.findByIdempotencyKey('missing')).toBeNull();
  });
});
