#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
OUTPUT_FILE="${3:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'INVALID_TARGET_SHA' >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || { echo 'INVALID_RUN_ID' >&2; exit 2; }
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/runtime-role-repair.json" ]] \
  || { echo 'INVALID_OUTPUT_PATH' >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'ROOT_AUTHORITY_REQUIRED' >&2; exit 2; }

readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'
readonly ROLE_NAME='tai_runtime'

[[ ! -e "$ENV_FILE" && ! -L "$ENV_FILE" ]] || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_ENV_PRESENT' >&2
  exit 10
}

mapfile -t all_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
exact_web_ids=()
for id in "${all_web_ids[@]}"; do
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  [[ "$revision" == "$TARGET_SHA" ]] && exact_web_ids+=("$id")
done
(( ${#exact_web_ids[@]} == 1 )) || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_WEB_AUTHORITY_AMBIGUOUS' >&2
  exit 11
}
web_id="${exact_web_ids[0]}"
[[ "$web_id" =~ ^[0-9a-f]{12,64}$ ]] || exit 11

prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -d "$prod_dir" && -n "$prod_files" && "$prod_project" =~ ^[A-Za-z0-9._-]+$ ]] || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_COMPOSE_METADATA_INVALID' >&2
  exit 12
}

override="$prod_dir/compose.tai-agro-os.override.yml"
[[ ! -e "$override" && ! -L "$override" ]] || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_OVERRIDE_PRESENT' >&2
  exit 13
}
mapfile -t tai_container_ids < <(
  docker ps -aq \
    --filter "label=com.docker.compose.project=$prod_project" \
    --filter 'label=com.docker.compose.service=tai'
)
(( ${#tai_container_ids[@]} == 0 )) || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_SERVICE_PRESENT' >&2
  exit 14
}

IFS=',' read -r -a raw_files <<< "$prod_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ "$file" == "$override" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_COMPOSE_FILES_MISSING' >&2
  exit 15
}
for file in "${compose_files[@]}"; do
  [[ -f "$file" && ! -L "$file" ]] || {
    echo 'TAI_RUNTIME_ROLE_REPAIR_COMPOSE_FILE_INVALID' >&2
    exit 15
  }
done

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$(mktemp)"
containers_json="$(mktemp)"
authority_env="$(mktemp)"
cleanup() { rm -f "$compose_json" "$containers_json" "$authority_env"; }
trap cleanup EXIT
"${dc[@]}" config --format json > "$compose_json"
mapfile -t project_container_ids < <(docker ps -q --filter "label=com.docker.compose.project=$prod_project")
(( ${#project_container_ids[@]} >= 1 )) || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_PROJECT_EMPTY' >&2
  exit 16
}
docker inspect "${project_container_ids[@]}" > "$containers_json"

python3 - "$compose_json" "$containers_json" "$authority_env" "$TARGET_SHA" "$prod_project" <<'PY_AUTHORITY'
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
[[ "$DB_ID" =~ ^[0-9a-f]{12,64}$ ]]
[[ "$DB_SERVICE" =~ ^[A-Za-z0-9._-]+$ ]]
[[ "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]
[[ "$DB_ADMIN" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]

psql_admin() {
  docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}

admin_boundary="$(psql_admin -AtF $'\t' -c "SELECT rolsuper, rolcreaterole FROM pg_catalog.pg_roles WHERE rolname='${DB_ADMIN}';")"
[[ "$(printf '%s\n' "$admin_boundary" | grep -c .)" == 1 ]]
IFS=$'\t' read -r admin_super admin_createrole <<< "$admin_boundary"
[[ "$admin_super" == t || "$admin_createrole" == t ]] || {
  echo 'TAI_RUNTIME_ROLE_REPAIR_DB_ADMIN_INVALID' >&2
  exit 17
}

role_exists="$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
[[ "$role_exists" == 0 || "$role_exists" == 1 ]]
status='ALREADY_ABSENT'
role_boundary_json='{}'
if [[ "$role_exists" == 1 ]]; then
  boundary="$(psql_admin -AtF $'\t' <<SQL
WITH role_row AS (
  SELECT oid, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
         rolreplication, rolbypassrls, rolconnlimit
  FROM pg_catalog.pg_roles
  WHERE rolname='${ROLE_NAME}'
), non_tai_relations AS (
  SELECT relation.oid, relation.relowner, relation.relacl,
         has_table_privilege(
           '${ROLE_NAME}',
           format('%I.%I', namespace.nspname, relation.relname),
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
         ) AS effective
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname='public'
    AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
), direct_acl_relations AS (
  SELECT DISTINCT relation.oid
  FROM non_tai_relations AS relation
  CROSS JOIN role_row
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  WHERE relation.relacl IS NOT NULL
    AND acl.grantee=role_row.oid
), public_acl_relations AS (
  SELECT DISTINCT relation.oid
  FROM non_tai_relations AS relation
  CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
  WHERE relation.relacl IS NOT NULL
    AND acl.grantee=0
)
SELECT role_row.rolcanlogin, role_row.rolsuper, role_row.rolcreatedb,
       role_row.rolcreaterole, role_row.rolinherit, role_row.rolreplication,
       role_row.rolbypassrls, role_row.rolconnlimit,
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member=role_row.oid),
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE roleid=role_row.oid),
       (SELECT COUNT(*) FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}'),
       (SELECT COUNT(*) FROM non_tai_relations WHERE effective),
       (SELECT COUNT(*) FROM direct_acl_relations),
       (SELECT COUNT(*) FROM public_acl_relations),
       (SELECT COUNT(*) FROM non_tai_relations WHERE relowner=role_row.oid)
FROM role_row;
SQL
)"
  [[ "$(printf '%s\n' "$boundary" | grep -c .)" == 1 ]]
  IFS=$'\t' read -r can_login super createdb createrole inherit replication bypass connlimit memberships grants_to_others sessions non_tai direct_non_tai public_non_tai owned_non_tai <<< "$boundary"
  [[ "$can_login" == t && "$super" == f && "$createdb" == f && "$createrole" == f ]]
  [[ "$inherit" == f && "$replication" == f && "$bypass" == f && "$connlimit" == 20 ]]

  role_boundary_json="$(python3 - "$can_login" "$super" "$createdb" "$createrole" "$inherit" "$replication" "$bypass" "$connlimit" "$memberships" "$grants_to_others" "$sessions" "$non_tai" "$direct_non_tai" "$public_non_tai" "$owned_non_tai" <<'PY_BOUNDARY'
import json,sys
keys=['canLogin','superuser','createdb','createrole','inherit','replication','bypassRls','connectionLimit','membershipCount','memberGrantCount','activeSessionCount','nonTaiTableGrantCount','directNonTaiAclRelationCount','publicNonTaiAclRelationCount','ownedNonTaiRelationCount']
values=sys.argv[1:]
parsed=[]
for index,value in enumerate(values):
    if index < 7:
        parsed.append(value == 't')
    else:
        parsed.append(int(value))
print(json.dumps(dict(zip(keys,parsed)),sort_keys=True,separators=(',',':')))
PY_BOUNDARY
)"

  boundary_safe=1
  [[ "$memberships" == 0 ]] || boundary_safe=0
  [[ "$grants_to_others" == 0 ]] || boundary_safe=0
  [[ "$sessions" == 0 ]] || boundary_safe=0
  [[ "$owned_non_tai" == 0 ]] || boundary_safe=0
  [[ "$public_non_tai" == 0 ]] || boundary_safe=0
  [[ "$direct_non_tai" == "$non_tai" ]] || boundary_safe=0

  if (( boundary_safe == 0 )); then
    python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$prod_project" "$DB_SERVICE" "$DB_NAME" "$role_boundary_json" <<'PY_BLOCKED_EVIDENCE'
import grp,json,os,sys
path,sha,run_id,project,db_service,db_name,boundary=sys.argv[1:]
report={
  'schemaVersion':'tai.runtime-role-repair.v1',
  'targetSha':sha,
  'runId':run_id,
  'hosting':'REG_RU_VPS_ONLY',
  'newRecurringCostRub':0,
  'status':'BLOCKED_BOUNDARY',
  'errorCode':'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID',
  'role':'tai_runtime',
  'servicePresent':False,
  'environmentPresent':False,
  'overridePresent':False,
  'composeProject':project,
  'databaseService':db_service,
  'databaseName':db_name,
  'boundaryBefore':json.loads(boundary),
  'mutationPerformed':False,
  'directNonTaiAclRevoked':False,
  'dropOwnedUsed':False,
  'reassignOwnedUsed':False,
  'passed':False,
}
with open(path,'w',encoding='utf-8') as handle:
    json.dump(report,handle,sort_keys=True,separators=(',',':')); handle.write('\n')
os.chmod(path,0o640)
os.chown(path,0,grp.getgrnam('pcactions').gr_gid)
PY_BLOCKED_EVIDENCE
    echo 'TAI_RUNTIME_ROLE_REPAIR_BOUNDARY_INVALID' >&2
    exit 18
  fi

  psql_admin <<SQL
BEGIN;
ALTER ROLE ${ROLE_NAME} NOLOGIN;
DO \$repair\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}') THEN
    RAISE EXCEPTION 'tai_runtime has active sessions';
  END IF;
END
\$repair\$;
SELECT format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I;',namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE namespace.nspname='public'
  AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
  AND relation.relkind IN ('r','v','m','p','f')
  AND EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(relation.relacl) AS acl
    WHERE relation.relacl IS NOT NULL
      AND acl.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}')
  )
