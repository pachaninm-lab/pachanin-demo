#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_DB_PREFLIGHT_COMMAND:?PC_AUTH_MAIL_DB_PREFLIGHT_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-db-preflight 31980524957 current-main'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-db-preflight-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-db-preflight-known-hosts"
scan=''; match=''; result_published=0
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
  if [[ "$result_published" == 0 ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB read-only preflight

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- DB URL / credentials / raw query errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
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
[[ "$PC_AUTH_MAIL_DB_PREFLIGHT_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
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
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

LOCAL_STAGE='REMOTE_DB_READ'
guard_main
set +e
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$MIGRATION_NAME'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
migration_name="$1"
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$migration_name" == '20260812010000_p0_industrial_auth_mail_outbox' ]]
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='API_INVENTORY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))

evidence=''
for id in "${api_ids[@]}"; do
  REMOTE_STAGE='PRISMA_CLIENT'
  docker exec "$id" node -e "require.resolve('@prisma/client')" >/dev/null 2>&1

  REMOTE_STAGE='DB_QUERY'
  line="$(docker exec -i "$id" node - 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const migrationName = '20260812010000_p0_industrial_auth_mail_outbox';
const yn = (v) => v === true ? 'YES' : 'NO';

async function run() {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const metaRows = await tx.$queryRawUnsafe(`
      WITH
      type_oids AS (
        SELECT
          'pg_catalog.text'::regtype::oid AS text_oid,
          'pg_catalog.uuid'::regtype::oid AS uuid_oid,
          (SELECT t.oid FROM pg_catalog.pg_type t WHERE t.typname = 'citext' ORDER BY t.oid LIMIT 1) AS citext_oid
      ),
      fn AS (
        SELECT (
          SELECT p.oid
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          CROSS JOIN type_oids t
          WHERE n.nspname = 'auth'
            AND p.proname = 'enqueue_mail_outbox'
            AND p.pronargs = 12
            AND p.proargtypes[0] = t.text_oid
            AND p.proargtypes[1] = t.citext_oid
            AND p.proargtypes[2] = t.citext_oid
            AND p.proargtypes[3] = t.text_oid
            AND p.proargtypes[4] = t.text_oid
            AND p.proargtypes[5] = t.text_oid
            AND p.proargtypes[6] = t.text_oid
            AND p.proargtypes[7] = t.text_oid
            AND p.proargtypes[8] = t.uuid_oid
            AND p.proargtypes[9] = t.uuid_oid
            AND p.proargtypes[10] = t.uuid_oid
            AND p.proargtypes[11] = t.text_oid
          LIMIT 1
        ) AS oid
      ),
      auth_ns AS (SELECT pg_catalog.to_regnamespace('auth') AS oid),
      mig_rel AS (SELECT pg_catalog.to_regclass('public."_prisma_migrations"') AS oid),
      pc_app_role AS (SELECT pg_catalog.to_regrole('pc_app') AS oid)
      SELECT
        mig_rel.oid IS NOT NULL AS migrations_table_present,
        CASE
          WHEN mig_rel.oid IS NULL THEN 'TABLE_MISSING'
          WHEN pg_catalog.has_table_privilege(current_user, mig_rel.oid, 'SELECT') THEN 'YES'
          ELSE 'NO'
        END AS migrations_table_select,
        auth_ns.oid IS NOT NULL AS auth_schema_present,
        pg_catalog.to_regclass('auth.mail_outbox') IS NOT NULL AS mail_outbox_table_present,
        fn.oid IS NOT NULL AS function_12_present,
        (
          SELECT COUNT(*)::int
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'auth' AND p.proname = 'enqueue_mail_outbox'
        ) AS overload_count,
        CASE
          WHEN auth_ns.oid IS NULL THEN 'NO_SCHEMA'
          WHEN pg_catalog.has_schema_privilege(current_user, auth_ns.oid, 'USAGE') THEN 'YES'
          ELSE 'NO'
        END AS current_schema_usage,
        CASE
          WHEN fn.oid IS NULL THEN 'FUNCTION_MISSING'
          WHEN pg_catalog.has_function_privilege(current_user, fn.oid, 'EXECUTE') THEN 'YES'
          ELSE 'NO'
        END AS current_function_execute,
        CASE
          WHEN pc_app_role.oid IS NULL THEN 'ROLE_MISSING'
          WHEN auth_ns.oid IS NULL THEN 'NO_SCHEMA'
          WHEN pg_catalog.has_schema_privilege(pc_app_role.oid, auth_ns.oid, 'USAGE') THEN 'YES'
          ELSE 'NO'
        END AS pc_app_schema_usage,
        CASE
          WHEN pc_app_role.oid IS NULL THEN 'ROLE_MISSING'
          WHEN fn.oid IS NULL THEN 'FUNCTION_MISSING'
          WHEN pg_catalog.has_function_privilege(pc_app_role.oid, fn.oid, 'EXECUTE') THEN 'YES'
          ELSE 'NO'
        END AS pc_app_function_execute,
        CASE WHEN current_user = 'pc_app' THEN 'PC_APP' ELSE 'OTHER' END AS effective_role_class
      FROM fn, auth_ns, mig_rel, pc_app_role
    `);
    if (!Array.isArray(metaRows) || metaRows.length !== 1) throw new Error('meta shape');
    const meta = metaRows[0];
    let migrationState;
    if (meta.migrations_table_present !== true) {
      migrationState = 'TABLE_MISSING';
    } else if (meta.migrations_table_select !== 'YES') {
      migrationState = 'UNREADABLE';
    } else {
      const rows = await tx.$queryRawUnsafe(`
        SELECT finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
        FROM public."_prisma_migrations"
        WHERE migration_name = '20260812010000_p0_industrial_auth_mail_outbox'
        ORDER BY started_at DESC
        LIMIT 1
      `);
      if (!Array.isArray(rows) || rows.length === 0) migrationState = 'MISSING';
      else migrationState = rows[0].finished === true && rows[0].rolled_back !== true ? 'APPLIED' : 'FAILED_OR_ROLLED_BACK';
    }
    return { meta, migrationState };
  });

  const m = result.meta;
  const fields = [
    result.migrationState,
    yn(m.function_12_present),
    yn(m.auth_schema_present),
    yn(m.mail_outbox_table_present),
    String(m.overload_count),
    String(m.current_schema_usage),
    String(m.current_function_execute),
    String(m.pc_app_schema_usage),
    String(m.pc_app_function_execute),
    String(m.effective_role_class),
  ];
  const safe = /^(APPLIED|MISSING|FAILED_OR_ROLLED_BACK|TABLE_MISSING|UNREADABLE)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|[0-9]+\|(YES|NO|NO_SCHEMA)\|(YES|NO|FUNCTION_MISSING)\|(YES|NO|ROLE_MISSING|NO_SCHEMA)\|(YES|NO|ROLE_MISSING|FUNCTION_MISSING)\|(PC_APP|OTHER)$/;
  const payload = fields.join('|');
  if (!safe.test(payload)) process.exitCode = 42;
  else process.stdout.write(`DB_EVIDENCE|${payload}\n`);
}

run()
  .catch(() => { process.exitCode = 41; })
  .finally(async () => { try { await prisma.$disconnect(); } catch {} });
NODE
)"
  [[ "$line" =~ ^DB_EVIDENCE\| ]]
  evidence+="${evidence:+$'\n'}$line"
done

REMOTE_STAGE='CONSISTENCY_CHECK'
unique="$(sort -u <<< "$evidence")"
[[ "$(grep -c '^DB_EVIDENCE|' <<< "$unique")" == 1 ]]
printf '%s\n' "$unique"
printf 'API_RUNTIME_COUNT|%s\n' "${#api_ids[@]}"
REMOTE_STAGE='COMPLETE'
REMOTE
)"
ssh_rc=$?
set -e

remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1 || true)"
if [[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; then
  IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$remote_marker"
else
  REMOTE_STAGE='NO_SAFE_REMOTE_MARKER'
  REMOTE_RC="$ssh_rc"
fi
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]] || { REMOTE_STAGE='MUTATION_ATTESTATION_MISSING'; REMOTE_RC="$ssh_rc"; publish_failure 91; }
if (( ssh_rc != 0 )); then
  publish_failure "$ssh_rc"
fi

LOCAL_STAGE='EVIDENCE_PARSE'
marker="$(grep '^DB_EVIDENCE|' <<< "$output" | tail -n1 || true)"
runtime_count="$(grep '^API_RUNTIME_COUNT|' <<< "$output" | tail -n1 || true)"
[[ "$marker" =~ ^DB_EVIDENCE\|(APPLIED|MISSING|FAILED_OR_ROLLED_BACK|TABLE_MISSING|UNREADABLE)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|[0-9]+\|(YES|NO|NO_SCHEMA)\|(YES|NO|FUNCTION_MISSING)\|(YES|NO|ROLE_MISSING|NO_SCHEMA)\|(YES|NO|ROLE_MISSING|FUNCTION_MISSING)\|(PC_APP|OTHER)$ ]]
[[ "$runtime_count" =~ ^API_RUNTIME_COUNT\|[1-4]$ ]]
IFS='|' read -r _ migration_state function_12 auth_schema outbox_table overload_count current_schema current_exec pc_app_schema pc_app_exec role_class <<< "$marker"
IFS='|' read -r _ api_count <<< "$runtime_count"
[[ "$REMOTE_STAGE" == 'COMPLETE' && "$REMOTE_RC" == '0' ]]

guard_main
LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB read-only preflight

- diagnostic main: \`$SOURCE_SHA\`
- result: \`READ_ONLY_PREFLIGHT_COMPLETE\`
- migration $MIGRATION_NAME: \`$migration_state\`
- auth schema present: \`$auth_schema\`
- auth.mail_outbox table present: \`$outbox_table\`
- exact enqueue_mail_outbox 12-arg function present: \`$function_12\`
- enqueue_mail_outbox overload count: \`$overload_count\`
- effective runtime DB role: \`$role_class\`
- effective role auth schema USAGE: \`$current_schema\`
- effective role enqueue EXECUTE: \`$current_exec\`
- pc_app auth schema USAGE: \`$pc_app_schema\`
- pc_app enqueue EXECUTE: \`$pc_app_exec\`
- active API runtimes checked: \`$api_count\`
- DB URL / credentials / raw query errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
LOCAL_STAGE='COMPLETE'
printf 'READ_ONLY_DB_PREFLIGHT=PASS\nPRODUCTION_MUTATION=NONE\n'
