import { PrismaService } from '../../src/common/prisma/prisma.service';
import { DurableOutboxWorker } from '../../src/modules/integration-events/durable-outbox.worker';

/**
 * Durable outbox worker — concurrency and retry semantics on real PostgreSQL.
 *
 * Proves:
 *  - two workers claiming concurrently never receive the same entry
 *    (FOR UPDATE SKIP LOCKED);
 *  - a failed delivery retries with backoff, then parks in DEAD_LETTER;
 *  - a crashed worker's lease expires and the entry is reclaimed;
 *  - receipts (CONFIRMED rows written by command transactions) are never claimed;
 *  - re-drive returns a dead-lettered entry to the queue.
 */

jest.setTimeout(120_000);

const TYPE = 'industrial.e2e.test';
const FOREIGN_DEFER_UNTIL = new Date('2099-01-01T00:00:00.000Z');

let prismaA: PrismaService;
let prismaB: PrismaService;
let workerA: DurableOutboxWorker;
let workerB: DurableOutboxWorker;

const deferredForeignRows = new Map<string, Date>();

async function deferForeignDueEntries(): Promise<void> {
  const foreign = await prismaA.outboxEntry.findMany({
    where: {
      type: { not: { startsWith: 'industrial.e2e' } },
      status: 'PENDING',
      nextRetryAt: { lte: new Date() },
    },
    select: { id: true, nextRetryAt: true },
  });
  for (const row of foreign) {
    if (!deferredForeignRows.has(row.id)) deferredForeignRows.set(row.id, row.nextRetryAt);
  }
  if (foreign.length > 0) {
    await prismaA.outboxEntry.updateMany({
      where: { id: { in: foreign.map((row) => row.id) }, status: 'PENDING' },
      data: { nextRetryAt: FOREIGN_DEFER_UNTIL },
    });
  }
}

async function restoreForeignSchedules(): Promise<void> {
  for (const [id, nextRetryAt] of deferredForeignRows) {
    await prismaA.outboxEntry.updateMany({
      where: { id, status: 'PENDING', nextRetryAt: FOREIGN_DEFER_UNTIL },
      data: { nextRetryAt },
    });
  }
  deferredForeignRows.clear();
}

async function purge(): Promise<void> {
  await prismaA.outboxEntry.deleteMany({ where: { type: { startsWith: 'industrial.e2e' } } });
  await deferForeignDueEntries();
}

async function seedEntries(count: number, overrides: Record<string, unknown> = {}): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const entry = await prismaA.outboxEntry.create({
      data: {
        type: TYPE,
        status: 'PENDING',
        payload: { seq: i },
        nextRetryAt: new Date(Date.now() - 1000),
        maxRetries: 3,
        ...overrides,
      },
    });
    ids.push(entry.id);
  }
  return ids;
}

beforeAll(async () => {
  prismaA = new PrismaService();
  prismaB = new PrismaService();
  await prismaA.$connect();
  await prismaB.$connect();
  workerA = new DurableOutboxWorker(prismaA);
  workerB = new DurableOutboxWorker(prismaB);
  await purge();
});

afterAll(async () => {
  await prismaA.outboxEntry.deleteMany({ where: { type: { startsWith: 'industrial.e2e' } } });
  await restoreForeignSchedules();
  await prismaA.$disconnect();
  await prismaB.$disconnect();
});

describe('DurableOutboxWorker on real PostgreSQL', () => {
  it('two concurrent workers claim disjoint batches (FOR UPDATE SKIP LOCKED)', async () => {
    await purge();
    const ids = await seedEntries(20);

    const [batchA, batchB] = await Promise.all([
      workerA.claimBatch('worker-a', 15),
      workerB.claimBatch('worker-b', 15),
    ]);

    const claimedIds = [...batchA, ...batchB].map((entry) => entry.id);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(new Set(claimedIds)).toEqual(new Set(ids));

    const processing = await prismaA.outboxEntry.findMany({
      where: { id: { in: ids } },
      select: { status: true, leaseOwner: true, leaseExpiresAt: true },
    });
    for (const row of processing) {
      expect(row.status).toBe('PROCESSING');
      expect(['worker-a', 'worker-b']).toContain(row.leaseOwner);
      expect(row.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('never claims receipts written by command transactions', async () => {
    await purge();
    await prismaA.outboxEntry.create({
      data: {
        type: 'industrial.e2e.receipt',
        status: 'CONFIRMED',
        payload: { result: { ok: true } },
        idempotencyKey: 'receipt-test-one',
        confirmedAt: new Date(),
      },
    });
    const claimed = await workerA.claimBatch('worker-a', 10);
    expect(claimed).toHaveLength(0);
  });

  it('delivers via a registered handler, retries failures with backoff, then dead-letters and re-drives', async () => {
    await purge();
    const [id] = await seedEntries(1);

    let attempts = 0;
    workerA.registerHandler(TYPE, async () => {
      attempts += 1;
      throw new Error(`provider unavailable (attempt ${attempts})`);
    });

    let report = await workerA.drainOnce('worker-a', 10);
    expect(report).toMatchObject({ claimed: 1, delivered: 0, retried: 1, deadLettered: 0 });
    let row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('PENDING');
    expect(row.retryCount).toBe(1);
    expect(row.lastError).toContain('provider unavailable');
    expect(row.nextRetryAt.getTime()).toBeGreaterThan(Date.now());

    await prismaA.outboxEntry.update({ where: { id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
    report = await workerA.drainOnce('worker-a', 10);
    expect(report.retried).toBe(1);

    await prismaA.outboxEntry.update({ where: { id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
    report = await workerA.drainOnce('worker-a', 10);
    expect(report.deadLettered).toBe(1);
    row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('DEAD_LETTER');
    expect(row.deadLetterAt).not.toBeNull();

    expect(await workerA.claimBatch('worker-a', 10)).toHaveLength(0);

    expect(await workerA.redrive(id)).toBe(true);
    workerA.registerHandler(TYPE, async () => undefined);
    report = await workerA.drainOnce('worker-a', 10);
    expect(report.delivered).toBe(1);
    row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('SENT');
    expect(row.sentAt).not.toBeNull();
  });

  it('reclaims entries from a crashed worker after lease expiry', async () => {
    await purge();
    const [id] = await seedEntries(1);

    const claimed = await workerA.claimBatch('worker-a', 10, 1);
    expect(claimed.map((entry) => entry.id)).toEqual([id]);

    expect(await workerB.claimBatch('worker-b', 10)).toHaveLength(0);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const reclaimed = await workerB.claimBatch('worker-b', 10);
    expect(reclaimed.map((entry) => entry.id)).toEqual([id]);
    await workerB.markDelivered('worker-b', id);
    const row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('SENT');

    await workerA.markDelivered('worker-a', id);
    const after = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe('SENT');
  });

  it('exposes queue depth by status for alerting', async () => {
    await purge();
    await seedEntries(3);
    const stats = await workerA.queueStats();
    expect(stats.PENDING).toBeGreaterThanOrEqual(3);
  });
});
