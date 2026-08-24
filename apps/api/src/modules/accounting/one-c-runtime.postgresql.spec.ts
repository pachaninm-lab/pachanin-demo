import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  OneCCommand,
  ONE_C_COMMANDS,
  ONE_C_PROTOCOL_VERSION,
  OneCSyncState,
  type OneCSelfDiscovery,
} from './one-c-connector.protocol';
import { OneCHeartbeatHealth } from './one-c-heartbeat.contract';
import { OneCHeartbeatRepository } from './one-c-heartbeat.repository';
import {
  OneCFailureEffectState,
  OneCReconciliationAction,
} from './one-c-job-runtime.contract';
import {
  OneCJobMachineOutcome,
  OneCJobReconciliationOutcome,
  OneCJobRuntimeRepository,
} from './one-c-job-runtime.repository';
import { IntegrationFailureClass } from './integration-command.policy';
import {
  OneCBindingReadOutcome,
  OneCBindingRevokeOutcome,
  OneCPairingChallengeOutcome,
  OneCRuntimeRepository,
  OneCRuntimeRepositoryError,
} from './one-c-runtime.repository';
import { WorkTaskRepository } from './work-task.repository';

const describePostgres =
  process.env.PC_CROP_ACCOUNTING_POSTGRESQL === '1' ? describe : describe.skip;

