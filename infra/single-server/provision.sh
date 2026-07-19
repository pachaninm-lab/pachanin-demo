#!/bin/sh
# Post-migration provisioning for the single-server production stack.
#
# Runs once per deploy, as the DDL/migration owner (grainflow_ddl), AFTER
# `prisma migrate deploy` has created the schema. It:
#   1. creates the three canonical runtime principals (deal/auth/storage);
#   2. applies the canonical RLS overlays (ENABLE + FORCE RLS, authority
#      policies) in the runbook order — these carry the role-conditional grants;
#   3. applies the least-privilege runtime grants.
#
# Every step is idempotent, so Watchtower/compose can re-run it safely.
set -eu

export PGPASSWORD="${DDL_PASSWORD}"
PGHOST=postgres
PGUSER=grainflow_ddl
PGDATABASE=grainflow
export PGHOST PGUSER PGDATABASE

run() { psql -v ON_ERROR_STOP=1 -X "$@"; }

echo "==> [provision] waiting for PostgreSQL"
until pg_isready >/dev/null 2>&1; do sleep 1; done

echo "==> [provision] creating canonical runtime principals"
run -v deal_pw="${APP_PASSWORD}" \
    -v auth_pw="${AUTH_PASSWORD}" \
    -v storage_pw="${STORAGE_PASSWORD}" \
    -f /provision-roles.sql

echo "==> [provision] applying canonical RLS overlays"
for f in \
  production-rls-policies \
  postgresql-deal-authority-policies \
  postgresql-document-authority-policies \
  postgresql-logistics-authority-policies \
  postgresql-labs-authority-policies \
  postgresql-settlement-authority-policies
do
  echo "    -> ${f}.sql"
  run -f "/sql/${f}.sql"
done

echo "==> [provision] applying least-privilege runtime grants"
run -f /provision-grants.sql

echo "==> [provision] bootstrapping platform owner (non-fatal)"
run -v org_id=org-canonical-platform \
    -v tenant_id=tenant-canonical-test \
    -v user_id=usr-platform-owner \
    -v owner_email="${PC_CABINET_LOCK_USER:-pachaninm@gmail.com}" \
    -v full_name="Максим — владелец платформы" \
    -f /provision-owner.sql \
  || echo "==> [provision] owner bootstrap skipped (non-fatal)"

echo "==> [provision] complete: deal=app_deal_api auth=app_service storage=app_storage"
