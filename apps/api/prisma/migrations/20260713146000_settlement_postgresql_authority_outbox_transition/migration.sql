-- IR-10.4: the verified callback must close the exact durable bank-request
-- outbox row in the same transaction as payment, operation, ledger and audit.
-- General outbox UPDATE rights remain restricted to the worker principal.

CREATE OR REPLACE FUNCTION settlement.guard_callback_outbox_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF current_setting('app.current_role', true) = 'BANK_CALLBACK' THEN
    IF OLD.status <> 'PENDING'
      OR NEW.status NOT IN ('CONFIRMED', 'FAILED')
      OR (
        to_jsonb(NEW)
          - 'status'
          - 'confirmedAt'
          - 'failedAt'
          - 'lastError'
      ) IS DISTINCT FROM (
        to_jsonb(OLD)
          - 'status'
          - 'confirmedAt'
          - 'failedAt'
          - 'lastError'
      )
      OR (NEW.status = 'CONFIRMED' AND (NEW."confirmedAt" IS NULL OR NEW."failedAt" IS NOT NULL))
      OR (NEW.status = 'FAILED' AND NEW."failedAt" IS NULL)
    THEN
      RAISE EXCEPTION 'bank callback may only close the exact pending settlement outbox row'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS settlement_callback_outbox_column_guard
  ON public.outbox_entries;
CREATE TRIGGER settlement_callback_outbox_column_guard
BEFORE UPDATE ON public.outbox_entries
FOR EACH ROW
EXECUTE FUNCTION settlement.guard_callback_outbox_update();

DROP POLICY IF EXISTS outbox_entries_settlement_callback_update
  ON public.outbox_entries;
CREATE POLICY outbox_entries_settlement_callback_update
ON public.outbox_entries
FOR UPDATE
USING (
  settlement.context_ready()
  AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
  AND EXISTS (
    SELECT 1
    FROM settlement.bank_operations operation
    JOIN public.deals deal ON deal.id = operation.deal_id
    WHERE 'settlement-bank-request:' || operation.id = outbox_entries."idempotencyKey"
      AND operation.deal_id = outbox_entries."dealId"
      AND operation.tenant_id = current_setting('app.current_tenant_id', true)
      AND operation.status IN ('CONFIRMED', 'FAILED')
      AND operation.callback_event_id IS NOT NULL
      AND operation.callback_key_id IS NOT NULL
      AND operation.callback_payload_fingerprint IS NOT NULL
      AND deal."tenantId" = operation.tenant_id
      AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
  )
)
WITH CHECK (
  settlement.context_ready()
  AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
  AND EXISTS (
    SELECT 1
    FROM settlement.bank_operations operation
    JOIN public.deals deal ON deal.id = operation.deal_id
    WHERE 'settlement-bank-request:' || operation.id = outbox_entries."idempotencyKey"
      AND operation.deal_id = outbox_entries."dealId"
      AND operation.tenant_id = current_setting('app.current_tenant_id', true)
      AND operation.status IN ('CONFIRMED', 'FAILED')
      AND operation.callback_event_id IS NOT NULL
      AND operation.callback_key_id IS NOT NULL
      AND operation.callback_payload_fingerprint IS NOT NULL
      AND deal."tenantId" = operation.tenant_id
      AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
  )
);

CREATE OR REPLACE FUNCTION settlement.assert_bank_request_outbox_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
DECLARE
  matched_rows INTEGER;
  expected_status TEXT;
BEGIN
  IF OLD.status = 'PENDING' AND NEW.status IN ('CONFIRMED', 'FAILED') THEN
    IF NOT settlement.context_ready()
      OR current_setting('app.current_role', true) <> 'BANK_CALLBACK'
      OR NEW.callback_event_id IS NULL
      OR NEW.callback_key_id IS NULL
      OR NEW.callback_payload_fingerprint IS NULL
    THEN
      RAISE EXCEPTION 'verified bank callback context is required to close settlement outbox'
        USING ERRCODE = '42501';
    END IF;

    expected_status := CASE WHEN NEW.status = 'CONFIRMED' THEN 'CONFIRMED' ELSE 'FAILED' END;
    SELECT count(*) INTO matched_rows
    FROM public.outbox_entries entry
    WHERE entry."dealId" = NEW.deal_id
      AND entry."idempotencyKey" = 'settlement-bank-request:' || NEW.id
      AND entry.status = expected_status
      AND (
        (expected_status = 'CONFIRMED' AND entry."confirmedAt" IS NOT NULL AND entry."failedAt" IS NULL)
        OR (expected_status = 'FAILED' AND entry."failedAt" IS NOT NULL)
      );

    IF matched_rows <> 1 THEN
      RAISE EXCEPTION 'exact settlement bank-request outbox row was not closed atomically: operation=% rows=%',
        NEW.id, matched_rows
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS settlement_operation_outbox_callback_invariant
  ON settlement.bank_operations;
CREATE CONSTRAINT TRIGGER settlement_operation_outbox_callback_invariant
AFTER UPDATE ON settlement.bank_operations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION settlement.assert_bank_request_outbox_closed();

REVOKE ALL ON FUNCTION settlement.assert_bank_request_outbox_closed() FROM PUBLIC;
REVOKE ALL ON FUNCTION settlement.guard_callback_outbox_update() FROM PUBLIC;
COMMENT ON FUNCTION settlement.assert_bank_request_outbox_closed() IS
  'At transaction commit, rejects a confirmed/failed Settlement callback unless its exact durable bank-request outbox row was closed in the same transaction.';
COMMENT ON FUNCTION settlement.guard_callback_outbox_update() IS
  'Rejects any BANK_CALLBACK outbox mutation outside status/timestamp/error closure of one pending Settlement request.';
