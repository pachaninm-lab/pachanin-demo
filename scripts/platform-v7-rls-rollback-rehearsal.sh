#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_FILE="$ROOT_DIR/infra/sql/production-rls-policies.sql"
VALIDATOR="$ROOT_DIR/scripts/platform-v7-rls-validate.mjs"
PROTECTED_TABLES="deals organizations audit_events ledger_entries integration_events outbox_entries deal_workspace_runtime_snapshots deal_workspace_runtime_transaction_attempts"

: "${RLS_REHEARSAL_DATABASE_URL:?Set RLS_REHEARSAL_DATABASE_URL to a dedicated non-production PostgreSQL database}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing RLS rollback rehearsal with NODE_ENV=production" >&2
  exit 2
fi
if [[ -n "${DATABASE_URL:-}" && "$RLS_REHEARSAL_DATABASE_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing RLS rollback rehearsal: rehearsal URL equals DATABASE_URL" >&2
  exit 2
fi
if [[ "$RLS_REHEARSAL_DATABASE_URL" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
  echo "Refusing RLS rollback rehearsal: URL appears production-like" >&2
  exit 2
fi

command -v node >/dev/null || { echo "node is required" >&2; exit 2; }
command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
node "$VALIDATOR"

TABLE_ARRAY="$(printf "'%s'," $PROTECTED_TABLES | sed 's/,$//')"
{
  echo 'BEGIN;'
  cat "$POLICY_FILE"
  cat <<'SQL'
DROP POLICY IF EXISTS runtime_attempts_insert ON public."deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_select ON public."deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_snapshots_insert ON public."deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_select ON public."deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_insert ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker ON public."outbox_entries";
DROP POLICY IF EXISTS integration_events_insert ON public."integration_events";
DROP POLICY IF EXISTS integration_events_select ON public."integration_events";
DROP POLICY IF EXISTS ledger_entries_insert ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_entries_select ON public."ledger_entries";
DROP POLICY IF EXISTS audit_events_insert ON public."audit_events";
DROP POLICY IF EXISTS audit_events_select ON public."audit_events";
DROP POLICY IF EXISTS organizations_update_privileged ON public."organizations";
DROP POLICY IF EXISTS organizations_insert_privileged ON public."organizations";
DROP POLICY IF EXISTS organizations_write_privileged ON public."organizations";
DROP POLICY IF EXISTS organizations_select ON public."organizations";
DROP POLICY IF EXISTS deals_update ON public."deals";
DROP POLICY IF EXISTS deals_insert ON public."deals";
DROP POLICY IF EXISTS deals_select ON public."deals";

ALTER TABLE public."deal_workspace_runtime_transaction_attempts" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."deal_workspace_runtime_transaction_attempts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_workspace_runtime_snapshots" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."deal_workspace_runtime_snapshots" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."integration_events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."integration_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_entries" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_entries" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."audit_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."deals" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public."deals" DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.app_rls_deal_visible(TEXT);
DROP FUNCTION IF EXISTS public.app_rls_privileged();
DROP FUNCTION IF EXISTS public.app_rls_context_ready();
SQL
  cat <<SQL
DO \$rollback_rehearsal\$
DECLARE
  enabled_count INTEGER;
  forced_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT count(*) INTO enabled_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ($TABLE_ARRAY) AND c.relrowsecurity;

  SELECT count(*) INTO forced_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ($TABLE_ARRAY) AND c.relforcerowsecurity;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ($TABLE_ARRAY);

  IF enabled_count <> 0 THEN
    RAISE EXCEPTION 'RLS rollback rehearsal: expected zero enabled tables, got %', enabled_count;
  END IF;
  IF forced_count <> 0 THEN
    RAISE EXCEPTION 'RLS rollback rehearsal: expected zero forced tables, got %', forced_count;
  END IF;
  IF policy_count <> 0 THEN
    RAISE EXCEPTION 'RLS rollback rehearsal: expected zero policies, got %', policy_count;
  END IF;
END
\$rollback_rehearsal\$;
ROLLBACK;
SQL
} | psql "$RLS_REHEARSAL_DATABASE_URL" -X --set ON_ERROR_STOP=1 --quiet

echo "RLS rollback rehearsal passed and the rehearsal transaction was rolled back."
