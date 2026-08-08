-- Production had an operational drift on the legacy app_service login: it
-- retained BYPASSRLS and predated the bounded P0 auth-runtime authority.
-- Repair that existing principal in place. The function allow-list is the
-- entire external P0 auth surface (registration, approval, login, MFA and
-- recovery), never the staff surface and never a schema-wide EXECUTE grant.
DO $production_app_service_auth_principal_drift$
DECLARE
  function_signature text;
  unexpected_auth_function regprocedure;
  auth_runtime_functions text[] := ARRAY[
    'auth.resolve_login_credential(text)',
    'auth.resolve_login_default_membership(text)',
    'auth.resolve_login_context_by_membership(text,text)',
    'auth.resolve_session_identity(text,text,text,text)',
    'auth.resolve_post_password_membership_ids(text)',
    'auth.resolve_post_password_membership_context(text,text)',
    'auth.resolve_session_identity_v2(text,text,text,text)',
    'auth.finalize_authenticated_user_mfa(text,text,text)',
    'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
    'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
    'auth.mark_registration_email_verified(text,text,text)',
    'auth.registration_join_notification_recipients(text,text,text)',
    'auth.resolve_password_reset_subject(text)',
    'auth.replace_password_after_reset(text,text,text,timestamp with time zone)',
    'auth.organization_team_snapshot(text,text,text,text,text)',
    'auth.resolve_organization_admin_session(text,text,text,text,text)',
    'auth.organization_membership_exists_for_email(text,text,text,text,text,text)',
    'auth.resolve_invitation_acceptance_credential(text,text)',
    'auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text)',
    'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)',
    'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)',
    'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)',
    'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)',
    'auth.resolve_mfa_recovery_identity(text,text)',
    'auth.finalize_mfa_recovery_identity(text,text,text,bigint)',
    'auth.registration_platform_actor_authorized(text,text)',
    'auth.registration_organization_admin_context(text,text,text,text,text)',
    'auth.registration_platform_review_queue(text,text,integer)',
    'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
    'auth.lock_registration_decision_application(text,text,text,text,text,text,text)',
    'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)',
    'auth.account_data_export(text,text,text,text,text)',
    'auth.anonymize_account_identity(text,text,text,text,text)'
  ];
BEGIN
  -- Fresh/rehearsal databases intentionally omit this production-only login.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER ROLE app_service NOSUPERUSER NOBYPASSRLS';
  EXECUTE 'GRANT USAGE ON SCHEMA auth TO app_service';

  -- Remove all legacy auth EXECUTE rights first, then reconstruct only the
  -- named P0 surface. This is a revocation, not a broad privilege grant.
  EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM app_service';
  FOREACH function_signature IN ARRAY auth_runtime_functions LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO app_service', function_signature);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'app_service'
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'app_service must be NOSUPERUSER NOBYPASSRLS after repair';
  END IF;

  FOREACH function_signature IN ARRAY auth_runtime_functions LOOP
    IF NOT has_function_privilege('app_service', function_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'app_service is missing required auth EXECUTE grant: %', function_signature;
    END IF;
  END LOOP;

  SELECT p.oid::regprocedure
  INTO unexpected_auth_function
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'auth'
    AND has_function_privilege('app_service', p.oid, 'EXECUTE')
    AND p.oid::regprocedure::text <> ALL(auth_runtime_functions)
  LIMIT 1;

  IF unexpected_auth_function IS NOT NULL THEN
    RAISE EXCEPTION 'app_service has unexpected auth EXECUTE grant: %', unexpected_auth_function;
  END IF;
END
$production_app_service_auth_principal_drift$;
