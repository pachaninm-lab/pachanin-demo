#!/usr/bin/env bash
set -Eeuo pipefail

source scripts/release/production-like-kubernetes-build.sh
node scripts/release/production-like-kubernetes-migration-runtime.mjs
source scripts/release/production-like-kubernetes-evidence-collection.sh
source scripts/release/production-like-kubernetes-cluster.sh

patch_web_hardening() {
  kubectl patch deployment grainflow-web -n "$NAMESPACE" --type=strategic \
    --patch-file infra/kind/production-like/web-runtime-hardening-patch.yaml \
    > "$K8S_DIR/web-runtime-hardening-patch.log"
  kubectl apply -f infra/kind/production-like/api-ingress.yaml \
    > "$K8S_DIR/api-ingress-apply.log"
}

source scripts/release/production-like-kubernetes-pgbouncer.sh
source scripts/release/production-like-kubernetes-pgbouncer-evidence.sh
source scripts/release/production-like-kubernetes-verify.sh
