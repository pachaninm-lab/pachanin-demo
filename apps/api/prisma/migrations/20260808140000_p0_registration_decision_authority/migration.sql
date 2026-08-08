-- Bounded registration-review and decision authority under identity FORCE RLS.
--
-- Admission reviewers must inspect identities across tenants, while an
-- organization administrator may inspect only join requests for the verified
-- organization represented by the current live session. Neither case is a
-- reason to give the auth runtime BYPASSRLS or a generic cross-tenant policy.
-- A membership-free authority therefore owns a fixed review/transition tuple;
-- the callable functions re-derive every actor privilege from durable rows.

DO $registration_decision_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_registration_decision_authority'
  ) THEN
    CREATE ROLE pc_registration_decision_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_registration_decision_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_registration_decision_authority'
  ) THEN
    RAISE EXCEPTION 'pc_registration_decision_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$registration_decision_role$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_registration_decision_select ON public."users";
CREATE POLICY users_registration_decision_select ON public."users"
  FOR SELECT TO pc_registration_decision_authority USING (true);
DROP POLICY IF EXISTS users_registration_decision_update ON public."users";
CREATE POLICY users_registration_decision_update ON public."users"
  FOR UPDATE TO pc_registration_decision_authority USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_orgs_registration_decision_select ON public."user_orgs";
CREATE POLICY user_orgs_registration_decision_select ON public."user_orgs"
  FOR SELECT TO pc_registration_decision_authority USING (true);
DROP POLICY IF EXISTS user_orgs_registration_decision_update ON public."user_orgs";
CREATE POLICY user_orgs_registration_decision_update ON public."user_orgs"
  FOR UPDATE TO pc_registration_decision_authority USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS organizations_registration_decision_select ON public."organizations";
CREATE POLICY organizations_registration_decision_select ON public."organizations"
  FOR SELECT TO pc_registration_decision_authority USING (true);
DROP POLICY IF EXISTS organizations_registration_decision_update ON public."organizations";
CREATE POLICY organizations_registration_decision_update ON public."organizations"
  FOR UPDATE TO pc_registration_decision_authority USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA public, auth TO pc_registration_decision_authority;
REVOKE ALL PRIVILEGES ON public."users", public."user_orgs", public."organizations"
  FROM pc_registration_decision_authority;
GRANT SELECT ON public."users", public."user_orgs", public."organizations"
  TO pc_registration_decision_authority;
GRANT UPDATE ("status", "updatedAt") ON public."users"
  TO pc_registration_decision_authority;
GRANT UPDATE (
  "status", "role", "activated_at", "revoked_at", "is_org_admin", "version"
) ON public."user_orgs" TO pc_registration_decision_authority;
GRANT UPDATE ("status", "verifiedAt", "version", "updatedAt")
  ON public."organizations" TO pc_registration_decision_authority;
GRANT SELECT ON auth.sessions, auth.credential_states, auth.staff_assignments, auth.registration_applications
  TO pc_registration_decision_authority;

