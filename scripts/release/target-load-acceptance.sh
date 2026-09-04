#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

NAMESPACE="${NAMESPACE:-grainflow-acceptance}"
PROFILE="${TARGET_LOAD_PROFILE:-target}"
ROOT_EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness}"
EVIDENCE_DIR="${TARGET_LOAD_EVIDENCE_DIR:-${ROOT_EVIDENCE_DIR}/target-load}"
EXACT_HEAD="${EXACT_HEAD:?EXACT_HEAD is required}"
TARGET_LOAD_BASE_URL="${TARGET_LOAD_BASE_URL:-http://127.0.0.1:8080}"
TARGET_LOAD_INGRESS_HOST="${TARGET_LOAD_INGRESS_HOST:-api.acceptance.grainflow.invalid}"
TOKENS_FILE="$(mktemp /tmp/grainflow-target-load-tokens.XXXXXX.json)"
STARTED_EPOCH="$(date +%s)"
FINALIZED=false

mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"

for command in kubectl k6 node jq base64 git; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 2; }
done
test "$(git rev-parse HEAD)" = "$EXACT_HEAD"

case "$PROFILE" in
  target)
    export TARGET_LOAD_BUYER_SESSIONS="${TARGET_LOAD_BUYER_SESSIONS:-5000}"
    export TARGET_LOAD_COMPLIANCE_SESSIONS="${TARGET_LOAD_COMPLIANCE_SESSIONS:-100}"
    export TARGET_LOAD_SESSIONS="${TARGET_LOAD_SESSIONS:-5000}"
    export TARGET_LOAD_DEALS="${TARGET_LOAD_DEALS:-50000}"
    export TARGET_LOAD_EVENTS="${TARGET_LOAD_EVENTS:-10000000}"
    export TARGET_LOAD_BANK_OPERATIONS="${TARGET_LOAD_BANK_OPERATIONS:-1000}"
    export TARGET_LOAD_SUSTAINED_RPS="${TARGET_LOAD_SUSTAINED_RPS:-500}"
    export TARGET_LOAD_COMMAND_RPS="${TARGET_LOAD_COMMAND_RPS:-20}"
    export TARGET_LOAD_SUSTAINED_DURATION="${TARGET_LOAD_SUSTAINED_DURATION:-30m}"
    export TARGET_LOAD_BURST_RPS="${TARGET_LOAD_BURST_RPS:-1000}"
    export TARGET_LOAD_BURST_DURATION="${TARGET_LOAD_BURST_DURATION:-5m}"
    export TARGET_LOAD_BID_RPS="${TARGET_LOAD_BID_RPS:-200}"
    export TARGET_LOAD_BID_DURATION="${TARGET_LOAD_BID_DURATION:-5m}"
    export TARGET_LOAD_BANK_BATCH_RPS="${TARGET_LOAD_BANK_BATCH_RPS:-100}"
    export TARGET_LOAD_BANK_DURATION="${TARGET_LOAD_BANK_DURATION:-1m}"
    ;;
  smoke)
    export TARGET_LOAD_BUYER_SESSIONS="${TARGET_LOAD_BUYER_SESSIONS:-100}"
    export TARGET_LOAD_COMPLIANCE_SESSIONS="${TARGET_LOAD_COMPLIANCE_SESSIONS:-10}"
    export TARGET_LOAD_SESSIONS="${TARGET_LOAD_SESSIONS:-100}"
    export TARGET_LOAD_DEALS="${TARGET_LOAD_DEALS:-1000}"
    export TARGET_LOAD_EVENTS="${TARGET_LOAD_EVENTS:-100000}"
    export TARGET_LOAD_BANK_OPERATIONS="${TARGET_LOAD_BANK_OPERATIONS:-100}"
    export TARGET_LOAD_EVENT_BATCH_SIZE="${TARGET_LOAD_EVENT_BATCH_SIZE:-50000}"
    export TARGET_LOAD_SUSTAINED_RPS="${TARGET_LOAD_SUSTAINED_RPS:-25}"
    export TARGET_LOAD_COMMAND_RPS="${TARGET_LOAD_COMMAND_RPS:-2}"
    export TARGET_LOAD_SUSTAINED_DURATION="${TARGET_LOAD_SUSTAINED_DURATION:-1m}"
    export TARGET_LOAD_BURST_RPS="${TARGET_LOAD_BURST_RPS:-50}"
    export TARGET_LOAD_BURST_DURATION="${TARGET_LOAD_BURST_DURATION:-30s}"
    export TARGET_LOAD_BID_RPS="${TARGET_LOAD_BID_RPS:-10}"
    export TARGET_LOAD_BID_DURATION="${TARGET_LOAD_BID_DURATION:-30s}"
    export TARGET_LOAD_BANK_BATCH_RPS="${TARGET_LOAD_BANK_BATCH_RPS:-5}"
    export TARGET_LOAD_BANK_DURATION="${TARGET_LOAD_BANK_DURATION:-15s}"
    export TARGET_LOAD_READ_PREALLOCATED_VUS="${TARGET_LOAD_READ_PREALLOCATED_VUS:-50}"
    export TARGET_LOAD_BURST_PREALLOCATED_VUS="${TARGET_LOAD_BURST_PREALLOCATED_VUS:-100}"
    export TARGET_LOAD_BID_PREALLOCATED_VUS="${TARGET_LOAD_BID_PREALLOCATED_VUS:-100}"
    export TARGET_LOAD_BANK_PREALLOCATED_VUS="${TARGET_LOAD_BANK_PREALLOCATED_VUS:-50}"
    ;;
  *) echo "TARGET_LOAD_PROFILE must be target or smoke" >&2; exit 2 ;;
