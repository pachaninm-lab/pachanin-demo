import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { OneCRuntimeRepository } from './one-c-runtime.repository';

/**
 * Human Connection Center management for the 1C connector.
 *
 * `GUEST` is present only because the organization-accountant compatibility
 * model uses `role=GUEST + job_profile=...`. Role is merely an HTTP admission
 * ceiling: the repository still requires a PostgreSQL-proven ACTIVE membership
 * plus exact durable capabilities and fresh MFA for risky actions.
 */
@UseGuards(RolesGuard)
@Roles(
  'ADMIN',
  'FARMER',
  'BUYER',
  'LOGISTICIAN',
  'SURVEYOR',
  'LAB',
  'ELEVATOR',
  'EXECUTIVE',
  'GUEST',
)
@Controller('accounting/connections/one-c')
export class OneCConnectionManagementController {
  constructor(private readonly runtime: OneCRuntimeRepository) {}

  @Post('pairing-challenge')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({
    name: 'accounting_one_c_pairing_challenge',
    scope: 'user',
    limit: 5,
    windowSeconds: 300,
  })
  createPairingChallenge(
    @CurrentUser() user: RequestUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.runtime.createPairingChallenge(user, {
      correlationId: safeCorrelationId(correlationId),
      ttlSeconds: 600,
    });
  }

  @Get('runtime')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({
    name: 'accounting_one_c_runtime_read',
    scope: 'user',
    limit: 60,
    windowSeconds: 60,
  })
  describe(@CurrentUser() user: RequestUser) {
    return this.runtime.describeBinding(user);
  }

  @Post(':bindingId/revoke')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({
    name: 'accounting_one_c_binding_revoke',
    scope: 'user',
    limit: 10,
    windowSeconds: 900,
    includeParams: ['bindingId'],
  })
  revoke(
    @Param('bindingId') bindingId: string,
    @Body() body: unknown,
    @CurrentUser() user: RequestUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const reason = revokeReason(body);
    return this.runtime.revokeBinding(user, {
      bindingId: safeIdentifier(bindingId, 'bindingId'),
      reason,
      correlationId: safeCorrelationId(correlationId),
    });
  }
}

function revokeReason(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException({ code: 'ONE_C_REVOKE_REASON_REQUIRED' });
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== 'reasonCode')) {
    throw new BadRequestException({ code: 'ONE_C_REVOKE_BODY_INVALID' });
  }
  const value = record.reasonCode;
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_.:-]{7,95}$/.test(value)) {
    throw new BadRequestException({ code: 'ONE_C_REVOKE_REASON_INVALID' });
  }
  return value;
}

function safeCorrelationId(value: string | undefined): string {
  const candidate = String(value ?? '').trim();
  return /^[A-Za-z0-9:_.@-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}

function safeIdentifier(value: string, field: string): string {
  if (!/^[A-Za-z0-9:_.@-]{1,240}$/.test(String(value ?? ''))) {
    throw new BadRequestException({ code: `ONE_C_${field.toUpperCase()}_INVALID` });
  }
  return value;
}
