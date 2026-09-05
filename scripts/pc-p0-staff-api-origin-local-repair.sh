#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
readonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'
readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'
readonly CANONICAL_BASE_URL='http://api:3001/api'

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]]
[[ "$(id -u)" -eq 0 ]]
for command in docker python3 flock realpath git pgrep sed sort grep awk install cp rm stat cmp seq sleep tail timeout; do
  command -v "$command" >/dev/null
done
[[ -d "$REPOSITORY_ROOT/.git" && ! -L "$REPOSITORY_ROOT" ]]
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse HEAD)" == "$TARGET_SHA" ]]
[[ "$(git -C "$REPOSITORY_ROOT" rev-parse refs/remotes/origin/main)" == "$TARGET_SHA" ]]
[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]]

guard_current_main() {
  local observed
  observed="$(timeout 20s git ls-remote --heads "$REPOSITORY_URL" refs/heads/main 2>/dev/null | awk 'NR==1 {print $1}')"
  [[ "$observed" == "$TARGET_SHA" ]]
}

fsync_file_and_parent() {
  python3 - "$1" <<'PY_FSYNC'
import os, sys
path = os.path.abspath(sys.argv[1])
if os.path.isfile(path):
    fd = os.open(path, os.O_RDONLY)
    try: os.fsync(fd)
    finally: os.close(fd)
parent = os.path.dirname(path)
fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY_FSYNC
}

guard_current_main

tmp="$(mktemp -d /tmp/p0-staff-api-origin.XXXXXX)"
mutated=0
completed=0
override_existed=0
override_path=''
working_dir=''
project=''
web_image_id=''
deployed_sha='UNKNOWN'
compose_before='NOT_EVALUATED'
active_before='NOT_EVALUATED'
active_after='NOT_EVALUATED'
auth_status='NOT_EVALUATED'
cap_status='NOT_EVALUATED'
repair_mode='NOT_EVALUATED'
rollback_state='NOT_REQUIRED'
rollback_expected_class='NOT_EVALUATED'
base_args=()
candidate_args=()
rollback_args=()
nonweb_before_ready=0

stage='INPUT'
report_failure() {
  local rc="${1:-1}"
  printf 'RESULT=FAIL_CLOSED\n'
  printf 'FAIL_STAGE=%s\n' "$stage"
  printf 'ROLLBACK=%s\n' "$rollback_state"
  printf 'DEPLOYED_SHA=%s\n' "$deployed_sha"
  printf 'ACTIVE_BEFORE=%s\n' "$active_before"
  printf 'COMPOSE_BEFORE=%s\n' "$compose_before"
  printf 'REPAIR_MODE=%s\n' "$repair_mode"
  printf 'ACTIVE_AFTER=%s\n' "$active_after"
  printf 'AUTH_STATUS=%s\n' "$auth_status"
  printf 'CAP_STATUS=%s\n' "$cap_status"
  printf 'IMAGE_UNCHANGED=NOT_ATTESTED\nAPI_UNCHANGED=NOT_ATTESTED\nNONWEB_UNCHANGED=NOT_ATTESTED\nREVISION_UNCHANGED=NOT_ATTESTED\n'
  if [[ "$rollback_state" == CONFIRMED ]]; then
    printf 'PRODUCTION_MUTATION=NONE_OR_ROLLED_BACK\n'
  elif [[ "$mutated" == 1 ]]; then
    printf 'PRODUCTION_MUTATION=UNKNOWN_REQUIRES_OPERATOR_REVIEW\n'
  else
    printf 'PRODUCTION_MUTATION=NONE\n'
  fi
  exit "$rc"
}

