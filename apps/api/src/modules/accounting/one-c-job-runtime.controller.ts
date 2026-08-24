import { randomUUID } from 'node:crypto';
import {
  BadRequestException, Body, ConflictException, Controller, Get, Header, Headers,
  Param, Post, Query, ServiceUnavailableException, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import type { IntegrationFailureClass } from './integration-command.policy';
import {
  OneCJobRuntimeValidationError,
  OneCJobStatus,
  type OneCFailureEffectState,
  type OneCReconciliationAction,
  type OneCJobFailureReport,
  type OneCJobReconciliationCommand,
  type OneCJobResultReport,
} from './one-c-job-runtime.contract';
import {
  OneCJobMachineOutcome,
  OneCJobRuntimeRepository,
  OneCJobRuntimeRepositoryError,
} from './one-c-job-runtime.repository';

@Controller('connector/v1')
export class OneCConnectorJobController {
  constructor(private readonly jobs: OneCJobRuntimeRepository) {}

  @Public()
  @Get('jobs')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'one_c_connector_jobs', scope: 'ip', limit: 600, windowSeconds: 300 })
  async lease(
    @Headers('authorization') authorization: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.machineCall(() => this.jobs.leaseJobs(
      machineBearer(authorization), boundedLimit(rawLimit), safeCorrelationId(correlationId),
    ));
  }

  @Public()
  @Post('jobs/:id/ack')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'one_c_connector_job_ack', scope: 'ip', limit: 1200, windowSeconds: 300, includeParams: ['id'] })
  async acknowledge(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-one-c-job-lease') lease: string | undefined,
    @Body() rawBody: unknown,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const body = receiptEnvelope(rawBody);
    return this.machineCall(() => this.jobs.acknowledge(
      machineBearer(authorization), leaseBearer(lease), safeId(id), body,
      safeCorrelationId(correlationId),
    ));
  }

  @Public()
  @Post('jobs/:id/result')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'one_c_connector_job_result', scope: 'ip', limit: 1200, windowSeconds: 300, includeParams: ['id'] })
  async complete(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-one-c-job-lease') lease: string | undefined,
    @Body() rawBody: unknown,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.machineCall(() => this.jobs.complete(
      machineBearer(authorization), leaseBearer(lease), safeId(id), resultReport(rawBody),
      safeCorrelationId(correlationId),
    ));
  }

  @Public()
  @Post('jobs/:id/fail')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'one_c_connector_job_fail', scope: 'ip', limit: 1200, windowSeconds: 300, includeParams: ['id'] })
  async fail(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-one-c-job-lease') lease: string | undefined,
    @Body() rawBody: unknown,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.machineCall(() => this.jobs.fail(
      machineBearer(authorization), leaseBearer(lease), safeId(id), failureReport(rawBody),
      safeCorrelationId(correlationId),
    ));
  }

  private async machineCall<T extends { outcome: string }>(work: () => Promise<T>): Promise<T> {
    try {
      const result = await work();
      if (result.outcome === OneCJobMachineOutcome.UNAUTHORIZED) throw machineUnauthorized();
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof OneCJobRuntimeValidationError) {
        throw new BadRequestException({ code: error.code });
      }
      if (error instanceof OneCJobRuntimeRepositoryError) {
        if (AUTHORITY_CODES.has(error.code)) throw machineUnauthorized();
        if (CONFLICT_CODES.has(error.code)) throw new ConflictException({ code: error.code });
        if (error.code === 'ONE_C_JOB_RUNTIME_REFUSED') {
          throw new ServiceUnavailableException({ code: 'ONE_C_JOB_RUNTIME_UNAVAILABLE' });
        }
        throw new BadRequestException({ code: error.code });
      }
      throw error;
    }
  }
}

@UseGuards(RolesGuard)
@Roles('ADMIN', 'FARMER', 'BUYER', 'LOGISTICIAN', 'SURVEYOR', 'LAB', 'ELEVATOR', 'EXECUTIVE', 'GUEST')
@Controller('accounting/connections/one-c/runtime/jobs')
export class OneCJobManagementController {
  constructor(private readonly jobs: OneCJobRuntimeRepository) {}

  @Get()
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'accounting_one_c_job_read', scope: 'user', limit: 60, windowSeconds: 60 })
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') rawStatus: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const status = rawStatus === undefined ? undefined : jobStatus(rawStatus);
    return this.jobs.describeJobs(user, {
      status,
      limit: boundedLimit(rawLimit, 50, 100),
      correlationId: safeCorrelationId(correlationId),
    });
  }

  @Post(':id/reconcile')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Pragma', 'no-cache')
  @RateLimit({ name: 'accounting_one_c_job_reconcile', scope: 'user', limit: 20, windowSeconds: 900, includeParams: ['id'] })
  reconcile(
    @Param('id') id: string,
    @Body() rawBody: unknown,
    @CurrentUser() user: RequestUser,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.jobs.reconcile(
      user, safeId(id), reconciliationCommand(rawBody), safeCorrelationId(correlationId),
    );
  }
}

function receiptEnvelope(raw: unknown) {
  const body = exactRecord(raw, ['idempotencyKey', 'payloadHash', 'revision', 'attempt'], 'ONE_C_JOB_RECEIPT_BODY_INVALID');
  return {
    idempotencyKey: stringField(body, 'idempotencyKey'),
    payloadHash: stringField(body, 'payloadHash'),
    revision: integerField(body, 'revision'),
    attempt: integerField(body, 'attempt'),
  };
}

