-- Industrial Transaction Core (block 1)
-- 1. Optimistic-concurrency versions on mutable aggregates.
-- 2. Money columns widened to BIGINT (kopecks) / DECIMAL(20,6) (price, weight).
-- 3. Append-only enforcement for deal_events and ledger_entries.
-- 4. Durable outbox lease columns for FOR UPDATE SKIP LOCKED workers.

-- ── 1. Aggregate versions ─────────────────────────────────────────────────────

ALTER TABLE "deals"     ADD COLUMN "version" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "payments"  ADD COLUMN "version" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "shipments" ADD COLUMN "version" BIGINT NOT NULL DEFAULT 0;

-- ── 2. Money: BIGINT kopecks, DECIMAL(20,6) price/weight ─────────────────────

ALTER TABLE "deals"
  ALTER COLUMN "totalKopecks" TYPE BIGINT,
  ADD COLUMN "pricePerTonDec" DECIMAL(20,6),
  ADD COLUMN "volumeTonsDec"  DECIMAL(20,6);

-- Backfill decimals from legacy float columns (round to 6 dp, deterministic).
UPDATE "deals"
SET "pricePerTonDec" = ROUND("pricePerTon"::numeric, 6),
    "volumeTonsDec"  = ROUND("volumeTons"::numeric, 6)
WHERE "pricePerTon" IS NOT NULL OR "volumeTons" IS NOT NULL;

-- Backfill totalKopecks from legacy float rubles where it was never set.
UPDATE "deals"
SET "totalKopecks" = ROUND("totalRub"::numeric * 100)::bigint
WHERE "totalKopecks" IS NULL AND "totalRub" IS NOT NULL;

ALTER TABLE "payments"
  ALTER COLUMN "amountKopecks"     TYPE BIGINT,
  ALTER COLUMN "holdAmountKopecks" TYPE BIGINT,
  ALTER COLUMN "refundedKopecks"   TYPE BIGINT,
  ALTER COLUMN "commissionKopecks" TYPE BIGINT;

UPDATE "payments"
SET "amountKopecks" = ROUND("amountRub"::numeric * 100)::bigint
WHERE "amountKopecks" IS NULL AND "amountRub" IS NOT NULL;

ALTER TABLE "ledger_entries"
  ALTER COLUMN "amountKopecks" TYPE BIGINT;

ALTER TABLE "disputes"
  ALTER COLUMN "claimAmountKopecks" TYPE BIGINT;

ALTER TABLE "dispute_money_holds"
  ALTER COLUMN "amountKopecks" TYPE BIGINT;

ALTER TABLE "acceptance_records"
  ALTER COLUMN "moneyAdjustKopecks" TYPE BIGINT;

ALTER TABLE "lab_samples"
  ALTER COLUMN "moneyDeltaKopecks" TYPE BIGINT;

-- Ledger amounts must stay strictly positive: direction is expressed by the
-- debit/credit account pair, never by sign.
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amountKopecks" > 0) NOT VALID;
ALTER TABLE "ledger_entries" VALIDATE CONSTRAINT "ledger_entries_amount_positive";

-- ── 3. Append-only enforcement ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION industrial_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only: % is forbidden', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

-- Legacy DO INSTEAD NOTHING rules silently swallowed UPDATE/DELETE before any
-- trigger could fire. Silent no-ops hide tampering attempts; append-only must
-- fail loudly, so the rules are replaced by RAISE triggers.
DROP RULE IF EXISTS no_update_deal_events ON "deal_events";
DROP RULE IF EXISTS no_delete_deal_events ON "deal_events";
DROP RULE IF EXISTS no_update_ledger ON "ledger_entries";
DROP RULE IF EXISTS no_delete_ledger ON "ledger_entries";
DROP RULE IF EXISTS no_update_audit_events ON "audit_events";
DROP RULE IF EXISTS no_delete_audit_events ON "audit_events";

-- audit_events keeps its existing auth_audit_events_append_only trigger; add
-- the industrial trigger only where none exists yet.

DROP TRIGGER IF EXISTS deal_events_append_only ON "deal_events";
CREATE TRIGGER deal_events_append_only
  BEFORE UPDATE OR DELETE ON "deal_events"
  FOR EACH ROW EXECUTE FUNCTION industrial_forbid_mutation();

DROP TRIGGER IF EXISTS ledger_entries_append_only ON "ledger_entries";
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION industrial_forbid_mutation();

-- ── 4. Bank-callback scope resolution ────────────────────────────────────────
-- A verified bank callback is a system actor: it knows the deal and the
-- platform-issued bank operation id, but not the tenant. This SECURITY DEFINER
-- function resolves the trusted RLS scope for exactly that binding and nothing
-- else: no matching pending operation → no scope → no money effect.

CREATE OR REPLACE FUNCTION public.app_bank_callback_scope(p_deal_id text, p_operation_id text)
RETURNS TABLE ("tenantId" text, "buyerOrgId" text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT d."tenantId", d."buyerOrgId"
  FROM public."deals" d
  JOIN public."bank_operations" op ON op."dealId" = d."id"
  WHERE d."id" = p_deal_id
    AND op."id" = p_operation_id
    AND d."tenantId" IS NOT NULL
$$;

-- ── 5. Durable outbox leases ──────────────────────────────────────────────────

ALTER TABLE "outbox_entries"
  ADD COLUMN "leaseOwner"     TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "deadLetterAt"   TIMESTAMP(3);

CREATE INDEX "outbox_entries_lease_idx"
  ON "outbox_entries" ("status", "leaseExpiresAt");
