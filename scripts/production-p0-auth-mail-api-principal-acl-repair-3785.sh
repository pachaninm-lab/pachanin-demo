#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-api-principal-acl-repair 31985916787 current-main'
FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-api-principal-acl-repair-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-api-principal-acl-repair-known-hosts"
scan=''
match=''
SOURCE_SHA='unknown'
CURRENT_MAIN='unknown'
LOCAL_STAGE='BOOTSTRAP'
REMOTE_STAGE='NOT_STARTED'
REMOTE_RC='NA'
MUTATION='NONE'
ROLLBACK='NOT_NEEDED'

cleanup() {
  rm -f -- "$key_path" "$known_hosts"
  [[ -z "$scan" ]] || rm -f -- "$scan"
  [[ -z "$match" ]] || rm -f -- "$match"
}
trap cleanup EXIT

publish_failure() {
  local rc="${1:-1}"
  trap - ERR
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair

- repair main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- raw DB role / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deployment / API-Web restart: \`NONE\`
- new mandatory cost: \`0 RUB\`
- exit code: \`$rc\`" >/dev/null || true
  exit "$rc"
}
on_err() { local rc="$?"; publish_failure "$rc"; }
trap on_err ERR

trim() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}

guard_main() {
  local remote
  remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
  [[ "$remote" == "$CURRENT_MAIN" ]]
  git fetch --no-tags origin main >/dev/null
  [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
}

LOCAL_STAGE='AUTHORITY'
[[ "$PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'true' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]

grep -Fq "GRANT USAGE ON SCHEMA auth TO" apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq "GRANT EXECUTE ON FUNCTION auth.enqueue_mail_outbox" apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql

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
scan="$(mktemp)"; match="$(mktemp)"; pinned=0
for attempt in 1 2 3; do
  : > "$scan"; : > "$match"
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
mv "$match" "$known_hosts"; match=''
rm -f "$scan"; scan=''
chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

LOCAL_STAGE='REMOTE_PREFLIGHT'
guard_main
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; docker compose version >/dev/null' >/dev/null

LOCAL_STAGE='ACL_REPAIR'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$FUNCTION_SIG' '$EXPECTED_OWNER'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
function_sig="$1"
expected_owner="$2"
REMOTE_STAGE='BOOTSTRAP'
mutation_applied=0
repair_success=0
pre_schema='UNKNOWN'
pre_execute='UNKNOWN'
target_role_b64=''
rollback_state='NOT_NEEDED'

authz_node() {
  local mode="$1"
  PC_TARGET_ROLE_B64="$target_role_b64" PC_PRE_SCHEMA="$pre_schema" PC_PRE_EXECUTE="$pre_execute" \
    "${dc[@]}" run --rm --no-deps --pull never -T \
      -e PC_TARGET_ROLE_B64 -e PC_PRE_SCHEMA -e PC_PRE_EXECUTE \
      --entrypoint /nodejs/bin/node "$migration_service" - "$mode" "$function_sig" "$expected_owner" <<'NODE_AUTHZ'
const { PrismaClient } = require('@prisma/client');
const mode = process.argv[2];
const functionSig = process.argv[3];
const expectedOwner = process.argv[4];
const role = Buffer.from(process.env.PC_TARGET_ROLE_B64 || '', 'base64url').toString('utf8');
const preSchema = process.env.PC_PRE_SCHEMA || 'UNKNOWN';
const preExecute = process.env.PC_PRE_EXECUTE || 'UNKNOWN';
const prisma = new PrismaClient({ log: [] });
const known = new Set([
  'pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app',
  'pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority'
]);
const qi = (v) => '"' + String(v).replace(/"/g, '""') + '"';

async function privilegeState() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      pg_catalog.has_schema_privilege($1::text, 'auth', 'USAGE') AS schema_usage,
      pg_catalog.has_function_privilege($1::text, $2::text, 'EXECUTE') AS function_execute,
      pg_catalog.has_table_privilege($1::text, 'auth.mail_outbox', 'SELECT') AS t_select,
      pg_catalog.has_table_privilege($1::text, 'auth.mail_outbox', 'INSERT') AS t_insert,
      pg_catalog.has_table_privilege($1::text, 'auth.mail_outbox', 'UPDATE') AS t_update,
      pg_catalog.has_table_privilege($1::text, 'auth.mail_outbox', 'DELETE') AS t_delete,
      pg_catalog.has_table_privilege($1::text, 'auth.mail_outbox', 'TRUNCATE') AS t_truncate,
      pg_catalog.has_table_privilege($1::text, 'auth.mail_outbox', 'REFERENCES') AS t_references,
      pg_catalog.has_table_privilege($1::text, 'auth.mail_outbox', 'TRIGGER') AS t_trigger
  `, role, functionSig);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('privilege-state-shape');
  return rows[0];
}

