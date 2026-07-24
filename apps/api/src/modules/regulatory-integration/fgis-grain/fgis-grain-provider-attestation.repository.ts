import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, type RequestUser } from '../../../common/types/request-user';
import { RlsTransactionService } from '../../../common/prisma/rls-transaction.service';
import {
  FGIS_GRAIN_ATTESTATION_GATES,
  FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS,
  assertFgisGrainProviderAttestationInput,
  assertFgisGrainProviderConfigurationDraft,
  assertTestActivationAllowed,
  type FgisGrainAttestationGate,
  type FgisGrainProviderAttestationInput,
  type FgisGrainProviderConfigurationDraft,
  type FgisGrainProviderConfigurationState,
  type FgisGrainProviderConfigurationView,
} from './fgis-grain-provider-attestation.contract';

const OBJECT_TYPE = 'FGIS_GRAIN_PROVIDER_CONFIGURATION';
const CONFIG_EVENT = 'FGIS_GRAIN_PROVIDER_CONFIGURATION_CHANGED';
const ATTESTATION_EVENT = 'FGIS_GRAIN_PROVIDER_ATTESTATION_RECORDED';
const ACTIVATION_EVENT = 'FGIS_GRAIN_PROVIDER_TEST_ACTIVATED';
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,159}$/u;

const GATE_ROLE: Readonly<Record<FgisGrainAttestationGate, Role>> = {
  OWNER: Role.EXECUTIVE,
  SECURITY: Role.ADMIN,
  LEGAL: Role.COMPLIANCE_OFFICER,
  OPERATIONS: Role.SUPPORT_MANAGER,
};

type ConfigRow = Readonly<{
  id: string;
  tenantId: string;
  organizationId: string;
  environment: 'PRE_PRODUCTION' | 'PRODUCTION';
  endpointReference: string;
  tlsPolicyReference: string;
  credentialReference: string;
  signingKeyReference: string;
  payloadStoreReference: string;
  status: FgisGrainProviderConfigurationState;
  version: bigint;
  createdAt: Date;
  updatedAt: Date;
}>;

type AttestationRow = Readonly<{
  gate: FgisGrainAttestationGate;
  decision: 'APPROVED' | 'REJECTED';
  configurationVersion: bigint;
  actorUserId: string;
  actorRole: string;
  evidenceReference: string;
  validUntil: Date;
  createdAt: Date;
}>;

type OutboxReplayRow = Readonly<{
  id: string;
  type: string;
  payload: unknown;
  auditId: string | null;
  correlationId: string | null;
}>;
type HashRow = Readonly<{ hash: string }>;
type IdRow = Readonly<{ id: string }>;

export interface ProviderCommandMetadata {
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly reason: string;
  readonly expectedVersion?: string;
}

export interface UpsertProviderConfigurationCommand extends ProviderCommandMetadata {
  readonly draft: FgisGrainProviderConfigurationDraft;
}

export interface RecordProviderAttestationCommand extends ProviderCommandMetadata {
  readonly configurationId: string;
  readonly attestation: FgisGrainProviderAttestationInput;
}

export interface ProviderConfigurationReceipt {
  readonly configurationId: string;
  readonly version: string;
  readonly state: FgisGrainProviderConfigurationState;
  readonly auditId: string;
  readonly outboxId: string;
  readonly correlationId: string;
  readonly replayed: boolean;
  readonly operationalStatus: typeof FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS;
}

function requireMetadata(metadata: ProviderCommandMetadata): void {
  if (
    !SAFE_KEY.test(metadata.idempotencyKey)
    || !SAFE_KEY.test(metadata.correlationId)
    || metadata.reason.trim().length < 12
    || metadata.reason.trim().length > 1000
    || (metadata.expectedVersion !== undefined && !/^(?:0|[1-9][0-9]{0,18})$/u.test(metadata.expectedVersion))
  ) {
    throw new UnprocessableEntityException('Provider command metadata is invalid');
  }
}

function canonicalKey(
  tenantId: string,
  orgId: string,
  operation: string,
  key: string,
): string {
  const value = `fgis-provider:${tenantId}:${orgId}:${operation}:${key}`;
  if (value.length > 255) throw new UnprocessableEntityException('Canonical idempotency key is too long');
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function payloadMatches(existing: unknown, expected: Record<string, unknown>): boolean {
  const actual = asRecord(existing);
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index] && actual[key] === expected[key]);
}

