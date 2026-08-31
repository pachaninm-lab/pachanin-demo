-- P0 registration lifecycle authority after identity FORCE RLS.
--
-- Public registration has no authenticated PostgreSQL context, so it cannot
-- read or mutate users, memberships or organizations directly. Keep that
-- boundary intact: a membership-free NOLOGIN role owns four fixed functions
-- for initial identity preparation, safe restart, email-verification status
-- alignment and post-verification organization-admin notification routing.

DO $registration_lifecycle_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_registration_lifecycle_authority'
  ) THEN
    CREATE ROLE pc_registration_lifecycle_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_registration_lifecycle_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_registration_lifecycle_authority'
  ) THEN
    RAISE EXCEPTION 'pc_registration_lifecycle_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$registration_lifecycle_role$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_registration_lifecycle_select ON public."users";
CREATE POLICY users_registration_lifecycle_select ON public."users"
  FOR SELECT TO pc_registration_lifecycle_authority USING (true);
DROP POLICY IF EXISTS users_registration_lifecycle_insert ON public."users";
CREATE POLICY users_registration_lifecycle_insert ON public."users"
  FOR INSERT TO pc_registration_lifecycle_authority WITH CHECK (true);
DROP POLICY IF EXISTS users_registration_lifecycle_update ON public."users";
CREATE POLICY users_registration_lifecycle_update ON public."users"
  FOR UPDATE TO pc_registration_lifecycle_authority USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_orgs_registration_lifecycle_select ON public."user_orgs";
CREATE POLICY user_orgs_registration_lifecycle_select ON public."user_orgs"
  FOR SELECT TO pc_registration_lifecycle_authority USING (true);
DROP POLICY IF EXISTS user_orgs_registration_lifecycle_insert ON public."user_orgs";
CREATE POLICY user_orgs_registration_lifecycle_insert ON public."user_orgs"
  FOR INSERT TO pc_registration_lifecycle_authority WITH CHECK (true);
DROP POLICY IF EXISTS user_orgs_registration_lifecycle_update ON public."user_orgs";
CREATE POLICY user_orgs_registration_lifecycle_update ON public."user_orgs"
  FOR UPDATE TO pc_registration_lifecycle_authority USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS organizations_registration_lifecycle_select ON public."organizations";
CREATE POLICY organizations_registration_lifecycle_select ON public."organizations"
  FOR SELECT TO pc_registration_lifecycle_authority USING (true);
DROP POLICY IF EXISTS organizations_registration_lifecycle_insert ON public."organizations";
CREATE POLICY organizations_registration_lifecycle_insert ON public."organizations"
  FOR INSERT TO pc_registration_lifecycle_authority WITH CHECK (true);
DROP POLICY IF EXISTS organizations_registration_lifecycle_update ON public."organizations";
CREATE POLICY organizations_registration_lifecycle_update ON public."organizations"
  FOR UPDATE TO pc_registration_lifecycle_authority USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public, auth TO pc_registration_lifecycle_authority;
REVOKE ALL PRIVILEGES ON public."users", public."user_orgs", public."organizations"
  FROM pc_registration_lifecycle_authority;
GRANT SELECT, INSERT, UPDATE ON public."users", public."user_orgs", public."organizations"
  TO pc_registration_lifecycle_authority;
GRANT SELECT ON auth.registration_applications, auth.registration_email_challenges
  TO pc_registration_lifecycle_authority;

