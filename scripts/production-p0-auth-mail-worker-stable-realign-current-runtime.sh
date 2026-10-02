#!/usr/bin/env bash
set -Eeuo pipefail

runtime='/var/lib/pc-secret-authority/runtime'
emit(){ printf '%s=%s\n' "$1" "$2"; }

mutation_started=0
rollback_attempted=NO
rollback_complete=NA
pre_worker_boundary=UNKNOWN
baseline_service_missing=UNKNOWN
runtime_unchanged=UNKNOWN
api_revision=unknown
web_revision=unknown
worker_revision=unknown
desired_sha=unknown
old_worker_image=''
target_image=''
project=''
working_dir=''
network=''
target_overlay=''
rollback_overlay=''
api_id=''
web_id=''
worker_id=''
api_id_before=''
web_id_before=''
runtime_hash_before=''

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

runtime_digest() {
  python3 - "$runtime" <<'PY'
import hashlib,os,stat,sys
root=sys.argv[1]
items=['current-key-version','database-url','transport.env']
keyring=os.path.join(root,'keyring')
for name in sorted(os.listdir(keyring)):
    p=os.path.join(keyring,name); st=os.lstat(p)
    if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode): raise SystemExit(2)
    items.append('keyring/'+name)
h=hashlib.sha256()
for rel in items:
    h.update(rel.encode()); h.update(b'\0')
    with open(os.path.join(root,rel),'rb') as f:
        for chunk in iter(lambda:f.read(65536),b''): h.update(chunk)
    h.update(b'\0')
print(h.hexdigest())
PY
}

check_image_boundary() {
  local image="$1" user entry
  user="$(docker image inspect --format '{{.Config.User}}' "$image" 2>/dev/null || true)"
  entry="$(docker image inspect --format '{{json .Config.Entrypoint}}' "$image" 2>/dev/null || true)"
  case "$user" in ''|0|0:0|root|root:root) return 1;; esac
  [[ "$entry" == '["/nodejs/bin/node"]' ]] || return 1
  return 0
}

check_current_worker_boundary() {
  local id="$1" image="$2" tmp current_env base_env mounts_json cmd_json entry_json user restart health_test rc=1
  tmp="$(mktemp -d)"
  current_env="$tmp/current-env.json"; base_env="$tmp/base-env.json"; mounts_json="$tmp/mounts.json"
  docker inspect --format '{{json .Config.Env}}' "$id" > "$current_env" || { rm -rf -- "$tmp"; return 1; }
  docker image inspect --format '{{json .Config.Env}}' "$image" > "$base_env" || { rm -rf -- "$tmp"; return 1; }
  docker inspect --format '{{json .Mounts}}' "$id" > "$mounts_json" || { rm -rf -- "$tmp"; return 1; }
  cmd_json="$(docker inspect --format '{{json .Config.Cmd}}' "$id" 2>/dev/null || true)"
  entry_json="$(docker inspect --format '{{json .Config.Entrypoint}}' "$id" 2>/dev/null || true)"
  user="$(docker inspect --format '{{.Config.User}}' "$id" 2>/dev/null || true)"
  restart="$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$id" 2>/dev/null || true)"
  health_test="$(docker inspect --format '{{json .Config.Healthcheck.Test}}' "$id" 2>/dev/null || true)"
  case "$user" in ''|0|0:0|root|root:root) rm -rf -- "$tmp"; return 1;; esac
  [[ "$cmd_json" == '["dist/apps/api/src/auth-mail-worker.js"]' ]] || { rm -rf -- "$tmp"; return 1; }
  [[ "$entry_json" == '["/nodejs/bin/node"]' ]] || { rm -rf -- "$tmp"; return 1; }
  [[ "$restart" == unless-stopped ]] || { rm -rf -- "$tmp"; return 1; }
  [[ "$health_test" == *'127.0.0.1:3003/ready'* ]] || { rm -rf -- "$tmp"; return 1; }
  if python3 - "$current_env" "$base_env" "$mounts_json" <<'PY'
