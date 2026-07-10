import type { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { PrismaRuntimePersistenceRepository } from './prisma-runtime-persistence.repository';
import { selectRuntimePersistenceRepository } from './runtime-persistence-repository.factory';
import {
  DisabledRuntimePersistenceRepository,
  type RuntimePersistenceWriteInput,
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
  actorRole: 'SUPPORT_MANAGER',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  correlationId: 'corr-1',
  auditId: 'audit-business-1',
  contractHash: 'hash-1',
  payload: { status: 'updated' },
};

describe('runtime persistence repository selection', () => {
  it('defaults to a fail-closed disabled repository', async () => {
    const repository = selectRuntimePersistenceRepository(undefined, undefined);

    expect(repository).toBeInstanceOf(DisabledRuntimePersistenceRepository);
    await expect(repository.write(input)).resolves.toEqual({
      status: 'failed',
      runtimeSnapshotId: 'snapshot-1',
      idempotencyKey: 'idem-1',
      state: 'ready_to_persist',
      reasonCode: 'repository_not_enabled',
    });
  });

  it('does not treat unrelated values as Prisma activation', () => {
    const rls = {} as RlsTransactionService;

    expect(selectRuntimePersistenceRepository(rls, 'true')).toBeInstanceOf(
      DisabledRuntimePersistenceRepository,
    );
    expect(selectRuntimePersistenceRepository(rls, 'postgres')).toBeInstanceOf(
      DisabledRuntimePersistenceRepository,
    );
  });

  it('selects Prisma only for exact prisma mode with trusted RLS service', () => {
    const rls = {} as RlsTransactionService;

    expect(selectRuntimePersistenceRepository(rls, 'prisma')).toBeInstanceOf(
      PrismaRuntimePersistenceRepository,
    );
  });

  it('fails loudly when Prisma mode is enabled without trusted RLS service', () => {
    expect(() => selectRuntimePersistenceRepository(undefined, 'prisma')).toThrow(
      /requires RlsTransactionService/,
    );
  });
});
