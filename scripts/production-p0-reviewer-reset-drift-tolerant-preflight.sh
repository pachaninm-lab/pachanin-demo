#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

SAFE_BASELINE_SHA='440e40753e2cac13c93f8e007d9fe17c2b66caba'
REVIEWED_RESET_SHA='a9c16814960520b20e8ae0c722570d9a3b4147f9'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
LIVE_BASE="https://$LIVE_DOMAIN"
DEFAULT_HOST='195.19.12.120'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-preflight current-runtime'
IMAP_RUN_ID='31923014818'
IMAP_HEAD_SHA='662c861cca28053b810efda5642a6a1de842ef00'
IMAP_ARTIFACT="production-p0-regru-normalized-imap-credential-diagnostic-${IMAP_RUN_ID}"
SMTP_RUN_ID='31923847459'
SMTP_HEAD_SHA='6ac4842489aab5c8c228670a18b60010dbf30fd1'
SMTP_ARTIFACT="production-p0-regru-smtp587-auth-diagnostic-${SMTP_RUN_ID}"

RESET_CRITICAL_PATHS=(
  'apps/api/src/common/prisma/database-principal-boundary.ts'
  'apps/api/src/common/prisma/database-principal-inspection.ts'
  'apps/api/src/common/prisma/prisma.service.ts'
  'apps/api/src/modules/auth/auth.module.ts'
  'apps/api/src/modules/auth/auth-prisma.service.ts'
  'apps/api/src/modules/auth/auth-crypto.ts'
  'apps/api/src/modules/auth/auth.controller.ts'
  'apps/api/src/modules/auth/password-reset.repository.ts'
  'apps/api/src/modules/auth/password-reset.service.ts'
  'apps/api/src/modules/auth/password-reset-token.ts'
  'apps/api/src/modules/auth/persistent-auth.repository.ts'
  'apps/api/src/modules/auth/dto/password-reset.dto.ts'
  'apps/api/src/modules/auth-mail/auth-mail-crypto.ts'
  'apps/api/src/modules/auth-mail/auth-mail-outbox.service.ts'
  'apps/api/src/modules/auth-mail/auth-mail-templates.ts'
  'apps/web/app/api/auth/forgot-password/route.ts'
  'apps/api/prisma/migrations/20260731195000_p0_password_reset_challenges/migration.sql'
  'apps/api/prisma/migrations/20260808120000_p0_password_reset_authority/migration.sql'
  'apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql'
  'apps/api/prisma/migrations/20260812154500_p0_reviewer_password_reset_subject/migration.sql'
  'apps/api/prisma/migrations/20260816161500_p0_password_reset_challenge_runtime_grant/migration.sql'
)

TARGET_SHA='unknown'
RUNTIME_DEPLOYED_SHA='unknown'
failure_reason='BOOTSTRAP_FAILED'
result_published=0
key_path="$RUNNER_TEMP/p0-reviewer-drift-preflight-key"
known_hosts="$RUNNER_TEMP/p0-reviewer-drift-preflight-known-hosts"
proof_dir="$RUNNER_TEMP/p0-reviewer-drift-preflight-proofs"
raw="$RUNNER_TEMP/p0-reviewer-drift-preflight.raw"
scan=''
match=''

cleanup() {
  rm -rf -- "$key_path" "$known_hosts" "$proof_dir" "$raw"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}

