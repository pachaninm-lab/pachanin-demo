-- Pre-session Deal target resolution for staff access requests (#3670).
--
-- A staff actor may request a time-bounded grant scoped to a Deal before a
-- staff access session exists, so there is no capability token to prove yet.
-- The previous auth.staff_resolve_deal_scope(actor, deal) ran through app_auth
-- and treated an actor identifier as sufficient cross-tenant authority.
--
-- The replacement is reachable only through the separate function-only staff
-- runtime and binds the lookup to the authenticated actor's exact active staff
-- assignment. It returns only the Deal's tenant/seller/buyer scope.

DO $staff_deal_target_prerequisites$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime')
  THEN
    RAISE EXCEPTION 'bounded staff authority roles are required' USING ERRCODE = '42704';
  END IF;
END;
$staff_deal_target_prerequisites$;

-- Extend the projection policy with one exact-deal marker. The policy still
-- applies only TO pc_staff_authority, which is NOLOGIN and has no members.
DROP POLICY IF EXISTS deals_staff_projection ON public.deals;
CREATE POLICY deals_staff_projection
ON public.deals
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_projection_scope', true) = 'org:' || "sellerOrgId"
  OR current_setting('app.staff_projection_scope', true) = 'org:' || "buyerOrgId"
  OR current_setting('app.staff_projection_scope', true) = 'deal:' || id
);

CREATE OR REPLACE FUNCTION auth.resolve_staff_deal_target_scope(
  p_actor_user_id TEXT,
  p_assignment_id TEXT,
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
AS $function$
BEGIN
  IF NULLIF(BTRIM(p_actor_user_id), '') IS NULL
     OR NULLIF(BTRIM(p_assignment_id), '') IS NULL
     OR NULLIF(BTRIM(p_deal_id), '') IS NULL
  THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.id = p_assignment_id
      AND assignment.user_id = p_actor_user_id
      AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  ) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.staff_projection_scope', 'deal:' || p_deal_id, true);
  RETURN QUERY
  SELECT deal."tenantId", deal."sellerOrgId", deal."buyerOrgId"
  FROM public.deals deal
  WHERE deal.id = p_deal_id
  LIMIT 1;
  PERFORM set_config('app.staff_projection_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT) FROM PUBLIC;

-- Retire the legacy identifier-only entry point from the final catalog.
DROP FUNCTION IF EXISTS auth.staff_resolve_deal_scope(TEXT, TEXT);

GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT)
  TO pc_staff_runtime;

DO $deny_staff_deal_target_to_other_runtimes$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'app_auth', 'app_service', 'app_runtime', 'app_storage', 'app_outbox',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$deny_staff_deal_target_to_other_runtimes$;
