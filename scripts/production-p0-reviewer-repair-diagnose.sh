#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-membership-diagnose current-main'

key_path="$RUNNER_TEMP/pc-p0-reviewer-repair-diagnose-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-repair-diagnose-known-hosts"
result_published=0
TARGET_SHA='unknown'
DIAGNOSTIC_BASE_SHA='7677678dbd629a0938bd47ce421a66e80555fec3'
DEPLOYED_SHA='159b597c512aa88f24ffe9a9f37863fe5892c02f'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer repair rollback diagnostic

- command: \`$COMMAND\`
- exact diagnostic main: \`$TARGET_SHA\`
- exact deployed revision: \`$DEPLOYED_SHA\`
- result: \`FAIL\`
- production mutation: \`NONE_CONFIRMED_ONLY_IF_DIAGNOSTIC_MARKER_ABSENT\`
- blocker: \`REVIEWER_REPAIR_DIAGNOSTIC_FAILED_CLOSED\`
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
git merge-base --is-ancestor "$DEPLOYED_SHA" "$TARGET_SHA"
git merge-base --is-ancestor "$DIAGNOSTIC_BASE_SHA" "$TARGET_SHA"

mapfile -t changed_paths < <(git diff --name-only "$DIAGNOSTIC_BASE_SHA" "$TARGET_SHA" | sort)
expected_paths=(
  '.github/workflows/production-p0-reviewer-repair-diagnose.yml'
  'docs/platform-v7/autopilot/scopes/production-p0-reviewer-repair-diagnose-3802.json'
  'scripts/check-production-p0-reviewer-repair-diagnose.mjs'
  'scripts/production-p0-reviewer-repair-diagnose.sh'
)
mapfile -t expected_paths < <(printf '%s\n' "${expected_paths[@]}" | sort)
[[ "$(printf '%s\n' "${changed_paths[@]}")" == "$(printf '%s\n' "${expected_paths[@]}")" ]]

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
  "$user@$host" "bash -s -- '$DEPLOYED_SHA'" <<'REMOTE'
set -euo pipefail
deployed_sha="$1"
[[ "$deployed_sha" =~ ^[0-9a-f]{40}$ ]]
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
[[ "$api_revision" == "$deployed_sha" && "$web_revision" == "$deployed_sha" ]]

docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { Prisma, PrismaClient } = require('@prisma/client');

const clean = (value, fallback = 'NONE') => {
  const normalized = String(value ?? fallback)
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .slice(0, 64);
  return normalized || fallback;
};

const readinessTuple = (row) => [
  Number(row.assignment_ready_count),
  Number(row.active_identity_ready_count),
  Number(row.membership_ready_count),
  Number(row.password_ready_count),
  Number(row.mfa_enrolled_ready_count),
  Number(row.login_ready_count),
];

(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('P0_REVIEWER_DIAG_STAFF_DB_URL_MISSING');
    process.exitCode = 61;
    return;
  }

  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let diagnostic = {
    outcome: 'NONE',
    prismaCode: 'NONE',
    sqlState: 'NONE',
    constraint: 'NONE',
    metaKeys: 'NONE',
  };

  try {
    const readReadiness = async () => {
      const rows = await db.$queryRawUnsafe(`
        SELECT assignment_ready_count,
               active_identity_ready_count,
               membership_ready_count,
               password_ready_count,
               mfa_enrolled_ready_count,
               login_ready_count
        FROM auth.staff_reviewer_login_readiness()
      `);
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw Object.assign(new Error('READINESS_CARDINALITY'), { code: 'READINESS_CARDINALITY' });
      }
      const tuple = readinessTuple(rows[0]);
      if (tuple.some((value) => !Number.isInteger(value) || value < 0)) {
        throw Object.assign(new Error('READINESS_VALUES'), { code: 'READINESS_VALUES' });
      }
      return tuple;
    };

    const before = await readReadiness();

    try {
      await db.$transaction(
        async (tx) => {
          try {
            const rows = await tx.$queryRawUnsafe(`
              SELECT result_code,
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
            `);
            diagnostic = {
              outcome: Array.isArray(rows) && rows.length === 1
                ? `FUNCTION_COMPLETED_${clean(rows[0].result_code)}`
                : 'FUNCTION_COMPLETED_INVALID_CARDINALITY',
              prismaCode: 'NONE',
              sqlState: 'NONE',
              constraint: 'NONE',
              metaKeys: 'NONE',
            };
          } catch (error) {
            const meta = error && typeof error === 'object' && error.meta && typeof error.meta === 'object'
              ? error.meta
              : {};
            diagnostic = {
              outcome: 'FUNCTION_ERROR',
              prismaCode: clean(error && typeof error === 'object' ? error.code : 'UNKNOWN', 'UNKNOWN'),
              sqlState: clean(meta.code || meta.sqlstate || meta.sqlState || 'UNKNOWN', 'UNKNOWN'),
              constraint: clean(meta.constraint || meta.constraint_name || 'NONE', 'NONE'),
              metaKeys: clean(Object.keys(meta).sort().join('.') || 'NONE', 'NONE'),
            };
          }

          throw Object.assign(new Error('P0_REVIEWER_ROLLBACK_ONLY'), {
            code: 'P0_REVIEWER_ROLLBACK_ONLY',
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 30_000,
        },
      );
      console.error('P0_REVIEWER_DIAG_ROLLBACK_SENTINEL_NOT_RAISED');
      process.exitCode = 62;
      return;
    } catch (error) {
      if (!error || typeof error !== 'object' || error.code !== 'P0_REVIEWER_ROLLBACK_ONLY') {
        console.error(`P0_REVIEWER_DIAG_TRANSACTION_ERROR|${clean(error && typeof error === 'object' ? error.code : 'UNKNOWN', 'UNKNOWN')}`);
        process.exitCode = 63;
        return;
      }
    }

    const after = await readReadiness();
    if (before.join('|') !== after.join('|')) {
      console.error('P0_REVIEWER_DIAG_ROLLBACK_PROOF_FAILED');
      process.exitCode = 64;
      return;
    }

    console.log(
      `REVIEWER_REPAIR_DIAGNOSTIC|${diagnostic.outcome}`
      + `|${diagnostic.prismaCode}|${diagnostic.sqlState}|${diagnostic.constraint}`
      + `|${diagnostic.metaKeys}|${before.join('|')}|${after.join('|')}`,
    );
    console.log('PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE');
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(`P0_REVIEWER_DIAG_FATAL|${clean(error && typeof error === 'object' ? error.code : 'UNKNOWN', 'UNKNOWN')}`);
  process.exitCode = 65;
});
NODE
REMOTE
)"

marker="$(grep '^REVIEWER_REPAIR_DIAGNOSTIC|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=ROLLBACK_ONLY_NONE_DURABLE' ]]
IFS='|' read -r tag outcome prisma_code sql_state constraint meta_keys \
  before_assignments before_identities before_memberships before_passwords before_mfa before_login \
  after_assignments after_identities after_memberships after_passwords after_mfa after_login <<< "$marker"
[[ "$tag" == 'REVIEWER_REPAIR_DIAGNOSTIC' ]]
for value in "$outcome" "$prisma_code" "$sql_state" "$constraint" "$meta_keys"; do
  [[ "$value" =~ ^[A-Za-z0-9_.-]{1,64}$ ]]
done
for count in \
  "$before_assignments" "$before_identities" "$before_memberships" "$before_passwords" "$before_mfa" "$before_login" \
  "$after_assignments" "$after_identities" "$after_memberships" "$after_passwords" "$after_mfa" "$after_login"; do
  [[ "$count" =~ ^[0-9]+$ ]]
done
[[ "$before_assignments|$before_identities|$before_memberships|$before_passwords|$before_mfa|$before_login" == \
   "$after_assignments|$after_identities|$after_memberships|$after_passwords|$after_mfa|$after_login" ]]

guard_main

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer repair rollback diagnostic

- command: \`$COMMAND\`
- exact diagnostic main: \`$TARGET_SHA\`
- exact deployed revision: \`$DEPLOYED_SHA\`
- result: \`PASS\`
- function outcome: \`$outcome\`
- Prisma code: \`$prisma_code\`
- SQLSTATE: \`$sql_state\`
- constraint: \`$constraint\`
- safe metadata keys: \`$meta_keys\`
- reviewer readiness before: \`$before_assignments/$before_identities/$before_memberships/$before_passwords/$before_mfa/$before_login\`
- reviewer readiness after rollback: \`$after_assignments/$after_identities/$after_memberships/$after_passwords/$after_mfa/$after_login\`
- production mutation: \`ROLLBACK_ONLY_NONE_DURABLE\`
- next: \`IMPLEMENT_NARROW_REPAIR_CORRECTION_3799\`" >/dev/null
result_published=1
