-- Canonical RLS overlay for IR-10.3 Labs PostgreSQL Authority.
-- Apply after production-rls-policies.sql and the labs authority migration.

ALTER TABLE public."lab_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_samples" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_custody_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_custody_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_accreditations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_accreditations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_methods" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_equipment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_samples_select ON public."lab_samples";
CREATE POLICY lab_samples_select ON public."lab_samples" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
);
DROP POLICY IF EXISTS lab_samples_insert ON public."lab_samples";
CREATE POLICY lab_samples_insert ON public."lab_samples" FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) IN ('ELEVATOR','SURVEYOR','LAB','SUPPORT_MANAGER','ADMIN')
  AND public.app_labs_assignment_valid("tenantId", "dealId", "labId", "assignedLabUserId")
);
DROP POLICY IF EXISTS lab_samples_update ON public."lab_samples";
CREATE POLICY lab_samples_update ON public."lab_samples" FOR UPDATE USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND (
    "assignedLabUserId" = current_setting('app.current_user_id', true)
    OR "currentCustodianUserId" = current_setting('app.current_user_id', true)
    OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN')
  )
) WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
);
DROP POLICY IF EXISTS lab_samples_delete ON public."lab_samples";
CREATE POLICY lab_samples_delete ON public."lab_samples" FOR DELETE USING (false);

DROP POLICY IF EXISTS lab_tests_select ON public."lab_tests";
CREATE POLICY lab_tests_select ON public."lab_tests" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (SELECT 1 FROM public."lab_samples" sample WHERE sample."id" = "lab_tests"."sampleId" AND public.app_rls_deal_visible(sample."dealId"))
);
DROP POLICY IF EXISTS lab_tests_insert ON public."lab_tests";
CREATE POLICY lab_tests_insert ON public."lab_tests" FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = "lab_tests"."sampleId"
      AND sample."assignedLabUserId" = current_setting('app.current_user_id', true)
      AND public.app_rls_deal_visible(sample."dealId")
  )
);
DROP POLICY IF EXISTS lab_tests_update ON public."lab_tests";
DROP POLICY IF EXISTS lab_tests_delete ON public."lab_tests";

DROP POLICY IF EXISTS lab_custody_events_select ON public."lab_custody_events";
CREATE POLICY lab_custody_events_select ON public."lab_custody_events" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (SELECT 1 FROM public."lab_samples" sample WHERE sample."id" = "lab_custody_events"."sampleId" AND public.app_rls_deal_visible(sample."dealId"))
);
DROP POLICY IF EXISTS lab_custody_events_insert ON public."lab_custody_events";
CREATE POLICY lab_custody_events_insert ON public."lab_custody_events" FOR INSERT WITH CHECK (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (SELECT 1 FROM public."lab_samples" sample WHERE sample."id" = "lab_custody_events"."sampleId" AND public.app_rls_deal_visible(sample."dealId"))
  AND ("fromUserId" = current_setting('app.current_user_id', true) OR "toUserId" = current_setting('app.current_user_id', true) OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN'))
);
DROP POLICY IF EXISTS lab_custody_events_update ON public."lab_custody_events";
DROP POLICY IF EXISTS lab_custody_events_delete ON public."lab_custody_events";

DROP POLICY IF EXISTS lab_assignments_select ON public."lab_assignments";
CREATE POLICY lab_assignments_select ON public."lab_assignments" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labUserId" = current_setting('app.current_user_id', true))
);
DROP POLICY IF EXISTS lab_accreditations_select ON public."lab_accreditations";
CREATE POLICY lab_accreditations_select ON public."lab_accreditations" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labOrgId" = current_setting('app.current_org_id', true))
);
DROP POLICY IF EXISTS lab_methods_select ON public."lab_methods";
CREATE POLICY lab_methods_select ON public."lab_methods" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labOrgId" = current_setting('app.current_org_id', true))
);
DROP POLICY IF EXISTS lab_equipment_select ON public."lab_equipment";
CREATE POLICY lab_equipment_select ON public."lab_equipment" FOR SELECT USING (
  public.app_rls_context_ready() AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (current_setting('app.current_role', true) IN ('SUPPORT_MANAGER','ADMIN') OR "labOrgId" = current_setting('app.current_org_id', true))
);

