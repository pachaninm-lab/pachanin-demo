#!/usr/bin/env bash
set -Eeuo pipefail
set +x

ACTION="${1:-}"
TARGET_SHA="${2:-}"
POLICY_VERSION="${ROLE_ELIGIBILITY_POLICY_VERSION:-2026-09-02.v1}"
CANONICAL_NAME="pc-role-eligibility-worker"
SHORT_SHA="${TARGET_SHA:0:12}"
CANDIDATE_NAME="pc-role-eligibility-worker-candidate-${SHORT_SHA}"

emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit ROLE_ELIGIBILITY_WORKER_DEPLOY FAIL; emit ERROR_CODE "$1"; exit "${2:-1}"; }

[[ "$ACTION" =~ ^(audit|deploy|remove)$ ]] || fail INVALID_ACTION 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$POLICY_VERSION" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || fail INVALID_POLICY_VERSION 4
command -v docker >/dev/null 2>&1 || fail DOCKER_REQUIRED 5

mapfile -t api_ids < <(docker ps -q --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail COMPOSE_API_AUTHORITY_AMBIGUOUS 10
api_id="${api_ids[0]}"
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_NOT_RUNNING 11
api_image_id="$(docker inspect --format '{{.Image}}' "$api_id")"
[[ "$api_image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail API_IMAGE_ID_INVALID 12
image_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$api_image_id")"
[[ "$image_revision" == "$TARGET_SHA" ]] || fail API_IMAGE_REVISION_MISMATCH 13

api_compose_service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$api_id")"
[[ "$api_compose_service" == api ]] || fail API_COMPOSE_AUTHORITY_INVALID 14
mapfile -t networks < <(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$api_id" | sed '/^$/d' | sort -u)
(( ${#networks[@]} >= 1 )) || fail API_NETWORK_MISSING 15

database_url="$(docker inspect "$api_id" | python3 -c '
import json,sys
obj=json.load(sys.stdin)[0]
vals=[x.split("=",1)[1] for x in obj.get("Config",{}).get("Env",[]) if x.startswith("DATABASE_URL=")]
if len(vals)!=1 or not vals[0]: raise SystemExit(1)
print(vals[0],end="")
' 2>/dev/null)" || fail DATABASE_URL_NOT_RESOLVED 16
[[ "$database_url" == postgres://* || "$database_url" == postgresql://* ]] || fail DATABASE_URL_INVALID 17

worker_ready(){
  local name="$1"
  [[ "$(docker inspect --format '{{.State.Running}}' "$name" 2>/dev/null || true)" == true ]] || return 1
  docker exec "$name" node -e "fetch('http://127.0.0.1:3004/ready',{signal:AbortSignal.timeout(3000)}).then(async r=>{if(r.status!==200)process.exit(2);const j=await r.json();if(j.shadowMode!==true||j.enforcement!==false)process.exit(3)}).catch(()=>process.exit(4))" >/dev/null 2>&1
}

worker_audit(){
  [[ "$(docker inspect --format '{{.State.Running}}' "$CANONICAL_NAME" 2>/dev/null || true)" == true ]] || fail WORKER_NOT_RUNNING 30
  local image_id revision compose_label runtime_component enabled shadow enforcement
  image_id="$(docker inspect --format '{{.Image}}' "$CANONICAL_NAME")"
  revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_id")"
  [[ "$revision" == "$TARGET_SHA" ]] || fail WORKER_IMAGE_REVISION_MISMATCH 31
  compose_label="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$CANONICAL_NAME" 2>/dev/null || true)"
  [[ "$compose_label" != api ]] || fail WORKER_MUST_NOT_IMPERSONATE_API_SERVICE 32
  readarray -t flags < <(docker inspect "$CANONICAL_NAME" | python3 -c '
import json,sys
obj=json.load(sys.stdin)[0]
env=dict(x.split("=",1) for x in obj.get("Config",{}).get("Env",[]) if "=" in x)
for k in ("RUNTIME_COMPONENT","ROLE_ELIGIBILITY_ENABLED","ROLE_ELIGIBILITY_SHADOW_MODE","ROLE_ELIGIBILITY_ENFORCEMENT"):
 print(env.get(k,""))
')
  runtime_component="${flags[0]:-}"; enabled="${flags[1]:-}"; shadow="${flags[2]:-}"; enforcement="${flags[3]:-}"
  [[ "$runtime_component" == role-eligibility-worker ]] || fail WORKER_RUNTIME_COMPONENT_INVALID 33
  [[ "$enabled" == true && "$shadow" == true && "$enforcement" == false ]] || fail WORKER_SHADOW_FLAGS_INVALID 34
  worker_ready "$CANONICAL_NAME" || fail WORKER_NOT_READY 35
  [[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_CHANGED_DURING_WORKER_AUDIT 36
  emit ROLE_ELIGIBILITY_WORKER PASS
  emit ROLE_ELIGIBILITY_TARGET_SHA "$TARGET_SHA"
  emit ROLE_ELIGIBILITY_SHADOW_MODE true
  emit ROLE_ELIGIBILITY_ENFORCEMENT false
  emit REGISTRATION_RUNTIME_UNCHANGED PASS
}

if [[ "$ACTION" == remove ]]; then
  docker rm -f "$CANONICAL_NAME" >/dev/null 2>&1 || true
  docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true
  [[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_CHANGED_DURING_WORKER_REMOVE 40
  emit ROLE_ELIGIBILITY_WORKER REMOVED
  emit REGISTRATION_RUNTIME_UNCHANGED PASS
  exit 0
fi

if [[ "$ACTION" == audit ]]; then
  worker_audit
  exit 0
fi

# deploy
if docker inspect "$CANONICAL_NAME" >/dev/null 2>&1; then
  existing_revision="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker inspect --format '{{.Image}}' "$CANONICAL_NAME")" 2>/dev/null || true)"
  if [[ "$existing_revision" == "$TARGET_SHA" ]] && worker_ready "$CANONICAL_NAME"; then
    worker_audit
    exit 0
  fi
fi

docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true
create_args=(
  create
  --name "$CANDIDATE_NAME"
  --restart unless-stopped
  --network "${networks[0]}"
  -e "DATABASE_URL=$database_url"
  -e NODE_ENV=production
  -e RUNTIME_COMPONENT=role-eligibility-worker
  -e ROLE_ELIGIBILITY_ENABLED=true
  -e ROLE_ELIGIBILITY_SHADOW_MODE=true
  -e ROLE_ELIGIBILITY_ENFORCEMENT=false
  -e "ROLE_ELIGIBILITY_POLICY_VERSION=$POLICY_VERSION"
  -e ROLE_ELIGIBILITY_WORKER_HEALTH_PORT=3004
  "$api_image_id"
  dist/apps/api/src/role-eligibility-worker.js
)
docker "${create_args[@]}" >/dev/null || fail WORKER_CREATE_FAILED 50
for ((i=1;i<${#networks[@]};i++)); do
  docker network connect "${networks[$i]}" "$CANDIDATE_NAME" >/dev/null || { docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true; fail WORKER_NETWORK_ATTACH_FAILED 51; }
done
docker start "$CANDIDATE_NAME" >/dev/null || { docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true; fail WORKER_START_FAILED 52; }

ready=0
for _ in $(seq 1 30); do
  if worker_ready "$CANDIDATE_NAME"; then ready=1; break; fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  docker logs --tail 40 "$CANDIDATE_NAME" 2>&1 | sed -E 's#(postgres(?:ql)?://)[^/@ ]+@#\1[REDACTED]@#g' >&2 || true
  docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true
  fail WORKER_READINESS_FAILED 53
fi

# Candidate is independent and idempotent; a brief overlap with the previous
# worker is safe because checks use SKIP LOCKED and terminal publish locks the
# eligibility check/idempotency key in PostgreSQL.
if docker inspect "$CANONICAL_NAME" >/dev/null 2>&1; then
  docker rm -f "$CANONICAL_NAME" >/dev/null || { docker rm -f "$CANDIDATE_NAME" >/dev/null 2>&1 || true; fail OLD_WORKER_REMOVE_FAILED 54; }
fi
docker rename "$CANDIDATE_NAME" "$CANONICAL_NAME" >/dev/null || fail WORKER_RENAME_FAILED 55
[[ "$(docker inspect --format '{{.State.Running}}' "$api_id")" == true ]] || fail API_CHANGED_DURING_WORKER_DEPLOY 56
worker_audit
