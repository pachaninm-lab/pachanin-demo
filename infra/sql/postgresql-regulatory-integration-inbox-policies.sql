-- PC-CROP-07A canonical RLS overlay for the durable regulatory integration inbox.
-- Apply after production-rls-policies.sql and the regulatory integration inbox migration.

ALTER TABLE public."regulatory_integration_inbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regulatory_integration_inbox_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."regulatory_integration_inbox_conflicts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regulatory_integration_inbox_conflicts" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regulatory_integration_inbox_select
  ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_select
  ON public."regulatory_integration_inbox_entries"
  FOR SELECT
  USING (
    public.app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_insert
  ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_insert
  ON public."regulatory_integration_inbox_entries"
  FOR INSERT
  WITH CHECK (
    public.app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND length(trim("provider")) > 0
    AND length(trim("externalEventId")) > 0
    AND length(trim("evidenceReference")) > 0
    AND length(trim("correlationId")) > 0
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_update
  ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_update
  ON public."regulatory_integration_inbox_entries"
  FOR UPDATE
  USING (
    public.app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND (
      public.app_rls_privileged()
      OR current_setting('app.current_role', true) IN (
        'OPERATOR', 'COMPLIANCE', 'SUPPORT_MANAGER', 'ADMIN'
      )
    )
  )
  WITH CHECK (
    public.app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND (
      public.app_rls_privileged()
      OR current_setting('app.current_role', true) IN (
        'OPERATOR', 'COMPLIANCE', 'SUPPORT_MANAGER', 'ADMIN'
      )
    )
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_delete
  ON public."regulatory_integration_inbox_entries";
CREATE POLICY regulatory_integration_inbox_delete
  ON public."regulatory_integration_inbox_entries"
  FOR DELETE
  USING (false);

DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_select
  ON public."regulatory_integration_inbox_conflicts";
CREATE POLICY regulatory_integration_inbox_conflicts_select
  ON public."regulatory_integration_inbox_conflicts"
  FOR SELECT
  USING (
    public.app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_insert
  ON public."regulatory_integration_inbox_conflicts";
CREATE POLICY regulatory_integration_inbox_conflicts_insert
  ON public."regulatory_integration_inbox_conflicts"
  FOR INSERT
  WITH CHECK (
    public.app_rls_context_ready()
    AND "tenantId" = current_setting('app.current_tenant_id', true)
    AND "organizationId" = current_setting('app.current_org_id', true)
    AND (
      public.app_rls_privileged()
      OR current_setting('app.current_role', true) IN (
        'OPERATOR', 'COMPLIANCE', 'SUPPORT_MANAGER', 'ADMIN'
      )
    )
  );

DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_update
  ON public."regulatory_integration_inbox_conflicts";
DROP POLICY IF EXISTS regulatory_integration_inbox_conflicts_delete
  ON public."regulatory_integration_inbox_conflicts";
