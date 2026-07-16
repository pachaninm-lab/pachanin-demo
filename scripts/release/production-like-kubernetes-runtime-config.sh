FAILURE_REASON="production-like runtime configuration failed"

# Bootstrap services exist only until migrations and the first PgBouncer
# connectivity proof finish. Before application workloads start, PostgreSQL is
# made headless and PgBouncer loses its compatibility port 5432. Runtime clients
# then use only 6432, so the PostgreSQL and pooler routes cannot overlap.
kubectl delete service postgresql -n "$NAMESPACE" --wait=true \
  > "$K8S_DIR/postgresql-clusterip-service-delete.log"
kubectl apply -f infra/kind/production-like/postgresql-headless-service.yaml \
  > "$K8S_DIR/postgresql-headless-service-apply.log"
test "$(kubectl get service postgresql -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')" = "None"

rewrite_database_urls() {
  local secret_name="$1"
  local temporary_file
  temporary_file="$(mktemp)"
  kubectl get secret "$secret_name" -n "$NAMESPACE" -o json | \
    jq '
      del(
        .metadata.creationTimestamp,
        .metadata.managedFields,
        .metadata.resourceVersion,
        .metadata.uid
      )
      | .data |= with_entries(
          if (.key | test("DATABASE_URL$")) then
            .value |= (@base64d | gsub("@pgbouncer:5432/"; "@pgbouncer:6432/") | @base64)
          else
            .
          end
        )
    ' > "$temporary_file"
  kubectl apply -f "$temporary_file" \
    > "$K8S_DIR/${secret_name}-runtime-port-rewrite.log"
  rm -f "$temporary_file"
}

rewrite_database_urls grainflow-api-secrets
rewrite_database_urls grainflow-outbox-worker-secrets

kubectl apply -f infra/kind/production-like/pgbouncer-runtime-service.yaml \
  > "$K8S_DIR/pgbouncer-runtime-service-apply.log"
kubectl apply -f infra/kind/production-like/pgbouncer-runtime-network-policy.yaml \
  > "$K8S_DIR/pgbouncer-runtime-network-policy-apply.log"

# The manifest-only Calico installation exposes its internal CRDs but not the
# aggregated projectcalico.org/v3 API. Use the matching official calicoctl image
# so defaulting, validation and v3-to-datastore conversion are not bypassed.
CALICOCTL_IMAGE_TAG="calico/ctl:v3.28.2"
docker pull "$CALICOCTL_IMAGE_TAG" > "$K8S_DIR/calicoctl-image-pull.log" 2>&1
CALICOCTL_IMAGE_DIGEST="$(
  docker image inspect "$CALICOCTL_IMAGE_TAG" \
    --format '{{range .RepoDigests}}{{println .}}{{end}}' | awk '/@sha256:/{print; exit}'
)"
test -n "$CALICOCTL_IMAGE_DIGEST"
printf '%s\n' "$CALICOCTL_IMAGE_DIGEST" > "$K8S_DIR/cluster/calicoctl-image-digest.txt"

KUBECONFIG_PATH="$(readlink -f "${KUBECONFIG:-$HOME/.kube/config}")"
test -f "$KUBECONFIG_PATH"
run_calicoctl() {
  docker run --rm --network host \
    --volume "${KUBECONFIG_PATH}:/root/.kube/config:ro" \
    --env DATASTORE_TYPE=kubernetes \
    "$CALICOCTL_IMAGE_DIGEST" "$@"
}

run_calicoctl version > "$K8S_DIR/calicoctl-version.txt" 2>&1
run_calicoctl apply -f infra/kind/production-like/calico-runtime-database-deny.yaml \
  > "$K8S_DIR/calico-runtime-database-deny-apply.log" 2>&1
run_calicoctl get networkpolicy deny-runtime-direct-postgresql \
  --namespace "$NAMESPACE" --output json \
  > "$K8S_DIR/cluster/calico-runtime-database-deny-v3.json"

test "$(jq -r '.apiVersion' "$K8S_DIR/cluster/calico-runtime-database-deny-v3.json")" = "projectcalico.org/v3"
test "$(jq -r '.spec.tier' "$K8S_DIR/cluster/calico-runtime-database-deny-v3.json")" = "default"
test "$(jq -r '.spec.order' "$K8S_DIR/cluster/calico-runtime-database-deny-v3.json")" = "10"
test "$(jq -r '.spec.egress[0].action' "$K8S_DIR/cluster/calico-runtime-database-deny-v3.json")" = "Deny"
test "$(jq -r '.spec.egress[0].destination.ports[0]' "$K8S_DIR/cluster/calico-runtime-database-deny-v3.json")" = "5432"

test "$(kubectl get service pgbouncer -n "$NAMESPACE" -o json | jq -r '[.spec.ports[].port] | join(":")')" = "6432"
test "$(kubectl get networkpolicy api-to-pgbouncer -n "$NAMESPACE" -o json | jq -r '[.spec.egress[].ports[].port] | join(":")')" = "6432"
test "$(kubectl get networkpolicy worker-to-pgbouncer -n "$NAMESPACE" -o json | jq -r '[.spec.egress[].ports[].port] | join(":")')" = "6432"
test "$(kubectl get networkpolicy pgbouncer-ingress-egress -n "$NAMESPACE" -o json | jq -r '[.spec.ingress[].ports[].port] | join(":")')" = "6432"

kubectl create configmap grainflow-pgbouncer-config -n "$NAMESPACE" \
  --from-file=pgbouncer.ini=infra/kind/production-like/pgbouncer.ini \
  --dry-run=client -o yaml | kubectl apply -f - \
  > "$K8S_DIR/pgbouncer-config-apply.log"
kubectl rollout restart -n "$NAMESPACE" deployment/pgbouncer \
  > "$K8S_DIR/pgbouncer-rollout-restart.log"
kubectl rollout status -n "$NAMESPACE" deployment/pgbouncer --timeout=300s
