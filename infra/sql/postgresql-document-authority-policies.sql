-- IR-10.1 production overlay for deal_documents.
-- This file intentionally contains the policy portion of
-- 20260713090000_documents_postgresql_authority for drift-controlled rollout.
-- Apply only after the matching forward migration added the referenced columns.

ALTER TABLE public."deal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_documents" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_documents_select ON public."deal_documents";
DROP POLICY IF EXISTS deal_documents_insert ON public."deal_documents";
DROP POLICY IF EXISTS deal_documents_update ON public."deal_documents";
DROP POLICY IF EXISTS deal_documents_delete ON public."deal_documents";

CREATE POLICY deal_documents_select ON public."deal_documents"
FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
);

CREATE POLICY deal_documents_insert ON public."deal_documents"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND (
    (
      "type" = 'EVIDENCE_FILE'
      AND (
        "uploadedByUserId" = current_setting('app.current_user_id', true)
        OR public.app_rls_privileged()
      )
    )
    OR (
      "type" <> 'EVIDENCE_FILE'
      AND "uploadedByUserId" = current_setting('app.current_user_id', true)
      AND "createdByOrgId" = current_setting('app.current_org_id', true)
      AND current_setting('app.current_role', true) IN (
        'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER',
        'FARMER', 'BUYER', 'LOGISTICIAN', 'SURVEYOR',
        'LAB', 'ELEVATOR', 'ACCOUNTING'
      )
      AND "idempotencyKey" IS NOT NULL
      AND "isImmutable"
      AND "status" IN (
        'PENDING_REVIEW',
        'SIGNATURE_PENDING_VERIFICATION',
        'PACKAGE_MANIFEST_CREATED'
      )
    )
  )
);

CREATE POLICY deal_documents_update ON public."deal_documents"
FOR UPDATE USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND (
    (
      "type" = 'EVIDENCE_FILE'
      AND (
        "uploadedByUserId" = current_setting('app.current_user_id', true)
        OR public.app_rls_privileged()
      )
    )
    OR (
      "type" <> 'EVIDENCE_FILE'
      AND NOT "isImmutable"
      AND current_setting('app.current_role', true) IN (
        'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER',
        'FARMER', 'BUYER', 'SURVEYOR'
      )
    )
  )
)
WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_rls_deal_visible("dealId")
  AND (
    (
      "type" = 'EVIDENCE_FILE'
      AND (
        "uploadedByUserId" = current_setting('app.current_user_id', true)
        OR public.app_rls_privileged()
      )
    )
    OR (
      "type" <> 'EVIDENCE_FILE'
      AND current_setting('app.current_role', true) IN (
        'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER',
        'FARMER', 'BUYER', 'SURVEYOR'
      )
    )
  )
);

-- No DELETE policy. Immutable versions are corrected by append-only creation.
