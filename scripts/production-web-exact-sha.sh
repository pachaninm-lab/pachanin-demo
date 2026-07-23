#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
TARGET_SHA="${2:-}"
PC_PROD_DIR="${PC_PROD_DIR:-}"
PC_PROD_COMPOSE="${PC_PROD_COMPOSE:-}"
PC_PROD_PROJECT="${PC_PROD_PROJECT:-}"
PC_HARDENING_OVERRIDE="${PC_HARDENING_OVERRIDE:-${PC_PROD_DIR%/}/compose.production-hardening.override.yml}"
PC_IMAGE_OVERRIDE="${PC_IMAGE_OVERRIDE:-${PC_PROD_DIR%/}/compose.production-web-image.override.yml}"
IMAGE_REPOSITORY="${PC_WEB_IMAGE_REPOSITORY:-ghcr.io/pachaninm-lab/grainflow-web}"
LIVE_ACCEPTANCE_SCRIPT="${PC_LIVE_ACCEPTANCE_SCRIPT:-}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  return 1
}

version_at_least() {
  local actual="$1"
  local required="$2"
  [[ "$(printf '%s\n%s\n' "$required" "$actual" | sort -V | head -n1)" == "$required" ]]
}

require_path() {
  local value="$1"
  local name="$2"
  [[ -n "$value" ]] || fail "$name is required"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || fail "$name contains a newline"
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

write_image_override() {
  local image="$1"
  [[ "$image" =~ ^[A-Za-z0-9._/@:-]+$ ]] || fail "unsafe image reference: $image"
  local temporary
  temporary="$(mktemp "${PC_IMAGE_OVERRIDE}.tmp.XXXXXX")"
  {
    printf 'services:\n'
    printf '  web:\n'
    printf '    image: %s\n' "$image"
  } > "$temporary"
  chmod 0644 "$temporary"
  mv -f "$temporary" "$PC_IMAGE_OVERRIDE"
}

case "$ACTION" in
  audit) ;;
  deploy|rollback)
    [[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail 'target SHA must be a full lowercase 40-character Git SHA'
    ;;
  *) fail 'usage: production-web-exact-sha.sh audit | deploy <sha> | rollback <sha>' ;;
esac

require_path "$PC_PROD_DIR" PC_PROD_DIR
require_path "$PC_PROD_COMPOSE" PC_PROD_COMPOSE
require_path "$PC_HARDENING_OVERRIDE" PC_HARDENING_OVERRIDE
require_path "$PC_IMAGE_OVERRIDE" PC_IMAGE_OVERRIDE
[[ -d "$PC_PROD_DIR" ]] || fail "production directory does not exist: $PC_PROD_DIR"

if [[ "$PC_HARDENING_OVERRIDE" != /* ]]; then
  PC_HARDENING_OVERRIDE="${PC_PROD_DIR%/}/$PC_HARDENING_OVERRIDE"
fi
if [[ "$PC_IMAGE_OVERRIDE" != /* ]]; then
  PC_IMAGE_OVERRIDE="${PC_PROD_DIR%/}/$PC_IMAGE_OVERRIDE"
fi
[[ -f "$PC_HARDENING_OVERRIDE" ]] || fail "hardening override does not exist: $PC_HARDENING_OVERRIDE"
[[ -d "$(dirname "$PC_IMAGE_OVERRIDE")" ]] || fail "image override directory does not exist: $(dirname "$PC_IMAGE_OVERRIDE")"
if [[ "$ACTION" != audit ]]; then
  [[ -x "$LIVE_ACCEPTANCE_SCRIPT" ]] || fail 'PC_LIVE_ACCEPTANCE_SCRIPT must point to an executable acceptance script'
fi

compose_version="$(docker compose version --short | sed 's/^v//')"
version_at_least "$compose_version" '2.24.4' || fail "Docker Compose >= 2.24.4 is required; found $compose_version"

BASE_DC=(docker compose --project-directory "$PC_PROD_DIR")
if [[ -n "$PC_PROD_PROJECT" ]]; then
  [[ "$PC_PROD_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'PC_PROD_PROJECT is invalid'
  BASE_DC+=(--project-name "$PC_PROD_PROJECT")
fi

IFS=',' read -r -a RAW_COMPOSE_FILES <<< "$PC_PROD_COMPOSE"
compose_file_count=0
for raw_file in "${RAW_COMPOSE_FILES[@]}"; do
  compose_file="$(trim "$raw_file")"
  [[ -n "$compose_file" ]] || continue
  if [[ "$compose_file" != /* ]]; then compose_file="${PC_PROD_DIR%/}/$compose_file"; fi
  [[ -f "$compose_file" ]] || fail "production Compose file does not exist: $compose_file"
  BASE_DC+=(-f "$compose_file")
  compose_file_count=$((compose_file_count + 1))
done
(( compose_file_count >= 1 )) || fail 'no production Compose files were resolved'
BASE_DC+=(-f "$PC_HARDENING_OVERRIDE")

cd "$PC_PROD_DIR"
"${BASE_DC[@]}" config --quiet
"${BASE_DC[@]}" config --services | grep -qx web || fail 'web service is absent from the merged production Compose model'

merged_web_container_name="$(
  "${BASE_DC[@]}" config |
    awk '
      /^  web:$/ { in_web=1; next }
      in_web && /^  [^ ]/ { exit }
      in_web && /^    container_name:/ {
        sub(/^    container_name:[[:space:]]*/, "")
        print
        exit
      }
    '
)"
[[ -z "$merged_web_container_name" ]] || fail "merged web service still has container_name=$merged_web_container_name"

