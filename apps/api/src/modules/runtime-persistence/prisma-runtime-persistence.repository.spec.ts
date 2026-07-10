import {
  PrismaRuntimePersistenceRepository,
  RuntimePersistencePrismaClient,
  RuntimePersistencePrismaTransaction,
} from './prisma-runtime-persistence.repository';
import {
  RuntimePersistenceStoredRecord,
  RuntimePersistenceWriteError,
  RuntimePersistenceWriteInput,
} from './runtime-persistence.repository';

function input(overrides: Partial<RuntimePersistenceWriteInput> = {}): RuntimePersistenceWriteInput {
  return {
    runtimeSnapshotId: 'runtime-snapshot-1',
    idempotencyKey: 'idem-1',
    dealId: 'deal-1',
    intentId: 'start_document_review',
    snapshotState: 'updated',
    statusLabel: 'ok',
    runtimeStoreRecordId: 'store-1',
    runtimeStoreVersion: 'v1',
    actorId: 'operator-1',
    actorRole: 'operator',
    correlationId: 'corr-1',
    auditId: 'audit-1',
    contractHash: 'hash-1',
    payload: { state: 'updated' },
    ...overrides,
  };
}

function stored(source = input()): RuntimePersistenceStoredRecord {
  return {
    id: 'snapshot-row-1',
    runtimeSnapshotId: source.runtimeSnapshotId,
    idempotencyKey: source.idempotencyKey,
    dealId: source.dealId,
    intentId: source.intentId,
    state: 'fully_linked',
    snapshotState: source.snapshotState,
    statusLabel: source.statusLabel,
    runtimeStoreRecordId: source.runtimeStoreRecordId,
    runtimeStoreVersion: source.runtimeStoreVersion,
    actorId: source.actorId,
    actorRole: source.actorRole,
    correlationId: source.correlationId,
    auditId: source.auditId,
    contractHash: source.contractHash,
    payload: source.payload,
    outboxEntryId: 'outbox-1',
    auditEventId: source.auditId,
    version: 1,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  };
}

function fixture(existing: RuntimePersistenceStoredRecord | null = null) {
  const snapshotFindUnique = jest.fn().mockResolvedValue(existing);
  const outboxCreate = jest.fn().mockResolvedValue({ id: 'outbox-1' });
  const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
  const snapshotCreate = jest.fn().mockImplementation(async ({ data }) => stored({ ...input(), ...data }));
  const attemptCreate = jest.fn().mockResolvedValue({ id: 'attempt-1' });

  const transaction: RuntimePersistencePrismaTransaction = {
    dealWorkspaceRuntimeSnapshot: {
      findUnique: snapshotFindUnique,
      create: snapshotCreate,
    },
    outboxEntry: { create: outboxCreate },
    auditEvent: { create: auditCreate },
    dealWorkspaceRuntimeTransactionAttempt: { create: attemptCreate },
  };

  const prisma: RuntimePersistencePrismaClient = {
    $transaction: jest.fn(async (callback) => callback(transaction)),
    dealWorkspaceRuntimeSnapshot: { findUnique: snapshotFindUnique },
  };

  return {
    repository: new PrismaRuntimePersistenceRepository(prisma),
    prisma,
    snapshotFindUnique,
    outboxCreate,
    auditCreate,
    snapshotCreate,
    attemptCreate,
  };
}

describe('PrismaRuntimePersistenceRepository', () => {
  it('writes outbox, audit, fully-linked snapshot and committed attempt in one transaction', async () => {
    const test = fixture();
    const result = await test.repository.write(input());

    expect(test.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(test.outboxCreate).toHaveBeenCalledTimes(1);
    expect(test.auditCreate).toHaveBeenCalledTimes(1);
    expect(test.snapshotCreate).toHaveBeenCalledTimes(1);
    expect(test.attemptCreate).toHaveBeenCalledTimes(1);
    expect(test.snapshotCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'fully_linked',
        outboxEntryId: 'outbox-1',
        auditEventId: 'audit-1',
      }),
    }));
    expect(result).toMatchObject({
      status: 'persisted',
      state: 'fully_linked',
      recordId: 'snapshot-row-1',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
    });
  });

  it('returns duplicate without creating additional rows', async () => {
    const original = input();
    const test = fixture(stored(original));
    const result = await test.repository.write(original);

    expect(result.status).toBe('duplicate');
    expect(test.outboxCreate).not.toHaveBeenCalled();
    expect(test.auditCreate).not.toHaveBeenCalled();
    expect(test.snapshotCreate).not.toHaveBeenCalled();
    expect(test.attemptCreate).not.toHaveBeenCalled();
  });

  it('returns conflict on material identity mismatch without creating rows', async () => {
    const test = fixture(stored(input({ contractHash: 'hash-existing' })));
    const result = await test.repository.write(input({ contractHash: 'hash-new' }));

    expect(result).toMatchObject({
      status: 'conflict',
      conflictCode: 'MATERIAL_IDENTITY_MISMATCH',
    });
    expect(test.outboxCreate).not.toHaveBeenCalled();
    expect(test.auditCreate).not.toHaveBeenCalled();
    expect(test.snapshotCreate).not.toHaveBeenCalled();
    expect(test.attemptCreate).not.toHaveBeenCalled();
  });

  it('sanitizes database errors and relies on transaction rollback for zero partial evidence', async () => {
    const test = fixture();
    (test.prisma.$transaction as jest.Mock).mockRejectedValueOnce(new Error('postgres password leaked'));

    await expect(test.repository.write(input())).rejects.toEqual(
      expect.objectContaining({
        name: 'RuntimePersistenceWriteError',
        code: 'RUNTIME_PERSISTENCE_WRITE_FAILED',
        message: 'Runtime persistence write failed.',
      }),
    );
    await expect(test.repository.write(input())).resolves.toBeDefined();
    expect(new RuntimePersistenceWriteError().message).not.toContain('postgres');
  });
});