-- Actor predicates are fixed and return only authorization facts. The auth
-- runtime may call the platform predicate to fail an idempotent replay closed;
-- all wider projections and every mutation stay in the scoped functions below.
CREATE OR REPLACE FUNCTION auth.registration_platform_actor_authorized(
  p_actor_user_id text,
  p_session_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
  SELECT btrim(COALESCE(p_actor_user_id, '')) <> ''
    AND btrim(COALESCE(p_session_id, '')) <> ''
    AND EXISTS (
      SELECT 1
      FROM auth.sessions session
      JOIN auth.credential_states credential
        ON credential.user_id = session.user_id
       AND credential.credential_version = session.credential_version
      JOIN public."users" actor ON actor."id" = session.user_id
      JOIN auth.staff_assignments assignment ON assignment.user_id = actor."id"
      WHERE session.id = p_session_id
        AND session.user_id = p_actor_user_id
        AND session.status = 'ACTIVE'
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND session.mfa_verified_at IS NOT NULL
        AND session.mfa_verified_at >= now() - INTERVAL '15 minutes'
        AND session.mfa_verified_at <= now() + INTERVAL '30 seconds'
        AND actor."status" = 'ACTIVE'
        AND actor."deletedAt" IS NULL
        AND assignment.status = 'ACTIVE'
        AND assignment.revoked_at IS NULL
        AND assignment.suspended_at IS NULL
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
        AND assignment.role IN (
          'PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF'
        )
    );
$function$;

CREATE OR REPLACE FUNCTION auth.registration_role_assignment_allowed(
  p_administrator_role text,
  p_requested_role text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT CASE p_administrator_role
    WHEN 'FARMER' THEN p_requested_role IN ('FARMER', 'GUEST')
    WHEN 'BUYER' THEN p_requested_role IN ('BUYER', 'GUEST')
    WHEN 'LOGISTICIAN' THEN p_requested_role IN ('LOGISTICIAN', 'DRIVER', 'GUEST')
    WHEN 'DRIVER' THEN p_requested_role IN ('DRIVER', 'GUEST')
    WHEN 'ELEVATOR' THEN p_requested_role IN ('ELEVATOR', 'LAB', 'GUEST')
    WHEN 'LAB' THEN p_requested_role IN ('LAB', 'GUEST')
    WHEN 'SURVEYOR' THEN p_requested_role IN ('SURVEYOR', 'GUEST')
    WHEN 'ACCOUNTING' THEN p_requested_role IN ('ACCOUNTING', 'GUEST')
    WHEN 'GUEST' THEN p_requested_role = 'GUEST'
    ELSE false
  END;
$function$;

CREATE OR REPLACE FUNCTION auth.registration_organization_admin_context(
  p_actor_user_id text,
  p_session_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text
)
RETURNS TABLE (
  membership_id text,
  organization_id text,
  tenant_id text,
  administrator_role text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
  SELECT membership."id", organization."id", organization."tenantId", membership."role"
  FROM auth.sessions session
  JOIN auth.credential_states credential
    ON credential.user_id = session.user_id
   AND credential.credential_version = session.credential_version
  JOIN public."users" actor ON actor."id" = session.user_id
  JOIN public."user_orgs" membership
    ON membership."id" = session.membership_id
   AND membership."userId" = session.user_id
   AND membership."organizationId" = session.organization_id
  JOIN public."organizations" organization
    ON organization."id" = membership."organizationId"
   AND organization."tenantId" = session.tenant_id
  WHERE btrim(COALESCE(p_actor_user_id, '')) <> ''
    AND btrim(COALESCE(p_session_id, '')) <> ''
    AND btrim(COALESCE(p_membership_id, '')) <> ''
    AND btrim(COALESCE(p_organization_id, '')) <> ''
    AND btrim(COALESCE(p_tenant_id, '')) <> ''
    AND session.id = p_session_id
    AND session.user_id = p_actor_user_id
    AND session.membership_id = p_membership_id
    AND session.organization_id = p_organization_id
    AND session.tenant_id = p_tenant_id
    AND session.status = 'ACTIVE'
    AND session.revoked_at IS NULL
    AND session.expires_at > now()
    AND session.mfa_verified_at IS NOT NULL
    AND session.mfa_verified_at >= now() - INTERVAL '15 minutes'
    AND session.mfa_verified_at <= now() + INTERVAL '30 seconds'
    AND actor."status" = 'ACTIVE'
    AND actor."deletedAt" IS NULL
    AND membership."status" = 'ACTIVE'
    AND membership."is_org_admin" = true
    AND membership."role" IN (
      'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'ELEVATOR',
      'LAB', 'SURVEYOR', 'ACCOUNTING', 'GUEST'
    )
    AND organization."status" = 'VERIFIED'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION auth.registration_platform_review_queue(
  p_actor_user_id text,
  p_session_id text,
  p_limit integer
)
RETURNS TABLE (
  id text,
  kind text,
  status text,
  requested_workspace text,
  requested_role text,
  legal_name text,
  inn text,
  kpp text,
  ogrn text,
  region text,
  applicant_position text,
  email text,
  phone text,
  submitted_at timestamptz,
  updated_at timestamptz,
  version bigint,
  correlation_id text,
  organization_id text,
  organization_status text,
  organization_name text,
  organization_kyc_status text,
  organization_aml_status text,
  organization_sanction_hit boolean,
  user_id text,
  applicant_name text,
  email_verified_at timestamptz,
  duplicate_organization_count integer,
  duplicate_email_application_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Registration review limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;
  IF NOT auth.registration_platform_actor_authorized(p_actor_user_id, p_session_id) THEN
    RAISE EXCEPTION 'Active admission-review authority with recent MFA is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    application.id, application.kind, application.status,
    application.requested_workspace, application.requested_role,
    application.legal_name, application.inn, application.kpp, application.ogrn,
    application.region, application.applicant_position, application.email, application.phone,
    application.submitted_at, application.updated_at, application.version, application.correlation_id,
    organization."id", organization."status", organization."name",
    organization."kycStatus", organization."amlStatus", organization."sanctionHit",
    applicant."id", applicant."fullName", application.email_verified_at,
    (
      SELECT COUNT(*)::integer
      FROM public."organizations" duplicate_organization
      WHERE duplicate_organization."inn" = application.inn
        AND duplicate_organization."id" <> application.organization_id
    ),
    (
      SELECT COUNT(*)::integer
      FROM auth.registration_applications duplicate_application
      WHERE lower(duplicate_application.email) = lower(application.email)
        AND duplicate_application.id <> application.id
    )
  FROM auth.registration_applications application
  JOIN public."organizations" organization ON organization."id" = application.organization_id
  JOIN public."users" applicant ON applicant."id" = application.user_id
  WHERE application.kind = 'NEW_ORGANIZATION'
    AND application.status IN (
      'ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED', 'SUSPENDED'
    )
  ORDER BY application.submitted_at, application.id
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.registration_organization_join_queue(
  p_actor_user_id text,
  p_session_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_limit integer
)
RETURNS TABLE (
  id text,
  status text,
  requested_workspace text,
  requested_role text,
  applicant_position text,
  email text,
  phone text,
  submitted_at timestamptz,
  updated_at timestamptz,
  version bigint,
  correlation_id text,
  user_id text,
  applicant_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Registration join-review limit must be between 1 and 100'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.registration_organization_admin_context(
      p_actor_user_id, p_session_id, p_membership_id, p_organization_id, p_tenant_id
    )
  ) THEN
    RAISE EXCEPTION 'Verified organization administrator with recent MFA is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    application.id, application.status,
    application.requested_workspace, application.requested_role,
    application.applicant_position, application.email, application.phone,
    application.submitted_at, application.updated_at, application.version,
    application.correlation_id, applicant."id", applicant."fullName"
  FROM auth.registration_applications application
  JOIN public."users" applicant ON applicant."id" = application.user_id
  JOIN public."organizations" organization ON organization."id" = application.organization_id
  WHERE application.kind = 'JOIN_EXISTING_ORGANIZATION'
    AND application.organization_id = p_organization_id
    AND organization."tenantId" = p_tenant_id
    AND application.status IN (
      'ORGANIZATION_VERIFICATION_PENDING', 'ADDITIONAL_INFORMATION_REQUIRED'
    )
  ORDER BY application.submitted_at, application.id
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.lock_registration_decision_application(
  p_actor_kind text,
  p_actor_user_id text,
  p_session_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_application_id text
)
RETURNS TABLE (
  id text,
  kind text,
  user_id text,
  organization_id text,
  membership_id text,
  requested_workspace text,
  requested_role text,
  status text,
  version bigint,
  correlation_id text,
  organization_status text,
  tenant_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  IF btrim(COALESCE(p_application_id, '')) = '' THEN
    RAISE EXCEPTION 'Registration application identifier is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_kind = 'PLATFORM_REVIEWER' THEN
    IF NOT auth.registration_platform_actor_authorized(p_actor_user_id, p_session_id) THEN
      RAISE EXCEPTION 'Active admission-review authority with recent MFA is required'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_actor_kind = 'ORGANIZATION_ADMIN' THEN
    IF NOT EXISTS (
      SELECT 1 FROM auth.registration_organization_admin_context(
        p_actor_user_id, p_session_id, p_membership_id, p_organization_id, p_tenant_id
      )
    ) THEN
      RAISE EXCEPTION 'Verified organization administrator with recent MFA is required'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported registration decision actor'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    application.id, application.kind, application.user_id,
    application.organization_id, application.membership_id,
    application.requested_workspace, application.requested_role,
    application.status, application.version, application.correlation_id,
    organization."status", organization."tenantId"
  FROM auth.registration_applications application
  JOIN public."organizations" organization ON organization."id" = application.organization_id
  WHERE application.id = p_application_id
    AND (
      (p_actor_kind = 'PLATFORM_REVIEWER' AND application.kind = 'NEW_ORGANIZATION')
      OR (
        p_actor_kind = 'ORGANIZATION_ADMIN'
        AND application.kind = 'JOIN_EXISTING_ORGANIZATION'
        AND application.organization_id = p_organization_id
        AND organization."tenantId" = p_tenant_id
      )
    )
  FOR UPDATE OF application, organization;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.apply_registration_identity_transition(
  p_actor_kind text,
  p_actor_user_id text,
  p_session_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_application_id text,
  p_transition text
)
RETURNS TABLE (applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  application record;
  administrator_role text;
  affected integer;
  expected_status text;
  canonical_role text;
BEGIN
  IF btrim(COALESCE(p_application_id, '')) = ''
     OR p_transition IS NULL
     OR p_transition NOT IN ('APPROVE', 'REJECT', 'SUSPEND') THEN
    RAISE EXCEPTION 'Registration identity transition input is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_kind = 'PLATFORM_REVIEWER' THEN
    IF NOT auth.registration_platform_actor_authorized(p_actor_user_id, p_session_id) THEN
      RAISE EXCEPTION 'Active admission-review authority with recent MFA is required'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_actor_kind = 'ORGANIZATION_ADMIN' THEN
    SELECT context.administrator_role
    INTO administrator_role
    FROM auth.registration_organization_admin_context(
      p_actor_user_id, p_session_id, p_membership_id, p_organization_id, p_tenant_id
    ) context;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Verified organization administrator with recent MFA is required'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported registration decision actor'
      USING ERRCODE = '22023';
  END IF;

  expected_status := CASE p_transition
    WHEN 'APPROVE' THEN 'ACTIVATED'
    WHEN 'REJECT' THEN 'REJECTED'
    WHEN 'SUSPEND' THEN 'SUSPENDED'
  END;

  SELECT
    candidate.kind, candidate.user_id, candidate.organization_id,
    candidate.membership_id, candidate.requested_workspace,
    candidate.requested_role, candidate.status,
    candidate.decision_actor_user_id,
    organization."status" AS organization_status,
    organization."tenantId" AS tenant_id
  INTO application
  FROM auth.registration_applications candidate
  JOIN public."organizations" organization ON organization."id" = candidate.organization_id
  WHERE candidate.id = p_application_id
    AND candidate.status = expected_status
    AND candidate.decision_actor_user_id = p_actor_user_id
  FOR UPDATE OF candidate, organization;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;
  IF application.user_id = p_actor_user_id THEN
    RAISE EXCEPTION 'Self-approval is forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_actor_kind = 'PLATFORM_REVIEWER'
     AND application.kind <> 'NEW_ORGANIZATION' THEN
    RAISE EXCEPTION 'Organization-admin decision is required for join requests'
      USING ERRCODE = '42501';
  END IF;
  IF p_actor_kind = 'ORGANIZATION_ADMIN'
     AND (
       application.kind <> 'JOIN_EXISTING_ORGANIZATION'
       OR application.organization_id <> p_organization_id
       OR application.tenant_id <> p_tenant_id
     ) THEN
    RAISE EXCEPTION 'Registration application is outside administrator scope'
      USING ERRCODE = '42501';
  END IF;
  IF p_transition = 'SUSPEND' AND p_actor_kind <> 'PLATFORM_REVIEWER' THEN
    RAISE EXCEPTION 'Organization administrators cannot suspend registrations'
      USING ERRCODE = '42501';
  END IF;

  IF p_transition = 'APPROVE' THEN
    canonical_role := CASE application.requested_workspace
      WHEN 'seller' THEN 'FARMER'
      WHEN 'buyer' THEN 'BUYER'
      WHEN 'logistics' THEN 'LOGISTICIAN'
      WHEN 'driver' THEN 'DRIVER'
      WHEN 'elevator' THEN 'ELEVATOR'
      WHEN 'lab' THEN 'LAB'
      WHEN 'surveyor' THEN 'SURVEYOR'
      WHEN 'bank' THEN 'ACCOUNTING'
      WHEN 'employee' THEN 'GUEST'
      ELSE NULL
    END;
    IF canonical_role IS NULL OR canonical_role <> application.requested_role THEN
      RAISE EXCEPTION 'Registration workspace-role mapping is invalid'
        USING ERRCODE = '42501';
    END IF;
    IF p_actor_kind = 'ORGANIZATION_ADMIN'
       AND NOT auth.registration_role_assignment_allowed(
         administrator_role, application.requested_role
       ) THEN
      RAISE EXCEPTION 'Organization role ceiling would be exceeded'
        USING ERRCODE = '42501';
    END IF;
    IF application.kind = 'JOIN_EXISTING_ORGANIZATION'
       AND application.organization_status <> 'VERIFIED' THEN
      RAISE EXCEPTION 'Organization is not eligible for join activation'
        USING ERRCODE = '23514';
    END IF;

    IF application.kind = 'NEW_ORGANIZATION' THEN
      UPDATE public."organizations"
      SET "status" = 'VERIFIED', "verifiedAt" = now(),
          "version" = "version" + 1, "updatedAt" = now()
      WHERE "id" = application.organization_id AND "status" = 'PENDING';
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN
        RAISE EXCEPTION 'Organization activation conflict' USING ERRCODE = '40001';
      END IF;
    END IF;

    UPDATE public."users"
    SET "status" = 'ACTIVE', "updatedAt" = now()
    WHERE "id" = application.user_id
      AND "status" IN (
        'PENDING_APPROVAL',
        CASE WHEN application.kind = 'NEW_ORGANIZATION' THEN 'SUSPENDED' ELSE 'ACTIVE' END,
        'ACTIVE'
      );
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'User activation conflict' USING ERRCODE = '40001';
    END IF;

    UPDATE public."user_orgs"
    SET "status" = 'ACTIVE', "role" = application.requested_role,
        "activated_at" = now(), "revoked_at" = NULL,
        "is_org_admin" = application.kind = 'NEW_ORGANIZATION',
        "version" = "version" + 1
    WHERE "id" = application.membership_id
      AND "userId" = application.user_id
      AND "organizationId" = application.organization_id
      AND "status" IN ('PENDING', 'SUSPENDED');
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'Membership activation conflict' USING ERRCODE = '40001';
    END IF;

  ELSIF p_transition = 'REJECT' THEN
    UPDATE public."user_orgs"
    SET "status" = 'REVOKED', "revoked_at" = now(),
        "is_org_admin" = false, "version" = "version" + 1
    WHERE "id" = application.membership_id
      AND "userId" = application.user_id
      AND "organizationId" = application.organization_id
      AND "status" IN ('PENDING', 'SUSPENDED');
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'Membership rejection conflict' USING ERRCODE = '40001';
    END IF;

    IF application.kind = 'NEW_ORGANIZATION' THEN
      UPDATE public."users"
      SET "status" = 'REJECTED', "updatedAt" = now()
      WHERE "id" = application.user_id
        AND "status" IN ('PENDING_APPROVAL', 'SUSPENDED');
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN
        RAISE EXCEPTION 'User rejection conflict' USING ERRCODE = '40001';
      END IF;

      UPDATE public."organizations"
      SET "status" = 'REJECTED', "version" = "version" + 1,
          "updatedAt" = now()
      WHERE "id" = application.organization_id AND "status" = 'PENDING';
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN
        RAISE EXCEPTION 'Organization rejection conflict' USING ERRCODE = '40001';
      END IF;
    ELSE
      UPDATE public."users" subject
      SET "status" = 'REJECTED', "updatedAt" = now()
      WHERE subject."id" = application.user_id
        AND subject."status" IN ('PENDING_APPROVAL', 'SUSPENDED')
        AND NOT EXISTS (
          SELECT 1 FROM public."user_orgs" active_membership
          WHERE active_membership."userId" = subject."id"
            AND active_membership."status" = 'ACTIVE'
        );
    END IF;

  ELSE
    UPDATE public."user_orgs"
    SET "status" = 'SUSPENDED', "is_org_admin" = false,
        "version" = "version" + 1
    WHERE "id" = application.membership_id
      AND "userId" = application.user_id
      AND "organizationId" = application.organization_id
      AND "status" IN ('PENDING', 'SUSPENDED');
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'Membership suspension conflict' USING ERRCODE = '40001';
    END IF;

    UPDATE public."users"
    SET "status" = 'SUSPENDED', "updatedAt" = now()
    WHERE "id" = application.user_id
      AND "status" IN ('PENDING_APPROVAL', 'SUSPENDED');
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
      RAISE EXCEPTION 'User suspension conflict' USING ERRCODE = '40001';
    END IF;
  END IF;

  RETURN QUERY SELECT true;
END;
$function$;

ALTER FUNCTION auth.registration_platform_actor_authorized(text,text)
  OWNER TO pc_registration_decision_authority;
ALTER FUNCTION auth.registration_role_assignment_allowed(text,text)
  OWNER TO pc_registration_decision_authority;
ALTER FUNCTION auth.registration_organization_admin_context(text,text,text,text,text)
  OWNER TO pc_registration_decision_authority;
ALTER FUNCTION auth.registration_platform_review_queue(text,text,integer)
  OWNER TO pc_registration_decision_authority;
ALTER FUNCTION auth.registration_organization_join_queue(text,text,text,text,text,integer)
  OWNER TO pc_registration_decision_authority;
ALTER FUNCTION auth.lock_registration_decision_application(text,text,text,text,text,text,text)
  OWNER TO pc_registration_decision_authority;
ALTER FUNCTION auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)
  OWNER TO pc_registration_decision_authority;

REVOKE ALL ON FUNCTION auth.registration_platform_actor_authorized(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.registration_role_assignment_allowed(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.registration_organization_admin_context(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.registration_platform_review_queue(text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.registration_organization_join_queue(text,text,text,text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.lock_registration_decision_application(text,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text) FROM PUBLIC;

DO $registration_decision_runtime_grants$
DECLARE
  runtime_role text;
  function_signature text;
  exported_functions text[] := ARRAY[
    'auth.registration_platform_actor_authorized(text,text)',
    'auth.registration_organization_admin_context(text,text,text,text,text)',
    'auth.registration_platform_review_queue(text,text,integer)',
    'auth.registration_organization_join_queue(text,text,text,text,text,integer)',
    'auth.lock_registration_decision_application(text,text,text,text,text,text,text)',
    'auth.apply_registration_identity_transition(text,text,text,text,text,text,text,text)'
  ];
  internal_functions text[] := ARRAY[
    'auth.registration_role_assignment_allowed(text,text)'
  ];
BEGIN
  FOREACH function_signature IN ARRAY exported_functions LOOP
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

  FOREACH function_signature IN ARRAY internal_functions LOOP
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'pc_auth_runtime', 'pc_deal_runtime', 'pc_staff_runtime',
        'pc_storage_runtime', 'pc_outbox_runtime',
        'one_deal_auth', 'one_deal_app', 'one_deal_staff', 'one_deal_storage',
        'app_auth', 'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
      )
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', function_signature, runtime_role);
    END LOOP;
  END LOOP;
END;
$registration_decision_runtime_grants$;

DO $registration_decision_authority_proof$
BEGIN
  IF (SELECT count(*)
      FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN (
          'registration_platform_actor_authorized',
          'registration_organization_admin_context',
          'registration_platform_review_queue',
          'registration_organization_join_queue',
          'lock_registration_decision_application',
          'apply_registration_identity_transition'
        )
        AND function.prosecdef
        AND owner.rolname = 'pc_registration_decision_authority') <> 6 THEN
    RAISE EXCEPTION 'Registration decision function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_registration_decision_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_registration_decision_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_registration_decision_authority', 'public.user_orgs', 'INSERT')
     OR has_table_privilege('pc_registration_decision_authority', 'public.user_orgs', 'DELETE')
     OR has_table_privilege('pc_registration_decision_authority', 'public.organizations', 'INSERT')
     OR has_table_privilege('pc_registration_decision_authority', 'public.organizations', 'DELETE')
     OR has_table_privilege('pc_registration_decision_authority', 'auth.registration_applications', 'UPDATE') THEN
    RAISE EXCEPTION 'Registration decision authority is broader than its fixed tuple'
      USING ERRCODE = '42501';
  END IF;
END;
$registration_decision_authority_proof$;
