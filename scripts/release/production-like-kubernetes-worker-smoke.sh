#!/usr/bin/env bash
set -Eeuo pipefail

RESULT="failed"
FAILURE_REASON="outbox worker runtime smoke failed"

# This is deliberately narrower than #2649. It proves the accepted worker can
# execute its empty/backlog claim loop under the dedicated app_outbox principal
# without RLS, SQL or drain failures. Lease-kill, Kafka outage, poison event and
# backlog recovery scenarios remain open in #2649.
sleep 5
kubectl logs -n "$NAMESPACE" \
  -l app.kubernetes.io/name=grainflow-outbox-worker \
  --all-containers=true --prefix=true --since=45s \
  > "$K8S_DIR/cluster/outbox-worker-runtime-smoke.log" 2>&1

outbox_worker_runtime_errors="$({
  grep -Eic 'Outbox drain failed|Raw query failed|permission denied|violates the production boundary' \
    "$K8S_DIR/cluster/outbox-worker-runtime-smoke.log" || true
} | tail -1)"
printf '%s\n' "${outbox_worker_runtime_errors:-0}" \
  > "$K8S_DIR/cluster/outbox-worker-runtime-errors.txt"
test "${outbox_worker_runtime_errors:-0}" = "0"

grep -q 'Outbox database principal verified: app_outbox' \
  "$K8S_DIR/cluster/outbox-worker-runtime-smoke.log"

RESULT="passed"
FAILURE_REASON=""
