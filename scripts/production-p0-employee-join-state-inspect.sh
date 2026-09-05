#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER:?PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LEGACY_RELEASE_ISSUE_NUMBER='3072'
CONTINUATION_ISSUE_NUMBER='4637'
RELEASE_ISSUE_NUMBER="$PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER"
SOURCE_RUN='33155036583-1'
SOURCE_SHA='0069e8bdc741d0c955823b14ad629513570a7bb7'
REGISTER_CORRELATION='p0-all-role-register:0069e8bdc741:33155036583-1:employee'
DECISION_CORRELATION='p0-all-role-employee-join:0069e8bdc741:33155036583-1'
DECISION_EVENT_KEY='org-join-decision:p0-all-role-employee-join:0069e8bdc741d0c955823b14ad629513570a7bb7:33155036583-1'
APPROVED_EVENT_KEY='org-join-decision:p0-all-role-employee-join:0069e8bdc741d0c955823b14ad629513570a7bb7:33155036583-1:approved'
LOCK_PRIVILEGE_MIGRATION='20260826180000_p0_registration_decision_application_lock_privilege'

[[ "$RELEASE_ISSUE_NUMBER" == "$LEGACY_RELEASE_ISSUE_NUMBER" || "$RELEASE_ISSUE_NUMBER" == "$CONTINUATION_ISSUE_NUMBER" ]]

key_path="$RUNNER_TEMP/pc-p0-employee-state-key"
known_hosts="$RUNNER_TEMP/pc-p0-employee-state-known-hosts"
TARGET_SHA='unknown'
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 employee join persisted-state inspect

