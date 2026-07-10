import { OutboxRepository, type DurableOutboxEntry } from './outbox.repository';
import { OutboxService } from './outbox.service';

function row(overrides: Partial<DurableOutboxEntry> = {}): DurableOutboxEntry {
  return {
    id: 'outbox-1',
    type: 'BANK_RESERVE_REQUEST',
    dealId: 'DEAL-001',
    payload: { dealId: 'DEAL-001' },
    status: 'PENDING',
    idempotencyKey: 'reserve:DEAL-001',
    maxRetries: 5,
    retryCount: 0,
    nextRetryAt: new Date('2026-07-10T18:00:00.000Z'),
    lastError: null,
    correlationId: null,
    auditId: null,
    createdAt: new Date('2026-07-10T18:00:00.000Z'),
    sentAt: null,
    confirmedAt: null,
    failedAt: null,
    ...overrides,
  };
}

function setup() {
  const repository = {
    enqueue: jest.fn().mockResolvedValue(row()),
    findById: jest.fn().mockResolvedValue(row({ status: 'RETRY' })),
    getByDeal: jest.fn().mockResolvedValue([row()]),
    listByStatuses: jest.fn().mockResolvedValue([row()]),
    claimBatch: jest.fn().mockResolvedValue([]),
    completeClaim: jest.fn().mockResolvedValue(true),
    failClaim: jest.fn().mockResolvedValue({
      status: 'RETRY',
      retryCount: 1,
      nextRetryAt: new Date('2026-07-10T18:01:00.000Z'),
    }),
    confirmExternal: jest.fn().mockResolvedValue(row({ status: 'CONFIRMED', confirmedAt: new Date() })),
    markExternalFailure: jest.fn().mockResolvedValue(row({ status: 'MANUAL_REVIEW', failedAt: new Date() })),
    manualRequeue: jest.fn().mockResolvedValue(true),
    stats: jest.fn().mockResolvedValue({ pending: 1, processing: 0, retry: 0, dead: 0, manualReview: 0, oldestPendingAt: new Date() }),
  } as unknown as jest.Mocked<OutboxRepository>;
  return { repository, service: new OutboxService(repository) };
}

describe('OutboxService durable contract', () => {
  it('persists a PENDING entry and derives a stable key when absent', async () => {
    const { service, repository } = setup();
    const entry = await service.enqueue({
      type: 'BANK_RESERVE_REQUEST',
      dealId: 'DEAL-001',
      payload: { amountKopecks: 100_00 },
      triggeredByUserId: 'accounting-1',
    });
    expect(entry.status).toBe('PENDING');
    expect(repository.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: expect.stringMatching(/^outbox:BANK_RESERVE_REQUEST:DEAL-001:[a-f0-9]{64}$/),
      payload: expect.objectContaining({ triggeredByUserId: 'accounting-1' }),
    }));
  });

  it('delegates lease success and failure to claim-token guarded functions', async () => {
    const { service, repository } = setup();
    await expect(service.completeClaim('outbox-1', 'a'.repeat(64))).resolves.toBe(true);
    await expect(service.failClaim('outbox-1', 'b'.repeat(64), 'kafka_send_false', 'failed')).resolves.toMatchObject({
      status: 'RETRY',
      retryCount: 1,
    });
    expect(repository.completeClaim).toHaveBeenCalledWith('outbox-1', 'a'.repeat(64));
    expect(repository.failClaim).toHaveBeenCalledWith('outbox-1', 'b'.repeat(64), 'kafka_send_false', 'failed');
  });

  it('records external success or failure without pretending transport delivery', async () => {
    const { service, repository } = setup();
    await expect(service.confirm('outbox-1')).resolves.toMatchObject({ status: 'CONFIRMED' });
    await expect(service.markFailed('outbox-1', 'bank_rejected')).resolves.toMatchObject({ status: 'MANUAL_REVIEW' });
    expect(repository.confirmExternal).toHaveBeenCalledWith('outbox-1');
    expect(repository.markExternalFailure).toHaveBeenCalledWith('outbox-1', 'bank_rejected');
  });

  it('requires eligible durable state for manual requeue', async () => {
    const { service, repository } = setup();
    await expect(service.requeue('outbox-1', 'admin-1', 'reviewed')).resolves.toMatchObject({ status: 'RETRY' });
    repository.manualRequeue.mockResolvedValueOnce(false);
    await expect(service.requeue('outbox-2', 'admin-1', 'reviewed')).rejects.toThrow(/not eligible/i);
  });

  it('serves lists and metrics from PostgreSQL repository only', async () => {
    const { service, repository } = setup();
    await expect(service.listPending()).resolves.toHaveLength(1);
    await expect(service.getByDeal('DEAL-001')).resolves.toHaveLength(1);
    await expect(service.stats()).resolves.toMatchObject({ pending: 1, dead: 0 });
    expect(repository.listByStatuses).toHaveBeenCalledWith(['PENDING', 'PROCESSING', 'RETRY']);
    expect(repository.getByDeal).toHaveBeenCalledWith('DEAL-001');
  });
});
