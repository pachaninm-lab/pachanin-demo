#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-reviewer-reset-subject-diagnose current-main'
EXPECTED_DEPLOYED_SHA='unknown'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-subject-diag-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-subject-diag-known-hosts"
TARGET_SHA='unknown'
result_published=0

cleanup() { rm -f -- "$key_path" "$known_hosts"; }
trap cleanup EXIT

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset-subject ACL diagnostic

- exact diagnostic main: \`$TARGET_SHA\`
- expected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
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
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
EXPECTED_DEPLOYED_SHA="$TARGET_SHA"
[[ "$EXPECTED_DEPLOYED_SHA" == "$TARGET_SHA" ]]
[[ -z "$(git status --porcelain=v1)" ]]

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

try_key "${PC_PROD_SSH_KEY:-}" \
  || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" \
  || try_key "${VPS_SSH_KEY:-}"
guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fingerprint="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fingerprint" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == '1' ]]
mv "$match" "$known_hosts"; rm -f "$scan"; chmod 0600 "$known_hosts"

guard_main
output="$(ssh -i "$key_path" -p "$port" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 \
  "$user@$host" "bash -s -- '$EXPECTED_DEPLOYED_SHA'" <<'REMOTE'
set -Eeuo pipefail
expected_sha="$1"
[[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]]
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
[[ "$api_revision" == "$expected_sha" && "$web_revision" == "$expected_sha" ]]

# Only catalog privilege booleans and the reset-subject SQLSTATE leave the
# container. No reviewer row, email, identifier, token, password or TOTP value
# is printed or persisted.
docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');
let db;
const bit = (value) => value === true ? '1' : '0';
const safeCode = (error) => {
  const raw = String(error?.meta?.code || error?.code || 'UNKNOWN');
  return /^[A-Za-z0-9_-]{1,16}$/.test(raw) ? raw : 'UNKNOWN';
};

(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) throw Object.assign(new Error('missing_staff_db'), { code: 'NODB' });
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  const rows = await db.$queryRawUnsafe(`
    SELECT
      current_user = 'pc_staff_runtime' AS runtime_ok,
      has_schema_privilege('pc_staff_authority', 'public', 'USAGE') AS public_schema,
      has_schema_privilege('pc_staff_authority', 'auth', 'USAGE') AS auth_schema,
      has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'SELECT') AS assignments_select,
      has_column_privilege('pc_staff_authority', 'public.users', 'id', 'SELECT') AS users_id,
      has_column_privilege('pc_staff_authority', 'public.users', 'email', 'SELECT') AS users_email,
      has_column_privilege('pc_staff_authority', 'public.users', 'passwordHash', 'SELECT') AS users_password,
      has_column_privilege('pc_staff_authority', 'public.users', 'status', 'SELECT') AS users_status,
      has_column_privilege('pc_staff_authority', 'public.users', 'deletedAt', 'SELECT') AS users_deleted,
      has_column_privilege('pc_staff_authority', 'public.user_orgs', 'id', 'SELECT') AS membership_id,
      has_column_privilege('pc_staff_authority', 'public.user_orgs', 'userId', 'SELECT') AS membership_user,
      has_column_privilege('pc_staff_authority', 'public.user_orgs', 'organizationId', 'SELECT') AS membership_org,
      has_column_privilege('pc_staff_authority', 'public.user_orgs', 'status', 'SELECT') AS membership_status,
      has_column_privilege('pc_staff_authority', 'public.organizations', 'id', 'SELECT') AS organization_id,
      has_column_privilege('pc_staff_authority', 'public.organizations', 'tenantId', 'SELECT') AS organization_tenant,
      has_column_privilege('pc_staff_authority', 'public.organizations', 'status', 'SELECT') AS organization_status,
      has_function_privilege('pc_staff_runtime', 'auth.staff_reviewer_password_reset_subject()', 'EXECUTE') AS runtime_execute,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
        WHERE n.nspname = 'auth'
          AND p.proname = 'staff_reviewer_password_reset_subject'
          AND p.pronargs = 0 AND p.prosecdef
          AND r.rolname = 'pc_staff_authority'
          AND 'row_security=on' = ANY(coalesce(p.proconfig, ARRAY[]::text[]))
      ) AS function_boundary,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = 'users'
          AND policyname = 'users_staff_reviewer_password_reset_subject'
          AND 'pc_staff_authority' = ANY(roles)
      ) AS users_policy,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = 'user_orgs'
          AND policyname = 'user_orgs_staff_reviewer_password_reset_subject'
          AND 'pc_staff_authority' = ANY(roles)
      ) AS membership_policy,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = 'organizations'
          AND policyname = 'organizations_staff_reviewer_password_reset_subject'
          AND 'pc_staff_authority' = ANY(roles)
      ) AS organization_policy,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'users'
          AND c.relrowsecurity AND c.relforcerowsecurity
      ) AS users_force_rls,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'user_orgs'
          AND c.relrowsecurity AND c.relforcerowsecurity
      ) AS membership_force_rls,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'organizations'
          AND c.relrowsecurity AND c.relforcerowsecurity
      ) AS organization_force_rls
  `);
  if (rows.length !== 1) throw Object.assign(new Error('catalog_cardinality'), { code: 'CATALOG' });
  const r = rows[0];
  const fields = [
    'runtime_ok','public_schema','auth_schema','assignments_select',
    'users_id','users_email','users_password','users_status','users_deleted',
    'membership_id','membership_user','membership_org','membership_status',
    'organization_id','organization_tenant','organization_status',
    'runtime_execute','function_boundary','users_policy','membership_policy',
    'organization_policy','users_force_rls','membership_force_rls','organization_force_rls',
  ];
  process.stdout.write('RESET_SUBJECT_ACL|' + fields.map((name) => bit(r[name])).join('|') + '\n');

  let subjectCall = 'PASS';
  try {
    const probe = await db.$queryRawUnsafe(`
      SELECT auth.staff_reviewer_password_reset_subject() IS NOT NULL AS eligible
    `);
    if (probe.length !== 1 || probe[0]?.eligible !== true) subjectCall = 'EMPTY';
  } catch (error) {
    subjectCall = safeCode(error);
  }
  process.stdout.write(`RESET_SUBJECT_CALL|${subjectCall}\n`);
  process.stdout.write('PRODUCTION_MUTATION=NONE\n');
})().catch((error) => {
  process.stderr.write(`RESET_SUBJECT_DIAG_ERROR|${safeCode(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.$disconnect().catch(() => undefined);
});
NODE
REMOTE
)"

