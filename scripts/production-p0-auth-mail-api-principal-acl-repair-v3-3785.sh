#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V3_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-api-principal-acl-repair-v3 31990014692 current-main'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'
TARGET_MIGRATION_PATH="apps/api/prisma/migrations/${MIGRATION_NAME}/migration.sql"
REGPROC='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'
EXPECTED_SEARCH_PATH='search_path=pg_catalog, auth, pg_temp'
EXPECTED_ROW_SECURITY='row_security=on'

key_path="$RUNNER_TEMP/p0-auth-mail-api-principal-acl-v3-key"
known_hosts="$RUNNER_TEMP/p0-auth-mail-api-principal-acl-v3-known-hosts"
scan=''
match=''
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
MUTATION='NONE'
ROLLBACK='NOT_NEEDED'
RESULT='UNKNOWN'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="${1:-1}"
  trap - ERR
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair v3

- repair main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- raw DB role / role token / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / API-Web restart: \`NONE\`
- new mandatory cost: \`0 RUB\`
- exit code: \`$rc\`" >/dev/null || true
  exit "$rc"
}
trap 'rc=$?; publish_failure "$rc"' ERR

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
[[ "$PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V3_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'true' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]
[[ -f "$TARGET_MIGRATION_PATH" ]]
grep -Fq 'SECURITY DEFINER' "$TARGET_MIGRATION_PATH"
grep -Fq 'SET search_path = pg_catalog, auth, pg_temp' "$TARGET_MIGRATION_PATH"
grep -Fq 'SET row_security = on' "$TARGET_MIGRATION_PATH"
grep -Fq 'OWNER TO pc_auth_mail_enqueue_authority' "$TARGET_MIGRATION_PATH"
grep -Fq 'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox' "$TARGET_MIGRATION_PATH"
grep -Fq 'REVOKE ALL ON TABLE auth.mail_outbox FROM PUBLIC' "$TARGET_MIGRATION_PATH"
grep -Fq 'ALTER TABLE auth.mail_outbox FORCE ROW LEVEL SECURITY' "$TARGET_MIGRATION_PATH"

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
  one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_IDENTITY'
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const known = new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']);
async function run() {
  const rows = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return tx.$queryRawUnsafe(`SELECT current_user::text AS e, session_user::text AS s, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication, rolinherit FROM pg_catalog.pg_roles WHERE rolname=current_user`);
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('shape');
  const x = rows[0];
  if (!x.e || x.e !== x.s || known.has(x.e)) throw new Error('identity');
  if (x.rolsuper || x.rolbypassrls || x.rolcreatedb || x.rolcreaterole || x.rolreplication || x.rolinherit) throw new Error('privileged-or-inherit');
  if (/[\u0000\r\n]/.test(x.e) || Buffer.byteLength(x.e,'utf8') > 63) throw new Error('invalid');
  process.stdout.write(`SAFE_OTHER|${crypto.createHash('sha256').update(x.e,'utf8').digest('hex')}\n`);
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

REMOTE_STAGE='COMPOSE_AUTHORITY'
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
services=(json.load(sys.stdin).get("services") or {}); c=[]
for name,svc in services.items():
    image=str(svc.get("image") or ""); command=svc.get("command"); command=" ".join(command) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command): c.append((name,image,svc))
if len(c)!=1: raise SystemExit(1)
name,image,svc=c[0]; env=svc.get("environment") or {}
if isinstance(env,list): env={str(x).split("=",1)[0]:(str(x).split("=",1)[1] if "=" in str(x) else None) for x in env}
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",name) or not image or any(ch.isspace() for ch in image) or not env.get("DATABASE_URL"): raise SystemExit(1)
print(name+"|"+image)
')"
IFS='|' read -r migration_service migration_image <<< "$service_line"
[[ -n "$migration_service" && -n "$migration_image" ]]
docker image inspect "$migration_image" >/dev/null
migration_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$migration_image")"
[[ "$migration_revision" =~ ^[0-9a-f]{40}$ ]]
printf 'SAFE_INVENTORY|%s|%s|%s|%s|%s\n' "$role_digest" "$api_ids_digest" "$migration_service" "$migration_image" "$migration_revision"
REMOTE_STAGE='COMPLETE'
REMOTE_INVENTORY
)"; then inventory_rc=0; else inventory_rc=$?; fi
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

LOCAL_STAGE='ACL_REPAIR_V3'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$role_digest' '$api_ids_digest' '$migration_service' '$migration_image' '$migration_revision' '$REGPROC' '$EXPECTED_OWNER' '$EXPECTED_SEARCH_PATH' '$EXPECTED_ROW_SECURITY'" 2>/dev/null <<'REMOTE_REPAIR'
set -Eeuo pipefail
expected_role_digest="$1"
expected_api_ids_digest="$2"
expected_service="$3"
expected_image="$4"
expected_revision="$5"
regproc="$6"
expected_owner="$7"
expected_search_path="$8"
expected_row_security="$9"
REMOTE_STAGE='BOOTSTRAP'
mutation_attempted=0
mutation_applied=0
repair_success=0
rollback_state='NOT_NEEDED'
pre_schema='UNKNOWN'
pre_exec='UNKNOWN'
result_class='UNKNOWN'
role_hex=''
target_role_b64=''
dc=()
migration_service=''

remote_exit() {
  local rc="$?" mutation_marker='NONE'
  trap - EXIT
  if (( rc != 0 && mutation_attempted == 1 && repair_success == 0 )); then
    REMOTE_STAGE='ROLLBACK'
    if rollback_acl 2>/dev/null; then rollback_state='PASS'; else rollback_state='FAILED'; fi
  fi
  if (( repair_success == 1 && mutation_applied == 1 )); then
    mutation_marker='LEAST_PRIVILEGE_ACL'
  elif (( mutation_attempted == 1 && repair_success == 0 )); then
    mutation_marker="ACL_ATTEMPTED_ROLLBACK_${rollback_state}"
  else
    mutation_marker='NONE'
  fi
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'RESULT_CLASS|%s\n' "$result_class"
  printf 'PRODUCTION_DB_MUTATION|%s\n' "$mutation_marker"
  printf 'ROLLBACK|%s\n' "$rollback_state"
  printf 'API_WEB_RESTART|NONE\nPASSWORD_RESET|NONE\nMAIL_SEND|NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$(id -u)" -eq 0 ]]
[[ "$expected_role_digest" =~ ^[0-9a-f]{64}$ ]]
[[ "$expected_api_ids_digest" =~ ^[0-9a-f]{64}$ ]]
[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]
[[ -n "$expected_image" && "$expected_image" != *[[:space:]]* ]]
[[ "$regproc" == 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)' ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]
[[ "$expected_search_path" == 'search_path=pg_catalog, auth, pg_temp' ]]
[[ "$expected_row_security" == 'row_security=on' ]]

REMOTE_STAGE='API_IDENTITY_REBIND'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
actual_api_ids_digest="$(printf '%s\n' "${api_ids[@]}" | sha256sum | awk '{print $1}')"
[[ "$actual_api_ids_digest" == "$expected_api_ids_digest" ]]
role_token=''
for id in "${api_ids[@]}"; do
  one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_REBIND'
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const known = new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']);
async function run() {
  const rows=await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return tx.$queryRawUnsafe(`SELECT current_user::text AS e,session_user::text AS s,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit FROM pg_catalog.pg_roles WHERE rolname=current_user`);
  });
  if(!Array.isArray(rows)||rows.length!==1) throw new Error('shape');
  const x=rows[0];
  if(!x.e||x.e!==x.s||known.has(x.e)||x.rolsuper||x.rolbypassrls||x.rolcreatedb||x.rolcreaterole||x.rolreplication||x.rolinherit) throw new Error('identity');
  if(/[\u0000\r\n]/.test(x.e)||Buffer.byteLength(x.e,'utf8')>63) throw new Error('invalid');
  process.stdout.write(`ROLE|${crypto.createHash('sha256').update(x.e,'utf8').digest('hex')}|${Buffer.from(x.e,'utf8').toString('base64url')}\n`);
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_REBIND
)"
  [[ "$one" =~ ^ROLE\|[0-9a-f]{64}\|[A-Za-z0-9_-]+$ ]]
  IFS='|' read -r _ digest token <<< "$one"
  [[ "$digest" == "$expected_role_digest" ]]
  if [[ -z "$role_token" ]]; then role_token="$token"; else [[ "$role_token" == "$token" ]]; fi
done
target_role_b64="$role_token"
role_hex="$(python3 - "$target_role_b64" <<'PY'
import base64,sys
s=sys.argv[1]
b=base64.urlsafe_b64decode(s+'='*((4-len(s)%4)%4))
if not b or len(b)>63 or b'\x00' in b or b'\r' in b or b'\n' in b: raise SystemExit(1)
print(b.hex())
PY
)"
[[ "$role_hex" =~ ^[0-9a-f]+$ ]]

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
services=(json.load(sys.stdin).get("services") or {}); c=[]
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

db_exec() {
  "${dc[@]}" run --rm --no-deps --pull never -T "$migration_service" \
    node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma \
    >/dev/null 2>&1
}
assert_sql() {
  local condition="$1" sql
  sql="BEGIN; SET TRANSACTION READ ONLY; DO \$pc\$ BEGIN IF NOT COALESCE(($condition),FALSE) THEN RAISE EXCEPTION 'blocked'; END IF; END \$pc\$; ROLLBACK;"
  printf '%s\n' "$sql" | db_exec
}
role_expr="convert_from(pg_catalog.decode('$role_hex','hex'),'UTF8')"
fn_expr="to_regprocedure('$regproc')::oid"
table_expr="'auth.mail_outbox'::regclass"
role_oid_expr="(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$role_expr)"

REMOTE_STAGE='AUTHORITY_PREFLIGHT'
assert_sql "(SELECT count(*)=1 FROM pg_catalog.pg_roles WHERE rolname=$role_expr)"
assert_sql "NOT (SELECT rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR rolinherit FROM pg_catalog.pg_roles WHERE rolname=$role_expr)"
assert_sql "NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=$role_oid_expr OR roleid=$role_oid_expr)"
assert_sql "(SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)"
assert_sql "to_regprocedure('$regproc') IS NOT NULL"
assert_sql "(SELECT count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='enqueue_mail_outbox')"
assert_sql "(SELECT pg_catalog.pg_get_userbyid(proowner)='$expected_owner' AND prosecdef FROM pg_catalog.pg_proc WHERE oid=$fn_expr)"
assert_sql "(SELECT EXISTS(SELECT 1 FROM unnest(COALESCE(proconfig,'{}'::text[])) cfg WHERE cfg='$expected_search_path') FROM pg_catalog.pg_proc WHERE oid=$fn_expr)"
assert_sql "(SELECT EXISTS(SELECT 1 FROM unnest(COALESCE(proconfig,'{}'::text[])) cfg WHERE cfg='$expected_row_security') FROM pg_catalog.pg_proc WHERE oid=$fn_expr)"
assert_sql "NOT (SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proacl,pg_catalog.acldefault('f',proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_catalog.pg_proc WHERE oid=$fn_expr)"
assert_sql "to_regclass('auth.mail_outbox') IS NOT NULL"
assert_sql "(SELECT relrowsecurity AND relforcerowsecurity FROM pg_catalog.pg_class WHERE oid=$table_expr)"
assert_sql "NOT (SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(relacl,pg_catalog.acldefault('r',relowner))) a WHERE a.grantee=0) FROM pg_catalog.pg_class WHERE oid=$table_expr)"
assert_sql "NOT (pg_catalog.has_table_privilege($role_expr,$table_expr,'SELECT') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'INSERT') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'UPDATE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'DELETE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'TRUNCATE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'REFERENCES') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'TRIGGER'))"

if assert_sql "pg_catalog.has_schema_privilege($role_expr,'auth','USAGE')"; then pre_schema='YES'; else assert_sql "NOT pg_catalog.has_schema_privilege($role_expr,'auth','USAGE')"; pre_schema='NO'; fi
if assert_sql "pg_catalog.has_function_privilege($role_expr,$fn_expr,'EXECUTE')"; then pre_exec='YES'; else assert_sql "NOT pg_catalog.has_function_privilege($role_expr,$fn_expr,'EXECUTE')"; pre_exec='NO'; fi
[[ "$pre_schema|$pre_exec" == 'NO|NO' || "$pre_schema|$pre_exec" == 'YES|YES' ]]

apply_acl() {
  local sql
  sql="BEGIN; DO \$pc\$ DECLARE r text := $role_expr; BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=r AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication OR rolinherit)) THEN RAISE EXCEPTION 'role'; END IF;
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=r) OR roleid=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=r)) THEN RAISE EXCEPTION 'membership'; END IF;
    IF NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'authority'; END IF;
    IF to_regprocedure('$regproc') IS NULL THEN RAISE EXCEPTION 'function-missing'; END IF;
    IF NOT (SELECT pg_catalog.pg_get_userbyid(proowner)='$expected_owner' AND prosecdef FROM pg_catalog.pg_proc WHERE oid=$fn_expr) THEN RAISE EXCEPTION 'function-authority'; END IF;
    IF NOT (SELECT EXISTS(SELECT 1 FROM unnest(COALESCE(proconfig,'{}'::text[])) cfg WHERE cfg='$expected_search_path') FROM pg_catalog.pg_proc WHERE oid=$fn_expr) THEN RAISE EXCEPTION 'search-path'; END IF;
    IF NOT (SELECT EXISTS(SELECT 1 FROM unnest(COALESCE(proconfig,'{}'::text[])) cfg WHERE cfg='$expected_row_security') FROM pg_catalog.pg_proc WHERE oid=$fn_expr) THEN RAISE EXCEPTION 'row-security-setting'; END IF;
    IF (SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proacl,pg_catalog.acldefault('f',proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_catalog.pg_proc WHERE oid=$fn_expr) THEN RAISE EXCEPTION 'public-function'; END IF;
    IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_catalog.pg_class WHERE oid=$table_expr) THEN RAISE EXCEPTION 'rls'; END IF;
    IF (SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(relacl,pg_catalog.acldefault('r',relowner))) a WHERE a.grantee=0) FROM pg_catalog.pg_class WHERE oid=$table_expr) THEN RAISE EXCEPTION 'public-table'; END IF;
    IF pg_catalog.has_table_privilege(r,$table_expr,'SELECT') OR pg_catalog.has_table_privilege(r,$table_expr,'INSERT') OR pg_catalog.has_table_privilege(r,$table_expr,'UPDATE') OR pg_catalog.has_table_privilege(r,$table_expr,'DELETE') OR pg_catalog.has_table_privilege(r,$table_expr,'TRUNCATE') OR pg_catalog.has_table_privilege(r,$table_expr,'REFERENCES') OR pg_catalog.has_table_privilege(r,$table_expr,'TRIGGER') THEN RAISE EXCEPTION 'table'; END IF;
    IF pg_catalog.has_schema_privilege(r,'auth','USAGE') OR pg_catalog.has_function_privilege(r,$fn_expr,'EXECUTE') THEN RAISE EXCEPTION 'prestate-drift'; END IF;
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I',r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION $regproc TO %I',r);
  END \$pc\$; COMMIT;"
  printf '%s\n' "$sql" | db_exec
}
rollback_acl() {
  local sql
  [[ "$pre_schema|$pre_exec" == 'NO|NO' ]] || return 1
  sql="BEGIN; DO \$pc\$ DECLARE r text := $role_expr; BEGIN
    EXECUTE format('REVOKE EXECUTE ON FUNCTION $regproc FROM %I',r);
    EXECUTE format('REVOKE USAGE ON SCHEMA auth FROM %I',r);
  END \$pc\$; COMMIT;"
  printf '%s\n' "$sql" | db_exec || return 1
  assert_sql "NOT pg_catalog.has_schema_privilege($role_expr,'auth','USAGE')" || return 1
  assert_sql "NOT pg_catalog.has_function_privilege($role_expr,$fn_expr,'EXECUTE')" || return 1
  assert_sql "NOT (pg_catalog.has_table_privilege($role_expr,$table_expr,'SELECT') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'INSERT') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'UPDATE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'DELETE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'TRUNCATE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'REFERENCES') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'TRIGGER'))" || return 1
}

if [[ "$pre_schema|$pre_exec" == 'NO|NO' ]]; then
  REMOTE_STAGE='GRANT_EXACT'
  mutation_attempted=1
  apply_acl
  mutation_applied=1
  result_class='MUTATED'
else
  result_class='ALREADY_PASS'
fi

REMOTE_STAGE='DB_POSTVERIFY'
assert_sql "pg_catalog.has_schema_privilege($role_expr,'auth','USAGE')"
assert_sql "pg_catalog.has_function_privilege($role_expr,$fn_expr,'EXECUTE')"
assert_sql "NOT (pg_catalog.has_table_privilege($role_expr,$table_expr,'SELECT') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'INSERT') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'UPDATE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'DELETE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'TRUNCATE') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'REFERENCES') OR pg_catalog.has_table_privilege($role_expr,$table_expr,'TRIGGER'))"
assert_sql "(SELECT relrowsecurity AND relforcerowsecurity FROM pg_catalog.pg_class WHERE oid=$table_expr)"
assert_sql "NOT (SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(relacl,pg_catalog.acldefault('r',relowner))) a WHERE a.grantee=0) FROM pg_catalog.pg_class WHERE oid=$table_expr)"

REMOTE_STAGE='API_POSTVERIFY'
mapfile -t verify_api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
verify_api_ids_digest="$(printf '%s\n' "${verify_api_ids[@]}" | sha256sum | awk '{print $1}')"
[[ "$verify_api_ids_digest" == "$expected_api_ids_digest" ]]
for id in "${verify_api_ids[@]}"; do
  v="$(docker exec -i "$id" node - "$expected_role_digest" 2>/dev/null <<'NODE_VERIFY'
const crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient({log:[]});
const expected=process.argv[2];
(async()=>{
  const a=await p.$queryRawUnsafe(`SELECT current_user::text e,session_user::text s,rolinherit,has_schema_privilege(current_user,'auth','USAGE') su,has_function_privilege(current_user,'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)','EXECUTE') fe,has_table_privilege(current_user,'auth.mail_outbox','SELECT') a,has_table_privilege(current_user,'auth.mail_outbox','INSERT') b,has_table_privilege(current_user,'auth.mail_outbox','UPDATE') c,has_table_privilege(current_user,'auth.mail_outbox','DELETE') d,has_table_privilege(current_user,'auth.mail_outbox','TRUNCATE') t,has_table_privilege(current_user,'auth.mail_outbox','REFERENCES') r,has_table_privilege(current_user,'auth.mail_outbox','TRIGGER') g FROM pg_catalog.pg_roles WHERE rolname=current_user`);
  if(!Array.isArray(a)||a.length!==1)throw 1; const x=a[0];
  if(x.e!==x.s||x.rolinherit||crypto.createHash('sha256').update(x.e,'utf8').digest('hex')!==expected||!x.su||!x.fe||x.a||x.b||x.c||x.d||x.t||x.r||x.g)throw 1;
  process.stdout.write('PASS');
})().catch(()=>{process.exitCode=2;}).finally(()=>p.$disconnect().catch(()=>{}));
NODE_VERIFY
)"
  [[ "$v" == 'PASS' ]]
done

repair_success=1
REMOTE_STAGE='COMPLETE'
REMOTE_REPAIR
)"; then REMOTE_RC=0; else REMOTE_RC=$?; fi

remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
result_marker="$(grep '^RESULT_CLASS|' <<< "$output" | tail -n1 || true)"
mutation_marker="$(grep '^PRODUCTION_DB_MUTATION|' <<< "$output" | tail -n1 || true)"
rollback_marker="$(grep '^ROLLBACK|' <<< "$output" | tail -n1 || true)"
[[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r _ REMOTE_STAGE marker_rc <<< "$remote_marker"
[[ "$marker_rc" == "$REMOTE_RC" ]]
[[ "$result_marker" =~ ^RESULT_CLASS\|(MUTATED|ALREADY_PASS|UNKNOWN)$ ]]
RESULT="${result_marker#RESULT_CLASS|}"
[[ "$mutation_marker" =~ ^PRODUCTION_DB_MUTATION\|(NONE|LEAST_PRIVILEGE_ACL|ACL_ATTEMPTED_ROLLBACK_(PASS|FAILED))$ ]]
MUTATION="${mutation_marker#PRODUCTION_DB_MUTATION|}"
[[ "$rollback_marker" =~ ^ROLLBACK\|(NOT_NEEDED|PASS|FAILED)$ ]]
ROLLBACK="${rollback_marker#ROLLBACK|}"
(( REMOTE_RC == 0 )) || publish_failure "$REMOTE_RC"
[[ "$RESULT" == 'MUTATED' || "$RESULT" == 'ALREADY_PASS' ]]
if [[ "$RESULT" == 'MUTATED' ]]; then [[ "$MUTATION" == 'LEAST_PRIVILEGE_ACL' ]]; else [[ "$MUTATION" == 'NONE' ]]; fi
[[ "$ROLLBACK" == 'NOT_NEEDED' ]]

LOCAL_STAGE='FINAL_MAIN_GUARD'
guard_main
LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair v3

- repair main: \`$SOURCE_SHA\`
- result: \`PASS_LEAST_PRIVILEGE\`
- repair class: \`$RESULT\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- postverify: \`SCHEMA_USAGE_YES / FUNCTION_EXECUTE_YES / TABLE_PRIVILEGES_NONE / NOINHERIT / FORCE_RLS / PUBLIC_TABLE_NONE\`
- function authority: \`EXACT_OID / OWNER_OK / SECURITY_DEFINER / PINNED_SEARCH_PATH / ROW_SECURITY_ON / PUBLIC_EXECUTE_NONE\`
- migration image provenance: \`ANCESTOR_AND_MIGRATION_BYTES_MATCH\`
- raw DB role / role token / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / API-Web restart: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null

echo 'AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V3=PASS'
echo "PRODUCTION_DB_MUTATION=$MUTATION"
echo 'API_WEB_RESTART=NONE'
echo 'PASSWORD_RESET=NONE'
echo 'MAIL_SEND=NONE'
