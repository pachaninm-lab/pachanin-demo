#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_AUTH_DURABLE_COMMAND:?PC_REVIEWER_RESET_AUTH_DURABLE_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-auth-durable-diagnose 31648675850 31648772066'
FIRST_RUN_ID='31648675850'
SECOND_RUN_ID='31648772066'
FIRST_SINCE='2026-08-12T22:51:40Z'
FIRST_UNTIL='2026-08-12T22:52:30Z'
SECOND_SINCE='2026-08-12T22:53:10Z'
SECOND_UNTIL='2026-08-12T22:54:05Z'
EXPECTED_DEPLOYED_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'

[[ "$PC_REVIEWER_RESET_AUTH_DURABLE_COMMAND" == "$COMMAND" ]]

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-auth-durable-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-auth-durable-known-hosts"
TARGET_SHA='unknown'
stage='INITIAL'
failure_detail='NONE'
result_published=0
scan=''
scan_raw=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$scan_raw" ]] || rm -f -- "$scan_raw"
  [[ -z "$match" ]] || rm -f -- "$match"
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset auth-datasource durable diagnostic

- failed reset runs: \`$FIRST_RUN_ID, $SECOND_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- inspected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- failure detail: \`$failure_detail\`
- reviewer identity exposure: \`NONE\`
- auth/reset request replay: \`NONE\`
- production mutation: \`NONE\`
- raw database/runtime output: \`NOT_PUBLISHED\`
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
git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"
[[ -z "$(git status --porcelain=v1)" ]]
stage='MAIN_CONFIRMED'

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
stage='SSH_KEY_CONFIRMED'
guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
stage='DNS_CONFIRMED'

scan="$(mktemp)"; scan_raw="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"; : > "$scan"; : > "$match"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then
      pinned_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned_ready" == '1' ]]
mv "$match" "$known_hosts"; match=''
rm -f -- "$scan" "$scan_raw"; scan=''; scan_raw=''
chmod 0600 "$known_hosts"
stage='HOST_KEY_CONFIRMED'

guard_main
ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
ssh "${ssh_opts[@]}" "$user@$host" \
  'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null
stage='SSH_CONFIRMED'

guard_main
stage='REMOTE_AUTH_DURABLE_INSPECTION'
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$EXPECTED_DEPLOYED_SHA' '$FIRST_SINCE' '$FIRST_UNTIL' '$SECOND_SINCE' '$SECOND_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
expected_revision="$1"
first_since="$2"
first_until="$3"
second_since="$4"
second_until="$5"
[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$first_since" == '2026-08-12T22:51:40Z' ]]
[[ "$first_until" == '2026-08-12T22:52:30Z' ]]
[[ "$second_since" == '2026-08-12T22:53:10Z' ]]
[[ "$second_until" == '2026-08-12T22:54:05Z' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1

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
[[ "$api_revision" == "$expected_revision" && "$web_revision" == "$expected_revision" ]]
printf 'PARITY|PASS\n'

docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$first_since" "$first_until" "$second_since" "$second_until" <<'NODE'
const { PrismaClient } = require('@prisma/client');
const [firstSince, firstUntil, secondSince, secondUntil] = process.argv.slice(2);
const safeCount = (value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
const explicitFailureCodes = new Set([
  'AUTH_DATABASE_URL_MISSING',
  'AUTH_DATABASE_URL_NOT_ISOLATED',
  'STAFF_DATABASE_URL_MISSING',
  'STAFF_PRINCIPAL_BOUNDARY',
  'REVIEWER_CARDINALITY',
  'REVIEWER_READINESS_CHANGED',
  'REVIEWER_SUBJECT_INVALID',
  'AUTH_PRINCIPAL_BOUNDARY',
  'AUTH_SUBJECT_NOT_FOUND',
  'CHALLENGE_AGGREGATE_CARDINALITY',
  'CHALLENGE_AGGREGATE_INVALID',
  'CHALLENGE_STATUS_INVALID',
  'AUDIT_AGGREGATE_CARDINALITY',
  'AUDIT_AGGREGATE_INVALID',
]);
const fail = (code) => {
  const error = new Error(code);
  error.code = code;
  throw error;
};
const safeFailureCode = (error) => {
  const explicit = String(error?.message || '');
  if (explicitFailureCodes.has(explicit)) return explicit;
  for (const candidate of [error?.meta?.code, error?.code]) {
    const value = String(candidate || '').toUpperCase();
    if (/^[A-Z0-9]{4,8}$/.test(value)) return `DB_${value}`;
  }
  return 'UNKNOWN';
};
let staffDb;
let authDb;

(async () => {
  const staffUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  const authUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
  const dealUrl = String(process.env.DATABASE_URL || '').trim();
  if (!staffUrl) fail('STAFF_DATABASE_URL_MISSING');
  if (!authUrl) fail('AUTH_DATABASE_URL_MISSING');
  if (!dealUrl || authUrl === dealUrl) fail('AUTH_DATABASE_URL_NOT_ISOLATED');
  process.stdout.write('AUTH_DATASOURCE|PASS\n');

  staffDb = new PrismaClient({ datasources: { db: { url: staffUrl } } });
  authDb = new PrismaClient({ datasources: { db: { url: authUrl } } });

  const staffPrincipalRows = await staffDb.$queryRawUnsafe(`
    SELECT current_user = 'pc_staff_runtime' AS runtime_ok,
           NOT rolsuper AS no_super,
           NOT rolbypassrls AS no_bypass,
           NOT has_table_privilege(current_user, 'public.users', 'SELECT') AS no_users,
           NOT has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT') AS no_reset_rows,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_login_readiness()'), 'EXECUTE'), false) AS readiness_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_password_reset_subject()'), 'EXECUTE'), false) AS subject_execute
    FROM pg_roles WHERE rolname = current_user
  `);
  const staffPrincipal = staffPrincipalRows[0];
  if (!staffPrincipal || !Object.values(staffPrincipal).every((value) => value === true)) {
    fail('STAFF_PRINCIPAL_BOUNDARY');
  }

  const reviewerRows = await staffDb.$queryRawUnsafe(`
    SELECT readiness.password_ready_count,
           readiness.mfa_enrolled_ready_count,
           readiness.login_ready_count,
           auth.staff_reviewer_password_reset_subject() AS reviewer_email
    FROM auth.staff_reviewer_login_readiness() readiness
  `);
  if (reviewerRows.length !== 1) fail('REVIEWER_CARDINALITY');
  const reviewer = reviewerRows[0];
  const passwordReady = Number(reviewer.password_ready_count);
  const mfaReady = Number(reviewer.mfa_enrolled_ready_count);
  const loginReady = Number(reviewer.login_ready_count);
  const email = String(reviewer.reviewer_email || '');
  if (![passwordReady, mfaReady, loginReady].every((value) => value === 0)) fail('REVIEWER_READINESS_CHANGED');
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email) || email.length > 254) {
    fail('REVIEWER_SUBJECT_INVALID');
  }

  const authPrincipalRows = await authDb.$queryRawUnsafe(`
    SELECT NOT rolsuper AS no_super,
           NOT rolbypassrls AS no_bypass,
           NOT rolinherit AS no_inherit,
           has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_usage,
           has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT') AS reset_select,
           has_table_privilege(current_user, 'auth.audit_events', 'SELECT') AS audit_select,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_password_reset_subject(text)'), 'EXECUTE'), false) AS subject_execute
    FROM pg_roles WHERE rolname = current_user
  `);
  const authPrincipal = authPrincipalRows[0];
  if (!authPrincipal || !Object.values(authPrincipal).every((value) => value === true)) {
    fail('AUTH_PRINCIPAL_BOUNDARY');
  }
  process.stdout.write('AUTH_PRINCIPAL|PASS\n');

  const subjectRows = await authDb.$queryRawUnsafe(
    `SELECT user_id FROM auth.resolve_password_reset_subject($1)`, email,
  );
  if (subjectRows.length !== 1 || !String(subjectRows[0]?.user_id || '')) fail('AUTH_SUBJECT_NOT_FOUND');
  const userId = String(subjectRows[0].user_id);

  const challengeRows = await authDb.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz)::int AS first_count,
      count(*) FILTER (WHERE created_at >= $4::timestamptz AND created_at <= $5::timestamptz)::int AS second_count,
      count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $5::timestamptz)::int AS combined_count,
      count(*) FILTER (WHERE status = 'PENDING' AND expires_at > now())::int AS unexpired_pending_count,
      coalesce((SELECT c.status FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), 'NONE') AS latest_status,
      coalesce((SELECT c.expires_at <= now() FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), true) AS latest_expired
    FROM auth.password_reset_challenges
    WHERE user_id = $1
  `, userId, firstSince, firstUntil, secondSince, secondUntil);
  if (challengeRows.length !== 1) fail('CHALLENGE_AGGREGATE_CARDINALITY');
  const challenge = challengeRows[0];
  const firstChallenges = Number(challenge.first_count);
  const secondChallenges = Number(challenge.second_count);
  const combinedChallenges = Number(challenge.combined_count);
  const unexpiredPending = Number(challenge.unexpired_pending_count);
  const latestStatus = String(challenge.latest_status || 'NONE');
  const latestExpired = challenge.latest_expired === true ? 1 : 0;
  if (![firstChallenges, secondChallenges, combinedChallenges, unexpiredPending].every(safeCount)) {
    fail('CHALLENGE_AGGREGATE_INVALID');
  }
  if (!['NONE', 'PENDING', 'CONSUMED', 'EXPIRED'].includes(latestStatus)) fail('CHALLENGE_STATUS_INVALID');

  const auditRows = await authDb.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz AND reason = 'CHALLENGE_ISSUED')::int AS first_issued,
      count(*) FILTER (WHERE created_at >= $4::timestamptz AND created_at <= $5::timestamptz AND reason = 'CHALLENGE_ISSUED')::int AS second_issued,
      count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz AND reason = 'COOLDOWN_ACTIVE')::int AS first_cooldown,
      count(*) FILTER (WHERE created_at >= $4::timestamptz AND created_at <= $5::timestamptz AND reason = 'COOLDOWN_ACTIVE')::int AS second_cooldown,
      count(*) FILTER (
        WHERE created_at >= $2::timestamptz AND created_at <= $5::timestamptz
          AND coalesce(reason, '') NOT IN ('CHALLENGE_ISSUED', 'COOLDOWN_ACTIVE')
      )::int AS other_count
    FROM auth.audit_events
    WHERE user_id = $1 AND action = 'auth.password_reset.request'
  `, userId, firstSince, firstUntil, secondSince, secondUntil);
  if (auditRows.length !== 1) fail('AUDIT_AGGREGATE_CARDINALITY');
  const audit = auditRows[0];
  const firstIssued = Number(audit.first_issued);
  const secondIssued = Number(audit.second_issued);
  const firstCooldown = Number(audit.first_cooldown);
  const secondCooldown = Number(audit.second_cooldown);
  const otherAudit = Number(audit.other_count);
  if (![firstIssued, secondIssued, firstCooldown, secondCooldown, otherAudit].every(safeCount)) {
    fail('AUDIT_AGGREGATE_INVALID');
  }

  process.stdout.write([
    'RESET_AUTH_DURABLE', 'PASS', passwordReady,
    firstChallenges, secondChallenges, combinedChallenges, unexpiredPending,
    latestStatus, latestExpired,
    firstIssued, secondIssued, firstCooldown, secondCooldown, otherAudit,
  ].join('|') + '\n');
  process.stdout.write('PRODUCTION_MUTATION|NONE\n');
})().catch((error) => {
  process.stdout.write(`RESET_AUTH_DURABLE|FAIL_${safeFailureCode(error)}\n`);
  process.stdout.write('PRODUCTION_MUTATION|NONE\n');
  process.exitCode = 1;
}).finally(async () => {
  if (staffDb) await staffDb.$disconnect().catch(() => undefined);
  if (authDb) await authDb.$disconnect().catch(() => undefined);
});
NODE
REMOTE
)"; then
  remote_rc=0
else
  remote_rc=$?
fi
stage='RESULT_VALIDATION'

parity="$(grep '^PARITY|' <<< "$output" | tail -n1 || true)"
datasource="$(grep '^AUTH_DATASOURCE|' <<< "$output" | tail -n1 || true)"
principal="$(grep '^AUTH_PRINCIPAL|' <<< "$output" | tail -n1 || true)"
marker="$(grep '^RESET_AUTH_DURABLE|' <<< "$output" | tail -n1 || true)"
mutation="$(grep '^PRODUCTION_MUTATION|' <<< "$output" | tail -n1 || true)"
if (( remote_rc != 0 )); then
  if [[ "$parity" != 'PARITY|PASS' ]]; then
    failure_detail='PARITY_OR_PRE_NODE_FAILURE'
  elif [[ "$marker" =~ ^RESET_AUTH_DURABLE\|FAIL_([A-Z0-9_-]{1,64})$ ]]; then
    failure_detail="${BASH_REMATCH[1]}"
  else
    failure_detail='REMOTE_NO_SAFE_MARKER'
  fi
  [[ "$failure_detail" =~ ^[A-Z0-9_-]{1,64}$ ]]
  false
fi

[[ "$parity" == 'PARITY|PASS' ]]
[[ "$datasource" == 'AUTH_DATASOURCE|PASS' ]]
[[ "$principal" == 'AUTH_PRINCIPAL|PASS' ]]
[[ "$mutation" == 'PRODUCTION_MUTATION|NONE' ]]

IFS='|' read -r tag result password_ready first_challenges second_challenges combined_challenges unexpired_pending latest_status latest_expired first_issued second_issued first_cooldown second_cooldown other_audit <<< "$marker"
[[ "$tag" == 'RESET_AUTH_DURABLE' && "$result" == 'PASS' ]]
for value in "$password_ready" "$first_challenges" "$second_challenges" "$combined_challenges" "$unexpired_pending" "$latest_expired" "$first_issued" "$second_issued" "$first_cooldown" "$second_cooldown" "$other_audit"; do
  [[ "$value" =~ ^[0-9]{1,3}$ ]]
done
[[ "$latest_status" =~ ^(NONE|PENDING|CONSUMED|EXPIRED)$ ]]

historic='NO_CHALLENGE_IN_FAILED_WINDOWS'
if (( combined_challenges > 0 )); then
  historic='CHALLENGE_CREATED_IN_FAILED_WINDOWS'
fi
fresh='NO'
blocker='NONE'
if (( password_ready != 0 )); then
  blocker='PASSWORD_ALREADY_READY'
elif (( unexpired_pending > 0 )); then
  blocker='UNEXPIRED_RESET_EXISTS'
elif [[ "$latest_status" == 'CONSUMED' ]]; then
  blocker='CONSUMED_CHALLENGE_WITH_PASSWORD_NOT_READY'
else
  fresh='YES'
fi

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset auth-datasource durable diagnostic

- failed reset runs: \`$FIRST_RUN_ID, $SECOND_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- inspected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- auth datasource isolation: \`PASS\`
- auth principal boundary: \`PASS\`
- first-window challenges: \`$first_challenges\`
- second-window challenges: \`$second_challenges\`
- combined-window challenges: \`$combined_challenges\`
- first-window CHALLENGE_ISSUED audit: \`$first_issued\`
- second-window CHALLENGE_ISSUED audit: \`$second_issued\`
- first-window COOLDOWN_ACTIVE audit: \`$first_cooldown\`
- second-window COOLDOWN_ACTIVE audit: \`$second_cooldown\`
- other reviewer reset audit events in combined window: \`$other_audit\`
- current password ready: \`$password_ready\`
- current unexpired pending reset challenges: \`$unexpired_pending\`
- latest challenge status: \`$latest_status\`
- latest challenge expired by clock: \`$latest_expired\`
- historical mutation class: \`$historic\`
- fresh reset safe now: \`$fresh\`
- blocker: \`$blocker\`
- reviewer identity exposure: \`NONE\`
- token/hash/user-id output: \`NONE\`
- auth/reset request replay: \`NONE\`
- production mutation: \`NONE\`
- raw database/runtime output: \`NOT_PUBLISHED\`" >/dev/null
result_published=1
