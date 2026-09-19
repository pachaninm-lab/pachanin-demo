#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_DB_PREFLIGHT_V2_COMMAND:?PC_AUTH_MAIL_DB_PREFLIGHT_V2_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-db-preflight-v2 31981767179 current-main'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'
FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-db-preflight-v2-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-db-preflight-v2-known-hosts"
scan=''
match=''
result_published=0
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
DB_FAILURE_STAGE='NONE'
DB_FAILURE_CLASS='NONE'
DB_FAILURE_SQLSTATE='NA'

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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB read-only preflight v2

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- DB failure stage: \`$DB_FAILURE_STAGE\`
- DB failure class: \`$DB_FAILURE_CLASS\`
- DB SQLSTATE class: \`$DB_FAILURE_SQLSTATE\`
- DB URL / credentials / raw query errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}

on_err() {
  local rc="$?"
  publish_failure "$rc"
}
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
[[ "$PC_AUTH_MAIL_DB_PREFLIGHT_V2_COMMAND" == "$COMMAND" ]]
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
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

validate_key() {
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || {
    rm -f "$pub"
    return 1
  }
  rm -f "$pub"
}

try_key() {
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"
  b="$(mktemp)"
  c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"
  validate_key "$a" && {
    rm -f "$a" "$b" "$c"
    return 0
  }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"
  validate_key "$b" && {
    rm -f "$a" "$b" "$c"
    return 0
  }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && {
    rm -f "$a" "$b" "$c"
    return 0
  }
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
    [[ "$(grep -c . "$match" || true)" == 1 ]] && {
      pinned=1
      break
    }
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

LOCAL_STAGE='REMOTE_DB_READ'
guard_main
set +e
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$MIGRATION_NAME' '$FUNCTION_SIG' '$EXPECTED_OWNER'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
migration_name="$1"
function_sig="$2"
expected_owner="$3"
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
[[ "$function_sig" == 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)' ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='API_INVENTORY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))

evidence=''
for id in "${api_ids[@]}"; do
  REMOTE_STAGE='PRISMA_CLIENT'
  docker exec "$id" node -e "require.resolve('@prisma/client')" >/dev/null 2>&1

  REMOTE_STAGE='DB_NODE'
  set +e
  node_output="$(docker exec -i "$id" node - 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
let stage = 'CONNECT';

const migrationName = '20260812010000_p0_industrial_auth_mail_outbox';
const functionSig = 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)';
const expectedOwner = 'pc_auth_mail_enqueue_authority';
const yn = (value) => value === true ? 'YES' : 'NO';
const allowedStages = new Set([
  'CONNECT',
  'TX_READ_ONLY',
  'TX_VERIFY',
  'CATALOG_BASE',
  'FUNCTION_META',
  'ACL',
  'MIGRATION_HISTORY',
  'EVIDENCE',
]);

function classify(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const metaCode = typeof error?.meta?.code === 'string' ? error.meta.code : '';
  let kind = 'OTHER';
  if (code === 'LOCAL_READ_ONLY_OFF') kind = 'READ_ONLY_NOT_ACTIVE';
  else if (code === 'P1001') kind = 'DB_UNREACHABLE';
  else if (code === 'P1010') kind = 'DB_ACCESS_DENIED';
  else if (code === 'P2010') kind = 'RAW_QUERY_FAILED';
  else if (code === 'P2028') kind = 'TRANSACTION_FAILED';
  else if (/^P10[0-9]{2}$/.test(code)) kind = 'PRISMA_INIT_FAILED';
  else if (/^P[0-9]{4}$/.test(code)) kind = 'PRISMA_QUERY_FAILED';
  const sqlstate = /^[0-9A-Z]{5}$/.test(metaCode) ? metaCode : 'NA';
  return { kind, sqlstate };
}

async function run() {
  stage = 'CONNECT';
  const result = await prisma.$transaction(async (tx) => {
    stage = 'TX_READ_ONLY';
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');

    stage = 'TX_VERIFY';
    const roRows = await tx.$queryRawUnsafe(`
      SELECT current_setting('transaction_read_only') = 'on' AS read_only
    `);
    if (!Array.isArray(roRows) || roRows.length !== 1 || roRows[0].read_only !== true) {
      const error = new Error('read-only transaction verification failed');
      error.code = 'LOCAL_READ_ONLY_OFF';
      throw error;
    }

    stage = 'CATALOG_BASE';
    const catalogRows = await tx.$queryRawUnsafe(`
      SELECT
        pg_catalog.to_regnamespace('auth') IS NOT NULL AS auth_schema_present,
        pg_catalog.to_regclass('auth.mail_outbox') IS NOT NULL AS mail_outbox_table_present,
        pg_catalog.to_regclass('public."_prisma_migrations"') IS NOT NULL AS migrations_table_present,
        CASE current_user
          WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'
          WHEN 'one_deal_auth' THEN 'ONE_DEAL_AUTH'
          WHEN 'app_auth' THEN 'APP_AUTH'
          WHEN 'app_service' THEN 'APP_SERVICE'
          WHEN 'pc_app' THEN 'PC_APP'
          ELSE 'OTHER'
        END AS effective_role_class
    `);
    if (!Array.isArray(catalogRows) || catalogRows.length !== 1) throw new Error('catalog shape');
    const catalog = catalogRows[0];

    stage = 'FUNCTION_META';
    const functionRows = await tx.$queryRawUnsafe(`
      SELECT
        pg_catalog.to_regprocedure('auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)') IS NOT NULL AS function_present,
        CASE
          WHEN pg_catalog.to_regprocedure('auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)') IS NULL THEN false
          ELSE COALESCE((
            SELECT pg_catalog.pg_get_userbyid(p.proowner) = 'pc_auth_mail_enqueue_authority'
            FROM pg_catalog.pg_proc p
            WHERE p.oid = pg_catalog.to_regprocedure('auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)')::oid
          ), false)
        END AS owner_ok,
        (
          SELECT COUNT(*)::int
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'auth' AND p.proname = 'enqueue_mail_outbox'
        ) AS overload_count
    `);
    if (!Array.isArray(functionRows) || functionRows.length !== 1) throw new Error('function shape');
    const fn = functionRows[0];

    stage = 'ACL';
    const aclRows = await tx.$queryRawUnsafe(`
      SELECT
        CASE
          WHEN pg_catalog.to_regnamespace('auth') IS NULL THEN false
          ELSE pg_catalog.has_schema_privilege(current_user, pg_catalog.to_regnamespace('auth')::oid, 'USAGE')
        END AS schema_usage,
        CASE
          WHEN pg_catalog.to_regprocedure('auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)') IS NULL THEN false
          ELSE pg_catalog.has_function_privilege(
            current_user,
            pg_catalog.to_regprocedure('auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)')::oid,
            'EXECUTE'
          )
        END AS function_execute,
        CASE
          WHEN pg_catalog.to_regclass('public."_prisma_migrations"') IS NULL THEN false
          ELSE pg_catalog.has_table_privilege(current_user, pg_catalog.to_regclass('public."_prisma_migrations"')::oid, 'SELECT')
        END AS migration_select
    `);
    if (!Array.isArray(aclRows) || aclRows.length !== 1) throw new Error('acl shape');
    const acl = aclRows[0];

    let migrationState = 'TABLE_MISSING';
    if (catalog.migrations_table_present === true) {
      if (acl.migration_select !== true) {
        migrationState = 'UNREADABLE';
      } else {
        stage = 'MIGRATION_HISTORY';
        const migrationRows = await tx.$queryRawUnsafe(`
          SELECT finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
          FROM public."_prisma_migrations"
          WHERE migration_name = '20260812010000_p0_industrial_auth_mail_outbox'
          ORDER BY started_at DESC
          LIMIT 1
        `);
        if (!Array.isArray(migrationRows) || migrationRows.length === 0) migrationState = 'MISSING';
        else migrationState = migrationRows[0].finished === true && migrationRows[0].rolled_back !== true
          ? 'APPLIED'
          : 'FAILED_OR_ROLLED_BACK';
      }
    }

    return {
      readOnly: true,
      migrationState,
      authSchema: catalog.auth_schema_present === true,
      outboxTable: catalog.mail_outbox_table_present === true,
      roleClass: String(catalog.effective_role_class),
      functionPresent: fn.function_present === true,
      ownerOk: fn.owner_ok === true,
      overloadCount: Number(fn.overload_count),
      schemaUsage: acl.schema_usage === true,
      functionExecute: acl.function_execute === true,
    };
  });

  stage = 'EVIDENCE';
  const fields = [
    yn(result.readOnly),
    result.migrationState,
    yn(result.authSchema),
    yn(result.outboxTable),
    yn(result.functionPresent),
    yn(result.ownerOk),
    String(result.overloadCount),
    yn(result.schemaUsage),
    yn(result.functionExecute),
    result.roleClass,
  ];
  const payload = fields.join('|');
  const safe = /^(YES|NO)\|(APPLIED|MISSING|FAILED_OR_ROLLED_BACK|TABLE_MISSING|UNREADABLE)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|[0-9]+\|(YES|NO)\|(YES|NO)\|(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)$/;
  if (!safe.test(payload)) {
    process.stdout.write('DB_FAILURE|EVIDENCE|SANITIZER_REJECTED|NA\n');
    process.exitCode = 72;
    return;
  }
  process.stdout.write(`DB_EVIDENCE|${payload}\n`);
}

run()
  .catch((error) => {
    const safeStage = allowedStages.has(stage) ? stage : 'CONNECT';
    const { kind, sqlstate } = classify(error);
    process.stdout.write(`DB_FAILURE|${safeStage}|${kind}|${sqlstate}\n`);
    process.exitCode = 71;
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch {}
  });
NODE
)"
  node_rc=$?
  set -e

  if (( node_rc != 0 )); then
    failure_line="$(grep '^DB_FAILURE|' <<< "$node_output" | tail -n1 || true)"
    if [[ "$failure_line" =~ ^DB_FAILURE\|(CONNECT|TX_READ_ONLY|TX_VERIFY|CATALOG_BASE|FUNCTION_META|ACL|MIGRATION_HISTORY|EVIDENCE)\|(READ_ONLY_NOT_ACTIVE|DB_UNREACHABLE|DB_ACCESS_DENIED|RAW_QUERY_FAILED|TRANSACTION_FAILED|PRISMA_INIT_FAILED|PRISMA_QUERY_FAILED|OTHER|SANITIZER_REJECTED)\|([0-9A-Z]{5}|NA)$ ]]; then
      IFS='|' read -r _ node_stage node_class node_sqlstate <<< "$failure_line"
      printf '%s\n' "$failure_line"
      REMOTE_STAGE="DB_${node_stage}"
    else
      printf 'DB_FAILURE|CONNECT|OTHER|NA\n'
      REMOTE_STAGE='DB_NODE_RUNTIME'
    fi
    exit "$node_rc"
  fi

  line="$(grep '^DB_EVIDENCE|' <<< "$node_output" | tail -n1 || true)"
  [[ "$line" =~ ^DB_EVIDENCE\|(YES|NO)\|(APPLIED|MISSING|FAILED_OR_ROLLED_BACK|TABLE_MISSING|UNREADABLE)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|[0-9]+\|(YES|NO)\|(YES|NO)\|(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)$ ]]
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
failure_marker="$(grep '^DB_FAILURE|' <<< "$output" | tail -n1 || true)"

if [[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; then
  IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$remote_marker"
else
  REMOTE_STAGE='NO_SAFE_REMOTE_MARKER'
  REMOTE_RC="$ssh_rc"
fi

if [[ "$failure_marker" =~ ^DB_FAILURE\|(CONNECT|TX_READ_ONLY|TX_VERIFY|CATALOG_BASE|FUNCTION_META|ACL|MIGRATION_HISTORY|EVIDENCE)\|(READ_ONLY_NOT_ACTIVE|DB_UNREACHABLE|DB_ACCESS_DENIED|RAW_QUERY_FAILED|TRANSACTION_FAILED|PRISMA_INIT_FAILED|PRISMA_QUERY_FAILED|OTHER|SANITIZER_REJECTED)\|([0-9A-Z]{5}|NA)$ ]]; then
  IFS='|' read -r _ DB_FAILURE_STAGE DB_FAILURE_CLASS DB_FAILURE_SQLSTATE <<< "$failure_marker"
fi

[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]] || {
  REMOTE_STAGE='MUTATION_ATTESTATION_MISSING'
  REMOTE_RC="$ssh_rc"
  publish_failure 91
}

if (( ssh_rc != 0 )); then
  publish_failure "$ssh_rc"
fi

LOCAL_STAGE='EVIDENCE_PARSE'
marker="$(grep '^DB_EVIDENCE|' <<< "$output" | tail -n1 || true)"
runtime_count="$(grep '^API_RUNTIME_COUNT|' <<< "$output" | tail -n1 || true)"
[[ "$marker" =~ ^DB_EVIDENCE\|(YES|NO)\|(APPLIED|MISSING|FAILED_OR_ROLLED_BACK|TABLE_MISSING|UNREADABLE)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|(YES|NO)\|[0-9]+\|(YES|NO)\|(YES|NO)\|(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)$ ]]
[[ "$runtime_count" =~ ^API_RUNTIME_COUNT\|[1-4]$ ]]
IFS='|' read -r _ read_only migration_state auth_schema outbox_table function_present owner_ok overload_count schema_usage function_execute role_class <<< "$marker"
IFS='|' read -r _ api_count <<< "$runtime_count"
[[ "$REMOTE_STAGE" == 'COMPLETE' && "$REMOTE_RC" == '0' ]]

schema_state='DRIFT'
if [[ "$migration_state" == 'UNREADABLE' ]]; then
  schema_state='MIGRATION_HISTORY_UNREADABLE'
elif [[ "$read_only" == 'YES' && "$migration_state" == 'APPLIED' && "$auth_schema" == 'YES' && "$outbox_table" == 'YES' && "$function_present" == 'YES' && "$owner_ok" == 'YES' && "$overload_count" == '1' && "$schema_usage" == 'YES' && "$function_execute" == 'YES' && "$role_class" != 'OTHER' ]]; then
  schema_state='CONSISTENT'
fi

guard_main
LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB read-only preflight v2

- diagnostic main: \`$SOURCE_SHA\`
- result: \`READ_ONLY_PREFLIGHT_COMPLETE\`
- transaction read-only verified: \`$read_only\`
- migration $MIGRATION_NAME: \`$migration_state\`
- auth schema present: \`$auth_schema\`
- auth.mail_outbox table present: \`$outbox_table\`
- exact function signature: \`$FUNCTION_SIG\`
- exact enqueue_mail_outbox function present: \`$function_present\`
- exact function owner match: \`$owner_ok\`
- enqueue_mail_outbox overload count: \`$overload_count\`
- effective runtime DB role: \`$role_class\`
- effective role auth schema USAGE: \`$schema_usage\`
- effective role enqueue EXECUTE: \`$function_execute\`
- migration/schema consistency: \`$schema_state\`
- active API runtimes checked: \`$api_count\`
- DB URL / credentials / raw query errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- production mutation: \`NONE\`" >/dev/null

result_published=1
LOCAL_STAGE='COMPLETE'
printf 'READ_ONLY_DB_PREFLIGHT_V2=PASS\nPRODUCTION_MUTATION=NONE\n'
