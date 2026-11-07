import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController, READINESS_DATABASE_DEADLINE_MS } from './health.controller';
import { OutboxService } from './common/outbox/outbox.service';
import { PrismaService } from './common/prisma/prisma.service';
import { createServer } from 'node:http';

function makePrisma(rows = [{ unfinished: 0, core: 1 }]) {
  return { $queryRaw: jest.fn().mockResolvedValue(rows) } as unknown as jest.Mocked<PrismaService>;
}

describe('HealthController — one bounded database and migration readiness path', () => {
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('uses a parameterized industrial migration check before reading queue statistics', async () => {
    fixHeapUsedMb(64);
    const prisma = makePrisma();
    const outbox = makeOutbox();
    const controller = new HealthController(outbox, prisma);
    await expect(controller.ready()).resolves.toMatchObject({ checks: { database: 'ok', migrations: 'ok' } });
    const query = prisma.$queryRaw.mock.calls[0];
    expect((query[0] as TemplateStringsArray).join('?')).toContain('finished_at IS NULL AND rolled_back_at IS NULL');
    expect(query[1]).toBe('20260712090000_industrial_transaction_core');
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(outbox.queueStats.mock.invocationCallOrder[0]);
  });

  it.each([
    [], [{ unfinished: 1, core: 1 }], [{ unfinished: 0, core: 0 }],
    [{ unfinished: -1, core: 1 }], [{ unfinished: 0, core: -1 }],
    [{ unfinished: 0, core: 1.5 }],
  ])('fails closed for incomplete or invalid migration evidence %j', async (...rows) => {
    fixHeapUsedMb(64);
    const outbox = makeOutbox();
    const prisma = makePrisma(rows as Array<{ unfinished: number; core: number }>);
    const controller = new HealthController(outbox, prisma);
    const error = await controller.ready().catch((caught: unknown) => caught) as ServiceUnavailableException;
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse()).toMatchObject({ code: 'READINESS_MIGRATIONS_PENDING', checks: { database: 'ok', migrations: 'pending' } });
    expect(outbox.queueStats).not.toHaveBeenCalled();
  });

  it('never masks known pending migrations with a warm positive cache', async () => {
    fixHeapUsedMb(64);
    const prisma = makePrisma();
    const outbox = makeOutbox();
    const controller = new HealthController(outbox, prisma);
    await controller.ready();
    prisma.$queryRaw.mockResolvedValueOnce([{ unfinished: 1, core: 1 }]);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    prisma.$queryRaw.mockRejectedValueOnce(new Error('closed migration connection'));
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(outbox.queueStats).toHaveBeenCalledTimes(1);
  });

  it('keeps a stalled migration read single-flight and never starts an outbox query', async () => {
    jest.useFakeTimers(); fixHeapUsedMb(64);
    const prisma = makePrisma(); prisma.$queryRaw.mockReturnValue(stalledForever() as never);
    const outbox = makeOutbox();
    const controller = new HealthController(outbox, prisma);
    for (let i = 0; i < 4; i += 1) {
      const pending = controller.ready().catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);
      expect(await pending).toBeInstanceOf(ServiceUnavailableException);
    }
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(outbox.queueStats).not.toHaveBeenCalled();
  });

  it('invalidates cached readiness when pending migrations arrive after a probe deadline', async () => {
    jest.useFakeTimers(); jest.setSystemTime(1_000); fixHeapUsedMb(64);
    const prisma = makePrisma(); const outbox = makeOutbox();
    const controller = new HealthController(outbox, prisma); await controller.ready();
    let resolve!: (rows: Array<{ unfinished: number; core: number }>) => void;
    prisma.$queryRaw.mockReturnValueOnce(new Promise((done) => { resolve = done; }) as never);
    const request = controller.ready();
    await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);
    await expect(request).resolves.toMatchObject({ checks: { database: expect.stringContaining('transient-grace') } });
    resolve([{ unfinished: 1, core: 1 }]); await Promise.resolve(); await Promise.resolve();
    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable after late pending fact'));
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(outbox.queueStats).toHaveBeenCalledTimes(1);
  });

  it('does not renew the positive cache from stale migration facts after a late queue result', async () => {
    jest.useFakeTimers(); jest.setSystemTime(1_000); fixHeapUsedMb(64);
    const prisma = makePrisma(); const outbox = makeOutbox();
    const controller = new HealthController(outbox, prisma); await controller.ready();
    const stats = await makeOutbox().queueStats();
    let resolve!: (value: typeof stats) => void;
    outbox.queueStats.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const request = controller.ready();
    await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);
    await request;
    jest.setSystemTime(20_000);
    const freshProbe = controller.ready().catch((error: unknown) => error);
    resolve(stats);
    expect(await freshProbe).toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.ready()).resolves.toMatchObject({ status: 'ready', checks: { migrations: 'ok' } });
  });

  it('keeps the public ready route on the typed controller instead of a terminating bootstrap adapter handler', () => {
    const main = readFileSync(join(__dirname, 'main.ts'), 'utf8');
    expect(main).not.toMatch(/getHttpAdapter\(\)\.get\(['"]\/ready['"]/u);
    expect(main).toContain("exclude: ['health', 'ready', 'version', 'metrics']");
    expect(main).toContain('assertIndustrialProductionStartup(process.env)');
  });

  it('returns real HTTP 200 during the accepted fresh-positive grace and 503 for pending migrations or prolonged outage', async () => {
    fixHeapUsedMb(64); const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const prisma = makePrisma(); const outbox = makeOutbox();
    const controller = new HealthController(outbox, prisma);
    // Real Node HTTP transport; direct typed-controller dispatch deliberately
    // excludes native Nest/Prisma/PG wiring from this bounded unit evidence.
    const server = createServer(async (_request, response) => {
      try { const result = await controller.ready(); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result)); }
      catch (error) { const typed = error as ServiceUnavailableException; response.writeHead(typed.getStatus(), { 'content-type': 'application/json' }); response.end(JSON.stringify(typed.getResponse())); }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing local HTTP fixture address');
    const url = `http://127.0.0.1:${address.port}/ready`;
    try {
      expect((await fetch(url)).status).toBe(200);
      now.mockReturnValue(6_000); prisma.$queryRaw.mockRejectedValueOnce(new Error('peer connection closed'));
      const grace = await fetch(url); expect(grace.status).toBe(200); expect(await grace.json()).toMatchObject({ checks: { migrations: expect.stringContaining('transient-grace') } });
      now.mockReturnValue(6_001); prisma.$queryRaw.mockResolvedValueOnce([{ unfinished: 1, core: 1 }]);
      expect((await fetch(url)).status).toBe(503);
      now.mockReturnValue(6_002); prisma.$queryRaw.mockRejectedValueOnce(new Error('closed after known pending migration'));
      expect((await fetch(url)).status).toBe(503);
      now.mockReturnValue(7_000); expect((await fetch(url)).status).toBe(200);
      now.mockReturnValue(22_001); prisma.$queryRaw.mockRejectedValueOnce(new Error('prolonged database outage'));
      expect((await fetch(url)).status).toBe(503);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
});

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
    const controller = new HealthController(outbox, makePrisma());

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
    const controller = new HealthController(outbox, makePrisma());
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
    const controller = new HealthController(outbox, makePrisma());

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

  it('keeps one database read in flight however often the probe fires', async () => {
    // Дедлайн отпускает обработчик, но запрос продолжает занимать соединение
    // пула. Проба приходит каждые пять секунд; если каждая начнёт свой запрос,
    // стояние базы исчерпает пул Prisma за минуту и остановит уже не
    // готовность, а весь трафик API. Найдено ревью на #4830.
    fixHeapUsedMb(64);
    const outbox = makeOutbox();
    const controller = new HealthController(outbox, makePrisma());

    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    await controller.ready();
    expect(outbox.queueStats).toHaveBeenCalledTimes(1);

    outbox.queueStats.mockReturnValue(stalledForever());

    for (let probe = 0; probe < 3; probe += 1) {
      const pending = controller.ready();
      await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);
      await expect(pending).resolves.toEqual(
        expect.objectContaining({ status: 'ready' }),
      );
    }

    // Один успешный в начале и один зависший на все три пробы.
    expect(outbox.queueStats).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh read once the stalled one settles', async () => {
    // Разделяется незавершённый запрос, а не результат: иначе готовность
    // отвечала бы из одного чтения вечно.
    fixHeapUsedMb(64);
    const outbox = makeOutbox();
    const controller = new HealthController(outbox, makePrisma());

    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    await controller.ready();
    await controller.ready();

    expect(outbox.queueStats).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the database stalls before any successful readiness read', async () => {
    // Дедлайн переводит зависание в отказ — но не выдаёт готовность за него.
    const outbox = makeOutbox();
    outbox.queueStats.mockReturnValueOnce(stalledForever());
    const controller = new HealthController(outbox, makePrisma());

    jest.useFakeTimers();
    jest.setSystemTime(1_000);

    const settled = controller.ready().catch((caught: unknown) => caught);
    await jest.advanceTimersByTimeAsync(READINESS_DATABASE_DEADLINE_MS);

    const error = await settled;
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual(
      expect.objectContaining({
        code: 'READINESS_DATABASE_UNAVAILABLE',
        checks: { api: 'ok', database: 'down', migrations: 'unknown' },
      }),
    );
  });

  it('fails closed when the database stalls past the grace period', async () => {
    // Дедлайн не расширяет окно: после 15 секунд без успешного чтения
    // готовность падает независимо от формы отказа.
    fixHeapUsedMb(64);
    const outbox = makeOutbox();
    const controller = new HealthController(outbox, makePrisma());

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
    const controller = new HealthController(outbox, makePrisma());
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    const error = await controller.ready().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        code: 'READINESS_DATABASE_UNAVAILABLE',
        checks: { api: 'ok', database: 'down', migrations: 'unknown' },
      }),
    );
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain(
      'database unavailable',
    );
  });

  it('fails closed after the bounded database grace period expires', async () => {
    const outbox = makeOutbox();
    const controller = new HealthController(outbox, makePrisma());
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
    const controller = new HealthController(makeOutbox({ deadLetter: 50 }), makePrisma());
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({ status: 'degraded' }),
    );
  });

  it('stays ready one megabyte below the production memory threshold', async () => {
    fixHeapUsedMb(899);
    const controller = new HealthController(makeOutbox(), makePrisma());
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
    const controller = new HealthController(makeOutbox(), makePrisma());
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
    const controller = new HealthController(makeOutbox(), makePrisma());
    await controller.ready();
    await controller.ready();
    expect(process.memoryUsage).toHaveBeenCalledTimes(2);
  });

  it('exposes pending, processing and dead-letter details without memory reads', async () => {
    const controller = new HealthController(
      makeOutbox({ pending: 7, processing: 2, deadLetter: 3 }),
     makePrisma(),);
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
     makePrisma(),);
    const metrics = await controller.metrics();
    expect(metrics).toContain('grainflow_outbox_pending_total 4');
    expect(metrics).toContain('grainflow_outbox_processing_total 2');
    expect(metrics).toContain('grainflow_outbox_dead_letter_total 1');
  });
});


