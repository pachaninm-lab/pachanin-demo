-- A write path for the opportunistic password-hash format upgrade.
--
-- verifyPasswordWithUpgrade has existed since the versioned scheme was added,
-- and nothing called it: both login paths called verifyPassword, so no legacy
-- bcrypt hash was ever rewritten and the truncation V6.2.8 is about stayed in
-- place for every existing account. The machinery was there and unreachable.
--
-- public."users" is under FORCE row level security, so a SECURITY DEFINER
-- function is not enough on its own: FORCE means the policies apply to the
-- table owner too, and a definer function owned by that role still reads and
-- writes through them. The established pattern in this repository is a definer
-- function owned by a narrow authority PLUS a policy naming that authority -
-- auth.replace_password_after_reset with users_password_reset_update is the
-- same shape. This adds one more of those, for one column.
--
-- The authority is dedicated rather than borrowed. Owning this function by
-- pc_password_reset_authority would have reused its existing policy and given a
-- format upgrade the full write rights of a password reset; a separate role
-- carries exactly one privilege.
--
-- The privilege is column-scoped. GRANT UPDATE ("passwordHash") means that even
-- if this path were driven by an attacker who could call the function, no other
-- column of public."users" can be written through it. RLS decides which rows;
-- the column grant decides which fields.
--
-- What it deliberately does NOT do, and each omission is the property rather
-- than an oversight:
--
--   * It does not touch credential_version. A format upgrade is not a
--     credential change; bumping the version would revoke every session the
--     user holds because the server silently re-encoded their password.
--   * It does not touch password_changed_at. The password did not change.
--   * It sends no notification. Telling a user their password changed when it
--     did not would be a false security alert, and users who learn those alerts
--     are noise stop reading the real ones.
--   * It cannot set an arbitrary hash: the UPDATE is conditional on the exact
--     previous value, so a concurrent password change or a parallel login that
--     already upgraded wins and this call reports that it changed nothing.
--
-- The caller has already verified the password against the previous hash before
-- this runs. This function verifies nothing and is never an authentication step.
--
-- Raised as #4683.

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_password_format_authority') THEN
    CREATE ROLE pc_password_format_authority NOLOGIN;
  END IF;
END;
$role$;

GRANT USAGE ON SCHEMA public TO pc_password_format_authority;
GRANT SELECT ("id", "passwordHash") ON public."users" TO pc_password_format_authority;
GRANT UPDATE ("passwordHash") ON public."users" TO pc_password_format_authority;

-- Both policies are needed, and finding that out took a real database rather
-- than reading. The UPDATE's WHERE clause reads "passwordHash" to compare it
-- with the expected value, and under FORCE row level security that read is
-- filtered too: with only the UPDATE policy the statement matched no row and
-- the function returned false for a legitimate upgrade. A definer function
-- owned by the table owner does not escape this - FORCE means the owner is
-- subject to the policies as well.
DROP POLICY IF EXISTS users_password_format_read ON public."users";
CREATE POLICY users_password_format_read ON public."users"
  FOR SELECT TO pc_password_format_authority
  USING (true);

DROP POLICY IF EXISTS users_password_format_upgrade ON public."users";
CREATE POLICY users_password_format_upgrade ON public."users"
  FOR UPDATE TO pc_password_format_authority
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION auth.upgrade_password_hash_format(
  p_user_id text,
  p_next_hash text,
  p_expected_hash text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $function$
  WITH changed AS (
    UPDATE public."users"
       SET "passwordHash" = p_next_hash
     WHERE "id" = p_user_id
       AND "passwordHash" = p_expected_hash
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM changed);
$function$;

ALTER FUNCTION auth.upgrade_password_hash_format(text, text, text)
  OWNER TO pc_password_format_authority;

REVOKE ALL ON FUNCTION auth.upgrade_password_hash_format(text, text, text) FROM PUBLIC;

DO $grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.upgrade_password_hash_format(text,text,text) TO %I',
      runtime_role);
  END LOOP;
END;
$grants$;
