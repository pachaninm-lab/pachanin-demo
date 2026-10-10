#!/usr/bin/env bash
set -Eeuo pipefail

subject_sha="${1:-}"
runtime='/var/lib/pc-secret-authority/runtime'
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){
  emit AUTH_MAIL_WORKER_REMOUNT_F166_V2 FAIL
  emit ERROR_CODE "$1"
  emit DB_CREDENTIAL_MUTATED 0
  emit API_WEB_MUTATED 0
  emit PRODUCTION_MUTATION "$2"
  exit "${3:-1}"
}

[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED NONE 20
[[ "$subject_sha" =~ ^[0-9a-f]{40}$ ]] || fail SUBJECT_SHA_INVALID NONE 21
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED NONE 22
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED NONE 23
docker compose version >/dev/null 2>&1 || fail COMPOSE_REQUIRED NONE 24

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY NONE 25
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail PROJECT_INVALID NONE 26
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail API_CARDINALITY NONE 27
api_id="${api_ids[0]}"
mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#worker_ids[@]} == 1 )) || fail WORKER_CARDINALITY NONE 28
worker_id="${worker_ids[0]}"

for pair in "$api_id" "$web_id" "$worker_id"; do
  revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$pair" 2>/dev/null || true)"
  [[ "$revision" == "$subject_sha" ]] || fail REVISION_PARITY_FAILED NONE 29
done
emit PRE_REVISION_PARITY PASS

startup_codes="$(docker logs --tail 300 "$worker_id" 2>&1 | sed -nE 's/^Auth-mail worker failed to start: ([A-Z0-9_]{1,120})$/\1/p' | sort -u || true)"
[[ "$startup_codes" == AUTH_MAIL_PRISMACLIENTINITIALIZATIONERROR ]] || fail PRECONDITION_CHANGED NONE 30
emit PRE_STARTUP_CODE AUTH_MAIL_PRISMACLIENTINITIALIZATIONERROR

[[ -d "$runtime" && ! -L "$runtime" && "$(stat -c '%a:%u:%g' "$runtime")" == '700:0:0' ]] || fail RUNTIME_ROOT_INVALID NONE 31
[[ -d "$runtime/keyring" && ! -L "$runtime/keyring" && "$(stat -c '%a:%u:%g' "$runtime/keyring")" == '555:0:0' ]] || fail RUNTIME_KEYRING_INVALID NONE 32
for p in "$runtime/current-key-version" "$runtime/database-url" "$runtime/transport.env"; do
  [[ -f "$p" && ! -L "$p" && "$(stat -c '%a:%u:%g' "$p")" == '444:0:0' ]] || fail RUNTIME_PROJECTION_INVALID NONE 33
done
current_version="$(tr -d '[:space:]' < "$runtime/current-key-version")"
[[ "$current_version" =~ ^[1-9][0-9]{0,2}$ ]] || fail KEY_VERSION_INVALID NONE 34
runtime_key="$runtime/keyring/v${current_version}.key"
[[ -f "$runtime_key" && ! -L "$runtime_key" && "$(stat -c '%a:%u:%g' "$runtime_key")" == '444:0:0' ]] || fail RUNTIME_KEY_INVALID NONE 35
emit RUNTIME_PROJECTION PASS

worker_image="$(docker inspect --format '{{.Config.Image}}' "$worker_id")"
[[ -n "$worker_image" && "$worker_image" != *$'\n'* && "$worker_image" != *$'\r'* ]] || fail WORKER_IMAGE_INVALID NONE 36
image_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_image" 2>/dev/null || true)"
[[ "$image_revision" == "$subject_sha" ]] || fail WORKER_IMAGE_REVISION_FAILED NONE 37
emit WORKER_IMAGE_REVISION PASS

mapfile -t worker_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$worker_id" | sed '/^$/d')
mapfile -t api_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$api_id" | sed '/^$/d')
(( ${#worker_networks[@]} == 1 && ${#api_networks[@]} == 1 )) || fail NETWORK_CARDINALITY NONE 38
network="${worker_networks[0]}"
[[ "$network" == "${api_networks[0]}" && "$network" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail NETWORK_PARITY NONE 39
docker network inspect "$network" >/dev/null 2>&1 || fail NETWORK_MISSING NONE 40
emit NETWORK_PARITY PASS

working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$worker_id")"
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" ]] || fail WORKING_DIR_INVALID NONE 41
working_dir="$(realpath -e -- "$working_dir")"
overlay="$working_dir/compose.auth-mail-worker-f166.override.json"
if [[ -e "$overlay" ]]; then
  [[ -f "$overlay" && ! -L "$overlay" && "$(stat -c '%a:%u:%g' "$overlay")" == '600:0:0' ]] || fail EXISTING_OVERLAY_INVALID NONE 42
fi

tmp_overlay="$(mktemp "$working_dir/.compose.auth-mail-worker-f166.XXXXXX.json")"
cfg="$(mktemp)"
cleanup(){ rm -f -- "$tmp_overlay" "$cfg" 2>/dev/null || true; }
trap cleanup EXIT
python3 - "$tmp_overlay" "$worker_image" "$runtime" "$network" <<'PY' || fail OVERLAY_BUILD_FAILED NONE 43
import json,sys
path,image,runtime,network=sys.argv[1:5]
cfg={
  'services':{
    'auth-mail-worker':{
      'image':image,
      'pull_policy':'never',
      'command':['dist/apps/api/src/auth-mail-worker.js'],
      'restart':'unless-stopped',
      'environment':{
        'NODE_ENV':'production',
        'RUNTIME_COMPONENT':'auth-mail-worker',
        'AUTH_MAIL_WORKER_ENABLED':'true',
        'AUTH_MAIL_WORKER_HEALTH_PORT':'3003',
        'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring',
        'AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
        'AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url',
        'AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env',
      },
      'volumes':[
        {'type':'bind','source':runtime+'/keyring','target':'/run/pc-auth-mail/keyring','read_only':True},
        {'type':'bind','source':runtime+'/current-key-version','target':'/run/pc-auth-mail/current-key-version','read_only':True},
        {'type':'bind','source':runtime+'/database-url','target':'/run/pc-auth-mail/database-url','read_only':True},
        {'type':'bind','source':runtime+'/transport.env','target':'/run/pc-auth-mail/transport.env','read_only':True},
      ],
      'healthcheck':{
        'test':['CMD','/nodejs/bin/node','-e',"fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"],
        'interval':'10s','timeout':'5s','retries':12,'start_period':'10s'
      },
      'networks':['runtime']
    }
  },
  'networks':{'runtime':{'external':True,'name':network}}
}
with open(path,'w',encoding='utf-8') as f:
    json.dump(cfg,f,ensure_ascii=True,separators=(',',':'))
    f.write('\n')
PY
chmod 0600 "$tmp_overlay"; chown 0:0 "$tmp_overlay"

dc=(docker compose --project-directory "$working_dir" --project-name "$project" -f "$tmp_overlay")
"${dc[@]}" config --format json > "$cfg" || fail OVERLAY_RENDER_FAILED NONE 44
if ! python3 - "$cfg" "$worker_image" "$runtime" "$network" <<'PY'
import json,sys
cfg=json.load(open(sys.argv[1],encoding='utf-8')); image,runtime,network=sys.argv[2:5]
services=cfg.get('services') or {}
if set(services) != {'auth-mail-worker'}: raise SystemExit(1)
w=services['auth-mail-worker']
if str(w.get('image') or '') != image: raise SystemExit(1)
cmd=w.get('command') or []
if not isinstance(cmd,list) or ' '.join(map(str,cmd)) != 'dist/apps/api/src/auth-mail-worker.js': raise SystemExit(1)
env=w.get('environment') or {}
if isinstance(env,list): env={str(x).partition('=')[0]:str(x).partition('=')[2] for x in env}
expected={
 'NODE_ENV':'production','RUNTIME_COMPONENT':'auth-mail-worker','AUTH_MAIL_WORKER_ENABLED':'true','AUTH_MAIL_WORKER_HEALTH_PORT':'3003',
 'AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version',
 'AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url','AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env'}
if {str(k):str(v) for k,v in env.items()} != expected: raise SystemExit(1)
vols=w.get('volumes') or []
expected_mounts={
 '/run/pc-auth-mail/keyring':runtime+'/keyring','/run/pc-auth-mail/current-key-version':runtime+'/current-key-version',
 '/run/pc-auth-mail/database-url':runtime+'/database-url','/run/pc-auth-mail/transport.env':runtime+'/transport.env'}
seen={}
for v in vols:
    if isinstance(v,dict): seen[str(v.get('target') or '')]=(str(v.get('source') or ''),bool(v.get('read_only')))
if set(seen) != set(expected_mounts): raise SystemExit(1)
if any(seen[t] != (s,True) for t,s in expected_mounts.items()): raise SystemExit(1)
networks=w.get('networks') or {}
network_names=set(networks) if isinstance(networks,dict) else set(map(str,networks))
if network_names != {'runtime'}: raise SystemExit(1)
net=(cfg.get('networks') or {}).get('runtime') or {}
if str(net.get('name') or '') != network or not bool(net.get('external')): raise SystemExit(1)
if not w.get('healthcheck'): raise SystemExit(1)
PY
then
  fail OVERLAY_CONTRACT_FAILED NONE 45
fi
emit OVERLAY_CONTRACT PASS

mv -f -- "$tmp_overlay" "$overlay"
chmod 0600 "$overlay"; chown 0:0 "$overlay"
emit STABLE_OVERLAY_WRITTEN PASS

dc=(docker compose --project-directory "$working_dir" --project-name "$project" -f "$overlay")
old_worker_id="$worker_id"
"${dc[@]}" up -d --no-deps --pull never --force-recreate auth-mail-worker >/dev/null 2>&1 \
  || fail WORKER_RECREATE_FAILED AUTH_MAIL_WORKER_STABLE_OVERRIDE_WRITTEN_AND_RECREATE_ATTEMPTED 46
emit WORKER_RECREATED PASS

worker_ready=0
for attempt in $(seq 1 30); do
  mapfile -t current_workers < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
  if (( ${#current_workers[@]} == 1 )); then
    current="${current_workers[0]}"
    revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current" 2>/dev/null || true)"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$current" 2>/dev/null || true)"
    if [[ "$current" != "$old_worker_id" && "$revision" == "$subject_sha" && "$health" == healthy ]] && \
       docker exec "$current" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      worker_ready=1; worker_id="$current"; break
    fi
  fi
  sleep 4
done
(( worker_ready == 1 )) || fail WORKER_STILL_NOT_READY AUTH_MAIL_WORKER_STABLE_OVERRIDE_WRITTEN_AND_RECREATED 47
emit WORKER_REVISION PASS
emit WORKER_READY PASS

config_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$worker_id" 2>/dev/null || true)"
working_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$worker_id" 2>/dev/null || true)"
[[ "$config_label" == "$overlay" && "$working_label" == "$working_dir" ]] || fail WORKER_COMPOSE_LABELS_INVALID AUTH_MAIL_WORKER_STABLE_OVERRIDE_WRITTEN_AND_RECREATED 48
emit WORKER_COMPOSE_AUTHORITY PASS

mapfile -t api_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t web_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web')
(( ${#api_after[@]} == 1 && ${#web_after[@]} == 1 )) || fail API_WEB_CARDINALITY_CHANGED AUTH_MAIL_WORKER_STABLE_OVERRIDE_WRITTEN_AND_RECREATED 49
[[ "${api_after[0]}" == "$api_id" && "${web_after[0]}" == "$web_id" ]] || fail API_WEB_CONTAINER_CHANGED AUTH_MAIL_WORKER_STABLE_OVERRIDE_WRITTEN_AND_RECREATED 50
for pair in "${api_after[0]}" "${web_after[0]}"; do
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$pair")" == "$subject_sha" ]] \
    || fail API_WEB_REVISION_CHANGED AUTH_MAIL_WORKER_STABLE_OVERRIDE_WRITTEN_AND_RECREATED 51
done
emit API_WEB_UNCHANGED PASS
emit DB_CREDENTIAL_MUTATED 0
emit API_WEB_MUTATED 0
emit AUTH_MAIL_WORKER_REMOUNT_F166_V2 PASS
emit ERROR_CODE NONE
emit PRODUCTION_MUTATION AUTH_MAIL_WORKER_STABLE_OVERRIDE_WRITTEN_AND_RECREATED
