#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_RUNTIME_PRINCIPAL_POSTVERIFY_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-runtime-principal-postverify 31996401705 current-main'
BASELINE_SHA='b67f6b740bd0f000c91ffb87a76cb3c104cc90d3'
UPSTREAM_COMMENT_ID='5312046784'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'
EXPECTED_ARG_TYPES='text, text, text, text, text, integer, text, text, text, integer, timestamp with time zone, timestamp with time zone'
EXPECTED_SEARCH_PATH='search_path=pg_catalog, auth, pg_temp'
EXPECTED_ROW_SECURITY='row_security=on'
WORKFLOW_PATH='.github/workflows/production-p0-auth-mail-runtime-principal-postverify-31996401705.yml'
SCRIPT_PATH='scripts/production-p0-auth-mail-runtime-principal-postverify-31996401705.sh'
CHECKER_PATH='scripts/check-production-p0-auth-mail-runtime-principal-postverify-31996401705.mjs'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-runtime-principal-postverify-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-runtime-principal-postverify-known-hosts"
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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail runtime-principal postverify

- diagnostic main: \`$SOURCE_SHA\`
- upstream preflight run: \`31996401705\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- raw DB role / DB URL / credentials / raw DB errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment / restart: \`NONE\`
- API/Web/database mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
on_err() { local rc="$?"; publish_failure "$rc"; }
trap on_err ERR

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
[[ "$PC_AUTH_MAIL_RUNTIME_PRINCIPAL_POSTVERIFY_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]
git cat-file -e "${BASELINE_SHA}^{commit}"
git merge-base --is-ancestor "$BASELINE_SHA" "$CURRENT_MAIN"
mapfile -t drift_paths < <(git diff --name-only "$BASELINE_SHA..$CURRENT_MAIN" | sort -u)
(( ${#drift_paths[@]} == 3 ))
for path in "${drift_paths[@]}"; do
  case "$path" in
    "$WORKFLOW_PATH"|"$SCRIPT_PATH"|"$CHECKER_PATH") ;;
    *) exit 81 ;;
  esac
done

LOCAL_STAGE='UPSTREAM_EVIDENCE'
upstream="$(gh api "repos/$GITHUB_REPOSITORY/issues/comments/$UPSTREAM_COMMENT_ID" --jq .body)"
grep -Fq -- "- diagnostic main: \`$BASELINE_SHA\`" <<< "$upstream"
grep -Fq -- '- result: `READ_ONLY_AUTHORITY_SPLIT_COMPLETE`' <<< "$upstream"
grep -Fq -- '- DB preflight: `BLOCK`' <<< "$upstream"
grep -Fq -- '- migration 20260812010000_p0_industrial_auth_mail_outbox: `APPLIED_AND_HISTORY_CONSISTENT`' <<< "$upstream"
grep -Fq -- '- migration service history status: `UP_TO_DATE`' <<< "$upstream"
grep -Fq -- '- migration image contains exact current migration bytes: `YES`' <<< "$upstream"
grep -Fq -- '- effective API runtime DB role: `OTHER`' <<< "$upstream"
grep -Fq -- '- auth schema present: `YES`' <<< "$upstream"
grep -Fq -- '- effective runtime auth schema USAGE: `YES`' <<< "$upstream"
grep -Fq -- '- auth.mail_outbox table present: `YES`' <<< "$upstream"
grep -Fq -- '- exact 12-argument enqueue_mail_outbox present: `YES`' <<< "$upstream"
grep -Fq -- '- function owner pc_auth_mail_enqueue_authority: `YES`' <<< "$upstream"
grep -Fq -- '- effective runtime enqueue EXECUTE: `YES`' <<< "$upstream"
grep -Fq -- '- enqueue_mail_outbox overload count: `1`' <<< "$upstream"
grep -Fq -- '- API/Web/database mutation: `NONE`' <<< "$upstream"

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
scan="$(mktemp)"
match="$(mktemp)"
pinned=0
for attempt in 1 2 3; do
  : > "$scan"
  : > "$match"
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
mv "$match" "$known_hosts"
match=''
rm -f "$scan"
scan=''
chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

LOCAL_STAGE='REMOTE_PREFLIGHT'
guard_main
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

LOCAL_STAGE='CAPABILITY_POSTVERIFY'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$BASELINE_SHA' '$EXPECTED_OWNER' '$EXPECTED_ARG_TYPES' '$EXPECTED_SEARCH_PATH' '$EXPECTED_ROW_SECURITY'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
expected_revision="$1"
expected_owner="$2"
expected_arg_types="$3"
expected_search_path="$4"
expected_row_security="$5"
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_DB_MUTATION=NONE\n'
  printf 'API_WEB_MUTATION=NONE\n'
  printf 'RESET_REPLAY=NONE\nMAIL_SEND=NONE\nAPI_WEB_RESTART=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT
[[ "$(id -u)" -eq 0 ]]
[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]

REMOTE_STAGE='RUNTIME_INVENTORY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
api_before=''
for id in "${api_ids[@]}"; do
  state="$(docker inspect --format '{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id")"
  [[ "$state" =~ ^running\|[0-9]+\|$expected_revision$ ]]
  api_before+="${api_before:+$'\n'}$id|$state"
done
web_id="${web_ids[0]}"
web_before="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$web_before" =~ ^[0-9a-f]+\|running\|[0-9]+\|$expected_revision$ ]]

REMOTE_STAGE='DB_CAPABILITY_READ'
role_digest=''
for id in "${api_ids[@]}"; do
  if one="$(docker exec -i "$id" /nodejs/bin/node - "$expected_owner" "$expected_arg_types" "$expected_search_path" "$expected_row_security" 2>/dev/null <<'NODE'
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const expectedOwner = process.argv[2];
const expectedArgTypes = process.argv[3];
const expectedSearchPath = process.argv[4];
const expectedRowSecurity = process.argv[5];
const prisma = new PrismaClient({ log: [] });
const fail = (reason) => {
  const allowed = new Set([
    'ROLE_SHAPE','ROLE_SESSION','ROLE_PRIVILEGED','ROLE_INHERIT','ROLE_MEMBERSHIP','ROLE_OWNER_COLLISION',
    'AUTH_SCHEMA','OUTBOX_SHAPE','OUTBOX_RLS','OUTBOX_TABLE_PRIV','OUTBOX_PUBLIC_PRIV',
    'FUNCTION_SHAPE','FUNCTION_OWNER','FUNCTION_EXECUTE','FUNCTION_PUBLIC_EXECUTE','FUNCTION_SECURITY','FUNCTION_CONFIG',
    'READ_ONLY_NOT_ACTIVE','DB_QUERY_FAILED'
  ]);
  process.stdout.write(`RUNTIME_FAILURE|${allowed.has(reason) ? reason : 'DB_QUERY_FAILED'}\n`);
  process.exitCode = 71;
};
(async () => {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const ro = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') = 'on' AS ok");
    if (!Array.isArray(ro) || ro.length !== 1 || ro[0].ok !== true) throw Object.assign(new Error('read-only'), { safeReason: 'READ_ONLY_NOT_ACTIVE' });
    return tx.$queryRawUnsafe(`
      WITH me AS (
        SELECT r.oid, r.rolname, r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole,
               r.rolreplication, r.rolinherit,
               (current_user::text = session_user::text) AS same_session,
               (SELECT COUNT(*)::int FROM pg_catalog.pg_auth_members am WHERE am.member = r.oid) AS membership_count
        FROM pg_catalog.pg_roles r
        WHERE r.rolname = current_user
      ), ns AS (
        SELECT n.oid FROM pg_catalog.pg_namespace n WHERE n.nspname = 'auth'
      ), tbl AS (
        SELECT c.oid, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.relacl
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'auth' AND c.relname = 'mail_outbox' AND c.relkind IN ('r','p')
      ), fns AS (
        SELECT p.oid, p.proowner, p.prosecdef, p.proconfig,
               pg_catalog.oidvectortypes(p.proargtypes) = '${expectedArgTypes.replaceAll("'", "''")}' AS signature_ok,
               pg_catalog.pg_get_userbyid(p.proowner) = '${expectedOwner.replaceAll("'", "''")}' AS owner_ok,
               pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE') AS execute_ok,
               EXISTS (
                 SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                 WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
               ) AS public_execute,
               COALESCE('${expectedSearchPath.replaceAll("'", "''")}' = ANY(p.proconfig), false) AS search_path_ok,
               COALESCE('${expectedRowSecurity.replaceAll("'", "''")}' = ANY(p.proconfig), false) AS row_security_ok
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'enqueue_mail_outbox'
      )
      SELECT
        (SELECT COUNT(*)::int FROM me) AS role_count,
        (SELECT rolname FROM me) AS role_name,
        (SELECT same_session FROM me) AS same_session,
        (SELECT rolsuper FROM me) AS rolsuper,
        (SELECT rolbypassrls FROM me) AS rolbypassrls,
        (SELECT rolcreatedb FROM me) AS rolcreatedb,
        (SELECT rolcreaterole FROM me) AS rolcreaterole,
        (SELECT rolreplication FROM me) AS rolreplication,
        (SELECT rolinherit FROM me) AS rolinherit,
        (SELECT membership_count FROM me) AS membership_count,
        (SELECT COUNT(*)::int FROM ns) AS schema_count,
        COALESCE((SELECT pg_catalog.has_schema_privilege(current_user, oid, 'USAGE') FROM ns), false) AS schema_usage,
        (SELECT COUNT(*)::int FROM tbl) AS table_count,
        COALESCE((SELECT relrowsecurity FROM tbl), false) AS rls,
        COALESCE((SELECT relforcerowsecurity FROM tbl), false) AS force_rls,
        COALESCE((SELECT
          pg_catalog.has_table_privilege(current_user, oid, 'SELECT') OR
          pg_catalog.has_table_privilege(current_user, oid, 'INSERT') OR
          pg_catalog.has_table_privilege(current_user, oid, 'UPDATE') OR
          pg_catalog.has_table_privilege(current_user, oid, 'DELETE') OR
          pg_catalog.has_table_privilege(current_user, oid, 'TRUNCATE') OR
          pg_catalog.has_table_privilege(current_user, oid, 'REFERENCES') OR
          pg_catalog.has_table_privilege(current_user, oid, 'TRIGGER')
        FROM tbl), true) AS any_table_priv,
        COALESCE((SELECT EXISTS (
          SELECT 1 FROM pg_catalog.aclexplode(COALESCE(t.relacl, pg_catalog.acldefault('r', t.relowner))) a
          WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
        ) FROM tbl t), true) AS public_table_priv,
        (SELECT COUNT(*)::int FROM fns) AS overload_count,
        (SELECT COUNT(*)::int FROM fns WHERE signature_ok) AS exact_count,
        COALESCE((SELECT bool_or(signature_ok AND owner_ok) FROM fns), false) AS owner_ok,
        COALESCE((SELECT bool_or(signature_ok AND execute_ok) FROM fns), false) AS execute_ok,
        COALESCE((SELECT bool_or(signature_ok AND public_execute) FROM fns), true) AS public_execute,
        COALESCE((SELECT bool_or(signature_ok AND prosecdef) FROM fns), false) AS security_definer,
        COALESCE((SELECT bool_or(signature_ok AND search_path_ok AND row_security_ok) FROM fns), false) AS config_ok
    `);
  }, { maxWait: 5000, timeout: 15000 });
  if (!Array.isArray(rows) || rows.length !== 1) return fail('DB_QUERY_FAILED');
  const x = rows[0];
  if (Number(x.role_count) !== 1 || typeof x.role_name !== 'string' || !x.role_name) return fail('ROLE_SHAPE');
  if (x.same_session !== true) return fail('ROLE_SESSION');
  if (x.rolsuper || x.rolbypassrls || x.rolcreatedb || x.rolcreaterole || x.rolreplication) return fail('ROLE_PRIVILEGED');
  if (x.rolinherit !== false) return fail('ROLE_INHERIT');
  if (Number(x.membership_count) !== 0) return fail('ROLE_MEMBERSHIP');
  if (x.role_name === expectedOwner || x.role_name === 'pc_auth_mail_retention_authority') return fail('ROLE_OWNER_COLLISION');
  if (Number(x.schema_count) !== 1 || x.schema_usage !== true) return fail('AUTH_SCHEMA');
  if (Number(x.table_count) !== 1) return fail('OUTBOX_SHAPE');
  if (x.rls !== true || x.force_rls !== true) return fail('OUTBOX_RLS');
  if (x.any_table_priv !== false) return fail('OUTBOX_TABLE_PRIV');
  if (x.public_table_priv !== false) return fail('OUTBOX_PUBLIC_PRIV');
  if (Number(x.overload_count) !== 1 || Number(x.exact_count) !== 1) return fail('FUNCTION_SHAPE');
  if (x.owner_ok !== true) return fail('FUNCTION_OWNER');
  if (x.execute_ok !== true) return fail('FUNCTION_EXECUTE');
  if (x.public_execute !== false) return fail('FUNCTION_PUBLIC_EXECUTE');
  if (x.security_definer !== true) return fail('FUNCTION_SECURITY');
  if (x.config_ok !== true) return fail('FUNCTION_CONFIG');
  const digest = crypto.createHash('sha256').update(x.role_name, 'utf8').digest('hex');
  process.stdout.write(`SAFE_RUNTIME|${digest}\n`);
})().catch((error) => fail(error?.safeReason || 'DB_QUERY_FAILED')).finally(async () => { try { await prisma.$disconnect(); } catch {} });
NODE
)"; then
    one_rc=0
  else
    one_rc=$?
  fi
  if (( one_rc != 0 )); then
    [[ "$one" =~ ^RUNTIME_FAILURE\|[A-Z0-9_]+$ ]] && printf '%s\n' "$one"
    REMOTE_STAGE='DB_CAPABILITY_FAILED'
    exit "$one_rc"
  fi
  [[ "$one" =~ ^SAFE_RUNTIME\|[0-9a-f]{64}$ ]]
  digest="${one#SAFE_RUNTIME|}"
  if [[ -z "$role_digest" ]]; then role_digest="$digest"; else [[ "$digest" == "$role_digest" ]]; fi
done

REMOTE_STAGE='POST_INVARIANTS'
api_after=''
for id in "${api_ids[@]}"; do
  state="$(docker inspect --format '{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id")"
  api_after+="${api_after:+$'\n'}$id|$state"
done
web_after="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_before" == "$api_after" && "$web_before" == "$web_after" ]]
printf 'CAPABILITY_EVIDENCE|SAFE_CUSTOM_APPLICATION_PRINCIPAL|%s|%s\n' "$role_digest" "${#api_ids[@]}"
REMOTE_STAGE='COMPLETE'
REMOTE
)"; then
  remote_rc=0
else
  remote_rc=$?
fi
remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
if [[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; then
  IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$remote_marker"
else
  REMOTE_STAGE='NO_SAFE_REMOTE_MARKER'
  REMOTE_RC="$remote_rc"
fi
[[ "$(grep '^PRODUCTION_DB_MUTATION=' <<< "$output" | tail -n1 || true)" == 'PRODUCTION_DB_MUTATION=NONE' ]]
[[ "$(grep '^API_WEB_MUTATION=' <<< "$output" | tail -n1 || true)" == 'API_WEB_MUTATION=NONE' ]]
[[ "$(grep '^RESET_REPLAY=' <<< "$output" | tail -n1 || true)" == 'RESET_REPLAY=NONE' ]]
[[ "$(grep '^MAIL_SEND=' <<< "$output" | tail -n1 || true)" == 'MAIL_SEND=NONE' ]]
[[ "$(grep '^API_WEB_RESTART=' <<< "$output" | tail -n1 || true)" == 'API_WEB_RESTART=NONE' ]]
if (( remote_rc != 0 )); then
  safe_failure="$(grep '^RUNTIME_FAILURE|' <<< "$output" | tail -n1 || true)"
  [[ -n "$safe_failure" ]] || safe_failure='SANITIZED_TECHNICAL_FAILURE'
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail runtime-principal postverify

- diagnostic main: \`$SOURCE_SHA\`
- upstream preflight run: \`31996401705\`
- upstream role-label result: \`OTHER / BLOCK\`
- result: \`FAIL_CLOSED_CAPABILITY_POSTVERIFY\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- sanitized failure: \`$safe_failure\`
- raw DB role / DB URL / credentials / raw DB errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment / restart: \`NONE\`
- API/Web/database mutation: \`NONE\`" >/dev/null || true
  result_published=1
  exit "$remote_rc"
fi

LOCAL_STAGE='EVIDENCE_PARSE'
evidence="$(grep '^CAPABILITY_EVIDENCE|' <<< "$output" | tail -n1 || true)"
[[ "$evidence" =~ ^CAPABILITY_EVIDENCE\|SAFE_CUSTOM_APPLICATION_PRINCIPAL\|[0-9a-f]{64}\|[1-4]$ ]]
IFS='|' read -r _ classification role_digest api_count <<< "$evidence"

guard_main
LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail runtime-principal postverify

- diagnostic main: \`$SOURCE_SHA\`
- deployed runtime revision verified: \`$BASELINE_SHA\`
- upstream preflight run: \`31996401705\`
- upstream preflight facts: \`MIGRATION/HISTORY/SCHEMA/FUNCTION/OWNER/EXECUTE = PASS\`
- upstream block isolated to role label: \`OTHER\`
- capability-based runtime principal: \`$classification\`
- current_user equals session_user: \`YES\`
- superuser / BYPASSRLS / CREATEDB / CREATEROLE / REPLICATION: \`NONE\`
- role inheritance: \`NOINHERIT\`
- role memberships: \`NONE\`
- auth schema USAGE: \`YES\`
- auth.mail_outbox direct/effective table privileges: \`NONE\`
- auth.mail_outbox PUBLIC privileges: \`NONE\`
- auth.mail_outbox RLS + FORCE RLS: \`YES\`
- exact enqueue owner / SECURITY DEFINER / fixed search_path+row_security: \`PASS\`
- runtime enqueue EXECUTE: \`YES\`
- PUBLIC enqueue EXECUTE: \`NO\`
- active API runtimes checked: \`$api_count\`
- runtime principal stable across API runtimes: \`YES\`
- successor DB preflight: \`PASS\`
- raw DB role / role digest / DB URL / credentials / raw DB errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment / restart: \`NONE\`
- API/Web/database mutation: \`NONE\`" >/dev/null
result_published=1
LOCAL_STAGE='COMPLETE'
printf 'AUTH_MAIL_DB_PREFLIGHT=PASS_SAFE_CAPABILITY_PRINCIPAL\nPRODUCTION_DB_MUTATION=NONE\n'
