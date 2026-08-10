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
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer inspect

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

docker exec -i "$api_id" /nodejs/bin/node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
if (!databaseUrl) {
  console.error('P0_STAFF_DATABASE_URL_MISSING');
  process.exit(31);
}
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const principals = await db.$queryRawUnsafe(`
    SELECT current_user AS user_name,
           rolsuper,
           rolbypassrls,
           has_table_privilege(current_user, 'public.deals', 'SELECT') AS can_read_deals
    FROM pg_roles
    WHERE rolname = current_user
  `);
  const principal = principals[0];
  if (!principal || principal.user_name !== 'pc_staff_runtime'
      || principal.rolsuper || principal.rolbypassrls || principal.can_read_deals) {
    console.error('P0_STAFF_PRINCIPAL_BOUNDARY_INVALID');
    process.exit(32);
  }
  const rows = await db.$queryRawUnsafe(`
    SELECT
      COUNT(*) FILTER (
        WHERE role = 'PLATFORM_OWNER'
          AND status = 'ACTIVE'
          AND valid_from <= NOW()
          AND (valid_until IS NULL OR valid_until > NOW())
      )::int AS active_owner_count,
      COUNT(*) FILTER (
        WHERE role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
          AND status IN ('ELIGIBLE', 'ACTIVE')
          AND valid_from <= NOW()
          AND (valid_until IS NULL OR valid_until > NOW())
      )::int AS usable_reviewer_count
    FROM auth.staff_assignments
  `);
  const counts = rows[0] || {};
  const owners = Number(counts.active_owner_count || 0);
  const reviewers = Number(counts.usable_reviewer_count || 0);
  if (!Number.isInteger(owners) || owners < 0 || !Number.isInteger(reviewers) || reviewers < 0) {
    process.exit(33);
  }
  console.log(`REVIEWER_INSPECT|${principal.user_name}|${owners}|${reviewers}`);
} finally {
  await db.$disconnect();
}
NODE
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

marker="$(grep '^REVIEWER_INSPECT|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r tag principal owners reviewers <<< "$marker"
[[ "$tag" == 'REVIEWER_INSPECT' && "$principal" == 'pc_staff_runtime' ]]
[[ "$owners" =~ ^[0-9]+$ && "$reviewers" =~ ^[0-9]+$ ]]

guard_main
if (( reviewers > 0 )); then
  next='EXISTING_REVIEWER_ASSIGNMENT_PRESENT'
else
  next='FIRST_REVIEWER_BOOTSTRAP_REQUIRED'
fi

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer inspect

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- result: \`PASS\`
- staff principal: \`$principal\`
- active PLATFORM_OWNER assignments: \`$owners\`
- usable registration-reviewer assignments: \`$reviewers\`
- production mutation: \`NONE\`
- next: \`$next\`" >/dev/null
result_published=1
