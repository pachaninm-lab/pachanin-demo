#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER:?PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
CONTINUATION_ISSUE_NUMBER='4637'
RELEASE_ISSUE_NUMBER="$PC_PRODUCTION_AUTHORITY_ISSUE_NUMBER"
[[ "$RELEASE_ISSUE_NUMBER" == "$CONTINUATION_ISSUE_NUMBER" ]]

SOURCE_RUN='33322244053-1'
SOURCE_REVISION='5c4d50824baf78cdf26e062b621184d2500e5217'
SOURCE_SHORT='5c4d50824baf'
COMMAND="/production p0-employee-join-inspect $SOURCE_RUN $SOURCE_REVISION"
LOG_SINCE='2026-08-30T16:49:08Z'
LOG_UNTIL='2026-08-30T16:49:24Z'
REGISTER_CORRELATION="p0-all-role-register:${SOURCE_SHORT}:${SOURCE_RUN}:employee"
DECISION_CORRELATION="p0-all-role-employee-join:${SOURCE_SHORT}:${SOURCE_RUN}"
DECISION_EVENT_KEY="org-join-decision:p0-all-role-employee-join:${SOURCE_REVISION}:${SOURCE_RUN}"
DECISION_APPROVED_EVENT_KEY="${DECISION_EVENT_KEY}:approved"

key_path="$RUNNER_TEMP/pc-p0-current-employee-join-key"
known_hosts="$RUNNER_TEMP/pc-p0-current-employee-join-known-hosts"
TARGET_SHA='unknown'
result_published=0
log_native='NO_SAFE_LOG_MATCH'
log_binding='NONE'
log_http='UNKNOWN'
log_business='UNKNOWN'
log_prisma='UNKNOWN'
log_sqlstate='UNKNOWN'
log_stage='UNKNOWN'

auth_privilege_class='NOT_RUN'
auth_role_can_login='U'
auth_role_confined='U'
auth_selector_match='U'
auth_function_vector='UUUUUU'
auth_application_select_vector='UUUUUUUUUUUUU'
auth_application_update_vector='UUUUUU'
auth_event_select_vector='UUUUUUUUUUUU'
auth_event_insert_vector='UUUUUUUUUU'
auth_forbidden_dml='U'
auth_state_class='NOT_RUN'
auth_state_prisma='UNKNOWN'
auth_state_sqlstate='UNKNOWN'
auth_state_counts='U/U/U/U/U/U'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
}

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 current employee join diagnostic

