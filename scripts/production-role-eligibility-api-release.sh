#!/usr/bin/env bash
set -Eeuo pipefail
set +x

ACTION="${1:-}"
TARGET_SHA="${2:-}"
API_IMAGE="${PC_ROLE_ELIGIBILITY_API_IMAGE:-}"
PROD_DIR_B64="${PC_PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PC_PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PC_PROD_PROJECT_B64:-}"
OVERRIDE_NAME="compose.role-eligibility-api-image.override.yml"

MUTATION_STARTED=0
ROLLBACK_ACTIVE=0

emit(){ printf '%s=%s\n' "$1" "$2"; }
decode(){ [[ -z "$1" ]] || printf '%s' "$1" | base64 -d; }
trim(){ local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
fail(){ emit ROLE_ELIGIBILITY_API_RELEASE FAIL; emit ERROR_CODE "$1"; exit "${2:-1}"; }

[[ "$ACTION" =~ ^(audit|deploy)$ ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 4
command -v python3 >/dev/null 2>&1 || fail PYTHON_REQUIRED 5

expected_image="ghcr.io/pachaninm-lab/grainflow-api:sha-${TARGET_SHA:0:7}"
if [[ "$ACTION" == deploy ]]; then
  [[ "$API_IMAGE" == "$expected_image" ]] || fail API_IMAGE_REFERENCE_INVALID 6
fi

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
baseline_api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$baseline_api_id")" == true ]] || fail API_NOT_RUNNING 11
[[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$baseline_api_id")" == api ]] || fail API_COMPOSE_AUTHORITY_INVALID 12

baseline_image_ref="$(docker inspect --format '{{.Config.Image}}' "$baseline_api_id")"
baseline_image_id="$(docker inspect --format '{{.Image}}' "$baseline_api_id")"
baseline_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$baseline_image_id" 2>/dev/null || true)"
[[ "$baseline_image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail BASELINE_API_IMAGE_ID_INVALID 13
[[ "$baseline_revision" =~ ^[0-9a-f]{40}$ ]] || fail BASELINE_API_REVISION_INVALID 14

prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"
if [[ -z "$prod_dir" ]]; then
  prod_dir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$baseline_api_id")"
fi
if [[ -z "$prod_compose" ]]; then
  prod_compose="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$baseline_api_id")"
fi
if [[ -z "$prod_project" ]]; then
  prod_project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$baseline_api_id")"
fi
[[ -n "$prod_dir" && -d "$prod_dir" ]] || fail PRODUCTION_DIRECTORY_INVALID 15
[[ -n "$prod_compose" ]] || fail PRODUCTION_COMPOSE_AUTHORITY_MISSING 16
[[ "$prod_project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail PRODUCTION_PROJECT_INVALID 17

override="$prod_dir/$OVERRIDE_NAME"
[[ "$override" == "$prod_dir"/* ]] || fail OVERRIDE_PATH_INVALID 18

IFS=',' read -r -a raw_files <<< "$prod_compose"
compose_files=()
for raw in "${raw_files[@]}"; do
  file="$(trim "$raw")"
  [[ -n "$file" ]] || continue
  [[ "$file" == /* ]] || file="$prod_dir/$file"
  [[ "$file" == "$override" ]] && continue
  [[ -f "$file" ]] || fail PRODUCTION_COMPOSE_FILE_MISSING 19
  compose_files+=("$file")
done
(( ${#compose_files[@]} >= 1 )) || fail PRODUCTION_COMPOSE_AUTHORITY_EMPTY 20

dc=(docker compose --project-directory "$prod_dir" --project-name "$prod_project")
for file in "${compose_files[@]}"; do dc+=(-f "$file"); done
"${dc[@]}" config --quiet
"${dc[@]}" config --services | grep -Fxq api || fail API_SERVICE_MISSING 21

dc_target=("${dc[@]}" -f "$override")

api_ready(){
  local id="$1"
  [[ -n "$id" && "$(docker inspect --format '{{.State.Running}}' "$id" 2>/dev/null || true)" == true ]] || return 1
  docker exec "$id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1
}

wait_api(){
  local id attempt
  for attempt in $(seq 1 30); do
    id="$("${dc_target[@]}" ps -q api 2>/dev/null | head -1)"
    if api_ready "$id"; then printf '%s' "$id"; return 0; fi
    sleep 4
  done
  return 1
}

runtime_fingerprint(){
  docker inspect "$1" | python3 -c '
import hashlib,json,sys
obj=json.load(sys.stdin)[0]
config=obj.get("Config",{})
host=obj.get("HostConfig",{})
net=obj.get("NetworkSettings",{}).get("Networks",{})
mounts=obj.get("Mounts",[])
payload={
  "env":sorted(config.get("Env") or []),
  "entrypoint":config.get("Entrypoint"),
  "cmd":config.get("Cmd"),
  "user":config.get("User"),
  "workingDir":config.get("WorkingDir"),
  "exposedPorts":sorted((config.get("ExposedPorts") or {}).keys()),
  "portBindings":host.get("PortBindings"),
  "restartPolicy":host.get("RestartPolicy"),
  "mounts":sorted(({"type":m.get("Type"),"source":m.get("Source"),"destination":m.get("Destination"),"rw":m.get("RW")} for m in mounts), key=lambda x:(str(x["destination"]),str(x["source"]))),
  "networks":sorted(net.keys()),
}
raw=json.dumps(payload,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()
print(hashlib.sha256(raw).hexdigest(),end="")
'
}

protected_snapshot(){
  local excluded="$1"
  docker ps -q --no-trunc | grep -vx "$excluded" | sort | sha256sum | awk '{print $1}'
}

write_override(){
  local image="$1" tmp
  [[ "$image" =~ ^ghcr\.io/pachaninm-lab/grainflow-api:sha-[0-9a-f]{7}$ ]] || return 1
  tmp="$(mktemp "$prod_dir/.role-eligibility-api-override.XXXXXX")"
  cat > "$tmp" <<YAML
services:
  api:
    image: $image
    pull_policy: never
YAML
  chmod 0600 "$tmp"
  mv -f "$tmp" "$override"
}

configured_api_image(){
  "${dc_target[@]}" config | awk '
    /^  api:$/ { in_api=1; next }
    in_api && /^  [^ ]/ { exit }
    in_api && /^    image:/ {
      sub(/^    image:[[:space:]]*/, "")
      gsub(/^["'"'"']|["'"'"']$/, "")
      print
      exit
    }
  '
}

api_ready "$baseline_api_id" || fail BASELINE_API_NOT_READY 22
baseline_runtime_fingerprint="$(runtime_fingerprint "$baseline_api_id")"
[[ "$baseline_runtime_fingerprint" =~ ^[0-9a-f]{64}$ ]] || fail BASELINE_RUNTIME_FINGERPRINT_INVALID 23
baseline_protected_snapshot="$(protected_snapshot "$baseline_api_id")"

# A running Watchtower can overwrite exact-image authority after this bounded
# release. Do not mutate it here; fail closed if a separate controller left it live.
while IFS= read -r id; do
  [[ -n "$id" ]] || continue
  service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$id" 2>/dev/null || true)"
  image="$(docker inspect --format '{{.Config.Image}}' "$id" 2>/dev/null || true)"
  if [[ "$service" == watchtower || "$image" == *containrrr/watchtower* ]]; then
    fail WATCHTOWER_RUNNING 24
  fi
done < <(docker ps -q --no-trunc)

if [[ "$ACTION" == audit ]]; then
  [[ "$baseline_revision" == "$TARGET_SHA" ]] || fail API_IMAGE_REVISION_MISMATCH 25
  emit ROLE_ELIGIBILITY_API_RELEASE PASS
  emit ROLE_ELIGIBILITY_TARGET_SHA "$TARGET_SHA"
  emit ROLE_ELIGIBILITY_API_REVISION "$baseline_revision"
  emit ROLE_ELIGIBILITY_API_READY PASS
  emit ROLE_ELIGIBILITY_ENFORCEMENT_UNCHANGED PASS
  emit REGISTRATION_CONFIGURATION_UNCHANGED PASS
  emit PROTECTED_CONTAINERS_UNCHANGED PASS
  exit 0
fi

docker pull "$API_IMAGE" >/dev/null || fail API_IMAGE_PULL_FAILED 26
pulled_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$API_IMAGE" 2>/dev/null || true)"
[[ "$pulled_revision" == "$TARGET_SHA" ]] || fail API_IMAGE_REVISION_MISMATCH 27

rollback_on_error(){
  rc=$?
  trap - ERR
  if [[ "$MUTATION_STARTED" == 1 && "$ROLLBACK_ACTIVE" == 0 ]]; then
    ROLLBACK_ACTIVE=1
    emit ROLE_ELIGIBILITY_API_ROLLBACK_ATTEMPTED 1
    if write_override "$baseline_image_ref"; then
      "${dc_target[@]}" config --quiet || true
      "${dc_target[@]}" up -d --no-deps --force-recreate --pull never api >/dev/null 2>&1 || true
      restored_id="$(wait_api 2>/dev/null || true)"
      if [[ -n "$restored_id" ]]; then
        restored_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$restored_id")" 2>/dev/null || true)"
        restored_fingerprint="$(runtime_fingerprint "$restored_id" 2>/dev/null || true)"
        restored_protected="$(protected_snapshot "$restored_id" 2>/dev/null || true)"
        if [[ "$restored_revision" == "$baseline_revision" && "$restored_fingerprint" == "$baseline_runtime_fingerprint" && "$restored_protected" == "$baseline_protected_snapshot" ]]; then
          emit ROLE_ELIGIBILITY_API_ROLLBACK_COMPLETED 1
          exit "$rc"
        fi
      fi
    fi
    emit ROLE_ELIGIBILITY_API_ROLLBACK_COMPLETED 0
    exit 90
  fi
  exit "$rc"
}
trap rollback_on_error ERR

write_override "$API_IMAGE"
"${dc_target[@]}" config --quiet
[[ "$(configured_api_image)" == "$API_IMAGE" ]] || fail COMPOSE_API_IMAGE_AUTHORITY_MISMATCH 30
MUTATION_STARTED=1
emit ROLE_ELIGIBILITY_API_MUTATION_STARTED 1

"${dc_target[@]}" up -d --no-deps --force-recreate --pull never api >/dev/null
new_api_id="$(wait_api)" || fail API_READINESS_FAILED 31
[[ -n "$new_api_id" && "$new_api_id" != "$baseline_api_id" ]] || fail API_NOT_RECREATED 32
new_image_id="$(docker inspect --format '{{.Image}}' "$new_api_id")"
new_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$new_image_id" 2>/dev/null || true)"
[[ "$new_revision" == "$TARGET_SHA" ]] || fail DEPLOYED_API_REVISION_MISMATCH 33
new_runtime_fingerprint="$(runtime_fingerprint "$new_api_id")"
[[ "$new_runtime_fingerprint" == "$baseline_runtime_fingerprint" ]] || fail API_RUNTIME_CONFIGURATION_CHANGED 34
new_protected_snapshot="$(protected_snapshot "$new_api_id")"
[[ "$new_protected_snapshot" == "$baseline_protected_snapshot" ]] || fail PROTECTED_CONTAINER_SET_CHANGED 35

trap - ERR
emit ROLE_ELIGIBILITY_API_RELEASE PASS
emit ROLE_ELIGIBILITY_TARGET_SHA "$TARGET_SHA"
emit ROLE_ELIGIBILITY_API_REVISION "$new_revision"
emit ROLE_ELIGIBILITY_API_READY PASS
emit ROLE_ELIGIBILITY_ENFORCEMENT_UNCHANGED PASS
emit REGISTRATION_CONFIGURATION_UNCHANGED PASS
emit PROTECTED_CONTAINERS_UNCHANGED PASS
