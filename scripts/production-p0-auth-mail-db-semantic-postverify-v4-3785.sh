#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_DB_SEMANTIC_POSTVERIFY_V4_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-db-semantic-postverify-v4 31996401705 current-main'
EVIDENCE_RUN='31996401705'
EVIDENCE_COMMENT='5312046784'
EVIDENCE_SHA='b67f6b740bd0f000c91ffb87a76cb3c104cc90d3'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'
MIGRATION_PATH="apps/api/prisma/migrations/${MIGRATION_NAME}/migration.sql"

key_path="$RUNNER_TEMP/p0-auth-mail-db-semantic-postverify-v4-key"
known_hosts="$RUNNER_TEMP/p0-auth-mail-db-semantic-postverify-v4-known-hosts"
scan=''
match=''
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
result_published=0

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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB semantic postverify v4

- postverify main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- prior migration evidence run: \`$EVIDENCE_RUN\`
- raw DB role / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / API-Web restart: \`NONE\`
- production DB/schema mutation: \`NONE\`
- new mandatory cost: \`0 RUB\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
trap 'rc=$?; publish_failure "$rc"' ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

LOCAL_STAGE='AUTHORITY'
[[ "$PC_AUTH_MAIL_DB_SEMANTIC_POSTVERIFY_V4_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]
[[ -f "$MIGRATION_PATH" ]]

LOCAL_STAGE='EVIDENCE_CHAIN'
run_head="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$EVIDENCE_RUN" --jq .head_sha)"
run_path="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$EVIDENCE_RUN" --jq .path)"
[[ "$run_head" == "$EVIDENCE_SHA" ]]
[[ "$run_path" == '.github/workflows/production-p0-auth-mail-db-authority-split-31982996511.yml' ]]
comment_user="$(gh api "repos/$GITHUB_REPOSITORY/issues/comments/$EVIDENCE_COMMENT" --jq .user.login)"
comment_body="$(gh api "repos/$GITHUB_REPOSITORY/issues/comments/$EVIDENCE_COMMENT" --jq .body)"
[[ "$comment_user" == 'github-actions[bot]' ]]
for token in \
  "diagnostic main: \`$EVIDENCE_SHA\`" \
  'migration 20260812010000_p0_industrial_auth_mail_outbox: `APPLIED_AND_HISTORY_CONSISTENT`' \
  'migration service history status: `UP_TO_DATE`' \
  'migration image contains exact current migration bytes: `YES`' \
  'auth schema present: `YES`' \
  'effective runtime auth schema USAGE: `YES`' \
  'auth.mail_outbox table present: `YES`' \
  'exact 12-argument enqueue_mail_outbox present: `YES`' \
  'function owner pc_auth_mail_enqueue_authority: `YES`' \
  'effective runtime enqueue EXECUTE: `YES`' \
  'enqueue_mail_outbox overload count: `1`' \
  'API/Web/database mutation: `NONE`'
do
  grep -Fq -- "$token" <<< "$comment_body"
done
git cat-file -e "${EVIDENCE_SHA}^{commit}"
git merge-base --is-ancestor "$EVIDENCE_SHA" "$CURRENT_MAIN"
git diff --quiet "$EVIDENCE_SHA" "$CURRENT_MAIN" -- apps/api/prisma/migrations

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
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

LOCAL_STAGE='SEMANTIC_DB_POSTVERIFY'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" 'bash -s' 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_DB_MUTATION|NONE\nAPI_WEB_RESTART|NONE\nPASSWORD_RESET|NONE\nMAIL_SEND|NONE\n'
  exit "$rc"
}
trap remote_exit EXIT
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='RUNTIME_INVENTORY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
api_before=''
for id in "${api_ids[@]}"; do
  state="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id")"
  api_before+="${api_before:+$'\n'}$state"
done
web_id="${web_ids[0]}"
web_before="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"

REMOTE_STAGE='SEMANTIC_RUNTIME'
for id in "${api_ids[@]}"; do
  verdict="$(docker exec -i "$id" node - 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const known = new Set([
  'pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app',
  'pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority'
]);
const expectedArgs = 'text, text, text, text, text, integer, text, text, text, integer, timestamp with time zone, timestamp with time zone';
async function run() {
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const ro = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') = 'on' AS ok");
    const role = await tx.$queryRawUnsafe(`
      SELECT current_user::text AS e, session_user::text AS s,
             r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole,
             r.rolreplication, r.rolinherit,
             (SELECT count(*)::int FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid OR m.roleid=r.oid) AS memberships
      FROM pg_catalog.pg_roles r WHERE r.rolname=current_user
    `);
    const acl = await tx.$queryRawUnsafe(`
      WITH funcs AS (
        SELECT p.oid, pg_catalog.oidvectortypes(p.proargtypes) AS args,
               pg_catalog.pg_get_userbyid(p.proowner) AS owner_name,
               p.prosecdef, p.proconfig,
               pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE') AS exec_ok,
               EXISTS (
                 SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
                 WHERE a.grantee=0 AND a.privilege_type='EXECUTE'
               ) AS public_exec
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='auth' AND p.proname='enqueue_mail_outbox'
      ), tab AS (
        SELECT c.oid, c.relowner, c.relrowsecurity, c.relforcerowsecurity,
               EXISTS (
                 SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
                 WHERE a.grantee=0
               ) AS public_acl,
               (pg_catalog.has_table_privilege(current_user,c.oid,'SELECT') OR
                pg_catalog.has_table_privilege(current_user,c.oid,'INSERT') OR
                pg_catalog.has_table_privilege(current_user,c.oid,'UPDATE') OR
                pg_catalog.has_table_privilege(current_user,c.oid,'DELETE') OR
                pg_catalog.has_table_privilege(current_user,c.oid,'TRUNCATE') OR
                pg_catalog.has_table_privilege(current_user,c.oid,'REFERENCES') OR
                pg_catalog.has_table_privilege(current_user,c.oid,'TRIGGER')) AS direct_table
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='auth' AND c.relname='mail_outbox' AND c.relkind IN ('r','p')
      )
      SELECT
        (SELECT count(*)::int FROM funcs) AS overload_count,
        (SELECT count(*)::int FROM funcs WHERE args='${expectedArgs.replaceAll("'","''")}') AS exact_count,
        COALESCE((SELECT bool_and(owner_name='pc_auth_mail_enqueue_authority' AND prosecdef AND exec_ok AND NOT public_exec AND
          EXISTS (SELECT 1 FROM unnest(COALESCE(proconfig,'{}'::text[])) cfg WHERE cfg='search_path=pg_catalog, auth, pg_temp') AND
          EXISTS (SELECT 1 FROM unnest(COALESCE(proconfig,'{}'::text[])) cfg WHERE cfg='row_security=on'))
          FROM funcs WHERE args='${expectedArgs.replaceAll("'","''")}'),false) AS function_safe,
        (SELECT count(*)::int FROM tab) AS table_count,
        COALESCE((SELECT bool_and(relrowsecurity AND relforcerowsecurity AND NOT public_acl AND NOT direct_table) FROM tab),false) AS table_safe,
        (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='auth' AND c.relkind='S' AND (
            pg_catalog.has_sequence_privilege(current_user,c.oid,'USAGE') OR
            pg_catalog.has_sequence_privilege(current_user,c.oid,'SELECT') OR
            pg_catalog.has_sequence_privilege(current_user,c.oid,'UPDATE'))) AS sequence_priv_count,
        pg_catalog.has_schema_privilege(current_user,'auth','USAGE') AS schema_usage
    `);
    return { ro, role, acl };
  }, { maxWait: 5000, timeout: 15000 });
  if (!Array.isArray(result.ro) || result.ro.length!==1 || result.ro[0].ok!==true) throw new Error('readonly');
  if (!Array.isArray(result.role) || result.role.length!==1) throw new Error('role');
  if (!Array.isArray(result.acl) || result.acl.length!==1) throw new Error('acl');
  const r=result.role[0], a=result.acl[0];
  if (!r.e || r.e!==r.s || known.has(r.e)) throw new Error('identity');
  if (r.rolsuper || r.rolbypassrls || r.rolcreatedb || r.rolcreaterole || r.rolreplication || r.rolinherit) throw new Error('role-privilege');
  if (Number(r.memberships)!==0) throw new Error('membership');
  if (/[^\x20-\x7E]/.test(r.e) || Buffer.byteLength(r.e,'utf8')>63) throw new Error('role-shape');
  if (Number(a.overload_count)!==1 || Number(a.exact_count)!==1 || a.function_safe!==true) throw new Error('function');
  if (Number(a.table_count)!==1 || a.table_safe!==true || Number(a.sequence_priv_count)!==0 || a.schema_usage!==true) throw new Error('acl');
  process.stdout.write('PASS');
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE
)"
  [[ "$verdict" == 'PASS' ]]
done

REMOTE_STAGE='POST_INVARIANTS'
api_after=''
for id in "${api_ids[@]}"; do
  state="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id")"
  api_after+="${api_after:+$'\n'}$state"
done
web_after="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_before" == "$api_after" && "$web_before" == "$web_after" ]]
printf 'SEMANTIC_POSTVERIFY|PASS\nAPI_RUNTIME_COUNT|%s\n' "${#api_ids[@]}"
REMOTE_STAGE='COMPLETE'
REMOTE
)"; then
  remote_rc=0
else
  remote_rc=$?
fi
remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
[[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$remote_marker"
[[ "$REMOTE_RC" == "$remote_rc" ]]
[[ "$(grep '^PRODUCTION_DB_MUTATION|' <<< "$output" | tail -n1 || true)" == 'PRODUCTION_DB_MUTATION|NONE' ]]
[[ "$(grep '^API_WEB_RESTART|' <<< "$output" | tail -n1 || true)" == 'API_WEB_RESTART|NONE' ]]
[[ "$(grep '^PASSWORD_RESET|' <<< "$output" | tail -n1 || true)" == 'PASSWORD_RESET|NONE' ]]
[[ "$(grep '^MAIL_SEND|' <<< "$output" | tail -n1 || true)" == 'MAIL_SEND|NONE' ]]
(( remote_rc == 0 )) || publish_failure "$remote_rc"
[[ "$(grep '^SEMANTIC_POSTVERIFY|' <<< "$output" | tail -n1 || true)" == 'SEMANTIC_POSTVERIFY|PASS' ]]
runtime_count="$(grep '^API_RUNTIME_COUNT|' <<< "$output" | tail -n1 || true)"
[[ "$runtime_count" =~ ^API_RUNTIME_COUNT\|[1-4]$ ]]

LOCAL_STAGE='FINAL_MAIN_GUARD'
guard_main
LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB semantic postverify v4

- postverify main: \`$SOURCE_SHA\`
- result: \`PASS_SEMANTIC_PRINCIPAL\`
- stale literal role-name allowlist: \`SUPERSEDED_BY_SEMANTIC_ROLE_INVARIANTS\`
- live runtime identity: \`CURRENT_USER_EQ_SESSION_USER / NON_LEGACY_PRINCIPAL / NOSUPERUSER / NOBYPASSRLS / NOCREATEDB / NOCREATEROLE / NOREPLICATION / NOINHERIT / NO_MEMBERSHIPS\`
- auth-mail authority: \`SCHEMA_USAGE_YES / EXACT_ENQUEUE_EXECUTE_YES / OWNER_OK / SECURITY_DEFINER / PINNED_SEARCH_PATH / ROW_SECURITY_ON / PUBLIC_EXECUTE_NONE\`
- auth.mail_outbox: \`FORCE_RLS / PUBLIC_TABLE_NONE / DIRECT_TABLE_PRIVILEGES_NONE / AUTH_SEQUENCE_PRIVILEGES_NONE\`
- migration authority anchor: \`RUN_$EVIDENCE_RUN / APPLIED_AND_HISTORY_CONSISTENT / UP_TO_DATE / EXACT_BYTES\`
- migrations since anchor: \`UNCHANGED\`
- active API runtimes checked: \`${runtime_count#API_RUNTIME_COUNT|}\`
- raw DB role / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / API-Web restart: \`NONE\`
- production DB/schema mutation: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null
result_published=1
LOCAL_STAGE='COMPLETE'
echo 'AUTH_MAIL_DB_SEMANTIC_POSTVERIFY_V4=PASS'
echo 'PRODUCTION_DB_MUTATION=NONE'
echo 'PASSWORD_RESET=NONE'
echo 'MAIL_SEND=NONE'
