#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-}"
TARGET_SHA="${2:-}"
RUN_ID="${3:-manual}"
PROD_DIR_B64="${PROD_DIR_B64:-}"
PROD_COMPOSE_B64="${PROD_COMPOSE_B64:-}"
PROD_PROJECT_B64="${PROD_PROJECT_B64:-}"

decode() {
  if [[ -n "$1" ]]; then printf '%s' "$1" | base64 -d; fi
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  return 1
}

reclaim_web_pull_space() {
  local current_web_id current_image_ref current_image_id short_sha target_image docker_root
  local image_ref image_id

  short_sha="${TARGET_SHA:0:7}"
  target_image="ghcr.io/pachaninm-lab/grainflow-web:sha-${short_sha}"

  mapfile -t running_web_ids < <(
    docker ps -q --no-trunc |
      while read -r id; do
        image="$(docker inspect --format '{{.Config.Image}}' "$id" 2>/dev/null || true)"
        if [[ "$image" == *grainflow-web* ]]; then printf '%s\n' "$id"; fi
      done
  )
  (( ${#running_web_ids[@]} == 1 )) ||
    fail "safe Docker reclaim requires exactly one running grainflow-web container; found ${#running_web_ids[@]}"

  current_web_id="${running_web_ids[0]}"
  current_image_ref="$(docker inspect --format '{{.Config.Image}}' "$current_web_id")"
  current_image_id="$(docker inspect --format '{{.Image}}' "$current_web_id")"
  docker_root="$(docker info --format '{{.DockerRootDir}}')"
  [[ -d "$docker_root" ]] || fail "Docker root directory is unavailable: $docker_root"

  printf 'DOCKER_RECLAIM_CURRENT_WEB_IMAGE=%s\n' "$current_image_ref"
  printf 'DOCKER_RECLAIM_TARGET_WEB_IMAGE=%s\n' "$target_image"
  printf 'DOCKER_RECLAIM_DISK_BEFORE_BEGIN\n'
  df -Pk "$docker_root"
  printf 'DOCKER_RECLAIM_DISK_BEFORE_END\n'

  # Only reclaim artifacts that cannot affect running services or persistent data.
  # Volumes, networks and containers are deliberately outside this bounded cleanup.
  docker image prune -f >/dev/null
  docker builder prune -f >/dev/null 2>&1 || true

  while IFS=' ' read -r image_ref image_id; do
    [[ -n "$image_ref" && -n "$image_id" ]] || continue
    [[ "$image_ref" == ghcr.io/pachaninm-lab/grainflow-web:sha-* ]] || continue

    if [[ "$image_ref" == "$current_image_ref" ||
          "$image_ref" == "$target_image" ||
          "$image_id" == "$current_image_id" ]]; then
      printf 'DOCKER_RECLAIM_PRESERVED_IMAGE=%s\n' "$image_ref"
      continue
    fi

    # Docker refuses this without --force when any container still references
    # the image. That refusal is intentional: rollback/forensic images in use
    # are preserved, while genuinely unused historical exact-SHA images go.
    if docker image rm "$image_ref" >/dev/null 2>&1; then
      printf 'DOCKER_RECLAIM_REMOVED_UNUSED_IMAGE=%s\n' "$image_ref"
    else
      printf 'DOCKER_RECLAIM_PRESERVED_REFERENCED_IMAGE=%s\n' "$image_ref"
    fi
  done < <(
    docker image ls ghcr.io/pachaninm-lab/grainflow-web \
      --no-trunc \
      --format '{{.Repository}}:{{.Tag}} {{.ID}}'
  )

  docker image prune -f >/dev/null
  printf 'DOCKER_RECLAIM_DISK_AFTER_BEGIN\n'
  df -Pk "$docker_root"
  printf 'DOCKER_RECLAIM_DISK_AFTER_END\n'
}

case "$ACTION" in
  audit) ;;
  deploy|rollback)
    [[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail 'target SHA must be a full lowercase 40-character Git SHA'
    ;;
  *) fail 'action must be audit, deploy or rollback' ;;
esac

prod_dir="$(decode "$PROD_DIR_B64")"
prod_compose="$(decode "$PROD_COMPOSE_B64")"
prod_project="$(decode "$PROD_PROJECT_B64")"
remote_script="/tmp/pc-production-web-exact-sha-${RUN_ID}.sh"
remote_live="/tmp/pc-production-web-live-acceptance-${RUN_ID}.sh"
remote_override="/tmp/pc-production-web-hardening-${RUN_ID}.yml"

[[ -f "$remote_script" ]] || fail 'release script is missing on the server'
[[ -f "$remote_live" ]] || fail 'live acceptance script is missing on the server'
[[ -f "$remote_override" ]] || fail 'hardening override is missing on the server'

if [[ -z "$prod_dir" || -z "$prod_compose" ]]; then
  mapfile -t compose_web_ids < <(docker ps -q --filter 'label=com.docker.compose.service=web')
  if (( ${#compose_web_ids[@]} == 1 )); then
    candidate_id="${compose_web_ids[0]}"
    candidate_dir="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$candidate_id" 2>/dev/null || true)"
    candidate_files="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$candidate_id" 2>/dev/null || true)"
    candidate_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$candidate_id" 2>/dev/null || true)"

    if [[ -n "$candidate_dir" && -n "$candidate_files" ]]; then
      protected_files=()
      IFS=',' read -r -a raw_candidate_files <<< "$candidate_files"
      for raw_file in "${raw_candidate_files[@]}"; do
        candidate_file="$(trim "$raw_file")"
        [[ -n "$candidate_file" ]] || continue
        if [[ "$candidate_file" != /* ]]; then candidate_file="${candidate_dir%/}/$candidate_file"; fi
        case "$candidate_file" in
          */compose.production-hardening.override.yml|*/compose.production-web-image.override.yml) ;;
          *) [[ -f "$candidate_file" ]] && protected_files+=("$candidate_file") ;;
        esac
      done
      if (( ${#protected_files[@]} >= 1 )); then
        prod_dir="$candidate_dir"
        prod_compose="$(IFS=','; printf '%s' "${protected_files[*]}")"
        [[ -n "$prod_project" ]] || prod_project="$candidate_project"
      fi
    fi
  fi
fi

if [[ -z "$prod_dir" || -z "$prod_compose" ]]; then
  candidates=()
  while IFS= read -r candidate; do
    candidate_dir="$(dirname "$candidate")"
    if docker compose --project-directory "$candidate_dir" -f "$candidate" config --services 2>/dev/null | grep -qx web &&
      docker compose --project-directory "$candidate_dir" -f "$candidate" config --images 2>/dev/null | grep -q 'grainflow-web'; then
      candidates+=("$candidate")
    fi
  done < <(
    find /opt /srv /root /home -maxdepth 6 -type f \
      \( -name 'compose*.yml' -o -name 'compose*.yaml' -o -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \) \
      -readable 2>/dev/null |
      grep -Ev '/compose\.production-(hardening|web-image)\.override\.yml$' |
      sort -u
  )
  (( ${#candidates[@]} == 1 )) || fail "unable to resolve one production Compose authority; candidates=${#candidates[@]}"
  prod_compose="${candidates[0]}"
  prod_dir="$(dirname "$prod_compose")"
fi

[[ -d "$prod_dir" ]] || fail 'resolved production directory is invalid'
IFS=',' read -r -a resolved_files <<< "$prod_compose"
resolved_count=0
for raw_file in "${resolved_files[@]}"; do
  resolved_file="$(trim "$raw_file")"
  [[ -n "$resolved_file" ]] || continue
  if [[ "$resolved_file" != /* ]]; then resolved_file="${prod_dir%/}/$resolved_file"; fi
  [[ -f "$resolved_file" ]] || fail "resolved production Compose file is invalid: $resolved_file"
  resolved_count=$((resolved_count + 1))
done
(( resolved_count >= 1 )) || fail 'no protected production Compose files were resolved'

chmod 0700 "$remote_script" "$remote_live"

if [[ "$ACTION" == audit ]]; then
  active_hardening_override="$remote_override"
  printf 'PERSISTENT_OVERRIDE_MUTATED=0\n'
else
  active_hardening_override="${prod_dir%/}/compose.production-hardening.override.yml"
  install -m 0644 "$remote_override" "$active_hardening_override"
  printf 'PERSISTENT_OVERRIDE_MUTATED=1\n'
  reclaim_web_pull_space
fi

image_override="${prod_dir%/}/compose.production-web-image.override.yml"
printf 'RESOLVED_PROTECTED_COMPOSE_COUNT=%s\n' "$resolved_count"

PC_PROD_DIR="$prod_dir" \
PC_PROD_COMPOSE="$prod_compose" \
PC_PROD_PROJECT="$prod_project" \
PC_HARDENING_OVERRIDE="$active_hardening_override" \
PC_IMAGE_OVERRIDE="$image_override" \
PC_LIVE_ACCEPTANCE_SCRIPT="$remote_live" \
  "$remote_script" "$ACTION" "$TARGET_SHA"
