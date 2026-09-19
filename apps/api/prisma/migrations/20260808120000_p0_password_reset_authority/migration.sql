-- Password-reset identity authority under FORCE RLS.
--
-- The public reset request keeps a universal response, while the auth runtime
-- receives only a fixed subject projection and one challenge-bound password
-- mutation. It never receives direct identity-table access or role membership.

DO $password_reset_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_password_reset_authority'
  ) THEN
    CREATE ROLE pc_password_reset_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_password_reset_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_password_reset_authority'
  ) THEN
    RAISE EXCEPTION 'pc_password_reset_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$password_reset_authority_role$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_password_reset_select ON public."users";
CREATE POLICY users_password_reset_select ON public."users"
  FOR SELECT TO pc_password_reset_authority USING (true);
DROP POLICY IF EXISTS users_password_reset_update ON public."users";
CREATE POLICY users_password_reset_update ON public."users"
  FOR UPDATE TO pc_password_reset_authority USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public, auth TO pc_password_reset_authority;
REVOKE ALL PRIVILEGES ON public."users" FROM pc_password_reset_authority;
GRANT SELECT ("id", "email", "status", "deletedAt") ON public."users"
  TO pc_password_reset_authority;
GRANT UPDATE ("passwordHash", "updatedAt") ON public."users"
  TO pc_password_reset_authority;
GRANT SELECT ON auth.password_reset_challenges TO pc_password_reset_authority;

CREATE OR REPLACE FUNCTION auth.resolve_password_reset_subject(p_email text)
RETURNS TABLE (
  user_id text,
  email text,
  user_status text,
  deleted_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
SET row_security = on
AS $function$
  SELECT subject."id", subject."email", subject."status", subject."deletedAt"
  FROM public."users" subject
  WHERE lower(subject."email") = lower(btrim(COALESCE(p_email, '')))
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION auth.replace_password_after_reset(
  p_challenge_id text,
  p_user_id text,
  p_password_hash text,
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
  IF btrim(COALESCE(p_challenge_id, '')) = ''
     OR btrim(COALESCE(p_user_id, '')) = ''
     OR p_changed_at IS NULL THEN
    RAISE EXCEPTION 'Password reset authority input is incomplete'
      USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(p_password_hash, '')) < 40 THEN
    RAISE EXCEPTION 'Password reset credential must be pre-hashed'
      USING ERRCODE = '22023';
  END IF;

  SELECT subject."email"
  INTO resolved_email
  FROM public."users" subject
  WHERE subject."id" = p_user_id
    AND subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL
    AND EXISTS (
      SELECT 1
      FROM auth.password_reset_challenges challenge
      WHERE challenge.id = p_challenge_id
        AND challenge.user_id = p_user_id
        AND challenge.status = 'PENDING'
        AND challenge.expires_at > p_changed_at
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  UPDATE public."users"
  SET "passwordHash" = p_password_hash, "updatedAt" = p_changed_at
  WHERE "id" = p_user_id;

  RETURN QUERY SELECT true, resolved_email;
END;
$function$;

ALTER FUNCTION auth.resolve_password_reset_subject(text)
  OWNER TO pc_password_reset_authority;
ALTER FUNCTION auth.replace_password_after_reset(text,text,text,timestamptz)
  OWNER TO pc_password_reset_authority;
REVOKE ALL ON FUNCTION auth.resolve_password_reset_subject(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.replace_password_after_reset(text,text,text,timestamptz) FROM PUBLIC;

DO $password_reset_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_password_reset_subject(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.replace_password_after_reset(text,text,text,timestamptz) TO %I', runtime_role);
  END LOOP;
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_app', 'one_deal_staff', 'one_deal_storage',
      'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_password_reset_subject(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.replace_password_after_reset(text,text,text,timestamptz) FROM %I', runtime_role);
  END LOOP;
END;
$password_reset_runtime_grants$;

DO $password_reset_authority_proof$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN ('resolve_password_reset_subject', 'replace_password_after_reset')
        AND function.prosecdef
        AND owner.rolname = 'pc_password_reset_authority') <> 2 THEN
    RAISE EXCEPTION 'Password reset function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_password_reset_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_password_reset_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_password_reset_authority', 'public.user_orgs', 'SELECT')
     OR has_table_privilege('pc_password_reset_authority', 'public.organizations', 'SELECT') THEN
    RAISE EXCEPTION 'Password reset authority is broader than its fixed tuple'
      USING ERRCODE = '42501';
  END IF;
END;
$password_reset_authority_proof$;
