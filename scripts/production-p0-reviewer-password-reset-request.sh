#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LIVE_BASE="https://$LIVE_DOMAIN"
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-request current-main'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-known-hosts"
result_published=0
TARGET_SHA='unknown'
failure_reason='BOOTSTRAP_FAILED'
failure_detail='NONE'
scan=''
scan_raw=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$scan_raw" ]] || rm -f -- "$scan_raw"
  [[ -z "$match" ]] || rm -f -- "$match"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    [[ "$failure_reason" =~ ^[A-Z0-9_]{1,96}$ ]] || failure_reason='UNCLASSIFIED_FAILURE'
    [[ "$failure_detail" =~ ^[A-Z0-9_]{1,128}$ ]] || failure_detail='NONE'
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer password-reset request

- exact main: \`$TARGET_SHA\`
- result: \`FAIL\`
- reviewer identity exposure: \`NONE\`
- password/TOTP handling: \`NONE\`
- production mutation: \`NONE_OR_NORMAL_RESET_REQUEST_ONLY\`
- blocker: \`REVIEWER_PASSWORD_RESET_REQUEST_FAILED_CLOSED\`
- failure reason: \`$failure_reason\`
- failure detail: \`$failure_detail\`
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

failure_reason='MAIN_GUARD_FAILED'
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
  plain="$(mktemp)"
  escaped="$(mktemp)"
  decoded="$(mktemp)"
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

failure_reason='SSH_PRIVATE_KEY_INVALID'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"
failure_reason='MAIN_GUARD_FAILED'
guard_main

failure_reason='DNS_IP_GUARD_FAILED'
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

failure_reason='SSH_HOST_KEY_SCAN_FAILED'
scan="$(mktemp)"
scan_raw="$(mktemp)"
match="$(mktemp)"
scan_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"
  : > "$scan"
  : > "$match"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then
      scan_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$scan_ready" == '1' ]]

failure_reason='SSH_HOST_KEY_FINGERPRINT_MISMATCH'
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"
match=''
rm -f -- "$scan" "$scan_raw"
scan=''
scan_raw=''
chmod 0600 "$known_hosts"

failure_reason='MAIN_GUARD_FAILED'
guard_main
failure_reason='SSH_TRANSPORT_FAILED'
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" 'set -euo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; curl --version >/dev/null' \
  >/dev/null

failure_reason='REMOTE_EXECUTION_FAILED'
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$TARGET_SHA' '$LIVE_BASE'" <<'REMOTE'
set -Eeuo pipefail
target_sha="$1"
live_base="$2"
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$live_base" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v curl >/dev/null 2>&1

remote_tmp="$(mktemp -d /root/pc-reviewer-reset.XXXXXX)"
chmod 0700 "$remote_tmp"
cleanup_remote() {
  rm -rf -- "$remote_tmp"
}
trap cleanup_remote EXIT

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$project" ]]
mapfile -t api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=api')
mapfile -t worker_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#api_ids[@]} == 1 ))
(( ${#worker_ids[@]} == 1 ))
api_id="${api_ids[0]}"
worker_id="${worker_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id")"
[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]
worker_state="$(docker inspect --format '{{.State.Status}}' "$worker_id")"
worker_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$worker_id")"
[[ "$worker_state" == 'running' ]]
[[ "$worker_health" == 'healthy' ]]

# Resolve the sole reviewer inside production. The address never crosses SSH.
subject_output="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const fail = (code) => { throw new Error(code); };
const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/;
let db;
(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) fail('P0_STAFF_DATABASE_URL_MISSING');
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const principals = await db.$queryRawUnsafe(`
    SELECT current_user AS user_name,
           rolsuper,
           rolbypassrls,
           has_table_privilege(current_user, 'public.users', 'SELECT') AS can_read_users,
           has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS can_read_memberships,
           has_table_privilege(current_user, 'public.organizations', 'SELECT') AS can_read_organizations,
           has_table_privilege(current_user, 'auth.staff_assignments', 'SELECT') AS can_read_assignments,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_preflight()'), 'EXECUTE'), false) AS preflight_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_login_readiness()'), 'EXECUTE'), false) AS readiness_execute,
           coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_password_reset_subject()'), 'EXECUTE'), false) AS reset_subject_execute
    FROM pg_roles WHERE rolname = current_user
  `);
  const principal = principals[0];
  if (!principal || principal.user_name !== 'pc_staff_runtime'
      || principal.rolsuper || principal.rolbypassrls
      || principal.can_read_users || principal.can_read_memberships
      || principal.can_read_organizations || principal.can_read_assignments
      || !principal.preflight_execute || !principal.readiness_execute || !principal.reset_subject_execute) {
    fail('P0_REVIEWER_RESET_PRINCIPAL_BOUNDARY_INVALID');
  }
  const rows = await db.$queryRawUnsafe(`
    SELECT
      preflight.active_owner_count,
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
  if (rows.length !== 1) fail('P0_REVIEWER_RESET_READINESS_CARDINALITY_INVALID');
  const row = rows[0];
  const counts = [
    Number(row.active_owner_count || 0), Number(row.usable_reviewer_count || 0),
    Number(row.assignment_ready_count || 0), Number(row.active_identity_ready_count || 0),
    Number(row.membership_ready_count || 0), Number(row.password_ready_count || 0),
    Number(row.mfa_enrolled_ready_count || 0), Number(row.login_ready_count || 0),
  ];
  if (counts.join('|') !== '1|1|1|1|1|0|0|0') fail('P0_REVIEWER_RESET_READINESS_NOT_EXACT');
  const email = String(row.reviewer_email || '');
  if (!emailPattern.test(email) || email.length > 254) fail('P0_REVIEWER_RESET_SUBJECT_INVALID');
  process.stdout.write(`SUBJECT|${email}`);
})().catch((error) => {
  const code = String(error?.message || 'P0_REVIEWER_RESET_DB_FAILURE').replace(/[^A-Z0-9_-]/gi, '').slice(0, 96);
  process.stderr.write(`${code || 'P0_REVIEWER_RESET_DB_FAILURE'}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.$disconnect().catch(() => undefined);
});
NODE
)"
IFS='|' read -r subject_tag reviewer_email <<< "$subject_output"
[[ "$subject_tag" == 'SUBJECT' ]]
[[ "$reviewer_email" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$ ]]
(( ${#reviewer_email} <= 254 ))
unset subject_output

jar="$remote_tmp/cookies.txt"
page="$remote_tmp/page.html"
request_body="$remote_tmp/request.json"
response_body="$remote_tmp/response.json"
: > "$jar"; : > "$request_body"; : > "$response_body"
chmod 0600 "$jar" "$request_body" "$response_body"

get_status="$(curl --silent --show-error --connect-timeout 10 --max-time 20 \
  --output "$page" --write-out '%{http_code}' \
  --cookie "$jar" --cookie-jar "$jar" \
  -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$live_base/platform-v7/forgot-password?lang=ru")"
[[ "$get_status" == '200' ]]
csrf="$(awk -F '\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$jar")"
[[ "$csrf" =~ ^[A-Za-z0-9_-]{24,128}$ ]]
printf '{"email":"%s","locale":"ru"}' "$reviewer_email" > "$request_body"
unset reviewer_email

correlation_id="$(cat /proc/sys/kernel/random/uuid)"
[[ "$correlation_id" =~ ^[0-9a-f-]{36}$ ]]
started_epoch="$(date +%s)"
post_status="$(curl --silent --show-error --connect-timeout 10 --max-time 20 \
  --output "$response_body" --write-out '%{http_code}' \
  --cookie "$jar" --cookie-jar "$jar" \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -H "Origin: $live_base" \
  -H "x-csrf-token: $csrf" \
  -H "x-correlation-id: $correlation_id" \
  --data-binary "@$request_body" \
  "$live_base/api/auth/forgot-password")"
[[ "$post_status" == '202' ]]
grep -Eq '"accepted"[[:space:]]*:[[:space:]]*true' "$response_body"
grep -Fq "\"correlationId\":\"$correlation_id\"" "$response_body"

# Durable mail evidence is authoritative. The worker DB principal may read the
# encrypted outbox but this probe selects only status metadata for this exact
# propagated correlation id and never decrypts the payload.
outbox_marker="$(docker exec -i "$worker_id" /nodejs/bin/node --input-type=commonjs - "$correlation_id" <<'NODE'
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const correlationId = String(process.argv[2] || '');
const safe = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 96) || 'NONE';
if (!/^[0-9a-f-]{36}$/.test(correlationId)) process.exit(31);
const databaseFile = String(process.env.AUTH_MAIL_DATABASE_URL_FILE || '/run/pc-auth-mail/database-url').trim();
let db;
(async () => {
  const databaseUrl = fs.readFileSync(databaseFile, 'utf8').trim();
  if (!databaseUrl) throw new Error('DATABASE_URL_EMPTY');
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const deadline = Date.now() + 90_000;
  let last = null;
  while (Date.now() <= deadline) {
    const rows = await db.$queryRawUnsafe(`
      SELECT status, attempt_count, max_attempts, last_error_code,
             (sent_at IS NOT NULL) AS sent_marked
      FROM auth.mail_outbox
      WHERE message_kind = 'PASSWORD_RESET'
        AND correlation_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 2
    `, correlationId);
    if (rows.length > 1) {
      process.stdout.write('OUTBOX|CARDINALITY|0|0|NONE|0');
      return;
    }
    if (rows.length === 1) {
      const row = rows[0];
      const status = String(row.status || '').toUpperCase();
      const attempt = Number(row.attempt_count || 0);
      const maxAttempts = Number(row.max_attempts || 0);
      const sentMarked = row.sent_marked === true ? 1 : 0;
      last = { status, attempt, maxAttempts, error: safe(row.last_error_code), sentMarked };
      if (status === 'SENT' || status === 'DEAD_LETTER') {
        process.stdout.write(`OUTBOX|${status}|${attempt}|${maxAttempts}|${last.error}|${sentMarked}`);
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (!last) {
    process.stdout.write('OUTBOX|NONE|0|0|NONE|0');
    return;
  }
  process.stdout.write(`OUTBOX|${last.status}|${last.attempt}|${last.maxAttempts}|${last.error}|${last.sentMarked}`);
})().catch((error) => {
  process.stderr.write(`${safe(error?.message)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.$disconnect().catch(() => undefined);
});
NODE
)"
IFS='|' read -r outbox_tag outbox_status outbox_attempt outbox_max outbox_error outbox_sent <<< "$outbox_marker"
[[ "$outbox_tag" == 'OUTBOX' ]]
[[ "$outbox_status" =~ ^(SENT|DEAD_LETTER|PENDING|PROCESSING|NONE|CARDINALITY)$ ]]
[[ "$outbox_attempt" =~ ^[0-9]{1,2}$ ]]
[[ "$outbox_max" =~ ^[0-9]{1,2}$ ]]
[[ "$outbox_error" =~ ^[A-Z0-9_]{1,96}$ ]]
[[ "$outbox_sent" =~ ^[01]$ ]]

api_transaction_failure=NO
if docker logs --since "$started_epoch" "$api_id" 2>&1 | grep -Fq 'Password reset challenge/outbox transaction failed'; then
  api_transaction_failure=YES
fi

printf 'REVIEWER_PASSWORD_RESET_REQUEST|%s|%s|%s|%s|%s|%s|%s|%s\n' \
  "$post_status" "$correlation_id" "$outbox_status" "$outbox_attempt" "$outbox_max" "$outbox_error" "$outbox_sent" "$api_transaction_failure"
printf 'API_REVISION=%s\n' "$api_revision"
printf 'WEB_REVISION=%s\n' "$web_revision"
printf 'WORKER_REVISION=%s\n' "$worker_revision"
printf 'WORKER_READINESS=PASS\n'
printf 'PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY\n'
REMOTE
)"

