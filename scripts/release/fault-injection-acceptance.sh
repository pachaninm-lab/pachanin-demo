#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export EXACT_HEAD="${EXACT_HEAD:?EXACT_HEAD is required}"
export EVIDENCE_ROOT="${EVIDENCE_DIR:-artifacts/industrial-readiness}"
export FAULT_DIR="$EVIDENCE_ROOT/fault"
export RAW_DIR="$FAULT_DIR/raw"
export NAMESPACE="grainflow-acceptance"
export DEAL_ID="DEAL-INDUSTRIAL-001"
export RUN_ID="fault-${EXACT_HEAD:0:12}"
export FAILURE_REASON="fault acceptance did not start"

mkdir -p "$RAW_DIR"
rm -f "$FAULT_DIR/acceptance-complete" "$FAULT_DIR/failure-reason.txt"
printf '%s\n' "$EXACT_HEAD" > "$FAULT_DIR/exact-head.txt"
date -u +%Y-%m-%dT%H:%M:%SZ > "$FAULT_DIR/started-at.txt"
date +%s > "$FAULT_DIR/started-epoch.txt"

on_exit() {
  local rc=$?
  set +e
  date -u +%Y-%m-%dT%H:%M:%SZ > "$FAULT_DIR/completed-at.txt"
  date +%s > "$FAULT_DIR/completed-epoch.txt"
  if (( rc != 0 )); then printf '%s\n' "$FAILURE_REASON" > "$FAULT_DIR/failure-reason.txt"; fi
  kubectl scale deployment/grainflow-api -n "$NAMESPACE" --replicas=2 >/dev/null 2>&1 || true
  kubectl scale deployment/pgbouncer -n "$NAMESPACE" --replicas=2 >/dev/null 2>&1 || true
  kubectl scale deployment/minio -n "$NAMESPACE" --replicas=1 >/dev/null 2>&1 || true
  kubectl scale deployment/kafka -n "$NAMESPACE" --replicas=1 >/dev/null 2>&1 || true
  kubectl delete pod fault-object-client -n "$NAMESPACE" --ignore-not-found --wait=false >/dev/null 2>&1 || true
  kubectl get nodes -o wide > "$RAW_DIR/nodes.txt" 2>&1 || true
  kubectl get deployments,statefulsets,pods,services,pdb -n "$NAMESPACE" -o wide > "$RAW_DIR/kubernetes-inventory.txt" 2>&1 || true
  kubectl get events -n "$NAMESPACE" --sort-by=.lastTimestamp > "$RAW_DIR/events.txt" 2>&1 || true
  exit "$rc"
}
trap on_exit EXIT

for part in scripts/release/fault-injection-acceptance.d/*.part; do
  source "$part"
done
