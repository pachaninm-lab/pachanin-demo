import { RuntimePersistenceService } from './runtime-persistence.service';
import type {
  RuntimePersistenceRepository,
  RuntimePersistenceWriteInput,
  RuntimePersistenceWriteReceipt,
} from './runtime-persistence.repository';

describe('RuntimePersistenceService', () => {
  it('delegates the exact server-side write contract to the selected repository', async () => {
    const receipt: RuntimePersistenceWriteReceipt = {
      status: 'persisted',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'fully_linked',
      recordId: 'record-1',
    };
    const repository: RuntimePersistenceRepository = {
      write: jest.fn().mockResolvedValue(receipt),
    };
    const service = new RuntimePersistenceService(repository);
    const input: RuntimePersistenceWriteInput = {
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      transactionId: 'tx-1',
      dealId: 'deal-1',
      intentId: 'intent-1',
      snapshotState: 'updated',
      statusLabel: 'updated',
      runtimeStoreRecordId: 'runtime-1',
      runtimeStoreVersion: '1',
      actorId: 'user-1',
      actorRole: 'SUPPORT_MANAGER',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      correlationId: 'corr-1',
      auditId: 'audit-1',
      contractHash: 'hash-1',
      payload: { ok: true },
    };

    await expect(service.write(input)).resolves.toEqual(receipt);
    expect(repository.write).toHaveBeenCalledTimes(1);
    expect(repository.write).toHaveBeenCalledWith(input);
  });
});
