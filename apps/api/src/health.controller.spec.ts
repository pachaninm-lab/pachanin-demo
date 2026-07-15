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
  it('reports readiness from PostgreSQL queue statistics', async () => {
    const outbox = makeOutbox();
    const controller = new HealthController(outbox);

    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({
          outbox: expect.stringContaining('pending=3'),
        }),
      }),
    );
    expect(outbox.queueStats).toHaveBeenCalledTimes(1);
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
