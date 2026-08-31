#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LEGACY_RELEASE_ISSUE_NUMBER='3072'
CONTINUATION_ISSUE_NUMBER='4637'
: "${PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER:?PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER is required}"
RELEASE_ISSUE_NUMBER="$PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER"
[[ "$RELEASE_ISSUE_NUMBER" == "$LEGACY_RELEASE_ISSUE_NUMBER" \
  || "$RELEASE_ISSUE_NUMBER" == "$CONTINUATION_ISSUE_NUMBER" ]]
COMMAND='/production p0-reviewer-inspect current-main'

# Fixed, read-only diagnostic target from the exact failed 9-role run. The
# classifier reads only the bounded historical Docker log window and publishes
# allowlisted classes; it never replays the join decision or emits raw logs.
JOIN_DIAG_SOURCE_RUN_ID='33155036583-1'
JOIN_DIAG_SOURCE_REVISION='0069e8bdc741d0c955823b14ad629513570a7bb7'
JOIN_DIAG_SINCE='2026-08-28T08:45:05Z'
JOIN_DIAG_UNTIL='2026-08-28T08:45:45Z'
JOIN_DIAG_CORRELATION='p0-all-role-employee-join:0069e8bdc741:33155036583-1'

key_path="$RUNNER_TEMP/pc-p0-reviewer-inspect-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-inspect-known-hosts"
result_published=0
TARGET_SHA='unknown'
join_diag_class='NOT_RUN'
join_diag_basis='NONE'
join_diag_http='UNKNOWN'
join_diag_code='UNKNOWN'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer login-readiness inspect

