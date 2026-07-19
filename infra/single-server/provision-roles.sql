-- Canonical runtime principals for the single-server production stack.
--
-- The platform enforces a three-principal PostgreSQL boundary at startup
-- (deal / auth / storage). This file creates those roles. It is idempotent and
-- safe to run on every deploy: it never DROPs a live role, only (re)asserts
-- attributes and the connection grant. Table/function grants live in
-- provision-grants.sql, applied AFTER the RLS overlays so the overlays' own
-- role-conditional grants also fire.
--
-- Passwords are injected by provision.sh via psql -v (deal_pw/auth_pw/storage_pw).
\set ON_ERROR_STOP on

-- Deal runtime: CRUD business tables strictly under ENABLE + FORCE RLS.
-- Must be NOSUPERUSER, NOBYPASSRLS, NOINHERIT, and never own protected tables.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal_api') THEN
    CREATE ROLE app_deal_api LOGIN;
  END IF;
END $$;
ALTER ROLE app_deal_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'deal_pw';

-- Auth runtime: trusted identity lookups before deal context is established.
-- Requires BYPASSRLS and must hold NO privilege on public.deals.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service LOGIN;
  END IF;
END $$;
ALTER ROLE app_service LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS PASSWORD :'auth_pw';

-- Storage runtime: isolated evidence-finalization principal.
-- SELECT + UPDATE on public.deal_documents only (no INSERT/DELETE).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_storage') THEN
    CREATE ROLE app_storage LOGIN;
  END IF;
END $$;
ALTER ROLE app_storage LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'storage_pw';

GRANT CONNECT ON DATABASE grainflow TO app_deal_api, app_service, app_storage;
