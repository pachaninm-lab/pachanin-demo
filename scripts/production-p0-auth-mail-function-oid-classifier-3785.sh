#!/usr/bin/env bash
set -Eeuo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_AUTH_MAIL_FUNCTION_OID_CLASSIFIER_COMMAND:?command is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-auth-mail-function-oid-classifier 31989582167 current-main'
FUNCTION_REGPROC='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'
EXPECTED_OWNER='pc_auth_mail_enqueue_authority'

key_path="$RUNNER_TEMP/p0-auth-mail-function-oid-key"
known_hosts="$RUNNER_TEMP/p0-auth-mail-function-oid-known-hosts"
scan=''; match=''
SOURCE_SHA='unknown'; CURRENT_MAIN='unknown'; LOCAL_STAGE='BOOTSTRAP'; REMOTE_STAGE='NOT_STARTED'; REMOTE_RC='NA'
cleanup(){ rm -f -- "$key_path" "$known_hosts"; [[ -z "$scan" ]] || rm -f -- "$scan"; [[ -z "$match" ]] || rm -f -- "$match"; }
trap cleanup EXIT
publish_failure(){ local rc="${1:-1}"; trap - ERR; gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail enqueue function OID classifier

- diagnostic main: \`$SOURCE_SHA\`
- result: \`FAIL_CLOSED\`
- local stage: \`$LOCAL_STAGE\`
- remote stage: \`$REMOTE_STAGE\`
- remote rc: \`$REMOTE_RC\`
- raw DB role / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- database write / GRANT / REVOKE / password reset / mail send / deploy / restart: \`NONE\`
- production mutation: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null || true; exit "$rc"; }
trap 'rc=$?; publish_failure "$rc"' ERR
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
guard_main(){ local remote; remote="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"; [[ "$remote" == "$CURRENT_MAIN" ]]; git fetch --no-tags origin main >/dev/null; [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]; }

LOCAL_STAGE='AUTHORITY'
[[ "$PC_AUTH_MAIL_FUNCTION_OID_CLASSIFIER_COMMAND" == "$COMMAND" ]]
[[ "${PRODUCTION_MUTATION_ALLOWED:-false}" == 'false' ]]
[[ "${PC_IS_PRODUCTION:-false}" == 'true' ]]
SOURCE_SHA="$(git rev-parse HEAD)"; CURRENT_MAIN="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$SOURCE_SHA" == "$CURRENT_MAIN" && "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null; [[ "$(git rev-parse origin/main)" == "$CURRENT_MAIN" ]]; [[ -z "$(git status --porcelain=v1)" ]]
grep -Fq 'CREATE OR REPLACE FUNCTION auth.enqueue_mail_outbox(' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq ') OWNER TO pc_auth_mail_enqueue_authority;' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql
grep -Fq 'REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox(' apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql

LOCAL_STAGE='SSH_INPUT'
host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"; user="$(trim "${PC_PROD_SSH_USER:-}")"; port="$(trim "${PC_PROD_SSH_PORT:-22}")"; expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]; [[ -n "$user" && "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]; [[ "$port" =~ ^[0-9]+$ ]] && ((port>=1 && port<=65535)); [[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
validate_key(){ local source="$1" pub; tr -d '\r' < "$source" > "$key_path"; chmod 0600 "$key_path"; grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1; pub="$(mktemp)"; ssh-keygen -y -P '' -f "$key_path" > "$pub" 2>/dev/null || { rm -f "$pub"; return 1; }; rm -f "$pub"; }
try_key(){ local raw="$1" a b c; [[ -n "$raw" ]] || return 1; a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"; printf '%s\n' "$raw" > "$a"; validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "${raw//\\n/$'\n'}" > "$b"; validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }; printf '%s' "$raw" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }; rm -f "$a" "$b" "$c"; return 1; }
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

LOCAL_STAGE='HOST_PIN'; guard_main
domain_ips="$(getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u || true)"; grep -Fxq "$DEFAULT_HOST" <<< "$domain_ips"
scan="$(mktemp)"; match="$(mktemp)"; pinned=0
for attempt in 1 2 3; do : > "$scan"; : > "$match"; ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan" || true; if [[ -s "$scan" ]]; then while IFS= read -r line; do fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"; [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"; done < "$scan"; sort -u -o "$match" "$match"; [[ "$(grep -c . "$match" || true)" == 1 ]] && { pinned=1; break; }; fi; ((attempt==3)) || sleep "$attempt"; done
[[ "$pinned" == 1 ]]; mv "$match" "$known_hosts"; match=''; rm -f "$scan"; scan=''; chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

LOCAL_STAGE='REMOTE_PREFLIGHT'; guard_main
ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; docker version >/dev/null; docker compose version >/dev/null' >/dev/null

LOCAL_STAGE='READ_ONLY_FUNCTION_CLASSIFIER'; guard_main
if output="$(ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$FUNCTION_REGPROC' '$EXPECTED_OWNER'" 2>/dev/null <<'REMOTE'
set -Eeuo pipefail
regproc="$1"; expected_owner="$2"; REMOTE_STAGE='BOOTSTRAP'
remote_exit(){ local rc="$?"; trap - EXIT; printf 'REMOTE_STAGE|%s|%s\n' "$REMOTE_STAGE" "$rc"; printf 'PRODUCTION_MUTATION=NONE\n'; exit "$rc"; }; trap remote_exit EXIT
[[ "$(id -u)" -eq 0 ]]; [[ "$expected_owner" == 'pc_auth_mail_enqueue_authority' ]]
REMOTE_STAGE='COMPOSE_AUTHORITY'
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort); (( ${#web_ids[@]} == 1 )); web_id="${web_ids[0]}"
prod_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"; prod_compose="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"; prod_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ -n "$prod_dir" && -n "$prod_compose" && -n "$prod_project" && -d "$prod_dir" ]]
IFS=',' read -r -a raw_files <<< "$prod_compose"; compose_files=(); for raw in "${raw_files[@]}"; do file="${raw#"${raw%%[![:space:]]*}"}"; file="${file%"${file##*[![:space:]]}"}"; [[ -n "$file" ]] || continue; [[ "$file" == /* ]] || file="$prod_dir/$file"; [[ -f "$file" && ! -L "$file" ]]; compose_files+=("$file"); done; (( ${#compose_files[@]} >= 1 ))
dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project"); for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
compose_json="$("${dc[@]}" config --format json)"
migration_service="$(printf '%s' "$compose_json" | python3 -c 'import json,re,sys; s=(json.load(sys.stdin).get("services") or {}); c=[]
for n,v in s.items():
 i=str(v.get("image") or ""); q=v.get("command"); q=" ".join(q) if isinstance(q,list) else str(q or "")
 if re.search(r"(^|[-_])(migrate|migration)([-_]|$)",n,re.I) or "grainflow-migration" in i or ("prisma" in q and "migrate" in q): c.append((n,v))
if len(c)!=1: raise SystemExit(1)
n,v=c[0]; e=v.get("environment") or {}; e=dict(x.split("=",1) for x in e if isinstance(x,str) and "=" in x) if isinstance(e,list) else e
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}",n) or not e.get("DATABASE_URL"): raise SystemExit(1)
print(n)')"; [[ -n "$migration_service" ]]
REMOTE_STAGE='FUNCTION_CATALOG'
db_exec(){ "${dc[@]}" run --rm --no-deps --pull never -T "$migration_service" node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1; }
assert_sql(){ local condition="$1" sql; sql="BEGIN; SET TRANSACTION READ ONLY; DO \$pc\$ BEGIN IF NOT COALESCE(($condition),FALSE) THEN RAISE EXCEPTION 'classifier'; END IF; END \$pc\$; ROLLBACK;"; printf '%s\n' "$sql" | db_exec; }
class_bool(){ local key="$1" condition="$2"; if assert_sql "$condition"; then printf '%s|YES\n' "$key"; elif assert_sql "NOT COALESCE(($condition),FALSE)"; then printf '%s|NO\n' "$key"; else printf '%s|QUERY_FAIL\n' "$key"; fi; }
if assert_sql "to_regprocedure('$regproc') IS NOT NULL"; then printf 'FUNCTION_REGPROCEDURE|PASS\n'; else printf 'FUNCTION_REGPROCEDURE|MISSING\n'; exit 42; fi
if assert_sql "(SELECT count(*)=1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='enqueue_mail_outbox')"; then printf 'FUNCTION_NAME_COUNT|ONE\n'; else printf 'FUNCTION_NAME_COUNT|NOT_ONE\n'; exit 43; fi
class_bool FUNCTION_OWNER "(SELECT pg_catalog.pg_get_userbyid(p.proowner)='$expected_owner' FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure('$regproc')::oid)"
class_bool PUBLIC_EXECUTE "(SELECT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure('$regproc')::oid)"
class_bool SECURITY_DEFINER "(SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure('$regproc')::oid)"
REMOTE_STAGE='COMPLETE'
REMOTE
)"; then REMOTE_RC=0; else REMOTE_RC=$?; fi
remote_marker="$(grep '^REMOTE_STAGE|' <<< "$output" | tail -n1 || true)"; mutation_marker="$(grep '^PRODUCTION_MUTATION=' <<< "$output" | tail -n1 || true)"; [[ "$remote_marker" =~ ^REMOTE_STAGE\|[A-Z0-9_]+\|[0-9]+$ ]]; IFS='|' read -r _ REMOTE_STAGE marker_rc <<< "$remote_marker"; [[ "$marker_rc" == "$REMOTE_RC" ]]; [[ "$mutation_marker" == 'PRODUCTION_MUTATION=NONE' ]]; ((REMOTE_RC==0)) || publish_failure "$REMOTE_RC"
for key in FUNCTION_REGPROCEDURE FUNCTION_NAME_COUNT FUNCTION_OWNER PUBLIC_EXECUTE SECURITY_DEFINER; do [[ "$(grep -c "^${key}|" <<< "$output" || true)" == 1 ]]; done
LOCAL_STAGE='FINAL_MAIN_GUARD'; guard_main
LOCAL_STAGE='PUBLISH'; value(){ grep "^$1|" <<< "$output" | cut -d'|' -f2; }
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 auth-mail enqueue function OID classifier

- diagnostic main: \`$SOURCE_SHA\`
- result: \`READ_ONLY_CLASSIFIED\`
- exact regprocedure resolves: \`$(value FUNCTION_REGPROCEDURE)\`
- enqueue function name cardinality: \`$(value FUNCTION_NAME_COUNT)\`
- owner is expected authority: \`$(value FUNCTION_OWNER)\`
- PUBLIC EXECUTE: \`$(value PUBLIC_EXECUTE)\`
- SECURITY DEFINER: \`$(value SECURITY_DEFINER)\`
- raw DB role / DB URL / credentials / SQL errors / PII: \`NOT_PUBLISHED\`
- database write / GRANT / REVOKE / password reset / mail send / deploy / restart: \`NONE\`
- production mutation: \`NONE\`
- new mandatory cost: \`0 RUB\`" >/dev/null
echo 'AUTH_MAIL_FUNCTION_OID_CLASSIFIER=PASS'; echo 'PRODUCTION_MUTATION=NONE'
