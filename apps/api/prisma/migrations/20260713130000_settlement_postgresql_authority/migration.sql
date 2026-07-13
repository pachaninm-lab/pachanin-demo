-- IR-10.4 Settlement PostgreSQL Authority.
-- Financial authority is integer-minor-unit, tenant-scoped and callback-only
-- for confirmed reserve/release/refund effects.

CREATE SCHEMA IF NOT EXISTS settlement;
REVOKE ALL ON SCHEMA settlement FROM PUBLIC;

ALTER TABLE public."payments"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "reservedKopecks" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "releasedKopecks" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pendingReleaseKopecks" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentTermsVersion" BIGINT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

UPDATE public."payments" payment
SET "tenantId" = deal."tenantId",
    "amountKopecks" = COALESCE(payment."amountKopecks", deal."totalKopecks"),
    "amountRub" = NULL
FROM public."deals" deal
WHERE deal."id" = payment."dealId";

DO $payment_backfill$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."payments"
    WHERE "tenantId" IS NULL OR "amountKopecks" IS NULL
  ) THEN
    RAISE EXCEPTION 'payment tenant/minor-unit backfill is incomplete';
  END IF;
END
$payment_backfill$;

ALTER TABLE public."payments"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL,
  ALTER COLUMN "amountKopecks" SET NOT NULL;

ALTER TABLE public."bank_operations"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "version" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "callbackEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "callbackPayloadHash" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

UPDATE public."bank_operations" operation
SET "tenantId" = deal."tenantId"
FROM public."deals" deal
WHERE deal."id" = operation."dealId" AND operation."tenantId" IS NULL;

ALTER TABLE public."bank_operations"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE public."ledger_entries"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "bankOperationId" TEXT,
  ADD COLUMN IF NOT EXISTS "auditId" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

UPDATE public."ledger_entries" entry
SET "tenantId" = deal."tenantId"
FROM public."deals" deal
WHERE deal."id" = entry."dealId" AND entry."tenantId" IS NULL;

DO $ledger_backfill$
BEGIN
  IF EXISTS (SELECT 1 FROM public."ledger_entries" WHERE "tenantId" IS NULL) THEN
    RAISE EXCEPTION 'ledger tenant backfill is incomplete';
  END IF;
END
$ledger_backfill$;

ALTER TABLE public."ledger_entries"
  ALTER COLUMN "tenantId" SET DEFAULT current_setting('app.current_tenant_id'::text, true),
  ALTER COLUMN "tenantId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS payments_tenant_deal_idx
  ON public."payments" ("tenantId", "dealId");
CREATE INDEX IF NOT EXISTS bank_operations_tenant_deal_idx
  ON public."bank_operations" ("tenantId", "dealId");
