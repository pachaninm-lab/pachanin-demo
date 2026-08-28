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
  "$user@$host" "bash -s -- '$REGISTER_CORRELATION' '$DECISION_CORRELATION' '$DECISION_EVENT_KEY' '$APPROVED_EVENT_KEY'" <<'REMOTE'
set -euo pipefail
register_correlation="$1"
decision_correlation="$2"
decision_event_key="$3"
approved_event_key="$4"
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
[[ "$register_correlation" == 'p0-all-role-register:0069e8bdc741:33155036583-1:employee' ]]
[[ "$decision_correlation" == 'p0-all-role-employee-join:0069e8bdc741:33155036583-1' ]]

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"

docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - \
  "$register_correlation" "$decision_correlation" "$decision_event_key" "$approved_event_key" <<'NODE'
const { PrismaClient } = require('@prisma/client');
const [registerCorrelation, decisionCorrelation, decisionEventKey, approvedEventKey] = process.argv.slice(2);
const safeCode = (error) => String(error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN')
  .replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'UNKNOWN';

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
    const rows = await db.$queryRawUnsafe(`
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
  console.error(`EMPLOYEE_JOIN_STATE_DB_ERROR|${safeCode(error)}`);
  process.exitCode = 43;
});
NODE
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^EMPLOYEE_JOIN_STATE|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r tag classification application_status requested_role matching final_count approved_count correlation_count <<< "$marker"
[[ "$tag" == 'EMPLOYEE_JOIN_STATE' ]]
[[ "$classification" =~ ^[A-Z0-9_]{3,96}$ ]]
[[ "$application_status" =~ ^[A-Z0-9_]{3,64}$ ]]
[[ "$requested_role" =~ ^[A-Z0-9_]{3,48}$ ]]
for count in "$matching" "$final_count" "$approved_count" "$correlation_count"; do
  [[ "$count" =~ ^[0-9]+$ ]]
done

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 employee join persisted-state inspect

- exact main: \`$TARGET_SHA\`
- source run: \`$SOURCE_RUN\`
- source decision SHA: \`$SOURCE_SHA\`
- result: \`PASS\`
- safe classifier: \`$classification\`
- application status: \`$application_status\`
- requested role class: \`$requested_role\`
- matching decision events: \`$matching\`
- final idempotency event count: \`$final_count\`
- approved idempotency event count: \`$approved_count\`
- decision-correlation event count: \`$correlation_count\`
- raw identifiers or credentials published: \`0\`
- employee decision replay: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
