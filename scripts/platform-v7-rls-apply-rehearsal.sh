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
  authority_function_count INTEGER;
  immutability_function_count INTEGER;
  public_execute_count INTEGER;
  required_policy_count INTEGER;
  basis_only_insert_count INTEGER;
  authority_trigger_count INTEGER;
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

  SELECT count(*) INTO authority_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'app_deal_basis_deal_visible',
      'app_deal_basis_participant_allowed',
      'enforce_single_deal_per_basis'
    )
    AND p.prosecdef;

  SELECT count(*) INTO immutability_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'forbid_deal_basis_mutation';

  SELECT count(*) INTO public_execute_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'app_deal_basis_deal_visible',
      'app_deal_basis_participant_allowed',
      'enforce_single_deal_per_basis',
      'forbid_deal_basis_mutation'
    )
    AND acl.grantee = 0
    AND acl.privilege_type = 'EXECUTE';

  SELECT count(*) INTO required_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (tablename, policyname) IN (
      ('deals', 'deals_select'),
      ('deals', 'deals_insert'),
      ('integration_events', 'integration_events_select'),
      ('organizations', 'organizations_select'),
      ('deal_participants', 'deal_participants_insert')
    );

  SELECT count(*) INTO basis_only_insert_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'deals'
    AND policyname = 'deals_insert'
    AND with_check ILIKE '%app_deal_basis_deal_visible%'
    AND with_check ILIKE '%FARMER%'
    AND with_check NOT ILIKE '%app_rls_privileged%';

  SELECT count(*) INTO authority_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'deals'
    AND t.tgname IN ('deals_single_basis', 'deals_basis_immutable')
    AND NOT t.tgisinternal
    AND t.tgenabled IN ('O', 'A');

  IF enabled_count <> 8 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected 8 enabled tables, got %', enabled_count;
  END IF;
  IF forced_count <> 8 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected 8 forced tables, got %', forced_count;
  END IF;
  IF policy_count < 16 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected at least 16 policies, got %', policy_count;
  END IF;
  IF authority_function_count <> 3 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected 3 SECURITY DEFINER authority functions, got %', authority_function_count;
  END IF;
  IF immutability_function_count <> 1 THEN
    RAISE EXCEPTION 'RLS rehearsal: immutable-basis trigger function is missing';
  END IF;
  IF public_execute_count <> 0 THEN
    RAISE EXCEPTION 'RLS rehearsal: PUBLIC can execute % authority function(s)', public_execute_count;
  END IF;
  IF required_policy_count <> 5 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected 5 final deal authority policies, got %', required_policy_count;
  END IF;
  IF basis_only_insert_count <> 1 THEN
    RAISE EXCEPTION 'RLS rehearsal: final deals_insert policy is not seller-basis-only';
  END IF;
  IF authority_trigger_count <> 2 THEN
    RAISE EXCEPTION 'RLS rehearsal: expected 2 enabled Deal authority triggers, got %', authority_trigger_count;
  END IF;
END
\$rehearsal\$;
ROLLBACK;
SQL
} | psql "$RLS_REHEARSAL_DATABASE_URL" -X --set ON_ERROR_STOP=1 --quiet

echo "RLS apply rehearsal passed and was rolled back."
