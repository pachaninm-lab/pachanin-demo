#!/usr/bin/env bash
set -Eeuo pipefail

EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness}"
K8S_DIR="$EVIDENCE_DIR/kubernetes"
mkdir -p "$K8S_DIR"

# Both exact-head release sets are already published to the local OCI registry
# and bound by registry digests before this script runs. Local image tags and
# BuildKit cache are no longer release authority. Reclaim them before kind
# duplicates image layers across its node containers.
docker system df -v > "$K8S_DIR/docker-system-df-before-post-build-prune.txt"

if docker buildx version >/dev/null 2>&1; then
  docker buildx prune --all --force \
    > "$K8S_DIR/docker-buildx-prune.log" 2>&1
else
  docker builder prune --all --force \
    > "$K8S_DIR/docker-builder-prune.log" 2>&1
fi

docker image prune --all --force \
  > "$K8S_DIR/docker-image-prune.log" 2>&1

docker system df -v > "$K8S_DIR/docker-system-df-after-post-build-prune.txt"
df -h > "$K8S_DIR/host-disk-after-post-build-prune.txt"
