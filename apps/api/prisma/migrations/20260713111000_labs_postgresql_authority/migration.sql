-- IR-10.3 hardening: explicit transport state, deterministic active assignment
-- and safe assignment visibility for every participant who can register custody.

ALTER TABLE public."lab_samples"
  DROP CONSTRAINT IF EXISTS "lab_samples_status_check";
ALTER TABLE public."lab_samples"
  ADD CONSTRAINT "lab_samples_status_check" CHECK (
    "status" IN (
      'PENDING', 'COLLECTED', 'IN_TRANSIT', 'RECEIVED',
      'ANALYSIS_IN_PROGRESS', 'READY_FOR_FINALIZATION', 'FINALIZED'
    )
  );

DO $active_assignment_guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."lab_assignments"
    WHERE "status" = 'ACTIVE'
      AND ("validUntil" IS NULL OR "validUntil" > CURRENT_TIMESTAMP)
    GROUP BY "tenantId", "dealId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'multiple active laboratory assignments exist for one deal; resolve authority before IR-10.3';
  END IF;
END
$active_assignment_guard$;

CREATE UNIQUE INDEX IF NOT EXISTS "lab_assignments_one_active_deal_key"
  ON public."lab_assignments" ("tenantId", "dealId")
  WHERE "status" = 'ACTIVE' AND "validUntil" IS NULL;

CREATE OR REPLACE FUNCTION public.app_labs_assignment_valid(
  p_tenant_id TEXT,
  p_deal_id TEXT,
  p_lab_org_id TEXT,
  p_lab_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."lab_assignments" assignment
    WHERE assignment."tenantId" = p_tenant_id
      AND assignment."dealId" = p_deal_id
      AND assignment."labOrgId" = p_lab_org_id
      AND assignment."labUserId" = p_lab_user_id
      AND assignment."status" = 'ACTIVE'
      AND assignment."validFrom" <= CURRENT_TIMESTAMP
      AND (assignment."validUntil" IS NULL OR assignment."validUntil" > CURRENT_TIMESTAMP)
  );
$function$;

DROP POLICY IF EXISTS lab_assignments_select ON public."lab_assignments";
CREATE POLICY lab_assignments_select ON public."lab_assignments" FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
);
