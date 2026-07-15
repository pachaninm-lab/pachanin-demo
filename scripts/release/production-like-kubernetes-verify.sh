FAILURE_REASON="initial application rollout failed"
kubectl apply -f "$K8S_DIR/rendered/initial-workloads.yaml" > "$K8S_DIR/initial-workloads-apply.log"
patch_web_hardening
kubectl apply -f infra/kind/production-like/platform-hardening.yaml > "$K8S_DIR/platform-hardening-apply.log"
apply_release_marker "$K8S_DIR/initial-release-manifest.json"

for deployment in grainflow-api grainflow-web grainflow-outbox-worker; do
  kubectl rollout status -n "$NAMESPACE" "deployment/${deployment}" --timeout=600s
done

curl_ingress() {
  local host="$1"
  local path="$2"
  curl --fail --silent --show-error --max-time 5 --retry 2 --retry-all-errors --retry-delay 0 \
    --resolve "${host}:8080:127.0.0.1" \
    "http://${host}:8080${path}"
}
for _ in $(seq 1 60); do
  if curl_ingress api.acceptance.grainflow.invalid /health >/dev/null && \
     curl_ingress app.acceptance.grainflow.invalid /api/health >/dev/null; then
    break
  fi
  sleep 2
done
curl_ingress api.acceptance.grainflow.invalid /health | tee "$K8S_DIR/cluster/api-health-initial.json"
curl_ingress app.acceptance.grainflow.invalid /api/health | tee "$K8S_DIR/cluster/web-health-initial.json"

verify_digest_set() {
  local document="$1"
  local phase="$2"
  local expected_api expected_web expected_worker
  expected_api="$(jq -r '.components.api.digest // .targetComponents.api.digest' "$document")"
  expected_web="$(jq -r '.components.web.digest // .targetComponents.web.digest' "$document")"
  expected_worker="$(jq -r '.components.outboxWorker.digest // .targetComponents.outboxWorker.digest' "$document")"
  local actual_api actual_web actual_worker
  actual_api="$(kubectl get deployment grainflow-api -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  actual_web="$(kubectl get deployment grainflow-web -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  actual_worker="$(kubectl get deployment grainflow-outbox-worker -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')"
  [[ "$actual_api" == *@${expected_api} ]]
  [[ "$actual_web" == *@${expected_web} ]]
  [[ "$actual_worker" == *@${expected_worker} ]]
  printf '%s\n%s\n%s\n' "$actual_api" "$actual_web" "$actual_worker" > "$K8S_DIR/cluster/${phase}-images.txt"
}

verify_digest_set "$K8S_DIR/initial-release-manifest.json" initial
INITIAL_MATCH=true

ready_replicas() {
  kubectl get deployment "$1" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}'
}
test "$(ready_replicas grainflow-api)" = "2"
test "$(ready_replicas grainflow-web)" = "2"
test "$(ready_replicas grainflow-outbox-worker)" = "2"
ready_replicas grainflow-api > "$K8S_DIR/cluster/api-ready-replicas.txt"
ready_replicas grainflow-web > "$K8S_DIR/cluster/web-ready-replicas.txt"
ready_replicas grainflow-outbox-worker > "$K8S_DIR/cluster/worker-ready-replicas.txt"

node <<'NODE' > "$K8S_DIR/cluster/pod-placement.json"
const { execFileSync } = require('node:child_process');
const get = (selector) => JSON.parse(execFileSync('kubectl', ['get','pods','-n','grainflow-acceptance','-l',selector,'-o','json'], {encoding:'utf8'}));
const nodes = JSON.parse(execFileSync('kubectl', ['get','nodes','-o','json'], {encoding:'utf8'}));
const summarize = (selector) => {
  const pods = get(selector).items.map(p => ({name:p.metadata.name,node:p.spec.nodeName,ready:p.status.containerStatuses?.every(c=>c.ready)===true}));
  return {replicas:pods.length,uniqueNodes:[...new Set(pods.map(p=>p.node))],pods};
};
process.stdout.write(JSON.stringify({
  kindNodes: nodes.items.map(n => ({name:n.metadata.name,role:n.metadata.labels['node-role.kubernetes.io/control-plane'] !== undefined ? 'control-plane' : 'worker'})),
  api:summarize('app.kubernetes.io/name=grainflow-api'),
  web:summarize('app.kubernetes.io/name=grainflow-web'),
  outboxWorker:summarize('app.kubernetes.io/name=grainflow-outbox-worker'),
}, null, 2));
NODE
node - "$K8S_DIR/cluster/pod-placement.json" <<'NODE'
const fs=require('node:fs');
const p=JSON.parse(fs.readFileSync(process.argv[2]));
for (const name of ['api','web','outboxWorker']) {
  if (p[name].replicas !== 2 || p[name].uniqueNodes.length !== 2 || p[name].pods.some(x=>!x.ready)) {
    throw new Error(`${name} placement or readiness invalid`);
  }
  if (p[name].pods.some(x=>x.node.includes('control-plane'))) throw new Error(`${name} scheduled on control-plane`);
}
NODE

