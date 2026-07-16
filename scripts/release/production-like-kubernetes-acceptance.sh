#!/usr/bin/env bash
set -Eeuo pipefail

source scripts/release/production-like-kubernetes-build.sh
node scripts/release/production-like-kubernetes-migration-runtime.mjs
source scripts/release/production-like-kubernetes-evidence-collection.sh
source scripts/release/production-like-kubernetes-cluster.sh
source scripts/release/production-like-kubernetes-object-storage.sh

patch_web_hardening() {
  patch_api_object_storage
  kubectl patch deployment grainflow-web -n "$NAMESPACE" --type=json \
    --patch-file infra/kind/production-like/web-runtime-hardening-patch.json \
    > "$K8S_DIR/web-runtime-hardening-patch.log" 2>&1
  kubectl apply -f infra/kind/production-like/api-ingress.yaml \
    > "$K8S_DIR/api-ingress-apply.log"
  kubectl apply -f infra/kind/production-like/web-health-ingress.yaml \
    > "$K8S_DIR/web-health-ingress-apply.log"
}

source scripts/release/production-like-kubernetes-pgbouncer.sh
source scripts/release/production-like-kubernetes-runtime-config.sh
source scripts/release/production-like-kubernetes-pgbouncer-evidence.sh
source scripts/release/production-like-kubernetes-verify.sh
