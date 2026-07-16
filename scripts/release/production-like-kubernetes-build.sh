#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

EXACT_HEAD="${EXACT_HEAD:?EXACT_HEAD is required}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness}"
K8S_DIR="$EVIDENCE_DIR/kubernetes"
NAMESPACE="grainflow-acceptance"
RELEASE_NAME="grainflow"
CLUSTER_NAME="grainflow-acceptance"
REGISTRY_NAME="kind-registry"
REGISTRY_PORT="5001"
REGISTRY="localhost:${REGISTRY_PORT}"
STARTED_EPOCH="$(date +%s)"
RESULT="failed"
FAILURE_REASON="acceptance did not complete"
MIGRATION_EXECUTIONS=0
API_PROBE_FAILURES=999
WEB_PROBE_FAILURES=999
WORKER_MIN_READY=0
NETWORK_DENIAL_PROVEN=false
ROLLBACK_MATCH=false
ROLLOUT_MATCH=false
INITIAL_MATCH=false

mkdir -p "$K8S_DIR"/{build-initial,build-update,rendered,logs,cluster,external-manifests}
printf '%s\n' "$EXACT_HEAD" > "$K8S_DIR/exact-head.txt"
date -u +%Y-%m-%dT%H:%M:%SZ > "$K8S_DIR/started-at.txt"

for command in docker kind kubectl helm node jq curl openssl sha256sum; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 2; }
done
if [[ ! "$EXACT_HEAD" =~ ^[0-9a-f]{40}$ ]]; then
  echo "EXACT_HEAD must be a lowercase full Git SHA" >&2
  exit 2
fi
test "$(git rev-parse HEAD)" = "$EXACT_HEAD"

mask() {
  printf '::add-mask::%s\n' "$1"
}

collect_cluster_evidence() {
  set +e
  if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    kubectl version -o yaml > "$K8S_DIR/cluster/kubectl-version.yaml" 2>&1
    kubectl get nodes -o wide > "$K8S_DIR/cluster/nodes.txt" 2>&1
    kubectl get nodes -o json > "$K8S_DIR/cluster/nodes.json" 2>&1
    kubectl get pods -A -o wide > "$K8S_DIR/cluster/pods-all.txt" 2>&1
    kubectl get all,pdb,networkpolicy,ingress,configmap -n "$NAMESPACE" -o yaml > "$K8S_DIR/cluster/accepted-resources.yaml" 2>&1
    kubectl get events -A --sort-by=.lastTimestamp > "$K8S_DIR/cluster/events.txt" 2>&1
    kubectl describe deployment,statefulset,daemonset,job -n "$NAMESPACE" > "$K8S_DIR/cluster/workload-descriptions.txt" 2>&1
    for selector in \
      'app.kubernetes.io/name=grainflow-api' \
      'app.kubernetes.io/name=grainflow-web' \
      'app.kubernetes.io/name=grainflow-outbox-worker' \
      'app.kubernetes.io/name=postgresql' \
      'app.kubernetes.io/name=kafka' \
      'app.kubernetes.io/name=minio' \
      'app.kubernetes.io/name=prometheus' \
      'app.kubernetes.io/name=otel-collector'; do
      safe="${selector##*=}"
      kubectl logs -n "$NAMESPACE" -l "$selector" --all-containers=true --prefix=true --tail=400 \
        > "$K8S_DIR/logs/${safe}.log" 2>&1 || true
    done
    kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --all-containers=true --tail=300 \
      > "$K8S_DIR/logs/ingress-nginx.log" 2>&1 || true
  fi
  set -e
}

write_evidence() {
  local exit_status="$1"
  local ended_epoch
  ended_epoch="$(date +%s)"
  collect_cluster_evidence
  EVIDENCE_DIR="$EVIDENCE_DIR" \
  EXACT_HEAD="$EXACT_HEAD" \
  RESULT="$RESULT" \
  FAILURE_REASON="$FAILURE_REASON" \
  EXIT_STATUS="$exit_status" \
  ENDED_EPOCH="$ended_epoch" \
  STARTED_EPOCH="$STARTED_EPOCH" \
  MIGRATION_EXECUTIONS="$MIGRATION_EXECUTIONS" \
  API_PROBE_FAILURES="$API_PROBE_FAILURES" \
  WEB_PROBE_FAILURES="$WEB_PROBE_FAILURES" \
  WORKER_MIN_READY="$WORKER_MIN_READY" \
  NETWORK_DENIAL_PROVEN="$NETWORK_DENIAL_PROVEN" \
  INITIAL_MATCH="$INITIAL_MATCH" \
  ROLLOUT_MATCH="$ROLLOUT_MATCH" \
  ROLLBACK_MATCH="$ROLLBACK_MATCH" \
  node scripts/release/build-production-like-kubernetes-evidence.mjs
}

