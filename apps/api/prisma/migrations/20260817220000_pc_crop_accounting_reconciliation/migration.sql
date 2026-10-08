-- CreateTable
CREATE TABLE "accounting_reconciliations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "counterpartyOrgId" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "openingBalanceKopecks" BIGINT NOT NULL,
    "chargedKopecks" BIGINT NOT NULL,
    "reversedKopecks" BIGINT NOT NULL DEFAULT 0,
    "paidKopecks" BIGINT NOT NULL,
    "advanceAppliedKopecks" BIGINT NOT NULL,
    "closingBalanceKopecks" BIGINT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "preparedByMembershipId" TEXT NOT NULL,
    "respondedAt" TIMESTAMPTZ(6),
    "respondedByMembershipId" TEXT,
    "responseNote" TEXT,
    "version" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_reconciliations_organizationId_dealId_periodStar_idx" ON "accounting_reconciliations"("organizationId", "dealId", "periodStart");

-- CreateIndex
CREATE INDEX "accounting_reconciliations_tenantId_idx" ON "accounting_reconciliations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_reconciliations_organizationId_dealId_counterpar_key" ON "accounting_reconciliations"("organizationId", "dealId", "counterpartyOrgId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_organizationId_tenantId_fkey" FOREIGN KEY ("organizationId", "tenantId") REFERENCES "organizations"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_preparedByMembershipId_organiza_fkey" FOREIGN KEY ("preparedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_reconciliations" ADD CONSTRAINT "accounting_reconciliations_respondedByMembershipId_organiz_fkey" FOREIGN KEY ("respondedByMembershipId", "organizationId") REFERENCES "user_orgs"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;



-- Shape ---------------------------------------------------------------------

ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_status_known
  CHECK ("status" IN ('PREPARED', 'AGREED', 'DISPUTED'));

ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_currency_known
  CHECK ("currency" IN ('RUB', 'USD', 'EUR', 'CNY'));

ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_window_is_a_window
  CHECK ("periodEnd" > "periodStart");

ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_counterparty_is_other
  CHECK ("counterpartyOrgId" <> "organizationId");

-- The three flows are quantities of money that moved one way; a negative one
-- would be the other way, which the figure it belongs to does not express. The
-- two balances are unconstrained in sign on purpose: either party can be the
-- one in credit.
ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_flows_are_not_negative
  CHECK (
    "chargedKopecks" >= 0
    AND "reversedKopecks" >= 0
    AND "paidKopecks" >= 0
    AND "advanceAppliedKopecks" >= 0
  );

-- The one that matters. A statement is sent to a counterparty and compared
-- against their books; a bottom line that does not follow from the figures
-- above it is the disagreement nobody can resolve, because the two sides are
-- not even arguing about the same arithmetic.
ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_closing_follows_figures
  CHECK (
    "closingBalanceKopecks" = "openingBalanceKopecks" + "chargedKopecks"
      - "reversedKopecks" - "paidKopecks" - "advanceAppliedKopecks"
  );

ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_hash_is_given
  CHECK ("payloadHash" IS NOT NULL AND btrim("payloadHash") <> '');

-- A response is a pair of facts or neither, and it exists only on a statement
-- that has been answered.
ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_response_is_whole
  CHECK (("respondedAt" IS NULL) = ("respondedByMembershipId" IS NULL));

ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_response_matches_status
  CHECK (
    CASE WHEN "status" = 'PREPARED'
      THEN "respondedAt" IS NULL
      ELSE "respondedAt" IS NOT NULL
    END
  );

-- The second person again: whoever prepared the statement does not also answer
-- it. Agreeing with your own arithmetic is not agreement.
ALTER TABLE public."accounting_reconciliations"
  ADD CONSTRAINT accounting_reconciliations_response_is_second_person
  CHECK (
    "respondedByMembershipId" IS NULL
    OR "respondedByMembershipId" <> "preparedByMembershipId"
  );


-- What a statement may not become --------------------------------------------

CREATE OR REPLACE FUNCTION public.pc_crop_reconciliation_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  membership text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'a reconciliation statement is never deleted: it was sent to somebody';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'PREPARED' THEN
      RAISE EXCEPTION
        'a statement is prepared first and answered afterwards, not inserted as %',
        NEW."status";
    END IF;

    -- Windows do not overlap for one counterparty on one deal. Two statements
    -- covering the same days would each be right about a different subset of
    -- the same rows, and the counterparty would have two bottom lines to agree
    -- with.
    IF EXISTS (
      SELECT 1
        FROM public."accounting_reconciliations" other
       WHERE other."organizationId" = NEW."organizationId"
         AND other."dealId" = NEW."dealId"
         AND other."counterpartyOrgId" = NEW."counterpartyOrgId"
         AND other."id" <> NEW."id"
         AND other."periodStart" < NEW."periodEnd"
         AND other."periodEnd" > NEW."periodStart"
    ) THEN
      RAISE EXCEPTION
        'a reconciliation for this counterparty already covers part of that window';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE.
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'a statement never moves to another organization';
  END IF;

  IF NEW."dealId" IS DISTINCT FROM OLD."dealId"
     OR NEW."counterpartyOrgId" IS DISTINCT FROM OLD."counterpartyOrgId"
     OR NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
     OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."openingBalanceKopecks" IS DISTINCT FROM OLD."openingBalanceKopecks"
     OR NEW."chargedKopecks" IS DISTINCT FROM OLD."chargedKopecks"
     OR NEW."reversedKopecks" IS DISTINCT FROM OLD."reversedKopecks"
     OR NEW."paidKopecks" IS DISTINCT FROM OLD."paidKopecks"
     OR NEW."advanceAppliedKopecks" IS DISTINCT FROM OLD."advanceAppliedKopecks"
     OR NEW."closingBalanceKopecks" IS DISTINCT FROM OLD."closingBalanceKopecks"
     OR NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash"
     OR NEW."preparedByMembershipId" IS DISTINCT FROM OLD."preparedByMembershipId" THEN
    -- Everything the counterparty was shown. Changing any of it after the fact
    -- means the agreement on record is agreement to something else.
    RAISE EXCEPTION
      'the figures of a reconciliation are settled when it is prepared; disagree with it instead';
  END IF;

  IF NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION 'a reconciliation update must advance its version';
  END IF;

  IF OLD."status" <> 'PREPARED' THEN
    RAISE EXCEPTION
      'a % reconciliation is answered: it does not change again', OLD."status";
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    IF NEW."status" NOT IN ('AGREED', 'DISPUTED') THEN
      RAISE EXCEPTION
        'a prepared reconciliation becomes AGREED or DISPUTED, not %', NEW."status";
    END IF;

    membership := public.app_pc_crop_membership_id();
    IF membership IS NULL THEN
      RAISE EXCEPTION 'answering requires an active membership in the organization';
    END IF;
    IF membership = OLD."preparedByMembershipId" THEN
      RAISE EXCEPTION
        'the membership that prepared a reconciliation does not answer it';
    END IF;
    IF NEW."respondedByMembershipId" IS DISTINCT FROM membership THEN
      RAISE EXCEPTION 'an answer names the answering membership itself';
    END IF;
    -- Stamped here rather than accepted: an answer time the caller picks is an
    -- answer time the caller can place before the statement was even prepared.
    NEW."respondedAt" := now();
  ELSIF NEW."respondedAt" IS DISTINCT FROM OLD."respondedAt"
     OR NEW."respondedByMembershipId" IS DISTINCT FROM OLD."respondedByMembershipId" THEN
    RAISE EXCEPTION
      'the answer to a reconciliation moves only when its status does';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS accounting_reconciliations_guard
  ON public."accounting_reconciliations";
CREATE TRIGGER accounting_reconciliations_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public."accounting_reconciliations"
  FOR EACH ROW EXECUTE FUNCTION public.pc_crop_reconciliation_guard();


-- Row level security ---------------------------------------------------------

ALTER TABLE public."accounting_reconciliations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounting_reconciliations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_reconciliations_member_select
  ON public."accounting_reconciliations";
CREATE POLICY accounting_reconciliations_member_select
  ON public."accounting_reconciliations"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
  );

