import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../../common/types/request-user';
import {
  FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
  assertFgisGrainTenantReadAttestationInput,
  assertFgisGrainTenantReadAuthorizationInput,
  assertFgisGrainTenantReadRequestInput,
  canonicalFgisGrainTenantReadHash,
  type FgisGrainReadOperationCode,
  type FgisGrainTenantReadAttestationInput,
  type FgisGrainTenantReadAuthorizationInput,
  type FgisGrainTenantReadAuthorizationView,
  type FgisGrainTenantReadRequestInput,
  type FgisGrainTenantReadTransportResult,
} from './fgis-grain-tenant-read.contract';
import {
  FGIS_GRAIN_TENANT_READ_TRANSPORT,
  type FgisGrainTenantReadTransport,
} from './fgis-grain-tenant-read.transport';

const MANAGEMENT_ROLES = new Set<Role>([
  Role.EXECUTIVE,
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
]);
const ATTESTATION_ROLES = new Set<Role>([
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
]);
const READ_ROLES = new Set<Role>([
  Role.FARMER,
  Role.BUYER,
  Role.LOGISTICIAN,
  Role.ELEVATOR,
  Role.LAB,
  Role.ACCOUNTING,
  Role.EXECUTIVE,
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.SUPPORT_MANAGER,
]);
const PROVIDER_GATES = ['OWNER', 'SECURITY', 'LEGAL', 'OPERATIONS'] as const;

type TrustedContext = Readonly<{
  tenantId: string;
  orgId: string;
  userId: string;
  role: string;
}>;

type AuthorizationRow = Readonly<{
  id: string;
  tenantId: string;
  organizationId: string;
  configurationId: string;
  configurationVersion: bigint;
  allowedOperations: string[];
  authorizationReference: string;
  status: 'ACCESS_REQUIRED' | 'AUTHORIZED_NOT_ATTESTED' | 'READ_ONLY_ATTESTED' | 'SUSPENDED' | 'REVOKED';
  validUntil: Date;
  attestationEvidenceReference: string | null;
  attestationValidUntil: Date | null;
  version: bigint;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}>;

type ProviderConfigurationRow = Readonly<{
  id: string;
  tenantId: string;
  organizationId: string;
  environment: 'PRE_PRODUCTION' | 'PRODUCTION';
  endpointReference: string;
  tlsPolicyReference: string;
  credentialReference: string;
  status: string;
  version: bigint;
}>;

type ProviderGateRow = Readonly<{
  gate: string;
  decision: string;
  configurationVersion: bigint;
  actorUserId: string;
  validUntil: Date;
}>;

type AuditRow = Readonly<{
  id: string;
  authorizationId: string;
  authorizationVersion: bigint;
  operationCode: string;
  correlationId: string;
  requestIdempotencyKey: string;
  requestReference: string;
  requestSha256: string;
  decision: string;
  providerRequestId: string | null;
  responseReference: string | null;
  responseSha256: string | null;
  receivedAt: Date | null;
  reasonCode: string;
}>;

type AuditPhase = 'CLAIM' | 'DENIED' | 'OUTCOME';

export interface FgisGrainTenantReadReceipt {
  readonly authorizationId: string;
  readonly authorizationVersion: string;
  readonly state: AuthorizationRow['status'];
  readonly operationalStatus: typeof FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS;
}

export interface FgisGrainTenantReadExecutionReceipt {
  readonly authorizationId: string;
  readonly authorizationVersion: string;
  readonly operationCode: FgisGrainReadOperationCode;
  readonly correlationId: string;
  readonly providerRequestId: string;
  readonly responseReference: string;
  readonly responseSha256: string;
  readonly receivedAt: string;
  readonly replayed: boolean;
  readonly operationalStatus: typeof FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS;
}

function requireMfa(user: RequestUser, message: string): void {
  if (user.mfaVerified !== true) throw new ForbiddenException(message);
}

function requireManagement(user: RequestUser): void {
  if (!MANAGEMENT_ROLES.has(user.role)) {
    throw new ForbiddenException('FGIS Grain read authorization management is not permitted');
  }
  requireMfa(user, 'MFA is required for FGIS Grain read authorization management');
}

function requireAttestation(user: RequestUser): void {
  if (!ATTESTATION_ROLES.has(user.role)) {
    throw new ForbiddenException('FGIS Grain external-read attestation is not permitted');
  }
  requireMfa(user, 'MFA is required for FGIS Grain external-read attestation');
}

