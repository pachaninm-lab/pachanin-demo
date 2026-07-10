#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_SQL="$ROOT_DIR/infra/sql/production-rls-policies.sql"
ROLLBACK_SQL="$ROOT_DIR/infra/sql/production-rls-policies.rollback.sql"

node "$ROOT_DIR/scripts/platform-v7-rls-verify.mjs"

: "${RLS_REHEARSAL_DATABASE_URL:?RLS_REHEARSAL_DATABASE_URL is required}"
: "${RLS_REHEARSAL_DATABASE_NAME:?RLS_REHEARSAL_DATABASE_NAME is required}"
: "${RLS_REHEARSAL_ENVIRONMENT:?RLS_REHEARSAL_ENVIRONMENT is required}"

if [[ "${ALLOW_NON_PRODUCTION_RLS_REHEARSAL:-false}" != "true" ]]; then
  echo "RLS rehearsal blocked: ALLOW_NON_PRODUCTION_RLS_REHEARSAL=true is required." >&2
  exit 2
fi

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "RLS rehearsal blocked in NODE_ENV=production." >&2
  exit 2
fi

case "${RLS_REHEARSAL_ENVIRONMENT,,}" in
  local|test|ci|preview|staging|rehearsal) ;;
  *)
    echo "RLS rehearsal environment must be local, test, ci, preview, staging or rehearsal." >&2
    exit 2
    ;;
esac

case "${RLS_REHEARSAL_DATABASE_NAME,,}" in
  postgres|template0|template1|*production*|*prod*)
    echo "RLS rehearsal blocked for production-like database name." >&2
    exit 2
    ;;
esac

actual_database="$(psql "$RLS_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database()')"
if [[ "$actual_database" != "$RLS_REHEARSAL_DATABASE_NAME" ]]; then
  echo "RLS rehearsal database mismatch: expected '$RLS_REHEARSAL_DATABASE_NAME', got '$actual_database'." >&2
  exit 2
fi

rollback() {
  psql "$RLS_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROLLBACK_SQL" >/dev/null || true
}
trap rollback EXIT

psql "$RLS_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$POLICY_SQL" >/dev/null

expected_tables=8
protected_tables="$(psql "$RLS_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  SELECT count(*)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema()
    AND c.relname IN (
      'deals',
      'organizations',
      'audit_events',
      'ledger_entries',
      'integration_events',
      'outbox_entries',
      'deal_workspace_runtime_snapshots',
      'deal_workspace_runtime_transaction_attempts'
    )
    AND c.relrowsecurity
    AND c.relforcerowsecurity;
")"

if [[ "$protected_tables" != "$expected_tables" ]]; then
  echo "RLS apply assertion failed: expected $expected_tables forced tables, got $protected_tables." >&2
  exit 3
fi

policy_count="$(psql "$RLS_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  SELECT count(*)
  FROM pg_policies
  WHERE schemaname = current_schema()
    AND tablename IN (
      'deals',
      'organizations',
      'audit_events',
      'ledger_entries',
      'integration_events',
      'outbox_entries',
      'deal_workspace_runtime_snapshots',
      'deal_workspace_runtime_transaction_attempts'
    );
")"

if [[ "$policy_count" -lt 24 ]]; then
  echo "RLS apply assertion failed: expected at least 24 policies, got $policy_count." >&2
  exit 3
fi

psql "$RLS_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROLLBACK_SQL" >/dev/null
trap - EXIT

remaining_policies="$(psql "$RLS_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  SELECT count(*)
  FROM pg_policies
  WHERE schemaname = current_schema()
    AND tablename IN (
      'deals',
      'organizations',
      'audit_events',
      'ledger_entries',
      'integration_events',
      'outbox_entries',
      'deal_workspace_runtime_snapshots',
      'deal_workspace_runtime_transaction_attempts'
    );
")"

if [[ "$remaining_policies" != "0" ]]; then
  echo "RLS rollback assertion failed: $remaining_policies policies remain." >&2
  exit 4
fi

echo "RLS apply/rollback rehearsal passed for non-production database '$actual_database'."
