#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LIVE_BASE="https://$LIVE_DOMAIN"
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-password-reset current-main'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-known-hosts"
result_published=0
TARGET_SHA='unknown'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer password-reset dispatch

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- result: \`FAIL_CLOSED\`
- reviewer email/password/token/TOTP published: \`NONE\`
- assignment/membership/password/MFA mutation: \`NONE_BY_DISPATCH\`
- blocker: \`REVIEWER_PASSWORD_RESET_DISPATCH_FAILED_CLOSED\`
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
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" 'set -euo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' \
  >/dev/null

correlation_id="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
[[ "$correlation_id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]

output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$TARGET_SHA' '$correlation_id' '$LIVE_BASE'" <<'REMOTE'
set -euo pipefail
target_sha="$1"
correlation_id="$2"
live_base="$3"
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$correlation_id" =~ ^[0-9a-f-]{36}$ ]]
[[ "$live_base" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]]
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
[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" ]]

# Reviewer PII and the reset token remain entirely inside the production
# API/Web trust boundary. The only stdout marker is correlation/hash/count/status.
request_marker="$(docker exec \
  -e P0_REVIEWER_RESET_CORRELATION_ID="$correlation_id" \
  -e P0_REVIEWER_RESET_LIVE_BASE="$live_base" \
  -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { createHash } = require('node:crypto');
const { Prisma, PrismaClient } = require('@prisma/client');

const safeCode = (value) => String(value || 'UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || 'UNKNOWN';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const databaseUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
  const correlationId = String(process.env.P0_REVIEWER_RESET_CORRELATION_ID || '').trim();
  const liveBase = String(process.env.P0_REVIEWER_RESET_LIVE_BASE || '').trim();
  if (!databaseUrl || !/^[0-9a-f-]{36}$/.test(correlationId)
      || liveBase !== 'https://xn----8sbjf4befbjgs9b.xn--p1ai') {
    console.error('P0_REVIEWER_RESET_INPUT_INVALID');
    process.exitCode = 41;
    return;
  }

  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const principalRows = await db.$queryRawUnsafe(`
      SELECT current_user AS user_name,
             rolsuper,
             rolbypassrls,
             rolinherit,
             pg_has_role(current_user, 'pc_reviewer_password_reset_dispatch_authority', 'MEMBER') AS dispatch_member,
             coalesce(has_function_privilege(
               current_user,
               to_regprocedure('auth.resolve_single_reviewer_password_reset_subject()'),
               'EXECUTE'
             ), false) AS dispatch_execute,
             (
               SELECT bool_and(relation.relrowsecurity AND relation.relforcerowsecurity)
               FROM pg_class relation
               JOIN pg_namespace schema ON schema.oid = relation.relnamespace
               WHERE schema.nspname = 'public'
                 AND relation.relname IN ('users', 'user_orgs', 'organizations')
             ) AS identity_force_rls
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const principal = principalRows[0];
    if (!principal || principal.user_name !== 'pc_auth_runtime'
        || principal.rolsuper || principal.rolbypassrls || principal.rolinherit
        || principal.dispatch_member || !principal.dispatch_execute
        || principal.identity_force_rls !== true) {
      console.error('P0_REVIEWER_RESET_AUTH_PRINCIPAL_BOUNDARY_INVALID');
      process.exitCode = 42;
      return;
    }

    const subjects = await db.$queryRawUnsafe(`
      SELECT user_id, email
      FROM auth.resolve_single_reviewer_password_reset_subject()
    `);
    if (subjects.length !== 1) {
      console.error('P0_REVIEWER_RESET_SUBJECT_CARDINALITY_INVALID');
      process.exitCode = 43;
      return;
    }
    const subject = subjects[0];
    const email = String(subject.email || '').trim().toLowerCase();
    const userId = String(subject.user_id || '').trim();
    if (!userId || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      console.error('P0_REVIEWER_RESET_SUBJECT_INVALID');
      process.exitCode = 44;
      return;
    }
    const accountHash = createHash('sha256').update(email).digest('hex').slice(0, 16);

    // Respect the normal service cooldown rather than expiring or deleting a
    // challenge directly. No reset token is read from PostgreSQL.
    const recent = await db.$queryRaw(Prisma.sql`
      SELECT created_at
      FROM auth.password_reset_challenges
      WHERE user_id = ${userId}
        AND status = 'PENDING'
        AND expires_at > NOW()
        AND created_at > NOW() - INTERVAL '60 seconds'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    if (recent.length === 1) {
      const age = Date.now() - new Date(recent[0].created_at).getTime();
      const waitMs = Math.max(0, 61_000 - age);
      if (waitMs > 0 && waitMs <= 61_500) await sleep(waitMs);
    }

    const startedAt = new Date();
    const prime = await fetch(`${liveBase}/platform-v7/register?lang=ru&reviewer-reset=${encodeURIComponent(correlationId)}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'User-Agent': 'PC-CROP-P0-Reviewer-Reset/1.0',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!prime.ok) {
      console.error('P0_REVIEWER_RESET_CSRF_PRIME_FAILED');
      process.exitCode = 45;
      return;
    }
    const setCookie = typeof prime.headers.getSetCookie === 'function'
      ? prime.headers.getSetCookie().join('; ')
      : String(prime.headers.get('set-cookie') || '');
    const csrfMatch = setCookie.match(/(?:^|[,;]\s*)pc_csrf_token=([^;,\s]+)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
    if (!/^[A-Za-z0-9_-]{24,128}$/.test(csrf)) {
      console.error('P0_REVIEWER_RESET_CSRF_COOKIE_MISSING');
      process.exitCode = 46;
      return;
    }

    const response = await fetch(`${liveBase}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Cookie': `pc_csrf_token=${encodeURIComponent(csrf)}`,
        'x-csrf-token': csrf,
        'x-correlation-id': correlationId,
        'User-Agent': 'PC-CROP-P0-Reviewer-Reset/1.0',
      },
      body: JSON.stringify({ email, locale: 'ru' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status !== 202 || payload.accepted !== true || payload.correlationId !== correlationId) {
      console.error('P0_REVIEWER_RESET_PUBLIC_FLOW_REJECTED');
      process.exitCode = 47;
      return;
    }

    const challenges = await db.$queryRaw(Prisma.sql`
      SELECT count(*)::integer AS count
      FROM auth.password_reset_challenges
      WHERE user_id = ${userId}
        AND status = 'PENDING'
        AND expires_at > NOW()
        AND created_at >= ${new Date(startedAt.getTime() - 2_000)}
    `);
    const challengeCount = Number(challenges[0]?.count || 0);
    if (challengeCount !== 1) {
      console.error('P0_REVIEWER_RESET_FRESH_CHALLENGE_NOT_PROVEN');
      process.exitCode = 48;
      return;
    }

    console.log(`REVIEWER_PASSWORD_RESET_REQUEST|${correlationId}|${accountHash}|${challengeCount}|${response.status}`);
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(`P0_REVIEWER_RESET_DB_OR_TRANSPORT_ERROR|${safeCode(error && error.code)}`);
  process.exitCode = 49;
});
NODE
)"

marker="$(grep '^REVIEWER_PASSWORD_RESET_REQUEST|' <<< "$request_marker" | tail -n1)"
IFS='|' read -r tag marker_correlation account_hash challenge_count http_status <<< "$marker"
[[ "$tag" == 'REVIEWER_PASSWORD_RESET_REQUEST' ]]
[[ "$marker_correlation" == "$correlation_id" ]]
[[ "$account_hash" =~ ^[0-9a-f]{16}$ ]]
[[ "$challenge_count" == '1' && "$http_status" == '202' ]]

# The web route logs only correlation id, an irreversible short account hash,
# provider and delivery outcome. Persist the bounded log window root-only,
# parse only the matching sanitized event, then erase the raw window.
log_file="$(mktemp /tmp/pc-reviewer-reset-web-log.XXXXXX)"
chmod 0600 "$log_file"
trap 'rm -f -- "$log_file"' EXIT
docker logs "$web_id" --since 5m > "$log_file" 2>&1 || true

delivery_marker="$(python3 - "$correlation_id" "$log_file" <<'PY'
import json
import re
import sys

correlation = sys.argv[1]
path = sys.argv[2]
matched = None
with open(path, encoding='utf-8', errors='replace') as handle:
    for line in handle:
        if 'password_reset_delivery_result' not in line or correlation not in line:
            continue
        start = line.find('{')
        if start < 0:
            continue
        try:
            payload = json.loads(line[start:])
        except Exception:
            continue
        if payload.get('correlationId') == correlation:
            matched = payload
if matched is None:
    raise SystemExit(2)
provider = re.sub(r'[^A-Za-z0-9_-]', '', str(matched.get('provider') or 'unknown'))[:24] or 'unknown'
reason = re.sub(r'[^A-Za-z0-9_.-]', '', str(matched.get('reason') or 'unknown'))[:48] or 'unknown'
delivered = '1' if matched.get('delivered') is True else '0'
print(f'REVIEWER_PASSWORD_RESET_DELIVERY|{delivered}|{provider}|{reason}')
PY
)"
rm -f -- "$log_file"
trap - EXIT

IFS='|' read -r delivery_tag delivered provider delivery_reason <<< "$delivery_marker"
[[ "$delivery_tag" == 'REVIEWER_PASSWORD_RESET_DELIVERY' ]]
[[ "$delivered" == '1' ]]
[[ "$provider" =~ ^[A-Za-z0-9_-]{1,24}$ ]]
[[ "$delivery_reason" =~ ^[A-Za-z0-9_.-]{1,48}$ ]]

printf 'REVIEWER_PASSWORD_RESET_DISPATCH=PASS\n'
printf 'CORRELATION_ID=%s\n' "$correlation_id"
printf 'ACCOUNT_HASH=%s\n' "$account_hash"
printf 'FRESH_CHALLENGE_COUNT=%s\n' "$challenge_count"
printf 'PUBLIC_FLOW_HTTP=%s\n' "$http_status"
printf 'TRANSACTIONAL_MAIL_DELIVERED=%s\n' "$delivered"
printf 'TRANSACTIONAL_MAIL_PROVIDER=%s\n' "$provider"
printf 'TRANSACTIONAL_MAIL_REASON=%s\n' "$delivery_reason"
printf 'PII_OR_TOKEN_PUBLISHED=NONE\n'
printf 'ASSIGNMENT_MEMBERSHIP_PASSWORD_MFA_MUTATION=NONE\n'
REMOTE
)"

# Accept only the bounded sanitized remote contract. Never dump remote output.
pass="$(grep '^REVIEWER_PASSWORD_RESET_DISPATCH=' <<< "$output" | tail -n1 | cut -d= -f2-)"
remote_correlation="$(grep '^CORRELATION_ID=' <<< "$output" | tail -n1 | cut -d= -f2-)"
account_hash="$(grep '^ACCOUNT_HASH=' <<< "$output" | tail -n1 | cut -d= -f2-)"
challenge_count="$(grep '^FRESH_CHALLENGE_COUNT=' <<< "$output" | tail -n1 | cut -d= -f2-)"
http_status="$(grep '^PUBLIC_FLOW_HTTP=' <<< "$output" | tail -n1 | cut -d= -f2-)"
delivered="$(grep '^TRANSACTIONAL_MAIL_DELIVERED=' <<< "$output" | tail -n1 | cut -d= -f2-)"
provider="$(grep '^TRANSACTIONAL_MAIL_PROVIDER=' <<< "$output" | tail -n1 | cut -d= -f2-)"
delivery_reason="$(grep '^TRANSACTIONAL_MAIL_REASON=' <<< "$output" | tail -n1 | cut -d= -f2-)"
pii="$(grep '^PII_OR_TOKEN_PUBLISHED=' <<< "$output" | tail -n1 | cut -d= -f2-)"
mutation="$(grep '^ASSIGNMENT_MEMBERSHIP_PASSWORD_MFA_MUTATION=' <<< "$output" | tail -n1 | cut -d= -f2-)"

[[ "$pass" == 'PASS' ]]
[[ "$remote_correlation" == "$correlation_id" ]]
[[ "$account_hash" =~ ^[0-9a-f]{16}$ ]]
[[ "$challenge_count" == '1' && "$http_status" == '202' ]]
[[ "$delivered" == '1' ]]
[[ "$provider" =~ ^[A-Za-z0-9_-]{1,24}$ ]]
[[ "$delivery_reason" =~ ^[A-Za-z0-9_.-]{1,48}$ ]]
[[ "$pii" == 'NONE' && "$mutation" == 'NONE' ]]

guard_main

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer password-reset dispatch

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- result: \`PASS_REQUESTED\`
- correlation id: \`$correlation_id\`
- reviewer account hash: \`$account_hash\`
- ordinary public forgot-password flow: \`HTTP $http_status\`
- fresh password-reset challenge: \`$challenge_count\`
- real transactional mail delivery: \`PASS\`
- mail provider: \`$provider\`
- delivery reason: \`$delivery_reason\`
- reviewer email/password/token/TOTP published: \`NONE\`
- assignment/membership/password/MFA mutation by dispatch: \`NONE\`
- production mutation: \`PASSWORD_RESET_CHALLENGE_AND_AUDIT_ONLY\`
- next: \`REVIEWER_PASSWORD_RESET_EMAIL_ACTION_REQUIRED\`" >/dev/null
result_published=1