- immutable release candidate: \`$TARGET_SHA\`
- result: \`FAIL\`
- production mutation: \`NONE\`
- blocker: \`REVIEWER_INSPECT_FAILED_CLOSED\`
- employee join source run: \`$JOIN_DIAG_SOURCE_RUN_ID\`
- employee join safe classifier: \`$join_diag_class\`
- employee join classifier basis: \`$join_diag_basis\`
- employee join safe HTTP class: \`$join_diag_http\`
- employee join safe application code: \`$join_diag_code\`
- raw production logs published: \`0\`
- employee join replay: \`NONE\`
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

assert_release_candidate() {
  local current_main
  git fetch --no-tags origin main >/dev/null
  current_main="$(git rev-parse origin/main)"
  [[ "$current_main" == "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" ]]
  git cat-file -e "${TARGET_SHA}^{commit}"
  git merge-base --is-ancestor "$TARGET_SHA" "$current_main"
}

TARGET_SHA="${PC_P0_TARGET_SHA:-$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)}"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
assert_release_candidate

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

assert_release_candidate

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

assert_release_candidate
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" 'set -euo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' \
  >/dev/null

# Diagnose the already-failed employee decision before any current-revision
# readiness assertion. This remains useful even if unrelated main changes have
# advanced since the source run. Raw log bytes never leave the remote shell.
set +e
join_diag_output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$user@$host" "bash -s -- '$JOIN_DIAG_SOURCE_REVISION' '$JOIN_DIAG_SINCE' '$JOIN_DIAG_UNTIL' '$JOIN_DIAG_CORRELATION'" 2>/dev/null <<'REMOTE_DIAG'
set -euo pipefail
revision="$1"
since="$2"
until="$3"
correlation="$4"
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
[[ "$revision" == '0069e8bdc741d0c955823b14ad629513570a7bb7' ]]
[[ "$since" == '2026-08-28T08:45:05Z' ]]
[[ "$until" == '2026-08-28T08:45:45Z' ]]
[[ "$correlation" == 'p0-all-role-employee-join:0069e8bdc741:33155036583-1' ]]

collect_service_logs() {
  local service="$1" id current_revision chunk aggregate=''
  mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.service=$service")
  (( ${#ids[@]} >= 1 && ${#ids[@]} <= 32 )) || return 2
  matched=0
  for id in "${ids[@]}"; do
    current_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)"
    [[ "$current_revision" != "$revision" ]] || {
      matched=$((matched + 1))
      chunk="$(docker logs --since "$since" --until "$until" "$id" 2>&1 || true)"
      aggregate+="${aggregate:+$'\n'}$chunk"
    }
  done
  (( matched >= 1 && matched <= 8 )) || return 3
  printf '%s' "$aggregate"
}

api_logs="$(collect_service_logs api)" || api_logs=''
web_logs="$(collect_service_logs web)" || web_logs=''
combined="${api_logs}${api_logs:+$'\n'}${web_logs}"

safe_class='NO_SAFE_LOG_MATCH'
basis='NONE'
http_class='UNKNOWN'
app_code='UNKNOWN'

if grep -Fq "$correlation" <<< "$combined"; then
  basis='CORRELATION_BOUND'
elif [[ -n "$combined" ]]; then
  basis='FIXED_TIME_WINDOW'
fi

# Prefer explicit Web transport markers when they are present.
if grep -Fq 'organization_join_decision_upstream_failure' <<< "$web_logs"; then
  if grep -Fq 'UPSTREAM_TIMEOUT' <<< "$web_logs"; then
    safe_class='WEB_UPSTREAM_TIMEOUT'
    app_code='JOIN_REQUEST_SERVICE_UNAVAILABLE'
    http_class='503'
  elif grep -Fq 'UPSTREAM_TRANSPORT' <<< "$web_logs"; then
    safe_class='WEB_UPSTREAM_TRANSPORT'
    app_code='JOIN_REQUEST_SERVICE_UNAVAILABLE'
    http_class='503'
  fi
fi

# API/Prisma classes. These are allowlisted labels only; no raw error text is
# copied out of the container.
if [[ "$safe_class" == 'NO_SAFE_LOG_MATCH' ]]; then
  if grep -Eqi 'P2028|Transaction API error|expired transaction|transaction[^[:alnum:]]+timeout|timeout[^[:alnum:]]+15000' <<< "$api_logs"; then
    safe_class='API_PRISMA_TRANSACTION_ENVELOPE_TIMEOUT'
  elif grep -Eqi 'P2024|Timed out fetching a new connection|connection pool[^[:alnum:]]+timeout' <<< "$api_logs"; then
    safe_class='API_PRISMA_POOL_TIMEOUT'
  elif grep -Eqi 'P2034|SQLSTATE[^0-9A-Z]*40001|serialization failure|deadlock detected' <<< "$api_logs"; then
    safe_class='API_SERIALIZATION_OR_DEADLOCK'
  elif grep -Eqi 'SQLSTATE[^0-9A-Z]*42501|permission denied' <<< "$api_logs"; then
    safe_class='API_DB_PRIVILEGE_DENIED'
  elif grep -Eqi 'SQLSTATE[^0-9A-Z]*57014|canceling statement due to statement timeout' <<< "$api_logs"; then
    safe_class='API_STATEMENT_TIMEOUT'
  fi
fi

# Safe application error-code allowlist. The first exact match is enough to
# distinguish authorization/state failures without publishing a response body.
for code in \
  FRESH_MFA_REQUIRED \
  ORGANIZATION_ADMIN_REQUIRED \
  REGISTRATION_APPLICATION_NOT_FOUND \
  REGISTRATION_STATE_CONFLICT \
  ORGANIZATION_NOT_ELIGIBLE_FOR_JOIN \
  ROLE_PERMISSION_CEILING_EXCEEDED \
  REGISTRATION_IDENTITY_TRANSITION_CONFLICT \
  REGISTRATION_VERSION_CONFLICT \
  REGISTRATION_LIFECYCLE_RECEIPT_MISSING \
  JOIN_REQUEST_SERVICE_UNAVAILABLE; do
  if grep -Fq "$code" <<< "$combined"; then
    app_code="$code"
    [[ "$safe_class" != 'NO_SAFE_LOG_MATCH' ]] || safe_class="APP_${code}"
    break
  fi
done

# Correlation-bound structured access logs may expose only the numeric status.
if [[ "$basis" == 'CORRELATION_BOUND' ]]; then
  for status in 403 409 429 500 503; do
    if grep -E "$correlation.*(status|statusCode)[^0-9]{0,8}$status([^0-9]|$)" <<< "$combined" >/dev/null 2>&1; then
      http_class="$status"
      break
    fi
  done
fi

# Never publish a speculative single cause when several conflicting low-level
# classes are visible in the same fixed window without correlation binding.
low_level_count=0
for pattern in \
  'P2028|Transaction API error|expired transaction|transaction[^[:alnum:]]+timeout|timeout[^[:alnum:]]+15000' \
  'P2024|Timed out fetching a new connection|connection pool[^[:alnum:]]+timeout' \
  'P2034|SQLSTATE[^0-9A-Z]*40001|serialization failure|deadlock detected' \
  'SQLSTATE[^0-9A-Z]*42501|permission denied' \
  'SQLSTATE[^0-9A-Z]*57014|canceling statement due to statement timeout'; do
  grep -Eqi "$pattern" <<< "$api_logs" && low_level_count=$((low_level_count + 1))
done
if [[ "$basis" == 'FIXED_TIME_WINDOW' && "$low_level_count" -gt 1 ]]; then
  safe_class='AMBIGUOUS_MULTIPLE_API_CLASSES'
  http_class='UNKNOWN'
  app_code='UNKNOWN'
fi

printf 'EMPLOYEE_JOIN_DIAG|%s|%s|%s|%s\n' "$safe_class" "$basis" "$http_class" "$app_code"
printf 'PRODUCTION_MUTATION=NONE\n'
unset api_logs web_logs combined
REMOTE_DIAG
)"
join_diag_rc=$?
set -e
if [[ "$join_diag_rc" == 0 ]]; then
  join_diag_marker="$(grep '^EMPLOYEE_JOIN_DIAG|' <<< "$join_diag_output" | tail -n1)"
  join_diag_mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$join_diag_output" | tail -n1)"
  if [[ "$join_diag_mutation" == 'PRODUCTION_MUTATION=NONE' ]]; then
    IFS='|' read -r join_diag_tag join_diag_class join_diag_basis join_diag_http join_diag_code <<< "$join_diag_marker"
    [[ "$join_diag_tag" == 'EMPLOYEE_JOIN_DIAG' ]] || join_diag_class='DIAGNOSTIC_OUTPUT_INVALID'
    [[ "$join_diag_class" =~ ^[A-Z0-9_]{3,96}$ ]] || join_diag_class='DIAGNOSTIC_OUTPUT_INVALID'
    [[ "$join_diag_basis" =~ ^[A-Z0-9_]{3,32}$ ]] || join_diag_basis='NONE'
    [[ "$join_diag_http" =~ ^(UNKNOWN|[45][0-9]{2})$ ]] || join_diag_http='UNKNOWN'
    [[ "$join_diag_code" =~ ^[A-Z0-9_]{3,96}$ ]] || join_diag_code='UNKNOWN'
  else
    join_diag_class='DIAGNOSTIC_MUTATION_ASSERTION_MISSING'
  fi
else
  join_diag_class='DIAGNOSTIC_SOURCE_LOGS_UNAVAILABLE'
fi
unset join_diag_output join_diag_marker join_diag_mutation

assert_release_candidate

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
mapfile -t worker_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$project" \
  --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#worker_ids[@]} == 1 ))
worker_id="${worker_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id")"
[[ "$api_revision" == "$target_sha" && "$web_revision" == "$target_sha" && "$worker_revision" == "$target_sha" ]]
worker_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$worker_id")"
[[ "$worker_health" == healthy ]]
docker exec "$worker_id" /nodejs/bin/node -e \
  "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok)process.exit(1);const x=await r.json();if(x.status!=='ready'||x.component!=='auth-mail-worker'||x.checks?.database!==true)process.exit(1)}).catch(()=>process.exit(1))"

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
             ), false) AS reviewer_readiness_execute,
             coalesce(has_function_privilege(
               current_user,
               to_regprocedure('auth.staff_reviewer_credential_format_ready(text)'),
               'EXECUTE'
             ), false) AS reviewer_credential_format_execute
      FROM pg_roles
      WHERE rolname = current_user
    `);
    const principal = principals[0];
    if (!principal || principal.user_name !== 'pc_staff_runtime'
        || principal.rolsuper || principal.rolbypassrls
        || principal.can_read_deals || principal.can_read_users
        || principal.can_read_memberships || principal.can_read_organizations
        || principal.can_read_credentials || principal.can_read_assignments
        || !principal.reviewer_preflight_execute || !principal.reviewer_readiness_execute
        || !principal.reviewer_credential_format_execute) {
      console.error('P0_STAFF_PRINCIPAL_BOUNDARY_INVALID');
      process.exitCode = 32;
      return;
    }

    const formatRows = await db.$queryRawUnsafe(`
      SELECT
        auth.staff_reviewer_credential_format_ready(
          '$2b$12$' || repeat('A', 53)
        ) AS bcrypt_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=8,p=1$'
          || repeat('A', 22) || '$' || repeat('B', 42) || 'A'
        ) AS scrypt_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=65536,r=8,p=1$'
          || repeat('A', 22) || '$' || repeat('B', 42) || 'A'
        ) AS stale_scrypt_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=8,p=1$'
          || repeat('A', 21) || 'B$' || repeat('B', 42) || 'A'
        ) AS noncanonical_salt_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=8,p=1$'
          || repeat('A', 22) || '$' || repeat('B', 43)
        ) AS noncanonical_key_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=2$n=131072,r=8,p=1$'
          || repeat('A', 22) || '$' || repeat('B', 42) || 'A'
        ) AS wrong_version_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=16,p=1$'
          || repeat('A', 22) || '$' || repeat('B', 42) || 'A'
        ) AS wrong_r_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=8,p=2$'
          || repeat('A', 22) || '$' || repeat('B', 42) || 'A'
        ) AS wrong_p_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=8,p=1$'
          || repeat('A', 21) || '$' || repeat('B', 42) || 'A'
        ) AS short_salt_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=8,p=1$'
          || repeat('A', 22) || '$' || repeat('B', 43) || 'A'
        ) AS long_key_ready,
        auth.staff_reviewer_credential_format_ready(
          '$scrypt$v=1$n=131072,r=8,p=1$'
          || repeat('A', 20) || '!A$' || repeat('B', 42) || 'A'
        ) AS invalid_alphabet_ready,
        auth.staff_reviewer_credential_format_ready('malformed') AS malformed_ready,
        auth.staff_reviewer_credential_format_ready(NULL) AS null_ready,
        (
          SELECT function.prosrc
          FROM pg_catalog.pg_proc function
          WHERE function.oid = to_regprocedure(
            'auth.staff_reviewer_credential_format_ready(text)'
          )
        ) AS format_source
    `);
    const format = formatRows[0];
    const expectedFormatSource = [
      'SELECT',
      "candidate ~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'",
      "OR candidate ~ '^\\$scrypt\\$v=1\\$n=131072,r=8,p=1\\$[A-Za-z0-9_-]{21}[AQgw]\\$[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'",
    ].join(' ');
    const formatSource = String(format?.format_source ?? '').trim().replace(/\s+/g, ' ');
    if (formatRows.length !== 1 || format?.bcrypt_ready !== true
        || format?.scrypt_ready !== true || format?.stale_scrypt_ready !== false
        || format?.noncanonical_salt_ready !== false
        || format?.noncanonical_key_ready !== false
        || format?.wrong_version_ready !== false || format?.wrong_r_ready !== false
        || format?.wrong_p_ready !== false || format?.short_salt_ready !== false
        || format?.long_key_ready !== false || format?.invalid_alphabet_ready !== false
        || format?.malformed_ready !== false || format?.null_ready !== null
        || formatSource !== expectedFormatSource) {
      console.error('P0_REVIEWER_CREDENTIAL_FORMAT_CONTRACT_INVALID');
      process.exitCode = 37;
      return;
    }
    console.log('REVIEWER_CREDENTIAL_FORMAT|V2_BCRYPT_OR_SCRYPT_131072_R8_P1|PASS');

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
credential_format="$(grep '^REVIEWER_CREDENTIAL_FORMAT|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
[[ "$credential_format" == 'REVIEWER_CREDENTIAL_FORMAT|V2_BCRYPT_OR_SCRYPT_131072_R8_P1|PASS' ]]
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

