#!/usr/bin/env bash
set -Eeuo pipefail
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit COMPOSE_DIFF_DIAGNOSTIC FAIL; emit ERROR_CODE "$1"; emit PRODUCTION_MUTATION NONE; exit "${2:-1}"; }

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
(( ${#api_ids[@]} == 1 && ${#worker_ids[@]} == 1 )) || fail SERVICE_CARDINALITY 26
api_id="${api_ids[0]}"; worker_id="${worker_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id" 2>/dev/null || true)"
web_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$web_id" 2>/dev/null || true)"
worker_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$worker_id" 2>/dev/null || true)"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" =~ ^[0-9a-f]{40}$ && "$worker_revision" =~ ^[0-9a-f]{40}$ ]] || fail REVISION_INVALID 27
[[ "$api_revision" == "$web_revision" ]] || fail API_WEB_REVISION_MISMATCH 28
api_image="$(docker inspect --format '{{.Config.Image}}' "$api_id" 2>/dev/null || true)"
[[ -n "$api_image" && "$api_image" != *$'\n'* && "$api_image" != *$'\r'* ]] || fail API_IMAGE_INVALID 29
[[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_image" 2>/dev/null || true)" == "$api_revision" ]] || fail API_IMAGE_REVISION_MISMATCH 30

working_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$worker_id" 2>/dev/null || true)"
config_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$worker_id" 2>/dev/null || true)"
[[ "$working_dir" == /* && "$working_dir" != / && -d "$working_dir" && ! -L "$working_dir" && -n "$config_files" ]] || fail COMPOSE_AUTHORITY_INVALID 31
working_dir="$(realpath -e -- "$working_dir")"
dc=(docker compose --project-directory "$working_dir" --project-name "$project")
IFS=',' read -r -a raw_files <<< "$config_files"
count=0
for raw in "${raw_files[@]}"; do
  f="${raw#"${raw%%[![:space:]]*}"}"; f="${f%"${f##*[![:space:]]}"}"
  [[ -n "$f" ]] || continue
  [[ "$f" == /* ]] || f="$working_dir/$f"
  [[ -f "$f" && ! -L "$f" ]] || fail COMPOSE_FILE_INVALID 32
  dc+=(-f "$(realpath -e -- "$f")"); ((count+=1))
done
(( count >= 1 )) || fail COMPOSE_FILES_EMPTY 33

baseline="$(mktemp)"; merged="$(mktemp)"; overlay="$(mktemp --suffix=.json)"
cleanup(){ rm -f -- "$baseline" "$merged" "$overlay"; }
trap cleanup EXIT
"${dc[@]}" config --format json > "$baseline" || fail BASELINE_RENDER_FAILED 34
python3 - "$overlay" "$api_image" <<'PY'
import json,sys
json.dump({'services':{'auth-mail-worker':{'image':sys.argv[2],'pull_policy':'never'}}},open(sys.argv[1],'w'),separators=(',',':'))
PY
docker compose --project-directory "$working_dir" --project-name "$project" "${dc[@]:6}" -f "$overlay" config --format json > "$merged" || fail TARGET_RENDER_FAILED 35

diff_paths="$(python3 - "$baseline" "$merged" "$api_image" <<'PY'
import copy,json,re,sys
b=json.load(open(sys.argv[1])); n=json.load(open(sys.argv[2])); image=sys.argv[3]
bs=(b.get('services') or {}).get('auth-mail-worker'); ns=(n.get('services') or {}).get('auth-mail-worker')
if not isinstance(bs,dict) or not isinstance(ns,dict):
  if isinstance(bs,dict) and ns is None: print('target_service_missing')
  elif bs is None and isinstance(ns,dict): print('baseline_service_missing')
  elif bs is None and ns is None: print('both_services_missing')
  else: print('service_shape_invalid')
  raise SystemExit
bb=copy.deepcopy(bs); nn=copy.deepcopy(ns)
bb['image']=image; nn['image']=image
bb.pop('pull_policy',None); nn.pop('pull_policy',None)
out=[]
def walk(a,b,p='service'):
  if type(a) is not type(b): out.append(p); return
  if isinstance(a,dict):
    for k in sorted(set(a)|set(b)):
      q=f'{p}.{k}'
      if k not in a or k not in b: out.append(q)
      else: walk(a[k],b[k],q)
  elif isinstance(a,list):
    if a!=b: out.append(p)
  elif a!=b: out.append(p)
walk(bb,nn)
s=','.join(out[:20]) or 'NONE'
print(re.sub(r'[^A-Za-z0-9_.,:-]','_',s)[:600])
PY
)"
[[ -n "$diff_paths" ]] || diff_paths=UNKNOWN
emit PRE_API_REVISION "$api_revision"
emit PRE_WEB_REVISION "$web_revision"
emit PRE_WORKER_REVISION "$worker_revision"
emit COMPOSE_CONFIG_FILE_COUNT "$count"
emit COMPOSE_DIFF_PATHS "$diff_paths"
emit COMPOSE_DIFF_DIAGNOSTIC PASS
emit ERROR_CODE NONE
emit PRODUCTION_MUTATION NONE
