import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { OutboxService, type OutboxStats } from './common/outbox/outbox.service';

const APP_VERSION = process.env.APP_VERSION ?? '3.0.0';
const BUILD_DATE = process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
const GIT_COMMIT = process.env.GIT_COMMIT ?? 'local';

const OUTBOX_DEGRADED_THRESHOLD = 10;
const OUTBOX_DOWN_THRESHOLD = 50;

type CheckStatus = 'ok' | 'degraded' | 'down';
type ReadinessStatus = 'ready' | 'degraded';

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
    outboxQueryUp: boolean;
    workerTopology: 'enabled' | 'disabled';
    uptime: number;
    memoryMb: number;
  };
  timestamp: string;
}

@Controller()
export class HealthController {
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
    const queue = await this.readQueueStats();
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const memOk = memMb < 900;
    const outboxStatus = queue.ok ? statusForDead(queue.stats.deadLetter) : 'down';
    const overall: ReadinessStatus = queue.ok && outboxStatus !== 'down' && memOk
      ? 'ready'
      : 'degraded';

    return {
      status: overall,
      checks: {
        api: 'ok',
        database: queue.ok ? 'ok' : 'down',
        outbox: queue.ok
          ? `${outboxStatus} (pending=${queue.stats.pending}, processing=${queue.stats.processing}, deadLetter=${queue.stats.deadLetter})`
          : 'down (durable queue unavailable)',
        memory: memOk ? `ok (${memMb}MB)` : `degraded (${memMb}MB)`,
        worker: workerTopologyDescription(),
        kafka: kafkaTopologyDescription(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health/detailed')
  async healthDetailed(): Promise<DetailedHealthCheck> {
    const queue = await this.readQueueStats();
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const workerEnabled = process.env.OUTBOX_WORKER_ENABLED === 'true';
    const kafkaConfigured = Boolean(process.env.KAFKA_BROKERS?.trim());
    const kafkaStatus: CheckStatus = workerEnabled && !kafkaConfigured ? 'down' : 'ok';
    const outboxStatus: CheckStatus = queue.ok ? statusForDead(queue.stats.deadLetter) : 'down';

    const checks = {
      api: 'ok' as CheckStatus,
      database: queue.ok ? 'ok' as CheckStatus : 'down' as CheckStatus,
      outbox: outboxStatus,
      kafka: kafkaStatus,
      redis: process.env.REDIS_URL ? 'ok' as CheckStatus : 'degraded' as CheckStatus,
      integrations: {
        fgis: integrationStatus('FGIS'),
        diadok: integrationStatus('DIADOK'),
        cryptopro: integrationStatus('CRYPTOPRO'),
        bank: integrationStatus('BANK'),
        gps: integrationStatus('GPS'),
        rzd: integrationStatus('RZD'),
      },
    };

    const integrationDegraded = Object.values(checks.integrations).some((value) => value !== 'ok');
    const overall: CheckStatus = checks.database === 'down' || checks.outbox === 'down' || checks.kafka === 'down'
      ? 'down'
      : checks.outbox === 'degraded' || checks.redis === 'degraded' || integrationDegraded
        ? 'degraded'
        : 'ok';

    return {
      status: overall,
      checks,
      details: {
        outboxDeadCount: queue.stats.deadLetter,
        outboxPendingCount: queue.stats.pending,
        outboxProcessingCount: queue.stats.processing,
        outboxQueryUp: queue.ok,
        workerTopology: workerEnabled ? 'enabled' : 'disabled',
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
    const queue = await this.readQueueStats();

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
      '# HELP grainflow_outbox_query_up Durable outbox query availability',
      '# TYPE grainflow_outbox_query_up gauge',
      `grainflow_outbox_query_up ${queue.ok ? 1 : 0}`,
      '# HELP grainflow_outbox_dead_letter_total Dead-letter outbox entries',
      '# TYPE grainflow_outbox_dead_letter_total gauge',
      `grainflow_outbox_dead_letter_total ${queue.stats.deadLetter}`,
      '# HELP grainflow_outbox_pending_total Pending outbox entries',
      '# TYPE grainflow_outbox_pending_total gauge',
      `grainflow_outbox_pending_total ${queue.stats.pending}`,
      '# HELP grainflow_outbox_processing_total Leased outbox entries',
      '# TYPE grainflow_outbox_processing_total gauge',
      `grainflow_outbox_processing_total ${queue.stats.processing}`,
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

  private async readQueueStats(): Promise<{ ok: boolean; stats: OutboxStats }> {
    try {
      return { ok: true, stats: await this.outbox.stats() };
    } catch {
      return { ok: false, stats: emptyStats() };
    }
  }
}

function emptyStats(): OutboxStats {
  return {
    total: 0,
    pending: 0,
    processing: 0,
    sent: 0,
    confirmed: 0,
    failed: 0,
    manualReview: 0,
    deadLetter: 0,
  };
}

function statusForDead(deadLetter: number): CheckStatus {
  if (deadLetter >= OUTBOX_DOWN_THRESHOLD) return 'down';
  if (deadLetter >= OUTBOX_DEGRADED_THRESHOLD) return 'degraded';
  return 'ok';
}

function workerTopologyDescription(): string {
  return process.env.OUTBOX_WORKER_ENABLED === 'true'
    ? 'enabled (dedicated durable worker topology)'
    : 'disabled (API does not claim queue work)';
}

function kafkaTopologyDescription(): string {
  if (process.env.OUTBOX_WORKER_ENABLED !== 'true') return 'not-required (worker disabled)';
  return process.env.KAFKA_BROKERS?.trim() ? 'configured' : 'down (brokers missing)';
}

function integrationStatus(prefix: string): CheckStatus {
  return process.env[`${prefix}_LIVE_ENABLED`] === 'true' ? 'ok' : 'degraded';
}