publish_failure() {
  local rc="$?" deployed='unknown'
  trap - ERR
  [[ "$failure_reason" =~ ^[A-Z0-9_]{1,96}$ ]] || failure_reason='UNCLASSIFIED_FAILURE'
  if [[ "$RUNTIME_DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    deployed="$RUNTIME_DEPLOYED_SHA"
  fi
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset drift-tolerant preflight

- exact main: \`$TARGET_SHA\`
- inspected runtime revision: \`$deployed\`
- result: \`FAIL_CLOSED\`
- reset authorized: \`NO\`
- production mutation: \`NONE\`
- reviewer identity exposure: \`NONE\`
- blocker: \`$failure_reason\`
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
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ -z "$(git status --porcelain=v1)" ]]
for trusted_sha in "$SAFE_BASELINE_SHA" "$REVIEWED_RESET_SHA"; do
  git cat-file -e "${trusted_sha}^{commit}"
  git merge-base --is-ancestor "$trusted_sha" "$TARGET_SHA"
done

verify_proof_run() {
  local run_id="$1" expected_head="$2" meta
  meta="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run_id" --jq '[.conclusion,.event,.head_sha] | join("|")')"
  [[ "$meta" == "success|issue_comment|$expected_head" ]]
  git merge-base --is-ancestor "$expected_head" "$TARGET_SHA"
}

failure_reason='MAIL_PROOF_METADATA_INVALID'
verify_proof_run "$IMAP_RUN_ID" "$IMAP_HEAD_SHA"
verify_proof_run "$SMTP_RUN_ID" "$SMTP_HEAD_SHA"

failure_reason='MAIL_PROOF_ARTIFACT_INVALID'
mkdir -p "$proof_dir/imap" "$proof_dir/smtp"
gh run download "$IMAP_RUN_ID" --repo "$GITHUB_REPOSITORY" --name "$IMAP_ARTIFACT" --dir "$proof_dir/imap" >/dev/null
gh run download "$SMTP_RUN_ID" --repo "$GITHUB_REPOSITORY" --name "$SMTP_ARTIFACT" --dir "$proof_dir/smtp" >/dev/null
imap_result="$(find "$proof_dir/imap" -type f -name 'result.txt' -print -quit)"
smtp_result="$(find "$proof_dir/smtp" -type f -name 'result.txt' -print -quit)"
[[ -n "$imap_result" && -n "$smtp_result" ]]
grep -Fxq 'IMAP_IDENTITY_NORMALIZATION=PASS' "$imap_result"
grep -Fxq 'IMAP_TRANSPORT_CLASS=PASS' "$imap_result"
grep -Fxq 'IMAP_AUTH_RESULT=PASS' "$imap_result"
grep -Fxq 'PRODUCTION_MUTATION=NONE' "$imap_result"
grep -Fxq 'SMTP587_IDENTITY_NORMALIZATION=PASS' "$smtp_result"
grep -Fxq 'SMTP587_TRANSPORT_CLASS=PASS' "$smtp_result"
grep -Fxq 'SMTP587_STARTTLS=PASS' "$smtp_result"
grep -Fxq 'SMTP587_AUTH_RESULT=PASS' "$smtp_result"
grep -Fxq 'PRODUCTION_MUTATION=NONE' "$smtp_result"

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]

validate_key() {
  local source="$1" pub
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  pub="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }
  rm -f "$pub"
}

try_key() {
  local value="$1" plain escaped decoded
  [[ -n "$value" ]] || return 1
  plain="$(mktemp)"; escaped="$(mktemp)"; decoded="$(mktemp)"
  printf '%s\n' "$value" > "$plain"
  validate_key "$plain" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "${value//\\n/$'\n'}" > "$escaped"
  validate_key "$escaped" && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  printf '%s' "$value" | base64 --decode > "$decoded" 2>/dev/null \
    && validate_key "$decoded" \
    && { rm -f "$plain" "$escaped" "$decoded"; return 0; }
  rm -f "$plain" "$escaped" "$decoded"
  return 1
}

failure_reason='SSH_PRIVATE_KEY_INVALID'
try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"

failure_reason='DNS_IP_GUARD_FAILED'
guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"

failure_reason='SSH_HOST_KEY_GUARD_FAILED'
scan="$(mktemp)"; match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    if [[ "$(grep -c . "$match" || true)" == '1' ]]; then
      pinned_ready=1
      break
    fi
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned_ready" == '1' ]]
mv "$match" "$known_hosts"; match=''
rm -f "$scan"; scan=''
chmod 0600 "$known_hosts"

failure_reason='REMOTE_RUNTIME_PREFLIGHT_FAILED'
guard_main
trap - ERR
set +e
ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$LIVE_BASE'" >"$raw" 2>&1 <<'REMOTE'
set -Eeuo pipefail
live_base="$1"
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit PREFLIGHT FAIL; emit ERROR_CODE "$1"; emit PRODUCTION_MUTATION NONE; exit "${2:-1}"; }

[[ "$live_base" == 'https://xn----8sbjf4befbjgs9b.xn--p1ai' ]] || fail LIVE_BASE_CONTRACT_INVALID 20
[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 21
command -v docker >/dev/null 2>&1 || fail DOCKER_MISSING 22
command -v curl >/dev/null 2>&1 || fail CURL_MISSING 23

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY_NOT_ONE 30
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null || true)"
[[ -n "$project" ]] || fail COMPOSE_PROJECT_MISSING 31
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail API_CARDINALITY_NOT_ONE 32
api_id="${api_ids[0]}"
mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#worker_ids[@]} == 1 )) || fail AUTH_MAIL_WORKER_CARDINALITY_NOT_ONE 33
worker_id="${worker_ids[0]}"

api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id" 2>/dev/null || true)"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id" 2>/dev/null || true)"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || fail API_REVISION_INVALID 34
[[ "$web_revision" =~ ^[0-9a-f]{40}$ ]] || fail WEB_REVISION_INVALID 35
[[ "$worker_revision" =~ ^[0-9a-f]{40}$ ]] || fail AUTH_MAIL_WORKER_REVISION_INVALID 36
[[ "$api_revision" == "$web_revision" ]] || fail API_WEB_REVISION_MISMATCH 37
[[ "$api_revision" == "$worker_revision" ]] || fail AUTH_MAIL_WORKER_REVISION_MISMATCH 38
worker_state="$(docker inspect --format '{{.State.Status}}' "$worker_id" 2>/dev/null || true)"
worker_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$worker_id" 2>/dev/null || true)"
[[ "$worker_state" == 'running' ]] || fail AUTH_MAIL_WORKER_NOT_RUNNING 39
[[ "$worker_health" == 'healthy' ]] || fail AUTH_MAIL_WORKER_NOT_HEALTHY 40

set +e
staff_result="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE' 2>&1
const { PrismaClient } = require('@prisma/client');
let db;
const fail = (code) => { throw new Error(code); };
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
  const p = principals[0];
  if (!p || p.user_name !== 'pc_staff_runtime' || p.rolsuper || p.rolbypassrls
      || p.can_read_users || p.can_read_memberships || p.can_read_organizations || p.can_read_assignments
      || !p.preflight_execute || !p.readiness_execute || !p.reset_subject_execute) {
    fail('P0_REVIEWER_RESET_PRINCIPAL_BOUNDARY_INVALID');
  }
  const rows = await db.$queryRawUnsafe(`
    SELECT preflight.active_owner_count,
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
  const r = rows[0];
  const counts = [
    Number(r.active_owner_count || 0), Number(r.usable_reviewer_count || 0),
    Number(r.assignment_ready_count || 0), Number(r.active_identity_ready_count || 0),
    Number(r.membership_ready_count || 0), Number(r.password_ready_count || 0),
    Number(r.mfa_enrolled_ready_count || 0), Number(r.login_ready_count || 0),
  ];
  if (counts.join('|') !== '1|1|1|1|1|0|0|0') fail('P0_REVIEWER_RESET_READINESS_NOT_EXACT');
  const email = String(r.reviewer_email || '');
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(email) || email.length > 254) fail('P0_REVIEWER_RESET_SUBJECT_INVALID');
  process.stdout.write('READINESS_PASS');
})().catch((error) => {
  const code = String(error?.message || 'P0_REVIEWER_RESET_PREFLIGHT_DB_FAILURE').replace(/[^A-Z0-9_-]/gi, '').slice(0, 96);
  process.stderr.write(`${code || 'P0_REVIEWER_RESET_PREFLIGHT_DB_FAILURE'}\n`);
  process.exitCode = 1;
}).finally(async () => { if (db) await db.$disconnect().catch(() => undefined); });
NODE
)"
staff_rc=$?
set -e
if (( staff_rc != 0 )); then
  staff_code="$(grep -Eo 'P0_[A-Z0-9_-]{1,92}' <<< "$staff_result" | tail -n 1 || true)"
  [[ -n "$staff_code" ]] || staff_code='P0_REVIEWER_RESET_PREFLIGHT_DB_FAILURE'
  fail "$staff_code" 50
