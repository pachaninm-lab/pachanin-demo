#!/usr/bin/env bash
set -Eeuo pipefail

migration_name="${1:?migration name is required}"
function_sig="${2:?function signature is required}"
REMOTE_STAGE='BOOTSTRAP'

remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE=%s\n' "$REMOTE_STAGE"
  printf 'REMOTE_RC=%s\n' "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

emit() { printf '%s=%s\n' "$1" "$2"; }

[[ "$migration_name" == '20260812010000_p0_industrial_auth_mail_outbox' ]]
[[ "$function_sig" == 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)' ]]
[[ "$(id -u)" -eq 0 ]]

REMOTE_STAGE='ACTIVE_RUNTIME'
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]]
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" ]]
[[ -n "$config_files" ]]
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$api_revision" == "$web_revision" ]]
emit ACTIVE_REVISION "$api_revision"
emit API_WEB_REVISION_PARITY PASS

REMOTE_STAGE='COMPOSE_AUTHORITY'
working_dir="$(realpath -e -- "$working_dir")"
IFS=',' read -r -a raw_compose_files <<< "$config_files"
compose_files=()
for raw_file in "${raw_compose_files[@]}"; do
  file="${raw_file#"${raw_file%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$working_dir/$file"
  [[ -f "$file" && ! -L "$file" ]]
  compose_files+=("$(realpath -e -- "$file")")
done
(( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$working_dir" --project-name "$project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$("${dc[@]}" config --format json)"
[[ -n "$compose_json" ]]

migration_database_url="$(python3 -c '
import json,re,sys
from urllib.parse import urlsplit
services=(json.load(sys.stdin).get("services") or {})
c=[]
for name,service in services.items():
    image=str(service.get("image") or "")
    command=service.get("command")
    command=" ".join(map(str,command)) if isinstance(command,list) else str(command or "")
    if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",name,re.I) or "grainflow-migration" in image or ("prisma" in command.lower() and "migrate" in command.lower()):
        c.append((name,service))
if len(c)!=1: raise SystemExit(1)
env=c[0][1].get("environment") or {}
if isinstance(env,list): env=dict(x.split("=",1) for x in env if isinstance(x,str) and "=" in x)
value=str(env.get("DATABASE_URL") or "").strip()
u=urlsplit(value)
if u.scheme not in ("postgres","postgresql") or not u.username or not u.password or not u.hostname or not u.path.strip("/"): raise SystemExit(2)
sys.stdout.write(value)
' <<< "$compose_json")"
[[ -n "$migration_database_url" ]]
unset compose_json

REMOTE_STAGE='DB_TARGET_PARITY'
api_env="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$api_id")"
main_db="$(sed -n 's/^DATABASE_URL=//p' <<< "$api_env" | head -1)"
auth_db="$(sed -n 's/^AUTH_DATABASE_URL=//p' <<< "$api_env" | head -1)"
unset api_env
[[ -n "$main_db" ]]
parity="$(printf '%s\n%s\n%s\n' "$migration_database_url" "$main_db" "$auth_db" | python3 -c '
import sys
from urllib.parse import unquote,urlsplit
lines=sys.stdin.read().splitlines()
if len(lines)<3: raise SystemExit(1)
m,u,a=[urlsplit(x) if x else None for x in lines[:3]]
def valid(x): return x is not None and x.scheme in ("postgres","postgresql") and x.hostname and x.path.strip("/")
def target(x): return ((x.hostname or "").lower(),x.port or 5432,unquote(x.path))
if not valid(m) or not valid(u): raise SystemExit(2)
print("MAIN_DB_TARGET_PARITY="+("PASS" if target(m)==target(u) else "FAIL"))
if a is None:
    print("AUTH_DB_TARGET_PARITY=ABSENT")
elif not valid(a):
    print("AUTH_DB_TARGET_PARITY=INVALID")
else:
    print("AUTH_DB_TARGET_PARITY="+("PASS" if target(m)==target(a) else "FAIL"))
')"
printf '%s\n' "$parity"
main_parity="$(sed -n 's/^MAIN_DB_TARGET_PARITY=//p' <<< "$parity" | head -1)"
[[ "$main_parity" == PASS ]]
unset main_db auth_db parity

REMOTE_STAGE='API_CATALOG_QUERY'
api_state="$({
  docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const sig = 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)';
const out = (k, v) => process.stdout.write(`${k}=${v}\n`);
const classify = (e) => {
  const m = String(e?.message || '');
  const c = String(e?.meta?.code || e?.code || '');
  if (/permission denied|insufficient privilege/i.test(m) || c === '42501') return 'PERMISSION_DENIED';
  if (/authentication failed|password/i.test(m)) return 'AUTH_FAILED';
  if (/reach|connection refused|timeout|timed out/i.test(m)) return 'CONNECT_FAILED';
  return 'OTHER_ERROR';
};
(async () => {
  try {
    await p.$connect();
    const r = await p.$queryRawUnsafe(`SELECT
      current_user::text IN ('pc_auth_runtime','one_deal_auth','app_auth','app_service') AS producer_principal,
      EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') AS auth_schema,
      to_regclass('auth.mail_outbox') IS NOT NULL AS mail_outbox,
      to_regprocedure($1) IS NOT NULL AS enqueue_function,
      has_schema_privilege(current_user,'auth','USAGE') AS schema_usage,
      CASE WHEN to_regprocedure($1) IS NULL THEN false ELSE has_function_privilege(current_user,to_regprocedure($1),'EXECUTE') END AS enqueue_execute`, sig);
    const x = r?.[0] || {};
    out('API_QUERY_CLASS', 'PASS');
    out('API_PRODUCER_PRINCIPAL', x.producer_principal === true ? 'PASS' : 'FAIL');
    out('AUTH_SCHEMA_EXISTS', x.auth_schema === true ? 'PASS' : 'FAIL');
    out('MAIL_OUTBOX_EXISTS', x.mail_outbox === true ? 'PASS' : 'FAIL');
    out('ENQUEUE_FUNCTION_EXISTS', x.enqueue_function === true ? 'PASS' : 'FAIL');
    out('API_AUTH_SCHEMA_USAGE', x.schema_usage === true ? 'PASS' : 'FAIL');
    out('API_ENQUEUE_EXECUTE', x.enqueue_execute === true ? 'PASS' : 'FAIL');
  } catch (e) {
    out('API_QUERY_CLASS', classify(e));
    for (const k of ['API_PRODUCER_PRINCIPAL','AUTH_SCHEMA_EXISTS','MAIL_OUTBOX_EXISTS','ENQUEUE_FUNCTION_EXISTS','API_AUTH_SCHEMA_USAGE','API_ENQUEUE_EXECUTE']) out(k, 'NOT_RUN');
  }
})().finally(async () => { await p.$disconnect().catch(() => {}); });
NODE
} 2>/dev/null)"
printf '%s\n' "$api_state"
api_query_class="$(sed -n 's/^API_QUERY_CLASS=//p' <<< "$api_state" | head -1)"
[[ "$api_query_class" == PASS ]]

