-- IR-10.1: PostgreSQL-authoritative document metadata and immutable versions.
-- Object bytes remain owned by the S3-compatible storage boundary. A workflow
-- document may only reference a verified EVIDENCE_FILE row.

ALTER TABLE public."deal_documents"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureFileId" TEXT,
  ADD COLUMN IF NOT EXISTS "supersedesId" TEXT,
  ADD COLUMN IF NOT EXISTS "seriesId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByOrgId" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Existing rows whose deals pre-date tenant assignment are quarantined under a
-- deal-specific value. They cannot become visible to an authenticated tenant.
UPDATE public."deal_documents" AS document
SET "tenantId" = COALESCE(
  deal."tenantId",
  'legacy-quarantine-' || left(md5(document."dealId"), 16)
)
FROM public."deals" AS deal
WHERE deal."id" = document."dealId"
  AND document."tenantId" IS NULL;

DO $tenant_backfill$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."deal_documents" WHERE "tenantId" IS NULL
  ) THEN
    RAISE EXCEPTION 'deal_documents tenant backfill is incomplete';
  END IF;
END
$tenant_backfill$;

ALTER TABLE public."deal_documents"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "deal_documents_idempotencyKey_key"
  ON public."deal_documents" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "deal_documents_tenantId_idx"
  ON public."deal_documents" ("tenantId");
CREATE INDEX IF NOT EXISTS "deal_documents_sourceFileId_idx"
  ON public."deal_documents" ("sourceFileId");
CREATE INDEX IF NOT EXISTS "deal_documents_signatureFileId_idx"
  ON public."deal_documents" ("signatureFileId");
CREATE INDEX IF NOT EXISTS "deal_documents_supersedesId_idx"
  ON public."deal_documents" ("supersedesId");
CREATE UNIQUE INDEX IF NOT EXISTS "deal_documents_seriesId_version_key"
  ON public."deal_documents" ("seriesId", "version");

ALTER TABLE public."deal_documents"
  ADD CONSTRAINT "deal_documents_sourceFileId_fkey"
  FOREIGN KEY ("sourceFileId") REFERENCES public."deal_documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."deal_documents"
  ADD CONSTRAINT "deal_documents_signatureFileId_fkey"
  FOREIGN KEY ("signatureFileId") REFERENCES public."deal_documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."deal_documents"
  ADD CONSTRAINT "deal_documents_supersedesId_fkey"
  FOREIGN KEY ("supersedesId") REFERENCES public."deal_documents"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.app_document_derive_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  deal_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO deal_tenant
  FROM public."deals"
  WHERE "id" = NEW."dealId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'document deal does not exist' USING ERRCODE = '23503';
  END IF;

  IF deal_tenant IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'document deal has no tenant authority' USING ERRCODE = '23514';
    END IF;
    IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
      RAISE EXCEPTION 'quarantined document tenant is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  NEW."tenantId" := deal_tenant;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS deal_documents_derive_tenant ON public."deal_documents";
CREATE TRIGGER deal_documents_derive_tenant
BEFORE INSERT OR UPDATE OF "dealId", "tenantId" ON public."deal_documents"
FOR EACH ROW EXECUTE FUNCTION public.app_document_derive_tenant();

CREATE OR REPLACE FUNCTION public.app_document_immutable_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD."type" <> 'EVIDENCE_FILE' AND OLD."isImmutable" THEN
    RAISE EXCEPTION 'confirmed document versions are append-only' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS deal_documents_immutable_version ON public."deal_documents";
CREATE TRIGGER deal_documents_immutable_version
BEFORE UPDATE OR DELETE ON public."deal_documents"
FOR EACH ROW EXECUTE FUNCTION public.app_document_immutable_version();

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
        'ADMIN',
        'COMPLIANCE_OFFICER',
        'SUPPORT_MANAGER',
        'FARMER',
        'BUYER',
        'LOGISTICIAN',
        'SURVEYOR',
        'LAB',
        'ELEVATOR',
        'ACCOUNTING'
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

-- No DELETE policy. Corrections and signature submissions create a new row.

DO $block$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE ON TABLE public."deal_documents" TO %I',
        role_name
      );
      EXECUTE format(
        'REVOKE DELETE ON TABLE public."deal_documents" FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$block$;
