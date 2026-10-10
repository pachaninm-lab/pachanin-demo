-- PC-CROP federal accounting, Wave 2 eighth slice: the organization's tax status.
--
-- This closes the second revision source the staleness snapshot records and
-- nothing produced. `TAX_PROFILE` now points at something.
--
-- Versioned in time for the same reason as the rule registry: a regime change
-- in July must not retroactively change what a document issued in March says
-- about itself. A profile stored as a single mutable row would do exactly
-- that, and nothing in the affected documents would reveal it.
--
-- The difference from `regulatory_rule_versions` is worth stating, because the
-- privilege shapes are opposite on purpose. Tax law is not an organization's
-- setting, so no confined principal may write the rule registry. A tax status
-- *is* the organization's own declaration, so its members may record one —
-- what they may not do is change what a recorded version means after documents
-- have cited it. Hence a write path exists here, and the guard makes the
-- substance of a published version immutable.
--
-- `effectiveTo` is the single exception: it may be set once, from null, which
-- is how a window is closed when a successor is declared. Re-cutting it
-- afterwards is refused, because moving the boundary a second time orphans
-- documents that were issued under the version as it stood.

-- CreateTable
CREATE TABLE "organization_tax_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "taxRegime" TEXT NOT NULL,
    "vatStatus" TEXT NOT NULL,
    "vatExemptionGround" TEXT,
    "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
    "effectiveTo" TIMESTAMPTZ(6),
    "createdByMembershipId" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_tax_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_tax_profiles_organizationId_effectiveFrom_idx" ON "organization_tax_profiles"("organizationId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "organization_tax_profiles_tenantId_idx" ON "organization_tax_profiles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_tax_profiles_organizationId_versionTag_key" ON "organization_tax_profiles"("organizationId", "versionTag");