- exact main: \`$TARGET_SHA\`
- source run: \`$SOURCE_RUN\`
- result: \`FAIL\`
- safe classifier: \`EMPLOYEE_JOIN_STATE_INSPECT_FAILED_CLOSED\`
- raw identifiers or credentials published: \`0\`
- employee decision replay: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}

try_key() {
  local raw="$1" plain escaped decoded
  [[ -n "$raw" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
  printf '%s\n' "$raw" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

guard_main
mapfile -t domain_ips < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#domain_ips[@]} >= 1 ))
printf '%s\n' "${domain_ips[@]}" | grep -Fxq "$DEFAULT_HOST"
scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"
rm -f "$scan"
chmod 0600 "$known_hosts"

guard_main
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$user@$host" "bash -s -- '$REGISTER_CORRELATION' '$DECISION_CORRELATION' '$DECISION_EVENT_KEY' '$APPROVED_EVENT_KEY' '$LOCK_PRIVILEGE_MIGRATION'" <<'REMOTE'
set -euo pipefail
register_correlation="$1"
decision_correlation="$2"
decision_event_key="$3"
approved_event_key="$4"
lock_privilege_migration="$5"
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
[[ "$register_correlation" == 'p0-all-role-register:0069e8bdc741:33155036583-1:employee' ]]
[[ "$decision_correlation" == 'p0-all-role-employee-join:0069e8bdc741:33155036583-1' ]]
[[ "$lock_privilege_migration" == '20260826180000_p0_registration_decision_application_lock_privilege' ]]

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"

docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - \
  "$register_correlation" "$decision_correlation" "$decision_event_key" "$approved_event_key" "$lock_privilege_migration" <<'NODE'
const { PrismaClient } = require('@prisma/client');
const [registerCorrelation, decisionCorrelation, decisionEventKey, approvedEventKey, lockPrivilegeMigration] = process.argv.slice(2);

const safeCode = (error) => String(error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN')
  .replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'UNKNOWN';
const safeSqlState = (error) => {
  const meta = error && typeof error === 'object' && error.meta && typeof error.meta === 'object'
    ? error.meta
    : null;
  const value = meta && 'code' in meta ? String(meta.code || '').toUpperCase() : '';
  return /^[0-9A-Z]{5}$/.test(value) ? value : 'UNKNOWN';
};
const bit = (value) => value === true ? '1' : value === false ? '0' : 'U';

(async () => {
  const db = new PrismaClient();
  try {
    const principals = await db.$queryRawUnsafe(`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `);
    if (!principals[0] || principals[0].rolsuper || principals[0].rolbypassrls) {
      console.error('EMPLOYEE_JOIN_STATE_PRINCIPAL_NOT_CONFINED');
      process.exitCode = 41;
      return;
    }

    let caps;
    try {
      const rows = await db.$queryRawUnsafe(`
        SELECT
          has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_schema_usage,
          to_regclass('auth.registration_applications') IS NOT NULL AS application_relation_exists,
          to_regclass('auth.registration_application_events') IS NOT NULL AS event_relation_exists,
          to_regprocedure('auth.lock_registration_decision_application(text,text,text,text,text,text,text)') IS NOT NULL AS lock_function_exists,
          EXISTS (
            SELECT 1 FROM pg_catalog.pg_roles
            WHERE rolname = 'pc_registration_decision_authority'
          ) AS decision_authority_exists,
          CASE WHEN to_regclass('auth.registration_applications') IS NULL THEN false
            ELSE has_table_privilege(current_user, 'auth.registration_applications', 'SELECT') END AS api_application_select,
          CASE WHEN to_regclass('auth.registration_applications') IS NULL THEN false
            ELSE has_table_privilege(current_user, 'auth.registration_applications', 'UPDATE') END AS api_application_update,
          CASE WHEN to_regclass('auth.registration_application_events') IS NULL THEN false
            ELSE has_table_privilege(current_user, 'auth.registration_application_events', 'SELECT') END AS api_event_select,
          CASE WHEN to_regclass('auth.registration_application_events') IS NULL THEN false
            ELSE has_table_privilege(current_user, 'auth.registration_application_events', 'INSERT') END AS api_event_insert,
          CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_registration_decision_authority'
            ) OR to_regclass('auth.registration_applications') IS NULL THEN false
            ELSE has_table_privilege(
              'pc_registration_decision_authority', 'auth.registration_applications', 'SELECT'
            ) END AS authority_application_select,
          CASE WHEN NOT EXISTS (
              SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_registration_decision_authority'
            ) OR to_regclass('auth.registration_applications') IS NULL THEN false
            ELSE has_column_privilege(
              'pc_registration_decision_authority', 'auth.registration_applications', 'id', 'UPDATE'
            ) END AS authority_application_id_update,
          to_regclass('public._prisma_migrations') IS NOT NULL AS migration_relation_exists,
          CASE WHEN to_regclass('public._prisma_migrations') IS NULL THEN false
            ELSE has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') END AS migration_ledger_readable
      `);
      caps = rows[0];
    } catch (error) {
      console.log(`EMPLOYEE_JOIN_DB_ERROR|${safeCode(error)}|${safeSqlState(error)}|CAPABILITY_QUERY`);
      console.log('EMPLOYEE_JOIN_STATE|EMPLOYEE_JOIN_CAPABILITY_QUERY_FAILED|UNKNOWN|UNKNOWN|0|0|0|0');
      console.log('EMPLOYEE_JOIN_DB_CAPS|U|U|U|U|U|U|U|U|U|U|U|U|U|U');
      return;
    }

    const capValues = [
      caps.auth_schema_usage,
      caps.application_relation_exists,
      caps.event_relation_exists,
      caps.lock_function_exists,
      caps.decision_authority_exists,
      caps.api_application_select,
      caps.api_application_update,
      caps.api_event_select,
      caps.api_event_insert,
      caps.authority_application_select,
      caps.authority_application_id_update,
      caps.migration_relation_exists,
      caps.migration_ledger_readable,
    ];
    console.log(`EMPLOYEE_JOIN_DB_CAPS|${capValues.map(bit).join('|')}`);

    let migrationState = 'UNKNOWN';
    if (caps.migration_relation_exists === true && caps.migration_ledger_readable === true) {
      try {
        const migrationRows = await db.$queryRawUnsafe(`
          SELECT EXISTS (
            SELECT 1
            FROM public._prisma_migrations
            WHERE migration_name = $1
              AND finished_at IS NOT NULL
              AND rolled_back_at IS NULL
          ) AS applied
        `, lockPrivilegeMigration);
        migrationState = migrationRows[0]?.applied === true ? 'APPLIED' : 'NOT_APPLIED';
      } catch (error) {
        console.log(`EMPLOYEE_JOIN_DB_ERROR|${safeCode(error)}|${safeSqlState(error)}|MIGRATION_LEDGER_QUERY`);
      }
    }
    console.log(`EMPLOYEE_JOIN_MIGRATION|${migrationState}`);

    let rows;
    try {
      rows = await db.$queryRawUnsafe(`
        SELECT
          application.kind,
          application.status,
          application.requested_role,
          application.decided_at IS NOT NULL AS decided,
          COUNT(event.id)::integer AS matching_decision_events,
          COUNT(event.id) FILTER (WHERE event.idempotency_key = $2)::integer AS final_event_count,
          COUNT(event.id) FILTER (WHERE event.idempotency_key = $3)::integer AS approved_event_count,
          COUNT(event.id) FILTER (WHERE event.correlation_id = $4)::integer AS correlation_event_count
        FROM auth.registration_applications application
        LEFT JOIN auth.registration_application_events event
          ON event.application_id = application.id
         AND (
           event.idempotency_key IN ($2, $3)
           OR event.correlation_id = $4
         )
        WHERE application.correlation_id = $1
        GROUP BY application.id, application.kind, application.status,
                 application.requested_role, application.decided_at
      `, registerCorrelation, decisionEventKey, approvedEventKey, decisionCorrelation);
    } catch (error) {
      console.log(`EMPLOYEE_JOIN_DB_ERROR|${safeCode(error)}|${safeSqlState(error)}|STATE_QUERY`);
      console.log('EMPLOYEE_JOIN_STATE|EMPLOYEE_JOIN_STATE_QUERY_FAILED|UNKNOWN|UNKNOWN|0|0|0|0');
      return;
    }

    if (rows.length !== 1) {
      console.log(`EMPLOYEE_JOIN_STATE|APPLICATION_CARDINALITY_${rows.length}|UNKNOWN|UNKNOWN|0|0|0|0`);
      return;
    }
    const row = rows[0];
    const matching = Number(row.matching_decision_events || 0);
    const finalCount = Number(row.final_event_count || 0);
    const approvedCount = Number(row.approved_event_count || 0);
    const correlationCount = Number(row.correlation_event_count || 0);
    if ([matching, finalCount, approvedCount, correlationCount].some((n) => !Number.isInteger(n) || n < 0 || n > 4)) {
      console.error('EMPLOYEE_JOIN_STATE_INVALID_COUNTS');
      process.exitCode = 42;
      return;
    }
    let classification = 'EMPLOYEE_JOIN_STATE_OTHER';
    if (row.kind !== 'JOIN_EXISTING_ORGANIZATION') classification = 'EMPLOYEE_JOIN_KIND_MISMATCH';
    else if (row.status === 'ACTIVATED' && row.decided === true && finalCount === 1 && approvedCount === 1 && correlationCount >= 2) {
      classification = 'EMPLOYEE_JOIN_DECISION_COMMITTED';
    } else if (
      ['ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED'].includes(row.status)
      && row.decided === false && finalCount === 0 && approvedCount === 0 && correlationCount === 0
    ) {
      classification = 'EMPLOYEE_JOIN_DECISION_NOT_COMMITTED';
    } else if (finalCount !== approvedCount || (finalCount + approvedCount > 0 && row.status !== 'ACTIVATED')) {
      classification = 'EMPLOYEE_JOIN_PERSISTED_STATE_INCONSISTENT';
    }
    const roleClass = typeof row.requested_role === 'string' && /^[A-Z_]{2,48}$/.test(row.requested_role)
      ? row.requested_role
      : 'UNKNOWN';
    const statusClass = typeof row.status === 'string' && /^[A-Z_]{2,64}$/.test(row.status)
      ? row.status
      : 'UNKNOWN';
    console.log(`EMPLOYEE_JOIN_STATE|${classification}|${statusClass}|${roleClass}|${matching}|${finalCount}|${approvedCount}|${correlationCount}`);
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(`EMPLOYEE_JOIN_STATE_DB_FATAL|${safeCode(error)}|${safeSqlState(error)}`);
  process.exitCode = 43;
});
NODE
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^EMPLOYEE_JOIN_STATE|' <<< "$output" | tail -n1)"
caps_marker="$(grep '^EMPLOYEE_JOIN_DB_CAPS|' <<< "$output" | tail -n1)"
migration_marker="$(grep '^EMPLOYEE_JOIN_MIGRATION|' <<< "$output" | tail -n1)"
db_error_marker="$(grep '^EMPLOYEE_JOIN_DB_ERROR|' <<< "$output" | tail -n1 || true)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
[[ "$caps_marker" =~ ^EMPLOYEE_JOIN_DB_CAPS\|[01U](\|[01U]){12}$ ]]
[[ "$migration_marker" =~ ^EMPLOYEE_JOIN_MIGRATION\|(APPLIED|NOT_APPLIED|UNKNOWN)$ ]]
IFS='|' read -r tag classification application_status requested_role matching final_count approved_count correlation_count <<< "$marker"
[[ "$tag" == 'EMPLOYEE_JOIN_STATE' ]]
[[ "$classification" =~ ^[A-Z0-9_]{3,96}$ ]]
[[ "$application_status" =~ ^[A-Z0-9_]{3,64}$ ]]
[[ "$requested_role" =~ ^[A-Z0-9_]{3,48}$ ]]
for count in "$matching" "$final_count" "$approved_count" "$correlation_count"; do
  [[ "$count" =~ ^[0-9]+$ ]]
done
IFS='|' read -r _ auth_usage app_rel event_rel lock_fn authority_role api_app_select api_app_update api_event_select api_event_insert authority_app_select authority_id_update migration_rel migration_readable <<< "$caps_marker"
IFS='|' read -r _ migration_state <<< "$migration_marker"
prisma_code='NONE'; sqlstate='NONE'; error_stage='NONE'
if [[ -n "$db_error_marker" ]]; then
  IFS='|' read -r _ prisma_code sqlstate error_stage <<< "$db_error_marker"
  [[ "$prisma_code" =~ ^[A-Z0-9_-]{1,32}$ ]]
  [[ "$sqlstate" == 'UNKNOWN' || "$sqlstate" =~ ^[0-9A-Z]{5}$ ]]
  [[ "$error_stage" =~ ^[A-Z0-9_]{3,64}$ ]]
fi

lock_effect='MISSING_OR_INCOMPLETE'
if [[ "$lock_fn" == '1' && "$authority_role" == '1' && "$authority_app_select" == '1' && "$authority_id_update" == '1' ]]; then
  lock_effect='PRESENT'
fi

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 employee join persisted-state inspect

- exact main: \`$TARGET_SHA\`
- source run: \`$SOURCE_RUN\`
- source decision SHA: \`$SOURCE_SHA\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- safe classifier: \`$classification\`
- application status: \`$application_status\`
- requested role class: \`$requested_role\`
- Prisma class / SQLSTATE / failing read stage: \`$prisma_code / $sqlstate / $error_stage\`
- auth schema usage: \`$auth_usage\`
- application/event relations present: \`$app_rel/$event_rel\`
- API application SELECT/UPDATE: \`$api_app_select/$api_app_update\`
- API event SELECT/INSERT: \`$api_event_select/$api_event_insert\`
- decision authority role / lock function: \`$authority_role/$lock_fn\`
- decision authority application SELECT/id-UPDATE: \`$authority_app_select/$authority_id_update\`
- lock privilege migration ledger: \`$migration_state\` (ledger relation/readable: \`$migration_rel/$migration_readable\`)
- row-lock privilege effect: \`$lock_effect\`
- matching decision events: \`$matching\`
- final idempotency event count: \`$final_count\`
- approved idempotency event count: \`$approved_count\`
- decision-correlation event count: \`$correlation_count\`
- raw identifiers or credentials published: \`0\`
- employee decision replay: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