import json,sys
cur=json.load(open(sys.argv[1],encoding='utf-8')) or []
base=json.load(open(sys.argv[2],encoding='utf-8')) or []
mounts=json.load(open(sys.argv[3],encoding='utf-8')) or []
def envmap(items):
    out={}
    for item in items:
        k,sep,v=str(item).partition('=')
        if sep: out[k]=v
    return out
c=envmap(cur); b=envmap(base)
expected={
 'NODE_ENV':'production','RUNTIME_COMPONENT':'auth-mail-worker','AUTH_MAIL_WORKER_ENABLED':'true','AUTH_MAIL_WORKER_HEALTH_PORT':'3003',
 'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
 'AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url','AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env'}
for k,v in expected.items():
    if c.get(k)!=v: raise SystemExit(1)
for k in ('PC_SMTP_PASS','AUTH_MAIL_DATABASE_URL','DATABASE_URL','AUTH_DATABASE_URL','PC_SMTP_PASSWORD','RESEND_API_KEY'):
    if k in c: raise SystemExit(1)
if set(c)-(set(b)|set(expected)): raise SystemExit(1)
expected_mounts={
 '/run/pc-auth-mail/keyring':'/var/lib/pc-secret-authority/runtime/keyring',
 '/run/pc-auth-mail/current-key-version':'/var/lib/pc-secret-authority/runtime/current-key-version',
 '/run/pc-auth-mail/database-url':'/var/lib/pc-secret-authority/runtime/database-url',
 '/run/pc-auth-mail/transport.env':'/var/lib/pc-secret-authority/runtime/transport.env'}
seen={}
for m in mounts:
    d=str(m.get('Destination') or '')
    if d: seen[d]=(str(m.get('Source') or ''),bool(m.get('RW')))
if set(seen)!=set(expected_mounts): raise SystemExit(1)
for d,s in expected_mounts.items():
    if seen.get(d)!=(s,False): raise SystemExit(1)
PY
  then rc=0; fi
  rm -rf -- "$tmp"
  return "$rc"
}

