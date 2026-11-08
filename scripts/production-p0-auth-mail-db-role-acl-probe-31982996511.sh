#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_DB_ROLE_ACL_PROBE_COMMAND:?PC_AUTH_MAIL_DB_ROLE_ACL_PROBE_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-db-role-acl-probe 31982996511 current-main'
FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-db-role-acl-probe-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-db-role-acl-probe-known-hosts"
scan=''
match=''
result_published=0
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
ROLE_CLASS='UNKNOWN'
SESSION_ROLE_CLASS='UNKNOWN'
AUTH_SCHEMA_USAGE='UNKNOWN'
FUNCTION_EXECUTE='UNKNOWN'
PROBE_FAILURE_STAGE='NONE'
PROBE_FAILURE_CLASS='NONE'
PROBE_FAILURE_SQLSTATE='NA'

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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB role/ACL probe

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- effective DB role class: \`$ROLE_CLASS\`
- session DB role class: \`$SESSION_ROLE_CLASS\`
- auth schema USAGE: \`$AUTH_SCHEMA_USAGE\`
- enqueue function EXECUTE: \`$FUNCTION_EXECUTE\`
- probe failure stage: \`$PROBE_FAILURE_STAGE\`
- probe failure class: \`$PROBE_FAILURE_CLASS\`
- probe SQLSTATE class: \`$PROBE_FAILURE_SQLSTATE\`
- raw DB role / DB URL / credentials / query errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
    result_published=1
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
[[ "$PC_AUTH_MAIL_DB_ROLE_ACL_PROBE_COMMAND" == "$COMMAND" ]]
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

LOCAL_STAGE='REMOTE_DB_ROLE_ACL'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$FUNCTION_SIG'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
function_sig="$1"
REMOTE_STAGE='BOOTSTRAP'

remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$function_sig" == 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)' ]]
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='API_INVENTORY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))

evidence=''
for id in "${api_ids[@]}"; do
  REMOTE_STAGE='PRISMA_CLIENT'
  docker exec "$id" node -e "require.resolve('@prisma/client')" >/dev/null 2>&1

  REMOTE_STAGE='DB_ROLE_ACL_NODE'
  if node_output="$(docker exec -i "$id" node - 2>/dev/null <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
let stage = 'CONNECT';
let roleClass = 'UNKNOWN';
let sessionRoleClass = 'UNKNOWN';

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

    stage = 'ROLE_CLASS';
    const roleRows = await tx.$queryRawUnsafe(`
      SELECT
        CASE current_user
          WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'
          WHEN 'one_deal_auth' THEN 'ONE_DEAL_AUTH'
          WHEN 'app_auth' THEN 'APP_AUTH'
          WHEN 'app_service' THEN 'APP_SERVICE'
          WHEN 'pc_app' THEN 'PC_APP'
          ELSE 'OTHER'
        END AS effective_role_class,
        CASE session_user
          WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'
          WHEN 'one_deal_auth' THEN 'ONE_DEAL_AUTH'
          WHEN 'app_auth' THEN 'APP_AUTH'
          WHEN 'app_service' THEN 'APP_SERVICE'
          WHEN 'pc_app' THEN 'PC_APP'
          ELSE 'OTHER'
        END AS session_role_class
    `);
    if (!Array.isArray(roleRows) || roleRows.length !== 1) throw new Error('role class shape');
    roleClass = String(roleRows[0].effective_role_class || 'OTHER');
    sessionRoleClass = String(roleRows[0].session_role_class || 'OTHER');

    stage = 'SCHEMA_USAGE';
    const schemaRows = await tx.$queryRawUnsafe(`
      SELECT pg_catalog.has_schema_privilege(current_user, 'auth', 'USAGE') AS schema_usage
    `);
    if (!Array.isArray(schemaRows) || schemaRows.length !== 1 || typeof schemaRows[0].schema_usage !== 'boolean') {
      throw new Error('schema privilege shape');
    }
    const schemaUsage = schemaRows[0].schema_usage === true;

    let functionExecute = 'NOT_TESTED';
    if (schemaUsage) {
      stage = 'FUNCTION_EXECUTE';
      const functionRows = await tx.$queryRawUnsafe(`
        SELECT pg_catalog.has_function_privilege(
          current_user,
          'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)',
          'EXECUTE'
        ) AS function_execute
      `);
      if (!Array.isArray(functionRows) || functionRows.length !== 1 || typeof functionRows[0].function_execute !== 'boolean') {
        throw new Error('function privilege shape');
      }
      functionExecute = functionRows[0].function_execute === true ? 'YES' : 'NO';
    }

    stage = 'EVIDENCE';
    return {
      roleClass,
      sessionRoleClass,
      schemaUsage: schemaUsage ? 'YES' : 'NO',
      functionExecute,
    };
  }, { maxWait: 5000, timeout: 15000 });

  process.stdout.write(`ROLE_ACL|${result.roleClass}|${result.sessionRoleClass}|${result.schemaUsage}|${result.functionExecute}\n`);
}

run().catch((error) => {
  const classified = classify(error);
  process.stdout.write(`PROBE_ERROR|${stage}|${classified.kind}|${classified.sqlstate}|${roleClass}|${sessionRoleClass}\n`);
  process.exitCode = 2;
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
});
NODE
)"; then
    node_rc=0
  else
    node_rc=$?
  fi

  role_marker="$(printf '%s\n' "$node_output" | grep '^ROLE_ACL|' | tail -n 1 || true)"
  error_marker="$(printf '%s\n' "$node_output" | grep '^PROBE_ERROR|' | tail -n 1 || true)"

  if [[ "$node_rc" == 0 && -n "$role_marker" && -z "$error_marker" ]]; then
    candidate="$role_marker"
  elif [[ "$node_rc" == 2 && -z "$role_marker" && -n "$error_marker" ]]; then
    candidate="$error_marker"
  else
    REMOTE_STAGE='UNCLASSIFIED_NODE_RESULT'
    exit 72
  fi

  if [[ -z "$evidence" ]]; then
    evidence="$candidate"
  else
    [[ "$candidate" == "$evidence" ]] || {
      REMOTE_STAGE='API_DB_ROLE_DRIFT'
      exit 73
    }
  fi
done

REMOTE_STAGE='EVIDENCE'
printf 'PROBE_EVIDENCE|%s\n' "$evidence"
REMOTE
)"; then
  REMOTE_RC=0
else
  REMOTE_RC=$?
fi

remote_marker="$(printf '%s\n' "$output" | grep '^REMOTE_STAGE|' | tail -n 1 || true)"
mutation_marker="$(printf '%s\n' "$output" | grep '^PRODUCTION_MUTATION=' | tail -n 1 || true)"
evidence_marker="$(printf '%s\n' "$output" | grep '^PROBE_EVIDENCE|' | tail -n 1 || true)"
[[ "$mutation_marker" == 'PRODUCTION_MUTATION=NONE' ]]
if [[ -n "$remote_marker" ]]; then
  IFS='|' read -r _ REMOTE_STAGE remote_reported_rc <<< "$remote_marker"
  [[ "$remote_reported_rc" =~ ^[0-9]+$ ]]
fi
[[ "$REMOTE_RC" == 0 && "$REMOTE_STAGE" == 'EVIDENCE' && -n "$evidence_marker" ]]

payload="${evidence_marker#PROBE_EVIDENCE|}"
if [[ "$payload" == ROLE_ACL\|* ]]; then
  IFS='|' read -r marker ROLE_CLASS SESSION_ROLE_CLASS AUTH_SCHEMA_USAGE FUNCTION_EXECUTE <<< "$payload"
  [[ "$marker" == 'ROLE_ACL' ]]
  [[ "$ROLE_CLASS" =~ ^(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)$ ]]
  [[ "$SESSION_ROLE_CLASS" =~ ^(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)$ ]]
  [[ "$AUTH_SCHEMA_USAGE" =~ ^(YES|NO)$ ]]
  [[ "$FUNCTION_EXECUTE" =~ ^(YES|NO|NOT_TESTED)$ ]]
  PROBE_FAILURE_STAGE='NONE'
  PROBE_FAILURE_CLASS='NONE'
  PROBE_FAILURE_SQLSTATE='NA'
elif [[ "$payload" == PROBE_ERROR\|* ]]; then
  IFS='|' read -r marker PROBE_FAILURE_STAGE PROBE_FAILURE_CLASS PROBE_FAILURE_SQLSTATE ROLE_CLASS SESSION_ROLE_CLASS <<< "$payload"
  [[ "$marker" == 'PROBE_ERROR' ]]
  [[ "$PROBE_FAILURE_STAGE" =~ ^(CONNECT|TX_READ_ONLY|TX_VERIFY|ROLE_CLASS|SCHEMA_USAGE|FUNCTION_EXECUTE|EVIDENCE)$ ]]
  [[ "$PROBE_FAILURE_CLASS" =~ ^(READ_ONLY_NOT_ACTIVE|DB_UNREACHABLE|DB_ACCESS_DENIED|RAW_QUERY_FAILED|TRANSACTION_FAILED|PRISMA_INIT_FAILED|PRISMA_QUERY_FAILED|OTHER)$ ]]
  [[ "$PROBE_FAILURE_SQLSTATE" == 'NA' || "$PROBE_FAILURE_SQLSTATE" =~ ^[0-9A-Z]{5}$ ]]
  [[ "$ROLE_CLASS" =~ ^(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER|UNKNOWN)$ ]]
  [[ "$SESSION_ROLE_CLASS" =~ ^(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER|UNKNOWN)$ ]]
  AUTH_SCHEMA_USAGE='UNKNOWN'
  FUNCTION_EXECUTE='UNKNOWN'
else
  exit 74
fi

LOCAL_STAGE='POST_PROBE_MAIN'
guard_main

LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB role/ACL probe

- diagnostic main: \`$SOURCE_SHA\`
- result: \`READ_ONLY_ROLE_ACL_CLASSIFIED\`
- effective DB role class: \`$ROLE_CLASS\`
- session DB role class: \`$SESSION_ROLE_CLASS\`
- auth schema USAGE: \`$AUTH_SCHEMA_USAGE\`
- enqueue function EXECUTE: \`$FUNCTION_EXECUTE\`
- probe failure stage: \`$PROBE_FAILURE_STAGE\`
- probe failure class: \`$PROBE_FAILURE_CLASS\`
- probe SQLSTATE class: \`$PROBE_FAILURE_SQLSTATE\`
- raw DB role / DB URL / credentials / query errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
printf 'ROLE_ACL_PROBE=CLASSIFIED\n'
printf 'PRODUCTION_MUTATION=NONE\n'
