-- IR-10.3 requires laboratory evidence purpose to be fixed before the object
-- becomes VERIFIED and immutable. The original document-authority trigger froze
-- metadata from the first UPLOAD_PENDING row, while the storage request API only
-- creates the object identity. This controlled transition permits exactly one or
-- more CAS-guarded metadata enrichments while the object is still pending; every
-- enrichment increments version and cannot change object identity or storage
-- inspection fields.

CREATE OR REPLACE FUNCTION public.app_document_pending_metadata_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD."type" <> 'EVIDENCE_FILE'
     OR NEW."type" <> 'EVIDENCE_FILE'
     OR OLD."status" <> 'UPLOAD_PENDING'
     OR NEW."status" <> 'UPLOAD_PENDING'
     OR OLD."isImmutable"
     OR NEW."isImmutable"
     OR OLD."hash" IS NOT NULL
     OR NEW."hash" IS NOT NULL
  THEN
    RAISE EXCEPTION 'evidence purpose metadata can only be bound while upload is pending'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."name" IS DISTINCT FROM OLD."name"
     OR NEW."s3Key" IS DISTINCT FROM OLD."s3Key"
     OR NEW."mimeType" IS DISTINCT FROM OLD."mimeType"
     OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
     OR NEW."uploadedAt" IS DISTINCT FROM OLD."uploadedAt"
     OR NEW."uploadedByUserId" IS DISTINCT FROM OLD."uploadedByUserId"
     OR NEW."sourceFileId" IS DISTINCT FROM OLD."sourceFileId"
     OR NEW."signatureFileId" IS DISTINCT FROM OLD."signatureFileId"
     OR NEW."supersedesId" IS DISTINCT FROM OLD."supersedesId"
     OR NEW."seriesId" IS DISTINCT FROM OLD."seriesId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."correlationId" IS DISTINCT FROM OLD."correlationId"
     OR NEW."createdByOrgId" IS DISTINCT FROM OLD."createdByOrgId"
     OR NEW."status" IS DISTINCT FROM OLD."status"
  THEN
    RAISE EXCEPTION 'pending evidence purpose update cannot change object identity or storage fields'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."metadata" IS NULL
     OR jsonb_typeof(NEW."metadata") <> 'object'
     OR NEW."metadata" = '{}'::jsonb
  THEN
    RAISE EXCEPTION 'pending evidence purpose metadata must be a non-empty object'
      USING ERRCODE = '23514';
  END IF;

  NEW."version" := OLD."version" + 1;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS deal_documents_validate_authority ON public."deal_documents";
DROP TRIGGER IF EXISTS deal_documents_validate_authority_insert ON public."deal_documents";
DROP TRIGGER IF EXISTS deal_documents_validate_authority_update ON public."deal_documents";
DROP TRIGGER IF EXISTS deal_documents_pending_metadata_authority ON public."deal_documents";

CREATE TRIGGER deal_documents_validate_authority_insert
BEFORE INSERT ON public."deal_documents"
FOR EACH ROW EXECUTE FUNCTION public.app_document_validate_authority();

-- Exact pending metadata enrichment is handled by the dedicated trigger below.
-- Every other update remains governed by the original document state machine.
CREATE TRIGGER deal_documents_validate_authority_update
BEFORE UPDATE ON public."deal_documents"
FOR EACH ROW
WHEN (NOT (
  OLD."type" = 'EVIDENCE_FILE'
  AND NEW."type" = 'EVIDENCE_FILE'
  AND OLD."status" = 'UPLOAD_PENDING'
  AND NEW."status" = 'UPLOAD_PENDING'
  AND NOT OLD."isImmutable"
  AND NOT NEW."isImmutable"
  AND OLD."hash" IS NULL
  AND NEW."hash" IS NULL
  AND NEW."metadata" IS DISTINCT FROM OLD."metadata"
  AND NEW."id" IS NOT DISTINCT FROM OLD."id"
  AND NEW."dealId" IS NOT DISTINCT FROM OLD."dealId"
  AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
  AND NEW."name" IS NOT DISTINCT FROM OLD."name"
  AND NEW."s3Key" IS NOT DISTINCT FROM OLD."s3Key"
  AND NEW."mimeType" IS NOT DISTINCT FROM OLD."mimeType"
  AND NEW."sizeBytes" IS NOT DISTINCT FROM OLD."sizeBytes"
  AND NEW."uploadedAt" IS NOT DISTINCT FROM OLD."uploadedAt"
  AND NEW."uploadedByUserId" IS NOT DISTINCT FROM OLD."uploadedByUserId"
  AND NEW."sourceFileId" IS NOT DISTINCT FROM OLD."sourceFileId"
  AND NEW."signatureFileId" IS NOT DISTINCT FROM OLD."signatureFileId"
  AND NEW."supersedesId" IS NOT DISTINCT FROM OLD."supersedesId"
  AND NEW."seriesId" IS NOT DISTINCT FROM OLD."seriesId"
  AND NEW."idempotencyKey" IS NOT DISTINCT FROM OLD."idempotencyKey"
  AND NEW."correlationId" IS NOT DISTINCT FROM OLD."correlationId"
  AND NEW."createdByOrgId" IS NOT DISTINCT FROM OLD."createdByOrgId"
))
EXECUTE FUNCTION public.app_document_validate_authority();

CREATE TRIGGER deal_documents_pending_metadata_authority
BEFORE UPDATE OF "metadata" ON public."deal_documents"
FOR EACH ROW
WHEN (
  OLD."type" = 'EVIDENCE_FILE'
  AND NEW."type" = 'EVIDENCE_FILE'
  AND OLD."status" = 'UPLOAD_PENDING'
  AND NEW."status" = 'UPLOAD_PENDING'
  AND NEW."metadata" IS DISTINCT FROM OLD."metadata"
)
EXECUTE FUNCTION public.app_document_pending_metadata_authority();
