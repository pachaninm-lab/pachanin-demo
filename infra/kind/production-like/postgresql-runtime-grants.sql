GRANT USAGE ON SCHEMA public TO app_runtime, app_auth, app_storage, app_outbox;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_runtime;

GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations TO app_auth;
REVOKE ALL PRIVILEGES ON public.deals FROM app_auth;
GRANT USAGE ON SCHEMA auth TO app_auth;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA auth TO app_auth;
GRANT SELECT, INSERT ON auth.audit_events, auth.staff_access_events TO app_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth, public TO app_auth;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO app_auth;

GRANT SELECT ON public.deals, public.deal_participants TO app_storage;
GRANT SELECT, UPDATE ON public.deal_documents TO app_storage;
REVOKE INSERT, DELETE ON public.deal_documents FROM app_storage;

DO $schemas$
DECLARE schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['security','logistics','labs','settlement']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=schema_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO app_runtime', schema_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO app_runtime', schema_name);
      EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO app_runtime', schema_name);
      EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO app_runtime', schema_name);
    END IF;
  END LOOP;
END
$schemas$;

REVOKE CREATE ON DATABASE grainflow FROM app_runtime, app_auth, app_storage, app_outbox;
REVOKE CREATE ON SCHEMA public FROM app_runtime, app_auth, app_storage, app_outbox;