acl="$(grep '^RESET_SUBJECT_ACL|' <<< "$output" | tail -n1)"
call="$(grep '^RESET_SUBJECT_CALL|' <<< "$output" | tail -n1)"
mutation="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1)"
[[ "$acl" =~ ^RESET_SUBJECT_ACL\|[01](\|[01]){23}$ ]]
[[ "$call" =~ ^RESET_SUBJECT_CALL\|(PASS|EMPTY|[A-Za-z0-9_-]{1,16})$ ]]
[[ "$mutation" == 'PRODUCTION_MUTATION=NONE' ]]

IFS='|' read -r _ runtime_ok public_schema auth_schema assignments_select \
  users_id users_email users_password users_status users_deleted \
  membership_id membership_user membership_org membership_status \
  organization_id organization_tenant organization_status runtime_execute \
  function_boundary users_policy membership_policy organization_policy \
  users_force_rls membership_force_rls organization_force_rls <<< "$acl"
IFS='|' read -r _ subject_call <<< "$call"

guard_main
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset-subject ACL diagnostic

- exact diagnostic main: \`$TARGET_SHA\`
- inspected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`PASS_READ_ONLY\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`
- runtime principal confined: \`$runtime_ok\`
- authority schema usage public/auth: \`$public_schema/$auth_schema\`
- authority staff_assignments SELECT: \`$assignments_select\`
- users required columns: \`$users_id$users_email$users_password$users_status$users_deleted\`
- membership required columns: \`$membership_id$membership_user$membership_org$membership_status\`
- organization required columns: \`$organization_id$organization_tenant$organization_status\`
- runtime function EXECUTE / definer boundary: \`$runtime_execute/$function_boundary\`
- reset RLS policies users/membership/organization: \`$users_policy/$membership_policy/$organization_policy\`
- FORCE RLS users/membership/organization: \`$users_force_rls/$membership_force_rls/$organization_force_rls\`
- reset-subject call class: \`$subject_call\`" >/dev/null
result_published=1
