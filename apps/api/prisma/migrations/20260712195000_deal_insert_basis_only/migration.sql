-- Runtime Deal creation is never a privileged free-form operation. Platform
-- staff may manage access and participants through audited control-plane flows,
-- but a Deal row itself must originate from one confirmed auction basis.

DROP POLICY IF EXISTS deals_insert ON public."deals";
CREATE POLICY deals_insert ON public."deals" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_role', true) = 'FARMER'
  AND public.app_deal_basis_deal_visible(to_jsonb("deals"))
);

COMMENT ON POLICY deals_insert ON public."deals" IS
  'Allows runtime Deal insertion only for the seller encoded in one confirmed tenant-scoped auction basis.';
