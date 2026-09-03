#!/usr/bin/env bash
set -Eeuo pipefail
set +x

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-manual}"
MIGRATION_IMAGE="${PC_ROLE_ELIGIBILITY_MIGRATION_IMAGE:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
BACKUP_EVIDENCE_B64="${PC_PROD_BACKUP_EVIDENCE_FILE_B64:-}"
TARGET_MIGRATION='20260903170000_role_eligibility_enforcement_state'
STATE_ROOT='/var/lib/pc-release-authority'

TMP_FILES=()
cleanup() {
  local file
  for file in "${TMP_FILES[@]:-}"; do rm -f -- "$file" 2>/dev/null || true; done
}
trap cleanup EXIT

emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit ROLE_ELIGIBILITY_SCHEMA_RELEASE FAIL; emit ERROR_CODE "$1"; exit "${2:-1}"; }
decode(){ [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim(){ local value="$1"; value="${value#"${value%%[![:space:]]*}"}"; value="${value%"${value##*[![:space:]]}"}"; printf '%s' "$value"; }

[[ "$ACTION" =~ ^(audit|deploy)$ ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || fail INVALID_RUN_ID 4
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 5
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 6
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 7

expected_image="ghcr.io/pachaninm-lab/grainflow-migration:sha-${TARGET_SHA:0:7}"
[[ "$MIGRATION_IMAGE" == "$expected_image" ]] || fail MIGRATION_IMAGE_REFERENCE_INVALID 8

prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"
backup_evidence="$(decode "$BACKUP_EVIDENCE_B64")"

if [[ -z "$prod_dir" || -z "$prod_compose" || -z "$prod_project" ]]; then
  mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  (( ${#web_ids[@]} == 1 )) || fail COMPOSE_WEB_AUTHORITY_AMBIGUOUS 10
  web_authority_id="${web_ids[0]}"
  [[ -n "$prod_dir" ]] || prod_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$web_authority_id")"
  [[ -n "$prod_compose" ]] || prod_compose="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$web_authority_id")"
  [[ -n "$prod_project" ]] || prod_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$web_authority_id")"
fi
[[ "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 11
[[ -n "$prod_compose" ]] || fail PRODUCTION_COMPOSE_AUTHORITY_MISSING 12
[[ "$prod_project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail PRODUCTION_PROJECT_INVALID 13

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail PRODUCTION_COMPOSE_FILE_INVALID 14
  compose_files+=("$(realpath -e -- "$file")")
done
(( ${#compose_files[@]} >= 1 )) || fail PRODUCTION_COMPOSE_AUTHORITY_EMPTY 15

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$(mktemp)"; TMP_FILES+=("$compose_json")
"${dc[@]}" config --format json > "$compose_json"

service_inventory="$(python3 - "$compose_json" <<'PY'
import json,re,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8'))
services=cfg.get('services') or {}
for required in ('api','web'):
    if required not in services:
        raise SystemExit(f'MISSING_REQUIRED_SERVICE:{required}')
migrations=[]
postgres=[]
for name,service in services.items():
    image=str(service.get('image') or '')
    command=service.get('command')
    command=' '.join(command) if isinstance(command,list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)',name,re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        migrations.append(name)
    if image.startswith('postgres:') or '/postgres:' in image:
        postgres.append(name)
if len(migrations) != 1:
    raise SystemExit(f'MIGRATION_SERVICE_COUNT:{len(migrations)}')
print(migrations[0])
print(postgres[0] if len(postgres) == 1 else '')
PY
)" || fail COMPOSE_SERVICE_DISCOVERY_FAILED 16
migration_service="$(printf '%s\n' "$service_inventory" | sed -n '1p')"
postgres_service="$(printf '%s\n' "$service_inventory" | sed -n '2p')"
[[ -n "$migration_service" ]] || fail MIGRATION_SERVICE_MISSING 17

override="$(mktemp "$prod_dir/.role-eligibility-schema-override.XXXXXX")"; TMP_FILES+=("$override")
cat > "$override" <<YAML
services:
  ${migration_service}:
    image: ${MIGRATION_IMAGE}
    pull_policy: never
YAML
chmod 0600 "$override"
dc_target=("${dc[@]}" -f "$override")
"${dc_target[@]}" config --quiet || fail COMPOSE_OVERRIDE_INVALID 18

snapshot_protected() {
  local api_id web_id worker_id api_full web_full worker_full
  api_id="$("${dc[@]}" ps -q api | head -1)"
  web_id="$("${dc[@]}" ps -q web | head -1)"
  [[ -n "$api_id" && -n "$web_id" ]] || return 1
  api_full="$(docker inspect --format '{{.Id}}|{{.Image}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{.State.Running}}' "$api_id")"
  web_full="$(docker inspect --format '{{.Id}}|{{.Image}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{.State.Running}}' "$web_id")"
  worker_id="$(docker inspect --format '{{.Id}}' pc-role-eligibility-worker 2>/dev/null || true)"
  if [[ -n "$worker_id" ]]; then
    worker_full="$(docker inspect --format '{{.Id}}|{{.Image}}|{{index .Config.Labels "org.opencontainers.image.revision"}}|{{.State.Running}}' "$worker_id")"
  else
    worker_full='ABSENT'
  fi
  printf '%s\n%s\n%s\n' "$api_full" "$web_full" "$worker_full" | sha256sum | awk '{print $1}'
}

baseline_snapshot="$(snapshot_protected)" || fail PROTECTED_RUNTIME_SNAPSHOT_FAILED 19
[[ "$baseline_snapshot" =~ ^[0-9a-f]{64}$ ]] || fail PROTECTED_RUNTIME_SNAPSHOT_INVALID 20

worker_id="$(docker inspect --format '{{.Id}}' pc-role-eligibility-worker 2>/dev/null || true)"
if [[ -n "$worker_id" ]]; then
  worker_enforcement="$(docker inspect "$worker_id" | python3 -c '
import json,sys
obj=json.load(sys.stdin)[0]
env=dict(x.split("=",1) for x in obj.get("Config",{}).get("Env",[]) if "=" in x)
print(env.get("ROLE_ELIGIBILITY_ENFORCEMENT",""))
')"
  [[ "$worker_enforcement" == false ]] || fail ENFORCEMENT_MUST_REMAIN_FALSE 21
fi

docker pull "$MIGRATION_IMAGE" >/dev/null || fail MIGRATION_IMAGE_PULL_FAILED 22
image_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$MIGRATION_IMAGE" 2>/dev/null || true)"
[[ "$image_revision" == "$TARGET_SHA" ]] || fail MIGRATION_IMAGE_REVISION_MISMATCH 23

migration_manifest="$(mktemp)"; TMP_FILES+=("$migration_manifest")
docker run --rm --entrypoint=/nodejs/bin/node "$MIGRATION_IMAGE" -e '
const fs=require("node:fs");
const names=fs.readdirSync("/app/prisma/migrations",{withFileTypes:true})
  .filter((entry)=>entry.isDirectory())
  .map((entry)=>entry.name)
  .sort();
for (const name of names) {
  if (!/^[0-9]{14}_[a-z0-9_]+$/.test(name)) process.exit(2);
  process.stdout.write(`${name}\n`);
}
' > "$migration_manifest" || fail MIGRATION_IMAGE_MANIFEST_READ_FAILED 24
[[ -s "$migration_manifest" ]] || fail MIGRATION_IMAGE_MANIFEST_EMPTY 25
[[ "$(grep -Fxc "$TARGET_MIGRATION" "$migration_manifest")" == 1 ]] || fail TARGET_MIGRATION_NOT_UNIQUE 26

build_ledger_guard() {
  local phase="$1" output="$2"
  python3 - "$phase" "$TARGET_MIGRATION" "$migration_manifest" > "$output" <<'PY'
import pathlib,re,sys
phase,target,path=sys.argv[1:]
names=[line.strip() for line in pathlib.Path(path).read_text().splitlines() if line.strip()]
if phase not in {'PRE','POST'} or not re.fullmatch(r'[0-9]{14}_[a-z0-9_]+',target):
    raise SystemExit(1)
if not names or len(names) != len(set(names)) or target not in names:
    raise SystemExit(1)
for name in names:
    if not re.fullmatch(r'[0-9]{14}_[a-z0-9_]+',name):
        raise SystemExit(1)
items=', '.join("'%s'" % name for name in names)
if phase == 'PRE':
    pending_rule=f"missing IS NULL OR missing = ARRAY['{target}']::text[]"
else:
    pending_rule='missing IS NULL'
print(f'''DO $guard$
DECLARE
  expected text[] := ARRAY[{items}]::text[];
  missing text[];
  unexpected text[];
  unresolved bigint;
BEGIN
  IF to_regclass('public._prisma_migrations') IS NULL THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_PRISMA_LEDGER_MISSING';
  END IF;
  SELECT array_agg(name ORDER BY name) INTO missing
  FROM unnest(expected) AS name
  WHERE NOT EXISTS (
    SELECT 1 FROM public._prisma_migrations AS m
    WHERE m.migration_name = name AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL
  );
  SELECT array_agg(m.migration_name ORDER BY m.migration_name) INTO unexpected
  FROM public._prisma_migrations AS m
  WHERE m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL
    AND NOT (m.migration_name = ANY(expected));
  SELECT count(*) INTO unresolved
  FROM public._prisma_migrations
  WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  IF unresolved <> 0 THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_PRISMA_LEDGER_UNRESOLVED_FAILURE';
  END IF;
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_PRISMA_LEDGER_UNEXPECTED_MIGRATION';
  END IF;
  IF NOT ({pending_rule}) THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_PENDING_MIGRATION_SET_INVALID';
  END IF;
END
$guard$;''')
PY
}

run_db_execute() {
  local sql_file="$1"
  "${dc_target[@]}" run --rm --no-deps -T --pull never "$migration_service" \
    node_modules/prisma/build/index.js db execute --schema prisma/schema.prisma --stdin \
    < "$sql_file"
}

preflight_sql="$(mktemp)"; TMP_FILES+=("$preflight_sql")
build_ledger_guard PRE "$preflight_sql" || fail LEDGER_GUARD_BUILD_FAILED 27
run_db_execute "$preflight_sql" >/dev/null || fail PRISMA_LEDGER_PREFLIGHT_FAILED 28
emit ROLE_ELIGIBILITY_SCHEMA_LEDGER_PREFLIGHT PASS

if [[ "$ACTION" == audit ]]; then
  final_snapshot="$(snapshot_protected)" || fail PROTECTED_RUNTIME_POST_AUDIT_FAILED 29
  [[ "$final_snapshot" == "$baseline_snapshot" ]] || fail PROTECTED_RUNTIME_CHANGED_DURING_AUDIT 30
  emit ROLE_ELIGIBILITY_SCHEMA_RELEASE PASS
  emit ROLE_ELIGIBILITY_SCHEMA_ACTION AUDIT
  emit ROLE_ELIGIBILITY_TARGET_SHA "$TARGET_SHA"
  emit ROLE_ELIGIBILITY_MIGRATION_IMAGE_REVISION "$image_revision"
  emit ROLE_ELIGIBILITY_PRODUCTION_DATABASE_MUTATION 0
  emit ROLE_ELIGIBILITY_ENFORCEMENT false
  emit REGISTRATION_MUTATION 0
  emit PROTECTED_RUNTIME_UNCHANGED PASS
  exit 0
fi

mkdir -p "$STATE_ROOT/backups"
chmod 0700 "$STATE_ROOT" "$STATE_ROOT/backups" 2>/dev/null || true
if [[ -n "$postgres_service" ]]; then
  pg_id="$("${dc[@]}" ps -q "$postgres_service" | head -1)"
  [[ -n "$pg_id" ]] || fail POSTGRES_RUNTIME_MISSING 31
  backup_name="role-eligibility-pre-schema-${TARGET_SHA}-${RUN_ID}.backup"
  [[ "$backup_name" =~ ^[A-Za-z0-9._:-]+\.backup$ ]] || fail BACKUP_NAME_INVALID 32
  docker exec "$pg_id" sh -ceu 'umask 077; : "${POSTGRES_USER:?}"; : "${POSTGRES_DB:?}"; pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --file="$1" "$POSTGRES_DB"' sh "/tmp/$backup_name" || fail BACKUP_CREATE_FAILED 33
  docker cp "$pg_id:/tmp/$backup_name" "$STATE_ROOT/backups/$backup_name" >/dev/null || fail BACKUP_COPY_FAILED 34
  docker exec "$pg_id" rm -f "/tmp/$backup_name" || true
  chmod 0600 "$STATE_ROOT/backups/$backup_name"
  [[ -s "$STATE_ROOT/backups/$backup_name" ]] || fail BACKUP_EMPTY 35
  sha256sum "$STATE_ROOT/backups/$backup_name" > "$STATE_ROOT/backups/$backup_name.sha256"
  chmod 0600 "$STATE_ROOT/backups/$backup_name.sha256"
  emit BACKUP_MODE LOGICAL_COMPOSE_POSTGRES
else
  [[ -n "$backup_evidence" && "$backup_evidence" == /* && -f "$backup_evidence" && ! -L "$backup_evidence" ]] || fail BACKUP_AUTHORITY_UNAVAILABLE 36
  [[ "$(stat -c '%a' "$backup_evidence")" =~ ^(400|440|600|640)$ ]] || fail BACKUP_EVIDENCE_PERMISSIONS_INVALID 37
  grep -Fqx 'STATUS=PASS' "$backup_evidence" || fail BACKUP_EVIDENCE_INVALID 38
  emit BACKUP_MODE EXTERNAL_POSTGRES_PROTECTED_EVIDENCE
fi

# This is the only production schema mutation in this executor. The exact image
# contains the immutable migration set; the preflight above permits zero pending
# migrations (idempotent replay) or exactly the Role Eligibility state migration.
"${dc_target[@]}" run --rm --no-deps -T --pull never "$migration_service" \
  node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma \
  >/dev/null || fail PRISMA_MIGRATE_DEPLOY_FAILED 39

postflight_sql="$(mktemp)"; TMP_FILES+=("$postflight_sql")
build_ledger_guard POST "$postflight_sql" || fail POST_LEDGER_GUARD_BUILD_FAILED 40
cat >> "$postflight_sql" <<'SQL'
DO $state$
DECLARE
  state_enabled boolean;
  state_generation bigint;
  control RECORD;
BEGIN
  SELECT enabled,generation INTO state_enabled,state_generation
  FROM eligibility.enforcement_state WHERE singleton=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROLE_ELIGIBILITY_ENFORCEMENT_STATE_MISSING'; END IF;
  IF state_enabled IS DISTINCT FROM FALSE OR state_generation <> 0 THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_ENFORCEMENT_STATE_NOT_FAIL_CLOSED';
  END IF;
  SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole
  INTO control FROM pg_catalog.pg_roles WHERE rolname='pc_role_eligibility_control';
  IF NOT FOUND OR control.rolcanlogin OR control.rolinherit OR control.rolsuper OR control.rolbypassrls OR control.rolcreatedb OR control.rolcreaterole THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_CONTROL_ROLE_INVALID';
  END IF;
  IF has_table_privilege('pc_role_eligibility_control','auth.registration_applications','SELECT')
     OR has_table_privilege('pc_role_eligibility_control','auth.registration_applications','INSERT')
     OR has_table_privilege('pc_role_eligibility_control','auth.registration_applications','UPDATE')
     OR has_table_privilege('pc_role_eligibility_control','auth.registration_applications','DELETE') THEN
    RAISE EXCEPTION 'ROLE_ELIGIBILITY_CONTROL_REGISTRATION_PRIVILEGE_PRESENT';
  END IF;
END
$state$;
SQL
run_db_execute "$postflight_sql" >/dev/null || fail ROLE_ELIGIBILITY_SCHEMA_POSTFLIGHT_FAILED 41

final_snapshot="$(snapshot_protected)" || fail PROTECTED_RUNTIME_POST_DEPLOY_FAILED 42
[[ "$final_snapshot" == "$baseline_snapshot" ]] || fail PROTECTED_RUNTIME_CHANGED_DURING_SCHEMA_DEPLOY 43

emit ROLE_ELIGIBILITY_SCHEMA_RELEASE PASS
emit ROLE_ELIGIBILITY_SCHEMA_ACTION DEPLOY
emit ROLE_ELIGIBILITY_TARGET_SHA "$TARGET_SHA"
emit ROLE_ELIGIBILITY_MIGRATION_IMAGE_REVISION "$image_revision"
emit ROLE_ELIGIBILITY_SCHEMA_LEDGER_POSTFLIGHT PASS
emit ROLE_ELIGIBILITY_ENFORCEMENT false
emit REGISTRATION_MUTATION 0
emit API_RUNTIME_RECREATED 0
emit WEB_RUNTIME_RECREATED 0
emit ROLE_ELIGIBILITY_WORKER_RECREATED 0
emit PROTECTED_RUNTIME_UNCHANGED PASS
