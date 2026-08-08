-- Production had an operational drift on the legacy app_service login: it
-- retained BYPASSRLS while missing the bounded bootstrap functions required by
-- the fail-closed auth principal inspection.  Repair the existing principal
-- in place; do not create a second runtime identity or weaken any RLS policy.
-- The migration itself is an executable postcondition check.  A role/grant
-- drift therefore aborts the release before the API can accept traffic.
DO $production_app_service_auth_principal_drift$
DECLARE
  unexpected_login_function regprocedure;
BEGIN
  -- Fresh/rehearsal databases intentionally omit the production-only legacy
  -- login. Production repairs that existing login in place.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER ROLE app_service NOSUPERUSER NOBYPASSRLS';
  EXECUTE 'GRANT USAGE ON SCHEMA auth TO app_service';

  -- Exact application auth-runtime surface; never use a schema-wide grant.
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.resolve_login_credential(TEXT) TO app_service';
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.resolve_login_default_membership(TEXT) TO app_service';
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(TEXT, TEXT) TO app_service';
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(TEXT, TEXT, TEXT, TEXT) TO app_service';
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_ids(TEXT) TO app_service';
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_context(TEXT, TEXT) TO app_service';
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.resolve_session_identity_v2(TEXT, TEXT, TEXT, TEXT) TO app_service';
  EXECUTE 'GRANT EXECUTE ON FUNCTION auth.finalize_authenticated_user_mfa(TEXT, TEXT, TEXT) TO app_service';

  -- Historical bootstrap resolvers may not survive on the legacy principal.
  EXECUTE 'REVOKE ALL ON FUNCTION auth.resolve_login_identity(TEXT) FROM app_service';
  EXECUTE 'REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(TEXT) FROM app_service';
  EXECUTE 'REVOKE ALL ON FUNCTION auth.resolve_login_memberships(TEXT) FROM app_service';
  EXECUTE 'REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(TEXT) FROM app_service';
  EXECUTE 'REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(TEXT) FROM app_service';

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'app_service'
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'app_service must be NOSUPERUSER NOBYPASSRLS after repair';
  END IF;

  IF NOT (
    has_function_privilege('app_service', 'auth.resolve_login_credential(text)', 'EXECUTE')
    AND has_function_privilege('app_service', 'auth.resolve_login_default_membership(text)', 'EXECUTE')
    AND has_function_privilege('app_service', 'auth.resolve_login_context_by_membership(text,text)', 'EXECUTE')
    AND has_function_privilege('app_service', 'auth.resolve_session_identity(text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('app_service', 'auth.resolve_post_password_membership_ids(text)', 'EXECUTE')
    AND has_function_privilege('app_service', 'auth.resolve_post_password_membership_context(text,text)', 'EXECUTE')
    AND has_function_privilege('app_service', 'auth.resolve_session_identity_v2(text,text,text,text)', 'EXECUTE')
    AND has_function_privilege('app_service', 'auth.finalize_authenticated_user_mfa(text,text,text)', 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'app_service is missing an exact required auth bootstrap grant';
  END IF;

  SELECT p.oid::regprocedure
  INTO unexpected_login_function
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'auth'
    AND p.proname LIKE 'resolve_login_%'
    AND has_function_privilege('app_service', p.oid, 'EXECUTE')
    AND p.oid NOT IN (
      'auth.resolve_login_credential(text)'::regprocedure,
      'auth.resolve_login_default_membership(text)'::regprocedure,
      'auth.resolve_login_context_by_membership(text,text)'::regprocedure
    )
  LIMIT 1;

  IF unexpected_login_function IS NOT NULL THEN
    RAISE EXCEPTION 'app_service has unexpected auth login EXECUTE grant: %', unexpected_login_function;
  END IF;
END
$production_app_service_auth_principal_drift$;
