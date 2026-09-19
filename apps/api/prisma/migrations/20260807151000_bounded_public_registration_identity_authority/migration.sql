-- Bounded pre-authentication identity creation for public registration (#3670).
--
-- FORCE RLS correctly removed the old ability of the authentication runtime to
-- write public.users/public.user_orgs/public.organizations without an identity
-- context. Registration is the one legitimate pre-auth write: it creates a new
-- PENDING organization, a non-privileged self-registerable identity and its
-- first membership before a session can exist.
--
-- Do not solve that by giving the login principal BYPASSRLS or a blanket INSERT
-- policy. A dedicated NOLOGIN authority owns one fixed SECURITY DEFINER
-- function. The runtime can execute that function but cannot become the role.
-- The function fixes every authority-bearing status itself and accepts only the
-- public self-registration role vocabulary.

DO $registration_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_registration_authority'
  ) THEN
    CREATE ROLE pc_registration_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_registration_authority'
      AND (
        rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls
        OR rolcreatedb OR rolcreaterole
      )
  ) THEN
    RAISE EXCEPTION 'pc_registration_authority is not confined'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_registration_authority'
  ) THEN
    RAISE EXCEPTION 'pc_registration_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$registration_authority_role$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

-- The authority is NOLOGIN and membership-free, so these policies are reachable
-- only from the fixed definer function below. Keep UPDATE/DELETE absent.
DROP POLICY IF EXISTS users_registration_authority_select ON public."users";
CREATE POLICY users_registration_authority_select ON public."users"
  FOR SELECT TO pc_registration_authority USING (true);
DROP POLICY IF EXISTS users_registration_authority_insert ON public."users";
CREATE POLICY users_registration_authority_insert ON public."users"
  FOR INSERT TO pc_registration_authority WITH CHECK (true);

DROP POLICY IF EXISTS user_orgs_registration_authority_select ON public."user_orgs";
CREATE POLICY user_orgs_registration_authority_select ON public."user_orgs"
  FOR SELECT TO pc_registration_authority USING (true);
DROP POLICY IF EXISTS user_orgs_registration_authority_insert ON public."user_orgs";
CREATE POLICY user_orgs_registration_authority_insert ON public."user_orgs"
  FOR INSERT TO pc_registration_authority WITH CHECK (true);

DROP POLICY IF EXISTS organizations_registration_authority_select ON public."organizations";
CREATE POLICY organizations_registration_authority_select ON public."organizations"
  FOR SELECT TO pc_registration_authority USING (true);
DROP POLICY IF EXISTS organizations_registration_authority_insert ON public."organizations";
CREATE POLICY organizations_registration_authority_insert ON public."organizations"
  FOR INSERT TO pc_registration_authority WITH CHECK (true);

GRANT USAGE ON SCHEMA public, auth TO pc_registration_authority;
REVOKE ALL PRIVILEGES ON TABLE
  public."users", public."user_orgs", public."organizations"
FROM pc_registration_authority;
GRANT SELECT, INSERT ON TABLE
  public."users", public."user_orgs", public."organizations"
TO pc_registration_authority;

