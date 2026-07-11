-- Resolve deal scope without granting the auth principal direct access to deals.

CREATE OR REPLACE FUNCTION auth.staff_resolve_deal_scope(
  p_actor_user_id TEXT,
  p_deal_id TEXT
)
RETURNS TABLE (
  tenant_id TEXT,
  seller_organization_id TEXT,
  buyer_organization_id TEXT
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
      AND a.status IN ('ELIGIBLE', 'ACTIVE')
      AND a.valid_from <= NOW()
      AND (a.valid_until IS NULL OR a.valid_until > NOW())
  ) THEN
    RAISE EXCEPTION 'active staff assignment is required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT d."tenantId", d."sellerOrgId", d."buyerOrgId"
  FROM public.deals d
  WHERE d.id = p_deal_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION auth.staff_resolve_deal_scope(TEXT, TEXT) FROM PUBLIC;

DO $grant_staff_deal_scope$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT EXECUTE ON FUNCTION auth.staff_resolve_deal_scope(TEXT, TEXT) TO app_service;
  END IF;
END
$grant_staff_deal_scope$;