on_exit() {
  local status=$?
  trap - EXIT
  if [[ "$status" -ne 0 ]]; then
    FAILURE_REASON="${FAILURE_REASON:-command failed with exit ${status}}"
  fi
  write_evidence "$status" || true
  exit "$status"
}
trap on_exit EXIT

docker version --format '{{.Server.Version}}' | tee "$K8S_DIR/docker-version.txt"
kind version | tee "$K8S_DIR/kind-version.txt"
kubectl version --client -o yaml | awk '/gitVersion:/ {print $2; exit}' | tee "$K8S_DIR/kubectl-client-version.txt"
helm version --short | tee "$K8S_DIR/helm-version.txt"
node --version | tee "$K8S_DIR/node-version.txt"

if docker inspect "$REGISTRY_NAME" >/dev/null 2>&1; then
  docker rm -f "$REGISTRY_NAME" >/dev/null
fi
docker run -d --restart=always -p "127.0.0.1:${REGISTRY_PORT}:5000" --name "$REGISTRY_NAME" registry:2.8.3 \
  > "$K8S_DIR/registry-container-id.txt"

migration_set="sha256:$(find apps/api/prisma -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
printf '%s\n' "$migration_set" > "$K8S_DIR/migration-set-digest.txt"

push_component() {
  local component="$1"
  local local_component="$2"
  local label="$3"
  local build_dir="$4"
  local local_image="prozrachnaya-cena-${local_component}:release-${EXACT_HEAD}"
  local remote_repository="${REGISTRY}/prozrachnaya-cena-${local_component}"
  local remote_image="${remote_repository}:${label}-${EXACT_HEAD}"
  docker tag "$local_image" "$remote_image"
  docker push "$remote_image" 2>&1 | tee "$build_dir/push-${component}.log"
  local digest
  digest="$(grep -Eo 'digest: sha256:[0-9a-f]{64}' "$build_dir/push-${component}.log" | tail -1 | awk '{print $2}')"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "No registry digest for ${component}" >&2; return 1; }
  printf '%s\n' "$digest" > "$build_dir/${component}-registry-digest.txt"
}

build_release() {
  local label="$1"
  local build_dir="$2"
  local manifest_path="$3"
  bash scripts/release/build-exact-head-images.sh "$EXACT_HEAD" "$build_dir"
  push_component api api "$label" "$build_dir"
  push_component web web "$label" "$build_dir"
  push_component outboxWorker outbox-worker "$label" "$build_dir"
  push_component migration migration "$label" "$build_dir"
  node scripts/release/build-immutable-release-manifest.mjs \
    --source-commit "$EXACT_HEAD" \
    --created-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --migration-set-digest "$migration_set" \
    --api-repository "${REGISTRY}/prozrachnaya-cena-api" \
    --web-repository "${REGISTRY}/prozrachnaya-cena-web" \
    --worker-repository "${REGISTRY}/prozrachnaya-cena-outbox-worker" \
    --migration-repository "${REGISTRY}/prozrachnaya-cena-migration" \
    --api-digest "$(cat "$build_dir/api-registry-digest.txt")" \
    --web-digest "$(cat "$build_dir/web-registry-digest.txt")" \
    --worker-digest "$(cat "$build_dir/outboxWorker-registry-digest.txt")" \
    --migration-digest "$(cat "$build_dir/migration-registry-digest.txt")" \
    --output "$manifest_path" \
    | tee "${manifest_path%.json}-id.txt"
  node scripts/release/validate-immutable-release.mjs "$manifest_path" \
    | tee "${manifest_path%.json}-validation.json"
}

FAILURE_REASON="exact-head image build or registry publication failed"
build_release initial "$K8S_DIR/build-initial" "$K8S_DIR/initial-release-manifest.json"
sleep 2
build_release update "$K8S_DIR/build-update" "$K8S_DIR/update-release-manifest.json"

node scripts/release/build-immutable-rollback.mjs \
  --current "$K8S_DIR/update-release-manifest.json" \
  --target "$K8S_DIR/initial-release-manifest.json" \
  --created-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --output "$K8S_DIR/rollback.json" \
  | tee "$K8S_DIR/rollback-id.txt"
node scripts/release/validate-immutable-release.mjs "$K8S_DIR/rollback.json" \
  | tee "$K8S_DIR/rollback-validation.json"

FAILURE_REASON="default Helm render is not fail closed"
helm lint infra/helm/grainflow | tee "$K8S_DIR/helm-lint.txt"
helm template "$RELEASE_NAME" infra/helm/grainflow > "$K8S_DIR/rendered/default.yaml"
default_workloads="$(grep -Ec '^kind: (Deployment|StatefulSet|DaemonSet|Job|CronJob)$' "$K8S_DIR/rendered/default.yaml" || true)"
test "$default_workloads" = "0"
printf '%s\n' "$default_workloads" > "$K8S_DIR/default-executable-workloads.txt"

