#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_AUTHORITY_CLI_CLASSIFIER_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-authority-cli-classifier-v2 31988997036 current-main'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'
EXPECTED_ARGS='text, text, text, text, text, integer, text, text, text, integer, timestamp with time zone, timestamp with time zone'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-authority-cli-classifier-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-authority-cli-classifier-known-hosts"
scan=''
match=''
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="${1:-1}"
  trap - ERR
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail authority CLI classifier v2

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- raw DB role / role token / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / database write / API-Web restart: \`NONE\`
- production mutation: \`NONE\`
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
[[ "$PC_AUTH_MAIL_AUTHORITY_CLI_CLASSIFIER_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]

grep -Fq 'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq 'REVOKE ALL ON TABLE auth.mail_outbox FROM PUBLIC' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq 'node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma' scripts/provision-production-auth-mail-runtime.sh

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

LOCAL_STAGE='READ_ONLY_CLASSIFIER'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$EXPECTED_OWNER' '$EXPECTED_ARGS'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
expected_owner="$1"
expected_args="$2"
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT
[[ "$(id -u)" -eq 0 ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]

REMOTE_STAGE='API_IDENTITY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
role_token=''
for id in "${api_ids[@]}"; do
  one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_API'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const known = new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']);
async function run() {
  const rows = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const ro = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') = 'on' AS ro");
    if (!Array.isArray(ro) || ro.length !== 1 || ro[0].ro !== true) throw new Error('ro');
    return tx.$queryRawUnsafe(`SELECT current_user::text AS e, session_user::text AS s, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_catalog.pg_roles WHERE rolname=current_user`);
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('shape');
  const x=rows[0];
  if (!x.e || x.e !== x.s || known.has(x.e)) throw new Error('identity');
  if (x.rolsuper || x.rolbypassrls || x.rolcreatedb || x.rolcreaterole || x.rolreplication) throw new Error('privileged');
  if (/[\u0000\r\n]/.test(x.e) || Buffer.byteLength(x.e,'utf8') > 63) throw new Error('invalid');
  process.stdout.write(`SAFE_OTHER|${Buffer.from(x.e,'utf8').toString('base64url')}\n`);
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_API
)"
  [[ "$one" =~ ^SAFE_OTHER\|[A-Za-z0-9_-]+$ ]]
  candidate="${one#SAFE_OTHER|}"
  if [[ -z "$role_token" ]]; then role_token="$candidate"; else [[ "$candidate" == "$role_token" ]]; fi
done
role_hex="$(python3 - "$role_token" <<'PY'
import base64,sys
s=sys.argv[1]
pad='='*((4-len(s)%4)%4)
b=base64.urlsafe_b64decode(s+pad)
if not b or len(b)>63 or b'\x00' in b or b'\r' in b or b'\n' in b: raise SystemExit(1)
print(b.hex())
PY
)"
[[ "$role_hex" =~ ^[0-9a-f]+$ ]]

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
migration_service="$(printf '%s' "$compose_json" | python3 -c '
import json,re,sys
services=(json.load(sys.stdin).get("services") or {}); c=[]
for name,svc in services.items():
    image=str(svc.get("image") or ""); command=svc.get("command"); command=" ".join(command) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command): c.append((name,svc))
if len(c)!=1: raise SystemExit(1)
name,svc=c[0]; env=svc.get("environment") or {}
if isinstance(env,list): env={str(x).split("=",1)[0]:(str(x).split("=",1)[1] if "=" in str(x) else None) for x in env}
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",name) or not env.get("DATABASE_URL"): raise SystemExit(1)
print(name)
')"
[[ -n "$migration_service" ]]

REMOTE_STAGE='CLI_CLIENT'
db_exec() {
  "${dc[@]}" run --rm --no-deps --pull never -T "$migration_service" \
    node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma \
    >/dev/null 2>&1
}
assert_sql() {
  local condition="$1" sql
  sql="BEGIN; SET TRANSACTION READ ONLY; DO \$pc\$ BEGIN IF NOT COALESCE(($condition), FALSE) THEN RAISE EXCEPTION 'classifier'; END IF; END \$pc\$; ROLLBACK;"
  printf '%s\n' "$sql" | db_exec
}
class_bool() {
  local key="$1" condition="$2"
  if assert_sql "$condition"; then
    printf '%s|YES\n' "$key"
  elif assert_sql "NOT COALESCE(($condition), FALSE)"; then
    printf '%s|NO\n' "$key"
  else
    printf '%s|QUERY_FAIL\n' "$key"
  fi
}

if printf '%s\n' "BEGIN; SET TRANSACTION READ ONLY; DO \$pc\$ BEGIN IF current_setting('transaction_read_only') <> 'on' THEN RAISE EXCEPTION 'classifier'; END IF; END \$pc\$; ROLLBACK;" | db_exec; then
  printf 'ADMIN_CLIENT|PASS\n'
else
  printf 'ADMIN_CLIENT|FAIL\n'
  exit 41
fi

role_expr="convert_from(pg_catalog.decode('$role_hex','hex'),'UTF8')"
role_count="(SELECT count(*)=1 FROM pg_catalog.pg_roles WHERE rolname=$role_expr)"
if assert_sql "$role_count"; then
  printf 'ROLE_LOOKUP|PASS\n'
else
  printf 'ROLE_LOOKUP|MISSING_OR_AMBIGUOUS\n'
  exit 42
fi
priv_expr="(SELECT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication) FROM pg_catalog.pg_roles WHERE rolname=$role_expr)"
if assert_sql "$priv_expr"; then printf 'ROLE_ATTR|PRIVILEGED\n';
elif assert_sql "NOT COALESCE(($priv_expr),FALSE)"; then printf 'ROLE_ATTR|SAFE\n';
else printf 'ROLE_ATTR|QUERY_FAIL\n'; fi
class_bool ROLE_INHERIT "(SELECT rolinherit FROM pg_catalog.pg_roles WHERE rolname=$role_expr)"
class_bool MEMBERSHIP_OUT "EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.member WHERE r.rolname=$role_expr)"
class_bool MEMBERSHIP_IN "EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid WHERE r.rolname=$role_expr)"
class_bool ADMIN_SUPERUSER "(SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)"

fn_base="FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='enqueue_mail_outbox' AND pg_catalog.pg_get_function_identity_arguments(p.oid)='$expected_args'"
if assert_sql "(SELECT count(*)=1 $fn_base)"; then
  printf 'FUNCTION_META|PASS\n'
  class_bool FUNCTION_OWNER "(SELECT pg_catalog.pg_get_userbyid(p.proowner)='$expected_owner' $fn_base)"
  class_bool PUBLIC_EXECUTE "(SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') $fn_base)"
else
  printf 'FUNCTION_META|MISSING_OR_AMBIGUOUS\nFUNCTION_OWNER|QUERY_FAIL\nPUBLIC_EXECUTE|QUERY_FAIL\n'
fi
class_bool SCHEMA_USAGE "(SELECT pg_catalog.has_schema_privilege($role_expr,n.oid,'USAGE') FROM pg_catalog.pg_namespace n WHERE n.nspname='auth')"
class_bool FUNCTION_EXECUTE "(SELECT pg_catalog.has_function_privilege($role_expr,p.oid,'EXECUTE') $fn_base)"

table_base="FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname='mail_outbox' AND c.relkind IN ('r','p')"
if assert_sql "(SELECT count(*)=1 $table_base)"; then
  printf 'TABLE_META|PASS\n'
  class_bool TABLE_EFFECTIVE "(SELECT pg_catalog.has_table_privilege($role_expr,c.oid,'SELECT') OR pg_catalog.has_table_privilege($role_expr,c.oid,'INSERT') OR pg_catalog.has_table_privilege($role_expr,c.oid,'UPDATE') OR pg_catalog.has_table_privilege($role_expr,c.oid,'DELETE') OR pg_catalog.has_table_privilege($role_expr,c.oid,'TRUNCATE') OR pg_catalog.has_table_privilege($role_expr,c.oid,'REFERENCES') OR pg_catalog.has_table_privilege($role_expr,c.oid,'TRIGGER') $table_base)"
  class_bool TABLE_DIRECT "(SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE a.grantee=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$role_expr)) $table_base)"
  class_bool TABLE_PUBLIC "(SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE a.grantee=0) $table_base)"
else
  printf 'TABLE_META|MISSING_OR_AMBIGUOUS\nTABLE_EFFECTIVE|QUERY_FAIL\nTABLE_DIRECT|QUERY_FAIL\nTABLE_PUBLIC|QUERY_FAIL\n'
fi
REMOTE_STAGE='COMPLETE'
REMOTE
)"; then
  REMOTE_RC=0
else
  REMOTE_RC=$?
fi

remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
mutation_marker="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1 || true)"
[[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r _ REMOTE_STAGE marker_rc <<< "$remote_marker"
[[ "$marker_rc" == "$REMOTE_RC" ]]
[[ "$mutation_marker" == 'PRODUCTION_MUTATION=NONE' ]]
(( REMOTE_RC == 0 )) || publish_failure "$REMOTE_RC"

required=(ADMIN_CLIENT ROLE_LOOKUP ROLE_ATTR ROLE_INHERIT MEMBERSHIP_OUT MEMBERSHIP_IN ADMIN_SUPERUSER FUNCTION_META FUNCTION_OWNER PUBLIC_EXECUTE SCHEMA_USAGE FUNCTION_EXECUTE TABLE_META TABLE_EFFECTIVE TABLE_DIRECT TABLE_PUBLIC)
classifier=''
for key in "${required[@]}"; do
  line="$(grep "^${key}|" <<< "$output" || true)"
  [[ "$(grep -c "^${key}|" <<< "$output" || true)" == 1 ]]
  [[ "$line" =~ ^[A-Z_]+\|[A-Z_]+$ ]]
  classifier+="$line"$'\n'
done

LOCAL_STAGE='FINAL_MAIN_GUARD'
guard_main
LOCAL_STAGE='PUBLISH'
format_line(){ local key="$1"; grep "^${key}|" <<< "$classifier" | cut -d'|' -f2; }
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail authority CLI classifier v2

- diagnostic main: \`$SOURCE_SHA\`
- result: \`READ_ONLY_CLASSIFIED\`
- migration datasource CLI client: \`$(format_line ADMIN_CLIENT)\`
- target role lookup: \`$(format_line ROLE_LOOKUP)\`
- target role attributes: \`$(format_line ROLE_ATTR)\`
- target role INHERIT: \`$(format_line ROLE_INHERIT)\`
- target is member of another role: \`$(format_line MEMBERSHIP_OUT)\`
- target is granted to another role: \`$(format_line MEMBERSHIP_IN)\`
- migration authority superuser: \`$(format_line ADMIN_SUPERUSER)\`
- exact enqueue function metadata: \`$(format_line FUNCTION_META)\`
- exact enqueue function owner expected: \`$(format_line FUNCTION_OWNER)\`
- PUBLIC EXECUTE on exact enqueue function: \`$(format_line PUBLIC_EXECUTE)\`
- target auth schema USAGE: \`$(format_line SCHEMA_USAGE)\`
- target exact enqueue EXECUTE: \`$(format_line FUNCTION_EXECUTE)\`
- auth.mail_outbox metadata: \`$(format_line TABLE_META)\`
- target effective auth.mail_outbox table privileges: \`$(format_line TABLE_EFFECTIVE)\`
- target direct auth.mail_outbox ACL: \`$(format_line TABLE_DIRECT)\`
- PUBLIC auth.mail_outbox ACL: \`$(format_line TABLE_PUBLIC)\`
- raw DB role / role token / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / database write / API-Web restart: \`NONE\`
- production mutation: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null

echo 'AUTH_MAIL_AUTHORITY_CLI_CLASSIFIER_V2=PASS'
echo 'PRODUCTION_MUTATION=NONE'