esac

export TARGET_LOAD_PROFILE="$PROFILE"
export TARGET_LOAD_BASE_URL TARGET_LOAD_INGRESS_HOST EVIDENCE_DIR EXACT_HEAD
export TARGET_LOAD_STARTED_EPOCH="$STARTED_EPOCH"

secret_value() {
  local secret_name="$1"
  local key="$2"
  kubectl get secret "$secret_name" -n "$NAMESPACE" -o "jsonpath={.data.${key}}" | base64 --decode
}

export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(secret_value grainflow-postgresql-secrets POSTGRES_PASSWORD)}"
export JWT_SECRET="${JWT_SECRET:-$(secret_value grainflow-api-secrets JWT_SECRET)}"
export BANK_HMAC_SECRET="${BANK_HMAC_SECRET:-$(secret_value grainflow-api-secrets BANK_HMAC_SECRET)}"
printf '::add-mask::%s\n' "$POSTGRES_PASSWORD"
printf '::add-mask::%s\n' "$JWT_SECRET"
printf '::add-mask::%s\n' "$BANK_HMAC_SECRET"

psql_admin() {
  kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U postgres -d grainflow "$@"
}

write_environment() {
  local api_replicas web_replicas worker_replicas pgbouncer_replicas
  api_replicas="$(kubectl get deployment grainflow-api -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  web_replicas="$(kubectl get deployment grainflow-web -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  worker_replicas="$(kubectl get deployment grainflow-outbox-worker -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  pgbouncer_replicas="$(kubectl get deployment pgbouncer -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  jq -n \
    --arg exactHead "$EXACT_HEAD" \
    --arg profile "$PROFILE" \
    --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg kernel "$(uname -srmo)" \
    --argjson cpuCount "$(getconf _NPROCESSORS_ONLN)" \
    --arg memory "$(awk '/MemTotal/ {print $2 " " $3}' /proc/meminfo)" \
    --arg k6 "$(k6 version | head -1)" \
    --arg kubernetes "$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')" \
    --arg apiReplicas "${api_replicas:-0}" \
    --arg webReplicas "${web_replicas:-0}" \
    --arg workerReplicas "${worker_replicas:-0}" \
    --arg pgbouncerReplicas "${pgbouncer_replicas:-0}" \
    '{schemaVersion:1,exactHead:$exactHead,profile:$profile,generatedAt:$generatedAt,runner:{kernel:$kernel,cpuCount:$cpuCount,memory:$memory},tools:{k6:$k6,kubernetes:$kubernetes},readyReplicas:{api:($apiReplicas|tonumber),web:($webReplicas|tonumber),outboxWorker:($workerReplicas|tonumber),pgbouncer:($pgbouncerReplicas|tonumber)}}' \
    > "$EVIDENCE_DIR/environment.json"
}

finalize() {
  local status="$1"
  [[ "$FINALIZED" = true ]] && return
  FINALIZED=true
  rm -f "$TOKENS_FILE"
  write_environment || true
  if [[ ! -f "$EVIDENCE_DIR/database-reconciliation.json" ]]; then
    EVIDENCE_DIR="$EVIDENCE_DIR" TARGET_LOAD_STARTED_EPOCH="$STARTED_EPOCH" \
      bash scripts/release/target-load-reconcile.sh || true
  fi
  EVIDENCE_DIR="$EVIDENCE_DIR" TARGET_LOAD_PROFILE="$PROFILE" EXACT_HEAD="$EXACT_HEAD" \
    node scripts/release/build-target-load-verdict.mjs "$EVIDENCE_DIR" || true
  kubectl get events -n "$NAMESPACE" --sort-by=.lastTimestamp \
    > "$EVIDENCE_DIR/kubernetes-events.txt" 2>&1 || true
  kubectl logs -n "$NAMESPACE" -l app.kubernetes.io/name=grainflow-api \
    --all-containers=true --prefix=true --tail=2000 \
    > "$EVIDENCE_DIR/api-tail.log" 2>&1 || true
  return "$status"
}

on_exit() {
  local status=$?
  trap - EXIT
  finalize "$status" || true
  exit "$status"
}
trap on_exit EXIT

write_environment

echo "[target-load] raising only acceptance-environment rate ceilings"
kubectl set env deployment/grainflow-api -n "$NAMESPACE" \
  RATE_LIMIT_GENERAL=100000 \
  RATE_LIMIT_GENERAL_WINDOW_SECONDS=60 \
  RATE_LIMIT_BANK_CALLBACK=100000 \
  RATE_LIMIT_BANK_CALLBACK_WINDOW_SECONDS=60 \
  LOG_LEVEL=warn \
  > "$EVIDENCE_DIR/api-load-runtime-env.log"
kubectl rollout status deployment/grainflow-api -n "$NAMESPACE" --timeout=600s

EVIDENCE_DIR="$EVIDENCE_DIR" bash scripts/release/target-load-seed.sh
node scripts/release/build-target-load-tokens.mjs "$TOKENS_FILE" \
  > "$EVIDENCE_DIR/token-generation-summary.json"

run_k6() {
  local scenario="$1"
  local exit_status
  echo "[target-load] running ${scenario} scenario"
  set +e
  TARGET_LOAD_SCENARIO="$scenario" \
  TARGET_LOAD_TOKENS_FILE="$TOKENS_FILE" \
  TARGET_LOAD_RESULT_PATH="$EVIDENCE_DIR/${scenario}.json" \
  k6 run --quiet infra/k6/target-load-acceptance.js \
    > "$EVIDENCE_DIR/${scenario}.stdout.log" \
    2> "$EVIDENCE_DIR/${scenario}.stderr.log"
  exit_status=$?
  set -e
  printf '%s\n' "$exit_status" > "$EVIDENCE_DIR/${scenario}.exit-status.txt"
}

run_k6 session
run_k6 sustained

echo "[target-load] scaling API independently from two to three replicas for burst/concurrency phases"
kubectl scale deployment/grainflow-api -n "$NAMESPACE" --replicas=3 \
  > "$EVIDENCE_DIR/api-scale-out.log"
kubectl rollout status deployment/grainflow-api -n "$NAMESPACE" --timeout=600s
test "$(kubectl get deployment grainflow-api -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')" = "3"

echo "[target-load] scaling the outbox plane independently for write-heavy phases"
kubectl set env deployment/grainflow-outbox-worker -n "$NAMESPACE" \
  OUTBOX_WORKER_BATCH_SIZE=200 \
  > "$EVIDENCE_DIR/outbox-worker-load-runtime-env.log"
kubectl scale deployment/grainflow-outbox-worker -n "$NAMESPACE" --replicas=3 \
  > "$EVIDENCE_DIR/outbox-worker-scale-out.log"
kubectl rollout status deployment/grainflow-outbox-worker -n "$NAMESPACE" --timeout=600s
test "$(kubectl get deployment grainflow-outbox-worker -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')" = "3"

run_k6 burst
run_k6 bid

# The duplicate-callback scenario starts from the exact persisted state that a
# bank request transaction leaves behind. Pause the generic Kafka outbox worker
# while these callback-specific rows are installed and consumed, otherwise it
# would race the callback by moving the same PENDING receipt to SENT.
echo "[target-load] preparing isolated pending bank-request receipts"
kubectl scale deployment/grainflow-outbox-worker -n "$NAMESPACE" --replicas=0 \
  > "$EVIDENCE_DIR/outbox-worker-bank-pause.log"
kubectl wait --for=delete pod -n "$NAMESPACE" \
  -l app.kubernetes.io/name=grainflow-outbox-worker --timeout=300s
psql_admin <<'SQL' > "$EVIDENCE_DIR/bank-request-outbox-seed.log"
INSERT INTO public.outbox_entries (
  id, type, "dealId", payload, status, "idempotencyKey", "maxRetries",
  "retryCount", "nextRetryAt", "correlationId", "createdAt"
)
SELECT
  'load-bank-outbox-' || substring(operation.id from '([0-9]+)$'),
  'BANK_RESERVE_REQUEST', operation.deal_id,
  jsonb_build_object(
    'dealId', operation.deal_id,
    'operationId', operation.id,
    'operation', operation.operation_type,
    'amountKopecks', operation.amount_minor::text,
    'partnerId', operation.required_partner_id,
    'requestFingerprint', operation.request_fingerprint
  ),
  'PENDING', 'settlement-bank-request:' || operation.id, 8, 0,
  clock_timestamp(), operation.command_id, clock_timestamp()
FROM settlement.bank_operations operation
WHERE operation.id LIKE 'load-bank-operation-%'
ON CONFLICT (id) DO NOTHING;
SQL
run_k6 bank

kubectl scale deployment/grainflow-outbox-worker -n "$NAMESPACE" --replicas=3 \
  > "$EVIDENCE_DIR/outbox-worker-bank-resume.log"
kubectl rollout status deployment/grainflow-outbox-worker -n "$NAMESPACE" --timeout=600s

kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U postgres -d grainflow \
  -c "UPDATE auction.lots SET auction_ends_at = clock_timestamp() - interval '1 second' WHERE tenant_id = 'load-tenant' AND id = 'load-hot-lot'" \
  > "$EVIDENCE_DIR/hot-lot-end.log"
run_k6 close

echo "[target-load] waiting for the durable outbox to drain"
if [[ "$PROFILE" = target ]]; then
  drain_timeout_seconds=600
else
  drain_timeout_seconds=120
fi
drain_deadline=$(( $(date +%s) + drain_timeout_seconds ))
while true; do
  pending_outbox="$(psql_admin -Atc "SELECT count(*) FROM public.outbox_entries WHERE status IN ('PENDING','PROCESSING')")"
  printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$pending_outbox" \
    >> "$EVIDENCE_DIR/outbox-drain.tsv"
  [[ "$pending_outbox" = "0" ]] && break
  (( $(date +%s) >= drain_deadline )) && break
  sleep 10
done

EVIDENCE_DIR="$EVIDENCE_DIR" TARGET_LOAD_STARTED_EPOCH="$STARTED_EPOCH" \
  bash scripts/release/target-load-reconcile.sh
write_environment
EVIDENCE_DIR="$EVIDENCE_DIR" TARGET_LOAD_PROFILE="$PROFILE" EXACT_HEAD="$EXACT_HEAD" \
  node scripts/release/build-target-load-verdict.mjs "$EVIDENCE_DIR"

FINALIZED=true
rm -f "$TOKENS_FILE"
verdict="$(jq -r '.verdict' "$EVIDENCE_DIR/target-load-acceptance.json")"
cat "$EVIDENCE_DIR/target-load-acceptance.json"
if [[ "$PROFILE" = target ]]; then
  test "$verdict" = PASS
else
  test "$verdict" = SMOKE_PASS
fi
