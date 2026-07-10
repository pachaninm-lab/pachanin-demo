#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INITIAL_MIGRATION="$ROOT_DIR/apps/api/prisma/migrations/0001_postgresql_initial/migration.sql"
RUNTIME_MIGRATION="$ROOT_DIR/apps/api/prisma/migrations/20260710060000_deal_workspace_runtime_persistence/migration.sql"
POLICY_FILE="$ROOT_DIR/infra/sql/production-rls-policies.sql"
SETUP_FILE="$ROOT_DIR/apps/api/test/rls/setup.sql"
ASSERT_FILE="$ROOT_DIR/apps/api/test/rls/assert.sql"
VALIDATOR="$ROOT_DIR/scripts/platform-v7-rls-validate.mjs"

: "${RLS_INTEGRATION_ADMIN_URL:?Set RLS_INTEGRATION_ADMIN_URL to the ephemeral local PostgreSQL 16 database}"

if [[ "${NODE_ENV:-test}" == "production" ]]; then
  echo "Refusing RLS integration test with NODE_ENV=production" >&2
  exit 2
fi
if [[ -n "${DATABASE_URL:-}" && "$RLS_INTEGRATION_ADMIN_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing RLS integration test: integration URL equals DATABASE_URL" >&2
  exit 2
fi
case "$RLS_INTEGRATION_ADMIN_URL" in
  postgresql://*@127.0.0.1:*/*|postgresql://*@localhost:*/*|postgres://*@127.0.0.1:*/*|postgres://*@localhost:*/*)
    ;;
  *)
    echo "Refusing RLS integration test: database host must be localhost or 127.0.0.1" >&2
    exit 2
    ;;
esac

command -v node >/dev/null || { echo "node is required" >&2; exit 2; }
command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }

for file in "$INITIAL_MIGRATION" "$RUNTIME_MIGRATION" "$POLICY_FILE" "$SETUP_FILE" "$ASSERT_FILE" "$VALIDATOR"; do
  [[ -f "$file" ]] || { echo "Required RLS integration artifact is missing: $file" >&2; exit 2; }
done

node "$VALIDATOR"

SERVER_VERSION_NUM="$(psql "$RLS_INTEGRATION_ADMIN_URL" -XAtqc "SHOW server_version_num")"
if (( SERVER_VERSION_NUM < 160000 || SERVER_VERSION_NUM >= 170000 )); then
  echo "RLS integration requires PostgreSQL 16, got server_version_num=$SERVER_VERSION_NUM" >&2
  exit 2
fi

TABLE_COUNT="$(psql "$RLS_INTEGRATION_ADMIN_URL" -XAtqc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")"
if [[ "$TABLE_COUNT" != "0" ]]; then
  echo "Refusing RLS integration test: ephemeral database is not clean ($TABLE_COUNT public tables)" >&2
  exit 2
fi

psql "$RLS_INTEGRATION_ADMIN_URL" -X --set ON_ERROR_STOP=1 --file "$INITIAL_MIGRATION"
psql "$RLS_INTEGRATION_ADMIN_URL" -X --set ON_ERROR_STOP=1 --file "$RUNTIME_MIGRATION"

SCHEMA_READY="$(psql "$RLS_INTEGRATION_ADMIN_URL" -XAtqc "SELECT count(*) FROM (VALUES (to_regclass('public.deals')), (to_regclass('public.audit_events')), (to_regclass('public.outbox_entries')), (to_regclass('public.deal_workspace_runtime_snapshots')), (to_regclass('public.deal_workspace_runtime_transaction_attempts'))) AS required_table(name) WHERE name IS NOT NULL")"
if [[ "$SCHEMA_READY" != "5" ]]; then
  echo "RLS integration schema is incomplete: expected 5 required tables, got $SCHEMA_READY" >&2
  exit 1
fi

# The policy artifact is applied atomically only to this ephemeral local database.
psql "$RLS_INTEGRATION_ADMIN_URL" -X --set ON_ERROR_STOP=1 --single-transaction --file "$POLICY_FILE"
psql "$RLS_INTEGRATION_ADMIN_URL" -X --set ON_ERROR_STOP=1 --file "$SETUP_FILE"
psql "$RLS_INTEGRATION_ADMIN_URL" -X --set ON_ERROR_STOP=1 --file "$ASSERT_FILE"

echo "Ephemeral PostgreSQL 16 RLS integration assertions passed."