DROP POLICY IF EXISTS accounting_reconciliations_command_insert
  ON public."accounting_reconciliations";
CREATE POLICY accounting_reconciliations_command_insert
  ON public."accounting_reconciliations"
  FOR INSERT
  WITH CHECK (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND "preparedByMembershipId" = public.app_pc_crop_membership_id()
  );

DROP POLICY IF EXISTS accounting_reconciliations_command_update
  ON public."accounting_reconciliations";
CREATE POLICY accounting_reconciliations_command_update
  ON public."accounting_reconciliations"
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


-- Privileges -----------------------------------------------------------------

DO $accounting_reconciliation_grants$
DECLARE
  read_role text := 'pc_accounting_authority';
  write_role text := 'pc_accounting_command_authority';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = read_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', read_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_reconciliations" FROM %I',
      read_role);
    EXECUTE format(
      'GRANT SELECT ON public."accounting_reconciliations" TO %I', read_role);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = write_role) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', write_role);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON public."accounting_reconciliations" FROM %I',
      write_role);
    EXECUTE format(
      'GRANT INSERT, SELECT ON public."accounting_reconciliations" TO %I',
      write_role);
    -- The answer and nothing else. Not one figure is in the column grant, so a
    -- widened trigger would still not make a statement rewritable.
    EXECUTE format(
      'GRANT UPDATE ("status", "respondedAt", "respondedByMembershipId", "responseNote", "version", "updatedAt") ON public."accounting_reconciliations" TO %I',
      write_role);
  END IF;
END
$accounting_reconciliation_grants$;
