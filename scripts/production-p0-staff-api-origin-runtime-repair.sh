#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

DEFAULT_HOST='195.19.12.120'
LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'
RELEASE_ISSUE_NUMBER='3072'
COMMAND='/production p0-staff-api-origin-repair current-runtime'
CANONICAL_ORIGIN='http://api:3001'
PRODUCTION_MUTATION='WEB_ONLY_API_ORIGIN_OVERRIDE_AND_RECREATE'

key_path="$RUNNER_TEMP/p0-staff-api-origin-key"
known_hosts="$RUNNER_TEMP/p0-staff-api-origin-known-hosts"
raw="$RUNNER_TEMP/p0-staff-api-origin-result"
TARGET_SHA='unknown'
DEPLOYED_SHA='unknown'
PUBLISHED=0

cleanup() { rm -f -- "$key_path" "$known_hosts" "$raw"; }
trap cleanup EXIT

publish_failure() {
  local rc=$?
  trap - ERR
  if [[ "$PUBLISHED" == 0 ]]; then
    gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 staff API origin repair

- command: \`$COMMAND\`
- current main: \`$TARGET_SHA\`
- deployed runtime: \`$DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- blocker: \`REPAIR_EXECUTION_FAILED\`
- secrets / API origin value / protected paths / container IDs / raw logs: \`NOT_PUBLISHED\`
- production mutation: \`UNKNOWN_OR_ROLLED_BACK\`
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
  rm -f "$a" "$b" "$c"
  return 1
}

try_key "${PC_PROD_SSH_KEY:-}" || try_key "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_key "${VPS_SSH_KEY:-}"

scan="$(mktemp)"; match="$(mktemp)"
ssh-keyscan -T 10 -p "$port" "$host" 2>/dev/null | sort -u > "$scan"
[[ -s "$scan" ]]
while IFS= read -r line; do
  fp="$(printf '%s\n' "$line" | ssh-keygen -lf - -E sha256 2>/dev/null | awk '{print $2}' || true)"
  [[ "$fp" != "$expected" ]] || printf '%s\n' "$line" >> "$match"
done < "$scan"
sort -u -o "$match" "$match"
[[ "$(grep -c . "$match" || true)" == 1 ]]
mv "$match" "$known_hosts"; rm -f "$scan"; chmod 0600 "$known_hosts"
ssh_opts=(-i "$key_path" -p "$port" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$known_hosts" -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=12 -o TCPKeepAlive=yes)

inventory="$(ssh "${ssh_opts[@]}" "$user@$host" 'set -Eeuo pipefail; test "$(id -u)" -eq 0; mapfile -t w < <(docker ps -q --filter "label=com.docker.compose.service=web"); ((${#w[@]}==1)); p="$(docker inspect --format "{{ index .Config.Labels \"com.docker.compose.project\" }}" "${w[0]}")"; mapfile -t a < <(docker ps -q --filter "label=com.docker.compose.project=$p" --filter "label=com.docker.compose.service=api"); ((${#a[@]}==1)); wr="$(docker inspect --format "{{ index .Config.Labels \"org.opencontainers.image.revision\" }}" "${w[0]}")"; ar="$(docker inspect --format "{{ index .Config.Labels \"org.opencontainers.image.revision\" }}" "${a[0]}")"; [[ "$wr" == "$ar" && "$wr" =~ ^[0-9a-f]{40}$ ]]; printf "RUNTIME|%s\n" "$wr"')"
DEPLOYED_SHA="${inventory#RUNTIME|}"
[[ "$DEPLOYED_SHA" =~ ^[0-9a-f]{40}$ ]]
git cat-file -e "$DEPLOYED_SHA^{commit}"
git merge-base --is-ancestor "$DEPLOYED_SHA" "$TARGET_SHA"
resolver_source="$(git show "$DEPLOYED_SHA:apps/web/lib/server/server-api-origin.ts")"
grep -Fq "const COMPOSE_INTERNAL_API_ORIGIN = 'http://api:3001';" <<< "$resolver_source"
grep -Fq "if (production) return COMPOSE_INTERNAL_API_ORIGIN;" <<< "$resolver_source"
grep -Fq "if (url.origin !== COMPOSE_INTERNAL_API_ORIGIN) return '';" <<< "$resolver_source"
unset resolver_source

set +e
ssh "${ssh_opts[@]}" "$user@$host" "bash -s -- '$DEPLOYED_SHA' '$CANONICAL_ORIGIN'" > "$raw" <<'REMOTE'
set -Eeuo pipefail
umask 077
deployed_sha="$1"
canonical_origin="$2"
[[ "$deployed_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$canonical_origin" == 'http://api:3001' ]]
[[ "$(id -u)" -eq 0 ]]
command -v docker >/dev/null
command -v python3 >/dev/null
command -v flock >/dev/null
command -v realpath >/dev/null

tmp="$(mktemp -d /tmp/p0-staff-api-origin.XXXXXX)"
mutated=0
completed=0
override_existed=0
override_path=''
working_dir=''
project=''
web_image_id=''
base_args=()

stage='INPUT'
report_failure() {
  local rc=$?
  trap - ERR
  printf 'FAIL_STAGE=%s\n' "$stage"
  exit "$rc"
}

rollback() {
  local rc=$?
  trap - ERR
  if [[ "$mutated" == 1 && "$completed" == 0 && -n "$override_path" && -n "$working_dir" && ${#base_args[@]} -gt 0 ]]; then
    if [[ "$override_existed" == 1 && -f "$tmp/override.backup" ]]; then
      cp -a "$tmp/override.backup" "$override_path" || true
    else
      rm -f -- "$override_path" || true
    fi
    docker compose "${base_args[@]}" up -d --no-deps --no-build --pull never web > "$tmp/rollback.log" 2>&1 || true
    printf 'ROLLBACK=ATTEMPTED\n'
  fi
  report_failure "$rc"
}
trap rollback ERR
trap 'rm -rf -- "$tmp"' EXIT

stage='LOCK'
exec 9>>/var/lock/p0-staff-api-origin-repair.lock
flock -n 9

stage='RUNTIME_BASELINE'
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web' | sort -u)
(( ${#web_ids[@]} == 1 ))
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api' | sort -u)
(( ${#api_ids[@]} == 1 ))
api_id="${api_ids[0]}"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$web_revision" == "$deployed_sha" && "$api_revision" == "$deployed_sha" ]]
web_image_id="$(docker inspect --format '{{.Image}}' "$web_id")"
[[ "$web_image_id" =~ ^sha256:[0-9a-f]{64}$ ]]

stage='COMPOSE_AUTHORITY'
working_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$web_id")"
config_csv="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$web_id")"
[[ "$working_label" =~ ^/(opt|srv|var/www)/[A-Za-z0-9_./-]+$ ]]
working_dir="$(realpath -e "$working_label")"
[[ "$working_dir" =~ ^/(opt|srv|var/www)/[A-Za-z0-9_./-]+$ && -d "$working_dir" && -n "$config_csv" ]]
override_path="$working_dir/.pc-staff-api-origin.override.yml"

IFS=',' read -r -a raw_config_files <<< "$config_csv"
(( ${#raw_config_files[@]} >= 1 && ${#raw_config_files[@]} <= 20 ))
base_args=(--project-directory "$working_dir" -p "$project")
base_files=()
for raw_file in "${raw_config_files[@]}"; do
  [[ -n "$raw_file" ]]
  file="$raw_file"
  [[ "$file" = /* ]] || file="$working_dir/$file"
  file="$(realpath -e "$file")"
  [[ "$file" == "$working_dir/"* && -r "$file" ]]
  [[ "$file" == "$override_path" ]] && continue
  base_files+=("$file")
  base_args+=(-f "$file")
done
(( ${#base_files[@]} >= 1 ))

docker compose "${base_args[@]}" config --format json > "$tmp/base.json" 2>/dev/null

classify_json_origin() {
  python3 - "$1" <<'PY'
import json, sys
cfg=json.load(open(sys.argv[1], encoding='utf-8'))
env=((cfg.get('services') or {}).get('web') or {}).get('environment') or {}
if isinstance(env, list):
    vals={}
    for item in env:
        if isinstance(item,str) and '=' in item:
            k,v=item.split('=',1); vals[k]=v
    env=vals
raw=str(env.get('API_URL') or '').strip()
canonical='http://api:3001'
def classify(raw):
    if not raw: return 'UNSET'
    try:
        from urllib.parse import urlsplit
        u=urlsplit(raw)
    except Exception:
        return 'INVALID_PARSE'
    if u.scheme not in ('http','https'): return 'INVALID_SCHEME'
    if u.username or u.password: return 'INVALID_COMPONENTS'
    if u.query or u.fragment: return 'INVALID_COMPONENTS'
    if u.scheme == 'http':
        if raw.rstrip('/') == canonical and (u.path in ('','/')): return 'CANONICAL'
        if u.hostname != 'api' or u.port != 3001: return 'INVALID_HTTP_AUTHORITY'
        if u.path not in ('','/'): return 'INVALID_HTTP_PATH'
        return 'INVALID_HTTP_AUTHORITY'
    return 'ACCEPTED_HTTPS'
print(classify(raw))
PY
}

classify_active_origin() {
  docker exec -i "$1" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const raw=String(process.env.API_URL||'').trim();
const canonical='http://api:3001';
let c='UNSET';
if(raw){
  try{
    const u=new URL(raw);
    if(!['http:','https:'].includes(u.protocol)) c='INVALID_SCHEME';
    else if(u.username||u.password||u.search||u.hash) c='INVALID_COMPONENTS';
    else if(u.protocol==='http:'){
      if(u.origin===canonical&&(u.pathname==='/'||u.pathname==='')) c='CANONICAL';
      else if(u.origin!==canonical) c='INVALID_HTTP_AUTHORITY';
      else c='INVALID_HTTP_PATH';
    } else c='ACCEPTED_HTTPS';
  }catch{c='INVALID_PARSE';}
}
process.stdout.write(c+'\n');
NODE
}

active_before="$(classify_active_origin "$web_id")"
compose_before="$(classify_json_origin "$tmp/base.json")"
[[ "$active_before" =~ ^(UNSET|CANONICAL|ACCEPTED_HTTPS|INVALID_PARSE|INVALID_SCHEME|INVALID_COMPONENTS|INVALID_HTTP_AUTHORITY|INVALID_HTTP_PATH)$ ]]
[[ "$compose_before" =~ ^(UNSET|CANONICAL|ACCEPTED_HTTPS|INVALID_PARSE|INVALID_SCHEME|INVALID_COMPONENTS|INVALID_HTTP_AUTHORITY|INVALID_HTTP_PATH)$ ]]

probe_internal() {
  docker exec -i "$1" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const origin='http://api:3001';
const emit=(k,v)=>process.stdout.write(`${k}=${v}\n`);
async function p(path,key){
  try{
    const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'}});
    emit(key,String(r.status)); await r.body?.cancel().catch(()=>{});
  }catch(e){emit(key,e&&e.name==='TimeoutError'?'TIMEOUT':'FETCH_ERROR');}
}
(async()=>{await p('/auth/me','AUTH_STATUS');await p('/staff/capabilities/me','CAP_STATUS');})().catch(()=>process.exitCode=1);
NODE
}

if [[ "$active_before" == CANONICAL || "$active_before" == UNSET ]]; then
  stage='ALREADY_CANONICAL_PROBE'
  probe_internal "$web_id" > "$tmp/probe"
  auth_status="$(sed -n 's/^AUTH_STATUS=//p' "$tmp/probe" | tail -1)"
  cap_status="$(sed -n 's/^CAP_STATUS=//p' "$tmp/probe" | tail -1)"
  [[ "$auth_status" == 401 && "$cap_status" == 401 ]]
  printf 'RESULT=PASS_ALREADY_CANONICAL\n'
  printf 'ACTIVE_BEFORE=%s\n' "$active_before"
  printf 'COMPOSE_BEFORE=%s\n' "$compose_before"
  printf 'ACTIVE_AFTER=%s\n' "$active_before"
  printf 'AUTH_STATUS=%s\n' "$auth_status"
  printf 'CAP_STATUS=%s\n' "$cap_status"
  printf 'IMAGE_UNCHANGED=PASS\nAPI_UNCHANGED=PASS\nNONWEB_UNCHANGED=PASS\nREVISION_UNCHANGED=PASS\n'
  printf 'PRODUCTION_MUTATION=NONE\n'
  completed=1
  exit 0
fi
[[ "$active_before" == INVALID_* ]]

stage='MUTATOR_QUIESCENCE'
if pgrep -af 'docker compose .*\b(up|pull|build|down)\b|docker (restart|stop|rm)\b|caddy reload' | grep -v -E 'pgrep|p0-staff-api-origin' >/dev/null; then
  false
fi

stage='NONWEB_BASELINE'
: > "$tmp/nonweb.before"
while IFS= read -r cid; do
  [[ -n "$cid" ]] || continue
  svc="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$cid")"
  [[ "$svc" == web ]] && continue
  printf '%s|%s\n' "$svc" "$cid" >> "$tmp/nonweb.before"
done < <(docker ps -q --filter "label=com.docker.compose.project=$project" | sort -u)
sort -u -o "$tmp/nonweb.before" "$tmp/nonweb.before"
[[ -s "$tmp/nonweb.before" ]]

stage='OVERRIDE_PREPARE'
cat > "$tmp/expected.override" <<'YAML'
services:
  web:
    environment:
      API_URL: http://api:3001
YAML
chmod 0600 "$tmp/expected.override"
repair_mode='OVERRIDE_CREATED'
if [[ -e "$override_path" ]]; then
  [[ -f "$override_path" && ! -L "$override_path" ]]
  cp -a "$override_path" "$tmp/override.backup"
  override_existed=1
  if cmp -s "$override_path" "$tmp/expected.override"; then
    repair_mode='OVERRIDE_PRESENT_RECREATE'
  else
    false
  fi
else
  install -m 0600 "$tmp/expected.override" "$override_path"
fi
mutated=1

stage='CANDIDATE_CONFIG'
candidate_args=("${base_args[@]}" -f "$override_path")
docker compose "${candidate_args[@]}" config --format json > "$tmp/candidate.json" 2>/dev/null
candidate_class="$(classify_json_origin "$tmp/candidate.json")"
[[ "$candidate_class" == CANONICAL ]]
candidate_image_ref="$(python3 - "$tmp/candidate.json" <<'PY'
import json,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8'))
print(str(((cfg.get('services') or {}).get('web') or {}).get('image') or ''))
PY
)"
[[ -n "$candidate_image_ref" && "$candidate_image_ref" != *$'\n'* ]]
candidate_image_id="$(docker image inspect --format '{{.Id}}' "$candidate_image_ref" 2>/dev/null)"
[[ "$candidate_image_id" == "$web_image_id" ]]

stage='WEB_RECREATE'
docker compose "${candidate_args[@]}" up -d --no-deps --no-build --pull never web > "$tmp/compose-up.log" 2>&1

stage='WEB_POSTVERIFY'
new_web_id=''
for attempt in $(seq 1 30); do
  mapfile -t now_web < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web' | sort -u)
  if (( ${#now_web[@]} == 1 )); then
    new_web_id="${now_web[0]}"
    state="$(docker inspect --format '{{.State.Status}}' "$new_web_id")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$new_web_id")"
    if [[ "$state" == running && ( "$health" == healthy || "$health" == none ) ]]; then break; fi
  fi
  sleep 1
done
[[ -n "$new_web_id" ]]
new_image_id="$(docker inspect --format '{{.Image}}' "$new_web_id")"
[[ "$new_image_id" == "$web_image_id" ]]
new_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_web_id")"
[[ "$new_revision" == "$deployed_sha" ]]
new_config_csv="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$new_web_id")"
override_bound=0
IFS=',' read -r -a new_configs <<< "$new_config_csv"
for candidate_file in "${new_configs[@]}"; do
  [[ "$candidate_file" = /* ]] || candidate_file="$working_dir/$candidate_file"
  candidate_file="$(realpath -e "$candidate_file")"
  [[ "$candidate_file" == "$override_path" ]] && override_bound=1
done
[[ "$override_bound" == 1 ]]

active_after="$(classify_active_origin "$new_web_id")"
[[ "$active_after" == CANONICAL ]]
probe_internal "$new_web_id" > "$tmp/probe"
auth_status="$(sed -n 's/^AUTH_STATUS=//p' "$tmp/probe" | tail -1)"
cap_status="$(sed -n 's/^CAP_STATUS=//p' "$tmp/probe" | tail -1)"
[[ "$auth_status" == 401 && "$cap_status" == 401 ]]

stage='NONWEB_POSTVERIFY'
: > "$tmp/nonweb.after"
while IFS= read -r cid; do
  [[ -n "$cid" ]] || continue
  svc="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$cid")"
  [[ "$svc" == web ]] && continue
  printf '%s|%s\n' "$svc" "$cid" >> "$tmp/nonweb.after"
done < <(docker ps -q --filter "label=com.docker.compose.project=$project" | sort -u)
sort -u -o "$tmp/nonweb.after" "$tmp/nonweb.after"
cmp -s "$tmp/nonweb.before" "$tmp/nonweb.after"
mapfile -t api_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api' | sort -u)
(( ${#api_after[@]} == 1 ))
[[ "${api_after[0]}" == "$api_id" ]]
api_revision_after="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${api_after[0]}")"
[[ "$api_revision_after" == "$deployed_sha" ]]

completed=1
printf 'RESULT=PASS_REPAIRED\n'
printf 'ACTIVE_BEFORE=%s\n' "$active_before"
printf 'COMPOSE_BEFORE=%s\n' "$compose_before"
printf 'REPAIR_MODE=%s\n' "$repair_mode"
printf 'ACTIVE_AFTER=%s\n' "$active_after"
printf 'AUTH_STATUS=%s\n' "$auth_status"
printf 'CAP_STATUS=%s\n' "$cap_status"
printf 'IMAGE_UNCHANGED=PASS\nAPI_UNCHANGED=PASS\nNONWEB_UNCHANGED=PASS\nREVISION_UNCHANGED=PASS\n'
printf 'PRODUCTION_MUTATION=WEB_ONLY_API_ORIGIN_OVERRIDE_AND_RECREATE\n'
REMOTE
rc=$?
set -e

getv(){ sed -n "s/^$1=//p" "$raw" | tail -1; }
if (( rc != 0 )); then
  fail_stage="$(getv FAIL_STAGE)"
  rollback_state="$(getv ROLLBACK)"
  [[ "$fail_stage" =~ ^[A-Z0-9_]{1,64}$ ]] || fail_stage='UNKNOWN'
  [[ "$rollback_state" == ATTEMPTED ]] || rollback_state='NOT_REQUIRED_OR_NOT_REACHED'
  gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 staff API origin repair

- command: \`$COMMAND\`
- current main: \`$TARGET_SHA\`
- deployed API/Web runtime: \`$DEPLOYED_SHA\`
- result: \`FAIL_CLOSED\`
- fail stage: \`$fail_stage\`
- rollback: \`$rollback_state\`
- secrets / API origin value / protected paths / container IDs / raw logs: \`NOT_PUBLISHED\`
- production mutation: \`NONE_OR_ROLLED_BACK\`
- new recurring cost: \`0 RUB\`" >/dev/null
  PUBLISHED=1
  exit "$rc"
fi

result="$(getv RESULT)"
active_before="$(getv ACTIVE_BEFORE)"
compose_before="$(getv COMPOSE_BEFORE)"
repair_mode="$(getv REPAIR_MODE)"
active_after="$(getv ACTIVE_AFTER)"
auth_status="$(getv AUTH_STATUS)"
cap_status="$(getv CAP_STATUS)"
image_unchanged="$(getv IMAGE_UNCHANGED)"
api_unchanged="$(getv API_UNCHANGED)"
nonweb_unchanged="$(getv NONWEB_UNCHANGED)"
revision_unchanged="$(getv REVISION_UNCHANGED)"
mutation="$(getv PRODUCTION_MUTATION)"
[[ "$result" =~ ^PASS_(REPAIRED|ALREADY_CANONICAL)$ ]]
[[ "$active_before" =~ ^(UNSET|CANONICAL|ACCEPTED_HTTPS|INVALID_PARSE|INVALID_SCHEME|INVALID_COMPONENTS|INVALID_HTTP_AUTHORITY|INVALID_HTTP_PATH)$ ]]
[[ "$compose_before" =~ ^(UNSET|CANONICAL|ACCEPTED_HTTPS|INVALID_PARSE|INVALID_SCHEME|INVALID_COMPONENTS|INVALID_HTTP_AUTHORITY|INVALID_HTTP_PATH)$ ]]
[[ "$active_after" =~ ^(UNSET|CANONICAL)$ ]]
[[ "$auth_status" == 401 && "$cap_status" == 401 ]]
[[ "$image_unchanged" == PASS && "$api_unchanged" == PASS && "$nonweb_unchanged" == PASS && "$revision_unchanged" == PASS ]]
[[ "$mutation" == NONE || "$mutation" == "$PRODUCTION_MUTATION" ]]
[[ -z "$repair_mode" || "$repair_mode" =~ ^OVERRIDE_(CREATED|PRESENT_RECREATE)$ ]]

repair_line='- repair mode: `NONE_REQUIRED`'
[[ -z "$repair_mode" ]] || repair_line="- repair mode: \`$repair_mode\`"
gh issue comment "$RELEASE_ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body "## Production P0 staff API origin repair

- command: \`$COMMAND\`
- current main: \`$TARGET_SHA\`
- deployed API/Web runtime: \`$DEPLOYED_SHA\`
- result: \`$result\`
- active Web origin class before: \`$active_before\`
- resolved Compose origin class before: \`$compose_before\`
$repair_line
- active Web origin class after: \`$active_after\`
- internal anonymous /auth/me: \`$auth_status\`
- internal anonymous /staff/capabilities/me: \`$cap_status\`
- Web image unchanged: \`$image_unchanged\`
- API container unchanged: \`$api_unchanged\`
- all non-Web containers unchanged: \`$nonweb_unchanged\`
- API/Web revision unchanged: \`$revision_unchanged\`
- secrets / API origin value / protected paths / container IDs / raw logs: \`NOT_PUBLISHED\`
- production mutation: \`$mutation\`
- new recurring cost: \`0 RUB\`" >/dev/null
PUBLISHED=1
