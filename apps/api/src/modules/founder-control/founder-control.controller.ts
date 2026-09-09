import { Body, Controller, Get, Headers, Param, Put, Query } from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { FounderControlService } from './founder-control.service';

@Controller('founder-control')
export class FounderControlController {
  constructor(private readonly service: FounderControlService) {}

  @Get('spec')
  @RateLimit({ name: 'founder_control_spec', scope: 'user', limit: 60, windowSeconds: 60 })
  spec(@CurrentUser() user: RequestUser) {
    return this.service.spec(user);
  }

  @Get('overview')
  @RateLimit({ name: 'founder_control_overview', scope: 'user', limit: 120, windowSeconds: 60 })
  overview(@CurrentUser() user: RequestUser) {
    return this.service.overview(user);
  }

  @Get('records')
  @RateLimit({ name: 'founder_control_records', scope: 'user', limit: 120, windowSeconds: 60 })
  records(@CurrentUser() user: RequestUser, @Query('type') type?: string) {
    return this.service.list(user, type);
  }

  @Get('events')
  @RateLimit({ name: 'founder_control_events', scope: 'user', limit: 60, windowSeconds: 60 })
  events(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.service.events(user, limit ? Number(limit) : undefined);
  }

  @Put('records/:recordType/:recordKey')
  @RateLimit({ name: 'founder_control_write', scope: 'user', limit: 120, windowSeconds: 60, includeParams: ['recordType'] })
  upsert(
    @Param('recordType') recordType: string,
    @Param('recordKey') recordKey: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.upsert(user, recordType, recordKey, body, idempotencyKey, correlationId);
  }
}
