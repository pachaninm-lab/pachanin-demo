-- Canonical RLS overlay for IR-10.3 Labs PostgreSQL Authority.
-- Apply after production-rls-policies.sql and the labs authority migration.

ALTER TABLE public."lab_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_samples" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_custody_events FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.protocols FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_samples_select ON public."lab_samples";
CREATE POLICY lab_samples_select ON public."lab_samples" FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", false)
);

DROP POLICY IF EXISTS lab_samples_insert ON public."lab_samples";
CREATE POLICY lab_samples_insert ON public."lab_samples" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "assignedActorUserId" = current_setting('app.current_user_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", true)
);

DROP POLICY IF EXISTS lab_samples_update ON public."lab_samples";
CREATE POLICY lab_samples_update ON public."lab_samples" FOR UPDATE USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", true)
) WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_labs_deal_authorized("dealId", "labId", true)
);

DROP POLICY IF EXISTS lab_samples_delete ON public."lab_samples";
CREATE POLICY lab_samples_delete ON public."lab_samples" FOR DELETE USING (false);

DROP POLICY IF EXISTS lab_tests_select ON public."lab_tests";
CREATE POLICY lab_tests_select ON public."lab_tests" FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = "lab_tests"."sampleId"
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", false)
  )
);

DROP POLICY IF EXISTS lab_tests_insert ON public."lab_tests";
CREATE POLICY lab_tests_insert ON public."lab_tests" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND EXISTS (
    SELECT 1 FROM public."lab_samples" sample
    WHERE sample."id" = "lab_tests"."sampleId"
      AND public.app_labs_deal_authorized(sample."dealId", sample."labId", true)
  )
);

DROP POLICY IF EXISTS lab_tests_update ON public."lab_tests";
DROP POLICY IF EXISTS lab_tests_delete ON public."lab_tests";
