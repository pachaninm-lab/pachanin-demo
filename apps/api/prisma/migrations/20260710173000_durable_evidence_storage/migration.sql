-- Durable deal-scoped evidence storage boundary.
-- Metadata is stored in the canonical deal_documents table; object bytes remain in S3-compatible storage.

CREATE OR REPLACE FUNCTION public.app_rls_context_ready()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT
    NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_role', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_session_id', true), '') IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.app_rls_privileged()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT current_setting('app.current_role', true) IN (
    'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
  )
$$;

CREATE OR REPLACE FUNCTION public.app_rls_deal_visible(p_deal_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."deals" d WHERE d."id" = p_deal_id
  )
$$;

ALTER TABLE public."deal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_documents" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_documents_select ON public."deal_documents";
DROP POLICY IF EXISTS deal_documents_insert ON public."deal_documents";
DROP POLICY IF EXISTS deal_documents_update ON public."deal_documents";
DROP POLICY IF EXISTS deal_documents_delete ON public."deal_documents";

CREATE POLICY deal_documents_select ON public."deal_documents"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND public.app_rls_deal_visible("dealId")
);

CREATE POLICY deal_documents_insert ON public."deal_documents"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_deal_visible("dealId")
  AND (
    "uploadedByUserId" IS NULL
    OR "uploadedByUserId" = current_setting('app.current_user_id', true)
    OR public.app_rls_privileged()
  )
);

CREATE POLICY deal_documents_update ON public."deal_documents"
FOR UPDATE USING (
  public.app_rls_context_ready()
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) <> 'EXECUTIVE'
)
WITH CHECK (
  public.app_rls_context_ready()
  AND public.app_rls_deal_visible("dealId")
  AND current_setting('app.current_role', true) <> 'EXECUTIVE'
);

-- No DELETE policy. Legal/evidence metadata is lifecycle-managed and never physically removed by the application principal.
