-- PostgreSQL read model for the participant-scoped deal registry.
--
-- The command gateway remains unchanged. This function is a read-only,
-- SECURITY DEFINER projection that derives access exclusively from the trusted
-- session context and active DealParticipant rows. Pagination is keyset-based
-- and stable across concurrent inserts because the final tie-breaker is Deal.id.

CREATE INDEX IF NOT EXISTS deals_registry_action_deadline_money_idx
  ON public."deals" (
    "tenantId",
    (CASE WHEN "nextAction" IS NULL THEN 1 ELSE 0 END),
    "slaAt",
    "totalKopecks" DESC,
    "updatedAt" DESC,
    "id" DESC
  );

CREATE INDEX IF NOT EXISTS deals_registry_status_updated_idx
  ON public."deals" ("tenantId", "status", "updatedAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS deals_registry_region_updated_idx
  ON public."deals" ("tenantId", lower("region"), "updatedAt" DESC, "id" DESC)
  WHERE "region" IS NOT NULL;

CREATE INDEX IF NOT EXISTS deal_participants_registry_user_idx
  ON public."deal_participants" (
    "tenantId",
    "userId",
    "status",
    "dealId",
    "role",
    "organizationId"
  );

CREATE OR REPLACE FUNCTION public.app_accessible_deal_registry(
  p_limit integer,
  p_cursor_action_rank integer DEFAULT NULL,
  p_cursor_sla_at timestamptz DEFAULT NULL,
  p_cursor_money_kopecks bigint DEFAULT NULL,
  p_cursor_updated_at timestamptz DEFAULT NULL,
  p_cursor_id text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_actionable boolean DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_deadline_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id text,
  deal_number text,
  status text,
  culture text,
  crop_class text,
  region text,
  volume_tons text,
  total_kopecks bigint,
  currency text,
  version bigint,
  updated_at timestamptz,
  next_action text,
  my_role text,
  priority_reason text,
  priority_rank integer,
  deadline_at timestamptz,
  money_impact_kopecks bigint,
  cursor_action_rank integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $function$
  WITH participant_scoped AS (
    SELECT
      d."id",
      d."dealNumber" AS deal_number,
      d."status",
      d."culture",
      d."cropClass" AS crop_class,
      d."region",
      d."volumeTonsDec"::text AS volume_tons,
      d."totalKopecks" AS total_kopecks,
      d."currency",
      d."version",
      d."updatedAt" AS updated_at,
      d."nextAction" AS next_action,
      dp."role" AS my_role,
      CASE WHEN d."nextAction" IS NULL THEN 1 ELSE 0 END AS action_rank,
      CASE
        WHEN d."nextAction" IS NULL THEN 'MONITORING'
        WHEN d."slaAt" IS NOT NULL AND d."slaAt" < CURRENT_TIMESTAMP THEN 'OVERDUE'
        WHEN d."slaAt" IS NOT NULL AND d."slaAt" <= CURRENT_TIMESTAMP + interval '24 hours' THEN 'DUE_SOON'
        ELSE 'ACTION_REQUIRED'
      END AS priority_reason,
      CASE
        WHEN d."nextAction" IS NULL THEN 3
        WHEN d."slaAt" IS NOT NULL AND d."slaAt" < CURRENT_TIMESTAMP THEN 0
        WHEN d."slaAt" IS NOT NULL AND d."slaAt" <= CURRENT_TIMESTAMP + interval '24 hours' THEN 1
        ELSE 2
      END AS priority_rank,
      d."slaAt" AS deadline_at,
      d."totalKopecks" AS money_impact_kopecks,
      row_number() OVER (
        PARTITION BY d."id"
        ORDER BY
          CASE WHEN dp."role" = current_setting('app.current_role', true) THEN 0 ELSE 1 END,
          CASE dp."accessLevel" WHEN 'APPROVE' THEN 0 WHEN 'WORK' THEN 1 ELSE 2 END,
          dp."role",
          dp."organizationId",
          dp."id"
      ) AS participant_rank
    FROM public."deals" d
    JOIN public."deal_participants" dp
      ON dp."dealId" = d."id"
     AND dp."tenantId" = d."tenantId"
     AND dp."userId" = current_setting('app.current_user_id', true)
     AND dp."status" = 'ACTIVE'
     AND dp."accessLevel" IN ('READ', 'WORK', 'APPROVE')
    WHERE public.app_rls_context_ready()
      AND current_setting('app.current_role', true) <> 'BANK_CALLBACK'
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
      AND (p_status IS NULL OR d."status" = p_status)
      AND (p_role IS NULL OR dp."role" = p_role)
      AND (
        p_actionable IS NULL
        OR (p_actionable AND d."nextAction" IS NOT NULL)
        OR (NOT p_actionable AND d."nextAction" IS NULL)
      )
      AND (p_region IS NULL OR lower(d."region") = lower(p_region))
      AND (p_deadline_before IS NULL OR d."slaAt" <= p_deadline_before)
  ), ranked AS (
    SELECT *
    FROM participant_scoped
    WHERE participant_rank = 1
  )
  SELECT
    r.id,
    r.deal_number,
    r.status,
    r.culture,
    r.crop_class,
    r.region,
    r.volume_tons,
    r.total_kopecks,
    r.currency,
    r.version,
    r.updated_at,
    r.next_action,
    r.my_role,
    r.priority_reason,
    r.priority_rank,
    r.deadline_at,
    r.money_impact_kopecks,
    r.action_rank AS cursor_action_rank
  FROM ranked r
  WHERE
    p_cursor_id IS NULL
    OR r.action_rank > p_cursor_action_rank
    OR (
      r.action_rank = p_cursor_action_rank
      AND COALESCE(r.deadline_at, 'infinity'::timestamptz)
          > COALESCE(p_cursor_sla_at, 'infinity'::timestamptz)
    )
    OR (
      r.action_rank = p_cursor_action_rank
      AND COALESCE(r.deadline_at, 'infinity'::timestamptz)
          = COALESCE(p_cursor_sla_at, 'infinity'::timestamptz)
      AND COALESCE(r.money_impact_kopecks, -1) < COALESCE(p_cursor_money_kopecks, -1)
    )
    OR (
      r.action_rank = p_cursor_action_rank
      AND COALESCE(r.deadline_at, 'infinity'::timestamptz)
          = COALESCE(p_cursor_sla_at, 'infinity'::timestamptz)
      AND COALESCE(r.money_impact_kopecks, -1) = COALESCE(p_cursor_money_kopecks, -1)
      AND r.updated_at < p_cursor_updated_at
    )
    OR (
      r.action_rank = p_cursor_action_rank
      AND COALESCE(r.deadline_at, 'infinity'::timestamptz)
          = COALESCE(p_cursor_sla_at, 'infinity'::timestamptz)
      AND COALESCE(r.money_impact_kopecks, -1) = COALESCE(p_cursor_money_kopecks, -1)
      AND r.updated_at = p_cursor_updated_at
      AND r.id < p_cursor_id
    )
  ORDER BY
    r.action_rank ASC,
    r.deadline_at ASC NULLS LAST,
    r.money_impact_kopecks DESC NULLS LAST,
    r.updated_at DESC,
    r.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 101)
$function$;

REVOKE ALL ON FUNCTION public.app_accessible_deal_registry(
  integer, integer, timestamptz, bigint, timestamptz, text,
  text, text, boolean, text, timestamptz
) FROM PUBLIC;

DO $grant_deal_registry_read_model$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_accessible_deal_registry(integer, integer, timestamptz, bigint, timestamptz, text, text, text, boolean, text, timestamptz) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$grant_deal_registry_read_model$;

COMMENT ON FUNCTION public.app_accessible_deal_registry(
  integer, integer, timestamptz, bigint, timestamptz, text,
  text, text, boolean, text, timestamptz
) IS 'Participant-scoped PostgreSQL deal registry with stable keyset pagination, server filters, priority reason, deadline and money impact.';
