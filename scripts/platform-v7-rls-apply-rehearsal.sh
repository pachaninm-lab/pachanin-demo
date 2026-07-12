#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_FILE="$ROOT_DIR/infra/sql/production-rls-policies.sql"
DEAL_AUTHORITY_POLICY_FILE="$ROOT_DIR/infra/sql/postgresql-deal-authority-policies.sql"
VALIDATOR="$ROOT_DIR/scripts/platform-v7-rls-validate.mjs"
PROTECTED_TABLES="deals organizations audit_events ledger_entries integration_events outbox_entries deal_workspace_runtime_snapshots deal_workspace_runtime_transaction_attempts"

: "${RLS_REHEARSAL_DATABASE_URL:?Set RLS_REHEARSAL_DATABASE_URL to a dedicated non-production PostgreSQL database}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing RLS rehearsal with NODE_ENV=production" >&2
  exit 2
fi
if [[ -n "${DATABASE_URL:-}" && "$RLS_REHEARSAL_DATABASE_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing RLS rehearsal: rehearsal URL equals DATABASE_URL" >&2
  exit 2
fi
if [[ "$RLS_REHEARSAL_DATABASE_URL" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
  echo "Refusing RLS rehearsal: URL appears production-like" >&2
  exit 2
fi

command -v node >/dev/null || { echo "node is required" >&2; exit 2; }
command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
node "$VALIDATOR"

TABLE_ARRAY="$(printf "'%s'," $PROTECTED_TABLES | sed 's/,$//')"
{
  echo 'BEGIN;'
  cat "$POLICY_FILE"
  cat "$DEAL_AUTHORITY_POLICY_FILE"
  cat <<SQL
DO \$rehearsal\$
DECLARE
  enabled_count INTEGER;
  forced_count INTEGER;
  policy_count INTEGER;
  basis_function_count INTEGER;
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

  SELECT count(*) INTO basis_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'app_deal_basis_participant_allowed'
    AND p.prosecdef;

  IF enabled_count <> 8 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected 8 enabled tables, got %', enabled_count;
  END IF;
  IF forced_count <> 8 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected 8 forced tables, got %', forced_count;
  END IF;
  IF policy_count < 16 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected at least 16 policies, got %', policy_count;
  END IF;
  IF basis_function_count <> 1 THEN
    RAISE EXCEPTION 'RLS rehearsal: deal basis SECURITY DEFINER predicate is missing';
  END IF;
END
\$rehearsal\$;
ROLLBACK;
SQL
} | psql "$RLS_REHEARSAL_DATABASE_URL" -X --set ON_ERROR_STOP=1 --quiet

echo "RLS apply rehearsal passed and was rolled back."
