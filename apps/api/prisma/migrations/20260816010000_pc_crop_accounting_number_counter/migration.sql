-- PC-CROP federal accounting, Wave 2 sixth slice: the numbering sequence.
--
-- The previous migration made a number mandatory at issue. This provides the
-- thing that produces one.
--
-- A row, not a PostgreSQL sequence, and the difference is the whole point. A
-- sequence keeps counting through a rolled-back transaction, so an issue that
-- failed after taking a number leaves a hole where no document ever existed —
-- and to an inspection a hole in a numbered sequence is indistinguishable from
-- a document that was issued and then removed. A counter row read with
-- `SELECT … FOR UPDATE` rolls back with the transaction that took it, which is
-- what makes the sequence gapless rather than merely unique.
--
-- The column-level UPDATE grant below is enough for that lock: PostgreSQL
-- requires UPDATE on at least one column of the table for `SELECT … FOR
-- UPDATE`, so the principal can serialise on the counter without being able to
-- rewrite the scheme it encodes. That is measured in the gate rather than
-- assumed, because the alternative reading — that row locking needs a
-- table-wide grant — would have quietly widened this principal.
--
-- Two things the guard refuses outright. The counter never moves backwards,
-- because a lower ordinal re-issues a number that is already on somebody
-- else's paper. And once a sequence has issued anything its scheme is fixed:
-- changing the prefix or the padding mid-sequence produces a differently
-- shaped number inside one run, which reads as two sequences interleaved. An
-- organization that wants a new scheme starts a new period row, which under an
-- annual reset is what the next January does anyway.

-- CreateTable
CREATE TABLE "accounting_number_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "lastOrdinal" INTEGER NOT NULL DEFAULT 0,
    "prefix" TEXT NOT NULL DEFAULT '',
    "resetPolicy" TEXT NOT NULL DEFAULT 'ANNUAL',
    "padding" INTEGER NOT NULL DEFAULT 6,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_number_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_number_counters_tenantId_idx" ON "accounting_number_counters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_number_counters_organizationId_documentType_peri_key" ON "accounting_number_counters"("organizationId", "documentType", "periodYear");

-- AddForeignKey
ALTER TABLE "accounting_number_counters" ADD CONSTRAINT "accounting_number_counters_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints ---------------------------------------------------------------

ALTER TABLE public."accounting_number_counters"
  DROP CONSTRAINT IF EXISTS accounting_number_counters_last_ordinal_check;
ALTER TABLE public."accounting_number_counters"
  ADD CONSTRAINT accounting_number_counters_last_ordinal_check
  CHECK ("lastOrdinal" >= 0);

ALTER TABLE public."accounting_number_counters"
  DROP CONSTRAINT IF EXISTS accounting_number_counters_padding_check;
ALTER TABLE public."accounting_number_counters"
  ADD CONSTRAINT accounting_number_counters_padding_check
  CHECK ("padding" BETWEEN 1 AND 12);

ALTER TABLE public."accounting_number_counters"
  DROP CONSTRAINT IF EXISTS accounting_number_counters_reset_policy_check;
ALTER TABLE public."accounting_number_counters"
  ADD CONSTRAINT accounting_number_counters_reset_policy_check
  CHECK ("resetPolicy" IN ('ANNUAL', 'NEVER'));

-- A continuous sequence has no year to live in, and an annual one cannot live
-- in year zero. Keeping the two shapes apart in the key is what stops a
-- scheme change from silently merging two sequences into one row.
ALTER TABLE public."accounting_number_counters"
  DROP CONSTRAINT IF EXISTS accounting_number_counters_period_shape_check;
ALTER TABLE public."accounting_number_counters"
  ADD CONSTRAINT accounting_number_counters_period_shape_check
  CHECK (
    ("resetPolicy" = 'NEVER' AND "periodYear" = 0)
    OR ("resetPolicy" = 'ANNUAL' AND "periodYear" BETWEEN 2000 AND 2999)
  );

-- Immutability -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_accounting_counter_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."lastOrdinal" < OLD."lastOrdinal" THEN
    RAISE EXCEPTION 'a document number counter never goes backwards';
  END IF;
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."documentType" IS DISTINCT FROM OLD."documentType"
     OR NEW."periodYear" IS DISTINCT FROM OLD."periodYear" THEN
    RAISE EXCEPTION 'a document number counter never changes which sequence it counts';
  END IF;
  -- Before the first issue the scheme is still a setting. After it, it is the
  -- shape of numbers that already exist.
  IF OLD."lastOrdinal" > 0 AND (
       NEW."prefix" IS DISTINCT FROM OLD."prefix"
       OR NEW."resetPolicy" IS DISTINCT FROM OLD."resetPolicy"
       OR NEW."padding" IS DISTINCT FROM OLD."padding"
     ) THEN
    RAISE EXCEPTION 'the numbering scheme is fixed once the sequence has issued a number';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_number_counters_guard
  ON public."accounting_number_counters";
CREATE TRIGGER accounting_number_counters_guard
  BEFORE UPDATE ON public."accounting_number_counters"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_accounting_counter_guard();

-- Row level security --------------------------------------------------------

ALTER TABLE public."accounting_number_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_number_counters" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_number_counters_member_select ON public."accounting_number_counters";
CREATE POLICY accounting_number_counters_member_select ON public."accounting_number_counters"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_number_counters_command_insert ON public."accounting_number_counters";
CREATE POLICY accounting_number_counters_command_insert ON public."accounting_number_counters"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_number_counters_command_update ON public."accounting_number_counters";
CREATE POLICY accounting_number_counters_command_update ON public."accounting_number_counters"
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

DO $accounting_counter_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_number_counters" FROM %I', read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_number_counters" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_number_counters" FROM %I', write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_number_counters" TO %I', write_role);
    -- Taking a number is the only update. The prefix, the reset policy and the
    -- padding are settings the runtime reads and never writes, so a compromised
    -- call site cannot reshape a live sequence even before the guard sees it.
    EXECUTE format(
      'GRANT UPDATE ("lastOrdinal", "updatedAt", "version") ON public."accounting_number_counters" TO %I',
      write_role);
    -- Deleting a counter restarts a sequence at one, re-issuing numbers that
    -- are already on paper. A retired sequence is simply never advanced again.
    EXECUTE format(
      'REVOKE DELETE ON public."accounting_number_counters" FROM %I', write_role);
  END IF;
END
$accounting_counter_grants$;
