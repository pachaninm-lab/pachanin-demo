-- Narrow deal_documents updates after enabling FORCE RLS.
-- Evidence files may be changed only by their uploader or a privileged control role.
-- Workflow documents remain writable only by roles that actually execute document transitions.

DROP POLICY IF EXISTS deal_documents_update ON public."deal_documents";

CREATE POLICY deal_documents_update ON public."deal_documents"
FOR UPDATE USING (
  public.app_rls_context_ready()
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
        'ADMIN',
        'COMPLIANCE_OFFICER',
        'SUPPORT_MANAGER',
        'FARMER',
        'BUYER',
        'SURVEYOR'
      )
    )
  )
)
WITH CHECK (
  public.app_rls_context_ready()
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
        'ADMIN',
        'COMPLIANCE_OFFICER',
        'SUPPORT_MANAGER',
        'FARMER',
        'BUYER',
        'SURVEYOR'
      )
    )
  )
);
