import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { OutboxService } from './common/outbox/outbox.service';
import { PrismaService } from './common/prisma/prisma.service';
import { INDUSTRIAL_CORE_MIGRATION } from './common/config/industrial-mode';

const APP_VERSION = process.env.APP_VERSION ?? '3.0.0';
const BUILD_DATE = process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
const GIT_COMMIT = process.env.GIT_COMMIT ?? 'local';
const READINESS_DATABASE_GRACE_MS = 15_000;

/**
 * Порог ответа базы на пути готовности. Обязан быть строго меньше
 * `timeoutSeconds` readiness-пробы Kubernetes (`infra/helm/grainflow/values.yaml`),
 * иначе граница ниже бесполезна: kubelet отсчитает свой таймаут раньше, чем
 * обработчик успеет вернуть кэш, и под уйдёт из endpoints — ровно то, что
 * grace-окно выше должно было предотвратить.
 */
export const READINESS_DATABASE_DEADLINE_MS = 1_500;

/**
 * Отказ базы приходит в двух формах, и до этой границы обрабатывалась только
 * одна. Оборванное соединение отвергает промис, и grace-окно его ловит.
 * Исчезнувший пул соединение не рвёт — пакеты уходят в никуда, запрос висит,
 * и обработчик остаётся внутри `try`, до grace-окна не доходя вовсе.
 *
 * Дедлайн переводит вторую форму в первую: висящий запрос становится отказом,
 * который grace-окно уже умеет пережить. Само окно не расширяется — после
 * 15 секунд без единого успешного чтения готовность по-прежнему падает.
 */
class ReadinessDatabaseDeadlineError extends Error {
  constructor() {
    super('READINESS_DATABASE_DEADLINE');
    this.name = 'ReadinessDatabaseDeadlineError';
  }
}

function withReadinessDeadline<T>(work: Promise<T>, deadlineMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ReadinessDatabaseDeadlineError()), deadlineMs);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error as Error);
      },
    );
  });
}

type CheckStatus = 'ok' | 'degraded' | 'down';
type ReadinessStatus = 'ready' | 'degraded';
type QueueStats = Awaited<ReturnType<OutboxService['queueStats']>>;

interface ValidatedReadinessStats {
  stats: QueueStats;
  migrationsVerifiedAt: number;
}

class ReadinessMigrationsPendingError extends Error {}

interface ReadinessStats {
  stats: QueueStats;
  databaseCheck: string;
  migrationsCheck: string;
}

interface DetailedHealthCheck {
  status: CheckStatus;
  checks: {
    api: CheckStatus;
    database: CheckStatus;
    outbox: CheckStatus;
    kafka: CheckStatus;
    redis: CheckStatus;
    integrations: Record<string, CheckStatus>;
  };
  details: {
    outboxDeadCount: number;
    outboxPendingCount: number;
    outboxProcessingCount: number;
    uptime: number;
    memoryMb: number;
  };
  timestamp: string;
}

@Controller()
export class HealthController {
  private lastSuccessfulQueueStats: { stats: QueueStats; recordedAt: number } | null = null;
  private inFlightQueueStats: Promise<ValidatedReadinessStats> | null = null;

