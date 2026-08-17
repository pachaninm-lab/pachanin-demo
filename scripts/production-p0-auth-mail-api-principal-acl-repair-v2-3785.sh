#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V2_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-api-principal-acl-repair-v2 31986790721 current-main'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'
TARGET_MIGRATION_PATH="apps/api/prisma/migrations/${MIGRATION_NAME}/migration.sql"
FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-api-principal-acl-repair-v2-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-api-principal-acl-repair-v2-known-hosts"
scan=''
match=''
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
MUTATION='NONE'
ROLLBACK='NOT_NEEDED'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="${1:-1}"
  trap - ERR
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair v2

- repair main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- raw DB role / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deployment / API-Web restart: \`NONE\`
- new mandatory cost: \`0 RUB\`
- exit code: \`$rc\`" >/dev/null || true
  exit "$rc"
}
on_err() { local rc="$?"; publish_failure "$rc"; }
trap on_err ERR

trim() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}

guard_main() {
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

LOCAL_STAGE='AUTHORITY'
[[ "$PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V2_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'true' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]
[[ -f "$TARGET_MIGRATION_PATH" ]]
grep -Fq 'OWNER TO pc_auth_mail_enqueue_authority' "$TARGET_MIGRATION_PATH"
grep -Fq 'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox' "$TARGET_MIGRATION_PATH"
grep -Fq 'REVOKE ALL ON TABLE auth.mail_outbox FROM PUBLIC' "$TARGET_MIGRATION_PATH"

LOCAL_STAGE='SSH_INPUT'
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

validate_key() {
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }
  rm -f "$pub"
}
try_key() {
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"
  validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"
  validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"
  return 1
}
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

LOCAL_STAGE='HOST_PIN'
guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"; match="$(mktemp)"; pinned=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    [[ "$(grep -c . "$match" || true)" == 1 ]] && { pinned=1; break; }
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned" == 1 ]]
mv "$match" "$known_hosts"; match=''
rm -f "$scan"; scan=''
chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

LOCAL_STAGE='REMOTE_PREFLIGHT'
guard_main
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; docker compose version >/dev/null' >/dev/null

LOCAL_STAGE='SAFE_INVENTORY'
guard_main
if inventory="$(ssh "${ssh_opts[@]}" "$user@$host" 'bash -s' 2>/dev/null <<'REMOTE_INVENTORY'
set -Eeuo pipefail
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_DB_MUTATION|NONE\n'
  exit "$rc"
}
trap remote_exit EXIT
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='API_IDENTITY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
role_digest=''
for id in "${api_ids[@]}"; do
  docker exec "$id" node -e "require.resolve('@prisma/client')" >/dev/null 2>&1
  one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_IDENTITY'
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const known = new Set([
  'pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app',
  'pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority'
]);
async function run() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT current_user::text AS effective_role, session_user::text AS session_role,
           r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication
    FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
  `);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('shape');
  const x = rows[0];
  if (!x.effective_role || x.effective_role !== x.session_role) throw new Error('session-role-drift');
  if (known.has(x.effective_role)) throw new Error('known-role');
  if (x.rolsuper || x.rolbypassrls || x.rolcreatedb || x.rolcreaterole || x.rolreplication) throw new Error('privileged-role');
  if (/[\u0000\r\n]/.test(x.effective_role) || Buffer.byteLength(x.effective_role,'utf8') > 63) throw new Error('invalid-role');
  const digest = crypto.createHash('sha256').update(x.effective_role, 'utf8').digest('hex');
  process.stdout.write(`SAFE_OTHER|${digest}\n`);
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_IDENTITY
)"
  [[ "$one" =~ ^SAFE_OTHER\|[0-9a-f]{64}$ ]]
  candidate="${one#SAFE_OTHER|}"
  if [[ -z "$role_digest" ]]; then role_digest="$candidate"; else [[ "$candidate" == "$role_digest" ]]; fi
done
api_ids_digest="$(printf '%s\n' "${api_ids[@]}" | sha256sum | awk '{print $1}')"
[[ "$api_ids_digest" =~ ^[0-9a-f]{64}$ ]]

REMOTE_STAGE='MIGRATION_AUTHORITY'
web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" && -d "$prod_dir" ]]
IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"; file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]]
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$("${dc[@]}" config --format json)"
service_line="$(printf '%s' "$compose_json" | python3 -c '
import json,re,sys
cfg=json.load(sys.stdin); services=cfg.get("services") or {}; c=[]
for name,svc in services.items():
    image=str(svc.get("image") or ""); command=svc.get("command"); command=" ".join(command) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command): c.append((name,image,svc))
