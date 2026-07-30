import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  readonly available = true;
  readonly calls: FgisGrainTenantReadTransportRequest[] = [];

  async execute(
    request: FgisGrainTenantReadTransportRequest,
  ): Promise<FgisGrainTenantReadTransportResult> {
    this.calls.push(request);
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
  }
}

async function resetAuthority(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE public."fgis_grain_tenant_read_audits", public."fgis_grain_tenant_read_authorizations", public."fgis_grain_provider_attestations", public."fgis_grain_provider_configurations" RESTART IDENTITY CASCADE',
  );
  transport.calls.length = 0;
}

async function approvedConfiguration() {
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
    const transactions = new RlsTransactionService(prisma);
    providerRepository = new FgisGrainProviderAttestationRepository(transactions);
    transport = new FakeReadTransport();
    readRepository = new FgisGrainTenantReadRepository(transactions, transport);
  });

  beforeEach(resetAuthority);

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
      ORDER BY "createdAt", "id"
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