async function validateAuthority() {
  if (!role || Buffer.byteLength(role, 'utf8') > 63 || /[\u0000\r\n]/.test(role)) throw new Error('target-role-invalid');
  if (known.has(role)) throw new Error('target-role-not-other');
  const roleRows = await prisma.$queryRawUnsafe(`
    SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
    FROM pg_catalog.pg_roles WHERE rolname = $1::text
  `, role);
  if (!Array.isArray(roleRows) || roleRows.length !== 1) throw new Error('target-role-missing');
  const r = roleRows[0];
  if (r.rolsuper || r.rolbypassrls || r.rolcreatedb || r.rolcreaterole || r.rolreplication) throw new Error('target-role-privileged');
  const fnRows = await prisma.$queryRawUnsafe(`
    SELECT owner.rolname AS owner
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = p.proowner
    WHERE n.nspname = 'auth' AND p.proname = 'enqueue_mail_outbox'
      AND pg_catalog.pg_get_function_identity_arguments(p.oid) =
        'text, text, text, text, text, integer, text, text, text, integer, timestamp with time zone, timestamp with time zone'
  `);
  if (!Array.isArray(fnRows) || fnRows.length !== 1 || fnRows[0].owner !== expectedOwner) throw new Error('function-authority-invalid');
}

async function run() {
  await validateAuthority();
  const before = await privilegeState();
  const tableAny = before.t_select || before.t_insert || before.t_update || before.t_delete || before.t_truncate || before.t_references || before.t_trigger;
  if (tableAny) throw new Error('target-has-table-privilege');

  if (mode === 'inspect') {
    process.stdout.write(`STATE|${before.schema_usage ? 'YES' : 'NO'}|${before.function_execute ? 'YES' : 'NO'}|TABLE_NONE\n`);
    return;
  }

  if (mode === 'apply') {
    await prisma.$transaction(async (tx) => {
      if (!before.schema_usage) await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA auth TO ${qi(role)}`);
      if (!before.function_execute) await tx.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION ${functionSig} TO ${qi(role)}`);
    }, { maxWait: 5000, timeout: 15000 });
    const after = await privilegeState();
    const afterTableAny = after.t_select || after.t_insert || after.t_update || after.t_delete || after.t_truncate || after.t_references || after.t_trigger;
    if (!after.schema_usage || !after.function_execute || afterTableAny) throw new Error('post-grant-invalid');
    process.stdout.write('APPLY|PASS\n');
    return;
  }

  if (mode === 'rollback') {
    await prisma.$transaction(async (tx) => {
      if (preExecute === 'NO') await tx.$executeRawUnsafe(`REVOKE EXECUTE ON FUNCTION ${functionSig} FROM ${qi(role)}`);
      if (preSchema === 'NO') await tx.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA auth FROM ${qi(role)}`);
    }, { maxWait: 5000, timeout: 15000 });
    const after = await privilegeState();
    const afterTableAny = after.t_select || after.t_insert || after.t_update || after.t_delete || after.t_truncate || after.t_references || after.t_trigger;
    const schemaOk = preSchema === 'YES' ? after.schema_usage : !after.schema_usage;
    const execOk = preExecute === 'YES' ? after.function_execute : !after.function_execute;
    if (!schemaOk || !execOk || afterTableAny) throw new Error('rollback-invalid');
    process.stdout.write('ROLLBACK|PASS\n');
    return;
  }

  throw new Error('mode-invalid');
}
run().catch(() => { process.exitCode = 2; }).finally(async () => { await prisma.$disconnect().catch(() => {}); });
NODE_AUTHZ
}

remote_exit() {
  local rc="$?"
  trap - EXIT
  if (( rc != 0 && mutation_applied == 1 && repair_success == 0 )); then
    REMOTE_STAGE='ROLLBACK'
    if rollback_output="$(authz_node rollback 2>/dev/null)" && [[ "$rollback_output" == 'ROLLBACK|PASS' ]]; then
      rollback_state='PASS'
    else
      rollback_state='FAILED'
    fi
  fi
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_DB_MUTATION|%s\n' "$([[ "$mutation_applied" == 1 ]] && printf 'LEAST_PRIVILEGE_ACL' || printf 'NONE')"
  printf 'ROLLBACK|%s\n' "$rollback_state"
  printf 'API_WEB_RESTART=NONE\n'
  printf 'PASSWORD_RESET=NONE\n'
  printf 'MAIL_SEND=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$(id -u)" -eq 0 ]]
[[ "$function_sig" == 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)' ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]

REMOTE_STAGE='RUNTIME_INVENTORY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
api_ids_before="$(printf '%s\n' "${api_ids[@]}")"
web_ids_before="$(printf '%s\n' "${web_ids[@]}")"

REMOTE_STAGE='API_PRINCIPAL'
principal_evidence=''
for id in "${api_ids[@]}"; do
  docker exec "$id" node -e "require.resolve('@prisma/client')" >/dev/null 2>&1
  one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_API'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
async function run() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      current_user::text AS effective_role,
      session_user::text AS session_role,
      r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole, r.rolreplication,
      pg_catalog.has_schema_privilege(current_user, 'auth', 'USAGE') AS schema_usage,
      pg_catalog.has_function_privilege(current_user,
        'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)',
        'EXECUTE') AS function_execute,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'SELECT') AS t_select,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'INSERT') AS t_insert,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'UPDATE') AS t_update,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'DELETE') AS t_delete,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'TRUNCATE') AS t_truncate,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'REFERENCES') AS t_references,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'TRIGGER') AS t_trigger
    FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
  `);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('shape');
  const x = rows[0];
  if (x.rolsuper || x.rolbypassrls || x.rolcreatedb || x.rolcreaterole || x.rolreplication) throw new Error('privileged');
  const known = new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']);
  if (known.has(x.effective_role)) throw new Error('not-other');
  if (/[\u0000\r\n]/.test(x.effective_role) || Buffer.byteLength(x.effective_role,'utf8') > 63) throw new Error('invalid-role');
  const tableAny = x.t_select || x.t_insert || x.t_update || x.t_delete || x.t_truncate || x.t_references || x.t_trigger;
  const eb = Buffer.from(x.effective_role, 'utf8').toString('base64url');
  const sb = Buffer.from(x.session_role, 'utf8').toString('base64url');
  process.stdout.write(`PRINCIPAL|${eb}|${sb}|${x.schema_usage ? 'YES' : 'NO'}|${x.function_execute ? 'YES' : 'NO'}|${tableAny ? 'TABLE_PRESENT' : 'TABLE_NONE'}\n`);
}
run().catch(() => { process.exitCode = 2; }).finally(async () => { await prisma.$disconnect().catch(() => {}); });
NODE_API
)"
  [[ "$one" =~ ^PRINCIPAL\|[A-Za-z0-9_-]+\|[A-Za-z0-9_-]+\|(YES|NO)\|(YES|NO)\|TABLE_NONE$ ]]
  if [[ -z "$principal_evidence" ]]; then principal_evidence="$one"; else [[ "$principal_evidence" == "$one" ]]; fi
