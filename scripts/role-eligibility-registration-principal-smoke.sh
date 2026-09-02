#!/usr/bin/env bash
set -Eeuo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"

MIGRATION_BASE='apps/api/prisma/migrations/20260902140000_role_eligibility_shadow/migration.sql'
MIGRATION_SUPERSEDED='apps/api/prisma/migrations/20260902143000_role_eligibility_superseded_current_guard/migration.sql'
MIGRATION_RUNTIME='apps/api/prisma/migrations/20260902150000_role_eligibility_runtime_principal_boundary/migration.sql'

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE public.organizations (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL
);
CREATE TABLE auth.registration_applications (
  id TEXT PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  requested_workspace TEXT NOT NULL,
  requested_role TEXT NOT NULL,
  inn TEXT NOT NULL,
  ogrn TEXT,
  kpp TEXT,
  legal_name TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_service') THEN
    CREATE ROLE app_service NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$role$;

-- This is the pre-existing registration authority from the proven contour.
GRANT USAGE ON SCHEMA auth TO app_service;
GRANT SELECT, INSERT, UPDATE ON auth.registration_applications TO app_service;

CREATE TEMP TABLE registration_privilege_baseline AS
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE grantee='app_service'
  AND table_schema='auth'
  AND table_name='registration_applications'
ORDER BY privilege_type;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_BASE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_SUPERSEDED"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_RUNTIME"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $proof$
DECLARE
  baseline TEXT[] := ARRAY['INSERT','SELECT','UPDATE'];
  actual TEXT[];
  r RECORD;
BEGIN
  SELECT array_agg(privilege_type ORDER BY privilege_type)
  INTO actual
  FROM information_schema.role_table_grants
  WHERE grantee='app_service'
    AND table_schema='auth'
    AND table_name='registration_applications';

  IF actual IS DISTINCT FROM baseline THEN
    RAISE EXCEPTION 'REGISTRATION_PRIVILEGES_CHANGED: expected %, got %', baseline, actual;
  END IF;

  SELECT rolcanlogin, rolinherit, rolsuper, rolbypassrls
  INTO r FROM pg_roles WHERE rolname='app_service';
  IF NOT FOUND OR r.rolcanlogin OR r.rolinherit OR r.rolsuper OR r.rolbypassrls THEN
    RAISE EXCEPTION 'APP_SERVICE_PRINCIPAL_ATTRIBUTES_CHANGED';
  END IF;

  IF pg_has_role('app_service','pc_role_eligibility_observer','MEMBER') THEN
    RAISE EXCEPTION 'APP_SERVICE_OBSERVER_MEMBERSHIP_PRESENT';
  END IF;
  IF pg_has_role('app_service','pc_role_eligibility_runtime','MEMBER') THEN
    RAISE EXCEPTION 'APP_SERVICE_RUNTIME_MEMBERSHIP_PRESENT';
  END IF;

  IF NOT has_function_privilege('app_service','auth.read_role_eligibility_candidates(text)','EXECUTE') THEN
    RAISE EXCEPTION 'APP_SERVICE_BOUNDED_CANDIDATE_EXECUTE_MISSING';
  END IF;
  IF NOT has_table_privilege('app_service','eligibility.organization_checks','SELECT,INSERT,UPDATE') THEN
    RAISE EXCEPTION 'APP_SERVICE_ELIGIBILITY_AUTHORITY_MISSING';
  END IF;
END
$proof$;
SQL

printf '%s\n' \
  'REGISTRATION_PRINCIPAL_PRIVILEGES_UNCHANGED=PASS' \
  'REGISTRATION_CODE_CHANGED=0' \
  'OBSERVER_AUTHORITY=PASS' \
  'ROLE_ELIGIBILITY_RUNTIME_MEMBERSHIP=0'
