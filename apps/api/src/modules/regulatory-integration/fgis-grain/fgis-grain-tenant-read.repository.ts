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
const AUDIT_CHAIN_LOCK = 'platform-v7:fgis-grain-tenant-read-audit-chain';

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
  operationCode: string;
  requestSha256: string;
  decision: string;
  providerRequestId: string | null;
  responseReference: string | null;
  responseSha256: string | null;
  receivedAt: Date | null;
  reasonCode: string;
}>;

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

function canonicalAuditHash(value: Record<string, unknown>): string {
  return createHash('sha256')
    .update(canonicalFgisGrainTenantReadHash(value))
    .digest('hex');
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
          true,
        );
        const authorizationId = current?.id ?? randomUUID();
        const nextVersion = current ? current.version + 1n : 0n;
        if (current?.status === 'REVOKED') {
          throw new ConflictException('Revoked tenant read authorization cannot be reused');
        }
        if (current) {
          const updated = await tx.$executeRaw(Prisma.sql`
            UPDATE public."fgis_grain_tenant_read_authorizations"
            SET "configurationVersion" = ${BigInt(input.configurationVersion)},
                "allowedOperations" = ${input.allowedOperations}::text[],
                "authorizationReference" = ${input.authorizationReference},
                "status" = 'AUTHORIZED_NOT_ATTESTED',
                "validUntil" = ${new Date(input.validUntil)},
                "attestationEvidenceReference" = NULL,
                "attestationValidUntil" = NULL,
                "reason" = ${input.reason},
                "version" = ${nextVersion},
                "updatedByUserId" = ${context.userId},
                "updatedAt" = clock_timestamp()
            WHERE "id" = ${current.id}
              AND "tenantId" = ${context.tenantId}
              AND "organizationId" = ${context.orgId}
              AND "version" = ${current.version}
          `);
          if (updated !== 1) throw new PreconditionFailedException('Authorization version changed');
        } else {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO public."fgis_grain_tenant_read_authorizations" (
              "id", "tenantId", "organizationId", "configurationId",
              "configurationVersion", "allowedOperations", "authorizationReference",
              "status", "validUntil", "reason", "version",
              "createdByUserId", "updatedByUserId"
            ) VALUES (
              ${authorizationId}, ${context.tenantId}, ${context.orgId},
              ${input.configurationId}, ${BigInt(input.configurationVersion)},
              ${input.allowedOperations}::text[], ${input.authorizationReference},
              'AUTHORIZED_NOT_ATTESTED', ${new Date(input.validUntil)}, ${input.reason},
              0, ${context.userId}, ${context.userId}
            )
          `);
        }
        await this.writeAudit(tx, context, {
          authorizationId,
          configurationId: input.configurationId,
          operationCode: 'AUTHORIZE',
          correlationId: `authorization:${authorizationId}:${nextVersion}`,
          idempotencyKey: `authorization:${authorizationId}:${nextVersion}`,
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
        const authorization = await this.lockAuthorization(
          tx,
          context,
          input.authorizationId,
        );
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
        const nextVersion = authorization.version + 1n;
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE public."fgis_grain_tenant_read_authorizations"
          SET "status" = 'READ_ONLY_ATTESTED',
              "attestationEvidenceReference" = ${input.evidenceReference},
              "attestationValidUntil" = ${new Date(input.validUntil)},
              "attestationJustification" = ${input.justification},
              "attestedByUserId" = ${context.userId},
              "version" = ${nextVersion},
              "updatedByUserId" = ${context.userId},
              "updatedAt" = clock_timestamp()
          WHERE "id" = ${authorization.id}
            AND "version" = ${authorization.version}
            AND "status" = 'AUTHORIZED_NOT_ATTESTED'
        `);
        if (updated !== 1) throw new PreconditionFailedException('Authorization state changed');
        await this.writeAudit(tx, context, {
          authorizationId: authorization.id,
          configurationId: authorization.configurationId,
          operationCode: 'ATTEST',
          correlationId: `attestation:${authorization.id}:${nextVersion}`,
          idempotencyKey: `attestation:${authorization.id}:${nextVersion}`,
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
        const replay = await this.findReplay(tx, context, input.idempotencyKey);
        if (replay) return { replay, context, authorization: null, configuration: null } as const;
        const authorization = await this.lockAuthorization(tx, context, input.authorizationId);
        if (authorization.version !== BigInt(input.authorizationVersion)) {
          throw new PreconditionFailedException('Authorization version changed');
        }
        if (authorization.status !== 'READ_ONLY_ATTESTED') {
          await this.writeAudit(tx, context, {
            authorizationId: authorization.id,
            configurationId: authorization.configurationId,
            operationCode: input.operationCode,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            requestReference: input.requestReference,
            requestSha256: input.requestSha256,
            decision: 'DENIED',
            reasonCode: 'AUTHORIZATION_NOT_ATTESTED',
          });
          throw new ForbiddenException('FGIS Grain read authorization is not externally attested');
        }
        if (
          authorization.validUntil.getTime() <= Date.now()
          || !authorization.attestationValidUntil
          || authorization.attestationValidUntil.getTime() <= Date.now()
        ) {
          throw new ForbiddenException('FGIS Grain read authorization or attestation expired');
        }
        if (!authorization.allowedOperations.includes(input.operationCode)) {
          await this.writeAudit(tx, context, {
            authorizationId: authorization.id,
            configurationId: authorization.configurationId,
            operationCode: input.operationCode,
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            requestReference: input.requestReference,
            requestSha256: input.requestSha256,
            decision: 'DENIED',
            reasonCode: 'OPERATION_NOT_AUTHORIZED',
          });
          throw new ForbiddenException('Operation is outside tenant authorization');
        }
        const configuration = await this.requireProviderAuthority(
          tx,
          context,
          authorization.configurationId,
          authorization.configurationVersion,
        );
        return { replay: null, context, authorization, configuration } as const;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );

    if (preflight.replay) return this.replayReceipt(preflight.replay, input);
    if (!preflight.authorization || !preflight.configuration) {
      throw new ConflictException('FGIS Grain read preflight is incomplete');
    }
    if (!this.transport.available) {
      await this.recordTransportOutcome(user, preflight.authorization, input, null, 'FAILED', 'PROVIDER_TRANSPORT_DISABLED');
      throw new ServiceUnavailableException({
        code: 'FGIS_GRAIN_READ_TRANSPORT_DISABLED',
        retryable: false,
        operationalStatus: FGIS_GRAIN_TENANT_READ_OPERATIONAL_STATUS,
      });
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
      await this.writeAudit(tx, context, {
        authorizationId: authorization.id,
        configurationId: authorization.configurationId,
        operationCode: input.operationCode,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
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
    if (
      row.authorizationId !== input.authorizationId
      || row.operationCode !== input.operationCode
      || row.requestSha256 !== input.requestSha256
      || row.decision !== 'SUCCEEDED'
      || !row.providerRequestId
      || !row.responseReference
      || !row.responseSha256
      || !row.receivedAt
    ) {
      throw new ConflictException('Idempotency key payload or prior result mismatch');
    }
    return {
      authorizationId: row.authorizationId,
      authorizationVersion: input.authorizationVersion,
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
    lock = false,
  ): Promise<AuthorizationRow | undefined> {
    const lockSql = lock ? Prisma.sql`FOR UPDATE` : Prisma.empty;
    const rows = await tx.$queryRaw<AuthorizationRow[]>(Prisma.sql`
      SELECT *
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "configurationId" = ${configurationId}
      ${lockSql}
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

  private async lockAuthorization(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    authorizationId: string,
  ): Promise<AuthorizationRow> {
    const rows = await tx.$queryRaw<AuthorizationRow[]>(Prisma.sql`
      SELECT *
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "id" = ${authorizationId}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
      FOR UPDATE
    `);
    if (!rows[0]) throw new NotFoundException('FGIS Grain read authorization not found');
    return rows[0];
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    idempotencyKey: string,
  ): Promise<AuditRow | undefined> {
    const rows = await tx.$queryRaw<AuditRow[]>(Prisma.sql`
      SELECT "id", "authorizationId", "operationCode", "requestSha256",
             "decision", "providerRequestId", "responseReference",
             "responseSha256", "receivedAt", "reasonCode"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
        AND "idempotencyKey" = ${idempotencyKey}
    `);
    return rows[0];
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    input: {
      authorizationId: string;
      configurationId: string;
      operationCode: string;
      correlationId: string;
      idempotencyKey: string;
      requestReference: string;
      requestSha256: string;
      decision: string;
      reasonCode: string;
      result?: FgisGrainTenantReadTransportResult | null;
    },
  ): Promise<void> {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${AUDIT_CHAIN_LOCK}, 0))`);
    const previous = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT "hash"
      FROM public."fgis_grain_tenant_read_audits"
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 1
    `);
    const id = randomUUID();
    const receivedAt = input.result ? new Date(input.result.receivedAt) : null;
    const authority = {
      id,
      tenantId: context.tenantId,
      organizationId: context.orgId,
      authorizationId: input.authorizationId,
      configurationId: input.configurationId,
      actorUserId: context.userId,
      actorRole: context.role,
      operationCode: input.operationCode,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      requestReference: input.requestReference,
      requestSha256: input.requestSha256,
      decision: input.decision,
      reasonCode: input.reasonCode,
      providerRequestId: input.result?.providerRequestId ?? null,
      responseReference: input.result?.responseReference ?? null,
      responseSha256: input.result?.responseSha256 ?? null,
      receivedAt: receivedAt?.toISOString() ?? null,
      prevHash: previous[0]?.hash ?? null,
    };
    const hash = canonicalAuditHash(authority);
    try {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public."fgis_grain_tenant_read_audits" (
          "id", "tenantId", "organizationId", "authorizationId", "configurationId",
          "actorUserId", "actorRole", "operationCode", "correlationId",
          "idempotencyKey", "requestReference", "requestSha256", "decision",
          "reasonCode", "providerRequestId", "responseReference", "responseSha256",
          "receivedAt", "hash", "prevHash"
        ) VALUES (
          ${id}, ${context.tenantId}, ${context.orgId}, ${input.authorizationId},
          ${input.configurationId}, ${context.userId}, ${context.role},
          ${input.operationCode}, ${input.correlationId}, ${input.idempotencyKey},
          ${input.requestReference}, ${input.requestSha256}, ${input.decision},
          ${input.reasonCode}, ${input.result?.providerRequestId ?? null},
          ${input.result?.responseReference ?? null}, ${input.result?.responseSha256 ?? null},
          ${receivedAt}, ${hash}, ${previous[0]?.hash ?? null}
        )
      `);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Idempotency key already used');
      }
      throw error;
    }
  }
}