if len(c)!=1: raise SystemExit(1)
name,image,svc=c[0]; env=svc.get("environment") or {}
if isinstance(env,list): env={str(x).split("=",1)[0]:(str(x).split("=",1)[1] if "=" in str(x) else None) for x in env}
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",name) or not image or any(ch.isspace() for ch in image): raise SystemExit(1)
if not env.get("DATABASE_URL"): raise SystemExit(1)
print(name+"|"+image)
')"
IFS='|' read -r migration_service migration_image <<< "$service_line"
[[ -n "$migration_service" && -n "$migration_image" ]]
migration_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$migration_image")"
[[ "$migration_revision" =~ ^[0-9a-f]{40}$ ]]

printf 'SAFE_INVENTORY|%s|%s|%s|%s|%s\n' "$role_digest" "$api_ids_digest" "$migration_service" "$migration_image" "$migration_revision"
REMOTE_STAGE='COMPLETE'
REMOTE_INVENTORY
)"; then
  inventory_rc=0
else
  inventory_rc=$?
fi
inventory_remote="$(grep '^REMOTE_STAGE|' <<< "$inventory" | tail -n1 || true)"
[[ "$inventory_remote" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$inventory_remote"
[[ "$(grep '^PRODUCTION_DB_MUTATION|' <<< "$inventory" | tail -n1 || true)" == 'PRODUCTION_DB_MUTATION|NONE' ]]
(( inventory_rc == 0 )) || publish_failure "$inventory_rc"
inv_marker="$(grep '^SAFE_INVENTORY|' <<< "$inventory" | tail -n1 || true)"
[[ "$inv_marker" =~ ^SAFE_INVENTORY\|[0-9a-f]{64}\|[0-9a-f]{64}\|[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\|[^[:space:]|]+\|[0-9a-f]{40}$ ]]
IFS='|' read -r _ role_digest api_ids_digest migration_service migration_image migration_revision <<< "$inv_marker"

LOCAL_STAGE='MIGRATION_IMAGE_PROVENANCE'
guard_main
git cat-file -e "${migration_revision}^{commit}"
git merge-base --is-ancestor "$migration_revision" "$CURRENT_MAIN"
current_blob="$(git rev-parse "$CURRENT_MAIN:$TARGET_MIGRATION_PATH")"
image_blob="$(git rev-parse "$migration_revision:$TARGET_MIGRATION_PATH")"
[[ "$current_blob" == "$image_blob" ]]

LOCAL_STAGE='ACL_REPAIR_V2'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$role_digest' '$api_ids_digest' '$migration_service' '$migration_image' '$migration_revision' '$FUNCTION_SIG' '$EXPECTED_OWNER'" 2>/dev/null <<'REMOTE_REPAIR'
set -Eeuo pipefail
expected_role_digest="$1"
expected_api_ids_digest="$2"
expected_service="$3"
expected_image="$4"
expected_revision="$5"
function_sig="$6"
expected_owner="$7"
REMOTE_STAGE='BOOTSTRAP'
mutation_attempted=0
mutation_applied=0
repair_success=0
rollback_state='NOT_NEEDED'
pre_schema='UNKNOWN'
pre_execute='UNKNOWN'
target_role_b64=''

remote_exit() {
  local rc="$?"
  trap - EXIT
  if (( rc != 0 && mutation_attempted == 1 && repair_success == 0 )); then
    REMOTE_STAGE='ROLLBACK'
    if rollback_output="$(authz_node rollback 2>/dev/null)" && [[ "$rollback_output" == 'ROLLBACK|PASS' ]]; then
      rollback_state='PASS'
    else
      rollback_state='FAILED'
    fi
  fi
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  if (( mutation_applied == 1 )); then
    printf 'PRODUCTION_DB_MUTATION|LEAST_PRIVILEGE_ACL\n'
  elif (( mutation_attempted == 1 )); then
    printf 'PRODUCTION_DB_MUTATION|ACL_ATTEMPTED_ROLLBACK_%s\n' "$rollback_state"
  else
    printf 'PRODUCTION_DB_MUTATION|NONE\n'
  fi
  printf 'ROLLBACK|%s\n' "$rollback_state"
  printf 'API_WEB_RESTART|NONE\n'
  printf 'PASSWORD_RESET|NONE\n'
  printf 'MAIL_SEND|NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$(id -u)" -eq 0 ]]
[[ "$expected_role_digest" =~ ^[0-9a-f]{64}$ ]]
[[ "$expected_api_ids_digest" =~ ^[0-9a-f]{64}$ ]]
[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]
[[ -n "$expected_image" && "$expected_image" != *[[:space:]]* ]]
[[ "$function_sig" == 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)' ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]

REMOTE_STAGE='API_IDENTITY_REBIND'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
actual_api_ids_digest="$(printf '%s\n' "${api_ids[@]}" | sha256sum | awk '{print $1}')"
[[ "$actual_api_ids_digest" == "$expected_api_ids_digest" ]]
principal_token=''
for id in "${api_ids[@]}"; do
  one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_REBIND'
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const known = new Set([
  'pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app',
  'pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority'
]);
async function run() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT current_user::text AS effective_role, session_user::text AS session_role,
           r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication
    FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
  `);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('shape');
  const x=rows[0];
  if (!x.effective_role || x.effective_role !== x.session_role || known.has(x.effective_role)) throw new Error('identity');
  if (x.rolsuper || x.rolbypassrls || x.rolcreatedb || x.rolcreaterole || x.rolreplication) throw new Error('privileged');
  if (/[\u0000\r\n]/.test(x.effective_role) || Buffer.byteLength(x.effective_role,'utf8') > 63) throw new Error('invalid');
  const digest=crypto.createHash('sha256').update(x.effective_role,'utf8').digest('hex');
  const token=Buffer.from(x.effective_role,'utf8').toString('base64url');
  process.stdout.write(`ROLE|${digest}|${token}\n`);
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_REBIND
)"
  [[ "$one" =~ ^ROLE\|[0-9a-f]{64}\|[A-Za-z0-9_-]+$ ]]
  IFS='|' read -r _ digest token <<< "$one"
  [[ "$digest" == "$expected_role_digest" ]]
  if [[ -z "$principal_token" ]]; then principal_token="$token"; else [[ "$principal_token" == "$token" ]]; fi
done
target_role_b64="$principal_token"

REMOTE_STAGE='COMPOSE_REBIND'
web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" && -d "$prod_dir" ]]
IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"; file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]]
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$("${dc[@]}" config --format json)"
service_line="$(printf '%s' "$compose_json" | python3 -c '
import json,re,sys
cfg=json.load(sys.stdin); services=cfg.get("services") or {}; c=[]
for name,svc in services.items():
    image=str(svc.get("image") or ""); command=svc.get("command"); command=" ".join(command) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command): c.append((name,image,svc))
if len(c)!=1: raise SystemExit(1)
name,image,svc=c[0]; env=svc.get("environment") or {}
if isinstance(env,list): env={str(x).split("=",1)[0]:(str(x).split("=",1)[1] if "=" in str(x) else None) for x in env}
if not env.get("DATABASE_URL"): raise SystemExit(1)
print(name+"|"+image)
')"
IFS='|' read -r migration_service migration_image <<< "$service_line"
[[ "$migration_service" == "$expected_service" && "$migration_image" == "$expected_image" ]]
actual_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$migration_image")"
[[ "$actual_revision" == "$expected_revision" ]]

authz_node() {
  local mode="$1"
  PC_TARGET_ROLE_B64="$target_role_b64" PC_PRE_SCHEMA="$pre_schema" PC_PRE_EXECUTE="$pre_execute" \
    "${dc[@]}" run --rm --no-deps --pull never -T \
      -e PC_TARGET_ROLE_B64 -e PC_PRE_SCHEMA -e PC_PRE_EXECUTE \
      --entrypoint /nodejs/bin/node "$migration_service" - "$mode" "$function_sig" "$expected_owner" <<'NODE_AUTHZ'
const { PrismaClient } = require('@prisma/client');
const mode=process.argv[2]; const functionSig=process.argv[3]; const expectedOwner=process.argv[4];
const role=Buffer.from(process.env.PC_TARGET_ROLE_B64 || '','base64url').toString('utf8');
const preSchema=process.env.PC_PRE_SCHEMA || 'UNKNOWN'; const preExecute=process.env.PC_PRE_EXECUTE || 'UNKNOWN';
const prisma=new PrismaClient({log:[]});
const known=new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']);
const qi=(v)=>'"'+String(v).replace(/"/g,'""')+'"';
async function meta() {
  if (!role || known.has(role) || Buffer.byteLength(role,'utf8')>63 || /[\u0000\r\n]/.test(role)) throw new Error('role');
  const rr=await prisma.$queryRawUnsafe(`SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_catalog.pg_roles WHERE rolname=$1::text`,role);
  if (!Array.isArray(rr)||rr.length!==1) throw new Error('role-missing');
  const r=rr[0]; if(r.rolsuper||r.rolbypassrls||r.rolcreatedb||r.rolcreaterole||r.rolreplication) throw new Error('privileged');
  const fr=await prisma.$queryRawUnsafe(`
    SELECT owner.rolname AS owner,
      EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_roles owner ON owner.oid=p.proowner
    WHERE n.nspname='auth' AND p.proname='enqueue_mail_outbox'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid)='text, text, text, text, text, integer, text, text, text, integer, timestamp with time zone, timestamp with time zone'`);
  if(!Array.isArray(fr)||fr.length!==1||fr[0].owner!==expectedOwner||fr[0].public_execute) throw new Error('function-authority');
}
async function state() {
  const rows=await prisma.$queryRawUnsafe(`SELECT
    pg_catalog.has_schema_privilege($1::text,'auth','USAGE') AS s,
    pg_catalog.has_function_privilege($1::text,$2::text,'EXECUTE') AS f,
    pg_catalog.has_table_privilege($1::text,'auth.mail_outbox','SELECT') AS a,
    pg_catalog.has_table_privilege($1::text,'auth.mail_outbox','INSERT') AS b,
    pg_catalog.has_table_privilege($1::text,'auth.mail_outbox','UPDATE') AS c,
    pg_catalog.has_table_privilege($1::text,'auth.mail_outbox','DELETE') AS d,
    pg_catalog.has_table_privilege($1::text,'auth.mail_outbox','TRUNCATE') AS e,
    pg_catalog.has_table_privilege($1::text,'auth.mail_outbox','REFERENCES') AS g,
    pg_catalog.has_table_privilege($1::text,'auth.mail_outbox','TRIGGER') AS h`,role,functionSig);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error('state');
  const x=rows[0]; return {s:x.s,f:x.f,table:!!(x.a||x.b||x.c||x.d||x.e||x.g||x.h)};
}
async function run(){
  await meta(); const before=await state(); if(before.table) throw new Error('table-privilege');
  if(mode==='inspect'){process.stdout.write(`STATE|${before.s?'YES':'NO'}|${before.f?'YES':'NO'}|TABLE_NONE\n`);return;}
  if(mode==='apply'){
    await prisma.$transaction(async tx=>{
      if(!before.s) await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA auth TO ${qi(role)}`);
      if(!before.f) await tx.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION ${functionSig} TO ${qi(role)}`);
    },{maxWait:5000,timeout:15000});
    const after=await state(); if(!after.s||!after.f||after.table) throw new Error('post-apply'); process.stdout.write('APPLY|PASS\n'); return;
  }
  if(mode==='rollback'){
    await prisma.$transaction(async tx=>{
      if(preExecute==='NO') await tx.$executeRawUnsafe(`REVOKE EXECUTE ON FUNCTION ${functionSig} FROM ${qi(role)}`);
      if(preSchema==='NO') await tx.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA auth FROM ${qi(role)}`);
    },{maxWait:5000,timeout:15000});
    const after=await state(); const okS=preSchema==='YES'?after.s:!after.s; const okF=preExecute==='YES'?after.f:!after.f;
    if(!okS||!okF||after.table) throw new Error('rollback'); process.stdout.write('ROLLBACK|PASS\n'); return;
  }
  throw new Error('mode');
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_AUTHZ
}

