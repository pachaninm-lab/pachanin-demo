FAILURE_REASON="production-like runtime configuration failed"

# The bootstrap ClusterIP is needed only until migrations and the first PgBouncer
# connectivity proof finish. Before application workloads start, replace it with
# a headless Service so NetworkPolicy selectors are evaluated against the actual
# PostgreSQL pod endpoint rather than implementation-dependent Service DNAT.
kubectl delete service postgresql -n "$NAMESPACE" --wait=true \
  > "$K8S_DIR/postgresql-clusterip-service-delete.log"
kubectl apply -f infra/kind/production-like/postgresql-headless-service.yaml \
  > "$K8S_DIR/postgresql-headless-service-apply.log"
test "$(kubectl get service postgresql -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')" = "None"

kubectl create configmap grainflow-pgbouncer-config -n "$NAMESPACE" \
  --from-file=pgbouncer.ini=infra/kind/production-like/pgbouncer.ini \
  --dry-run=client -o yaml | kubectl apply -f - \
  > "$K8S_DIR/pgbouncer-config-apply.log"
kubectl rollout restart -n "$NAMESPACE" deployment/pgbouncer \
  > "$K8S_DIR/pgbouncer-rollout-restart.log"
kubectl rollout status -n "$NAMESPACE" deployment/pgbouncer --timeout=300s
