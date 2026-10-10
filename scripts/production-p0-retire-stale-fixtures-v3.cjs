'use strict';

const { randomUUID } = require('crypto');

class BoundedFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const fail = (code) => { throw new BoundedFailure(code); };

let Prisma;

function loadExport(path, exportName, blocker) {
  try {
    const module = require(path);
    const value = module?.[exportName];
    if (typeof value !== 'function') fail(`${blocker}_EXPORT_MISSING`);
    return value;
  } catch (error) {
    if (error instanceof BoundedFailure) throw error;
    fail(blocker);
  }
}

function loadRuntime() {
  try {
    ({ Prisma } = require('@prisma/client'));
  } catch {
    fail('RUNTIME_PRISMA_LOAD_FAILED');
  }
  const AuthPrismaService = loadExport(
    '/app/dist/apps/api/src/modules/auth/auth-prisma.service.js',
    'AuthPrismaService',
    'RUNTIME_AUTH_PRISMA_LOAD_FAILED',
  );
  const PersistentAuthRepository = loadExport(
    '/app/dist/apps/api/src/modules/auth/persistent-auth.repository.js',
    'PersistentAuthRepository',
    'RUNTIME_AUTH_REPOSITORY_LOAD_FAILED',
  );
  const appendAuthAudit = loadExport(
    '/app/dist/apps/api/src/modules/auth/auth-audit.js',
    'appendAuthAudit',
    'RUNTIME_AUTH_AUDIT_LOAD_FAILED',
  );
  return { AuthPrismaService, PersistentAuthRepository, appendAuthAudit };
}

const [staleRaw, cleanupCorrelation, modeRaw = 'apply'] = process.argv.slice(2);
const staleSeconds = Number(staleRaw);
const mode = String(modeRaw || '').trim();

const allowedStatuses = new Set([
  'ORGANIZATION_VERIFICATION_PENDING',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'SUSPENDED',
]);

const allRoleRoles = Object.freeze({
  seller: 'FARMER',
  buyer: 'BUYER',
  logistics: 'LOGISTICIAN',
  driver: 'DRIVER',
  elevator: 'ELEVATOR',
  lab: 'LAB',
  surveyor: 'SURVEYOR',
  bank: 'ACCOUNTING',
});
const firstCustomerWorkspaces = Object.freeze({ a: 'seller', b: 'buyer' });
const firstCustomerRoles = Object.freeze({ a: 'FARMER', b: 'BUYER' });

const allRoleLegalPattern = /^Production P0 exact-run organization (SELLER|BUYER|LOGISTICS|DRIVER|ELEVATOR|LAB|SURVEYOR|BANK) ([A-Za-z0-9._:-]{1,48})$/;
const allRoleCorrelationPattern = /^p0-all-role-register:([0-9a-f]{12}):([A-Za-z0-9._:-]{1,48}):(seller|buyer|logistics|driver|elevator|lab|surveyor|bank)$/;
const allRoleIdempotencyPattern = /^p0-all-role-register:([0-9a-f]{40}):([A-Za-z0-9._:-]{1,48}):(seller|buyer|logistics|driver|elevator|lab|surveyor|bank)$/;
const firstCustomerLegalPattern = /^Production P0 exact-run organization (A|B)$/;
const githubRunToken = '[0-9]{6,20}(?:-[1-9][0-9]*)?';
const firstCustomerCorrelationPattern = new RegExp(`^p0-registration:([0-9a-f]{12}):(${githubRunToken}):(a|b)$`);
const firstCustomerIdempotencyPattern = new RegExp(`^p0-registration:([0-9a-f]{40}):(${githubRunToken}):(a|b)$`);

function validateAllRole(row, legal) {
  const correlation = allRoleCorrelationPattern.exec(String(row.correlation_id || ''));
  const idempotency = allRoleIdempotencyPattern.exec(String(row.idempotency_key || ''));
  if (!correlation || !idempotency) fail('CANDIDATE_ALL_ROLE_MARKER_INVALID');

  const label = legal[1].toLowerCase();
  const run = legal[2];
  if (
    correlation[2] !== run
    || idempotency[2] !== run
    || correlation[3] !== label
    || idempotency[3] !== label
  ) fail('CANDIDATE_ALL_ROLE_MARKER_MISMATCH');
  if (correlation[1] !== idempotency[1].slice(0, 12)) fail('CANDIDATE_ALL_ROLE_SHA_MISMATCH');
  if (row.requested_workspace !== label || row.requested_role !== allRoleRoles[label]) {
    fail('CANDIDATE_ALL_ROLE_ROLE_INVALID');
  }
  return 'ALL_ROLE';
}

