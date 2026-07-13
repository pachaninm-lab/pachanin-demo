-- PostgreSQL-authoritative Deal registry read model.
--
-- The registry is a read-only projection over canonical Deal and active
-- DealParticipant facts. It deliberately does not call or modify the command
-- gateway. Cursor order is deterministic and offset-free:
--   slaAt ASC NULLS LAST -> updatedAt DESC -> id ASC.
-- The function scopes exclusively from trusted PostgreSQL session settings.

CREATE INDEX IF NOT EXISTS deals_registry_deadline_updated_id_idx
  ON public."deals" ("tenantId", "slaAt" ASC, "updatedAt" DESC, "id" ASC);

CREATE INDEX IF NOT EXISTS deals_registry_status_deadline_updated_id_idx
  ON public."deals" ("tenantId", "status", "slaAt" ASC, "updatedAt" DESC, "id" ASC);

CREATE INDEX IF NOT EXISTS deals_registry_culture_deadline_updated_id_idx
  ON public."deals" ("tenantId", "culture", "slaAt" ASC, "updatedAt" DESC, "id" ASC);

CREATE INDEX IF NOT EXISTS deals_registry_region_deadline_updated_id_idx
  ON public."deals" ("tenantId", "region", "slaAt" ASC, "updatedAt" DESC, "id" ASC);

CREATE INDEX IF NOT EXISTS deal_participants_registry_user_idx
  ON public."deal_participants" ("tenantId", "userId", "status", "dealId", "role");

