DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_runtime') THEN CREATE ROLE app_runtime LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_auth') THEN CREATE ROLE app_auth LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_staff') THEN CREATE ROLE app_staff LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_storage') THEN CREATE ROLE app_storage LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_outbox') THEN CREATE ROLE app_outbox LOGIN; END IF;
END
$roles$;

ALTER ROLE app_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
-- app_auth is NOBYPASSRLS (#3670). It used to carry the attribute so login
-- could read an identity before any tenant context existed; BYPASSRLS grants
-- that one read by disabling every policy for every statement the principal
-- ever runs. The pre-context read is now the bounded auth.resolve_login_*
-- surface, granted by exact signature in postgresql-runtime-grants.sql.
ALTER ROLE app_auth LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'auth_password';
-- app_staff is deliberately a function-only principal. Runtime grants give it
-- schema USAGE plus EXECUTE on the bounded staff SECURITY DEFINER surface and
-- no table privilege. It is distinct from auth/deal/storage principals so a
-- compromise of one datasource cannot become cross-tenant staff authority.
ALTER ROLE app_staff LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'staff_password';
ALTER ROLE app_storage LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'storage_password';
ALTER ROLE app_outbox LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'outbox_password';

GRANT CONNECT ON DATABASE grainflow TO app_runtime, app_auth, app_staff, app_storage, app_outbox;
