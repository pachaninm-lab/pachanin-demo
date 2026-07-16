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
kubectl apply -f infra/kind/production-like/calico-runtime-database-deny.yaml \
  > "$K8S_DIR/calico-runtime-database-deny-apply.log" 2>&1

test "$(kubectl get service pgbouncer -n "$NAMESPACE" -o json | jq -r '[.spec.ports[].port] | join(":")')" = "6432"
test "$(kubectl get networkpolicy api-to-pgbouncer -n "$NAMESPACE" -o json | jq -r '[.spec.egress[].ports[].port] | join(":")')" = "6432"
test "$(kubectl get networkpolicy worker-to-pgbouncer -n "$NAMESPACE" -o json | jq -r '[.spec.egress[].ports[].port] | join(":")')" = "6432"
test "$(kubectl get networkpolicy pgbouncer-ingress-egress -n "$NAMESPACE" -o json | jq -r '[.spec.ingress[].ports[].port] | join(":")')" = "6432"
test "$(kubectl get networkpolicy.projectcalico.org deny-runtime-direct-postgresql -n "$NAMESPACE" -o jsonpath='{.spec.order}')" = "10"
test "$(kubectl get networkpolicy.projectcalico.org deny-runtime-direct-postgresql -n "$NAMESPACE" -o jsonpath='{.spec.egress[0].action}')" = "Deny"
test "$(kubectl get networkpolicy.projectcalico.org deny-runtime-direct-postgresql -n "$NAMESPACE" -o jsonpath='{.spec.egress[0].destination.ports[0]}')" = "5432"

kubectl get networkpolicy.projectcalico.org deny-runtime-direct-postgresql -n "$NAMESPACE" -o json \
  > "$K8S_DIR/cluster/calico-runtime-database-deny.json"

kubectl create configmap grainflow-pgbouncer-config -n "$NAMESPACE" \
  --from-file=pgbouncer.ini=infra/kind/production-like/pgbouncer.ini \
  --dry-run=client -o yaml | kubectl apply -f - \
  > "$K8S_DIR/pgbouncer-config-apply.log"
kubectl rollout restart -n "$NAMESPACE" deployment/pgbouncer \
  > "$K8S_DIR/pgbouncer-rollout-restart.log"
kubectl rollout status -n "$NAMESPACE" deployment/pgbouncer --timeout=300s
