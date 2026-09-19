import type { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RuntimePersistenceModule } from './runtime-persistence.module';
import {
  RUNTIME_PERSISTENCE_REPOSITORY,
  type RuntimePersistenceRepository,
  type RuntimePersistenceWriteInput,
  type RuntimePersistenceWriteReceipt,
} from './runtime-persistence.repository';
import { RuntimePersistenceService } from './runtime-persistence.service';

const CANONICAL_RUNTIME_TEST_DEAL: RuntimePersistenceWriteInput = {
  runtimeSnapshotId: 'runtime-snapshot:deal-canonical-001:start_document_review:v1',
  idempotencyKey: 'runtime-persistence:deal-canonical-001:start_document_review:v1',
  transactionId: 'runtime-transaction:deal-canonical-001:start_document_review:v1',
  dealId: 'deal-canonical-001',
  intentId: 'start_document_review',
  snapshotState: 'updated',
  statusLabel: 'document_review_started',
  runtimeStoreRecordId: 'runtime-store:deal-canonical-001:start_document_review:v1',
  runtimeStoreVersion: 'v1',
  actorId: 'operator-canonical-001',
  actorRole: 'operator',
  tenantId: 'tenant-canonical-001',
  organizationId: 'organization-canonical-001',
  correlationId: 'correlation-canonical-001',
  auditId: 'audit-canonical-001',
  contractHash: 'sha256:canonical-runtime-contract-001',
  payload: {
    dealId: 'deal-canonical-001',
    intentId: 'start_document_review',
    state: 'updated',
  },
};

const PERSISTED_RECEIPT: RuntimePersistenceWriteReceipt = {
  status: 'persisted',
  runtimeSnapshotId: CANONICAL_RUNTIME_TEST_DEAL.runtimeSnapshotId,
  idempotencyKey: CANONICAL_RUNTIME_TEST_DEAL.idempotencyKey,
  state: 'fully_linked',
  recordId: 'runtime-record-canonical-001',
  outboxEntryId: 'outbox-canonical-001',
  auditEventId: 'audit-canonical-001',
  transactionAttemptId: 'attempt-canonical-001',
};

function repositoryFixture(overrides: Partial<RuntimePersistenceRepository> = {}) {
  return {
    write: jest.fn().mockResolvedValue(PERSISTED_RECEIPT),
    writeWithinTransaction: jest.fn().mockResolvedValue(PERSISTED_RECEIPT),
    classifyExistingWithinTransaction: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as RuntimePersistenceRepository;
}

describe('RuntimePersistenceService', () => {
  it('delegates the compatibility path exactly once and returns the receipt unchanged', async () => {
    const repository = repositoryFixture();
    const service = new RuntimePersistenceService(repository);

    await expect(service.persist(CANONICAL_RUNTIME_TEST_DEAL)).resolves.toBe(PERSISTED_RECEIPT);
    expect(repository.write).toHaveBeenCalledTimes(1);
    expect(repository.write).toHaveBeenCalledWith(CANONICAL_RUNTIME_TEST_DEAL);
    expect(CANONICAL_RUNTIME_TEST_DEAL).not.toHaveProperty('outboxEntryId');
    expect(CANONICAL_RUNTIME_TEST_DEAL).not.toHaveProperty('auditEventId');
  });

  it('delegates transaction-bound persistence on the exact supplied client', async () => {
    const repository = repositoryFixture();
    const service = new RuntimePersistenceService(repository);
    const tx = { trusted: true } as unknown as Prisma.TransactionClient;

    await expect(
      service.persistWithinTransaction(tx, CANONICAL_RUNTIME_TEST_DEAL),
    ).resolves.toBe(PERSISTED_RECEIPT);
    expect(repository.writeWithinTransaction).toHaveBeenCalledWith(
      tx,
      CANONICAL_RUNTIME_TEST_DEAL,
    );
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('delegates concurrent-winner classification on the exact supplied client', async () => {
    const duplicate = { ...PERSISTED_RECEIPT, status: 'duplicate' as const };
    const repository = repositoryFixture({
      classifyExistingWithinTransaction: jest.fn().mockResolvedValue(duplicate),
    });
    const service = new RuntimePersistenceService(repository);
    const tx = { trusted: true } as unknown as Prisma.TransactionClient;

    await expect(
      service.classifyExistingWithinTransaction(tx, CANONICAL_RUNTIME_TEST_DEAL),
    ).resolves.toBe(duplicate);
    expect(repository.classifyExistingWithinTransaction).toHaveBeenCalledWith(
      tx,
      CANONICAL_RUNTIME_TEST_DEAL,
    );
  });

  it('keeps a disabled repository receipt failed', async () => {
    const failedReceipt: RuntimePersistenceWriteReceipt = {
      status: 'failed',
      runtimeSnapshotId: CANONICAL_RUNTIME_TEST_DEAL.runtimeSnapshotId,
      idempotencyKey: CANONICAL_RUNTIME_TEST_DEAL.idempotencyKey,
      state: 'ready_to_persist',
      reasonCode: 'repository_not_enabled',
    };
    const repository = repositoryFixture({
      write: jest.fn().mockResolvedValue(failedReceipt),
    });
    const service = new RuntimePersistenceService(repository);

    await expect(service.persist(CANONICAL_RUNTIME_TEST_DEAL)).resolves.toBe(failedReceipt);
  });

  it('propagates transaction repository exceptions for the owning boundary to classify', async () => {
    const repository = repositoryFixture({
      writeWithinTransaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
    });
    const service = new RuntimePersistenceService(repository);
    const tx = {} as Prisma.TransactionClient;

    await expect(
      service.persistWithinTransaction(tx, CANONICAL_RUNTIME_TEST_DEAL),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('RuntimePersistenceModule', () => {
  const originalMode = process.env.PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY;
    } else {
      process.env.PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY = originalMode;
    }
  });

  it('has no controller or public route', () => {
    expect(Reflect.getMetadata('controllers', RuntimePersistenceModule) ?? []).toEqual([]);
  });

  it('resolves the internal service and remains fail-closed by default', async () => {
    delete process.env.PLATFORM_V7_RUNTIME_PERSISTENCE_REPOSITORY;

    const moduleRef = await Test.createTestingModule({
      imports: [RuntimePersistenceModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const service = moduleRef.get(RuntimePersistenceService);
    const repository = moduleRef.get<RuntimePersistenceRepository>(RUNTIME_PERSISTENCE_REPOSITORY);

    expect(service).toBeDefined();
    expect(repository).toBeDefined();
    await expect(service.persist(CANONICAL_RUNTIME_TEST_DEAL)).resolves.toMatchObject({
      status: 'failed',
      state: 'ready_to_persist',
      reasonCode: 'repository_not_enabled',
    });
  });
});
