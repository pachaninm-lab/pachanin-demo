#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_DB_STATE_COMMAND:?PC_REVIEWER_RESET_DB_STATE_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-enqueue-db-state current-main'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'
MIGRATION_PATH='apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql'
MIGRATION_DATASOURCE_FIX_SHA='1762b4a22a99d786a971e78cbe16ec1f74bb5a74'
FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-db-state-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-db-state-known-hosts"
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
scan=''; match=''; result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="${1:-1}"
  trap - ERR
  if [[ "$result_published" == 0 ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset enqueue DB state

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- database access: \`READ_ONLY_CATALOG_AND_MIGRATION_METADATA\`
- customer/user rows: \`NOT_READ\`
- raw DB errors / DSN / credentials / PII: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
on_err() { local rc="$?"; publish_failure "$rc"; }
trap on_err ERR

trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
guard_main() {
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

LOCAL_STAGE='AUTHORITY'
[[ "$PC_REVIEWER_RESET_DB_STATE_COMMAND" == "$COMMAND" ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
git cat-file -e "${MIGRATION_DATASOURCE_FIX_SHA}^{commit}"
git merge-base --is-ancestor "$MIGRATION_DATASOURCE_FIX_SHA" "$CURRENT_MAIN"
[[ -f "$MIGRATION_PATH" ]]
grep -Fq 'CREATE OR REPLACE FUNCTION auth.enqueue_mail_outbox(' "$MIGRATION_PATH"
grep -Fq 'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox(' "$MIGRATION_PATH"
[[ -z "$(git status --porcelain=v1)" ]]

LOCAL_STAGE='SSH_INPUT'
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535))
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
  ((attempt==3)) || sleep "$attempt"
done
[[ "$pinned" == 1 ]]
mv "$match" "$known_hosts"; match=''
rm -f "$scan"; scan=''
chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

LOCAL_STAGE='REMOTE_PREFLIGHT'
guard_main
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; python3 --version >/dev/null' >/dev/null

guard_main
LOCAL_STAGE='REMOTE_DB_STATE'
set +e
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$MIGRATION_NAME' '$FUNCTION_SIG'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
migration_name="$1"
function_sig="$2"
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE=%s\n' "$REMOTE_STAGE"
  printf 'REMOTE_RC=%s\n' "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

emit(){ printf '%s=%s\n' "$1" "$2"; }
[[ "$migration_name" == '20260812010000_p0_industrial_auth_mail_outbox' ]]
[[ "$function_sig" == 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)' ]]
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='ACTIVE_RUNTIME'
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]]
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" ]]
[[ -n "$config_files" ]]
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$api_revision" == "$web_revision" ]]
emit ACTIVE_REVISION "$api_revision"
emit API_WEB_REVISION_PARITY PASS

REMOTE_STAGE='COMPOSE_AUTHORITY'
working_dir="$(realpath -e -- "$working_dir")"
IFS=',' read -r -a raw_compose_files <<< "$config_files"
compose_files=()
for raw_file in "${raw_compose_files[@]}"; do
  file="${raw_file#"${raw_file%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$working_dir/$file"
  [[ -f "$file" && ! -L "$file" ]]
  compose_files+=("$(realpath -e -- "$file")")
done
(( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$working_dir" --project-name "$project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$(${dc[@]} config --format json)"
[[ -n "$compose_json" ]]

migration_database_url="$(python3 -c '
import json,re,sys
from urllib.parse import urlsplit
services=(json.load(sys.stdin).get("services") or {})
c=[]
for name,service in services.items():
    image=str(service.get("image") or "")
    command=service.get("command")
    command=" ".join(map(str,command)) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command.lower() and "migrate" in command.lower()):
        c.append((name,service))
if len(c)!=1: raise SystemExit(1)
env=c[0][1].get("environment") or {}
if isinstance(env,list): env=dict(x.split("=",1) for x in env if isinstance(x,str) and "=" in x)
value=str(env.get("DATABASE_URL") or "").strip()
u=urlsplit(value)
if u.scheme not in ("postgres","postgresql") or not u.username or not u.password or not u.hostname or not u.path.strip("/"): raise SystemExit(2)
sys.stdout.write(value)
' <<< "$compose_json")"
[[ -n "$migration_database_url" ]]
unset compose_json

REMOTE_STAGE='DB_TARGET_PARITY'
api_env="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id")"
main_db="$(sed -n 's/^DATABASE_URL=//p' <<< "$api_env" | head -1)"
auth_db="$(sed -n 's/^AUTH_DATABASE_URL=//p' <<< "$api_env" | head -1)"
unset api_env
[[ -n "$main_db" ]]
parity="$(printf '%s\n%s\n%s\n' "$migration_database_url" "$main_db" "$auth_db" | python3 -c '
import sys
from urllib.parse import unquote,urlsplit
lines=sys.stdin.read().splitlines()
if len(lines)<3: raise SystemExit(1)
m,u,a=[urlsplit(x) if x else None for x in lines[:3]]
def valid(x): return x is not None and x.scheme in ("postgres","postgresql") and x.hostname and x.path.strip("/")
def target(x): return ((x.hostname or "").lower(),x.port or 5432,unquote(x.path))
if not valid(m) or not valid(u): raise SystemExit(2)
print("MAIN_DB_TARGET_PARITY="+("PASS" if target(m)==target(u) else "FAIL"))
if a is None:
    print("AUTH_DB_TARGET_PARITY=ABSENT")
elif not valid(a):
    print("AUTH_DB_TARGET_PARITY=INVALID")
else:
    print("AUTH_DB_TARGET_PARITY="+("PASS" if target(m)==target(a) else "FAIL"))
')"
printf '%s\n' "$parity"
main_parity="$(sed -n 's/^MAIN_DB_TARGET_PARITY=//p' <<< "$parity" | head -1)"
[[ "$main_parity" == PASS ]]
unset main_db auth_db parity

REMOTE_STAGE='API_CATALOG_QUERY'
api_state="$(docker exec "$api_id" /nodejs/bin/node -e '
const {PrismaClient}=require("@prisma/client");
const p=new PrismaClient();
const sig="auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)";
const out=(k,v)=>process.stdout.write(`${k}=${v}\n`);
const cls=e=>{const m=String(e?.message||"");const c=String(e?.meta?.code||e?.code||"");if(/permission denied|insufficient privilege/i.test(m)||c==="42501")return "PERMISSION_DENIED";if(/authentication failed|password/i.test(m))return "AUTH_FAILED";if(/reach|connection refused|timeout|timed out/i.test(m))return "CONNECT_FAILED";return "OTHER_ERROR"};
(async()=>{try{
 await p.$connect();
 const r=await p.$queryRawUnsafe(`SELECT
   current_user::text IN (\x27pc_auth_runtime\x27,\x27one_deal_auth\x27,\x27app_auth\x27,\x27app_service\x27) AS producer_principal,
   EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=\x27auth\x27) AS auth_schema,
   to_regclass(\x27auth.mail_outbox\x27) IS NOT NULL AS mail_outbox,
   to_regprocedure($1) IS NOT NULL AS enqueue_function,
   has_schema_privilege(current_user,\x27auth\x27,\x27USAGE\x27) AS schema_usage,
   CASE WHEN to_regprocedure($1) IS NULL THEN false ELSE has_function_privilege(current_user,to_regprocedure($1),\x27EXECUTE\x27) END AS enqueue_execute`,sig);
 const x=r?.[0]||{};
 out("API_QUERY_CLASS","PASS");
 out("API_PRODUCER_PRINCIPAL",x.producer_principal===true?"PASS":"FAIL");
 out("AUTH_SCHEMA_EXISTS",x.auth_schema===true?"PASS":"FAIL");
 out("MAIL_OUTBOX_EXISTS",x.mail_outbox===true?"PASS":"FAIL");
 out("ENQUEUE_FUNCTION_EXISTS",x.enqueue_function===true?"PASS":"FAIL");
 out("API_AUTH_SCHEMA_USAGE",x.schema_usage===true?"PASS":"FAIL");
 out("API_ENQUEUE_EXECUTE",x.enqueue_execute===true?"PASS":"FAIL");
 }catch(e){out("API_QUERY_CLASS",cls(e));for(const k of ["API_PRODUCER_PRINCIPAL","AUTH_SCHEMA_EXISTS","MAIL_OUTBOX_EXISTS","ENQUEUE_FUNCTION_EXISTS","API_AUTH_SCHEMA_USAGE","API_ENQUEUE_EXECUTE"])out(k,"NOT_RUN")}
})().finally(async()=>{await p.$disconnect().catch(()=>{})});
')"
printf '%s\n' "$api_state"
api_query_class="$(sed -n 's/^API_QUERY_CLASS=//p' <<< "$api_state" | head -1)"
[[ "$api_query_class" == PASS ]]

REMOTE_STAGE='MIGRATION_METADATA_QUERY'
migration_state="$(printf '%s' "$migration_database_url" | docker exec -i "$api_id" /nodejs/bin/node -e '
const fs=require("fs");const {PrismaClient}=require("@prisma/client");
const url=fs.readFileSync(0,"utf8").trim();const p=new PrismaClient({datasources:{db:{url}}});
const name="20260812010000_p0_industrial_auth_mail_outbox";
const sig="auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)";
const out=(k,v)=>process.stdout.write(`${k}=${v}\n`);
const cls=e=>{const m=String(e?.message||"");const c=String(e?.meta?.code||e?.code||"");if(/permission denied|insufficient privilege/i.test(m)||c==="42501")return "PERMISSION_DENIED";if(/authentication failed|password/i.test(m))return "AUTH_FAILED";if(/reach|connection refused|timeout|timed out/i.test(m))return "CONNECT_FAILED";if(/does not exist/i.test(m)||c==="42P01")return "METADATA_MISSING";return "OTHER_ERROR"};
(async()=>{try{
 await p.$connect();
 const rows=await p.$queryRawUnsafe(`SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count FROM "_prisma_migrations" WHERE migration_name=$1`,name);
 let state="AMBIGUOUS";
 if(rows.length===0)state="MISSING";
 else if(rows.length===1){const x=rows[0];if(x.rolled_back===true)state="ROLLED_BACK";else if(x.finished===true&&Number(x.applied_steps_count)>0)state="APPLIED";else state="INCOMPLETE";}
 const cat=await p.$queryRawUnsafe(`SELECT to_regprocedure($1) IS NOT NULL AS fn, to_regclass(\x27auth.mail_outbox\x27) IS NOT NULL AS tbl`,sig);
 out("MIGRATION_QUERY_CLASS","PASS");out("AUTH_MAIL_OUTBOX_MIGRATION",state);out("MIGRATION_AUTH_FUNCTION_EXISTS",cat?.[0]?.fn===true?"PASS":"FAIL");out("MIGRATION_AUTH_TABLE_EXISTS",cat?.[0]?.tbl===true?"PASS":"FAIL");
 }catch(e){out("MIGRATION_QUERY_CLASS",cls(e));out("AUTH_MAIL_OUTBOX_MIGRATION","NOT_RUN");out("MIGRATION_AUTH_FUNCTION_EXISTS","NOT_RUN");out("MIGRATION_AUTH_TABLE_EXISTS","NOT_RUN")}
})().finally(async()=>{await p.$disconnect().catch(()=>{})});
')"
printf '%s\n' "$migration_state"
unset migration_database_url
migration_query_class="$(sed -n 's/^MIGRATION_QUERY_CLASS=//p' <<< "$migration_state" | head -1)"
[[ "$migration_query_class" == PASS ]]

REMOTE_STAGE='COMPLETE'
REMOTE
)"
ssh_rc=$?
set -e

remote_stage="$(sed -n 's/^REMOTE_STAGE=//p' <<< "$output" | tail -n1 || true)"
remote_rc="$(sed -n 's/^REMOTE_RC=//p' <<< "$output" | tail -n1 || true)"
mutation="$(sed -n 's/^PRODUCTION_MUTATION=//p' <<< "$output" | tail -n1 || true)"
if [[ "$remote_stage" =~ ^[A-Z0-9_]+$ ]]; then REMOTE_STAGE="$remote_stage"; else REMOTE_STAGE='NO_SAFE_REMOTE_STAGE'; fi
if [[ "$remote_rc" =~ ^[0-9]+$ ]]; then REMOTE_RC="$remote_rc"; else REMOTE_RC="$ssh_rc"; fi
[[ "$mutation" == NONE ]] || { REMOTE_STAGE='MUTATION_ATTESTATION_MISSING'; publish_failure 91; }
if (( ssh_rc != 0 )); then publish_failure "$ssh_rc"; fi
[[ "$REMOTE_STAGE" == COMPLETE && "$REMOTE_RC" == 0 ]]

LOCAL_STAGE='RESULT_VALIDATE'
allowed_keys='ACTIVE_REVISION API_WEB_REVISION_PARITY MAIN_DB_TARGET_PARITY AUTH_DB_TARGET_PARITY API_QUERY_CLASS API_PRODUCER_PRINCIPAL AUTH_SCHEMA_EXISTS MAIL_OUTBOX_EXISTS ENQUEUE_FUNCTION_EXISTS API_AUTH_SCHEMA_USAGE API_ENQUEUE_EXECUTE MIGRATION_QUERY_CLASS AUTH_MAIL_OUTBOX_MIGRATION MIGRATION_AUTH_FUNCTION_EXISTS MIGRATION_AUTH_TABLE_EXISTS REMOTE_STAGE REMOTE_RC PRODUCTION_MUTATION'
for key in $allowed_keys; do
  value="$(sed -n "s/^${key}=//p" <<< "$output" | tail -n1 || true)"
  [[ -n "$value" && "$value" =~ ^[A-Za-z0-9_.:-]{1,160}$ ]]
  printf -v "$key" '%s' "$value"
done
[[ "$ACTIVE_REVISION" =~ ^[0-9a-f]{40}$ ]]
git cat-file -e "${ACTIVE_REVISION}^{commit}"
git merge-base --is-ancestor "$ACTIVE_REVISION" "$CURRENT_MAIN"
git cat-file -e "$ACTIVE_REVISION:$MIGRATION_PATH"
[[ "$PRODUCTION_MUTATION" == NONE ]]

guard_main
LOCAL_STAGE='PUBLISH_RESULT'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset enqueue DB state

- diagnostic main: \`$SOURCE_SHA\`
- active API/Web revision: \`$ACTIVE_REVISION\`
- result: \`PASS_READ_ONLY_DB_STATE\`
- API/Web revision parity: \`$API_WEB_REVISION_PARITY\`
- migration → API DB target parity: \`$MAIN_DB_TARGET_PARITY\`
- migration → AUTH DB target parity: \`$AUTH_DB_TARGET_PARITY\`
- API catalog query / authorized producer principal: \`$API_QUERY_CLASS / $API_PRODUCER_PRINCIPAL\`
- auth schema / mail_outbox table: \`$AUTH_SCHEMA_EXISTS / $MAIL_OUTBOX_EXISTS\`
- exact enqueue function / API EXECUTE: \`$ENQUEUE_FUNCTION_EXISTS / $API_ENQUEUE_EXECUTE\`
- API auth schema USAGE: \`$API_AUTH_SCHEMA_USAGE\`
- migration metadata query: \`$MIGRATION_QUERY_CLASS\`
- migration \`$MIGRATION_NAME\`: \`$AUTH_MAIL_OUTBOX_MIGRATION\`
- migration-authority function / table: \`$MIGRATION_AUTH_FUNCTION_EXISTS / $MIGRATION_AUTH_TABLE_EXISTS\`
- database access: \`READ_ONLY_CATALOG_AND_MIGRATION_METADATA\`
- customer/user rows: \`NOT_READ\`
- raw DB errors / DSN / credentials / PII: \`NOT_PUBLISHED\`
- reset replay / mail send: \`NONE\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
