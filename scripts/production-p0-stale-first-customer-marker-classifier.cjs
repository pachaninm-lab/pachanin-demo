'use strict';

const { Prisma } = require('@prisma/client');
const { AuthPrismaService } = require('/app/dist/apps/api/src/modules/auth/auth-prisma.service.js');

const staleSeconds = Number(process.argv[2]);
if (staleSeconds !== 1800) {
  console.log('P0_STALE_FC_CLASSIFY_RESULT=FAIL');
  console.log('P0_STALE_FC_CLASSIFY_BLOCKER=STALE_WINDOW_INVALID');
  process.exit(2);
}

const legalPattern = /^Production P0 exact-run organization (A|B)$/;
const correlationPattern = /^p0-registration:([0-9a-f]{12}):([A-Za-z0-9._:-]{1,48}):(a|b)$/;
const idempotencyPattern = /^p0-registration:([0-9a-f]{40}):([A-Za-z0-9._:-]{1,48}):(a|b)$/;
const githubRunPattern = /^([0-9]{6,20})(?:-([1-9][0-9]*))?$/;
const workspace = Object.freeze({ a: 'seller', b: 'buyer' });
const role = Object.freeze({ a: 'FARMER', b: 'BUYER' });

function classifyRunRelation(correlationRun, idempotencyRun) {
  if (correlationRun === idempotencyRun) return 'EXACT';
  const correlation = githubRunPattern.exec(correlationRun);
  const idempotency = githubRunPattern.exec(idempotencyRun);
  if (!correlation || !idempotency) return 'NON_GITHUB_SHAPE';
  if (correlation[1] !== idempotency[1]) return 'DIFFERENT_GITHUB_RUN';
  const correlationAttempt = correlation[2] || '';
  const idempotencyAttempt = idempotency[2] || '';
  if (correlationAttempt && !idempotencyAttempt) return 'CORRELATION_ATTEMPT_ONLY';
  if (!correlationAttempt && idempotencyAttempt) return 'IDEMPOTENCY_ATTEMPT_ONLY';
  if (correlationAttempt && idempotencyAttempt && correlationAttempt !== idempotencyAttempt) {
    return 'SAME_RUN_DIFFERENT_ATTEMPT';
  }
  return 'OTHER_SAME_RUN';
}

