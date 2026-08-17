-- AlterTable
ALTER TABLE "accounting_document_versions" ADD COLUMN     "externalReceiptId" TEXT,
ADD COLUMN     "externalReceiptIssuer" TEXT,
ADD COLUMN     "sentAt" TIMESTAMPTZ(6),
ADD COLUMN     "transportCode" TEXT;


-- A delivery is recorded once ------------------------------------------------

-- Complete or absent, never half. A sent timestamp with no receipt behind it is
-- the platform's own opinion that something arrived.
--
-- Every column is tested for NULL explicitly rather than relying on btrim. A
-- CHECK is violated only when it evaluates to FALSE, so `btrim(NULL) <> ''`
-- evaluates to NULL and the row is admitted — which is exactly the half-written
-- delivery this constraint exists to refuse. The acceptance test caught it.
ALTER TABLE public."accounting_document_versions"
  ADD CONSTRAINT accounting_document_versions_receipt_complete_check
  CHECK (
    (
      "sentAt" IS NULL AND "transportCode" IS NULL
      AND "externalReceiptId" IS NULL AND "externalReceiptIssuer" IS NULL
    )
    OR (
      "sentAt" IS NOT NULL
      AND "transportCode" IS NOT NULL AND btrim("transportCode") <> ''
      AND "externalReceiptId" IS NOT NULL AND btrim("externalReceiptId") <> ''
      AND "externalReceiptIssuer" IS NOT NULL
      AND btrim("externalReceiptIssuer") <> ''
    )
  );

-- The same trap, one table over. A manual task carries no derivation key, so
-- `"openDerivationKey" = "derivationKey"` evaluated to NULL for a manual row
-- with an open key set, and the row was admitted — letting a hand-written note
-- occupy a condition slot and keep the deriver from ever raising the real task.
ALTER TABLE public."accounting_work_tasks"
  DROP CONSTRAINT IF EXISTS accounting_work_tasks_open_key_mirrors_derivation;
ALTER TABLE public."accounting_work_tasks"
  ADD CONSTRAINT accounting_work_tasks_open_key_mirrors_derivation
  CHECK (
    "openDerivationKey" IS NULL
    OR ("derivationKey" IS NOT NULL AND "openDerivationKey" = "derivationKey")
  );

-- The issuer is somebody else. A receipt this platform wrote about its own
-- request is a record of intention, and recording it here would let the
-- maturity policy's refusal be walked around one table over.
ALTER TABLE public."accounting_document_versions"
  ADD CONSTRAINT accounting_document_versions_receipt_is_external_check
  CHECK (
    "externalReceiptIssuer" IS NULL
    OR upper(btrim("externalReceiptIssuer"))
       NOT IN ('PC_CROP', 'PLATFORM', 'SELF', 'INTERNAL')
  );

CREATE OR REPLACE FUNCTION public.pc_crop_accounting_version_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public."accounting_documents" parent
      WHERE parent."id" = NEW."documentId"
        AND parent."organizationId" = NEW."organizationId"
        AND parent."tenantId" = NEW."tenantId"
    ) THEN
      RAISE EXCEPTION
        'accounting document version must belong to its document''s organization and tenant';
    END IF;
    -- A version is not born delivered, for the same reason it is not born
    -- signed: both have to pass through the path where they can be checked.
    IF NEW."sentAt" IS NOT NULL THEN
      RAISE EXCEPTION 'an accounting document version is not created already sent';
    END IF;
    RETURN NEW;
  END IF;

  -- Delivery is recorded once and never revised. Overwriting it would let a
  -- second delivery hide behind the record of the first.
  IF OLD."sentAt" IS NOT NULL AND (
       NEW."sentAt" IS DISTINCT FROM OLD."sentAt"
    OR NEW."transportCode" IS DISTINCT FROM OLD."transportCode"
    OR NEW."externalReceiptId" IS DISTINCT FROM OLD."externalReceiptId"
    OR NEW."externalReceiptIssuer" IS DISTINCT FROM OLD."externalReceiptIssuer"
  ) THEN
    RAISE EXCEPTION 'the delivery of an accounting document version is recorded once';
  END IF;

  -- Sending an unsigned version would put an unsigned document in front of a
  -- counterparty. The transmission policy says the same thing; this says it to
  -- everybody.
  IF NEW."sentAt" IS NOT NULL AND OLD."sentAt" IS NULL AND NEW."signedAt" IS NULL THEN
    RAISE EXCEPTION 'an unsigned accounting document version is never sent';
  END IF;

  -- A signed version is otherwise immutable, but recording where it went is
  -- not a change to what it says. Everything else stays frozen.
  IF OLD."signedAt" IS NOT NULL THEN
    IF NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash"
       OR NEW."recordedRevisions" IS DISTINCT FROM OLD."recordedRevisions"
       OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
       OR NEW."documentId" IS DISTINCT FROM OLD."documentId"
       OR NEW."totalKopecks" IS DISTINCT FROM OLD."totalKopecks"
       OR NEW."signedAt" IS DISTINCT FROM OLD."signedAt"
       OR NEW."signedByMembershipId" IS DISTINCT FROM OLD."signedByMembershipId"
       OR NEW."signingAuthorityId" IS DISTINCT FROM OLD."signingAuthorityId"
       OR NEW."signatureCertificateFingerprint"
          IS DISTINCT FROM OLD."signatureCertificateFingerprint" THEN
      RAISE EXCEPTION 'a signed accounting document version is immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash" THEN
    RAISE EXCEPTION 'the payload hash of an accounting document version never changes';
  END IF;
  IF NEW."recordedRevisions" IS DISTINCT FROM OLD."recordedRevisions" THEN
    RAISE EXCEPTION 'the recorded source revisions of an accounting document version never change';
  END IF;
  IF NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" THEN
    RAISE EXCEPTION 'the number of an accounting document version never changes';
  END IF;
  IF NEW."documentId" IS DISTINCT FROM OLD."documentId" THEN
    RAISE EXCEPTION 'an accounting document version never moves to another document';
  END IF;

  RETURN NEW;
END
$function$;

DO $accounting_receipt_grants$
DECLARE
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    -- Recording a delivery, and nothing else new. The signature columns were
    -- already granted; these four join them because a delivery is written by
    -- the same runtime that sends.
    EXECUTE format(
      'GRANT UPDATE ("sentAt", "transportCode", "externalReceiptId", '
      || '"externalReceiptIssuer") ON public."accounting_document_versions" TO %I',
      write_role);
  END IF;
END
$accounting_receipt_grants$;
