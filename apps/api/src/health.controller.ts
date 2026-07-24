import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { OutboxService } from './common/outbox/outbox.service';

const APP_VERSION = process.env.APP_VERSION ?? '3.0.0';
const BUILD_DATE = process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
const GIT_COMMIT = process.env.GIT_COMMIT ?? 'local';
const READINESS_DATABASE_GRACE_MS = 15_000;

type CheckStatus = 'ok' | 'degraded' | 'down';
type ReadinessStatus = 'ready' | 'degraded';
type QueueStats = Awaited<ReturnType<OutboxService['queueStats']>>;

interface ReadinessStats {
  stats: QueueStats;
  databaseCheck: string;
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

  constructor(private readonly outbox: OutboxService) {}

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
    const { stats, databaseCheck } = await this.readinessStats();
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
        outbox: outboxOk
          ? `ok (pending=${pending}, dead_letter=${dead})`
          : `degraded (dead_letter=${dead})`,
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

  @Public()
  @Get('version')
  version(): { version: string; buildDate: string; commit: string; nodeVersion: string } {
    return {
      version: APP_VERSION,
      buildDate: BUILD_DATE,
      commit: GIT_COMMIT,
      nodeVersion: process.version,
    };
  }

  private async readinessStats(): Promise<ReadinessStats> {
    try {
      const stats = await this.outbox.queueStats();
      this.lastSuccessfulQueueStats = { stats, recordedAt: Date.now() };
      return { stats, databaseCheck: 'ok' };
    } catch {
      const now = Date.now();
      const cached = this.lastSuccessfulQueueStats;
      const ageMs = cached ? now - cached.recordedAt : Number.POSITIVE_INFINITY;

      if (cached && ageMs >= 0 && ageMs <= READINESS_DATABASE_GRACE_MS) {
        return {
          stats: cached.stats,
          databaseCheck: `transient-grace (cached_age_ms=${ageMs})`,
        };
      }

      throw new ServiceUnavailableException({
        status: 'unavailable',
        code: 'READINESS_DATABASE_UNAVAILABLE',
        checks: { api: 'ok', database: 'down' },
        timestamp: new Date(now).toISOString(),
      });
    }
  }
}