fi
[[ "$staff_result" == 'READINESS_PASS' ]] || fail P0_REVIEWER_RESET_READINESS_OUTPUT_INVALID 51
unset staff_result

set +e
auth_result="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE' 2>&1
const { PrismaClient } = require('@prisma/client');
let db;
const fail = (code) => { throw new Error(code); };
const everyTrue = (row, keys) => keys.every((key) => row?.[key] === true);
const publicExecute = (row) => row?.public_execute === true;
(async () => {
  const authUrl = String(process.env.AUTH_DATABASE_URL || '').trim();
  const dealUrl = String(process.env.DATABASE_URL || '').trim();
  if (!authUrl) fail('P0_AUTH_DATABASE_URL_MISSING');
  if (dealUrl && authUrl === dealUrl) fail('P0_AUTH_DATABASE_URL_NOT_ISOLATED');
  db = new PrismaClient({ datasources: { db: { url: authUrl } }, log: [] });
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const readOnly = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') = 'on' AS ok");
    if (readOnly.length !== 1 || readOnly[0]?.ok !== true) fail('P0_RESET_CAPABILITY_NOT_READ_ONLY');

    const runtimeRows = await tx.$queryRawUnsafe(`
      SELECT NOT r.rolsuper AS no_super,
             NOT r.rolbypassrls AS no_bypass,
             NOT r.rolinherit AS no_inherit,
             current_user = session_user AS same_session,
             NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS no_memberships,
             has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_usage,
             has_table_privilege(current_user, 'public.users', 'SELECT') AS users_select,
             has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT') AS challenge_select,
             has_table_privilege(current_user, 'auth.password_reset_challenges', 'INSERT') AS challenge_insert,
             has_table_privilege(current_user, 'auth.password_reset_challenges', 'UPDATE') AS challenge_update,
             NOT has_table_privilege(current_user, 'auth.password_reset_challenges', 'DELETE') AS no_challenge_delete,
             NOT has_table_privilege(current_user, 'auth.password_reset_challenges', 'TRUNCATE') AS no_challenge_truncate,
             (has_table_privilege(current_user, 'auth.audit_events', 'SELECT') OR has_any_column_privilege(current_user, 'auth.audit_events', 'SELECT')) AS audit_select,
             (has_table_privilege(current_user, 'auth.audit_events', 'INSERT') OR has_any_column_privilege(current_user, 'auth.audit_events', 'INSERT')) AS audit_insert,
             (has_table_privilege(current_user, 'auth.credential_states', 'SELECT') OR has_any_column_privilege(current_user, 'auth.credential_states', 'SELECT')) AS credential_select,
             (has_table_privilege(current_user, 'auth.credential_states', 'INSERT') OR has_any_column_privilege(current_user, 'auth.credential_states', 'INSERT')) AS credential_insert,
             (has_table_privilege(current_user, 'auth.credential_states', 'UPDATE') OR has_any_column_privilege(current_user, 'auth.credential_states', 'UPDATE')) AS credential_update,
             (has_table_privilege(current_user, 'auth.sessions', 'SELECT') OR has_any_column_privilege(current_user, 'auth.sessions', 'SELECT')) AS sessions_select,
             (has_table_privilege(current_user, 'auth.sessions', 'UPDATE') OR has_any_column_privilege(current_user, 'auth.sessions', 'UPDATE')) AS sessions_update,
             (has_table_privilege(current_user, 'auth.refresh_tokens', 'SELECT') OR has_any_column_privilege(current_user, 'auth.refresh_tokens', 'SELECT')) AS refresh_select,
             (has_table_privilege(current_user, 'auth.refresh_tokens', 'UPDATE') OR has_any_column_privilege(current_user, 'auth.refresh_tokens', 'UPDATE')) AS refresh_update,
             NOT (has_table_privilege(current_user, 'auth.mail_outbox', 'SELECT') OR has_any_column_privilege(current_user, 'auth.mail_outbox', 'SELECT')) AS no_direct_outbox_select,
             NOT (has_table_privilege(current_user, 'auth.mail_outbox', 'INSERT') OR has_any_column_privilege(current_user, 'auth.mail_outbox', 'INSERT')) AS no_direct_outbox_insert
      FROM pg_roles r WHERE r.rolname = current_user
    `);
    const runtime = runtimeRows[0];
    const runtimeKeys = [
      'no_super','no_bypass','no_inherit','same_session','no_memberships','auth_usage','users_select',
      'challenge_select','challenge_insert','challenge_update','no_challenge_delete','no_challenge_truncate',
      'audit_select','audit_insert','credential_select','credential_insert','credential_update',
      'sessions_select','sessions_update','refresh_select','refresh_update',
      'no_direct_outbox_select','no_direct_outbox_insert',
    ];
    if (runtimeRows.length !== 1 || !everyTrue(runtime, runtimeKeys)) fail('P0_RESET_RUNTIME_CAPABILITY_MISSING');

    const functionProbe = async (signature, expectedOwner, expectedConfig) => {
      const rows = await tx.$queryRawUnsafe(`
        SELECT p.prosecdef AS security_definer,
               owner.rolname AS owner_name,
               coalesce(has_function_privilege(current_user, p.oid, 'EXECUTE'), false) AS runtime_execute,
               EXISTS (
                 SELECT 1
                 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                 WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
               ) AS public_execute,
               coalesce(p.proconfig, ARRAY[]::text[]) AS config
        FROM pg_proc p
        JOIN pg_roles owner ON owner.oid = p.proowner
        WHERE p.oid = to_regprocedure('${signature}')
      `);
      if (rows.length !== 1) fail('P0_RESET_FUNCTION_MISSING');
      const row = rows[0];
      if (row.security_definer !== true || row.owner_name !== expectedOwner || row.runtime_execute !== true || publicExecute(row)) {
        fail('P0_RESET_FUNCTION_BOUNDARY_INVALID');
      }
      const config = Array.isArray(row.config) ? row.config.map(String) : [];
      if (!expectedConfig.every((entry) => config.includes(entry))) fail('P0_RESET_FUNCTION_CONFIG_INVALID');
      return row;
    };

    await functionProbe(
      'auth.resolve_password_reset_subject(text)',
      'pc_password_reset_authority',
      ['search_path=public, pg_temp', 'row_security=on'],
    );
    await functionProbe(
      'auth.replace_password_after_reset(text,text,text,timestamp with time zone)',
      'pc_password_reset_authority',
      ['search_path=public, auth, pg_temp', 'row_security=on'],
    );
    await functionProbe(
      'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamp with time zone,timestamp with time zone)',
      'pc_auth_mail_enqueue_authority',
      ['search_path=pg_catalog, auth, pg_temp', 'row_security=on'],
    );

    const passwordOwnerRows = await tx.$queryRawUnsafe(`
      SELECT NOT r.rolsuper AS no_super,
             NOT r.rolbypassrls AS no_bypass,
             NOT r.rolinherit AS no_inherit,
             NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.roleid = r.oid OR m.member = r.oid) AS no_memberships,
             has_schema_privilege(r.rolname, 'public', 'USAGE') AS public_usage,
             has_schema_privilege(r.rolname, 'auth', 'USAGE') AS auth_usage,
             (has_table_privilege(r.rolname, 'public.users', 'SELECT') OR has_any_column_privilege(r.rolname, 'public.users', 'SELECT')) AS users_select,
             (has_table_privilege(r.rolname, 'public.users', 'UPDATE') OR has_any_column_privilege(r.rolname, 'public.users', 'UPDATE')) AS users_update,
             NOT has_table_privilege(r.rolname, 'public.users', 'INSERT') AS no_users_insert,
             NOT has_table_privilege(r.rolname, 'public.users', 'DELETE') AS no_users_delete,
             has_table_privilege(r.rolname, 'auth.password_reset_challenges', 'SELECT') AS challenge_select
      FROM pg_roles r WHERE r.rolname = 'pc_password_reset_authority'
    `);
    const passwordOwner = passwordOwnerRows[0];
    if (passwordOwnerRows.length !== 1 || !everyTrue(passwordOwner, [
      'no_super','no_bypass','no_inherit','no_memberships','public_usage','auth_usage',
      'users_select','users_update','no_users_insert','no_users_delete','challenge_select',
    ])) fail('P0_RESET_USERS_AUTHORITY_INVALID');

    const sequenceRows = await tx.$queryRawUnsafe(`
      SELECT count(*)::int AS sequence_count,
             coalesce(bool_and(has_sequence_privilege('pc_password_reset_authority', seq.oid, 'UPDATE')), true) AS sequence_update_ok
      FROM pg_class seq
      JOIN pg_depend dep ON dep.objid = seq.oid AND dep.deptype IN ('a','i')
      JOIN pg_class target ON target.oid = dep.refobjid
      JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
      WHERE seq.relkind = 'S'
        AND target_ns.nspname = 'public'
        AND target.relname = 'users'
    `);
    if (sequenceRows.length !== 1 || sequenceRows[0]?.sequence_update_ok !== true) fail('P0_RESET_USERS_SEQUENCE_AUTHORITY_INVALID');

    const enqueueOwnerRows = await tx.$queryRawUnsafe(`
      SELECT NOT r.rolsuper AS no_super,
             NOT r.rolbypassrls AS no_bypass,
             NOT r.rolinherit AS no_inherit,
             NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.roleid = r.oid OR m.member = r.oid) AS no_memberships,
             has_schema_privilege(r.rolname, 'auth', 'USAGE') AS auth_usage,
             has_table_privilege(r.rolname, 'auth.mail_outbox', 'SELECT') AS outbox_select,
             has_table_privilege(r.rolname, 'auth.mail_outbox', 'INSERT') AS outbox_insert,
             NOT has_table_privilege(r.rolname, 'auth.mail_outbox', 'UPDATE') AS no_outbox_update,
             NOT has_table_privilege(r.rolname, 'auth.mail_outbox', 'DELETE') AS no_outbox_delete,
             relation.relrowsecurity AS rls_enabled,
             relation.relforcerowsecurity AS rls_forced
      FROM pg_roles r
      CROSS JOIN pg_class relation
      JOIN pg_namespace schema ON schema.oid = relation.relnamespace
      WHERE r.rolname = 'pc_auth_mail_enqueue_authority'
        AND schema.nspname = 'auth'
        AND relation.relname = 'mail_outbox'
        AND relation.relkind IN ('r','p')
    `);
    const enqueueOwner = enqueueOwnerRows[0];
    if (enqueueOwnerRows.length !== 1 || !everyTrue(enqueueOwner, [
      'no_super','no_bypass','no_inherit','no_memberships','auth_usage',
      'outbox_select','outbox_insert','no_outbox_update','no_outbox_delete','rls_enabled','rls_forced',
    ])) fail('P0_RESET_OUTBOX_AUTHORITY_INVALID');

    return { sequenceCount: Number(sequenceRows[0].sequence_count || 0) };
  }, { timeout: 15000, maxWait: 5000 });

  process.stdout.write(`AUTH_CAPABILITY_PASS|${result.sequenceCount === 0 ? 'NO_OWNED_SEQUENCE' : 'OWNED_SEQUENCE_UPDATE'}`);
})().catch((error) => {
  const code = String(error?.message || 'P0_RESET_CAPABILITY_PREFLIGHT_FAILURE').replace(/[^A-Z0-9_-]/gi, '').slice(0, 96);
  process.stderr.write(`${code || 'P0_RESET_CAPABILITY_PREFLIGHT_FAILURE'}\n`);
  process.exitCode = 1;
}).finally(async () => { if (db) await db.$disconnect().catch(() => undefined); });
NODE
)"
auth_rc=$?
set -e
if (( auth_rc != 0 )); then
  auth_code="$(grep -Eo 'P0_[A-Z0-9_-]{1,92}' <<< "$auth_result" | tail -n 1 || true)"
  [[ -n "$auth_code" ]] || auth_code='P0_RESET_CAPABILITY_PREFLIGHT_FAILURE'
  fail "$auth_code" 52
