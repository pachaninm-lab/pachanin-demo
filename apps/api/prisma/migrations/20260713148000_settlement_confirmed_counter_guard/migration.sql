-- IR-10.4 confirmed-money hardening.
-- A validated callback insert establishes transaction-local operation binding.
-- Confirmed counters can then change only by the exact amount and type of that
-- one PENDING bank operation. Human actors cannot substitute confirmed state.

CREATE OR REPLACE FUNCTION settlement.validate_callback_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, settlement
AS $function$
DECLARE
  operation_record settlement.bank_operations%ROWTYPE;
BEGIN
  IF current_setting('app.current_role', true) <> 'BANK_CALLBACK' THEN
    RAISE EXCEPTION 'settlement callbacks require verified bank actor'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO operation_record
  FROM settlement.bank_operations operation
  WHERE operation.id = NEW.operation_id
  FOR UPDATE;

  IF NOT FOUND
    OR operation_record.status <> 'PENDING'
    OR operation_record.tenant_id <> NEW.tenant_id
    OR operation_record.deal_id <> NEW.deal_id
    OR operation_record.required_partner_id <> NEW.partner_id
  THEN
    RAISE EXCEPTION 'callback is not bound to the exact pending settlement operation'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.current_callback_deal_id', NEW.deal_id, true);
  PERFORM set_config('app.current_callback_operation_id', NEW.operation_id, true);
  PERFORM set_config('app.current_callback_partner_id', NEW.partner_id, true);
  PERFORM set_config('app.current_callback_status', NEW.callback_status, true);
  PERFORM set_config('app.current_callback_fingerprint', NEW.payload_fingerprint, true);
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION settlement.validate_payment_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, settlement
AS $function$
DECLARE
  actor_role TEXT := current_setting('app.current_role', true);
  callback_operation_id TEXT := current_setting('app.current_callback_operation_id', true);
  callback_deal_id TEXT := current_setting('app.current_callback_deal_id', true);
  callback_status TEXT := current_setting('app.current_callback_status', true);
  callback_fingerprint TEXT := current_setting('app.current_callback_fingerprint', true);
  operation_record settlement.bank_operations%ROWTYPE;
  confirmed_changed BOOLEAN;
  expected_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version <> 0 THEN
      RAISE EXCEPTION 'settlement payment must start at version zero'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.deal_id IS DISTINCT FROM OLD.deal_id
    OR NEW.payment_terms_id IS DISTINCT FROM OLD.payment_terms_id
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'settlement payment identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'settlement payment update requires exact CAS version increment'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.confirmed_reserved_minor < OLD.confirmed_reserved_minor
    OR NEW.confirmed_released_minor < OLD.confirmed_released_minor
    OR NEW.confirmed_refunded_minor < OLD.confirmed_refunded_minor
  THEN
    RAISE EXCEPTION 'confirmed settlement counters are monotonic'
      USING ERRCODE = '23514';
  END IF;

  confirmed_changed :=
    NEW.confirmed_reserved_minor IS DISTINCT FROM OLD.confirmed_reserved_minor
    OR NEW.confirmed_released_minor IS DISTINCT FROM OLD.confirmed_released_minor
    OR NEW.confirmed_refunded_minor IS DISTINCT FROM OLD.confirmed_refunded_minor;

  IF actor_role <> 'BANK_CALLBACK' AND confirmed_changed THEN
    RAISE EXCEPTION 'only an exact verified bank callback may change confirmed money'
      USING ERRCODE = '42501';
  END IF;

  IF actor_role = 'BANK_CALLBACK' THEN
    IF callback_operation_id IS NULL
      OR callback_deal_id IS DISTINCT FROM NEW.deal_id
      OR callback_status NOT IN ('SUCCESS', 'FAILED')
      OR callback_fingerprint !~ '^[0-9a-f]{64}$'
    THEN
      RAISE EXCEPTION 'bank callback payment transition lacks exact transaction binding'
        USING ERRCODE = '42501';
    END IF;

    SELECT * INTO operation_record
    FROM settlement.bank_operations operation
    WHERE operation.id = callback_operation_id
      AND operation.deal_id = NEW.deal_id
      AND operation.payment_id = NEW.id
      AND operation.status = 'PENDING'
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'bank callback payment transition has no exact pending operation'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.active_hold_minor IS DISTINCT FROM OLD.active_hold_minor
      OR NEW.reconciliation_status IS DISTINCT FROM OLD.reconciliation_status
      OR NEW.manual_review_reason IS DISTINCT FROM OLD.manual_review_reason
    THEN
      RAISE EXCEPTION 'bank callback cannot mutate hold or reconciliation authority'
        USING ERRCODE = '42501';
    END IF;

    IF callback_status = 'SUCCESS' THEN
      CASE operation_record.operation_type
        WHEN 'RESERVE' THEN
          IF NEW.confirmed_reserved_minor <> OLD.confirmed_reserved_minor + operation_record.amount_minor
            OR NEW.pending_reserved_minor <> OLD.pending_reserved_minor - operation_record.amount_minor
            OR NEW.confirmed_released_minor <> OLD.confirmed_released_minor
            OR NEW.pending_released_minor <> OLD.pending_released_minor
            OR NEW.confirmed_refunded_minor <> OLD.confirmed_refunded_minor
            OR NEW.pending_refunded_minor <> OLD.pending_refunded_minor
          THEN
            RAISE EXCEPTION 'reserve callback counters do not match exact operation amount'
              USING ERRCODE = '23514';
          END IF;
        WHEN 'RELEASE' THEN
          IF NEW.confirmed_released_minor <> OLD.confirmed_released_minor + operation_record.amount_minor
            OR NEW.pending_released_minor <> OLD.pending_released_minor - operation_record.amount_minor
            OR NEW.confirmed_reserved_minor <> OLD.confirmed_reserved_minor
            OR NEW.pending_reserved_minor <> OLD.pending_reserved_minor
            OR NEW.confirmed_refunded_minor <> OLD.confirmed_refunded_minor
            OR NEW.pending_refunded_minor <> OLD.pending_refunded_minor
          THEN
            RAISE EXCEPTION 'release callback counters do not match exact operation amount'
              USING ERRCODE = '23514';
          END IF;
        WHEN 'REFUND' THEN
          IF NEW.confirmed_refunded_minor <> OLD.confirmed_refunded_minor + operation_record.amount_minor
            OR NEW.pending_refunded_minor <> OLD.pending_refunded_minor - operation_record.amount_minor
            OR NEW.confirmed_reserved_minor <> OLD.confirmed_reserved_minor
            OR NEW.pending_reserved_minor <> OLD.pending_reserved_minor
            OR NEW.confirmed_released_minor <> OLD.confirmed_released_minor
            OR NEW.pending_released_minor <> OLD.pending_released_minor
          THEN
            RAISE EXCEPTION 'refund callback counters do not match exact operation amount'
              USING ERRCODE = '23514';
          END IF;
        ELSE
          RAISE EXCEPTION 'unsupported callback operation type'
            USING ERRCODE = '23514';
      END CASE;
    ELSE
      IF confirmed_changed THEN
        RAISE EXCEPTION 'failed callback cannot change confirmed money'
          USING ERRCODE = '23514';
      END IF;
      CASE operation_record.operation_type
        WHEN 'RESERVE' THEN
          IF NEW.pending_reserved_minor <> OLD.pending_reserved_minor - operation_record.amount_minor
            OR NEW.pending_released_minor <> OLD.pending_released_minor
            OR NEW.pending_refunded_minor <> OLD.pending_refunded_minor
          THEN
            RAISE EXCEPTION 'failed reserve callback pending counters mismatch'
              USING ERRCODE = '23514';
          END IF;
        WHEN 'RELEASE' THEN
          IF NEW.pending_released_minor <> OLD.pending_released_minor - operation_record.amount_minor
            OR NEW.pending_reserved_minor <> OLD.pending_reserved_minor
            OR NEW.pending_refunded_minor <> OLD.pending_refunded_minor
          THEN
            RAISE EXCEPTION 'failed release callback pending counters mismatch'
              USING ERRCODE = '23514';
          END IF;
        WHEN 'REFUND' THEN
          IF NEW.pending_refunded_minor <> OLD.pending_refunded_minor - operation_record.amount_minor
            OR NEW.pending_reserved_minor <> OLD.pending_reserved_minor
            OR NEW.pending_released_minor <> OLD.pending_released_minor
          THEN
            RAISE EXCEPTION 'failed refund callback pending counters mismatch'
              USING ERRCODE = '23514';
          END IF;
      END CASE;
    END IF;
  END IF;

  IF NEW.status = 'RESERVE_PENDING' AND NEW.pending_reserved_minor <= 0 THEN
    RAISE EXCEPTION 'RESERVE_PENDING requires a positive pending reserve'
      USING ERRCODE = '23514';
  ELSIF NEW.status = 'RELEASE_PENDING' AND NEW.pending_released_minor <= 0 THEN
    RAISE EXCEPTION 'RELEASE_PENDING requires a positive pending release'
      USING ERRCODE = '23514';
  ELSIF NEW.status = 'REFUND_PENDING' AND NEW.pending_refunded_minor <= 0 THEN
    RAISE EXCEPTION 'REFUND_PENDING requires a positive pending refund'
      USING ERRCODE = '23514';
  ELSIF NEW.status = 'HOLD_ACTIVE' AND NEW.active_hold_minor <= 0 THEN
    RAISE EXCEPTION 'HOLD_ACTIVE requires a positive active hold'
      USING ERRCODE = '23514';
  ELSIF NEW.status = 'RELEASED' AND (
    NEW.confirmed_released_minor + NEW.confirmed_refunded_minor <> NEW.confirmed_reserved_minor
    OR NEW.pending_reserved_minor <> 0
    OR NEW.pending_released_minor <> 0
    OR NEW.pending_refunded_minor <> 0
    OR NEW.active_hold_minor <> 0
  ) THEN
    RAISE EXCEPTION 'RELEASED requires fully allocated confirmed reserve and no pending or held funds'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'FAILED' AND actor_role <> 'BANK_CALLBACK' THEN
    RAISE EXCEPTION 'only a verified bank callback may fail a settlement payment'
      USING ERRCODE = '42501';
  END IF;

  IF actor_role = 'BANK_CALLBACK' THEN
    IF callback_status = 'FAILED' THEN
      expected_status := 'FAILED';
    ELSIF NEW.active_hold_minor > 0 THEN
      expected_status := 'HOLD_ACTIVE';
    ELSIF operation_record.operation_type = 'RESERVE' THEN
      expected_status := 'RESERVED';
    ELSIF NEW.confirmed_released_minor + NEW.confirmed_refunded_minor >= NEW.confirmed_reserved_minor THEN
      expected_status := CASE
        WHEN operation_record.operation_type = 'REFUND' AND NEW.confirmed_released_minor = 0
          THEN 'REFUNDED'
        ELSE 'RELEASED'
      END;
    ELSIF operation_record.operation_type = 'REFUND' THEN
      expected_status := 'PARTIALLY_REFUNDED';
    ELSE
      expected_status := 'PARTIALLY_RELEASED';
    END IF;

    IF NEW.status <> expected_status THEN
      RAISE EXCEPTION 'callback payment status % does not match derived status %', NEW.status, expected_status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

