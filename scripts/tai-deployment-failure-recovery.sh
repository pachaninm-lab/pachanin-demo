#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
OUTPUT_FILE="${3:-}"
ORIGINAL_RC="${4:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'INVALID_TARGET_SHA' >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || { echo 'INVALID_RUN_ID' >&2; exit 2; }
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/deployment-recovery.json" ]] \
  || { echo 'INVALID_OUTPUT_PATH' >&2; exit 2; }
[[ "$ORIGINAL_RC" =~ ^[1-9][0-9]{0,2}$ ]] || { echo 'INVALID_ORIGINAL_EXIT_CODE' >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'ROOT_AUTHORITY_REQUIRED' >&2; exit 2; }

readonly STATE_ROOT="/var/lib/pc-release-authority/tai-agro-os-${RUN_ID}"
readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'
readonly ROLE_NAME='tai_runtime'
readonly JOB_OUTPUT="${OUTPUT_FILE%/*}"

install -d -m 0750 -o root -g pcactions "$JOB_OUTPUT"

STATUS='NO_RUNTIME_MUTATION'
BOUNDARY_JSON='{}'
TRANSACTION_COMMITTED=false
SERVICE_REMOVED=false
FILES_RESTORED=false
ROLE_REMOVED=false
PREVIOUS_SERVICE_RESTORED=false

write_evidence() {
  local passed="$1" error_code="${2:-}"
  python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$ORIGINAL_RC" "$STATUS" "$passed" \
    "$error_code" "$TRANSACTION_COMMITTED" "$SERVICE_REMOVED" "$FILES_RESTORED" \
    "$ROLE_REMOVED" "$PREVIOUS_SERVICE_RESTORED" "$BOUNDARY_JSON" <<'PY_EVIDENCE'
import grp, json, os, sys
(
    path, sha, run_id, original_rc, status, passed, error_code,
    transaction_committed, service_removed, files_restored,
    role_removed, previous_service_restored, boundary,
) = sys.argv[1:]
report = {
    'schemaVersion': 'tai.deployment-failure-recovery.v1',
    'targetSha': sha,
    'runId': run_id,
    'hosting': 'REG_RU_VPS_ONLY',
    'newRecurringCostRub': 0,
    'originalExitCode': int(original_rc),
    'status': status,
    'errorCode': error_code or None,
    'boundaryBefore': json.loads(boundary),
    'transactionCommitted': transaction_committed == 'true',
    'serviceRemoved': service_removed == 'true',
    'filesRestored': files_restored == 'true',
    'roleRemoved': role_removed == 'true',
    'previousServiceRestored': previous_service_restored == 'true',
    'dropOwnedUsed': False,
    'reassignOwnedUsed': False,
    'passed': passed == 'true',
}
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(report, handle, sort_keys=True, separators=(',', ':'))
    handle.write('\n')
os.chmod(path, 0o640)
os.chown(path, 0, grp.getgrnam('pcactions').gr_gid)
PY_EVIDENCE
}

fail_recovery() {
  local rc="$1" code="$2"
  STATUS='RECOVERY_FAILED'
  write_evidence false "$code"
  echo "$code" >&2
  exit "$rc"
}

confirm_original_failure_evidence() {
  local deployment="$JOB_OUTPUT/deployment.json"
  [[ -f "$deployment" && ! -L "$deployment" ]] || return 0
  python3 - "$deployment" "$TARGET_SHA" "$STATUS" <<'PY_DEPLOYMENT'
import grp, json, os, sys
path, sha, recovery_status = sys.argv[1:]
try:
    report = json.load(open(path, encoding='utf-8'))
except Exception:
    raise SystemExit(0)
if report.get('targetSha') != sha or report.get('passed') is not False:
    raise SystemExit(0)
report['rollbackStatus'] = 'CONFIRMED'
report['wrapperRecoveryStatus'] = recovery_status
report['wrapperRecoveryEvidence'] = 'deployment-recovery.json'
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(report, handle, sort_keys=True, separators=(',', ':'))
    handle.write('\n')
os.chmod(path, 0o640)
os.chown(path, 0, grp.getgrnam('pcactions').gr_gid)
PY_DEPLOYMENT
}

if [[ ! -d "$STATE_ROOT" ]]; then
  STATUS='NO_STATE_ROOT'
  write_evidence true
  confirm_original_failure_evidence
  echo 'TAI_DEPLOYMENT_RECOVERY_STATUS=NO_STATE_ROOT'
  echo 'TAI_DEPLOYMENT_RECOVERY_COMPLETE=1'
  exit 0
fi
[[ ! -L "$STATE_ROOT" && "$(stat -c '%U:%G:%a' "$STATE_ROOT")" == root:root:700 ]] \
  || fail_recovery 10 TAI_DEPLOYMENT_RECOVERY_STATE_ROOT_INVALID