create_or_validate_overlay() {
  local path="$1" image="$2" cfg created=0
  if [[ -e "$path" ]]; then
    [[ -f "$path" && ! -L "$path" && "$(stat -c '%a:%u:%g' "$path")" == '600:0:0' ]] || return 1
  else
    python3 - "$path" "$image" "$runtime" "$network" <<'PY' || return 1
import json,os,sys
path,image,runtime,network=sys.argv[1:5]
data={'services':{'auth-mail-worker':{
 'image':image,'pull_policy':'never','command':['dist/apps/api/src/auth-mail-worker.js'],'restart':'unless-stopped',
 'environment':{
  'NODE_ENV':'production','RUNTIME_COMPONENT':'auth-mail-worker','AUTH_MAIL_WORKER_ENABLED':'true','AUTH_MAIL_WORKER_HEALTH_PORT':'3003',
  'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
  'AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url','AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env'},
 'volumes':[
  {'type':'bind','source':runtime+'/keyring','target':'/run/pc-auth-mail/keyring','read_only':True},
  {'type':'bind','source':runtime+'/current-key-version','target':'/run/pc-auth-mail/current-key-version','read_only':True},
  {'type':'bind','source':runtime+'/database-url','target':'/run/pc-auth-mail/database-url','read_only':True},
  {'type':'bind','source':runtime+'/transport.env','target':'/run/pc-auth-mail/transport.env','read_only':True}],
 'healthcheck':{'test':['CMD','/nodejs/bin/node','-e',"fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"],
  'interval':'10s','timeout':'5s','retries':12,'start_period':'10s'},
 'networks':['runtime']}},'networks':{'runtime':{'external':True,'name':network}}}
fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w',encoding='utf-8') as f:
    json.dump(data,f,ensure_ascii=True,separators=(',',':')); f.write('\n')
PY
    chmod 0600 "$path"; chown 0:0 "$path"; created=1
  fi
  cfg="$(mktemp)"
  if ! docker compose --project-directory "$working_dir" --project-name "$project" -f "$path" config --format json > "$cfg" 2>/dev/null; then
    rm -f -- "$cfg"; (( created == 0 )) || rm -f -- "$path"; return 1
  fi
  if ! python3 - "$cfg" "$image" "$runtime" "$network" <<'PY'
import json,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8')); image,runtime,network=sys.argv[2:5]
services=cfg.get('services') or {}
if set(services)!={'auth-mail-worker'}: raise SystemExit(1)
w=services['auth-mail-worker']
if str(w.get('image') or '')!=image or str(w.get('pull_policy') or '')!='never': raise SystemExit(1)
if list(map(str,w.get('command') or []))!=['dist/apps/api/src/auth-mail-worker.js']: raise SystemExit(1)
if str(w.get('restart') or '')!='unless-stopped': raise SystemExit(1)
env=w.get('environment') or {}
if isinstance(env,list): env={str(x).partition('=')[0]:str(x).partition('=')[2] for x in env}
expected={'NODE_ENV':'production','RUNTIME_COMPONENT':'auth-mail-worker','AUTH_MAIL_WORKER_ENABLED':'true','AUTH_MAIL_WORKER_HEALTH_PORT':'3003',
 'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
 'AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url','AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env'}
if {str(k):str(v) for k,v in env.items()}!=expected: raise SystemExit(1)
expected_mounts={'/run/pc-auth-mail/keyring':runtime+'/keyring','/run/pc-auth-mail/current-key-version':runtime+'/current-key-version',
 '/run/pc-auth-mail/database-url':runtime+'/database-url','/run/pc-auth-mail/transport.env':runtime+'/transport.env'}
seen={}
for v in w.get('volumes') or []:
    if isinstance(v,dict): seen[str(v.get('target') or '')]=(str(v.get('source') or ''),bool(v.get('read_only')))
if set(seen)!=set(expected_mounts): raise SystemExit(1)
for t,s in expected_mounts.items():
    if seen.get(t)!=(s,True): raise SystemExit(1)
networks=w.get('networks') or {}; names=set(networks) if isinstance(networks,dict) else set(map(str,networks))
if names!={'runtime'}: raise SystemExit(1)
net=(cfg.get('networks') or {}).get('runtime') or {}
if str(net.get('name') or '')!=network or not bool(net.get('external')): raise SystemExit(1)
if '127.0.0.1:3003/ready' not in ' '.join(map(str,(w.get('healthcheck') or {}).get('test') or [])): raise SystemExit(1)
PY
  then
    rm -f -- "$cfg"; (( created == 0 )) || rm -f -- "$path"; return 1
  fi
  rm -f -- "$cfg"
  return 0
}

rollback() {
  rollback_attempted=YES
  set +e
  if [[ -n "$old_worker_image" && -n "$rollback_overlay" ]] && \
     create_or_validate_overlay "$rollback_overlay" "$old_worker_image" && \
     docker compose --project-directory "$working_dir" --project-name "$project" -f "$rollback_overlay" up -d --no-deps --pull never --force-recreate auth-mail-worker >/dev/null 2>&1 && \
     wait_worker "$worker_revision" 20 >/dev/null 2>&1; then
    rollback_complete=PASS
    [[ -z "$target_overlay" ]] || rm -f -- "$target_overlay" 2>/dev/null || true
  else
    rollback_complete=FAIL
  fi
  if [[ -n "$runtime_hash_before" ]]; then
    after="$(runtime_digest 2>/dev/null || true)"
    [[ "$after" == "$runtime_hash_before" ]] || rollback_complete=FAIL
  fi
  set -e
}

