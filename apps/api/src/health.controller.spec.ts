import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { OutboxService } from './common/outbox/outbox.service';

function makeOutbox(stats: Partial<Awaited<ReturnType<OutboxService['queueStats']>>> = {}) {
  return {
    queueStats: jest.fn().mockResolvedValue({
      total: 10,
      pending: 2,
      processing: 1,
      sent: 3,
      confirmed: 4,
      deadLetter: 0,
      manualReview: 0,
      ...stats,
    }),
  } as unknown as jest.Mocked<OutboxService>;
}

const MEGABYTE = 1024 * 1024;

/**
 * Готовность зависит от памяти процесса, а тесты ниже проверяют PostgreSQL и
 * outbox. Без фиксации памяти результат зависит от того, сколько её занял
 * runner: на загруженной машине heapUsed переваливает за производственный
 * порог, и тест падает по причине, к своему предмету не относящейся.
 *
 * Порог при этом не ослабляется и не подменяется — он проверяется отдельно,
 * на границе, чтобы его нельзя было тихо поднять ради зелёного CI.
 */
function fixHeapUsedMb(megabytes: number): void {
  const actual = process.memoryUsage();
  jest.spyOn(process, 'memoryUsage').mockReturnValue({ ...actual, heapUsed: megabytes * MEGABYTE });
}

describe('HealthController — durable outbox projections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports readiness from PostgreSQL queue statistics', async () => {
    fixHeapUsedMb(64);
    const outbox = makeOutbox();
    const controller = new HealthController(outbox);

    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({
          database: 'ok',
          outbox: expect.stringContaining('pending=3'),
        }),
      }),
    );
    expect(outbox.queueStats).toHaveBeenCalledTimes(1);
  });

  it('preserves readiness during a bounded PgBouncer peer failover', async () => {
    fixHeapUsedMb(64);
    const outbox = makeOutbox({ pending: 4, processing: 2, deadLetter: 0 });
    const controller = new HealthController(outbox);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({ database: 'ok' }),
      }),
    );

    outbox.queueStats.mockRejectedValueOnce(new Error('connection terminated'));
    now.mockReturnValue(6_000);

    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({
          database: 'transient-grace (cached_age_ms=5000)',
          outbox: expect.stringContaining('pending=6'),
        }),
      }),
    );
    expect(outbox.queueStats).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the database is unavailable before any successful readiness read', async () => {
    const outbox = makeOutbox();
    outbox.queueStats.mockRejectedValueOnce(new Error('database unavailable'));
    const controller = new HealthController(outbox);
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    const error = await controller.ready().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        code: 'READINESS_DATABASE_UNAVAILABLE',
        checks: { api: 'ok', database: 'down' },
      }),
    );
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain(
      'database unavailable',
    );
  });

  it('fails closed after the bounded database grace period expires', async () => {
    const outbox = makeOutbox();
    const controller = new HealthController(outbox);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await controller.ready();
    outbox.queueStats.mockRejectedValueOnce(new Error('connection terminated'));
    now.mockReturnValue(16_001);

    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('degrades readiness when the dead-letter threshold is reached', async () => {
    // Память фиксируется низкой, иначе тест мог бы пройти из-за неё, а не из-за
    // мёртвых сообщений — то есть проверять не то, что заявляет.
    fixHeapUsedMb(64);
    const controller = new HealthController(makeOutbox({ deadLetter: 50 }));
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({ status: 'degraded' }),
    );
  });

  it('stays ready one megabyte below the production memory threshold', async () => {
    fixHeapUsedMb(899);
    const controller = new HealthController(makeOutbox());
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({ memory: 'ok (899MB)' }),
      }),
    );
  });

  it('degrades exactly at the production memory threshold', async () => {
    // Граница зафиксирована намеренно: поднять порог ради зелёного CI нельзя,
    // не уронив этот тест.
    fixHeapUsedMb(900);
    const controller = new HealthController(makeOutbox());
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({
          memory: 'degraded (900MB)',
          // Память деградировала сама по себе: база и очередь при этом здоровы.
          database: 'ok',
          outbox: expect.stringContaining('pending=3'),
        }),
      }),
    );
  });

  it('reads memory from the process on every readiness probe', async () => {
    // Значение не кэшируется: иначе деградация памяти не была бы замечена.
    fixHeapUsedMb(64);
    const controller = new HealthController(makeOutbox());
    await controller.ready();
    await controller.ready();
    expect(process.memoryUsage).toHaveBeenCalledTimes(2);
  });

  it('exposes pending, processing and dead-letter details without memory reads', async () => {
    const controller = new HealthController(
      makeOutbox({ pending: 7, processing: 2, deadLetter: 3 }),
    );
    const result = await controller.healthDetailed();
    expect(result.details).toMatchObject({
      outboxPendingCount: 7,
      outboxProcessingCount: 2,
      outboxDeadCount: 3,
    });
    expect(result.checks.outbox).toBe('degraded');
  });

  it('publishes Prometheus gauges from the durable queue', async () => {
    const controller = new HealthController(
      makeOutbox({ pending: 4, processing: 2, deadLetter: 1 }),
    );
    const metrics = await controller.metrics();
    expect(metrics).toContain('grainflow_outbox_pending_total 4');
    expect(metrics).toContain('grainflow_outbox_processing_total 2');
    expect(metrics).toContain('grainflow_outbox_dead_letter_total 1');
  });
});
