-- Self-service password change (OWASP ASVS 5.0 V6.2.2, V6.2.3).
--
-- Until now the only way to a new password was the emailed reset token. That
-- satisfies "users can change their password" only by way of the recovery flow,
-- and a recovery flow cannot require the current password - not requiring it is
-- the entire point of recovery. V6.2.3 asks for the other flow: an authenticated
-- user who knows their password replacing it with another.
--
-- public."users" is under FORCE row level security and the runtime role cannot
-- write it, so the change goes through a narrow definer function exactly as the
-- reset path does. The function is separate from
-- auth.replace_password_after_reset because that one requires a PENDING
-- challenge, and separate from auth.upgrade_password_hash_format because that
-- one exists to rewrite a hash into the current format and is granted for that
-- purpose; borrowing either would make this flow depend on a contract written
-- for something else.
--
-- The current-password check is enforced HERE as well as in the service. The
-- service verifies the password to produce a useful error; this function
-- compare-and-sets on the hash it was told to expect, so two requests racing, or
-- a service that forgot to check, cannot overwrite a password the caller could
-- not prove they held.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_password_change_authority') THEN
    CREATE ROLE pc_password_change_authority NOLOGIN;
  END IF;
END;
$roles$;

GRANT USAGE ON SCHEMA auth TO pc_password_change_authority;
GRANT USAGE ON SCHEMA public TO pc_password_change_authority;
GRANT SELECT, UPDATE ON public."users" TO pc_password_change_authority;

-- The owning role needs a policy of its own: FORCE row level security applies
-- to the table owner too, so without this the definer function is refused by
-- the same rule that refuses the runtime role.
DROP POLICY IF EXISTS users_self_service_password_change ON public."users";
CREATE POLICY users_self_service_password_change ON public."users"
  FOR UPDATE TO pc_password_change_authority
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS users_self_service_password_change_read ON public."users";
CREATE POLICY users_self_service_password_change_read ON public."users"
  FOR SELECT TO pc_password_change_authority
  USING (true);

CREATE OR REPLACE FUNCTION auth.change_own_password(
  p_user_id text,
  p_next_hash text,
  p_expected_hash text,
  p_changed_at timestamptz
)
RETURNS TABLE (updated boolean, notification_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  resolved_email text;
BEGIN
  IF btrim(COALESCE(p_user_id, '')) = '' OR p_changed_at IS NULL THEN
    RAISE EXCEPTION 'Password change authority input is incomplete'
      USING ERRCODE = '22023';
  END IF;
  -- Same floor the reset authority applies: a short value is a plaintext
  -- password that some caller failed to hash, and must never be stored.
  IF length(COALESCE(p_next_hash, '')) < 40 THEN
    RAISE EXCEPTION 'Password change credential must be pre-hashed'
      USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_expected_hash, '')) = '' THEN
    RAISE EXCEPTION 'Password change requires the current credential'
      USING ERRCODE = '22023';
  END IF;
  -- Replacing a password with itself is not a change, and admitting it would
  -- reset the credential version and the lockout counters for free.
  IF p_next_hash = p_expected_hash THEN
    RAISE EXCEPTION 'Password change must alter the credential'
      USING ERRCODE = '22023';
  END IF;

  SELECT subject."email"
  INTO resolved_email
  FROM public."users" subject
  WHERE subject."id" = p_user_id
    AND subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL
    -- The binding to the current password. A caller who cannot name the stored
    -- hash changes nothing, whatever the service above believed.
    AND subject."passwordHash" = p_expected_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  UPDATE public."users"
  SET "passwordHash" = p_next_hash, "updatedAt" = p_changed_at
  WHERE "id" = p_user_id
    AND "passwordHash" = p_expected_hash;

  RETURN QUERY SELECT true, resolved_email;
END;
$function$;

ALTER FUNCTION auth.change_own_password(text, text, text, timestamptz)
  OWNER TO pc_password_change_authority;
REVOKE ALL ON FUNCTION auth.change_own_password(text, text, text, timestamptz) FROM PUBLIC;

DO $grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.change_own_password(text,text,text,timestamptz) TO %I',
      runtime_role);
  END LOOP;
END;
$grants$;
