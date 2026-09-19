#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_PROD_SSH_USER:?PC_PROD_SSH_USER is required}"
: "${PC_PROD_SSH_HOST_FINGERPRINT:?PC_PROD_SSH_HOST_FINGERPRINT is required}"

SUBJECT_PRODUCTION_SHA='280c63ab70d428bfe893bade9ad6acc4446c88c5'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
DEFAULT_HOST='195.19.12.120'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-first-customer-preflight-diagnostic 280c'
PRODUCTION_MUTATION='NONE'

[[ "${PC_P0_PREFLIGHT_DIAGNOSTIC_COMMAND:-}" == "$COMMAND" ]]

key="$RUNNER_TEMP/pc-p0-preflight-diagnostic-key"
known_hosts="$RUNNER_TEMP/pc-p0-preflight-diagnostic-known-hosts"
raw="$RUNNER_TEMP/pc-p0-preflight-diagnostic-raw"
safe="$RUNNER_TEMP/pc-p0-preflight-diagnostic-safe"

cleanup() {
  rm -f -- "$key" "$known_hosts" "$raw" "$safe"
}
trap cleanup EXIT

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_repository() {
  local live_main
  live_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$live_main" =~ ^[0-9a-f]{40}$ ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$live_main" ]]
  [[ "$(git rev-parse origin/main)" == "$live_main" ]]
  git cat-file -e "${SUBJECT_PRODUCTION_SHA}^{commit}"
  git merge-base --is-ancestor "$SUBJECT_PRODUCTION_SHA" "$live_main"
  [[ -z "$(git status --porcelain=v1)" ]]
  printf '%s' "$live_main"
}

diagnostic_main="$(guard_repository)"

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "$PC_PROD_SSH_USER")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "$PC_PROD_SSH_HOST_FINGERPRINT")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$host"

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key"
  chmod 0600 "$key"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key" > "$public_key" 2>/dev/null || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}

