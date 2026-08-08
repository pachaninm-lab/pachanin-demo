-- Token-bound invitation acceptance under FORCE RLS.
--
-- A presented invitation credential may reveal only its own acceptance tuple.
-- After the application proves an existing user's password (or validates a new
-- password), one fixed function atomically creates the identity when needed,
-- creates the non-admin membership and consumes the invitation. The function
-- rechecks the token digest, version, expiry, organization and password-hash
-- snapshot to reject races.

DO $invitation_acceptance_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_invitation_acceptance_authority'
  ) THEN
    CREATE ROLE pc_invitation_acceptance_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_invitation_acceptance_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_invitation_acceptance_authority'
  ) THEN
    RAISE EXCEPTION 'pc_invitation_acceptance_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$invitation_acceptance_authority_role$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_invitation_acceptance_select ON public."users";
CREATE POLICY users_invitation_acceptance_select ON public."users"
  FOR SELECT TO pc_invitation_acceptance_authority USING (true);
DROP POLICY IF EXISTS users_invitation_acceptance_insert ON public."users";
CREATE POLICY users_invitation_acceptance_insert ON public."users"
  FOR INSERT TO pc_invitation_acceptance_authority WITH CHECK (true);
DROP POLICY IF EXISTS user_orgs_invitation_acceptance_select ON public."user_orgs";
CREATE POLICY user_orgs_invitation_acceptance_select ON public."user_orgs"
  FOR SELECT TO pc_invitation_acceptance_authority USING (true);
DROP POLICY IF EXISTS user_orgs_invitation_acceptance_insert ON public."user_orgs";
CREATE POLICY user_orgs_invitation_acceptance_insert ON public."user_orgs"
  FOR INSERT TO pc_invitation_acceptance_authority WITH CHECK (true);
DROP POLICY IF EXISTS organizations_invitation_acceptance_select ON public."organizations";
CREATE POLICY organizations_invitation_acceptance_select ON public."organizations"
  FOR SELECT TO pc_invitation_acceptance_authority USING (true);

GRANT USAGE ON SCHEMA public, auth TO pc_invitation_acceptance_authority;
REVOKE ALL PRIVILEGES ON public."users", public."user_orgs", public."organizations"
  FROM pc_invitation_acceptance_authority;
GRANT SELECT ("id", "email", "passwordHash", "status", "deletedAt")
  ON public."users" TO pc_invitation_acceptance_authority;
GRANT INSERT ("id", "email", "phone", "passwordHash", "fullName", "status")
  ON public."users" TO pc_invitation_acceptance_authority;
GRANT SELECT ("id", "userId", "organizationId", "status")
  ON public."user_orgs" TO pc_invitation_acceptance_authority;
GRANT INSERT (
  "id", "userId", "organizationId", "role", "status", "isDefault",
  "is_org_admin", "activated_at"
) ON public."user_orgs" TO pc_invitation_acceptance_authority;
GRANT SELECT ("id", "tenantId", "name", "status")
  ON public."organizations" TO pc_invitation_acceptance_authority;
GRANT SELECT ON auth.organization_invitations TO pc_invitation_acceptance_authority;
GRANT UPDATE (
  status, accepted_at, accepted_by_user_id, accepted_membership_id, version, updated_at
) ON auth.organization_invitations TO pc_invitation_acceptance_authority;