failure_reason='EVIDENCE_VALIDATION_FAILED'
marker="$(grep '^REVIEWER_PASSWORD_RESET_REQUEST|' <<< "$output" | tail -n1)"
api_revision="$(grep '^API_REVISION=' <<< "$output" | tail -n1 | cut -d= -f2-)"
web_revision="$(grep '^WEB_REVISION=' <<< "$output" | tail -n1 | cut -d= -f2-)"
worker_revision="$(grep '^WORKER_REVISION=' <<< "$output" | tail -n1 | cut -d= -f2-)"
worker_readiness="$(grep '^WORKER_READINESS=' <<< "$output" | tail -n1 | cut -d= -f2-)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
IFS='|' read -r tag status correlation_id outbox_status outbox_attempt outbox_max outbox_error outbox_sent api_tx_failure <<< "$marker"
[[ "$tag" == 'REVIEWER_PASSWORD_RESET_REQUEST' ]]
[[ "$status" == '202' ]]
[[ "$correlation_id" =~ ^[0-9a-f-]{36}$ ]]
[[ "$outbox_status" =~ ^(SENT|DEAD_LETTER|PENDING|PROCESSING|NONE|CARDINALITY)$ ]]
[[ "$outbox_attempt" =~ ^[0-9]{1,2}$ ]]
[[ "$outbox_max" =~ ^[0-9]{1,2}$ ]]
[[ "$outbox_error" =~ ^[A-Z0-9_]{1,96}$ ]]
[[ "$outbox_sent" =~ ^[01]$ ]]
[[ "$api_tx_failure" =~ ^(YES|NO)$ ]]
[[ "$api_revision" == "$TARGET_SHA" && "$web_revision" == "$TARGET_SHA" && "$worker_revision" == "$TARGET_SHA" ]]
[[ "$worker_readiness" == 'PASS' ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY' ]]

correlation_hash="$(printf '%s' "$correlation_id" | sha256sum | cut -c1-16)"
unset correlation_id output marker
[[ "$correlation_hash" =~ ^[a-f0-9]{16}$ ]]

if [[ "$outbox_status" != 'SENT' || "$outbox_sent" != '1' ]]; then
  case "$outbox_status" in
    NONE)
      if [[ "$api_tx_failure" == 'YES' ]]; then
        failure_reason='DURABLE_OUTBOX_TRANSACTION_FAILED'
      else
        failure_reason='NO_DURABLE_OUTBOX_EFFECT'
      fi
      ;;
    DEAD_LETTER) failure_reason='AUTH_MAIL_DEAD_LETTER' ;;
    PENDING|PROCESSING) failure_reason='AUTH_MAIL_DELIVERY_TIMEOUT' ;;
    CARDINALITY) failure_reason='DURABLE_OUTBOX_CARDINALITY_INVALID' ;;
    *) failure_reason='DURABLE_OUTBOX_NOT_SENT' ;;
  esac
  failure_detail="$outbox_error"
  result_published=1
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer password-reset request

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- result: \`FAIL\`
- API / Web / auth-mail worker revision parity: \`PASS\`
- auth-mail worker readiness: \`PASS\`
- ordinary reset endpoint accepted: \`202\`
- durable PASSWORD_RESET outbox state: \`$outbox_status\`
- durable outbox attempts: \`$outbox_attempt / $outbox_max\`
- safe delivery error: \`$outbox_error\`
- API challenge/outbox transaction failure marker: \`$api_tx_failure\`
- correlation hash: \`$correlation_hash\`
- reviewer identity exposure: \`NONE\`
- reset token / encrypted payload output: \`NONE\`
- password/TOTP handling: \`NONE\`
- production mutation: \`NORMAL_PASSWORD_RESET_REQUEST_ONLY\`
- blocker: \`$failure_reason\`" >/dev/null
  exit 1
fi

failure_reason='MAIN_GUARD_FAILED'
guard_main

failure_reason='EVIDENCE_PUBLICATION_FAILED'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer password-reset request

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- result: \`PASS\`
- API / Web / auth-mail worker revision parity: \`PASS\`
- auth-mail worker readiness: \`PASS\`
- ordinary reset endpoint: \`/api/auth/forgot-password\`
- CSRF / same-origin: \`PASS\`
- request accepted: \`202\`
- durable PASSWORD_RESET outbox state: \`SENT\`
- durable outbox attempts: \`$outbox_attempt / $outbox_max\`
- safe delivery error: \`$outbox_error\`
- correlation hash: \`$correlation_hash\`
- reviewer identity exposure: \`NONE\`
- reset token / encrypted payload output: \`NONE\`
- password/TOTP handling: \`NONE\`
- production mutation: \`NORMAL_PASSWORD_RESET_REQUEST_ONLY\`
- next: \`HUMAN_PASSWORD_RESET_LINK_REQUIRED\`" >/dev/null

result_published=1
failure_reason='NONE'
printf 'P0_REVIEWER_PASSWORD_RESET_REQUEST=PASS\n'
printf 'P0_REVIEWER_PASSWORD_RESET_CORRELATION_HASH=%s\n' "$correlation_hash"
