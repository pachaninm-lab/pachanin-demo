-- A dispute is not an isolated record: it freezes the canonical Deal and must
-- expose the authoritative settlement hold to compatibility read projections in
-- the same transaction. Multiple active disputes share one reference-counted
-- freeze so closing one case cannot accidentally resume the Deal.

ALTER TABLE dispute.cases
  ADD COLUMN deal_status_before_dispute text,
  ADD COLUMN deal_next_action_before_dispute text,
  ADD COLUMN deal_version_at_open bigint;

CREATE TABLE dispute.deal_freezes (
  tenant_id text NOT NULL,
  deal_id text PRIMARY KEY,
  prior_status text NOT NULL,
  prior_next_action text,
  first_dispute_id text NOT NULL,
  active_case_count integer NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  released_at timestamptz,
  CONSTRAINT dispute_deal_freeze_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public."deals"("id") ON DELETE RESTRICT,
  CONSTRAINT dispute_deal_freeze_first_case_fkey FOREIGN KEY (first_dispute_id)
    REFERENCES dispute.cases(id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT dispute_deal_freeze_count_check CHECK (active_case_count >= 0),
  CONSTRAINT dispute_deal_freeze_status_check CHECK (status IN ('ACTIVE','RELEASED')),
  CONSTRAINT dispute_deal_freeze_state_check CHECK (
    (status = 'ACTIVE' AND active_case_count > 0 AND released_at IS NULL)
    OR (status = 'RELEASED' AND active_case_count = 0 AND released_at IS NOT NULL)
  )
);
CREATE INDEX dispute_deal_freezes_tenant_status_idx
  ON dispute.deal_freezes (tenant_id, status, updated_at DESC);

ALTER TABLE dispute.deal_freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute.deal_freezes FORCE ROW LEVEL SECURITY;
CREATE POLICY dispute_deal_freezes_select ON dispute.deal_freezes FOR SELECT USING (
  tenant_id = current_setting('app.current_tenant_id', true)
  AND dispute.deal_authorized(deal_id, false)
);
REVOKE ALL ON dispute.deal_freezes FROM PUBLIC;

CREATE OR REPLACE FUNCTION dispute.acquire_deal_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  deal_row public."deals"%ROWTYPE;
  freeze_row dispute.deal_freezes%ROWTYPE;
BEGIN
  SELECT * INTO deal_row
  FROM public."deals" deal
  WHERE deal."id" = NEW.deal_id
    AND deal."tenantId" = NEW.tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DISPUTE_DEAL_NOT_FOUND';
  END IF;

  NEW.deal_status_before_dispute := deal_row."status";
  NEW.deal_next_action_before_dispute := deal_row."nextAction";
  NEW.deal_version_at_open := deal_row."version";

  SELECT * INTO freeze_row
  FROM dispute.deal_freezes freeze
  WHERE freeze.deal_id = NEW.deal_id
  FOR UPDATE;

  IF FOUND THEN
    IF freeze_row.tenant_id <> NEW.tenant_id OR freeze_row.status <> 'ACTIVE' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_DEAL_FREEZE_STATE_INVALID';
    END IF;
    IF deal_row."status" <> 'DISPUTED' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_DEAL_FREEZE_CORRUPTED';
    END IF;
    UPDATE dispute.deal_freezes
    SET active_case_count = active_case_count + 1,
        updated_at = transaction_timestamp()
    WHERE deal_id = NEW.deal_id;
  ELSE
    INSERT INTO dispute.deal_freezes (
      tenant_id, deal_id, prior_status, prior_next_action, first_dispute_id,
      active_case_count, status
    ) VALUES (
      NEW.tenant_id, NEW.deal_id, deal_row."status", deal_row."nextAction",
      NEW.id, 1, 'ACTIVE'
    );
    UPDATE public."deals"
    SET "status" = 'DISPUTED',
        "nextAction" = 'Разрешить спор и подтвердить денежный исход',
        "version" = "version" + 1
    WHERE "id" = NEW.deal_id
      AND "tenantId" = NEW.tenant_id
      AND "version" = deal_row."version";
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_CONCURRENT_DEAL_UPDATE';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.release_deal_freeze()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  freeze_row dispute.deal_freezes%ROWTYPE;
  deal_status text;
BEGIN
  IF OLD.status = 'CLOSED' OR NEW.status <> 'CLOSED' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO freeze_row
  FROM dispute.deal_freezes freeze
  WHERE freeze.deal_id = NEW.deal_id
    AND freeze.tenant_id = NEW.tenant_id
  FOR UPDATE;
  IF NOT FOUND OR freeze_row.status <> 'ACTIVE' OR freeze_row.active_case_count <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_DEAL_FREEZE_MISSING';
  END IF;

  SELECT deal."status" INTO deal_status
  FROM public."deals" deal
  WHERE deal."id" = NEW.deal_id
    AND deal."tenantId" = NEW.tenant_id
  FOR UPDATE;
  IF deal_status <> 'DISPUTED' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_DEAL_FREEZE_CORRUPTED';
  END IF;

  IF freeze_row.active_case_count > 1 THEN
    UPDATE dispute.deal_freezes
    SET active_case_count = active_case_count - 1,
        updated_at = transaction_timestamp()
    WHERE deal_id = NEW.deal_id;
  ELSE
    UPDATE public."deals"
    SET "status" = freeze_row.prior_status,
        "nextAction" = freeze_row.prior_next_action,
        "version" = "version" + 1
    WHERE "id" = NEW.deal_id
      AND "tenantId" = NEW.tenant_id
      AND "status" = 'DISPUTED';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DISPUTE_CONCURRENT_DEAL_UPDATE';
    END IF;
    UPDATE dispute.deal_freezes
    SET active_case_count = 0,
        status = 'RELEASED',
        released_at = transaction_timestamp(),
        updated_at = transaction_timestamp()
    WHERE deal_id = NEW.deal_id;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS dispute_case_acquire_deal_freeze ON dispute.cases;
CREATE TRIGGER dispute_case_acquire_deal_freeze
BEFORE INSERT ON dispute.cases
FOR EACH ROW EXECUTE FUNCTION dispute.acquire_deal_freeze();

DROP TRIGGER IF EXISTS dispute_case_release_deal_freeze ON dispute.cases;
CREATE TRIGGER dispute_case_release_deal_freeze
AFTER UPDATE OF status ON dispute.cases
FOR EACH ROW EXECUTE FUNCTION dispute.release_deal_freeze();

CREATE OR REPLACE FUNCTION dispute.guard_case_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'dispute cases cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.deal_id IS DISTINCT FROM OLD.deal_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.initiator_org_id IS DISTINCT FROM OLD.initiator_org_id
     OR NEW.initiator_user_id IS DISTINCT FROM OLD.initiator_user_id
     OR NEW.claim_amount_minor IS DISTINCT FROM OLD.claim_amount_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.deal_status_before_dispute IS DISTINCT FROM OLD.deal_status_before_dispute
     OR NEW.deal_next_action_before_dispute IS DISTINCT FROM OLD.deal_next_action_before_dispute
     OR NEW.deal_version_at_open IS DISTINCT FROM OLD.deal_version_at_open THEN
    RAISE EXCEPTION 'dispute identity, claim and deal-freeze facts are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.settlement_hold_id IS DISTINCT FROM OLD.settlement_hold_id
     AND NOT (
       OLD.settlement_hold_id IS NULL
       AND NEW.settlement_hold_id IS NOT NULL
       AND OLD.version = 1
       AND NEW.version = 2
     ) THEN
    RAISE EXCEPTION 'dispute settlement hold binding is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'dispute update requires exact CAS version increment' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := transaction_timestamp();
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION dispute.sync_dispute_hold_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute, settlement
AS $function$
BEGIN
  IF NEW.active_hold_minor <= OLD.active_hold_minor THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM settlement.holds hold
    WHERE hold.payment_id = NEW.id
      AND hold.tenant_id = NEW.tenant_id
      AND hold.basis_type = 'DISPUTE'
      AND hold.status = 'ACTIVE'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.settlement_projection_write', 'on', true);
  UPDATE public."payments"
  SET "status" = 'HOLD_ACTIVE',
      "amountKopecks" = NEW.confirmed_reserved_minor,
      "holdAmountKopecks" = NEW.active_hold_minor,
      "callbackState" = 'CONFIRMED',
      "updatedAt" = transaction_timestamp()
  WHERE "id" = 'payment:' || NEW.deal_id
    AND "dealId" = NEW.deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_PAYMENT_PROJECTION_REQUIRED';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS settlement_payment_dispute_projection ON settlement.payments;
CREATE TRIGGER settlement_payment_dispute_projection
AFTER UPDATE OF active_hold_minor ON settlement.payments
FOR EACH ROW
WHEN (NEW.active_hold_minor > OLD.active_hold_minor)
EXECUTE FUNCTION dispute.sync_dispute_hold_projection();

REVOKE ALL ON FUNCTION dispute.acquire_deal_freeze() FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.release_deal_freeze() FROM PUBLIC;
REVOKE ALL ON FUNCTION dispute.sync_dispute_hold_projection() FROM PUBLIC;

COMMENT ON TABLE dispute.deal_freezes IS
  'Reference-counted canonical Deal freeze while one or more dispute cases remain active.';
