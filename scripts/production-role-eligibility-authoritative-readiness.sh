#!/usr/bin/env bash
set -Eeuo pipefail
set +x

TARGET_SHA="${1:-}"

fail() {
  printf 'ROLE_ELIGIBILITY_READINESS_REPORT=FAIL\nERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 2
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 3

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING 11
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
api_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_image_id")"
[[ "$api_revision" == "$TARGET_SHA" ]] || fail API_IMAGE_REVISION_MISMATCH 12

worker_id="$(docker inspect --format '{{.Id}}' pc-role-eligibility-worker 2>/dev/null || true)"
[[ "$worker_id" =~ ^[0-9a-f]{64}$ ]] || fail WORKER_NOT_FOUND 13
[[ "$(docker inspect --format '{{.State.Running}}' "$worker_id")" == true ]] || fail WORKER_NOT_RUNNING 14
worker_image_id="$(docker inspect --format '{{.Image}}' "$worker_id")"
worker_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$worker_image_id")"
[[ "$worker_revision" == "$TARGET_SHA" ]] || fail WORKER_IMAGE_REVISION_MISMATCH 15

readarray -t worker_flags < <(docker inspect "$worker_id" | python3 -c '
import json,sys
obj=json.load(sys.stdin)[0]
env=dict(x.split("=",1) for x in obj.get("Config",{}).get("Env",[]) if "=" in x)
for key in ("RUNTIME_COMPONENT","ROLE_ELIGIBILITY_ENABLED","ROLE_ELIGIBILITY_SHADOW_MODE","ROLE_ELIGIBILITY_ENFORCEMENT"):
    print(env.get(key,""))
')
[[ "${worker_flags[0]:-}" == role-eligibility-worker ]] || fail WORKER_RUNTIME_COMPONENT_INVALID 16
[[ "${worker_flags[1]:-}" == true ]] || fail WORKER_DISABLED 17
[[ "${worker_flags[2]:-}" == true ]] || fail WORKER_NOT_SHADOW 18
[[ "${worker_flags[3]:-}" == false ]] || fail ENFORCEMENT_MUST_REMAIN_FALSE 19

printf 'ROLE_ELIGIBILITY_TARGET_SHA=%s\n' "$TARGET_SHA" >&2
printf 'ROLE_ELIGIBILITY_SHADOW_MODE=true\n' >&2
printf 'ROLE_ELIGIBILITY_ENFORCEMENT=false\n' >&2
printf 'PRODUCTION_DATABASE_MUTATION=0\n' >&2

# The application runtime principal already has bounded SELECT authority over
# eligibility.*. This exact-SHA report executes inside one REPEATABLE READ,
# READ ONLY transaction and emits aggregates only. It never queries auth/public
# registration data and never serializes organization/application identifiers.
#
# Authoritative evidence readiness is intentionally narrower than raw shadow
# corpus size: a current check with an invalid INN checksum cannot be matched to
# an official legal-entity authority and therefore cannot count toward the
# authoritative evidence denominator. Such rows remain durable history and are
# reported separately; nothing is deleted, rewritten, or treated as a negative
# legal assertion.
docker exec -i "$api_id" /nodejs/bin/node - <<'NODE'
'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

const asCount = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('INVALID_AGGREGATE_COUNT');
  return parsed;
};

const mapCounts = (rows, fields) => rows.map((row) => {
  const out = {};
  for (const field of fields) out[field] = row[field];
  out.count = asCount(row.count);
  return out;
});

const forbiddenOutputKey = /(?:^|_)(?:inn|ogrn|kpp|legal_name|tenant_id|organization_id|application_id|email|phone|password|secret|token)(?:$|_)/i;
const assertSafeShape = (value) => {
  if (Array.isArray(value)) {
    for (const item of value) assertSafeShape(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenOutputKey.test(key)) throw new Error('PII_OUTPUT_KEY_FORBIDDEN');
    assertSafeShape(child);
  }
};

const currentCorpusCte = `
  WITH current_corpus AS (
    SELECT
      v.id AS verdict_id,
      v.check_id,
      v.requested_role AS role,
      v.verdict,
      CASE
        WHEN c.inn ~ '^[0-9]{10}$' THEN
          mod(mod(
            2 * substr(c.inn,1,1)::int +
            4 * substr(c.inn,2,1)::int +
            10 * substr(c.inn,3,1)::int +
            3 * substr(c.inn,4,1)::int +
            5 * substr(c.inn,5,1)::int +
            9 * substr(c.inn,6,1)::int +
            4 * substr(c.inn,7,1)::int +
            6 * substr(c.inn,8,1)::int +
            8 * substr(c.inn,9,1)::int
          ,11),10) = substr(c.inn,10,1)::int
        WHEN c.inn ~ '^[0-9]{12}$' THEN
          mod(mod(
            7 * substr(c.inn,1,1)::int +
            2 * substr(c.inn,2,1)::int +
            4 * substr(c.inn,3,1)::int +
            10 * substr(c.inn,4,1)::int +
            3 * substr(c.inn,5,1)::int +
            5 * substr(c.inn,6,1)::int +
            9 * substr(c.inn,7,1)::int +
            4 * substr(c.inn,8,1)::int +
            6 * substr(c.inn,9,1)::int +
            8 * substr(c.inn,10,1)::int
          ,11),10) = substr(c.inn,11,1)::int
          AND
          mod(mod(
            3 * substr(c.inn,1,1)::int +
            7 * substr(c.inn,2,1)::int +
            2 * substr(c.inn,3,1)::int +
            4 * substr(c.inn,4,1)::int +
            10 * substr(c.inn,5,1)::int +
            3 * substr(c.inn,6,1)::int +
            5 * substr(c.inn,7,1)::int +
            9 * substr(c.inn,8,1)::int +
            4 * substr(c.inn,9,1)::int +
            6 * substr(c.inn,10,1)::int +
            8 * substr(c.inn,11,1)::int
          ,11),10) = substr(c.inn,12,1)::int
        ELSE FALSE
      END AS identifier_checksum_valid
    FROM eligibility.verdicts AS v
    INNER JOIN eligibility.organization_checks AS c ON c.id = v.check_id
    WHERE v.is_current
  )
`;

(async () => {
  const report = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8000ms'");

    const modeRows = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    if (modeRows?.[0]?.mode !== 'on') throw new Error('READ_ONLY_TRANSACTION_NOT_ACTIVE');

    const totalsRows = await tx.$queryRawUnsafe(`
      SELECT
        (SELECT count(*)::text FROM eligibility.organization_checks) AS checks,
        (SELECT count(*)::text FROM eligibility.verdicts WHERE is_current) AS current_verdicts,
        (SELECT count(*)::text FROM eligibility.evidence) AS evidence_records,
        (SELECT count(*)::text FROM eligibility.verdict_sources) AS verdict_source_links,
        (SELECT count(*)::text FROM eligibility.source_health) AS source_health_rows
    `);

    const authoritativeTotalsRows = await tx.$queryRawUnsafe(`${currentCorpusCte}
      SELECT
        count(*) FILTER (WHERE identifier_checksum_valid)::text AS authoritative_current_verdicts,
        count(*) FILTER (WHERE NOT identifier_checksum_valid)::text AS excluded_current_verdicts
      FROM current_corpus
    `);

    const authoritativeEvidenceRows = await tx.$queryRawUnsafe(`${currentCorpusCte}
      SELECT count(DISTINCT e.id)::text AS authoritative_evidence_records
      FROM current_corpus AS c
      INNER JOIN eligibility.evidence AS e ON e.check_id = c.check_id
      WHERE c.identifier_checksum_valid
    `);

    const verdictRows = await tx.$queryRawUnsafe(`
      SELECT requested_role AS role, verdict, count(*)::text AS count
      FROM eligibility.verdicts
      WHERE is_current
      GROUP BY requested_role, verdict
      ORDER BY requested_role, verdict
    `);

    const corpusRows = await tx.$queryRawUnsafe(`${currentCorpusCte}
      SELECT
        role,
        CASE WHEN identifier_checksum_valid
          THEN 'AUTHORITATIVE_IDENTIFIER'
          ELSE 'EXCLUDED_INVALID_IDENTIFIER_CHECKSUM'
        END AS identifier_class,
        verdict,
        count(*)::text AS count
      FROM current_corpus
      GROUP BY role, identifier_checksum_valid, verdict
      ORDER BY role, identifier_checksum_valid DESC, verdict
    `);

    const unresolvedRows = await tx.$queryRawUnsafe(`
      SELECT requested_role AS role, verdict, count(*)::text AS count
      FROM eligibility.verdicts
      WHERE is_current
        AND verdict IN ('REVIEW_REQUIRED','APPARENT_MISMATCH','SOURCE_UNAVAILABLE','STALE','ERROR')
      GROUP BY requested_role, verdict
      ORDER BY requested_role, verdict
    `);

    const coverageRows = await tx.$queryRawUnsafe(`
      SELECT v.requested_role AS role, vs.source,
             count(DISTINCT v.id)::text AS verdict_count,
             count(vs.evidence_id)::text AS evidence_links
      FROM eligibility.verdicts AS v
      INNER JOIN eligibility.verdict_sources AS vs ON vs.verdict_id = v.id
      WHERE v.is_current
      GROUP BY v.requested_role, vs.source
      ORDER BY v.requested_role, vs.source
    `);

    const authoritativeCoverageRows = await tx.$queryRawUnsafe(`${currentCorpusCte}
      SELECT c.role, vs.source,
             count(DISTINCT c.verdict_id)::text AS verdict_count,
             count(vs.evidence_id)::text AS evidence_links
      FROM current_corpus AS c
      INNER JOIN eligibility.verdict_sources AS vs ON vs.verdict_id = c.verdict_id
      WHERE c.identifier_checksum_valid
      GROUP BY c.role, vs.source
      ORDER BY c.role, vs.source
    `);

    const noSourceRows = await tx.$queryRawUnsafe(`
      SELECT v.requested_role AS role, v.verdict, count(*)::text AS count
      FROM eligibility.verdicts AS v
      WHERE v.is_current
        AND NOT EXISTS (
          SELECT 1 FROM eligibility.verdict_sources AS vs WHERE vs.verdict_id = v.id
        )
      GROUP BY v.requested_role, v.verdict
      ORDER BY v.requested_role, v.verdict
    `);

    const authoritativeNoSourceRows = await tx.$queryRawUnsafe(`${currentCorpusCte}
      SELECT c.role, c.verdict, count(*)::text AS count
      FROM current_corpus AS c
      WHERE c.identifier_checksum_valid
        AND NOT EXISTS (
          SELECT 1 FROM eligibility.verdict_sources AS vs WHERE vs.verdict_id = c.verdict_id
        )
      GROUP BY c.role, c.verdict
      ORDER BY c.role, c.verdict
    `);

    const sourceHealthRows = await tx.$queryRawUnsafe(`
      SELECT source, status, circuit_state, last_error_code,
             CASE
               WHEN fresh_until IS NULL THEN 'UNKNOWN'
               WHEN fresh_until > clock_timestamp() THEN 'FRESH'
               ELSE 'STALE'
             END AS freshness,
             consecutive_failures::text AS consecutive_failures
      FROM eligibility.source_health
      ORDER BY source
    `);

    const policyRows = await tx.$queryRawUnsafe(`
      SELECT policy_version, count(*)::text AS count
      FROM eligibility.verdicts
      WHERE is_current
      GROUP BY policy_version
      ORDER BY policy_version
    `);

    const integrityRows = await tx.$queryRawUnsafe(`
      SELECT
        (
          SELECT count(*)::text
          FROM eligibility.verdicts AS v
          INNER JOIN eligibility.organization_checks AS c ON c.id = v.check_id
          WHERE v.is_current AND c.status <> v.verdict
        ) AS current_status_mismatch,
        (
          SELECT count(*)::text
          FROM eligibility.verdict_sources AS vs
          INNER JOIN eligibility.verdicts AS v ON v.id = vs.verdict_id
          INNER JOIN eligibility.evidence AS e ON e.id = vs.evidence_id
          WHERE v.check_id <> e.check_id
        ) AS source_check_mismatch
    `);

    const totals = totalsRows[0] ?? {};
    const authoritativeTotals = authoritativeTotalsRows[0] ?? {};
    const authoritativeEvidence = authoritativeEvidenceRows[0] ?? {};
    const integrity = integrityRows[0] ?? {};
    const currentStatusMismatch = asCount(integrity.current_status_mismatch ?? '0');
    const sourceCheckMismatch = asCount(integrity.source_check_mismatch ?? '0');
    const currentVerdicts = asCount(totals.current_verdicts ?? '0');
    const authoritativeCurrentVerdicts = asCount(authoritativeTotals.authoritative_current_verdicts ?? '0');
    const excludedCurrentVerdicts = asCount(authoritativeTotals.excluded_current_verdicts ?? '0');
    const authoritativeEvidenceRecords = asCount(authoritativeEvidence.authoritative_evidence_records ?? '0');

    if (authoritativeCurrentVerdicts + excludedCurrentVerdicts !== currentVerdicts) {
      throw new Error('AUTHORITATIVE_CORPUS_CARDINALITY_MISMATCH');
    }

    return {
      schemaVersion: 'role-eligibility-authoritative-corpus.v1',
      transactionMode: 'READ_ONLY',
      shadowMode: true,
      enforcement: false,
      readinessDecision: currentStatusMismatch > 0 || sourceCheckMismatch > 0
        ? 'BLOCKED_INTEGRITY'
        : currentVerdicts === 0
          ? 'INSUFFICIENT_CORPUS'
          : authoritativeCurrentVerdicts === 0
            ? 'INSUFFICIENT_AUTHORITATIVE_CORPUS'
            : 'MEASURED_NOT_AUTHORIZED',
      totals: {
        checks: asCount(totals.checks ?? '0'),
        currentVerdicts,
        evidenceRecords: asCount(totals.evidence_records ?? '0'),
        verdictSourceLinks: asCount(totals.verdict_source_links ?? '0'),
        sourceHealthRows: asCount(totals.source_health_rows ?? '0'),
      },
      authoritativeEvidenceReadiness: {
        currentVerdicts: authoritativeCurrentVerdicts,
        excludedCurrentVerdicts,
        authoritativeEvidenceRecords,
        exclusionReason: 'INVALID_IDENTIFIER_CHECKSUM',
        absenceSemantics: 'EXCLUSION_IS_NOT_NEGATIVE_LEGAL_ENTITY_EVIDENCE',
      },
      corpusByRole: mapCounts(corpusRows, ['role', 'identifier_class', 'verdict']),
      verdictsByRole: mapCounts(verdictRows, ['role', 'verdict']),
      unresolvedByRole: mapCounts(unresolvedRows, ['role', 'verdict']),
      sourceCoverageByRole: coverageRows.map((row) => ({
        role: row.role,
        source: row.source,
        verdictCount: asCount(row.verdict_count),
        evidenceLinks: asCount(row.evidence_links),
      })),
      authoritativeSourceCoverageByRole: authoritativeCoverageRows.map((row) => ({
        role: row.role,
        source: row.source,
        verdictCount: asCount(row.verdict_count),
        evidenceLinks: asCount(row.evidence_links),
      })),
      currentWithoutSourceLinks: mapCounts(noSourceRows, ['role', 'verdict']),
      authoritativeCurrentWithoutSourceLinks: mapCounts(authoritativeNoSourceRows, ['role', 'verdict']),
      sourceHealth: sourceHealthRows.map((row) => ({
        source: row.source,
        status: row.status,
        circuitState: row.circuit_state,
        freshness: row.freshness,
        consecutiveFailures: asCount(row.consecutive_failures),
        errorCode: row.last_error_code,
      })),
      policyVersions: mapCounts(policyRows, ['policy_version']),
      integrity: {
        currentStatusMismatch,
        sourceCheckMismatch,
      },
    };
  }, {
    isolationLevel: 'RepeatableRead',
    timeout: 20000,
  });

  assertSafeShape(report);
  process.stdout.write(`${JSON.stringify(report)}\n`);
})()
  .catch(() => {
    process.stderr.write('ROLE_ELIGIBILITY_READINESS_QUERY_FAILED\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE

[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_CHANGED_DURING_REPORT 30
[[ "$(docker inspect --format '{{.State.Running}}' "$worker_id")" == true ]] || fail WORKER_CHANGED_DURING_REPORT 31
[[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$api_id")")" == "$TARGET_SHA" ]] || fail API_REVISION_CHANGED_DURING_REPORT 32
[[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$worker_id")")" == "$TARGET_SHA" ]] || fail WORKER_REVISION_CHANGED_DURING_REPORT 33

printf 'ROLE_ELIGIBILITY_READINESS_REPORT=PASS\n' >&2
printf 'REGISTRATION_RUNTIME_UNCHANGED=PASS\n' >&2
printf 'PRODUCTION_DATABASE_MUTATION=0\n' >&2
