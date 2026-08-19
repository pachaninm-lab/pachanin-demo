import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestUser } from '../../common/types/request-user';
import { Capability } from '../auth/membership-capability.resolver';
import { DEFAULT_MFA_MAX_AGE_SECONDS } from '../auth/signing-authority.policy';
import {
  ONE_C_PROTOCOL_VERSION,
  type OneCCommand,
  type OneCSelfDiscovery,
  validateOneCDiscovery,
} from './one-c-connector.protocol';
import {
  type OneCMachineCredentialRecord,
  verifyOneCMachineCredential,
} from './one-c-machine-credential.policy';
import { WorkTaskRepository } from './work-task.repository';

export const OneCPairingChallengeOutcome = {
  ISSUED: 'ISSUED',
  REFUSED: 'REFUSED',
} as const;
export type OneCPairingChallengeOutcome =
  (typeof OneCPairingChallengeOutcome)[keyof typeof OneCPairingChallengeOutcome];

export const OneCBindingReadOutcome = {
  AVAILABLE: 'AVAILABLE',
  NOT_CONNECTED: 'NOT_CONNECTED',
  REFUSED: 'REFUSED',
} as const;
export type OneCBindingReadOutcome =
  (typeof OneCBindingReadOutcome)[keyof typeof OneCBindingReadOutcome];

export const OneCBindingRevokeOutcome = {
  REVOKED: 'REVOKED',
  NOT_FOUND: 'NOT_FOUND',
  REFUSED: 'REFUSED',
} as const;
export type OneCBindingRevokeOutcome =
  (typeof OneCBindingRevokeOutcome)[keyof typeof OneCBindingRevokeOutcome];

export const OneCHumanRefusal = {
  CAPABILITY_REQUIRED: 'CAPABILITY_REQUIRED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_STALE: 'MFA_STALE',
} as const;
export type OneCHumanRefusal =
  (typeof OneCHumanRefusal)[keyof typeof OneCHumanRefusal];

export const OneCMachineAuthenticationDenial = {
  MALFORMED_BEARER: 'MALFORMED_BEARER',
  NOT_FOUND: 'NOT_FOUND',
  INSTALLATION_NOT_ACTIVE: 'INSTALLATION_NOT_ACTIVE',
  BINDING_NOT_ACTIVE: 'BINDING_NOT_ACTIVE',
  MALFORMED_PERSISTED_VERSION: 'MALFORMED_PERSISTED_VERSION',
} as const;
export type OneCMachineAuthenticationDenial =
  | (typeof OneCMachineAuthenticationDenial)[keyof typeof OneCMachineAuthenticationDenial]
  | 'MALFORMED'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SCOPE_MISMATCH'
  | 'COMMAND_NOT_ALLOWED'
  | 'SECRET_MISMATCH';

export class OneCRuntimeRepositoryError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'OneCRuntimeRepositoryError';
  }
}

export interface OneCPairingChallengeIssue {
  readonly outcome: OneCPairingChallengeOutcome;
  readonly challengeId: string | null;
  /** One-time plaintext returned only on ISSUED. */
  readonly pairingCode: string | null;
  readonly expiresAt: Date | null;
  readonly refusal: OneCHumanRefusal | null;
}

export interface OneCPairingConsumeResult {
  readonly installationId: string;
  readonly bindingId: string;
  readonly credentialId: string;
  /** Returned once to the connector. Never persist/log this value. */
  readonly machineBearer: string;
  readonly credentialExpiresAt: Date;
  readonly organizationId: string;
  readonly oneCOrganizationGuid: string;
  readonly protocolVersion: string;
  readonly allowedCommands: readonly OneCCommand[];
}

export interface OneCBindingView {
  readonly bindingId: string;
  readonly installationId: string;
  readonly organizationId: string;
  readonly oneCOrganizationGuid: string;
  readonly oneCInn: string;
  readonly oneCKpp: string | null;
  readonly oneCName: string;
  readonly compatibilityProfile: string;
  readonly capabilityProfile: readonly OneCCommand[];
  readonly bindingStatus: string;
  readonly platformVersion: string;
  readonly configurationName: string;
  readonly configurationVersion: string;
  readonly connectorVersion: string;
  readonly protocolVersion: string;
  readonly installationStatus: string;
  readonly lastPairingAt: Date;
  readonly lastHeartbeatAt: Date | null;
  readonly credentialExpiresAt: Date | null;
  readonly credentialLastUsedAt: Date | null;
}