fail() {
  local code="$1" rc="${2:-1}"
  if (( mutation_started == 1 )); then rollback; fi
  if [[ "$runtime_unchanged" == UNKNOWN && -n "$runtime_hash_before" ]]; then
    after="$(runtime_digest 2>/dev/null || true)"
    [[ "$after" == "$runtime_hash_before" ]] && runtime_unchanged=PASS || runtime_unchanged=FAIL
  fi
  emit AUTH_MAIL_WORKER_STABLE_REALIGN FAIL
  emit ERROR_CODE "$code"
  emit PRE_API_REVISION "$api_revision"; emit PRE_WEB_REVISION "$web_revision"; emit PRE_WORKER_REVISION "$worker_revision"; emit TARGET_REVISION "$desired_sha"
  emit PRE_WORKER_BOUNDARY "$pre_worker_boundary"; emit BASELINE_SERVICE_MISSING "$baseline_service_missing"
  emit WORKER_RECREATED "$([[ "$mutation_started" == 1 ]] && echo ATTEMPTED || echo NO)"
  emit WORKER_REVISION UNKNOWN; emit WORKER_READY UNKNOWN; emit API_WEB_UNCHANGED UNKNOWN; emit RUNTIME_UNCHANGED "$runtime_unchanged"
  emit API_WEB_MUTATED 0; emit DB_CREDENTIAL_MUTATED 0; emit ROLLBACK_ATTEMPTED "$rollback_attempted"; emit ROLLBACK_COMPLETE "$rollback_complete"
  if (( mutation_started == 0 )); then emit PRODUCTION_MUTATION NONE
  elif [[ "$rollback_complete" == PASS ]]; then emit PRODUCTION_MUTATION AUTH_MAIL_WORKER_STABLE_REALIGN_ATTEMPTED_ROLLED_BACK
  else emit PRODUCTION_MUTATION AUTH_MAIL_WORKER_STABLE_REALIGN_ATTEMPTED; fi
  exit "$rc"
}
trap 'rc=$?; trap - ERR; fail UNHANDLED_RUNTIME_FAILURE "$rc"' ERR

