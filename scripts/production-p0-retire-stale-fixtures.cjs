'use strict';

const { Prisma, PrismaClient } = require('@prisma/client');
const { PersistentAuthRepository } = require('/app/dist/apps/api/src/modules/auth/persistent-auth.repository.js');
const { RegistrationApplicationService } = require('/app/dist/apps/api/src/modules/auth/registration-application.service.js');

class BoundedFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const fail = (code) => { throw new BoundedFailure(code); };
const [staleRaw, cleanupCorrelation] = process.argv.slice(2);
const staleSeconds = Number(staleRaw);
const maintenanceUrl = String(process.env.P0_RETIRE_DATABASE_URL || '').trim();
const allowedStatuses = new Set([
  'ORGANIZATION_VERIFICATION_PENDING',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'SUSPENDED',
]);
const roles = Object.freeze({
  seller: 'FARMER',
  buyer: 'BUYER',
  logistics: 'LOGISTICIAN',
  driver: 'DRIVER',
  elevator: 'ELEVATOR',
  lab: 'LAB',
  surveyor: 'SURVEYOR',
  bank: 'ACCOUNTING',
});
const legalPattern = /^Production P0 exact-run organization (SELLER|BUYER|LOGISTICS|DRIVER|ELEVATOR|LAB|SURVEYOR|BANK) ([A-Za-z0-9._:-]{1,48})$/;
const correlationPattern = /^p0-all-role-register:([0-9a-f]{12}):([A-Za-z0-9._:-]{1,48}):(seller|buyer|logistics|driver|elevator|lab|surveyor|bank)$/;
const idempotencyPattern = /^p0-all-role-register:([0-9a-f]{40}):([A-Za-z0-9._:-]{1,48}):(seller|buyer|logistics|driver|elevator|lab|surveyor|bank)$/;

