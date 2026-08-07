#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
OUTPUT_FILE="${3:-}"

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'INVALID_TARGET_SHA' >&2; exit 2; }
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || { echo 'INVALID_RUN_ID' >&2; exit 2; }
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/partial-deploy-recovery.json" ]] \
  || { echo 'INVALID_OUTPUT_PATH' >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo 'ROOT_AUTHORITY_REQUIRED' >&2; exit 2; }

readonly STATE_BASE='/var/lib/pc-release-authority'
readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'
readonly ROLE_NAME='tai_runtime'

safe_state() {
  local id="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || true
}

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#web_ids[@]} == 1 && ${#api_ids[@]} == 1 )) || { echo 'PLATFORM_RUNTIME_AUTHORITY_AMBIGUOUS' >&2; exit 10; }
web_id="${web_ids[0]}"
api_id="${api_ids[0]}"
[[ "$(safe_state "$web_id")" =~ ^(healthy|running)$ ]] || { echo 'WEB_BASELINE_UNHEALTHY' >&2; exit 11; }
[[ "$(safe_state "$api_id")" =~ ^(healthy|running)$ ]] || { echo 'API_BASELINE_UNHEALTHY' >&2; exit 11; }
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")" == "$TARGET_SHA" ]] \
  || { echo 'WEB_NOT_EXACT_CURRENT_MAIN' >&2; exit 12; }
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$TARGET_SHA" ]] \
  || { echo 'API_NOT_EXACT_CURRENT_MAIN' >&2; exit 12; }

prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ "$prod_dir" == /* && -d "$prod_dir" && -n "$prod_files" && "$prod_project" =~ ^[A-Za-z0-9._-]+$ ]] \
  || { echo 'COMPOSE_AUTHORITY_INVALID' >&2; exit 13; }
override="$prod_dir/compose.tai-agro-os.override.yml"

mapfile -t tai_ids < <(docker ps -aq \
  --filter "label=com.docker.compose.project=$prod_project" \
  --filter 'label=com.docker.compose.service=tai')
(( ${#tai_ids[@]} == 1 )) || { echo 'PARTIAL_TAI_RUNTIME_AUTHORITY_AMBIGUOUS' >&2; exit 14; }
tai_id="${tai_ids[0]}"
tai_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$tai_id" 2>/dev/null || true)"
[[ "$tai_revision" =~ ^[0-9a-f]{40}$ ]] || { echo 'PARTIAL_TAI_REVISION_INVALID' >&2; exit 15; }
[[ "$(docker inspect --format '{{.Config.User}}' "$tai_id")" == '65532:65532' ]] \
  || { echo 'PARTIAL_TAI_USER_INVALID' >&2; exit 15; }
[[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$tai_id")" == true ]] \
  || { echo 'PARTIAL_TAI_ROOTFS_INVALID' >&2; exit 15; }
[[ "$(docker inspect --format '{{json .HostConfig.SecurityOpt}}' "$tai_id")" == *no-new-privileges:true* ]] \
  || { echo 'PARTIAL_TAI_SECURITY_INVALID' >&2; exit 15; }
[[ -z "$(docker port "$tai_id" 2>/dev/null)" ]] || { echo 'PARTIAL_TAI_PUBLIC_PORT_INVALID' >&2; exit 15; }

candidate_file="$(mktemp)"
metadata_env="$(mktemp)"
diagnostic_file="$(mktemp)"
trap 'rm -f "$candidate_file" "$metadata_env" "$diagnostic_file"' EXIT
: > "$candidate_file"

for state in "$STATE_BASE"/tai-agro-os-*; do
  [[ -d "$state" && ! -L "$state" ]] || continue
  [[ "$(stat -c '%U:%G:%a' "$state" 2>/dev/null || true)" == root:root:700 ]] || continue
  [[ -f "$state/MUTATION_STARTED" && ! -e "$state/ACCEPTED" && ! -e "$state/ROLLED_BACK" ]] || continue
  metadata="$state/metadata.env"
  [[ -f "$metadata" && ! -L "$metadata" ]] || continue
  [[ "$(stat -c '%U:%G:%a' "$metadata" 2>/dev/null || true)" == root:root:600 ]] || continue
  if python3 - "$metadata" "$tai_revision" "$prod_dir" "$prod_project" "$override" <<'PY' >/dev/null 2>&1
import re, sys
path, expected_sha, prod_dir, project, override = sys.argv[1:]
rows = {}
for raw in open(path, encoding='utf-8'):
    line = raw.rstrip('\n')
    if not line or '=' not in line:
        raise SystemExit(2)
    key, value = line.split('=', 1)
    if key in rows:
        raise SystemExit(2)
    rows[key] = value
required = {'TARGET_SHA','TAI_IMAGE','TAI_IMAGE_DIGEST','PROD_DIR','PROD_PROJECT','OVERRIDE','DB_SERVICE','DB_ADMIN','DB_NAME','ROLE_CREATED','PREVIOUS_TAI'}
if set(rows) != required: raise SystemExit(3)
if rows['TARGET_SHA'] != expected_sha: raise SystemExit(4)
if rows['PROD_DIR'] != prod_dir or rows['PROD_PROJECT'] != project or rows['OVERRIDE'] != override: raise SystemExit(5)
if not re.fullmatch(r'ghcr[.]io/pachaninm-lab/grainflow-tai:sha-[0-9a-f]{7}', rows['TAI_IMAGE']): raise SystemExit(6)
if not re.fullmatch(r'ghcr[.]io/pachaninm-lab/grainflow-tai@sha256:[0-9a-f]{64}', rows['TAI_IMAGE_DIGEST']): raise SystemExit(6)
for key in ('DB_SERVICE','DB_ADMIN','DB_NAME'):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.-]{0,62}', rows[key]): raise SystemExit(7)
if rows['ROLE_CREATED'] not in {'0','1'} or rows['PREVIOUS_TAI'] != '0': raise SystemExit(8)
PY
  then
    printf '%s\n' "$state" >> "$candidate_file"
  fi
done

[[ "$(grep -c . "$candidate_file" || true)" == 1 ]] || { echo 'PARTIAL_DEPLOYMENT_STATE_AUTHORITY_AMBIGUOUS' >&2; exit 16; }
state_root="$(cat "$candidate_file")"
metadata="$state_root/metadata.env"
python3 - "$metadata" "$metadata_env" <<'PY'
import re, shlex, sys
source, output = sys.argv[1:]
rows={}
for raw in open(source, encoding='utf-8'):
    key,value=raw.rstrip('\n').split('=',1); rows[key]=value
for key in ('TARGET_SHA','PROD_DIR','PROD_PROJECT','OVERRIDE','DB_SERVICE','DB_ADMIN','DB_NAME','ROLE_CREATED','PREVIOUS_TAI'):
    print(f'{key}={shlex.quote(rows[key])}', file=open(output,'a',encoding='utf-8'))
PY
# shellcheck disable=SC1090
source "$metadata_env"
[[ "$TARGET_SHA" != "$tai_revision" ]] || { echo 'RECOVERY_REQUIRES_NEWER_CURRENT_MAIN' >&2; exit 17; }
[[ "$PREVIOUS_TAI" == 0 ]] || { echo 'PREVIOUS_TAI_RECOVERY_NOT_AUTHORIZED' >&2; exit 17; }
[[ "$OVERRIDE" == "$override" && "$PROD_DIR" == "$prod_dir" && "$PROD_PROJECT" == "$prod_project" ]] || exit 17
[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" && "$(stat -c '%U:%G:%a' "$ENV_FILE")" == root:root:600 ]] \
  || { echo 'PARTIAL_TAI_ENV_AUTHORITY_INVALID' >&2; exit 18; }
[[ -f "$override" && ! -L "$override" && "$(stat -c '%U:%G:%a' "$override")" == root:root:600 ]] \
  || { echo 'PARTIAL_TAI_OVERRIDE_AUTHORITY_INVALID' >&2; exit 18; }
[[ -f "$state_root/tai-agro-os.env.absent" && -f "$state_root/compose.tai-agro-os.override.yml.absent" ]] \
  || { echo 'ROLLBACK_ABSENT_SNAPSHOTS_MISSING' >&2; exit 19; }

mapfile -t db_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$prod_project" \
  --filter "label=com.docker.compose.service=$DB_SERVICE")
(( ${#db_ids[@]} == 1 )) || { echo 'POSTGRES_RUNTIME_AUTHORITY_AMBIGUOUS' >&2; exit 20; }
db_id="${db_ids[0]}"
[[ "$(safe_state "$db_id")" =~ ^(healthy|running)$ ]] || { echo 'POSTGRES_RUNTIME_UNHEALTHY' >&2; exit 20; }

env_value_from_container() {
  local id="$1" key="$2"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" \
    | awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}'
}
[[ "$(env_value_from_container "$db_id" POSTGRES_USER)" == "$DB_ADMIN" ]] || { echo 'POSTGRES_ADMIN_MISMATCH' >&2; exit 21; }
[[ "$(env_value_from_container "$db_id" POSTGRES_DB)" == "$DB_NAME" ]] || { echo 'POSTGRES_DATABASE_MISMATCH' >&2; exit 21; }

psql_admin() {
  docker exec -i "$db_id" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME" "$@"
}

role_exists="$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
[[ "$role_exists" == 0 || "$role_exists" == 1 ]] || exit 22
role_boundary='absent'
if [[ "$role_exists" == 1 ]]; then
  role_boundary="$(psql_admin -AtF $'\t' <<SQL
WITH role_row AS (
  SELECT oid, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
         rolreplication, rolbypassrls, rolconnlimit
  FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'
), non_tai AS (
  SELECT COUNT(*)::int AS count
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname='public'
    AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
    AND has_table_privilege('${ROLE_NAME}', format('%I.%I',namespace.nspname,relation.relname),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
)
SELECT role_row.rolcanlogin, role_row.rolsuper, role_row.rolcreatedb, role_row.rolcreaterole,
       role_row.rolinherit, role_row.rolreplication, role_row.rolbypassrls, role_row.rolconnlimit,
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member=role_row.oid),
       non_tai.count,
       (SELECT COUNT(*) FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}')
FROM role_row, non_tai;
SQL
)"
  [[ "$(printf '%s\n' "$role_boundary" | grep -c .)" == 1 ]] || { echo 'TAI_RUNTIME_ROLE_BOUNDARY_MISSING' >&2; exit 22; }
  IFS=$'\t' read -r can_login super createdb createrole inherit replication bypass connlimit memberships non_tai sessions <<< "$role_boundary"
  [[ "$can_login" == t && "$super" == f && "$createdb" == f && "$createrole" == f ]] || { echo 'TAI_RUNTIME_ROLE_PRIVILEGE_INVALID' >&2; exit 22; }
  [[ "$inherit" == f && "$replication" == f && "$bypass" == f && "$connlimit" == 20 ]] || { echo 'TAI_RUNTIME_ROLE_PRIVILEGE_INVALID' >&2; exit 22; }
  [[ "$memberships" == 0 && "$non_tai" == 0 ]] || { echo 'TAI_RUNTIME_ROLE_SCOPE_INVALID' >&2; exit 22; }
fi
if [[ "$ROLE_CREATED" == 1 && "$role_exists" != 1 ]]; then
  echo 'EXPECTED_CREATED_ROLE_MISSING' >&2
  exit 22
fi

# Capture only bounded, sanitized health metadata before cleanup. No environment,
# headers, model token, SQL text or container logs cross this boundary.
if ! docker exec -i "$tai_id" python - > "$diagnostic_file" <<'PY'
import json, re, urllib.error, urllib.request
safe = re.compile(r'^[A-Za-z0-9._:-]{1,160}$')
def text(v, fallback='invalid'):
    return v if isinstance(v,str) and safe.fullmatch(v) else fallback
def probe(path):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8080'+path, timeout=5) as r:
            status=r.status; raw=r.read(65537)
    except urllib.error.HTTPError as e:
        status=e.code; raw=e.read(65537)
    except Exception as e:
        return {'transport':'unreachable','errorClass':type(e).__name__}
    if len(raw)>65536: return {'httpStatus':status,'payload':'oversized'}
    try: p=json.loads(raw)
    except Exception: return {'httpStatus':status,'payload':'non_json'}
    if not isinstance(p,dict): return {'httpStatus':status,'payload':'non_object'}
    out={'httpStatus':status,'status':text(p.get('status'))}
    c=p.get('components')
    if isinstance(c,dict): out['components']={text(k):text(v) for k,v in c.items() if isinstance(k,str) and isinstance(v,str)}
    rs=p.get('reasons')
    if isinstance(rs,list): out['reasons']=[text(v) for v in rs if isinstance(v,str)][:32]
    return out
print(json.dumps({'schemaVersion':'tai.partial-deploy-health.v1','live':probe('/health/live'),'ready':probe('/health/ready'),'runtime':probe('/health/runtime')},sort_keys=True,separators=(',',':')))
PY
then
  printf '%s\n' '{"schemaVersion":"tai.partial-deploy-health.v1","diagnostic":"exec_failed"}' > "$diagnostic_file"
fi
[[ -s "$diagnostic_file" && "$(wc -c < "$diagnostic_file")" -le 65536 ]] || { echo 'DIAGNOSTIC_BOUNDARY_INVALID' >&2; exit 23; }

IFS=',' read -r -a raw_files <<< "$prod_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ "$file" == "$override" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || { echo 'BASE_COMPOSE_FILES_MISSING' >&2; exit 24; }
for file in "${compose_files[@]}"; do [[ -f "$file" && ! -L "$file" ]] || { echo 'BASE_COMPOSE_FILE_INVALID' >&2; exit 24; }; done

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
dc_current=("${dc[@]}" -f "$override")
"${dc_current[@]}" config --quiet

# Mutation starts only after every authority above passed.
"${dc_current[@]}" rm -f -s -v tai >/dev/null
mapfile -t remaining_tai < <(docker ps -aq \
  --filter "label=com.docker.compose.project=$prod_project" \
  --filter 'label=com.docker.compose.service=tai')
(( ${#remaining_tai[@]} == 0 )) || { echo 'PARTIAL_TAI_REMOVE_FAILED' >&2; exit 30; }

rm -f -- "$override" "$ENV_FILE"

role_action='preserved'
if [[ "$ROLE_CREATED" == 1 ]]; then
  for _ in $(seq 1 20); do
    sessions="$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}';")"
    [[ "$sessions" == 0 ]] && break
    sleep 1
  done
  [[ "$sessions" == 0 ]] || { echo 'TAI_RUNTIME_ROLE_SESSIONS_REMAIN' >&2; exit 31; }
  psql_admin <<SQL
REASSIGN OWNED BY ${ROLE_NAME} TO ${DB_ADMIN};
DROP OWNED BY ${ROLE_NAME};
DROP ROLE IF EXISTS ${ROLE_NAME};
SQL
  [[ "$(psql_admin -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")" == 0 ]] \
    || { echo 'TAI_RUNTIME_ROLE_DROP_FAILED' >&2; exit 31; }
  role_action='dropped-created-role'
fi

rm -f "$state_root/MUTATION_STARTED"
touch "$state_root/ROLLED_BACK" "$state_root/RECOVERED"
chmod 0600 "$state_root/ROLLED_BACK" "$state_root/RECOVERED"

python3 - "$OUTPUT_FILE" "$TARGET_SHA" "$tai_revision" "$RUN_ID" "$role_action" "$diagnostic_file" <<'PY'
import json, os, sys
out, current_sha, orphan_sha, run_id, role_action, diagnostic_path = sys.argv[1:]
diagnostic=json.load(open(diagnostic_path,encoding='utf-8'))
report={
  'schemaVersion':'tai.partial-deployment-recovery.v1',
  'authorityTargetSha':current_sha,
  'orphanTargetSha':orphan_sha,
  'runId':int(run_id),
  'taiServiceRemoved':True,
  'protectedEnvironmentRestoredAbsent':True,
  'protectedOverrideRestoredAbsent':True,
  'runtimeRoleAction':role_action,
  'schemaRollback':'FORWARD_ONLY_IDEMPOTENT',
  'apiWebMutation':False,
  'permanentModelAdmissionMutation':False,
  'healthDiagnostic':diagnostic,
  'passed':True,
}
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out,'w',encoding='utf-8') as handle:
    json.dump(report,handle,ensure_ascii=True,sort_keys=True,separators=(',',':'))
    handle.write('\n')
PY
chmod 0640 "$OUTPUT_FILE"
chown root:pcactions "$OUTPUT_FILE"

echo 'TAI_PARTIAL_DEPLOYMENT_RECOVERY=PASS'
echo "TAI_RECOVERY_AUTHORITY_SHA=$TARGET_SHA"
echo "TAI_RECOVERED_ORPHAN_SHA=$tai_revision"