function requireRead(user: RequestUser): void {
  if (!READ_ROLES.has(user.role)) {
    throw new ForbiddenException('FGIS Grain tenant read access is not permitted');
  }
}

function executionAuditKey(idempotencyKey: string, phase: AuditPhase): string {
  const digest = createHash('sha256')
    .update(`${phase}:${idempotencyKey}`)
    .digest('hex');
  return `fgis-read:${phase.toLowerCase()}:${digest}`;
}

function view(row: AuthorizationRow, transportAvailable: boolean): FgisGrainTenantReadAuthorizationView {
  const blockers: string[] = [];
  const now = Date.now();
  if (row.status === 'ACCESS_REQUIRED') blockers.push('TENANT_AUTHORIZATION_REQUIRED');
  if (row.status === 'AUTHORIZED_NOT_ATTESTED') blockers.push('EXTERNAL_READ_EVIDENCE_REQUIRED');
  if (row.status === 'SUSPENDED') blockers.push('AUTHORIZATION_SUSPENDED');
  if (row.status === 'REVOKED') blockers.push('AUTHORIZATION_REVOKED');
  if (row.validUntil.getTime() <= now) blockers.push('AUTHORIZATION_EXPIRED');
  if (!row.attestationValidUntil || row.attestationValidUntil.getTime() <= now) {
    blockers.push('EXTERNAL_READ_ATTESTATION_MISSING_OR_EXPIRED');
  }
  if (!transportAvailable) blockers.push('PROVIDER_TRANSPORT_DISABLED');
  return {
    id: row.id,
    configurationId: row.configurationId,
    configurationVersion: row.configurationVersion.toString(),
    allowedOperations: row.allowedOperations as FgisGrainReadOperationCode[],
    authorizationReference: row.authorizationReference,
    status: row.status,
    validUntil: row.validUntil.toISOString(),
    attestationEvidenceReference: row.attestationEvidenceReference,
    attestationValidUntil: row.attestationValidUntil?.toISOString() ?? null,
    version: row.version.toString(),
    blockers: [...new Set(blockers)],
    transportAvailable,
    operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
  };
}

@Injectable()
export class FgisGrainTenantReadRepository {
  constructor(
    private readonly transactions: RlsTransactionService,
    @Inject(FGIS_GRAIN_TENANT_READ_TRANSPORT)
    private readonly transport: FgisGrainTenantReadTransport,
  ) {}

