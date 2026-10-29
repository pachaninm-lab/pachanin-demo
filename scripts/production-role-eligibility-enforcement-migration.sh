#!/usr/bin/env bash
set -Eeuo pipefail
set +x

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-}"
MIGRATION_IMAGE="${PC_ROLE_ELIGIBILITY_MIGRATION_IMAGE:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
BACKUP_EVIDENCE_B64="${PC_PROD_BACKUP_EVIDENCE_FILE_B64:-${PC_BACKUP_EVIDENCE_FILE_B64:-}}"
STATE_ROOT="/var/lib/pc-role-eligibility-enforcement"
OVERRIDE_NAME="compose.role-eligibility-enforcement-migration.override.yml"
MIGRATION_NAME="20260903170000_role_eligibility_enforcement_state"
OVERRIDE_CREATED=0

emit(){ printf '%s=%s\n' "$1" "$2"; }
decode(){ [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
fail(){ emit ROLE_ELIGIBILITY_ENFORCEMENT_MIGRATION FAIL; emit ERROR_CODE "$1"; exit "${2:-1}"; }
cleanup(){
  local rc=$?
  trap - EXIT
  if [[ "$OVERRIDE_CREATED" == 1 && -n "${override:-}" ]]; then rm -f -- "$override"; fi
  rm -f -- "${compose_json:-}" 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT

[[ "$ACTION" =~ ^(audit|migrate)$ ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[A-Za-z0-9._:-]{1,64}$ ]] || fail INVALID_RUN_ID 4
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 5
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 6
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 7
command -v sha256sum >/dev/null 2>&1 || fail SHA256SUM_REQUIRED 8

expected_image="ghcr.io/pachaninm-lab/grainflow-migration:sha-${TARGET_SHA:0:7}"
if [[ "$ACTION" == migrate ]]; then
  [[ "$MIGRATION_IMAGE" == "$expected_image" ]] || fail MIGRATION_IMAGE_REFERENCE_INVALID 9
fi

mapfile -t api_ids < <(docker ps -q --no-trunc --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING 11

prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"
backup_evidence="$(decode "$BACKUP_EVIDENCE_B64")"
[[ -n "$prod_dir" ]] || prod_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$api_id")"
[[ -n "$prod_compose" ]] || prod_compose="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$api_id")"
[[ -n "$prod_project" ]] || prod_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$api_id")"
[[ "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 12
prod_dir="$(realpath -e -- "$prod_dir")"
[[ -n "$prod_compose" ]] || fail PRODUCTION_COMPOSE_AUTHORITY_MISSING 13
[[ "$prod_project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail PRODUCTION_PROJECT_INVALID 14

override="$prod_dir/$OVERRIDE_NAME"
[[ "$override" == "$prod_dir"/* ]] || fail OVERRIDE_PATH_INVALID 15
[[ ! -e "$override" ]] || fail OVERRIDE_ALREADY_PRESENT 16

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail PRODUCTION_COMPOSE_FILE_INVALID 17
  file="$(realpath -e -- "$file")"
  [[ "$file" == "$override" ]] && continue
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail PRODUCTION_COMPOSE_AUTHORITY_EMPTY 18

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
"${dc[@]}" config --quiet || fail PRODUCTION_COMPOSE_CONFIG_INVALID 19

compose_json="$(mktemp)"
"${dc[@]}" config --format json > "$compose_json"
service_inventory="$(python3 - "$compose_json" <<'PY'
import json,re,sys
from urllib.parse import urlsplit
cfg=json.load(open(sys.argv[1], encoding='utf-8'))
services=cfg.get('services') or {}
if 'api' not in services or 'web' not in services:
    raise SystemExit(1)
candidates=[]
postgres=[]
for name,svc in services.items():
    image=str(svc.get('image') or '')
    command=svc.get('command')
    command=' '.join(str(x) for x in command) if isinstance(command,list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)',name,re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append(name)
    if image.startswith('postgres:') or '/postgres:' in image:
        postgres.append(name)
if len(candidates)!=1 or len(postgres)>1:
    raise SystemExit(1)
name=candidates[0]
svc=services[name]
command=svc.get('command')
command=' '.join(str(x) for x in command) if isinstance(command,list) else str(command or '')
if command and not ('prisma' in command and 'migrate' in command and 'deploy' in command):
    raise SystemExit(1)
env=svc.get('environment') or {}
if isinstance(env,list):
    env=dict(item.split('=',1) for item in env if isinstance(item,str) and '=' in item)
value=str(env.get('DATABASE_URL') or '').strip()
url=urlsplit(value)
if url.scheme not in ('postgresql','postgres') or not url.username or not url.password or not url.hostname or not url.path.strip('/'):
    raise SystemExit(1)
print(name)
print(postgres[0] if postgres else '')
PY
)" || fail COMPOSE_SERVICE_DISCOVERY_FAILED 20
migration_service="$(printf '%s\n' "$service_inventory" | sed -n '1p')"
postgres_service="$(printf '%s\n' "$service_inventory" | sed -n '2p')"
[[ "$migration_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail MIGRATION_SERVICE_INVALID 21

compose_id(){ "${dc[@]}" ps -q "$1" | head -1; }
web_id="$(compose_id web)"
[[ -n "$web_id" && "$(docker inspect --format '{{.State.Running}}' "$web_id" 2>/dev/null || true)" == true ]] || fail WEB_NOT_RUNNING 22

project_snapshot(){
  local id service image_id state restarts
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$id" 2>/dev/null || true)"
    image_id="$(docker inspect --format '{{.Image}}' "$id" 2>/dev/null || true)"
    state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
    restarts="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || true)"
    [[ -n "$service" && "$image_id" =~ ^sha256:[0-9a-f]{64}$ && "$state" == running && "$restarts" =~ ^[0-9]+$ ]] || return 1
    printf '%s\t%s\t%s\t%s\t%s\n' "$service" "$id" "$image_id" "$state" "$restarts"
  done < <(docker ps -q --no-trunc --filter "label=com.docker.compose.project=$prod_project") \
    | sort | sha256sum | awk '{print $1}'
}

state_probe(){
  local id="$1"
  docker exec -i "$id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
(async () => {
  const rel = await prisma.$queryRawUnsafe("SELECT to_regclass('eligibility.enforcement_state')::text AS rel");
  if (!rel?.[0]?.rel) {
    process.stdout.write('STATE_TABLE=ABSENT\n');
    return;
  }
  const rows = await prisma.$queryRawUnsafe(`
    SELECT enabled, generation::text AS generation,
           policy_id IS NULL AS policy_id_null,
           exact_sha IS NULL AS exact_sha_null
    FROM eligibility.enforcement_state
    WHERE singleton = 1
  `);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('STATE_SINGLETON_INVALID');
  const boundary = await prisma.$queryRawUnsafe(`
    SELECT
      COALESCE((SELECT NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
                FROM pg_catalog.pg_roles WHERE rolname = 'pc_role_eligibility_control'), FALSE) AS control_role_ok,
      has_table_privilege(current_user, 'eligibility.enforcement_state', 'SELECT') AS state_select,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'eligibility'
          AND p.proname = 'set_enforcement_state'
          AND has_function_privilege(current_user, p.oid, 'EXECUTE')
      ) AS control_execute
  `);
  const row = rows[0];
  const guard = boundary[0] ?? {};
  process.stdout.write([
    'STATE_TABLE=PRESENT',
    `STATE_ENABLED=${row.enabled === true ? 'true' : 'false'}`,
    `STATE_GENERATION=${String(row.generation)}`,
    `STATE_POLICY_ID_NULL=${row.policy_id_null === true ? 'true' : 'false'}`,
    `STATE_EXACT_SHA_NULL=${row.exact_sha_null === true ? 'true' : 'false'}`,
    `CONTROL_ROLE_OK=${guard.control_role_ok === true ? 'true' : 'false'}`,
    `API_STATE_SELECT=${guard.state_select === true ? 'true' : 'false'}`,
    `API_CONTROL_EXECUTE=${guard.control_execute === true ? 'true' : 'false'}`,
  ].join('\n') + '\n');
})().catch((error) => {
  process.stderr.write(`ROLE_ELIGIBILITY_STATE_PROBE_FAILED:${String(error?.message ?? error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect().catch(() => undefined);
});
NODE
}

assert_disabled_default(){
  local probe="$1"
  grep -Fxq 'STATE_TABLE=PRESENT' <<< "$probe" || return 1
  grep -Fxq 'STATE_ENABLED=false' <<< "$probe" || return 1
  grep -Fxq 'STATE_GENERATION=0' <<< "$probe" || return 1
  grep -Fxq 'STATE_POLICY_ID_NULL=true' <<< "$probe" || return 1
  grep -Fxq 'STATE_EXACT_SHA_NULL=true' <<< "$probe" || return 1
  grep -Fxq 'CONTROL_ROLE_OK=true' <<< "$probe" || return 1
  grep -Fxq 'API_STATE_SELECT=true' <<< "$probe" || return 1
  grep -Fxq 'API_CONTROL_EXECUTE=false' <<< "$probe" || return 1
}

baseline_snapshot="$(project_snapshot)" || fail BASELINE_PROJECT_SNAPSHOT_INVALID 23
[[ "$baseline_snapshot" =~ ^[0-9a-f]{64}$ ]] || fail BASELINE_PROJECT_SNAPSHOT_INVALID 23
baseline_probe="$(state_probe "$api_id")" || fail BASELINE_STATE_PROBE_FAILED 24
if grep -Fxq 'STATE_TABLE=PRESENT' <<< "$baseline_probe"; then
  grep -Fxq 'STATE_ENABLED=false' <<< "$baseline_probe" || fail PREEXISTING_ENFORCEMENT_ENABLED 25
fi

if [[ "$ACTION" == audit ]]; then
  assert_disabled_default "$baseline_probe" || fail ENFORCEMENT_STATE_NOT_DEFAULT_DISABLED 26
  emit ROLE_ELIGIBILITY_ENFORCEMENT_MIGRATION PASS
  emit ROLE_ELIGIBILITY_TARGET_SHA "$TARGET_SHA"
  emit ROLE_ELIGIBILITY_ENFORCEMENT false
  emit ROLE_ELIGIBILITY_STATE_GENERATION 0
  emit REGISTRATION_RUNTIME_UNCHANGED PASS
  emit API_WEB_RUNTIME_UNCHANGED PASS
  emit PRODUCTION_DATABASE_MUTATION 0
  exit 0
fi

docker pull "$MIGRATION_IMAGE" >/dev/null || fail MIGRATION_IMAGE_PULL_FAILED 27
image_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$MIGRATION_IMAGE" 2>/dev/null || true)"
[[ "$image_revision" == "$TARGET_SHA" ]] || fail MIGRATION_IMAGE_REVISION_MISMATCH 28
image_user="$(docker image inspect --format '{{.Config.User}}' "$MIGRATION_IMAGE" 2>/dev/null || true)"
[[ -n "$image_user" && "$image_user" != 0 && "$image_user" != root ]] || fail MIGRATION_IMAGE_ROOT_FORBIDDEN 29
image_cmd="$(docker image inspect --format '{{json .Config.Cmd}}' "$MIGRATION_IMAGE" 2>/dev/null || true)"
python3 - "$image_cmd" <<'PY' || fail MIGRATION_IMAGE_COMMAND_INVALID 30
import json,sys
cmd=json.loads(sys.argv[1])
expected=['node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma']
if cmd != expected:
    raise SystemExit(1)
PY

docker run --rm --entrypoint /nodejs/bin/node "$MIGRATION_IMAGE" -e \
  "const fs=require('node:fs');const p='/app/prisma/migrations/${MIGRATION_NAME}/migration.sql';if(!fs.existsSync(p)||fs.statSync(p).size<1000)process.exit(1)" \
  >/dev/null || fail TARGET_MIGRATION_MISSING_FROM_IMAGE 31

install -d -m 0700 -o root -g root "$STATE_ROOT" "$STATE_ROOT/backups"
if [[ -n "$postgres_service" ]]; then
  pg_id="$(compose_id "$postgres_service")"
  [[ -n "$pg_id" && "$(docker inspect --format '{{.State.Running}}' "$pg_id" 2>/dev/null || true)" == true ]] || fail POSTGRES_RUNTIME_MISSING 32
  backup_name="pre-enforcement-state-${TARGET_SHA}-${RUN_ID}.backup"
  docker exec "$pg_id" sh -ceu 'umask 077; : "${POSTGRES_USER:?}"; : "${POSTGRES_DB:?}"; pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --file="$1" "$POSTGRES_DB"' sh "/tmp/$backup_name" \
    || fail DATABASE_BACKUP_FAILED 33
  docker cp "$pg_id:/tmp/$backup_name" "$STATE_ROOT/backups/$backup_name" >/dev/null || fail DATABASE_BACKUP_COPY_FAILED 34
  docker exec "$pg_id" rm -f "/tmp/$backup_name" >/dev/null 2>&1 || true
  chmod 0600 "$STATE_ROOT/backups/$backup_name"
  [[ -s "$STATE_ROOT/backups/$backup_name" ]] || fail DATABASE_BACKUP_EMPTY 35
  sha256sum "$STATE_ROOT/backups/$backup_name" > "$STATE_ROOT/backups/$backup_name.sha256"
  chmod 0600 "$STATE_ROOT/backups/$backup_name.sha256"
  backup_mode='LOGICAL_COMPOSE_POSTGRES'
elif [[ -n "$backup_evidence" && "$backup_evidence" == /* && -f "$backup_evidence" && ! -L "$backup_evidence" ]]; then
  [[ "$(stat -c '%a' "$backup_evidence")" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS 36
  grep -Fq 'STATUS=PASS' "$backup_evidence" || fail BACKUP_EVIDENCE_INVALID 37
  backup_mode='PROTECTED_EXTERNAL_EVIDENCE'
else
  fail BACKUP_AUTHORITY_UNAVAILABLE 38
fi

cat > "$override" <<YAML
services:
  ${migration_service}:
    image: ${MIGRATION_IMAGE}
    pull_policy: never
YAML
chmod 0600 "$override"
OVERRIDE_CREATED=1
dc_target=("${dc[@]}" -f "$override")
"${dc_target[@]}" config --quiet || fail MIGRATION_OVERRIDE_CONFIG_INVALID 39
configured_image="$("${dc_target[@]}" config --format json | python3 -c 'import json,sys; c=json.load(sys.stdin); print((c.get("services") or {}).get(sys.argv[1],{}).get("image") or "")' "$migration_service")"
[[ "$configured_image" == "$MIGRATION_IMAGE" ]] || fail MIGRATION_IMAGE_AUTHORITY_MISMATCH 40

emit ROLE_ELIGIBILITY_DATABASE_BACKUP PASS
emit ROLE_ELIGIBILITY_BACKUP_MODE "$backup_mode"
emit ROLE_ELIGIBILITY_MIGRATION_MUTATION_STARTED 1
"${dc_target[@]}" run --rm --no-deps --pull never "$migration_service" >/dev/null \
  || fail PRISMA_MIGRATE_DEPLOY_FAILED 41

rm -f -- "$override"
OVERRIDE_CREATED=0

current_api_id="$(compose_id api)"
current_web_id="$(compose_id web)"
[[ "$current_api_id" == "$api_id" && "$current_web_id" == "$web_id" ]] || fail API_WEB_CONTAINER_CHANGED 42
after_snapshot="$(project_snapshot)" || fail AFTER_PROJECT_SNAPSHOT_INVALID 43
[[ "$after_snapshot" == "$baseline_snapshot" ]] || fail PROTECTED_RUNTIME_CHANGED 44
post_probe="$(state_probe "$current_api_id")" || fail POST_MIGRATION_STATE_PROBE_FAILED 45
assert_disabled_default "$post_probe" || fail ENFORCEMENT_STATE_NOT_DEFAULT_DISABLED 46

emit ROLE_ELIGIBILITY_ENFORCEMENT_MIGRATION PASS
emit ROLE_ELIGIBILITY_TARGET_SHA "$TARGET_SHA"
emit ROLE_ELIGIBILITY_MIGRATION_NAME "$MIGRATION_NAME"
emit ROLE_ELIGIBILITY_ENFORCEMENT false
emit ROLE_ELIGIBILITY_STATE_GENERATION 0
emit ROLE_ELIGIBILITY_CONTROL_ROLE_BOUNDARY PASS
emit ROLE_ELIGIBILITY_RUNTIME_WRITE_AUTHORITY DENIED
emit REGISTRATION_RUNTIME_UNCHANGED PASS
emit API_WEB_RUNTIME_UNCHANGED PASS
emit PRODUCTION_DATABASE_MUTATION ROLE_ELIGIBILITY_SCHEMA_ONLY
exit 0
