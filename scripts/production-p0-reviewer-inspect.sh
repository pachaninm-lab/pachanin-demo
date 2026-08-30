#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
CONTINUATION_ISSUE_NUMBER='4637'
: "${PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER:?PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER is required}"
RELEASE_ISSUE_NUMBER="$PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER"
[[ "$RELEASE_ISSUE_NUMBER" == "$CONTINUATION_ISSUE_NUMBER" ]]
COMMAND='/production p0-employee-join-inspect 33293760567-1 9639a2a3d06f0aa3b38187bc22891450468115c0'

# Immutable read-only target from the exact failed current 9-role run. Log
# evidence and the AUTH datasource capability proof are deliberately separate:
# a historical fixed-window log class is never treated as a live privilege
# proof. Neither path replays a decision or emits raw logs, URLs or principals.
JOIN_DIAG_SOURCE_RUN_ID='33293760567-1'
JOIN_DIAG_SOURCE_REVISION='9639a2a3d06f0aa3b38187bc22891450468115c0'
JOIN_DIAG_SINCE='2026-08-30T05:11:10Z'
JOIN_DIAG_UNTIL='2026-08-30T05:11:25Z'
REGISTER_CORRELATION='p0-all-role-register:9639a2a3d06f:33293760567-1:employee'
DECISION_CORRELATION='p0-all-role-employee-join:9639a2a3d06f:33293760567-1'
DECISION_EVENT_KEY='org-join-decision:p0-all-role-employee-join:9639a2a3d06f0aa3b38187bc22891450468115c0:33293760567-1'
DECISION_APPROVED_EVENT_KEY='org-join-decision:p0-all-role-employee-join:9639a2a3d06f0aa3b38187bc22891450468115c0:33293760567-1:approved'