  constructor(
    private readonly outbox: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<{
    status: ReadinessStatus;
    checks: Record<string, string>;
    timestamp: string;
  }> {
    const { stats, databaseCheck, migrationsCheck } = await this.readinessStats();
    const dead = stats.deadLetter;
    const pending = stats.pending + stats.processing;
    const outboxOk = dead < 50;
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const memOk = memMb < 900;
    const overall: ReadinessStatus = outboxOk && memOk ? 'ready' : 'degraded';

    return {
      status: overall,
      checks: {
        api: 'ok',
        database: databaseCheck,
        migrations: migrationsCheck,
        // The API principal sees only rows permitted by outbox RLS. Zero
        // visible rows cannot attest the service-wide worker queue health.
        outbox: outboxOk
          ? `UNKNOWN (service-wide); runtime-visible (pending=${pending}, dead_letter=${dead})`
          : `degraded (runtime-visible dead_letter=${dead}; service-wide=UNKNOWN)`,
        outbox_scope: 'runtime-role-visible; service-wide=UNKNOWN',
        memory: memOk ? `ok (${memMb}MB)` : `degraded (${memMb}MB)`,
        kafka: process.env.KAFKA_BROKERS ? 'configured' : 'disabled',
        redis: process.env.REDIS_URL ? 'configured' : 'disabled',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /** Detailed health per ТЗ 13.4 — for internal monitoring only */
  @Public()
  @Get('health/detailed')
  async healthDetailed(): Promise<DetailedHealthCheck> {
    const stats = await this.outbox.queueStats();
    const dead = stats.deadLetter;
    const outboxOk: CheckStatus = dead === 0 ? 'ok' : dead < 50 ? 'degraded' : 'down';
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const checks = {
      api: 'ok' as CheckStatus,
      database: 'ok' as CheckStatus,
      outbox: outboxOk,
      kafka: (process.env.KAFKA_BROKERS ? 'ok' : 'degraded') as CheckStatus,
      redis: (process.env.REDIS_URL ? 'ok' : 'degraded') as CheckStatus,
      integrations: {
        fgis: 'degraded' as CheckStatus,
        diadok: 'degraded' as CheckStatus,
        cryptopro: 'degraded' as CheckStatus,
        bank: 'degraded' as CheckStatus,
        gps: 'degraded' as CheckStatus,
        rzd: 'degraded' as CheckStatus,
      },
    };

    const anyDegraded = Object.values(checks).some(
      (value) =>
        typeof value === 'string'
          ? value !== 'ok'
          : Object.values(value).some((nested) => nested !== 'ok'),
    );
    const overall: CheckStatus = outboxOk === 'down' ? 'down' : anyDegraded ? 'degraded' : 'ok';

    return {
      status: overall,
      checks,
      details: {
        outboxDeadCount: dead,
        outboxPendingCount: stats.pending,
        outboxProcessingCount: stats.processing,
        uptime: Math.round(process.uptime()),
        memoryMb: memMb,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('metrics')
  async metrics(): Promise<string> {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const stats = await this.outbox.queueStats();

    return [
      '# HELP nodejs_heap_used_bytes Heap used in bytes',
      '# TYPE nodejs_heap_used_bytes gauge',
      `nodejs_heap_used_bytes ${mem.heapUsed}`,
      '# HELP nodejs_heap_total_bytes Heap total in bytes',
      '# TYPE nodejs_heap_total_bytes gauge',
      `nodejs_heap_total_bytes ${mem.heapTotal}`,
      '# HELP process_uptime_seconds Process uptime in seconds',
      '# TYPE process_uptime_seconds counter',
      `process_uptime_seconds ${uptime.toFixed(2)}`,
      '# HELP grainflow_outbox_dead_letter_total Dead-lettered outbox entries',
      '# TYPE grainflow_outbox_dead_letter_total gauge',
      `grainflow_outbox_dead_letter_total ${stats.deadLetter}`,
      '# HELP grainflow_outbox_pending_total Pending outbox entries',
      '# TYPE grainflow_outbox_pending_total gauge',
      `grainflow_outbox_pending_total ${stats.pending}`,
      '# HELP grainflow_outbox_processing_total Leased outbox entries',
      '# TYPE grainflow_outbox_processing_total gauge',
      `grainflow_outbox_processing_total ${stats.processing}`,
    ].join('\n');
  }

  /**
   * Подробности сборки — за аутентификацией.
   *
   * ASVS 5.0 V13.4.6 запрещает отдавать подробную информацию о версиях
   * компонентов бэкенда, и, в отличие от соседнего V13.4.5, оговорки «если это
   * сделано намеренно» здесь нет: преднамеренность требования не удовлетворяет.
   * Маршрут отдавал версию приложения, дату сборки, хеш коммита и версию Node
   * любому анонимному запросу — то есть точный отпечаток для подбора известных
   * уязвимостей рантайма и зависимостей.
   *
   * Снятие пометки публичности проверено на предмет поломки эксплуатации, а не
   * предположено: ни одна проба Kubernetes на этот путь не ходит. Пути проб в
   * infra/k8s и infra/helm — /health, /ready, /live и /-/ready; /version не
   * упоминается ни в одной. Для мониторинга живости остаются публичными
   * /health и /ready.
   */
  @Get('version')
  version(): { version: string; buildDate: string; commit: string; nodeVersion: string } {
    return {
      version: APP_VERSION,
      buildDate: BUILD_DATE,
      commit: GIT_COMMIT,
      nodeVersion: process.version,
    };
  }

  /**
   * Один незавершённый запрос на процесс, а не один на probe.
   *
   * Дедлайн отпускает обработчик, но запрос от этого не прекращается: он
   * продолжает занимать соединение пула, пока база не ответит. Проба приходит
   * каждые пять секунд, и если каждая будет начинать свой запрос, стояние базы
   * за минуту исчерпает пул Prisma - и остановит уже не готовность, а весь
   * трафик API, включая тот, который к базе не обращается.
   *
   * Поэтому пробы разделяют один запрос. Ждущих может быть сколько угодно,
   * занятое соединение при этом одно.
   */
  private readQueueStats(): Promise<ValidatedReadinessStats> {
    const existing = this.inFlightQueueStats;
    if (existing) return existing;

    const started = Promise.resolve().then(async (): Promise<ValidatedReadinessStats> => {
      // Check migration completion first, using the same Prisma principal as
      // the original bootstrap probe. No queue read starts while migrations
      // are known pending; both sequential reads share one in-flight promise.
      const rows = await this.prisma.$queryRaw<Array<{ unfinished: number; core: number }>>`
        SELECT
          (SELECT COUNT(*)::int FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,
          (SELECT COUNT(*)::int FROM "_prisma_migrations" WHERE migration_name = ${INDUSTRIAL_CORE_MIGRATION} AND finished_at IS NOT NULL) AS core
      `;
      const migration = rows[0];
      if (!migration || migration.unfinished !== 0 || !Number.isSafeInteger(migration.core) || migration.core <= 0) {
        // A known negative migration result is never covered by a prior
        // positive cache, including when it arrives after a probe deadline.
        this.lastSuccessfulQueueStats = null;
        throw new ReadinessMigrationsPendingError('READINESS_MIGRATIONS_PENDING');
      }
      const migrationsVerifiedAt = Date.now();
      const stats = await this.outbox.queueStats();
      return { stats, migrationsVerifiedAt };
    });
    this.inFlightQueueStats = started;
    const release = (): void => {
      if (this.inFlightQueueStats === started) this.inFlightQueueStats = null;
    };
    // Обработчики вешаются сразу: результат может быть уже никому не нужен -
    // обёртка с дедлайном ответила из кэша, - и без них поздний отказ всплыл бы
    // как unhandled rejection в процессе, который проба как раз и оценивает.
    started.then(release, release);
    return started;
  }

  private async readinessStats(): Promise<ReadinessStats> {
    try {
      const { stats, migrationsVerifiedAt } = await withReadinessDeadline(
        this.readQueueStats(),
        READINESS_DATABASE_DEADLINE_MS,
      );
      const migrationAge = Date.now() - migrationsVerifiedAt;
      // A late queue result must not renew readiness with an old migration
      // fact. The accepted 1500ms deadline and 15000ms cache window stay fixed.
      if (migrationAge < 0 || migrationAge > READINESS_DATABASE_DEADLINE_MS) {
        throw new ReadinessDatabaseDeadlineError();
      }
      this.lastSuccessfulQueueStats = { stats, recordedAt: migrationsVerifiedAt };
      return { stats, databaseCheck: 'ok', migrationsCheck: 'ok' };
    } catch (error) {
      const now = Date.now();
      if (error instanceof ReadinessMigrationsPendingError) {
        throw new ServiceUnavailableException({
          status: 'unavailable',
          code: 'READINESS_MIGRATIONS_PENDING',
          checks: { api: 'ok', database: 'ok', migrations: 'pending' },
          timestamp: new Date(now).toISOString(),
        });
      }
      const cached = this.lastSuccessfulQueueStats;
      const ageMs = cached ? now - cached.recordedAt : Number.POSITIVE_INFINITY;

      if (cached && ageMs >= 0 && ageMs <= READINESS_DATABASE_GRACE_MS) {
        return {
          stats: cached.stats,
          databaseCheck: `transient-grace (cached_age_ms=${ageMs})`,
          migrationsCheck: `transient-grace (cached_age_ms=${ageMs})`,
        };
      }

      throw new ServiceUnavailableException({
        status: 'unavailable',
        code: 'READINESS_DATABASE_UNAVAILABLE',
        checks: { api: 'ok', database: 'down', migrations: 'unknown' },
        timestamp: new Date(now).toISOString(),
      });
    }
  }
}
