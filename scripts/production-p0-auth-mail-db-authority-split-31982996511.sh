#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_DB_AUTHORITY_SPLIT_COMMAND:?PC_AUTH_MAIL_DB_AUTHORITY_SPLIT_COMMAND is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-db-authority-split 31982996511 current-main'
MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'
TARGET_MIGRATION_PATH="apps/api/prisma/migrations/${MIGRATION_NAME}/migration.sql"
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'
EXPECTED_ARG_TYPES='text, text, text, text, text, integer, text, text, text, integer, timestamp with time zone, timestamp with time zone'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-db-authority-split-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-db-authority-split-known-hosts"
scan=''
match=''
result_published=0
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="${1:-1}"
  trap - ERR
  if [[ "$result_published" == 0 ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB authority-split preflight

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- DB URL / credentials / raw DB errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- API/Web/database mutation: \`NONE\`
- transient observer: \`NONE_OR_REMOVED\`
- exit code: \`$rc\`" >/dev/null || true
  fi
  exit "$rc"
}
on_err() { local rc="$?"; publish_failure "$rc"; }
trap on_err ERR

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

guard_main() {
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

LOCAL_STAGE='AUTHORITY'
[[ "$PC_AUTH_MAIL_DB_AUTHORITY_SPLIT_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]
[[ -f "$TARGET_MIGRATION_PATH" ]]

grep -Fq 'CREATE OR REPLACE FUNCTION auth.enqueue_mail_outbox(' "$TARGET_MIGRATION_PATH"
grep -Fq 'OWNER TO pc_auth_mail_enqueue_authority' "$TARGET_MIGRATION_PATH"

LOCAL_STAGE='SSH_INPUT'
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
  local raw="$1" a b c
  [[ -n "$raw" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$raw" > "$a"
  validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${raw//\\n/$'\n'}" > "$b"
  validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"
  return 1
}
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

LOCAL_STAGE='HOST_PIN'
guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"
grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"
match="$(mktemp)"
pinned=0
for attempt in 1 2 3; do
  : > "$scan"
  : > "$match"
  ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true
  if [[ -s "$scan" ]]; then
    while IFS= read -r line; do
      fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
      [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
    done < "$scan"
    sort -u -o "$match" "$match"
    [[ "$(grep -c . "$match" || true)" == 1 ]] && { pinned=1; break; }
  fi
  (( attempt == 3 )) || sleep "$attempt"
done
[[ "$pinned" == 1 ]]
mv "$match" "$known_hosts"
match=''
rm -f "$scan"
scan=''
chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

LOCAL_STAGE='REMOTE_PREFLIGHT'
guard_main
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; docker compose version >/dev/null' >/dev/null

LOCAL_STAGE='MIGRATION_AUTHORITY_INVENTORY'
guard_main
if inventory_output="$(ssh "${ssh_opts[@]}" "$user@$host" 'bash -s' 2>/dev/null <<'REMOTE_INVENTORY'
set -Eeuo pipefail
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_DB_MUTATION=NONE\n'
  printf 'API_WEB_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$(id -u)" -eq 0 ]]
REMOTE_STAGE='COMPOSE_AUTHORITY'
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" && -d "$prod_dir" ]]
IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]]
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$("${dc[@]}" config --format json)"
REMOTE_STAGE='MIGRATION_SERVICE'
service_line="$(printf '%s' "$compose_json" | python3 -c '
import json,re,sys
cfg=json.load(sys.stdin)
services=cfg.get("services") or {}
if "api" not in services or "web" not in services: raise SystemExit(1)
c=[]
for name,svc in services.items():
    image=str(svc.get("image") or "")
    command=svc.get("command")
    command=" ".join(command) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command): c.append((name,image,svc))
if len(c)!=1: raise SystemExit(1)
name,image,svc=c[0]
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",name) or not image or any(ch.isspace() for ch in image): raise SystemExit(1)
env=svc.get("environment") or {}
if isinstance(env,list):
    env={str(x).split("=",1)[0]: (str(x).split("=",1)[1] if "=" in str(x) else None) for x in env}
print(f"SERVICE|{name}")
print(f"IMAGE|{image}")
print("DATABASE_AUTHORITY|" + ("CONFIGURED" if "DATABASE_URL" in env and env.get("DATABASE_URL") else "MISSING"))
')"
migration_service="$(grep '^SERVICE|' <<< "$service_line" | cut -d'|' -f2-)"
migration_image="$(grep '^IMAGE|' <<< "$service_line" | cut -d'|' -f2-)"
db_authority="$(grep '^DATABASE_AUTHORITY|' <<< "$service_line" | cut -d'|' -f2-)"
[[ "$migration_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]
[[ -n "$migration_image" && "$migration_image" != *[[:space:]]* ]]
[[ "$db_authority" == 'CONFIGURED' ]]
REMOTE_STAGE='MIGRATION_IMAGE_LOCAL'
migration_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$migration_image")"
[[ "$migration_revision" =~ ^[0-9a-f]{40}$ ]]
printf 'MIGRATION_SERVICE|%s\n' "$migration_service"
printf 'MIGRATION_IMAGE|%s\n' "$migration_image"
printf 'MIGRATION_IMAGE_REVISION|%s\n' "$migration_revision"
printf 'MIGRATION_DATABASE_AUTHORITY|CONFIGURED\n'
REMOTE_STAGE='COMPLETE'
REMOTE_INVENTORY
)"; then
  inventory_rc=0
else
  inventory_rc=$?
fi
inventory_remote_marker="$(grep '^REMOTE_STAGE|' <<< "$inventory_output" | tail -n1 || true)"
if [[ "$inventory_remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; then
  IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$inventory_remote_marker"
else
  REMOTE_STAGE='NO_SAFE_INVENTORY_MARKER'
  REMOTE_RC="$inventory_rc"
fi
[[ "$(grep '^PRODUCTION_DB_MUTATION=' <<< "$inventory_output" | tail -n1 || true)" == 'PRODUCTION_DB_MUTATION=NONE' ]]
[[ "$(grep '^API_WEB_MUTATION=' <<< "$inventory_output" | tail -n1 || true)" == 'API_WEB_MUTATION=NONE' ]]
(( inventory_rc == 0 )) || publish_failure "$inventory_rc"

migration_service="$(grep '^MIGRATION_SERVICE|' <<< "$inventory_output" | cut -d'|' -f2- | tail -n1)"
migration_image="$(grep '^MIGRATION_IMAGE|' <<< "$inventory_output" | cut -d'|' -f2- | tail -n1)"
migration_revision="$(grep '^MIGRATION_IMAGE_REVISION|' <<< "$inventory_output" | cut -d'|' -f2- | tail -n1)"
[[ "$migration_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]
[[ -n "$migration_image" && "$migration_image" != *[[:space:]]* ]]
[[ "$migration_revision" =~ ^[0-9a-f]{40}$ ]]

LOCAL_STAGE='MIGRATION_IMAGE_HISTORY'
guard_main
git cat-file -e "${migration_revision}^{commit}"
git merge-base --is-ancestor "$migration_revision" "$CURRENT_MAIN"
latest_migration_commit="$(git log -1 --format=%H "$CURRENT_MAIN" -- apps/api/prisma/migrations)"
[[ "$latest_migration_commit" =~ ^[0-9a-f]{40}$ ]]
git merge-base --is-ancestor "$latest_migration_commit" "$migration_revision"
current_blob="$(git rev-parse "$CURRENT_MAIN:$TARGET_MIGRATION_PATH")"
image_blob="$(git rev-parse "$migration_revision:$TARGET_MIGRATION_PATH")"
[[ "$current_blob" == "$image_blob" ]]

LOCAL_STAGE='AUTHORITY_SPLIT_DB_READ'
guard_main
if db_output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$migration_service' '$migration_image' '$migration_revision' '$MIGRATION_NAME' '$EXPECTED_OWNER' '$EXPECTED_ARG_TYPES'" 2>/dev/null <<'REMOTE_DB'
set -Eeuo pipefail
expected_service="$1"
expected_image="$2"
expected_revision="$3"
migration_name="$4"
expected_owner="$5"
expected_arg_types="$6"
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_DB_MUTATION=NONE\n'
  printf 'API_WEB_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT
[[ "$(id -u)" -eq 0 ]]
[[ "$expected_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]
[[ "$expected_revision" =~ ^[0-9a-f]{40}$ ]]
[[ "$migration_name" == '20260812010000_p0_industrial_auth_mail_outbox' ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]

REMOTE_STAGE='COMPOSE_REVALIDATE'
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" && -d "$prod_dir" ]]
IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]]
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$("${dc[@]}" config --format json)"
revalidated="$(printf '%s' "$compose_json" | python3 -c '
import json,re,sys
cfg=json.load(sys.stdin); services=cfg.get("services") or {}; c=[]
for name,svc in services.items():
    image=str(svc.get("image") or ""); command=svc.get("command"); command=" ".join(command) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command): c.append((name,image,svc))
if len(c)!=1: raise SystemExit(1)
name,image,svc=c[0]; env=svc.get("environment") or {}
if isinstance(env,list): env={str(x).split("=",1)[0]:(str(x).split("=",1)[1] if "=" in str(x) else None) for x in env}
print(name); print(image); print("YES" if "DATABASE_URL" in env and env.get("DATABASE_URL") else "NO")
')"
service_now="$(sed -n '1p' <<< "$revalidated")"
image_now="$(sed -n '2p' <<< "$revalidated")"
db_now="$(sed -n '3p' <<< "$revalidated")"
[[ "$service_now" == "$expected_service" && "$image_now" == "$expected_image" && "$db_now" == 'YES' ]]
[[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image_now")" == "$expected_revision" ]]

REMOTE_STAGE='RUNTIME_INVENTORY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
api_before=''
for id in "${api_ids[@]}"; do
  state="$(docker inspect --format '{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id")"
  api_before+="${api_before:+$'\n'}$id|$state"
done
web_before="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
oneoff_before="$(docker ps -aq --filter "label=com.docker.compose.service=$expected_service" --filter 'label=com.docker.compose.oneoff=True' | sort)"

REMOTE_STAGE='RUNTIME_CATALOG'
runtime_evidence=''
runtime_failure=''
runtime_rc=0
for id in "${api_ids[@]}"; do
  if one_runtime="$(docker exec -i "$id" /nodejs/bin/node - "$expected_owner" "$expected_arg_types" 2>/dev/null <<'NODE_RUNTIME'
const { PrismaClient } = require('@prisma/client');
const expectedOwner = process.argv[2];
const expectedArgTypes = process.argv[3];
const prisma = new PrismaClient({ log: [] });

function classify(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const metaCode = typeof error?.meta?.code === 'string' ? error.meta.code : '';
  let kind = 'OTHER';
  if (code === 'LOCAL_READ_ONLY_OFF') kind = 'READ_ONLY_NOT_ACTIVE';
  else if (code === 'P1001') kind = 'DB_UNREACHABLE';
  else if (code === 'P1010') kind = 'DB_ACCESS_DENIED';
  else if (code === 'P2010') kind = 'RAW_QUERY_FAILED';
  else if (code === 'P2028') kind = 'TRANSACTION_FAILED';
  else if (/^P10[0-9]{2}$/.test(code)) kind = 'PRISMA_INIT_FAILED';
  else if (/^P[0-9]{4}$/.test(code)) kind = 'PRISMA_QUERY_FAILED';
  return { kind, sqlstate: /^[0-9A-Z]{5}$/.test(metaCode) ? metaCode : 'NA' };
}

async function readOnly(stage, sql) {
  try {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const check = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') = 'on' AS read_only");
      if (!Array.isArray(check) || check.length !== 1 || check[0].read_only !== true) {
        const error = new Error('read-only verification failed');
        error.code = 'LOCAL_READ_ONLY_OFF';
        throw error;
      }
      return tx.$queryRawUnsafe(sql);
    }, { maxWait: 5000, timeout: 15000 });
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, stage, ...classify(error) };
  }
}

(async () => {
  const role = await readOnly('ROLE', `
    SELECT CASE current_user
      WHEN 'pc_auth_runtime' THEN 'PC_AUTH_RUNTIME'
      WHEN 'one_deal_auth' THEN 'ONE_DEAL_AUTH'
      WHEN 'app_auth' THEN 'APP_AUTH'
      WHEN 'app_service' THEN 'APP_SERVICE'
      WHEN 'pc_app' THEN 'PC_APP'
      ELSE 'OTHER'
    END AS role_class
  `);
  if (!role.ok) throw role;

  const schema = await readOnly('AUTH_SCHEMA', `
    WITH ns AS (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'auth')
    SELECT
      EXISTS (SELECT 1 FROM ns) AS schema_present,
      COALESCE((SELECT pg_catalog.has_schema_privilege(current_user, oid, 'USAGE') FROM ns), false) AS schema_usage
  `);
  if (!schema.ok) throw schema;

  const table = await readOnly('MAIL_OUTBOX', `
    SELECT COUNT(*)::int AS exact_count
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relname = 'mail_outbox' AND c.relkind IN ('r','p')
  `);
  if (!table.ok) throw table;

  const fn = await readOnly('ENQUEUE_FUNCTION', `
    WITH candidates AS (
      SELECT
        p.oid,
        pg_catalog.oidvectortypes(p.proargtypes) = '${expectedArgTypes.replaceAll("'", "''")}' AS signature_ok,
        pg_catalog.pg_get_userbyid(p.proowner) = '${expectedOwner.replaceAll("'", "''")}' AS owner_ok,
        pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE') AS execute_ok
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'auth' AND p.proname = 'enqueue_mail_outbox'
    )
    SELECT
      COUNT(*)::int AS overload_count,
      COUNT(*) FILTER (WHERE signature_ok)::int AS exact_count,
      COALESCE(bool_or(signature_ok AND owner_ok), false) AS owner_ok,
      COALESCE(bool_or(signature_ok AND execute_ok), false) AS execute_ok
    FROM candidates
  `);
  if (!fn.ok) throw fn;

  const roleClass = String(role.rows?.[0]?.role_class ?? 'OTHER');
  const schemaPresent = schema.rows?.[0]?.schema_present === true;
  const schemaUsage = schema.rows?.[0]?.schema_usage === true;
  const tableCount = Number(table.rows?.[0]?.exact_count ?? -1);
  const overloadCount = Number(fn.rows?.[0]?.overload_count ?? -1);
  const exactCount = Number(fn.rows?.[0]?.exact_count ?? -1);
  const ownerOk = fn.rows?.[0]?.owner_ok === true;
  const executeOk = fn.rows?.[0]?.execute_ok === true;
  const allowedRole = /^(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)$/.test(roleClass);
  if (!allowedRole || !Number.isInteger(tableCount) || !Number.isInteger(overloadCount) || !Number.isInteger(exactCount)) process.exit(73);
  process.stdout.write([
    'RUNTIME_EVIDENCE', 'ROLE', roleClass,
    'AUTH_SCHEMA', schemaPresent ? 'YES' : 'NO',
    'SCHEMA_USAGE', schemaUsage ? 'YES' : 'NO',
    'MAIL_OUTBOX', tableCount === 1 ? 'YES' : 'NO',
    'FUNCTION_EXACT', exactCount === 1 ? 'YES' : 'NO',
    'FUNCTION_OWNER', ownerOk ? 'YES' : 'NO',
    'FUNCTION_EXECUTE', executeOk ? 'YES' : 'NO',
    'OVERLOAD_COUNT', String(overloadCount),
  ].join('|') + '\n');
})()
  .catch((failure) => {
    const stage = /^(ROLE|AUTH_SCHEMA|MAIL_OUTBOX|ENQUEUE_FUNCTION)$/.test(String(failure?.stage)) ? String(failure.stage) : 'UNKNOWN';
    const kind = /^(READ_ONLY_NOT_ACTIVE|DB_UNREACHABLE|DB_ACCESS_DENIED|RAW_QUERY_FAILED|TRANSACTION_FAILED|PRISMA_INIT_FAILED|PRISMA_QUERY_FAILED|OTHER)$/.test(String(failure?.kind)) ? String(failure.kind) : 'OTHER';
    const sqlstate = /^[0-9A-Z]{5}$/.test(String(failure?.sqlstate)) ? String(failure.sqlstate) : 'NA';
    process.stdout.write(`RUNTIME_FAILURE|STAGE|${stage}|CLASS|${kind}|SQLSTATE|${sqlstate}\n`);
    process.exitCode = 71;
  })
  .finally(async () => { try { await prisma.$disconnect(); } catch {} });
NODE_RUNTIME
)"; then
    one_rc=0
  else
    one_rc=$?
  fi
  if (( one_rc == 0 )); then
    [[ "$one_runtime" =~ ^RUNTIME_EVIDENCE\|ROLE\|(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)\|AUTH_SCHEMA\|(YES|NO)\|SCHEMA_USAGE\|(YES|NO)\|MAIL_OUTBOX\|(YES|NO)\|FUNCTION_EXACT\|(YES|NO)\|FUNCTION_OWNER\|(YES|NO)\|FUNCTION_EXECUTE\|(YES|NO)\|OVERLOAD_COUNT\|[0-9]+$ ]]
    runtime_evidence+="${runtime_evidence:+$'\n'}$one_runtime"
  else
    [[ "$one_runtime" =~ ^RUNTIME_FAILURE\|STAGE\|(ROLE|AUTH_SCHEMA|MAIL_OUTBOX|ENQUEUE_FUNCTION|UNKNOWN)\|CLASS\|(READ_ONLY_NOT_ACTIVE|DB_UNREACHABLE|DB_ACCESS_DENIED|RAW_QUERY_FAILED|TRANSACTION_FAILED|PRISMA_INIT_FAILED|PRISMA_QUERY_FAILED|OTHER)\|SQLSTATE\|([0-9A-Z]{5}|NA)$ ]]
    runtime_failure="$one_runtime"
    runtime_rc="$one_rc"
    break
  fi
done

REMOTE_STAGE='MIGRATION_HISTORY'
if migration_output="$("${dc[@]}" run --rm --no-deps --pull never -T --entrypoint /nodejs/bin/node "$expected_service" - "$migration_name" 2>/dev/null <<'NODE_MIGRATION'
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const migrationName = process.argv[2];
if (migrationName !== '20260812010000_p0_industrial_auth_mail_outbox') process.exit(81);
const target = `/app/prisma/migrations/${migrationName}/migration.sql`;
if (!fs.existsSync(target)) {
  process.stdout.write('MIGRATION_EVIDENCE|STATUS|LOCAL_TARGET_MISSING|TARGET_LOCAL|NO|TARGET_MENTIONED|NO\n');
  process.exit(0);
}
const result = spawnSync(process.execPath, [
  'node_modules/prisma/build/index.js', 'migrate', 'status', '--schema', 'prisma/schema.prisma'
], {
  cwd: '/app',
  env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
  encoding: 'utf8',
  timeout: 60000,
  maxBuffer: 1024 * 1024,
});
if (result.error || result.signal || result.status === null) {
  process.stdout.write('MIGRATION_FAILURE|CLASS|STATUS_EXECUTION_FAILED\n');
  process.exit(82);
}
const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.status === 0) {
  process.stdout.write('MIGRATION_EVIDENCE|STATUS|UP_TO_DATE|TARGET_LOCAL|YES|TARGET_MENTIONED|NA\n');
  process.exit(0);
}
if (result.status === 1) {
  process.stdout.write(`MIGRATION_EVIDENCE|STATUS|NOT_UP_TO_DATE|TARGET_LOCAL|YES|TARGET_MENTIONED|${text.includes(migrationName) ? 'YES' : 'NO'}\n`);
  process.exit(0);
}
process.stdout.write('MIGRATION_FAILURE|CLASS|STATUS_UNEXPECTED_EXIT\n');
process.exit(83);
NODE_MIGRATION
)"; then
  migration_rc=0
else
  migration_rc=$?
fi

REMOTE_STAGE='POST_OBSERVER_INVARIANTS'
api_after=''
for id in "${api_ids[@]}"; do
  state="$(docker inspect --format '{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id")"
  api_after+="${api_after:+$'\n'}$id|$state"
done
web_after="$(docker inspect --format '{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
oneoff_after="$(docker ps -aq --filter "label=com.docker.compose.service=$expected_service" --filter 'label=com.docker.compose.oneoff=True' | sort)"
[[ "$api_before" == "$api_after" && "$web_before" == "$web_after" && "$oneoff_before" == "$oneoff_after" ]]

if [[ -n "$runtime_evidence" ]]; then
  unique_runtime="$(sort -u <<< "$runtime_evidence")"
  [[ "$(grep -c '^RUNTIME_EVIDENCE|' <<< "$unique_runtime")" == 1 ]]
  printf '%s\n' "$unique_runtime"
fi
[[ -z "$runtime_failure" ]] || printf '%s\n' "$runtime_failure"
if (( migration_rc == 0 )); then
  [[ "$migration_output" =~ ^MIGRATION_EVIDENCE\|STATUS\|(UP_TO_DATE|NOT_UP_TO_DATE|LOCAL_TARGET_MISSING)\|TARGET_LOCAL\|(YES|NO)\|TARGET_MENTIONED\|(YES|NO|NA)$ ]]
  printf '%s\n' "$migration_output"
else
  [[ "$migration_output" =~ ^MIGRATION_FAILURE\|CLASS\|(STATUS_EXECUTION_FAILED|STATUS_UNEXPECTED_EXIT)$ ]]
  printf '%s\n' "$migration_output"
fi
printf 'API_RUNTIME_COUNT|%s\n' "${#api_ids[@]}"
printf 'TRANSIENT_OBSERVER|REMOVED\n'

if (( runtime_rc != 0 )); then
  REMOTE_STAGE='RUNTIME_CATALOG_FAILED'
  exit "$runtime_rc"
fi
if (( migration_rc != 0 )); then
  REMOTE_STAGE='MIGRATION_HISTORY_FAILED'
  exit "$migration_rc"
fi
REMOTE_STAGE='COMPLETE'
REMOTE_DB
)"; then
  db_rc=0
else
  db_rc=$?
fi
remote_marker="$(grep '^REMOTE_STAGE|' <<< "$db_output" | tail -n1 || true)"
if [[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; then
  IFS='|' read -r _ REMOTE_STAGE REMOTE_RC <<< "$remote_marker"
else
  REMOTE_STAGE='NO_SAFE_DB_MARKER'
  REMOTE_RC="$db_rc"
fi
[[ "$(grep '^PRODUCTION_DB_MUTATION=' <<< "$db_output" | tail -n1 || true)" == 'PRODUCTION_DB_MUTATION=NONE' ]]
[[ "$(grep '^API_WEB_MUTATION=' <<< "$db_output" | tail -n1 || true)" == 'API_WEB_MUTATION=NONE' ]]
if (( db_rc != 0 )); then
  runtime_failure="$(grep '^RUNTIME_FAILURE|' <<< "$db_output" | tail -n1 || true)"
  migration_failure="$(grep '^MIGRATION_FAILURE|' <<< "$db_output" | tail -n1 || true)"
  failure_detail='SANITIZED_TECHNICAL_FAILURE'
  [[ -z "$runtime_failure" ]] || failure_detail="$runtime_failure"
  [[ -z "$migration_failure" ]] || failure_detail="$migration_failure"
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB authority-split preflight

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED_STAGE_CLASSIFIED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- sanitized failure: \`$failure_detail\`
- DB URL / credentials / raw DB errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- API/Web/database mutation: \`NONE\`
- transient observer: \`NONE_OR_REMOVED\`" >/dev/null || true
  result_published=1
  exit "$db_rc"
fi

LOCAL_STAGE='EVIDENCE_PARSE'
runtime_marker="$(grep '^RUNTIME_EVIDENCE|' <<< "$db_output" | tail -n1 || true)"
migration_marker="$(grep '^MIGRATION_EVIDENCE|' <<< "$db_output" | tail -n1 || true)"
runtime_count="$(grep '^API_RUNTIME_COUNT|' <<< "$db_output" | tail -n1 || true)"
observer_marker="$(grep '^TRANSIENT_OBSERVER|' <<< "$db_output" | tail -n1 || true)"
[[ "$runtime_marker" =~ ^RUNTIME_EVIDENCE\|ROLE\|(PC_AUTH_RUNTIME|ONE_DEAL_AUTH|APP_AUTH|APP_SERVICE|PC_APP|OTHER)\|AUTH_SCHEMA\|(YES|NO)\|SCHEMA_USAGE\|(YES|NO)\|MAIL_OUTBOX\|(YES|NO)\|FUNCTION_EXACT\|(YES|NO)\|FUNCTION_OWNER\|(YES|NO)\|FUNCTION_EXECUTE\|(YES|NO)\|OVERLOAD_COUNT\|[0-9]+$ ]]
[[ "$migration_marker" =~ ^MIGRATION_EVIDENCE\|STATUS\|(UP_TO_DATE|NOT_UP_TO_DATE|LOCAL_TARGET_MISSING)\|TARGET_LOCAL\|(YES|NO)\|TARGET_MENTIONED\|(YES|NO|NA)$ ]]
[[ "$runtime_count" =~ ^API_RUNTIME_COUNT\|[1-4]$ ]]
[[ "$observer_marker" == 'TRANSIENT_OBSERVER|REMOVED' ]]
IFS='|' read -r _ _ role_class _ auth_schema _ schema_usage _ mail_outbox _ function_exact _ function_owner _ function_execute _ overload_count <<< "$runtime_marker"
IFS='|' read -r _ _ migration_status _ target_local _ target_mentioned <<< "$migration_marker"
IFS='|' read -r _ api_count <<< "$runtime_count"

preflight='BLOCK'
consistency='DRIFT_OR_PRIVILEGE_MISMATCH'
migration_history='NOT_PROVEN_APPLIED'
if [[ "$migration_status" == 'UP_TO_DATE' && "$target_local" == 'YES' ]]; then
  migration_history='APPLIED_AND_HISTORY_CONSISTENT'
fi
if [[ "$migration_history" == 'APPLIED_AND_HISTORY_CONSISTENT' && "$auth_schema" == 'YES' && "$schema_usage" == 'YES' && "$mail_outbox" == 'YES' && "$function_exact" == 'YES' && "$function_owner" == 'YES' && "$function_execute" == 'YES' && "$overload_count" == '1' && "$role_class" != 'OTHER' ]]; then
  preflight='PASS'
  consistency='CONSISTENT'
fi

guard_main
LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail DB authority-split preflight

- diagnostic main: \`$SOURCE_SHA\`
- result: \`READ_ONLY_AUTHORITY_SPLIT_COMPLETE\`
- DB preflight: \`$preflight\`
- migration $MIGRATION_NAME: \`$migration_history\`
- migration service history status: \`$migration_status\`
- migration image contains exact current migration bytes: \`YES\`
- effective API runtime DB role: \`$role_class\`
- auth schema present: \`$auth_schema\`
- effective runtime auth schema USAGE: \`$schema_usage\`
- auth.mail_outbox table present: \`$mail_outbox\`
- exact 12-argument enqueue_mail_outbox present: \`$function_exact\`
- function owner pc_auth_mail_enqueue_authority: \`$function_owner\`
- effective runtime enqueue EXECUTE: \`$function_execute\`
- enqueue_mail_outbox overload count: \`$overload_count\`
- migration/schema/ACL consistency: \`$consistency\`
- active API runtimes checked: \`$api_count\`
- transient migration observer: \`CREATED_AND_REMOVED; DEFAULT MIGRATION COMMAND OVERRIDDEN\`
- DB URL / credentials / raw DB errors / PII: \`NOT_PUBLISHED\`
- reset replay / mail send / deployment: \`NONE\`
- API/Web/database mutation: \`NONE\`" >/dev/null
result_published=1
LOCAL_STAGE='COMPLETE'
if [[ "$preflight" == 'PASS' ]]; then
  printf 'AUTH_MAIL_DB_PREFLIGHT=PASS\nPRODUCTION_DB_MUTATION=NONE\n'
  exit 0
fi
printf 'AUTH_MAIL_DB_PREFLIGHT=BLOCK\nPRODUCTION_DB_MUTATION=NONE\n'
exit 88
