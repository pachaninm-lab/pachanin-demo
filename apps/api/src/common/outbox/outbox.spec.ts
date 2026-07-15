import { OutboxService } from './outbox.service';

function makeRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-15T12:00:00.000Z');
  return {
    id: 'outbox-1',
    type: 'BANK_RESERVE_REQUEST',
    dealId: 'DEAL-001',
    payload: { amountKopecks: '10000' },
    status: 'PENDING',
    triggeredByUserId: 'user-1',
    idempotencyKey: 'reserve-1',
    maxRetries: 5,
    retryCount: 0,
    nextRetryAt: now,
    lastError: null,
    correlationId: 'corr-1',
    auditId: null,
    runtimeSnapshotId: null,
    runtimeIdempotencyKey: null,
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
    deadLetterAt: null,
    createdAt: now,
    sentAt: null,
    confirmedAt: null,
    failedAt: null,
    ...overrides,
  };
}

function makePrisma() {
  return {
    outboxEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    outboxRedriveEvent: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
}

describe('OutboxService — PostgreSQL authority', () => {
  it('persists a new PENDING entry and returns the database row', async () => {
    const prisma = makePrisma();
    prisma.outboxEntry.findUnique.mockResolvedValue(null);
    prisma.outboxEntry.create.mockResolvedValue(makeRow());
    const outbox = new OutboxService(prisma as any);

    const entry = await outbox.enqueue({
      type: 'BANK_RESERVE_REQUEST',
      dealId: 'DEAL-001',
      payload: { amountKopecks: '10000' },
      triggeredByUserId: 'user-1',
      idempotencyKey: 'reserve-1',
      correlationId: 'corr-1',
    });

    expect(entry).toMatchObject({
      id: 'outbox-1',
      status: 'PENDING',
      retryCount: 0,
      triggeredByUserId: 'user-1',
    });
    expect(prisma.outboxEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'BANK_RESERVE_REQUEST',
        dealId: 'DEAL-001',
        idempotencyKey: 'reserve-1',
      }),
    });
  });

  it('returns the durable idempotent row without creating a duplicate', async () => {
    const prisma = makePrisma();
    prisma.outboxEntry.findUnique.mockResolvedValue(makeRow());
    const outbox = new OutboxService(prisma as any);

    const entry = await outbox.enqueue({
      type: 'BANK_RESERVE_REQUEST',
      payload: {},
      idempotencyKey: 'reserve-1',
    });

    expect(entry.id).toBe('outbox-1');
    expect(prisma.outboxEntry.create).not.toHaveBeenCalled();
  });

  it('propagates PostgreSQL failure instead of falling back to process memory', async () => {
    const prisma = makePrisma();
    prisma.outboxEntry.findUnique.mockResolvedValue(null);
    prisma.outboxEntry.create.mockRejectedValue(new Error('postgres unavailable'));
    const outbox = new OutboxService(prisma as any);

    await expect(
      outbox.enqueue({ type: 'BANK_RESERVE_REQUEST', payload: {} }),
    ).rejects.toThrow('postgres unavailable');
  });

  it('confirms only a SENT row and treats a repeated confirmation as idempotent', async () => {
    const prisma = makePrisma();
    prisma.outboxEntry.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.outboxEntry.findUnique.mockResolvedValueOnce(
      makeRow({ status: 'CONFIRMED', confirmedAt: new Date('2026-07-15T12:01:00.000Z') }),
    );
    const outbox = new OutboxService(prisma as any);

    const confirmed = await outbox.confirm('outbox-1');
    expect(confirmed.status).toBe('CONFIRMED');

    prisma.outboxEntry.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.outboxEntry.findUnique.mockResolvedValueOnce(
      makeRow({ status: 'CONFIRMED', confirmedAt: new Date('2026-07-15T12:01:00.000Z') }),
    );
    await expect(outbox.confirm('outbox-1')).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('rejects confirmation from a non-terminal-delivery state', async () => {
    const prisma = makePrisma();
    prisma.outboxEntry.updateMany.mockResolvedValue({ count: 0 });
    prisma.outboxEntry.findUnique.mockResolvedValue(makeRow({ status: 'PENDING' }));
    const outbox = new OutboxService(prisma as any);

    await expect(outbox.confirm('outbox-1')).rejects.toThrow(
      'cannot be confirmed from status PENDING',
    );
  });

  it('reads queue statistics from PostgreSQL aggregation', async () => {
    const prisma = makePrisma();
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { status: 'PENDING', count: 3n },
        { status: 'PROCESSING', count: 2n },
        { status: 'SENT', count: 4n },
        { status: 'CONFIRMED', count: 5n },
        { status: 'DEAD_LETTER', count: 1n },
      ])
      .mockResolvedValueOnce([{ oldest_due_at: new Date('2026-07-15T11:59:00.000Z') }]);
    const outbox = new OutboxService(prisma as any);

    await expect(outbox.queueStats()).resolves.toEqual({
      total: 15,
      pending: 3,
      processing: 2,
      sent: 4,
      confirmed: 5,
      deadLetter: 1,
      manualReview: 0,
      oldestDueAt: '2026-07-15T11:59:00.000Z',
    });
  });

  it('lists entries asynchronously from PostgreSQL', async () => {
    const prisma = makePrisma();
    prisma.outboxEntry.findMany.mockResolvedValue([makeRow(), makeRow({ id: 'outbox-2' })]);
    const outbox = new OutboxService(prisma as any);

    const entries = await outbox.list(50);
    expect(entries.map((entry) => entry.id)).toEqual(['outbox-1', 'outbox-2']);
    expect(prisma.outboxEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});