REMOTE_STAGE='AUTHORITY_INSPECT'
inspect_output="$(authz_node inspect 2>/dev/null)"
[[ "$inspect_output" =~ ^STATE\|(YES|NO)\|(YES|NO)\|TABLE_NONE$ ]]
IFS='|' read -r _ pre_schema pre_execute _ <<< "$inspect_output"

if [[ "$pre_schema" == 'YES' && "$pre_execute" == 'YES' ]]; then
  REMOTE_STAGE='ALREADY_PASS'
else
  REMOTE_STAGE='GRANT_EXACT'
  mutation_attempted=1
  apply_output="$(authz_node apply 2>/dev/null)"
  [[ "$apply_output" == 'APPLY|PASS' ]]
  mutation_applied=1
fi

REMOTE_STAGE='API_POSTVERIFY'
for id in "${api_ids[@]}"; do
  verify="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_VERIFY'
const { PrismaClient }=require('@prisma/client'); const prisma=new PrismaClient({log:[]});
async function run(){const rows=await prisma.$queryRawUnsafe(`SELECT
 pg_catalog.has_schema_privilege(current_user,'auth','USAGE') AS s,
 pg_catalog.has_function_privilege(current_user,'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)','EXECUTE') AS f,
 pg_catalog.has_table_privilege(current_user,'auth.mail_outbox','SELECT') AS a,
 pg_catalog.has_table_privilege(current_user,'auth.mail_outbox','INSERT') AS b,
 pg_catalog.has_table_privilege(current_user,'auth.mail_outbox','UPDATE') AS c,
 pg_catalog.has_table_privilege(current_user,'auth.mail_outbox','DELETE') AS d,
 pg_catalog.has_table_privilege(current_user,'auth.mail_outbox','TRUNCATE') AS e,
 pg_catalog.has_table_privilege(current_user,'auth.mail_outbox','REFERENCES') AS g,
 pg_catalog.has_table_privilege(current_user,'auth.mail_outbox','TRIGGER') AS h`);
if(!Array.isArray(rows)||rows.length!==1)throw new Error('shape'); const x=rows[0]; const table=!!(x.a||x.b||x.c||x.d||x.e||x.g||x.h);
process.stdout.write(`VERIFY|${x.s?'YES':'NO'}|${x.f?'YES':'NO'}|${table?'TABLE_PRESENT':'TABLE_NONE'}\n`);}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_VERIFY
)"
  [[ "$verify" == 'VERIFY|YES|YES|TABLE_NONE' ]]
