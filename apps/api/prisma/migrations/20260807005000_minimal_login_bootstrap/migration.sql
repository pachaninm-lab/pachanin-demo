-- Minimal pre-password login authority (#3670).
--
-- Earlier bootstrap revisions exposed membership/tenant context before the
-- password comparison and kept legacy functions that returned MFA material.
-- The auth runtime does not need any of that before proving the password.
--
-- Final boundary:
--   1. resolve_login_credential(email) -> user id + email + password hash only;
--   2. application verifies the bcrypt password (and rechecks the same hash
--      inside the serializable login transaction);
--   3. resolve_login_default_membership(user) -> one opaque membership id;
--   4. resolve_login_context_by_membership(user,membership) -> role/org/tenant;
--   5. MFA/session state remains in auth.* and session verification uses the
--      bounded resolve_session_identity tuple.
--
-- The historical wider functions remain as migration history objects owned by
-- the NOLOGIN bootstrap role, but every login-capable runtime loses EXECUTE on
-- them. This is fail-closed and prevents a later application call from silently
-- regressing to the wider pre-password surface.

CREATE OR REPLACE FUNCTION auth.resolve_login_credential(p_email text)
RETURNS TABLE (
  user_id text,
  email text,
  password_hash text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    candidate."id",
    candidate."email",
    candidate."passwordHash"
  FROM public."users" candidate
  WHERE candidate."email" = lower(btrim(p_email))
  LIMIT 1;
$function$;
ALTER FUNCTION auth.resolve_login_credential(text) OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_login_credential(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION auth.resolve_login_default_membership(p_user_id text)
RETURNS TABLE (membership_id text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT membership."id"
  FROM public."user_orgs" membership
  WHERE membership."userId" = p_user_id
  ORDER BY membership."isDefault" DESC, membership."joinedAt" ASC, membership."id" ASC
  LIMIT 1;
$function$;
ALTER FUNCTION auth.resolve_login_default_membership(text) OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_login_default_membership(text) FROM PUBLIC;

DO $minimal_login_surface$
DECLARE
  runtime_role text;
BEGIN
  -- Only authentication runtimes get the two new entry points.
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_credential(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_default_membership(text) TO %I', runtime_role);

    -- Context-by-membership is post-password; session identity is post-session.
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(text,text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(text,text,text,text) TO %I', runtime_role);

    -- Wider pre-password and arbitrary-identity surfaces are retired from the
    -- runtime even though their historical definitions remain in the catalog.
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_memberships(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(text) FROM %I', runtime_role);
  END LOOP;

  -- No non-auth runtime may acquire any bootstrap login authority.
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_app', 'one_deal_staff', 'one_deal_storage',
      'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_credential(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_default_membership(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_context_by_membership(text,text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_session_identity(text,text,text,text) FROM %I', runtime_role);
  END LOOP;
END;
$minimal_login_surface$;
