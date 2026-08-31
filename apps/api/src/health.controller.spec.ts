import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController, READINESS_DATABASE_DEADLINE_MS } from './health.controller';
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

/**
 * Пул, у которого удаляют реплику, соединение не разрывает: под уходит, пакеты
 * перестают доходить, и запрос просто не отвечает. Промис, который никогда не
 * settle-ится, — это ровно та форма отказа, и она отличается от отвергнутого
 * промиса тем, что без внешней границы обработчик из неё не выходит вовсе.
 */
function stalledForever(): Promise<never> {
  return new Promise<never>(() => {});
}

describe('HealthController — durable outbox projections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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

  it('preserves readiness when the database stalls instead of failing', async () => {
    // Grace-окно писалось под отказ пула, но ловило только отвергнутый промис.
    // Здесь база не отвечает вовсе — и до этой границы обработчик висел бы
    // дольше probe-таймаута kubelet, под ушёл бы из endpoints, а ingress отдал
    // бы 503: ровно то, что grace-окно должно было предотвратить.
    fixHeapUsedMb(64);
    const outbox = makeOutbox({ pending: 4, processing: 2, deadLetter: 0 });
    const controller = new HealthController(outbox);

    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    await controller.ready();

    outbox.queueStats.mockReturnValueOnce(stalledForever());
    jest.setSystemTime(6_000);

    const pending = controller.ready();
    await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({
          // 5000 мс простоя плюс сам дедлайн: граница тратит часть окна, а не
          // добавляет к нему.
          database: 'transient-grace (cached_age_ms=6500)',
          outbox: expect.stringContaining('pending=6'),
        }),
      }),
    );
  });

  it('fails closed when the database stalls before any successful readiness read', async () => {
    // Дедлайн переводит зависание в отказ — но не выдаёт готовность за него.
    const outbox = makeOutbox();
    outbox.queueStats.mockReturnValueOnce(stalledForever());
    const controller = new HealthController(outbox);

    jest.useFakeTimers();
    jest.setSystemTime(1_000);

    const settled = controller.ready().catch((caught: unknown) => caught);
    await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);

    const error = await settled;
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual(
      expect.objectContaining({
        code: 'READINESS_DATABASE_UNAVAILABLE',
        checks: { api: 'ok', database: 'down' },
      }),
    );
  });

  it('fails closed when the database stalls past the grace period', async () => {
    // Дедлайн не расширяет окно: после 15 секунд без успешного чтения
    // готовность падает независимо от формы отказа.
    fixHeapUsedMb(64);
    const outbox = makeOutbox();
    const controller = new HealthController(outbox);

    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    await controller.ready();

    outbox.queueStats.mockReturnValueOnce(stalledForever());
    jest.setSystemTime(16_001);

    const settled = controller.ready().catch((caught: unknown) => caught);
    await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);

    expect(await settled).toBeInstanceOf(ServiceUnavailableException);
  });

  it('keeps the readiness deadline below the Kubernetes probe timeout', () => {
    // Граница ниже probe-таймаута — это и есть всё её содержание. Поднять
    // константу выше него можно только уронив этот тест: иначе kubelet
    // отсчитает свой таймаут раньше, чем обработчик вернёт кэш, и дедлайн
    // снова перестанет что-либо значить.
    const values = readFileSync(
      join(__dirname, '..', '..', '..', 'infra', 'helm', 'grainflow', 'values.yaml'),
      'utf8',
    );
    const apiSection = values.slice(values.indexOf('\napi:'), values.indexOf('\noutboxWorker:'));
    expect(apiSection).toContain('path: /ready');

    const probeTimeout = /path: \/ready[\s\S]*?timeoutSeconds:\s*(\d+)/u.exec(apiSection);
    expect(probeTimeout).not.toBeNull();

    const probeTimeoutMs = Number(probeTimeout?.[1]) * 1_000;
    expect(probeTimeoutMs).toBeGreaterThan(0);
    expect(READINESS_DATABASE_DEADLINE_MS).toBeLessThan(probeTimeoutMs);
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
