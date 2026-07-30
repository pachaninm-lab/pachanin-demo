import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION,
  FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-provider-attestation.contract';
import {
  FgisGrainProviderAttestationRepository,
  type ProviderCommandMetadata,
  type RecordProviderAttestationCommand,
  type UpsertProviderConfigurationCommand,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-provider-attestation.repository';
import {
  FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
  FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
  type FgisGrainTenantReadTransportRequest,
  type FgisGrainTenantReadTransportResult,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.contract';
import { FgisGrainTenantReadRepository } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository';
import type {
  FgisGrainTenantReadClaimCapability,
  FgisGrainTenantReadOutcomeAuthority,
  FgisGrainTenantReadTransport,
  FgisGrainTenantReadTransportControl,
} from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.transport';

const describePostgres = process.env.PC_CROP_10C_POSTGRESQL === '1'
  ? describe
  : describe.skip;
const RUN_ID = `pc-crop-10c.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_A_OUTSIDER = `${RUN_ID}.org-a-outsider`;
const ORG_B = `${RUN_ID}.org-b`;

let prisma: PrismaService;
let runtimePrisma: PrismaClient;
let transportPrisma: PrismaClient;
let providerRepository: FgisGrainProviderAttestationRepository;
let readRepository: FgisGrainTenantReadRepository;
let transport: FakeReadTransport;

function actor(
  tenantId: string,
  orgId: string,
  id: string,
  role: Role,
  mfaVerified = true,
): RequestUser {
  return {
    id,
    email: `${id}@industrial.invalid`,
    role,
    tenantId,
    orgId,
    membershipId: `${id}.membership`,
    sessionId: `${id}.session`,
    mfaVerified,
  };
}

const EXEC_A = actor(TENANT_A, ORG_A, `${RUN_ID}.exec-a`, Role.EXECUTIVE);
const SECURITY_A = actor(TENANT_A, ORG_A, `${RUN_ID}.security-a`, Role.ADMIN);
const LEGAL_A = actor(TENANT_A, ORG_A, `${RUN_ID}.legal-a`, Role.COMPLIANCE_OFFICER);
const OPS_A = actor(TENANT_A, ORG_A, `${RUN_ID}.ops-a`, Role.SUPPORT_MANAGER);
const BUYER_A = actor(TENANT_A, ORG_A, `${RUN_ID}.buyer-a`, Role.BUYER);
const BUYER_A_OUTSIDER = actor(TENANT_A, ORG_A_OUTSIDER, `${RUN_ID}.buyer-a-outsider`, Role.BUYER);
const EXEC_B = actor(TENANT_B, ORG_B, `${RUN_ID}.exec-b`, Role.EXECUTIVE);
const BUYER_B = actor(TENANT_B, ORG_B, `${RUN_ID}.buyer-b`, Role.BUYER);
const GUEST_A = actor(TENANT_A, ORG_A, `${RUN_ID}.guest-a`, Role.GUEST);

class FakeReadTransport
implements FgisGrainTenantReadTransport, FgisGrainTenantReadOutcomeAuthority {
  available = true;
  maxExecutionMs = 5_000;
  readonly calls: FgisGrainTenantReadTransportRequest[] = [];
  private nextResult: FgisGrainTenantReadTransportResult | null = null;
  private nextPostAbortResult: FgisGrainTenantReadTransportResult | null = null;
  private nextBarrier: {
    readonly started: () => void;
    readonly wait: Promise<void>;
    readonly ignoreAbort: boolean;
  } | null = null;

  blockNext(): { readonly started: Promise<void>; readonly release: () => void } {
    return this.prepareBarrier(false);
  }

  blockNextIgnoringAbort(): {
    readonly started: Promise<void>;
    readonly release: () => void;
  } {
    return this.prepareBarrier(true);
  }

  private prepareBarrier(
    ignoreAbort: boolean,
  ): { readonly started: Promise<void>; readonly release: () => void } {
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.nextBarrier = { started: markStarted, wait, ignoreAbort };
    return { started, release };
  }

  returnNext(result: FgisGrainTenantReadTransportResult): void {
    this.nextResult = result;
  }

  completeNextOnAbort(result: FgisGrainTenantReadTransportResult): void {
    this.nextPostAbortResult = result;
  }

  reset(): void {
    this.available = true;
    this.maxExecutionMs = 5_000;
    this.calls.length = 0;
    this.nextResult = null;
    this.nextPostAbortResult = null;
    this.nextBarrier = null;
  }

  async execute(
    request: FgisGrainTenantReadTransportRequest,
    control: FgisGrainTenantReadTransportControl,
  ): Promise<FgisGrainTenantReadTransportResult> {
    const barrier = this.nextBarrier;
    const nextResult = this.nextResult;
    const postAbortResult = this.nextPostAbortResult;
    this.nextBarrier = null;
    this.nextResult = null;
    this.nextPostAbortResult = null;
    this.calls.push(request);
    barrier?.started();

    if (postAbortResult) {
      if (!control.signal.aborted) {
        await new Promise<void>((resolve) => {
          control.signal.addEventListener('abort', () => resolve(), { once: true });
        });
      }
      return postAbortResult;
    }

    if (barrier) {
      if (barrier.ignoreAbort) {
        await barrier.wait;
      } else {
        let rejectAbort!: (reason: unknown) => void;
        const aborted = new Promise<never>((_resolve, reject) => {
          rejectAbort = reject;
        });
        const onAbort = () => rejectAbort(
          control.signal.reason ?? new Error('Provider execution aborted'),
        );
        control.signal.addEventListener('abort', onAbort, { once: true });
        try {
          await Promise.race([barrier.wait, aborted]);
        } finally {
          control.signal.removeEventListener('abort', onAbort);
        }
      }
    }
    if (control.signal.aborted || Date.now() > new Date(control.deadlineAt).getTime()) {
      throw control.signal.reason ?? new Error('Provider execution deadline exceeded');
    }
    return nextResult ?? {
      providerRequestId: `${RUN_ID}.provider.${this.calls.length}`,
      responseReference: `provider-response://fgis-grain/${request.correlationId}`,
      responseSha256: 'b'.repeat(64),
      receivedAt: new Date().toISOString(),
    };
  }

  async finalize(
    claim: FgisGrainTenantReadClaimCapability,
    result: FgisGrainTenantReadTransportResult | null,
    decision: 'SUCCEEDED' | 'FAILED',
    reasonCode: 'PROVIDER_READ_SUCCEEDED' | 'PROVIDER_READ_FAILED',
  ): Promise<string> {
    return finalizeAsTransport(claim, result, decision, reasonCode);
  }

  async start(
    claim: FgisGrainTenantReadClaimCapability,
  ): Promise<string> {
    return startAsTransport(claim);
  }
}

type ProviderEnvironment = 'PRE_PRODUCTION' | 'PRODUCTION';

function providerDraft(
  suffix: string,
  environment: ProviderEnvironment = 'PRE_PRODUCTION',
) {
  const environmentPath = environment === 'PRODUCTION'
    ? 'production'
    : 'pre-production';
  return {
    schemaVersion: FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO' as const,
    apiVersion: '1.0.23' as const,
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1' as const,
    signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1' as const,
    environment,
    endpointReference: `endpoint://fgis-zerno/${environmentPath}/${suffix}`,
    tlsPolicyReference: `tls://fgis-zerno/${environmentPath}/${suffix}`,
    credentialReference: `credential://vault/fgis-zerno/${environmentPath}/${suffix}`,
    signingKeyReference: `signing-key://vault/fgis-zerno/${environmentPath}/${suffix}`,
    payloadStoreReference: `object-store://fgis-zerno/${environmentPath}/${suffix}`,
  };
}

function providerUpsert(
  key: string,
  environment: ProviderEnvironment = 'PRE_PRODUCTION',
): UpsertProviderConfigurationCommand {
  return {
    idempotencyKey: `${RUN_ID}.${key}`,
    correlationId: `${RUN_ID}.${key}.correlation`,
    reason: 'Configuration authority is changed after governed server-side review.',
    expectedVersion: '0',
    draft: providerDraft(key, environment),
  };
}

function providerMetadata(key: string, expectedVersion: string): ProviderCommandMetadata {
  return {
    idempotencyKey: `${RUN_ID}.${key}`,
    correlationId: `${RUN_ID}.${key}.correlation`,
    reason: 'Provider state transition approved through governed server-side workflow.',
    expectedVersion,
  };
}

function providerAttestation(
  configurationId: string,
  gate: 'OWNER' | 'SECURITY' | 'LEGAL' | 'OPERATIONS',
  version: string,
): RecordProviderAttestationCommand {
  return {
    configurationId,
    idempotencyKey: `${RUN_ID}.${configurationId}.${gate.toLowerCase()}`,
    correlationId: `${RUN_ID}.${configurationId}.${gate.toLowerCase()}.correlation`,
    reason: `${gate} attestation follows independent MFA-backed review.`,
    expectedVersion: version,
    attestation: {
      schemaVersion: FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION,
      gate,
      decision: 'APPROVED',
      justification: `${gate} reviewer confirmed governed test-only evidence.`,
      evidenceReference: `evidence://fgis-zerno/${gate.toLowerCase()}/${RUN_ID}`,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
      configurationVersion: version,
    },
  };
}

