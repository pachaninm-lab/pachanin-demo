#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
EXPECTED_DEPLOYED_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'

key_path="$RUNNER_TEMP/pc-p0-reviewer-reset-stage-key"
known_hosts="$RUNNER_TEMP/pc-p0-reviewer-reset-stage-known-hosts"
TARGET_SHA='unknown'
result_published=0
last_stage='BOOTSTRAP'
scan=''
match=''

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="$?"
  trap - ERR
  if [[ "$result_published" == '0' ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset DB-stage classifier

- exact diagnostic main: \`$TARGET_SHA\`
- expected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- last completed stage: \`$last_stage\`
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
git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"
[[ -z "$(git status --porcelain=v1)" ]]
last_stage='MAIN_GUARD'

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
last_stage='SSH_KEY'
guard_main

domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
last_stage='DNS'

scan="$(mktemp)"
match="$(mktemp)"
pinned_ready=0
for attempt in 1 2 3; do
  : > "$scan"
  : > "$match"
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
mv "$match" "$known_hosts"
match=''
rm -f -- "$scan"
scan=''
chmod 0600 "$known_hosts"
last_stage='HOST_KEY'

guard_main
ssh_opts=(
  -i "$key_path" -p "$port"
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes
  -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15
)
ssh "${ssh_opts[@]}" "$user@$host" \
  'set -euo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null' >/dev/null
last_stage='SSH_TRANSPORT'

guard_main
output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$EXPECTED_DEPLOYED_SHA'" <<'REMOTE'
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
printf 'PARITY|PASS\n'

docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');
let db;
let authDb;
let reviewerEmail = '';
let authUserId = '';
const safeCode = (error) => {
  const raw = String(error?.meta?.code || error?.code || 'UNKNOWN');
  return /^[A-Za-z0-9_-]{1,20}$/.test(raw) ? raw : 'UNKNOWN';
};
const result = (stage, ok, code = '') => {
  process.stdout.write(`${stage}|${ok ? 'PASS' : `FAIL_${code || 'UNKNOWN'}`}\n`);
};
const isSafeCount = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;

(async () => {
  const databaseUrl = String(process.env.STAFF_DATABASE_URL || '').trim();
  if (!databaseUrl) {
    result('DATABASE_URL', false, 'NODB');
    return;
  }
  result('DATABASE_URL', true);
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const rows = await db.$queryRawUnsafe(`
      SELECT
        current_user = 'pc_staff_runtime' AS runtime_ok,
        NOT rolsuper AS no_super,
        NOT rolbypassrls AS no_bypass,
        NOT rolinherit AS no_inherit,
        NOT has_table_privilege(current_user, 'public.users', 'SELECT') AS users_table_free,
        NOT has_table_privilege(current_user, 'public.user_orgs', 'SELECT') AS memberships_table_free,
        NOT has_table_privilege(current_user, 'public.organizations', 'SELECT') AS organizations_table_free,
        NOT has_table_privilege(current_user, 'auth.staff_assignments', 'SELECT') AS assignments_table_free,
        NOT has_table_privilege(current_user, 'auth.credential_states', 'SELECT') AS credentials_table_free,
        coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_preflight()'), 'EXECUTE'), false) AS preflight_execute,
        coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_login_readiness()'), 'EXECUTE'), false) AS readiness_execute,
        coalesce(has_function_privilege(current_user, to_regprocedure('auth.staff_reviewer_password_reset_subject()'), 'EXECUTE'), false) AS reset_execute
      FROM pg_roles WHERE rolname = current_user
    `);
    const r = rows[0];
    const ok = rows.length === 1 && Object.values(r).every((v) => v === true);
    result('PRINCIPAL_BOUNDARY', ok, ok ? '' : 'BOUNDARY');
  } catch (error) {
    result('PRINCIPAL_BOUNDARY', false, safeCode(error));
  }

  const defProbe = async (stage, signature) => {
    try {
      const rows = await db.$queryRawUnsafe(`
        SELECT
          p.prosecdef AS security_definer,
          owner.rolname = 'pc_staff_authority' AS owner_ok,
          'row_security=on' = ANY(coalesce(p.proconfig, ARRAY[]::text[])) AS row_security_on,
          coalesce(has_function_privilege(current_user, p.oid, 'EXECUTE'), false) AS executable
        FROM pg_proc p
        JOIN pg_roles owner ON owner.oid = p.proowner
        WHERE p.oid = to_regprocedure('${signature}')
      `);
      const r = rows[0];
      const ok = rows.length === 1 && r.security_definer === true && r.owner_ok === true
        && r.row_security_on === true && r.executable === true;
      result(stage, ok, ok ? '' : 'DEFINITION');
    } catch (error) {
      result(stage, false, safeCode(error));
    }
  };

  await defProbe('PREFLIGHT_DEFINITION', 'auth.staff_reviewer_preflight()');
  await defProbe('READINESS_DEFINITION', 'auth.staff_reviewer_login_readiness()');
  await defProbe('RESET_SUBJECT_DEFINITION', 'auth.staff_reviewer_password_reset_subject()');

  try {
    const rows = await db.$queryRawUnsafe(`SELECT * FROM auth.staff_reviewer_preflight()`);
    const r = rows[0];
    const ok = rows.length === 1
      && isSafeCount(r?.active_owner_count)
      && isSafeCount(r?.usable_reviewer_count)
      && Number(r?.active_owner_count) === 1
      && Number(r?.usable_reviewer_count) === 1;
    result('PREFLIGHT_CALL', ok, ok ? '' : 'UNEXPECTED');
  } catch (error) {
    result('PREFLIGHT_CALL', false, safeCode(error));
  }

  try {
    const rows = await db.$queryRawUnsafe(`SELECT * FROM auth.staff_reviewer_login_readiness()`);
    const r = rows[0];
    const fields = [
      'assignment_ready_count', 'active_identity_ready_count', 'membership_ready_count',
      'password_ready_count', 'mfa_enrolled_ready_count', 'login_ready_count',
    ];
    const expected = [1, 1, 1, 0, 0, 0];
    const ok = rows.length === 1 && fields.every((name, index) =>
      isSafeCount(r?.[name]) && Number(r?.[name]) === expected[index]
    );
    result('READINESS_CALL', ok, ok ? '' : 'UNEXPECTED');
  } catch (error) {
    result('READINESS_CALL', false, safeCode(error));
  }

  try {
    const rows = await db.$queryRawUnsafe(`SELECT auth.staff_reviewer_password_reset_subject() IS NOT NULL AS eligible`);
    const ok = rows.length === 1 && rows[0]?.eligible === true;
    result('RESET_SUBJECT_CALL', ok, ok ? '' : 'EMPTY');
  } catch (error) {
    result('RESET_SUBJECT_CALL', false, safeCode(error));
  }

  try {
    const rows = await db.$queryRawUnsafe(`SELECT auth.staff_reviewer_password_reset_subject() AS reviewer_email`);
    reviewerEmail = String(rows[0]?.reviewer_email || '');
    const ok = rows.length === 1 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(reviewerEmail) && reviewerEmail.length <= 254;
    result('RESET_SUBJECT_CAPTURE', ok, ok ? '' : 'EMPTY');
    if (!ok) reviewerEmail = '';
  } catch (error) {
    reviewerEmail = '';
    result('RESET_SUBJECT_CAPTURE', false, safeCode(error));
  }

  const authUrl = String(process.env.DATABASE_URL || '').trim();
  if (!authUrl) {
    result('AUTH_DATABASE_URL', false, 'NODB');
  } else {
    result('AUTH_DATABASE_URL', true);
    authDb = new PrismaClient({ datasources: { db: { url: authUrl } } });
  }

  if (authDb) {
    try {
      const rows = await authDb.$queryRawUnsafe(`
        SELECT
          NOT rolsuper AS no_super,
          NOT rolbypassrls AS no_bypass,
          has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT') AS reset_select,
          has_table_privilege(current_user, 'auth.audit_events', 'SELECT') AS audit_select,
          coalesce(has_function_privilege(current_user, to_regprocedure('auth.resolve_password_reset_subject(text)'), 'EXECUTE'), false) AS subject_execute
        FROM pg_roles WHERE rolname = current_user
      `);
      const r = rows[0];
      const ok = rows.length === 1 && Object.values(r).every((v) => v === true);
      result('AUTH_PRINCIPAL', ok, ok ? '' : 'BOUNDARY');
    } catch (error) {
      result('AUTH_PRINCIPAL', false, safeCode(error));
    }
  } else {
    result('AUTH_PRINCIPAL', false, 'SKIPPED');
  }

  if (authDb && reviewerEmail) {
    try {
      const rows = await authDb.$queryRawUnsafe(
        `SELECT user_id FROM auth.resolve_password_reset_subject($1)`, reviewerEmail,
      );
      const ok = rows.length === 1 && Boolean(String(rows[0]?.user_id || ''));
      if (ok) authUserId = String(rows[0].user_id);
      result('AUTH_SUBJECT_CALL', ok, ok ? '' : 'EMPTY');
    } catch (error) {
      authUserId = '';
      result('AUTH_SUBJECT_CALL', false, safeCode(error));
    }
  } else {
    result('AUTH_SUBJECT_CALL', false, 'SKIPPED');
  }

  if (authDb && authUserId) {
    try {
      const rows = await authDb.$queryRawUnsafe(`
        SELECT
          count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz)::int AS first_count,
          count(*) FILTER (WHERE created_at >= $4::timestamptz AND created_at <= $5::timestamptz)::int AS second_count,
          count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $5::timestamptz)::int AS combined_count,
          count(*) FILTER (WHERE status = 'PENDING' AND expires_at > now())::int AS unexpired_pending_count,
          coalesce((SELECT c.status FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), 'NONE') AS latest_status,
          coalesce((SELECT c.expires_at <= now() FROM auth.password_reset_challenges c WHERE c.user_id = $1 ORDER BY c.created_at DESC, c.id DESC LIMIT 1), true) AS latest_expired
        FROM auth.password_reset_challenges
        WHERE user_id = $1
      `, authUserId, '2026-08-12T22:51:40Z', '2026-08-12T22:52:30Z', '2026-08-12T22:53:10Z', '2026-08-12T22:54:05Z');
      const ok = rows.length === 1;
      result('CHALLENGE_READ', ok, ok ? '' : 'UNEXPECTED');
    } catch (error) {
      result('CHALLENGE_READ', false, safeCode(error));
    }
  } else {
    result('CHALLENGE_READ', false, 'SKIPPED');
  }

  if (authDb && authUserId) {
    try {
      const rows = await authDb.$queryRawUnsafe(`
        SELECT
          count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz AND reason = 'CHALLENGE_ISSUED')::int AS first_issued,
          count(*) FILTER (WHERE created_at >= $4::timestamptz AND created_at <= $5::timestamptz AND reason = 'CHALLENGE_ISSUED')::int AS second_issued,
          count(*) FILTER (WHERE created_at >= $2::timestamptz AND created_at <= $3::timestamptz AND reason = 'COOLDOWN_ACTIVE')::int AS first_cooldown,
          count(*) FILTER (WHERE created_at >= $4::timestamptz AND created_at <= $5::timestamptz AND reason = 'COOLDOWN_ACTIVE')::int AS second_cooldown,
          count(*) FILTER (
            WHERE created_at >= $2::timestamptz AND created_at <= $5::timestamptz
              AND coalesce(reason, '') NOT IN ('CHALLENGE_ISSUED', 'COOLDOWN_ACTIVE')
          )::int AS other_count
        FROM auth.audit_events
        WHERE user_id = $1 AND action = 'auth.password_reset.request'
      `, authUserId, '2026-08-12T22:51:40Z', '2026-08-12T22:52:30Z', '2026-08-12T22:53:10Z', '2026-08-12T22:54:05Z');
      const ok = rows.length === 1;
      result('AUDIT_READ', ok, ok ? '' : 'UNEXPECTED');
    } catch (error) {
      result('AUDIT_READ', false, safeCode(error));
    }
  } else {
    result('AUDIT_READ', false, 'SKIPPED');
  }

  process.stdout.write('PRODUCTION_MUTATION|NONE\n');
})().catch((error) => {
  result('DB_CLASSIFIER', false, safeCode(error));
  process.stdout.write('PRODUCTION_MUTATION|NONE\n');
}).finally(async () => {
  if (db) await db.$disconnect().catch(() => undefined);
  if (authDb) await authDb.$disconnect().catch(() => undefined);
});
NODE
REMOTE
)"
last_stage='REMOTE_CLASSIFIER'

for required in PARITY DATABASE_URL PRINCIPAL_BOUNDARY PREFLIGHT_DEFINITION READINESS_DEFINITION RESET_SUBJECT_DEFINITION PREFLIGHT_CALL READINESS_CALL RESET_SUBJECT_CALL RESET_SUBJECT_CAPTURE AUTH_DATABASE_URL AUTH_PRINCIPAL AUTH_SUBJECT_CALL CHALLENGE_READ AUDIT_READ; do
  line="$(grep "^${required}|" <<< "$output" | tail -n1)"
  stage_pattern="^${required}\\|(PASS|FAIL_[A-Za-z0-9_-]{1,28})$"
  [[ "$line" =~ $stage_pattern ]]
done
mutation="$(grep '^PRODUCTION_MUTATION|' <<< "$output" | tail -n1)"
[[ "$mutation" == 'PRODUCTION_MUTATION|NONE' ]]

guard_main
summary="$(grep -E '^(PARITY|DATABASE_URL|PRINCIPAL_BOUNDARY|PREFLIGHT_DEFINITION|READINESS_DEFINITION|RESET_SUBJECT_DEFINITION|PREFLIGHT_CALL|READINESS_CALL|RESET_SUBJECT_CALL|RESET_SUBJECT_CAPTURE|AUTH_DATABASE_URL|AUTH_PRINCIPAL|AUTH_SUBJECT_CALL|CHALLENGE_READ|AUDIT_READ)\|' <<< "$output" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
summary_pattern='^[A-Z0-9_|-]+([[:space:]][A-Z0-9_|-]+)*$'
[[ "$summary" =~ $summary_pattern ]]

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 reviewer reset DB-stage classifier

- exact diagnostic main: \`$TARGET_SHA\`
- inspected deployed revision: \`$EXPECTED_DEPLOYED_SHA\`
- result: \`PASS_READ_ONLY_CLASSIFIED\`
- reviewer identity exposure: \`NONE\`
- production mutation: \`NONE\`
- stages: \`$summary\`" >/dev/null
result_published=1
