-- Every internal staff assignment requires MFA.
-- Setting mfa_enabled without a secret intentionally drives the existing login
-- flow into TOTP enrollment before any staff authority can be exercised.

CREATE OR REPLACE FUNCTION auth.require_mfa_for_staff_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO auth.credential_states (user_id, mfa_enabled, updated_at)
  VALUES (NEW.user_id, TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET mfa_enabled = TRUE,
      updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_require_mfa_on_staff_assignment
AFTER INSERT OR UPDATE OF user_id, role, status ON auth.staff_assignments
FOR EACH ROW
WHEN (NEW.status IN ('ELIGIBLE', 'ACTIVE'))
EXECUTE FUNCTION auth.require_mfa_for_staff_assignment();

-- Controlled cross-tenant read projections for the staff control plane.
-- The auth principal receives EXECUTE only; it never receives direct SELECT on deals.

CREATE OR REPLACE FUNCTION auth.staff_organization_directory(p_actor_user_id TEXT)
RETURNS TABLE (
  id TEXT,
  tenant_id TEXT,
  name TEXT,
  inn TEXT,
  status TEXT,
  kyc_status TEXT,
  aml_status TEXT,
  updated_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.staff_assignments a
    WHERE a.user_id = p_actor_user_id
      AND a.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
      AND a.status IN ('ELIGIBLE', 'ACTIVE')
      AND a.valid_from <= NOW()
      AND (a.valid_until IS NULL OR a.valid_until > NOW())
  ) THEN
    RAISE EXCEPTION 'staff organization directory access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o."tenantId",
    o.name,
    o.inn,
    o.status::TEXT,
    o."kycStatus"::TEXT,
    o."amlStatus"::TEXT,
    o."updatedAt"
  FROM public.organizations o
  ORDER BY o.status, o.name, o.id
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION auth.staff_organization_users(
  p_actor_user_id TEXT,
  p_organization_id TEXT
)
RETURNS TABLE (
  membership_id TEXT,
  user_id TEXT,
  email TEXT,
  full_name TEXT,
  user_status TEXT,
  mfa_enabled BOOLEAN,
  role TEXT,
  is_default BOOLEAN,
  joined_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.staff_assignments a
    WHERE a.user_id = p_actor_user_id
      AND a.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
      AND a.status IN ('ELIGIBLE', 'ACTIVE')
      AND a.valid_from <= NOW()
      AND (a.valid_until IS NULL OR a.valid_until > NOW())
  ) THEN
    RAISE EXCEPTION 'staff organization user directory access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    u.id,
    u.email,
    u."fullName",
    u.status::TEXT,
    COALESCE(c.mfa_enabled, u."mfaEnabled"),
    m.role::TEXT,
    m."isDefault",
    m."joinedAt"
  FROM public.user_orgs m
  JOIN public.users u ON u.id = m."userId"
  LEFT JOIN auth.credential_states c ON c.user_id = u.id
  WHERE m."organizationId" = p_organization_id
  ORDER BY m."joinedAt", m.id
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION auth.staff_cabinet_deals(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_organization_id TEXT,
  p_role TEXT
)
RETURNS TABLE (
  id TEXT,
  deal_number TEXT,
  status TEXT,
  next_action TEXT,
  sla_at TIMESTAMP(3) WITHOUT TIME ZONE,
  updated_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  SELECT o."tenantId"
  INTO v_tenant_id
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'target organization not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.staff_access_sessions s
    JOIN auth.staff_access_grants g ON g.id = s.grant_id
    JOIN auth.staff_assignments a ON a.id = g.assignment_id
    WHERE s.id = p_access_session_id
      AND s.actor_user_id = p_actor_user_id
      AND s.status = 'ACTIVE'
      AND s.expires_at > NOW()
      AND s.access_mode = 'VIEW_AS'
      AND s.effective_organization_id = p_organization_id
      AND s.effective_tenant_id = v_tenant_id
      AND (s.effective_role IS NULL OR s.effective_role = p_role)
      AND s.permissions ? 'cabinet:view-as'
      AND g.status = 'ACTIVE'
      AND g.expires_at > NOW()
      AND a.status IN ('ELIGIBLE', 'ACTIVE')
      AND a.valid_from <= NOW()
      AND (a.valid_until IS NULL OR a.valid_until > NOW())
  ) THEN
    RAISE EXCEPTION 'staff cabinet projection access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d."dealNumber",
    d.status,
    d."nextAction",
    d."slaAt",
    d."updatedAt"
  FROM public.deals d
  WHERE d."sellerOrgId" = p_organization_id
     OR d."buyerOrgId" = p_organization_id
  ORDER BY d."updatedAt" DESC, d.id DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION auth.require_mfa_for_staff_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

DO $grant_staff_projections$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(TEXT) TO app_service;
    GRANT EXECUTE ON FUNCTION auth.staff_organization_users(TEXT, TEXT) TO app_service;
    GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT) TO app_service;
  END IF;
END
$grant_staff_projections$;
