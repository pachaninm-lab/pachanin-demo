#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
OUTPUT_FILE="${3:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'INVALID_TARGET_SHA' >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || { echo 'INVALID_RUN_ID' >&2; exit 2; }
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/runtime-role-direct-grant-repair.json" ]] \
  || { echo 'INVALID_OUTPUT_PATH' >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'ROOT_AUTHORITY_REQUIRED' >&2; exit 2; }

readonly ROLE_NAME='tai_runtime'
readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'
readonly OUTPUT_DIR="${OUTPUT_FILE%/*}"

install -d -m 0700 -o root -g root "$OUTPUT_DIR"

MUTATION_ATTEMPTED=0
BOUNDARY_JSON='{}'
COMPOSE_PROJECT=''
DB_SERVICE=''
DB_NAME=''

write_evidence() {
  local status="$1" passed="$2" error_code="$3" mutation_attempted="$4" transaction_committed="$5"
  python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$status" "$passed" "$error_code" \
    "$mutation_attempted" "$transaction_committed" "$COMPOSE_PROJECT" "$DB_SERVICE" "$DB_NAME" "$BOUNDARY_JSON" <<'PY_EVIDENCE'
import json, os, sys
(
    path, sha, run_id, status, passed, error_code, mutation_attempted,
    transaction_committed, project, db_service, db_name, boundary,
) = sys.argv[1:]
report = {
    'schemaVersion': 'tai.runtime-role-direct-grant-repair.v1',
    'targetSha': sha,
    'runId': run_id,
    'hosting': 'REG_RU_VPS_ONLY',
    'newRecurringCostRub': 0,
    'status': status,
    'errorCode': error_code or None,
    'role': 'tai_runtime',
    'servicePresent': False,
    'environmentPresent': False,
    'overridePresent': False,
    'composeProject': project or None,
    'databaseService': db_service or None,
    'databaseName': db_name or None,
    'boundaryBefore': json.loads(boundary),
    'mutationAttempted': mutation_attempted == 'true',
    'transactionCommitted': transaction_committed == 'true',
    'dropOwnedUsed': False,
    'reassignOwnedUsed': False,
    'passed': passed == 'true',
}
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(report, handle, sort_keys=True, separators=(',', ':'))
    handle.write('\n')
os.chmod(path, 0o600)
PY_EVIDENCE
}

fail_with_evidence() {
  local rc="$1" code="$2" status="${3:-FAILED_NO_MUTATION}"
  write_evidence "$status" false "$code" "$([[ "$MUTATION_ATTEMPTED" == 1 ]] && echo true || echo false)" false
  echo "$code" >&2
  exit "$rc"
}

[[ ! -e "$ENV_FILE" && ! -L "$ENV_FILE" ]] \
  || fail_with_evidence 10 TAI_RUNTIME_DIRECT_REPAIR_ENV_PRESENT BLOCKED_ORPHAN_BOUNDARY

