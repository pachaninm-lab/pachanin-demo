#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

EXACT_HEAD="${EXACT_HEAD:-${GITHUB_SHA:-unknown}}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness/load}"
RAW_DIR="$EVIDENCE_DIR/raw"
NAMESPACE="grainflow-acceptance"
TOKENS_PATH="$EVIDENCE_DIR/tokens.json"
FAILURE_REASON="target-load acceptance did not start"
SUCCESS=0

SESSION_COUNT=5000
BUYER_COUNT=2500
ISOLATED_COUNT=10
COMPLIANCE_COUNT=$((SESSION_COUNT - BUYER_COUNT - ISOLATED_COUNT))
DEAL_COUNT=50000
DOMAIN_EVENT_COUNT=3333334
AUDIT_EVENT_COUNT=3333333
OUTBOX_EVENT_COUNT=3333333
CALLBACK_COUNT=24000
DEAL_UPDATED_AT='2026-07-17T00:00:00.000Z'

mkdir -p "$RAW_DIR"
rm -f "$EVIDENCE_DIR/target-load-acceptance.json" "$EVIDENCE_DIR/failure-reason.txt" "$TOKENS_PATH"

mask() { printf '::add-mask::%s\n' "$1"; }

collect_diagnostics() {
  set +e
  kubectl get nodes -o wide > "$RAW_DIR/nodes.txt" 2>&1
  kubectl get deployments,pods,services -n "$NAMESPACE" -o wide > "$RAW_DIR/kubernetes-inventory.txt" 2>&1
  kubectl get events -n "$NAMESPACE" --sort-by=.lastTimestamp > "$RAW_DIR/events.txt" 2>&1
  kubectl logs -n "$NAMESPACE" deployment/grainflow-api --all-containers=true --tail=1000 > "$RAW_DIR/api.log" 2>&1
  kubectl logs -n "$NAMESPACE" deployment/grainflow-outbox-worker --all-containers=true --tail=1000 > "$RAW_DIR/outbox-worker.log" 2>&1
  df -h > "$RAW_DIR/disk.txt" 2>&1
  docker stats --no-stream > "$RAW_DIR/docker-stats.txt" 2>&1
}

on_error() {
  local rc=$?
  set +e
  printf '%s\n' "$FAILURE_REASON" > "$EVIDENCE_DIR/failure-reason.txt"
  collect_diagnostics
  exit "$rc"
}
trap on_error ERR
trap 'rm -f "$TOKENS_PATH"' EXIT

for command in base64 curl docker jq kubectl node openssl; do command -v "$command" >/dev/null; done

POSTGRES_PASSWORD="$(kubectl get secret grainflow-postgresql-secrets -n "$NAMESPACE" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
JWT_SECRET="$(kubectl get secret grainflow-api-secrets -n "$NAMESPACE" -o jsonpath='{.data.JWT_SECRET}' | base64 -d)"
BANK_HMAC_SECRET="$(openssl rand -hex 32)"
mask "$POSTGRES_PASSWORD"
mask "$JWT_SECRET"
mask "$BANK_HMAC_SECRET"

admin_sql() {
  local sql="$1"
  kubectl exec -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$POSTGRES_PASSWORD" \
    psql -v ON_ERROR_STOP=1 -U postgres -d grainflow -Atc "$sql"
}

FAILURE_REASON="canonical Deal seed and load-specific API configuration failed"
kubectl scale deployment/grainflow-api -n "$NAMESPACE" --replicas=1
kubectl rollout status deployment/grainflow-api -n "$NAMESPACE" --timeout=600s
kubectl set env deployment/grainflow-api -n "$NAMESPACE" \
  SEED_CANONICAL_TEST_DEAL=true \
  ALLOW_CANONICAL_TEST_DEAL_IN_PRODUCTION=true \
  RATE_LIMIT_DEAL_COMMAND=1000000 \
  RATE_LIMIT_DEAL_COMMAND_WINDOW_SECONDS=60 \
  RATE_LIMIT_BANK_CALLBACK=1000000 \
  RATE_LIMIT_BANK_CALLBACK_WINDOW_SECONDS=60 \
  BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
  BANK_HMAC_KEY_ID=load-primary \
  BANK_PARTNER_ID=safe-deals
kubectl rollout status deployment/grainflow-api -n "$NAMESPACE" --timeout=900s
for _ in $(seq 1 180); do
  [[ "$(admin_sql "SELECT count(*) FROM public.deals WHERE id='DEAL-INDUSTRIAL-001';")" = "1" ]] && break
  sleep 2
done
[[ "$(admin_sql "SELECT count(*) FROM public.deals WHERE id='DEAL-INDUSTRIAL-001';")" = "1" ]]

