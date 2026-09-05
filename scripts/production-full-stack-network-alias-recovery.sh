#!/usr/bin/env bash
set -Eeuo pipefail

emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit API_ALIAS_RECOVERY FAIL; emit ERROR_CODE "$1"; emit PRODUCTION_MUTATION "${2:-NONE}"; exit "${3:-1}"; }

[[ "$(id -u)" -eq 0 ]] || fail ROOT_REQUIRED NONE 20
mapfile -t web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#web_ids[@]} == 1 )) || fail WEB_AUTHORITY_AMBIGUOUS NONE 21
web_id="${web_ids[0]}"
project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$web_id")"
[[ "$project" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail PROJECT_INVALID NONE 22
mapfile -t api_ids < <(docker ps -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.service=api')
(( ${#api_ids[@]} == 1 )) || fail API_AUTHORITY_AMBIGUOUS NONE 23
api_id="${api_ids[0]}"
api_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")"
[[ "$api_revision" =~ ^[0-9a-f]{40}$ ]] || fail API_REVISION_INVALID NONE 24
mapfile -t nets < <(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$api_id" | sed '/^$/d')
(( ${#nets[@]} == 1 )) || fail API_NETWORK_CARDINALITY NONE 25
net="${nets[0]}"
[[ "$net" =~ ^[A-Za-z0-9_.-]{1,128}$ ]] || fail API_NETWORK_INVALID NONE 26
docker network inspect "$net" >/dev/null

has_api_alias(){
  docker inspect "$1" | python3 -c 'import json,sys; d=json.load(sys.stdin)[0]; n=sys.argv[1]; print("\n".join((d.get("NetworkSettings",{}).get("Networks",{}).get(n,{}) or {}).get("Aliases") or []))' "$net" | grep -Fxq api
}

has_api_alias "$api_id" || fail AUTHORITATIVE_API_ALIAS_MISSING NONE 27
mapfile -t members < <(docker network inspect --format '{{range $id,$c := .Containers}}{{println $id}}{{end}}' "$net" | sed '/^$/d')
collisions=()
for id in "${members[@]}"; do
  [[ "$id" == "$api_id" ]] && continue
  has_api_alias "$id" && collisions+=("$id")
done
(( ${#collisions[@]} >= 1 )) || fail STALE_API_ALIAS_COLLISION_NOT_PRESENT NONE 28

for id in "${collisions[@]}"; do
  svc="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$id")"
  other_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$id")"
  name="$(docker inspect --format '{{.Name}}' "$id")"; name="${name#/}"
  [[ "$svc" == api ]] || fail FOREIGN_ALIAS_NOT_API_SERVICE NONE 29
  [[ "$other_project" =~ ^[A-Za-z0-9_.-]{1,128}$ && "$other_project" != "$project" ]] || fail FOREIGN_ALIAS_PROJECT_NOT_PROVABLY_STALE NONE 30
  [[ "$name" == "$other_project-api-1" || "$name" == "${other_project}_api_1" ]] || fail FOREIGN_ALIAS_NAME_NOT_COMPOSE_STALE NONE 31
done

for id in "${collisions[@]}"; do
  docker network disconnect -f "$net" "$id"
  emit STALE_API_ALIAS_DISCONNECTED PASS
done

mapfile -t members_after < <(docker network inspect --format '{{range $id,$c := .Containers}}{{println $id}}{{end}}' "$net" | sed '/^$/d')
alias_ids=()
for id in "${members_after[@]}"; do has_api_alias "$id" && alias_ids+=("$id"); done
(( ${#alias_ids[@]} == 1 )) && [[ "${alias_ids[0]}" == "$api_id" ]] || fail API_ALIAS_STILL_AMBIGUOUS STALE_API_NETWORK_ALIAS_DISCONNECTED 32
docker exec "$api_id" /nodejs/bin/node -e "fetch('http://127.0.0.1:3001/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || fail AUTHORITATIVE_API_NOT_READY STALE_API_NETWORK_ALIAS_DISCONNECTED 33
[[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$api_id")" == "$api_revision" ]] || fail AUTHORITATIVE_API_REVISION_CHANGED STALE_API_NETWORK_ALIAS_DISCONNECTED 34
emit API_ALIAS_UNIQUENESS PASS
emit AUTHORITATIVE_API_REVISION_UNCHANGED PASS
emit API_REVISION "$api_revision"
emit API_ALIAS_RECOVERY PASS
emit PRODUCTION_MUTATION STALE_API_NETWORK_ALIAS_DISCONNECTED
