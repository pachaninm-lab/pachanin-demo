#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-owner-login-denial-diagnose current-main'
RUNTIME_BASE_SHA='ee1fbecac8ae301102e451b78351a0e51ebe2060'
ATTEMPT_SINCE='2026-08-22T18:04:00Z'
ATTEMPT_UNTIL='2026-08-22T18:08:59Z'

key_path="$RUNNER_TEMP/pc-p0-owner-login-denial-key"
known_hosts="$RUNNER_TEMP/pc-p0-owner-login-denial-known-hosts"
TARGET_SHA='unknown'
stage='INITIAL'
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  [[ -z "$(git status --porcelain=v1)" ]]
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 owner login-denial diagnostic

- command: \`$COMMAND\`
- exact diagnostic main: \`$TARGET_SHA\`
- inspected runtime base: \`$RUNTIME_BASE_SHA\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- owner identity / email / account hash exposure: \`NONE\`
- password / TOTP / cookie / token exposure: \`NONE\`
- raw Docker / database / log output: \`NOT_PUBLISHED\`
- login / reset / recovery replay: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}

trap cleanup EXIT
trap publish_failure ERR

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
git merge-base --is-ancestor "$RUNTIME_BASE_SHA" "$TARGET_SHA"
[[ -z "$(git status --porcelain=v1)" ]]

mapfile -t runtime_delta < <(git diff --name-only "$RUNTIME_BASE_SHA" "$TARGET_SHA" | sort)
allowed_runtime_delta=(
  '.github/workflows/production-p0-owner-login-denial-diagnostic.yml'
  'apps/web/tests/e2e/platform-v7-public-intelligence-layer.spec.ts'
  'apps/web/tests/e2e/support/acceptance-login.ts'
  'docs/platform-v7/autopilot/scopes/design-v8-acceptance-csrf-faq-4503.json'
  'docs/platform-v7/autopilot/scopes/production-p0-owner-login-denial-diagnostic-3785.json'
  'scripts/check-production-p0-owner-login-denial-diagnostic.mjs'
  'scripts/production-p0-owner-login-denial-diagnostic.sh'
)
mapfile -t allowed_runtime_delta < <(printf '%s\n' "${allowed_runtime_delta[@]}" | sort)
[[ "${runtime_delta[*]}" == "${allowed_runtime_delta[*]}" ]]
stage='MAIN_AND_RUNTIME_NEUTRAL_DELTA_CONFIRMED'

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"

[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null \
    || { rm -f "$public_key"; return 1; }
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

try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

scan="$(mktemp)"
match="$(mktemp)"
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
ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
ssh "${ssh_opts[@]}" "$user@$host" \
  'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null
stage='SSH_CONFIRMED'

output="$(ssh "${ssh_opts[@]}" "$user@$host" \
  "bash -s -- '$RUNTIME_BASE_SHA' '$ATTEMPT_SINCE' '$ATTEMPT_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
runtime_base="$1"
attempt_since="$2"
attempt_until="$3"
[[ "$runtime_base" =~ ^[0-9a-f]{40}$ ]]
[[ "$attempt_since" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]
[[ "$attempt_until" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v python3 >/dev/null 2>&1

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"

api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" == "$runtime_base" && "$web_revision" == "$runtime_base" ]]
api_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$api_id")"
web_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id")"
[[ "$api_state" =~ ^(healthy|running)$ && "$web_state" =~ ^(healthy|running)$ ]]

read -r -d '' log_classifier <<'PY_LOG' || true
import json
import sys

counts = {'csrf': 0, 'credentials': 0, 'rate_limited': 0}
latest = 'NONE'
invalid = 0
for line in sys.stdin:
    marker_at = line.find('control_plane_login_denied')
    if marker_at < 0:
        continue
    start = line.find('{', marker_at)
    if start < 0:
        invalid += 1
        continue
    try:
        payload = json.loads(line[start:])
    except json.JSONDecodeError:
        invalid += 1
        continue
    reason = str(payload.get('reason', ''))
    if reason not in counts:
        invalid += 1
        continue
    counts[reason] += 1
    latest = reason.upper()

total = sum(counts.values())
if invalid or total > 9:
    raise SystemExit(41)
print(
    'OWNER_LOGIN_WEB|PASS|'
    + '|'.join(str(value) for value in (
        total, counts['csrf'], counts['credentials'], counts['rate_limited'],
    ))
    + f'|{latest}'
)
PY_LOG

web_marker="$(docker logs --since "$attempt_since" --until "$attempt_until" --timestamps "$web_id" 2>&1 \
  | python3 -c "$log_classifier")"
[[ "$web_marker" =~ ^OWNER_LOGIN_WEB\|PASS\|[0-9]\|[0-9]\|[0-9]\|[0-9]\|(NONE|CSRF|CREDENTIALS|RATE_LIMITED)$ ]]

docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$attempt_since" "$attempt_until" <<'NODE'
const { PrismaClient } = require('@prisma/client');
const [attemptSince, attemptUntil] = process.argv.slice(2);
const fail = (code) => { throw new Error(code); };
const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
if (!iso.test(attemptSince) || !iso.test(attemptUntil) || attemptSince >= attemptUntil) {
  fail('ATTEMPT_WINDOW_INVALID');
}

const readOnlyUrl = (raw, missingCode, invalidCode) => {
  const value = String(raw || '').trim();
  if (!value) fail(missingCode);
  try {
    const url = new URL(value);
    const existing = url.searchParams.get('options');
    url.searchParams.set('options', `${existing ? `${existing} ` : ''}-c default_transaction_read_only=on`);
    return url.toString();
  } catch {
    fail(invalidCode);
  }
};

const authUrl = readOnlyUrl(process.env.AUTH_DATABASE_URL, 'AUTH_DATABASE_URL_MISSING', 'AUTH_DATABASE_URL_INVALID');
const staffUrl = readOnlyUrl(process.env.STAFF_DATABASE_URL, 'STAFF_DATABASE_URL_MISSING', 'STAFF_DATABASE_URL_INVALID');
if (String(process.env.AUTH_DATABASE_URL || '').trim() === String(process.env.DATABASE_URL || '').trim()) {
  fail('AUTH_DATABASE_URL_NOT_ISOLATED');
}
const auth = new PrismaClient({ datasources: { db: { url: authUrl } } });
const staff = new PrismaClient({ datasources: { db: { url: staffUrl } } });
const safeInt = (value, maximum = 99) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) fail('AGGREGATE_INVALID');
  return parsed;
};

(async () => {
  const readinessRows = await staff.$transaction(async (tx) => {
    const principalRows = await tx.$queryRawUnsafe(`
      SELECT current_user = 'pc_staff_runtime' AS runtime_ok,
             current_setting('transaction_read_only') = 'on' AS read_only,
             NOT rolsuper AS no_super,
             NOT rolbypassrls AS no_bypass,
             coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_preflight()'), 'EXECUTE'), false) AS preflight_execute,
             coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_login_readiness()'), 'EXECUTE'), false) AS readiness_execute
      FROM pg_roles WHERE rolname = current_user
    `);
    const principal = principalRows[0];
    if (!principal || !Object.values(principal).every((value) => value === true)) fail('STAFF_PRINCIPAL_BOUNDARY');
    return tx.$queryRawUnsafe(`
      SELECT preflight.active_owner_count,
             preflight.usable_reviewer_count,
             readiness.assignment_ready_count,
             readiness.active_identity_ready_count,
             readiness.membership_ready_count,
             readiness.password_ready_count,
             readiness.mfa_enrolled_ready_count,
             readiness.login_ready_count
      FROM auth.staff_reviewer_preflight() preflight
      CROSS JOIN auth.staff_reviewer_login_readiness() readiness
    `);
  }, { isolationLevel: 'Serializable' });
  if (readinessRows.length !== 1) fail('REVIEWER_CARDINALITY');
  const ready = readinessRows[0];
  const counts = [
    ready.active_owner_count, ready.usable_reviewer_count, ready.assignment_ready_count,
    ready.active_identity_ready_count, ready.membership_ready_count, ready.password_ready_count,
    ready.mfa_enrolled_ready_count, ready.login_ready_count,
  ].map((value) => safeInt(value, 9));
  if (counts.join('|') !== '1|1|1|1|1|1|0|0') fail('REVIEWER_READINESS_CHANGED');

  const evidence = await auth.$transaction(async (tx) => {
    const principalRows = await tx.$queryRawUnsafe(`
      SELECT current_setting('transaction_read_only') = 'on' AS read_only,
             NOT rolsuper AS no_super,
             NOT rolbypassrls AS no_bypass,
             NOT rolinherit AS no_inherit,
             has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_usage,
             has_table_privilege(current_user, 'auth.sessions', 'SELECT') AS sessions_select,
             has_table_privilege(current_user, 'auth.login_throttles', 'SELECT') AS throttles_select,
             has_table_privilege(current_user, 'auth.audit_events', 'SELECT') AS audit_select
      FROM pg_roles WHERE rolname = current_user
    `);
    const principal = principalRows[0];
    if (!principal || !Object.values(principal).every((value) => value === true)) fail('AUTH_PRINCIPAL_BOUNDARY');

    const subjects = await tx.$queryRawUnsafe(`
      SELECT DISTINCT user_id
      FROM auth.sessions
      WHERE membership_id = 'membership_pc_reviewer_internal_v1'
        AND organization_id = 'org_pc_internal_platform_v1'
      LIMIT 2
    `);
    if (subjects.length !== 1) fail('OWNER_SUBJECT_CARDINALITY');
    const userId = String(subjects[0]?.user_id || '');
    if (!userId) fail('OWNER_SUBJECT_INVALID');

    const auditRows = await tx.$queryRawUnsafe(`
      SELECT reason, outcome,
             CASE
               WHEN metadata->>'accountHash' ~ '^[a-f0-9]{64}$'
               THEN metadata->>'accountHash'
               ELSE NULL
             END AS account_hash
      FROM auth.audit_events
      WHERE user_id = $1
        AND action = 'auth.login'
        AND created_at >= $2::timestamptz
        AND created_at <= $3::timestamptz
      ORDER BY created_at ASC
      LIMIT 10
    `, userId, attemptSince, attemptUntil);
    if (auditRows.length > 9) fail('AUDIT_WINDOW_TOO_WIDE');
    const allowed = new Set([
      'INVALID_CREDENTIALS', 'ACCOUNT_TEMPORARILY_LOCKED',
      'CREDENTIAL_CHANGED_DURING_LOGIN', 'NO_ACTIVE_MEMBERSHIP',
      'USER_NOT_ACTIVE', 'MEMBERSHIP_NOT_ACTIVE', 'ORGANIZATION_NOT_VERIFIED',
    ]);
    let invalid = 0;
    let locked = 0;
    let other = 0;
    let latest = 'NONE';
    let accountHash = null;
    const denialRows = auditRows.filter((row) => {
      const outcome = String(row.outcome || '').toUpperCase();
      return outcome === 'FAILURE' || outcome === 'DENIED';
    });
    for (const row of denialRows) {
      const reason = String(row.reason || 'UNKNOWN').toUpperCase();
      latest = allowed.has(reason) ? reason : 'OTHER';
      if (typeof row.account_hash === 'string') accountHash = row.account_hash;
      if (reason === 'INVALID_CREDENTIALS') invalid += 1;
      else if (reason === 'ACCOUNT_TEMPORARILY_LOCKED') locked += 1;
      else other += 1;
    }

    if (!accountHash) {
      const bindingRows = await tx.$queryRawUnsafe(`
        SELECT metadata->>'accountHash' AS account_hash
        FROM auth.audit_events
        WHERE user_id = $1
          AND action = 'auth.login'
          AND metadata->>'accountHash' ~ '^[a-f0-9]{64}$'
        ORDER BY created_at DESC
        LIMIT 1
      `, userId);
      if (bindingRows.length === 1) accountHash = String(bindingRows[0].account_hash || '');
    }

    let throttleState = 'UNAVAILABLE';
    let failures = 0;
    if (accountHash) {
      if (!/^[a-f0-9]{64}$/.test(accountHash)) fail('ACCOUNT_HASH_INVALID');
      const throttleRows = await tx.$queryRawUnsafe(`
        SELECT failures,
               locked_until IS NOT NULL AS has_lock,
               locked_until > now() AS active_lock
        FROM auth.login_throttles
        WHERE account_hash = $1
      `, accountHash);
      if (throttleRows.length > 1) fail('THROTTLE_CARDINALITY');
      const throttle = throttleRows[0] || { failures: 0, has_lock: false, active_lock: false };
      failures = safeInt(throttle.failures, 5);
      throttleState = 'CLEAR';
      if (throttle.active_lock === true) throttleState = 'LOCKED';
      else if (failures > 0) throttleState = 'PARTIAL';
      else if (throttle.has_lock === true) throttleState = 'EXPIRED';
    }
    return { total: denialRows.length, invalid, locked, other, latest, throttleState, failures };
  }, { isolationLevel: 'Serializable' });

  process.stdout.write([
    'OWNER_LOGIN_DB', 'PASS', evidence.total, evidence.invalid, evidence.locked,
    evidence.other, evidence.latest, evidence.throttleState, evidence.failures,
  ].join('|') + '\n');
})().catch((error) => {
  const code = String(error?.message || 'UNKNOWN').replace(/[^A-Z0-9_-]/gi, '').toUpperCase().slice(0, 64) || 'UNKNOWN';
  process.stdout.write(`OWNER_LOGIN_DB|FAIL_${code}\n`);
  process.exitCode = 51;
}).finally(async () => {
  await Promise.allSettled([auth.$disconnect(), staff.$disconnect()]);
});
NODE

printf 'OWNER_LOGIN_REVISION|%s\n' "$runtime_base"
printf '%s\n' "$web_marker"
printf '%s\n' 'PRODUCTION_MUTATION=NONE'
REMOTE
)"

stage='RESULT_VALIDATION'
revision_marker="$(grep '^OWNER_LOGIN_REVISION|' <<< "$output" | tail -n1)"
web_marker="$(grep '^OWNER_LOGIN_WEB|' <<< "$output" | tail -n1)"
db_marker="$(grep '^OWNER_LOGIN_DB|' <<< "$output" | tail -n1)"
mutation_marker="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"

IFS='|' read -r revision_tag deployed_revision <<< "$revision_marker"
IFS='|' read -r web_tag web_result web_total web_csrf web_credentials web_rate web_latest <<< "$web_marker"
IFS='|' read -r db_tag db_result db_total db_invalid db_locked db_other db_latest throttle_state throttle_failures <<< "$db_marker"

[[ "$revision_tag" == 'OWNER_LOGIN_REVISION' && "$deployed_revision" == "$RUNTIME_BASE_SHA" ]]
[[ "$web_tag" == 'OWNER_LOGIN_WEB' && "$web_result" == 'PASS' ]]
[[ "$db_tag" == 'OWNER_LOGIN_DB' && "$db_result" == 'PASS' ]]
for count in "$web_total" "$web_csrf" "$web_credentials" "$web_rate" "$db_total" "$db_invalid" "$db_locked" "$db_other" "$throttle_failures"; do
  [[ "$count" =~ ^[0-9]$ ]]
done
[[ "$web_latest" =~ ^(NONE|CSRF|CREDENTIALS|RATE_LIMITED)$ ]]
[[ "$db_latest" =~ ^(NONE|INVALID_CREDENTIALS|ACCOUNT_TEMPORARILY_LOCKED|CREDENTIAL_CHANGED_DURING_LOGIN|NO_ACTIVE_MEMBERSHIP|USER_NOT_ACTIVE|MEMBERSHIP_NOT_ACTIVE|ORGANIZATION_NOT_VERIFIED|OTHER)$ ]]
[[ "$throttle_state" =~ ^(CLEAR|PARTIAL|LOCKED|EXPIRED|UNAVAILABLE)$ ]]
[[ "$mutation_marker" == 'PRODUCTION_MUTATION=NONE' ]]

classification='AMBIGUOUS_OR_NO_EVENT'
if [[ "$db_total" == '1' && "$db_latest" == 'ACCOUNT_TEMPORARILY_LOCKED' ]]; then
  classification='ACCOUNT_TEMPORARILY_LOCKED'
elif [[ "$db_total" == '1' && "$db_latest" == 'INVALID_CREDENTIALS' && "$throttle_state" == 'LOCKED' ]]; then
  classification='INVALID_CREDENTIALS_AND_ACCOUNT_NOW_LOCKED'
elif [[ "$db_total" == '1' && "$db_latest" == 'INVALID_CREDENTIALS' ]]; then
  classification='INVALID_CREDENTIALS'
elif [[ "$db_total" == '1' && "$db_other" == '1' ]]; then
  classification="AUTH_DENIED_$db_latest"
fi
[[ "$classification" =~ ^[A-Z0-9_]{1,96}$ ]]

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 owner login-denial diagnostic

- command: \`$COMMAND\`
- exact diagnostic main: \`$TARGET_SHA\`
- inspected deployed API/Web revision: \`$deployed_revision\`
- runtime-neutral delta guard: \`PASS\`
- bounded attempt window: \`$ATTEMPT_SINCE .. $ATTEMPT_UNTIL\`
- result: \`PASS\`
- safe terminal classification: \`$classification\`
- control-plane denial event count: \`$web_total\`
- control-plane denial class: \`$web_latest\`
- owner auth-audit event count: \`$db_total\`
- owner auth-audit class: \`$db_latest\`
- owner throttle state now: \`$throttle_state\`
- owner failed-attempt bucket: \`$throttle_failures\`
- owner identity / email / account hash exposure: \`NONE\`
- password / TOTP / cookie / token exposure: \`NONE\`
- raw Docker / database / log output: \`NOT_PUBLISHED\`
- login / reset / recovery replay: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