function validateFirstCustomer(row, legal) {
  const correlation = firstCustomerCorrelationPattern.exec(String(row.correlation_id || ''));
  const idempotency = firstCustomerIdempotencyPattern.exec(String(row.idempotency_key || ''));
  if (!correlation || !idempotency) fail('CANDIDATE_FIRST_CUSTOMER_MARKER_INVALID');

  const label = legal[1].toLowerCase();
  if (correlation[3] !== label || idempotency[3] !== label) {
    fail('CANDIDATE_FIRST_CUSTOMER_MARKER_MISMATCH');
  }
  if (correlation[1] !== idempotency[1].slice(0, 12)) fail('CANDIDATE_FIRST_CUSTOMER_SHA_MISMATCH');
  if (
    row.requested_workspace !== firstCustomerWorkspaces[label]
    || row.requested_role !== firstCustomerRoles[label]
  ) fail('CANDIDATE_FIRST_CUSTOMER_ROLE_INVALID');
  return 'FIRST_CUSTOMER';
}

function validateCandidate(row) {
  if (row.kind !== 'NEW_ORGANIZATION' || !allowedStatuses.has(row.status)) {
    fail('CANDIDATE_STATE_INVALID');
  }

  const legalName = String(row.legal_name || '');
  const allRoleLegal = allRoleLegalPattern.exec(legalName);
  const firstCustomerLegal = firstCustomerLegalPattern.exec(legalName);
  let source;
  if (allRoleLegal) source = validateAllRole(row, allRoleLegal);
  else if (firstCustomerLegal) source = validateFirstCustomer(row, firstCustomerLegal);
  else fail('CANDIDATE_LEGAL_MARKER_INVALID');

  const submitted = new Date(row.submitted_at).getTime();
  if (!Number.isFinite(submitted) || Date.now() - submitted < staleSeconds * 1000) {
    fail('CANDIDATE_NOT_STALE');
  }
  return source;
}

function candidatePredicate() {
  return Prisma.sql`
    kind = 'NEW_ORGANIZATION'
    AND status IN (
      'ORGANIZATION_VERIFICATION_PENDING',
      'ADDITIONAL_INFORMATION_REQUIRED',
      'SUSPENDED'
    )
    AND submitted_at <= NOW() - (${staleSeconds} * INTERVAL '1 second')
    AND (
      (
        legal_name LIKE 'Production P0 exact-run organization %'
        AND correlation_id LIKE 'p0-all-role-register:%'
        AND idempotency_key LIKE 'p0-all-role-register:%'
      )
      OR
      (
        legal_name IN (
          'Production P0 exact-run organization A',
          'Production P0 exact-run organization B'
        )
        AND correlation_id LIKE 'p0-registration:%'
        AND idempotency_key LIKE 'p0-registration:%'
      )
    )
  `;
}

async function selectCandidates(client, forUpdate = false) {
  const lock = forUpdate ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await client.$queryRaw(Prisma.sql`
    SELECT id, kind, user_id, membership_id, organization_id,
           requested_workspace, requested_role, status, version,
           submitted_at, legal_name, correlation_id, idempotency_key
    FROM auth.registration_applications
    WHERE ${candidatePredicate()}
    ORDER BY submitted_at, id
    LIMIT 1025
    ${lock}
  `);
  if (rows.length > 1024) fail('CANDIDATE_BOUND_EXCEEDED');
  return rows;
}