describe('HealthController — public readiness observation scope', () => {
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('does not infer service-wide healthy outbox from zero runtime-visible rows', async () => {
    fixHeapUsedMb(64);
    const controller = new HealthController(makeOutbox({ pending: 0, processing: 0, deadLetter: 0 }), makePrisma());
    const response = await controller.ready();
    expect(response.status).toBe('ready');
    expect(response.checks.database).toBe('ok');
    expect(response.checks.outbox_scope).toBe('runtime-role-visible; service-wide=UNKNOWN');
    expect(response.checks.outbox).toBe('UNKNOWN (service-wide); runtime-visible (pending=0, dead_letter=0)');
    expect(response.checks.outbox).not.toMatch(/^ok/);
  });

  it('retains the exact observed dead-letter threshold without upgrading service-wide authority', async () => {
    fixHeapUsedMb(64);
    const below = new HealthController(makeOutbox({ deadLetter: 49 }), makePrisma());
    const threshold = new HealthController(makeOutbox({ deadLetter: 50 }), makePrisma());
    expect((await below.ready()).status).toBe('ready');
    const response = await threshold.ready();
    expect(response.status).toBe('degraded');
    expect(response.checks.outbox).toContain('runtime-visible dead_letter=50');
    expect(response.checks.outbox_scope).toBe('runtime-role-visible; service-wide=UNKNOWN');
  });
});
