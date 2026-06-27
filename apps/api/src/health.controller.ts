import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { OutboxService } from './common/outbox/outbox.service';

const APP_VERSION = process.env.APP_VERSION ?? '3.0.0';
const BUILD_DATE = process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
const GIT_COMMIT = process.env.GIT_COMMIT ?? 'local';

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
  ready(): { status: string; checks: Record<string, string>; timestamp: string } {
    const dead = this.outbox.listDead().length;
    const outboxOk = dead < 50;
    return {
      status: outboxOk ? 'ready' : 'degraded',
      checks: {
        api: 'ok',
        outbox: outboxOk ? 'ok' : `degraded (${dead} dead entries)`,
      },
      timestamp: new Date().toISOString(),
    };
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
