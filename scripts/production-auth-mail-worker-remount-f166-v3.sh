#!/usr/bin/env bash
set -Eeuo pipefail

subject_sha="${1:-}"
runtime='/var/lib/pc-secret-authority/runtime'
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit AUTH_MAIL_WORKER_REMOUNT_F166_V3 FAIL; emit ERROR_CODE "$1"; emit DB_CREDENTIAL_MUTATED 0; emit API_WEB_MUTATED 0; emit PRODUCTION_MUTATION "$2"; exit "${3:-1}"; }

[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED NONE 20
[[ "$subject_sha" =~ ^[0-9a-f]{40}$ ]] || fail SUBJECT_SHA_INVALID NONE 21
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED NONE 22
docker compose version >/dev/null 2>&1 || fail COMPOSE_REQUIRED NONE 23
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED NONE 24

mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_CARDINALITY NONE 25
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail PROJECT_INVALID NONE 26
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
mapfile -t worker_ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
(( ${#api_ids[@]} == 1 && ${#worker_ids[@]} == 1 )) || fail API_WORKER_CARDINALITY NONE 27
api_id="${api_ids[0]}"; worker_id="${worker_ids[0]}"
for id in "$api_id" "$web_id" "$worker_id"; do
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$id" 2>/dev/null || true)" == "$subject_sha" ]] || fail REVISION_PARITY_FAILED NONE 28
done
emit PRE_REVISION_PARITY PASS

startup="$(docker logs --tail 300 "$worker_id" 2>&1 | sed -nE 's/^Auth-mail worker failed to start: ([A-Z0-9_]{1,120})$/\1/p' | sort -u || true)"
[[ "$startup" == AUTH_MAIL_PRISMACLIENTINITIALIZATIONERROR ]] || fail PRECONDITION_CHANGED NONE 29
emit PRE_STARTUP_CODE AUTH_MAIL_PRISMACLIENTINITIALIZATIONERROR

[[ -d "$runtime" && ! -L "$runtime" && "$(stat -c '%a:%u:%g' "$runtime")" == '700:0:0' ]] || fail RUNTIME_ROOT_INVALID NONE 30
[[ -d "$runtime/keyring" && ! -L "$runtime/keyring" ]] || fail RUNTIME_KEYRING_INVALID NONE 31
for p in "$runtime/current-key-version" "$runtime/database-url" "$runtime/transport.env"; do
  [[ -f "$p" && ! -L "$p" && "$(stat -c '%a:%u:%g' "$p")" == '444:0:0' ]] || fail RUNTIME_PROJECTION_INVALID NONE 32
done
emit RUNTIME_PROJECTION PASS

worker_image="$(docker inspect --format '{{.Config.Image}}' "$worker_id")"
[[ -n "$worker_image" && "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_image" 2>/dev/null || true)" == "$subject_sha" ]] || fail WORKER_IMAGE_REVISION_FAILED NONE 33
emit WORKER_IMAGE_REVISION PASS

mapfile -t api_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$api_id" | sed '/^$/d')
mapfile -t worker_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$worker_id" | sed '/^$/d')
(( ${#api_networks[@]} == 1 && ${#worker_networks[@]} == 1 )) || fail NETWORK_CARDINALITY NONE 34
api_network="${api_networks[0]}"; old_worker_network="${worker_networks[0]}"
[[ "$api_network" =~ ^[A-Za-z0-9_.-]{1,128}$ && "$old_worker_network" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail NETWORK_NAME_INVALID NONE 35
[[ "$api_network" != "$old_worker_network" ]] || fail NETWORK_MISMATCH_PRECONDITION_CHANGED NONE 36
docker network inspect "$api_network" >/dev/null 2>&1 || fail API_NETWORK_MISSING NONE 37
emit PRE_NETWORK_MISMATCH PASS
emit TARGET_NETWORK_API PASS

working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$worker_id")"
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" ]] || fail WORKING_DIR_INVALID NONE 38
working_dir="$(realpath -e -- "$working_dir")"
overlay="$working_dir/compose.auth-mail-worker-f166.api-network.override.json"
if [[ -e "$overlay" ]]; then [[ -f "$overlay" && ! -L "$overlay" && "$(stat -c '%a:%u:%g' "$overlay")" == '600:0:0' ]] || fail EXISTING_OVERLAY_INVALID NONE 39; fi
tmp="$(mktemp "$working_dir/.compose.auth-mail-worker-f166.api-network.XXXXXX.json")"; cfg="$(mktemp)"
cleanup(){ rm -f -- "$tmp" "$cfg" 2>/dev/null || true; }; trap cleanup EXIT
python3 - "$tmp" "$worker_image" "$runtime" "$api_network" <<'PY' || fail OVERLAY_BUILD_FAILED NONE 40
import json,sys
path,image,runtime,network=sys.argv[1:5]
obj={'services':{'auth-mail-worker':{'image':image,'pull_policy':'never','command':['dist/apps/api/src/auth-mail-worker.js'],'restart':'unless-stopped','environment':{'NODE_ENV':'production','RUNTIME_COMPONENT':'auth-mail-worker','AUTH_MAIL_WORKER_ENABLED':'true','AUTH_MAIL_WORKER_HEALTH_PORT':'3003','AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version','AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url','AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env'},'volumes':[{'type':'bind','source':runtime+'/keyring','target':'/run/pc-auth-mail/keyring','read_only':True},{'type':'bind','source':runtime+'/current-key-version','target':'/run/pc-auth-mail/current-key-version','read_only':True},{'type':'bind','source':runtime+'/database-url','target':'/run/pc-auth-mail/database-url','read_only':True},{'type':'bind','source':runtime+'/transport.env','target':'/run/pc-auth-mail/transport.env','read_only':True}],'healthcheck':{'test':['CMD','/nodejs/bin/node','-e',"fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"],'interval':'10s','timeout':'5s','retries':12,'start_period':'10s'},'networks':['runtime']}},'networks':{'runtime':{'external':True,'name':network}}}
with open(path,'w',encoding='utf-8') as f: json.dump(obj,f,ensure_ascii=True,separators=(',',':')); f.write('\n')
PY
chmod 0600 "$tmp"; chown 0:0 "$tmp"
dc=(docker compose --project-directory "$working_dir" --project-name "$project" -f "$tmp")
"${dc[@]}" config --format json > "$cfg" || fail OVERLAY_RENDER_FAILED NONE 41
python3 - "$cfg" "$worker_image" "$runtime" "$api_network" <<'PY' || fail OVERLAY_CONTRACT_FAILED NONE 42
import json,sys
c=json.load(open(sys.argv[1],encoding='utf-8')); image,runtime,network=sys.argv[2:5]; s=c.get('services') or {}
if set(s)!={'auth-mail-worker'}: raise SystemExit(1)
w=s['auth-mail-worker']; env=w.get('environment') or {}; env={str(k):str(v) for k,v in env.items()} if isinstance(env,dict) else {}
exp={'NODE_ENV':'production','RUNTIME_COMPONENT':'auth-mail-worker','AUTH_MAIL_WORKER_ENABLED':'true','AUTH_MAIL_WORKER_HEALTH_PORT':'3003','AUTH_MAIL_OUTBOX_KEYRING_DIR':'/run/pc-auth-mail/keyring','AUTH_MAIL_OUTBOX_CURRENT_KEY_VERSION_FILE':'/run/pc-auth-mail/current-key-version','AUTH_MAIL_DATABASE_URL_FILE':'/run/pc-auth-mail/database-url','AUTH_MAIL_TRANSPORT_FILE':'/run/pc-auth-mail/transport.env'}
if str(w.get('image') or '')!=image or env!=exp: raise SystemExit(1)
if ' '.join(map(str,w.get('command') or []))!='dist/apps/api/src/auth-mail-worker.js': raise SystemExit(1)
vols=w.get('volumes') or []; seen={str(v.get('target') or ''):(str(v.get('source') or ''),bool(v.get('read_only'))) for v in vols if isinstance(v,dict)}
mounts={'/run/pc-auth-mail/keyring':runtime+'/keyring','/run/pc-auth-mail/current-key-version':runtime+'/current-key-version','/run/pc-auth-mail/database-url':runtime+'/database-url','/run/pc-auth-mail/transport.env':runtime+'/transport.env'}
if set(seen)!=set(mounts) or any(seen[t]!=(src,True) for t,src in mounts.items()): raise SystemExit(1)
n=(c.get('networks') or {}).get('runtime') or {}; wn=w.get('networks') or {}
if str(n.get('name') or '')!=network or not bool(n.get('external')): raise SystemExit(1)
if set(wn if isinstance(wn,dict) else map(str,wn))!={'runtime'}: raise SystemExit(1)
PY
emit OVERLAY_CONTRACT PASS
mv -f -- "$tmp" "$overlay"; chmod 0600 "$overlay"; chown 0:0 "$overlay"
emit STABLE_OVERLAY_WRITTEN PASS

dc=(docker compose --project-directory "$working_dir" --project-name "$project" -f "$overlay")
old_worker_id="$worker_id"
"${dc[@]}" up -d --no-deps --pull never --force-recreate auth-mail-worker >/dev/null 2>&1 || fail WORKER_RECREATE_FAILED AUTH_MAIL_WORKER_API_NETWORK_OVERRIDE_WRITTEN_AND_RECREATE_ATTEMPTED 43
emit WORKER_RECREATED PASS

ready=0
for attempt in $(seq 1 30); do
  mapfile -t current_workers < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=auth-mail-worker')
  if (( ${#current_workers[@]} == 1 )); then
    current="${current_workers[0]}"; rev="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current" 2>/dev/null || true)"; health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$current" 2>/dev/null || true)"
    mapfile -t current_networks < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$current" 2>/dev/null | sed '/^$/d')
    if [[ "$current" != "$old_worker_id" && "$rev" == "$subject_sha" && "$health" == healthy && ${#current_networks[@]} == 1 && "${current_networks[0]}" == "$api_network" ]] && docker exec "$current" /nodejs/bin/node -e "fetch('http://127.0.0.1:3003/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then ready=1; worker_id="$current"; break; fi
  fi
  sleep 4
done
(( ready == 1 )) || fail WORKER_STILL_NOT_READY AUTH_MAIL_WORKER_API_NETWORK_OVERRIDE_WRITTEN_AND_RECREATED 44
emit WORKER_NETWORK PASS; emit WORKER_REVISION PASS; emit WORKER_READY PASS

config_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$worker_id" 2>/dev/null || true)"; working_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$worker_id" 2>/dev/null || true)"
[[ "$config_label" == "$overlay" && "$working_label" == "$working_dir" ]] || fail WORKER_COMPOSE_AUTHORITY_INVALID AUTH_MAIL_WORKER_API_NETWORK_OVERRIDE_WRITTEN_AND_RECREATED 45
emit WORKER_COMPOSE_AUTHORITY PASS
mapfile -t api_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api'); mapfile -t web_after < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=web')
(( ${#api_after[@]} == 1 && ${#web_after[@]} == 1 )) || fail API_WEB_CARDINALITY_CHANGED AUTH_MAIL_WORKER_API_NETWORK_OVERRIDE_WRITTEN_AND_RECREATED 46
[[ "${api_after[0]}" == "$api_id" && "${web_after[0]}" == "$web_id" ]] || fail API_WEB_CONTAINER_CHANGED AUTH_MAIL_WORKER_API_NETWORK_OVERRIDE_WRITTEN_AND_RECREATED 47
emit API_WEB_UNCHANGED PASS; emit DB_CREDENTIAL_MUTATED 0; emit API_WEB_MUTATED 0; emit AUTH_MAIL_WORKER_REMOUNT_F166_V3 PASS; emit ERROR_CODE NONE; emit PRODUCTION_MUTATION AUTH_MAIL_WORKER_BOUND_TO_API_NETWORK_AND_RECREATED
