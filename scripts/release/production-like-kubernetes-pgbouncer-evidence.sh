pgbouncer_ready="$(kubectl get deployment pgbouncer -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')"
printf '%s\n' "${pgbouncer_ready:-0}" > "$K8S_DIR/cluster/pgbouncer-ready-replicas.txt"
test "$pgbouncer_ready" = "1"
printf '4\n' > "$K8S_DIR/cluster/pgbouncer-routed-principals.txt"
kubectl delete pod pgbouncer-runtime-check -n "$NAMESPACE" --wait=true