done
IFS='|' read -r _ target_role_b64 session_role_b64 pre_schema pre_execute table_marker <<< "$principal_evidence"
[[ -n "$target_role_b64" && -n "$session_role_b64" && "$table_marker" == 'TABLE_NONE' ]]

REMOTE_STAGE='COMPOSE_AUTHORITY'
web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" && -d "$prod_dir" ]]
IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="${raw#"${raw%%[![:space:]]*}"}"; file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ -f "$file" && ! -L "$file" ]]
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$("${dc[@]}" config --format json)"
service_line="$(printf '%s' "$compose_json" | python3 -c '
import json,re,sys
cfg=json.load(sys.stdin); services=cfg.get("services") or {}; c=[]
for name,svc in services.items():
    image=str(svc.get("image") or ""); command=svc.get("command"); command=" ".join(command) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command and "migrate" in command): c.append((name,image,svc))
if len(c)!=1: raise SystemExit(1)
name,image,svc=c[0]; env=svc.get("environment") or {}
if isinstance(env,list): env={str(x).split("=",1)[0]:(str(x).split("=",1)[1] if "=" in str(x) else None) for x in env}
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",name) or not image or any(ch.isspace() for ch in image): raise SystemExit(1)
if not env.get("DATABASE_URL"): raise SystemExit(1)
print(name+"|"+image)
')"
IFS='|' read -r migration_service migration_image <<< "$service_line"
[[ -n "$migration_service" && -n "$migration_image" ]]
docker image inspect "$migration_image" >/dev/null