  async authorize(
    user: RequestUser,
    raw: FgisGrainTenantReadAuthorizationInput,
  ): Promise<FgisGrainTenantReadReceipt> {
    requireManagement(user);
    const input = assertFgisGrainTenantReadAuthorizationInput(raw);
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        await this.requireProviderAuthority(
          tx,
          context,
          input.configurationId,
          BigInt(input.configurationVersion),
        );
        const current = await this.findAuthorizationByConfiguration(
          tx,
          context,
          input.configurationId,
        );
        const authorizationId = current?.id ?? randomUUID();
        if (current?.status === 'REVOKED') {
          throw new ConflictException('Revoked tenant read authorization cannot be reused');
        }
        const written = await tx.$queryRaw<Array<{ authorizationVersion: bigint }>>(Prisma.sql`
          SELECT command.authorization_version AS "authorizationVersion"
          FROM public.write_fgis_grain_tenant_read_authorization(
            ${authorizationId},
            ${input.configurationId},
            ${BigInt(input.configurationVersion)},
            ARRAY[${Prisma.join(input.allowedOperations)}]::text[],
            ${input.authorizationReference},
            ${new Date(input.validUntil)},
            ${input.reason},
            ${current?.version ?? null}::bigint
          ) AS command
        `);
        const nextVersion = written[0]?.authorizationVersion;
        if (nextVersion === undefined) {
          throw new PreconditionFailedException('Authorization command returned no version');
        }
        await this.writeAudit(tx, {
          authorizationId,
          authorizationVersion: nextVersion,
          configurationId: input.configurationId,
          operationCode: 'AUTHORIZE',
          correlationId: `authorization:${authorizationId}:${nextVersion}`,
          idempotencyKey: `authorization:${authorizationId}:${nextVersion}`,
          requestIdempotencyKey: `authorization:${authorizationId}:${nextVersion}`,
          requestReference: input.authorizationReference,
          requestSha256: canonicalFgisGrainTenantReadHash(input),
          decision: 'AUTHORIZED',
          reasonCode: 'TENANT_READ_AUTHORIZATION_RECORDED',
        });
        return {
          authorizationId,
          authorizationVersion: nextVersion.toString(),
          state: 'AUTHORIZED_NOT_ATTESTED',
          operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async attest(
    user: RequestUser,
    raw: FgisGrainTenantReadAttestationInput,
  ): Promise<FgisGrainTenantReadReceipt> {
    requireAttestation(user);
    if (!this.transport.available) {
      throw new ServiceUnavailableException({
        code: 'FGIS_GRAIN_READ_TRANSPORT_DISABLED',
        retryable: false,
        operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
      });
    }
    const input = assertFgisGrainTenantReadAttestationInput(raw);
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const authorization = await this.findAuthorization(tx, context, input.authorizationId);
        if (!authorization) {
          throw new NotFoundException('FGIS Grain read authorization not found');
        }
        if (authorization.version !== BigInt(input.authorizationVersion)) {
          throw new PreconditionFailedException('Authorization version changed');
        }
        if (authorization.status !== 'AUTHORIZED_NOT_ATTESTED') {
          throw new ConflictException('Authorization is not awaiting external read evidence');
        }
        if (authorization.validUntil.getTime() <= Date.now()) {
          throw new ConflictException('Authorization expired');
        }
        await this.requireProviderAuthority(
          tx,
          context,
          authorization.configurationId,
          authorization.configurationVersion,
        );
        const written = await tx.$queryRaw<Array<{ authorizationVersion: bigint }>>(Prisma.sql`
          SELECT public.attest_fgis_grain_tenant_read_authorization(
            ${authorization.id},
            ${authorization.version},
            ${input.evidenceReference},
            ${new Date(input.validUntil)},
            ${input.justification}
          ) AS "authorizationVersion"
        `);
        const nextVersion = written[0]?.authorizationVersion;
        if (nextVersion === undefined) {
          throw new PreconditionFailedException('Attestation command returned no version');
        }
        await this.writeAudit(tx, {
          authorizationId: authorization.id,
          authorizationVersion: nextVersion,
          configurationId: authorization.configurationId,
          operationCode: 'ATTEST',
          correlationId: `attestation:${authorization.id}:${nextVersion}`,
          idempotencyKey: `attestation:${authorization.id}:${nextVersion}`,
          requestIdempotencyKey: `attestation:${authorization.id}:${nextVersion}`,
          requestReference: input.evidenceReference,
          requestSha256: canonicalFgisGrainTenantReadHash(input),
          decision: 'ATTESTED',
          reasonCode: 'EXTERNAL_READ_EVIDENCE_RECORDED',
        });
        return {
          authorizationId: authorization.id,
          authorizationVersion: nextVersion.toString(),
          state: 'READ_ONLY_ATTESTED',
          operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async getView(
    user: RequestUser,
    authorizationId: string,
  ): Promise<FgisGrainTenantReadAuthorizationView> {
    requireRead(user);
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const authorization = await this.findAuthorization(tx, context, authorizationId);
      if (!authorization) throw new NotFoundException('FGIS Grain read authorization not found');
      return view(authorization, this.transport.available);
    });
  }

  async execute(
    user: RequestUser,
    raw: FgisGrainTenantReadRequestInput,
  ): Promise<FgisGrainTenantReadExecutionReceipt> {
    requireRead(user);
    const input = assertFgisGrainTenantReadRequestInput(raw);
    const preflight = await this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        await this.lockIdempotency(tx, context, input.idempotencyKey);
        const authorization = await this.findAuthorization(tx, context, input.authorizationId);
        if (!authorization) {
          throw new NotFoundException('FGIS Grain read authorization not found');
        }
        if (authorization.version !== BigInt(input.authorizationVersion)) {
          throw new PreconditionFailedException('Authorization version changed');
        }
        const prior = await this.findRequestEvent(tx, context, input.idempotencyKey);
        const deny = async (reasonCode: string, message: string) => {
          if (!prior) {
            await this.writeAudit(tx, {
              authorizationId: authorization.id,
              authorizationVersion: authorization.version,
              configurationId: authorization.configurationId,
              operationCode: input.operationCode,
              correlationId: input.correlationId,
              idempotencyKey: executionAuditKey(input.idempotencyKey, 'DENIED'),
              requestIdempotencyKey: input.idempotencyKey,
              requestReference: input.requestReference,
              requestSha256: input.requestSha256,
              decision: 'DENIED',
              reasonCode,
            });
          }
          return {
            replay: null,
            authorization: null,
            configuration: null,
            denial: message,
            transportDisabled: false,
          } as const;
        };
        if (authorization.status !== 'READ_ONLY_ATTESTED') {
          return deny(
            'AUTHORIZATION_NOT_ATTESTED',
            'FGIS Grain read authorization is not externally attested',
          );
        }
        if (
          authorization.validUntil.getTime() <= Date.now()
          || !authorization.attestationValidUntil
          || authorization.attestationValidUntil.getTime() <= Date.now()
        ) {
          return deny(
            'AUTHORIZATION_OR_ATTESTATION_EXPIRED',
            'FGIS Grain read authorization or attestation expired',
          );
        }
        if (!authorization.allowedOperations.includes(input.operationCode)) {
          return deny(
            'OPERATION_NOT_AUTHORIZED',
            'Operation is outside tenant authorization',
          );
        }
        const configuration = await this.requireProviderAuthority(
          tx,
          context,
          authorization.configurationId,
          authorization.configurationVersion,
        );
        if (!this.transport.available) {
          if (!prior) {
            await this.writeAudit(tx, {
              authorizationId: authorization.id,
              authorizationVersion: authorization.version,
              configurationId: authorization.configurationId,
              operationCode: input.operationCode,
              correlationId: input.correlationId,
              idempotencyKey: executionAuditKey(input.idempotencyKey, 'DENIED'),
              requestIdempotencyKey: input.idempotencyKey,
              requestReference: input.requestReference,
              requestSha256: input.requestSha256,
              decision: 'DENIED',
              reasonCode: 'PROVIDER_TRANSPORT_DISABLED',
            });
          }
          return {
            replay: null,
            authorization: null,
            configuration: null,
            denial: null,
            transportDisabled: true,
          } as const;
        }
        if (prior) {
          this.assertRequestEventMatches(prior, input);
          if (prior.decision === 'SUCCEEDED') {
            return {
              replay: prior,
              authorization: null,
              configuration: null,
              denial: null,
              transportDisabled: false,
            } as const;
          }
          if (prior.decision === 'IN_FLIGHT') {
            throw new ConflictException({
              code: 'FGIS_GRAIN_READ_IN_FLIGHT',
              retryable: true,
            });
          }
          throw new ConflictException('Idempotency key already has a terminal result');
        }
        await this.writeAudit(tx, {
          authorizationId: authorization.id,
          authorizationVersion: authorization.version,
          configurationId: authorization.configurationId,
          operationCode: input.operationCode,
          correlationId: input.correlationId,
          idempotencyKey: executionAuditKey(input.idempotencyKey, 'CLAIM'),
          requestIdempotencyKey: input.idempotencyKey,
          requestReference: input.requestReference,
          requestSha256: input.requestSha256,
          decision: 'IN_FLIGHT',
          reasonCode: 'PROVIDER_READ_CLAIMED',
        });
        return {
          replay: null,
          authorization,
          configuration,
          denial: null,
          transportDisabled: false,
        } as const;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );

    if (preflight.replay) return this.replayReceipt(preflight.replay, input);
    if (preflight.denial) throw new ForbiddenException(preflight.denial);
    if (preflight.transportDisabled) {
      throw new ServiceUnavailableException({
        code: 'FGIS_GRAIN_READ_TRANSPORT_DISABLED',
        retryable: false,
        operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
      });
    }
    if (!preflight.authorization || !preflight.configuration) {
      throw new ConflictException('FGIS Grain read preflight is incomplete');
    }

    let result: FgisGrainTenantReadTransportResult;
    try {
      result = await this.transport.execute({
        operationCode: input.operationCode,
        requestReference: input.requestReference,
        requestSha256: input.requestSha256,
        correlationId: input.correlationId,
        configuration: {
          endpointReference: preflight.configuration.endpointReference,
          tlsPolicyReference: preflight.configuration.tlsPolicyReference,
          credentialReference: preflight.configuration.credentialReference,
          environment: preflight.configuration.environment,
        },
      });
      if (
        !result.providerRequestId
        || !result.responseReference
        || !/^[a-f0-9]{64}$/u.test(result.responseSha256)
        || !Number.isFinite(new Date(result.receivedAt).getTime())
      ) {
        throw new UnprocessableEntityException('Provider transport result is malformed');
      }
    } catch (error) {
      await this.recordTransportOutcome(user, preflight.authorization, input, null, 'FAILED', 'PROVIDER_READ_FAILED');
      throw error;
    }
    await this.recordTransportOutcome(user, preflight.authorization, input, result, 'SUCCEEDED', 'PROVIDER_READ_SUCCEEDED');
    return {
      authorizationId: preflight.authorization.id,
      authorizationVersion: preflight.authorization.version.toString(),
      operationCode: input.operationCode,
      correlationId: input.correlationId,
      providerRequestId: result.providerRequestId,
      responseReference: result.responseReference,
      responseSha256: result.responseSha256,
      receivedAt: new Date(result.receivedAt).toISOString(),
      replayed: false,
      operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
    };
  }

  private async recordTransportOutcome(
    user: RequestUser,
    authorization: AuthorizationRow,
    input: FgisGrainTenantReadRequestInput,
    result: FgisGrainTenantReadTransportResult | null,
    decision: 'SUCCEEDED' | 'FAILED',
    reasonCode: string,
  ): Promise<void> {
    await this.transactions.withTrustedContext(user, async (tx, context) => {
      await this.lockIdempotency(tx, context, input.idempotencyKey);
      await this.writeAudit(tx, {
        authorizationId: authorization.id,
        authorizationVersion: authorization.version,
        configurationId: authorization.configurationId,
        operationCode: input.operationCode,
        correlationId: input.correlationId,
        idempotencyKey: executionAuditKey(input.idempotencyKey, 'OUTCOME'),
        requestIdempotencyKey: input.idempotencyKey,
        requestReference: input.requestReference,
        requestSha256: input.requestSha256,
        decision,
        reasonCode,
        result,
      });
    });
  }

  private replayReceipt(
    row: AuditRow,
    input: FgisGrainTenantReadRequestInput,
  ): FgisGrainTenantReadExecutionReceipt {
    this.assertRequestEventMatches(row, input);
    if (
      row.decision !== 'SUCCEEDED'
      || !row.providerRequestId
      || !row.responseReference
      || !row.responseSha256
      || !row.receivedAt
    ) {
      throw new ConflictException('Idempotency key payload or prior result mismatch');
    }
    return {
      authorizationId: row.authorizationId,
      authorizationVersion: row.authorizationVersion.toString(),
      operationCode: input.operationCode,
      correlationId: input.correlationId,
      providerRequestId: row.providerRequestId,
      responseReference: row.responseReference,
      responseSha256: row.responseSha256,
      receivedAt: row.receivedAt.toISOString(),
      replayed: true,
      operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
    };
  }

  private assertRequestEventMatches(
    row: AuditRow,
    input: FgisGrainTenantReadRequestInput,
  ): void {
    if (
      row.authorizationId !== input.authorizationId
      || row.authorizationVersion !== BigInt(input.authorizationVersion)
      || row.operationCode !== input.operationCode
      || row.correlationId !== input.correlationId
      || row.requestIdempotencyKey !== input.idempotencyKey
      || row.requestReference !== input.requestReference
      || row.requestSha256 !== input.requestSha256
    ) {
      throw new ConflictException('Idempotency key payload or authorization version mismatch');
    }
  }

  private async requireProviderAuthority(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    configurationId: string,
    configurationVersion: bigint,
  ): Promise<ProviderConfigurationRow> {
    const rows = await tx.$queryRaw<ProviderConfigurationRow[]>(Prisma.sql`
      SELECT "id", "tenantId", "organizationId", "environment",
             "endpointReference", "tlsPolicyReference", "credentialReference",
             "status", "version"
      FROM public."fgis_grain_provider_configurations"
      WHERE "id" = ${configurationId}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
    `);
    const configuration = rows[0];
    if (!configuration) throw new NotFoundException('Provider configuration not found');
    if (configuration.version !== configurationVersion) {
      throw new PreconditionFailedException('Provider configuration version changed');
    }
    if (configuration.status !== 'TEST_APPROVED') {
      throw new ConflictException('Provider configuration is not test-approved');
    }
    const gates = await tx.$queryRaw<ProviderGateRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("gate")
             "gate", "decision", "configurationVersion", "actorUserId", "validUntil"
      FROM public."fgis_grain_provider_attestations"
      WHERE "configurationId" = ${configuration.id}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
      ORDER BY "gate", "createdAt" DESC, "id" DESC
    `);
    const approved = new Map(
      gates
        .filter((gate) => gate.decision === 'APPROVED'
          && gate.configurationVersion === configuration.version
          && gate.validUntil.getTime() > Date.now())
        .map((gate) => [gate.gate, gate]),
    );
    const missing = PROVIDER_GATES.filter((gate) => !approved.has(gate));
    if (missing.length > 0) {
      throw new ConflictException(`Provider attestations missing or stale: ${missing.join(', ')}`);
    }
    if (new Set([...approved.values()].map((gate) => gate.actorUserId)).size !== PROVIDER_GATES.length) {
      throw new ConflictException('Provider attestations require independent actors');
    }
    return configuration;
  }

  private async findAuthorizationByConfiguration(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    configurationId: string,
  ): Promise<AuthorizationRow | undefined> {
    const rows = await tx.$queryRaw<AuthorizationRow[]>(Prisma.sql`
      SELECT *
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "configurationId" = ${configurationId}
    `);
    return rows[0];
  }

  private async findAuthorization(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    authorizationId: string,
  ): Promise<AuthorizationRow | undefined> {
    const rows = await tx.$queryRaw<AuthorizationRow[]>(Prisma.sql`
      SELECT *
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "id" = ${authorizationId}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
    `);
    return rows[0];
  }

  private async lockIdempotency(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    idempotencyKey: string,
  ): Promise<void> {
    const lockKey = [
      'platform-v7:fgis-grain-tenant-read-idempotency',
      context.tenantId,
      context.orgId,
      idempotencyKey,
    ].join(':');
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
    );
  }

  private async findRequestEvent(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    idempotencyKey: string,
  ): Promise<AuditRow | undefined> {
    const rows = await tx.$queryRaw<AuditRow[]>(Prisma.sql`
      SELECT "id", "authorizationId", "authorizationVersion", "operationCode",
             "correlationId", "requestIdempotencyKey", "requestReference",
             "requestSha256", "decision", "providerRequestId", "responseReference",
             "responseSha256", "receivedAt", "reasonCode"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "requestIdempotencyKey" = ${idempotencyKey}
      ORDER BY
        CASE "decision"
          WHEN 'SUCCEEDED' THEN 0
          WHEN 'FAILED' THEN 1
          WHEN 'DENIED' THEN 2
          WHEN 'IN_FLIGHT' THEN 3
          ELSE 4
        END,
        "createdAt" DESC,
        "id" DESC
      LIMIT 1
    `);
    return rows[0];
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: {
      authorizationId: string;
      authorizationVersion: bigint;
      configurationId: string;
      operationCode: string;
      correlationId: string;
      idempotencyKey: string;
      requestIdempotencyKey: string;
      requestReference: string;
      requestSha256: string;
      decision: string;
      reasonCode: string;
      result?: FgisGrainTenantReadTransportResult | null;
    },
  ): Promise<void> {
    const id = randomUUID();
    const receivedAt = input.result ? new Date(input.result.receivedAt) : null;
    try {
      await tx.$queryRaw(Prisma.sql`
        SELECT public.append_fgis_grain_tenant_read_audit(
          ${id},
          ${input.authorizationId},
          ${input.authorizationVersion},
          ${input.configurationId},
          ${input.operationCode},
          ${input.correlationId},
          ${input.idempotencyKey},
          ${input.requestIdempotencyKey},
          ${input.requestReference},
          ${input.requestSha256},
          ${input.decision},
          ${input.reasonCode},
          ${input.result?.providerRequestId ?? null},
          ${input.result?.responseReference ?? null},
          ${input.result?.responseSha256 ?? null},
          ${receivedAt}
        ) AS "auditId"
      `);
    } catch (error) {
      const databaseCode = error instanceof Prisma.PrismaClientKnownRequestError
        && error.meta
        && typeof error.meta === 'object'
        ? String((error.meta as Record<string, unknown>).code ?? '')
        : '';
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && (error.code === 'P2002' || databaseCode === '23505')
      ) {
        throw new ConflictException('Idempotency key already used');
      }
      throw error;
    }
  }
}
