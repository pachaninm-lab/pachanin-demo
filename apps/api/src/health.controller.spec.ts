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

describe('HealthController — durable outbox projections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports readiness from PostgreSQL queue statistics', async () => {
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
    const controller = new HealthController(makeOutbox({ deadLetter: 50 }));
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({ status: 'degraded' }),
    );
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
