-- Canonical RLS overlay for IR-10.3 Labs PostgreSQL Authority.
-- Apply after production-rls-policies.sql and the labs authority migration.

ALTER TABLE public."lab_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_samples" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_tests" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_samples_select ON public."lab_samples";
CREATE POLICY lab_samples_select ON public."lab_samples"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible("id")
);

DROP POLICY IF EXISTS lab_samples_insert ON public."lab_samples";
CREATE POLICY lab_samples_insert ON public."lab_samples"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  AND (
    "labId" = current_setting('app.current_org_id', true)
    OR current_setting('app.current_role', true) IN ('SUPPORT_MANAGER', 'ADMIN')
  )
);

DROP POLICY IF EXISTS lab_samples_update ON public."lab_samples";
CREATE POLICY lab_samples_update ON public."lab_samples"
FOR UPDATE USING (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible("id")
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
) WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible("id")
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
);

DROP POLICY IF EXISTS lab_samples_delete ON public."lab_samples";
CREATE POLICY lab_samples_delete ON public."lab_samples" FOR DELETE USING (false);

DROP POLICY IF EXISTS lab_tests_select ON public."lab_tests";
CREATE POLICY lab_tests_select ON public."lab_tests"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible("sampleId")
);

DROP POLICY IF EXISTS lab_tests_insert ON public."lab_tests";
CREATE POLICY lab_tests_insert ON public."lab_tests"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_lab_sample_visible("sampleId")
  AND current_setting('app.current_role', true) IN ('LAB', 'SUPPORT_MANAGER', 'ADMIN')
);
DROP POLICY IF EXISTS lab_tests_update ON public."lab_tests";
DROP POLICY IF EXISTS lab_tests_delete ON public."lab_tests";

ALTER TABLE labs.laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.laboratories FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.accreditations ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.accreditations FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.personnel FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.methods FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.sample_authorities FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.custody_events FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.test_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.test_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE labs.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs.protocols FORCE ROW LEVEL SECURITY;

-- All mutation policies are created by the forward migration. This overlay is
-- intentionally limited to reasserting the public read/write boundary after the
-- general production RLS overlay is applied.
