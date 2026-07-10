import { RuntimePersistenceService } from './runtime-persistence.service';
import type {
  RuntimePersistenceRepository,
  RuntimePersistenceWriteInput,
  RuntimePersistenceWriteReceipt,
} from './runtime-persistence.repository';

const input: RuntimePersistenceWriteInput = {
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
  payload: { status: 'updated' },
};

describe('RuntimePersistenceService', () => {
  it('delegates the exact typed input once and returns the receipt unchanged', async () => {
    const receipt: RuntimePersistenceWriteReceipt = {
      status: 'persisted',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'fully_linked',
      recordId: 'record-1',
      outboxEntryId: 'outbox-1',
      auditEventId: 'audit-1',
      transactionAttemptId: 'attempt-1',
    };
    const repository: RuntimePersistenceRepository = {
      write: jest.fn().mockResolvedValue(receipt),
    };
    const service = new RuntimePersistenceService(repository);

    await expect(service.persist(input)).resolves.toBe(receipt);
    expect(repository.write).toHaveBeenCalledTimes(1);
    expect(repository.write).toHaveBeenCalledWith(input);
  });

  it('does not convert a fail-closed repository receipt into success', async () => {
    const disabledReceipt: RuntimePersistenceWriteReceipt = {
      status: 'failed',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'ready_to_persist',
      reasonCode: 'repository_not_enabled',
    };
    const repository: RuntimePersistenceRepository = {
      write: jest.fn().mockResolvedValue(disabledReceipt),
    };
    const service = new RuntimePersistenceService(repository);

    await expect(service.persist(input)).resolves.toBe(disabledReceipt);
  });

  it('propagates repository exceptions instead of swallowing them', async () => {
    const repository: RuntimePersistenceRepository = {
      write: jest.fn().mockRejectedValue(new Error('repository unavailable')),
    };
    const service = new RuntimePersistenceService(repository);

    await expect(service.persist(input)).rejects.toThrow('repository unavailable');
  });

  it('does not synthesize trusted evidence identifiers before delegation', async () => {
    const repository: RuntimePersistenceRepository = {
      write: jest.fn().mockResolvedValue({
        status: 'failed',
        runtimeSnapshotId: 'snapshot-1',
        idempotencyKey: 'idem-1',
        state: 'ready_to_persist',
        reasonCode: 'repository_not_enabled',
      }),
    };
    const service = new RuntimePersistenceService(repository);

    await service.persist(input);

    const delegated = (repository.write as jest.Mock).mock.calls[0][0];
    expect(delegated).toBe(input);
    expect(delegated).not.toHaveProperty('outboxEntryId');
    expect(delegated).not.toHaveProperty('auditEventId');
  });
});