async function main() {
  const prisma = new AuthPrismaService();
  try {
    await prisma.onModuleInit();
    const summary = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const rows = await tx.$queryRaw(Prisma.sql`
        SELECT legal_name, correlation_id, idempotency_key, requested_workspace, requested_role
        FROM auth.registration_applications
        WHERE kind = 'NEW_ORGANIZATION'
          AND status IN (
            'ORGANIZATION_VERIFICATION_PENDING',
            'ADDITIONAL_INFORMATION_REQUIRED',
            'SUSPENDED'
          )
          AND legal_name IN (
            'Production P0 exact-run organization A',
            'Production P0 exact-run organization B'
          )
          AND correlation_id LIKE 'p0-registration:%'
          AND idempotency_key LIKE 'p0-registration:%'
          AND submitted_at <= NOW() - (${staleSeconds} * INTERVAL '1 second')
        ORDER BY submitted_at
        LIMIT 1025
      `);
      if (rows.length > 1024) throw new Error('CANDIDATE_BOUND_EXCEEDED');

      const counts = {
        total: rows.length,
        exact: 0,
        formatInvalid: 0,
        runMismatch: 0,
        correlationLabelMismatch: 0,
        idempotencyLabelMismatch: 0,
        shaPrefixMismatch: 0,
        workspaceRoleMismatch: 0,
        multiMismatch: 0,
        relationCorrelationAttemptOnly: 0,
        relationIdempotencyAttemptOnly: 0,
        relationSameRunDifferentAttempt: 0,
        relationDifferentGithubRun: 0,
        relationNonGithubShape: 0,
        relationOtherSameRun: 0,
      };

      for (const row of rows) {
        const legal = legalPattern.exec(String(row.legal_name || ''));
        const correlation = correlationPattern.exec(String(row.correlation_id || ''));
        const idempotency = idempotencyPattern.exec(String(row.idempotency_key || ''));
        if (!legal || !correlation || !idempotency) {
          counts.formatInvalid += 1;
          continue;
        }
        const label = legal[1].toLowerCase();
        const relation = classifyRunRelation(correlation[2], idempotency[2]);
        if (relation === 'CORRELATION_ATTEMPT_ONLY') counts.relationCorrelationAttemptOnly += 1;
        if (relation === 'IDEMPOTENCY_ATTEMPT_ONLY') counts.relationIdempotencyAttemptOnly += 1;
        if (relation === 'SAME_RUN_DIFFERENT_ATTEMPT') counts.relationSameRunDifferentAttempt += 1;
        if (relation === 'DIFFERENT_GITHUB_RUN') counts.relationDifferentGithubRun += 1;
        if (relation === 'NON_GITHUB_SHAPE') counts.relationNonGithubShape += 1;
        if (relation === 'OTHER_SAME_RUN') counts.relationOtherSameRun += 1;
        const flags = [
          relation !== 'EXACT' && 'run',
          correlation[3] !== label && 'correlationLabel',
          idempotency[3] !== label && 'idempotencyLabel',
          correlation[1] !== idempotency[1].slice(0, 12) && 'shaPrefix',
          (row.requested_workspace !== workspace[label] || row.requested_role !== role[label]) && 'workspaceRole',
        ].filter(Boolean);
        if (flags.length === 0) counts.exact += 1;
        if (flags.length > 1) counts.multiMismatch += 1;
        if (flags.includes('run')) counts.runMismatch += 1;
        if (flags.includes('correlationLabel')) counts.correlationLabelMismatch += 1;
        if (flags.includes('idempotencyLabel')) counts.idempotencyLabelMismatch += 1;
        if (flags.includes('shaPrefix')) counts.shaPrefixMismatch += 1;
        if (flags.includes('workspaceRole')) counts.workspaceRoleMismatch += 1;
      }
      return counts;
    });

    console.log('P0_STALE_FC_CLASSIFY_RESULT=PASS');
    console.log(`P0_STALE_FC_CLASSIFY_TOTAL=${summary.total}`);
    console.log(`P0_STALE_FC_CLASSIFY_EXACT_CURRENT=${summary.exact}`);
    console.log(`P0_STALE_FC_CLASSIFY_FORMAT_INVALID=${summary.formatInvalid}`);
    console.log(`P0_STALE_FC_CLASSIFY_RUN_TOKEN_MISMATCH=${summary.runMismatch}`);
    console.log(`P0_STALE_FC_CLASSIFY_CORRELATION_LABEL_MISMATCH=${summary.correlationLabelMismatch}`);
    console.log(`P0_STALE_FC_CLASSIFY_IDEMPOTENCY_LABEL_MISMATCH=${summary.idempotencyLabelMismatch}`);
    console.log(`P0_STALE_FC_CLASSIFY_SHA_PREFIX_MISMATCH=${summary.shaPrefixMismatch}`);
    console.log(`P0_STALE_FC_CLASSIFY_WORKSPACE_ROLE_MISMATCH=${summary.workspaceRoleMismatch}`);
    console.log(`P0_STALE_FC_CLASSIFY_MULTI_MISMATCH=${summary.multiMismatch}`);
    console.log(`P0_STALE_FC_CLASSIFY_REL_CORRELATION_ATTEMPT_ONLY=${summary.relationCorrelationAttemptOnly}`);
    console.log(`P0_STALE_FC_CLASSIFY_REL_IDEMPOTENCY_ATTEMPT_ONLY=${summary.relationIdempotencyAttemptOnly}`);
    console.log(`P0_STALE_FC_CLASSIFY_REL_SAME_RUN_DIFFERENT_ATTEMPT=${summary.relationSameRunDifferentAttempt}`);
    console.log(`P0_STALE_FC_CLASSIFY_REL_DIFFERENT_GITHUB_RUN=${summary.relationDifferentGithubRun}`);
    console.log(`P0_STALE_FC_CLASSIFY_REL_NON_GITHUB_SHAPE=${summary.relationNonGithubShape}`);
    console.log(`P0_STALE_FC_CLASSIFY_REL_OTHER_SAME_RUN=${summary.relationOtherSameRun}`);
    console.log('P0_STALE_FC_CLASSIFY_PRODUCTION_MUTATION=NONE');
    console.log('P0_STALE_FC_CLASSIFY_RAW_IDENTIFIERS=0');
  } catch (error) {
    const code = /^[A-Z0-9_]{4,96}$/.test(String(error?.message || ''))
      ? String(error.message)
      : 'READ_ONLY_CLASSIFIER_FAILED';
    console.log('P0_STALE_FC_CLASSIFY_RESULT=FAIL');
    console.log(`P0_STALE_FC_CLASSIFY_BLOCKER=${code}`);
    console.log('P0_STALE_FC_CLASSIFY_PRODUCTION_MUTATION=NONE');
    console.log('P0_STALE_FC_CLASSIFY_RAW_IDENTIFIERS=0');
    process.exitCode = 1;
  } finally {
    await prisma.onModuleDestroy().catch(() => {});
  }
}

main();
