#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LIVE_BASE="https://$LIVE_DOMAIN"
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-request deployed-d2dd797'
TARGET_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-fixed-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-fixed-known-hosts"
scan=''
scan_raw=''
match=''
stage='INITIAL'
result_published=0

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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer password-reset request — fixed deployed revision

- command: \`$COMMAND\`
- exact deployed revision: \`$TARGET_SHA\`
- result: \`FAIL_CLOSED\`
- failure stage: \`$stage\`
- reviewer identity exposure: \`NONE\`
- reset-token/password/TOTP exposure: \`NONE\`
- production mutation: \`NONE_OR_NORMAL_PASSWORD_RESET_REQUEST_ONLY\`
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

guard_repository_ancestry() {
  local live_main
  live_main="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$live_main" =~ ^[0-9a-f]{40}$ ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$live_main" ]]
  git cat-file -e "$TARGET_SHA^{commit}"
  git merge-base --is-ancestor "$TARGET_SHA" "$live_main"
}

stage='REPOSITORY_ANCESTRY'
guard_repository_ancestry

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

stage='SSH_PRIVATE_KEY'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_repository_ancestry

stage='DNS_IP_GUARD'
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

stage='SSH_HOST_KEY_SCAN'
scan="$(mktemp)"
scan_raw="$(mktemp)"
match="$(mktemp)"
scan_ready=0
for attempt in 1 2 3; do
  : > "$scan_raw"
  : > "$scan"
  /usr/bin/ssh-keyscan -T 10 -p "$port" "$host" > "$scan_raw" 2>/dev/null || true
  if [[ -s "$scan_raw" ]]; then
    sort -u "$scan_raw" > "$scan"
    if [[ -s "$scan" ]]; then
      scan_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$scan_ready" == '1' ]]

stage='SSH_HOST_KEY_FINGERPRINT'
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"
match=''
rm -f -- "$scan" "$scan_raw"
scan=''
scan_raw=''
chmod 0600 "$known_hosts"

guard_repository_ancestry

stage='SSH_TRANSPORT'
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; curl --version >/dev/null' \
  >/dev/null

stage='REMOTE_EXECUTION'
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$TARGET_SHA' '$LIVE_BASE'" <<'REMOTE'
set -Eeuo pipefail
target_sha="$1"
live_base="$2"
remote_stage='INITIAL'
remote_failed=0

remote_fail() {
  local rc="$?"
  trap - ERR
  printf 'REMOTE_FAILURE_STAGE=%s\n' "$remote_stage"
  exit "$rc"
}
trap remote_fail ERR

[[ "$target_sha" == 'd2dd7972105cc59002263455b5ae0eb8d8f2d386' ]]
[[ "$live_base" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
command -v curl >/dev/null 2>&1

remote_stage='DEPLOYED_PARITY'
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
api_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$api_id")"
web_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$web_id")"
[[ "$api_state" =~ ^(healthy|running)$ ]]
[[ "$web_state" =~ ^(healthy|running)$ ]]

remote_stage='REVIEWER_SUBJECT'
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
    FROM pg_roles
    WHERE rolname = current_user
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

remote_tmp="$(mktemp -d /root/pc-reviewer-reset-fixed.XXXXXX)"
chmod 0700 "$remote_tmp"
cleanup_remote() { rm -rf -- "$remote_tmp"; }
trap cleanup_remote EXIT
jar="$remote_tmp/cookies.txt"
page="$remote_tmp/page.html"
request_body="$remote_tmp/request.json"
response_body="$remote_tmp/response.json"
: > "$jar"; : > "$request_body"; : > "$response_body"
chmod 0600 "$jar" "$request_body" "$response_body"

remote_stage='CSRF_BOOTSTRAP'
get_status="$(curl --silent --connect-timeout 10 --max-time 20 \
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

remote_stage='PASSWORD_RESET_POST'
post_status="$(curl --silent --connect-timeout 10 --max-time 20 \
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

remote_stage='DELIVERY_EVIDENCE'
delivery_ok=0
for _ in 1 2 3 4 5 6 7 8; do
  if docker logs --since "$started_epoch" "$web_id" 2>&1 \
      | grep -F "$correlation_id" \
      | grep -F 'password_reset_delivery_result' \
      | grep -Eq '"delivered"[[:space:]]*:[[:space:]]*true'; then
    delivery_ok=1
    break
  fi
  sleep 1
done
[[ "$delivery_ok" == '1' ]]

remote_stage='POST_PARITY'
api_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision_after" == "$target_sha" && "$web_revision_after" == "$target_sha" ]]

printf 'REVIEWER_PASSWORD_RESET_FIXED|%s|%s\n' "$post_status" "$delivery_ok"
printf 'API_REVISION=%s\n' "$api_revision_after"
printf 'WEB_REVISION=%s\n' "$web_revision_after"
printf 'PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY\n'
REMOTE
)"

if failure_marker="$(grep '^REMOTE_FAILURE_STAGE=' <<< "$output" | tail -n1)" && [[ -n "$failure_marker" ]]; then
  stage="${failure_marker#REMOTE_FAILURE_STAGE=}"
  false
fi
marker="$(grep '^REVIEWER_PASSWORD_RESET_FIXED|' <<< "$output" | tail -n1)"
api_marker="$(grep '^API_REVISION=' <<< "$output" | tail -n1)"
web_marker="$(grep '^WEB_REVISION=' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
IFS='|' read -r tag post_status delivery_ok <<< "$marker"
[[ "$tag" == 'REVIEWER_PASSWORD_RESET_FIXED' ]]
[[ "$post_status" == '202' && "$delivery_ok" == '1' ]]
[[ "$api_marker" == "API_REVISION=$TARGET_SHA" ]]
[[ "$web_marker" == "WEB_REVISION=$TARGET_SHA" ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY' ]]

guard_repository_ancestry
stage='PUBLISH_SUCCESS'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer password-reset request — fixed deployed revision

- command: \`$COMMAND\`
- exact deployed revision: \`$TARGET_SHA\`
- result: \`PASS\`
- HTTP reset request: \`202 ACCEPTED\`
- transactional delivery evidence: \`PASS\`
- reviewer identity exposure: \`NONE\`
- reset-token/password/TOTP exposure: \`NONE\`
- production mutation: \`NORMAL_PASSWORD_RESET_REQUEST_ONLY\`
- next: \`HUMAN_PASSWORD_RESET_THEN_TOTP_ENROLLMENT\`" >/dev/null
result_published=1