done

REMOTE_STAGE='RUNTIME_INVARIANTS'
mapfile -t api_after < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_after < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
[[ "$(printf '%s\n' "${api_after[@]}" | sha256sum | awk '{print $1}')" == "$expected_api_ids_digest" ]]
[[ "${#web_after[@]}" == 1 && "${web_after[0]}" == "$web_id" ]]

repair_success=1
REMOTE_STAGE='COMPLETE'
printf 'REPAIR|PASS|%s|API_ACL_PASS|TABLE_DML_NONE\n' "$([[ "$mutation_applied" == 1 ]] && printf 'MUTATED' || printf 'ALREADY_PASS')"
REMOTE_REPAIR
)"; then
  REMOTE_RC=0
else
  REMOTE_RC=$?
fi
remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
mutation_marker="$(grep '^PRODUCTION_DB_MUTATION|' <<< "$output" | tail -n1 || true)"
rollback_marker="$(grep '^ROLLBACK|' <<< "$output" | tail -n1 || true)"
repair_marker="$(grep '^REPAIR|' <<< "$output" | tail -n1 || true)"
[[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r _ REMOTE_STAGE marker_rc <<< "$remote_marker"
[[ "$marker_rc" == "$REMOTE_RC" ]]
[[ "$mutation_marker" =~ ^PRODUCTION_DB_MUTATION\|(NONE|LEAST_PRIVILEGE_ACL|ACL_ATTEMPTED_ROLLBACK_(PASS|FAILED))$ ]]
MUTATION="${mutation_marker#PRODUCTION_DB_MUTATION|}"
[[ "$rollback_marker" =~ ^ROLLBACK\|(NOT_NEEDED|PASS|FAILED)$ ]]
ROLLBACK="${rollback_marker#ROLLBACK|}"
(( REMOTE_RC == 0 )) || publish_failure "$REMOTE_RC"
[[ "$repair_marker" =~ ^REPAIR\|PASS\|(MUTATED|ALREADY_PASS)\|API_ACL_PASS\|TABLE_DML_NONE$ ]]

LOCAL_STAGE='FINAL_MAIN_GUARD'
guard_main

LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair v2

- repair main: \`$SOURCE_SHA\`
- result: \`PASS_LEAST_PRIVILEGE\`
- active API principal: \`SAFE_OTHER / IDENTITY_NOT_PUBLISHED\`
- auth schema USAGE after repair: \`YES\`
- exact enqueue function EXECUTE after repair: \`YES\`
- auth.mail_outbox table privileges granted to API principal: \`NONE\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- API/Web restart: \`NONE\`
- password reset / mail send / deployment: \`NONE\`
- raw DB role / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- new mandatory cost: \`0 RUB\`" >/dev/null

echo 'AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V2=PASS'
echo "PRODUCTION_DB_MUTATION=$MUTATION"
echo 'API_WEB_RESTART=NONE'
echo 'PASSWORD_RESET=NONE'
echo 'MAIL_SEND=NONE'
