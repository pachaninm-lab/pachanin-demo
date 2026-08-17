#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?required}"; : "${GH_TOKEN:?required}"; : "${RUNNER_TEMP:?required}"; : "${PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V3_COMMAND:?required}"
DEFAULT_HOST='195.19.12.120'; LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'; RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-api-principal-acl-repair-v3 31990014692 current-main'
REGPROC='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'; EXPECTED_OWNER='pc_auth_mail_enqueue_authority'
key_path="$RUNNER_TEMP/p0-auth-mail-acl-v3-key"; known_hosts="$RUNNER_TEMP/p0-auth-mail-acl-v3-known-hosts"; scan=''; match=''
SOURCE_SHA='unknown'; CURRENT_MAIN='unknown'; LOCAL_STAGE='BOOTSTRAP'; REMOTE_STAGE='NOT_STARTED'; REMOTE_RC='NA'; MUTATION='NONE'; ROLLBACK='NOT_NEEDED'
cleanup(){ rm -f -- "$key_path" "$known_hosts"; [[ -z "$scan" ]] || rm -f -- "$scan"; [[ -z "$match" ]] || rm -f -- "$match"; }; trap cleanup EXIT
publish_failure(){ local rc="${1:-1}"; trap - ERR; gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair v3

- repair main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- raw DB role / role token / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / API-Web restart: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null || true; exit "$rc"; }; trap 'rc=$?; publish_failure "$rc"' ERR
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
guard_main(){ local remote; remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"; [[ "$remote" == "$CURRENT_MAIN" ]]; git fetch --no-tags origin main >/dev/null; [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]; }

LOCAL_STAGE='AUTHORITY'; [[ "$PC_AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V3_COMMAND" == "$COMMAND" ]]; [[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'true' ]]; [[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"; CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"; [[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]; git fetch --no-tags origin main >/dev/null; [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]; [[ -z "$(git status --porcelain=v1)" ]]
grep -Fq 'GRANT USAGE ON SCHEMA auth TO' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq 'GRANT EXECUTE ON FUNCTION auth.enqueue_mail_outbox' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq 'REVOKE ALL ON TABLE auth.mail_outbox FROM PUBLIC' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql

LOCAL_STAGE='SSH_INPUT'; host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"; [[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1&&port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
validate_key(){ local f="$1" p; tr -d '\r' < "$f" > "$key_path"; chmod 0600 "$key_path"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1; p="$(mktemp)"; ssh-keygen -y -P '' -f "$key_path" > "$p" 2>/dev/null || { rm -f "$p"; return 1; }; rm -f "$p"; }
try_key(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"
LOCAL_STAGE='HOST_PIN'; guard_main; domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"; grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"; scan="$(mktemp)"; match="$(mktemp)"; pinned=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; if [[ -s "$scan" ]]; then while IFS= read -r line; do fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { pinned=1; break; }; fi; ((attempt==3)) || sleep "$attempt"; done
[[ "$pinned" == 1 ]]; mv "$match" "$known_hosts"; match=''; rm -f "$scan"; scan=''; chmod 0600 "$known_hosts"; ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)
LOCAL_STAGE='REMOTE_PREFLIGHT'; guard_main; ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; docker compose version >/dev/null' >/dev/null

LOCAL_STAGE='ACL_REPAIR_V3'; guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$REGPROC' '$EXPECTED_OWNER'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
regproc="$1"; expected_owner="$2"; REMOTE_STAGE='BOOTSTRAP'; mutation_applied=0; repair_success=0; rollback_state='NOT_NEEDED'; pre_schema='UNKNOWN'; pre_exec='UNKNOWN'; role_hex=''; dc=(); migration_service=''
remote_exit(){ local rc="$?"; trap - EXIT; if ((rc!=0 && mutation_applied==1 && repair_success==0)); then REMOTE_STAGE='ROLLBACK'; if rollback_acl; then rollback_state='PASS'; else rollback_state='FAILED'; fi; fi; printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"; printf 'PRODUCTION_DB_MUTATION|%s\n' "$([[ "$mutation_applied" == 1 ]] && printf 'LEAST_PRIVILEGE_ACL' || printf 'NONE')"; printf 'ROLLBACK|%s\n' "$rollback_state"; printf 'PASSWORD_RESET=NONE\nMAIL_SEND=NONE\nAPI_WEB_RESTART=NONE\n'; exit "$rc"; }; trap remote_exit EXIT
[[ "$(id -u)" -eq 0 ]]; [[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]
REMOTE_STAGE='API_PRINCIPAL'; mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api' | sort); mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort); (( ${#api_ids[@]}>=1 && ${#api_ids[@]}<=4 && ${#web_ids[@]}==1 ))
role_token=''
for id in "${api_ids[@]}"; do one="$(docker exec -i "$id" node - 2>/dev/null <<'NODE'
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient({log:[]});
(async()=>{const x=await p.$transaction(async t=>{await t.$executeRawUnsafe('SET TRANSACTION READ ONLY');const a=await t.$queryRawUnsafe(`SELECT current_user::text e,session_user::text s,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_catalog.pg_roles WHERE rolname=current_user`);return a[0]}); const known=new Set(['pc_auth_runtime','one_deal_auth','app_auth','app_service','pc_app','pc_auth_mail_runtime','pc_auth_mail_enqueue_authority','pc_auth_mail_retention_authority']); if(!x||x.e!==x.s||known.has(x.e)||x.rolsuper||x.rolbypassrls||x.rolcreatedb||x.rolcreaterole||x.rolreplication||/[\u0000\r\n]/.test(x.e)||Buffer.byteLength(x.e)>63)throw 1; process.stdout.write(Buffer.from(x.e).toString('base64url'))})().catch(()=>process.exitCode=2).finally(()=>p.$disconnect().catch(()=>{}));
NODE
)"; [[ "$one" =~ ^[A-Za-z0-9_-]+$ ]]; if [[ -z "$role_token" ]]; then role_token="$one"; else [[ "$role_token" == "$one" ]]; fi; done
role_hex="$(python3 - "$role_token" <<'PY'
import base64,sys
s=sys.argv[1]; b=base64.urlsafe_b64decode(s+'='*((4-len(s)%4)%4));
if not b or len(b)>63 or any(x in b for x in (b'\x00',b'\r',b'\n')): raise SystemExit(1)
print(b.hex())
PY
)"; [[ "$role_hex" =~ ^[0-9a-f]+$ ]]
REMOTE_STAGE='COMPOSE_AUTHORITY'; web_id="${web_ids[0]}"; prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"; prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"; prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"; [[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" && -d "$prod_dir" ]]; IFS=',' read -r -a raw_files <<< "$prod_compose"; files=(); for raw in "${raw_files[@]}"; do f="${raw#"${raw%%[![:space:]]*}"}"; f="${f%"${f##*[![:space:]]}"}"; [[ -n "$f" ]]||continue; [[ "$f" == /* ]]||f="$prod_dir/$f"; [[ -f "$f" && ! -L "$f" ]]; files+=("$f"); done; (( ${#files[@]}>=1 )); dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project"); for f in "${files[@]}"; do dc+=(-f "$f"); done
json="$("${dc[@]}" config --format json)"; migration_service="$(printf '%s' "$json" | python3 -c 'import json,re,sys;s=(json.load(sys.stdin).get("services") or {});c=[]
for n,v in s.items():
 i=str(v.get("image") or "");q=v.get("command");q=" ".join(q) if isinstance(q,list) else str(q or "")
 if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",n,re.I) or "grainflow-migration" in i or ("prisma" in q and "migrate" in q):c.append((n,v))
if len(c)!=1:raise SystemExit(1)
n,v=c[0];e=v.get("environment") or {};e=dict(x.split("=",1) for x in e if isinstance(x,str) and "=" in x) if isinstance(e,list) else e
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",n) or not e.get("DATABASE_URL"):raise SystemExit(1)
print(n)')"; [[ -n "$migration_service" ]]
db_exec(){ "${dc[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1; }
assert_sql(){ local c="$1"; printf '%s\n' "BEGIN; SET TRANSACTION READ ONLY; DO \$pc\$ BEGIN IF NOT COALESCE(($c),FALSE) THEN RAISE EXCEPTION 'blocked'; END IF; END \$pc\$; ROLLBACK;" | db_exec; }
role="convert_from(pg_catalog.decode('$role_hex','hex'),'UTF8')"; fn="to_regprocedure('$regproc')::oid"; table="'auth.mail_outbox'::regclass"
REMOTE_STAGE='AUTHORITY_PREFLIGHT'
assert_sql "(SELECT count(*)=1 FROM pg_catalog.pg_roles WHERE rolname=$role)"; assert_sql "NOT (SELECT rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication FROM pg_catalog.pg_roles WHERE rolname=$role)"; assert_sql "NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.member OR r.oid=m.roleid WHERE r.rolname=$role)"; assert_sql "$fn IS NOT NULL"; assert_sql "(SELECT pg_catalog.pg_get_userbyid(proowner)='$expected_owner' AND prosecdef FROM pg_catalog.pg_proc WHERE oid=$fn)"; assert_sql "NOT (SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proacl,pg_catalog.acldefault('f',proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_catalog.pg_proc WHERE oid=$fn)"; assert_sql "NOT (pg_catalog.has_table_privilege($role,$table,'SELECT') OR pg_catalog.has_table_privilege($role,$table,'INSERT') OR pg_catalog.has_table_privilege($role,$table,'UPDATE') OR pg_catalog.has_table_privilege($role,$table,'DELETE') OR pg_catalog.has_table_privilege($role,$table,'TRUNCATE') OR pg_catalog.has_table_privilege($role,$table,'REFERENCES') OR pg_catalog.has_table_privilege($role,$table,'TRIGGER'))"
if assert_sql "pg_catalog.has_schema_privilege($role,'auth','USAGE')"; then pre_schema='YES'; else assert_sql "NOT pg_catalog.has_schema_privilege($role,'auth','USAGE')"; pre_schema='NO'; fi
if assert_sql "pg_catalog.has_function_privilege($role,$fn,'EXECUTE')"; then pre_exec='YES'; else assert_sql "NOT pg_catalog.has_function_privilege($role,$fn,'EXECUTE')"; pre_exec='NO'; fi
apply_acl(){ local sql="BEGIN; DO \$pc\$ DECLARE r text := $role; BEGIN IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=r AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'role'; END IF; IF EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles q ON q.oid=m.member OR q.oid=m.roleid WHERE q.rolname=r) THEN RAISE EXCEPTION 'membership'; END IF; IF (SELECT pg_catalog.pg_get_userbyid(proowner)<>'$expected_owner' OR NOT prosecdef FROM pg_catalog.pg_proc WHERE oid=$fn) THEN RAISE EXCEPTION 'function'; END IF; IF (SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(proacl,pg_catalog.acldefault('f',proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_catalog.pg_proc WHERE oid=$fn) THEN RAISE EXCEPTION 'public'; END IF; IF pg_catalog.has_table_privilege(r,$table,'SELECT') OR pg_catalog.has_table_privilege(r,$table,'INSERT') OR pg_catalog.has_table_privilege(r,$table,'UPDATE') OR pg_catalog.has_table_privilege(r,$table,'DELETE') OR pg_catalog.has_table_privilege(r,$table,'TRUNCATE') OR pg_catalog.has_table_privilege(r,$table,'REFERENCES') OR pg_catalog.has_table_privilege(r,$table,'TRIGGER') THEN RAISE EXCEPTION 'table'; END IF; IF NOT pg_catalog.has_schema_privilege(r,'auth','USAGE') THEN EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I',r); END IF; IF NOT pg_catalog.has_function_privilege(r,$fn,'EXECUTE') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION $regproc TO %I',r); END IF; END \$pc\$; COMMIT;"; printf '%s\n' "$sql" | db_exec; }
rollback_acl(){ local body="BEGIN; DO \$pc\$ DECLARE r text := $role; BEGIN"; [[ "$pre_exec" == NO ]] && body+=" EXECUTE format('REVOKE EXECUTE ON FUNCTION $regproc FROM %I',r);"; [[ "$pre_schema" == NO ]] && body+=" EXECUTE format('REVOKE USAGE ON SCHEMA auth FROM %I',r);"; body+=" END \$pc\$; COMMIT;"; printf '%s\n' "$body" | db_exec; }
if [[ "$pre_schema" == NO || "$pre_exec" == NO ]]; then REMOTE_STAGE='GRANT_EXACT'; apply_acl; mutation_applied=1; fi
REMOTE_STAGE='DB_POSTVERIFY'; assert_sql "pg_catalog.has_schema_privilege($role,'auth','USAGE')"; assert_sql "pg_catalog.has_function_privilege($role,$fn,'EXECUTE')"; assert_sql "NOT (pg_catalog.has_table_privilege($role,$table,'SELECT') OR pg_catalog.has_table_privilege($role,$table,'INSERT') OR pg_catalog.has_table_privilege($role,$table,'UPDATE') OR pg_catalog.has_table_privilege($role,$table,'DELETE') OR pg_catalog.has_table_privilege($role,$table,'TRUNCATE') OR pg_catalog.has_table_privilege($role,$table,'REFERENCES') OR pg_catalog.has_table_privilege($role,$table,'TRIGGER'))"
REMOTE_STAGE='API_POSTVERIFY'; for id in "${api_ids[@]}"; do v="$(docker exec -i "$id" node - 2>/dev/null <<'NODEV'
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient({log:[]});(async()=>{const a=await p.$queryRawUnsafe(`SELECT has_schema_privilege(current_user,'auth','USAGE') s,has_function_privilege(current_user,'auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)','EXECUTE') f,has_table_privilege(current_user,'auth.mail_outbox','SELECT') a,has_table_privilege(current_user,'auth.mail_outbox','INSERT') b,has_table_privilege(current_user,'auth.mail_outbox','UPDATE') c,has_table_privilege(current_user,'auth.mail_outbox','DELETE') d,has_table_privilege(current_user,'auth.mail_outbox','TRUNCATE') e,has_table_privilege(current_user,'auth.mail_outbox','REFERENCES') g,has_table_privilege(current_user,'auth.mail_outbox','TRIGGER') h`);const x=a[0];if(!x.s||!x.f||x.a||x.b||x.c||x.d||x.e||x.g||x.h)throw 1;process.stdout.write('PASS')})().catch(()=>process.exitCode=2).finally(()=>p.$disconnect().catch(()=>{}));
NODEV
)"; [[ "$v" == PASS ]]; done
repair_success=1; REMOTE_STAGE='COMPLETE'
REMOTE
)"; then REMOTE_RC=0; else REMOTE_RC=$?; fi
marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -1 || true)"; mut="$(grep '^PRODUCTION_DB_MUTATION|' <<< "$output" | tail -1 || true)"; rb="$(grep '^ROLLBACK|' <<< "$output" | tail -1 || true)"; [[ "$marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; IFS='|' read -r _ REMOTE_STAGE marker_rc <<< "$marker"; [[ "$marker_rc" == "$REMOTE_RC" ]]; MUTATION="${mut#PRODUCTION_DB_MUTATION|}"; ROLLBACK="${rb#ROLLBACK|}"; ((REMOTE_RC==0)) || publish_failure "$REMOTE_RC"
LOCAL_STAGE='FINAL_MAIN_GUARD'; guard_main; LOCAL_STAGE='PUBLISH'; gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail API-principal ACL repair v3

- repair main: \`$SOURCE_SHA\`
- result: \`PASS\`
- production DB mutation: \`$MUTATION\`
- rollback: \`$ROLLBACK\`
- postverify: \`SCHEMA_USAGE_YES / FUNCTION_EXECUTE_YES / TABLE_PRIVILEGES_NONE\`
- raw DB role / role token / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- password reset / mail send / deploy / API-Web restart: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null
echo 'AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V3=PASS'