CREATE OR REPLACE FUNCTION auth.resolve_invitation_acceptance_credential(
  p_invitation_id text,
  p_token_hash text
)
RETURNS TABLE (
  invitation_id text,
  organization_id text,
  tenant_id text,
  organization_name text,
  organization_status text,
  invited_email text,
  role text,
  invitation_status text,
  expires_at timestamptz,
  invitation_version bigint,
  existing_user_id text,
  existing_password_hash text,
  existing_user_status text,
  existing_user_deleted_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth, public, pg_temp
SET row_security = on
AS $function$
  SELECT
    invitation.id,
    invitation.organization_id,
    invitation.tenant_id,
    organization."name",
    organization."status",
    invitation.invited_email,
    invitation.role,
    invitation.status,
    invitation.expires_at,
    invitation.version,
    subject."id",
    subject."passwordHash",
    subject."status",
    subject."deletedAt"
  FROM auth.organization_invitations invitation
  JOIN public."organizations" organization
    ON organization."id" = invitation.organization_id
   AND organization."tenantId" = invitation.tenant_id
  LEFT JOIN public."users" subject
    ON subject."email" = invitation.invited_email
  WHERE invitation.id = p_invitation_id
    AND invitation.token_hash = p_token_hash
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION auth.accept_organization_invitation_identity(
  p_invitation_id text,
  p_token_hash text,
  p_expected_version bigint,
  p_user_id text,
  p_expected_password_hash text,
  p_create_user boolean,
  p_new_password_hash text,
  p_phone text,
  p_full_name text,
  p_membership_id text
)
RETURNS TABLE (
  accepted boolean,
  user_id text,
  membership_id text,
  organization_id text,
  tenant_id text,
  organization_name text,
  role text,
  invitation_version bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
SET row_security = on
AS $function$
DECLARE
  invitation record;
  subject public."users"%ROWTYPE;
  subject_exists boolean;
  make_default boolean;
  accepted_time timestamptz := clock_timestamp();
  changed integer;
BEGIN
  SELECT candidate.*, organization."name" AS accepted_organization_name
  INTO invitation
  FROM auth.organization_invitations candidate
  JOIN public."organizations" organization
    ON organization."id" = candidate.organization_id
   AND organization."tenantId" = candidate.tenant_id
   AND organization."status" = 'VERIFIED'
  WHERE candidate.id = p_invitation_id
    AND candidate.token_hash = p_token_hash
    AND candidate.status = 'PENDING'
    AND candidate.version = p_expected_version
    AND candidate.expires_at > accepted_time
  FOR UPDATE OF candidate;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::bigint;
    RETURN;
  END IF;

  SELECT existing.*
  INTO subject
  FROM public."users" existing
  WHERE existing."email" = invitation.invited_email
  LIMIT 1;
  subject_exists := FOUND;

  IF length(COALESCE(p_user_id, '')) < 8
     OR length(COALESCE(p_membership_id, '')) < 8
     OR EXISTS (
       SELECT 1 FROM public."user_orgs" membership
       WHERE membership."userId" = p_user_id
         AND membership."organizationId" = invitation.organization_id
     ) THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::bigint;
    RETURN;
  END IF;

  IF subject_exists THEN
    IF p_create_user
       OR subject."id" <> p_user_id
       OR subject."status" <> 'ACTIVE'
       OR subject."deletedAt" IS NOT NULL
       OR subject."passwordHash" IS DISTINCT FROM p_expected_password_hash THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::bigint;
      RETURN;
    END IF;
  ELSE
    IF NOT p_create_user
       OR length(COALESCE(p_new_password_hash, '')) < 40
       OR length(btrim(COALESCE(p_full_name, ''))) < 2 THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::bigint;
      RETURN;
    END IF;
    INSERT INTO public."users" (
      "id", "email", "phone", "passwordHash", "fullName", "status"
    ) VALUES (
      p_user_id, invitation.invited_email, NULLIF(btrim(COALESCE(p_phone, '')), ''),
      p_new_password_hash, btrim(p_full_name), 'ACTIVE'
    );
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public."user_orgs" membership
    WHERE membership."userId" = p_user_id
      AND membership."status" = 'ACTIVE'
  ) INTO make_default;

  INSERT INTO public."user_orgs" (
    "id", "userId", "organizationId", "role", "status", "isDefault",
    "is_org_admin", "activated_at"
  ) VALUES (
    p_membership_id, p_user_id, invitation.organization_id, invitation.role,
    'ACTIVE', make_default, false, accepted_time
  );

  UPDATE auth.organization_invitations current_invitation
  SET status = 'ACCEPTED',
      accepted_at = accepted_time,
      accepted_by_user_id = p_user_id,
      accepted_membership_id = p_membership_id,
      version = current_invitation.version + 1,
      updated_at = accepted_time
  WHERE current_invitation.id = invitation.id
    AND current_invitation.status = 'PENDING'
    AND current_invitation.version = p_expected_version;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN
    RAISE EXCEPTION 'Invitation acceptance version conflict'
      USING ERRCODE = '40001';
  END IF;

  RETURN QUERY SELECT
    true,
    p_user_id,
    p_membership_id,
    invitation.organization_id,
    invitation.tenant_id,
    invitation.accepted_organization_name,
    invitation.role,
    p_expected_version + 1;
END;
$function$;

ALTER FUNCTION auth.resolve_invitation_acceptance_credential(text,text)
  OWNER TO pc_invitation_acceptance_authority;
ALTER FUNCTION auth.accept_organization_invitation_identity(
  text,text,bigint,text,text,boolean,text,text,text,text
) OWNER TO pc_invitation_acceptance_authority;
REVOKE ALL ON FUNCTION auth.resolve_invitation_acceptance_credential(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.accept_organization_invitation_identity(
  text,text,bigint,text,text,boolean,text,text,text,text
) FROM PUBLIC;

DO $invitation_acceptance_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_invitation_acceptance_credential(text,text) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text) TO %I',
      runtime_role
    );
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
      'REVOKE ALL ON FUNCTION auth.resolve_invitation_acceptance_credential(text,text) FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.accept_organization_invitation_identity(text,text,bigint,text,text,boolean,text,text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$invitation_acceptance_runtime_grants$;

DO $invitation_acceptance_authority_proof$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN (
          'resolve_invitation_acceptance_credential',
          'accept_organization_invitation_identity'
        )
        AND function.prosecdef
        AND owner.rolname = 'pc_invitation_acceptance_authority') <> 2 THEN
    RAISE EXCEPTION 'Invitation acceptance function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_invitation_acceptance_authority', 'public.users', 'UPDATE')
     OR has_table_privilege('pc_invitation_acceptance_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_invitation_acceptance_authority', 'public.user_orgs', 'UPDATE')
     OR has_table_privilege('pc_invitation_acceptance_authority', 'public.user_orgs', 'DELETE')
     OR has_table_privilege('pc_invitation_acceptance_authority', 'public.organizations', 'UPDATE') THEN
    RAISE EXCEPTION 'Invitation acceptance authority is broader than its fixed lifecycle'
      USING ERRCODE = '42501';
  END IF;
END;
$invitation_acceptance_authority_proof$;