patch_rendered_api_object_storage() {
  local rendered_file="$1"
  local split_dir output_file matched doc
  split_dir="$(mktemp -d)"
  output_file="${rendered_file}.patched"
  matched=0

  awk -v dir="$split_dir" '
    BEGIN { document = 0 }
    /^---[[:space:]]*$/ { document += 1; next }
    { print > sprintf("%s/document-%04d.yaml", dir, document) }
  ' "$rendered_file"

  : > "$output_file"
  for doc in "$split_dir"/document-*.yaml; do
    [[ -s "$doc" ]] || continue
    if grep -qx 'kind: Deployment' "$doc" && grep -qx '  name: grainflow-api' "$doc"; then
      kubectl patch --local=true -f "$doc" --type=json \
        --patch-file infra/kind/production-like/api-object-storage-ca-patch.json \
        -o yaml >> "$output_file"
      matched=$((matched + 1))
    else
      cat "$doc" >> "$output_file"
    fi
    printf '\n---\n' >> "$output_file"
  done

  rm -rf "$split_dir"
  test "$matched" = "1"
  mv "$output_file" "$rendered_file"
  test "$(grep -c 'name: grainflow-object-storage-secrets' "$rendered_file")" = "1"
  test "$(grep -c 'mountPath: /var/run/grainflow-ca' "$rendered_file")" = "1"
  test "$(grep -c 'secretName: grainflow-minio-tls' "$rendered_file")" = "1"
}

render_release() {
  local document="$1"
  local phase="$2"
  local prefix="$3"
  node scripts/release/render-immutable-release-values.mjs \
    --document "$document" \
    --environment production-like \
    --output "$K8S_DIR/rendered/${prefix}-values.yaml"
  if [[ "$phase" = migration ]]; then
    helm template "$RELEASE_NAME" infra/helm/grainflow \
      -f "$K8S_DIR/rendered/${prefix}-values.yaml" \
      -f infra/kind/production-like/acceptance-values.yaml \
      --show-only templates/migration-job.yaml \
      > "$K8S_DIR/rendered/${prefix}-migration.yaml"
  else
    : > "$K8S_DIR/rendered/${prefix}-workloads.yaml"
    for template in templates/api-deployment.yaml templates/web-deployment.yaml templates/outbox-worker-deployment.yaml; do
      helm template "$RELEASE_NAME" infra/helm/grainflow \
        -f "$K8S_DIR/rendered/${prefix}-values.yaml" \
        -f infra/kind/production-like/acceptance-values.yaml \
        --show-only "$template" \
        >> "$K8S_DIR/rendered/${prefix}-workloads.yaml"
      printf '\n---\n' >> "$K8S_DIR/rendered/${prefix}-workloads.yaml"
    done
    patch_rendered_api_object_storage "$K8S_DIR/rendered/${prefix}-workloads.yaml"
  fi
}

render_release "$K8S_DIR/initial-release-manifest.json" migration initial
render_release "$K8S_DIR/initial-release-manifest.json" workloads initial
render_release "$K8S_DIR/update-release-manifest.json" workloads update
render_release "$K8S_DIR/rollback.json" workloads rollback

for rendered in initial-migration initial-workloads update-workloads rollback-workloads; do
  grep -Eq '@sha256:[0-9a-f]{64}' "$K8S_DIR/rendered/${rendered}.yaml"
  ! grep -E 'image: .*:(latest|main|master|dev|prod)$' "$K8S_DIR/rendered/${rendered}.yaml"
done

# Both immutable digest sets are now durable in the local registry container.
# Remove only host-side build cache and unreferenced image material before kind
# creates node filesystems; otherwise duplicate exact-head builds can exhaust the
# GitHub runner and surface as containerd "no space left on device" failures.
FAILURE_REASON="runner disk reclaim after immutable publication failed"
df -h > "$K8S_DIR/runner-disk-before-reclaim.txt"
docker system df -v > "$K8S_DIR/docker-system-before-reclaim.txt"
docker builder prune --all --force > "$K8S_DIR/docker-builder-prune.log"
docker image prune --all --force > "$K8S_DIR/docker-image-prune.log"
docker system df -v > "$K8S_DIR/docker-system-after-reclaim.txt"
df -h > "$K8S_DIR/runner-disk-after-reclaim.txt"
available_kb="$(df --output=avail -k / | tail -n 1 | tr -d ' ')"
printf '%s\n' "$available_kb" > "$K8S_DIR/runner-root-available-kb.txt"
test "$available_kb" -ge 8388608