export type OneCMachineAuthentication =
  | {
      readonly authorized: true;
      readonly credentialId: string;
      readonly installationId: string;
      readonly connectionId: string;
      readonly organizationId: string;
      readonly oneCOrganizationGuid: string;
      readonly protocolVersion: string;
      readonly allowedCommands: readonly OneCCommand[];
    }
  | {
      readonly authorized: false;
      readonly reason: OneCMachineAuthenticationDenial;
    };

interface ChallengeRow {
  challengeId: string;
  pairingCode: string;
  expiresAt: Date;
}

interface PairingRow {
  installationId: string;
  bindingId: string;
  credentialId: string;
  machineBearer: string;
  credentialExpiresAt: Date;
  organizationId: string;
  oneCOrganizationGuid: string;
  protocolVersion: string;
  allowedCommands: string[];
}

interface BindingRow {
  bindingId: string;
  installationId: string;
  organizationId: string;
  oneCOrganizationGuid: string;
  oneCInn: string;
  oneCKpp: string | null;
  oneCName: string;
  compatibilityProfile: string;
  capabilityProfile: string[];
  bindingStatus: string;
  platformVersion: string;
  configurationName: string;
  configurationVersion: string;
  connectorVersion: string;
  protocolVersion: string;
  installationStatus: string;
  lastPairingAt: Date;
  lastHeartbeatAt: Date | null;
  credentialExpiresAt: Date | null;
  credentialLastUsedAt: Date | null;
}

interface CredentialRow {
  credentialId: string;
  salt: string;
  secretHash: string;
  installationId: string;
  bindingId: string;
  organizationId: string;
  oneCOrganizationGuid: string;
  protocolVersion: string;
  allowedCommands: string[];
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  credentialStatus: string;
  bindingStatus: string;
  installationStatus: string;
  version: bigint;
}

