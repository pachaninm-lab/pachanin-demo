import type { Prisma } from '@prisma/client';
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
  actorRole: 'SUPPORT_MANAGER',
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

function transactionFixture(existing: unknown = null) {
  const findUnique = jest.fn().mockResolvedValue(existing);
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
    dealWorkspaceRuntimeSnapshot: { findUnique, create: snapshotCreate },
    dealWorkspaceRuntimeTransactionAttempt: { create: attemptCreate },
  } as unknown as Prisma.TransactionClient;

  return { tx, findUnique, outboxCreate, auditCreate, snapshotCreate, attemptCreate };
}

function repositoryFixture() {
  const rootFindUnique = jest.fn();
  const transaction = jest.fn();
  const prisma = {
    dealWorkspaceRuntimeSnapshot: { findUnique: rootFindUnique },
    $transaction: transaction,
  } as any;
  return {
    rootFindUnique,
    transaction,
    repository: new PrismaRuntimePersistenceRepository(prisma),
  };
}

describe('PrismaRuntimePersistenceRepository trusted transaction path', () => {
  it('uses only the supplied transaction for lookup and all writes', async () => {
    const root = repositoryFixture();
    const test = transactionFixture();
    const maliciousInput = {
      ...baseInput,
      outboxEntryId: 'caller-outbox-id',
      auditEventId: 'caller-audit-id',
    } as any;

    const receipt = await root.repository.writeWithinTransaction(test.tx, maliciousInput);

    expect(root.transaction).not.toHaveBeenCalled();
    expect(root.rootFindUnique).not.toHaveBeenCalled();
    expect(test.findUnique).toHaveBeenCalledTimes(1);
    expect(test.outboxCreate).toHaveBeenCalledTimes(1);
    expect(test.auditCreate).toHaveBeenCalledTimes(1);
    expect(test.snapshotCreate).toHaveBeenCalledTimes(1);
    expect(test.attemptCreate).toHaveBeenCalledTimes(1);
    expect(receipt).toMatchObject({
      status: 'persisted',
      state: 'fully_linked',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
    });

    const snapshotData = (test.snapshotCreate as jest.Mock).mock.calls[0][0].data;
    expect(snapshotData.outboxEntryId).toBe('outbox-1');
    expect(snapshotData.auditEventId).toBe('audit-1');
    expect(snapshotData.outboxEntryId).not.toBe('caller-outbox-id');
    expect(snapshotData.auditEventId).not.toBe('caller-audit-id');
  });

  it('classifies a matching record as duplicate inside the supplied transaction', async () => {
    const root = repositoryFixture();
    const test = transactionFixture(existingSnapshot());

    await expect(root.repository.writeWithinTransaction(test.tx, baseInput)).resolves.toMatchObject({
      status: 'duplicate',
      recordId: 'record-1',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
    });
    expect(root.transaction).not.toHaveBeenCalled();
    expect(test.outboxCreate).not.toHaveBeenCalled();
  });

  it('classifies another material identity as conflict', async () => {
    const root = repositoryFixture();
    const test = transactionFixture(
      existingSnapshot({ runtimeSnapshotId: 'snapshot-other', contractHash: 'hash-other' }),
    );

    await expect(
      root.repository.classifyExistingWithinTransaction(test.tx, baseInput),
    ).resolves.toMatchObject({
      status: 'conflict',
      reasonCode: 'material_identity_conflict',
    });
  });

  it('returns null when no concurrent winner exists', async () => {
    const root = repositoryFixture();
    const test = transactionFixture(null);

    await expect(
      root.repository.classifyExistingWithinTransaction(test.tx, baseInput),
    ).resolves.toBeNull();
  });

  it.each([
    ['dealId', '   '],
    ['tenantId', ''],
    ['organizationId', ''],
  ] as const)('rejects missing %s before transaction database work', async (field, value) => {
    const root = repositoryFixture();
    const test = transactionFixture();

    await expect(
      root.repository.writeWithinTransaction(test.tx, { ...baseInput, [field]: value }),
    ).resolves.toMatchObject({ status: 'failed', reasonCode: 'invalid_input' });
    expect(test.findUnique).not.toHaveBeenCalled();
    expect(test.outboxCreate).not.toHaveBeenCalled();
  });

  it('propagates P2002 so the owning RLS transaction can rollback and reclassify', async () => {
    const root = repositoryFixture();
    const test = transactionFixture();
    (test.outboxCreate as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });

    await expect(root.repository.writeWithinTransaction(test.tx, baseInput)).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(test.auditCreate).not.toHaveBeenCalled();
    expect(test.snapshotCreate).not.toHaveBeenCalled();
    expect(test.attemptCreate).not.toHaveBeenCalled();
  });
});

describe('PrismaRuntimePersistenceRepository root path', () => {
  it('fails closed and never opens an untrusted root transaction', async () => {
    const root = repositoryFixture();

    await expect(root.repository.write(baseInput)).resolves.toEqual({
      status: 'failed',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'ready_to_persist',
      reasonCode: 'trusted_transaction_required',
    });
    expect(root.transaction).not.toHaveBeenCalled();
    expect(root.rootFindUnique).not.toHaveBeenCalled();
  });
});
