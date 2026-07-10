#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_URL="${ONE_DEAL_ADMIN_URL:?ONE_DEAL_ADMIN_URL is required}"
APP_URL="${ONE_DEAL_APP_URL:?ONE_DEAL_APP_URL is required}"
EVIDENCE_LOG="${ONE_DEAL_EVIDENCE_LOG:-/tmp/platform-v7-one-deal-e2e.log}"

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
exec > >(tee -a "$EVIDENCE_LOG") 2>&1

cd "$ROOT_DIR"
echo "[one-deal] applying Prisma migrations to isolated PostgreSQL"
DATABASE_URL="$ADMIN_URL" pnpm --filter @pc/api exec prisma migrate deploy --schema prisma/schema.prisma

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

echo "[one-deal] running exploitation suite through the restricted application principal"
NODE_ENV=test \
DATABASE_URL="$APP_URL" \
JWT_SECRET="$JWT_SECRET" \
BANK_HMAC_SECRET="$BANK_HMAC_SECRET" \
pnpm --filter @pc/api exec jest --runInBand --config test/one-deal/jest.config.json

echo "[one-deal] exploitation gate passed"