function validateMaintenanceUrl() {
  if (process.env.P0_RETIRE_BOUNDED_MAINTENANCE !== '1') fail('MAINTENANCE_AUTHORITY_MARKER_MISSING');
  if (!maintenanceUrl || maintenanceUrl.length > 4096) fail('MAINTENANCE_DATABASE_URL_INVALID');
  try {
    const url = new URL(maintenanceUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('MAINTENANCE_DATABASE_URL_INVALID');
    if (!url.username || !url.password || !url.hostname || !url.pathname.replace(/^\/+/, '')) {
      fail('MAINTENANCE_DATABASE_URL_INVALID');
    }
  } catch (error) {
    if (error instanceof BoundedFailure) throw error;
    fail('MAINTENANCE_DATABASE_URL_INVALID');
  }
}

function validateCandidate(row) {
  if (row.kind !== 'NEW_ORGANIZATION' || !allowedStatuses.has(row.status)) {
    fail('CANDIDATE_STATE_INVALID');
  }
  const legal = legalPattern.exec(String(row.legal_name || ''));
  const correlation = correlationPattern.exec(String(row.correlation_id || ''));
  const idempotency = idempotencyPattern.exec(String(row.idempotency_key || ''));
  if (!legal || !correlation || !idempotency) fail('CANDIDATE_MARKER_INVALID');

  const label = legal[1].toLowerCase();
  const run = legal[2];
  if (
    correlation[2] !== run
    || idempotency[2] !== run
    || correlation[3] !== label
    || idempotency[3] !== label
  ) {
    fail('CANDIDATE_MARKER_MISMATCH');
  }
  if (correlation[1] !== idempotency[1].slice(0, 12)) fail('CANDIDATE_SHA_MISMATCH');
  if (row.requested_workspace !== label || row.requested_role !== roles[label]) {
    fail('CANDIDATE_ROLE_INVALID');
  }
  const submitted = new Date(row.submitted_at).getTime();
  if (!Number.isFinite(submitted) || Date.now() - submitted < staleSeconds * 1000) {
    fail('CANDIDATE_NOT_STALE');
  }
}

async function main() {
  if (
    staleSeconds !== 1800
    || !/^p0-fixture-retire:[0-9]+-[0-9]+$/.test(cleanupCorrelation || '')
  ) {
    fail('INPUT_INVALID');
  }
  validateMaintenanceUrl();

  const prisma = new PrismaClient({ datasources: { db: { url: maintenanceUrl } } });
  const repository = new PersistentAuthRepository(prisma);
  const service = new RegistrationApplicationService(prisma, repository);
  if (typeof service.insertEvent !== 'function' || typeof service.audit !== 'function') {
    fail('CANONICAL_AUDIT_METHODS_MISSING');
  }

  try {
    await prisma.$connect();

    const privilegeRows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_schema,
        has_table_privilege(current_user, 'auth.registration_applications', 'SELECT,UPDATE') AS applications_rw,
        has_table_privilege(current_user, 'auth.registration_email_challenges', 'UPDATE') AS challenges_update,
        has_table_privilege(current_user, 'auth.registration_application_events', 'SELECT,INSERT') AS events_ri,
        has_table_privilege(current_user, 'auth.audit_events', 'SELECT,INSERT') AS audit_ri,
        has_table_privilege(current_user, 'auth.sessions', 'SELECT') AS sessions_read
    `);
    const privileges = privilegeRows[0] || {};
    if (!Object.values(privileges).every((value) => value === true)) {
      fail('MAINTENANCE_DATABASE_PRIVILEGES_INSUFFICIENT');
    }

    const candidates = await prisma.$queryRaw(Prisma.sql`
      SELECT id, kind, user_id, membership_id, organization_id,
             requested_workspace, requested_role, status, version,
             submitted_at, legal_name, correlation_id, idempotency_key
      FROM auth.registration_applications
      WHERE kind = 'NEW_ORGANIZATION'
        AND status IN (
          'ORGANIZATION_VERIFICATION_PENDING',
          'ADDITIONAL_INFORMATION_REQUIRED',
          'SUSPENDED'
        )
        AND legal_name LIKE 'Production P0 exact-run organization %'
        AND correlation_id LIKE 'p0-all-role-register:%'
        AND idempotency_key LIKE 'p0-all-role-register:%'
        AND submitted_at <= NOW() - (${staleSeconds} * INTERVAL '1 second')
      ORDER BY submitted_at, id
      LIMIT 257
    `);
    if (candidates.length > 256) fail('CANDIDATE_BOUND_EXCEEDED');

    // Validate the entire candidate set before the first write.
    for (const row of candidates) {
      validateCandidate(row);
      const sessions = await prisma.$queryRaw(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM auth.sessions
        WHERE user_id = ${row.user_id}
          AND status = 'ACTIVE'
          AND revoked_at IS NULL
          AND expires_at > NOW()
      `);
      if (Number(sessions[0]?.count || 0) !== 0) fail('CANDIDATE_ACTIVE_SESSION_PRESENT');
    }

    let retired = 0;
    for (const candidate of candidates) {
      await prisma.$transaction(async (tx) => {
        const lockedRows = await tx.$queryRaw(Prisma.sql`
          SELECT id, kind, user_id, membership_id, organization_id,
                 requested_workspace, requested_role, status, version,
                 submitted_at, legal_name, correlation_id, idempotency_key
          FROM auth.registration_applications
          WHERE id = ${candidate.id}
          FOR UPDATE
        `);
        const row = lockedRows[0];
        if (!row) fail('CANDIDATE_DISAPPEARED');
        validateCandidate(row);
        if (row.version !== candidate.version || row.status !== candidate.status) {
          fail('CANDIDATE_CHANGED');
        }

        const nextVersion = row.version + 1n;
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
        await service.insertEvent(tx, {
          applicationId: row.id,
          actorKind: 'SYSTEM',
          previousStatus: row.status,
          newStatus: 'CANCELLED',
          reason: 'P0_ACCEPTANCE_FIXTURE_RETIRED',
          correlationId: cleanupCorrelation,
          idempotencyKey: `p0-fixture-retire:${row.id}:${nextVersion}`,
          applicationVersion: nextVersion,
          metadata: { source: 'PC_CROP_BOUNDED_MAINTENANCE' },
        });
        await service.audit(tx, {
          userId: row.user_id,
          membershipId: row.membership_id,
          organizationId: row.organization_id,
          action: 'auth.registration.fixture_retired',
          outcome: 'SUCCESS',
          reason: 'P0_ACCEPTANCE_FIXTURE_RETIRED',
          metadata: { applicationId: row.id, correlationId: cleanupCorrelation },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
        maxWait: 5000,
      });
      retired += 1;
    }

    const remaining = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM auth.registration_applications
      WHERE kind = 'NEW_ORGANIZATION'
        AND status IN (
          'ORGANIZATION_VERIFICATION_PENDING',
          'ADDITIONAL_INFORMATION_REQUIRED',
          'SUSPENDED'
        )
        AND legal_name LIKE 'Production P0 exact-run organization %'
        AND correlation_id LIKE 'p0-all-role-register:%'
        AND idempotency_key LIKE 'p0-all-role-register:%'
        AND submitted_at <= NOW() - (${staleSeconds} * INTERVAL '1 second')
    `);
    const events = await prisma.$queryRaw(Prisma.sql`
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
        AND application.correlation_id LIKE 'p0-all-role-register:%'
    `);
    const audits = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM auth.audit_events audit
      WHERE audit.action = 'auth.registration.fixture_retired'
        AND audit.outcome = 'SUCCESS'
        AND audit.reason = 'P0_ACCEPTANCE_FIXTURE_RETIRED'
        AND audit.metadata ->> 'correlationId' = ${cleanupCorrelation}
    `);

    const remainingCount = Number(remaining[0]?.count || 0);
    const eventCount = Number(events[0]?.count || 0);
    const auditCount = Number(audits[0]?.count || 0);
    if (remainingCount !== 0) fail('POSTCONDITION_STALE_ROWS_REMAIN');
    if (eventCount !== retired || auditCount !== retired) fail('POSTCONDITION_EVIDENCE_MISMATCH');

    console.log('P0_RETIRE_RESULT=PASS');
    console.log(`P0_RETIRE_RETIRED=${retired}`);
    console.log(`P0_RETIRE_REMAINING=${remainingCount}`);
    console.log(`P0_RETIRE_EVENT_EVIDENCE=${eventCount}`);
    console.log(`P0_RETIRE_AUDIT_EVIDENCE=${auditCount}`);
    console.log('P0_RETIRE_RAW_IDENTIFIERS=0');
    console.log('P0_RETIRE_NON_MARKER_MUTATIONS=0');
  } finally {
    await prisma.$disconnect().catch(() => {});
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
