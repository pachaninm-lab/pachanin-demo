-- PC-CROP federal accounting, Wave 2 ninth slice: versions of the agreement.
--
-- The third revision source the staleness snapshot records, and the last of
-- them that had nothing behind it. A УПД states a price, a delivery basis and
-- a payment term, all of which come from an agreement that can be amended.
-- When it is amended the document does not become wrong — it becomes a
-- description of terms that no longer apply. That is the quieter failure, and
-- the recorded revision is what lets the platform tell the two apart.
--
-- The shape follows the document versions deliberately: a signed version is a
-- one-way door. Terms that can move underneath a signature are evidence of
-- nothing, so the guard refuses any update to a signed row and the column
-- grant withholds the terms and their hash entirely. An amendment is a new
-- version that names what it replaces; the replaced one stays, because the
-- chain back to what was originally agreed has to remain followable.
--
-- Two signed versions in force at once would make "which price applied on the
-- 3rd" unanswerable, so that overlap is refused. Draft amendments may sit
-- alongside the signed version they propose to replace — that is what an
-- amendment under negotiation is — and they govern nothing until signed.

-- CreateTable
CREATE TABLE "contract_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "termsHash" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "counterpartyOrgId" TEXT,
    "dealId" TEXT,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "signedAt" TIMESTAMPTZ(6),
    "signedByMembershipId" TEXT,
    "supersedesVersionNumber" INTEGER,
    "createdByMembershipId" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_versions_organizationId_contractNumber_effectiveFr_idx" ON "contract_versions"("organizationId", "contractNumber", "effectiveFrom");

-- CreateIndex
CREATE INDEX "contract_versions_tenantId_idx" ON "contract_versions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_versions_organizationId_contractNumber_versionNumb_key" ON "contract_versions"("organizationId", "contractNumber", "versionNumber");

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_createdByMembershipId_organizationId_fkey" FOREIGN KEY ("createdByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_signedByMembershipId_organizationId_fkey" FOREIGN KEY ("signedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints ---------------------------------------------------------------

ALTER TABLE public."contract_versions"
  DROP CONSTRAINT IF EXISTS contract_versions_status_check;
ALTER TABLE public."contract_versions"
  ADD CONSTRAINT contract_versions_status_check
  CHECK ("status" IN ('DRAFT', 'SIGNED', 'SUPERSEDED', 'TERMINATED'));

ALTER TABLE public."contract_versions"
  DROP CONSTRAINT IF EXISTS contract_versions_number_check;
ALTER TABLE public."contract_versions"
  ADD CONSTRAINT contract_versions_number_check
  CHECK ("versionNumber" > 0);

ALTER TABLE public."contract_versions"
  DROP CONSTRAINT IF EXISTS contract_versions_window_check;
ALTER TABLE public."contract_versions"
  ADD CONSTRAINT contract_versions_window_check
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE public."contract_versions"
  DROP CONSTRAINT IF EXISTS contract_versions_terms_hash_check;
ALTER TABLE public."contract_versions"
  ADD CONSTRAINT contract_versions_terms_hash_check
  CHECK (length(btrim("termsHash")) > 0 AND length(btrim("contractNumber")) > 0);

ALTER TABLE public."contract_versions"
  DROP CONSTRAINT IF EXISTS contract_versions_terms_object_check;
ALTER TABLE public."contract_versions"
  ADD CONSTRAINT contract_versions_terms_object_check
  CHECK (jsonb_typeof("terms") = 'object');

-- A status and a signature that disagree produce a version that reads as
-- signed to one check and unsigned to another.
ALTER TABLE public."contract_versions"
  DROP CONSTRAINT IF EXISTS contract_versions_signature_consistency_check;
ALTER TABLE public."contract_versions"
  ADD CONSTRAINT contract_versions_signature_consistency_check
  CHECK (
    ("status" = 'DRAFT' AND "signedAt" IS NULL AND "signedByMembershipId" IS NULL)
    OR ("status" <> 'DRAFT' AND "signedAt" IS NOT NULL AND "signedByMembershipId" IS NOT NULL)
  );