CREATE OR REPLACE FUNCTION public.app_deal_registry_page(
  p_limit integer,
  p_statuses text[] DEFAULT NULL,
  p_actionable boolean DEFAULT NULL,
  p_culture text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_deadline_before timestamptz DEFAULT NULL,
  p_min_money_kopecks bigint DEFAULT NULL,
  p_cursor_sla_is_null boolean DEFAULT NULL,
  p_cursor_sla_at timestamptz DEFAULT NULL,
  p_cursor_updated_at timestamptz DEFAULT NULL,
  p_cursor_id text DEFAULT NULL
)
RETURNS TABLE (
  deal_id text,
  deal_number text,
  deal_status text,
  culture text,
  crop_class text,
  region text,
  volume_tons double precision,
  total_kopecks bigint,
  currency text,
  deal_version bigint,
  updated_at timestamptz,
  next_action text,
  sla_at timestamptz,
  my_role text,
  my_access_level text,
  priority_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $function$
DECLARE
  v_user_id text := NULLIF(current_setting('app.current_user_id', true), '');
  v_tenant_id text := NULLIF(current_setting('app.current_tenant_id', true), '');
  v_current_org_id text := NULLIF(current_setting('app.current_org_id', true), '');
  v_current_role text := NULLIF(current_setting('app.current_role', true), '');
BEGIN
  IF NOT public.app_rls_context_ready()
     OR v_user_id IS NULL
     OR v_tenant_id IS NULL
  THEN
    RAISE EXCEPTION 'trusted Deal registry context is incomplete' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 101 THEN
    RAISE EXCEPTION 'Deal registry page limit must be between 1 and 101' USING ERRCODE = '22023';
  END IF;

  IF p_cursor_id IS NOT NULL AND (
    p_cursor_sla_is_null IS NULL
    OR p_cursor_updated_at IS NULL
    OR (p_cursor_sla_is_null = false AND p_cursor_sla_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'Deal registry cursor is incomplete' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    d."id",
    d."dealNumber",
    d."status",
    d."culture",
    d."cropClass",
    d."region",
    d."volumeTons",
    d."totalKopecks",
    d."currency",
    d."version",
    d."updatedAt",
    d."nextAction",
    d."slaAt",
    participant.role,
    participant.access_level,
    CASE
      WHEN d."status" LIKE 'DISPUTE%' THEN 'DISPUTE_CONTROL'
      WHEN d."status" IN (
        'CONTRACT_SIGNED', 'RESERVE_REQUESTED', 'RESERVED',
        'DOCUMENTS_COMPLETE', 'RELEASE_REQUESTED', 'RELEASED'
      ) THEN 'MONEY_CONTROL'
      WHEN d."nextAction" IS NOT NULL
        AND d."slaAt" IS NOT NULL
        AND d."slaAt" < statement_timestamp() THEN 'OVERDUE_ACTION'
      WHEN d."nextAction" IS NOT NULL AND d."slaAt" IS NOT NULL THEN 'DEADLINE_ACTION'
      WHEN d."nextAction" IS NOT NULL THEN 'ACTION_REQUIRED'
      ELSE 'RECENT_ACTIVITY'
    END
  FROM public."deals" d
  JOIN LATERAL (
    SELECT
      dp."role" AS role,
      dp."accessLevel" AS access_level
    FROM public."deal_participants" dp
    JOIN public."user_orgs" uo
      ON uo."userId" = dp."userId"
     AND uo."organizationId" = dp."organizationId"
     AND uo."role" = dp."role"
    WHERE dp."dealId" = d."id"
      AND dp."tenantId" = v_tenant_id
      AND dp."userId" = v_user_id
      AND dp."status" = 'ACTIVE'
      AND dp."accessLevel" IN ('READ', 'WORK', 'APPROVE')
      AND (p_role IS NULL OR dp."role" = p_role)
    ORDER BY
      CASE
        WHEN dp."organizationId" = v_current_org_id AND dp."role" = v_current_role THEN 0
        ELSE 1
      END,
      CASE dp."accessLevel"
        WHEN 'APPROVE' THEN 0
        WHEN 'WORK' THEN 1
        WHEN 'READ' THEN 2
        ELSE 3
      END,
      dp."assignedAt" ASC,
      dp."role" ASC,
      dp."id" ASC
    LIMIT 1
  ) participant ON true
  WHERE d."tenantId" = v_tenant_id
    AND (p_statuses IS NULL OR d."status" = ANY(p_statuses))
    AND (p_actionable IS NULL OR (d."nextAction" IS NOT NULL) = p_actionable)
    AND (p_culture IS NULL OR d."culture" = p_culture)
    AND (p_region IS NULL OR d."region" = p_region)
    AND (p_deadline_before IS NULL OR (d."slaAt" IS NOT NULL AND d."slaAt" <= p_deadline_before))
    AND (p_min_money_kopecks IS NULL OR d."totalKopecks" >= p_min_money_kopecks)
    AND (
      p_cursor_id IS NULL
      OR (
        p_cursor_sla_is_null = false
        AND (
          d."slaAt" IS NULL
          OR d."slaAt" > p_cursor_sla_at
          OR (
            d."slaAt" = p_cursor_sla_at
            AND (
              d."updatedAt" < p_cursor_updated_at
              OR (d."updatedAt" = p_cursor_updated_at AND d."id" > p_cursor_id)
            )
          )
        )
      )
      OR (
        p_cursor_sla_is_null = true
        AND d."slaAt" IS NULL
        AND (
          d."updatedAt" < p_cursor_updated_at
          OR (d."updatedAt" = p_cursor_updated_at AND d."id" > p_cursor_id)
        )
      )
    )
  ORDER BY d."slaAt" ASC NULLS LAST, d."updatedAt" DESC, d."id" ASC
  LIMIT p_limit;
END
$function$;

REVOKE ALL ON FUNCTION public.app_deal_registry_page(
  integer, text[], boolean, text, text, text, timestamptz, bigint,
  boolean, timestamptz, timestamptz, text
) FROM PUBLIC;

DO $grant_deal_registry_read_model$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_deal_registry_page(integer, text[], boolean, text, text, text, timestamptz, bigint, boolean, timestamptz, timestamptz, text) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$grant_deal_registry_read_model$;

COMMENT ON FUNCTION public.app_deal_registry_page(
  integer, text[], boolean, text, text, text, timestamptz, bigint,
  boolean, timestamptz, timestamptz, text
) IS
  'Returns one stable keyset page of canonical Deals visible through active user membership and DealParticipant authority.';