fi
[[ "$auth_result" =~ ^AUTH_CAPABILITY_PASS\|(NO_OWNED_SEQUENCE|OWNED_SEQUENCE_UPDATE)$ ]] || fail P0_RESET_CAPABILITY_OUTPUT_INVALID 53
sequence_mode="${auth_result#AUTH_CAPABILITY_PASS|}"
unset auth_result

tmp="$(mktemp -d /root/p0-reset-drift-preflight.XXXXXX)"
trap 'rm -rf -- "$tmp"' EXIT
jar="$tmp/cookies.txt"; page="$tmp/page.html"
: > "$jar"; chmod 0600 "$jar"
set +e
get_status="$(curl --silent --show-error --connect-timeout 10 --max-time 20 \
  --output "$page" --write-out '%{http_code}' \
  --cookie "$jar" --cookie-jar "$jar" \
  -H 'Cache-Control: no-cache, no-store, max-age=0' \
  "$live_base/platform-v7/forgot-password?lang=ru" 2>/dev/null)"
curl_rc=$?
set -e
(( curl_rc == 0 )) || fail FORGOT_PASSWORD_GET_TRANSPORT_FAILED 60
[[ "$get_status" == '200' ]] || fail FORGOT_PASSWORD_GET_NOT_200 61
csrf="$(awk -F '\t' '$6 == "pc_csrf_token" { value=$7 } END { print value }' "$jar")"
[[ "$csrf" =~ ^[A-Za-z0-9_-]{24,128}$ ]] || fail CSRF_ISSUANCE_INVALID 62
unset csrf