-- Every amendment names what it replaces, and only the first names nothing.
-- Without this the chain back to what was originally agreed has a hole in it.
ALTER TABLE public."contract_versions"
  DROP CONSTRAINT IF EXISTS contract_versions_supersedes_check;
ALTER TABLE public."contract_versions"
  ADD CONSTRAINT contract_versions_supersedes_check
  CHECK (
    ("versionNumber" = 1 AND "supersedesVersionNumber" IS NULL)
    OR (
      "versionNumber" > 1
      AND "supersedesVersionNumber" IS NOT NULL
      AND "supersedesVersionNumber" < "versionNumber"
    )
  );

-- Immutability and exclusivity ----------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_contract_version_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  conflicting integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."signedAt" IS NOT NULL THEN
    -- Closing the window of a signed version is how an amendment takes over,
    -- and retiring it by status is how it is superseded or terminated.
    -- Everything else about a signed agreement is settled.
    IF NEW."termsHash" IS DISTINCT FROM OLD."termsHash"
       OR NEW."terms" IS DISTINCT FROM OLD."terms"
       OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
       OR NEW."contractNumber" IS DISTINCT FROM OLD."contractNumber"
       OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
       OR NEW."signedAt" IS DISTINCT FROM OLD."signedAt"
       OR NEW."signedByMembershipId" IS DISTINCT FROM OLD."signedByMembershipId"
       OR NEW."supersedesVersionNumber" IS DISTINCT FROM OLD."supersedesVersionNumber"
       OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
       OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
      RAISE EXCEPTION
        'a signed contract version is immutable; record an amendment instead';
    END IF;
  END IF;

  -- Two signed versions in force at once makes "which price applied on the
  -- 3rd" unanswerable. Drafts may overlap freely: an amendment under
  -- negotiation governs nothing until it is signed.
  IF NEW."status" = 'SIGNED' THEN
    SELECT other."versionNumber" INTO conflicting
    FROM public."contract_versions" other
    WHERE other."organizationId" = NEW."organizationId"
      AND other."contractNumber" = NEW."contractNumber"
      AND other."id" <> NEW."id"
      AND other."status" = 'SIGNED'
      AND NEW."effectiveFrom" < coalesce(other."effectiveTo", 'infinity'::timestamptz)
      AND other."effectiveFrom" < coalesce(NEW."effectiveTo", 'infinity'::timestamptz)
    LIMIT 1;

    IF conflicting IS NOT NULL THEN
      RAISE EXCEPTION
        'contract % version % overlaps signed version % already in force',
        NEW."contractNumber", NEW."versionNumber", conflicting;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS contract_versions_guard ON public."contract_versions";
CREATE TRIGGER contract_versions_guard
  BEFORE INSERT OR UPDATE ON public."contract_versions"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_contract_version_guard();

-- Row level security --------------------------------------------------------

ALTER TABLE public."contract_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contract_versions" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_versions_member_select ON public."contract_versions";
CREATE POLICY contract_versions_member_select ON public."contract_versions"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS contract_versions_command_insert ON public."contract_versions";
CREATE POLICY contract_versions_command_insert ON public."contract_versions"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS contract_versions_command_update ON public."contract_versions";
CREATE POLICY contract_versions_command_update ON public."contract_versions"
  FOR UPDATE
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  )
  WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

-- Privileges ----------------------------------------------------------------

DO $contract_version_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."contract_versions" FROM %I', read_role);
    EXECUTE format(
      'GRANT SELECT ON public."contract_versions" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."contract_versions" FROM %I', write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."contract_versions" TO %I', write_role);
    -- Signing a draft, closing a window and retiring a version by status. The
    -- terms and their hash are not writable after insert at all, which is what
    -- makes a signature cover a fixed agreement.
    EXECUTE format(
      'GRANT UPDATE ("status", "effectiveTo", "signedAt", "signedByMembershipId", "updatedAt", "version") ON public."contract_versions" TO %I',
      write_role);
    -- Deleting a version breaks the chain an amendment points back along.
    EXECUTE format(
      'REVOKE DELETE ON public."contract_versions" FROM %I', write_role);
  END IF;
END
$contract_version_grants$;
