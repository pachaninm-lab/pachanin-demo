-- IR-10.4 mixed release/refund status alignment.
--
-- Payment status is a deterministic projection of the complete authoritative
-- counter set, not of the most recent callback type. This keeps PostgreSQL and
-- SettlementPostgresqlRepository.restingStatus identical when a Deal contains
-- both beneficiary releases and buyer refunds.

CREATE OR REPLACE FUNCTION settlement.validate_payment_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, settlement
AS $function$
DECLARE
  callback_operation_id TEXT;
  callback_event_id TEXT;
  callback_partner_id TEXT;
  callback_fingerprint TEXT;
  operation_record settlement.bank_operations%ROWTYPE;
  expected_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version <> 0 THEN
      RAISE EXCEPTION 'settlement payment must start at version zero' USING ERRCODE = '23514';
    END IF;
    IF NEW.confirmed_reserved_minor <> 0
      OR NEW.confirmed_released_minor <> 0
      OR NEW.confirmed_refunded_minor <> 0
    THEN
      RAISE EXCEPTION 'settlement confirmed counters must start at zero'
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
    RAISE EXCEPTION 'settlement payment identity is immutable' USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'settlement payment update requires exact CAS version increment'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.confirmed_reserved_minor < OLD.confirmed_reserved_minor
    OR NEW.confirmed_released_minor < OLD.confirmed_released_minor
    OR NEW.confirmed_refunded_minor < OLD.confirmed_refunded_minor
  THEN
    RAISE EXCEPTION 'confirmed settlement counters are monotonic' USING ERRCODE = '23514';
  END IF;

  IF NEW.confirmed_reserved_minor IS DISTINCT FROM OLD.confirmed_reserved_minor
    OR NEW.confirmed_released_minor IS DISTINCT FROM OLD.confirmed_released_minor
    OR NEW.confirmed_refunded_minor IS DISTINCT FROM OLD.confirmed_refunded_minor
  THEN
    IF current_setting('app.current_role', true) <> 'BANK_CALLBACK' THEN
      RAISE EXCEPTION 'only an exact verified bank callback may change confirmed money'
        USING ERRCODE = '42501';
    END IF;

    callback_operation_id := NULLIF(current_setting('app.current_callback_operation_id', true), '');
    callback_event_id := NULLIF(current_setting('app.current_callback_event_id', true), '');
    callback_partner_id := NULLIF(current_setting('app.current_callback_partner_id', true), '');
    callback_fingerprint := NULLIF(current_setting('app.current_callback_fingerprint', true), '');

    IF callback_operation_id IS NULL
      OR callback_event_id IS NULL
      OR callback_partner_id IS NULL
      OR callback_fingerprint IS NULL
    THEN
      RAISE EXCEPTION 'BANK_CALLBACK payment mutation lacks exact transaction binding'
        USING ERRCODE = '42501';
    END IF;

    SELECT operation.* INTO operation_record
    FROM settlement.bank_operations operation
    WHERE operation.id = callback_operation_id
      AND operation.payment_id = NEW.id
      AND operation.deal_id = NEW.deal_id
      AND operation.tenant_id = NEW.tenant_id
      AND operation.status = 'PENDING'
      AND operation.required_partner_id = callback_partner_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'confirmed counter mutation has no exact pending settlement operation'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM settlement.bank_callbacks callback
      WHERE callback.operation_id = operation_record.id
        AND callback.event_id = callback_event_id
        AND callback.partner_id = callback_partner_id
        AND callback.payload_fingerprint = callback_fingerprint
        AND callback.tenant_id = NEW.tenant_id
        AND callback.deal_id = NEW.deal_id
        AND callback.callback_status = 'SUCCESS'
    ) THEN
      RAISE EXCEPTION 'confirmed counter mutation has no exact successful callback fact'
        USING ERRCODE = '23514';
    END IF;

    IF operation_record.operation_type = 'RESERVE' THEN
      IF NEW.confirmed_reserved_minor <> OLD.confirmed_reserved_minor + operation_record.amount_minor
        OR NEW.pending_reserved_minor <> OLD.pending_reserved_minor - operation_record.amount_minor
        OR NEW.confirmed_released_minor <> OLD.confirmed_released_minor
        OR NEW.confirmed_refunded_minor <> OLD.confirmed_refunded_minor
      THEN
        RAISE EXCEPTION 'reserve callback counters do not match the exact operation'
          USING ERRCODE = '23514';
      END IF;
      expected_status := 'RESERVED';
    ELSIF operation_record.operation_type = 'RELEASE' THEN
      IF NEW.confirmed_released_minor <> OLD.confirmed_released_minor + operation_record.amount_minor
        OR NEW.pending_released_minor <> OLD.pending_released_minor - operation_record.amount_minor
        OR NEW.confirmed_reserved_minor <> OLD.confirmed_reserved_minor
        OR NEW.confirmed_refunded_minor <> OLD.confirmed_refunded_minor
      THEN
        RAISE EXCEPTION 'release callback counters do not match the exact operation'
          USING ERRCODE = '23514';
      END IF;

      IF NEW.confirmed_released_minor + NEW.confirmed_refunded_minor = NEW.confirmed_reserved_minor THEN
        expected_status := CASE
          WHEN NEW.confirmed_released_minor > 0 THEN 'RELEASED'
          ELSE 'REFUNDED'
        END;
      ELSE
        expected_status := CASE
          WHEN NEW.confirmed_refunded_minor > 0 THEN 'PARTIALLY_REFUNDED'
          ELSE 'PARTIALLY_RELEASED'
        END;
      END IF;
    ELSIF operation_record.operation_type = 'REFUND' THEN
      IF NEW.confirmed_refunded_minor <> OLD.confirmed_refunded_minor + operation_record.amount_minor
        OR NEW.pending_refunded_minor <> OLD.pending_refunded_minor - operation_record.amount_minor
        OR NEW.confirmed_reserved_minor <> OLD.confirmed_reserved_minor
        OR NEW.confirmed_released_minor <> OLD.confirmed_released_minor
      THEN
        RAISE EXCEPTION 'refund callback counters do not match the exact operation'
          USING ERRCODE = '23514';
      END IF;

      IF NEW.confirmed_released_minor + NEW.confirmed_refunded_minor = NEW.confirmed_reserved_minor THEN
        expected_status := CASE
          WHEN NEW.confirmed_released_minor > 0 THEN 'RELEASED'
          ELSE 'REFUNDED'
        END;
      ELSE
        expected_status := CASE
          WHEN NEW.confirmed_refunded_minor > 0 THEN 'PARTIALLY_REFUNDED'
          ELSE 'PARTIALLY_RELEASED'
        END;
      END IF;
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

REVOKE ALL ON FUNCTION settlement.validate_payment_transition() FROM PUBLIC;

COMMENT ON FUNCTION settlement.validate_payment_transition() IS
  'Exact verified-callback guard for confirmed money counters with deterministic aggregate release/refund status derivation.';
