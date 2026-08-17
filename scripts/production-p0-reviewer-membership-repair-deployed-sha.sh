#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-membership-repair deployed-30d9075'
TARGET_SHA='30d9075d8867fa60b3ec275b1e244f151debf0f4'

key_path="$RUNNER_TEMP/pc-p0-reviewer-membership-repair-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-membership-repair-known-hosts"
result_published=0

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer membership repair

- command: \`$COMMAND\`
- exact deployed revision: \`$TARGET_SHA\`
- result: \`FAIL\`
- production mutation: \`UNCONFIRMED_RECHECK_REQUIRED\`
- blocker: \`REVIEWER_MEMBERSHIP_REPAIR_FAILED_CLOSED\`
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

try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_repository_ancestry

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

guard_repository_ancestry
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
const { Prisma, PrismaClient } = require('@prisma/client');

const sanitizeErrorCode = (error) => {
  const raw = String(error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN');
  return raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'UNKNOWN';
};

(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('P0_STAFF_DB_URL_MISSING');
    process.exitCode = 41;
    return;
  }

  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const principals = await db.$queryRawUnsafe(`
      SELECT current_user AS user_name,
             rolsuper,
             rolbypassrls,
             has_table_privilege(current_user, 'public.users', 'SELECT') AS can_read_users,
             has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS can_read_memberships,
             has_table_privilege(current_user, 'public.organizations', 'SELECT') AS can_read_organizations,
             has_table_privilege(current_user, 'public.outbox_entries', 'INSERT') AS can_insert_outbox,
             has_table_privilege(current_user, 'auth.staff_assignments', 'SELECT') AS can_read_assignments,
             has_table_privilege(current_user, 'auth.staff_access_events', 'INSERT') AS can_insert_staff_audit,
             coalesce(has_function_privilege(
               current_user,
               to_regprocedure('auth.repair_single_reviewer_membership()'),
               'EXECUTE'
             ), false) AS repair_execute
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const principal = principals[0];
    if (!principal || principal.user_name !== 'pc_staff_runtime'
        || principal.rolsuper || principal.rolbypassrls
        || principal.can_read_users || principal.can_read_memberships
        || principal.can_read_organizations || principal.can_insert_outbox
        || principal.can_read_assignments || principal.can_insert_staff_audit
        || !principal.repair_execute) {
      console.error('P0_REVIEWER_REPAIR_PRINCIPAL_BOUNDARY_INVALID');
      process.exitCode = 42;
      return;
    }

    const rows = await db.$transaction(
      async (tx) => tx.$queryRawUnsafe(`
        SELECT
          result_code,
          assignment_ready_count,
          active_identity_ready_count,
          membership_ready_count,
          password_ready_count,
          mfa_enrolled_ready_count,
          login_ready_count,
          internal_organization_count,
          internal_membership_count,
          audit_event_count,
          outbox_event_count
        FROM auth.repair_single_reviewer_membership()
      `),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 30_000,
      },
    );

    if (!Array.isArray(rows) || rows.length !== 1) {
      console.error('P0_REVIEWER_REPAIR_RESULT_CARDINALITY_INVALID');
      process.exitCode = 43;
      return;
    }
    const result = rows[0];
    const resultCode = String(result.result_code || '');
    const values = [
      Number(result.assignment_ready_count),
      Number(result.active_identity_ready_count),
      Number(result.membership_ready_count),
      Number(result.password_ready_count),
      Number(result.mfa_enrolled_ready_count),
      Number(result.login_ready_count),
      Number(result.internal_organization_count),
      Number(result.internal_membership_count),
      Number(result.audit_event_count),
      Number(result.outbox_event_count),
    ];
    if (!['REPAIRED', 'ALREADY_REPAIRED'].includes(resultCode)
        || values.some((value) => !Number.isInteger(value) || value < 0)) {
      console.error('P0_REVIEWER_REPAIR_RESULT_INVALID');
      process.exitCode = 44;
      return;
    }

    const [assignments, identities, memberships, passwords, mfa, login,
      organizations, internalMemberships, audits, outbox] = values;
    if (assignments !== 1 || identities !== 1 || memberships !== 1
        || passwords !== 0 || mfa !== 0 || login !== 0
        || organizations !== 1 || internalMemberships !== 1
        || audits !== 1 || outbox !== 1) {
      console.error('P0_REVIEWER_REPAIR_POSTCONDITION_INVALID');
      process.exitCode = 45;
      return;
    }

    console.log(
      `REVIEWER_MEMBERSHIP_REPAIR|${principal.user_name}|${resultCode}`
      + `|${assignments}|${identities}|${memberships}|${passwords}|${mfa}|${login}`
      + `|${organizations}|${internalMemberships}|${audits}|${outbox}`,
    );
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(`P0_REVIEWER_MEMBERSHIP_REPAIR_DB_ERROR|${sanitizeErrorCode(error)}`);
  process.exitCode = 46;
});
NODE

api_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision_after" == "$target_sha" && "$web_revision_after" == "$target_sha" ]]
printf 'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY\n'
REMOTE
)"

marker="$(grep '^REVIEWER_MEMBERSHIP_REPAIR|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=REVIEWER_MEMBERSHIP_ONLY' ]]
IFS='|' read -r tag principal result assignments identities memberships passwords mfa login organizations internal_memberships audits outbox <<< "$marker"
[[ "$tag" == 'REVIEWER_MEMBERSHIP_REPAIR' ]]
[[ "$principal" == 'pc_staff_runtime' ]]
[[ "$result" == 'REPAIRED' || "$result" == 'ALREADY_REPAIRED' ]]
for count in "$assignments" "$identities" "$memberships" "$passwords" "$mfa" "$login" \
  "$organizations" "$internal_memberships" "$audits" "$outbox"; do
  [[ "$count" =~ ^[0-9]+$ ]]
done
[[ "$assignments" == '1' && "$identities" == '1' && "$memberships" == '1' ]]
[[ "$passwords" == '0' && "$mfa" == '0' && "$login" == '0' ]]
[[ "$organizations" == '1' && "$internal_memberships" == '1' ]]
[[ "$audits" == '1' && "$outbox" == '1' ]]

guard_repository_ancestry

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer membership repair

- command: \`$COMMAND\`
- exact deployed revision: \`$TARGET_SHA\`
- result: \`PASS / $result\`
- staff principal: \`$principal\`
- active reviewer assignments: \`$assignments\`
- active reviewer identities: \`$identities\`
- reviewer memberships in VERIFIED organizations: \`$memberships\`
- password credentials ready: \`$passwords\`
- TOTP enrollments ready: \`$mfa\`
- login-ready reviewers: \`$login\`
- fixed internal organizations: \`$organizations\`
- fixed internal memberships: \`$internal_memberships\`
- immutable staff audit evidence: \`$audits\`
- durable outbox evidence: \`$outbox\`
- production mutation: \`REVIEWER_MEMBERSHIP_ONLY\`
- next: \`REVIEWER_PASSWORD_RESET_REQUIRED\`" >/dev/null
result_published=1