mapfile -t compose_web_ids < <("${BASE_DC[@]}" ps -q web 2>/dev/null || true)
legacy_web=0
if (( ${#compose_web_ids[@]} == 1 )); then
  current_web_id="${compose_web_ids[0]}"
elif (( ${#compose_web_ids[@]} == 0 )); then
  mapfile -t legacy_candidates < <(
    docker ps -q |
      while read -r id; do
        image="$(docker inspect --format '{{.Config.Image}}' "$id" 2>/dev/null || true)"
        if [[ "$image" == *grainflow-web* ]]; then printf '%s\n' "$id"; fi
      done
  )
  (( ${#legacy_candidates[@]} == 1 )) ||
    fail "expected one legacy web container when Compose labels are absent; found ${#legacy_candidates[@]}"
  current_web_id="${legacy_candidates[0]}"
  legacy_web=1
else
  fail "expected exactly one Compose web container; found ${#compose_web_ids[@]}"
fi

current_image_ref="$(docker inspect --format '{{.Config.Image}}' "$current_web_id")"
current_image_id="$(docker inspect --format '{{.Image}}' "$current_web_id")"
current_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$current_web_id" 2>/dev/null || true)"
current_name="$(docker inspect --format '{{.Name}}' "$current_web_id" | sed 's#^/##')"
current_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$current_web_id")"

mapfile -t watchtower_ids < <(
  docker ps -aq |
    while read -r id; do
      image="$(docker inspect --format '{{.Config.Image}}' "$id" 2>/dev/null || true)"
      service="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$id" 2>/dev/null || true)"
      if [[ "$service" == watchtower || "$image" == *containrrr/watchtower* ]]; then printf '%s\n' "$id"; fi
    done
)

printf 'ACTION=%s\n' "$ACTION"
printf 'COMPOSE_VERSION=%s\n' "$compose_version"
printf 'COMPOSE_FILE_COUNT=%s\n' "$compose_file_count"
printf 'CURRENT_WEB_ID=%s\n' "$current_web_id"
printf 'CURRENT_WEB_NAME=%s\n' "$current_name"
printf 'CURRENT_WEB_IMAGE=%s\n' "$current_image_ref"
printf 'CURRENT_WEB_IMAGE_ID=%s\n' "$current_image_id"
printf 'CURRENT_WEB_REVISION=%s\n' "${current_revision:-unknown}"
printf 'CURRENT_WEB_STATE=%s\n' "$current_state"
printf 'CURRENT_WEB_LEGACY=%s\n' "$legacy_web"
printf 'WATCHTOWER_CONTAINERS=%s\n' "${#watchtower_ids[@]}"
printf 'PERSISTENT_IMAGE_OVERRIDE=%s\n' "$PC_IMAGE_OVERRIDE"

if [[ "$ACTION" == audit ]]; then
  if [[ -f "$PC_IMAGE_OVERRIDE" ]]; then
    AUDIT_DC=("${BASE_DC[@]}" -f "$PC_IMAGE_OVERRIDE")
    "${AUDIT_DC[@]}" config --quiet
    configured_images="$("${AUDIT_DC[@]}" config --images | sort -u)"
    printf 'IMAGE_OVERRIDE_PRESENT=1\n'
    printf 'CONFIGURED_IMAGES_BEGIN\n%s\nCONFIGURED_IMAGES_END\n' "$configured_images"
  else
    printf 'IMAGE_OVERRIDE_PRESENT=0\n'
  fi
  for id in "${watchtower_ids[@]}"; do
    printf 'WATCHTOWER=%s image=%s state=%s restart=%s\n' \
      "$id" \
      "$(docker inspect --format '{{.Config.Image}}' "$id")" \
      "$(docker inspect --format '{{.State.Status}}' "$id")" \
      "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$id")"
  done
  exit 0
fi

short_sha="${TARGET_SHA:0:7}"
exact_image="${IMAGE_REPOSITORY}:sha-${short_sha}"
docker pull "$exact_image"
pulled_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$exact_image" 2>/dev/null || true)"
[[ "$pulled_revision" == "$TARGET_SHA" ]] ||
  fail "exact image OCI revision mismatch: expected $TARGET_SHA, found ${pulled_revision:-missing}"

mapfile -t protected_other_ids < <(
  docker ps -q |
    grep -vx "$current_web_id" |
    while read -r id; do
      skip=0
      for watchtower_id in "${watchtower_ids[@]}"; do [[ "$id" == "$watchtower_id" ]] && skip=1; done
      if (( skip == 0 )); then printf '%s\n' "$id"; fi
    done |
    sort
)

deploy_started=0
container_mutation_started=0
legacy_parked=0
legacy_parked_name=''
watchtower_retired=0

rollback_on_error() {
  original_rc=$?
  trap - ERR
  if (( deploy_started == 1 )); then
    printf 'AUTOMATIC_ROLLBACK_ATTEMPTED=1\n'
    write_image_override "$current_image_ref"
    ROLLBACK_DC=("${BASE_DC[@]}" -f "$PC_IMAGE_OVERRIDE")
    "${ROLLBACK_DC[@]}" config --quiet

    rollback_id="$current_web_id"
    rollback_state="$current_state"
    rollback_revision="$current_revision"

    if (( container_mutation_started == 1 )); then
      if (( legacy_parked == 1 )); then
        compose_candidate="$("${ROLLBACK_DC[@]}" ps -q web 2>/dev/null || true)"
        if [[ -n "$compose_candidate" ]]; then docker rm -f "$compose_candidate" >/dev/null 2>&1 || true; fi
        docker rename "$current_web_id" "$current_name"
        if [[ "$(docker inspect --format '{{.State.Running}}' "$current_web_id")" != true ]]; then docker start "$current_web_id" >/dev/null; fi
        rollback_id="$current_web_id"
      else
        "${ROLLBACK_DC[@]}" up -d --no-deps --force-recreate --pull never web
        rollback_id="$("${ROLLBACK_DC[@]}" ps -q web)"
      fi
      rollback_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$rollback_id")"
      rollback_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$rollback_id" 2>/dev/null || true)"
    fi

    if [[ -n "$rollback_id" ]] &&
      [[ "$rollback_state" == healthy || "$rollback_state" == running ]] &&
      { [[ -z "$current_revision" ]] || [[ "$rollback_revision" == "$current_revision" ]]; }; then
      printf 'AUTOMATIC_ROLLBACK_COMPLETED=1\n'
      printf 'ROLLBACK_WEB_REVISION=%s\n' "${rollback_revision:-unknown}"
      printf 'LEGACY_CONTAINER_RESTORED=%s\n' "$legacy_parked"
      printf 'WATCHTOWER_REMAINS_RETIRED=%s\n' "$watchtower_retired"
    else
      printf 'AUTOMATIC_ROLLBACK_COMPLETED=0\n' >&2
      exit 90
    fi
  fi
  exit "$original_rc"
}
trap rollback_on_error ERR

deploy_started=1
write_image_override "$exact_image"
DC=("${BASE_DC[@]}" -f "$PC_IMAGE_OVERRIDE")
"${DC[@]}" config --quiet
configured_web_image="$(
  "${DC[@]}" config |
    awk '
      /^  web:$/ { in_web=1; next }
      in_web && /^  [^ ]/ { exit }
      in_web && /^    image:/ {
        sub(/^    image:[[:space:]]*/, "")
        gsub(/^["'\'']|["'\'']$/, "")
        print
        exit
      }
    '
)"
[[ "$configured_web_image" == "$exact_image" ]] ||
  fail "persistent Compose image authority mismatch: expected $exact_image, found ${configured_web_image:-missing}"
printf 'PERSISTED_WEB_IMAGE=%s\n' "$configured_web_image"
printf 'MUTATION_STARTED=1\n'

for id in "${watchtower_ids[@]}"; do
  docker update --restart=no "$id" >/dev/null
  if [[ "$(docker inspect --format '{{.State.Running}}' "$id")" == true ]]; then docker stop --time 30 "$id" >/dev/null; fi
done
for id in "${watchtower_ids[@]}"; do
  [[ "$(docker inspect --format '{{.State.Running}}' "$id")" != true ]] || fail "watchtower is still running: $id"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$id")" == no ]] ||
    fail "watchtower restart policy was not disabled for $id"
done
watchtower_retired=1
printf 'WATCHTOWER_QUIESCED_BEFORE_WEB=1\n'

container_mutation_started=1
if (( legacy_web == 1 )); then
  legacy_parked_name="${current_name}-pre-hardening-${short_sha}-$(date +%s)"
  docker rename "$current_web_id" "$legacy_parked_name"
  legacy_parked=1
  docker stop --time 30 "$current_web_id"
  printf 'LEGACY_WEB_PARKED=1\n'
  printf 'LEGACY_WEB_PARKED_NAME=%s\n' "$legacy_parked_name"
fi

"${DC[@]}" up -d --no-deps --force-recreate --pull never web

new_web_id=''
new_state='missing'
for attempt in $(seq 1 75); do
  new_web_id="$("${DC[@]}" ps -q web 2>/dev/null || true)"
  if [[ -n "$new_web_id" ]]; then
    new_state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$new_web_id")"
    printf 'HEALTH_ATTEMPT=%s STATE=%s\n' "$attempt" "$new_state"
    [[ "$new_state" == healthy ]] && break
    [[ "$new_state" == unhealthy || "$new_state" == exited || "$new_state" == dead ]] && break
  fi
  sleep 2
done
[[ -n "$new_web_id" && "$new_state" == healthy ]] || {
  "${DC[@]}" logs --tail=200 web || true
  fail "new web container did not become healthy; state=$new_state"
}

new_revision="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$new_web_id" 2>/dev/null || true)"
new_service_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$new_web_id" 2>/dev/null || true)"
new_project_label="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$new_web_id" 2>/dev/null || true)"
[[ "$new_revision" == "$TARGET_SHA" ]] || fail "running web revision mismatch: ${new_revision:-missing}"
[[ "$new_service_label" == web ]] || fail 'running web container lacks canonical Compose service label'
[[ -n "$new_project_label" ]] || fail 'running web container lacks canonical Compose project label'

PC_LIVE_BASE="${PC_LIVE_BASE:-https://xn----8sbjf4befbjgs9b.xn--p1ai}" \
  "$LIVE_ACCEPTANCE_SCRIPT" "$TARGET_SHA" "$ACTION"
printf 'INTERNAL_LIVE_ACCEPTANCE=PASS\n'

if (( legacy_parked == 1 )); then
  docker rm "$current_web_id" >/dev/null
  legacy_parked=0
  printf 'LEGACY_WEB_ADOPTED=1\n'
fi

for id in "${watchtower_ids[@]}"; do
  [[ "$(docker inspect --format '{{.State.Running}}' "$id")" != true ]] || fail "watchtower restarted unexpectedly: $id"
  [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$id")" == no ]] ||
    fail "watchtower restart policy drifted for $id"
done

mapfile -t after_other_ids < <(
  docker ps -q |
    grep -vx "$new_web_id" |
    while read -r id; do
      skip=0
      for watchtower_id in "${watchtower_ids[@]}"; do [[ "$id" == "$watchtower_id" ]] && skip=1; done
      if (( skip == 0 )); then printf '%s\n' "$id"; fi
    done |
    sort
)
[[ "${protected_other_ids[*]}" == "${after_other_ids[*]}" ]] ||
  fail 'a non-web, non-Watchtower production container changed'

trap - ERR
deploy_started=0
container_mutation_started=0

printf 'DEPLOYMENT_COMPLETE=1\n'
printf 'DEPLOYED_WEB_ID=%s\n' "$new_web_id"
printf 'DEPLOYED_WEB_REVISION=%s\n' "$new_revision"
printf 'DEPLOYED_WEB_STATE=%s\n' "$new_state"
printf 'DEPLOYED_COMPOSE_PROJECT=%s\n' "$new_project_label"
printf 'DEPLOYED_WEB_IMAGE=%s\n' "$exact_image"
printf 'ROLLBACK_BASELINE_IMAGE_ID=%s\n' "$current_image_id"
printf 'ROLLBACK_BASELINE_REVISION=%s\n' "${current_revision:-unknown}"
printf 'WATCHTOWER_RETIRED=1\n'
