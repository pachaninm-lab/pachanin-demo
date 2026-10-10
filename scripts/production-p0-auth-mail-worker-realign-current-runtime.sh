#!/usr/bin/env bash
set -Eeuo pipefail

runtime='/var/lib/pc-secret-authority/runtime'
emit(){ printf '%s=%s\n' "$1" "$2"; }

mutation_started=0
rollback_attempted=NO
rollback_complete=NA
overlay=''
old_worker_revision='unknown'
desired_sha='unknown'
api_revision='unknown'
web_revision='unknown'
worker_revision='unknown'
dc=()
project=''
api_id=''
web_id=''

wait_worker() {
  local expected="$1" attempts="${2:-30}" current health rev
  for _ in $(seq 1 "$attempts"); do
    mapfile -t current_workers < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
    if (( ${#current_workers[@]} == 1 )); then
      current="${current_workers[0]}"
      rev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current" 2>/dev/null || true)"
      health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$current" 2>/dev/null || true)"
      if [[ "$rev" == "$expected" && "$health" == healthy ]] && \
         docker exec "$current" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
        printf '%s' "$current"
        return 0
      fi
    fi
    sleep 4
  done
  return 1
}

rollback() {
  rollback_attempted=YES
  set +e
  "${dc[@]}" up -d --no-deps --pull never --force-recreate auth-mail-worker >/dev/null 2>&1
  local rc=$?
  if (( rc == 0 )) && [[ "$old_worker_revision" =~ ^[0-9a-f]{40}$ ]]; then
    if wait_worker "$old_worker_revision" 20 >/dev/null; then
      rollback_complete=PASS
    else
      rollback_complete=FAIL
    fi
  else
    rollback_complete=FAIL
  fi
  [[ -z "$overlay" ]] || rm -f -- "$overlay" 2>/dev/null || true
  set -e
}

fail() {
  local code="$1" rc="${2:-1}"
  if (( mutation_started == 1 )); then rollback; fi
  emit AUTH_MAIL_WORKER_REALIGN FAIL
  emit ERROR_CODE "$code"
  emit PRE_API_REVISION "$api_revision"
  emit PRE_WEB_REVISION "$web_revision"
  emit PRE_WORKER_REVISION "$worker_revision"
  emit TARGET_REVISION "$desired_sha"
  emit WORKER_RECREATED "$([[ "$mutation_started" == 1 ]] && echo ATTEMPTED || echo NO)"
  emit API_WEB_MUTATED 0
  emit DB_CREDENTIAL_MUTATED 0
  emit ROLLBACK_ATTEMPTED "$rollback_attempted"
  emit ROLLBACK_COMPLETE "$rollback_complete"
  emit PRODUCTION_MUTATION "$([[ "$mutation_started" == 1 ]] && echo AUTH_MAIL_WORKER_ONLY_ATTEMPTED || echo NONE)"
  exit "$rc"
}

trap 'rc=$?; trap - ERR; fail UNHANDLED_RUNTIME_FAILURE "$rc"' ERR

[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 20
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 21
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 22
docker compose version >/dev/null 2>&1 || fail COMPOSE_REQUIRED 23

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY 24
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null || true)"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail PROJECT_INVALID 25

mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#api_ids[@]} == 1 )) || fail API_CARDINALITY 26
(( ${#worker_ids[@]} == 1 )) || fail WORKER_CARDINALITY 27
api_id="${api_ids[0]}"
worker_id="${worker_ids[0]}"

api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id" 2>/dev/null || true)"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id" 2>/dev/null || true)"
old_worker_revision="$worker_revision"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" =~ ^[0-9a-f]{40}$ && "$worker_revision" =~ ^[0-9a-f]{40}$ ]] || fail REVISION_INVALID 28
[[ "$api_revision" == "$web_revision" ]] || fail API_WEB_REVISION_MISMATCH 29
desired_sha="$api_revision"

emit PRE_API_REVISION "$api_revision"
emit PRE_WEB_REVISION "$web_revision"
emit PRE_WORKER_REVISION "$worker_revision"
emit TARGET_REVISION "$desired_sha"

api_image="$(docker inspect --format '{{.Config.Image}}' "$api_id" 2>/dev/null || true)"
[[ -n "$api_image" && "$api_image" != *$'\n'* && "$api_image" != *$'\r'* ]] || fail API_IMAGE_INVALID 30
api_image_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_image" 2>/dev/null || true)"
[[ "$api_image_revision" == "$desired_sha" ]] || fail API_IMAGE_REVISION_MISMATCH 31

api_id_before="$api_id"
web_id_before="$web_id"

if [[ "$worker_revision" == "$desired_sha" ]]; then
  state="$(docker inspect --format '{{.State.Status}}' "$worker_id" 2>/dev/null || true)"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$worker_id" 2>/dev/null || true)"
  if [[ "$state" == running && "$health" == healthy ]] && \
     docker exec "$worker_id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    emit WORKER_RECREATED NO
    emit WORKER_REVISION PASS
    emit WORKER_READY PASS
    emit API_WEB_UNCHANGED PASS
    emit API_WEB_MUTATED 0
    emit DB_CREDENTIAL_MUTATED 0
    emit ROLLBACK_ATTEMPTED NO
    emit ROLLBACK_COMPLETE NA
    emit AUTH_MAIL_WORKER_REALIGN PASS
    emit ERROR_CODE NONE
    emit PRODUCTION_MUTATION NONE
    exit 0
  fi
  emit ALIGNED_UNHEALTHY_RECREATE REQUIRED
fi

[[ -d "$runtime" && ! -L "$runtime" && "$(stat -c '%a:%u:%g' "$runtime")" == '700:0:0' ]] || fail RUNTIME_ROOT_INVALID 34
[[ -d "$runtime/keyring" && ! -L "$runtime/keyring" && "$(stat -c '%a:%u:%g' "$runtime/keyring")" == '555:0:0' ]] || fail RUNTIME_KEYRING_INVALID 35
for p in "$runtime/current-key-version" "$runtime/database-url" "$runtime/transport.env"; do
  [[ -f "$p" && ! -L "$p" && "$(stat -c '%a:%u:%g' "$p")" == '444:0:0' ]] || fail RUNTIME_PROJECTION_INVALID 36
done

mapfile -t worker_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$worker_id" | sed '/^$/d')
mapfile -t api_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$api_id" | sed '/^$/d')
(( ${#worker_networks[@]} == 1 && ${#api_networks[@]} == 1 )) || fail NETWORK_CARDINALITY 37
[[ "${worker_networks[0]}" == "${api_networks[0]}" ]] || fail NETWORK_PARITY 38

working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$worker_id" 2>/dev/null || true)"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$worker_id" 2>/dev/null || true)"
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" && -n "$config_files" ]] || fail COMPOSE_AUTHORITY_INVALID 39
working_dir="$(realpath -e -- "$working_dir")"

dc=(docker compose --project-directory "$working_dir" --project-name "$project")
IFS=',' read -r -a raw_files <<< "$config_files"
config_count=0
for raw_file in "${raw_files[@]}"; do
  file="${raw_file#"${raw_file%%[![:space:]]*}"}"
  file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$working_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail COMPOSE_FILE_INVALID 40
  resolved="$(realpath -e -- "$file")"
  dc+=(-f "$resolved")
  ((config_count+=1))
done
(( config_count >= 1 )) || fail COMPOSE_FILES_EMPTY 41

baseline="$(mktemp)"
merged="$(mktemp)"
cleanup_tmp(){ rm -f -- "$baseline" "$merged" 2>/dev/null || true; }
trap 'cleanup_tmp' EXIT
"${dc[@]}" config --format json > "$baseline" || fail BASELINE_COMPOSE_RENDER_FAILED 42

overlay="$working_dir/compose.auth-mail-worker-runtime-realign-${desired_sha:0:12}.override.json"
[[ ! -e "$overlay" ]] || fail TARGET_OVERLAY_ALREADY_EXISTS 43
python3 - "$overlay" "$api_image" <<'PY'
import json,sys,os
path,image=sys.argv[1:3]
data={'services':{'auth-mail-worker':{'image':image,'pull_policy':'never'}}}
fd=os.open(path, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
with os.fdopen(fd,'w',encoding='utf-8') as f:
    json.dump(data,f,separators=(',',':'))
    f.write('\n')
PY
chmod 0600 "$overlay"; chown 0:0 "$overlay"

dc_target=("${dc[@]}" -f "$overlay")
"${dc_target[@]}" config --format json > "$merged" || { rm -f -- "$overlay"; overlay=''; fail TARGET_COMPOSE_RENDER_FAILED 44; }
python3 - "$baseline" "$merged" "$api_image" <<'PY' || { rm -f -- "$overlay"; overlay=''; fail TARGET_COMPOSE_CONTRACT_FAILED 45; }
import json,sys,copy
base=json.load(open(sys.argv[1],encoding='utf-8'))
new=json.load(open(sys.argv[2],encoding='utf-8'))
image=sys.argv[3]
bs=(base.get('services') or {}).get('auth-mail-worker')
ns=(new.get('services') or {}).get('auth-mail-worker')
if not isinstance(bs,dict) or not isinstance(ns,dict): raise SystemExit(1)
if str(ns.get('image') or '') != image: raise SystemExit(1)
b=copy.deepcopy(bs); n=copy.deepcopy(ns)
b['image']=image
n['image']=image
b.pop('pull_policy',None); n.pop('pull_policy',None)
if b != n: raise SystemExit(1)
PY

mutation_started=1
"${dc_target[@]}" up -d --no-deps --pull never --force-recreate auth-mail-worker >/dev/null 2>&1 \
  || fail WORKER_RECREATE_FAILED 46

new_worker="$(wait_worker "$desired_sha" 30)" || fail WORKER_NOT_READY 47
[[ "$new_worker" != "$worker_id" ]] || fail WORKER_CONTAINER_NOT_RECREATED 48

mapfile -t api_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t web_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web')
(( ${#api_after[@]} == 1 && ${#web_after[@]} == 1 )) || fail API_WEB_CARDINALITY_CHANGED 49
[[ "${api_after[0]}" == "$api_id_before" && "${web_after[0]}" == "$web_id_before" ]] || fail API_WEB_CONTAINER_CHANGED 50
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${api_after[0]}")" == "$desired_sha" ]] || fail API_REVISION_CHANGED 51
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${web_after[0]}")" == "$desired_sha" ]] || fail WEB_REVISION_CHANGED 52

current_cfg="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$new_worker" 2>/dev/null || true)"
current_working="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$new_worker" 2>/dev/null || true)"
[[ "$current_working" == "$working_dir" && "$current_cfg" == *"$overlay"* ]] || fail WORKER_COMPOSE_AUTHORITY_INVALID 53

emit WORKER_RECREATED PASS
emit WORKER_REVISION PASS
emit WORKER_READY PASS
emit API_WEB_UNCHANGED PASS
emit API_WEB_MUTATED 0
emit DB_CREDENTIAL_MUTATED 0
emit ROLLBACK_ATTEMPTED NO
emit ROLLBACK_COMPLETE NA
emit AUTH_MAIL_WORKER_REALIGN PASS
emit ERROR_CODE NONE
emit PRODUCTION_MUTATION AUTH_MAIL_WORKER_ONLY_REALIGNED