emit PREFLIGHT PASS
emit ERROR_CODE NONE
emit RUNTIME_DEPLOYED_SHA "$api_revision"
emit DEPLOYED_PARITY PASS
emit AUTH_MAIL_WORKER_READY PASS
emit REVIEWER_READINESS '1|1|1|1|1|0|0|0'
emit RESET_CREATE PASS
emit RESET_CONSUME PASS
emit USERS_EFFECTIVE_AUTHORITY PASS
emit USERS_SEQUENCE_UPDATE "$sequence_mode"
emit OUTBOX_EFFECTIVE_AUTHORITY PASS
emit FORGOT_PASSWORD_GET PASS
emit CSRF_ISSUANCE PASS
emit PRODUCTION_MUTATION NONE
REMOTE
ssh_rc=$?
set -e
trap publish_failure ERR

remote_code="$(grep -E '^ERROR_CODE=[A-Z0-9_]{1,96}$' "$raw" | tail -n 1 | cut -d= -f2- || true)"
remote_result="$(grep -E '^PREFLIGHT=(PASS|FAIL)$' "$raw" | tail -n 1 | cut -d= -f2- || true)"
if (( ssh_rc != 0 )) || [[ "$remote_result" != 'PASS' ]]; then
  [[ -n "$remote_code" && "$remote_code" != 'NONE' ]] || remote_code='REMOTE_RUNTIME_PREFLIGHT_FAILED'
  failure_reason="$remote_code"
  false
