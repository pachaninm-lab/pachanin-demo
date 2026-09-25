#!/usr/bin/env bash
set -Eeuo pipefail
set +x

fail() {
  printf 'ROLE_ELIGIBILITY_CORPUS_PROVENANCE=FAIL\nERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 2
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING 11
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
api_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_image_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || fail API_REVISION_INVALID 12

worker_id="$(docker inspect --format '{{.Id}}' pc-role-eligibility-worker 2>/dev/null || true)"
[[ "$worker_id" =~ ^[0-9a-f]{64}$ ]] || fail WORKER_NOT_FOUND 13
[[ "$(docker inspect --format '{{.State.Running}}' "$worker_id")" == true ]] || fail WORKER_NOT_RUNNING 14
worker_image_id="$(docker inspect --format '{{.Image}}' "$worker_id")"
worker_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$worker_image_id")"
[[ "$worker_revision" == "$api_revision" ]] || fail API_WORKER_REVISION_MISMATCH 15

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

printf 'ROLE_ELIGIBILITY_DEPLOYED_SHA=%s\n' "$api_revision" >&2
printf 'ROLE_ELIGIBILITY_SHADOW_MODE=true\n' >&2
printf 'ROLE_ELIGIBILITY_ENFORCEMENT=false\n' >&2
printf 'PRODUCTION_DATABASE_MUTATION=0\n' >&2

docker exec -i "$api_id" /nodejs/bin/node - <<'NODE'
'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

const asInt = (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('INVALID_COUNT');
  return n;
};
const inn10 = (s) => {
  if (!/^\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  const w = [2,4,10,3,5,9,4,6,8];
  const c = w.reduce((a,v,i) => a + v*d[i], 0) % 11 % 10;
  return c === d[9];
};
const inn12 = (s) => {
  if (!/^\d{12}$/.test(s)) return false;
  const d = [...s].map(Number);
  const w11 = [7,2,4,10,3,5,9,4,6,8];
  const w12 = [3,7,2,4,10,3,5,9,4,6,8];
  const c11 = w11.reduce((a,v,i) => a + v*d[i], 0) % 11 % 10;
  const c12 = w12.reduce((a,v,i) => a + v*d[i], 0) % 11 % 10;
  return c11 === d[10] && c12 === d[11];
};
const validInn = (s) => inn10(s) || inn12(s);
const fixtureMarker = /(?:^|[_-])(?:test|smoke|load|race|e2e|accept|fixture|probe|synthetic|demo)(?:[_-]|$)/i;

(async () => {
  const report = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10000ms'");
    const mode = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    if (mode?.[0]?.mode !== 'on') throw new Error('READ_ONLY_TRANSACTION_NOT_ACTIVE');

    const current = await tx.$queryRawUnsafe(`
      SELECT v.requested_role AS role, v.verdict, c.inn, c.application_id, c.organization_id
      FROM eligibility.verdicts AS v
      INNER JOIN eligibility.organization_checks AS c ON c.id = v.check_id
      WHERE v.is_current
      ORDER BY v.requested_role, v.id
    `);
    const totals = await tx.$queryRawUnsafe(`
      SELECT
        count(*)::int AS checks,
        count(DISTINCT (application_id, application_version, requested_role))::int AS logical_checks
      FROM eligibility.organization_checks
    `);
    const multiplicity = await tx.$queryRawUnsafe(`
      SELECT check_count, count(*)::int AS logical_count
      FROM (
        SELECT application_id, application_version, requested_role, count(*)::int AS check_count
        FROM eligibility.organization_checks
        GROUP BY application_id, application_version, requested_role
      ) AS q
      GROUP BY check_count
      ORDER BY check_count
    `);
    const batches = await tx.$queryRawUnsafe(`
      SELECT date_trunc('minute', created_at) AS bucket, count(*)::int AS count
      FROM eligibility.organization_checks
      GROUP BY date_trunc('minute', created_at)
      ORDER BY bucket
    `);

    const subjects = new Set();
    let formatInvalid = 0;
    let checksumValid = 0;
    let checksumInvalid = 0;
    let applicationMarkerRows = 0;
    let organizationMarkerRows = 0;
    const roleMap = new Map();
    for (const row of current) {
      const value = String(row.inn || '');
      subjects.add(value);
      const formatOk = /^(?:\d{10}|\d{12})$/.test(value);
      if (!formatOk) formatInvalid += 1;
      else if (validInn(value)) checksumValid += 1;
      else checksumInvalid += 1;
      if (fixtureMarker.test(String(row.application_id || ''))) applicationMarkerRows += 1;
      if (fixtureMarker.test(String(row.organization_id || ''))) organizationMarkerRows += 1;
      const role = String(row.role || 'UNKNOWN');
      const bucket = roleMap.get(role) || { rows: 0, subjects: new Set(), checksumInvalid: 0, verdicts: new Map() };
      bucket.rows += 1;
      bucket.subjects.add(value);
      if (formatOk && !validInn(value)) bucket.checksumInvalid += 1;
      const verdict = String(row.verdict || 'UNKNOWN');
      bucket.verdicts.set(verdict, (bucket.verdicts.get(verdict) || 0) + 1);
      roleMap.set(role, bucket);
    }

    const perRole = [...roleMap.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([role, x]) => ({
      role,
      currentRows: x.rows,
      uniqueSubjects: x.subjects.size,
      checksumInvalidRows: x.checksumInvalid,
      verdicts: [...x.verdicts.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([verdict,count]) => ({ verdict, count })),
    }));
    const structuralFixtureSignals = applicationMarkerRows + organizationMarkerRows + checksumInvalid + formatInvalid;
    return {
      schemaVersion: 'role-eligibility-corpus-provenance.v1',
      transactionMode: 'READ_ONLY',
      productionDatabaseMutation: 0,
      currentRows: current.length,
      totalChecks: asInt(totals?.[0]?.checks ?? 0),
      logicalChecks: asInt(totals?.[0]?.logical_checks ?? 0),
      identifierQuality: {
        uniqueSubjects: subjects.size,
        repeatedCurrentRows: current.length - subjects.size,
        formatInvalidRows: formatInvalid,
        checksumValidRows: checksumValid,
        checksumInvalidRows: checksumInvalid,
      },
      structuralFixtureSignals: {
        applicationMarkerRows,
        organizationMarkerRows,
        totalSignalRows: structuralFixtureSignals,
      },
      checkMultiplicity: multiplicity.map((r) => ({ checkCount: asInt(r.check_count), logicalCount: asInt(r.logical_count) })),
      checkBatches: batches.map((r) => ({ bucket: new Date(r.bucket).toISOString(), count: asInt(r.count) })),
      perRole,
      diagnosticDecision: structuralFixtureSignals > 0 ? 'STRUCTURAL_FIXTURE_SIGNAL_PRESENT' : 'NO_STRUCTURAL_FIXTURE_SIGNAL',
      decisionSemantics: 'Absence of structural fixture signals does not prove that a subject is a real active legal entity; it only removes the tested local fixture/checksum explanations.',
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 20000 });

  const forbidden = /(?:^|_)(?:inn|ogrn|kpp|legal_name|tenant_id|organization_id|application_id|email|phone|password|secret|token)(?:$|_)/i;
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    for (const [k,c] of Object.entries(v)) {
      if (forbidden.test(k)) throw new Error('PII_OUTPUT_KEY_FORBIDDEN');
      walk(c);
    }
  };
  walk(report);
  process.stdout.write(`${JSON.stringify(report)}\n`);
})().catch(() => {
  process.stderr.write('ROLE_ELIGIBILITY_CORPUS_PROVENANCE_QUERY_FAILED\n');
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
NODE

[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_CHANGED_DURING_DIAGNOSTIC 30
[[ "$(docker inspect --format '{{.State.Running}}' "$worker_id")" == true ]] || fail WORKER_CHANGED_DURING_DIAGNOSTIC 31
[[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$api_id")")" == "$api_revision" ]] || fail API_REVISION_CHANGED_DURING_DIAGNOSTIC 32
[[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$worker_id")")" == "$worker_revision" ]] || fail WORKER_REVISION_CHANGED_DURING_DIAGNOSTIC 33

printf 'ROLE_ELIGIBILITY_CORPUS_PROVENANCE=PASS\n' >&2
printf 'REGISTRATION_RUNTIME_UNCHANGED=PASS\n' >&2
printf 'PRODUCTION_DATABASE_MUTATION=0\n' >&2
