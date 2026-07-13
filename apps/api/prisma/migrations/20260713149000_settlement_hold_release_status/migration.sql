-- IR-10.4: releasing the final hold must derive the resting payment state from
-- authoritative counters. The same derived state is projected to public.payments.

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
