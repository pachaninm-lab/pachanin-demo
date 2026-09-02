#!/usr/bin/env bash
set -Eeuo pipefail
set +x
: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATION='apps/api/prisma/migrations/20260902150000_role_eligibility_runtime_principal_boundary/migration.sql'

# Model an existing production application principal before applying the
# boundary migration so its exact grants/membership semantics are exercised.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$role$;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $proof$
BEGIN
  IF pg_has_role('app_runtime','pc_role_eligibility_observer','MEMBER') THEN
    RAISE EXCEPTION 'APP_RUNTIME_OBSERVER_MEMBERSHIP_PRESENT';
  END IF;
  IF pg_has_role('app_runtime','pc_role_eligibility_runtime','MEMBER') THEN
    RAISE EXCEPTION 'APP_RUNTIME_ELIGIBILITY_RUNTIME_MEMBERSHIP_PRESENT';
  END IF;
  IF has_table_privilege('app_runtime','auth.registration_applications','SELECT')
     OR has_table_privilege('app_runtime','auth.registration_applications','INSERT')
     OR has_table_privilege('app_runtime','auth.registration_applications','UPDATE')
     OR has_table_privilege('app_runtime','auth.registration_applications','DELETE') THEN
    RAISE EXCEPTION 'APP_RUNTIME_DIRECT_REGISTRATION_PRIVILEGE_PRESENT';
  END IF;
  IF NOT has_function_privilege('app_runtime','auth.read_role_eligibility_candidates(text)','EXECUTE') THEN
    RAISE EXCEPTION 'APP_RUNTIME_BOUNDED_REGISTRATION_PROJECTION_MISSING';
  END IF;
  IF NOT has_table_privilege('app_runtime','eligibility.organization_checks','SELECT')
     OR NOT has_table_privilege('app_runtime','eligibility.organization_checks','INSERT')
     OR NOT has_table_privilege('app_runtime','eligibility.organization_checks','UPDATE') THEN
    RAISE EXCEPTION 'APP_RUNTIME_ELIGIBILITY_AUTHORITY_INCOMPLETE';
  END IF;
END
$proof$;

SET ROLE app_runtime;
SELECT application_id,application_version,tenant_id,requested_workspace,requested_role,inn,ogrn
FROM auth.read_role_eligibility_candidates('app_smoke');
SELECT count(*) FROM eligibility.organization_checks;
RESET ROLE;
SQL

# Direct registration-table access must remain impossible for the application
# principal even though the bounded SECURITY DEFINER projection is executable.
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET ROLE app_runtime; SELECT count(*) FROM auth.registration_applications" >/dev/null 2>&1; then
  echo 'ROLE_ELIGIBILITY_RUNTIME_PRINCIPAL_ERROR=DIRECT_REGISTRATION_SELECT_SUCCEEDED' >&2
  exit 20
fi

printf '%s\n' \
  'RUNTIME_PRINCIPAL_BOUNDARY=PASS' \
  'REGISTRATION_DIRECT_TABLE_ACCESS=DENIED' \
  'REGISTRATION_BOUNDED_PROJECTION=PASS' \
  'ROLE_MEMBERSHIP_ESCALATION=0'