async function assertNoActiveSessions(client, row) {
  const sessions = await client.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM auth.sessions
    WHERE user_id = ${row.user_id}
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
      AND expires_at > NOW()
  `);
  if (Number(sessions[0]?.count || 0) !== 0) fail('CANDIDATE_ACTIVE_SESSION_PRESENT');
}

async function insertLifecycleEvent(client, input) {
  await client.$executeRaw(Prisma.sql`
    INSERT INTO auth.registration_application_events (
      id, application_id, actor_user_id, actor_kind,
      previous_status, new_status, reason, correlation_id,
      idempotency_key, application_version, metadata
    ) VALUES (
      ${`reg_evt_${randomUUID()}`}, ${input.applicationId}, NULL, 'SYSTEM',
      ${input.previousStatus}, 'CANCELLED', 'P0_ACCEPTANCE_FIXTURE_RETIRED', ${cleanupCorrelation},
      ${input.idempotencyKey}, ${input.applicationVersion},
      ${JSON.stringify({ source: 'PC_CROP_BOUNDED_MAINTENANCE', fixtureFamily: input.source })}::jsonb
    )
  `);
}

async function runPreflight(prisma, repository, appendAuthAudit) {
  if (typeof repository.latestAuditChainPosition !== 'function' || typeof repository.insertAudit !== 'function') {
    fail('CANONICAL_AUDIT_METHODS_MISSING');
  }
  if (typeof appendAuthAudit !== 'function') fail('CANONICAL_AUDIT_HELPER_MISSING');

  const summary = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const candidates = await selectCandidates(tx, false);
    let allRole = 0;
    let firstCustomer = 0;
    for (const row of candidates) {
      const source = validateCandidate(row);
      await assertNoActiveSessions(tx, row);
      if (source === 'ALL_ROLE') allRole += 1;
      else firstCustomer += 1;
    }
    return { total: candidates.length, allRole, firstCustomer };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 30000,
    maxWait: 5000,
  });

  console.log('P0_RETIRE_PREFLIGHT=PASS');
  console.log(`P0_RETIRE_PREFLIGHT_CANDIDATES=${summary.total}`);
  console.log(`P0_RETIRE_PREFLIGHT_ALL_ROLE=${summary.allRole}`);
  console.log(`P0_RETIRE_PREFLIGHT_FIRST_CUSTOMER=${summary.firstCustomer}`);
  console.log('P0_RETIRE_PREFLIGHT_PRODUCTION_MUTATION=NONE');
  console.log('P0_RETIRE_RAW_IDENTIFIERS=0');
  console.log('P0_RETIRE_NON_MARKER_MUTATIONS=0');
}

async function runApply(prisma, repository, appendAuthAudit) {
  const result = await prisma.$transaction(async (tx) => {
    const candidates = await selectCandidates(tx, true);
    let retired = 0;
    let allRoleRetired = 0;
    let firstCustomerRetired = 0;

    for (const row of candidates) {
      const source = validateCandidate(row);
      await assertNoActiveSessions(tx, row);
      const nextVersion = BigInt(row.version) + 1n;
      const updated = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_applications
        SET status = 'CANCELLED', version = ${nextVersion}, updated_at = NOW()
        WHERE id = ${row.id}
          AND version = ${row.version}
          AND status = ${row.status}
          AND kind = 'NEW_ORGANIZATION'
          AND legal_name = ${row.legal_name}
          AND correlation_id = ${row.correlation_id}
          AND idempotency_key = ${row.idempotency_key}
          AND submitted_at <= NOW() - (${staleSeconds} * INTERVAL '1 second')
      `);
      if (updated !== 1) fail('CANDIDATE_UPDATE_CONFLICT');

      await tx.$executeRaw(Prisma.sql`
        UPDATE auth.registration_email_challenges
        SET status = 'REVOKED', updated_at = NOW()
        WHERE application_id = ${row.id} AND status = 'PENDING'
      `);

      await insertLifecycleEvent(tx, {
        applicationId: row.id,
        previousStatus: row.status,
        idempotencyKey: `p0-fixture-retire:${row.id}:${nextVersion}`,
        applicationVersion: nextVersion,
        source,
      });

      await appendAuthAudit(repository, tx, {
        userId: row.user_id,
        membershipId: row.membership_id,
        organizationId: row.organization_id,
        action: 'auth.registration.fixture_retired',
        outcome: 'SUCCESS',
        reason: 'P0_ACCEPTANCE_FIXTURE_RETIRED',
        metadata: {
          applicationId: row.id,
          correlationId: cleanupCorrelation,
          fixtureFamily: source,
        },
      });

      retired += 1;
      if (source === 'ALL_ROLE') allRoleRetired += 1;
      else firstCustomerRetired += 1;
    }

    const remaining = await tx.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM auth.registration_applications
      WHERE ${candidatePredicate()}
    `);
    const events = await tx.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM auth.registration_application_events event
      JOIN auth.registration_applications application
        ON application.id = event.application_id
      WHERE event.correlation_id = ${cleanupCorrelation}
        AND event.actor_kind = 'SYSTEM'
        AND event.new_status = 'CANCELLED'
        AND event.reason = 'P0_ACCEPTANCE_FIXTURE_RETIRED'
        AND application.status = 'CANCELLED'
        AND application.kind = 'NEW_ORGANIZATION'
        AND application.legal_name LIKE 'Production P0 exact-run organization %'
        AND (
          application.correlation_id LIKE 'p0-all-role-register:%'
          OR application.correlation_id LIKE 'p0-registration:%'
        )
    `);
    const audits = await tx.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM auth.audit_events audit
      WHERE audit.action = 'auth.registration.fixture_retired'
        AND audit.outcome = 'SUCCESS'
        AND audit.reason = 'P0_ACCEPTANCE_FIXTURE_RETIRED'
        AND audit.metadata ->> 'correlationId' = ${cleanupCorrelation}
    `);
    const pendingChallenges = await tx.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM auth.registration_email_challenges challenge
      JOIN auth.registration_application_events event
        ON event.application_id = challenge.application_id
      WHERE event.correlation_id = ${cleanupCorrelation}
        AND event.reason = 'P0_ACCEPTANCE_FIXTURE_RETIRED'
        AND challenge.status = 'PENDING'
    `);

    const remainingCount = Number(remaining[0]?.count || 0);
    const eventCount = Number(events[0]?.count || 0);
    const auditCount = Number(audits[0]?.count || 0);
    const pendingChallengeCount = Number(pendingChallenges[0]?.count || 0);

    if (remainingCount !== 0) fail('POSTCONDITION_STALE_ROWS_REMAIN');
    if (eventCount !== retired || auditCount !== retired) fail('POSTCONDITION_EVIDENCE_MISMATCH');
    if (pendingChallengeCount !== 0) fail('POSTCONDITION_PENDING_EMAIL_CHALLENGE');
    if (allRoleRetired + firstCustomerRetired !== retired) fail('POSTCONDITION_FAMILY_COUNT_MISMATCH');

    return {
      retired,
      allRoleRetired,
      firstCustomerRetired,
      remainingCount,
      eventCount,
      auditCount,
      pendingChallengeCount,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 60000,
    maxWait: 5000,
  });

  console.log('P0_RETIRE_RESULT=PASS');
  console.log(`P0_RETIRE_RETIRED=${result.retired}`);
  console.log(`P0_RETIRE_RETIRED_ALL_ROLE=${result.allRoleRetired}`);
  console.log(`P0_RETIRE_RETIRED_FIRST_CUSTOMER=${result.firstCustomerRetired}`);
  console.log(`P0_RETIRE_REMAINING=${result.remainingCount}`);
  console.log(`P0_RETIRE_EVENT_EVIDENCE=${result.eventCount}`);
  console.log(`P0_RETIRE_AUDIT_EVIDENCE=${result.auditCount}`);
  console.log(`P0_RETIRE_PENDING_EMAIL_CHALLENGES=${result.pendingChallengeCount}`);
  console.log('P0_RETIRE_FIRST_CUSTOMER_RUN_COMPAT=PASS');
  console.log('P0_RETIRE_RAW_IDENTIFIERS=0');
  console.log('P0_RETIRE_NON_MARKER_MUTATIONS=0');
}

async function main() {
  if (
    staleSeconds !== 1800
    || !/^p0-fixture-retire:[0-9]+-[0-9]+$/.test(cleanupCorrelation || '')
    || !new Set(['preflight', 'apply']).has(mode)
  ) fail('INPUT_INVALID');

  const { AuthPrismaService, PersistentAuthRepository, appendAuthAudit } = loadRuntime();
  const prisma = new AuthPrismaService();
  const repository = new PersistentAuthRepository(prisma);

  try {
    await prisma.onModuleInit();
    if (mode === 'preflight') await runPreflight(prisma, repository, appendAuthAudit);
    else await runApply(prisma, repository, appendAuthAudit);
  } finally {
    await prisma.onModuleDestroy().catch(() => {});
  }
}

main().catch((error) => {
  const code = error instanceof BoundedFailure && /^[A-Z0-9_]{4,96}$/.test(error.code)
    ? error.code
    : 'BOUNDED_RETIRE_OPERATION_FAILED';
  console.log('P0_RETIRE_RESULT=FAIL');
  console.log(`P0_RETIRE_BLOCKER=${code}`);
  process.exitCode = 1;
});