CREATE INDEX IF NOT EXISTS ledger_entries_tenant_deal_idx
  ON public."ledger_entries" ("tenantId", "dealId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS bank_operations_callback_event_key
  ON public."bank_operations" ("tenantId", "callbackEventId")
  WHERE "callbackEventId" IS NOT NULL;

ALTER TABLE public."payments" DROP CONSTRAINT IF EXISTS payments_minor_units_check;
ALTER TABLE public."payments" ADD CONSTRAINT payments_minor_units_check CHECK (
  "amountKopecks" >= 0
  AND "reservedKopecks" >= 0
  AND "releasedKopecks" >= 0
  AND "pendingReleaseKopecks" >= 0
  AND COALESCE("holdAmountKopecks", 0) >= 0
  AND COALESCE("refundedKopecks", 0) >= 0
  AND COALESCE("commissionKopecks", 0) >= 0
  AND "reservedKopecks" <= "amountKopecks"
  AND "releasedKopecks" + "pendingReleaseKopecks"
      + COALESCE("refundedKopecks", 0) + COALESCE("commissionKopecks", 0)
      <= "reservedKopecks"
  AND COALESCE("holdAmountKopecks", 0) <=
      "reservedKopecks" - "releasedKopecks" - COALESCE("refundedKopecks", 0)
);

ALTER TABLE public."bank_operations" DROP CONSTRAINT IF EXISTS bank_operations_positive_amount_check;
ALTER TABLE public."bank_operations" ADD CONSTRAINT bank_operations_positive_amount_check
  CHECK ("amountKopecks" > 0);
ALTER TABLE public."ledger_entries" DROP CONSTRAINT IF EXISTS ledger_entries_positive_amount_check;
ALTER TABLE public."ledger_entries" ADD CONSTRAINT ledger_entries_positive_amount_check
  CHECK ("amountKopecks" > 0 AND "debitAccount" <> "creditAccount");

CREATE TABLE IF NOT EXISTS settlement.payment_terms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  version BIGINT NOT NULL,
  total_kopecks BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  release_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  evidence_file_id TEXT,
  created_by_user_id TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  supersedes_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_payment_terms_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_payment_terms_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_payment_terms_supersedes_fkey
    FOREIGN KEY (supersedes_id) REFERENCES settlement.payment_terms(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_payment_terms_amount_check CHECK (total_kopecks >= 0),
  CONSTRAINT settlement_payment_terms_currency_check CHECK (currency = 'RUB'),
  CONSTRAINT settlement_payment_terms_release_model_check CHECK (
    release_model IN ('FULL_AFTER_ACCEPTANCE', 'PARTIAL_THEN_FINAL', 'EVENT_BASED')
  ),
  CONSTRAINT settlement_payment_terms_status_check CHECK (
    status IN ('ACTIVE', 'SUPERSEDED', 'LEGACY_QUARANTINED', 'REVOKED')
  ),
  CONSTRAINT settlement_payment_terms_deal_version_key UNIQUE (deal_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS settlement_payment_terms_active_key
  ON settlement.payment_terms (tenant_id, deal_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS settlement_payment_terms_lookup_idx
  ON settlement.payment_terms (tenant_id, deal_id, version DESC);

CREATE TABLE IF NOT EXISTS settlement.beneficiary_allocations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payment_terms_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  beneficiary_org_id TEXT NOT NULL,
  amount_kopecks BIGINT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  evidence_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settlement_beneficiary_terms_fkey
    FOREIGN KEY (payment_terms_id) REFERENCES settlement.payment_terms(id) ON DELETE RESTRICT,
  CONSTRAINT settlement_beneficiary_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_beneficiary_org_fkey
    FOREIGN KEY (beneficiary_org_id) REFERENCES public."organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_beneficiary_evidence_fkey
    FOREIGN KEY (evidence_file_id) REFERENCES public."deal_documents"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_beneficiary_amount_check CHECK (amount_kopecks > 0),
  CONSTRAINT settlement_beneficiary_priority_check CHECK (priority BETWEEN 1 AND 10000),
  CONSTRAINT settlement_beneficiary_status_check CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REVOKED')),
  CONSTRAINT settlement_beneficiary_terms_org_key UNIQUE (payment_terms_id, beneficiary_org_id)
);
CREATE INDEX IF NOT EXISTS settlement_beneficiary_lookup_idx
  ON settlement.beneficiary_allocations (tenant_id, deal_id, status, priority);

CREATE TABLE IF NOT EXISTS settlement.money_holds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  dispute_id TEXT,
  amount_kopecks BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  version BIGINT NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  CONSTRAINT settlement_holds_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_holds_payment_fkey
    FOREIGN KEY (payment_id) REFERENCES public."payments"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_holds_dispute_fkey
    FOREIGN KEY (dispute_id) REFERENCES public."disputes"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_holds_amount_check CHECK (amount_kopecks > 0),
  CONSTRAINT settlement_holds_status_check CHECK (status IN ('ACTIVE', 'RELEASED', 'SUPERSEDED'))
);
CREATE INDEX IF NOT EXISTS settlement_holds_lookup_idx
  ON settlement.money_holds (tenant_id, deal_id, status);

CREATE TABLE IF NOT EXISTS settlement.refund_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  bank_operation_id TEXT NOT NULL,
  amount_kopecks BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_CALLBACK',
  reason TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  correlation_id TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  CONSTRAINT settlement_refunds_deal_fkey
    FOREIGN KEY (deal_id) REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_refunds_payment_fkey
    FOREIGN KEY (payment_id) REFERENCES public."payments"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_refunds_operation_fkey
    FOREIGN KEY (bank_operation_id) REFERENCES public."bank_operations"("id") ON DELETE RESTRICT,
  CONSTRAINT settlement_refunds_amount_check CHECK (amount_kopecks > 0),
  CONSTRAINT settlement_refunds_status_check CHECK (
    status IN ('PENDING_CALLBACK', 'CONFIRMED', 'FAILED', 'CANCELLED')
  ),
  CONSTRAINT settlement_refunds_idempotency_key UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS settlement_refunds_lookup_idx
  ON settlement.refund_requests (tenant_id, deal_id, status);

-- Existing Deals are intentionally quarantined rather than promoted to an
-- ACTIVE payment basis without explicit immutable evidence.
INSERT INTO settlement.payment_terms (
  id, tenant_id, deal_id, version, total_kopecks, currency, release_model,
  status, evidence_file_id, created_by_user_id, effective_at
)
SELECT
  'legacy-terms-' || md5(deal."id"), deal."tenantId", deal."id", 0,
  COALESCE(deal."totalKopecks", 0), deal."currency", 'FULL_AFTER_ACCEPTANCE',
  'LEGACY_QUARANTINED', NULL, 'system:legacy-quarantine', deal."createdAt"
FROM public."deals" deal
WHERE deal."tenantId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM settlement.payment_terms terms WHERE terms.deal_id = deal."id"
  );

CREATE OR REPLACE FUNCTION public.app_settlement_deal_authorized(
  p_deal_id TEXT,
  p_write BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public.app_rls_context_ready()
    AND (
      public.app_rls_privileged()
      OR (
        current_setting('app.current_role', true) = 'BANK_CALLBACK'
        AND EXISTS (
          SELECT 1 FROM public."deals" deal
          WHERE deal."id" = p_deal_id
            AND deal."tenantId" = current_setting('app.current_tenant_id', true)
            AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public."deal_participants" participant
        WHERE participant."dealId" = p_deal_id
          AND participant."tenantId" = current_setting('app.current_tenant_id', true)
          AND participant."organizationId" = current_setting('app.current_org_id', true)
          AND participant."userId" = current_setting('app.current_user_id', true)
          AND participant."role" = current_setting('app.current_role', true)
          AND participant."status" = 'ACTIVE'
          AND participant."accessLevel" IN (
            CASE WHEN p_write THEN 'WORK' ELSE 'READ' END,
            CASE WHEN p_write THEN 'APPROVE' ELSE 'WORK' END,
            'APPROVE'
          )
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.app_settlement_derive_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  deal_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO deal_tenant FROM public."deals" WHERE "id" = NEW."dealId";
  IF NOT FOUND OR deal_tenant IS NULL THEN
    RAISE EXCEPTION 'settlement deal has no tenant authority' USING ERRCODE = '23514';
  END IF;
  NEW."tenantId" := deal_tenant;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.app_settlement_payment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_role TEXT := current_setting('app.current_role', true);
BEGIN
  IF NEW."amountRub" IS NOT NULL THEN
    RAISE EXCEPTION 'floating-point money authority is forbidden' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW."dealId" IS DISTINCT FROM OLD."dealId"
       OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
       OR NEW."amountKopecks" IS DISTINCT FROM OLD."amountKopecks"
       OR NEW."paymentTermsVersion" IS DISTINCT FROM OLD."paymentTermsVersion"
    THEN
      RAISE EXCEPTION 'payment basis is immutable; create a new versioned basis' USING ERRCODE = '23514';
    END IF;
    IF (
      NEW."reservedKopecks" IS DISTINCT FROM OLD."reservedKopecks"
      OR NEW."releasedKopecks" IS DISTINCT FROM OLD."releasedKopecks"
      OR NEW."refundedKopecks" IS DISTINCT FROM OLD."refundedKopecks"
      OR NEW."status" IN ('RESERVED', 'RELEASED', 'REFUNDED') AND NEW."status" IS DISTINCT FROM OLD."status"
    ) AND actor_role <> 'BANK_CALLBACK' THEN
      RAISE EXCEPTION 'confirmed money state is callback-only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS payments_derive_tenant ON public."payments";
CREATE TRIGGER payments_derive_tenant
BEFORE INSERT OR UPDATE OF "dealId", "tenantId" ON public."payments"
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_derive_tenant();
DROP TRIGGER IF EXISTS bank_operations_derive_tenant ON public."bank_operations";
CREATE TRIGGER bank_operations_derive_tenant
BEFORE INSERT OR UPDATE OF "dealId", "tenantId" ON public."bank_operations"
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_derive_tenant();
DROP TRIGGER IF EXISTS ledger_entries_derive_tenant ON public."ledger_entries";
CREATE TRIGGER ledger_entries_derive_tenant
BEFORE INSERT OR UPDATE OF "dealId", "tenantId" ON public."ledger_entries"
FOR EACH ROW WHEN (NEW."dealId" IS NOT NULL)
EXECUTE FUNCTION public.app_settlement_derive_tenant();
DROP TRIGGER IF EXISTS payments_authority_guard ON public."payments";
CREATE TRIGGER payments_authority_guard
BEFORE INSERT OR UPDATE ON public."payments"
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_payment_guard();

CREATE OR REPLACE FUNCTION public.app_settlement_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'confirmed settlement facts are append-only' USING ERRCODE = '23514';
END
$function$;

DROP TRIGGER IF EXISTS ledger_entries_append_only ON public."ledger_entries";
CREATE TRIGGER ledger_entries_append_only
BEFORE UPDATE OR DELETE ON public."ledger_entries"
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_append_only();
DROP TRIGGER IF EXISTS payment_terms_append_only ON settlement.payment_terms;
CREATE TRIGGER payment_terms_append_only
BEFORE UPDATE OR DELETE ON settlement.payment_terms
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_append_only();
DROP TRIGGER IF EXISTS beneficiary_allocations_append_only ON settlement.beneficiary_allocations;
CREATE TRIGGER beneficiary_allocations_append_only
BEFORE UPDATE OR DELETE ON settlement.beneficiary_allocations
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_append_only();

CREATE OR REPLACE FUNCTION public.app_settlement_beneficiary_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
DECLARE
  terms settlement.payment_terms%ROWTYPE;
  allocated BIGINT;
BEGIN
  SELECT * INTO terms FROM settlement.payment_terms WHERE id = NEW.payment_terms_id;
  IF NOT FOUND OR terms.deal_id <> NEW.deal_id OR terms.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'beneficiary allocation payment basis mismatch' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(sum(amount_kopecks), 0) INTO allocated
  FROM settlement.beneficiary_allocations allocation
  WHERE allocation.payment_terms_id = NEW.payment_terms_id
    AND allocation.status = 'ACTIVE'
    AND allocation.id <> NEW.id;
  IF allocated + NEW.amount_kopecks > terms.total_kopecks THEN
    RAISE EXCEPTION 'beneficiary allocation exceeds payment terms total' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS beneficiary_allocations_guard ON settlement.beneficiary_allocations;
CREATE TRIGGER beneficiary_allocations_guard
BEFORE INSERT OR UPDATE ON settlement.beneficiary_allocations
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_beneficiary_guard();

ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."bank_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."bank_operations" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_entries" FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.payment_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.beneficiary_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.beneficiary_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.money_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.money_holds FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.refund_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select ON public."payments";
DROP POLICY IF EXISTS payments_insert ON public."payments";
DROP POLICY IF EXISTS payments_update ON public."payments";
DROP POLICY IF EXISTS payments_delete ON public."payments";
CREATE POLICY payments_select ON public."payments" FOR SELECT USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", false)
);
CREATE POLICY payments_insert ON public."payments" FOR INSERT WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", true)
  AND current_setting('app.current_role', true) IN ('BUYER', 'ACCOUNTING', 'BANK_CALLBACK', 'ADMIN')
);
CREATE POLICY payments_update ON public."payments" FOR UPDATE USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", true)
) WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", true)
  AND current_setting('app.current_role', true) IN ('BUYER', 'ACCOUNTING', 'BANK_CALLBACK', 'ADMIN')
);
CREATE POLICY payments_delete ON public."payments" FOR DELETE USING (false);

DROP POLICY IF EXISTS bank_operations_select ON public."bank_operations";
DROP POLICY IF EXISTS bank_operations_insert ON public."bank_operations";
DROP POLICY IF EXISTS bank_operations_update ON public."bank_operations";
DROP POLICY IF EXISTS bank_operations_delete ON public."bank_operations";
CREATE POLICY bank_operations_select ON public."bank_operations" FOR SELECT USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", false)
);
CREATE POLICY bank_operations_insert ON public."bank_operations" FOR INSERT WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", true)
  AND current_setting('app.current_role', true) IN ('BUYER', 'ACCOUNTING', 'BANK_CALLBACK', 'ADMIN')
);
CREATE POLICY bank_operations_update ON public."bank_operations" FOR UPDATE USING (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", true)
  AND current_setting('app.current_role', true) IN ('BANK_CALLBACK', 'ADMIN')
) WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", true)
  AND current_setting('app.current_role', true) IN ('BANK_CALLBACK', 'ADMIN')
);
CREATE POLICY bank_operations_delete ON public."bank_operations" FOR DELETE USING (false);

