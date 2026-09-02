#!/usr/bin/env bash
set -Eeuo pipefail
set +x

EXPECTED_MAIN_SHA="${1:-}"

fail() {
  printf 'PRODUCTION_DB_PRINCIPAL_OBSERVATION=FAIL\nERROR_CODE=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$EXPECTED_MAIN_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_EXPECTED_MAIN_SHA 2
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 3

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING 11
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
api_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_image_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || fail API_IMAGE_REVISION_INVALID 12

printf 'OBSERVER_MAIN_SHA=%s\n' "$EXPECTED_MAIN_SHA" >&2
printf 'PRODUCTION_API_REVISION=%s\n' "$api_revision" >&2
printf 'PRODUCTION_DATABASE_MUTATION=0\n' >&2

# Read the role that the API is actually using. The query runs through the
# API's own Prisma connection inside a REPEATABLE READ / READ ONLY transaction.
# It never reads DATABASE_URL, application data, tenant data, or credentials.
docker exec -i "$api_id" /nodejs/bin/node - "$api_revision" <<'NODE'
'use strict';

const { PrismaClient } = require('@prisma/client');
const apiRevision = process.argv[2];
const prisma = new PrismaClient({ log: [] });

const asCount = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('INVALID_COUNT');
  return parsed;
};

(async () => {
  const report = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8000ms'");

    const modeRows = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    if (modeRows?.[0]?.mode !== 'on') throw new Error('READ_ONLY_TRANSACTION_NOT_ACTIVE');

    const roleRows = await tx.$queryRawUnsafe(`
      SELECT
        current_user AS principal,
        rolsuper,
        rolbypassrls,
        rolcreatedb,
        rolcreaterole,
        rolreplication
      FROM pg_catalog.pg_roles
      WHERE rolname = current_user
    `);
    if (!Array.isArray(roleRows) || roleRows.length !== 1) throw new Error('CURRENT_ROLE_NOT_UNIQUE');
    const role = roleRows[0];

    // Match the latent privilege shape checked by the production deploy gate:
    // membership is MEMBER rather than USAGE because NOINHERIT can still SET ROLE.
    const membershipRows = await tx.$queryRawUnsafe(`
      SELECT count(*)::text AS count
      FROM pg_catalog.pg_roles AS granted
      WHERE (granted.rolsuper OR granted.rolbypassrls)
        AND granted.rolname <> current_user
        AND pg_catalog.pg_has_role(current_user, granted.oid, 'MEMBER')
    `);

    // Table owners bypass RLS unless FORCE ROW LEVEL SECURITY is active.
    const ownershipRows = await tx.$queryRawUnsafe(`
      SELECT count(*)::text AS count
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS schema ON schema.oid = relation.relnamespace
      JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
      WHERE schema.nspname NOT IN ('pg_catalog','information_schema')
        AND schema.nspname NOT LIKE 'pg_toast%'
        AND relation.relkind IN ('r','p')
        AND relation.relrowsecurity
        AND NOT relation.relforcerowsecurity
        AND owner.rolname = current_user
    `);

    const dangerousMembershipCount = asCount(membershipRows?.[0]?.count ?? '0');
    const unforcedRlsOwnedTableCount = asCount(ownershipRows?.[0]?.count ?? '0');
    const deployGateConfined =
      role.rolsuper === false &&
      role.rolbypassrls === false &&
      dangerousMembershipCount === 0 &&
      unforcedRlsOwnedTableCount === 0;
    const issue4890AcceptanceReady =
      role.principal === 'pc_app' &&
      deployGateConfined &&
      role.rolcreatedb === false &&
      role.rolcreaterole === false &&
      role.rolreplication === false;

    return {
      schemaVersion: 'pc-crop.production-db-principal-observation.v1',
      transactionMode: 'READ_ONLY',
      apiRevision,
      principal: String(role.principal),
      flags: {
        superuser: Boolean(role.rolsuper),
        bypassRls: Boolean(role.rolbypassrls),
        createDb: Boolean(role.rolcreatedb),
        createRole: Boolean(role.rolcreaterole),
        replication: Boolean(role.rolreplication),
      },
      dangerousMembershipCount,
      unforcedRlsOwnedTableCount,
      deployGateConfined,
      issue4890AcceptanceReady,
      productionDatabaseMutation: 0,
    };
  }, {
    isolationLevel: 'RepeatableRead',
    timeout: 20000,
  });

  process.stdout.write(`${JSON.stringify(report)}\n`);
})()
  .catch((error) => {
    process.stderr.write(`PRODUCTION_DB_PRINCIPAL_QUERY_FAILED:${error?.message || 'UNKNOWN'}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE

[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_CHANGED_DURING_OBSERVATION 20
[[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$api_id")")" == "$api_revision" ]] || fail API_REVISION_CHANGED_DURING_OBSERVATION 21

printf 'PRODUCTION_DB_PRINCIPAL_OBSERVATION=PASS\n' >&2
printf 'PRODUCTION_DATABASE_MUTATION=0\n' >&2
