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
const SUSPENSION_EVENT = 'FGIS_GRAIN_PROVIDER_SUSPENDED';
const REVOCATION_EVENT = 'FGIS_GRAIN_PROVIDER_REVOKED';
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9:_.@/-]{2,159}$/u;
const AUDIT_CHAIN_LOCK = 'platform-v7:audit-events:global-chain';

const GATE_ROLE: Readonly<Record<FgisGrainAttestationGate, Role>> = {
  OWNER: Role.EXECUTIVE,
  SECURITY: Role.ADMIN,
  LEGAL: Role.COMPLIANCE_OFFICER,
  OPERATIONS: Role.SUPPORT_MANAGER,
};
const READ_ROLES = new Set<Role>([
  Role.EXECUTIVE,
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.SUPPORT_MANAGER,
]);
const MUTATION_ROLES = new Set<Role>([
  Role.EXECUTIVE,
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
  Role.SUPPORT_MANAGER,
]);
const SUSPEND_ROLES = new Set<Role>([
  Role.EXECUTIVE,
  Role.ADMIN,
  Role.COMPLIANCE_OFFICER,
]);
const REVOKE_ROLES = new Set<Role>([
  Role.EXECUTIVE,
  Role.COMPLIANCE_OFFICER,
]);

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
  idempotencyKey: string | null;
  auditAction: string | null;
  auditReason: string | null;
  auditMetadata: unknown;
  auditRuntimeIdempotencyKey: string | null;
}>;
type HashRow = Readonly<{ hash: string }>;
type IdRow = Readonly<{ id: string }>;
type TrustedContext = Readonly<{
  tenantId: string;
  orgId: string;
  userId: string;
  role: string;
}>;

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
    || (
      metadata.expectedVersion !== undefined
      && !/^(?:0|[1-9][0-9]{0,18})$/u.test(metadata.expectedVersion)
    )
  ) {
    throw new UnprocessableEntityException('Provider command metadata is invalid');
  }
}

function requireReadRole(user: RequestUser): void {
  if (!READ_ROLES.has(user.role)) {
    throw new ForbiddenException('Provider configuration read access is not permitted');
  }
}

function requireMutationRole(user: RequestUser): void {
  if (!MUTATION_ROLES.has(user.role)) {
    throw new ForbiddenException('Provider configuration mutation is not permitted');
  }
}

function requireMfa(user: RequestUser, message: string): void {
  if (user.mfaVerified !== true) throw new ForbiddenException(message);
}

