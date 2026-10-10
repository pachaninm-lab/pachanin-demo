#!/usr/bin/env bash
set -Eeuo pipefail
set +x
: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATION='apps/api/prisma/migrations/20260902150000_role_eligibility_runtime_principal_boundary/migration.sql'

# Model existing production-compatible application principals before applying
# the boundary migration so exact grant/membership semantics are exercised.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pc_deal_runtime') THEN
    CREATE ROLE pc_deal_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$roles$;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $proof$
DECLARE runtime_role TEXT;
BEGIN
  FOREACH runtime_role IN ARRAY ARRAY['app_runtime','pc_deal_runtime']
  LOOP
    IF pg_has_role(runtime_role,'pc_role_eligibility_observer','MEMBER') THEN
      RAISE EXCEPTION '%_OBSERVER_MEMBERSHIP_PRESENT', runtime_role;
    END IF;
    IF pg_has_role(runtime_role,'pc_role_eligibility_runtime','MEMBER') THEN
      RAISE EXCEPTION '%_ELIGIBILITY_RUNTIME_MEMBERSHIP_PRESENT', runtime_role;
    END IF;
    IF has_table_privilege(runtime_role,'auth.registration_applications','SELECT')
       OR has_table_privilege(runtime_role,'auth.registration_applications','INSERT')
       OR has_table_privilege(runtime_role,'auth.registration_applications','UPDATE')
       OR has_table_privilege(runtime_role,'auth.registration_applications','DELETE') THEN
      RAISE EXCEPTION '%_DIRECT_REGISTRATION_PRIVILEGE_PRESENT', runtime_role;
    END IF;
    IF NOT has_function_privilege(runtime_role,'auth.read_role_eligibility_candidates(text)','EXECUTE') THEN
      RAISE EXCEPTION '%_BOUNDED_REGISTRATION_PROJECTION_MISSING', runtime_role;
    END IF;
    IF NOT has_table_privilege(runtime_role,'eligibility.organization_checks','SELECT')
       OR NOT has_table_privilege(runtime_role,'eligibility.organization_checks','INSERT')
       OR NOT has_table_privilege(runtime_role,'eligibility.organization_checks','UPDATE') THEN
      RAISE EXCEPTION '%_ELIGIBILITY_AUTHORITY_INCOMPLETE', runtime_role;
    END IF;
  END LOOP;
END
$proof$;

SET ROLE pc_deal_runtime;
SELECT application_id,application_version,tenant_id,requested_workspace,requested_role,inn,ogrn
FROM auth.read_role_eligibility_candidates('app_smoke');
SELECT count(*) FROM eligibility.organization_checks;
RESET ROLE;
SQL

# Direct registration-table access must remain impossible for the production
# deal principal even though the bounded SECURITY DEFINER projection executes.
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET ROLE pc_deal_runtime; SELECT count(*) FROM auth.registration_applications" >/dev/null 2>&1; then
  echo 'ROLE_ELIGIBILITY_RUNTIME_PRINCIPAL_ERROR=DIRECT_REGISTRATION_SELECT_SUCCEEDED' >&2
  exit 20
fi

printf '%s\n' \
  'RUNTIME_PRINCIPAL_BOUNDARY=PASS' \
  'PC_DEAL_RUNTIME_BOUNDARY=PASS' \
  'REGISTRATION_DIRECT_TABLE_ACCESS=DENIED' \
  'REGISTRATION_BOUNDED_PROJECTION=PASS' \
  'ROLE_MEMBERSHIP_ESCALATION=0'
