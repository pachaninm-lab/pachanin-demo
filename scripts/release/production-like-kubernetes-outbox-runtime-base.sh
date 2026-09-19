#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

EXACT_HEAD="${EXACT_HEAD:?EXACT_HEAD is required}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness}"
K8S_DIR="$EVIDENCE_DIR/kubernetes"
RUNTIME_DIR="$K8S_DIR/outbox-runtime"
REPORT_PATH="$RUNTIME_DIR/outbox-worker-runtime-acceptance.json"
NAMESPACE="grainflow-acceptance"
WORKER_SELECTOR="app.kubernetes.io/name=grainflow-outbox-worker"
RUN_ID="ir2649-${EXACT_HEAD:0:12}-$(date +%s)"
STARTED_EPOCH="$(date +%s)"
RESULT="FAIL"
FAILURE_REASON="deep outbox runtime acceptance did not complete"

mkdir -p "$RUNTIME_DIR"

for command in kubectl jq node base64 curl grep sed date sort comm uniq wc; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 2
  }
done

read_number() {
  local file="$1"
  local fallback="${2:-0}"
  if [[ -s "$file" ]]; then
    tr -d '[:space:]' < "$file"
  else
    printf '%s' "$fallback"
  fi
}

write_report() {
  local status="$1"
  local ended_epoch
  ended_epoch="$(date +%s)"
  EXACT_HEAD="$EXACT_HEAD" \
  RUN_ID="$RUN_ID" \
  RESULT="$RESULT" \
  FAILURE_REASON="$FAILURE_REASON" \
  EXIT_STATUS="$status" \
  STARTED_EPOCH="$STARTED_EPOCH" \
  ENDED_EPOCH="$ended_epoch" \
  RUNTIME_DIR="$RUNTIME_DIR" \
  REPORT_PATH="$REPORT_PATH" \
  node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const dir = process.env.RUNTIME_DIR;
const read = (name, fallback = null) => {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return fallback;
  const value = fs.readFileSync(file, 'utf8').trim();
  return value === '' ? fallback : value;
};
const number = (name, fallback = 0) => {
  const value = Number(read(name, fallback));
  return Number.isFinite(value) ? value : fallback;
};
const bool = (name) => read(name, '0') === '1';

const thresholds = {
  initialWorkerReplicas: 2,
  uniqueKafkaClientIds: 2,
  minimumReadyWorkersDuringKill: 1,
  kafkaOutageFalseSent: 0,
  outageRecoverySlaSeconds: 60,
  leaseRecoverySlaSeconds: 90,
  staleHeartbeatMutations: 0,
  staleAckMutations: 0,
  staleFailureMutations: 0,
  poisonDeadLetters: 1,
  poisonHealthyDelivered: 20,
  backlogEntries: 300,
  backlogRecoverySlaSeconds: 60,
  independentScaleTarget: 3,
  apiReplicasDuringWorkerScale: 2,
  duplicateKafkaDeliveries: 0,
  missingKafkaDeliveries: 0,
  finalWorkerReplicas: 2,
};

const actual = {
  initialWorkerReplicas: number('initial-worker-replicas.txt'),
  uniqueKafkaClientIds: number('unique-kafka-client-ids.txt'),
  minimumReadyWorkersDuringKill: number('minimum-ready-workers-during-kill.txt'),
  gracefulShutdownPassed: bool('graceful-shutdown-passed.txt'),
  kafkaOutageFalseSent: number('kafka-outage-false-sent.txt', 999),
  outageRecoverySeconds: number('kafka-outage-recovery-seconds.txt', 999),
  leaseRecoverySeconds: number('lease-recovery-seconds.txt', 999),
  recoveredAfterLeaseExpiry: bool('recovered-after-lease-expiry.txt'),
  staleHeartbeatMutations: number('stale-heartbeat-mutations.txt', 999),
  staleAckMutations: number('stale-ack-mutations.txt', 999),
  staleFailureMutations: number('stale-failure-mutations.txt', 999),
  poisonDeadLetters: number('poison-dead-letters.txt'),
  poisonHealthyDelivered: number('poison-healthy-delivered.txt'),
  backlogEntries: number('backlog-entry-count.txt'),
  backlogRecoverySeconds: number('backlog-recovery-seconds.txt', 999),
  independentScaleTarget: number('scaled-worker-replicas.txt'),
  apiReplicasDuringWorkerScale: number('api-replicas-during-worker-scale.txt'),
  duplicateKafkaDeliveries: number('duplicate-kafka-deliveries.txt', 999),
  missingKafkaDeliveries: number('missing-kafka-deliveries.txt', 999),
  finalWorkerReplicas: number('final-worker-replicas.txt'),
};

const violations = [];
const exact = [
  'initialWorkerReplicas',
  'uniqueKafkaClientIds',
  'kafkaOutageFalseSent',
  'staleHeartbeatMutations',
  'staleAckMutations',
  'staleFailureMutations',
  'poisonDeadLetters',
  'poisonHealthyDelivered',
  'backlogEntries',
  'independentScaleTarget',
  'apiReplicasDuringWorkerScale',
  'duplicateKafkaDeliveries',
  'missingKafkaDeliveries',
  'finalWorkerReplicas',
];
for (const key of exact) {
  if (actual[key] !== thresholds[key]) violations.push(`${key}:${actual[key]}!=${thresholds[key]}`);
}
if (actual.minimumReadyWorkersDuringKill < thresholds.minimumReadyWorkersDuringKill) {
  violations.push(
    `minimumReadyWorkersDuringKill:${actual.minimumReadyWorkersDuringKill}<${thresholds.minimumReadyWorkersDuringKill}`,
  );
}
if (!actual.gracefulShutdownPassed) violations.push('gracefulShutdownPassed:false');
if (!actual.recoveredAfterLeaseExpiry) violations.push('recoveredAfterLeaseExpiry:false');
if (actual.outageRecoverySeconds > thresholds.outageRecoverySlaSeconds) {
  violations.push(
    `outageRecoverySeconds:${actual.outageRecoverySeconds}>${thresholds.outageRecoverySlaSeconds}`,
  );
}
if (actual.leaseRecoverySeconds > thresholds.leaseRecoverySlaSeconds) {
  violations.push(
    `leaseRecoverySeconds:${actual.leaseRecoverySeconds}>${thresholds.leaseRecoverySlaSeconds}`,
  );
}
if (actual.backlogRecoverySeconds > thresholds.backlogRecoverySlaSeconds) {
  violations.push(
    `backlogRecoverySeconds:${actual.backlogRecoverySeconds}>${thresholds.backlogRecoverySlaSeconds}`,
  );
}

const commandSucceeded =
  process.env.RESULT === 'PASS' && Number(process.env.EXIT_STATUS) === 0;
const pass = commandSucceeded && violations.length === 0;
const report = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY || 'pachaninm-lab/pachanin-demo',
  commitSha: process.env.EXACT_HEAD,
  environment: 'github-actions-multi-node-kind-production-like',
  command: 'bash scripts/release/production-like-kubernetes-outbox-runtime.sh',
  runId: process.env.RUN_ID,
  timestamp: new Date().toISOString(),
  durationSeconds:
    Math.max(0, Number(process.env.ENDED_EPOCH) - Number(process.env.STARTED_EPOCH)),
  result: pass ? 'PASS' : 'FAIL',
  pass,
  failureReason: pass ? null : process.env.FAILURE_REASON,
  thresholds,
  actualMeasurements: actual,
  violatedThresholds: violations,
  scenarios: {
    twoReplicaIdentity: read('worker-identities.json'),
    gracefulShutdown: read('graceful-shutdown-row.txt'),
    kafkaOutageRecovery: read('kafka-outage-summary.txt'),
    killLeaseRecovery: read('lease-recovery-summary.txt'),
    staleTokenCas: read('stale-token-summary.txt'),
    poisonIsolation: read('poison-summary.txt'),
    independentScaleAndBacklog: read('backlog-summary.txt'),
  },
  evidence: [
    'kubernetes/outbox-runtime/worker-identities.json',
    'kubernetes/outbox-runtime/graceful-worker.log',
    'kubernetes/outbox-runtime/graceful-shutdown-row.txt',
    'kubernetes/outbox-runtime/kafka-outage-summary.txt',
    'kubernetes/outbox-runtime/lease-recovery-summary.txt',
    'kubernetes/outbox-runtime/stale-token-summary.txt',
    'kubernetes/outbox-runtime/poison-summary.txt',
    'kubernetes/outbox-runtime/kafka-backlog-consumer.log',
    'kubernetes/outbox-runtime/backlog-summary.txt',
  ],
  maturityBoundary:
    'Deep independent outbox-worker runtime acceptance in disposable multi-node kind. This proves worker failover, lease recovery, stale-token CAS, transport outage recovery, poison isolation, bounded backlog recovery and independent scaling. It does not prove provider-level PostgreSQL HA/PITR, target platform load, permanent-environment soak, external pentest or live provider integrations.',
};
fs.mkdirSync(path.dirname(process.env.REPORT_PATH), { recursive: true });
fs.writeFileSync(process.env.REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
NODE
}

