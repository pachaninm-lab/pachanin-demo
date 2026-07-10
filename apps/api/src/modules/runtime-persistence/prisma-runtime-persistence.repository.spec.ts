import type { Prisma } from '@prisma/client';
import type {
  RlsTransactionService,
  TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
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

const expectedContext: TrustedRlsContext = {
  userId: 'user-1',
  orgId: 'org-1',
  tenantId: 'tenant-1',
  role: 'SUPPORT_MANAGER',
  sessionId: 'runtime-persistence:corr-1',
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

function fixture(existing: ReturnType<typeof existingSnapshot> | null = null) {
  const order: string[] = [];
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
    dealWorkspaceRuntimeSnapshot: { findUnique, create: snapshotCreate },
    outboxEntry: { create: outboxCreate },
    auditEvent: { create: auditCreate },
    dealWorkspaceRuntimeTransactionAttempt: { create: attemptCreate },
  } as unknown as Prisma.TransactionClient;
  const withContext = jest.fn(
    async <T>(
      context: TrustedRlsContext,
      work: (client: Prisma.TransactionClient, trusted: TrustedRlsContext) => Promise<T>,
    ) => work(tx, context),
  );
  const rls = { withContext } as unknown as RlsTransactionService;

  return {
    repository: new PrismaRuntimePersistenceRepository(rls),
    rls,
    tx,
    order,
    withContext,
    findUnique,
    outboxCreate,
    auditCreate,
    snapshotCreate,
    attemptCreate,
  };
}

describe('PrismaRuntimePersistenceRepository trusted transaction binding', () => {
  it('performs lookup and atomic evidence writes through one trusted RLS callback', async () => {
    const test = fixture();
    const maliciousInput = {
      ...baseInput,
      outboxEntryId: 'caller-outbox-id',
      auditEventId: 'caller-audit-id',
    } as any;

    const receipt = await test.repository.write(maliciousInput);

    expect(test.withContext).toHaveBeenCalledTimes(1);
    expect(test.withContext.mock.calls[0][0]).toEqual(expectedContext);
    expect(test.order).toEqual(['find-existing', 'outbox', 'audit', 'snapshot', 'attempt']);
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

    const snapshotData = test.snapshotCreate.mock.calls[0][0].data;
    expect(snapshotData.outboxEntryId).toBe('outbox-1');
    expect(snapshotData.auditEventId).toBe('audit-1');
    expect(snapshotData.outboxEntryId).not.toBe('caller-outbox-id');
    expect(snapshotData.auditEventId).not.toBe('caller-audit-id');
  });

  it('returns duplicate inside the trusted transaction without evidence writes', async () => {
    const test = fixture(existingSnapshot());

    await expect(test.repository.write(baseInput)).resolves.toMatchObject({
      status: 'duplicate',
      recordId: 'record-1',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
    });
    expect(test.withContext).toHaveBeenCalledTimes(1);
    expect(test.order).toEqual(['find-existing']);
    expect(test.outboxCreate).not.toHaveBeenCalled();
  });

  it('returns conflict inside the trusted transaction without evidence writes', async () => {
    const test = fixture(
      existingSnapshot({ runtimeSnapshotId: 'snapshot-other', contractHash: 'hash-other' }),
    );

    await expect(test.repository.write(baseInput)).resolves.toMatchObject({
      status: 'conflict',
      reasonCode: 'material_identity_conflict',
    });
    expect(test.withContext).toHaveBeenCalledTimes(1);
    expect(test.order).toEqual(['find-existing']);
  });

  it('re-reads a concurrent P2002 winner through a second trusted transaction', async () => {
    const test = fixture(existingSnapshot());
    test.withContext
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockImplementationOnce(async (context, work) => work(test.tx, context));

    const receipt = await test.repository.write(baseInput);

    expect(receipt.status).toBe('duplicate');
    expect(test.withContext).toHaveBeenCalledTimes(2);
    expect(test.withContext.mock.calls[1][0]).toEqual(expectedContext);
    expect(test.findUnique).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['dealId', '   '],
    ['tenantId', ''],
    ['organizationId', undefined],
  ] as const)('rejects missing %s before opening an RLS transaction', async (field, value) => {
    const test = fixture();

    await expect(test.repository.write({ ...baseInput, [field]: value })).resolves.toMatchObject({
      status: 'failed',
      reasonCode: 'invalid_input',
    });
    expect(test.withContext).not.toHaveBeenCalled();
  });

  it('returns sanitized failure when an atomic transaction step fails', async () => {
    const test = fixture();
    test.auditCreate.mockRejectedValueOnce(new Error('sensitive database failure'));

    const receipt = await test.repository.write(baseInput);

    expect(receipt).toEqual({
      status: 'failed',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'ready_to_persist',
      reasonCode: 'database_write_failed',
    });
    expect(test.order).toEqual(['find-existing', 'outbox', 'audit']);
    expect(test.snapshotCreate).not.toHaveBeenCalled();
    expect(test.attemptCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(receipt)).not.toContain('sensitive database failure');
  });
});
