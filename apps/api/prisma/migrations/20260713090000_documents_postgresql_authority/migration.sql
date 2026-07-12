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

CREATE OR REPLACE FUNCTION public.app_document_deal_authorized(p_deal_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    public.app_rls_context_ready()
    AND (
      public.app_rls_privileged()
      OR EXISTS (
        SELECT 1
        FROM public."deal_participants" participant
        WHERE participant."dealId" = p_deal_id
          AND participant."tenantId" = current_setting('app.current_tenant_id', true)
          AND participant."organizationId" = current_setting('app.current_org_id', true)
          AND participant."userId" = current_setting('app.current_user_id', true)
          AND participant."role" = current_setting('app.current_role', true)
          AND participant."status" = 'ACTIVE'
          AND participant."accessLevel" IN ('READ', 'WORK', 'APPROVE')
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_document_validate_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  source_record public."deal_documents"%ROWTYPE;
  signature_record public."deal_documents"%ROWTYPE;
BEGIN
  IF NEW."type" = 'EVIDENCE_FILE' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW."status" <> 'UPLOAD_PENDING'
        OR NEW."isImmutable"
        OR NEW."hash" IS NOT NULL
        OR NEW."s3Key" IS NULL
        OR NEW."mimeType" IS NULL
        OR NEW."sizeBytes" IS NULL
        OR NEW."sizeBytes" <= 0
        OR NEW."version" <> 1
        OR NEW."sourceFileId" IS NOT NULL
        OR NEW."signatureFileId" IS NOT NULL
        OR NEW."supersedesId" IS NOT NULL
        OR NEW."signedAt" IS NOT NULL
        OR NEW."signatories" IS NOT NULL
      THEN
        RAISE EXCEPTION 'evidence files must start as mutable UPLOAD_PENDING metadata'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW."id" IS DISTINCT FROM OLD."id"
      OR NEW."dealId" IS DISTINCT FROM OLD."dealId"
      OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
      OR NEW."type" IS DISTINCT FROM OLD."type"
      OR NEW."name" IS DISTINCT FROM OLD."name"
      OR NEW."s3Key" IS DISTINCT FROM OLD."s3Key"
      OR NEW."uploadedAt" IS DISTINCT FROM OLD."uploadedAt"
      OR NEW."uploadedByUserId" IS DISTINCT FROM OLD."uploadedByUserId"
      OR NEW."sourceFileId" IS DISTINCT FROM OLD."sourceFileId"
      OR NEW."signatureFileId" IS DISTINCT FROM OLD."signatureFileId"
      OR NEW."supersedesId" IS DISTINCT FROM OLD."supersedesId"
      OR NEW."seriesId" IS DISTINCT FROM OLD."seriesId"
      OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
      OR NEW."correlationId" IS DISTINCT FROM OLD."correlationId"
      OR NEW."createdByOrgId" IS DISTINCT FROM OLD."createdByOrgId"
      OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
      OR NEW."version" <> OLD."version" + 1
    THEN
      RAISE EXCEPTION 'evidence identity and object key are immutable across storage transitions'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (
      (OLD."status" = 'UPLOAD_PENDING' AND (
        NEW."status" IN ('VERIFIED', 'UPLOAD_EXPIRED', 'DELETE_PENDING')
        OR left(NEW."status", 12) = 'QUARANTINED_'
      ))
      OR (OLD."status" IN ('UPLOAD_EXPIRED', 'DELETE_FAILED') AND NEW."status" = 'DELETE_PENDING')
      OR (OLD."status" = 'DELETE_PENDING' AND NEW."status" IN ('DELETE_FAILED', 'DELETED'))
    ) THEN
      RAISE EXCEPTION 'invalid evidence storage state transition from % to %', OLD."status", NEW."status"
        USING ERRCODE = '23514';
    END IF;

    IF NEW."status" = 'VERIFIED' OR left(NEW."status", 12) = 'QUARANTINED_' THEN
      IF NOT NEW."isImmutable"
        OR NEW."hash" IS NULL
        OR NEW."hash" !~ '^[0-9a-f]{64}$'
        OR NEW."mimeType" IS NULL
        OR NEW."sizeBytes" IS NULL
        OR NEW."sizeBytes" <= 0
      THEN
        RAISE EXCEPTION 'verified or quarantined evidence requires immutable inspected metadata'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      IF NEW."isImmutable"
        OR NEW."hash" IS DISTINCT FROM OLD."hash"
        OR NEW."mimeType" IS DISTINCT FROM OLD."mimeType"
        OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
      THEN
        RAISE EXCEPTION 'non-terminal evidence transitions cannot author inspection results'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
    AND NEW."type" = 'PACKAGE_MANIFEST'
  THEN
    IF NEW."status" <> 'PACKAGE_MANIFEST_CREATED'
      OR NOT NEW."isImmutable"
      OR NEW."mimeType" <> 'application/json'
      OR NEW."hash" IS NULL
      OR NEW."hash" !~ '^[0-9a-f]{64}$'
      OR NEW."metadata" IS NULL
      OR NEW."s3Key" IS NOT NULL
      OR NEW."sourceFileId" IS NOT NULL
      OR NEW."signatureFileId" IS NOT NULL
      OR NEW."supersedesId" IS NOT NULL
    THEN
      RAISE EXCEPTION 'package manifests require immutable server-generated manifest metadata'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
    AND NEW."status" IN ('PENDING_REVIEW', 'SIGNATURE_PENDING_VERIFICATION')
  THEN
    IF NEW."type" NOT IN (
      'contract', 'transport_waybill', 'quality_certificate', 'acceptance_act',
      'sdiz', 'lab_protocol', 'bank_basis', 'dispute_resolution'
    ) THEN
      RAISE EXCEPTION 'authoritative document type is not canonical'
        USING ERRCODE = '23514';
    END IF;
    IF NEW."sourceFileId" IS NULL THEN
      RAISE EXCEPTION 'authoritative document versions require a verified evidence source'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO source_record
    FROM public."deal_documents"
    WHERE "id" = NEW."sourceFileId";

    IF NOT FOUND
      OR source_record."type" <> 'EVIDENCE_FILE'
      OR source_record."status" <> 'VERIFIED'
      OR NOT source_record."isImmutable"
      OR source_record."dealId" <> NEW."dealId"
      OR source_record."tenantId" <> NEW."tenantId"
      OR source_record."hash" IS NULL
      OR NEW."hash" IS DISTINCT FROM source_record."hash"
      OR NEW."s3Key" IS DISTINCT FROM source_record."s3Key"
      OR NEW."mimeType" IS DISTINCT FROM source_record."mimeType"
      OR NEW."sizeBytes" IS DISTINCT FROM source_record."sizeBytes"
    THEN
      RAISE EXCEPTION 'authoritative document source is not verified immutable evidence from the same deal'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."status" = 'PENDING_REVIEW' AND NEW."signatureFileId" IS NOT NULL THEN
      RAISE EXCEPTION 'unsigned document versions cannot carry signature evidence'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."status" = 'SIGNATURE_PENDING_VERIFICATION' THEN
      IF NEW."signatureFileId" IS NULL THEN
        RAISE EXCEPTION 'signature verification requires signature evidence'
          USING ERRCODE = '23514';
      END IF;
      SELECT * INTO signature_record
      FROM public."deal_documents"
      WHERE "id" = NEW."signatureFileId";
      IF NOT FOUND
        OR signature_record."type" <> 'EVIDENCE_FILE'
        OR signature_record."status" <> 'VERIFIED'
        OR NOT signature_record."isImmutable"
        OR signature_record."dealId" <> NEW."dealId"
        OR signature_record."tenantId" <> NEW."tenantId"
        OR signature_record."mimeType" <> 'application/pkcs7-signature'
        OR signature_record."hash" IS NULL
      THEN
        RAISE EXCEPTION 'signature source is not verified immutable PKCS7 evidence from the same deal'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS deal_documents_validate_authority ON public."deal_documents";
CREATE TRIGGER deal_documents_validate_authority
BEFORE INSERT OR UPDATE ON public."deal_documents"
FOR EACH ROW EXECUTE FUNCTION public.app_document_validate_authority();

CREATE OR REPLACE FUNCTION public.app_document_immutable_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD."isImmutable" THEN
    RAISE EXCEPTION 'confirmed document versions are append-only' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
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
  AND public.app_document_deal_authorized("dealId")
);

CREATE POLICY deal_documents_insert ON public."deal_documents"
FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_document_deal_authorized("dealId")
  AND (
    (
      "type" = 'EVIDENCE_FILE'
      AND "status" = 'UPLOAD_PENDING'
      AND NOT "isImmutable"
      AND "hash" IS NULL
      AND "s3Key" IS NOT NULL
      AND "mimeType" IS NOT NULL
      AND "sizeBytes" > 0
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
      AND (
        (
          "type" = 'PACKAGE_MANIFEST'
          AND "status" = 'PACKAGE_MANIFEST_CREATED'
          AND "sourceFileId" IS NULL
          AND "signatureFileId" IS NULL
          AND "s3Key" IS NULL
        )
        OR (
          "type" IN (
            'contract', 'transport_waybill', 'quality_certificate', 'acceptance_act',
            'sdiz', 'lab_protocol', 'bank_basis', 'dispute_resolution'
          )
          AND "status" IN ('PENDING_REVIEW', 'SIGNATURE_PENDING_VERIFICATION')
        )
      )
    )
  )
);

CREATE POLICY deal_documents_update ON public."deal_documents"
FOR UPDATE USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_document_deal_authorized("dealId")
  AND (
    (
      "type" = 'EVIDENCE_FILE'
      AND NOT "isImmutable"
      AND (
        (
          current_user IN ('app_storage', 'one_deal_storage')
          AND "status" = 'UPLOAD_PENDING'
        )
        OR (
          current_user NOT IN ('app_storage', 'one_deal_storage')
          AND "status" IN ('UPLOAD_PENDING', 'UPLOAD_EXPIRED', 'DELETE_PENDING', 'DELETE_FAILED')
        )
      )
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
  AND public.app_document_deal_authorized("dealId")
  AND (
    (
      "type" = 'EVIDENCE_FILE'
      AND (
        (
          current_user IN ('app_storage', 'one_deal_storage')
          AND ("status" = 'VERIFIED' OR left("status", 12) = 'QUARANTINED_')
        )
        OR (
          current_user NOT IN ('app_storage', 'one_deal_storage')
          AND "status" IN (
            'UPLOAD_PENDING', 'UPLOAD_EXPIRED', 'DELETE_PENDING', 'DELETE_FAILED', 'DELETED'
          )
        )
      )
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

DO $storage_roles$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_storage', 'one_deal_storage']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, UPDATE ON TABLE public."deal_documents" TO %I', role_name);
      EXECUTE format('REVOKE INSERT, DELETE ON TABLE public."deal_documents" FROM %I', role_name);
    END IF;
  END LOOP;
END
$storage_roles$;