on_exit() {
  local status=$?
  trap - EXIT
  write_report "$status" || true
  exit "$status"
}
trap on_exit EXIT

postgres_password="$(
  kubectl get secret grainflow-postgresql-secrets -n "$NAMESPACE" \
    -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
)"
outbox_password="$(
  kubectl get secret grainflow-outbox-worker-secrets -n "$NAMESPACE" \
    -o jsonpath='{.data.DATABASE_URL}' | base64 -d | sed -E 's#^postgresql://app_outbox:([^@]+)@.*#\1#'
)"
printf '::add-mask::%s\n' "$postgres_password"
printf '::add-mask::%s\n' "$outbox_password"

admin_sql() {
  local sql="$1"
  kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$postgres_password" \
    psql -v ON_ERROR_STOP=1 -U postgres -d grainflow -Atc "$sql"
}

outbox_sql() {
  local sql="$1"
  kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$outbox_password" \
    psql -v ON_ERROR_STOP=1 -U app_outbox -d grainflow -Atc "$sql"
}

sql_literal() {
  printf "%s" "$1" | sed "s/'/''/g"
}

wait_for_sql() {
  local description="$1"
  local expected="$2"
  local timeout_seconds="$3"
  local sql="$4"
  local deadline=$(( $(date +%s) + timeout_seconds ))
  local value=""
  while (( $(date +%s) < deadline )); do
    value="$(admin_sql "$sql" 2>/dev/null || true)"
    if [[ "$value" = "$expected" ]]; then
      printf '%s\n' "$value"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for ${description}; expected=${expected}; actual=${value}" >&2
  return 1
}

