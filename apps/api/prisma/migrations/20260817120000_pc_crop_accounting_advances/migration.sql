-- CreateTable
CREATE TABLE "accounting_advances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "counterpartyOrgId" TEXT NOT NULL,
    "amountKopecks" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "receivedAt" TIMESTAMPTZ(6) NOT NULL,
    "bankOperationId" TEXT NOT NULL,
    "recordedByMembershipId" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_advance_offsets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "amountKopecks" BIGINT NOT NULL,
    "appliedAt" TIMESTAMPTZ(6) NOT NULL,
    "documentVersionId" TEXT,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "appliedByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_advance_offsets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_advances_organizationId_dealId_receivedAt_idx" ON "accounting_advances"("organizationId", "dealId", "receivedAt");

-- CreateIndex
CREATE INDEX "accounting_advances_tenantId_idx" ON "accounting_advances"("tenantId");

-- CreateIndex
CREATE INDEX "accounting_advances_bankOperationId_idx" ON "accounting_advances"("bankOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_advance_offsets_idempotencyKey_key" ON "accounting_advance_offsets"("idempotencyKey");

-- CreateIndex
CREATE INDEX "accounting_advance_offsets_advanceId_idx" ON "accounting_advance_offsets"("advanceId");

-- CreateIndex
CREATE INDEX "accounting_advance_offsets_organizationId_appliedAt_idx" ON "accounting_advance_offsets"("organizationId", "appliedAt");

-- CreateIndex
CREATE INDEX "accounting_advance_offsets_tenantId_idx" ON "accounting_advance_offsets"("tenantId");

-- AddForeignKey
ALTER TABLE "accounting_advances" ADD CONSTRAINT "accounting_advances_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_advances" ADD CONSTRAINT "accounting_advances_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_advances" ADD CONSTRAINT "accounting_advances_recordedByMembershipId_organizationId_fkey" FOREIGN KEY ("recordedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_advance_offsets" ADD CONSTRAINT "accounting_advance_offsets_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "accounting_advances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_advance_offsets" ADD CONSTRAINT "accounting_advance_offsets_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_advance_offsets" ADD CONSTRAINT "accounting_advance_offsets_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "accounting_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_advance_offsets" ADD CONSTRAINT "accounting_advance_offsets_appliedByMembershipId_organizat_fkey" FOREIGN KEY ("appliedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shape ---------------------------------------------------------------------

-- Kopecks, and above zero. A zero advance is a row that says money arrived and
-- names none; a negative one is a refund wearing an advance's clothes.
ALTER TABLE public."accounting_advances"
  ADD CONSTRAINT accounting_advances_amount_is_money
  CHECK ("amountKopecks" > 0);

ALTER TABLE public."accounting_advances"
  ADD CONSTRAINT accounting_advances_currency_known
  CHECK ("currency" IN ('RUB', 'USD', 'EUR', 'CNY'));

-- The bank operation is the evidence. A blank reference is not a reference, and
-- btrim(NULL) would be NULL, which a CHECK admits — hence the explicit NOT NULL
-- even though the column already declares it.
ALTER TABLE public."accounting_advances"
  ADD CONSTRAINT accounting_advances_evidence_is_named
  CHECK ("bankOperationId" IS NOT NULL AND btrim("bankOperationId") <> '');

ALTER TABLE public."accounting_advances"
  ADD CONSTRAINT accounting_advances_counterparty_is_named
  CHECK ("counterpartyOrgId" IS NOT NULL AND btrim("counterpartyOrgId") <> '');

-- An advance from an organization to itself is not an advance.
ALTER TABLE public."accounting_advances"
  ADD CONSTRAINT accounting_advances_counterparty_is_other
  CHECK ("counterpartyOrgId" <> "organizationId");

ALTER TABLE public."accounting_advance_offsets"
  ADD CONSTRAINT accounting_advance_offsets_amount_is_money
  CHECK ("amountKopecks" > 0);

ALTER TABLE public."accounting_advance_offsets"
  ADD CONSTRAINT accounting_advance_offsets_reason_is_given
  CHECK ("reason" IS NOT NULL AND btrim("reason") <> '');

ALTER TABLE public."accounting_advance_offsets"
  ADD CONSTRAINT accounting_advance_offsets_key_is_given
  CHECK ("idempotencyKey" IS NOT NULL AND btrim("idempotencyKey") <> '');


-- Reading the evidence, without handing over the bank ledger ----------------

-- The guard below runs as whoever inserts the row, and that is the confined
-- pc_accounting_command_authority, which has no privilege on bank_operations —
-- correctly, because an accounting principal that can read every bank operation
-- in the platform is a wider principal than the contour needs. Measured before
-- this function existed: the guard failed with "permission denied for table
-- bank_operations", so the evidence check could not run for the very principal
-- meant to run it.
--
-- The narrow answer is a definer function returning only the four fields the
-- check consults for one operation, rather than a SELECT grant on the table.
CREATE OR REPLACE FUNCTION public.app_pc_crop_advance_evidence(operation_id text)
RETURNS TABLE ("dealId" text, "status" text, "amountKopecks" bigint, "currency" text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT operation."dealId", operation."status", operation."amountKopecks",
         operation."currency"
    FROM public."bank_operations" operation
   WHERE operation."id" = operation_id;
$function$;

DO $advance_evidence_owner$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_identity_bootstrap') THEN
    ALTER FUNCTION public.app_pc_crop_advance_evidence(text)
      OWNER TO pc_identity_bootstrap;
    -- Named explicitly rather than left implicit: a future narrowing of this
    -- grant would otherwise break the advance contour at a distance, and the
    -- four columns here are exactly what the guard consults.
    GRANT SELECT ("id", "dealId", "status", "amountKopecks", "currency")
      ON public."bank_operations" TO pc_identity_bootstrap;
  END IF;
END
$advance_evidence_owner$;

-- Not PUBLIC. The identity resolver next door may be executed by anybody
-- because it takes no argument and answers only about the caller's own session;
-- this one takes an operation id and answers about the bank ledger, so an open
-- EXECUTE would let any principal that can connect — including read-only
-- principals of other contours — probe an operation by id through a definer
-- that runs with the bootstrap role's privilege. Only the principal whose
-- trigger needs the answer gets it. The table owner keeps EXECUTE by ownership.
REVOKE ALL ON FUNCTION public.app_pc_crop_advance_evidence(text) FROM PUBLIC;
DO $advance_evidence_execute$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
     WHERE rolname = 'pc_accounting_command_authority'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.app_pc_crop_advance_evidence(text)
      TO pc_accounting_command_authority;
  END IF;
END
$advance_evidence_execute$;


-- What an advance may not become --------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_advance_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  applied bigint;
  operation RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Evidence has to be evidence of this organization's money, confirmed, and
    -- for the same deal and amount. Any of those loose and the advance becomes
    -- a number attached to an unrelated transfer.
    SELECT evidence."dealId", evidence."status", evidence."amountKopecks",
           evidence."currency"
      INTO operation
      FROM public.app_pc_crop_advance_evidence(NEW."bankOperationId") evidence;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'the bank operation an advance cites does not exist: %', NEW."bankOperationId";
    END IF;
    IF operation."status" <> 'CONFIRMED' THEN
      RAISE EXCEPTION
        'an advance is recorded against a confirmed bank operation, not a % one',
        operation."status";
    END IF;
    IF operation."dealId" IS DISTINCT FROM NEW."dealId" THEN
      RAISE EXCEPTION 'the cited bank operation belongs to another deal';
    END IF;
    IF operation."amountKopecks" <> NEW."amountKopecks"
       OR operation."currency" <> NEW."currency" THEN
      RAISE EXCEPTION
        'an advance states the amount that actually arrived: operation is % %, advance says % %',
        operation."amountKopecks", operation."currency",
        NEW."amountKopecks", NEW."currency";
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public."accounting_periods" p
       WHERE p."organizationId" = NEW."organizationId"
         AND p."status" = 'CLOSED'
         AND p."periodStart" <= NEW."receivedAt"
         AND p."periodEnd" > NEW."receivedAt"
    ) THEN
      RAISE EXCEPTION
        'the accounting period this advance would fall in is closed';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'an advance never moves to another organization';
  END IF;

  IF NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."bankOperationId" IS DISTINCT FROM OLD."bankOperationId"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."receivedAt" IS DISTINCT FROM OLD."receivedAt" THEN
    -- These four are what the offsets were judged against. Changing any of them
    -- after the fact rewrites the meaning of rows that already exist.
    RAISE EXCEPTION
      'the deal, evidence, currency and arrival time of an advance are settled once recorded';
  END IF;

  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'an advance update must advance its version';
  END IF;

  IF NEW."amountKopecks" <> OLD."amountKopecks" THEN
    SELECT COALESCE(sum("amountKopecks"), 0) INTO applied
      FROM public."accounting_advance_offsets"
     WHERE "advanceId" = OLD."id";
    IF NEW."amountKopecks" < applied THEN
      RAISE EXCEPTION
        'an advance cannot be reduced below the % kopecks already offset against it',
        applied;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_advances_guard ON public."accounting_advances";
CREATE TRIGGER accounting_advances_guard
  BEFORE INSERT OR UPDATE ON public."accounting_advances"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_advance_guard();


-- The one thing that must not happen: the same advance spent twice ----------

CREATE OR REPLACE FUNCTION public.pc_crop_advance_offset_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  advance RECORD;
  already bigint;
BEGIN
  -- The row lock is the mechanism, not decoration. Two offsets that each read a
  -- remaining balance of 100 and each apply 100 both satisfy every CHECK on
  -- this table, because a CHECK cannot see the other row. Taking the advance
  -- FOR UPDATE makes the second transaction wait until the first is counted,
  -- which is the difference between a rule and a hope.
  SELECT "id", "organizationId", "tenantId", "amountKopecks"
    INTO advance
    FROM public."accounting_advances"
   WHERE "id" = NEW."advanceId"
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'the advance being offset does not exist: %', NEW."advanceId";
  END IF;

  IF advance."organizationId" <> NEW."organizationId"
     OR advance."tenantId" <> NEW."tenantId" THEN
    RAISE EXCEPTION
      'an offset belongs to the same organization and tenant as its advance';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public."accounting_periods" p
     WHERE p."organizationId" = NEW."organizationId"
       AND p."status" = 'CLOSED'
       AND p."periodStart" <= NEW."appliedAt"
       AND p."periodEnd" > NEW."appliedAt"
  ) THEN
    RAISE EXCEPTION
      'the accounting period this offset would fall in is closed';
  END IF;

  IF NEW."documentVersionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public."accounting_document_versions" v
     WHERE v."id" = NEW."documentVersionId"
       AND v."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION
      'an offset points at a document version of its own organization or at none';
  END IF;

  SELECT COALESCE(sum("amountKopecks"), 0) INTO already
    FROM public."accounting_advance_offsets"
   WHERE "advanceId" = NEW."advanceId";

  IF already + NEW."amountKopecks" > advance."amountKopecks" THEN
    RAISE EXCEPTION
      'offsets would exceed the advance: % already applied, % requested, % received',
      already, NEW."amountKopecks", advance."amountKopecks";
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_advance_offsets_guard
  ON public."accounting_advance_offsets";
CREATE TRIGGER accounting_advance_offsets_guard
  BEFORE INSERT ON public."accounting_advance_offsets"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_advance_offset_guard();


-- Append-only ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_advance_offset_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- The remaining balance of an advance is the sum of these rows and nothing
  -- else — there is no cached total to drift. That only holds while the rows
  -- cannot be edited or removed, so this refuses both, to everyone, including
  -- the principal that may insert them.
  RAISE EXCEPTION 'an advance offset is append-only: % is not permitted', TG_OP;
END
$function$;

DROP TRIGGER IF EXISTS accounting_advance_offsets_append_only
  ON public."accounting_advance_offsets";
CREATE TRIGGER accounting_advance_offsets_append_only
  BEFORE UPDATE OR DELETE ON public."accounting_advance_offsets"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_advance_offset_append_only();


-- Row level security --------------------------------------------------------

ALTER TABLE public."accounting_advances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_advances" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_advance_offsets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_advance_offsets" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_advances_member_select ON public."accounting_advances";
CREATE POLICY accounting_advances_member_select ON public."accounting_advances"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_advances_command_insert ON public."accounting_advances";
CREATE POLICY accounting_advances_command_insert ON public."accounting_advances"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    -- Who recorded it is not a field the caller may attribute to somebody else.
    AND "recordedByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS accounting_advances_command_update ON public."accounting_advances";
CREATE POLICY accounting_advances_command_update ON public."accounting_advances"
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

DROP POLICY IF EXISTS accounting_advance_offsets_member_select
  ON public."accounting_advance_offsets";
CREATE POLICY accounting_advance_offsets_member_select
  ON public."accounting_advance_offsets"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_advance_offsets_command_insert
  ON public."accounting_advance_offsets";
CREATE POLICY accounting_advance_offsets_command_insert
  ON public."accounting_advance_offsets"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "appliedByMembershipId" = public.app_pc_crop_membership_id()
  );

-- No UPDATE or DELETE policy exists for offsets. The append-only trigger says
-- the same thing, and saying it twice means neither a dropped trigger nor a
-- widened grant is enough on its own to make an offset editable.

DO $accounting_advance_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_advances" FROM %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_advance_offsets" FROM %I',
      read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_advances" TO %I', read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_advance_offsets" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_advances" FROM %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_advance_offsets" FROM %I',
      write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_advances" TO %I', write_role);
    -- Only the two columns a correction moves. The deal, the evidence, the
    -- currency and the arrival time are not among them, so the column grant
    -- refuses to rewrite what the offsets were judged against before the guard
    -- is even reached.
    EXECUTE format(
      'GRANT UPDATE ("amountKopecks", "version", "updatedAt") ON public."accounting_advances" TO %I',
      write_role);
    -- Insert and read only: no UPDATE, no DELETE, at the privilege level as
    -- well as the trigger level.
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_advance_offsets" TO %I',
      write_role);
  END IF;
END
$accounting_advance_grants$;
