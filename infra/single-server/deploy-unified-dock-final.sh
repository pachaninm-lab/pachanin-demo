#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_SHA='65044bedca8894f09e8be32926315483fc115528'
IMAGE_BASE='ghcr.io/pachaninm-lab/grainflow-web'
TARGET_IMAGE="${IMAGE_BASE}:sha-${TARGET_SHA:0:12}"
LIVE_BASE='https://xn----8sbjf4befbjgs9b.xn--p1ai'

mapfile -t WEB_IDS < <(docker ps -q --filter 'label=com.docker.compose.service=web')
(( ${#WEB_IDS[@]} == 1 )) || { echo "ERROR: expected one running web container, found ${#WEB_IDS[@]}" >&2; exit 10; }

WEB_ID="${WEB_IDS[0]}"
PROJECT="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$WEB_ID")"
WORKDIR="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$WEB_ID")"
CONFIG_FILES="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$WEB_ID")"
OLD_IMAGE_ID="$(docker inspect --format '{{ .Image }}' "$WEB_ID")"
OLD_REV="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$WEB_ID" 2>/dev/null || true)"
ROLLBACK_TAG="${IMAGE_BASE}:rollback-ui-${OLD_REV:-unknown}-$(date -u +%Y%m%dT%H%M%SZ)"

IFS=',' read -r -a RAW_CONFIGS <<< "$CONFIG_FILES"
DC=(docker compose --project-name "$PROJECT")
for cfg in "${RAW_CONFIGS[@]}"; do
  cfg="${cfg#"${cfg%%[![:space:]]*}"}"
  cfg="${cfg%"${cfg##*[![:space:]]}"}"
  [[ "$cfg" = /* ]] || cfg="$WORKDIR/$cfg"
  [[ -f "$cfg" ]] || { echo "ERROR: Compose file not found: $cfg" >&2; exit 11; }
  DC+=(-f "$cfg")
done

cd "$WORKDIR"
"${DC[@]}" config --services | grep -qx web

docker image tag "$OLD_IMAGE_ID" "$ROLLBACK_TAG"

repair_network() {
  local web_id caddy_id
  web_id="$("${DC[@]}" ps -q web 2>/dev/null || true)"
  caddy_id="$(docker ps -q --filter name=grainflow-caddy-1 | head -n1)"
  if docker network inspect grainflow-dev >/dev/null 2>&1; then
    [[ -z "$web_id" ]] || docker network connect grainflow-dev "$web_id" >/dev/null 2>&1 || true
    [[ -z "$caddy_id" ]] || docker network connect grainflow-dev "$caddy_id" >/dev/null 2>&1 || true
  fi
  [[ -z "$caddy_id" ]] || docker restart "$caddy_id" >/dev/null
}

rollback() {
  echo '=== AUTOMATIC ROLLBACK ==='
  docker image tag "$ROLLBACK_TAG" "${IMAGE_BASE}:single-server" || true
  "${DC[@]}" up -d --no-deps --force-recreate --no-build --pull never web || true
  repair_network || true
  echo "Restored revision: ${OLD_REV:-unknown}"
}
trap rollback ERR

echo "Current revision: ${OLD_REV:-missing}"
echo "Target revision:  ${TARGET_SHA}"
docker pull "$TARGET_IMAGE"
PULLED_REV="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$TARGET_IMAGE")"
test "$PULLED_REV" = "$TARGET_SHA"
docker image tag "$TARGET_IMAGE" "${IMAGE_BASE}:single-server"
"${DC[@]}" up -d --no-deps --force-recreate --no-build --pull never web
repair_network

NEW_WEB_ID="$("${DC[@]}" ps -q web)"
NEW_REV=''
STATE='missing'
for attempt in $(seq 1 30); do
  NEW_REV="$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$NEW_WEB_ID" 2>/dev/null || true)"
  STATE="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$NEW_WEB_ID" 2>/dev/null || true)"
  [[ "$NEW_REV" == "$TARGET_SHA" && ( "$STATE" == 'running' || "$STATE" == 'healthy' ) ]] && break
  sleep 2
done
test "$NEW_REV" = "$TARGET_SHA"
[[ "$STATE" == 'running' || "$STATE" == 'healthy' ]]

LIVE_OK=0
for attempt in $(seq 1 30); do
  cache="${TARGET_SHA:0:12}-${attempt}-$(date +%s)"
  code="$(curl -ksS -o /tmp/pc-home.html -w '%{http_code}' --max-time 20 "${LIVE_BASE}/platform-v7?release=${cache}" || true)"
  marker="$(curl -ksS --max-time 20 "${LIVE_BASE}/single-server-ui-release.json?release=${cache}" || true)"
  if [[ "$code" == '200' ]] && grep -Fq 'Сделка под' /tmp/pc-home.html && grep -Fq 'single-server-unified-dock-v1' <<< "$marker" && grep -Fq 'Позвонить' <<< "$marker"; then
    LIVE_OK=1
    break
  fi
  sleep 3
done
test "$LIVE_OK" = '1'

for path in /platform-v7 /platform-v7/login /platform-v7/forgot-password; do
  code="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 20 "${LIVE_BASE}${path}?release=${TARGET_SHA:0:12}-$(date +%s)")"
  echo "$path -> HTTP $code"
  test "$code" = '200'
done

trap - ERR
echo '=== FINISH ==='
echo "image=${IMAGE_BASE}:single-server"
echo "revision=${NEW_REV}"
echo "status=${STATE}"
echo "rollback=${ROLLBACK_TAG}"