wait_for_deployment_ready() {
  local deployment="$1"
  local replicas="$2"
  kubectl rollout status -n "$NAMESPACE" "deployment/${deployment}" --timeout=360s
  wait_for_sql "database availability" "1" 5 "SELECT 1" >/dev/null
  local actual
  actual="$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')"
  test "${actual:-0}" = "$replicas"
}

worker_ready_replicas() {
  local value
  value="$(kubectl get deployment grainflow-outbox-worker -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')"
  printf '%s\n' "${value:-0}"
}

api_ready_replicas() {
  local value
  value="$(kubectl get deployment grainflow-api -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')"
  printf '%s\n' "${value:-0}"
}

seed_small_entries() {
  local suffix="$1"
  local count="$2"
  local max_retries="${3:-20}"
  admin_sql "
    INSERT INTO \"outbox_entries\"
      (\"type\", \"payload\", \"status\", \"idempotencyKey\", \"maxRetries\", \"retryCount\",
       \"nextRetryAt\", \"correlationId\")
    SELECT
      '${RUN_ID}.${suffix}',
      jsonb_build_object('runId', '${RUN_ID}', 'suffix', '${suffix}', 'index', value),
      'PENDING',
      '${RUN_ID}.${suffix}.' || value,
      ${max_retries},
      0,
      NOW() - INTERVAL '1 second',
      '${RUN_ID}.${suffix}'
    FROM generate_series(1, ${count}) AS value;
    SELECT count(*) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${suffix}';
  " | tail -1
}

count_status() {
  local suffix="$1"
  local status="$2"
  admin_sql "SELECT count(*) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${suffix}' AND \"status\"='${status}';"
}

delete_run_rows() {
  admin_sql "DELETE FROM \"outbox_entries\" WHERE \"correlationId\" LIKE '${RUN_ID}.%';" >/dev/null
}
delete_run_rows

FAILURE_REASON="two worker replicas or Kafka client identities are not independent"
initial_workers="$(worker_ready_replicas)"
printf '%s\n' "$initial_workers" > "$RUNTIME_DIR/initial-worker-replicas.txt"
test "$initial_workers" = "2"

mapfile -t worker_pods < <(
  kubectl get pods -n "$NAMESPACE" -l "$WORKER_SELECTOR" \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | sort
)
test "${#worker_pods[@]}" = "2"

identities_file="$RUNTIME_DIR/worker-identities.jsonl"
: > "$identities_file"
for index in "${!worker_pods[@]}"; do
  pod="${worker_pods[$index]}"
  local_port=$((39020 + index))
  kubectl port-forward -n "$NAMESPACE" "pod/${pod}" "${local_port}:3002" \
    > "$RUNTIME_DIR/port-forward-${pod}.log" 2>&1 &
  forward_pid=$!
  ready_json=""
  for _ in $(seq 1 30); do
    ready_json="$(curl --fail --silent --show-error "http://127.0.0.1:${local_port}/ready" 2>/dev/null || true)"
    [[ -n "$ready_json" ]] && break
    sleep 1
  done
  kill "$forward_pid" >/dev/null 2>&1 || true
  wait "$forward_pid" 2>/dev/null || true
  test -n "$ready_json"
  printf '%s\n' "$ready_json" | jq -c \
    --arg pod "$pod" '{pod:$pod, workerId:.checks.runner.workerId, kafkaClientId:.checks.kafka.clientId, ready:(.status=="ready")}' \
    >> "$identities_file"
done
jq -s '.' "$identities_file" > "$RUNTIME_DIR/worker-identities.json"
unique_ids="$(jq '[.[].kafkaClientId] | unique | length' "$RUNTIME_DIR/worker-identities.json")"
printf '%s\n' "$unique_ids" > "$RUNTIME_DIR/unique-kafka-client-ids.txt"
test "$unique_ids" = "2"
test "$(jq '[.[] | select(.pod != .workerId or .pod != .kafkaClientId or .ready != true)] | length' "$RUNTIME_DIR/worker-identities.json")" = "0"

FAILURE_REASON="graceful shutdown did not stop claims and safely finish the active drain"
kubectl scale deployment kafka -n "$NAMESPACE" --replicas=0
kubectl wait --for=delete pod -n "$NAMESPACE" -l app.kubernetes.io/name=kafka --timeout=180s
graceful_suffix="graceful"
test "$(seed_small_entries "$graceful_suffix" 1 20)" = "1"
wait_for_sql "graceful entry claim" "PROCESSING" 45 \
  "SELECT \"status\" FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${graceful_suffix}' LIMIT 1;" \
  >/dev/null
graceful_owner="$(admin_sql "SELECT \"leaseOwner\" FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${graceful_suffix}' LIMIT 1;")"
test -n "$graceful_owner"
kubectl logs -f -n "$NAMESPACE" "pod/${graceful_owner}" > "$RUNTIME_DIR/graceful-worker.log" 2>&1 &
graceful_log_pid=$!
sleep 1
kubectl delete pod "$graceful_owner" -n "$NAMESPACE" --grace-period=120 --wait=true \
  > "$RUNTIME_DIR/graceful-pod-delete.log" 2>&1