CREATE OR REPLACE FUNCTION auth.prepare_pending_registration_identity(
  p_user_id text,
  p_membership_id text,
  p_proposed_organization_id text,
  p_proposed_tenant_id text,
  p_email text,
  p_phone text,
  p_password_hash text,
  p_full_name text,
  p_org_inn text,
  p_org_legal_name text,
  p_org_type text,
  p_org_kpp text,
  p_org_ogrn text,
  p_region text,
  p_requested_workspace text
)
RETURNS TABLE (
  outcome text,
  application_kind text,
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
  normalized_email text := lower(btrim(COALESCE(p_email, '')));
  normalized_inn text := regexp_replace(COALESCE(p_org_inn, ''), '[^0-9]', '', 'g');
  existing_organization record;
  effective_organization_id text;
  effective_tenant_id text;
  effective_kind text;
  created_at timestamptz := now();
BEGIN
  IF normalized_email = '' OR position('@' in normalized_email) <= 1
     OR normalized_inn = '' OR btrim(COALESCE(p_full_name, '')) = ''
     OR btrim(COALESCE(p_org_legal_name, '')) = ''
     OR btrim(COALESCE(p_region, '')) = '' THEN
    RAISE EXCEPTION 'Registration identity fields are incomplete' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_user_id, '')) = ''
     OR btrim(COALESCE(p_membership_id, '')) = ''
     OR btrim(COALESCE(p_proposed_organization_id, '')) = ''
     OR btrim(COALESCE(p_proposed_tenant_id, '')) = '' THEN
    RAISE EXCEPTION 'Registration identifiers are required' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(p_password_hash, '')) < 40 THEN
    RAISE EXCEPTION 'Registration credential must be pre-hashed' USING ERRCODE = '22023';
  END IF;
  IF p_org_type NOT IN ('LEGAL', 'INDIVIDUAL', 'SELF_EMPLOYED') THEN
    RAISE EXCEPTION 'Organization type is not self-registerable' USING ERRCODE = '22023';
  END IF;
  IF p_requested_workspace NOT IN (
    'seller', 'buyer', 'logistics', 'driver', 'elevator',
    'lab', 'surveyor', 'bank', 'employee'
  ) THEN
    RAISE EXCEPTION 'Workspace is not self-registerable' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('registration-email:' || normalized_email, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('registration-inn:' || normalized_inn, 0));

  IF EXISTS (SELECT 1 FROM public."users" subject WHERE lower(subject."email") = normalized_email) THEN
    RETURN QUERY SELECT 'SUPPRESSED'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT organization."id", organization."tenantId", organization."status"
  INTO existing_organization
  FROM public."organizations" organization
  WHERE organization."inn" = normalized_inn
  LIMIT 1;

  IF FOUND THEN
    -- Joining an existing organization is allowed only through its verified
    -- admission contour. The public response remains identical when it is not
    -- eligible, so INN status cannot be enumerated.
    IF existing_organization."status" <> 'VERIFIED' THEN
      RETURN QUERY SELECT 'SUPPRESSED'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
      RETURN;
    END IF;
    effective_kind := 'JOIN_EXISTING_ORGANIZATION';
    effective_organization_id := existing_organization."id";
    effective_tenant_id := existing_organization."tenantId";
  ELSE
    -- An employee never creates an organization through public registration;
    -- employee access is an invitation or verified existing-org join request.
    IF p_requested_workspace = 'employee' THEN
      RETURN QUERY SELECT 'SUPPRESSED'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text;
      RETURN;
    END IF;
    effective_kind := 'NEW_ORGANIZATION';
    effective_organization_id := p_proposed_organization_id;
    effective_tenant_id := p_proposed_tenant_id;
    INSERT INTO public."organizations" (
      "id", "inn", "name", "type", "status", "tenantId", "kycStatus",
      "amlStatus", "sanctionHit", "kpp", "ogrn", "region", "createdAt", "updatedAt"
    ) VALUES (
      effective_organization_id, normalized_inn, btrim(p_org_legal_name), p_org_type,
      'PENDING', effective_tenant_id, 'PENDING', 'CLEAR', false,
      NULLIF(btrim(COALESCE(p_org_kpp, '')), ''),
      NULLIF(btrim(COALESCE(p_org_ogrn, '')), ''), btrim(p_region), created_at, created_at
    );
  END IF;

  INSERT INTO public."users" (
    "id", "email", "phone", "passwordHash", "fullName", "status",
    "mfaEnabled", "mfaSecret", "mfaBackup", "deletedAt", "createdAt", "updatedAt"
  ) VALUES (
    p_user_id, normalized_email, NULLIF(btrim(COALESCE(p_phone, '')), ''),
    p_password_hash, btrim(p_full_name), 'PENDING_EMAIL_VERIFICATION',
    false, NULL, NULL, NULL, created_at, created_at
  );

  INSERT INTO public."user_orgs" (
    "id", "userId", "organizationId", "role", "status",
    "requested_workspace", "isDefault", "is_org_admin", "joinedAt"
  ) VALUES (
    p_membership_id, p_user_id, effective_organization_id, 'GUEST', 'PENDING',
    p_requested_workspace, true, false, created_at
  );

  RETURN QUERY SELECT
    'CREATED'::text, effective_kind, p_user_id, p_membership_id,
    effective_organization_id, effective_tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.restart_pending_registration_identity(
  p_previous_application_id text,
  p_user_id text,
  p_membership_id text,
  p_organization_id text,
  p_email text,
  p_phone text,
  p_password_hash text,
  p_full_name text,
  p_org_inn text,
  p_org_legal_name text,
  p_org_type text,
  p_org_kpp text,
  p_org_ogrn text,
  p_region text,
  p_requested_workspace text
)
RETURNS TABLE (restarted boolean, application_kind text, tenant_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  normalized_email text := lower(btrim(COALESCE(p_email, '')));
  normalized_inn text := regexp_replace(COALESCE(p_org_inn, ''), '[^0-9]', '', 'g');
  candidate record;
BEGIN
  IF btrim(COALESCE(p_previous_application_id, '')) = ''
     OR btrim(COALESCE(p_user_id, '')) = ''
     OR btrim(COALESCE(p_membership_id, '')) = ''
     OR btrim(COALESCE(p_organization_id, '')) = '' THEN
    RAISE EXCEPTION 'Registration restart identifiers are required' USING ERRCODE = '22023';
  END IF;
  IF normalized_email = '' OR position('@' in normalized_email) <= 1
     OR normalized_inn = '' OR btrim(COALESCE(p_full_name, '')) = ''
     OR btrim(COALESCE(p_org_legal_name, '')) = ''
     OR btrim(COALESCE(p_region, '')) = '' THEN
    RAISE EXCEPTION 'Registration restart fields are incomplete' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(p_password_hash, '')) < 40 THEN
    RAISE EXCEPTION 'Registration credential must be pre-hashed' USING ERRCODE = '22023';
  END IF;
  IF p_org_type NOT IN ('LEGAL', 'INDIVIDUAL', 'SELF_EMPLOYED') THEN
    RAISE EXCEPTION 'Organization type is not self-registerable' USING ERRCODE = '22023';
  END IF;
  IF p_requested_workspace NOT IN (
    'seller', 'buyer', 'logistics', 'driver', 'elevator',
    'lab', 'surveyor', 'bank', 'employee'
  ) THEN
    RAISE EXCEPTION 'Workspace is not self-registerable' USING ERRCODE = '42501';
  END IF;

  SELECT
    application.kind,
    organization."tenantId" AS tenant_id,
    organization."status" AS organization_status,
    subject."status" AS user_status,
    subject."deletedAt" AS user_deleted_at,
    membership."status" AS membership_status
  INTO candidate
  FROM auth.registration_applications application
  JOIN public."users" subject ON subject."id" = application.user_id
  JOIN public."user_orgs" membership ON membership."id" = application.membership_id
  JOIN public."organizations" organization ON organization."id" = application.organization_id
  WHERE application.id = p_previous_application_id
    AND application.user_id = p_user_id
    AND application.membership_id = p_membership_id
    AND application.organization_id = p_organization_id
    AND application.status IN ('EXPIRED', 'CANCELLED')
    AND application.inn = normalized_inn
    AND lower(application.email) = normalized_email
    AND lower(subject."email") = normalized_email
    AND membership."userId" = p_user_id
    AND membership."organizationId" = p_organization_id
  FOR UPDATE OF subject, membership, organization;

  IF NOT FOUND
     OR candidate.user_deleted_at IS NOT NULL
     OR candidate.user_status NOT IN ('PENDING_EMAIL_VERIFICATION', 'PENDING_APPROVAL')
     OR candidate.membership_status <> 'PENDING'
     OR candidate.organization_status NOT IN ('PENDING', 'VERIFIED')
     OR (candidate.kind = 'JOIN_EXISTING_ORGANIZATION' AND candidate.organization_status <> 'VERIFIED')
     OR (p_requested_workspace = 'employee' AND candidate.kind <> 'JOIN_EXISTING_ORGANIZATION') THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text;
    RETURN;
  END IF;

  UPDATE public."users"
  SET "phone" = NULLIF(btrim(COALESCE(p_phone, '')), ''),
      "passwordHash" = p_password_hash,
      "fullName" = btrim(p_full_name),
      "status" = 'PENDING_EMAIL_VERIFICATION',
      "updatedAt" = now()
  WHERE "id" = p_user_id;

  UPDATE public."user_orgs"
  SET "role" = 'GUEST', "status" = 'PENDING',
      "requested_workspace" = p_requested_workspace,
      "isDefault" = true, "is_org_admin" = false,
      "version" = "version" + 1
  WHERE "id" = p_membership_id;

  IF candidate.kind = 'NEW_ORGANIZATION' THEN
    UPDATE public."organizations"
    SET "name" = btrim(p_org_legal_name), "type" = p_org_type,
        "ogrn" = NULLIF(btrim(COALESCE(p_org_ogrn, '')), ''),
        "kpp" = NULLIF(btrim(COALESCE(p_org_kpp, '')), ''),
        "region" = btrim(p_region), "version" = "version" + 1,
        "updatedAt" = now()
    WHERE "id" = p_organization_id AND "status" = 'PENDING';
  END IF;

  RETURN QUERY SELECT true, candidate.kind::text, candidate.tenant_id::text;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.mark_registration_email_verified(
  p_application_id text,
  p_challenge_id text,
  p_user_id text
)
RETURNS TABLE (updated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  affected integer;
BEGIN
  UPDATE public."users" subject
  SET "status" = 'PENDING_APPROVAL', "updatedAt" = now()
  WHERE subject."id" = p_user_id
    AND subject."status" = 'PENDING_EMAIL_VERIFICATION'
    AND EXISTS (
      SELECT 1
      FROM auth.registration_applications application
      JOIN auth.registration_email_challenges challenge
        ON challenge.id = p_challenge_id
       AND challenge.application_id = application.id
       AND challenge.user_id = p_user_id
       AND challenge.status = 'CONSUMED'
      WHERE application.id = p_application_id
        AND application.user_id = p_user_id
        AND application.status = 'ORGANIZATION_VERIFICATION_PENDING'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN QUERY SELECT affected = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.registration_join_notification_recipients(
  p_application_id text,
  p_user_id text,
  p_organization_id text
)
RETURNS TABLE (recipient_email text, applicant_name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
  SELECT administrators.recipient_email, applicant."fullName"
  FROM auth.registration_applications application
  JOIN public."users" applicant ON applicant."id" = p_user_id
  LEFT JOIN LATERAL (
    SELECT administrator."email" AS recipient_email
    FROM public."user_orgs" membership
    JOIN public."users" administrator
      ON administrator."id" = membership."userId"
     AND administrator."status" = 'ACTIVE'
     AND administrator."deletedAt" IS NULL
    WHERE membership."organizationId" = p_organization_id
      AND membership."status" = 'ACTIVE'
      AND membership."is_org_admin" = true
    ORDER BY membership."joinedAt", membership."id"
    LIMIT 20
  ) administrators ON true
  WHERE application.id = p_application_id
    AND application.user_id = p_user_id
    AND application.organization_id = p_organization_id
    AND application.kind = 'JOIN_EXISTING_ORGANIZATION'
    AND application.status = 'ORGANIZATION_VERIFICATION_PENDING'
  ORDER BY administrators.recipient_email NULLS LAST;
$function$;

ALTER FUNCTION auth.prepare_pending_registration_identity(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) OWNER TO pc_registration_lifecycle_authority;
ALTER FUNCTION auth.restart_pending_registration_identity(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) OWNER TO pc_registration_lifecycle_authority;
ALTER FUNCTION auth.mark_registration_email_verified(text,text,text)
  OWNER TO pc_registration_lifecycle_authority;
ALTER FUNCTION auth.registration_join_notification_recipients(text,text,text)
  OWNER TO pc_registration_lifecycle_authority;

REVOKE ALL ON FUNCTION auth.prepare_pending_registration_identity(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.restart_pending_registration_identity(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.mark_registration_email_verified(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.registration_join_notification_recipients(text,text,text) FROM PUBLIC;

-- The predecessor function created an ACTIVE user and an immediately
-- privileged membership. It is retained only as forward-only migration
-- history: no runtime may execute it, and its old owner no longer has identity
-- table privileges or policies with which the body could operate.
REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(
  text,text,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC;
REVOKE ALL PRIVILEGES ON public."users", public."user_orgs", public."organizations"
  FROM pc_registration_authority;
DROP POLICY IF EXISTS users_registration_authority_select ON public."users";
DROP POLICY IF EXISTS users_registration_authority_insert ON public."users";
DROP POLICY IF EXISTS user_orgs_registration_authority_select ON public."user_orgs";
DROP POLICY IF EXISTS user_orgs_registration_authority_insert ON public."user_orgs";
DROP POLICY IF EXISTS organizations_registration_authority_select ON public."organizations";
DROP POLICY IF EXISTS organizations_registration_authority_insert ON public."organizations";

DO $registration_lifecycle_runtime_grants$
DECLARE
  runtime_role text;
  function_signature text;
  lifecycle_functions text[] := ARRAY[
    'auth.prepare_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
    'auth.restart_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
    'auth.mark_registration_email_verified(text,text,text)',
    'auth.registration_join_notification_recipients(text,text,text)'
  ];
BEGIN
  FOREACH function_signature IN ARRAY lifecycle_functions LOOP
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', function_signature, runtime_role);
    END LOOP;
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
        'one_deal_app', 'one_deal_staff', 'one_deal_storage',
        'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
      )
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', function_signature, runtime_role);
    END LOOP;
  END LOOP;

  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_staff_runtime',
      'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_auth', 'one_deal_app', 'one_deal_staff', 'one_deal_storage',
      'app_auth', 'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.create_pending_registration_identity(text,text,text,text,text,text,text,text,text,text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$registration_lifecycle_runtime_grants$;

DO $registration_lifecycle_authority_proof$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN (
          'prepare_pending_registration_identity',
          'restart_pending_registration_identity',
          'mark_registration_email_verified',
          'registration_join_notification_recipients'
        )
        AND function.prosecdef
        AND owner.rolname = 'pc_registration_lifecycle_authority') <> 4 THEN
    RAISE EXCEPTION 'Registration lifecycle function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_registration_lifecycle_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_registration_lifecycle_authority', 'public.user_orgs', 'DELETE')
     OR has_table_privilege('pc_registration_lifecycle_authority', 'public.organizations', 'DELETE') THEN
    RAISE EXCEPTION 'Registration lifecycle authority may not delete identity rows'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_registration_authority', 'public.users', 'SELECT')
     OR has_table_privilege('pc_registration_authority', 'public.user_orgs', 'SELECT')
     OR has_table_privilege('pc_registration_authority', 'public.organizations', 'SELECT') THEN
    RAISE EXCEPTION 'Retired registration authority still has identity access'
      USING ERRCODE = '42501';
  END IF;
END;
$registration_lifecycle_authority_proof$;