fi

RUNTIME_DEPLOYED_SHA="$(grep -E '^RUNTIME_DEPLOYED_SHA=[0-9a-f]{40}$' "$raw" | tail -n 1 | cut -d= -f2- || true)"
[[ "$RUNTIME_DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]
grep -Fxq 'DEPLOYED_PARITY=PASS' "$raw"
grep -Fxq 'AUTH_MAIL_WORKER_READY=PASS' "$raw"
grep -Fxq 'REVIEWER_READINESS=1|1|1|1|1|0|0|0' "$raw"
grep -Fxq 'RESET_CREATE=PASS' "$raw"
grep -Fxq 'RESET_CONSUME=PASS' "$raw"
grep -Fxq 'USERS_EFFECTIVE_AUTHORITY=PASS' "$raw"
grep -Eq '^USERS_SEQUENCE_UPDATE=(NO_OWNED_SEQUENCE|OWNED_SEQUENCE_UPDATE)$' "$raw"
grep -Fxq 'OUTBOX_EFFECTIVE_AUTHORITY=PASS' "$raw"
grep -Fxq 'FORGOT_PASSWORD_GET=PASS' "$raw"
grep -Fxq 'CSRF_ISSUANCE=PASS' "$raw"
grep -Fxq 'PRODUCTION_MUTATION=NONE' "$raw"
users_sequence_mode="$(grep -E '^USERS_SEQUENCE_UPDATE=(NO_OWNED_SEQUENCE|OWNED_SEQUENCE_UPDATE)$' "$raw" | tail -n1 | cut -d= -f2-)"
rm -f -- "$raw"

failure_reason='RUNTIME_REVISION_NOT_IN_REPOSITORY'
guard_main
git cat-file -e "${RUNTIME_DEPLOYED_SHA}^{commit}"

failure_reason='RUNTIME_REVISION_BEFORE_REVIEWED_RESET_REFERENCE'
git merge-base --is-ancestor "$REVIEWED_RESET_SHA" "$RUNTIME_DEPLOYED_SHA"

failure_reason='RUNTIME_REVISION_NOT_ANCESTOR_OF_MAIN'
git merge-base --is-ancestor "$RUNTIME_DEPLOYED_SHA" "$TARGET_SHA"

failure_reason='RESET_CRITICAL_MANIFEST_INVALID'
(( ${#RESET_CRITICAL_PATHS[@]} == 21 ))
for path in "${RESET_CRITICAL_PATHS[@]}"; do
  git cat-file -e "$REVIEWED_RESET_SHA:$path"
  git cat-file -e "$RUNTIME_DEPLOYED_SHA:$path"
  reviewed_blob="$(git rev-parse "$REVIEWED_RESET_SHA:$path")"
  runtime_blob="$(git rev-parse "$RUNTIME_DEPLOYED_SHA:$path")"
  [[ "$reviewed_blob" == "$runtime_blob" ]]
done

failure_reason='MAIN_GUARD_FAILED'
guard_main

result_published=1
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset drift-tolerant preflight

- exact main: \`$TARGET_SHA\`
- live API/Web/auth-mail worker revision: \`$RUNTIME_DEPLOYED_SHA\`
- runtime revision parity: \`PASS\`
- reset-critical manifest equivalence to reviewed reference \`$REVIEWED_RESET_SHA\`: \`PASS\`
- manifest scope: \`${#RESET_CRITICAL_PATHS[@]} fixed files\`
- reset create capability: \`PASS\`
- reset consume capability: \`PASS\`
- users effective SELECT/UPDATE authority: \`PASS\`
- users owned-sequence authority: \`$users_sequence_mode\`
- outbox effective SELECT/INSERT authority via bounded SECURITY DEFINER: \`PASS\`
- direct runtime outbox table access: \`NONE\`
- auth-mail worker readiness: \`PASS\`
- reviewer readiness: \`1|1|1|1|1|0|0|0\`
- normalized IMAP proof run: \`$IMAP_RUN_ID / PASS\`
- SMTP587 STARTTLS AUTH-only proof run: \`$SMTP_RUN_ID / PASS\`
- forgot-password GET / CSRF issuance: \`PASS\`
- reset authorized: \`YES\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`
- next: \`EXACTLY_ONE_PASSWORD_RESET_REQUEST_AUTHORIZED\`" >/dev/null

printf 'RESET_AUTHORIZED=YES\n'
printf 'RUNTIME_DEPLOYED_SHA=%s\n' "$RUNTIME_DEPLOYED_SHA"
printf 'RESET_CREATE=PASS\n'
printf 'RESET_CONSUME=PASS\n'
printf 'OUTBOX_EFFECTIVE_AUTHORITY=PASS\n'
printf 'PRODUCTION_MUTATION=NONE\n'
