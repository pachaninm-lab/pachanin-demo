-- IR-10.4 Settlement request-vs-resting status alignment.
--
-- A newly created external operation is represented by its exact PENDING
-- status even when a different portion of the payment is held. Once no pending
-- counter is being increased by the current transaction, the normal resting
-- precedence applies: MANUAL_REVIEW, HOLD_ACTIVE, remaining pending operations,
-- then aggregate disposition. Amount availability continues to subtract holds.

CREATE OR REPLACE FUNCTION settlement.validate_payment_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, settlement
AS $function$
DECLARE
  actor_role TEXT := current_setting('app.current_role', true);
  callback_operation_id TEXT := NULLIF(current_setting('app.current_callback_operation_id', true), '');
  callback_event_id TEXT := NULLIF(current_setting('app.current_callback_event_id', true), '');
  callback_partner_id TEXT := NULLIF(current_setting('app.current_callback_partner_id', true), '');
  bound_callback_status TEXT := NULLIF(current_setting('app.current_callback_status', true), '');
  callback_fingerprint TEXT := NULLIF(current_setting('app.current_callback_fingerprint', true), '');
  operation_record settlement.bank_operations%ROWTYPE;
  confirmed_changed BOOLEAN;
  expected_status TEXT;
  consumed_minor BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version <> 0 THEN
      RAISE EXCEPTION 'settlement payment must start at version zero'
        USING ERRCODE = '23514';
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

  IF confirmed_changed AND actor_role <> 'BANK_CALLBACK' THEN
    RAISE EXCEPTION 'only an exact verified bank callback may change confirmed money'
      USING ERRCODE = '42501';
  END IF;

  IF actor_role = 'BANK_CALLBACK' THEN
    IF callback_operation_id IS NULL
      OR callback_event_id IS NULL
      OR callback_partner_id IS NULL
      OR bound_callback_status NOT IN ('SUCCESS', 'FAILED')
      OR callback_fingerprint !~ '^[0-9a-f]{64}$'
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
      RAISE EXCEPTION 'bank callback payment transition has no exact pending operation'
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
        AND callback.callback_status = bound_callback_status
    ) THEN
      RAISE EXCEPTION 'bank callback payment transition has no exact immutable callback fact'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.active_hold_minor IS DISTINCT FROM OLD.active_hold_minor
      OR NEW.reconciliation_status IS DISTINCT FROM OLD.reconciliation_status
      OR NEW.manual_review_reason IS DISTINCT FROM OLD.manual_review_reason
    THEN
      RAISE EXCEPTION 'bank callback cannot mutate hold or reconciliation authority'
        USING ERRCODE = '42501';
    END IF;

    IF bound_callback_status = 'SUCCESS' THEN
      CASE operation_record.operation_type
        WHEN 'RESERVE' THEN
          IF NEW.confirmed_reserved_minor <> OLD.confirmed_reserved_minor + operation_record.amount_minor
            OR NEW.pending_reserved_minor <> OLD.pending_reserved_minor - operation_record.amount_minor
            OR NEW.confirmed_released_minor <> OLD.confirmed_released_minor
            OR NEW.pending_released_minor <> OLD.pending_released_minor
            OR NEW.confirmed_refunded_minor <> OLD.confirmed_refunded_minor
            OR NEW.pending_refunded_minor <> OLD.pending_refunded_minor
          THEN
            RAISE EXCEPTION 'reserve callback counters do not match the exact operation'
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
            RAISE EXCEPTION 'release callback counters do not match the exact operation'
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
            RAISE EXCEPTION 'refund callback counters do not match the exact operation'
              USING ERRCODE = '23514';
          END IF;
        ELSE
          RAISE EXCEPTION 'unsupported settlement callback operation type'
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

  consumed_minor := NEW.confirmed_released_minor + NEW.confirmed_refunded_minor;

  IF NEW.reconciliation_status = 'MANUAL_REVIEW' THEN
    expected_status := 'MANUAL_REVIEW';
  ELSIF NEW.pending_reserved_minor > OLD.pending_reserved_minor THEN
    expected_status := 'RESERVE_PENDING';
  ELSIF NEW.pending_released_minor > OLD.pending_released_minor THEN
    expected_status := 'RELEASE_PENDING';
  ELSIF NEW.pending_refunded_minor > OLD.pending_refunded_minor THEN
    expected_status := 'REFUND_PENDING';
  ELSIF NEW.active_hold_minor > 0 THEN
    expected_status := 'HOLD_ACTIVE';
  ELSIF NEW.pending_reserved_minor > 0 THEN
    expected_status := 'RESERVE_PENDING';
  ELSIF NEW.pending_released_minor > 0 THEN
    expected_status := 'RELEASE_PENDING';
  ELSIF NEW.pending_refunded_minor > 0 THEN
    expected_status := 'REFUND_PENDING';
  ELSIF NEW.confirmed_reserved_minor = 0 THEN
    expected_status := 'TERMS_ACTIVE';
  ELSIF consumed_minor = 0 THEN
    expected_status := 'RESERVED';
  ELSIF consumed_minor < NEW.confirmed_reserved_minor THEN
    expected_status := CASE
      WHEN NEW.confirmed_refunded_minor > 0 THEN 'PARTIALLY_REFUNDED'
      ELSE 'PARTIALLY_RELEASED'
    END;
  ELSIF consumed_minor = NEW.confirmed_reserved_minor THEN
    expected_status := CASE
      WHEN NEW.confirmed_released_minor > 0 THEN 'RELEASED'
      ELSE 'REFUNDED'
    END;
  ELSE
    RAISE EXCEPTION 'settlement consumed funds exceed confirmed reserve'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> expected_status THEN
    RAISE EXCEPTION 'payment status % does not match derived request/resting status %', NEW.status, expected_status
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION settlement.validate_payment_transition() FROM PUBLIC;

COMMENT ON FUNCTION settlement.validate_payment_transition() IS
  'Exact callback and CAS guard that distinguishes a newly requested operation from the subsequent MANUAL_REVIEW, hold, pending and aggregate resting state.';