ORDER BY relation.relname
\gexec
DO \$repair_non_tai\$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO remaining
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname='public'
    AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
    AND has_table_privilege(
      '${ROLE_NAME}',
      format('%I.%I',namespace.nspname,relation.relname),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    );
  IF remaining <> 0 THEN
    RAISE EXCEPTION 'tai_runtime retains non-TAI relation authority after bounded direct ACL revocation';
  END IF;
END
\$repair_non_tai\$;
REVOKE CONNECT ON DATABASE ${DB_NAME} FROM ${ROLE_NAME};
REVOKE USAGE ON SCHEMA public FROM ${ROLE_NAME};
SELECT format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I;',namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE namespace.nspname='public'
  AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
  AND relation.relkind IN ('r','v','m','p','f')
ORDER BY relation.relname
\gexec
SELECT format('REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I;',namespace.nspname,relation.relname,'${ROLE_NAME}')
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
WHERE namespace.nspname='public'
  AND relation.relname LIKE 'tai\\_%' ESCAPE '\\'
  AND relation.relkind='S'
ORDER BY relation.relname
\gexec
DROP ROLE ${ROLE_NAME};
COMMIT;
SQL
  [[ "$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")" == 0 ]]
  status='REMOVED_SAFE_ORPHAN'
fi

runtime_health_json="$(psql_admin -Atc "
SELECT json_build_object(
  'activeProfileCount', (
    SELECT COUNT(*)::int
    FROM public.tai_local_model_profiles
    WHERE status='ACTIVE'
  ),
  'activeGenerationCount', (
    SELECT COUNT(*)::int
    FROM public.tai_retrieval_generations
    WHERE status='ACTIVE'
  ),
  'masterSpecChunkCount', (
    SELECT COUNT(*)::int
    FROM public.tai_retrieval_chunks AS chunk
    JOIN public.tai_retrieval_generations AS generation
      ON generation.generation=chunk.generation
     AND generation.status='ACTIVE'
    WHERE chunk.source_id='tai-agro-os-master-spec-v4.0'
      AND chunk.revoked IS FALSE
  ),
  'acceptedAdmissionCount', (
    SELECT COUNT(*)::int
    FROM public.tai_current_model_admission_v1
    WHERE accepted IS TRUE
  ),
  'profiles', COALESCE((
    SELECT json_agg(
      json_build_object(
        'modelId', profile.model_id,
        'revision', profile.revision,
        'artifactSha256', profile.artifact_sha256,
        'profileStatus', profile.status,
        'runtimeStatus', health.status,
        'availableSlots', health.available_slots,
        'queueDepth', health.queue_depth,
        'p95LatencyMs', health.p95_latency_ms,
        'observedAt', health.observed_at,
        'circuitOpenUntil', health.circuit_open_until,
        'updatedAt', health.updated_at
      )
      ORDER BY profile.routing_priority, profile.model_id, profile.revision
    )
    FROM public.tai_local_model_profiles AS profile
    LEFT JOIN public.tai_local_model_health AS health
      ON health.model_id=profile.model_id
     AND health.revision=profile.revision
    WHERE profile.status='ACTIVE'
  ), '[]'::json)
)::text;
")"
[[ -n "$runtime_health_json" ]]
python3 - "$runtime_health_json" <<'PY_RUNTIME_HEALTH_VALIDATE'
import json,sys
value=json.loads(sys.argv[1])
assert isinstance(value.get('activeProfileCount'),int)
assert isinstance(value.get('activeGenerationCount'),int)
assert isinstance(value.get('masterSpecChunkCount'),int)
assert isinstance(value.get('acceptedAdmissionCount'),int)
assert isinstance(value.get('profiles'),list)
PY_RUNTIME_HEALTH_VALIDATE

latest_failed_run=''
shopt -s nullglob
for state_dir in /var/lib/pc-release-authority/tai-agro-os-*; do
  [[ -d "$state_dir" && ! -L "$state_dir" ]] || continue
  [[ -f "$state_dir/ROLLED_BACK" && -f "$state_dir/metadata.env" ]] || continue
  source_target="$(awk -F= '$1 == "TARGET_SHA" { print $2; exit }' "$state_dir/metadata.env")"
  [[ "$source_target" == "$TARGET_SHA" ]] || continue
  candidate="${state_dir##*-}"
  [[ "$candidate" =~ ^[0-9]{1,20}$ ]] || continue
  if [[ -z "$latest_failed_run" || "$candidate" -gt "$latest_failed_run" ]]; then
    latest_failed_run="$candidate"
  fi
done
shopt -u nullglob
latest_deployment_error='NONE'
latest_rollback_confirmed=false
if [[ -n "$latest_failed_run" ]]; then
  latest_stage="/var/lib/pc-release-authority/controller-jobs/${latest_failed_run}/deploy-stage-error.log"
  if [[ -f "$latest_stage" && ! -L "$latest_stage" ]]; then
    candidate_error="$(sed -n 's/^ERROR_CODE=//p' "$latest_stage" | tail -1)"
    [[ "$candidate_error" =~ ^[A-Z][A-Z0-9_]+$ ]] && latest_deployment_error="$candidate_error"
  fi
  [[ -f "/var/lib/pc-release-authority/tai-agro-os-${latest_failed_run}/ROLLED_BACK" ]] \
    && latest_rollback_confirmed=true
fi

python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$RUN_ID" "$status" "$prod_project" "$DB_SERVICE" "$DB_NAME" "$role_boundary_json" "$runtime_health_json" "${latest_failed_run:-none}" "$latest_deployment_error" "$latest_rollback_confirmed" <<'PY_EVIDENCE'
import grp,json,os,sys
path,sha,run_id,status,project,db_service,db_name,boundary,runtime_health,failed_run,error_code,rollback=sys.argv[1:]
report={
  'schemaVersion':'tai.runtime-role-repair.v1',
  'targetSha':sha,
  'runId':run_id,
  'hosting':'REG_RU_VPS_ONLY',
  'newRecurringCostRub':0,
  'status':status,
  'role':'tai_runtime',
  'servicePresent':False,
  'environmentPresent':False,
  'overridePresent':False,
  'composeProject':project,
  'databaseService':db_service,
  'databaseName':db_name,
  'boundaryBefore':json.loads(boundary),
  'runtimeHealthDiagnostic':json.loads(runtime_health),
  'latestFailedDeploymentRunId':None if failed_run == 'none' else failed_run,
  'latestDeploymentErrorCode':error_code,
  'latestDeploymentRollbackConfirmed':rollback == 'true',
  'mutationPerformed': status == 'REMOVED_SAFE_ORPHAN',
  'directNonTaiAclRevoked': status == 'REMOVED_SAFE_ORPHAN' and json.loads(boundary).get('directNonTaiAclRelationCount',0) > 0,
  'nonTaiTableGrantCountAfter':0,
  'dropOwnedUsed':False,
  'reassignOwnedUsed':False,
  'passed':True,
}
with open(path,'w',encoding='utf-8') as handle:
    json.dump(report,handle,sort_keys=True,separators=(',',':')); handle.write('\n')
os.chmod(path,0o640)
os.chown(path,0,grp.getgrnam('pcactions').gr_gid)
PY_EVIDENCE

echo "TAI_RUNTIME_ROLE_REPAIR_STATUS=$status"
echo "TAI_RUNTIME_ROLE_REPAIR_COMPLETE=1"