key_path="$RUNNER_TEMP/pc-p0-reviewer-inspect-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-inspect-known-hosts"
result_published=0
TARGET_SHA='unknown'
join_log_native_class='NOT_RUN'
join_diag_basis='NONE'
join_diag_http='UNKNOWN'
join_log_business_class='UNKNOWN'
join_log_prisma='UNKNOWN'
join_log_sqlstate='UNKNOWN'
join_log_stage='UNKNOWN'
auth_privilege_class='NOT_RUN'
auth_role_can_login='U'
auth_role_confined='U'
auth_selector_match='U'
auth_app_org_select='U'
auth_event_new_status_select='U'
auth_application_select_vector='U'
auth_application_update_vector='U'
auth_event_select_vector='U'
auth_event_insert_vector='U'
auth_forbidden_dml='U'
auth_state_class='NOT_RUN'
auth_state_prisma='UNKNOWN'
auth_state_sqlstate='UNKNOWN'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 employee join diagnostic

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- source run: \`$JOIN_DIAG_SOURCE_RUN_ID\`
- source API revision: \`$JOIN_DIAG_SOURCE_REVISION\`
- result: \`FAIL\`
- production mutation: \`NONE\`
- blocker: \`EMPLOYEE_JOIN_INSPECT_FAILED_CLOSED\`
- historical log native class: \`$join_log_native_class\`
- historical log binding: \`$join_diag_basis\`
- historical HTTP class: \`$join_diag_http\`
- historical business class: \`$join_log_business_class\`
- historical Prisma class: \`$join_log_prisma\`
- historical SQLSTATE class: \`$join_log_sqlstate\`
- historical stage class: \`$join_log_stage\`
- AUTH privilege class: \`$auth_privilege_class\`
- AUTH application.organization_id SELECT: \`$auth_app_org_select\`
- AUTH event.new_status SELECT: \`$auth_event_new_status_select\`
- AUTH exact-run state: \`$auth_state_class\`
- AUTH state Prisma class: \`$auth_state_prisma\`
- AUTH state SQLSTATE class: \`$auth_state_sqlstate\`
- raw production logs published: \`0\`
- raw identifiers, principals, URLs or error messages published: \`0\`
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

# Classify only the immutable historical window. Raw log bytes never leave the
# remote shell, and a fixed-window signal is labelled ambiguous unless an exact
# registration or decision correlation is also present.
set +e
join_diag_output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$user@$host" "bash -s -- '$JOIN_DIAG_SOURCE_REVISION' '$JOIN_DIAG_SINCE' '$JOIN_DIAG_UNTIL' '$REGISTER_CORRELATION' '$DECISION_CORRELATION'" 2>/dev/null <<'REMOTE_DIAG'
set -euo pipefail
revision="$1"
since="$2"
until="$3"
register_correlation="$4"
decision_correlation="$5"
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1
[[ "$revision" == '9639a2a3d06f0aa3b38187bc22891450468115c0' ]]
[[ "$since" == '2026-08-30T05:11:10Z' ]]
[[ "$until" == '2026-08-30T05:11:25Z' ]]
[[ "$register_correlation" == 'p0-all-role-register:9639a2a3d06f:33293760567-1:employee' ]]
[[ "$decision_correlation" == 'p0-all-role-employee-join:9639a2a3d06f:33293760567-1' ]]

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

native_class='NO_SAFE_LOG_MATCH'
basis='NONE'
http_class='UNKNOWN'
business_class='UNKNOWN'
prisma_class='UNKNOWN'
sqlstate_class='UNKNOWN'
stage_class='UNKNOWN'

if grep -Fq "$decision_correlation" <<< "$combined"; then
  basis='DECISION_CORRELATION_BOUND'
elif grep -Fq "$register_correlation" <<< "$combined"; then
  basis='REGISTER_CORRELATION_BOUND'
elif [[ -n "$combined" ]]; then
  basis='FIXED_TIME_WINDOW'
fi

# Native Prisma, SQLSTATE and stage dimensions remain separate from business
# application codes. All values below are closed allowlists.
for code in P2010 P2024 P2028 P2034; do
  if grep -Eq "(^|[^A-Z0-9])$code([^A-Z0-9]|$)" <<< "$api_logs"; then
    prisma_class="$code"
    break
  fi
done
for code in 42501 40001 57014; do
  if grep -Eqi "SQLSTATE[^0-9A-Z]*$code([^0-9]|$)|(^|[^0-9])$code([^0-9]|$)" <<< "$api_logs"; then
    sqlstate_class="$code"
    break
  fi
done
for stage in STATE_QUERY DECISION_TRANSACTION IDENTITY_TRANSITION LIFECYCLE_RECEIPT; do
  if grep -Eq "(^|[^A-Z0-9_])$stage([^A-Z0-9_]|$)" <<< "$combined"; then
    stage_class="$stage"
    break
  fi
done

# Prefer explicit Web transport markers when present, but keep the associated
# business code out of the native database classification.
if grep -Fq 'organization_join_decision_upstream_failure' <<< "$web_logs"; then
  if grep -Fq 'UPSTREAM_TIMEOUT' <<< "$web_logs"; then
    native_class='WEB_UPSTREAM_TIMEOUT'
    business_class='JOIN_REQUEST_SERVICE_UNAVAILABLE'
    http_class='503'
  elif grep -Fq 'UPSTREAM_TRANSPORT' <<< "$web_logs"; then
    native_class='WEB_UPSTREAM_TRANSPORT'
    business_class='JOIN_REQUEST_SERVICE_UNAVAILABLE'
    http_class='503'
  fi
fi

# A fixed-window permission phrase alone is never emitted as proof. Exact
# native codes may be classified only with their binding strength preserved.
if [[ "$native_class" == 'NO_SAFE_LOG_MATCH' ]]; then
  if [[ "$prisma_class" == 'P2010' && "$sqlstate_class" == '42501' ]]; then
    if [[ "$basis" == 'DECISION_CORRELATION_BOUND' || "$basis" == 'REGISTER_CORRELATION_BOUND' ]]; then
      native_class='API_PRISMA_P2010_SQLSTATE_42501'
    else
      native_class='AMBIGUOUS_FIXED_WINDOW_QUERY_PRIVILEGE_SIGNAL'
    fi
  elif [[ "$prisma_class" == 'P2028' ]]; then
    native_class='API_PRISMA_TRANSACTION_ENVELOPE_TIMEOUT'
  elif [[ "$prisma_class" == 'P2024' ]]; then
    native_class='API_PRISMA_POOL_TIMEOUT'
  elif [[ "$prisma_class" == 'P2034' || "$sqlstate_class" == '40001' ]]; then
    native_class='API_SERIALIZATION_OR_DEADLOCK'
  elif [[ "$sqlstate_class" == '57014' ]]; then
    native_class='API_STATEMENT_TIMEOUT'
  elif grep -Eqi 'permission denied' <<< "$api_logs"; then
    native_class='AMBIGUOUS_PERMISSION_TEXT_ONLY'
  fi
fi

# Business error-code allowlist. This dimension must not be inferred from a
# native Prisma/SQLSTATE match.
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
    business_class="$code"
    break
  fi
done
if [[ "$basis" == 'FIXED_TIME_WINDOW' && "$business_class" != 'UNKNOWN' ]]; then
  business_class='AMBIGUOUS_FIXED_WINDOW_BUSINESS_SIGNAL'
fi

# Correlation-bound structured access logs may expose only the numeric status.
if [[ "$basis" == 'DECISION_CORRELATION_BOUND' || "$basis" == 'REGISTER_CORRELATION_BOUND' ]]; then
  for status in 403 409 429 500 503; do
    if grep -E "($decision_correlation|$register_correlation).*(status|statusCode)[^0-9]{0,8}$status([^0-9]|$)" <<< "$combined" >/dev/null 2>&1; then
      http_class="$status"
      break
    fi
  done
fi

# Conflicting native classes within an unbound fixed window remain ambiguous.
low_level_count=0
for pattern in \
  'P2028' \
  'P2024' \
  'P2034|40001' \
  'P2010|42501|permission denied' \
  '57014'; do
  grep -Eqi "$pattern" <<< "$api_logs" && low_level_count=$((low_level_count + 1))
done
if [[ "$basis" == 'FIXED_TIME_WINDOW' && "$low_level_count" -gt 1 ]]; then
  native_class='AMBIGUOUS_MULTIPLE_NATIVE_CLASSES'
  http_class='UNKNOWN'
fi

printf 'EMPLOYEE_JOIN_LOG|%s|%s|%s|%s|%s|%s|%s\n' \
  "$native_class" "$basis" "$http_class" "$business_class" \
  "$prisma_class" "$sqlstate_class" "$stage_class"
printf 'PRODUCTION_MUTATION=NONE\n'
unset api_logs web_logs combined
REMOTE_DIAG
)"
join_diag_rc=$?
set -e
if [[ "$join_diag_rc" == 0 ]]; then
  join_diag_marker="$(grep '^EMPLOYEE_JOIN_LOG|' <<< "$join_diag_output" | tail -n1)"
  join_diag_mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$join_diag_output" | tail -n1)"
  if [[ "$join_diag_mutation" == 'PRODUCTION_MUTATION=NONE' ]]; then
    IFS='|' read -r join_diag_tag join_log_native_class join_diag_basis join_diag_http \
      join_log_business_class join_log_prisma join_log_sqlstate join_log_stage <<< "$join_diag_marker"
    [[ "$join_diag_tag" == 'EMPLOYEE_JOIN_LOG' ]] || join_log_native_class='DIAGNOSTIC_OUTPUT_INVALID'
    [[ "$join_log_native_class" =~ ^[A-Z0-9_]{3,96}$ ]] || join_log_native_class='DIAGNOSTIC_OUTPUT_INVALID'
    [[ "$join_diag_basis" =~ ^[A-Z0-9_]{3,32}$ ]] || join_diag_basis='NONE'
    [[ "$join_diag_http" =~ ^(UNKNOWN|[45][0-9]{2})$ ]] || join_diag_http='UNKNOWN'
    [[ "$join_log_business_class" =~ ^[A-Z0-9_]{3,96}$ ]] || join_log_business_class='UNKNOWN'
    [[ "$join_log_prisma" =~ ^(UNKNOWN|P[0-9]{4})$ ]] || join_log_prisma='UNKNOWN'
    [[ "$join_log_sqlstate" =~ ^(UNKNOWN|[0-9A-Z]{5})$ ]] || join_log_sqlstate='UNKNOWN'
    [[ "$join_log_stage" =~ ^[A-Z0-9_]{3,64}$ ]] || join_log_stage='UNKNOWN'
  else
    join_log_native_class='DIAGNOSTIC_MUTATION_ASSERTION_MISSING'
  fi
else
  join_log_native_class='DIAGNOSTIC_SOURCE_LOGS_UNAVAILABLE'
fi
unset join_diag_output join_diag_marker join_diag_mutation

guard_main

output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$user@$host" "bash -s -- '$JOIN_DIAG_SOURCE_REVISION' '$REGISTER_CORRELATION' '$DECISION_CORRELATION' '$DECISION_EVENT_KEY' '$DECISION_APPROVED_EVENT_KEY'" <<'REMOTE'
set -euo pipefail
source_revision="$1"
register_correlation="$2"
decision_correlation="$3"
decision_event_key="$4"
decision_approved_event_key="$5"
[[ "$source_revision" == '9639a2a3d06f0aa3b38187bc22891450468115c0' ]]
[[ "$register_correlation" == 'p0-all-role-register:9639a2a3d06f:33293760567-1:employee' ]]
[[ "$decision_correlation" == 'p0-all-role-employee-join:9639a2a3d06f:33293760567-1' ]]
[[ "$decision_event_key" == 'org-join-decision:p0-all-role-employee-join:9639a2a3d06f0aa3b38187bc22891450468115c0:33293760567-1' ]]
[[ "$decision_approved_event_key" == 'org-join-decision:p0-all-role-employee-join:9639a2a3d06f0aa3b38187bc22891450468115c0:33293760567-1:approved' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null 2>&1

mapfile -t running_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#running_web_ids[@]} == 1 ))
live_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "${running_web_ids[0]}")"
[[ -n "$live_project" ]]
mapfile -t running_api_ids < <(docker ps -q \
  --filter "label=com.docker.compose.project=$live_project" \
  --filter 'label=com.docker.compose.service=api')
(( ${#running_api_ids[@]} >= 1 && ${#running_api_ids[@]} <= 8 ))
api_id=''
for candidate_id in "${running_api_ids[@]}"; do
  candidate_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$candidate_id" 2>/dev/null || true)"
  if [[ "$candidate_revision" == "$source_revision" ]]; then
    [[ -z "$api_id" ]]
    api_id="$candidate_id"
  fi
done
[[ -n "$api_id" ]]

docker exec -i \
  -e PC_DIAG_REGISTER_CORRELATION="$register_correlation" \
  -e PC_DIAG_DECISION_CORRELATION="$decision_correlation" \
  -e PC_DIAG_DECISION_EVENT_KEY="$decision_event_key" \
  -e PC_DIAG_DECISION_APPROVED_EVENT_KEY="$decision_approved_event_key" \
  "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');

const applicationSelectColumns = [
  'id', 'kind', 'user_id', 'organization_id', 'membership_id',
  'requested_workspace', 'requested_role', 'status', 'version', 'correlation_id',
  'email', 'decision_reason', 'decided_at',
];
const applicationUpdateColumns = [
  'status', 'decided_at', 'decision_reason', 'decision_actor_user_id', 'version', 'updated_at',
];
const eventSelectColumns = [
  'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',
  'reason', 'correlation_id', 'idempotency_key', 'application_version', 'metadata', 'created_at',
];
const eventInsertColumns = [
  'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',
  'reason', 'correlation_id', 'idempotency_key', 'application_version',
];
const knownPrismaCodes = new Set(['P2010', 'P2024', 'P2028', 'P2034']);
const knownSqlstates = new Set(['42501', '40001', '57014']);

const bit = (value) => value === true ? '1' : value === false ? '0' : 'U';
const vector = (rows, columns) => {
  const values = new Map(rows.map((row) => [String(row.column_name), row.allowed]));
  return columns.map((column) => bit(values.get(column))).join('');
};
const safePrismaCode = (error) => {
  const candidate = String(error && typeof error === 'object' && 'code' in error ? error.code : '');
  return knownPrismaCodes.has(candidate) ? candidate : 'UNKNOWN';
};
const safeSqlstate = (error) => {
  const candidates = [
    error && typeof error === 'object' && error.meta && error.meta.code,
    error && typeof error === 'object' && error.meta && error.meta.database_error
      && error.meta.database_error.code,
  ];
  for (const value of candidates) {
    const candidate = String(value || '').toUpperCase();
    if (knownSqlstates.has(candidate)) return candidate;
  }
  return 'UNKNOWN';
};
const parseDatabaseUser = (raw) => {
  const parsed = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.username) return '';
  return decodeURIComponent(parsed.username);
};
const integer = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) throw new Error('SAFE_COUNT_INVALID');
  return parsed;
};

(async () => {
  const authDatabaseUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
  const applicationDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!authDatabaseUrl || !applicationDatabaseUrl || authDatabaseUrl === applicationDatabaseUrl) {
    console.error('P0_AUTH_DATASOURCE_BOUNDARY_INVALID');
    process.exitCode = 31;
    return;
  }

  let authDatabaseUser;
  let applicationDatabaseUser;
  try {
    authDatabaseUser = parseDatabaseUser(authDatabaseUrl);
    applicationDatabaseUser = parseDatabaseUser(applicationDatabaseUrl);
  } catch {
    console.error('P0_AUTH_DATASOURCE_PARSE_INVALID');
    process.exitCode = 32;
    return;
  }
  if (!authDatabaseUser || !applicationDatabaseUser || authDatabaseUser === applicationDatabaseUser) {
    console.error('P0_AUTH_DATASOURCE_PRINCIPAL_NOT_DISTINCT');
    process.exitCode = 33;
    return;
  }

  const registerCorrelation = String(process.env.PC_DIAG_REGISTER_CORRELATION || '');
  const decisionCorrelation = String(process.env.PC_DIAG_DECISION_CORRELATION || '');
  const decisionEventKey = String(process.env.PC_DIAG_DECISION_EVENT_KEY || '');
  const decisionApprovedEventKey = String(process.env.PC_DIAG_DECISION_APPROVED_EVENT_KEY || '');
  if (registerCorrelation !== 'p0-all-role-register:9639a2a3d06f:33293760567-1:employee'
      || decisionCorrelation !== 'p0-all-role-employee-join:9639a2a3d06f:33293760567-1'
      || decisionEventKey !== 'org-join-decision:p0-all-role-employee-join:9639a2a3d06f0aa3b38187bc22891450468115c0:33293760567-1'
      || decisionApprovedEventKey !== 'org-join-decision:p0-all-role-employee-join:9639a2a3d06f0aa3b38187bc22891450468115c0:33293760567-1:approved') {
    console.error('P0_AUTH_EXACT_RUN_BINDING_INVALID');
    process.exitCode = 34;
    return;
  }

  // This client is intentionally and explicitly bound to AUTH_DATABASE_URL,
  // never to the general application DATABASE_URL.
  const db = new PrismaClient({ datasources: { db: { url: authDatabaseUrl } } });
  const inReadOnlyTransaction = (work) => db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const guards = await tx.$queryRawUnsafe(`
      SELECT
        current_setting('transaction_read_only') = 'on' AS transaction_read_only,
        current_user = session_user AS current_is_session_user
    `);
    const guard = guards[0];
    if (!guard || guard.transaction_read_only !== true || guard.current_is_session_user !== true) {
      throw Object.assign(new Error('READ_ONLY_GUARD_INVALID'), { code: 'DIAG_GUARD' });
    }
    const bindings = await tx.$queryRawUnsafe(
      'SELECT current_user = $1::text AS auth_user_bound',
      authDatabaseUser,
    );
    if (!bindings[0] || bindings[0].auth_user_bound !== true) {
      throw Object.assign(new Error('AUTH_USER_BINDING_INVALID'), { code: 'DIAG_GUARD' });
    }
    return work(tx);
  }, { timeout: 20_000, maxWait: 5_000 });

  try {
    const proof = await inReadOnlyTransaction(async (tx) => {
      const roles = await tx.$queryRawUnsafe(`
        SELECT
          role.rolcanlogin,
          NOT role.rolsuper
            AND NOT role.rolbypassrls
            AND NOT role.rolinherit
            AND NOT role.rolcreatedb
            AND NOT role.rolcreaterole
            AND NOT role.rolreplication
            AND NOT EXISTS (
              SELECT 1
              FROM pg_catalog.pg_auth_members membership
              WHERE membership.member = role.oid
            ) AS role_confined,
          role.rolcanlogin
            AND NOT role.rolsuper
            AND NOT role.rolbypassrls
            AND NOT role.rolcreatedb
            AND NOT role.rolcreaterole
            AND NOT role.rolreplication
            AND (
              role.rolname IN ('app_service', 'pc_auth_runtime', 'one_deal_auth', 'app_auth')
              OR (
                has_schema_privilege(role.rolname, 'auth', 'USAGE')
                AND has_function_privilege(
                  role.rolname,
                  'auth.resolve_login_credential(text)',
                  'EXECUTE'
                )
                AND has_function_privilege(
                  role.rolname,
                  'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
                  'EXECUTE'
                )
              )
            ) AS legacy_selector_match,
          has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_schema_usage,
          coalesce(has_function_privilege(
            current_user,
            to_regprocedure('auth.registration_organization_admin_context(text,text,text,text,text)'),
            'EXECUTE'
          ), false) AS organization_admin_context_execute,
          coalesce(has_function_privilege(
            current_user,
            to_regprocedure('auth.registration_organization_join_queue(text,text,text,text,text,integer)'),
            'EXECUTE'
          ), false) AS organization_join_queue_execute,
          coalesce(has_function_privilege(
            current_user,
            to_regprocedure('auth.lock_registration_decision_application(text,text,text,text,text,text,text)'),
            'EXECUTE'
          ), false) AS decision_lock_execute,
          coalesce(has_function_privilege(
            current_user,
            to_regprocedure('auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)'),
            'EXECUTE'
          ), false) AS identity_transition_execute,
          has_table_privilege(current_user, 'auth.registration_applications', 'DELETE')
            OR has_table_privilege(current_user, 'auth.registration_application_events', 'DELETE')
            OR has_any_column_privilege(
              current_user, 'auth.registration_application_events', 'UPDATE'
            )
            AS forbidden_dml
        FROM pg_catalog.pg_roles role
        WHERE role.rolname = current_user
      `);
      const role = roles[0];
      if (!role) throw Object.assign(new Error('AUTH_ROLE_MISSING'), { code: 'DIAG_GUARD' });

      const applicationSelect = await tx.$queryRawUnsafe(`
        SELECT column_name,
               has_column_privilege(
                 current_user, 'auth.registration_applications', column_name, 'SELECT'
               ) AS allowed
        FROM unnest(ARRAY[
          'id', 'kind', 'user_id', 'organization_id', 'membership_id',
          'requested_workspace', 'requested_role', 'status', 'version', 'correlation_id',
          'email', 'decision_reason', 'decided_at'
        ]::text[]) WITH ORDINALITY AS required(column_name, position)
        ORDER BY position
      `);
      const applicationUpdate = await tx.$queryRawUnsafe(`
        SELECT column_name,
               has_column_privilege(
                 current_user, 'auth.registration_applications', column_name, 'UPDATE'
               ) AS allowed
        FROM unnest(ARRAY[
          'status', 'decided_at', 'decision_reason', 'decision_actor_user_id', 'version', 'updated_at'
        ]::text[]) WITH ORDINALITY AS required(column_name, position)
        ORDER BY position
      `);
      const eventSelect = await tx.$queryRawUnsafe(`
        SELECT column_name,
               has_column_privilege(
                 current_user, 'auth.registration_application_events', column_name, 'SELECT'
               ) AS allowed
        FROM unnest(ARRAY[
          'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',
          'reason', 'correlation_id', 'idempotency_key', 'application_version', 'metadata', 'created_at'
        ]::text[]) WITH ORDINALITY AS required(column_name, position)
        ORDER BY position
      `);
      const eventInsert = await tx.$queryRawUnsafe(`
        SELECT column_name,
               has_column_privilege(
                 current_user, 'auth.registration_application_events', column_name, 'INSERT'
               ) AS allowed
        FROM unnest(ARRAY[
          'id', 'application_id', 'actor_user_id', 'actor_kind', 'previous_status', 'new_status',
          'reason', 'correlation_id', 'idempotency_key', 'application_version'
        ]::text[]) WITH ORDINALITY AS required(column_name, position)
        ORDER BY position
      `);
      return { role, applicationSelect, applicationUpdate, eventSelect, eventInsert };
    });

    const applicationSelectVector = vector(proof.applicationSelect, applicationSelectColumns);
    const applicationUpdateVector = vector(proof.applicationUpdate, applicationUpdateColumns);
    const eventSelectVector = vector(proof.eventSelect, eventSelectColumns);
    const eventInsertVector = vector(proof.eventInsert, eventInsertColumns);
    const applicationSelectMap = new Map(
      proof.applicationSelect.map((row) => [String(row.column_name), bit(row.allowed)]),
    );
    const eventSelectMap = new Map(
      proof.eventSelect.map((row) => [String(row.column_name), bit(row.allowed)]),
    );
    const roleCanLogin = bit(proof.role.rolcanlogin);
    const roleConfined = bit(proof.role.role_confined);
    const selectorMatch = bit(proof.role.legacy_selector_match);
    const schemaUsage = bit(proof.role.auth_schema_usage);
    const orgContextExecute = bit(proof.role.organization_admin_context_execute);
    const joinQueueExecute = bit(proof.role.organization_join_queue_execute);
    const decisionLockExecute = bit(proof.role.decision_lock_execute);
    const identityTransitionExecute = bit(proof.role.identity_transition_execute);
    const applicationOrganizationSelect = applicationSelectMap.get('organization_id') || 'U';
    const eventNewStatusSelect = eventSelectMap.get('new_status') || 'U';
    const forbiddenDml = bit(proof.role.forbidden_dml);
    const allVectorsComplete = [
      applicationSelectVector,
      applicationUpdateVector,
      eventSelectVector,
      eventInsertVector,
    ].every((value) => /^1+$/.test(value));
    let privilegeClass = 'AUTH_DECISION_SURFACE_INCOMPLETE';
    if (roleConfined !== '1' || forbiddenDml !== '0') {
      privilegeClass = 'AUTH_RUNTIME_BOUNDARY_INVALID';
    } else if (allVectorsComplete && schemaUsage === '1' && orgContextExecute === '1'
        && joinQueueExecute === '1' && decisionLockExecute === '1'
        && identityTransitionExecute === '1') {
      privilegeClass = 'AUTH_DECISION_SURFACE_COMPLETE';
    } else if (selectorMatch === '0') {
      privilegeClass = 'AUTH_RUNTIME_SELECTOR_MISS';
    } else if (applicationOrganizationSelect !== '1' || eventNewStatusSelect !== '1') {
      privilegeClass = 'AUTH_EMPLOYEE_DIFFERENTIAL_MISSING';
    }

    console.log(
      `AUTH_DECISION_PRIVILEGES|${privilegeClass}|1|1|${roleCanLogin}|${roleConfined}`
      + `|${selectorMatch}|${schemaUsage}|${orgContextExecute}|${joinQueueExecute}`
      + `|${decisionLockExecute}|${identityTransitionExecute}|${applicationOrganizationSelect}`
      + `|${eventNewStatusSelect}|${applicationSelectVector}|${applicationUpdateVector}`
      + `|${eventSelectVector}|${eventInsertVector}|${forbiddenDml}`,
    );

    let stateClass = 'UNAVAILABLE_NATIVE';
    let statePrisma = 'UNKNOWN';
    let stateSqlstate = 'UNKNOWN';
    let stateCounts = ['U', 'U', 'U', 'U', 'U', 'U'];
    try {
      const rows = await inReadOnlyTransaction((tx) => tx.$queryRawUnsafe(`
        SELECT
          count(DISTINCT application.id)::integer AS application_count,
          count(DISTINCT application.id) FILTER (
            WHERE application.status = 'ORGANIZATION_VERIFICATION_PENDING'
          )::integer AS pending_count,
          count(DISTINCT application.id) FILTER (
            WHERE application.status = 'ACTIVATED'
          )::integer AS activated_count,
          count(event.id)::integer AS decision_event_count,
          count(event.id) FILTER (WHERE event.new_status = 'APPROVED')::integer
            AS approved_event_count,
          count(event.id) FILTER (WHERE event.new_status = 'ACTIVATED')::integer
            AS activated_event_count,
          count(DISTINCT application.id) FILTER (
            WHERE application.organization_id IS NOT NULL
          )::integer AS organization_bound_count
        FROM auth.registration_applications application
        LEFT JOIN auth.registration_application_events event
          ON event.application_id = application.id
         AND event.correlation_id = $2::text
         AND event.idempotency_key IN ($3::text, $4::text)
        WHERE application.correlation_id = $1::text
      `, registerCorrelation, decisionCorrelation, decisionEventKey, decisionApprovedEventKey));
      const row = rows[0] || {};
      const applicationCount = integer(row.application_count);
      const pendingCount = integer(row.pending_count);
      const activatedCount = integer(row.activated_count);
      const decisionEventCount = integer(row.decision_event_count);
      const approvedEventCount = integer(row.approved_event_count);
      const activatedEventCount = integer(row.activated_event_count);
      const organizationBoundCount = integer(row.organization_bound_count);
      stateCounts = [
        applicationCount,
        pendingCount,
        activatedCount,
        decisionEventCount,
        approvedEventCount,
        activatedEventCount,
      ].map(String);
      if (applicationCount === 1 && pendingCount === 1 && activatedCount === 0
          && decisionEventCount === 0 && organizationBoundCount === 1) {
        stateClass = 'PENDING_NO_DECISION';
      } else if (applicationCount === 1 && pendingCount === 0 && activatedCount === 1
          && decisionEventCount === 2 && approvedEventCount === 1
          && activatedEventCount === 1 && organizationBoundCount === 1) {
        stateClass = 'ACTIVATED_COMMITTED';
      } else if (applicationCount === 0 && decisionEventCount === 0) {
        stateClass = 'EXACT_APPLICATION_NOT_FOUND';
      } else {
        stateClass = 'PARTIAL_OR_UNEXPECTED_STATE';
      }
    } catch (error) {
      statePrisma = safePrismaCode(error);
      stateSqlstate = safeSqlstate(error);
    }
    console.log(
      `AUTH_EXACT_RUN_STATE|${stateClass}|${statePrisma}|${stateSqlstate}|${stateCounts.join('|')}`,
    );
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(`P0_AUTH_EMPLOYEE_JOIN_INSPECT_DB_ERROR|${safePrismaCode(error)}|${safeSqlstate(error)}`);
  process.exitCode = 35;
});
NODE
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE
)"

privilege_marker="$(grep '^AUTH_DECISION_PRIVILEGES|' <<< "$output" | tail -n1)"
state_marker="$(grep '^AUTH_EXACT_RUN_STATE|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r auth_privilege_tag auth_privilege_class auth_datasource_distinct \
  auth_principal_bound auth_role_can_login auth_role_confined auth_selector_match \
  auth_schema_usage auth_org_context_execute auth_join_queue_execute auth_decision_lock_execute \
  auth_identity_transition_execute auth_app_org_select auth_event_new_status_select \
  auth_application_select_vector auth_application_update_vector auth_event_select_vector \
  auth_event_insert_vector auth_forbidden_dml <<< "$privilege_marker"
[[ "$auth_privilege_tag" == 'AUTH_DECISION_PRIVILEGES' ]]
[[ "$auth_privilege_class" =~ ^AUTH_[A-Z0-9_]{3,96}$ ]]
[[ "$auth_datasource_distinct" == '1' && "$auth_principal_bound" == '1' ]]
for capability in \
  "$auth_role_can_login" "$auth_role_confined" "$auth_selector_match" "$auth_schema_usage" \
  "$auth_org_context_execute" "$auth_join_queue_execute" "$auth_decision_lock_execute" \
  "$auth_identity_transition_execute" "$auth_app_org_select" "$auth_event_new_status_select" \
  "$auth_forbidden_dml"; do
  [[ "$capability" =~ ^[01U]$ ]]
done
[[ "$auth_application_select_vector" =~ ^[01U]{13}$ ]]
[[ "$auth_application_update_vector" =~ ^[01U]{6}$ ]]
[[ "$auth_event_select_vector" =~ ^[01U]{12}$ ]]
[[ "$auth_event_insert_vector" =~ ^[01U]{10}$ ]]

IFS='|' read -r auth_state_tag auth_state_class auth_state_prisma auth_state_sqlstate \
  auth_state_application_count auth_state_pending_count auth_state_activated_count \
  auth_state_event_count auth_state_approved_event_count auth_state_activated_event_count <<< "$state_marker"
[[ "$auth_state_tag" == 'AUTH_EXACT_RUN_STATE' ]]
[[ "$auth_state_class" =~ ^[A-Z0-9_]{3,96}$ ]]
[[ "$auth_state_prisma" =~ ^(UNKNOWN|P[0-9]{4})$ ]]
[[ "$auth_state_sqlstate" =~ ^(UNKNOWN|[0-9A-Z]{5})$ ]]
for count in \
  "$auth_state_application_count" "$auth_state_pending_count" "$auth_state_activated_count" \
  "$auth_state_event_count" "$auth_state_approved_event_count" "$auth_state_activated_event_count"; do
  [[ "$count" =~ ^([0-9]|U)$ ]]
done

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 employee join diagnostic

- command: \`$COMMAND\`
- exact main: \`$TARGET_SHA\`
- source run: \`$JOIN_DIAG_SOURCE_RUN_ID\`
- source API revision: \`$JOIN_DIAG_SOURCE_REVISION\`
- result: \`PASS\`
- historical log native class: \`$join_log_native_class\`
- historical log binding: \`$join_diag_basis\`
- historical HTTP class: \`$join_diag_http\`
- historical business class: \`$join_log_business_class\`
- historical Prisma class: \`$join_log_prisma\`
- historical SQLSTATE class: \`$join_log_sqlstate\`
- historical stage class: \`$join_log_stage\`
- AUTH datasource distinct from DATABASE_URL: \`$auth_datasource_distinct\`
- AUTH datasource principal bound without disclosure: \`$auth_principal_bound\`
- AUTH runtime login/confined/legacy-selector: \`$auth_role_can_login/$auth_role_confined/$auth_selector_match\`
- AUTH bounded function surface (schema/admin-context/join-queue/lock/identity): \`$auth_schema_usage$auth_org_context_execute$auth_join_queue_execute$auth_decision_lock_execute$auth_identity_transition_execute\`
- AUTH privilege class: \`$auth_privilege_class\`
- AUTH application.organization_id SELECT: \`$auth_app_org_select\`
- AUTH event.new_status SELECT: \`$auth_event_new_status_select\`
- AUTH application SELECT vector: \`$auth_application_select_vector\`
- AUTH application UPDATE vector: \`$auth_application_update_vector\`
- AUTH event SELECT vector: \`$auth_event_select_vector\`
- AUTH event INSERT vector: \`$auth_event_insert_vector\`
- AUTH forbidden destructive DML present: \`$auth_forbidden_dml\`
- AUTH exact-run state: \`$auth_state_class\`
- AUTH state native Prisma/SQLSTATE: \`$auth_state_prisma/$auth_state_sqlstate\`
- AUTH state aggregate (application/pending/activated/events/approved/activated): \`$auth_state_application_count/$auth_state_pending_count/$auth_state_activated_count/$auth_state_event_count/$auth_state_approved_event_count/$auth_state_activated_event_count\`
- raw production logs published: \`0\`
- raw identifiers, principals, URLs or error messages published: \`0\`
- employee join replay: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
