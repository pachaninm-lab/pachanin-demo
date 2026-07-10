#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_URL="${ONE_DEAL_ADMIN_URL:?ONE_DEAL_ADMIN_URL is required}"
APP_URL="${ONE_DEAL_APP_URL:?ONE_DEAL_APP_URL is required}"
EVIDENCE_LOG="${ONE_DEAL_EVIDENCE_LOG:-/tmp/platform-v7-one-deal-e2e.log}"
DRIFT_SQL="${ONE_DEAL_DRIFT_SQL:-/tmp/platform-v7-one-deal-schema-drift.sql}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing one-deal E2E with NODE_ENV=production" >&2
  exit 2
fi
if [[ -n "${DATABASE_URL:-}" && "$ADMIN_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing one-deal E2E: admin URL equals ambient DATABASE_URL" >&2
  exit 2
fi
if [[ "$ADMIN_URL" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
  echo "Refusing one-deal E2E: admin URL appears production-like" >&2
  exit 2
fi
if [[ "$APP_URL" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
  echo "Refusing one-deal E2E: application URL appears production-like" >&2
  exit 2
fi
if [[ "$ADMIN_URL" == "$APP_URL" ]]; then
  echo "Refusing one-deal E2E: admin and application URLs must differ" >&2
  exit 2
fi

command -v psql >/dev/null || { echo "psql is required" >&2; exit 2; }
command -v pnpm >/dev/null || { echo "pnpm is required" >&2; exit 2; }

mkdir -p "$(dirname "$EVIDENCE_LOG")"
: > "$EVIDENCE_LOG"
: > "$DRIFT_SQL"
exec > >(tee -a "$EVIDENCE_LOG") 2>&1

cd "$ROOT_DIR"
echo "[one-deal] applying Prisma migrations to isolated PostgreSQL"
DATABASE_URL="$ADMIN_URL" pnpm --filter @pc/api exec prisma migrate deploy --schema prisma/schema.prisma

echo "[one-deal] checking complete migration-to-schema drift"
set +e
DATABASE_URL="$ADMIN_URL" pnpm --filter @pc/api exec prisma migrate diff \
  --from-url "$ADMIN_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  --exit-code > "$DRIFT_SQL"
DRIFT_EXIT=$?
set -e
cat "$DRIFT_SQL"
if [[ "$DRIFT_EXIT" -eq 2 ]]; then
  echo "[one-deal] migration history does not produce the canonical Prisma schema" >&2
  exit 1
fi
if [[ "$DRIFT_EXIT" -ne 0 ]]; then
  echo "[one-deal] Prisma drift command failed with exit code $DRIFT_EXIT" >&2
  exit "$DRIFT_EXIT"
fi

echo "[one-deal] generating Prisma client from the migrated PostgreSQL schema"
DATABASE_URL="$ADMIN_URL" pnpm --filter @pc/api exec prisma generate --schema prisma/schema.prisma

echo "[one-deal] seeding canonical deal and 12 memberships before RLS"
NODE_ENV=test \
DATABASE_URL="$ADMIN_URL" \
JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}" \
BANK_HMAC_SECRET="${BANK_HMAC_SECRET:?BANK_HMAC_SECRET is required}" \
SEED_CANONICAL_TEST_DEAL=true \
pnpm --filter @pc/api exec ts-node test/one-deal/seed.ts

echo "[one-deal] applying canonical PostgreSQL RLS policies"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 --file infra/sql/production-rls-policies.sql

echo "[one-deal] creating non-superuser, non-bypass application principal"
psql "$ADMIN_URL" -X --set ON_ERROR_STOP=1 <<'SQL'
DO $one_deal_role$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_deal_app') THEN
    DROP OWNED BY one_deal_app;
    DROP ROLE one_deal_app;
  END IF;
  CREATE ROLE one_deal_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD 'ephemeral_one_deal_app_only';
END
$one_deal_role$;
GRANT CONNECT ON DATABASE one_deal_e2e TO one_deal_app;
GRANT USAGE ON SCHEMA public TO one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO one_deal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO one_deal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO one_deal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO one_deal_app;
SQL

ROLE_PROOF="$(psql "$ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT rolsuper::text || ':' || rolbypassrls::text FROM pg_roles WHERE rolname='one_deal_app'")"
if [[ "$ROLE_PROOF" != "false:false" && "$ROLE_PROOF" != "f:f" ]]; then
  echo "Application principal is not NOSUPERUSER NOBYPASSRLS: $ROLE_PROOF" >&2
  exit 1
fi

DATABASE_PROOF="$(psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT current_user || ':' || pg_get_userbyid(c.relowner) || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text || ':' || current_setting('row_security') FROM pg_class c WHERE c.oid='public.deals'::regclass")"
echo "[one-deal] database role proof: $DATABASE_PROOF"
IFS=':' read -r DB_USER DB_OWNER DB_RLS DB_FORCE DB_ROW_SECURITY <<< "$DATABASE_PROOF"
if [[ "$DB_USER" != "one_deal_app" ]]; then
  echo "Application datasource is not connected as one_deal_app: $DB_USER" >&2
  exit 1
fi
if [[ "$DB_OWNER" == "one_deal_app" ]]; then
  echo "Application principal unexpectedly owns protected table deals" >&2
  exit 1
fi
if [[ "$DB_RLS" != "true" && "$DB_RLS" != "t" ]]; then
  echo "RLS is not enabled on deals: $DB_RLS" >&2
  exit 1
fi
if [[ "$DB_FORCE" != "true" && "$DB_FORCE" != "t" ]]; then
  echo "FORCE ROW LEVEL SECURITY is not enabled on deals: $DB_FORCE" >&2
  exit 1
fi
if [[ "$DB_ROW_SECURITY" != "on" ]]; then
  echo "row_security is not on for application datasource: $DB_ROW_SECURITY" >&2
  exit 1
fi

CROSS_TENANT_COUNT="$(
  PGOPTIONS="-c app.current_user_id=buyer-e2e -c app.current_org_id=org-canonical-buyer -c app.current_tenant_id=tenant-other -c app.current_role=BUYER -c app.current_session_id=cross-tenant-sql-proof" \
    psql "$APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.deals WHERE id='DEAL-INDUSTRIAL-001'"
)"
echo "[one-deal] SQL cross-tenant visible rows: $CROSS_TENANT_COUNT"
if [[ "$CROSS_TENANT_COUNT" != "0" ]]; then
  echo "PostgreSQL RLS cross-tenant isolation failed before Prisma exploitation: $CROSS_TENANT_COUNT visible row(s)" >&2
  exit 1
fi

echo "[one-deal] running exploitation suite through the restricted application principal"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
JWT_SECRET="$JWT_SECRET" \
BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
pnpm --filter @pc/api exec jest --runInBand --config test/one-deal/jest.config.json

echo "[one-deal] exploitation gate passed"