wait "$graceful_log_pid" 2>/dev/null || true
grep -q 'Durable outbox runner stopped workerId=' "$RUNTIME_DIR/graceful-worker.log"
grep -q 'Outbox worker stopped signal=SIGTERM' "$RUNTIME_DIR/graceful-worker.log"
graceful_row="$(admin_sql "
  SELECT \"status\" || ':' || COALESCE(\"leaseOwner\", '') || ':' || COALESCE(\"leaseToken\", '') || ':' ||
         CASE WHEN \"sentAt\" IS NULL THEN 'unsent' ELSE 'sent' END
  FROM \"outbox_entries\"
  WHERE \"correlationId\"='${RUN_ID}.${graceful_suffix}'
  LIMIT 1;
")"
printf '%s\n' "$graceful_row" > "$RUNTIME_DIR/graceful-shutdown-row.txt"
[[ "$graceful_row" == PENDING:::unsent || "$graceful_row" == DEAD_LETTER:::unsent ]]
printf '1\n' > "$RUNTIME_DIR/graceful-shutdown-passed.txt"

kubectl scale deployment kafka -n "$NAMESPACE" --replicas=1
wait_for_deployment_ready kafka 1
kubectl rollout status -n "$NAMESPACE" deployment/grainflow-outbox-worker --timeout=360s
admin_sql "
  UPDATE \"outbox_entries\"
  SET \"nextRetryAt\"=NOW()-INTERVAL '1 second'
  WHERE \"correlationId\"='${RUN_ID}.${graceful_suffix}' AND \"status\"='PENDING';
