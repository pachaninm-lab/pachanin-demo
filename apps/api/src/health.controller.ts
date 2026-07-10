import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { OutboxService } from './common/outbox/outbox.service';

const APP_VERSION = process.env.APP_VERSION ?? '3.0.0';
const BUILD_DATE = process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
const GIT_COMMIT = process.env.GIT_COMMIT ?? 'local';

type CheckStatus = 'ok' | 'degraded' | 'down' | 'not_configured';
type ReadinessStatus = 'ready' | 'degraded';

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
  async ready(): Promise<{ status: ReadinessStatus; checks: Record<string, string>; timestamp: string }> {
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const memOk = memMb < 900;
    try {
      const stats = await this.outbox.stats();
      const outboxOk = stats.dead < 50;
      return {
        status: outboxOk && memOk ? 'ready' : 'degraded',
        checks: {
          api: 'ok',
          database: 'ok',
          outbox: outboxOk
            ? `ok (pending=${stats.pending}, processing=${stats.processing}, retry=${stats.retry})`
            : `degraded (dead=${stats.dead})`,
          memory: memOk ? `ok (${memMb}MB)` : `degraded (${memMb}MB)`,
          kafka: process.env.OUTBOX_WORKER_MODE && process.env.OUTBOX_WORKER_MODE !== 'disabled'
            ? 'validated by outbox worker startup'
            : 'not configured for this process',
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'degraded',
        checks: {
          api: 'ok',
          database: 'down',
          outbox: 'down',
          memory: memOk ? `ok (${memMb}MB)` : `degraded (${memMb}MB)`,
          kafka: 'unknown',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /** Detailed health for internal monitoring; no fake-live adapter status. */
  @Public()
  @Get('health/detailed')
  async healthDetailed() {
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    try {
      const stats = await this.outbox.stats();
      const outboxStatus: CheckStatus = stats.dead === 0 ? 'ok' : stats.dead < 50 ? 'degraded' : 'down';
      return {
        status: outboxStatus === 'down' ? 'down' : outboxStatus === 'degraded' ? 'degraded' : 'ok',
        checks: {
          api: 'ok' as CheckStatus,
          database: 'ok' as CheckStatus,
          outbox: outboxStatus,
          kafka: process.env.OUTBOX_WORKER_MODE && process.env.OUTBOX_WORKER_MODE !== 'disabled'
            ? 'ok' as CheckStatus
            : 'not_configured' as CheckStatus,
          integrations: {
            bank: 'not_configured' as CheckStatus,
            fgis: 'not_configured' as CheckStatus,
            edo: 'not_configured' as CheckStatus,
            esia: 'not_configured' as CheckStatus,
          },
        },
        details: {
          outbox: stats,
          uptime: Math.round(process.uptime()),
          memoryMb: memMb,
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'down' as CheckStatus,
        checks: {
          api: 'ok' as CheckStatus,
          database: 'down' as CheckStatus,
          outbox: 'down' as CheckStatus,
          kafka: 'not_configured' as CheckStatus,
          integrations: {},
        },
        details: { outbox: null, uptime: Math.round(process.uptime()), memoryMb: memMb },
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Public()
  @Get('metrics')
  async metrics(): Promise<string> {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const stats = await this.outbox.stats().catch(() => ({
      pending: -1,
      processing: -1,
      retry: -1,
      dead: -1,
      manualReview: -1,
      oldestPendingAt: null,
    }));
    const oldestAgeSeconds = stats.oldestPendingAt
      ? Math.max(0, (Date.now() - stats.oldestPendingAt.getTime()) / 1000)
      : 0;

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
      '# HELP grainflow_outbox_pending Durable pending outbox entries',
      '# TYPE grainflow_outbox_pending gauge',
      `grainflow_outbox_pending ${stats.pending}`,
      '# HELP grainflow_outbox_processing Leased outbox entries',
      '# TYPE grainflow_outbox_processing gauge',
      `grainflow_outbox_processing ${stats.processing}`,
      '# HELP grainflow_outbox_retry Durable retry outbox entries',
      '# TYPE grainflow_outbox_retry gauge',
      `grainflow_outbox_retry ${stats.retry}`,
      '# HELP grainflow_outbox_dead Dead-letter outbox entries',
      '# TYPE grainflow_outbox_dead gauge',
      `grainflow_outbox_dead ${stats.dead}`,
      '# HELP grainflow_outbox_oldest_pending_age_seconds Age of oldest deliverable outbox entry',
      '# TYPE grainflow_outbox_oldest_pending_age_seconds gauge',
      `grainflow_outbox_oldest_pending_age_seconds ${oldestAgeSeconds.toFixed(3)}`,
    ].join('\n');
  }

  @Public()
  @Get('version')
  version(): { version: string; buildDate: string; commit: string; nodeVersion: string } {
    return { version: APP_VERSION, buildDate: BUILD_DATE, commit: GIT_COMMIT, nodeVersion: process.version };
  }
}
