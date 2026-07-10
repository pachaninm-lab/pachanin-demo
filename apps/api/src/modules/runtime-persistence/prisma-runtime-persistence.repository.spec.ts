import { PrismaRuntimePersistenceRepository } from './prisma-runtime-persistence.repository';
import type { RuntimePersistenceWriteInput } from './runtime-persistence.repository';

const baseInput: RuntimePersistenceWriteInput = {
  runtimeSnapshotId: 'snapshot-1',
  idempotencyKey: 'idem-1',
  transactionId: 'tx-1',
  dealId: 'deal-1',
  intentId: 'intent-1',
  snapshotState: 'updated',
  statusLabel: 'Updated',
  runtimeStoreRecordId: 'runtime-record-1',
  runtimeStoreVersion: '1',
  actorId: 'user-1',
  actorRole: 'operator',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  correlationId: 'corr-1',
  auditId: 'audit-business-1',
  contractHash: 'hash-1',
  payload: { status: 'updated', amountKopecks: 1000 },
};

function existingSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'record-1',
    runtimeSnapshotId: 'snapshot-1',
    idempotencyKey: 'idem-1',
    contractHash: 'hash-1',
    state: 'fully_linked',
    outboxEntryId: 'outbox-1',
    auditEventId: 'audit-1',
    attempts: [{ id: 'attempt-1' }],
    ...overrides,
  };
}

function successfulPrisma() {
  const outboxCreate = jest.fn().mockResolvedValue({ id: 'outbox-1' });
  const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
  const snapshotCreate = jest.fn().mockResolvedValue({
    id: 'record-1',
    runtimeSnapshotId: 'snapshot-1',
    idempotencyKey: 'idem-1',
    state: 'fully_linked',
  });
  const attemptCreate = jest.fn().mockResolvedValue({ id: 'attempt-1' });
  const tx = {
    outboxEntry: { create: outboxCreate },
    auditEvent: { create: auditCreate },
    dealWorkspaceRuntimeSnapshot: { create: snapshotCreate },
    dealWorkspaceRuntimeTransactionAttempt: { create: attemptCreate },
  };
  const prisma = {
    dealWorkspaceRuntimeSnapshot: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as any;

  return {
    prisma,
    outboxCreate,
    auditCreate,
    snapshotCreate,
    attemptCreate,
  };
}

describe('PrismaRuntimePersistenceRepository', () => {
  it('persists outbox, audit, snapshot and committed attempt in one transaction', async () => {
    const setup = successfulPrisma();
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);
    const maliciousInput = {
      ...baseInput,
      outboxEntryId: 'caller-outbox-id',
      auditEventId: 'caller-audit-id',
    } as any;

    const receipt = await repository.write(maliciousInput);

    expect(setup.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(receipt).toEqual({
      status: 'persisted',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'fully_linked',
      recordId: 'record-1',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
      transactionAttemptId: 'attempt-1',
    });

    expect(setup.outboxCreate).toHaveBeenCalledTimes(1);
    expect(setup.auditCreate).toHaveBeenCalledTimes(1);
    expect(setup.snapshotCreate).toHaveBeenCalledTimes(1);
    expect(setup.attemptCreate).toHaveBeenCalledTimes(1);

    const snapshotData = setup.snapshotCreate.mock.calls[0][0].data;
    expect(snapshotData.state).toBe('fully_linked');
    expect(snapshotData.outboxEntryId).toBe('outbox-1');
    expect(snapshotData.auditEventId).toBe('audit-1');
    expect(snapshotData.outboxEntryId).not.toBe('caller-outbox-id');
    expect(snapshotData.auditEventId).not.toBe('caller-audit-id');

    const outboxData = setup.outboxCreate.mock.calls[0][0].data;
    const auditData = setup.auditCreate.mock.calls[0][0].data;
    expect(outboxData.runtimeSnapshotId).toBe('snapshot-1');
    expect(auditData.runtimeSnapshotId).toBe('snapshot-1');
    expect(auditData.tenantId).toBe('tenant-1');
    expect(auditData.orgId).toBe('org-1');
  });

  it('returns deterministic duplicate without starting a transaction', async () => {
    const prisma = {
      dealWorkspaceRuntimeSnapshot: {
        findUnique: jest.fn().mockResolvedValue(existingSnapshot()),
      },
      $transaction: jest.fn(),
    } as any;
    const repository = new PrismaRuntimePersistenceRepository(prisma);

    await expect(repository.write(baseInput)).resolves.toEqual({
      status: 'duplicate',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'fully_linked',
      recordId: 'record-1',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
      transactionAttemptId: 'attempt-1',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns conflict for a reused idempotency key with another material identity', async () => {
    const prisma = {
      dealWorkspaceRuntimeSnapshot: {
        findUnique: jest.fn().mockResolvedValue(
          existingSnapshot({ runtimeSnapshotId: 'snapshot-other', contractHash: 'hash-other' }),
        ),
      },
      $transaction: jest.fn(),
    } as any;
    const repository = new PrismaRuntimePersistenceRepository(prisma);

    const receipt = await repository.write(baseInput);

    expect(receipt.status).toBe('conflict');
    expect(receipt.reasonCode).toBe('material_identity_conflict');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('classifies a concurrent P2002 winner as duplicate without a second transaction', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingSnapshot());
    const prisma = {
      dealWorkspaceRuntimeSnapshot: { findUnique },
      $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
    } as any;
    const repository = new PrismaRuntimePersistenceRepository(prisma);

    const receipt = await repository.write(baseInput);

    expect(receipt.status).toBe('duplicate');
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns invalid_input without touching the database', async () => {
    const setup = successfulPrisma();
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);

    const receipt = await repository.write({ ...baseInput, dealId: '   ' });

    expect(receipt).toMatchObject({ status: 'failed', reasonCode: 'invalid_input' });
    expect(setup.prisma.dealWorkspaceRuntimeSnapshot.findUnique).not.toHaveBeenCalled();
    expect(setup.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps staged writes uncommitted when a transaction step fails', async () => {
    const committed: string[] = [];
    const outboxCreate = jest.fn(async () => ({ id: 'outbox-stage' }));
    const auditCreate = jest.fn(async () => {
      throw new Error('sensitive database failure');
    });
    const snapshotCreate = jest.fn();
    const attemptCreate = jest.fn();
    const tx = {
      outboxEntry: { create: outboxCreate },
      auditEvent: { create: auditCreate },
      dealWorkspaceRuntimeSnapshot: { create: snapshotCreate },
      dealWorkspaceRuntimeTransactionAttempt: { create: attemptCreate },
    };
    const prisma = {
      dealWorkspaceRuntimeSnapshot: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => {
        const result = await callback(tx);
        committed.push('transaction-committed');
        return result;
      }),
    } as any;
    const repository = new PrismaRuntimePersistenceRepository(prisma);

    const receipt = await repository.write(baseInput);

    expect(receipt).toEqual({
      status: 'failed',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'ready_to_persist',
      reasonCode: 'database_write_failed',
    });
    expect(committed).toEqual([]);
    expect(outboxCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(snapshotCreate).not.toHaveBeenCalled();
    expect(attemptCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(receipt)).not.toContain('sensitive database failure');
  });
});
