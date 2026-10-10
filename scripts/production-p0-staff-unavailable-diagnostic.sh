#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-staff-unavailable-diagnose deployed-runtime'
WINDOW_START='2026-08-23T12:05:00Z'
WINDOW_END='2026-08-23T12:15:00Z'
PRODUCTION_MUTATION='NONE'

key_path="$RUNNER_TEMP/p0-staff-unavailable-key"
known_hosts="$RUNNER_TEMP/p0-staff-unavailable-known-hosts"
raw="$RUNNER_TEMP/p0-staff-unavailable-raw"
TARGET_SHA='unknown'
DEPLOYED_SHA='unknown'
PUBLISHED=0

cleanup() { rm -f -- "$key_path" "$known_hosts" "$raw"; }
trap cleanup EXIT

publish_failure() {
  local rc=$?
  trap - ERR
  if [[ "$PUBLISHED" == 0 ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 staff unavailable diagnostic

- command: \`$COMMAND\`
- diagnostic main: \`$TARGET_SHA\`
- deployed runtime: \`$DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- blocker: \`DIAGNOSTIC_EXECUTION_FAILED\`
- production mutation: \`NONE\`
- secrets / PII / raw logs: \`NOT_PUBLISHED\`
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

TARGET_SHA="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
git fetch --no-tags origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]
[[ -z "$(git status --porcelain=v1)" ]]

host="$(trim "${PC_PROD_HOST:-$DEFAULT_HOST}")"
user="$(trim "${PC_PROD_SSH_USER:-}")"
port="$(trim "${PC_PROD_SSH_PORT:-22}")"
expected="$(trim "${PC_PROD_SSH_HOST_FINGERPRINT:-}")"
[[ "$host" == "$DEFAULT_HOST" ]]
[[ "$user" =~ ^[A-Za-z_][A-Za-z0-9_-]{0,31}$ ]]
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
[[ "$expected" =~ ^SHA256:[A-Za-z0-9+/=]+$ ]]
getent ahostsv4 "$LIVE_DOMAIN" | awk '{print $1}' | sort -u | grep -Fxq "$DEFAULT_HOST"

validate_key() {
  local source="$1" public_key
  tr -d '\r' < "$source" > "$key_path"
  chmod 0600 "$key_path"
  grep -Eq '^(ssh-|ecdsa-|sk-)' "$key_path" && return 1
  public_key="$(mktemp)"
  ssh-keygen -y -P '' -f "$key_path" > "$public_key" 2>/dev/null || { rm -f "$public_key"; return 1; }
  rm -f "$public_key"
}
try_key() {
  local value="$1" a b c
  [[ -n "$value" ]] || return 1
  a="$(mktemp)"; b="$(mktemp)"; c="$(mktemp)"
  printf '%s\n' "$value" > "$a"
  validate_key "$a" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "${value//\\n/$'\n'}" > "$b"
  validate_key "$b" && { rm -f "$a" "$b" "$c"; return 0; }
  printf '%s' "$value" | base64 --decode > "$c" 2>/dev/null && validate_key "$c" && { rm -f "$a" "$b" "$c"; return 0; }
  rm -f "$a" "$b" "$c"; return 1
}
try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
[[ "$(grep -c . "$match" || true)" == 1 ]]
mv "$match" "$known_hosts"; rm -f "$scan"; chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15)

inventory="$(ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; mapfile -t w < <(docker ps -q --filter "label=com.docker.compose.service=web"); ((${#w[@]}==1)); p="$(docker inspect --format "{{ index .Config.Labels \"com.docker.compose.project\" }}" "${w[0]}")"; mapfile -t a < <(docker ps -q --filter "label=com.docker.compose.project=$p" --filter "label=com.docker.compose.service=api"); ((${#a[@]}==1)); wr="$(docker inspect --format "{{ index .Config.Labels \"org.opencontainers.image.revision\" }}" "${w[0]}")"; ar="$(docker inspect --format "{{ index .Config.Labels \"org.opencontainers.image.revision\" }}" "${a[0]}")"; [[ "$wr" == "$ar" && "$wr" =~ ^[0-9a-f]{40}$ ]]; printf "RUNTIME|%s\n" "$wr"')"
DEPLOYED_SHA="${inventory#RUNTIME|}"
[[ "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]
git cat-file -e "$DEPLOYED_SHA^{commit}"
git merge-base --is-ancestor "$DEPLOYED_SHA" "$TARGET_SHA"

# The diagnostic may run while unrelated security-documentation work advances main.
# Prove that everything after the deployed runtime is non-runtime before touching production.
while IFS= read -r path; do
  [[ -n "$path" ]] || continue
  case "$path" in
    docs/*|scripts/security/*|.github/workflows/production-p0-staff-unavailable-diagnostic.yml|scripts/production-p0-staff-unavailable-diagnostic.sh|scripts/check-production-p0-staff-unavailable-diagnostic.mjs) ;;
    *) echo "runtime-significant drift after deployed revision: $path" >&2; exit 41 ;;
  esac
done < <(git diff --name-only "$DEPLOYED_SHA" "$TARGET_SHA")

ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$DEPLOYED_SHA' '$WINDOW_START' '$WINDOW_END'" > "$raw" <<'REMOTE'
set -Eeuo pipefail
umask 077
deployed_sha="$1"; window_start="$2"; window_end="$3"
[[ "$deployed_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$window_start" =~ ^[0-9TZ:-]+$ && "$window_end" =~ ^[0-9TZ:-]+$ ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null

tmp="$(mktemp -d /tmp/p0-staff-unavailable.XXXXXX)"
trap 'rm -rf -- "$tmp"' EXIT
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )); web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )); api_id="${api_ids[0]}"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$web_revision" == "$deployed_sha" && "$api_revision" == "$deployed_sha" ]]

# Classify the exact Web server authority and transport. Never print API_URL.
docker exec -i "$web_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const emit=(k,v)=>process.stdout.write(`${k}=${v}\n`);
const raw=String(process.env.API_URL||'').trim();
let origin=''; let klass='';
if(!raw){ origin='http://api:3001'; klass='FALLBACK_COMPOSE'; }
else {
  try {
    const u=new URL(raw);
    if(u.username||u.password||u.search||u.hash||!['http:','https:'].includes(u.protocol)) throw new Error('invalid');
    if(u.protocol==='http:' && (u.origin!=='http://api:3001'||(u.pathname!=='/'&&u.pathname!==''))) throw new Error('invalid');
    origin=u.protocol==='http:'?'http://api:3001':u.toString().replace(/\/$/,'');
    klass=u.protocol==='http:'?'EXACT_COMPOSE':'EXPLICIT_HTTPS';
  } catch { klass='INVALID'; }
}
emit('API_ORIGIN_CLASS',klass);
const probe=async(path,key)=>{
  if(!origin){emit(key,'NA');return;}
  try {
    const r=await fetch(`${origin}${path}`,{redirect:'manual',signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'}});
    emit(key,String(r.status)); await r.body?.cancel().catch(()=>{});
  } catch(e){ emit(key,e&&e.name==='TimeoutError'?'TIMEOUT':'FETCH_ERROR'); }
};
(async()=>{await probe('/auth/me','AUTH_ME_ANON_STATUS');await probe('/staff/capabilities/me','CAPABILITIES_ANON_STATUS');})().catch(()=>process.exitCode=1);
NODE

# Prove the auth runtime can perform the table reads used by StaffCapabilitiesService.
docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const {PrismaClient}=require('@prisma/client');
const safe=(v)=>String(v||'UNKNOWN').replace(/[^A-Za-z0-9_-]/g,'').slice(0,32)||'UNKNOWN';
const emit=(k,v)=>process.stdout.write(`${k}=${v}\n`);
(async()=>{
 const url=String(process.env.AUTH_DATABASE_URL||'').trim();
 if(!url){emit('AUTH_DB_CHECK','URL_MISSING');return;}
 const db=new PrismaClient({datasources:{db:{url}}});
 try{
  const row=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   const r=await tx.$queryRawUnsafe(`SELECT current_user AS u,
     has_table_privilege(current_user,'auth.staff_assignments','SELECT') AS a,
     has_table_privilege(current_user,'auth.staff_access_requests','SELECT') AS r,
     has_table_privilege(current_user,'auth.staff_access_sessions','SELECT') AS s,
     has_table_privilege(current_user,'auth.staff_critical_action_requests','SELECT') AS c,
     has_table_privilege(current_user,'auth.audit_events','SELECT') AS e`);
   await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM auth.staff_assignments WHERE status IN ('ELIGIBLE','ACTIVE')`);
   await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM auth.staff_access_sessions WHERE status='ACTIVE' AND expires_at>now()`);
   return r[0];
  });
  const known=['pc_auth_runtime','one_deal_auth','app_auth'].includes(String(row?.u||''));
  const acl=Boolean(row?.a&&row?.r&&row?.s&&row?.c&&row?.e);
  emit('AUTH_DB_PRINCIPAL_CLASS',known?'KNOWN_AUTH_RUNTIME':'OTHER');
  emit('AUTH_DB_STAFF_READ_ACL',acl?'PASS':'FAIL');
  emit('AUTH_DB_CHECK','PASS');
 }catch(e){emit('AUTH_DB_CHECK',`ERROR_${safe(e?.code)}`)}finally{await db.$disconnect().catch(()=>{});}
})().catch(()=>{emit('AUTH_DB_CHECK','FATAL');process.exitCode=1;});
NODE

# Aggregate-only evidence of whether the human login + MFA ceremony actually occurred in the screenshot window.
docker exec -i "$api_id" /nodejs/bin/node --input-type=commonjs - "$window_start" "$window_end" <<'NODE'
const {PrismaClient}=require('@prisma/client');
const [start,end]=process.argv.slice(2); const emit=(k,v)=>process.stdout.write(`${k}=${v}\n`);
(async()=>{
 const url=String(process.env.AUTH_DATABASE_URL||'').trim(); if(!url){emit('CEREMONY_AUDIT','URL_MISSING');return;}
 const db=new PrismaClient({datasources:{db:{url}}});
 try{
  const rows=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   return tx.$queryRawUnsafe(`WITH reviewer AS (
      SELECT DISTINCT user_id FROM auth.staff_assignments
      WHERE role='PLATFORM_OWNER' AND status IN ('ELIGIBLE','ACTIVE')
    ) SELECT
      count(*) FILTER (WHERE lower(a.action) LIKE 'auth.login%' AND a.outcome='SUCCESS')::int AS login_success,
      count(*) FILTER (WHERE lower(a.action) LIKE '%mfa%' AND a.outcome='SUCCESS')::int AS mfa_success,
      count(*) FILTER (WHERE lower(a.action) LIKE 'auth.login%' AND a.outcome IN ('FAILURE','DENIED'))::int AS login_denied
    FROM auth.audit_events a JOIN reviewer r ON r.user_id=a.user_id
    WHERE a.created_at >= $1::timestamptz AND a.created_at <= $2::timestamptz`, start, end);
  });
  const r=rows[0]||{}; emit('CEREMONY_LOGIN_SUCCESS',Number(r.login_success||0));emit('CEREMONY_MFA_SUCCESS',Number(r.mfa_success||0));emit('CEREMONY_LOGIN_DENIED',Number(r.login_denied||0));emit('CEREMONY_AUDIT','PASS');
 }catch(e){emit('CEREMONY_AUDIT','ERROR')}finally{await db.$disconnect().catch(()=>{});}
})().catch(()=>{emit('CEREMONY_AUDIT','FATAL');process.exitCode=1;});
NODE

# Reduce the exact live window to bounded marker counts. Raw logs never leave the VPS.
docker logs --since "$window_start" --until "$window_end" "$web_id" > "$tmp/web.log" 2>&1 || true
docker logs --since "$window_start" --until "$window_end" "$api_id" > "$tmp/api.log" 2>&1 || true
count(){ grep -Eic -- "$1" "$2" 2>/dev/null || true; }
printf 'WEB_STAFF_TRANSPORT_FAILURES=%s\n' "$(count 'staff_capabilities_transport_failure' "$tmp/web.log")"
printf 'WEB_TIMEOUT_MARKERS=%s\n' "$(count 'TimeoutError|ETIMEDOUT|ECONNREFUSED|ENOTFOUND' "$tmp/web.log")"
printf 'API_STAFF_MARKERS=%s\n' "$(count 'staff/capabilities|StaffCapabilities|staff-access' "$tmp/api.log")"
printf 'API_PRISMA_ERROR_MARKERS=%s\n' "$(count 'PrismaClient(Known|Unknown|Initialization|RustPanic)?Error|P20[0-9][0-9]' "$tmp/api.log")"
printf 'API_PERMISSION_ERROR_MARKERS=%s\n' "$(count 'permission denied|insufficient privilege|42501' "$tmp/api.log")"
printf 'PRODUCTION_MUTATION=NONE\n'
REMOTE

getv(){ sed -n "s/^$1=//p" "$raw" | tail -1; }
origin_class="$(getv API_ORIGIN_CLASS)"; auth_status="$(getv AUTH_ME_ANON_STATUS)"; cap_status="$(getv CAPABILITIES_ANON_STATUS)"
db_principal="$(getv AUTH_DB_PRINCIPAL_CLASS)"; db_acl="$(getv AUTH_DB_STAFF_READ_ACL)"; db_check="$(getv AUTH_DB_CHECK)"
ceremony="$(getv CEREMONY_AUDIT)"; login_success="$(getv CEREMONY_LOGIN_SUCCESS)"; mfa_success="$(getv CEREMONY_MFA_SUCCESS)"; login_denied="$(getv CEREMONY_LOGIN_DENIED)"
web_transport="$(getv WEB_STAFF_TRANSPORT_FAILURES)"; web_timeout="$(getv WEB_TIMEOUT_MARKERS)"; api_staff="$(getv API_STAFF_MARKERS)"; api_prisma="$(getv API_PRISMA_ERROR_MARKERS)"; api_perm="$(getv API_PERMISSION_ERROR_MARKERS)"; mutation="$(getv PRODUCTION_MUTATION)"
[[ "$mutation" == NONE ]]
for n in "$login_success" "$mfa_success" "$login_denied" "$web_transport" "$web_timeout" "$api_staff" "$api_prisma" "$api_perm"; do [[ "$n" =~ ^[0-9]+$ ]]; done

classification='AUTHENTICATED_FAILURE_REQUIRES_FURTHER_SAFE_PROBE'
if [[ "$origin_class" == INVALID ]]; then classification='WEB_SERVER_API_ORIGIN_INVALID'
elif [[ "$auth_status" != 401 ]]; then classification='WEB_TO_API_AUTH_ROUTE_UNEXPECTED'
elif [[ "$cap_status" != 401 ]]; then classification='WEB_TO_API_CAPABILITIES_ROUTE_UNEXPECTED'
elif [[ "$db_check" != PASS || "$db_principal" != KNOWN_AUTH_RUNTIME || "$db_acl" != PASS ]]; then classification='AUTH_RUNTIME_STAFF_READ_BOUNDARY_FAILED'
elif (( api_perm > 0 )); then classification='API_STAFF_DB_PERMISSION_FAILURE_IN_LIVE_WINDOW'
elif (( web_transport > 0 || web_timeout > 0 )); then classification='WEB_STAFF_UPSTREAM_TRANSPORT_FAILURE_IN_LIVE_WINDOW'
elif (( api_prisma > 0 && api_staff > 0 )); then classification='API_STAFF_PRISMA_FAILURE_IN_LIVE_WINDOW'
elif [[ "$ceremony" == PASS && "$login_success" == 0 && "$mfa_success" == 0 ]]; then classification='NO_HUMAN_LOGIN_CEREMONY_EVIDENCE_IN_SCREENSHOT_WINDOW'
fi

gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 staff unavailable diagnostic

- command: \`$COMMAND\`
- diagnostic main: \`$TARGET_SHA\`
- deployed API/Web runtime: \`$DEPLOYED_SHA\`
- evidence window UTC: \`$WINDOW_START .. $WINDOW_END\`
- server API origin class: \`$origin_class\`
- Web→API anonymous /auth/me status: \`$auth_status\`
- Web→API anonymous /staff/capabilities/me status: \`$cap_status\`
- auth DB principal class: \`$db_principal\`
- auth DB staff-read ACL: \`$db_acl\`
- auth DB read probe: \`$db_check\`
- reviewer login SUCCESS events: \`$login_success\`
- reviewer MFA SUCCESS events: \`$mfa_success\`
- reviewer login DENIED/FAILURE events: \`$login_denied\`
- Web staff transport markers: \`$web_transport\`
- Web timeout/network markers: \`$web_timeout\`
- API staff markers: \`$api_staff\`
- API Prisma error markers: \`$api_prisma\`
- API permission error markers: \`$api_perm\`
- classification: \`$classification\`
- secrets / PII / cookies / bearer tokens / account hashes / raw logs: \`NOT_PUBLISHED\`
- production mutation: \`NONE\`
- new recurring cost: \`0 RUB\`" >/dev/null
PUBLISHED=1
