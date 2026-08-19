import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  ONE_C_HEARTBEAT_DIAGNOSTIC_CODES,
  OneCHeartbeatHealth,
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

const NEXT_HEARTBEAT_AFTER_SECONDS = 60;
const AUTHORITY_LOST_CODES = new Set([
  'ONE_C_HEARTBEAT_CREDENTIAL_NOT_ACTIVE',
  'ONE_C_HEARTBEAT_BINDING_NOT_ACTIVE',
  'ONE_C_HEARTBEAT_SCOPE_MISMATCH',
  'ONE_C_HEARTBEAT_INSTALLATION_NOT_ACTIVE',
]);

/** Machine endpoint: framework-public, but unusable without the connector bearer. */
@Controller('connector/v1')
export class OneCConnectorHeartbeatController {
  constructor(private readonly heartbeats: OneCHeartbeatRepository) {}

  @Public()
  @Post('heartbeat')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({
    name: 'one_c_connector_heartbeat',
    scope: 'ip',
    limit: 1200,
    windowSeconds: 300,
  })
  async heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body() rawBody: unknown,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const bearer = machineBearer(authorization);
    let report: OneCHeartbeatReport;
    try {
      report = parseHeartbeatBody(rawBody);
    } catch (error) {
      if (error instanceof OneCHeartbeatValidationError) {
        throw new BadRequestException({ code: error.code });
      }
      throw error;
    }

    try {
      const result = await this.heartbeats.record(
        bearer,
        report,
        safeCorrelationId(correlationId),
      );
      if (result.outcome === OneCHeartbeatRecordOutcome.UNAUTHORIZED) {
        // Deliberately do not distinguish unknown, expired, revoked or wrong-secret
        // credentials at the HTTP boundary.
        throw machineUnauthorized();
      }
      return {
        outcome: result.outcome,
        receivedAt: result.receivedAt,
        health: result.health,
        diagnosticCodes: result.diagnosticCodes,
        heartbeatCount: result.heartbeatCount,
        nextHeartbeatAfterSeconds: NEXT_HEARTBEAT_AFTER_SECONDS,
      };
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

/** Human-safe Connection Center projection. No verifier or secret material. */
@UseGuards(RolesGuard)
@Roles('ADMIN', 'FARMER', 'BUYER', 'GUEST')
@Controller('accounting/connections/one-c')
export class OneCHeartbeatManagementController {
  constructor(private readonly heartbeats: OneCHeartbeatRepository) {}

  @Get('runtime/heartbeat')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({
    name: 'accounting_one_c_heartbeat_read',
    scope: 'user',
    limit: 60,
    windowSeconds: 60,
  })
  describe(@CurrentUser() user: RequestUser) {
    return this.heartbeats.describe(user);
  }
}

function parseHeartbeatBody(raw: unknown): OneCHeartbeatReport {
  const body = record(raw, 'ONE_C_HEARTBEAT_BODY_INVALID');
  exactKeys(
    body,
    [
      'protocolVersion',
      'connectorVersion',
      'platformVersion',
      'configurationVersion',
      'health',
      'diagnosticCodes',
    ],
    'ONE_C_HEARTBEAT_BODY_INVALID',
  );

  const protocolVersion = requiredString(body, 'protocolVersion');
  const connectorVersion = requiredString(body, 'connectorVersion');
  const platformVersion = requiredString(body, 'platformVersion');
  const configurationVersion = requiredString(body, 'configurationVersion');
  const health = requiredString(body, 'health');
  if (!Array.isArray(body.diagnosticCodes)) {
    throw new BadRequestException({ code: 'ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID' });
  }
  if (body.diagnosticCodes.some((value) => typeof value !== 'string')) {
    throw new BadRequestException({ code: 'ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID' });
  }

  const report: OneCHeartbeatReport = {
    protocolVersion,
    connectorVersion,
    platformVersion,
    configurationVersion,
    health: health as OneCHeartbeatReport['health'],
    diagnosticCodes: body.diagnosticCodes as OneCHeartbeatDiagnosticCode[],
  };
  validateOneCHeartbeatReport(report);
  return report;
}

function machineBearer(value: string | undefined): string {
  const candidate = String(value ?? '').trim();
  const match = /^Bearer ([^\s]{40,256})$/.exec(candidate);
  if (!match) throw machineUnauthorized();
  return match[1];
}

function machineUnauthorized(): UnauthorizedException {
  return new UnauthorizedException({ code: 'ONE_C_MACHINE_AUTH_REQUIRED' });
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException({ code });
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: string,
): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).length !== allowed.length) {
    throw new BadRequestException({ code });
  }
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw new BadRequestException({ code });
  }
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string') {
    throw new BadRequestException({ code: `ONE_C_HEARTBEAT_${key.toUpperCase()}_INVALID` });
  }
  return candidate;
}

function safeCorrelationId(value: string | undefined): string {
  const candidate = String(value ?? '').trim();
  return /^[A-Za-z0-9:_.@-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}

// Keep these imports exercised by the controller contract and make accidental
// expansion of accepted values visible to static review.
void OneCHeartbeatHealth;
void ONE_C_HEARTBEAT_DIAGNOSTIC_CODES;