-- AddForeignKey
ALTER TABLE "organization_tax_profiles" ADD CONSTRAINT "organization_tax_profiles_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_tax_profiles" ADD CONSTRAINT "organization_tax_profiles_createdByMembershipId_organizati_fkey" FOREIGN KEY ("createdByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints ---------------------------------------------------------------

ALTER TABLE public."organization_tax_profiles"
  DROP CONSTRAINT IF EXISTS organization_tax_profiles_regime_check;
ALTER TABLE public."organization_tax_profiles"
  ADD CONSTRAINT organization_tax_profiles_regime_check
  CHECK ("taxRegime" IN ('OSNO', 'USN', 'ESHN'));

ALTER TABLE public."organization_tax_profiles"
  DROP CONSTRAINT IF EXISTS organization_tax_profiles_vat_status_check;
ALTER TABLE public."organization_tax_profiles"
  ADD CONSTRAINT organization_tax_profiles_vat_status_check
  CHECK ("vatStatus" IN ('PAYER', 'EXEMPT', 'NOT_PAYER'));

-- An exemption nobody can name is indistinguishable from not charging VAT for
-- no reason, and a ground cited by an organization that is not exempt claims a
-- status it does not hold. Both directions are refused.
ALTER TABLE public."organization_tax_profiles"
  DROP CONSTRAINT IF EXISTS organization_tax_profiles_exemption_ground_check;
ALTER TABLE public."organization_tax_profiles"
  ADD CONSTRAINT organization_tax_profiles_exemption_ground_check
  CHECK (
    ("vatStatus" = 'EXEMPT'
       AND "vatExemptionGround" IS NOT NULL
       AND length(btrim("vatExemptionGround")) > 0)
    OR ("vatStatus" <> 'EXEMPT' AND "vatExemptionGround" IS NULL)
  );

ALTER TABLE public."organization_tax_profiles"
  DROP CONSTRAINT IF EXISTS organization_tax_profiles_window_check;
ALTER TABLE public."organization_tax_profiles"
  ADD CONSTRAINT organization_tax_profiles_window_check
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE public."organization_tax_profiles"
  DROP CONSTRAINT IF EXISTS organization_tax_profiles_version_tag_check;
ALTER TABLE public."organization_tax_profiles"
  ADD CONSTRAINT organization_tax_profiles_version_tag_check
  CHECK (length(btrim("versionTag")) > 0);

-- No two statuses in force at once ------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_tax_profile_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  conflicting text;
BEGIN
  -- Two statuses in force at one instant makes "was this organization charging
  -- VAT that day" unanswerable, and every document issued inside the overlap
  -- becomes unverifiable.
  SELECT other."versionTag" INTO conflicting
  FROM public."organization_tax_profiles" other
  WHERE other."organizationId" = NEW."organizationId"
    AND other."id" <> NEW."id"
    AND NEW."effectiveFrom" < coalesce(other."effectiveTo", 'infinity'::timestamptz)
    AND other."effectiveFrom" < coalesce(NEW."effectiveTo", 'infinity'::timestamptz)
  LIMIT 1;

  IF conflicting IS NOT NULL THEN
    RAISE EXCEPTION
      'tax profile % overlaps version % already in force for this organization',
      NEW."versionTag", conflicting;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."taxRegime" IS DISTINCT FROM OLD."taxRegime"
       OR NEW."vatStatus" IS DISTINCT FROM OLD."vatStatus"
       OR NEW."vatExemptionGround" IS DISTINCT FROM OLD."vatExemptionGround"
       OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom"
       OR NEW."versionTag" IS DISTINCT FROM OLD."versionTag"
       OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
       OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
      RAISE EXCEPTION
        'a recorded tax profile is immutable; declare a successor version instead';
    END IF;
    -- Closing the window is how a successor is declared. Re-cutting it later
    -- orphans documents issued under the version as it stood.
    IF OLD."effectiveTo" IS NOT NULL
       AND NEW."effectiveTo" IS DISTINCT FROM OLD."effectiveTo" THEN
      RAISE EXCEPTION 'the end of a tax profile window is set once, not moved';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS organization_tax_profiles_guard
  ON public."organization_tax_profiles";
CREATE TRIGGER organization_tax_profiles_guard
  BEFORE INSERT OR UPDATE ON public."organization_tax_profiles"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_tax_profile_guard();

-- Row level security --------------------------------------------------------

ALTER TABLE public."organization_tax_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organization_tax_profiles" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_tax_profiles_member_select ON public."organization_tax_profiles";
CREATE POLICY organization_tax_profiles_member_select ON public."organization_tax_profiles"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS organization_tax_profiles_command_insert ON public."organization_tax_profiles";
CREATE POLICY organization_tax_profiles_command_insert ON public."organization_tax_profiles"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "createdByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS organization_tax_profiles_command_update ON public."organization_tax_profiles";
CREATE POLICY organization_tax_profiles_command_update ON public."organization_tax_profiles"
  FOR UPDATE
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "effectiveTo" IS NULL
  )
  WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

-- Privileges ----------------------------------------------------------------

DO $tax_profile_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."organization_tax_profiles" FROM %I', read_role);
    EXECUTE format(
      'GRANT SELECT ON public."organization_tax_profiles" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."organization_tax_profiles" FROM %I', write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."organization_tax_profiles" TO %I', write_role);
    -- Closing a window is the only update. The regime, the status and the
    -- exemption ground are not writable at all after insert, so a document's
    -- cited profile cannot change meaning even before the guard is consulted.
    EXECUTE format(
      'GRANT UPDATE ("effectiveTo", "updatedAt", "version") ON public."organization_tax_profiles" TO %I',
      write_role);
    -- Deleting a profile leaves documents citing a status that no longer
    -- exists. Superseded versions stay.
    EXECUTE format(
      'REVOKE DELETE ON public."organization_tax_profiles" FROM %I', write_role);
  END IF;
END
$tax_profile_grants$;