" >/dev/null
wait_for_sql "graceful entry post-recovery delivery" "1" 60 \
  "SELECT count(*) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${graceful_suffix}' AND \"status\"='SENT';" \
  >/dev/null

FAILURE_REASON="Kafka outage was falsely acknowledged or did not recover within SLA"
outage_suffix="outage"
kubectl scale deployment kafka -n "$NAMESPACE" --replicas=0
kubectl wait --for=delete pod -n "$NAMESPACE" -l app.kubernetes.io/name=kafka --timeout=180s
test "$(seed_small_entries "$outage_suffix" 20 20)" = "20"
sleep 12
false_sent="$(count_status "$outage_suffix" SENT)"
printf '%s\n' "$false_sent" > "$RUNTIME_DIR/kafka-outage-false-sent.txt"
test "$false_sent" = "0"
kubectl scale deployment kafka -n "$NAMESPACE" --replicas=1
wait_for_deployment_ready kafka 1
admin_sql "
  UPDATE \"outbox_entries\"
  SET \"nextRetryAt\"=NOW()-INTERVAL '1 second'
  WHERE \"correlationId\"='${RUN_ID}.${outage_suffix}' AND \"status\"='PENDING';
" >/dev/null
outage_recovery_started="$(date +%s)"
wait_for_sql "Kafka outage backlog recovery" "20" 60 \
  "SELECT count(*) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${outage_suffix}' AND \"status\"='SENT';" \
  >/dev/null