COMMENT ON FUNCTION settlement.validate_payment_transition() IS
  'Prevents direct substitution of confirmed money; callback deltas must equal one exact validated PENDING bank operation.';

-- Releasing the final hold must derive the resting payment state from the
-- authoritative integer counters. The same state is applied to the public
-- compatibility projection.
CREATE OR REPLACE FUNCTION settlement.derive_resting_payment_status(
  p_reconciliation_status TEXT,
  p_active_hold_minor BIGINT,
  p_pending_reserved_minor BIGINT,
  p_pending_released_minor BIGINT,
  p_pending_refunded_minor BIGINT,
  p_confirmed_reserved_minor BIGINT,
  p_confirmed_released_minor BIGINT,
  p_confirmed_refunded_minor BIGINT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN p_reconciliation_status = 'MANUAL_REVIEW' THEN 'MANUAL_REVIEW'
    WHEN p_active_hold_minor > 0 THEN 'HOLD_ACTIVE'
    WHEN p_pending_reserved_minor > 0 THEN 'RESERVE_PENDING'
    WHEN p_pending_released_minor > 0 THEN 'RELEASE_PENDING'
    WHEN p_pending_refunded_minor > 0 THEN 'REFUND_PENDING'
    WHEN p_confirmed_reserved_minor = 0 THEN 'TERMS_ACTIVE'
    WHEN p_confirmed_released_minor + p_confirmed_refunded_minor = 0 THEN 'RESERVED'
    WHEN p_confirmed_released_minor + p_confirmed_refunded_minor < p_confirmed_reserved_minor
      THEN CASE
        WHEN p_confirmed_refunded_minor > 0 THEN 'PARTIALLY_REFUNDED'
        ELSE 'PARTIALLY_RELEASED'
      END
    WHEN p_confirmed_released_minor > 0 THEN 'RELEASED'
    ELSE 'REFUNDED'
  END
$function$;

CREATE OR REPLACE FUNCTION settlement.normalize_final_hold_release_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, settlement
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
    AND current_setting('app.current_role', true) <> 'BANK_CALLBACK'
    AND OLD.active_hold_minor > 0
    AND NEW.active_hold_minor = 0
    AND NEW.status = 'HOLD_ACTIVE'
  THEN
    NEW.status := settlement.derive_resting_payment_status(
      NEW.reconciliation_status,
      NEW.active_hold_minor,
      NEW.pending_reserved_minor,
      NEW.pending_released_minor,
      NEW.pending_refunded_minor,
      NEW.confirmed_reserved_minor,
      NEW.confirmed_released_minor,
      NEW.confirmed_refunded_minor
    );
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS aa_settlement_normalize_final_hold_release_status
  ON settlement.payments;
CREATE TRIGGER aa_settlement_normalize_final_hold_release_status
BEFORE UPDATE ON settlement.payments
FOR EACH ROW
EXECUTE FUNCTION settlement.normalize_final_hold_release_status();

CREATE OR REPLACE FUNCTION settlement.normalize_public_hold_release_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
DECLARE
  authority_status TEXT;
BEGIN
  IF current_setting('app.settlement_projection_write', true) = 'on'
    AND OLD.status = 'HOLD_ACTIVE'
    AND NEW."holdAmountKopecks" = 0
  THEN
    SELECT payment.status INTO authority_status
    FROM settlement.payments payment
    WHERE payment.deal_id = NEW."dealId";

    IF authority_status IS NULL THEN
      RAISE EXCEPTION 'Settlement authority payment is required for hold-release projection'
        USING ERRCODE = '23514';
    END IF;

    NEW.status := CASE authority_status
      WHEN 'TERMS_ACTIVE' THEN 'PENDING'
      WHEN 'RESERVE_PENDING' THEN 'RESERVE_REQUESTED'
      WHEN 'RESERVED' THEN 'RESERVED'
      WHEN 'RELEASE_PENDING' THEN 'RELEASE_REQUESTED'
      WHEN 'PARTIALLY_RELEASED' THEN 'PARTIALLY_RELEASED'
      WHEN 'RELEASED' THEN 'RELEASED'
      WHEN 'REFUND_PENDING' THEN 'REFUND_REQUESTED'
      WHEN 'PARTIALLY_REFUNDED' THEN 'PARTIALLY_REFUNDED'
      WHEN 'REFUNDED' THEN 'REFUNDED'
      WHEN 'HOLD_ACTIVE' THEN 'HOLD_ACTIVE'
      WHEN 'MANUAL_REVIEW' THEN 'MANUAL_REVIEW'
      ELSE authority_status
    END;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS aa_settlement_normalize_public_hold_release_projection
  ON public.payments;
CREATE TRIGGER aa_settlement_normalize_public_hold_release_projection
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION settlement.normalize_public_hold_release_projection();

REVOKE ALL ON FUNCTION settlement.normalize_final_hold_release_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION settlement.normalize_public_hold_release_projection() FROM PUBLIC;
COMMENT ON FUNCTION settlement.derive_resting_payment_status(TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT) IS
  'Derives the authoritative resting payment state from integer settlement counters.';
