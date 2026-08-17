#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

BASELINE_SHA='440e40753e2cac13c93f8e007d9fe17c2b66caba'
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
git cat-file -e "${BASELINE_SHA}^{commit}"
git merge-base --is-ancestor "$BASELINE_SHA" "$TARGET_SHA"

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
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
sort -u -o "$match" "$match"
[[ "$(grep -c . "$match" || true)" == '1' ]]
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
db_result="$(docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE' 2>&1
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
db_rc=$?
set -e
if (( db_rc != 0 )); then
  db_code="$(grep -Eo 'P0_[A-Z0-9_-]{1,92}' <<< "$db_result" | tail -n 1 || true)"
  [[ -n "$db_code" ]] || db_code='P0_REVIEWER_RESET_PREFLIGHT_DB_FAILURE'
  fail "$db_code" 50
fi
[[ "$db_result" == 'READINESS_PASS' ]] || fail P0_REVIEWER_RESET_READINESS_OUTPUT_INVALID 51
unset db_result

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
grep -Fxq 'FORGOT_PASSWORD_GET=PASS' "$raw"
grep -Fxq 'CSRF_ISSUANCE=PASS' "$raw"
grep -Fxq 'PRODUCTION_MUTATION=NONE' "$raw"
rm -f -- "$raw"

failure_reason='RUNTIME_REVISION_NOT_IN_REPOSITORY'
guard_main
git cat-file -e "${RUNTIME_DEPLOYED_SHA}^{commit}"

failure_reason='RUNTIME_REVISION_BEFORE_SAFE_BASELINE'
git merge-base --is-ancestor "$BASELINE_SHA" "$RUNTIME_DEPLOYED_SHA"

failure_reason='RUNTIME_REVISION_NOT_ANCESTOR_OF_MAIN'
git merge-base --is-ancestor "$RUNTIME_DEPLOYED_SHA" "$TARGET_SHA"

failure_reason='RESET_CRITICAL_CODE_DRIFT'
git diff --quiet "$BASELINE_SHA..$RUNTIME_DEPLOYED_SHA" -- apps/api/src apps/api/prisma infra/docker

failure_reason='MAIN_GUARD_FAILED'
guard_main

result_published=1
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset drift-tolerant preflight

- exact main: \`$TARGET_SHA\`
- live API/Web/auth-mail worker revision: \`$RUNTIME_DEPLOYED_SHA\`
- runtime revision parity: \`PASS\`
- reset-critical code equivalence to reviewed baseline \`$BASELINE_SHA\`: \`PASS\`
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
printf 'PRODUCTION_MUTATION=NONE\n'