#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_RESET_ATTEMPT_COMMAND:?PC_REVIEWER_RESET_ATTEMPT_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-attempt-classify 31706325376 current-main'
SOURCE_RUN_ID='31706325376'
ATTEMPT_SINCE='2026-08-13T13:43:10Z'
ATTEMPT_UNTIL='2026-08-13T13:43:26Z'
EXPECTED_DEPLOYED_SHA='7c768ad7c54523837b06999a8f69bdffe2a840db'

[[ "$PC_REVIEWER_RESET_ATTEMPT_COMMAND" == "$COMMAND" ]]

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-attempt-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-attempt-known-hosts"
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
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
  [[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
  git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"
  [[ -z "$(git status --porcelain=v1)" ]]
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset attempt classifier

- source reset run: \`$SOURCE_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- expected source revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- failure detail: \`$failure_detail\`
- reviewer identity / account hash / correlation id exposure: \`NONE\`
- reset token / hash / credential exposure: \`NONE\`
- reset replay / mail send: \`NONE\`
- raw database/runtime output: \`NOT_PUBLISHED\`
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
git cat-file -e "$EXPECTED_DEPLOYED_SHA^{commit}"
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
stage='REMOTE_ATTEMPT_CLASSIFICATION'
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$EXPECTED_DEPLOYED_SHA' '$ATTEMPT_SINCE' '$ATTEMPT_UNTIL'" <<'REMOTE'
set -Eeuo pipefail
expected_revision="$1"
attempt_since="$2"
attempt_until="$3"
remote_substage='REMOTE_PRECONDITION'
remote_terminal_cardinality='UNKNOWN'
remote_delivery_cardinality='UNKNOWN'
db_output=''
web_logs=''

publish_remote_failure() {
  local rc="$?"
  trap - ERR
  printf 'ATTEMPT_REMOTE_FAILURE|%s|%s|%s\n' \
    "$remote_substage" "$remote_terminal_cardinality" "$remote_delivery_cardinality"
  exit "$rc"
}
trap publish_remote_failure ERR
exec 2>/dev/null

[[ "$expected_revision" == '7c768ad7c54523837b06999a8f69bdffe2a840db' ]]
[[ "$attempt_since" == '2026-08-13T13:43:10Z' ]]
[[ "$attempt_until" == '2026-08-13T13:43:26Z' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1

remote_substage='CONTAINER_DISCOVERY'
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

remote_substage='DATABASE_AGGREGATES'
if db_output="$(
docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$attempt_since" "$attempt_until" <<'NODE'
const { createHash, createHmac } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const [attemptSince, attemptUntil] = process.argv.slice(2);
const safeCount = (value) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
const explicitFailureCodes = new Set([
  'AUTH_DATABASE_URL_MISSING',
  'AUTH_DATABASE_URL_NOT_ISOLATED',
  'STAFF_DATABASE_URL_MISSING',
  'STAFF_PRINCIPAL_BOUNDARY',
  'REVIEWER_CARDINALITY',
  'REVIEWER_READINESS_INVALID',
  'REVIEWER_SUBJECT_INVALID',
  'AUTH_TOKEN_PEPPER_MISSING',
  'ATTEMPT_BINDING_INVALID',
  'AUTH_PRINCIPAL_BOUNDARY',
  'AUTH_SUBJECT_NOT_FOUND',
  'CHALLENGE_AGGREGATE_CARDINALITY',
  'CHALLENGE_AGGREGATE_INVALID',
  'CHALLENGE_STATUS_INVALID',
  'AUDIT_AGGREGATE_CARDINALITY',
  'AUDIT_AGGREGATE_INVALID',
  'ATTEMPT_EVIDENCE_AMBIGUOUS',
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
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_preflight()'), 'EXECUTE'), false) AS preflight_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_login_readiness()'), 'EXECUTE'), false) AS readiness_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_password_reset_subject()'), 'EXECUTE'), false) AS subject_execute
    FROM pg_roles WHERE rolname = current_user
  `);
  const staffPrincipal = staffPrincipalRows[0];
  if (!staffPrincipal || !Object.values(staffPrincipal).every((value) => value === true)) {
    fail('STAFF_PRINCIPAL_BOUNDARY');
  }

  const reviewerRows = await staffDb.$queryRawUnsafe(`
    SELECT preflight.active_owner_count,
           preflight.usable_reviewer_count,
           readiness.assignment_ready_count,
           readiness.active_identity_ready_count,
           readiness.membership_ready_count,
           readiness.password_ready_count,
           readiness.mfa_enrolled_ready_count,
           readiness.login_ready_count,
           auth.staff_reviewer_password_reset_subject() AS reviewer_email
    FROM auth.staff_reviewer_preflight() preflight
    CROSS JOIN auth.staff_reviewer_login_readiness() readiness
  `);
  if (reviewerRows.length !== 1) fail('REVIEWER_CARDINALITY');
  const reviewer = reviewerRows[0];
  const readiness = [
    Number(reviewer.active_owner_count),
    Number(reviewer.usable_reviewer_count),
    Number(reviewer.assignment_ready_count),
    Number(reviewer.active_identity_ready_count),
    Number(reviewer.membership_ready_count),
    Number(reviewer.password_ready_count),
    Number(reviewer.mfa_enrolled_ready_count),
    Number(reviewer.login_ready_count),
  ];
  if (readiness.some((value) => !safeCount(value)) || readiness.join('|') !== '1|1|1|1|1|0|0|0') {
    fail('REVIEWER_READINESS_INVALID');
  }
  const passwordReady = readiness[5];
  const mfaReady = readiness[6];
  const loginReady = readiness[7];
  const email = String(reviewer.reviewer_email || '');
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email) || email.length > 254) {
    fail('REVIEWER_SUBJECT_INVALID');
  }
  const authTokenPepper = String(process.env.AUTH_TOKEN_PEPPER || '').trim();
  if (!authTokenPepper) fail('AUTH_TOKEN_PEPPER_MISSING');
  const webAccountHash = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
  const authHashKey = createHash('sha256').update(authTokenPepper, 'utf8').digest();
  const apiAccountHash = createHmac('sha256', authHashKey)
    .update(`password-reset:${email}`, 'utf8')
    .digest('hex');
  if (!/^[a-f0-9]{16}$/.test(webAccountHash) || !/^[a-f0-9]{64}$/.test(apiAccountHash)) {
    fail('ATTEMPT_BINDING_INVALID');
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
      count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz)::int AS attempt_count,
      count(*) FILTER (WHERE status = 'PENDING' AND expires_at > now())::int AS unexpired_pending_count,
      coalesce((SELECT c.status FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), 'NONE') AS latest_status,
      coalesce((SELECT c.expires_at <= now() FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), true) AS latest_expired
    FROM auth.password_reset_challenges
    WHERE user_id = $1
  `, userId, attemptSince, attemptUntil);
  if (challengeRows.length !== 1) fail('CHALLENGE_AGGREGATE_CARDINALITY');
  const challenge = challengeRows[0];
  const attemptChallenges = Number(challenge.attempt_count);
  const unexpiredPending = Number(challenge.unexpired_pending_count);
  const latestStatus = String(challenge.latest_status || 'NONE');
  const latestExpired = challenge.latest_expired === true ? 1 : 0;
  if (![attemptChallenges, unexpiredPending].every(safeCount)) fail('CHALLENGE_AGGREGATE_INVALID');
  if (!['NONE', 'PENDING', 'CONSUMED', 'EXPIRED'].includes(latestStatus)) fail('CHALLENGE_STATUS_INVALID');

  const auditRows = await authDb.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE user_id = $1 AND reason = 'CHALLENGE_ISSUED')::int AS issued_count,
      count(*) FILTER (WHERE user_id = $1 AND reason = 'COOLDOWN_ACTIVE')::int AS cooldown_count,
      count(*) FILTER (WHERE metadata->>'accountHash' = $4 AND reason = 'DELIVERY_BOUNDARY_REJECTED')::int AS boundary_count,
      count(*) FILTER (WHERE metadata->>'accountHash' = $4 AND reason = 'UNIVERSAL_NON_ELIGIBLE')::int AS noneligible_count,
      count(*) FILTER (WHERE (user_id = $1 OR metadata->>'accountHash' = $4) AND coalesce(reason, '') NOT IN (
        'CHALLENGE_ISSUED', 'COOLDOWN_ACTIVE', 'DELIVERY_BOUNDARY_REJECTED', 'UNIVERSAL_NON_ELIGIBLE'
      ))::int AS other_count
    FROM auth.audit_events
    WHERE action = 'auth.password_reset.request'
      AND created_at >= $2::timestamptz
      AND created_at <= $3::timestamptz
      AND (user_id = $1 OR metadata->>'accountHash' = $4)
  `, userId, attemptSince, attemptUntil, apiAccountHash);
  if (auditRows.length !== 1) fail('AUDIT_AGGREGATE_CARDINALITY');
  const audit = auditRows[0];
  const issued = Number(audit.issued_count);
  const cooldown = Number(audit.cooldown_count);
  const boundary = Number(audit.boundary_count);
  const noneligible = Number(audit.noneligible_count);
  const other = Number(audit.other_count);
  if (![issued, cooldown, boundary, noneligible, other].every(safeCount)) fail('AUDIT_AGGREGATE_INVALID');
  if (attemptChallenges > 1 || issued + cooldown + boundary + noneligible + other > 1) {
    fail('ATTEMPT_EVIDENCE_AMBIGUOUS');
  }

  const privateBinding = ['RESET_ATTEMPT_BINDING', webAccountHash, apiAccountHash].join('|');
  process.stdout.write(privateBinding + '\n');
  process.stdout.write([
    'RESET_ATTEMPT_DB', 'PASS', passwordReady, mfaReady, loginReady,
    attemptChallenges, unexpiredPending, latestStatus, latestExpired,
    issued, cooldown, boundary, noneligible, other,
  ].join('|') + '\n');
})().catch((error) => {
  process.stdout.write(`RESET_ATTEMPT_DB|FAIL_${safeFailureCode(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (staffDb) await staffDb.$disconnect().catch(() => undefined);
  if (authDb) await authDb.$disconnect().catch(() => undefined);
});
NODE
)"; then
  db_rc=0
else
  db_rc=$?
fi

if (( db_rc != 0 )); then
  db_failure="$(grep '^RESET_ATTEMPT_DB|FAIL_' <<< "$db_output" | tail -n1 || true)"
  [[ "$db_failure" =~ ^RESET_ATTEMPT_DB\|FAIL_[A-Z0-9_-]{1,64}$ ]]
  printf '%s\n' "$db_failure"
  false
fi
datasource_marker="$(grep '^AUTH_DATASOURCE|' <<< "$db_output" | tail -n1 || true)"
principal_marker="$(grep '^AUTH_PRINCIPAL|' <<< "$db_output" | tail -n1 || true)"
db_safe_marker="$(grep '^RESET_ATTEMPT_DB|' <<< "$db_output" | tail -n1 || true)"
binding_marker="$(grep '^RESET_ATTEMPT_BINDING|' <<< "$db_output" | tail -n1 || true)"
[[ "$datasource_marker" == 'AUTH_DATASOURCE|PASS' ]]
[[ "$principal_marker" == 'AUTH_PRINCIPAL|PASS' ]]
[[ "$db_safe_marker" =~ ^RESET_ATTEMPT_DB\|PASS\| ]]
[[ "$binding_marker" =~ ^RESET_ATTEMPT_BINDING\|[a-f0-9]{16}\|[a-f0-9]{64}$ ]]
IFS='|' read -r _ reviewer_web_hash reviewer_api_hash <<< "$binding_marker"
printf '%s\n' "$datasource_marker" "$principal_marker" "$db_safe_marker"
unset db_output db_failure datasource_marker principal_marker db_safe_marker binding_marker reviewer_api_hash

remote_substage='TERMINAL_LOG_READ'
if web_logs="$(docker logs --since "$attempt_since" --until "$attempt_until" "$web_id" 2>&1)"; then
  :
else
  false
fi

# Every attributable Web event carries the public-route SHA-256 account hash.
# Filter it against the reviewer hash resolved inside the same protected SSH
# session. Configuration events predate that hash in the deployed route, so
# their presence is inherently unbindable and must fail closed.
remote_substage='TERMINAL_LOG_BINDING'
mapfile -t delivery_lines < <(
  grep -F 'password_reset_delivery_result' <<< "$web_logs" \
    | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
)
mapfile -t accepted_lines < <(
  grep -F 'password_reset_request_accepted_without_delivery' <<< "$web_logs" \
    | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
)
mapfile -t api_failure_lines < <(
  grep -F 'password_reset_request_api_failure' <<< "$web_logs" \
    | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
)
mapfile -t transport_lines < <(
  grep -F 'password_reset_request_transport_failure' <<< "$web_logs" \
    | grep -F "\"accountHash\":\"$reviewer_web_hash\"" || true
)
mapfile -t configuration_lines < <(
  grep -F 'password_reset_request_configuration_error' <<< "$web_logs" || true
)
unset web_logs reviewer_web_hash
delivery_count="${#delivery_lines[@]}"
accepted_count="${#accepted_lines[@]}"
api_failure_count="${#api_failure_lines[@]}"
transport_count="${#transport_lines[@]}"
if (( ${#configuration_lines[@]} != 0 )); then
  remote_substage='UNBOUND_CONFIGURATION_EVENT'
  false
fi
configuration_count=0
terminal_count=$(( delivery_count + accepted_count + api_failure_count + transport_count + configuration_count ))
case "$terminal_count" in
  0) remote_terminal_cardinality='ZERO' ;;
  1) remote_terminal_cardinality='ONE' ;;
  *) remote_terminal_cardinality='MULTIPLE'; false ;;
esac
case "$delivery_count" in
  0) remote_delivery_cardinality='ZERO' ;;
  1) remote_delivery_cardinality='ONE' ;;
  *) remote_delivery_cardinality='MULTIPLE'; false ;;
esac

reviewer_correlation=''
if (( terminal_count == 1 )); then
  bound_line="${delivery_lines[0]:-${accepted_lines[0]:-${api_failure_lines[0]:-${transport_lines[0]:-}}}}"
  reviewer_correlation="$(sed -n 's/.*"correlationId"[[:space:]]*:[[:space:]]*"\([0-9a-f-]*\)".*/\1/p' <<< "$bound_line")"
  [[ "$reviewer_correlation" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]
fi
unset bound_line reviewer_correlation

delivered_class='NOT_OBSERVED'
provider_class='NONE'
reason_class='NONE'
api_status_class='NONE'
transport_class='NONE'
configuration_class='NONE'

if (( delivery_count == 1 )); then
  remote_substage='DELIVERY_EVENT_CLASSIFICATION'
  delivery_line="${delivery_lines[0]}"
  delivered="$(sed -n 's/.*"delivered"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$delivery_line")"
  provider="$(sed -n 's/.*"provider"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "$delivery_line")"
  reason="$(sed -n 's/.*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "$delivery_line")"
  [[ "$delivered" =~ ^(true|false)$ ]]
  [[ "$provider" =~ ^(smtp|resend|none)$ ]]
  [[ -n "$reason" && ${#reason} -le 420 && "$reason" != *$'\n'* && "$reason" != *$'\r'* ]]
  delivered_class="${delivered^^}"
  provider_class="${provider^^}"
  if [[ "$delivered" == 'true' ]]; then
    [[ "$reason" == 'sent' && "$provider" =~ ^(smtp|resend)$ ]]
    reason_class='SENT'
  elif [[ "$reason" == *'smtp_535'* ]]; then
    reason_class='SMTP_AUTH_REJECTED'
  elif [[ "$reason" =~ smtp_(550|551|552|553|554) ]]; then
    reason_class='SMTP_RECIPIENT_OR_POLICY'
  elif [[ "$reason" =~ smtp_(421|450|451|452) ]]; then
    reason_class='SMTP_TEMPORARY'
  elif [[ "$reason" == *'smtp_timeout'* || "$reason" == *'ETIMEDOUT'* ]]; then
    reason_class='SMTP_TIMEOUT'
  elif [[ "$reason" == *'ENOTFOUND'* || "$reason" == *'EAI_AGAIN'* ]]; then
    reason_class='SMTP_DNS_FAILURE'
  elif [[ "$reason" == *'ECONNREFUSED'* ]]; then
    reason_class='SMTP_CONNECTION_REFUSED'
  elif [[ "$reason" == *'certificate'* || "$reason" == *'CERT_'* || "$reason" == *'self signed'* || "$reason" == *'unable to verify'* || "$reason" == *'wrong version number'* ]]; then
    reason_class='SMTP_TLS_FAILURE'
  elif [[ "$reason" == *'smtp_failed:'* ]]; then
    reason_class='SMTP_TRANSPORT_EXCEPTION'
  elif [[ "$reason" =~ resend_(401|403) ]]; then
    reason_class='RESEND_AUTH_REJECTED'
  elif [[ "$reason" == *'resend_429'* ]]; then
    reason_class='RESEND_RATE_LIMIT'
  elif [[ "$reason" =~ resend_5[0-9][0-9] ]]; then
    reason_class='RESEND_UPSTREAM'
  elif [[ "$reason" == *'resend_failed:AbortError'* || "$reason" == *'resend_failed:TimeoutError'* ]]; then
    reason_class='RESEND_TIMEOUT'
  elif [[ "$reason" == *'resend_failed:'* ]]; then
    reason_class='RESEND_TRANSPORT_EXCEPTION'
  elif [[ "$reason" == *'resend_not_configured'* && "$reason" == *'smtp_not_configured'* ]]; then
    reason_class='MAIL_CHANNEL_NOT_CONFIGURED'
  else
    reason_class='UNCLASSIFIED'
  fi
fi

if (( api_failure_count == 1 )); then
  remote_substage='API_FAILURE_CLASSIFICATION'
  api_status="$(sed -n 's/.*"status"[[:space:]]*:[[:space:]]*\([0-9][0-9][0-9]\).*/\1/p' <<< "${api_failure_lines[0]}")"
  [[ "$api_status" =~ ^[0-9]{3}$ ]]
  case "$api_status" in
    429) api_status_class='HTTP_429' ;;
    4??) api_status_class='HTTP_4XX' ;;
    5??) api_status_class='HTTP_5XX' ;;
    *) api_status_class='HTTP_OTHER' ;;
  esac
fi

if (( transport_count == 1 )); then
  remote_substage='TRANSPORT_FAILURE_CLASSIFICATION'
  transport_reason="$(sed -n 's/.*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' <<< "${transport_lines[0]}")"
  [[ -n "$transport_reason" && ${#transport_reason} -le 64 ]]
  case "$transport_reason" in
    AbortError) transport_class='ABORT' ;;
    TimeoutError) transport_class='TIMEOUT' ;;
    *) transport_class='OTHER' ;;
  esac
fi

if (( configuration_count == 1 )); then
  remote_substage='CONFIGURATION_FAILURE_CLASSIFICATION'
  configuration_line="${configuration_lines[0]}"
  api_configured="$(sed -n 's/.*"apiConfigured"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$configuration_line")"
  boundary_configured="$(sed -n 's/.*"deliveryBoundaryConfigured"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$configuration_line")"
  mail_configured="$(sed -n 's/.*"mailConfigured"[[:space:]]*:[[:space:]]*\(true\|false\).*/\1/p' <<< "$configuration_line")"
  [[ "$api_configured" =~ ^(true|false)$ ]]
  [[ "$boundary_configured" =~ ^(true|false)$ ]]
  [[ "$mail_configured" =~ ^(true|false)$ ]]
  missing_count=0
  [[ "$api_configured" == 'true' ]] || (( missing_count += 1 ))
  [[ "$boundary_configured" == 'true' ]] || (( missing_count += 1 ))
  [[ "$mail_configured" == 'true' ]] || (( missing_count += 1 ))
  (( missing_count >= 1 ))
  if (( missing_count > 1 )); then
    configuration_class='MULTIPLE_MISSING'
  elif [[ "$api_configured" == 'false' ]]; then
    configuration_class='API_MISSING'
  elif [[ "$boundary_configured" == 'false' ]]; then
    configuration_class='DELIVERY_BOUNDARY_MISSING'
  else
    configuration_class='MAIL_MISSING'
  fi
fi

unset delivery_lines accepted_lines api_failure_lines transport_lines configuration_lines
unset delivery_line delivered provider reason api_status transport_reason configuration_line
unset api_configured boundary_configured mail_configured missing_count
remote_substage='REVISION_AFTER'
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$expected_revision" ]]
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")" == "$expected_revision" ]]

trap - ERR
printf 'RESET_ATTEMPT_LOG|PASS|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\n' \
  "$terminal_count" "$delivery_count" "$accepted_count" "$api_failure_count" "$transport_count" \
  "$configuration_count" "$delivered_class" "$provider_class" "$reason_class" "$api_status_class" \
  "$transport_class" "$configuration_class"
printf 'RESET_REPLAY|NONE\n'
printf 'MAIL_SENT_BY_CLASSIFIER|NO\n'
printf 'PRODUCTION_MUTATION|NONE\n'
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
db_marker="$(grep '^RESET_ATTEMPT_DB|' <<< "$output" | tail -n1 || true)"
log_marker="$(grep '^RESET_ATTEMPT_LOG|' <<< "$output" | tail -n1 || true)"
replay_marker="$(grep '^RESET_REPLAY|' <<< "$output" | tail -n1 || true)"
mail_marker="$(grep '^MAIL_SENT_BY_CLASSIFIER|' <<< "$output" | tail -n1 || true)"
mutation_marker="$(grep '^PRODUCTION_MUTATION|' <<< "$output" | tail -n1 || true)"
if (( remote_rc != 0 )); then
  remote_failure="$(grep '^ATTEMPT_REMOTE_FAILURE|' <<< "$output" | tail -n1 || true)"
  if [[ "$parity" != 'PARITY|PASS' ]]; then
    failure_detail='PARITY_OR_PRE_NODE_FAILURE'
  elif [[ "$db_marker" =~ ^RESET_ATTEMPT_DB\|FAIL_([A-Z0-9_-]{1,64})$ ]]; then
    failure_detail="${BASH_REMATCH[1]}"
  elif [[ "$remote_failure" =~ ^ATTEMPT_REMOTE_FAILURE\|([A-Z0-9_-]{1,64})\|(ZERO|ONE|MULTIPLE|UNKNOWN)\|(ZERO|ONE|MULTIPLE|UNKNOWN)$ ]]; then
    failure_detail="${BASH_REMATCH[1]}_${BASH_REMATCH[2]}_${BASH_REMATCH[3]}"
  else
    failure_detail='REMOTE_NO_SAFE_MARKER'
  fi
  [[ "$failure_detail" =~ ^[A-Z0-9_-]{1,96}$ ]]
  false
fi

[[ "$parity" == 'PARITY|PASS' ]]
[[ "$datasource" == 'AUTH_DATASOURCE|PASS' ]]
[[ "$principal" == 'AUTH_PRINCIPAL|PASS' ]]
[[ "$replay_marker" == 'RESET_REPLAY|NONE' ]]
[[ "$mail_marker" == 'MAIL_SENT_BY_CLASSIFIER|NO' ]]
[[ "$mutation_marker" == 'PRODUCTION_MUTATION|NONE' ]]

IFS='|' read -r db_tag db_result password_ready mfa_ready login_ready attempt_challenges unexpired_pending latest_status latest_expired issued cooldown boundary noneligible other_audit <<< "$db_marker"
[[ "$db_tag" == 'RESET_ATTEMPT_DB' && "$db_result" == 'PASS' ]]
for value in "$password_ready" "$mfa_ready" "$login_ready" "$attempt_challenges" "$unexpired_pending" "$latest_expired" "$issued" "$cooldown" "$boundary" "$noneligible" "$other_audit"; do
  [[ "$value" =~ ^[0-9]{1,3}$ ]]
done
[[ "$latest_status" =~ ^(NONE|PENDING|CONSUMED|EXPIRED)$ ]]

IFS='|' read -r log_tag log_result terminal_count delivery_count accepted_count api_failure_count transport_count configuration_count delivered_class provider_class reason_class api_status_class transport_class configuration_class <<< "$log_marker"
[[ "$log_tag" == 'RESET_ATTEMPT_LOG' && "$log_result" == 'PASS' ]]
for value in "$terminal_count" "$delivery_count" "$accepted_count" "$api_failure_count" "$transport_count" "$configuration_count"; do
  [[ "$value" =~ ^[01]$ ]]
done
[[ "$delivered_class" =~ ^(NOT_OBSERVED|TRUE|FALSE)$ ]]
[[ "$provider_class" =~ ^(NONE|SMTP|RESEND)$ ]]
[[ "$reason_class" =~ ^(NONE|SENT|SMTP_AUTH_REJECTED|SMTP_RECIPIENT_OR_POLICY|SMTP_TEMPORARY|SMTP_TIMEOUT|SMTP_DNS_FAILURE|SMTP_CONNECTION_REFUSED|SMTP_TLS_FAILURE|SMTP_TRANSPORT_EXCEPTION|RESEND_AUTH_REJECTED|RESEND_RATE_LIMIT|RESEND_UPSTREAM|RESEND_TIMEOUT|RESEND_TRANSPORT_EXCEPTION|MAIL_CHANNEL_NOT_CONFIGURED|UNCLASSIFIED)$ ]]
[[ "$api_status_class" =~ ^(NONE|HTTP_429|HTTP_4XX|HTTP_5XX|HTTP_OTHER)$ ]]
[[ "$transport_class" =~ ^(NONE|ABORT|TIMEOUT|OTHER)$ ]]
[[ "$configuration_class" =~ ^(NONE|API_MISSING|DELIVERY_BOUNDARY_MISSING|MAIL_MISSING|MULTIPLE_MISSING)$ ]]
(( terminal_count == delivery_count + accepted_count + api_failure_count + transport_count + configuration_count ))

attempt_class='BEFORE_POST_OR_NO_DURABLE_EFFECT'
if (( configuration_count == 1 )); then
  attempt_class='WEB_CONFIGURATION_REJECTED'
elif (( api_failure_count == 1 )); then
  attempt_class='WEB_OBSERVED_API_FAILURE'
elif (( transport_count == 1 )); then
  attempt_class='WEB_OBSERVED_AUTH_TRANSPORT_FAILURE'
elif (( delivery_count == 1 )); then
  if (( attempt_challenges == 0 && issued == 0 )); then
    attempt_class='DELIVERY_EVENT_WITHOUT_DURABLE_MATCH'
  elif [[ "$delivered_class" == 'TRUE' ]]; then
    attempt_class='CHALLENGE_CREATED_DELIVERY_REPORTED_PASS'
  else
    attempt_class='CHALLENGE_CREATED_DELIVERY_REPORTED_FAIL'
  fi
elif (( accepted_count == 1 )); then
  if (( cooldown > 0 )); then
    attempt_class='COOLDOWN_ACTIVE_NO_NEW_DELIVERY'
  elif (( boundary > 0 )); then
    attempt_class='DELIVERY_BOUNDARY_REJECTED'
  elif (( noneligible > 0 )); then
    attempt_class='REVIEWER_NON_ELIGIBLE'
  elif (( attempt_challenges > 0 || issued > 0 )); then
    attempt_class='CHALLENGE_CREATED_BUT_DELIVERY_ENVELOPE_MISSING'
  else
    attempt_class='API_ACCEPTED_WITHOUT_DELIVERY_UNCLASSIFIED'
  fi
elif (( attempt_challenges > 0 || issued > 0 )); then
  attempt_class='CHALLENGE_CREATED_WEB_TERMINAL_NOT_OBSERVED'
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
stage='PUBLISH_RESULT'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset attempt classifier

- source reset run: \`$SOURCE_RUN_ID\`
- exact diagnostic main: \`$TARGET_SHA\`
- inspected production API/Web revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- attempt class: \`$attempt_class\`
- challenge rows created in attempt window: \`$attempt_challenges\`
- CHALLENGE_ISSUED audit in attempt window: \`$issued\`
- COOLDOWN_ACTIVE audit in attempt window: \`$cooldown\`
- DELIVERY_BOUNDARY_REJECTED audit in attempt window: \`$boundary\`
- UNIVERSAL_NON_ELIGIBLE audit in attempt window: \`$noneligible\`
- other reset audit in attempt window: \`$other_audit\`
- terminal Web event cardinality: \`$terminal_count\`
- delivery-result event cardinality: \`$delivery_count\`
- accepted-without-delivery event cardinality: \`$accepted_count\`
- API-failure event cardinality: \`$api_failure_count\`
- transport-failure event cardinality: \`$transport_count\`
- configuration-error event cardinality: \`$configuration_count\`
- delivered class: \`$delivered_class\`
- provider class: \`$provider_class\`
- delivery reason class: \`$reason_class\`
- API status class: \`$api_status_class\`
- transport class: \`$transport_class\`
- configuration class: \`$configuration_class\`
- current password / MFA / login ready: \`$password_ready / $mfa_ready / $login_ready\`
- current unexpired pending reset challenges: \`$unexpired_pending\`
- latest challenge status: \`$latest_status\`
- latest challenge expired by clock: \`$latest_expired\`
- fresh reset safe now: \`$fresh\`
- blocker: \`$blocker\`
- reviewer identity / account hash / correlation id exposure: \`NONE\`
- reset token / hash / user-id output: \`NONE\`
- reset replay / mail sent by classifier: \`NONE\`
- raw database/runtime output: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
result_published=1