REMOTE_STAGE='AUTHORITY_PRECHECK'
inspect_output="$(authz_node inspect 2>/dev/null)"
[[ "$inspect_output" == "STATE|$pre_schema|$pre_execute|TABLE_NONE" ]]

if [[ "$pre_schema" == 'YES' && "$pre_execute" == 'YES' ]]; then
  REMOTE_STAGE='ALREADY_PASS'
  MUTATION='NONE'
else
  REMOTE_STAGE='GRANT_EXACT'
  apply_output="$(authz_node apply 2>/dev/null)"
  [[ "$apply_output" == 'APPLY|PASS' ]]
  mutation_applied=1
fi

REMOTE_STAGE='API_POSTVERIFY'
for id in "${api_ids[@]}"; do
  verify="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_VERIFY'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
async function run() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      pg_catalog.has_schema_privilege(current_user, 'auth', 'USAGE') AS s,
      pg_catalog.has_function_privilege(current_user,
        'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)', 'EXECUTE') AS f,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'SELECT') AS a,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'INSERT') AS b,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'UPDATE') AS c,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'DELETE') AS d,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'TRUNCATE') AS e,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'REFERENCES') AS g,
      pg_catalog.has_table_privilege(current_user, 'auth.mail_outbox', 'TRIGGER') AS h
  `);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('shape');
  const x=rows[0]; const tableAny=x.a||x.b||x.c||x.d||x.e||x.g||x.h;
  process.stdout.write(`VERIFY|${x.s?'YES':'NO'}|${x.f?'YES':'NO'}|${tableAny?'TABLE_PRESENT':'TABLE_NONE'}\n`);
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_VERIFY
)"
  [[ "$verify" == 'VERIFY|YES|YES|TABLE_NONE' ]]
done

REMOTE_STAGE='RUNTIME_INVARIANTS'
mapfile -t api_ids_after < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids_after < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
[[ "$(printf '%s\n' "${api_ids_after[@]}")" == "$api_ids_before" ]]
[[ "$(printf '%s\n' "${web_ids_after[@]}")" == "$web_ids_before" ]]

repair_success=1
REMOTE_STAGE='COMPLETE'
printf 'REPAIR|PASS|%s|API_ACL_PASS|TABLE_DML_NONE\n' "$([[ "$mutation_applied" == 1 ]] && printf 'MUTATED' || printf 'ALREADY_PASS')"
REMOTE
)"; then
  REMOTE_RC=0
else
  REMOTE_RC=$?
fi

remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
mutation_marker="$(grep '^PRODUCTION_DB_MUTATION|' <<< "$output" | tail -n1 || true)"
rollback_marker="$(grep '^ROLLBACK|' <<< "$output" | tail -n1 || true)"
repair_marker="$(grep '^REPAIR|' <<< "$output" | tail -n1 || true)"
[[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r _ REMOTE_STAGE marker_rc <<< "$remote_marker"
[[ "$marker_rc" == "$REMOTE_RC" ]]
[[ "$mutation_marker" =~ ^PRODUCTION_DB_MUTATION\|(NONE|LEAST_PRIVILEGE_ACL)$ ]]
MUTATION="${mutation_marker#PRODUCTION_DB_MUTATION|}"
[[ "$rollback_marker" =~ ^ROLLBACK\|(NOT_NEEDED|PASS|FAILED)$ ]]
ROLLBACK="${rollback_marker#ROLLBACK|}"
(( REMOTE_RC == 0 )) || publish_failure "$REMOTE_RC"
[[ "$repair_marker" =~ ^REPAIR\|PASS\|(MUTATED|ALREADY_PASS)\|API_ACL_PASS\|TABLE_DML_NONE$ ]]

LOCAL_STAGE='PUBLISH'
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair

- repair main: \`$SOURCE_SHA\`
- result: \`PASS_LEAST_PRIVILEGE\`
- active API principal identity: \`NOT_PUBLISHED\`
- principal class: \`OTHER_CONFIRMED_BY_RUN_31985916787\`
- auth schema USAGE after repair: \`YES\`
- enqueue function EXECUTE after repair: \`YES\`
- auth.mail_outbox table DML granted to API principal: \`NONE\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- API/Web restart: \`NONE\`
- password reset / mail send / deployment: \`NONE\`
- raw DB role / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- new mandatory cost: \`0 RUB\`" >/dev/null

echo 'AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR=PASS'
echo "PRODUCTION_DB_MUTATION=$MUTATION"
echo 'API_WEB_RESTART=NONE'
echo 'PASSWORD_RESET=NONE'
echo 'MAIL_SEND=NONE'
