import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

const describePostgres = process.env.PC_CROP_08E_POSTGRESQL === '1'
  ? describe
  : describe.skip;
const RUN_ID = `pc-crop-08e.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN_ID}.tenant-a`;
const TENANT_B = `${RUN_ID}.tenant-b`;
const ORG_A = `${RUN_ID}.org-a`;
const ORG_B = `${RUN_ID}.org-b`;

let prisma: PrismaService;
let repository: FgisGrainProviderAttestationRepository;

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
const EXEC_B = actor(TENANT_B, ORG_B, `${RUN_ID}.exec-b`, Role.EXECUTIVE);
const NO_MFA_SECURITY = actor(
  TENANT_A,
  ORG_A,
  `${RUN_ID}.security-no-mfa`,
  Role.ADMIN,
  false,
);

function draft(
  environment: 'PRE_PRODUCTION' | 'PRODUCTION' = 'PRE_PRODUCTION',
  suffix = 'v1',
) {
  const segment = environment.toLowerCase();
  return {
    schemaVersion: FGIS_GRAIN_PROVIDER_CONFIG_SCHEMA_VERSION,
    adapterCode: 'FGIS_ZERNO' as const,
    apiVersion: '1.0.23' as const,
    mappingVersion: 'fgis-zerno-1.0.23-catalog.v1' as const,
    signingPolicyVersion: 'fgis-zerno-1.0.23-signing-policy.v1' as const,
    environment,
    endpointReference: `endpoint://fgis-zerno/${segment}/${suffix}`,
    tlsPolicyReference: `tls://fgis-zerno/${segment}/${suffix}`,
    credentialReference: `credential://vault/fgis-zerno/${segment}/${suffix}`,
    signingKeyReference: `signing-key://vault/fgis-zerno/${segment}/${suffix}`,
    payloadStoreReference: `object-store://fgis-zerno/${segment}/${suffix}`,
  };
}

function upsertCommand(
  key: string,
  overrides: Partial<UpsertProviderConfigurationCommand> = {},
): UpsertProviderConfigurationCommand {
  return {
    idempotencyKey: `${RUN_ID}.${key}`,
    correlationId: `${RUN_ID}.${key}.correlation`,
    reason: 'Configuration authority is changed after governed server-side review.',
    expectedVersion: '0',
    draft: draft(),
    ...overrides,
  };
}

function metadata(
  key: string,
  expectedVersion: string,
): ProviderCommandMetadata {
  return {
    idempotencyKey: `${RUN_ID}.${key}`,
    correlationId: `${RUN_ID}.${key}.correlation`,
    reason: 'Provider state transition approved through governed server-side workflow.',
    expectedVersion,
  };
}

function attestationCommand(
  configurationId: string,
  gate: 'OWNER' | 'SECURITY' | 'LEGAL' | 'OPERATIONS',
  version: string,
  suffix: string,
): RecordProviderAttestationCommand {
  return {
    configurationId,
    idempotencyKey: `${RUN_ID}.${configurationId}.attest-${gate.toLowerCase()}-${suffix}`,
    correlationId: `${RUN_ID}.${configurationId}.attest-${gate.toLowerCase()}-${suffix}.correlation`,
    reason: `${gate} attestation is recorded after independent MFA-backed review.`,
    expectedVersion: version,
    attestation: {
      schemaVersion: FGIS_GRAIN_PROVIDER_ATTESTATION_SCHEMA_VERSION,
      gate,
      decision: 'APPROVED',
      justification: `${gate} reviewer confirmed governed evidence and test-only boundaries.`,
      evidenceReference: `evidence://fgis-zerno/${gate.toLowerCase()}/${suffix}`,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
      configurationVersion: version,
    },
  };
}

