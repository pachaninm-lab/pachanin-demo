-- IR-10.4 exact callback-event transaction binding.
--
-- The confirmed-counter guard requires the immutable callback event identifier
-- in addition to Deal, operation, partner, status and payload fingerprint.
-- Previous callback trigger versions did not publish event_id into the
-- transaction-local binding, so the stronger payment trigger correctly failed
-- closed. Add the missing field without weakening any existing check.

CREATE OR REPLACE FUNCTION settlement.validate_callback_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
  PERFORM set_config('app.current_callback_event_id', NEW.event_id, true);
  PERFORM set_config('app.current_callback_partner_id', NEW.partner_id, true);
  PERFORM set_config('app.current_callback_status', NEW.callback_status, true);
  PERFORM set_config('app.current_callback_fingerprint', NEW.payload_fingerprint, true);
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION settlement.validate_callback_insert() FROM PUBLIC;

COMMENT ON FUNCTION settlement.validate_callback_insert() IS
  'Validates one exact PENDING Settlement operation and binds Deal, operation, callback event, partner, status and payload fingerprint to the current transaction.';