DROP POLICY IF EXISTS ledger_entries_select ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_entries_insert ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_entries_update ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_entries_delete ON public."ledger_entries";
CREATE POLICY ledger_entries_select ON public."ledger_entries" FOR SELECT USING (
  "dealId" IS NOT NULL
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", false)
);
CREATE POLICY ledger_entries_insert ON public."ledger_entries" FOR INSERT WITH CHECK (
  "dealId" IS NOT NULL
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized("dealId", true)
  AND current_setting('app.current_role', true) IN ('BANK_CALLBACK', 'ADMIN')
);
CREATE POLICY ledger_entries_update ON public."ledger_entries" FOR UPDATE USING (false);
CREATE POLICY ledger_entries_delete ON public."ledger_entries" FOR DELETE USING (false);

CREATE POLICY settlement_terms_select ON settlement.payment_terms FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, false)
);
CREATE POLICY settlement_terms_insert ON settlement.payment_terms FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
  AND current_setting('app.current_role', true) IN ('ACCOUNTING', 'ADMIN')
);
CREATE POLICY settlement_terms_update ON settlement.payment_terms FOR UPDATE USING (false);
CREATE POLICY settlement_terms_delete ON settlement.payment_terms FOR DELETE USING (false);

CREATE POLICY settlement_beneficiaries_select ON settlement.beneficiary_allocations FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, false)
);
CREATE POLICY settlement_beneficiaries_insert ON settlement.beneficiary_allocations FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
  AND current_setting('app.current_role', true) IN ('ACCOUNTING', 'ADMIN')
);
CREATE POLICY settlement_beneficiaries_update ON settlement.beneficiary_allocations FOR UPDATE USING (false);
CREATE POLICY settlement_beneficiaries_delete ON settlement.beneficiary_allocations FOR DELETE USING (false);

