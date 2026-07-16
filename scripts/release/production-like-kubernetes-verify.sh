FAILURE_REASON="initial application rollout failed"
kubectl apply -f "$K8S_DIR/rendered/initial-workloads.yaml" > "$K8S_DIR/initial-workloads-apply.log"
patch_web_hardening
kubectl apply -f infra/kind/production-like/platform-hardening.yaml > "$K8S_DIR/platform-hardening-apply.log"
apply_release_marker "$K8S_DIR/initial-release-manifest.json"

for deployment in grainflow-api grainflow-web grainflow-outbox-worker pgbouncer; do
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

probe_tcp_from_pod() {
  local pod="$1"
  local host="$2"
  local port="$3"
  local expected="$4"
  local output_file="$5"
  local status

  set +e
  kubectl exec -i -n "$NAMESPACE" "pod/${pod}" -- \
    env PROBE_HOST="$host" PROBE_PORT="$port" PROBE_EXPECTED="$expected" node - \
    > "$output_file" 2>&1 <<'NODE'
const dns = require('node:dns');
const net = require('node:net');

const host = process.env.PROBE_HOST;
const port = Number(process.env.PROBE_PORT);
const expected = process.env.PROBE_EXPECTED;
const startedAt = new Date().toISOString();
let completed = false;
let socket;

const finish = (result, code, error) => {
  if (completed) return;
  completed = true;
  const evidence = {
    startedAt,
    completedAt: new Date().toISOString(),
    host,
    port,
    expected,
    result,
    resolvedAddresses,
    localAddress: socket?.localAddress ?? null,
    localPort: socket?.localPort ?? null,
    remoteAddress: socket?.remoteAddress ?? null,
    remotePort: socket?.remotePort ?? null,
    error: error ? { code: error.code ?? null, message: error.message } : null,
  };
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  socket?.destroy();
  process.exit(code);
};

let resolvedAddresses = [];
dns.lookup(host, { all: true }, (lookupError, addresses) => {
  if (lookupError) {
    finish('dns-error', 2, lookupError);
    return;
  }
  resolvedAddresses = addresses;
  socket = net.createConnection({ host, port });
  socket.setTimeout(3000);
  socket.once('connect', () => finish('connected', expected === 'allowed' ? 0 : 1));
  socket.once('timeout', () => finish('timeout', expected === 'blocked' ? 0 : 1));
  socket.once('error', (error) => finish('error', expected === 'blocked' ? 0 : 1, error));
});
NODE
  status=$?
  set -e
  cat "$output_file"
  return "$status"
}

postgresql_pod_ip="$(kubectl get pods -n "$NAMESPACE" \
  -l app.kubernetes.io/name=postgresql \
  -o jsonpath='{.items[0].status.podIP}')"
test -n "$postgresql_pod_ip"
printf '%s\n' "$postgresql_pod_ip" > "$K8S_DIR/cluster/postgresql-pod-ip.txt"

for workload in grainflow-api grainflow-outbox-worker; do
  mapfile -t workload_pods < <(kubectl get pods -n "$NAMESPACE" \
    -l "app.kubernetes.io/name=${workload}" \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | sort)
  test "${#workload_pods[@]}" = "2"

  for pod in "${workload_pods[@]}"; do
    safe_pod="${pod//[^a-zA-Z0-9_.-]/_}"

    FAILURE_REASON="direct PostgreSQL service bypass is open for ${pod}"
    probe_tcp_from_pod "$pod" postgresql 5432 blocked \
      "$K8S_DIR/cluster/${safe_pod}-postgresql-service-probe.json"

    FAILURE_REASON="direct PostgreSQL pod-IP bypass is open for ${pod}"
    probe_tcp_from_pod "$pod" "$postgresql_pod_ip" 5432 blocked \
      "$K8S_DIR/cluster/${safe_pod}-postgresql-pod-ip-probe.json"

    FAILURE_REASON="PgBouncer service route is unavailable for ${pod}"
    probe_tcp_from_pod "$pod" pgbouncer 6432 allowed \
      "$K8S_DIR/cluster/${safe_pod}-pgbouncer-service-probe.json"
  done

  printf 'pods=%s\ndirect-postgresql-service=blocked\ndirect-postgresql-pod-ip=blocked\npgbouncer=reachable\n' \
    "${#workload_pods[@]}" > "$K8S_DIR/cluster/${workload}-database-routing.txt"
done
printf 'blocked-by-service-and-pod-ip\n' > "$K8S_DIR/cluster/direct-postgresql-bypass.txt"
DIRECT_DB_BYPASS_BLOCKED=true

FAILURE_REASON="PgBouncer peer deletion interrupted API readiness"
pgbouncer_pod="$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=pgbouncer -o jsonpath='{.items[0].metadata.name}')"
(
  failures=0
  for _ in $(seq 1 60); do
    if ! curl_ingress api.acceptance.grainflow.invalid /ready >/dev/null; then failures=$((failures+1)); fi
    sleep 0.25
  done
  printf '%s\n' "$failures" > "$K8S_DIR/cluster/pgbouncer-probe-failures.txt"
) &
pgbouncer_probe_pid=$!
sleep 1
kubectl delete pod "$pgbouncer_pod" -n "$NAMESPACE" --wait=false
wait "$pgbouncer_probe_pid"
PGBOUNCER_PROBE_FAILURES="$(cat "$K8S_DIR/cluster/pgbouncer-probe-failures.txt")"
test "$PGBOUNCER_PROBE_FAILURES" = "0"
kubectl rollout status -n "$NAMESPACE" deployment/pgbouncer --timeout=300s
test "$(kubectl get deployment pgbouncer -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')" = "2"

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
test "$(ready_replicas pgbouncer)" = "2"
ready_replicas grainflow-api > "$K8S_DIR/cluster/api-ready-replicas.txt"
ready_replicas grainflow-web > "$K8S_DIR/cluster/web-ready-replicas.txt"
ready_replicas grainflow-outbox-worker > "$K8S_DIR/cluster/worker-ready-replicas.txt"
ready_replicas pgbouncer > "$K8S_DIR/cluster/pgbouncer-ready-replicas.txt"

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
  pgbouncer:summarize('app.kubernetes.io/name=pgbouncer'),
}, null, 2));
NODE
node - "$K8S_DIR/cluster/pod-placement.json" <<'NODE'
const fs=require('node:fs');
const p=JSON.parse(fs.readFileSync(process.argv[2]));
for (const name of ['api','web','outboxWorker','pgbouncer']) {
  if (p[name].replicas !== 2 || p[name].uniqueNodes.length !== 2 || p[name].pods.some(x=>!x.ready)) {
    throw new Error(`${name} placement or readiness invalid`);
  }
  if (p[name].pods.some(x=>x.node.includes('control-plane'))) throw new Error(`${name} scheduled on control-plane`);
}
NODE

service_account_violations="$(node <<'NODE'
const {execFileSync}=require('node:child_process');
const names=['grainflow-api','grainflow-web','grainflow-outbox-worker','pgbouncer'];
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
kubectl apply -f - > "$K8S_DIR/observability-check-network-policy-apply.log" <<'YAML'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: observability-check-egress
  namespace: grainflow-acceptance
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: observability-check
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: prometheus
      ports:
        - protocol: TCP
          port: 9090
YAML
kubectl run observability-check -n "$NAMESPACE" --restart=Never --image=curlimages/curl:8.8.0 \
  --labels=app.kubernetes.io/name=observability-check \
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
