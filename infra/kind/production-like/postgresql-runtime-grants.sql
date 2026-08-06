GRANT USAGE ON SCHEMA public TO app_runtime, app_auth, app_storage, app_outbox;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_runtime;

GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations TO app_auth;
REVOKE ALL PRIVILEGES ON public.deals FROM app_auth;
GRANT USAGE ON SCHEMA auth TO app_auth;
GRANT SELECT, INSERT, UPDATE ON
  auth.login_throttles,
  auth.credential_states,
  auth.sessions,
  auth.refresh_tokens,
  auth.mfa_challenges,
  auth.staff_assignments,
  auth.staff_access_requests,
  auth.staff_access_approvals,
  auth.staff_access_grants,
  auth.staff_access_sessions,
  auth.staff_critical_action_requests,
  auth.staff_critical_action_approvals,
  auth.break_glass_activations
TO app_auth;
GRANT SELECT, INSERT ON auth.audit_events, auth.staff_access_events TO app_auth;
REVOKE UPDATE, DELETE ON auth.audit_events, auth.staff_access_events FROM app_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth, public TO app_auth;

-- Named functions rather than "ALL FUNCTIONS IN SCHEMA auth" (#3670). Staff
-- cross-tenant projections and Deal target resolution are intentionally absent:
-- their legacy identifier-only signatures are dropped by the forward-only
-- chain and their bounded replacements belong exclusively to the staff runtime.
GRANT EXECUTE ON FUNCTION auth.lock_staff_access_event_chain(TEXT) TO app_auth;

-- The complete bounded authentication surface: what app_auth has instead of
-- BYPASSRLS. These grants are repeated here because the Kubernetes runtime
-- principals are provisioned independently from migration execution.
GRANT EXECUTE ON FUNCTION auth.resolve_login_identity(TEXT) TO app_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_identity_by_id(TEXT) TO app_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships(TEXT) TO app_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships_ordered(TEXT) TO app_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_email(TEXT) TO app_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(TEXT, TEXT) TO app_auth;
GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT) TO app_auth;

REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM app_auth;
REVOKE ALL ON FUNCTION auth.staff_projection_capability(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM app_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) FROM app_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) FROM app_auth;
REVOKE ALL ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM app_auth;
REVOKE ALL ON FUNCTION auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT) FROM app_auth;
REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT) FROM app_auth;
REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) FROM app_auth;
REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) FROM app_auth;
REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) FROM app_auth;

-- Dedicated function-only staff runtime. It receives no table or sequence
-- privilege at all: every cross-tenant identity/business scope read is bounded
-- by a fixed SECURITY DEFINER function and server-authenticated staff authority.
GRANT USAGE ON SCHEMA auth TO app_staff;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public, auth FROM app_staff;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public, auth FROM app_staff;
GRANT EXECUTE ON FUNCTION auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT) TO app_staff;
GRANT EXECUTE ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT) TO app_staff;
GRANT EXECUTE ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER) TO app_staff;
GRANT EXECUTE ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT) TO app_staff;
GRANT EXECUTE ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO app_staff;
GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) TO app_staff;
GRANT EXECUTE ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) TO app_staff;
GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) TO app_staff;
REVOKE ALL ON FUNCTION auth.staff_admission_capability(TEXT, TEXT, TEXT, TEXT, TEXT) FROM app_staff;
REVOKE ALL ON FUNCTION auth.staff_projection_capability(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM app_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_identity(TEXT) FROM app_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(TEXT) FROM app_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships(TEXT) FROM app_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(TEXT) FROM app_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(TEXT) FROM app_staff;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_membership(TEXT, TEXT) FROM app_staff;
REVOKE ALL ON FUNCTION auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT) FROM app_staff;

-- The deal runtime holds SELECT/INSERT/UPDATE/DELETE on every table in public,
-- which includes the identity tables. That is bounded by their policies rather
-- than by the grant, so it must not also reach the pre-auth or staff surfaces.
REVOKE ALL ON FUNCTION auth.resolve_login_identity(TEXT) FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(TEXT) FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships(TEXT) FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(TEXT) FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(TEXT) FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_membership(TEXT, TEXT) FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT) FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_staff_target_scope(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT)
  FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.staff_admission_queue(TEXT, TEXT, TEXT, INTEGER)
  FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.staff_admission_application(TEXT, TEXT, TEXT, TEXT)
  FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.staff_admission_decision(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT)
  FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT)
  FROM app_runtime, app_storage, app_outbox;
REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM app_runtime, app_storage, app_outbox;

-- Deal creation validates the confirmed seller and buyer without exposing
-- their identity rows. The function is status-only, transaction-context-bound
-- and owned by the confined identity authority.
GRANT USAGE ON SCHEMA auth TO app_runtime;
GRANT EXECUTE ON FUNCTION auth.validate_deal_creation_actors(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO app_runtime;
REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM app_auth, app_staff, app_storage, app_outbox;

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

REVOKE ALL PRIVILEGES ON TABLE security.api_rate_limit_state FROM app_runtime;
REVOKE ALL PRIVILEGES ON TABLE security.api_rate_limit_buckets FROM app_runtime;
GRANT USAGE ON SCHEMA security TO app_runtime;
GRANT EXECUTE ON FUNCTION security.consume_api_rate_limit(TEXT, TEXT, INTEGER) TO app_runtime;

REVOKE CREATE ON DATABASE grainflow FROM app_runtime, app_auth, app_staff, app_storage, app_outbox;
REVOKE CREATE ON SCHEMA public FROM app_runtime, app_auth, app_staff, app_storage, app_outbox;
