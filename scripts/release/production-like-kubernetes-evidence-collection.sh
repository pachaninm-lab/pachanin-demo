collect_cluster_evidence() {
  set +e
  if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
    kubectl version -o yaml > "$K8S_DIR/cluster/kubectl-version.yaml" 2>&1
    kubectl get nodes -o wide > "$K8S_DIR/cluster/nodes.txt" 2>&1
    kubectl get nodes -o json > "$K8S_DIR/cluster/nodes.json" 2>&1
    kubectl get pods -A -o wide > "$K8S_DIR/cluster/pods-all.txt" 2>&1
    kubectl get deployments,statefulsets,daemonsets,jobs,services,pdb,networkpolicy,ingress,configmap \
      -n "$NAMESPACE" -o yaml > "$K8S_DIR/cluster/accepted-resources.yaml" 2>&1
    kubectl get events -A --sort-by=.lastTimestamp > "$K8S_DIR/cluster/events.txt" 2>&1
    kubectl describe deployment,statefulset,daemonset,job -n "$NAMESPACE" \
      > "$K8S_DIR/cluster/workload-descriptions.txt" 2>&1
    for selector in \
      'app.kubernetes.io/name=grainflow-api' \
      'app.kubernetes.io/name=grainflow-web' \
      'app.kubernetes.io/name=grainflow-outbox-worker' \
      'app.kubernetes.io/name=postgresql' \
      'app.kubernetes.io/name=pgbouncer' \
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
