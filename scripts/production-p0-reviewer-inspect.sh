#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-inspect current-main'

key_path="$RUNNER_TEMP/pc-p0-reviewer-inspect-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-inspect-known-hosts"
result_published=0
TARGET_SHA='unknown'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer login-readiness inspect

- exact main: \`$TARGET_SHA\`
- result: \`FAIL\`
- production mutation: \`NONE\`
- blocker: \`REVIEWER_INSPECT_FAILED_CLOSED\`
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

output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$TARGET_SHA'" <<'REMOTE'
set -euo pipefail
target_sha="$1"
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]]
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
[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" ]]

docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');

const sanitizeErrorCode = (error) => {
  const raw = String(error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN');
  return raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'UNKNOWN';
};

(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('P0_STAFF_DATABASE_URL_MISSING');
    process.exitCode = 31;
    return;
  }

  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const principals = await db.$queryRawUnsafe(`
      SELECT current_user AS user_name,
             rolsuper,
             rolbypassrls,
             has_table_privilege(current_user, 'public.deals', 'SELECT') AS can_read_deals,
             has_table_privilege(current_user, 'public.users', 'SELECT') AS can_read_users,
             has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS can_read_memberships,
             has_table_privilege(current_user, 'public.organizations', 'SELECT') AS can_read_organizations,
             has_table_privilege(current_user, 'auth.credential_states', 'SELECT') AS can_read_credentials,
             has_table_privilege(current_user, 'auth.staff_assignments', 'SELECT') AS can_read_assignments,
             coalesce(has_function_privilege(
               current_user,
               to_regprocedure('auth.staff_reviewer_preflight()'),
               'EXECUTE'
             ), false) AS reviewer_preflight_execute,
             coalesce(has_function_privilege(
               current_user,
               to_regprocedure('auth.staff_reviewer_login_readiness()'),
               'EXECUTE'
             ), false) AS reviewer_readiness_execute
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const principal = principals[0];
    if (!principal || principal.user_name !== 'pc_staff_runtime'
        || principal.rolsuper || principal.rolbypassrls
        || principal.can_read_deals || principal.can_read_users
        || principal.can_read_memberships || principal.can_read_organizations
        || principal.can_read_credentials || principal.can_read_assignments
        || !principal.reviewer_preflight_execute || !principal.reviewer_readiness_execute) {
      console.error('P0_STAFF_PRINCIPAL_BOUNDARY_INVALID');
      process.exitCode = 32;
      return;
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
        readiness.login_ready_count
      FROM auth.staff_reviewer_preflight() preflight
      CROSS JOIN auth.staff_reviewer_login_readiness() readiness
    `);
    const counts = rows[0] || {};
    const values = [
      Number(counts.active_owner_count || 0),
      Number(counts.usable_reviewer_count || 0),
      Number(counts.assignment_ready_count || 0),
      Number(counts.active_identity_ready_count || 0),
      Number(counts.membership_ready_count || 0),
      Number(counts.password_ready_count || 0),
      Number(counts.mfa_enrolled_ready_count || 0),
      Number(counts.login_ready_count || 0),
    ];
    if (values.some((value) => !Number.isInteger(value) || value < 0)) {
      console.error('P0_REVIEWER_READINESS_INVALID_COUNTS');
      process.exitCode = 33;
      return;
    }
    const [owners, reviewers, assignments, identities, memberships, passwords, mfa, login] = values;
    if (assignments > reviewers || identities > assignments || memberships > identities
        || passwords > memberships || mfa > passwords || login > mfa) {
      console.error('P0_REVIEWER_READINESS_NON_MONOTONIC');
      process.exitCode = 34;
      return;
    }
    console.log(
      `REVIEWER_LOGIN_READINESS|${principal.user_name}|${owners}|${reviewers}`
      + `|${assignments}|${identities}|${memberships}|${passwords}|${mfa}|${login}`,
    );
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(`P0_REVIEWER_INSPECT_DB_ERROR|${sanitizeErrorCode(error)}`);
  process.exitCode = 35;
});
NODE
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^REVIEWER_LOGIN_READINESS|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r tag principal owners reviewers assignments identities memberships passwords mfa login <<< "$marker"
[[ "$tag" == 'REVIEWER_LOGIN_READINESS' && "$principal" == 'pc_staff_runtime' ]]
for count in "$owners" "$reviewers" "$assignments" "$identities" "$memberships" "$passwords" "$mfa" "$login"; do
  [[ "$count" =~ ^[0-9]+$ ]]
done
(( assignments <= reviewers ))
(( identities <= assignments ))
(( memberships <= identities ))
(( passwords <= memberships ))
(( mfa <= passwords ))
(( login <= mfa ))

guard_main
if (( login > 0 )); then
  next='HUMAN_REVIEWER_LOGIN_CEREMONY_REQUIRED'
elif (( mfa > 0 )); then
  next='REVIEWER_CREDENTIAL_UNLOCK_OR_WAIT_REQUIRED'
elif (( passwords > 0 )); then
  next='REVIEWER_MFA_ENROLLMENT_REQUIRED'
elif (( memberships > 0 )); then
  next='REVIEWER_PASSWORD_RESET_REQUIRED'
elif (( identities > 0 )); then
  next='REVIEWER_MEMBERSHIP_OR_ORGANIZATION_REPAIR_REQUIRED'
elif (( assignments > 0 )); then
  next='REVIEWER_IDENTITY_REPAIR_REQUIRED'
else
  next='FIRST_REVIEWER_BOOTSTRAP_REQUIRED'
fi

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer login-readiness inspect

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- result: \`PASS\`
- staff principal: \`$principal\`
- active PLATFORM_OWNER assignments: \`$owners\`
- usable registration-reviewer assignments: \`$reviewers\`
- active reviewer identities: \`$identities / $assignments\`
- reviewer memberships in VERIFIED organizations: \`$memberships / $assignments\`
- reviewer password credentials ready: \`$passwords / $assignments\`
- reviewer TOTP enrollments ready: \`$mfa / $assignments\`
- structurally login-ready and unlocked reviewers: \`$login / $assignments\`
- production mutation: \`NONE\`
- next: \`$next\`" >/dev/null
result_published=1
