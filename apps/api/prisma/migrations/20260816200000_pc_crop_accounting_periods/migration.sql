-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closingStartedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "closedByMembershipId" TEXT,
    "openedByMembershipId" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_periods_organizationId_status_periodStart_idx" ON "accounting_periods"("organizationId", "status", "periodStart");

-- CreateIndex
CREATE INDEX "accounting_periods_tenantId_idx" ON "accounting_periods"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_organizationId_periodStart_key" ON "accounting_periods"("organizationId", "periodStart");

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_openedByMembershipId_organizationId_fkey" FOREIGN KEY ("openedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closedByMembershipId_organizationId_fkey" FOREIGN KEY ("closedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Shape ---------------------------------------------------------------------

ALTER TABLE public."accounting_periods"
  ADD CONSTRAINT accounting_periods_status_known
  CHECK ("status" IN ('OPEN', 'CLOSING', 'CLOSED'));

-- Half-open and non-empty. A period ending where it starts closes nothing and
-- would sit in the middle of the sequence claiming to.
ALTER TABLE public."accounting_periods"
  ADD CONSTRAINT accounting_periods_window_is_real
  CHECK ("periodEnd" > "periodStart");

ALTER TABLE public."accounting_periods"
  ADD CONSTRAINT accounting_periods_closure_is_complete
  CHECK (
    ("status" <> 'CLOSED' AND "closedAt" IS NULL AND "closedByMembershipId" IS NULL)
    OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL
        AND "closedByMembershipId" IS NOT NULL)
  );

-- Overlap and closure --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_accounting_period_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  outstanding integer;
BEGIN
  -- Two periods covering one instant makes "which period is this document in"
  -- unanswerable, and every rule below depends on that answer.
  IF EXISTS (
    SELECT 1
      FROM public."accounting_periods" other
     WHERE other."organizationId" = NEW."organizationId"
       AND other."id" <> NEW."id"
       AND other."periodStart" < NEW."periodEnd"
       AND other."periodEnd" > NEW."periodStart"
  ) THEN
    RAISE EXCEPTION 'accounting periods do not overlap';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'OPEN' THEN
      RAISE EXCEPTION 'an accounting period is opened open';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'an accounting period never moves to another organization';
  END IF;

  -- The window is what everything else was judged against. Moving it after the
  -- fact would silently change which documents a past close covered.
  IF OLD."status" <> 'OPEN'
     AND (NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
          OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd") THEN
    RAISE EXCEPTION 'the window of a period being closed no longer moves';
  END IF;

  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'an accounting period update must advance its version';
  END IF;

  IF OLD."status" = 'CLOSED' THEN
    -- A close that can be undone quietly is not a close. Reopening is a
    -- deliberate act with its own authority, and this slice does not grant it
    -- to anybody: there is no path here that moves a period back.
    RAISE EXCEPTION 'a closed accounting period does not reopen';
  END IF;

  IF NEW."status" = 'CLOSING' AND OLD."status" = 'OPEN' THEN
    NEW."closingStartedAt" := CURRENT_TIMESTAMP;
    RETURN NEW;
  END IF;

  IF NEW."status" = 'CLOSED' THEN
    IF OLD."status" <> 'CLOSING' THEN
      -- Straight from open to closed skips the moment where outstanding work is
      -- counted against a period nobody is still adding to.
      RAISE EXCEPTION 'an accounting period is closed from CLOSING, not from %',
        OLD."status";
    END IF;

    SELECT count(*) INTO outstanding
      FROM public."accounting_work_tasks" t
      JOIN public."accounting_documents" d ON d."id" = t."documentId"
     WHERE t."organizationId" = NEW."organizationId"
       AND t."origin" = 'DERIVED'
       AND t."status" NOT IN ('RESOLVED', 'CANCELLED')
       AND d."createdAt" >= NEW."periodStart"
       AND d."createdAt" < NEW."periodEnd";

    IF outstanding > 0 THEN
      RAISE EXCEPTION
        'the period still has % outstanding derived task(s); a close declared over unfinished work is the report that gets believed and then contradicted',
        outstanding;
    END IF;

    NEW."closedAt" := CURRENT_TIMESTAMP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_periods_guard ON public."accounting_periods";
CREATE TRIGGER accounting_periods_guard
  BEFORE INSERT OR UPDATE ON public."accounting_periods"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_accounting_period_guard();

-- What a closed period actually freezes -------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_accounting_period_freeze()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  raised timestamptz;
BEGIN
  SELECT d."createdAt" INTO raised
    FROM public."accounting_documents" d
   WHERE d."id" = NEW."documentId";

  IF raised IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public."accounting_periods" p
     WHERE p."organizationId" = NEW."organizationId"
       AND p."status" = 'CLOSED'
       AND p."periodStart" <= raised
       AND p."periodEnd" > raised
  ) THEN
    RAISE EXCEPTION
      'the accounting period this document belongs to is closed';
  END IF;

  RETURN NEW;
END
$function$;

-- On both insert and update: a closed period admits neither a new rendering of
-- a document raised inside it nor a signature on an existing one. Signing is an
-- update, so leaving it off the update path would freeze half the thing.
DROP TRIGGER IF EXISTS accounting_document_versions_period_freeze
  ON public."accounting_document_versions";
CREATE TRIGGER accounting_document_versions_period_freeze
  BEFORE INSERT OR UPDATE ON public."accounting_document_versions"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_accounting_period_freeze();

-- Row level security --------------------------------------------------------

ALTER TABLE public."accounting_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_periods" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_periods_member_select ON public."accounting_periods";
CREATE POLICY accounting_periods_member_select ON public."accounting_periods"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_periods_command_insert ON public."accounting_periods";
CREATE POLICY accounting_periods_command_insert ON public."accounting_periods"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "openedByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS accounting_periods_command_update ON public."accounting_periods";
CREATE POLICY accounting_periods_command_update ON public."accounting_periods"
  FOR UPDATE
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    -- A closed period is not merely unwritable by the guard; it is not even
    -- selected for update by this principal. The guard says the same thing to
    -- everyone, and this says it before the row is reached.
    AND "status" <> 'CLOSED'
  )
  WITH CHECK (
    "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND (
      "closedByMembershipId" IS NULL
      OR "closedByMembershipId" = public.app_pc_crop_membership_id()
    )
  );

DO $accounting_period_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_periods" FROM %I', read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_periods" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_periods" FROM %I', write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_periods" TO %I', write_role);
    -- Only the columns a close moves. The window is not among them, so the
    -- column grant refuses to re-cut a period even before the guard speaks.
    EXECUTE format(
      'GRANT UPDATE ("status", "closingStartedAt", "closedAt", '
      || '"closedByMembershipId", "updatedAt", "version") '
      || 'ON public."accounting_periods" TO %I',
      write_role);
    -- A deleted period is a period that never existed, and the documents inside
    -- it become unattributable to any close.
    EXECUTE format(
      'REVOKE DELETE ON public."accounting_periods" FROM %I', write_role);
  END IF;
END
$accounting_period_grants$;
