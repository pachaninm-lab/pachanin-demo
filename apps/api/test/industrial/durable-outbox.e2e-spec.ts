import { PrismaService } from '../../src/common/prisma/prisma.service';
import { OutboxService } from '../../src/common/outbox/outbox.service';
import {
  DurableOutboxWorker,
  OutboxDeliveryError,
  OutboxLeaseLostError,
} from '../../src/modules/integration-events/durable-outbox.worker';

jest.setTimeout(120_000);

const RUN_ID = `industrial.e2e.outbox.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const FOREIGN_DEFER_UNTIL = new Date('2099-01-01T00:00:00.000Z');

let prismaA: PrismaService;
let prismaB: PrismaService;
let workerA: DurableOutboxWorker;
let workerB: DurableOutboxWorker;
let outbox: OutboxService;

const deferredForeignRows = new Map<string, Date>();

async function deferForeignDueEntries(): Promise<void> {
  const foreign = await prismaA.outboxEntry.findMany({
    where: {
      type: { not: { startsWith: RUN_ID } },
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

async function seedEntries(
  testName: string,
  count: number,
  overrides: Record<string, unknown> = {},
): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const entry = await prismaA.outboxEntry.create({
      data: {
        type: `${RUN_ID}.${testName}`,
        status: 'PENDING',
        payload: { testName, index },
        nextRetryAt: new Date(Date.now() - 1_000),
        maxRetries: 3,
        idempotencyKey: `${RUN_ID}.${testName}.${index}`,
        ...overrides,
      },
    });
    ids.push(entry.id);
  }
  return ids;
}

async function deliverClaims(
  worker: DurableOutboxWorker,
  workerId: string,
  claims: Array<{ id: string; leaseToken: string }>,
): Promise<void> {
  for (const claim of claims) {
    await worker.markDelivered(workerId, claim.id, claim.leaseToken);
  }
}

beforeAll(async () => {
  prismaA = new PrismaService();
  prismaB = new PrismaService();
  await prismaA.$connect();
  await prismaB.$connect();
  workerA = new DurableOutboxWorker(prismaA);
  workerB = new DurableOutboxWorker(prismaB);
  outbox = new OutboxService(prismaA);
  await deferForeignDueEntries();
});

afterAll(async () => {
  await restoreForeignSchedules();
  await prismaA.$disconnect();
  await prismaB.$disconnect();
});

describe('IR-OUTBOX exact-head PostgreSQL 16 acceptance', () => {
  it('database-fences a legacy claim during the rolling migration window', async () => {
    const [id] = await seedEntries('legacy-claim-fence', 1);
    await prismaA.$executeRawUnsafe(`
      CREATE POLICY outbox_claim_protocol_acceptance
      ON public."outbox_entries"
      FOR ALL TO app_deal
      USING ("id" = current_setting('pc_crop.test_outbox_id', true))
      WITH CHECK ("id" = current_setting('pc_crop.test_outbox_id', true))
    `);

    try {
      await expect(prismaA.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('pc_crop.test_outbox_id', ${id}, true)::text`;
        await tx.$executeRawUnsafe('SET LOCAL ROLE app_deal');
        await tx.$executeRaw`
          UPDATE public."outbox_entries"
          SET "status" = 'PROCESSING',
              "leaseOwner" = 'legacy-worker',
              "leaseToken" = md5(random()::text),
              "leaseExpiresAt" = NOW() + interval '60 seconds',
              "heartbeatAt" = NOW()
          WHERE "id" = ${id}
        `;
      })).rejects.toThrow(/legacy outbox claim protocol is fenced/);

      const claimed = await prismaA.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('pc_crop.test_outbox_id', ${id}, true)::text`;
        await tx.$executeRawUnsafe('SET LOCAL ROLE app_deal');
        await tx.$executeRawUnsafe("SET LOCAL pc_crop.outbox_claim_protocol = '2'");
        return tx.$executeRaw`
          UPDATE public."outbox_entries"
          SET "status" = 'PROCESSING',
              "leaseOwner" = 'protocol-v2-worker',
              "leaseToken" = 'protocol-v2-token',
              "leaseExpiresAt" = NOW() + interval '60 seconds',
              "heartbeatAt" = NOW(),
              "lastAttemptAt" = NULL
          WHERE "id" = ${id}
        `;
      });
      expect(claimed).toBe(1);
    } finally {
      await prismaA.$executeRawUnsafe(`
        DROP POLICY IF EXISTS outbox_claim_protocol_acceptance
        ON public."outbox_entries"
      `);
    }

    await workerA.markDelivered('protocol-v2-worker', id, 'protocol-v2-token');
  });

  it('gives two concurrent workers disjoint tokenized claims', async () => {
    const ids = await seedEntries('two-workers', 20);

    const [batchA, batchB] = await Promise.all([
      workerA.claimBatch('worker-a', 15),
      workerB.claimBatch('worker-b', 15),
    ]);

    const all = [...batchA, ...batchB];
    const claimedIds = all.map((entry) => entry.id);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(new Set(claimedIds)).toEqual(new Set(ids));
    expect(all.every((entry) => entry.leaseToken.length > 0)).toBe(true);
    expect(new Set(all.map((entry) => entry.leaseToken)).size).toBe(all.length);

    await Promise.all([
      deliverClaims(workerA, 'worker-a', batchA),
      deliverClaims(workerB, 'worker-b', batchB),
    ]);
  });

  it('recovers an expired crash lease and rejects the stale token acknowledgement', async () => {
    const [id] = await seedEntries('crash-recovery', 1);
    const [first] = await workerA.claimBatch('worker-crashed', 1, 1);
    expect(first.id).toBe(id);

    expect(await workerB.claimBatch('worker-recovery', 1)).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 1_300));

    const [recovered] = await workerB.claimBatch('worker-recovery', 1, 60);
    expect(recovered.id).toBe(id);
    expect(recovered.leaseToken).not.toBe(first.leaseToken);

    await expect(
      workerA.markDelivered('worker-crashed', id, first.leaseToken),
    ).rejects.toBeInstanceOf(OutboxLeaseLostError);

    await workerB.markDelivered('worker-recovery', id, recovered.leaseToken);
    const row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('SENT');
  });

  it('renews a live lease with heartbeat and prevents premature reclaim', async () => {
    const [id] = await seedEntries('heartbeat', 1);
    const [claim] = await workerA.claimBatch('worker-heartbeat', 1, 1);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(await workerA.heartbeat('worker-heartbeat', id, claim.leaseToken, 2)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(await workerB.claimBatch('worker-other', 1)).toHaveLength(0);

    const row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.heartbeatAt).not.toBeNull();
    expect(row.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    await workerA.markDelivered('worker-heartbeat', id, claim.leaseToken);
  });

  it('parks an expired lease after attempt start instead of risking duplicate delivery', async () => {
    const [id] = await seedEntries('crash-after-attempt', 1);
    const [claim] = await workerA.claimBatch('worker-crash-after-attempt', 1, 1);
    await workerA.markAttemptStarted('worker-crash-after-attempt', id, claim.leaseToken);
    await new Promise((resolve) => setTimeout(resolve, 1_300));

    expect(await workerB.claimBatch('worker-safe-recovery', 1)).toHaveLength(0);
    const row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('MANUAL_REVIEW');
    expect(row.lastErrorCategory).toBe('AMBIGUOUS');
    expect(row.lastErrorCode).toBe('WORKER_CRASH_OUTCOME_UNKNOWN');
    expect(row.manualReviewAt).not.toBeNull();
  });

  it('retries with deterministic exponential backoff and parks at DEAD_LETTER', async () => {
    const type = `${RUN_ID}.retry-dead-letter`;
    const [id] = await seedEntries('retry-dead-letter', 1);
    workerA.registerHandler(type, async () => {
      throw new Error('provider unavailable');
    });

    const beforeFirst = Date.now();
    let report = await workerA.drainOnce('worker-retry', 1);
    expect(report).toMatchObject({ claimed: 1, delivered: 0, retried: 1, deadLettered: 0 });
    let row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('PENDING');
    expect(row.retryCount).toBe(1);
    expect(row.nextRetryAt.getTime()).toBeGreaterThanOrEqual(beforeFirst + 4_000);

    await prismaA.outboxEntry.update({ where: { id }, data: { nextRetryAt: new Date(Date.now() - 1_000) } });
    const beforeSecond = Date.now();
    report = await workerA.drainOnce('worker-retry', 1);
    expect(report.retried).toBe(1);
    row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.retryCount).toBe(2);
    expect(row.nextRetryAt.getTime()).toBeGreaterThanOrEqual(beforeSecond + 9_000);

    await prismaA.outboxEntry.update({ where: { id }, data: { nextRetryAt: new Date(Date.now() - 1_000) } });
    report = await workerA.drainOnce('worker-retry', 1);
    expect(report.deadLettered).toBe(1);
    row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('DEAD_LETTER');
    expect(row.deadLetterAt).not.toBeNull();
  });

  it('fails closed when no transport exists instead of marking the entry SENT', async () => {
    const [id] = await seedEntries('disabled-transport', 1, { maxRetries: 1 });
    const report = await workerB.drainOnce('worker-no-transport', 1);
    expect(report).toMatchObject({ claimed: 1, delivered: 0, retried: 0, deadLettered: 1 });
    const row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('DEAD_LETTER');
    expect(row.sentAt).toBeNull();
    expect(row.lastError).toContain('no transport handler');
    expect(row.lastErrorCategory).toBe('PERMANENT');
    expect(row.lastErrorCode).toBe('TRANSPORT_HANDLER_MISSING');
  });

  it.each([
    ['timeout', Object.assign(new Error('provider timeout'), { code: 'ETIMEDOUT' }), 'TRANSIENT', 'PROVIDER_TIMEOUT', 'PENDING'],
    ['429', Object.assign(new Error('rate limited'), { status: 429 }), 'TRANSIENT', 'PROVIDER_RATE_LIMITED', 'PENDING'],
    ['400', Object.assign(new Error('invalid request'), { statusCode: 400 }), 'PERMANENT', 'PROVIDER_HTTP_400', 'DEAD_LETTER'],
    ['503', Object.assign(new Error('provider unavailable'), { statusCode: 503 }), 'TRANSIENT', 'PROVIDER_HTTP_503', 'PENDING'],
  ])('durably classifies provider %s failures', async (
    testName,
    failure,
    expectedCategory,
    expectedCode,
    expectedStatus,
  ) => {
    const type = `${RUN_ID}.classified-${testName}`;
    const [id] = await seedEntries(`classified-${testName}`, 1);
    workerA.registerHandler(type, async () => { throw failure; });

    await workerA.drainOnce(`worker-classified-${testName}`, 1);
    const row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe(expectedStatus);
    expect(row.lastErrorCategory).toBe(expectedCategory);
    expect(row.lastErrorCode).toBe(expectedCode);
    expect(row.lastAttemptAt).not.toBeNull();
  });

  it('parks an ambiguous outcome without retry and permits only audited redrive', async () => {
    const type = `${RUN_ID}.ambiguous-delivery`;
    const [id] = await seedEntries('ambiguous-delivery', 1);
    workerA.registerHandler(type, async () => {
      throw new OutboxDeliveryError(
        'AMBIGUOUS',
        'PROVIDER_DELIVERY_AMBIGUOUS',
        'request sent but acknowledgement was lost',
      );
    });

    const report = await workerA.drainOnce('worker-ambiguous', 1);
    expect(report).toMatchObject({ manualReview: 1, retried: 0, deadLettered: 0 });
    let row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('MANUAL_REVIEW');
    expect(row.lastErrorCategory).toBe('AMBIGUOUS');
    expect(row.manualReviewAt).not.toBeNull();
    expect(await workerB.claimBatch('worker-no-ambiguous-retry', 10)).toHaveLength(0);

    const redrive = await outbox.redrive({
      entryId: id,
      actorUserId: 'admin-outbox-e2e',
      reason: 'provider reconciliation proved no delivery',
      idempotencyKey: `${RUN_ID}.ambiguous-redrive`,
    });
    expect(redrive.replayed).toBe(false);
    const [event] = await prismaA.outboxRedriveEvent.findMany({ where: { outboxEntryId: id } });
    expect(event.previousStatus).toBe('MANUAL_REVIEW');
    expect(event.previousErrorCode).toBe('PROVIDER_DELIVERY_AMBIGUOUS');
    expect(event.previousErrorCategory).toBe('AMBIGUOUS');
    expect(event.previousLastAttemptAt).not.toBeNull();
    expect(event.previousManualReviewAt).not.toBeNull();

    workerA.registerHandler(type, async () => undefined);
    expect((await workerA.drainOnce('worker-reconciled', 1)).delivered).toBe(1);
    row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('SENT');
    expect(row.lastErrorCategory).toBeNull();
    expect(row.manualReviewAt).toBeNull();
  });

  it('redrives exactly once with an append-only hash-chain audit and never mutates terminal receipts', async () => {
    const type = `${RUN_ID}.audited-redrive`;
    const [id] = await seedEntries('audited-redrive', 1, { maxRetries: 1 });
    workerA.registerHandler(type, async () => {
      throw new Error('temporary provider failure');
    });
    await workerA.drainOnce('worker-redrive-fail', 1);

    const idempotencyKey = `${RUN_ID}.redrive-command`;
    const first = await outbox.redrive({
      entryId: id,
      actorUserId: 'admin-outbox-e2e',
      reason: 'provider recovered',
      idempotencyKey,
    });
    const replay = await outbox.redrive({
      entryId: id,
      actorUserId: 'admin-outbox-e2e',
      reason: 'provider recovered',
      idempotencyKey,
    });
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.redriveEventId).toBe(first.redriveEventId);

    const events = await prismaA.outboxRedriveEvent.findMany({ where: { outboxEntryId: id } });
    expect(events).toHaveLength(1);
    expect(events[0].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[0].previousStatus).toBe('DEAD_LETTER');

    workerA.registerHandler(type, async () => undefined);
    const delivered = await workerA.drainOnce('worker-redrive-success', 1);
    expect(delivered.delivered).toBe(1);
    let row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('SENT');

    await expect(
      outbox.redrive({
        entryId: id,
        actorUserId: 'admin-outbox-e2e',
        reason: 'illegal terminal mutation',
        idempotencyKey: `${RUN_ID}.illegal-redrive`,
      }),
    ).rejects.toThrow('cannot be redriven from status SENT');

    await outbox.confirm(id);
    row = await prismaA.outboxEntry.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('CONFIRMED');
    await expect(
      prismaA.outboxEntry.update({ where: { id }, data: { status: 'PENDING' } }),
    ).rejects.toThrow();
  });

  it('never claims CONFIRMED command receipts and exposes durable queue statistics', async () => {
    await prismaA.outboxEntry.create({
      data: {
        type: `${RUN_ID}.receipt`,
        status: 'CONFIRMED',
        payload: { result: { ok: true } },
        idempotencyKey: `${RUN_ID}.receipt.one`,
        confirmedAt: new Date(),
      },
    });
    expect(await workerA.claimBatch('worker-receipt', 10)).toHaveLength(0);

    const stats = await outbox.queueStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.confirmed).toBeGreaterThan(0);
    expect(stats.deadLetter).toBeGreaterThan(0);
  });
});
