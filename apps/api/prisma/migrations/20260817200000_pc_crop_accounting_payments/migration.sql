-- CreateTable
CREATE TABLE "accounting_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "counterpartyOrgId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountKopecks" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "paidAt" TIMESTAMPTZ(6) NOT NULL,
    "bankOperationId" TEXT NOT NULL,
    "recordedByMembershipId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_payment_allocations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "documentVersionId" TEXT,
    "dealServiceId" TEXT,
    "amountKopecks" BIGINT NOT NULL,
    "allocatedAt" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "allocatedByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_payments_idempotencyKey_key" ON "accounting_payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "accounting_payments_organizationId_dealId_paidAt_idx" ON "accounting_payments"("organizationId", "dealId", "paidAt");

-- CreateIndex
CREATE INDEX "accounting_payments_tenantId_idx" ON "accounting_payments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_payments_organizationId_bankOperationId_key" ON "accounting_payments"("organizationId", "bankOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_payment_allocations_idempotencyKey_key" ON "accounting_payment_allocations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "accounting_payment_allocations_paymentId_idx" ON "accounting_payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "accounting_payment_allocations_documentVersionId_idx" ON "accounting_payment_allocations"("documentVersionId");

-- CreateIndex
CREATE INDEX "accounting_payment_allocations_dealServiceId_idx" ON "accounting_payment_allocations"("dealServiceId");

-- CreateIndex
CREATE INDEX "accounting_payment_allocations_organizationId_allocatedAt_idx" ON "accounting_payment_allocations"("organizationId", "allocatedAt");

-- CreateIndex
CREATE INDEX "accounting_payment_allocations_tenantId_idx" ON "accounting_payment_allocations"("tenantId");

-- AddForeignKey
ALTER TABLE "accounting_payments" ADD CONSTRAINT "accounting_payments_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payments" ADD CONSTRAINT "accounting_payments_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payments" ADD CONSTRAINT "accounting_payments_recordedByMembershipId_organizationId_fkey" FOREIGN KEY ("recordedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payment_allocations" ADD CONSTRAINT "accounting_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "accounting_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payment_allocations" ADD CONSTRAINT "accounting_payment_allocations_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payment_allocations" ADD CONSTRAINT "accounting_payment_allocations_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "accounting_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payment_allocations" ADD CONSTRAINT "accounting_payment_allocations_dealServiceId_fkey" FOREIGN KEY ("dealServiceId") REFERENCES "accounting_deal_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_payment_allocations" ADD CONSTRAINT "accounting_payment_allocations_allocatedByMembershipId_org_fkey" FOREIGN KEY ("allocatedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Shape ---------------------------------------------------------------------

ALTER TABLE public."accounting_payments"
  ADD CONSTRAINT accounting_payments_direction_known
  CHECK ("direction" IN ('INCOMING', 'OUTGOING'));

ALTER TABLE public."accounting_payments"
  ADD CONSTRAINT accounting_payments_currency_known
  CHECK ("currency" IN ('RUB', 'USD', 'EUR', 'CNY'));

-- Kopecks, above zero. A payment of nothing is a row that says money moved and
-- names none; a negative one is a payment in the other direction wearing this
-- one's clothes, and the direction column is how that is said.
ALTER TABLE public."accounting_payments"
  ADD CONSTRAINT accounting_payments_amount_is_money
  CHECK ("amountKopecks" > 0);

ALTER TABLE public."accounting_payments"
  ADD CONSTRAINT accounting_payments_evidence_is_named
  CHECK ("bankOperationId" IS NOT NULL AND btrim("bankOperationId") <> '');

ALTER TABLE public."accounting_payments"
  ADD CONSTRAINT accounting_payments_counterparty_is_other
  CHECK ("counterpartyOrgId" <> "organizationId");

ALTER TABLE public."accounting_payment_allocations"
  ADD CONSTRAINT accounting_payment_allocations_amount_is_money
  CHECK ("amountKopecks" > 0);

ALTER TABLE public."accounting_payment_allocations"
  ADD CONSTRAINT accounting_payment_allocations_reason_is_given
  CHECK ("reason" IS NOT NULL AND btrim("reason") <> '');

ALTER TABLE public."accounting_payment_allocations"
  ADD CONSTRAINT accounting_payment_allocations_key_is_given
  CHECK ("idempotencyKey" IS NOT NULL AND btrim("idempotencyKey") <> '');

-- Exactly one obligation. Neither zero — an allocation that settles nothing is
-- money vanishing from the reconciliation — nor two, which would let one sum
-- count against an invoice and a service line at the same time.
ALTER TABLE public."accounting_payment_allocations"
  ADD CONSTRAINT accounting_payment_allocations_one_target
  CHECK (num_nonnulls("documentVersionId", "dealServiceId") = 1);


-- What a payment may not become ----------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  operation RECORD;
  allocated bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'a payment is never deleted: the money moved';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- The same definer function the advance guard uses. Its name is from the
    -- slice that introduced it; what it answers is "what does the bank say
    -- about this operation", which is the question here too. A second function
    -- with the same body is a second answer waiting to disagree.
    SELECT evidence."dealId", evidence."status", evidence."amountKopecks",
           evidence."currency"
      INTO operation
      FROM public.app_pc_crop_advance_evidence(NEW."bankOperationId") evidence;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'the bank operation a payment cites does not exist: %',
        NEW."bankOperationId";
    END IF;
    IF operation."status" <> 'CONFIRMED' THEN
      RAISE EXCEPTION
        'a payment is recorded against a confirmed bank operation, not a % one',
        operation."status";
    END IF;
    IF operation."dealId" IS DISTINCT FROM NEW."dealId" THEN
      RAISE EXCEPTION 'the cited bank operation belongs to another deal';
    END IF;
    IF operation."amountKopecks" <> NEW."amountKopecks"
       OR operation."currency" <> NEW."currency" THEN
      RAISE EXCEPTION
        'a payment states the amount that actually moved: operation is % %, payment says % %',
        operation."amountKopecks", operation."currency",
        NEW."amountKopecks", NEW."currency";
    END IF;

    -- One transfer, one artefact. An advance and a payment citing the same
    -- operation would settle the same debt twice on paper while the bank moved
    -- the money once. The unique index next door says the same about two
    -- payments; this says it across the two tables, which no index can.
    IF EXISTS (
      SELECT 1 FROM public."accounting_advances" a
       WHERE a."organizationId" = NEW."organizationId"
         AND a."bankOperationId" = NEW."bankOperationId"
    ) THEN
      RAISE EXCEPTION
        'the cited bank operation is already recorded as an advance';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public."accounting_periods" p
       WHERE p."organizationId" = NEW."organizationId"
         AND p."status" = 'CLOSED'
         AND p."periodStart" <= NEW."paidAt"
         AND p."periodEnd" > NEW."paidAt"
    ) THEN
      RAISE EXCEPTION 'the accounting period this payment would fall in is closed';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE.
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'a payment never moves to another organization';
  END IF;

  IF NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."counterpartyOrgId" IS DISTINCT FROM OLD."counterpartyOrgId"
     OR NEW."direction" IS DISTINCT FROM OLD."direction"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."paidAt" IS DISTINCT FROM OLD."paidAt"
     OR NEW."bankOperationId" IS DISTINCT FROM OLD."bankOperationId"
     OR NEW."recordedByMembershipId" IS DISTINCT FROM OLD."recordedByMembershipId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" THEN
    RAISE EXCEPTION
      'the terms of a payment are settled when it is recorded; they are what the allocations were judged against';
  END IF;

  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'a payment update must advance its version';
  END IF;

  IF NEW."amountKopecks" <> OLD."amountKopecks" THEN
    SELECT COALESCE(sum("amountKopecks"), 0) INTO allocated
      FROM public."accounting_payment_allocations"
     WHERE "paymentId" = OLD."id";
    IF NEW."amountKopecks" < allocated THEN
      RAISE EXCEPTION
        'a payment cannot be reduced below the % kopecks already allocated from it',
        allocated;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_payments_guard ON public."accounting_payments";
CREATE TRIGGER accounting_payments_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public."accounting_payments"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_payment_guard();


-- The two things that must not happen: paid twice, or owed twice -------------

CREATE OR REPLACE FUNCTION public.pc_crop_payment_allocation_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  payment RECORD;
  service RECORD;
  obligation bigint;
  already bigint;
BEGIN
  -- The lock is the mechanism, not decoration. Two allocations that each read
  -- an unallocated remainder of 100 and each take 100 satisfy every CHECK on
  -- this table, because a CHECK cannot see the other transaction's row.
  SELECT "id", "organizationId", "tenantId", "amountKopecks", "currency", "dealId"
    INTO payment
    FROM public."accounting_payments"
   WHERE "id" = NEW."paymentId"
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'the payment being allocated does not exist: %', NEW."paymentId";
  END IF;
  IF payment."organizationId" <> NEW."organizationId"
     OR payment."tenantId" <> NEW."tenantId" THEN
    RAISE EXCEPTION 'an allocation stays inside the organization of its payment';
  END IF;

  SELECT COALESCE(sum("amountKopecks"), 0) INTO already
    FROM public."accounting_payment_allocations"
   WHERE "paymentId" = NEW."paymentId";

  IF already + NEW."amountKopecks" > payment."amountKopecks" THEN
    RAISE EXCEPTION
      'allocating % would take the total past the % kopecks that were paid (% already allocated)',
      NEW."amountKopecks", payment."amountKopecks", already;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public."accounting_periods" p
     WHERE p."organizationId" = NEW."organizationId"
       AND p."status" = 'CLOSED'
       AND p."periodStart" <= NEW."allocatedAt"
       AND p."periodEnd" > NEW."allocatedAt"
  ) THEN
    RAISE EXCEPTION 'the accounting period this allocation would fall in is closed';
  END IF;

  IF NEW."dealServiceId" IS NOT NULL THEN
    -- Locked as well: the obligation has its own ceiling, and two allocations
    -- against one service line race exactly the same way.
    SELECT "id", "organizationId", "tenantId", "dealId", "status", "currency",
           "amountKopecks", "reversesServiceId"
      INTO service
      FROM public."accounting_deal_services"
     WHERE "id" = NEW."dealServiceId"
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'the service line being settled does not exist: %', NEW."dealServiceId";
    END IF;
    IF service."organizationId" <> NEW."organizationId"
       OR service."tenantId" <> NEW."tenantId" THEN
      RAISE EXCEPTION 'an allocation settles an obligation of its own organization';
    END IF;
    IF service."dealId" <> payment."dealId" THEN
      RAISE EXCEPTION 'the payment and the obligation belong to different deals';
    END IF;
    IF service."status" <> 'APPROVED' THEN
      -- Paying a line nobody approved settles a charge that is not yet owed.
      RAISE EXCEPTION
        'only an approved service line is settled; this one is %', service."status";
    END IF;
    IF service."reversesServiceId" IS NOT NULL THEN
      RAISE EXCEPTION 'a reversal is not an obligation to settle';
    END IF;
    IF service."currency" <> payment."currency" THEN
      RAISE EXCEPTION
        'the payment is in % and the obligation in %',
        payment."currency", service."currency";
    END IF;
    IF EXISTS (
      SELECT 1 FROM public."accounting_deal_services" r
       WHERE r."reversesServiceId" = service."id"
         AND r."status" = 'APPROVED'
    ) THEN
      -- The charge was cancelled. Whatever is being settled, it is not this.
      RAISE EXCEPTION 'the service line being settled has been reversed';
    END IF;

    obligation := service."amountKopecks";

    SELECT COALESCE(sum("amountKopecks"), 0) INTO already
      FROM public."accounting_payment_allocations"
     WHERE "dealServiceId" = NEW."dealServiceId";

    IF already + NEW."amountKopecks" > obligation THEN
      RAISE EXCEPTION
        'allocating % would take the settled total past the % kopecks the obligation is for (% already settled)',
        NEW."amountKopecks", obligation, already;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_payment_allocations_guard
  ON public."accounting_payment_allocations";
CREATE TRIGGER accounting_payment_allocations_guard
  BEFORE INSERT ON public."accounting_payment_allocations"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_payment_allocation_guard();

CREATE OR REPLACE FUNCTION public.pc_crop_payment_allocation_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- What is left unallocated on a payment is the sum of these rows and nothing
  -- else. That only holds while they cannot be edited or removed, and it holds
  -- for everyone, including the principal that may insert them.
  RAISE EXCEPTION 'a payment allocation is append-only: % is not permitted', TG_OP;
END
$function$;

DROP TRIGGER IF EXISTS accounting_payment_allocations_append_only
  ON public."accounting_payment_allocations";
CREATE TRIGGER accounting_payment_allocations_append_only
  BEFORE UPDATE OR DELETE ON public."accounting_payment_allocations"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_payment_allocation_append_only();


-- Row level security ---------------------------------------------------------

ALTER TABLE public."accounting_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_payment_allocations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_payments_member_select ON public."accounting_payments";
CREATE POLICY accounting_payments_member_select ON public."accounting_payments"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_payments_command_insert ON public."accounting_payments";
CREATE POLICY accounting_payments_command_insert ON public."accounting_payments"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "recordedByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS accounting_payments_command_update ON public."accounting_payments";
CREATE POLICY accounting_payments_command_update ON public."accounting_payments"
  FOR UPDATE
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  )
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_payment_allocations_member_select
  ON public."accounting_payment_allocations";
CREATE POLICY accounting_payment_allocations_member_select
  ON public."accounting_payment_allocations"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_payment_allocations_command_insert
  ON public."accounting_payment_allocations";
CREATE POLICY accounting_payment_allocations_command_insert
  ON public."accounting_payment_allocations"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "allocatedByMembershipId" = public.app_pc_crop_membership_id()
  );

-- No UPDATE or DELETE policy for allocations. The append-only trigger says the
-- same thing, and saying it twice means neither a dropped trigger nor a widened
-- grant is enough on its own to edit one.


-- Privileges -----------------------------------------------------------------

DO $accounting_payment_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_payments" FROM %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_payment_allocations" FROM %I',
      read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_payments" TO %I', read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_payment_allocations" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_payments" FROM %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_payment_allocations" FROM %I',
      write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_payments" TO %I', write_role);
    -- Only the two columns a correction moves. The deal, the direction, the
    -- evidence, the currency and the time are not among them.
    EXECUTE format(
      'GRANT UPDATE ("amountKopecks", "version", "updatedAt") ON public."accounting_payments" TO %I',
      write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_payment_allocations" TO %I',
      write_role);
  END IF;
END
$accounting_payment_grants$;