function resultReport(raw: unknown): OneCJobResultReport {
  const body = exactRecord(raw, [
    'idempotencyKey', 'payloadHash', 'revision', 'attempt', 'resultState',
    'resultCode', 'externalEvidenceId',
  ], 'ONE_C_JOB_RESULT_BODY_INVALID');
  return {
    ...receiptEnvelopeSubset(body),
    resultState: stringField(body, 'resultState') as OneCJobResultReport['resultState'],
    resultCode: stringField(body, 'resultCode'),
    externalEvidenceId: stringField(body, 'externalEvidenceId'),
  };
}

function failureReport(raw: unknown): OneCJobFailureReport {
  const body = exactRecord(raw, [
    'idempotencyKey', 'payloadHash', 'revision', 'attempt', 'failureClass',
    'effectState', 'resultCode',
  ], 'ONE_C_JOB_FAILURE_BODY_INVALID');
  return {
    ...receiptEnvelopeSubset(body),
    failureClass: stringField(body, 'failureClass') as IntegrationFailureClass,
    effectState: stringField(body, 'effectState') as OneCFailureEffectState,
    resultCode: stringField(body, 'resultCode'),
  };
}

function receiptEnvelopeSubset(body: Record<string, unknown>) {
  return {
    idempotencyKey: stringField(body, 'idempotencyKey'),
    payloadHash: stringField(body, 'payloadHash'),
    revision: integerField(body, 'revision'),
    attempt: integerField(body, 'attempt'),
  };
}

function reconciliationCommand(raw: unknown): OneCJobReconciliationCommand {
  const body = exactRecord(raw, [
    'idempotencyKey', 'action', 'reasonCode', 'externalEvidenceId',
  ], 'ONE_C_JOB_RECONCILIATION_BODY_INVALID');
  if (body.externalEvidenceId !== null && typeof body.externalEvidenceId !== 'string') {
    throw new BadRequestException({ code: 'ONE_C_JOB_EXTERNAL_EVIDENCE_INVALID' });
  }
  return {
    idempotencyKey: stringField(body, 'idempotencyKey'),
    action: stringField(body, 'action') as OneCReconciliationAction,
    reasonCode: stringField(body, 'reasonCode'),
    externalEvidenceId: body.externalEvidenceId as string | null,
  };
}

function exactRecord(raw: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException({ code });
  const body = raw as Record<string, unknown>;
  const actual = Object.keys(body);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new BadRequestException({ code });
  }
  return body;
}

function stringField(body: Record<string, unknown>, key: string): string {
  if (typeof body[key] !== 'string') throw new BadRequestException({ code: 'ONE_C_JOB_BODY_INVALID' });
  return body[key] as string;
}

function integerField(body: Record<string, unknown>, key: string): number {
  if (!Number.isSafeInteger(body[key])) throw new BadRequestException({ code: 'ONE_C_JOB_BODY_INVALID' });
  return body[key] as number;
}

function machineBearer(value: string | undefined): string {
  const match = /^Bearer ([0-9a-f-]{36}\.[A-Za-z0-9_-]{43})$/i.exec(String(value ?? '').trim());
  if (!match) throw machineUnauthorized();
  return match[1];
}

function leaseBearer(value: string | undefined): string {
  const match = /^Bearer ([0-9a-f-]{36}\.[A-Za-z0-9_-]{43})$/i.exec(String(value ?? '').trim());
  if (!match) throw machineUnauthorized();
  return match[1];
}

function machineUnauthorized(): UnauthorizedException {
  return new UnauthorizedException({ code: 'ONE_C_MACHINE_AUTH_REQUIRED' });
}

function safeId(value: string): string {
  if (!/^[A-Za-z0-9:_.@-]{1,240}$/.test(String(value ?? ''))) {
    throw new BadRequestException({ code: 'ONE_C_JOB_ID_INVALID' });
  }
  return value;
}

function safeCorrelationId(value: string | undefined): string {
  const candidate = String(value ?? '').trim();
  return /^[A-Za-z0-9:_.@-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}

function boundedLimit(value: string | undefined, fallback = 10, max = 25): number {
  if (value === undefined) return fallback;
  if (!/^[0-9]{1,3}$/.test(value)) throw new BadRequestException({ code: 'ONE_C_JOB_LIMIT_INVALID' });
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new BadRequestException({ code: 'ONE_C_JOB_LIMIT_INVALID' });
  }
  return parsed;
}

function jobStatus(value: string): OneCJobStatus {
  if (!(Object.values(OneCJobStatus) as readonly string[]).includes(value)) {
    throw new BadRequestException({ code: 'ONE_C_JOB_STATUS_INVALID' });
  }
  return value as OneCJobStatus;
}

const AUTHORITY_CODES = new Set([
  'ONE_C_JOB_CREDENTIAL_NOT_ACTIVE', 'ONE_C_JOB_BINDING_NOT_ACTIVE',
  'ONE_C_JOB_INSTALLATION_NOT_ACTIVE', 'ONE_C_JOB_LEASE_NOT_FOUND',
  'ONE_C_JOB_LEASE_NOT_ACTIVE', 'ONE_C_JOB_LEASE_NOT_ACKNOWLEDGED',
]);
const CONFLICT_CODES = new Set([
  'ONE_C_JOB_RECEIPT_IDEMPOTENCY_CONFLICT', 'ONE_C_JOB_RECEIPT_ENVELOPE_MISMATCH',
  'ONE_C_JOB_RECONCILIATION_NOT_REQUIRED', 'ONE_C_JOB_ACTIVE_LEASE_PRESENT',
  'ONE_C_JOB_MAX_ATTEMPTS_EXHAUSTED',
]);
