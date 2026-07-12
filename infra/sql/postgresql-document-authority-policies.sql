-- IR-10.1 production overlay for deal_documents.
-- This file intentionally contains the authority-trigger and policy portion of
-- 20260713090000_documents_postgresql_authority for drift-controlled rollout.
-- Apply only after the matching forward migration added the referenced columns.

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
        'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER',
        'FARMER', 'BUYER', 'LOGISTICIAN', 'SURVEYOR',
        'LAB', 'ELEVATOR', 'ACCOUNTING'
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
  AND public.app_rls_deal_visible("dealId")
  AND (
    (
      "type" = 'EVIDENCE_FILE'
      AND NOT "isImmutable"
      AND "status" IN ('UPLOAD_PENDING', 'UPLOAD_EXPIRED', 'DELETE_PENDING', 'DELETE_FAILED')
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
        "status" IN (
          'UPLOAD_PENDING', 'VERIFIED', 'UPLOAD_EXPIRED',
          'DELETE_PENDING', 'DELETE_FAILED', 'DELETED'
        )
        OR left("status", 12) = 'QUARANTINED_'
      )
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
