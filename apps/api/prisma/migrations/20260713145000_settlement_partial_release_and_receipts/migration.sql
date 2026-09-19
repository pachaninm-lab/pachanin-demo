-- IR-10.4 partial payout state and durable receipt hardening.

-- Legacy PostgreSQL callback replay remains available only before a deal is
-- adopted by Settlement authority. Exact replays may resolve DONE operations;
-- the legacy command service still validates the event/idempotency fact.
CREATE OR REPLACE FUNCTION public.app_bank_callback_scope(
  p_deal_id TEXT,
  p_operation_id TEXT
)
RETURNS TABLE ("tenantId" TEXT, "buyerOrgId" TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
STABLE
AS $function$
  SELECT scoped."tenantId", scoped."buyerOrgId"
  FROM (
    SELECT deal."tenantId", deal."buyerOrgId", 0 AS authority_priority
    FROM settlement.bank_operations operation
    JOIN public."deals" deal ON deal."id" = operation.deal_id
    WHERE operation.deal_id = p_deal_id
      AND operation.id = p_operation_id
      AND deal."tenantId" = operation.tenant_id

    UNION ALL

    SELECT deal."tenantId", deal."buyerOrgId", 1 AS authority_priority
    FROM public."bank_operations" operation
    JOIN public."deals" deal ON deal."id" = operation."dealId"
    WHERE operation."dealId" = p_deal_id
      AND operation."id" = p_operation_id
      AND NOT EXISTS (
        SELECT 1
        FROM settlement.payments authority
        WHERE authority.deal_id = p_deal_id
      )
  ) scoped
  ORDER BY scoped.authority_priority
  LIMIT 1
$function$;

-- A partial beneficiary payout is not the final deal release request. The Deal
-- remains DOCUMENTS_COMPLETE until all reserved funds are either requested for
-- release/refund and no active hold remains. The application still performs CAS
-- and writes the version/event/audit in the same transaction.
CREATE OR REPLACE FUNCTION settlement.normalize_release_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
DECLARE
  payment_record settlement.payments%ROWTYPE;
  committed_minor BIGINT;
BEGIN
  IF OLD."status" = 'DOCUMENTS_COMPLETE'
     AND NEW."status" = 'RELEASE_REQUESTED'
  THEN
    SELECT * INTO payment_record
    FROM settlement.payments payment
    WHERE payment.deal_id = NEW."id";

    IF FOUND THEN
      committed_minor :=
        payment_record.confirmed_released_minor
        + payment_record.pending_released_minor
        + payment_record.confirmed_refunded_minor
        + payment_record.pending_refunded_minor;

      IF committed_minor < payment_record.confirmed_reserved_minor
         OR payment_record.active_hold_minor > 0
      THEN
        NEW."status" := OLD."status";
        NEW."nextAction" := 'Запросить оставшиеся выплаты';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS settlement_partial_release_transition ON public."deals";
CREATE TRIGGER settlement_partial_release_transition
BEFORE UPDATE OF "status" ON public."deals"
FOR EACH ROW
EXECUTE FUNCTION settlement.normalize_release_request_transition();

-- Every Settlement bank request receives a restart-safe durable command receipt
-- in the same PostgreSQL transaction as payment state and bank operation. The
-- delivery outbox entry remains separate and PENDING.
CREATE OR REPLACE FUNCTION settlement.append_operation_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
BEGIN
  INSERT INTO public."outbox_entries" (
    "id",
    "type",
    "dealId",
    "payload",
    "status",
    "idempotencyKey",
    "maxRetries",
    "retryCount",
    "nextRetryAt",
    "correlationId",
    "createdAt",
    "confirmedAt"
  ) VALUES (
    'settlement-receipt:' || NEW.id,
    'settlement.command.receipt',
    NEW.deal_id,
    jsonb_build_object(
      'result', jsonb_build_object(
        'operationId', NEW.id,
        'operation', NEW.operation_type,
        'status', NEW.status,
        'amountKopecks', NEW.amount_minor::text,
        'beneficiaryId', NEW.beneficiary_id,
        'commandId', NEW.command_id,
        'duplicate', false
      )
    ),
    'CONFIRMED',
    'settlement-receipt:' || NEW.idempotency_key,
    5,
    0,
    now(),
    NEW.command_id,
    now(),
    now()
  )
  ON CONFLICT ("idempotencyKey") DO NOTHING;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS settlement_operation_receipt ON settlement.bank_operations;
CREATE TRIGGER settlement_operation_receipt
AFTER INSERT ON settlement.bank_operations
FOR EACH ROW
EXECUTE FUNCTION settlement.append_operation_receipt();
