FAILURE_REASON="production-like runtime configuration failed"

kubectl create configmap grainflow-pgbouncer-config -n "$NAMESPACE" \
  --from-file=pgbouncer.ini=infra/kind/production-like/pgbouncer.ini \
  --dry-run=client -o yaml | kubectl apply -f - \
  > "$K8S_DIR/pgbouncer-config-apply.log"
kubectl rollout restart -n "$NAMESPACE" deployment/pgbouncer \
  > "$K8S_DIR/pgbouncer-rollout-restart.log"
kubectl rollout status -n "$NAMESPACE" deployment/pgbouncer --timeout=300s
