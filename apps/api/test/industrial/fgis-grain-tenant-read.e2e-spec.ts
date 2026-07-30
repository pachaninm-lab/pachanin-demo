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
import type { FgisGrainTenantReadTransport } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.transport';

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

class FakeReadTransport implements FgisGrainTenantReadTransport {
  available = true;
  readonly calls: FgisGrainTenantReadTransportRequest[] = [];
  private nextBarrier: {
    readonly started: () => void;
    readonly wait: Promise<void>;
  } | null = null;

  blockNext(): { readonly started: Promise<void>; readonly release: () => void } {
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.nextBarrier = { started: markStarted, wait };
    return { started, release };
  }

  reset(): void {
    this.available = true;
    this.calls.length = 0;
    this.nextBarrier = null;
  }

  async execute(
    request: FgisGrainTenantReadTransportRequest,
  ): Promise<FgisGrainTenantReadTransportResult> {
    const barrier = this.nextBarrier;
    this.nextBarrier = null;
    this.calls.push(request);
    barrier?.started();
    await barrier?.wait;
    return {
      providerRequestId: `${RUN_ID}.provider.${this.calls.length}`,
      responseReference: `provider-response://fgis-grain/${request.correlationId}`,
      responseSha256: 'b'.repeat(64),
      receivedAt: new Date().toISOString(),
    };
  }
}

function providerDraft(suffix: string) {
  return {
    schemaVersion: FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO' as const,
    apiVersion: '1.0.23' as const,
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1' as const,
    signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1' as const,
    environment: 'PRE_PRODUCTION' as const,
    endpointReference: `endpoint://fgis-zerno/pre-production/${suffix}`,
    tlsPolicyReference: `tls://fgis-zerno/pre-production/${suffix}`,
    credentialReference: `credential://vault/fgis-zerno/pre-production/${suffix}`,
    signingKeyReference: `signing-key://vault/fgis-zerno/pre-production/${suffix}`,
    payloadStoreReference: `object-store://fgis-zerno/pre-production/${suffix}`,
  };
}