service_account_violations="$(node <<'NODE'
const {execFileSync}=require('node:child_process');
const names=['grainflow-api','grainflow-web','grainflow-outbox-worker'];
let violations=0;
for (const name of names) {
  const d=JSON.parse(execFileSync('kubectl',['get','deployment',name,'-n','grainflow-acceptance','-o','json'],{encoding:'utf8'}));
  if (d.spec.template.spec.automountServiceAccountToken !== false) violations++;
}
process.stdout.write(String(violations));
NODE
)"
printf '%s\n' "$service_account_violations" > "$K8S_DIR/cluster/service-account-token-violations.txt"
test "$service_account_violations" = "0"

mutable_images="$(kubectl get deployments,jobs -n "$NAMESPACE" -o json | jq '[.items[].spec.template.spec.containers[].image | select(test("@sha256:")|not) | select(test("grainflow|prozrachnaya-cena"))] | length')"
printf '%s\n' "$mutable_images" > "$K8S_DIR/cluster/mutable-platform-images.txt"
test "$mutable_images" = "0"

FAILURE_REASON="NetworkPolicy enforcement failed"
kubectl run network-denied -n "$NAMESPACE" --restart=Never --image=busybox:1.36.1 \
  --command -- sh -ec 'if nc -z -w 3 postgresql 5432; then echo unexpected-connection; exit 1; else echo denied-as-required; fi'
for _ in $(seq 1 60); do
  phase="$(kubectl get pod network-denied -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  [[ "$phase" = Succeeded ]] && break
  [[ "$phase" = Failed ]] && break
  sleep 1
done
kubectl logs -n "$NAMESPACE" network-denied | tee "$K8S_DIR/cluster/network-policy-denial.txt"
test "$(kubectl get pod network-denied -n "$NAMESPACE" -o jsonpath='{.status.phase}')" = Succeeded
grep -q denied-as-required "$K8S_DIR/cluster/network-policy-denial.txt"
NETWORK_DENIAL_PROVEN=true

probe_during_delete() {
  local component="$1"
  local host="$2"
  local path="$3"
  local result_file="$4"
  local pod
  pod="$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=grainflow-${component}" -o jsonpath='{.items[0].metadata.name}')"
  (
    failures=0
    for _ in $(seq 1 60); do
      if ! curl_ingress "$host" "$path" >/dev/null; then failures=$((failures+1)); fi
      sleep 0.25
    done
    printf '%s\n' "$failures" > "$result_file"
  ) &
  probe_pid=$!
  sleep 1
  kubectl delete pod "$pod" -n "$NAMESPACE" --wait=false
  wait "$probe_pid"
  kubectl rollout status -n "$NAMESPACE" "deployment/grainflow-${component}" --timeout=300s
}

FAILURE_REASON="API or web lost availability after one pod deletion"
probe_during_delete api api.acceptance.grainflow.invalid /health "$K8S_DIR/cluster/api-probe-failures.txt"
probe_during_delete web app.acceptance.grainflow.invalid /api/health "$K8S_DIR/cluster/web-probe-failures.txt"
API_PROBE_FAILURES="$(cat "$K8S_DIR/cluster/api-probe-failures.txt")"
WEB_PROBE_FAILURES="$(cat "$K8S_DIR/cluster/web-probe-failures.txt")"
test "$API_PROBE_FAILURES" = "0"
test "$WEB_PROBE_FAILURES" = "0"