const RUN = `pc-crop-one-c-runtime.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TENANT_A = `${RUN}.tenant-a`;
const TENANT_B = `${RUN}.tenant-b`;
const ORG_A = `${RUN}.org-a`;
const ORG_B = `${RUN}.org-b`;
const TENANT_RUNTIME = `${RUN}.tenant-runtime`;
const ORG_RUNTIME = `${RUN}.org-runtime`;
const INN_A = `7${String(Date.now()).slice(-9)}`;
const INN_B = `8${String(Date.now()).slice(-9)}`;
const KPP_A = '770701001';
const KPP_B = '780701001';
const INN_RUNTIME = `9${String(Date.now()).slice(-9)}`;
const KPP_RUNTIME = '790701001';
const DATABASE_INSTANCE = `${RUN}.opaque-database-instance`;
const ONE_C_GUID = '11111111-2222-3333-4444-555555555555';
const RUNTIME_DATABASE_INSTANCE = `${RUN}.runtime-database-instance`;
const RUNTIME_ONE_C_GUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const CHIEF_A = {
  userId: `${RUN}.chief-a-user`,
  membershipId: `${RUN}.chief-a-membership`,
};
const DIRECTOR_A = {
  userId: `${RUN}.director-a-user`,
  membershipId: `${RUN}.director-a-membership`,
};
const CHIEF_B = {
  userId: `${RUN}.chief-b-user`,
  membershipId: `${RUN}.chief-b-membership`,
};
const CHIEF_RUNTIME = {
  userId: `${RUN}.runtime-chief-user`,
  membershipId: `${RUN}.runtime-chief-membership`,
};

let prisma: PrismaService;
let repository: OneCRuntimeRepository;
let heartbeats: OneCHeartbeatRepository;
let jobs: OneCJobRuntimeRepository;

function actor(
  person: { userId: string; membershipId: string },
  orgId: string,
  tenantId: string,
): RequestUser {
  return {
    id: person.userId,
    email: `${person.userId}@industrial.invalid`,
    role: Role.GUEST,
    orgId,
    tenantId,
    membershipId: person.membershipId,
    sessionId: `${RUN}.session.${person.userId}`,
    mfaVerified: true,
    mfaVerifiedAt: new Date().toISOString(),
  };
}

function discovery(inn: string, kpp: string, name: string): OneCSelfDiscovery {
  return {
    platformVersion: '8.3.27.1234',
    configurationName: 'Бухгалтерия предприятия',
    configurationVersion: '3.0.170.31',
    databaseInstanceId: DATABASE_INSTANCE,
    organizations: [
      {
        guid: ONE_C_GUID,
        inn,
        kpp,
        name,
      },
    ],
    capabilities: ONE_C_COMMANDS,
    connectorVersion: '1.0.0',
    protocolVersion: ONE_C_PROTOCOL_VERSION,
  };
}

function runtimeDiscovery(): OneCSelfDiscovery {
  return {
    ...discovery(INN_RUNTIME, KPP_RUNTIME, 'One C Runtime'),
    databaseInstanceId: RUNTIME_DATABASE_INSTANCE,
    organizations: [{
      guid: RUNTIME_ONE_C_GUID,
      inn: INN_RUNTIME,
      kpp: KPP_RUNTIME,
      name: 'One C Runtime',
    }],
  };
}

async function insertPerson(
  person: { userId: string; membershipId: string },
  orgId: string,
  profile: 'CHIEF_ACCOUNTANT' | 'DIRECTOR',
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."users"
      ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
    VALUES (
      ${person.userId}, ${`${person.userId}@industrial.invalid`}, 'hash',
      ${profile}, 'ACTIVE', now(), now()
    )
  `);
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO public."user_orgs"
      ("id","userId","organizationId","role","status","isDefault","joinedAt","job_profile")
    VALUES (
      ${person.membershipId}, ${person.userId}, ${orgId}, 'GUEST', 'ACTIVE', true,
      now(), ${profile}
    )
  `);
}

describePostgres('durable 1C runtime authority', () => {
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO public."organizations"
        ("id","inn","kpp","name","type","status","kycStatus","tenantId","createdAt","updatedAt")
      VALUES
        (${ORG_A}, ${INN_A}, ${KPP_A}, 'One C A', 'LEGAL', 'VERIFIED', 'VERIFIED', ${TENANT_A}, now(), now()),
        (${ORG_B}, ${INN_B}, ${KPP_B}, 'One C B', 'LEGAL', 'VERIFIED', 'VERIFIED', ${TENANT_B}, now(), now()),
        (${ORG_RUNTIME}, ${INN_RUNTIME}, ${KPP_RUNTIME}, 'One C Runtime', 'LEGAL', 'VERIFIED', 'VERIFIED', ${TENANT_RUNTIME}, now(), now())
    `);
    await insertPerson(CHIEF_A, ORG_A, 'CHIEF_ACCOUNTANT');
    await insertPerson(DIRECTOR_A, ORG_A, 'DIRECTOR');
    await insertPerson(CHIEF_B, ORG_B, 'CHIEF_ACCOUNTANT');
    await insertPerson(CHIEF_RUNTIME, ORG_RUNTIME, 'CHIEF_ACCOUNTANT');

    const transactions = new RlsTransactionService(prisma);
    const tasks = new WorkTaskRepository(transactions);
    repository = new OneCRuntimeRepository(prisma, transactions, tasks);
    heartbeats = new OneCHeartbeatRepository(prisma, transactions, tasks, repository);
    jobs = new OneCJobRuntimeRepository(prisma, transactions, tasks, repository);
  });

  afterAll(async () => {
    // Connector rows are intentionally retired, never deleted, and pin the
    // organization/user evidence they reference. The PostgreSQL acceptance
    // database is rebuilt from migrations for every CI run, so keeping this
    // namespaced evidence is the honest test of the production lifecycle.
    await prisma.$disconnect();
  });

  it('keeps pairing one-time, tenant-safe, credential-rotating and immediately revocable', async () => {
    const chiefA = actor(CHIEF_A, ORG_A, TENANT_A);
    const chiefB = actor(CHIEF_B, ORG_B, TENANT_B);
    const directorA = actor(DIRECTOR_A, ORG_A, TENANT_A);

    const firstChallenge = await repository.createPairingChallenge(chiefA, {
      correlationId: `${RUN}.pairing-1`,
      ttlSeconds: 600,
    });
    expect(firstChallenge.outcome).toBe(OneCPairingChallengeOutcome.ISSUED);
    expect(firstChallenge.challengeId).toBeTruthy();
    expect(firstChallenge.pairingCode).toBeTruthy();

    const storedFirst = await prisma.$queryRaw<Array<{
      lookupHash: string;
      codeHash: string;
      salt: string;
      status: string;
    }>>(Prisma.sql`
      SELECT lookup_hash AS "lookupHash", code_hash AS "codeHash", salt, status
        FROM connector.one_c_pairing_challenges
       WHERE id = ${firstChallenge.challengeId}
    `);
    expect(storedFirst).toHaveLength(1);
    expect(JSON.stringify(storedFirst[0])).not.toContain(firstChallenge.pairingCode as string);
    expect(storedFirst[0].lookupHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedFirst[0].codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedFirst[0].salt).toMatch(/^[a-f0-9]{32}$/);

    // A newly issued challenge retires the previous unused one. The partial
    // unique index is the database-level backstop for this invariant.
    const activeChallenge = await repository.createPairingChallenge(chiefA, {
      correlationId: `${RUN}.pairing-2`,
      ttlSeconds: 600,
    });
    expect(activeChallenge.outcome).toBe(OneCPairingChallengeOutcome.ISSUED);

    const pending = await prisma.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT id, status
        FROM connector.one_c_pairing_challenges
       WHERE tenant_id = ${TENANT_A} AND organization_id = ${ORG_A}
       ORDER BY created_at ASC
    `);
    expect(pending.filter((row) => row.status === 'PENDING')).toHaveLength(1);
    expect(pending.find((row) => row.id === firstChallenge.challengeId)?.status).toBe('REVOKED');

    const firstPair = await repository.consumePairing({
      pairingCode: activeChallenge.pairingCode as string,
      discovery: discovery(INN_A, KPP_A, 'One C A'),
      correlationId: `${RUN}.consume-1`,
    });
    expect(firstPair.organizationId).toBe(ORG_A);
    expect(firstPair.oneCOrganizationGuid).toBe(ONE_C_GUID);
    expect(firstPair.machineBearer.startsWith(`${firstPair.credentialId}.`)).toBe(true);

    const storedCredential = await prisma.$queryRaw<Array<{
      credentialId: string;
      salt: string;
      secretHash: string;
      status: string;
    }>>(Prisma.sql`
      SELECT credential_id AS "credentialId", salt, secret_hash AS "secretHash", status
        FROM connector.one_c_machine_credentials
       WHERE credential_id = ${firstPair.credentialId}
    `);
    expect(storedCredential).toHaveLength(1);
    const firstSecret = firstPair.machineBearer.split('.')[1] ?? '';
    expect(JSON.stringify(storedCredential[0])).not.toContain(firstPair.machineBearer);
    expect(JSON.stringify(storedCredential[0])).not.toContain(firstSecret);
    expect(storedCredential[0].secretHash).toMatch(/^[a-f0-9]{64}$/);

    await expect(
      repository.authenticateMachineBearer(firstPair.machineBearer),
    ).resolves.toMatchObject({
      authorized: true,
      organizationId: ORG_A,
      connectionId: firstPair.bindingId,
      oneCOrganizationGuid: ONE_C_GUID,
    });

    await expect(
      repository.consumePairing({
        pairingCode: activeChallenge.pairingCode as string,
        discovery: discovery(INN_A, KPP_A, 'One C A'),
        correlationId: `${RUN}.consume-replay`,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OneCRuntimeRepositoryError>>({
        code: 'ONE_C_PAIRING_CHALLENGE_NOT_ACTIVE',
      }),
    );

    // A mismatch must fail before consuming the challenge. The same one-time
    // code can then be used once with the correct organization evidence.
    const rotateChallenge = await repository.createPairingChallenge(chiefA, {
      correlationId: `${RUN}.pairing-rotate`,
      ttlSeconds: 600,
    });
    const wrongInnDiscovery = discovery('9999999999', KPP_A, 'Wrong INN');
    await expect(
      repository.consumePairing({
        pairingCode: rotateChallenge.pairingCode as string,
        discovery: wrongInnDiscovery,
        correlationId: `${RUN}.consume-wrong-inn`,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OneCRuntimeRepositoryError>>({
        code: 'ONE_C_ORGANIZATION_NOT_FOUND_IN_DISCOVERY',
      }),
    );

    const rotated = await repository.consumePairing({
      pairingCode: rotateChallenge.pairingCode as string,
      discovery: discovery(INN_A, KPP_A, 'One C A'),
      correlationId: `${RUN}.consume-rotate`,
    });
    expect(rotated.bindingId).toBe(firstPair.bindingId);
    expect(rotated.installationId).toBe(firstPair.installationId);
    expect(rotated.credentialId).not.toBe(firstPair.credentialId);

    await expect(repository.authenticateMachineBearer(firstPair.machineBearer)).resolves.toEqual({
      authorized: false,
      reason: 'REVOKED',
    });
    await expect(repository.authenticateMachineBearer(rotated.machineBearer)).resolves.toMatchObject({
      authorized: true,
      credentialId: rotated.credentialId,
    });

    // The physical installation is global. A second tenant reporting the same
    // opaque database instance and the same 1C organization GUID cannot bind
    // that legal entity to a different platform organization even when it lies
    // about the entity details to match its own tenant.
    const challengeB = await repository.createPairingChallenge(chiefB, {
      correlationId: `${RUN}.pairing-b`,
      ttlSeconds: 600,
    });
    await expect(
      repository.consumePairing({
        pairingCode: challengeB.pairingCode as string,
        discovery: discovery(INN_B, KPP_B, 'One C B'),
        correlationId: `${RUN}.consume-b-collision`,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OneCRuntimeRepositoryError>>({
        code: 'ONE_C_ENTITY_ALREADY_BOUND_TO_ANOTHER_ORGANIZATION',
      }),
    );

    const viewA = await repository.describeBinding(chiefA);
    expect(viewA.outcome).toBe(OneCBindingReadOutcome.AVAILABLE);
    if (viewA.outcome === OneCBindingReadOutcome.AVAILABLE) {
      expect(viewA.binding.bindingId).toBe(rotated.bindingId);
      expect(viewA.binding.installationId).toBe(rotated.installationId);
      expect(viewA.binding.organizationId).toBe(ORG_A);
    }

    const viewB = await repository.describeBinding(chiefB);
    expect(viewB).toEqual({ outcome: OneCBindingReadOutcome.NOT_CONNECTED, binding: null });

    const revoked = await repository.revokeBinding(directorA, {
      bindingId: rotated.bindingId,
      reason: 'CREDENTIAL_SUSPECTED_COMPROMISED',
      correlationId: `${RUN}.revoke`,
    });
    expect(revoked.outcome).toBe(OneCBindingRevokeOutcome.REVOKED);
    await expect(repository.authenticateMachineBearer(rotated.machineBearer)).resolves.toMatchObject({
      authorized: false,
    });

    const auditRows = await prisma.$queryRaw<Array<{
      action: string;
      reason: string | null;
      metadata: unknown;
    }>>(Prisma.sql`
      SELECT "action", "reason", "metadata"
        FROM public.audit_events
       WHERE "tenantId" = ${TENANT_A}
         AND "orgId" = ${ORG_A}
         AND "action" LIKE 'ONE_C_%'
       ORDER BY "createdAt", "id"
    `);
    expect(auditRows.length).toBeGreaterThanOrEqual(4);
    const auditText = JSON.stringify(auditRows);
    for (const forbidden of [
      activeChallenge.pairingCode as string,
      rotateChallenge.pairingCode as string,
      firstPair.machineBearer,
      rotated.machineBearer,
      firstSecret,
      storedCredential[0].salt,
      storedCredential[0].secretHash,
    ]) {
      expect(auditText).not.toContain(forbidden);
    }
  });

  it('keeps the connector authority no-login, non-bypass and memberless', async () => {
    const rows = await prisma.$queryRaw<Array<{
      canLogin: boolean;
      inherits: boolean;
      superuser: boolean;
      bypassRls: boolean;
      membershipEdgeCount: bigint;
    }>>(Prisma.sql`
      SELECT role.rolcanlogin AS "canLogin",
             role.rolinherit AS inherits,
             role.rolsuper AS superuser,
             role.rolbypassrls AS "bypassRls",
             (
               SELECT count(*)::bigint
                 FROM pg_catalog.pg_auth_members membership
                WHERE membership.roleid = role.oid
                   OR membership.member = role.oid
             ) AS "membershipEdgeCount"
        FROM pg_catalog.pg_roles role
       WHERE role.rolname = 'pc_one_c_connector_authority'
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      canLogin: false,
      inherits: false,
      superuser: false,
      bypassRls: false,
      membershipEdgeCount: 0n,
    });
  });

  it('isolates organization row locking behind a no-write broker', async () => {
    const roles = await prisma.$queryRaw<Array<{
      roleName: string;
      canLogin: boolean;
      inherits: boolean;
      superuser: boolean;
      bypassRls: boolean;
      membershipEdgeCount: bigint;
    }>>(Prisma.sql`
      SELECT role.rolname AS "roleName",
             role.rolcanlogin AS "canLogin",
             role.rolinherit AS inherits,
             role.rolsuper AS superuser,
             role.rolbypassrls AS "bypassRls",
             (
               SELECT count(*)::bigint
                 FROM pg_catalog.pg_auth_members membership
                WHERE membership.roleid = role.oid
                   OR membership.member = role.oid
             ) AS "membershipEdgeCount"
        FROM pg_catalog.pg_roles role
       WHERE role.rolname = 'pc_one_c_organization_lock_authority'
    `);
    expect(roles).toEqual([{
      roleName: 'pc_one_c_organization_lock_authority',
      canLogin: false,
      inherits: false,
      superuser: false,
      bypassRls: false,
      membershipEdgeCount: 0n,
    }]);

    const connectorUpdateColumns = await prisma.$queryRaw<Array<{ columnName: string }>>(
      Prisma.sql`
        SELECT privilege.column_name AS "columnName"
          FROM information_schema.column_privileges privilege
         WHERE privilege.grantee = 'pc_one_c_connector_authority'
           AND privilege.table_schema = 'public'
           AND privilege.table_name = 'organizations'
           AND privilege.privilege_type = 'UPDATE'
         ORDER BY privilege.column_name
      `,
    );
    expect(connectorUpdateColumns).toEqual([]);

    const lockUpdateColumns = await prisma.$queryRaw<Array<{ columnName: string }>>(
      Prisma.sql`
        SELECT privilege.column_name AS "columnName"
          FROM information_schema.column_privileges privilege
         WHERE privilege.grantee = 'pc_one_c_organization_lock_authority'
           AND privilege.table_schema = 'public'
           AND privilege.table_name = 'organizations'
           AND privilege.privilege_type = 'UPDATE'
         ORDER BY privilege.column_name
      `,
    );
    expect(lockUpdateColumns).toEqual([{ columnName: 'updatedAt' }]);

    const policies = await prisma.$queryRaw<Array<{
      policyName: string;
      permissive: boolean;
      command: string;
      usingExpression: string | null;
      checkExpression: string | null;
    }>>(Prisma.sql`
      SELECT policy.polname AS "policyName",
             policy.polpermissive AS permissive,
             policy.polcmd::text AS command,
             pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) AS "usingExpression",
             pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid) AS "checkExpression"
        FROM pg_catalog.pg_policy policy
        JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
        JOIN pg_catalog.pg_roles role ON role.oid = ANY(policy.polroles)
       WHERE namespace.nspname = 'public'
         AND relation.relname = 'organizations'
         AND role.rolname = 'pc_one_c_organization_lock_authority'
       ORDER BY policy.polname
    `);
    expect(policies).toEqual([
      {
        policyName: 'organizations_one_c_lock_no_write',
        permissive: false,
        command: 'w',
        usingExpression: 'true',
        checkExpression: 'false',
      },
      {
        policyName: 'organizations_one_c_lock_select',
        permissive: true,
        command: 'r',
        usingExpression: 'true',
        checkExpression: null,
      },
      {
        policyName: 'organizations_one_c_lock_update',
        permissive: true,
        command: 'w',
        usingExpression: 'true',
        checkExpression: 'false',
      },
    ]);

    const [{ updatedAt: before }] = await prisma.$queryRaw<Array<{ updatedAt: Date }>>(
      Prisma.sql`SELECT "updatedAt" FROM public."organizations" WHERE "id" = ${ORG_A}`,
    );

    await expect(prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(
        Prisma.sql`SET LOCAL ROLE pc_one_c_organization_lock_authority`,
      );
      await transaction.$executeRaw(Prisma.sql`
        UPDATE public."organizations"
           SET "updatedAt" = clock_timestamp()
         WHERE "id" = ${ORG_A}
      `);
    })).rejects.toThrow();

    await expect(prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(
        Prisma.sql`SET LOCAL ROLE pc_one_c_connector_authority`,
      );
      await transaction.$executeRaw(Prisma.sql`
        UPDATE public."organizations"
           SET "updatedAt" = clock_timestamp()
         WHERE "id" = ${ORG_A}
      `);
    })).rejects.toThrow();

    const [{ updatedAt: after }] = await prisma.$queryRaw<Array<{ updatedAt: Date }>>(
      Prisma.sql`SELECT "updatedAt" FROM public."organizations" WHERE "id" = ${ORG_A}`,
    );
    expect(after.getTime()).toBe(before.getTime());
  });

  it('persists heartbeat, lease, ACK, result, reconciliation and canonical outbox evidence', async () => {
    const chief = actor(CHIEF_RUNTIME, ORG_RUNTIME, TENANT_RUNTIME);
    const challenge = await repository.createPairingChallenge(chief, {
      correlationId: `${RUN}.runtime-pairing`,
      ttlSeconds: 600,
    });
    const paired = await repository.consumePairing({
      pairingCode: challenge.pairingCode as string,
      discovery: runtimeDiscovery(),
      correlationId: `${RUN}.runtime-consume`,
    });

    const heartbeat = await heartbeats.record(paired.machineBearer, {
      protocolVersion: ONE_C_PROTOCOL_VERSION,
      connectorVersion: '1.0.0',
      platformVersion: '8.3.27.1234',
      configurationVersion: '3.0.170.31',
      health: OneCHeartbeatHealth.READY,
      diagnosticCodes: [],
    }, `${RUN}.heartbeat`);
    expect(heartbeat).toMatchObject({ outcome: 'ACCEPTED', health: 'READY', heartbeatCount: '1' });

    const enqueued = await jobs.enqueue(chief, {
      command: OneCCommand.GET_DOCUMENT_STATUS,
      payload: { documentId: `${RUN}.document-1` },
      idempotencyKey: `${RUN}.job-1`,
      correlationId: `${RUN}.job-1-correlation`,
      revision: 1,
      maxAttempts: 3,
    });
    expect(enqueued.outcome).toBe(OneCJobReconciliationOutcome.APPLIED);
    if (!('job' in enqueued)) throw new Error('job was not returned');

    const lease = await jobs.leaseJobs(paired.machineBearer, 10, `${RUN}.lease-1`);
    expect(lease.outcome).toBe(OneCJobMachineOutcome.LEASED);
    if (!('jobs' in lease)) throw new Error('jobs were not leased');
    expect(lease.jobs).toHaveLength(1);
    const leased = lease.jobs[0];
    expect(leased.id).toBe(enqueued.job.jobId);
    const leaseSecret = leased.leaseBearer.split('.')[1] ?? '';
    const storedLease = await prisma.$queryRaw<Array<{ salt: string; bearerHash: string }>>(Prisma.sql`
      SELECT salt, bearer_hash AS "bearerHash"
        FROM connector.one_c_job_leases
       WHERE job_id = ${leased.id}
    `);
    expect(storedLease).toHaveLength(1);
    expect(storedLease[0].bearerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(storedLease[0])).not.toContain(leaseSecret);

    const ackEnvelope = {
      idempotencyKey: `${RUN}.ack-1`,
      payloadHash: enqueued.job.payloadHash,
      revision: leased.revision,
      attempt: leased.attempt,
    };
    await expect(jobs.acknowledge(
      paired.machineBearer,
      `${leased.leaseBearer.slice(0, 37)}${'x'.repeat(43)}`,
      leased.id,
      ackEnvelope,
      `${RUN}.ack-wrong-secret`,
    )).resolves.toMatchObject({ outcome: OneCJobMachineOutcome.UNAUTHORIZED });

    const acknowledged = await jobs.acknowledge(
      paired.machineBearer, leased.leaseBearer, leased.id, ackEnvelope, `${RUN}.ack-1`,
    );
    expect(acknowledged).toMatchObject({
      outcome: OneCJobMachineOutcome.ACKNOWLEDGED,
      status: 'ACKNOWLEDGED',
      syncState: OneCSyncState.DELIVERED_TO_CONNECTOR,
      replayed: false,
    });
    await expect(jobs.acknowledge(
      paired.machineBearer, leased.leaseBearer, leased.id, ackEnvelope, `${RUN}.ack-1-replay`,
    )).resolves.toMatchObject({ replayed: true });

    const result = {
      ...ackEnvelope,
      idempotencyKey: `${RUN}.result-1`,
      resultState: OneCSyncState.CREATED_IN_1C,
      resultCode: 'ONE_C_DRAFT_FOUND',
      externalEvidenceId: `${RUN}.one-c-document-guid`,
    } as const;
    await expect(jobs.complete(
      paired.machineBearer, leased.leaseBearer, leased.id, result, `${RUN}.result-1`,
    )).resolves.toMatchObject({
      outcome: OneCJobMachineOutcome.COMPLETED,
      status: 'SUCCEEDED', syncState: OneCSyncState.CREATED_IN_1C, replayed: false,
    });
    await expect(jobs.complete(
      paired.machineBearer, leased.leaseBearer, leased.id, result, `${RUN}.result-1-replay`,
    )).resolves.toMatchObject({ replayed: true });

    const ambiguousEnqueue = await jobs.enqueue(chief, {
      command: OneCCommand.GET_DOCUMENT_STATUS,
      payload: { documentId: `${RUN}.document-2` },
      idempotencyKey: `${RUN}.job-2`,
      correlationId: `${RUN}.job-2-correlation`,
      revision: 4,
    });
    if (!('job' in ambiguousEnqueue)) throw new Error('ambiguous job was not returned');
    const ambiguousLeaseResult = await jobs.leaseJobs(paired.machineBearer, 10, `${RUN}.lease-2`);
    if (!('jobs' in ambiguousLeaseResult)) throw new Error('ambiguous job was not leased');
    const ambiguousLease = ambiguousLeaseResult.jobs[0];
    const ambiguousEnvelope = {
      idempotencyKey: `${RUN}.ack-2`,
      payloadHash: ambiguousEnqueue.job.payloadHash,
      revision: ambiguousLease.revision,
      attempt: ambiguousLease.attempt,
    };
    await jobs.acknowledge(
      paired.machineBearer, ambiguousLease.leaseBearer, ambiguousLease.id,
      ambiguousEnvelope, `${RUN}.ack-2`,
    );
    await expect(jobs.fail(
      paired.machineBearer, ambiguousLease.leaseBearer, ambiguousLease.id,
      {
        ...ambiguousEnvelope,
        idempotencyKey: `${RUN}.fail-2`,
        failureClass: IntegrationFailureClass.UNKNOWN_RESULT,
        effectState: OneCFailureEffectState.UNKNOWN,
        resultCode: 'ONE_C_RESULT_AMBIGUOUS',
      },
      `${RUN}.fail-2`,
    )).resolves.toMatchObject({
      outcome: OneCJobMachineOutcome.FAILED,
      status: 'RECONCILIATION_REQUIRED',
      syncState: OneCSyncState.RECONCILIATION_REQUIRED,
    });

    await expect(jobs.reconcile(
      chief,
      ambiguousLease.id,
      {
        idempotencyKey: `${RUN}.reconcile-2`,
        action: OneCReconciliationAction.REQUEUE_CONFIRMED_NO_EFFECT,
        reasonCode: 'ONE_C_EFFECT_CONFIRMED_ABSENT',
        externalEvidenceId: null,
      },
      `${RUN}.reconcile-2`,
    )).resolves.toMatchObject({
      outcome: OneCJobReconciliationOutcome.APPLIED,
      status: 'QUEUED',
      syncState: OneCSyncState.QUEUED,
      revision: 5,
    });

    const evidence = await prisma.$queryRaw<Array<{
      jobStatus: string;
      outboxStatus: string;
      receiptCount: bigint;
      verifierLeak: bigint;
      machineAuditCount: bigint;
      machineAuditActorMismatch: bigint;
    }>>(Prisma.sql`
      SELECT job.status AS "jobStatus", outbox."status" AS "outboxStatus",
             (SELECT count(*)::bigint FROM connector.one_c_job_receipts receipt
               WHERE receipt.job_id = job.id) AS "receiptCount",
             (SELECT count(*)::bigint FROM public.audit_events audit
               WHERE audit."tenantId" = ${TENANT_RUNTIME}
                 AND (audit."metadata"::text LIKE ${`%${paired.machineBearer}%`}
                   OR audit."metadata"::text LIKE ${`%${leaseSecret}%`}
                   OR audit."metadata"::text LIKE ${`%${storedLease[0].bearerHash}%`})) AS "verifierLeak",
             (SELECT count(*)::bigint FROM public.audit_events audit
               WHERE audit."tenantId" = ${TENANT_RUNTIME}
                 AND audit."actorRole" = 'CONNECTOR_MACHINE') AS "machineAuditCount",
             (SELECT count(*)::bigint FROM public.audit_events audit
               WHERE audit."tenantId" = ${TENANT_RUNTIME}
                 AND audit."actorRole" = 'CONNECTOR_MACHINE'
                 AND audit."actorUserId" <> ${paired.credentialId}) AS "machineAuditActorMismatch"
        FROM connector.one_c_jobs job
        JOIN public."outbox_entries" outbox ON outbox."id" = job.outbox_entry_id
       WHERE job.id = ${leased.id}
    `);
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      jobStatus: 'SUCCEEDED', outboxStatus: 'CONFIRMED', receiptCount: 2n,
      verifierLeak: 0n, machineAuditActorMismatch: 0n,
    });
    expect(evidence[0].machineAuditCount).toBeGreaterThan(0n);
  });
});
