-- Resolve only the target identifiers required to create a staff access request
-- without granting the authentication runtime direct cross-tenant visibility into
-- public.organizations, public.users or public.user_orgs.
--
-- The result is deliberately status-only: tenant id, organization id and user id
-- for one exact requested tuple. No directory, names, contacts or arbitrary rows
-- are exposed. The active durable staff assignment is part of the database check.
-- Production execution belongs exclusively to pc_staff_runtime; pc_auth_runtime
-- and the tenant/deal/storage runtimes are explicitly denied this surface.

GRANT SELECT ON auth.staff_assignments TO pc_identity_bootstrap;

CREATE OR REPLACE FUNCTION auth.resolve_staff_target_scope(
  p_actor_user_id text,
  p_assignment_id text,
  p_target_tenant_id text,
  p_target_organization_id text,
  p_target_user_id text
)
RETURNS TABLE (
  tenant_id text,
  organization_id text,
  user_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $function$
DECLARE
  resolved_tenant_id text;
BEGIN
  IF NULLIF(BTRIM(p_actor_user_id), '') IS NULL
     OR NULLIF(BTRIM(p_assignment_id), '') IS NULL
  THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.id = p_assignment_id
      AND assignment.user_id = p_actor_user_id
      AND assignment.role IN (
        'PLATFORM_OWNER', 'PLATFORM_ADMIN',
        'SUPPORT_L1', 'SUPPORT_L2',
        'OPERATIONS_AGENT', 'OPERATIONS_SUPERVISOR',
        'FINANCE_OPS', 'COMPLIANCE_STAFF', 'DEVELOPER',
        'SRE_ONCALL', 'SECURITY_AUDITOR', 'BREAK_GLASS_ADMIN'
      )
      AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  ) THEN
    RETURN;
  END IF;

  IF NULLIF(BTRIM(p_target_user_id), '') IS NOT NULL
     AND NULLIF(BTRIM(p_target_organization_id), '') IS NULL
  THEN
    RETURN;
  END IF;

  IF NULLIF(BTRIM(p_target_organization_id), '') IS NOT NULL THEN
    SELECT organization."tenantId"
    INTO resolved_tenant_id
    FROM public.organizations organization
    WHERE organization.id = p_target_organization_id
      AND organization.status IN ('ACTIVE', 'VERIFIED')
    LIMIT 1;

    IF resolved_tenant_id IS NULL THEN
      RETURN;
    END IF;

    IF NULLIF(BTRIM(p_target_tenant_id), '') IS NOT NULL
       AND p_target_tenant_id IS DISTINCT FROM resolved_tenant_id
    THEN
      RETURN;
    END IF;

    IF NULLIF(BTRIM(p_target_user_id), '') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.user_orgs membership
         JOIN public.users target_user ON target_user.id = membership."userId"
         WHERE membership."organizationId" = p_target_organization_id
           AND membership."userId" = p_target_user_id
           AND target_user.status = 'ACTIVE'
           AND target_user."deletedAt" IS NULL
       )
    THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT resolved_tenant_id, p_target_organization_id, NULLIF(BTRIM(p_target_user_id), '');
    RETURN;
  END IF;

  IF NULLIF(BTRIM(p_target_tenant_id), '') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.organizations organization
      WHERE organization."tenantId" = p_target_tenant_id
        AND organization.status IN ('ACTIVE', 'VERIFIED')
    ) THEN
      RETURN;
    END IF;

    RETURN QUERY SELECT p_target_tenant_id, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::text, NULL::text, NULL::text;
END;
$function$;

ALTER FUNCTION auth.resolve_staff_target_scope(text, text, text, text, text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_staff_target_scope(text, text, text, text, text)
  FROM PUBLIC;

DO $bounded_staff_target_scope_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_runtime'
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_staff_target_scope(text,text,text,text,text) TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_app', 'one_deal_storage',
      'app_auth', 'app_service', 'app_deal', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_staff_target_scope(text,text,text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$bounded_staff_target_scope_grants$;
