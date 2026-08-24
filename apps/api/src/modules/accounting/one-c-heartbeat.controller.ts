import { randomUUID } from 'node:crypto';
import {
  BadRequestException, Body, Controller, Get, Header, Headers, Post,
  ServiceUnavailableException, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  type OneCHeartbeatDiagnosticCode,
  type OneCHeartbeatReport,
  OneCHeartbeatValidationError,
  validateOneCHeartbeatReport,
} from './one-c-heartbeat.contract';
import {
  OneCHeartbeatRecordOutcome,
  OneCHeartbeatRepository,
  OneCHeartbeatRepositoryError,
} from './one-c-heartbeat.repository';

const AUTHORITY_LOST_CODES = new Set([
  'ONE_C_HEARTBEAT_CREDENTIAL_NOT_ACTIVE', 'ONE_C_HEARTBEAT_BINDING_NOT_ACTIVE',
  'ONE_C_HEARTBEAT_SCOPE_MISMATCH', 'ONE_C_HEARTBEAT_INSTALLATION_NOT_ACTIVE',
]);

@Controller('connector/v1')
export class OneCConnectorHeartbeatController {
  constructor(private readonly heartbeats: OneCHeartbeatRepository) {}

  @Public()
  @Post('heartbeat')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'one_c_connector_heartbeat', scope: 'ip', limit: 1200, windowSeconds: 300 })
  async heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body() rawBody: unknown,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const bearer = machineBearer(authorization);
    const report = parseHeartbeatBody(rawBody);
    try {
      const result = await this.heartbeats.record(bearer, report, safeCorrelationId(correlationId));
      if (result.outcome === OneCHeartbeatRecordOutcome.UNAUTHORIZED) throw machineUnauthorized();
      return { ...result, nextHeartbeatAfterSeconds: 60 };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof OneCHeartbeatRepositoryError) {
        if (AUTHORITY_LOST_CODES.has(error.code)) throw machineUnauthorized();
        if (error.code === 'ONE_C_HEARTBEAT_REFUSED') {
          throw new ServiceUnavailableException({ code: 'ONE_C_HEARTBEAT_UNAVAILABLE' });
        }
        throw new BadRequestException({ code: error.code });
      }
      if (error instanceof OneCHeartbeatValidationError) {
        throw new BadRequestException({ code: error.code });
      }
      throw error;
    }
  }
}

@UseGuards(RolesGuard)
@Roles('ADMIN', 'FARMER', 'BUYER', 'LOGISTICIAN', 'SURVEYOR', 'LAB', 'ELEVATOR', 'EXECUTIVE', 'GUEST')
@Controller('accounting/connections/one-c')
export class OneCHeartbeatManagementController {
  constructor(private readonly heartbeats: OneCHeartbeatRepository) {}

  @Get('runtime/heartbeat')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'accounting_one_c_heartbeat_read', scope: 'user', limit: 60, windowSeconds: 60 })
  describe(@CurrentUser() user: RequestUser) {
    return this.heartbeats.describe(user);
  }
}

function parseHeartbeatBody(raw: unknown): OneCHeartbeatReport {
  const body = record(raw, 'ONE_C_HEARTBEAT_BODY_INVALID');
  exactKeys(body, ['protocolVersion', 'connectorVersion', 'platformVersion', 'configurationVersion', 'health', 'diagnosticCodes'], 'ONE_C_HEARTBEAT_BODY_INVALID');
  if (!Array.isArray(body.diagnosticCodes) || body.diagnosticCodes.some((value) => typeof value !== 'string')) {
    throw new BadRequestException({ code: 'ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID' });
  }
  const report: OneCHeartbeatReport = {
    protocolVersion: requiredString(body, 'protocolVersion'),
    connectorVersion: requiredString(body, 'connectorVersion'),
    platformVersion: requiredString(body, 'platformVersion'),
    configurationVersion: requiredString(body, 'configurationVersion'),
    health: requiredString(body, 'health') as OneCHeartbeatReport['health'],
    diagnosticCodes: body.diagnosticCodes as OneCHeartbeatDiagnosticCode[],
  };
  try {
    validateOneCHeartbeatReport(report);
  } catch (error) {
    if (error instanceof OneCHeartbeatValidationError) {
      throw new BadRequestException({ code: error.code });
    }
    throw error;
  }
  return report;
}

function machineBearer(value: string | undefined): string {
  const match = /^Bearer ([0-9a-f-]{36}\.[A-Za-z0-9_-]{43})$/i.exec(String(value ?? '').trim());
  if (!match) throw machineUnauthorized();
  return match[1];
}

function machineUnauthorized(): UnauthorizedException {
  return new UnauthorizedException({ code: 'ONE_C_MACHINE_AUTH_REQUIRED' });
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException({ code });
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], code: string): void {
  const keys = Object.keys(value);
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) {
    throw new BadRequestException({ code });
  }
}

function requiredString(value: Record<string, unknown>, key: string): string {
  if (typeof value[key] !== 'string') {
    throw new BadRequestException({ code: `ONE_C_HEARTBEAT_${key.toUpperCase()}_INVALID` });
  }
  return value[key] as string;
}

function safeCorrelationId(value: string | undefined): string {
  const candidate = String(value ?? '').trim();
  return /^[A-Za-z0-9:_.@-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}