[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED 20
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 21
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 22
docker compose version >/dev/null 2>&1 || fail COMPOSE_REQUIRED 23

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY 24
web_id="${web_ids[0]}"; project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id" 2>/dev/null || true)"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail PROJECT_INVALID 25
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#api_ids[@]} == 1 )) || fail API_CARDINALITY 26
(( ${#worker_ids[@]} == 1 )) || fail WORKER_CARDINALITY 27
api_id="${api_ids[0]}"; worker_id="${worker_ids[0]}"; api_id_before="$api_id"; web_id_before="$web_id"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id" 2>/dev/null || true)"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id" 2>/dev/null || true)"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" =~ ^[0-9a-f]{40}$ && "$worker_revision" =~ ^[0-9a-f]{40}$ ]] || fail REVISION_INVALID 28
[[ "$api_revision" == "$web_revision" ]] || fail API_WEB_REVISION_MISMATCH 29
desired_sha="$api_revision"
emit PRE_API_REVISION "$api_revision"; emit PRE_WEB_REVISION "$web_revision"; emit PRE_WORKER_REVISION "$worker_revision"; emit TARGET_REVISION "$desired_sha"

target_image="$(docker inspect --format '{{.Config.Image}}' "$api_id" 2>/dev/null || true)"; old_worker_image="$(docker inspect --format '{{.Config.Image}}' "$worker_id" 2>/dev/null || true)"
[[ -n "$target_image" && -n "$old_worker_image" ]] || fail IMAGE_REFERENCE_INVALID 30
[[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$target_image" 2>/dev/null || true)" == "$desired_sha" ]] || fail TARGET_IMAGE_REVISION_MISMATCH 31
[[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$old_worker_image" 2>/dev/null || true)" == "$worker_revision" ]] || fail OLD_IMAGE_REVISION_MISMATCH 32
check_image_boundary "$target_image" || fail TARGET_IMAGE_BOUNDARY_INVALID 33
check_image_boundary "$old_worker_image" || fail OLD_IMAGE_BOUNDARY_INVALID 34

[[ -d "$runtime" && ! -L "$runtime" && "$(stat -c '%a:%u:%g' "$runtime")" == '700:0:0' ]] || fail RUNTIME_ROOT_INVALID 35
[[ -d "$runtime/keyring" && ! -L "$runtime/keyring" && "$(stat -c '%a:%u:%g' "$runtime/keyring")" == '555:0:0' ]] || fail RUNTIME_KEYRING_INVALID 36
for p in "$runtime/current-key-version" "$runtime/database-url" "$runtime/transport.env"; do
  [[ -f "$p" && ! -L "$p" && "$(stat -c '%a:%u:%g' "$p")" == '444:0:0' ]] || fail RUNTIME_PROJECTION_INVALID 37
done
key_count=0
while IFS= read -r key; do
  [[ -f "$key" && ! -L "$key" && "$(stat -c '%a:%u:%g' "$key")" == '444:0:0' ]] || fail RUNTIME_KEY_INVALID 38
  ((key_count+=1))
done < <(find "$runtime/keyring" -mindepth 1 -maxdepth 1 -type f -name 'v*.key' -print | sort)
(( key_count >= 1 )) || fail RUNTIME_KEY_MISSING 39
runtime_hash_before="$(runtime_digest)" || fail RUNTIME_DIGEST_FAILED 40
[[ "$runtime_hash_before" =~ ^[0-9a-f]{64}$ ]] || fail RUNTIME_DIGEST_INVALID 41

state="$(docker inspect --format '{{.State.Status}}' "$worker_id" 2>/dev/null || true)"; health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$worker_id" 2>/dev/null || true)"
[[ "$state" == running && "$health" == healthy ]] || fail PRE_WORKER_NOT_HEALTHY 42
docker exec "$worker_id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1 || fail PRE_WORKER_READY_FAILED 43
check_current_worker_boundary "$worker_id" "$old_worker_image" || fail PRE_WORKER_BOUNDARY_INVALID 44
pre_worker_boundary=PASS

mapfile -t worker_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$worker_id" | sed '/^$/d')
mapfile -t api_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$api_id" | sed '/^$/d')
(( ${#worker_networks[@]} == 1 && ${#api_networks[@]} == 1 )) || fail NETWORK_CARDINALITY 45
network="${worker_networks[0]}"
[[ "$network" == "${api_networks[0]}" && "$network" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail NETWORK_PARITY 46
docker network inspect "$network" >/dev/null 2>&1 || fail NETWORK_MISSING 47

if [[ "$worker_revision" == "$desired_sha" ]]; then
  runtime_unchanged=PASS
  emit PRE_WORKER_BOUNDARY PASS; emit BASELINE_SERVICE_MISSING NA; emit WORKER_RECREATED NO; emit WORKER_REVISION PASS; emit WORKER_READY PASS
  emit API_WEB_UNCHANGED PASS; emit RUNTIME_UNCHANGED PASS; emit API_WEB_MUTATED 0; emit DB_CREDENTIAL_MUTATED 0
  emit ROLLBACK_ATTEMPTED NO; emit ROLLBACK_COMPLETE NA; emit AUTH_MAIL_WORKER_STABLE_REALIGN PASS; emit ERROR_CODE NONE; emit PRODUCTION_MUTATION NONE
  exit 0
fi

working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$worker_id" 2>/dev/null || true)"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$worker_id" 2>/dev/null || true)"
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" && -n "$config_files" ]] || fail COMPOSE_AUTHORITY_INVALID 48
working_dir="$(realpath -e -- "$working_dir")"
base_dc=(docker compose --project-directory "$working_dir" --project-name "$project")
IFS=',' read -r -a raw_files <<< "$config_files"; config_count=0
for raw_file in "${raw_files[@]}"; do
  file="${raw_file#"${raw_file%%[![:space:]]*}"}"; file="${file%"${file##*[![:space:]]}"}"
  [[ -n "$file" ]] || continue; [[ "$file" == /* ]] || file="$working_dir/$file"
  [[ -f "$file" && ! -L "$file" ]] || fail COMPOSE_FILE_INVALID 49
  resolved="$(realpath -e -- "$file")"; base_dc+=(-f "$resolved"); ((config_count+=1))
done
(( config_count >= 1 )) || fail COMPOSE_FILES_EMPTY 50
baseline="$(mktemp)"; trap 'rm -f -- "$baseline" 2>/dev/null || true' EXIT
"${base_dc[@]}" config --format json > "$baseline" || fail BASELINE_COMPOSE_RENDER_FAILED 51
if python3 - "$baseline" <<'PY'
import json,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8'))
raise SystemExit(0 if 'auth-mail-worker' not in (cfg.get('services') or {}) else 1)
PY
then baseline_service_missing=PASS
else baseline_service_missing=FAIL; fail BASELINE_SERVICE_PRESENT_USE_STANDARD_REALIGN 52
fi

target_overlay="$working_dir/compose.auth-mail-worker-stable-realign-${desired_sha:0:12}.override.json"
rollback_overlay="$working_dir/compose.auth-mail-worker-stable-rollback-${worker_revision:0:12}-from-${desired_sha:0:12}.override.json"
create_or_validate_overlay "$target_overlay" "$target_image" || fail TARGET_STABLE_OVERLAY_INVALID 53
mutation_started=1
docker compose --project-directory "$working_dir" --project-name "$project" -f "$target_overlay" up -d --no-deps --pull never --force-recreate auth-mail-worker >/dev/null 2>&1 || fail WORKER_RECREATE_FAILED 54
new_worker="$(wait_worker "$desired_sha" 30)" || fail WORKER_NOT_READY 55
[[ "$new_worker" != "$worker_id" ]] || fail WORKER_CONTAINER_NOT_RECREATED 56
check_current_worker_boundary "$new_worker" "$target_image" || fail POST_WORKER_BOUNDARY_INVALID 57

mapfile -t api_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t web_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web')
(( ${#api_after[@]} == 1 && ${#web_after[@]} == 1 )) || fail API_WEB_CARDINALITY_CHANGED 58
[[ "${api_after[0]}" == "$api_id_before" && "${web_after[0]}" == "$web_id_before" ]] || fail API_WEB_CONTAINER_CHANGED 59
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${api_after[0]}")" == "$desired_sha" ]] || fail API_REVISION_CHANGED 60
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "${web_after[0]}")" == "$desired_sha" ]] || fail WEB_REVISION_CHANGED 61
current_cfg="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$new_worker" 2>/dev/null || true)"
current_working="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$new_worker" 2>/dev/null || true)"
[[ "$current_cfg" == "$target_overlay" && "$current_working" == "$working_dir" ]] || fail WORKER_COMPOSE_AUTHORITY_INVALID 62
after_hash="$(runtime_digest)" || fail POST_RUNTIME_DIGEST_FAILED 63
[[ "$after_hash" == "$runtime_hash_before" ]] || fail RUNTIME_PROJECTION_CHANGED 64
runtime_unchanged=PASS

emit PRE_WORKER_BOUNDARY PASS; emit BASELINE_SERVICE_MISSING PASS; emit WORKER_RECREATED PASS; emit WORKER_REVISION PASS; emit WORKER_READY PASS
emit API_WEB_UNCHANGED PASS; emit RUNTIME_UNCHANGED PASS; emit API_WEB_MUTATED 0; emit DB_CREDENTIAL_MUTATED 0
emit ROLLBACK_ATTEMPTED NO; emit ROLLBACK_COMPLETE NA; emit AUTH_MAIL_WORKER_STABLE_REALIGN PASS; emit ERROR_CODE NONE
emit PRODUCTION_MUTATION AUTH_MAIL_WORKER_STABLE_REALIGNED
