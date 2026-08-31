-- CreateTable
CREATE TABLE "accounting_deal_services" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "counterpartyOrgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityMilliUnits" BIGINT NOT NULL,
    "tonnageMilliTons" BIGINT,
    "periodFrom" TIMESTAMPTZ(6),
    "periodTo" TIMESTAMPTZ(6),
    "rateKopecks" BIGINT NOT NULL,
    "amountKopecks" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "renderedAt" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RENDERED',
    "recordedByMembershipId" TEXT NOT NULL,
    "approvedAt" TIMESTAMPTZ(6),
    "approvedByMembershipId" TEXT,
    "documentVersionId" TEXT,
    "reversesServiceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_deal_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_deal_services_reversesServiceId_key" ON "accounting_deal_services"("reversesServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_deal_services_idempotencyKey_key" ON "accounting_deal_services"("idempotencyKey");

-- CreateIndex
CREATE INDEX "accounting_deal_services_organizationId_dealId_renderedAt_idx" ON "accounting_deal_services"("organizationId", "dealId", "renderedAt");

-- CreateIndex
CREATE INDEX "accounting_deal_services_organizationId_status_renderedAt_idx" ON "accounting_deal_services"("organizationId", "status", "renderedAt");

-- CreateIndex
CREATE INDEX "accounting_deal_services_tenantId_idx" ON "accounting_deal_services"("tenantId");

-- AddForeignKey
ALTER TABLE "accounting_deal_services" ADD CONSTRAINT "accounting_deal_services_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_deal_services" ADD CONSTRAINT "accounting_deal_services_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_deal_services" ADD CONSTRAINT "accounting_deal_services_recordedByMembershipId_organizati_fkey" FOREIGN KEY ("recordedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_deal_services" ADD CONSTRAINT "accounting_deal_services_approvedByMembershipId_organizati_fkey" FOREIGN KEY ("approvedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_deal_services" ADD CONSTRAINT "accounting_deal_services_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "accounting_document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_deal_services" ADD CONSTRAINT "accounting_deal_services_reversesServiceId_fkey" FOREIGN KEY ("reversesServiceId") REFERENCES "accounting_deal_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Shape ---------------------------------------------------------------------

-- The vocabulary. Spelled out rather than left to the application, because a
-- kind the database does not know is a line no report can group.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_kind_known
  CHECK ("kind" IN (
    'STORAGE', 'DRYING', 'CLEANING', 'TRANSSHIPMENT', 'WEIGHING', 'LOADING'));

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_unit_known
  CHECK ("unit" IN ('TON_DAY', 'TON', 'OPERATION'));

-- The unit is not an independent choice. Storage is charged per ton-day,
-- handling per ton, and weighing per operation; a line that pairs a kind with
-- another unit prices something nobody agreed to.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_unit_follows_kind
  CHECK ("unit" = CASE "kind"
    WHEN 'STORAGE' THEN 'TON_DAY'
    WHEN 'DRYING' THEN 'TON'
    WHEN 'CLEANING' THEN 'TON'
    WHEN 'TRANSSHIPMENT' THEN 'TON'
    WHEN 'WEIGHING' THEN 'OPERATION'
    WHEN 'LOADING' THEN 'OPERATION'
  END);

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_status_known
  CHECK ("status" IN ('RENDERED', 'APPROVED', 'REJECTED'));

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_currency_known
  CHECK ("currency" IN ('RUB', 'USD', 'EUR', 'CNY'));

-- Zero quantity is not a service, and a negative one is a correction wearing a
-- service's clothes. The upper bounds are not decoration: the amount check
-- below multiplies these two, and a bigint product overflows above roughly
-- 9.2e18. Bounded at 1e10 and 1e8 the product cannot reach it, so the check
-- refuses an implausible line instead of raising an arithmetic error whose
-- message tells nobody what was wrong.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_quantity_is_positive
  CHECK ("quantityMilliUnits" > 0 AND "quantityMilliUnits" <= 10000000000);

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_rate_is_positive
  CHECK ("rateKopecks" > 0 AND "rateKopecks" <= 100000000);

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_amount_is_money
  CHECK ("amountKopecks" > 0);

-- The amount follows from the line's own terms, half up. Written as integer
-- arithmetic on purpose: rounding a service charge through a floating point
-- multiplication is how two parties end up with totals a kopeck apart and no
-- way to say which is right.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_amount_follows_terms
  CHECK ("amountKopecks" = ("quantityMilliUnits" * "rateKopecks" + 500) / 1000);

-- A service to oneself is not a service anybody owes for.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_counterparty_is_other
  CHECK ("counterpartyOrgId" <> "organizationId");

-- Storage carries a window and a tonnage; everything else carries neither. Two
-- separate constraints rather than one, so the refusal says which half is wrong.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_window_belongs_to_storage
  CHECK (
    CASE WHEN "unit" = 'TON_DAY'
      THEN "periodFrom" IS NOT NULL AND "periodTo" IS NOT NULL
      ELSE "periodFrom" IS NULL AND "periodTo" IS NULL
    END
  );

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_tonnage_belongs_to_storage
  CHECK (
    CASE WHEN "unit" = 'TON_DAY'
      THEN "tonnageMilliTons" IS NOT NULL AND "tonnageMilliTons" > 0
      ELSE "tonnageMilliTons" IS NULL
    END
  );

-- Whole days, at least one. A window subtraction on timestamptz yields an exact
-- interval, so a day here is exactly 86400 seconds; the contour's operating
-- jurisdiction keeps no daylight saving, and a window that is not a whole
-- number of days is refused rather than silently rounded into one.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_window_is_whole_days
  CHECK (
    "periodFrom" IS NULL
    OR (
      EXTRACT(EPOCH FROM ("periodTo" - "periodFrom"))::bigint > 0
      AND EXTRACT(EPOCH FROM ("periodTo" - "periodFrom"))::bigint % 86400 = 0
    )
  );

-- The one that matters. Ton-days are the product of what was stored and for how
-- long, and this is the arithmetic a storage charge is inflated through: the
-- same window billed for more tonnage, or the same tonnage billed for more days
-- than the window holds. Neither passes.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_ton_days_follow_window
  CHECK (
    "unit" <> 'TON_DAY'
    OR "quantityMilliUnits" = "tonnageMilliTons"
      * (EXTRACT(EPOCH FROM ("periodTo" - "periodFrom"))::bigint / 86400)
  );

-- OPERATION counts whole operations. Half a weighing is not a thing that
-- happened.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_operations_are_whole
  CHECK ("unit" <> 'OPERATION' OR "quantityMilliUnits" % 1000 = 0);

-- Approval is a pair of facts or neither of them, and the approver is never the
-- recorder. The two-person rule already governs signing authority in this
-- contour; a service line one person can both raise and approve is the same
-- hole in a cheaper place.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_approval_is_whole
  CHECK (
    ("approvedAt" IS NULL) = ("approvedByMembershipId" IS NULL)
  );

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_approval_is_second_person
  CHECK (
    "approvedByMembershipId" IS NULL
    OR "approvedByMembershipId" <> "recordedByMembershipId"
  );

-- Only an approved line carries an approval, and an approved line always does.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_approval_matches_status
  CHECK (
    CASE "status"
      WHEN 'APPROVED' THEN "approvedAt" IS NOT NULL
      ELSE "approvedAt" IS NULL
    END
  );

-- A line does not reverse itself.
ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_reversal_is_another_line
  CHECK ("reversesServiceId" IS NULL OR "reversesServiceId" <> "id");

ALTER TABLE public."accounting_deal_services"
  ADD CONSTRAINT accounting_deal_services_key_is_given
  CHECK ("idempotencyKey" IS NOT NULL AND btrim("idempotencyKey") <> '');


-- What a service line may not become ----------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_deal_service_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  original RECORD;
  membership text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- A rendered service either happened or it did not. Deleting the line
    -- leaves the money that was charged for it unexplained, and a reversal is
    -- the mechanism that says so on the record instead of off it.
    RAISE EXCEPTION 'a service line is never deleted, only reversed';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
        FROM public."accounting_periods" p
       WHERE p."organizationId" = NEW."organizationId"
         AND p."status" = 'CLOSED'
         AND p."periodStart" <= NEW."renderedAt"
         AND p."periodEnd" > NEW."renderedAt"
    ) THEN
      RAISE EXCEPTION
        'the accounting period this service would fall in is closed';
    END IF;

    IF NEW."status" <> 'RENDERED' THEN
      -- Approval is a second act by a second person. A line inserted already
      -- approved is a line that skipped them both.
      RAISE EXCEPTION
        'a service line is recorded as RENDERED and approved afterwards, not as %',
        NEW."status";
    END IF;

    IF NEW."reversesServiceId" IS NOT NULL THEN
      -- A reversal has to be a reversal *of something*, and of exactly that
      -- something. Locked because two reversals racing on one line would each
      -- see no reversal yet; the unique index would refuse the second, but the
      -- lock is what makes the check below read a settled row.
      SELECT * INTO original
        FROM public."accounting_deal_services"
       WHERE "id" = NEW."reversesServiceId"
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'the service line this reversal names does not exist: %',
          NEW."reversesServiceId";
      END IF;
      IF original."organizationId" <> NEW."organizationId"
         OR original."tenantId" <> NEW."tenantId" THEN
        RAISE EXCEPTION 'a reversal stays inside the organization it corrects';
      END IF;
      IF original."status" <> 'APPROVED' THEN
        RAISE EXCEPTION
          'only an approved service line is reversed; this one is %',
          original."status";
      END IF;
      IF original."reversesServiceId" IS NOT NULL THEN
        RAISE EXCEPTION
          'a reversal is not itself reversed: correct the original instead';
      END IF;
      IF original."dealId" <> NEW."dealId"
         OR original."counterpartyOrgId" <> NEW."counterpartyOrgId"
         OR original."kind" <> NEW."kind"
         OR original."unit" <> NEW."unit"
         OR original."currency" <> NEW."currency"
         OR original."quantityMilliUnits" <> NEW."quantityMilliUnits"
         OR original."rateKopecks" <> NEW."rateKopecks"
         OR original."amountKopecks" <> NEW."amountKopecks" THEN
        -- A reversal that does not match cancels part of a charge and invents
        -- the rest, which is a repricing with a correction's paperwork.
        RAISE EXCEPTION
          'a reversal states the same deal, kind, unit, currency, quantity, rate and amount as the line it reverses';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE from here down.

  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'a service line never moves to another organization';
  END IF;

  IF NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."counterpartyOrgId" IS DISTINCT FROM OLD."counterpartyOrgId"
     OR NEW."kind" IS DISTINCT FROM OLD."kind"
     OR NEW."unit" IS DISTINCT FROM OLD."unit"
     OR NEW."quantityMilliUnits" IS DISTINCT FROM OLD."quantityMilliUnits"
     OR NEW."tonnageMilliTons" IS DISTINCT FROM OLD."tonnageMilliTons"
     OR NEW."periodFrom" IS DISTINCT FROM OLD."periodFrom"
     OR NEW."periodTo" IS DISTINCT FROM OLD."periodTo"
     OR NEW."rateKopecks" IS DISTINCT FROM OLD."rateKopecks"
     OR NEW."amountKopecks" IS DISTINCT FROM OLD."amountKopecks"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."renderedAt" IS DISTINCT FROM OLD."renderedAt"
     OR NEW."recordedByMembershipId" IS DISTINCT FROM OLD."recordedByMembershipId"
     OR NEW."reversesServiceId" IS DISTINCT FROM OLD."reversesServiceId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" THEN
    -- Everything a person or a report reads as the priced fact. The column
    -- grants say the same thing, and saying it twice means neither a widened
    -- grant nor a dropped trigger is enough on its own to reprice a line.
    RAISE EXCEPTION
      'the terms of a service line are settled when it is recorded; correct it with a reversal';
  END IF;

  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'a service line update must advance its version';
  END IF;

  IF OLD."status" <> 'RENDERED' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
       OR NEW."approvedByMembershipId" IS DISTINCT FROM OLD."approvedByMembershipId" THEN
      RAISE EXCEPTION
        'a % service line is final: it does not become %',
        OLD."status", NEW."status";
    END IF;
    IF NEW."documentVersionId" IS NOT DISTINCT FROM OLD."documentVersionId" THEN
      -- Measured, not assumed: re-approving an approved line changes none of the
      -- three columns above, so every check that looked at what moved found
      -- nothing amiss and the update passed while bumping the version. A second
      -- approval that reports success is a second approval somebody will count.
      -- The only change a decided line admits is being bound to an act.
      RAISE EXCEPTION
        'a % service line is decided: the only change it admits is being bound to an act',
        OLD."status";
    END IF;
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NEW."status" NOT IN ('APPROVED', 'REJECTED') THEN
      RAISE EXCEPTION 'a rendered service line becomes APPROVED or REJECTED, not %',
        NEW."status";
    END IF;

    IF NEW."status" = 'APPROVED' THEN
      membership := public.app_pc_crop_membership_id();
      IF membership IS NULL THEN
        RAISE EXCEPTION 'approval requires an active membership in the organization';
      END IF;
      IF membership = OLD."recordedByMembershipId" THEN
        RAISE EXCEPTION
          'the membership that recorded a service line does not approve it';
      END IF;
      IF NEW."approvedByMembershipId" IS DISTINCT FROM membership THEN
        -- The approver is who the session is, not who the command says. A
        -- caller-supplied approver is an attribution anybody can forge.
        RAISE EXCEPTION 'an approval names the approving membership itself';
      END IF;
      -- Stamped here rather than accepted: an approval time the caller picks is
      -- an approval time the caller can antedate into an open period.
      NEW."approvedAt" := now();

      IF EXISTS (
        SELECT 1
          FROM public."accounting_periods" p
         WHERE p."organizationId" = NEW."organizationId"
           AND p."status" = 'CLOSED'
           AND p."periodStart" <= NEW."renderedAt"
           AND p."periodEnd" > NEW."renderedAt"
      ) THEN
        -- Approving into a closed month changes a figure that was already
        -- reported as final.
        RAISE EXCEPTION
          'the accounting period this service falls in is closed';
      END IF;
    ELSE
      IF NEW."approvedAt" IS NOT NULL
         OR NEW."approvedByMembershipId" IS NOT NULL THEN
        RAISE EXCEPTION 'a rejected service line carries no approval';
      END IF;
    END IF;
  ELSIF NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
     OR NEW."approvedByMembershipId" IS DISTINCT FROM OLD."approvedByMembershipId" THEN
    RAISE EXCEPTION
      'the approval of a service line moves only when its status does';
  END IF;

  IF NEW."documentVersionId" IS DISTINCT FROM OLD."documentVersionId" THEN
    IF OLD."documentVersionId" IS NOT NULL THEN
      -- The act has been issued with this line in it. Re-pointing the line at
      -- another act leaves the issued one describing something else.
      RAISE EXCEPTION
        'a service line already bound to an act is not rebound';
    END IF;
    IF NEW."status" <> 'APPROVED' THEN
      RAISE EXCEPTION
        'only an approved service line goes into an act; this one is %',
        NEW."status";
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_deal_services_guard
  ON public."accounting_deal_services";
CREATE TRIGGER accounting_deal_services_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public."accounting_deal_services"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_deal_service_guard();


-- Row level security --------------------------------------------------------

ALTER TABLE public."accounting_deal_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_deal_services" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_deal_services_member_select
  ON public."accounting_deal_services";
CREATE POLICY accounting_deal_services_member_select
  ON public."accounting_deal_services"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_deal_services_command_insert
  ON public."accounting_deal_services";
CREATE POLICY accounting_deal_services_command_insert
  ON public."accounting_deal_services"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    -- Who rendered the paperwork is not a field the caller may attribute to
    -- somebody else, and the two-person rule is only worth having if the first
    -- of the two names cannot be forged.
    AND "recordedByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS accounting_deal_services_command_update
  ON public."accounting_deal_services";
CREATE POLICY accounting_deal_services_command_update
  ON public."accounting_deal_services"
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

-- No DELETE policy, to anybody. The trigger refuses the operation as well; the
-- missing policy means a widened grant is still not enough on its own.


-- Privileges ----------------------------------------------------------------

DO $accounting_deal_service_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_deal_services" FROM %I',
      read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_deal_services" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_deal_services" FROM %I',
      write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_deal_services" TO %I',
      write_role);
    -- The five columns a lifecycle moves, and not one of the priced terms. The
    -- grant refuses to reprice a line before the trigger is even reached, which
    -- matters because a privilege boundary holds even where a trigger was
    -- dropped.
    EXECUTE format(
      'GRANT UPDATE ("status", "approvedAt", "approvedByMembershipId", "documentVersionId", "version", "updatedAt") ON public."accounting_deal_services" TO %I',
      write_role);
  END IF;
END
$accounting_deal_service_grants$;
