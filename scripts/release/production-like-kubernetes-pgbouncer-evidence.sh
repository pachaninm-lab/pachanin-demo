pgbouncer_ready="$(kubectl get deployment pgbouncer -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')"
printf '%s\n' "${pgbouncer_ready:-0}" > "$K8S_DIR/cluster/pgbouncer-ready-replicas.txt"
test "$pgbouncer_ready" = "2"

pgbouncer_routed_principals="$(
  {
    kubectl get secret grainflow-api-secrets -n "$NAMESPACE" -o json | \
      jq -r '.data.DATABASE_URL,.data.AUTH_DATABASE_URL,.data.STORAGE_DATABASE_URL | @base64d'
    kubectl get secret grainflow-outbox-worker-secrets -n "$NAMESPACE" -o json | \
      jq -r '.data.DATABASE_URL | @base64d'
  } | awk '/@pgbouncer:6432\// { count += 1 } END { print count + 0 }'
)"
printf '%s\n' "$pgbouncer_routed_principals" > "$K8S_DIR/cluster/pgbouncer-routed-principals.txt"
test "$pgbouncer_routed_principals" = "4"

kubectl delete pod pgbouncer-runtime-check -n "$NAMESPACE" --wait=true