outage_recovery_seconds=$(( $(date +%s) - outage_recovery_started ))
printf '%s\n' "$outage_recovery_seconds" > "$RUNTIME_DIR/kafka-outage-recovery-seconds.txt"
outage_retries="$(admin_sql "SELECT COALESCE(sum(\"retryCount\"),0) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${outage_suffix}';")"
printf 'sent=20 retries=%s recoverySeconds=%s\n' "$outage_retries" "$outage_recovery_seconds" \
  > "$RUNTIME_DIR/kafka-outage-summary.txt"

FAILURE_REASON="forced worker kill was not recovered after lease expiry"
kill_suffix="lease-kill"
kubectl scale deployment kafka -n "$NAMESPACE" --replicas=0
kubectl wait --for=delete pod -n "$NAMESPACE" -l app.kubernetes.io/name=kafka --timeout=180s
test "$(seed_small_entries "$kill_suffix" 1 20)" = "1"
wait_for_sql "kill scenario claim" "PROCESSING" 45 \
  "SELECT \"status\" FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${kill_suffix}' LIMIT 1;" \
  >/dev/null
lease_snapshot="$(admin_sql "
  SELECT \"leaseOwner\" || '|' || \"leaseToken\" || '|' || extract(epoch FROM \"leaseExpiresAt\")::bigint
  FROM \"outbox_entries\"
  WHERE \"correlationId\"='${RUN_ID}.${kill_suffix}'
  LIMIT 1;
")"
IFS='|' read -r killed_owner stale_token lease_expiry_epoch <<< "$lease_snapshot"
test -n "$killed_owner"
test -n "$stale_token"
printf '%s\n' "$lease_snapshot" > "$RUNTIME_DIR/killed-lease-snapshot.txt"

minimum_ready=2
(
  for _ in $(seq 1 160); do
    ready="$(worker_ready_replicas)"
    if (( ready < minimum_ready )); then minimum_ready="$ready"; fi
    printf '%s\n' "$minimum_ready" > "$RUNTIME_DIR/minimum-ready-workers-during-kill.txt"
    sleep 0.25
  done
) &
ready_probe_pid=$!
kubectl delete pod "$killed_owner" -n "$NAMESPACE" --grace-period=0 --force --wait=false \
  > "$RUNTIME_DIR/forced-kill.log" 2>&1
wait "$ready_probe_pid"
minimum_ready="$(read_number "$RUNTIME_DIR/minimum-ready-workers-during-kill.txt" 0)"
test "$minimum_ready" -ge 1

now_epoch="$(date +%s)"
restore_at=$(( lease_expiry_epoch - 15 ))
if (( restore_at > now_epoch )); then
  sleep $(( restore_at - now_epoch ))
fi
kubectl scale deployment kafka -n "$NAMESPACE" --replicas=1
wait_for_deployment_ready kafka 1
kubectl rollout status -n "$NAMESPACE" deployment/grainflow-outbox-worker --timeout=360s

lease_recovery_started="$(date +%s)"
wait_for_sql "lease-expired entry recovery" "SENT" 90 \
  "SELECT \"status\" FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${kill_suffix}' LIMIT 1;" \
  >/dev/null
lease_recovery_seconds=$(( $(date +%s) - lease_recovery_started ))
printf '%s\n' "$lease_recovery_seconds" > "$RUNTIME_DIR/lease-recovery-seconds.txt"
sent_epoch="$(admin_sql "
  SELECT extract(epoch FROM \"sentAt\")::bigint
  FROM \"outbox_entries\"
  WHERE \"correlationId\"='${RUN_ID}.${kill_suffix}'
  LIMIT 1;
")"
test "$sent_epoch" -ge "$lease_expiry_epoch"
printf '1\n' > "$RUNTIME_DIR/recovered-after-lease-expiry.txt"
printf 'killedOwner=%s leaseExpiryEpoch=%s sentEpoch=%s recoverySeconds=%s\n' \
  "$killed_owner" "$lease_expiry_epoch" "$sent_epoch" "$lease_recovery_seconds" \
  > "$RUNTIME_DIR/lease-recovery-summary.txt"

FAILURE_REASON="stale lease token heartbeat, acknowledgement or failure mutation was accepted"
kill_entry_id="$(admin_sql "SELECT \"id\" FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${kill_suffix}' LIMIT 1;")"
escaped_entry_id="$(sql_literal "$kill_entry_id")"
escaped_owner="$(sql_literal "$killed_owner")"
escaped_token="$(sql_literal "$stale_token")"
stale_heartbeat="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"heartbeatAt\"=NOW(), \"leaseExpiresAt\"=NOW()+INTERVAL '60 seconds'
    WHERE \"id\"='${escaped_entry_id}'
      AND \"leaseOwner\"='${escaped_owner}'
      AND \"leaseToken\"='${escaped_token}'
      AND \"status\"='PROCESSING'
      AND \"leaseExpiresAt\">=NOW()
    RETURNING 1
  )
  SELECT count(*) FROM changed;
")"
stale_ack="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"status\"='SENT', \"sentAt\"=NOW(), \"leaseOwner\"=NULL, \"leaseToken\"=NULL,
        \"leaseExpiresAt\"=NULL, \"heartbeatAt\"=NULL
    WHERE \"id\"='${escaped_entry_id}'
      AND \"leaseOwner\"='${escaped_owner}'
      AND \"leaseToken\"='${escaped_token}'
      AND \"status\"='PROCESSING'
      AND \"leaseExpiresAt\">=NOW()
    RETURNING 1
  )
  SELECT count(*) FROM changed;
")"
stale_failure="$(outbox_sql "
  WITH changed AS (
    UPDATE \"outbox_entries\"
    SET \"status\"='PENDING', \"retryCount\"=\"retryCount\"+1, \"lastError\"='stale mutation',
        \"nextRetryAt\"=NOW()+INTERVAL '5 seconds', \"leaseOwner\"=NULL, \"leaseToken\"=NULL,
        \"leaseExpiresAt\"=NULL, \"heartbeatAt\"=NULL
    WHERE \"id\"='${escaped_entry_id}'
      AND \"leaseOwner\"='${escaped_owner}'
      AND \"leaseToken\"='${escaped_token}'
      AND \"status\"='PROCESSING'
    RETURNING 1
  )
  SELECT count(*) FROM changed;