@Injectable()
export class OneCRuntimeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: RlsTransactionService,
    private readonly tasks: WorkTaskRepository,
  ) {}

  /**
   * Issue the one-time code shown to an authorized organization administrator.
   *
   * The code itself is generated inside PostgreSQL and returned once. The
   * repository never receives salt/hash material and therefore cannot
   * accidentally serialize it to a controller response.
   */
  async createPairingChallenge(
    user: RequestUser | undefined,
    input: { correlationId: string; ttlSeconds?: number; now?: Date },
  ): Promise<OneCPairingChallengeIssue> {
    const now = input.now ?? new Date();

    return this.transactions.withOrganizationMemberContext(
      user,
      async (tx) => {
        const capabilities = await this.tasks.capabilitiesWithin(tx, now);
        if (!capabilities.includes(Capability.INTEGRATIONS_CONFIGURE)) {
          return refusedChallenge(OneCHumanRefusal.CAPABILITY_REQUIRED);
        }
        const mfa = freshMfa(user, now);
        if (mfa !== null) return refusedChallenge(mfa);

        const rows = await tx.$queryRaw<ChallengeRow[]>(Prisma.sql`
          SELECT
            challenge_id AS "challengeId",
            pairing_code AS "pairingCode",
            expires_at AS "expiresAt"
          FROM connector.create_one_c_pairing_challenge(
            ${input.correlationId},
            ${input.ttlSeconds ?? 600}
          )
        `);
        const row = rows[0];
        if (!row) throw new OneCRuntimeRepositoryError('ONE_C_PAIRING_CHALLENGE_NOT_RETURNED');

        return {
          outcome: OneCPairingChallengeOutcome.ISSUED,
          challengeId: row.challengeId,
          pairingCode: row.pairingCode,
          expiresAt: row.expiresAt,
          refusal: null,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  /**
   * Atomically consume a one-time code after validating connector discovery.
   *
   * There is deliberately no client-selected organization GUID. The pairing
   * code is bound to one platform organization and PostgreSQL selects exactly
   * one discovered legal entity by the platform organization's INN/KPP. This
   * removes an authority decision from the connector/browser request.
   */
  async consumePairing(input: {
    pairingCode: string;
    discovery: OneCSelfDiscovery;
    correlationId: string;
  }): Promise<OneCPairingConsumeResult> {
    validateOneCDiscovery(input.discovery);
    if (input.discovery.protocolVersion !== ONE_C_PROTOCOL_VERSION) {
      throw new OneCRuntimeRepositoryError('ONE_C_PROTOCOL_VERSION_UNSUPPORTED');
    }
    if (input.discovery.capabilities.length === 0) {
      throw new OneCRuntimeRepositoryError('ONE_C_CAPABILITIES_INVALID');
    }

    try {
      const rows = await this.prisma.$queryRaw<PairingRow[]>(Prisma.sql`
        SELECT
          installation_id AS "installationId",
          binding_id AS "bindingId",
          credential_id AS "credentialId",
          machine_bearer AS "machineBearer",
          credential_expires_at AS "credentialExpiresAt",
          organization_id AS "organizationId",
          one_c_organization_guid AS "oneCOrganizationGuid",
          protocol_version AS "protocolVersion",
          allowed_commands AS "allowedCommands"
        FROM connector.consume_one_c_pairing(
          ${input.pairingCode},
          ${input.discovery.databaseInstanceId},
          ${input.discovery.platformVersion},
          ${input.discovery.configurationName},
          ${input.discovery.configurationVersion},
          ${input.discovery.connectorVersion},
          ${input.discovery.protocolVersion},
          ARRAY[${Prisma.join([...input.discovery.capabilities])}]::text[],
          ${JSON.stringify(input.discovery.organizations)}::jsonb,
          ${input.correlationId}
        )
      `);
      const row = rows[0];
      if (!row) throw new OneCRuntimeRepositoryError('ONE_C_PAIRING_RESULT_NOT_RETURNED');

      return {
        installationId: row.installationId,
        bindingId: row.bindingId,
        credentialId: row.credentialId,
        machineBearer: row.machineBearer,
        credentialExpiresAt: row.credentialExpiresAt,
        organizationId: row.organizationId,
        oneCOrganizationGuid: row.oneCOrganizationGuid,
        protocolVersion: row.protocolVersion,
        allowedCommands: row.allowedCommands as OneCCommand[],
      };
    } catch (error) {
      if (error instanceof OneCRuntimeRepositoryError) throw error;
      throw new OneCRuntimeRepositoryError(oneCDatabaseCode(error));
    }
  }

  /** Safe human projection: never includes pairing or credential verifier data. */
  async describeBinding(
    user: RequestUser | undefined,
  ): Promise<
    | {
        readonly outcome: typeof OneCBindingReadOutcome.AVAILABLE;
        readonly binding: OneCBindingView;
      }
    | {
        readonly outcome: typeof OneCBindingReadOutcome.NOT_CONNECTED;
        readonly binding: null;
      }
    | {
        readonly outcome: typeof OneCBindingReadOutcome.REFUSED;
        readonly binding: null;
        readonly refusal: OneCHumanRefusal;
      }
  > {
    return this.transactions.withOrganizationMemberContext(user, async (tx) => {
      const capabilities = await this.tasks.capabilitiesWithin(tx);
      if (!capabilities.includes(Capability.INTEGRATIONS_READ)) {
        return {
          outcome: OneCBindingReadOutcome.REFUSED,
          binding: null,
          refusal: OneCHumanRefusal.CAPABILITY_REQUIRED,
        } as const;
      }

      const rows = await tx.$queryRaw<BindingRow[]>(Prisma.sql`
        SELECT
          binding_id AS "bindingId",
          installation_id AS "installationId",
          organization_id AS "organizationId",
          one_c_organization_guid AS "oneCOrganizationGuid",
          one_c_inn AS "oneCInn",
          one_c_kpp AS "oneCKpp",
          one_c_name AS "oneCName",
          compatibility_profile AS "compatibilityProfile",
          capability_profile AS "capabilityProfile",
          binding_status AS "bindingStatus",
          platform_version AS "platformVersion",
          configuration_name AS "configurationName",
          configuration_version AS "configurationVersion",
          connector_version AS "connectorVersion",
          protocol_version AS "protocolVersion",
          installation_status AS "installationStatus",
          last_pairing_at AS "lastPairingAt",
          last_heartbeat_at AS "lastHeartbeatAt",
          credential_expires_at AS "credentialExpiresAt",
          credential_last_used_at AS "credentialLastUsedAt"
        FROM connector.describe_one_c_binding()
      `);
      const row = rows[0];
      if (!row) {
        return { outcome: OneCBindingReadOutcome.NOT_CONNECTED, binding: null } as const;
      }
      return {
        outcome: OneCBindingReadOutcome.AVAILABLE,
        binding: {
          ...row,
          capabilityProfile: row.capabilityProfile as OneCCommand[],
        },
      } as const;
    });
  }

  async revokeBinding(
    user: RequestUser | undefined,
    input: { bindingId: string; reason: string; correlationId: string; now?: Date },
  ): Promise<
    | { readonly outcome: typeof OneCBindingRevokeOutcome.REVOKED }
    | { readonly outcome: typeof OneCBindingRevokeOutcome.NOT_FOUND }
    | {
        readonly outcome: typeof OneCBindingRevokeOutcome.REFUSED;
        readonly refusal: OneCHumanRefusal;
      }
  > {
    const now = input.now ?? new Date();
    return this.transactions.withOrganizationMemberContext(
      user,
      async (tx) => {
        const capabilities = await this.tasks.capabilitiesWithin(tx, now);
        if (!capabilities.includes(Capability.SECURITY_CONNECTION_REVOKE)) {
          return {
            outcome: OneCBindingRevokeOutcome.REFUSED,
            refusal: OneCHumanRefusal.CAPABILITY_REQUIRED,
          } as const;
        }
        const mfa = freshMfa(user, now);
        if (mfa !== null) {
          return { outcome: OneCBindingRevokeOutcome.REFUSED, refusal: mfa } as const;
        }

        const rows = await tx.$queryRaw<{ revoked: boolean }[]>(Prisma.sql`
          SELECT connector.revoke_one_c_binding(
            ${input.bindingId}, ${input.reason}, ${input.correlationId}
          ) AS revoked
        `);
        return rows[0]?.revoked
          ? ({ outcome: OneCBindingRevokeOutcome.REVOKED } as const)
          : ({ outcome: OneCBindingRevokeOutcome.NOT_FOUND } as const);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxConflictRetries: 3,
      },
    );
  }

  /**
   * Authenticate a machine bearer without accepting organization/scope claims
   * from it. Credential id only selects a random verifier row; the scope comes
   * exclusively from persistent state and the policy performs timing-safe
   * possession verification.
   */
  async authenticateMachineBearer(
    bearer: string,
    command?: OneCCommand,
    now: Date = new Date(),
  ): Promise<OneCMachineAuthentication> {
    const credentialId = credentialIdFromBearer(bearer);
    if (credentialId === null) {
      return { authorized: false, reason: OneCMachineAuthenticationDenial.MALFORMED_BEARER };
    }

    const rows = await this.prisma.$queryRaw<CredentialRow[]>(Prisma.sql`
      SELECT
        credential_id AS "credentialId",
        salt,
        secret_hash AS "secretHash",
        installation_id AS "installationId",
        binding_id AS "bindingId",
        organization_id AS "organizationId",
        one_c_organization_guid AS "oneCOrganizationGuid",
        protocol_version AS "protocolVersion",
        allowed_commands AS "allowedCommands",
        issued_at AS "issuedAt",
        expires_at AS "expiresAt",
        revoked_at AS "revokedAt",
        credential_status AS "credentialStatus",
        binding_status AS "bindingStatus",
        installation_status AS "installationStatus",
        version
      FROM connector.read_one_c_machine_credential(${credentialId})
    `);
    const row = rows[0];
    if (!row) return { authorized: false, reason: OneCMachineAuthenticationDenial.NOT_FOUND };
    if (row.installationStatus !== 'ACTIVE') {
      return { authorized: false, reason: OneCMachineAuthenticationDenial.INSTALLATION_NOT_ACTIVE };
    }
    if (row.bindingStatus !== 'ACTIVE') {
      return { authorized: false, reason: OneCMachineAuthenticationDenial.BINDING_NOT_ACTIVE };
    }
    if (row.version < 1n || row.version > BigInt(Number.MAX_SAFE_INTEGER)) {
      return { authorized: false, reason: OneCMachineAuthenticationDenial.MALFORMED_PERSISTED_VERSION };
    }

    const record: OneCMachineCredentialRecord = {
      credentialId: row.credentialId,
      salt: row.salt,
      secretHash: row.secretHash,
      scope: {
        connectorInstallationId: row.installationId,
        connectionId: row.bindingId,
        platformOrganizationId: row.organizationId,
        oneCOrganizationGuid: row.oneCOrganizationGuid,
        protocolVersion: row.protocolVersion,
        allowedCommands: row.allowedCommands as OneCCommand[],
      },
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      version: Number(row.version),
    };

    const verification = verifyOneCMachineCredential(
      record,
      bearer,
      {
        connectorInstallationId: row.installationId,
        connectionId: row.bindingId,
        platformOrganizationId: row.organizationId,
        oneCOrganizationGuid: row.oneCOrganizationGuid,
        protocolVersion: row.protocolVersion,
        command,
      },
      now,
    );
    if (!verification.authorized) return verification;

    return {
      authorized: true,
      credentialId: row.credentialId,
      installationId: row.installationId,
      connectionId: row.bindingId,
      organizationId: row.organizationId,
      oneCOrganizationGuid: row.oneCOrganizationGuid,
      protocolVersion: row.protocolVersion,
      allowedCommands: row.allowedCommands as OneCCommand[],
    };
  }
}

function refusedChallenge(refusal: OneCHumanRefusal): OneCPairingChallengeIssue {
  return {
    outcome: OneCPairingChallengeOutcome.REFUSED,
    challengeId: null,
    pairingCode: null,
    expiresAt: null,
    refusal,
  };
}

function freshMfa(
  user: RequestUser | undefined,
  now: Date,
): OneCHumanRefusal | null {
  if (user?.mfaVerified !== true || !user.mfaVerifiedAt) {
    return OneCHumanRefusal.MFA_REQUIRED;
  }
  const verifiedAt = new Date(user.mfaVerifiedAt);
  const ageMs = now.getTime() - verifiedAt.getTime();
  if (
    !Number.isFinite(verifiedAt.getTime())
    || ageMs < 0
    || ageMs > DEFAULT_MFA_MAX_AGE_SECONDS * 1000
  ) {
    return OneCHumanRefusal.MFA_STALE;
  }
  return null;
}

function credentialIdFromBearer(bearer: string): string | null {
  if (typeof bearer !== 'string') return null;
  const separator = bearer.indexOf('.');
  if (separator <= 0 || separator !== bearer.lastIndexOf('.')) return null;
  const credentialId = bearer.slice(0, separator);
  const secret = bearer.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(credentialId) || secret.length < 32 || secret.length > 128) {
    return null;
  }
  return credentialId;
}

const DATABASE_CODES = new Set([
  'ONE_C_PAIRING_CODE_INVALID',
  'ONE_C_CORRELATION_ID_INVALID',
  'ONE_C_PROTOCOL_VERSION_UNSUPPORTED',
  'ONE_C_CAPABILITIES_INVALID',
  'ONE_C_DISCOVERY_BINDING_INVALID',
  'ONE_C_DISCOVERY_ORGANIZATIONS_INVALID',
  'ONE_C_PAIRING_CHALLENGE_NOT_ACTIVE',
  'ONE_C_PAIRING_SECRET_MISMATCH',
  'ONE_C_VERIFIED_ORGANIZATION_REQUIRED',
  'ONE_C_ORGANIZATION_NOT_FOUND_IN_DISCOVERY',
  'ONE_C_DISCOVERY_ORGANIZATION_AMBIGUOUS',
  'ONE_C_PAIRING_CREATOR_NO_LONGER_ACTIVE',
  'ONE_C_INSTALLATION_NOT_ACTIVE',
  'ONE_C_ORGANIZATION_ALREADY_BOUND',
  'ONE_C_ENTITY_ALREADY_BOUND_TO_ANOTHER_ORGANIZATION',
]);

function oneCDatabaseCode(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const text = `${error.message} ${String(error.meta?.message ?? '')}`;
    for (const code of DATABASE_CODES) {
      if (text.includes(code)) return code;
    }
  }
  if (error instanceof Error) {
    for (const code of DATABASE_CODES) {
      if (error.message.includes(code)) return code;
    }
  }
  return 'ONE_C_PAIRING_REFUSED';
}