async function seedAuthority(): Promise<void> {
  const now = new Date();
  const innA = `77${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
  const innB = `78${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."organizations" (
      "id", "inn", "name", "tenantId", "updatedAt"
    ) VALUES
      (${ORG_A}, ${innA}, ${`${RUN_ID} Org A`}, ${TENANT_A}, ${now}),
      (${ORG_B}, ${innB}, ${`${RUN_ID} Org B`}, ${TENANT_B}, ${now})
    ON CONFLICT ("id") DO NOTHING
  `);
  for (const user of [EXEC_A, SECURITY_A, LEGAL_A, OPS_A, EXEC_B, NO_MFA_SECURITY]) {
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

async function resetAggregate(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE public."fgis_grain_provider_attestations", public."fgis_grain_provider_configurations" RESTART IDENTITY CASCADE',
  );
}

async function createUnderReview(
  key: string,
  environment: 'PRE_PRODUCTION' | 'PRODUCTION' = 'PRE_PRODUCTION',
) {
  const created = await repository.upsertDraft(
    EXEC_A,
    upsertCommand(`${key}-draft`, { draft: draft(environment, key) }),
  );
  const review = await repository.submitForReview(
    EXEC_A,
    created.configurationId,
    metadata(`${key}-submit`, created.version),
  );
  expect(review).toMatchObject({ state: 'UNDER_REVIEW', version: created.version });
  return review;
}

async function approveAll(configurationId: string, version: string): Promise<void> {
  await repository.recordAttestation(
    EXEC_A,
    attestationCommand(configurationId, 'OWNER', version, 'owner'),
  );
  await repository.recordAttestation(
    SECURITY_A,
    attestationCommand(configurationId, 'SECURITY', version, 'security'),
  );
  await repository.recordAttestation(
    LEGAL_A,
    attestationCommand(configurationId, 'LEGAL', version, 'legal'),
  );
  await repository.recordAttestation(
    OPS_A,
    attestationCommand(configurationId, 'OPERATIONS', version, 'operations'),
  );
}

describePostgres('PC-CROP-08E PostgreSQL provider configuration and attestations', () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await seedAuthority();
    repository = new FgisGrainProviderAttestationRepository(
      new RlsTransactionService(prisma),
    );
  });

  beforeEach(resetAggregate);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists one draft with immutable audit/outbox and deterministic replay', async () => {
    const input = upsertCommand('draft-replay');
    const applied = await repository.upsertDraft(EXEC_A, input);
    const replay = await repository.upsertDraft(EXEC_A, input);
    expect(applied).toMatchObject({ state: 'DRAFT', version: '0', replayed: false });
    expect(replay).toEqual({ ...applied, replayed: true });

    const rows = await prisma.$queryRaw<Array<{
      auditCount: bigint;
      outboxCount: bigint;
      configCount: bigint;
      configPayload: unknown;
      auditPayload: unknown;
      outboxPayload: unknown;
    }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."audit_events" WHERE "id" = ${applied.auditId}) AS "auditCount",
        (SELECT count(*) FROM public."outbox_entries" WHERE "id" = ${applied.outboxId}) AS "outboxCount",
        (SELECT count(*) FROM public."fgis_grain_provider_configurations" WHERE "id" = ${applied.configurationId}) AS "configCount",
        (SELECT jsonb_build_object(
          'endpointReference', "endpointReference",
          'credentialReference', "credentialReference",
          'signingKeyReference', "signingKeyReference"
        ) FROM public."fgis_grain_provider_configurations" WHERE "id" = ${applied.configurationId}) AS "configPayload",
        (SELECT "metadata" FROM public."audit_events" WHERE "id" = ${applied.auditId}) AS "auditPayload",
        (SELECT "payload" FROM public."outbox_entries" WHERE "id" = ${applied.outboxId}) AS "outboxPayload"
    `);
    expect(rows[0]).toMatchObject({ auditCount: 1n, outboxCount: 1n, configCount: 1n });
    const persisted = JSON.stringify(
      rows[0],
      (_key, value) => typeof value === 'bigint' ? value.toString() : value,
    );
    expect(persisted).not.toMatch(
      /BEGIN PRIVATE KEY|certificateBytes|credentialBytes|password=|token=|<soap:|<Signature/iu,
    );
  });

  it('rejects stale If-Match and idempotency payload mismatch', async () => {
    const input = upsertCommand('version-mismatch');
    const created = await repository.upsertDraft(EXEC_A, input);
    await expect(repository.upsertDraft(EXEC_A, {
      ...input,
      draft: draft('PRE_PRODUCTION', 'changed'),
    })).rejects.toBeInstanceOf(ConflictException);
    await expect(repository.upsertDraft(EXEC_A, upsertCommand('stale-update', {
      expectedVersion: '9',
      draft: draft('PRE_PRODUCTION', 'stale'),
    }))).rejects.toBeInstanceOf(PreconditionFailedException);
    expect(created.version).toBe('0');
  });

  it('requires role separation and MFA for four gates before test activation', async () => {
    const review = await createUnderReview('approval-flow');
    await expect(repository.recordAttestation(
      NO_MFA_SECURITY,
      attestationCommand(review.configurationId, 'SECURITY', review.version, 'no-mfa'),
    )).rejects.toBeInstanceOf(ForbiddenException);
    await expect(repository.recordAttestation(
      EXEC_A,
      attestationCommand(review.configurationId, 'SECURITY', review.version, 'wrong-role'),
    )).rejects.toBeInstanceOf(ForbiddenException);

    await approveAll(review.configurationId, review.version);
    const approved = await repository.activateTest(
      EXEC_A,
      review.configurationId,
      metadata('activate-test', review.version),
    );
    expect(approved).toMatchObject({
      state: 'TEST_APPROVED',
      version: review.version,
      operationalStatus: 'NOT_ATTESTED',
    });
    const view = await repository.getView(EXEC_A, review.configurationId);
    expect(view.gates.map((gate) => gate.state)).toEqual([
      'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED',
    ]);
    expect(view.blockers).toEqual([]);
    expect(view.productionActivationAllowed).toBe(false);

    await expect(prisma.$executeRaw(Prisma.sql`
      UPDATE public."fgis_grain_provider_attestations"
      SET "justification" = 'tampered'
      WHERE "configurationId" = ${review.configurationId}
    `)).rejects.toThrow(/immutable/iu);
  });

  it('invalidates approvals only when reference content changes', async () => {
    const review = await createUnderReview('invalidate');
    await repository.recordAttestation(
      EXEC_A,
      attestationCommand(review.configurationId, 'OWNER', review.version, 'owner-stale'),
    );
    const updated = await repository.upsertDraft(EXEC_A, upsertCommand('invalidate-update', {
      expectedVersion: review.version,
      draft: draft('PRE_PRODUCTION', 'v2'),
    }));
    expect(updated.version).toBe('1');
    const view = await repository.getView(EXEC_A, updated.configurationId);
    expect(view.gates.find((gate) => gate.gate === 'OWNER')?.state).toBe('STALE');
    expect(view.blockers).toContain('REVIEW_NOT_SUBMITTED');
  });

  it('supports governed suspend and irreversible revoke without changing content version', async () => {
    const review = await createUnderReview('lifecycle');
    await approveAll(review.configurationId, review.version);
    await repository.activateTest(
      EXEC_A,
      review.configurationId,
      metadata('lifecycle-activate', review.version),
    );
    const suspended = await repository.suspend(
      SECURITY_A,
      review.configurationId,
      metadata('lifecycle-suspend', review.version),
    );
    expect(suspended).toMatchObject({ state: 'SUSPENDED', version: review.version });
    const revoked = await repository.revoke(
      LEGAL_A,
      review.configurationId,
      metadata('lifecycle-revoke', review.version),
    );
    expect(revoked).toMatchObject({ state: 'REVOKED', version: review.version });
    await expect(repository.upsertDraft(EXEC_A, upsertCommand('revoked-edit', {
      expectedVersion: review.version,
      draft: draft('PRE_PRODUCTION', 'after-revoke'),
    }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('never activates PRODUCTION and isolates tenant/organization authority', async () => {
    const production = await createUnderReview('production', 'PRODUCTION');
    await expect(repository.activateTest(
      EXEC_A,
      production.configurationId,
      metadata('production-activate', production.version),
    )).rejects.toMatchObject({ code: 'PRODUCTION_ACTIVATION_FORBIDDEN' });
    await expect(repository.getView(EXEC_B, production.configurationId))
      .rejects.toBeInstanceOf(NotFoundException);

    const tenantB = await repository.upsertDraft(EXEC_B, upsertCommand('tenant-b', {
      draft: draft('PRE_PRODUCTION', 'tenant-b'),
    }));
    expect(tenantB.configurationId).not.toBe(production.configurationId);
  });
});
