#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_AUTHORITY_INSPECT_CLASSIFIER_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-authority-inspect-classifier 31987313660 current-main'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'
EXPECTED_ARGS='text, text, text, text, text, integer, text, text, text, integer, timestamp with time zone, timestamp with time zone'

key_path="$RUNNER_TEMP/pc-p0-auth-mail-authority-inspect-classifier-key"
known_hosts="$RUNNER_TEMP/pc-p0-auth-mail-authority-inspect-classifier-known-hosts"
scan=''
match=''
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
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail authority-inspect classifier

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- raw DB role / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / GRANT / DDL / DML / API-Web restart: \`NONE\`
- production mutation: \`NONE\`
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
[[ "$PC_AUTH_MAIL_AUTHORITY_INSPECT_CLASSIFIER_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"
CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]
[[ -z "$(git status --porcelain=v1)" ]]

grep -Fq 'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq 'REVOKE ALL ON TABLE auth.mail_outbox FROM PUBLIC' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql

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

LOCAL_STAGE='READ_ONLY_CLASSIFIER'
guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$EXPECTED_OWNER' '$EXPECTED_ARGS'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
expected_owner="$1"
expected_args="$2"
REMOTE_STAGE='BOOTSTRAP'
remote_exit() {
  local rc="$?"
  trap - EXIT
  printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap remote_exit EXIT

[[ "$(id -u)" -eq 0 ]]
[[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]

REMOTE_STAGE='API_IDENTITY'
mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort)
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort)
(( ${#api_ids[@]} >= 1 && ${#api_ids[@]} <= 4 ))
(( ${#web_ids[@]} == 1 ))
role_token=''
for id in "${api_ids[@]}"; do
  docker exec "$id" node -e "require.resolve('@prisma/client')" >/dev/null 2>&1
  one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE_API'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const known = new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']);
async function run() {
  const rows = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const ro = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') = 'on' AS ro");
    if (!Array.isArray(ro) || ro.length !== 1 || ro[0].ro !== true) throw new Error('ro');
    return tx.$queryRawUnsafe(`SELECT current_user::text AS e, session_user::text AS s, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_catalog.pg_roles WHERE rolname=current_user`);
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('shape');
  const x=rows[0];
  if (!x.e || x.e !== x.s || known.has(x.e)) throw new Error('identity');
  if (x.rolsuper || x.rolbypassrls || x.rolcreatedb || x.rolcreaterole || x.rolreplication) throw new Error('privileged');
  if (/[\u0000\r\n]/.test(x.e) || Buffer.byteLength(x.e,'utf8') > 63) throw new Error('invalid');
  process.stdout.write(`SAFE_OTHER|${Buffer.from(x.e,'utf8').toString('base64url')}\n`);
}
run().catch(()=>{process.exitCode=2;}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_API
)"
  [[ "$one" =~ ^SAFE_OTHER\|[A-Za-z0-9_-]+$ ]]
  candidate="${one#SAFE_OTHER|}"
  if [[ -z "$role_token" ]]; then role_token="$candidate"; else [[ "$candidate" == "$role_token" ]]; fi
done

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

REMOTE_STAGE='ADMIN_CLASSIFIER'
if admin_output="$(PC_TARGET_ROLE_B64="$role_token" "${dc[@]}" run --rm --no-deps --pull never -T -e PC_TARGET_ROLE_B64 --entrypoint /nodejs/bin/node "$migration_service" - "$expected_owner" "$expected_args" 2>/dev/null <<'NODE_ADMIN'
let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch {
  process.stdout.write('ADMIN_CLIENT|FAIL\n');
  process.stdout.write('ROLE_LOOKUP|QUERY_FAIL\nROLE_ATTR|QUERY_FAIL\nROLE_INHERIT|QUERY_FAIL\nMEMBERSHIP_OUT|QUERY_FAIL\nMEMBERSHIP_IN|QUERY_FAIL\n');
  process.stdout.write('FUNCTION_META|QUERY_FAIL\nFUNCTION_OWNER|QUERY_FAIL\nPUBLIC_EXECUTE|QUERY_FAIL\nSCHEMA_USAGE|QUERY_FAIL\nFUNCTION_EXECUTE|QUERY_FAIL\n');
  process.stdout.write('TABLE_META|QUERY_FAIL\nTABLE_EFFECTIVE|QUERY_FAIL\nTABLE_DIRECT|QUERY_FAIL\nTABLE_PUBLIC|QUERY_FAIL\nADMIN_SUPERUSER|QUERY_FAIL\n');
  process.exit(0);
}
const expectedOwner=process.argv[2];
const expectedArgs=process.argv[3];
const role=Buffer.from(process.env.PC_TARGET_ROLE_B64 || '','base64url').toString('utf8');
const prisma=new PrismaClient({log:[]});
const known=new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']);

async function roQuery(sql, ...params) {
  try {
    const rows=await prisma.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const chk=await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') = 'on' AS ro");
      if(!Array.isArray(chk)||chk.length!==1||chk[0].ro!==true) throw new Error('ro');
      return tx.$queryRawUnsafe(sql,...params);
    },{maxWait:5000,timeout:15000});
    return {ok:true,rows};
  } catch {
    return {ok:false,rows:[]};
  }
}
const yn=v=>v===true?'YES':'NO';

async function run(){
  process.stdout.write('ADMIN_CLIENT|PASS\n');
  if(!role||known.has(role)||Buffer.byteLength(role,'utf8')>63||/[\u0000\r\n]/.test(role)){
    process.stdout.write('ROLE_LOOKUP|INVALID\nROLE_ATTR|INVALID\nROLE_INHERIT|INVALID\n');
    process.stdout.write('MEMBERSHIP_OUT|QUERY_FAIL\nMEMBERSHIP_IN|QUERY_FAIL\nFUNCTION_META|QUERY_FAIL\nFUNCTION_OWNER|QUERY_FAIL\nPUBLIC_EXECUTE|QUERY_FAIL\nSCHEMA_USAGE|QUERY_FAIL\nFUNCTION_EXECUTE|QUERY_FAIL\nTABLE_META|QUERY_FAIL\nTABLE_EFFECTIVE|QUERY_FAIL\nTABLE_DIRECT|QUERY_FAIL\nTABLE_PUBLIC|QUERY_FAIL\nADMIN_SUPERUSER|QUERY_FAIL\n');
    return;
  }

  const rr=await roQuery(`SELECT oid,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit FROM pg_catalog.pg_roles WHERE rolname=$1::text`,role);
  let roleOid=null;
  if(!rr.ok){process.stdout.write('ROLE_LOOKUP|QUERY_FAIL\nROLE_ATTR|QUERY_FAIL\nROLE_INHERIT|QUERY_FAIL\n');}
  else if(!Array.isArray(rr.rows)||rr.rows.length!==1){process.stdout.write('ROLE_LOOKUP|MISSING_OR_AMBIGUOUS\nROLE_ATTR|QUERY_FAIL\nROLE_INHERIT|QUERY_FAIL\n');}
  else{
    roleOid=rr.rows[0].oid;
    const r=rr.rows[0];
    const privileged=!!(r.rolsuper||r.rolbypassrls||r.rolcreatedb||r.rolcreaterole||r.rolreplication);
    process.stdout.write('ROLE_LOOKUP|PASS\n');
    process.stdout.write(`ROLE_ATTR|${privileged?'PRIVILEGED':'SAFE'}\n`);
    process.stdout.write(`ROLE_INHERIT|${yn(r.rolinherit)}\n`);
  }

  if(roleOid===null){process.stdout.write('MEMBERSHIP_OUT|QUERY_FAIL\nMEMBERSHIP_IN|QUERY_FAIL\n');}
  else{
    const mr=await roQuery(`SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=$1::oid) AS member_out, EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid=$1::oid) AS member_in`,roleOid);
    if(!mr.ok||!Array.isArray(mr.rows)||mr.rows.length!==1) process.stdout.write('MEMBERSHIP_OUT|QUERY_FAIL\nMEMBERSHIP_IN|QUERY_FAIL\n');
    else{
      process.stdout.write(`MEMBERSHIP_OUT|${yn(mr.rows[0].member_out)}\n`);
      process.stdout.write(`MEMBERSHIP_IN|${yn(mr.rows[0].member_in)}\n`);
    }
  }

  const ar=await roQuery(`SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user`);
  if(!ar.ok||!Array.isArray(ar.rows)||ar.rows.length!==1) process.stdout.write('ADMIN_SUPERUSER|QUERY_FAIL\n');
  else process.stdout.write(`ADMIN_SUPERUSER|${yn(ar.rows[0].rolsuper)}\n`);

  const fr=await roQuery(`SELECT p.oid, pg_catalog.pg_get_userbyid(p.proowner)=$1::text AS owner_ok, EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='enqueue_mail_outbox' AND pg_catalog.pg_get_function_identity_arguments(p.oid)=$2::text`,expectedOwner,expectedArgs);
  let fnOid=null;
  if(!fr.ok){process.stdout.write('FUNCTION_META|QUERY_FAIL\nFUNCTION_OWNER|QUERY_FAIL\nPUBLIC_EXECUTE|QUERY_FAIL\n');}
  else if(!Array.isArray(fr.rows)||fr.rows.length!==1){process.stdout.write('FUNCTION_META|MISSING_OR_AMBIGUOUS\nFUNCTION_OWNER|QUERY_FAIL\nPUBLIC_EXECUTE|QUERY_FAIL\n');}
  else{
    fnOid=fr.rows[0].oid;
    process.stdout.write('FUNCTION_META|PASS\n');
    process.stdout.write(`FUNCTION_OWNER|${yn(fr.rows[0].owner_ok)}\n`);
    process.stdout.write(`PUBLIC_EXECUTE|${yn(fr.rows[0].public_execute)}\n`);
  }

  const sr=await roQuery(`SELECT n.oid, pg_catalog.has_schema_privilege($1::text,n.oid,'USAGE') AS usage FROM pg_catalog.pg_namespace n WHERE n.nspname='auth'`,role);
  if(!sr.ok||!Array.isArray(sr.rows)||sr.rows.length!==1) process.stdout.write('SCHEMA_USAGE|QUERY_FAIL\n');
  else process.stdout.write(`SCHEMA_USAGE|${yn(sr.rows[0].usage)}\n`);

  if(fnOid===null) process.stdout.write('FUNCTION_EXECUTE|QUERY_FAIL\n');
  else{
    const er=await roQuery(`SELECT pg_catalog.has_function_privilege($1::text,$2::oid,'EXECUTE') AS exec`,role,fnOid);
    if(!er.ok||!Array.isArray(er.rows)||er.rows.length!==1) process.stdout.write('FUNCTION_EXECUTE|QUERY_FAIL\n');
    else process.stdout.write(`FUNCTION_EXECUTE|${yn(er.rows[0].exec)}\n`);
  }

  const tr=await roQuery(`SELECT c.oid,c.relowner, COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner)) AS acl FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname='mail_outbox' AND c.relkind IN ('r','p')`);
  let tableOid=null; let tableOwner=null;
  if(!tr.ok){process.stdout.write('TABLE_META|QUERY_FAIL\nTABLE_EFFECTIVE|QUERY_FAIL\nTABLE_DIRECT|QUERY_FAIL\nTABLE_PUBLIC|QUERY_FAIL\n');}
  else if(!Array.isArray(tr.rows)||tr.rows.length!==1){process.stdout.write('TABLE_META|MISSING_OR_AMBIGUOUS\nTABLE_EFFECTIVE|QUERY_FAIL\nTABLE_DIRECT|QUERY_FAIL\nTABLE_PUBLIC|QUERY_FAIL\n');}
  else{
    tableOid=tr.rows[0].oid; tableOwner=tr.rows[0].relowner;
    process.stdout.write('TABLE_META|PASS\n');
    const eff=await roQuery(`SELECT pg_catalog.has_table_privilege($1::text,$2::oid,'SELECT') AS a, pg_catalog.has_table_privilege($1::text,$2::oid,'INSERT') AS b, pg_catalog.has_table_privilege($1::text,$2::oid,'UPDATE') AS c, pg_catalog.has_table_privilege($1::text,$2::oid,'DELETE') AS d, pg_catalog.has_table_privilege($1::text,$2::oid,'TRUNCATE') AS e, pg_catalog.has_table_privilege($1::text,$2::oid,'REFERENCES') AS f, pg_catalog.has_table_privilege($1::text,$2::oid,'TRIGGER') AS g`,role,tableOid);
    if(!eff.ok||!Array.isArray(eff.rows)||eff.rows.length!==1) process.stdout.write('TABLE_EFFECTIVE|QUERY_FAIL\n');
    else{
      const x=eff.rows[0]; const any=!!(x.a||x.b||x.c||x.d||x.e||x.f||x.g);
      process.stdout.write(`TABLE_EFFECTIVE|${any?'PRESENT':'NONE'}\n`);
    }
    if(roleOid===null){process.stdout.write('TABLE_DIRECT|QUERY_FAIL\nTABLE_PUBLIC|QUERY_FAIL\n');}
    else{
      const acl=await roQuery(`SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE a.grantee=$1::oid) AS direct_any, EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE a.grantee=0) AS public_any FROM pg_catalog.pg_class c WHERE c.oid=$2::oid`,roleOid,tableOid);
      if(!acl.ok||!Array.isArray(acl.rows)||acl.rows.length!==1) process.stdout.write('TABLE_DIRECT|QUERY_FAIL\nTABLE_PUBLIC|QUERY_FAIL\n');
      else{
        process.stdout.write(`TABLE_DIRECT|${acl.rows[0].direct_any?'PRESENT':'NONE'}\n`);
        process.stdout.write(`TABLE_PUBLIC|${acl.rows[0].public_any?'PRESENT':'NONE'}\n`);
      }
    }
  }
}
run().catch(()=>{process.stdout.write('ADMIN_FATAL|CLASSIFIED_FAIL\n');}).finally(async()=>{await prisma.$disconnect().catch(()=>{});});
NODE_ADMIN
)"; then
  admin_rc=0
else
  admin_rc=$?
fi
(( admin_rc == 0 ))

required=(ADMIN_CLIENT ROLE_LOOKUP ROLE_ATTR ROLE_INHERIT MEMBERSHIP_OUT MEMBERSHIP_IN ADMIN_SUPERUSER FUNCTION_META FUNCTION_OWNER PUBLIC_EXECUTE SCHEMA_USAGE FUNCTION_EXECUTE TABLE_META TABLE_EFFECTIVE TABLE_DIRECT TABLE_PUBLIC)
for key in "${required[@]}"; do
  count="$(grep -c "^${key}|" <<< "$admin_output" || true)"
  [[ "$count" == 1 ]]
done
[[ -z "$(grep '^ADMIN_FATAL|' <<< "$admin_output" || true)" ]]

# Re-emit only fixed classifier labels; raw role/token and DB material never leave this remote process.
printf '%s\n' "$admin_output" | grep -E '^(ADMIN_CLIENT|ROLE_LOOKUP|ROLE_ATTR|ROLE_INHERIT|MEMBERSHIP_OUT|MEMBERSHIP_IN|ADMIN_SUPERUSER|FUNCTION_META|FUNCTION_OWNER|PUBLIC_EXECUTE|SCHEMA_USAGE|FUNCTION_EXECUTE|TABLE_META|TABLE_EFFECTIVE|TABLE_DIRECT|TABLE_PUBLIC)\|[A-Z_]+$'
REMOTE_STAGE='COMPLETE'
REMOTE
)"; then
  REMOTE_RC=0
else
  REMOTE_RC=$?
fi

remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"
mutation_marker="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1 || true)"
[[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]
IFS='|' read -r _ REMOTE_STAGE marker_rc <<< "$remote_marker"
[[ "$marker_rc" == "$REMOTE_RC" ]]
[[ "$mutation_marker" == 'PRODUCTION_MUTATION=NONE' ]]
(( REMOTE_RC == 0 )) || publish_failure "$REMOTE_RC"

classifier="$(printf '%s\n' "$output" | grep -E '^(ADMIN_CLIENT|ROLE_LOOKUP|ROLE_ATTR|ROLE_INHERIT|MEMBERSHIP_OUT|MEMBERSHIP_IN|ADMIN_SUPERUSER|FUNCTION_META|FUNCTION_OWNER|PUBLIC_EXECUTE|SCHEMA_USAGE|FUNCTION_EXECUTE|TABLE_META|TABLE_EFFECTIVE|TABLE_DIRECT|TABLE_PUBLIC)\|' | sort)"
[[ "$(wc -l <<< "$classifier" | tr -d ' ')" == 16 ]]

LOCAL_STAGE='FINAL_MAIN_GUARD'
guard_main

LOCAL_STAGE='PUBLISH'
format_line(){ local key="$1"; grep "^${key}|" <<< "$classifier" | cut -d'|' -f2; }
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail authority-inspect classifier

- diagnostic main: \`$SOURCE_SHA\`
- result: \`READ_ONLY_CLASSIFIED\`
- admin client: \`$(format_line ADMIN_CLIENT)\`
- target role lookup: \`$(format_line ROLE_LOOKUP)\`
- target role attributes: \`$(format_line ROLE_ATTR)\`
- target role INHERIT: \`$(format_line ROLE_INHERIT)\`
- target is member of another role: \`$(format_line MEMBERSHIP_OUT)\`
- target is granted to another role: \`$(format_line MEMBERSHIP_IN)\`
- migration authority superuser: \`$(format_line ADMIN_SUPERUSER)\`
- exact enqueue function metadata: \`$(format_line FUNCTION_META)\`
- exact enqueue function owner expected: \`$(format_line FUNCTION_OWNER)\`
- PUBLIC EXECUTE on exact enqueue function: \`$(format_line PUBLIC_EXECUTE)\`
- target auth schema USAGE: \`$(format_line SCHEMA_USAGE)\`
- target exact enqueue EXECUTE: \`$(format_line FUNCTION_EXECUTE)\`
- auth.mail_outbox metadata: \`$(format_line TABLE_META)\`
- target effective auth.mail_outbox table privileges: \`$(format_line TABLE_EFFECTIVE)\`
- target direct auth.mail_outbox ACL: \`$(format_line TABLE_DIRECT)\`
- PUBLIC auth.mail_outbox ACL: \`$(format_line TABLE_PUBLIC)\`
- raw DB role / role digest / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / GRANT / DDL / DML / API-Web restart: \`NONE\`
- production mutation: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null

echo 'AUTH_MAIL_AUTHORITY_INSPECT_CLASSIFIER=PASS'
echo 'PRODUCTION_MUTATION=NONE'