function providerUpsert(key: string): UpsertProviderConfigurationCommand {
  return {
    idempotencyKey: `${RUN_ID}.${key}`,
    correlationId: `${RUN_ID}.${key}.correlation`,
    reason: 'Configuration authority is changed after governed server-side review.',
    expectedVersion: '0',
    draft: providerDraft(key),
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

async function approvedConfiguration(transportAdmitted = true) {
  const created = await providerRepository.upsertDraft(
    EXEC_A,
    providerUpsert(`config-${Math.random().toString(16).slice(2)}`),
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

describePostgres('PC-CROP-10C PostgreSQL tenant-authorized FGIS Grain read', () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const runtimeDatabaseUrl = process.env.PC_CROP_10C_RUNTIME_DATABASE_URL;
    if (!runtimeDatabaseUrl) throw new Error('PC_CROP_10C_RUNTIME_DATABASE_URL is required');
    runtimePrisma = new PrismaClient({ datasources: { db: { url: runtimeDatabaseUrl } } });
    await runtimePrisma.$connect();
    await seedIdentity();
    const providerTransactions = new RlsTransactionService(prisma);
    const runtimeTransactions = new RlsTransactionService(runtimePrisma as never);
    providerRepository = new FgisGrainProviderAttestationRepository(providerTransactions);
    transport = new FakeReadTransport();
    readRepository = new FgisGrainTenantReadRepository(runtimeTransactions, transport);
  });

  beforeEach(async () => {
    await seedIdentity();
    await resetAuthority();
  });

  afterAll(async () => {
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

  it('enforces database authorization and attestation TTL ceilings', async () => {
    const configuration = await approvedConfiguration();
    const overlongAuthorizationId = `${RUN_ID}.ttl.authorization.overlong`;

    await expect(executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT public.write_fgis_grain_tenant_read_authorization(
        ${overlongAuthorizationId},
        ${configuration.configurationId},
        ${BigInt(configuration.version)},
        ARRAY['DICTIONARIES', 'GET_LIST_SDIZ']::text[],
        ${`authorization://tenant/${ORG_A}/fgis-read/ttl-overlong`},
        ${new Date(Date.now() + 91 * 24 * 60 * 60_000)},
        'Direct database callers cannot exceed the authorization TTL ceiling.',
        NULL::bigint,
        ${`${RUN_ID}.ttl.authorization.audit`},
        ${`${RUN_ID}.ttl.authorization.correlation`},
        ${`${RUN_ID}.ttl.authorization.idempotency`},
        ${'c'.repeat(64)}
      )
    `)).rejects.toThrow(/authorization lifetime/iu);

    const rejectedAuthorization = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM public."fgis_grain_tenant_read_authorizations"
      WHERE "id" = ${overlongAuthorizationId}
    `);
    expect(rejectedAuthorization[0]?.count).toBe(0n);

    const authorized = await readRepository.authorize(EXEC_A, {
      schemaVersion: FGIS_GRAIN_TENANT_READ_SCHEMA_VERSION,
      configurationId: configuration.configurationId,
      configurationVersion: configuration.version,
      allowedOperations: ['DICTIONARIES', 'GET_LIST_SDIZ'],
      authorizationReference: `authorization://tenant/${ORG_A}/fgis-read/ttl-valid`,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60_000).toISOString(),
      reason: 'The bounded authorization is valid while the attestation ceiling remains independent.',
    });

    await expect(executeAsRuntime(SECURITY_A, Prisma.sql`
      SELECT public.attest_fgis_grain_tenant_read_authorization(
        ${authorized.authorizationId},
        ${BigInt(authorized.authorizationVersion)},
        ${`evidence://fgis-grain/read-ttl-overlong/${RUN_ID}`},
        ${new Date(Date.now() + 31 * 24 * 60 * 60_000)},
        'Direct database callers cannot exceed the attestation TTL ceiling.',
        ${`${RUN_ID}.ttl.attestation.audit`},
        ${`${RUN_ID}.ttl.attestation.correlation`},
        ${`${RUN_ID}.ttl.attestation.idempotency`},
        ${'d'.repeat(64)}
      )
    `)).rejects.toThrow(/attestation lifetime/iu);

    const unchanged = await prisma.$queryRaw<Array<{
      status: string;
      attestationAuditCount: bigint;
    }>>(Prisma.sql`
      SELECT authorization."status",
             count(audit."id") FILTER (WHERE audit."decision" = 'ATTESTED')::bigint
               AS "attestationAuditCount"
      FROM public."fgis_grain_tenant_read_authorizations" AS authorization
      LEFT JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."authorizationId" = authorization."id"
      WHERE authorization."id" = ${authorized.authorizationId}
      GROUP BY authorization."status"
    `);
    expect(unchanged).toEqual([{
      status: 'AUTHORIZED_NOT_ATTESTED',
      attestationAuditCount: 0n,
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

  it('reconciles an expired abandoned provider claim without the lost capability', async () => {
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
      justification: 'Independent evidence admits the abandoned-claim recovery regression.',
    });
    const request = readRequest(
      authorized.authorizationId,
      attested.authorizationVersion,
      'abandoned-claim',
    );
    const claimId = `${RUN_ID}.abandoned-claim.claim`;
    const lostCompletionTokenSha256 = createHash('sha256')
      .update(`${RUN_ID}.abandoned-claim.lost-completion-capability`)
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
        ${lostCompletionTokenSha256}
      )
    `);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'ALTER TABLE public."fgis_grain_tenant_read_provider_claims" DISABLE TRIGGER "fgis_grain_tenant_read_claims_guard_update"',
      );
      try {
        await tx.$executeRaw(Prisma.sql`
          UPDATE public."fgis_grain_tenant_read_provider_claims"
          SET "createdAt" = clock_timestamp() - interval '10 minutes',
              "leaseExpiresAt" = clock_timestamp() - interval '5 minutes'
          WHERE "id" = ${claimId}
        `);
      } finally {
        await tx.$executeRawUnsafe(
          'ALTER TABLE public."fgis_grain_tenant_read_provider_claims" ENABLE TRIGGER "fgis_grain_tenant_read_claims_guard_update"',
        );
      }
    });

    await expect(readRepository.execute(BUYER_A, request)).rejects.toMatchObject({
      response: {
        code: 'FGIS_GRAIN_READ_CLAIM_RECONCILED',
        retryable: true,
        retryWithNewIdempotencyKey: true,
      },
    });
    expect(transport.calls).toHaveLength(0);

    const reconciled = await prisma.$queryRaw<Array<{
      completedAuditId: string;
      completedAt: Date;
      decision: string;
      reasonCode: string;
      providerRequestId: string | null;
    }>>(Prisma.sql`
      SELECT claim."completedAuditId", claim."completedAt",
             audit."decision", audit."reasonCode", audit."providerRequestId"
      FROM public."fgis_grain_tenant_read_provider_claims" AS claim
      JOIN public."fgis_grain_tenant_read_audits" AS audit
        ON audit."id" = claim."completedAuditId"
      WHERE claim."id" = ${claimId}
    `);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]).toMatchObject({
      decision: 'FAILED',
      reasonCode: 'PROVIDER_READ_CLAIM_EXPIRED',
      providerRequestId: null,
    });
    expect(reconciled[0]?.completedAt).toBeInstanceOf(Date);

    const recoveredRequest = {
      ...request,
      correlationId: `${request.correlationId}.recovered`,
      idempotencyKey: `${request.idempotencyKey}.recovered`,
    };
    await expect(readRepository.execute(BUYER_A, recoveredRequest)).resolves.toMatchObject({
      replayed: false,
      operationCode: 'GET_LIST_SDIZ',
    });
    expect(transport.calls).toHaveLength(1);
  });
  it('serializes competing direct terminal outcomes for one opaque provider claim', async () => {
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

    const success = executeAsRuntime(BUYER_A, Prisma.sql`
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
    const failed = executeAsRuntime(BUYER_A, Prisma.sql`
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
    `)).rejects.toThrow(/missing|capability/iu);

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

    await executeAsRuntime(EXEC_A, Prisma.sql`
      SELECT *
      FROM public.write_fgis_grain_tenant_read_authorization(
        ${authorizationId},
        ${configuration.configurationId},
        ${BigInt(configuration.version)},
        ARRAY['GET_LIST_SDIZ']::text[],
        ${authorizationReference},
        ${authorizationValidUntil},
        'Direct controlled command must commit its immutable audit atomically.',
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

    await executeAsRuntime(SECURITY_A, Prisma.sql`
      SELECT public.attest_fgis_grain_tenant_read_authorization(
        ${authorizationId},
        0::bigint,
        ${`evidence://atomic-command/${RUN_ID}`},
        ${new Date(Date.now() + 2 * 60 * 60_000)},
        'Attestation state and evidence audit are one PostgreSQL command.',
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
