#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${NAMESPACE:-grainflow-acceptance}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness/load}"
STARTED_EPOCH="${TARGET_LOAD_STARTED_EPOCH:-0}"

mkdir -p "$EVIDENCE_DIR"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  POSTGRES_PASSWORD="$(
    kubectl get secret grainflow-postgresql-secrets -n "$NAMESPACE" \
      -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 --decode
  )"
fi
[[ -n "$POSTGRES_PASSWORD" ]] || { echo "POSTGRES_PASSWORD could not be resolved" >&2; exit 2; }

psql_admin() {
  kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U postgres -d grainflow "$@"
}

echo "[target-load] reconciling PostgreSQL authority"
psql_admin -At -v started_epoch="$STARTED_EPOCH" <<'SQL' > "$EVIDENCE_DIR/database-reconciliation.json"
SELECT jsonb_pretty(jsonb_build_object(
  'schemaVersion', 1,
  'observedAt', clock_timestamp(),
  'sessions', jsonb_build_object(
    'buyersSeeded', (SELECT count(*) FROM auth.sessions WHERE id LIKE 'load-buyer-session-%'),
    'buyersTouched', (SELECT count(*) FROM auth.sessions WHERE id LIKE 'load-buyer-session-%' AND last_seen_at >= to_timestamp(:'started_epoch'::bigint)),
    'complianceSeeded', (SELECT count(*) FROM auth.sessions WHERE id LIKE 'load-compliance-session-%'),
    'active', (SELECT count(*) FROM auth.sessions WHERE id LIKE 'load-%-session-%' AND status = 'ACTIVE')
  ),
  'deals', jsonb_build_object(
    'seeded', (SELECT count(*) FROM public.deals WHERE id LIKE 'load-deal-%'),
    'admissionApproved', (SELECT count(*) FROM public.deals WHERE id LIKE 'load-deal-%' AND status = 'ADMISSION_APPROVED'),
    'bankConfirmed', (SELECT count(*) FROM public.deals WHERE id LIKE 'load-bank-deal-%' AND status = 'RESERVED')
  ),
  'events', jsonb_build_object(
    'baseline', (SELECT count(*) FROM public.deal_events WHERE id LIKE 'load-domain-event-%'),
    'loadTotal', (SELECT count(*) FROM public.deal_events WHERE "tenantId" = 'load-tenant'),
    'commandEvents', (SELECT count(*) FROM public.deal_events WHERE "tenantId" = 'load-tenant' AND "eventType" <> 'LOAD_BASELINE')
  ),
  'auction', jsonb_build_object(
    'lotStatus', COALESCE((SELECT status FROM auction.lots WHERE tenant_id = 'load-tenant' AND id = 'load-hot-lot'), 'MISSING'),
    'bids', (SELECT count(*) FROM auction.bids WHERE tenant_id = 'load-tenant' AND lot_id = 'load-hot-lot'),
    'winningBids', (SELECT count(*) FROM auction.bids WHERE tenant_id = 'load-tenant' AND lot_id = 'load-hot-lot' AND status = 'WINNING'),
    'awards', (SELECT count(*) FROM auction.awards WHERE tenant_id = 'load-tenant' AND lot_id = 'load-hot-lot'),
    'dealAwards', (SELECT count(*) FROM auction.awards WHERE tenant_id = 'load-tenant' AND lot_id = 'load-hot-lot' AND status = 'DEAL_CREATED' AND deal_id IS NOT NULL)
  ),
  'settlement', jsonb_build_object(
    'operations', (SELECT count(*) FROM settlement.bank_operations WHERE id LIKE 'load-bank-operation-%'),
    'confirmedOperations', (SELECT count(*) FROM settlement.bank_operations WHERE id LIKE 'load-bank-operation-%' AND status = 'CONFIRMED'),
    'callbacks', (SELECT count(*) FROM settlement.bank_callbacks WHERE event_id LIKE 'load-bank-event-%'),
    'distinctCallbackEvents', (SELECT count(DISTINCT (partner_id, event_id)) FROM settlement.bank_callbacks WHERE event_id LIKE 'load-bank-event-%'),
    'ledgerEntries', (SELECT count(*) FROM settlement.ledger_entries WHERE operation_id LIKE 'load-bank-operation-%'),
    'duplicateLedgerOperations', (SELECT count(*) FROM (SELECT operation_id FROM settlement.ledger_entries WHERE operation_id LIKE 'load-bank-operation-%' GROUP BY operation_id HAVING count(*) > 1) duplicate_operations),
    'duplicateLedgerIdempotencyKeys', (SELECT count(*) FROM (SELECT idempotency_key FROM settlement.ledger_entries WHERE operation_id LIKE 'load-bank-operation-%' GROUP BY idempotency_key HAVING count(*) > 1) duplicate_keys)
  ),
  'outbox', jsonb_build_object(
    'pending', (SELECT count(*) FROM public.outbox_entries WHERE status IN ('PENDING','PROCESSING')),
    'deadLetters', (SELECT count(*) FROM public.outbox_entries WHERE status = 'DEAD_LETTER'),
    'oldestPendingSeconds', COALESCE((SELECT floor(extract(epoch FROM (clock_timestamp() - min("createdAt"))))::bigint FROM public.outbox_entries WHERE status IN ('PENDING','PROCESSING')), 0)
  ),
  'database', jsonb_build_object(
    'sizeBytes', pg_database_size(current_database()),
    'activeConnections', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()),
    'waitingConnections', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event IS NOT NULL),
    'ungrantedLocks', (SELECT count(*) FROM pg_locks WHERE NOT granted)
  )
));
SQL

psql_admin -P pager=off -c "SELECT pid, usename, application_name, state, wait_event_type, wait_event, backend_xid, backend_xmin, left(query, 240) AS query FROM pg_stat_activity WHERE datname = current_database() ORDER BY state, pid" \
  > "$EVIDENCE_DIR/pg-stat-activity.txt"
psql_admin -P pager=off -c "SELECT locktype, mode, granted, count(*) FROM pg_locks GROUP BY locktype, mode, granted ORDER BY locktype, mode, granted" \
  > "$EVIDENCE_DIR/pg-locks.txt"
psql_admin -P pager=off -c "SELECT relname, n_live_tup, n_dead_tup, seq_scan, idx_scan FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 40" \
  > "$EVIDENCE_DIR/pg-table-statistics.txt"

kubectl get pods -n "$NAMESPACE" -o wide > "$EVIDENCE_DIR/kubernetes-pods.txt" 2>&1 || true
kubectl get deployments,statefulsets -n "$NAMESPACE" -o wide > "$EVIDENCE_DIR/kubernetes-workloads.txt" 2>&1 || true
kubectl top pods -n "$NAMESPACE" > "$EVIDENCE_DIR/kubernetes-top-pods.txt" 2>&1 || true
kubectl logs -n "$NAMESPACE" deployment/pgbouncer --tail=500 > "$EVIDENCE_DIR/pgbouncer-tail.log" 2>&1 || true

cat "$EVIDENCE_DIR/database-reconciliation.json"