FAILURE_REASON="target-load dataset generation failed"
kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
  env PGPASSWORD="$POSTGRES_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U postgres -d grainflow \
    -v session_count="$SESSION_COUNT" \
    -v buyer_count="$BUYER_COUNT" \
    -v isolated_count="$ISOLATED_COUNT" \
    -v compliance_count="$COMPLIANCE_COUNT" \
    -v deal_count="$DEAL_COUNT" \
    -v domain_event_count="$DOMAIN_EVENT_COUNT" \
    -v audit_event_count="$AUDIT_EVENT_COUNT" \
    -v outbox_event_count="$OUTBOX_EVENT_COUNT" \
    -v callback_count="$CALLBACK_COUNT" \
    -v deal_updated_at="$DEAL_UPDATED_AT" \
  < infra/kind/target-load/seed.sql \
  2>&1 | tee "$RAW_DIR/seed.log"

FAILURE_REASON="5,000 distinct access-session tokens could not be generated"
JWT_SECRET="$JWT_SECRET" \
TOKENS_PATH="$TOKENS_PATH" \
SESSION_COUNT="$SESSION_COUNT" \
BUYER_COUNT="$BUYER_COUNT" \
ISOLATED_COUNT="$ISOLATED_COUNT" \
node scripts/release/target-load-generate-tokens.mjs | tee "$RAW_DIR/token-generation.json"
chmod 0600 "$TOKENS_PATH"
[[ "$(jq -r '.sessionCount' "$TOKENS_PATH")" = "$SESSION_COUNT" ]]
[[ "$(jq -r '.all | length' "$TOKENS_PATH")" = "$SESSION_COUNT" ]]

FAILURE_REASON="horizontal application and worker scale-out failed"
kubectl scale deployment/grainflow-api -n "$NAMESPACE" --replicas=4
kubectl scale deployment/grainflow-outbox-worker -n "$NAMESPACE" --replicas=4
kubectl rollout status deployment/grainflow-api -n "$NAMESPACE" --timeout=900s
kubectl rollout status deployment/grainflow-outbox-worker -n "$NAMESPACE" --timeout=900s
[[ "$(kubectl get deployment grainflow-api -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')" = "4" ]]
[[ "$(kubectl get deployment grainflow-outbox-worker -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')" = "4" ]]

K6_TAG="grafana/k6:1.7.1"
FAILURE_REASON="pinned k6 load generator could not be resolved"
docker pull "$K6_TAG" > "$RAW_DIR/k6-image-pull.log"
K6_REPO_DIGEST="$(docker image inspect "$K6_TAG" --format '{{index .RepoDigests 0}}')"
K6_IMAGE="${K6_TAG}@${K6_REPO_DIGEST#*@}"
[[ "$K6_IMAGE" == *:*@sha256:* ]]
printf '%s\n' "$K6_IMAGE" > "$RAW_DIR/k6-image.txt"

curl_api() {
  local path="$1"
  curl --fail --silent --show-error --max-time 10 --retry 3 --retry-all-errors \
    --resolve api.acceptance.grainflow.invalid:8080:127.0.0.1 \
    "http://api.acceptance.grainflow.invalid:8080${path}"
}
curl_api /ready > "$RAW_DIR/api-ready-before-load.json"
curl_api /metrics > "$RAW_DIR/api-metrics-before.prom"

run_profile() {
  local profile="$1"
  local summary="$RAW_DIR/k6-${profile}-summary.json"
  local json_output="$RAW_DIR/k6-${profile}-samples.json"
  docker run --rm --network host \
    -v "$ROOT_DIR:/work:ro" \
    -v "$(cd "$EVIDENCE_DIR" && pwd):/evidence" \
    -e PROFILE="$profile" \
    -e BASE_URL=http://127.0.0.1:8080 \
    -e HOST_HEADER=api.acceptance.grainflow.invalid \
    -e TOKENS_PATH=/evidence/tokens.json \
    -e K6_SUMMARY_PATH="/evidence/raw/k6-${profile}-summary.json" \
    -e BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
    -e BANK_HMAC_KEY_ID=load-primary \
    -e BANK_PARTNER_ID=safe-deals \
    -e DEAL_UPDATED_AT="$DEAL_UPDATED_AT" \
    "$K6_IMAGE" run --out "json=/evidence/raw/k6-${profile}-samples.json" \
    /work/scripts/release/target-load.k6.js \
    2>&1 | tee "$RAW_DIR/k6-${profile}.log"
  test -s "$summary"
  test -s "$json_output"
}

FAILURE_REASON="5,000 distinct authenticated sessions were not accepted"
run_profile sessions

FAILURE_REASON="tenant isolation acceptance failed"
run_profile isolation