async function seedIdentity(): Promise<void> {
  const now = new Date();
  const innA = `77${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
  const innAOutsider = `79${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
  const innB = `78${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "tenantId", "updatedAt"
    ) VALUES
      (${ORG_A}, ${innA}, ${`${RUN_ID} Org A`}, ${TENANT_A}, ${now}),
      (${ORG_A_OUTSIDER}, ${innAOutsider}, ${`${RUN_ID} Org A Outsider`}, ${TENANT_A}, ${now}),
      (${ORG_B}, ${innB}, ${`${RUN_ID} Org B`}, ${TENANT_B}, ${now})
    ON CONFLICT ("id") DO NOTHING
  `);
  for (const user of [EXEC_A, SECURITY_A, LEGAL_A, OPS_A, BUYER_A, BUYER_A_OUTSIDER, EXEC_B, BUYER_B, GUEST_A]) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."users" (
        "id", "email", "passwordHash", "fullName", "mfaEnabled", "updatedAt"
      ) VALUES (
        ${user.id}, ${user.email}, 'not-a-real-password-hash', ${user.id},
        ${user.mfaVerified === true}, ${now}
      )
      ON CONFLICT ("id") DO NOTHING
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."user_orgs" (
        "id", "userId", "organizationId", "role", "isDefault", "joinedAt"
      ) VALUES (
        ${user.membershipId}, ${user.id}, ${user.orgId}, ${user.role}, true, ${now}
      )
      ON CONFLICT ("id") DO UPDATE
      SET "userId" = EXCLUDED."userId",
          "organizationId" = EXCLUDED."organizationId",
          "role" = EXCLUDED."role"
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO auth.sessions (
        id, user_id, membership_id, organization_id, tenant_id, status,
        refresh_family_id, credential_version, mfa_level, mfa_verified_at,
        mfa_verified_method, expires_at, created_at, updated_at
      ) VALUES (
        ${user.sessionId}, ${user.id}, ${user.membershipId}, ${user.orgId},
        ${user.tenantId}, 'ACTIVE', ${`${user.sessionId}.family`}, 1,
        ${user.mfaVerified === true ? 'TOTP' : 'NONE'},
        ${user.mfaVerified === true ? now : null},
        ${user.mfaVerified === true ? 'TOTP' : null},
        ${new Date(now.getTime() + 24 * 60 * 60_000)}, ${now}, ${now}
      )
      ON CONFLICT (id) DO UPDATE
      SET status = 'ACTIVE',
          mfa_level = EXCLUDED.mfa_level,
          mfa_verified_at = EXCLUDED.mfa_verified_at,
          mfa_verified_method = EXCLUDED.mfa_verified_method,
          expires_at = EXCLUDED.expires_at,
          revoked_at = NULL,
          revocation_reason = NULL,
          updated_at = EXCLUDED.updated_at
    `);
  }
}

async function resetAuthority(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE public."fgis_grain_tenant_read_audit_heads", public."fgis_grain_tenant_read_audits", public."fgis_grain_tenant_read_provider_claims", public."fgis_grain_tenant_read_authorizations", public."fgis_grain_provider_attestations", public."fgis_grain_provider_configurations" RESTART IDENTITY CASCADE',
  );
  transport.reset();
}

async function reviewedConfiguration(
  environment: ProviderEnvironment = 'PRE_PRODUCTION',
) {
  const created = await providerRepository.upsertDraft(
    EXEC_A,
    providerUpsert(`config-${Math.random().toString(16).slice(2)}`, environment),
  );
  const review = await providerRepository.submitForReview(
    EXEC_A,
    created.configurationId,
    providerMetadata(`submit-${created.configurationId}`, created.version),
  );
  await providerRepository.recordAttestation(
    EXEC_A,
    providerAttestation(review.configurationId, 'OWNER', review.version),
  );
  await providerRepository.recordAttestation(
    SECURITY_A,
    providerAttestation(review.configurationId, 'SECURITY', review.version),
  );
  await providerRepository.recordAttestation(
    LEGAL_A,
    providerAttestation(review.configurationId, 'LEGAL', review.version),
  );
  await providerRepository.recordAttestation(
    OPS_A,
    providerAttestation(review.configurationId, 'OPERATIONS', review.version),
  );
  return review;
}

async function approvedConfiguration(
  transportAdmitted = true,
  environment: ProviderEnvironment = 'PRE_PRODUCTION',
) {
  const review = await reviewedConfiguration(environment);
  const approved = await providerRepository.activateTest(
    EXEC_A,
    review.configurationId,
    providerMetadata(`activate-${review.configurationId}`, review.version),
  );
  expect(approved.state).toBe('TEST_APPROVED');
  await prisma.$executeRaw(Prisma.sql`
    UPDATE public."fgis_grain_provider_configurations"
    SET "tenantReadTransportAdmittedVersion" = ${
      transportAdmitted ? BigInt(approved.version) : null
    }
    WHERE "id" = ${approved.configurationId}
  `);
  return approved;
}

async function authorizeRead(configurationId: string, configurationVersion: string) {
  return readRepository.authorize(EXEC_A, {
    schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
    configurationId,
    configurationVersion,
    allowedOperations: ['DICTIONARIES', 'GET_LIST_SDIZ'],
    authorizationReference: `authorization://tenant/${ORG_A}/fgis-read`,
    validUntil: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    reason: 'Tenant executive approved the exact bounded read-only operation set.',
  });
}

function readRequest(authorizationId: string, authorizationVersion: string, suffix: string) {
  return {
    schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
    authorizationId,
    authorizationVersion,
    operationCode: 'GET_LIST_SDIZ' as const,
    requestReference: `object-store://fgis-grain/requests/${suffix}.xml`,
    requestSha256: 'a'.repeat(64),
    correlationId: `${RUN_ID}.read.${suffix}`,
    idempotencyKey: `${RUN_ID}.read.${suffix}.idempotency`,
  };
}

