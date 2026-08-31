-- Repair the bounded pre-authentication registration authority introduced in
-- 20260807151000. Prisma's @updatedAt columns are NOT NULL but have no database
-- default, so raw SQL inside the SECURITY DEFINER function must populate them
-- explicitly. Without this, a legitimate public registration fails closed with
-- SQLSTATE 23502 on organizations.updatedAt (and would then fail on
-- users.updatedAt).
--
-- Keep the authority model unchanged: pc_registration_authority remains
-- NOLOGIN/membership-free/NOBYPASSRLS, the auth runtime receives EXECUTE only,
-- and FORCE RLS remains enabled on all identity tables.

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
  created_at timestamptz := now();
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
    "kycStatus", "amlStatus", "sanctionHit", "createdAt", "updatedAt"
  ) VALUES (
    p_organization_id, normalized_inn, btrim(p_org_legal_name), p_org_type,
    'PENDING', p_tenant_id, 'PENDING', 'CLEAR', false, created_at, created_at
  );

  INSERT INTO public."users" (
    "id", "email", "phone", "passwordHash", "fullName", "status",
    "mfaEnabled", "mfaSecret", "mfaBackup", "deletedAt", "createdAt", "updatedAt"
  ) VALUES (
    p_user_id, normalized_email, NULLIF(btrim(COALESCE(p_phone, '')), ''),
    p_password_hash, btrim(p_full_name), 'ACTIVE', false, NULL, NULL, NULL,
    created_at, created_at
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

-- Reassert the exact runtime surface after the replacement. No runtime becomes
-- a member of the authority role and no non-auth runtime may execute the write.
DO $registration_timestamp_runtime_execute$
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
$registration_timestamp_runtime_execute$;

DO $registration_timestamp_authority_proof$
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
END;
$registration_timestamp_authority_proof$;