REMOTE_STAGE='MIGRATION_METADATA_QUERY'
migration_node="$(cat <<'NODE'
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const url = fs.readFileSync(0, 'utf8').trim();
const p = new PrismaClient({ datasources: { db: { url } } });
const name = '20260812010000_p0_industrial_auth_mail_outbox';
const sig = 'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)';
const out = (k, v) => process.stdout.write(`${k}=${v}\n`);
const classify = (e) => {
  const m = String(e?.message || '');
  const c = String(e?.meta?.code || e?.code || '');
  if (/permission denied|insufficient privilege/i.test(m) || c === '42501') return 'PERMISSION_DENIED';
  if (/authentication failed|password/i.test(m)) return 'AUTH_FAILED';
  if (/reach|connection refused|timeout|timed out/i.test(m)) return 'CONNECT_FAILED';
  if (/does not exist/i.test(m) || c === '42P01') return 'METADATA_MISSING';
  return 'OTHER_ERROR';
};
(async () => {
  try {
    await p.$connect();
    const rows = await p.$queryRawUnsafe(`SELECT migration_name,
      finished_at IS NOT NULL AS finished,
      rolled_back_at IS NOT NULL AS rolled_back,
      applied_steps_count
      FROM "_prisma_migrations"
      WHERE migration_name=$1`, name);
    let state = 'AMBIGUOUS';
    if (rows.length === 0) state = 'MISSING';
    else if (rows.length === 1) {
      const x = rows[0];
      if (x.rolled_back === true) state = 'ROLLED_BACK';
      else if (x.finished === true && Number(x.applied_steps_count) > 0) state = 'APPLIED';
      else state = 'INCOMPLETE';
    }
    const cat = await p.$queryRawUnsafe(`SELECT
      to_regprocedure($1) IS NOT NULL AS fn,
      to_regclass('auth.mail_outbox') IS NOT NULL AS tbl`, sig);
    out('MIGRATION_QUERY_CLASS', 'PASS');
    out('AUTH_MAIL_OUTBOX_MIGRATION', state);
    out('MIGRATION_AUTH_FUNCTION_EXISTS', cat?.[0]?.fn === true ? 'PASS' : 'FAIL');
    out('MIGRATION_AUTH_TABLE_EXISTS', cat?.[0]?.tbl === true ? 'PASS' : 'FAIL');
  } catch (e) {
    out('MIGRATION_QUERY_CLASS', classify(e));
    out('AUTH_MAIL_OUTBOX_MIGRATION', 'NOT_RUN');
    out('MIGRATION_AUTH_FUNCTION_EXISTS', 'NOT_RUN');
    out('MIGRATION_AUTH_TABLE_EXISTS', 'NOT_RUN');
  }
})().finally(async () => { await p.$disconnect().catch(() => {}); });
NODE
)"
migration_state="$(printf '%s' "$migration_database_url" | docker exec -i "$api_id" /nodejs/bin/node -e "$migration_node" 2>/dev/null)"
unset migration_node migration_database_url
printf '%s\n' "$migration_state"
migration_query_class="$(sed -n 's/^MIGRATION_QUERY_CLASS=//p' <<< "$migration_state" | head -1)"
[[ "$migration_query_class" == PASS ]]

REMOTE_STAGE='COMPLETE'