mapfile -t all_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
exact_web_ids=()
for id in "${all_web_ids[@]}"; do
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  [[ "$revision" == "$TARGET_SHA" ]] && exact_web_ids+=("$id")
done
(( ${#exact_web_ids[@]} == 1 )) \
  || fail_with_evidence 11 TAI_RUNTIME_DIRECT_REPAIR_WEB_AUTHORITY_AMBIGUOUS BLOCKED_AUTHORITY
web_id="${exact_web_ids[0]}"
[[ "$web_id" =~ ^[0-9a-f]{12,64}$ ]] \
  || fail_with_evidence 11 TAI_RUNTIME_DIRECT_REPAIR_WEB_ID_INVALID BLOCKED_AUTHORITY

prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
COMPOSE_PROJECT="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -d "$prod_dir" && -n "$prod_files" && "$COMPOSE_PROJECT" =~ ^[A-Za-z0-9._-]+$ ]] \
  || fail_with_evidence 12 TAI_RUNTIME_DIRECT_REPAIR_COMPOSE_METADATA_INVALID BLOCKED_AUTHORITY

override="$prod_dir/compose.tai-agro-os.override.yml"
[[ ! -e "$override" && ! -L "$override" ]] \
  || fail_with_evidence 13 TAI_RUNTIME_DIRECT_REPAIR_OVERRIDE_PRESENT BLOCKED_ORPHAN_BOUNDARY
mapfile -t tai_container_ids < <(
  docker ps -aq \
    --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" \
    --filter 'label=com.docker.compose.service=tai'
)
(( ${#tai_container_ids[@]} == 0 )) \
  || fail_with_evidence 14 TAI_RUNTIME_DIRECT_REPAIR_SERVICE_PRESENT BLOCKED_ORPHAN_BOUNDARY

IFS=',' read -r -a raw_files <<< "$prod_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ "$file" == "$override" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) \
  || fail_with_evidence 15 TAI_RUNTIME_DIRECT_REPAIR_COMPOSE_FILES_MISSING BLOCKED_AUTHORITY
for file in "${compose_files[@]}"; do
  [[ -f "$file" && ! -L "$file" ]] \
    || fail_with_evidence 15 TAI_RUNTIME_DIRECT_REPAIR_COMPOSE_FILE_INVALID BLOCKED_AUTHORITY
done

dc=(docker compose --project-directory "$prod_dir" --project-name "$COMPOSE_PROJECT")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$(mktemp)"
containers_json="$(mktemp)"
authority_env="$(mktemp)"
transaction_log=''
cleanup() { rm -f "$compose_json" "$containers_json" "$authority_env" ${transaction_log:+"$transaction_log"}; }
trap cleanup EXIT

"${dc[@]}" config --format json > "$compose_json"
mapfile -t project_container_ids < <(docker ps -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT")
(( ${#project_container_ids[@]} >= 1 )) \
  || fail_with_evidence 16 TAI_RUNTIME_DIRECT_REPAIR_PROJECT_EMPTY BLOCKED_AUTHORITY
docker inspect "${project_container_ids[@]}" > "$containers_json"

python3 - "$compose_json" "$containers_json" "$authority_env" "$TARGET_SHA" "$COMPOSE_PROJECT" <<'PY_AUTHORITY'
import json
import posixpath
import re
import shlex
import sys
from urllib.parse import parse_qsl, unquote, urlsplit

compose_path, containers_path, output_path, target_sha, project_name = sys.argv[1:]

def fail(code):
    raise SystemExit(code)

def read_json(path, expected, code):
    try:
        value = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError, TypeError):
        fail(code)
    if not isinstance(value, expected):
        fail(code)
    return value

def labels(container):
    value = (container.get('Config') or {}).get('Labels') or {}
    return value if isinstance(value, dict) else {}

def env_map(items, code):
    result = {}
    for item in items or []:
        if not isinstance(item, str) or '=' not in item:
            continue
        key, value = item.split('=', 1)
        if key in result:
            fail(code)
        result[key] = value
    return result

def service_env(service):
    value = service.get('environment') or {}
    if isinstance(value, dict):
        return {str(k): '' if v is None else str(v) for k, v in value.items()}
    if isinstance(value, list):
        return env_map(value, 'POSTGRES_SERVICE_ENVIRONMENT_AMBIGUOUS')
    fail('POSTGRES_SERVICE_ENVIRONMENT_INVALID')

def image_repository(image):
    if not isinstance(image, str) or not image.strip():
        return ''
    without_digest = image.strip().split('@', 1)[0]
    basename = without_digest.rsplit('/', 1)[-1]
    return basename.split(':', 1)[0].lower()

def is_postgres_image(image):
    return image_repository(image) in {'postgres', 'postgresql'}

def normalized_path(value):
    if not isinstance(value, str) or not value.startswith('/'):
        return ''
    return posixpath.normpath(value)

def mount_covers(target, data):
    target = normalized_path(target)
    data = normalized_path(data)
    return bool(target and data and (data == target or data.startswith(target.rstrip('/') + '/')))

def compose_has_storage(service):
    pgdata = service_env(service).get('PGDATA') or '/var/lib/postgresql/data'
    return any(
        isinstance(mount, dict)
        and mount.get('type') in {'volume', 'bind'}
        and str(mount.get('source') or '').strip()
        and mount_covers(mount.get('target'), pgdata)
        for mount in service.get('volumes') or []
    )

def container_has_storage(container, pgdata):
    return any(
        isinstance(mount, dict)
        and mount.get('Type') in {'volume', 'bind'}
        and str(mount.get('Source') or mount.get('Name') or '').strip()
        and mount_covers(mount.get('Destination'), pgdata)
        for mount in container.get('Mounts') or []
    )

cfg = read_json(compose_path, dict, 'COMPOSE_CONFIG_INVALID')
containers = read_json(containers_path, list, 'CONTAINER_INSPECT_INVALID')
services = cfg.get('services') or {}
if not isinstance(services, dict) or 'api' not in services or 'tai' in services:
    fail('COMPOSE_SERVICE_AUTHORITY_INVALID')
running = [
    item for item in containers
    if isinstance(item, dict)
    and labels(item).get('com.docker.compose.project') == project_name
    and (item.get('State') or {}).get('Status') == 'running'
]
api = [item for item in running if labels(item).get('com.docker.compose.service') == 'api']
if len(api) != 1:
    fail('API_CONTAINER_AUTHORITY_AMBIGUOUS')
api = api[0]
if labels(api).get('org.opencontainers.image.revision') != target_sha:
    fail('API_EXACT_MAIN_MISMATCH')
api_env = env_map((api.get('Config') or {}).get('Env'), 'API_ENVIRONMENT_AMBIGUOUS')
database_url = api_env.get('DATABASE_URL', '')
if not database_url or database_url != database_url.strip() or re.search(r'[\x00-\x20\x7f]', database_url):
    fail('DATABASE_URL_INVALID')
if re.search(r'%(?![0-9A-Fa-f]{2})', database_url):
    fail('DATABASE_URL_INVALID')
try:
    parsed = urlsplit(database_url)
    port = parsed.port
except ValueError:
    fail('DATABASE_URL_INVALID')
if parsed.scheme not in {'postgres', 'postgresql'} or not parsed.netloc or parsed.netloc.count('@') > 1:
    fail('DATABASE_URL_INVALID')
if parsed.fragment or (port is not None and not 1 <= port <= 65535):
    fail('DATABASE_URL_INVALID')
try:
    pairs = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True, max_num_fields=32)
except ValueError:
    fail('DATABASE_URL_QUERY_INVALID')
keys = [key.strip().lower() for key, _ in pairs]
if any(not key for key in keys) or len(keys) != len(set(keys)):
    fail('DATABASE_URL_QUERY_INVALID')
if {'database','dbname','host','hostaddr','port','service','socket','unix_socket'}.intersection(keys):
    fail('DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN')
host = parsed.hostname or ''
db_name = unquote(parsed.path[1:]) if parsed.path.startswith('/') else ''
if not host or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,62}', db_name):
    fail('DATABASE_URL_INVALID')
if host not in services or not isinstance(services[host], dict):
    fail('DATABASE_HOST_SERVICE_INVALID')
service = services[host]
if not is_postgres_image(service.get('image')) or not compose_has_storage(service):
    fail('POSTGRES_SERVICE_AUTHORITY_INVALID')
persistent = sorted(
    name for name, item in services.items()
    if isinstance(name, str) and isinstance(item, dict)
    and is_postgres_image(item.get('image')) and compose_has_storage(item)
)
if persistent != [host]:
    fail('POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS')
db = [item for item in running if labels(item).get('com.docker.compose.service') == host]
if len(db) != 1:
    fail('POSTGRES_RUNNING_CONTAINER_AUTHORITY_AMBIGUOUS')
db = db[0]
config = db.get('Config') or {}
if not is_postgres_image(config.get('Image')):
    fail('POSTGRES_RUNNING_IMAGE_INVALID')
db_env = env_map(config.get('Env'), 'POSTGRES_CONTAINER_ENVIRONMENT_AMBIGUOUS')
admin = db_env.get('POSTGRES_USER', '')
postgres_db = db_env.get('POSTGRES_DB', '')
pgdata = db_env.get('PGDATA') or service_env(service).get('PGDATA') or '/var/lib/postgresql/data'
if postgres_db != db_name or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,62}', admin):
    fail('POSTGRES_IDENTITY_MISMATCH')
if not container_has_storage(db, pgdata):
    fail('POSTGRES_RUNNING_STORAGE_INVALID')
db_id = str(db.get('Id') or '')
if not re.fullmatch(r'[0-9a-f]{12,64}', db_id):
    fail('POSTGRES_CONTAINER_ID_INVALID')
with open(output_path, 'w', encoding='utf-8') as handle:
    handle.write(f'DB_ID={shlex.quote(db_id)}\n')
    handle.write(f'DB_SERVICE={shlex.quote(host)}\n')
    handle.write(f'DB_NAME={shlex.quote(db_name)}\n')
    handle.write(f'DB_ADMIN={shlex.quote(admin)}\n')
PY_AUTHORITY

# shellcheck disable=SC1090
source "$authority_env"
[[ "$DB_ID" =~ ^[0-9a-f]{12,64}$ ]] \
  || fail_with_evidence 17 TAI_RUNTIME_DIRECT_REPAIR_DB_ID_INVALID BLOCKED_AUTHORITY
[[ "$DB_SERVICE" =~ ^[A-Za-z0-9._-]+$ ]] \
  || fail_with_evidence 17 TAI_RUNTIME_DIRECT_REPAIR_DB_SERVICE_INVALID BLOCKED_AUTHORITY
[[ "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] \
  || fail_with_evidence 17 TAI_RUNTIME_DIRECT_REPAIR_DB_NAME_INVALID BLOCKED_AUTHORITY
[[ "$DB_ADMIN" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] \
  || fail_with_evidence 17 TAI_RUNTIME_DIRECT_REPAIR_DB_ADMIN_NAME_INVALID BLOCKED_AUTHORITY

psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}

admin_boundary="$(psql_admin -AtF $'\t' -c "SELECT rolsuper, rolcreaterole FROM pg_catalog.pg_roles WHERE rolname='${DB_ADMIN}';")"
[[ "$(printf '%s\n' "$admin_boundary" | grep -c .)" == 1 ]] \
  || fail_with_evidence 18 TAI_RUNTIME_DIRECT_REPAIR_DB_ADMIN_MISSING BLOCKED_AUTHORITY
IFS=$'\t' read -r admin_super admin_createrole <<< "$admin_boundary"
[[ "$admin_super" == t || "$admin_createrole" == t ]] \
  || fail_with_evidence 18 TAI_RUNTIME_DIRECT_REPAIR_DB_ADMIN_INVALID BLOCKED_AUTHORITY

role_exists="$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
[[ "$role_exists" == 0 || "$role_exists" == 1 ]] \
  || fail_with_evidence 19 TAI_RUNTIME_DIRECT_REPAIR_ROLE_AUTHORITY_AMBIGUOUS BLOCKED_AUTHORITY
if [[ "$role_exists" == 0 ]]; then
  BOUNDARY_JSON='{}'
  write_evidence ALREADY_ABSENT true '' false false
  echo 'TAI_RUNTIME_DIRECT_REPAIR_STATUS=ALREADY_ABSENT'
  echo 'TAI_RUNTIME_DIRECT_REPAIR_COMPLETE=1'
  exit 0
fi

boundary="$(psql_admin -AtF $'\t' <<SQL
WITH role_row AS (
  SELECT oid, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
         rolreplication, rolbypassrls, rolconnlimit
  FROM pg_catalog.pg_roles
  WHERE rolname='${ROLE_NAME}'
), non_system_classes AS (
  SELECT relation.*
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname NOT IN ('pg_catalog','information_schema')
    AND namespace.nspname NOT LIKE 'pg_toast%'
), counts AS (
  SELECT
    (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member=role_row.oid)::bigint AS memberships,
    (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE roleid=role_row.oid)::bigint AS grants_to_others,
    (SELECT COUNT(*) FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}')::bigint AS sessions,
    (SELECT COUNT(*) FROM non_system_classes WHERE relowner=role_row.oid)::bigint AS owned_relations,
    (SELECT COUNT(*) FROM pg_catalog.pg_namespace WHERE nspowner=role_row.oid)::bigint AS owned_schemas,
    (SELECT COUNT(*) FROM pg_catalog.pg_proc WHERE proowner=role_row.oid)::bigint AS owned_functions,
    (SELECT COUNT(*) FROM pg_catalog.pg_type WHERE typowner=role_row.oid AND typnamespace NOT IN (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname IN ('pg_catalog','information_schema')))::bigint AS owned_types,
    (SELECT COUNT(*) FROM pg_catalog.pg_database WHERE datdba=role_row.oid)::bigint AS owned_databases,
    (SELECT COUNT(*) FROM pg_catalog.pg_default_acl WHERE defaclrole=role_row.oid)::bigint AS owned_default_acls,
    (SELECT COUNT(*) FROM pg_catalog.pg_default_acl AS defaults WHERE EXISTS (SELECT 1 FROM aclexplode(defaults.defaclacl) AS acl WHERE acl.grantee=role_row.oid))::bigint AS default_acl_grants,
    (SELECT COUNT(*) FROM non_system_classes AS relation WHERE EXISTS (SELECT 1 FROM aclexplode(relation.relacl) AS acl WHERE acl.grantee=role_row.oid))::bigint AS direct_relation_acls,
    (SELECT COUNT(*) FROM pg_catalog.pg_attribute AS attribute JOIN non_system_classes AS relation ON relation.oid=attribute.attrelid WHERE attribute.attnum>0 AND NOT attribute.attisdropped AND EXISTS (SELECT 1 FROM aclexplode(attribute.attacl) AS acl WHERE acl.grantee=role_row.oid))::bigint AS direct_column_acls,
    (SELECT COUNT(*) FROM pg_catalog.pg_namespace AS namespace WHERE EXISTS (SELECT 1 FROM aclexplode(namespace.nspacl) AS acl WHERE acl.grantee=role_row.oid))::bigint AS direct_schema_acls,
    (SELECT COUNT(*) FROM pg_catalog.pg_database AS database WHERE EXISTS (SELECT 1 FROM aclexplode(database.datacl) AS acl WHERE acl.grantee=role_row.oid))::bigint AS direct_database_acls,
    (SELECT COUNT(*) FROM pg_catalog.pg_proc AS procedure WHERE EXISTS (SELECT 1 FROM aclexplode(procedure.proacl) AS acl WHERE acl.grantee=role_row.oid))::bigint AS direct_function_acls,
    (SELECT COUNT(*) FROM pg_catalog.pg_type AS type_row WHERE EXISTS (SELECT 1 FROM aclexplode(type_row.typacl) AS acl WHERE acl.grantee=role_row.oid))::bigint AS direct_type_acls,
    (SELECT COUNT(*) FROM pg_catalog.pg_class AS relation JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace WHERE namespace.nspname='public' AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\' AND relation.relkind IN ('r','v','m','p','f') AND has_table_privilege('${ROLE_NAME}',format('%I.%I',namespace.nspname,relation.relname),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::bigint AS effective_non_tai_relations
  FROM role_row
)
SELECT role_row.rolcanlogin, role_row.rolsuper, role_row.rolcreatedb,
       role_row.rolcreaterole, role_row.rolinherit, role_row.rolreplication,
       role_row.rolbypassrls, role_row.rolconnlimit,
       counts.memberships, counts.grants_to_others, counts.sessions,
       counts.owned_relations, counts.owned_schemas, counts.owned_functions,
       counts.owned_types, counts.owned_databases, counts.owned_default_acls,
       counts.default_acl_grants, counts.direct_relation_acls,
       counts.direct_column_acls, counts.direct_schema_acls,
       counts.direct_database_acls, counts.direct_function_acls,
       counts.direct_type_acls, counts.effective_non_tai_relations
FROM role_row, counts;
SQL
)"
[[ "$(printf '%s\n' "$boundary" | grep -c .)" == 1 ]] \
  || fail_with_evidence 20 TAI_RUNTIME_DIRECT_REPAIR_BOUNDARY_QUERY_INVALID BLOCKED_AUTHORITY
IFS=$'\t' read -r \
  can_login super createdb createrole inherit replication bypass connlimit \
  memberships grants_to_others sessions owned_relations owned_schemas \
  owned_functions owned_types owned_databases owned_default_acls default_acl_grants \
  direct_relation_acls direct_column_acls direct_schema_acls direct_database_acls \
  direct_function_acls direct_type_acls effective_non_tai_relations <<< "$boundary"

BOUNDARY_JSON="$(python3 - \
  "$can_login" "$super" "$createdb" "$createrole" "$inherit" "$replication" "$bypass" "$connlimit" \
  "$memberships" "$grants_to_others" "$sessions" "$owned_relations" "$owned_schemas" \
  "$owned_functions" "$owned_types" "$owned_databases" "$owned_default_acls" "$default_acl_grants" \
  "$direct_relation_acls" "$direct_column_acls" "$direct_schema_acls" "$direct_database_acls" \
  "$direct_function_acls" "$direct_type_acls" "$effective_non_tai_relations" <<'PY_BOUNDARY'
import json, sys
keys = [
    'canLogin','superuser','createdb','createrole','inherit','replication','bypassRls','connectionLimit',
    'membershipCount','memberGrantCount','activeSessionCount','ownedRelationCount','ownedSchemaCount',
    'ownedFunctionCount','ownedTypeCount','ownedDatabaseCount','ownedDefaultAclCount','defaultAclGrantCount',
    'directRelationAclCount','directColumnAclCount','directSchemaAclCount','directDatabaseAclCount',
    'directFunctionAclCount','directTypeAclCount','effectiveNonTaiRelationCount',
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

[[ "$can_login" == t && "$super" == f && "$createdb" == f && "$createrole" == f ]] \
  || fail_with_evidence 21 TAI_RUNTIME_DIRECT_REPAIR_ROLE_ATTRIBUTES_INVALID BLOCKED_BOUNDARY
[[ "$inherit" == f && "$replication" == f && "$bypass" == f && "$connlimit" == 20 ]] \
  || fail_with_evidence 21 TAI_RUNTIME_DIRECT_REPAIR_ROLE_ATTRIBUTES_INVALID BLOCKED_BOUNDARY
[[ "$memberships" == 0 && "$grants_to_others" == 0 && "$sessions" == 0 ]] \
  || fail_with_evidence 22 TAI_RUNTIME_DIRECT_REPAIR_RELATIONSHIP_BOUNDARY_INVALID BLOCKED_BOUNDARY
[[ "$owned_relations" == 0 && "$owned_schemas" == 0 && "$owned_functions" == 0 \
   && "$owned_types" == 0 && "$owned_databases" == 0 && "$owned_default_acls" == 0 \
   && "$default_acl_grants" == 0 ]] \
  || fail_with_evidence 23 TAI_RUNTIME_DIRECT_REPAIR_OWNERSHIP_BOUNDARY_INVALID BLOCKED_BOUNDARY

MUTATION_ATTEMPTED=1
transaction_log="$(mktemp)"
set +e
psql_admin >"$transaction_log" 2>&1 <<SQL
BEGIN;
ALTER ROLE ${ROLE_NAME} NOLOGIN;
DO \$session_guard\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}') THEN
    RAISE EXCEPTION 'tai_runtime has active sessions';
  END IF;
END
\$session_guard\$;

SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I;',database.datname,'${ROLE_NAME}')
FROM pg_catalog.pg_database AS database
WHERE EXISTS (SELECT 1 FROM aclexplode(database.datacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY database.datname
\gexec

SELECT format('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM %I;',namespace.nspname,'${ROLE_NAME}')
FROM pg_catalog.pg_namespace AS namespace
WHERE EXISTS (SELECT 1 FROM aclexplode(namespace.nspacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname
\gexec

SELECT format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I;',namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE relation.relkind IN ('r','v','m','p','f')
  AND EXISTS (SELECT 1 FROM aclexplode(relation.relacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, relation.relname
\gexec

SELECT format('REVOKE ALL PRIVILEGES (%I) ON TABLE %I.%I FROM %I;',attribute.attname,namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_attribute AS attribute
JOIN pg_catalog.pg_class AS relation ON relation.oid=attribute.attrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE attribute.attnum>0 AND NOT attribute.attisdropped
  AND EXISTS (SELECT 1 FROM aclexplode(attribute.attacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, relation.relname, attribute.attnum
\gexec

SELECT format('REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I;',namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE relation.relkind='S'
  AND EXISTS (SELECT 1 FROM aclexplode(relation.relacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, relation.relname
\gexec

SELECT format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %I;',procedure.oid::regprocedure,'${ROLE_NAME}')
FROM pg_catalog.pg_proc AS procedure
WHERE EXISTS (SELECT 1 FROM aclexplode(procedure.proacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY procedure.oid::regprocedure::text
\gexec

SELECT format('REVOKE ALL PRIVILEGES ON TYPE %I.%I FROM %I;',namespace.nspname,type_row.typname,'${ROLE_NAME}')
FROM pg_catalog.pg_type AS type_row
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=type_row.typnamespace
WHERE EXISTS (SELECT 1 FROM aclexplode(type_row.typacl) AS acl WHERE acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'))
ORDER BY namespace.nspname, type_row.typname
\gexec

DROP ROLE ${ROLE_NAME};
COMMIT;
SQL
transaction_rc=$?
set -e
if (( transaction_rc != 0 )); then
  rm -f "$transaction_log"
  transaction_log=''
  fail_with_evidence "$transaction_rc" TAI_RUNTIME_DIRECT_REPAIR_TRANSACTION_ROLLED_BACK FAILED_TRANSACTION_ROLLED_BACK
fi
rm -f "$transaction_log"
transaction_log=''

[[ "$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")" == 0 ]] \
  || fail_with_evidence 24 TAI_RUNTIME_DIRECT_REPAIR_POSTCONDITION_FAILED FAILED_POSTCONDITION

write_evidence REMOVED_SAFE_ORPHAN true '' true true
echo 'TAI_RUNTIME_DIRECT_REPAIR_STATUS=REMOVED_SAFE_ORPHAN'
echo 'TAI_RUNTIME_DIRECT_REPAIR_COMPLETE=1'