assert_release_candidate
(( login > 0 )) || {
  echo P0_REVIEWER_LOGIN_NOT_READY >&2
  exit 36
}
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
- immutable release candidate: \`$TARGET_SHA\`
- result: \`PASS\`
- staff principal: \`$principal\`
- active PLATFORM_OWNER assignments: \`$owners\`
- usable registration-reviewer assignments: \`$reviewers\`
- active reviewer identities: \`$identities / $assignments\`
- reviewer memberships in VERIFIED organizations: \`$memberships / $assignments\`
- reviewer password credentials ready: \`$passwords / $assignments\`
- reviewer TOTP enrollments ready: \`$mfa / $assignments\`
- structurally login-ready and unlocked reviewers: \`$login / $assignments\`
- employee join source run: \`$JOIN_DIAG_SOURCE_RUN_ID\`
- employee join safe classifier: \`$join_diag_class\`
- employee join classifier basis: \`$join_diag_basis\`
- employee join safe HTTP class: \`$join_diag_http\`
- employee join safe application code: \`$join_diag_code\`
- raw production logs published: \`0\`
- employee join replay: \`NONE\`
- production mutation: \`NONE\`
- next: \`$next\`" >/dev/null
result_published=1
printf 'P0_REVIEWER_READINESS=PASS\n'
printf 'P0_REVIEWER_RELEASE_CANDIDATE=%s\n' "$TARGET_SHA"
printf 'P0_REVIEWER_AUTH_MAIL_WORKER=EXACT_READY\n'