function canonicalKey(
  tenantId: string,
  orgId: string,
  operation: string,
  key: string,
): string {
  const value = `fgis-provider:${tenantId}:${orgId}:${operation}:${key}`;
  if (value.length > 255) {
    throw new UnprocessableEntityException('Canonical idempotency key is too long');
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function payloadMatches(existing: unknown, expected: unknown): boolean {
  try {
    return canonicalJson(existing) === canonicalJson(expected);
  } catch {
    return false;
  }
}

function assertRoleForGate(user: RequestUser, gate: FgisGrainAttestationGate): void {
  if (user.role !== GATE_ROLE[gate]) {
    throw new ForbiddenException(`Role ${user.role} cannot decide ${gate} attestation`);
  }
  requireMfa(user, 'MFA verification is required for provider attestation');
}

function expectedVersion(value: string | undefined): bigint {
  if (value === undefined) {
    throw new PreconditionFailedException('If-Match configuration version is required');
  }
  return BigInt(value);
}

function auditHash(value: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function contentMatches(
  row: ConfigRow,
  draft: FgisGrainProviderConfigurationDraft,
): boolean {
  return row.environment === draft.environment
    && row.endpointReference === draft.endpointReference
    && row.tlsPolicyReference === draft.tlsPolicyReference
    && row.credentialReference === draft.credentialReference
    && row.signingKeyReference === draft.signingKeyReference
    && row.payloadStoreReference === draft.payloadStoreReference;
}

@Injectable()
export class FgisGrainProviderAttestationRepository {
  constructor(private readonly transactions: RlsTransactionService) {}

  async upsertDraft(
    user: RequestUser,
    command: UpsertProviderConfigurationCommand,
  ): Promise<ProviderConfigurationReceipt> {
    requireMutationRole(user);
    requireMetadata(command);
    const draft = assertFgisGrainProviderConfigurationDraft(command.draft);
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(
          context.tenantId,
          context.orgId,
          'draft',
          command.idempotencyKey,
        );
        await this.lockIdempotency(tx, key);
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
          reason: command.reason.trim(),
        };
        const replay = await this.findReplay(tx, key);
        if (replay) return this.replayReceipt(replay, authority, CONFIG_EVENT);

        const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
          SELECT *
          FROM public."fgis_grain_provider_configurations"
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
          if (
            command.expectedVersion !== undefined
            && command.expectedVersion !== '0'
          ) {
            throw new PreconditionFailedException(
              'Configuration does not exist at expected version',
            );
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
              ${configurationId}, ${context.tenantId}, ${context.orgId},
              ${draft.environment}, ${draft.endpointReference},
              ${draft.tlsPolicyReference}, ${draft.credentialReference},
              ${draft.signingKeyReference}, ${draft.payloadStoreReference},
              'DRAFT', 0, ${context.userId}, ${context.userId}
            )
          `);
        } else {
          if (current.status === 'REVOKED') {
            throw new ConflictException('Revoked configuration cannot be edited');
          }
          const match = expectedVersion(command.expectedVersion);
          if (current.version !== match) {
            throw new PreconditionFailedException('Configuration version changed');
          }
          if (contentMatches(current, draft)) {
            throw new ConflictException('Configuration content did not change');
          }
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
          if (updated !== 1) {
            throw new PreconditionFailedException('Configuration version changed');
          }
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
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async submitForReview(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
  ): Promise<ProviderConfigurationReceipt> {
    requireMutationRole(user);
    requireMetadata(metadata);
    return this.transitionStatus(
      user,
      configurationId,
      metadata,
      'submit',
      ['DRAFT'],
      'UNDER_REVIEW',
      CONFIG_EVENT,
      'FGIS_GRAIN_PROVIDER_UNDER_REVIEW',
    );
  }

  async recordAttestation(
    user: RequestUser,
    command: RecordProviderAttestationCommand,
  ): Promise<ProviderConfigurationReceipt> {
    requireMetadata(command);
    const attestation = assertFgisGrainProviderAttestationInput(command.attestation);
    assertRoleForGate(user, attestation.gate);
    if (
      command.expectedVersion !== undefined
      && command.expectedVersion !== attestation.configurationVersion
    ) {
      throw new PreconditionFailedException(
        'If-Match and attestation configuration versions differ',
      );
    }
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(
          context.tenantId,
          context.orgId,
          `attest-${attestation.gate}`,
          command.idempotencyKey,
        );
        await this.lockIdempotency(tx, key);
        const authority = {
          operation: 'ATTEST',
          configurationId: command.configurationId,
          gate: attestation.gate,
          decision: attestation.decision,
          configurationVersion: attestation.configurationVersion,
          evidenceReference: attestation.evidenceReference,
          validUntil: attestation.validUntil,
          justification: attestation.justification,
          correlationId: command.correlationId,
          reason: command.reason.trim(),
        };
        const replay = await this.findReplay(tx, key);
        if (replay) {
          return this.replayReceipt(replay, authority, ATTESTATION_EVENT);
        }

        const configuration = await this.lockConfiguration(
          tx,
          context,
          command.configurationId,
        );
        if (configuration.status !== 'UNDER_REVIEW') {
          throw new ConflictException('Configuration is not under review');
        }
        if (
          configuration.version.toString()
          !== attestation.configurationVersion
        ) {
          throw new PreconditionFailedException(
            'Attestation is bound to a stale configuration version',
          );
        }
        const actorConflict = await tx.$queryRaw<Array<{ gate: string }>>(
          Prisma.sql`
            SELECT "gate"
            FROM public."fgis_grain_provider_attestations"
            WHERE "configurationId" = ${configuration.id}
              AND "configurationVersion" = ${configuration.version}
              AND "actorUserId" = ${context.userId}
              AND "validUntil" > clock_timestamp()
            LIMIT 1
          `,
        );
        if (actorConflict.length > 0) {
          throw new ConflictException(
            'One actor cannot decide multiple gates for the same version',
          );
        }

        const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
          SELECT "hash"
          FROM public."fgis_grain_provider_attestations"
          WHERE "configurationId" = ${configuration.id}
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT 1
          FOR UPDATE
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
          justification: attestation.justification,
          evidenceReference: attestation.evidenceReference,
          validUntil: attestation.validUntil,
          prevHash,
        });
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO public."fgis_grain_provider_attestations" (
            "id", "configurationId", "tenantId", "organizationId",
            "gate", "decision", "configurationVersion", "actorUserId",
            "actorRole", "mfaVerified", "justification",
            "evidenceReference", "validUntil", "idempotencyKey",
            "correlationId", "hash", "prevHash"
          ) VALUES (
            ${id}, ${configuration.id}, ${context.tenantId}, ${context.orgId},
            ${attestation.gate}, ${attestation.decision},
            ${configuration.version}, ${context.userId}, ${context.role}, true,
            ${attestation.justification}, ${attestation.evidenceReference},
            ${new Date(attestation.validUntil)}, ${key},
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
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async activateTest(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
  ): Promise<ProviderConfigurationReceipt> {
    requireMetadata(metadata);
    if (user.role !== Role.EXECUTIVE) {
      throw new ForbiddenException(
        'Executive authority is required for test activation',
      );
    }
    requireMfa(user, 'Executive MFA authority is required for test activation');
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(
          context.tenantId,
          context.orgId,
          'activate-test',
          metadata.idempotencyKey,
        );
        await this.lockIdempotency(tx, key);
        const authority = {
          operation: 'ACTIVATE_TEST',
          configurationId,
          expectedVersion: metadata.expectedVersion ?? null,
          correlationId: metadata.correlationId,
          reason: metadata.reason.trim(),
        };
        const replay = await this.findReplay(tx, key);
        if (replay) {
          return this.replayReceipt(replay, authority, ACTIVATION_EVENT);
        }

        const configuration = await this.lockConfiguration(
          tx,
          context,
          configurationId,
        );
        assertTestActivationAllowed(configuration.environment);
        if (configuration.status !== 'UNDER_REVIEW') {
          throw new ConflictException(
            'Configuration is not ready for test activation',
          );
        }
        const match = expectedVersion(metadata.expectedVersion);
        if (configuration.version !== match) {
          throw new PreconditionFailedException('Configuration version changed');
        }

        const approvals = await this.latestAttestations(
          tx,
          configuration.id,
          configuration.version,
        );
        const approved = new Map(
          approvals
            .filter(
              (row) => row.decision === 'APPROVED'
                && row.validUntil.getTime() > Date.now(),
            )
            .map((row) => [row.gate, row]),
        );
        const missing = FGIS_GRAIN_ATTESTATION_GATES.filter(
          (gate) => !approved.has(gate),
        );
        if (missing.length > 0) {
          throw new ConflictException(
            `Missing live attestations: ${missing.join(', ')}`,
          );
        }
        if (
          new Set([...approved.values()].map((row) => row.actorUserId)).size
          !== FGIS_GRAIN_ATTESTATION_GATES.length
        ) {
          throw new ConflictException(
            'All attestation gates require independent actors',
          );
        }

        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE public."fgis_grain_provider_configurations"
          SET "status" = 'TEST_APPROVED',
              "updatedByUserId" = ${context.userId},
              "updatedAt" = clock_timestamp()
          WHERE "id" = ${configuration.id}
            AND "version" = ${configuration.version}
            AND "status" = 'UNDER_REVIEW'
        `);
        if (updated !== 1) {
          throw new PreconditionFailedException('Configuration state changed');
        }
        return this.writeEvidence(tx, context, {
          eventType: ACTIVATION_EVENT,
          action: 'FGIS_GRAIN_PROVIDER_TEST_ACTIVATED',
          configurationId: configuration.id,
          version: configuration.version,
          state: 'TEST_APPROVED',
          key,
          correlationId: metadata.correlationId,
          reason: metadata.reason.trim(),
          authority,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  async suspend(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
  ): Promise<ProviderConfigurationReceipt> {
    if (!SUSPEND_ROLES.has(user.role)) {
      throw new ForbiddenException('Provider suspension authority is required');
    }
    requireMfa(user, 'MFA is required for provider suspension');
    requireMetadata(metadata);
    return this.transitionStatus(
      user,
      configurationId,
      metadata,
      'suspend',
      ['UNDER_REVIEW', 'TEST_APPROVED'],
      'SUSPENDED',
      SUSPENSION_EVENT,
      'FGIS_GRAIN_PROVIDER_SUSPENDED',
    );
  }

  async revoke(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
  ): Promise<ProviderConfigurationReceipt> {
    if (!REVOKE_ROLES.has(user.role)) {
      throw new ForbiddenException('Provider revocation authority is required');
    }
    requireMfa(user, 'MFA is required for provider revocation');
    requireMetadata(metadata);
    return this.transitionStatus(
      user,
      configurationId,
      metadata,
      'revoke',
      ['DRAFT', 'UNDER_REVIEW', 'TEST_APPROVED', 'SUSPENDED'],
      'REVOKED',
      REVOCATION_EVENT,
      'FGIS_GRAIN_PROVIDER_REVOKED',
    );
  }

  async getView(
    user: RequestUser,
    configurationId: string,
  ): Promise<FgisGrainProviderConfigurationView> {
    requireReadRole(user);
    return this.transactions.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
        SELECT *
        FROM public."fgis_grain_provider_configurations"
        WHERE "id" = ${configurationId}
          AND "tenantId" = ${context.tenantId}
          AND "organizationId" = ${context.orgId}
      `);
      const configuration = rows[0];
      if (!configuration) {
        throw new NotFoundException('Provider configuration not found');
      }
      const attestations = await this.latestAttestations(
        tx,
        configuration.id,
      );
      const latest = new Map(attestations.map((row) => [row.gate, row]));
      const gates = FGIS_GRAIN_ATTESTATION_GATES.map((gate) => {
        const row = latest.get(gate);
        let state: 'MISSING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'STALE'
          = 'MISSING';
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
          configurationVersion:
            row?.configurationVersion.toString() ?? null,
        } as const;
      });

      const blockers: string[] = [];
      if (configuration.environment === 'PRODUCTION') {
        blockers.push('PRODUCTION_ACTIVATION_FORBIDDEN');
      }
      if (configuration.status === 'DRAFT') blockers.push('REVIEW_NOT_SUBMITTED');
      if (configuration.status === 'SUSPENDED') blockers.push('CONFIGURATION_SUSPENDED');
      if (configuration.status === 'REVOKED') blockers.push('CONFIGURATION_REVOKED');
      if (configuration.status !== 'DRAFT' && configuration.status !== 'REVOKED') {
        blockers.push(
          ...gates
            .filter((gate) => gate.state !== 'APPROVED')
            .map((gate) => `${gate.gate}_${gate.state}`),
        );
      }

      let nextAction = 'RESOLVE_ATTESTATION_BLOCKERS';
      if (configuration.status === 'DRAFT') nextAction = 'SUBMIT_FOR_REVIEW';
      else if (configuration.status === 'REVOKED') nextAction = 'NO_ACTION_REVOKED';
      else if (configuration.status === 'SUSPENDED') nextAction = 'REVIEW_SUSPENSION';
      else if (blockers.length === 0 && configuration.status === 'UNDER_REVIEW') {
        nextAction = 'ACTIVATE_TEST';
      } else if (blockers.length === 0 && configuration.status === 'TEST_APPROVED') {
        nextAction = 'TEST_CONFIGURATION_ACTIVE';
      }

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
        nextAction,
        productionActivationAllowed: false,
        operationalStatus: FGIS_GRAIN_PROVIDER_OPERATIONAL_STATUS,
      };
    });
  }

  private async transitionStatus(
    user: RequestUser,
    configurationId: string,
    metadata: ProviderCommandMetadata,
    operation: string,
    allowedFrom: readonly FgisGrainProviderConfigurationState[],
    to: FgisGrainProviderConfigurationState,
    eventType: string,
    action: string,
  ): Promise<ProviderConfigurationReceipt> {
    return this.transactions.withTrustedContext(
      user,
      async (tx, context) => {
        const key = canonicalKey(
          context.tenantId,
          context.orgId,
          operation,
          metadata.idempotencyKey,
        );
        await this.lockIdempotency(tx, key);
        const authority = {
          operation: operation.toUpperCase(),
          configurationId,
          allowedFrom: [...allowedFrom],
          to,
          expectedVersion: metadata.expectedVersion ?? null,
          correlationId: metadata.correlationId,
          reason: metadata.reason.trim(),
        };
        const replay = await this.findReplay(tx, key);
        if (replay) return this.replayReceipt(replay, authority, eventType);

        const configuration = await this.lockConfiguration(
          tx,
          context,
          configurationId,
        );
        if (!allowedFrom.includes(configuration.status)) {
          throw new ConflictException(
            `State ${configuration.status} cannot transition to ${to}`,
          );
        }
        const match = expectedVersion(metadata.expectedVersion);
        if (configuration.version !== match) {
          throw new PreconditionFailedException('Configuration version changed');
        }
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE public."fgis_grain_provider_configurations"
          SET "status" = ${to},
              "updatedByUserId" = ${context.userId},
              "updatedAt" = clock_timestamp()
          WHERE "id" = ${configuration.id}
            AND "version" = ${configuration.version}
            AND "status" = ${configuration.status}
        `);
        if (updated !== 1) {
          throw new PreconditionFailedException('Configuration state changed');
        }
        return this.writeEvidence(tx, context, {
          eventType,
          action,
          configurationId,
          version: configuration.version,
          state: to,
          key,
          correlationId: metadata.correlationId,
          reason: metadata.reason.trim(),
          authority,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  private async lockIdempotency(
    tx: Prisma.TransactionClient,
    key: string,
  ): Promise<void> {
    await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
      WITH acquired AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
      )
      SELECT true AS "locked" FROM acquired
    `);
  }

  private async lockConfiguration(
    tx: Prisma.TransactionClient,
    context: TrustedContext,
    configurationId: string,
  ): Promise<ConfigRow> {
    const rows = await tx.$queryRaw<ConfigRow[]>(Prisma.sql`
      SELECT *
      FROM public."fgis_grain_provider_configurations"
      WHERE "id" = ${configurationId}
        AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId}
      FOR UPDATE
    `);
    const configuration = rows[0];
    if (!configuration) {
      throw new NotFoundException('Provider configuration not found');
    }
    return configuration;
  }

  private async latestAttestations(
    tx: Prisma.TransactionClient,
    configurationId: string,
    version?: bigint,
  ): Promise<AttestationRow[]> {
    return tx.$queryRaw<AttestationRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("gate")
        "gate", "decision", "configurationVersion", "actorUserId",
        "actorRole", "evidenceReference", "validUntil", "createdAt"
      FROM public."fgis_grain_provider_attestations"
      WHERE "configurationId" = ${configurationId}
        ${version === undefined
          ? Prisma.empty
          : Prisma.sql`AND "configurationVersion" = ${version}`}
      ORDER BY "gate", "createdAt" DESC, "id" DESC
    `);
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    key: string,
  ): Promise<OutboxReplayRow | undefined> {
    const rows = await tx.$queryRaw<OutboxReplayRow[]>(Prisma.sql`
      SELECT o."id", o."type", o."payload", o."auditId",
             o."correlationId", o."idempotencyKey",
             a."action" AS "auditAction", a."reason" AS "auditReason",
             a."metadata" AS "auditMetadata",
             a."runtimeIdempotencyKey" AS "auditRuntimeIdempotencyKey"
      FROM public."outbox_entries" o
      LEFT JOIN public."audit_events" a ON a."id" = o."auditId"
      WHERE o."idempotencyKey" = ${key}
      FOR UPDATE OF o
    `);
    return rows[0];
  }

  private replayReceipt(
    replay: OutboxReplayRow,
    authority: Record<string, unknown>,
    expectedEventType: string,
  ): ProviderConfigurationReceipt {
    const payload = asRecord(replay.payload);
    if (
      replay.type !== expectedEventType
      || replay.idempotencyKey !== replay.auditRuntimeIdempotencyKey
      || !replay.auditId
      || !replay.correlationId
      || replay.auditReason !== authority.reason
      || !payloadMatches(payload.authority, authority)
      || !payloadMatches(replay.auditMetadata, payload)
      || typeof payload.configurationId !== 'string'
      || typeof payload.version !== 'string'
      || typeof payload.state !== 'string'
    ) {
      throw new ConflictException(
        'Idempotency key is bound to another provider command',
      );
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
    context: TrustedContext,
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
    await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
      WITH acquired AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(${AUDIT_CHAIN_LOCK}, 0))
      )
      SELECT true AS "locked" FROM acquired
    `);
    const auditId = randomUUID();
    const outboxId = randomUUID();
    const previous = await tx.$queryRaw<HashRow[]>(Prisma.sql`
      SELECT "hash"
      FROM public."audit_events"
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 1
      FOR UPDATE
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
        "objectType", "objectId", "afterState", "outcome", "reason",
        "metadata", "correlationId", "runtimeIdempotencyKey", "hash",
        "prevHash"
      ) VALUES (
        ${auditId}, ${input.action}, ${context.userId}, ${context.role},
        ${context.tenantId}, ${context.orgId}, ${OBJECT_TYPE},
        ${input.configurationId},
        CAST(${JSON.stringify({
          state: input.state,
          version: input.version.toString(),
        })} AS jsonb),
        'SUCCESS', ${input.reason}, CAST(${JSON.stringify(eventPayload)} AS jsonb),
        ${input.correlationId}, ${input.key}, ${hash}, ${prevHash || null}
      )
      RETURNING "id"
    `);
    if (audit[0]?.id !== auditId) {
      throw new ConflictException('Provider audit persistence failed');
    }
    const outbox = await tx.$queryRaw<IdRow[]>(Prisma.sql`
      INSERT INTO public."outbox_entries" (
        "id", "type", "payload", "status", "triggeredByUserId",
        "idempotencyKey", "correlationId", "auditId", "nextRetryAt"
      ) VALUES (
        ${outboxId}, ${input.eventType},
        CAST(${JSON.stringify(eventPayload)} AS jsonb), 'PENDING',
        ${context.userId}, ${input.key}, ${input.correlationId},
        ${auditId}, clock_timestamp()
      )
      RETURNING "id"
    `);
    if (outbox[0]?.id !== outboxId) {
      throw new ConflictException('Provider outbox persistence failed');
    }
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