- command: \`$COMMAND\`
- diagnostic main: \`$TARGET_SHA\`
- source run: \`$SOURCE_RUN\`
- source API revision: \`$SOURCE_REVISION\`
- result: \`FAIL\`
- blocker: \`CURRENT_EMPLOYEE_JOIN_INSPECT_FAILED_CLOSED\`
- historical log native/binding/http/business: \`$log_native/$log_binding/$log_http/$log_business\`
- historical Prisma/SQLSTATE/stage: \`$log_prisma/$log_sqlstate/$log_stage\`
- AUTH privilege class: \`$auth_privilege_class\`
- AUTH exact-run state: \`$auth_state_class\`
- production mutation: \`NONE\`
- raw identifiers, credentials, URLs or error messages published: \`0\`
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

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
git merge-base --is-ancestor "$SOURCE_REVISION" "$TARGET_SHA"

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

guard_main
mapfile -t domain_ips < <(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u)
(( ${#domain_ips[@]} >= 1 ))
printf '%s\n' "${domain_ips[@]}" | grep -Fxq "$DEFAULT_HOST"

scan="$(mktemp)"; match="$(mktemp)"
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
  "$user@$host" 'set -euo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null

# Bounded fixed-window log classification. Raw log bytes remain on REG.RU.
set +e
log_output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$user@$host" "bash -s -- '$SOURCE_REVISION' '$LOG_SINCE' '$LOG_UNTIL' '$REGISTER_CORRELATION' '$DECISION_CORRELATION'" 2>/dev/null <<'REMOTE_LOG'
set -euo pipefail
revision="$1"; since="$2"; until="$3"; register_correlation="$4"; decision_correlation="$5"
[[ "$revision" == '5c4d50824baf78cdf26e062b621184d2500e5217' ]]
[[ "$since" == '2026-08-30T16:49:08Z' ]]
[[ "$until" == '2026-08-30T16:49:24Z' ]]
[[ "$register_correlation" == 'p0-all-role-register:5c4d50824baf:33322244053-1:employee' ]]
[[ "$decision_correlation" == 'p0-all-role-employee-join:5c4d50824baf:33322244053-1' ]]

collect_logs() {
  local service="$1" id current_revision chunk aggregate=''
  mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.service=$service")
  (( ${#ids[@]} >= 1 && ${#ids[@]} <= 32 )) || return 2
  local matched=0
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

api_logs="$(collect_logs api)" || api_logs=''
web_logs="$(collect_logs web)" || web_logs=''
combined="${api_logs}${api_logs:+$'\n'}${web_logs}"
native='NO_SAFE_LOG_MATCH'; basis='NONE'; http='UNKNOWN'; business='UNKNOWN'; prisma='UNKNOWN'; sqlstate='UNKNOWN'; stage='UNKNOWN'
if grep -Fq "$decision_correlation" <<< "$combined"; then
  basis='DECISION_CORRELATION_BOUND'
elif grep -Fq "$register_correlation" <<< "$combined"; then
  basis='REGISTER_CORRELATION_BOUND'
elif [[ -n "$combined" ]]; then
  basis='FIXED_TIME_WINDOW'
fi
for code in P2010 P2024 P2028 P2034; do
  grep -Eq "(^|[^A-Z0-9])$code([^A-Z0-9]|$)" <<< "$api_logs" && { prisma="$code"; break; }
done
for code in 42501 40001 57014; do
  grep -Eqi "SQLSTATE[^0-9A-Z]*$code([^0-9]|$)|(^|[^0-9])$code([^0-9]|$)" <<< "$api_logs" && { sqlstate="$code"; break; }
done
for candidate in STATE_QUERY DECISION_TRANSACTION IDENTITY_TRANSITION LIFECYCLE_RECEIPT; do
  grep -Eq "(^|[^A-Z0-9_])$candidate([^A-Z0-9_]|$)" <<< "$combined" && { stage="$candidate"; break; }
done
if grep -Fq 'organization_join_decision_upstream_failure' <<< "$web_logs"; then
  if grep -Fq 'UPSTREAM_TIMEOUT' <<< "$web_logs"; then
    native='WEB_UPSTREAM_TIMEOUT'; business='JOIN_REQUEST_SERVICE_UNAVAILABLE'; http='503'
  elif grep -Fq 'UPSTREAM_TRANSPORT' <<< "$web_logs"; then
    native='WEB_UPSTREAM_TRANSPORT'; business='JOIN_REQUEST_SERVICE_UNAVAILABLE'; http='503'
  fi
fi
if [[ "$native" == 'NO_SAFE_LOG_MATCH' ]]; then
  if [[ "$prisma" == 'P2010' && "$sqlstate" == '42501' ]]; then native='API_PRISMA_P2010_SQLSTATE_42501'
  elif [[ "$prisma" == 'P2028' ]]; then native='API_PRISMA_TRANSACTION_ENVELOPE_TIMEOUT'
  elif [[ "$prisma" == 'P2024' ]]; then native='API_PRISMA_POOL_TIMEOUT'
  elif [[ "$prisma" == 'P2034' || "$sqlstate" == '40001' ]]; then native='API_SERIALIZATION_OR_DEADLOCK'
  elif [[ "$sqlstate" == '57014' ]]; then native='API_STATEMENT_TIMEOUT'
  elif grep -Eqi 'permission denied' <<< "$api_logs"; then native='AMBIGUOUS_PERMISSION_TEXT_ONLY'
  fi
fi
for code in FRESH_MFA_REQUIRED ORGANIZATION_ADMIN_REQUIRED REGISTRATION_APPLICATION_NOT_FOUND SELF_APPROVAL_FORBIDDEN REGISTRATION_STATE_CONFLICT ROLE_PERMISSION_CEILING_EXCEEDED REGISTRATION_ROLE_MAPPING_INVALID ORGANIZATION_NOT_ELIGIBLE_FOR_JOIN REGISTRATION_VERSION_CONFLICT REGISTRATION_IDENTITY_TRANSITION_CONFLICT REGISTRATION_LIFECYCLE_RECEIPT_MISSING JOIN_REQUEST_SERVICE_UNAVAILABLE; do
  grep -Fq "$code" <<< "$combined" && { business="$code"; break; }
done
if [[ "$basis" == 'FIXED_TIME_WINDOW' && "$business" != 'UNKNOWN' ]]; then business='AMBIGUOUS_FIXED_WINDOW_BUSINESS_SIGNAL'; fi
if [[ "$basis" == 'DECISION_CORRELATION_BOUND' || "$basis" == 'REGISTER_CORRELATION_BOUND' ]]; then
  for status in 400 401 403 404 409 429 500 502 503 504; do
    if grep -E "($decision_correlation|$register_correlation).*(status|statusCode)[^0-9]{0,8}$status([^0-9]|$)" <<< "$combined" >/dev/null 2>&1; then http="$status"; break; fi
  done
fi
printf 'EMPLOYEE_JOIN_LOG|%s|%s|%s|%s|%s|%s|%s\n' "$native" "$basis" "$http" "$business" "$prisma" "$sqlstate" "$stage"
printf 'PRODUCTION_MUTATION=NONE\n'
unset api_logs web_logs combined
REMOTE_LOG
)"
log_rc=$?
set -e
if [[ "$log_rc" == 0 ]]; then
  log_marker="$(grep '^EMPLOYEE_JOIN_LOG|' <<< "$log_output" | tail -n1)"
  log_mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$log_output" | tail -n1)"
  [[ "$log_mutation" == 'PRODUCTION_MUTATION=NONE' ]]
  IFS='|' read -r tag log_native log_binding log_http log_business log_prisma log_sqlstate log_stage <<< "$log_marker"
  [[ "$tag" == 'EMPLOYEE_JOIN_LOG' ]]
  [[ "$log_native" =~ ^[A-Z0-9_]{3,96}$ ]]
  [[ "$log_binding" =~ ^[A-Z0-9_]{3,32}$ ]]
  [[ "$log_http" =~ ^(UNKNOWN|[45][0-9]{2})$ ]]
  [[ "$log_business" =~ ^[A-Z0-9_]{3,96}$ ]]
  [[ "$log_prisma" =~ ^(UNKNOWN|P[0-9]{4})$ ]]
  [[ "$log_sqlstate" =~ ^(UNKNOWN|[0-9A-Z]{5})$ ]]
  [[ "$log_stage" =~ ^[A-Z0-9_]{3,64}$ ]]
else
  log_native='DIAGNOSTIC_SOURCE_LOGS_UNAVAILABLE'
fi
unset log_output

guard_main

# Read the exact failed employee application through the AUTH datasource only.
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$user@$host" "bash -s -- '$SOURCE_REVISION' '$REGISTER_CORRELATION' '$DECISION_CORRELATION' '$DECISION_EVENT_KEY' '$DECISION_APPROVED_EVENT_KEY'" <<'REMOTE_DB'
set -euo pipefail
source_revision="$1"; register_correlation="$2"; decision_correlation="$3"; decision_event_key="$4"; decision_approved_event_key="$5"
[[ "$source_revision" == '5c4d50824baf78cdf26e062b621184d2500e5217' ]]
[[ "$register_correlation" == 'p0-all-role-register:5c4d50824baf:33322244053-1:employee' ]]
[[ "$decision_correlation" == 'p0-all-role-employee-join:5c4d50824baf:33322244053-1' ]]
[[ "$decision_event_key" == 'org-join-decision:p0-all-role-employee-join:5c4d50824baf78cdf26e062b621184d2500e5217:33322244053-1' ]]
[[ "$decision_approved_event_key" == 'org-join-decision:p0-all-role-employee-join:5c4d50824baf78cdf26e062b621184d2500e5217:33322244053-1:approved' ]]
[[ "$(id -u)" -eq 0 ]]

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
live_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "${web_ids[0]}")"
[[ -n "$live_project" ]]
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$live_project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 8 ))
api_id=''
for candidate in "${api_ids[@]}"; do
  candidate_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$candidate" 2>/dev/null || true)"
  if [[ "$candidate_revision" == "$source_revision" ]]; then
    [[ -z "$api_id" ]]
    api_id="$candidate"
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
const knownPrismaCodes = new Set(['P2010', 'P2024', 'P2028', 'P2034']);
const knownSqlstates = new Set(['42501', '40001', '57014']);
const safePrisma = (error) => {
  const code = String(error && typeof error === 'object' && 'code' in error ? error.code : '');
  return knownPrismaCodes.has(code) ? code : 'UNKNOWN';
};
const safeSqlstate = (error) => {
  const candidates = [error?.meta?.code, error?.meta?.database_error?.code];
  for (const value of candidates) {
    const code = String(value || '').toUpperCase();
    if (knownSqlstates.has(code)) return code;
  }
  return 'UNKNOWN';
};
const bit = (value) => value === true ? '1' : value === false ? '0' : 'U';
const parseUser = (raw) => {
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username) return '';
  return decodeURIComponent(url.username);
};
const vector = (rows, columns) => {
  const map = new Map(rows.map((row) => [String(row.column_name), row.allowed]));
  return columns.map((name) => bit(map.get(name))).join('');
};
const integer = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 9) throw new Error('SAFE_COUNT_INVALID');
  return n;
};

const appSelect = ['id','kind','user_id','organization_id','membership_id','requested_workspace','requested_role','status','version','correlation_id','email','decision_reason','decided_at'];
const appUpdate = ['status','decided_at','decision_reason','decision_actor_user_id','version','updated_at'];
const eventSelect = ['id','application_id','actor_user_id','actor_kind','previous_status','new_status','reason','correlation_id','idempotency_key','application_version','metadata','created_at'];
const eventInsert = ['id','application_id','actor_user_id','actor_kind','previous_status','new_status','reason','correlation_id','idempotency_key','application_version'];

(async () => {
  const authUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
  const appUrl = String(process.env.DATABASE_URL || '').trim();
  if (!authUrl || !appUrl || authUrl === appUrl) throw Object.assign(new Error('AUTH_DATASOURCE_INVALID'), { code: 'DIAG_GUARD' });
  const authUser = parseUser(authUrl); const appUser = parseUser(appUrl);
  if (!authUser || !appUser || authUser === appUser) throw Object.assign(new Error('AUTH_PRINCIPAL_INVALID'), { code: 'DIAG_GUARD' });

  const registerCorrelation = String(process.env.PC_DIAG_REGISTER_CORRELATION || '');
  const decisionCorrelation = String(process.env.PC_DIAG_DECISION_CORRELATION || '');
  const decisionEventKey = String(process.env.PC_DIAG_DECISION_EVENT_KEY || '');
  const approvedEventKey = String(process.env.PC_DIAG_DECISION_APPROVED_EVENT_KEY || '');
  if (registerCorrelation !== 'p0-all-role-register:5c4d50824baf:33322244053-1:employee'
      || decisionCorrelation !== 'p0-all-role-employee-join:5c4d50824baf:33322244053-1'
      || decisionEventKey !== 'org-join-decision:p0-all-role-employee-join:5c4d50824baf78cdf26e062b621184d2500e5217:33322244053-1'
      || approvedEventKey !== 'org-join-decision:p0-all-role-employee-join:5c4d50824baf78cdf26e062b621184d2500e5217:33322244053-1:approved') {
    throw Object.assign(new Error('EXACT_RUN_BINDING_INVALID'), { code: 'DIAG_GUARD' });
  }

  const db = new PrismaClient({ datasources: { db: { url: authUrl } } });
  const readOnly = (work) => db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const guard = (await tx.$queryRawUnsafe(`SELECT current_setting('transaction_read_only') = 'on' AS ro, current_user = session_user AS same_user`))[0];
    if (!guard || guard.ro !== true || guard.same_user !== true) throw Object.assign(new Error('READ_ONLY_GUARD_INVALID'), { code: 'DIAG_GUARD' });
    const bound = (await tx.$queryRawUnsafe('SELECT current_user = $1::text AS bound', authUser))[0];
    if (!bound || bound.bound !== true) throw Object.assign(new Error('AUTH_USER_BINDING_INVALID'), { code: 'DIAG_GUARD' });
    return work(tx);
  }, { timeout: 20_000, maxWait: 5_000 });

  try {
    const proof = await readOnly(async (tx) => {
      const role = (await tx.$queryRawUnsafe(`
        SELECT role.rolcanlogin,
          NOT role.rolsuper AND NOT role.rolbypassrls AND NOT role.rolinherit
          AND NOT role.rolcreatedb AND NOT role.rolcreaterole AND NOT role.rolreplication
          AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member = role.oid) AS confined,
          role.rolcanlogin AND NOT role.rolsuper AND NOT role.rolbypassrls
          AND NOT role.rolcreatedb AND NOT role.rolcreaterole AND NOT role.rolreplication
          AND (role.rolname IN ('app_service','pc_auth_runtime','one_deal_auth','app_auth') OR (
            has_schema_privilege(role.rolname,'auth','USAGE')
            AND has_function_privilege(role.rolname,'auth.resolve_login_credential(text)','EXECUTE')
            AND has_function_privilege(role.rolname,'auth.registration_organization_join_queue(text,text,text,text,text,integer)','EXECUTE')
          )) AS selector_match,
          has_schema_privilege(current_user,'auth','USAGE') AS schema_usage,
          coalesce(has_function_privilege(current_user,to_regprocedure('auth.registration_organization_admin_context(text,text,text,text,text)'),'EXECUTE'),false) AS admin_context,
          coalesce(has_function_privilege(current_user,to_regprocedure('auth.registration_organization_join_queue(text,text,text,text,text,integer)'),'EXECUTE'),false) AS join_queue,
          coalesce(has_function_privilege(current_user,to_regprocedure('auth.lock_registration_decision_application(text,text,text,text,text,text,text)'),'EXECUTE'),false) AS decision_lock,
          coalesce(has_function_privilege(current_user,to_regprocedure('auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)'),'EXECUTE'),false) AS identity_transition,
          coalesce(has_function_privilege(current_user,to_regprocedure('auth.emit_registration_lifecycle_receipt(text,text)'),'EXECUTE'),false) AS lifecycle_receipt,
          has_table_privilege(current_user,'auth.registration_applications','DELETE')
          OR has_table_privilege(current_user,'auth.registration_application_events','DELETE')
          OR has_any_column_privilege(current_user,'auth.registration_application_events','UPDATE') AS forbidden_dml
        FROM pg_catalog.pg_roles role WHERE role.rolname = current_user
      `))[0];
      if (!role) throw Object.assign(new Error('AUTH_ROLE_MISSING'), { code: 'DIAG_GUARD' });
      const columnProof = async (table, privilege, columns) => tx.$queryRawUnsafe(`
        SELECT column_name, has_column_privilege(current_user, $1::text, column_name, $2::text) AS allowed
        FROM unnest($3::text[]) WITH ORDINALITY AS required(column_name, position) ORDER BY position
      `, table, privilege, columns);
      return {
        role,
        appSelect: await columnProof('auth.registration_applications','SELECT',appSelect),
        appUpdate: await columnProof('auth.registration_applications','UPDATE',appUpdate),
        eventSelect: await columnProof('auth.registration_application_events','SELECT',eventSelect),
        eventInsert: await columnProof('auth.registration_application_events','INSERT',eventInsert),
      };
    });

    const appSelectVector = vector(proof.appSelect, appSelect);
    const appUpdateVector = vector(proof.appUpdate, appUpdate);
    const eventSelectVector = vector(proof.eventSelect, eventSelect);
    const eventInsertVector = vector(proof.eventInsert, eventInsert);
    const functionVector = [proof.role.schema_usage, proof.role.admin_context, proof.role.join_queue, proof.role.decision_lock, proof.role.identity_transition, proof.role.lifecycle_receipt].map(bit).join('');
    const roleCanLogin = bit(proof.role.rolcanlogin); const roleConfined = bit(proof.role.confined); const selector = bit(proof.role.selector_match); const forbidden = bit(proof.role.forbidden_dml);
    const complete = /^1+$/.test(appSelectVector) && /^1+$/.test(appUpdateVector) && /^1+$/.test(eventSelectVector) && /^1+$/.test(eventInsertVector) && functionVector === '111111';
    let privilegeClass = complete ? 'AUTH_DECISION_SURFACE_COMPLETE' : 'AUTH_DECISION_SURFACE_INCOMPLETE';
    if (roleConfined !== '1' || forbidden !== '0') privilegeClass = 'AUTH_RUNTIME_BOUNDARY_INVALID';
    else if (selector === '0') privilegeClass = 'AUTH_RUNTIME_SELECTOR_MISS';
    console.log(`AUTH_PRIV|${privilegeClass}|${roleCanLogin}|${roleConfined}|${selector}|${functionVector}|${appSelectVector}|${appUpdateVector}|${eventSelectVector}|${eventInsertVector}|${forbidden}`);

    let stateClass = 'UNAVAILABLE_NATIVE'; let statePrisma = 'UNKNOWN'; let stateSqlstate = 'UNKNOWN'; let counts = ['U','U','U','U','U','U'];
    try {
      const row = (await readOnly((tx) => tx.$queryRawUnsafe(`
        SELECT count(DISTINCT application.id)::integer AS application_count,
          count(DISTINCT application.id) FILTER (WHERE application.status='ORGANIZATION_VERIFICATION_PENDING')::integer AS pending_count,
          count(DISTINCT application.id) FILTER (WHERE application.status='ACTIVATED')::integer AS activated_count,
          count(event.id)::integer AS event_count,
          count(event.id) FILTER (WHERE event.new_status='APPROVED')::integer AS approved_count,
          count(event.id) FILTER (WHERE event.new_status='ACTIVATED')::integer AS activated_event_count,
          count(DISTINCT application.id) FILTER (WHERE application.organization_id IS NOT NULL)::integer AS organization_bound_count
        FROM auth.registration_applications application
        LEFT JOIN auth.registration_application_events event ON event.application_id=application.id
          AND event.correlation_id=$2::text AND event.idempotency_key IN ($3::text,$4::text)
        WHERE application.correlation_id=$1::text
      `, registerCorrelation, decisionCorrelation, decisionEventKey, approvedEventKey)))[0] || {};
      const applicationCount=integer(row.application_count), pendingCount=integer(row.pending_count), activatedCount=integer(row.activated_count), eventCount=integer(row.event_count), approvedCount=integer(row.approved_count), activatedEventCount=integer(row.activated_event_count), organizationBound=integer(row.organization_bound_count);
      counts=[applicationCount,pendingCount,activatedCount,eventCount,approvedCount,activatedEventCount].map(String);
      if (applicationCount===1 && pendingCount===1 && activatedCount===0 && eventCount===0 && organizationBound===1) stateClass='PENDING_NO_DECISION';
      else if (applicationCount===1 && pendingCount===0 && activatedCount===1 && eventCount===2 && approvedCount===1 && activatedEventCount===1 && organizationBound===1) stateClass='ACTIVATED_COMMITTED';
      else if (applicationCount===0 && eventCount===0) stateClass='EXACT_APPLICATION_NOT_FOUND';
      else stateClass='PARTIAL_OR_UNEXPECTED_STATE';
    } catch (error) {
      statePrisma=safePrisma(error); stateSqlstate=safeSqlstate(error);
    }
    console.log(`AUTH_STATE|${stateClass}|${statePrisma}|${stateSqlstate}|${counts.join('|')}`);
  } finally {
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(`P0_AUTH_INSPECT_DB_ERROR|${safePrisma(error)}|${safeSqlstate(error)}`);
  process.exitCode=35;
});
NODE
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE_DB
)"

priv_marker="$(grep '^AUTH_PRIV|' <<< "$output" | tail -n1)"
state_marker="$(grep '^AUTH_STATE|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]
IFS='|' read -r priv_tag auth_privilege_class auth_role_can_login auth_role_confined auth_selector_match auth_function_vector auth_application_select_vector auth_application_update_vector auth_event_select_vector auth_event_insert_vector auth_forbidden_dml <<< "$priv_marker"
[[ "$priv_tag" == 'AUTH_PRIV' ]]
[[ "$auth_privilege_class" =~ ^AUTH_[A-Z0-9_]{3,96}$ ]]
[[ "$auth_role_can_login" =~ ^[01U]$ && "$auth_role_confined" =~ ^[01U]$ && "$auth_selector_match" =~ ^[01U]$ && "$auth_forbidden_dml" =~ ^[01U]$ ]]
[[ "$auth_function_vector" =~ ^[01U]{6}$ ]]
[[ "$auth_application_select_vector" =~ ^[01U]{13}$ ]]
[[ "$auth_application_update_vector" =~ ^[01U]{6}$ ]]
[[ "$auth_event_select_vector" =~ ^[01U]{12}$ ]]
[[ "$auth_event_insert_vector" =~ ^[01U]{10}$ ]]

IFS='|' read -r state_tag auth_state_class auth_state_prisma auth_state_sqlstate c_app c_pending c_activated c_events c_approved c_activated_events <<< "$state_marker"
[[ "$state_tag" == 'AUTH_STATE' ]]
[[ "$auth_state_class" =~ ^[A-Z0-9_]{3,96}$ ]]
[[ "$auth_state_prisma" =~ ^(UNKNOWN|P[0-9]{4})$ ]]
[[ "$auth_state_sqlstate" =~ ^(UNKNOWN|[0-9A-Z]{5})$ ]]
for count in "$c_app" "$c_pending" "$c_activated" "$c_events" "$c_approved" "$c_activated_events"; do [[ "$count" =~ ^([0-9]|U)$ ]]; done
auth_state_counts="$c_app/$c_pending/$c_activated/$c_events/$c_approved/$c_activated_events"
unset output

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 current employee join diagnostic

- command: \`$COMMAND\`
- diagnostic main: \`$TARGET_SHA\`
- source run: \`$SOURCE_RUN\`
- source API revision: \`$SOURCE_REVISION\`
- result: \`PASS\`
- historical log native class: \`$log_native\`
- historical log binding: \`$log_binding\`
- historical HTTP class: \`$log_http\`
- historical business class: \`$log_business\`
- historical Prisma class: \`$log_prisma\`
- historical SQLSTATE class: \`$log_sqlstate\`
- historical stage class: \`$log_stage\`
- AUTH runtime login/confined/selector: \`$auth_role_can_login/$auth_role_confined/$auth_selector_match\`
- AUTH function vector (schema/admin-context/join-queue/lock/identity/lifecycle): \`$auth_function_vector\`
- AUTH privilege class: \`$auth_privilege_class\`
- AUTH application SELECT vector: \`$auth_application_select_vector\`
- AUTH application UPDATE vector: \`$auth_application_update_vector\`
- AUTH event SELECT vector: \`$auth_event_select_vector\`
- AUTH event INSERT vector: \`$auth_event_insert_vector\`
- AUTH forbidden destructive DML present: \`$auth_forbidden_dml\`
- AUTH exact-run state: \`$auth_state_class\`
- AUTH state native Prisma/SQLSTATE: \`$auth_state_prisma/$auth_state_sqlstate\`
- AUTH state aggregate (application/pending/activated/events/approved/activated): \`$auth_state_counts\`
- raw production logs published: \`0\`
- raw identifiers, principals, credentials, URLs or error messages published: \`0\`
- employee join replay: \`NONE\`
- production mutation: \`NONE\`" >/dev/null
result_published=1
