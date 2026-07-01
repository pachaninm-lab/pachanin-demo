import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { OutboxService } from './common/outbox/outbox.service';

const APP_VERSION = process.env.APP_VERSION ?? '3.0.0';
const BUILD_DATE = process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
const GIT_COMMIT = process.env.GIT_COMMIT ?? 'local';

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
  ready(): { status: ReadinessStatus; checks: Record<string, string>; timestamp: string } {
    const dead = this.outbox.listDead().length;
    const pending = this.outbox.listPending().length;
    const outboxOk = dead < 50;
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const memOk = memMb < 900;
    const overall: ReadinessStatus = outboxOk && memOk ? 'ready' : 'degraded';

    return {
      status: overall,
      checks: {
        api: 'ok',
        database: 'ok',
        outbox: outboxOk ? `ok (pending=${pending})` : `degraded (dead=${dead})`,
        memory: memOk ? `ok (${memMb}MB)` : `degraded (${memMb}MB)`,
        kafka: 'ok (mock)',
        redis: 'ok (mock)',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /** Detailed health per ТЗ 13.4 — for internal monitoring only */
  @Public()
  @Get('health/detailed')
  healthDetailed(): DetailedHealthCheck {
    const dead = this.outbox.listDead().length;
    const outboxOk: CheckStatus = dead === 0 ? 'ok' : dead < 50 ? 'degraded' : 'down';
    const memMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const checks = {
      api: 'ok' as CheckStatus,
      database: 'ok' as CheckStatus,
      outbox: outboxOk,
      kafka: 'ok' as CheckStatus,
      redis: 'ok' as CheckStatus,
      integrations: {
        fgis: 'ok' as CheckStatus,
        diadok: 'ok' as CheckStatus,
        cryptopro: 'ok' as CheckStatus,
        bank: 'ok' as CheckStatus,
        gps: 'ok' as CheckStatus,
        rzd: 'ok' as CheckStatus,
      },
    };

    const anyDegraded = Object.values(checks).some(
      (v) => (typeof v === 'string' ? v : Object.values(v).some((x) => x !== 'ok')) && v !== 'ok',
    );
    const overall: CheckStatus = anyDegraded ? 'degraded' : 'ok';

    return {
      status: overall,
      checks,
      details: {
        outboxDeadCount: dead,
        uptime: Math.round(process.uptime()),
        memoryMb: memMb,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('metrics')
  metrics(): string {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const dead = this.outbox.listDead().length;
    const pending = this.outbox.listPending().length;

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
      '# HELP grainflow_outbox_dead_total Dead outbox entries',
      '# TYPE grainflow_outbox_dead_total gauge',
      `grainflow_outbox_dead_total ${dead}`,
      '# HELP grainflow_outbox_pending_total Pending outbox entries',
      '# TYPE grainflow_outbox_pending_total gauge',
      `grainflow_outbox_pending_total ${pending}`,
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
}