FAILURE_REASON="worker peer deletion dropped all ready workers"
worker_pod="$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=grainflow-outbox-worker -o jsonpath='{.items[0].metadata.name}')"
WORKER_MIN_READY=2
(
  for _ in $(seq 1 80); do
    ready="$(ready_replicas grainflow-outbox-worker)"
    ready="${ready:-0}"
    if (( ready < WORKER_MIN_READY )); then WORKER_MIN_READY="$ready"; fi
    printf '%s\n' "$WORKER_MIN_READY" > "$K8S_DIR/cluster/worker-min-ready.txt"
    sleep 0.25
  done
) &
worker_probe_pid=$!
sleep 1
kubectl delete pod "$worker_pod" -n "$NAMESPACE" --wait=false
wait "$worker_probe_pid"
WORKER_MIN_READY="$(cat "$K8S_DIR/cluster/worker-min-ready.txt")"
test "$WORKER_MIN_READY" -ge 1
kubectl rollout status -n "$NAMESPACE" deployment/grainflow-outbox-worker --timeout=300s

FAILURE_REASON="rolling update did not apply the complete immutable digest set"
kubectl apply -f "$K8S_DIR/rendered/update-workloads.yaml" > "$K8S_DIR/update-workloads-apply.log"
patch_web_hardening
apply_release_marker "$K8S_DIR/update-release-manifest.json"
for deployment in grainflow-api grainflow-web grainflow-outbox-worker; do
  kubectl rollout status -n "$NAMESPACE" "deployment/${deployment}" --timeout=600s
done
verify_digest_set "$K8S_DIR/update-release-manifest.json" rollout
ROLLOUT_MATCH=true
kubectl get deployment -n "$NAMESPACE" -o json > "$K8S_DIR/cluster/deployments-after-rollout.json"

FAILURE_REASON="same-schema rollback did not restore the complete prior digest set"
test "$(jq -r '.databaseRollbackMode' "$K8S_DIR/rollback.json")" = "NO_DOWN_MIGRATION_SAME_SCHEMA_ONLY"
test "$(jq -r '.currentMigrationSetDigest' "$K8S_DIR/rollback.json")" = "$(jq -r '.targetMigrationSetDigest' "$K8S_DIR/rollback.json")"
kubectl apply -f "$K8S_DIR/rendered/rollback-workloads.yaml" > "$K8S_DIR/rollback-workloads-apply.log"
patch_web_hardening
apply_release_marker "$K8S_DIR/rollback.json"
for deployment in grainflow-api grainflow-web grainflow-outbox-worker; do
  kubectl rollout status -n "$NAMESPACE" "deployment/${deployment}" --timeout=600s
done
verify_digest_set "$K8S_DIR/rollback.json" rollback
ROLLBACK_MATCH=true
kubectl get configmap grainflow-release-authority -n "$NAMESPACE" -o json > "$K8S_DIR/cluster/release-authority-after-rollback.json"
kubectl get deployment -n "$NAMESPACE" -o json > "$K8S_DIR/cluster/deployments-after-rollback.json"

FAILURE_REASON="post-rollback probes, metrics or alerts are unhealthy"
curl_ingress api.acceptance.grainflow.invalid /ready | tee "$K8S_DIR/cluster/api-ready-after-rollback.json"
curl_ingress app.acceptance.grainflow.invalid /api/health | tee "$K8S_DIR/cluster/web-ready-after-rollback.json"
kubectl run observability-check -n "$NAMESPACE" --restart=Never --image=curlimages/curl:8.8.0 \
  --labels=app.kubernetes.io/name=prometheus \
  --command -- sh -ec \
  'curl -fsS http://prometheus:9090/-/ready; curl -fsS "http://prometheus:9090/api/v1/targets" | grep -q "\"health\":\"up\""; curl -fsS http://prometheus:9090/api/v1/rules | grep -q GrainflowApiUnavailable'
for _ in $(seq 1 90); do
  phase="$(kubectl get pod observability-check -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  [[ "$phase" = Succeeded ]] && break
  [[ "$phase" = Failed ]] && break
  sleep 1
done
kubectl logs -n "$NAMESPACE" observability-check > "$K8S_DIR/cluster/observability-check.log" 2>&1 || true
test "$(kubectl get pod observability-check -n "$NAMESPACE" -o jsonpath='{.status.phase}')" = Succeeded

RESULT="passed"
FAILURE_REASON=""
touch "$K8S_DIR/acceptance-complete"
