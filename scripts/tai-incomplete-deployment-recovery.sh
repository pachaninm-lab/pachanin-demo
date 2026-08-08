#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_SHA="${1:-}"
RUN_ID="${2:-}"
OUTPUT_FILE="${3:-}"

fail() {
  printf 'TAI_INCOMPLETE_RECOVERY_ERROR=%s\n' "$1" >&2
  exit "${2:-1}"
}

[[ "$CURRENT_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_CURRENT_SHA 2
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 2
[[ "$OUTPUT_FILE" == "/var/lib/pc-release-authority/runner-output/${RUN_ID}/incomplete-tai-recovery.json" ]] || fail INVALID_OUTPUT_PATH 2
[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2

readonly AUTHORITY_ROOT='/var/lib/pc-release-authority'
readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'
readonly ROLE_NAME='tai_runtime'
readonly LOCK_FILE='/run/lock/pc-tai-release-controller.lock'

exec 9>"$LOCK_FILE"
flock -n 9 || fail RELEASE_CONTROLLER_BUSY 3

[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || fail CURRENT_TAI_ENV_MISSING 10
[[ "$(stat -c '%u:%g:%a' "$ENV_FILE")" == '0:0:600' ]] || fail CURRENT_TAI_ENV_PERMISSIONS_INVALID 10
mapfile -t activation_rows < <(sed -n 's/^TAI_RESTRICTED_ACTIVATION_SHA=//p' "$ENV_FILE")
(( ${#activation_rows[@]} == 1 )) || fail CURRENT_TAI_ACTIVATION_AUTHORITY_AMBIGUOUS 11
FAILED_SHA="${activation_rows[0]}"
[[ "$FAILED_SHA" =~ ^[0-9a-f]{40}$ ]] || fail CURRENT_TAI_ACTIVATION_SHA_INVALID 11
[[ "$FAILED_SHA" != "$CURRENT_SHA" ]] || fail CURRENT_TAI_ALREADY_EXACT_MAIN 12

candidates=()
shopt -s nullglob
for state in "$AUTHORITY_ROOT"/tai-agro-os-*; do
  [[ -d "$state" && ! -L "$state" ]] || continue
  [[ -f "$state/MUTATION_STARTED" && ! -L "$state/MUTATION_STARTED" ]] || continue
  [[ ! -e "$state/ROLLED_BACK" && ! -L "$state/ROLLED_BACK" ]] || continue
  [[ ! -e "$state/ACCEPTED" && ! -L "$state/ACCEPTED" ]] || continue
  metadata="$state/metadata.env"
  [[ -f "$metadata" && ! -L "$metadata" ]] || continue
  mapfile -t target_rows < <(sed -n 's/^TARGET_SHA=//p' "$metadata")
  (( ${#target_rows[@]} == 1 )) || continue
  [[ "${target_rows[0]}" == "$FAILED_SHA" ]] || continue
  suffix="${state##*-}"
  [[ "$suffix" =~ ^[0-9]{1,20}$ ]] || continue
  candidates+=("$suffix:$state")
done
(( ${#candidates[@]} >= 1 )) || fail INCOMPLETE_STATE_NOT_FOUND 13
selected="$(printf '%s\n' "${candidates[@]}" | sort -t: -k1,1n | tail -1)"
FAILED_RUN_ID="${selected%%:*}"
STATE_ROOT="${selected#*:}"
[[ "$STATE_ROOT" == "$AUTHORITY_ROOT/tai-agro-os-$FAILED_RUN_ID" ]] || fail INCOMPLETE_STATE_SELECTION_INVALID 13
METADATA="$STATE_ROOT/metadata.env"

metadata_shell="$(mktemp)"
cleanup() { rm -f "$metadata_shell"; }
trap cleanup EXIT
python3 - "$METADATA" "$FAILED_SHA" "$STATE_ROOT" > "$metadata_shell" <<'PY'
import os,re,shlex,sys
path, expected_sha, state_root = sys.argv[1:]
allowed={
 'TARGET_SHA','TAI_IMAGE','TAI_IMAGE_DIGEST','PROD_DIR','PROD_PROJECT','OVERRIDE',
 'DB_SERVICE','DB_ADMIN','DB_NAME','ROLE_CREATED','PREVIOUS_TAI'
}
values={}
for raw in open(path,encoding='utf-8'):
    line=raw.rstrip('\n')
    if not line or '=' not in line: continue
    key,value=line.split('=',1)
    if key not in allowed or key in values: raise SystemExit('metadata authority invalid')
    if any(ch in value for ch in '\r\n\x00\t'): raise SystemExit('metadata value invalid')
    values[key]=value
required={'TARGET_SHA','PROD_DIR','PROD_PROJECT','OVERRIDE','DB_SERVICE','DB_ADMIN','DB_NAME','ROLE_CREATED','PREVIOUS_TAI'}
if not required.issubset(values): raise SystemExit('metadata required fields missing')
if values['TARGET_SHA'] != expected_sha: raise SystemExit('metadata target mismatch')
if not values['PROD_DIR'].startswith('/') or os.path.normpath(values['PROD_DIR']) != values['PROD_DIR']:
    raise SystemExit('production directory invalid')
expected_override=os.path.join(values['PROD_DIR'],'compose.tai-agro-os.override.yml')
if values['OVERRIDE'] != expected_override: raise SystemExit('override authority invalid')
for key in ('PROD_PROJECT','DB_SERVICE','DB_ADMIN','DB_NAME'):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_.-]{0,62}',values[key]): raise SystemExit(f'{key} invalid')
if values['ROLE_CREATED'] not in {'0','1'} or values['PREVIOUS_TAI'] not in {'0','1'}:
    raise SystemExit('boolean metadata invalid')
for key in required:
    print(f"{key}={shlex.quote(values[key])}")
PY
# shellcheck disable=SC1090
source "$metadata_shell"
[[ "$TARGET_SHA" == "$FAILED_SHA" ]] || fail METADATA_TARGET_MISMATCH 14
[[ -d "$PROD_DIR" ]] || fail PRODUCTION_DIRECTORY_MISSING 14

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
exact_web_ids=()
for id in "${web_ids[@]}"; do
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  [[ "$revision" == "$CURRENT_SHA" ]] && exact_web_ids+=("$id")
done
(( ${#exact_web_ids[@]} == 1 )) || fail CURRENT_WEB_EXACT_MAIN_MISSING 20
web_id="${exact_web_ids[0]}"
web_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
web_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
web_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ "$web_dir" == "$PROD_DIR" && "$web_project" == "$PROD_PROJECT" && -n "$web_files" ]] || fail CURRENT_COMPOSE_AUTHORITY_MISMATCH 20

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
exact_api_ids=()
for id in "${api_ids[@]}"; do
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
  [[ "$revision" == "$CURRENT_SHA" ]] && exact_api_ids+=("$id")
done
(( ${#exact_api_ids[@]} == 1 )) || fail CURRENT_API_EXACT_MAIN_MISSING 21

IFS=',' read -r -a raw_files <<< "$web_files"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$PROD_DIR/$file"
  [[ "$file" == "$OVERRIDE" ]] || compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail COMPOSE_AUTHORITY_EMPTY 22
for file in "${compose_files[@]}"; do [[ -f "$file" && ! -L "$file" ]] || fail COMPOSE_FILE_INVALID 22; done
DC_BASE=(docker compose --project-directory "$PROD_DIR" --project-name "$PROD_PROJECT")
for file in "${compose_files[@]}"; do DC_BASE+=(-f "$file"); done
[[ -f "$OVERRIDE" && ! -L "$OVERRIDE" ]] || fail CURRENT_TAI_OVERRIDE_MISSING 23
DC_TAI=("${DC_BASE[@]}" -f "$OVERRIDE")
"${DC_TAI[@]}" config --quiet || fail CURRENT_TAI_COMPOSE_INVALID 23

mapfile -t tai_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$PROD_PROJECT" --filter 'label=com.docker.compose.service=tai')
(( ${#tai_ids[@]} == 1 )) || fail CURRENT_TAI_CONTAINER_AUTHORITY_AMBIGUOUS 24
tai_id="${tai_ids[0]}"
tai_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$tai_id" 2>/dev/null || true)"
tai_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$tai_id" 2>/dev/null || true)"
[[ "$tai_revision" == "$FAILED_SHA" ]] || fail CURRENT_TAI_FAILED_SHA_MISMATCH 24
[[ "$tai_state" != healthy ]] || fail CURRENT_TAI_IS_HEALTHY 25

for base in 'tai-agro-os.env' 'compose.tai-agro-os.override.yml'; do
  before="$STATE_ROOT/${base}.before"
  absent="$STATE_ROOT/${base}.absent"
  count=0
  [[ -f "$before" && ! -L "$before" ]] && count=$((count+1))
  [[ -f "$absent" && ! -L "$absent" ]] && count=$((count+1))
  (( count == 1 )) || fail ROLLBACK_SNAPSHOT_INVALID 26
done

mapfile -t db_ids < <(docker ps -q --filter "label=com.docker.compose.project=$PROD_PROJECT" --filter "label=com.docker.compose.service=$DB_SERVICE")
(( ${#db_ids[@]} == 1 )) || fail DATABASE_RUNTIME_AUTHORITY_AMBIGUOUS 30
DB_ID="${db_ids[0]}"
db_admin_runtime="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^POSTGRES_USER=//p')"
db_name_runtime="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_ID" | sed -n 's/^POSTGRES_DB=//p')"
[[ "$db_admin_runtime" == "$DB_ADMIN" && "$db_name_runtime" == "$DB_NAME" ]] || fail DATABASE_IDENTITY_MISMATCH 30
psql_admin=(docker exec -i "$DB_ID" psql -X --set ON_ERROR_STOP=1 -U "$DB_ADMIN" -d "$DB_NAME")

role_action='PRESERVED_PREEXISTING'
if [[ "$ROLE_CREATED" == 1 ]]; then
  role_boundary="$("${psql_admin[@]}" -AtF $'\t' <<SQL
WITH role_row AS (
  SELECT oid, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolreplication, rolbypassrls
  FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}'
), non_tai AS (
  SELECT COUNT(*)::int AS count
  FROM pg_catalog.pg_class relation
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
  WHERE namespace.nspname='public'
    AND relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'
    AND relation.relkind IN ('r','v','m','p','f')
    AND has_table_privilege('${ROLE_NAME}',format('%I.%I',namespace.nspname,relation.relname),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
)
SELECT role_row.rolsuper,role_row.rolcreatedb,role_row.rolcreaterole,role_row.rolinherit,
       role_row.rolreplication,role_row.rolbypassrls,
       (SELECT COUNT(*) FROM pg_catalog.pg_auth_members WHERE member=role_row.oid),
       (SELECT COUNT(*) FROM pg_catalog.pg_stat_activity WHERE usename='${ROLE_NAME}'),
       non_tai.count
FROM role_row,non_tai;
SQL
)"
  [[ -n "$role_boundary" ]] || fail CREATED_RUNTIME_ROLE_MISSING 31
  IFS=$'\t' read -r super createdb createrole inherit replication bypass memberships sessions non_tai <<< "$role_boundary"
  [[ "$super" == f && "$createdb" == f && "$createrole" == f && "$inherit" == f && "$replication" == f && "$bypass" == f ]] || fail CREATED_RUNTIME_ROLE_PRIVILEGED 31
  [[ "$memberships" == 0 && "$sessions" == 0 && "$non_tai" == 0 ]] || fail CREATED_RUNTIME_ROLE_NOT_SAFE_TO_DROP 31
  role_action='DROP_CREATED_ROLE'
fi

OUTPUT_DIR="${OUTPUT_FILE%/*}"
install -d -m 0750 -o root -g root "$OUTPUT_DIR"
RECOVERY_ROOT="$AUTHORITY_ROOT/incomplete-recovery-$RUN_ID"
[[ ! -e "$RECOVERY_ROOT" ]] || fail RECOVERY_STATE_ALREADY_EXISTS 32
install -d -m 0700 -o root -g root "$RECOVERY_ROOT"
cp -a "$ENV_FILE" "$RECOVERY_ROOT/current-env.before"
cp -a "$OVERRIDE" "$RECOVERY_ROOT/current-override.before"
printf '%s\n' "$FAILED_RUN_ID" > "$RECOVERY_ROOT/recovered-run-id"
printf '%s\n' "$FAILED_SHA" > "$RECOVERY_ROOT/recovered-target-sha"

restore_snapshot() {
  local target="$1" base="$2"
  if [[ -f "$STATE_ROOT/${base}.before" && ! -L "$STATE_ROOT/${base}.before" ]]; then
    install -m 0600 -o root -g root "$STATE_ROOT/${base}.before" "$target"
  elif [[ -f "$STATE_ROOT/${base}.absent" && ! -L "$STATE_ROOT/${base}.absent" ]]; then
    rm -f "$target"
  else
    return 1
  fi
}

# Mutation begins only after every authority check above passes.
"${DC_TAI[@]}" rm -f -s -v tai >/dev/null
restore_snapshot "$OVERRIDE" 'compose.tai-agro-os.override.yml' || fail OVERRIDE_RESTORE_FAILED 40
restore_snapshot "$ENV_FILE" 'tai-agro-os.env' || fail ENV_RESTORE_FAILED 40

if [[ "$ROLE_CREATED" == 1 ]]; then
  "${psql_admin[@]}" <<SQL >/dev/null
REASSIGN OWNED BY ${ROLE_NAME} TO ${DB_ADMIN};
DROP OWNED BY ${ROLE_NAME};
DROP ROLE ${ROLE_NAME};
SQL
  role_action='DROPPED_CREATED_ROLE'
fi

if [[ "$PREVIOUS_TAI" == 1 ]]; then
  [[ -f "$OVERRIDE" && ! -L "$OVERRIDE" ]] || fail PREVIOUS_TAI_OVERRIDE_NOT_RESTORED 41
  DC_RESTORED=("${DC_BASE[@]}" -f "$OVERRIDE")
  "${DC_RESTORED[@]}" config --quiet || fail PREVIOUS_TAI_COMPOSE_INVALID 41
  "${DC_RESTORED[@]}" up -d --no-deps --pull never tai >/dev/null
else
  mapfile -t remaining_tai < <(docker ps -aq --filter "label=com.docker.compose.project=$PROD_PROJECT" --filter 'label=com.docker.compose.service=tai')
  (( ${#remaining_tai[@]} == 0 )) || fail TAI_CONTAINER_REMAINS_AFTER_RECOVERY 42
fi

if [[ "$ROLE_CREATED" == 1 ]]; then
  role_count="$("${psql_admin[@]}" -Atc "SELECT COUNT(*) FROM pg_catalog.pg_roles WHERE rolname='${ROLE_NAME}';")"
  [[ "$role_count" == 0 ]] || fail CREATED_RUNTIME_ROLE_REMAINS 43
fi

touch "$STATE_ROOT/ROLLED_BACK"
printf '%s\n' "$RUN_ID" > "$STATE_ROOT/RECOVERED_BY_RUN"

python3 - "$OUTPUT_FILE" "$CURRENT_SHA" "$FAILED_SHA" "$FAILED_RUN_ID" "$PREVIOUS_TAI" "$role_action" <<'PY'
import json,os,sys
path,current_sha,failed_sha,failed_run,previous_tai,role_action=sys.argv[1:]
payload={
  'schemaVersion':'tai.incomplete-deployment-recovery.v1',
  'currentSha':current_sha,
  'recoveredTargetSha':failed_sha,
  'recoveredRunId':failed_run,
  'previousTaiRestored':previous_tai == '1',
  'runtimeRoleAction':role_action,
  'productionHosting':'REG_RU_VPS_ONLY',
  'newRecurringCostRub':0,
  'passed':True,
}
with open(path,'w',encoding='utf-8') as h:
    json.dump(payload,h,ensure_ascii=True,separators=(',',':')); h.write('\n')
os.chmod(path,0o640)
PY
chown root:root "$OUTPUT_FILE"
printf 'TAI_INCOMPLETE_DEPLOYMENT_RECOVERY=PASS\n'
printf 'RECOVERED_TARGET_SHA=%s\n' "$FAILED_SHA"
printf 'RECOVERED_RUN_ID=%s\n' "$FAILED_RUN_ID"