CREATE OR REPLACE FUNCTION auth.create_pending_registration_identity(
  p_user_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_email text,
  p_phone text,
  p_password_hash text,
  p_full_name text,
  p_org_inn text,
  p_org_legal_name text,
  p_org_type text,
  p_role text
)
RETURNS TABLE (
  outcome text,
  user_id text,
  membership_id text,
  organization_id text,
  tenant_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  normalized_email text := lower(btrim(p_email));
  normalized_inn text := regexp_replace(COALESCE(p_org_inn, ''), '[^0-9]', '', 'g');
BEGIN
  IF normalized_email = '' OR position('@' in normalized_email) <= 1 THEN
    RAISE EXCEPTION 'Registration email is invalid' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_full_name, '')) = ''
     OR btrim(COALESCE(p_org_legal_name, '')) = ''
     OR normalized_inn = '' THEN
    RAISE EXCEPTION 'Registration identity fields are incomplete' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_user_id, '')) = ''
     OR btrim(COALESCE(p_membership_id, '')) = ''
     OR btrim(COALESCE(p_organization_id, '')) = ''
     OR btrim(COALESCE(p_tenant_id, '')) = '' THEN
    RAISE EXCEPTION 'Registration identifiers are required' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(p_password_hash, '')) < 40 THEN
    RAISE EXCEPTION 'Registration credential must be pre-hashed' USING ERRCODE = '22023';
  END IF;
  IF p_org_type NOT IN ('LEGAL', 'INDIVIDUAL', 'SELF_EMPLOYED') THEN
    RAISE EXCEPTION 'Organization type is not self-registerable' USING ERRCODE = '22023';
  END IF;
  IF p_role NOT IN ('FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'LAB', 'ELEVATOR', 'ACCOUNTING') THEN
    RAISE EXCEPTION 'Role is not self-registerable' USING ERRCODE = '42501';
  END IF;

  -- Serialize duplicate decisions without leaking rows to the invoker. Hash
  -- collisions only serialize unrelated submissions and cannot grant access.
  PERFORM pg_advisory_xact_lock(hashtextextended('registration-email:' || normalized_email, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('registration-inn:' || normalized_inn, 0));

  IF EXISTS (SELECT 1 FROM public."users" candidate WHERE candidate."email" = normalized_email) THEN
    RETURN QUERY SELECT 'EMAIL_EXISTS', NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public."organizations" candidate WHERE candidate."inn" = normalized_inn) THEN
    RETURN QUERY SELECT 'ORGANIZATION_EXISTS', NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public."organizations" (
    "id", "inn", "name", "type", "status", "tenantId",
    "kycStatus", "amlStatus", "sanctionHit"
  ) VALUES (
    p_organization_id, normalized_inn, btrim(p_org_legal_name), p_org_type,
    'PENDING', p_tenant_id, 'PENDING', 'CLEAR', false
  );

  INSERT INTO public."users" (
    "id", "email", "phone", "passwordHash", "fullName", "status",
    "mfaEnabled", "mfaSecret", "mfaBackup", "deletedAt"
  ) VALUES (
    p_user_id, normalized_email, NULLIF(btrim(COALESCE(p_phone, '')), ''),
    p_password_hash, btrim(p_full_name), 'ACTIVE', false, NULL, NULL, NULL
  );

  INSERT INTO public."user_orgs" (
    "id", "userId", "organizationId", "role", "isDefault"
  ) VALUES (
    p_membership_id, p_user_id, p_organization_id, p_role, true
  );

  RETURN QUERY SELECT
    'CREATED', p_user_id, p_membership_id, p_organization_id, p_tenant_id;
END;
$function$;

ALTER FUNCTION auth.create_pending_registration_identity(
  text,text,text,text,text,text,text,text,text,text,text,text
) OWNER TO pc_registration_authority;
REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(
  text,text,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC;

DO $registration_runtime_execute$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text) TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_app', 'one_deal_staff', 'one_deal_storage',
      'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$registration_runtime_execute$;

DO $registration_authority_proof$
DECLARE
  relation_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'create_pending_registration_identity'
      AND owner.rolname = 'pc_registration_authority'
      AND function.prosecdef
  ) THEN
    RAISE EXCEPTION 'Bounded registration function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY['users', 'user_orgs', 'organizations']
  LOOP
    IF NOT has_table_privilege(
      'pc_registration_authority', format('public.%I', relation_name), 'SELECT'
    ) OR NOT has_table_privilege(
      'pc_registration_authority', format('public.%I', relation_name), 'INSERT'
    ) THEN
      RAISE EXCEPTION 'Registration authority is missing SELECT/INSERT on public.%', relation_name
        USING ERRCODE = '42501';
    END IF;
    IF has_table_privilege(
      'pc_registration_authority', format('public.%I', relation_name), 'UPDATE'
    ) OR has_table_privilege(
      'pc_registration_authority', format('public.%I', relation_name), 'DELETE'
    ) THEN
      RAISE EXCEPTION 'Registration authority received mutable privilege on public.%', relation_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END;
$registration_authority_proof$;