FAILURE_REASON="500 RPS sustained profile or zero-downtime scale cycle failed"
run_profile sustained &
SUSTAINED_PID=$!
SCALE_EVENTS="$RAW_DIR/scale-events.jsonl"
printf '{"event":"sustained_started","at":"%s","apiReplicas":4}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SCALE_EVENTS"
sleep 300
kubectl scale deployment/grainflow-api -n "$NAMESPACE" --replicas=6
kubectl rollout status deployment/grainflow-api -n "$NAMESPACE" --timeout=900s
curl_api /ready > "$RAW_DIR/api-ready-scale-out.json"
printf '{"event":"api_scale_out","at":"%s","apiReplicas":6}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$SCALE_EVENTS"
sleep 300
kubectl scale deployment/grainflow-api -n "$NAMESPACE" --replicas=4
kubectl rollout status deployment/grainflow-api -n "$NAMESPACE" --timeout=900s
curl_api /ready > "$RAW_DIR/api-ready-scale-in.json"
printf '{"event":"api_scale_in","at":"%s","apiReplicas":4}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$SCALE_EVENTS"
wait "$SUSTAINED_PID"
printf '{"event":"sustained_completed","at":"%s","apiReplicas":4}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$SCALE_EVENTS"
jq -s '.' "$SCALE_EVENTS" > "$RAW_DIR/scale-events.json"

FAILURE_REASON="1,000 RPS burst profile failed"
run_profile burst

FAILURE_REASON="authoritative Deal command profile failed"
run_profile commands

FAILURE_REASON="200 bids/second hot-lot contention profile failed"
run_profile auction

FAILURE_REASON="signed bank callback storm failed"
run_profile callbacks

FAILURE_REASON="post-load readiness or database invariant reconciliation failed"
curl_api /ready > "$RAW_DIR/api-ready-after-load.json"
curl_api /metrics > "$RAW_DIR/api-metrics-after.prom"

admin_sql "
SELECT jsonb_pretty(jsonb_build_object(
  'activeSessions', (SELECT count(*) FROM auth.sessions WHERE id LIKE 'session-load-%' AND status='ACTIVE'),
  'loadDeals', (SELECT count(*) FROM public.deals WHERE id LIKE 'DEAL-LOAD-%'),
  'domainEvents', (SELECT count(*) FROM public.deal_events WHERE id LIKE 'load-deal-event-%'),
  'auditEvents', (SELECT count(*) FROM public.audit_events WHERE id LIKE 'load-audit-event-%'),
  'outboxEvents', (SELECT count(*) FROM public.outbox_entries WHERE id LIKE 'load-outbox-event-%'),
  'totalSeededEvents', (
    (SELECT count(*) FROM public.deal_events WHERE id LIKE 'load-deal-event-%') +
    (SELECT count(*) FROM public.audit_events WHERE id LIKE 'load-audit-event-%') +
    (SELECT count(*) FROM public.outbox_entries WHERE id LIKE 'load-outbox-event-%')
  ),
  'callbackRows', (SELECT count(*) FROM settlement.bank_callbacks WHERE event_id LIKE 'load-callback-%'),
  'confirmedReserveOperations', (SELECT count(*) FROM settlement.bank_operations WHERE id LIKE 'operation-load-%' AND status='CONFIRMED'),
  'confirmedPayments', (SELECT count(*) FROM settlement.payments WHERE id LIKE 'payment-load-%' AND confirmed_reserved_minor=100000 AND pending_reserved_minor=0),
  'duplicateLedgerEffects', (
    SELECT count(*) FROM (
      SELECT operation_id FROM settlement.ledger_entries
      WHERE operation_id LIKE 'operation-load-%'
      GROUP BY operation_id HAVING count(*) <> 1
    ) duplicate_effects
  ),
  'doubleAuctionWinners', (
    SELECT count(*) FROM (
      SELECT tenant_id, lot_id FROM auction.awards
      GROUP BY tenant_id, lot_id HAVING count(*) > 1
    ) duplicate_winners
  ),
  'hotLotBidRows', (SELECT count(*) FROM auction.bids WHERE lot_id='lot-load-hot'),
  'activeLeaseDuplicates', (
    SELECT count(*) FROM (
      SELECT lease_token FROM public.outbox_entries
      WHERE lease_token IS NOT NULL GROUP BY lease_token HAVING count(*) > 1
    ) duplicate_leases
  ),
  'databaseSizeBytes', pg_database_size(current_database())
));
" > "$RAW_DIR/db-invariants.json"

kubectl get deployments grainflow-api grainflow-outbox-worker pgbouncer -n "$NAMESPACE" -o json | \
  jq '{deployments:[.items[]|{name:.metadata.name,desired:.spec.replicas,ready:.status.readyReplicas,available:.status.availableReplicas,image:.spec.template.spec.containers[0].image}]}' \
  > "$RAW_DIR/topology.json"

node scripts/release/target-load-build-evidence.mjs
node scripts/release/enforce-target-load-evidence.mjs
collect_diagnostics
SUCCESS=1
printf 'Target load acceptance PASS for %s\n' "$EXACT_HEAD"
