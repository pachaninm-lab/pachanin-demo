#!/usr/bin/env bash
set -Eeuo pipefail

EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness}"
K8S_DIR="$EVIDENCE_DIR/kubernetes"
mkdir -p "$K8S_DIR"

# Both exact-head release sets are already published to the local OCI registry
# and bound by registry digests before this script runs. Local image tags and
# BuildKit cache are no longer release authority. Reclaim them before kind
# duplicates image layers across its node containers.
df -h > "$K8S_DIR/runner-disk-before-reclaim.txt"
docker system df -v > "$K8S_DIR/docker-system-before-reclaim.txt"

if docker buildx version >/dev/null 2>&1; then
  docker buildx prune --all --force \
    > "$K8S_DIR/docker-buildx-prune.log" 2>&1
else
  docker builder prune --all --force \
    > "$K8S_DIR/docker-builder-prune.log" 2>&1
fi

docker image prune --all --force \
  > "$K8S_DIR/docker-image-prune.log" 2>&1

docker system df -v > "$K8S_DIR/docker-system-after-reclaim.txt"
df -h > "$K8S_DIR/runner-disk-after-reclaim.txt"
available_kb="$(df --output=avail -k / | tail -n 1 | tr -d ' ')"
printf '%s\n' "$available_kb" > "$K8S_DIR/runner-root-available-kb.txt"

# Fail before kind creation instead of allowing containerd or etcd to corrupt
# the acceptance signal with a later ENOSPC cascade.
test "$available_kb" -ge 8388608