")"
printf '%s\n' "$stale_heartbeat" > "$RUNTIME_DIR/stale-heartbeat-mutations.txt"
printf '%s\n' "$stale_ack" > "$RUNTIME_DIR/stale-ack-mutations.txt"
printf '%s\n' "$stale_failure" > "$RUNTIME_DIR/stale-failure-mutations.txt"
test "$stale_heartbeat" = "0"
test "$stale_ack" = "0"
test "$stale_failure" = "0"
printf 'heartbeat=%s ack=%s failure=%s\n' "$stale_heartbeat" "$stale_ack" "$stale_failure" \
  > "$RUNTIME_DIR/stale-token-summary.txt"

FAILURE_REASON="poison message did not dead-letter independently of healthy entries"
poison_suffix="poison"
healthy_suffix="poison-healthy"
admin_sql "
  INSERT INTO \"outbox_entries\"
    (\"type\", \"payload\", \"status\", \"idempotencyKey\", \"maxRetries\", \"retryCount\",
     \"nextRetryAt\", \"correlationId\")
  VALUES (
    '${RUN_ID}.${poison_suffix}',
    jsonb_build_object('runId','${RUN_ID}','blob',repeat('x',2097152)),
    'PENDING',
    '${RUN_ID}.${poison_suffix}.1',
    2,
    0,
    NOW()-INTERVAL '1 second',
    '${RUN_ID}.${poison_suffix}'
  );
" >/dev/null
test "$(seed_small_entries "$healthy_suffix" 20 10)" = "20"
wait_for_sql "healthy entries beside poison" "20" 60 \
  "SELECT count(*) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${healthy_suffix}' AND \"status\"='SENT';" \
  >/dev/null
admin_sql "
  UPDATE \"outbox_entries\"
  SET \"nextRetryAt\"=NOW()-INTERVAL '1 second'
  WHERE \"correlationId\"='${RUN_ID}.${poison_suffix}' AND \"status\"='PENDING';
" >/dev/null
wait_for_sql "poison dead letter" "1" 60 \
  "SELECT count(*) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${poison_suffix}' AND \"status\"='DEAD_LETTER';" \
  >/dev/null
poison_dead="$(count_status "$poison_suffix" DEAD_LETTER)"
poison_healthy="$(count_status "$healthy_suffix" SENT)"
printf '%s\n' "$poison_dead" > "$RUNTIME_DIR/poison-dead-letters.txt"
printf '%s\n' "$poison_healthy" > "$RUNTIME_DIR/poison-healthy-delivered.txt"
poison_error="$(admin_sql "
  SELECT left(COALESCE(\"lastError\",''),500)
  FROM \"outbox_entries\"
  WHERE \"correlationId\"='${RUN_ID}.${poison_suffix}'
  LIMIT 1;
")"
test -n "$poison_error"
printf 'deadLetters=%s healthyDelivered=%s error=%s\n' \
  "$poison_dead" "$poison_healthy" "$poison_error" \
  > "$RUNTIME_DIR/poison-summary.txt"

FAILURE_REASON="worker did not scale independently or backlog recovery SLA was violated"
api_before_scale="$(api_ready_replicas)"
test "$api_before_scale" = "2"
kubectl scale deployment grainflow-outbox-worker -n "$NAMESPACE" --replicas=3
wait_for_deployment_ready grainflow-outbox-worker 3
scaled_workers="$(worker_ready_replicas)"
api_during_scale="$(api_ready_replicas)"
printf '%s\n' "$scaled_workers" > "$RUNTIME_DIR/scaled-worker-replicas.txt"
printf '%s\n' "$api_during_scale" > "$RUNTIME_DIR/api-replicas-during-worker-scale.txt"
test "$scaled_workers" = "3"
test "$api_during_scale" = "2"

backlog_suffix="backlog"
backlog_count=300
test "$(seed_small_entries "$backlog_suffix" "$backlog_count" 10)" = "$backlog_count"
printf '%s\n' "$backlog_count" > "$RUNTIME_DIR/backlog-entry-count.txt"
backlog_started="$(date +%s)"
wait_for_sql "scaled backlog recovery" "$backlog_count" 60 \
  "SELECT count(*) FROM \"outbox_entries\" WHERE \"correlationId\"='${RUN_ID}.${backlog_suffix}' AND \"status\"='SENT';" \
  >/dev/null
backlog_seconds=$(( $(date +%s) - backlog_started ))
printf '%s\n' "$backlog_seconds" > "$RUNTIME_DIR/backlog-recovery-seconds.txt"

kafka_pod="$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=kafka -o jsonpath='{.items[0].metadata.name}')"
set +e
kubectl exec -n "$NAMESPACE" "pod/${kafka_pod}" -- \
  kafka-console-consumer \
    --bootstrap-server localhost:9092 \
    --topic grainflow.domain.events \
    --from-beginning \
    --timeout-ms 30000 \
    --property print.headers=true \
    --property print.value=false \
  > "$RUNTIME_DIR/kafka-backlog-consumer.log" 2> "$RUNTIME_DIR/kafka-backlog-consumer.stderr"
consumer_status=$?
set -e
# Kafka console consumer exits non-zero on timeout after draining available records.
test "$consumer_status" = "0" || test "$consumer_status" = "1"

admin_sql "
  SELECT \"id\"
  FROM \"outbox_entries\"
  WHERE \"correlationId\"='${RUN_ID}.${backlog_suffix}'
  ORDER BY \"id\";
" > "$RUNTIME_DIR/backlog-entry-ids.txt"
grep -Eo 'x-outbox-id:[^,[:space:]]+' "$RUNTIME_DIR/kafka-backlog-consumer.log" \
  | sed 's/^x-outbox-id://' \
  | grep -F -x -f "$RUNTIME_DIR/backlog-entry-ids.txt" \
  | sort \
  > "$RUNTIME_DIR/backlog-delivered-ids-sorted.txt" || true
sort "$RUNTIME_DIR/backlog-entry-ids.txt" > "$RUNTIME_DIR/backlog-entry-ids-sorted.txt"
missing_deliveries="$(
  comm -23 "$RUNTIME_DIR/backlog-entry-ids-sorted.txt" \
    "$RUNTIME_DIR/backlog-delivered-ids-sorted.txt" | wc -l | tr -d ' '
)"
duplicate_deliveries="$(
  uniq -d "$RUNTIME_DIR/backlog-delivered-ids-sorted.txt" | wc -l | tr -d ' '
)"
printf '%s\n' "$missing_deliveries" > "$RUNTIME_DIR/missing-kafka-deliveries.txt"
printf '%s\n' "$duplicate_deliveries" > "$RUNTIME_DIR/duplicate-kafka-deliveries.txt"
test "$missing_deliveries" = "0"
test "$duplicate_deliveries" = "0"
test "$backlog_seconds" -le 60
printf 'entries=%s delivered=%s recoverySeconds=%s workerReplicas=%s apiReplicas=%s missing=%s duplicate=%s\n' \
  "$backlog_count" "$backlog_count" "$backlog_seconds" "$scaled_workers" "$api_during_scale" \
  "$missing_deliveries" "$duplicate_deliveries" \
  > "$RUNTIME_DIR/backlog-summary.txt"

kubectl scale deployment grainflow-outbox-worker -n "$NAMESPACE" --replicas=2
wait_for_deployment_ready grainflow-outbox-worker 2
final_workers="$(worker_ready_replicas)"
printf '%s\n' "$final_workers" > "$RUNTIME_DIR/final-worker-replicas.txt"
test "$final_workers" = "2"
test "$(api_ready_replicas)" = "2"

kubectl logs -n "$NAMESPACE" -l "$WORKER_SELECTOR" --all-containers=true --prefix=true --tail=1000 \
  > "$RUNTIME_DIR/final-worker-logs.txt" 2>&1
runtime_errors="$({
  grep -Eic 'Raw query failed|permission denied|violates the production boundary|uncaught exception|unhandled rejection' \
    "$RUNTIME_DIR/final-worker-logs.txt" || true
} | tail -1)"
printf '%s\n' "${runtime_errors:-0}" > "$RUNTIME_DIR/final-runtime-errors.txt"
test "${runtime_errors:-0}" = "0"

delete_run_rows
RESULT="PASS"
FAILURE_REASON=""