try_slot() {
  local raw_key="$1" plain escaped decoded
  [[ -n "$raw_key" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
  printf '%s\n' "$raw_key" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${raw_key//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$raw_key" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

try_slot "${PC_PROD_SSH_KEY:-}" \
  || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_slot "${VPS_SSH_KEY:-}"

scan="$(mktemp)"; match="$(mktemp)"; pinned=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
    [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
  done < "$scan"
  sort -u -o "$match" "$match"
  [[ "$(grep -c . "$match" || true)" == 1 ]] && { pinned=1; break; }
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned" == 1 ]]
mv "$match" "$known_hosts"; rm -f "$scan"; chmod 0600 "$known_hosts"

ssh_opts=(
  -i "$key" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
ssh "${ssh_opts[@]}" "$user@$host" \
  'set -Eeuo pipefail; [[ "$(id -u)" -eq 0 ]]; docker version >/dev/null; python3 --version >/dev/null; echo SSH_AUTH_OK' \
  | grep -Fxq SSH_AUTH_OK

guard_repository >/dev/null
: > "$raw"; : > "$safe"; chmod 0600 "$raw" "$safe"
set +e
ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$SUBJECT_PRODUCTION_SHA'" > "$raw" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
umask 077
target_sha="$1"
tmp="$(mktemp -d /tmp/pc-p0-preflight-diagnostic.XXXXXX)"
compose_phase=NOT_RUN
auth_phase=NOT_RUN
admin_phase=NOT_RUN
cleanup_remote(){ rm -rf -- "$tmp"; }
trap cleanup_remote EXIT
emit(){ printf '%s=%s\n' "$1" "$2"; }
finish_fail(){
  local code="$1" rc="${2:-80}"
  [[ "$code" =~ ^[A-Z0-9_]{4,100}$ ]] || code=UNEXPECTED_REMOTE_ERROR
  emit P0_PREFLIGHT_DIAGNOSTIC FAIL
  emit COMPOSE_PHASE "$compose_phase"
  emit AUTH_PHASE "$auth_phase"
  emit ADMIN_PHASE "$admin_phase"
  emit ERROR_CODE "$code"
  emit PRODUCTION_MUTATION NONE
  exit "$rc"
}
unexpected(){ local rc=$?; trap - ERR; finish_fail UNEXPECTED_REMOTE_ERROR "$rc"; }
trap unexpected ERR

[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]] || finish_fail SUBJECT_SHA_INVALID 20
[[ "$(id -u)" -eq 0 ]] || finish_fail ROOT_REQUIRED 21
command -v docker >/dev/null 2>&1 || finish_fail DOCKER_REQUIRED 22
command -v python3 >/dev/null 2>&1 || finish_fail PYTHON_REQUIRED 23

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || finish_fail WEB_RUNTIME_CARDINALITY 24
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || finish_fail COMPOSE_PROJECT_INVALID 25
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || finish_fail API_RUNTIME_CARDINALITY 26
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" ]] || finish_fail PRODUCTION_REVISION_MISMATCH 27

working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" && -n "$config_files" ]] \
  || finish_fail COMPOSE_AUTHORITY_INVALID 28
working_dir="$(realpath -e -- "$working_dir")"
dc=(docker compose --project-directory "$working_dir" --project-name "$project")
IFS=',' read -r -a raw_files <<< "$config_files"
compose_files=()
for raw_file in "${raw_files[@]}"; do
  file="${raw_file#"${raw_file%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$working_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || finish_fail COMPOSE_FILE_INVALID 29
  file="$(realpath -e -- "$file")"
  [[ "$file" == "$working_dir"/* ]] || finish_fail COMPOSE_FILE_OUTSIDE_AUTHORITY 30
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || finish_fail COMPOSE_FILE_CARDINALITY 31
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$tmp/compose.json"; inventory="$tmp/migration.inventory"; migration_db="$tmp/migration.db"
: > "$compose_json"; : > "$inventory"; : > "$migration_db"
chmod 0600 "$compose_json" "$inventory" "$migration_db"
"${dc[@]}" config --format json > "$compose_json" || finish_fail COMPOSE_RENDER_FAILED 32
python3 - "$compose_json" "$inventory" "$migration_db" <<'PY' || finish_fail MIGRATION_DATASOURCE_DISCOVERY_FAILED 33
import json,re,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8'))
services=cfg.get('services') or {}
candidates=[]
for name,service in services.items():
    image=str(service.get('image') or '')
    command=service.get('command')
    command=' '.join(command) if isinstance(command,list) else str(command or '')
    if re.search(r'(^|[-_])(migrate|migration)([-_]|$)',name,re.I) or 'grainflow-migration' in image or ('prisma' in command and 'migrate' in command):
        candidates.append((name,service,image))
if len(candidates)!=1: raise SystemExit(1)
name,service,image=candidates[0]
environment=service.get('environment') or {}
database_url=environment.get('DATABASE_URL') if isinstance(environment,dict) else None
if not image or not isinstance(database_url,str) or not database_url.strip() or '\n' in database_url or '\r' in database_url or '\0' in database_url: raise SystemExit(1)
open(sys.argv[2],'w',encoding='utf-8').write(name+'\n'+image+'\n')
open(sys.argv[3],'w',encoding='utf-8').write(database_url)
PY
migration_image="$(sed -n '2p' "$inventory")"
migration_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$migration_image" 2>/dev/null || true)"
[[ "$migration_revision" == "$target_sha" ]] || finish_fail MIGRATION_IMAGE_REVISION_MISMATCH 34
compose_phase=PASS

set +e
auth_output="$(docker exec -i "$api_id" /nodejs/bin/node - preflight 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');
const [mode] = process.argv.slice(2);
const knownRoles = new Set(['pc_auth_runtime','one_deal_auth','app_auth']);
const fail = code => { throw new Error(code); };
let prisma;
(async()=>{
  if (!process.env.AUTH_DATABASE_URL) fail('P0_AUTH_DATABASE_URL_MISSING');
  if (mode !== 'preflight') fail('P0_AUTH_EVIDENCE_MODE_INVALID');
  prisma = new PrismaClient({datasources:{db:{url:process.env.AUTH_DATABASE_URL}}});
  const roleName = await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const principals=await tx.$queryRawUnsafe(`SELECT role.rolname AS role_name,role.rolsuper,role.rolbypassrls,has_schema_privilege(current_user,'public','USAGE') AS schema_usage,has_table_privilege(current_user,'public.user_orgs','SELECT') AS membership_select FROM pg_catalog.pg_roles role WHERE role.rolname=current_user`);
    const tables=await tx.$queryRawUnsafe(`SELECT class.relrowsecurity,class.relforcerowsecurity FROM pg_catalog.pg_class class WHERE class.oid='public.user_orgs'::regclass`);
    const p=principals[0],t=tables[0];
    if(!p||!knownRoles.has(p.role_name)||p.rolsuper!==false||p.rolbypassrls!==false||p.schema_usage!==true||p.membership_select!==true||t?.relrowsecurity!==true||t?.relforcerowsecurity!==true) fail('P0_AUTH_RUNTIME_PRINCIPAL_INVALID');
    return p.role_name;
  });
  process.stdout.write(`AUTH_PRINCIPAL|${roleName}\n`);
})().catch(error=>{const c=/^[A-Z0-9_]{4,100}$/.test(String(error?.message||''))?String(error.message):'P0_AUTH_RUNTIME_READ_ONLY_EVIDENCE_FAILED';process.stdout.write(`AUTH_ERROR|${c}\n`);process.exitCode=1;}).finally(async()=>{if(prisma)await prisma.$disconnect().catch(()=>{});});
NODE
)"
auth_rc=$?
set -e
if (( auth_rc != 0 )); then
  auth_code="$(sed -nE 's/^AUTH_ERROR\|([A-Z0-9_]{4,100})$/\1/p' <<< "$auth_output" | tail -1)"
  [[ -n "$auth_code" ]] || auth_code=P0_POSTGRES_RLS_RUNTIME_ROLE_MISSING
  finish_fail "$auth_code" 35
fi
[[ "$auth_output" =~ ^AUTH_PRINCIPAL\|(pc_auth_runtime|one_deal_auth|app_auth)$ ]] || finish_fail P0_POSTGRES_RLS_RUNTIME_ROLE_MISSING 36
auth_phase=PASS

read -r -d '' admin_node <<'NODE' || true
const fs=require('node:fs');
const {PrismaClient}=require('@prisma/client');
const databaseUrl=fs.readFileSync(0,'utf8').trim();
const fail=code=>{throw new Error(code);};
const contains=(value,marker)=>typeof value==='string'&&value.includes(marker);
let prisma;
(async()=>{
  if(!databaseUrl) fail('P0_MIGRATION_DATABASE_AUTHORITY_MISSING');
  prisma=new PrismaClient({datasources:{db:{url:databaseUrl}}});
  const roleName=await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe('SET LOCAL ROLE pc_registration_receipt_authority');
    const principals=await tx.$queryRawUnsafe(`SELECT role.rolname AS role_name,role.rolcanlogin,role.rolinherit,role.rolsuper,role.rolbypassrls,role.rolcreatedb,role.rolcreaterole,(SELECT count(*)::integer FROM pg_catalog.pg_auth_members membership WHERE membership.roleid=role.oid) AS member_count FROM pg_catalog.pg_roles role WHERE role.rolname=current_user`);
    const tables=await tx.$queryRawUnsafe(`SELECT class.relrowsecurity,class.relforcerowsecurity FROM pg_catalog.pg_class class WHERE class.oid='public.outbox_entries'::regclass`);
    const scope=await tx.$queryRawUnsafe(`SELECT row_security_active('public.outbox_entries') AS rls_active,EXISTS(SELECT 1 FROM public."outbox_entries" entry WHERE entry."type" IS DISTINCT FROM 'auth.registration.lifecycle.receipt' OR COALESCE(entry."idempotencyKey",'') NOT LIKE 'registration-lifecycle:%') AS out_of_scope_visible`);
    const policies=await tx.$queryRawUnsafe(`SELECT policy.policyname,policy.cmd,policy.roles::text AS roles_text,policy.qual,policy.with_check FROM pg_catalog.pg_policies policy WHERE policy.schemaname='public' AND policy.tablename='outbox_entries' AND policy.policyname IN ('outbox_entries_registration_receipt_select','outbox_entries_registration_receipt_insert') ORDER BY policy.policyname`);
    const privileges=await tx.$queryRawUnsafe(`SELECT has_table_privilege(current_user,'public.outbox_entries','SELECT') AS outbox_select,has_table_privilege(current_user,'public.outbox_entries','INSERT') AS outbox_insert,has_table_privilege(current_user,'auth.registration_applications','SELECT') AS applications_select,has_table_privilege(current_user,'auth.registration_application_events','SELECT') AS events_select,has_table_privilege(current_user,'auth.audit_events','SELECT') AS audit_select,(has_table_privilege(current_user,'public.outbox_entries','UPDATE') OR has_any_column_privilege(current_user,'public.outbox_entries','UPDATE') OR has_table_privilege(current_user,'public.outbox_entries','DELETE') OR has_table_privilege(current_user,'public.outbox_entries','TRUNCATE') OR has_table_privilege(current_user,'auth.registration_applications','INSERT') OR has_any_column_privilege(current_user,'auth.registration_applications','INSERT') OR has_table_privilege(current_user,'auth.registration_applications','UPDATE') OR has_any_column_privilege(current_user,'auth.registration_applications','UPDATE') OR has_table_privilege(current_user,'auth.registration_applications','DELETE') OR has_table_privilege(current_user,'auth.registration_applications','TRUNCATE') OR has_table_privilege(current_user,'auth.registration_application_events','INSERT') OR has_any_column_privilege(current_user,'auth.registration_application_events','INSERT') OR has_table_privilege(current_user,'auth.registration_application_events','UPDATE') OR has_any_column_privilege(current_user,'auth.registration_application_events','UPDATE') OR has_table_privilege(current_user,'auth.registration_application_events','DELETE') OR has_table_privilege(current_user,'auth.registration_application_events','TRUNCATE') OR has_table_privilege(current_user,'auth.audit_events','INSERT') OR has_any_column_privilege(current_user,'auth.audit_events','INSERT') OR has_table_privilege(current_user,'auth.audit_events','UPDATE') OR has_any_column_privilege(current_user,'auth.audit_events','UPDATE') OR has_table_privilege(current_user,'auth.audit_events','DELETE') OR has_table_privilege(current_user,'auth.audit_events','TRUNCATE')) AS forbidden_write_privilege`);
    const triggers=await tx.$queryRawUnsafe(`SELECT count(*)::integer AS trigger_count FROM pg_catalog.pg_trigger trigger JOIN pg_catalog.pg_class relation ON relation.oid=trigger.tgrelid JOIN pg_catalog.pg_namespace schema ON schema.oid=relation.relnamespace WHERE schema.nspname='auth' AND relation.relname='audit_events' AND trigger.tgname IN ('auth_audit_events_append_only','auth_audit_events_no_truncate') AND trigger.tgenabled<>'D'`);
    const producer=await tx.$queryRawUnsafe(`SELECT pg_get_functiondef(function.oid) AS definition,function.prosecdef,function.proconfig,owner.rolname AS owner_name,EXISTS(SELECT 1 FROM aclexplode(COALESCE(function.proacl,acldefault('f',function.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute FROM pg_catalog.pg_proc function JOIN pg_catalog.pg_namespace schema ON schema.oid=function.pronamespace JOIN pg_catalog.pg_roles owner ON owner.oid=function.proowner WHERE schema.nspname='auth' AND function.oid=to_regprocedure('auth.emit_registration_lifecycle_receipt(text,text)')`);
    const p=principals[0],table=tables[0],s=scope[0],v=privileges[0],f=producer[0],definition=f?.definition;
    const byName=new Map(policies.map(policy=>[policy.policyname,policy]));
    const selectPolicy=byName.get('outbox_entries_registration_receipt_select');
    const insertPolicy=byName.get('outbox_entries_registration_receipt_insert');
    if(p?.role_name!=='pc_registration_receipt_authority'||p.rolcanlogin!==false||p.rolinherit!==false||p.rolsuper!==false||p.rolbypassrls!==false||p.rolcreatedb!==false||p.rolcreaterole!==false||Number(p.member_count)!==0) fail('RECEIPT_PRINCIPAL_INVALID');
    if(table?.relrowsecurity!==true||table?.relforcerowsecurity!==true||s?.rls_active!==true||s?.out_of_scope_visible!==false) fail('OUTBOX_RLS_SCOPE_INVALID');
    if(policies.length!==2||selectPolicy?.cmd!=='SELECT'||!contains(selectPolicy?.roles_text,'pc_registration_receipt_authority')||!contains(selectPolicy?.qual,'pc_registration_receipt_authority')||!contains(selectPolicy?.qual,'auth.registration.lifecycle.receipt')||insertPolicy?.cmd!=='INSERT'||!contains(insertPolicy?.roles_text,'pc_registration_receipt_authority')||!contains(insertPolicy?.with_check,'pc_registration_receipt_authority')||!contains(insertPolicy?.with_check,'auth.registration.lifecycle.receipt')||!contains(insertPolicy?.with_check,'registration-lifecycle:')) fail('OUTBOX_POLICY_INVALID');
    if(v?.outbox_select!==true||v?.outbox_insert!==true||v?.applications_select!==true||v?.events_select!==true||v?.audit_select!==true||v?.forbidden_write_privilege!==false) fail('RECEIPT_PRIVILEGE_INVALID');
    if(Number(triggers[0]?.trigger_count)!==2) fail('AUDIT_APPEND_ONLY_INVALID');
    if(f?.prosecdef!==true||f?.owner_name!=='pc_registration_receipt_authority'||f?.public_execute!==false||!Array.isArray(f?.proconfig)||!f.proconfig.includes('row_security=on')||!f.proconfig.includes('search_path=pg_catalog, pg_temp')||typeof definition!=='string'||!definition.includes("SET row_security TO 'on'")||!definition.includes('auth.registration.lifecycle.receipt')||!definition.includes('registration-lifecycle:')||!definition.includes('auth.audit_events')) fail('CAUSAL_RECEIPT_PRODUCER_INVALID');
    return p.role_name;
  });
  process.stdout.write(`ADMIN_PRINCIPAL|${roleName}\n`);
})().catch(error=>{const c=/^[A-Z0-9_]{4,100}$/.test(String(error?.message||''))?String(error.message):'P0_ADMIN_READ_ONLY_EVIDENCE_FAILED';process.stdout.write(`ADMIN_ERROR|${c}\n`);process.exitCode=1;}).finally(async()=>{if(prisma)await prisma.$disconnect().catch(()=>{});});
NODE

set +e
admin_output="$(cat "$migration_db" | docker exec -i "$api_id" /nodejs/bin/node -e "$admin_node" 2>/dev/null)"
admin_rc=$?
set -e
if (( admin_rc != 0 )); then
  admin_code="$(sed -nE 's/^ADMIN_ERROR\|([A-Z0-9_]{4,100})$/\1/p' <<< "$admin_output" | tail -1)"
  [[ -n "$admin_code" ]] || admin_code=MISSING_P0_CAUSAL_OUTBOX_PRODUCER
  finish_fail "$admin_code" 37
fi
[[ "$admin_output" == 'ADMIN_PRINCIPAL|pc_registration_receipt_authority' ]] || finish_fail MISSING_P0_CAUSAL_OUTBOX_PRODUCER 38
admin_phase=PASS

emit P0_PREFLIGHT_DIAGNOSTIC PASS
emit COMPOSE_PHASE PASS
emit AUTH_PHASE PASS
emit ADMIN_PHASE PASS
emit ERROR_CODE NONE
emit PRODUCTION_MUTATION NONE
REMOTE
remote_rc=$?
set -e

grep -E '^(P0_PREFLIGHT_DIAGNOSTIC|COMPOSE_PHASE|AUTH_PHASE|ADMIN_PHASE|ERROR_CODE|PRODUCTION_MUTATION)=(PASS|FAIL|NOT_RUN|NONE|[A-Z0-9_]{4,100})$' "$raw" > "$safe" || true
[[ "$(grep -c '^P0_PREFLIGHT_DIAGNOSTIC=' "$safe" || true)" == 1 ]]
[[ "$(grep -c '^COMPOSE_PHASE=' "$safe" || true)" == 1 ]]
[[ "$(grep -c '^AUTH_PHASE=' "$safe" || true)" == 1 ]]
[[ "$(grep -c '^ADMIN_PHASE=' "$safe" || true)" == 1 ]]
[[ "$(grep -c '^ERROR_CODE=' "$safe" || true)" == 1 ]]
[[ "$(grep -c '^PRODUCTION_MUTATION=' "$safe" || true)" == 1 ]]
grep -Fxq 'PRODUCTION_MUTATION=NONE' "$safe"
if grep -Eqi '(postgres(?:ql)?://|password|token|secret|cookie|@|container|network)' "$safe"; then
  exit 90
fi

result="$(sed -n 's/^P0_PREFLIGHT_DIAGNOSTIC=//p' "$safe")"
compose="$(sed -n 's/^COMPOSE_PHASE=//p' "$safe")"
auth="$(sed -n 's/^AUTH_PHASE=//p' "$safe")"
admin="$(sed -n 's/^ADMIN_PHASE=//p' "$safe")"
error_code="$(sed -n 's/^ERROR_CODE=//p' "$safe")"
[[ "$result" == PASS || "$result" == FAIL ]]
[[ "$compose" =~ ^(PASS|FAIL|NOT_RUN)$ ]]
[[ "$auth" =~ ^(PASS|FAIL|NOT_RUN)$ ]]
[[ "$admin" =~ ^(PASS|FAIL|NOT_RUN)$ ]]
[[ "$error_code" =~ ^(NONE|[A-Z0-9_]{4,100})$ ]]
[[ "$remote_rc" =~ ^[0-9]+$ ]]

guard_repository >/dev/null

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 first-customer read-only preflight diagnostic

- deployed subject: \`$SUBJECT_PRODUCTION_SHA\`
- diagnostic main: \`$diagnostic_main\`
- result: \`$result\`
- compose / migration authority: \`$compose\`
- auth RLS authority: \`$auth\`
- causal receipt authority: \`$admin\`
- blocker: \`$error_code\`
- remote rc: \`$remote_rc\`
- production mutation: \`$PRODUCTION_MUTATION\`" >/dev/null

printf 'P0_PREFLIGHT_DIAGNOSTIC=%s\n' "$result"
printf 'COMPOSE_PHASE=%s\n' "$compose"
printf 'AUTH_PHASE=%s\n' "$auth"
printf 'ADMIN_PHASE=%s\n' "$admin"
printf 'ERROR_CODE=%s\n' "$error_code"
printf 'PRODUCTION_MUTATION=%s\n' "$PRODUCTION_MUTATION"