rollback() {
  local rc="${1:-$?}"
  trap - ERR INT TERM
  set +e
  if [[ "$mutated" == 1 && "$completed" == 0 && -n "$override_path" && -n "$working_dir" && ${#rollback_args[@]} -gt 0 ]]; then
    rollback_state='FAILED'
    restore_ok=1
    if [[ "$override_existed" == 1 && -f "$tmp/override.backup" ]]; then
      cp -a "$tmp/override.backup" "$override_path" >/dev/null 2>&1 || restore_ok=0
    else
      rm -f -- "$override_path" >/dev/null 2>&1 || restore_ok=0
    fi
    if (( restore_ok == 1 )); then
      fsync_file_and_parent "$override_path" >/dev/null 2>&1 || restore_ok=0
    fi
    if (( restore_ok == 1 )); then
      docker compose "${rollback_args[@]}" up -d --no-deps --no-build --pull never web > "$tmp/rollback.log" 2>&1 || restore_ok=0
    fi
    rollback_web=''
    rollback_ready=0
    if (( restore_ok == 1 )); then
      for attempt in $(seq 1 120); do
        mapfile -t rollback_webs < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web' | sort -u)
        if (( ${#rollback_webs[@]} == 1 )); then
          rollback_web="${rollback_webs[0]}"
          rollback_runtime_status="$(docker inspect --format '{{.State.Status}}' "$rollback_web" 2>/dev/null)"
          rollback_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$rollback_web" 2>/dev/null)"
          if [[ "$rollback_runtime_status" == running && "$rollback_health" == healthy ]]; then
            rollback_ready=1
            break
          fi
        fi
        sleep 1
      done
      (( rollback_ready == 1 )) || restore_ok=0
    fi
    if (( restore_ok == 1 )); then
      rollback_image="$(docker inspect --format '{{.Image}}' "$rollback_web" 2>/dev/null)"
      rollback_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$rollback_web" 2>/dev/null)"
      [[ "$rollback_image" == "$web_image_id" && "$rollback_revision" == "$deployed_sha" ]] || restore_ok=0
    fi
    if (( restore_ok == 1 && nonweb_before_ready == 1 )); then
      : > "$tmp/nonweb.rollback"
      while IFS= read -r cid; do
        [[ -n "$cid" ]] || continue
        svc="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$cid" 2>/dev/null)"
        [[ "$svc" == web ]] && continue
        printf '%s|%s\n' "$svc" "$cid" >> "$tmp/nonweb.rollback"
      done < <(docker ps -q --filter "label=com.docker.compose.project=$project" | sort -u)
      sort -u -o "$tmp/nonweb.rollback" "$tmp/nonweb.rollback"
      cmp -s "$tmp/nonweb.before" "$tmp/nonweb.rollback" || restore_ok=0
      mapfile -t rollback_api < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api' | sort -u)
      (( ${#rollback_api[@]} == 1 )) || restore_ok=0
      if (( ${#rollback_api[@]} == 1 )); then
        [[ "${rollback_api[0]}" == "$api_id" ]] || restore_ok=0
      fi
    fi
    if (( restore_ok == 1 )); then
      rollback_class="$(classify_active_origin "$rollback_web" 2>/dev/null)"
      [[ "$rollback_class" == "$rollback_expected_class" ]] || restore_ok=0
    fi
    if (( restore_ok == 1 )); then rollback_state='CONFIRMED'; fi
  fi
  report_failure "$rc"
}
trap rollback ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM
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
[[ "$web_revision" == "$api_revision" && "$web_revision" =~ ^[0-9a-f]{40}$ ]]
deployed_sha="$web_revision"
git -C "$REPOSITORY_ROOT" cat-file -e "$deployed_sha^{commit}"
git -C "$REPOSITORY_ROOT" merge-base --is-ancestor "$deployed_sha" "$TARGET_SHA"
resolver_source="$(git -C "$REPOSITORY_ROOT" show "$deployed_sha:apps/web/lib/server/server-api-origin.ts")"
grep -Fq "const COMPOSE_INTERNAL_API_BASE_URL = 'http://api:3001/api';" <<< "$resolver_source"
grep -Fq "if (production) return COMPOSE_INTERNAL_API_BASE_URL;" <<< "$resolver_source"
grep -Fq "if (url.origin !== 'http://api:3001') return '';" <<< "$resolver_source"
grep -Fq "if (url.pathname !== '/api' && url.pathname !== '/api/') return '';" <<< "$resolver_source"
unset resolver_source
web_image_id="$(docker inspect --format '{{.Image}}' "$web_id")"
[[ "$web_image_id" =~ ^sha256:[0-9a-f]{64}$ ]]

stage='WEB_BASELINE_READY'
web_state_before="$(docker inspect --format '{{.State.Status}}' "$web_id")"
web_health_before="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$web_id")"
[[ "$web_state_before" == running && "$web_health_before" == healthy ]]

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
canonical='http://api:3001/api'
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
        if raw in (canonical, canonical + '/'): return 'CANONICAL'
        try:
            host, port = u.hostname, u.port
        except ValueError:
            return 'INVALID_HTTP_AUTHORITY'
        if host != 'api' or port != 3001: return 'INVALID_HTTP_AUTHORITY'
        if u.path not in ('/api','/api/'): return 'INVALID_HTTP_PATH'
        return 'INVALID_HTTP_AUTHORITY'
    return 'ACCEPTED_HTTPS'
print(classify(raw))
PY
}

classify_active_origin() {
  docker exec -i "$1" /nodejs/bin/node --input-type=commonjs - <<'NODE'
const raw=String(process.env.API_URL||'').trim();
const canonical='http://api:3001/api';
let c='UNSET';
if(raw){
  try{
    const u=new URL(raw);
    if(!['http:','https:'].includes(u.protocol)) c='INVALID_SCHEME';
    else if(u.username||u.password||u.search||u.hash) c='INVALID_COMPONENTS';
    else if(u.protocol==='http:'){
      if(raw===canonical||raw===canonical+'/') c='CANONICAL';
      else if(u.origin!=='http://api:3001') c='INVALID_HTTP_AUTHORITY';
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
const base='http://api:3001/api';
const emit=(k,v)=>process.stdout.write(`${k}=${v}\n`);
async function p(path,key){
  try{
    const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(5000),headers:{Accept:'application/json'}});
    emit(key,String(r.status)); await r.body?.cancel().catch(()=>{});
  }catch(e){emit(key,e&&e.name==='TimeoutError'?'TIMEOUT':'FETCH_ERROR');}
}
(async()=>{await p('/auth/me','AUTH_STATUS');await p('/staff/capabilities/me','CAP_STATUS');})().catch(()=>process.exitCode=1);
NODE
}

if [[ "$active_before" == CANONICAL || "$active_before" == UNSET ]]; then
  stage='ALREADY_CANONICAL_QUIESCENCE'
  if pgrep -af 'docker compose .*\b(up|pull|build|down)\b|docker (restart|stop|rm)\b|caddy reload' | grep -v -E 'pgrep|p0-staff-api-origin' >/dev/null; then
    false
  fi
  guard_current_main
  : > "$tmp/nonweb.before"
  while IFS= read -r cid; do
    [[ -n "$cid" ]] || continue
    svc="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$cid")"
    [[ "$svc" == web ]] && continue
    printf '%s|%s\n' "$svc" "$cid" >> "$tmp/nonweb.before"
  done < <(docker ps -q --filter "label=com.docker.compose.project=$project" | sort -u)
  sort -u -o "$tmp/nonweb.before" "$tmp/nonweb.before"
  [[ -s "$tmp/nonweb.before" ]]

  stage='ALREADY_CANONICAL_PROBE'
  probe_internal "$web_id" > "$tmp/probe"
  auth_status="$(sed -n 's/^AUTH_STATUS=//p' "$tmp/probe" | tail -1)"
  cap_status="$(sed -n 's/^CAP_STATUS=//p' "$tmp/probe" | tail -1)"
  [[ "$auth_status" == 401 && "$cap_status" == 401 ]]

  stage='ALREADY_CANONICAL_POSTVERIFY'
  mapfile -t same_web < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web' | sort -u)
  (( ${#same_web[@]} == 1 ))
  [[ "${same_web[0]}" == "$web_id" ]]
  [[ "$(docker inspect --format '{{.Image}}' "$web_id")" == "$web_image_id" ]]
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id")" == "$deployed_sha" ]]
  : > "$tmp/nonweb.after"
  while IFS= read -r cid; do
    [[ -n "$cid" ]] || continue
    svc="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$cid")"
    [[ "$svc" == web ]] && continue
    printf '%s|%s\n' "$svc" "$cid" >> "$tmp/nonweb.after"
  done < <(docker ps -q --filter "label=com.docker.compose.project=$project" | sort -u)
  sort -u -o "$tmp/nonweb.after" "$tmp/nonweb.after"
  cmp -s "$tmp/nonweb.before" "$tmp/nonweb.after"
  mapfile -t same_api < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api' | sort -u)
  (( ${#same_api[@]} == 1 ))
  [[ "${same_api[0]}" == "$api_id" ]]
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${same_api[0]}")" == "$deployed_sha" ]]
  guard_current_main

  repair_mode='NONE_REQUIRED'
  active_after="$active_before"
  printf 'RESULT=PASS_ALREADY_CANONICAL\n'
  printf 'DEPLOYED_SHA=%s\n' "$deployed_sha"
  printf 'ACTIVE_BEFORE=%s\n' "$active_before"
  printf 'COMPOSE_BEFORE=%s\n' "$compose_before"
  printf 'REPAIR_MODE=%s\n' "$repair_mode"
  printf 'ACTIVE_AFTER=%s\n' "$active_after"
  printf 'AUTH_STATUS=%s\n' "$auth_status"
  printf 'CAP_STATUS=%s\n' "$cap_status"
  printf 'IMAGE_UNCHANGED=PASS\nAPI_UNCHANGED=PASS\nNONWEB_UNCHANGED=PASS\nREVISION_UNCHANGED=PASS\n'
  printf 'ROLLBACK=NOT_REQUIRED\n'
  printf 'PRODUCTION_MUTATION=NONE\n'
  completed=1
  exit 0
fi
stage='ORIGIN_STATE_AUTHORIZATION'
[[ "$active_before" == INVALID_* ]]

stage='MUTATOR_QUIESCENCE'
if pgrep -af 'docker compose .*\b(up|pull|build|down)\b|docker (restart|stop|rm)\b|caddy reload' | grep -v -E 'pgrep|p0-staff-api-origin' >/dev/null; then
  false
fi
guard_current_main

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
nonweb_before_ready=1

stage='OVERRIDE_PREPARE'
cat > "$tmp/expected.override" <<'YAML'
services:
  web:
    environment:
      API_URL: http://api:3001/api
YAML
chmod 0600 "$tmp/expected.override"
repair_mode='OVERRIDE_CREATED'
if [[ -e "$override_path" ]]; then
  [[ -f "$override_path" && ! -L "$override_path" ]]
  [[ "$(stat -c '%a:%u:%g' "$override_path")" == '600:0:0' ]]
  cp -a "$override_path" "$tmp/override.backup"
  override_existed=1
  if cmp -s "$override_path" "$tmp/expected.override"; then
    repair_mode='OVERRIDE_PRESENT_RECREATE'
  else
    false
  fi
  rollback_args=("${base_args[@]}" -f "$override_path")
  rollback_expected_class='CANONICAL'
else
  rollback_args=("${base_args[@]}")
  rollback_expected_class="$compose_before"
  guard_current_main
  mutated=1
  install -m 0600 -o root -g root "$tmp/expected.override" "$override_path"
  fsync_file_and_parent "$override_path"
fi

stage='CANDIDATE_CONFIG'
candidate_args=("${base_args[@]}" -f "$override_path")
docker compose "${candidate_args[@]}" config --format json > "$tmp/candidate.json" 2>/dev/null
candidate_class="$(classify_json_origin "$tmp/candidate.json")"
[[ "$candidate_class" == CANONICAL ]]
python3 - "$tmp/base.json" "$tmp/candidate.json" <<'PY_CONFIG_DELTA'
import copy, json, sys
base=json.load(open(sys.argv[1],encoding='utf-8'))
candidate=json.load(open(sys.argv[2],encoding='utf-8'))
if not isinstance(base,dict) or not isinstance(candidate,dict): raise SystemExit('CONFIG_NOT_OBJECT')
normalized=copy.deepcopy(candidate)
base_web=((base.get('services') or {}).get('web') or {})
candidate_web=((normalized.get('services') or {}).get('web') or {})
base_env=base_web.get('environment') or {}
candidate_env=candidate_web.get('environment') or {}
if not isinstance(base_env,dict) or not isinstance(candidate_env,dict): raise SystemExit('WEB_ENV_NOT_OBJECT')
if candidate_env.get('API_URL') != 'http://api:3001/api': raise SystemExit('CANDIDATE_ORIGIN_NOT_CANONICAL')
if 'API_URL' in base_env:
    candidate_env['API_URL']=base_env['API_URL']
else:
    candidate_env.pop('API_URL',None)
candidate_web['environment']=candidate_env
if not base_env:
    # Compose may omit an empty environment mapping entirely.
    candidate_web.pop('environment',None)
normalized['services']['web']=candidate_web
if normalized != base: raise SystemExit('CANDIDATE_CONFIG_CHANGED_BEYOND_API_URL')
PY_CONFIG_DELTA
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
guard_current_main
mutated=1
docker compose "${candidate_args[@]}" up -d --no-deps --no-build --pull never web > "$tmp/compose-up.log" 2>&1

stage='WEB_POSTVERIFY_READY'
new_web_id=''
web_ready=0
for attempt in $(seq 1 120); do
  mapfile -t now_web < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web' | sort -u)
  if (( ${#now_web[@]} == 1 )); then
    new_web_id="${now_web[0]}"
    state="$(docker inspect --format '{{.State.Status}}' "$new_web_id")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$new_web_id")"
    if [[ "$state" == running && "$health" == healthy ]]; then
      web_ready=1
      break
    fi
  fi
  sleep 1
done
(( web_ready == 1 ))

stage='WEB_POSTVERIFY_IMAGE'
new_image_id="$(docker inspect --format '{{.Image}}' "$new_web_id")"
[[ "$new_image_id" == "$web_image_id" ]]

stage='WEB_POSTVERIFY_REVISION'
new_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_web_id")"
[[ "$new_revision" == "$deployed_sha" ]]

stage='WEB_POSTVERIFY_OVERRIDE'
new_config_csv="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$new_web_id")"
override_bound=0
IFS=',' read -r -a new_configs <<< "$new_config_csv"
for candidate_file in "${new_configs[@]}"; do
  [[ "$candidate_file" = /* ]] || candidate_file="$working_dir/$candidate_file"
  candidate_file="$(realpath -e "$candidate_file")"
  [[ "$candidate_file" == "$override_path" ]] && override_bound=1
done
[[ "$override_bound" == 1 ]]

stage='WEB_POSTVERIFY_ORIGIN'
active_after="$(classify_active_origin "$new_web_id")"
[[ "$active_after" == CANONICAL ]]

stage='WEB_POSTVERIFY_API_PROBE'
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

stage='FINAL_MAIN_GUARD'
guard_current_main
completed=1
printf 'RESULT=PASS_REPAIRED\n'
printf 'DEPLOYED_SHA=%s\n' "$deployed_sha"
printf 'ACTIVE_BEFORE=%s\n' "$active_before"
printf 'COMPOSE_BEFORE=%s\n' "$compose_before"
printf 'REPAIR_MODE=%s\n' "$repair_mode"
printf 'ACTIVE_AFTER=%s\n' "$active_after"
printf 'AUTH_STATUS=%s\n' "$auth_status"
printf 'CAP_STATUS=%s\n' "$cap_status"
printf 'IMAGE_UNCHANGED=PASS\nAPI_UNCHANGED=PASS\nNONWEB_UNCHANGED=PASS\nREVISION_UNCHANGED=PASS\n'
printf 'ROLLBACK=NOT_REQUIRED\n'
printf 'PRODUCTION_MUTATION=WEB_ONLY_API_ORIGIN_OVERRIDE_AND_RECREATE\n'
