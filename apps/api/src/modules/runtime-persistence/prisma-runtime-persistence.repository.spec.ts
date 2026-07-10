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

function transactionFixture(existing: ReturnType<typeof existingSnapshot> | null = null) {
  const order: string[] = [];
  const queryRaw = jest.fn(async () => {
    order.push('rls-context');
    return [];
  });
  const findUnique = jest.fn(async () => {
    order.push('find-existing');
    return existing;
  });
  const outboxCreate = jest.fn(async () => {
    order.push('outbox');
    return { id: 'outbox-1' };
  });
  const auditCreate = jest.fn(async () => {
    order.push('audit');
    return { id: 'audit-1' };
  });
  const snapshotCreate = jest.fn(async () => {
    order.push('snapshot');
    return {
      id: 'record-1',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'fully_linked',
    };
  });
  const attemptCreate = jest.fn(async () => {
    order.push('attempt');
    return { id: 'attempt-1' };
  });
  const tx = {
    $queryRaw: queryRaw,
    outboxEntry: { create: outboxCreate },
    auditEvent: { create: auditCreate },
    dealWorkspaceRuntimeSnapshot: {
      findUnique,
      create: snapshotCreate,
    },
    dealWorkspaceRuntimeTransactionAttempt: { create: attemptCreate },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as any;

  return {
    prisma,
    tx,
    order,
    queryRaw,
    findUnique,
    outboxCreate,
    auditCreate,
    snapshotCreate,
    attemptCreate,
  };
}

describe('PrismaRuntimePersistenceRepository', () => {
  it('sets local RLS context before lookup and atomic evidence writes', async () => {
    const setup = transactionFixture();
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);
    const maliciousInput = {
      ...baseInput,
      outboxEntryId: 'caller-outbox-id',
      auditEventId: 'caller-audit-id',
    } as any;

    const receipt = await repository.write(maliciousInput);

    expect(setup.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(setup.queryRaw).toHaveBeenCalledTimes(1);
    expect(setup.order).toEqual([
      'rls-context',
      'find-existing',
      'outbox',
      'audit',
      'snapshot',
      'attempt',
    ]);
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

    const snapshotData = setup.snapshotCreate.mock.calls[0][0].data;
    expect(snapshotData.outboxEntryId).toBe('outbox-1');
    expect(snapshotData.auditEventId).toBe('audit-1');
    expect(snapshotData.outboxEntryId).not.toBe('caller-outbox-id');
    expect(snapshotData.auditEventId).not.toBe('caller-audit-id');

    const auditData = setup.auditCreate.mock.calls[0][0].data;
    expect(auditData.tenantId).toBe('tenant-1');
    expect(auditData.orgId).toBe('org-1');
  });

  it('classifies deterministic duplicate inside the trusted RLS transaction', async () => {
    const setup = transactionFixture(existingSnapshot());
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);

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
    expect(setup.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(setup.order).toEqual(['rls-context', 'find-existing']);
    expect(setup.outboxCreate).not.toHaveBeenCalled();
  });

  it('classifies material identity conflict inside the trusted RLS transaction', async () => {
    const setup = transactionFixture(
      existingSnapshot({ runtimeSnapshotId: 'snapshot-other', contractHash: 'hash-other' }),
    );
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);

    const receipt = await repository.write(baseInput);

    expect(receipt.status).toBe('conflict');
    expect(receipt.reasonCode).toBe('material_identity_conflict');
    expect(setup.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(setup.order).toEqual(['rls-context', 'find-existing']);
  });

  it('re-reads a concurrent P2002 winner in a second trusted RLS transaction', async () => {
    const setup = transactionFixture(existingSnapshot());
    setup.prisma.$transaction = jest
      .fn()
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockImplementationOnce(async (callback: (client: typeof setup.tx) => unknown) => callback(setup.tx));
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);

    const receipt = await repository.write(baseInput);

    expect(receipt.status).toBe('duplicate');
    expect(setup.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(setup.queryRaw).toHaveBeenCalledTimes(1);
    expect(setup.findUnique).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['dealId', '   '],
    ['tenantId', ''],
    ['organizationId', undefined],
  ] as const)('returns invalid_input for missing %s without touching the database', async (field, value) => {
    const setup = transactionFixture();
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);

    const receipt = await repository.write({ ...baseInput, [field]: value });

    expect(receipt).toMatchObject({ status: 'failed', reasonCode: 'invalid_input' });
    expect(setup.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps staged writes uncommitted when a transaction step fails', async () => {
    const setup = transactionFixture();
    setup.auditCreate.mockRejectedValueOnce(new Error('sensitive database failure'));
    const repository = new PrismaRuntimePersistenceRepository(setup.prisma);

    const receipt = await repository.write(baseInput);

    expect(receipt).toEqual({
      status: 'failed',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'ready_to_persist',
      reasonCode: 'database_write_failed',
    });
    expect(setup.order).toEqual(['rls-context', 'find-existing', 'outbox', 'audit']);
    expect(setup.snapshotCreate).not.toHaveBeenCalled();
    expect(setup.attemptCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(receipt)).not.toContain('sensitive database failure');
  });
});