async function runtimeVisibleAuthorizationCount(
  user: RequestUser,
  authorizationId: string,
): Promise<bigint> {
  return runtimePrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE app_runtime');
    await tx.$queryRaw(Prisma.sql`
      SELECT
        set_config('app.current_user_id', ${user.id}, true),
        set_config('app.current_org_id', ${user.orgId}, true),
        set_config('app.current_tenant_id', ${user.tenantId}, true),
        set_config('app.current_role', ${user.role}, true),
        set_config('app.current_session_id', ${user.sessionId}, true)
    `);
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "id" = ${authorizationId}
    `);
    return rows[0]?.count ?? 0n;
  });
}

async function executeAsRuntime(
  user: RequestUser,
  statement: Prisma.Sql,
): Promise<number> {
  return runtimePrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL ROLE app_runtime');
    await tx.$queryRaw(Prisma.sql`
      SELECT
        set_config('app.current_user_id', ${user.id}, true),
        set_config('app.current_org_id', ${user.orgId}, true),
        set_config('app.current_tenant_id', ${user.tenantId}, true),
        set_config('app.current_role', ${user.role}, true),
        set_config('app.current_session_id', ${user.sessionId}, true)
    `);
    return tx.$executeRaw(statement);
  });
}

async function executeAsTransport(statement: Prisma.Sql): Promise<number> {
  return transportPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'SET LOCAL ROLE fgis_grain_read_transport',
    );
    return tx.$executeRaw(statement);
  });
}

async function startAsTransport(
  claim: FgisGrainTenantReadClaimCapability,
): Promise<string> {
  return transportPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'SET LOCAL ROLE fgis_grain_read_transport',
    );
    const rows = await tx.$queryRaw<Array<{ claimId: string }>>(Prisma.sql`
      SELECT public.start_fgis_grain_tenant_read_claim(
        ${claim.id},
        ${claim.completionToken}
      ) AS "claimId"
    `);
    const claimId = rows[0]?.claimId;
    if (!claimId) throw new Error('Dedicated transport starter returned no claim id');
    return claimId;
  });
}

async function finalizeAsTransport(
  claim: FgisGrainTenantReadClaimCapability,
  result: FgisGrainTenantReadTransportResult | null,
  decision: 'SUCCEEDED' | 'FAILED',
  reasonCode: 'PROVIDER_READ_SUCCEEDED' | 'PROVIDER_READ_FAILED',
): Promise<string> {
  return transportPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'SET LOCAL ROLE fgis_grain_read_transport',
    );
    const rows = await tx.$queryRaw<Array<{ auditId: string }>>(Prisma.sql`
      SELECT public.finalize_fgis_grain_tenant_read_claim(
        ${claim.id},
        ${claim.completionToken},
        ${decision},
        ${reasonCode},
        ${result?.providerRequestId ?? null},
        ${result?.responseReference ?? null},
        ${result?.responseSha256 ?? null},
        ${result ? new Date(result.receivedAt) : null}
      ) AS "auditId"
    `);
    const auditId = rows[0]?.auditId;
    if (!auditId) throw new Error('Dedicated transport finalizer returned no audit id');
    return auditId;
  });
}

describePostgres('PC-CROP-10C PostgreSQL tenant-authorized FGIS Grain read', () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const runtimeDatabaseUrl = process.env.PC_CROP_10C_RUNTIME_DATABASE_URL;
    const transportDatabaseUrl = process.env.PC_CROP_10C_TRANSPORT_DATABASE_URL;
    if (!runtimeDatabaseUrl) throw new Error('PC_CROP_10C_RUNTIME_DATABASE_URL is required');
    if (!transportDatabaseUrl) throw new Error('PC_CROP_10C_TRANSPORT_DATABASE_URL is required');
    runtimePrisma = new PrismaClient({ datasources: { db: { url: runtimeDatabaseUrl } } });
    transportPrisma = new PrismaClient({ datasources: { db: { url: transportDatabaseUrl } } });
    await runtimePrisma.$connect();
    await transportPrisma.$connect();
    await seedIdentity();
    const providerTransactions = new RlsTransactionService(prisma);
    const runtimeTransactions = new RlsTransactionService(runtimePrisma as never);
    providerRepository = new FgisGrainProviderAttestationRepository(providerTransactions);
    transport = new FakeReadTransport();
    readRepository = new FgisGrainTenantReadRepository(
      runtimeTransactions,
      transport,
      transport,
    );
  });

  beforeEach(async () => {
    await seedIdentity();
    await resetAuthority();
  });

  afterAll(async () => {
    await transportPrisma.$disconnect();
    await runtimePrisma.$disconnect();
    await prisma.$disconnect();
  });

  it('keeps tenant authorization non-attested until separate external evidence', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    expect(authorized).toMatchObject({
      state: 'AUTHORIZED_NOT_ATTESTED',
      authorizationVersion: '0',
      operationalStatus: 'NOT_ATTESTED',
    });
    const view = await readRepository.getView(EXEC_A, authorized.authorizationId);
    expect(view.status).toBe('AUTHORIZED_NOT_ATTESTED');
    expect(view.blockers).toContain('EXTERNAL_READ_EVIDENCE_REQUIRED');
    expect(view.operationalStatus).toBe('NOT_ATTESTED');

    await expect(readRepository.execute(
      BUYER_A,
      readRequest(authorized.authorizationId, authorized.authorizationVersion, 'before-attestation'),
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(transport.calls).toHaveLength(0);
    const denied = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "authorizationId" = ${authorized.authorizationId}
        AND "decision" = 'DENIED'
        AND "reasonCode" = 'AUTHORIZATION_NOT_ATTESTED'
    `);
    expect(denied[0]?.count).toBe(1n);
  });

  it('rejects direct database attestation while transport admission is absent', async () => {
    const configuration = await approvedConfiguration(false);
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );

    await expect(executeAsRuntime(EXEC_A, Prisma.sql`
      UPDATE public."fgis_grain_provider_configurations"
      SET "tenantReadTransportAdmittedVersion" = ${BigInt(configuration.version)}
      WHERE "id" = ${configuration.configurationId}
    `)).rejects.toThrow(/permission denied/iu);

    await expect(executeAsRuntime(SECURITY_A, Prisma.sql`
      SELECT public.attest_fgis_grain_tenant_read_authorization(
        ${authorized.authorizationId},
        ${BigInt(authorized.authorizationVersion)},
        ${`evidence://fgis-grain/transport-not-admitted/${RUN_ID}`},
        ${new Date(Date.now() + 6 * 60 * 60_000)},
        'Caller evidence cannot bypass the database-owned transport admission.',
        ${`${RUN_ID}.transport-not-admitted.audit`},
        ${`${RUN_ID}.transport-not-admitted.correlation`},
        ${`${RUN_ID}.transport-not-admitted.idempotency`},
        ${'f'.repeat(64)}
      )
    `)).rejects.toThrow(/transport admission/iu);

    const state = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT "status"
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "id" = ${authorized.authorizationId}
    `);
    expect(state).toEqual([{ status: 'AUTHORIZED_NOT_ATTESTED' }]);
  });

  it('enforces authorization and attestation TTL ceilings inside PostgreSQL', async () => {
    const configuration = await approvedConfiguration();
    const rejectedAuthorizationId = `${RUN_ID}.ttl-ceiling.rejected-authorization`;

    await expect(executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT *
      FROM public.write_fgis_grain_tenant_read_authorization(
        ${rejectedAuthorizationId},
        ${configuration.configurationId},
        ${BigInt(configuration.version)},
        ARRAY['GET_LIST_SDIZ']::text[],
        ${`authorization://ttl-ceiling/rejected/${RUN_ID}`},
        ${new Date(Date.now() + 91 * 24 * 60 * 60_000)},
        'A direct command cannot exceed the database-owned authorization TTL ceiling.',
        NULL::bigint,
        ${`${RUN_ID}.ttl-ceiling.rejected-authorization.audit`},
        ${`${RUN_ID}.ttl-ceiling.rejected-authorization.correlation`},
        ${`${RUN_ID}.ttl-ceiling.rejected-authorization.idempotency`},
        ${'a'.repeat(64)}
      )
    `)).rejects.toThrow(/authorization lifetime is invalid/iu);

    const boundedAuthorizationId = `${RUN_ID}.ttl-ceiling.bounded-authorization`;
    await executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT *
      FROM public.write_fgis_grain_tenant_read_authorization(
        ${boundedAuthorizationId},
        ${configuration.configurationId},
        ${BigInt(configuration.version)},
        ARRAY['GET_LIST_SDIZ']::text[],
        ${`authorization://ttl-ceiling/bounded/${RUN_ID}`},
        ${new Date(Date.now() + 60 * 24 * 60 * 60_000)},
        'A bounded direct command proves that the database owns the TTL ceiling.',
        NULL::bigint,
        ${`${RUN_ID}.ttl-ceiling.bounded-authorization.audit`},
        ${`${RUN_ID}.ttl-ceiling.bounded-authorization.correlation`},
        ${`${RUN_ID}.ttl-ceiling.bounded-authorization.idempotency`},
        ${'b'.repeat(64)}
      )
    `);

    await expect(executeAsRuntime(SECURITY_A, Prisma.sql`
      SELECT public.attest_fgis_grain_tenant_read_authorization(
        ${boundedAuthorizationId},
        0::bigint,
        ${`evidence://ttl-ceiling/rejected/${RUN_ID}`},
        ${new Date(Date.now() + 31 * 24 * 60 * 60_000)},
        'A direct command cannot exceed the database-owned attestation TTL ceiling.',
        ${`${RUN_ID}.ttl-ceiling.rejected-attestation.audit`},
        ${`${RUN_ID}.ttl-ceiling.rejected-attestation.correlation`},
        ${`${RUN_ID}.ttl-ceiling.rejected-attestation.idempotency`},
        ${'c'.repeat(64)}
      )
    `)).rejects.toThrow(/attestation lifetime is invalid/iu);

    const states = await prisma.$queryRaw<Array<{
      id: string;
      status: string;
      attestedAuditCount: bigint;
    }>>(Prisma.sql`
      SELECT target_authorization."id",
             target_authorization."status",
             count(audit."id") FILTER (
               WHERE audit."decision" = 'ATTESTED'
             )::bigint AS "attestedAuditCount"
      FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
      LEFT JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."authorizationId" = target_authorization."id"
      WHERE target_authorization."id" IN (
        ${rejectedAuthorizationId},
        ${boundedAuthorizationId}
      )
      GROUP BY target_authorization."id", target_authorization."status"
    `);
    expect(states).toEqual([{
      id: boundedAuthorizationId,
      status: 'AUTHORIZED_NOT_ATTESTED',
      attestedAuditCount: 0n,
    }]);
  });

  it('binds reauthorization to the existing provider configuration inside PostgreSQL', async () => {
    const firstConfiguration = await approvedConfiguration();
    const secondConfiguration = await reviewedConfiguration('PRODUCTION');
    const authorized = await authorizeRead(
      firstConfiguration.configurationId,
      firstConfiguration.version,
    );

    await expect(executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT *
      FROM public.write_fgis_grain_tenant_read_authorization(
        ${authorized.authorizationId},
        ${secondConfiguration.configurationId},
        ${BigInt(secondConfiguration.version)},
        ARRAY['DICTIONARIES', 'GET_LIST_SDIZ']::text[],
        ${`authorization://tenant/${ORG_A}/fgis-read/rebind-forbidden`},
        ${new Date(Date.now() + 24 * 60 * 60_000)},
        'A direct database caller cannot rebind an authorization to another configuration.',
        ${BigInt(authorized.authorizationVersion)},
        ${`${RUN_ID}.reauthorization-rebind.audit`},
        ${`${RUN_ID}.reauthorization-rebind.correlation`},
        ${`${RUN_ID}.reauthorization-rebind.idempotency`},
        ${'e'.repeat(64)}
      )
    `)).rejects.toThrow(/authorization version changed/iu);

    const persisted = await prisma.$queryRaw<Array<{
      configurationId: string;
      version: bigint;
      auditCount: bigint;
    }>>(Prisma.sql`
      SELECT target."configurationId", target."version",
             (
               SELECT count(*)::bigint
               FROM public."fgis_grain_tenant_read_audits" AS audit
               WHERE audit."authorizationId" = target."id"
             ) AS "auditCount"
      FROM public."fgis_grain_tenant_read_authorizations" AS target
      WHERE target."id" = ${authorized.authorizationId}
    `);
    expect(persisted).toEqual([{
      configurationId: firstConfiguration.configurationId,
      version: BigInt(authorized.authorizationVersion),
      auditCount: 1n,
    }]);
  });

  it('executes an attested read exactly once and replays the durable result', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-e2e/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent provider read E2E returned a referenced response without writes.',
    });
    expect(attested).toMatchObject({
      state: 'READ_ONLY_ATTESTED',
      authorizationVersion: '1',
      operationalStatus: 'NOT_ATTESTED',
    });

    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'replay',
    );
    const first = await readRepository.execute(BUYER_A, request);
    const replay = await readRepository.execute(BUYER_A, request);
    expect(first).toMatchObject({ replayed: false, operationCode: 'GET_LIST_SDIZ' });
    expect(replay).toEqual({ ...first, replayed: true });
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]).toMatchObject({
      operationCode: 'GET_LIST_SDIZ',
      configuration: {
        environment: 'PRE_PRODUCTION',
        credentialReference: expect.stringMatching(/^credential:\/\//u),
      },
    });
  });

  it('rejects unsafe request and provider result references before immutable storage or response', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-result-safety/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent evidence admits the result-reference safety regression.',
    });
    const unsafeRequestReference = 'object-store://fgis-grain/token=forbidden-request-secret';
    const directClaimId = `${RUN_ID}.unsafe-request-reference.claim`;
    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      SELECT public.append_fgis_grain_tenant_read_audit(
        ${directClaimId},
        ${authorized.authorizationId},
        ${BigInt(attested.authorizationVersion)},
        ${configuration.configurationId},
        'GET_LIST_SDIZ',
        ${`${RUN_ID}.unsafe-request-reference.correlation`},
        ${`${RUN_ID}.unsafe-request-reference.claim-audit`},
        ${`${RUN_ID}.unsafe-request-reference.request`},
        ${unsafeRequestReference},
        ${'a'.repeat(64)},
        'IN_FLIGHT',
        'PROVIDER_READ_CLAIMED',
        NULL,
        NULL,
        NULL,
        NULL,
        ${createHash('sha256').update('unsafe-request-reference-token').digest('hex')}
      )
    `)).rejects.toThrow(/request_reference|request reference|check constraint/iu);
    const unsafeRequestFacts = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM (
        SELECT "requestReference"
        FROM public."fgis_grain_tenant_read_provider_claims"
        WHERE "id" = ${directClaimId}
        UNION ALL
        SELECT "requestReference"
        FROM public."fgis_grain_tenant_read_audits"
        WHERE "id" = ${directClaimId}
      ) AS persisted
      WHERE persisted."requestReference" = ${unsafeRequestReference}
    `);
    expect(unsafeRequestFacts).toEqual([{ count: 0n }]);

    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'unsafe-provider-result',
    );
    const forgedDenialId = `${RUN_ID}.forged-denial.audit`;
    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      SELECT public.append_fgis_grain_tenant_read_audit(
        ${forgedDenialId},
        ${authorized.authorizationId},
        ${BigInt(attested.authorizationVersion)},
        ${configuration.configurationId},
        ${request.operationCode},
        ${`${request.correlationId}.forged-denial`},
        ${`${request.idempotencyKey}.forged-denial.audit`},
        ${`${request.idempotencyKey}.forged-denial.request`},
        ${request.requestReference},
        ${request.requestSha256},
        'DENIED',
        'AUTHORIZATION_NOT_ATTESTED',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
      )
    `)).rejects.toThrow(/denial condition is not present|denial audit is invalid/iu);
    const forgedDenialCount = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "id" = ${forgedDenialId}
    `);
    expect(forgedDenialCount).toEqual([{ count: 0n }]);

    const unsafeReference = 'provider-response://fgis-grain/token=forbidden-secret';
    transport.returnNext({
      providerRequestId: `${RUN_ID}.provider.unsafe-result`,
      responseReference: unsafeReference,
      responseSha256: 'b'.repeat(64),
      receivedAt: new Date().toISOString(),
    });

    await expect(readRepository.execute(BUYER_A, request)).rejects.toMatchObject({
      code: 'INLINE_SECRET_FORBIDDEN',
    });

    const outcomes = await prisma.$queryRaw<Array<{
      decision: string;
      responseReference: string | null;
    }>>(Prisma.sql`
      SELECT "decision", "responseReference"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "requestIdempotencyKey" = ${request.idempotencyKey}
      ORDER BY "chainSequence"
    `);
    expect(outcomes).toEqual([
      { decision: 'IN_FLIGHT', responseReference: null },
    ]);
    expect(JSON.stringify(outcomes)).not.toContain(unsafeReference);

    const quarantinedClaims = await prisma.$queryRaw<Array<{
      started: boolean;
      completed: boolean;
    }>>(Prisma.sql`
      SELECT "transportStartedAt" IS NOT NULL AS "started",
             "completedAuditId" IS NOT NULL AS "completed"
      FROM public."fgis_grain_tenant_read_provider_claims"
      WHERE "requestIdempotencyKey" = ${request.idempotencyKey}
    `);
    expect(quarantinedClaims).toEqual([{
      started: true,
      completed: false,
    }]);

    const retryWithNewKey = {
      ...request,
      correlationId: `${request.correlationId}.retry`,
      idempotencyKey: `${request.idempotencyKey}.retry`,
    };
    await expect(
      readRepository.execute(BUYER_A, retryWithNewKey),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transport.calls).toHaveLength(1);
  });

  it('cancels a stalled provider read before lease expiry and records one failed outcome', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-deadline/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent evidence admits the abortable deadline regression.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'provider-deadline',
    );
    transport.maxExecutionMs = 50;
    const barrier = transport.blockNext();
    const execution = readRepository.execute(BUYER_A, request);
    await barrier.started;

    await expect(execution).rejects.toMatchObject({
      response: {
        code: 'FGIS_GRAIN_READ_DEADLINE_EXCEEDED',
        retryable: true,
      },
    });

    const terminal = await prisma.$queryRaw<Array<{
      decision: string;
      completedBeforeLeaseExpiry: boolean;
    }>>(Prisma.sql`
      SELECT audit."decision",
             claim."completedAt" < claim."leaseExpiresAt"
               AS "completedBeforeLeaseExpiry"
      FROM public."fgis_grain_tenant_read_provider_claims" AS claim
      JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."id" = claim."completedAuditId"
      WHERE claim."requestIdempotencyKey" = ${request.idempotencyKey}
    `);
    expect(terminal).toEqual([{
      decision: 'FAILED',
      completedBeforeLeaseExpiry: true,
    }]);
    expect(transport.calls).toHaveLength(1);
  });

  it('preserves a provider completion acknowledged immediately after the deadline abort', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-post-abort-completion/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent evidence admits the post-abort completion race regression.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'provider-post-abort-completion',
    );
    const result = {
      providerRequestId: `${RUN_ID}.provider.post-abort-completion`,
      responseReference: `provider-response://fgis-grain/${request.correlationId}`,
      responseSha256: 'b'.repeat(64),
      receivedAt: new Date().toISOString(),
    };
    transport.maxExecutionMs = 50;
    transport.completeNextOnAbort(result);

    await expect(
      readRepository.execute(BUYER_A, request),
    ).resolves.toMatchObject({
      providerRequestId: result.providerRequestId,
      responseReference: result.responseReference,
      replayed: false,
    });

    const terminal = await prisma.$queryRaw<Array<{ decision: string }>>(Prisma.sql`
      SELECT audit."decision"
      FROM public."fgis_grain_tenant_read_provider_claims" AS claim
      JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."id" = claim."completedAuditId"
      WHERE claim."requestIdempotencyKey" = ${request.idempotencyKey}
    `);
    expect(terminal).toEqual([{ decision: 'SUCCEEDED' }]);
    expect(transport.calls).toHaveLength(1);
  });

  it('keeps an unconfirmed cancellation in flight and blocks a new-key duplicate', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-unconfirmed-cancellation/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent evidence admits the uncooperative transport regression.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'provider-unconfirmed-cancellation',
    );
    transport.maxExecutionMs = 50;
    const barrier = transport.blockNextIgnoringAbort();
    const execution = readRepository.execute(BUYER_A, request);
    await barrier.started;

    await expect(execution).rejects.toMatchObject({
      response: {
        code: 'FGIS_GRAIN_READ_DEADLINE_EXCEEDED',
        cancellationConfirmed: false,
        claimState: 'IN_FLIGHT',
      },
    });

    const claims = await prisma.$queryRaw<Array<{
      id: string;
      started: boolean;
      completed: boolean;
    }>>(Prisma.sql`
      SELECT "id",
             "transportStartedAt" IS NOT NULL AS "started",
             "completedAuditId" IS NOT NULL AS "completed"
      FROM public."fgis_grain_tenant_read_provider_claims"
      WHERE "requestIdempotencyKey" = ${request.idempotencyKey}
    `);
    expect(claims).toEqual([{
      id: expect.any(String),
      started: true,
      completed: false,
    }]);

    const retryWithNewKey = {
      ...request,
      correlationId: `${request.correlationId}.retry`,
      idempotencyKey: `${request.idempotencyKey}.retry`,
    };
    await expect(
      readRepository.execute(BUYER_A, retryWithNewKey),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transport.calls).toHaveLength(1);

    barrier.release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    const decisions = await prisma.$queryRaw<Array<{ decision: string }>>(Prisma.sql`
      SELECT "decision"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "requestIdempotencyKey" = ${request.idempotencyKey}
      ORDER BY "chainSequence"
    `);
    expect(decisions).toEqual([{ decision: 'IN_FLIGHT' }]);
  });

  it('admits only one provider call for concurrent requests with one idempotency key', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-single-flight/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent provider read evidence enables the bounded single-flight test.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'single-flight',
    );
    const barrier = transport.blockNext();
    const first = readRepository.execute(BUYER_A, request);
    await barrier.started;

    try {
      await expect(readRepository.execute(BUYER_A, request)).rejects.toMatchObject({
        response: {
          code: 'FGIS_GRAIN_READ_IN_FLIGHT',
          retryable: true,
        },
      });
    } finally {
      barrier.release();
    }
    expect(transport.calls).toHaveLength(1);

    await expect(first).resolves.toMatchObject({
      replayed: false,
      operationCode: 'GET_LIST_SDIZ',
    });
    const replay = await readRepository.execute(BUYER_A, request);
    expect(replay.replayed).toBe(true);
    expect(transport.calls).toHaveLength(1);
  });

  it('recovers an abandoned provider claim only after its lease expires', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-abandoned-claim/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent evidence admits recovery of the exact abandoned read claim.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'abandoned-claim',
    );
    const claimId = `${RUN_ID}.abandoned-claim.claim`;
    const abandonedCompletionToken = `${RUN_ID}.abandoned-claim.lost-capability`;
    const abandonedCompletionTokenSha256 = createHash('sha256')
      .update(abandonedCompletionToken)
      .digest('hex');
    const abandonedCreatedAt = new Date(Date.now() - 10 * 60_000);
    const abandonedLeaseExpiresAt = new Date(Date.now() - 5 * 60_000);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public."fgis_grain_tenant_read_provider_claims" (
          "id", "tenantId", "organizationId", "authorizationId",
          "authorizationVersion", "configurationId", "actorUserId", "actorRole",
          "operationCode", "correlationId", "requestIdempotencyKey",
          "requestReference", "requestSha256", "completionTokenSha256",
          "leaseExpiresAt", "leaseGeneration", "createdAt"
        ) VALUES (
          ${claimId}, ${TENANT_A}, ${ORG_A}, ${authorized.authorizationId},
          ${BigInt(attested.authorizationVersion)}, ${configuration.configurationId},
          ${BUYER_A.id}, ${BUYER_A.role}, ${request.operationCode},
          ${request.correlationId}, ${request.idempotencyKey},
          ${request.requestReference}, ${request.requestSha256},
          ${abandonedCompletionTokenSha256}, ${abandonedLeaseExpiresAt},
          0, ${abandonedCreatedAt}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        SELECT public.append_fgis_grain_tenant_read_audit_internal(
          ${claimId},
          ${TENANT_A},
          ${ORG_A},
          ${authorized.authorizationId},
          ${BigInt(attested.authorizationVersion)},
          ${configuration.configurationId},
          ${BUYER_A.id},
          ${BUYER_A.role},
          ${request.operationCode},
          ${request.correlationId},
          ${`${request.idempotencyKey}.abandoned-claim`},
          ${request.idempotencyKey},
          ${request.requestReference},
          ${request.requestSha256},
          'IN_FLIGHT',
          'PROVIDER_READ_CLAIMED',
          NULL,
          NULL,
          NULL,
          NULL,
          ${claimId}
        )
      `);
    });

    await expect(readRepository.execute(BUYER_A, request)).resolves.toMatchObject({
      replayed: false,
      operationCode: 'GET_LIST_SDIZ',
    });
    expect(transport.calls).toHaveLength(1);

    await expect(executeAsTransport(Prisma.sql`
      SELECT public.finalize_fgis_grain_tenant_read_claim(
        ${claimId},
        ${abandonedCompletionToken},
        'FAILED',
        'PROVIDER_READ_FAILED',
        NULL,
        NULL,
        NULL,
        NULL
      )
    `)).rejects.toThrow(/missing|already finalized/iu);

    const recovered = await prisma.$queryRaw<Array<{
      leaseGeneration: bigint;
      tokenRotated: boolean;
      completed: boolean;
      reasons: string[];
    }>>(Prisma.sql`
      SELECT claim."leaseGeneration",
             claim."completionTokenSha256" <> ${abandonedCompletionTokenSha256}
               AS "tokenRotated",
             claim."completedAuditId" IS NOT NULL AS "completed",
             array_agg(audit."reasonCode" ORDER BY audit."chainSequence")
               AS "reasons"
      FROM public."fgis_grain_tenant_read_provider_claims" AS claim
      JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."providerClaimId" = claim."id"
      WHERE claim."id" = ${claimId}
      GROUP BY claim."id"
    `);
    expect(recovered).toEqual([{
      leaseGeneration: 1n,
      tokenRotated: true,
      completed: true,
      reasons: [
        'PROVIDER_READ_CLAIMED',
        'PROVIDER_READ_CLAIM_RECOVERED',
        'PROVIDER_READ_SUCCEEDED',
      ],
    }]);
  });

  it('reconciles an abandoned claim after authority drift without calling the provider', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-abandoned-reconciliation/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent evidence admits the claim before governed reconciliation.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'abandoned-reconciliation',
    );
    const claimId = `${RUN_ID}.abandoned-reconciliation.claim`;
    const abandonedCreatedAt = new Date(Date.now() - 10 * 60_000);
    const abandonedLeaseExpiresAt = new Date(Date.now() - 5 * 60_000);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public."fgis_grain_tenant_read_provider_claims" (
          "id", "tenantId", "organizationId", "authorizationId",
          "authorizationVersion", "configurationId", "actorUserId", "actorRole",
          "operationCode", "correlationId", "requestIdempotencyKey",
          "requestReference", "requestSha256", "completionTokenSha256",
          "leaseExpiresAt", "leaseGeneration", "createdAt"
        ) VALUES (
          ${claimId}, ${TENANT_A}, ${ORG_A}, ${authorized.authorizationId},
          ${BigInt(attested.authorizationVersion)}, ${configuration.configurationId},
          ${BUYER_A.id}, ${BUYER_A.role}, ${request.operationCode},
          ${request.correlationId}, ${request.idempotencyKey},
          ${request.requestReference}, ${request.requestSha256},
          ${'d'.repeat(64)}, ${abandonedLeaseExpiresAt}, 0, ${abandonedCreatedAt}
        )
      `);
      await tx.$executeRaw(Prisma.sql`
        SELECT public.append_fgis_grain_tenant_read_audit_internal(
          ${claimId},
          ${TENANT_A},
          ${ORG_A},
          ${authorized.authorizationId},
          ${BigInt(attested.authorizationVersion)},
          ${configuration.configurationId},
          ${BUYER_A.id},
          ${BUYER_A.role},
          ${request.operationCode},
          ${request.correlationId},
          ${`${request.idempotencyKey}.abandoned-claim`},
          ${request.idempotencyKey},
          ${request.requestReference},
          ${request.requestSha256},
          'IN_FLIGHT',
          'PROVIDER_READ_CLAIMED',
          NULL,
          NULL,
          NULL,
          NULL,
          ${claimId}
        )
      `);
    });

    const reauthorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    expect(reauthorized.authorizationVersion).not.toBe(attested.authorizationVersion);

    await executeAsRuntime(SECURITY_A, Prisma.sql`
      SELECT public.reconcile_abandoned_fgis_grain_tenant_read_claim(
        ${claimId}
      )
    `);
    expect(transport.calls).toHaveLength(0);

    const reconciled = await prisma.$queryRaw<Array<{
      completed: boolean;
      decision: string;
      reasonCode: string;
      actorUserId: string;
      actorRole: string;
      authorizationVersion: bigint;
    }>>(Prisma.sql`
      SELECT claim."completedAuditId" IS NOT NULL AS "completed",
             audit."decision",
             audit."reasonCode",
             audit."actorUserId",
             audit."actorRole",
             audit."authorizationVersion"
      FROM public."fgis_grain_tenant_read_provider_claims" AS claim
      JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."id" = claim."completedAuditId"
      WHERE claim."id" = ${claimId}
    `);
    expect(reconciled).toEqual([{
      completed: true,
      decision: 'FAILED',
      reasonCode: 'PROVIDER_READ_CLAIM_ABANDONED',
      actorUserId: SECURITY_A.id,
      actorRole: 'ADMIN',
      authorizationVersion: BigInt(attested.authorizationVersion),
    }]);
  });

  it('separates runtime claim minting from dedicated transport finalization, refreshes the transport lease, and serializes terminal outcomes', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-terminal-race/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent evidence admits the exact terminal race regression.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'terminal-race',
    );
    const claimId = `${RUN_ID}.terminal-race.claim`;
    const completionToken = `${RUN_ID}.terminal-race.opaque-completion-capability`;
    const completionTokenSha256 = createHash('sha256')
      .update(completionToken)
      .digest('hex');

    await executeAsRuntime(BUYER_A, Prisma.sql`
      SELECT public.append_fgis_grain_tenant_read_audit(
        ${claimId},
        ${authorized.authorizationId},
        ${BigInt(attested.authorizationVersion)},
        ${configuration.configurationId},
        ${request.operationCode},
        ${request.correlationId},
        ${`${request.idempotencyKey}.claim`},
        ${request.idempotencyKey},
        ${request.requestReference},
        ${request.requestSha256},
        'IN_FLIGHT',
        'PROVIDER_READ_CLAIMED',
        NULL,
        NULL,
        NULL,
        NULL,
        ${completionTokenSha256}
      )
    `);

    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      SELECT public.finalize_fgis_grain_tenant_read_claim(
        ${claimId},
        ${completionToken},
        'SUCCEEDED',
        'PROVIDER_READ_SUCCEEDED',
        ${`${RUN_ID}.runtime-forgery.provider`},
        ${`provider-response://runtime-forgery/${RUN_ID}`},
        ${'b'.repeat(64)},
        ${new Date()}
      )
    `)).rejects.toThrow(/permission denied/iu);

    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      SELECT public.start_fgis_grain_tenant_read_claim(
        ${claimId},
        ${completionToken}
      )
    `)).rejects.toThrow(/permission denied/iu);

    const beforeStart = await prisma.$queryRaw<Array<{
      leaseExpiresAt: Date;
    }>>(Prisma.sql`
      SELECT "leaseExpiresAt"
      FROM public."fgis_grain_tenant_read_provider_claims"
      WHERE "id" = ${claimId}
    `);
    await startAsTransport({ id: claimId, completionToken });
    const afterStart = await prisma.$queryRaw<Array<{
      leaseExpiresAt: Date;
      remainingLeaseSeconds: number;
      started: boolean;
    }>>(Prisma.sql`
      SELECT "leaseExpiresAt",
             extract(epoch FROM ("leaseExpiresAt" - "transportStartedAt"))::double precision
               AS "remainingLeaseSeconds",
             "transportStartedAt" IS NOT NULL AS "started"
      FROM public."fgis_grain_tenant_read_provider_claims"
      WHERE "id" = ${claimId}
    `);
    expect(afterStart[0]).toMatchObject({
      started: true,
      remainingLeaseSeconds: expect.any(Number),
    });
    expect(afterStart[0]!.leaseExpiresAt.getTime())
      .toBeGreaterThan(beforeStart[0]!.leaseExpiresAt.getTime());
    expect(afterStart[0]!.remainingLeaseSeconds).toBeGreaterThanOrEqual(119);
    expect(afterStart[0]!.remainingLeaseSeconds).toBeLessThanOrEqual(120);

    await expect(executeAsTransport(Prisma.sql`
      SELECT public.finalize_fgis_grain_tenant_read_claim(
        ${claimId},
        ${completionToken},
        'SUCCEEDED',
        'PROVIDER_READ_SUCCEEDED',
        ${`${RUN_ID}.unsafe-result.provider`},
        ${'<Response><Token>inline-secret</Token></Response>'},
        ${'b'.repeat(64)},
        ${new Date()}
      )
    `)).rejects.toThrow(/reference-safe|outcome/iu);

    const success = executeAsTransport(Prisma.sql`
      SELECT public.finalize_fgis_grain_tenant_read_claim(
        ${claimId},
        ${completionToken},
        'SUCCEEDED',
        'PROVIDER_READ_SUCCEEDED',
        ${`${RUN_ID}.terminal-race.provider`},
        ${`provider-response://terminal-race/${RUN_ID}`},
        ${'b'.repeat(64)},
        ${new Date()}
      )
    `);
    const failed = executeAsTransport(Prisma.sql`
      SELECT public.finalize_fgis_grain_tenant_read_claim(
        ${claimId},
        ${completionToken},
        'FAILED',
        'PROVIDER_READ_FAILED',
        NULL,
        NULL,
        NULL,
        NULL
      )
    `);
    const settled = await Promise.allSettled([success, failed]);
    expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((item) => item.status === 'rejected')).toHaveLength(1);

    const terminal = await prisma.$queryRaw<Array<{ decision: string }>>(Prisma.sql`
      SELECT "decision"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "providerClaimId" = ${claimId}
        AND "decision" IN ('SUCCEEDED', 'FAILED')
    `);
    expect(terminal).toHaveLength(1);

    const delayedRequest = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'post-lock-expiry',
    );
    const delayedClaimId = `${RUN_ID}.post-lock-expiry.claim`;
    const delayedToken = `${RUN_ID}.post-lock-expiry.opaque-completion-capability`;
    const delayedTokenSha256 = createHash('sha256')
      .update(delayedToken)
      .digest('hex');
    await executeAsRuntime(BUYER_A, Prisma.sql`
      SELECT public.append_fgis_grain_tenant_read_audit(
        ${delayedClaimId},
        ${authorized.authorizationId},
        ${BigInt(attested.authorizationVersion)},
        ${configuration.configurationId},
        ${delayedRequest.operationCode},
        ${delayedRequest.correlationId},
        ${`${delayedRequest.idempotencyKey}.claim`},
        ${delayedRequest.idempotencyKey},
        ${delayedRequest.requestReference},
        ${delayedRequest.requestSha256},
        'IN_FLIGHT',
        'PROVIDER_READ_CLAIMED',
        NULL,
        NULL,
        NULL,
        NULL,
        ${delayedTokenSha256}
      )
    `);
    await startAsTransport({
      id: delayedClaimId,
      completionToken: delayedToken,
    });

    let markLeaseShortened!: () => void;
    let releaseLeaseLock!: () => void;
    const leaseShortened = new Promise<void>((resolve) => {
      markLeaseShortened = resolve;
    });
    const holdLeaseLock = new Promise<void>((resolve) => {
      releaseLeaseLock = resolve;
    });
    const lockHolder = prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SET LOCAL session_replication_role = replica',
      );
      await tx.$executeRaw(Prisma.sql`
        UPDATE public."fgis_grain_tenant_read_provider_claims"
        SET "leaseExpiresAt" = clock_timestamp() + interval '500 milliseconds'
        WHERE "id" = ${delayedClaimId}
      `);
      markLeaseShortened();
      await holdLeaseLock;
    });
    await leaseShortened;

    let markFinalizerDispatched!: () => void;
    const finalizerDispatched = new Promise<void>((resolve) => {
      markFinalizerDispatched = resolve;
    });
    const delayedFinalization = transportPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SET LOCAL ROLE fgis_grain_read_transport',
      );
      markFinalizerDispatched();
      return tx.$queryRaw(Prisma.sql`
        SELECT public.finalize_fgis_grain_tenant_read_claim(
          ${delayedClaimId},
          ${delayedToken},
          'SUCCEEDED',
          'PROVIDER_READ_SUCCEEDED',
          ${`${RUN_ID}.post-lock-expiry.provider`},
          ${`provider-response://post-lock-expiry/${RUN_ID}`},
          ${'b'.repeat(64)},
          ${new Date()}
        )
      `);
    }).then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    );
    await finalizerDispatched;
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    releaseLeaseLock();
    await lockHolder;

    const delayedOutcome = await delayedFinalization;
    expect(delayedOutcome.status).toBe('rejected');
    if (delayedOutcome.status === 'rejected') {
      expect(String(delayedOutcome.error))
        .toMatch(/claim is missing or already finalized/iu);
    }
    const expiredClaim = await prisma.$queryRaw<Array<{
      completed: boolean;
    }>>(Prisma.sql`
      SELECT "completedAuditId" IS NOT NULL AS "completed"
      FROM public."fgis_grain_tenant_read_provider_claims"
      WHERE "id" = ${delayedClaimId}
    `);
    expect(expiredClaim).toEqual([{ completed: false }]);
  });

  it('records the claimed provider outcome after concurrent reauthorization, session revocation, and role drift', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-concurrent-reauthorization/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent read evidence admits the exact claimed provider operation.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'concurrent-reauthorization',
    );
    const barrier = transport.blockNext();
    const execution = readRepository.execute(BUYER_A, request);
    await barrier.started;

    const claims = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM public."fgis_grain_tenant_read_provider_claims"
      WHERE "requestIdempotencyKey" = ${request.idempotencyKey}
    `);
    expect(claims).toHaveLength(1);
    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      SELECT public.finalize_fgis_grain_tenant_read_claim(
        ${claims[0]?.id},
        ${'forged-completion-capability-value-without-provider-secret'},
        'SUCCEEDED',
        'FORGED_PROVIDER_READ_SUCCEEDED',
        ${`${RUN_ID}.forged-provider-request`},
        ${`provider-response://forged/${request.correlationId}`},
        ${'c'.repeat(64)},
        clock_timestamp()
      )
    `)).rejects.toThrow(/permission denied/iu);

    let reauthorized;
    try {
      reauthorized = await authorizeRead(
        configuration.configurationId,
        configuration.version,
      );
      await prisma.$executeRaw(Prisma.sql`
        UPDATE auth.sessions
        SET status = 'REVOKED',
            revoked_at = clock_timestamp(),
            revocation_reason = 'PC-CROP-10C claim finalization test'
        WHERE id = ${BUYER_A.sessionId}
      `);
      await prisma.$executeRaw(Prisma.sql`
        UPDATE public."user_orgs"
        SET "role" = 'FARMER'
        WHERE "id" = ${BUYER_A.membershipId}
      `);
    } finally {
      barrier.release();
    }
    expect(reauthorized.authorizationVersion).not.toBe(attested.authorizationVersion);
    await expect(execution).resolves.toMatchObject({
      authorizationId: authorized.authorizationId,
      authorizationVersion: attested.authorizationVersion,
      replayed: false,
    });

    const terminal = await prisma.$queryRaw<Array<{
      authorizationVersion: bigint;
      actorRole: string;
      providerClaimId: string | null;
      decision: string;
    }>>(Prisma.sql`
      SELECT "authorizationVersion", "actorRole", "providerClaimId", "decision"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "tenantId" = ${TENANT_A}
        AND "organizationId" = ${ORG_A}
        AND "requestIdempotencyKey" = ${request.idempotencyKey}
        AND "decision" IN ('SUCCEEDED', 'FAILED')
    `);
    expect(terminal).toEqual([{
      authorizationVersion: BigInt(attested.authorizationVersion),
      actorRole: 'BUYER',
      providerClaimId: claims[0]?.id,
      decision: 'SUCCEEDED',
    }]);
  });

  it('does not replay a prior success after reauthorization changes the authority version', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const firstAttestation = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-version-1/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'First independent provider read evidence is bound to authorization version one.',
    });
    const request = readRequest(
      authorized.authorizationId,
      firstAttestation.authorizationVersion,
      'authorization-version',
    );
    await readRepository.execute(BUYER_A, request);

    const reauthorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const secondAttestation = await readRepository.attest(LEGAL_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: reauthorized.authorizationId,
      authorizationVersion: reauthorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-version-2/${RUN_ID}`,
      validUntil: new Date(Date.now() + 5 * 60 * 60_000).toISOString(),
      justification: 'Second independent provider read evidence is bound to the reauthorized version.',
    });

    await expect(readRepository.execute(BUYER_A, {
      ...request,
      authorizationVersion: secondAttestation.authorizationVersion,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(transport.calls).toHaveLength(1);
  });

  it('does not replay a prior success while the provider transport is disabled', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const attested = await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-transport/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent provider read evidence is valid only while transport is admitted.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'transport-disabled-replay',
    );
    await readRepository.execute(BUYER_A, request);
    transport.available = false;

    await expect(readRepository.execute(BUYER_A, request))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(transport.calls).toHaveLength(1);
  });

  it('denies direct runtime authorization mutation and forged audit insertion', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );

    await expect(executeAsRuntime(EXEC_A, Prisma.sql`
      UPDATE public."fgis_grain_tenant_read_authorizations"
      SET "status" = 'READ_ONLY_ATTESTED',
          "attestationEvidenceReference" = 'evidence://forged',
          "attestationValidUntil" = clock_timestamp() + interval '1 hour',
          "attestationJustification" = 'forged direct runtime transition',
          "attestedByUserId" = ${EXEC_A.id},
          "version" = "version" + 1
      WHERE "id" = ${authorized.authorizationId}
    `)).rejects.toThrow(/permission denied/iu);

    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      INSERT INTO public."fgis_grain_tenant_read_audits" (
        "id", "tenantId", "organizationId", "authorizationId",
        "authorizationVersion", "configurationId", "actorUserId", "actorRole",
        "operationCode", "correlationId", "idempotencyKey",
        "requestIdempotencyKey", "requestReference", "requestSha256",
        "decision", "reasonCode", "providerRequestId", "responseReference",
        "responseSha256", "receivedAt", "hash", "prevHash"
      ) VALUES (
        ${`${RUN_ID}.forged-audit`}, ${TENANT_A}, ${ORG_A},
        ${authorized.authorizationId}, ${BigInt(authorized.authorizationVersion)},
        ${configuration.configurationId}, ${BUYER_A.id}, ${BUYER_A.role},
        'GET_LIST_SDIZ', ${`${RUN_ID}.forged-correlation`},
        ${`${RUN_ID}.forged-event-key`}, ${`${RUN_ID}.forged-request-key`},
        'object-store://forged', ${'a'.repeat(64)}, 'SUCCEEDED',
        'PROVIDER_READ_SUCCEEDED', 'forged-provider-request',
        'provider-response://forged', ${'b'.repeat(64)}, clock_timestamp(),
        ${'c'.repeat(64)}, NULL
      )
    `)).rejects.toThrow(/permission denied/iu);

    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      UPDATE public."fgis_grain_tenant_read_audit_heads"
      SET "lastHash" = ${'f'.repeat(64)}
      WHERE "tenantId" = ${TENANT_A}
        AND "organizationId" = ${ORG_A}
    `)).rejects.toThrow(/permission denied/iu);

    await expect(executeAsRuntime(BUYER_A, Prisma.sql`
      UPDATE public."fgis_grain_tenant_read_provider_claims"
      SET "completionTokenSha256" = ${'f'.repeat(64)}
      WHERE "tenantId" = ${TENANT_A}
        AND "organizationId" = ${ORG_A}
    `)).rejects.toThrow(/permission denied/iu);
  });

  it('makes authorization and attestation transitions inseparable from database-owned audits', async () => {
    const configuration = await approvedConfiguration();
    const authorizationId = `${RUN_ID}.atomic-command-authorization`;
    const authorizationReference = `authorization://atomic-command/${RUN_ID}`;
    const authorizationAuditKey = `${RUN_ID}.atomic-command.authorization`;
    const authorizationValidUntil = new Date(Date.now() + 4 * 60 * 60_000);
    const authorizationReason =
      'Direct controlled command must commit its immutable audit atomically.';

    await expect(executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT *
      FROM public.write_fgis_grain_tenant_read_authorization(
        ${`${authorizationId}.unsafe-reference`},
        ${configuration.configurationId},
        ${BigInt(configuration.version)},
        ARRAY['GET_LIST_SDIZ']::text[],
        ${`authorization://atomic-command/token=forbidden/${RUN_ID}`},
        ${authorizationValidUntil},
        ${authorizationReason},
        NULL::bigint,
        ${`${RUN_ID}.atomic-command.unsafe-authorization.audit`},
        ${`${RUN_ID}.atomic-command.unsafe-authorization.correlation`},
        ${`${RUN_ID}.atomic-command.unsafe-authorization`},
        ${'f'.repeat(64)}
      )
    `)).rejects.toThrow(/auth_reference|authorizationReference|check constraint/iu);

    await executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT *
      FROM public.write_fgis_grain_tenant_read_authorization(
        ${authorizationId},
        ${configuration.configurationId},
        ${BigInt(configuration.version)},
        ARRAY['GET_LIST_SDIZ']::text[],
        ${authorizationReference},
        ${authorizationValidUntil},
        ${authorizationReason},
        NULL::bigint,
        ${`${RUN_ID}.atomic-command.authorization.audit`},
        ${`${RUN_ID}.atomic-command.authorization.correlation`},
        ${authorizationAuditKey},
        ${'a'.repeat(64)}
      )
    `);

    const afterAuthorization = await prisma.$queryRaw<Array<{
      authorizationReference: string;
      status: string;
      version: bigint;
      auditCount: bigint;
    }>>(Prisma.sql`
      SELECT target_authorization."authorizationReference",
             target_authorization."status",
             target_authorization."version",
             (
               SELECT count(*)::bigint
               FROM public."fgis_grain_tenant_read_audits" AS audit
               WHERE audit."authorizationId" = target_authorization."id"
                 AND audit."decision" = 'AUTHORIZED'
             ) AS "auditCount"
      FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
      WHERE target_authorization."id" = ${authorizationId}
    `);
    expect(afterAuthorization).toEqual([{
      authorizationReference,
      status: 'AUTHORIZED_NOT_ATTESTED',
      version: 0n,
      auditCount: 1n,
    }]);

    await expect(executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT *
      FROM public.write_fgis_grain_tenant_read_authorization(
        ${authorizationId},
        ${configuration.configurationId},
        ${BigInt(configuration.version)},
        ARRAY['GET_LIST_SDIZ']::text[],
        ${`authorization://must-roll-back/${RUN_ID}`},
        ${authorizationValidUntil},
        'The state update must roll back when its audit cannot append.',
        0::bigint,
        ${`${RUN_ID}.atomic-command.authorization.rollback-audit`},
        ${`${RUN_ID}.atomic-command.authorization.rollback-correlation`},
        ${authorizationAuditKey},
        ${'b'.repeat(64)}
      )
    `)).rejects.toThrow();

    const afterRollback = await prisma.$queryRaw<Array<{
      authorizationReference: string;
      version: bigint;
      auditCount: bigint;
    }>>(Prisma.sql`
      SELECT target_authorization."authorizationReference",
             target_authorization."version",
             (
               SELECT count(*)::bigint
               FROM public."fgis_grain_tenant_read_audits" AS audit
               WHERE audit."authorizationId" = target_authorization."id"
             ) AS "auditCount"
      FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
      WHERE target_authorization."id" = ${authorizationId}
    `);
    expect(afterRollback).toEqual([{
      authorizationReference,
      version: 0n,
      auditCount: 1n,
    }]);

    const attestationEvidenceReference = `evidence://atomic-command/${RUN_ID}`;
    const attestationValidUntil = new Date(Date.now() + 2 * 60 * 60_000);
    const attestationJustification =
      'Attestation state and evidence audit are one PostgreSQL command.';
    await expect(executeAsRuntime(SECURITY_A, Prisma.sql`
      SELECT public.attest_fgis_grain_tenant_read_authorization(
        ${authorizationId},
        0::bigint,
        ${`evidence://atomic-command/token=forbidden/${RUN_ID}`},
        ${attestationValidUntil},
        ${attestationJustification},
        ${`${RUN_ID}.atomic-command.unsafe-attestation.audit`},
        ${`${RUN_ID}.atomic-command.unsafe-attestation.correlation`},
        ${`${RUN_ID}.atomic-command.unsafe-attestation`},
        ${'f'.repeat(64)}
      )
    `)).rejects.toThrow(/attestation_reference|attestationEvidenceReference|check constraint/iu);
    const afterUnsafeAttestation = await prisma.$queryRaw<Array<{
      status: string;
      version: bigint;
      auditCount: bigint;
    }>>(Prisma.sql`
      SELECT target_authorization."status",
             target_authorization."version",
             (
               SELECT count(*)::bigint
               FROM public."fgis_grain_tenant_read_audits" AS audit
               WHERE audit."authorizationId" = target_authorization."id"
             ) AS "auditCount"
      FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
      WHERE target_authorization."id" = ${authorizationId}
    `);
    expect(afterUnsafeAttestation).toEqual([{
      status: 'AUTHORIZED_NOT_ATTESTED',
      version: 0n,
      auditCount: 1n,
    }]);

    await executeAsRuntime(SECURITY_A, Prisma.sql`
      SELECT public.attest_fgis_grain_tenant_read_authorization(
        ${authorizationId},
        0::bigint,
        ${attestationEvidenceReference},
        ${attestationValidUntil},
        ${attestationJustification},
        ${`${RUN_ID}.atomic-command.attestation.audit`},
        ${`${RUN_ID}.atomic-command.attestation.correlation`},
        ${`${RUN_ID}.atomic-command.attestation`},
        ${'c'.repeat(64)}
      )
    `);

    const completed = await prisma.$queryRaw<Array<{
      status: string;
      version: bigint;
      decisions: string[];
    }>>(Prisma.sql`
      SELECT target_authorization."status",
             target_authorization."version",
             array_agg(audit."decision" ORDER BY audit."chainSequence") AS "decisions"
      FROM public."fgis_grain_tenant_read_authorizations" AS target_authorization
      JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."authorizationId" = target_authorization."id"
      WHERE target_authorization."id" = ${authorizationId}
      GROUP BY target_authorization."status", target_authorization."version"
    `);
    expect(completed).toEqual([{
      status: 'READ_ONLY_ATTESTED',
      version: 1n,
      decisions: ['AUTHORIZED', 'ATTESTED'],
    }]);

    const payloadHashes = await prisma.$queryRaw<Array<{
      decision: string;
      databaseOwned: boolean;
      callerOwned: boolean;
    }>>(Prisma.sql`
      SELECT audit."decision",
             audit."requestSha256" = encode(public.digest(convert_to(
               CASE audit."decision"
                 WHEN 'AUTHORIZED' THEN jsonb_build_object(
                   'schemaVersion', 'fgis-grain-tenant-read-authorization-command.v1',
                   'authorizationId', target_authorization."id",
                   'configurationId', target_authorization."configurationId",
                   'configurationVersion', target_authorization."configurationVersion"::text,
                   'allowedOperations', to_jsonb(target_authorization."allowedOperations"),
                   'authorizationReference', target_authorization."authorizationReference",
                   'validUntil', to_char(
                     target_authorization."validUntil" AT TIME ZONE 'UTC',
                     'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                   ),
                   'reason', target_authorization."reason",
                   'expectedVersion', NULL::text
                 )
                 ELSE jsonb_build_object(
                   'schemaVersion', 'fgis-grain-tenant-read-attestation-command.v1',
                   'authorizationId', target_authorization."id",
                   'expectedVersion', '0',
                   'configurationId', target_authorization."configurationId",
                   'configurationVersion', target_authorization."configurationVersion"::text,
                   'evidenceReference', target_authorization."attestationEvidenceReference",
                   'validUntil', to_char(
                     target_authorization."attestationValidUntil" AT TIME ZONE 'UTC',
                     'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                   ),
                   'justification', target_authorization."attestationJustification"
                 )
               END::text,
               'UTF8'
             ), 'sha256'), 'hex') AS "databaseOwned",
             audit."requestSha256" IN (${'a'.repeat(64)}, ${'c'.repeat(64)})
               AS "callerOwned"
      FROM public."fgis_grain_tenant_read_audits" AS audit
      JOIN public."fgis_grain_tenant_read_authorizations" AS target_authorization
        ON target_authorization."id" = audit."authorizationId"
      WHERE audit."authorizationId" = ${authorizationId}
        AND audit."decision" IN ('AUTHORIZED', 'ATTESTED')
      ORDER BY audit."chainSequence"
    `);
    expect(payloadHashes).toEqual([
      { decision: 'AUTHORIZED', databaseOwned: true, callerOwned: false },
      { decision: 'ATTESTED', databaseOwned: true, callerOwned: false },
    ]);
  });

  it('denies cross-tenant and guest reads under the server-derived authority boundary', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    await expect(readRepository.getView(BUYER_B, authorized.authorizationId))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(readRepository.getView(GUEST_A, authorized.authorizationId))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(await runtimeVisibleAuthorizationCount(BUYER_A, authorized.authorizationId)).toBe(1n);
    expect(await runtimeVisibleAuthorizationCount(BUYER_A_OUTSIDER, authorized.authorizationId)).toBe(0n);
    expect(await runtimeVisibleAuthorizationCount(BUYER_B, authorized.authorizationId)).toBe(0n);
    expect(transport.calls).toHaveLength(0);
  });

  it('keeps immutable audit hash chains tenant and organization scoped', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    const firstTenantAudit = await prisma.$queryRaw<Array<{
      chainSequence: bigint;
      hash: string;
    }>>(Prisma.sql`
      SELECT "chainSequence", "hash"
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "tenantId" = ${TENANT_A}
        AND "organizationId" = ${ORG_A}
      ORDER BY "chainSequence" DESC
      LIMIT 1
    `);
    expect(firstTenantAudit[0]?.chainSequence).toBe(1n);
    expect(firstTenantAudit[0]?.hash).toMatch(/^[a-f0-9]{64}$/u);

    const foreignAuthorizationId = `${RUN_ID}.foreign-chain-authorization`;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."fgis_grain_tenant_read_authorizations" (
        "id", "tenantId", "organizationId", "configurationId",
        "configurationVersion", "allowedOperations", "authorizationReference",
        "status", "validUntil", "reason", "version",
        "createdByUserId", "updatedByUserId"
      ) VALUES (
        ${foreignAuthorizationId}, ${TENANT_B}, ${ORG_B},
        ${configuration.configurationId}, ${BigInt(configuration.version)},
        ARRAY['DICTIONARIES']::text[],
        ${`authorization://foreign-chain/${RUN_ID}`},
        'AUTHORIZED_NOT_ATTESTED', ${new Date(Date.now() + 60 * 60_000)},
        'Foreign tenant fixture proves that audit heads never cross RLS scopes.',
        0, ${EXEC_B.id}, ${EXEC_B.id}
      )
    `);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."fgis_grain_tenant_read_audits" (
        "id", "tenantId", "organizationId", "chainSequence", "authorizationId",
        "authorizationVersion", "configurationId", "actorUserId", "actorRole",
        "operationCode", "correlationId", "idempotencyKey",
        "requestIdempotencyKey", "requestReference", "requestSha256",
        "decision", "reasonCode", "hash", "prevHash", "createdAt"
      ) VALUES (
        ${`${RUN_ID}.foreign-chain-audit`}, ${TENANT_B}, ${ORG_B}, 1,
        ${foreignAuthorizationId}, 0, ${configuration.configurationId},
        ${EXEC_B.id}, ${EXEC_B.role}, 'AUTHORIZE',
        ${`${RUN_ID}.foreign-chain-correlation`},
        ${`${RUN_ID}.foreign-chain-event`},
        ${`${RUN_ID}.foreign-chain-request`},
        ${`authorization://foreign-chain/${RUN_ID}`}, ${'c'.repeat(64)},
        'AUTHORIZED', 'TENANT_READ_AUTHORIZATION_RECORDED',
        ${'d'.repeat(64)}, NULL, clock_timestamp() + interval '1 second'
      )
    `);

    const reauthorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    expect(reauthorized.authorizationId).toBe(authorized.authorizationId);
    const latestTenantAudit = await prisma.$queryRaw<Array<{
      chainSequence: bigint;
      hash: string;
      prevHash: string | null;
    }>>(
      Prisma.sql`
        SELECT "chainSequence", "hash", "prevHash"
        FROM public."fgis_grain_tenant_read_audits"
        WHERE "tenantId" = ${TENANT_A}
          AND "organizationId" = ${ORG_A}
        ORDER BY "chainSequence" DESC
        LIMIT 1
      `,
    );
    expect(latestTenantAudit[0]?.chainSequence).toBe(2n);
    expect(latestTenantAudit[0]?.prevHash).toBe(firstTenantAudit[0]?.hash);
    const head = await prisma.$queryRaw<Array<{
      lastAuditId: string;
      lastHash: string;
      lastSequence: bigint;
    }>>(Prisma.sql`
      SELECT "lastAuditId", "lastHash", "lastSequence"
      FROM public."fgis_grain_tenant_read_audit_heads"
      WHERE "tenantId" = ${TENANT_A}
        AND "organizationId" = ${ORG_A}
    `);
    expect(head).toEqual([{
      lastAuditId: expect.any(String),
      lastHash: latestTenantAudit[0]?.hash,
      lastSequence: 2n,
    }]);
  });

  it('computes every immutable audit hash inside PostgreSQL', async () => {
    const configuration = await approvedConfiguration();
    await authorizeRead(configuration.configurationId, configuration.version);

    const signatures = await prisma.$queryRaw<Array<{
      databaseOwned: string | null;
      callerHash: string | null;
    }>>(Prisma.sql`
      SELECT
        to_regprocedure(
          'public.append_fgis_grain_tenant_read_audit(text,text,bigint,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,text)'
        )::text AS "databaseOwned",
        to_regprocedure(
          'public.append_fgis_grain_tenant_read_audit(text,text,bigint,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,text,text,text)'
        )::text AS "callerHash"
    `);
    expect(signatures[0]?.databaseOwned).toContain(
      'append_fgis_grain_tenant_read_audit',
    );
    expect(signatures[0]?.callerHash).toBeNull();

    const rows = await prisma.$queryRaw<Array<{
      hash: string;
      expectedHash: string;
    }>>(Prisma.sql`
      SELECT
        audit."hash",
        encode(public.digest(convert_to(jsonb_build_object(
          'id', audit."id",
          'tenantId', audit."tenantId",
          'organizationId', audit."organizationId",
          'chainSequence', audit."chainSequence"::text,
          'authorizationId', audit."authorizationId",
          'authorizationVersion', audit."authorizationVersion"::text,
          'configurationId', audit."configurationId",
          'actorUserId', audit."actorUserId",
          'actorRole', audit."actorRole",
          'operationCode', audit."operationCode",
          'correlationId', audit."correlationId",
          'idempotencyKey', audit."idempotencyKey",
          'requestIdempotencyKey', audit."requestIdempotencyKey",
          'requestReference', audit."requestReference",
          'requestSha256', audit."requestSha256",
          'decision', audit."decision",
          'reasonCode', audit."reasonCode",
          'providerRequestId', audit."providerRequestId",
          'responseReference', audit."responseReference",
          'responseSha256', audit."responseSha256",
          'receivedAt', CASE
            WHEN audit."receivedAt" IS NULL THEN NULL
          ELSE to_char(
              audit."receivedAt" AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
          END,
          'providerClaimId', audit."providerClaimId",
          'prevHash', audit."prevHash",
          'createdAt', to_char(
            audit."createdAt" AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        )::text, 'UTF8'), 'sha256'), 'hex') AS "expectedHash"
      FROM public."fgis_grain_tenant_read_audits" AS audit
      WHERE audit."tenantId" = ${TENANT_A}
        AND audit."organizationId" = ${ORG_A}
    `);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.hash).toBe(row.expectedHash);
  });

  it('rejects mutation operations before PostgreSQL or transport execution', async () => {
    await expect(readRepository.execute(BUYER_A, {
      ...readRequest('authorization-001', '0', 'mutation'),
      operationCode: 'CREATE_SDIZ' as never,
    })).rejects.toMatchObject({ code: 'MUTATION_OPERATION_FORBIDDEN' });
    expect(transport.calls).toHaveLength(0);
    const count = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."fgis_grain_tenant_read_audits"
    `);
    expect(count[0]?.count).toBe(0n);
  });

  it('keeps audit facts immutable and free of inline secret material', async () => {
    const configuration = await approvedConfiguration();
    const authorized = await authorizeRead(
      configuration.configurationId,
      configuration.version,
    );
    await readRepository.attest(SECURITY_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_ATTESTATION_SCHEMA_VERSION,
      authorizationId: authorized.authorizationId,
      authorizationVersion: authorized.authorizationVersion,
      evidenceReference: `evidence://fgis-grain/read-e2e/${RUN_ID}`,
      validUntil: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      justification: 'Independent provider read E2E returned a referenced response without writes.',
    });
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT *
      FROM public."fgis_grain_tenant_read_audits"
      WHERE "authorizationId" = ${authorized.authorizationId}
      ORDER BY "chainSequence"
    `);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const persisted = JSON.stringify(
      rows,
      (_key, value) => typeof value === 'bigint' ? value.toString() : value,
    );
    expect(persisted).not.toMatch(
      /BEGIN PRIVATE KEY|certificateBytes|credentialBytes|password=|token=|<soap:|<Signature/iu,
    );
    await expect(prisma.$executeRaw(Prisma.sql`
      UPDATE public."fgis_grain_tenant_read_audits"
      SET "reasonCode" = 'TAMPERED'
      WHERE "authorizationId" = ${authorized.authorizationId}
    `)).rejects.toThrow(/immutable/iu);
    await expect(prisma.$executeRaw(Prisma.sql`
      DELETE FROM public."fgis_grain_tenant_read_audits"
      WHERE "authorizationId" = ${authorized.authorizationId}
    `)).rejects.toThrow(/immutable/iu);
  });
});