function assertRoleForGate(user: RequestUser, gate: FgisGrainAttestationGate): void {
  if (user.role !== GATE_ROLE[gate]) {
    throw new ForbiddenException(`Role ${user.role} cannot decide ${gate} attestation`);
  }
  if (user.mfaVerified !== true) {
    throw new ForbiddenException('MFA verification is required for provider attestation');
  }
}

function expectedVersion(value: string | undefined): bigint {
  if (value === undefined) throw new PreconditionFailedException('If-Match configuration version is required');
  return BigInt(value);
}

function auditHash(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

@Injectable()
export class FgisGrainProviderAttestationRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async upsertDraft(
    user: RequestUser,
    command: UpsertProviderConfigurationCommand,
  ): Promise<ProviderConfigurationReceipt> {
    requireMetadata(command);
    const draft = assertFgisGrainProviderConfigurationDraft(command.draft);
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(context.tenantId, context.orgId, 'draft', command.idempotencyKey);
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
          ) SELECT true AS "locked" FROM acquired
        `);
        const replay = await this.findReplay(tx, key);
        const authority = {
          operation: 'UPSERT_DRAFT',
          environment: draft.environment,
          endpointReference: draft.endpointReference,
          tlsPolicyReference: draft.tlsPolicyReference,
          credentialReference: draft.credentialReference,
          signingKeyReference: draft.signingKeyReference,
          payloadStoreReference: draft.payloadStoreReference,
          expectedVersion: command.expectedVersion ?? null,
          correlationId: command.correlationId,
        };
        if (replay) return this.replayReceipt(replay, authority);

        const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
          SELECT * FROM public."fgis_grain_provider_configurations"
          WHERE "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
            AND "adapterCode" = 'FGIS_ZERNO'
            AND "environment" = ${draft.environment}
          FOR UPDATE
        `);
        const current = rows[0];
        let configurationId: string;
        let version: bigint;
        if (!current) {
          if (command.expectedVersion !== undefined && command.expectedVersion !== '0') {
            throw new PreconditionFailedException('Configuration does not exist at expected version');
          }
          configurationId = randomUUID();
          version = 0n;
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO public."fgis_grain_provider_configurations" (
              "id", "tenantId", "organizationId", "environment",
              "endpointReference", "tlsPolicyReference", "credentialReference",
              "signingKeyReference", "payloadStoreReference", "status", "version",
              "createdByUserId", "updatedByUserId"
            ) VALUES (
              ${configurationId}, ${context.tenantId}, ${context.orgId}, ${draft.environment},
              ${draft.endpointReference}, ${draft.tlsPolicyReference}, ${draft.credentialReference},
              ${draft.signingKeyReference}, ${draft.payloadStoreReference}, 'DRAFT', 0,
              ${context.userId}, ${context.userId}
            )
          `);
        } else {
          if (current.status === 'REVOKED') throw new ConflictException('Revoked configuration cannot be edited');
          const match = expectedVersion(command.expectedVersion);
          if (current.version !== match) throw new PreconditionFailedException('Configuration version changed');
          configurationId = current.id;
          version = current.version + 1n;
          const updated = await tx.$executeRaw(Prisma.sql`
            UPDATE public."fgis_grain_provider_configurations"
            SET "endpointReference" = ${draft.endpointReference},
                "tlsPolicyReference" = ${draft.tlsPolicyReference},
                "credentialReference" = ${draft.credentialReference},
                "signingKeyReference" = ${draft.signingKeyReference},
                "payloadStoreReference" = ${draft.payloadStoreReference},
                "status" = 'DRAFT',
                "version" = ${version},
                "updatedByUserId" = ${context.userId},
                "updatedAt" = clock_timestamp()
            WHERE "id" = ${current.id}
              AND "tenantId" = ${context.tenantId}
              AND "organizationId" = ${context.orgId}
              AND "version" = ${current.version}
          `);
          if (updated !== 1) throw new PreconditionFailedException('Configuration version changed');
        }
        return this.writeEvidence(tx, context, {
          eventType: CONFIG_EVENT,
          action: 'FGIS_GRAIN_PROVIDER_CONFIGURATION_DRAFTED',
          configurationId,
          version,
          state: 'DRAFT',
          key,
          correlationId: command.correlationId,
          reason: command.reason.trim(),
          authority,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 },
    );
  }

  async submitForReview(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
  ): Promise<ProviderConfigurationReceipt> {
    requireMetadata(metadata);
    return this.changeState(user, configurationId, metadata, 'submit', 'DRAFT', 'UNDER_REVIEW', CONFIG_EVENT);
  }

  async recordAttestation(
    user: RequestUser,
    command: RecordProviderAttestationCommand,
  ): Promise<ProviderConfigurationReceipt> {
    requireMetadata(command);
    const attestation = assertFgisGrainProviderAttestationInput(command.attestation);
    assertRoleForGate(user, attestation.gate);
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(context.tenantId, context.orgId, `attest-${attestation.gate}`, command.idempotencyKey);
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
          ) SELECT true AS "locked" FROM acquired
        `);
        const authority = {
          operation: 'ATTEST',
          configurationId: command.configurationId,
          gate: attestation.gate,
          decision: attestation.decision,
          configurationVersion: attestation.configurationVersion,
          evidenceReference: attestation.evidenceReference,
          validUntil: attestation.validUntil,
          correlationId: command.correlationId,
        };
        const replay = await this.findReplay(tx, key);
        if (replay) return this.replayReceipt(replay, authority);

        const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
          SELECT * FROM public."fgis_grain_provider_configurations"
          WHERE "id" = ${command.configurationId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const configuration = rows[0];
        if (!configuration) throw new NotFoundException('Provider configuration not found');
        if (configuration.status !== 'UNDER_REVIEW') {
          throw new ConflictException('Configuration is not under review');
        }
        if (configuration.version.toString() !== attestation.configurationVersion) {
          throw new PreconditionFailedException('Attestation is bound to a stale configuration version');
        }
        const actorConflict = await tx.$queryRaw<Array<{ gate: string }>>(Prisma.sql`
          SELECT "gate" FROM public."fgis_grain_provider_attestations"
          WHERE "configurationId" = ${configuration.id}
            AND "configurationVersion" = ${configuration.version}
            AND "actorUserId" = ${context.userId}
            AND "decision" = 'APPROVED'
            AND "validUntil" > clock_timestamp()
          LIMIT 1
        `);
        if (actorConflict.length > 0) {
          throw new ConflictException('One actor cannot approve multiple gates for the same version');
        }
        const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
          SELECT "hash" FROM public."fgis_grain_provider_attestations"
          WHERE "configurationId" = ${configuration.id}
          ORDER BY "createdAt" DESC, "id" DESC LIMIT 1 FOR UPDATE
        `);
        const prevHash = previous[0]?.hash ?? '';
        const id = randomUUID();
        const hash = auditHash({
          id,
          configurationId: configuration.id,
          configurationVersion: configuration.version.toString(),
          gate: attestation.gate,
          decision: attestation.decision,
          actorUserId: context.userId,
          actorRole: context.role,
          evidenceReference: attestation.evidenceReference,
          validUntil: attestation.validUntil,
          prevHash,
        });
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public."fgis_grain_provider_attestations" (
            "id", "configurationId", "tenantId", "organizationId", "gate", "decision",
            "configurationVersion", "actorUserId", "actorRole", "mfaVerified",
            "justification", "evidenceReference", "validUntil", "idempotencyKey",
            "correlationId", "hash", "prevHash"
          ) VALUES (
            ${id}, ${configuration.id}, ${context.tenantId}, ${context.orgId},
            ${attestation.gate}, ${attestation.decision}, ${configuration.version},
            ${context.userId}, ${context.role}, true, ${attestation.justification},
            ${attestation.evidenceReference}, ${new Date(attestation.validUntil)}, ${key},
            ${command.correlationId}, ${hash}, ${prevHash || null}
          )
        `);
        return this.writeEvidence(tx, context, {
          eventType: ATTESTATION_EVENT,
          action: 'FGIS_GRAIN_PROVIDER_ATTESTATION_RECORDED',
          configurationId: configuration.id,
          version: configuration.version,
          state: configuration.status,
          key,
          correlationId: command.correlationId,
          reason: command.reason.trim(),
          authority,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 },
    );
  }

  async activateTest(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
  ): Promise<ProviderConfigurationReceipt> {
    requireMetadata(metadata);
    if (user.role !== Role.EXECUTIVE || user.mfaVerified !== true) {
      throw new ForbiddenException('Executive MFA authority is required for test activation');
    }
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(context.tenantId, context.orgId, 'activate-test', metadata.idempotencyKey);
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
          ) SELECT true AS "locked" FROM acquired
        `);
        const authority = {
          operation: 'ACTIVATE_TEST',
          configurationId,
          expectedVersion: metadata.expectedVersion ?? null,
          correlationId: metadata.correlationId,
        };
        const replay = await this.findReplay(tx, key);
        if (replay) return this.replayReceipt(replay, authority);
        const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
          SELECT * FROM public."fgis_grain_provider_configurations"
          WHERE "id" = ${configurationId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const configuration = rows[0];
        if (!configuration) throw new NotFoundException('Provider configuration not found');
        assertTestActivationAllowed(configuration.environment);
        if (configuration.status !== 'UNDER_REVIEW') {
          throw new ConflictException('Configuration is not ready for activation');
        }
        const match = expectedVersion(metadata.expectedVersion);
        if (configuration.version !== match) throw new PreconditionFailedException('Configuration version changed');
        const approvals = await tx.$queryRaw<AttestationRow[]>(Prisma.sql`
          SELECT DISTINCT ON ("gate")
            "gate", "decision", "configurationVersion", "actorUserId", "actorRole",
            "evidenceReference", "validUntil", "createdAt"
          FROM public."fgis_grain_provider_attestations"
          WHERE "configurationId" = ${configuration.id}
            AND "configurationVersion" = ${configuration.version}
          ORDER BY "gate", "createdAt" DESC, "id" DESC
        `);
        const approved = new Map(
          approvals
            .filter((row) => row.decision === 'APPROVED' && row.validUntil.getTime() > Date.now())
            .map((row) => [row.gate, row]),
        );
        const missing = FGIS_GRAIN_ATTESTATION_GATES.filter((gate) => !approved.has(gate));
        if (missing.length > 0) {
          throw new ConflictException(`Missing live attestations: ${missing.join(', ')}`);
        }
        if (new Set([...approved.values()].map((row) => row.actorUserId)).size !== FGIS_GRAIN_ATTESTATION_GATES.length) {
          throw new ConflictException('All attestation gates require independent actors');
        }
        const version = configuration.version + 1n;
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE public."fgis_grain_provider_configurations"
          SET "status" = 'TEST_APPROVED', "version" = ${version},
              "updatedByUserId" = ${context.userId}, "updatedAt" = clock_timestamp()
          WHERE "id" = ${configuration.id}
            AND "version" = ${configuration.version}
            AND "status" = 'UNDER_REVIEW'
        `);
        if (updated !== 1) throw new PreconditionFailedException('Configuration version changed');
        return this.writeEvidence(tx, context, {
          eventType: ACTIVATION_EVENT,
          action: 'FGIS_GRAIN_PROVIDER_TEST_ACTIVATED',
          configurationId: configuration.id,
          version,
          state: 'TEST_APPROVED',
          key,
          correlationId: metadata.correlationId,
          reason: metadata.reason.trim(),
          authority,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 },
    );
  }

  async getView(user: RequestUser, configurationId: string): Promise<FgisGrainProviderConfigurationView> {
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
        SELECT * FROM public."fgis_grain_provider_configurations"
        WHERE "id" = ${configurationId}
          AND "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
      `);
      const configuration = rows[0];
      if (!configuration) throw new NotFoundException('Provider configuration not found');
      const attestations = await tx.$queryRaw<AttestationRow[]>(Prisma.sql`
        SELECT DISTINCT ON ("gate")
          "gate", "decision", "configurationVersion", "actorUserId", "actorRole",
          "evidenceReference", "validUntil", "createdAt"
        FROM public."fgis_grain_provider_attestations"
        WHERE "configurationId" = ${configuration.id}
        ORDER BY "gate", "createdAt" DESC, "id" DESC
      `);
      const latest = new Map(attestations.map((row) => [row.gate, row]));
      const gates = FGIS_GRAIN_ATTESTATION_GATES.map((gate) => {
        const row = latest.get(gate);
        let state: 'MISSING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'STALE' = 'MISSING';
        if (row) {
          if (row.configurationVersion !== configuration.version) state = 'STALE';
          else if (row.decision === 'REJECTED') state = 'REJECTED';
          else if (row.validUntil.getTime() <= Date.now()) state = 'EXPIRED';
          else state = 'APPROVED';
        }
        return {
          gate,
          state,
          actorUserId: row?.actorUserId ?? null,
          actorRole: row?.actorRole ?? null,
          evidenceReference: row?.evidenceReference ?? null,
          validUntil: row?.validUntil.toISOString() ?? null,
          configurationVersion: row?.configurationVersion.toString() ?? null,
        } as const;
      });
      const blockers = [
        ...(configuration.environment === 'PRODUCTION' ? ['PRODUCTION_ACTIVATION_FORBIDDEN'] : []),
        ...gates.filter((gate) => gate.state !== 'APPROVED').map((gate) => `${gate.gate}_${gate.state}`),
      ];
      return {
        id: configuration.id,
        adapterCode: 'FGIS_ZERNO',
        apiVersion: '1.0.23',
        mappingVersion: 'fgis-zerno-1.0.23-catalog.v1',
        signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1',
        environment: configuration.environment,
        status: configuration.status,
        version: configuration.version.toString(),
        references: {
          endpointReference: configuration.endpointReference,
          tlsPolicyReference: configuration.tlsPolicyReference,
          credentialReference: configuration.credentialReference,
          signingKeyReference: configuration.signingKeyReference,
          payloadStoreReference: configuration.payloadStoreReference,
        },
        gates,
        blockers,
        nextAction: blockers.length === 0 ? 'ACTIVATE_TEST' : 'RESOLVE_ATTESTATION_BLOCKERS',
        productionActivationAllowed: false,
        operationalStatus: FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS,
      };
    });
  }

  private async changeState(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
    operation: string,
    from: FgisGrainProviderConfigurationState,
    to: FgisGrainProviderConfigurationState,
    eventType: string,
  ): Promise<ProviderConfigurationReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(context.tenantId, context.orgId, operation, metadata.idempotencyKey);
        await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
          WITH acquired AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
          ) SELECT true AS "locked" FROM acquired
        `);
        const authority = {
          operation: operation.toUpperCase(),
          configurationId,
          from,
          to,
          expectedVersion: metadata.expectedVersion ?? null,
          correlationId: metadata.correlationId,
        };
        const replay = await this.findReplay(tx, key);
        if (replay) return this.replayReceipt(replay, authority);
        const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
          SELECT * FROM public."fgis_grain_provider_configurations"
          WHERE "id" = ${configurationId}
            AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId}
          FOR UPDATE
        `);
        const configuration = rows[0];
        if (!configuration) throw new NotFoundException('Provider configuration not found');
        if (configuration.status !== from) throw new ConflictException(`Expected state ${from}`);
        const match = expectedVersion(metadata.expectedVersion);
        if (configuration.version !== match) throw new PreconditionFailedException('Configuration version changed');
        const version = configuration.version + 1n;
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE public."fgis_grain_provider_configurations"
          SET "status" = ${to}, "version" = ${version},
              "updatedByUserId" = ${context.userId}, "updatedAt" = clock_timestamp()
          WHERE "id" = ${configuration.id} AND "version" = ${configuration.version}
        `);
        if (updated !== 1) throw new PreconditionFailedException('Configuration version changed');
        return this.writeEvidence(tx, context, {
          eventType,
          action: `FGIS_GRAIN_PROVIDER_${to}`,
          configurationId,
          version,
          state: to,
          key,
          correlationId: metadata.correlationId,
          reason: metadata.reason.trim(),
          authority,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 },
    );
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    key: string,
  ): Promise<OutboxReplayRow | undefined> {
    const rows = await tx.$queryRaw<OutboxReplayRow[]>(Prisma.sql`
      SELECT "id", "type", "payload", "auditId", "correlationId"
      FROM public."outbox_entries"
      WHERE "idempotencyKey" = ${key}
      FOR UPDATE
    `);
    return rows[0];
  }

  private replayReceipt(
    replay: OutboxReplayRow,
    authority: Record<string, unknown>,
  ): ProviderConfigurationReceipt {
    const payload = asRecord(replay.payload);
    if (
      !payloadMatches(payload.authority, authority)
      || typeof payload.configurationId !== 'string'
      || typeof payload.version !== 'string'
      || typeof payload.state !== 'string'
      || !replay.auditId
      || !replay.correlationId
    ) {
      throw new ConflictException('Idempotency key is bound to another provider command');
    }
    return {
      configurationId: payload.configurationId,
      version: payload.version,
      state: payload.state as FgisGrainProviderConfigurationState,
      auditId: replay.auditId,
      outboxId: replay.id,
      correlationId: replay.correlationId,
      replayed: true,
      operationalStatus: FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS,
    };
  }

  private async writeEvidence(
    tx: Prisma.TransactionClient,
    context: { tenantId: string; orgId: string; userId: string; role: string },
    input: {
      eventType: string;
      action: string;
      configurationId: string;
      version: bigint;
      state: FgisGrainProviderConfigurationState;
      key: string;
      correlationId: string;
      reason: string;
      authority: Record<string, unknown>;
    },
  ): Promise<ProviderConfigurationReceipt> {
    const auditId = randomUUID();
    const outboxId = randomUUID();
    const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
      SELECT "hash" FROM public."audit_events"
      ORDER BY "createdAt" DESC, "id" DESC LIMIT 1 FOR UPDATE
    `);
    const prevHash = previous[0]?.hash ?? '';
    const eventPayload = {
      schemaVersion: 'pc-crop.fgis-grain-provider-command.v1',
      configurationId: input.configurationId,
      version: input.version.toString(),
      state: input.state,
      tenantId: context.tenantId,
      organizationId: context.orgId,
      authority: input.authority,
      operationalStatus: FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS,
    };
    const hash = auditHash({
      auditId,
      action: input.action,
      actorUserId: context.userId,
      actorRole: context.role,
      correlationId: input.correlationId,
      eventPayload,
      prevHash,
    });
    const audit = await tx.$queryRaw<IdRow[]>(Prisma.sql`
      INSERT INTO public."audit_events" (
        "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
        "objectType", "objectId", "afterState", "outcome", "reason", "metadata",
        "correlationId", "runtimeIdempotencyKey", "hash", "prevHash"
      ) VALUES (
        ${auditId}, ${input.action}, ${context.userId}, ${context.role},
        ${context.tenantId}, ${context.orgId}, ${OBJECT_TYPE}, ${input.configurationId},
        CAST(${JSON.stringify({ state: input.state, version: input.version.toString() })} AS jsonb),
        'SUCCESS', ${input.reason}, CAST(${JSON.stringify(eventPayload)} AS jsonb),
        ${input.correlationId}, ${input.key}, ${hash}, ${prevHash || null}
      ) RETURNING "id"
    `);
    if (audit[0]?.id !== auditId) throw new ConflictException('Provider audit persistence failed');
    const outbox = await tx.$queryRaw<IdRow[]>(Prisma.sql`
      INSERT INTO public."outbox_entries" (
        "id", "type", "payload", "status", "triggeredByUserId", "idempotencyKey",
        "correlationId", "auditId", "nextRetryAt"
      ) VALUES (
        ${outboxId}, ${input.eventType}, CAST(${JSON.stringify(eventPayload)} AS jsonb),
        'PENDING', ${context.userId}, ${input.key}, ${input.correlationId},
        ${auditId}, clock_timestamp()
      ) RETURNING "id"
    `);
    if (outbox[0]?.id !== outboxId) throw new ConflictException('Provider outbox persistence failed');
    return {
      configurationId: input.configurationId,
      version: input.version.toString(),
      state: input.state,
      auditId,
      outboxId,
      correlationId: input.correlationId,
      replayed: false,
      operationalStatus: FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS,
    };
  }
}