CREATE POLICY settlement_holds_select ON settlement.money_holds FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, false)
);
CREATE POLICY settlement_holds_insert ON settlement.money_holds FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
  AND current_setting('app.current_role', true) IN ('ARBITRATOR', 'ADMIN')
);
CREATE POLICY settlement_holds_update ON settlement.money_holds FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
  AND current_setting('app.current_role', true) IN ('ARBITRATOR', 'ADMIN')
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
);
CREATE POLICY settlement_holds_delete ON settlement.money_holds FOR DELETE USING (false);

CREATE POLICY settlement_refunds_select ON settlement.refund_requests FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, false)
);
CREATE POLICY settlement_refunds_insert ON settlement.refund_requests FOR INSERT WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
  AND current_setting('app.current_role', true) IN ('ACCOUNTING', 'ADMIN')
);
CREATE POLICY settlement_refunds_update ON settlement.refund_requests FOR UPDATE USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
  AND current_setting('app.current_role', true) IN ('BANK_CALLBACK', 'ADMIN')
) WITH CHECK (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND public.app_settlement_deal_authorized(deal_id, true)
);
CREATE POLICY settlement_refunds_delete ON settlement.refund_requests FOR DELETE USING (false);

REVOKE ALL ON FUNCTION public.app_settlement_deal_authorized(TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_settlement_derive_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_settlement_payment_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_settlement_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_settlement_beneficiary_guard() FROM PUBLIC;

DO $settlement_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT USAGE ON SCHEMA settlement TO app_deal;
    GRANT SELECT, INSERT ON settlement.payment_terms TO app_deal;
    GRANT SELECT, INSERT ON settlement.beneficiary_allocations TO app_deal;
    GRANT SELECT, INSERT, UPDATE ON settlement.money_holds TO app_deal;
    GRANT SELECT, INSERT, UPDATE ON settlement.refund_requests TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_settlement_deal_authorized(TEXT, BOOLEAN) TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_settlement_derive_tenant() TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_settlement_payment_guard() TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_settlement_append_only() TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_settlement_beneficiary_guard() TO app_deal;
  END IF;
END
$settlement_grants$;
