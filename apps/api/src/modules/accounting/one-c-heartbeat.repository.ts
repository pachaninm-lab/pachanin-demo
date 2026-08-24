import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { Capability } from '../auth/membership-capability.resolver';
import {
  type OneCHeartbeatDiagnosticCode,
  type OneCHeartbeatHealth,
  type OneCHeartbeatReport,
  validateOneCHeartbeatReport,
} from './one-c-heartbeat.contract';
import {
  OneCHumanRefusal,
  type OneCMachineAuthenticationDenial,
  OneCRuntimeRepository,
} from './one-c-runtime.repository';
import { WorkTaskRepository } from './work-task.repository';

export const OneCHeartbeatRecordOutcome = {
  ACCEPTED: 'ACCEPTED',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;
export const OneCHeartbeatReadOutcome = {
  AVAILABLE: 'AVAILABLE',
  NOT_REPORTED: 'NOT_REPORTED',
  REFUSED: 'REFUSED',
} as const;

export class OneCHeartbeatRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'OneCHeartbeatRepositoryError';
  }
}

export interface OneCHeartbeatAccepted {
  readonly outcome: typeof OneCHeartbeatRecordOutcome.ACCEPTED;
  readonly receivedAt: Date;
  readonly health: OneCHeartbeatHealth;
  readonly diagnosticCodes: readonly OneCHeartbeatDiagnosticCode[];
  readonly heartbeatCount: string;
}

interface HeartbeatWriteRow {
  receivedAt: Date;
  healthState: OneCHeartbeatHealth;
  diagnosticCodes: OneCHeartbeatDiagnosticCode[];
  heartbeatCount: bigint;
}

interface HeartbeatReadRow {
  bindingId: string;
  lastHeartbeatAt: Date;
  healthState: OneCHeartbeatHealth;
  diagnosticCodes: OneCHeartbeatDiagnosticCode[];
  reportedConnectorVersion: string;
  reportedPlatformVersion: string;
  reportedConfigurationVersion: string;
  heartbeatCount: bigint;
}

@Injectable()
export class OneCHeartbeatRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
    private readonly runtime: OneCRuntimeRepository,
  ) {}

  async record(
    bearer: string,
    report: OneCHeartbeatReport,
    correlationId: string,
    now: Date = new Date(),
  ): Promise<
    | OneCHeartbeatAccepted
    | {
        readonly outcome: typeof OneCHeartbeatRecordOutcome.UNAUTHORIZED;
        readonly reason: OneCMachineAuthenticationDenial;
      }
  > {
    validateOneCHeartbeatReport(report);
    const authentication = await this.runtime.authenticateMachineBearer(bearer, undefined, now);
    if (authentication.authorized === false) {
      return { outcome: OneCHeartbeatRecordOutcome.UNAUTHORIZED, reason: authentication.reason };
    }
    const diagnostics = report.diagnosticCodes.length === 0
      ? Prisma.sql`ARRAY[]::text[]`
      : Prisma.sql`ARRAY[${Prisma.join([...report.diagnosticCodes])}]::text[]`;
    try {
      const rows = await this.prisma.$queryRaw<HeartbeatWriteRow[]>(Prisma.sql`
        SELECT received_at AS "receivedAt", health_state AS "healthState",
               diagnostic_codes AS "diagnosticCodes", heartbeat_count AS "heartbeatCount"
          FROM connector.record_one_c_heartbeat(
            ${authentication.credentialId}, ${report.protocolVersion},
            ${report.connectorVersion.trim()}, ${report.platformVersion.trim()},
            ${report.configurationVersion.trim()}, ${report.health},
            ${diagnostics}, ${correlationId}
          )
      `);
      const row = rows[0];
      if (!row) throw new OneCHeartbeatRepositoryError('ONE_C_HEARTBEAT_RESULT_NOT_RETURNED');
      return {
        outcome: OneCHeartbeatRecordOutcome.ACCEPTED,
        receivedAt: row.receivedAt,
        health: row.healthState,
        diagnosticCodes: row.diagnosticCodes,
        heartbeatCount: row.heartbeatCount.toString(),
      };
    } catch (error) {
      if (error instanceof OneCHeartbeatRepositoryError) throw error;
      throw new OneCHeartbeatRepositoryError(databaseCode(error));
    }
  }

  async describe(user: RequestUser | undefined) {
    return this.transactions.withOrganizationMemberContext(user, async (tx) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      if (!capabilities.includes(Capability.INTEGRATIONS_READ)) {
        return {
          outcome: OneCHeartbeatReadOutcome.REFUSED,
          heartbeat: null,
          refusal: OneCHumanRefusal.CAPABILITY_REQUIRED,
        } as const;
      }
      const rows = await tx.$queryRaw<HeartbeatReadRow[]>(Prisma.sql`
        SELECT binding_id AS "bindingId", last_heartbeat_at AS "lastHeartbeatAt",
               health_state AS "healthState", diagnostic_codes AS "diagnosticCodes",
               reported_connector_version AS "reportedConnectorVersion",
               reported_platform_version AS "reportedPlatformVersion",
               reported_configuration_version AS "reportedConfigurationVersion",
               heartbeat_count AS "heartbeatCount"
          FROM connector.read_one_c_runtime_state()
      `);
      const row = rows[0];
      if (!row) return { outcome: OneCHeartbeatReadOutcome.NOT_REPORTED, heartbeat: null } as const;
      return {
        outcome: OneCHeartbeatReadOutcome.AVAILABLE,
        heartbeat: {
          bindingId: row.bindingId,
          lastHeartbeatAt: row.lastHeartbeatAt,
          health: row.healthState,
          diagnosticCodes: row.diagnosticCodes,
          reportedConnectorVersion: row.reportedConnectorVersion,
          reportedPlatformVersion: row.reportedPlatformVersion,
          reportedConfigurationVersion: row.reportedConfigurationVersion,
          heartbeatCount: row.heartbeatCount.toString(),
        },
      } as const;
    });
  }
}

const CODES = new Set([
  'ONE_C_HEARTBEAT_CREDENTIAL_INVALID', 'ONE_C_CORRELATION_ID_INVALID',
  'ONE_C_HEARTBEAT_PROTOCOL_INVALID', 'ONE_C_HEARTBEAT_VERSION_INVALID',
  'ONE_C_HEARTBEAT_HEALTH_INVALID', 'ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID',
  'ONE_C_HEARTBEAT_CREDENTIAL_NOT_ACTIVE', 'ONE_C_HEARTBEAT_BINDING_NOT_ACTIVE',
  'ONE_C_HEARTBEAT_SCOPE_MISMATCH', 'ONE_C_HEARTBEAT_INSTALLATION_NOT_ACTIVE',
  'ONE_C_HEARTBEAT_PROTOCOL_MISMATCH',
]);

function databaseCode(error: unknown): string {
  const text = error instanceof Prisma.PrismaClientKnownRequestError
    ? `${error.message} ${String(error.meta?.message ?? '')}`
    : error instanceof Error ? error.message : '';
  for (const code of CODES) if (text.includes(code)) return code;
  return 'ONE_C_HEARTBEAT_REFUSED';
}
