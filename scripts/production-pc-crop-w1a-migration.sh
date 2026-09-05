#!/usr/bin/env bash
set -Eeuo pipefail
set +x

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-}"
TARGET_MIGRATION="20260904120000_organization_capability_authority"
MIGRATION_IMAGE="${PC_CROP_W1A_MIGRATION_IMAGE:-}"
EXPECTED_MIGRATIONS_B64="${PC_CROP_W1A_EXPECTED_MIGRATIONS_B64:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
BACKUP_EVIDENCE_B64="${PC_PROD_BACKUP_EVIDENCE_FILE_B64:-${PC_BACKUP_EVIDENCE_FILE_B64:-}}"
STATE_ROOT="/var/lib/pc-crop-w1a-migration"
OVERRIDE_NAME="compose.pc-crop-w1a-migration.override.yml"
OVERRIDE_CREATED=0

emit(){ printf '%s=%s\n' "$1" "$2"; }
decode(){ [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
fail(){ emit PC_CROP_W1A_MIGRATION FAIL; emit ERROR_CODE "$1"; exit "${2:-1}"; }
cleanup(){
  local rc=$?
  trap - EXIT
  if [[ "$OVERRIDE_CREATED" == 1 && -n "${override:-}" ]]; then rm -f -- "$override"; fi
  rm -f -- "${compose_json:-}" 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT

[[ "$ACTION" == migrate ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[A-Za-z0-9._:-]{1,64}$ ]] || fail INVALID_RUN_ID 4
[[ -n "$EXPECTED_MIGRATIONS_B64" ]] || fail EXPECTED_MIGRATIONS_REQUIRED 5
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 6
for command in docker python3 sha256sum realpath; do command -v "$command" >/dev/null 2>&1 || fail "${command^^}_REQUIRED" 7; done

expected_image="ghcr.io/pachaninm-lab/grainflow-migration:w1a-sha-${TARGET_SHA:0:7}"
[[ "$MIGRATION_IMAGE" == "$expected_image" ]] || fail MIGRATION_IMAGE_REFERENCE_INVALID 8

mapfile -t api_ids < <(docker ps -q --no-trunc --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING 11
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
api_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_image_id" 2>/dev/null || true)"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || fail API_REVISION_INVALID 12

web_id="$(docker ps -q --no-trunc --filter 'label=com.docker.compose.service=web' | head -1)"
[[ "$web_id" =~ ^[0-9a-f]{64}$ && "$(docker inspect --format '{{.State.Running}}' "$web_id")" == true ]] || fail WEB_NOT_RUNNING 13

worker_id="$(docker inspect --format '{{.Id}}' pc-role-eligibility-worker 2>/dev/null || true)"
[[ "$worker_id" =~ ^[0-9a-f]{64}$ ]] || fail ROLE_ELIGIBILITY_WORKER_NOT_FOUND 14
[[ "$(docker inspect --format '{{.State.Running}}' "$worker_id")" == true ]] || fail ROLE_ELIGIBILITY_WORKER_NOT_RUNNING 15
readarray -t worker_flags < <(docker inspect "$worker_id" | python3 -c '
import json,sys
obj=json.load(sys.stdin)[0]
env=dict(x.split("=",1) for x in obj.get("Config",{}).get("Env",[]) if "=" in x)
for key in ("RUNTIME_COMPONENT","ROLE_ELIGIBILITY_ENABLED","ROLE_ELIGIBILITY_SHADOW_MODE","ROLE_ELIGIBILITY_ENFORCEMENT"):
    print(env.get(key,""))
')
[[ "${worker_flags[0]:-}" == role-eligibility-worker ]] || fail ROLE_ELIGIBILITY_COMPONENT_INVALID 16
[[ "${worker_flags[1]:-}" == true ]] || fail ROLE_ELIGIBILITY_WORKER_DISABLED 17
[[ "${worker_flags[2]:-}" == true ]] || fail ROLE_ELIGIBILITY_NOT_SHADOW 18
[[ "${worker_flags[3]:-}" == false ]] || fail ROLE_ELIGIBILITY_ENFORCEMENT_MUST_REMAIN_FALSE 19

prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"
backup_evidence="$(decode "$BACKUP_EVIDENCE_B64")"
[[ -n "$prod_dir" ]] || prod_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$api_id")"
[[ -n "$prod_compose" ]] || prod_compose="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$api_id")"
[[ -n "$prod_project" ]] || prod_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$api_id")"
[[ "$prod_dir" == /* && "$prod_dir" != / && -d "$prod_dir" && ! -L "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 20
prod_dir="$(realpath -e -- "$prod_dir")"
[[ -n "$prod_compose" ]] || fail PRODUCTION_COMPOSE_AUTHORITY_MISSING 21
[[ "$prod_project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail PRODUCTION_PROJECT_INVALID 22

override="$prod_dir/$OVERRIDE_NAME"
[[ "$override" == "$prod_dir"/* ]] || fail OVERRIDE_PATH_INVALID 23
[[ ! -e "$override" ]] || fail OVERRIDE_ALREADY_PRESENT 24

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail PRODUCTION_COMPOSE_FILE_INVALID 25
  file="$(realpath -e -- "$file")"
  [[ "$file" == "$override" ]] && continue
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail PRODUCTION_COMPOSE_AUTHORITY_EMPTY 26

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
"${dc[@]}" config --quiet || fail PRODUCTION_COMPOSE_CONFIG_INVALID 27
compose_json="$(mktemp)"
"${dc[@]}" config --format json > "$compose_json"
service_inventory="$(python3 - "$compose_json" <<'PY'
import json,re,sys
cfg=json.load(open(sys.argv[1], encoding='utf-8'))
services=cfg.get('services') or {}
candidates=[]; postgres=[]
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
env=services[name].get('environment') or {}
if isinstance(env,list): env=dict(item.split('=',1) for item in env if isinstance(item,str) and '=' in item)
value=str(env.get('DATABASE_URL') or '').strip()
if not value.startswith(('postgresql://','postgres://')):
    raise SystemExit(1)
print(name)
print(postgres[0] if postgres else '')
PY
)" || fail COMPOSE_SERVICE_DISCOVERY_FAILED 28
migration_service="$(printf '%s\n' "$service_inventory" | sed -n '1p')"
postgres_service="$(printf '%s\n' "$service_inventory" | sed -n '2p')"
[[ "$migration_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] || fail MIGRATION_SERVICE_INVALID 29

project_fingerprint(){
  local id service image state restart started
  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$id" 2>/dev/null || true)"
    image="$(docker inspect --format '{{.Image}}' "$id" 2>/dev/null || true)"
    state="$(docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || true)"
    restart="$(docker inspect --format '{{.RestartCount}}' "$id" 2>/dev/null || true)"
    started="$(docker inspect --format '{{.State.StartedAt}}' "$id" 2>/dev/null || true)"
    [[ -n "$service" && "$image" =~ ^sha256:[0-9a-f]{64}$ && "$state" == running && "$restart" =~ ^[0-9]+$ ]] || return 1
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$service" "$id" "$image" "$state" "$restart" "$started"
  done < <(docker ps -q --no-trunc --filter "label=com.docker.compose.project=$prod_project" | sort)
  printf 'role-eligibility\t%s\t%s\t%s\t%s\t%s\n' \
    "$worker_id" \
    "$(docker inspect --format '{{.Image}}' "$worker_id")" \
    "$(docker inspect --format '{{.State.Status}}' "$worker_id")" \
    "$(docker inspect --format '{{.RestartCount}}' "$worker_id")" \
    "$(docker inspect --format '{{.State.StartedAt}}' "$worker_id")"
}

baseline_fingerprint="$(project_fingerprint | sha256sum | awk '{print $1}')" || fail BASELINE_RUNTIME_FINGERPRINT_INVALID 30
[[ "$baseline_fingerprint" =~ ^[0-9a-f]{64}$ ]] || fail BASELINE_RUNTIME_FINGERPRINT_INVALID 30

read_only_probe(){
  docker exec -e EXPECTED_MIGRATIONS_B64="$EXPECTED_MIGRATIONS_B64" -e TARGET_MIGRATION="$TARGET_MIGRATION" -e PROBE_PHASE="$1" -i "$api_id" /nodejs/bin/node - <<'NODE'
'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const expected = Buffer.from(process.env.EXPECTED_MIGRATIONS_B64 || '', 'base64').toString('utf8').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
const target = process.env.TARGET_MIGRATION || '';
const phase = process.env.PROBE_PHASE || '';
if (!target || !expected.includes(target) || new Set(expected).size !== expected.length) throw new Error('EXPECTED_MIGRATION_SET_INVALID');
(async()=>{
  const out=await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10000ms'");
    const mode=await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    if(mode?.[0]?.mode!=='on') throw new Error('READ_ONLY_NOT_ACTIVE');
    const ledger=await tx.$queryRawUnsafe('SELECT migration_name, finished_at, rolled_back_at FROM public."_prisma_migrations"');
    const successful=new Set(ledger.filter(r=>r.finished_at!=null&&r.rolled_back_at==null).map(r=>String(r.migration_name)));
    const unfinished=new Set(ledger.filter(r=>r.finished_at==null&&r.rolled_back_at==null).map(r=>String(r.migration_name)));
    const pending=expected.filter(n=>!successful.has(n));
    const unfinishedExpected=expected.filter(n=>unfinished.has(n));
    const rel=await tx.$queryRawUnsafe(`SELECT c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('organization_capability_assignments','organization_capability_events') ORDER BY c.relname`);
    const by=new Map(rel.map(r=>[String(r.name),{rls:Boolean(r.rls),force:Boolean(r.force)}]));
    if(phase==='pre'){
      if(unfinishedExpected.length!==0) throw new Error('UNFINISHED_REPOSITORY_MIGRATION');
      if(pending.length!==1||pending[0]!==target) throw new Error('TARGET_NOT_SOLE_PENDING');
      if(by.size!==0) throw new Error('TARGET_SCHEMA_PREEXISTS');
    } else if(phase==='post'){
      if(unfinishedExpected.length!==0||pending.length!==0) throw new Error('POST_MIGRATION_LEDGER_INCOMPLETE');
      if(!successful.has(target)) throw new Error('TARGET_MIGRATION_NOT_APPLIED');
      for(const name of ['organization_capability_assignments','organization_capability_events']){
        const x=by.get(name); if(!x||!x.rls||!x.force) throw new Error(`RLS_INVARIANT_FAILED:${name}`);
      }
    } else throw new Error('PROBE_PHASE_INVALID');
    return {phase,pending:pending.length,unfinished:unfinishedExpected.length,targetApplied:successful.has(target),tables:by.size,forceRls:[...by.values()].filter(x=>x.rls&&x.force).length};
  },{isolationLevel:'RepeatableRead'});
  process.stdout.write(JSON.stringify(out)+'\n');
})().catch(e=>{console.error(`PC_CROP_W1A_PROBE_FAIL=${e?.message||String(e)}`);process.exitCode=1;}).finally(async()=>prisma.$disconnect());
NODE
}

pre_probe="$(read_only_probe pre)" || fail PRE_MUTATION_READ_ONLY_PROBE_FAILED 31
emit PC_CROP_W1A_PRE_MUTATION_READ_ONLY PASS

docker pull "$MIGRATION_IMAGE" >/dev/null || fail MIGRATION_IMAGE_PULL_FAILED 32
image_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$MIGRATION_IMAGE" 2>/dev/null || true)"
[[ "$image_revision" == "$TARGET_SHA" ]] || fail MIGRATION_IMAGE_REVISION_MISMATCH 33
image_user="$(docker image inspect --format '{{.Config.User}}' "$MIGRATION_IMAGE" 2>/dev/null || true)"
[[ -n "$image_user" && "$image_user" != 0 && "$image_user" != root ]] || fail MIGRATION_IMAGE_ROOT_FORBIDDEN 34
image_cmd="$(docker image inspect --format '{{json .Config.Cmd}}' "$MIGRATION_IMAGE" 2>/dev/null || true)"
python3 - "$image_cmd" <<'PY' || fail MIGRATION_IMAGE_COMMAND_INVALID 35
import json,sys
cmd=json.loads(sys.argv[1])
if cmd != ['node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma']:
    raise SystemExit(1)
PY
docker run --rm --entrypoint /nodejs/bin/node "$MIGRATION_IMAGE" -e \
  "const fs=require('node:fs');const p='/app/prisma/migrations/${TARGET_MIGRATION}/migration.sql';const raw=fs.readFileSync(p,'utf8');const s=raw.replace(/--.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');if(s.length<1000||/^\s*(?:INSERT\s+INTO|UPDATE\s+[\w\".]+\s+SET|DELETE\s+FROM|TRUNCATE\s+)/im.test(s)||/registration|eligibility\./i.test(s))process.exit(1)" \
  >/dev/null || fail TARGET_MIGRATION_CONTENT_INVALID 36

install -d -m 0700 -o root -g root "$STATE_ROOT" "$STATE_ROOT/backups"
if [[ -n "$postgres_service" ]]; then
  pg_id="$("${dc[@]}" ps -q "$postgres_service" | head -1)"
  [[ -n "$pg_id" && "$(docker inspect --format '{{.State.Running}}' "$pg_id" 2>/dev/null || true)" == true ]] || fail POSTGRES_RUNTIME_MISSING 37
  backup_name="pre-w1a-${TARGET_SHA}-${RUN_ID}.backup"
  docker exec "$pg_id" sh -ceu 'umask 077; : "${POSTGRES_USER:?}"; : "${POSTGRES_DB:?}"; pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --file="$1" "$POSTGRES_DB"' sh "/tmp/$backup_name" || fail DATABASE_BACKUP_FAILED 38
  docker cp "$pg_id:/tmp/$backup_name" "$STATE_ROOT/backups/$backup_name" >/dev/null || fail DATABASE_BACKUP_COPY_FAILED 39
  docker exec "$pg_id" rm -f "/tmp/$backup_name" >/dev/null 2>&1 || true
  chmod 0600 "$STATE_ROOT/backups/$backup_name"
  [[ -s "$STATE_ROOT/backups/$backup_name" ]] || fail DATABASE_BACKUP_EMPTY 40
  sha256sum "$STATE_ROOT/backups/$backup_name" > "$STATE_ROOT/backups/$backup_name.sha256"
  chmod 0600 "$STATE_ROOT/backups/$backup_name.sha256"
  backup_mode='LOGICAL_COMPOSE_POSTGRES'
elif [[ -n "$backup_evidence" && "$backup_evidence" == /* && -f "$backup_evidence" && ! -L "$backup_evidence" ]]; then
  [[ "$(stat -c %u "$backup_evidence")" == 0 ]] || fail BACKUP_EVIDENCE_OWNER_INVALID 41
  [[ $(( $(date +%s) - $(stat -c %Y "$backup_evidence") )) -le 86400 ]] || fail BACKUP_EVIDENCE_STALE 42
  grep -Fq 'STATUS=PASS' "$backup_evidence" || fail BACKUP_EVIDENCE_INVALID 43
  backup_mode='PROTECTED_EXTERNAL_EVIDENCE'
else
  fail DATABASE_BACKUP_AUTHORITY_UNAVAILABLE 44
fi
emit PC_CROP_W1A_BACKUP_MODE "$backup_mode"

cat > "$override" <<EOF2
services:
  $migration_service:
    image: $MIGRATION_IMAGE
    command: ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"]
EOF2
chmod 0600 "$override"
OVERRIDE_CREATED=1

dcm=("${dc[@]}" -f "$override")
"${dcm[@]}" config --quiet || fail MIGRATION_OVERRIDE_INVALID 45
"${dcm[@]}" run --rm --no-deps "$migration_service" || fail PRISMA_MIGRATE_DEPLOY_FAILED 46

physical_sql="$(mktemp)"
cat > "$physical_sql" <<'SQL'
SET row_security = off;
DO $pc_w1a$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."_prisma_migrations"
    WHERE migration_name = '20260904120000_organization_capability_authority'
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL
  ) THEN RAISE EXCEPTION 'PC_W1A_TARGET_MIGRATION_MISSING'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='organization_capability_assignments'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN RAISE EXCEPTION 'PC_W1A_ASSIGNMENTS_RLS_INVALID'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='organization_capability_events'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN RAISE EXCEPTION 'PC_W1A_EVENTS_RLS_INVALID'; END IF;
  IF (SELECT count(*) FROM public."organization_capability_assignments") <> 0 THEN
    RAISE EXCEPTION 'PC_W1A_ASSIGNMENTS_NOT_EMPTY';
  END IF;
  IF (SELECT count(*) FROM public."organization_capability_events") <> 0 THEN
    RAISE EXCEPTION 'PC_W1A_EVENTS_NOT_EMPTY';
  END IF;
END
$pc_w1a$;
SQL
"${dcm[@]}" run --rm --no-deps -T --entrypoint /nodejs/bin/node "$migration_service" \
  node_modules/prisma/build/index.js db execute --schema prisma/schema.prisma --stdin < "$physical_sql" \
  >/dev/null || { rm -f "$physical_sql"; fail PHYSICAL_EMPTY_RLS_ASSERTION_FAILED 47; }
rm -f "$physical_sql"

post_probe="$(read_only_probe post)" || fail POST_MUTATION_READ_ONLY_PROBE_FAILED 48
emit PC_CROP_W1A_POST_MUTATION_READ_ONLY PASS

final_fingerprint="$(project_fingerprint | sha256sum | awk '{print $1}')" || fail FINAL_RUNTIME_FINGERPRINT_INVALID 49
[[ "$final_fingerprint" == "$baseline_fingerprint" ]] || fail API_WEB_OR_ROLE_ELIGIBILITY_RUNTIME_CHANGED 50

readarray -t final_worker_flags < <(docker inspect "$worker_id" | python3 -c '
import json,sys
obj=json.load(sys.stdin)[0]
env=dict(x.split("=",1) for x in obj.get("Config",{}).get("Env",[]) if "=" in x)
print(env.get("ROLE_ELIGIBILITY_SHADOW_MODE","")); print(env.get("ROLE_ELIGIBILITY_ENFORCEMENT",""))
')
[[ "${final_worker_flags[0]:-}" == true && "${final_worker_flags[1]:-}" == false ]] || fail ROLE_ELIGIBILITY_FLAGS_CHANGED 51

emit PC_CROP_W1A_MIGRATION PASS
emit PC_CROP_W1A_TARGET_SHA "$TARGET_SHA"
emit PC_CROP_W1A_DEPLOYED_API_SHA "$api_revision"
emit PC_CROP_W1A_TARGET_APPLIED true
emit PC_CROP_W1A_PENDING_MIGRATIONS 0
emit PC_CROP_W1A_ASSIGNMENTS_ROWS 0
emit PC_CROP_W1A_EVENTS_ROWS 0
emit PC_CROP_W1A_FORCE_RLS PASS
emit API_WEB_RUNTIME_UNCHANGED PASS
emit ROLE_ELIGIBILITY_RUNTIME_UNCHANGED PASS
emit ROLE_ELIGIBILITY_ENFORCEMENT false
emit REGISTRATION_RUNTIME_UNCHANGED PASS
emit PRODUCTION_DATABASE_MUTATION BOUNDED_W1A_MIGRATION