if [[ -f "$STATE_ROOT/ROLLED_BACK" ]]; then
  STATUS='ALREADY_ROLLED_BACK'
  write_evidence true
  confirm_original_failure_evidence
  echo 'TAI_DEPLOYMENT_RECOVERY_STATUS=ALREADY_ROLLED_BACK'
  echo 'TAI_DEPLOYMENT_RECOVERY_COMPLETE=1'
  exit 0
fi

if [[ ! -f "$STATE_ROOT/MUTATION_STARTED" ]]; then
  STATUS='NO_RUNTIME_MUTATION'
  write_evidence true
  confirm_original_failure_evidence
  echo 'TAI_DEPLOYMENT_RECOVERY_STATUS=NO_RUNTIME_MUTATION'
  echo 'TAI_DEPLOYMENT_RECOVERY_COMPLETE=1'
  exit 0
fi

metadata="$STATE_ROOT/metadata.env"
[[ -f "$metadata" && ! -L "$metadata" && "$(stat -c '%U:%G:%a' "$metadata")" == root:root:600 ]] \
  || fail_recovery 11 TAI_DEPLOYMENT_RECOVERY_METADATA_INVALID
# shellcheck disable=SC1090
source "$metadata"

[[ "${TARGET_SHA:-}" == "$1" ]] || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_TARGET_MISMATCH
[[ "${PROD_DIR:-}" == /* && -d "$PROD_DIR" ]] || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_PROD_DIR_INVALID
[[ "${PROD_PROJECT:-}" =~ ^[A-Za-z0-9._-]+$ ]] || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_PROJECT_INVALID
[[ "${OVERRIDE:-}" == "$PROD_DIR/compose.tai-agro-os.override.yml" ]] \
  || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_OVERRIDE_PATH_INVALID
[[ "${DB_SERVICE:-}" =~ ^[A-Za-z0-9._-]+$ ]] || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_DB_SERVICE_INVALID
[[ "${DB_ADMIN:-}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_DB_ADMIN_INVALID
[[ "${DB_NAME:-}" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_DB_NAME_INVALID
[[ "${ROLE_CREATED:-}" =~ ^[01]$ && "${PREVIOUS_TAI:-}" =~ ^[01]$ ]] \
  || fail_recovery 12 TAI_DEPLOYMENT_RECOVERY_METADATA_BOUNDARY_INVALID

mapfile -t exact_web_ids < <(
  while IFS= read -r id; do
    revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
    [[ "$revision" == "$TARGET_SHA" ]] && printf '%s\n' "$id"
  done < <(docker ps -q --filter 'label=com.docker.compose.service=web')
)
(( ${#exact_web_ids[@]} == 1 )) || fail_recovery 13 TAI_DEPLOYMENT_RECOVERY_WEB_AUTHORITY_AMBIGUOUS
web_id="${exact_web_ids[0]}"
prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
project_from_runtime="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
working_dir_from_runtime="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
[[ "$project_from_runtime" == "$PROD_PROJECT" && "$working_dir_from_runtime" == "$PROD_DIR" && -n "$prod_files" ]] \
  || fail_recovery 13 TAI_DEPLOYMENT_RECOVERY_COMPOSE_AUTHORITY_MISMATCH

IFS=',' read -r -a raw_files <<< "$prod_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$PROD_DIR/$file"
  [[ "$file" == "$OVERRIDE" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail_recovery 13 TAI_DEPLOYMENT_RECOVERY_COMPOSE_FILES_MISSING
for file in "${compose_files[@]}"; do
  [[ -f "$file" && ! -L "$file" ]] || fail_recovery 13 TAI_DEPLOYMENT_RECOVERY_COMPOSE_FILE_INVALID
done

dc=(docker compose --project-directory "$PROD_DIR" --project-name "$PROD_PROJECT")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done

if [[ -f "$OVERRIDE" && ! -L "$OVERRIDE" ]]; then
  dc_current=("${dc[@]}" -f "$OVERRIDE")
  "${dc_current[@]}" rm -f -s -v tai >/dev/null 2>&1 || true
fi
mapfile -t residual_tai_ids < <(
  docker ps -aq \
    --filter "label=com.docker.compose.project=$PROD_PROJECT" \
    --filter 'label=com.docker.compose.service=tai'
)
if (( ${#residual_tai_ids[@]} > 0 )); then
  docker rm -f -v "${residual_tai_ids[@]}" >/dev/null
fi
SERVICE_REMOVED=true

restore_file() {
  local target="$1" base
  base="$(basename "$target")"
  if [[ -f "$STATE_ROOT/${base}.before" && ! -L "$STATE_ROOT/${base}.before" ]]; then
    install -m 0600 -o root -g root "$STATE_ROOT/${base}.before" "$target"
  elif [[ -f "$STATE_ROOT/${base}.absent" && ! -L "$STATE_ROOT/${base}.absent" ]]; then
    rm -f "$target"
  else
    return 1
  fi
}
restore_file "$OVERRIDE" || fail_recovery 14 TAI_DEPLOYMENT_RECOVERY_OVERRIDE_SNAPSHOT_MISSING
restore_file "$ENV_FILE" || fail_recovery 14 TAI_DEPLOYMENT_RECOVERY_ENV_SNAPSHOT_MISSING
FILES_RESTORED=true

mapfile -t db_ids < <("${dc[@]}" ps -q "$DB_SERVICE")
(( ${#db_ids[@]} == 1 )) || fail_recovery 15 TAI_DEPLOYMENT_RECOVERY_DB_AUTHORITY_AMBIGUOUS
DB_ID="${db_ids[0]}"
[[ "$DB_ID" =~ ^[0-9a-f]{12,64}$ ]] || fail_recovery 15 TAI_DEPLOYMENT_RECOVERY_DB_ID_INVALID
[[ "$(docker inspect --format '{{.State.Status}}' "$DB_ID")" == running ]] \
  || fail_recovery 15 TAI_DEPLOYMENT_RECOVERY_DB_NOT_RUNNING

psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}
admin_boundary="$(psql_admin -AtF $'\t' -c "SELECT rolsuper, rolcreaterole FROM pg_catalog.pg_roles WHERE rolname='${DB_ADMIN}';")"
[[ "$(printf '%s\n' "$admin_boundary" | grep -c .)" == 1 ]] \
  || fail_recovery 15 TAI_DEPLOYMENT_RECOVERY_DB_ADMIN_MISSING
IFS=$'\t' read -r admin_super admin_createrole <<< "$admin_boundary"
[[ "$admin_super" == t || "$admin_createrole" == t ]] \
  || fail_recovery 15 TAI_DEPLOYMENT_RECOVERY_DB_ADMIN_AUTHORITY_INVALID

role_exists="$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
[[ "$role_exists" == 0 || "$role_exists" == 1 ]] \
  || fail_recovery 16 TAI_DEPLOYMENT_RECOVERY_ROLE_AUTHORITY_AMBIGUOUS
if [[ "$ROLE_CREATED" == 1 && "$role_exists" == 1 ]]; then
  boundary="$(psql_admin -AtF $'\t' <<SQL
WITH role_row AS (
  SELECT oid, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
         rolreplication, rolbypassrls, rolconnlimit
  FROM pg_catalog.pg_roles
  WHERE rolname='${ROLE_NAME}'
), owned AS (
  SELECT
    (SELECT COUNT(*) FROM pg_catalog.pg_class WHERE relowner=role_row.oid)::bigint AS relations,
    (SELECT COUNT(*) FROM pg_catalog.pg_namespace WHERE nspowner=role_row.oid)::bigint AS schemas,
    (SELECT COUNT(*) FROM pg_catalog.pg_proc WHERE proowner=role_row.oid)::bigint AS functions,
    (SELECT COUNT(*) FROM pg_catalog.pg_type WHERE typowner=role_row.oid)::bigint AS types,
    (SELECT COUNT(*) FROM pg_catalog.pg_database WHERE datdba=role_row.oid)::bigint AS databases,
    (SELECT COUNT(*) FROM pg_catalog.pg_default_acl WHERE defaclrole=role_row.oid)::bigint AS default_acls
  FROM role_row
)
SELECT role_row.rolcanlogin, role_row.rolsuper, role_row.rolcreatedb,
       role_row.rolcreaterole, role_row.rolinherit, role_row.rolreplication,
       role_row.rolbypassrls, role_row.rolconnlimit,
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member=role_row.oid),
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE roleid=role_row.oid),
       (SELECT COUNT(*) FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}'),
       owned.relations, owned.schemas, owned.functions, owned.types,
       owned.databases, owned.default_acls
FROM role_row, owned;
SQL
)"
  [[ "$(printf '%s\n' "$boundary" | grep -c .)" == 1 ]] \
    || fail_recovery 16 TAI_DEPLOYMENT_RECOVERY_ROLE_BOUNDARY_QUERY_INVALID
  IFS=$'\t' read -r can_login super createdb createrole inherit replication bypass connlimit \
    memberships grants_to_others sessions owned_relations owned_schemas owned_functions \
    owned_types owned_databases owned_default_acls <<< "$boundary"
  BOUNDARY_JSON="$(python3 - "$can_login" "$super" "$createdb" "$createrole" "$inherit" \
    "$replication" "$bypass" "$connlimit" "$memberships" "$grants_to_others" "$sessions" \
    "$owned_relations" "$owned_schemas" "$owned_functions" "$owned_types" "$owned_databases" \
    "$owned_default_acls" <<'PY_BOUNDARY'
import json, sys
keys = [
    'canLogin','superuser','createdb','createrole','inherit','replication','bypassRls',
    'connectionLimit','membershipCount','memberGrantCount','activeSessionCount',
    'ownedRelationCount','ownedSchemaCount','ownedFunctionCount','ownedTypeCount',
    'ownedDatabaseCount','ownedDefaultAclCount',
]
values = sys.argv[1:]
parsed = []
for index, value in enumerate(values):
    if index < 7:
        parsed.append(value == 't')
    else:
        parsed.append(int(value))
print(json.dumps(dict(zip(keys, parsed)), sort_keys=True, separators=(',', ':')))
PY_BOUNDARY
)"
  [[ "$super" == f && "$createdb" == f && "$createrole" == f && "$inherit" == f \
     && "$replication" == f && "$bypass" == f && "$connlimit" == 20 ]] \
    || fail_recovery 17 TAI_DEPLOYMENT_RECOVERY_ROLE_ATTRIBUTES_INVALID
  [[ "$memberships" == 0 && "$grants_to_others" == 0 && "$sessions" == 0 ]] \
    || fail_recovery 17 TAI_DEPLOYMENT_RECOVERY_ROLE_RELATIONSHIP_INVALID
  [[ "$owned_relations" == 0 && "$owned_schemas" == 0 && "$owned_functions" == 0 \
     && "$owned_types" == 0 && "$owned_databases" == 0 && "$owned_default_acls" == 0 ]] \
    || fail_recovery 17 TAI_DEPLOYMENT_RECOVERY_ROLE_OWNERSHIP_INVALID

  psql_admin <<SQL
BEGIN;
ALTER ROLE ${ROLE_NAME} NOLOGIN;
SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I;',database.datname,'${ROLE_NAME}')
FROM pg_catalog.pg_database AS database
WHERE EXISTS (SELECT 1 FROM pg_catalog.aclexplode(database.datacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY database.datname
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM %I;',namespace.nspname,'${ROLE_NAME}')
FROM pg_catalog.pg_namespace AS namespace
WHERE EXISTS (SELECT 1 FROM pg_catalog.aclexplode(namespace.nspacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I;',namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE relation.relkind IN ('r','v','m','p','f')
  AND EXISTS (SELECT 1 FROM pg_catalog.aclexplode(relation.relacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, relation.relname
\gexec
SELECT format('REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM %I;',attribute.attname,namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_attribute AS attribute
JOIN pg_catalog.pg_class AS relation ON relation.oid=attribute.attrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE attribute.attnum>0 AND NOT attribute.attisdropped
  AND EXISTS (SELECT 1 FROM pg_catalog.aclexplode(attribute.attacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, relation.relname, attribute.attnum
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I;',namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE relation.relkind='S'
  AND EXISTS (SELECT 1 FROM pg_catalog.aclexplode(relation.relacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, relation.relname
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I;',procedure.oid::regprocedure,'${ROLE_NAME}')
FROM pg_catalog.pg_proc AS procedure
WHERE EXISTS (SELECT 1 FROM pg_catalog.aclexplode(procedure.proacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY procedure.oid::regprocedure::text
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON TYPE %I.%I FROM %I;',namespace.nspname,type_row.typname,'${ROLE_NAME}')
FROM pg_catalog.pg_type AS type_row
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=type_row.typnamespace
WHERE EXISTS (SELECT 1 FROM pg_catalog.aclexplode(type_row.typacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, type_row.typname
\gexec
DROP ROLE ${ROLE_NAME};
COMMIT;
SQL
  TRANSACTION_COMMITTED=true
  ROLE_REMOVED=true
elif [[ "$ROLE_CREATED" == 1 && "$role_exists" == 0 ]]; then
  ROLE_REMOVED=true
fi

if [[ "$PREVIOUS_TAI" == 1 ]]; then
  [[ -f "$OVERRIDE" && ! -L "$OVERRIDE" ]] \
    || fail_recovery 18 TAI_DEPLOYMENT_RECOVERY_PREVIOUS_OVERRIDE_MISSING
  dc_restored=("${dc[@]}" -f "$OVERRIDE")
  "${dc_restored[@]}" config --quiet
  "${dc_restored[@]}" up -d --no-deps --pull never tai
  PREVIOUS_SERVICE_RESTORED=true
fi

rm -f "$STATE_ROOT/MUTATION_STARTED"
touch "$STATE_ROOT/ROLLED_BACK"
STATUS='RECOVERED'
write_evidence true
confirm_original_failure_evidence

echo 'TAI_DEPLOYMENT_RECOVERY_STATUS=RECOVERED'
echo 'TAI_DEPLOYMENT_RECOVERY_COMPLETE=1'
